import express from 'express';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/typescript-sdk';
import { config } from 'dotenv';
import axios from 'axios';

// 環境変数の読み込み
config();

// サービス設定
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3004';

// サーバー初期化
const app = express();
app.use(express.json());

// MCP クライアントを初期化
let mcpClient: Client;

async function initializeMCPClient() {
  try {
    console.log('Initializing MCP Client...');
    
    // 認証サービスからトークン情報を取得
    const authResponse = await axios.get(`${AUTH_SERVICE_URL}/auth-info`);
    const authInfo = authResponse.data;
    
    // MCPクライアントの設定
    mcpClient = new Client({
      name: "Discord MCP Bot",
      version: "1.0.0",
      capabilities: {
        tools: true,
        resources: { subscribe: true },
        sampling: true,
        prompts: true
      }
    });
    
    // サーバーURLの取得
    const serverUrl = process.env.MCP_SERVER_URL;
    if (!serverUrl) {
      throw new Error('MCP_SERVER_URL environment variable is required');
    }
    
    // トランスポートの設定
    const transport = new StreamableHTTPClientTransport(
      new URL(serverUrl),
      { 
        requestInit: {
          headers: authInfo.tokens ? {
            'Authorization': `Bearer ${authInfo.tokens.access_token}`
          } : undefined
        }
      }
    );
    
    // クライアントをトランスポートに接続
    await mcpClient.connect(transport);
    console.log('MCP Client initialized successfully!');
    
    // サーバー機能の確認
    const capabilities = mcpClient.getServerCapabilities();
    console.log('Server capabilities:', capabilities);
    
  } catch (error) {
    console.error('Failed to initialize MCP client:', error);
    // 5秒後に再試行
    setTimeout(initializeMCPClient, 5000);
  }
}

// サーバー起動前にMCPクライアントを初期化
initializeMCPClient();

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({ status: 'initializing' });
  }
  res.json({ status: 'ok' });
});

// 補完エンドポイント
app.post('/completion', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({ error: 'MCP Client not initialized' });
    }
    
    const { prompt, maxTokens = 1000 } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const response = await mcpClient.complete({
      prompt,
      maxTokens
    });
    
    res.json(response);
  } catch (error) {
    console.error('Error in completion:', error);
    res.status(500).json({ error: 'Failed to generate completion' });
  }
});

// プロンプト一覧エンドポイント
app.get('/prompts/list', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({ error: 'MCP Client not initialized' });
    }
    
    const prompts = await mcpClient.listPrompts();
    res.json(prompts);
  } catch (error) {
    console.error('Error listing prompts:', error);
    res.status(500).json({ error: 'Failed to list prompts' });
  }
});

// プロンプト取得エンドポイント
app.get('/prompts/:name', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({ error: 'MCP Client not initialized' });
    }
    
    const name = req.params.name;
    const prompt = await mcpClient.getPrompt({ name });
    res.json(prompt);
  } catch (error) {
    console.error(`Error getting prompt ${req.params.name}:`, error);
    res.status(500).json({ error: 'Failed to get prompt' });
  }
});

// プロンプト完了エンドポイント
app.post('/prompts/complete', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({ error: 'MCP Client not initialized' });
    }
    
    const { name, additionalText } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Prompt name is required' });
    }
    
    // プロンプトを取得
    const promptInfo = await mcpClient.getPrompt({ name });
    
    // プロンプトとユーザー入力を組み合わせる
    const combinedPrompt = additionalText 
      ? `${promptInfo.prompt}\n\nユーザー入力: ${additionalText}`
      : promptInfo.prompt;
    
    // 完了を実行
    const response = await mcpClient.complete({
      prompt: combinedPrompt,
      maxTokens: 1000
    });
    
    res.json(response);
  } catch (error) {
    console.error('Error completing prompt:', error);
    res.status(500).json({ error: 'Failed to complete prompt' });
  }
});

// ツール一覧エンドポイント
app.get('/tools/list', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({ error: 'MCP Client not initialized' });
    }
    
    const tools = await mcpClient.listTools();
    res.json(tools);
  } catch (error) {
    console.error('Error listing tools:', error);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// ツール呼び出しエンドポイント
app.post('/tools/call', async (req, res) => {
  try {
    if (!mcpClient) {
      return res.status(503).json({ error: 'MCP Client not initialized' });
    }
    
    const { name, args } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Tool name is required' });
    }
    
    const result = await mcpClient.callTool({
      name,
      args: args || {}
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error calling tool:', error);
    res.status(500).json({ error: 'Failed to call tool' });
  }
});

// サーバー起動
const PORT = process.env.MCP_CLIENT_PORT || 3002;
app.listen(PORT, () => {
  console.log(`MCP Client Service running on port ${PORT}`);
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => cleanup());
process.on('SIGTERM', () => cleanup());

async function cleanup() {
  console.log('Shutting down MCP Client Service...');
  if (mcpClient) {
    try {
      // トランスポートを閉じる
      const transport = (mcpClient as any).transport;
      if (transport && typeof transport.close === 'function') {
        await transport.close();
      }
    } catch (error) {
      console.error('Error closing transport:', error);
    }
  }
  process.exit(0);
}
