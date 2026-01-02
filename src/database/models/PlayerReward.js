import { DataTypes, Model } from 'sequelize';

export default function definePlayerReward(sequelize) {
    class PlayerReward extends Model {
        static associate(models) {
            PlayerReward.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }
    }

    PlayerReward.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false
        },
        reward_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'Kills, Revives, SupportKills, etc.'
        },
        count: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        sequelize,
        modelName: 'PlayerReward',
        tableName: 'player_rewards',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['player_id', 'reward_type']
            }
        ]
    });

    return PlayerReward;
}
