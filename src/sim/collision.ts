import {
  BIOME_CONSTANTS,
  COMBAT_CONSTANTS,
  SIM_CONSTANTS,
  type ArenaObstacle,
  type EnemyState,
  type RoomState,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import { ellipseDistance, isInEllipticalCone } from './isometric.js';
import { chance, nextInt } from './prng.js';

// Precompute hero octagon SAT axes from SIM_CONSTANTS.heroOctagonVerts:
// [[-16,-24],[16,-24],[48,-8],[48,8],[16,24],[-16,24],[-48,8],[-48,-8]]
const INV_SQRT5 = 1 / Math.sqrt(5);

interface SatAxis {
  x: number;
  y: number;
  heroExtent: number;
}

const HERO_SAT_AXES: readonly SatAxis[] = (() => {
  const dirs: readonly [number, number][] = [
    [1, 0],
    [0, 1],
    [INV_SQRT5, 2 * INV_SQRT5],
    [INV_SQRT5, -2 * INV_SQRT5],
  ];
  return dirs.map(([ax, ay]) => {
    let maxProj = 0;
    for (const [vx, vy] of SIM_CONSTANTS.heroOctagonVerts) {
      const p = Math.abs(vx * ax + vy * ay);
      if (p > maxProj) maxProj = p;
    }
    return { x: ax, y: ay, heroExtent: maxProj };
  });
})();

export const HERO_HALF_W = HERO_SAT_AXES[0].heroExtent; // 48
export const HERO_HALF_H = HERO_SAT_AXES[1].heroExtent; // 24

function projectHeroOctagon(axisX: number, axisY: number): number {
  let maxProj = 0;
  for (const [vx, vy] of SIM_CONSTANTS.heroOctagonVerts) {
    const p = Math.abs(vx * axisX + vy * axisY);
    if (p > maxProj) maxProj = p;
  }
  return maxProj;
}

/**
 * Compute Minimum Translation Vector (MTV) to separate the hero octagon at (hx, hy)
 * from an obstacle (AABB or circular pillar). Returns null if not overlapping.
 */
function heroVsObstacleMtv(hx: number, hy: number, obs: ArenaObstacle): Vec2 | null {
  const dx = hx - obs.pos.x;
  const dy = hy - obs.pos.y;

  // Circular / cylindrical obstacle (pillar/statue with explicit radius)
  if (obs.radius !== undefined && obs.radius > 0 && obs.halfW === 0 && obs.halfH === 0) {
    const r = obs.radius;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 1e-5 ? dx / dist : 1;
    const ny = dist > 1e-5 ? dy / dist : 0;
    const heroExt = projectHeroOctagon(nx, ny);
    const overlap = heroExt + r - dist;
    if (overlap <= 0) return null;
    return { x: nx * overlap, y: ny * overlap };
  }

  // Convex SAT between beveled hero octagon and obstacle box (+ optional corner radius bevel)
  let minOverlap = Infinity;
  let bestAxisX = 0;
  let bestAxisY = 0;

  for (let i = 0; i < HERO_SAT_AXES.length; i++) {
    const axis = HERO_SAT_AXES[i];
    const boxExt = Math.abs(axis.x) * obs.halfW + Math.abs(axis.y) * obs.halfH;
    const centerDelta = dx * axis.x + dy * axis.y;
    const overlap = axis.heroExtent + boxExt - Math.abs(centerDelta);
    if (overlap <= 0) {
      return null;
    }
    if (overlap < minOverlap) {
      minOverlap = overlap;
      const sign = centerDelta < 0 ? -1 : 1;
      bestAxisX = axis.x * sign;
      bestAxisY = axis.y * sign;
    }
  }

  // If circular radius is also provided alongside halfW/halfH, refine corner push smoothly
  if (obs.radius !== undefined && obs.radius > 0) {
    const dist = Math.hypot(dx, dy);
    if (dist > 1e-5) {
      const nx = dx / dist;
      const ny = dy / dist;
      const heroExt = projectHeroOctagon(nx, ny);
      const overlap = heroExt + obs.radius - dist;
      if (overlap <= 0) {
        return null;
      }
      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestAxisX = nx;
        bestAxisY = ny;
      }
    }
  }

  return { x: bestAxisX * minOverlap, y: bestAxisY * minOverlap };
}

function doesObstacleBlockHero(obs: ArenaObstacle, isDashing: boolean): boolean {
  if (obs.kind === 'destructible_urn') {
    if (obs.hp !== undefined && obs.hp <= 0) return false;
    return !isDashing && obs.blocksMovement;
  }
  if (obs.kind === 'pit') {
    // Blink Dash safely crosses pit obstacles!
    return !isDashing;
  }
  return obs.blocksMovement;
}

export function breakDestructibleUrn(state: SimState, obs: ArenaObstacle): boolean {
  const idx = state.room.obstacles.indexOf(obs);
  if (idx === -1) return false;

  obs.hp = 0;
  obs.blocksMovement = false;
  obs.blocksProjectiles = false;
  state.room.obstacles.splice(idx, 1);

  state.events.push({
    type: 'damage',
    targetId: obs.id,
    targetKind: 'enemy',
    pos: { x: obs.pos.x, y: obs.pos.y },
    amount: 1,
    crit: false,
    backstab: false,
    armorBroken: false,
    wallSlam: false,
  });

  // Occasional golden amphora drop
  const noGoldCurse = state.player.chaosCurses.some((c) => c.curseKind === 'no_gold_gain');
  if (!noGoldCurse && chance(state, 0.22)) {
    const goldGain = 5;
    state.player.gold += goldGain;
    state.floatingNumbers.push({
      id: `fn_${state.tick}_${nextInt(state, 0, 999999)}`,
      pos: { x: obs.pos.x, y: obs.pos.y - 18 },
      vel: { x: 0, y: -60 },
      value: `+${goldGain}g`,
      kind: 'gold',
      colorHex: '#FFD54F',
      life: 0.75,
      maxLife: 0.75,
    });
  }

  return true;
}

export function breakUrnsInEllipse(
  state: SimState,
  center: Vec2,
  radius: number,
  scaleY: number = SIM_CONSTANTS.isoScaleY,
): number {
  let broken = 0;
  for (let i = state.room.obstacles.length - 1; i >= 0; i--) {
    const obs = state.room.obstacles[i];
    if (obs.kind !== 'destructible_urn' && !obs.destructible) continue;
    const d = ellipseDistance(obs.pos.x - center.x, obs.pos.y - center.y, scaleY);
    const pad = Math.max(obs.halfW, obs.radius ?? 22);
    if (d <= radius + pad) {
      if (breakDestructibleUrn(state, obs)) broken++;
    }
  }
  for (let i = state.room.hazards.length - 1; i >= 0; i--) {
    const h = state.room.hazards[i];
    if (h.kind !== 'urn' || !h.active) continue;
    const d = ellipseDistance(h.pos.x - center.x, h.pos.y - center.y, scaleY);
    if (d <= radius + h.radius) {
      h.active = false;
      h.hp = 0;
      broken++;
      state.events.push({
        type: 'damage',
        targetId: h.id,
        targetKind: 'enemy',
        pos: { x: h.pos.x, y: h.pos.y },
        amount: 1,
        crit: false,
        backstab: false,
        armorBroken: false,
        wallSlam: false,
      });
    }
  }
  return broken;
}

export function breakUrnsInCone(
  state: SimState,
  origin: Vec2,
  angle: number,
  range: number,
  arcDeg: number,
  scaleY: number = SIM_CONSTANTS.isoScaleY,
): number {
  let broken = 0;
  for (let i = state.room.obstacles.length - 1; i >= 0; i--) {
    const obs = state.room.obstacles[i];
    if (obs.kind !== 'destructible_urn' && !obs.destructible) continue;
    const pad = Math.max(obs.halfW, obs.radius ?? 22);
    if (
      isInEllipticalCone(
        obs.pos.x - origin.x,
        obs.pos.y - origin.y,
        angle,
        range + pad,
        arcDeg + 18,
        scaleY,
      )
    ) {
      if (breakDestructibleUrn(state, obs)) broken++;
    }
  }
  for (let i = state.room.hazards.length - 1; i >= 0; i--) {
    const h = state.room.hazards[i];
    if (h.kind !== 'urn' || !h.active) continue;
    if (
      isInEllipticalCone(
        h.pos.x - origin.x,
        h.pos.y - origin.y,
        angle,
        range + h.radius,
        arcDeg + 18,
        scaleY,
      )
    ) {
      h.active = false;
      h.hp = 0;
      broken++;
      state.events.push({
        type: 'damage',
        targetId: h.id,
        targetKind: 'enemy',
        pos: { x: h.pos.x, y: h.pos.y },
        amount: 1,
        crit: false,
        backstab: false,
        armorBroken: false,
        wallSlam: false,
      });
    }
  }
  return broken;
}

export interface HeroCollisionResult {
  pos: Vec2;
  collided: boolean;
  normal: Vec2;
}

/**
 * Swept octagonal hero collision against room.bounds and room.obstacles with smooth
 * corner sliding so the hero never snags on pillars or walls.
 */
export function resolveHeroCollision(
  state: SimState,
  targetPos: Vec2,
  isDashing: boolean,
): HeroCollisionResult {
  const startX = state.player.pos.x;
  const startY = state.player.pos.y;
  const totalDx = targetPos.x - startX;
  const totalDy = targetPos.y - startY;
  const totalDist = Math.hypot(totalDx, totalDy);

  const steps = Math.max(1, Math.ceil(totalDist / 16));
  let curX = startX;
  let curY = startY;
  let collided = false;
  let cornerNudged = false;
  let lastNormX = 0;
  let lastNormY = 0;

  const { bounds } = state.room;
  const minX = bounds.minX + HERO_HALF_W;
  const maxX = bounds.maxX - HERO_HALF_W;
  const minY = bounds.minY + HERO_HALF_H;
  const maxY = bounds.maxY - HERO_HALF_H;

  for (let step = 1; step <= steps; step++) {
    curX += totalDx / steps;
    curY += totalDy / steps;

    // Resolve obstacles iteratively (2 passes handles tight corners cleanly)
    for (let iter = 0; iter < 2; iter++) {
      for (let i = state.room.obstacles.length - 1; i >= 0; i--) {
        const obs = state.room.obstacles[i];
        const mtv = heroVsObstacleMtv(curX, curY, obs);
        if (!mtv) continue;

        // Dashing shatters destructible urns without blocking momentum
        if (isDashing && (obs.kind === 'destructible_urn' || obs.destructible)) {
          breakDestructibleUrn(state, obs);
          continue;
        }

        if (!doesObstacleBlockHero(obs, isDashing)) {
          continue;
        }

        curX += mtv.x;
        curY += mtv.y;
        const mLen = Math.hypot(mtv.x, mtv.y);
        if (mLen > 1e-5) {
          collided = true;
          lastNormX = mtv.x / mLen;
          lastNormY = mtv.y / mLen;

          // Silky corner-sliding nudge when grazing the outer bevel edge of a pillar or statue
          if (!isDashing && (obs.kind === 'pillar' || obs.kind === 'statue') && iter === 0) {
            const stepLen = totalDist / steps;
            if (Math.abs(lastNormX) > 0.9 && Math.abs(totalDx) > Math.abs(totalDy) * 1.5) {
              const offsetY = curY - obs.pos.y;
              const edgeThreshY = obs.halfH * 0.45;
              if (Math.abs(offsetY) > edgeThreshY) {
                curY += Math.sign(offsetY) * Math.min(stepLen * 0.95, mLen * 1.5);
                cornerNudged = true;
              }
            } else if (Math.abs(lastNormY) > 0.9 && Math.abs(totalDy) > Math.abs(totalDx) * 1.5) {
              const offsetX = curX - obs.pos.x;
              const edgeThreshX = obs.halfW * 0.45;
              if (Math.abs(offsetX) > edgeThreshX) {
                curX += Math.sign(offsetX) * Math.min(stepLen * 0.95, mLen * 1.5);
                cornerNudged = true;
              }
            }
          }
        }
      }
    }

    // Clamp to room bounds
    if (curX < minX) {
      curX = minX;
      collided = true;
      lastNormX = 1;
      lastNormY = 0;
    } else if (curX > maxX) {
      curX = maxX;
      collided = true;
      lastNormX = -1;
      lastNormY = 0;
    }
    if (curY < minY) {
      curY = minY;
      collided = true;
      lastNormX = 0;
      lastNormY = 1;
    } else if (curY > maxY) {
      curY = maxY;
      collided = true;
      lastNormX = 0;
      lastNormY = -1;
    }
  }

  state.player.pos.x = curX;
  state.player.pos.y = curY;

  // Slide velocity along collision tangent so corner contact never stalls movement
  if (collided && !isDashing && !cornerNudged) {
    const vn = state.player.vel.x * lastNormX + state.player.vel.y * lastNormY;
    if (vn < 0) {
      state.player.vel.x -= lastNormX * vn;
      state.player.vel.y -= lastNormY * vn;
    }
  }

  return {
    pos: { x: curX, y: curY },
    collided,
    normal: { x: lastNormX, y: lastNormY },
  };
}

/**
 * Resolve circle vs obstacle AABB/circle MTV (used for enemies and projectiles).
 */
export function circleVsObstacleMtv(cx: number, cy: number, radius: number, obs: ArenaObstacle): Vec2 | null {
  if (obs.radius !== undefined && obs.radius > 0 && obs.halfW === 0 && obs.halfH === 0) {
    const dx = cx - obs.pos.x;
    const dy = cy - obs.pos.y;
    const dist = Math.hypot(dx, dy);
    const minDist = radius + obs.radius;
    if (dist >= minDist) return null;
    const nx = dist > 1e-5 ? dx / dist : 1;
    const ny = dist > 1e-5 ? dy / dist : 0;
    const overlap = minDist - dist;
    return { x: nx * overlap, y: ny * overlap };
  }

  const closestX = Math.max(obs.pos.x - obs.halfW, Math.min(cx, obs.pos.x + obs.halfW));
  const closestY = Math.max(obs.pos.y - obs.halfH, Math.min(cy, obs.pos.y + obs.halfH));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq >= radius * radius) return null;

  if (distSq > 1e-8) {
    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    return { x: (dx / dist) * overlap, y: (dy / dist) * overlap };
  }

  // Center is inside box: push out via nearest edge
  const penLeft = cx - (obs.pos.x - obs.halfW);
  const penRight = obs.pos.x + obs.halfW - cx;
  const penTop = cy - (obs.pos.y - obs.halfH);
  const penBottom = obs.pos.y + obs.halfH - cy;
  const minPen = Math.min(penLeft, penRight, penTop, penBottom);

  if (minPen === penLeft) return { x: -(penLeft + radius), y: 0 };
  if (minPen === penRight) return { x: penRight + radius, y: 0 };
  if (minPen === penTop) return { x: 0, y: -(penTop + radius) };
  return { x: 0, y: penBottom + radius };
}

/**
 * Check if a projectile hits room bounds or a projectile-blocking obstacle.
 * Projectiles pass cleanly over 'pit' obstacles and shatter destructible urns.
 */
export function checkProjectileObstacleHit(
  state: SimState,
  pos: Vec2,
  radius: number,
): { hit: boolean; normal: Vec2; hitUrn: boolean } {
  const { bounds, obstacles } = state.room;

  if (pos.x - radius < bounds.minX) {
    return { hit: true, normal: { x: 1, y: 0 }, hitUrn: false };
  }
  if (pos.x + radius > bounds.maxX) {
    return { hit: true, normal: { x: -1, y: 0 }, hitUrn: false };
  }
  if (pos.y - radius < bounds.minY) {
    return { hit: true, normal: { x: 0, y: 1 }, hitUrn: false };
  }
  if (pos.y + radius > bounds.maxY) {
    return { hit: true, normal: { x: 0, y: -1 }, hitUrn: false };
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    if (obs.kind === 'pit') continue;
    if (!obs.blocksProjectiles && obs.kind !== 'destructible_urn') continue;

    const mtv = circleVsObstacleMtv(pos.x, pos.y, radius, obs);
    if (!mtv) continue;

    if (obs.kind === 'destructible_urn' || obs.destructible) {
      breakDestructibleUrn(state, obs);
      return { hit: false, normal: { x: 0, y: 0 }, hitUrn: true };
    }

    const len = Math.hypot(mtv.x, mtv.y);
    return {
      hit: true,
      normal: len > 1e-5 ? { x: mtv.x / len, y: mtv.y / len } : { x: 1, y: 0 },
      hitUrn: false,
    };
  }

  return { hit: false, normal: { x: 0, y: 0 }, hitUrn: false };
}

/**
 * Resolve enemy collision against room bounds and solid obstacles, computing
 * authentic Hades Wall-Slam damage (`0.01 * impactVel * BIOME_CONSTANTS[biome].wallSlamMultiplier`)
 * and emitting `{ type: 'damage', wallSlam: true }` + camera shake!
 *
 * Returns the wall-slam damage dealt (0 if no slam occurred).
 */
export function resolveEnemyWallSlam(
  state: SimState,
  enemy: EnemyState,
  prevPos: Vec2,
  newPos: Vec2,
): number {
  let x = newPos.x;
  let y = newPos.y;
  const r = Math.max(12, enemy.radius);
  const { bounds, obstacles } = state.room;

  let hitWall = false;
  let normX = 0;
  let normY = 0;

  // Obstacle collisions (solid pillars/walls/statues/gates; enemies also avoid pits when walking)
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (obs.kind === 'destructible_urn') continue;
    if (!obs.blocksMovement && obs.kind !== 'pit') continue;
    const mtv = circleVsObstacleMtv(x, y, r, obs);
    if (!mtv) continue;

    x += mtv.x;
    y += mtv.y;

    // Only solid walls/pillars/statues/gates cause wall-slam impact damage (not pits)
    if (obs.kind !== 'pit') {
      const mLen = Math.hypot(mtv.x, mtv.y);
      if (mLen > 1e-5) {
        hitWall = true;
        normX = mtv.x / mLen;
        normY = mtv.y / mLen;
      }
    }
  }

  // Room boundary collisions
  const minX = bounds.minX + r;
  const maxX = bounds.maxX - r;
  const minY = bounds.minY + r;
  const maxY = bounds.maxY - r;

  if (x < minX) {
    x = minX;
    hitWall = true;
    normX = 1;
    normY = 0;
  } else if (x > maxX) {
    x = maxX;
    hitWall = true;
    normX = -1;
    normY = 0;
  }
  if (y < minY) {
    y = minY;
    hitWall = true;
    normX = 0;
    normY = 1;
  } else if (y > maxY) {
    y = maxY;
    hitWall = true;
    normX = 0;
    normY = -1;
  }

  enemy.pos.x = x;
  enemy.pos.y = y;

  if (!hitWall) {
    return 0;
  }

  // Compute impact velocity into the wall: prefer explicit enemy.vel into the wall,
  // falling back to swept displacement speed if enemy.vel was not set by the caller.
  const velIntoWall = -(enemy.vel.x * normX + enemy.vel.y * normY);
  const dispX = newPos.x - prevPos.x;
  const dispY = newPos.y - prevPos.y;
  const dispVelIntoWall = -(dispX * normX + dispY * normY) * SIM_CONSTANTS.simHz;
  const impactVel = velIntoWall > 1 ? velIntoWall : dispVelIntoWall;

  // Reflect/damp velocity out of wall
  if (velIntoWall > 0) {
    enemy.vel.x = (enemy.vel.x + normX * velIntoWall * 1.35) * 0.4;
    enemy.vel.y = (enemy.vel.y + normY * velIntoWall * 1.35) * 0.4;
  }

  // Wall-slam requires meaningful knockback impact (>= 200 u/s)
  if (
    impactVel < 200 ||
    enemy.hp <= 0 ||
    enemy.aiState === 'dead' ||
    enemy.invulnerable ||
    enemy.invulnTimer > 0
  ) {
    return 0;
  }

  const biomeMult = BIOME_CONSTANTS[state.room.biome].wallSlamMultiplier;
  let wallSlamBonusMult = 1.0;
  // Support Tidebreaker Breaking Wave / Typhoons Fury wall-slam amplification if held
  for (let i = 0; i < state.player.boons.length; i++) {
    const b = state.player.boons[i];
    if (
      b.patronId === 'tidebreaker' &&
      b.slot === 'passive' &&
      (b.id.includes('slam') || b.id.includes('barrier') || b.id.includes('typhoon') || b.id.includes('breaking'))
    ) {
      wallSlamBonusMult += b.scaledValue <= 5 ? b.scaledValue : b.scaledValue / 100;
    }
  }

  const rawDamage =
    COMBAT_CONSTANTS.wallSlamDamagePerVelocity * impactVel * biomeMult * wallSlamBonusMult;
  const dmg = Math.max(1, Math.round(rawDamage));

  let armorBroken = false;
  if (enemy.armor > 0) {
    const prevArmor = enemy.armor;
    enemy.armor = Math.max(0, enemy.armor - dmg);
    const overflow = Math.max(0, dmg - prevArmor);
    if (overflow > 0) {
      enemy.hp = Math.max(0, enemy.hp - overflow);
    }
    if (enemy.armor === 0) {
      armorBroken = true;
      enemy.stunTimer = Math.max(enemy.stunTimer, COMBAT_CONSTANTS.armorBreakStun);
      if (!enemy.isBoss) {
        enemy.aiState = 'stunned';
      }
    }
  } else {
    enemy.hp = Math.max(0, enemy.hp - dmg);
    if (!enemy.isBoss && enemy.hp > 0) {
      enemy.stunTimer = Math.max(enemy.stunTimer, 0.25);
      enemy.aiState = 'stunned';
    }
  }

  enemy.hitFlashTimer = 0.12;
  state.run.damageDealt += dmg;

  state.events.push({
    type: 'damage',
    targetId: enemy.id,
    targetKind: 'enemy',
    pos: { x: enemy.pos.x, y: enemy.pos.y },
    amount: dmg,
    crit: false,
    backstab: false,
    armorBroken,
    wallSlam: true,
  });

  state.floatingNumbers.push({
    id: `fn_${state.tick}_${nextInt(state, 0, 999999)}`,
    pos: { x: enemy.pos.x, y: enemy.pos.y - 26 },
    vel: { x: normX * 45, y: -95 },
    value: dmg,
    kind: armorBroken ? 'armor' : 'normal',
    colorHex: '#FFB74D',
    life: 0.85,
    maxLife: 0.85,
  });

  const shakeIntensity = Math.min(14, 4.5 + dmg * 0.14);
  const shakeDuration = 0.18;
  state.camera.shakeIntensity = Math.max(state.camera.shakeIntensity, shakeIntensity);
  state.camera.shakeTimer = Math.max(state.camera.shakeTimer, shakeDuration);
  state.events.push({
    type: 'camera_shake',
    intensity: shakeIntensity,
    duration: shakeDuration,
  });

  // Handle enemy death caused directly by wall slam
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.aiState = 'dead';
    state.run.kills += 1;

    // Drop any lodged Bloodstones
    while (enemy.lodgedCasts > 0) {
      enemy.lodgedCasts -= 1;
      enemy.lodgedCastTimers.pop();
      state.room.bloodstones.push({
        id: `bs_${state.tick}_${nextInt(state, 0, 999999)}`,
        pos: { x: enemy.pos.x, y: enemy.pos.y },
        vel: { x: normX * 140, y: normY * 140 },
        life: 0,
        magnetizing: false,
      });
    }

    const finalInRoom =
      enemy.archetype !== 'rattlebones_dummy' &&
      state.room.waveIndex >= state.room.totalWaves &&
      state.enemies.every((e) => e.hp <= 0 || e.aiState === 'dead');

    if (finalInRoom) {
      state.run.finalKillSlowTimer =
        COMBAT_CONSTANTS.finalKillSlowDuration + COMBAT_CONSTANTS.finalKillSlowLerpOut;
      state.timeScale = COMBAT_CONSTANTS.finalKillSlowScale;
    }

    state.events.push({
      type: 'enemy_death',
      enemyId: enemy.id,
      archetype: enemy.archetype,
      pos: { x: enemy.pos.x, y: enemy.pos.y },
      isBoss: enemy.isBoss,
      finalInRoom,
    });
  }

  return dmg;
}

/**
 * Soft separation between non-dashing hero and living enemies so hitboxes stay clean.
 */
export function resolveHeroEnemySeparation(state: SimState): void {
  if (state.player.dashTimer > 0) return;

  const px = state.player.pos.x;
  const py = state.player.pos.y;
  const heroRadius = 30;

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0 || e.aiState === 'dead' || e.aiState === 'spawning') continue;

    const dx = px - e.pos.x;
    const dy = (py - e.pos.y) / SIM_CONSTANTS.isoScaleY;
    const dist = Math.hypot(dx, dy);
    const minDist = heroRadius + Math.max(18, e.radius * 0.75);

    if (dist > 0.001 && dist < minDist) {
      const push = (minDist - dist) * 0.35;
      const nx = dx / dist;
      const ny = (dy / dist) * SIM_CONSTANTS.isoScaleY;
      state.player.pos.x += nx * push * 0.6;
      state.player.pos.y += ny * push * 0.6;
      if (!e.isBoss && e.archetype !== 'rattlebones_dummy') {
        e.pos.x -= nx * push * 0.4;
        e.pos.y -= ny * push * 0.4;
      }
    }
  }
}

export function isPointInsideRoomBounds(room: RoomState, pos: Vec2, padding: number = 0): boolean {
  return (
    pos.x >= room.bounds.minX + padding &&
    pos.x <= room.bounds.maxX - padding &&
    pos.y >= room.bounds.minY + padding &&
    pos.y <= room.bounds.maxY - padding
  );
}
