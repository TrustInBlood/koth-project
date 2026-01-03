# PlayerSave v2 Format Specification

## Overview

Player save files store individual player progression, inventory, and session tracking data. The database is the source of truth; files are working copies used during gameplay.

## File Structure

```
KOTH/
  players/
    {steamId}.json    # Combined player data + embedded tracking
  config/
    settings.json     # Server settings (see ServerSettings-v2-format.md)
    stores/...        # Store definitions
```

Each player has a single JSON file named by their Steam ID (e.g., `76561198012345678.json`).

---

## Complete Player Save Format

```json
{
  "v": 2,
  "steamId": "76561198012345678",
  "eosId": "0002a1b2c3d4e5f6...",
  "name": "PlayerName",
  "syncSeq": 42,

  "stats": {
    "currencyTotal": 25000,
    "currencySpent": 15000,
    "xp": 12500,
    "xpTotal": 50000,
    "prestige": 1,
    "permaTokens": 3,
    "dailyClaims": 7,
    "gamesPlayed": 150,
    "timePlayed": 360000,
    "joinTime": "2025-01-02T10:00:00.000Z",
    "dailyClaimTime": "2025-01-02T08:00:00.000Z"
  },

  "skins": {
    "indfor": "woodland_camo",
    "blufor": "desert_tan",
    "redfor": null
  },

  "loadout": [
    {
      "slot": 0,
      "item": "/Game/Blueprints/Items/Rifles/BP_AK74.BP_AK74_C",
      "count": 1,
      "group": "AK74"
    },
    {
      "slot": 1,
      "item": "/Game/Blueprints/Items/Pistols/BP_Makarov.BP_Makarov_C",
      "count": 1
    }
  ],

  "perks": ["Engineer", "Marksman", "AntiTank"],

  "permaUnlocks": ["AK74", "RPG7", "M4A1"],

  "supporterStatus": ["vip", "founder"],

  "tracking": {
    "kills": {
      "76561198098765432": 5,
      "76561198011111111": 12
    },
    "vehicleKills": {
      "T72B3": 3,
      "BTR80": 7
    },
    "purchases": {
      "AK74": 15,
      "RPG7": 8,
      "Medkit": 50
    },
    "weaponXp": {
      "AK74": 2500,
      "M4A1": 1800,
      "Mosin": 500
    },
    "rewards": {
      "enemyKilled": 150,
      "zoneCapture": 25,
      "vehicleDestroyed": 10
    }
  }
}
```

---

## Field Reference

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `v` | number | Yes | Format version (always `2`) |
| `steamId` | string | Yes | 17-digit Steam ID |
| `eosId` | string | No | Epic Online Services ID |
| `name` | string | No | Player display name |
| `syncSeq` | number | Yes | Monotonic sequence number for conflict resolution |

### Stats Object

| Field | Type | Description |
|-------|------|-------------|
| `currencyTotal` | number | Lifetime currency earned |
| `currencySpent` | number | Lifetime currency spent |
| `xp` | number | Current XP (resets on prestige) |
| `xpTotal` | number | Lifetime XP earned |
| `prestige` | number | Prestige level (0-100) |
| `permaTokens` | number | Permanent unlock tokens |
| `dailyClaims` | number | Consecutive daily claim streak |
| `gamesPlayed` | number | Total games/sessions played |
| `timePlayed` | number | Total time played in seconds |
| `joinTime` | string | ISO timestamp when player joined current session |
| `dailyClaimTime` | string | ISO timestamp of last daily reward claim |

**Note:** Current spendable currency is derived: `currencyTotal - currencySpent`. The game calculates this value; it is not stored or transmitted.

### Skins Object

| Field | Type | Description |
|-------|------|-------------|
| `indfor` | string\|null | Skin ID for Independent Forces |
| `blufor` | string\|null | Skin ID for Blue Forces |
| `redfor` | string\|null | Skin ID for Red Forces |

### Loadout Array

Array of equipped items. Each slot:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slot` | number | Yes | Slot index (0-based) |
| `item` | string | Yes | Full blueprint path |
| `count` | number | Yes | Item count (default 1) |
| `group` | string | No | Optional grouping identifier |

### Perks Array

Array of perk name strings. Example: `["Engineer", "Marksman"]`

### PermaUnlocks Array

Array of permanently unlocked item identifiers. Example: `["AK74", "RPG7"]`

### SupporterStatus Array

Array of supporter tier strings. Example: `["vip", "founder"]`

### Tracking Object

Session tracking data for leaderboards and statistics. All sub-objects are key-value maps with string keys and number values.

| Field | Key Type | Value | Description |
|-------|----------|-------|-------------|
| `kills` | Steam ID | count | Kills against specific players |
| `vehicleKills` | vehicle name | count | Vehicles destroyed by type |
| `purchases` | item name | count | Items purchased |
| `weaponXp` | weapon name | XP | XP earned per weapon |
| `rewards` | reward type | count | Rewards earned by type |

---

## Data Flow

### On Player Connect (DB → Game)

Game receives player data **without tracking**:

```json
{
  "steamId": "76561198012345678",
  "player": { /* stats, skins, loadout, perks, permaUnlocks, supporterStatus */ },
  "syncSeq": 42
}
```

The game builds tracking data fresh during the session. Historical tracking is for leaderboards/dashboard only.

### During Gameplay (Periodic Sync, every 60s)

Game sends **full data including tracking** to DB:

```json
{
  "v": 2,
  "steamId": "...",
  "stats": { /* current stats */ },
  "loadout": [ /* current loadout */ ],
  "tracking": { /* session tracking */ },
  ...
}
```

This protects against data loss on crash.

### On Player Disconnect

Game sends **full data including tracking** to DB, then deletes the local file.

### On Crash Recovery

When server restarts, any orphaned player files are sent to DB for recovery, then deleted.

---

## Sync Sequence (`syncSeq`)

The `syncSeq` field is a monotonic counter used for conflict resolution:

1. Increments on every sync (periodic, disconnect)
2. DB rejects syncs with `syncSeq` lower than stored value (stale data)
3. Large jumps in `syncSeq` trigger abuse flagging

---

## Default Values (New Player)

```json
{
  "v": 2,
  "steamId": "...",
  "eosId": null,
  "name": null,
  "syncSeq": 0,
  "stats": {
    "currencyTotal": 0,
    "currencySpent": 0,
    "xp": 0,
    "xpTotal": 0,
    "prestige": 0,
    "permaTokens": 0,
    "dailyClaims": 0,
    "gamesPlayed": 0,
    "timePlayed": 0,
    "joinTime": null,
    "dailyClaimTime": null
  },
  "skins": {
    "indfor": null,
    "blufor": null,
    "redfor": null
  },
  "loadout": [],
  "perks": [],
  "permaUnlocks": [],
  "supporterStatus": [],
  "tracking": {
    "kills": {},
    "vehicleKills": {},
    "purchases": {},
    "weaponXp": {},
    "rewards": {}
  }
}
```

---

## Key Differences from v1

| Aspect | v1 | v2 |
|--------|----|----|
| File structure | 2 files (player + tracking) | 1 combined file |
| Key naming | Spaces (`"family name"`) | camelCase (`"familyName"`) |
| Currency key | `"$"` | `"currency"` |
| Nesting | Deep (`"player info"."save data"`) | Flat |
| Tracking on connect | Sent to game | Not sent (game builds fresh) |
| Sync strategy | Disconnect only | Periodic (60s) + disconnect |

---

## Validation Rules

### Steam ID
- Exactly 17 digits
- String type

### Stats
- All numeric fields must be non-negative
- `prestige` must be 0-100

### Loadout
- Each item must have `slot` (number) and `item` (string)
- `count` defaults to 1 if not provided

### Tracking
- All values must be non-negative numbers
- Keys are strings (Steam IDs, item names, etc.)

---

## Anti-Abuse Delta Limits

Per-sync limits that trigger flagging (not rejection):

| Stat | Max Change Per Sync |
|------|---------------------|
| `currencyTotal` | +50,000 |
| `currencySpent` | +50,000 |
| `xp` | +100,000 |
| `prestige` | +1 |
| `permaTokens` | +10 |
| `timePlayed` | +7,200 (2 hours) |

Exceeding these limits flags the sync for manual review but does not reject it.
