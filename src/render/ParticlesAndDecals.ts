/**
 * ParticlesAndDecals — Pre-allocated fixed-size object pools (ZERO per-frame GC churn!)
 *
 * Manages:
 *  - Painterly Bezier Weapon Slash Ribbons (tinted by active Attack/Special Boon color + hot core!)
 *  - Prince Pyreus Fiery Footsteps (`FireFootstep`) & glowing ember scorches
 *  - Comic Hit Sparks, Gold Armor-Shatter Shards, Patron Boon VFX (lightning, surf, deflect rings, roses)
 *  - Boss Phase Shockwaves, Persistent Room Floor Decals (scorch craters, blood-ichor, cracks)
 *  - Post-process screen pulses (hit flash, death defiance desaturation, final-kill dramatic pulse)
 */

import type {
  PatronId,
  SimEvent,
  SimState,
  StatusEffectId,
  WeaponId,
} from '../contracts/index.js';
import { PATRON_CONSTANTS } from '../contracts/index.js';
import { hexToRgbaTuple } from '../assets/ProceduralFonts.js';

export type SlashRibbonKind = 'arc' | 'nova' | 'thrust' | 'whip';

export interface SlashRibbon {
  active: boolean;
  kind: SlashRibbonKind;
  x: number;
  y: number;
  angle: number;
  arcSpan: number;
  radius: number;
  thickness: number;
  r: number;
  g: number;
  b: number;
  coreR: number;
  coreG: number;
  coreB: number;
  life: number;
  maxLife: number;
  flip: number;
}

export type ParticleKind =
  | 'ember_footstep'
  | 'spark'
  | 'shard'
  | 'bolt'
  | 'splash'
  | 'deflect_ring'
  | 'rose'
  | 'shockwave'
  | 'smoke'
  | 'flame'
  | 'petal'
  | 'snowflake'
  | 'muzzle_flash';

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  endSize: number;
  angle: number;
  spin: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  life: number;
  maxLife: number;
  emissive: number;
}

export type DecalKind = 'scorch' | 'ichor' | 'crack' | 'foot_scorch';

export interface FloorDecal {
  active: boolean;
  kind: DecalKind;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export const MAX_SLASH_RIBBONS = 28;
export const MAX_PARTICLES = 768;
export const MAX_DECALS = 96;

export class ParticlesAndDecals {
  public readonly ribbons: SlashRibbon[];
  public readonly particles: Particle[];
  public readonly decals: FloorDecal[];

  public activeParticleCount = 0;
  public activeRibbonCount = 0;
  public activeDecalCount = 0;

  // Post-process pulse states (0..1)
  public hitFlashPulse = 0;
  public deathDefiancePulse = 0;
  public finalKillPulse = 0;

  // Deterministic lightweight visual RNG (strictly cosmetic, never touches SimState!)
  private vfxSeed = 0x51a7c0de;
  private ribbonCursor = 0;
  private particleCursor = 0;
  private decalCursor = 0;

  // Hero fiery footstep tracker
  private lastHeroX = Number.NaN;
  private lastHeroY = Number.NaN;
  private strideAccum = 0;
  private footSide = 1;
  private ambientTimer = 0;

  constructor() {
    this.ribbons = new Array<SlashRibbon>(MAX_SLASH_RIBBONS);
    for (let i = 0; i < MAX_SLASH_RIBBONS; i++) {
      this.ribbons[i] = {
        active: false,
        kind: 'arc',
        x: 0,
        y: 0,
        angle: 0,
        arcSpan: 2.2,
        radius: 160,
        thickness: 44,
        r: 1,
        g: 0.25,
        b: 0.2,
        coreR: 1,
        coreG: 0.96,
        coreB: 0.85,
        life: 0,
        maxLife: 0.22,
        flip: 1,
      };
    }

    this.particles = new Array<Particle>(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles[i] = {
        active: false,
        kind: 'spark',
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        size: 16,
        endSize: 4,
        angle: 0,
        spin: 0,
        r: 1,
        g: 1,
        b: 1,
        alpha: 1,
        life: 0,
        maxLife: 0.4,
        emissive: 1,
      };
    }

    this.decals = new Array<FloorDecal>(MAX_DECALS);
    for (let i = 0; i < MAX_DECALS; i++) {
      this.decals[i] = {
        active: false,
        kind: 'scorch',
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        r: 1,
        g: 1,
        b: 1,
        alpha: 0.8,
        life: 0,
        maxLife: 20,
      };
    }
  }

  private rand(): number {
    let x = this.vfxSeed | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.vfxSeed = x;
    return ((x >>> 0) % 10000) / 10000;
  }

  private randRange(min: number, max: number): number {
    return min + (max - min) * this.rand();
  }

  public clearRoomDecals(): void {
    for (let i = 0; i < MAX_DECALS; i++) {
      this.decals[i].active = false;
    }
    this.activeDecalCount = 0;
    this.lastHeroX = Number.NaN;
    this.lastHeroY = Number.NaN;
  }

  public reset(): void {
    for (let i = 0; i < MAX_SLASH_RIBBONS; i++) this.ribbons[i].active = false;
    for (let i = 0; i < MAX_PARTICLES; i++) this.particles[i].active = false;
    for (let i = 0; i < MAX_DECALS; i++) this.decals[i].active = false;
    this.activeRibbonCount = 0;
    this.activeParticleCount = 0;
    this.activeDecalCount = 0;
    this.hitFlashPulse = 0;
    this.deathDefiancePulse = 0;
    this.finalKillPulse = 0;
    this.lastHeroX = Number.NaN;
    this.lastHeroY = Number.NaN;
  }

  private allocRibbon(): SlashRibbon {
    for (let i = 0; i < MAX_SLASH_RIBBONS; i++) {
      const idx = (this.ribbonCursor + i) % MAX_SLASH_RIBBONS;
      if (!this.ribbons[idx].active) {
        this.ribbonCursor = (idx + 1) % MAX_SLASH_RIBBONS;
        return this.ribbons[idx];
      }
    }
    const r = this.ribbons[this.ribbonCursor];
    this.ribbonCursor = (this.ribbonCursor + 1) % MAX_SLASH_RIBBONS;
    return r;
  }

  private allocParticle(): Particle {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const idx = (this.particleCursor + i) % MAX_PARTICLES;
      if (!this.particles[idx].active) {
        this.particleCursor = (idx + 1) % MAX_PARTICLES;
        return this.particles[idx];
      }
    }
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % MAX_PARTICLES;
    return p;
  }

  private allocDecal(): FloorDecal {
    for (let i = 0; i < MAX_DECALS; i++) {
      const idx = (this.decalCursor + i) % MAX_DECALS;
      if (!this.decals[idx].active) {
        this.decalCursor = (idx + 1) % MAX_DECALS;
        return this.decals[idx];
      }
    }
    const d = this.decals[this.decalCursor];
    this.decalCursor = (this.decalCursor + 1) % MAX_DECALS;
    return d;
  }

  private getSlotPatronColor(
    state: SimState,
    slot: 'attack' | 'special' | 'dash' | 'cast' | 'call'
  ): { patronId: PatronId | null; r: number; g: number; b: number; coreR: number; coreG: number; coreB: number } {
    for (let i = 0; i < state.player.boons.length; i++) {
      const boon = state.player.boons[i];
      if (boon.slot === slot) {
        const def = PATRON_CONSTANTS[boon.patronId];
        const [r, g, b] = hexToRgbaTuple(def.colorHex);
        const [cr, cg, cb] = hexToRgbaTuple(def.accentHex);
        return { patronId: boon.patronId, r, g, b, coreR: cr, coreG: cg, coreB: cb };
      }
    }
    // Default fiery Stygian crimson-ember
    return { patronId: null, r: 1.0, g: 0.28, b: 0.22, coreR: 1.0, coreG: 0.94, coreB: 0.72 };
  }

  public spawnSlashRibbon(
    kind: SlashRibbonKind,
    x: number,
    y: number,
    angle: number,
    arcSpan: number,
    radius: number,
    thickness: number,
    r: number,
    g: number,
    b: number,
    coreR: number,
    coreG: number,
    coreB: number,
    maxLife: number,
    flip = 1
  ): void {
    const rb = this.allocRibbon();
    rb.active = true;
    rb.kind = kind;
    rb.x = x;
    rb.y = y;
    rb.angle = angle;
    rb.arcSpan = arcSpan;
    rb.radius = radius;
    rb.thickness = thickness;
    rb.r = r;
    rb.g = g;
    rb.b = b;
    rb.coreR = coreR;
    rb.coreG = coreG;
    rb.coreB = coreB;
    rb.life = maxLife;
    rb.maxLife = maxLife;
    rb.flip = flip;
  }

  public spawnParticle(
    kind: ParticleKind,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    endSize: number,
    r: number,
    g: number,
    b: number,
    alpha: number,
    maxLife: number,
    emissive = 1.0,
    angle = 0,
    spin = 0
  ): void {
    const p = this.allocParticle();
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.size = size;
    p.endSize = endSize;
    p.angle = angle;
    p.spin = spin;
    p.r = r;
    p.g = g;
    p.b = b;
    p.alpha = alpha;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.emissive = emissive;
  }

  public spawnDecal(
    kind: DecalKind,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    angle: number,
    r: number,
    g: number,
    b: number,
    alpha: number,
    maxLife: number
  ): void {
    const d = this.allocDecal();
    d.active = true;
    d.kind = kind;
    d.x = x;
    d.y = y;
    d.scaleX = scaleX;
    d.scaleY = scaleY;
    d.angle = angle;
    d.r = r;
    d.g = g;
    d.b = b;
    d.alpha = alpha;
    d.life = maxLife;
    d.maxLife = maxLife;
  }

  private spawnPatronAccentBurst(patronId: PatronId, x: number, y: number, intensity = 1): void {
    const def = PATRON_CONSTANTS[patronId];
    const [r, g, b] = hexToRgbaTuple(def.colorHex);
    const count = Math.round(5 * intensity);

    switch (patronId) {
      case 'voltaris': {
        for (let i = 0; i < count; i++) {
          const a = this.randRange(0, Math.PI * 2);
          const dist = this.randRange(14, 70 * intensity);
          this.spawnParticle(
            'bolt',
            x + Math.cos(a) * dist,
            y + Math.sin(a) * dist,
            this.randRange(18, 48),
            Math.cos(a) * 90,
            Math.sin(a) * 90,
            25,
            34 * intensity,
            18,
            r,
            g,
            b,
            1,
            0.18,
            2.1,
            a,
            this.randRange(-6, 6)
          );
        }
        break;
      }
      case 'tidebreaker': {
        for (let i = 0; i < count + 2; i++) {
          const a = this.randRange(0, Math.PI * 2);
          const spd = this.randRange(90, 260 * intensity);
          this.spawnParticle(
            'splash',
            x,
            y,
            14,
            Math.cos(a) * spd,
            Math.sin(a) * spd,
            this.randRange(60, 140),
            26 * intensity,
            6,
            r,
            g,
            b,
            0.95,
            0.34,
            1.4,
            a,
            this.randRange(-4, 4)
          );
        }
        break;
      }
      case 'aegira': {
        this.spawnParticle(
          'deflect_ring',
          x,
          y,
          12,
          0,
          0,
          0,
          36,
          140 * intensity,
          r,
          g,
          b,
          0.95,
          0.28,
          1.9
        );
        break;
      }
      case 'velouris': {
        for (let i = 0; i < count + 3; i++) {
          const a = this.randRange(0, Math.PI * 2);
          const spd = this.randRange(60, 180 * intensity);
          this.spawnParticle(
            'rose',
            x,
            y,
            22,
            Math.cos(a) * spd,
            Math.sin(a) * spd,
            this.randRange(35, 95),
            20 * intensity,
            8,
            r,
            g,
            b,
            0.95,
            0.48,
            1.5,
            this.randRange(0, Math.PI * 2),
            this.randRange(-7, 7)
          );
        }
        break;
      }
      default: {
        for (let i = 0; i < count; i++) {
          const a = this.randRange(0, Math.PI * 2);
          const spd = this.randRange(80, 220 * intensity);
          this.spawnParticle(
            'spark',
            x,
            y,
            20,
            Math.cos(a) * spd,
            Math.sin(a) * spd,
            this.randRange(20, 80),
            22 * intensity,
            4,
            r,
            g,
            b,
            1,
            0.28,
            1.6,
            a,
            0
          );
        }
        break;
      }
    }
  }

  private statusColor(statusId: StatusEffectId): [number, number, number] {
    switch (statusId) {
      case 'jolted':
        return [1.0, 0.98, 0.25];
      case 'ruptured':
        return [0.0, 0.78, 1.0];
      case 'exposed':
        return [0.99, 0.74, 0.19];
      case 'weak':
        return [1.0, 0.2, 0.94];
      case 'marked':
        return [0.43, 1.0, 0.0];
      case 'doom':
        return [1.0, 0.08, 0.08];
      case 'hangover':
        return [0.78, 0.0, 1.0];
      case 'chill':
        return [0.45, 0.8, 1.0];
      case 'maim':
        return [1.0, 0.3, 0.18];
      case 'poison':
        return [0.65, 0.92, 0.22];
    }
  }

  public consumeEvents(events: readonly SimEvent[], state: SimState): void {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.type) {
        case 'room_entered': {
          this.clearRoomDecals();
          // Subtle upright rising underworld embers scattered around hero boots (no circular wreath!)
          for (let k = 0; k < 7; k++) {
            const ox = this.randRange(-26, 26);
            const oy = this.randRange(-12, 12);
            this.spawnParticle(
              'ember_footstep',
              state.player.pos.x + ox,
              state.player.pos.y + oy,
              2,
              this.randRange(-28, 28),
              this.randRange(-18, 18),
              this.randRange(42, 95),
              9,
              2,
              1.0,
              0.56,
              0.2,
              0.46,
              0.26,
              0.85,
              0,
              0
            );
          }
          break;
        }

        case 'attack_swing': {
          const tint = this.getSlotPatronColor(state, 'attack');
          // Bespoke VFX for ranged Arms (Adamant Rail muzzle flash, Heart-Seeking Bow burst)
          if (ev.weaponId === 'adamant_rail') {
            this.spawnParticle(
              'muzzle_flash',
              ev.pos.x + Math.cos(ev.angle) * 44,
              ev.pos.y + Math.sin(ev.angle) * 44,
              32,
              Math.cos(ev.angle) * 60,
              Math.sin(ev.angle) * 60,
              0,
              34,
              18,
              tint.r,
              tint.g,
              tint.b,
              1,
              0.11,
              1.4,
              ev.angle,
              0
            );
            for (let s = 0; s < 4; s++) {
              const sa = ev.angle + this.randRange(-0.35, 0.35);
              this.spawnParticle('spark', ev.pos.x + Math.cos(ev.angle) * 40, ev.pos.y + Math.sin(ev.angle) * 40, 30, Math.cos(sa) * 280, Math.sin(sa) * 280, 20, 14, 3, tint.coreR, tint.coreG, tint.coreB, 1, 0.16, 1.5, sa, 0);
            }
            break;
          }
          if (ev.weaponId === 'heart_seeking_bow') {
            this.spawnParticle(
              'spark',
              ev.pos.x + Math.cos(ev.angle) * 36,
              ev.pos.y + Math.sin(ev.angle) * 36,
              30,
              0,
              0,
              0,
              46,
              10,
              tint.r,
              tint.g,
              tint.b,
              0.95,
              0.18,
              1.6,
              ev.angle,
              2
            );
            break;
          }

          const radius = this.weaponSlashRadius(ev.weaponId, ev.comboStep, ev.isDashStrike);
          const isThrust = ev.weaponId === 'eternal_spear' || (ev.weaponId === 'stygian_blade' && ev.comboStep === 2);
          const flip = ev.comboStep % 2 === 1 ? -1 : 1;
          const arcSpan = isThrust
            ? 0.55
            : ev.weaponId === 'twin_fists'
              ? 1.75
              : ev.weaponId === 'shield_of_chaos'
                ? 2.2
                : ev.isDashStrike
                  ? 2.55
                  : 2.35;
          const thickness = ev.weaponId === 'twin_fists' ? 38 : ev.isDashStrike ? 54 : isThrust ? 40 : 46;

          this.spawnSlashRibbon(
            isThrust ? 'thrust' : 'arc',
            ev.pos.x,
            ev.pos.y,
            ev.angle,
            arcSpan,
            radius,
            thickness,
            tint.r,
            tint.g,
            tint.b,
            tint.coreR,
            tint.coreG,
            tint.coreB,
            ev.isDashStrike ? 0.24 : 0.21,
            flip
          );

          // Trailing sword-arc spark flecks
          const sparkCount = ev.isDashStrike ? 9 : 6;
          for (let s = 0; s < sparkCount; s++) {
            const sa = ev.angle + this.randRange(-arcSpan * 0.5, arcSpan * 0.5);
            const dist = radius * this.randRange(0.55, 1.05);
            this.spawnParticle(
              'spark',
              ev.pos.x + Math.cos(sa) * dist,
              ev.pos.y + Math.sin(sa) * dist,
              24,
              Math.cos(sa) * this.randRange(80, 220),
              Math.sin(sa) * this.randRange(80, 220),
              this.randRange(15, 70),
              18,
              3,
              tint.r,
              tint.g,
              tint.b,
              0.95,
              0.22,
              1.6,
              sa,
              0
            );
          }

          if (tint.patronId) {
            this.spawnPatronAccentBurst(
              tint.patronId,
              ev.pos.x + Math.cos(ev.angle) * radius * 0.65,
              ev.pos.y + Math.sin(ev.angle) * radius * 0.65,
              0.7
            );
          }
          break;
        }

        case 'special_cast': {
          const tint = this.getSlotPatronColor(state, 'special');
          const novaRadius = ev.weaponId === 'stygian_blade' ? 320 : 185;
          this.spawnSlashRibbon(
            'nova',
            ev.pos.x,
            ev.pos.y,
            ev.angle,
            Math.PI * 2,
            novaRadius,
            58,
            tint.r,
            tint.g,
            tint.b,
            tint.coreR,
            tint.coreG,
            tint.coreB,
            0.34,
            1
          );
          this.spawnParticle(
            'shockwave',
            ev.pos.x,
            ev.pos.y,
            4,
            0,
            0,
            0,
            32,
            novaRadius * 1.15,
            tint.r,
            tint.g,
            tint.b,
            0.95,
            0.36,
            2.0
          );
          this.spawnDecal('scorch', ev.pos.x, ev.pos.y, 1.85, 1.85, this.randRange(0, 6.28), 1, 1, 1, 0.72, 24);
          this.spawnDecal('crack', ev.pos.x, ev.pos.y, 1.5, 1.5, this.randRange(0, 6.28), 1, 1, 1, 0.68, 26);

          for (let s = 0; s < 16; s++) {
            const a = (s / 16) * Math.PI * 2 + this.randRange(-0.15, 0.15);
            const spd = this.randRange(180, 420);
            this.spawnParticle(
              'spark',
              ev.pos.x,
              ev.pos.y,
              18,
              Math.cos(a) * spd,
              Math.sin(a) * spd,
              this.randRange(40, 140),
              26,
              4,
              tint.coreR,
              tint.coreG,
              tint.coreB,
              1,
              0.32,
              1.9,
              a,
              0
            );
          }
          if (tint.patronId) {
            this.spawnPatronAccentBurst(tint.patronId, ev.pos.x, ev.pos.y, 1.25);
          }
          break;
        }

        case 'bloodstone_fired': {
          const [r, g, b] = ev.patronId
            ? hexToRgbaTuple(PATRON_CONSTANTS[ev.patronId].colorHex)
            : [1.0, 0.18, 0.3];
          for (let k = 0; k < 6; k++) {
            const a = ev.angle + this.randRange(-0.4, 0.4);
            this.spawnParticle(
              'spark',
              ev.pos.x,
              ev.pos.y,
              24,
              Math.cos(a) * this.randRange(100, 260),
              Math.sin(a) * this.randRange(100, 260),
              20,
              16,
              3,
              r,
              g,
              b,
              1,
              0.24,
              1.8,
              a,
              0
            );
          }
          break;
        }

        case 'dash': {
          const tint = ev.patronId
            ? {
                r: hexToRgbaTuple(PATRON_CONSTANTS[ev.patronId].colorHex)[0],
                g: hexToRgbaTuple(PATRON_CONSTANTS[ev.patronId].colorHex)[1],
                b: hexToRgbaTuple(PATRON_CONSTANTS[ev.patronId].colorHex)[2],
              }
            : this.getSlotPatronColor(state, 'dash');

          // Fiery departure burst & ember trail
          for (let k = 0; k < 10; k++) {
            const t = k / 10;
            const px = ev.pos.x + (ev.endPos.x - ev.pos.x) * t * 0.45;
            const py = ev.pos.y + (ev.endPos.y - ev.pos.y) * t * 0.45;
            this.spawnParticle(
              'ember_footstep',
              px + this.randRange(-12, 12),
              py + this.randRange(-10, 10),
              6,
              this.randRange(-60, 60),
              this.randRange(-40, 40),
              this.randRange(45, 120),
              20,
              4,
              tint.r,
              tint.g,
              tint.b,
              0.92,
              0.36,
              1.5,
              this.randRange(0, 6.28),
              this.randRange(-4, 4)
            );
          }

          if (ev.perfect) {
            this.spawnParticle(
              'deflect_ring',
              ev.pos.x,
              ev.pos.y,
              12,
              0,
              0,
              0,
              24,
              150,
              0.42,
              0.94,
              1.0,
              1,
              0.3,
              2.2
            );
          }
          if (ev.patronId) {
            this.spawnPatronAccentBurst(ev.patronId, ev.pos.x, ev.pos.y, 0.9);
          }
          break;
        }

        case 'damage': {
          if (ev.targetKind === 'player') {
            this.hitFlashPulse = Math.min(1, this.hitFlashPulse + 0.82);
            for (let k = 0; k < 10; k++) {
              const a = this.randRange(0, Math.PI * 2);
              const spd = this.randRange(90, 260);
              this.spawnParticle(
                'spark',
                ev.pos.x,
                ev.pos.y,
                26,
                Math.cos(a) * spd,
                Math.sin(a) * spd,
                this.randRange(30, 100),
                22,
                4,
                1.0,
                0.22,
                0.26,
                1,
                0.28,
                1.6,
                a,
                0
              );
            }
          } else {
            // Comic hit sparks + blood-ichor splat decal
            const count = ev.crit ? 14 : ev.backstab ? 11 : 7;
            const cr = ev.crit ? 1.0 : ev.backstab ? 0.85 : 1.0;
            const cg = ev.crit ? 0.82 : ev.backstab ? 0.42 : 0.92;
            const cb = ev.crit ? 0.2 : ev.backstab ? 1.0 : 0.72;

            for (let k = 0; k < count; k++) {
              const a = this.randRange(0, Math.PI * 2);
              const spd = this.randRange(110, ev.crit ? 380 : 260);
              this.spawnParticle(
                'spark',
                ev.pos.x,
                ev.pos.y,
                26,
                Math.cos(a) * spd,
                Math.sin(a) * spd,
                this.randRange(25, 110),
                ev.crit ? 28 : 19,
                3,
                cr,
                cg,
                cb,
                1,
                ev.crit ? 0.3 : 0.22,
                ev.crit ? 2.2 : 1.5,
                a,
                0
              );
            }

            if (ev.crit) {
              this.spawnParticle(
                'shockwave',
                ev.pos.x,
                ev.pos.y,
                18,
                0,
                0,
                0,
                18,
                110,
                1.0,
                0.85,
                0.24,
                0.9,
                0.22,
                2.2
              );
            }

            // Blood-ichor floor decal
            if (ev.amount >= 15) {
              this.spawnDecal(
                'ichor',
                ev.pos.x + this.randRange(-14, 14),
                ev.pos.y + this.randRange(-10, 10),
                this.randRange(0.55, 1.0),
                this.randRange(0.55, 1.0),
                this.randRange(0, 6.28),
                0.48,
                0.08,
                0.38,
                0.55,
                26
              );
            }

            // Armor shatter gold shards!
            if (ev.armorBroken) {
              for (let k = 0; k < 16; k++) {
                const a = this.randRange(0, Math.PI * 2);
                const spd = this.randRange(140, 360);
                this.spawnParticle(
                  'shard',
                  ev.pos.x,
                  ev.pos.y,
                  30,
                  Math.cos(a) * spd,
                  Math.sin(a) * spd,
                  this.randRange(90, 220),
                  20,
                  7,
                  1.0,
                  0.8,
                  0.26,
                  1,
                  0.52,
                  1.9,
                  a,
                  this.randRange(-10, 10)
                );
              }
              this.spawnParticle(
                'shockwave',
                ev.pos.x,
                ev.pos.y,
                10,
                0,
                0,
                0,
                24,
                160,
                1.0,
                0.78,
                0.24,
                1,
                0.32,
                2.2
              );
            }

            // Wall slam crack & shockwave!
            if (ev.wallSlam) {
              this.spawnDecal('crack', ev.pos.x, ev.pos.y, 1.1, 1.1, this.randRange(0, 6.28), 1, 1, 1, 0.78, 28);
              this.spawnParticle(
                'shockwave',
                ev.pos.x,
                ev.pos.y,
                8,
                0,
                0,
                0,
                18,
                125,
                1.0,
                0.55,
                0.24,
                0.9,
                0.26,
                1.7
              );
            }
          }
          break;
        }

        case 'deflect': {
          this.spawnParticle(
            'deflect_ring',
            ev.pos.x,
            ev.pos.y,
            24,
            0,
            0,
            0,
            20,
            135,
            0.99,
            0.8,
            0.28,
            1,
            0.28,
            2.3
          );
          for (let k = 0; k < 8; k++) {
            const a = this.randRange(0, Math.PI * 2);
            this.spawnParticle(
              'spark',
              ev.pos.x,
              ev.pos.y,
              24,
              Math.cos(a) * 240,
              Math.sin(a) * 240,
              40,
              22,
              4,
              0.55,
              0.95,
              1.0,
              1,
              0.24,
              2.1,
              a,
              0
            );
          }
          break;
        }

        case 'enemy_death': {
          const big = ev.isBoss || ev.finalInRoom;
          const count = big ? 28 : 14;
          for (let k = 0; k < count; k++) {
            const a = this.randRange(0, Math.PI * 2);
            const spd = this.randRange(70, big ? 360 : 230);
            this.spawnParticle(
              k % 3 === 0 ? 'smoke' : 'spark',
              ev.pos.x,
              ev.pos.y,
              26,
              Math.cos(a) * spd,
              Math.sin(a) * spd,
              this.randRange(40, 160),
              big ? 36 : 24,
              5,
              ev.isBoss ? 0.95 : 0.45,
              ev.isBoss ? 0.25 : 0.95,
              ev.isBoss ? 0.85 : 0.72,
              0.95,
              big ? 0.65 : 0.44,
              1.7,
              a,
              this.randRange(-4, 4)
            );
          }
          this.spawnDecal(
            'ichor',
            ev.pos.x,
            ev.pos.y,
            big ? 1.8 : 1.1,
            big ? 1.8 : 1.1,
            this.randRange(0, 6.28),
            ev.isBoss ? 0.62 : 0.25,
            0.1,
            0.48,
            0.68,
            30
          );
          if (ev.finalInRoom || ev.isBoss) {
            this.finalKillPulse = 1.0;
            this.spawnParticle(
              'shockwave',
              ev.pos.x,
              ev.pos.y,
              8,
              0,
              0,
              0,
              30,
              big ? 320 : 210,
              1.0,
              0.88,
              0.42,
              1,
              0.46,
              2.4
            );
          }
          break;
        }

        case 'boss_phase': {
          this.spawnParticle(
            'shockwave',
            ev.pos.x,
            ev.pos.y,
            10,
            0,
            0,
            0,
            36,
            420,
            0.95,
            0.22,
            0.88,
            1,
            0.55,
            2.5
          );
          this.spawnSlashRibbon(
            'whip',
            ev.pos.x,
            ev.pos.y,
            0,
            Math.PI * 2,
            250,
            46,
            0.92,
            0.18,
            0.82,
            1.0,
            0.82,
            0.96,
            0.45,
            1
          );
          this.spawnDecal('scorch', ev.pos.x, ev.pos.y, 2.2, 2.2, 0, 1, 1, 1, 0.78, 35);
          break;
        }

        case 'status_applied':
        case 'status_triggered': {
          const [r, g, b] = this.statusColor(ev.statusId);
          for (let k = 0; k < 6; k++) {
            const a = this.randRange(0, Math.PI * 2);
            this.spawnParticle(
              'spark',
              ev.pos.x,
              ev.pos.y,
              26,
              Math.cos(a) * 140,
              Math.sin(a) * 140,
              55,
              18,
              4,
              r,
              g,
              b,
              1,
              0.3,
              1.8,
              a,
              0
            );
          }
          break;
        }

        case 'god_call': {
          this.spawnPatronAccentBurst(ev.patronId, ev.pos.x, ev.pos.y, ev.greater ? 2.2 : 1.4);
          const [r, g, b] = hexToRgbaTuple(PATRON_CONSTANTS[ev.patronId].colorHex);
          this.spawnParticle(
            'shockwave',
            ev.pos.x,
            ev.pos.y,
            8,
            0,
            0,
            0,
            28,
            ev.greater ? 420 : 240,
            r,
            g,
            b,
            1,
            0.48,
            2.5
          );
          break;
        }

        case 'death_defiance': {
          this.deathDefiancePulse = 1.0;
          this.spawnParticle(
            'shockwave',
            ev.pos.x,
            ev.pos.y,
            10,
            0,
            0,
            0,
            28,
            340,
            1.0,
            0.34,
            0.28,
            1,
            0.55,
            2.5
          );
          for (let k = 0; k < 22; k++) {
            const a = (k / 22) * Math.PI * 2;
            this.spawnParticle(
              'flame',
              ev.pos.x,
              ev.pos.y,
              12,
              Math.cos(a) * 210,
              Math.sin(a) * 210,
              140,
              32,
              6,
              1.0,
              0.55,
              0.18,
              1,
              0.52,
              2.2
            );
          }
          break;
        }

        case 'pickup_collected': {
          const [r, g, b] = ev.patronId
            ? hexToRgbaTuple(PATRON_CONSTANTS[ev.patronId].colorHex)
            : [1.0, 0.85, 0.35];
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            this.spawnParticle(
              'spark',
              ev.pos.x,
              ev.pos.y,
              22,
              Math.cos(a) * 120,
              Math.sin(a) * 120,
              90,
              18,
              3,
              r,
              g,
              b,
              1,
              0.36,
              1.9,
              a,
              0
            );
          }
          break;
        }

        default:
          break;
      }
    }
  }

  private weaponSlashRadius(weaponId: WeaponId, comboStep: number, isDashStrike: boolean): number {
    switch (weaponId) {
      case 'stygian_blade':
        return isDashStrike ? 225 : comboStep === 2 ? 255 : 210;
      case 'eternal_spear':
        return 300;
      case 'shield_of_chaos':
        return 155;
      case 'twin_fists':
        return 135;
      default:
        return 165;
    }
  }

  /**
   * Advances all pools by `dt` seconds and spawns Prince Pyreus's fiery footprints
   * (`FireFootstep`) plus ambient underworld embers. Zero allocations!
   */
  public update(dt: number, state: SimState): void {
    const safeDt = Math.min(0.05, Math.max(0, dt));

    // Decay post-process pulses
    this.hitFlashPulse = Math.max(0, this.hitFlashPulse - safeDt * 3.4);
    this.deathDefiancePulse = Math.max(0, this.deathDefiancePulse - safeDt * 1.15);
    this.finalKillPulse = Math.max(
      state.run.finalKillSlowTimer > 0 ? 0.85 : 0,
      Math.max(0, this.finalKillPulse - safeDt * 1.8)
    );

    // Prince Pyreus Fiery Footsteps (`FireFootstep`)
    const hx = state.player.pos.x;
    const hy = state.player.pos.y;
    if (Number.isFinite(this.lastHeroX)) {
      const dx = hx - this.lastHeroX;
      const dy = hy - this.lastHeroY;
      const stepDist = Math.hypot(dx, dy);
      if (stepDist > 1 && stepDist < 220) {
        this.strideAccum += stepDist;
        if (this.strideAccum >= 44) {
          this.strideAccum = 0;
          this.footSide = -this.footSide;
          const moveAngle = Math.atan2(dy, dx);
          const perp = moveAngle + Math.PI * 0.5;
          const fx = hx + Math.cos(perp) * (this.footSide * 9);
          const fy = hy + Math.sin(perp) * (this.footSide * 6);

          // Glowing ember footprint scorch on flagstones
          this.spawnDecal('foot_scorch', fx, fy, 0.34, 0.34, moveAngle, 1.0, 0.45, 0.14, 0.62, 1.25);

          // Rising fiery footstep flame & ash spark
          this.spawnParticle(
            'ember_footstep',
            fx,
            fy,
            2,
            -dx * 1.1 + this.randRange(-25, 25),
            -dy * 1.1 + this.randRange(-20, 20),
            this.randRange(42, 95),
            16,
            3,
            1.0,
            0.52,
            0.14,
            0.92,
            0.38,
            1.8,
            this.randRange(-0.3, 0.3),
            this.randRange(-3, 3)
          );
        }
      }
    }
    this.lastHeroX = hx;
    this.lastHeroY = hy;

    // Biome-specific ambient atmospheric particles (Cinder embers, Verdant petals, Crypt spores, Frozen snow!)
    this.ambientTimer += safeDt;
    const biome = state.room.biome;
    const spawnInterval = biome === 'frozen_summit' || biome === 'verdant_colosseum' || biome === 'cinder_mire' ? 0.09 : 0.16;
    if (this.ambientTimer >= spawnInterval) {
      this.ambientTimer = 0;
      const b = state.room.bounds;
      const rx = this.randRange(b.minX - 60, b.maxX + 60);
      const ry = this.randRange(b.minY - 60, b.maxY + 60);

      if (biome === 'frozen_summit') {
        this.spawnParticle(
          'snowflake',
          rx,
          ry,
          this.randRange(180, 290),
          this.randRange(-48, -14),
          this.randRange(12, 34),
          this.randRange(-72, -38),
          this.randRange(10, 18),
          this.randRange(8, 14),
          0.9,
          0.96,
          1.0,
          0.82,
          3.2,
          0.35,
          this.randRange(0, 6.28),
          this.randRange(-2.5, 2.5)
        );
      } else if (biome === 'verdant_colosseum') {
        this.spawnParticle(
          'petal',
          rx,
          ry,
          this.randRange(120, 240),
          this.randRange(26, 68),
          this.randRange(8, 28),
          this.randRange(-46, -22),
          this.randRange(12, 20),
          this.randRange(10, 16),
          1.0,
          0.42,
          0.78,
          0.88,
          3.0,
          0.3,
          this.randRange(0, 6.28),
          this.randRange(-4, 4)
        );
      } else if (biome === 'cinder_mire') {
        this.spawnParticle(
          'ember_footstep',
          rx,
          ry,
          this.randRange(4, 24),
          this.randRange(-26, 26),
          this.randRange(-14, 14),
          this.randRange(45, 110),
          this.randRange(10, 18),
          3,
          1.0,
          0.46,
          0.14,
          0.85,
          1.4,
          1.4,
          this.randRange(-0.4, 0.4),
          this.randRange(-3, 3)
        );
      } else if (biome === 'crypt_of_bile') {
        this.spawnParticle(
          'smoke',
          rx,
          ry,
          this.randRange(4, 24),
          this.randRange(-14, 14),
          this.randRange(-10, 10),
          this.randRange(16, 42),
          this.randRange(8, 16),
          3,
          0.66,
          0.92,
          0.22,
          0.6,
          1.6,
          0.8
        );
      } else {
        const isSanctum = biome === 'sanctum_hub';
        this.spawnParticle(
          'smoke',
          rx,
          ry,
          this.randRange(4, 30),
          this.randRange(-18, 18),
          this.randRange(-12, 12),
          this.randRange(18, 46),
          this.randRange(5, 10),
          2,
          isSanctum ? 1.0 : 0.36,
          isSanctum ? 0.62 : 0.94,
          isSanctum ? 0.28 : 0.68,
          0.52,
          1.5,
          1.2
        );
      }
    }

    // Update slash ribbons
    let activeR = 0;
    for (let i = 0; i < MAX_SLASH_RIBBONS; i++) {
      const rb = this.ribbons[i];
      if (!rb.active) continue;
      rb.life -= safeDt;
      if (rb.life <= 0) {
        rb.active = false;
      } else {
        activeR++;
      }
    }
    this.activeRibbonCount = activeR;

    // Update particles
    let activeP = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= safeDt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      activeP++;
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.z = Math.max(0, p.z + p.vz * safeDt);
      p.angle += p.spin * safeDt;

      // Air drag & subtle gravity on shards/splashes
      if (p.kind === 'shard' || p.kind === 'splash') {
        p.vz -= 460 * safeDt;
        p.vx *= 1 - 1.8 * safeDt;
        p.vy *= 1 - 1.8 * safeDt;
      } else if (p.kind === 'spark') {
        p.vx *= 1 - 4.2 * safeDt;
        p.vy *= 1 - 4.2 * safeDt;
      } else if (p.kind === 'ember_footstep' || p.kind === 'flame') {
        p.vx *= 1 - 2.4 * safeDt;
        p.vy *= 1 - 2.4 * safeDt;
      }
    }
    this.activeParticleCount = activeP;

    // Update floor decals
    let activeD = 0;
    for (let i = 0; i < MAX_DECALS; i++) {
      const d = this.decals[i];
      if (!d.active) continue;
      d.life -= safeDt;
      if (d.life <= 0) {
        d.active = false;
      } else {
        activeD++;
      }
    }
    this.activeDecalCount = activeD;
  }
}
