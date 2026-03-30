module.exports = (client) => {

    // --- SETTINGS ---
    const TARGET_USER_ID = "837688603739816046";
    const PROTECTED_ROLE_NAME = "THE NIGGEREST NIGGER OFF ALL TIME"; 
    const PROTECTED_ROLE_COLOR = 0x633d13;

    let activeRoleId = null; 

    //--------------------------
    // ROLE CHANGE CONTROL (Real-time tracking)
    //--------------------------

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        // GPT Fix 1: Check if role ID exists and is still in the guild's cache/roles
        if (!activeRoleId || !newMember.guild.roles.cache.has(activeRoleId)) return;

        try {
            const hasRole = newMember.roles.cache.has(activeRoleId);
            const hadRole = oldMember.roles.cache.has(activeRoleId);

            // 1. 🚫 Anti-Exploit: Strip from unauthorized users
            if (newMember.id !== TARGET_USER_ID && hasRole) {
                await newMember.roles.remove(activeRoleId);
                console.log(`🚫 Anti-Exploit: Stripped from ${newMember.user.tag}`);
            }

            // 2. 🔒 Persistence: Re-apply to owner
            if (newMember.id === TARGET_USER_ID && hadRole && !hasRole) {
                await newMember.roles.add(activeRoleId);
                console.log(`🔒 Persistence: Restored to owner.`);
            }
        } catch (err) {
            // Ignore "Unknown Role" errors during rapid deletion/recreation cycles
            if (err.code !== 10011) console.error("Update Error:", err);
        }
    });

    //--------------------------
    // RECREATE ROLE IF DELETED
    //--------------------------

    client.on('roleDelete', async (role) => {
        // GPT Fix 2: Check both ID and Name to ensure we don't miss a deletion
        if (role.id !== activeRoleId && role.name !== PROTECTED_ROLE_NAME) return;

        try {
            const guild = role.guild;
            console.log("⚠️ CRITICAL: Role deleted! Recreating...");

            const newRole = await guild.roles.create({
                name: PROTECTED_ROLE_NAME,
                color: PROTECTED_ROLE_COLOR,
                permissions: role.permissions,
                hoist: role.hoist,
                mentionable: role.mentionable
            });

            // GPT Fix 3: Force fetch roles immediately after creation to sync cache
            await guild.roles.fetch(); 
            activeRoleId = newRole.id; 

            const member = await guild.members.fetch(TARGET_USER_ID);
            await member.roles.add(newRole);

            console.log(`✅ Recovery Complete: New ID is ${activeRoleId}`);
        } catch (err) {
            console.error("Recovery Error:", err);
        }
    });

    //--------------------------
    // INITIAL BOOT & GLOBAL SWEEPER
    //--------------------------

    client.once('clientReady', async () => {
        try {
            const guild = client.guilds.cache.first();
            if (!guild) return;

            console.log("🔄 Initializing RoleGuard...");
            
            // Sync all roles on startup
            await guild.roles.fetch();
            
            let role = guild.roles.cache.find(r => r.name === PROTECTED_ROLE_NAME);

            if (!role) {
                console.log('⚠️ Creating protected role...');
                role = await guild.roles.create({
                    name: PROTECTED_ROLE_NAME,
                    color: PROTECTED_ROLE_COLOR,
                    permissions: []
                });
                await guild.roles.fetch(); // Sync again after creation
            }

            activeRoleId = role.id;

            const member = await guild.members.fetch(TARGET_USER_ID);
            if (!member.roles.cache.has(activeRoleId)) {
                await member.roles.add(activeRoleId);
            }

            // GLOBAL SWEEPER
            const allMembers = await guild.members.fetch(); 
            const unauthorized = allMembers.filter(m => m.roles.cache.has(activeRoleId) && m.id !== TARGET_USER_ID);

            if (unauthorized.size > 0) {
                for (const [id, m] of unauthorized) {
                    await m.roles.remove(activeRoleId);
                    console.log(`- Cleaned: ${m.user.tag}`);
                }
                console.log(`✅ Sweeper Done: ${unauthorized.size} removed.`);
            }

            console.log("🟢 RoleGuard Online.");

        } catch (err) {
            console.error("Startup Error:", err);
        }
    });
};
