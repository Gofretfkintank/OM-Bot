const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Token is now securely pulled from Railway Environment Variables
const TOKEN = process.env.TOKEN; 

function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

const commands = [
    new SlashCommandBuilder().setName('give-role').setDescription('Assigns a role to a member').addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true)).addRoleOption(opt => opt.setName('role').setDescription('The role').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    new SlashCommandBuilder().setName('take-role').setDescription('Removes a role from a member').addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true)).addRoleOption(opt => opt.setName('role').setDescription('The role').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    new SlashCommandBuilder().setName('mute').setDescription('Timeout a member').addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true)).addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('unmute').setDescription('Removes timeout from a member').addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('to').setDescription('Quick timeout').addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true)).addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h)').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('unto').setDescription('Removes timeout').addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder().setName('lockchannel').setDescription('Locks the current channel for all non-admin roles').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName('unlockchannel').setDescription('Unlocks the current channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    new SlashCommandBuilder().setName('ban').setDescription('Bans a member').addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true)).addStringOption(opt => opt.setName('reason').setDescription('Reason for ban')).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    new SlashCommandBuilder().setName('kick').setDescription('Kicks a member').addUserOption(opt => opt.setName('user').setDescription('The user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`Bot ${client.user.tag} is online and English commands are loaded!`);
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
            await interaction.reply(`Success: Added ${role.name} to ${user.user.tag}.`);
        }
        if (commandName === 'take-role') {
            const user = options.getMember('user');
            const role = options.getRole('role');
            await user.roles.remove(role);
            await interaction.reply(`Success: Removed ${role.name} from ${user.user.tag}.`);
        }
        if (commandName === 'mute' || commandName === 'to') {
            const user = options.getMember('user');
            const durationStr = options.getString('duration');
            const durationMs = parseDuration(durationStr);
            if (!durationMs) return interaction.reply({ content: 'Invalid duration! Use 10m, 1h, or 1d.', ephemeral: true });
            await user.timeout(durationMs);
            await interaction.reply(`Success: ${user.user.tag} has been muted for ${durationStr}.`);
        }
        if (commandName === 'unmute' || commandName === 'unto') {
            const user = options.getMember('user');
            await user.timeout(null);
            await interaction.reply(`Success: Timeout removed for ${user.user.tag}.`);
        }

        if (commandName === 'lockchannel') {
            await interaction.deferReply();
            const botTopRolePosition = guild.members.me.roles.highest.position;
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            const roles = guild.roles.cache;
            for (const [id, role] of roles) {
                if (
                    role.permissions.has(PermissionFlagsBits.Administrator) || 
                    role.id === guild.id || 
                    role.managed || 
                    role.position >= botTopRolePosition
                ) continue;

                await channel.permissionOverwrites
