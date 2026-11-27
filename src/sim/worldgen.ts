import {
  BIOME_CONSTANTS,
  BOSS_CONSTANTS,
  PATRON_CONSTANTS,
  type ArenaDoor,
  type ArenaObstacle,
  type BiomeId,
  type EncounterKind,
  type EnemyArchetypeId,
  type HazardState,
  type PatronId,
  type PickupItem,
  type RewardPreview,
  type RoomState,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import {
  getBiomeEncounterTable,
  getRoomTemplate,
  type RoomTemplateDef,
} from '../data/biomes.js';
import { WAVE1_PATRONS } from '../data/boons.js';
import { getKeepsakeForcedPatron } from '../data/keepsakes.js';
import {
  detNextFloat,
  detNextInt,
  detPick,
  getEffectiveMirrorUpgrade,
  getShopPriceMultiplier,
  type RngProvider,
} from './meta.js';

export interface PlannedSpawn {
  archetype: EnemyArchetypeId;
  pos: Vec2;
  elite: boolean;
  isMiniBoss?: boolean;
}

// ============================================================================
// Reward & Door Generation
// ============================================================================

function pickPatronForReward(
  state: SimState,
  exclude: ReadonlySet<PatronId>,
  ctx?: RngProvider
): PatronId {
  // Respect patron keepsake on first available offer
  if (state.player.keepsakeId && !state.player.keepsakeUsed) {
    const forced = getKeepsakeForcedPatron(state.player.keepsakeId);
    if (forced && !exclude.has(forced)) {
      return forced;
    }
  }

  const available = WAVE1_PATRONS.filter((p) => !exclude.has(p));
  const pool = available.length > 0 ? available : WAVE1_PATRONS;
  return detPick(state, pool, ctx);
}

export function buildRewardPreview(
  state: SimState,
  kind: RewardPreview['kind'],
  patronId?: PatronId,
  flags?: Partial<RewardPreview>
): RewardPreview {
  if (kind === 'boon') {
    const pId = patronId ?? 'voltaris';
    return {
      kind: 'boon',
      patronId: pId,
      label: `${PATRON_CONSTANTS[pId].displayName} Boon`,
      ...flags,
    };
  }
  if (kind === 'pom') {
    return { kind: 'pom', label: 'Pom of Power', ...flags };
  }
  if (kind === 'centaur_heart') {
    return { kind: 'centaur_heart', label: 'Centaur Heart (+25 HP)', ...flags };
  }
  if (kind === 'hammer') {
    return { kind: 'hammer', label: 'Forge Hammer', ...flags };
  }
  if (kind === 'gold') {
    return { kind: 'gold', label: 'Vault of Gold', ...flags };
  }
  if (kind === 'darkness') {
    return { kind: 'darkness', label: 'Darkness Trove', ...flags };
  }
  if (kind === 'fountain') {
    return { kind: 'fountain', label: 'Sanctum Fountain', ...flags };
  }
  if (kind === 'shop_item') {
    return { kind: 'shop_item', label: 'Ferryman Shop', isShop: true, ...flags };
  }
  return { kind, label: kind.replace(/_/g, ' '), ...flags };
}

export function generateExitDoors(
  state: SimState,
  biome: BiomeId,
  depth: number,
  encounterKind: EncounterKind,
  bounds: RoomState['bounds'],
  ctx?: RngProvider
): ArenaDoor[] {
  const table = getBiomeEncounterTable(biome);

  // Courtyard has the single glowing Northern Escape Gate into Obsidian Pit Depth 1
  if (biome === 'sanctum_hub') {
    return [
      {
        id: 'door_courtyard_escape',
        pos: { x: 0, y: bounds.minY + 58 },
        direction: 'north',
        locked: false,
        targetBiome: 'obsidian_pit',
        reward: {
          kind: 'boon',
          patronId: 'voltaris',
          label: 'Begin Escape — Obsidian Pit',
        },
      },
    ];
  }

  // Boss room cleared -> Biome Transition Portal (or Victory on Frozen Summit)
  if (encounterKind === 'boss' || encounterKind === 'surface_boss') {
    if (!table.nextBiome) {
      return [];
    }
    const nextBiomeDef = BIOME_CONSTANTS[table.nextBiome];
    return [
      {
        id: `door_portal_${table.nextBiome}`,
        pos: { x: 0, y: bounds.minY + 62 },
        direction: 'portal',
        locked: true,
        targetBiome: table.nextBiome,
        reward: {
          kind: 'fountain',
          label: `Ascend to ${nextBiomeDef.displayName}`,
        },
      },
    ];
  }

  const bossDepth = table.def.bossDepth;

  // Next room is the Biome Boss!
  if (depth + 1 >= bossDepth) {
    const bossDef = BOSS_CONSTANTS[table.bossId];
    return [
      {
        id: `door_boss_${table.bossId}`,
        pos: { x: 0, y: bounds.minY + 62 },
        direction: 'north',
        locked: true,
        reward: {
          kind: 'titan_blood',
          label: `${bossDef.displayName} (Boss)`,
          isBoss: true,
        },
      },
    ];
  }

  // Pre-boss chamber offers Shop + regular exit; otherwise 2 or 3 branching doors
  const doorCount =
    depth === bossDepth - 2 ? 2 : detNextFloat(state, ctx) < 0.45 ? 3 : 2;
  const positions: readonly { pos: Vec2; dir: ArenaDoor['direction'] }[] =
    doorCount === 3
      ? [
          { pos: { x: -290, y: bounds.minY + 66 }, dir: 'west' },
          { pos: { x: 0, y: bounds.minY + 56 }, dir: 'north' },
          { pos: { x: 290, y: bounds.minY + 66 }, dir: 'east' },
        ]
      : [
          { pos: { x: -210, y: bounds.minY + 62 }, dir: 'west' },
          { pos: { x: 210, y: bounds.minY + 62 }, dir: 'east' },
        ];

  const foresight = getEffectiveMirrorUpgrade(
    state.meta,
    state.run.vows,
    'patron_favor'
  );
  const goldBoonBias = foresight.side === 'b' ? foresight.value : 0;

  const usedPatrons = new Set<PatronId>();
  const usedKinds = new Set<string>();
  const doors: ArenaDoor[] = [];

  for (let i = 0; i < positions.length; i++) {
    let reward: RewardPreview;

    if (depth === bossDepth - 2 && i === 0) {
      reward = buildRewardPreview(state, 'shop_item', undefined, { isShop: true });
    } else if (depth === Math.floor(bossDepth / 2) && i === 0 && encounterKind !== 'miniboss') {
      const p = pickPatronForReward(state, usedPatrons, ctx);
      usedPatrons.add(p);
      reward = buildRewardPreview(state, 'boon', p, {
        isMiniBoss: true,
        label: `${PATRON_CONSTANTS[p].displayName} Boon (Mini-Boss)`,
      });
    } else if (i === 0) {
      // Guarantee at least one exciting Boon / Pom / Hammer door
      const roll = detNextFloat(state, ctx);
      if (state.run.hammersCollected < 2 && depth >= 3 && roll < 0.22) {
        reward = buildRewardPreview(state, 'hammer');
      } else if (state.player.boons.length > 0 && roll < 0.42) {
        reward = buildRewardPreview(state, 'pom');
      } else {
        const p = pickPatronForReward(state, usedPatrons, ctx);
        usedPatrons.add(p);
        reward = buildRewardPreview(state, 'boon', p);
      }
    } else {
      const roll = detNextFloat(state, ctx);
      if (roll < 0.36 + goldBoonBias) {
        const p = pickPatronForReward(state, usedPatrons, ctx);
        usedPatrons.add(p);
        reward = buildRewardPreview(state, 'boon', p);
      } else if (roll < 0.56 && !usedKinds.has('centaur_heart')) {
        reward = buildRewardPreview(state, 'centaur_heart');
      } else if (roll < 0.74 && !usedKinds.has('pom') && state.player.boons.length > 0) {
        reward = buildRewardPreview(state, 'pom');
      } else if (roll < 0.88 && !usedKinds.has('gold')) {
        reward = buildRewardPreview(state, 'gold');
      } else if (depth >= 4 && !usedKinds.has('shop_item') && encounterKind !== 'shop') {
        reward = buildRewardPreview(state, 'shop_item', undefined, { isShop: true });
      } else {
        reward = buildRewardPreview(state, 'darkness');
      }
    }

    usedKinds.add(reward.kind);
    doors.push({
      id: `door_${biome}_${depth}_${i}`,
      pos: positions[i].pos,
      direction: positions[i].dir,
      locked: true,
      reward,
    });
  }

  return doors;
}

// ============================================================================
// Room Construction from Handcrafted Isometric Templates
// ============================================================================

export function selectTemplateForEncounter(
  state: SimState,
  biome: BiomeId,
  encounterKind: EncounterKind,
  ctx?: RngProvider
): RoomTemplateDef {
  const table = getBiomeEncounterTable(biome);
  if (biome === 'sanctum_hub' || encounterKind === 'hub') {
    return getRoomTemplate('sanctum_courtyard');
  }
  if (encounterKind === 'boss' || encounterKind === 'surface_boss') {
    return getRoomTemplate(table.bossTemplate);
  }
  if (encounterKind === 'shop') {
    return getRoomTemplate(table.shopTemplate);
  }
  if (encounterKind === 'fountain' || encounterKind === 'story') {
    return getRoomTemplate(table.fountainTemplate);
  }
  const tplId = detPick(state, table.combatTemplates, ctx);
  return getRoomTemplate(tplId);
}

export function buildRoomState(
  state: SimState,
  biome: BiomeId,
  depth: number,
  encounterKind: EncounterKind,
  roomIndex: number,
  templateIdOverride?: string,
  ctx?: RngProvider
): { room: RoomState; template: RoomTemplateDef } {
  const template = templateIdOverride
    ? getRoomTemplate(templateIdOverride)
    : selectTemplateForEncounter(state, biome, encounterKind, ctx);

  const halfW = template.width * 0.5;
  const halfH = template.height * 0.5;
  const bounds = {
    minX: -halfW,
    maxX: halfW,
    minY: -halfH,
    maxY: halfH,
  };

  const obstacles: ArenaObstacle[] = template.obstacles.map((o, idx) => ({
    id: `obs_${template.id}_${idx}`,
    kind: o.kind,
    pos: { x: o.x, y: o.y },
    halfW: o.halfW,
    halfH: o.halfH,
    radius: o.radius,
    blocksMovement: true,
    blocksProjectiles: o.kind !== 'pit',
    destructible: o.kind === 'destructible_urn',
    hp: o.hp,
    maxHp: o.hp,
  }));

  const heightenedMult =
    (state.run.vows.heightened_security ?? 0) > 0 ? 5.0 : 1.0;

  const hazards: HazardState[] = template.hazards.map((h, idx) => ({
    id: `haz_${template.id}_${idx}`,
    kind: h.kind,
    pos: { x: h.x, y: h.y },
    radius: h.radius,
    active: h.kind === 'lava_pool' || h.kind === 'poison_pool' || h.kind === 'curing_pool',
    armed: false,
    timer: idx * 0.7,
    cooldown: h.cooldown ?? 3.2,
    damage: Math.round(h.damage * heightenedMult),
    owner: 'environment',
  }));

  const isPeaceful =
    encounterKind === 'hub' ||
    encounterKind === 'shop' ||
    encounterKind === 'fountain' ||
    encounterKind === 'story';

  const table = getBiomeEncounterTable(biome);
  let totalWaves = 0;
  if (!isPeaceful) {
    if (encounterKind === 'boss' || encounterKind === 'surface_boss') {
      totalWaves = 1;
    } else if (encounterKind === 'miniboss') {
      totalWaves = 1;
    } else if (depth === 1 && biome === 'obsidian_pit') {
      totalWaves = 2;
    } else {
      totalWaves = Math.min(3, table.baseWaveCount + (depth >= 6 ? 1 : 0));
    }
  }

  const doors = generateExitDoors(
    state,
    biome,
    depth,
    encounterKind,
    bounds,
    ctx
  );
  if (isPeaceful) {
    for (const d of doors) {
      d.locked = false;
    }
  }

  const zoomRange = BIOME_CONSTANTS[biome].zoomRange;
  const zoom =
    encounterKind === 'boss' || encounterKind === 'surface_boss'
      ? zoomRange[0]
      : (zoomRange[0] + zoomRange[1]) * 0.5;

  const room: RoomState = {
    biome,
    depth,
    roomIndex,
    templateId: template.id,
    encounterKind,
    width: template.width,
    height: template.height,
    bounds,
    waveIndex: 0,
    totalWaves,
    cleared: isPeaceful,
    combatStarted: !isPeaceful,
    encounterTimer: 0,
    noDamageTaken: true,
    obstacles,
    doors,
    hazards,
    pickups: [],
    bloodstones: [],
    telegraphs: [],
    zoom,
  };

  return { room, template };
}

// ============================================================================
// Wave Roster & Shop Pickup Generators
// ============================================================================

export function planWaveSpawns(
  state: SimState,
  biome: BiomeId,
  depth: number,
  encounterKind: EncounterKind,
  waveIndex: number,
  template: RoomTemplateDef,
  ctx?: RngProvider
): PlannedSpawn[] {
  const table = getBiomeEncounterTable(biome);
  const spawns: PlannedSpawn[] = [];
  const points =
    template.spawnPoints.length > 0
      ? template.spawnPoints
      : [
          { x: -320, y: -180 },
          { x: 320, y: -180 },
          { x: 0, y: -240 },
          { x: -360, y: 100 },
          { x: 360, y: 100 },
        ];

  if (encounterKind === 'miniboss') {
    const miniArch = detPick(state, table.miniBossArchetypes, ctx);
    spawns.push({
      archetype: miniArch,
      pos: { x: 0, y: -190 },
      elite: true,
      isMiniBoss: true,
    });
    const escortCount = (state.run.vows.middle_management ?? 0) > 0 ? 3 : 2;
    for (let i = 0; i < escortCount; i++) {
      const p = points[(i + 1) % points.length];
      spawns.push({
        archetype: detPick(state, table.commonEnemies, ctx),
        pos: { x: p.x, y: p.y },
        elite: false,
      });
    }
    return spawns;
  }

  const juryRank = Math.max(
    0,
    Math.min(3, Math.floor(state.run.vows.jury_summons ?? 0))
  );
  const countScale = 1 + juryRank * 0.2;
  const baseCount =
    biome === 'obsidian_pit' && depth === 1 && waveIndex === 0
      ? 3
      : table.baseEnemiesPerWave + Math.floor(depth / 4) + (waveIndex > 0 ? 1 : 0);
  const totalCount = Math.max(2, Math.min(8, Math.round(baseCount * countScale)));

  const eliteChance = Math.min(
    0.55,
    table.eliteChanceBase + depth * 0.025 + waveIndex * 0.08
  );

  for (let i = 0; i < totalCount; i++) {
    const basePt = points[(i + waveIndex * 2) % points.length];
    const jitterX = (detNextFloat(state, ctx) - 0.5) * 70;
    const jitterY = (detNextFloat(state, ctx) - 0.5) * 50;
    const pos: Vec2 = {
      x: Math.max(
        state.room.bounds.minX + 95,
        Math.min(state.room.bounds.maxX - 95, basePt.x + jitterX)
      ),
      y: Math.max(
        state.room.bounds.minY + 95,
        Math.min(state.room.bounds.maxY - 95, basePt.y + jitterY)
      ),
    };

    const roleRoll = detNextFloat(state, ctx);
    let archetype: EnemyArchetypeId;
    if (roleRoll < 0.48) {
      archetype = detPick(state, table.commonEnemies, ctx);
    } else if (roleRoll < 0.8 && table.rangedEnemies.length > 0) {
      archetype = detPick(state, table.rangedEnemies, ctx);
    } else if (table.heavyEnemies.length > 0) {
      archetype = detPick(state, table.heavyEnemies, ctx);
    } else {
      archetype = detPick(state, table.commonEnemies, ctx);
    }

    const elite =
      depth >= 2 &&
      (waveIndex > 0 || depth >= 4) &&
      detNextFloat(state, ctx) < eliteChance;

    spawns.push({ archetype, pos, elite });
  }

  return spawns;
}

export function buildShopPickups(
  state: SimState,
  ctx?: RngProvider
): PickupItem[] {
  const priceMult = getShopPriceMultiplier(state.run.vows);
  const patron = pickPatronForReward(state, new Set(), ctx);
  const patronDef = PATRON_CONSTANTS[patron];

  return [
    {
      id: `shop_boon_${state.room.roomIndex}`,
      kind: 'boon',
      pos: { x: -210, y: -40 },
      radius: 36,
      label: `${patronDef.displayName} Boon (${Math.round(150 * priceMult)}g)`,
      costGold: Math.round(150 * priceMult),
      patronId: patron,
      collected: false,
      colorHex: patronDef.colorHex,
    },
    {
      id: `shop_heart_${state.room.roomIndex}`,
      kind: 'centaur_heart',
      pos: { x: 0, y: -40 },
      radius: 36,
      label: `Centaur Heart (${Math.round(125 * priceMult)}g)`,
      costGold: Math.round(125 * priceMult),
      amount: 25,
      collected: false,
      colorHex: '#ff4d6d',
    },
    {
      id: `shop_food_${state.room.roomIndex}`,
      kind: 'heal_food',
      pos: { x: 210, y: -40 },
      radius: 34,
      label: `Ambrosial Roast +40% HP (${Math.round(50 * priceMult)}g)`,
      costGold: Math.round(50 * priceMult),
      amount: 40,
      collected: false,
      colorHex: '#63d471',
    },
  ];
}
