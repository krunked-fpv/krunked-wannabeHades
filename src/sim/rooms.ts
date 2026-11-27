import {
  BIOME_CONSTANTS,
  BOSS_CONSTANTS,
  PATRON_CONSTANTS,
  type ArenaDoor,
  type BiomeId,
  type BossId,
  type EncounterKind,
  type EnemyState,
  type PickupItem,
  type RewardPreview,
  type RoomState,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import {
  BIOME_PROGRESSION_ORDER,
  getBiomeEncounterTable,
  getRoomTemplate,
  type RoomTemplateDef,
} from '../data/biomes.js';
import { WAVE1_PATRONS } from '../data/boons.js';
import { getBossConfig } from '../data/bosses.js';
import { getEnemyArchetypeDef } from '../data/enemies.js';
import {
  getKeepsakeForcedPatron,
  getKeepsakeValue,
} from '../data/keepsakes.js';
import {
  applySelectedBoon,
  generateBoonOffer,
  generateHammerOffer,
  generatePomOffer,
  handleBoonOnAttackHit,
  handleBoonOnDash,
  handleBoonOnGodCall,
  rerollBoonOffer,
  tickBoons,
} from './boons.js';
import { spawnBoss, tickBosses, tryTriggerMultiBarBossRevive } from './bosses.js';
import { createTelegraph, spawnEnemy, tickEnemies } from './enemies.js';
import {
  applyMetaToPlayer,
  detNextInt,
  detPick,
  getEffectiveMirrorUpgrade,
  getHealingMultiplier,
  getKeepsakeRank,
  normalizeSeed,
  recordRunEndMeta,
  type RngProvider,
  type SimCombatContext,
  type SimGameplayHooks,
} from './meta.js';
import {
  buildRewardPreview,
  buildRoomState,
  buildShopPickups,
  planWaveSpawns,
} from './worldgen.js';

export type { SimCombatContext, SimGameplayHooks };

// ============================================================================
// WeakMap Room Runtime Metadata (deterministic fallback on cloned SimState)
// ============================================================================

interface RoomRuntimeMeta {
  rewardHint: RewardPreview;
  clearedHandled: boolean;
  lastPlayerHp: number;
  tightDeadlineTickAcc: number;
}

const roomMetaMap = new WeakMap<RoomState, RoomRuntimeMeta>();

function defaultRewardForRoom(state: SimState, room: RoomState): RewardPreview {
  if (room.encounterKind === 'boss' || room.encounterKind === 'surface_boss') {
    return { kind: 'titan_blood', label: 'Titan Blood', isBoss: true };
  }
  const patron = WAVE1_PATRONS[Math.abs(room.roomIndex + state.run.seed) % WAVE1_PATRONS.length];
  return buildRewardPreview(state, 'boon', patron);
}

function getRoomMeta(state: SimState): RoomRuntimeMeta {
  let meta = roomMetaMap.get(state.room);
  if (!meta) {
    meta = {
      rewardHint: defaultRewardForRoom(state, state.room),
      clearedHandled: state.room.cleared,
      lastPlayerHp: state.player.hp,
      tightDeadlineTickAcc: 0,
    };
    roomMetaMap.set(state.room, meta);
  }
  return meta;
}

// ============================================================================
// Internal Helpers: Healing, Wave Spawning, Pickup Collection
// ============================================================================

function healPlayerWithVows(state: SimState, rawAmount: number): number {
  const mult = getHealingMultiplier(state.run.vows);
  const amount = Math.round(rawAmount * mult);
  if (amount <= 0) return 0;
  const before = state.player.hp;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + amount);
  const gained = state.player.hp - before;
  if (gained > 0) {
    state.floatingNumbers.push({
      id: `fl_heal_${state.tick}_${state.floatingNumbers.length}`,
      pos: { x: state.player.pos.x, y: state.player.pos.y - 42 },
      vel: { x: 0, y: -55 },
      value: `+${gained}`,
      kind: 'heal',
      colorHex: '#63d471',
      life: 0,
      maxLife: 0.9,
    });
  }
  return gained;
}

function spawnWaveEnemies(
  state: SimState,
  waveIndex: number,
  template: RoomTemplateDef,
  ctx?: RngProvider
): void {
  const planned = planWaveSpawns(
    state,
    state.room.biome,
    state.room.depth,
    state.room.encounterKind,
    waveIndex,
    template,
    ctx
  );
  for (const s of planned) {
    spawnEnemy(
      state,
      s.archetype,
      s.pos,
      { elite: s.elite, isMiniBoss: s.isMiniBoss },
      ctx
    );
  }
}

function spawnRewardPickupForRoom(
  state: SimState,
  reward: RewardPreview,
  pos: Vec2
): PickupItem {
  let colorHex = '#f5c742';
  let amount: number | undefined;

  if (reward.kind === 'boon' && reward.patronId) {
    colorHex = PATRON_CONSTANTS[reward.patronId].colorHex;
  } else if (reward.kind === 'pom') {
    colorHex = '#ff4d66';
  } else if (reward.kind === 'centaur_heart') {
    colorHex = '#ff3b6b';
    amount = 25;
  } else if (reward.kind === 'hammer') {
    colorHex = '#ffd24c';
  } else if (reward.kind === 'gold') {
    colorHex = '#ffd942';
    amount = 95 + state.room.depth * 8;
  } else if (reward.kind === 'darkness') {
    colorHex = '#a864ff';
    amount = 35 + state.room.depth * 5;
  } else if (reward.kind === 'titan_blood') {
    colorHex = '#ff2b4a';
    amount = 1;
  } else if (reward.kind === 'fountain') {
    colorHex = '#63f0c8';
  }

  const pickup: PickupItem = {
    id: `reward_${state.room.roomIndex}_${state.tick}_${state.room.pickups.length}`,
    kind: reward.kind,
    pos: { x: pos.x, y: pos.y },
    radius: 40,
    label: reward.label,
    costGold: 0,
    patronId: reward.patronId,
    amount,
    collected: false,
    colorHex,
  };
  state.room.pickups.push(pickup);
  return pickup;
}

const AUTO_COLLECT_KINDS = new Set<PickupItem['kind']>([
  'gold',
  'darkness',
  'gemstone',
  'key',
  'nectar',
  'titan_blood',
  'diamond',
  'ambrosia',
  'heal_food',
]);

function collectPickup(
  state: SimState,
  pickup: PickupItem,
  ctx?: RngProvider
): boolean {
  if (pickup.collected) return false;

  if (pickup.costGold > 0) {
    if (state.player.gold < pickup.costGold) {
      state.events.push({
        type: 'ui_toast',
        text: `Need ${pickup.costGold} Gold (have ${state.player.gold})`,
        colorHex: '#ff6666',
      });
      return false;
    }
    state.player.gold -= pickup.costGold;
  }

  pickup.collected = true;

  switch (pickup.kind) {
    case 'boon': {
      generateBoonOffer(state, pickup.patronId, ctx);
      break;
    }
    case 'pom': {
      generatePomOffer(state, ctx);
      break;
    }
    case 'hammer': {
      generateHammerOffer(state, ctx);
      break;
    }
    case 'centaur_heart': {
      const gain = pickup.amount ?? 25;
      state.player.maxHp += gain;
      healPlayerWithVows(state, gain);
      state.events.push({
        type: 'ui_toast',
        text: `Centaur Heart: +${gain} Max HP!`,
        colorHex: '#ff4d6d',
      });
      break;
    }
    case 'fountain': {
      const healAmt = Math.round(state.player.maxHp * 0.55);
      const gained = healPlayerWithVows(state, healAmt);
      state.events.push({
        type: 'ui_toast',
        text: `Sanctum Fountain restored +${gained} HP`,
        colorHex: '#63f0c8',
      });
      break;
    }
    case 'heal_food': {
      const pct = (pickup.amount ?? 35) / 100;
      const gained = healPlayerWithVows(state, Math.round(state.player.maxHp * pct));
      state.events.push({
        type: 'ui_toast',
        text: `Restored +${gained} HP`,
        colorHex: '#63d471',
      });
      break;
    }
    case 'gold': {
      const noGoldCurse = state.player.chaosCurses.some(
        (c) => c.curseKind === 'no_gold_gain'
      );
      if (!noGoldCurse) {
        const amt = pickup.amount ?? 85;
        state.player.gold += amt;
        state.floatingNumbers.push({
          id: `fl_gold_${state.tick}_${state.floatingNumbers.length}`,
          pos: { x: pickup.pos.x, y: pickup.pos.y - 30 },
          vel: { x: 0, y: -55 },
          value: `+${amt}g`,
          kind: 'gold',
          colorHex: '#ffd942',
          life: 0,
          maxLife: 0.9,
        });
      }
      break;
    }
    case 'darkness': {
      const amt = pickup.amount ?? 35;
      state.meta.darkness += amt;
      // Dark Regeneration (Cinder Vitality side B) heals % of Darkness collected
      const regen = getEffectiveMirrorUpgrade(
        state.meta,
        state.run.vows,
        'cinder_vitality'
      );
      if (regen.side === 'b' && regen.rank > 0) {
        healPlayerWithVows(state, Math.round(amt * regen.value));
      }
      state.events.push({
        type: 'ui_toast',
        text: `+${amt} Darkness`,
        colorHex: '#a864ff',
      });
      break;
    }
    case 'gemstone': {
      state.meta.gemstones += pickup.amount ?? 15;
      break;
    }
    case 'key': {
      state.meta.keys += pickup.amount ?? 1;
      break;
    }
    case 'nectar': {
      state.meta.nectar += pickup.amount ?? 1;
      break;
    }
    case 'titan_blood': {
      const amt = pickup.amount ?? 1;
      state.meta.titanBlood += amt;
      state.events.push({
        type: 'ui_toast',
        text: `+${amt} Titan Blood Claimed!`,
        colorHex: '#ff2b4a',
      });
      break;
    }
    case 'diamond': {
      state.meta.diamonds += pickup.amount ?? 1;
      break;
    }
    case 'ambrosia': {
      state.meta.ambrosia += pickup.amount ?? 1;
      break;
    }
    default:
      break;
  }

  state.events.push({
    type: 'pickup_collected',
    kind: pickup.kind,
    pos: { x: pickup.pos.x, y: pickup.pos.y },
    label: pickup.label,
    patronId: pickup.patronId,
  });

  return true;
}

// ============================================================================
// Public Room & Run Lifecycle Entrypoints
// ============================================================================

export function loadRoom(
  state: SimState,
  biome: BiomeId,
  depth: number,
  encounterKind: EncounterKind,
  rewardHint?: RewardPreview,
  ctx?: RngProvider
): void {
  const nextRoomIndex = state.room.roomIndex + 1;

  // Clear transient entities
  state.enemies = [];
  state.projectiles = [];
  state.floatingNumbers = [];

  // Restore Bloodstones on chamber entry
  state.player.castAmmo = state.player.maxCastAmmo;
  state.player.castCooldown = 0;
  state.player.castChargeTimer = 0;
  state.player.dashTimer = 0;
  state.player.dashCharges = state.player.maxDashCharges;
  state.player.vel.x = 0;
  state.player.vel.y = 0;
  state.player.statuses = [];
  state.player.inLava = false;
  state.player.inPoison = false;
  state.player.lavaGraceTimer = 0;

  // Chamber entry Mirror effects (skip in hub)
  if (biome !== 'sanctum_hub' && state.run.active) {
    const vitality = getEffectiveMirrorUpgrade(
      state.meta,
      state.run.vows,
      'cinder_vitality'
    );
    if (vitality.side === 'a' && vitality.rank > 0) {
      healPlayerWithVows(state, Math.round(vitality.value));
    }
    // Stubborn Defiance restores its 1 per-chamber charge
    const defiance = getEffectiveMirrorUpgrade(
      state.meta,
      state.run.vows,
      'death_defiance'
    );
    if (defiance.side === 'b' && defiance.rank > 0) {
      state.player.deathDefiances = Math.max(1, state.player.deathDefiances);
    }

    // Tick down active Chaos curses
    for (let i = state.player.chaosCurses.length - 1; i >= 0; i--) {
      const curse = state.player.chaosCurses[i];
      curse.encountersRemaining -= 1;
      if (curse.encountersRemaining <= 0) {
        state.player.boons.push(curse.blessingBoon);
        state.player.chaosCurses.splice(i, 1);
        state.events.push({
          type: 'ui_toast',
          text: `Void Curse lifted — ${curse.blessingBoon.name} awakened!`,
          colorHex: PATRON_CONSTANTS.abyssos.colorHex,
        });
      }
    }
  }

  const { room, template } = buildRoomState(
    state,
    biome,
    depth,
    encounterKind,
    nextRoomIndex,
    undefined,
    ctx
  );
  state.room = room;

  // Position player cleanly at chamber entrance facing inward
  state.player.pos.x = template.playerSpawn.x;
  state.player.pos.y = template.playerSpawn.y;
  state.player.facingAngle = biome === 'sanctum_hub' ? 0 : -Math.PI * 0.5;
  state.camera.x = state.player.pos.x;
  state.camera.y = state.player.pos.y;
  state.camera.zoom = room.zoom;

  const resolvedReward = rewardHint ?? defaultRewardForRoom(state, room);
  roomMetaMap.set(room, {
    rewardHint: resolvedReward,
    clearedHandled: room.cleared,
    lastPlayerHp: state.player.hp,
    tightDeadlineTickAcc: 0,
  });

  // Populate chamber contents
  if (biome === 'sanctum_hub' || encounterKind === 'hub') {
    spawnEnemy(state, 'rattlebones_dummy', { x: 240, y: -20 }, undefined, ctx);
    room.pickups.push({
      id: 'courtyard_training_boon',
      kind: 'boon',
      pos: { x: -280, y: -150 },
      radius: 40,
      label: 'Practice Boon Shrine (Voltaris)',
      costGold: 0,
      patronId: 'voltaris',
      collected: false,
      colorHex: PATRON_CONSTANTS.voltaris.colorHex,
    });
  } else if (encounterKind === 'shop') {
    room.pickups.push(...buildShopPickups(state, ctx));
  } else if (encounterKind === 'fountain') {
    room.pickups.push({
      id: `fountain_${room.roomIndex}`,
      kind: 'fountain',
      pos: { x: 0, y: -30 },
      radius: 48,
      label: 'Sanctum Healing Fountain',
      costGold: 0,
      collected: false,
      colorHex: '#63f0c8',
    });
  } else if (encounterKind === 'boss' || encounterKind === 'surface_boss') {
    const table = getBiomeEncounterTable(biome);
    spawnBoss(state, table.bossId, undefined, ctx);
  } else {
    spawnWaveEnemies(state, 0, template, ctx);
  }

  state.events.push({
    type: 'room_entered',
    biome,
    depth,
    encounterKind,
  });
}

export function enterTrainingCourtyard(state: SimState): void {
  state.run.inHub = true;
  state.run.active = false;
  state.run.victory = false;
  state.run.defeat = false;
  state.run.paused = false;
  state.run.pendingOffer = null;
  state.run.finalKillSlowTimer = 0;

  state.player.boons = [];
  state.player.hammers = [];
  state.player.chaosCurses = [];
  state.player.statuses = [];
  state.player.godGauge = 50; // Half-charged gauge in courtyard so players can test Call!
  state.player.godCallActiveTimer = 0;
  state.player.godCallPatron = null;
  state.player.keepsakeUsed = false;

  applyMetaToPlayer(state, { resetVitals: true });
  loadRoom(state, 'sanctum_hub', 0, 'hub');
}

export function startNewRun(state: SimState, seed?: number): void {
  const runSeed = normalizeSeed(
    seed !== undefined ? seed : state.run.seed || 1337
  );
  state.rngState = runSeed;

  state.run.seed = runSeed;
  state.run.runNumber = state.meta.totalRuns + 1;
  state.run.active = true;
  state.run.inHub = false;
  state.run.victory = false;
  state.run.defeat = false;
  state.run.paused = false;
  state.run.biomeOrderIndex = 0;
  state.run.chambersCleared = 0;
  state.run.kills = 0;
  state.run.bossesDefeated = [];
  state.run.elapsedSeconds = 0;
  state.run.damageDealt = 0;
  state.run.damageTaken = 0;
  state.run.pendingOffer = null;
  state.run.seenPatrons = [];
  state.run.hammersCollected = 0;
  state.run.finalKillSlowTimer = 0;

  state.player.boons = [];
  state.player.hammers = [];
  state.player.chaosCurses = [];
  state.player.statuses = [];
  state.player.godGauge = 0;
  state.player.godCallActiveTimer = 0;
  state.player.godCallPatron = null;
  state.player.greaterCallSlowTimer = 0;
  state.player.keepsakeUsed = false;
  state.player.isDead = false;

  applyMetaToPlayer(state, { resetVitals: true });

  // Authentic Chamber 1: Patron Boon reward on clearing the opening Obsidian Pit clash
  const forcedPatron = getKeepsakeForcedPatron(state.player.keepsakeId);
  const openingPatron = forcedPatron ?? detPick(state, WAVE1_PATRONS);
  const openingReward = buildRewardPreview(state, 'boon', openingPatron);

  loadRoom(state, 'obsidian_pit', 1, 'combat', openingReward);
}

export function warpToBiome(
  state: SimState,
  biome: BiomeId,
  depth = 1
): void {
  if (biome === 'sanctum_hub') {
    enterTrainingCourtyard(state);
    return;
  }

  state.run.active = true;
  state.run.inHub = false;
  state.run.victory = false;
  state.run.defeat = false;
  state.run.paused = false;
  state.run.pendingOffer = null;

  if (state.player.isDead || state.player.hp <= 0) {
    applyMetaToPlayer(state, { resetVitals: true });
  }

  const orderIdx = BIOME_PROGRESSION_ORDER.indexOf(biome);
  state.run.biomeOrderIndex = orderIdx >= 0 ? orderIdx : 0;

  const bossDepth = BIOME_CONSTANTS[biome].bossDepth;
  const clampedDepth = Math.max(1, Math.min(Math.max(1, bossDepth), Math.floor(depth)));
  const encounterKind: EncounterKind =
    clampedDepth >= bossDepth
      ? biome === 'frozen_summit'
        ? 'surface_boss'
        : 'boss'
      : 'combat';

  loadRoom(state, biome, clampedDepth, encounterKind);
}

export function warpToBoss(state: SimState, bossId: BossId): void {
  const def = BOSS_CONSTANTS[bossId];
  state.run.active = true;
  state.run.inHub = false;
  state.run.victory = false;
  state.run.defeat = false;
  state.run.paused = false;
  state.run.pendingOffer = null;

  if (state.player.isDead || state.player.hp <= 0) {
    applyMetaToPlayer(state, { resetVitals: true });
  }

  const orderIdx = BIOME_PROGRESSION_ORDER.indexOf(def.biome);
  state.run.biomeOrderIndex = orderIdx >= 0 ? orderIdx : 0;

  const encounterKind: EncounterKind =
    def.biome === 'frozen_summit' ? 'surface_boss' : 'boss';
  const bossDepth = Math.max(1, BIOME_CONSTANTS[def.biome].bossDepth);

  loadRoom(state, def.biome, bossDepth, encounterKind);

  // Replace biome's default boss if an alternate/specific BossId was requested
  const alreadySpawned = state.enemies.some((e) => e.bossId === bossId);
  if (!alreadySpawned) {
    state.enemies = [];
    spawnBoss(state, bossId);
  }
}

// ============================================================================
// Interactable Query & Room Clear Transition
// ============================================================================

export type NearbyInteractable =
  | { kind: 'pickup'; pickup: PickupItem; dist: number }
  | { kind: 'door'; door: ArenaDoor; dist: number };

export function findNearestInteractable(
  state: SimState
): NearbyInteractable | null {
  const p = state.player.pos;
  let bestPickup: { pickup: PickupItem; dist: number } | null = null;
  for (const item of state.room.pickups) {
    if (item.collected) continue;
    const dx = p.x - item.pos.x;
    const dy = p.y - item.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = Math.max(115, item.radius + 78);
    if (dist <= maxDist && (!bestPickup || dist < bestPickup.dist)) {
      bestPickup = { pickup: item, dist };
    }
  }
  if (bestPickup) {
    return { kind: 'pickup', pickup: bestPickup.pickup, dist: bestPickup.dist };
  }

  let bestDoor: { door: ArenaDoor; dist: number } | null = null;
  for (const door of state.room.doors) {
    if (door.locked) continue;
    const dx = p.x - door.pos.x;
    const dy = p.y - door.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 130 && (!bestDoor || dist < bestDoor.dist)) {
      bestDoor = { door, dist };
    }
  }
  if (bestDoor) {
    return { kind: 'door', door: bestDoor.door, dist: bestDoor.dist };
  }

  return null;
}

function handleRoomClearedInternal(
  state: SimState,
  ctx?: SimCombatContext
): void {
  const meta = getRoomMeta(state);
  if (meta.clearedHandled) {
    return;
  }
  meta.clearedHandled = true;
  state.room.cleared = true;
  state.room.telegraphs = [];

  if (state.room.biome !== 'sanctum_hub') {
    state.run.chambersCleared += 1;
  }

  // Pierced Plume fast-clear bonus (under 28s)
  if (
    state.player.keepsakeId === 'pierced_plume' &&
    state.room.encounterTimer > 0 &&
    state.room.encounterTimer <= 28
  ) {
    const rank = getKeepsakeRank(state.meta, 'pierced_plume');
    state.player.plumeBonus += getKeepsakeValue('pierced_plume', rank);
    state.events.push({
      type: 'ui_toast',
      text: `Pierced Plume Swift Clear! (+${Math.round(state.player.plumeBonus * 100)}% Dodge/Speed)`,
      colorHex: '#ff7a33',
    });
  }

  // Spawn chamber reward at center (skip if victory already ended the run)
  if (!state.run.victory && state.room.biome !== 'sanctum_hub') {
    const template = getRoomTemplate(state.room.templateId);
    spawnRewardPickupForRoom(state, meta.rewardHint, template.rewardPos);
  }

  // Unlock all exit doors
  for (const door of state.room.doors) {
    door.locked = false;
  }

  state.events.push({
    type: 'room_cleared',
    biome: state.room.biome,
    depth: state.room.depth,
  });
  void ctx;
}

function enterDoor(
  state: SimState,
  door: ArenaDoor,
  ctx?: RngProvider
): boolean {
  if (door.locked) return false;

  // Leaving the Training Courtyard starts a fresh Escape Run!
  if (state.room.biome === 'sanctum_hub') {
    const nextSeed = normalizeSeed(
      (state.run.seed || 1337) + state.meta.totalRuns * 97 + state.tick
    );
    startNewRun(state, nextSeed);
    return true;
  }

  // Biome transition portal (e.g. Obsidian Pit -> Cinder Mire)
  if (door.targetBiome && door.targetBiome !== state.room.biome) {
    // Golden Touch (Deep Pockets side B) pays Gold interest between biomes
    const pockets = getEffectiveMirrorUpgrade(
      state.meta,
      state.run.vows,
      'deep_pockets'
    );
    if (pockets.side === 'b' && pockets.rank > 0 && state.player.gold > 0) {
      const interest = Math.round(state.player.gold * pockets.value);
      state.player.gold += interest;
      state.events.push({
        type: 'ui_toast',
        text: `Golden Touch: +${interest} Gold interest!`,
        colorHex: '#ffd942',
      });
    }

    // Reset Tight Deadline timer for the new biome
    const deadlineRank = Math.max(
      0,
      Math.min(3, Math.floor(state.run.vows.tight_deadline ?? 0))
    );
    if (deadlineRank > 0) {
      const perBiome = [540, 420, 300][deadlineRank - 1] ?? 540;
      state.run.tightDeadlineTimer = (state.run.tightDeadlineTimer ?? 0) + perBiome;
    }

    const nextIdx = BIOME_PROGRESSION_ORDER.indexOf(door.targetBiome);
    state.run.biomeOrderIndex = nextIdx >= 0 ? nextIdx : state.run.biomeOrderIndex + 1;
    const isFinal = door.targetBiome === 'frozen_summit';
    loadRoom(
      state,
      door.targetBiome,
      1,
      isFinal ? 'surface_boss' : 'combat',
      undefined,
      ctx
    );
    return true;
  }

  // Advance depth in current biome
  const nextDepth = state.room.depth + 1;
  let nextKind: EncounterKind = 'combat';
  if (door.reward.isBoss) {
    nextKind = state.room.biome === 'frozen_summit' ? 'surface_boss' : 'boss';
  } else if (door.reward.isMiniBoss) {
    nextKind = 'miniboss';
  } else if (door.reward.isShop) {
    nextKind = 'shop';
  } else if (door.reward.kind === 'fountain') {
    nextKind = 'fountain';
  } else if (door.reward.isTrial) {
    nextKind = 'trial';
  }

  loadRoom(state, state.room.biome, nextDepth, nextKind, door.reward, ctx);
  return true;
}

// ============================================================================
// Environmental Hazards Tick (Spike Traps, Curing Pools)
// ============================================================================

function tickRoomHazards(
  state: SimState,
  dt: number,
  ctx: SimCombatContext
): void {
  const player = state.player;
  for (const h of state.room.hazards) {
    if (h.kind === 'spike_trap') {
      h.timer += dt;
      const warnWindow = 0.65;
      const cycle = Math.max(1.6, h.cooldown);
      const phase = h.timer % cycle;

      if (!h.armed && phase >= cycle - warnWindow) {
        h.armed = true;
        h.active = false;
        createTelegraph(
          state,
          {
            kind: 'circle',
            pos: h.pos,
            angle: 0,
            radius: h.radius,
            duration: warnWindow,
            dangerColor: '#ff7033',
          },
          ctx
        );
      } else if (h.armed && phase < cycle - warnWindow) {
        // Trigger spike eruption!
        h.armed = false;
        h.active = true;
        const dx = player.pos.x - h.pos.x;
        const dy = player.pos.y - h.pos.y;
        if (dx * dx + dy * dy <= (h.radius + 16) ** 2) {
          ctx.dealDamageToPlayer(state, h.damage, {
            source: 'hazard',
            fromPos: h.pos,
          });
        }
        // Traps can also damage enemies lured onto them!
        for (const enemy of state.enemies) {
          if (enemy.aiState === 'dead' || enemy.hp <= 0) continue;
          const ex = enemy.pos.x - h.pos.x;
          const ey = enemy.pos.y - h.pos.y;
          if (ex * ex + ey * ey <= (h.radius + enemy.radius) ** 2) {
            ctx.dealDamageToEnemy(state, enemy, {
              baseDamage: Math.round(h.damage * 2.5),
              source: 'hazard',
              canCrit: false,
              canBackstab: false,
            });
          }
        }
      } else if (phase > 0.35 && phase < cycle - warnWindow) {
        h.active = false;
      }
    } else if (h.kind === 'curing_pool') {
      const dx = player.pos.x - h.pos.x;
      const dy = player.pos.y - h.pos.y;
      if (dx * dx + dy * dy <= (h.radius + 20) ** 2) {
        const poisonIdx = player.statuses.findIndex((s) => s.id === 'poison');
        if (poisonIdx >= 0) {
          player.statuses.splice(poisonIdx, 1);
          state.events.push({
            type: 'ui_toast',
            text: 'Poison cleansed!',
            colorHex: '#63f0c8',
          });
        }
      }
    }
  }
}

// ============================================================================
// Unified SimGameplayHooks Factory
// ============================================================================

export function createGameplayHooks(): SimGameplayHooks {
  return {
    tickRoomAndAi(state: SimState, dt: number, ctx: SimCombatContext): void {
      if (state.run.paused || state.run.pendingOffer) {
        return;
      }

      const meta = getRoomMeta(state);

      // Run elapsed clock & Tight Deadline vow
      if (state.run.active && !state.run.inHub && !state.run.victory && !state.run.defeat) {
        state.run.elapsedSeconds += dt;
        if (state.run.tightDeadlineTimer !== null) {
          state.run.tightDeadlineTimer = Math.max(
            0,
            state.run.tightDeadlineTimer - dt
          );
          if (state.run.tightDeadlineTimer <= 0 && !state.player.isDead) {
            meta.tightDeadlineTickAcc += dt;
            if (meta.tightDeadlineTickAcc >= 1.0) {
              meta.tightDeadlineTickAcc -= 1.0;
              ctx.dealDamageToPlayer(state, 5, {
                source: 'hazard',
                ignoreIframes: true,
                canDodge: false,
              });
            }
          }
        }
      }

      // Encounter timer & no-damage tracking
      if (!state.room.cleared && state.room.combatStarted) {
        state.room.encounterTimer += dt;
      }
      if (state.player.hp < meta.lastPlayerHp) {
        state.room.noDamageTaken = false;
      }
      meta.lastPlayerHp = state.player.hp;

      // Active Boon timers, God Calls, Enemy AI, Boss AI, Room Hazards
      tickBoons(state, dt, ctx);
      tickEnemies(state, dt, ctx);
      tickBosses(state, dt, ctx);
      tickRoomHazards(state, dt, ctx);

      // Auto-collect free currency & food pickups when walking over them
      for (const item of state.room.pickups) {
        if (item.collected || item.costGold > 0) continue;
        if (!AUTO_COLLECT_KINDS.has(item.kind)) continue;
        const dx = state.player.pos.x - item.pos.x;
        const dy = state.player.pos.y - item.pos.y;
        const collectR = item.radius + 34;
        if (dx * dx + dy * dy <= collectR * collectR) {
          collectPickup(state, item, ctx);
        }
      }

      // Check wave / room clear progression
      if (!state.room.cleared && state.room.combatStarted) {
        const remainingHostiles = state.enemies.filter(
          (e) =>
            e.archetype !== 'rattlebones_dummy' &&
            e.aiState !== 'dead' &&
            e.hp > 0
        ).length;

        if (remainingHostiles === 0) {
          if (state.room.waveIndex + 1 < state.room.totalWaves) {
            state.room.waveIndex += 1;
            const template = getRoomTemplate(state.room.templateId);
            spawnWaveEnemies(state, state.room.waveIndex, template, ctx);
            state.events.push({
              type: 'ui_toast',
              text: `Wave ${state.room.waveIndex + 1} of ${state.room.totalWaves}`,
              colorHex: '#ffd942',
            });
          } else {
            handleRoomClearedInternal(state, ctx);
          }
        }
      }

      // Handle player defeat transition
      if (state.player.isDead && state.run.active && !state.run.defeat) {
        state.run.defeat = true;
        state.run.active = false;
        recordRunEndMeta(state, false);
        state.events.push({
          type: 'run_ended',
          victory: false,
          chambersCleared: state.run.chambersCleared,
          elapsedSeconds: state.run.elapsedSeconds,
        });
      }
    },

    onPlayerDash(state, startPos, endPos, perfect, ctx) {
      handleBoonOnDash(state, startPos, endPos, perfect, ctx);
    },

    onPlayerAttackHit(state, enemy, source, damage, ctx) {
      handleBoonOnAttackHit(state, enemy, source, damage, ctx);
    },

    onPlayerGodCall(state, patronId, greater, ctx) {
      handleBoonOnGodCall(state, patronId, greater, ctx);
    },

    onInteract(state, ctx) {
      if (state.run.pendingOffer) {
        return false;
      }
      const nearest = findNearestInteractable(state);
      if (!nearest) return false;

      if (nearest.kind === 'pickup') {
        return collectPickup(state, nearest.pickup, ctx);
      }
      return enterDoor(state, nearest.door, ctx);
    },

    onSelectBoon(state, optionIndex, ctx) {
      return applySelectedBoon(state, optionIndex, ctx);
    },

    onRerollBoon(state, ctx) {
      return rerollBoonOffer(state, ctx);
    },

    onRoomCleared(state, ctx) {
      handleRoomClearedInternal(state, ctx);
    },

    onEnemyKilled(state: SimState, enemy: EnemyState, ctx: SimCombatContext) {
      // Multi-phase boss revive (e.g. Sovereign Lord Phase 1 -> Phase 2)
      if (enemy.isBoss && enemy.phase < enemy.maxPhases) {
        if (tryTriggerMultiBarBossRevive(state, enemy, ctx)) {
          return;
        }
      }

      // Track codex kill tally
      state.meta.codexKills[enemy.archetype] =
        (state.meta.codexKills[enemy.archetype] ?? 0) + 1;

      // Drop small gold reward on kill (unless Chaos no_gold_gain curse)
      const noGold = state.player.chaosCurses.some(
        (c) => c.curseKind === 'no_gold_gain'
      );
      if (!noGold && !enemy.isBoss && enemy.archetype !== 'rattlebones_dummy') {
        const def = getEnemyArchetypeDef(enemy.archetype);
        const gold = def.goldDrop + detNextInt(state, 0, 3, ctx);
        if (gold > 0) {
          state.player.gold += gold;
          state.floatingNumbers.push({
            id: `fl_killgold_${state.tick}_${state.floatingNumbers.length}`,
            pos: { x: enemy.pos.x, y: enemy.pos.y - 24 },
            vel: { x: 0, y: -45 },
            value: `+${gold}g`,
            kind: 'gold',
            colorHex: '#ffd942',
            life: 0,
            maxLife: 0.75,
          });
        }
      }

      // Boss defeat progression & victory transition
      if (enemy.isBoss && enemy.bossId) {
        const cfg = getBossConfig(enemy.bossId);
        if (!state.run.bossesDefeated.includes(enemy.bossId)) {
          state.run.bossesDefeated.push(enemy.bossId);
        }
        state.meta.darkness += 60;
        state.events.push({
          type: 'ui_toast',
          text: cfg.defeatToast,
          colorHex: '#ffd942',
        });

        // Sovereign Lord defeat completes the Escape Run!
        if (enemy.bossId === 'sovereign_lord') {
          state.run.victory = true;
          state.run.active = false;
          state.meta.titanBlood += 1;
          recordRunEndMeta(state, true);
          state.events.push({
            type: 'run_ended',
            victory: true,
            chambersCleared: state.run.chambersCleared + 1,
            elapsedSeconds: state.run.elapsedSeconds,
          });
        }
      }
    },
  };
}
