import '../src/utils/environment.js';
import databaseManager from '../src/database/index.js';
import { createServiceLogger } from '../src/utils/logger.js';
import { database as dbConfig } from '../config/config.js';

const logger = createServiceLogger('TestDB');

async function testConnection() {
    logger.info('Testing database connection...');
    logger.info(`Host: ${dbConfig.host}:${dbConfig.port}`);
    logger.info(`Database: ${dbConfig.name}`);
    logger.info(`User: ${dbConfig.user}`);

    try {
        await databaseManager.initialize();
        await databaseManager.connect();

        const health = await databaseManager.healthCheck();

        if (health.healthy) {
            logger.info(`Connection successful! Latency: ${health.latency}ms`);
        } else {
            logger.error(`Connection failed: ${health.error}`);
        }

        // Test a simple query
        const sequelize = databaseManager.getSequelize();
        const results = await sequelize.query('SELECT VERSION() as version', { type: sequelize.QueryTypes.SELECT });
        logger.info(`MariaDB version: ${results[0].version}`);

        await databaseManager.close();
        process.exit(health.healthy ? 0 : 1);
    } catch (error) {
        logger.error('Connection test failed:', error.message);

        if (error.message.includes('ECONNREFUSED')) {
            logger.error('Could not connect to the database server. Is MariaDB running?');
        } else if (error.message.includes('Access denied')) {
            logger.error('Invalid credentials. Check DB_USER and DB_PASSWORD');
        } else if (error.message.includes('Unknown database')) {
            logger.error(`Database "${dbConfig.name}" does not exist. Create it first.`);
        }

        process.exit(1);
    }
}

testConnection();
