import { DataTypes, Model, Op } from 'sequelize';

export default function definePlayer(sequelize) {
    class Player extends Model {
        static associate(models) {
            Player.hasOne(models.PlayerStats, { foreignKey: 'player_id', as: 'stats' });
            Player.hasOne(models.PlayerSkin, { foreignKey: 'player_id', as: 'skins' });
            Player.hasOne(models.PlayerSupporterStatus, { foreignKey: 'player_id', as: 'supporterStatus' });
            Player.hasMany(models.DiscordLink, { foreignKey: 'player_id', as: 'discordLinks' });
            Player.hasMany(models.LoadoutSlot, { foreignKey: 'player_id', as: 'loadout' });
            Player.hasMany(models.PlayerPerk, { foreignKey: 'player_id', as: 'perks' });
            Player.hasMany(models.PlayerPermanentUnlock, { foreignKey: 'player_id', as: 'permaUnlocks' });
            Player.hasMany(models.PlayerReward, { foreignKey: 'player_id', as: 'rewards' });
            Player.hasMany(models.PlayerKill, { foreignKey: 'killer_id', as: 'kills' });
            Player.hasMany(models.PlayerVehicleKill, { foreignKey: 'player_id', as: 'vehicleKills' });
            Player.hasMany(models.PlayerPurchase, { foreignKey: 'player_id', as: 'purchases' });
            Player.hasMany(models.PlayerWeaponXp, { foreignKey: 'player_id', as: 'weaponXp' });
        }

        /**
         * Check if player is currently active on any server
         */
        isActive() {
            return this.active_server_id !== null;
        }

        /**
         * Check if player is active on a specific server
         */
        isActiveOn(serverId) {
            return this.active_server_id === serverId;
        }

        /**
         * Check if player was recently active (for server-hop detection)
         * @param {number} windowMs - Time window in milliseconds (default 30 seconds)
         */
        wasRecentlyActive(windowMs = 30000) {
            if (!this.active_server_id || !this.active_since) return false;
            const elapsed = Date.now() - new Date(this.active_since).getTime();
            return elapsed < windowMs;
        }

        /**
         * Mark player as active on a server
         */
        async setActiveServer(serverId) {
            this.active_server_id = serverId;
            this.active_since = new Date();
            return this.save();
        }

        /**
         * Clear active server (player disconnected)
         */
        async clearActiveServer() {
            this.active_server_id = null;
            this.active_since = null;
            return this.save();
        }

        /**
         * Increment sync sequence and return new value
         */
        async incrementSyncSeq() {
            this.sync_seq = (this.sync_seq || 0) + 1;
            await this.save();
            return this.sync_seq;
        }

        /**
         * Find player with all associations for game data
         * @param {string|null} steamId - Steam ID to search by
         * @param {number|null} playerId - Player ID to search by (if steamId is null)
         */
        static async findWithFullData(steamId, playerId = null) {
            const where = steamId ? { steam_id: steamId } : { id: playerId };
            return Player.findOne({
                where,
                include: [
                    { association: 'stats' },
                    { association: 'skins' },
                    { association: 'supporterStatus' },
                    { association: 'loadout' },
                    { association: 'perks' },
                    { association: 'permaUnlocks' },
                    { association: 'rewards' },
                    { association: 'kills' },
                    { association: 'vehicleKills' },
                    { association: 'purchases' },
                    { association: 'weaponXp' }
                ]
            });
        }

        /**
         * Find or create a player by Steam ID
         */
        static async findOrCreateBySteamId(steamId, defaults = {}) {
            const [player, created] = await Player.findOrCreate({
                where: { steam_id: steamId },
                defaults: {
                    steam_id: steamId,
                    ...defaults
                }
            });
            return { player, created };
        }

        /**
         * Get players currently active on a server
         */
        static async getActivePlayers(serverId) {
            return Player.findAll({
                where: { active_server_id: serverId }
            });
        }

        /**
         * Clear all active players for a server (e.g., on server disconnect)
         */
        static async clearServerActivePlayers(serverId) {
            return Player.update(
                { active_server_id: null, active_since: null },
                { where: { active_server_id: serverId } }
            );
        }
    }

    Player.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        steam_id: {
            type: DataTypes.STRING(17),
            allowNull: false,
            unique: true
        },
        eos_id: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        sync_seq: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        active_server_id: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        active_since: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'Player',
        tableName: 'players',
        timestamps: true,
        underscored: true
    });

    return Player;
}
