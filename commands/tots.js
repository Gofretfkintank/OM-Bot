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

// Takım ismini customId için güvenli hale getir (boşluk/özel karakter yok)
function safeId(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
}

// Live embed oluşturucu
function buildEmbed(participants, votes, endTime, ended = false) {
    const total = participants.reduce((sum, name) => sum + (votes.get(name) || 0), 0);
    const remainingMs = Math.max(0, endTime - Date.now());
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);

    if (ended) {
        let maxVotes = 0;
        for (const name of participants) {
            const v = votes.get(name) || 0;
            if (v > maxVotes) maxVotes = v;
        }

        const winners = participants.filter(name => (votes.get(name) || 0) === maxVotes && maxVotes > 0);

        const resultLines = participants
            .sort((a, b) => (votes.get(b) || 0) - (votes.get(a) || 0))
            .map(name => {
                const v = votes.get(name) || 0;
                const pct = total === 0 ? 0 : Math.round((v / total) * 100);
                return `🏎️ **${name}**\n\`${makeBar(v, total)}\` **${v}** votes (${pct}%)`;
            })
            .join('\n\n');

        const winnerText = winners.length > 1
            ? `🤝 TIE: ${winners.join(' & ')}`
            : winners.length === 1
            ? `🏆 WINNER: ${winners[0]}`
            : '❌ No votes were cast.';

        return new EmbedBuilder()
            .setTitle('🏆 TEAM OF THE SEASON — RESULTS')
            .setColor(0xFFD700)
            .setDescription(`**${winnerText}**\n\n${resultLines}`)
            .setFooter({ text: `Total votes: ${total} • Voting ended` });
    }

    const fields = participants.map(name => {
        const v = votes.get(name) || 0;
        const pct = total === 0 ? 0 : Math.round((v / total) * 100);
        return {
            name: `🏎️ ${name}`,
            value: `\`${makeBar(v, total)}\` **${v}** (${pct}%)`,
            inline: false
        };
    });

    return new EmbedBuilder()
        .setTitle('🏆 TEAM OF THE SEASON — VOTE')
        .setColor(0xFF4500)
        .setDescription('**Vote for the best team of the season!**\n⚠️ Each member has **1 vote only.**')
        .addFields(
            ...fields,
            { name: '\u200B', value: `⏱️ **Time remaining:** ${hours}h ${minutes}m ${seconds.toString().padStart(2, '0')}s`, inline: false },
            { name: '\u200B', value: `📊 **Total votes:** ${total}`, inline: false }
        );
}

// Button row oluşturucu
function buildRows(participants) {
    const rows = [];
    const chunks = [];

    for (let i = 0; i < participants.length; i += 5) {
        chunks.push(participants.slice(i, i + 5));
    }

    for (const chunk of chunks) {
        const row = new ActionRowBuilder().addComponents(
            chunk.map(name =>
                new ButtonBuilder()
                    .setCustomId(`tots_${safeId(name)}`)
                    .setLabel(name.substring(0, 80))
                    .setStyle(ButtonStyle.Danger)
            )
        );
        rows.push(row);
    }

    return rows;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tots')
        .setDescription('🏆 Start Team Of The Season vote')
        .addStringOption(o => o.setName('t1').setDescription('Team 1').setRequired(true))
        .addStringOption(o => o.setName('t2').setDescription('Team 2').setRequired(true))
        .addStringOption(o => o.setName('t3').setDescription('Team 3'))
        .addStringOption(o => o.setName('t4').setDescription('Team 4'))
        .addStringOption(o => o.setName('t5').setDescription('Team 5'))
        .addStringOption(o => o.setName('t6').setDescription('Team 6'))
        .addStringOption(o => o.setName('t7').setDescription('Team 7'))
        .addStringOption(o => o.setName('t8').setDescription('Team 8'))
        .addStringOption(o => o.setName('t9').setDescription('Team 9'))
        .addStringOption(o => o.setName('t10').setDescription('Team 10')),

    async execute(interaction) {
        await interaction.deferReply();

        const participants = [];
        for (let i = 1; i <= 10; i++) {
            const t = interaction.options.getString(`t${i}`);
            if (t && t.trim()) participants.push(t.trim());
        }

        if (participants.length < 2) {
            return interaction.editReply({ content: '❌ At least 2 teams required.' });
        }

        // Duplicate team ismi kontrolü
        const uniqueParticipants = [...new Set(participants)];
        if (uniqueParticipants.length !== participants.length) {
            return interaction.editReply({ content: '❌ Duplicate team names detected.' });
        }

        const endTime = Date.now() + VOTE_DURATION_MS;
        const votes = new Map();
        participants.forEach(name => votes.set(name, 0));

        const rows = buildRows(participants);

        const msg = await interaction.editReply({
            content: '@everyone 🗳️ **TEAM OF THE SEASON** vote has started!',
            allowedMentions: { parse: ['everyone'] },
            embeds: [buildEmbed(participants, votes, endTime)],
            components: rows,
            fetchReply: true
        });

        const voteData = new SeasonVote({
            type: 'tots',
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
