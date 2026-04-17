const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const SeasonVote = require('../models/SeasonVote');

const VOTE_DURATION_MS = 5 * 60 * 60 * 1000; // 5 saat

// Histogram bar oluşturucu
function makeBar(count, total) {
    const percent = total === 0 ? 0 : count / total;
    const filled = Math.round(percent * 12);
    return '█'.repeat(filled) + '░'.repeat(12 - filled);
}

// Live embed oluşturucu
function buildEmbed(participants, votes, endTime, ended = false) {
    const total = participants.reduce((sum, id) => sum + (votes.get(id) || 0), 0);
    const remainingMs = Math.max(0, endTime - Date.now());
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);

    if (ended) {
        let maxVotes = 0;
        for (const id of participants) {
            const v = votes.get(id) || 0;
            if (v > maxVotes) maxVotes = v;
        }

        const winners = participants.filter(id => (votes.get(id) || 0) === maxVotes && maxVotes > 0);

        const resultLines = participants
            .sort((a, b) => (votes.get(b) || 0) - (votes.get(a) || 0))
            .map(id => {
                const v = votes.get(id) || 0;
                const pct = total === 0 ? 0 : Math.round((v / total) * 100);
                return `<@${id}>\n\`${makeBar(v, total)}\` **${v}** votes (${pct}%)`;
            })
            .join('\n\n');

        const winnerText = winners.length > 1
            ? `🤝 TIE: ${winners.map(id => `<@${id}>`).join(' & ')}`
            : winners.length === 1
            ? `🏆 WINNER: <@${winners[0]}>`
            : '❌ No votes were cast.';

        return new EmbedBuilder()
            .setTitle('🏆 DRIVER OF THE SEASON — RESULTS')
            .setColor(0xFFD700)
            .setDescription(`**${winnerText}**\n\n${resultLines}`)
            .setFooter({ text: `Total votes: ${total} • Voting ended` });
    }

    const fields = participants.map(id => {
        const v = votes.get(id) || 0;
        const pct = total === 0 ? 0 : Math.round((v / total) * 100);
        return {
            name: `👤 <@${id}>`,
            value: `\`${makeBar(v, total)}\` **${v}** (${pct}%)`,
            inline: false
        };
    });

    return new EmbedBuilder()
        .setTitle('🏎️ DRIVER OF THE SEASON — VOTE')
        .setColor(0x1E90FF)
        .setDescription('**Vote for the best driver of the season!**\n⚠️ Each member has **1 vote only.**')
        .addFields(
            ...fields,
            { name: '\u200B', value: `⏱️ **Time remaining:** ${hours}h ${minutes}m ${seconds.toString().padStart(2, '0')}s`, inline: false },
            { name: '\u200B', value: `📊 **Total votes:** ${total}`, inline: false }
        );
}

// Button row oluşturucu
function buildRow(participants) {
    const rows = [];
    const chunks = [];

    // Discord max 5 button per row, 5 rows max → 25 button
    for (let i = 0; i < participants.length; i += 5) {
        chunks.push(participants.slice(i, i + 5));
    }

    for (const chunk of chunks) {
        const row = new ActionRowBuilder().addComponents(
            chunk.map(id =>
                new ButtonBuilder()
                    .setCustomId(`dots_${id}`)
                    .setLabel(`Vote`)
                    .setStyle(ButtonStyle.Primary)
            )
        );
        rows.push(row);
    }

    return rows;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dots')
        .setDescription('🏎️ Start Driver Of The Season vote')
        .addUserOption(o => o.setName('p1').setDescription('Driver 1').setRequired(true))
        .addUserOption(o => o.setName('p2').setDescription('Driver 2'))
        .addUserOption(o => o.setName('p3').setDescription('Driver 3'))
        .addUserOption(o => o.setName('p4').setDescription('Driver 4'))
        .addUserOption(o => o.setName('p5').setDescription('Driver 5'))
        .addUserOption(o => o.setName('p6').setDescription('Driver 6'))
        .addUserOption(o => o.setName('p7').setDescription('Driver 7'))
        .addUserOption(o => o.setName('p8').setDescription('Driver 8'))
        .addUserOption(o => o.setName('p9').setDescription('Driver 9'))
        .addUserOption(o => o.setName('p10').setDescription('Driver 10')),

    async execute(interaction) {
        await interaction.deferReply();

        const participants = [];
        for (let i = 1; i <= 10; i++) {
            const u = interaction.options.getUser(`p${i}`);
            if (u && !u.bot) participants.push(u.id);
        }

        if (participants.length < 2) {
            return interaction.editReply({ content: '❌ At least 2 participants required.' });
        }

        const endTime = Date.now() + VOTE_DURATION_MS;
        const votes = new Map();
        participants.forEach(id => votes.set(id, 0));

        const rows = buildRow(participants);

        const msg = await interaction.editReply({
            content: '@everyone 🗳️ **DRIVER OF THE SEASON** vote has started!',
            allowedMentions: { parse: ['everyone'] },
            embeds: [buildEmbed(participants, votes, endTime)],
            components: rows,
            fetchReply: true
        });

        const voteData = new SeasonVote({
            type: 'dots',
            messageId: msg.id,
            channelId: msg.channel.id,
            guildId: msg.guild.id,
            participants,
            endTime
        });

        await voteData.save();

        // Live embed güncelleme (her 15 sn)
        const interval = setInterval(async () => {
            try {
                const fresh = await SeasonVote.findOne({ messageId: msg.id });
                if (!fresh || fresh.finished) return clearInterval(interval);
                if (Date.now() >= fresh.endTime) return clearInterval(interval);

                await interaction.editReply({
                    embeds: [buildEmbed(fresh.participants, fresh.votes, fresh.endTime)]
                });
            } catch {
                clearInterval(interval);
            }
        }, 15000);
    }
};
