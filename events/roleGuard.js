module.exports = (client) => {

    // --- SETTINGS ---
    const TARGET_USER_ID = "837688603739816046";
    const PROTECTED_ROLE_NAME = "THE NIGGEREST NIGGER OFF ALL TIME"; 
    const PROTECTED_ROLE_COLOR = 0x633d13;

    let activeRoleId = null; 

    //--------------------------
    // 1. ROLÜN ÖZELLİKLERİNİ KORUMA (Yeni Eklendi!)
    //--------------------------
    client.on('roleUpdate', async (oldRole, newRole) => {
        if (newRole.id !== activeRoleId) return;

        // Adı, rengi veya izinleri değişmişse ANINDA geri çevir
        if (newRole.name !== PROTECTED_ROLE_NAME || newRole.color !== PROTECTED_ROLE_COLOR) {
            try {
                console.log("⚠️ Role properties modified! Reverting...");
                await newRole.edit({
                    name: PROTECTED_ROLE_NAME,
                    color: PROTECTED_ROLE_COLOR
                });
                console.log("✅ Role properties restored.");
            } catch (err) {
                console.error("Restoration Error:", err);
            }
        }
    });

    //--------------------------
    // 2. ÜYE ROL DEĞİŞİM KONTROLÜ
    //--------------------------
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (!activeRoleId || !newMember.guild.roles.cache.has(activeRoleId)) return;

        try {
            const hasRole = newMember.roles.cache.has(activeRoleId);
            const hadRole = oldMember.roles.cache.has(activeRoleId);

            // Başkasına verilirse sil
            if (newMember.id !== TARGET_USER_ID && hasRole) {
                await newMember.roles.remove(activeRoleId);
                console.log(`🚫 Stripped from unauthorized user: ${newMember.user.tag}`);
            }

            // Sahibinden alınırsa geri ver
            if (newMember.id === TARGET_USER_ID && hadRole && !hasRole) {
                await newMember.roles.add(activeRoleId);
                console.log(`🔒 Restored to owner.`);
            }
        } catch (err) {
            if (err.code !== 10011) console.error("Update Error:", err);
        }
    });

    //--------------------------
    // 3. ROLÜN SİLİNMESİNİ ENGELLEME
    //--------------------------
    client.on('roleDelete', async (role) => {
        if (role.id !== activeRoleId && role.name !== PROTECTED_ROLE_NAME) return;

        try {
            console.log("⚠️ Role deleted! Recreating...");
            const guild = role.guild;
            const newRole = await guild.roles.create({
                name: PROTECTED_ROLE_NAME,
                color: PROTECTED_ROLE_COLOR,
                permissions: role.permissions
            });

            await guild.roles.fetch(); 
            activeRoleId = newRole.id; 

            const member = await guild.members.fetch(TARGET_USER_ID);
            await member.roles.add(newRole);
            console.log(`✅ Role revived.`);
        } catch (err) {
            console.error("Recovery Error:", err);
        }
    });

    //--------------------------
    // 4. BAŞLANGIÇ VE TEMİZLİK
    //--------------------------
    client.once('clientReady', async () => {
        try {
            const guild = client.guilds.cache.first();
            if (!guild) return;

            await guild.roles.fetch();
            let role = guild.roles.cache.find(r => r.name === PROTECTED_ROLE_NAME);

            if (!role) {
                role = await guild.roles.create({
                    name: PROTECTED_ROLE_NAME,
                    color: PROTECTED_ROLE_COLOR
                });
                await guild.roles.fetch();
            }

            activeRoleId = role.id;

            const member = await guild.members.fetch(TARGET_USER_ID);
            if (!member.roles.cache.has(activeRoleId)) await member.roles.add(activeRoleId);

            // Sweeper
            const allMembers = await guild.members.fetch(); 
            const unauthorized = allMembers.filter(m => m.roles.cache.has(activeRoleId) && m.id !== TARGET_USER_ID);
            unauthorized.forEach(async (m) => await m.roles.remove(activeRoleId));

            console.log("🟢 RoleGuard V3 Online and Secure.");
        } catch (err) {
            console.error("Startup Error:", err);
        }
    });
};
