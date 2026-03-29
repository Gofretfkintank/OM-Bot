//--------------------------
// ULTRA HARD JAIL SETUP
//--------------------------
const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

//--------------------------
// CONFIG
//--------------------------
const JAIL_ROLE_NAME = 'Jail';
const JAIL_ROOM_NAME = 'jail-room'; // açık kalacak kanal

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupjail')
        .setDescription('Apply FULL jail system (guaranteed)'),

    async execute(interaction) {

        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
        }

        await interaction.reply({ content: 'Applying ultra jail system...', ephemeral: true });

        const jailRole = interaction.guild.roles.cache.find(r => r.name === JAIL_ROLE_NAME);
        if (!jailRole) return interaction.editReply('Jail role not found.');

        let count = 0;

        //--------------------------
        // TÜM KANALLAR
        //--------------------------
        for (const channel of interaction.guild.channels.cache.values()) {
            try {

                //--------------------------
                // JAIL ROOM HARİÇ
                //--------------------------
                if (channel.name === JAIL_ROOM_NAME) {
                    await channel.permissionOverwrites.edit(jailRole, {
                        ViewChannel: true,
                        SendMessages: false,
                        AddReactions: false,
                        Connect: false,
                        Speak: false
                    });
                    continue;
                }

                //--------------------------
                // CATEGORY FIX (SYNC KIR)
                //--------------------------
                if (channel.type === ChannelType.GuildCategory) {
                    await channel.permissionOverwrites.edit(jailRole, {
                        ViewChannel: false
                    });
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
                console.log(`❌ ${channel.name}: ${err.message}`);
            }
        }

        //--------------------------
        // THREAD FIX (EXTRA GARANTİ)
        //--------------------------
        for (const thread of interaction.guild.channels.cache.filter(c => c.isThread()).values()) {
            try {
                await thread.permissionOverwrites.edit(jailRole, {
                    ViewChannel: false,
                    SendMessages: false
                });
            } catch {}
        }

        //--------------------------
        // DONE
        //--------------------------
        return interaction.editReply(`✅ Ultra jail applied to ${count} channels.`);
    }
};