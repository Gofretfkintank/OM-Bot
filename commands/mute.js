const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout a member with a specific unit.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('time')
                .setDescription('Amount of time')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('unit')
                .setDescription('Time unit')
                .setRequired(true)
                .addChoices(
                    { name: 'Minutes', value: 'm' },
                    { name: 'Hours', value: 'h' },
                    { name: 'Days', value: 'd' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {

        await interaction.deferReply({ ephemeral: true });

        const member = interaction.options.getMember('user');
        const time = interaction.options.getInteger('time');
        const unit = interaction.options.getString('unit');

        if (!member)
            return interaction.editReply('❌ User not found.');

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers))
            return interaction.editReply('❌ I do not have Moderate Members permission.');

        if (member.id === interaction.user.id)
            return interaction.editReply('❌ You cannot mute yourself.');

        if (member.user.bot)
            return interaction.editReply('❌ You cannot mute a bot.');

        if (!member.moderatable)
            return interaction.editReply('❌ I cannot timeout this member. Check role hierarchy.');

        let durationMs = time * 60 * 1000; // minutes by default

        if (unit === 'h') durationMs = time * 60 * 60 * 1000;
        if (unit === 'd') durationMs = time * 24 * 60 * 60 * 1000;

        if (durationMs > 2419200000)
            return interaction.editReply('❌ You cannot timeout a member for more than 28 days.');

        try {
            await member.timeout(durationMs);
            const unitName = unit === 'm' ? 'minutes' : unit === 'h' ? 'hours' : 'days';
            await interaction.editReply(`🔇 ${member.user.tag} has been muted for ${time} ${unitName}.`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Internal error. Check permissions and role position.');
        }
    },
};