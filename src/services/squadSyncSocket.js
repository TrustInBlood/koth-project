/**
 * SquadJS Sync WebSocket Service
 *
 * Handles WebSocket connections from SquadJS game server plugins.
 * Provides real-time bidirectional communication for player data sync.
 */

import { createServiceLogger } from '../utils/logger.js';
import { syncPlayer, getPlayerForGame, getPlayerBySteamId } from './syncService.js';
import { validatePlayerData, validateSteamId } from './dataValidator.js';
import { detectFormat, gameToApi } from './gameDataTransformer.js';

const logger = createServiceLogger('SquadSyncSocket');

// Track connected game servers
const connectedServers = new Map();

/**
 * Get the expected API key from environment
 */
function getExpectedApiKey() {
    return process.env.SYNC_API_KEY;
}

/**
 * Validate API key
 */
function validateApiKey(apiKey) {
    const expectedKey = getExpectedApiKey();
    if (!expectedKey) {
        logger.error('SYNC_API_KEY not configured');
        return { valid: false, error: 'Server configuration error' };
    }
    if (!apiKey) {
        return { valid: false, error: 'Missing API key' };
    }
    if (apiKey !== expectedKey) {
        return { valid: false, error: 'Invalid API key' };
    }
    return { valid: true };
}

/**
 * Setup the SquadJS sync Socket.IO namespace
 *
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
export function setupSquadSyncSocket(io) {
    const squadjs = io.of('/squadjs');

    logger.info('SquadJS sync socket namespace registered at /squadjs');

    squadjs.on('connection', (socket) => {
        logger.info(`New connection from ${socket.id} (${socket.handshake.address})`);

        // Track authentication state
        let isAuthenticated = false;
        let serverInfo = null;

        // ==================== Server Registration ====================

        socket.on('server:register', async (data, callback) => {
            try {
                const { serverId, serverName, apiKey } = data || {};

                // Validate API key
                const keyValidation = validateApiKey(apiKey);
                if (!keyValidation.valid) {
                    logger.warn(`Registration failed for ${socket.id}: ${keyValidation.error}`);
                    const response = { success: false, error: keyValidation.error };
                    if (callback) callback(response);
                    socket.emit('server:error', response);
                    return;
                }

                // Validate required fields
                if (!serverId) {
                    const response = { success: false, error: 'Missing serverId' };
                    if (callback) callback(response);
                    socket.emit('server:error', response);
                    return;
                }

                // Store server info
                isAuthenticated = true;
                serverInfo = {
                    serverId,
                    serverName: serverName || serverId,
                    connectedAt: new Date(),
                    socketId: socket.id,
                    address: socket.handshake.address
                };

                connectedServers.set(socket.id, serverInfo);

                logger.info(`Server registered: ${serverInfo.serverName} (${serverId}) from ${socket.handshake.address}`);

                const response = {
                    success: true,
                    serverId,
                    serverName: serverInfo.serverName,
                    message: 'Successfully registered'
                };

                if (callback) callback(response);
                socket.emit('server:registered', response);

            } catch (error) {
                logger.error(`Registration error for ${socket.id}:`, error.message);
                const response = { success: false, error: error.message };
                if (callback) callback(response);
                socket.emit('server:error', response);
            }
        });

        // ==================== Player Load ====================

        socket.on('player:load', async (data, callback) => {
            try {
                // Require authentication
                if (!isAuthenticated) {
                    const response = { success: false, error: 'Not authenticated. Call server:register first.' };
                    if (callback) callback(response);
                    socket.emit('player:error', response);
                    return;
                }

                const { steamId } = data || {};

                // Validate Steam ID
                const validation = validateSteamId(steamId);
                if (!validation.valid) {
                    const response = { success: false, steamId, error: validation.error };
                    if (callback) callback(response);
                    socket.emit('player:error', response);
                    return;
                }

                logger.debug(`Loading player ${validation.steamId} for server ${serverInfo?.serverId}`);

                // Get player data in game format
                const playerData = await getPlayerForGame(validation.steamId);

                if (!playerData) {
                    logger.debug(`Player ${validation.steamId} not found (new player)`);
                    const response = { steamId: validation.steamId };
                    if (callback) callback({ success: true, found: false, ...response });
                    socket.emit('player:not-found', response);
                    return;
                }

                logger.debug(`Loaded player ${validation.steamId}`);
                const response = { steamId: validation.steamId, data: playerData };
                if (callback) callback({ success: true, found: true, ...response });
                socket.emit('player:data', response);

            } catch (error) {
                logger.error(`Player load error:`, error.message);
                const response = { success: false, steamId: data?.steamId, error: error.message };
                if (callback) callback(response);
                socket.emit('player:error', response);
            }
        });

        // ==================== Player Save ====================

        socket.on('player:save', async (data, callback) => {
            try {
                // Require authentication
                if (!isAuthenticated) {
                    const response = { success: false, error: 'Not authenticated. Call server:register first.' };
                    if (callback) callback(response);
                    socket.emit('player:error', response);
                    return;
                }

                let { playerData } = data || {};

                if (!playerData || typeof playerData !== 'object') {
                    const response = { success: false, error: 'Invalid player data' };
                    if (callback) callback(response);
                    socket.emit('player:error', response);
                    return;
                }

                // Detect format and validate
                const format = detectFormat(playerData);
                const validation = validatePlayerData(playerData, format);

                if (!validation.valid) {
                    logger.warn(`Validation failed: ${validation.errors.join(', ')}`);
                    const response = {
                        success: false,
                        error: 'Validation failed',
                        details: validation.errors
                    };
                    if (callback) callback(response);
                    socket.emit('player:error', response);
                    return;
                }

                // Transform game format to API format if needed
                if (format === 'game') {
                    playerData = gameToApi(playerData);
                }

                const steamId = playerData.SteamID || playerData.steamId;
                logger.debug(`Saving player ${steamId} from server ${serverInfo?.serverId}`);

                // Sync to database
                const result = await syncPlayer(playerData);

                logger.debug(`Saved player ${steamId}: ${result.synced_tables?.join(', ') || 'no tables'}`);

                const response = {
                    success: true,
                    steamId,
                    syncedTables: result.synced_tables,
                    durationMs: result.duration_ms
                };
                if (callback) callback(response);
                socket.emit('player:saved', response);

            } catch (error) {
                logger.error(`Player save error:`, error.message);
                const steamId = data?.playerData?.['player info']?.steamid ||
                               data?.playerData?.SteamID ||
                               data?.playerData?.steamId;
                const response = { success: false, steamId, error: error.message };
                if (callback) callback(response);
                socket.emit('player:error', response);
            }
        });

        // ==================== Server Settings ====================

        socket.on('server-settings:request', async (data, callback) => {
            try {
                // Require authentication
                if (!isAuthenticated) {
                    const response = { success: false, error: 'Not authenticated. Call server:register first.' };
                    if (callback) callback(response);
                    socket.emit('server-settings:error', response);
                    return;
                }

                logger.debug(`Server settings requested by ${serverInfo?.serverId}`);

                // Server settings are stored as a special "player" with steam_id = 'ServerSettings'
                const settings = await getPlayerBySteamId('ServerSettings');

                if (!settings) {
                    const response = { success: false, error: 'Server settings not found' };
                    if (callback) callback(response);
                    socket.emit('server-settings:error', response);
                    return;
                }

                const response = { success: true, settings };
                if (callback) callback(response);
                socket.emit('server-settings:data', response);

            } catch (error) {
                logger.error(`Server settings error:`, error.message);
                const response = { success: false, error: error.message };
                if (callback) callback(response);
                socket.emit('server-settings:error', response);
            }
        });

        // ==================== Disconnect ====================

        socket.on('disconnect', (reason) => {
            if (serverInfo) {
                logger.info(`Server disconnected: ${serverInfo.serverName} (${serverInfo.serverId}) - ${reason}`);
                connectedServers.delete(socket.id);
            } else {
                logger.debug(`Unauthenticated socket disconnected: ${socket.id} - ${reason}`);
            }
        });

        // ==================== Error Handling ====================

        socket.on('error', (error) => {
            logger.error(`Socket error for ${socket.id}:`, error.message);
        });
    });

    return squadjs;
}

/**
 * Get list of connected game servers
 *
 * @returns {Array} Array of connected server info objects
 */
export function getConnectedServers() {
    return Array.from(connectedServers.values()).map(server => ({
        serverId: server.serverId,
        serverName: server.serverName,
        connectedAt: server.connectedAt,
        address: server.address
    }));
}

/**
 * Broadcast server settings update to all connected servers
 *
 * @param {import('socket.io').Namespace} squadjs - The /squadjs namespace
 * @param {Object} settings - Updated server settings
 */
export function broadcastServerSettingsUpdate(squadjs, settings) {
    logger.info('Broadcasting server settings update to all connected servers');
    squadjs.emit('server-settings:updated', { settings });
}

export default {
    setupSquadSyncSocket,
    getConnectedServers,
    broadcastServerSettingsUpdate
};
