import { Router } from 'express';
import { syncPlayer, syncBatch, getLastSyncTime, getPlayerForGame, getPlayerBySteamId } from '../services/syncService.js';
import { createServiceLogger } from '../utils/logger.js';
import { validatePlayerData, validateSteamId } from '../services/dataValidator.js';
import { detectFormat, gameToApi } from '../services/gameDataTransformer.js';

const router = Router();
const logger = createServiceLogger('SyncAPI');

/**
 * API Key authentication middleware
 */
function requireApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const expectedKey = process.env.SYNC_API_KEY;

    if (!expectedKey) {
        logger.error('SYNC_API_KEY not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!apiKey) {
        logger.warn('Missing API key in request');
        return res.status(401).json({ error: 'Missing API key' });
    }

    if (apiKey !== expectedKey) {
        logger.warn('Invalid API key attempt');
        return res.status(403).json({ error: 'Invalid API key' });
    }

    next();
}

/**
 * POST /api/sync/player
 * Sync a single player's data from SquadJS
 *
 * Headers:
 *   X-API-Key: {SYNC_API_KEY}
 *   Content-Type: application/json
 *   X-Data-Format: game | api (optional, auto-detected if not specified)
 *
 * Body: Player JSON blob (game format or API format)
 */
router.post('/player', requireApiKey, async (req, res) => {
    try {
        let playerData = req.body;

        if (!playerData || typeof playerData !== 'object') {
            return res.status(400).json({ error: 'Invalid player data' });
        }

        // Detect or use specified format
        const formatHeader = req.headers['x-data-format'];
        const format = formatHeader || detectFormat(playerData);

        // Validate the data
        const validation = validatePlayerData(playerData, format);
        if (!validation.valid) {
            logger.warn(`Validation failed for player data: ${validation.errors.join(', ')}`);
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.errors
            });
        }

        // Transform game format to API format if needed
        if (format === 'game') {
            logger.debug('Converting game format to API format');
            playerData = gameToApi(playerData);
        }

        // Ensure we have a Steam ID
        if (!playerData.SteamID && !playerData.steamId) {
            return res.status(400).json({ error: 'Missing required field: SteamID' });
        }

        const result = await syncPlayer(playerData);

        res.json(result);

    } catch (error) {
        logger.error('Player sync error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/sync/batch
 * Sync multiple players' data in one request
 *
 * Headers:
 *   X-API-Key: {SYNC_API_KEY}
 *   Content-Type: application/json
 *
 * Body: { players: [ array of player JSON objects ] }
 */
router.post('/batch', requireApiKey, async (req, res) => {
    try {
        const { players } = req.body;

        if (!Array.isArray(players)) {
            return res.status(400).json({ error: 'Invalid request: players must be an array' });
        }

        if (players.length === 0) {
            return res.status(400).json({ error: 'Empty players array' });
        }

        if (players.length > 100) {
            return res.status(400).json({ error: 'Too many players. Maximum 100 per batch' });
        }

        const result = await syncBatch(players);

        res.json(result);

    } catch (error) {
        logger.error('Batch sync error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/sync/status/:steamId
 * Get the last sync time for a player
 *
 * Headers:
 *   X-API-Key: {SYNC_API_KEY}
 *
 * Response: { steam_id, last_sync, synced: boolean }
 */
router.get('/status/:steamId', requireApiKey, async (req, res) => {
    try {
        const { steamId } = req.params;

        if (!steamId || steamId.length !== 17) {
            return res.status(400).json({ error: 'Invalid Steam ID format' });
        }

        const lastSync = await getLastSyncTime(steamId);

        res.json({
            steam_id: steamId,
            last_sync: lastSync,
            synced: lastSync !== null
        });

    } catch (error) {
        logger.error('Sync status error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/sync/health
 * Health check endpoint (no auth required)
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'sync-api',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/sync/player/:steamId
 * Get player data in game-compatible JSON format
 *
 * Headers:
 *   X-API-Key: {SYNC_API_KEY}
 *
 * Query params:
 *   format: 'game' (default) | 'api'
 *
 * Response 200: Full player JSON (game or API format)
 * Response 404: { error: "Player not found" }
 */
router.get('/player/:steamId', requireApiKey, async (req, res) => {
    try {
        const { steamId } = req.params;
        const format = req.query.format || 'game';

        // Validate Steam ID
        const validation = validateSteamId(steamId);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        // Get player data based on requested format
        let playerData;
        if (format === 'game') {
            playerData = await getPlayerForGame(validation.steamId);
        } else {
            playerData = await getPlayerBySteamId(validation.steamId);
        }

        if (!playerData) {
            return res.status(404).json({
                error: 'Player not found',
                steam_id: validation.steamId
            });
        }

        res.json(playerData);

    } catch (error) {
        logger.error('Get player error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/sync/server-settings
 * Get server settings configuration
 *
 * Headers:
 *   X-API-Key: {SYNC_API_KEY}
 *
 * Response 200: ServerSettings JSON
 * Response 404: { error: "Server settings not found" }
 */
router.get('/server-settings', requireApiKey, async (req, res) => {
    try {
        // Server settings are stored as a special "player" with steam_id = 'ServerSettings'
        const settings = await getPlayerBySteamId('ServerSettings');

        if (!settings) {
            return res.status(404).json({
                error: 'Server settings not found'
            });
        }

        // Return the raw settings data (stored in a format similar to player data)
        res.json(settings);

    } catch (error) {
        logger.error('Get server settings error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
