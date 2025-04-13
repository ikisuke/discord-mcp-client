import { Client, Events, GatewayIntentBits, Message, Interaction, ChannelType, ThreadChannel, isJSONEncodable } from 'discord.js';
import { config } from 'dotenv';
import { setupMCPClient } from './mcp-client.js';
import { registerCommands, handleCommandInteraction, handleServiceSelection } from './slash-commands.js';
import { isChannelRegistered, getChannelType } from './channel-manager.js';
import { defaultConfig } from './config.js';

// 環境変数の読み込み
config();

// 必須環境変数のバリデーション
if (!process.env.DISCORD_TOKEN) {
  console.error('エラー: DISCORD_TOKEN 環境変数が設定されていません。');
  process.exit(1);
}

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
    console.error('エラー: インタラクション処理中に問題が発生しました', error);
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

/**
 * 処理中メッセージを安全に削除する
 */
async function safelyDeleteMessage(message: Message): Promise<void> {
  try {
    await message.delete();
  } catch (error) {
    console.error('エラー: メッセージの削除に失敗しました', error);
    // 削除エラーは無視するが、ログには残す
  }
}

/**
 * スレッドチャンネルかどうか確認する型ガード
 */
function isThreadChannel(channel: Message['channel']): channel is ThreadChannel {
  return channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread;
}

// スレッド内のメッセージを処理
async function handleThreadMessage(message: Message) {
  try {
    // スレッドチャンネルかどうか確認（型ガードを使用）
    if (!isThreadChannel(message.channel)) {
      return;
    }
    
    // 親チャンネルのIDを取得
    const parentId = message.channel.parentId;
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
      // 注: 将来的にはページネーションを実装して、より多くのメッセージを取得することが望ましい
      const messages = await message.channel.messages.fetch({ limit: 100 });
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
          const lastMessage = assistantMessages[assistantMessages.length - 1].content;
          if (typeof lastMessage === 'string') {
            responseText = lastMessage;
          } else if (isJSONEncodable(lastMessage)) {
            responseText = JSON.stringify(lastMessage);
          }
        }
      }
      
      // 処理中メッセージを削除
      await safelyDeleteMessage(processingMessage);
      
      // 応答を返す
      await message.reply({
        content: responseText,
        allowedMentions: { repliedUser: true }
      });
    } catch (error) {
      // 処理中メッセージを削除
      await safelyDeleteMessage(processingMessage);
      throw error; // 外側のエラーハンドリングに渡す
    }
  } catch (error) {
    console.error('エラー: スレッドメッセージ処理中に問題が発生しました', error);
    await message.reply('すみません、処理中にエラーが発生しました。');
  }
}

// メンションされたメッセージの処理
async function handleMentionMessage(message: Message) {
  try {
    // 入力テキストの準備（メンション部分を除去）
    const content = message.content.replace(/<@!?\\d+>/g, '').trim();
    
    // 入力が空の場合は処理しない
    if (!content) return;
    
    // 「考え中...」のメッセージを送信
    const processingMessage = await message.reply('考え中...');
    
    try {
      // MCPクライアントを使用してメッセージを処理
      const response = await mcpProcessor.processSingleMessage({
        role: 'user',
        content,
      }, defaultConfig);
      
      // 応答テキストを取得
      let responseText = "応答を生成できませんでした。";
      if (response && typeof response.content === 'string') {
        responseText = response.content;
      }
      
      // 処理中メッセージを削除
      await safelyDeleteMessage(processingMessage);
      
      // 応答を送信
      await message.reply({
        content: responseText,
        allowedMentions: { repliedUser: true }
      });
    } catch (error) {
      // 処理中メッセージを削除
      await safelyDeleteMessage(processingMessage);
      throw error; // 外側のエラーハンドリングに渡す
    }
  } catch (error) {
    console.error('エラー: メンションメッセージ処理中に問題が発生しました', error);
    await message.reply('すみません、処理中にエラーが発生しました。');
  }
}

// Discord にログイン
discordClient.login(process.env.DISCORD_TOKEN)
  .catch(error => {
    console.error('エラー: Discord へのログインに失敗しました', error);
    process.exit(1);
  });

// プロセス終了時のクリーンアップ
process.on('SIGINT', () => cleanup());
process.on('SIGTERM', () => cleanup());

async function cleanup() {
  console.log('シャットダウン中...');
  // Discord クライアントを切断
  discordClient.destroy();
  // プロセスを終了
  process.exit(0);
}
