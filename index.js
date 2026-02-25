const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const GUILD_ID = "1446960659072946218";

// ================= WARN STORAGE =================
const WARN_FILE = './warns.json';
if (!fs.existsSync(WARN_FILE)) fs.writeFileSync(WARN_FILE, JSON.stringify({}));

function getWarns() { return JSON.parse(fs.readFileSync(WARN_FILE)); }
function saveWarns(data) { fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2)); }

// ================= DURATION PARSER =================
function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

// ================= COMMANDS =================
// Buraya tüm slash komutlar (give-role, mute, ban, addrole vb.) eklenebilir
const commands = [
  new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Create a timed button poll')
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (30s,1m,5m)').setRequired(true))
    .addStringOption(opt => opt.setName('options').setDescription('Separate 2-5 options with |').setRequired(true)),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
  console.log(`Bot ${client.user.tag} ready.`);
});

// ================= ACTIVE POLL =================
let activePoll = null;

// ================= INTERACTIONS =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, guild, channel } = interaction;

  try {
    if (commandName === 'vote') {
      const question = options.getString('question');
      const durationStr = options.getString('duration');
      const optionsRaw = options.getString('options');
      const durationMs = parseDuration(durationStr);
      if (!durationMs) return interaction.reply({ content: 'Invalid duration. Use 30s,1m,5m.', ephemeral: true });
      
      const optionList = optionsRaw.split('|').map(o => o.trim());
      if (optionList.length < 2 || optionList.length > 5) 
        return interaction.reply({ content: 'Enter 2-5 options separated by |', ephemeral: true });
      
      const row = new ActionRowBuilder();
      optionList.forEach((opt, i) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`vote_${i}`)
            .setLabel(opt)
            .setStyle(ButtonStyle.Primary)
        );
      });

      const msg = await interaction.reply({ content: `📊 ${question}`, components: [row], fetchReply: true });
      activePoll = { messageId: msg.id, votes: {} };

      setTimeout(async () => {
        const voteCounts = Array(optionList.length).fill(0);
        Object.values(activePoll.votes).forEach(v => voteCounts[v]++);
        let result = `📊 Poll ended! Results for: ${question}\n`;
        optionList.forEach((opt, i) => { result += `${opt}: ${voteCounts[i]} votes\n`; });
        await channel.send(result);
        activePoll = null;
      }, durationMs);
    }
  } catch (err) {
    console.error(err);
    interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
  }
});

// ================= BUTTON INTERACTIONS =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  if (!activePoll || interaction.message.id !== activePoll.messageId) return;

  activePoll.votes[interaction.user.id] = parseInt(interaction.customId.split('_')[1]);
  await interaction.reply({ content: `✅ Vote recorded for ${interaction.user.tag}`, ephemeral: true });
});

// ================= LOGIN =================
client.login(TOKEN);