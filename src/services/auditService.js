import { getModels } from '../database/models/index.js';
import { Op } from 'sequelize';
import { createServiceLogger } from '../utils/logger.js';

const logger = createServiceLogger('AuditService');

/**
 * Get flagged sync entries for review
 *
 * @param {Object} options - Query options
 * @param {string} options.serverId - Filter by server ID
 * @param {string} options.steamId - Filter by player Steam ID
 * @param {number} options.limit - Max entries to return (default 50)
 * @param {number} options.offset - Pagination offset (default 0)
 * @returns {Promise<Object>} Flagged entries with count
 */
export async function getFlaggedSyncs({ serverId, steamId, limit = 50, offset = 0 } = {}) {
    const models = getModels();

    const where = { flagged: true };
    if (serverId) where.server_id = serverId;
    if (steamId) where.player_steam_id = steamId;

    const { rows, count } = await models.SyncAuditLog.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset
    });

    return {
        entries: rows,
        total: count,
        limit,
        offset
    };
}

/**
 * Get sync history for a player
 *
 * @param {string} steamId - Player's Steam ID
 * @param {Object} options - Query options
 * @param {string} options.syncType - Filter by sync type
 * @param {Date} options.since - Only entries after this date
 * @param {number} options.limit - Max entries to return (default 100)
 * @returns {Promise<Array>} Sync history entries
 */
export async function getPlayerSyncHistory(steamId, { syncType, since, limit = 100 } = {}) {
    const models = getModels();

    const where = { player_steam_id: steamId };
    if (syncType) where.sync_type = syncType;
    if (since) where.created_at = { [Op.gte]: since };

    return models.SyncAuditLog.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit
    });
}

/**
 * Get sync history for a server
 *
 * @param {string} serverId - Server ID
 * @param {Object} options - Query options
 * @param {string} options.syncType - Filter by sync type
 * @param {Date} options.since - Only entries after this date
 * @param {number} options.limit - Max entries to return (default 100)
 * @returns {Promise<Array>} Sync history entries
 */
export async function getServerSyncHistory(serverId, { syncType, since, limit = 100 } = {}) {
    const models = getModels();

    const where = { server_id: serverId };
    if (syncType) where.sync_type = syncType;
    if (since) where.created_at = { [Op.gte]: since };

    return models.SyncAuditLog.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit
    });
}

/**
 * Get sync statistics for a time period
 *
 * @param {Object} options - Query options
 * @param {Date} options.since - Start of period
 * @param {Date} options.until - End of period
 * @param {string} options.serverId - Filter by server ID
 * @returns {Promise<Object>} Sync statistics
 */
export async function getSyncStats({ since, until, serverId } = {}) {
    const models = getModels();

    const where = {};
    if (since || until) {
        where.created_at = {};
        if (since) where.created_at[Op.gte] = since;
        if (until) where.created_at[Op.lte] = until;
    }
    if (serverId) where.server_id = serverId;

    // Get counts by sync type
    const syncsByType = await models.SyncAuditLog.findAll({
        where,
        attributes: [
            'sync_type',
            [models.SyncAuditLog.sequelize.fn('COUNT', '*'), 'count']
        ],
        group: ['sync_type'],
        raw: true
    });

    // Get flagged count
    const flaggedCount = await models.SyncAuditLog.count({
        where: { ...where, flagged: true }
    });

    // Get unique players synced
    const uniquePlayers = await models.SyncAuditLog.count({
        where,
        distinct: true,
        col: 'player_steam_id'
    });

    // Get average sync duration
    const avgDuration = await models.SyncAuditLog.findOne({
        where,
        attributes: [
            [models.SyncAuditLog.sequelize.fn('AVG', models.SyncAuditLog.sequelize.col('duration_ms')), 'avgDuration']
        ],
        raw: true
    });

    return {
        byType: syncsByType.reduce((acc, row) => {
            acc[row.sync_type] = parseInt(row.count);
            return acc;
        }, {}),
        flagged: flaggedCount,
        uniquePlayers,
        avgDurationMs: Math.round(avgDuration?.avgDuration || 0)
    };
}

/**
 * Flag a server for suspicious activity
 *
 * @param {string} serverId - Server ID to flag
 * @param {string} reason - Reason for flagging
 * @returns {Promise<Object>} Updated server record
 */
export async function flagServer(serverId, reason) {
    const models = getModels();

    const server = await models.GameServer.findOne({
        where: { server_id: serverId }
    });

    if (!server) {
        throw new Error(`Server not found: ${serverId}`);
    }

    await server.update({
        flagged: true,
        flagged_reason: reason
    });

    logger.warn(`Server flagged: ${serverId} - ${reason}`);

    return server;
}

/**
 * Unflag a server after review
 *
 * @param {string} serverId - Server ID to unflag
 * @returns {Promise<Object>} Updated server record
 */
export async function unflagServer(serverId) {
    const models = getModels();

    const server = await models.GameServer.findOne({
        where: { server_id: serverId }
    });

    if (!server) {
        throw new Error(`Server not found: ${serverId}`);
    }

    await server.update({
        flagged: false,
        flagged_reason: null
    });

    logger.info(`Server unflagged: ${serverId}`);

    return server;
}

/**
 * Deactivate a server (revoke token)
 *
 * @param {string} serverId - Server ID to deactivate
 * @param {string} reason - Reason for deactivation
 * @returns {Promise<Object>} Updated server record
 */
export async function deactivateServer(serverId, reason) {
    const models = getModels();

    const server = await models.GameServer.findOne({
        where: { server_id: serverId }
    });

    if (!server) {
        throw new Error(`Server not found: ${serverId}`);
    }

    await server.update({
        is_active: false,
        flagged: true,
        flagged_reason: `Deactivated: ${reason}`
    });

    // Clear any active player sessions from this server
    await models.Player.clearServerActivePlayers(serverId);

    logger.warn(`Server deactivated: ${serverId} - ${reason}`);

    return server;
}

/**
 * Reactivate a server
 *
 * @param {string} serverId - Server ID to reactivate
 * @returns {Promise<Object>} Updated server record
 */
export async function reactivateServer(serverId) {
    const models = getModels();

    const server = await models.GameServer.findOne({
        where: { server_id: serverId }
    });

    if (!server) {
        throw new Error(`Server not found: ${serverId}`);
    }

    await server.update({
        is_active: true,
        flagged: false,
        flagged_reason: null
    });

    logger.info(`Server reactivated: ${serverId}`);

    return server;
}

/**
 * Get all registered servers with their status
 *
 * @param {Object} options - Query options
 * @param {boolean} options.activeOnly - Only return active servers
 * @param {boolean} options.flaggedOnly - Only return flagged servers
 * @returns {Promise<Array>} Server records
 */
export async function getServers({ activeOnly = false, flaggedOnly = false } = {}) {
    const models = getModels();

    const where = {};
    if (activeOnly) where.is_active = true;
    if (flaggedOnly) where.flagged = true;

    return models.GameServer.findAll({
        where,
        order: [['created_at', 'DESC']],
        attributes: { exclude: ['api_token'] } // Don't expose tokens
    });
}

/**
 * Register a new game server
 *
 * @param {string} serverId - Unique server identifier
 * @param {string} serverName - Human-readable server name
 * @returns {Promise<Object>} Created server with token
 */
export async function registerServer(serverId, serverName) {
    const models = getModels();

    // Check if server already exists
    const existing = await models.GameServer.findOne({
        where: { server_id: serverId }
    });

    if (existing) {
        throw new Error(`Server already registered: ${serverId}`);
    }

    const token = models.GameServer.generateToken();

    const server = await models.GameServer.create({
        server_id: serverId,
        server_name: serverName,
        api_token: token,
        is_active: true
    });

    logger.info(`Server registered: ${serverId} (${serverName})`);

    return {
        serverId: server.server_id,
        serverName: server.server_name,
        apiToken: token, // Only returned on creation
        isActive: server.is_active
    };
}

/**
 * Regenerate API token for a server
 *
 * @param {string} serverId - Server ID
 * @returns {Promise<Object>} Server with new token
 */
export async function regenerateServerToken(serverId) {
    const models = getModels();

    const server = await models.GameServer.findOne({
        where: { server_id: serverId }
    });

    if (!server) {
        throw new Error(`Server not found: ${serverId}`);
    }

    const newToken = models.GameServer.generateToken();

    await server.update({
        api_token: newToken
    });

    logger.info(`Token regenerated for server: ${serverId}`);

    return {
        serverId: server.server_id,
        serverName: server.server_name,
        apiToken: newToken,
        isActive: server.is_active
    };
}

/**
 * Clean up old audit logs
 *
 * @param {number} daysToKeep - Keep logs newer than this many days
 * @returns {Promise<number>} Number of deleted entries
 */
export async function cleanupOldLogs(daysToKeep = 30) {
    const models = getModels();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const deleted = await models.SyncAuditLog.destroy({
        where: {
            created_at: { [Op.lt]: cutoff },
            flagged: false // Keep flagged entries for review
        }
    });

    logger.info(`Cleaned up ${deleted} audit log entries older than ${daysToKeep} days`);

    return deleted;
}

export default {
    getFlaggedSyncs,
    getPlayerSyncHistory,
    getServerSyncHistory,
    getSyncStats,
    flagServer,
    unflagServer,
    deactivateServer,
    reactivateServer,
    getServers,
    registerServer,
    regenerateServerToken,
    cleanupOldLogs
};
