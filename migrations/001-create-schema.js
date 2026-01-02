import { DataTypes } from 'sequelize';

/**
 * KOTH Database Schema v2.0
 *
 * Complete schema for the KOTH player data sync system.
 * This is a fresh start - no backwards compatibility with v1.
 */

export async function up(queryInterface) {
    // ========================================
    // Game Servers (for token-based auth)
    // ========================================
    await queryInterface.createTable('game_servers', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        server_id: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            comment: 'Unique server identifier, e.g., "bb-koth-server-2"'
        },
        server_name: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        api_token: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
            comment: 'Randomly generated API token for authentication'
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        flagged: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        flagged_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        last_seen_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    // ========================================
    // Players (core identity)
    // ========================================
    await queryInterface.createTable('players', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        steam_id: {
            type: DataTypes.STRING(17),
            allowNull: false,
            unique: true
        },
        eos_id: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        sync_seq: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
            comment: 'Monotonic sequence number for sync conflict resolution'
        },
        active_server_id: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'Server ID where player is currently connected'
        },
        active_since: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When player connected to active server'
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('players', ['active_server_id']);

    // ========================================
    // Player Stats (1:1 with player)
    // ========================================
    await queryInterface.createTable('player_stats', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            unique: true,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
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
            defaultValue: 0,
            comment: '0-100 range'
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
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    // ========================================
    // Player Skins (1:1 with player)
    // ========================================
    await queryInterface.createTable('player_skins', {
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
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
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    // ========================================
    // Player Supporter Status (1:1 with player)
    // ========================================
    await queryInterface.createTable('player_supporter_status', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            unique: true,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        status_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'vip, supporter, patron, etc.'
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'null for permanent'
        },
        granted_by: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'manual, patreon, nitro, etc.'
        },
        granted_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    // ========================================
    // Loadout Slots (1:many, allows duplicates)
    // ========================================
    await queryInterface.createTable('loadout_slots', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
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
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('loadout_slots', ['player_id']);

    // ========================================
    // Player Perks (1:many with unique constraint)
    // ========================================
    await queryInterface.createTable('player_perks', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        perk_name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('player_perks', ['player_id', 'perk_name'], { unique: true });

    // ========================================
    // Player Permanent Unlocks (1:many with unique constraint)
    // ========================================
    await queryInterface.createTable('player_permanent_unlocks', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        weapon_name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        unlocked_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('player_permanent_unlocks', ['player_id', 'weapon_name'], { unique: true });

    // ========================================
    // Player Rewards (1:many with unique constraint)
    // ========================================
    await queryInterface.createTable('player_rewards', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        reward_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'daily, achievement, etc.'
        },
        count: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('player_rewards', ['player_id', 'reward_type'], { unique: true });

    // ========================================
    // Player Kills (1:many with unique constraint)
    // ========================================
    await queryInterface.createTable('player_kills', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        killer_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        victim_steam_id: {
            type: DataTypes.STRING(17),
            allowNull: false
        },
        count: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('player_kills', ['killer_id', 'victim_steam_id'], { unique: true });

    // ========================================
    // Player Vehicle Kills (1:many with unique constraint)
    // ========================================
    await queryInterface.createTable('player_vehicle_kills', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        vehicle_name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        count: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('player_vehicle_kills', ['player_id', 'vehicle_name'], { unique: true });

    // ========================================
    // Player Purchases (1:many with unique constraint)
    // ========================================
    await queryInterface.createTable('player_purchases', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        item_name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        count: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 1
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('player_purchases', ['player_id', 'item_name'], { unique: true });

    // ========================================
    // Player Weapon XP (1:many with unique constraint)
    // ========================================
    await queryInterface.createTable('player_weapon_xp', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        weapon_name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        xp: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('player_weapon_xp', ['player_id', 'weapon_name'], { unique: true });

    // ========================================
    // Discord Links (for Discord integration)
    // ========================================
    await queryInterface.createTable('discord_links', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        player_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: 'players', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        discord_id: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true
        },
        discord_username: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        linked_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('discord_links', ['player_id']);

    // ========================================
    // Sync Audit Log (for monitoring and flagging)
    // ========================================
    await queryInterface.createTable('sync_audit_log', {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true
        },
        server_id: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        player_steam_id: {
            type: DataTypes.STRING(17),
            allowNull: false
        },
        sync_type: {
            type: DataTypes.ENUM('connect', 'periodic', 'disconnect', 'crash_recovery'),
            allowNull: false
        },
        sync_seq_before: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true
        },
        sync_seq_after: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true
        },
        data_before: {
            type: DataTypes.JSON,
            allowNull: true
        },
        data_after: {
            type: DataTypes.JSON,
            allowNull: true
        },
        flagged: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        flag_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        duration_ms: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            comment: 'How long the sync took'
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    });

    await queryInterface.addIndex('sync_audit_log', ['server_id']);
    await queryInterface.addIndex('sync_audit_log', ['player_steam_id']);
    await queryInterface.addIndex('sync_audit_log', ['flagged']);
    await queryInterface.addIndex('sync_audit_log', ['created_at']);
}

export async function down(queryInterface) {
    // Drop tables in reverse order of creation (respecting foreign keys)
    await queryInterface.dropTable('sync_audit_log');
    await queryInterface.dropTable('discord_links');
    await queryInterface.dropTable('player_weapon_xp');
    await queryInterface.dropTable('player_purchases');
    await queryInterface.dropTable('player_vehicle_kills');
    await queryInterface.dropTable('player_kills');
    await queryInterface.dropTable('player_rewards');
    await queryInterface.dropTable('player_permanent_unlocks');
    await queryInterface.dropTable('player_perks');
    await queryInterface.dropTable('loadout_slots');
    await queryInterface.dropTable('player_supporter_status');
    await queryInterface.dropTable('player_skins');
    await queryInterface.dropTable('player_stats');
    await queryInterface.dropTable('players');
    await queryInterface.dropTable('game_servers');
}
