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

// ENV'den al
const allowedGuilds = [
    process.env.GUILD_ID_1,
    process.env.GUILD_ID_2
].filter(Boolean);

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

client.once('ready', async () => {
    console.log(`[ONLINE] ${client.user.tag} is running on Railway! 🚀`);

    try {
        console.log('Deleting all old global commands...');
        await client.application.commands.set([]); 
        console.log('✅ Global commands deleted!');

        for (const guildId of allowedGuilds) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;

            await guild.commands.set(
                client.commands.map(cmd => cmd.data.toJSON())
            );

            console.log(`✅ Commands loaded in guild: ${guildId}`);
        }

    } catch (error) {
        console.error('❌ Setup error:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (!allowedGuilds.includes(interaction.guildId)) {
        return interaction.reply({
            content: '❌ This bot is not allowed in this server.',
            ephemeral: true
        });
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[EXECUTION ERROR] /${interaction.commandName}:`, error);

        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ 
                content: '❌ Error executing this command!', 
                ephemeral: true 
            }).catch(() => {});
        } else {
            await interaction.reply({ 
                content: '❌ Error executing this command!', 
                ephemeral: true 
            }).catch(() => {});
        }
    }
});

client.login(process.env.TOKEN);