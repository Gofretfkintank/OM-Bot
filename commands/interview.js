// commands/interview.js
// Post-Race Interview System
// ─────────────────────────────────────────────────────────────────────────────
// /interview start → Admin enters up to 10 drivers.
//                    If < 5 provided  → all of them are selected for interview.
//                    If 5+ provided   → bot fairly picks exactly 5, then
//                                       weighted-randomly picks 1 to interview.
//                    Selected driver gets a channel ping + button.
//                    Driver clicks → modal opens (3 questions).
//                    Answers published in channel (clean embed, no flag hint).
//                    35% chance: "leaked" format re-post.
//                    Profanity detected → report channel notified (admins only).
//                                       → driver gets ephemeral warning (private).
//                    15 min timeout → Media Silence Fine (-150 coins).
// ─────────────────────────────────────────────────────────────────────────────

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
} = require('discord.js');

const Economy   = require('../models/Economy');
const Interview = require('../models/Interview');

// ── Constants ────────────────────────────────────────────────────────────────
const MEDIA_SILENCE_FINE = 150;
const LEAK_CHANCE        = 0.35;
const TIMEOUT_MS         = 15 * 60_000;
const POOL_PICK_COUNT    = 5;   // How many candidates bot narrows to before final pick
const MIN_POOL_THRESHOLD = 5;   // If fewer than this are entered, use all of them

// ── Profanity Patterns (Turkish + English) ───────────────────────────────────
const PROFANITY_PATTERNS = [
    /\bam[ıi]na\b/i,
    /\borospu\b/i,
    /\bsikiş/i,
    /\bsikiy/i,
    /\bsiktin\b/i,
    /\bpiç\b/i,
    /\boç\b/i,
    /\bgötün[eü]\b/i,
    /\bgot[uü]n[eü]\b/i,
    /\bbocum\b/i,
    /\bbok yemek\b/i,
    /\bf+u+c+k\b/i,
    /\bsh[i1]t\b/i,
    /\ba+s+h+o+l+e\b/i,
    /\bb+i+t+c+h\b/i,
    /\bc+u+n+t\b/i,
    /\bn[i1]+g+[e3]+r\b/i,
];

// ── Question Pool (25 questions, 3 picked randomly) ──────────────────────────
const QUESTION_POOL = [
    'How did you feel out there today? Walk us through your race mentally.',
    'What was the biggest challenge you faced on track?',
    'Was there a moment where you thought the result could\'ve gone differently?',
    'Tell us about that battle in the midfield — what was going through your mind?',
    'How would you rate your own performance today, honestly?',
    'What\'s the first thing you\'ll do when you get back to the garage?',
    'The team gave you a strategy call that divided opinion — do you agree with it now?',
    'If you could change one decision from today\'s race, what would it be?',
    'The crowd was loud out there. Did you feel the energy from the cockpit?',
    'How did the car feel compared to practice? Any surprises?',
    'There were some controversial moments today. How do you see it from inside the car?',
    'Championship picture is getting tight. How do you keep your head clear?',
    'Your engineer said something over the radio that caught attention. Can you explain?',
    'Did you push the car to its absolute limit today, or did you manage?',
    'Some people online are saying you drove defensively. Your response?',
    'How\'s the relationship with your team right now after today?',
    'Was the result fair, in your eyes?',
    'What message do you have for the fans watching today?',
    'Did you have any tire concerns that the team didn\'t act on?',
    'There\'s talk of a penalty review. Are you worried?',
    'How does this result affect your mindset going into the next round?',
    'Your rival had a strong race today. Are you taking notes?',
    'Be honest — was luck involved in today\'s result, one way or another?',
    'What do you wish the people at home understood about racing that they don\'t?',
    'Final word — what\'s the headline you want people to remember from today?',
];

// ── Helper: pick 3 random questions ─────────────────────────────────────────
function pickQuestions() {
    const pool   = [...QUESTION_POOL];
    const picked = [];
    for (let i = 0; i < 3; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
}

// ── Helper: weighted fair pick (single winner from pool) ────────────────────
// Drivers selected fewer times in the last 30 days get a higher weight.
async function fairPick(userIds) {
    if (userIds.length === 1) return userIds[0];

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const counts = await Promise.all(
        userIds.map(id =>
            Interview.countDocuments({ userId: id, createdAt: { $gte: since } })
        )
    );

    const weights = counts.map(c => 1 / (c + 1));
    const total   = weights.reduce((a, b) => a + b, 0);

    let rand = Math.random() * total;
    for (let i = 0; i < userIds.length; i++) {
        rand -= weights[i];
        if (rand <= 0) return userIds[i];
    }
    return userIds[userIds.length - 1];
}

// ── Helper: narrow candidate pool to POOL_PICK_COUNT using fair weights ──────
// Used when admin enters 5+ drivers — bot first narrows to 5, then picks 1.
async function narrowPool(userIds, targetCount) {
    if (userIds.length <= targetCount) return userIds;

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const counts = await Promise.all(
        userIds.map(id =>
            Interview.countDocuments({ userId: id, createdAt: { $gte: since } })
        )
    );

    // Build weighted pool and pick `targetCount` without replacement
    const remaining = userIds.map((id, i) => ({ id, weight: 1 / (counts[i] + 1) }));
    const chosen    = [];

    for (let n = 0; n < targetCount; n++) {
        const total = remaining.reduce((a, b) => a + b.weight, 0);
        let rand    = Math.random() * total;
        for (let i = 0; i < remaining.length; i++) {
            rand -= remaining[i].weight;
            if (rand <= 0) {
                chosen.push(remaining[i].id);
                remaining.splice(i, 1);
                break;
            }
        }
    }

    return chosen;
}

// ── Helper: check for profanity, return matching sentences ──────────────────
function findProfanitySentences(text) {
    // Split on sentence-ending punctuation or newlines
    const sentences = text
        .split(/(?<=[.!?\n])\s+|\n/)
        .map(s => s.trim())
        .filter(Boolean);

    return sentences.filter(sentence =>
        PROFANITY_PATTERNS.some(p => p.test(sentence))
    );
}

function containsProfanity(text) {
    return PROFANITY_PATTERNS.some(p => p.test(text));
}

// ── Helper: unique session ID ────────────────────────────────────────────────
function makeSessionId() {
    return `omiv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Timeout checker (called from index.js every 60s) ────────────────────────
async function checkExpiredInterviews(client) {
    try {
        const expired = await Interview.find({
            status:    'pending',
            expiresAt: { $lte: new Date() },
        });

        for (const session of expired) {
            session.status = 'fined';
            await session.save();

            // Deduct coins
            let wallet = await Economy.findOne({ userId: session.userId });
            if (!wallet) wallet = new Economy({ userId: session.userId });
            await wallet.removeCoins(MEDIA_SILENCE_FINE);

            // Announce in channel
            try {
                const channel = await client.channels.fetch(session.channelId).catch(() => null);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🚨 MEDIA SILENCE FINE')
                        .setDescription(
                            `<@${session.userId}> failed to appear for the post-race interview at **${session.trackName}**.\n\n` +
                            `**Fine issued:** \`-${MEDIA_SILENCE_FINE} 🪙\`\n` +
                            `*Repeated offenses will increase the fine. Don't dodge the mic.*`
                        )
                        .setFooter({ text: 'OM Media Obligations System' })
                        .setTimestamp();

                    await channel.send({ embeds: [embed] });

                    // Disable the button on the original message
                    if (session.messageId) {
                        const msg = await channel.messages.fetch(session.messageId).catch(() => null);
                        if (msg) await msg.edit({ components: [] }).catch(() => {});
                    }
                }
            } catch (err) {
                console.error('[Interview] Timeout channel error:', err);
            }
        }
    } catch (err) {
        console.error('[Interview] Timeout check error:', err);
    }
}

// ── Button handler (registered in index.js interactionCreate) ────────────────
async function buttonHandler(interaction) {
    if (!interaction.customId.startsWith('interview_start_')) return;

    const sessionId = interaction.customId.replace('interview_start_', '');
    const session   = await Interview.findOne({ sessionId });

    if (!session) {
        return interaction.reply({ content: '❌ Interview session not found.', ephemeral: true });
    }
    if (session.status !== 'pending') {
        return interaction.reply({ content: '❌ This interview has already been completed or expired.', ephemeral: true });
    }
    if (interaction.user.id !== session.userId) {
        return interaction.reply({ content: '❌ This interview is not for you.', ephemeral: true });
    }

    // Build modal
    const modal = new ModalBuilder()
        .setCustomId(`interview_modal_${sessionId}`)
        .setTitle(`🎤 Post-Race Interview — ${session.trackName}`);

    const inputs = session.questions.map((q, i) =>
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(`answer_${i}`)
                .setLabel(q.length > 45 ? q.slice(0, 42) + '...' : q)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Type your answer here...')
                .setRequired(true)
                .setMaxLength(500)
        )
    );

    modal.addComponents(...inputs);
    await interaction.showModal(modal);
}

// ── Modal submit handler ──────────────────────────────────────────────────────
async function modalHandler(interaction) {
    if (!interaction.customId.startsWith('interview_modal_')) return;

    await interaction.deferReply({ ephemeral: true });

    const sessionId = interaction.customId.replace('interview_modal_', '');
    const session   = await Interview.findOne({ sessionId });

    if (!session || session.status !== 'pending') {
        return interaction.editReply({ content: '❌ Session not found or already completed.' });
    }

    // Guild may be null if modal was submitted from a DM — fetch via client
    const guild = interaction.guild
        || await interaction.client.guilds.fetch(session.guildId).catch(() => null);

    if (!guild) {
        return interaction.editReply({ content: '❌ Could not resolve server. Please contact an admin.' });
    }

    // Collect answers
    const answers = session.questions.map((_, i) =>
        interaction.fields.getTextInputValue(`answer_${i}`)
    );

    session.answers = answers;
    session.status  = 'done';
    await session.save();

    // ── Profanity check ──────────────────────────────────────────────────────
    const allText      = answers.join(' ');
    const hasProfanity = containsProfanity(allText);

    if (hasProfanity) {
        session.flagged = true;
        await session.save();

        // ── Send to report channel (admins only) ──────────────────────────
        try {
            const reportChannelId = process.env.REPORT_LOG_ID;
            const reportChannel   = reportChannelId
                ? (guild.channels.cache.get(reportChannelId)
                    || await guild.channels.fetch(reportChannelId).catch(() => null))
                : null;

            if (reportChannel) {
                // Mark which Q&A contains profanity
                const flaggedFields = session.questions.map((q, i) => {
                    const answer      = answers[i] || '—';
                    const isFlagged   = containsProfanity(answer);
                    return {
                        name:  `Q${i + 1}${isFlagged ? ' 🚩 FLAGGED' : ''}: ${q.slice(0, 50)}`,
                        value: answer,
                    };
                });

                const reportEmbed = new EmbedBuilder()
                    .setColor(0xFF4400)
                    .setTitle('🚩 Interview Flagged — Inappropriate Language')
                    .addFields(
                        { name: 'Driver',     value: `<@${session.userId}>`, inline: true },
                        { name: 'Track',      value: session.trackName,       inline: true },
                        { name: 'Session ID', value: sessionId,               inline: true },
                        ...flaggedFields
                    )
                    .setFooter({ text: 'Automated profanity detection • OM Bot' })
                    .setTimestamp();

                await reportChannel.send({ embeds: [reportEmbed] });
            } else {
                console.error('[Interview] Report channel not found. REPORT_LOG_ID:', reportChannelId);
            }
        } catch (err) {
            console.error('[Interview] Report channel error:', err);
        }

        // ── Private warning to the driver (ephemeral, only they see it) ──
        // Tell them which sentences triggered the flag, without leaking
        // that it was visible to anyone else in the public channel.
        const flaggedSentences = answers.flatMap((ans, i) => {
            const hits = findProfanitySentences(ans);
            return hits.map(s => `**Q${i + 1}:** "${s}"`);
        });

        const warningLines = [
            '⚠️ **Official Warning — FIA Media Conduct Regulation**',
            '',
            'Your post-race interview has been flagged for the use of inappropriate language.',
            'The following statement(s) triggered this review:',
            '',
            ...flaggedSentences.map(s => `> ${s}`),
            '',
            'This incident has been forwarded to the FIA Stewards for review.',
            'Further violations may result in an **official FIA fine or sporting penalty**.',
            '',
            '*This notice is confidential and visible only to you.*',
        ];

        await interaction.followUp({
            content:   warningLines.join('\n'),
            ephemeral: true,
        });
    }

    // ── Disable button on original announcement message ──────────────────────
    try {
        const ch = guild.channels.cache.get(session.channelId)
            || await guild.channels.fetch(session.channelId).catch(() => null);
        if (ch && session.messageId) {
            const msg = await ch.messages.fetch(session.messageId).catch(() => null);
            if (msg) await msg.edit({ components: [] }).catch(() => {});
        }
    } catch (err) {
        console.error('[Interview] Button disable error:', err);
    }

    // ── Publish answers to channel (clean — no flag indicator visible) ────────
    const channel = guild.channels.cache.get(session.channelId)
        || await guild.channels.fetch(session.channelId).catch(() => null);

    if (channel) {
        const responseEmbed = new EmbedBuilder()
            .setColor(0x1DB954)
            .setTitle(`🎤 Post-Race Interview — ${session.trackName}`)
            .setDescription(`An anonymous driver is at the microphone.`)
            .addFields(
                ...session.questions.map((q, i) => ({
                    name:  `❓ ${q}`,
                    value: answers[i] || '—',
                }))
            )
            .setFooter({ text: 'OM Media Obligations System' })
            .setTimestamp();

        await channel.send({ embeds: [responseEmbed] });

        // ── Leak (35% chance) ─────────────────────────────────────────────
        if (Math.random() < LEAK_CHANCE) {
            session.leaked = true;
            await session.save();

            const delay      = Math.floor(Math.random() * 20_000) + 10_000;
            const leakIndex  = Math.floor(Math.random() * answers.length);

            setTimeout(async () => {
                try {
                    const leakEmbed = new EmbedBuilder()
                        .setColor(0xFFCC00)
                        .setTitle('📡 LEAKED — Paddock Source')
                        .setDescription(
                            `*"Our paddock correspondent has obtained a clip from today's interview..."*\n\n` +
                            `**Q: ${session.questions[leakIndex]}**\n> ${answers[leakIndex]}\n\n` +
                            `*— Source: Anonymous paddock insider 👀*`
                        )
                        .setFooter({ text: `Regarding: ${session.trackName} • Leaked by an unnamed source` })
                        .setTimestamp();

                    await channel.send({ embeds: [leakEmbed] });
                } catch (err) {
                    console.error('[Interview] Leak error:', err);
                }
            }, delay);
        }
    }

    await interaction.editReply({ content: '✅ Your interview has been submitted. Thank you.' });
}

// ── Slash Command ────────────────────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('interview')
        .setDescription('Post-race interview system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName('start')
                .setDescription('Enter up to 10 drivers — bot picks 5 candidates, then fairly selects 1')
                .addStringOption(opt =>
                    opt.setName('track')
                        .setDescription('Track name (e.g. Monaco)')
                        .setRequired(true)
                )
                .addUserOption(opt => opt.setName('driver1').setDescription('Candidate driver 1').setRequired(true))
                .addUserOption(opt => opt.setName('driver2').setDescription('Candidate driver 2'))
                .addUserOption(opt => opt.setName('driver3').setDescription('Candidate driver 3'))
                .addUserOption(opt => opt.setName('driver4').setDescription('Candidate driver 4'))
                .addUserOption(opt => opt.setName('driver5').setDescription('Candidate driver 5'))
                .addUserOption(opt => opt.setName('driver6').setDescription('Candidate driver 6'))
                .addUserOption(opt => opt.setName('driver7').setDescription('Candidate driver 7'))
                .addUserOption(opt => opt.setName('driver8').setDescription('Candidate driver 8'))
                .addUserOption(opt => opt.setName('driver9').setDescription('Candidate driver 9'))
                .addUserOption(opt => opt.setName('driver10').setDescription('Candidate driver 10'))
        ),

    buttonHandler,
    modalHandler,
    checkExpiredInterviews,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'start') {
            await interaction.deferReply();

            const track = interaction.options.getString('track');

            // Collect all provided driver IDs
            const allCandidates = [];
            for (let i = 1; i <= 10; i++) {
                const user = interaction.options.getUser(`driver${i}`);
                if (user && !user.bot) allCandidates.push(user.id);
            }

            if (allCandidates.length === 0) {
                return interaction.editReply({ content: '❌ Please provide at least one driver.' });
            }

            // Determine final candidate pool:
            // < MIN_POOL_THRESHOLD entered → use all of them
            // ≥ MIN_POOL_THRESHOLD entered → narrow to POOL_PICK_COUNT fairly
            let pool;
            if (allCandidates.length < MIN_POOL_THRESHOLD) {
                pool = allCandidates;
            } else {
                pool = await narrowPool(allCandidates, POOL_PICK_COUNT);
            }

            // Weighted fair pick of final interviewee
            const chosenId   = await fairPick(pool);
            const chosenUser = await interaction.guild.members.fetch(chosenId).catch(() => null);

            if (!chosenUser) {
                return interaction.editReply({ content: '❌ Could not fetch the selected driver. Are they still in the server?' });
            }

            const questions = pickQuestions();
            const sessionId = makeSessionId();

            const session = await Interview.create({
                sessionId,
                trackName: track,
                userId:    chosenId,
                questions,
                channelId: interaction.channelId,
                guildId:   interaction.guildId,
                expiresAt: new Date(Date.now() + TIMEOUT_MS),
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`interview_start_${sessionId}`)
                    .setLabel('🎤 Start Interview')
                    .setStyle(ButtonStyle.Primary)
            );

            // ── DM the selected driver with the button (keeps identity private) ──
            const dmEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🎤 Post-Race Interview — ${track.toUpperCase()}`)
                .setDescription(
                    `The media wants a word with you.\n\n` +
                    `You have been selected for the post-race interview at **${track}**.\n` +
                    `Click the button below to begin. You have **15 minutes** to respond.\n\n` +
                    `*Ignoring this interview will result in a **Media Silence Fine** of \`${MEDIA_SILENCE_FINE} 🪙\`.*`
                )
                .setFooter({ text: 'OM Media Obligations System • Brought to you by OM Bot' })
                .setTimestamp();

            let dmSent = false;
            try {
                const dmMsg = await chosenUser.send({
                    embeds:     [dmEmbed],
                    components: [row],
                });
                session.messageId = dmMsg.id;
                dmSent = true;
            } catch {
                // DMs closed — fall back to channel ping (unavoidable identity reveal)
                dmSent = false;
            }

            // ── Public channel: anonymous announcement ────────────────────────
            const publicEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🎤 Post-Race Interview — ${track.toUpperCase()}`)
                .setDescription(
                    dmSent
                        ? `A driver has been selected for the post-race interview at **${track}**.\n*The selected driver has been contacted via DM — they have **15 minutes** to respond.*`
                        : `<@${chosenId}>, the media wants a word with you.\n\nClick the button below to begin. You have **15 minutes** to respond.\n\n*Ignoring this interview will result in a **Media Silence Fine** of \`${MEDIA_SILENCE_FINE} 🪙\`.*`
                )
                .setFooter({ text: 'OM Media Obligations System • Brought to you by OM Bot' })
                .setTimestamp();

            const sentMsg = await interaction.editReply({
                embeds:     [publicEmbed],
                components: dmSent ? [] : [row],
            });

            if (!dmSent) {
                session.messageId = sentMsg.id;
            }
            await session.save();
        }
    },
};
