import {
  ASPECT_DEFS,
  DEFAULT_RENDER_SETTINGS,
  KEEPSAKES,
  MIRROR_UPGRADES,
  PLAYER_CONSTANTS,
  SHRINE_VOWS,
  WEAPON_CONSTANTS,
  type AspectId,
  type EnemyState,
  type KeepsakeId,
  type MetaSaveState,
  type MirrorUpgradeId,
  type PatronId,
  type PlayerState,
  type ProjectileState,
  type ShrineVowId,
  type SimState,
  type StatusEffectId,
  type Vec2,
  type WeaponId,
} from '../contracts/index.js';
import {
  DEFAULT_SELECTED_ASPECTS,
  MIRROR_UPGRADE_ORDER,
  SHRINE_VOW_ORDER,
  STARTER_CURRENCIES,
  STARTER_MIRROR_RANKS,
  STARTER_MIRROR_SIDES,
  TIGHT_DEADLINE_SECONDS,
  WEAPON_ORDER,
  getAspectUpgradeCost,
  getDefaultAspectForWeapon,
  getMirrorRankValue,
  getMirrorSideDef,
  getMirrorTotalSpentForId,
  getMirrorUpgradeCost,
  getShrineVowHeat,
  isValidAspectForWeapon,
} from '../data/meta.js';
import {
  STARTER_UNLOCKED_KEEPSAKES,
  getKeepsakeValue,
} from '../data/keepsakes.js';

// ============================================================================
// Structural Combat & Gameplay Hook Contracts (matches @simcore verbatim)
// ============================================================================

export interface SimCombatContext {
  nextFloat(state: SimState): number;
  nextInt(state: SimState, min: number, max: number): number;
  dealDamageToEnemy(
    state: SimState,
    enemy: EnemyState,
    opts: {
      baseDamage: number;
      source:
        | 'attack'
        | 'special'
        | 'cast'
        | 'dash'
        | 'call'
        | 'status'
        | 'hazard'
        | 'deflect'
        | 'wall_slam';
      angle?: number;
      knockback?: number;
      canCrit?: boolean;
      bonusCritChance?: number;
      canBackstab?: boolean;
      statusId?: StatusEffectId;
      statusStacks?: number;
      patronId?: PatronId;
      isDashStrike?: boolean;
    }
  ): number;
  dealDamageToPlayer(
    state: SimState,
    amount: number,
    opts?: {
      source?: 'enemy' | 'hazard' | 'lava' | 'poison' | 'chaos';
      ignoreIframes?: boolean;
      canDodge?: boolean;
      fromPos?: Vec2;
    }
  ): number;
  applyStatus(
    state: SimState,
    target: EnemyState | PlayerState,
    targetKind: 'enemy' | 'player',
    statusId: StatusEffectId,
    stacks?: number,
    sourceId?: string
  ): void;
  spawnProjectile(
    state: SimState,
    proj: Omit<ProjectileState, 'id' | 'distanceTraveled' | 'life' | 'hitIds'>
  ): ProjectileState;
  triggerHitstop(state: SimState, duration: number, slowScale?: number): void;
  addCameraShake(state: SimState, intensity: number, duration: number): void;
}

export interface SimGameplayHooks {
  tickRoomAndAi?(state: SimState, dt: number, ctx: SimCombatContext): void;
  onPlayerDash?(
    state: SimState,
    startPos: Vec2,
    endPos: Vec2,
    perfect: boolean,
    ctx: SimCombatContext
  ): void;
  onPlayerAttackHit?(
    state: SimState,
    enemy: EnemyState,
    source: 'attack' | 'special' | 'cast',
    damage: number,
    ctx: SimCombatContext
  ): void;
  onPlayerGodCall?(
    state: SimState,
    patronId: PatronId,
    greater: boolean,
    ctx: SimCombatContext
  ): void;
  onInteract?(state: SimState, ctx: SimCombatContext): boolean;
  onSelectBoon?(state: SimState, optionIndex: number, ctx: SimCombatContext): boolean;
  onRerollBoon?(state: SimState, ctx: SimCombatContext): boolean;
  onRoomCleared?(state: SimState, ctx: SimCombatContext): void;
  onEnemyKilled?(state: SimState, enemy: EnemyState, ctx: SimCombatContext): void;
}

// ============================================================================
// Pure Deterministic Mulberry32 Helpers (for entrypoints outside stepSim)
// ============================================================================

export type RngProvider = Pick<SimCombatContext, 'nextFloat' | 'nextInt'>;

export function normalizeSeed(seed: number): number {
  const s = (Math.floor(seed) | 0) >>> 0;
  return s === 0 ? 0x9e3779b9 : s;
}

export function detNextFloat(state: SimState, ctx?: RngProvider): number {
  if (ctx) {
    return ctx.nextFloat(state);
  }
  let t = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function detNextInt(
  state: SimState,
  min: number,
  max: number,
  ctx?: RngProvider
): number {
  if (ctx) {
    return ctx.nextInt(state, min, max);
  }
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi <= lo) return lo;
  return lo + Math.floor(detNextFloat(state) * (hi - lo + 1));
}

export function detPick<T>(
  state: SimState,
  items: readonly T[],
  ctx?: RngProvider
): T {
  const idx = detNextInt(state, 0, Math.max(0, items.length - 1), ctx);
  return items[idx] ?? items[0];
}

// ============================================================================
// Meta Save Creation, Heat Calculation & Player Stat Application
// ============================================================================

export function createDefaultMetaSave(): MetaSaveState {
  const selectedAspects: Record<WeaponId, AspectId> = {
    ...DEFAULT_SELECTED_ASPECTS,
  };
  const aspectRanks: Partial<Record<AspectId, number>> = {
    blade_scion: 1,
    spear_scion: 1,
    shield_scion: 1,
    bow_scion: 1,
    fists_scion: 1,
    rail_scion: 1,
  };
  const keepsakeRanks: Partial<Record<KeepsakeId, number>> = {};
  for (const id of STARTER_UNLOCKED_KEEPSAKES) {
    keepsakeRanks[id] = 1;
  }

  return {
    version: 1,
    darkness: STARTER_CURRENCIES.darkness,
    gemstones: STARTER_CURRENCIES.gemstones,
    keys: STARTER_CURRENCIES.keys,
    nectar: STARTER_CURRENCIES.nectar,
    titanBlood: STARTER_CURRENCIES.titanBlood,
    diamonds: STARTER_CURRENCIES.diamonds,
    ambrosia: STARTER_CURRENCIES.ambrosia,
    totalRuns: 0,
    totalClears: 0,
    totalDeaths: 0,
    bestClearTimeSeconds: null,
    highestHeatCleared: 0,
    godModeEnabled: false,
    godModeDeaths: 0,
    selectedWeapon: 'stygian_blade',
    selectedAspects,
    unlockedWeapons: [...WEAPON_ORDER],
    aspectRanks,
    selectedKeepsake: null,
    unlockedKeepsakes: [...STARTER_UNLOCKED_KEEPSAKES],
    keepsakeRanks,
    mirrorRanks: { ...STARTER_MIRROR_RANKS },
    mirrorActiveSide: { ...STARTER_MIRROR_SIDES },
    shrineVows: {},
    codexKills: {},
    codexBoonsSeen: [],
    settings: { ...DEFAULT_RENDER_SETTINGS },
  };
}

export function computeHeat(vows: Partial<Record<ShrineVowId, number>>): number {
  let heat = 0;
  for (const vowId of SHRINE_VOW_ORDER) {
    const rank = vows[vowId] ?? 0;
    if (rank > 0) {
      heat += getShrineVowHeat(vowId, rank);
    }
  }
  return heat;
}

export function isMirrorRowDisabled(
  row: number,
  vows: Partial<Record<ShrineVowId, number>>
): boolean {
  const inspectionRank = Math.max(0, Math.min(4, Math.floor(vows.routine_inspection ?? 0)));
  if (inspectionRank <= 0) {
    return false;
  }
  const disabledFromRow = 13 - inspectionRank * 3;
  return row >= disabledFromRow;
}

export function getEffectiveMirrorUpgrade(
  meta: MetaSaveState,
  vows: Partial<Record<ShrineVowId, number>>,
  id: MirrorUpgradeId
): { side: 'a' | 'b'; rank: number; value: number; disabled: boolean } {
  const def = MIRROR_UPGRADES[id];
  const side = meta.mirrorActiveSide[id] ?? 'a';
  if (isMirrorRowDisabled(def.row, vows)) {
    return { side, rank: 0, value: 0, disabled: true };
  }
  const sideDef = getMirrorSideDef(id, side);
  const rawRank = meta.mirrorRanks[id] ?? 0;
  const rank = Math.max(0, Math.min(sideDef.maxRank, Math.floor(rawRank)));
  return {
    side,
    rank,
    value: getMirrorRankValue(id, side, rank),
    disabled: false,
  };
}

export function getGodModeDamageMultiplier(
  meta: MetaSaveState,
  enabledOverride?: boolean
): number {
  const enabled = enabledOverride ?? meta.godModeEnabled;
  if (!enabled) {
    return 1.0;
  }
  const cappedDeaths = Math.max(
    0,
    Math.min(PLAYER_CONSTANTS.godModeMaxDeaths, Math.floor(meta.godModeDeaths))
  );
  return Math.max(
    0.2,
    PLAYER_CONSTANTS.godModeBaseMultiplier - cappedDeaths * PLAYER_CONSTANTS.godModePerDeathStep
  );
}

export function getHealingMultiplier(vows: Partial<Record<ShrineVowId, number>>): number {
  const rank = Math.max(0, Math.min(4, Math.floor(vows.lasting_consequences ?? 0)));
  return Math.max(0, 1 - rank * 0.25);
}

export function getShopPriceMultiplier(
  vows: Partial<Record<ShrineVowId, number>>,
  hasLoyaltyCard = false
): number {
  const rank = Math.max(0, Math.min(2, Math.floor(vows.convenience_fee ?? 0)));
  const mult = 1 + rank * 0.4;
  return hasLoyaltyCard ? mult * 0.8 : mult;
}

export function getKeepsakeRank(meta: MetaSaveState, id: KeepsakeId | null): number {
  if (!id) return 0;
  return Math.max(1, Math.min(3, Math.floor(meta.keepsakeRanks[id] ?? 1)));
}

export function getWellBonusEncounters(state: SimState): number {
  if (state.player.keepsakeId !== 'bone_sandglass') return 0;
  return getKeepsakeValue(
    'bone_sandglass',
    getKeepsakeRank(state.meta, 'bone_sandglass')
  );
}

export function applyMetaToPlayer(
  state: SimState,
  opts?: { resetVitals?: boolean }
): void {
  const resetVitals = opts?.resetVitals ?? true;
  const meta = state.meta;
  const player = state.player;
  const run = state.run;

  // Sync Shrine vows & Heat
  run.vows = { ...meta.shrineVows, ...run.vows };
  run.heat = computeHeat(run.vows);
  run.godModeEnabled = meta.godModeEnabled;

  // Tight Deadline timer
  const deadlineRank = Math.max(0, Math.min(3, Math.floor(run.vows.tight_deadline ?? 0)));
  if (resetVitals || run.tightDeadlineTimer === null) {
    run.tightDeadlineTimer =
      deadlineRank > 0 ? (TIGHT_DEADLINE_SECONDS[deadlineRank - 1] ?? null) : null;
  } else if (deadlineRank === 0) {
    run.tightDeadlineTimer = null;
  }

  // Selected weapon & aspect
  const weaponId: WeaponId = WEAPON_CONSTANTS[meta.selectedWeapon]
    ? meta.selectedWeapon
    : 'stygian_blade';
  const rawAspect = meta.selectedAspects[weaponId] ?? getDefaultAspectForWeapon(weaponId);
  const aspectId: AspectId = isValidAspectForWeapon(weaponId, rawAspect)
    ? rawAspect
    : getDefaultAspectForWeapon(weaponId);
  const aspectRank = Math.max(1, Math.min(5, Math.floor(meta.aspectRanks[aspectId] ?? 1)));

  player.weaponId = weaponId;
  player.aspectId = aspectId;

  // Weapon ammo capacity (Adamant Rail)
  const weaponDef = WEAPON_CONSTANTS[weaponId];
  let maxAmmo = weaponDef.clipSize ?? 0;
  if (weaponId === 'adamant_rail' && aspectId === 'rail_scion') {
    maxAmmo += Math.round(ASPECT_DEFS.rail_scion.bonusPerRank * aspectRank);
  }
  if (player.hammers.includes('hammer_rail_flurry_fire')) {
    maxAmmo += 6;
  }
  player.maxAmmo = maxAmmo;
  if (resetVitals) {
    player.ammo = maxAmmo;
    player.reloadTimer = 0;
  } else {
    player.ammo = Math.min(player.ammo, maxAmmo);
  }

  // Max HP: Base 50 + Thick Skin (side A) + Spiked Collar + Chaos Vitality + Aspect modifiers
  const thickSkin = getEffectiveMirrorUpgrade(meta, run.vows, 'thick_skin');
  let maxHp: number = PLAYER_CONSTANTS.baseMaxHealth;
  if (thickSkin.side === 'a') {
    maxHp += Math.min(PLAYER_CONSTANTS.thickSkinMaxBonus, thickSkin.value);
  }
  const keepsakeId = meta.selectedKeepsake;
  player.keepsakeId = keepsakeId;
  const keepsakeRank = getKeepsakeRank(meta, keepsakeId);
  if (keepsakeId === 'old_collar') {
    maxHp += getKeepsakeValue('old_collar', keepsakeRank);
  }
  for (const boon of player.boons) {
    if (boon.id === 'abyssos_vitality') {
      maxHp += Math.round(boon.scaledValue);
    }
  }
  if (aspectId === 'blade_paladin') {
    maxHp += 50;
  } else if (aspectId === 'spear_dragon') {
    maxHp = Math.round(maxHp * 0.5);
  }
  if (player.hammers.includes('hammer_blade_cursed_slash')) {
    maxHp = Math.round(maxHp * 0.4);
  }
  maxHp = Math.max(25, Math.round(maxHp));
  if (resetVitals) {
    player.maxHp = maxHp;
    player.hp = maxHp;
    player.isDead = false;
  } else {
    const delta = Math.max(0, maxHp - player.maxHp);
    player.maxHp = Math.max(player.maxHp, maxHp);
    if (player.hammers.includes('hammer_blade_cursed_slash') || aspectId === 'spear_dragon') {
      player.maxHp = maxHp;
    }
    player.hp = Math.min(player.maxHp, player.hp + delta);
  }

  // Dash charges: Base 1 + Greater Reflex (side A) + Feral Claws + Greatest Reflex boon
  const reflex = getEffectiveMirrorUpgrade(meta, run.vows, 'greater_reflex');
  let maxDashes: number = PLAYER_CONSTANTS.dashBaseClip;
  if (reflex.side === 'a' && reflex.rank > 0) {
    maxDashes += Math.round(reflex.value);
  }
  if (aspectId === 'fists_feral') {
    maxDashes += 2;
  }
  for (const b of player.boons) {
    if (b.id === 'veloce_greatest_reflex') {
      maxDashes += Math.max(1, Math.round(b.scaledValue));
    }
  }
  player.maxDashCharges = maxDashes;
  if (resetVitals) {
    player.dashCharges = maxDashes;
  } else {
    player.dashCharges = Math.min(player.dashCharges, maxDashes);
  }

  // Death Defiances: Mirror side A (ranks) or Stubborn Defiance side B (1 per room) + Lucky Fang
  const defiance = getEffectiveMirrorUpgrade(meta, run.vows, 'death_defiance');
  let maxDefiances = 0;
  if (defiance.side === 'a') {
    maxDefiances = Math.round(defiance.value);
  } else if (defiance.side === 'b' && defiance.rank > 0) {
    maxDefiances = 1;
  }
  if (keepsakeId === 'lucky_fang' && !player.keepsakeUsed) {
    maxDefiances += 1;
  }
  player.maxDeathDefiances = maxDefiances;
  if (resetVitals) {
    player.deathDefiances = maxDefiances;
  } else {
    player.deathDefiances = Math.min(player.deathDefiances, maxDefiances);
  }

  // Cast Bloodstones: Base 1 + Infernal Soul (side A) + Primordial Grasp
  const soul = getEffectiveMirrorUpgrade(meta, run.vows, 'infernal_soul');
  let maxCast: number = PLAYER_CONSTANTS.baseCastAmmo;
  if (soul.side === 'a') {
    maxCast += Math.min(PLAYER_CONSTANTS.infernalSoulMaxBonus, Math.round(soul.value));
  }
  for (const b of player.boons) {
    if (b.id === 'abyssos_grasp') {
      maxCast += Math.max(1, Math.round(b.scaledValue));
    }
  }
  player.maxCastAmmo = maxCast;
  if (resetVitals) {
    player.castAmmo = maxCast;
    player.castRegenTimer = 0;
  } else {
    player.castAmmo = Math.min(player.castAmmo, maxCast);
  }

  // Veloce Greater Evasion passive dodge folded safely into dodge pool
  const evasionBoon = player.boons.find((b) => b.id === 'veloce_greater_evasion');
  if (evasionBoon && player.plumeBonus < evasionBoon.scaledValue) {
    player.plumeBonus = Math.max(player.plumeBonus, evasionBoon.scaledValue);
  }

  // Starting Gold: Deep Pockets (side A) + Gilded Pouch keepsake
  if (resetVitals) {
    const deepPockets = getEffectiveMirrorUpgrade(meta, run.vows, 'deep_pockets');
    let startGold = deepPockets.side === 'a' ? Math.round(deepPockets.value) : 0;
    if (keepsakeId === 'coin_pouch' && !player.keepsakeUsed) {
      startGold += getKeepsakeValue('coin_pouch', keepsakeRank);
      player.keepsakeUsed = true;
    }
    player.gold = startGold;
    player.acornShields = 0;
    player.plumeBonus = evasionBoon ? evasionBoon.scaledValue : 0;
  }

  // Fated Authority (door rerolls) vs Fated Persuasion (boon rerolls)
  if (resetVitals) {
    const fated = getEffectiveMirrorUpgrade(meta, run.vows, 'fated_authority');
    run.doorRerolls = fated.side === 'a' ? Math.round(fated.value) : 0;
    run.boonRerolls = fated.side === 'b' ? Math.round(fated.value) : 0;
  }
}

// ============================================================================
// Hub Meta Upgrade & Equipment Mutations (Mirror, Weapons, Shrine, Keepsakes)
// ============================================================================

export function purchaseMirrorUpgrade(
  meta: MetaSaveState,
  id: MirrorUpgradeId
): boolean {
  const side = meta.mirrorActiveSide[id] ?? 'a';
  const sideDef = getMirrorSideDef(id, side);
  const currentRank = Math.max(0, Math.floor(meta.mirrorRanks[id] ?? 0));
  if (currentRank >= sideDef.maxRank) {
    return false;
  }
  const cost = getMirrorUpgradeCost(id, side, currentRank);
  if (meta.darkness < cost) {
    return false;
  }
  meta.darkness -= cost;
  meta.mirrorRanks[id] = currentRank + 1;
  return true;
}

export function refundMirrorUpgrades(meta: MetaSaveState): number {
  let refunded = 0;
  for (const id of MIRROR_UPGRADE_ORDER) {
    const side = meta.mirrorActiveSide[id] ?? 'a';
    const rank = Math.max(0, Math.floor(meta.mirrorRanks[id] ?? 0));
    if (rank > 0) {
      refunded += getMirrorTotalSpentForId(id, side, rank);
      meta.mirrorRanks[id] = 0;
    }
  }
  meta.darkness += refunded;
  return refunded;
}

export function toggleMirrorSide(
  meta: MetaSaveState,
  id: MirrorUpgradeId
): 'a' | 'b' {
  const next: 'a' | 'b' = (meta.mirrorActiveSide[id] ?? 'a') === 'a' ? 'b' : 'a';
  meta.mirrorActiveSide[id] = next;
  const sideDef = getMirrorSideDef(id, next);
  if ((meta.mirrorRanks[id] ?? 0) > sideDef.maxRank) {
    meta.mirrorRanks[id] = sideDef.maxRank;
  }
  return next;
}

export function setShrineVowRank(
  meta: MetaSaveState,
  id: ShrineVowId,
  rank: number
): number {
  const def = SHRINE_VOWS[id];
  const clamped = Math.max(0, Math.min(def.maxRank, Math.floor(rank)));
  if (clamped === 0) {
    delete meta.shrineVows[id];
  } else {
    meta.shrineVows[id] = clamped;
  }
  return computeHeat(meta.shrineVows);
}

export function unlockWeapon(meta: MetaSaveState, weaponId: WeaponId): boolean {
  if (!WEAPON_CONSTANTS[weaponId]) return false;
  if (meta.unlockedWeapons.includes(weaponId)) return true;
  if (meta.keys < 1) return false;
  meta.keys -= 1;
  meta.unlockedWeapons.push(weaponId);
  return true;
}

export function upgradeWeaponAspect(
  meta: MetaSaveState,
  aspectId: AspectId
): boolean {
  const def = ASPECT_DEFS[aspectId];
  if (!def) return false;
  const curRank = Math.max(0, Math.floor(meta.aspectRanks[aspectId] ?? 0));
  if (curRank >= def.maxRank) return false;
  const cost = getAspectUpgradeCost(aspectId, curRank);
  if (meta.titanBlood < cost) return false;
  meta.titanBlood -= cost;
  meta.aspectRanks[aspectId] = curRank + 1;
  return true;
}

export function selectWeaponAndAspect(
  meta: MetaSaveState,
  weaponId: WeaponId,
  aspectId?: AspectId
): void {
  if (!WEAPON_CONSTANTS[weaponId]) return;
  if (!meta.unlockedWeapons.includes(weaponId)) {
    meta.unlockedWeapons.push(weaponId);
  }
  meta.selectedWeapon = weaponId;
  if (aspectId && isValidAspectForWeapon(weaponId, aspectId)) {
    meta.selectedAspects[weaponId] = aspectId;
    if ((meta.aspectRanks[aspectId] ?? 0) <= 0) {
      meta.aspectRanks[aspectId] = 1;
    }
  } else if (!isValidAspectForWeapon(weaponId, meta.selectedAspects[weaponId])) {
    meta.selectedAspects[weaponId] = getDefaultAspectForWeapon(weaponId);
  }
}

export function selectKeepsake(
  meta: MetaSaveState,
  keepsakeId: KeepsakeId | null
): void {
  if (keepsakeId && !KEEPSAKES[keepsakeId]) return;
  if (keepsakeId && !meta.unlockedKeepsakes.includes(keepsakeId)) {
    meta.unlockedKeepsakes.push(keepsakeId);
  }
  if (keepsakeId && !(meta.keepsakeRanks[keepsakeId] ?? 0)) {
    meta.keepsakeRanks[keepsakeId] = 1;
  }
  meta.selectedKeepsake = keepsakeId;
}

export function upgradeKeepsakeRank(
  meta: MetaSaveState,
  keepsakeId: KeepsakeId
): number {
  if (!KEEPSAKES[keepsakeId]) return 0;
  const cur = Math.max(1, Math.min(3, Math.floor(meta.keepsakeRanks[keepsakeId] ?? 1)));
  const next = Math.min(3, cur + 1);
  meta.keepsakeRanks[keepsakeId] = next;
  return next;
}

export function recordRunEndMeta(state: SimState, victory: boolean): void {
  const meta = state.meta;
  const run = state.run;
  meta.totalRuns += 1;
  if (victory) {
    meta.totalClears += 1;
    if (
      meta.bestClearTimeSeconds === null ||
      run.elapsedSeconds < meta.bestClearTimeSeconds
    ) {
      meta.bestClearTimeSeconds = Math.round(run.elapsedSeconds * 10) / 10;
    }
    if (run.heat > meta.highestHeatCleared) {
      meta.highestHeatCleared = run.heat;
    }
  } else {
    meta.totalDeaths += 1;
    if (meta.godModeEnabled || run.godModeEnabled) {
      meta.godModeDeaths = Math.min(
        PLAYER_CONSTANTS.godModeMaxDeaths,
        meta.godModeDeaths + 1
      );
    }
  }
  // Level up equipped Keepsake after surviving chambers
  if (state.player.keepsakeId && run.chambersCleared >= 5) {
    upgradeKeepsakeRank(meta, state.player.keepsakeId);
  }
}

export function getAllMirrorUpgradeIds(): readonly MirrorUpgradeId[] {
  return MIRROR_UPGRADE_ORDER;
}
