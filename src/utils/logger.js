import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { isDevelopment, getEnv } from './environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.resolve(__dirname, '../../logs');

const LOG_LEVEL = getEnv('LOG_LEVEL', isDevelopment ? 'debug' : 'info');

/**
 * Custom format for console output
 * Format: [HH:mm:ss] level: [service] message
 */
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const serviceTag = service ? `[${service}] ` : '';
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level}: ${serviceTag}${message}${metaStr}`;
    })
);

/**
 * Custom format for file output (no colors)
 */
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const serviceTag = service ? `[${service}] ` : '';
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level}: ${serviceTag}${message}${metaStr}`;
    })
);

/**
 * Create the base logger instance
 */
const baseLogger = winston.createLogger({
    level: LOG_LEVEL,
    transports: [
        // Console transport - always enabled
        new winston.transports.Console({
            format: consoleFormat
        }),
        // Combined log file
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

/**
 * Create a child logger for a specific service
 * @param {string} serviceName - Name of the service for log categorization
 * @returns {winston.Logger} Logger instance with service metadata
 */
export function createServiceLogger(serviceName) {
    return baseLogger.child({ service: serviceName });
}

/**
 * Console replacement object that uses the logger
 * Use this to replace console.log calls throughout the application
 */
export const console = {
    log: (...args) => baseLogger.info(args.map(String).join(' ')),
    info: (...args) => baseLogger.info(args.map(String).join(' ')),
    warn: (...args) => baseLogger.warn(args.map(String).join(' ')),
    error: (...args) => baseLogger.error(args.map(String).join(' ')),
    debug: (...args) => baseLogger.debug(args.map(String).join(' ')),
    verbose: (...args) => baseLogger.verbose(args.map(String).join(' '))
};

/**
 * Default logger export for general use
 */
export default baseLogger;
