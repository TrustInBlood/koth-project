import { Router } from 'express';
import databaseManager from '../database/index.js';
import { createServiceLogger } from '../utils/logger.js';

const logger = createServiceLogger('API');
const router = Router();

/**
 * Health check endpoint
 * GET /api/health
 */
router.get('/health', async (req, res) => {
    try {
        const dbHealth = await databaseManager.healthCheck();

        const health = {
            status: dbHealth.healthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                database: dbHealth
            }
        };

        const statusCode = dbHealth.healthy ? 200 : 503;
        res.status(statusCode).json(health);
    } catch (error) {
        logger.error('Health check failed:', error.message);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * API info endpoint
 * GET /api
 */
router.get('/', (req, res) => {
    res.json({
        name: 'KOTH Bot API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            user: '/api/user',
            stats: '/api/stats'
        }
    });
});

/**
 * Get current authenticated user
 * GET /api/user
 */
router.get('/user', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
        id: req.user.id,
        username: req.user.username,
        avatar: req.user.getAvatarUrl(),
        isAdmin: req.user.isAdmin
    });
});

/**
 * Get application stats
 * GET /api/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const User = databaseManager.getModel('User');

        const stats = {
            users: {
                total: await User?.count() || 0,
                banned: await User?.count({ where: { isBanned: true } }) || 0
            },
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };

        res.json(stats);
    } catch (error) {
        logger.error('Failed to get stats:', error.message);
        res.status(500).json({ error: 'Failed to retrieve stats' });
    }
});

export default router;
