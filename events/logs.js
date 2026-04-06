const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    const MAIN_SERVER = "1446960659072946218";
    const LOG_CHANNEL_ID = "1490817414554845184"; // Your specific log channel

    // Helper function to send logs
    async function sendLog(embed) {
        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error("Log Channel Error:", error);
        }
    }

    // 1. Message Deleted
    client.on('messageDelete', async (message) => {
        if (message.guild?.id !== MAIN_SERVER || message.author?.bot) return;

        const embed = new EmbedBuilder()
            .setColor(0xff0000) // Red
            .setTitle('🗑️ Message Deleted')
            .setDescription(`**Author:** <@${message.author.id}> (${message.author.tag})\n**Channel:** <#${message.channelId}>\n\n**Content:**\n${message.content || '*No text (Attachment/Embed)*'}`)
            .setTimestamp();
        
        await sendLog(embed);
    });

    // 2. Message Edited
    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (oldMessage.guild?.id !== MAIN_SERVER || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // Ignore link embeds

        const embed = new EmbedBuilder()
            .setColor(0xffa500) // Orange
            .setTitle('✏️ Message Edited')
            .setDescription(`**Author:** <@${oldMessage.author.id}>\n**Channel:** <#${oldMessage.channelId}>`)
            .addFields(
                { name: 'Old:', value: oldMessage.content || '*None*' },
                { name: 'New:', value: newMessage.content || '*None*' }
            )
            .setTimestamp();

        await sendLog(embed);
    });

    // 3. Member Joined
    client.on('guildMemberAdd', async (member) => {
        if (member.guild.id !== MAIN_SERVER) return;

        const embed = new EmbedBuilder()
            .setColor(0x00ff00) // Green
            .setTitle('📥 New Member Joined')
            .setDescription(`**User:** <@${member.user.id}> (${member.user.tag})\n**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await sendLog(embed);
    });

    // 4. Member Left / Kicked
    client.on('guildMemberRemove', async (member) => {
        if (member.guild.id !== MAIN_SERVER) return;

        const embed = new EmbedBuilder()
            .setColor(0x000000) // Black/Dark
            .setTitle('📤 Member Left')
            .setDescription(`**User:** <@${member.user.id}> (${member.user.tag}) has left the server.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await sendLog(embed);
    });

    // 5. Member Banned
    client.on('guildBanAdd', async (ban) => {
        if (ban.guild.id !== MAIN_SERVER) return;

        const embed = new EmbedBuilder()
            .setColor(0x8b0000) // Dark Red
            .setTitle('🔨 Member Banned')
            .setDescription(`**User:** <@${ban.user.id}> (${ban.user.tag})\n**Reason:** ${ban.reason || '*No reason provided*'}`)
            .setTimestamp();

        await sendLog(embed);
    });
};
