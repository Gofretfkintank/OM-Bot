const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

// 1h, 10m gibi süreleri milisaniyeye çeviren fonksiyon (Paket gerektirmez)
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
        .setDescription('🔇 Mute a member using Discord timeout.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('👤 Member to mute')
                .setRequired(true))
        .addStringOption(option => // MaoMao'nun dediği gibi Integer değil, senin istediğin gibi String!
            option.setName('duration')
                .setDescription('⏱ Duration (e.g., 10m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('📝 Reason for mute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        // Üyeyi ID üzerinden en garanti yolla çekiyoruz
        const targetUser = interaction.options.getUser('target');
        
        // Önemli: Önce hafızaya bak, yoksa sunucudan getir
        let member = interaction.options.getMember('target');
        if (!member) {
            try {
                member = await interaction.guild.members.fetch(targetUser.id);
            } catch (e) {
                return interaction.reply({ 
                    content: '❌ Member could not be found! Please make sure the member is in the server.', 
                    flags: [MessageFlags.Ephemeral] 
                });
            }
        }

        const durationString = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        // Güvenlik kontrolleri
        if (member.id === interaction.user.id)
            return interaction.reply({ content: '⚠️ You cannot mute yourself.', flags: [MessageFlags.Ephemeral] });

        if (!member.moderatable)
            return interaction.reply({ content: '❌ I cannot mute this member. My role might be below theirs!', flags: [MessageFlags.Ephemeral] });

        const milliseconds = parseDuration(durationString);

        if (!milliseconds || milliseconds <= 0) {
            return interaction.reply({ 
                content: '❌ Invalid format! Please use `10m`, `1h` or `1d`.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        try {
            await member.timeout(milliseconds, reason);
            return interaction.reply(`🔇 **${member.user.tag}** has been muted.\n⏱ **Duration:** ${durationString}\n📝 **Reason:** ${reason}`);
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: '❌ Failed to mute. Check my permissions!', flags: [MessageFlags.Ephemeral] });
        }
    },
};
