// events/ommy.js
// ─────────────────────────────────────────────────────────────────────────────
// Ommy AI — OM-Bot integration
//
// Triggers:
//   1. "hey ommy <question>"  — case-insensitive prefix
//   2. "@OM-Bot <question>"   — bot mention
//
// Features:
//   • Mistral function calling (leaderboard, driver stats, panel stats)
//   • Channel image reading via Pixtral vision (championship tables, race results)
//   • MongoDB per-user memory system (OmmyUser)
//   • Typing indicator
//   • Discord 2000-character limit handling
//   • Maintenance mode check
//   • Clean display name (strips trailing digits/superscripts from usernames)
// ─────────────────────────────────────────────────────────────────────────────

const { PermissionsBitField } = require('discord.js');
const { Mistral }             = require('@mistralai/mistralai');

const Driver       = require('../models/Driver');
const DriverRating = require('../models/DriverRating');
const OmmyUser     = require('../models/OmmyUser');
const Maintenance  = require('../models/Maintenance');

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY || '' });

// ── Per-user in-memory conversation history ───────────────────────────────
// Key: `${guildId}-${userId}`
const conversationHistory = new Map();
const MAX_HISTORY_PAIRS   = 5; // 5 pairs = 10 messages

// ── IDs ───────────────────────────────────────────────────────────────────
const COMMANDER_ID     = '1097807544849809408';
const CO_OWNER_ROLE_ID = '1447144645489328199';

// ══════════════════════════════════════════════════════════════════════════
// CLEAN DISPLAY NAME
// Strips trailing digits and Unicode superscript numbers from usernames.
// e.g. "Salami¹⁶" → "Salami", "Driver99" → "Driver", "Gofret" → "Gofret"
// ══════════════════════════════════════════════════════════════════════════

function cleanDisplayName(name) {
    if (!name) return name;
    // Regular digits 0-9 + Unicode superscripts ⁰¹²³⁴⁵⁶⁷⁸⁹
    const cleaned = name.replace(/[\d⁰¹²³⁴⁵⁶⁷⁸⁹]+$/, '').trim();
    return cleaned || name; // fallback to original if everything was stripped
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
// CHANNEL IMAGE VISION
// Fetches the latest image from a Discord channel and analyzes it via Pixtral.
// ══════════════════════════════════════════════════════════════════════════

async function analyzeChannelImage(client, guildId, channelQuery) {
    if (!channelQuery) return { error: 'No channel specified.' };

    let channel = null;

    // Try direct channel ID first (numeric string)
    if (/^\d{15,20}$/.test(channelQuery.trim())) {
        channel = await client.channels.fetch(channelQuery.trim()).catch(() => null);
    }

    // Fall back to searching by name within the guild
    if (!channel && guildId) {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
            await guild.channels.fetch().catch(() => {});
            channel = guild.channels.cache.find(c =>
                c.name.toLowerCase().includes(channelQuery.toLowerCase().trim())
            ) || null;
        }
    }

    if (!channel) {
        return { error: `Channel "${channelQuery}" not found or bot has no access.` };
    }

    // Fetch last 25 messages and look for an image
    let messages;
    try {
        messages = await channel.messages.fetch({ limit: 25 });
    } catch {
        return { error: 'Cannot read messages from that channel (missing permissions?).' };
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

    if (!imageUrl) {
        return { error: `No image found in #${channel.name}. Make sure the standings table is posted there.` };
    }

    // Send image to Pixtral for analysis
    try {
        const visionRes = await mistral.chat.complete({
            model:    'pixtral-12b-2409',
            messages: [{
                role: 'user',
                content: [
                    { type: 'image_url', image_url: { url: imageUrl } },
                    {
                        type: 'text',
                        text: 'This is a sim racing championship standings table or race result image from a Discord channel. Extract ALL visible information precisely: driver names, positions, points totals, teams, gaps, fastest laps, or any other data visible. List everything completely and accurately. If it is a table, reconstruct it as text.'
                    }
                ]
            }],
            maxTokens:   700,
            temperature: 0.1,
        });

        const analysis = visionRes.choices?.[0]?.message?.content?.trim();
        if (!analysis) return { error: 'Vision model returned no data.' };

        return { found: true, channel: channel.name, imageUrl, analysis };
    } catch (err) {
        console.error('[OMMY VISION]', err.message);
        return { error: 'Vision analysis failed: ' + err.message };
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
        console.error('[OMMY MEMORY] loadOmmyUser error:', err.message);
        return null;
    }
}

function buildPersonaTag(omUser, role, rawName) {
    if (!omUser) return '';
    const cleanName = cleanDisplayName(rawName || omUser.username || 'this user');
    const lines = [];
    lines.push(`CURRENT USER: ${cleanName} | Role: ${String(role || 'member').toUpperCase()}`);
    lines.push(`Address this user as: ${cleanName}`);
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

    const prompt = `You are a memory assistant for an AI called Ommy.\nRead this conversation between Ommy and a sim-racing league member, then write a 2-3 sentence summary of:\n• Who this person is (role, experience level, personality)\n• What topics they usually ask about\n• Any important preferences or patterns you noticed\n\nBe concise. Write in third person. Do NOT include usernames or Discord IDs.\n\nCONVERSATION:\n${transcript}\n\nSUMMARY:`;

    try {
        const res = await mistral.chat.complete({
            model:       'mistral-small-latest',
            messages:    [{ role: 'user', content: prompt }],
            maxTokens:   150,
            temperature: 0.3,
        });
        const newSummary = res.choices?.[0]?.message?.content?.trim();
        if (newSummary) {
            await OmmyUser.updateOne(
                { userId: omUser.userId },
                { $set: { summary: newSummary, summaryUpdatedAt: new Date() } }
            );
        }
    } catch (err) {
        console.error('[OMMY MEMORY] Summarise error:', err.message);
    }
}

// ══════════════════════════════════════════════════════════════════════════
// MISTRAL TOOLS
// ══════════════════════════════════════════════════════════════════════════

const OMMY_TOOLS = [
    {
        type: 'function',
        function: {
            name:        'get_leaderboard',
            description: 'Fetch the current OM League driver leaderboard with ratings and stats from the live database. Call this whenever the user asks about rankings, standings, who is first/best, leaderboard, or top drivers.',
            parameters: {
                type: 'object',
                properties: {
                    limit: {
                        type:        'integer',
                        description: 'How many top drivers to return (default 10, max 20)',
                        default:     10
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name:        'get_driver_stats',
            description: "Fetch full stats and ratings for a specific driver by username. Call this when the user asks about a specific driver's performance, rating, stats, or profile.",
            parameters: {
                type: 'object',
                properties: {
                    username: {
                        type:        'string',
                        description: "The driver's Discord username to look up"
                    }
                },
                required: ['username']
            }
        }
    },
    {
        type: 'function',
        function: {
            name:        'get_panel_stats',
            description: 'Fetch general OM League panel statistics: total drivers registered, most wins, highest rated driver. Use when asked about overall league status or general numbers.',
            parameters:  { type: 'object', properties: {}, required: [] }
        }
    },
    {
        type: 'function',
        function: {
            name:        'get_channel_image',
            description: 'Read and analyze the latest image posted in a Discord channel using AI vision. Use this when the user asks about championship standings, race results, season points, mid-season standings, or anything that requires reading a visual from a specific channel. Always call this for any question about current standings or championship positions.',
            parameters: {
                type: 'object',
                properties: {
                    channel: {
                        type:        'string',
                        description: 'The Discord channel name (e.g. "mid-season-standings", "race-results", "championship") or a channel ID. Infer the most likely channel name from the user\'s question.'
                    }
                },
                required: ['channel']
            }
        }
    }
];

// ══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════════════════

const OMMY_SYSTEM_PROMPT_BASE = `You are Ommy — the official mascot and support bot of Olzhasstik Motorsports (OM), an online sim-racing league. You are energetic, cheerful, and a passionate sim-racing fanatic.

PERSONA RULES (NEVER break these):
- You are NOT an AI. You are Ommy. Never admit to being an AI or a language model.
- Sprinkle racing terminology naturally (apex, stint, pole position, pit wall, sector, slipstream, etc.).
- Use racing emojis freely: 🏎️ 🏁 🚦 🏆 🔧 ⏱️ 🎖️ 🛡️
- Keep tone punchy, short, hype. Avoid corporate or formal language.
- ALWAYS address the user by the clean name in "Address this user as" — never use their full raw username with numbers or symbols.
- If asked something league-specific you have no data for, say: "I need to radio the pit wall on that one! Jump into Discord: discord.gg/OMMR"

DATA INTEGRITY RULES (CRITICAL — never violate):
- NEVER invent driver names, ratings, scores, or statistics.
- NEVER guess leaderboard positions or championship standings.
- For any question about current standings, championship leader, race results, or season points: you MUST call get_channel_image with the most relevant channel name — never answer from memory.
- For leaderboard/driver data: call the appropriate DB tool.
- If a tool call fails or returns no data, say: "I'm having a pit lane communication issue right now — the data feed is down. Try again in a moment! 📡"
- Only state facts that came from a tool result in this conversation.

OM LEAGUE KNOWLEDGE BASE (static info — no tool needed):
- Registration: /register slash command in OM Discord.
- Rating categories: PAC (Pace 25%), CRA (Racecraft 20%), DEF (Defending 15%), OVT (Overtaking 15%), CON (Consistency 15%), EXP (Experience 10%). OVR = weighted average.
- Penalties: 3 Warns = auto punishment. Jail = channel restriction. Ban = removal. Only Admins/Commander can issue.
- Roles: Commander (full access) > Admin (mod/rate/penalize) > Driver (registered racer) > Member.
- DOTY: Season-end vote via OM-Bot Discord buttons.
- Discord: discord.gg/OMMR | Bot: discord.gg/OMGT | IG: @olzhasstik_motorsports
- Bot commands: /register /leaderboard /track [name] — staff: /warn /jail /doty
- Rules: Full rulebook in #rules on Discord. Fair play mandatory, deliberate collisions = penalty.

RESPONSE FORMAT:
- Concise — 2-4 sentences unless showing data tables.
- Use **bold** for names/terms and \`backticks\` for commands.
- Always end with energy and a next step.`;

// ══════════════════════════════════════════════════════════════════════════
// SEND HELPER — handles Discord's 2000-character limit
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

        // Trigger detection
        let prompt = null;

        if (lower.startsWith('hey ommy')) {
            prompt = raw.slice(8).trim();
        } else if (message.mentions.users.has(client.user.id)) {
            prompt = raw
                .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
                .trim();
        }

        if (!prompt) return;

        // Empty mention with no question — short greeting
        if (prompt.length === 0) {
            const cleanName = cleanDisplayName(message.member?.displayName || message.author.username);
            return message.reply(`🏎️ Ommy is ready! Got a question, ${cleanName}?`);
        }

        if (prompt.length > 1000) {
            return message.reply('❌ Message too long! Keep it under 1000 characters, champ. 🏎️');
        }

        // Maintenance check (skip for admins/commander)
        const role = detectRole(message);
        if (role === 'member') {
            try {
                const mDoc = await Maintenance.findById('singleton');
                if (mDoc?.active) {
                    return message.reply('🔒 Ommy is in the pit lane for maintenance! Back soon. 🔧');
                }
            } catch { /* DB error — continue */ }
        }

        // API key guard
        if (!process.env.MISTRAL_API_KEY) {
            console.error('[OMMY] MISTRAL_API_KEY is not set.');
            return message.reply("⚠️ Ommy's radio is down — API configuration error. 📡");
        }

        // Typing indicator
        await message.channel.sendTyping().catch(() => {});

        // Use guild display name if available, fall back to username
        const displayName = message.member?.displayName || message.author.username;

        // Load user memory
        const omUser      = await loadOmmyUser(message.author.id, displayName);
        const personaTag  = buildPersonaTag(omUser, role, displayName);
        const systemPrompt = OMMY_SYSTEM_PROMPT_BASE + personaTag;

        // Conversation history
        const histKey = `${message.guildId}-${message.author.id}`;
        if (!conversationHistory.has(histKey)) conversationHistory.set(histKey, []);
        const history = conversationHistory.get(histKey);

        const safeHistory = history.slice(-(MAX_HISTORY_PAIRS * 2));
        const messages    = [...safeHistory, { role: 'user', content: prompt }];

        try {
            // ROUND 1 — ask Mistral, may return a tool call
            const round1 = await mistral.chat.complete({
                model:       'mistral-small-latest',
                messages:    [{ role: 'system', content: systemPrompt }, ...messages],
                tools:       OMMY_TOOLS,
                toolChoice:  'auto',
                maxTokens:   400,
                temperature: 0.7,
            });

            const choice       = round1.choices?.[0];
            const finishReason = choice?.finish_reason;

            // No tool call — return direct text response
            if (finishReason !== 'tool_calls' || !choice?.message?.tool_calls?.length) {
                const content = choice?.message?.content?.trim();

                // Empty response from Mistral — generic fallback
                if (!content) {
                    return message.reply("📡 Ommy didn't catch that — try rephrasing your question, pilot!");
                }

                history.push({ role: 'user', content: prompt });
                history.push({ role: 'assistant', content });

                maybeSummariseUser(omUser, [...messages, { role: 'assistant', content }]);

                return sendOmmyReply(message, content);
            }

            // ROUND 2 — execute tool calls
            const toolCalls   = choice.message.tool_calls;
            const toolResults = [];

            for (const tc of toolCalls) {
                const fnName = tc.function?.name;
                let args = {};
                try { args = JSON.parse(tc.function?.arguments || '{}'); } catch {}

                let result;
                try {
                    if (fnName === 'get_leaderboard') {
                        const limit = Math.min(args.limit || 10, 20);
                        const data  = await fetchLeaderboard(limit);
                        result = data.length === 0
                            ? { error: 'No drivers found in database.' }
                            : {
                                count:       data.length,
                                leaderboard: data.map((d, i) => ({
                                    rank:     i + 1,
                                    username: d.username,
                                    overall:  d.overall,
                                    wins:     d.wins,
                                    podiums:  d.podiums,
                                    races:    d.races,
                                    winRate:  d.winRate + '%',
                                    wdc:      d.wdc
                                }))
                            };

                    } else if (fnName === 'get_driver_stats') {
                        const data = await fetchDriverStats(args.username || '');
                        result = data
                            ? { found: true, stats: data }
                            : { found: false, message: `No driver named "${args.username}" found.` };

                    } else if (fnName === 'get_panel_stats') {
                        result = await fetchPanelStats();

                    } else if (fnName === 'get_channel_image') {
                        // Re-send typing — vision call takes a moment
                        await message.channel.sendTyping().catch(() => {});
                        result = await analyzeChannelImage(client, message.guildId, args.channel || '');

                    } else {
                        result = { error: 'Unknown function: ' + fnName };
                    }
                } catch (dbErr) {
                    console.error(`[OMMY TOOL ${fnName}]`, dbErr.message);
                    result = { error: 'Data unavailable — database error.' };
                }

                toolResults.push({
                    tool_call_id: tc.id,
                    role:         'tool',
                    name:         fnName,
                    content:      JSON.stringify(result)
                });
            }

            // ROUND 2 — final Mistral response with tool results
            const round2Messages = [
                { role: 'system', content: systemPrompt },
                ...messages,
                choice.message,
                ...toolResults
            ];

            const round2 = await mistral.chat.complete({
                model:       'mistral-small-latest',
                messages:    round2Messages,
                maxTokens:   500,
                temperature: 0.7,
            });

            const reply = round2.choices?.[0]?.message?.content?.trim()
                || "📡 Ommy got the data but the words got lost — try again, pilot!";

            history.push({ role: 'user', content: prompt });
            history.push({ role: 'assistant', content: reply });

            maybeSummariseUser(omUser, [...messages, { role: 'assistant', content: reply }]);

            sendOmmyReply(message, reply);

        } catch (err) {
            console.error('[OMMY BOT ERROR]', err?.message || err);
            message.reply('🔧 Ommy hit the wall — engine failure! Try again in a moment. 🏎️').catch(() => {});
        }
    });
};
