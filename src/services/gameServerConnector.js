/**
 * Game Server Connector Service (v2)
 *
 * KOTH Bot connects TO game servers (reversed architecture).
 * Each game server runs a Socket.IO server via the WsKothDB plugin.
 * This service manages connections to all configured game servers.
 *
 * v2 Changes:
 * - Token-based authentication (server sends token, we validate against DB)
 * - v2 JSON format only
 * - Handles connect, periodic sync, disconnect, crash recovery events
 * - Active server locking for multi-server player protection
 */

import { io } from 'socket.io-client';
import { gameServers as gameServersConfig } from '../../config/config.js';
import { createServiceLogger } from '../utils/logger.js';
import {
    validateServerToken,
    handlePlayerConnect,
    handlePeriodicSync,
    handlePlayerDisconnect,
    handleCrashRecovery
} from './syncService.js';
import { validateV2Format } from './dataValidator.js';
import { getModels } from '../database/models/index.js';

const logger = createServiceLogger('GameServerConnector');

// Track connected game servers
const connections = new Map();

// Retry delay for server-hop waiting (ms)
const SERVER_HOP_RETRY_DELAY = 2000;
const SERVER_HOP_MAX_RETRIES = 5;

/**
 * Initialize connections to all configured game servers
 */
export async function initGameServerConnector() {
    const { servers } = gameServersConfig;

    if (!servers || servers.length === 0) {
        logger.info('No game servers configured. Set GAME_SERVERS env variable to enable WebSocket sync.');
        return;
    }

    logger.info(`Initializing connections to ${servers.length} game server(s)`);

    for (const serverConfig of servers) {
        connectToGameServer(serverConfig);
    }
}

/**
 * Connect to a single game server
 *
 * @param {Object} serverConfig - Server configuration { url, token }
 */
function connectToGameServer(serverConfig) {
    const { url, token } = serverConfig;

    logger.info(`Connecting to game server: ${url}`);

    const socket = io(url, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: gameServersConfig.reconnectAttempts,
        reconnectionDelay: gameServersConfig.reconnectDelay,
        reconnectionDelayMax: gameServersConfig.reconnectDelayMax,
        timeout: gameServersConfig.timeout,
        autoConnect: true
    });

    // Track connection
    const connectionInfo = {
        url,
        socket,
        token,
        serverId: null,
        serverName: null,
        serverRecord: null, // GameServer DB record
        connectedAt: null,
        status: 'connecting',
        authenticated: false
    };
    connections.set(url, connectionInfo);

    // ==================== Connection Events ====================

    socket.on('connect', async () => {
        logger.info(`Connected to game server: ${url}`);
        connectionInfo.connectedAt = new Date();
        connectionInfo.status = 'connected';

        // Validate the token against DB
        const serverRecord = await validateServerToken(token);
        if (!serverRecord) {
            logger.error(`Invalid token for ${url}, disconnecting`);
            socket.disconnect();
            connectionInfo.status = 'auth_failed';
            return;
        }

        connectionInfo.authenticated = true;
        connectionInfo.serverRecord = serverRecord;
        connectionInfo.serverId = serverRecord.server_id;
        connectionInfo.serverName = serverRecord.server_name;

        logger.info(`Authenticated game server: ${serverRecord.server_name} (${serverRecord.server_id})`);

        // Notify game server of successful auth
        socket.emit('auth:success', {
            serverId: serverRecord.server_id,
            serverName: serverRecord.server_name
        });
    });

    socket.on('disconnect', async (reason) => {
        logger.warn(`Disconnected from game server ${connectionInfo.serverName || url}: ${reason}`);
        connectionInfo.status = 'disconnected';
        connectionInfo.authenticated = false;

        // Clear active players for this server if we were authenticated
        if (connectionInfo.serverId) {
            try {
                const models = getModels();
                await models.Player.clearServerActivePlayers(connectionInfo.serverId);
                logger.info(`Cleared active players for ${connectionInfo.serverId}`);
            } catch (error) {
                logger.error(`Failed to clear active players: ${error.message}`);
            }
        }
    });

    socket.on('connect_error', (error) => {
        logger.error(`Connection error to ${url}: ${error.message}`);
        connectionInfo.status = 'error';
    });

    // ==================== Server Info ====================

    socket.on('server:info', (data) => {
        const { playerCount } = data;
        logger.info(`Game server info: ${connectionInfo.serverName} - ${playerCount} players online`);
    });

    // ==================== Player Connect ====================

    socket.on('player:connect', async (data) => {
        const { steamId, eosId, name } = data;

        if (!connectionInfo.authenticated) {
            socket.emit('player:error', { steamId, error: 'Server not authenticated' });
            return;
        }

        logger.debug(`Player connect on ${connectionInfo.serverName}: ${steamId} (${name})`);

        try {
            const result = await handlePlayerConnect(steamId, connectionInfo.serverRecord);

            if (result.status === 'player_active_elsewhere') {
                // Player is on another server, tell game to wait and retry
                socket.emit('player:wait', {
                    steamId,
                    activeServer: result.activeServer,
                    retryAfterMs: SERVER_HOP_RETRY_DELAY,
                    maxRetries: SERVER_HOP_MAX_RETRIES
                });
                return;
            }

            // Send player data
            socket.emit('player:data', {
                steamId,
                data: result.data,
                syncSeq: result.syncSeq
            });

        } catch (error) {
            logger.error(`Error on player connect ${steamId}: ${error.message}`);
            socket.emit('player:error', { steamId, error: error.message });
        }
    });

    // ==================== Periodic Sync ====================

    socket.on('player:sync', async (data) => {
        if (!connectionInfo.authenticated) {
            socket.emit('sync:error', { error: 'Server not authenticated' });
            return;
        }

        const { steamId } = data;

        // Validate v2 format
        const validation = validateV2Format(data);
        if (!validation.valid) {
            logger.warn(`Invalid sync data from ${connectionInfo.serverName} for ${steamId}`);
            socket.emit('sync:error', {
                steamId,
                error: 'validation_failed',
                errors: validation.errors
            });
            return;
        }

        try {
            const result = await handlePeriodicSync(data, connectionInfo.serverRecord);

            if (!result.success) {
                socket.emit('sync:error', {
                    steamId,
                    error: result.error,
                    details: result
                });
                return;
            }

            socket.emit('sync:ack', {
                steamId,
                syncSeq: result.syncSeq,
                flagged: result.flagged
            });

        } catch (error) {
            logger.error(`Error on periodic sync ${steamId}: ${error.message}`);
            socket.emit('sync:error', { steamId, error: error.message });
        }
    });

    // ==================== Player Disconnect ====================

    socket.on('player:disconnect', async (data) => {
        if (!connectionInfo.authenticated) {
            socket.emit('disconnect:error', { error: 'Server not authenticated' });
            return;
        }

        const { steamId } = data;

        // Validate v2 format
        const validation = validateV2Format(data);
        if (!validation.valid) {
            logger.warn(`Invalid disconnect data from ${connectionInfo.serverName} for ${steamId}`);
            socket.emit('disconnect:error', {
                steamId,
                error: 'validation_failed',
                errors: validation.errors
            });
            return;
        }

        try {
            const result = await handlePlayerDisconnect(data, connectionInfo.serverRecord);

            if (!result.success) {
                socket.emit('disconnect:error', {
                    steamId,
                    error: result.error,
                    details: result
                });
                return;
            }

            socket.emit('disconnect:ack', {
                steamId,
                syncSeq: result.syncSeq
            });

        } catch (error) {
            logger.error(`Error on player disconnect ${steamId}: ${error.message}`);
            socket.emit('disconnect:error', { steamId, error: error.message });
        }
    });

    // ==================== Crash Recovery ====================

    socket.on('player:crash-recovery', async (data) => {
        if (!connectionInfo.authenticated) {
            socket.emit('recovery:error', { error: 'Server not authenticated' });
            return;
        }

        const { steamId } = data;

        // Validate v2 format
        const validation = validateV2Format(data);
        if (!validation.valid) {
            logger.warn(`Invalid crash recovery data from ${connectionInfo.serverName} for ${steamId}`);
            socket.emit('recovery:error', {
                steamId,
                error: 'validation_failed',
                errors: validation.errors
            });
            return;
        }

        try {
            const result = await handleCrashRecovery(data, connectionInfo.serverRecord);

            if (!result.success) {
                socket.emit('recovery:error', {
                    steamId,
                    error: result.error,
                    details: result
                });
                return;
            }

            socket.emit('recovery:ack', {
                steamId,
                syncSeq: result.syncSeq,
                skipped: result.skipped,
                flagged: result.flagged
            });

        } catch (error) {
            logger.error(`Error on crash recovery ${steamId}: ${error.message}`);
            socket.emit('recovery:error', { steamId, error: error.message });
        }
    });

    // ==================== Batch Crash Recovery ====================

    socket.on('player:batch-crash-recovery', async (data) => {
        if (!connectionInfo.authenticated) {
            socket.emit('batch-recovery:error', { error: 'Server not authenticated' });
            return;
        }

        const { players } = data;

        if (!Array.isArray(players)) {
            socket.emit('batch-recovery:error', { error: 'Expected array of players' });
            return;
        }

        logger.info(`Batch crash recovery: ${players.length} players from ${connectionInfo.serverName}`);

        const results = [];

        for (const playerData of players) {
            const { steamId } = playerData;

            try {
                const validation = validateV2Format(playerData);
                if (!validation.valid) {
                    results.push({ steamId, success: false, error: 'validation_failed' });
                    continue;
                }

                const result = await handleCrashRecovery(playerData, connectionInfo.serverRecord);
                results.push({
                    steamId,
                    success: result.success,
                    syncSeq: result.syncSeq,
                    skipped: result.skipped,
                    flagged: result.flagged
                });

            } catch (error) {
                results.push({ steamId, success: false, error: error.message });
            }
        }

        socket.emit('batch-recovery:complete', {
            total: players.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        });
    });
}

/**
 * Get list of connected game servers
 *
 * @returns {Array} Array of connected server info objects
 */
export function getConnectedGameServers() {
    return Array.from(connections.values()).map(conn => ({
        url: conn.url,
        serverId: conn.serverId,
        serverName: conn.serverName,
        connectedAt: conn.connectedAt,
        status: conn.status,
        authenticated: conn.authenticated
    }));
}

/**
 * Get connection by server ID
 *
 * @param {string} serverId - Server ID
 * @returns {Object|null} Connection info or null
 */
export function getConnectionByServerId(serverId) {
    for (const conn of connections.values()) {
        if (conn.serverId === serverId) {
            return conn;
        }
    }
    return null;
}

/**
 * Send message to a specific server
 *
 * @param {string} serverId - Server ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @returns {boolean} Whether message was sent
 */
export function sendToServer(serverId, event, data) {
    const conn = getConnectionByServerId(serverId);
    if (!conn || !conn.authenticated || !conn.socket) {
        return false;
    }

    conn.socket.emit(event, data);
    return true;
}

/**
 * Broadcast message to all authenticated servers
 *
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export function broadcastToServers(event, data) {
    for (const conn of connections.values()) {
        if (conn.authenticated && conn.socket) {
            conn.socket.emit(event, data);
        }
    }
}

/**
 * Disconnect from all game servers
 */
export async function disconnectAll() {
    logger.info('Disconnecting from all game servers');

    for (const [url, connectionInfo] of connections) {
        if (connectionInfo.socket) {
            connectionInfo.socket.disconnect();
            logger.debug(`Disconnected from ${url}`);
        }
    }

    connections.clear();
}

/**
 * Reconnect to a specific server
 *
 * @param {string} url - Server URL
 */
export function reconnectToServer(url) {
    const conn = connections.get(url);
    if (conn && conn.socket) {
        logger.info(`Reconnecting to ${url}`);
        conn.socket.connect();
    }
}

export default {
    initGameServerConnector,
    getConnectedGameServers,
    getConnectionByServerId,
    sendToServer,
    broadcastToServers,
    disconnectAll,
    reconnectToServer
};
