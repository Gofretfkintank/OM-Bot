const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const DotyVote = require('../models/DotyVote');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dotyvote')
        .setDescription('Start DOTY vote')
        .addUserOption(opt => opt.setName('p1').setRequired(true))
        .addUserOption(opt => opt.setName('p2'))
        .addUserOption(opt => opt.setName('p3'))
        .addUserOption(opt => opt.setName('p4'))
        .addUserOption(opt => opt.setName('p5')),

    async execute(interaction) {

        const participants = [];

        for (let i = 1; i <= 5; i++) {
            const u = interaction.options.getUser(`p${i}`);
            if (u) participants.push(u);
        }

        if (participants.length < 1) {
            return interaction.reply({ content: 'No participants.', ephemeral: true });
        }

        const row = new ActionRowBuilder();

        participants.forEach(p => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`doty_${p.id}`)
                    .setLabel(p.username)
                    .setStyle(ButtonStyle.Primary)
            );
        });

        const msg = await interaction.reply({
            content: '🗳️ DOTY Vote started! (1 hour)',
            components: [row],
            fetchReply: true
        });

        const voteData = new DotyVote({
            messageId: msg.id,
            channelId: msg.channel.id,
            guildId: msg.guild.id,
            participants: participants.map(p => p.id),
            endTime: Date.now() + (60 * 60 * 1000)
        });

        await voteData.save();
    }
};