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
import { STANDARD_PATRONS } from '../data/boons.js';
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

export interface RoomGenOptions {
  styxWingsCleared?: number;
  satyrSackFound?: boolean;
  hasLoyaltyCard?: boolean;
  templateIdOverride?: string;
}

// ============================================================================
// Reward & Door Generation (ALL 10 Patrons, Trials, Chaos Gates, Styx 5-Wings!)
// ============================================================================

export function pickPatronForReward(
  state: SimState,
  exclude: ReadonlySet<PatronId>,
  ctx?: RngProvider,
  allowVeloce = true
): PatronId {
  if (state.player.keepsakeId && !state.player.keepsakeUsed) {
    const forced = getKeepsakeForcedPatron(state.player.keepsakeId);
    if (forced && !exclude.has(forced)) {
      return forced;
    }
  }

  // Veloce (Swiftness) appears as a bonus auxiliary Patron from depth >= 3
  if (
    allowVeloce &&
    state.room.depth >= 3 &&
    !exclude.has('veloce') &&
    detNextFloat(state, ctx) < 0.14
  ) {
    return 'veloce';
  }

  const available = STANDARD_PATRONS.filter((p) => !exclude.has(p));
  const pool = available.length > 0 ? available : STANDARD_PATRONS;
  return detPick(state, pool, ctx);
}

export function buildRewardPreview(
  state: SimState,
  kind: RewardPreview['kind'],
  patronId?: PatronId,
  flags?: Partial<RewardPreview>
): RewardPreview {
  const veiled = state.player.chaosCurses.some(
    (c) => c.curseKind === 'hidden_door_rewards'
  );
  let preview: RewardPreview;

  if (kind === 'boon') {
    const pId = patronId ?? 'voltaris';
    preview = {
      kind: 'boon',
      patronId: pId,
      label: `${PATRON_CONSTANTS[pId].displayName} Boon`,
      ...flags,
    };
  } else if (kind === 'pom') {
    preview = { kind: 'pom', label: 'Pom of Power', ...flags };
  } else if (kind === 'centaur_heart') {
    preview = { kind: 'centaur_heart', label: 'Centaur Heart (+25 HP)', ...flags };
  } else if (kind === 'hammer') {
    preview = { kind: 'hammer', label: 'Forge Hammer', ...flags };
  } else if (kind === 'gold') {
    preview = { kind: 'gold', label: 'Vault of Gold', ...flags };
  } else if (kind === 'darkness') {
    preview = { kind: 'darkness', label: 'Darkness Trove', ...flags };
  } else if (kind === 'fountain') {
    preview = { kind: 'fountain', label: 'Sanctum Fountain', ...flags };
  } else if (kind === 'shop_item') {
    preview = { kind: 'shop_item', label: 'Boatman Shop', isShop: true, ...flags };
  } else if (kind === 'chaos_gate') {
    preview = {
      kind: 'chaos_gate',
      patronId: 'abyssos',
      label: 'Void Chaos Gate (Abyssos)',
      isChaos: true,
      ...flags,
    };
  } else {
    preview = { kind, label: kind.replace(/_/g, ' '), ...flags };
  }

  if (veiled && !preview.isBoss) {
    preview.label = 'Veiled Chamber (Void Curse)';
  }
  return preview;
}

export function generateExitDoors(
  state: SimState,
  biome: BiomeId,
  depth: number,
  encounterKind: EncounterKind,
  bounds: RoomState['bounds'],
  ctx?: RngProvider,
  opts?: RoomGenOptions
): ArenaDoor[] {
  const table = getBiomeEncounterTable(biome);

  // 1. Sanctum Courtyard -> Obsidian Pit Depth 1
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

  // 2. Crypt of Bile: Styx Hub with 5 Wing Doors + Locked/Unlocked Frozen Summit Gate!
  if (biome === 'crypt_of_bile' && encounterKind === 'styx_hub') {
    const wingsCleared = opts?.styxWingsCleared ?? 0;
    const sackFound = Boolean(opts?.satyrSackFound);
    const wingRewards: readonly RewardPreview[] = [
      buildRewardPreview(state, 'boon', pickPatronForReward(state, new Set(), ctx, false)),
      buildRewardPreview(state, 'pom'),
      buildRewardPreview(state, 'centaur_heart'),
      buildRewardPreview(state, 'gold'),
      buildRewardPreview(state, 'boon', pickPatronForReward(state, new Set(), ctx, true)),
    ];

    const doors: ArenaDoor[] = [
      {
        id: 'door_styx_summit_gate',
        pos: { x: 0, y: bounds.minY + 56 },
        direction: 'portal',
        locked: !sackFound,
        targetBiome: 'frozen_summit',
        reward: {
          kind: 'titan_blood',
          label: sackFound
            ? 'Ascend to Frozen Summit (Sovereign Lord)'
            : `Locked Summit Gate (Search Wings: ${wingsCleared}/5)`,
          isBoss: true,
        },
      },
    ];

    const wingX = [-480, -250, 250, 480, 0];
    const wingY = [
      bounds.minY + 76,
      bounds.minY + 72,
      bounds.minY + 72,
      bounds.minY + 76,
      bounds.maxY - 76,
    ];
    for (let w = 0; w < 5; w++) {
      const done = w < wingsCleared;
      doors.push({
        id: `door_styx_wing_${w + 1}`,
        pos: { x: wingX[w], y: wingY[w] },
        direction: w < 2 ? 'west' : w < 4 ? 'east' : 'south',
        locked: done,
        reward: {
          ...wingRewards[w],
          label: done
            ? `Wing ${w + 1} Cleared`
            : `Crypt Wing ${w + 1} — ${wingRewards[w].label}`,
        },
      });
    }
    return doors;
  }

  // 3. Crypt of Bile Wing Exit -> Return Portal to Styx Hub
  if (biome === 'crypt_of_bile' && encounterKind === 'styx_wing') {
    return [
      {
        id: `door_styx_return_${depth}`,
        pos: { x: 0, y: bounds.minY + 58 },
        direction: 'portal',
        locked: true,
        reward: {
          kind: 'fountain',
          label: 'Return to Crypt Hub',
        },
      },
    ];
  }

  // 4. Boss room cleared -> Biome Transition Portal (or Victory on Frozen Summit)
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

  // 5. Next room is the Biome Boss!
  if (depth + 1 >= bossDepth) {
    const bossDef = BOSS_CONSTANTS[table.bossId];
    const bossLabel =
      biome === 'verdant_colosseum'
        ? 'Colosseum Champions (Boss Duo)'
        : `${bossDef.displayName} (Boss)`;
    return [
      {
        id: `door_boss_${table.bossId}`,
        pos: { x: 0, y: bounds.minY + 62 },
        direction: 'north',
        locked: true,
        reward: {
          kind: 'titan_blood',
          label: bossLabel,
          isBoss: true,
        },
      },
    ];
  }

  // 6. Standard branching doors (2 or 3 doors + optional Chaos Gate!)
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
    } else if (
      depth === Math.floor(bossDepth / 2) &&
      i === 0 &&
      encounterKind !== 'miniboss'
    ) {
      const p = pickPatronForReward(state, usedPatrons, ctx, false);
      usedPatrons.add(p);
      reward = buildRewardPreview(state, 'boon', p, {
        isMiniBoss: true,
        label: `${PATRON_CONSTANTS[p].displayName} Boon (Mini-Boss)`,
      });
    } else if (
      i === 1 &&
      depth >= 3 &&
      depth <= bossDepth - 3 &&
      encounterKind !== 'trial' &&
      detNextFloat(state, ctx) < 0.16
    ) {
      // Dual-Patron Trial Room!
      const p = pickPatronForReward(state, usedPatrons, ctx, false);
      usedPatrons.add(p);
      reward = buildRewardPreview(state, 'boon', p, {
        isTrial: true,
        label: 'Trial of the Patrons (2 Boons!)',
      });
    } else if (i === 0) {
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
      } else if (roll < 0.54 && !usedKinds.has('centaur_heart')) {
        reward = buildRewardPreview(state, 'centaur_heart');
      } else if (roll < 0.7 && !usedKinds.has('pom') && state.player.boons.length > 0) {
        reward = buildRewardPreview(state, 'pom');
      } else if (roll < 0.84 && !usedKinds.has('gold')) {
        reward = buildRewardPreview(state, 'gold');
      } else if (
        roll < 0.92 &&
        depth >= 4 &&
        !usedKinds.has('fountain') &&
        encounterKind !== 'fountain'
      ) {
        reward = buildRewardPreview(state, 'fountain');
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

  // Optional Void Chaos Gate portal in Biomes 1–3 (`chaosHpCost = 20 + depth * 0.2`)
  if (
    (biome === 'obsidian_pit' ||
      biome === 'cinder_mire' ||
      biome === 'verdant_colosseum') &&
    encounterKind !== 'chaos' &&
    depth >= 2 &&
    depth <= bossDepth - 2 &&
    detNextFloat(state, ctx) < 0.24
  ) {
    const hpCost = Math.round(20 + depth * 0.2);
    doors.push({
      id: `door_chaos_${biome}_${depth}`,
      pos: { x: 0, y: Math.min(bounds.maxY - 140, 150) },
      direction: 'portal',
      locked: true,
      isChaosGate: true,
      chaosHpCost: hpCost,
      reward: buildRewardPreview(state, 'chaos_gate', 'abyssos', {
        isChaos: true,
        label: `Chaos Gate (-${hpCost} HP) — Abyssos`,
      }),
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
  if (encounterKind === 'chaos') {
    return getRoomTemplate('chaos_sanctuary');
  }
  if (encounterKind === 'styx_hub') {
    return getRoomTemplate('crypt_styx_hub');
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
  opts?: RoomGenOptions,
  ctx?: RngProvider
): { room: RoomState; template: RoomTemplateDef } {
  const template = opts?.templateIdOverride
    ? getRoomTemplate(opts.templateIdOverride)
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

  // Note: heightened_security (+400%) is applied 1x natively inside combat.ts dealDamageToPlayer()!
  const hazards: HazardState[] = template.hazards.map((h, idx) => ({
    id: `haz_${template.id}_${idx}`,
    kind: h.kind,
    pos: { x: h.x, y: h.y },
    radius: h.radius,
    active:
      h.kind === 'lava_pool' ||
      h.kind === 'poison_pool' ||
      h.kind === 'curing_pool' ||
      h.kind === 'spike_trap',
    armed: false,
    timer: 0,
    cooldown: h.cooldown ?? 0,
    damage: h.damage,
    owner: 'environment',
  }));

  const isPeaceful =
    encounterKind === 'hub' ||
    encounterKind === 'shop' ||
    encounterKind === 'fountain' ||
    encounterKind === 'story' ||
    encounterKind === 'chaos' ||
    encounterKind === 'styx_hub' ||
    encounterKind === 'trial'; // Trial starts peaceful until player picks Patron A or B!

  const table = getBiomeEncounterTable(biome);
  let totalWaves = 0;
  if (encounterKind === 'trial') {
    totalWaves = 2;
  } else if (!isPeaceful) {
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
    ctx,
    opts
  );
  if (isPeaceful && encounterKind !== 'styx_hub' && encounterKind !== 'trial') {
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
    cleared: isPeaceful && encounterKind !== 'trial',
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
    styxWingsCleared: opts?.styxWingsCleared,
    satyrSackFound: opts?.satyrSackFound,
  };

  return { room, template };
}

// ============================================================================
// Wave Roster & Boatman Shop Pickup Generators
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
      (depth >= 2 || biome !== 'obsidian_pit') &&
      (waveIndex > 0 || depth >= 4) &&
      detNextFloat(state, ctx) < eliteChance;

    spawns.push({ archetype, pos, elite });
  }

  return spawns;
}

export function buildShopPickups(
  state: SimState,
  ctx?: RngProvider,
  opts?: { hasLoyaltyCard?: boolean; includeFerrymanBag?: boolean }
): PickupItem[] {
  const priceMult = getShopPriceMultiplier(
    state.run.vows,
    Boolean(opts?.hasLoyaltyCard)
  );
  const patron = pickPatronForReward(state, new Set(), ctx);
  const patronDef = PATRON_CONSTANTS[patron];
  const idx = state.room.roomIndex;

  const items: PickupItem[] = [
    {
      id: `shop_boon_${idx}`,
      kind: 'boon',
      pos: { x: -240, y: -45 },
      radius: 36,
      label: `${patronDef.displayName} Boon (${Math.round(150 * priceMult)}g)`,
      costGold: Math.round(150 * priceMult),
      patronId: patron,
      collected: false,
      colorHex: patronDef.colorHex,
    },
    {
      id: `shop_heart_${idx}`,
      kind: 'centaur_heart',
      pos: { x: -80, y: -45 },
      radius: 36,
      label: `Centaur Heart (${Math.round(125 * priceMult)}g)`,
      costGold: Math.round(125 * priceMult),
      amount: 25,
      collected: false,
      colorHex: '#ff4d6d',
    },
    {
      id: `shop_pom_${idx}`,
      kind: 'pom',
      pos: { x: 80, y: -45 },
      radius: 36,
      label: `Pom of Power (${Math.round(100 * priceMult)}g)`,
      costGold: Math.round(100 * priceMult),
      collected: false,
      colorHex: '#ff5266',
    },
    {
      id: `shop_food_${idx}`,
      kind: 'heal_food',
      pos: { x: 240, y: -45 },
      radius: 34,
      label: `Ambrosial Roast +40% HP (${Math.round(50 * priceMult)}g)`,
      costGold: Math.round(50 * priceMult),
      amount: 40,
      collected: false,
      colorHex: '#63d471',
    },
  ];

  // Optional Borrow Gold Bag -> Triggers secret boss The Ferryman!
  if (opts?.includeFerrymanBag) {
    items.push({
      id: `shop_ferryman_bag_${idx}`,
      kind: 'shop_item',
      pos: { x: 0, y: -190 },
      radius: 38,
      label: 'Borrow Gold Bag (+300g — Challenge The Ferryman!)',
      costGold: 0,
      amount: 300,
      collected: false,
      colorHex: '#ffd942',
    });
  }

  return items;
}
