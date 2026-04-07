// commands/register.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Driver = require('../models/Driver');
const DriverRating = require('../models/DriverRating');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register yourself to the racing league database'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.user;

        try {
            const existing = await Driver.findOne({ userId: user.id });

            // Zaten kayıtlıysa → sadece ephemeral text
            if (existing) {
                return interaction.editReply({
                    content: "✅ You're already registered in the database."
                });
            }

            // Driver + DriverRating aynı anda oluştur
            await Promise.all([
                Driver.create({ userId: user.id }),
                DriverRating.create({ userId: user.id, username: user.username })
            ]);

            const embed = new EmbedBuilder()
                .setColor('#00FF7F')
                .setTitle('🏎️ Welcome to the League!')
                .setDescription(`You've been successfully registered, **${user.username}**.\nYour stats will update after each race.`)
                .setThumbnail(user.displayAvatarURL({ size: 128 }))
                .setFooter({ text: 'Racing League System' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('[REGISTER ERROR]', err);
            return interaction.editReply({ content: '❌ Database error. Please try again.' });
        }
    }
};
