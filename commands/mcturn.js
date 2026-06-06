const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { exec } = require('child_process');

function aternos(action) {
    return new Promise((resolve, reject) => {
        exec(`python3 aternos_control.py ${action}`, { timeout: 15000 }, (err, stdout) => {
            const out = stdout.trim();
            if (out.startsWith('ERROR')) return reject(new Error(out.replace('ERROR:', '')));
            resolve(out);
        });
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcturn')
        .setDescription('Toggle the Minecraft server on or off'),

    async execute(interaction) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
        }

        await interaction.deferReply();

        let status;
        try {
            status = await aternos('status');
        } catch (err) {
            return interaction.editReply({ embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Connection Failed')
                .setDescription(`\`${err.message}\`\nUpdate **ATERNOS_SESSION** in Railway.`)
                .setFooter({ text: 'Olzhasstik Motorsports • Minecraft' })
                .setTimestamp()]
            });
        }

        if (status === 'starting' || status === 'stopping' || status === 'loading') {
            return interaction.editReply({ embeds: [new EmbedBuilder()
                .setColor(0xF39C12)
                .setTitle(`⏳ Server is ${status}`)
                .setDescription('Wait for the current operation to finish.')
                .setFooter({ text: 'Olzhasstik Motorsports • Minecraft' })
                .setTimestamp()]
            });
        }

        const turningOn = status === 'offline';
        try {
            await aternos(turningOn ? 'start' : 'stop');
        } catch (err) {
            return interaction.editReply({ embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Action Failed')
                .setDescription(`\`${err.message}\``)
                .setFooter({ text: 'Olzhasstik Motorsports • Minecraft' })
                .setTimestamp()]
            });
        }

        return interaction.editReply({ embeds: [new EmbedBuilder()
            .setColor(turningOn ? 0x2ECC71 : 0xE74C3C)
            .setTitle(turningOn ? '🟢 Server Starting' : '🔴 Server Stopping')
            .setDescription(turningOn
                ? 'Booting up. Check <#1511995662865141810> when ready.'
                : 'Server is shutting down.')
            .addFields(
                { name: '👤 Triggered by', value: `<@${interaction.user.id}>`, inline: true },
                { name: '⏱️ Time', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Olzhasstik Motorsports • Minecraft' })
            .setTimestamp()]
        });
    }
};