import type { SimState } from '../contracts/index.js';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function mixByte(h: number, b: number): number {
  return Math.imul((h ^ (b & 0xff)) >>> 0, FNV_PRIME) >>> 0;
}

function mixInt32(h: number, v: number): number {
  const n = v | 0;
  h = mixByte(h, n & 0xff);
  h = mixByte(h, (n >>> 8) & 0xff);
  h = mixByte(h, (n >>> 16) & 0xff);
  h = mixByte(h, (n >>> 24) & 0xff);
  return h;
}

function mixNum(h: number, v: number): number {
  if (!Number.isFinite(v)) {
    return mixInt32(h, 0);
  }
  // Quantize to thousandths and collapse -0 to 0 for bit-stable cross-platform hashing
  const q = Math.round(v * 1000);
  return mixInt32(h, q === 0 ? 0 : q);
}

function mixStr(h: number, s: string): number {
  h = mixInt32(h, s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = mixByte(h, c & 0xff);
    if (c > 0xff) {
      h = mixByte(h, (c >>> 8) & 0xff);
    }
  }
  return h;
}

function mixBool(h: number, b: boolean): number {
  return mixByte(h, b ? 1 : 0);
}

/**
 * Deterministic 32-bit FNV-1a state hash across all gameplay-relevant simulation fields.
 * Identical seed + InputFrame[] MUST produce bit-for-bit identical hex hashes.
 */
export function hashSimState(state: SimState): string {
  let h = FNV_OFFSET_BASIS;

  // Core clock & PRNG
  h = mixInt32(h, state.tick);
  h = mixInt32(h, state.rngState >>> 0);
  h = mixNum(h, state.timeScale);
  h = mixNum(h, state.hitstopTimer);

  // Player state
  const p = state.player;
  h = mixNum(h, p.pos.x);
  h = mixNum(h, p.pos.y);
  h = mixNum(h, p.vel.x);
  h = mixNum(h, p.vel.y);
  h = mixNum(h, p.facingAngle);
  h = mixInt32(h, p.facingIdx);
  h = mixNum(h, p.hp);
  h = mixNum(h, p.maxHp);
  h = mixNum(h, p.armor);
  h = mixInt32(h, p.deathDefiances);
  h = mixStr(h, p.weaponId);
  h = mixStr(h, p.aspectId);
  h = mixInt32(h, p.hammers.length);
  for (let i = 0; i < p.hammers.length; i++) {
    h = mixStr(h, p.hammers[i]);
  }
  h = mixInt32(h, p.ammo);
  h = mixInt32(h, p.castAmmo);
  h = mixInt32(h, p.maxCastAmmo);
  h = mixNum(h, p.castCooldown);
  h = mixInt32(h, p.dashCharges);
  h = mixInt32(h, p.maxDashCharges);
  h = mixNum(h, p.dashTimer);
  h = mixNum(h, p.dashCooldown);
  h = mixNum(h, p.dashRegenTimer);
  h = mixInt32(h, p.attackComboStep);
  h = mixNum(h, p.attackTimer);
  h = mixNum(h, p.specialCooldown);
  h = mixNum(h, p.iframeTimer);
  h = mixNum(h, p.godGauge);
  h = mixInt32(h, p.gold);
  h = mixBool(h, p.isDead);

  h = mixInt32(h, p.boons.length);
  for (let i = 0; i < p.boons.length; i++) {
    const b = p.boons[i];
    h = mixStr(h, b.id);
    h = mixStr(h, b.patronId);
    h = mixStr(h, b.slot);
    h = mixStr(h, b.rarity);
    h = mixInt32(h, b.level);
    h = mixNum(h, b.scaledValue);
  }

  h = mixInt32(h, p.statuses.length);
  for (let i = 0; i < p.statuses.length; i++) {
    const st = p.statuses[i];
    h = mixStr(h, st.id);
    h = mixNum(h, st.remaining);
    h = mixInt32(h, st.stacks);
  }

  // Enemies
  h = mixInt32(h, state.enemies.length);
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    h = mixStr(h, e.id);
    h = mixStr(h, e.archetype);
    h = mixNum(h, e.pos.x);
    h = mixNum(h, e.pos.y);
    h = mixNum(h, e.vel.x);
    h = mixNum(h, e.vel.y);
    h = mixNum(h, e.hp);
    h = mixNum(h, e.maxHp);
    h = mixNum(h, e.armor);
    h = mixInt32(h, e.phase);
    h = mixStr(h, e.aiState);
    h = mixInt32(h, e.lodgedCasts);
    h = mixInt32(h, e.statuses.length);
    for (let j = 0; j < e.statuses.length; j++) {
      const st = e.statuses[j];
      h = mixStr(h, st.id);
      h = mixNum(h, st.remaining);
      h = mixInt32(h, st.stacks);
    }
  }

  // Projectiles
  h = mixInt32(h, state.projectiles.length);
  for (let i = 0; i < state.projectiles.length; i++) {
    const pr = state.projectiles[i];
    h = mixStr(h, pr.id);
    h = mixStr(h, pr.owner);
    h = mixStr(h, pr.kind);
    h = mixNum(h, pr.pos.x);
    h = mixNum(h, pr.pos.y);
    h = mixNum(h, pr.vel.x);
    h = mixNum(h, pr.vel.y);
    h = mixNum(h, pr.damage);
    h = mixBool(h, pr.deflected);
  }

  // Room
  const r = state.room;
  h = mixStr(h, r.biome);
  h = mixInt32(h, r.depth);
  h = mixInt32(h, r.roomIndex);
  h = mixBool(h, r.cleared);
  h = mixInt32(h, r.waveIndex);

  h = mixInt32(h, r.pickups.length);
  for (let i = 0; i < r.pickups.length; i++) {
    const pk = r.pickups[i];
    h = mixStr(h, pk.id);
    h = mixStr(h, pk.kind);
    h = mixBool(h, pk.collected);
    h = mixNum(h, pk.pos.x);
    h = mixNum(h, pk.pos.y);
  }

  h = mixInt32(h, r.doors.length);
  for (let i = 0; i < r.doors.length; i++) {
    const d = r.doors[i];
    h = mixStr(h, d.id);
    h = mixStr(h, d.direction);
    h = mixBool(h, d.locked);
    h = mixStr(h, d.reward.kind);
  }

  h = mixInt32(h, r.bloodstones.length);
  for (let i = 0; i < r.bloodstones.length; i++) {
    const bs = r.bloodstones[i];
    h = mixStr(h, bs.id);
    h = mixNum(h, bs.pos.x);
    h = mixNum(h, bs.pos.y);
  }

  // Run progress
  const run = state.run;
  h = mixInt32(h, run.seed);
  h = mixInt32(h, run.kills);
  h = mixInt32(h, run.chambersCleared);
  h = mixNum(h, run.damageDealt);
  h = mixNum(h, run.damageTaken);
  h = mixBool(h, run.victory);
  h = mixBool(h, run.defeat);

  return (h >>> 0).toString(16).padStart(8, '0');
}
