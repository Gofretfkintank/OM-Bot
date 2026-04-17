const { SlashCommandBuilder } = require('discord.js');
const PrefixConfig = require('../models/PrefixConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setprefix')
        .setDescription('Change the bot prefix (Commander/Admin only)')
        .addStringOption(o =>
            o.setName('prefix')
             .setDescription('New prefix (e.g. om! !! ? etc.)')
             .setRequired(true)
        ),

    async execute(interaction) {
        const { PermissionsBitField } = require('discord.js');
        const COMMANDER_ID = process.env.COMMANDER_ID || '1097807544849809408';

        const isCommander = interaction.user.id === COMMANDER_ID;
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (!isCommander && !isAdmin) {
            return interaction.reply({
                content: '❌ Only **Commander** or **Admins** can change the prefix.',
                ephemeral: true
            });
        }

        const newPrefix = interaction.options.getString('prefix').trim();

        if (newPrefix.length > 5) {
            return interaction.reply({
                content: '❌ Prefix can be maximum **5 characters**.',
                ephemeral: true
            });
        }

        await PrefixConfig.findOneAndUpdate(
            { guildId: interaction.guildId },
            { prefix: newPrefix },
            { upsert: true }
        );

        // Cache'i temizle
        interaction.client.emit('prefixUpdate', interaction.guildId);

        return interaction.reply({
            content: `✅ Prefix updated to \`${newPrefix}\`\nUsage: \`${newPrefix}ping\`, \`${newPrefix}help\` etc.`,
            ephemeral: false
        });
    }
};
