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
if (!fs.existsSync(WARN_FILE)) {
fs.writeFileSync(WARN_FILE, JSON.stringify({}));
}

function getWarns() {
return JSON.parse(fs.readFileSync(WARN_FILE));
}

function saveWarns(data) {
fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2));
}

// ================= TIME PARSER =================

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
.setDescription('Warn a member')
.addUserOption(opt =>
opt.setName('user')
.setDescription('Target user')
.setRequired(true))
.addStringOption(opt =>
opt.setName('reason')
.setDescription('Reason')
.setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

new SlashCommandBuilder()
.setName('warnings')
.setDescription('Check member warnings')
.addUserOption(opt =>
opt.setName('user')
.setDescription('Target user')
.setRequired(true))
.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

new SlashCommandBuilder()
.setName('vote')
.setDescription('Create a timed button poll')
.addStringOption(opt =>
opt.setName('question')
.setDescription('Poll question')
.setRequired(true))
.addStringOption(opt =>
opt.setName('duration')
.setDescription('Duration (30s, 1m, 5m)')
.setRequired(true))
.addStringOption(opt =>
opt.setName('options')
.setDescription('Separate options with |')
.setRequired(true))

].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {

await rest.put(
Routes.applicationGuildCommands(client.user.id, GUILD_ID),
{ body: commands }
);

console.log(`Bot ${client.user.tag} ready.`);
});

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {

if (!interaction.isChatInputCommand()) return;

try {

const { commandName, options } = interaction;

// CLEAR
if (commandName === 'clear') {
const amount = options.getInteger('amount');

if (amount < 1 || amount > 100)
return interaction.reply({ content: 'Enter a number between 1-100.', ephemeral: true });

await interaction.channel.bulkDelete(amount, true);
return interaction.reply({ content: `${amount} messages deleted.`, ephemeral: true });
}

// WARN
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

return interaction.reply(`${member.user.tag} warned. Total: ${data[member.id].length}`);
}

// WARNINGS
if (commandName === 'warnings') {
const member = options.getMember('user');
const data = getWarns();

if (!data[member.id] || data[member.id].length === 0)
return interaction.reply(`No warnings for ${member.user.tag}.`);

const list = data[member.id]
.map((w, i) => `${i + 1}. ${w.reason}`)
.join('\n');

return interaction.reply(`Warnings:\n${list}`);
}

// VOTE
if (commandName === 'vote') {

const question = options.getString('question');
const durationStr = options.getString('duration');
const optionsRaw = options.getString('options');

const durationMs = parseDuration(durationStr);
if (!durationMs)
return interaction.reply({ content: 'Invalid duration. Use 30s, 1m, 5m.', ephemeral: true });

const optionList = optionsRaw.split('|').map(o => o.trim()).filter(o => o);

if (optionList.length < 2 || optionList.length > 5)
return interaction.reply({ content: 'Provide 2-5 options.', ephemeral: true });

let votes = {};
let voters = new Set();

optionList.forEach((opt, i) => {
votes[i] = 0;
});

const buttons = optionList.map((opt, i) =>
new ButtonBuilder()
.setCustomId(`vote_${i}`)
.setLabel(opt)
.setStyle(ButtonStyle.Primary)
);

const row = new ActionRowBuilder().addComponents(buttons);

await interaction.reply({
content: `📊 **Poll Started**\n\n${question}\n⏳ Duration: ${durationStr}`,
components: [row]
});

const msg = await interaction.fetchReply();

const collector = msg.createMessageComponentCollector({
time: durationMs
});

collector.on('collect', async i => {

if (voters.has(i.user.id))
return i.reply({ content: 'You already voted.', ephemeral: true });

const index = i.customId.split('_')[1];
votes[index]++;
voters.add(i.user.id);

await i.reply({ content: 'Vote recorded.', ephemeral: true });
});

collector.on('end', async () => {

const disabledRow = new ActionRowBuilder().addComponents(
buttons.map(btn => ButtonBuilder.from(btn).setDisabled(true))
);

let resultText = '';
optionList.forEach((opt, i) => {
resultText += `${opt}: ${votes[i]} votes\n`;
});

await msg.edit({
content:
`📊 **Poll Ended**\n\n${question}\n\n${resultText}`,
components: [disabledRow]
});
});
}

} catch (err) {
console.error(err);
if (!interaction.replied)
interaction.reply({ content: 'An error occurred.', ephemeral: true });
}

});

client.login(TOKEN);