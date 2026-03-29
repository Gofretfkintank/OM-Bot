const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../models/Warn');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-warning')
        .setDescription('Clear all warnings')
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('User')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        const user = interaction.options.getUser('user');

        // 🔥 TÜM WARNLARI SİL
        const result = await Warn.deleteMany({
            userId: user.id,
            guildId: interaction.guildId
        });

        if (result.deletedCount === 0) {
            return interaction.editReply('❌ No warnings found.');
        }

        await interaction.editReply(
            `🧹 Cleared ${result.deletedCount} warnings for ${user.tag}`
        );
    }
};