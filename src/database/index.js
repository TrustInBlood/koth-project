import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import path from 'path';
import { fileURLToPath } from 'url';
import { database as dbConfig } from '../../config/config.js';
import { createServiceLogger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createServiceLogger('Database');

/**
 * DatabaseManager Singleton
 * Handles database connection, pooling, health checks, and migrations
 */
class DatabaseManager {
    constructor() {
        this.sequelize = null;
        this.umzug = null;
        this.isConnected = false;
        this.models = {};
    }

    /**
     * Initialize the database connection
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.sequelize) {
            logger.warn('Database already initialized');
            return;
        }

        logger.info('Initializing database connection...');

        this.sequelize = new Sequelize(
            dbConfig.name,
            dbConfig.user,
            dbConfig.password,
            {
                host: dbConfig.host,
                port: dbConfig.port,
                dialect: 'mariadb',
                logging: (msg) => logger.debug(msg),
                pool: {
                    min: dbConfig.pool.min,
                    max: dbConfig.pool.max,
                    acquire: dbConfig.pool.acquire,
                    idle: dbConfig.pool.idle
                },
                define: {
                    timestamps: true,
                    underscored: true
                }
            }
        );

        // Initialize Umzug for migrations
        this.umzug = new Umzug({
            migrations: {
                glob: path.join(__dirname, '../../migrations/*.js'),
                resolve: ({ name, path: migrationPath, context }) => {
                    return {
                        name,
                        up: async () => {
                            const migration = await import(migrationPath);
                            return migration.up(context);
                        },
                        down: async () => {
                            const migration = await import(migrationPath);
                            return migration.down(context);
                        }
                    };
                }
            },
            context: this.sequelize.getQueryInterface(),
            storage: new SequelizeStorage({ sequelize: this.sequelize }),
            logger: {
                info: (msg) => logger.info(msg.event ? `Migration: ${msg.event} - ${msg.name}` : msg),
                warn: (msg) => logger.warn(msg),
                error: (msg) => logger.error(msg),
                debug: (msg) => logger.debug(msg)
            }
        });
    }

    /**
     * Connect to the database and verify connection
     * @returns {Promise<boolean>}
     */
    async connect() {
        if (!this.sequelize) {
            await this.initialize();
        }

        try {
            await this.sequelize.authenticate();
            this.isConnected = true;
            logger.info('Database connection established successfully');
            return true;
        } catch (error) {
            this.isConnected = false;
            logger.error('Unable to connect to database:', error.message);
            throw error;
        }
    }

    /**
     * Run pending migrations
     * @returns {Promise<Array>} Array of executed migrations
     */
    async runMigrations() {
        if (!this.umzug) {
            await this.initialize();
        }

        logger.info('Running pending migrations...');
        const pending = await this.umzug.pending();

        if (pending.length === 0) {
            logger.info('No pending migrations');
            return [];
        }

        logger.info(`Found ${pending.length} pending migration(s)`);
        const executed = await this.umzug.up();
        logger.info(`Executed ${executed.length} migration(s)`);
        return executed;
    }

    /**
     * Get migration status
     * @returns {Promise<{pending: Array, executed: Array}>}
     */
    async getMigrationStatus() {
        if (!this.umzug) {
            await this.initialize();
        }

        const pending = await this.umzug.pending();
        const executed = await this.umzug.executed();

        return { pending, executed };
    }

    /**
     * Rollback the last migration
     * @returns {Promise<Array>}
     */
    async rollbackMigration() {
        if (!this.umzug) {
            await this.initialize();
        }

        logger.info('Rolling back last migration...');
        const reverted = await this.umzug.down();
        logger.info(`Rolled back ${reverted.length} migration(s)`);
        return reverted;
    }

    /**
     * Perform a health check on the database connection
     * @returns {Promise<{healthy: boolean, latency: number, error?: string}>}
     */
    async healthCheck() {
        const start = Date.now();

        try {
            if (!this.sequelize) {
                return { healthy: false, latency: 0, error: 'Database not initialized' };
            }

            await this.sequelize.authenticate();
            const latency = Date.now() - start;

            return { healthy: true, latency };
        } catch (error) {
            const latency = Date.now() - start;
            return { healthy: false, latency, error: error.message };
        }
    }

    /**
     * Register a model with the manager
     * @param {string} name - Model name
     * @param {Function} define - Model definition function
     * @returns {Model}
     */
    registerModel(name, define) {
        if (!this.sequelize) {
            throw new Error('Database not initialized. Call initialize() first.');
        }

        const model = define(this.sequelize);
        this.models[name] = model;
        return model;
    }

    /**
     * Get a registered model by name
     * @param {string} name - Model name
     * @returns {Model|undefined}
     */
    getModel(name) {
        return this.models[name];
    }

    /**
     * Get the Sequelize instance
     * @returns {Sequelize}
     */
    getSequelize() {
        return this.sequelize;
    }

    /**
     * Close the database connection
     * @returns {Promise<void>}
     */
    async close() {
        if (this.sequelize) {
            await this.sequelize.close();
            this.isConnected = false;
            logger.info('Database connection closed');
        }
    }
}

// Export singleton instance
const databaseManager = new DatabaseManager();
export default databaseManager;

export { DatabaseManager };
