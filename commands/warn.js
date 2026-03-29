const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../models/Warn');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Issue a warning')
        .addUserOption(opt =>
            opt.setName('user').setDescription('User').setRequired(true))
        .addStringOption(opt =>
            opt.setName('reason').setDescription('Reason').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        let data = await Warn.findOne({
            userId: user.id,
            guildId: interaction.guildId
        });

        if (!data) {
            data = new Warn({
                userId: user.id,
                guildId: interaction.guildId,
                warns: []
            });
        }

        data.warns.push({
            reason,
            moderator: interaction.user.tag,
            date: new Date().toLocaleDateString()
        });

        await data.save();

        await interaction.editReply(`⚠️ ${user.tag} warned. Reason: ${reason}`);
    }
};