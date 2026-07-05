const { REACTION_ROLE_CHANNEL_ID, REACTION_ROLES } = require('../data/reactionRoles');

// emoji ID → role ID hızlı erişim için Map
const ROLE_BY_EMOJI = new Map(REACTION_ROLES.map(r => [r.emojiId, r.roleId]));

module.exports = (client) => {

    // Ortak filtre + fetch mantığı: kanal/emoji eşleşmiyorsa null döner.
    async function resolve(reaction, user) {
        if (reaction.message.channelId !== REACTION_ROLE_CHANNEL_ID) return null;

        if (reaction.partial) await reaction.fetch().catch(() => null);
        if (user.partial) await user.fetch().catch(() => null);
        if (user.bot) return null;

        const emojiId = reaction.emoji?.id;
        if (!emojiId) return null;

        const roleId = ROLE_BY_EMOJI.get(emojiId);
        if (!roleId) return null;

        const guild = reaction.message.guild;
        if (!guild) return null;

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return null;

        return { roleId, member };
    }

    client.on('messageReactionAdd', async (reaction, user) => {
        try {
            const ctx = await resolve(reaction, user);
            if (!ctx) return;
            const { roleId, member } = ctx;

            // Exclusive: aynı anda sadece 1 lig rolü. Başka bir lig rolü varsa
            // bu yeni reactı geri al — kullanıcı önce eskisini kaldırmak zorunda.
            const hasOther = REACTION_ROLES.some(r => r.roleId !== roleId && member.roles.cache.has(r.roleId));
            if (hasOther) {
                await reaction.users.remove(user.id).catch(e => console.error('[REACTIONROLE EXCLUSIVE]', e.message));
                return;
            }

            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(roleId, 'Reaction role: MCL league').catch(e => console.error('[REACTIONROLE ADD]', e.message));
            }
        } catch (err) {
            console.error('[REACTIONROLE ADD]', err);
        }
    });

    client.on('messageReactionRemove', async (reaction, user) => {
        try {
            const ctx = await resolve(reaction, user);
            if (!ctx) return;
            const { roleId, member } = ctx;

            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId, 'Reaction role: MCL league').catch(e => console.error('[REACTIONROLE REMOVE]', e.message));
            }
        } catch (err) {
            console.error('[REACTIONROLE REMOVE]', err);
        }
    });

};
