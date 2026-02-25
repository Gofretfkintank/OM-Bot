const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const GUILD_ID = "1446960659072946218";

// ================= WARN STORAGE =================
const WARN_FILE = './warns.json';
if (!fs.existsSync(WARN_FILE)) fs.writeFileSync(WARN_FILE, JSON.stringify({}));

function getWarns() { return JSON.parse(fs.readFileSync(WARN_FILE)); }
function saveWarns(data) { fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2)); }

// ================= DURATION PARSER =================
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

// ================= COMMANDS =================
const commands = [
  // Moderation
  new SlashCommandBuilder()
    .setName('give-role')
    .setDescription('Assign a role to a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('take-role')
    .setDescription('Remove a role from a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (10m, 1h, 1d)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('to')
    .setDescription('Quick timeout a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (10m, 1h)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('unto')
    .setDescription('Remove timeout')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('lockchannel')
    .setDescription('Lock current channel for non-admin roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('unlockchannel')
    .setDescription('Unlock current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete messages')
    .addIntegerOption(opt => opt.setName('amount').setDescription('1-100').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Check member warnings')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // Roles
  new SlashCommandBuilder()
    .setName('addrole')
    .setDescription('Create a new role')
    .addStringOption(opt => opt.setName('name').setDescription('Role name').setRequired(true))
    .addStringOption(opt => opt.setName('color').setDescription('Hex color code (e.g., #FF0000)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('delrole')
    .setDescription('Delete a role')
    .addRoleOption(opt => opt.setName('role').setDescription('Role to delete').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('editrole')
    .setDescription('Edit an existing role')
    .addRoleOption(opt => opt.setName('role').setDescription('Role to edit').setRequired(true))
    .addStringOption(opt => opt.setName('name').setDescription('New name'))
    .addStringOption(opt => opt.setName('color').setDescription('New hex color code (e.g., #00FF00)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change a member\'s nickname')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('nickname').setDescription('New nickname (Leave empty to reset)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Send a direct message to a user via bot')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Message content').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a user to server moderators')
    .addUserOption(opt => opt.setName('user').setDescription('User to report').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for reporting').setRequired(true)),

  new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode for the current channel')
    .addIntegerOption(opt => opt.setName('seconds').setDescription('Slowmode in seconds (0 to disable)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by their ID')
    .addStringOption(opt => opt.setName('userid').setDescription('Target user ID').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('clear-warning')
    .setDescription('Clear all warnings for a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // Vote
  new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Create a timed button poll')
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (30s,1m,5m)').setRequired(true))
    .addStringOption(opt => opt.setName('options').setDescription('Separate 2-5 options with |').setRequired(true)),

  new SlashCommandBuilder()
    .setName('vote-remove')
    .setDescription('Remove a user vote (admin only)')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
  console.log(`Bot ${client.user.tag} ready.`);
});

// ================= ACTIVE POLL =================
let activePoll = null;

// ================= INTERACTIONS =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, guild, channel } = interaction;

  try {
    // ---------- GIVE / TAKE ROLE ----------
    if (commandName === 'give-role') {
      const member = options.getMember('user');
      const role = options.getRole('role');
      await member.roles.add(role);
      return interaction.reply(`✅ Added ${role.name} to ${member.user.tag}`);
    }
    if (commandName === 'take-role') {
      const member = options.getMember('user');
      const role = options.getRole('role');
      await member.roles.remove(role);
      return interaction.reply(`✅ Removed ${role.name} from ${member.user.tag}`);
    }

    // ---------- MUTE / UNMUTE ----------
    if (commandName === 'mute' || commandName === 'to') {
      const member = options.getMember('user');
      const duration = parseDuration(options.getString('duration'));
      if (!duration) return interaction.reply({ content: 'Invalid duration.', ephemeral: true });
      await member.timeout(duration);
      return interaction.reply(`🔇 ${member.user.tag} muted for ${options.getString('duration')}`);
    }
    if (commandName === 'unmute' || commandName === 'unto') {
      const member = options.getMember('user');
      await member.timeout(null);
      return interaction.reply(`🔊 Timeout removed for ${member.user.tag}`);
    }

    // ---------- LOCK / UNLOCK CHANNEL ----------
    if (commandName === 'lockchannel') {
      await interaction.deferReply();
      const botTopRole = guild.members.me.roles.highest.position;

      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
      for (const role of guild.roles.cache.values()) {
        if (
          role.id === guild.roles.everyone.id ||
          role.managed ||
          role.permissions.has(PermissionFlagsBits.Administrator) ||
          role.position >= botTopRole
        ) continue;
        await channel.permissionOverwrites.edit(role, { SendMessages: false });
      }
      return interaction.editReply("🔒 Channel locked!");
    }

    if (commandName === 'unlockchannel') {
      await interaction.deferReply();
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
      for (const role of guild.roles.cache.values()) {
        if (
          role.id === guild.roles.everyone.id ||
          role.managed ||
          role.permissions.has(PermissionFlagsBits.Administrator)
        ) continue;
        await channel.permissionOverwrites.edit(role, { SendMessages: null });
      }
      return interaction.editReply("🔓 Channel unlocked!");
    }

    // ---------- BAN / KICK ----------
    if (commandName === 'ban') {
      const member = options.getMember('user');
      const reason = options.getString('reason') || "No reason provided";
      await member.ban({ reason });
      return interaction.reply(`🔨 ${member.user.tag} banned. Reason: ${reason}`);
    }
    if (commandName === 'kick') {
      const member = options.getMember('user');
      await member.kick();
      return interaction.reply(`👢 ${member.user.tag} kicked`);
    }

    // ---------- CLEAR ----------
    if (commandName === 'clear') {
      const amount = options.getInteger('amount');
      if (amount < 1 || amount > 100) return interaction.reply({ content: 'Enter 1-100.', ephemeral: true });
      await channel.bulkDelete(amount, true);
      return interaction.reply({ content: `🧹 ${amount} messages deleted.`, ephemeral: true });
    }

    // ---------- WARN / WARNINGS ----------
    if (commandName === 'warn') {
      const member = options.getMember('user');
      const reason = options.getString('reason');
      const data = getWarns();
      if (!data[member.id]) data[member.id] = [];
      data[member.id].push({ reason, date: new Date().toISOString() });
      saveWarns(data);
      return interaction.reply(`⚠️ ${member.user.tag} warned. Total: ${data[member.id].length}`);
    }
    if (commandName === 'warnings') {
      const member = options.getMember('user');
      const data = getWarns();
      if (!data[member.id] || data[member.id].length === 0) return interaction.reply(`✅ No warnings for ${member.user.tag}`);
      const list = data[member.id].map((w,i)=>`${i+1}. ${w.reason}`).join('\n');
      return interaction.reply(`📋 Warnings:\n${list}`);
    }

    // ---------- ADD / DEL / EDIT ROLE ----------
    if (commandName === 'addrole') {
      const name = options.getString('name');
      const color = options.getString('color');
      await guild.roles.create({ name, color: color || undefined, reason: `Created by ${interaction.user.tag}` });
      return interaction.reply(`✅ Role ${name} created`);
    }
    if (commandName === 'delrole') {
      const role = options.getRole('role');
      const roleName = role.name;
      await role.delete(`Deleted by ${interaction.user.tag}`);
      return interaction.reply(`🗑️ Role ${roleName} deleted`);
    }
    if (commandName === 'editrole') {
      const role = options.getRole('role');
      const name = options.getString('name');
      const color = options.getString('color');
      await role.edit({ name: name || role.name, color: color || role.color, reason: `Edited by ${interaction.user.tag}` });
      return interaction.reply(`✏️ Role ${name || role.name} updated`);
    }

    // ---------- NICK / DM / REPORT ----------
    if (commandName === 'nick') {
      const member = options.getMember('user');
      const nickname = options.getString('nickname');
      await member.setNickname(nickname || null);
      return interaction.reply(`📝 Nickname for ${member.user.tag} ${nickname ? `changed to ${nickname}` : 'reset'}`);
    }
    if (commandName === 'dm') {
      const user = options.getUser('user');
      const msgContent = options.getString('message');
      try {
        await user.send(`📩 Message from ${guild.name} Mods:\n${msgContent}`);
        return interaction.reply({ content: `✅ DM sent to ${user.tag}`, ephemeral: true });
      } catch {
        return interaction.reply({ content: `❌ Could not DM ${user.tag}`, ephemeral: true });
      }
    }
    if (commandName === 'report') {
      const reportedUser = options.getUser('user');
      const reason = options.getString('reason');
      console.log(`[REPORT] ${interaction.user.tag} reported ${reportedUser.tag} for: ${reason}`);
      return interaction.reply({ content: `📨 Report against ${reportedUser.tag} logged.`, ephemeral: true });
    }

    // ---------- SLOWMODE / UNBAN / CLEAR-WARNING ----------
    if (commandName === 'slowmode') {
      const seconds = options.getInteger('seconds');
      await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);
      return interaction.reply(`⏱️ Slowmode set to ${seconds} seconds`);
    }
    if (commandName === 'unban') {
      const userId = options.getString('userid');
      try {
        await guild.bans.remove(userId, `Unbanned by ${interaction.user.tag}`);
        return interaction.reply(`✅ User with ID ${userId} unbanned`);
      } catch {
        return interaction.reply({ content: `❌ Could not unban. Check ID or if user is banned.`, ephemeral: true });
      }
    }
    if (commandName === 'clear-warning') {
      const member = options.getMember('user');
      const data = getWarns();
      if (data[member.id]) { delete data[member.id]; saveWarns(data); return interaction.reply(`✅ Warnings cleared for ${member.user.tag}`); }
      else return interaction.reply({ content: `${member.user.tag} has no warnings`, ephemeral: true });
    }

    // ---------- VOTE ----------
    if (commandName === 'vote') {
      const question = options.getString('question');
      const durationStr = options.getString('duration');
      const optionsRaw = options.getString('options');
      const durationMs = parseDuration(durationStr);
      if (!durationMs) return interaction.reply({ content: 'Invalid duration. Use 30s,1m,5m.', ephemeral: true });
      const optionList =