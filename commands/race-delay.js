//--------------------------------
// IMPORTS
//--------------------------------
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const RaceTimer = require('../models/RaceTimer');

//--------------------------------
// COMMAND
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('race-delay')
        .setDescription('Delay the active race timer')
        .addIntegerOption(opt =>
            opt.setName('minutes')
                .setDescription('Minutes to delay')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(120)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const minutes  = interaction.options.getInteger('minutes');
        const delayMs  = minutes * 60_000;

        //--------------------------------
        // Find active timer (most recent, not yet notified)
        //--------------------------------
        const timer = await RaceTimer.findOne({ notified: false }).sort({ endTime: 1 });

        if (!timer) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xff0000)
                        .setTitle('❌ No Active Timer')
                        .setDescription('There is no active race timer to delay.')
                ]
            });
        }

        //--------------------------------
        // Update endTime in DB
        //--------------------------------
        const oldEnd = timer.endTime;
        timer.endTime = oldEnd + delayMs;
        await timer.save();

        //--------------------------------
        // Reschedule the in-memory setTimeout
        // Import the live timerMap + scheduleTimer from raceTimer event
        //--------------------------------
        try {
            // Events are loaded as modules — require the cached version
            const raceTimerEvent = require('../events/raceTimer');
            if (typeof raceTimerEvent.scheduleTimer === 'function') {
                raceTimerEvent.scheduleTimer(interaction.client, timer);
            }
        } catch (err) {
            console.error('[race-delay] Could not reschedule timer:', err);
        }

        //--------------------------------
        // Build confirmation embed
        //--------------------------------
        const newEndSec = Math.floor(timer.endTime / 1000);

        const embed = new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle('⏳ Race Delayed')
            .addFields(
                { name: '⏱️ Delay Added',  value: `**${minutes} minute${minutes !== 1 ? 's' : ''}**`, inline: true },
                { name: '🏁 New Race Time', value: `<t:${newEndSec}:t> (<t:${newEndSec}:R>)`,          inline: true },
            )
            .setFooter({ text: 'Timer rescheduled automatically' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        //--------------------------------
        // Also post a public notice in the timer's channel
        //--------------------------------
        try {
            const channel = await interaction.client.channels.fetch(timer.channelId).catch(() => null);
            if (channel) {
                await channel.send({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xf59e0b)
                            .setTitle('⏳ Race Delayed')
                            .setDescription(`The race has been delayed by **${minutes} minute${minutes !== 1 ? 's' : ''}**.\nNew start time: <t:${newEndSec}:t> (<t:${newEndSec}:R>)`)
                            .setTimestamp()
                    ]
                });
            }
        } catch (err) {
            console.error('[race-delay] Could not post public notice:', err);
        }
    }
};
