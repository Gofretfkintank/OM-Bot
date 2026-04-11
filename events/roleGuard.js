module.exports = (client) => {

    const TARGET_USER_ID = "837688603739816046";
    const PROTECTED_ROLE_NAME = "KORUNAN_ROL"; 
    const PROTECTED_ROLE_COLOR = 0x633d13;

    let activeRoleId = null;

    //--------------------------------
    // STARTUP: Rolü hazırla ve sahibine ver
    //--------------------------------
    client.on('ready', async () => {
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

            // Başkalarından al
            const allMembers = await guild.members.fetch();
            const unauthorized = allMembers.filter(m => m.roles.cache.has(activeRoleId) && m.id !== TARGET_USER_ID);
            for (const [id, m] of unauthorized) {
                await m.roles.remove(activeRoleId);
            }

            console.log("🟢 RoleGuard: Rol koruması aktif");
        } catch (err) {
            console.error("RoleGuard Startup Error:", err);
        }
    });

    //--------------------------------
    // ROLE UPDATE
    //--------------------------------
    client.on('roleUpdate', async (oldRole, newRole) => {
        if (!activeRoleId || newRole.id !== activeRoleId) return;

        const needUpdate = (newRole.name !== PROTECTED_ROLE_NAME || newRole.color !== PROTECTED_ROLE_COLOR);
        if (needUpdate) {
            await newRole.edit({
                name: PROTECTED_ROLE_NAME,
                color: PROTECTED_ROLE_COLOR
            });
            console.log(`⚠️ RoleGuard: Rol özellikleri düzeltildi`);
        }
    });

    //--------------------------------
    // MEMBER UPDATE (Rol Koruması + Sadece Hedef Kişiye Özel İsim Kilidi)
    //--------------------------------
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        
        // --- 1. ROL KORUMASI ---
        if (activeRoleId) {
            const hasRole = newMember.roles.cache.has(activeRoleId);
            const hadRole = oldMember.roles.cache.has(activeRoleId);

            // Başkasına verilirse al
            if (newMember.id !== TARGET_USER_ID && hasRole) {
                await newMember.roles.remove(activeRoleId);
            }

            // Sahibinden alınırsa geri ver
            if (newMember.id === TARGET_USER_ID && hadRole && !hasRole) {
                await newMember.roles.add(activeRoleId);
            }
        }

        // --- 2. BİRD'ÜN İSMİNİ KİLİTLEME ---
        // Eğer güncellenen kişi hedef ID ise ve ismi (nickname) değiştiyse
        if (newMember.id === TARGET_USER_ID) {
            if (oldMember.nickname !== newMember.nickname) {
                try {
                    // İşlemi anında iptal edip bir önceki ismine geri döndürüyoruz
                    await newMember.setNickname(oldMember.nickname, "RoleGuard: Bu kullanıcının ismi kilitlidir.");
                    console.log(`🛡️ RoleGuard: ${newMember.user.tag} isimli kullanıcının adı değiştirilmeye çalışıldı. Engel olundu.`);
                } catch (err) {
                    console.error("RoleGuard İsim Kilidi Hatası (Botun yetkisi altta kalıyor olabilir):", err);
                }
            }
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

            console.log(`✅ RoleGuard: Rol tekrar oluşturuldu`);
        } catch (err) {
            console.error("RoleGuard RoleDelete Error:", err);
        }
    });

};
