# 認証システムガイド

このドキュメントでは、Discord MCP Clientで実装されている認証システムについて詳しく説明します。MCPサーバーとの安全な通信を確立するためのOAuth 2.0認証フローの仕組みと実装方法を紹介します。

## 認証システム概要

Discord MCP Clientは、OAuth 2.0認証コードフローを使用してAIモデルサーバーと通信します。

```mermaid
graph TB
    subgraph "認証コンポーネント"
        AuthProvider[認証プロバイダー]
        TokenStorage[トークンストレージ]
        AuthCLI[認証CLI]
    end
    
    subgraph "MCP通信コンポーネント"
        MCPClient[MCPクライアント]
        Transport[トランスポートレイヤー]
    end
    
    AuthProvider --> TokenStorage
    AuthCLI --> AuthProvider
    MCPClient --> Transport
    Transport --> AuthProvider
    
    subgraph "外部システム"
        AIServer[AIモデルサーバー]
        Browser[ブラウザ]
    end
    
    AuthProvider <--> AIServer
    AuthProvider --> Browser
    Browser --> AuthCLI
```

## 認証フロー詳細

OAuth 2.0認証コードフローの詳細なステップ：

```mermaid
sequenceDiagram
    participant Bot as Discord Bot
    participant AuthProv as 認証プロバイダー
    participant Store as トークンストレージ
    participant Server as AIモデルサーバー
    participant Admin as 管理者
    participant Browser as ブラウザ
    
    Bot->>AuthProv: 認証開始
    AuthProv->>Store: 既存のトークンを確認
    
    alt トークンが存在する場合
        Store->>AuthProv: トークン返却
        AuthProv->>Server: トークン検証
        
        alt トークンが有効
            Server->>AuthProv: 検証成功
            AuthProv->>Bot: 認証済み
        else トークンが無効
            Server->>AuthProv: 検証失敗
            AuthProv->>AuthProv: リフレッシュトークンで更新試行
            
            alt リフレッシュ成功
                AuthProv->>Server: リフレッシュトークン送信
                Server->>AuthProv: 新トークン発行
                AuthProv->>Store: 新トークン保存
                AuthProv->>Bot: 認証済み
            else リフレッシュ失敗
                AuthProv->>Bot: 新規認証必要
            end
        end
    else トークンが存在しない場合
        Store->>AuthProv: トークンなし
        AuthProv->>Server: 認証URL要求
        Server->>AuthProv: 認証URL返却
        AuthProv->>AuthProv: PKCE code_verifier生成
        AuthProv->>Store: code_verifier保存
        AuthProv->>Admin: 認証URL表示
        Admin->>Browser: URLにアクセス
        Browser->>Server: 認証リクエスト
        Server->>Admin: 認証画面表示
        Admin->>Server: 認証承認
        Server->>Browser: リダイレクトと認証コード
        Admin->>Bot: auth-cliツールで認証コード入力
        Bot->>AuthProv: 認証コード処理
        AuthProv->>Store: code_verifier取得
        AuthProv->>Server: コードとcode_verifier送信
        Server->>AuthProv: アクセストークン発行
        AuthProv->>Store: トークン保存
        AuthProv->>Bot: 認証完了
    end
```

## 認証プロバイダーの実装

`auth-provider.ts`ファイルで実装されているOAuthClientProviderインターフェース：

```mermaid
classDiagram
    class OAuthClientProvider {
        +get redirectUrl() URL
        +get clientMetadata() OAuthClientMetadata
        +clientInformation() OAuthClientInformation
        +saveClientInformation(info) void
        +tokens() OAuthTokens
        +saveTokens(tokens) void
        +redirectToAuthorization(url) void
        +saveCodeVerifier(verifier) void
        +codeVerifier() string
    }
    
    class BotAuthProvider {
        -AUTH_DIR: string
        -TOKENS_FILE: string
        -CLIENT_FILE: string
        -CODE_VERIFIER_FILE: string
        +get redirectUrl() URL
        +get clientMetadata() OAuthClientMetadata
        +clientInformation() OAuthClientInformation
        +saveClientInformation(info) void
        +tokens() OAuthTokens
        +saveTokens(tokens) void
        +redirectToAuthorization(url) void
        +saveCodeVerifier(verifier) void
        +codeVerifier() string
    }
    
    OAuthClientProvider <|-- BotAuthProvider
```

## データ構造

認証システムで使用される主要なデータ構造：

```mermaid
classDiagram
    class OAuthClientMetadata {
        +client_name: string
        +redirect_uris: string[]
    }
    
    class OAuthClientInformation {
        +client_id: string
        +client_secret?: string
    }
    
    class OAuthTokens {
        +access_token: string
        +token_type: string
        +expires_in?: number
        +refresh_token?: string
        +scope?: string
    }
    
    class OAuthMetadata {
        +issuer: string
        +authorization_endpoint: string
        +token_endpoint: string
        +jwks_uri: string
        +registration_endpoint?: string
        +response_types_supported: string[]
        +grant_types_supported?: string[]
        +code_challenge_methods_supported?: string[]
    }
```

## 認証フローの状態遷移

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    
    Unauthenticated --> TokenCheck: 起動時
    TokenCheck --> Authenticated: 有効なトークンあり
    TokenCheck --> RefreshingToken: トークン期限切れ
    TokenCheck --> AuthorizationNeeded: トークンなし
    
    RefreshingToken --> Authenticated: リフレッシュ成功
    RefreshingToken --> AuthorizationNeeded: リフレッシュ失敗
    
    AuthorizationNeeded --> WaitingForCode: 認証URL表示
    WaitingForCode --> CodeExchange: 認証コード受信
    CodeExchange --> Authenticated: コード交換成功
    CodeExchange --> AuthorizationNeeded: コード交換失敗
    
    Authenticated --> RefreshingToken: トークン期限切れ検出
    Authenticated --> [*]: 終了
```

## ファイルストレージシステム

認証情報の永続化方法：

```mermaid
graph TD
    AuthDir[.auth/] --> TokensFile[tokens.json]
    AuthDir --> ClientFile[client.json]
    AuthDir --> VerifierFile[code_verifier.txt]
    
    TokensFile --> AccessToken[access_token]
    TokensFile --> RefreshToken[refresh_token]
    TokensFile --> Expiry[expires_in]
    
    ClientFile --> ClientID[client_id]
    ClientFile --> ClientSecret[client_secret]
    
    VerifierFile --> CodeVerifier[PKCE code_verifier]
```

## 認証CLI

認証コードを処理するためのコマンドラインインターフェース：

```mermaid
graph LR
    Start[開始] --> ReadArgs[引数読み取り]
    ReadArgs --> CheckCode{コードあり?}
    CheckCode -->|Yes| ProcessCode[コード処理]
    CheckCode -->|No| ShowHelp[ヘルプ表示]
    
    ProcessCode --> CallMCP[MCPクライアント呼び出し]
    CallMCP --> FinishAuth[finishAuth実行]
    FinishAuth --> SaveTokens[トークン保存]
    SaveTokens --> Success[成功メッセージ]
    
    ShowHelp --> Exit[終了]
    Success --> Exit
```

## トークン管理

```mermaid
graph TD
    GetTokens[tokens取得] --> Check{存在する?}
    Check -->|Yes| Validate{有効期限?}
    Check -->|No| Null[空を返す]
    
    Validate -->|有効| Return[トークン返却]
    Validate -->|期限切れ| RefreshToken[トークン更新]
    
    RefreshToken --> RefreshSuccess{成功?}
    RefreshSuccess -->|Yes| Save[新トークン保存]
    RefreshSuccess -->|No| ClearTokens[トークン削除]
    
    Save --> ReturnNew[新トークン返却]
    ClearTokens --> Null
```

## セキュリティ考慮事項

```mermaid
graph TD
    Security[セキュリティ対策] --> PKCE[PKCE実装]
    Security --> SecureStorage[安全なトークン保存]
    Security --> HTTPSOnly[HTTPS通信のみ]
    Security --> TokenValidation[トークン検証]
    
    PKCE --> CodeVerifier[ランダムverifier生成]
    PKCE --> CodeChallenge[SHA-256ハッシュ化]
    
    SecureStorage --> LocalFiles[ファイル保存]
    SecureStorage --> Permissions[適切なパーミッション]
    
    TokenValidation --> ExpCheck[有効期限確認]
    TokenValidation --> ScopeCheck[スコープ確認]
```

## 実装ガイド

### 1. 環境変数の設定

`.env`ファイルに必要な変数を設定します：

```bash
# MCP認証設定
MCP_SERVER_URL=https://your-mcp-server.example.com
OAUTH_REDIRECT_URL=http://localhost:3000/callback
```

### 2. 認証コードの取得とトークン交換

以下のステップで認証コードを取得し、アクセストークンと交換します：

```mermaid
sequenceDiagram
    participant User as 管理者
    participant CLI as Auth CLI
    participant Auth as 認証プロバイダー
    participant Server as AIサーバー
    
    User->>CLI: node dist/auth-cli.js
    CLI->>Auth: 認証状態確認
    Auth->>CLI: 認証必要
    CLI->>User: 認証URLを表示
    User->>Server: ブラウザで認証URL開く
    Server->>User: 認証画面表示
    User->>Server: 認証承認
    Server->>User: コード付きリダイレクト
    User->>CLI: node dist/auth-cli.js --code=xxx
    CLI->>Auth: 認証コード処理
    Auth->>Server: コード交換
    Server->>Auth: トークン返却
    Auth->>CLI: 認証成功
    CLI->>User: 「認証が完了しました」表示
```

### 3. 動的クライアント登録

サーバーが動的クライアント登録をサポートしている場合の処理：

```mermaid
graph TD
    Start[開始] --> CheckClient{クライアント情報あり?}
    CheckClient -->|Yes| UseExisting[既存のクライアント情報使用]
    CheckClient -->|No| CheckSupport{動的登録サポート?}
    
    CheckSupport -->|Yes| Register[クライアント登録]
    CheckSupport -->|No| Error[エラー: 登録不可]
    
    Register --> SaveClient[クライアント情報保存]
    SaveClient --> UseExisting
    
    UseExisting --> Continue[認証フロー続行]
```

### 4. トランスポート層との統合

認証プロバイダーをトランスポートレイヤーと統合：

```mermaid
graph LR
    Transport[トランスポート] --> AuthCheck{認証必要?}
    AuthCheck -->|Yes| Provider[認証プロバイダー]
    AuthCheck -->|No| Connection[通常接続]
    
    Provider --> TokenCheck{トークンあり?}
    TokenCheck -->|Yes| UseToken[トークン使用]
    TokenCheck -->|No| Auth[認証フロー開始]
    
    UseToken --> Connection
    Auth --> RedirectToAuth[認証リダイレクト]
```

## エラーハンドリング

認証プロセス中の様々なエラー状態の処理：

```mermaid
graph TD
    Error[認証エラー] --> Network[ネットワークエラー]
    Error --> InvalidGrant[無効な認証コード]
    Error --> ExpiredToken[期限切れトークン]
    Error --> InvalidClient[無効なクライアント]
    Error --> ServerError[サーバーエラー]
    
    Network --> Retry[再試行]
    InvalidGrant --> NewAuth[新規認証]
    ExpiredToken --> RefreshOrNew[リフレッシュか新規認証]
    InvalidClient --> RegisterAgain[再登録]
    ServerError --> WaitAndRetry[待機して再試行]
```

## ベストプラクティス

1. **トークンの安全な保存**: ファイルシステムのパーミッションを適切に設定
2. **定期的なリフレッシュ**: トークンの有効期限前に自動リフレッシュ
3. **エラー耐性**: 認証エラーからの自動リカバリー
4. **ログ記録**: 認証プロセスの詳細ログの記録（秘密情報は除く）

```mermaid
graph TD
    BestPractices[ベストプラクティス] --> SecureStorage[安全なストレージ]
    BestPractices --> AutoRefresh[自動リフレッシュ]
    BestPractices --> ErrorRecovery[エラー耐性]
    BestPractices --> Logging[適切なログ記録]
    BestPractices --> HTTPS[HTTPS通信のみ]
    
    SecureStorage --> Permissions[適切なパーミッション]
    SecureStorage --> NoHardcoding[ハードコーディング禁止]
    
    AutoRefresh --> BackgroundTask[バックグラウンド更新]
    AutoRefresh --> ExpiryCheck[有効期限監視]
    
    ErrorRecovery --> Retry[再試行ロジック]
    ErrorRecovery --> FallbackAuth[フォールバック認証]
    
    Logging --> NonSensitive[機密情報除外]
    Logging --> Rotation[ログローテーション]
```

## カスタム認証プロバイダーの作成

独自の認証プロバイダーを実装するためのガイドライン：

1. `OAuthClientProvider`インターフェースを実装
2. 独自のストレージメカニズムを提供
3. UIへの通知方法をカスタマイズ

```typescript
// カスタム認証プロバイダーの例
class CustomAuthProvider implements OAuthClientProvider {
  // OAuthClientProviderインターフェースのメソッドを実装
  get redirectUrl(): string { /* ... */ }
  get clientMetadata() { /* ... */ }
  async clientInformation() { /* ... */ }
  async saveClientInformation(clientInfo) { /* ... */ }
  async tokens() { /* ... */ }
  async saveTokens(tokens) { /* ... */ }
  async redirectToAuthorization(authUrl) { /* ... */ }
  async saveCodeVerifier(codeVerifier) { /* ... */ }
  async codeVerifier() { /* ... */ }
}
```
