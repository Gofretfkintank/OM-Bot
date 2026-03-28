const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

const dbPath = './jailed.json';

if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({}, null, 2));
}

const loadDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

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
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: 'I do not have permission to manage roles.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) return interaction.editReply('User not found in this server.');
        if (targetMember.id === interaction.user.id) return interaction.editReply('You cannot jail yourself.');

        if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.editReply('I cannot act on this user due to role hierarchy.');
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

            const db = loadDB();

            if (db[targetMember.id]) {
                return interaction.editReply('This user is already jailed.');
            }

            const oldRoles = targetMember.roles.cache
                .filter(r => r.id !== interaction.guild.id && r.id !== jailRole.id)
                .map(r => r.id);

            db[targetMember.id] = oldRoles;
            saveDB(db);

            await targetMember.roles.set([jailRole]);

            for (const channel of interaction.guild.channels.cache.values()) {
                try {
                    if (targetMember.id === specialModID) {
                        if (channel.parentId === modCategoryID) {
                            // Read-only in mod channels
                            await channel.permissionOverwrites.edit(targetMember, {
                                ViewChannel: true,
                                SendMessages: false,
                                AddReactions: false,
                                Connect: false
                            });
                        } else {
                            // Normal access in public channels
                            await channel.permissionOverwrites.edit(targetMember, {
                                ViewChannel: true,
                                SendMessages: true,
                                AddReactions: true,
                                Connect: true
                            });
                        }
                    } else {
                        // Full jail
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
            return interaction.editReply('An error occurred while processing the command.');
        }
    }
};