import { createServiceLogger } from '../utils/logger.js';

const logger = createServiceLogger('DataValidator');

/**
 * Delta limits for anti-abuse detection.
 * These are the maximum changes allowed per sync.
 * If exceeded, the sync is flagged for review.
 */
export const DELTA_LIMITS = {
    currency: 50000,      // Max currency gain per sync
    currencySpent: 50000, // Max currency spent per sync
    xp: 100000,           // Max XP gain per sync
    prestige: 1,          // Max prestige gain per sync
    permaTokens: 10,      // Max perma tokens gain per sync
    timePlayed: 7200      // Max time played increase (2 hours in seconds)
};

/**
 * Validate a Steam ID.
 * @param {string} steamId - Steam ID to validate
 * @returns {{valid: boolean, steamId: string|null, error: string|null}}
 */
export function validateSteamId(steamId) {
    if (!steamId || typeof steamId !== 'string') {
        return { valid: false, steamId: null, error: 'Steam ID is required' };
    }

    const cleaned = steamId.trim();
    if (!/^\d{17}$/.test(cleaned)) {
        return { valid: false, steamId: null, error: 'Steam ID must be exactly 17 digits' };
    }

    return { valid: true, steamId: cleaned, error: null };
}

/**
 * Validate player data in v2 format.
 * Validates the core player structure (stats, skins, loadout, perks, etc.).
 * Tracking section (if present) is validated separately via validateV2TrackingFormat.
 *
 * @param {Object} data - Player data in v2 format
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateV2PlayerFormat(data) {
    const errors = [];

    // Check top-level structure
    if (!data || typeof data !== 'object') {
        errors.push('Data must be an object');
        return { valid: false, errors };
    }

    // Check version
    if (data.v !== 2) {
        errors.push(`Invalid version: expected 2, got ${data.v}`);
    }

    // Validate Steam ID (required)
    const steamIdResult = validateSteamId(data.steamId);
    if (!steamIdResult.valid) {
        errors.push(steamIdResult.error);
    }

    // Validate stats object
    if (data.stats) {
        if (typeof data.stats !== 'object') {
            errors.push('stats must be an object');
        } else {
            // Validate numeric fields
            const numericFields = [
                'currency', 'currencyTotal', 'currencySpent',
                'xp', 'xpTotal', 'prestige', 'permaTokens',
                'dailyClaims', 'gamesPlayed', 'timePlayed'
            ];

            for (const field of numericFields) {
                if (data.stats[field] !== undefined) {
                    if (typeof data.stats[field] !== 'number') {
                        errors.push(`stats.${field} must be a number`);
                    } else if (data.stats[field] < 0) {
                        errors.push(`stats.${field} cannot be negative`);
                    }
                }
            }

            // Prestige has a max value
            if (data.stats.prestige !== undefined &&
                (data.stats.prestige < 0 || data.stats.prestige > 100)) {
                errors.push('stats.prestige must be between 0 and 100');
            }
        }
    }

    // Validate skins object
    if (data.skins !== undefined) {
        if (typeof data.skins !== 'object' || Array.isArray(data.skins)) {
            errors.push('skins must be an object');
        }
    }

    // Validate loadout array
    if (data.loadout !== undefined) {
        if (!Array.isArray(data.loadout)) {
            errors.push('loadout must be an array');
        } else {
            for (let i = 0; i < data.loadout.length; i++) {
                const slot = data.loadout[i];
                if (typeof slot !== 'object') {
                    errors.push(`loadout[${i}] must be an object`);
                } else {
                    if (typeof slot.slot !== 'number') {
                        errors.push(`loadout[${i}].slot must be a number`);
                    }
                    if (typeof slot.item !== 'string') {
                        errors.push(`loadout[${i}].item must be a string`);
                    }
                }
            }
        }
    }

    // Validate arrays
    const arrayFields = ['perks', 'permaUnlocks', 'supporterStatus'];
    for (const field of arrayFields) {
        if (data[field] !== undefined && !Array.isArray(data[field])) {
            errors.push(`${field} must be an array`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate tracking data in v2 format.
 * Tracking is now embedded in the player JSON (data.tracking section).
 * This validates the tracking object structure.
 *
 * @param {Object} data - Tracking data object (must include v, steamId, and tracking fields)
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateV2TrackingFormat(data) {
    const errors = [];

    // Check top-level structure
    if (!data || typeof data !== 'object') {
        errors.push('Tracking data must be an object');
        return { valid: false, errors };
    }

    // Check version
    if (data.v !== 2) {
        errors.push(`Invalid version: expected 2, got ${data.v}`);
    }

    // Validate Steam ID (required)
    const steamIdResult = validateSteamId(data.steamId);
    if (!steamIdResult.valid) {
        errors.push(steamIdResult.error);
    }

    // Validate tracking fields (all should be objects with string keys and number values)
    const trackingFields = ['kills', 'vehicleKills', 'purchases', 'weaponXp', 'rewards'];
    for (const field of trackingFields) {
        if (data[field] !== undefined) {
            if (typeof data[field] !== 'object' || Array.isArray(data[field])) {
                errors.push(`${field} must be an object`);
            } else {
                // Validate values are numbers
                for (const [key, value] of Object.entries(data[field])) {
                    if (typeof value !== 'number') {
                        errors.push(`${field}.${key} must be a number`);
                    } else if (value < 0) {
                        errors.push(`${field}.${key} cannot be negative`);
                    }
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate combined player + tracking data in v2 format.
 * Legacy function for backwards compatibility.
 *
 * @param {Object} data - Player data in v2 format (may include tracking)
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateV2Format(data) {
    // If split format, validate separately
    if (data && data.player && data.tracking) {
        const playerResult = validateV2PlayerFormat(data.player);
        const trackingResult = validateV2TrackingFormat(data.tracking);
        return {
            valid: playerResult.valid && trackingResult.valid,
            errors: [...playerResult.errors, ...trackingResult.errors]
        };
    }

    // Otherwise validate as player format (may have embedded tracking)
    const playerResult = validateV2PlayerFormat(data);

    // If there's embedded tracking, validate it too
    if (data && data.tracking) {
        const trackingResult = validateV2TrackingFormat({
            v: 2,
            steamId: data.steamId,
            ...data.tracking
        });
        return {
            valid: playerResult.valid && trackingResult.valid,
            errors: [...playerResult.errors, ...trackingResult.errors]
        };
    }

    return playerResult;
}

/**
 * Check delta limits between old and new data.
 * Returns flags for any exceeded limits.
 *
 * @param {Object} oldData - Previous player data (from DB)
 * @param {Object} newData - New player data (from sync)
 * @returns {{flagged: boolean, reasons: string[]}}
 */
export function checkDeltaLimits(oldData, newData) {
    const reasons = [];

    if (!oldData || !oldData.stats || !newData || !newData.stats) {
        return { flagged: false, reasons };
    }

    const oldStats = oldData.stats;
    const newStats = newData.stats;

    // Check currency gain
    const currencyGain = (newStats.currency || 0) - (oldStats.currency || 0);
    if (currencyGain > DELTA_LIMITS.currency) {
        reasons.push(`Currency gain ${currencyGain} exceeds limit ${DELTA_LIMITS.currency}`);
    }

    // Check currency spent
    const currencySpentDelta = (newStats.currencySpent || 0) - (oldStats.currencySpent || 0);
    if (currencySpentDelta > DELTA_LIMITS.currencySpent) {
        reasons.push(`Currency spent ${currencySpentDelta} exceeds limit ${DELTA_LIMITS.currencySpent}`);
    }

    // Check XP gain
    const xpGain = (newStats.xp || 0) - (oldStats.xp || 0);
    if (xpGain > DELTA_LIMITS.xp) {
        reasons.push(`XP gain ${xpGain} exceeds limit ${DELTA_LIMITS.xp}`);
    }

    // Check prestige gain
    const prestigeGain = (newStats.prestige || 0) - (oldStats.prestige || 0);
    if (prestigeGain > DELTA_LIMITS.prestige) {
        reasons.push(`Prestige gain ${prestigeGain} exceeds limit ${DELTA_LIMITS.prestige}`);
    }

    // Check perma tokens gain
    const permaTokensGain = (newStats.permaTokens || 0) - (oldStats.permaTokens || 0);
    if (permaTokensGain > DELTA_LIMITS.permaTokens) {
        reasons.push(`Perma tokens gain ${permaTokensGain} exceeds limit ${DELTA_LIMITS.permaTokens}`);
    }

    // Check time played increase
    const timePlayedDelta = (newStats.timePlayed || 0) - (oldStats.timePlayed || 0);
    if (timePlayedDelta > DELTA_LIMITS.timePlayed) {
        reasons.push(`Time played increase ${timePlayedDelta}s exceeds limit ${DELTA_LIMITS.timePlayed}s`);
    }

    return {
        flagged: reasons.length > 0,
        reasons
    };
}

/**
 * Check if sync sequence is valid.
 * The new sequence should be within a reasonable range of the expected.
 *
 * @param {number} dbSyncSeq - Current sync sequence in database
 * @param {number} newSyncSeq - Sync sequence from incoming data
 * @param {number} tolerance - Max allowed difference (default 10)
 * @returns {{valid: boolean, reason: string|null}}
 */
export function validateSyncSequence(dbSyncSeq, newSyncSeq, tolerance = 10) {
    // New sync seq should be greater than or equal to DB seq
    if (newSyncSeq < dbSyncSeq) {
        return {
            valid: false,
            reason: `Sync sequence ${newSyncSeq} is less than DB sequence ${dbSyncSeq} (stale data)`
        };
    }

    // Sync seq shouldn't jump too far ahead
    const jump = newSyncSeq - dbSyncSeq;
    if (jump > tolerance) {
        return {
            valid: false,
            reason: `Sync sequence jump ${jump} exceeds tolerance ${tolerance}`
        };
    }

    return { valid: true, reason: null };
}

/**
 * Sanitize string input to prevent injection.
 *
 * @param {string} input - String to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized string
 */
export function sanitizeString(input, maxLength = 255) {
    if (typeof input !== 'string') {
        return '';
    }
    return input.trim().substring(0, maxLength);
}

/**
 * Create a default player data structure.
 *
 * @param {string} steamId - Player's Steam ID
 * @returns {Object} Default v2 player data
 */
export function createDefaultPlayerData(steamId) {
    return {
        v: 2,
        steamId,
        eosId: null,
        name: null,
        serverId: null,
        lastSync: new Date().toISOString(),
        syncSeq: 0,
        stats: {
            currency: 0,
            currencyTotal: 0,
            currencySpent: 0,
            xp: 0,
            xpTotal: 0,
            prestige: 0,
            permaTokens: 0,
            dailyClaims: 0,
            gamesPlayed: 0,
            timePlayed: 0,
            joinTime: null,
            dailyClaimTime: null
        },
        skins: {
            indfor: null,
            blufor: null,
            redfor: null
        },
        loadout: [],
        perks: [],
        permaUnlocks: [],
        supporterStatus: [],
        tracking: {
            kills: {},
            vehicleKills: {},
            purchases: {},
            weaponXp: {},
            rewards: {}
        }
    };
}

export default {
    DELTA_LIMITS,
    validateSteamId,
    validateV2Format,
    validateV2PlayerFormat,
    validateV2TrackingFormat,
    checkDeltaLimits,
    validateSyncSequence,
    sanitizeString,
    createDefaultPlayerData
};
