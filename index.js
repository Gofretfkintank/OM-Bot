const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ] 
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

client.once('ready', () => {
    console.log(`[ONLINE] ${client.user.tag} is running on Railway! 🚀`);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[EXECUTION ERROR] /${interaction.commandName}:`, error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: '❌ **Error executing this command!**', ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ content: '❌ **Error executing this command!**', ephemeral: true }).catch(() => {});
        }
    }
});

client.login(process.env.TOKEN);
