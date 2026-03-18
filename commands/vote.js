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
            .filter(s => s.length > 0);

        if (optionsArr.length < 2)
            return interaction.editReply('❌ At least 2 options required.');

        if (optionsArr.length > 5)
            return interaction.editReply('❌ Max 5 options.');

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

            const total = Object.values(votes).reduce((a, b) => a + b.length, 0);

            const fields = optionsArr.map(opt => ({
                name: `🔹 ${opt}`,
                value: `🗳️ \`${votes[opt].length}\`\n${makeBar(votes[opt].length)}`,
                inline: false
            }));

            return new EmbedBuilder()
                .setTitle(`📊 ${question}`)
                .setColor('Blue')
                .addFields(fields)
                .setFooter({ 
                    text: ended 
                        ? `Ended • Total votes: ${total}` 
                        : `Total votes: ${total}`
                })
                .setDescription(
                    ended 
                    ? '📌 Poll finished.'
                    : `⏱️ Ends <t:${Math.floor(endTime/1000)}:R>\n⚠️ You have 2 votes. Click again to remove.`
                );
        };

        const row = new ActionRowBuilder().addComponents(
            optionsArr.map((opt, i) =>
                new ButtonBuilder()
                    .setCustomId(`v_${i}`)
                    .setLabel(opt)
                    .setStyle(ButtonStyle.Primary) // hepsi mavi
            )
        );

        const msg = await interaction.editReply({
            content: '@everyone 📢 New poll started!',
            embeds: [buildEmbed()],
            components: [row]
        });

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

                return i.editReply(`❌ Removed vote: **${selected}**`);
            }

            if (userVotes[i.user.id].length >= 2)
                return i.editReply('🚫 You used your 2 votes.');

            votes[selected].push(i.user.id);
            userVotes[i.user.id].push(selected);

            await i.editReply(`✅ Voted: **${selected}** (${userVotes[i.user.id].length}/2)`);

            await interaction.editReply({
                embeds: [buildEmbed()]
            });
        });

        collector.on('end', async () => {

            const max = Math.max(...optionsArr.map(o => votes[o].length));
            const winners = optionsArr.filter(o => votes[o].length === max);

            const title = winners.length > 1
                ? `🤝 Tie: ${winners.join(', ')}`
                : `🏆 Winner: ${winners[0]}`;

            const resultEmbed = buildEmbed(true)
                .setTitle(title);

            await interaction.editReply({
                embeds: [resultEmbed],
                components: []
            });
        });
    }
};