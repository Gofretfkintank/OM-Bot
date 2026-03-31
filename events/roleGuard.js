module.exports = (client) => {

    // --- SETTINGS ---
    const TARGET_USER_ID = "837688603739816046";
    const PROTECTED_ROLE_NAME = "THE N1GG3REST N1GG3R OFF ALL TIME"; 
    const PROTECTED_ROLE_COLOR = 0x633d13;

    //--------------------------
    // 1. MEMBER ROLE CONTROL
    //--------------------------
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        try {
            const hasRole = newMember.roles.cache.some(r => r.name === PROTECTED_ROLE_NAME);
            const hadRole = oldMember.roles.cache.some(r => r.name === PROTECTED_ROLE_NAME);

            // Başkasına verilirse sil
            if (newMember.id !== TARGET_USER_ID && hasRole) {
                const role = newMember.roles.cache.find(r => r.name === PROTECTED_ROLE_NAME);
                if (role) await newMember.roles.remove(role);
                console.log(`🚫 Removed meme role from ${newMember.user.tag}`);
            }

            // Sahibinden alınırsa geri ver
            if (newMember.id === TARGET_USER_ID && hadRole && !hasRole) {
                let role = newMember.guild.roles.cache.find(r => r.name === PROTECTED_ROLE_NAME);
                if (!role) {
                    role = await newMember.guild.roles.create({
                        name: PROTECTED_ROLE_NAME,
                        color: PROTECTED_ROLE_COLOR
                    });
                }
                await newMember.roles.add(role);
                console.log(`🔒 Restored meme role to owner.`);
            }

        } catch (err) {
            console.error("Member update error:", err);
        }
    });

    //--------------------------
    // 2. STARTUP
    //--------------------------
    client.once('ready', async () => {
        try {
            const guild = client.guilds.cache.first();
            if (!guild) return;

            let role = guild.roles.cache.find(r => r.name === PROTECTED_ROLE_NAME);
            if (!role) {
                role = await guild.roles.create({
                    name: PROTECTED_ROLE_NAME,
                    color: PROTECTED_ROLE_COLOR
                });
            }

            const member = await guild.members.fetch(TARGET_USER_ID);
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
            }

            console.log("🟢 Meme RoleGuard V1 Online. No shield active.");
        } catch (err) {
            console.error("Startup error:", err);
        }
    });
};