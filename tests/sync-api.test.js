#!/usr/bin/env node

/**
 * Sync API Test Suite
 * Run with: npm run test:sync
 *
 * Requires the server to be running on localhost:3000
 */

import 'dotenv/config';

const API_KEY = process.env.SYNC_API_KEY || 'dev-sync-api-key-12345';
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function request(method, path, body = null, headers = {}) {
    const url = `${BASE_URL}${path}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();
    return { status: response.status, data };
}

// Test definitions
const tests = [
    {
        name: 'Health check',
        run: async () => {
            const { status, data } = await request('GET', '/api/health');
            return {
                passed: status === 200 && data.status === 'healthy',
                details: `Status: ${data.status}`
            };
        }
    },
    {
        name: 'Auth - Missing API key',
        run: async () => {
            const { status, data } = await request('POST', '/api/sync/player', {});
            return {
                passed: status === 401 && data.error?.includes('API key'),
                details: data.error
            };
        }
    },
    {
        name: 'Auth - Invalid API key',
        run: async () => {
            const { status, data } = await request('POST', '/api/sync/player', {}, { 'X-API-Key': 'wrong-key' });
            return {
                passed: (status === 401 || status === 403) && data.error?.toLowerCase().includes('invalid'),
                details: `${status}: ${data.error}`
            };
        }
    },
    {
        name: 'Validation - Missing steamId',
        run: async () => {
            const { status, data } = await request('POST', '/api/sync/player', { playerName: 'Test' }, { 'X-API-Key': API_KEY });
            return {
                passed: status === 400 && data.error?.toLowerCase().includes('steamid'),
                details: data.error
            };
        }
    },
    {
        name: 'Sync - Minimal player',
        run: async () => {
            const steamId = `765611980000${String(Date.now() % 10000).padStart(5, '0')}`;
            const { status, data } = await request('POST', '/api/sync/player', {
                steamId,
                playerName: 'MinimalTestPlayer'
            }, { 'X-API-Key': API_KEY });
            return {
                passed: status === 200 && data.success === true && data.player_id > 0,
                details: `Player ID: ${data.player_id}, Duration: ${data.duration_ms}ms`
            };
        }
    },
    {
        name: 'Sync - Full player data',
        run: async () => {
            const ts = Date.now();
            const steamId = `765611980001${String(ts % 10000).padStart(5, '0')}`;
            const eosId = `eos${ts.toString(16).slice(-16)}`;  // Unique EOS ID per run
            const { status, data } = await request('POST', '/api/sync/player', {
                steamId,
                eosId,
                playerName: 'FullDataTestPlayer',
                stats: {
                    currency: 5000,
                    currencyEarnedTotal: 15000,
                    currencySpentTotal: 10000,
                    xp: 2500,
                    xpTotal: 12500,
                    prestige: 2,
                    gamesPlayed: 50,
                    timePlayedSeconds: 180000
                },
                skins: {
                    indforSkin: 'skin_indfor_woodland',
                    bluforSkin: 'skin_blufor_desert',
                    redforSkin: 'skin_redfor_urban'
                },
                loadout: [
                    { slotNumber: 1, familyName: 'Primary', itemPath: '/weapons/rifle/ak47', itemDisplayName: 'AK-47' },
                    { slotNumber: 2, familyName: 'Secondary', itemPath: '/weapons/pistol/glock', itemDisplayName: 'Glock 17' }
                ],
                perks: ['fast_reload', 'extra_ammo', 'steady_aim'],
                permanentUnlocks: ['m4a1', 'scar_h', 'acog_scope'],
                rewards: [
                    { rewardType: 'killstreak', count: 5 },
                    { rewardType: 'headshot', count: 25 }
                ],
                kills: [
                    { victimSteamId: '76561198000000099', killCount: 10 },
                    { victimSteamId: '76561198000000098', killCount: 5 }
                ],
                vehicleKills: [
                    { vehicleName: 'tank_t72', killCount: 3 },
                    { vehicleName: 'heli_mi24', killCount: 2 }
                ],
                weaponXp: [
                    { weaponName: 'ak47', xp: 1500 },
                    { weaponName: 'm4a1', xp: 2000 }
                ]
            }, { 'X-API-Key': API_KEY });
            return {
                passed: status === 200 && data.success === true,
                details: `Player ID: ${data.player_id}, Tables: ${data.synced_tables?.length || 0}, Duration: ${data.duration_ms}ms`
            };
        }
    },
    {
        name: 'Sync - Update existing player',
        run: async () => {
            const steamId = '76561198000000001';
            // First sync
            await request('POST', '/api/sync/player', {
                steamId,
                playerName: 'UpdateTestPlayer'
            }, { 'X-API-Key': API_KEY });

            // Update sync
            const { status, data } = await request('POST', '/api/sync/player', {
                steamId,
                playerName: 'UpdateTestPlayerModified',
                stats: { currency: 9999, xp: 1234 }
            }, { 'X-API-Key': API_KEY });

            return {
                passed: status === 200 && data.success === true,
                details: `Player ID: ${data.player_id}, Duration: ${data.duration_ms}ms`
            };
        }
    },
    {
        name: 'Sync - Batch (multiple players)',
        run: async () => {
            const ts = String(Date.now() % 10000).padStart(5, '0');
            const { status, data } = await request('POST', '/api/sync/batch', {
                players: [
                    { steamId: `7656119810${ts}01`, playerName: 'BatchPlayer1', stats: { currency: 100 } },
                    { steamId: `7656119810${ts}02`, playerName: 'BatchPlayer2', stats: { currency: 200 } },
                    { steamId: `7656119810${ts}03`, playerName: 'BatchPlayer3', stats: { currency: 300 } }
                ]
            }, { 'X-API-Key': API_KEY });
            return {
                passed: status === 200 && data.success === true && data.total === 3 && data.synced === 3,
                details: `Total: ${data.total}, Synced: ${data.synced}, Failed: ${data.failed}, Duration: ${data.duration_ms}ms`
            };
        }
    },
    {
        name: 'Status - Synced player',
        run: async () => {
            const steamId = '76561198000000001';
            // Ensure player exists
            await request('POST', '/api/sync/player', { steamId, playerName: 'StatusTestPlayer' }, { 'X-API-Key': API_KEY });

            const { status, data } = await request('GET', `/api/sync/status/${steamId}`, null, { 'X-API-Key': API_KEY });
            return {
                passed: status === 200 && data.synced === true && data.last_sync !== null,
                details: `Last sync: ${data.last_sync}`
            };
        }
    },
    {
        name: 'Status - Unknown player',
        run: async () => {
            const { status, data } = await request('GET', '/api/sync/status/76561198999999999', null, { 'X-API-Key': API_KEY });
            return {
                passed: status === 200 && data.synced === false && data.last_sync === null,
                details: `Synced: ${data.synced}`
            };
        }
    },
    {
        name: 'Validation - Empty batch',
        run: async () => {
            const { status, data } = await request('POST', '/api/sync/batch', { players: [] }, { 'X-API-Key': API_KEY });
            return {
                passed: status === 400 && data.error?.toLowerCase().includes('empty') || data.error?.toLowerCase().includes('required'),
                details: data.error
            };
        }
    },
    {
        name: 'Validation - Invalid batch format',
        run: async () => {
            const { status, data } = await request('POST', '/api/sync/batch', { players: 'not-an-array' }, { 'X-API-Key': API_KEY });
            return {
                passed: status === 400 && data.error?.toLowerCase().includes('array'),
                details: data.error
            };
        }
    }
];

async function runTests() {
    console.log();
    log('═══════════════════════════════════════════════════════════', 'cyan');
    log('                    SYNC API TEST SUITE                     ', 'cyan');
    log('═══════════════════════════════════════════════════════════', 'cyan');
    console.log();
    log(`Base URL: ${BASE_URL}`, 'dim');
    log(`API Key: ${API_KEY.substring(0, 8)}...`, 'dim');
    console.log();

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        process.stdout.write(`  ${test.name.padEnd(35)}`);

        try {
            const result = await test.run();

            if (result.passed) {
                passed++;
                log('✓ PASSED', 'green');
                if (result.details) {
                    log(`    ${result.details}`, 'dim');
                }
            } else {
                failed++;
                log('✗ FAILED', 'red');
                if (result.details) {
                    log(`    ${result.details}`, 'yellow');
                }
            }
        } catch (error) {
            failed++;
            log('✗ ERROR', 'red');
            log(`    ${error.message}`, 'yellow');
        }
    }

    console.log();
    log('═══════════════════════════════════════════════════════════', 'cyan');
    log(`  Results: ${passed} passed, ${failed} failed, ${tests.length} total`, passed === tests.length ? 'green' : 'yellow');
    log('═══════════════════════════════════════════════════════════', 'cyan');
    console.log();

    process.exit(failed > 0 ? 1 : 0);
}

// Check if server is running first
async function checkServer() {
    try {
        await fetch(`${BASE_URL}/api/health`);
        return true;
    } catch {
        return false;
    }
}

async function main() {
    const serverRunning = await checkServer();

    if (!serverRunning) {
        log('Error: Server is not running at ' + BASE_URL, 'red');
        log('Start the server with: npm run dev', 'yellow');
        process.exit(1);
    }

    await runTests();
}

main();
