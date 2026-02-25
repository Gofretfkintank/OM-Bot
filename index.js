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
  // -------- Moderation (Old) --------
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

  // -------- New Commands --------
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

  // -------- Vote (Old) --------
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

// ================= ACTIVE POLL (RAM) =================
let activePoll = null;

// ================= INTERACTIONS =================
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild, channel } = interaction;

  try {
    // -------- Old Moderation Commands --------
    if (commandName === 'give-role') {
      const member = options.getMember('user');
      const role = options.getRole('role');
      await member.roles.add(role);
      return interaction.reply(`Success: Added ${role.name} to ${member.user.tag}.`);
    }

    if (commandName === 'take-role') {
      const member = options.getMember('user');
      const role = options.getRole('role');
      await member.roles.remove(role);
      return interaction.reply(`Success: Removed ${role.name} from ${member.user.tag}.`);
    }

    if (commandName === 'mute' || commandName === 'to') {
      const member = options.getMember('user');
      const duration = parseDuration(options.getString('duration'));
      if (!duration) return interaction.reply({ content: 'Invalid duration.', ephemeral: true });
      await member.timeout(duration);
      return interaction.reply(`Success: ${member.user.tag} muted for ${options.getString('duration')}.`);
    }

    if (commandName === 'unmute' || commandName === 'unto') {
      const member = options.getMember('user');
      await member.timeout(null);
      return interaction.reply(`Success: Timeout removed for ${member.user.tag}.`);
    }

    if (commandName === 'lockchannel') {
      await interaction.deferReply();
      const botTopRole = guild.members.me.roles.highest.position;
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
      for (const role of guild.roles.cache.values()) {
        if (role.permissions.has(PermissionFlagsBits.Administrator) || role.position >= botTopRole || role.managed) continue;
        await channel.permissionOverwrites.edit(role, { SendMessages: false });
      }
      return interaction.editReply("Channel locked.");
    }

    if (commandName === 'unlockchannel') {
      await interaction.deferReply();
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
      return interaction.editReply("Channel unlocked.");
    }

    if (commandName === 'ban') {
      const member = options.getMember('user');
      const reason = options.getString('reason') || "No reason provided";
      await member.ban({ reason });
      return interaction.reply(`Success: ${member.user.tag} banned.`);
    }

    if (commandName === 'kick') {
      const member = options.getMember('user');
      await member.kick();
      return interaction.reply(`Success: ${member.user.tag} kicked.`);
    }

    if (commandName === 'clear') {
      const amount = options.getInteger('amount');
      if (amount < 1 || amount > 100) return interaction.reply({ content: 'Enter 1-100.', ephemeral: true });
      await channel.bulkDelete(amount, true);
      return interaction.reply({ content: `${amount} messages deleted.`, ephemeral: true });
    }

    if (commandName === 'warn') {
      const member = options.getMember('user');
      const reason = options.getString('reason');
      const data = getWarns();
      if (!data[member.id]) data[member.id] = [];
      data[member.id].push({ reason, date: new Date().toISOString() });
      saveWarns(data);
      return interaction.reply(`${member.user.tag} warned. Total: ${data[member.id].length}`);
    }

    if (commandName === 'warnings') {
      const member = options.getMember('user');
      const data = getWarns();
      if (!data[member.id] || data[member.id].length === 0) return interaction.reply(`No warnings for ${member.user.tag}.`);
      const list = data[member.id].map((w, i) => `${i + 1}. ${w.reason}`).join('\n');
      return interaction.reply(`Warnings:\n${list}`);
    }

    // -------- New Moderation & Utility Commands --------

    if (commandName === 'addrole') {
      const name = options.getString('name');
      const color = options.getString('color');
      await guild.roles.create({ name, color: color || undefined, reason: `Created by ${interaction.user.tag}` });
      return interaction.reply(`Success: Role **${name}** has been created.`);
    }

    if (commandName === 'delrole') {
      const role = options.getRole('role');
      const roleName = role.name;
      await role.delete(`Deleted by ${interaction.user.tag}`);
      return interaction.reply(`Success: Role **${roleName}** has been deleted.`);
    }

    if (commandName === 'editrole') {
      const role = options.getRole('role');
      const name = options.getString('name');
      const color = options.getString('color');
      await role.edit({ 
        name: name || role.name, 
        color: color || role.color, 
        reason: `Edited by ${interaction.user.tag}` 
      });
      return interaction.reply(`Success: Role **${name || role.name}** has been updated.`);
    }

    if (commandName === 'nick') {
      const member = options.getMember('user');
      const nickname = options.getString('nickname');
      await member.setNickname(nickname || null); 
      return interaction.reply(`Success: Nickname for ${member.user.tag} ${nickname ? `changed to **${nickname}**` : 'has been reset'}.`);
    }

    if (commandName === 'dm') {
      const user = options.getUser('user');
      const messageContent = options.getString('message');
      try {
        await user.send(`**Message from ${guild.name} Moderators:**\n${messageContent}`);
        return interaction.reply({ content: `Success: DM sent to ${user.tag}.`, ephemeral: true });
      } catch (error) {
        return interaction.reply({ content: `Failed: Could not DM ${user.tag}. They might have DMs disabled.`, ephemeral: true });
      }
    }

    if (commandName === 'report') {
      const reportedUser = options.getUser('user');
      const reason = options.getString('reason');
      // Sunucuda bir log kanalı olmadığından şimdilik sadece konsola yazdırıyor ve kullanıcıya onay veriyoruz.
      console.log(`[REPORT] ${interaction.user.tag} reported ${reportedUser.tag} for: ${reason}`);
      return interaction.reply({ content: `Your report against ${reportedUser.tag} has been safely logged. Thank you.`, ephemeral: true });
    }

    if (commandName === 'slowmode') {
      const seconds = options.getInteger('seconds');
      await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);
      return interaction.reply(`Success: Channel slowmode set to ${seconds} seconds.`);
    }

    if (commandName === 'unban') {
      const userId = options.getString('userid');
      try {
        await guild.bans.remove(userId, `Unbanned by ${interaction.user.tag}`);
        return interaction.reply(`Success: User with ID ${userId} has been unbanned.`);
      } catch (error) {
        return interaction.reply({ content: `Failed: Could not unban. Make sure the ID is correct and the user is actually banned.`, ephemeral: true });
      }
    }

    if (commandName === 'clear-warning') {
      const member = options.getMember('user');
      const data = getWarns();
      if (data[member.id]) {
        delete data[member.id];
        saveWarns(data);
        return interaction.reply(`Success: All warnings for ${member.user.tag} have been cleared.`);
      } else {
        return interaction.reply({ content: `${member.user.tag} currently has no warnings to clear.`, ephemeral: true });
      }
    }

    // -------- VOTE --------
    if (commandName === 'vote') {
      const question = options.getString('question');
      const durationStr = options.getString('duration');
      const optionsRaw = options.getString('options');

      const durationMs = parseDuration(durationStr);
      if (!durationMs) return interaction.reply({ content: 'Invalid duration. Use 30s, 1m, 5m.', ephemeral: true });

      const optionList = optionsRaw.split('|').map(o => o.trim()).filter(o => o);
      if (optionList.length < 2 || optionList.length > 5) return interaction.reply({ content: 'Provide 2-5 options.', ephemeral: true });

      let votes = {}; // { index: [usernames] }
      let userVotes = {}; // { userId: { optionIndex, attempts } }
      optionList.forEach((opt, i) => votes[i] = []);
      activePoll = { votes, userVotes, optionList };

      let buttons = optionList.map((opt, i) =>
        new ButtonBuilder().setCustomId(`vote_${i}`).setLabel(`${opt} (0)`).setStyle(ButtonStyle.Primary)
      );
      let row = new ActionRowBuilder().addComponents(buttons);

      await interaction.reply({
        content: `@everyone\n⚠️ **DO NOT MISCLICK**\n📊 **${question.toUpperCase()}**\n⏳ Duration: ${durationStr}`,
        components: [row]
      });

      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: durationMs });

      collector.on('collect', async i => {
        const index = parseInt(i.customId.split('_')[1]);
        if (!userVotes[i.user.id]) userVotes[i.user.id] = { optionIndex: null, attempts: 0 };

        if (userVotes[i.user.id].attempts >= 2)
          return i.reply({ content: '⚠️ You already used your 2 selection attempts.', ephemeral: true });

        // Remove previous vote if any
        if (userVotes[i.user.id].optionIndex !== null) {
          const oldIndex = userVotes[i.user.id].optionIndex;
          votes[oldIndex] = votes[oldIndex].filter(u => u !== i.user.tag);
        }

        votes[index].push(i.user.tag);
        userVotes[i.user.id].optionIndex = index;
        userVotes[i.user.id].attempts++;

        // Update button labels
        buttons = optionList.map((opt, i2) =>
          new ButtonBuilder().setCustomId(`vote_${i2}`).setLabel(`${opt} (${votes[i2].length})`).setStyle(ButtonStyle.Primary)
        );
        row = new ActionRowBuilder().addComponents(buttons);
        await msg.edit({ components: [row] });

        await i.reply({ content: `Vote registered. Attempts used: ${userVotes[i.user.id].attempts}/2`, ephemeral: true });
      });

      collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder().addComponents(buttons.map(btn => ButtonBuilder.from(btn).setDisabled(true)));
        let resultText = '';
        optionList.forEach((opt, i) => {
          const votersList = votes[i].length > 0 ? votes[i].join(', ') : 'No votes';
          resultText += `**${opt} (${votes[i].length} votes):** ${votersList}\n`;
        });
        await msg.edit({ content: `📊 **Poll Ended**\n\n${question}\n\n${resultText}`, components: [disabledRow] });
        activePoll = null;
      });
    }

    // -------- VOTE REMOVE (ADMIN ONLY) --------
    if (commandName === 'vote-remove') {
      if (!activePoll) return interaction.reply({ content: 'No active poll.', ephemeral: true });
      const target = options.getUser('user');
      const { votes, userVotes } = activePoll;

      if (!userVotes[target.id]) return interaction.reply({ content: 'User has not voted.', ephemeral: true });

      const index = userVotes[target.id].optionIndex;
      votes[index] = votes[index].filter(u => u !== target.tag);
      delete userVotes[target.id];

      return interaction.reply({ content: `${target.tag}'s vote has been removed.` });
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied) await interaction.reply({ content: 'An error occurred.', ephemeral: true });
  }
});

client.login(TOKEN);
