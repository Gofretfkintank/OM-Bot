//--------------------------
// SETUP JAIL PERMISSIONS
//--------------------------
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupjail')
        .setDescription('Apply jail restrictions to all channels'),

    async execute(interaction) {

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Yetkin yok.', ephemeral: true });
        }

        await interaction.reply({ content: 'Jail sistemi kuruluyor...', ephemeral: true });

        const jailRole = interaction.guild.roles.cache.find(r => r.name === 'Jail');
        if (!jailRole) return interaction.editReply('Jail rolü bulunamadı.');

        let count = 0;

        for (const channel of interaction.guild.channels.cache.values()) {
            try {
                await channel.permissionOverwrites.edit(jailRole, {
                    SendMessages: false,
                    AddReactions: false,
                    Connect: false,
                    Speak: false
                });

                count++;
            } catch (err) {
                console.log(`Hata: ${channel.name} - ${err.message}`);
            }
        }

        return interaction.editReply(`✅ ${count} kanala jail deny uygulandı.`);
    }
};