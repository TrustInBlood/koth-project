import { DataTypes } from 'sequelize';

/**
 * User model definition
 * Stores Discord user information and application-specific data
 */
export function defineUser(sequelize) {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            allowNull: false,
            comment: 'Discord user ID'
        },
        username: {
            type: DataTypes.STRING(32),
            allowNull: false,
            comment: 'Discord username'
        },
        discriminator: {
            type: DataTypes.STRING(4),
            allowNull: true,
            comment: 'Discord discriminator (legacy, may be null for new usernames)'
        },
        avatar: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'Discord avatar hash'
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'User email from Discord OAuth'
        },
        accessToken: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'access_token',
            comment: 'Discord OAuth access token'
        },
        refreshToken: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'refresh_token',
            comment: 'Discord OAuth refresh token'
        },
        isAdmin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_admin',
            comment: 'Application admin flag'
        },
        isBanned: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'is_banned',
            comment: 'User ban status'
        },
        lastLogin: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_login',
            comment: 'Last dashboard login timestamp'
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: {},
            comment: 'Additional user metadata'
        }
    }, {
        tableName: 'users',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                fields: ['username']
            },
            {
                fields: ['is_banned']
            }
        ]
    });

    /**
     * Get the user's display name
     * @returns {string}
     */
    User.prototype.getDisplayName = function() {
        if (this.discriminator && this.discriminator !== '0') {
            return `${this.username}#${this.discriminator}`;
        }
        return this.username;
    };

    /**
     * Get the user's avatar URL
     * @param {number} [size=128] - Avatar size
     * @returns {string}
     */
    User.prototype.getAvatarUrl = function(size = 128) {
        if (this.avatar) {
            const ext = this.avatar.startsWith('a_') ? 'gif' : 'png';
            return `https://cdn.discordapp.com/avatars/${this.id}/${this.avatar}.${ext}?size=${size}`;
        }
        // Default avatar based on discriminator or user ID
        const defaultIndex = this.discriminator
            ? parseInt(this.discriminator) % 5
            : (BigInt(this.id) >> 22n) % 6n;
        return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    };

    /**
     * Update user from Discord profile data
     * @param {Object} profile - Discord profile data
     * @returns {Promise<User>}
     */
    User.prototype.updateFromDiscord = async function(profile) {
        this.username = profile.username;
        this.discriminator = profile.discriminator || null;
        this.avatar = profile.avatar || null;
        if (profile.email) {
            this.email = profile.email;
        }
        this.lastLogin = new Date();
        await this.save();
        return this;
    };

    return User;
}

export default defineUser;
