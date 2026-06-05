//--------------------------------
// SERVER STATUS EVENT
// Listens in the test server channel where DiscordSRV
// posts startup/shutdown messages, then sends a clean
// embed to the OM server-status channel.
//--------------------------------

const { EmbedBuilder } = require('discord.js');

//--------------------------------
// CONFIG
//--------------------------------
const SOURCE_CHANNEL_ID = '1512291789644628088'; // Test server (DiscordSRV posts here)
const TARGET_CHANNEL_ID = '1511995662865141810'; // OM server-status channel

//--------------------------------
// MAIN EXPORT
//--------------------------------
module.exports = (client) => {

    client.on('messageCreate', async (message) => {
        if (message.channel.id !== SOURCE_CHANNEL_ID) return;
        if (!message.author.bot) return;
        if (message.author.id === client.user.id) return;

        const isStart = message.content.includes('Server has started');
        const isStop  = message.content.includes('Server has stopped');
        if (!isStart && !isStop) return;

        const targetChannel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
        if (!targetChannel) return;

        const now = Math.floor(Date.now() / 1000);

        const embed = isStart
            ? new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🟢  Server Online')
                .setDescription('The Minecraft server is up and running.\n**You can now connect!**')
                .addFields(
                    { name: '📡 Status', value: '`Online`',  inline: true },
                    { name: '⏱️ Time',   value: `<t:${now}:R>`, inline: true }
                )
                .setFooter({ text: 'Olzhasstik Motorsports • Minecraft' })
                .setTimestamp()
            : new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('🔴  Server Offline')
                .setDescription('The Minecraft server has shut down.')
                .addFields(
                    { name: '📡 Status', value: '`Offline`', inline: true },
                    { name: '⏱️ Time',   value: `<t:${now}:R>`, inline: true }
                )
                .setFooter({ text: 'Olzhasstik Motorsports • Minecraft' })
                .setTimestamp();

        await targetChannel.send({ embeds: [embed] }).catch(console.error);

        // Update channel name emoji based on server state
        try {
            await targetChannel.setName(isStart ? '🟢┃server-status' : '🔴┃server-status');
        } catch (err) {
            console.error('[ServerStatus] Channel rename failed:', err.message);
        }

        console.log(`[ServerStatus] ${isStart ? 'ONLINE' : 'OFFLINE'} embed sent to OM server.`);
    });
};