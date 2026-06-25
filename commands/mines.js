// commands/mines.js
// Mines — minesweeper-style gambling.
// Reveal safe squares on a 4×5 grid to grow your multiplier.
// Hit a mine and lose everything. Cash out anytime.
// ─────────────────────────────────────────────────────────────────────────────

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const Economy = require('../models/Economy');

const cooldowns   = new Map();
const COOLDOWN_MS = 30_000;

const COLS  = 5;
const ROWS  = 4;
const TOTAL = COLS * ROWS; // 20 squares

// ── Grid helpers ──────────────────────────────────────────────────────────────
function buildMineSet(count) {
    const indices = Array.from({ length: TOTAL }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return new Set(indices.slice(0, count));
}

// Multiplier grows each pick based on inverse-probability, 3% house edge per reveal
function calcMult(revealCount, mineCount) {
    let mult = 1;
    for (let i = 0; i < revealCount; i++) {
        const squaresLeft = TOTAL - i;
        const safesLeft   = (TOTAL - mineCount) - i;
        if (safesLeft <= 0) break;
        mult *= (squaresLeft / safesLeft) * 0.97;
    }
    return Math.floor(mult * 100) / 100;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mines')
        .setDescription('Reveal safe squares to grow your multiplier. Hit a mine and lose everything!')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(100)
                .setMaxValue(20000)
        )
        .addIntegerOption(opt =>
            opt.setName('mines')
                .setDescription('Number of mines on the grid (1-10)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10)
        ),

    async execute(interaction) {
        const userId    = interaction.user.id;
        const last      = cooldowns.get(userId);
        if (last && Date.now() - last < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
            return interaction.reply({ content: `⏳ Cooldown: **${left}s** remaining.`, ephemeral: true });
        }

        const bet       = interaction.options.getInteger('bet');
        const mineCount = interaction.options.getInteger('mines');

        let wallet = await Economy.findOne({ userId });
        if (!wallet) wallet = new Economy({ userId });

        if (wallet.coins < bet) {
            return interaction.reply({
                content: `❌ Not enough coins. Balance: **${wallet.coins.toLocaleString()} 🪙**`,
                ephemeral: true
            });
        }

        cooldowns.set(userId, Date.now());
        wallet.coins -= bet;
        await wallet.save();

        const mineSet  = buildMineSet(mineCount);
        const revealed = new Set();
        let   hitIdx   = null;
        let   gameOver = false;

        const mult = () => calcMult(revealed.size, mineCount);
        const pot  = () => Math.floor(bet * mult());

        // ── Grid component builder ────────────────────────────────────────────
        const buildComponents = (disabled = false, showAll = false) => {
            const actionRows = [];

            for (let r = 0; r < ROWS; r++) {
                const ar = new ActionRowBuilder();
                for (let c = 0; c < COLS; c++) {
                    const idx = r * COLS + c;
                    let label, style, dis;

                    if (idx === hitIdx) {
                        // The mine that was hit
                        label = '💥'; style = ButtonStyle.Danger;   dis = true;
                    } else if (revealed.has(idx)) {
                        // Revealed safe square
                        label = '💎'; style = ButtonStyle.Success;  dis = true;
                    } else if (showAll && mineSet.has(idx)) {
                        // Hidden mine revealed at game end
                        label = '💣'; style = ButtonStyle.Danger;   dis = true;
                    } else if (showAll) {
                        // Safe but untouched — revealed at game end
                        label = '🔷'; style = ButtonStyle.Secondary; dis = true;
                    } else {
                        // Unknown square — clickable
                        label = '✨'; style = ButtonStyle.Secondary;
                        dis = disabled || gameOver;
                    }

                    ar.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`mine_${idx}`)
                            .setLabel(label)
                            .setStyle(style)
                            .setDisabled(dis)
                    );
                }
                actionRows.push(ar);
            }

            // Cash-out row (5th action row)
            const cashLabel = revealed.size > 0
                ? `💰 Cash Out — ${pot().toLocaleString()} 🪙  (×${mult()})`
                : '💰 Cash Out  (reveal a square first)';

            actionRows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('mine_cashout')
                    .setLabel(cashLabel)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(disabled || gameOver || revealed.size === 0)
            ));

            return actionRows;
        };

        // ── Embed builder ─────────────────────────────────────────────────────
        const makeEmbed = (status = 'playing') => {
            const m = mult();
            const p = pot();
            return new EmbedBuilder()
                .setColor(
                    status === 'lose' ? 0xff4444 :
                    status === 'win'  ? 0x00c851 : 0x2f3136
                )
                .setTitle('💣 Mines')
                .setDescription(
                    status === 'lose' ? `💥 **BOOM!** You hit a mine and lost **${bet.toLocaleString()} 🪙**.`
                  : status === 'win'  ? `💰 Cashed out **${p.toLocaleString()} 🪙** (×${m})!`
                  : `Reveal safe squares to grow your multiplier.\n**${mineCount} mine${mineCount > 1 ? 's' : ''}** are hidden on the grid.`
                )
                .addFields(
                    { name: 'Bet',        value: `${bet.toLocaleString()} 🪙`, inline: true },
                    { name: 'Mines',      value: `${mineCount}`,               inline: true },
                    { name: 'Revealed',   value: `${revealed.size}`,            inline: true },
                    { name: 'Multiplier', value: `×${m}`,                       inline: true },
                    { name: 'Pot',        value: `${p.toLocaleString()} 🪙`,   inline: true }
                )
                .setFooter({ text: 'OM Casino — Mines' });
        };

        const msg = await interaction.reply({
            embeds:     [makeEmbed()],
            components: buildComponents(),
            fetchReply: true
        });

        // ── Collector ─────────────────────────────────────────────────────────
        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter:        i => i.user.id === userId,
            time:          120_000
        });

        collector.on('collect', async i => {
            await i.deferUpdate();

            // ── Cash out ──────────────────────────────────────────────────────
            if (i.customId === 'mine_cashout') {
                if (revealed.size === 0) return;
                const p = pot();
                const fw = await Economy.findOne({ userId });
                await fw.addCoins(p);
                gameOver = true;
                collector.stop('win');
                return msg.edit({ embeds: [makeEmbed('win')], components: buildComponents(true, true) });
            }

            const idx = parseInt(i.customId.replace('mine_', ''), 10);

            // ── Mine hit ──────────────────────────────────────────────────────
            if (mineSet.has(idx)) {
                hitIdx   = idx;
                gameOver = true;
                collector.stop('lose');
                return msg.edit({ embeds: [makeEmbed('lose')], components: buildComponents(true, true) });
            }

            // ── Safe square ───────────────────────────────────────────────────
            revealed.add(idx);

            // All safe squares cleared
            if (revealed.size >= TOTAL - mineCount) {
                const p = pot();
                const fw = await Economy.findOne({ userId });
                await fw.addCoins(p);
                gameOver = true;
                collector.stop('win');
                return msg.edit({ embeds: [makeEmbed('win')], components: buildComponents(true, true) });
            }

            return msg.edit({ embeds: [makeEmbed()], components: buildComponents() });
        });

        collector.on('end', async (_, reason) => {
            if (['win', 'lose'].includes(reason)) return;
            // Timeout
            if (revealed.size > 0) {
                const p = pot();
                const fw = await Economy.findOne({ userId });
                await fw.addCoins(p);
                await msg.edit({ embeds: [makeEmbed('win')], components: buildComponents(true, true) });
            } else {
                // No moves made — refund
                const fw = await Economy.findOne({ userId });
                await fw.addCoins(bet);
                await msg.edit({
                    embeds: [new EmbedBuilder()
                        .setColor(0x888888)
                        .setTitle('💣 Mines')
                        .setDescription('⏱️ Timed out. Bet refunded.')],
                    components: buildComponents(true)
                });
            }
        });
    }
};
