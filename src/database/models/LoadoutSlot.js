import { DataTypes, Model } from 'sequelize';

export default function defineLoadoutSlot(sequelize) {
    class LoadoutSlot extends Model {
        static associate(models) {
            LoadoutSlot.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }
    }

    LoadoutSlot.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false
        },
        slot: {
            type: DataTypes.TINYINT.UNSIGNED,
            allowNull: false
        },
        family: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'Rifle, Pistol, Launcher, etc.'
        },
        item: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Full item path, e.g., /Game/Weapons/AK47'
        },
        count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        }
    }, {
        sequelize,
        modelName: 'LoadoutSlot',
        tableName: 'loadout_slots',
        timestamps: true,
        underscored: true
        // Note: No unique constraint - game allows duplicate items in different slots
    });

    return LoadoutSlot;
}
