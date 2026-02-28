const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

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
        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (targetMember && !targetMember.bannable) {
            return interaction.editReply('❌ I cannot ban this user.');
        }

        try {
            await interaction.guild.members.ban(targetUser.id, { reason });
            
            // Embed oluşturma
            const banEmbed = new EmbedBuilder()
                .setColor(0x2ecc71) // Yeşil renk (Görüntüdeki gibi)
                .setDescription(`🛰️ **${targetUser.tag}** The user has been neutralized by the OM Bot.\n**Reason:** ${reason}`);

            await interaction.editReply({ embeds: [banEmbed] });
        } catch (error) {
            await interaction.editReply('❌ I cannot ban this user.');
        }
    }
};
