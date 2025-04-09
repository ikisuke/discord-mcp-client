import express from 'express';
import axios from 'axios';
import { config } from 'dotenv';

// 環境変数の読み込み
config();

// サービス設定
const MCP_CLIENT_SERVICE_URL = process.env.MCP_CLIENT_SERVICE_URL || 'http://localhost:3002';

// サーバー初期化
const app = express();
app.use(express.json());

// 天気情報取得エンドポイント
app.post('/weather', async (req, res) => {
  try {
    const { location } = req.body;
    
    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }
    
    // MCP クライアントサービスを通じてツールを呼び出す
    const response = await axios.post(`${MCP_CLIENT_SERVICE_URL}/tools/call`, {
      name: 'weather',
      args: { location }
    });
    
    // ツール呼び出し結果を処理
    if (response.data.success) {
      const weatherData = response.data.result;
      
      // Discord向けの応答フォーマット
      return res.json({
        reply: '',
        embeds: [{
          title: `${location}の天気情報`,
          color: 0x3498db,
          fields: [
            { name: '気温', value: `${weatherData.temperature}°C`, inline: true },
            { name: '状態', value: weatherData.condition, inline: true },
            { name: '湿度', value: `${weatherData.humidity}%`, inline: true },
            { name: '風速', value: `${weatherData.wind_speed || 'N/A'} m/s`, inline: true }
          ],
          timestamp: new Date().toISOString()
        }]
      });
    } else {
      return res.json({
        reply: `天気情報を取得できませんでした: ${response.data.error || '不明なエラー'}`
      });
    }
  } catch (error) {
    console.error('Error calling weather tool:', error);
    res.status(500).json({ error: 'Failed to get weather information' });
  }
});

// 画像生成エンドポイント
app.post('/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // 処理メッセージ
    const processingReply = {
      reply: '画像を生成中です...'
    };
    
    // 実際のAPIを呼び出し
    try {
      // MCP クライアントサービスを通じてツールを呼び出す
      const response = await axios.post(`${MCP_CLIENT_SERVICE_URL}/tools/call`, {
        name: 'image-generator',
        args: { prompt }
      });
      
      // ツール呼び出し結果を処理
      if (response.data.success) {
        const imageUrl = response.data.result.url;
        
        return res.json({
          reply: '',
          embeds: [{
            title: '生成された画像',
            description: `プロンプト: ${prompt}`,
            color: 0xe74c3c,
            image: { url: imageUrl },
            timestamp: new Date().toISOString()
          }]
        });
      } else {
        return res.json({
          reply: `画像生成に失敗しました: ${response.data.error || '不明なエラー'}`
        });
      }
    } catch (error) {
      console.error('Error generating image:', error);
      return res.json({
        reply: '画像生成中にエラーが発生しました。'
      });
    }
  } catch (error) {
    console.error('Error in generate-image endpoint:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// カスタムツール：翻訳
app.post('/translate', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    
    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'Text and target language are required' });
    }
    
    // MCP クライアントサービスを通じてツールを呼び出す
    const response = await axios.post(`${MCP_CLIENT_SERVICE_URL}/tools/call`, {
      name: 'translator',
      args: { text, target_language: targetLanguage }
    });
    
    // ツール呼び出し結果を処理
    if (response.data.success) {
      const translationData = response.data.result;
      
      return res.json({
        reply: '',
        embeds: [{
          title: '翻訳結果',
          color: 0x9b59b6,
          fields: [
            { name: '元のテキスト', value: text },
            { name: `${targetLanguage}に翻訳`, value: translationData.translated_text }
          ]
        }]
      });
    } else {
      return res.json({
        reply: `翻訳に失敗しました: ${response.data.error || '不明なエラー'}`
      });
    }
  } catch (error) {
    console.error('Error calling translation tool:', error);
    res.status(500).json({ error: 'Failed to translate text' });
  }
});

// カスタムツール：要約
app.post('/summarize', async (req, res) => {
  try {
    const { text, maxLength } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // MCP クライアントサービスを通じてツールを呼び出す
    const response = await axios.post(`${MCP_CLIENT_SERVICE_URL}/tools/call`, {
      name: 'summarizer',
      args: { text, max_length: maxLength || 200 }
    });
    
    // ツール呼び出し結果を処理
    if (response.data.success) {
      const summaryData = response.data.result;
      
      return res.json({
        reply: '',
        embeds: [{
          title: 'テキスト要約',
          color: 0x2ecc71,
          description: summaryData.summary
        }]
      });
    } else {
      return res.json({
        reply: `要約に失敗しました: ${response.data.error || '不明なエラー'}`
      });
    }
  } catch (error) {
    console.error('Error calling summarization tool:', error);
    res.status(500).json({ error: 'Failed to summarize text' });
  }
});

// プロキシエンドポイント - 任意のツールを呼び出す
app.post('/call', async (req, res) => {
  try {
    const { name, args, responseFormat } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Tool name is required' });
    }
    
    // MCP クライアントサービスを通じてツールを呼び出す
    const response = await axios.post(`${MCP_CLIENT_SERVICE_URL}/tools/call`, {
      name,
      args: args || {}
    });
    
    // レスポンスフォーマットが指定されていない場合はそのまま返す
    if (!responseFormat) {
      return res.json(response.data);
    }
    
    // カスタムレスポンスフォーマット
    if (response.data.success) {
      // Discord向けのEmbed応答をフォーマット
      return res.json({
        reply: responseFormat.text || '',
        embeds: [{
          title: responseFormat.title || `ツール実行結果: ${name}`,
          color: responseFormat.color || 0x3498db,
          description: responseFormat.description || JSON.stringify(response.data.result, null, 2)
        }]
      });
    } else {
      return res.json({
        reply: `ツール実行に失敗しました: ${response.data.error || '不明なエラー'}`
      });
    }
  } catch (error) {
    console.error(`Error calling tool:`, error);
    res.status(500).json({ error: 'Failed to call tool' });
  }
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// サーバー起動
const PORT = process.env.TOOLS_PORT || 3003;
app.listen(PORT, () => {
  console.log(`Tools Service running on port ${PORT}`);
});

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});
