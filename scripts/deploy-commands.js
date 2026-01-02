import '../src/utils/environment.js';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { discord as discordConfig } from '../config/config.js';
import { createServiceLogger } from '../src/utils/logger.js';
import { isDevelopment } from '../src/utils/environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createServiceLogger('DeployCommands');

async function deployCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, '../src/commands');
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    logger.info(`Loading ${commandFiles.length} command(s) for deployment...`);

    for (const file of commandFiles) {
        try {
            const filePath = path.join(commandsPath, file);
            const command = await import(`file://${filePath}`);

            if ('data' in command) {
                commands.push(command.data.toJSON());
                logger.debug(`Loaded: ${command.data.name}`);
            } else {
                logger.warn(`Command ${file} is missing "data" export`);
            }
        } catch (error) {
            logger.error(`Failed to load ${file}:`, error.message);
        }
    }

    if (commands.length === 0) {
        logger.warn('No commands to deploy');
        return;
    }

    const rest = new REST().setToken(discordConfig.token);

    try {
        logger.info(`Deploying ${commands.length} command(s)...`);

        if (isDevelopment) {
            // Development: Deploy to specific guild (instant)
            logger.info(`Deploying to guild: ${discordConfig.guildId}`);
            const data = await rest.put(
                Routes.applicationGuildCommands(discordConfig.clientId, discordConfig.guildId),
                { body: commands }
            );
            logger.info(`Successfully deployed ${data.length} command(s) to guild`);
        } else {
            // Production: Deploy globally (can take up to 1 hour to propagate)
            logger.info('Deploying globally...');
            const data = await rest.put(
                Routes.applicationCommands(discordConfig.clientId),
                { body: commands }
            );
            logger.info(`Successfully deployed ${data.length} command(s) globally`);
        }
    } catch (error) {
        logger.error('Failed to deploy commands:', error.message);
        process.exit(1);
    }
}

deployCommands();
