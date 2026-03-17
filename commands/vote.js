const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
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
        .addIntegerOption(o => 
            o.setName('duration')
             .setDescription('Duration in minutes')
             .setRequired(true)
        ),

    async execute(interaction) {

        await interaction.deferReply();

        const question = interaction.options.getString('question');
        const rawOptions = interaction.options.getString('options');

        const optionsArr = rawOptions.split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (optionsArr.length < 2)
            return interaction.editReply('❌ You need at least 2 options.');

        if (optionsArr.length > 5)
            return interaction.editReply('❌ Maximum 5 options allowed.');

        const duration = interaction.options.getInteger('duration');
        const endTime = Date.now() + duration * 60000;

        const votes = {};
        const userVotes = {};

        optionsArr.forEach(opt => votes[opt] = []);

        const makeBar = (count) => {
            const total = Object.values(votes).reduce((a, b) => a + b.length, 0);
            const percent = total === 0 ? 0 : count / total;
            const filled = Math.round(percent * 10);
            return '█'.repeat(filled) + '░'.repeat(10 - filled);
        };

        const buildEmbed = (ended = false) => {

            const remainingMs = endTime - Date.now();
            const remainingMin = Math.max(0, Math.floor(remainingMs / 60000));
            const total = Object.values(votes).reduce((a, b) => a + b.length, 0);

            const fields = optionsArr.map(opt => ({
                name: `🔹 ${opt}`,
                value: `🗳️ \`${votes[opt].length}\`\n${makeBar(votes[opt].length)}`,
                inline: false
            }));

            return new EmbedBuilder()
                .setTitle(`📊 ${question}`)
                .setColor(ended ? 'Gold' : 'Blue')
                .addFields(fields)
                .setFooter({ 
                    text: ended 
                        ? `Ended • Total votes: ${total}` 
                        : `⏱️ Time left: ${remainingMin} min • Total: ${total}`
                })
                .setDescription(
                    ended 
                    ? '📌 Poll finished.'
                    : '⚠️ Each user has **2 votes**.\nYou can change your vote by clicking again.'
                );
        };

        const row = new ActionRowBuilder().addComponents(
            optionsArr.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`v_${i}`)
                    .setLabel(opt)
                    .setStyle(
                        i === 0 ? ButtonStyle.Success :
                        i === 1 ? ButtonStyle.Danger :
                        ButtonStyle.Primary
                    )
            )
        );

        const msg = await interaction.editReply({
            content: '@everyone 📢 A new poll has started!',
            embeds: [buildEmbed()],
            components: [row]
        });

        const interval = setInterval(() => {
            interaction.editReply({
                embeds: [buildEmbed()]
            });
        }, 15000);

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: duration * 60000
        });

        collector.on('collect', async i => {

            await i.deferReply({ ephemeral: true });

            const idx = parseInt(i.customId.split('_')[1]);
            const selected = optionsArr[idx];

            if (!userVotes[i.user.id]) userVotes[i.user.id] = [];

            // toggle vote
            if (userVotes[i.user.id].includes(selected)) {
                votes[selected] = votes[selected].filter(u => u !== i.user.id);
                userVotes[i.user.id] = userVotes[i.user.id].filter(o => o !== selected);

                return i.editReply(`❌ Vote removed: **${selected}**`);
            }

            if (userVotes[i.user.id].length >= 2)
                return i.editReply('🚫 You already used your 2 votes.');

            votes[selected].push(i.user.id);
            userVotes[i.user.id].push(selected);

            await i.editReply(`✅ Vote registered: **${selected}** (${userVotes[i.user.id].length}/2)`);

            await interaction.editReply({
                embeds: [buildEmbed()]
            });
        });

        collector.on('end', async () => {

            clearInterval(interval);

            const max = Math.max(...optionsArr.map(o => votes[o].length));
            const winners = optionsArr.filter(o => votes[o].length === max);

            let title;
            if (winners.length > 1) {
                title = `🤝 Tie: ${winners.join(', ')}`;
            } else {
                title = `🏆 Winner: ${winners[0]}`;
            }

            const resultEmbed = buildEmbed(true)
                .setTitle(title);

            await interaction.editReply({
                embeds: [resultEmbed],
                components: []
            });
        });
    }
};