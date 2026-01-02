import { DataTypes, Model } from 'sequelize';

export default function definePlayerVehicleKill(sequelize) {
    class PlayerVehicleKill extends Model {
        static associate(models) {
            PlayerVehicleKill.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }
    }

    PlayerVehicleKill.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false
        },
        vehicle_name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        count: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1
        }
    }, {
        sequelize,
        modelName: 'PlayerVehicleKill',
        tableName: 'player_vehicle_kills',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['player_id', 'vehicle_name']
            }
        ]
    });

    return PlayerVehicleKill;
}
