const { 
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
  PermissionFlagsBits 
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
const WARN_FILE = './warns.json';
if (!fs.existsSync(WARN_FILE)) fs.writeFileSync(WARN_FILE, JSON.stringify({}));

function getWarns() { return JSON.parse(fs.readFileSync(WARN_FILE)); }
function saveWarns(data) { fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2)); }

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  switch(unit) {
    case 's': return value*1000;
    case 'm': return value*60*1000;
    case 'h': return value*60*60*1000;
    case 'd': return value*24*60*60*1000;
    default: return null;
  }
}

// ================== COMMANDS ==================
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
    .addStringOption(opt => opt.setName('duration').setDescription('10m,1h,1d').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a member')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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
    .addStringOption(opt => opt.setName('color').setDescription('Hex color code'))
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
    .addStringOption(opt => opt.setName('color').setDescription('New hex color code'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change a member\'s nickname')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('nickname').setDescription('New nickname'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Send a direct message to a user')
    .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Message content').setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log(`Bot ${client.user.tag} ready!`);
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  await interaction.deferReply({ ephemeral: false }).catch(() => {});

  const { commandName, options, guild } = interaction;

  try {
    if (commandName === 'give-role') {
      const member = options.getMember('user');
      const role = options.getRole('role');
      await member.roles.add(role);
      return interaction.editReply(`✅ Added ${role.name} to ${member.user.tag}`);
    }

    if (commandName === 'take-role') {
      const member = options.getMember('user');
      const role = options.getRole('role');
      await member.roles.remove(role);
      return interaction.editReply(`✅ Removed ${role.name} from ${member.user.tag}`);
    }

    if (commandName === 'mute') {
      const member = options.getMember('user');
      const duration = parseDuration(options.getString('duration'));
      if (!duration) return interaction.editReply('Invalid duration.');
      await member.timeout(duration);
      return interaction.editReply(`🔇 ${member.user.tag} muted for ${options.getString('duration')}`);
    }

    if (commandName === 'unmute') {
      const member = options.getMember('user');
      await member.timeout(null);
      return interaction.editReply(`🔊 Timeout removed for ${member.user.tag}`);
    }

    if (commandName === 'ban') {
      const member = options.getMember('user');
      const reason = options.getString('reason') || "No reason provided";
      await member.ban({ reason });
      return interaction.editReply(`🔨 ${member.user.tag} banned. Reason: ${reason}`);
    }

    if (commandName === 'kick') {
      const member = options.getMember('user');
      await member.kick();
      return interaction.editReply(`👢 ${member.user.tag} kicked`);
    }

    if (commandName === 'warn') {
      const member = options.getMember('user');
      const reason = options.getString('reason');
      const data = getWarns();
      if (!data[member.id]) data[member.id] = [];
      data[member.id].push({ reason, date: new Date().toISOString() });
      saveWarns(data);
      return interaction.editReply(`⚠️ ${member.user.tag} warned. Total: ${data[member.id].length}`);
    }

    if (commandName === 'warnings') {
      const member = options.getMember('user');
      const data = getWarns();
      if (!data[member.id] || data[member.id].length === 0) return interaction.editReply(`✅ No warnings for ${member.user.tag}`);
      const list = data[member.id].map((w,i)=>`${i+1}. ${w.reason}`).join('\n');
      return interaction.editReply(`📋 Warnings:\n${list}`);
    }

    if (commandName === 'addrole') {
      const name = options.getString('name');
      const color = options.getString('color');
      await guild.roles.create({ name, color: color || undefined, reason: `Created by ${interaction.user.tag}` });
      return interaction.editReply(`✅ Role ${name} created`);
    }

    if (commandName === 'delrole') {
      const role = options.getRole('role');
      const roleName = role.name;
      await role.delete(`Deleted by ${interaction.user.tag}`);
      return interaction.editReply(`🗑️ Role ${roleName} deleted`);
    }

    if (commandName === 'editrole') {
      const role = options.getRole('role');
      const name = options.getString('name');
      const color = options.getString('color');
      await role.edit({ name: name || role.name, color: color || role.color, reason: `Edited by ${interaction.user.tag}` });
      return interaction.editReply(`✏️ Role ${name || role.name} updated`);
    }

    if (commandName === 'nick') {
      const member = options.getMember('user');
      const nickname = options.getString('nickname');
      await member.setNickname(nickname || null);
      return interaction.editReply(`📝 Nickname for ${member.user.tag} ${nickname ? `changed to ${nickname}` : 'reset'}`);
    }

    if (commandName === 'dm') {
      const user = options.getUser('user');
      const msg = options.getString('message');
      try {
        await user.send(`📩 Message from ${guild.name} Mods:\n${msg}`);
        return interaction.editReply(`✅ DM sent to ${user.tag}`);
      } catch {
        return interaction.editReply(`❌ Could not DM ${user.tag}`);
      }
    }

  } catch (err) {
    console.error(err);
    interaction.editReply('❌ Error executing command.');
  }
});

client.login(TOKEN);