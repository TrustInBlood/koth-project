import dotenvFlow from 'dotenv-flow';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// Load environment variables from .env files
// dotenv-flow will load .env, .env.local, .env.[NODE_ENV], .env.[NODE_ENV].local
dotenvFlow.config({
    path: rootDir,
    silent: true
});

/**
 * Centralized environment detection utility
 * All files should use this instead of checking process.env.NODE_ENV directly
 */

const nodeEnv = process.env.NODE_ENV || 'development';

export const isDevelopment = nodeEnv === 'development';
export const isProduction = nodeEnv === 'production';
export const isTest = nodeEnv === 'test';

export const environment = nodeEnv;

/**
 * Get an environment variable with optional default value
 * @param {string} key - Environment variable name
 * @param {string} [defaultValue] - Default value if not set
 * @returns {string|undefined}
 */
export function getEnv(key, defaultValue = undefined) {
    return process.env[key] ?? defaultValue;
}

/**
 * Get a required environment variable, throws if not set
 * @param {string} key - Environment variable name
 * @returns {string}
 * @throws {Error} If the environment variable is not set
 */
export function requireEnv(key) {
    const value = process.env[key];
    if (value === undefined || value === '') {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
}

/**
 * Get an environment variable as an integer
 * @param {string} key - Environment variable name
 * @param {number} [defaultValue] - Default value if not set
 * @returns {number}
 */
export function getEnvInt(key, defaultValue = 0) {
    const value = process.env[key];
    if (value === undefined || value === '') {
        return defaultValue;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get an environment variable as a boolean
 * @param {string} key - Environment variable name
 * @param {boolean} [defaultValue] - Default value if not set
 * @returns {boolean}
 */
export function getEnvBool(key, defaultValue = false) {
    const value = process.env[key];
    if (value === undefined || value === '') {
        return defaultValue;
    }
    return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Validate that all required environment variables are set
 * @param {string[]} keys - Array of required environment variable names
 * @throws {Error} If any required variables are missing
 */
export function validateRequiredEnv(keys) {
    const missing = keys.filter(key => {
        const value = process.env[key];
        return value === undefined || value === '';
    });

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

export default {
    isDevelopment,
    isProduction,
    isTest,
    environment,
    getEnv,
    requireEnv,
    getEnvInt,
    getEnvBool,
    validateRequiredEnv
};
