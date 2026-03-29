const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../models/Warn');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Check warnings')
        .addUserOption(opt =>
            opt.setName('user').setDescription('User').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        const user = interaction.options.getUser('user');

        const data = await Warn.findOne({
            userId: user.id,
            guildId: interaction.guildId
        });

        if (!data || data.warns.length === 0) {
            return interaction.editReply('No warnings.');
        }

        const history = data.warns
            .map((w, i) => `${i + 1}. ${w.reason} (By: ${w.moderator})`)
            .join('\n');

        await interaction.editReply(`📋 ${user.tag} warnings:\n${history}`);
    }
};