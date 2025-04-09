# Discord MCP Client ドキュメント

このディレクトリには、Discord MCP Clientの設計、実装、使用方法に関するドキュメントが含まれています。

## 目次

- [アーキテクチャ概要](#アーキテクチャ概要)
- [コンポーネント図](#コンポーネント図)
- [シーケンス図](#シーケンス図)
- [データフロー](#データフロー)
- [認証フロー](#認証フロー)
- [ファイル構造](#ファイル構造)
- [コマンドシステム](#コマンドシステム)
- [ツール統合](#ツール統合)
- [設定オプション](#設定オプション)

## アーキテクチャ概要

Discord MCP Clientは、Discord BotとAIモデルを接続するためのブリッジとして機能します。Model Context Protocol (MCP)を活用して、異なるAIモデルプロバイダと標準化されたインターフェースで通信します。

```mermaid
graph LR
    User[ユーザー] --> Discord
    Discord --> Bot[Discord Bot]
    Bot --> MCP[MCP Client]
    MCP --> AIModel[AIモデル]
```

## コンポーネント図

以下は、システムの主要コンポーネントとその関係を示します。

```mermaid
graph TD
    Discord[Discord API] <--> Bot[Discord Bot Client]
    Bot --> CommandHandler[コマンドハンドラ]
    Bot --> MessageHandler[メッセージハンドラ]
    
    CommandHandler --> MCPClient[MCP Client]
    MessageHandler --> MCPClient
    
    MCPClient --> TransportLayer[トランスポートレイヤ]
    TransportLayer --> AuthProvider[認証プロバイダ]
    TransportLayer --> HTTPClient[HTTP/SSE Client]
    
    HTTPClient --> AIModelServer[AIモデルサーバ]
    
    subgraph "ツールシステム"
        MCPClient --> ToolCaller[ツール呼び出し]
        ToolCaller --> WeatherTool[天気ツール]
        ToolCaller --> ImageGenTool[画像生成ツール]
    end
```

## シーケンス図

### 基本的なメッセージフロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Discord as Discord
    participant Bot as Discord Bot
    participant MCP as MCP Client
    participant AI as AIモデル
    
    User->>Discord: メッセージ送信
    Discord->>Bot: イベント通知
    Bot->>Bot: メッセージ解析
    Bot->>MCP: 完了リクエスト
    MCP->>AI: プロンプト送信
    AI->>MCP: 応答生成
    MCP->>Bot: 応答返却
    Bot->>Discord: メッセージ送信
    Discord->>User: 応答表示
```

### コマンド実行フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Discord as Discord
    participant Bot as Discord Bot
    participant CmdHandler as コマンドハンドラ
    participant MCP as MCP Client
    participant Tool as ツール
    
    User->>Discord: コマンド送信（例: !weather Tokyo）
    Discord->>Bot: イベント通知
    Bot->>CmdHandler: コマンド引き渡し
    CmdHandler->>MCP: ツール呼び出し
    MCP->>Tool: リクエスト実行
    Tool->>MCP: 結果返却
    MCP->>CmdHandler: 結果引き渡し
    CmdHandler->>Bot: フォーマットされた応答
    Bot->>Discord: メッセージ送信
    Discord->>User: 結果表示
```

## データフロー

```mermaid
flowchart TD
    Discord[Discord] -->|メッセージ| Parser[メッセージパーサー]
    Parser -->|コマンド| CommandSystem[コマンドシステム]
    Parser -->|通常メッセージ| Prompt[プロンプト処理]
    
    CommandSystem -->|ツール要求| ToolCaller[ツール呼び出し]
    CommandSystem -->|プロンプト要求| PromptHandler[プロンプトハンドラ]
    
    Prompt -->|処理済みプロンプト| MCP[MCP Client]
    PromptHandler -->|プロンプトテンプレート| MCP
    ToolCaller -->|ツールリクエスト| MCP
    
    MCP -->|HTTPリクエスト| AI[AIモデル]
    AI -->|応答| MCP
    
    MCP -->|処理済みレスポンス| Formatter[応答フォーマッタ]
    Formatter -->|Discord形式応答| Discord
```

## 認証フロー

OAuth 2.0認証フローの流れ：

```mermaid
sequenceDiagram
    participant Bot as Discord Bot
    participant Auth as AuthProvider
    participant Admin as 管理者
    participant AIServer as AIモデルサーバ
    
    Bot->>Auth: サーバーに接続
    Auth->>Auth: 既存のトークンを確認
    
    alt トークンが存在し有効
        Auth->>AIServer: アクセストークンで認証
        AIServer->>Auth: 認証成功
        Auth->>Bot: 接続成功
    else トークンが無効または存在しない
        Auth->>AIServer: 認証URLをリクエスト
        AIServer->>Auth: 認証URL返却
        Auth->>Admin: 認証URLを表示
        Admin->>AIServer: ブラウザで認証
        AIServer->>Admin: リダイレクトと認証コード
        Admin->>Bot: auth-cliで認証コード入力
        Bot->>AIServer: コードをトークンと交換
        AIServer->>Bot: アクセストークン返却
        Bot->>Auth: トークンを保存
        Auth->>Bot: 接続成功
    end
```

## ファイル構造

プロジェクトのファイル構造とその関係：

```mermaid
graph TD
    index.ts --> commands.ts
    index.ts --> mcp-client.ts
    commands.ts --> tools.ts
    mcp-client.ts --> auth-provider.ts
    auth-cli.ts --> mcp-client.ts
```

## コマンドシステム

実装されているコマンドの階層と関係：

```mermaid
graph TD
    Commands[コマンドハンドラ] --> Help[!help]
    Commands --> Tools[!tools]
    Commands --> Prompt[!prompt]
    Commands --> Weather[!weather]
    Commands --> Image[!image]
    
    Weather --> getWeather[getWeather関数]
    Image --> generateImage[generateImage関数]
    
    getWeather --> callTool[MCPClient.callTool]
    generateImage --> callTool
```

## ツール統合

AIモデルを通して呼び出すことのできるツール：

```mermaid
graph LR
    MCP[MCP Client] --> ToolSystem[ツールシステム]
    
    ToolSystem --> Weather[天気ツール]
    ToolSystem --> ImageGen[画像生成]
    
    Weather --> API1[天気API]
    ImageGen --> API2[画像生成API]
```

## 設定オプション

環境変数の設定関係：

```mermaid
graph TD
    ENV[.env] --> DiscordToken[DISCORD_TOKEN]
    ENV --> MCPServer[MCP_SERVER_URL]
    ENV --> RedirectURL[OAUTH_REDIRECT_URL]
    
    DiscordToken --> DiscordBot[Discord Botの初期化]
    MCPServer --> MCPClient[MCP Clientの初期化]
    RedirectURL --> AuthProvider[認証プロバイダの設定]
```
