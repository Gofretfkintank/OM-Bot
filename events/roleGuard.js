module.exports = (client) => {

    const TARGET_USER_ID = "837688603739816046";
    const PROTECTED_ROLE_NAME = "THE NIGGEREST NIGGER OFF ALL TIME";
    const PROTECTED_ROLE_COLOR = 0x633d13;

    const getProtectedRole = (guild) =>
        guild.roles.cache.find(r => r.name === PROTECTED_ROLE_NAME);

    //--------------------------
    // ROL DEĞİŞİM KONTROLÜ
    //--------------------------

    client.on('guildMemberUpdate', async (oldMember, newMember) => {

        try {

            const role = getProtectedRole(newMember.guild);
            if (!role) return;

            const hadRole = oldMember.roles.cache.has(role.id);
            const hasRole = newMember.roles.cache.has(role.id);

            // 🔒 Birdnet'ten rol alınırsa geri ver
            if (newMember.id === TARGET_USER_ID && hadRole && !hasRole) {
                await newMember.roles.add(role);
            }

            // 🚫 Başkasına verilirse kaldır
            if (newMember.id !== TARGET_USER_ID && hasRole) {
                await newMember.roles.remove(role);
            }

        } catch (err) {
            console.error("RoleGuard error:", err);
        }
    });

    //--------------------------
    // ROL SİLİNİRSE YENİDEN OLUŞTUR
    //--------------------------

    client.on('roleDelete', async (role) => {

        if (role.name !== PROTECTED_ROLE_NAME) return;

        try {

            const guild = role.guild;

            const newRole = await guild.roles.create({
                name: PROTECTED_ROLE_NAME,
                color: PROTECTED_ROLE_COLOR,
                permissions: role.permissions,
                hoist: role.hoist,
                mentionable: role.mentionable
            });

            try {
                await newRole.setPosition(role.position);
            } catch {
                console.log('⚠️ Position set failed');
            }

            const member = await guild.members.fetch(TARGET_USER_ID);
            await member.roles.add(newRole);

            console.log(`✅ Role recreated & given`);

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
            const role = getProtectedRole(guild);

            if (!role) {
                console.log('⚠️ Protected role bulunamadı, oluşturuluyor...');

                const newRole = await guild.roles.create({
                    name: PROTECTED_ROLE_NAME,
                    color: PROTECTED_ROLE_COLOR,
                    permissions: []
                });

                await member.roles.add(newRole);
                console.log('✅ Role created & given');
                return;
            }

            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                console.log("✅ Role auto-given");
            }

        } catch (err) {
            console.error("Initial role error:", err);
        }
    });
};
