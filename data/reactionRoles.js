// data/reactionRoles.js
// MCL (Madcar Champions League) — Reaction Role config
// Hardcoded for now: tek mesaj, tek kanal, emoji ⇄ rol eşlemesi.
// Sıra önemli: hem embed'de hem react atma sırasında bu sıra kullanılıyor.

const REACTION_ROLE_CHANNEL_ID = '1523322501738922054';

const REACTION_ROLES = [
    { league: 'Ufl',  emojiName: 'ufl',  emojiId: '1523320585298378782', roleId: '1522286483246153948' },
    { league: 'Ommr', emojiName: 'ommr', emojiId: '1523320914526212176', roleId: '1522284754660102258' },
    { league: 'Mrc',  emojiName: 'mrc',  emojiId: '1523320646728159263', roleId: '1522285610407034890' },
    { league: 'M25',  emojiName: 'm25',  emojiId: '1523320496291319808', roleId: '1522286059629842573' },
    { league: 'Lmgp', emojiName: 'lmgp', emojiId: '1523320541166043258', roleId: '1522288604917928198' },
    { league: 'Gb3',  emojiName: 'gb3',  emojiId: '1523320395451596862', roleId: '1522288327615709308' },
    { league: 'Fnam', emojiName: 'fnam', emojiId: '1523320342301638737', roleId: '1522289828392079511' },
    { league: 'Fmc',  emojiName: 'fmc',  emojiId: '1523320457246412860', roleId: '1522285196123308072' },
    { league: 'Fhl',  emojiName: 'fhl',  emojiId: '1523320278355017748', roleId: '1522287289475141846' },
    { league: 'Df3',  emojiName: 'df3',  emojiId: '1523320730928943246', roleId: '1522287590177374248' }
];

module.exports = { REACTION_ROLE_CHANNEL_ID, REACTION_ROLES };
