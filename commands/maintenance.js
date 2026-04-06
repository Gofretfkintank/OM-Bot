const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Maintenance = require('../models/Maintenance');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maintenance')
        .setDescription('Toggle maintenance mode.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {

        //--------------------------
        // PERMISSION CHECK
        //--------------------------

        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isStaff = member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isStaff) {
            return interaction.reply({
                content: '❌ Administrator permission is required to use this command.',
                ephemeral: true // Yetki hatası kanalı kirletmesin diye sadece kullanan görsün
            });
        }

        // BURASI DEĞİŞTİ: ephemeral kaldırıldı, artık herkes görebilir.
        await interaction.deferReply(); 

        //--------------------------
        // CURRENT STATE
        //--------------------------

        let state = await Maintenance.findById('singleton');

        //--------------------------
        // START MAINTENANCE
        //--------------------------

        if (!state || !state.active) {

            // Take a hash snapshot of all current commands
            const snapshot = {};
            for (const [name, cmd] of interaction.client.commands) {
                snapshot[name] = hashCommand(cmd);
            }

            if (!state) {
                state = new Maintenance({ _id: 'singleton' });
            }

            state.active       = true;
            state.snapshot     = snapshot;
            state.lockedCommands = [];
            state.startedBy    = interaction.user.id;
            state.startedAt    = new Date();
            await state.save();

            const embed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle('🔧 Maintenance Mode Enabled')
                .setDescription(
                    `The bot is now in maintenance mode.\n\n` +
                    `A snapshot of **${Object.keys(snapshot).length}** commands has been saved.\n` +
                    `Changed or newly added commands will be automatically locked after a redeploy.`
                )
                .addFields({ name: 'Started By', value: `<@${interaction.user.id}>` })
                .setFooter({ text: 'Gofret is cooking 🧇' })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        //--------------------------
        // END MAINTENANCE
        //--------------------------

        const lockedList = state.lockedCommands.length > 0
            ? state.lockedCommands.map(c => `\`/${c}\``).join(', ')
            : 'No commands were locked.';

        state.active         = false;
        state.snapshot       = {};
        state.lockedCommands = [];
        state.startedBy      = null;
        state.startedAt      = null;
        await state.save();

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('✅ Maintenance Mode Disabled')
            .setDescription(
                `Maintenance mode has ended. All commands are active again.\n\n` +
                `**Commands that were in maintenance:** ${lockedList}`
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
    }
};

//--------------------------
// HASH HELPER
// Converts command content (data JSON) to a string
// Used to detect if a command was changed after a redeploy
//--------------------------

function hashCommand(cmd) {
    try {
        return JSON.stringify(cmd.data.toJSON());
    } catch {
        return String(cmd.data.name);
    }
}
