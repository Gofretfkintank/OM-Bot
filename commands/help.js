const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Explore all available commands by category.'),

    async execute(interaction) {
        const commands = interaction.client.commands;

        //--------------------------
        // KEYWORD MAPPER (Kategori Eşleştirme)
        //--------------------------
        const categories = {
            '🏁 Racing & League': [],
            '🛠️ Moderation': [],
            '⚙️ System & Utility': [],
            '📊 Stats & Votes': []
        };

        // Komut adlarına göre otomatik dağıtım mantığı
        commands.forEach((cmd) => {
            const name = cmd.data.name;
            const desc = cmd.data.description || 'No description provided.';
            const line = `**/${name}** - ${desc}`;

            // Yarış Komutları
            if (['race-delay', 'race-set', 'racetime', 'track', 'results', 'driversfix', 'register'].some(k => name.includes(k))) {
                categories['🏁 Racing & League'].push(line);
            }
            // Moderasyon Komutları
            else if (['ban', 'kick', 'mute', 'warn', 'role', 'channel', 'slowmode', 'jail', 'quarantina', 'clear', 'to', 'nick'].some(k => name.includes(k))) {
                categories['🛠️ Moderation'].push(line);
            }
            // İstatistik ve Oylama
            else if (['stats', 'vote', 'doty', 'vs', 'warnings'].some(k => name.includes(k))) {
                categories['📊 Stats & Votes'].push(line);
            }
            // Diğerleri (Ping, Maintenance, Report vb.)
            else {
                categories['⚙️ System & Utility'].push(line);
            }
        });

        // Boş kalan kategorileri temizle
        Object.keys(categories).forEach(key => {
            if (categories[key].length === 0) delete categories[key];
        });

        //--------------------------
        // UI COMPONENTS
        //--------------------------
        const options = Object.keys(categories).map(cat => ({
            label: cat.split(' ').slice(1).join(' '), // Emoji kısmını ayırıp sadece metni label yapıyoruz
            value: cat,
            emoji: cat.split(' ')[0], // Baştaki emojiyi alıyoruz
            description: `Show ${cat} commands.`
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Select a category to view commands...')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const mainEmbed = new EmbedBuilder()
            .setColor(0x00D2FF)
            .setTitle('Olzhasstik Motorsports | Command Center')
            .setDescription(
                "Welcome to the official **OM-Bot** command manual.\n\n" +
                "Please use the menu below to navigate through different categories. " +
                "Each section contains specialized tools for our racing league and server management."
            )
            .addFields({ name: 'Total Commands', value: `\`${commands.size}\` commands loaded`, inline: true })
            .setFooter({ text: 'Gofret is cooking 🧇' })
            .setTimestamp();

        const response = await interaction.reply({ embeds: [mainEmbed], components: [row] });

        //--------------------------
        // COLLECTOR (Menü Dinleyici)
        //--------------------------
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 120000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: "You can't change this menu. Run /help to see your own!", ephemeral: true });
            }

            const selected = i.values[0];
            const cmdList = categories[selected].join('\n');

            const categoryEmbed = new EmbedBuilder()
                .setColor(0xe67e22)
                .setTitle(`${selected} Commands`)
                .setDescription(cmdList)
                .setFooter({ text: 'Gofret is cooking 🧇' })
                .setTimestamp();

            await i.update({ embeds: [categoryEmbed] });
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(selectMenu.setDisabled(true));
            interaction.editReply({ components: [disabledRow] }).catch(() => {});
        });
    }
};
