import { Message } from 'discord.js';

/**
 * エラーハンドリングユーティリティ
 */

/**
 * エラーの種類を定義
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  API = 'API',
  INTERNAL = 'INTERNAL',
  UNKNOWN = 'UNKNOWN',
}

/**
 * エラー情報を包含するクラス
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType = ErrorType.UNKNOWN,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * エラーの種類を判定する
 * @param error エラーオブジェクト
 * @returns エラータイプ
 */
export function determineErrorType(error: unknown): ErrorType {
  if (error instanceof AppError) {
    return error.type;
  }

  // エラーメッセージからエラータイプを推測
  const errorString = String(error);
  if (errorString.includes('network') || errorString.includes('timeout') || errorString.includes('ECONNREFUSED')) {
    return ErrorType.NETWORK;
  } else if (errorString.includes('authentication') || errorString.includes('unauthorized') || errorString.includes('403')) {
    return ErrorType.AUTHENTICATION;
  } else if (errorString.includes('validation') || errorString.includes('invalid')) {
    return ErrorType.VALIDATION;
  } else if (errorString.includes('API') || errorString.includes('rate limit')) {
    return ErrorType.API;
  }

  return ErrorType.UNKNOWN;
}

/**
 * エラータイプに応じたユーザー向けメッセージを生成
 * @param error エラーオブジェクト
 * @returns ユーザー向けエラーメッセージ
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const errorType = determineErrorType(error);

  switch (errorType) {
    case ErrorType.NETWORK:
      return 'ネットワーク接続に問題が発生しました。インターネット接続を確認してください。';
    case ErrorType.AUTHENTICATION:
      return '認証エラーが発生しました。ボットのトークンが正しく設定されているか確認してください。';
    case ErrorType.VALIDATION:
      return '入力データが無効です。お手数ですが、入力内容を確認してください。';
    case ErrorType.API:
      return 'API呼び出しに問題が発生しました。しばらく時間をおいて再試行してください。';
    case ErrorType.INTERNAL:
      return '内部エラーが発生しました。ボットの管理者に連絡してください。';
    default:
      return 'すみません、処理中にエラーが発生しました。後でもう一度お試しください。';
  }
}

/**
 * エラーを処理してユーザーに応答する
 * @param error エラーオブジェクト
 * @param message Discordメッセージ
 */
export async function handleAndReplyError(error: unknown, message: Message): Promise<void> {
  // エラーをコンソールに出力
  console.error('エラー:', error);

  // ユーザー向けメッセージを生成
  const userMessage = getUserFriendlyErrorMessage(error);

  // メッセージを送信
  try {
    await message.reply({
      content: userMessage,
      allowedMentions: { repliedUser: true }
    });
  } catch (replyError) {
    console.error('エラー応答の送信に失敗しました:', replyError);
  }
}

/**
 * 処理を安全に実行し、エラーハンドリングを提供する
 * @param operation 非同期処理関数
 * @param errorHandler エラーハンドラ関数
 * @returns 処理結果（エラーの場合はundefined）
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  errorHandler: (error: unknown) => Promise<void>
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    await errorHandler(error);
    return undefined;
  }
}
