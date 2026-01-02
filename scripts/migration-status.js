import '../src/utils/environment.js';
import databaseManager from '../src/database/index.js';
import { createServiceLogger } from '../src/utils/logger.js';

const logger = createServiceLogger('MigrationStatus');

async function checkStatus() {
    try {
        logger.info('Checking migration status...');

        await databaseManager.initialize();
        await databaseManager.connect();

        const { pending, executed } = await databaseManager.getMigrationStatus();

        logger.info('');
        logger.info('=== Executed Migrations ===');
        if (executed.length === 0) {
            logger.info('  (none)');
        } else {
            executed.forEach(m => logger.info(`  [x] ${m.name}`));
        }

        logger.info('');
        logger.info('=== Pending Migrations ===');
        if (pending.length === 0) {
            logger.info('  (none)');
        } else {
            pending.forEach(m => logger.info(`  [ ] ${m.name}`));
        }

        logger.info('');
        logger.info(`Total: ${executed.length} executed, ${pending.length} pending`);

        await databaseManager.close();
        process.exit(0);
    } catch (error) {
        logger.error('Failed to check migration status:', error.message);
        process.exit(1);
    }
}

checkStatus();
