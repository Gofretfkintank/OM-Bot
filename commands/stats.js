// commands/stats.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const driversFile = path.join(__dirname, '../drivers.json');

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

        // 🔥 3 saniye fix
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;

        let drivers;
        try {
            drivers = JSON.parse(fs.readFileSync(driversFile, 'utf8'));
        } catch (err) {
            return interaction.editReply({
                content: '❌ Database error.'
            });
        }

        // 🔥 SENİN JSON OBJECT olduğu için .find değil BU:
        const driver = drivers[targetUser.id];

        if (!driver) {
            return interaction.editReply({
                content: `❌ No stats found for ${targetUser.username}`
            });
        }

        // SAFE VALUES
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

            .setFooter({
                text: 'Racing League System',
                iconURL: interaction.guild?.iconURL() || undefined
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};