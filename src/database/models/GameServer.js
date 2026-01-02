import { DataTypes, Model } from 'sequelize';
import crypto from 'crypto';

export default function defineGameServer(sequelize) {
    class GameServer extends Model {
        /**
         * Generate a new random API token
         */
        static generateToken() {
            return crypto.randomBytes(32).toString('hex');
        }

        /**
         * Find a server by its API token
         */
        static async findByToken(token) {
            return GameServer.findOne({
                where: { api_token: token, is_active: true }
            });
        }

        /**
         * Register a new game server
         */
        static async register(serverId, serverName = null) {
            const token = GameServer.generateToken();
            return GameServer.create({
                server_id: serverId,
                server_name: serverName,
                api_token: token
            });
        }

        /**
         * Update last seen timestamp
         */
        async touch() {
            this.last_seen_at = new Date();
            return this.save();
        }

        /**
         * Flag this server for review
         */
        async flag(reason) {
            this.flagged = true;
            this.flagged_reason = reason;
            return this.save();
        }

        /**
         * Clear flag
         */
        async clearFlag() {
            this.flagged = false;
            this.flagged_reason = null;
            return this.save();
        }

        /**
         * Regenerate API token (invalidates old token)
         */
        async regenerateToken() {
            this.api_token = GameServer.generateToken();
            return this.save();
        }

        /**
         * Deactivate server (revoke access)
         */
        async deactivate() {
            this.is_active = false;
            return this.save();
        }

        /**
         * Reactivate server
         */
        async activate() {
            this.is_active = true;
            return this.save();
        }
    }

    GameServer.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        server_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },
        server_name: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        api_token: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        flagged: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        flagged_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        last_seen_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'GameServer',
        tableName: 'game_servers',
        timestamps: true,
        underscored: true
    });

    return GameServer;
}
