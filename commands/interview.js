// commands/interview.js
// Post-Race Interview System
// ─────────────────────────────────────────────────────────────────────────────
// /interview-start → Admin birden fazla pilot girer, bot ağırlıklı random
//                    seçer. Seçilen pilota kanalda ping + buton gönderilir.
//                    Pilota tıklar → modal açılır (3 soru).
//                    Yanıtlar kanalda yayınlanır.
//                    %35 şans: "sızdı" formatında tekrar paylaşılır.
//                    Argo tespit → report kanalına otomatik bildirim.
//                    15 dk timeout → Media Silence Fine (coin cezası).
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

const Economy  = require('../models/Economy');
const Interview = require('../models/Interview');

// ── Sabitler ────────────────────────────────────────────────────────────────
const MEDIA_SILENCE_FINE  = 150;          // Coin cezası
const LEAK_CHANCE         = 0.35;         // %35 sızma şansı
const TIMEOUT_MS          = 15 * 60_000; // 15 dakika

// ── Küfür / Argo Listesi ────────────────────────────────────────────────────
// Türkçe ve İngilizce yaygın aşırı argo — genişletilebilir
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
];

// ── Soru Havuzu (25 soru, random 3 çekilir) ─────────────────────────────────
const QUESTION_POOL = [
    "How did you feel out there today? Walk us through your race mentally.",
    "What was the biggest challenge you faced on track?",
    "Was there a moment where you thought the result could've gone differently?",
    "Tell us about that battle in the midfield — what was going through your mind?",
    "How would you rate your own performance today, honestly?",
    "What's the first thing you'll do when you get back to the garage?",
    "The team gave you a strategy call that divided opinion — do you agree with it now?",
    "If you could change one decision from today's race, what would it be?",
    "The crowd was loud out there. Did you feel the energy from the cockpit?",
    "How did the car feel compared to practice? Any surprises?",
    "There were some controversial moments today. How do you see it from inside the car?",
    "Championship picture is getting tight. How do you keep your head clear?",
    "Your engineer said something over the radio that caught attention. Can you explain?",
    "Did you push the car to its absolute limit today, or did you manage?",
    "Some people online are saying you drove defensively. Your response?",
    "How's the relationship with your team right now after today?",
    "Was the result fair, in your eyes?",
    "What message do you have for the fans watching today?",
    "Did you have any tire concerns that the team didn't act on?",
    "There's talk of a penalty review. Are you worried?",
    "How does this result affect your mindset going into the next round?",
    "Your rival had a strong race today. Are you taking notes?",
    "Be honest — was luck involved in today's result, one way or another?",
    "What do you wish the people at home understood about racing that they don't?",
    "Final word — what's the headline you want people to remember from today?",
];

// ── Yardımcı: 3 random soru çek ─────────────────────────────────────────────
function pickQuestions() {
    const pool = [...QUESTION_POOL];
    const picked = [];
    for (let i = 0; i < 3; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
}

// ── Yardımcı: Ağırlıklı fair seçim ─────────────────────────────────────────
// Son 30 günde kaç röportaj seçildi bakarak ağırlık hesaplar.
// Az seçilen pilotun şansı artar.
async function fairPick(userIds) {
    if (userIds.length === 1) return userIds[0];

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Her pilot için son 30 günde kaç kez seçilmiş
    const counts = await Promise.all(
        userIds.map(id =>
            Interview.countDocuments({ userId: id, createdAt: { $gte: since } })
        )
    );

    // Ağırlık = 1 / (count + 1) → az seçilen daha yüksek ağırlık
    const weights = counts.map(c => 1 / (c + 1));
    const total   = weights.reduce((a, b) => a + b, 0);

    let rand = Math.random() * total;
    for (let i = 0; i < userIds.length; i++) {
        rand -= weights[i];
        if (rand <= 0) return userIds[i];
    }
    return userIds[userIds.length - 1];
}

// ── Yardımcı: Argo kontrol ──────────────────────────────────────────────────
function containsProfanity(text) {
    return PROFANITY_PATTERNS.some(p => p.test(text));
}

// ── Yardımcı: Unique session ID ─────────────────────────────────────────────
function makeSessionId() {
    return `omiv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Timeout loop (index.js'den çağrılır) ─────────────────────────────────────
// Bu fonksiyon index.js'de setInterval ile her 60 sn çalıştırılır.
async function checkExpiredInterviews(client) {
    try {
        const expired = await Interview.find({
            status: 'pending',
            expiresAt: { $lte: new Date() }
        });

        for (const session of expired) {
            session.status = 'fined';
            await session.save();

            // Coin cezası
            let wallet = await Economy.findOne({ userId: session.userId });
            if (!wallet) wallet = new Economy({ userId: session.userId });
            await wallet.removeCoins(MEDIA_SILENCE_FINE);

            // Kanalda duyur
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

                    // Eski butonlu mesajı düzenle (buton kapat)
                    if (session.messageId) {
                        const msg = await channel.messages.fetch(session.messageId).catch(() => null);
                        if (msg) {
                            await msg.edit({ components: [] }).catch(() => {});
                        }
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

// ── Buton handler (index.js interactionCreate'e eklenir) ─────────────────────
async function buttonHandler(interaction) {
    // customId: interview_start_<sessionId>
    if (!interaction.customId.startsWith('interview_start_')) return;

    const sessionId = interaction.customId.replace('interview_start_', '');

    const session = await Interview.findOne({ sessionId });
    if (!session) {
        return interaction.reply({ content: '❌ Interview session not found.', ephemeral: true });
    }
    if (session.status !== 'pending') {
        return interaction.reply({ content: '❌ This interview has already been completed or expired.', ephemeral: true });
    }
    if (interaction.user.id !== session.userId) {
        return interaction.reply({ content: '❌ This interview is not for you.', ephemeral: true });
    }

    // Modal oluştur
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
    // customId: interview_modal_<sessionId>
    if (!interaction.customId.startsWith('interview_modal_')) return;

    await interaction.deferReply({ ephemeral: true });

    const sessionId = interaction.customId.replace('interview_modal_', '');
    const session   = await Interview.findOne({ sessionId });

    if (!session || session.status !== 'pending') {
        return interaction.editReply({ content: '❌ Session not found or already completed.' });
    }

    // Yanıtları topla
    const answers = session.questions.map((_, i) =>
        interaction.fields.getTextInputValue(`answer_${i}`)
    );

    session.answers  = answers;
    session.status   = 'done';
    await session.save();

    // Argo kontrol
    const allText      = answers.join(' ');
    const hasProfanity = containsProfanity(allText);

    if (hasProfanity) {
        session.flagged = true;
        await session.save();

        // Report kanalına gönder
        try {
            const reportChannelId = process.env.REPORT_LOG_ID;
            const reportChannel   = interaction.guild.channels.cache.get(reportChannelId);
            if (reportChannel) {
                const flagEmbed = new EmbedBuilder()
                    .setColor(0xFF4400)
                    .setTitle('🚩 Interview Flagged — Inappropriate Language')
                    .addFields(
                        { name: 'Driver', value: `<@${session.userId}>`, inline: true },
                        { name: 'Track', value: session.trackName, inline: true },
                        { name: 'Session ID', value: sessionId, inline: true },
                        ...session.questions.map((q, i) => ({
                            name: `Q${i + 1}: ${q.slice(0, 50)}`,
                            value: answers[i] || '—',
                        }))
                    )
                    .setFooter({ text: 'Automated profanity detection • OM Bot' })
                    .setTimestamp();

                await reportChannel.send({ embeds: [flagEmbed] });
            }
        } catch (err) {
            console.error('[Interview] Report channel error:', err);
        }
    }

    // Butonlu mesajı düzenle (buton kapat)
    try {
        const channel = interaction.guild.channels.cache.get(session.channelId)
            || await interaction.guild.channels.fetch(session.channelId).catch(() => null);

        if (channel && session.messageId) {
            const msg = await channel.messages.fetch(session.messageId).catch(() => null);
            if (msg) await msg.edit({ components: [] }).catch(() => {});
        }
    } catch (err) {
        console.error('[Interview] Button disable error:', err);
    }

    // Yanıtları kanalda yayınla
    const channel = interaction.guild.channels.cache.get(session.channelId)
        || await interaction.guild.channels.fetch(session.channelId).catch(() => null);

    if (channel) {
        const responseEmbed = new EmbedBuilder()
            .setColor(hasProfanity ? 0xFF6600 : 0x1DB954)
            .setTitle(`🎤 Post-Race Interview — ${session.trackName}`)
            .setDescription(`<@${session.userId}> is at the microphone.`)
            .addFields(
                ...session.questions.map((q, i) => ({
                    name: `❓ ${q}`,
                    value: answers[i] || '—',
                }))
            )
            .setFooter({
                text: hasProfanity
                    ? '⚠️ This interview has been flagged for review.'
                    : 'OM Media Obligations System',
            })
            .setTimestamp();

        await channel.send({ embeds: [responseEmbed] });

        // Sızma şansı %35
        const willLeak = Math.random() < LEAK_CHANCE;
        if (willLeak) {
            session.leaked = true;
            await session.save();

            // 10-30 saniye arası gecikme (daha gerçekçi)
            const delay = Math.floor(Math.random() * 20_000) + 10_000;
            setTimeout(async () => {
                try {
                    // Random 1 cevabı sızdır
                    const leakIndex  = Math.floor(Math.random() * answers.length);
                    const leakQ      = session.questions[leakIndex];
                    const leakA      = answers[leakIndex];

                    const leakEmbed = new EmbedBuilder()
                        .setColor(0xFFCC00)
                        .setTitle('📡 LEAKED — Paddock Source')
                        .setDescription(
                            `*"Our paddock correspondent has obtained a clip from today's interview..."*\n\n` +
                            `**Q: ${leakQ}**\n> ${leakA}\n\n` +
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
                .setDescription('Select drivers — bot will fairly pick one for interview')
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
        ),

    buttonHandler,
    modalHandler,
    checkExpiredInterviews,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'start') {
            await interaction.deferReply();

            const track = interaction.options.getString('track');

            // Pilot ID'lerini topla
            const candidates = [];
            for (let i = 1; i <= 5; i++) {
                const user = interaction.options.getUser(`driver${i}`);
                if (user && !user.bot) candidates.push(user.id);
            }

            if (candidates.length === 0) {
                return interaction.editReply({ content: '❌ Please provide at least one driver.' });
            }

            // Ağırlıklı fair seçim
            const chosenId   = await fairPick(candidates);
            const chosenUser = await interaction.guild.members.fetch(chosenId).catch(() => null);

            if (!chosenUser) {
                return interaction.editReply({ content: '❌ Could not fetch the selected driver. Are they still in the server?' });
            }

            // 3 soru seç
            const questions = pickQuestions();
            const sessionId = makeSessionId();

            // DB'ye kaydet
            const session = await Interview.create({
                sessionId,
                trackName: track,
                userId:    chosenId,
                questions,
                channelId: interaction.channelId,
                expiresAt: new Date(Date.now() + TIMEOUT_MS),
            });

            // Buton oluştur
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`interview_start_${sessionId}`)
                    .setLabel('🎤 Start Interview')
                    .setStyle(ButtonStyle.Primary)
            );

            // Kanalda duyur
            const announceEmbed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle(`🎤 Post-Race Interview — ${track.toUpperCase()}`)
                .setDescription(
                    `<@${chosenId}>, the media wants a word with you.\n\n` +
                    `You have been selected for the post-race interview.\n` +
                    `Click the button below to begin. You have **15 minutes** to respond.\n\n` +
                    `*Ignoring this interview will result in a **Media Silence Fine** of \`${MEDIA_SILENCE_FINE} 🪙\`.*`
                )
                .setFooter({ text: 'OM Media Obligations System • Brought to you by OM Bot' })
                .setTimestamp();

            const sentMsg = await interaction.editReply({
                embeds: [announceEmbed],
                components: [row],
            });

            // Message ID'yi kaydet (timeout için)
            session.messageId = sentMsg.id;
            await session.save();
        }
    },
};
