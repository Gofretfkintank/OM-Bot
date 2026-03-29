const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Driver = require('../models/Driver'); // 🔥 MODEL

module.exports = {
    data: new SlashCommandBuilder()
        .setName('driversfix')
        .setDescription('Edit driver stats')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('Target user')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('stat')
                .setDescription('Stat to edit')
                .setRequired(true)
                .addChoices(
                    { name: 'races', value: 'races' },
                    { name: 'wins', value: 'wins' },
                    { name: 'podiums', value: 'podiums' },
                    { name: 'poles', value: 'poles' },
                    { name: 'dnf', value: 'dnf' },
                    { name: 'dns', value: 'dns' },
                    { name: 'wdc', value: 'wdc' },
                    { name: 'wcc', value: 'wcc' },
                    { name: 'doty', value: 'doty' }
                )
        )
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setDescription('Amount to add/remove')
                .setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const stat = interaction.options.getString('stat');
        const amount = interaction.options.getInteger('amount');

        // 🔥 driver bul / yoksa oluştur
        let driver = await Driver.findOne({ userId: user.id });

        if (!driver) {
            driver = await Driver.create({ userId: user.id });
        }

        // 🔥 stat güncelle (0 altına düşmesin)
        driver[stat] = Math.max(0, (driver[stat] || 0) + amount);

        await driver.save();

        await interaction.reply(`✅ Updated ${stat} for ${user.username}`);
    }
};