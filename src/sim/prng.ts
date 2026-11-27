import type { SimState } from '../contracts/index.js';

/**
 * Deterministic PRNG utilities powered by mulberry32, mutating state.rngState.
 * Pure, reproducible randomness with zero non-deterministic calls anywhere in simulation.
 */

export function seedRng(seed: number): number {
  let s = (Math.trunc(seed) | 0) >>> 0;
  s = (s + 0x9e3779b9) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x85ebca6b) >>> 0;
  s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35) >>> 0;
  s = (s ^ (s >>> 16)) >>> 0;
  return s === 0 ? 0x6d2b79f5 : s;
}

export function nextFloat(state: SimState): number {
  let t = (state.rngState = (state.rngState + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(state: SimState, min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  if (lo >= hi) return lo;
  return lo + Math.floor(nextFloat(state) * (hi - lo + 1));
}

export function chance(state: SimState, p: number): boolean {
  if (p <= 0) return false;
  if (p >= 1) return true;
  return nextFloat(state) < p;
}

export function pick<T>(state: SimState, arr: readonly T[]): T {
  if (arr.length === 0) {
    throw new Error('pick() called with empty array');
  }
  const idx = Math.floor(nextFloat(state) * arr.length);
  return arr[idx < arr.length ? idx : arr.length - 1];
}

export function nextRange(state: SimState, min: number, max: number): number {
  return min + nextFloat(state) * (max - min);
}
