import { OAuthClientProvider, OAuthTokens, OAuthClientInformation, OAuthClientInformationFull } from '@modelcontextprotocol/typescript-sdk';
import fs from 'fs/promises';
import path from 'path';

// 認証データの保存先
const AUTH_DIR = path.join(process.cwd(), '.auth');
const TOKENS_FILE = path.join(AUTH_DIR, 'tokens.json');
const CLIENT_FILE = path.join(AUTH_DIR, 'client.json');
const CODE_VERIFIER_FILE = path.join(AUTH_DIR, 'code_verifier.txt');

// 必要なディレクトリを作成
async function ensureAuthDir() {
  try {
    await fs.mkdir(AUTH_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create auth directory:', err);
  }
}

/**
 * Discord Botのための認証プロバイダークラス
 * OAuth 2.0認証フローを処理する
 */
export class BotAuthProvider implements OAuthClientProvider {
  // リダイレクトURL
  get redirectUrl(): string {
    return process.env.OAUTH_REDIRECT_URL || 'http://localhost:3000/callback';
  }
  
  // クライアントメタデータ
  get clientMetadata() {
    return {
      client_name: 'Discord MCP Bot',
      redirect_uris: [this.redirectUrl],
    };
  }
  
  // 保存されたクライアント情報の読み込み
  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    try {
      const data = await fs.readFile(CLIENT_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      return undefined;
    }
  }
  
  // クライアント情報の保存
  async saveClientInformation(clientInfo: OAuthClientInformationFull): Promise<void> {
    await ensureAuthDir();
    await fs.writeFile(CLIENT_FILE, JSON.stringify(clientInfo, null, 2));
  }
  
  // トークンの読み込み
  async tokens(): Promise<OAuthTokens | undefined> {
    try {
      const data = await fs.readFile(TOKENS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      return undefined;
    }
  }
  
  // トークンの保存
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await ensureAuthDir();
    await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
  }
  
  // 認証URLへのリダイレクト（サーバー環境では管理者に通知）
  async redirectToAuthorization(authUrl: URL): Promise<void> {
    console.log('===== 認証が必要です =====');
    console.log('以下のURLにアクセスして認証を完了してください:');
    console.log(authUrl.toString());
    console.log('認証完了後、コールバックURLに表示される認証コードを使用してください。');
    console.log('例: node dist/auth-cli.js --code=AUTHORIZATION_CODE');
    console.log('===========================');
  }
  
  // コードベリファイアの保存
  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await ensureAuthDir();
    await fs.writeFile(CODE_VERIFIER_FILE, codeVerifier);
  }
  
  // コードベリファイアの読み込み
  async codeVerifier(): Promise<string> {
    try {
      return await fs.readFile(CODE_VERIFIER_FILE, 'utf-8');
    } catch (err) {
      throw new Error('認証情報が見つかりません。再度認証を行ってください。');
    }
  }
}
