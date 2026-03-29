const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const Driver = require('../models/Driver');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('db-sync')
        .setDescription('Migrate local JSON data to MongoDB')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const filePath = path.join(__dirname, '../drivers.json');

        if (!fs.existsSync(filePath)) {
            return interaction.editReply('drivers.json not found');
        }

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            let count = 0;

            for (const userId in data) {
                const d = data[userId];

                await Driver.findOneAndUpdate(
                    { userId },
                    {
                        $set: {
                            races: Number(d.races) || 0,
                            wins: Number(d.wins) || 0,
                            podiums: Number(d.podiums) || 0,
                            poles: Number(d.poles) || 0,
                            dnf: Number(d.dnf) || 0,
                            dns: Number(d.dns) || 0,
                            doty: Number(d.doty) || 0,
                            wdc: Number(d.wdc) || 0,
                            wcc: Number(d.wcc) || 0,
                            voters: d.voters || []
                        }
                    },
                    { upsert: true }
                );

                count++;
            }

            await interaction.editReply(`Done: ${count} users migrated to MongoDB`);

        } catch (err) {
            console.error(err);
            await interaction.editReply('Error occurred during migration');
        }
    }
};