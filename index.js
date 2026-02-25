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
  // -------- Moderation --------
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
    .setDescription("Change a member's nickname")
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('nickname').setDescription('New nickname (leave empty to reset)'))
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

  // -------- Vote --------
  new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Create a timed button poll')
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (30s, 1m, 5m)').setRequired(true))
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

// ================= ACTIVE POLL (RAM) =================
let activePoll = null;

// ================= INTERACTIONS =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild, channel } = interaction;

  try {

    // -------- give-role --------
    if (commandName === 'give-role') {
      const member = options.getMember('user');
      if (!member) return interaction.reply({ content: '\u274c User not found in this server.', ephemeral: true });
      const role = options.getRole('role');
      await member.roles.add(role);
      return interaction.reply(`\u2705 Added **${role.name}** to ${member.user.username}.`);
    }

    // -------- take-role --------
    if (commandName === 'take-role') {
      const member = options.getMember('user');
      if (!member) return interaction.reply({ content: '\u274c User not found in this server.', ephemeral: true });
      const role = options.getRole('role');
      await member.roles.remove(role);
      return interaction.reply(`\u2705 Removed **${role.name}** from ${member.user.username}.`);
    }

    // -------- mute / to --------
    if (commandName === 'mute' || commandName === 'to') {
      const member = options.getMember('user');
      if (!member) return interaction.reply({ content: '\u274c User not found in this server.', ephemeral: true });
      if (member.roles.highest.position >= guild.members.me.roles.highest.position)
        return interaction.reply({ content: '\u274c I cannot mute someone with a higher or equal role than me.', ephemeral: true });
      const durationStr = options.getString('duration');
      const duration = parseDuration(durationStr);
      if (!duration) return interaction.reply({ content: '\u274c Invalid duration.', ephemeral: true });
      await member.timeout(duration);
      return interaction.reply(`\ud83d\udd07 ${member.user.username} has been muted for **${durationStr}**.`);
    }

    // -------- unmute / unto --------
    if (commandName === 'unmute' || commandName === 'unto') {
      const member = options.getMember('user');
      if (!member) return interaction.reply({ content: '\u274c User not found in this server.', ephemeral: true });
      await member.timeout(null);
      return interaction.reply(`\ud83d\udd0a Timeout removed for ${member.user.username}.`);
    }

    // -------- lockchannel --------
    if (commandName === 'lockchannel') {
      await interaction.deferReply();
      const botTopRole = guild.members.me.roles.highest.position;

      // \u00d6nce @everyone i\u00e7in SendMessages'\u0131 kapat
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });

      // SendMessages izni a\u00e7\u0131k\u00e7a VER\u0130LM\u0130\u015e olan t\u00fcm non-admin rolleri de kilitle
      for (const overwrite of channel.permissionOverwrites.cache.values()) {
        if (overwrite.type !== 0) continue; // sadece rol overwrite'lar\u0131na bak
        const role = guild.roles.cache.get(overwrite.id);
        if (!role) continue;
        if (role.id === guild.roles.everyone.id) continue; // zaten \u00fcstte hallettik
        if (role.permissions.has(PermissionFlagsBits.Administrator)) continue; // admin rollere dokunma
        if (role.position >= botTopRole) continue; // bottan y\u00fcksek rollere dokunma
        if (role.managed) continue; // bot rolleri
        // Bu rol\u00fcn channel overwrite'\u0131nda SendMessages a\u00e7\u0131k\u00e7a true ise kapat
        if (overwrite.allow.has(PermissionFlagsBits.SendMessages)) {
          await channel.permissionOverwrites.edit(role, { SendMessages: false });
        }
      }

      return interaction.editReply('\ud83d\udd12 Channel locked.');
    }

    // -------- unlockchannel --------
    if (commandName === 'unlockchannel') {
      await interaction.deferReply();
      // @everyone k\u0131s\u0131tlamas\u0131n\u0131 kald\u0131r
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
      // Di\u011fer rollerin SendMessages overwrite'lar\u0131n\u0131 da s\u0131f\u0131rla
      for (const overwrite of channel.permissionOverwrites.cache.values()) {
        if (overwrite.type !== 0) continue;
        const role = guild.roles.cache.get(overwrite.id);
        if (!role || role.id === guild.roles.everyone.id) continue;
        if (overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
          await channel.permissionOverwrites.edit(role, { SendMessages: null });
        }
      }
      return interaction.editReply('\ud83d\udd13 Channel unlocked.');
    }

    // -------- ban --------
    if (commandName === 'ban') {
      const user = options.getUser('user');
      const member = options.getMember('user');
      if (member && member.roles.highest.position >= guild.members.me.roles.highest.position)
        return interaction.reply({ content: '\u274c I cannot ban someone with a higher or equal role than me.', ephemeral: true });
      const reason = options.getString('reason') || 'No reason provided';
      await guild.members.ban(user.id, { reason });
      return interaction.reply(`\ud83d\udd28 **${user.username}** has been banned. Reason: ${reason}`);
    }

    // -------- kick --------
    if (commandName === 'kick') {
      const member = options.getMember('user');
      if (!member) return interaction.reply({ content: '\u274c User not found in this server.', ephemeral: true });
      if (member.roles.highest.position >= guild.members.me.roles.highest.position)
        return interaction.reply({ content: '\u274c I cannot kick someone with a higher or equal role than me.', ephemeral: true });
      await member.kick();
      return interaction.reply(`\ud83d\udc62 **${member.user.username}** has been kicked.`);
    }

    // -------- clear --------
    if (commandName === 'clear') {
      const amount = options.getInteger('amount');
      if (amount < 1 || amount > 100) return interaction.reply({ content: '\u274c Please enter a number between 1-100.', ephemeral: true });
      await channel.bulkDelete(amount, true);
      return interaction.reply({ content: `\ud83d\uddd1\ufe0f ${amount} messages deleted.`, ephemeral: true });
    }

    // -------- warn --------
    if (commandName === 'warn') {
      const member = options.getMember('user');
      if (!member) return interaction.reply({ content: '\u274c User not found in this server.', ephemeral: true });
      const reason = options.getString('reason');
      const data = getWarns();
      if (!data[member.id]) data[member.id] = [];
      data[member.id].push({ reason, date: new Date().toISOString() });
      saveWarns(data);
      return interaction.reply(`\u26a0\ufe0f **${member.user.username}** has been warned. Total warnings: **${data[member.id].length}**`);
    }

    // -------- warnings --------
    if (commandName === 'warnings') {
      const member = options.getMember('user');
      if (!member) return interaction.reply({ content: '\u274c User not found in this server.', ephemeral: true });
      const data = getWarns();
      if (!data[member.id] || data[member.id].length === 0)
        return interaction.reply(`\u2705 No warnings for **${member.user.username}**.`);
      const list = data[member.id].map((w, i) => `**${i + 1}.** ${w.reason}`).join('\n');
      return interaction.reply(`\ud83d\udccb Warnings for **${member.user.username}**:\n${list}`);
    }

    // -------- addrole --------
    if (commandName === 'addrole') {
      const name = options.getString('name');
      const color = options.getString('color');
      await guild.roles.create({ name, color: color || undefined, reason: `Created by ${interaction.user.username}` });
      return interaction.reply(`\u2705 Role **${name}** has been created.`);
    }

    // -------- delrole --------
    if (commandName === 'delrole') {
      const role = options.getRole('role');
      const roleName = role.name;
      await role.delete(`Deleted by ${interaction.user.username}`);
      return interaction.reply(`\ud83d\uddd1\ufe0f Role **${roleName}** has been deleted.`);
    }

    // -------- editrole --------
    if (commandName === 'editrole') {
      const role = options.getRole('role');
      const name = options.getString('name');
      const color = options.getString('color');
      await role.edit({
        name: name || role.name,
        color: color || role.hexColor,
        reason: `Edited by ${interaction.user.username}`
      });
      return interaction.reply(`\u2705 Role **${name || role.name}** has been updated.`);
    }

    // -------- nick --------
    if (commandName === 'nick') {
      const member = options.getMember('user');
      if (!member) return interaction.reply({ content: '\u274c User not found in this server.', ephemeral: true });
      if (member.roles.highest.position >= guild.members.me.roles.highest.position)
        return interaction.reply({ content: '\u274c I cannot change the nickname of someone with a higher or equal role than me.', ephemeral: true });
      const nickname = options.getString('nickname');
      try {
        await member.setNickname(nickname || null);
        return interaction.reply(
          `\u270f\ufe0f Nickname for **${member.user.username}** ${nickname ? `changed to **${nickname}**` : 'has been reset'}.`
        );
      } catch (err) {
        return interaction.reply({ content: '\u274c Failed to change nickname. Check bot permissions.', ephemeral: true });
      }
    }

    // -------- dm --------
    if (commandName === 'dm') {
      const user = options.getUser('user');
      const messageContent = options.getString('message');
      try {
        await user.send(`**\ud83d\udce8 Message from ${guild.name} Moderators:**\n${messageContent}`);
        return interaction.reply({ content: `\u2705 DM sent to **${user.username}**.`, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `\u274c Could not DM **${user.username}**. They might have DMs disabled.`, ephemeral: true });
      }
    }

    // -------- report --------
    if (commandName === 'report') {
      const reportedUser = options.getUser('user');
      const reason = options.getString('reason');
      console.log(`[REPORT] ${interaction.user.username} reported ${reportedUser.username} for: ${reason}`);
      return interaction.reply({ content: `\ud83d\udce9 Your report against **${reportedUser.username}** has been logged. Thank you.`, ephemeral: true });
    }

    // -------- slowmode --------
    if (commandName === 'slowmode') {
      const seconds = options.getInteger('seconds');
      await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.username}`);