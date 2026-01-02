import { Collection } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServiceLogger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createServiceLogger('CommandHandler');

/**
 * Load all commands from the commands directory
 * @param {Client} client - Discord client instance
 * @returns {Promise<Collection>} Collection of commands
 */
export async function loadCommands(client) {
    client.commands = new Collection();

    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    logger.info(`Loading ${commandFiles.length} command(s)...`);

    for (const file of commandFiles) {
        try {
            const filePath = path.join(commandsPath, file);
            const command = await import(`file://${filePath}`);

            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                logger.debug(`Loaded command: ${command.data.name}`);
            } else {
                logger.warn(`Command ${file} is missing required "data" or "execute" export`);
            }
        } catch (error) {
            logger.error(`Failed to load command ${file}:`, error.message);
        }
    }

    logger.info(`Successfully loaded ${client.commands.size} command(s)`);
    return client.commands;
}

/**
 * Handle incoming interaction commands
 * @param {Interaction} interaction - Discord interaction
 */
export async function handleCommand(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        logger.warn(`Unknown command: ${interaction.commandName}`);
        return;
    }

    try {
        logger.debug(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
        await command.execute(interaction);
    } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error.message);

        const errorMessage = {
            content: 'There was an error executing this command.',
            ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
}

/**
 * Get all command data for deployment
 * @param {Client} client - Discord client instance
 * @returns {Array} Array of command data objects
 */
export function getCommandData(client) {
    return client.commands.map(command => command.data.toJSON());
}

export default {
    loadCommands,
    handleCommand,
    getCommandData
};
