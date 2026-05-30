// events/ommy.js
// ─────────────────────────────────────────────────────────────────────────────
// Ommy AI — Hybrid Architecture
//
// Router  → keyword regex decides: CHAT or RESEARCH
// CHAT    → Mistral directly (no tool calling, instant response)
// RESEARCH→ Gemini 1.5 Flash fetches data via tool calling
//           → raw data passed to Mistral as context
//           → Mistral writes the final Ommy-style reply
//
// Triggers:
//   1. "hey ommy <question>"
//   2. "@OM-Bot <question>"
// ─────────────────────────────────────────────────────────────────────────────

const { PermissionsBitField }  = require('discord.js');
const { Mistral }              = require('@mistralai/mistralai');
const { GoogleGenerativeAI }   = require('@google/generative-ai');

const Driver       = require('../models/Driver');
const DriverRating = require('../models/DriverRating');
const OmmyUser     = require('../models/OmmyUser');
const Maintenance  = require('../models/Maintenance');

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY || '' });

// Gemini is initialised lazily so missing key doesn't crash on startup
let _genAI = null;
function getGemini() {
    if (!_genAI && process.env.GEMINI_API_KEY) {
        _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return _genAI;
}

// ── Per-user in-memory conversation history ───────────────────────────────
const conversationHistory = new Map();
const MAX_HISTORY_PAIRS   = 5;

// ── IDs ───────────────────────────────────────────────────────────────────
const COMMANDER_ID     = '1097807544849809408';
const CO_OWNER_ROLE_ID = '1447144645489328199';

// ══════════════════════════════════════════════════════════════════════════
// ROUTER
// Keywords that indicate the user needs live data from DB or a channel image.
// Everything else goes straight to Mistral (chat path).
// ══════════════════════════════════════════════════════════════════════════

const RESEARCH_PATTERNS = [
    /leaderboard/i, /leader/i, /standing/i, /ranking/i,
    /championship/i, /mid.?season/i, /season/i,
    /stat(s|istic)/i, /rating/i, /rated/i,
    /point(s)?/i, /score(s)?/i, /table/i,
    /who.{0,10}(best|first|top|leading|ahead|win)/i,
    /win(s|ner|ning)/i, /podium/i, /pole/i,
    /race result/i, /race winner/i, /fastest lap/i,
    /how many (wins|races|points|podiums)/i,
    /top \d/i, /number one/i, /#1/i,
    /driver.{0,10}(stat|rating|profile)/i,
    /show.{0,10}driver/i, /list.{0,10}driver/i,
    /who (is|are|was|were).{0,20}(driver|pilot|racer)/i,
];

function isResearchQuery(text) {
    return RESEARCH_PATTERNS.some(p => p.test(text));
}

// ══════════════════════════════════════════════════════════════════════════
// CLEAN DISPLAY NAME
// Strips trailing digits and Unicode superscripts: "Salami¹⁶" → "Salami"
// ══════════════════════════════════════════════════════════════════════════

function cleanDisplayName(name) {
    if (!name) return name;
    const cleaned = name.replace(/[\d⁰¹²³⁴⁵⁶⁷⁸⁹]+$/, '').trim();
    return cleaned || name;
}

// ══════════════════════════════════════════════════════════════════════════
// DB HELPERS
// ══════════════════════════════════════════════════════════════════════════

async function fetchLeaderboard(limit = 10) {
    const drivers = await Driver.find({}).lean();
    const ratings = await DriverRating.find({}).lean();
    const ratingMap = {};
    for (const r of ratings) ratingMap[r.userId] = r;

    return drivers
        .map(d => {
            const r = ratingMap[d.userId];
            return {
                username: r?.username || d.username || d.userId,
                overall:  r?.avg?.overall || 0,
                wins:     d.wins,
                podiums:  d.podiums,
                races:    d.races,
                poles:    d.poles,
                wdc:      d.wdc,
                winRate:  d.races > 0 ? Math.round((d.wins / d.races) * 100) : 0
            };
        })
        .sort((a, b) => b.overall - a.overall || b.wins - a.wins)
        .slice(0, Math.min(limit, 20));
}

async function fetchDriverStats(username) {
    const rating = await DriverRating.findOne({
        username: { $regex: new RegExp(`^${username}$`, 'i') }
    }).lean();
    if (!rating) return null;

    const driver = await Driver.findOne({ userId: rating.userId }).lean();
    return {
        username:    rating.username,
        overall:     rating.avg?.overall || 0,
        pace:        rating.avg?.pace || 0,
        racecraft:   rating.avg?.racecraft || 0,
        defending:   rating.avg?.defending || 0,
        overtaking:  rating.avg?.overtaking || 0,
        consistency: rating.avg?.consistency || 0,
        experience:  rating.avg?.experience || 0,
        ratedBy:     rating.ratedBy || 0,
        wins:        driver?.wins || 0,
        podiums:     driver?.podiums || 0,
        races:       driver?.races || 0,
        poles:       driver?.poles || 0,
        wdc:         driver?.wdc || 0,
        winRate:     driver?.races > 0 ? Math.round((driver.wins / driver.races) * 100) : 0
    };
}

async function fetchPanelStats() {
    const [totalDrivers, totalRatings] = await Promise.all([
        Driver.countDocuments(),
        DriverRating.countDocuments({ ratedBy: { $gt: 0 } })
    ]);
    const topWinner = await Driver.findOne({}).sort({ wins: -1 }).lean();
    const topRating = await DriverRating.findOne({ ratedBy: { $gt: 0 } }).sort({ 'avg.overall': -1 }).lean();
    return {
        totalDrivers,
        totalRated:       totalRatings,
        topWinnerUserId:  topWinner?.userId || null,
        topRatedUsername: topRating?.username || null,
        topRatedOverall:  topRating?.avg?.overall || 0
    };
}

// ══════════════════════════════════════════════════════════════════════════
// CHANNEL IMAGE VISION (Pixtral)
// ══════════════════════════════════════════════════════════════════════════

async function analyzeChannelImage(client, guildId, channelQuery) {
    if (!channelQuery) return { error: 'No channel specified.' };

    let channel = null;

    if (/^\d{15,20}$/.test(channelQuery.trim())) {
        channel = await client.channels.fetch(channelQuery.trim()).catch(() => null);
    }

    if (!channel && guildId) {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
            await guild.channels.fetch().catch(() => {});
            channel = guild.channels.cache.find(c =>
                c.name.toLowerCase().includes(channelQuery.toLowerCase().trim())
            ) || null;
        }
    }

    if (!channel) return { error: `Channel "${channelQuery}" not found.` };

    let messages;
    try {
        messages = await channel.messages.fetch({ limit: 25 });
    } catch {
        return { error: 'Cannot read messages (missing permissions?).' };
    }

    let imageUrl = null;
    for (const [, msg] of messages) {
        const imgAttach = msg.attachments.find(a =>
            a.contentType?.startsWith('image/') ||
            /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name || '')
        );
        if (imgAttach) { imageUrl = imgAttach.url; break; }

        const embedImg = msg.embeds.find(e => e.image?.url || e.thumbnail?.url);
        if (embedImg) { imageUrl = embedImg.image?.url || embedImg.thumbnail?.url; break; }
    }

    if (!imageUrl) return { error: `No image found in #${channel.name}.` };

    try {
        const visionRes = await mistral.chat.complete({
            model:    'pixtral-12b-2409',
            messages: [{
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: imageUrl } },
                    {
                        type: 'text',
                        text: 'This is a sim racing championship standings or race result image. Extract ALL visible data precisely: driver names, positions, points, teams, gaps, fastest laps. Reconstruct any table as plain text.'
                    }
                ]
            }],
            maxTokens:   700,
            temperature: 0.1,
        });

        const analysis = visionRes.choices?.[0]?.message?.content?.trim();
        if (!analysis) return { error: 'Vision model returned no data.' };

        return { found: true, channel: channel.name, analysis };
    } catch (err) {
        console.error('[OMMY VISION]', err.message);
        return { error: 'Vision analysis failed: ' + err.message };
    }
}

// ══════════════════════════════════════════════════════════════════════════
// GEMINI TOOL DEFINITIONS (Gemini uses uppercase type names)
// ══════════════════════════════════════════════════════════════════════════

const GEMINI_TOOLS = [{
    functionDeclarations: [
        {
            name:        'get_leaderboard',
            description: 'Fetch the OM League driver leaderboard with ratings and stats. Use for any question about rankings, who is best, top drivers, or overall standings.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    limit: { type: 'INTEGER', description: 'Number of drivers to return (default 10, max 20)' }
                }
            }
        },
        {
            name:        'get_driver_stats',
            description: 'Fetch stats and rating for a specific driver by username.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    username: { type: 'STRING', description: "The driver's Discord username" }
                },
                required: ['username']
            }
        },
        {
            name:        'get_panel_stats',
            description: 'Fetch general league stats: total drivers, top winner, highest rated driver.',
            parameters: { type: 'OBJECT', properties: {} }
        },
        {
            name:        'get_channel_image',
            description: 'Read and analyze the latest image from a Discord channel using vision AI. Use for championship standings, race results, season tables, or any question requiring visual data from a channel.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    channel: { type: 'STRING', description: 'Channel name (e.g. "mid-season-standings", "race-results") or channel ID' }
                },
                required: ['channel']
            }
        }
    ]
}];

// ══════════════════════════════════════════════════════════════════════════
// RESEARCH LAYER — Gemini decides what data to fetch, we execute locally
// ══════════════════════════════════════════════════════════════════════════

async function runResearchLayer(prompt, client, guildId) {
    const genAI = getGemini();
    if (!genAI) {
        console.warn('[OMMY RESEARCH] GEMINI_API_KEY not set — skipping research layer.');
        return null;
    }

    const model = genAI.getGenerativeModel({
        model:            'gemini-3.5-flash',
        tools:            GEMINI_TOOLS,
        generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
    });

    const researchPrompt = `You are a data retrieval agent for a sim-racing league bot.
Your ONLY job: look at the user's question and call the correct function(s) to fetch the needed data.
Do NOT write any text response. Only call functions.

User question: "${prompt}"`;

    try {
        const chat   = model.startChat();
        const result = await chat.sendMessage(researchPrompt);
        const calls  = result.response.functionCalls();

        if (!calls || calls.length === 0) return null;

        const collectedData = {};

        for (const fc of calls) {
            try {
                let data;
                switch (fc.name) {
                    case 'get_leaderboard':
                        data = await fetchLeaderboard(fc.args?.limit || 10);
                        break;
                    case 'get_driver_stats':
                        data = await fetchDriverStats(fc.args?.username || '');
                        break;
                    case 'get_panel_stats':
                        data = await fetchPanelStats();
                        break;
                    case 'get_channel_image':
                        data = await analyzeChannelImage(client, guildId, fc.args?.channel || '');
                        break;
                    default:
                        data = { error: 'Unknown function.' };
                }
                collectedData[fc.name] = data;
            } catch (toolErr) {
                console.error(`[OMMY GEMINI TOOL ${fc.name}]`, toolErr.message);
                collectedData[fc.name] = { error: 'Tool execution failed.' };
            }
        }

        return collectedData;
    } catch (err) {
        console.error('[OMMY GEMINI]', err.message);
        return null;
    }
}

// ══════════════════════════════════════════════════════════════════════════
// OMMY USER MEMORY
// ══════════════════════════════════════════════════════════════════════════

async function loadOmmyUser(userId, username) {
    if (!userId) return null;
    try {
        return await OmmyUser.findOneAndUpdate(
            { userId },
            {
                $set: { username: username || '', lastSeenAt: new Date() },
                $inc: { messageCount: 1 }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } catch (err) {
        console.error('[OMMY MEMORY] loadOmmyUser:', err.message);
        return null;
    }
}

function buildPersonaTag(omUser, role, rawName) {
    if (!omUser) return '';
    const cleanName = cleanDisplayName(rawName || omUser.username || 'this user');
    const lines = [
        `CURRENT USER: ${cleanName} | Role: ${String(role || 'member').toUpperCase()}`,
        `Address this user as: ${cleanName}`
    ];
    if (omUser.persona)   lines.push(`Profile: ${omUser.persona}`);
    if (omUser.expertise) lines.push(`Expertise: ${omUser.expertise}`);
    if (omUser.tone)      lines.push(`Preferred tone: ${omUser.tone}`);
    if (omUser.notes)     lines.push(`Admin notes: ${omUser.notes}`);
    if (omUser.summary)   lines.push(`Memory of past chats: ${omUser.summary}`);
    return '\n\n---\n' + lines.join('\n') + '\n---';
}

const SUMMARY_EVERY_N = 20;

async function maybeSummariseUser(omUser, fullHistory) {
    if (!omUser) return;
    if (omUser.messageCount % SUMMARY_EVERY_N !== 0) return;
    if (fullHistory.length < 6) return;

    const transcript = fullHistory
        .slice(-20)
        .map(m => `${m.role === 'user' ? 'User' : 'Ommy'}: ${m.content}`)
        .join('\n');

    try {
        const res = await mistral.chat.complete({
            model:       'mistral-small-latest',
            messages:    [{
                role:    'user',
                content: `Summarise this sim-racing league conversation in 2-3 sentences (third person, no usernames/IDs):\n\n${transcript}\n\nSUMMARY:`
            }],
            maxTokens:   150,
            temperature: 0.3,
        });
        const summary = res.choices?.[0]?.message?.content?.trim();
        if (summary) {
            await OmmyUser.updateOne(
                { userId: omUser.userId },
                { $set: { summary, summaryUpdatedAt: new Date() } }
            );
        }
    } catch (err) {
        console.error('[OMMY MEMORY] Summarise:', err.message);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════════════════

const OMMY_SYSTEM_PROMPT_BASE = `You are Ommy — the official mascot and support bot of Olzhasstik Motorsports (OM), an online sim-racing league. You are energetic, cheerful, and a passionate sim-racing fanatic.

PERSONA RULES:
- You are NOT an AI. You are Ommy. Never admit to being an AI or language model.
- Use racing terminology naturally (apex, stint, pole position, pit wall, sector, slipstream).
- Use racing emojis freely: 🏎️ 🏁 🚦 🏆 🔧 ⏱️ 🎖️ 🛡️
- Keep tone punchy, short, hype. No corporate language.
- ALWAYS address the user by the clean name in "Address this user as" — never use raw usernames with numbers or symbols.
- If asked something you have no data for: "I need to radio the pit wall on that one! Jump into Discord: discord.gg/OMMR"

DATA RULES:
- NEVER invent driver names, ratings, scores, or statistics.
- If data is provided below under "LEAGUE DATA", use it. If no data is provided, say the data feed is down.
- Only state facts that appear in the provided data.

OM LEAGUE KNOWLEDGE (no data needed):
- Registration: /register slash command.
- Ratings: PAC (25%) CRA (20%) DEF (15%) OVT (15%) CON (15%) EXP (10%). OVR = weighted average.
- Penalties: 3 Warns = punishment. Jail = channel restriction. Ban = removal.
- Roles: Commander > Admin > Driver > Member.
- Discord: discord.gg/OMMR | IG: @olzhasstik_motorsports

RESPONSE FORMAT:
- 2-4 sentences unless showing a data table.
- Use **bold** for names/terms, \`backticks\` for commands.
- Always end with energy.`;

// ══════════════════════════════════════════════════════════════════════════
// SEND HELPER
// ══════════════════════════════════════════════════════════════════════════

async function sendOmmyReply(message, text) {
    const MAX = 1990;
    if (text.length <= MAX) {
        return message.reply(text).catch(err => console.error('[OMMY REPLY]', err.message));
    }
    const chunks  = [];
    let   current = '';
    for (const line of text.split('\n')) {
        const candidate = current ? current + '\n' + line : line;
        if (candidate.length > MAX) {
            if (current) chunks.push(current);
            current = line.slice(0, MAX);
        } else {
            current = candidate;
        }
    }
    if (current) chunks.push(current);
    await message.reply(chunks[0]).catch(err => console.error('[OMMY REPLY]', err.message));
    for (let i = 1; i < chunks.length; i++) {
        await message.channel.send(chunks[i]).catch(() => {});
    }
}

// ══════════════════════════════════════════════════════════════════════════
// ROLE DETECTION
// ══════════════════════════════════════════════════════════════════════════

function detectRole(message) {
    if (message.author.id === COMMANDER_ID) return 'commander';
    if (message.member?.roles.cache.has(CO_OWNER_ROLE_ID)) return 'admin';
    if (message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) return 'admin';
    return 'member';
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN EVENT
// ══════════════════════════════════════════════════════════════════════════

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.guild)     return;

        const raw   = message.content.trim();
        const lower = raw.toLowerCase();

        let prompt = null;
        if (lower.startsWith('hey ommy')) {
            prompt = raw.slice(8).trim();
        } else if (message.mentions.users.has(client.user.id)) {
            prompt = raw.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
        }

        if (!prompt) return;

        const displayName = message.member?.displayName || message.author.username;
        const cleanName   = cleanDisplayName(displayName);

        if (prompt.length === 0) {
            return message.reply(`🏎️ Ommy is ready! Got a question, ${cleanName}?`);
        }
        if (prompt.length > 1000) {
            return message.reply('❌ Message too long! Keep it under 1000 characters, champ. 🏎️');
        }

        // Maintenance check
        const role = detectRole(message);
        if (role === 'member') {
            try {
                const mDoc = await Maintenance.findById('singleton');
                if (mDoc?.active) return message.reply('🔒 Ommy is in the pit lane for maintenance! Back soon. 🔧');
            } catch {}
        }

        if (!process.env.MISTRAL_API_KEY) {
            console.error('[OMMY] MISTRAL_API_KEY not set.');
            return message.reply("⚠️ Ommy's radio is down — API configuration error. 📡");
        }

        await message.channel.sendTyping().catch(() => {});

        // Memory
        const omUser       = await loadOmmyUser(message.author.id, displayName);
        const personaTag   = buildPersonaTag(omUser, role, displayName);

        // History
        const histKey = `${message.guildId}-${message.author.id}`;
        if (!conversationHistory.has(histKey)) conversationHistory.set(histKey, []);
        const history     = conversationHistory.get(histKey);
        const safeHistory = history.slice(-(MAX_HISTORY_PAIRS * 2));

        try {
            // ── ROUTER ────────────────────────────────────────────────────
            const needsResearch = isResearchQuery(prompt);
            let   dataContext   = '';

            if (needsResearch) {
                // Re-send typing — Gemini + possible vision takes a moment
                await message.channel.sendTyping().catch(() => {});

                const researchData = await runResearchLayer(prompt, client, message.guildId);

                if (researchData) {
                    dataContext = `\n\n--- LEAGUE DATA ---\n${JSON.stringify(researchData, null, 2)}\n--- END DATA ---\n\nUse the data above to answer. Do not invent or guess any values not present in the data.`;
                }
            }

            // ── MISTRAL — final Ommy response ─────────────────────────────
            const systemPrompt = OMMY_SYSTEM_PROMPT_BASE + personaTag + dataContext;

            const mistralRes = await mistral.chat.complete({
                model:       'mistral-small-latest',
                messages:    [
                    { role: 'system', content: systemPrompt },
                    ...safeHistory,
                    { role: 'user', content: prompt }
                ],
                maxTokens:   500,
                temperature: 0.7,
                // No tools — Mistral never does tool calling in this architecture
            });

            const reply = mistralRes.choices?.[0]?.message?.content?.trim()
                || "📡 Ommy didn't catch that — try rephrasing your question, pilot!";

            history.push({ role: 'user', content: prompt });
            history.push({ role: 'assistant', content: reply });

            maybeSummariseUser(omUser, [...safeHistory, { role: 'user', content: prompt }, { role: 'assistant', content: reply }]);

            sendOmmyReply(message, reply);

        } catch (err) {
            console.error('[OMMY BOT ERROR]', err?.message || err);
            message.reply('🔧 Ommy hit the wall — engine failure! Try again in a moment. 🏎️').catch(() => {});
        }
    });
};
