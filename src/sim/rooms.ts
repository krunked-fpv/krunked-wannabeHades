import {
  BIOME_CONSTANTS,
  BOSS_CONSTANTS,
  PATRON_CONSTANTS,
  type ArenaDoor,
  type BiomeId,
  type BossId,
  type EncounterKind,
  type EnemyState,
  type PatronId,
  type PickupItem,
  type RewardPreview,
  type RoomState,
  type RunState,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import {
  BIOME_PROGRESSION_ORDER,
  getBiomeEncounterTable,
  getRoomTemplate,
  type RoomTemplateDef,
} from '../data/biomes.js';
import { STANDARD_PATRONS } from '../data/boons.js';
import { getBossConfig } from '../data/bosses.js';
import { getEnemyArchetypeDef } from '../data/enemies.js';
import {
  getKeepsakeForcedPatron,
  getKeepsakeValue,
} from '../data/keepsakes.js';
import {
  applySelectedBoon,
  generateBoonOffer,
  generateChaosOffer,
  generateHammerOffer,
  generatePomOffer,
  generateUnderworldCustomsPurgeOffer,
  generateWellOfAshOffer,
  handleBoonOnAttackHit,
  handleBoonOnDash,
  handleBoonOnGodCall,
  onChamberClearedBoons,
  onChamberEnteredBoons,
  onFountainUsedBoons,
  rerollBoonOffer,
  tickBoons,
} from './boons.js';
import {
  spawnBoss,
  spawnDualColosseumChampions,
  tickBosses,
  tryTriggerMultiBarBossRevive,
} from './bosses.js';
import {
  createTelegraph,
  getEnemyPerks,
  spawnEnemy,
  spawnSoulEyeForExalted,
  tickEnemies,
} from './enemies.js';
import {
  applyMetaToPlayer,
  detNextFloat,
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
  generateExitDoors,
  pickPatronForReward,
  planWaveSpawns,
} from './worldgen.js';

export type { SimCombatContext, SimGameplayHooks };

// ============================================================================
// WeakMap Runtime Trackers (100% pure, serializable SimState preserved!)
// ============================================================================

interface RunCampaignMeta {
  styxWingsCleared: number;
  styxTreatWing: number;
  satyrSackFound: boolean;
  hasFerrymanLoyaltyCard: boolean;
  ferrymanChallenged: boolean;
  ferrymanReturnBiome: BiomeId | null;
  ferrymanReturnDepth: number;
  underworldCustomsDoneForBiome: number;
}

interface RoomRuntimeMeta {
  rewardHint: RewardPreview;
  clearedHandled: boolean;
  lastPlayerHp: number;
  trialPhase: 'none' | 'pick' | 'survive' | 'complete';
  trialHazardAcc: number;
}

const runCampaignMap = new WeakMap<RunState, RunCampaignMeta>();
const roomMetaMap = new WeakMap<RoomState, RoomRuntimeMeta>();

function getCampaignMeta(state: SimState): RunCampaignMeta {
  let cm = runCampaignMap.get(state.run);
  if (!cm) {
    // Deterministically place Abyssal Treat in Styx Wing 2..5
    const treatWing = 2 + (Math.abs(state.run.seed) % 4);
    cm = {
      styxWingsCleared: state.room.styxWingsCleared ?? 0,
      styxTreatWing: treatWing,
      satyrSackFound: Boolean(state.room.satyrSackFound),
      hasFerrymanLoyaltyCard: false,
      ferrymanChallenged: false,
      ferrymanReturnBiome: null,
      ferrymanReturnDepth: 1,
      underworldCustomsDoneForBiome: -1,
    };
    runCampaignMap.set(state.run, cm);
  }
  return cm;
}

function defaultRewardForRoom(state: SimState, room: RoomState): RewardPreview {
  if (room.encounterKind === 'boss' || room.encounterKind === 'surface_boss') {
    return { kind: 'titan_blood', label: 'Titan Blood', isBoss: true };
  }
  const patron =
    STANDARD_PATRONS[
      Math.abs(room.roomIndex + state.run.seed) % STANDARD_PATRONS.length
    ];
  return buildRewardPreview(state, 'boon', patron);
}

function getRoomMeta(state: SimState): RoomRuntimeMeta {
  let meta = roomMetaMap.get(state.room);
  if (!meta) {
    meta = {
      rewardHint: defaultRewardForRoom(state, state.room),
      clearedHandled: state.room.cleared,
      lastPlayerHp: state.player.hp,
      trialPhase: state.room.encounterKind === 'trial' ? 'pick' : 'none',
      trialHazardAcc: 0,
    };
    roomMetaMap.set(state.room, meta);
  }
  return meta;
}

// ============================================================================
// Internal Helpers: Healing, Wave Spawning, Pickups & Special Rooms
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
      life: 0.9,
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

function resolveObsidianPitBoss(state: SimState): BossId {
  // Run 1 always greets players with flagship Warden Malice; subsequent runs rotate all 3 Furies!
  if (state.run.runNumber <= 1) {
    return 'warden_malice';
  }
  const furies: readonly BossId[] = ['warden_malice', 'warden_fury', 'warden_murder'];
  const idx = Math.abs(state.run.seed + state.run.runNumber) % furies.length;
  return furies[idx];
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

  // Special Boatman Shop Gold Bag -> Challenge The Ferryman!
  if (pickup.id.startsWith('shop_ferryman_bag_')) {
    pickup.collected = true;
    return borrowFerrymanGoldBag(state, ctx);
  }

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

  // Dual-Patron Trial Room: picking Patron A or B enrages the Spurned Patron!
  const rMeta = getRoomMeta(state);
  if (
    state.room.encounterKind === 'trial' &&
    rMeta.trialPhase === 'pick' &&
    pickup.kind === 'boon' &&
    pickup.patronId
  ) {
    pickup.collected = true;
    const chosenPatron = pickup.patronId;
    const spurnedPatron: PatronId =
      state.room.trialPatronA === chosenPatron
        ? (state.room.trialPatronB ?? 'tidebreaker')
        : (state.room.trialPatronA ?? 'voltaris');

    state.room.trialSpurnedPatron = spurnedPatron;
    rMeta.trialPhase = 'survive';
    state.room.cleared = false;
    state.room.combatStarted = true;
    state.room.waveIndex = 0;
    state.room.totalWaves = 2;

    // Temporarily hide the second pedestal until the trial waves are defeated
    for (const p of state.room.pickups) {
      if (p.id !== pickup.id && !p.collected) {
        p.collected = true;
      }
    }
    for (const d of state.room.doors) {
      d.locked = true;
    }

    const template = getRoomTemplate(state.room.templateId);
    spawnWaveEnemies(state, 0, template, ctx);

    state.events.push({
      type: 'ui_toast',
      text: `${PATRON_CONSTANTS[spurnedPatron].displayName} is SCORNED! Survive the Trial!`,
      colorHex: PATRON_CONSTANTS[spurnedPatron].colorHex,
    });
    generateBoonOffer(state, chosenPatron, ctx);
    return true;
  }

  pickup.collected = true;

  switch (pickup.kind) {
    case 'boon': {
      generateBoonOffer(state, pickup.patronId, ctx);
      break;
    }
    case 'chaos_gate': {
      generateChaosOffer(state, ctx);
      break;
    }
    case 'well_of_ash': {
      generateWellOfAshOffer(
        state,
        ctx,
        getCampaignMeta(state).hasFerrymanLoyaltyCard
      );
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
      if (!onFountainUsedBoons(state)) {
        const healAmt = Math.round(state.player.maxHp * 0.55);
        const gained = healPlayerWithVows(state, healAmt);
        state.events.push({
          type: 'ui_toast',
          text: `Sanctum Fountain restored +${gained} HP`,
          colorHex: '#63f0c8',
        });
      }
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
        const affluence = state.player.boons.find((b) => b.id === 'abyssos_affluence');
        const bonusMult = 1 + (affluence ? affluence.scaledValue : 0);
        const amt = Math.round((pickup.amount ?? 85) * bonusMult);
        state.player.gold += amt;
        state.floatingNumbers.push({
          id: `fl_gold_${state.tick}_${state.floatingNumbers.length}`,
          pos: { x: pickup.pos.x, y: pickup.pos.y - 30 },
          vel: { x: 0, y: -55 },
          value: `+${amt}g`,
          kind: 'gold',
          colorHex: '#ffd942',
          life: 0.9,
          maxLife: 0.9,
        });
      }
      break;
    }
    case 'darkness': {
      const amt = pickup.amount ?? 35;
      state.meta.darkness += amt;
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
// Public Shop, Ferryman & Door-Reroll Entrypoints (for UiCallbacks / Modals)
// ============================================================================

export function buyShopPickup(
  state: SimState,
  pickupId: string,
  ctx?: RngProvider
): boolean {
  const item = state.room.pickups.find((p) => p.id === pickupId && !p.collected);
  if (!item) return false;
  return collectPickup(state, item, ctx);
}

export function borrowFerrymanGoldBag(
  state: SimState,
  ctx?: RngProvider
): boolean {
  const cm = getCampaignMeta(state);
  cm.ferrymanChallenged = true;
  cm.ferrymanReturnBiome = state.room.biome;
  cm.ferrymanReturnDepth = state.room.depth;

  state.player.gold += 300;
  state.events.push({
    type: 'ui_toast',
    text: 'Borrowed +300 Gold! THE FERRYMAN DEMANDS PAYMENT!',
    colorHex: '#ffd942',
  });

  warpToBoss(state, 'the_ferryman', ctx);
  return true;
}

export function rerollRoomDoors(
  state: SimState,
  ctx?: RngProvider
): boolean {
  if (state.run.doorRerolls <= 0) return false;
  if (!state.room.cleared || state.room.biome === 'sanctum_hub') return false;
  if (state.room.encounterKind === 'boss' || state.room.encounterKind === 'styx_hub') {
    return false;
  }

  state.run.doorRerolls -= 1;
  const cm = getCampaignMeta(state);
  const nextDoors = generateExitDoors(
    state,
    state.room.biome,
    state.room.depth,
    state.room.encounterKind,
    state.room.bounds,
    ctx,
    {
      styxWingsCleared: cm.styxWingsCleared,
      satyrSackFound: cm.satyrSackFound,
      hasLoyaltyCard: cm.hasFerrymanLoyaltyCard,
    }
  );
  for (const d of nextDoors) {
    d.locked = false;
  }
  state.room.doors = nextDoors;
  state.events.push({
    type: 'ui_toast',
    text: `Fated Authority rerolled chamber exits (${state.run.doorRerolls} left)`,
    colorHex: '#c084fc',
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
  const cm = getCampaignMeta(state);

  // Clear transient entities
  state.enemies = [];
  state.projectiles = [];
  state.floatingNumbers = [];

  // Restore Bloodstones & dash state cleanly on chamber entry (no leak across warps)
  state.player.castAmmo = state.player.maxCastAmmo;
  state.player.castCooldown = 0;
  state.player.castChargeTimer = 0;
  state.player.dashTimer = 0;
  state.player.dashCooldown = 0;
  state.player.dashRegenTimer = 0;
  state.player.dashStrikeWindowTimer = 0;
  state.player.dashGhosts = [];
  state.player.dashCharges = state.player.maxDashCharges;
  state.player.vel.x = 0;
  state.player.vel.y = 0;
  state.player.statuses = [];
  state.player.inLava = false;
  state.player.inPoison = false;
  state.player.lavaGraceTimer = 0;

  // Chamber entry Mirror, Boon & Chaos Curse maturation effects
  if (biome !== 'sanctum_hub' && state.run.active) {
    const vitality = getEffectiveMirrorUpgrade(
      state.meta,
      state.run.vows,
      'cinder_vitality'
    );
    if (vitality.side === 'a' && vitality.rank > 0) {
      healPlayerWithVows(state, Math.round(vitality.value));
    }
    const defiance = getEffectiveMirrorUpgrade(
      state.meta,
      state.run.vows,
      'death_defiance'
    );
    if (defiance.side === 'b' && defiance.rank > 0) {
      state.player.deathDefiances = Math.max(1, state.player.deathDefiances);
    }

    onChamberEnteredBoons(state);

    // Tick down active Chaos curses and awaken blessings upon maturation!
    for (let i = state.player.chaosCurses.length - 1; i >= 0; i--) {
      const curse = state.player.chaosCurses[i];
      curse.encountersRemaining -= 1;
      if (curse.encountersRemaining <= 0) {
        state.player.boons.push(curse.blessingBoon);
        state.player.chaosCurses.splice(i, 1);
        applyMetaToPlayer(state, { resetVitals: false });
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
    {
      styxWingsCleared: cm.styxWingsCleared,
      satyrSackFound: cm.satyrSackFound,
      hasLoyaltyCard: cm.hasFerrymanLoyaltyCard,
    },
    ctx
  );
  state.room = room;

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
    trialPhase: encounterKind === 'trial' ? 'pick' : 'none',
    trialHazardAcc: 0,
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
  } else if (encounterKind === 'styx_hub') {
    room.pickups.push(
      ...buildShopPickups(state, ctx, {
        hasLoyaltyCard: cm.hasFerrymanLoyaltyCard,
        includeFerrymanBag: !cm.ferrymanChallenged,
      })
    );
    room.pickups.push({
      id: `styx_well_${room.roomIndex}`,
      kind: 'well_of_ash',
      pos: { x: -340, y: 120 },
      radius: 38,
      label: 'Well of Ash',
      costGold: 0,
      collected: false,
      colorHex: '#c084fc',
    });
    room.pickups.push({
      id: `styx_fountain_${room.roomIndex}`,
      kind: 'fountain',
      pos: { x: 340, y: 120 },
      radius: 44,
      label: 'Sanctum Fountain',
      costGold: 0,
      collected: false,
      colorHex: '#63f0c8',
    });
  } else if (encounterKind === 'shop') {
    room.pickups.push(
      ...buildShopPickups(state, ctx, {
        hasLoyaltyCard: cm.hasFerrymanLoyaltyCard,
        includeFerrymanBag: !cm.ferrymanChallenged && depth >= 3,
      })
    );
    room.pickups.push({
      id: `shop_well_${room.roomIndex}`,
      kind: 'well_of_ash',
      pos: { x: 0, y: 140 },
      radius: 38,
      label: 'Well of Ash',
      costGold: 0,
      collected: false,
      colorHex: '#c084fc',
    });
  } else if (encounterKind === 'chaos') {
    room.pickups.push({
      id: `chaos_boon_${room.roomIndex}`,
      kind: 'chaos_gate',
      pos: { x: 0, y: -40 },
      radius: 44,
      label: 'Abyssos — Primordial Pact',
      costGold: 0,
      patronId: 'abyssos',
      collected: false,
      colorHex: PATRON_CONSTANTS.abyssos.colorHex,
    });
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
  } else if (encounterKind === 'trial') {
    // Dual-Patron Trial Room: two glowing Patron pedestals!
    const pA = pickPatronForReward(state, new Set(), ctx, false);
    const pB = pickPatronForReward(state, new Set([pA]), ctx, false);
    room.trialPatronA = pA;
    room.trialPatronB = pB;
    room.pickups.push(
      {
        id: `trial_patron_a_${room.roomIndex}`,
        kind: 'boon',
        pos: { x: -165, y: -40 },
        radius: 42,
        label: `Choose ${PATRON_CONSTANTS[pA].displayName} (Trial)`,
        costGold: 0,
        patronId: pA,
        collected: false,
        colorHex: PATRON_CONSTANTS[pA].colorHex,
      },
      {
        id: `trial_patron_b_${room.roomIndex}`,
        kind: 'boon',
        pos: { x: 165, y: -40 },
        radius: 42,
        label: `Choose ${PATRON_CONSTANTS[pB].displayName} (Trial)`,
        costGold: 0,
        patronId: pB,
        collected: false,
        colorHex: PATRON_CONSTANTS[pB].colorHex,
      }
    );
    state.events.push({
      type: 'ui_toast',
      text: `Trial of the Patrons: ${PATRON_CONSTANTS[pA].displayName} vs ${PATRON_CONSTANTS[pB].displayName}!`,
      colorHex: '#ffd942',
    });
  } else if (encounterKind === 'boss' || encounterKind === 'surface_boss') {
    if (biome === 'obsidian_pit') {
      spawnBoss(state, resolveObsidianPitBoss(state), undefined, ctx);
    } else if (biome === 'verdant_colosseum') {
      spawnDualColosseumChampions(state, ctx);
    } else {
      const table = getBiomeEncounterTable(biome);
      spawnBoss(state, table.bossId, undefined, ctx);
    }
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
  state.player.godGauge = 50;
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

  // Reset campaign tracker for the fresh escape attempt
  runCampaignMap.set(state.run, {
    styxWingsCleared: 0,
    styxTreatWing: 2 + (Math.abs(runSeed) % 4),
    satyrSackFound: false,
    hasFerrymanLoyaltyCard: false,
    ferrymanChallenged: false,
    ferrymanReturnBiome: null,
    ferrymanReturnDepth: 1,
    underworldCustomsDoneForBiome: -1,
  });

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

  const forcedPatron = getKeepsakeForcedPatron(state.player.keepsakeId);
  const openingPatron = forcedPatron ?? detPick(state, STANDARD_PATRONS);
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

  if (biome === 'crypt_of_bile' && depth <= 1) {
    loadRoom(state, 'crypt_of_bile', 1, 'styx_hub');
    return;
  }

  const bossDepth = BIOME_CONSTANTS[biome].bossDepth;
  const clampedDepth = Math.max(1, Math.min(Math.max(1, bossDepth), Math.floor(depth)));
  const encounterKind: EncounterKind =
    biome === 'crypt_of_bile'
      ? 'styx_wing'
      : clampedDepth >= bossDepth
        ? biome === 'frozen_summit'
          ? 'surface_boss'
          : 'boss'
        : 'combat';

  loadRoom(state, biome, clampedDepth, encounterKind);
}

export function warpToBoss(
  state: SimState,
  bossId: BossId,
  ctx?: RngProvider
): void {
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

  loadRoom(state, def.biome, bossDepth, encounterKind, undefined, ctx);

  // Replace default biome boss if a specific BossId was requested
  if (bossId === 'colosseum_spearlord') {
    // Ensure BOTH Champions are present for Spearlord arena
    const hasBull = state.enemies.some((e) => e.bossId === 'colosseum_bull');
    const hasSpear = state.enemies.some((e) => e.bossId === 'colosseum_spearlord');
    if (!hasBull || !hasSpear) {
      state.enemies = [];
      spawnDualColosseumChampions(state, ctx);
    }
  } else {
    const alreadyExact =
      state.enemies.length === 1 && state.enemies[0].bossId === bossId;
    if (!alreadyExact) {
      state.enemies = [];
      spawnBoss(state, bossId, undefined, ctx);
    }
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
  ctx?: SimCombatContext,
  alreadyMarkedByStep = false
): void {
  const meta = getRoomMeta(state);
  if (meta.clearedHandled) {
    return;
  }
  meta.clearedHandled = true;
  state.room.cleared = true;
  state.room.telegraphs = [];

  if (!alreadyMarkedByStep && state.room.biome !== 'sanctum_hub') {
    state.run.chambersCleared += 1;
  }

  // Bacchion After Party post-encounter recovery
  onChamberClearedBoons(state);

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

  const cm = getCampaignMeta(state);
  const template = getRoomTemplate(state.room.templateId);

  // Dual-Patron Trial Complete -> Spawn the Spurned Patron's Boon pedestal so you claim BOTH!
  if (
    state.room.encounterKind === 'trial' &&
    meta.trialPhase === 'survive' &&
    state.room.trialSpurnedPatron
  ) {
    meta.trialPhase = 'complete';
    const spurned = state.room.trialSpurnedPatron;
    spawnRewardPickupForRoom(
      state,
      buildRewardPreview(state, 'boon', spurned),
      template.rewardPos
    );
    state.events.push({
      type: 'ui_toast',
      text: `Trial Survived! Claim ${PATRON_CONSTANTS[spurned].displayName}'s Blessing!`,
      colorHex: PATRON_CONSTANTS[spurned].colorHex,
    });
  } else if (state.room.biome === 'crypt_of_bile' && state.room.encounterKind === 'styx_wing') {
    // Crypt of Bile Wing Cleared -> Check for Abyssal Treat (`satyrSackFound`)!
    cm.styxWingsCleared += 1;
    state.room.styxWingsCleared = cm.styxWingsCleared;
    if (!cm.satyrSackFound && cm.styxWingsCleared >= cm.styxTreatWing) {
      cm.satyrSackFound = true;
      state.room.satyrSackFound = true;
      state.events.push({
        type: 'ui_toast',
        text: 'ABYSSAL TREAT FOUND! The Frozen Summit Gate is unlocked in Crypt Hub!',
        colorHex: '#ffd942',
      });
    }
    spawnRewardPickupForRoom(state, meta.rewardHint, template.rewardPos);
  } else if (!state.run.victory && state.room.biome !== 'sanctum_hub') {
    spawnRewardPickupForRoom(state, meta.rewardHint, template.rewardPos);

    // Occasional Well of Ash in cleared chambers
    if (
      state.room.encounterKind === 'combat' &&
      state.room.depth >= 2 &&
      detNextFloat(state, ctx) < 0.25
    ) {
      state.room.pickups.push({
        id: `well_${state.room.roomIndex}`,
        kind: 'well_of_ash',
        pos: { x: template.rewardPos.x + 175, y: template.rewardPos.y + 45 },
        radius: 36,
        label: 'Well of Ash',
        costGold: 0,
        collected: false,
        colorHex: '#c084fc',
      });
    }
  }

  for (const door of state.room.doors) {
    door.locked = false;
  }

  if (!alreadyMarkedByStep) {
    state.events.push({
      type: 'room_cleared',
      biome: state.room.biome,
      depth: state.room.depth,
    });
  }
}

function enterDoor(
  state: SimState,
  door: ArenaDoor,
  ctx?: RngProvider
): boolean {
  if (door.locked) return false;
  const cm = getCampaignMeta(state);

  // Leaving Courtyard starts a fresh Escape Run!
  if (state.room.biome === 'sanctum_hub') {
    const nextSeed = normalizeSeed(
      (state.run.seed || 1337) + state.meta.totalRuns * 97 + state.tick
    );
    startNewRun(state, nextSeed);
    return true;
  }

  // Chaos Gate entry: requires paying non-lethal HP cost (`20 + depth * 0.2`)
  if (door.isChaosGate) {
    const cost = door.chaosHpCost ?? Math.round(20 + state.room.depth * 0.2);
    if (state.player.hp <= cost) {
      state.events.push({
        type: 'ui_toast',
        text: `Need more than ${cost} HP to enter Chaos Gate!`,
        colorHex: '#ff6666',
      });
      return false;
    }
    state.player.hp -= cost;
    loadRoom(state, state.room.biome, state.room.depth, 'chaos', undefined, ctx);
    return true;
  }

  // Styx Hub Wing Doors -> Crypt Wing combat chamber
  if (
    state.room.biome === 'crypt_of_bile' &&
    state.room.encounterKind === 'styx_hub' &&
    door.id.startsWith('door_styx_wing_')
  ) {
    loadRoom(
      state,
      'crypt_of_bile',
      cm.styxWingsCleared + 2,
      'styx_wing',
      door.reward,
      ctx
    );
    return true;
  }

  // Styx Wing Return Portal -> Back to Crypt Hub (with updated wingsCleared & summit gate!)
  if (
    state.room.biome === 'crypt_of_bile' &&
    state.room.encounterKind === 'styx_wing'
  ) {
    loadRoom(state, 'crypt_of_bile', 1, 'styx_hub', undefined, ctx);
    return true;
  }

  // Biome transition portal (e.g., Obsidian Pit -> Cinder Mire -> Verdant Colosseum -> Crypt -> Frozen Summit)
  if (door.targetBiome && door.targetBiome !== state.room.biome) {
    // Underworld Customs Shrine Vow: must purge 1 Boon before advancing biome!
    if (
      (state.run.vows.underworld_customs ?? 0) > 0 &&
      state.player.boons.length > 0 &&
      cm.underworldCustomsDoneForBiome !== state.run.biomeOrderIndex
    ) {
      cm.underworldCustomsDoneForBiome = state.run.biomeOrderIndex;
      generateUnderworldCustomsPurgeOffer(state, ctx);
      return true;
    }

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

    // Add Tight Deadline biome time allowance
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
    const nextKind: EncounterKind =
      door.targetBiome === 'frozen_summit'
        ? 'surface_boss'
        : door.targetBiome === 'crypt_of_bile'
          ? 'styx_hub'
          : 'combat';

    loadRoom(state, door.targetBiome, 1, nextKind, undefined, ctx);
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
// Wave 2 Gameplay Hazards (Warden Fury Sawblades, Sovereign Urns, Trial Attacks)
// ============================================================================

function tickGameplayHazards(
  state: SimState,
  dt: number,
  ctx: SimCombatContext
): void {
  const player = state.player;
  const bounds = state.room.bounds;

  for (let i = state.room.hazards.length - 1; i >= 0; i--) {
    const h = state.room.hazards[i];

    // Warden Fury bouncing Arena Sawblades
    if (h.kind === 'sawblade' && h.active) {
      h.timer -= dt;
      const spd = 340;
      let vx = Math.cos(h.cooldown) * spd;
      let vy = Math.sin(h.cooldown) * spd;
      h.pos.x += vx * dt;
      h.pos.y += vy * dt;

      if (h.pos.x < bounds.minX + h.radius || h.pos.x > bounds.maxX - h.radius) {
        vx = -vx;
        h.cooldown = Math.atan2(vy, vx);
        h.pos.x = Math.max(bounds.minX + h.radius, Math.min(bounds.maxX - h.radius, h.pos.x));
      }
      if (h.pos.y < bounds.minY + h.radius || h.pos.y > bounds.maxY - h.radius) {
        vy = -vy;
        h.cooldown = Math.atan2(vy, vx);
        h.pos.y = Math.max(bounds.minY + h.radius, Math.min(bounds.maxY - h.radius, h.pos.y));
      }

      const dx = player.pos.x - h.pos.x;
      const dy = player.pos.y - h.pos.y;
      if (dx * dx + dy * dy <= (h.radius + 20) ** 2) {
        ctx.dealDamageToPlayer(state, h.damage, {
          source: 'hazard',
          fromPos: h.pos,
        });
      }
      if (h.timer <= 0) {
        state.room.hazards.splice(i, 1);
      }
      continue;
    }

    // Sovereign Lord Phase 2 Grasping Urn Traps
    if (h.kind === 'urn' && h.owner === 'enemy' && h.active) {
      h.timer -= dt;
      const dx = player.pos.x - h.pos.x;
      const dy = player.pos.y - h.pos.y;
      if (!h.armed && dx * dx + dy * dy <= (h.radius + 14) ** 2) {
        h.armed = true;
        h.cooldown = 0.65;
        createTelegraph(
          state,
          {
            kind: 'circle',
            pos: h.pos,
            angle: 0,
            radius: h.radius,
            duration: 0.65,
            dangerColor: '#52ffb4',
          },
          ctx
        );
      } else if (h.armed) {
        h.cooldown -= dt;
        if (h.cooldown <= 0) {
          if (dx * dx + dy * dy <= (h.radius + 18) ** 2) {
            ctx.dealDamageToPlayer(state, h.damage, {
              source: 'hazard',
              fromPos: h.pos,
            });
          }
          ctx.addCameraShake(state, 5, 0.14);
          state.room.hazards.splice(i, 1);
          continue;
        }
      }
      if (h.timer <= 0) {
        state.room.hazards.splice(i, 1);
      }
    }
  }

  // Dual-Patron Trial Room: Spurned Patron blasts the arena every 3.4s!
  const rMeta = getRoomMeta(state);
  if (
    state.room.encounterKind === 'trial' &&
    rMeta.trialPhase === 'survive' &&
    state.room.trialSpurnedPatron &&
    !state.room.cleared
  ) {
    rMeta.trialHazardAcc += dt;
    if (rMeta.trialHazardAcc >= 3.4) {
      rMeta.trialHazardAcc -= 3.4;
      const spurned = state.room.trialSpurnedPatron;
      const color = PATRON_CONSTANTS[spurned].colorHex;
      const targetPos = { x: player.pos.x, y: player.pos.y };
      createTelegraph(
        state,
        {
          kind: 'circle',
          pos: targetPos,
          angle: 0,
          radius: 120,
          duration: 0.9,
          dangerColor: color,
        },
        ctx
      );
      // Spawn a delayed lobbed Patron hazard burst onto targetPos
      ctx.spawnProjectile(state, {
        owner: 'hazard',
        ownerId: `trial_${spurned}`,
        kind: 'bomb',
        pos: { x: targetPos.x, y: targetPos.y - 260 },
        vel: { x: 0, y: 290 },
        startPos: { x: targetPos.x, y: targetPos.y - 260 },
        radius: 18,
        angle: Math.PI * 0.5,
        damage: 16,
        range: 400,
        maxLife: 1.0,
        pierceLeft: 0,
        bouncesLeft: 0,
        deflectable: false,
        deflected: false,
        homingStrength: 0,
        isLob: true,
        lobHeight: 140,
        lobDuration: 0.9,
        lobElapsed: 0,
        targetPos,
        aoeRadius: 120,
        patronId: spurned,
        colorHex: color,
      });
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

      // No-damage chamber tracking (elapsedSeconds, encounterTimer, tightDeadlineTimer & telegraphs owned 1x by step.ts)
      if (state.player.hp < meta.lastPlayerHp) {
        state.room.noDamageTaken = false;
      }
      meta.lastPlayerHp = state.player.hp;

      // Active Boon timers, God Calls, Duo Passives, Enemy AI, Boss AI, Wave 2 Hazards
      tickBoons(state, dt, ctx);
      tickEnemies(state, dt, ctx);
      tickBosses(state, dt, ctx);
      tickGameplayHazards(state, dt, ctx);

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
            handleRoomClearedInternal(state, ctx, false);
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
      // Called by stepSim step 12 after stepSim already marked room.cleared + chambersCleared + room_cleared event
      handleRoomClearedInternal(state, ctx, true);
    },

    onEnemyKilled(state: SimState, enemy: EnemyState, ctx: SimCombatContext) {
      // Multi-phase boss revive (e.g. Sovereign Lord Phase 1 -> Phase 2 -> EM4 Phase 3)
      if (enemy.isBoss && enemy.phase < enemy.maxPhases) {
        if (tryTriggerMultiBarBossRevive(state, enemy, ctx)) {
          return;
        }
      }

      // Track codex kill tally
      state.meta.codexKills[enemy.archetype] =
        (state.meta.codexKills[enemy.archetype] ?? 0) + 1;

      const def = getEnemyArchetypeDef(enemy.archetype);

      // Verdant Colosseum Exalted Shades spawn a regenerating Soul-Eye on death!
      if (!enemy.isBoss && def.spawnsSoulEyeOnDeath) {
        spawnSoulEyeForExalted(state, enemy.archetype, enemy.pos, ctx);
      }

      // Benefits Package: Nova Death elite perk fires a 6-orb deflectable ring on death
      if (getEnemyPerks(enemy).includes('nova_death')) {
        for (let k = 0; k < 6; k++) {
          const ang = (Math.PI * 2 * k) / 6;
          ctx.spawnProjectile(state, {
            owner: 'enemy',
            ownerId: enemy.id,
            kind: 'orb',
            pos: { x: enemy.pos.x, y: enemy.pos.y },
            vel: { x: Math.cos(ang) * 340, y: Math.sin(ang) * 340 },
            startPos: { x: enemy.pos.x, y: enemy.pos.y },
            radius: 13,
            angle: ang,
            damage: 11,
            range: 520,
            maxLife: 1.8,
            pierceLeft: 0,
            bouncesLeft: 0,
            deflectable: true,
            deflected: false,
            homingStrength: 0,
            isLob: false,
            lobHeight: 0,
            lobDuration: 0,
            lobElapsed: 0,
            colorHex: '#ff6644',
          });
        }
      }

      // Drop gold reward on kill (respecting Chaos no_gold_gain & Primordial Affluence)
      const noGold = state.player.chaosCurses.some(
        (c) => c.curseKind === 'no_gold_gain'
      );
      if (
        !noGold &&
        !enemy.isBoss &&
        enemy.archetype !== 'rattlebones_dummy' &&
        enemy.archetype !== 'soul_orb'
      ) {
        const affluence = state.player.boons.find((b) => b.id === 'abyssos_affluence');
        const bonusMult = 1 + (affluence ? affluence.scaledValue : 0);
        const gold = Math.round((def.goldDrop + detNextInt(state, 0, 3, ctx)) * bonusMult);
        if (gold > 0) {
          state.player.gold += gold;
          state.floatingNumbers.push({
            id: `fl_killgold_${state.tick}_${state.floatingNumbers.length}`,
            pos: { x: enemy.pos.x, y: enemy.pos.y - 24 },
            vel: { x: 0, y: -45 },
            value: `+${gold}g`,
            kind: 'gold',
            colorHex: '#ffd942',
            life: 0.75,
            maxLife: 0.75,
          });
        }
      }

      // Boss defeat progression, Ferryman Loyalty Card & Sovereign Lord Victory!
      if (enemy.isBoss && enemy.bossId) {
        const cfg = getBossConfig(enemy.bossId);
        if (!state.run.bossesDefeated.includes(enemy.bossId)) {
          state.run.bossesDefeated.push(enemy.bossId);
        }
        state.meta.darkness += 60;

        if (enemy.bossId === 'the_ferryman') {
          const cm = getCampaignMeta(state);
          cm.hasFerrymanLoyaltyCard = true;
          state.meta.darkness += 60;
        }

        state.events.push({
          type: 'ui_toast',
          text: cfg.defeatToast,
          colorHex: '#ffd942',
        });

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
