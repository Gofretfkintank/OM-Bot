const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

const Driver = require('../models/Driver');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dotyvote')
        .setDescription('Start DOTY vote')
        .addUserOption(opt => opt.setName('p1').setDescription('Driver 1').setRequired(true))
        .addUserOption(opt => opt.setName('p2').setDescription('Driver 2'))
        .addUserOption(opt => opt.setName('p3').setDescription('Driver 3'))
        .addUserOption(opt => opt.setName('p4').setDescription('Driver 4'))
        .addUserOption(opt => opt.setName('p5').setDescription('Driver 5')),

    async execute(interaction) {

        const participants = [];

        for (let i = 1; i <= 5; i++) {
            const u = interaction.options.getUser(`p${i}`);
            if (u) participants.push(u);
        }

        const voteMap = new Map();
        participants.forEach(p => voteMap.set(p.id, 0));

        const voted = new Set();

        const row = new ActionRowBuilder();

        participants.forEach(p => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(p.id)
                    .setLabel(p.username)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        const msg = await interaction.reply({
            content: '🗳️ DOTY Vote started!',
            components: [row],
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 3600000 // 1 saat
        });

        collector.on('collect', async i => {

            try {
                if (voted.has(i.user.id)) {
                    return i.reply({ content: 'Already voted', ephemeral: true });
                }

                voted.add(i.user.id);

                voteMap.set(
                    i.customId,
                    (voteMap.get(i.customId) || 0) + 1
                );

                await i.reply({ content: 'Vote counted', ephemeral: true });

            } catch (err) {
                console.error('COLLECT ERROR:', err);
            }
        });

        collector.on('end', async () => {

            try {
                // Butonları kapat
                await msg.edit({ components: [] });
            } catch (err) {
                console.log('Mesaj silinmiş olabilir, sorun yok');
            }

            let max = 0;

            for (const v of voteMap.values()) {
                if (v > max) max = v;
            }

            const winners = [];

            for (const [id, v] of voteMap) {
                if (v === max && max > 0) {
                    winners.push(id);
                }
            }

            // Oy yoksa
            if (winners.length === 0) {
                return interaction.followUp('❌ No votes.');
            }

            // BERABERLİK
            if (winners.length > 1) {
                return interaction.followUp(
                    `🤝 Tie between:\n${winners.map(id => `<@${id}>`).join('\n')} (${max} votes)`
                );
            }

            const winner = winners[0];

            let driver = await Driver.findOne({ userId: winner });

            if (!driver) {
                driver = await Driver.create({ userId: winner });
            }

            driver.doty = (driver.doty || 0) + 1;

            await driver.save();

            await interaction.followUp(
                `🏆 Winner: <@${winner}> with ${max} votes!`
            );

        });
    }
};