import { DataTypes, Model } from 'sequelize';

export default function definePlayerPerk(sequelize) {
    class PlayerPerk extends Model {
        static associate(models) {
            PlayerPerk.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }
    }

    PlayerPerk.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false
        },
        perk_name: {
            type: DataTypes.STRING(50),
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'PlayerPerk',
        tableName: 'player_perks',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['player_id', 'perk_name']
            }
        ]
    });

    return PlayerPerk;
}
