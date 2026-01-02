import { isDevelopment } from '../utils/environment.js';
import { createServiceLogger } from '../utils/logger.js';

const logger = createServiceLogger('Permissions');

// Dynamic import based on environment
const rolesConfig = isDevelopment
    ? await import('../../config/roles.development.js')
    : await import('../../config/roles.js');

const { roles, hierarchy, roleHasPermission, getRolePermissions } = rolesConfig;

/**
 * Get the highest role a member has from the hierarchy
 * @param {GuildMember} member - Discord guild member
 * @returns {string|null} Role name or null if no matching roles
 */
export function getMemberHighestRole(member) {
    // Check from highest to lowest in hierarchy
    for (let i = hierarchy.length - 1; i >= 0; i--) {
        const roleName = hierarchy[i];
        const roleConfig = roles[roleName];

        if (roleConfig && roleConfig.id && member.roles.cache.has(roleConfig.id)) {
            return roleName;
        }
    }

    return null;
}

/**
 * Check if a member has a specific permission
 * @param {GuildMember} member - Discord guild member
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export function memberHasPermission(member, permission) {
    const highestRole = getMemberHighestRole(member);

    if (!highestRole) {
        logger.debug(`Member ${member.user.tag} has no recognized roles`);
        return false;
    }

    // Get all permissions including inherited ones
    const permissions = getRolePermissions(highestRole);

    // Check for wildcard
    if (permissions.includes('*')) {
        return true;
    }

    // Check exact match
    if (permissions.includes(permission)) {
        return true;
    }

    // Check parent permissions
    const parts = permission.split('.');
    for (let i = 1; i < parts.length; i++) {
        const parent = parts.slice(0, i).join('.');
        if (permissions.includes(parent)) {
            return true;
        }
    }

    return false;
}

/**
 * Get all permissions for a member
 * @param {GuildMember} member - Discord guild member
 * @returns {string[]}
 */
export function getMemberPermissions(member) {
    const highestRole = getMemberHighestRole(member);

    if (!highestRole) {
        return [];
    }

    return getRolePermissions(highestRole);
}

/**
 * Create a permission check middleware for interactions
 * @param {string} permission - Required permission
 * @returns {Function} Check function
 */
export function requirePermission(permission) {
    return async (interaction) => {
        if (!interaction.member) {
            logger.warn('Permission check failed: no member on interaction');
            return false;
        }

        const hasPermission = memberHasPermission(interaction.member, permission);

        if (!hasPermission) {
            logger.debug(
                `Permission denied: ${interaction.user.tag} lacks ${permission}`
            );
        }

        return hasPermission;
    };
}

/**
 * Check if user has permission and reply with error if not
 * @param {Interaction} interaction - Discord interaction
 * @param {string} permission - Required permission
 * @returns {Promise<boolean>} Whether the user has permission
 */
export async function checkPermission(interaction, permission) {
    if (!memberHasPermission(interaction.member, permission)) {
        await interaction.reply({
            content: 'You do not have permission to use this command.',
            ephemeral: true
        });
        return false;
    }
    return true;
}

export default {
    getMemberHighestRole,
    memberHasPermission,
    getMemberPermissions,
    requirePermission,
    checkPermission
};
