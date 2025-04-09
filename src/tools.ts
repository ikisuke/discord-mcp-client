import { Client as MCPClient } from '@modelcontextprotocol/typescript-sdk';
import { Message, EmbedBuilder } from 'discord.js';

/**
 * 天気予報ツールを呼び出す
 * @param message Discordメッセージオブジェクト
 * @param mcpClient MCPクライアント
 * @param location 天気を取得する場所
 */
export async function getWeather(message: Message, mcpClient: MCPClient, location: string) {
  try {
    // ユーザーに処理中を伝える
    await message.channel.sendTyping();
    
    // ツール呼び出し
    const result = await mcpClient.callTool({
      name: 'weather',
      args: { location }
    });
    
    // 結果をフォーマットして返信
    if (result.success) {
      const weatherData = result.result;
      
      const embed = new EmbedBuilder()
        .setTitle(`${location}の天気情報`)
        .setColor(0x3498db)
        .addFields(
          { name: '気温', value: `${weatherData.temperature}°C`, inline: true },
          { name: '状態', value: weatherData.condition, inline: true },
          { name: '湿度', value: `${weatherData.humidity}%`, inline: true },
          { name: '風速', value: `${weatherData.wind_speed || 'N/A'} m/s`, inline: true }
        )
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
    } else {
      await message.reply(`天気情報を取得できませんでした: ${result.error || '不明なエラー'}`);
    }
  } catch (error) {
    console.error('Error calling weather tool:', error);
    await message.reply('天気情報の取得中にエラーが発生しました。');
  }
}

/**
 * 画像生成ツールを呼び出す
 * @param message Discordメッセージオブジェクト
 * @param mcpClient MCPクライアント
 * @param prompt 画像生成のためのプロンプト
 */
export async function generateImage(message: Message, mcpClient: MCPClient, prompt: string) {
  try {
    // ユーザーに処理中を伝える
    const processingMessage = await message.reply('画像を生成中です...');
    
    // ツール呼び出し
    const result = await mcpClient.callTool({
      name: 'image-generator',
      args: { prompt }
    });
    
    // 結果を処理して返信
    if (result.success) {
      const imageUrl = result.result.url;
      
      const embed = new EmbedBuilder()
        .setTitle('生成された画像')
        .setDescription(`プロンプト: ${prompt}`)
        .setColor(0xe74c3c)
        .setImage(imageUrl)
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
      
      // 処理中メッセージを削除
      await processingMessage.delete().catch(() => {});
    } else {
      await processingMessage.edit(`画像生成に失敗しました: ${result.error || '不明なエラー'}`);
    }
  } catch (error) {
    console.error('Error generating image:', error);
    await message.reply('画像生成中にエラーが発生しました。');
  }
}

/**
 * MCPのツール機能が対応しているか確認
 * @param mcpClient MCPクライアント
 */
export async function checkToolsAvailability(mcpClient: MCPClient): Promise<boolean> {
  try {
    const capabilities = mcpClient.getServerCapabilities();
    return !!capabilities?.tools;
  } catch (error) {
    console.error('Error checking tools capability:', error);
    return false;
  }
}
