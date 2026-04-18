// commands/dice.js
const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const Economy = require('../models/Economy');

const cooldowns = new Map();
const COOLDOWN_MS = 12_000;

function rollDice(sides = 6) {
    return Math.floor(Math.random() * sides) + 1;
}

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll dice against the house. Highest roll wins.')
        .addIntegerOption(opt =>
            opt.setName('bet')
                .setDescription('Amount of coins to bet')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(2000)
        )
        .addIntegerOption(opt =>
            opt.setName('sides')
                .setDescription('Number of sides on the dice (6 / 12 / 20 / 100)')
                .setRequired(false)
                .addChoices(
                    { name: 'D6  (default)', value: 6   },
                    { name: 'D12',           value: 12  },
                    { name: 'D20',           value: 20  },
                    { name: 'D100',          value: 100 }
                )
        ),

    async execute(interaction) {
        const userId = interaction.user.id;

        const last = cooldowns.get(userId);
        if (last && Date.now() - last < COOLDOWN_MS) {
            const left = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
            return interaction.reply({ content: `⏳ Cooldown: **${left}s** remaining.`, ephemeral: true });
        }

        const bet   = interaction.options.getInteger('bet');
        const sides = interaction.options.getInteger('sides') ?? 6;

        let wallet = await Economy.findOne({ userId });
        if (!wallet) wallet = new Economy({ userId });

        if (wallet.coins < bet) {
            return interaction.reply({
                content: `❌ Not enough coins. Balance: **${wallet.coins.toLocaleString()} 🪙**`,
                ephemeral: true
            });
        }

        cooldowns.set(userId, Date.now());
        wallet.coins -= bet;
        await wallet.save();

        // Roll animation
        const rollingEmbed = new EmbedBuilder()
            .setColor(0xf5c518)
            .setTitle(`🎲 Dice Duel — D${sides}`)
            .setDescription('`🎲 Rolling... 🎲`')
            .setFooter({ text: `Bet: ${bet.toLocaleString()} 🪙` });

        const msg = await interaction.reply({ embeds: [rollingEmbed], fetchReply: true });
        await new Promise(r => setTimeout(r, 900));

        const playerRoll = rollDice(sides);
        const houseRoll  = rollDice(sides);

        const playerFace = sides === 6 ? DICE_FACES[playerRoll] : `**${playerRoll}**`;
        const houseFace  = sides === 6 ? DICE_FACES[houseRoll]  : `**${houseRoll}**`;

        let result, payout, color;

        if (playerRoll > houseRoll) {
            payout = bet * 2;
            result = `🏆 **You win! +${payout.toLocaleString()} 🪙**`;
            color  = 0x00c851;
            const freshWallet = await Economy.findOne({ userId });
            await freshWallet.addCoins(payout);
        } else if (playerRoll === houseRoll) {
            payout = bet; // push
            result = `🤝 **Tie — bet returned. ${payout.toLocaleString()} 🪙**`;
            color  = 0xf5c518;
            const freshWallet = await Economy.findOne({ userId });
            await freshWallet.addCoins(payout);
        } else {
            payout = 0;
            result = `🏠 **House wins. -${bet.toLocaleString()} 🪙**`;
            color  = 0xff4444;
        }

        const resultEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle(`🎲 Dice Duel — D${sides}`)
            .addFields(
                { name: `${interaction.user.username}`, value: `${playerFace} **${playerRoll}**`, inline: true },
                { name: 'vs', value: '⚡', inline: true },
                { name: 'House', value: `${houseFace} **${houseRoll}**`, inline: true }
            )
            .setDescription(result)
            .setFooter({ text: 'OM Casino' });

        await msg.edit({ embeds: [resultEmbed] });
    }
};
