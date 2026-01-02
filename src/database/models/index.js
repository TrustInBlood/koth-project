import databaseManager from '../index.js';
import { defineUser } from './User.js';
import definePlayer from './Player.js';
import definePlayerStats from './PlayerStats.js';
import defineDiscordLink from './DiscordLink.js';
import definePlayerSkin from './PlayerSkin.js';
import definePlayerSupporterStatus from './PlayerSupporterStatus.js';
import defineLoadoutSlot from './LoadoutSlot.js';
import definePlayerPerk from './PlayerPerk.js';
import definePlayerPermanentUnlock from './PlayerPermanentUnlock.js';
import definePlayerReward from './PlayerReward.js';
import definePlayerKill from './PlayerKill.js';
import definePlayerVehicleKill from './PlayerVehicleKill.js';
import definePlayerPurchase from './PlayerPurchase.js';
import definePlayerWeaponXp from './PlayerWeaponXp.js';
import defineGameServer from './GameServer.js';
import defineSyncAuditLog from './SyncAuditLog.js';
import { createServiceLogger } from '../../utils/logger.js';

const logger = createServiceLogger('Models');

/**
 * Initialize all models and set up associations
 * Must be called after database connection is established
 */
export async function initializeModels() {
    const sequelize = databaseManager.getSequelize();

    if (!sequelize) {
        throw new Error('Database not initialized. Call databaseManager.initialize() first.');
    }

    logger.info('Initializing models...');

    // Register dashboard models
    const User = databaseManager.registerModel('User', defineUser);

    // Register game server model
    const GameServer = databaseManager.registerModel('GameServer', defineGameServer);

    // Register KOTH player models
    const Player = databaseManager.registerModel('Player', definePlayer);
    const PlayerStats = databaseManager.registerModel('PlayerStats', definePlayerStats);
    const DiscordLink = databaseManager.registerModel('DiscordLink', defineDiscordLink);
    const PlayerSkin = databaseManager.registerModel('PlayerSkin', definePlayerSkin);
    const PlayerSupporterStatus = databaseManager.registerModel('PlayerSupporterStatus', definePlayerSupporterStatus);
    const LoadoutSlot = databaseManager.registerModel('LoadoutSlot', defineLoadoutSlot);
    const PlayerPerk = databaseManager.registerModel('PlayerPerk', definePlayerPerk);
    const PlayerPermanentUnlock = databaseManager.registerModel('PlayerPermanentUnlock', definePlayerPermanentUnlock);
    const PlayerReward = databaseManager.registerModel('PlayerReward', definePlayerReward);
    const PlayerKill = databaseManager.registerModel('PlayerKill', definePlayerKill);
    const PlayerVehicleKill = databaseManager.registerModel('PlayerVehicleKill', definePlayerVehicleKill);
    const PlayerPurchase = databaseManager.registerModel('PlayerPurchase', definePlayerPurchase);
    const PlayerWeaponXp = databaseManager.registerModel('PlayerWeaponXp', definePlayerWeaponXp);

    // Register audit log model
    const SyncAuditLog = databaseManager.registerModel('SyncAuditLog', defineSyncAuditLog);

    // Collect all models for association setup
    const models = {
        User,
        GameServer,
        Player,
        PlayerStats,
        DiscordLink,
        PlayerSkin,
        PlayerSupporterStatus,
        LoadoutSlot,
        PlayerPerk,
        PlayerPermanentUnlock,
        PlayerReward,
        PlayerKill,
        PlayerVehicleKill,
        PlayerPurchase,
        PlayerWeaponXp,
        SyncAuditLog
    };

    // Set up associations
    Object.values(models).forEach(model => {
        if (model.associate) {
            model.associate(models);
        }
    });

    logger.info('Models initialized successfully');

    return models;
}

/**
 * Get all registered models
 * @returns {Object}
 */
export function getModels() {
    return {
        User: databaseManager.getModel('User'),
        GameServer: databaseManager.getModel('GameServer'),
        Player: databaseManager.getModel('Player'),
        PlayerStats: databaseManager.getModel('PlayerStats'),
        DiscordLink: databaseManager.getModel('DiscordLink'),
        PlayerSkin: databaseManager.getModel('PlayerSkin'),
        PlayerSupporterStatus: databaseManager.getModel('PlayerSupporterStatus'),
        LoadoutSlot: databaseManager.getModel('LoadoutSlot'),
        PlayerPerk: databaseManager.getModel('PlayerPerk'),
        PlayerPermanentUnlock: databaseManager.getModel('PlayerPermanentUnlock'),
        PlayerReward: databaseManager.getModel('PlayerReward'),
        PlayerKill: databaseManager.getModel('PlayerKill'),
        PlayerVehicleKill: databaseManager.getModel('PlayerVehicleKill'),
        PlayerPurchase: databaseManager.getModel('PlayerPurchase'),
        PlayerWeaponXp: databaseManager.getModel('PlayerWeaponXp'),
        SyncAuditLog: databaseManager.getModel('SyncAuditLog')
    };
}

export default {
    initializeModels,
    getModels
};
