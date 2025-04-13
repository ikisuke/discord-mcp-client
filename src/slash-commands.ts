import { 
  CommandInteraction, 
  SlashCommandBuilder, 
  Client, 
  REST,
  Routes,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  ThreadChannel
} from 'discord.js';
import { registerChannel, isChannelRegistered } from './channel-manager.js';
import { execSync } from 'child_process';

// コマンド定義
export const commands = [
  // setupコマンドの定義
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('現在のチャンネルをタスク管理用に登録します')
    .toJSON(),
  
  // taskコマンドの定義
  new SlashCommandBuilder()
    .setName('task')
    .setDescription('タスクのためのスレッドを作成します')
    .addStringOption(option => 
      option.setName('タイトル')
        .setDescription('タスクのタイトル')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('説明')
        .setDescription('タスクの説明')
        .setRequired(false))
    .toJSON(),
    
  // testコマンドの定義
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('テスト用コマンド（lsを実行）')
    .toJSON()
];

// コマンドを登録する関数
export async function registerCommands(client: Client) {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    
    console.log('スラッシュコマンドを登録中...');
    console.log(commands);
    
    await rest.put(
      Routes.applicationCommands(client.user!.id),
      { body: commands }
    );
    
    console.log('スラッシュコマンドの登録が完了しました');
  } catch (error) {
    console.error('スラッシュコマンドの登録に失敗:', error);
  }
}

// コマンドインタラクションを処理する関数
export async function handleCommandInteraction(interaction: CommandInteraction) {
  if (!interaction.isCommand()) return;
  
  // コマンド名に基づいて処理を分岐
  switch (interaction.commandName) {
    case 'setup':
      await handleSetupCommand(interaction);
      break;
    
    case 'task':
      await handleTaskCommand(interaction);
      break;
      
    case 'test':
      await handleTestCommand(interaction);
      break;
  }
}

// setupコマンドを処理する関数
async function handleSetupCommand(interaction: CommandInteraction) {
  // チャンネルの種類をチェック
  if (interaction.channel?.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: 'このコマンドはテキストチャンネルでのみ使用できます。',
      ephemeral: true
    });
    return;
  }
  
  // セレクトメニューの作成
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('setup_select')
        .setPlaceholder('統合するサービスを選択')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('GitHub')
            .setDescription('GitHubと連携してタスクを管理')
            .setValue('github'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Notion')
            .setDescription('Notionと連携してタスクを管理')
            .setValue('notion')
        )
    );
  
  // インタラクションに応答
  await interaction.reply({
    content: 'このチャンネルで使用するサービスを選択してください:',
    components: [row],
    ephemeral: true
  });
}

// サービス選択のインタラクションを処理する関数
export async function handleServiceSelection(interaction: StringSelectMenuInteraction) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== 'setup_select') return;
  
  const selected = interaction.values[0] as 'github' | 'notion';
  
  // チャンネルを登録
  if (interaction.channel && registerChannel(interaction.channel, selected)) {
    await interaction.update({
      content: `チャンネルを ${selected} と連携するように設定しました！\n/task コマンドでタスクスレッドを作成できます。`,
      components: []
    });
  } else {
    await interaction.update({
      content: 'チャンネルの設定に失敗しました。',
      components: []
    });
  }
}

// taskコマンドを処理する関数
async function handleTaskCommand(interaction: CommandInteraction) {
  // チャンネルの登録を確認
  if (!interaction.channelId || !isChannelRegistered(interaction.channelId)) {
    await interaction.reply({
      content: 'このチャンネルはタスク管理用に設定されていません。先に `/setup` コマンドを実行してください。',
      ephemeral: true
    });
    return;
  }
  
  // チャンネルタイプを確認
  if (interaction.channel?.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: 'このコマンドはテキストチャンネルでのみ使用できます。',
      ephemeral: true
    });
    return;
  }
  
  // コマンドのオプションを取得
  const title = interaction.options.get('タイトル')?.value as string;
  const description = interaction.options.get('説明')?.value as string || '';
  
  try {
    // スレッドを作成
    const thread = await (interaction.channel).threads.create({
      name: title,
      autoArchiveDuration: 10080, // 1週間
      reason: 'タスク管理用スレッド'
    });
    
    // 初期メッセージを投稿
    await thread.send({
      content: `**${title}**\n${description ? `\n${description}` : ''}\n\n---\nこのスレッドでタスクの進捗を管理してください。`
    });
    
    // インタラクションに応答
    await interaction.reply({
      content: `タスク「${title}」のスレッドを作成しました。`,
      ephemeral: true
    });
  } catch (error) {
    console.error('スレッド作成エラー:', error);
    await interaction.reply({
      content: 'スレッドの作成に失敗しました。',
      ephemeral: true
    });
  }
}

// testコマンドを処理する関数
async function handleTestCommand(interaction: CommandInteraction) {
  try {
    // lsコマンドを実行
    const result = execSync('node -v').toString();
    
    // 長すぎる場合は切り詰める
    const truncatedResult = result.length > 1900 
      ? result.substring(0, 1900) + '...(省略)'
      : result;
    
    // インタラクションに応答
    await interaction.reply({
      content: `\`\`\`\n${truncatedResult}\n\`\`\``,
      ephemeral: true
    });
  } catch (error) {
    console.error('コマンド実行エラー:', error);
    await interaction.reply({
      content: 'コマンドの実行に失敗しました。',
      ephemeral: true
    });
  }
} 