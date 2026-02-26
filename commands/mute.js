const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout a member with a specific unit.')
        .addUserOption(o => o.setName('user').setDescription('The user to mute').setRequired(true))
        .addIntegerOption(o => o.setName('time').setDescription('The number of units').setRequired(true))
        .addStringOption(o => o.setName('unit').setDescription('Minute, Hour or Day?').setRequired(true)
            .addChoices(
                { name: 'Minutes', value: 'm' },
                { name: 'Hours', value: 'h' },
                { name: 'Days', value: 'd' }
            ))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        await interaction.deferReply();
        
        const member = interaction.options.getMember('user');
        const time = interaction.options.getInteger('time');
        const unit = interaction.options.getString('unit');

        if (!member) return interaction.editReply('❌ **Error:** User not found.');
        if (!member.manageable) return interaction.editReply('❌ **Hierarchy Error:** My role is too low!');

        // Matematiksel çeviri kısmı burası:
        let durationMs = time * 60000; // Varsayılan dakika
        if (unit === 'h') durationMs = time * 60000 * 60; // Saate çevir
        if (unit === 'd') durationMs = time * 60000 * 60 * 24; // Güne çevir

        // Discord sınırı: 28 gün (40320 dakika)
        if (durationMs > 2419200000) {
            return interaction.editReply('❌ **Error:** You cannot mute for more than 28 days!');
        }

        try {
            await member.timeout(durationMs);
            const unitName = unit === 'm' ? 'minutes' : unit === 'h' ? 'hours' : 'days';
            await interaction.editReply(`🔇 **${member.user.username}** has been muted for **${time} ${unitName}**. ✅`);
        } catch (error) {
            await interaction.editReply('❌ **Internal Error:** Check my permissions and role position!');
        }
    },
};
