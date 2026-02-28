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
        const optionsArr = interaction.options.getString('options')
            .split(',')
            .map(s => s.trim())
            .slice(0, 5);

        const duration = interaction.options.getInteger('duration');
        const endTime = Date.now() + duration * 60000;

        const votes = {};
        const userCount = {};

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

            const fields = optionsArr.map(opt => ({
                name: `🔹 ${opt}`,
                value: `\`${votes[opt].length} votes\`\n${makeBar(votes[opt].length)}`,
                inline: false
            }));

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${question.toUpperCase()}`)
                .setColor(ended ? 'Gold' : 'Blue')
                .addFields(fields)
                .setFooter({ 
                    text: ended 
                        ? 'Poll Ended' 
                        : `⏱️ Time remaining: ${remainingMin} minute(s)`
                });

            if (!ended) {
                embed.setDescription(
`⚠️ **WARNING**
Each user has exactly **2 VOTES**.
Choose wisely.`
                );
            }

            return embed;
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
            embeds: [buildEmbed()],
            components: [row]
        });

        const collector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: duration * 60000
        });

        collector.on('collect', async i => {

            const idx = parseInt(i.customId.split('_')[1]);
            const selected = optionsArr[idx];

            if (!userCount[i.user.id]) userCount[i.user.id] = 0;

            if (userCount[i.user.id] >= 2)
                return i.reply({
                    content: '🚫 You already used your 2 votes.',
                    ephemeral: true
                });

            if (votes[selected].includes(i.user.id))
                return i.reply({
                    content: '❌ You already voted for this option.',
                    ephemeral: true
                });

            votes[selected].push(i.user.id);
            userCount[i.user.id]++;

            await i.reply({
                content: `✅ Vote registered for **${selected}** (${userCount[i.user.id]}/2)`,
                ephemeral: true
            });

            await interaction.editReply({
                embeds: [buildEmbed()]
            });
        });

        collector.on('end', async () => {

            const winner = optionsArr.reduce((a, b) =>
                votes[a].length >= votes[b].length ? a : b
            );

            const resultEmbed = buildEmbed(true)
                .setTitle(`🏆 WINNER: ${winner}`)
                .setDescription(null);

            await interaction.editReply({
                embeds: [resultEmbed],
                components: []
            });
        });
    }
};