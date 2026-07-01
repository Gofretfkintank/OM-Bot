const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

// Fetches up to 100 recent messages (optionally before a given message, optionally
// filtered to one author), deletes up to `amount` of them, and returns how many
// were actually removed. Handles the 0/1/2+ cases Discord's bulk delete API can't.
async function doPurge(channel, amount, filterUserId, beforeId) {
    const fetchOpts = { limit: 100 };
    if (beforeId) fetchOpts.before = beforeId;

    const fetched = await channel.messages.fetch(fetchOpts);
    const pool = filterUserId ? fetched.filter(m => m.author.id === filterUserId) : fetched;
    const toDelete = [...pool.values()].slice(0, amount);

    if (toDelete.length === 0) return 0;
    if (toDelete.length === 1) {
        await toDelete[0].delete();
        return 1;
    }

    const deleted = await channel.bulkDelete(toDelete, true); // true = silently skip msgs older than 14 days
    return deleted.size;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Bulk delete recent messages in this channel.')
        .addIntegerOption(o => o.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        await interaction.deferReply();
        const amount = interaction.options.getInteger('amount');
        const target = interaction.options.getUser('user');

        try {
            const count = await doPurge(interaction.channel, amount, target?.id);

            if (count === 0) {
                return interaction.editReply({ embeds: [
                    err(target ? `❌ No recent messages found from **${target.tag}**.` : '❌ No messages found to delete.')
                ]});
            }

            await interaction.editReply({ embeds: [
                ok(`🧹 **${count}** message${count === 1 ? '' : 's'} deleted${target ? ` from **${target.tag}**` : ''}.`)
                    .setFooter({ text: `Purged by ${interaction.user.tag}` })
                    .setTimestamp()
            ]});
        } catch {
            await interaction.editReply({ embeds: [err('❌ Could not delete messages. They may be older than 14 days.')] });
        }
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return message.reply({ embeds: [err('❌ You need **Manage Messages** permission.')] });

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100)
            return message.reply({ embeds: [err('❌ Usage: `purge <1-100> [@user]`')] });

        const targetId = args[1]?.replace(/[<@!>]/g, '');

        try {
            const count = await doPurge(message.channel, amount, targetId, message.id);
            await message.delete().catch(() => {});

            if (count === 0) {
                return message.channel.send({ embeds: [
                    err(targetId ? `❌ No recent messages found from <@${targetId}>.` : '❌ No messages found to delete.')
                ]});
            }

            return message.channel.send({ embeds: [
                ok(`🧹 **${count}** message${count === 1 ? '' : 's'} deleted${targetId ? ` from <@${targetId}>` : ''}.`)
                    .setFooter({ text: `Purged by ${message.author.tag}` })
                    .setTimestamp()
            ]});
        } catch {
            return message.channel.send({ embeds: [err('❌ Could not delete messages. They may be older than 14 days.')] });
        }
    }
};
