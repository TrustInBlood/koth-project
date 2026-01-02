import { DataTypes, Model } from 'sequelize';

export default function defineSyncAuditLog(sequelize) {
    class SyncAuditLog extends Model {
        /**
         * Log a sync event
         */
        static async logSync({
            serverId,
            playerSteamId,
            syncType,
            syncSeqBefore = null,
            syncSeqAfter = null,
            dataBefore = null,
            dataAfter = null,
            flagged = false,
            flagReason = null,
            durationMs = null
        }) {
            return SyncAuditLog.create({
                server_id: serverId,
                player_steam_id: playerSteamId,
                sync_type: syncType,
                sync_seq_before: syncSeqBefore,
                sync_seq_after: syncSeqAfter,
                data_before: dataBefore,
                data_after: dataAfter,
                flagged,
                flag_reason: flagReason,
                duration_ms: durationMs
            });
        }

        /**
         * Get flagged entries for review
         */
        static async getFlagged({ limit = 50, offset = 0 } = {}) {
            return SyncAuditLog.findAndCountAll({
                where: { flagged: true },
                order: [['created_at', 'DESC']],
                limit,
                offset
            });
        }

        /**
         * Get recent syncs for a player
         */
        static async getPlayerHistory(steamId, { limit = 20 } = {}) {
            return SyncAuditLog.findAll({
                where: { player_steam_id: steamId },
                order: [['created_at', 'DESC']],
                limit
            });
        }

        /**
         * Get recent syncs for a server
         */
        static async getServerHistory(serverId, { limit = 50 } = {}) {
            return SyncAuditLog.findAll({
                where: { server_id: serverId },
                order: [['created_at', 'DESC']],
                limit
            });
        }
    }

    SyncAuditLog.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        server_id: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        player_steam_id: {
            type: DataTypes.STRING(17),
            allowNull: false
        },
        sync_type: {
            type: DataTypes.ENUM('connect', 'periodic', 'disconnect', 'crash_recovery'),
            allowNull: false
        },
        sync_seq_before: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true
        },
        sync_seq_after: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true
        },
        data_before: {
            type: DataTypes.JSON,
            allowNull: true
        },
        data_after: {
            type: DataTypes.JSON,
            allowNull: true
        },
        flagged: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        flag_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        duration_ms: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'SyncAuditLog',
        tableName: 'sync_audit_log',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false, // No updated_at for audit logs
        underscored: true
    });

    return SyncAuditLog;
}
