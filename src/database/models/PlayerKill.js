import { DataTypes, Model } from 'sequelize';

export default function definePlayerKill(sequelize) {
    class PlayerKill extends Model {
        static associate(models) {
            PlayerKill.belongsTo(models.Player, { foreignKey: 'killer_id', as: 'killer' });
        }
    }

    PlayerKill.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        killer_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false
        },
        victim_steam_id: {
            type: DataTypes.STRING(17),
            allowNull: false
        },
        count: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1
        }
    }, {
        sequelize,
        modelName: 'PlayerKill',
        tableName: 'player_kills',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['killer_id', 'victim_steam_id']
            }
        ]
    });

    return PlayerKill;
}
