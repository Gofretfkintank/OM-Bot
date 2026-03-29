--------------------------
// IMPORTS
--------------------------
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const RaceTimer = require('../models/RaceTimer');

--------------------------
// COMMAND
--------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('race-delay')
        .setDescription('Delay active race timer')
        .addIntegerOption(opt =>
            opt.setName('minutes')
                .setDescription('Minutes to delay')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        await interaction.deferReply();

        const minutes = interaction.options.getInteger('minutes');
        const delayMs = minutes * 60000;

        --------------------------
        // SON TIMERI BUL
        --------------------------
        const timer = await RaceTimer.findOne({ notified: false })
            .sort({ endTime: -1 });

        if (!timer) {
            return interaction.editReply('❌ No active race found.');
        }

        --------------------------
        // DELAY UYGULA
        --------------------------
        timer.endTime += delayMs;
        await timer.save();

        await interaction.editReply(
            `⏳ Race delayed by ${minutes} minutes.`
        );
    }
};