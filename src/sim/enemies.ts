import {
  COMBAT_CONSTANTS,
  SIM_CONSTANTS,
  type EnemyArchetypeId,
  type EnemyState,
  type SimState,
  type TelegraphShape,
  type Vec2,
} from '../contracts/index.js';
import { getEnemyArchetypeDef, type EnemyArchetypeDef } from '../data/enemies.js';
import { getBoonById } from './boons.js';
import {
  detNextFloat,
  detNextInt,
  getEffectiveMirrorUpgrade,
  type RngProvider,
  type SimCombatContext,
} from './meta.js';

// ============================================================================
// Internal Enemy Tracking (WeakMap keeps SimState pure & serializable)
// ============================================================================

interface EnemyRuntimeExtra {
  lastHp: number;
  dummyIdleSeconds: number;
  beamShotsFired: number;
  attackStruck: boolean;
  lungeDir: Vec2;
  leapStart: Vec2;
}

const enemyExtraMap = new WeakMap<EnemyState, EnemyRuntimeExtra>();

function getEnemyExtra(enemy: EnemyState): EnemyRuntimeExtra {
  let ex = enemyExtraMap.get(enemy);
  if (!ex) {
    ex = {
      lastHp: enemy.hp,
      dummyIdleSeconds: 0,
      beamShotsFired: 0,
      attackStruck: false,
      lungeDir: { x: 1, y: 0 },
      leapStart: { x: enemy.pos.x, y: enemy.pos.y },
    };
    enemyExtraMap.set(enemy, ex);
  }
  return ex;
}

// ============================================================================
// Telegraph Helpers (shared with bosses.ts)
// ============================================================================

export function createTelegraph(
  state: SimState,
  spec: Omit<TelegraphShape, 'id' | 'progress' | 'elapsed'>,
  ctx?: RngProvider
): TelegraphShape {
  const id = `tg_${state.tick}_${state.room.telegraphs.length}_${detNextInt(state, 100, 999, ctx)}`;
  const shape: TelegraphShape = {
    id,
    kind: spec.kind,
    pos: { x: spec.pos.x, y: spec.pos.y },
    angle: spec.angle,
    radius: spec.radius,
    innerRadius: spec.innerRadius,
    length: spec.length,
    width: spec.width,
    arcDeg: spec.arcDeg,
    progress: 0,
    duration: Math.max(0.05, spec.duration),
    elapsed: 0,
    dangerColor: spec.dangerColor,
    ownerId: spec.ownerId,
  };
  state.room.telegraphs.push(shape);
  return shape;
}

export function clearOwnerTelegraphs(state: SimState, ownerId: string): void {
  const list = state.room.telegraphs;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].ownerId === ownerId) {
      list.splice(i, 1);
    }
  }
}

export function tickTelegraphs(state: SimState, dt: number): void {
  const list = state.room.telegraphs;
  for (let i = list.length - 1; i >= 0; i--) {
    const tg = list[i];
    tg.elapsed += dt;
    tg.progress = Math.min(1, tg.elapsed / Math.max(0.05, tg.duration));
    if (tg.ownerId) {
      const owner = state.enemies.find((e) => e.id === tg.ownerId);
      if (!owner || owner.aiState === 'dead' || owner.hp <= 0 || owner.aiState === 'stunned') {
        list.splice(i, 1);
        continue;
      }
    }
    if (tg.elapsed >= tg.duration + 0.04) {
      list.splice(i, 1);
    }
  }
}

// ============================================================================
// Modifiers & Geometry Helpers (shared with bosses.ts)
// ============================================================================

export function getEnemySpeedMultiplier(state: SimState, enemy: EnemyState): number {
  const overtimeRank = Math.max(
    0,
    Math.min(2, Math.floor(state.run.vows.forced_overtime ?? 0))
  );
  let mult = 1 + overtimeRank * 0.2;

  const chill = enemy.statuses.find((s) => s.id === 'chill');
  if (chill && chill.stacks > 0) {
    const slow = Math.min(
      0.4,
      chill.stacks * COMBAT_CONSTANTS.statusDefaults.chill.slowPerStack
    );
    mult *= 1 - slow;
  }

  if (enemy.lodgedCasts > 0) {
    const abyssal = getEffectiveMirrorUpgrade(
      state.meta,
      state.run.vows,
      'boiling_blood'
    );
    if (abyssal.side === 'b' && abyssal.rank > 0) {
      mult *= Math.max(0.5, 1 - abyssal.value);
    }
  }

  return Math.max(0.3, mult);
}

export function getEnemyDamageMultiplier(state: SimState, enemy: EnemyState): number {
  const hardLaborRank = Math.max(
    0,
    Math.min(5, Math.floor(state.run.vows.hard_labor ?? 0))
  );
  let mult = 1 + hardLaborRank * 0.2;

  if (enemy.statuses.some((s) => s.id === 'weak')) {
    mult *= COMBAT_CONSTANTS.statusDefaults.weak.outgoingDamageMult;
  }

  if (enemy.lodgedCasts > 0) {
    const abyssal = getEffectiveMirrorUpgrade(
      state.meta,
      state.run.vows,
      'boiling_blood'
    );
    if (abyssal.side === 'b' && abyssal.rank > 0) {
      mult *= Math.max(0.5, 1 - abyssal.value);
    }
  }

  return mult;
}

export function triggerEnemyJoltedOnAttack(
  state: SimState,
  enemy: EnemyState,
  ctx: SimCombatContext
): void {
  const idx = enemy.statuses.findIndex((s) => s.id === 'jolted');
  if (idx < 0) return;

  enemy.statuses.splice(idx, 1);
  const staticBoon = getBoonById(state, 'voltaris_static_discharge');
  const dmg = staticBoon
    ? staticBoon.scaledValue
    : COMBAT_CONSTANTS.statusDefaults.jolted.baseDamage;

  ctx.dealDamageToEnemy(state, enemy, {
    baseDamage: dmg,
    source: 'status',
    canCrit: false,
    canBackstab: false,
    patronId: 'voltaris',
  });
  state.events.push({
    type: 'status_triggered',
    targetId: enemy.id,
    statusId: 'jolted',
    pos: { x: enemy.pos.x, y: enemy.pos.y },
    damage: dmg,
  });
}

export function clampEnemyToArena(
  state: SimState,
  enemy: EnemyState,
  allowOverPits = false
): void {
  const bounds = state.room.bounds;
  const margin = enemy.radius + 14;
  if (enemy.pos.x < bounds.minX + margin) {
    enemy.pos.x = bounds.minX + margin;
    if (enemy.vel.x < 0) enemy.vel.x *= -0.25;
  } else if (enemy.pos.x > bounds.maxX - margin) {
    enemy.pos.x = bounds.maxX - margin;
    if (enemy.vel.x > 0) enemy.vel.x *= -0.25;
  }
  if (enemy.pos.y < bounds.minY + margin) {
    enemy.pos.y = bounds.minY + margin;
    if (enemy.vel.y < 0) enemy.vel.y *= -0.25;
  } else if (enemy.pos.y > bounds.maxY - margin) {
    enemy.pos.y = bounds.maxY - margin;
    if (enemy.vel.y > 0) enemy.vel.y *= -0.25;
  }

  for (const obs of state.room.obstacles) {
    if (!obs.blocksMovement) continue;
    if (obs.kind === 'pit' && allowOverPits) continue;
    if (obs.destructible && (obs.hp ?? 1) <= 0) continue;

    const closestX = Math.max(
      obs.pos.x - obs.halfW,
      Math.min(enemy.pos.x, obs.pos.x + obs.halfW)
    );
    const closestY = Math.max(
      obs.pos.y - obs.halfH,
      Math.min(enemy.pos.y, obs.pos.y + obs.halfH)
    );
    const dx = enemy.pos.x - closestX;
    const dy = enemy.pos.y - closestY;
    const dSq = dx * dx + dy * dy;
    const r = enemy.radius;
    if (dSq < r * r) {
      if (dSq > 1e-4) {
        const d = Math.sqrt(dSq);
        const push = r - d;
        enemy.pos.x += (dx / d) * push;
        enemy.pos.y += (dy / d) * push;
      } else {
        enemy.pos.y += r;
      }
    }
  }
}

export function isoEllipseDistance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = (a.y - b.y) / SIM_CONSTANTS.isoScaleY;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// ============================================================================
// Enemy Spawning
// ============================================================================

export function spawnEnemy(
  state: SimState,
  archetype: EnemyArchetypeId,
  pos: Vec2,
  opts?: {
    elite?: boolean;
    isMiniBoss?: boolean;
    parentBossId?: string;
  },
  ctx?: RngProvider
): EnemyState {
  const def = getEnemyArchetypeDef(archetype);
  const elite = Boolean(opts?.elite || opts?.isMiniBoss);
  const isMiniBoss = Boolean(opts?.isMiniBoss);

  const calisthenicsRank = Math.max(
    0,
    Math.min(2, Math.floor(state.run.vows.calisthenics_program ?? 0))
  );
  const hpScale = 1 + calisthenicsRank * 0.15;
  const depthScale =
    archetype === 'rattlebones_dummy'
      ? 1
      : 1 + Math.max(0, state.room.depth - 1) * 0.04;

  const baseHp = Math.round(
    def.maxHp *
      (elite ? def.eliteHpMult : 1) *
      (isMiniBoss ? 2.1 : 1) *
      hpScale *
      depthScale
  );

  let armor = 0;
  if (elite && archetype !== 'rattlebones_dummy') {
    const middleMgmt =
      isMiniBoss && (state.run.vows.middle_management ?? 0) > 0 ? 1.45 : 1;
    armor = Math.round(
      def.eliteArmor * (isMiniBoss ? 1.85 : 1) * middleMgmt * hpScale
    );
  }

  const damageControlHits =
    archetype === 'rattlebones_dummy'
      ? 0
      : Math.max(0, Math.min(2, Math.floor(state.run.vows.damage_control ?? 0)));

  const id = `enemy_${archetype}_${state.tick}_${state.enemies.length}_${detNextInt(state, 100, 999, ctx)}`;
  const displayName = isMiniBoss
    ? `Warden's ${def.displayName}`
    : elite
      ? `Armored ${def.displayName}`
      : def.displayName;

  const enemy: EnemyState = {
    id,
    archetype,
    name: displayName,
    isBoss: false,
    isMiniBoss,
    pos: { x: pos.x, y: pos.y },
    vel: { x: 0, y: 0 },
    radius: isMiniBoss ? Math.round(def.radius * 1.2) : def.radius,
    facingAngle: Math.atan2(
      state.player.pos.y - pos.y,
      state.player.pos.x - pos.x
    ),
    hp: baseHp,
    maxHp: baseHp,
    armor,
    maxArmor: armor,
    phase: 1,
    maxPhases: 1,
    invulnerable: archetype !== 'rattlebones_dummy',
    invulnTimer: archetype === 'rattlebones_dummy' ? 0 : 0.45,
    aiState: archetype === 'rattlebones_dummy' ? 'idle' : 'spawning',
    aiTimer: archetype === 'rattlebones_dummy' ? 0 : 0.45,
    attackCooldown:
      archetype === 'rattlebones_dummy'
        ? 99
        : 0.4 + detNextFloat(state, ctx) * 0.55,
    attackPatternIdx: 0,
    stunTimer: 0,
    lodgedCasts: 0,
    lodgedCastTimers: [],
    statuses: [],
    hitFlashTimer: 0,
    hitstopTimer: 0,
    damageControlHits,
    parentBossId: opts?.parentBossId,
  };

  state.enemies.push(enemy);
  state.events.push({
    type: 'enemy_spawn',
    enemyId: enemy.id,
    archetype: enemy.archetype,
    pos: { x: enemy.pos.x, y: enemy.pos.y },
    isBoss: false,
  });

  return enemy;
}

// ============================================================================
// Non-Boss Enemy AI State Machine
// ============================================================================

function beginEnemyWindup(
  state: SimState,
  enemy: EnemyState,
  def: EnemyArchetypeDef,
  speedMult: number,
  ctx: SimCombatContext
): void {
  const extra = getEnemyExtra(enemy);
  extra.attackStruck = false;
  extra.beamShotsFired = 0;

  const dx = state.player.pos.x - enemy.pos.x;
  const dy = state.player.pos.y - enemy.pos.y;
  const angle = Math.atan2(dy, dx);
  enemy.facingAngle = angle;
  enemy.aiState = 'windup';

  const windup = Math.max(0.28, def.windupDuration / speedMult);
  enemy.aiTimer = windup;

  extra.lungeDir = { x: Math.cos(angle), y: Math.sin(angle) };
  extra.leapStart = { x: enemy.pos.x, y: enemy.pos.y };

  if (def.attackKind === 'leap_slam') {
    const dist = Math.min(def.attackRange, Math.sqrt(dx * dx + dy * dy));
    enemy.targetPos = {
      x: enemy.pos.x + Math.cos(angle) * dist,
      y: enemy.pos.y + Math.sin(angle) * dist,
    };
    createTelegraph(
      state,
      {
        kind: 'circle',
        pos: enemy.targetPos,
        angle,
        radius: def.telegraphRadius,
        duration: windup,
        dangerColor: def.dangerColor,
        ownerId: enemy.id,
      },
      ctx
    );
  } else if (def.telegraphKind === 'cone') {
    createTelegraph(
      state,
      {
        kind: 'cone',
        pos: enemy.pos,
        angle,
        radius: def.telegraphRadius,
        arcDeg: def.telegraphArcDeg ?? 115,
        duration: windup,
        dangerColor: def.dangerColor,
        ownerId: enemy.id,
      },
      ctx
    );
  } else {
    createTelegraph(
      state,
      {
        kind: 'line',
        pos: enemy.pos,
        angle,
        radius: def.telegraphRadius,
        length: def.telegraphLength ?? def.attackRange,
        width: def.telegraphWidth ?? 42,
        duration: windup,
        dangerColor: def.dangerColor,
        ownerId: enemy.id,
      },
      ctx
    );
  }
}

function executeEnemyAttackTick(
  state: SimState,
  enemy: EnemyState,
  def: EnemyArchetypeDef,
  dt: number,
  speedMult: number,
  ctx: SimCombatContext
): void {
  const extra = getEnemyExtra(enemy);
  const dmg = Math.max(
    1,
    Math.round(def.attackDamage * getEnemyDamageMultiplier(state, enemy))
  );
  const player = state.player;

  if (def.attackKind === 'lunge_bite' || def.attackKind === 'dash_strike') {
    const lungeSpeed = def.attackKind === 'dash_strike' ? 1050 : 880;
    enemy.vel.x = extra.lungeDir.x * lungeSpeed * speedMult;
    enemy.vel.y = extra.lungeDir.y * lungeSpeed * speedMult;

    if (!extra.attackStruck) {
      const dx = player.pos.x - enemy.pos.x;
      const dy = player.pos.y - enemy.pos.y;
      const hitDist = enemy.radius + 36;
      if (dx * dx + dy * dy <= hitDist * hitDist) {
        extra.attackStruck = true;
        ctx.dealDamageToPlayer(state, dmg, {
          source: 'enemy',
          fromPos: enemy.pos,
        });
      }
    }
    return;
  }

  if (def.attackKind === 'heavy_slam') {
    if (!extra.attackStruck) {
      extra.attackStruck = true;
      const dx = player.pos.x - enemy.pos.x;
      const dy = player.pos.y - enemy.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const halfArc = ((def.telegraphArcDeg ?? 120) * Math.PI) / 360;
      const angToPlayer = Math.atan2(dy, dx);
      if (
        dist <= def.telegraphRadius + 24 &&
        angleDiff(angToPlayer, enemy.facingAngle) <= halfArc + 0.18
      ) {
        ctx.dealDamageToPlayer(state, dmg, {
          source: 'enemy',
          fromPos: enemy.pos,
        });
        ctx.addCameraShake(state, 5, 0.14);
      }
    }
    return;
  }

  if (def.attackKind === 'leap_slam') {
    const target = enemy.targetPos ?? player.pos;
    const totalDur = Math.max(0.1, def.attackDuration / speedMult);
    const t = Math.min(1, 1 - enemy.aiTimer / totalDur);
    enemy.pos.x = extra.leapStart.x + (target.x - extra.leapStart.x) * t;
    enemy.pos.y = extra.leapStart.y + (target.y - extra.leapStart.y) * t;

    if (!extra.attackStruck && t >= 0.92) {
      extra.attackStruck = true;
      const dx = player.pos.x - target.x;
      const dy = player.pos.y - target.y;
      if (dx * dx + dy * dy <= (def.telegraphRadius + 18) ** 2) {
        ctx.dealDamageToPlayer(state, dmg, {
          source: 'enemy',
          fromPos: target,
        });
      }
      ctx.addCameraShake(state, 6, 0.16);
    }
    return;
  }

  if (def.attackKind === 'ranged_spread') {
    if (!extra.attackStruck) {
      extra.attackStruck = true;
      const isElite = enemy.maxArmor > 0 || enemy.isMiniBoss;
      const count = isElite ? (def.projectileCount ?? 3) : 1;
      const spreadStep = 0.24;
      const startAngle = enemy.facingAngle - ((count - 1) * spreadStep) * 0.5;
      const speed = (def.projectileSpeed ?? 430) * speedMult;
      const isPoison = enemy.archetype === 'venom_satyr';

      for (let i = 0; i < count; i++) {
        const ang = startAngle + i * spreadStep;
        ctx.spawnProjectile(state, {
          owner: 'enemy',
          ownerId: enemy.id,
          kind: isPoison ? 'dart' : 'orb',
          pos: {
            x: enemy.pos.x + Math.cos(ang) * (enemy.radius + 8),
            y: enemy.pos.y + Math.sin(ang) * (enemy.radius + 8),
          },
          vel: { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed },
          startPos: { x: enemy.pos.x, y: enemy.pos.y },
          radius: 13,
          angle: ang,
          damage: dmg,
          range: 760,
          maxLife: 2.4,
          pierceLeft: 0,
          bouncesLeft: 0,
          deflectable: true,
          deflected: false,
          homingStrength: 0,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          statusToApply: isPoison ? 'poison' : undefined,
          colorHex: def.dangerColor,
        });
      }
    }
    return;
  }

  if (def.attackKind === 'laser_beam') {
    const totalShots = def.projectileCount ?? 3;
    const totalDur = Math.max(0.15, def.attackDuration / speedMult);
    const elapsed = Math.max(0, totalDur - enemy.aiTimer);
    const expectedShots = Math.min(
      totalShots,
      Math.floor((elapsed / totalDur) * totalShots) + 1
    );
    while (extra.beamShotsFired < expectedShots) {
      extra.beamShotsFired += 1;
      const ang = enemy.facingAngle;
      const speed = (def.projectileSpeed ?? 980) * speedMult;
      ctx.spawnProjectile(state, {
        owner: 'enemy',
        ownerId: enemy.id,
        kind: 'laser',
        pos: {
          x: enemy.pos.x + Math.cos(ang) * (enemy.radius + 10),
          y: enemy.pos.y + Math.sin(ang) * (enemy.radius + 10),
        },
        vel: { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed },
        startPos: { x: enemy.pos.x, y: enemy.pos.y },
        radius: 12,
        angle: ang,
        damage: dmg,
        range: def.telegraphLength ?? 680,
        maxLife: 0.9,
        pierceLeft: 0,
        bouncesLeft: 0,
        deflectable: true,
        deflected: false,
        homingStrength: 0,
        isLob: false,
        lobHeight: 0,
        lobDuration: 0,
        lobElapsed: 0,
        colorHex: def.dangerColor,
      });
    }
    void dt;
  }
}

function tickRattlebonesDummy(
  state: SimState,
  enemy: EnemyState,
  dt: number
): void {
  const extra = getEnemyExtra(enemy);
  enemy.aiState = 'idle';
  enemy.invulnerable = false;

  if (enemy.hp <= 100) {
    enemy.hp = enemy.maxHp;
    extra.lastHp = enemy.maxHp;
    extra.dummyIdleSeconds = 0;
    state.events.push({
      type: 'ui_toast',
      text: 'Rattlebones reassembles himself!',
      colorHex: '#4de09d',
    });
    return;
  }

  if (enemy.hp < extra.lastHp) {
    extra.lastHp = enemy.hp;
    extra.dummyIdleSeconds = 0;
  } else if (enemy.hp < enemy.maxHp) {
    extra.dummyIdleSeconds += dt;
    if (extra.dummyIdleSeconds >= 3.0) {
      const healed = enemy.maxHp - enemy.hp;
      enemy.hp = enemy.maxHp;
      extra.lastHp = enemy.maxHp;
      extra.dummyIdleSeconds = 0;
      state.floatingNumbers.push({
        id: `fl_dummy_heal_${state.tick}`,
        pos: { x: enemy.pos.x, y: enemy.pos.y - 44 },
        vel: { x: 0, y: -45 },
        value: `+${Math.min(9999, Math.round(healed))}`,
        kind: 'heal',
        colorHex: '#4de09d',
        life: 0,
        maxLife: 0.85,
      });
    }
  }

  // Gentle pull back toward courtyard dummy anchor if knocked far away
  const anchorX = 240;
  const anchorY = -20;
  enemy.vel.x *= Math.pow(0.08, dt);
  enemy.vel.y *= Math.pow(0.08, dt);
  enemy.pos.x += enemy.vel.x * dt;
  enemy.pos.y += enemy.vel.y * dt;
  if (extra.dummyIdleSeconds > 1.0) {
    enemy.pos.x += (anchorX - enemy.pos.x) * Math.min(1, dt * 3);
    enemy.pos.y += (anchorY - enemy.pos.y) * Math.min(1, dt * 3);
  }
  clampEnemyToArena(state, enemy, false);
}

export function tickEnemies(
  state: SimState,
  dt: number,
  ctx: SimCombatContext
): void {
  tickTelegraphs(state, dt);

  const player = state.player;
  const enemies = state.enemies;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (enemy.isBoss) continue;
    if (enemy.aiState === 'dead' || enemy.hp <= 0) {
      enemy.aiState = 'dead';
      continue;
    }

    if (enemy.archetype === 'rattlebones_dummy') {
      tickRattlebonesDummy(state, enemy, dt);
      continue;
    }

    if (enemy.hitstopTimer > 0) {
      enemy.hitstopTimer = Math.max(0, enemy.hitstopTimer - dt);
      continue;
    }
    if (enemy.invulnTimer > 0) {
      enemy.invulnTimer = Math.max(0, enemy.invulnTimer - dt);
      if (enemy.invulnTimer <= 0) {
        enemy.invulnerable = false;
      }
    }

    // Stun handling (Armor Break stun / Velouris charm)
    if (enemy.stunTimer > 0) {
      enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);
      if (enemy.aiState !== 'stunned') {
        enemy.aiState = 'stunned';
        clearOwnerTelegraphs(state, enemy.id);
      }
      enemy.vel.x *= Math.pow(0.05, dt);
      enemy.vel.y *= Math.pow(0.05, dt);
      enemy.pos.x += enemy.vel.x * dt;
      enemy.pos.y += enemy.vel.y * dt;
      clampEnemyToArena(state, enemy, false);
      if (enemy.stunTimer <= 0) {
        enemy.aiState = 'chase';
      }
      continue;
    }

    const def = getEnemyArchetypeDef(enemy.archetype);
    const speedMult = getEnemySpeedMultiplier(state, enemy);

    if (enemy.attackCooldown > 0) {
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt * speedMult);
    }

    if (enemy.aiState === 'spawning') {
      enemy.aiTimer -= dt;
      if (enemy.aiTimer <= 0) {
        enemy.invulnerable = false;
        enemy.aiState = 'chase';
      }
      continue;
    }

    if (enemy.aiState === 'windup') {
      enemy.vel.x *= Math.pow(0.06, dt);
      enemy.vel.y *= Math.pow(0.06, dt);
      enemy.aiTimer -= dt;
      if (enemy.aiTimer <= 0) {
        clearOwnerTelegraphs(state, enemy.id);
        triggerEnemyJoltedOnAttack(state, enemy, ctx);
        if (enemy.hp <= 0 || (enemy.aiState as EnemyState['aiState']) === 'dead') {
          continue;
        }
        enemy.aiState = 'attack';
        enemy.aiTimer = Math.max(0.14, def.attackDuration / speedMult);
      }
    } else if (enemy.aiState === 'attack') {
      enemy.aiTimer -= dt;
      executeEnemyAttackTick(state, enemy, def, dt, speedMult, ctx);
      if (enemy.aiTimer <= 0) {
        enemy.aiState = 'recover';
        enemy.aiTimer = Math.max(0.24, def.recoverDuration / speedMult);
        enemy.attackCooldown = def.attackCooldown;
      }
    } else if (enemy.aiState === 'recover') {
      enemy.vel.x *= Math.pow(0.05, dt);
      enemy.vel.y *= Math.pow(0.05, dt);
      enemy.aiTimer -= dt;
      if (enemy.aiTimer <= 0) {
        enemy.aiState = 'chase';
      }
    } else {
      // 'idle' | 'chase'
      const dx = player.pos.x - enemy.pos.x;
      const dy = player.pos.y - enemy.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angToPlayer = Math.atan2(dy, dx);
      enemy.facingAngle = angToPlayer;

      if (dist <= def.attackRange && enemy.attackCooldown <= 0 && !player.isDead) {
        beginEnemyWindup(state, enemy, def, speedMult, ctx);
      } else if (dist <= def.aggroRange && !player.isDead) {
        enemy.aiState = 'chase';
        const moveSpeed = def.speed * speedMult;
        let dirX = 0;
        let dirY = 0;

        if (
          (def.attackKind === 'ranged_spread' || def.attackKind === 'laser_beam') &&
          dist < def.preferredRange * 0.55
        ) {
          // Ranged units kite back gently when player crowds them
          dirX = -Math.cos(angToPlayer) * 0.7;
          dirY = -Math.sin(angToPlayer) * 0.7;
        } else if (dist > def.preferredRange * 0.85) {
          dirX = Math.cos(angToPlayer);
          dirY = Math.sin(angToPlayer);
        } else {
          // Slight strafe for dynamic combat positioning
          const strafeSign = i % 2 === 0 ? 1 : -1;
          dirX = -Math.sin(angToPlayer) * 0.45 * strafeSign;
          dirY = Math.cos(angToPlayer) * 0.45 * strafeSign;
        }

        // Soft separation from other enemies
        for (let j = 0; j < enemies.length; j++) {
          if (i === j) continue;
          const other = enemies[j];
          if (other.aiState === 'dead' || other.hp <= 0) continue;
          const sx = enemy.pos.x - other.pos.x;
          const sy = enemy.pos.y - other.pos.y;
          const minSep = enemy.radius + other.radius + 14;
          const sSq = sx * sx + sy * sy;
          if (sSq > 1e-4 && sSq < minSep * minSep) {
            const sDist = Math.sqrt(sSq);
            const push = (minSep - sDist) / minSep;
            dirX += (sx / sDist) * push * 1.4;
            dirY += (sy / sDist) * push * 1.4;
          }
        }

        const mag = Math.sqrt(dirX * dirX + dirY * dirY);
        if (mag > 1e-4) {
          const targetVx = (dirX / mag) * moveSpeed;
          const targetVy = (dirY / mag) * moveSpeed;
          const blend = Math.min(1, dt * 6.5);
          enemy.vel.x += (targetVx - enemy.vel.x) * blend;
          enemy.vel.y += (targetVy - enemy.vel.y) * blend;
        }
      } else {
        enemy.vel.x *= Math.pow(0.08, dt);
        enemy.vel.y *= Math.pow(0.08, dt);
      }
    }

    // Integrate motion (leap_slam positions directly during attack)
    if (!(enemy.aiState === 'attack' && def.attackKind === 'leap_slam')) {
      enemy.pos.x += enemy.vel.x * dt;
      enemy.pos.y += enemy.vel.y * dt;
    }
    clampEnemyToArena(
      state,
      enemy,
      enemy.aiState === 'attack' && def.attackKind === 'leap_slam'
    );
  }
}
