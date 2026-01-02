import { EmbedBuilder } from 'discord.js';

/**
 * Discord response helper utilities
 * Provides consistent formatting for bot responses
 */

const COLORS = {
    success: 0x00FF00,
    error: 0xFF0000,
    warning: 0xFFFF00,
    info: 0x0099FF,
    primary: 0x5865F2
};

/**
 * Create a success embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @returns {EmbedBuilder}
 */
export function successEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create an error embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @returns {EmbedBuilder}
 */
export function errorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(COLORS.error)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create a warning embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @returns {EmbedBuilder}
 */
export function warningEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(COLORS.warning)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Create an info embed
 * @param {string} title - Embed title
 * @param {string} description - Embed description
 * @returns {EmbedBuilder}
 */
export function infoEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

/**
 * Reply to an interaction with an ephemeral error message
 * @param {import('discord.js').CommandInteraction} interaction - The interaction to reply to
 * @param {string} message - Error message
 */
export async function replyWithError(interaction, message) {
    const embed = errorEmbed('Error', message);

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

/**
 * Reply to an interaction with a success message
 * @param {import('discord.js').CommandInteraction} interaction - The interaction to reply to
 * @param {string} title - Success title
 * @param {string} message - Success message
 * @param {boolean} [ephemeral=false] - Whether the message should be ephemeral
 */
export async function replyWithSuccess(interaction, title, message, ephemeral = false) {
    const embed = successEmbed(title, message);

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], ephemeral });
    } else {
        await interaction.reply({ embeds: [embed], ephemeral });
    }
}

/**
 * Defer a reply and return a function to edit it later
 * @param {import('discord.js').CommandInteraction} interaction - The interaction to defer
 * @param {boolean} [ephemeral=false] - Whether the reply should be ephemeral
 * @returns {Promise<Function>} Function to edit the deferred reply
 */
export async function deferReply(interaction, ephemeral = false) {
    await interaction.deferReply({ ephemeral });

    return async (content) => {
        if (typeof content === 'string') {
            await interaction.editReply({ content });
        } else {
            await interaction.editReply(content);
        }
    };
}

export default {
    successEmbed,
    errorEmbed,
    warningEmbed,
    infoEmbed,
    replyWithError,
    replyWithSuccess,
    deferReply,
    COLORS
};
