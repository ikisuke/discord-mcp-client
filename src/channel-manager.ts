import { Channel, ChannelType } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

// 登録チャンネルデータの型
interface RegisteredChannel {
  id: string;
  guildId: string;
  type: 'github' | 'notion';
}

// 登録チャンネルのデータ保存場所
const DATA_FILE = path.join(process.cwd(), 'data', 'channels.json');

// データディレクトリがなければ作成
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// 登録チャンネルを読み込む
export function loadRegisteredChannels(): RegisteredChannel[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('チャンネルデータの読み込みエラー:', error);
    return [];
  }
}

// 登録チャンネルを保存する
export function saveRegisteredChannels(channels: RegisteredChannel[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(channels, null, 2), 'utf8');
  } catch (error) {
    console.error('チャンネルデータの保存エラー:', error);
  }
}

// チャンネルを登録する
export function registerChannel(channel: Channel, type: 'github' | 'notion'): boolean {
  // テキストチャンネルかどうか確認
  if (channel.type !== ChannelType.GuildText) {
    return false;
  }
  
  const channels = loadRegisteredChannels();
  
  // 既に登録されているか確認
  const index = channels.findIndex(c => c.id === channel.id);
  
  if (index !== -1) {
    // 既存の登録を更新
    channels[index].type = type;
  } else {
    // 新規登録
    channels.push({
      id: channel.id,
      guildId: channel.guild.id,
      type
    });
  }
  
  saveRegisteredChannels(channels);
  return true;
}

// チャンネルが登録されているか確認
export function isChannelRegistered(channelId: string): RegisteredChannel | null {
  const channels = loadRegisteredChannels();
  return channels.find(c => c.id === channelId) || null;
}

// 登録チャンネルの種類を取得
export function getChannelType(channelId: string): 'github' | 'notion' | null {
  const channel = isChannelRegistered(channelId);
  return channel ? channel.type : null;
} 