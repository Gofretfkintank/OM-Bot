const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const SeasonVote = require('../models/SeasonVote');

const VOTE_DURATION_MS = 5 * 60 * 60 * 1000; // 5 saat

function makeBar(count, total) {
    const percent = total === 0 ? 0 : count / total;
    const filled = Math.round(percent * 12);
    return '█'.repeat(filled) + '░'.repeat(12 - filled);
}

function buildEmbed(participants, votes, endTime, ended = false) {
    // participants = [{ id, username }]
    const total = participants.reduce((sum, p) => sum + (votes.get(p.id) || 0), 0);
    const remainingMs = Math.max(0, endTime - Date.now());
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);

    if (ended) {
        let maxVotes = 0;
        for (const p of participants) {
            const v = votes.get(p.id) || 0;
            if (v > maxVotes) maxVotes = v;
        }

        const winners = participants.filter(p => (votes.get(p.id) || 0) === maxVotes && maxVotes > 0);

        const resultLines = [...participants]
            .sort((a, b) => (votes.get(b.id) || 0) - (votes.get(a.id) || 0))
            .map(p => {
                const v = votes.get(p.id) || 0;
                const pct = total === 0 ? 0 : Math.round((v / total) * 100);
                return `<@${p.id}>\n\`${makeBar(v, total)}\` **${v}** votes (${pct}%)`;
            })
            .join('\n\n');

        const winnerText = winners.length > 1
            ? `🤝 TIE: ${winners.map(p => `<@${p.id}>`).join(' & ')}`
            : winners.length === 1
            ? `🏆 WINNER: <@${winners[0].id}>`
            : '❌ No votes were cast.';

        return new EmbedBuilder()
            .setTitle('🏆 DRIVER OF THE SEASON — RESULTS')
            .setColor(0xFFD700)
            .setDescription(`**${winnerText}**\n\n${resultLines}`)
            .setFooter({ text: `Total votes: ${total} • Voting ended` });
    }

    const fields = participants.map(p => {
        const v = votes.get(p.id) || 0;
        const pct = total === 0 ? 0 : Math.round((v / total) * 100);
        return {
            name: `👤 ${p.username}`,
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

function buildRows(participants) {
    const rows = [];
    const chunks = [];

    for (let i = 0; i < participants.length; i += 5) {
        chunks.push(participants.slice(i, i + 5));
    }

    for (const chunk of chunks) {
        const row = new ActionRowBuilder().addComponents(
            chunk.map(p =>
                new ButtonBuilder()
                    .setCustomId(`dots_${p.id}`)
                    .setLabel(p.username.substring(0, 80) || 'Driver')
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
            if (u && !u.bot) participants.push({ id: u.id, username: u.username });
        }

        if (participants.length < 2) {
            return interaction.editReply({ content: '❌ At least 2 participants required.' });
        }

        // Duplicate check
        const uniqueIds = [...new Set(participants.map(p => p.id))];
        if (uniqueIds.length !== participants.length) {
            return interaction.editReply({ content: '❌ Duplicate participants detected.' });
        }

        const endTime = Date.now() + VOTE_DURATION_MS;
        const votes = new Map();
        participants.forEach(p => votes.set(p.id, 0));

        const rows = buildRows(participants);

        const msg = await interaction.editReply({
            content: '@everyone 🗳️ **DRIVER OF THE SEASON** vote has started!',
            allowedMentions: { parse: ['everyone'] },
            embeds: [buildEmbed(participants, votes, endTime)],
            components: rows,
            fetchReply: true
        });

        // MongoDB'ye participants'ı sadece ID olarak kaydet (mevcut schema uyumlu)
        const voteData = new SeasonVote({
            type: 'dots',
            messageId: msg.id,
            channelId: msg.channel.id,
            guildId: msg.guild.id,
            participants: participants.map(p => p.id),
            endTime
        });

        await voteData.save();

        // Live embed güncelleme — msg.edit kullan, interaction token 15dk'da expire olur
        const interval = setInterval(async () => {
            try {
                const fresh = await SeasonVote.findOne({ messageId: msg.id });
                if (!fresh || fresh.finished) return clearInterval(interval);
                if (Date.now() >= fresh.endTime) return clearInterval(interval);

                // participants objesini koruyoruz (username için)
                await msg.edit({
                    embeds: [buildEmbed(participants, fresh.votes, fresh.endTime)],
                    components: rows
                });
            } catch {
                clearInterval(interval);
            }
        }, 15000);
    }
};
