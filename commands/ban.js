const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server.')
        .addUserOption(option => option.setName('target').setDescription('The member to ban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the ban'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        await interaction.deferReply();
        
        const targetMember = interaction.options.getMember('target');
        const targetUser = interaction.options.getUser('target'); // Sunucuda yoksa bile ID'sini almak için
        const reason = interaction.options.getString('reason') || 'No reason provided';

        // Hata veren kısım burasıydı, targetMember null ise bot çöküyordu.
        // Artık sadece kullanıcı sunucudaysa .bannable kontrolü yapıyor.
        if (targetMember && !targetMember.bannable) {
            return interaction.editReply('❌ I cannot ban this user.');
        }

        try {
            // Kullanıcı sunucudaysa targetMember üzerinden, değilse ID (targetUser) üzerinden banlar
            await interaction.guild.members.ban(targetUser.id, { reason });
            
            // Senin orijinal mesajın:
            await interaction.editReply(`🛰 **${targetUser.tag}** The user has been neutralized by the OM Bot. Reason: ${reason}`);
        } catch (error) {
            await interaction.editReply('❌ I cannot ban this user.');
        }
    }
};
