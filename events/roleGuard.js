module.exports = (client) => {

    const TARGET_USER_ID = "837688603739816046"; // birdnet
    const PROTECTED_ROLE_ID = "1487415507031167176"; // o rol

    client.on('guildMemberUpdate', async (oldMember, newMember) => {

        try {

            const hadRole = oldMember.roles.cache.has(PROTECTED_ROLE_ID);
            const hasRole = newMember.roles.cache.has(PROTECTED_ROLE_ID);

            // 🔒 Birdnet'ten rol alınırsa geri ver
            if (
                newMember.id === TARGET_USER_ID &&
                hadRole && !hasRole
            ) {
                await newMember.roles.add(PROTECTED_ROLE_ID);
            }

            // 🚫 Başkasına verilirse geri al
            if (
                newMember.id !== TARGET_USER_ID &&
                hasRole
            ) {
                await newMember.roles.remove(PROTECTED_ROLE_ID);
            }

        } catch (err) {
            console.error("RoleGuard error:", err);
        }
    });
};