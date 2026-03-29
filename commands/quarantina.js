//--------------------------
// IMPORTS
//--------------------------
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Jail = require('../models/Jail');

//--------------------------
// CONFIG
//--------------------------
const SPECIAL_ROLE_ID = '1487415507031167176'; // özel mod rolü

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
            return interaction.reply({ content: 'Yetkin yok.', ephemeral: true });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: 'Rol yönetemiyorum.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        //--------------------------
        // TARGET
        //--------------------------
        const targetUser = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) return interaction.editReply('Kullanıcı bulunamadı.');
        if (targetMember.id === interaction.user.id) return interaction.editReply('Kendini jail atamazsın.');

        //--------------------------
        // HIERARCHY CHECK (KRİTİK)
        //--------------------------
        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.editReply('Bu kullanıcıya işlem yapamazsın.');
        }

        if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.editReply('Rol hiyerarşisi sorunu (bot yetmiyor).');
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
            return interaction.editReply('Zaten jailde.');
        }

        //--------------------------
        // ROLE BACKUP (ÖZEL ROL HARİÇ)
        //--------------------------
        const oldRoles = targetMember.roles.cache
            .filter(r =>
                r.id !== interaction.guild.id &&
                r.id !== jailRole.id &&
                r.id !== SPECIAL_ROLE_ID // 🔥 ÖZEL ROL KORUNUYOR
            )
            .map(r => r.id);

        await Jail.create({
            userId: targetMember.id,
            guildId: interaction.guildId,
            roles: oldRoles
        });

        //--------------------------
        // ROLE SET (TEMİZ)
        //--------------------------
        const newRoles = [jailRole.id];

        // Eğer kullanıcıda özel rol varsa tekrar ekle
        if (targetMember.roles.cache.has(SPECIAL_ROLE_ID)) {
            newRoles.push(SPECIAL_ROLE_ID);
        }

        await targetMember.roles.set(newRoles);

        //--------------------------
        // DONE
        //--------------------------
        return interaction.editReply(`🔒 ${targetMember.user.tag} karantinaya alındı.`);
    }
};