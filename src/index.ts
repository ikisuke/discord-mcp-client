import { Client, Events, GatewayIntentBits, Message, Interaction, ChannelType, ThreadChannel } from 'discord.js';
import { config } from 'dotenv';
import { setupMCPClient } from './mcp-client.js';
import { registerCommands, handleCommandInteraction, handleServiceSelection } from './slash-commands.js';
import { isChannelRegistered, getChannelType } from './channel-manager.js';
import { defaultConfig } from './config.js';

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
const mcpProcessor = setupMCPClient();

// Bot がログインしたときの処理
discordClient.once(Events.ClientReady, (client) => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // スラッシュコマンドを登録
  registerCommands(client);
});

// インタラクション（スラッシュコマンドなど）の処理
discordClient.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    // スラッシュコマンドの処理
    if (interaction.isCommand()) {
      await handleCommandInteraction(interaction);
      return;
    }
    
    // セレクトメニューの処理
    if (interaction.isStringSelectMenu()) {
      await handleServiceSelection(interaction);
      return;
    }
  } catch (error) {
    console.error('インタラクション処理エラー:', error);
    // エラーメッセージを返す（まだ応答していない場合のみ）
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'コマンド処理中にエラーが発生しました。',
        ephemeral: true
      });
    }
  }
});

// メッセージを受信したときの処理
discordClient.on(Events.MessageCreate, async (message: Message) => {
  // 自分自身のメッセージは無視
  if (message.author.bot) return;
  
  // スレッド内のメッセージかチェック
  if (message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.PrivateThread) {
    await handleThreadMessage(message);
    return;
  }
  
  // Bot へのメンションかどうかをチェック
  if (message.mentions.has(discordClient.user!.id)) {
    await handleMentionMessage(message);
  }
});

// スレッド内のメッセージを処理
async function handleThreadMessage(message: Message) {
  try {
    // スレッドチャンネルかどうか確認
    if (!(message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.PrivateThread)) {
      return;
    }
    
    // ThreadChannelとして型キャスト
    const threadChannel = message.channel as ThreadChannel;
    
    // 親チャンネルのIDを取得
    const parentId = threadChannel.parentId;
    if (!parentId) return;
    
    // 親チャンネルが登録されているか確認
    const parentChannel = isChannelRegistered(parentId);
    if (!parentChannel) return;
    
    // サービスタイプを取得
    const serviceType = getChannelType(parentId);
    
    // メッセージの内容を取得
    const content = message.content.trim();
    if (!content) return;
    
    // 「考え中...」のメッセージを送信
    const processingMessage = await message.reply('考え中...');
    
    try {
      // スレッド内の過去メッセージを取得（最大100件）
      const messages = await threadChannel.messages.fetch({ limit: 100 });
      // 時系列順にソート（古いものから新しいものへ）
      const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      
      // スレッド内の会話を処理
      const response = await mcpProcessor.processThreadConversation(
        sortedMessages, 
        discordClient.user!.id,
        defaultConfig
      );
      
      // 最後のアシスタントメッセージを取得
      let responseText = "応答を生成できませんでした。";
      if (response && response.length > 0) {
        const assistantMessages = response.filter(msg => msg.role === 'assistant');
        if (assistantMessages.length > 0) {
          responseText = assistantMessages[assistantMessages.length - 1].content as string;
        }
      }
      
      // 処理中メッセージを削除
      await processingMessage.delete().catch(() => {});
      
      // 応答を返す
      await message.reply({
        content: responseText,
        allowedMentions: { repliedUser: true }
      });
    } catch (e) {
      // 処理中メッセージを削除
      await processingMessage.delete().catch(() => {});
      throw e; // 外側のエラーハンドリングに渡す
    }
  } catch (error) {
    console.error('スレッドメッセージ処理エラー:', error);
    await message.reply('すみません、処理中にエラーが発生しました。');
  }
}

// メンションされたメッセージの処理
async function handleMentionMessage(message: Message) {
  try {
    // 入力テキストの準備（メンション部分を除去）
    const content = message.content.replace(/<@!?\d+>/g, '').trim();
    
    // 入力が空の場合は処理しない
    if (!content) return;
    
    // 「考え中...」のメッセージを送信
    const processingMessage = await message.reply('考え中...');
    
    try {
      // メッセージを処理して応答する
      // 注: MCPクライアントのAPI仕様が明確でないため、ここではシンプルな応答で代用
      await new Promise(resolve => setTimeout(resolve, 1000)); // 処理を模倣
      
      // 処理中メッセージを削除
      await processingMessage.delete().catch(() => {});
      
      // 応答を送信
      await message.reply({
        content: `あなたのメッセージを受け取りました: "${content}"\n現在このBotはスラッシュコマンド機能の開発中です。`,
        allowedMentions: { repliedUser: true }
      });
    } catch (e) {
      // 処理中メッセージを削除
      await processingMessage.delete().catch(() => {});
      throw e; // 外側のエラーハンドリングに渡す
    }
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
  // プロセスを終了
  process.exit(0);
}
