const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout a member (Mute).')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('time')
                .setDescription('Duration in minutes')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply();
        
        const member = interaction.options.getMember('user');
        const duration = interaction.options.getInteger('time');

        // 1. Kontrol: Kullanıcı sunucuda var mı?
        if (!member) {
            return interaction.editReply('❌ **Error:** User not found in this server.');
        }

        // 2. Kontrol: Botun yetkisi o kullanıcıya yetiyor mu? (Hiyerarşi)
        if (!member.manageable) {
            return interaction.editReply('❌ **Hierarchy Error:** My role is lower than this user or I don’t have permission to mute them.');
        }

        // 3. Kontrol: Geçerli süre (1 dakika ile 28 gün arası olmalı)
        if (duration < 1 || duration > 40320) {
            return interaction.editReply('❌ **Time Error:** Duration must be between 1 and 40320 minutes (28 days).');
        }

        try {
            await member.timeout(duration * 60000);
            await interaction.editReply(`🔇 **${member.user.username}** has been muted for **${duration}** minutes. ✅`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ **Internal Error:** Something went wrong while applying the timeout.');
        }
    },
};
