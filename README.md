# Discord MCP Client (マイクロサービス版)

A Discord Bot client utilizing the Model Context Protocol (MCP) TypeScript SDK for AI-powered interactions, implemented as microservices.

## マイクロサービスアーキテクチャ

このプロジェクトはマイクロサービスアーキテクチャに基づいて設計されており、以下の独立したサービスで構成されています：

1. **Discord Gateway Service** (`services/discord-gateway`)
   - Discord APIとの通信を担当
   - ユーザーからのメッセージを受け取り、コマンドハンドラーに転送
   - 応答をDiscordに返送

2. **Command Handler Service** (`services/command-handler`)
   - コマンド（!help, !weather など）の処理
   - メンションメッセージの処理
   - 他のサービスとの連携

3. **MCP Client Service** (`services/mcp-client`)
   - Model Context Protocol SDKを使用してAIモデルと通信
   - 補完リクエスト、プロンプト管理、ツール呼び出しの処理

4. **Auth Service** (`services/auth-service`)
   - OAuth 2.0認証フローの処理
   - トークン管理とリフレッシュ
   - 認証情報の安全な保存

5. **Tools Service** (`services/tools-service`)
   - 専門的なツール機能の提供（天気、画像生成など）
   - レスポンスのフォーマット処理

## 特徴

- **疎結合設計**: 各サービスは独立して動作し、明確に定義されたAPIを通じて通信
- **スケーラビリティ**: 各サービスを個別にスケーリング可能
- **耐障害性**: 一部のサービスに障害が発生しても、他のサービスは引き続き動作可能
- **コンテキスト分離**: 各サービスは特定の関心事に焦点を当てるため、コードが整理され保守が容易
- **技術の柔軟性**: 将来的に異なるサービスに異なる技術スタックを導入可能

## 始め方

### 前提条件

- Node.js 18以上
- Docker と Docker Compose (オプション、コンテナ化実行用)
- Discordボットトークン
- MCPサーバーへのアクセス

### 環境設定

1. リポジトリをクローン：
   ```bash
   git clone https://github.com/ikisuke/discord-mcp-client.git
   cd discord-mcp-client
   git checkout microservices
   ```

2. 環境変数を設定：
   ```bash
   cp .env.example .env
   # .envファイルを編集して必要な設定を行ってください
   ```

### 実行方法（Docker使用）

```bash
docker-compose up -d
```

### 実行方法（ローカル開発）

各サービスを個別に実行：

```bash
# 各サービスをビルドして起動（例: Auth Service）
cd services/auth-service
npm install
npm run build
npm start

# 同様に他のサービスも起動
cd ../mcp-client
npm install
npm run build
npm start

# 以下同様に各サービスを起動
```

サービスは以下の順序で起動することをお勧めします：
1. Auth Service
2. MCP Client Service
3. Tools Service
4. Command Handler Service
5. Discord Gateway Service

## サービス間通信

サービスは次のようにHTTP経由で通信します：

```
Discord <-> Discord Gateway <-> Command Handler <-> MCP Client <-> AI Model
                                      |
                                      V
                                Tools Service
                                      |
                                      V
                               MCP Client
```

各サービスは以下のポートで実行されます（デフォルト設定の場合）：
- Discord Gateway Service: 3000
- Command Handler Service: 3001
- MCP Client Service: 3002
- Tools Service: 3003
- Auth Service: 3004

## 認証フロー

1. 初回起動時、Auth ServiceがOAuth認証フローを開始します
2. 認証URLがコンソールに表示されるので、ブラウザでアクセスします
3. 認証完了後、コールバックURLに認証コードが含まれます
4. 認証コードは`http://localhost:3004/callback?code=<認証コード>`の形式で返されます
5. この認証コードは自動的に処理され、トークンが`.auth`ディレクトリに保存されます

## コマンド一覧

Botは以下のコマンドをサポートしています：

- `!help` - ヘルプメッセージを表示
- `!tools` - 利用可能なツールを表示
- `!prompt <名前> [テキスト]` - 保存されたプロンプトを使用
- `!weather <場所>` - 指定した場所の天気情報を取得
- `!image <説明>` - 指定した説明に基づいて画像を生成
- `!translate <テキスト> <言語>` - テキストを指定した言語に翻訳
- `!summarize <テキスト>` - テキストを要約

また、Botにメンションすることで直接会話することもできます。

## サービスの拡張

新しい機能を追加する場合、適切なサービスを拡張するか、新しいサービスを作成できます：

1. 新しいツールを追加する場合：`tools-service`に新しいエンドポイントを追加
2. 新しいコマンドを追加する場合：`command-handler`のコマンドマップに追加
3. 新しいAI機能を追加する場合：`mcp-client`に新しいエンドポイントを追加

## デプロイ

プロダクション環境にデプロイする場合、以下の点を考慮してください：

1. 環境変数を適切に設定（特にサービスURLをプロダクション環境に合わせる）
2. Docker Composeを使用してサービスをコンテナ化
3. トラフィックに応じて各サービスを個別にスケーリング
4. ロードバランサーの導入（大規模デプロイメント向け）
5. 監視とロギングの実装

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。
