import { DataTypes, Model } from 'sequelize';

export default function definePlayerPurchase(sequelize) {
    class PlayerPurchase extends Model {
        static associate(models) {
            PlayerPurchase.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }
    }

    PlayerPurchase.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false
        },
        item_name: {
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
        modelName: 'PlayerPurchase',
        tableName: 'player_purchases',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['player_id', 'item_name']
            }
        ]
    });

    return PlayerPurchase;
}
