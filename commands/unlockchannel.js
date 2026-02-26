const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlockchannel')
        .setDescription('🔓 Unlock the channel and reset all role restrictions.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction) {
        await interaction.deferReply();
        
        // Lock komutundaki filtrenin aynısı: Staff olmayanları bul
        const nonStaff = interaction.guild.roles.cache.filter(r => 
            !r.permissions.has(PermissionFlagsBits.ManageMessages) && 
            !r.permissions.has(PermissionFlagsBits.Administrator) &&
            r.name !== '@everyone'
        );

        // Kilitlediğimiz her rolün özel iznini 'null' yaparak sıfırla (Reset)
        for (const [id, role] of nonStaff) {
            await interaction.channel.permissionOverwrites.edit(role, { SendMessages: null }).catch(console.error);
        }

        // En son @everyone kilidini aç
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });

        await interaction.editReply('🔓 **Channel Unlocked!** All role restrictions have been cleared and chat is open. 🗣️');
    }
};
