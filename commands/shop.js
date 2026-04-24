// commands/shop.js
// OM Economy Shop — Coin Spending System
// ─────────────────────────────────────────────────────────────────────────────
// /shop list      → Show available items
// /shop buy       → Purchase an item
// /shop inventory → View owned items
//
// Item Categories:
//   ROLE_COLOR  → Gives a specific Discord role (colored title)
//   CUSTOM_NICK → Right to customize nickname for a race (admin approval)
//   BOOST       → Extra coin gain in the next race (50% bonus)
//   FLEX        → Pure status, money sink, leaderboard badge
// ─────────────────────────────────────────────────────────────────────────────

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require('discord.js');

const Economy = require('../models/Economy');

// ── Item Catalog ─────────────────────────────────────────────────────────────
// type: 'role'       → Gives a Discord role via roleId
// type: 'boost'      → Sets wallet.raceBoost = true
// type: 'flex'       → Deducts coins, adds to inventory
// ─────────────────────────────────────────────────────────────────────────────
const SHOP_ITEMS = [
    // ── Colored Roles ────────────────────────────────────────────────────────
    {
        id: 'role_bronze',
        name: '🟫 Bronze Driver',
        description: 'Special Bronze colored driver role.',
        price: 5000,
        type: 'role',
        roleId: process.env.SHOP_ROLE_BRONZE,  // Pulled from .env
        emoji: '🟫'
    },
    {
        id: 'role_silver',
        name: '⬜ Silver Driver',
        description: 'Special Silver colored driver role.',
        price: 10000,
        type: 'role',
        roleId: process.env.SHOP_ROLE_SILVER,
        emoji: '⬜'
    },
    {
        id: 'role_gold',
        name: '🟨 Gold Driver',
        description: 'Special Gold colored driver role. A symbol of prestige.',
        price: 20000,
        type: 'role',
        roleId: process.env.SHOP_ROLE_GOLD,
        emoji: '🟨'
    },
    {
        id: 'role_champion',
        name: '👑 Champion Aura',
        description: 'The most prestigious OM role. Only for the elite.',
        price: 50000,
        type: 'role',
        roleId: process.env.SHOP_ROLE_CHAMPION,
        emoji: '👑'
    },

    // ── Race Boost ───────────────────────────────────────────────────────────
    {
        id: 'boost_race',
        name: '🚀 Race Boost',
        description: 'Your coin rewards increase by 50% in the next race. One-time use.',
        price: 3000,
        type: 'boost',
        emoji: '🚀'
    },

    // ── Flex Items ───────────────────────────────────────────────────────────
    {
        id: 'flex_pitwall',
        name: '🎙️ Pit Wall Pass',
        description: 'Burn coins, gain status. Does nothing but looks good on the leaderboard.',
        price: 7500,
        type: 'flex',
        emoji: '🎙️'
    },
    {
        id: 'flex_helmet',
        name: '🪖 Signed Helmet',
        description: 'Collector\'s item. You are recorded as a part of OM history.',
        price: 15000,
        type: 'flex',
        emoji: '🪖'
    }
];

// ── Helper: Fetch/Create Economy Record ──────────────────────────────────────
async function getWallet(userId) {
    let wallet = await Economy.findOne({ userId });
    if (!wallet) wallet = new Economy({ userId });
    return wallet;
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('OM Economy Shop — spend coins, gain status.')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show available items.')
        )
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Purchase an item.')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Item ID to purchase (see /shop list)')
                        .setRequired(true)
                        .addChoices(
                            ...SHOP_ITEMS.map(i => ({ name: `${i.emoji} ${i.name} — ${i.price} 🪙`, value: i.id }))
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('inventory')
                .setDescription('View owned items.')
                .addUserOption(opt =>
                    opt.setName('driver')
                        .setDescription('View another driver\'s inventory (optional)')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // ── /shop list ───────────────────────────────────────────────────────
        if (sub === 'list') {
            const wallet = await getWallet(interaction.user.id);

            const fields = SHOP_ITEMS.map(item => ({
                name: `${item.emoji} ${item.name} — **${item.price.toLocaleString()} 🪙**`,
                value: `${item.description}\n\`ID: ${item.id}\``,
                inline: false
            }));

            const embed = new EmbedBuilder()
                .setColor(0xf5c518)
                .setTitle('🏪 OM Economy Shop')
                .setDescription(`Your balance: **${wallet.coins.toLocaleString()} 🪙**\n\nTo purchase: \`/shop buy\``)
                .addFields(fields)
                .setFooter({ text: 'OM Economy System' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ── /shop buy ────────────────────────────────────────────────────────
        if (sub === 'buy') {
            const itemId = interaction.options.getString('item');
            const item = SHOP_ITEMS.find(i => i.id === itemId);

            if (!item) {
                return interaction.reply({ content: '❌ Invalid item.', ephemeral: true });
            }

            const wallet = await getWallet(interaction.user.id);

            // Balance check
            if (wallet.coins < item.price) {
                return interaction.reply({
                    content: `❌ Insufficient coins. Your balance: **${wallet.coins.toLocaleString()} 🪙** | Required: **${item.price.toLocaleString()} 🪙**`,
                    ephemeral: true
                });
            }

            // Already owned check (for roles and flex)
            if (item.type !== 'boost' && wallet.inventory?.includes(itemId)) {
                return interaction.reply({
                    content: `❌ You already own this item: **${item.name}**`,
                    ephemeral: true
                });
            }

            // ── ROLE TYPE ────────────────────────────────────────────────────
            if (item.type === 'role') {
                if (!item.roleId) {
                    return interaction.reply({
                        content: `❌ This role is not configured yet. Please notify the admins.`,
                        ephemeral: true
                    });
                }

                const role = interaction.guild.roles.cache.get(item.roleId);
                if (!role) {
                    return interaction.reply({
                        content: `❌ Role not found in Discord. Please notify the admins.`,
                        ephemeral: true
                    });
                }

                const member = await interaction.guild.members.fetch(interaction.user.id);
                await member.roles.add(role);
            }

            // ── BOOST TYPE ───────────────────────────────────────────────────
            if (item.type === 'boost') {
                if (wallet.raceBoost) {
                    return interaction.reply({
                        content: `❌ You already have an active Race Boost. Use it first!`,
                        ephemeral: true
                    });
                }
                wallet.raceBoost = true;
            }

            // ── Deduct Coins + Update Inventory ──────────────────────────────
            wallet.coins -= item.price;

            if (!wallet.inventory) wallet.inventory = [];
            if (item.type !== 'boost' || !wallet.inventory.includes(itemId)) {
                wallet.inventory.push(itemId);
            }

            await wallet.save();

            const embed = new EmbedBuilder()
                .setColor(0x00c851)
                .setTitle('✅ Purchase Successful')
                .setDescription(`**${item.emoji} ${item.name}** has been purchased!`)
                .addFields(
                    { name: '💸 Spent', value: `**${item.price.toLocaleString()} 🪙**`, inline: true },
                    { name: '🪙 Remaining Balance', value: `**${wallet.coins.toLocaleString()} 🪙**`, inline: true }
                )
                .setFooter({ text: 'OM Economy System' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ── /shop inventory ──────────────────────────────────────────────────
        if (sub === 'inventory') {
            const target = interaction.options.getUser('driver') ?? interaction.user;
            const wallet = await getWallet(target.id);

            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            const displayName = member?.displayName ?? target.username;

            const owned = wallet.inventory ?? [];

            let desc;
            if (owned.length === 0) {
                desc = target.id === interaction.user.id
                    ? 'You haven\'t purchased anything yet. Check `/shop list`.'
                    : 'This driver\'s inventory is empty.';
            } else {
                desc = owned.map(id => {
                    const item = SHOP_ITEMS.find(i => i.id === id);
                    return item
                        ? `${item.emoji} **${item.name}** — *${item.description}*`
                        : `🔹 \`${id}\``;
                }).join('\n');

                if (wallet.raceBoost) {
                    desc += '\n🚀 **Race Boost** — Active (will be used in the next race)';
                }
            }

            const embed = new EmbedBuilder()
                .setColor(0xf5c518)
                .setAuthor({
                    name: `${displayName}'s Inventory`,
                    iconURL: target.displayAvatarURL({ dynamic: true })
                })
                .setDescription(desc)
                .addFields(
                    { name: '🪙 Current Balance', value: `**${wallet.coins.toLocaleString()} 🪙**`, inline: true },
                    { name: '📦 Total Items', value: `**${owned.length}**`, inline: true }
                )
                .setFooter({ text: 'OM Economy System' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    }
};
