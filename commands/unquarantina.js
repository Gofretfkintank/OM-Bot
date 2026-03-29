const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Jail = require('../models/Jail');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unjail')
        .setDescription('Release a user from quarantine.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('User to release')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'No permission.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) return interaction.editReply('User not found.');

        // 🔥 MONGO
        const data = await Jail.findOne({
            userId: targetMember.id,
            guildId: interaction.guildId
        });

        if (!data) {
            return interaction.editReply('This user is not jailed.');
        }

        try {
            await targetMember.roles.set(data.roles);

            for (const channel of interaction.guild.channels.cache.values()) {
                try {
                    await channel.permissionOverwrites.delete(targetMember.id);
                } catch {}
            }

            await Jail.deleteOne({
                userId: targetMember.id,
                guildId: interaction.guildId
            });

            return interaction.editReply(`🔓 ${targetMember.user.tag} has been released.`);

        } catch (err) {
            console.error(err);
            return interaction.editReply('Error.');
        }
    }
};