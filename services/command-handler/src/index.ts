import express from 'express';
import axios from 'axios';
import { config } from 'dotenv';

// 環境変数の読み込み
config();

// サービス設定
const MCP_CLIENT_SERVICE_URL = process.env.MCP_CLIENT_SERVICE_URL || 'http://localhost:3002';
const TOOLS_SERVICE_URL = process.env.TOOLS_SERVICE_URL || 'http://localhost:3003';

// サーバー初期化
const app = express();
app.use(express.json());

// コマンドハンドラーの型定義
type CommandHandler = (args: string[], messageData: any) => Promise<any>;

// コマンドマップ
const commands: Record<string, CommandHandler> = {
  // ヘルプコマンド
  async help(_, messageData) {
    return {
      reply: '利用可能なコマンド:',
      embeds: [
        {
          title: 'Bot コマンドヘルプ',
          description: '利用可能なコマンド一覧:',
          color: 0x3498db,
          fields: [
            { name: '!help', value: 'このヘルプメッセージを表示' },
            { name: '!tools', value: '利用可能なツールを表示' },
            { name: '!prompt <名前> [テキスト]', value: '保存されたプロンプトを使用' },
            { name: '!weather <場所>', value: '指定した場所の天気情報を取得' },
            { name: '!image <説明>', value: '指定した説明に基づいて画像を生成' }
          ],
          footer: { text: '@BotName に直接メッセージを送ることもできます' }
        }
      ]
    };
  },
  
  // ツール一覧コマンド
  async tools(_, messageData) {
    try {
      // MCP Client サービスに問い合わせ
      const response = await axios.get(`${MCP_CLIENT_SERVICE_URL}/tools/list`);
      const tools = response.data;
      
      if (!tools.tools || tools.tools.length === 0) {
        return { reply: '利用可能なツールはありません。' };
      }
      
      const fields = tools.tools.map((tool: any) => ({
        name: tool.name, 
        value: tool.description || 'No description'
      }));
      
      return {
        reply: '',
        embeds: [
          {
            title: '利用可能なツール',
            color: 0x2ecc71,
            description: '現在利用可能なツール一覧:',
            fields
          }
        ]
      };
    } catch (error) {
      console.error('Error listing tools:', error);
      return { reply: 'ツール一覧の取得中にエラーが発生しました。' };
    }
  },
  
  // プロンプト使用コマンド
  async prompt(args, messageData) {
    if (args.length === 0) {
      return { reply: '使用法: !prompt <プロンプト名> [追加テキスト]' };
    }
    
    const promptName = args[0];
    const additionalText = args.slice(1).join(' ');
    
    try {
      // MCP Client サービスに問い合わせ
      const response = await axios.post(`${MCP_CLIENT_SERVICE_URL}/prompts/complete`, {
        name: promptName,
        additionalText
      });
      
      return { reply: response.data.text };
    } catch (error) {
      console.error(`Error using prompt ${promptName}:`, error);
      return { reply: `プロンプト "${promptName}" の使用中にエラーが発生しました。` };
    }
  },
  
  // 天気情報コマンド
  async weather(args, messageData) {
    if (args.length === 0) {
      return { reply: '使用法: !weather <場所>' };
    }
    
    const location = args.join(' ');
    
    try {
      // ツールサービスに問い合わせ
      const response = await axios.post(`${TOOLS_SERVICE_URL}/weather`, { location });
      return response.data;
    } catch (error) {
      console.error('Error calling weather tool:', error);
      return { reply: '天気情報の取得中にエラーが発生しました。' };
    }
  },
  
  // 画像生成コマンド
  async image(args, messageData) {
    if (args.length === 0) {
      return { reply: '使用法: !image <説明>' };
    }
    
    const prompt = args.join(' ');
    
    try {
      // ツールサービスに問い合わせ
      const response = await axios.post(`${TOOLS_SERVICE_URL}/generate-image`, { prompt });
      return response.data;
    } catch (error) {
      console.error('Error generating image:', error);
      return { reply: '画像生成中にエラーが発生しました。' };
    }
  }
};

// メッセージ処理エンドポイント
app.post('/message', async (req, res) => {
  try {
    const messageData = req.body;
    
    // コマンドチェック（!で始まるメッセージ）
    if (messageData.content.startsWith('!')) {
      const args = messageData.content.slice(1).split(/\s+/);
      const commandName = args.shift()?.toLowerCase() || '';
      
      // コマンド処理
      if (commands[commandName]) {
        const result = await commands[commandName](args, messageData);
        return res.json(result);
      }
      
      // コマンドが見つからない場合
      return res.json({ reply: `未知のコマンド: ${commandName}。!help で利用可能なコマンドを確認できます。` });
    }
    
    // メンション対応（非コマンドメッセージ）
    if (messageData.isMentioned) {
      // メンション部分を除去
      const content = messageData.content.replace(/<@!?\d+>/g, '').trim();
      
      if (!content) {
        return res.json({ reply: 'こんにちは！何かお手伝いできることはありますか？' });
      }
      
      // MCP Client サービスに問い合わせて完了
      try {
        const response = await axios.post(`${MCP_CLIENT_SERVICE_URL}/completion`, { prompt: content });
        return res.json({ reply: response.data.text });
      } catch (error) {
        console.error('Error getting completion:', error);
        return res.json({ reply: '応答の生成中にエラーが発生しました。' });
      }
    }
    
    // コマンドでもメンションでもない場合は応答しない
    return res.json({});
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// サーバー起動
const PORT = process.env.COMMAND_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Command Handler Service running on port ${PORT}`);
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
