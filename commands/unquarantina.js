const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

const dbPath = './jailed.json';

const loadDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unjail')
        .setDescription('Release a user from quarantine.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('User to release')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'You do not have permission.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) return interaction.editReply('User not found.');

        const db = loadDB();
        const oldRoles = db[targetMember.id];

        if (!oldRoles) {
            return interaction.editReply('This user is not jailed.');
        }

        try {
            await targetMember.roles.set(oldRoles);

            for (const channel of interaction.guild.channels.cache.values()) {
                try {
                    await channel.permissionOverwrites.delete(targetMember.id);
                } catch {}
            }

            delete db[targetMember.id];
            saveDB(db);

            return interaction.editReply(`🔓 ${targetMember.user.tag} has been released.`);

        } catch (err) {
            console.error(err);
            return interaction.editReply('An error occurred while releasing the user.');
        }
    }
};