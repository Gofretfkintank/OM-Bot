const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockchannel')
        .setDescription('🔒 Lock the channel from all non-staff roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        await interaction.deferReply();
        const nonStaff = interaction.guild.roles.cache.filter(r => 
            !r.permissions.has(PermissionFlagsBits.ManageMessages) && 
            !r.permissions.has(PermissionFlagsBits.Administrator) &&
            r.name !== '@everyone'
        );

        for (const [id, role] of nonStaff) {
            await interaction.channel.permissionOverwrites.edit(role, { SendMessages: false }).catch(console.error);
        }
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        await interaction.editReply('🛡️ **Channel Locked!** All non-staff roles have been restricted. 🔒');
    }
};
