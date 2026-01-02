import { DataTypes, Model } from 'sequelize';

export default function definePlayerSkin(sequelize) {
    class PlayerSkin extends Model {
        static associate(models) {
            PlayerSkin.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }
    }

    PlayerSkin.init({
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            allowNull: false
        },
        indfor: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        blufor: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        redfor: {
            type: DataTypes.STRING(100),
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'PlayerSkin',
        tableName: 'player_skins',
        timestamps: true,
        underscored: true
    });

    return PlayerSkin;
}
