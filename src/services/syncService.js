import { getModels } from '../database/models/index.js';
import databaseManager from '../database/index.js';
import { createServiceLogger } from '../utils/logger.js';
import {
    dbToV2,
    dbToV2Player,
    dbToV2Tracking,
    v2PlayerToDbParts,
    v2TrackingToDbParts,
    createDataSummary
} from './gameDataTransformer.js';
import { validateV2PlayerFormat, validateV2TrackingFormat, checkDeltaLimits, validateSyncSequence } from './dataValidator.js';

const logger = createServiceLogger('SyncService');

// How long to wait before allowing a new server to claim a player (ms)
const ACTIVE_SERVER_TIMEOUT = 30000; // 30 seconds

/**
 * Validate server token and return server record
 * @param {string} token - API token from the server
 * @returns {Promise<Object|null>} GameServer record or null if invalid
 */
export async function validateServerToken(token) {
    if (!token) return null;

    const models = getModels();
    const server = await models.GameServer.findByToken(token);

    if (!server) {
        logger.warn('Invalid server token attempted');
        return null;
    }

    if (server.flagged) {
        logger.warn(`Flagged server attempted sync: ${server.server_id}`);
        // Still allow but log it
    }

    return server;
}

/**
 * Handle player connect - return player data and set active server lock
 *
 * @param {string} steamId - Player's Steam ID
 * @param {Object} server - GameServer record
 * @returns {Promise<Object>} Connect result with player data or wait signal
 */
export async function handlePlayerConnect(steamId, server) {
    const models = getModels();
    const startTime = Date.now();

    try {
        // Find or create player with full data
        let player = await models.Player.findWithFullData(steamId);

        if (!player) {
            // Create new player
            player = await models.Player.create({
                steam_id: steamId,
                sync_seq: 0
            });

            // Create default stats
            await models.PlayerStats.create({
                player_id: player.id
            });

            // Reload with associations
            player = await models.Player.findWithFullData(steamId);
        }

        // Check if player is active on another server
        if (player.active_server_id && player.active_server_id !== server.server_id) {
            if (player.wasRecentlyActive(ACTIVE_SERVER_TIMEOUT)) {
                logger.info(`Player ${steamId} is active on ${player.active_server_id}, signaling wait`);
                return {
                    success: true,
                    status: 'player_active_elsewhere',
                    activeServer: player.active_server_id,
                    activeSince: player.active_since,
                    waitMs: ACTIVE_SERVER_TIMEOUT
                };
            }
            // Player's active session expired, we can claim them
            logger.info(`Player ${steamId} was on ${player.active_server_id} but session expired`);
        }

        // Set this server as active
        await player.setActiveServer(server.server_id);

        // Transform to v2 format (player only - game doesn't need historical tracking)
        // Tracking data is for leaderboards/stats on web dashboard
        // Game builds tracking fresh during play session
        const playerData = dbToV2Player(player);

        const duration = Date.now() - startTime;
        logger.info(`Player connect: ${steamId} on ${server.server_id} (${duration}ms)`);

        // Log the connect event
        await models.SyncAuditLog.logSync({
            serverId: server.server_id,
            playerSteamId: steamId,
            syncType: 'connect',
            syncSeqBefore: null,
            syncSeqAfter: player.sync_seq,
            dataBefore: null,
            dataAfter: createDataSummary(playerData),
            durationMs: duration
        });

        return {
            success: true,
            status: 'ok',
            player: playerData,
            // Note: No tracking sent on connect - game builds it fresh
            syncSeq: Number(player.sync_seq)
        };

    } catch (error) {
        logger.error(`Connect failed for ${steamId}: ${error.message}`, error.stack);
        throw error;
    }
}

/**
 * Handle periodic sync during gameplay (full data: player + tracking)
 * Tracking is synced periodically to protect against crash data loss.
 *
 * @param {Object} data - Full v2 data with player fields + tracking section
 * @param {Object} server - GameServer record
 * @returns {Promise<Object>} Sync result
 */
export async function handlePeriodicSync(data, server) {
    const models = getModels();
    const sequelize = databaseManager.getSequelize();
    const startTime = Date.now();

    // Extract player data and tracking from combined format
    const playerData = data;
    const trackingData = data.tracking || null;
    const steamId = playerData.steamId;

    // Validate v2 player format
    const validation = validateV2PlayerFormat(playerData);
    if (!validation.valid) {
        logger.warn(`Invalid v2 player data from ${server.server_id} for ${steamId}: ${validation.errors.join(', ')}`);
        return {
            success: false,
            error: 'validation_failed',
            errors: validation.errors
        };
    }

    // Validate tracking data if provided
    if (trackingData) {
        const trackingValidation = validateV2TrackingFormat({ v: 2, steamId, ...trackingData });
        if (!trackingValidation.valid) {
            logger.warn(`Invalid v2 tracking data from ${server.server_id} for ${steamId}: ${trackingValidation.errors.join(', ')}`);
            return {
                success: false,
                error: 'tracking_validation_failed',
                errors: trackingValidation.errors
            };
        }
    }

    const transaction = await sequelize.transaction();

    try {
        // Get current player data
        const player = await models.Player.findWithFullData(steamId);

        if (!player) {
            await transaction.rollback();
            return {
                success: false,
                error: 'player_not_found'
            };
        }

        // Verify this server owns the player session
        if (player.active_server_id !== server.server_id) {
            await transaction.rollback();
            logger.warn(`Server ${server.server_id} tried to sync ${steamId} but ${player.active_server_id} owns session`);
            return {
                success: false,
                error: 'not_session_owner',
                activeServer: player.active_server_id
            };
        }

        // Validate sync sequence
        const seqValidation = validateSyncSequence(Number(player.sync_seq), playerData.syncSeq);
        if (!seqValidation.valid) {
            await transaction.rollback();
            logger.warn(`Invalid syncSeq from ${server.server_id} for ${steamId}: ${seqValidation.reason}`);
            return {
                success: false,
                error: 'invalid_sync_seq',
                reason: seqValidation.reason,
                expectedSeq: Number(player.sync_seq)
            };
        }

        // Get old data for delta check
        const oldPlayerData = dbToV2Player(player);

        // Check delta limits (player data only)
        const deltaCheck = checkDeltaLimits(oldPlayerData, playerData);
        let flagged = false;
        let flagReason = null;

        if (!deltaCheck.valid) {
            // Flag but don't reject
            flagged = true;
            flagReason = deltaCheck.violations.join('; ');
            logger.warn(`Delta violation from ${server.server_id} for ${steamId}: ${flagReason}`);
        }

        // Extract parts for database upsert (player data only)
        const dbParts = v2PlayerToDbParts(playerData);

        // Update player record
        await player.update({
            eos_id: dbParts.player.eos_id || player.eos_id,
            name: dbParts.player.name || player.name,
            sync_seq: playerData.syncSeq
        }, { transaction });

        // Upsert stats
        if (dbParts.stats) {
            await models.PlayerStats.upsert({
                player_id: player.id,
                ...dbParts.stats
            }, { transaction });
        }

        // Upsert skins
        if (dbParts.skins) {
            await models.PlayerSkin.upsert({
                player_id: player.id,
                ...dbParts.skins
            }, { transaction });
        }

        // Upsert supporter status
        if (dbParts.supporterStatus) {
            await models.PlayerSupporterStatus.upsert({
                player_id: player.id,
                ...dbParts.supporterStatus
            }, { transaction });
        }

        // Replace loadout (delete all, insert new)
        await models.LoadoutSlot.destroy({ where: { player_id: player.id }, transaction });
        for (const slot of dbParts.loadout) {
            await models.LoadoutSlot.create({
                player_id: player.id,
                ...slot
            }, { transaction });
        }

        // Replace perks
        await models.PlayerPerk.destroy({ where: { player_id: player.id }, transaction });
        for (const perk of dbParts.perks) {
            await models.PlayerPerk.create({
                player_id: player.id,
                ...perk
            }, { transaction });
        }

        // Upsert perma unlocks
        for (const unlock of dbParts.permaUnlocks) {
            await models.PlayerPermanentUnlock.upsert({
                player_id: player.id,
                ...unlock
            }, { transaction });
        }

        // === Sync tracking data (for crash protection) ===
        if (trackingData) {
            const trackingParts = v2TrackingToDbParts({ v: 2, steamId, ...trackingData });

            // Upsert rewards
            for (const reward of trackingParts.rewards) {
                await models.PlayerReward.upsert({
                    player_id: player.id,
                    ...reward
                }, { transaction });
            }

            // Upsert kills
            for (const kill of trackingParts.kills) {
                await models.PlayerKill.upsert({
                    killer_id: player.id,
                    ...kill
                }, { transaction });
            }

            // Upsert vehicle kills
            for (const vk of trackingParts.vehicleKills) {
                await models.PlayerVehicleKill.upsert({
                    player_id: player.id,
                    ...vk
                }, { transaction });
            }

            // Upsert purchases
            for (const purchase of trackingParts.purchases) {
                await models.PlayerPurchase.upsert({
                    player_id: player.id,
                    ...purchase
                }, { transaction });
            }

            // Upsert weapon xp
            for (const wxp of trackingParts.weaponXp) {
                await models.PlayerWeaponXp.upsert({
                    player_id: player.id,
                    ...wxp
                }, { transaction });
            }
        }

        await transaction.commit();

        const duration = Date.now() - startTime;

        // Log the sync
        await models.SyncAuditLog.logSync({
            serverId: server.server_id,
            playerSteamId: steamId,
            syncType: 'periodic',
            syncSeqBefore: Number(player.sync_seq),
            syncSeqAfter: playerData.syncSeq,
            dataBefore: createDataSummary(oldPlayerData),
            dataAfter: createDataSummary(playerData),
            flagged,
            flagReason,
            durationMs: duration
        });

        logger.info(`Periodic sync: ${steamId} seq ${playerData.syncSeq} (${duration}ms)${trackingData ? ' +tracking' : ''}${flagged ? ' [FLAGGED]' : ''}`);

        return {
            success: true,
            syncSeq: playerData.syncSeq,
            flagged
        };

    } catch (error) {
        await transaction.rollback();
        logger.error(`Periodic sync failed for ${steamId}: ${error.message}`, error.stack);
        throw error;
    }
}

/**
 * Handle player disconnect - sync player data, tracking data, and release lock
 *
 * @param {Object} data - Combined v2 format with tracking embedded
 * @param {Object} server - GameServer record
 * @returns {Promise<Object>} Disconnect result
 */
export async function handlePlayerDisconnect(data, server) {
    const models = getModels();
    const sequelize = databaseManager.getSequelize();
    // Combined format: full player JSON with tracking embedded
    const playerData = data;
    const trackingData = data.tracking || null;
    const steamId = playerData.steamId;
    const startTime = Date.now();

    // Validate player data
    const playerValidation = validateV2PlayerFormat(playerData);
    if (!playerValidation.valid) {
        logger.warn(`Invalid player data on disconnect from ${server.server_id} for ${steamId}`);
        return {
            success: false,
            error: 'validation_failed',
            errors: playerValidation.errors
        };
    }

    // Validate tracking data if provided
    if (trackingData) {
        const trackingValidation = validateV2TrackingFormat(trackingData);
        if (!trackingValidation.valid) {
            logger.warn(`Invalid tracking data on disconnect from ${server.server_id} for ${steamId}`);
            return {
                success: false,
                error: 'tracking_validation_failed',
                errors: trackingValidation.errors
            };
        }
    }

    const transaction = await sequelize.transaction();

    try {
        // Get current player
        const player = await models.Player.findWithFullData(steamId);

        if (!player) {
            await transaction.rollback();
            return {
                success: false,
                error: 'player_not_found'
            };
        }

        // Verify this server owns the player session
        if (player.active_server_id !== server.server_id) {
            await transaction.rollback();
            logger.warn(`Server ${server.server_id} tried to disconnect ${steamId} but ${player.active_server_id} owns session`);
            return {
                success: false,
                error: 'not_session_owner',
                activeServer: player.active_server_id
            };
        }

        // Validate sync sequence
        const seqValidation = validateSyncSequence(Number(player.sync_seq), playerData.syncSeq);
        if (!seqValidation.valid) {
            await transaction.rollback();
            logger.warn(`Invalid syncSeq on disconnect from ${server.server_id} for ${steamId}: ${seqValidation.reason}`);
            return {
                success: false,
                error: 'invalid_sync_seq',
                reason: seqValidation.reason,
                expectedSeq: Number(player.sync_seq)
            };
        }

        // Get old data for delta check
        const oldPlayerData = dbToV2Player(player);

        // Check delta limits
        const deltaCheck = checkDeltaLimits(oldPlayerData, playerData);
        let flagged = false;
        let flagReason = null;

        if (!deltaCheck.valid) {
            flagged = true;
            flagReason = deltaCheck.violations.join('; ');
            logger.warn(`Delta violation on disconnect from ${server.server_id} for ${steamId}: ${flagReason}`);
        }

        // === Sync player data ===
        const dbParts = v2PlayerToDbParts(playerData);

        await player.update({
            eos_id: dbParts.player.eos_id || player.eos_id,
            name: dbParts.player.name || player.name,
            sync_seq: playerData.syncSeq
        }, { transaction });

        if (dbParts.stats) {
            await models.PlayerStats.upsert({
                player_id: player.id,
                ...dbParts.stats
            }, { transaction });
        }

        if (dbParts.skins) {
            await models.PlayerSkin.upsert({
                player_id: player.id,
                ...dbParts.skins
            }, { transaction });
        }

        if (dbParts.supporterStatus) {
            await models.PlayerSupporterStatus.upsert({
                player_id: player.id,
                ...dbParts.supporterStatus
            }, { transaction });
        }

        await models.LoadoutSlot.destroy({ where: { player_id: player.id }, transaction });
        for (const slot of dbParts.loadout) {
            await models.LoadoutSlot.create({
                player_id: player.id,
                ...slot
            }, { transaction });
        }

        await models.PlayerPerk.destroy({ where: { player_id: player.id }, transaction });
        for (const perk of dbParts.perks) {
            await models.PlayerPerk.create({
                player_id: player.id,
                ...perk
            }, { transaction });
        }

        for (const unlock of dbParts.permaUnlocks) {
            await models.PlayerPermanentUnlock.upsert({
                player_id: player.id,
                ...unlock
            }, { transaction });
        }

        // === Sync tracking data (only on disconnect) ===
        if (trackingData) {
            const trackingParts = v2TrackingToDbParts(trackingData);

            // Upsert rewards
            for (const reward of trackingParts.rewards) {
                await models.PlayerReward.upsert({
                    player_id: player.id,
                    ...reward
                }, { transaction });
            }

            // Upsert kills
            for (const kill of trackingParts.kills) {
                await models.PlayerKill.upsert({
                    killer_id: player.id,
                    ...kill
                }, { transaction });
            }

            // Upsert vehicle kills
            for (const vk of trackingParts.vehicleKills) {
                await models.PlayerVehicleKill.upsert({
                    player_id: player.id,
                    ...vk
                }, { transaction });
            }

            // Upsert purchases
            for (const purchase of trackingParts.purchases) {
                await models.PlayerPurchase.upsert({
                    player_id: player.id,
                    ...purchase
                }, { transaction });
            }

            // Upsert weapon xp
            for (const wxp of trackingParts.weaponXp) {
                await models.PlayerWeaponXp.upsert({
                    player_id: player.id,
                    ...wxp
                }, { transaction });
            }
        }

        // Clear active server lock
        await player.update({
            active_server_id: null,
            active_since: null
        }, { transaction });

        await transaction.commit();

        const duration = Date.now() - startTime;

        // Log disconnect
        await models.SyncAuditLog.logSync({
            serverId: server.server_id,
            playerSteamId: steamId,
            syncType: 'disconnect',
            syncSeqBefore: Number(player.sync_seq),
            syncSeqAfter: playerData.syncSeq,
            dataBefore: createDataSummary(oldPlayerData),
            dataAfter: createDataSummary(playerData),
            flagged,
            flagReason,
            durationMs: duration
        });

        logger.info(`Player disconnect: ${steamId} from ${server.server_id} (${duration}ms)${trackingData ? ' +tracking' : ''}${flagged ? ' [FLAGGED]' : ''}`);

        return {
            success: true,
            syncSeq: playerData.syncSeq,
            flagged
        };

    } catch (error) {
        await transaction.rollback();
        logger.error(`Disconnect failed for ${steamId}: ${error.message}`, error.stack);
        throw error;
    }
}

/**
 * Handle crash recovery sync - process orphaned player files
 *
 * @param {Object} data - Combined v2 format with tracking embedded
 * @param {Object} server - GameServer record
 * @returns {Promise<Object>} Recovery result
 */
export async function handleCrashRecovery(data, server) {
    const models = getModels();
    const sequelize = databaseManager.getSequelize();
    // Combined format: full player JSON with tracking embedded
    const playerData = data;
    const trackingData = data.tracking || null;
    const steamId = playerData.steamId;
    const startTime = Date.now();

    // Validate player data
    const playerValidation = validateV2PlayerFormat(playerData);
    if (!playerValidation.valid) {
        logger.warn(`Invalid crash recovery player data from ${server.server_id} for ${steamId}`);
        return {
            success: false,
            error: 'validation_failed',
            errors: playerValidation.errors
        };
    }

    // Validate tracking data if provided
    if (trackingData) {
        const trackingValidation = validateV2TrackingFormat(trackingData);
        if (!trackingValidation.valid) {
            logger.warn(`Invalid crash recovery tracking data from ${server.server_id} for ${steamId}`);
            return {
                success: false,
                error: 'tracking_validation_failed',
                errors: trackingValidation.errors
            };
        }
    }

    try {
        // Get current player data
        const player = await models.Player.findWithFullData(steamId);

        if (!player) {
            logger.warn(`Crash recovery for unknown player: ${steamId}`);
            return {
                success: false,
                error: 'player_not_found'
            };
        }

        // For crash recovery, we're more lenient with sequence numbers
        const seqValidation = validateSyncSequence(Number(player.sync_seq), playerData.syncSeq, 100);
        let flagged = false;
        let flagReason = null;

        if (!seqValidation.valid) {
            flagged = true;
            flagReason = `Crash recovery seq mismatch: ${seqValidation.reason}`;
        }

        // Check delta limits
        const oldPlayerData = dbToV2Player(player);
        const deltaCheck = checkDeltaLimits(oldPlayerData, playerData);

        if (!deltaCheck.valid) {
            flagged = true;
            flagReason = (flagReason ? flagReason + '; ' : '') + deltaCheck.violations.join('; ');
        }

        // If the recovered data is older than DB, skip it
        if (playerData.syncSeq < Number(player.sync_seq)) {
            logger.info(`Crash recovery skipped for ${steamId}: recovered seq ${playerData.syncSeq} < db seq ${player.sync_seq}`);
            return {
                success: true,
                skipped: true,
                reason: 'stale_data'
            };
        }

        // Clear active server (the crash implies the old session is dead)
        await player.clearActiveServer();

        const transaction = await sequelize.transaction();

        try {
            // === Sync player data ===
            const dbParts = v2PlayerToDbParts(playerData);

            await player.update({
                eos_id: dbParts.player.eos_id || player.eos_id,
                name: dbParts.player.name || player.name,
                sync_seq: playerData.syncSeq
            }, { transaction });

            if (dbParts.stats) {
                await models.PlayerStats.upsert({
                    player_id: player.id,
                    ...dbParts.stats
                }, { transaction });
            }

            if (dbParts.skins) {
                await models.PlayerSkin.upsert({
                    player_id: player.id,
                    ...dbParts.skins
                }, { transaction });
            }

            if (dbParts.supporterStatus) {
                await models.PlayerSupporterStatus.upsert({
                    player_id: player.id,
                    ...dbParts.supporterStatus
                }, { transaction });
            }

            await models.LoadoutSlot.destroy({ where: { player_id: player.id }, transaction });
            for (const slot of dbParts.loadout) {
                await models.LoadoutSlot.create({
                    player_id: player.id,
                    ...slot
                }, { transaction });
            }

            await models.PlayerPerk.destroy({ where: { player_id: player.id }, transaction });
            for (const perk of dbParts.perks) {
                await models.PlayerPerk.create({
                    player_id: player.id,
                    ...perk
                }, { transaction });
            }

            for (const unlock of dbParts.permaUnlocks) {
                await models.PlayerPermanentUnlock.upsert({
                    player_id: player.id,
                    ...unlock
                }, { transaction });
            }

            // === Sync tracking data if provided ===
            if (trackingData) {
                const trackingParts = v2TrackingToDbParts(trackingData);

                for (const reward of trackingParts.rewards) {
                    await models.PlayerReward.upsert({
                        player_id: player.id,
                        ...reward
                    }, { transaction });
                }

                for (const kill of trackingParts.kills) {
                    await models.PlayerKill.upsert({
                        killer_id: player.id,
                        ...kill
                    }, { transaction });
                }

                for (const vk of trackingParts.vehicleKills) {
                    await models.PlayerVehicleKill.upsert({
                        player_id: player.id,
                        ...vk
                    }, { transaction });
                }

                for (const purchase of trackingParts.purchases) {
                    await models.PlayerPurchase.upsert({
                        player_id: player.id,
                        ...purchase
                    }, { transaction });
                }

                for (const wxp of trackingParts.weaponXp) {
                    await models.PlayerWeaponXp.upsert({
                        player_id: player.id,
                        ...wxp
                    }, { transaction });
                }
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        const duration = Date.now() - startTime;

        // Log crash recovery
        await models.SyncAuditLog.logSync({
            serverId: server.server_id,
            playerSteamId: steamId,
            syncType: 'crash_recovery',
            syncSeqBefore: Number(player.sync_seq),
            syncSeqAfter: playerData.syncSeq,
            dataBefore: createDataSummary(oldPlayerData),
            dataAfter: createDataSummary(playerData),
            flagged,
            flagReason,
            durationMs: duration
        });

        logger.info(`Crash recovery: ${steamId} (${duration}ms)${trackingData ? ' +tracking' : ''}${flagged ? ' [FLAGGED]' : ''}`);

        return {
            success: true,
            syncSeq: playerData.syncSeq,
            flagged
        };

    } catch (error) {
        logger.error(`Crash recovery failed for ${steamId}: ${error.message}`, error.stack);
        throw error;
    }
}

/**
 * Get player data by Steam ID in v2 format
 *
 * @param {string} steamId - Player's Steam ID
 * @returns {Promise<Object|null>} Player data in v2 format or null
 */
export async function getPlayerBySteamId(steamId) {
    const models = getModels();
    const player = await models.Player.findWithFullData(steamId);

    if (!player) {
        return null;
    }

    return dbToV2(player);
}

/**
 * Get player by Discord ID via discord_links
 *
 * @param {string} discordId - User's Discord ID
 * @returns {Promise<Object|null>} Player data in v2 format or null
 */
export async function getPlayerByDiscordId(discordId) {
    const models = getModels();

    const link = await models.DiscordLink.findOne({
        where: { discord_id: discordId, verified: true }
    });

    if (!link) {
        return null;
    }

    const player = await models.Player.findWithFullData(null, link.player_id);
    if (!player) {
        return null;
    }

    return dbToV2(player);
}

/**
 * Link a Discord account to a Steam player
 *
 * @param {string} discordId - Discord user ID
 * @param {string} steamId - Steam ID to link
 * @param {boolean} verified - Whether the link is verified
 * @returns {Promise<Object>} The created/updated link
 */
export async function linkDiscordAccount(discordId, steamId, verified = false) {
    const models = getModels();

    // Find or create the player
    let [player] = await models.Player.findOrCreate({
        where: { steam_id: steamId },
        defaults: { steam_id: steamId }
    });

    // Upsert the discord link
    const [link] = await models.DiscordLink.upsert({
        discord_id: discordId,
        player_id: player.id,
        verified: verified,
        verified_at: verified ? new Date() : null
    }, { returning: true });

    return link;
}

/**
 * Create a new player with default data
 *
 * @param {string} steamId - Player's Steam ID
 * @param {string} eosId - Player's EOS ID (optional)
 * @param {string} name - Player's name (optional)
 * @returns {Promise<Object>} Created player data in v2 format
 */
export async function createPlayer(steamId, eosId = null, name = null) {
    const models = getModels();

    const player = await models.Player.create({
        steam_id: steamId,
        eos_id: eosId,
        name: name,
        sync_seq: 0
    });

    // Create default stats
    await models.PlayerStats.create({
        player_id: player.id
    });

    // Reload with associations
    const fullPlayer = await models.Player.findWithFullData(steamId);
    return dbToV2(fullPlayer);
}

export default {
    validateServerToken,
    handlePlayerConnect,
    handlePeriodicSync,
    handlePlayerDisconnect,
    handleCrashRecovery,
    getPlayerBySteamId,
    getPlayerByDiscordId,
    linkDiscordAccount,
    createPlayer
};
