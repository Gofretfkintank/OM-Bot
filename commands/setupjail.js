//--------------------------
// HARD JAIL SETUP
//--------------------------
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupjail')
        .setDescription('Apply hard jail restrictions to all channels'),

    async execute(interaction) {

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
        }

        await interaction.reply({ content: 'Setting up hard jail system...', ephemeral: true });

        const jailRole = interaction.guild.roles.cache.find(r => r.name === 'Jail');
        if (!jailRole) return interaction.editReply('Jail role not found.');

        let count = 0;

        for (const channel of interaction.guild.channels.cache.values()) {
            try {
                await channel.permissionOverwrites.edit(jailRole, {
                    ViewChannel: false, // 💀 ARTIK HİÇBİR ŞEY GÖREMEZ
                    SendMessages: false,
                    AddReactions: false,
                    Connect: false,
                    Speak: false
                });

                count++;
            } catch (err) {
                console.log(`Error: ${channel.name} - ${err.message}`);
            }
        }

        return interaction.editReply(`✅ Hard jail applied to ${count} channels.`);
    }
};