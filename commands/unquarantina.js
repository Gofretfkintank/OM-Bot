const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

const dbPath = './jailed.json';

const loadDB = () => JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const saveDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('karantina-kaldir')
        .setDescription('Karantinayı kaldırır.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Kullanıcı')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) return interaction.editReply('Kullanıcı yok.');

        const db = loadDB();
        const oldRoles = db[targetMember.id];

        if (!oldRoles) {
            return interaction.editReply('Bu kullanıcı karantinada değil.');
        }

        try {
            await targetMember.roles.set(oldRoles);

            // TÜM override'ları temizle
            for (const channel of interaction.guild.channels.cache.values()) {
                try {
                    await channel.permissionOverwrites.delete(targetMember.id);
                } catch {}
            }

            delete db[targetMember.id];
            saveDB(db);

            return interaction.editReply(`🔓 ${targetMember.user.tag} serbest bırakıldı.`);

        } catch (err) {
            console.error(err);
            return interaction.editReply('Hata oluştu.');
        }
    }
};