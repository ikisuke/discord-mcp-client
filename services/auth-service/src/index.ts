import express from 'express';
import { OAuthClientProvider, OAuthTokens, OAuthClientInformation, OAuthClientInformationFull, auth } from '@modelcontextprotocol/typescript-sdk';
import fs from 'fs/promises';
import path from 'path';
import { config } from 'dotenv';

// 環境変数の読み込み
config();

// サーバー初期化
const app = express();
app.use(express.json());

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

// 認証プロバイダークラスの実装
class BotAuthProvider implements OAuthClientProvider {
  // リダイレクトURL
  get redirectUrl(): string {
    return process.env.OAUTH_REDIRECT_URL || 'http://localhost:3004/callback';
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
  
  // 認証URLへのリダイレクト（サーバー環境ではURLを返す）
  async redirectToAuthorization(authUrl: URL): Promise<void> {
    console.log('===== 認証が必要です =====');
    console.log('以下のURLにアクセスして認証を完了してください:');
    console.log(authUrl.toString());
    
    // セッション情報としてURL保存（他のサービスが取得できるように）
    await ensureAuthDir();
    await fs.writeFile(path.join(AUTH_DIR, 'auth_url.txt'), authUrl.toString());
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

// 認証プロバイダーのインスタンス
const authProvider = new BotAuthProvider();

// 認証情報取得エンドポイント
app.get('/auth-info', async (req, res) => {
  try {
    const tokens = await authProvider.tokens();
    const clientInfo = await authProvider.clientInformation();
    
    // 認証URLを取得
    let authUrl: string | undefined;
    try {
      authUrl = await fs.readFile(path.join(AUTH_DIR, 'auth_url.txt'), 'utf-8');
    } catch (err) {
      // ファイルが存在しない場合はOK
    }
    
    res.json({
      tokens,
      clientInfo,
      authUrl,
      isAuthenticated: !!tokens
    });
  } catch (error) {
    console.error('Error getting auth info:', error);
    res.status(500).json({ error: 'Failed to get auth info' });
  }
});

// 認証開始エンドポイント
app.post('/start-auth', async (req, res) => {
  try {
    const serverUrl = process.env.MCP_SERVER_URL;
    if (!serverUrl) {
      return res.status(400).json({ error: 'MCP_SERVER_URL environment variable is required' });
    }
    
    let result = await auth(authProvider, { serverUrl });
    res.json({ result });
  } catch (error) {
    console.error('Error starting auth:', error);
    res.status(500).json({ error: 'Failed to start auth' });
  }
});

// 認証コールバックエンドポイント
app.get('/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    
    if (!code) {
      return res.status(400).send('Authorization code is required');
    }
    
    const serverUrl = process.env.MCP_SERVER_URL;
    if (!serverUrl) {
      return res.status(400).send('MCP_SERVER_URL environment variable is required');
    }
    
    await auth(authProvider, { serverUrl, authorizationCode: code });
    res.send('認証が完了しました。このページを閉じて、Botを再起動してください。');
  } catch (error) {
    console.error('Error in callback:', error);
    res.status(500).send('認証エラーが発生しました。詳細はログを確認してください。');
  }
});

// 認証コード処理エンドポイント（CLIツール用）
app.post('/process-code', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    const serverUrl = process.env.MCP_SERVER_URL;
    if (!serverUrl) {
      return res.status(400).json({ error: 'MCP_SERVER_URL environment variable is required' });
    }
    
    await auth(authProvider, { serverUrl, authorizationCode: code });
    res.json({ success: true, message: '認証が完了しました' });
  } catch (error) {
    console.error('Error processing code:', error);
    res.status(500).json({ error: 'Failed to process authorization code' });
  }
});

// トークン更新エンドポイント
app.post('/refresh-token', async (req, res) => {
  try {
    const serverUrl = process.env.MCP_SERVER_URL;
    if (!serverUrl) {
      return res.status(400).json({ error: 'MCP_SERVER_URL environment variable is required' });
    }
    
    let result = await auth(authProvider, { serverUrl });
    res.json({ result });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// 初期化時にサービス起動前に認証を試みる
async function initializeAuth() {
  try {
    await ensureAuthDir();
    
    const serverUrl = process.env.MCP_SERVER_URL;
    if (!serverUrl) {
      console.error('MCP_SERVER_URL environment variable is required');
      return;
    }
    
    // トークンがすでに存在するか確認
    const tokens = await authProvider.tokens();
    if (tokens) {
      console.log('Existing tokens found, trying to refresh...');
      try {
        await auth(authProvider, { serverUrl });
        console.log('Token refresh successful!');
      } catch (error) {
        console.error('Token refresh failed:', error);
        console.log('Please authenticate using /callback endpoint');
      }
    } else {
      console.log('No tokens found. Please authenticate using /callback endpoint');
      try {
        const result = await auth(authProvider, { serverUrl });
        if (result === 'REDIRECT') {
          console.log('Authentication required');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      }
    }
  } catch (error) {
    console.error('Auth initialization error:', error);
  }
}

// サーバー起動前に認証初期化
initializeAuth();

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// サーバー起動
const PORT = process.env.AUTH_PORT || 3004;
app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
