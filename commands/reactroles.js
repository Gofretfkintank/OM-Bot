const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { REACTION_ROLE_CHANNEL_ID, REACTION_ROLES } = require('../data/reactionRoles');

function ok(desc)  { return new EmbedBuilder().setColor(0x2ecc71).setDescription(desc); }
function err(desc) { return new EmbedBuilder().setColor(0xe74c3c).setDescription(desc); }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactroles')
        .setDescription('Post the MCL league reaction-role message to the configured channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        await interaction.deferReply();

        const channel = await interaction.client.channels.fetch(REACTION_ROLE_CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            return interaction.editReply({ embeds: [err(`❌ Channel \`${REACTION_ROLE_CHANNEL_ID}\` not found.`)] });
        }

        const description = REACTION_ROLES
            .map(r => `<:${r.emojiName}:${r.emojiId}> **${r.league}** — <@&${r.roleId}>`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🏆 Madcar Champions League — Choose Your League')
            .setDescription(`React below to get the role for your league. One league at a time — remove your reaction to switch.\n\n${description}`)
            .setFooter({ text: 'MCL Season I' });

        let message;
        try {
            message = await channel.send({ embeds: [embed] });
            for (const r of REACTION_ROLES) {
                await message.react(`<:${r.emojiName}:${r.emojiId}>`);
            }
        } catch (e) {
            console.error('[REACTROLES]', e.message);
            return interaction.editReply({ embeds: [err('❌ Failed to post the embed or react. Check my permissions (Send Messages / Add Reactions / Use External Emojis / Manage Messages) in that channel.')] });
        }

        return interaction.editReply({ embeds: [
            ok(`✅ Reaction-role message posted in ${channel}.`)
                .setFooter({ text: `Set by ${interaction.user.tag}` })
                .setTimestamp()
        ]});
    }
};
