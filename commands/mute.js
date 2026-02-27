const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

function parseDuration(str) {
    const regex = /(\d+)([smhd])/g;
    let totalMs = 0;
    let match;
    let found = false;

    while ((match = regex.exec(str)) !== null) {
        found = true;
        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's': totalMs += value * 1000; break;
            case 'm': totalMs += value * 60 * 1000; break;
            case 'h': totalMs += value * 60 * 60 * 1000; break;
            case 'd': totalMs += value * 24 * 60 * 60 * 1000; break;
        }
    }

    return found ? totalMs : null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a member using Discord timeout.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Member to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (10m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {

        if (!interaction.guild) {
            return interaction.reply({ content: 'Server only command.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('target');

        console.log("----- DEBUG -----");
        console.log("Guild ID:", interaction.guild.id);
        console.log("Bot guilds:", interaction.client.guilds.cache.map(g => g.id));
        console.log("Target ID:", targetUser.id);
        console.log("-----------------");

        let member;

        try {
            member = await interaction.guild.members.fetch(targetUser.id);
            console.log("Member fetched:", member.user.tag);
        } catch (err) {
            console.log("FETCH FAILED");
            return interaction.reply({
                content: 'Member could not be found in this server.',
                ephemeral: true
            });
        }

        const durationString = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (member.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot mute yourself.', ephemeral: true });
        }

        if (!member.moderatable) {
            return interaction.reply({
                content: 'I cannot mute this member. Role position issue.',
                ephemeral: true
            });
        }

        const ms = parseDuration(durationString);

        if (!ms) {
            return interaction.reply({
                content: 'Invalid duration format. Example: 10m, 1h, 1d',
                ephemeral: true
            });
        }

        try {
            await member.timeout(ms, reason);
            return interaction.reply(`🔇 ${member.user.tag} muted for ${durationString}`);
        } catch (error) {
            console.error(error);
            return interaction.reply({
                content: 'Timeout failed. Check permissions.',
                ephemeral: true
            });
        }
    }
};