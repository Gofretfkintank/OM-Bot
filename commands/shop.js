// commands/shop.js
// OM Economy Shop — Coin Harcama Sistemi
// ─────────────────────────────────────────────────────────────────────────────
// /shop list      → Mevcut ürünleri göster
// /shop buy       → Ürün satın al
// /shop inventory → Sahip olunan ürünleri göster
//
// Ürün kategorileri:
//   ROLE_COLOR  → Belirli bir Discord rolü verir (renkli unvan)
//   CUSTOM_NICK → Kendi nickini bir yarış için özelleştirme hakkı (admin onayı)
//   BOOST       → Bir sonraki yarışta ekstra coin kazanımı (%50 bonus)
//   FLEX        → Saf statü, para yakma, leaderboard'da rozet
// ─────────────────────────────────────────────────────────────────────────────

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require('discord.js');

const Economy = require('../models/Economy');

// ── Ürün Kataloğu ─────────────────────────────────────────────────────────────
// type: 'role'       → roleId ile Discord rolü verir
// type: 'boost'      → wallet.raceBoost = true yapar (raceBoost flag'i)
// type: 'flex'       → sadece coin düşer, inventory'e ekler
// ─────────────────────────────────────────────────────────────────────────────
const SHOP_ITEMS = [
    // ── Renkli Roller ──────────────────────────────────────────────────────
    {
        id: 'role_bronze',
        name: '🟫 Bronze Driver',
        description: 'Bronze renkli özel sürücü rolü.',
        price: 500,
        type: 'role',
        roleId: process.env.SHOP_ROLE_BRONZE,  // .env'den çekilir
        emoji: '🟫'
    },
    {
        id: 'role_silver',
        name: '⬜ Silver Driver',
        description: 'Silver renkli özel sürücü rolü.',
        price: 1000,
        type: 'role',
        roleId: process.env.SHOP_ROLE_SILVER,
        emoji: '⬜'
    },
    {
        id: 'role_gold',
        name: '🟨 Gold Driver',
        description: 'Gold renkli özel sürücü rolü. Prestij simgesi.',
        price: 2000,
        type: 'role',
        roleId: process.env.SHOP_ROLE_GOLD,
        emoji: '🟨'
    },
    {
        id: 'role_champion',
        name: '👑 Champion Aura',
        description: 'En prestijli OM rolü. Sadece zenginler için.',
        price: 5000,
        type: 'role',
        roleId: process.env.SHOP_ROLE_CHAMPION,
        emoji: '👑'
    },

    // ── Race Boost ─────────────────────────────────────────────────────────
    {
        id: 'boost_race',
        name: '🚀 Race Boost',
        description: 'Bir sonraki yarışta coin ödüllerin %50 artar. Tek kullanımlık.',
        price: 300,
        type: 'boost',
        emoji: '🚀'
    },

    // ── Flex Items ─────────────────────────────────────────────────────────
    {
        id: 'flex_pitwall',
        name: '🎙️ Pit Wall Pass',
        description: 'Para yak, statü kazan. Hiçbir işe yaramaz ama leaderboard\'da görünür.',
        price: 750,
        type: 'flex',
        emoji: '🎙️'
    },
    {
        id: 'flex_helmet',
        name: '🪖 Signed Helmet',
        description: 'Koleksiyon objesi. OM tarihinin bir parçası olarak kayıtlısın.',
        price: 1500,
        type: 'flex',
        emoji: '🪖'
    }
];

// ── Yardımcı: Economy kaydı getir/oluştur ─────────────────────────────────────
async function getWallet(userId) {
    let wallet = await Economy.findOne({ userId });
    if (!wallet) wallet = new Economy({ userId });
    return wallet;
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('OM Economy Shop — coin harca, statü kazan.')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Mevcut ürünleri göster.')
        )
        .addSubcommand(sub =>
            sub.setName('buy')
                .setDescription('Bir ürün satın al.')
                .addStringOption(opt =>
                    opt.setName('item')
                        .setDescription('Satın alınacak ürün ID\'si (/shop list ile gör)')
                        .setRequired(true)
                        .addChoices(
                            ...SHOP_ITEMS.map(i => ({ name: `${i.emoji} ${i.name} — ${i.price} 🪙`, value: i.id }))
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('inventory')
                .setDescription('Sahip olduğun ürünleri gör.')
                .addUserOption(opt =>
                    opt.setName('driver')
                        .setDescription('Başka bir sürücünün envanterini gör (opsiyonel)')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // ── /shop list ─────────────────────────────────────────────────────
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
                .setDescription(`Mevcut bakiyen: **${wallet.coins.toLocaleString()} 🪙**\n\nAlmak için: \`/shop buy\``)
                .addFields(fields)
                .setFooter({ text: 'OM Economy System' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // ── /shop buy ──────────────────────────────────────────────────────
        if (sub === 'buy') {
            const itemId = interaction.options.getString('item');
            const item = SHOP_ITEMS.find(i => i.id === itemId);

            if (!item) {
                return interaction.reply({ content: '❌ Geçersiz ürün.', ephemeral: true });
            }

            const wallet = await getWallet(interaction.user.id);

            // Bakiye kontrolü
            if (wallet.coins < item.price) {
                return interaction.reply({
                    content: `❌ Yeterli coin yok. Bakiyen: **${wallet.coins.toLocaleString()} 🪙** | Gerekli: **${item.price.toLocaleString()} 🪙**`,
                    ephemeral: true
                });
            }

            // Zaten sahipse kontrol (rol ve flex için)
            if (item.type !== 'boost' && wallet.inventory?.includes(itemId)) {
                return interaction.reply({
                    content: `❌ Bu ürüne zaten sahipsin: **${item.name}**`,
                    ephemeral: true
                });
            }

            // ── ROL TİPİ ───────────────────────────────────────────────────
            if (item.type === 'role') {
                if (!item.roleId) {
                    return interaction.reply({
                        content: `❌ Bu rol henüz yapılandırılmamış. Adminlere haber ver.`,
                        ephemeral: true
                    });
                }

                const role = interaction.guild.roles.cache.get(item.roleId);
                if (!role) {
                    return interaction.reply({
                        content: `❌ Rol Discord'da bulunamadı. Adminlere haber ver.`,
                        ephemeral: true
                    });
                }

                const member = await interaction.guild.members.fetch(interaction.user.id);
                await member.roles.add(role);
            }

            // ── BOOST TİPİ ─────────────────────────────────────────────────
            if (item.type === 'boost') {
                if (wallet.raceBoost) {
                    return interaction.reply({
                        content: `❌ Zaten aktif bir Race Boost\'un var. Önce onu kullan.`,
                        ephemeral: true
                    });
                }
                wallet.raceBoost = true;
            }

            // ── Coin düş + Inventory güncelle ──────────────────────────────
            wallet.coins -= item.price;
            // totalEarned düşmez (harcama geçmişini etkilemez)

            if (!wallet.inventory) wallet.inventory = [];
            if (item.type !== 'boost' || !wallet.inventory.includes(itemId)) {
                wallet.inventory.push(itemId);
            }

            await wallet.save();

            const embed = new EmbedBuilder()
                .setColor(0x00c851)
                .setTitle('✅ Satın Alma Başarılı')
                .setDescription(`**${item.emoji} ${item.name}** satın alındı!`)
                .addFields(
                    { name: '💸 Harcanan', value: `**${item.price.toLocaleString()} 🪙**`, inline: true },
                    { name: '🪙 Kalan Bakiye', value: `**${wallet.coins.toLocaleString()} 🪙**`, inline: true }
                )
                .setFooter({ text: 'OM Economy System' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // ── /shop inventory ────────────────────────────────────────────────
        if (sub === 'inventory') {
            const target = interaction.options.getUser('driver') ?? interaction.user;
            const wallet = await getWallet(target.id);

            const member = await interaction.guild.members.fetch(target.id).catch(() => null);
            const displayName = member?.displayName ?? target.username;

            const owned = wallet.inventory ?? [];

            let desc;
            if (owned.length === 0) {
                desc = target.id === interaction.user.id
                    ? 'Henüz hiçbir şey almadın. `/shop list` ile bak.'
                    : 'Bu sürücünün envanteri boş.';
            } else {
                desc = owned.map(id => {
                    const item = SHOP_ITEMS.find(i => i.id === id);
                    return item
                        ? `${item.emoji} **${item.name}** — *${item.description}*`
                        : `🔹 \`${id}\``;
                }).join('\n');

                if (wallet.raceBoost) {
                    desc += '\n🚀 **Race Boost** — Aktif (bir sonraki yarışta kullanılacak)';
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
                    { name: '🪙 Mevcut Bakiye', value: `**${wallet.coins.toLocaleString()} 🪙**`, inline: true },
                    { name: '📦 Toplam Ürün', value: `**${owned.length}**`, inline: true }
                )
                .setFooter({ text: 'OM Economy System' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    }
};
