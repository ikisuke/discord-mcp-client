import { Client, Events, GatewayIntentBits, Message } from 'discord.js';
import { config } from 'dotenv';
import axios from 'axios';

// 環境変数の読み込み
config();

// サービス設定
const COMMAND_SERVICE_URL = process.env.COMMAND_SERVICE_URL || 'http://localhost:3001';

// Discord クライアントの初期化
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Bot がログインしたときの処理
discordClient.once(Events.ClientReady, (client) => {
  console.log(`Logged in as ${client.user.tag}`);
});

// メッセージを受信したときの処理
discordClient.on(Events.MessageCreate, async (message: Message) => {
  // 自分自身のメッセージは無視
  if (message.author.bot) return;
  
  try {
    // メッセージを構造化
    const messageData = {
      id: message.id,
      content: message.content,
      author: {
        id: message.author.id,
        username: message.author.username
      },
      channelId: message.channelId,
      guildId: message.guildId,
      mentions: Array.from(message.mentions.users.keys()),
      isMentioned: message.mentions.has(discordClient.user!.id),
      timestamp: message.createdTimestamp
    };
    
    // コマンドサービスにメッセージを転送
    const response = await axios.post(`${COMMAND_SERVICE_URL}/message`, messageData);
    
    // レスポンスを処理
    if (response.data && response.data.reply) {
      // タイピングインジケータを表示
      await message.channel.sendTyping();
      
      // 応答内容に基づいて返信
      if (response.data.embeds && response.data.embeds.length > 0) {
        await message.reply({ 
          content: response.data.reply,
          embeds: response.data.embeds,
          allowedMentions: { repliedUser: true }
        });
      } else {
        await message.reply({
          content: response.data.reply,
          allowedMentions: { repliedUser: true }
        });
      }
    }
  } catch (error) {
    console.error('Error processing message:', error);
    
    // エラーハンドリング - コマンドサービスが利用不可の場合
    if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
      console.error('Command service is unavailable');
    }
  }
});

// Discord にログイン
discordClient.login(process.env.DISCORD_TOKEN)
  .catch(error => {
    console.error('Failed to login to Discord:', error);
    process.exit(1);
  });

// API エンドポイントを設定 (Discord への返信用)
import express from 'express';
const app = express();
app.use(express.json());

// 特定のチャンネルにメッセージを送信するエンドポイント
app.post('/send-message', async (req, res) => {
  try {
    const { channelId, content, embeds } = req.body;
    
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(404).json({ error: 'Text channel not found' });
    }
    
    const message = await channel.send({
      content,
      embeds: embeds || []
    });
    
    res.json({ success: true, messageId: message.id });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// サーバー起動
const PORT = process.env.GATEWAY_PORT || 3000;
app.listen(PORT, () => {
  console.log(`Discord Gateway Service running on port ${PORT}`);
});

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => cleanup());
process.on('SIGTERM', () => cleanup());

async function cleanup() {
  console.log('Shutting down Discord Gateway Service...');
  discordClient.destroy();
  process.exit(0);
}
