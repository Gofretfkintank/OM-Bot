module.exports = (client) => {

    const TARGET_USER_ID = "837688603739816046";
    let protectedRoleId = "1487415507031167176";

    //--------------------------
    // ROL DEĞİŞİM KONTROLÜ
    //--------------------------

    client.on('guildMemberUpdate', async (oldMember, newMember) => {

        try {

            const hadRole = oldMember.roles.cache.has(protectedRoleId);
            const hasRole = newMember.roles.cache.has(protectedRoleId);

            // 🔒 Birdnet'ten rol alınırsa geri ver
            if (newMember.id === TARGET_USER_ID && hadRole && !hasRole) {
                await newMember.roles.add(protectedRoleId);
            }

            // 🚫 Başkasına verilirse kaldır
            if (newMember.id !== TARGET_USER_ID && hasRole) {
                await newMember.roles.remove(protectedRoleId);
            }

        } catch (err) {
            console.error("RoleGuard error:", err);
        }
    });

    //--------------------------
    // ROL SİLİNİRSE YENİDEN OLUŞTUR
    //--------------------------

    client.on('roleDelete', async (role) => {

        if (role.id !== protectedRoleId) return;

        try {

            const guild = role.guild;

            const newRole = await guild.roles.create({
                name: role.name,
                color: '0x633d13',
                permissions: role.permissions,
                hoist: role.hoist,
                mentionable: role.mentionable
            });

            try {
                await newRole.setPosition(role.position);
            } catch {
                console.log('⚠️ Position set failed');
            }

            // 🔥 ID güncelle
            protectedRoleId = newRole.id;

            const member = await guild.members.fetch(TARGET_USER_ID);
            await member.roles.add(newRole);

            console.log(`✅ Role recreated & ID updated: ${newRole.id}`);

        } catch (err) {
            console.error("roleDelete error:", err);
        }
    });

    //--------------------------
    // BOT AÇILINCA KONTROL
    //--------------------------

    client.once('ready', async () => {

        try {

            const guild = client.guilds.cache.first();
            const member = await guild.members.fetch(TARGET_USER_ID);

            if (!member.roles.cache.has(protectedRoleId)) {
                await member.roles.add(protectedRoleId);
                console.log("✅ Role auto-given");
            }

        } catch (err) {
            console.error("Initial role error:", err);
        }
    });
};
