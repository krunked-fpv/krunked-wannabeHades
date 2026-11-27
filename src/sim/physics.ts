import {
  PATRON_CONSTANTS,
  PLAYER_CONSTANTS,
  SIM_CONSTANTS,
  type InputFrame,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import { getAspectBonus, getAspectRank } from '../data/aspects.js';
import { hasHammer } from '../data/hammers.js';
import { breakUrnsInEllipse, resolveHeroCollision } from './collision.js';
import {
  addCameraShake,
  dealDamageToEnemy,
  dealDamageToPlayer,
  deflectProjectiles,
  getBoonInSlot,
  spawnFloatingNumber,
  type SimCombatContext,
  type SimGameplayHooks,
} from './combat.js';
import {
  angleToFacingIdx,
  ellipseDistance,
  normalizeAngle,
  rotateAngleToward,
} from './isometric.js';
import { getChillSpeedMultiplier } from './status.js';

const DASH_EASE_EXP = 1 + PLAYER_CONSTANTS.dashEaseOut; // 1.8

/**
 * Compute desired hero aim angle with authentic Hades aim-assist reticle magnetism
 * (PLAYER_CONSTANTS.reticleMagnetismDistance = 100) for gamepad, touch, or keyboard-only play.
 */
export function computeAimAngle(state: SimState, input: InputFrame): number {
  const player = state.player;

  // Explicit mouse cursor world target: honor cursor direction directly
  if (input.hasAimWorld) {
    const dx = input.aimWorldX - player.pos.x;
    const dy = input.aimWorldY - player.pos.y;
    if (dx * dx + dy * dy > 1) {
      return Math.atan2(dy, dx);
    }
  }

  // Soft aim direction from right stick / touch aim / movement direction
  let rawX = input.aimDirX;
  let rawY = input.aimDirY;
  let rawLen = Math.hypot(rawX, rawY);

  if (rawLen < 0.15) {
    const mLen = Math.hypot(input.moveX, input.moveY);
    if (mLen >= 0.15) {
      rawX = input.moveX / mLen;
      rawY = input.moveY / mLen;
      rawLen = 1;
    } else {
      rawX = Math.cos(player.facingAngle);
      rawY = Math.sin(player.facingAngle);
      rawLen = 1;
    }
  } else {
    rawX /= rawLen;
    rawY /= rawLen;
  }

  const baseAngle = Math.atan2(rawY, rawX);

  // Reticle magnetism snaps soft aim toward nearest enemy along/near the aim ray
  const magnetDist = PLAYER_CONSTANTS.reticleMagnetismDistance;
  let bestScore = Infinity;
  let bestAngle: number | null = null;

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0 || e.aiState === 'dead') continue;

    const dx = e.pos.x - player.pos.x;
    const dy = e.pos.y - player.pos.y;
    const along = dx * rawX + dy * rawY;
    const perp = Math.abs(dx * -rawY + dy * rawX);
    const dist = Math.hypot(dx, dy);

    const withinRay = along > -16 && along <= 680 && perp <= magnetDist + e.radius;
    const withinCloseAura = dist <= magnetDist * 1.45 + e.radius;

    if (!withinRay && !withinCloseAura) continue;

    const score = perp + Math.max(0, along) * 0.22;
    if (score < bestScore) {
      bestScore = score;
      bestAngle = Math.atan2(dy, dx);
    }
  }

  return bestAngle !== null ? normalizeAngle(bestAngle) : normalizeAngle(baseAngle);
}

/**
 * Checks whether initiating a dash right now is a Perfect Dash (near-miss dodge
 * against an incoming hostile projectile, enemy attack/windup, or active telegraph).
 */
function checkPerfectDashNearMiss(state: SimState): boolean {
  const px = state.player.pos.x;
  const py = state.player.pos.y;

  // 1. Nearby hostile projectiles
  for (let i = 0; i < state.projectiles.length; i++) {
    const pr = state.projectiles[i];
    if (pr.owner === 'player') continue;
    const d = ellipseDistance(pr.pos.x - px, pr.pos.y - py);
    if (d <= 125 + pr.radius) {
      return true;
    }
  }

  // 2. Nearby enemies actively winding up or attacking
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0 || e.aiState === 'dead') continue;
    if (e.aiState !== 'windup' && e.aiState !== 'attack') continue;
    const d = ellipseDistance(e.pos.x - px, e.pos.y - py);
    if (d <= 175 + e.radius) {
      return true;
    }
  }

  // 3. Standing inside a danger telegraph
  for (let i = 0; i < state.room.telegraphs.length; i++) {
    const t = state.room.telegraphs[i];
    if (t.progress < 0.35) continue;
    const d = ellipseDistance(t.pos.x - px, t.pos.y - py);
    if (d <= t.radius + 36) {
      return true;
    }
  }

  return false;
}

/**
 * Compute effective max run speed factoring Aspects, Boons, Plume, Chill, and Chaos Curses.
 */
function computeEffectiveRunSpeed(state: SimState): number {
  const player = state.player;
  let mult = 1.0;

  if (player.aspectId === 'blade_scion') {
    const rank = getAspectRank(state.meta.aspectRanks, 'blade_scion');
    mult += getAspectBonus('blade_scion', rank);
  }

  mult += player.plumeBonus;

  // Veloce speed passive boons
  for (let i = 0; i < player.boons.length; i++) {
    const b = player.boons[i];
    if (b.patronId === 'veloce' && b.slot === 'passive' && b.id.includes('speed')) {
      mult += b.scaledValue <= 1 ? b.scaledValue : b.scaledValue / 100;
    }
  }

  // Ferocious Guard speed buff
  if (player.eruptBuffTimer > 0 && hasHammer(player, 'hammer_shield_ferocious_guard')) {
    mult += 0.2;
  }

  // Chaos reduced move speed curse
  for (let i = 0; i < player.chaosCurses.length; i++) {
    const c = player.chaosCurses[i];
    if (c.curseKind === 'reduced_move_speed') {
      mult *= Math.max(0.4, 1 - (c.curseMagnitude <= 1 ? c.curseMagnitude : c.curseMagnitude / 100));
    }
  }

  // Chill status slow
  mult *= getChillSpeedMultiplier(player.statuses);

  return PLAYER_CONSTANTS.speed * mult;
}

function computeDashRange(state: SimState): number {
  const player = state.player;
  let range: number = PLAYER_CONSTANTS.dashRange;
  if (hasHammer(player, 'hammer_spear_serrated_point')) {
    range *= 0.75;
  }
  return Math.min(PLAYER_CONSTANTS.dashMaxRange, range);
}

/**
 * Built-in standalone Dash Boon fallback when no SimGameplayHooks.onPlayerDash is attached.
 */
function runFallbackDashBoon(
  state: SimState,
  pos: Vec2,
  ctx: SimCombatContext,
): void {
  const dashBoon = getBoonInSlot(state.player, 'dash');
  if (!dashBoon) return;

  switch (dashBoon.patronId) {
    case 'aegira': {
      deflectProjectiles(state, pos, 145, 0, 360);
      const baseDmg = dashBoon.scaledValue >= 10 ? dashBoon.scaledValue : 24;
      for (let i = 0; i < state.enemies.length; i++) {
        const e = state.enemies[i];
        if (e.hp <= 0 || e.aiState === 'dead') continue;
        if (ellipseDistance(e.pos.x - pos.x, e.pos.y - pos.y) <= 145 + e.radius) {
          ctx.dealDamageToEnemy(state, e, {
            baseDamage: baseDmg,
            source: 'dash',
            knockback: 450,
            patronId: 'aegira',
            statusId: 'exposed',
          });
        }
      }
      break;
    }
    case 'tidebreaker': {
      const baseDmg = dashBoon.scaledValue >= 10 ? dashBoon.scaledValue : 35;
      for (let i = 0; i < state.enemies.length; i++) {
        const e = state.enemies[i];
        if (e.hp <= 0 || e.aiState === 'dead') continue;
        if (ellipseDistance(e.pos.x - pos.x, e.pos.y - pos.y) <= 195 + e.radius) {
          ctx.dealDamageToEnemy(state, e, {
            baseDamage: baseDmg,
            source: 'dash',
            knockback: 1400,
            patronId: 'tidebreaker',
            statusId: 'ruptured',
          });
        }
      }
      break;
    }
    case 'voltaris': {
      const baseDmg = dashBoon.scaledValue >= 10 ? dashBoon.scaledValue : 22;
      let nearestIdx = -1;
      let bestDist = 280;
      for (let i = 0; i < state.enemies.length; i++) {
        const e = state.enemies[i];
        if (e.hp <= 0 || e.aiState === 'dead') continue;
        const d = ellipseDistance(e.pos.x - pos.x, e.pos.y - pos.y);
        if (d < bestDist) {
          bestDist = d;
          nearestIdx = i;
        }
      }
      if (nearestIdx !== -1) {
        ctx.dealDamageToEnemy(state, state.enemies[nearestIdx], {
          baseDamage: baseDmg,
          source: 'dash',
          patronId: 'voltaris',
          statusId: 'jolted',
        });
      }
      break;
    }
    case 'velouris': {
      const baseDmg = dashBoon.scaledValue >= 10 ? dashBoon.scaledValue : 25;
      for (let i = 0; i < state.enemies.length; i++) {
        const e = state.enemies[i];
        if (e.hp <= 0 || e.aiState === 'dead') continue;
        if (ellipseDistance(e.pos.x - pos.x, e.pos.y - pos.y) <= 175 + e.radius) {
          ctx.dealDamageToEnemy(state, e, {
            baseDamage: baseDmg,
            source: 'dash',
            patronId: 'velouris',
            statusId: 'weak',
          });
        }
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Step player locomotion, acceleration/grip, backpedal modifier, aim rotation,
 * Blink Dash (0.21s / 13 ticks, easeOut 0.8, 300u range, 3 dashGhosts, pit crossing,
 * attack-recovery cancel, Perfect Dash near-miss), and dash-ghost fading.
 */
export function stepPlayerPhysics(
  state: SimState,
  input: InputFrame,
  dt: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const player = state.player;
  if (player.isDead || dt <= 0) return;

  // 1. Decay dash/invulnerability/buff timers
  if (player.dashCooldown > 0) {
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  }
  if (player.dashStrikeWindowTimer > 0) {
    player.dashStrikeWindowTimer = Math.max(0, player.dashStrikeWindowTimer - dt);
  }
  if (player.perfectDashTimer > 0) {
    player.perfectDashTimer = Math.max(0, player.perfectDashTimer - dt);
  }
  if (player.iframeTimer > 0) {
    player.iframeTimer = Math.max(0, player.iframeTimer - dt);
  }
  if (player.cumulativeDamageWindowTimer > 0) {
    player.cumulativeDamageWindowTimer = Math.max(0, player.cumulativeDamageWindowTimer - dt);
    if (player.cumulativeDamageWindowTimer === 0) {
      player.cumulativeDamageInWindow = 0;
    }
  }
  if (player.eruptBuffTimer > 0) {
    player.eruptBuffTimer = Math.max(0, player.eruptBuffTimer - dt);
  }
  if (player.godCallActiveTimer > 0) {
    player.godCallActiveTimer = Math.max(0, player.godCallActiveTimer - dt);
    if (player.godCallActiveTimer === 0) {
      player.godCallPatron = null;
    }
  }

  // Fade existing dash ghosts
  for (let i = player.dashGhosts.length - 1; i >= 0; i--) {
    const g = player.dashGhosts[i];
    g.life -= dt;
    g.alpha = Math.max(0, g.life / 0.24);
    if (g.life <= 0) {
      player.dashGhosts.splice(i, 1);
    }
  }

  // 2. Regenerate Dash clip after dashClipRegenInterval (0.74s) when not mid-dash
  if (player.dashTimer <= 0 && player.dashCharges < player.maxDashCharges) {
    player.dashRegenTimer -= dt;
    if (player.dashRegenTimer <= 0) {
      player.dashCharges = player.maxDashCharges;
      player.dashRegenTimer = 0;
    }
  }

  // Normalize movement input
  let moveX = input.moveX;
  let moveY = input.moveY;
  const moveMag = Math.hypot(moveX, moveY);
  if (moveMag > 1) {
    moveX /= moveMag;
    moveY /= moveMag;
  }
  const hasMoveInput = moveMag > 0.08;

  // 3. Trigger Blink Dash on dashPressed
  if (
    input.dashPressed &&
    player.dashCharges > 0 &&
    player.dashCooldown <= 0 &&
    player.dashTimer <= 0
  ) {
    // Dash immediately cancels attack recovery & windup (authentic Hades feel!)
    player.attackTimer = 0;
    player.attackChargeTimer = 0;
    player.attackBufferTimer = 0;
    player.isBlocking = false;

    const dirX = hasMoveInput ? moveX / Math.min(1, moveMag) : Math.cos(player.facingAngle);
    const dirY = hasMoveInput ? moveY / Math.min(1, moveMag) : Math.sin(player.facingAngle);
    const dLen = Math.hypot(dirX, dirY) || 1;
    const ndx = dirX / dLen;
    const ndy = dirY / dLen;
    const dashAngle = Math.atan2(ndy, ndx);

    const perfect = checkPerfectDashNearMiss(state);
    const startPos: Vec2 = { x: player.pos.x, y: player.pos.y };
    const range = computeDashRange(state);
    const projectedEndPos: Vec2 = {
      x: startPos.x + ndx * range,
      y: startPos.y + ndy * range,
    };

    player.dashCharges -= 1;
    player.dashRegenTimer = PLAYER_CONSTANTS.dashClipRegenInterval;
    player.dashCooldown = PLAYER_CONSTANTS.dashCooldown;
    player.dashTimer = PLAYER_CONSTANTS.dashDuration;
    player.dashDir = { x: ndx, y: ndy };
    player.dashStartPos = startPos;
    player.dashStrikeWindowTimer = PLAYER_CONSTANTS.dashStrikeWindow;
    player.facingAngle = normalizeAngle(dashAngle);
    player.facingIdx = angleToFacingIdx(player.facingAngle);

    if (perfect) {
      const ruthless =
        state.meta.mirrorActiveSide.greater_reflex === 'b' &&
        (state.meta.mirrorRanks.greater_reflex ?? 0) > 0;
      const dur = ruthless ? 2.0 : PLAYER_CONSTANTS.perfectDashHitDisableDuration;
      player.perfectDashTimer = Math.max(player.perfectDashTimer, dur);
      spawnFloatingNumber(state, player.pos, 'PERFECT DASH!', 'dodge', '#7DF9FF');
      addCameraShake(state, 3.5, 0.1);
    }

    // Spawn initial dash ghost
    player.dashGhosts.push({
      x: startPos.x,
      y: startPos.y,
      angle: dashAngle,
      alpha: 0.78,
      life: 0.24,
    });

    // Chaos curse: take damage on dash
    for (let i = 0; i < player.chaosCurses.length; i++) {
      const c = player.chaosCurses[i];
      if (c.curseKind === 'take_damage_on_dash') {
        dealDamageToPlayer(state, Math.max(1, c.curseMagnitude), { source: 'chaos', ignoreIframes: true });
      }
    }

    const dashBoon = getBoonInSlot(player, 'dash');
    state.events.push({
      type: 'dash',
      pos: startPos,
      endPos: projectedEndPos,
      angle: dashAngle,
      perfect,
      patronId: dashBoon?.patronId,
    });

    // Aegira Divine Dash deflects projectiles immediately on departure
    if (dashBoon?.patronId === 'aegira') {
      deflectProjectiles(state, startPos, 145, 0, 360);
    }

    if (hooks?.onPlayerDash) {
      hooks.onPlayerDash(state, startPos, projectedEndPos, perfect, ctx);
    } else if (dashBoon) {
      runFallbackDashBoon(state, startPos, ctx);
    }
  }

  // 4. Execute Blink Dash eased trajectory (dashDuration = 0.21s, easeOut = 0.8, range = 300)
  if (player.dashTimer > 0) {
    const duration = PLAYER_CONSTANTS.dashDuration;
    const range = computeDashRange(state);
    const prevElapsed = Math.max(0, duration - player.dashTimer);
    const nextRemaining = Math.max(0, player.dashTimer - dt);
    const nextElapsed = Math.min(duration, duration - nextRemaining);

    const u0 = prevElapsed / duration;
    const u1 = nextElapsed / duration;

    // Ease-out curve s(u) = 1 - (1 - u)^(1 + dashEaseOut), integrates cleanly to 1.0
    const s0 = 1 - Math.pow(1 - u0, DASH_EASE_EXP);
    const s1 = 1 - Math.pow(1 - u1, DASH_EASE_EXP);
    const stepDist = range * (s1 - s0);

    const targetPos: Vec2 = {
      x: player.pos.x + player.dashDir.x * stepDist,
      y: player.pos.y + player.dashDir.y * stepDist,
    };

    resolveHeroCollision(state, targetPos, true);
    breakUrnsInEllipse(state, player.pos, 52);

    // Maintain instantaneous velocity vector for telemetry & touchdown retention
    const instSpeed = stepDist / dt;
    player.vel.x = player.dashDir.x * instSpeed;
    player.vel.y = player.dashDir.y * instSpeed;

    // Spawn remaining dash ghosts evenly across the blink (total 3 ghosts per dash)
    const ghostMarks = [0.35, 0.7];
    for (let i = 0; i < ghostMarks.length; i++) {
      const m = ghostMarks[i];
      if (u0 < m && u1 >= m && player.dashGhosts.length < PLAYER_CONSTANTS.dashGhosts * 2) {
        player.dashGhosts.push({
          x: player.pos.x,
          y: player.pos.y,
          angle: player.facingAngle,
          alpha: 0.72,
          life: 0.22,
        });
      }
    }

    // Continuous deflect trail during Aegira Divine Dash
    const dashBoon = getBoonInSlot(player, 'dash');
    if (dashBoon?.patronId === 'aegira') {
      deflectProjectiles(state, player.pos, 130, 0, 360);
    }

    player.dashTimer = nextRemaining;

    // Dash Touchdown: retain touchdownVelocityRetention (0.7) of run speed and ensure not resting on a pit
    if (player.dashTimer <= 0) {
      const runSpeed = computeEffectiveRunSpeed(state);
      const retainedSpeed = runSpeed * PLAYER_CONSTANTS.touchdownVelocityRetention;
      player.vel.x = player.dashDir.x * retainedSpeed;
      player.vel.y = player.dashDir.y * retainedSpeed;
      // Push smoothly onto solid ledge if dash ended directly over a pit
      resolveHeroCollision(state, player.pos, false);

      // Destination burst for Tidebreaker / Velouris fallback dash boon
      if (!hooks?.onPlayerDash && dashBoon && (dashBoon.patronId === 'tidebreaker' || dashBoon.patronId === 'velouris')) {
        runFallbackDashBoon(state, player.pos, ctx);
      }
    }
    return;
  }

  // 5. Standard Locomotion (speed=540, accel=2000, grip=1000, backpedal=0.34, fullControl=400)
  const effectiveSpeed = computeEffectiveRunSpeed(state);
  const isPerformingAction =
    player.attackTimer > 0 ||
    player.attackChargeTimer > 0 ||
    player.specialTimer > 0 ||
    player.castChargeTimer > 0 ||
    player.isBlocking;

  let desiredVx = 0;
  let desiredVy = 0;

  if (hasMoveInput) {
    let moveSpeed = effectiveSpeed;

    // Backpedal modifier when moving opposite to facing direction during combat action/aim
    const faceX = Math.cos(player.facingAngle);
    const faceY = Math.sin(player.facingAngle);
    const moveDotFace = (moveX * faceX + moveY * faceY) / Math.max(0.001, Math.min(1, moveMag));
    if (isPerformingAction) {
      moveSpeed *= moveDotFace < -0.25 ? PLAYER_CONSTANTS.backpedalSpeedModifier : 0.45;
    } else if (input.hasAimWorld && moveDotFace < -0.5 && (input.attack || input.cast)) {
      moveSpeed *= PLAYER_CONSTANTS.backpedalSpeedModifier;
    }

    desiredVx = moveX * moveSpeed;
    desiredVy = moveY * moveSpeed;

    const curSpeed = Math.hypot(player.vel.x, player.vel.y);
    const dvx = desiredVx - player.vel.x;
    const dvy = desiredVy - player.vel.y;
    const dvLen = Math.hypot(dvx, dvy);

    // Extra grip when reversing direction or below fullControlVelocityThreshold (400) for crisp Hades feel
    const dotCurDes = curSpeed > 1 ? (player.vel.x * desiredVx + player.vel.y * desiredVy) / curSpeed : 0;
    let accelRate: number = PLAYER_CONSTANTS.acceleration;
    if (dotCurDes < 0) {
      accelRate += PLAYER_CONSTANTS.grip * 2.0;
    } else if (curSpeed < PLAYER_CONSTANTS.fullControlVelocityThreshold) {
      accelRate += PLAYER_CONSTANTS.grip * 0.85;
    }

    const maxStep = accelRate * dt;
    if (dvLen <= maxStep) {
      player.vel.x = desiredVx;
      player.vel.y = desiredVy;
    } else {
      player.vel.x += (dvx / dvLen) * maxStep;
      player.vel.y += (dvy / dvLen) * maxStep;
    }
  } else {
    // Grip braking to crisp stop
    const curSpeed = Math.hypot(player.vel.x, player.vel.y);
    if (curSpeed > 0.001) {
      const brakeRate =
        curSpeed <= PLAYER_CONSTANTS.fullControlVelocityThreshold
          ? PLAYER_CONSTANTS.grip * 2.6
          : PLAYER_CONSTANTS.grip * 1.4;
      const drop = brakeRate * dt;
      if (drop >= curSpeed) {
        player.vel.x = 0;
        player.vel.y = 0;
      } else {
        const scale = (curSpeed - drop) / curSpeed;
        player.vel.x *= scale;
        player.vel.y *= scale;
      }
    }
  }

  // Integrate hero displacement with swept octagonal collision & silky pillar sliding
  const nextPos: Vec2 = {
    x: player.pos.x + player.vel.x * dt,
    y: player.pos.y + player.vel.y * dt,
  };
  resolveHeroCollision(state, nextPos, false);

  // 6. Cosmetic Facing Rotation (1340 deg/s while moving; combat snap happens on weapon fire)
  if (!isPerformingAction) {
    if (hasMoveInput) {
      const moveAngle = Math.atan2(moveY, moveX);
      player.facingAngle = rotateAngleToward(
        player.facingAngle,
        moveAngle,
        SIM_CONSTANTS.cosmeticRotationSpeed,
        dt,
      );
      player.facingIdx = angleToFacingIdx(player.facingAngle);
    } else if (input.hasAimWorld) {
      const aimAngle = computeAimAngle(state, input);
      player.facingAngle = rotateAngleToward(
        player.facingAngle,
        aimAngle,
        SIM_CONSTANTS.cosmeticRotationSpeed,
        dt,
      );
      player.facingIdx = angleToFacingIdx(player.facingAngle);
    }
  }
}
