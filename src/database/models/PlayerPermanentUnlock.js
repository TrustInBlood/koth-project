import { DataTypes, Model } from 'sequelize';

export default function definePlayerPermanentUnlock(sequelize) {
    class PlayerPermanentUnlock extends Model {
        static associate(models) {
            PlayerPermanentUnlock.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }
    }

    PlayerPermanentUnlock.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false
        },
        weapon_name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        unlocked_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        sequelize,
        modelName: 'PlayerPermanentUnlock',
        tableName: 'player_permanent_unlocks',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['player_id', 'weapon_name']
            }
        ]
    });

    return PlayerPermanentUnlock;
}
