/*
Copyright (c) 2025 Licensed under the Open Software License version 3.0

OSL-3.0 <https://spdx.org/licenses/OSL-3.0.html>

Author:
Trust In Blood (discord: trustinblood)

Inspired by OfficialKothDB by Skillet (discord: steelskillet)
The Unnamed (https://theunnamedcorp.com/)

HTTP API version for KOTH Bot integration
*/

import BasePlugin from './base-plugin.js';
import path from 'path';
import fs from 'fs';
import { readFile, writeFile } from 'node:fs/promises';

/**
 * Decode buffer with BOM detection (UTF-16LE, UTF-16BE, UTF-8)
 */
function decodeBufferSmart(buf) {
    if (!buf || buf.length === 0) return '';
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
        return buf.toString('utf16le');
    }
    if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
        const out = Buffer.alloc(Math.max(0, buf.length - 2));
        for (let i = 2; i + 1 < buf.length; i += 2) {
            out[i - 2] = buf[i + 1];
            out[i - 1] = buf[i];
        }
        return out.toString('utf16le');
    }
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
        return buf.slice(3).toString('utf8');
    }
    return buf.toString('utf8');
}

/**
 * Read JSON file with smart encoding detection
 */
async function readJsonSmart(filePath) {
    const buf = await readFile(filePath);
    let text = decodeBufferSmart(buf);
    if (text && text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return JSON.parse(text);
}

export default class HttpKothDB extends BasePlugin {
    static get description() {
        return 'KOTH Database integration via HTTP API - syncs player data through KOTH Bot server';
    }

    static get defaultEnabled() {
        return false;
    }

    static get optionsSpecification() {
        return {
            apiUrl: {
                required: true,
                description: 'KOTH Bot API base URL (e.g., http://localhost:3000)',
                default: 'http://localhost:3000'
            },
            apiKey: {
                required: true,
                description: 'API key for X-API-Key header authentication',
                default: ''
            },
            kothFolderPath: {
                required: false,
                description: 'Folder path (relative to squadjs index.js) of the koth data folder',
                default: './SquadGame/Saved/KOTH/'
            },
            serverSettingsSyncInterval: {
                required: false,
                description: 'Interval in milliseconds for ServerSettings sync (0 to disable)',
                default: 90000
            },
            requestTimeout: {
                required: false,
                description: 'HTTP request timeout in milliseconds',
                default: 10000
            },
            retryAttempts: {
                required: false,
                description: 'Number of retry attempts on network failure',
                default: 3
            },
            retryDelay: {
                required: false,
                description: 'Base delay between retries in milliseconds (exponential backoff)',
                default: 1000
            },
            fallbackToCache: {
                required: false,
                description: 'Use cached local JSON file if API is unavailable on player connect',
                default: true
            },
            defaultSaveVersion: {
                required: false,
                description: 'Default save version for new players',
                default: 'v1.5'
            },
            dryRun: {
                required: false,
                description: 'Test mode - logs all operations without writing files. Safe for testing API connectivity.',
                default: false
            }
        };
    }

    constructor(server, options, connectors) {
        super(server, options, connectors);

        this.kothPath = null;
        this.serverSettingsInterval = null;

        this.onPlayerConnected = this.onPlayerConnected.bind(this);
        this.onPlayerDisconnected = this.onPlayerDisconnected.bind(this);
    }

    async mount() {
        this.verbose(1, 'HttpKothDB: Mounting plugin');
        this.verbose(1, `HttpKothDB: API URL: ${this.options.apiUrl}`);
        this.verbose(1, `HttpKothDB: KOTH Folder: ${this.options.kothFolderPath}`);

        if (this.options.dryRun) {
            this.verbose(1, '='.repeat(60));
            this.verbose(1, 'HttpKothDB: *** DRY RUN MODE ENABLED ***');
            this.verbose(1, 'HttpKothDB: No files will be written. API operations will be logged only.');
            this.verbose(1, '='.repeat(60));
        }

        // Resolve KOTH path
        this.kothPath = path.isAbsolute(this.options.kothFolderPath)
            ? this.options.kothFolderPath
            : path.resolve(process.cwd(), this.options.kothFolderPath);

        this.verbose(1, `HttpKothDB: Resolved KOTH path: ${this.kothPath}`);

        // Check if KOTH folder exists (game server should create this)
        if (!fs.existsSync(this.kothPath)) {
            this.verbose(1, `HttpKothDB: WARNING - KOTH directory does not exist at ${this.kothPath}`);
            this.verbose(1, 'HttpKothDB: The game server should create this folder. Check your kothFolderPath config.');
            this.verbose(1, 'HttpKothDB: Plugin will continue but file operations will fail until folder exists.');
        }

        // Check API health
        try {
            const health = await this.checkApiHealth();
            this.verbose(1, `HttpKothDB: API health check passed - ${health.status}`);
        } catch (err) {
            this.verbose(1, `HttpKothDB: API health check failed - ${err.message}`);
            this.verbose(1, 'HttpKothDB: Plugin will continue but sync operations may fail');
        }

        // Register event listeners
        this.server.on('PLAYER_CONNECTED', this.onPlayerConnected);
        this.server.on('PLAYER_DISCONNECTED', this.onPlayerDisconnected);

        // Start ServerSettings sync interval if enabled
        if (this.options.serverSettingsSyncInterval > 0) {
            this.startServerSettingsSync();
        }

        this.verbose(1, 'HttpKothDB: Plugin mounted successfully');
    }

    async unmount() {
        this.verbose(1, 'HttpKothDB: Unmounting plugin');

        this.server.removeEventListener('PLAYER_CONNECTED', this.onPlayerConnected);
        this.server.removeEventListener('PLAYER_DISCONNECTED', this.onPlayerDisconnected);

        if (this.serverSettingsInterval) {
            clearInterval(this.serverSettingsInterval);
            this.serverSettingsInterval = null;
            this.verbose(1, 'HttpKothDB: Stopped ServerSettings sync');
        }

        this.verbose(1, 'HttpKothDB: Plugin unmounted');
    }

    // ==================== Event Handlers ====================

    async onPlayerConnected(info) {
        const steamId = info.player.steamID;
        const eosId = info.player.eosID || '';

        this.verbose(1, `HttpKothDB: Player connected: ${steamId}`);

        try {
            // Fetch player data from API
            const playerData = await this.fetchPlayerData(steamId);

            if (playerData) {
                // Write JSON file for game server
                await this.writePlayerJson(steamId, playerData);
                this.verbose(1, `HttpKothDB: Loaded player data for ${steamId}`);
            } else {
                // New player - create default save
                this.verbose(1, `HttpKothDB: Player ${steamId} not found in database, creating default save`);
                const defaultSave = this.createDefaultSave(steamId, eosId);
                await this.writePlayerJson(steamId, defaultSave);
            }
        } catch (error) {
            this.verbose(1, `HttpKothDB: Error loading player ${steamId}: ${error.message}`);

            // Fallback: try to use cached JSON if available
            if (this.options.fallbackToCache) {
                try {
                    const cached = await this.readPlayerJson(steamId);
                    if (cached) {
                        this.verbose(1, `HttpKothDB: Using cached data for ${steamId}`);
                        return;
                    }
                } catch (cacheError) {
                    this.verbose(2, `HttpKothDB: No cached data available for ${steamId}`);
                }
            }

            // Last resort: create default save
            this.verbose(1, `HttpKothDB: Creating default save for ${steamId} due to API failure`);
            const defaultSave = this.createDefaultSave(steamId, eosId);
            await this.writePlayerJson(steamId, defaultSave);
        }
    }

    async onPlayerDisconnected(info) {
        const steamId = info.player.steamID;

        this.verbose(1, `HttpKothDB: Player disconnected: ${steamId}`);

        try {
            // Read JSON file from game server
            const playerData = await this.readPlayerJson(steamId);

            if (!playerData) {
                this.verbose(1, `HttpKothDB: No save data found for ${steamId}`);
                return;
            }

            // Send to API for storage
            await this.syncPlayerToApi(playerData);
            this.verbose(1, `HttpKothDB: Synced player data for ${steamId} to API`);
        } catch (error) {
            this.verbose(1, `HttpKothDB: Error syncing player ${steamId}: ${error.message}`);
            // Data remains in local JSON file, will be synced on next disconnect or can be manually recovered
        }
    }

    // ==================== API Methods ====================

    async checkApiHealth() {
        const url = `${this.options.apiUrl}/api/sync/health`;
        const response = await this.httpRequest('GET', url);
        return response;
    }

    async fetchPlayerData(steamId) {
        const url = `${this.options.apiUrl}/api/sync/player/${steamId}?format=game`;

        try {
            const response = await this.httpRequestWithRetry('GET', url);
            return response;
        } catch (error) {
            // 404 means player not found - not an error, just new player
            if (error.status === 404) {
                return null;
            }
            throw error;
        }
    }

    async syncPlayerToApi(playerData) {
        const url = `${this.options.apiUrl}/api/sync/player`;

        return await this.httpRequestWithRetry('POST', url, playerData, {
            'X-Data-Format': 'game'
        });
    }

    async fetchServerSettings() {
        const url = `${this.options.apiUrl}/api/sync/server-settings`;

        try {
            const response = await this.httpRequestWithRetry('GET', url);
            return response;
        } catch (error) {
            if (error.status === 404) {
                return null;
            }
            throw error;
        }
    }

    // ==================== HTTP Client ====================

    async httpRequestWithRetry(method, url, body = null, extraHeaders = {}) {
        let lastError;

        for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
            try {
                const response = await this.httpRequest(method, url, body, extraHeaders);
                return response;
            } catch (error) {
                lastError = error;

                // Don't retry on 4xx errors (client errors)
                if (error.status && error.status >= 400 && error.status < 500) {
                    throw error;
                }

                this.verbose(2, `HttpKothDB: Request failed (attempt ${attempt}/${this.options.retryAttempts}): ${error.message}`);

                if (attempt < this.options.retryAttempts) {
                    // Exponential backoff
                    const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
                    await this.sleep(delay);
                }
            }
        }

        throw lastError;
    }

    async httpRequest(method, url, body = null, extraHeaders = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.requestTimeout);

        try {
            const headers = {
                'X-API-Key': this.options.apiKey,
                'Content-Type': 'application/json',
                ...extraHeaders
            };

            const fetchOptions = {
                method,
                headers,
                signal: controller.signal
            };

            if (body) {
                fetchOptions.body = JSON.stringify(body);
            }

            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                error.status = response.status;

                // Try to get error details from response body
                try {
                    const errorBody = await response.json();
                    error.details = errorBody;
                } catch {
                    // Ignore JSON parse errors
                }

                throw error;
            }

            // Return JSON response
            const data = await response.json();
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                const timeoutError = new Error('Request timeout');
                timeoutError.status = 408;
                throw timeoutError;
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // ==================== File Operations ====================

    getPlayerFilePath(steamId) {
        return path.join(this.kothPath, `${steamId}.json`);
    }

    async writePlayerJson(steamId, data) {
        const filePath = this.getPlayerFilePath(steamId);

        if (this.options.dryRun) {
            this.verbose(1, `HttpKothDB: [DRY RUN] Would write player file: ${filePath}`);
            this.verbose(2, `HttpKothDB: [DRY RUN] Data preview: currency=${data['save data']?.['$']}, xp=${data['save data']?.['xp']}`);
            return;
        }

        await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        this.verbose(2, `HttpKothDB: Wrote player file: ${filePath}`);
    }

    async readPlayerJson(steamId) {
        const filePath = this.getPlayerFilePath(steamId);

        if (!fs.existsSync(filePath)) {
            return null;
        }

        try {
            const data = await readJsonSmart(filePath);
            this.verbose(2, `HttpKothDB: Read player file: ${filePath}`);
            return data;
        } catch (error) {
            this.verbose(1, `HttpKothDB: Error reading player file ${filePath}: ${error.message}`);
            return null;
        }
    }

    // ==================== ServerSettings Sync ====================

    startServerSettingsSync() {
        this.verbose(1, `HttpKothDB: Starting ServerSettings sync (interval: ${this.options.serverSettingsSyncInterval}ms)`);

        // Initial sync
        this.syncServerSettings();

        // Periodic sync
        this.serverSettingsInterval = setInterval(
            () => this.syncServerSettings(),
            this.options.serverSettingsSyncInterval
        );
    }

    async syncServerSettings() {
        try {
            const settings = await this.fetchServerSettings();

            if (settings) {
                const filePath = path.join(this.kothPath, 'ServerSettings.json');

                if (this.options.dryRun) {
                    this.verbose(1, `HttpKothDB: [DRY RUN] Would write ServerSettings.json: ${filePath}`);
                    return;
                }

                await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
                this.verbose(2, 'HttpKothDB: ServerSettings synced from API');
            } else {
                this.verbose(2, 'HttpKothDB: No ServerSettings found in API');
            }
        } catch (error) {
            this.verbose(1, `HttpKothDB: ServerSettings sync failed: ${error.message}`);
        }
    }

    // ==================== Utility Methods ====================

    createDefaultSave(steamId, eosId) {
        const now = new Date();
        const [major, minor] = this.options.defaultSaveVersion.replace('v', '').split('.').map(Number);

        return {
            'save version': {
                'text': this.options.defaultSaveVersion,
                'major': major || 1,
                'minor': minor || 5
            },
            'player info': {
                'steamid': steamId,
                'eosid': eosId || '',
                'supporter status': []
            },
            'update info': {
                'year': now.getUTCFullYear(),
                'month': now.getUTCMonth() + 1,
                'day': now.getUTCDate(),
                'hour': now.getUTCHours(),
                'minute': now.getUTCMinutes(),
                'second': now.getUTCSeconds(),
                'millisecond': now.getUTCMilliseconds(),
                'iso': now.toISOString()
            },
            'save data': {
                '$': 0,
                'total $': 0,
                'xp': 0,
                'total xp': 0,
                'indfor skin': '',
                'blufor skin': '',
                'redfor skin': '',
                'loadout': [],
                'perks': [],
                'perma unlocks': [],
                'rewards': {},
                'player kills': {},
                'vehicle kills': {},
                'purchase history': {},
                'weapon xp': {},
                'prestige': 0,
                'daily_claim_time': '',
                'join_time': '',
                'daily_claims': 0,
                'perma_tokens': 0
            },
            'old save data': {}
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
