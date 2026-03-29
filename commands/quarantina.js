const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Jail = require('../models/Jail');

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
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: 'I do not have permission to manage roles.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) return interaction.editReply('User not found.');
        if (targetMember.id === interaction.user.id) return interaction.editReply('You cannot jail yourself.');

        if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.editReply('Role hierarchy issue.');
        }

        const specialModID = '837688603739816046';
        const modCategoryID = '1452708253493624944';

        try {
            let jailRole = interaction.guild.roles.cache.find(r => r.name === 'Jail');

            if (!jailRole) {
                jailRole = await interaction.guild.roles.create({
                    name: 'Jail',
                    permissions: []
                });
            }

            // 🔥 MONGO
            const existing = await Jail.findOne({
                userId: targetMember.id,
                guildId: interaction.guildId
            });

            if (existing) {
                return interaction.editReply('This user is already jailed.');
            }

            const oldRoles = targetMember.roles.cache
                .filter(r => r.id !== interaction.guild.id && r.id !== jailRole.id)
                .map(r => r.id);

            await Jail.create({
                userId: targetMember.id,
                guildId: interaction.guildId,
                roles: oldRoles
            });

            await targetMember.roles.set([jailRole]);

            for (const channel of interaction.guild.channels.cache.values()) {
                try {
                    if (targetMember.id === specialModID) {
                        if (channel.parentId === modCategoryID) {
                            await channel.permissionOverwrites.edit(targetMember, {
                                ViewChannel: true,
                                SendMessages: false,
                                AddReactions: false,
                                Connect: false
                            });
                        } else {
                            await channel.permissionOverwrites.edit(targetMember, {
                                ViewChannel: true,
                                SendMessages: true,
                                AddReactions: true,
                                Connect: true
                            });
                        }
                    } else {
                        await channel.permissionOverwrites.edit(targetMember, {
                            ViewChannel: false,
                            SendMessages: false,
                            Connect: false
                        });
                    }
                } catch {}
            }

            return interaction.editReply(`🔒 ${targetMember.user.tag} has been quarantined.`);

        } catch (err) {
            console.error(err);
            return interaction.editReply('Error.');
        }
    }
};