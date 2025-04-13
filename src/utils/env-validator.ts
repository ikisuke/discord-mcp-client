/**
 * 環境変数のバリデーションユーティリティ
 */

/**
 * 必須環境変数が設定されているかを確認する
 * 設定されていない場合はエラーメッセージを表示して終了する
 */
export function validateRequiredEnvVars(): void {
  const requiredVars = [
    'DISCORD_TOKEN',
    // 他の必須環境変数があれば追加
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error(`エラー: 以下の環境変数が設定されていません: ${missingVars.join(', ')}`);
    console.error('アプリケーションを起動するには、.env ファイルに上記の変数を設定してください。');
    process.exit(1);
  }
}

/**
 * オプション環境変数の値を取得し、デフォルト値を適用する
 * @param varName 環境変数名
 * @param defaultValue デフォルト値
 * @returns 環境変数の値またはデフォルト値
 */
export function getEnvVar(varName: string, defaultValue: string): string {
  const value = process.env[varName];
  if (!value) {
    console.warn(`警告: 環境変数 ${varName} が設定されていません。デフォルト値を使用します。`);
    return defaultValue;
  }
  return value;
}

/**
 * 数値型環境変数の値を取得し、デフォルト値を適用する
 * @param varName 環境変数名
 * @param defaultValue デフォルト値
 * @returns 環境変数の数値またはデフォルト値
 */
export function getEnvVarAsNumber(varName: string, defaultValue: number): number {
  const value = process.env[varName];
  if (!value) {
    console.warn(`警告: 環境変数 ${varName} が設定されていません。デフォルト値を使用します。`);
    return defaultValue;
  }
  
  const numValue = Number(value);
  if (isNaN(numValue)) {
    console.warn(`警告: 環境変数 ${varName} の値 "${value}" は有効な数値ではありません。デフォルト値を使用します。`);
    return defaultValue;
  }
  
  return numValue;
}

/**
 * 論理値型環境変数の値を取得し、デフォルト値を適用する
 * @param varName 環境変数名
 * @param defaultValue デフォルト値
 * @returns 環境変数の論理値またはデフォルト値
 */
export function getEnvVarAsBoolean(varName: string, defaultValue: boolean): boolean {
  const value = process.env[varName]?.toLowerCase();
  if (!value) {
    console.warn(`警告: 環境変数 ${varName} が設定されていません。デフォルト値を使用します。`);
    return defaultValue;
  }
  
  if (value === 'true' || value === '1' || value === 'yes') {
    return true;
  } else if (value === 'false' || value === '0' || value === 'no') {
    return false;
  } else {
    console.warn(`警告: 環境変数 ${varName} の値 "${value}" は有効な論理値ではありません。デフォルト値を使用します。`);
    return defaultValue;
  }
}
