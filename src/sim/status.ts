import {
  COMBAT_CONSTANTS,
  MIRROR_UPGRADES,
  type ActiveStatus,
  type EnemyState,
  type PlayerState,
  type SimState,
  type StatusEffectId,
} from '../contracts/index.js';

export function countUniqueStatuses(statuses: readonly ActiveStatus[]): number {
  let count = 0;
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i].remaining > 0 && statuses[i].stacks > 0) {
      count++;
    }
  }
  return count;
}

export function hasStatus(statuses: readonly ActiveStatus[], id: StatusEffectId): boolean {
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i].id === id && statuses[i].remaining > 0) return true;
  }
  return false;
}

export function getStatus(
  statuses: readonly ActiveStatus[],
  id: StatusEffectId,
): ActiveStatus | undefined {
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i].id === id && statuses[i].remaining > 0) return statuses[i];
  }
  return undefined;
}

export function removeStatus(target: EnemyState | PlayerState, id: StatusEffectId): boolean {
  for (let i = target.statuses.length - 1; i >= 0; i--) {
    if (target.statuses[i].id === id) {
      target.statuses.splice(i, 1);
      return true;
    }
  }
  return false;
}

export function clearAllStatuses(target: EnemyState | PlayerState): void {
  target.statuses.length = 0;
}

/**
 * Chill slows enemy/player movement & action speed by 4% per stack up to -40% (10 stacks).
 */
export function getChillSpeedMultiplier(statuses: readonly ActiveStatus[]): number {
  const chill = getStatus(statuses, 'chill');
  if (!chill) return 1.0;
  const defaults = COMBAT_CONSTANTS.statusDefaults.chill;
  const cappedStacks = Math.min(defaults.maxStacks, Math.max(0, chill.stacks));
  return Math.max(0.6, 1.0 - cappedStacks * defaults.slowPerStack);
}

/**
 * Computes outgoing enemy damage multiplier accounting for Weak (0.7x), Maim (+25%),
 * and Mirror Abyssal Blood (-6% per rank when a Bloodstone is lodged).
 */
export function getEnemyOutgoingDamageMultiplier(state: SimState, enemy: EnemyState): number {
  let mult = 1.0;
  const weak = getStatus(enemy.statuses, 'weak');
  if (weak) {
    mult *= weak.magnitude > 0 && weak.magnitude < 1 ? weak.magnitude : COMBAT_CONSTANTS.statusDefaults.weak.outgoingDamageMult;
  }
  const maim = getStatus(enemy.statuses, 'maim');
  if (maim) {
    mult *= 1 + COMBAT_CONSTANTS.statusDefaults.maim.outgoingDamageBonus;
  }
  if (
    enemy.lodgedCasts > 0 &&
    state.meta.mirrorActiveSide.boiling_blood === 'b' &&
    state.meta.mirrorRanks.boiling_blood > 0
  ) {
    const abyssalRank = Math.min(
      MIRROR_UPGRADES.boiling_blood.sideB.maxRank,
      state.meta.mirrorRanks.boiling_blood,
    );
    mult *= Math.max(0.5, 1 - abyssalRank * MIRROR_UPGRADES.boiling_blood.sideB.valuePerRank);
  }
  return mult;
}

function getStatusDefaults(statusId: StatusEffectId): {
  duration: number;
  tickInterval: number;
  magnitude: number;
  maxStacks: number;
} {
  const d = COMBAT_CONSTANTS.statusDefaults;
  switch (statusId) {
    case 'jolted':
      return {
        duration: d.jolted.duration,
        tickInterval: 0,
        magnitude: d.jolted.baseDamage,
        maxStacks: 1,
      };
    case 'ruptured':
      return {
        duration: d.ruptured.duration,
        tickInterval: d.ruptured.tickInterval,
        magnitude: d.ruptured.baseDamage,
        maxStacks: 1,
      };
    case 'exposed':
      return {
        duration: d.exposed.duration,
        tickInterval: 0,
        magnitude: d.exposed.backstabBonus,
        maxStacks: 1,
      };
    case 'weak':
      return {
        duration: d.weak.duration,
        tickInterval: 0,
        magnitude: d.weak.outgoingDamageMult,
        maxStacks: 1,
      };
    case 'marked':
      return {
        duration: d.marked.duration,
        tickInterval: 0,
        magnitude: d.marked.bonusCritChance,
        maxStacks: 1,
      };
    case 'doom':
      return {
        duration: d.doom.delay,
        tickInterval: 0,
        magnitude: d.doom.baseDamage,
        maxStacks: 5,
      };
    case 'hangover':
      return {
        duration: d.hangover.duration,
        tickInterval: d.hangover.tickInterval,
        magnitude: d.hangover.damagePerTick,
        maxStacks: d.hangover.maxStacks,
      };
    case 'chill':
      return {
        duration: d.chill.duration,
        tickInterval: 0,
        magnitude: d.chill.slowPerStack,
        maxStacks: d.chill.maxStacks,
      };
    case 'maim':
      return {
        duration: d.maim.duration,
        tickInterval: 0,
        magnitude: d.maim.burstDamage,
        maxStacks: 1,
      };
    case 'poison':
      return {
        duration: d.poison.duration,
        tickInterval: d.poison.tickInterval,
        magnitude: d.poison.damagePerTick,
        maxStacks: 1,
      };
  }
}

/**
 * Apply or refresh one of the 10 StatusEffectIds on an EnemyState or PlayerState.
 */
export function applyStatus(
  state: SimState,
  target: EnemyState | PlayerState,
  targetKind: 'enemy' | 'player',
  statusId: StatusEffectId,
  stacks: number = 1,
  sourceId?: string,
  magnitudeOverride?: number,
): void {
  const def = getStatusDefaults(statusId);
  const addStacks = Math.max(1, Math.floor(stacks));
  const magnitude = magnitudeOverride !== undefined ? magnitudeOverride : def.magnitude;
  const existing = getStatus(target.statuses, statusId);

  let finalStacks = Math.min(def.maxStacks, addStacks);

  if (existing) {
    if (statusId === 'doom') {
      // Doom does not reset its 1.1s detonation timer on reapply; additional stacks scale damage
      existing.stacks = Math.min(def.maxStacks, existing.stacks + addStacks);
      existing.magnitude = Math.max(existing.magnitude, magnitude);
      finalStacks = existing.stacks;
    } else if (statusId === 'hangover' || statusId === 'chill') {
      existing.stacks = Math.min(def.maxStacks, existing.stacks + addStacks);
      existing.remaining = def.duration;
      existing.magnitude = Math.max(existing.magnitude, magnitude);
      finalStacks = existing.stacks;
    } else {
      existing.remaining = def.duration;
      existing.stacks = Math.min(def.maxStacks, Math.max(existing.stacks, addStacks));
      existing.magnitude = magnitude;
      finalStacks = existing.stacks;
    }
    if (sourceId !== undefined) {
      existing.sourceId = sourceId;
    }
  } else {
    target.statuses.push({
      id: statusId,
      remaining: def.duration,
      stacks: finalStacks,
      tickTimer: def.tickInterval,
      magnitude,
      sourceId,
    });
  }

  const targetId = targetKind === 'player' ? 'player' : (target as EnemyState).id;
  state.events.push({
    type: 'status_applied',
    targetId,
    statusId,
    pos: { x: target.pos.x, y: target.pos.y },
    stacks: finalStacks,
  });
}

export interface StatusTickCallbacks {
  onEnemyStatusDamage(enemy: EnemyState, statusId: StatusEffectId, damage: number): void;
  onPlayerStatusDamage(statusId: StatusEffectId, damage: number): void;
}

/**
 * Trigger Jolted self-zap when an afflicted enemy executes an attack.
 */
export function triggerJoltedOnEnemy(
  state: SimState,
  enemy: EnemyState,
  onDamage: (enemy: EnemyState, statusId: StatusEffectId, damage: number) => void,
): boolean {
  const jolted = getStatus(enemy.statuses, 'jolted');
  if (!jolted) return false;

  const dmg = Math.max(1, Math.round(jolted.magnitude || COMBAT_CONSTANTS.statusDefaults.jolted.baseDamage));
  removeStatus(enemy, 'jolted');

  state.events.push({
    type: 'status_triggered',
    targetId: enemy.id,
    statusId: 'jolted',
    pos: { x: enemy.pos.x, y: enemy.pos.y },
    damage: dmg,
  });

  onDamage(enemy, 'jolted', dmg);
  return true;
}

/**
 * Advance all active status timers, DoT intervals, Doom delayed bursts, Maim detonations,
 * Ruptured movement ticks, and Jolted attack triggers for all enemies and the player.
 */
export function tickStatuses(
  state: SimState,
  dt: number,
  callbacks: StatusTickCallbacks,
): void {
  if (dt <= 0) return;

  // 1. Enemy statuses
  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    if (enemy.hp <= 0 || enemy.aiState === 'dead') continue;
    if (enemy.statuses.length === 0) continue;

    const enemySpeed = Math.hypot(enemy.vel.x, enemy.vel.y);
    const isMoving = enemySpeed > 18 || enemy.aiState === 'chase';

    for (let j = enemy.statuses.length - 1; j >= 0; j--) {
      const st = enemy.statuses[j];
      st.remaining -= dt;

      switch (st.id) {
        case 'jolted': {
          // Jolted triggers self-zap immediately when the enemy attacks
          if (enemy.aiState === 'attack') {
            const dmg = Math.max(
              1,
              Math.round(st.magnitude || COMBAT_CONSTANTS.statusDefaults.jolted.baseDamage),
            );
            enemy.statuses.splice(j, 1);
            state.events.push({
              type: 'status_triggered',
              targetId: enemy.id,
              statusId: 'jolted',
              pos: { x: enemy.pos.x, y: enemy.pos.y },
              damage: dmg,
            });
            callbacks.onEnemyStatusDamage(enemy, 'jolted', dmg);
            continue;
          }
          break;
        }
        case 'ruptured': {
          if (isMoving) {
            st.tickTimer -= dt;
            if (st.tickTimer <= 0) {
              st.tickTimer += COMBAT_CONSTANTS.statusDefaults.ruptured.tickInterval;
              const dmg = Math.max(
                1,
                Math.round(st.magnitude || COMBAT_CONSTANTS.statusDefaults.ruptured.baseDamage),
              );
              state.events.push({
                type: 'status_triggered',
                targetId: enemy.id,
                statusId: 'ruptured',
                pos: { x: enemy.pos.x, y: enemy.pos.y },
                damage: dmg,
              });
              callbacks.onEnemyStatusDamage(enemy, 'ruptured', dmg);
            }
          }
          break;
        }
        case 'hangover': {
          st.tickTimer -= dt;
          if (st.tickTimer <= 0) {
            st.tickTimer += COMBAT_CONSTANTS.statusDefaults.hangover.tickInterval;
            const dmg = Math.max(
              1,
              Math.round(
                st.stacks * (st.magnitude || COMBAT_CONSTANTS.statusDefaults.hangover.damagePerTick),
              ),
            );
            state.events.push({
              type: 'status_triggered',
              targetId: enemy.id,
              statusId: 'hangover',
              pos: { x: enemy.pos.x, y: enemy.pos.y },
              damage: dmg,
            });
            callbacks.onEnemyStatusDamage(enemy, 'hangover', dmg);
          }
          break;
        }
        case 'poison': {
          st.tickTimer -= dt;
          if (st.tickTimer <= 0) {
            st.tickTimer += COMBAT_CONSTANTS.statusDefaults.poison.tickInterval;
            const dmg = Math.max(
              1,
              Math.round(st.magnitude || COMBAT_CONSTANTS.statusDefaults.poison.damagePerTick),
            );
            state.events.push({
              type: 'status_triggered',
              targetId: enemy.id,
              statusId: 'poison',
              pos: { x: enemy.pos.x, y: enemy.pos.y },
              damage: dmg,
            });
            callbacks.onEnemyStatusDamage(enemy, 'poison', dmg);
          }
          break;
        }
        case 'doom': {
          if (st.remaining <= 0) {
            const base = st.magnitude || COMBAT_CONSTANTS.statusDefaults.doom.baseDamage;
            const extraStackBonus = (st.stacks - 1) * 10;
            const dmg = Math.max(1, Math.round(base + extraStackBonus));
            enemy.statuses.splice(j, 1);
            state.events.push({
              type: 'status_triggered',
              targetId: enemy.id,
              statusId: 'doom',
              pos: { x: enemy.pos.x, y: enemy.pos.y },
              damage: dmg,
            });
            callbacks.onEnemyStatusDamage(enemy, 'doom', dmg);
            continue;
          }
          break;
        }
        case 'maim': {
          if (st.remaining <= 0) {
            const dmg = Math.max(
              1,
              Math.round(st.magnitude || COMBAT_CONSTANTS.statusDefaults.maim.burstDamage),
            );
            enemy.statuses.splice(j, 1);
            state.events.push({
              type: 'status_triggered',
              targetId: enemy.id,
              statusId: 'maim',
              pos: { x: enemy.pos.x, y: enemy.pos.y },
              damage: dmg,
            });
            callbacks.onEnemyStatusDamage(enemy, 'maim', dmg);
            continue;
          }
          break;
        }
        case 'exposed':
        case 'weak':
        case 'marked':
        case 'chill':
          // Pure passive modifiers; expire when remaining <= 0
          break;
      }

      if (enemy.hp <= 0) {
        break;
      }

      if (st.remaining <= 0) {
        enemy.statuses.splice(j, 1);
      }
    }
  }

  // 2. Player statuses (e.g., Poison from Crypt of Bile, Chill, Weak, Maim)
  const player = state.player;
  if (!player.isDead && player.statuses.length > 0) {
    for (let j = player.statuses.length - 1; j >= 0; j--) {
      const st = player.statuses[j];
      st.remaining -= dt;

      if (st.id === 'poison' || st.id === 'hangover') {
        st.tickTimer -= dt;
        if (st.tickTimer <= 0) {
          const interval =
            st.id === 'poison'
              ? COMBAT_CONSTANTS.statusDefaults.poison.tickInterval
              : COMBAT_CONSTANTS.statusDefaults.hangover.tickInterval;
          st.tickTimer += interval;
          const dmg = Math.max(1, Math.round(st.magnitude || 4));
          state.events.push({
            type: 'status_triggered',
            targetId: 'player',
            statusId: st.id,
            pos: { x: player.pos.x, y: player.pos.y },
            damage: dmg,
          });
          callbacks.onPlayerStatusDamage(st.id, dmg);
        }
      }

      if (st.remaining <= 0) {
        player.statuses.splice(j, 1);
      }
    }
  }
}
