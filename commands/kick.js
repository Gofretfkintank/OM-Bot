const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const COMMANDER_ID    = '1097807544849809408';
const CO_OWNER_ROLE_ID = '1447144645489328199';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The member to kick')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        await interaction.deferReply();
        const user = interaction.options.getMember('target');
        if (!user) return interaction.editReply('❌ **Error:** This user is not in the server.');
        if (!user.kickable) return interaction.editReply('❌ **Error:** I cannot kick this user.');
        await user.kick();
        const kickEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setDescription(`🔫 **${user.user.tag}** User session has been terminated by the OM Bot.`);
        await interaction.editReply({ embeds: [kickEmbed] });
    },

    async prefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers))
            return message.reply('❌ You need **Kick Members** permission.');

        const id = args[0]?.replace(/[<@!>]/g, '');
        if (!id) return message.reply('❌ Usage: `kick @user`');

        const target = await message.guild.members.fetch(id).catch(() => null);
        if (!target) return message.reply('❌ Member not found in this server.');
        if (!target.kickable) return message.reply('❌ I cannot kick this user.');
        if (target.roles.highest.position >= message.guild.members.me.roles.highest.position)
            return message.reply('❌ I cannot kick this user due to role hierarchy.');

        const hasFullPower = message.author.id === COMMANDER_ID || message.member.roles.cache.has(CO_OWNER_ROLE_ID);
        if (target.permissions.has(PermissionFlagsBits.ManageMessages) && !hasFullPower)
            return message.reply('❌ Only VIPs (Commander/Co-Owner) can kick staff members!');

        await target.kick();
        return message.reply(`🔫 **${target.user.tag}** has been kicked.`);
    }
};
