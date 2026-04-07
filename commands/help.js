const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Explore all available commands by category.'),

    async execute(interaction) {
        const commands = interaction.client.commands;

        //--------------------------
        // KEYWORD MAPPER
        //--------------------------
        const categories = {
            '🏁 Racing & League': [],
            '🛠️ Moderation': [],
            '⚙️ System & Utility': [],
            '📊 Stats & Votes': []
        };

        commands.forEach((cmd) => {
            const name = cmd.data.name;
            const desc = cmd.data.description || 'No description provided.';
            const line = `**/${name}** - ${desc}`;

            if (['race-delay', 'race-set', 'racetime', 'track', 'results', 'driversfix', 'register'].some(k => name.includes(k))) {
                categories['🏁 Racing & League'].push(line);
            }
            else if (['ban', 'kick', 'mute', 'warn', 'role', 'channel', 'slowmode', 'jail', 'quarantina', 'clear', 'to', 'nick'].some(k => name.includes(k))) {
                categories['🛠️ Moderation'].push(line);
            }
            else if (['stats', 'vote', 'doty', 'vs', 'warnings'].some(k => name.includes(k))) {
                categories['📊 Stats & Votes'].push(line);
            }
            else {
                categories['⚙️ System & Utility'].push(line);
            }
        });

        Object.keys(categories).forEach(key => {
            if (categories[key].length === 0) delete categories[key];
        });

        //--------------------------
        // UI COMPONENTS
        //--------------------------
        const options = Object.keys(categories).map(cat => ({
            label: cat.split(' ').slice(1).join(' '), 
            value: cat,
            emoji: cat.split(' ')[0],
            description: `View commands for ${cat.split(' ').slice(1).join(' ')}.`
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Select a category...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x00D2FF)
            .setTitle('Olzhasstik Motorsports | Help Center')
            .setDescription(
                "Welcome to the official command manual. Select a category from the menu below to see the available tools for our racing league and server management."
            )
            .addFields({ name: 'System Status', value: '🟢 All systems operational', inline: true })
            .setFooter({ text: 'Olzhasstik Motorsports | System Manual' })
            .setTimestamp();

        const response = await interaction.reply({ embeds: [mainEmbed], components: [row] });

        //--------------------------
        // COLLECTOR
        //--------------------------
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 120000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: "Please use /help to open your own menu.", ephemeral: true });
            }

            const selected = i.values[0];
            const cmdList = categories[selected].join('\n');

            const categoryEmbed = new EmbedBuilder()
                .setColor(0x2f3136) // Daha koyu, profesyonel bir gri tonu
                .setTitle(`${selected}`)
                .setDescription(cmdList)
                .setFooter({ text: 'Use /command name to get more info' })
                .setTimestamp();

            await i.update({ embeds: [categoryEmbed] });
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(selectMenu.setDisabled(true));
            interaction.editReply({ components: [disabledRow] }).catch(() => {});
        });
    }
};
