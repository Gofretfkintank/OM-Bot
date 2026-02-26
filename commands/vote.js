const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vote')
        .setDescription('📊 Start an advanced poll.')
        .addStringOption(o => o.setName('question').setDescription('Use # for header style').setRequired(true))
        .addStringOption(o => o.setName('options').setDescription('Separate options with commas (Option 1, Option 2)').setRequired(true))
        .addIntegerOption(o => o.setName('duration').setDescription('Time in minutes').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();
        const question = interaction.options.getString('question');
        const optionsArr = interaction.options.getString('options').split(',').map(s => s.trim()).slice(0, 5);
        const duration = interaction.options.getInteger('duration');

        const votes = {}; 
        optionsArr.forEach(opt => votes[opt] = []);
        const userCount = {}; 

        const buildEmbed = () => {
            const fields = optionsArr.map(opt => ({
                name: `🔹 ${opt}`,
                value: `**Votes:** \`${votes[opt].length}\``,
                inline: true
            }));
            return new EmbedBuilder()
                .setTitle(`# ${question}`)
                .setDescription(`⚠️ **Attention:** Everyone has **2 voting rights**. Choose wisely!\n⏱️ **Ends in:** ${duration} minutes`)
                .addFields(fields)
                .setColor('Blue')
                .setFooter({ text: 'Poll Active 🗳️' });
        };

        const rows = new ActionRowBuilder().addComponents(
            optionsArr.map((opt, i) => new ButtonBuilder().setCustomId(`v_${i}`).setLabel(opt).setStyle(ButtonStyle.Primary))
        );

        const msg = await interaction.editReply({ embeds: [buildEmbed()], components: [rows] });
        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: duration * 60000 });

        collector.on('collect', async i => {
            const idx = parseInt(i.customId.split('_')[1]);
            const selected = optionsArr[idx];
            if (!userCount[i.user.id]) userCount[i.user.id] = 0;
            if (userCount[i.user.id] >= 2) return i.reply({ content: '🚫 You already used your **2 votes**!', ephemeral: true });
            if (votes[selected].includes(i.user.id)) return i.reply({ content: '❌ Already voted for this!', ephemeral: true });

            votes[selected].push(i.user.id);
            userCount[i.user.id]++;
            await i.reply({ content: `✅ Voted for **${selected}**! (${userCount[i.user.id]}/2)`, ephemeral: true });
            await interaction.editReply({ embeds: [buildEmbed()] });
        });

        collector.on('end', async () => {
            const resultEmbed = new EmbedBuilder().setTitle(`# 🏁 Final Results: ${question}`).setColor('Gold');
            let report = "";
            optionsArr.forEach(opt => {
                const names = votes[opt].map(id => `<@${id}>`).join(', ') || 'No votes';
                report += `**${opt}:** \`${votes[opt].length}\` votes\n└ Voters: ${names}\n\n`;
            });
            resultEmbed.setDescription(report);
            await interaction.editReply({ embeds: [resultEmbed], components: [] });
        });
    }
};
