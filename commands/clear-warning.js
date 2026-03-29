const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../models/Warn');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear-warning')
        .setDescription('Clear all warnings')
        .addUserOption(opt =>
            opt.setName('user').setDescription('User').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        const user = interaction.options.getUser('user');

        const data = await Warn.findOne({
            userId: user.id,
            guildId: interaction.guildId
        });

        if (!data) {
            return interaction.editReply('No warnings found.');
        }

        data.warns = [];
        await data.save();

        await interaction.editReply(`✅ Cleared warnings for ${user.tag}`);
    }
};