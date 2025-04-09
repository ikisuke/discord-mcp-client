# ツール統合ガイド

このドキュメントでは、Discord MCP Clientのツール統合システムについて詳しく説明します。Model Context Protocol (MCP)を使用してDiscord Bot経由でAIモデルのツール呼び出し機能を活用する方法を紹介します。

## ツールシステム概要

MCPのツール呼び出しシステムにより、AIモデルは外部機能（天気情報の取得、画像生成など）にアクセスできます。

```mermaid
graph LR
    Discord[Discord] --> Bot[Discord Bot]
    Bot --> CommandHandler[コマンドハンドラ]
    CommandHandler --> ToolInterface[ツールインターフェース]
    ToolInterface --> MCPClient[MCP Client]
    MCPClient --> AIModel[AIモデル]
    AIModel --> ToolExecution[ツール実行]
    ToolExecution --> ExternalAPI[外部API]
    ExternalAPI --> ToolExecution
    ToolExecution --> AIModel
    AIModel --> MCPClient
    MCPClient --> ToolInterface
    ToolInterface --> CommandHandler
    CommandHandler --> Bot
    Bot --> Discord
```

## ツール呼び出しフロー

```mermaid
sequenceDiagram
    participant User as Discord User
    participant Bot as Discord Bot
    participant MCP as MCP Client
    participant AI as AIモデル
    participant Tool as 外部ツール
    
    User->>Bot: !weather Tokyo
    Bot->>MCP: callTool("weather", {location: "Tokyo"})
    MCP->>AI: ツール呼び出しリクエスト
    AI->>Tool: APIリクエスト
    Tool->>AI: データ返却
    AI->>MCP: 結果整形
    MCP->>Bot: 結果返却
    Bot->>User: フォーマットされた天気情報
```

## ツール実装方法

Discord MCP Clientに新しいツールを追加するプロセス：

```mermaid
flowchart TD
    Start[開始] --> Define[ツール関数の定義]
    Define --> Interface[インターフェースの実装]
    Interface --> Command[コマンドハンドラに登録]
    Command --> Test[ツールのテスト]
    Test --> Document[ドキュメント作成]
    Document --> End[完了]
```

### ステップ1: ツール関数の作成

`tools.ts`に新しいツール関数を追加：

```typescript
/**
 * 新しいツール関数のテンプレート
 */
export async function newTool(message: Message, mcpClient: MCPClient, ...args: any[]) {
  try {
    // ユーザーに処理中を伝える
    await message.channel.sendTyping();
    
    // ツール呼び出し
    const result = await mcpClient.callTool({
      name: 'tool-name',
      args: { /* ツールに必要な引数 */ }
    });
    
    // 結果処理
    if (result.success) {
      // 成功時の処理
      await message.reply("処理結果: " + JSON.stringify(result.result));
    } else {
      // エラー時の処理
      await message.reply(`エラーが発生しました: ${result.error || '不明なエラー'}`);
    }
  } catch (error) {
    // 例外処理
    console.error('Error calling tool:', error);
    await message.reply('ツール実行中にエラーが発生しました。');
  }
}
```

### ステップ2: コマンドハンドラに登録

`commands.ts`のコマンドマップに追加：

```typescript
const commands: Record<string, CommandHandler> = {
  // 既存のコマンド
  
  // 新しいコマンド
  async newtool(message, args, mcpClient) {
    if (args.length === 0) {
      await message.reply('使用法: !newtool <引数>');
      return;
    }
    
    const toolArg = args.join(' ');
    await newTool(message, mcpClient, toolArg);
  }
};
```

## 事前定義されたツール

### 1. 天気情報ツール

```mermaid
graph TD
    Command[!weather コマンド] --> Handler[天気ハンドラ]
    Handler --> MCPCall[MCP callTool]
    MCPCall -->|weather| AIModel[AIモデル]
    AIModel --> WeatherAPI[Weather API]
    WeatherAPI --> Response[レスポンス]
    Response --> Formatting[Discord表示用フォーマット]
    Formatting --> Embed[Embed表示]
```

**実装**: `getWeather`関数はMCPの`callTool`メソッドを使って`weather`ツールを呼び出し、場所に基づいた天気情報を取得します。

**応答フォーマット**:
```typescript
interface WeatherResponse {
  temperature: number;  // 摂氏温度
  condition: string;    // 天気状態（晴れ、雨など）
  humidity: number;     // 湿度（%）
  wind_speed?: number;  // 風速（m/s）
}
```

### 2. 画像生成ツール

```mermaid
graph TD
    Command[!image コマンド] --> Handler[画像ハンドラ]
    Handler --> MCPCall[MCP callTool]
    MCPCall -->|image-generator| AIModel[AIモデル]
    AIModel --> ImageAPI[画像生成API]
    ImageAPI --> Generation[画像生成]
    Generation --> Response[URL返却]
    Response --> Formatting[Discord表示用フォーマット]
    Formatting --> Embed[Embed表示]
```

**実装**: `generateImage`関数はMCPの`callTool`メソッドを使って`image-generator`ツールを呼び出し、指定された説明に基づいて画像を生成します。

**応答フォーマット**:
```typescript
interface ImageResponse {
  url: string;          // 生成された画像のURL
  width?: number;       // 画像の幅
  height?: number;      // 画像の高さ
  prompt?: string;      // 使用されたプロンプト
}
```

## 独自ツールの実装例

### カレンダーツール

以下は、カレンダー操作のためのツール実装例です：

```mermaid
graph TD
    CalendarCommand[!calendar コマンド] --> Parser[引数パーサー]
    Parser --> Action[アクション選択]
    
    Action -->|add| AddEvent[予定追加]
    Action -->|list| ListEvents[予定一覧]
    Action -->|delete| DeleteEvent[予定削除]
    
    AddEvent --> FormatRequest[リクエスト整形]
    ListEvents --> FormatRequest
    DeleteEvent --> FormatRequest
    
    FormatRequest --> MCPCall[MCP callTool]
    MCPCall --> AIProcess[AI処理]
    AIProcess --> CalendarAPI[カレンダーAPI]
    CalendarAPI --> Response[レスポンス]
    Response --> Format[結果整形]
    Format --> DiscordMessage[Discord応答]
```

### ウェブ検索ツール

```mermaid
graph TD
    SearchCommand[!search コマンド] --> Query[検索クエリ抽出]
    Query --> MCPCall[MCP callTool]
    MCPCall --> AIProcess[AI処理]
    AIProcess --> SearchAPI[検索API]
    SearchAPI --> Results[検索結果]
    Results --> Summarize[結果要約]
    Summarize --> Format[結果整形]
    Format --> DiscordMessage[Discord応答]
```

## エラーハンドリング

```mermaid
flowchart TD
    Start[ツール呼び出し] --> Try{try}
    Try -->|Success| Process[結果処理]
    Try -->|Error| Catch[Catchブロック]
    
    Process --> CheckSuccess{成功?}
    CheckSuccess -->|Yes| FormatSuccess[成功レスポンス整形]
    CheckSuccess -->|No| FormatError[エラーレスポンス整形]
    
    Catch --> LogError[エラーログ記録]
    LogError --> GenericError[一般エラーメッセージ]
    
    FormatSuccess --> SendToDiscord[Discord応答送信]
    FormatError --> SendToDiscord
    GenericError --> SendToDiscord
```

## パフォーマンス考慮事項

1. **タイムアウト処理**: 長時間実行ツールの場合は適切なタイムアウト処理を実装
2. **並列実行**: 複数ツールの並列実行による効率化
3. **キャッシュ**: 頻繁に使用される結果のキャッシュ

```mermaid
graph LR
    Request[リクエスト] --> Cache{キャッシュ確認}
    Cache -->|Hit| CachedResponse[キャッシュ応答]
    Cache -->|Miss| ToolCall[ツール呼び出し]
    ToolCall --> StoreCache[キャッシュ保存]
    StoreCache --> Response[応答]
    CachedResponse --> Response
```

## ツール管理と監視

```mermaid
graph TD
    Metrics[メトリクス収集] --> Usage[使用状況]
    Metrics --> ErrorRates[エラー率]
    Metrics --> Latency[応答時間]
    
    Usage --> Dashboard[管理ダッシュボード]
    ErrorRates --> Dashboard
    Latency --> Dashboard
    
    Dashboard --> Alerts[アラート]
    Dashboard --> Reports[レポート]
```

## セキュリティ考慮事項

1. **入力検証**: ユーザー入力の厳格な検証
2. **アクセス制限**: ロールベースのツールアクセス制御
3. **レート制限**: 過剰な使用の防止
4. **監査ログ**: ツール呼び出しの詳細ログ記録

```mermaid
flowchart TD
    Input[ユーザー入力] --> Validation[入力検証]
    Validation --> RoleCheck[ロール確認]
    RoleCheck --> RateLimit[レート制限]
    RateLimit --> LogAccess[アクセスログ記録]
    LogAccess --> Execute[ツール実行]
```
