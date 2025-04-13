import { Client, Message, Events, ChannelType } from 'discord.js';
import { handleThreadMessage } from '../services/thread-service.js';
import { handleMentionMessage } from '../services/mention-service.js';

/**
 * メッセージ関連のイベントハンドラを設定する
 * @param client Discord クライアント
 */
export function setupMessageHandlers(client: Client) {
  client.on(Events.MessageCreate, async (message: Message) => {
    // 自分自身のメッセージは無視
    if (message.author.bot) return;
    
    // スレッド内のメッセージかチェック
    if (message.channel.type === ChannelType.PublicThread || message.channel.type === ChannelType.PrivateThread) {
      await handleThreadMessage(message, client);
      return;
    }
    
    // Bot へのメンションかどうかをチェック
    if (message.mentions.has(client.user!.id)) {
      await handleMentionMessage(message);
    }
  });
}