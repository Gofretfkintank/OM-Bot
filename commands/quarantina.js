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
        .setName('karantina')
        .setDescription('Kullanıcıyı karantinaya alır.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Kullanıcı')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
        }

        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: 'Rol yetkim yok!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser('target');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) return interaction.editReply('Kullanıcı yok.');
        if (targetMember.id === interaction.user.id) return interaction.editReply('Kendini karantinaya alamazsın.');

        // Rol hiyerarşi koruması
        if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.editReply('Bu kullanıcıya işlem yapamam (rol hiyerarşisi).');
        }

        const specialModID = '837688603739816046';
        const modCategoryID = '1452708253493624944';

        try {
            let jailRole = interaction.guild.roles.cache.find(r => r.name === 'Karantina');
            if (!jailRole) {
                jailRole = await interaction.guild.roles.create({
                    name: 'Karantina',
                    permissions: []
                });
            }

            const db = loadDB();

            if (db[targetMember.id]) {
                return interaction.editReply('Bu kullanıcı zaten karantinada.');
            }

            // Rolleri kaydet
            const oldRoles = targetMember.roles.cache
                .filter(r => r.id !== interaction.guild.id && r.id !== jailRole.id)
                .map(r => r.id);

            db[targetMember.id] = oldRoles;
            saveDB(db);

            // Rolleri sıfırla
            await targetMember.roles.set([jailRole]);

            // Kanal izinleri
            for (const channel of interaction.guild.channels.cache.values()) {
                try {
                    if (targetMember.id === specialModID) {
                        // MOD ÖZEL MOD
                        if (channel.parentId === modCategoryID) {
                            // Mod kanalları: görür ama yazamaz
                            await channel.permissionOverwrites.edit(targetMember, {
                                ViewChannel: true,
                                SendMessages: false,
                                AddReactions: false,
                                Connect: false
                            });
                        } else {
                            // Genel kanallar: normal user gibi
                            await channel.permissionOverwrites.edit(targetMember, {
                                ViewChannel: true,
                                SendMessages: true,
                                AddReactions: true,
                                Connect: true
                            });
                        }
                    } else {
                        // NORMAL FULL KARANTİNA
                        await channel.permissionOverwrites.edit(targetMember, {
                            ViewChannel: false,
                            SendMessages: false,
                            Connect: false
                        });
                    }
                } catch {}
            }

            return interaction.editReply(`🔒 ${targetMember.user.tag} karantinaya alındı.`);

        } catch (err) {
            console.error(err);
            return interaction.editReply('Hata oluştu.');
        }
    }
};