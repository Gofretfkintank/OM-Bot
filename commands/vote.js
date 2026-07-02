const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('Start an advanced poll.')
        .addStringOption(o =>
            o.setName('question')
             .setDescription('Poll question')
             .setRequired(true)
        )
        .addStringOption(o =>
            o.setName('options')
             .setDescription('Separate with commas (A, B, C)')
             .setRequired(true)
        )
        .addNumberOption(o =>
            o.setName('duration')
             .setDescription('Duration in minutes, can be decimal')
             .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const question = interaction.options.getString('question');
        const optionsArr = [...new Set(
            interaction.options.getString('options')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
        )].slice(0, 5);

        if (optionsArr.length < 2) {
            return interaction.editReply('❌ You need at least 2 different options.');
        }

        const duration = interaction.options.getNumber('duration');
        const endTime = Date.now() + duration * 60000;
        const endTs = Math.floor(endTime / 1000);

        const votes = {};
        const userVote = {};
        optionsArr.forEach(opt => votes[opt] = []);

        const totalCount = () => Object.values(votes).reduce((a, b) => a + b.length, 0);

        const makeBar = (count) => {
            const total = totalCount();
            const percent = total === 0 ? 0 : count / total;
            const filled = Math.round(percent * 10);
            return '█'.repeat(filled) + '░'.repeat(10 - filled);
        };

        const optionFields = (winner = null) => optionsArr.map(opt => ({
            name: `${opt === winner ? '🏆' : '🔹'} ${opt}`,
            value: `\`${votes[opt].length} votes\`\n${makeBar(votes[opt].length)}`,
            inline: false
        }));

        const buildEmbed = () => {
            return new EmbedBuilder()
                .setTitle(`📊 ${question.toUpperCase()}`)
                .setColor('Blue')
                .addFields(
                    { name: '\u200B', value: '**⚠️ You only have 2 votes, don’t missclick!**', inline: false },
                    ...optionFields(),
                    { name: '\u200B', value: `⏱️ Ends <t:${endTs}:R>`, inline: false },
                    { name: '\u200B', value: `**Total votes: ${totalCount()}**`, inline: false }
                );
        };

        const buildEndEmbed = () => {
            const winner = optionsArr.reduce((a, b) => votes[a].length >= votes[b].length ? a : b);
            return new EmbedBuilder()
                .setTitle(`🏆 WINNER: ${winner}`)
                .setColor('Blue')
                .setDescription(`Poll has ended! **Total votes: ${totalCount()}**`)
                .addFields(optionFields(winner));
        };

        const row = new ActionRowBuilder().addComponents(
            optionsArr.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`v_${i}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary)
            )
        );

        const msg = await interaction.editReply({
            content: '@everyone 📢 A new poll started!',
            embeds: [buildEmbed()],
            components: [row]
        });

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: duration * 60000
        });

        collector.on('collect', async i => {
            try {
                const idx = parseInt(i.customId.split('_')[1]);
                const selected = optionsArr[idx];

                if (!userVote[i.user.id]) userVote[i.user.id] = [];

                if (userVote[i.user.id].includes(selected))
                    return await i.reply({ content: '❌ You already voted for this option.', flags: MessageFlags.Ephemeral });

                if (userVote[i.user.id].length >= 2)
                    return await i.reply({ content: '🚫 You already used your 2 votes.', flags: MessageFlags.Ephemeral });

                // Eğer 1 oy hakkı kalmışsa ve yeni oy seçiliyorsa eski oyu sil (missclick düzeltme)
                if (userVote[i.user.id].length === 1) {
                    const prev = userVote[i.user.id][0];
                    votes[prev] = votes[prev].filter(uid => uid !== i.user.id);
                }

                votes[selected].push(i.user.id);
                userVote[i.user.id].push(selected);

                await i.reply({ content: `✅ Vote registered for **${selected}** (${userVote[i.user.id].length}/2)`, flags: MessageFlags.Ephemeral });
                await msg.edit({ embeds: [buildEmbed()] });
            } catch (err) {
                console.error('[vote] collect error:', err);
            }
        });

        collector.on('end', async () => {
            try {
                await msg.edit({
                    content: null,
                    embeds: [buildEndEmbed()],
                    components: []
                });
            } catch (err) {
                console.error('[vote] end error:', err);
            }
        });
    }
};
