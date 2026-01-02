import { DataTypes, Model } from 'sequelize';

export default function definePlayerWeaponXp(sequelize) {
    class PlayerWeaponXp extends Model {
        static associate(models) {
            PlayerWeaponXp.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }
    }

    PlayerWeaponXp.init({
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
        xp: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        sequelize,
        modelName: 'PlayerWeaponXp',
        tableName: 'player_weapon_xp',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['player_id', 'weapon_name']
            }
        ]
    });

    return PlayerWeaponXp;
}
