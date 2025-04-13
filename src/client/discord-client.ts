import { Client, Events, GatewayIntentBits } from 'discord.js';
import { registerCommands } from '../handlers/command-handler.js';

/**
 * Discord クライアントを初期化して設定する
 * @returns 設定済みのDiscordクライアントインスタンス
 */
export function setupDiscordClient(): Client {
  // Discord クライアントの初期化
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Bot がログインしたときの処理
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    
    // スラッシュコマンドを登録
    registerCommands(readyClient);
  });

  return client;
}

/**
 * Discord クライアントをクリーンアップする
 * @param client Discord クライアントインスタンス
 */
export function cleanupDiscordClient(client: Client): void {
  client.destroy();
}