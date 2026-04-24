// commands/bet.js
// Race Bet System — Admin opens a bet, drivers place wagers, admin pays out.
// ─────────────────────────────────────────────────────────────────────────────
// /bet open    <question> <opt1> <opt2> [opt3] [opt4]  → admin opens a bet
// /bet place   <option_number> <amount>                → driver places wager
// /bet status                                          → see current bets
// /bet payout  <winning_option>                        → admin closes + pays
// /bet cancel                                          → admin cancels, refunds all
// ─────────────────────────────────────────────────────────────────────────────

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const Economy = require('../models/Economy');

// In-memory active bet (one bet per guild at a time)
// Structure: { guildId → { question, options, wagers: Map<userId, {option, amount}>, open, messageId, channelId } }
const activeBets = new Map();

function getBet(guildId) { return activeBets.get(guildId) ?? null; }

function buildStatusEmbed(bet, guildId) {
    const totals = bet.options.map((opt, i) => {
        const total = [...bet.wagers.values()]
            .filter(w => w.option === i)
            .reduce((s, w) => s + w.amount, 0);
        return { opt, total, idx: i + 1 };
    });

    const totalPool = totals.reduce((s, t) => s + t.total, 0);

    const fields = totals.map(t => {
        const pct = totalPool > 0 ? ((t.total / totalPool) * 100).toFixed(1) : '0.0';
        const odds = t.total > 0 ? (totalPool / t.total).toFixed(2) : '∞';
        return {
            name: `Option ${t.idx}: ${t.opt}`,
            value: `**${t.total.toLocaleString()} 🪙** (${pct}%) — odds: **×${odds}**`,
            inline: false
        };
    });

    return new EmbedBuilder()
        .setColor(bet.open ? 0x00c851 : 0xff4444)
        .setTitle(`🏁 Race Bet${bet.open ? ' — OPEN' : ' — CLOSED'}`)
        .setDescription(`**${bet.question}**`)
        .addFields(...fields, {
            name: '💰 Total Pool',
            value: `**${totalPool.toLocaleString()} 🪙** from **${bet.wagers.size}** bettors`,
            inline: false
        })
        .setFooter({ text: `Place your bet: /bet place <option_number> <amount>` });
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bet')
        .setDescription('Race betting system.')

        // /bet open
        .addSubcommand(sub =>
            sub.setName('open')
                .setDescription('(Admin) Open a new race bet.')
                .addStringOption(opt => opt.setName('question').setDescription('The bet question').setRequired(true))
                .addStringOption(opt => opt.setName('option1').setDescription('Option 1').setRequired(true))
                .addStringOption(opt => opt.setName('option2').setDescription('Option 2').setRequired(true))
                .addStringOption(opt => opt.setName('option3').setDescription('Option 3 (optional)'))
                .addStringOption(opt => opt.setName('option4').setDescription('Option 4 (optional)'))
        )

        // /bet place
        .addSubcommand(sub =>
            sub.setName('place')
                .setDescription('Place your wager on an option.')
                .addIntegerOption(opt =>
                    opt.setName('option')
                        .setDescription('Option number (1, 2, 3...)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(4)
                )
                .addIntegerOption(opt =>
                    opt.setName('amount')
                        .setDescription('Amount to wager')
                        .setRequired(true)
                        .setMinValue(100)
                        .setMaxValue(100000)
                )
        )

        // /bet status
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('View current bet standings.')
        )

        // /bet payout
        .addSubcommand(sub =>
            sub.setName('payout')
                .setDescription('(Admin) Close bet and pay out winners.')
                .addIntegerOption(opt =>
                    opt.setName('winner')
                        .setDescription('Winning option number')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(4)
                )
        )

        // /bet cancel
        .addSubcommand(sub =>
            sub.setName('cancel')
                .setDescription('(Admin) Cancel the current bet and refund all wagers.')
        ),

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        // ── /bet open ──────────────────────────────────────────────────────
        if (sub === 'open') {
            if (!isAdmin) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });
            if (getBet(guildId)) return interaction.reply({ content: '❌ A bet is already open. Close it first with `/bet payout` or `/bet cancel`.', ephemeral: true });

            const question = interaction.options.getString('question');
            const options  = [
                interaction.options.getString('option1'),
                interaction.options.getString('option2'),
                interaction.options.getString('option3'),
                interaction.options.getString('option4')
            ].filter(Boolean);

            const bet = {
                question,
                options,
                wagers: new Map(),
                open: true,
                channelId: interaction.channel.id
            };

            activeBets.set(guildId, bet);

            const embed = buildStatusEmbed(bet, guildId);
            const msg   = await interaction.reply({ embeds: [embed], fetchReply: true });
            bet.messageId = msg.id;

            return;
        }

        // ── /bet place ─────────────────────────────────────────────────────
        if (sub === 'place') {
            const bet = getBet(guildId);
            if (!bet || !bet.open) return interaction.reply({ content: '❌ No open bet right now.', ephemeral: true });

            const optIdx = interaction.options.getInteger('option') - 1;
            const amount = interaction.options.getInteger('amount');

            if (optIdx >= bet.options.length) {
                return interaction.reply({ content: `❌ Invalid option. Choose 1–${bet.options.length}.`, ephemeral: true });
            }

            // Already placed?
            if (bet.wagers.has(interaction.user.id)) {
                return interaction.reply({ content: '❌ You already placed a bet. One wager per person.', ephemeral: true });
            }

            let wallet = await Economy.findOne({ userId: interaction.user.id });
            if (!wallet) wallet = new Economy({ userId: interaction.user.id });

            if (wallet.coins < amount) {
                return interaction.reply({
                    content: `❌ Not enough coins. Balance: **${wallet.coins.toLocaleString()} 🪙**`,
                    ephemeral: true
                });
            }

            // Deduct
            wallet.coins -= amount;
            await wallet.save();

            bet.wagers.set(interaction.user.id, { option: optIdx, amount });

            await interaction.reply({
                content: `✅ Bet placed! **${amount.toLocaleString()} 🪙** on **Option ${optIdx + 1}: ${bet.options[optIdx]}**`,
                ephemeral: true
            });

            // Update status message
            try {
                const ch  = await interaction.client.channels.fetch(bet.channelId);
                const msg = await ch.messages.fetch(bet.messageId);
                await msg.edit({ embeds: [buildStatusEmbed(bet, guildId)] });
            } catch {}

            return;
        }

        // ── /bet status ────────────────────────────────────────────────────
        if (sub === 'status') {
            const bet = getBet(guildId);
            if (!bet) return interaction.reply({ content: '❌ No active bet.', ephemeral: true });
            return interaction.reply({ embeds: [buildStatusEmbed(bet, guildId)] });
        }

        // ── /bet payout ────────────────────────────────────────────────────
        if (sub === 'payout') {
            if (!isAdmin) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

            const bet = getBet(guildId);
            if (!bet) return interaction.reply({ content: '❌ No active bet to close.', ephemeral: true });

            const winnerIdx = interaction.options.getInteger('winner') - 1;
            if (winnerIdx >= bet.options.length) {
                return interaction.reply({ content: `❌ Invalid option number.`, ephemeral: true });
            }

            bet.open = false;

            // Calculate pool
            const totalPool = [...bet.wagers.values()].reduce((s, w) => s + w.amount, 0);
            const winnerPool = [...bet.wagers.values()]
                .filter(w => w.option === winnerIdx)
                .reduce((s, w) => s + w.amount, 0);

            const winners = [...bet.wagers.entries()].filter(([, w]) => w.option === winnerIdx);

            let payoutLines = [];

            if (winnerPool === 0 || winners.length === 0) {
                // No winners — house keeps the pool
                payoutLines.push('No one bet on the winning option. House wins the pool. 🏠');
            } else {
                // Proportional payout from total pool
                for (const [userId, wager] of winners) {
                    const share  = wager.amount / winnerPool;
                    const payout = Math.floor(totalPool * share);

                    let wallet = await Economy.findOne({ userId });
                    if (!wallet) wallet = new Economy({ userId });
                    await wallet.addCoins(payout);

                    payoutLines.push(`<@${userId}> — bet **${wager.amount.toLocaleString()} 🪙** → won **${payout.toLocaleString()} 🪙**`);
                }
            }

            activeBets.delete(guildId);

            const embed = new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle('🏁 Bet Closed — Results')
                .setDescription(
                    `**${bet.question}**\n\n` +
                    `🏆 Winning option: **${bet.options[winnerIdx]}**\n\n` +
                    payoutLines.join('\n')
                )
                .addFields(
                    { name: 'Total Pool', value: `${totalPool.toLocaleString()} 🪙`, inline: true },
                    { name: 'Winners',    value: `${winners.length}`,                inline: true }
                )
                .setFooter({ text: 'OM Casino' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ── /bet cancel ────────────────────────────────────────────────────
        if (sub === 'cancel') {
            if (!isAdmin) return interaction.reply({ content: '❌ Admins only.', ephemeral: true });

            const bet = getBet(guildId);
            if (!bet) return interaction.reply({ content: '❌ No active bet.', ephemeral: true });

            // Refund all
            let refunded = 0;
            for (const [userId, wager] of bet.wagers.entries()) {
                let wallet = await Economy.findOne({ userId });
                if (!wallet) wallet = new Economy({ userId });
                await wallet.addCoins(wager.amount);
                refunded++;
            }

            activeBets.delete(guildId);

            return interaction.reply({
                content: `🚫 Bet cancelled. Refunded **${refunded}** bettor(s).`,
            });
        }
    }
};
