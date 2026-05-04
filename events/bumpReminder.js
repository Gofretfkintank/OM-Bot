//--------------------------------
// BUMP REMINDER EVENT
// Listens in the Bump Us channel for Carl and Disboard
// bump confirmations, then sends a reminder when the
// cooldown expires.
//
// Carl   → 4 hour personal cooldown → mentions bumper
// Disboard → 2 hour server cooldown → mentions @Bumpers role
//--------------------------------

const { EmbedBuilder } = require('discord.js');
const BumpReminder = require('../models/BumpReminder');

//--------------------------------
// CONFIG
//--------------------------------
const BUMP_CHANNEL_ID = '1500791833012338901';
const BUMPERS_ROLE_ID = '1500811475713916958';

// Cooldowns in milliseconds
const CARL_COOLDOWN_MS    = 6 * 60 * 60 * 1000; // 6 hours
const DISBOARD_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

// Carl's bot user ID (official)
const CARL_BOT_ID     = '235148962103951360';
// Disboard's bot user ID (official)
const DISBOARD_BOT_ID = '302050872383242240';

//--------------------------------
// ACTIVE TIMER MAP
// Key: 'carl_<userId>' | 'disboard'
// Value: setTimeout handle
//--------------------------------
const timerMap = new Map();

//--------------------------------
// FIRE HELPERS
//--------------------------------
async function fireCarlReminder(client, reminderId, userId) {
    timerMap.delete(`carl_${userId}`);

    const record = await BumpReminder.findById(reminderId).catch(() => null);
    if (!record || record.notified) return;

    record.notified = true;
    await record.save();

    const channel = await client.channels.fetch(BUMP_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(0x00C853)
        .setTitle('🟢 Carl Bump Available!')
        .setDescription(
            `<@${userId}>, your Carl server discovery bump cooldown has expired!\n\n` +
            `Head over to [Carl's Server Discovery](https://carl.gg/server-discovery) and bump us again to keep us climbing the rankings! 📈`
        )
        .setFooter({ text: 'Olzhasstik Motorsports • Bump System' })
        .setTimestamp();

    await channel.send({ content: `<@${userId}>`, embeds: [embed] }).catch(() => {});
}

async function fireDisboardReminder(client, reminderId) {
    timerMap.delete('disboard');

    const record = await BumpReminder.findById(reminderId).catch(() => null);
    if (!record || record.notified) return;

    record.notified = true;
    await record.save();

    const channel = await client.channels.fetch(BUMP_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📣 Disboard Bump Ready!')
        .setDescription(
            `The server bump cooldown on Disboard has ended!\n\n` +
            `Use \`/bump\` in this channel to push **Olzhasstik Motorsports** up the Disboard rankings!\n` +
            `Every bump helps new drivers find us 🏁`
        )
        .setFooter({ text: 'Olzhasstik Motorsports • Bump System' })
        .setTimestamp();

    await channel.send({ content: `<@&${BUMPERS_ROLE_ID}>`, embeds: [embed] }).catch(() => {});
}

//--------------------------------
// SCHEDULE HELPERS
//--------------------------------
function scheduleCarlReminder(client, record) {
    const key = `carl_${record.userId}`;
    const remaining = record.remindAt - Date.now();

    if (timerMap.has(key)) {
        clearTimeout(timerMap.get(key));
        timerMap.delete(key);
    }

    if (remaining <= 0) return;

    const handle = setTimeout(
        () => fireCarlReminder(client, record._id.toString(), record.userId),
        remaining
    );
    timerMap.set(key, handle);
}

function scheduleDisboardReminder(client, record) {
    const key = 'disboard';
    const remaining = record.remindAt - Date.now();

    if (timerMap.has(key)) {
        clearTimeout(timerMap.get(key));
        timerMap.delete(key);
    }

    if (remaining <= 0) return;

    const handle = setTimeout(
        () => fireDisboardReminder(client, record._id.toString()),
        remaining
    );
    timerMap.set(key, handle);
}

//--------------------------------
// DETECTION HELPERS
//--------------------------------
function isCarlBump(message) {
    // Carl confirms with a message containing this text
    return (
        message.author.id === CARL_BOT_ID &&
        message.content.includes('successfully bumped this server')
    );
}

function isDisboardBump(message) {
    // Disboard confirms via embed
    if (message.author.id !== DISBOARD_BOT_ID) return false;

    // Check embed description for bump confirmation
    const embeds = message.embeds;
    if (!embeds || embeds.length === 0) return false;

    return embeds.some(e =>
        (e.description && e.description.toLowerCase().includes('bump done')) ||
        (e.title && e.title.toLowerCase().includes('bump done'))
    );
}

//--------------------------------
// MAIN EXPORT
//--------------------------------
module.exports = (client) => {

    //--------------------------------
    // READY — restore pending reminders from DB
    //--------------------------------
    client.once('ready', async () => {
        const pending = await BumpReminder.find({ notified: false }).catch(() => []);

        let restored = 0;
        for (const record of pending) {
            if (record.remindAt <= Date.now()) {
                // Already past — fire immediately then mark done
                if (record.type === 'carl' && record.userId) {
                    await fireCarlReminder(client, record._id.toString(), record.userId);
                } else if (record.type === 'disboard') {
                    await fireDisboardReminder(client, record._id.toString());
                }
                continue;
            }

            if (record.type === 'carl' && record.userId) {
                scheduleCarlReminder(client, record);
            } else if (record.type === 'disboard') {
                scheduleDisboardReminder(client, record);
            }
            restored++;
        }

        console.log(`✅ ${restored} bump reminder(s) restored`);
    });

    //--------------------------------
    // MESSAGE CREATE — detect bump confirmations
    //--------------------------------
    client.on('messageCreate', async (message) => {
        // Only listen in the Bump Us channel
        if (message.channel.id !== BUMP_CHANNEL_ID) return;

        //------------------------------------------------
        // CARL BUMP DETECTED
        // Carl sends a plain message (not an embed) in the
        // channel when someone successfully bumps.
        // We look at message.reference to find who triggered it,
        // or fall back to the message before Carl's in the channel.
        //------------------------------------------------
        if (isCarlBump(message)) {
            // Try to find the bumper via the replied-to message
            let bumperId = null;

            if (message.reference?.messageId) {
                const ref = await message.channel.messages
                    .fetch(message.reference.messageId)
                    .catch(() => null);
                if (ref && !ref.author.bot) bumperId = ref.author.id;
            }

            // Fallback: fetch recent messages and find the last human message
            if (!bumperId) {
                const recent = await message.channel.messages
                    .fetch({ limit: 10, before: message.id })
                    .catch(() => null);

                if (recent) {
                    const lastHuman = recent
                        .filter(m => !m.author.bot)
                        .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
                        .first();

                    if (lastHuman) bumperId = lastHuman.author.id;
                }
            }

            if (!bumperId) return;

            const remindAt = Date.now() + CARL_COOLDOWN_MS;

            // Upsert: one reminder per user, replace any existing pending one
            await BumpReminder.deleteMany({ type: 'carl', userId: bumperId, notified: false });
            const record = await BumpReminder.create({ type: 'carl', userId: bumperId, remindAt });

            scheduleCarlReminder(client, record);

            console.log(`[BUMP] Carl bump by ${bumperId} — reminder scheduled in 4h`);
            return;
        }

        //------------------------------------------------
        // DISBOARD BUMP DETECTED
        //------------------------------------------------
        if (isDisboardBump(message)) {
            const remindAt = Date.now() + DISBOARD_COOLDOWN_MS;

            // Only one Disboard reminder active at a time
            await BumpReminder.deleteMany({ type: 'disboard', notified: false });
            const record = await BumpReminder.create({ type: 'disboard', remindAt });

            scheduleDisboardReminder(client, record);

            console.log(`[BUMP] Disboard bump detected — reminder scheduled in 2h`);
            return;
        }
    });
};
