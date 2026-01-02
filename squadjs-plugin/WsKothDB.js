/*
Copyright (c) 2025 Licensed under the Open Software License version 3.0

OSL-3.0 <https://spdx.org/licenses/OSL-3.0.html>

Author:
Trust In Blood (discord: trustinblood)

Inspired by OfficialKothDB by Skillet (discord: steelskillet)
The Unnamed (https://theunnamedcorp.com/)

WebSocket-based KOTH Bot integration plugin for SquadJS (v2)
Acts as Socket.IO SERVER - KOTH Bot connects TO this plugin.
Uses the existing socket.io package from SquadJS (no additional dependencies needed).

v2 Changes:
- Uses v2 JSON format (flat camelCase keys)
- Periodic sync every 60 seconds during gameplay
- Crash recovery on mount (scans for orphaned player files)
- File deletion after successful disconnect sync
- Handles server-hop wait-and-retry
- syncSeq tracking for conflict resolution
*/

import BasePlugin from './base-plugin.js';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';

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

export default class WsKothDB extends BasePlugin {
    static get description() {
        return 'KOTH Database integration via WebSocket (v2) - acts as Socket.IO server for KOTH Bot connections';
    }

    static get defaultEnabled() {
        return false;
    }

    static get optionsSpecification() {
        return {
            kothSyncPort: {
                required: true,
                description: 'Port for the KOTH sync server (KOTH Bot connects to this port)',
                default: 3001
            },
            apiToken: {
                required: true,
                description: 'API token for authenticating with KOTH Bot (get from KOTH Bot admin)',
                default: ''
            },
            serverId: {
                required: true,
                description: 'Unique identifier for this game server (must match KOTH Bot registration)',
                default: 'server-1'
            },
            serverName: {
                required: false,
                description: 'Friendly name for this server (shown in dashboard)',
                default: ''
            },
            kothFolderPath: {
                required: false,
                description: 'Folder path (relative to squadjs index.js) of the koth data folder',
                default: './SquadGame/Saved/KOTH/'
            },
            syncIntervalSeconds: {
                required: false,
                description: 'How often to sync player data to KOTH Bot (in seconds)',
                default: 60
            },
            requestTimeout: {
                required: false,
                description: 'Timeout for waiting for KOTH Bot responses in milliseconds',
                default: 10000
            },
            serverHopRetryDelay: {
                required: false,
                description: 'Delay between retries when player is active elsewhere (ms)',
                default: 2000
            },
            serverHopMaxRetries: {
                required: false,
                description: 'Max retries when player is active elsewhere',
                default: 5
            },
            deleteFileOnDisconnect: {
                required: false,
                description: 'Delete player file after successful disconnect sync (recommended)',
                default: true
            },
            dryRun: {
                required: false,
                description: 'Test mode - logs all operations without writing files.',
                default: false
            }
        };
    }

    constructor(server, options, connectors) {
        super(server, options, connectors);

        this.io = null;
        this.kothPath = null;
        this.kothBotSocket = null;
        this.authenticated = false;
        this.pendingRequests = new Map();
        this.activePlayers = new Map(); // steamId -> { syncSeq, lastSync, syncTimer }
        this.syncInterval = null;

        this.onPlayerConnected = this.onPlayerConnected.bind(this);
        this.onPlayerDisconnected = this.onPlayerDisconnected.bind(this);
    }

    async mount() {
        this.verbose(1, 'WsKothDB: Mounting plugin (v2)');
        this.verbose(1, `WsKothDB: KOTH Sync Port: ${this.options.kothSyncPort}`);
        this.verbose(1, `WsKothDB: Server ID: ${this.options.serverId}`);
        this.verbose(1, `WsKothDB: KOTH Folder: ${this.options.kothFolderPath}`);
        this.verbose(1, `WsKothDB: Sync Interval: ${this.options.syncIntervalSeconds}s`);

        if (this.options.dryRun) {
            this.verbose(1, '='.repeat(60));
            this.verbose(1, 'WsKothDB: *** DRY RUN MODE ENABLED ***');
            this.verbose(1, 'WsKothDB: No files will be written. WebSocket operations will be logged only.');
            this.verbose(1, '='.repeat(60));
        }

        // Resolve KOTH path
        this.kothPath = path.isAbsolute(this.options.kothFolderPath)
            ? this.options.kothFolderPath
            : path.resolve(process.cwd(), this.options.kothFolderPath);

        this.verbose(1, `WsKothDB: Resolved KOTH path: ${this.kothPath}`);

        // Check if KOTH folder exists
        if (!fs.existsSync(this.kothPath)) {
            this.verbose(1, `WsKothDB: WARNING - KOTH directory does not exist at ${this.kothPath}`);
            this.verbose(1, 'WsKothDB: The game server should create this folder. Check your kothFolderPath config.');
        }

        // Start WebSocket server
        await this.startWebSocketServer();

        // Register event listeners
        this.server.on('PLAYER_CONNECTED', this.onPlayerConnected);
        this.server.on('PLAYER_DISCONNECTED', this.onPlayerDisconnected);

        // Start periodic sync timer
        this.startSyncTimer();

        // Perform crash recovery (process orphaned files)
        await this.performCrashRecovery();

        this.verbose(1, 'WsKothDB: Plugin mounted successfully');
    }

    async unmount() {
        this.verbose(1, 'WsKothDB: Unmounting plugin');

        this.server.removeEventListener('PLAYER_CONNECTED', this.onPlayerConnected);
        this.server.removeEventListener('PLAYER_DISCONNECTED', this.onPlayerDisconnected);

        // Stop sync timer
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Clean up active player timers
        for (const [steamId, playerInfo] of this.activePlayers) {
            if (playerInfo.syncTimer) {
                clearTimeout(playerInfo.syncTimer);
            }
        }
        this.activePlayers.clear();

        // Clean up pending requests
        for (const [steamId, pending] of this.pendingRequests) {
            pending.reject(new Error('Plugin unmounting'));
        }
        this.pendingRequests.clear();

        // Close WebSocket server
        if (this.io) {
            await new Promise((resolve) => {
                this.io.close(() => {
                    this.verbose(1, 'WsKothDB: WebSocket server closed');
                    resolve();
                });
            });
            this.io = null;
        }

        this.verbose(1, 'WsKothDB: Plugin unmounted');
    }

    // ==================== WebSocket Server ====================

    async startWebSocketServer() {
        return new Promise((resolve, reject) => {
            try {
                this.io = new SocketIOServer(this.options.kothSyncPort, {
                    cors: {
                        origin: '*',
                        methods: ['GET', 'POST']
                    }
                });

                this.verbose(1, `WsKothDB: KOTH sync server listening on port ${this.options.kothSyncPort}`);

                this.io.on('connection', (socket) => {
                    this.handleKothBotConnection(socket);
                });

                resolve();
            } catch (error) {
                this.verbose(1, `WsKothDB: Failed to start WebSocket server: ${error.message}`);
                reject(error);
            }
        });
    }

    handleKothBotConnection(socket) {
        this.verbose(1, `WsKothDB: New connection from ${socket.handshake.address}`);

        // KOTH Bot authenticates by sending token in auth
        const { token } = socket.handshake.auth || {};

        if (token !== this.options.apiToken) {
            this.verbose(1, `WsKothDB: Authentication failed for ${socket.handshake.address}`);
            socket.emit('auth:failed', { error: 'Invalid API token' });
            socket.disconnect(true);
            return;
        }

        this.verbose(1, `WsKothDB: KOTH Bot authenticated from ${socket.handshake.address}`);

        // Replace existing connection
        if (this.kothBotSocket) {
            this.verbose(1, 'WsKothDB: Replacing existing KOTH Bot connection');
            this.kothBotSocket.disconnect(true);
        }
        this.kothBotSocket = socket;
        this.authenticated = true;

        // Send server info
        socket.emit('server:info', {
            serverId: this.options.serverId,
            serverName: this.options.serverName || this.options.serverId,
            playerCount: this.server.players?.length || 0
        });

        // ==================== Handle KOTH Bot Events ====================

        socket.on('disconnect', (reason) => {
            this.verbose(1, `WsKothDB: KOTH Bot disconnected: ${reason}`);
            if (this.kothBotSocket === socket) {
                this.kothBotSocket = null;
                this.authenticated = false;
            }
        });

        // Auth success confirmation from KOTH Bot
        socket.on('auth:success', (data) => {
            this.verbose(1, `WsKothDB: Auth confirmed by KOTH Bot: ${data.serverName}`);
        });

        // Player data response
        socket.on('player:data', async (data) => {
            const { steamId, data: playerData, syncSeq } = data;
            this.verbose(2, `WsKothDB: Received player data for ${steamId} (seq: ${syncSeq})`);

            const pending = this.pendingRequests.get(steamId);
            if (pending) {
                this.pendingRequests.delete(steamId);
                clearTimeout(pending.timeout);
                pending.resolve({ playerData, syncSeq });
            }

            // Write file and track player
            if (playerData) {
                await this.writePlayerJson(steamId, playerData);
                this.activePlayers.set(steamId, {
                    syncSeq: syncSeq || 0,
                    lastSync: Date.now()
                });
            }
        });

        // Player wait (active elsewhere)
        socket.on('player:wait', async (data) => {
            const { steamId, activeServer, retryAfterMs, maxRetries } = data;
            this.verbose(1, `WsKothDB: Player ${steamId} active on ${activeServer}, waiting...`);

            const pending = this.pendingRequests.get(steamId);
            if (pending) {
                pending.retryCount = (pending.retryCount || 0) + 1;

                if (pending.retryCount >= maxRetries) {
                    this.pendingRequests.delete(steamId);
                    clearTimeout(pending.timeout);
                    pending.reject(new Error(`Player ${steamId} still active on ${activeServer} after ${maxRetries} retries`));
                    return;
                }

                // Retry after delay
                setTimeout(() => {
                    if (this.isConnected()) {
                        this.kothBotSocket.emit('player:connect', {
                            steamId,
                            eosId: pending.eosId,
                            name: pending.name
                        });
                    }
                }, retryAfterMs);
            }
        });

        // Player error
        socket.on('player:error', (data) => {
            const { steamId, error } = data;
            this.verbose(1, `WsKothDB: Error for player ${steamId}: ${error}`);

            const pending = this.pendingRequests.get(steamId);
            if (pending) {
                this.pendingRequests.delete(steamId);
                clearTimeout(pending.timeout);
                pending.reject(new Error(error));
            }
        });

        // Sync acknowledgment
        socket.on('sync:ack', (data) => {
            const { steamId, syncSeq, flagged } = data;
            this.verbose(2, `WsKothDB: Sync ack for ${steamId} (seq: ${syncSeq})${flagged ? ' [FLAGGED]' : ''}`);

            const playerInfo = this.activePlayers.get(steamId);
            if (playerInfo) {
                playerInfo.syncSeq = syncSeq;
                playerInfo.lastSync = Date.now();
            }
        });

        // Sync error
        socket.on('sync:error', (data) => {
            const { steamId, error, errors } = data;
            this.verbose(1, `WsKothDB: Sync error for ${steamId}: ${error}`);
            if (errors) {
                this.verbose(1, `WsKothDB: Validation errors: ${errors.join(', ')}`);
            }
        });

        // Disconnect acknowledgment
        socket.on('disconnect:ack', async (data) => {
            const { steamId, syncSeq } = data;
            this.verbose(1, `WsKothDB: Disconnect ack for ${steamId} (seq: ${syncSeq})`);

            // Remove from active players
            this.activePlayers.delete(steamId);

            // Delete the file if configured
            if (this.options.deleteFileOnDisconnect) {
                await this.deletePlayerJson(steamId);
            }
        });

        // Disconnect error
        socket.on('disconnect:error', (data) => {
            const { steamId, error } = data;
            this.verbose(1, `WsKothDB: Disconnect error for ${steamId}: ${error}`);
            // Keep file on error for crash recovery
        });

        // Crash recovery acknowledgment
        socket.on('recovery:ack', async (data) => {
            const { steamId, syncSeq, skipped, flagged } = data;
            this.verbose(1, `WsKothDB: Recovery ack for ${steamId}${skipped ? ' (skipped)' : ''}${flagged ? ' [FLAGGED]' : ''}`);

            // Delete the recovered file
            await this.deletePlayerJson(steamId);
        });

        // Crash recovery error
        socket.on('recovery:error', (data) => {
            const { steamId, error } = data;
            this.verbose(1, `WsKothDB: Recovery error for ${steamId}: ${error}`);
        });

        // Batch recovery complete
        socket.on('batch-recovery:complete', (data) => {
            const { total, successful, failed } = data;
            this.verbose(1, `WsKothDB: Batch recovery complete: ${successful}/${total} succeeded, ${failed} failed`);
        });
    }

    isConnected() {
        return this.kothBotSocket !== null && this.kothBotSocket.connected && this.authenticated;
    }

    // ==================== Periodic Sync ====================

    startSyncTimer() {
        const intervalMs = this.options.syncIntervalSeconds * 1000;

        this.syncInterval = setInterval(async () => {
            await this.performPeriodicSync();
        }, intervalMs);

        this.verbose(1, `WsKothDB: Started periodic sync timer (${this.options.syncIntervalSeconds}s)`);
    }

    async performPeriodicSync() {
        if (!this.isConnected()) {
            this.verbose(2, 'WsKothDB: Skipping periodic sync - not connected');
            return;
        }

        const activeSteamIds = Array.from(this.activePlayers.keys());
        if (activeSteamIds.length === 0) {
            return;
        }

        this.verbose(2, `WsKothDB: Performing periodic sync for ${activeSteamIds.length} players`);

        for (const steamId of activeSteamIds) {
            try {
                const playerData = await this.readPlayerJson(steamId);
                if (!playerData) {
                    this.verbose(2, `WsKothDB: No file found for ${steamId}, skipping sync`);
                    continue;
                }

                const playerInfo = this.activePlayers.get(steamId);
                if (!playerInfo) continue;

                // Increment syncSeq for this sync
                const newSyncSeq = (playerInfo.syncSeq || 0) + 1;
                playerData.syncSeq = newSyncSeq;
                playerData.serverId = this.options.serverId;
                playerData.lastSync = new Date().toISOString();

                // Update file with new syncSeq
                await this.writePlayerJson(steamId, playerData);

                // Send to KOTH Bot
                this.kothBotSocket.emit('player:sync', playerData);
                this.verbose(2, `WsKothDB: Sent periodic sync for ${steamId} (seq: ${newSyncSeq})`);

            } catch (error) {
                this.verbose(1, `WsKothDB: Periodic sync error for ${steamId}: ${error.message}`);
            }
        }
    }

    // ==================== Crash Recovery ====================

    async performCrashRecovery() {
        if (!fs.existsSync(this.kothPath)) {
            return;
        }

        this.verbose(1, 'WsKothDB: Checking for orphaned player files (crash recovery)');

        try {
            const files = await readdir(this.kothPath);
            const playerFiles = files.filter(f =>
                f.endsWith('.json') &&
                f !== 'ServerSettings.json' &&
                /^\d{17}\.json$/.test(f) // Steam ID format
            );

            if (playerFiles.length === 0) {
                this.verbose(1, 'WsKothDB: No orphaned files found');
                return;
            }

            this.verbose(1, `WsKothDB: Found ${playerFiles.length} orphaned player files`);

            // Wait for connection before recovery
            if (!this.isConnected()) {
                this.verbose(1, 'WsKothDB: Waiting for KOTH Bot connection for crash recovery...');
                // Will retry on next mount or when connection established
                return;
            }

            // Collect all player data for batch recovery
            const players = [];

            for (const file of playerFiles) {
                const steamId = file.replace('.json', '');

                try {
                    const playerData = await this.readPlayerJson(steamId);
                    if (playerData && playerData.v === 2) {
                        players.push(playerData);
                    } else {
                        this.verbose(1, `WsKothDB: Skipping non-v2 file: ${file}`);
                    }
                } catch (error) {
                    this.verbose(1, `WsKothDB: Error reading ${file}: ${error.message}`);
                }
            }

            if (players.length > 0) {
                this.kothBotSocket.emit('player:batch-crash-recovery', { players });
                this.verbose(1, `WsKothDB: Sent ${players.length} players for crash recovery`);
            }

        } catch (error) {
            this.verbose(1, `WsKothDB: Crash recovery error: ${error.message}`);
        }
    }

    // ==================== Event Handlers ====================

    async onPlayerConnected(info) {
        const steamId = info.player.steamID;
        const eosId = info.player.eosID || '';
        const name = info.player.name || '';

        this.verbose(1, `WsKothDB: Player connected: ${steamId} (${name})`);

        try {
            if (this.isConnected()) {
                const result = await this.requestPlayerData(steamId, eosId, name);

                if (result && result.playerData) {
                    await this.writePlayerJson(steamId, result.playerData);
                    this.activePlayers.set(steamId, {
                        syncSeq: result.syncSeq || 0,
                        lastSync: Date.now()
                    });
                    this.verbose(1, `WsKothDB: Loaded player data for ${steamId} (seq: ${result.syncSeq})`);
                } else {
                    // New player - KOTH Bot will create and return default data
                    this.verbose(1, `WsKothDB: New player ${steamId}, using default data from KOTH Bot`);
                    this.activePlayers.set(steamId, {
                        syncSeq: 0,
                        lastSync: Date.now()
                    });
                }
                return;
            }

            // Fallback: try to use cached v2 JSON if available
            const cached = await this.readPlayerJson(steamId);
            if (cached && cached.v === 2) {
                this.verbose(1, `WsKothDB: Using cached v2 data for ${steamId} (KOTH Bot unavailable)`);
                this.activePlayers.set(steamId, {
                    syncSeq: cached.syncSeq || 0,
                    lastSync: Date.now()
                });
                return;
            }

            // Create default v2 save
            this.verbose(1, `WsKothDB: Creating default v2 save for ${steamId} (no connection)`);
            const defaultSave = this.createDefaultV2Save(steamId, eosId, name);
            await this.writePlayerJson(steamId, defaultSave);
            this.activePlayers.set(steamId, {
                syncSeq: 0,
                lastSync: Date.now()
            });

        } catch (error) {
            this.verbose(1, `WsKothDB: Error loading player ${steamId}: ${error.message}`);

            // Create default on error
            const defaultSave = this.createDefaultV2Save(steamId, eosId, name);
            await this.writePlayerJson(steamId, defaultSave);
            this.activePlayers.set(steamId, {
                syncSeq: 0,
                lastSync: Date.now()
            });
        }
    }

    async onPlayerDisconnected(info) {
        const steamId = info.player.steamID;

        this.verbose(1, `WsKothDB: Player disconnected: ${steamId}`);

        try {
            const playerData = await this.readPlayerJson(steamId);

            if (!playerData) {
                this.verbose(1, `WsKothDB: No save data found for ${steamId}`);
                this.activePlayers.delete(steamId);
                return;
            }

            // Increment syncSeq for final sync
            const playerInfo = this.activePlayers.get(steamId);
            const newSyncSeq = ((playerInfo?.syncSeq) || (playerData.syncSeq) || 0) + 1;
            playerData.syncSeq = newSyncSeq;
            playerData.serverId = this.options.serverId;
            playerData.lastSync = new Date().toISOString();

            // Update file before sending
            await this.writePlayerJson(steamId, playerData);

            if (this.isConnected()) {
                this.kothBotSocket.emit('player:disconnect', playerData);
                this.verbose(1, `WsKothDB: Sent disconnect data for ${steamId} (seq: ${newSyncSeq})`);
            } else {
                this.verbose(1, `WsKothDB: KOTH Bot unavailable, keeping file for ${steamId} (crash recovery)`);
                this.activePlayers.delete(steamId);
            }

        } catch (error) {
            this.verbose(1, `WsKothDB: Error on disconnect for ${steamId}: ${error.message}`);
            this.activePlayers.delete(steamId);
        }
    }

    // ==================== Request/Response Methods ====================

    requestPlayerData(steamId, eosId, name) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject(new Error('KOTH Bot not connected'));
                return;
            }

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(steamId);
                reject(new Error('Request timeout'));
            }, this.options.requestTimeout);

            this.pendingRequests.set(steamId, {
                resolve,
                reject,
                timeout,
                eosId,
                name,
                retryCount: 0
            });

            this.kothBotSocket.emit('player:connect', {
                steamId,
                eosId,
                name
            });
        });
    }

    // ==================== File Operations ====================

    getPlayerFilePath(steamId) {
        return path.join(this.kothPath, `${steamId}.json`);
    }

    async writePlayerJson(steamId, data) {
        const filePath = this.getPlayerFilePath(steamId);

        if (this.options.dryRun) {
            this.verbose(1, `WsKothDB: [DRY RUN] Would write player file: ${filePath}`);
            this.verbose(2, `WsKothDB: [DRY RUN] Data: v=${data.v}, syncSeq=${data.syncSeq}, currency=${data.stats?.currency}`);
            return;
        }

        await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        this.verbose(2, `WsKothDB: Wrote player file: ${filePath}`);
    }

    async readPlayerJson(steamId) {
        const filePath = this.getPlayerFilePath(steamId);

        if (!fs.existsSync(filePath)) {
            return null;
        }

        try {
            const data = await readJsonSmart(filePath);
            this.verbose(2, `WsKothDB: Read player file: ${filePath}`);
            return data;
        } catch (error) {
            this.verbose(1, `WsKothDB: Error reading player file ${filePath}: ${error.message}`);
            return null;
        }
    }

    async deletePlayerJson(steamId) {
        const filePath = this.getPlayerFilePath(steamId);

        if (this.options.dryRun) {
            this.verbose(1, `WsKothDB: [DRY RUN] Would delete player file: ${filePath}`);
            return;
        }

        try {
            if (fs.existsSync(filePath)) {
                await unlink(filePath);
                this.verbose(2, `WsKothDB: Deleted player file: ${filePath}`);
            }
        } catch (error) {
            this.verbose(1, `WsKothDB: Error deleting player file ${filePath}: ${error.message}`);
        }
    }

    // ==================== Utility Methods ====================

    createDefaultV2Save(steamId, eosId, name) {
        return {
            v: 2,
            steamId: steamId,
            eosId: eosId || null,
            name: name || null,
            serverId: this.options.serverId,
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
                joinTime: new Date().toISOString(),
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
}
