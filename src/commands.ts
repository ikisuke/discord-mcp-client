import { Client as MCPClient } from '@modelcontextprotocol/typescript-sdk';
import { Message, EmbedBuilder } from 'discord.js';
import { getWeather, generateImage } from './tools.js';

// コマンドハンドラーの型定義
type CommandHandler = (message: Message, args: string[], mcpClient: MCPClient) => Promise<void>;

// コマンドマップ
const commands: Record<string, CommandHandler> = {
  // ヘルプコマンド
  async help(message) {
    const embed = new EmbedBuilder()
      .setTitle('Bot コマンドヘルプ')
      .setDescription('利用可能なコマンド一覧:')
      .setColor(0x3498db)
      .addFields(
        { name: '!help', value: 'このヘルプメッセージを表示' },
        { name: '!tools', value: '利用可能なツールを表示' },
        { name: '!prompt <名前> [テキスト]', value: '保存されたプロンプトを使用' },
        { name: '!weather <場所>', value: '指定した場所の天気情報を取得' },
        { name: '!image <説明>', value: '指定した説明に基づいて画像を生成' }
      )
      .setFooter({ text: '@BotName に直接メッセージを送ることもできます' });

    await message.reply({ embeds: [embed] });
  },
  
  // 利用可能なツールを表示
  async tools(message, _, mcpClient) {
    try {
      const tools = await mcpClient.listTools();
      
      if (tools.tools.length === 0) {
        await message.reply('利用可能なツールはありません。');
        return;
      }
      
      const embed = new EmbedBuilder()
        .setTitle('利用可能なツール')
        .setColor(0x2ecc71)
        .setDescription('現在利用可能なツール一覧:');
      
      // ツール情報をフィールドとして追加
      tools.tools.forEach(tool => {
        embed.addFields({
          name: tool.name, 
          value: tool.description || 'No description'
        });
      });
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error listing tools:', error);
      await message.reply('ツール一覧の取得中にエラーが発生しました。');
    }
  },
  
  // 保存されたプロンプトを使用
  async prompt(message, args, mcpClient) {
    if (args.length === 0) {
      await message.reply('使用法: !prompt <プロンプト名> [追加テキスト]');
      return;
    }
    
    const promptName = args[0];
    const additionalText = args.slice(1).join(' ');
    
    try {
      await message.channel.sendTyping();
      
      // プロンプト情報を取得
      const promptInfo = await mcpClient.getPrompt({ name: promptName });
      
      // プロンプトとユーザー入力を組み合わせる
      const combinedPrompt = additionalText 
        ? `${promptInfo.prompt}\n\nユーザー入力: ${additionalText}`
        : promptInfo.prompt;
      
      // 完了APIを呼び出す
      const response = await mcpClient.complete({
        prompt: combinedPrompt,
        maxTokens: 1000
      });
      
      await message.reply(response.text);
    } catch (error) {
      console.error(`Error using prompt ${promptName}:`, error);
      await message.reply(`プロンプト "${promptName}" の使用中にエラーが発生しました。`);
    }
  },
  
  // 天気情報を取得
  async weather(message, args, mcpClient) {
    if (args.length === 0) {
      await message.reply('使用法: !weather <場所>');
      return;
    }
    
    const location = args.join(' ');
    await getWeather(message, mcpClient, location);
  },
  
  // 画像生成
  async image(message, args, mcpClient) {
    if (args.length === 0) {
      await message.reply('使用法: !image <説明>');
      return;
    }
    
    const prompt = args.join(' ');
    await generateImage(message, mcpClient, prompt);
  }
};

/**
 * コマンド処理関数
 * @returns コマンドとして処理されたかどうか
 */
export async function handleCommand(message: Message, mcpClient: MCPClient): Promise<boolean> {
  const content = message.content.trim();
  
  // コマンド形式かチェック（!で始まる）
  if (!content.startsWith('!')) return false;
  
  // コマンドと引数を分解
  const args = content.slice(1).split(/\s+/);
  const commandName = args.shift()?.toLowerCase() || '';
  
  // コマンドが登録されているか確認
  const handler = commands[commandName];
  if (!handler) return false;
  
  // コマンドを実行
  try {
    await handler(message, args, mcpClient);
    return true;
  } catch (error) {
    console.error(`Error executing command ${commandName}:`, error);
    await message.reply('コマンド実行中にエラーが発生しました。');
    return true;
  }
}
