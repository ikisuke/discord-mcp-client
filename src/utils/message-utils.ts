import { Message } from 'discord.js';

/**
 * メッセージ操作のためのユーティリティ関数群
 */

/**
 * 処理中メッセージを安全に削除する
 * @param message 削除するメッセージ
 */
export async function safelyDeleteMessage(message: Message): Promise<void> {
  try {
    await message.delete();
  } catch (error) {
    console.error('エラー: メッセージの削除に失敗しました', error);
    // 削除エラーは無視するが、ログには残す
  }
}

/**
 * ユーザーメッセージからメンション部分を除去した内容を取得する
 * @param message ユーザーメッセージ
 * @returns メンション部分を除去したテキスト
 */
export function getContentWithoutMentions(message: Message): string {
  // メンション形式: <@!123456789012345678> または <@123456789012345678>
  return message.content.replace(/<@!?\d+>/g, '').trim();
}

/**
 * メッセージの内容が空でないことを確認する
 * @param content メッセージ内容
 * @returns 内容が空でない場合は true
 */
export function hasValidContent(content: string): boolean {
  return content.trim().length > 0;
}

/**
 * 指定された文字数でメッセージを分割する
 * メッセージが長すぎる場合に Discordの制限（2000文字）を超えないように分割
 * @param content 分割するテキスト
 * @param maxLength 最大文字数
 * @returns 分割されたメッセージの配列
 */
export function splitMessageContent(content: string, maxLength: number = 2000): string[] {
  if (content.length <= maxLength) {
    return [content];
  }

  const parts: string[] = [];
  let currentIndex = 0;

  while (currentIndex < content.length) {
    // 最大長さで切り取る範囲を計算
    let cutLength = maxLength;
    
    // 文の途中で切れないようにする（可能であれば）
    if (currentIndex + cutLength < content.length) {
      // 句読点や改行で切る
      const punctuationMatch = content.substring(currentIndex, currentIndex + maxLength).match(/[。.?!？！\n][^\S\n]*(?=[^。.?!？！\n])/g);
      if (punctuationMatch && punctuationMatch.length > 0) {
        const lastPunctuation = content.substring(currentIndex, currentIndex + maxLength).lastIndexOf(punctuationMatch[punctuationMatch.length - 1]) + punctuationMatch[punctuationMatch.length - 1].length;
        if (lastPunctuation > 0) {
          cutLength = lastPunctuation;
        }
      }
    }

    parts.push(content.substring(currentIndex, currentIndex + cutLength));
    currentIndex += cutLength;
  }

  return parts;
}

/**
 * 複数のメッセージを順番に送信する
 * @param message 元のメッセージ（返信先）
 * @param contents 送信するコンテンツの配列
 * @param allowMentions 返信時にメンションを許可するかどうか
 */
export async function sendMultipartReply(
  message: Message, 
  contents: string[], 
  allowMentions: boolean = true
): Promise<void> {
  if (contents.length === 0) {
    return;
  }

  // 最初のメッセージは返信として送信
  await message.reply({
    content: contents[0],
    allowedMentions: { repliedUser: allowMentions }
  });

  // 残りのメッセージは通常のメッセージとして送信
  for (let i = 1; i < contents.length; i++) {
    await message.channel.send(contents[i]);
  }
}
