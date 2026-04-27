const { EmbedBuilder } = require('discord.js');

const BANNER_URL = 'https://cdn.discordapp.com/attachments/1486039954625790113/1498294574257279016/OMMr.png?ex=69f0a30f&is=69ef518f&hm=bc22ecc29576a6e207d21d53fe206cddd2a164d24759f0173e69fddeedb5b568&';
const LOGO_URL   = 'https://cdn.discordapp.com/attachments/1486039954625790113/1498294579340771338/Untitled37_20251212225943-1.png?ex=69f0a310&is=69ef5190&hm=58b6c47cd41b0fae4a82aba820ec396dd219c0ddeb7ddfb7fc67f49122d101c8&';

module.exports = (client) => {
    const ALLOWED_GUILDS = [
        process.env.GUILD_ID_1,
        process.env.GUILD_ID_2
    ].filter(Boolean);

    client.on('guildMemberAdd', async member => {
        if (!ALLOWED_GUILDS.includes(member.guild.id)) return;

        const embed = new EmbedBuilder()
            .setColor('#1a1a1a')
            .setTitle('🏁 Welcome to Olzhasstik Motorsports!')
            .setDescription(
                `Hey **${member.user.username}**, glad to have you on the grid! 🎉\n\n` +
                `Before you hit the track, take a moment to read through the channels below.`
            )
            .addFields(
                {
                    name: '📋 Rules',
                    value:
                        '<#1447147256347365537> — Server Rules\n' +
                        '<#1447147377394843719> — Driver Rules\n' +
                        '<#1447147511574822972> — Safety Car Rules',
                    inline: false
                },
                {
                    name: '🎭 Self Roles',
                    value: '<#1452713858027487384> — Pick your roles here',
                    inline: false
                },
                {
                    name: '❓ FAQ',
                    value: '<#1489488289533526178> — Got questions? Start here',
                    inline: false
                },
                {
                    name: '🏎️ Ready to race?',
                    value: 'Use `/register` in the server to enter the league database!',
                    inline: false
                }
            )
            .setThumbnail(LOGO_URL)
            .setImage(BANNER_URL)
            .setFooter({ text: 'Olzhasstik Motorsports • Racing League' })
            .setTimestamp();

        try {
            await member.user.send({ embeds: [embed] });
            console.log(`[WELCOME DM] ✅ Sent to ${member.user.tag}`);
        } catch (err) {
            // User has DMs disabled — fail silently
            console.warn(`[WELCOME DM] ⚠️ Could not DM ${member.user.tag}: ${err.message}`);
        }
    });
};
