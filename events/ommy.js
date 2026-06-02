// events/ommy.js
// ─────────────────────────────────────────────────────────────────────────────
// Ommy AI — Full Gemini 3.5 Flash Architecture
//
// • Tool calling    — DB queries, channel image vision, server scanning
// • Personality     — Ommy character, racing tone, user-aware tone matching
// • Nick learning   — scans how others address a person in chat
// • Behavior profiling — scans Paddock category to understand each member
// • Active learning — ChannelCache: channel content cached in MongoDB,
//                     reused on next query (2h TTL), avoids redundant API calls
// • Category-aware image search — when looking for standings images,
//                     scans all channels in the matching category
// • Other leagues   — "I only have OM League data"
// • General motorsport/F1 — Gemini's built-in knowledge
//
// Triggers:
//   1. "hey ommy <question>"
//   2. "@OM-Bot <question>"
// ─────────────────────────────────────────────────────────────────────────────

const { PermissionsBitField, ChannelType } = require('discord.js');
const { GoogleGenerativeAI }               = require('@google/generative-ai');
const axios                                = require('axios');

const Driver        = require('../models/Driver');
const DriverRating  = require('../models/DriverRating');
const OmmyUser      = require('../models/OmmyUser');
const ChannelCache  = require('../models/ChannelCache');
const Maintenance   = require('../models/Maintenance');

// ── Constants ─────────────────────────────────────────────────────────────
const COMMANDER_ID         = '1097807544849809408';
const CO_OWNER_ROLE_ID     = '1447144645489328199';
const PADDOCK_CATEGORY_ID  = '1447142057385918546'; // general/daily channels
const CACHE_TTL_MS         = 2 * 60 * 60 * 1000;   // 2 hours

// ── Gemini lazy init ───────────────────────────────────────────────────────
let _genAI = null;
function getGemini() {
    if (!_genAI && process.env.GEMINI_API_KEY) {
        _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return _genAI;
}

// ── Per-user in-memory conversation history ────────────────────────────────
const conversationHistory = new Map();
const MAX_HISTORY_PAIRS   = 6;

// ══════════════════════════════════════════════════════════════════════════
// CLEAN DISPLAY NAME
// "Salami¹⁶" → "Salami"
// ══════════════════════════════════════════════════════════════════════════

function cleanDisplayName(name) {
    if (!name) return name;
    const cleaned = name.replace(/[\d⁰¹²³⁴⁵⁶⁷⁸⁹]+$/, '').trim();
    return cleaned || name;
}

// ══════════════════════════════════════════════════════════════════════════
// NICK DISCOVERY
// 1. Stored nick in OmmyUser
// 2. Clean display name (strip trailing digits)
// 3. Scan channel — how do others @mention or address this person?
// ══════════════════════════════════════════════════════════════════════════

async function resolveNick(client, channel, userId, displayName) {
    const stored = await OmmyUser.findOne({ userId }).lean().catch(() => null);
    if (stored?.preferredNick) return stored.preferredNick;

    const cleanName = cleanDisplayName(displayName);

    try {
        const messages  = await channel.messages.fetch({ limit: 150 });
        const nickCounts = new Map();
        const stopWords  = new Set([
            'hey', 'bro', 'dude', 'man', 'abi', 'nice', 'good', 'the', 'you',
            'but', 'yeah', 'yep', 'ok', 'wtf', 'omg', 'gg', 'lol', 'bruh',
            'nah', 'sup', 'yes', 'wait', 'what', 'haha', 'lmao',
        ]);

        for (const [, msg] of messages) {
            if (msg.author.bot) continue;
            if (!msg.mentions.users.has(userId)) continue;

            const words = msg.content
                .replace(new RegExp(`<@!?${userId}>`, 'g'), ' ')
                .replace(/[^\w\s]/gi, ' ')
                .toLowerCase()
                .split(/\s+/)
                .filter(w =>
                    w.length >= 3 && w.length <= 20 &&
                    /^[a-z]+$/.test(w) && !stopWords.has(w)
                );

            for (const w of words) nickCounts.set(w, (nickCounts.get(w) || 0) + 1);
        }

        const top = [...nickCounts.entries()]
            .filter(([, c]) => c >= 2)
            .sort((a, b) => b[1] - a[1]);

        if (top.length > 0) {
            const nick = top[0][0].charAt(0).toUpperCase() + top[0][0].slice(1);
            await OmmyUser.updateOne(
                { userId },
                { $set: { preferredNick: nick, nickLastScanned: new Date() } },
                { upsert: true }
            ).catch(() => {});
            return nick;
        }
    } catch { /* fall through */ }

    if (cleanName !== displayName) {
        await OmmyUser.updateOne(
            { userId },
            { $set: { preferredNick: cleanName } },
            { upsert: true }
        ).catch(() => {});
    }
    return cleanName;
}

// ══════════════════════════════════════════════════════════════════════════
// CHANNEL CACHE
// Fetches messages from a channel, generates a Gemini summary, stores in DB.
// On subsequent calls within TTL, returns cached data without hitting Discord API.
// ══════════════════════════════════════════════════════════════════════════

async function getCachedOrFetch(client, guildId, channel, limit = 40) {
    const now    = Date.now();
    const cached = await ChannelCache.findOne({ channelId: channel.id }).lean().catch(() => null);

    if (cached && cached.cachedAt && (now - new Date(cached.cachedAt).getTime()) < CACHE_TTL_MS) {
        // Cache hit — return stored data
        let messages = [];
        try { messages = JSON.parse(cached.rawMessages || '[]'); } catch {}
        return {
            channel:   channel.name,
            count:     messages.length,
            messages,
            fromCache: true,
            purpose:   cached.purpose,
            summary:   cached.contentSummary,
        };
    }

    // Cache miss / stale — fetch fresh from Discord
    let entries = [];
    try {
        const msgs = await channel.messages.fetch({ limit: Math.min(limit, 100) });
        for (const [, msg] of msgs) {
            if (!msg.content && msg.attachments.size === 0) continue;
            entries.push({
                author:  msg.author.username,
                content: msg.content.slice(0, 300),
                time:    msg.createdAt.toISOString().slice(11, 16),
            });
        }
    } catch (err) {
        return { error: `Cannot read #${channel.name}: ${err.message}` };
    }

    // Ask Gemini to summarize the channel
    let purpose = '';
    let contentSummary = '';
    const genAI = getGemini();
    if (genAI && entries.length > 0) {
        try {
            const model  = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
            const result = await model.generateContent(
                `Channel: #${channel.name}\nCategory: ${channel.parent?.name || 'unknown'}\n\nRecent messages:\n${entries.slice(0, 20).map(e => `${e.author}: ${e.content}`).join('\n')}\n\nIn 1-2 sentences: (1) what is this channel for, (2) what's currently being discussed?`
            );
            purpose = contentSummary = result.response.text()?.trim() || '';
        } catch {}
    }

    // Write to cache
    await ChannelCache.findOneAndUpdate(
        { channelId: channel.id },
        {
            channelId:      channel.id,
            channelName:    channel.name,
            guildId,
            categoryId:     channel.parentId || '',
            categoryName:   channel.parent?.name || '',
            purpose,
            contentSummary,
            rawMessages:    JSON.stringify(entries.slice(0, 50)),
            cachedAt:       new Date(),
        },
        { upsert: true, new: true }
    ).catch(() => {});

    return {
        channel:   channel.name,
        count:     entries.length,
        messages:  entries,
        fromCache: false,
        purpose,
        summary:   contentSummary,
    };
}

// ══════════════════════════════════════════════════════════════════════════
// CHANNEL RESOLVER
// Finds a Discord channel by name or ID.
// If not found by exact name, searches all channels in a matching category.
// Returns an array of candidate channels (usually 1, but multiple for
// category-wide searches).
// ══════════════════════════════════════════════════════════════════════════

async function resolveChannels(client, guildId, query) {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return [];

    await guild.channels.fetch().catch(() => {});

    // Direct ID
    if (/^\d{15,20}$/.test(query.trim())) {
        const ch = guild.channels.cache.get(query.trim());
        return ch ? [ch] : [];
    }

    const q = query.toLowerCase().trim();

    // Exact name match
    const exact = guild.channels.cache.find(c =>
        c.isTextBased() && c.name.toLowerCase().includes(q)
    );
    if (exact) return [exact];

    // No exact match → look for a category whose name matches,
    // return all text channels in that category
    const matchingCategory = guild.channels.cache.find(c =>
        c.type === ChannelType.GuildCategory &&
        (c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()))
    );
    if (matchingCategory) {
        return guild.channels.cache
            .filter(c => c.isTextBased() && c.parentId === matchingCategory.id)
            .map(c => c);
    }

    return [];
}

// ══════════════════════════════════════════════════════════════════════════
// SCAN CHANNEL MESSAGES (with cache)
// ══════════════════════════════════════════════════════════════════════════

async function scanChannelMessages(client, guildId, channelQuery, limit = 40) {
    const channels = await resolveChannels(client, guildId, channelQuery);
    if (channels.length === 0) return { error: `Channel "${channelQuery}" not found.` };

    // If multiple channels found (category match), scan all and merge summaries
    if (channels.length > 1) {
        const results = [];
        for (const ch of channels) {
            const data = await getCachedOrFetch(client, guildId, ch, limit);
            if (!data.error) {
                results.push({ channel: ch.name, summary: data.summary, fromCache: data.fromCache });
            }
        }
        return { multiChannel: true, channels: results };
    }

    return await getCachedOrFetch(client, guildId, channels[0], limit);
}

// ══════════════════════════════════════════════════════════════════════════
// CHANNEL IMAGE — Gemini native vision
// Searches channel(s) for the latest image, analyzes with Gemini vision.
// If channel query maps to a category, scans ALL channels in it.
// ══════════════════════════════════════════════════════════════════════════

async function getChannelImage(client, guildId, channelQuery) {
    if (!channelQuery) return { error: 'No channel specified.' };

    const channels = await resolveChannels(client, guildId, channelQuery);
    if (channels.length === 0) return { error: `Channel "${channelQuery}" not found.` };

    // Collect image URLs from all candidate channels
    let imageUrl    = null;
    let imageChannel = null;

    for (const ch of channels) {
        try {
            const msgs = await ch.messages.fetch({ limit: 30 });
            for (const [, msg] of msgs) {
                const att = msg.attachments.find(a =>
                    a.contentType?.startsWith('image/') ||
                    /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name || '')
                );
                if (att) { imageUrl = att.url; imageChannel = ch; break; }
                const emb = msg.embeds.find(e => e.image?.url || e.thumbnail?.url);
                if (emb)  { imageUrl = emb.image?.url || emb.thumbnail?.url; imageChannel = ch; break; }
            }
        } catch { continue; }
        if (imageUrl) break;
    }

    if (!imageUrl) {
        return { error: `No image found in ${channels.map(c => '#' + c.name).join(', ')}.` };
    }

    // Analyze with Gemini vision
    try {
        const imgRes   = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 12000 });
        const base64   = Buffer.from(imgRes.data).toString('base64');
        const mimeType = (imgRes.headers['content-type'] || 'image/jpeg').split(';')[0];

        const genAI       = getGemini();
        const visionModel = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

        const visionResult = await visionModel.generateContent([
            { inlineData: { mimeType, data: base64 } },
            { text: 'This is a sim racing championship standings table or race result from a Discord server. Extract ALL visible data: driver names, positions, points totals, teams, gaps, fastest laps. Reconstruct any table as plain text with clear columns.' }
        ]);

        return {
            found:    true,
            channel:  imageChannel.name,
            analysis: visionResult.response.text(),
        };
    } catch (err) {
        console.error('[OMMY VISION]', err.message);
        return { error: 'Image analysis failed: ' + err.message };
    }
}

// ══════════════════════════════════════════════════════════════════════════
// BEHAVIOR PROFILE BUILDER (background, fire-and-forget)
// Scans Paddock category channels for the user's own messages,
// feeds to Gemini, generates a behavioral summary.
// ══════════════════════════════════════════════════════════════════════════

async function buildBehaviorProfile(client, guildId, userId, displayName) {
    const genAI = getGemini();
    if (!genAI) return;

    try {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        await guild.channels.fetch().catch(() => {});

        // Prefer Paddock category; fall back to any text channels
        let scanChannels = guild.channels.cache.filter(c =>
            c.isTextBased() && !c.isThread() && c.parentId === PADDOCK_CATEGORY_ID
        );
        if (scanChannels.size === 0) {
            scanChannels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread()).first(8);
        }

        const userMessages = [];

        for (const [, ch] of scanChannels) {
            try {
                const msgs = await ch.messages.fetch({ limit: 50 });
                for (const [, msg] of msgs) {
                    if (msg.author.id !== userId || msg.author.bot) continue;
                    userMessages.push(`[#${ch.name}] ${msg.content.slice(0, 250)}`);
                }
            } catch { continue; }
        }

        if (userMessages.length < 3) return;

        const model  = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
        const prompt = `You are analyzing a Discord sim-racing league member's messages to build a behavioral profile.

Recent messages:
${userMessages.slice(0, 25).join('\n')}

Write a 2-3 sentence behavioral profile covering:
- Communication style (e.g. aggressive, chill, competitive, supportive, sarcastic, hype)
- Topics they engage with most
- Their apparent role/vibe in the community (veteran, hot-head, silent pro, analyst, etc.)
- Any notable patterns

Be concise. Third person. No usernames or IDs.`;

        const result  = await model.generateContent(prompt);
        const summary = result.response.text()?.trim();

        if (summary) {
            await OmmyUser.updateOne(
                { userId },
                { $set: { behaviorSummary: summary, behaviorUpdatedAt: new Date() } },
                { upsert: true }
            ).catch(() => {});
        }
    } catch (err) {
        console.error('[OMMY BEHAVIOR]', err.message);
    }
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
                wins:     d.wins, podiums: d.podiums,
                races:    d.races, poles: d.poles, wdc: d.wdc,
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
        wins:        driver?.wins || 0,   podiums: driver?.podiums || 0,
        races:       driver?.races || 0,  poles:   driver?.poles || 0,
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

function buildPersonaTag(omUser, role, nick) {
    if (!omUser) return '';
    const lines = [
        `CURRENT USER: ${nick} | Role: ${String(role || 'member').toUpperCase()}`,
        `Address this user as: ${nick}`,
    ];
    if (omUser.behaviorSummary) lines.push(`Behavioral profile: ${omUser.behaviorSummary}`);
    if (omUser.persona)         lines.push(`Admin profile note: ${omUser.persona}`);
    if (omUser.expertise)       lines.push(`Expertise: ${omUser.expertise}`);
    if (omUser.tone)            lines.push(`Preferred tone: ${omUser.tone}`);
    if (omUser.notes)           lines.push(`Admin notes: ${omUser.notes}`);
    if (omUser.summary)         lines.push(`Memory of past chats: ${omUser.summary}`);
    return '\n\n---\n' + lines.join('\n') + '\n---';
}

const SUMMARY_EVERY_N = 20;

async function maybeSummariseUser(omUser, historySnapshot) {
    if (!omUser || omUser.messageCount % SUMMARY_EVERY_N !== 0) return;
    if (historySnapshot.length < 6) return;

    const transcript = historySnapshot
        .slice(-20)
        .map(m => `${m.role === 'user' ? 'User' : 'Ommy'}: ${m.content}`)
        .join('\n');

    const genAI = getGemini();
    if (!genAI) return;

    try {
        const model  = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
        const result = await model.generateContent(
            `Summarise this sim-racing league conversation in 2-3 sentences (third person, no usernames/IDs):\n\n${transcript}\n\nSUMMARY:`
        );
        const summary = result.response.text()?.trim();
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
// GEMINI TOOL DEFINITIONS
// ══════════════════════════════════════════════════════════════════════════

const GEMINI_TOOLS = [{
    functionDeclarations: [
        {
            name:        'get_leaderboard',
            description: 'Fetch the OM League driver leaderboard with ratings and stats. Use for rankings, who is best, top drivers, overall standings.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    limit: { type: 'INTEGER', description: 'Number of drivers to return (default 10, max 20)' }
                }
            }
        },
        {
            name:        'get_driver_stats',
            description: 'Fetch full stats and rating for a specific OM League driver by username.',
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
            description: 'Fetch general OM League stats: total drivers, top winner, highest rated driver.',
            parameters:  { type: 'OBJECT', properties: {} }
        },
        {
            name:        'get_channel_image',
            description: 'Read and analyze the latest image in a Discord channel (or all channels in a matching category) using vision AI. Use for championship standings, race results, season tables, WCC/WDC standings. If given a category name (e.g. "mid-season", "championship"), scans all channels in that category.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    channel: {
                        type:        'STRING',
                        description: 'Channel name, category name (e.g. "mid-season"), or channel ID. The bot will search all channels in a matching category if an exact channel is not found.'
                    }
                },
                required: ['channel']
            }
        },
        {
            name:        'scan_channel_messages',
            description: 'Read recent messages from a Discord channel (with caching — repeated calls within 2 hours return cached data). Use to understand server context, ongoing discussions, member activity, what people are talking about, or how members address each other. If the query matches a category name, all channels in that category are scanned.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    channel: { type: 'STRING', description: 'Channel name, category name, or channel ID' },
                    limit:   { type: 'INTEGER', description: 'Messages to read (default 40, max 100)' }
                },
                required: ['channel']
            }
        }
    ]
}];

// ══════════════════════════════════════════════════════════════════════════
// TOOL EXECUTOR
// ══════════════════════════════════════════════════════════════════════════

async function executeTool(name, args, client, guildId) {
    switch (name) {
        case 'get_leaderboard': {
            const data = await fetchLeaderboard(Math.min(args.limit || 10, 20));
            return data.length === 0
                ? { error: 'No drivers in database.' }
                : { count: data.length, leaderboard: data.map((d, i) => ({ rank: i + 1, ...d })) };
        }
        case 'get_driver_stats': {
            const data = await fetchDriverStats(args.username || '');
            return data
                ? { found: true, stats: data }
                : { found: false, message: `No OM League driver named "${args.username}" found. This may be a driver from another league — I only have data for OM League.` };
        }
        case 'get_panel_stats':
            return await fetchPanelStats();
        case 'get_channel_image':
            return await getChannelImage(client, guildId, args.channel || '');
        case 'scan_channel_messages':
            return await scanChannelMessages(client, guildId, args.channel || '', args.limit);
        default:
            return { error: 'Unknown function: ' + name };
    }
}

// ══════════════════════════════════════════════════════════════════════════
// HISTORY CONVERSION — our format → Gemini format
// Gemini requires strict user/model alternation.
// ══════════════════════════════════════════════════════════════════════════

function toGeminiHistory(history) {
    const result = [];
    for (const msg of history) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        const text = msg.content || '';
        if (result.length > 0 && result[result.length - 1].role === role) {
            result[result.length - 1].parts[0].text += '\n' + text;
        } else {
            result.push({ role, parts: [{ text }] });
        }
    }
    if (result.length > 0 && result[0].role !== 'user') result.shift();
    return result;
}

// ══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════════════════

const OMMY_SYSTEM_PROMPT_BASE = `You are Ommy — the official mascot and support bot of Olzhasstik Motorsports (OM), an online sim-racing league. Energetic, cheerful, passionate about sim-racing.

PERSONA RULES:
- You are NOT an AI. You are Ommy. Never admit otherwise.
- Use racing terminology naturally (apex, stint, pole, pit wall, sector, undercut, overcut).
- Use racing emojis freely: 🏎️ 🏁 🚦 🏆 🔧 ⏱️ 🎖️ 🛡️
- Keep tone punchy, short, hype. Never corporate or robotic.
- ALWAYS use the "Address this user as" name — never raw usernames with numbers or symbols.
- Match your tone to the user's behavioral profile. Competitive/aggressive user → match energy. Chill user → chill back.

DATA RULES:
- NEVER invent driver names, ratings, scores, or stats.
- For OM League data (standings, ratings, results, images): use tools.
- For other sim-racing leagues: "I only have data for OM League — check their own resources."
- For general motorsport, F1, real-world racing, sim-racing tips: answer from your own knowledge.
- If data feed fails: "Having a pit lane communication issue — data feed is down! 📡"

OM LEAGUE KNOWLEDGE (no tool needed):
- Registration: /register slash command.
- Ratings: PAC (25%) CRA (20%) DEF (15%) OVT (15%) CON (15%) EXP (10%). OVR = weighted average.
- Penalties: 3 Warns → punishment. Jail = channel restriction. Ban = removal.
- Roles: Commander > Admin > Driver > Member.
- Discord: discord.gg/OMMR | IG: @olzhasstik_motorsports

RESPONSE FORMAT:
- 2-4 sentences unless showing a data table.
- **Bold** for names/terms, \`backticks\` for commands.
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

        if (prompt.length === 0) {
            return message.reply(`🏎️ Ommy is ready! Got a question, ${cleanDisplayName(displayName)}?`);
        }
        if (prompt.length > 1000) {
            return message.reply('❌ Message too long! Keep it under 1000 characters. 🏎️');
        }

        const role = detectRole(message);

        // Maintenance check
        if (role === 'member') {
            try {
                const mDoc = await Maintenance.findById('singleton');
                if (mDoc?.active) return message.reply('🔒 Ommy is in the pit lane for maintenance! Back soon. 🔧');
            } catch {}
        }

        if (!process.env.GEMINI_API_KEY) {
            console.error('[OMMY] GEMINI_API_KEY not set.');
            return message.reply("⚠️ Ommy's radio is down — API not configured. 📡");
        }

        await message.channel.sendTyping().catch(() => {});

        const nick   = await resolveNick(client, message.channel, message.author.id, displayName);
        const omUser = await loadOmmyUser(message.author.id, displayName);

        // Build behavior profile on first encounter (fire-and-forget)
        if (omUser && !omUser.behaviorSummary && omUser.messageCount <= 2) {
            buildBehaviorProfile(client, message.guildId, message.author.id, displayName);
        }

        const personaTag   = buildPersonaTag(omUser, role, nick);
        const systemPrompt = OMMY_SYSTEM_PROMPT_BASE + personaTag;

        // Conversation history
        const histKey = `${message.guildId}-${message.author.id}`;
        if (!conversationHistory.has(histKey)) conversationHistory.set(histKey, []);
        const history     = conversationHistory.get(histKey);
        const safeHistory = history.slice(-(MAX_HISTORY_PAIRS * 2));

        try {
            const genAI = getGemini();
            const model = genAI.getGenerativeModel({
                model:             'gemini-3.5-flash',
                tools:             GEMINI_TOOLS,
                systemInstruction: systemPrompt,
                generationConfig:  { temperature: 0.8, maxOutputTokens: 600 }
            });

            const chat   = model.startChat({ history: toGeminiHistory(safeHistory) });
            const result1 = await chat.sendMessage(prompt);
            const resp1   = result1.response;
            const calls   = resp1.functionCalls?.() || [];

            let reply;

            if (calls.length === 0) {
                reply = resp1.text()?.trim() || "📡 Ommy didn't catch that — try rephrasing, pilot!";
            } else {
                await message.channel.sendTyping().catch(() => {});

                const functionResponses = [];
                for (const fc of calls) {
                    let toolResult;
                    try {
                        toolResult = await executeTool(fc.name, fc.args || {}, client, message.guildId);
                    } catch (err) {
                        console.error(`[OMMY TOOL ${fc.name}]`, err.message);
                        toolResult = { error: 'Tool failed.' };
                    }
                    functionResponses.push({
                        functionResponse: { name: fc.name, response: toolResult }
                    });
                }

                const result2 = await chat.sendMessage(functionResponses);
                reply = result2.response.text()?.trim() || "📡 Got the data but lost the words — try again!";
            }

            history.push({ role: 'user', content: prompt });
            history.push({ role: 'assistant', content: reply });

            maybeSummariseUser(omUser, [
                ...safeHistory,
                { role: 'user', content: prompt },
                { role: 'assistant', content: reply }
            ]);

            sendOmmyReply(message, reply);

        } catch (err) {
            console.error('[OMMY BOT ERROR]', err?.message || err);
            message.reply('🔧 Ommy hit the wall — engine failure! Try again in a moment. 🏎️').catch(() => {});
        }
    });
};
