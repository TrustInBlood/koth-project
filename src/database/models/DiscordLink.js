import { DataTypes, Model } from 'sequelize';

export default function defineDiscordLink(sequelize) {
    class DiscordLink extends Model {
        static associate(models) {
            DiscordLink.belongsTo(models.Player, { foreignKey: 'player_id', as: 'player' });
        }
    }

    DiscordLink.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        discord_id: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false
        },
        verified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        linked_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        verified_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'DiscordLink',
        tableName: 'discord_links',
        timestamps: true,
        underscored: true
    });

    return DiscordLink;
}
