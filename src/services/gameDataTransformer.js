import { createServiceLogger } from '../utils/logger.js';

const logger = createServiceLogger('GameDataTransformer');

/**
 * Transform database player record (with associations) to v2 JSON format.
 *
 * @param {Object} player - Sequelize Player instance with associations
 * @returns {Object} Player data in v2 JSON format
 */
export function dbToV2(player) {
    if (!player) return null;

    const data = {
        v: 2,
        steamId: player.steam_id,
        eosId: player.eos_id || null,
        name: player.name || null,
        serverId: player.active_server_id || null,
        lastSync: player.updated_at?.toISOString() || new Date().toISOString(),
        syncSeq: Number(player.sync_seq) || 0
    };

    // Stats
    if (player.stats) {
        data.stats = {
            currency: player.stats.currency || 0,
            currencyTotal: Number(player.stats.currency_total) || 0,
            currencySpent: Number(player.stats.currency_spent) || 0,
            xp: player.stats.xp || 0,
            xpTotal: Number(player.stats.xp_total) || 0,
            prestige: player.stats.prestige || 0,
            permaTokens: player.stats.perma_tokens || 0,
            dailyClaims: player.stats.daily_claims || 0,
            gamesPlayed: player.stats.games_played || 0,
            timePlayed: Number(player.stats.time_played) || 0,
            joinTime: player.stats.join_time?.toISOString() || null,
            dailyClaimTime: player.stats.daily_claim_time?.toISOString() || null
        };
    } else {
        data.stats = {
            currency: 0, currencyTotal: 0, currencySpent: 0,
            xp: 0, xpTotal: 0, prestige: 0, permaTokens: 0,
            dailyClaims: 0, gamesPlayed: 0, timePlayed: 0,
            joinTime: null, dailyClaimTime: null
        };
    }

    // Skins
    if (player.skins) {
        data.skins = {
            indfor: player.skins.indfor || null,
            blufor: player.skins.blufor || null,
            redfor: player.skins.redfor || null
        };
    } else {
        data.skins = { indfor: null, blufor: null, redfor: null };
    }

    // Loadout (array of slot objects)
    data.loadout = (player.loadout || []).map(slot => ({
        slot: slot.slot,
        family: slot.family || null,
        item: slot.item,
        count: slot.count || 1
    }));

    // Perks (array of strings)
    data.perks = (player.perks || []).map(p => p.perk_name);

    // Perma unlocks (array of strings)
    data.permaUnlocks = (player.permaUnlocks || []).map(u => u.weapon_name);

    // Supporter status (array of strings)
    if (player.supporterStatus) {
        data.supporterStatus = [player.supporterStatus.status_type];
    } else {
        data.supporterStatus = [];
    }

    // Tracking objects
    data.tracking = {
        kills: {},
        vehicleKills: {},
        purchases: {},
        weaponXp: {},
        rewards: {}
    };

    // Kills: { victimSteamId: count }
    for (const kill of (player.kills || [])) {
        data.tracking.kills[kill.victim_steam_id] = kill.count || 0;
    }

    // Vehicle kills: { vehicleName: count }
    for (const vk of (player.vehicleKills || [])) {
        data.tracking.vehicleKills[vk.vehicle_name] = vk.count || 0;
    }

    // Purchases: { itemName: count }
    for (const p of (player.purchases || [])) {
        data.tracking.purchases[p.item_name] = p.count || 0;
    }

    // Weapon XP: { weaponName: xp }
    for (const wx of (player.weaponXp || [])) {
        data.tracking.weaponXp[wx.weapon_name] = wx.xp || 0;
    }

    // Rewards: { rewardType: count }
    for (const r of (player.rewards || [])) {
        data.tracking.rewards[r.reward_type] = r.count || 0;
    }

    return data;
}

/**
 * Extract data from v2 format for database upsert operations.
 * Returns separate objects for each table.
 *
 * @param {Object} v2Data - Player data in v2 format
 * @returns {Object} Extracted data for each table
 */
export function v2ToDbParts(v2Data) {
    const result = {
        player: {
            steam_id: v2Data.steamId,
            eos_id: v2Data.eosId || null,
            name: v2Data.name || null,
            sync_seq: v2Data.syncSeq || 0
        },
        stats: null,
        skins: null,
        supporterStatus: null,
        loadout: [],
        perks: [],
        permaUnlocks: [],
        rewards: [],
        kills: [],
        vehicleKills: [],
        purchases: [],
        weaponXp: []
    };

    // Stats
    if (v2Data.stats) {
        result.stats = {
            currency: v2Data.stats.currency || 0,
            currency_total: v2Data.stats.currencyTotal || 0,
            currency_spent: v2Data.stats.currencySpent || 0,
            xp: v2Data.stats.xp || 0,
            xp_total: v2Data.stats.xpTotal || 0,
            prestige: v2Data.stats.prestige || 0,
            perma_tokens: v2Data.stats.permaTokens || 0,
            daily_claims: v2Data.stats.dailyClaims || 0,
            games_played: v2Data.stats.gamesPlayed || 0,
            time_played: v2Data.stats.timePlayed || 0,
            join_time: v2Data.stats.joinTime ? new Date(v2Data.stats.joinTime) : null,
            daily_claim_time: v2Data.stats.dailyClaimTime ? new Date(v2Data.stats.dailyClaimTime) : null
        };
    }

    // Skins
    if (v2Data.skins) {
        result.skins = {
            indfor: v2Data.skins.indfor || null,
            blufor: v2Data.skins.blufor || null,
            redfor: v2Data.skins.redfor || null
        };
    }

    // Supporter status (convert array to single record)
    if (v2Data.supporterStatus && v2Data.supporterStatus.length > 0) {
        result.supporterStatus = {
            status_type: v2Data.supporterStatus[0]
        };
    }

    // Loadout (array of slot objects)
    if (Array.isArray(v2Data.loadout)) {
        result.loadout = v2Data.loadout.map(slot => ({
            slot: slot.slot,
            family: slot.family || null,
            item: slot.item,
            count: slot.count || 1
        }));
    }

    // Perks (array of strings)
    if (Array.isArray(v2Data.perks)) {
        result.perks = v2Data.perks.map(perkName => ({
            perk_name: perkName
        }));
    }

    // Perma unlocks (array of strings)
    if (Array.isArray(v2Data.permaUnlocks)) {
        result.permaUnlocks = v2Data.permaUnlocks.map(weaponName => ({
            weapon_name: weaponName
        }));
    }

    // Tracking objects
    if (v2Data.tracking) {
        // Kills
        if (v2Data.tracking.kills) {
            for (const [victimSteamId, count] of Object.entries(v2Data.tracking.kills)) {
                result.kills.push({
                    victim_steam_id: victimSteamId,
                    count: count || 0
                });
            }
        }

        // Vehicle kills
        if (v2Data.tracking.vehicleKills) {
            for (const [vehicleName, count] of Object.entries(v2Data.tracking.vehicleKills)) {
                result.vehicleKills.push({
                    vehicle_name: vehicleName,
                    count: count || 0
                });
            }
        }

        // Purchases
        if (v2Data.tracking.purchases) {
            for (const [itemName, count] of Object.entries(v2Data.tracking.purchases)) {
                result.purchases.push({
                    item_name: itemName,
                    count: count || 0
                });
            }
        }

        // Weapon XP
        if (v2Data.tracking.weaponXp) {
            for (const [weaponName, xp] of Object.entries(v2Data.tracking.weaponXp)) {
                result.weaponXp.push({
                    weapon_name: weaponName,
                    xp: xp || 0
                });
            }
        }

        // Rewards
        if (v2Data.tracking.rewards) {
            for (const [rewardType, count] of Object.entries(v2Data.tracking.rewards)) {
                result.rewards.push({
                    reward_type: rewardType,
                    count: count || 0
                });
            }
        }
    }

    return result;
}

/**
 * Create a summary of player data for logging/audit.
 *
 * @param {Object} v2Data - Player data in v2 format
 * @returns {Object} Summary with key stats
 */
export function createDataSummary(v2Data) {
    if (!v2Data) return null;

    return {
        steamId: v2Data.steamId,
        syncSeq: v2Data.syncSeq,
        currency: v2Data.stats?.currency || 0,
        xp: v2Data.stats?.xp || 0,
        prestige: v2Data.stats?.prestige || 0,
        loadoutCount: v2Data.loadout?.length || 0,
        perksCount: v2Data.perks?.length || 0,
        permaUnlocksCount: v2Data.permaUnlocks?.length || 0
    };
}

export default {
    dbToV2,
    v2ToDbParts,
    createDataSummary
};
