const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Botunun Token'ını buraya tırnaklar arasına yapıştır
const TOKEN = 'MTQ3NTIyOTMwODQ5NzgyMTg3OQ.GQBTIj.o2i9xE0WW2gmsEsM9P8IF1ZAHQ0YdC93beirdc'; 

// Komut Tanımlamaları
const commands = [
    new SlashCommandBuilder().setName('give-role').setDescription('Kullanıcıya rol verir').addUserOption(opt => opt.setName('user').setDescription('Kullanıcı').setRequired(true)).addRoleOption(opt => opt.setName('role').setDescription('Verilecek rol').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    new SlashCommandBuilder().setName('take-role').setDescription('Kullanıcıdan rol alır').addUserOption(opt => opt.setName('user').setDescription('Kullanıcı').setRequired(true)).addRoleOption(opt => opt.setName('role').setDescription('Alınacak rol').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    new SlashCommandBuilder().setName('mute').setDescription('Kullanıcıyı susturur (Timeout)').addUserOption(opt => opt.setName('user').setDescription('Kullanıcı').setRequired(true)).addIntegerOption(opt => opt.setName('sure').setDescription('Dakika cinsinden süre').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('unmute').setDescription('Kullanıcının susturmasını kaldırır').addUserOption(opt => opt.setName('user').setDescription('Kullanıcı').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('lockchannel').setDescription('Kanalı mesaj gönderimine kapatır').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName('unlockchannel').setDescription('Kanalı mesaj gönderimine açar').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName('ban').setDescription('Kullanıcıyı banlar').addUserOption(opt => opt.setName('user').setDescription('Kullanıcı').setRequired(true)).addStringOption(opt => opt.setName('sebep').setDescription('Ban sebebi')).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    new SlashCommandBuilder().setName('kick').setDescription('Kullanıcıyı sunucudan atar').addUserOption(opt => opt.setName('user').setDescription('Kullanıcı').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    new SlashCommandBuilder().setName('to').setDescription('Hızlı Timeout (10 dk)').addUserOption(opt => opt.setName('user').setDescription('Kullanıcı').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('unto').setDescription('Timeout kaldırır').addUserOption(opt => opt.setName('user').setDescription('Kullanıcı').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`${client.user.tag} aktif ve komutlar yüklendi!`);
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, guild, channel } = interaction;

    try {
        if (commandName === 'give-role') {
            const user = options.getMember('user');
            const role = options.getRole('role');
            await user.roles.add(role);
            await interaction.reply(`${user} kullanıcısına ${role} rolü verildi.`);
        }
        if (commandName === 'take-role') {
            const user = options.getMember('user');
            const role = options.getRole('role');
            await user.roles.remove(role);
            await interaction.reply(`${user} kullanıcısından ${role} rolü alındı.`);
        }
        if (commandName === 'mute' || commandName === 'to') {
            const user = options.getMember('user');
            const sure = commandName === 'to' ? 10 : options.getInteger('sure');
            await user.timeout(sure * 60 * 1000);
            await interaction.reply(`${user}, ${sure} dakika susturuldu.`);
        }
        if (commandName === 'unmute' || commandName === 'unto') {
            const user = options.getMember('user');
            await user.timeout(null);
            await interaction.reply(`${user} kullanıcısının cezası kaldırıldı.`);
        }
        if (commandName === 'lockchannel') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            await interaction.reply('Kanal kilitlendi. 🔒');
        }
        if (commandName === 'unlockchannel') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
            await interaction.reply('Kanal kilidi açıldı. 🔓');
        }
        if (commandName === 'ban') {
            const user = options.getUser('user');
            const sebep = options.getString('sebep') || 'Sebep yok';
            await guild.members.ban(user, { reason: sebep });
            await interaction.reply(`${user.tag} banlandı.`);
        }
        if (commandName === 'kick') {
            const user = options.getMember('user');
            await user.kick();
            await interaction.reply(`${user.user.tag} atıldı.`);
        }
    } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'Yetkim yetmedi veya bir hata oluştu.', ephemeral: true });
    }
});

client.login(TOKEN);
