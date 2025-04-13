import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import Anthropic from '@anthropic-ai/sdk';
import { MCPServersConfig } from './config.js';
import { CallToolResultSchema, McpError } from '@modelcontextprotocol/sdk/types.js';

const MODEL_NAME = 'claude-3-7-sonnet-latest';

export async function initializeToolsAndClients(config: MCPServersConfig): Promise<{
  allTools: Anthropic.Tool[],
  toolServerMap: Map<string, Client>,
}> {
  let allTools: Anthropic.Tool[] = [];
  const toolServerMap = new Map();

  // Initialize clients
  for (const key in config.mcpServers) {
      console.log(key);
      // Skip GitHub MCP server if GITHUB_PERSONAL_ACCESS_TOKEN is not defined
      if (key === 'github' && !process.env.GITHUB_TOKEN) {
          console.log('Skipping GitHub MCP server initialization: GITHUB_PERSONAL_ACCESS_TOKEN is not defined');
          continue;
      }

      const params = config.mcpServers[key];
      const client = new Client(
          {
              name: "discord-mcp-bot",
              version: '0.1.0',
          },
          {
              capabilities: {
                  sampling: {},
              },
          },
      );

      console.log("connecting", params);
      await client.connect(new StdioClientTransport(params));

      const toolList = await client.listTools();
      const tools = toolList.tools.map((tool) => {
          if (toolServerMap.has(tool.name)) {
              console.warn(`Warning: Tool name "${tool.name}" is already registered. Overwriting previous registration.`);
          }
          toolServerMap.set(tool.name, client);
          return {
              name: tool.name,
              description: tool.description,
              input_schema: tool.inputSchema,
          };
      });

      allTools = allTools.concat(tools);
  }

  return { allTools, toolServerMap };
}

/**
 * スレッド会話プロセッサーのインターフェース
 */
export interface MCPClient {
  processThreadConversation: (
    messages: any[], 
    botId: string, 
    serverConfig: MCPServersConfig
  ) => Promise<Anthropic.MessageParam[]>;
}

/**
 * MCPクライアントをセットアップして返す
 */
export function setupMCPClient(): MCPClient {
  return {
    processThreadConversation: async (messages: any[], botId: string, serverConfig: MCPServersConfig) => {
      // スレッド内の会話をAnthropicの会話形式に変換
      const conversationMessages: Anthropic.MessageParam[] = [];
      
      for (const msg of messages) {
        // botからのメッセージはassistantとして扱う
        if (msg.author.id === botId) {
          conversationMessages.push({
            role: 'assistant',
            content: msg.content
          });
        } 
        // それ以外はuserとして扱う
        else {
          conversationMessages.push({
            role: 'user',
            content: msg.content
          });
        }
      }
      
      // 会話履歴を基にAnthropicに問い合わせ
      return callAnthropic(conversationMessages, serverConfig);
    }
  };
}

function processMessages(
  messages: Anthropic.MessageParam[],
  currentToolUseBlock: Anthropic.ToolUseBlock | undefined
): { updatedMessages: Anthropic.MessageParam[]; continue: boolean } {
  if (!currentToolUseBlock) {
      return { updatedMessages: messages, continue: false };
  }
  const updatedMessages = [...messages];
  return { updatedMessages, continue: true };
}

async function handleMessageContent(
  message: Anthropic.Message,
  messages: Anthropic.MessageParam[]
): Promise<{ toolUseBlock: Anthropic.ToolUseBlock | undefined; messages: Anthropic.MessageParam[] }> {
  let currentToolUseBlock: Anthropic.ToolUseBlock | undefined;
  const updatedMessages = [...messages]; // Create new array to avoid mutation

  for (const contentBlock of message.content) {
      if (contentBlock.type === 'text') {
          updatedMessages.push({
              role: 'assistant',
              content: contentBlock.text,
          });
          console.log('Assistant:', contentBlock.text);
      } else if (contentBlock.type === 'tool_use') {
          currentToolUseBlock = contentBlock;
      }
  }

  return {
      toolUseBlock: currentToolUseBlock,
      messages: updatedMessages
  };
}

// callAnthropicを修正してメッセージ配列を受け取れるようにする
async function callAnthropic(
  conversationInput: string | Anthropic.MessageParam[], 
  serverConfig: MCPServersConfig, 
  maxIterations = 10
) {
  const anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  }); // gets API Key from environment variable ANTHROPIC_API_KEY

  console.log(serverConfig);
  const { allTools, toolServerMap } = await initializeToolsAndClients(serverConfig);

  let conversationMessages: Anthropic.MessageParam[] = [];

  // 文字列の場合は単一のユーザーメッセージとして扱う
  if (typeof conversationInput === 'string') {
    const userMessage: Anthropic.MessageParam = {
      role: 'user',
      content: conversationInput,
    };
    conversationMessages.push(userMessage);
  } 
  // メッセージ配列の場合はそのまま使用
  else {
    conversationMessages = [...conversationInput];
  }

  const systemMessage = `You are Mini Coder, a highly skilled software engineer with extensive knowledge in various programming languages, frameworks, design patterns, and best practices.
For more information about tasks, you can read the documentation in the docs/ directory.
`;

  console.log(allTools);
  let message = await anthropicClient.messages.create({
      model: MODEL_NAME,
      max_tokens: 2024,
      temperature: 0.0,
      system: systemMessage,
      messages: conversationMessages,
      tools: allTools,
  });

  let { toolUseBlock, messages } = await handleMessageContent(message, conversationMessages);
  conversationMessages = messages;
  let currentToolUseBlock = toolUseBlock;

  let iterationCount = 0;
  while (currentToolUseBlock && iterationCount < maxIterations) {
      iterationCount++;
      if (currentToolUseBlock) {
          console.log({ currentToolUseBlock });
      }
      const { updatedMessages, continue: shouldContinue } = processMessages(conversationMessages, currentToolUseBlock);
      conversationMessages = updatedMessages;
      if (!shouldContinue) break;

      const mcpClient = toolServerMap.get(currentToolUseBlock.name);
      if (!mcpClient) {
          throw new Error(`Tool server not found for tool ${currentToolUseBlock.name}`);
      }

      let toolResult;
      try {
          toolResult = await mcpClient.callTool(
              {
                  name: currentToolUseBlock.name,
                  arguments: currentToolUseBlock.input as { [x: string]: unknown },
              },
              CallToolResultSchema,
          );
      } catch (error) {
          console.error('Error calling tool:', error);
          const mcpError = new McpError((error as any).code, (error as any).message, (error as any).data);
          conversationMessages.push({
              role: 'user',
              content: `ToolUser: ${JSON.stringify(currentToolUseBlock)}, Error: ${mcpError.message}`,
          });
          currentToolUseBlock = undefined;
          continue;
      }

      for (const resultContent of toolResult.content as any[]) {
          console.log('Tool Result:', resultContent.text.slice(0, 255));
          const userMessage: Anthropic.MessageParam = {
              role: 'user',
              content: resultContent.text,
          };
          conversationMessages.push(userMessage);
      }

      message = await anthropicClient.messages.create({
          model: MODEL_NAME,
          max_tokens: 2024,
          temperature: 0.0,
          system: systemMessage,
          messages: conversationMessages,
          tools: allTools,
      });

      currentToolUseBlock = await handleMessageContent(message, conversationMessages).then(result => {
          conversationMessages = result.messages;
          return result.toolUseBlock;
      });
  }

  const mcpClients = new Set(toolServerMap.values());
  for (const client of mcpClients) {
      await client.close();
      console.log('Closed.');
  }
  
  // 最終的な会話履歴を返す（process.exit(0)は呼び出し側で行う）
  return conversationMessages;
}

export default callAnthropic;