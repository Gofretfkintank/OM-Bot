// commands/give-coins.js
// Admin Coin Management Command
// ─────────────────────────────────────────────────────────────────────────────
// /give-coins add   @user <amount> [reason]  → add coins
// /give-coins take  @user <amount> [reason]  → remove coins
// /give-coins set   @user <amount>           → set balance directly
// ─────────────────────────────────────────────────────────────────────────────

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Economy = require('../models/Economy');

async function getWallet(userId) {
    let wallet = await Economy.findOne({ userId });
    if (!wallet) wallet = new Economy({ userId });
    return wallet;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give-coins')
        .setDescription('Admin: Manage driver coins.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add coins to a driver.')
                .addUserOption(opt => opt.setName('driver').setDescription('The driver').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of coins to add').setRequired(true).setMinValue(1))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for adding (optional)'))
        )

        .addSubcommand(sub =>
            sub.setName('take')
                .setDescription('Remove coins from a driver.')
                .addUserOption(opt => opt.setName('driver').setDescription('The driver').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of coins to remove').setRequired(true).setMinValue(1))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for removing (optional)'))
        )

        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Directly set a driver\'s balance.')
                .addUserOption(opt => opt.setName('driver').setDescription('The driver').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('New balance amount').setRequired(true).setMinValue(0))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('driver');
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') ?? 'Admin action';

        const wallet = await getWallet(target.id);
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        const displayName = member?.displayName ?? target.username;

        let title, color, changeStr;

        if (sub === 'add') {
            await wallet.addCoins(amount);
            title = '➕ Coins Added';
            color = 0x00c851;
            changeStr = `+${amount.toLocaleString()} 🪙`;

        } else if (sub === 'take') {
            const before = wallet.coins;
            await wallet.removeCoins(amount);
            const actual = before - wallet.coins; // Won't drop below 0
            title = '➖ Coins Removed';
            color = 0xff4444;
            changeStr = `-${actual.toLocaleString()} 🪙`;

        } else if (sub === 'set') {
            wallet.coins = amount;
            await wallet.save();
            title = '🔧 Balance Set';
            color = 0xf5c518;
            changeStr = `= ${amount.toLocaleString()} 🪙`;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(`Coin transaction completed for **${displayName}**.`)
            .addFields(
                { name: '💸 Transaction', value: `**${changeStr}**`, inline: true },
                { name: '🪙 New Balance', value: `**${wallet.coins.toLocaleString()} 🪙**`, inline: true },
                { name: '📝 Reason', value: reason, inline: false }
            )
            .setFooter({ text: `Processed by: ${interaction.user.tag}` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
