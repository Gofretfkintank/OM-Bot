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

// ================= WARN STORAGE =================

const WARN_FILE = './warns.json';
if (!fs.existsSync(WARN_FILE)) {
fs.writeFileSync(WARN_FILE, JSON.stringify({}));
}

function getWarns() {
return JSON.parse(fs.readFileSync(WARN_FILE));
}

function saveWarns(data) {
fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2));
}

// ================= DURATION =================

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

const commands = [

new SlashCommandBuilder()
.setName('clear')
.setDescription('Delete messages')
.addIntegerOption(opt =>
opt.setName('amount')
.setDescription('1-100')
.setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

new SlashCommandBuilder()
.setName('warn')
.setDescription('Warn member')
.addUserOption(opt =>
opt.setName('user')
.setDescription('User')
.setRequired(true))
.addStringOption(opt =>
opt.setName('reason')
.setDescription('Reason')
.setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

new SlashCommandBuilder()
.setName('warnings')
.setDescription('Check warnings')
.addUserOption(opt =>
opt.setName('user')
.setDescription('User')
.setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

new SlashCommandBuilder()
.setName('voting')
.setDescription('Timed button voting')
.addStringOption(opt =>
opt.setName('question')
.setDescription('Vote question')
.setRequired(true))
.addStringOption(opt =>
opt.setName('duration')
.setDescription('Duration (30s, 1m, 5m)')
.setRequired(true))

].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
await rest.put(
Routes.applicationCommands(client.user.id),
{ body: commands }
);
console.log(`Bot ${client.user.tag} ready.`);
});

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {

if (interaction.isChatInputCommand()) {

const { commandName, options } = interaction;

try {

if (commandName === 'clear') {
const amount = options.getInteger('amount');
if (amount < 1 || amount > 100)
return interaction.reply({ content: '1-100 gir.', ephemeral: true });

await interaction.channel.bulkDelete(amount, true);
await interaction.reply({ content: `${amount} mesaj silindi.`, ephemeral: true });
}

if (commandName === 'warn') {
const member = options.getMember('user');
const reason = options.getString('reason');

const data = getWarns();
if (!data[member.id]) data[member.id] = [];

data[member.id].push({
reason,
date: new Date().toISOString()
});

saveWarns(data);

await interaction.reply(`${member.user.tag} warnlandı. Toplam: ${data[member.id].length}`);
}

if (commandName === 'warnings') {
const member = options.getMember('user');
const data = getWarns();

if (!data[member.id] || data[member.id].length === 0)
return interaction.reply(`${member.user.tag} için warn yok.`);

const list = data[member.id]
.map((w, i) => `${i + 1}. ${w.reason}`)
.join('\n');

await interaction.reply(`Warnlar:\n${list}`);
}

if (commandName === 'voting') {

const question = options.getString('question');
const durationStr = options.getString('duration');
const durationMs = parseDuration(durationStr);

if (!durationMs)
return interaction.reply({ content: 'Süre formatı: 30s, 1m, 5m', ephemeral: true });

let up = 0;
let down = 0;
const voters = new Set();

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId('vote_yes')
.setLabel('Kabul')
.setStyle(ButtonStyle.Success),
new ButtonBuilder()
.setCustomId('vote_no')
.setLabel('Red')
.setStyle(ButtonStyle.Danger)
);

await interaction.reply({
content: `📊 **Oylama Başladı!**\n${question}\n⏳ Süre: ${durationStr}`,
components: [row]
});

const msg = await interaction.fetchReply();

const collector = msg.createMessageComponentCollector({
time: durationMs
});

collector.on('collect', async i => {

if (voters.has(i.user.id)) {
return i.reply({ content: 'Zaten oy verdin.', ephemeral: true });
}

voters.add(i.user.id);

if (i.customId === 'vote_yes') up++;
if (i.customId === 'vote_no') down++;

await i.reply({ content: 'Oyun kaydedildi.', ephemeral: true });
});

collector.on('end', async () => {

const disabledRow = new ActionRowBuilder().addComponents(
row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
);

let result;
if (up > down) result = 'Kabul edildi.';
else if (down > up) result = 'Reddedildi.';
else result = 'Berabere.';

await msg.edit({
content:
`📊 **Oylama Bitti!**\n${question}\n\nKabul: ${up}\nRed: ${down}\n\nSonuç: ${result}`,
components: [disabledRow]
});
});

}

} catch (err) {
console.error(err);
if (!interaction.replied)
await interaction.reply({ content: 'Hata oluştu.', ephemeral: true });
}
}

});

client.login(TOKEN);