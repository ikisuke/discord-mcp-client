import { config } from 'dotenv';
import { finishAuthWithCode } from './mcp-client.js';

// 環境変数の読み込み
config();

/**
 * 認証コードを処理するCLIスクリプト
 * OAuth認証フローの後に使用するためのユーティリティ
 * 
 * 使用例: node dist/auth-cli.js --code=YOUR_AUTH_CODE
 */
async function main() {
  try {
    // コマンドライン引数からコードを取得
    const args = process.argv.slice(2);
    let authCode: string | undefined;
    
    for (const arg of args) {
      if (arg.startsWith('--code=')) {
        authCode = arg.split('=')[1];
      }
    }
    
    if (!authCode) {
      console.error('Error: 認証コードが指定されていません');
      console.error('使用例: node dist/auth-cli.js --code=YOUR_AUTH_CODE');
      process.exit(1);
    }
    
    console.log('認証コードを処理中...');
    await finishAuthWithCode(authCode);
    console.log('認証が完了しました！Botを起動して使用できます。');
  } catch (error) {
    console.error('認証処理中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main();
