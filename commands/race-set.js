//--------------------------------
// IMPORTS
//--------------------------------
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const RaceTimer = require('../models/RaceTimer');

//--------------------------------
// COMMAND
//--------------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('race-set')
        .setDescription('Manually start a race timer')
        .addIntegerOption(opt =>
            opt.setName('minutes')
                .setDescription('Minutes until race')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        await interaction.deferReply();

        const minutes = interaction.options.getInteger('minutes');
        const delayMs = minutes * 60000;

        //--------------------------------
        // REFERANS MESAJ (komutu atan mesaj)
        //--------------------------------
        const msg = await interaction.fetchReply();

        //--------------------------------
        // DB SAVE
        //--------------------------------
        const timer = await RaceTimer.create({
            messageId: msg.id,
            channelId: interaction.channel.id,
            guildId: interaction.guild.id,
            endTime: Date.now() + delayMs
        });

        //--------------------------------
        // TIMER
        //--------------------------------
        setTimeout(async () => {

            const fresh = await RaceTimer.findById(timer._id);
            if (!fresh || fresh.notified) return;

            fresh.notified = true;
            await fresh.save();

            try {
                for (let i = 0; i < 5; i++) {
                    await interaction.channel.send(
                        `🏁 ${interaction.user} **RACE TIME!**`
                    );
                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch {}

        }, delayMs);

        //--------------------------------
        // RESPONSE
        //--------------------------------
        await interaction.editReply(
            `⏱ Race timer set for ${minutes} minutes.`
        );
    }
};