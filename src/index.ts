import { Client, Events, GatewayIntentBits, Message } from 'discord.js';
import { config } from 'dotenv';
import { setupMCPClient } from './mcp-client.js';
import { handleCommand } from './commands.js';

// 環境変数の読み込み
config();

// Discord クライアントの初期化
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// MCP クライアントのセットアップ
const mcpClient = setupMCPClient();

// Bot がログインしたときの処理
discordClient.once(Events.ClientReady, (client) => {
  console.log(`Logged in as ${client.user.tag}`);
});

// メッセージを受信したときの処理
discordClient.on(Events.MessageCreate, async (message: Message) => {
  // 自分自身のメッセージは無視
  if (message.author.bot) return;
  
  // コマンド処理を試みる
  const isCommand = await handleCommand(message, mcpClient);
  if (isCommand) return;
  
  // Bot へのメンションかどうかをチェック
  if (message.mentions.has(discordClient.user!.id)) {
    await handleMentionMessage(message);
  }
});

// メンションされたメッセージの処理
async function handleMentionMessage(message: Message) {
  try {
    // 入力テキストの準備（メンション部分を除去）
    const content = message.content.replace(/<@!?\d+>/g, '').trim();
    
    // 入力が空の場合は処理しない
    if (!content) return;
    
    // 「入力中...」のステータスを表示
    await message.channel.sendTyping();
    
    // MCP クライアントを使用して AI モデルに問い合わせ
    const response = await mcpClient.complete({
      prompt: content,
      maxTokens: 1000  // 応答の最大トークン数
    });
    
    // 応答を Discord チャンネルに送信
    await message.reply({
      content: response.text,
      allowedMentions: { repliedUser: true }
    });
  } catch (error) {
    console.error('Error processing message:', error);
    await message.reply('すみません、処理中にエラーが発生しました。');
  }
}

// Discord にログイン
discordClient.login(process.env.DISCORD_TOKEN)
  .catch(error => {
    console.error('Failed to login to Discord:', error);
    process.exit(1);
  });

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => cleanup());
process.on('SIGTERM', () => cleanup());

async function cleanup() {
  console.log('Shutting down...');
  // Discord クライアントを切断
  discordClient.destroy();
  // MCP クライアントを閉じる（もし close メソッドがあれば）
  if (mcpClient && typeof (mcpClient as any).close === 'function') {
    await (mcpClient as any).close();
  }
  process.exit(0);
}
