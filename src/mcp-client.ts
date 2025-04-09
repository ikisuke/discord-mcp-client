import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/typescript-sdk';
import { BotAuthProvider } from './auth-provider.js';

/**
 * MCPクライアントをセットアップして返す
 */
export function setupMCPClient() {
  // MCPクライアントの設定
  const client = new Client({
    name: "Discord MCP Bot",
    version: "1.0.0",
    capabilities: {
      // 必要に応じて機能を有効化
      tools: true,
      resources: { subscribe: true },
      sampling: true,
      prompts: true
    }
  });
  
  // 認証プロバイダーの作成
  const authProvider = new BotAuthProvider();
  
  // サーバーURLの取得
  const serverUrl = process.env.MCP_SERVER_URL;
  if (!serverUrl) {
    throw new Error('MCP_SERVER_URL environment variable is required');
  }
  
  // Streamable HTTPトランスポートの設定（他のトランスポートも選択可能）
  const transport = new StreamableHTTPClientTransport(
    new URL(serverUrl),
    { authProvider }
  );
  
  // クライアントをトランスポートに接続
  client.connect(transport).catch(err => {
    console.error('Failed to connect to MCP server:', err);
    
    // 認証エラーの場合、特別な処理を行う
    if (err.message === 'Unauthorized') {
      console.log('Authorization needed. Please follow the authentication process.');
    } else {
      // 重大なエラーの場合は終了
      process.exit(1);
    }
  });
  
  return client;
}

/**
 * 認証コードを使用して認証プロセスを完了する
 * この関数は、OAuth認証フローのコールバックハンドラーから呼び出される
 */
export async function finishAuthWithCode(authCode: string) {
  const serverUrl = process.env.MCP_SERVER_URL;
  if (!serverUrl) {
    throw new Error('MCP_SERVER_URL environment variable is required');
  }
  
  const authProvider = new BotAuthProvider();
  const transport = new StreamableHTTPClientTransport(
    new URL(serverUrl),
    { authProvider }
  );
  
  await transport.finishAuth(authCode);
  console.log('Authentication completed successfully');
}
