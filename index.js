const {
Client,
GatewayIntentBits,
REST,
Routes,
SlashCommandBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle
} = require('discord.js');

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

const TOKEN = process.env.TOKEN;
const GUILD_ID = "1446960659072946218"; // SUNUCU ID YAZ

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
.setDescription('Separate options with | (Option1 | Option2 | Option3)')
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

// ================= INTERACTION =================

client.on('interactionCreate', async interaction => {

if (!interaction.isChatInputCommand()) return;

if (interaction.commandName === 'vote') {

const question = interaction.options.getString('question');
const durationStr = interaction.options.getString('duration');
const optionsRaw = interaction.options.getString('options');

const durationMs = parseDuration(durationStr);
if (!durationMs)
return interaction.reply({ content: 'Invalid duration. Use 30s, 1m, 5m', ephemeral: true });

const optionList = optionsRaw.split('|').map(o => o.trim()).filter(o => o);

if (optionList.length < 2 || optionList.length > 5)
return interaction.reply({ content: 'You must provide 2-5 options.', ephemeral: true });

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

});

client.login(TOKEN);