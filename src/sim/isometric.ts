import { SIM_CONSTANTS, type Vec2 } from '../contracts/index.js';

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

/**
 * 2:1 isometric projection: maps world (x, y) to screen-space isometric (x, y).
 * Default scaleY=0.5 gives exact 2:1 projection; pass SIM_CONSTANTS.isoScaleY (0.56)
 * when matching retail foreshortening.
 */
export function worldToIso(pos: Vec2, scaleY: number = 0.5): Vec2 {
  return {
    x: pos.x - pos.y,
    y: (pos.x + pos.y) * scaleY,
  };
}

/**
 * Exact inverse of worldToIso for any non-zero scaleY.
 */
export function isoToWorld(iso: Vec2, scaleY: number = 0.5): Vec2 {
  const sy = scaleY === 0 ? 0.5 : scaleY;
  const sum = iso.y / sy;
  return {
    x: (iso.x + sum) * 0.5,
    y: (sum - iso.x) * 0.5,
  };
}

/**
 * Elliptical distance in foreshortened isometric space (default scaleY = 0.56).
 * Points with ellipseDistance(dx, dy, scaleY) <= R lie inside the isometric circle of radius R.
 */
export function ellipseDistance(
  dx: number,
  dy: number,
  scaleY: number = SIM_CONSTANTS.isoScaleY,
): number {
  const sy = scaleY <= 0 ? SIM_CONSTANTS.isoScaleY : scaleY;
  return Math.hypot(dx, dy / sy);
}

/**
 * Normalize an angle in radians to [-PI, PI).
 */
export function normalizeAngle(angle: number): number {
  let a = (angle + Math.PI) % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a - Math.PI;
}

/**
 * Shortest signed angular difference from `from` to `to` in [-PI, PI].
 */
export function shortestAngleDelta(from: number, to: number): number {
  let diff = (to - from + Math.PI) % TWO_PI;
  if (diff < 0) diff += TWO_PI;
  diff -= Math.PI;
  return diff;
}

/**
 * Quantize an angle in radians into one of 32 discrete sprite facing indices (0..31).
 */
export function angleToFacingIdx(angle: number): number {
  const norm = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
  const idx = Math.round((norm / TWO_PI) * SIM_CONSTANTS.numAngles);
  return idx % SIM_CONSTANTS.numAngles;
}

/**
 * Rotate angle `cur` toward `target` at up to `degPerSec` degrees per second over `dt`.
 * Retail constants: SIM_CONSTANTS.cosmeticRotationSpeed (1340), combatRotationSpeed (216000).
 */
export function rotateAngleToward(
  cur: number,
  target: number,
  degPerSec: number,
  dt: number,
): number {
  if (dt <= 0 || degPerSec <= 0) return normalizeAngle(cur);
  const delta = shortestAngleDelta(cur, target);
  const maxStep = degPerSec * DEG_TO_RAD * dt;
  if (Math.abs(delta) <= maxStep) {
    return normalizeAngle(target);
  }
  return normalizeAngle(cur + Math.sign(delta) * maxStep);
}

/**
 * Check if offset (dx, dy) lies within an elliptical arc/cone centered on `aimAngle`.
 */
export function isInEllipticalCone(
  dx: number,
  dy: number,
  aimAngle: number,
  range: number,
  arcDeg: number,
  scaleY: number = SIM_CONSTANTS.isoScaleY,
): boolean {
  const dist = ellipseDistance(dx, dy, scaleY);
  if (dist > range) return false;
  if (dist < 1e-4) return true;
  if (arcDeg >= 360) return true;
  const targetAngle = Math.atan2(dy, dx);
  const halfArcRad = (arcDeg * 0.5) * DEG_TO_RAD;
  return Math.abs(shortestAngleDelta(aimAngle, targetAngle)) <= halfArcRad;
}
