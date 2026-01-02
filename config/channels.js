import { getEnv } from '../src/utils/environment.js';

/**
 * Discord channel IDs for notifications and logging
 * Configure these via environment variables or update directly for your server
 */

export const channels = {
    // Logging channels
    logs: {
        // General bot logs
        bot: getEnv('CHANNEL_BOT_LOGS', ''),
        // Moderation action logs
        moderation: getEnv('CHANNEL_MOD_LOGS', ''),
        // Error logs
        errors: getEnv('CHANNEL_ERROR_LOGS', ''),
        // Join/leave logs
        memberActivity: getEnv('CHANNEL_MEMBER_LOGS', '')
    },

    // Notification channels
    notifications: {
        // General announcements
        announcements: getEnv('CHANNEL_ANNOUNCEMENTS', ''),
        // Welcome messages
        welcome: getEnv('CHANNEL_WELCOME', ''),
        // System status updates
        status: getEnv('CHANNEL_STATUS', '')
    },

    // Game/Event channels
    events: {
        // King of the Hill game channel
        koth: getEnv('CHANNEL_KOTH', ''),
        // Event announcements
        eventAnnouncements: getEnv('CHANNEL_EVENT_ANNOUNCEMENTS', '')
    }
};

/**
 * Get a channel ID by path (e.g., 'logs.bot' or 'notifications.welcome')
 * @param {string} path - Dot-notation path to channel
 * @returns {string|null}
 */
export function getChannel(path) {
    const parts = path.split('.');
    let current = channels;

    for (const part of parts) {
        if (current[part] === undefined) {
            return null;
        }
        current = current[part];
    }

    return typeof current === 'string' ? current : null;
}

/**
 * Check if a channel is configured
 * @param {string} path - Dot-notation path to channel
 * @returns {boolean}
 */
export function isChannelConfigured(path) {
    const channelId = getChannel(path);
    return channelId !== null && channelId !== '';
}

export default {
    channels,
    getChannel,
    isChannelConfigured
};
