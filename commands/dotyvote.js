const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

const fs = require('fs');
const driversPath = './drivers.json';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dotyvote')
        .setDescription('Start DOTY vote')
        .addUserOption(opt => opt.setName('p1').setRequired(true))
        .addUserOption(opt => opt.setName('p2'))
        .addUserOption(opt => opt.setName('p3'))
        .addUserOption(opt => opt.setName('p4'))
        .addUserOption(opt => opt.setName('p5')),

    async execute(interaction) {

        const participants = [];

        for (let i = 1; i <= 5; i++) {
            const u = interaction.options.getUser(`p${i}`);
            if (u) participants.push(u);
        }

        const voteMap = new Map();
        participants.forEach(p => voteMap.set(p.id, 0));

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
            content: 'DOTY Vote başladı',
            components: [row],
            fetchReply: true
        });

        const voted = new Set();

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {

            if (voted.has(i.user.id)) {
                return i.reply({ content: 'Already voted', ephemeral: true });
            }

            voted.add(i.user.id);
            voteMap.set(i.customId, voteMap.get(i.customId) + 1);

            await i.reply({ content: 'Vote counted', ephemeral: true });
        });

        collector.on('end', () => {

            let max = 0;
            let winner = null;

            for (const [id, v] of voteMap) {
                if (v > max) {
                    max = v;
                    winner = id;
                }
            }

            if (!winner) return;

            const drivers = JSON.parse(fs.readFileSync(driversPath, 'utf8'));

            if (!drivers[winner]) {
                drivers[winner] = {
                    races: 0, wins: 0, podiums: 0,
                    poles: 0, dnf: 0, dns: 0,
                    wdc: 0, wcc: 0, doty: 0
                };
            }

            drivers[winner].doty++;

            fs.writeFileSync(driversPath, JSON.stringify(drivers, null, 2));
        });
    }
};