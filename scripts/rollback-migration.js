import '../src/utils/environment.js';
import databaseManager from '../src/database/index.js';
import { createServiceLogger } from '../src/utils/logger.js';

const logger = createServiceLogger('Rollback');

async function rollback() {
    try {
        logger.info('Rolling back last migration...');

        await databaseManager.initialize();
        await databaseManager.connect();

        const { executed } = await databaseManager.getMigrationStatus();

        if (executed.length === 0) {
            logger.info('No migrations to rollback');
            await databaseManager.close();
            process.exit(0);
        }

        const lastMigration = executed[executed.length - 1];
        logger.info(`Rolling back: ${lastMigration.name}`);

        const reverted = await databaseManager.rollbackMigration();

        if (reverted.length > 0) {
            logger.info(`Successfully rolled back: ${reverted.map(m => m.name).join(', ')}`);
        } else {
            logger.info('No migrations were rolled back');
        }

        await databaseManager.close();
        process.exit(0);
    } catch (error) {
        logger.error('Rollback failed:', error.message);
        logger.error(error.stack);
        process.exit(1);
    }
}

rollback();
