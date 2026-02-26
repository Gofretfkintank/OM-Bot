const { 
  Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
  PermissionFlagsBits 
} = require('discord.js');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID || "1446960659072946218";
const WARN_FILE = './warns.json';
if (!fs.existsSync(WARN_FILE)) fs.writeFileSync(WARN_FILE, JSON.stringify({}));

function getWarns() { return JSON.parse(fs.readFileSync(WARN_FILE)); }
function saveWarns(data) { fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2)); }

function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  switch(match[2]) {
    case 's': return value*1000;
    case 'm': return value*60*1000;
    case 'h': return value*60*60*1000;
    case 'd': return value*24*60*60*1000;
    default: return null;
  }
}

// ================== COMMANDS ==================
const commands = [
  new SlashCommandBuilder().setName('give-role').setDescription('Assign a role').addUserOption(opt=>opt.setName('user').setDescription('Target user').setRequired(true)).addRoleOption(opt=>opt.setName('role').setDescription('Role to assign').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('take-role').setDescription('Remove a role').addUserOption(opt=>opt.setName('user').setDescription('Target user').setRequired(true)).addRoleOption(opt=>opt.setName('role').setDescription('Role to remove').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('mute').setDescription('Timeout a member').addUserOption(opt=>opt.setName('user').setDescription('Target user').setRequired(true)).addStringOption(opt=>opt.setName('duration').setDescription('10m,1h,1d').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('unmute').setDescription('Remove timeout').addUserOption(opt=>opt.setName('user').setDescription('Target user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a member').addUserOption(opt=>opt.setName('user').setDescription('Target user').setRequired(true)).addStringOption(opt=>opt.setName('reason').setDescription('Reason for ban')).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('kick').setDescription('Kick a member').addUserOption(opt=>opt.setName('user').setDescription('Target user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName('warn').setDescription('Warn a member').addUserOption(opt=>opt.setName('user').setDescription('Target user').setRequired(true)).addStringOption(opt=>opt.setName('reason').setDescription('Reason').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('warnings').setDescription('Check member warnings').addUserOption(opt=>opt.setName('user').setDescription('Target user').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('addrole').setDescription('Create a new role').addStringOption(opt=>opt.setName('name').setDescription('Role name').setRequired(true)).addStringOption(opt=>opt.setName('color').setDescription('Hex color code')).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('delrole').setDescription('Delete a role').addRoleOption(opt=>opt.setName('role').setDescription('Role to delete').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('editrole').setDescription('Edit a role').addRoleOption(opt=>opt.setName('role').setDescription('Role to edit').setRequired(true)).addStringOption(opt=>opt.setName('name').setDescription('New name')).addStringOption(opt=>opt.setName('color').setDescription('New hex color code')).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  new SlashCommandBuilder().setName('nick').setDescription('Change nickname').addUserOption(opt=>opt.setName('user').setDescription('Target user').setRequired(true)).addStringOption(opt=>opt.setName('nickname').setDescription('New nickname')).setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
  new SlashCommandBuilder().setName('dm').setDescription('Send DM').addUserOption(opt=>opt.setName('user').setDescription('Target user').setRequired(true)).addStringOption(opt=>opt.setName('message').setDescription('Message content').setRequired(true))
].map(cmd=>cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// ================== EVENTS ==================
client.once('ready', async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
    console.log(`Bot ${client.user.tag} ready!`);
  } catch (err) { console.error('Command register failed:', err); }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply({ ephemeral: false }).catch(()=>{});
  const { commandName, options, guild } = interaction;

  try {
    const member = options.getMember('user');
    const role = options.getRole ? options.getRole('role') : null;
    const msg = options.getString('message');
    const duration = options.getString('duration') ? parseDuration(options.getString('duration')) : null;

    switch(commandName){
      case 'give-role': await member.roles.add(role); return interaction.editReply(`✅ Added ${role.name} to ${member.user.tag}`);
      case 'take-role': await member.roles.remove(role); return interaction.editReply(`✅ Removed ${role.name} from ${member.user.tag}`);
      case 'mute': if(!duration) return interaction.editReply('Invalid duration'); await member.timeout(duration); return interaction.editReply(`🔇 ${member.user.tag} muted for ${options.getString('duration')}`);
      case 'unmute': await member.timeout(null); return interaction.editReply(`🔊 Timeout removed for ${member.user.tag}`);
      case 'ban': await member.ban({ reason: options.getString('reason') || 'No reason' }); return interaction.editReply(`🔨 ${member.user.tag} banned`);
      case 'kick': await member.kick(); return interaction.editReply(`👢 ${member.user.tag} kicked`);
      case 'warn': { const data=getWarns(); if(!data[member.id]) data[member.id]=[]; data[member.id].push({reason: options.getString('reason'), date: new Date().toISOString()}); saveWarns(data); return interaction.editReply(`⚠️ ${member.user.tag} warned. Total: ${data[member.id].length}`);}
      case 'warnings': { const data=getWarns(); if(!data[member.id]||data[member.id].length===0) return interaction.editReply(`✅ No warnings for ${member.user.tag}`); const list=data[member.id].map((w,i)=>`${i+1}. ${w.reason}`).join('\n'); return interaction.editReply(`📋 Warnings:\n${list}`);}
      case 'addrole': await guild.roles.create({name: options.getString('name'), color: options.getString('color')||undefined, reason: `Created by ${interaction.user.tag}`}); return interaction.editReply(`✅ Role ${options.getString('name')} created`);
      case 'delrole': await role.delete(`Deleted by ${interaction.user.tag}`); return interaction.editReply(`🗑️ Role ${role.name} deleted`);
      case 'editrole': await role.edit({name: options.getString('name')||role.name, color: options.getString('color')||role.color, reason: `Edited by ${interaction.user.tag}`}); return interaction.editReply(`✏️ Role ${options.getString('name')||role.name} updated`);
      case 'nick': await member.setNickname(options.getString('nickname')||null); return interaction.editReply(`📝 Nickname for ${member.user.tag} ${options.getString('nickname') ? `changed to ${options.getString('nickname')}`:'reset'}`);
      case 'dm': try{await options.getUser('user').send(`📩 Message from ${guild.name} Mods:\n${msg}`); return interaction.editReply(`✅ DM sent to ${options.getUser('user').tag}`);}catch{return interaction.editReply(`❌ Could not DM ${options.getUser('user').tag}`);}
    }
  }catch(err){console.error(err); interaction.editReply('❌ Error executing command');}
});

// ===== Additional Event Listeners =====
client.on('messageCreate', msg => console.log(`[Message] ${msg.author.tag}: ${msg.content}`));
client.on('guildMemberAdd', member => console.log(`[Join] ${member.user.tag} joined ${member.guild.name}`));
client.on('guildMemberRemove', member => console.log(`[Leave] ${member.user.tag} left ${member.guild.name}`));
client.on('roleCreate', role => console.log(`[Role Created] ${role.name}`));
client.on('roleDelete', role => console.log(`[Role Deleted] ${role.name}`));
client.on('guildBanAdd', (guild,user)=>console.log(`[Ban] ${user.tag} banned in ${guild.name}`));
client.on('guildBanRemove', (guild,user)=>console.log(`[Unban] ${user.tag} unbanned in ${guild.name}`));
client.on('error', error=>console.error('[Bot Error]',error));
client.on('warn', info=>console.warn('[Bot Warning]',info));

client.login(TOKEN);