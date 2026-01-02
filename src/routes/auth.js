import { Router } from 'express';
import passport from 'passport';
import { createServiceLogger } from '../utils/logger.js';

const logger = createServiceLogger('Auth');
const router = Router();

/**
 * Initiate Discord OAuth2 login
 * GET /auth/discord
 */
router.get('/discord', passport.authenticate('discord', {
    scope: ['identify', 'email', 'guilds']
}));

/**
 * Discord OAuth2 callback
 * GET /auth/discord/callback
 */
router.get('/discord/callback',
    passport.authenticate('discord', {
        failureRedirect: '/auth/failed'
    }),
    (req, res) => {
        logger.info(`User ${req.user.username} logged in`);
        // Redirect to dashboard after successful login
        res.redirect(process.env.DASHBOARD_URL || 'http://localhost:5173');
    }
);

/**
 * Logout endpoint
 * GET /auth/logout
 */
router.get('/logout', (req, res) => {
    const username = req.user?.username || 'Unknown';

    req.logout((err) => {
        if (err) {
            logger.error('Logout error:', err.message);
            return res.status(500).json({ error: 'Logout failed' });
        }

        logger.info(`User ${username} logged out`);
        res.redirect(process.env.DASHBOARD_URL || 'http://localhost:5173');
    });
});

/**
 * Authentication status endpoint
 * GET /auth/status
 */
router.get('/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                username: req.user.username,
                avatar: req.user.getAvatarUrl(),
                isAdmin: req.user.isAdmin
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

/**
 * Authentication failed page
 * GET /auth/failed
 */
router.get('/failed', (req, res) => {
    res.status(401).json({
        error: 'Authentication failed',
        message: 'Failed to authenticate with Discord'
    });
});

export default router;
