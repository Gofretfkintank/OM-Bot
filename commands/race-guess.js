// commands/race-guess.js
// Driver prediction game — guess who finishes P1 before /results is posted.
// ─────────────────────────────────────────────────────────────────────────────
// /race-guess open                     → admin opens predictions for next race
// /race-guess pick  <@driver>          → predict a driver wins P1
// /race-guess close <@actual_winner>   → admin closes + pays out correct picks
// /race-guess status                   → see who picked what
// ─────────────────────────────────────────────────────────────────────────────

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const Economy = require('../models/Economy');

const ENTRY_COST  = 50;  // costs 50 coins to enter
const WIN_PAYOUT  = 300; // correct pick gets 300 coins back (6x)

// In-memory per guild
const activeGuess = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('race-guess')
        .setDescription('Predict the race winner before results drop.')

        .addSubcommand(sub =>
            sub.setName('open')
                .setDescription('(Admin) Open predictions for the next race.')
                .addStringOption(opt =>
                    opt.setName('track')
                        .setDescription('Race track name')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('pick')
                .setDescription(`Pick who wins P1. Costs ${ENTRY_COST} 🪙.`)
                .addUserOption(opt =>
                    opt.setName('driver')
                        .setDescription('Driver you predict wins')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('(Admin) Close predictions and pay out correct picks.')
                .addUserOption(opt =>
                    opt.setName('winner')
                        .setDescription('Actual race winner (P1)')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('See current predictions.')
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        // ── /race-guess open ───────────────────────────────────────────────
        if (sub === 'open') {
            if (!isAdmin) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
            if (activeGuess.has(guildId)) return interaction.reply({ content: '❌ Predictions already open.', ephemeral: true });

            const track = interaction.options.getString('track');
            activeGuess.set(guildId, { track, picks: new Map(), open: true });

            const embed = new EmbedBuilder()
                .setColor(0x00c851)
                .setTitle(`🏎️ Race Predictions Open — ${track}`)
                .setDescription(
                    `Who wins **P1**?\n\n` +
                    `Entry cost: **${ENTRY_COST} 🪙** | Correct pick: **+${WIN_PAYOUT} 🪙**\n\n` +
                    `Use \`/race-guess pick @driver\` to enter.`
                )
                .setFooter({ text: 'One pick per person.' });

            return interaction.reply({ embeds: [embed] });
        }

        // ── /race-guess pick ───────────────────────────────────────────────
        if (sub === 'pick') {
            const game = activeGuess.get(guildId);
            if (!game || !game.open) return interaction.reply({ content: '❌ No open predictions right now.', ephemeral: true });
            if (game.picks.has(interaction.user.id)) return interaction.reply({ content: '❌ You already made your pick.', ephemeral: true });

            const driverUser = interaction.options.getUser('driver');

            let wallet = await Economy.findOne({ userId: interaction.user.id });
            if (!wallet) wallet = new Economy({ userId: interaction.user.id });

            if (wallet.coins < ENTRY_COST) {
                return interaction.reply({
                    content: `❌ Need **${ENTRY_COST} 🪙** to enter. Your balance: **${wallet.coins.toLocaleString()} 🪙**`,
                    ephemeral: true
                });
            }

            wallet.coins -= ENTRY_COST;
            await wallet.save();

            game.picks.set(interaction.user.id, driverUser.id);

            return interaction.reply({
                content: `✅ Pick locked in! You bet **${ENTRY_COST} 🪙** on <@${driverUser.id}> winning P1.`,
                ephemeral: true
            });
        }

        // ── /race-guess status ─────────────────────────────────────────────
        if (sub === 'status') {
            const game = activeGuess.get(guildId);
            if (!game) return interaction.reply({ content: '❌ No active predictions.', ephemeral: true });

            // Group picks by driver
            const grouped = new Map();
            for (const [picker, driverId] of game.picks.entries()) {
                if (!grouped.has(driverId)) grouped.set(driverId, []);
                grouped.get(driverId).push(picker);
            }

            const lines = [...grouped.entries()].map(([driverId, pickers]) =>
                `<@${driverId}> ← ${pickers.map(p => `<@${p}>`).join(', ')}`
            );

            const embed = new EmbedBuilder()
                .setColor(0xf5c518)
                .setTitle(`🏁 Predictions — ${game.track}`)
                .setDescription(
                    lines.length > 0
                        ? lines.join('\n')
                        : 'No picks yet.'
                )
                .setFooter({ text: `${game.picks.size} entries  |  Entry: ${ENTRY_COST} 🪙  |  Win: ${WIN_PAYOUT} 🪙` });

            return interaction.reply({ embeds: [embed] });
        }

        // ── /race-guess close ──────────────────────────────────────────────
        if (sub === 'close') {
            if (!isAdmin) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

            const game = activeGuess.get(guildId);
            if (!game) return interaction.reply({ content: '❌ No active predictions.', ephemeral: true });

            const actualWinner = interaction.options.getUser('winner');
            game.open = false;

            const winners = [...game.picks.entries()].filter(([, picked]) => picked === actualWinner.id);

            let lines = [];

            for (const [userId] of winners) {
                let wallet = await Economy.findOne({ userId });
                if (!wallet) wallet = new Economy({ userId });
                await wallet.addCoins(WIN_PAYOUT);
                lines.push(`<@${userId}> ✅ **+${WIN_PAYOUT} 🪙**`);
            }

            const losers = game.picks.size - winners.length;
            activeGuess.delete(guildId);

            const embed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle(`🏆 Race Predictions — Results`)
                .setDescription(
                    `**${game.track}** — P1: <@${actualWinner.id}>\n\n` +
                    (lines.length > 0
                        ? `**Winners:**\n${lines.join('\n')}`
                        : `Nobody predicted correctly. House takes the pool.`)
                )
                .addFields(
                    { name: 'Correct picks', value: `${winners.length}`, inline: true },
                    { name: 'Wrong picks',   value: `${losers}`,         inline: true },
                    { name: 'Payout each',   value: `${WIN_PAYOUT} 🪙`, inline: true }
                )
                .setFooter({ text: 'OM Casino' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    }
};
