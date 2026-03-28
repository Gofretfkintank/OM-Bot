const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('path');

const driversFile = path.join(__dirname, '../drivers.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show racing stats for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to check')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        let drivers;
        try {
            drivers = JSON.parse(fs.readFileSync(driversFile, 'utf8'));
        } catch {
            return interaction.reply({
                content: '❌ Database error.',
                ephemeral: true
            });
        }

        // ✅ FIX BURASI
        const driver = drivers[targetUser.id];

        if (!driver) {
            return interaction.reply({
                content: `❌ No stats found for **${targetUser.username}**`,
                ephemeral: true
            });
        }

        const races = Number(driver.races) || 0;
        const wins = Number(driver.wins) || 0;
        const podiums = Number(driver.podiums) || 0;
        const poles = Number(driver.poles) || 0;
        const dnf = Number(driver.dnf) || 0;
        const dns = Number(driver.dns) || 0;
        const doty = Number(driver.doty) || 0;
        const wdc = Number(driver.wdc) || 0;
        const wcc = Number(driver.wcc) || 0;

        const winRate = races > 0 ? ((wins / races) * 100).toFixed(1) : "0.0";
        const dnfRate = races > 0 ? ((dnf / races) * 100).toFixed(1) : "0.0";

        const embed = new EmbedBuilder()
            .setColor('#E10600')
            .setTitle(`🏎️ ${targetUser.username}'s Racing Stats`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
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
                    value: `WDC: **${wdc}**  |  WCC: **${wcc}**`,
                    inline: false
                }
            )
            .setFooter({
                text: 'Racing League System',
                iconURL: interaction.guild?.iconURL() || null
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};