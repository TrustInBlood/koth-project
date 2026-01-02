import { DataTypes, Model } from 'sequelize';

export default function definePlayerStats(sequelize) {
    class PlayerStats extends Model {
        static associate(models) {
            PlayerStats.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }
    }

    PlayerStats.init({
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
        currency: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        currency_total: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        currency_spent: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        xp: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        xp_total: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        prestige: {
            type: DataTypes.TINYINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        perma_tokens: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        daily_claims: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        games_played: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        time_played: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            comment: 'Total time played in seconds'
        },
        join_time: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'First time player joined'
        },
        daily_claim_time: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Last daily claim timestamp'
        }
    }, {
        sequelize,
        modelName: 'PlayerStats',
        tableName: 'player_stats',
        timestamps: true,
        underscored: true
    });

    return PlayerStats;
}
