import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and response time');

export async function execute(interaction) {
    const response = await interaction.reply({
        content: 'Pinging...',
        withResponse: true
    });

    const sent = response.resource.message;
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;

    await interaction.editReply(
        `Pong!\n` +
        `Roundtrip latency: ${roundtrip}ms\n` +
        `WebSocket latency: ${wsLatency}ms`
    );
}
