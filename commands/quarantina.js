//--------------------------
// IMPORTS
//--------------------------
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Jail = require('../models/Jail');

//--------------------------
// CONFIG
//--------------------------
const SPECIAL_ROLE_ID = '1487415507031167176'; // special mod role
const COMMANDER_ID = '1097807544849809408';   // your user ID

//--------------------------
// COMMAND
//--------------------------
module.exports = {
    data: new SlashCommandBuilder()
        .setName('jail')
        .setDescription('Quarantine a user.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('User to quarantine')
                .setRequired(true)
        ),

    async execute(interaction) {

        //--------------------------
        // PERMISSION CHECK
        //--------------------------
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: 'I cannot manage roles.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        //--------------------------
        // TARGET
        //--------------------------
        const targetUser = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) return interaction.editReply('User not found.');
        if (targetMember.id === interaction.user.id) return interaction.editReply('You cannot jail yourself.');

        //--------------------------
        // HIERARCHY CHECK + COMMANDER EXEMPTION
        //--------------------------
        const isCommander = interaction.user.id === COMMANDER_ID;

        if (!isCommander && targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply('You cannot act on this user.');
        }

        if (!isCommander && targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.editReply('Role hierarchy issue (bot cannot manage).');
        }

        //--------------------------
        // JAIL ROLE
        //--------------------------
        let jailRole = interaction.guild.roles.cache.find(r => r.name === 'Jail');

        if (!jailRole) {
            jailRole = await interaction.guild.roles.create({
                name: 'Jail',
                permissions: []
            });
        }

        //--------------------------
        // DATABASE CHECK
        //--------------------------
        const existing = await Jail.findOne({
            userId: targetMember.id,
            guildId: interaction.guildId
        });

        if (existing) {
            return interaction.editReply('User is already jailed.');
        }

        //--------------------------
        // ROLE BACKUP (EXCEPT SPECIAL ROLE)
        //--------------------------
        const oldRoles = targetMember.roles.cache
            .filter(r =>
                r.id !== interaction.guild.id &&
                r.id !== jailRole.id &&
                r.id !== SPECIAL_ROLE_ID // 🔥 SPECIAL ROLE IS PRESERVED
            )
            .map(r => r.id);

        await Jail.create({
            userId: targetMember.id,
            guildId: interaction.guildId,
            roles: oldRoles
        });

        //--------------------------
        // ROLE SET (CLEAN)
        //--------------------------
        const newRoles = [jailRole.id];

        // Re-add special role if user had it
        if (targetMember.roles.cache.has(SPECIAL_ROLE_ID)) {
            newRoles.push(SPECIAL_ROLE_ID);
        }

        await targetMember.roles.set(newRoles);

        //--------------------------
        // DONE
        //--------------------------
        return interaction.editReply(`🔒 ${targetMember.user.tag} has been quarantined.`);
    }
};