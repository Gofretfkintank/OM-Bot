//--------------------------
// FULL DENY JAIL SETUP
//--------------------------
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

//--------------------------
// CONFIG
//--------------------------
const JAIL_ROLE_NAME = 'Jail';
const JAIL_ROOM_NAME = 'jail-room'; // varsa burayı açık bırakır

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupjail')
        .setDescription('Apply full deny jail system to all channels'),

    async execute(interaction) {

        //--------------------------
        // PERMISSION CHECK
        //--------------------------
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
        }

        await interaction.reply({ content: 'Applying full jail system...', ephemeral: true });

        //--------------------------
        // GET ROLE
        //--------------------------
        const jailRole = interaction.guild.roles.cache.find(r => r.name === JAIL_ROLE_NAME);
        if (!jailRole) return interaction.editReply('Jail role not found.');

        let count = 0;

        //--------------------------
        // LOOP CHANNELS
        //--------------------------
        for (const channel of interaction.guild.channels.cache.values()) {
            try {

                // Jail room hariç tut
                if (channel.name === JAIL_ROOM_NAME) {
                    await channel.permissionOverwrites.edit(jailRole, {
                        ViewChannel: true,
                        SendMessages: false,
                        AddReactions: false
                    });
                    continue;
                }

                //--------------------------
                // FULL DENY
                //--------------------------
                await channel.permissionOverwrites.edit(jailRole, {
                    ViewChannel: false,
                    SendMessages: false,
                    AddReactions: false,
                    Connect: false,
                    Speak: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false,
                    SendMessagesInThreads: false,
                    UseApplicationCommands: false,
                    AttachFiles: false,
                    EmbedLinks: false
                });

                count++;

            } catch (err) {
                console.log(`Error: ${channel.name} - ${err.message}`);
            }
        }

        //--------------------------
        // DONE
        //--------------------------
        return interaction.editReply(`✅ Full jail system applied to ${count} channels.`);
    }
};