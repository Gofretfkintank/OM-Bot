// commands/stats.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Driver = require('../models/Driver'); // 🔥 ARTIK MONGO MODELİNİ KULLANIYORUZ

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show racing statistics')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Select a user')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;

        // 🔥 JSON okumayı sildik, direkt MongoDB'den çekiyoruz
        let driver;
        try {
            driver = await Driver.findOne({ userId: targetUser.id });
        } catch (err) {
            console.error(err);
            return interaction.editReply({ content: '❌ Database error.' });
        }

        if (!driver) {
            return interaction.editReply({
                content: `❌ No stats found for **${targetUser.username}** in MongoDB.`
            });
        }

        // SAFE VALUES (Mongoose varsayılanları 0 olsa da garantiye alıyoruz)
        const races = driver.races || 0;
        const wins = driver.wins || 0;
        const podiums = driver.podiums || 0;
        const poles = driver.poles || 0;
        const dnf = driver.dnf || 0;
        const dns = driver.dns || 0;
        const doty = driver.doty || 0;
        const wdc = driver.wdc || 0;
        const wcc = driver.wcc || 0;

        const winRate = races > 0 ? ((wins / races) * 100).toFixed(1) : "0.0";
        const dnfRate = races > 0 ? ((dnf / races) * 100).toFixed(1) : "0.0";

        const embed = new EmbedBuilder()
            .setColor('#E10600')
            .setTitle(`🏎️ ${targetUser.username}'s Racing Stats`)
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '🏁 Races', value: `**${races}**`, inline: true },
                { name: '🏆 Wins', value: `**${wins}**`, inline: true },
                { name: '🥇 Podiums', value: `**${podiums}**`, inline: true },
                { name: '🎯 Poles', value: `**${poles}**`, inline: true },
                { name: '🌟 DOTY', value: `**${doty}**`, inline: true },
                { name: '📊 Win Rate', value: `**%${winRate}**`, inline: true },
                { name: '💀 DNF', value: `**${dnf}**`, inline: true },
                { name: '⚡ DNS', value: `**${dns}**`, inline: true },
                { name: '⚠️ DNF Rate', value: `**%${dnfRate}**`, inline: true },
                {
                    name: '👑 Championships',
                    value: `WDC: **${wdc}** | WCC: **${wcc}**`
                }
            )
            .setFooter({ text: 'Racing League System (MongoDB)', iconURL: interaction.guild?.iconURL() || undefined })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
