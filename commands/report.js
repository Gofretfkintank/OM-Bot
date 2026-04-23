const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Report a user to the staff team.')
        .addUserOption(option => 
            option.setName('user').setDescription('The user you want to report').setRequired(true))
        .addStringOption(option => 
            option.setName('reason').setDescription('The reason for reporting').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const logChannel = interaction.guild.channels.cache.get(process.env.REPORT_LOG_ID);
        if (!logChannel) return interaction.editReply('❌ **Error:** Staff log channel not found.');
        const embed = new EmbedBuilder()
            .setTitle('📩 New Report Received')
            .addFields(
                { name: 'Reporter', value: interaction.user.tag, inline: true },
                { name: 'Target',   value: target.tag,           inline: true },
                { name: 'Reason',   value: reason }
            )
            .setColor('Red')
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
        await interaction.editReply('✅ **Success:** Incident reported. Target is now under surveillance by the support squad.');
    },

    async prefix(message, args) {
        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply('❌ Usage: `report @user <reason>`');
        const user = await message.client.users.fetch(id).catch(() => null);
        if (!user) return message.reply('❌ User not found.');
        const reason = args.slice(1).join(' ');
        if (!reason) return message.reply('❌ Please provide a reason.');
        const logChannel = message.guild.channels.cache.get(process.env.REPORT_LOG_ID);
        if (!logChannel) return message.reply('❌ Staff log channel not found.');
        const embed = new EmbedBuilder()
            .setTitle('📩 New Report Received')
            .addFields(
                { name: 'Reporter', value: message.author.tag, inline: true },
                { name: 'Target',   value: user.tag,           inline: true },
                { name: 'Reason',   value: reason }
            )
            .setColor('Red')
            .setTimestamp();
        await logChannel.send({ embeds: [embed] });
        await message.delete().catch(() => {});
        return message.reply('✅ Report submitted. Target is now under surveillance.');
    }
};
