const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
require('dotenv').config();

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// BURASI ÖNEMLİ
const guilds = [
    process.env.GUILD_ID_1,
    process.env.GUILD_ID_2
].filter(Boolean);

(async () => {
    try {
        console.log(`[SYSTEM] Registering ${commands.length} commands...`);

        for (const guildId of guilds) {
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                { body: commands }
            );

            console.log(`✅ Loaded in guild: ${guildId}`);
        }

        console.log('[SYSTEM] Done!');
        process.exit(0);

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();