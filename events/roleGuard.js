module.exports = (client) => {

    const TARGET_USER_ID = "837688603739816046";
    const PROTECTED_ROLE_ID = "1487415507031167176";

    // --------------------------
    // ROL DEĞİŞİM KONTROLÜ
    // --------------------------
    client.on('guildMemberUpdate', async (oldMember, newMember) => {

        try {
            const hadRole = oldMember.roles.cache.has(PROTECTED_ROLE_ID);
            const hasRole = newMember.roles.cache.has(PROTECTED_ROLE_ID);

            // 🔒 Birdnet'ten rol alınırsa geri ver
            if (newMember.id === TARGET_USER_ID && hadRole && !hasRole) {
                await newMember.roles.add(PROTECTED_ROLE_ID);
            }

            // 🚫 Başkasına verilirse kaldır
            if (newMember.id !== TARGET_USER_ID && hasRole) {
                await newMember.roles.remove(PROTECTED_ROLE_ID);
            }

        } catch (err) {
            console.error("RoleGuard error:", err);
        }
    });

    // --------------------------
    // BOT AÇILINCA KONTROL
    // --------------------------
    client.once('ready', async () => {

        try {
            const guild = client.guilds.cache.first(); // tek server varsa ok

            const member = await guild.members.fetch(TARGET_USER_ID);

            if (!member.roles.cache.has(PROTECTED_ROLE_ID)) {
                await member.roles.add(PROTECTED_ROLE_ID);
                console.log("✅ Role auto-given");
            }

        } catch (err) {
            console.error("Initial role error:", err);
        }
    });
};