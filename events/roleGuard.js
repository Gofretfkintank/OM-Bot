module.exports = (client) => {

    const TARGET_USER_ID = "837688603739816046";
    // Güvenlik kuralları gereği orijinal rol adı kaldırılmıştır, kendi rol adınızı buraya geri yazın:
    const PROTECTED_ROLE_NAME = "THE NIGGEREST NIGGER OFF ALL TIME"; 
    const PROTECTED_ROLE_COLOR = 0x633d13;

    let activeRoleId = null; // Cache ve fetch sorununu kökten çözen ID takip değişkeni

    //--------------------------
    // ROL DEĞİŞİM KONTROLÜ
    //--------------------------

    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (!activeRoleId) return; // Henüz rol oluşturulmadıysa/bulunmadıysa işlem yapma

        try {
            // API'yi zorlamak yerine direkt hafızadaki ID ile hızlı kontrol
            const hadRole = oldMember.roles.cache.has(activeRoleId);
            const hasRole = newMember.roles.cache.has(activeRoleId);

            // 1. 🚫 Başkasına verilirse kaldır (Sorununuzun çözümü)
            if (newMember.id !== TARGET_USER_ID && hasRole) {
                await newMember.roles.remove(activeRoleId);
                console.log(`🚫 Rol başkasından alındı: ${newMember.user.tag}`);
            }

            // 2. 🔒 Birdnet'ten rol alınırsa geri ver
            if (newMember.id === TARGET_USER_ID && hadRole && !hasRole) {
                // Eğer rol Discord'dan tamamen silindiği için bu event tetiklendiyse, 
                // "10011 Unknown Role" hatası yememek için rolün hala var olup olmadığına bakarız:
                if (newMember.guild.roles.cache.has(activeRoleId)) {
                    await newMember.roles.add(activeRoleId);
                    console.log(`🔒 Rol hedefe geri verildi.`);
                }
            }

        } catch (err) {
            console.error("RoleGuard update error:", err);
        }
    });

    //--------------------------
    // ROL SİLİNİRSE YENİDEN OLUŞTUR
    //--------------------------

    client.on('roleDelete', async (role) => {
        // Sadece koruduğumuz rol silindiyse çalış
        if (role.name !== PROTECTED_ROLE_NAME && role.id !== activeRoleId) return;

        try {
            const guild = role.guild;

            const newRole = await guild.roles.create({
                name: PROTECTED_ROLE_NAME,
                color: PROTECTED_ROLE_COLOR,
                permissions: role.permissions,
                hoist: role.hoist,
                mentionable: role.mentionable
            });

            // Yeni oluşan rolün ID'sini hafızaya alıyoruz. Cache gecikmesi sorunu bitti!
            activeRoleId = newRole.id; 

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

    // Loglardaki hatayı çözmek için 'ready' yerine 'clientReady' kullanıldı
    client.once('clientReady', async () => { 
        try {
            const guild = client.guilds.cache.first();
            const member = await guild.members.fetch(TARGET_USER_ID);
            const role = guild.roles.cache.find(r => r.name === PROTECTED_ROLE_NAME);

            if (!role) {
                console.log('⚠️ Protected role bulunamadı, oluşturuluyor...');

                const newRole = await guild.roles.create({
                    name: PROTECTED_ROLE_NAME,
                    color: PROTECTED_ROLE_COLOR,
                    permissions: []
                });

                activeRoleId = newRole.id; // Oluşturduğumuz rolün ID'sini kaydediyoruz
                await member.roles.add(newRole);
                console.log('✅ Role created & given');
                return;
            }

            activeRoleId = role.id; // Bulunan rolün ID'sini kaydediyoruz

            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                console.log("✅ Role auto-given");
            }

        } catch (err) {
            console.error("Initial role error:", err);
        }
    });
};
