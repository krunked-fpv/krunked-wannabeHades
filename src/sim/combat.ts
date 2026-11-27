import {
  COMBAT_CONSTANTS,
  KEEPSAKES,
  LAVA_CONSTANTS,
  MIRROR_UPGRADES,
  PATRON_CONSTANTS,
  PLAYER_CONSTANTS,
  SIM_CONSTANTS,
  type AspectId,
  type BoonInstance,
  type BoonSlot,
  type EnemyState,
  type FloatingNumber,
  type PatronId,
  type PlayerState,
  type ProjectileState,
  type SimState,
  type StatusEffectId,
  type Vec2,
  type WeaponId,
} from '../contracts/index.js';
import { getAspectBonus, getAspectRank } from '../data/aspects.js';
import { hasHammer } from '../data/hammers.js';
import { checkProjectileObstacleHit } from './collision.js';
import { ellipseDistance, isInEllipticalCone, normalizeAngle, shortestAngleDelta } from './isometric.js';
import { chance, nextFloat, nextInt } from './prng.js';
import {
  applyStatus,
  countUniqueStatuses,
  getStatus,
  removeStatus,
} from './status.js';

export type DamageSource =
  | 'attack'
  | 'special'
  | 'cast'
  | 'dash'
  | 'call'
  | 'status'
  | 'hazard'
  | 'deflect'
  | 'wall_slam';

export interface DealDamageToEnemyOptions {
  baseDamage: number;
  source: DamageSource;
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

export interface DealDamageToPlayerOptions {
  source?: 'enemy' | 'hazard' | 'lava' | 'poison' | 'chaos';
  ignoreIframes?: boolean;
  canDodge?: boolean;
  fromPos?: Vec2;
}

export interface SimCombatContext {
  nextFloat(state: SimState): number;
  nextInt(state: SimState, min: number, max: number): number;
  dealDamageToEnemy(state: SimState, enemy: EnemyState, opts: DealDamageToEnemyOptions): number;
  dealDamageToPlayer(state: SimState, amount: number, opts?: DealDamageToPlayerOptions): number;
  applyStatus(
    state: SimState,
    target: EnemyState | PlayerState,
    targetKind: 'enemy' | 'player',
    statusId: StatusEffectId,
    stacks?: number,
    sourceId?: string,
  ): void;
  spawnProjectile(
    state: SimState,
    proj: Omit<ProjectileState, 'id' | 'distanceTraveled' | 'life' | 'hitIds'>,
  ): ProjectileState;
  triggerHitstop(state: SimState, duration: number, slowScale?: number): void;
  addCameraShake(state: SimState, intensity: number, duration: number): void;
}

export interface SimGameplayHooks {
  tickRoomAndAi?(state: SimState, dt: number, ctx: SimCombatContext): void;
  onPlayerDash?(state: SimState, startPos: Vec2, endPos: Vec2, perfect: boolean, ctx: SimCombatContext): void;
  onPlayerAttackHit?(state: SimState, enemy: EnemyState, source: 'attack' | 'special' | 'cast', damage: number, ctx: SimCombatContext): void;
  onPlayerGodCall?(state: SimState, patronId: PatronId, greater: boolean, ctx: SimCombatContext): void;
  onInteract?(state: SimState, ctx: SimCombatContext): boolean;
  onSelectBoon?(state: SimState, optionIndex: number, ctx: SimCombatContext): boolean;
  onRerollBoon?(state: SimState, ctx: SimCombatContext): boolean;
  onRoomCleared?(state: SimState, ctx: SimCombatContext): void;
  onEnemyKilled?(state: SimState, enemy: EnemyState, ctx: SimCombatContext): void;
}

// ============================================================================
// Deterministic Per-SimState Weapon/Aspect Runtime (WeakMap preserves SimState contract)
// ============================================================================

export interface WeaponRuntime {
  lastWeaponId: WeaponId;
  lastAspectId: AspectId;
  cursedSlashApplied: boolean;
  // Eternal Spear
  spearHoldTimer: number;
  spearSpinCharging: boolean;
  spearSpecialHoldTimer: number;
  spearSpecialCharging: boolean;
  punishingSweep: Map<string, number>;
  // Shield of Chaos
  shieldHoldTimer: number;
  shieldBullCharging: boolean;
  abyssExtraShields: number;
  blitzDiscPulseTimer: number;
  // Heart-Seeking Bow
  bowDashChargeActive: boolean;
  bowTrackerTargetId: string | null;
  bowTrackerTimer: number;
  sharedSuffering: Map<string, number>;
  // Cast-loading Aspects (bow_loaded & shield_behemoth)
  loadedCasts: number;
  // Twin Fists
  fistsCutterHits: number;
  magneticPullTargets: Map<string, number>;
  // Adamant Rail
  railBeamRamp: number;
  railBeamTickTimer: number;
  railBurstRemaining: number;
  railBurstCooldown: number;
}

const weaponRuntimeMap = new WeakMap<SimState, WeaponRuntime>();
let propagatingSharedSuffering = false;

export const FROST_SPIN_WAVE_SENTINEL = 999;
export const BLITZ_DISC_PIERCE_SENTINEL = 80;

export function getWeaponRuntime(state: SimState): WeaponRuntime {
  let rt = weaponRuntimeMap.get(state);
  if (!rt) {
    rt = {
      lastWeaponId: state.player.weaponId,
      lastAspectId: state.player.aspectId,
      cursedSlashApplied: hasHammer(state.player, 'hammer_blade_cursed_slash'),
      spearHoldTimer: 0,
      spearSpinCharging: false,
      spearSpecialHoldTimer: 0,
      spearSpecialCharging: false,
      punishingSweep: new Map(),
      shieldHoldTimer: 0,
      shieldBullCharging: false,
      abyssExtraShields: 0,
      blitzDiscPulseTimer: 0,
      bowDashChargeActive: false,
      bowTrackerTargetId: null,
      bowTrackerTimer: 0,
      sharedSuffering: new Map(),
      loadedCasts: 0,
      fistsCutterHits: 0,
      magneticPullTargets: new Map(),
      railBeamRamp: 0,
      railBeamTickTimer: 0,
      railBurstRemaining: 0,
      railBurstCooldown: 0,
    };
    weaponRuntimeMap.set(state, rt);
  }
  return rt;
}

export function resetTransientWeaponRuntime(state: SimState): void {
  const rt = getWeaponRuntime(state);
  const player = state.player;
  rt.lastWeaponId = player.weaponId;
  rt.lastAspectId = player.aspectId;
  rt.spearHoldTimer = 0;
  rt.spearSpinCharging = false;
  rt.spearSpecialHoldTimer = 0;
  rt.spearSpecialCharging = false;
  rt.shieldHoldTimer = 0;
  rt.shieldBullCharging = false;
  rt.abyssExtraShields = 0;
  rt.blitzDiscPulseTimer = 0;
  rt.bowDashChargeActive = false;
  rt.loadedCasts = 0;
  rt.railBeamRamp = 0;
  rt.railBeamTickTimer = 0;
  rt.railBurstRemaining = 0;
  rt.railBurstCooldown = 0;
  player.isBlocking = false;
  player.spearOut = false;
  player.shieldOut = false;
  player.attackChargeTimer = 0;
}

export function tickWeaponRuntime(state: SimState, dt: number): void {
  if (dt <= 0) return;
  const rt = getWeaponRuntime(state);
  const player = state.player;

  // Detect live weapon / aspect swaps (e.g. Weapon Rack or DebugBridge.setWeapon)
  if (rt.lastWeaponId !== player.weaponId || rt.lastAspectId !== player.aspectId) {
    // Return any loaded casts to player before resetting
    if (rt.loadedCasts > 0) {
      player.castAmmo = Math.min(player.maxCastAmmo, player.castAmmo + rt.loadedCasts);
    }
    resetTransientWeaponRuntime(state);
    if (player.weaponId === 'adamant_rail' && player.maxAmmo > 0 && player.ammo <= 0) {
      player.ammo = player.maxAmmo;
      player.reloadTimer = 0;
    }
  }

  // Tick Punishing Sweep timers (spear_sovereign)
  if (rt.punishingSweep.size > 0) {
    for (const [id, rem] of rt.punishingSweep) {
      const next = rem - dt;
      if (next <= 0) {
        rt.punishingSweep.delete(id);
      } else {
        rt.punishingSweep.set(id, next);
      }
    }
  }

  // Tick Shared Suffering timers (bow_celestial)
  if (rt.sharedSuffering.size > 0) {
    for (const [id, rem] of rt.sharedSuffering) {
      const next = rem - dt;
      if (next <= 0) {
        rt.sharedSuffering.delete(id);
      } else {
        rt.sharedSuffering.set(id, next);
      }
    }
  }

  // Tick Magnetic Pull vulnerability timers (fists_magnet)
  if (rt.magneticPullTargets.size > 0) {
    for (const [id, rem] of rt.magneticPullTargets) {
      const next = rem - dt;
      if (next <= 0) {
        rt.magneticPullTargets.delete(id);
      } else {
        rt.magneticPullTargets.set(id, next);
      }
    }
  }

  // Tick Bow Tracker target timer (bow_tracker)
  if (rt.bowTrackerTimer > 0) {
    rt.bowTrackerTimer = Math.max(0, rt.bowTrackerTimer - dt);
    if (rt.bowTrackerTimer === 0) {
      rt.bowTrackerTargetId = null;
    }
  }

  // Ensure spearOut / shieldOut never stick if projectile vanished across room transition
  if (player.spearOut) {
    const hasSpear = state.projectiles.some((p) => p.owner === 'player' && p.kind === 'spear');
    if (!hasSpear) player.spearOut = false;
  }
  if (player.shieldOut) {
    const hasShield = state.projectiles.some((p) => p.owner === 'player' && p.kind === 'shield');
    if (!hasShield) player.shieldOut = false;
  }
}

export function getBoonInSlot(player: PlayerState, slot: BoonSlot): BoonInstance | undefined {
  for (let i = 0; i < player.boons.length; i++) {
    if (player.boons[i].slot === slot) return player.boons[i];
  }
  return undefined;
}

export function spawnFloatingNumber(
  state: SimState,
  pos: Vec2,
  value: number | string,
  kind: FloatingNumber['kind'],
  colorHex: string,
): void {
  const jitterX = (nextFloat(state) - 0.5) * 28;
  state.floatingNumbers.push({
    id: `fn_${state.tick}_${nextInt(state, 0, 999999)}`,
    pos: { x: pos.x + jitterX, y: pos.y - 24 },
    vel: { x: jitterX * 1.4, y: kind === 'crit' ? -130 : -92 },
    value,
    kind,
    colorHex,
    life: kind === 'crit' ? 0.95 : 0.72,
    maxLife: kind === 'crit' ? 0.95 : 0.72,
  });
}

export function triggerHitstop(state: SimState, duration: number, slowScale?: number): void {
  if (state.hitstopCooldownTimer > 0) return;
  const clamped = Math.max(0.015, Math.min(0.08, duration));
  state.hitstopTimer = Math.max(state.hitstopTimer, clamped);
  state.hitstopCooldownTimer = COMBAT_CONSTANTS.hitstopCooldown;
  if (slowScale !== undefined && slowScale > 0 && slowScale < 1) {
    state.timeScale = Math.min(state.timeScale, slowScale);
  }
  state.events.push({
    type: 'hitstop',
    duration: clamped,
    intensity: clamped / 0.06,
  });
}

export function addCameraShake(state: SimState, intensity: number, duration: number): void {
  if (intensity <= 0 || duration <= 0) return;
  state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, intensity);
  state.camera.shakeTimer = Math.max(state.camera.shakeTimer, duration);
  state.events.push({
    type: 'camera_shake',
    intensity,
    duration,
  });
}

export function healPlayer(state: SimState, rawAmount: number): number {
  const player = state.player;
  if (player.isDead || rawAmount <= 0) return 0;

  const lcRank = state.run.vows.lasting_consequences ?? 0;
  const healMult = Math.max(0, 1 - lcRank * 0.25);
  const amount = Math.round(rawAmount * healMult);
  if (amount <= 0) return 0;

  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + amount);
  const gained = player.hp - before;
  if (gained > 0) {
    spawnFloatingNumber(state, player.pos, `+${gained}`, 'heal', '#52FF9A');
  }
  return gained;
}

function getKeepsakeRankIndex(state: SimState): number {
  const id = state.player.keepsakeId;
  if (!id) return 0;
  const rank = state.meta.keepsakeRanks[id] ?? 1;
  return Math.max(0, Math.min(2, Math.floor(rank) - 1));
}

function isRoutineInspectionDisablingRow(state: SimState, row: number): boolean {
  const riRank = state.run.vows.routine_inspection ?? 0;
  if (riRank <= 0) return false;
  const disabledFromRow = 13 - riRank * 3;
  return row >= disabledFromRow;
}

function extractAdditivePercent(boon: BoonInstance): number {
  // Voltaris attack/special add flat chain lightning, Bellum/Bacchion add Doom/Hangover flat damage
  if (
    (boon.slot === 'attack' || boon.slot === 'special') &&
    (boon.patronId === 'voltaris' || boon.patronId === 'bellum' || boon.patronId === 'bacchion')
  ) {
    return 0;
  }
  const v = boon.scaledValue;
  if (v <= 0) return 0;
  return v <= 3.0 ? v : v / 100;
}

export function dropLodgedBloodstones(state: SimState, enemy: EnemyState): number {
  let dropped = 0;
  while (enemy.lodgedCasts > 0) {
    enemy.lodgedCasts -= 1;
    enemy.lodgedCastTimers.pop();
    const angle = nextFloat(state) * Math.PI * 2;
    const speed = 130 + nextFloat(state) * 90;
    state.room.bloodstones.push({
      id: `bs_${state.tick}_${nextInt(state, 0, 999999)}`,
      pos: { x: enemy.pos.x, y: enemy.pos.y },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed * SIM_CONSTANTS.isoScaleY },
      life: 0,
      magnetizing: false,
    });
    dropped++;
  }
  return dropped;
}

export function detonateHellfireMine(
  state: SimState,
  hazardIndex: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const h = state.room.hazards[hazardIndex];
  if (!h || h.kind !== 'pylon' || h.owner !== 'player' || !h.id.startsWith('mine_')) return;
  const pos = { x: h.pos.x, y: h.pos.y };
  state.room.hazards.splice(hazardIndex, 1);

  const rank = getAspectRank(state.meta.aspectRanks, 'rail_beam');
  const mult = 1 + getAspectBonus('rail_beam', rank);
  const dmg = Math.round(120 * mult);
  const blastRadius = 280;

  addCameraShake(state, 10.0, 0.22);
  triggerHitstop(state, 0.04);
  spawnFloatingNumber(state, pos, 'HELLFIRE!', 'crit', '#FF7B29');

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0 || e.aiState === 'dead') continue;
    if (ellipseDistance(e.pos.x - pos.x, e.pos.y - pos.y) <= blastRadius + e.radius) {
      dealDamageToEnemy(
        state,
        e,
        {
          baseDamage: dmg,
          source: 'special',
          knockback: 1400,
        },
        hooks,
        ctx,
      );
    }
  }
}

export function dealDamageToEnemy(
  state: SimState,
  enemy: EnemyState,
  opts: DealDamageToEnemyOptions,
  hooks?: SimGameplayHooks,
  ctx?: SimCombatContext,
): number {
  if (
    opts.baseDamage <= 0 ||
    enemy.hp <= 0 ||
    enemy.aiState === 'dead' ||
    enemy.invulnerable ||
    enemy.invulnTimer > 0
  ) {
    return 0;
  }

  // Damage Control Shrine Vow shields absorb initial hits
  if (enemy.damageControlHits > 0 && opts.source !== 'status') {
    enemy.damageControlHits -= 1;
    spawnFloatingNumber(state, enemy.pos, 'SHIELD', 'blocked', '#7CE8FF');
    state.events.push({
      type: 'damage',
      targetId: enemy.id,
      targetKind: 'enemy',
      pos: { x: enemy.pos.x, y: enemy.pos.y },
      amount: 0,
      crit: false,
      backstab: false,
      armorBroken: false,
      wallSlam: false,
    });
    return 0;
  }

  const player = state.player;
  const rt = getWeaponRuntime(state);
  const hitAngle =
    opts.angle !== undefined
      ? opts.angle
      : Math.atan2(enemy.pos.y - player.pos.y, enemy.pos.x - player.pos.x);

  const slotForBoon: BoonSlot | null =
    opts.source === 'attack' ||
    opts.source === 'special' ||
    opts.source === 'cast' ||
    opts.source === 'dash' ||
    opts.source === 'call'
      ? opts.source
      : null;

  const slotBoon = slotForBoon ? getBoonInSlot(player, slotForBoon) : undefined;
  let additiveBonus = 0;

  // 1. Slot Boon additive % damage
  if (slotBoon && slotForBoon !== 'cast') {
    additiveBonus += extractAdditivePercent(slotBoon);
  } else if (slotBoon && slotForBoon === 'cast' && slotBoon.scaledValue > 0 && slotBoon.scaledValue <= 3.0) {
    additiveBonus += slotBoon.scaledValue;
  }

  // Passive global / dash-strike / chaos boons
  for (let i = 0; i < player.boons.length; i++) {
    const b = player.boons[i];
    if (b.slot === 'chaos' && b.scaledValue > 0) {
      const pct = b.scaledValue <= 3.0 ? b.scaledValue : b.scaledValue / 100;
      if (
        (opts.source === 'attack' && b.id.includes('attack')) ||
        (opts.source === 'special' && b.id.includes('special')) ||
        (opts.source === 'cast' && b.id.includes('cast')) ||
        (opts.isDashStrike && b.id.includes('dash')) ||
        b.id.includes('strike')
      ) {
        additiveBonus += pct;
      }
    }
  }

  // 2. Keepsake bonuses
  if (
    player.keepsakeId === 'shattered_shackle' &&
    !slotBoon &&
    (opts.source === 'attack' || opts.source === 'special' || opts.source === 'cast')
  ) {
    additiveBonus += KEEPSAKES.shattered_shackle.valuesByRank[getKeepsakeRankIndex(state)];
  }

  const isUndamaged = enemy.hp >= enemy.maxHp && enemy.armor >= enemy.maxArmor;

  // 3. Backstab via facing dot product (+50% base, +50% Exposed, +200% Shadow Slash)
  const canBackstab =
    opts.canBackstab !== false &&
    opts.source !== 'status' &&
    opts.source !== 'wall_slam' &&
    opts.source !== 'hazard';

  let isBackstab = false;
  if (canBackstab) {
    const hitDirX = Math.cos(hitAngle);
    const hitDirY = Math.sin(hitAngle);
    const enemyFaceX = Math.cos(enemy.facingAngle);
    const enemyFaceY = Math.sin(enemy.facingAngle);
    const dot = hitDirX * enemyFaceX + hitDirY * enemyFaceY;
    if (dot > 0.35) {
      isBackstab = true;
      let backstabMult: number = COMBAT_CONSTANTS.backstabBonus; // +50%
      if (
        !isRoutineInspectionDisablingRow(state, MIRROR_UPGRADES.shadow_presence.row) &&
        state.meta.mirrorActiveSide.shadow_presence === 'a'
      ) {
        const rank = state.meta.mirrorRanks.shadow_presence ?? 0;
        backstabMult = Math.max(
          backstabMult,
          rank * MIRROR_UPGRADES.shadow_presence.sideA.valuePerRank,
        );
      }
      additiveBonus += backstabMult;

      const exposed = getStatus(enemy.statuses, 'exposed');
      if (exposed) {
        additiveBonus += exposed.magnitude || COMBAT_CONSTANTS.statusDefaults.exposed.backstabBonus;
      }
      if (opts.source === 'attack' && hasHammer(player, 'hammer_blade_shadow_slash')) {
        additiveBonus += 2.0; // +200%
      }
    }
  }

  // Obsidian Shawl keepsake (+10/15/20% vs undamaged or from behind)
  if (player.keepsakeId === 'obsidian_shawl' && (isUndamaged || isBackstab)) {
    additiveBonus += KEEPSAKES.obsidian_shawl.valuesByRank[getKeepsakeRankIndex(state)];
  }

  // Mirror Fiery Presence (Side B of shadow_presence)
  if (
    isUndamaged &&
    !isRoutineInspectionDisablingRow(state, MIRROR_UPGRADES.shadow_presence.row) &&
    state.meta.mirrorActiveSide.shadow_presence === 'b'
  ) {
    const rank = state.meta.mirrorRanks.shadow_presence ?? 0;
    additiveBonus += rank * MIRROR_UPGRADES.shadow_presence.sideB.valuePerRank;
  }

  // 4. Boiling Blood (+50% to Attack & Special when enemy has lodged Bloodstones)
  if (enemy.lodgedCasts > 0 && (opts.source === 'attack' || opts.source === 'special')) {
    const bbDisabled = isRoutineInspectionDisablingRow(state, MIRROR_UPGRADES.boiling_blood.row);
    if (!bbDisabled && state.meta.mirrorActiveSide.boiling_blood !== 'b') {
      const rank = state.meta.mirrorRanks.boiling_blood ?? 0;
      const rankBonus = rank * MIRROR_UPGRADES.boiling_blood.sideA.valuePerRank;
      additiveBonus += Math.max(COMBAT_CONSTANTS.boilingBloodBonus, rankBonus);
    }
  }

  // 5. Privileged Status (+40% when >= 2 unique statuses) or Family Favorite
  const uniqueStatuses = countUniqueStatuses(enemy.statuses);
  const psDisabled = isRoutineInspectionDisablingRow(state, MIRROR_UPGRADES.privileged_status.row);
  if (!psDisabled) {
    if (state.meta.mirrorActiveSide.privileged_status === 'b') {
      const rank = state.meta.mirrorRanks.privileged_status ?? 0;
      const uniquePatrons = new Set<PatronId>();
      for (let i = 0; i < player.boons.length; i++) {
        uniquePatrons.add(player.boons[i].patronId);
      }
      additiveBonus +=
        rank * MIRROR_UPGRADES.privileged_status.sideB.valuePerRank * uniquePatrons.size;
    } else if (uniqueStatuses >= 2) {
      const rank = state.meta.mirrorRanks.privileged_status ?? 0;
      const rankBonus = rank * MIRROR_UPGRADES.privileged_status.sideA.valuePerRank;
      additiveBonus += Math.max(COMBAT_CONSTANTS.privilegedStatusBonus, rankBonus);
    }
  } else if (uniqueStatuses >= 2) {
    additiveBonus += COMBAT_CONSTANTS.privilegedStatusBonus;
  }

  // 6. Mirror High Confidence (Side B of thick_skin)
  if (
    !isRoutineInspectionDisablingRow(state, MIRROR_UPGRADES.thick_skin.row) &&
    state.meta.mirrorActiveSide.thick_skin === 'b' &&
    player.hp >= player.maxHp * 0.8
  ) {
    const rank = state.meta.mirrorRanks.thick_skin ?? 0;
    additiveBonus += rank * MIRROR_UPGRADES.thick_skin.sideB.valuePerRank;
  }

  // 7. Maim incoming damage amplification (+50%)
  if (getStatus(enemy.statuses, 'maim')) {
    additiveBonus += COMBAT_CONSTANTS.statusDefaults.maim.incomingDamageBonus;
  }

  // 8. Ruthless Reflex, Aspects (Strife/Vanguard/Sovereign/Maelstrom/Magnet) & Distance Hammers
  if (
    player.perfectDashTimer > 0 &&
    state.meta.mirrorActiveSide.greater_reflex === 'b' &&
    (state.meta.mirrorRanks.greater_reflex ?? 0) > 0
  ) {
    additiveBonus += 0.5;
  }
  if (player.eruptBuffTimer > 0 && player.aspectId === 'rail_blast') {
    const rank = getAspectRank(state.meta.aspectRanks, 'rail_blast');
    additiveBonus += getAspectBonus('rail_blast', rank);
  }
  if (player.eruptBuffTimer > 0 && hasHammer(player, 'hammer_shield_ferocious_guard')) {
    additiveBonus += 0.2;
  }
  if (opts.source === 'cast' && player.aspectId === 'blade_maelstrom') {
    const rank = getAspectRank(state.meta.aspectRanks, 'blade_maelstrom');
    additiveBonus += getAspectBonus('blade_maelstrom', rank);
  }
  if (
    rt.punishingSweep.has(enemy.id) &&
    (opts.source === 'attack' || opts.source === 'special')
  ) {
    const rank = getAspectRank(state.meta.aspectRanks, 'spear_sovereign');
    additiveBonus += getAspectBonus('spear_sovereign', rank);
  }
  if (
    rt.magneticPullTargets.has(enemy.id) &&
    (opts.source === 'attack' || opts.source === 'cast')
  ) {
    const rank = getAspectRank(state.meta.aspectRanks, 'fists_magnet');
    additiveBonus += getAspectBonus('fists_magnet', rank);
  }
  if (player.empoweredAttacks > 0 && (opts.source === 'attack' || opts.source === 'cast')) {
    if (player.aspectId === 'spear_vanguard') {
      const rank = getAspectRank(state.meta.aspectRanks, 'spear_vanguard');
      additiveBonus += getAspectBonus('spear_vanguard', rank);
      player.empoweredAttacks -= 1;
    } else if (player.aspectId !== 'rail_sniper') {
      additiveBonus += 1.0;
      player.empoweredAttacks -= 1;
    }
  }
  if (opts.isDashStrike && enemy.armor > 0 && hasHammer(player, 'hammer_fists_breaching_cross')) {
    additiveBonus += 9.0; // +900% to Armor
  }
  if (opts.source === 'attack' && hasHammer(player, 'hammer_bow_point_blank_shot')) {
    if (ellipseDistance(enemy.pos.x - player.pos.x, enemy.pos.y - player.pos.y) <= 280) {
      additiveBonus += 1.5; // +150% to nearby foes
    }
  }
  if (opts.source === 'attack' && hasHammer(player, 'hammer_spear_extending_jab')) {
    if (ellipseDistance(enemy.pos.x - player.pos.x, enemy.pos.y - player.pos.y) >= 240) {
      additiveBonus += 0.4; // +40% to distant foes
    }
  }

  // 9. Multiplicative Critical Hit (3.0x)
  let critChance = opts.bonusCritChance ?? 0;
  if (slotBoon && slotBoon.patronId === 'sylvara') {
    critChance += slotForBoon === 'special' ? 0.2 : slotForBoon === 'cast' ? 0.1 : 0.15;
  }
  if (opts.source === 'attack' && player.aspectId === 'bow_scion') {
    const rank = getAspectRank(state.meta.aspectRanks, 'bow_scion');
    critChance += getAspectBonus('bow_scion', rank);
  }
  if (opts.source === 'attack' && player.aspectId === 'blade_vengeance' && player.eruptBuffTimer > 0) {
    const rank = getAspectRank(state.meta.aspectRanks, 'blade_vengeance');
    critChance += getAspectBonus('blade_vengeance', rank);
  }
  const marked = getStatus(enemy.statuses, 'marked');
  if (marked) {
    critChance += marked.magnitude || COMBAT_CONSTANTS.statusDefaults.marked.bonusCritChance;
  }

  const canCrit = opts.canCrit !== false && opts.source !== 'status' && opts.source !== 'wall_slam';
  const isCrit = canCrit && critChance > 0 && chance(state, Math.min(1, critChance));
  if (isCrit && marked) {
    removeStatus(enemy, 'marked');
  }

  const critMult = isCrit ? COMBAT_CONSTANTS.critMultiplier : 1.0;
  const finalDamage = Math.max(1, Math.round(opts.baseDamage * (1 + additiveBonus) * critMult));

  // 10. Armor (HealthBuffer) vs HP — Armor resists hitstun until shattered -> 1.0s stun
  let armorBroken = false;
  if (enemy.armor > 0) {
    const armorBefore = enemy.armor;
    enemy.armor = Math.max(0, enemy.armor - finalDamage);
    const overflow = Math.max(0, finalDamage - armorBefore);
    if (overflow > 0) {
      enemy.hp = Math.max(0, enemy.hp - overflow);
    }
    if (enemy.armor === 0) {
      armorBroken = true;
      enemy.stunTimer = Math.max(enemy.stunTimer, COMBAT_CONSTANTS.armorBreakStun);
      if (!enemy.isBoss) {
        enemy.aiState = 'stunned';
      }
      triggerHitstop(state, 0.05);
      addCameraShake(state, 9.5, 0.2);
      spawnFloatingNumber(state, { x: enemy.pos.x, y: enemy.pos.y - 16 }, 'ARMOR BREAK!', 'armor', '#FFD740');
    }
  } else {
    enemy.hp = Math.max(0, enemy.hp - finalDamage);
    // Unarmored non-boss foes experience crisp hitstun flinch
    if (!enemy.isBoss && enemy.hp > 0 && enemy.aiState !== 'phase_transition' && opts.source !== 'status') {
      const flinchDur = isCrit || finalDamage >= 40 ? 0.2 : 0.11;
      enemy.stunTimer = Math.max(enemy.stunTimer, flinchDur);
      if (enemy.aiState === 'windup' || enemy.aiState === 'chase' || enemy.aiState === 'idle') {
        enemy.aiState = 'stunned';
      }
    }
  }

  // 11. Knockback impulse (amplified by Tidebreaker boons, resisted by Armor & Bosses)
  if (opts.knockback && opts.knockback > 0 && enemy.archetype !== 'rattlebones_dummy') {
    let kb = opts.knockback;
    if (slotBoon && slotBoon.patronId === 'tidebreaker') {
      kb += 700;
    }
    const kbScale = enemy.isBoss ? 0.12 : enemy.armor > 0 ? 0.35 : 0.45;
    enemy.vel.x += Math.cos(hitAngle) * kb * kbScale;
    enemy.vel.y += Math.sin(hitAngle) * kb * kbScale * SIM_CONSTANTS.isoScaleY;
  }

  // 12. Apply status effects
  const statusToApply = opts.statusId ?? slotBoon?.statusEffect;
  if (statusToApply && enemy.hp > 0) {
    const statusMag =
      slotBoon && slotBoon.statusEffect === statusToApply && slotBoon.scaledValue >= 4
        ? slotBoon.scaledValue
        : undefined;
    applyStatus(state, enemy, 'enemy', statusToApply, opts.statusStacks ?? 1, 'player', statusMag);
  }

  // 13. Aspect & Hammer on-hit trackers
  if (opts.source === 'attack') {
    if (hasHammer(player, 'hammer_blade_cursed_slash')) {
      healPlayer(state, 2);
    }
    if (player.aspectId === 'bow_tracker' && enemy.hp > 0) {
      rt.bowTrackerTargetId = enemy.id;
      rt.bowTrackerTimer = 4.0;
    }
    if (player.aspectId === 'fists_cutter') {
      rt.fistsCutterHits = Math.min(12, rt.fistsCutterHits + 1);
      player.consecutiveHits = rt.fistsCutterHits;
    }
  }
  if (opts.source === 'special' && player.aspectId === 'bow_celestial' && enemy.hp > 0) {
    rt.sharedSuffering.set(enemy.id, 7.0);
  }

  // 14. God Gauge fill on damage dealt (0.01 * dmgDealt)
  if (opts.source !== 'call') {
    player.godGauge = Math.min(
      PLAYER_CONSTANTS.godGaugeMax,
      player.godGauge + finalDamage * PLAYER_CONSTANTS.godGaugeDamageDealtMult,
    );
  }

  // 15. Telemetry, hitflash, floating numbers, hitstop, shake & events
  state.run.damageDealt += finalDamage;
  enemy.hitFlashTimer = 0.1;
  if (player.aspectId !== 'fists_cutter') {
    player.consecutiveHits += 1;
  }

  const numKind: FloatingNumber['kind'] = isCrit
    ? 'crit'
    : isBackstab
      ? 'backstab'
      : opts.source === 'status'
        ? 'status'
        : armorBroken || enemy.armor > 0
          ? 'armor'
          : 'normal';

  const numColor =
    numKind === 'crit'
      ? '#FFE03B'
      : numKind === 'backstab'
        ? '#D96BFF'
        : numKind === 'armor'
          ? '#FFC947'
          : opts.patronId
            ? PATRON_CONSTANTS[opts.patronId].colorHex
            : slotBoon
              ? PATRON_CONSTANTS[slotBoon.patronId].colorHex
              : '#FFFFFF';

  spawnFloatingNumber(state, enemy.pos, finalDamage, numKind, numColor);

  state.events.push({
    type: 'damage',
    targetId: enemy.id,
    targetKind: 'enemy',
    pos: { x: enemy.pos.x, y: enemy.pos.y },
    amount: finalDamage,
    crit: isCrit,
    backstab: isBackstab,
    armorBroken,
    wallSlam: opts.source === 'wall_slam',
    statusId: opts.statusId,
  });

  if (opts.source !== 'status') {
    if (isCrit) {
      triggerHitstop(state, 0.05);
      addCameraShake(state, 8.0, 0.16);
      state.events.push({ type: 'rumble', weak: 0.45, strong: 0.7, durationMs: 90 });
    } else if (finalDamage >= 45 || opts.source === 'special') {
      triggerHitstop(state, 0.035);
      addCameraShake(state, 5.5, 0.12);
      state.events.push({ type: 'rumble', weak: 0.3, strong: 0.4, durationMs: 65 });
    } else if (opts.source === 'attack' || opts.source === 'cast') {
      triggerHitstop(state, 0.022);
    }
  }

  // 15b. Aspect of the Celestial (bow_celestial): propagate Shared Suffering (up to 60% damage bond)
  if (
    !propagatingSharedSuffering &&
    player.aspectId === 'bow_celestial' &&
    opts.source === 'attack' &&
    rt.sharedSuffering.size > 0
  ) {
    propagatingSharedSuffering = true;
    try {
      const rank = getAspectRank(state.meta.aspectRanks, 'bow_celestial');
      const shareRatio = Math.min(0.6, Math.max(0.3, getAspectBonus('bow_celestial', rank)));
      const sharedDmg = Math.max(1, Math.round(finalDamage * shareRatio));
      for (let i = 0; i < state.enemies.length; i++) {
        const linked = state.enemies[i];
        if (linked.id === enemy.id || linked.hp <= 0 || linked.aiState === 'dead') continue;
        if (!rt.sharedSuffering.has(linked.id)) continue;
        dealDamageToEnemy(
          state,
          linked,
          {
            baseDamage: sharedDmg,
            source: 'status',
            canCrit: false,
            canBackstab: false,
          },
          hooks,
          ctx,
        );
      }
    } finally {
      propagatingSharedSuffering = false;
    }
  }

  // 16. Death & Final-Kill Slow-Mo (0.00001x for 0.6s, 0.1s lerp out)
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.aiState = 'dead';
    state.run.kills += 1;
    dropLodgedBloodstones(state, enemy);
    rt.punishingSweep.delete(enemy.id);
    rt.sharedSuffering.delete(enemy.id);
    rt.magneticPullTargets.delete(enemy.id);
    if (rt.bowTrackerTargetId === enemy.id) {
      rt.bowTrackerTargetId = null;
      rt.bowTrackerTimer = 0;
    }

    const hasMoreBossPhases = enemy.isBoss && enemy.phase < enemy.maxPhases;
    const finalInRoom =
      !hasMoreBossPhases &&
      enemy.archetype !== 'rattlebones_dummy' &&
      state.room.waveIndex + 1 >= state.room.totalWaves &&
      state.enemies.every((e) => e.hp <= 0 || e.aiState === 'dead');

    if (finalInRoom) {
      state.hitstopTimer = 0;
      state.run.finalKillSlowTimer =
        COMBAT_CONSTANTS.finalKillSlowDuration + COMBAT_CONSTANTS.finalKillSlowLerpOut;
      state.timeScale = COMBAT_CONSTANTS.finalKillSlowScale;
      addCameraShake(state, 12.5, 0.28);
      state.events.push({ type: 'rumble', weak: 0.65, strong: 1.0, durationMs: 220 });
    } else {
      triggerHitstop(state, 0.055);
      addCameraShake(state, 6.5, 0.15);
    }

    state.events.push({
      type: 'enemy_death',
      enemyId: enemy.id,
      archetype: enemy.archetype,
      pos: { x: enemy.pos.x, y: enemy.pos.y },
      isBoss: enemy.isBoss,
      finalInRoom,
    });

    if (hooks?.onEnemyKilled && ctx) {
      hooks.onEnemyKilled(state, enemy, ctx);
    }
  }

  return finalDamage;
}

export function dealDamageToPlayer(
  state: SimState,
  amount: number,
  opts?: DealDamageToPlayerOptions,
): number {
  const player = state.player;
  if (player.isDead || amount <= 0) return 0;

  const source = opts?.source ?? 'enemy';

  // 1. Invulnerability checks (Dash i-frames, Perfect Dash, Post-Hit i-frames, Aegira Call)
  if (source !== 'chaos') {
    if (player.dashTimer > 0 && !opts?.ignoreIframes) {
      return 0;
    }
    if (player.perfectDashTimer > 0 && source === 'enemy' && !opts?.ignoreIframes) {
      return 0;
    }
    if (player.iframeTimer > 0 && !opts?.ignoreIframes) {
      return 0;
    }
    if (player.godCallActiveTimer > 0 && player.godCallPatron === 'aegira') {
      spawnFloatingNumber(state, player.pos, 'IMPERVIOUS', 'blocked', PATRON_CONSTANTS.aegira.colorHex);
      return 0;
    }
  }

  // 2. Shield of Chaos frontal block (negates frontal enemy melee hits & projectiles)
  if (player.isBlocking && source === 'enemy') {
    let blocked = true;
    if (opts?.fromPos) {
      const incomingAngle = Math.atan2(opts.fromPos.y - player.pos.y, opts.fromPos.x - player.pos.x);
      blocked = Math.abs(shortestAngleDelta(player.facingAngle, incomingAngle)) <= (80 * Math.PI) / 180;
    }
    if (blocked) {
      spawnFloatingNumber(state, player.pos, 'BLOCKED', 'blocked', '#7CE8FF');
      if (hasHammer(player, 'hammer_shield_ferocious_guard')) {
        player.eruptBuffTimer = Math.max(player.eruptBuffTimer, 10.0);
        spawnFloatingNumber(state, { x: player.pos.x, y: player.pos.y - 20 }, 'FEROCIOUS!', 'crit', '#FFD54F');
      }
      return 0;
    }
  }

  // 3. Evergreen Acorn boss shields
  if (player.acornShields > 0 && source !== 'chaos') {
    player.acornShields -= 1;
    spawnFloatingNumber(state, player.pos, 'ACORN', 'blocked', '#A7F3A0');
    return 0;
  }

  // 4. Passive Dodge chance (Aspect of the Scion Fists, Pierced Plume, Ruthless Reflex)
  if (opts?.canDodge !== false && source === 'enemy') {
    let dodgeChance = player.plumeBonus;
    if (player.aspectId === 'fists_scion') {
      const rank = getAspectRank(state.meta.aspectRanks, 'fists_scion');
      dodgeChance += getAspectBonus('fists_scion', rank);
    }
    if (
      player.perfectDashTimer > 0 &&
      state.meta.mirrorActiveSide.greater_reflex === 'b' &&
      (state.meta.mirrorRanks.greater_reflex ?? 0) > 0
    ) {
      dodgeChance += 0.5;
    }
    if (dodgeChance > 0 && chance(state, Math.min(0.75, dodgeChance))) {
      spawnFloatingNumber(state, player.pos, 'DODGE!', 'dodge', '#90E8FF');
      return 0;
    }
  }

  // 5. Damage scaling (Hard Labor, Heightened Security, Chaos Curses, Sturdy, God Mode)
  let scaled = amount;

  if (source === 'enemy') {
    const hardLaborRank = state.run.vows.hard_labor ?? 0;
    if (hardLaborRank > 0) {
      scaled *= 1 + hardLaborRank * 0.2;
    }
  }

  if (source === 'hazard' || source === 'lava') {
    const hsRank = state.run.vows.heightened_security ?? 0;
    if (hsRank > 0) {
      scaled *= 1 + hsRank * 4.0; // +400%
    }
  }

  for (let i = 0; i < player.chaosCurses.length; i++) {
    const c = player.chaosCurses[i];
    if (c.curseKind === 'extra_damage_taken') {
      scaled *= 1 + (c.curseMagnitude <= 3 ? c.curseMagnitude : c.curseMagnitude / 100);
    }
  }

  if (
    hasHammer(player, 'hammer_fists_colossus_knuckle') &&
    (player.attackTimer > 0 || player.specialTimer > 0)
  ) {
    scaled *= 0.7; // Sturdy (-30%)
  }

  // Consecrated Aura (Hallowed Ground) damage reduction (Aspect of the Paladin)
  for (let i = 0; i < state.room.hazards.length; i++) {
    const h = state.room.hazards[i];
    if (h.kind === 'consecrated_aura' && h.active) {
      if (ellipseDistance(player.pos.x - h.pos.x, player.pos.y - h.pos.y) <= h.radius) {
        const rank = getAspectRank(state.meta.aspectRanks, 'blade_paladin');
        const dr = Math.min(0.5, 0.2 + getAspectBonus('blade_paladin', rank) * 0.5);
        scaled *= 1 - dr;
        break;
      }
    }
  }

  // God Mode: max(0.2, 0.8 - 0.02 * min(30, deaths))
  if (state.run.godModeEnabled || state.meta.godModeEnabled) {
    const deaths = Math.min(PLAYER_CONSTANTS.godModeMaxDeaths, Math.max(0, state.meta.godModeDeaths));
    const godMult = Math.max(
      0.2,
      PLAYER_CONSTANTS.godModeBaseMultiplier - PLAYER_CONSTANTS.godModePerDeathStep * deaths,
    );
    scaled *= godMult;
  }

  const finalDamage = Math.max(1, Math.round(scaled));

  // 6. Subtract Armor then HP
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, finalDamage);
    player.armor -= absorbed;
    const rem = finalDamage - absorbed;
    player.hp -= rem;
  } else {
    player.hp -= finalDamage;
  }

  state.run.damageTaken += finalDamage;
  state.room.noDamageTaken = false;

  // 7. God Gauge fill on damage taken: 60 * dmgTaken / maxHp
  const gaugeGain =
    PLAYER_CONSTANTS.godGaugeDamageTakenMult * (finalDamage / Math.max(1, player.maxHp));
  player.godGauge = Math.min(PLAYER_CONSTANTS.godGaugeMax, player.godGauge + gaugeGain);

  // 8. Post-hit i-frames (1.3s if single hit >= 10 or cumulative >= 10 within 0.6s; disabled by personal_liability)
  const personalLiability = (state.run.vows.personal_liability ?? 0) > 0;
  if (!personalLiability && source !== 'lava' && source !== 'poison' && source !== 'chaos') {
    if (player.cumulativeDamageWindowTimer <= 0) {
      player.cumulativeDamageInWindow = 0;
    }
    player.cumulativeDamageWindowTimer = PLAYER_CONSTANTS.postHitIframeCumulativeWindow;
    player.cumulativeDamageInWindow += finalDamage;

    if (
      finalDamage >= PLAYER_CONSTANTS.postHitIframeMinDamage ||
      player.cumulativeDamageInWindow >= PLAYER_CONSTANTS.postHitIframeMinDamage
    ) {
      player.iframeTimer = Math.max(player.iframeTimer, PLAYER_CONSTANTS.postHitIframeDuration);
      player.cumulativeDamageInWindow = 0;
    }
  }

  spawnFloatingNumber(state, player.pos, `-${finalDamage}`, 'normal', '#FF4D5A');
  state.events.push({
    type: 'damage',
    targetId: 'player',
    targetKind: 'player',
    pos: { x: player.pos.x, y: player.pos.y },
    amount: finalDamage,
    crit: false,
    backstab: false,
    armorBroken: false,
    wallSlam: false,
  });

  if (source !== 'poison') {
    addCameraShake(state, 9.0, 0.2);
    triggerHitstop(state, 0.04);
    state.events.push({ type: 'rumble', weak: 0.5, strong: 0.85, durationMs: 140 });
  }

  // 9. Death Defiance (50% HP restore + invuln + knockback pulse) or Lucky Fang
  if (player.hp <= 0) {
    if (player.deathDefiances > 0) {
      player.deathDefiances -= 1;
      const isStubborn = state.meta.mirrorActiveSide.death_defiance === 'b';
      const restoreRatio = isStubborn ? 0.3 : 0.5;
      player.hp = Math.max(1, Math.round(player.maxHp * restoreRatio));
      player.iframeTimer = 2.0;

      for (let i = 0; i < state.enemies.length; i++) {
        const e = state.enemies[i];
        if (e.hp <= 0 || e.aiState === 'dead' || e.isBoss) continue;
        const dx = e.pos.x - player.pos.x;
        const dy = e.pos.y - player.pos.y;
        const d = Math.hypot(dx, dy);
        if (d > 1e-3 && d < 320) {
          e.vel.x += (dx / d) * 900;
          e.vel.y += (dy / d) * 900 * SIM_CONSTANTS.isoScaleY;
        }
      }

      spawnFloatingNumber(state, player.pos, 'DEATH DEFIED!', 'heal', '#FFD54F');
      addCameraShake(state, 13.0, 0.32);
      triggerHitstop(state, 0.06);
      state.events.push({
        type: 'death_defiance',
        pos: { x: player.pos.x, y: player.pos.y },
        remaining: player.deathDefiances,
      });
    } else if (player.keepsakeId === 'lucky_fang' && !player.keepsakeUsed) {
      player.keepsakeUsed = true;
      const restore = KEEPSAKES.lucky_fang.valuesByRank[getKeepsakeRankIndex(state)];
      player.hp = Math.min(player.maxHp, Math.max(1, restore));
      player.iframeTimer = 2.0;
      spawnFloatingNumber(state, player.pos, 'LUCKY FANG!', 'heal', '#FFD54F');
      addCameraShake(state, 11.0, 0.25);
      state.events.push({
        type: 'death_defiance',
        pos: { x: player.pos.x, y: player.pos.y },
        remaining: 0,
      });
    } else {
      player.hp = 0;
      player.isDead = true;
      state.run.defeat = true;
      state.run.active = false;
      state.events.push({
        type: 'run_ended',
        victory: false,
        chambersCleared: state.run.chambersCleared,
        elapsedSeconds: state.run.elapsedSeconds,
      });
    }
  }

  return finalDamage;
}

/**
 * Deflect enemy projectiles inside an elliptical cone or full circle (Aegira boons).
 * Normal projectiles return at 3.0x speed; lobs return at 1.5x speed!
 */
export function deflectProjectiles(
  state: SimState,
  origin: Vec2,
  range: number,
  angle: number,
  arcDeg: number,
  scaleY: number = SIM_CONSTANTS.isoScaleY,
): number {
  let deflectedCount = 0;

  for (let i = 0; i < state.projectiles.length; i++) {
    const p = state.projectiles[i];
    if (p.owner !== 'enemy' || !p.deflectable || p.deflected) continue;

    const dx = p.pos.x - origin.x;
    const dy = p.pos.y - origin.y;
    const hit =
      arcDeg >= 360
        ? ellipseDistance(dx, dy, scaleY) <= range + p.radius
        : isInEllipticalCone(dx, dy, angle, range + p.radius, arcDeg + 16, scaleY);

    if (!hit) continue;

    p.owner = 'player';
    p.ownerId = 'player';
    p.deflected = true;
    p.hitIds = [];
    p.distanceTraveled = 0;
    p.life = 0;
    p.damage = Math.max(40, Math.round(p.damage * 2.2));
    p.patronId = 'aegira';
    p.statusToApply = 'exposed';
    p.colorHex = PATRON_CONSTANTS.aegira.colorHex;

    const speedMult = p.isLob
      ? COMBAT_CONSTANTS.deflectLobSpeedMultiplier
      : COMBAT_CONSTANTS.deflectSpeedMultiplier;
    const origSpeed = Math.max(360, Math.hypot(p.vel.x, p.vel.y));
    const newSpeed = origSpeed * speedMult;

    let targetAngle = normalizeAngle(Math.atan2(-p.vel.y, -p.vel.x));
    let bestDist = Infinity;
    for (let j = 0; j < state.enemies.length; j++) {
      const e = state.enemies[j];
      if (e.hp <= 0 || e.aiState === 'dead') continue;
      const ed = Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y);
      if (ed < bestDist) {
        bestDist = ed;
        targetAngle = Math.atan2(e.pos.y - p.pos.y, e.pos.x - p.pos.x);
      }
    }

    p.angle = targetAngle;
    p.vel.x = Math.cos(targetAngle) * newSpeed;
    p.vel.y = Math.sin(targetAngle) * newSpeed;
    p.isLob = false;
    p.range = Math.max(p.range, 1100);
    p.maxLife = Math.max(p.maxLife, 1.8);

    deflectedCount++;
    spawnFloatingNumber(state, p.pos, 'DEFLECT!', 'deflect', PATRON_CONSTANTS.aegira.colorHex);
    state.events.push({
      type: 'deflect',
      pos: { x: p.pos.x, y: p.pos.y },
      projectileId: p.id,
    });
  }

  if (deflectedCount > 0) {
    triggerHitstop(state, 0.032);
    addCameraShake(state, 5.0, 0.12);
  }

  return deflectedCount;
}

export function spawnProjectile(
  state: SimState,
  proj: Omit<ProjectileState, 'id' | 'distanceTraveled' | 'life' | 'hitIds'>,
): ProjectileState {
  const full: ProjectileState = {
    ...proj,
    id: `proj_${state.tick}_${nextInt(state, 0, 999999)}`,
    distanceTraveled: 0,
    life: 0,
    hitIds: [],
  };
  state.projectiles.push(full);
  return full;
}

function dropCastAtPos(state: SimState, pos: Vec2, count: number, vel?: Vec2): void {
  if (state.meta.mirrorActiveSide.infernal_soul === 'b') return;
  for (let c = 0; c < count; c++) {
    const a = nextFloat(state) * Math.PI * 2;
    state.room.bloodstones.push({
      id: `bs_${state.tick}_${nextInt(state, 0, 999999)}`,
      pos: { x: pos.x, y: pos.y },
      vel: vel
        ? { x: vel.x + Math.cos(a) * 60, y: vel.y + Math.sin(a) * 60 * SIM_CONSTANTS.isoScaleY }
        : { x: Math.cos(a) * 120, y: Math.sin(a) * 120 * SIM_CONSTANTS.isoScaleY },
      life: 0,
      magnetizing: false,
    });
  }
}

function dropCastFromProjectile(state: SimState, proj: ProjectileState): void {
  if (!proj.lodgesCast) return;
  const count = proj.kind === 'arrow' && proj.lobHeight > 0 ? Math.round(proj.lobHeight) : 1;
  dropCastAtPos(state, proj.pos, count, { x: -proj.vel.x * 0.12, y: -proj.vel.y * 0.12 });
}

export function tickProjectiles(
  state: SimState,
  dt: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  if (dt <= 0) return;

  const player = state.player;
  const rt = getWeaponRuntime(state);

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.life += dt;

    // 1. Lobbed projectile (e.g., Adamant Rail Bombard Shell scaleY=0.6, mortar bombs)
    if (p.isLob && p.targetPos && p.lobDuration > 0) {
      p.lobElapsed += dt;
      const t = Math.min(1, p.lobElapsed / p.lobDuration);
      p.pos.x = p.startPos.x + (p.targetPos.x - p.startPos.x) * t;
      p.pos.y = p.startPos.y + (p.targetPos.y - p.startPos.y) * t;

      if (t >= 1) {
        const radius = p.aoeRadius ?? 220;
        const aoeScaleY = p.kind === 'bomb' ? 0.6 : SIM_CONSTANTS.isoScaleY;
        if (p.owner === 'player') {
          for (let j = 0; j < state.enemies.length; j++) {
            const e = state.enemies[j];
            if (e.hp <= 0 || e.aiState === 'dead') continue;
            if (ellipseDistance(e.pos.x - p.pos.x, e.pos.y - p.pos.y, aoeScaleY) <= radius + e.radius) {
              dealDamageToEnemy(
                state,
                e,
                {
                  baseDamage: p.damage,
                  source: p.kind === 'cast' ? 'cast' : 'special',
                  knockback: 1100,
                  bonusCritChance: p.critBonus,
                  patronId: p.patronId,
                  statusId: p.statusToApply,
                },
                hooks,
                ctx,
              );
            }
          }
          // Aspect of Strife (rail_blast): absorbing own special grants +75% dmg for 4s
          if (
            player.aspectId === 'rail_blast' &&
            ellipseDistance(player.pos.x - p.pos.x, player.pos.y - p.pos.y, aoeScaleY) <= radius
          ) {
            player.eruptBuffTimer = 4.0;
            spawnFloatingNumber(state, player.pos, 'STRIFE +75%!', 'crit', '#FF7B29');
          }
          // Hazard Bomb self-damage
          if (
            hasHammer(player, 'hammer_rail_hazard_bomb') &&
            ellipseDistance(player.pos.x - p.pos.x, player.pos.y - p.pos.y, aoeScaleY) <= radius
          ) {
            dealDamageToPlayer(state, 15, { source: 'hazard' });
          }
          addCameraShake(state, 9.0, 0.2);
        } else {
          if (ellipseDistance(player.pos.x - p.pos.x, player.pos.y - p.pos.y, aoeScaleY) <= radius) {
            dealDamageToPlayer(state, p.damage, { source: 'enemy', fromPos: p.pos });
          }
        }
        state.projectiles.splice(i, 1);
      }
      continue;
    }

    // 2. Blitz Disc (shield_thunder): lingering spinning disc pulsing damage every 0.2s
    const isBlitzDisc =
      p.owner === 'player' &&
      p.kind === 'shield' &&
      p.pierceLeft >= BLITZ_DISC_PIERCE_SENTINEL;

    if (isBlitzDisc && !p.returning) {
      rt.blitzDiscPulseTimer -= dt;
      if (rt.blitzDiscPulseTimer <= 0) {
        rt.blitzDiscPulseTimer = 0.2;
        const pulseRadius = 115;
        for (let j = 0; j < state.enemies.length; j++) {
          const e = state.enemies[j];
          if (e.hp <= 0 || e.aiState === 'dead') continue;
          if (ellipseDistance(e.pos.x - p.pos.x, e.pos.y - p.pos.y) <= pulseRadius + e.radius) {
            dealDamageToEnemy(
              state,
              e,
              {
                baseDamage: p.damage,
                source: 'special',
                knockback: 220,
                patronId: p.patronId,
                statusId: p.statusToApply,
              },
              hooks,
              ctx,
            );
          }
        }
      }
    }

    // 3. Returning weapon projectiles (Spear recall / Shield Rebound or Blitz Disc return)
    if (p.returning && p.owner === 'player') {
      const dx = player.pos.x - p.pos.x;
      const dy = player.pos.y - p.pos.y;
      const d = Math.hypot(dx, dy);
      if (d <= 52) {
        if (p.kind === 'spear') player.spearOut = false;
        if (p.kind === 'shield') {
          const otherShields = state.projectiles.filter(
            (other) => other !== p && other.owner === 'player' && other.kind === 'shield',
          ).length;
          if (otherShields === 0) {
            player.shieldOut = false;
          }
          if (hasHammer(player, 'hammer_shield_explosive_return')) {
            for (let j = 0; j < state.enemies.length; j++) {
              const e = state.enemies[j];
              if (e.hp <= 0 || e.aiState === 'dead') continue;
              if (ellipseDistance(e.pos.x - player.pos.x, e.pos.y - player.pos.y) <= 220 + e.radius) {
                dealDamageToEnemy(state, e, { baseDamage: 50, source: 'special', knockback: 900 }, hooks, ctx);
              }
            }
          }
        }
        state.projectiles.splice(i, 1);
        continue;
      }
      const speed = Math.max(1450, Math.hypot(p.vel.x, p.vel.y));
      p.vel.x = (dx / d) * speed;
      p.vel.y = (dy / d) * speed;
      p.angle = Math.atan2(dy, dx);
    }

    // 4. Homing steering (including bow_tracker locked target!)
    if (p.homingStrength > 0 && !p.returning) {
      let tx = 0;
      let ty = 0;
      let found = false;
      if (p.owner === 'player') {
        // Aspect of the Tracker: Special arrows lock directly onto last Attack-struck target
        if (p.kind === 'arrow' && player.aspectId === 'bow_tracker' && rt.bowTrackerTargetId) {
          const tracked = state.enemies.find(
            (e) => e.id === rt.bowTrackerTargetId && e.hp > 0 && e.aiState !== 'dead',
          );
          if (tracked) {
            tx = tracked.pos.x;
            ty = tracked.pos.y;
            found = true;
          }
        }
        if (!found) {
          let bestDist = 560;
          for (let j = 0; j < state.enemies.length; j++) {
            const e = state.enemies[j];
            if (e.hp <= 0 || e.aiState === 'dead' || p.hitIds.includes(e.id)) continue;
            const d = Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y);
            if (d < bestDist) {
              bestDist = d;
              tx = e.pos.x;
              ty = e.pos.y;
              found = true;
            }
          }
        }
      } else {
        tx = player.pos.x;
        ty = player.pos.y;
        found = true;
      }

      if (found) {
        const desiredAngle = Math.atan2(ty - p.pos.y, tx - p.pos.x);
        const speed = Math.hypot(p.vel.x, p.vel.y);
        const diff = shortestAngleDelta(p.angle, desiredAngle);
        const turn = Math.max(-p.homingStrength * dt, Math.min(p.homingStrength * dt, diff));
        p.angle = normalizeAngle(p.angle + turn);
        p.vel.x = Math.cos(p.angle) * speed;
        p.vel.y = Math.sin(p.angle) * speed;
      }
    }

    // 5. Advance position (Consecrated Aura slows enemy projectiles by 55%)
    let projTimeMult = 1.0;
    if (p.owner === 'enemy') {
      for (let hIdx = 0; hIdx < state.room.hazards.length; hIdx++) {
        const h = state.room.hazards[hIdx];
        if (h.kind === 'consecrated_aura' && h.active) {
          if (ellipseDistance(p.pos.x - h.pos.x, p.pos.y - h.pos.y) <= h.radius) {
            projTimeMult = 0.45;
            break;
          }
        }
      }
    }

    const curSpeed = Math.hypot(p.vel.x, p.vel.y);
    const isLodgedSpear = p.owner === 'player' && p.kind === 'spear' && !p.returning && curSpeed < 1;

    if (!isLodgedSpear) {
      const stepX = p.vel.x * dt * projTimeMult;
      const stepY = p.vel.y * dt * projTimeMult;
      p.pos.x += stepX;
      p.pos.y += stepY;
      p.distanceTraveled += Math.hypot(stepX, stepY);
    }

    // 6. Obstacle / boundary hit check (skip for returning spear/shield or lodged spear)
    if (!p.returning && !isLodgedSpear) {
      const obsHit = checkProjectileObstacleHit(state, p.pos, p.radius);
      if (obsHit.hit) {
        if (isBlitzDisc) {
          // Blitz Disc stops and hovers spinning at barrier
          p.vel.x = 0;
          p.vel.y = 0;
          continue;
        }
        if (p.kind === 'shield' && p.owner === 'player') {
          p.returning = true;
          p.hitIds = [];
          continue;
        }
        if (p.kind === 'spear' && p.owner === 'player' && !p.aoeRadius) {
          // Eternal Spear lodges into wall/ground awaiting Special re-press Recall / Vanguard Rush!
          p.vel.x = 0;
          p.vel.y = 0;
          p.maxLife = Math.max(p.maxLife, p.life + 8.0);
          continue;
        }
        if (p.bouncesLeft > 0) {
          p.bouncesLeft -= 1;
          const dot = p.vel.x * obsHit.normal.x + p.vel.y * obsHit.normal.y;
          p.vel.x -= 2 * dot * obsHit.normal.x;
          p.vel.y -= 2 * dot * obsHit.normal.y;
          p.angle = Math.atan2(p.vel.y, p.vel.x);
        } else {
          dropCastFromProjectile(state, p);
          state.projectiles.splice(i, 1);
          continue;
        }
      }
    }

    // 7. Range / lifetime expiration
    if (!p.returning && p.distanceTraveled >= p.range) {
      if (isBlitzDisc) {
        // Blitz Disc hovers at max range until recalled or maxLife
        p.vel.x = 0;
        p.vel.y = 0;
      } else if (p.owner === 'player' && p.kind === 'spear' && !p.aoeRadius) {
        // Lodged Eternal Spear waits on ground for Re-Press Recall or Vanguard Rush!
        p.vel.x = 0;
        p.vel.y = 0;
        if (p.maxLife < p.life + 6.0) {
          p.maxLife = p.life + 8.0;
        }
      } else if (p.owner === 'player' && p.kind === 'shield') {
        p.returning = true;
        p.hitIds = [];
        p.maxLife += 2.0;
        continue;
      } else {
        dropCastFromProjectile(state, p);
        state.projectiles.splice(i, 1);
        continue;
      }
    }

    if (p.life >= p.maxLife) {
      if (p.owner === 'player' && (p.kind === 'shield' || p.kind === 'spear') && !p.returning && !p.aoeRadius) {
        p.returning = true;
        p.hitIds = [];
        p.maxLife = p.life + 2.5;
        continue;
      }
      if (p.kind === 'spear') player.spearOut = false;
      if (p.kind === 'shield') player.shieldOut = false;
      dropCastFromProjectile(state, p);
      state.projectiles.splice(i, 1);
      continue;
    }

    // 8. Check if player projectile detonates a Hellfire Mine (rail_beam)
    if (p.owner === 'player' && player.aspectId === 'rail_beam') {
      for (let hIdx = state.room.hazards.length - 1; hIdx >= 0; hIdx--) {
        const h = state.room.hazards[hIdx];
        if (h.kind === 'pylon' && h.owner === 'player' && h.active && h.id.startsWith('mine_')) {
          if (ellipseDistance(h.pos.x - p.pos.x, h.pos.y - p.pos.y) <= h.radius + p.radius) {
            detonateHellfireMine(state, hIdx, ctx, hooks);
          }
        }
      }
    }

    // 9. Entity collisions (skip lodged stationary spear & Blitz Disc which pulses on timer)
    if (isLodgedSpear || (isBlitzDisc && !p.returning)) {
      continue;
    }

    let consumed = false;
    if (p.owner === 'player') {
      for (let j = 0; j < state.enemies.length; j++) {
        const e = state.enemies[j];
        if (e.hp <= 0 || e.aiState === 'dead' || p.hitIds.includes(e.id)) continue;
        const dist = ellipseDistance(e.pos.x - p.pos.x, e.pos.y - p.pos.y);
        if (dist > p.radius + e.radius) continue;

        p.hitIds.push(e.id);
        const dmgSource: DamageSource = p.deflected
          ? 'deflect'
          : p.kind === 'cast' || p.ownerId === 'player_cast'
            ? 'cast'
            : p.ownerId === 'player_special' || p.kind === 'spear' || p.kind === 'shield' || p.kind === 'bomb'
              ? 'special'
              : 'attack';

        const isFrostSpinWave = p.kind === 'wave' && p.lobHeight === FROST_SPIN_WAVE_SENTINEL;

        const dealt = dealDamageToEnemy(
          state,
          e,
          {
            baseDamage: p.damage,
            source: dmgSource,
            angle: p.angle,
            knockback: p.kind === 'cast' ? 500 : p.kind === 'wave' ? 950 : 350,
            bonusCritChance: p.critBonus,
            patronId: p.patronId,
            statusId: isFrostSpinWave ? 'chill' : p.statusToApply,
          },
          hooks,
          ctx,
        );

        // Aspect of the Frost Dragon (spear_dragon): Frost Spin Wave heals on hit!
        if (isFrostSpinWave && dealt > 0) {
          healPlayer(state, 1);
        }

        // Aspect of the Vessel (bow_loaded): Detonate all loaded Bloodstones on arrow hit!
        if (p.kind === 'arrow' && p.lodgesCast && p.lobHeight > 0) {
          const loadedCount = Math.round(p.lobHeight);
          p.lodgesCast = false;
          p.lobHeight = 0;
          const castBoon = getBoonInSlot(player, 'cast');
          const rank = getAspectRank(state.meta.aspectRanks, 'bow_loaded');
          const vesselMult = 1 + getAspectBonus('bow_loaded', rank);
          const baseCast =
            castBoon && castBoon.scaledValue >= 10
              ? castBoon.scaledValue
              : PLAYER_CONSTANTS.castDamage;
          const totalCastDmg = Math.round(baseCast * loadedCount * vesselMult);
          const detRadius = 185;

          for (let k = 0; k < state.enemies.length; k++) {
            const target = state.enemies[k];
            if (target.hp <= 0 || target.aiState === 'dead') continue;
            if (ellipseDistance(target.pos.x - p.pos.x, target.pos.y - p.pos.y) <= detRadius + target.radius) {
              dealDamageToEnemy(
                state,
                target,
                {
                  baseDamage: totalCastDmg,
                  source: 'cast',
                  knockback: 650,
                  patronId: castBoon?.patronId,
                  statusId: castBoon?.statusEffect,
                },
                hooks,
                ctx,
              );
            }
          }
          addCameraShake(state, 8.0, 0.16);
          if (state.meta.mirrorActiveSide.infernal_soul !== 'b') {
            if (e.hp > 0) {
              for (let lc = 0; lc < loadedCount; lc++) {
                e.lodgedCasts += 1;
                e.lodgedCastTimers.push(PLAYER_CONSTANTS.castLodgeDuration);
              }
            } else {
              dropCastAtPos(state, p.pos, loadedCount);
            }
          }
        } else if (p.lodgesCast && state.meta.mirrorActiveSide.infernal_soul !== 'b') {
          // Standard Bloodstone Cast lodging (16s)
          if (e.hp > 0) {
            e.lodgedCasts += 1;
            e.lodgedCastTimers.push(PLAYER_CONSTANTS.castLodgeDuration);
          } else {
            dropCastFromProjectile(state, p);
          }
        }

        // Splash AoE (Flood Shot / Phalanx Shot / Explosive Shot / Exploding Launcher / Rocket Bomb)
        if (p.aoeRadius && p.aoeRadius > 0) {
          for (let k = 0; k < state.enemies.length; k++) {
            const other = state.enemies[k];
            if (other.id === e.id || other.hp <= 0 || other.aiState === 'dead') continue;
            if (ellipseDistance(other.pos.x - p.pos.x, other.pos.y - p.pos.y) <= p.aoeRadius + other.radius) {
              dealDamageToEnemy(
                state,
                other,
                {
                  baseDamage: Math.round(p.damage * 0.8),
                  source: dmgSource,
                  knockback: p.patronId === 'tidebreaker' ? 1100 : 450,
                  patronId: p.patronId,
                  statusId: p.statusToApply,
                },
                hooks,
                ctx,
              );
            }
          }
        }

        if (dealt > 0 && hooks?.onPlayerAttackHit && (dmgSource === 'attack' || dmgSource === 'special' || dmgSource === 'cast')) {
          hooks.onPlayerAttackHit(state, e, dmgSource, dealt, ctx);
        }

        // Bouncing Shield / Chain projectile
        if (p.bouncesLeft > 0) {
          p.bouncesLeft -= 1;
          let nextTarget: EnemyState | null = null;
          let bestDist = 520;
          for (let k = 0; k < state.enemies.length; k++) {
            const cand = state.enemies[k];
            if (cand.hp <= 0 || cand.aiState === 'dead' || p.hitIds.includes(cand.id)) continue;
            const d = Math.hypot(cand.pos.x - p.pos.x, cand.pos.y - p.pos.y);
            if (d < bestDist) {
              bestDist = d;
              nextTarget = cand;
            }
          }
          if (nextTarget) {
            const speed = Math.hypot(p.vel.x, p.vel.y);
            p.angle = Math.atan2(nextTarget.pos.y - p.pos.y, nextTarget.pos.x - p.pos.x);
            p.vel.x = Math.cos(p.angle) * speed;
            p.vel.y = Math.sin(p.angle) * speed;
          } else if (p.kind === 'shield') {
            p.returning = true;
          }
        } else if (p.pierceLeft > 0) {
          p.pierceLeft -= 1;
        } else if (p.kind === 'shield' && !p.returning) {
          p.returning = true;
        } else {
          consumed = true;
          break;
        }
      }
    } else {
      // Enemy or hazard projectile vs Player
      const dist = ellipseDistance(player.pos.x - p.pos.x, player.pos.y - p.pos.y);
      if (dist <= p.radius + 26) {
        if (player.dashTimer > 0 || player.perfectDashTimer > 0) {
          continue;
        }
        const acornBefore = player.acornShields;
        const dealt = dealDamageToPlayer(state, p.damage, {
          source: p.owner === 'hazard' ? 'hazard' : 'enemy',
          fromPos: p.pos,
        });
        const absorbedByAcorn = player.acornShields < acornBefore;
        if (dealt > 0 && p.statusToApply) {
          applyStatus(state, player, 'player', p.statusToApply, 1, p.ownerId);
        }
        if (dealt > 0 || absorbedByAcorn || player.isBlocking) {
          consumed = true;
        }
      }
    }

    if (consumed) {
      state.projectiles.splice(i, 1);
    }
  }
}

/**
 * Tick lodged Bloodstones in enemies (16s expiry) and ground BloodstoneDrops (2000 u/s magnet pickup).
 */
export function tickBloodstones(state: SimState, dt: number): void {
  if (dt <= 0) return;

  const player = state.player;

  // 1. Tick lodged Bloodstones in living enemies
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.lodgedCastTimers.length === 0) continue;

    for (let j = e.lodgedCastTimers.length - 1; j >= 0; j--) {
      e.lodgedCastTimers[j] -= dt;
      if (e.lodgedCastTimers[j] <= 0) {
        e.lodgedCastTimers.splice(j, 1);
        e.lodgedCasts = Math.max(0, e.lodgedCasts - 1);
        const angle = nextFloat(state) * Math.PI * 2;
        state.room.bloodstones.push({
          id: `bs_${state.tick}_${nextInt(state, 0, 999999)}`,
          pos: { x: e.pos.x, y: e.pos.y },
          vel: { x: Math.cos(angle) * 140, y: Math.sin(angle) * 140 * SIM_CONSTANTS.isoScaleY },
          life: 0,
          magnetizing: false,
        });
      }
    }
  }

  // 2. Stygian Soul automatic cast regeneration (Mirror Side B of infernal_soul)
  if (
    state.meta.mirrorActiveSide.infernal_soul === 'b' &&
    player.castAmmo < player.maxCastAmmo
  ) {
    player.castRegenTimer -= dt;
    if (player.castRegenTimer <= 0) {
      const rank = state.meta.mirrorRanks.infernal_soul ?? 0;
      const regenInterval = Math.max(1.0, 3.0 - rank);
      player.castAmmo = Math.min(player.maxCastAmmo, player.castAmmo + 1);
      player.castRegenTimer = regenInterval;
    }
  }

  // 3. Tick dropped ground Bloodstones with 2000 u/s magnet pickup
  const magnetRadius = 280;
  const pickupRadius = 42;
  const damping = Math.exp(-7 * dt);

  for (let i = state.room.bloodstones.length - 1; i >= 0; i--) {
    const bs = state.room.bloodstones[i];
    bs.life += dt;

    const dx = player.pos.x - bs.pos.x;
    const dy = player.pos.y - bs.pos.y;
    const dist = Math.hypot(dx, dy);

    if (bs.life >= 0.15 && (dist <= magnetRadius || bs.magnetizing)) {
      bs.magnetizing = true;
      const step = PLAYER_CONSTANTS.castMagnetSpeed * dt;
      if (dist <= Math.max(pickupRadius, step)) {
        player.castAmmo = Math.min(player.maxCastAmmo, player.castAmmo + 1);
        state.room.bloodstones.splice(i, 1);
        state.events.push({
          type: 'pickup_collected',
          kind: 'gemstone',
          pos: { x: player.pos.x, y: player.pos.y },
          label: 'Bloodstone',
        });
        continue;
      }
      bs.pos.x += (dx / dist) * step;
      bs.pos.y += (dy / dist) * step;
    } else {
      bs.pos.x += bs.vel.x * dt;
      bs.pos.y += bs.vel.y * dt;
      bs.vel.x *= damping;
      bs.vel.y *= damping;

      bs.pos.x = Math.max(state.room.bounds.minX + 24, Math.min(state.room.bounds.maxX - 24, bs.pos.x));
      bs.pos.y = Math.max(state.room.bounds.minY + 24, Math.min(state.room.bounds.maxY - 24, bs.pos.y));
    }
  }
}

/**
 * Tick arena hazards: lava pools (grace 0.35s, 5 dmg / 0.4s), poison pools, curing pools,
 * spike traps (suppressed inside Hallowed Ground!), consecrated aura, Hellfire Mines (pylon),
 * and blade rifts.
 */
export function tickHazards(
  state: SimState,
  dt: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  if (dt <= 0) return;

  const player = state.player;
  let touchingLava = false;
  let touchingPoison = false;

  // Gather active Hallowed Ground zones (blade_paladin) so traps inside them are disabled
  const auras = state.room.hazards.filter((hz) => hz.kind === 'consecrated_aura' && hz.active);

  for (let i = state.room.hazards.length - 1; i >= 0; i--) {
    const h = state.room.hazards[i];
    if (!h.active) continue;

    switch (h.kind) {
      case 'lava_pool': {
        if (player.dashTimer <= 0) {
          const d = ellipseDistance(player.pos.x - h.pos.x, player.pos.y - h.pos.y);
          if (d <= h.radius) {
            touchingLava = true;
          }
        }
        break;
      }
      case 'poison_pool': {
        if (player.dashTimer <= 0) {
          const d = ellipseDistance(player.pos.x - h.pos.x, player.pos.y - h.pos.y);
          if (d <= h.radius) {
            touchingPoison = true;
            applyStatus(state, player, 'player', 'poison', 1, h.id);
          }
        }
        break;
      }
      case 'curing_pool': {
        const d = ellipseDistance(player.pos.x - h.pos.x, player.pos.y - h.pos.y);
        if (d <= h.radius + 20) {
          if (removeStatus(player, 'poison')) {
            spawnFloatingNumber(state, player.pos, 'CURED', 'heal', '#72FFB4');
          }
        }
        break;
      }
      case 'spike_trap': {
        // Aspect of the Paladin Hallowed Ground disables traps inside its radius!
        const suppressed = auras.some(
          (a) => ellipseDistance(h.pos.x - a.pos.x, h.pos.y - a.pos.y) <= a.radius,
        );
        if (suppressed) {
          h.armed = false;
          break;
        }
        if (h.cooldown > 0) {
          h.cooldown = Math.max(0, h.cooldown - dt);
        } else if (h.armed) {
          h.timer -= dt;
          if (h.timer <= 0) {
            h.armed = false;
            h.cooldown = 1.6;
            const dmg = h.damage > 0 ? h.damage : 25;
            if (
              player.dashTimer <= 0 &&
              ellipseDistance(player.pos.x - h.pos.x, player.pos.y - h.pos.y) <= h.radius
            ) {
              dealDamageToPlayer(state, dmg, { source: 'hazard', fromPos: h.pos });
            }
            for (let j = 0; j < state.enemies.length; j++) {
              const e = state.enemies[j];
              if (e.hp <= 0 || e.aiState === 'dead') continue;
              if (ellipseDistance(e.pos.x - h.pos.x, e.pos.y - h.pos.y) <= h.radius + e.radius) {
                dealDamageToEnemy(
                  state,
                  e,
                  { baseDamage: dmg * 2, source: 'hazard', knockback: 400 },
                  hooks,
                  ctx,
                );
              }
            }
            addCameraShake(state, 5.0, 0.12);
          }
        } else {
          let triggered =
            player.dashTimer <= 0 &&
            ellipseDistance(player.pos.x - h.pos.x, player.pos.y - h.pos.y) <= h.radius;
          if (!triggered) {
            for (let j = 0; j < state.enemies.length; j++) {
              const e = state.enemies[j];
              if (e.hp <= 0 || e.aiState === 'dead') continue;
              if (ellipseDistance(e.pos.x - h.pos.x, e.pos.y - h.pos.y) <= h.radius + e.radius * 0.5) {
                triggered = true;
                break;
              }
            }
          }
          if (triggered) {
            h.armed = true;
            h.timer = 0.55;
            state.room.telegraphs.push({
              id: `tel_${h.id}_${state.tick}`,
              kind: 'circle',
              pos: { x: h.pos.x, y: h.pos.y },
              angle: 0,
              radius: h.radius,
              progress: 0,
              duration: 0.55,
              elapsed: 0,
              dangerColor: '#FF4040',
              ownerId: h.id,
            });
          }
        }
        break;
      }
      case 'consecrated_aura': {
        h.timer -= dt;
        // Dampen enemy movement inside Hallowed Ground
        for (let j = 0; j < state.enemies.length; j++) {
          const e = state.enemies[j];
          if (e.hp <= 0 || e.aiState === 'dead') continue;
          if (ellipseDistance(e.pos.x - h.pos.x, e.pos.y - h.pos.y) <= h.radius) {
            e.vel.x *= Math.exp(-3.5 * dt);
            e.vel.y *= Math.exp(-3.5 * dt);
          }
        }
        if (h.timer <= 0) {
          state.room.hazards.splice(i, 1);
        }
        break;
      }
      case 'pylon': {
        // Aspect of the Hellfire (rail_beam) pulsing mines (strictly mine_* so glaciera crystal_* beams stay isolated)
        if (h.owner === 'player' && h.id.startsWith('mine_')) {
          h.timer -= dt;
          h.cooldown -= dt;
          if (h.cooldown <= 0) {
            h.cooldown = 0.6;
            const pulseDmg = h.damage > 0 ? h.damage : 20;
            for (let j = 0; j < state.enemies.length; j++) {
              const e = state.enemies[j];
              if (e.hp <= 0 || e.aiState === 'dead') continue;
              if (ellipseDistance(e.pos.x - h.pos.x, e.pos.y - h.pos.y) <= 155 + e.radius) {
                dealDamageToEnemy(
                  state,
                  e,
                  {
                    baseDamage: pulseDmg,
                    source: 'special',
                    knockback: 180,
                  },
                  hooks,
                  ctx,
                );
              }
            }
          }
          if (h.timer <= 0) {
            state.room.hazards.splice(i, 1);
          }
        }
        break;
      }
      case 'rift_vortex': {
        h.timer -= dt;
        h.cooldown -= dt;
        if (h.cooldown <= 0) {
          h.cooldown = 0.14;
          for (let j = 0; j < state.enemies.length; j++) {
            const e = state.enemies[j];
            if (e.hp <= 0 || e.aiState === 'dead') continue;
            if (ellipseDistance(e.pos.x - h.pos.x, e.pos.y - h.pos.y) <= h.radius + e.radius) {
              dealDamageToEnemy(
                state,
                e,
                { baseDamage: h.damage, source: 'cast', patronId: 'bellum', knockback: 120 },
                hooks,
                ctx,
              );
            }
          }
        }
        if (h.timer <= 0) {
          state.room.hazards.splice(i, 1);
        }
        break;
      }
      default:
        break;
    }
  }

  // Lava grace (0.35s) and periodic tick (5 dmg / 0.4s)
  player.inLava = touchingLava;
  player.inPoison = touchingPoison;

  if (touchingLava) {
    if (player.lavaGraceTimer > 0) {
      player.lavaGraceTimer = Math.max(0, player.lavaGraceTimer - dt);
    } else {
      player.lavaTickTimer -= dt;
      if (player.lavaTickTimer <= 0) {
        player.lavaTickTimer = LAVA_CONSTANTS.tickInterval;
        dealDamageToPlayer(state, LAVA_CONSTANTS.damage, { source: 'lava', ignoreIframes: true });
      }
    }
  } else {
    player.lavaGraceTimer = LAVA_CONSTANTS.graceDuration;
    player.lavaTickTimer = 0;
  }
}
