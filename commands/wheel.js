// commands/wheel.js — Spin the Wheel! Random winner picker with animation
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

// Trophy emojis for winners
const MEDALS  = ['🥇', '🥈', '🥉', '🏅', '🎖️'];
const SPIN_FRAMES = ['🌀', '💫', '⭐', '✨', '💥', '🔥'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wheel')
        .setDescription('🎡 Spin the wheel and pick random winners from your list!')
        .addStringOption(opt =>
            opt.setName('entries')
                .setDescription('Comma-separated list of names/items (e.g. Hasan, Ali, Veli, Mehmet)')
                .setRequired(true)
        )
        .addIntegerOption(opt =>
            opt.setName('winners')
                .setDescription('How many winners to pick (default: 3)')
                .setMinValue(1)
                .setMaxValue(5)
        ),

    async execute(interaction) {
        const raw          = interaction.options.getString('entries');
        const winnerCount  = interaction.options.getInteger('winners') ?? 3;

        // Parse entries — split by comma, trim, remove empties, deduplicate
        const entries = [...new Set(
            raw.split(',')
               .map(e => e.trim())
               .filter(e => e.length > 0)
        )];

        // Need at least winnerCount+1 entries to make it interesting
        if (entries.length < 2) {
            return interaction.reply({
                content: '❌ At least 2 entries are required to spin the wheel!',
                ephemeral: true
            });
        }
        if (entries.length < winnerCount) {
            return interaction.reply({
                content: `❌ You want **${winnerCount} winners** but only provided **${entries.length} entries**. Add more entries or reduce the winner count.`,
                ephemeral: true
            });
        }

        // ─── Spin animation ─────────────────────────────────────────────────
        const spinEmbed = () => new EmbedBuilder()
            .setColor(0xf5c518)
            .setTitle(`🎡 Spinning the Wheel...  ${SPIN_FRAMES[Math.floor(Math.random() * SPIN_FRAMES.length)]}`)
            .setDescription(
                `**Entries (${entries.length}):**\n` +
                entries.map(e => `> ${e}`).join('\n') +
                `\n\n⏳ Picking **${winnerCount}** winner${winnerCount > 1 ? 's' : ''}...`
            )
            .setFooter({ text: 'Olzhasstik Motorsports — Wheel Spin' });

        const msg = await interaction.reply({ embeds: [spinEmbed()], fetchReply: true });

        // Animate for ~2.5 seconds (5 frames × 500ms)
        for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 500));
            await msg.edit({ embeds: [spinEmbed()] }).catch(() => {});
        }

        // ─── Pick winners (Fisher-Yates shuffle → take first N) ─────────────
        const pool     = [...entries];
        const winners  = [];
        for (let i = pool.length - 1; i > 0 && winners.length < winnerCount; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        // After shuffle, just take the first winnerCount from the shuffled pool
        const shuffled = [...entries].sort(() => Math.random() - 0.5);
        for (let i = 0; i < winnerCount; i++) winners.push(shuffled[i]);

        // ─── Reveal animation — reveal winners one-by-one ────────────────────
        const revealed = [];
        for (let i = 0; i < winners.length; i++) {
            await new Promise(r => setTimeout(r, 700));
            revealed.push(winners[i]);

            const revealEmbed = new EmbedBuilder()
                .setColor(i === winners.length - 1 ? 0x00c851 : 0xf5c518)
                .setTitle(i === winners.length - 1
                    ? `🎉 All ${winnerCount} Winner${winnerCount > 1 ? 's' : ''} Revealed!`
                    : `⭐ Revealing... (${i + 1}/${winnerCount})`
                )
                .setDescription(
                    revealed.map((w, idx) => `${MEDALS[idx] || '🏅'} **${w}**`).join('\n') +
                    (i < winners.length - 1 ? '\n\n🎡 *Spinning for next...*' : '')
                )
                .setFooter({ text: `${entries.length} entries · ${winnerCount} winner${winnerCount > 1 ? 's' : ''}  |  Olzhasstik Motorsports` });

            await msg.edit({ embeds: [revealEmbed] }).catch(() => {});
        }

        // ─── Final result with Re-spin button ────────────────────────────────
        await new Promise(r => setTimeout(r, 600));

        const loserList = entries.filter(e => !winners.includes(e));

        const finalEmbed = new EmbedBuilder()
            .setColor(0x00c851)
            .setTitle(`🎡 Wheel Result — ${winnerCount} Winner${winnerCount > 1 ? 's' : ''}!`)
            .addFields(
                {
                    name: `🏆 Winner${winnerCount > 1 ? 's' : ''}`,
                    value: winners.map((w, i) => `${MEDALS[i] || '🏅'} **${w}**`).join('\n'),
                    inline: false
                },
                {
                    name: `📋 All Entries (${entries.length})`,
                    value: entries.map(e => winners.includes(e) ? `✅ ~~${e}~~` : `• ${e}`).join('\n'),
                    inline: false
                }
            )
            .setFooter({ text: `Spun by ${interaction.user.displayName || interaction.user.username}  |  Olzhasstik Motorsports` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('wheel_respin')
                .setLabel('🎡 Re-spin')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('wheel_done')
                .setLabel('✅ Done')
                .setStyle(ButtonStyle.Secondary)
        );

        await msg.edit({ embeds: [finalEmbed], components: [row] });

        // ─── Re-spin button handler ───────────────────────────────────────────
        const collector = msg.createMessageComponentCollector({ time: 120_000 });

        collector.on('collect', async i => {
            if (i.customId === 'wheel_done') {
                collector.stop('done');
                return i.update({ components: [] });
            }

            if (i.customId === 'wheel_respin') {
                // Only allow host or admins to re-spin
                if (i.user.id !== interaction.user.id && !i.memberPermissions?.has('Administrator')) {
                    return i.reply({ content: '❌ Only the person who ran this command (or an admin) can re-spin.', ephemeral: true });
                }

                await i.deferUpdate();

                // Animate
                for (let f = 0; f < 4; f++) {
                    await new Promise(r => setTimeout(r, 400));
                    await msg.edit({ embeds: [spinEmbed()], components: [] }).catch(() => {});
                }

                // New draw
                const newShuffled = [...entries].sort(() => Math.random() - 0.5);
                const newWinners  = newShuffled.slice(0, winnerCount);

                const newFinal = new EmbedBuilder()
                    .setColor(0x00c851)
                    .setTitle(`🎡 Wheel Re-spun — ${winnerCount} New Winner${winnerCount > 1 ? 's' : ''}!`)
                    .addFields(
                        {
                            name: `🏆 Winner${winnerCount > 1 ? 's' : ''}`,
                            value: newWinners.map((w, idx) => `${MEDALS[idx] || '🏅'} **${w}**`).join('\n'),
                            inline: false
                        },
                        {
                            name: `📋 All Entries (${entries.length})`,
                            value: entries.map(e => newWinners.includes(e) ? `✅ ~~${e}~~` : `• ${e}`).join('\n'),
                            inline: false
                        }
                    )
                    .setFooter({ text: `Re-spun by ${i.user.displayName || i.user.username}  |  Olzhasstik Motorsports` })
                    .setTimestamp();

                await msg.edit({ embeds: [newFinal], components: [row] }).catch(() => {});
            }
        });

        collector.on('end', reason => {
            if (reason !== 'done') {
                msg.edit({ components: [] }).catch(() => {});
            }
        });
    }
};
