import { requireEnv, getEnv, getEnvInt, isDevelopment, isProduction } from '../src/utils/environment.js';

/**
 * Main configuration loader with validation
 * Centralizes all configuration access and validates required values
 */

/**
 * Validate configuration on load
 * Throws if required values are missing
 */
function validateConfig() {
    const required = [
        'DISCORD_TOKEN',
        'DISCORD_CLIENT_ID',
        'DISCORD_GUILD_ID',
        'DB_HOST',
        'DB_NAME',
        'DB_USER',
        'DB_PASSWORD',
        'SESSION_SECRET'
    ];

    const missing = required.filter(key => !getEnv(key));

    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
}

/**
 * Discord configuration
 */
export const discord = {
    token: getEnv('DISCORD_TOKEN'),
    clientId: getEnv('DISCORD_CLIENT_ID'),
    clientSecret: getEnv('DISCORD_CLIENT_SECRET'),
    guildId: getEnv('DISCORD_GUILD_ID'),
    // OAuth2 callback URL for dashboard authentication
    callbackUrl: getEnv('DISCORD_CALLBACK_URL', 'http://localhost:3000/auth/discord/callback')
};

/**
 * Database configuration
 */
export const database = {
    host: getEnv('DB_HOST', 'localhost'),
    port: getEnvInt('DB_PORT', 3306),
    name: getEnv('DB_NAME', 'koth'),
    user: getEnv('DB_USER'),
    password: getEnv('DB_PASSWORD'),
    // Connection pool settings
    pool: {
        min: getEnvInt('DB_POOL_MIN', 2),
        max: getEnvInt('DB_POOL_MAX', 10),
        acquire: getEnvInt('DB_POOL_ACQUIRE', 30000),
        idle: getEnvInt('DB_POOL_IDLE', 10000)
    }
};

/**
 * HTTP server configuration
 */
export const http = {
    port: getEnvInt('HTTP_PORT', 3000),
    // CORS origins for dashboard
    corsOrigins: getEnv('CORS_ORIGINS', 'http://localhost:5173').split(','),
    // Session configuration
    session: {
        secret: getEnv('SESSION_SECRET'),
        maxAge: getEnvInt('SESSION_MAX_AGE', 86400000) // 24 hours default
    }
};

/**
 * Logging configuration
 */
export const logging = {
    level: getEnv('LOG_LEVEL', isDevelopment ? 'debug' : 'info')
};

/**
 * Game server connections configuration
 * KOTH Bot connects TO game servers (reversed architecture)
 *
 * Format in .env: GAME_SERVERS=url1|token1,url2|token2
 * Example: GAME_SERVERS=ws://gameserver1:3001|secret123,ws://gameserver2:3001|secret456
 */
export const gameServers = {
    // Parse comma-separated server list from env
    servers: (getEnv('GAME_SERVERS', '') || '')
        .split(',')
        .filter(s => s.trim())
        .map(entry => {
            const [url, token] = entry.trim().split('|');
            return { url: url?.trim(), token: token?.trim() };
        })
        .filter(s => s.url && s.token),
    // Reconnection settings
    reconnectAttempts: getEnvInt('GAME_SERVER_RECONNECT_ATTEMPTS', -1), // -1 for infinite
    reconnectDelay: getEnvInt('GAME_SERVER_RECONNECT_DELAY', 1000),
    reconnectDelayMax: getEnvInt('GAME_SERVER_RECONNECT_DELAY_MAX', 30000),
    // Connection timeout
    timeout: getEnvInt('GAME_SERVER_TIMEOUT', 10000)
};

/**
 * Application metadata
 */
export const app = {
    name: getEnv('APP_NAME', 'KOTH Bot'),
    version: getEnv('APP_VERSION', '1.0.0'),
    isDevelopment,
    isProduction
};

/**
 * Get the full configuration object
 * Validates required values before returning
 */
export function getConfig() {
    validateConfig();

    return {
        discord,
        database,
        http,
        logging,
        gameServers,
        app
    };
}

/**
 * Validate configuration without returning it
 * Useful for startup checks
 */
export function validate() {
    validateConfig();
    return true;
}

export default {
    discord,
    database,
    http,
    logging,
    gameServers,
    app,
    getConfig,
    validate
};
