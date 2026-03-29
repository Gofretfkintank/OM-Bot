const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');

const Driver = require('../models/Driver');
const DotyVote = require('../models/DotyVote');

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

        // 🔥 DISPLAY NAME FIX
        for (const p of participants) {

            let member;
            try {
                member = await interaction.guild.members.fetch(p.id);
            } catch {
                member = null;
            }

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(p.id)
                    .setLabel(member?.displayName || p.username)
                    .setStyle(ButtonStyle.Primary)
            );
        }

        const msg = await interaction.reply({
            content: '🗳️ DOTY Vote started! (1 hour)',
            components: [row],
            fetchReply: true
        });

        // 🔥 Mongo kayıt (backup gibi)
        await DotyVote.create({
            messageId: msg.id,
            participants: participants.map(p => p.id),
            votes: {},
            voters: [],
            endTime: Date.now() + 3600000
        });

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 3600000
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

                // 🔥 Mongo da kaydet
                await DotyVote.updateOne(
                    { messageId: msg.id },
                    {
                        $push: { voters: i.user.id },
                        $inc: { [`votes.${i.customId}`]: 1 }
                    }
                );

                await i.reply({ content: 'Vote counted', ephemeral: true });

            } catch (err) {
                console.error('COLLECT ERROR:', err);
            }
        });

        collector.on('end', async () => {

            try {
                await msg.edit({ components: [] });
            } catch {}

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

            if (winners.length === 0) {
                return interaction.followUp('❌ No votes.');
            }

            if (winners.length > 1) {
                return interaction.followUp(
                    `🤝 Tie:\n${winners.map(id => `<@${id}>`).join('\n')} (${max} votes)`
                );
            }

            const winner = winners[0];

            try {
                await Driver.findOneAndUpdate(
                    { userId: winner },
                    { $inc: { doty: 1 } },
                    { upsert: true }
                );
            } catch (err) {
                console.error('DB ERROR:', err);
            }

            await interaction.followUp(
                `🏆 Winner: <@${winner}> with ${max} votes!`
            );

            // 🔥 vote finished
            await DotyVote.updateOne(
                { messageId: msg.id },
                { finished: true }
            );
        });
    }
};