# ServerSettings v2 Format Specification

## Overview

ServerSettings defines the game server configuration: store items, economy settings, rewards, and gameplay parameters. This document specifies the v2 format with clean camelCase keys.

## File Structure

The v1 monolithic `ServerSettings.json` (17k+ lines) is split into logical files:

```
KOTH/
  config/
    settings.json       # Server settings (economy, zones, rewards, etc.)
    stores/
      indfor.json       # Independent Forces store
      blufor.json       # Blue Forces store
      redfor.json       # Red Forces store
```

---

## settings.json

Top-level server configuration.

```json
{
  "v": 2,
  "saveVersion": {
    "text": "v2.0",
    "major": 2,
    "minor": 0
  },
  "lastUpdated": "2025-11-11T20:00:28.901Z",

  "modLoader": [
    "/KingOfTheHill/Blueprints/BP_Init.BP_Init_C",
    "/SquadJSLogger/BP_SquadJSLogger.BP_SquadJSLogger_C"
  ],

  "economy": {
    "currencyMultiplier": 2,
    "xpMultiplier": 1,
    "weaponXpMultiplier": 6
  },

  "dailyRewards": {
    "checkInterval": 60,
    "delayMinutes": 20,
    "claimAmounts": [1000, 1000, 2000, 2000, 4000, 4000, 8000, 8000, 8000, 10000, 10000, 12000, 12000, 20000],
    "permaTokenDays": 14
  },

  "intel": {
    "prio": 100,
    "zone": 50,
    "zoneAssist": 0.5,
    "prioAssist": 1
  },

  "bounties": {
    "intelRequired": 2000,
    "topBountyPing": true,
    "bountyPing": false,
    "ghostRadius": 3000,
    "bountyAssist": 0.5
  },

  "zone": {
    "moveInterval": 300,
    "moveFraction": 0.5,
    "directionRandomWeight": 0.5,
    "radiusMultiplier": 1,
    "prioRadiusMultiplier": 1,
    "halfHeight": 30000,
    "rewardUpdateInterval": 30,
    "vehicleCanCapture": false,
    "prioVehicleCanCapture": true
  },

  "vehicleCleanup": {
    "burnDamage": 12.5,
    "burnInterval": 1,
    "burnDelay": 300,
    "wreckClearTime": 600
  },

  "haloCost": 5000,
  "maxPrestige": 1,
  "msvTimer": 60,
  "msvEnemyTraceDistance": 3000,
  "mainProtectionTime": 1,

  "tkPenalties": [-100, -100, -100, -100, -100, -100, -100, -200, -300, -400, -500, -1000, -2000, -3000, -4000, -5000, -10000],

  "rewards": {
    "enemyKilled": {
      "name": "Enemy Killed",
      "xp": 100,
      "currency": 100,
      "description": "Awarded for enemy KIA.",
      "texture": "/Game/UI/RadialMenu/Icons/map_mine.map_mine",
      "displayReward": true
    }
  },

  "grenadierReferences": [
    {
      "parent": "/Game/Blueprints/Items/Rifles/BP_M16A4M203_Rifle.BP_M16A4M203_Rifle_C",
      "items": [
        "/Game/Blueprints/Items/GrenadeLaunchers/M16A4M203_UGL/BP_M16A4M203_UGL_HE.BP_M16A4M203_UGL_HE_C",
        "/Game/Blueprints/Items/GrenadeLaunchers/M16A4M203_UGL/BP_M16A4M203_UGL_Smoke.BP_M16A4M203_UGL_Smoke_C"
      ]
    }
  ]
}
```

---

## Store Files (indfor.json, blufor.json, redfor.json)

Each faction has its own store file with categorized items.

```json
{
  "v": 2,
  "faction": "indfor",

  "categories": {
    "freeItems": [
      {
        "item": "/KingOfTheHill/Blueprints/Items/Surrender/BP_Surrender_KOTH.BP_Surrender_KOTH_C",
        "slot": 0,
        "itemCount": 1
      }
    ],

    "primary": [
      {
        "group": "Mosin",
        "singleCost": 50,
        "permaCost": 800,
        "description": "A Russian bolt-action rifle...",
        "texture": "/Game/UI/HUD/Inventory/Weapons/Rifles/mosinm1891.mosinm1891",
        "unlockLevel": 0,
        "xpUnlocks": [
          {
            "item": "/Game/Blueprints/Items/Rifles/BP_Mosin_M1891.BP_Mosin_M1891_C",
            "unlockLevel": 0,
            "perkRequirements": [],
            "itemCount": -1,
            "prestige": 0
          },
          {
            "item": "/Game/Blueprints/Items/Rifles/BP_Mosin_M38Carbine.BP_Mosin_M38Carbine_C",
            "unlockLevel": 5,
            "perkRequirements": [],
            "itemCount": -1,
            "prestige": 0
          },
          {
            "item": "/Game/Blueprints/Items/Rifles/BP_Mosin_M1891_Sniper.BP_Mosin_M1891_Sniper_C",
            "unlockLevel": 10,
            "perkRequirements": ["Marksman"],
            "itemCount": -1,
            "prestige": 0
          }
        ]
      }
    ],

    "secondary": [
      {
        "group": "M1911",
        "singleCost": 25,
        "permaCost": 400,
        "description": "Classic .45 ACP pistol...",
        "texture": "/Game/UI/HUD/Inventory/Weapons/Pistols/m1911.m1911",
        "unlockLevel": 0,
        "xpUnlocks": [
          {
            "item": "/Game/Blueprints/Items/Pistols/BP_M1911.BP_M1911_C",
            "unlockLevel": 0,
            "perkRequirements": [],
            "itemCount": -1,
            "prestige": 0
          }
        ]
      }
    ],

    "special": [
      {
        "group": "RPG",
        "singleCost": 500,
        "permaCost": 5000,
        "description": "Anti-tank rocket launcher...",
        "texture": "/Game/UI/HUD/Inventory/Weapons/Launchers/rpg7.rpg7",
        "unlockLevel": 20,
        "xpUnlocks": [
          {
            "item": "/Game/Blueprints/Items/Launchers/BP_RPG7.BP_RPG7_C",
            "unlockLevel": 0,
            "perkRequirements": ["AntiTank"],
            "itemCount": 2,
            "prestige": 0
          }
        ]
      }
    ],

    "deployables": [
      {
        "group": "RazorWire",
        "singleCost": 10,
        "permaCost": -1,
        "description": "Slows down and damages enemies.",
        "texture": "/Game/UI/HUD/Inventory/Weapons/Equipment/razorwire.razorwire",
        "unlockLevel": 5,
        "xpUnlocks": [
          {
            "item": "/Game/Blueprints/Items/EquippableItems/BP_Infantry_Razorwire.BP_Infantry_Razorwire_C",
            "unlockLevel": 0,
            "perkRequirements": [],
            "itemCount": -1,
            "prestige": 0
          }
        ]
      }
    ],

    "vehicles": [
      {
        "name": "RHIB",
        "vehicle": "/Game/Vehicles/RHIB/BP_RHIB_Transport.BP_RHIB_Transport_C",
        "singleCost": 200,
        "description": "A not-so-bulletproof rubber boat.",
        "unlockLevel": 0,
        "texture": "/Game/UI/Widgets/Vehicles/VehicleMapIcons/map_boat.map_boat",
        "spawnType": "Sea Vehicle",
        "killXpReward": 50,
        "killCurrencyReward": 66,
        "prestige": 0
      },
      {
        "name": "T-72B3",
        "vehicle": "/Game/Vehicles/Tanks/BP_T72B3.BP_T72B3_C",
        "singleCost": 5000,
        "description": "Main battle tank.",
        "unlockLevel": 50,
        "texture": "/Game/UI/Widgets/Vehicles/VehicleMapIcons/map_tank.map_tank",
        "spawnType": "Ground Vehicle",
        "killXpReward": 500,
        "killCurrencyReward": 1000,
        "prestige": 1,
        "crewman": true
      }
    ],

    "perks": [
      {
        "name": "Engineer",
        "description": "Gives you an Engineer Shovel",
        "texture": "/Game/UI/HUD/Inventory/Weapons/Equipment/entrenchingtool.entrenchingtool",
        "material": "None",
        "unlockLevel": 0,
        "unlockItems": [
          "/Game/Blueprints/Items/EquippableItems/BP_EntrenchingTool_Engineer.BP_EntrenchingTool_Engineer_C"
        ],
        "prestige": 0
      },
      {
        "name": "Marksman",
        "description": "Unlocks scoped rifles",
        "texture": "/Game/UI/HUD/Inventory/Weapons/Equipment/scope.scope",
        "material": "None",
        "unlockLevel": 10,
        "unlockItems": [],
        "prestige": 0
      }
    ],

    "skins": [
      {
        "name": "Woodland Camo",
        "description": "Forest camouflage pattern",
        "texture": "/Game/UI/Skins/woodland.woodland",
        "imageUrl": "https://example.com/skins/woodland.png",
        "model1p": "/Game/Characters/Skins/1P/BP_Skin_Woodland.BP_Skin_Woodland_C",
        "model3p": "/Game/Characters/Skins/3P/BP_Skin_Woodland.BP_Skin_Woodland_C",
        "materials1p": [],
        "materials3p": [],
        "upper1p": null,
        "upper1pMaterials": []
      }
    ],

    "communityTab": [
      {
        "name": "VIP Package",
        "description": "Support the server!",
        "imageUrl": "https://example.com/vip.png"
      }
    ]
  }
}
```

---

## Key Renames (v1 → v2)

| v1 Key | v2 Key |
|--------|--------|
| `"family name"` | `"group"` |
| `"single cost"` | `"singleCost"` |
| `"perma cost"` | `"permaCost"` |
| `"xp unlocks"` | `"xpUnlocks"` |
| `"unlock level"` | `"unlockLevel"` |
| `"unlock items"` | `"unlockItems"` |
| `"item count"` | `"itemCount"` |
| `"perk requirements"` | `"perkRequirements"` |
| `"kill $ reward"` | `"killCurrencyReward"` |
| `"kill xp reward"` | `"killXpReward"` |
| `"spawn type"` | `"spawnType"` |
| `"image url"` / `"url"` | `"imageUrl"` |
| `"display reward"` | `"displayReward"` |
| `"$ multiplier"` | `"currencyMultiplier"` |
| `"xp multiplier"` | `"xpMultiplier"` |
| `"weapon xp multiplier"` | `"weaponXpMultiplier"` |
| `"$"` (in rewards) | `"currency"` |
| `"1p"` | `"model1p"` |
| `"3p"` | `"model3p"` |
| `"1p materials"` | `"materials1p"` |
| `"3p materials"` | `"materials3p"` |
| `"upper1p materials"` | `"upper1pMaterials"` |
| `"save version"` | `"saveVersion"` |
| `"update info"` | `"lastUpdated"` (ISO string) |

---

## Store Category Names (v1 → v2)

| v1 Category | v2 Category |
|-------------|-------------|
| `"free shit"` | `"freeItems"` |
| `"primary"` | `"primary"` |
| `"secondary"` | `"secondary"` |
| `"special"` | `"special"` |
| `"deployables"` | `"deployables"` |
| `"vehicles"` | `"vehicles"` |
| `"perks"` | `"perks"` |
| `"skins"` | `"skins"` |
| `"community tab"` | `"communityTab"` |

---

## Item Types

### Weapon Item (Primary/Secondary/Special)

```typescript
interface WeaponItem {
  group?: string;              // Optional grouping for UI (replaces "family name")
  singleCost: number | string; // Cost for single purchase
  permaCost: number;           // Cost for permanent unlock (-1 = not available)
  description: string;
  texture: string;             // UI icon path
  unlockLevel: number;         // Player level required
  xpUnlocks: XpUnlock[];       // Variants unlocked at weapon XP levels
}

interface XpUnlock {
  item: string;                // Blueprint path
  unlockLevel: number;         // Weapon XP level required
  perkRequirements: string[];  // Required perks
  itemCount: number;           // -1 = unlimited, positive = limited count
  prestige: number;            // Prestige level required
}
```

### Vehicle Item

```typescript
interface VehicleItem {
  name: string;
  vehicle: string;             // Blueprint path
  singleCost: number;
  description: string;
  unlockLevel: number;
  texture: string;
  spawnType: string;           // "Ground Vehicle", "Air Vehicle", "Sea Vehicle"
  killXpReward: number;
  killCurrencyReward: number;
  prestige: number;
  crewman?: boolean;           // Requires crewman kit
}
```

### Perk Item

```typescript
interface PerkItem {
  name: string;
  description: string;
  texture: string;
  material: string;
  unlockLevel: number;
  unlockItems: string[];       // Items granted by this perk
  prestige: number;
}
```

### Skin Item

```typescript
interface SkinItem {
  name: string;
  description: string;
  texture: string;
  imageUrl?: string;
  model1p?: string;
  model3p?: string;
  materials1p?: string[];
  materials3p?: string[];
  upper1p?: string;
  upper1pMaterials?: string[];
}
```

---

## Notes

1. **`group` field**: Replaces `"family name"`. Optional field for UI grouping. Can be used to group weapon variants, organize store categories, etc.

2. **Costs as numbers**: v1 sometimes used strings for costs (`"50"`). v2 should use numbers (`50`).

3. **`permaCost: -1`**: Indicates item cannot be permanently unlocked.

4. **`itemCount: -1`**: Indicates unlimited spawns/uses.

5. **Arrays not objects**: `rewards` and `grenadierReferences` use arrays in v2, not objects with numeric string keys.

6. **ISO timestamps**: `lastUpdated` uses ISO 8601 format instead of separate year/month/day fields.
