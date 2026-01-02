import { DataTypes, Model } from 'sequelize';

export default function definePlayerSupporterStatus(sequelize) {
    class PlayerSupporterStatus extends Model {
        static associate(models) {
            PlayerSupporterStatus.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }

        isActive() {
            if (!this.expires_at) return true; // Permanent supporter
            return new Date() < this.expires_at;
        }
    }

    PlayerSupporterStatus.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            unique: true
        },
        status_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'supporter, vip, patron, etc.'
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'null for permanent'
        },
        granted_by: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'manual, patreon, nitro, etc.'
        },
        granted_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        sequelize,
        modelName: 'PlayerSupporterStatus',
        tableName: 'player_supporter_status',
        timestamps: true,
        underscored: true
    });

    return PlayerSupporterStatus;
}
