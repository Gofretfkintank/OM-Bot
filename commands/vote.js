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
        .addNumberOption(o => 
            o.setName('duration')
             .setDescription('Duration in minutes, can be decimal')
             .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        const question = interaction.options.getString('question');
        const optionsArr = interaction.options.getString('options')
            .split(',')
            .map(s => s.trim())
            .slice(0, 5);

        const duration = interaction.options.getNumber('duration');
        const endTime = Date.now() + duration * 60000;

        const votes = {};
        const userVote = {};
        optionsArr.forEach(opt => votes[opt] = []);

        const makeBar = (count) => {
            const total = Object.values(votes).reduce((a, b) => a + b.length, 0);
            const percent = total === 0 ? 0 : count / total;
            const filled = Math.round(percent * 10);
            return '█'.repeat(filled) + '░'.repeat(10 - filled);
        };

        const buildEmbed = (ended = false) => {
            const remainingMs = endTime - Date.now();
            const totalVotes = Object.values(votes).reduce((a, b) => a + b.length, 0);
            const minutes = Math.floor(Math.max(0, remainingMs) / 60000);
            const seconds = Math.floor((Math.max(0, remainingMs) % 60000) / 1000);

            const fields = optionsArr.map(opt => ({
                name: `🔹 ${opt}`,
                value: `\`${votes[opt].length} votes\`\n${makeBar(votes[opt].length)}`,
                inline: false
            }));

            if (!ended) {
                return new EmbedBuilder()
                    .setTitle(`📊 ${question.toUpperCase()}`)   // Soru başlığı
                    .setColor('Blue')
                    .addFields(
                        { name: '\u200B', value: '**⚠️ You only have 2 votes, don’t missclick!**', inline: false }, // Uyarı
                        ...fields,
                        { name: '\u200B', value: `⏱️ Time remaining: ${minutes}:${seconds.toString().padStart(2,'0')}`, inline: false }, // Time remaining
                        { name: '\u200B', value: `**Total votes: ${totalVotes}**`, inline: false } // Total votes
                    );
            } else {
                const winner = optionsArr.reduce((a,b)=>votes[a].length >= votes[b].length ? a:b);
                return new EmbedBuilder()
                    .setTitle(`🏆 WINNER: ${winner}`) // Winner başlığı
                    .setColor('Blue')
                    .setDescription('Poll has ended!');
            }
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
            const idx = parseInt(i.customId.split('_')[1]);
            const selected = optionsArr[idx];

            if (!userVote[i.user.id]) userVote[i.user.id] = [];

            if (userVote[i.user.id].includes(selected))
                return i.reply({ content: '❌ You already voted for this option.', ephemeral: true });

            if (userVote[i.user.id].length >= 2)
                return i.reply({ content: '🚫 You already used your 2 votes.', ephemeral: true });

            votes[selected].push(i.user.id);
            userVote[i.user.id].push(selected);

            await i.reply({ content: `✅ Vote registered for **${selected}** (${userVote[i.user.id].length}/2)`, ephemeral: true });
            await interaction.editReply({ embeds: [buildEmbed()] });
        });

        const interval = setInterval(async () => {
            if (collector.ended) return clearInterval(interval);
            await interaction.editReply({ embeds: [buildEmbed()] });
        }, 1000);

        collector.on('end', async () => {
            clearInterval(interval);

            const winner = optionsArr.reduce((a,b) => votes[a].length >= votes[b].length ? a : b);

            const resultEmbed = new EmbedBuilder()
                .setTitle(`🏆 WINNER: ${winner}`)
                .setColor('Blue')
                .setDescription('Poll has ended!');

            await interaction.editReply({
                content: null,
                embeds: [resultEmbed],
                components: []
            });
        });
    }
};