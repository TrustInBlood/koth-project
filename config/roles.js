/**
 * Discord role permissions configuration
 * Production role IDs and their associated permissions
 */

export const roles = {
    // Administrator role - full access
    admin: {
        id: process.env.ROLE_ADMIN_ID || '',
        permissions: ['*']
    },

    // Moderator role - moderation commands
    moderator: {
        id: process.env.ROLE_MODERATOR_ID || '',
        permissions: [
            'commands.moderate',
            'commands.warn',
            'commands.mute',
            'commands.kick',
            'dashboard.view',
            'dashboard.users.view'
        ]
    },

    // Staff role - limited moderation
    staff: {
        id: process.env.ROLE_STAFF_ID || '',
        permissions: [
            'commands.warn',
            'dashboard.view'
        ]
    },

    // Member role - basic access
    member: {
        id: process.env.ROLE_MEMBER_ID || '',
        permissions: [
            'commands.basic'
        ]
    }
};

/**
 * Permission hierarchy - higher index = higher priority
 */
export const hierarchy = [
    'member',
    'staff',
    'moderator',
    'admin'
];

/**
 * Check if a role has a specific permission
 * @param {string} roleName - Role name to check
 * @param {string} permission - Permission to check for
 * @returns {boolean}
 */
export function roleHasPermission(roleName, permission) {
    const role = roles[roleName];
    if (!role) return false;

    // Wildcard permission grants all
    if (role.permissions.includes('*')) return true;

    // Check exact match
    if (role.permissions.includes(permission)) return true;

    // Check parent permission (e.g., 'commands' grants 'commands.basic')
    const parts = permission.split('.');
    for (let i = 1; i < parts.length; i++) {
        const parent = parts.slice(0, i).join('.');
        if (role.permissions.includes(parent)) return true;
    }

    return false;
}

/**
 * Get all permissions for a role, including inherited from lower roles
 * @param {string} roleName - Role name
 * @returns {string[]}
 */
export function getRolePermissions(roleName) {
    const roleIndex = hierarchy.indexOf(roleName);
    if (roleIndex === -1) return [];

    const allPermissions = new Set();

    // Add permissions from this role and all lower roles
    for (let i = 0; i <= roleIndex; i++) {
        const role = roles[hierarchy[i]];
        if (role && role.permissions) {
            role.permissions.forEach(p => allPermissions.add(p));
        }
    }

    return Array.from(allPermissions);
}

export default {
    roles,
    hierarchy,
    roleHasPermission,
    getRolePermissions
};
