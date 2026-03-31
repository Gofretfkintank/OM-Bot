//--------------------------------
// ROLEGUARD FIXED (Mantığı Bozmadan)
//--------------------------------
module.exports = (client) => {

    const TARGET_USER_ID = "837688603739816046";
    const PROTECTED_ROLE_NAME = "THE N1GG3REST N1GG3R OFF ALL TIME";
    const PROTECTED_ROLE_COLOR = 0x633d13;

    let activeRoleId = null;

    //--------------------------------
    // ROLE UPDATE (Name + Color)
    //--------------------------------
    client.on('roleUpdate', async (oldRole, newRole) => {
        if (!activeRoleId || newRole.id !== activeRoleId) return;

        try {
            const needUpdate = (newRole.name !== PROTECTED_ROLE_NAME || newRole.color !== PROTECTED_ROLE_COLOR);
            if (needUpdate) {
                await newRole.edit({
                    name: PROTECTED_ROLE_NAME,
                    color: PROTECTED_ROLE_COLOR
                });
                console.log(`⚠️ Role properties restored: ${newRole.name}`);
            }
        } catch (err) {
            console.error("Role Update Error:", err);
        }
    });

    //--------------------------------
    // MEMBER UPDATE
    //--------------------------------
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (!activeRoleId || !newMember.guild.roles.cache.has(activeRoleId)) return;

        try {
            const hasRole = newMember.roles.cache.has(activeRoleId);
            const hadRole = oldMember.roles.cache.has(activeRoleId);

            // Başkasına verilirse sil
            if (newMember.id !== TARGET_USER_ID && hasRole) {
                await newMember.roles.remove(activeRoleId);
            }

            // Sahibinden alınırsa geri ver
            if (newMember.id === TARGET_USER_ID && hadRole && !hasRole) {
                await newMember.roles.add(activeRoleId);
            }
        } catch (err) {
            console.error("Member Update Error:", err);
        }
    });

    //--------------------------------
    // ROLE DELETE
    //--------------------------------
    client.on('roleDelete', async (role) => {
        if (!activeRoleId) return;
        if (role.id !== activeRoleId && role.name !== PROTECTED_ROLE_NAME) return;

        try {
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

            console.log(`✅ Role revived: ${newRole.name}`);
        } catch (err) {
            console.error("Role Delete Error:", err);
        }
    });

    //--------------------------------
    // STARTUP
    //--------------------------------
    client.once('ready', async () => {
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
            }

            activeRoleId = role.id;

            const member = await guild.members.fetch(TARGET_USER_ID);
            if (!member.roles.cache.has(activeRoleId)) await member.roles.add(activeRoleId);

            // Sweep: diğer insanlardan al
            const allMembers = await guild.members.fetch();
            const unauthorized = allMembers.filter(m => m.roles.cache.has(activeRoleId) && m.id !== TARGET_USER_ID);
            for (const [id, m] of unauthorized) {
                await m.roles.remove(activeRoleId);
            }

            console.log("🟢 RoleGuard Online & Fully Protected");
        } catch (err) {
            console.error("RoleGuard Startup Error:", err);
        }
    });

};