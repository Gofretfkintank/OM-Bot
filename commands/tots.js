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

function safeId(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
}

// participants = [{ id, name, color }]
function buildEmbed(participants, votes, endTime, ended = false) {
    const total = participants.reduce((sum, p) => sum + (votes.get(p.name) || 0), 0);
    const remainingMs = Math.max(0, endTime - Date.now());
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.floor((remainingMs % 3600000) / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);

    if (ended) {
        let maxVotes = 0;
        for (const p of participants) {
            const v = votes.get(p.name) || 0;
            if (v > maxVotes) maxVotes = v;
        }

        const winners = participants.filter(p => (votes.get(p.name) || 0) === maxVotes && maxVotes > 0);

        const resultLines = [...participants]
            .sort((a, b) => (votes.get(b.name) || 0) - (votes.get(a.name) || 0))
            .map(p => {
                const v = votes.get(p.name) || 0;
                const pct = total === 0 ? 0 : Math.round((v / total) * 100);
                return `🏎️ **${p.name}**\n\`${makeBar(v, total)}\` **${v}** votes (${pct}%)`;
            })
            .join('\n\n');

        const winnerText = winners.length > 1
            ? `🤝 TIE: ${winners.map(p => `**${p.name}**`).join(' & ')}`
            : winners.length === 1
            ? `🏆 WINNER: **${winners[0].name}**`
            : '❌ No votes were cast.';

        // Kazananın rengi yoksa altın
        const embedColor = winners.length === 1 && winners[0].color
            ? winners[0].color
            : 0xFFD700;

        return new EmbedBuilder()
            .setTitle('🏆 TEAM OF THE SEASON — RESULTS')
            .setColor(embedColor)
            .setDescription(`**${winnerText}**\n\n${resultLines}`)
            .setFooter({ text: `Total votes: ${total} • Voting ended` });
    }

    const fields = participants.map(p => {
        const v = votes.get(p.name) || 0;
        const pct = total === 0 ? 0 : Math.round((v / total) * 100);
        // Rol rengi varsa hex formatında göster
        const colorDot = p.color && p.color !== 0 ? `🔵` : `⚪`;
        return {
            name: `${colorDot} ${p.name}`,
            value: `\`${makeBar(v, total)}\` **${v}** (${pct}%)`,
            inline: false
        };
    });

    // Embed rengi: ilk takımın rengi, yoksa default turuncu
    const firstColor = participants.find(p => p.color && p.color !== 0)?.color || 0xFF4500;

    return new EmbedBuilder()
        .setTitle('🏆 TEAM OF THE SEASON — VOTE')
        .setColor(firstColor)
        .setDescription('**Vote for the best team of the season!**\n⚠️ Each member has **1 vote only.**')
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
                    .setCustomId(`tots_${safeId(p.name)}`)
                    .setLabel(p.name.substring(0, 80))
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
        .addRoleOption(o => o.setName('t1').setDescription('Team 1').setRequired(true))
        .addRoleOption(o => o.setName('t2').setDescription('Team 2').setRequired(true))
        .addRoleOption(o => o.setName('t3').setDescription('Team 3'))
        .addRoleOption(o => o.setName('t4').setDescription('Team 4'))
        .addRoleOption(o => o.setName('t5').setDescription('Team 5'))
        .addRoleOption(o => o.setName('t6').setDescription('Team 6'))
        .addRoleOption(o => o.setName('t7').setDescription('Team 7'))
        .addRoleOption(o => o.setName('t8').setDescription('Team 8'))
        .addRoleOption(o => o.setName('t9').setDescription('Team 9'))
        .addRoleOption(o => o.setName('t10').setDescription('Team 10')),

    async execute(interaction) {
        await interaction.deferReply();

        const participants = [];
        for (let i = 1; i <= 10; i++) {
            const role = interaction.options.getRole(`t${i}`);
            if (!role) continue;

            // Color: Discord rolle 0 döndürebilir (renksiz), bunu handle et
            const color = role.color !== 0 ? role.color : null;

            participants.push({
                name: role.name,
                color,
                roleId: role.id
            });
        }

        if (participants.length < 2) {
            return interaction.editReply({ content: '❌ At least 2 teams required.' });
        }

        // Duplicate kontrol
        const uniqueNames = [...new Set(participants.map(p => p.name))];
        if (uniqueNames.length !== participants.length) {
            return interaction.editReply({ content: '❌ Duplicate teams detected.' });
        }

        const endTime = Date.now() + VOTE_DURATION_MS;
        const votes = new Map();
        participants.forEach(p => votes.set(p.name, 0));

        const rows = buildRows(participants);

        const msg = await interaction.editReply({
            content: '@everyone 🗳️ **TEAM OF THE SEASON** vote has started!',
            allowedMentions: { parse: ['everyone'] },
            embeds: [buildEmbed(participants, votes, endTime)],
            components: rows,
            fetchReply: true
        });

        // MongoDB'ye isim olarak kaydet (schema uyumlu)
        const voteData = new SeasonVote({
            type: 'tots',
            messageId: msg.id,
            channelId: msg.channel.id,
            guildId: msg.guild.id,
            participants: participants.map(p => p.name),
            endTime
        });

        await voteData.save();

        // Live embed — msg.edit kullan (interaction token 15dk'da expire olur)
        const interval = setInterval(async () => {
            try {
                const fresh = await SeasonVote.findOne({ messageId: msg.id });
                if (!fresh || fresh.finished) return clearInterval(interval);
                if (Date.now() >= fresh.endTime) return clearInterval(interval);

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
