import '../src/utils/environment.js';
import databaseManager from '../src/database/index.js';
import { createServiceLogger } from '../src/utils/logger.js';

const logger = createServiceLogger('Migrate');

async function migrate() {
    try {
        logger.info('Starting database migration...');

        await databaseManager.initialize();
        await databaseManager.connect();

        const executed = await databaseManager.runMigrations();

        if (executed.length === 0) {
            logger.info('No pending migrations to run');
        } else {
            logger.info(`Successfully executed ${executed.length} migration(s):`);
            executed.forEach(m => logger.info(`  - ${m.name}`));
        }

        await databaseManager.close();
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed:', error.message);
        logger.error(error.stack);
        process.exit(1);
    }
}

migrate();
