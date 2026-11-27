/**
 * ParticlesAndDecals — Pre-allocated fixed-size object pools (ZERO per-frame GC churn!)
 *
 * Manages:
 *  - Multi-Layer Sweeping Curved Comic Weapon Slash Ribbons (tinted by Patron Boon color + white-gold blade edge!)
 *  - Prince Pyreus Fiery Footsteps (`FireFootstep`) & glowing ember scorches
 *  - Directional Cone-Aligned Impact Hit-Spark Streaks (`spark_streak`) + Brief Crisp Starburst (`impact_burst`)
 *  - Gold Armor-Shatter Shards, Patron Boon VFX (lightning, surf, deflect rings, roses)
 *  - Persistent Biome/Faction-Grounded Floor Decals (`crater`, `scorch`, `ichor`, `crack`, `foot_scorch`)
 *  - Post-process screen pulses & impulses (hit flash, death defiance, final kill, chromatic aberration, radial shockwave)
 */

import type {
  BiomeId,
  EnemyArchetypeId,
  PatronId,
  SimEvent,
  SimState,
  StatusEffectId,
  WeaponId,
} from '../contracts/index.js';
import { PATRON_CONSTANTS } from '../contracts/index.js';
import { hexToRgbaTuple } from '../assets/ProceduralFonts.js';
import type { ScreenFxImpulse } from './GameRenderer.js';

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
  | 'spark_streak'
  | 'impact_burst'
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

export type DecalKind = 'scorch' | 'ichor' | 'crack' | 'crater' | 'foot_scorch';

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

  // Pass 6 Post-FX impulse state (chromatic aberration & radial shockwave ring)
  public chromaticAmount = 0;
  public shockwaveActive = false;
  public shockwaveHasWorld = false;
  public shockwaveWorldX = 0;
  public shockwaveWorldY = 0;
  public shockwaveElapsed = 0;
  public shockwaveDuration = 0.42;
  public shockwaveRadius = 0;
  public shockwaveAmp = 0;
  public shockwaveMaxAmp = 0;
  public shockwaveR = 1.0;
  public shockwaveG = 0.86;
  public shockwaveB = 0.42;

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
    this.chromaticAmount = 0;
    this.shockwaveActive = false;
    this.shockwaveHasWorld = false;
    this.shockwaveElapsed = 0;
    this.shockwaveRadius = 0;
    this.shockwaveAmp = 0;
    this.shockwaveMaxAmp = 0;
    this.lastHeroX = Number.NaN;
    this.lastHeroY = Number.NaN;
  }

  /**
   * Triggers chromatic aberration and/or radial shockwave distortion pulses
   * consumed by Pass 6 (`COMPOSITE_FRAG`) and Canvas2D post-overlay.
   */
  public triggerScreenFx(fx: ScreenFxImpulse): void {
    const strength = Math.max(0, Math.min(1, Number.isFinite(fx.intensity) ? fx.intensity : 0.6));
    if (strength <= 0.001) return;

    const [tr, tg, tb] = fx.colorHex ? hexToRgbaTuple(fx.colorHex) : [1.0, 0.88, 0.44];

    const startWave = (maxAmp: number, duration: number) => {
      if (this.shockwaveActive && this.shockwaveAmp > maxAmp * 0.9) return;
      this.shockwaveActive = true;
      this.shockwaveElapsed = 0;
      this.shockwaveDuration = duration;
      this.shockwaveRadius = 0.02;
      this.shockwaveMaxAmp = Math.min(0.028, maxAmp);
      this.shockwaveAmp = this.shockwaveMaxAmp;
      this.shockwaveHasWorld =
        typeof fx.worldX === 'number' &&
        Number.isFinite(fx.worldX) &&
        typeof fx.worldY === 'number' &&
        Number.isFinite(fx.worldY);
      if (this.shockwaveHasWorld) {
        this.shockwaveWorldX = fx.worldX as number;
        this.shockwaveWorldY = fx.worldY as number;
      }
      this.shockwaveR = tr;
      this.shockwaveG = tg;
      this.shockwaveB = tb;
    };

    switch (fx.kind) {
      case 'chromatic':
        this.chromaticAmount = Math.min(0.0055, Math.max(this.chromaticAmount, 0.0046 * strength));
        break;
      case 'crit_burst':
        this.chromaticAmount = Math.min(0.0055, Math.max(this.chromaticAmount, 0.0032 * strength));
        if (strength >= 0.65) {
          startWave(0.0085 * strength, 0.24);
        }
        break;
      case 'shockwave':
        this.chromaticAmount = Math.min(0.0055, Math.max(this.chromaticAmount, 0.0028 * strength));
        startWave(0.014 * strength, 0.32);
        break;
      case 'greater_call':
        this.chromaticAmount = Math.min(0.0055, Math.max(this.chromaticAmount, 0.0048 * strength));
        startWave(0.018 * strength, 0.38);
        break;
      case 'boss_phase':
        this.chromaticAmount = Math.min(0.0055, Math.max(this.chromaticAmount, 0.005 * strength));
        startWave(0.019 * strength, 0.4);
        break;
      case 'death_defiance':
        this.chromaticAmount = Math.min(0.0055, Math.max(this.chromaticAmount, 0.0055 * strength));
        this.deathDefiancePulse = Math.max(this.deathDefiancePulse, Math.min(1, strength));
        startWave(0.022 * strength, 0.44);
        break;
    }
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
    // Default fiery Stygian crimson-ember with incandescent white-gold core
    return { patronId: null, r: 1.0, g: 0.24, b: 0.2, coreR: 1.0, coreG: 0.97, coreB: 0.86 };
  }

  private getFactionIchorColor(
    biome: BiomeId,
    archetype?: EnemyArchetypeId,
    isBoss = false
  ): [number, number, number] {
    if (isBoss) return [0.58, 0.08, 0.34];
    if (archetype === 'giant_vermin' || archetype === 'venom_satyr' || biome === 'crypt_of_bile') {
      return [0.34, 0.58, 0.1];
    }
    if (archetype === 'lava_gorgon' || archetype === 'infernal_bomber' || archetype === 'slag_thrower' || biome === 'cinder_mire') {
      return [0.56, 0.16, 0.07];
    }
    if (biome === 'verdant_colosseum') {
      return [0.54, 0.12, 0.28];
    }
    if (biome === 'frozen_summit') {
      return [0.26, 0.16, 0.48];
    }
    return [0.2, 0.46, 0.36]; // Obsidian Pit spectral jade-obsidian ichor
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

  /**
   * Spawns a directional cone-aligned impact shower (`±32°` forward knockback cone +
   * perpendicular rebound sparks + brief `45ms` bright white-gold comic starburst).
   */
  private spawnDirectionalImpactSparks(
    x: number,
    y: number,
    impactAngle: number,
    count: number,
    r: number,
    g: number,
    b: number,
    isCrit: boolean
  ): void {
    // 1. Crisp 45ms incandescent white-gold comic starburst at exact impact point
    this.spawnParticle(
      'impact_burst',
      x,
      y,
      26,
      0,
      0,
      0,
      isCrit ? 62 : 42,
      isCrit ? 18 : 10,
      1.0,
      isCrit ? 0.94 : 0.97,
      isCrit ? 0.62 : 0.84,
      1.0,
      isCrit ? 0.062 : 0.046,
      isCrit ? 2.6 : 2.1,
      impactAngle + this.randRange(-0.4, 0.4),
      0
    );

    // 2. Forward knockback cone (±32° = ±0.56 rad) razor-sharp spark streak darts
    const coneHalf = 0.56;
    for (let k = 0; k < count; k++) {
      const a = impactAngle + this.randRange(-coneHalf, coneHalf);
      const spd = this.randRange(isCrit ? 260 : 185, isCrit ? 580 : 410);
      this.spawnParticle(
        'spark_streak',
        x + Math.cos(a) * this.randRange(2, 10),
        y + Math.sin(a) * this.randRange(2, 8),
        24 + this.randRange(-4, 10),
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        this.randRange(20, 95),
        isCrit ? this.randRange(32, 46) : this.randRange(22, 34),
        4,
        r,
        g,
        b,
        1.0,
        isCrit ? this.randRange(0.18, 0.30) : this.randRange(0.14, 0.24),
        isCrit ? 2.3 : 1.75,
        a,
        0
      );
    }

    // 3. 2-3 perpendicular rebound sparks shearing off armor/flesh
    const reboundCount = isCrit ? 3 : 2;
    for (let k = 0; k < reboundCount; k++) {
      const side = (k & 1) === 0 ? 1 : -1;
      const a = impactAngle + side * (Math.PI * 0.5 + this.randRange(-0.3, 0.3));
      const spd = this.randRange(160, 320);
      this.spawnParticle(
        'spark_streak',
        x,
        y,
        26,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        this.randRange(35, 110),
        isCrit ? 28 : 20,
        3,
        1.0,
        0.96,
        0.82,
        0.95,
        0.18,
        2.0,
        a,
        0
      );
    }
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
          const spd = this.randRange(110, 260 * intensity);
          this.spawnParticle(
            'spark_streak',
            x,
            y,
            20,
            Math.cos(a) * spd,
            Math.sin(a) * spd,
            this.randRange(20, 80),
            24 * intensity,
            4,
            r,
            g,
            b,
            1,
            0.24,
            1.65,
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
          if (ev.weaponId === 'adamant_rail') {
            this.spawnParticle(
              'muzzle_flash',
              ev.pos.x + Math.cos(ev.angle) * 44,
              ev.pos.y + Math.sin(ev.angle) * 44,
              32,
              Math.cos(ev.angle) * 60,
              Math.sin(ev.angle) * 60,
              0,
              38,
              18,
              tint.r,
              tint.g,
              tint.b,
              1,
              0.11,
              1.6,
              ev.angle,
              0
            );
            for (let s = 0; s < 5; s++) {
              const sa = ev.angle + this.randRange(-0.32, 0.32);
              this.spawnParticle(
                'spark_streak',
                ev.pos.x + Math.cos(ev.angle) * 40,
                ev.pos.y + Math.sin(ev.angle) * 40,
                30,
                Math.cos(sa) * this.randRange(260, 420),
                Math.sin(sa) * this.randRange(260, 420),
                20,
                20,
                3,
                tint.coreR,
                tint.coreG,
                tint.coreB,
                1,
                0.15,
                1.7,
                sa,
                0
              );
            }
            break;
          }
          if (ev.weaponId === 'heart_seeking_bow') {
            this.spawnParticle(
              'impact_burst',
              ev.pos.x + Math.cos(ev.angle) * 36,
              ev.pos.y + Math.sin(ev.angle) * 36,
              30,
              0,
              0,
              0,
              46,
              12,
              tint.r,
              tint.g,
              tint.b,
              0.95,
              0.12,
              1.9,
              ev.angle,
              2
            );
            for (let s = 0; s < 4; s++) {
              const sa = ev.angle + this.randRange(-0.28, 0.28);
              this.spawnParticle(
                'spark_streak',
                ev.pos.x + Math.cos(ev.angle) * 34,
                ev.pos.y + Math.sin(ev.angle) * 34,
                28,
                Math.cos(sa) * 310,
                Math.sin(sa) * 310,
                16,
                22,
                3,
                tint.coreR,
                tint.coreG,
                tint.coreB,
                0.95,
                0.15,
                1.8,
                sa,
                0
              );
            }
            break;
          }

          const radius = this.weaponSlashRadius(ev.weaponId, ev.comboStep, ev.isDashStrike);
          const isThrust = ev.weaponId === 'eternal_spear' || (ev.weaponId === 'stygian_blade' && ev.comboStep === 2);
          const flip = ev.comboStep % 2 === 1 ? -1 : 1;
          const arcSpan = isThrust
            ? 0.58
            : ev.weaponId === 'twin_fists'
              ? 1.95
              : ev.weaponId === 'shield_of_chaos'
                ? 2.38
                : ev.isDashStrike
                  ? 2.75
                  : 2.52;
          const thickness = ev.weaponId === 'twin_fists' ? 42 : ev.isDashStrike ? 58 : isThrust ? 44 : 50;

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
            ev.isDashStrike ? 0.24 : 0.22,
            flip
          );

          // Trailing outer-tip blade-arc droplets & directional speed sparks
          const sparkCount = ev.isDashStrike ? 9 : 6;
          for (let s = 0; s < sparkCount; s++) {
            const frac = (s + 0.5) / sparkCount;
            const sa = ev.angle + (frac - 0.5) * arcSpan * flip;
            const tangent = sa + (Math.PI * 0.5) * flip;
            const dist = radius * this.randRange(0.68, 0.96);
            const isInkDrop = s % 3 === 0;
            this.spawnParticle(
              isInkDrop ? 'shard' : 'spark_streak',
              ev.pos.x + Math.cos(sa) * dist,
              ev.pos.y + Math.sin(sa) * dist,
              24,
              Math.cos(tangent) * this.randRange(120, 260) + Math.cos(sa) * 55,
              Math.sin(tangent) * this.randRange(120, 260) + Math.sin(sa) * 55,
              this.randRange(12, 62),
              isInkDrop ? 13 : 22,
              3,
              isInkDrop ? 0.04 : tint.r,
              isInkDrop ? 0.025 : tint.g,
              isInkDrop ? 0.06 : tint.b,
              isInkDrop ? 0.88 : 0.96,
              isInkDrop ? 0.2 : 0.2,
              isInkDrop ? 0 : 1.75,
              tangent,
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
            62,
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
            novaRadius * 1.18,
            tint.r,
            tint.g,
            tint.b,
            0.95,
            0.36,
            2.1
          );
          // Persistent impact crater & scorch decals (16-22s fade)
          this.spawnDecal('crater', ev.pos.x, ev.pos.y, 1.45, 1.45, this.randRange(0, 6.28), 1, 1, 1, 0.78, 20);
          this.spawnDecal('scorch', ev.pos.x, ev.pos.y, 1.75, 1.75, this.randRange(0, 6.28), 1, 1, 1, 0.66, 18);

          for (let s = 0; s < 14; s++) {
            const a = (s / 14) * Math.PI * 2 + this.randRange(-0.15, 0.15);
            const spd = this.randRange(210, 440);
            this.spawnParticle(
              'spark_streak',
              ev.pos.x,
              ev.pos.y,
              18,
              Math.cos(a) * spd,
              Math.sin(a) * spd,
              this.randRange(40, 140),
              30,
              4,
              tint.coreR,
              tint.coreG,
              tint.coreB,
              1,
              0.28,
              2.0,
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
              'spark_streak',
              ev.pos.x,
              ev.pos.y,
              24,
              Math.cos(a) * this.randRange(140, 300),
              Math.sin(a) * this.randRange(140, 300),
              20,
              20,
              3,
              r,
              g,
              b,
              1,
              0.22,
              1.9,
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
            this.chromaticAmount = Math.min(0.0055, Math.max(this.chromaticAmount, 0.0034));
            // Derive incoming hit angle from nearest living enemy
            let hitAngle = state.player.facingAngle + Math.PI;
            let bestD2 = Number.POSITIVE_INFINITY;
            for (let eIdx = 0; eIdx < state.enemies.length; eIdx++) {
              const en = state.enemies[eIdx];
              if (en.aiState === 'dead') continue;
              const edx = ev.pos.x - en.pos.x;
              const edy = ev.pos.y - en.pos.y;
              const d2 = edx * edx + edy * edy;
              if (d2 > 1 && d2 < bestD2) {
                bestD2 = d2;
                hitAngle = Math.atan2(edy, edx);
              }
            }
            this.spawnDirectionalImpactSparks(ev.pos.x, ev.pos.y, hitAngle, 9, 1.0, 0.24, 0.28, false);
          } else {
            // Directional cone-aligned impact hit-sparks along attacker -> victim knockback vector
            const dx = ev.pos.x - state.player.pos.x;
            const dy = ev.pos.y - state.player.pos.y;
            const impactAngle = dx * dx + dy * dy > 16 ? Math.atan2(dy, dx) : state.player.facingAngle;

            const count = ev.crit ? 14 : ev.backstab ? 10 : 7;
            const cr = ev.crit ? 1.0 : ev.backstab ? 0.9 : 1.0;
            const cg = ev.crit ? 0.86 : ev.backstab ? 0.44 : 0.94;
            const cb = ev.crit ? 0.24 : ev.backstab ? 1.0 : 0.72;

            this.spawnDirectionalImpactSparks(ev.pos.x, ev.pos.y, impactAngle, count, cr, cg, cb, ev.crit);

            if (ev.crit) {
              this.chromaticAmount = Math.min(0.0055, Math.max(this.chromaticAmount, 0.0026));
              this.spawnParticle(
                'shockwave',
                ev.pos.x,
                ev.pos.y,
                18,
                0,
                0,
                0,
                18,
                115,
                1.0,
                0.86,
                0.28,
                0.92,
                0.22,
                2.25
              );
            }

            // Faction-tinted floor ichor decal (14-20s decay)
            if (ev.amount >= 15 || ev.crit) {
              let archetype: EnemyArchetypeId | undefined;
              let isBoss = false;
              for (let eIdx = 0; eIdx < state.enemies.length; eIdx++) {
                if (state.enemies[eIdx].id === ev.targetId) {
                  archetype = state.enemies[eIdx].archetype;
                  isBoss = state.enemies[eIdx].isBoss;
                  break;
                }
              }
              const [ir, ig, ib] = this.getFactionIchorColor(state.room.biome, archetype, isBoss);
              const s = ev.crit ? this.randRange(0.75, 1.15) : this.randRange(0.52, 0.92);
              this.spawnDecal(
                'ichor',
                ev.pos.x + Math.cos(impactAngle) * this.randRange(6, 18),
                ev.pos.y + Math.sin(impactAngle) * this.randRange(4, 14),
                s,
                s,
                impactAngle + this.randRange(-0.4, 0.4),
                ir,
                ig,
                ib,
                0.56,
                this.randRange(14, 20)
              );
            }

            // Armor shatter gold shards + crater + subtle post-FX shockwave
            if (ev.armorBroken) {
              for (let k = 0; k < 16; k++) {
                const a = impactAngle + this.randRange(-1.45, 1.45);
                const spd = this.randRange(150, 390);
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
                  0.82,
                  0.26,
                  1,
                  0.5,
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
                165,
                0.45,
                0.94,
                1.0,
                1,
                0.32,
                2.2
              );
              this.spawnDecal('crater', ev.pos.x, ev.pos.y, 0.95, 0.95, this.randRange(0, 6.28), 1, 1, 1, 0.65, 18);
              this.triggerScreenFx({
                kind: 'shockwave',
                intensity: 0.5,
                worldX: ev.pos.x,
                worldY: ev.pos.y,
                colorHex: '#6CEEFF',
              });
            }

            // Wall slam stone crater & directional shockwave
            if (ev.wallSlam) {
              this.spawnDecal('crater', ev.pos.x, ev.pos.y, 1.25, 1.25, this.randRange(0, 6.28), 1, 1, 1, 0.82, 21);
              this.spawnParticle(
                'shockwave',
                ev.pos.x,
                ev.pos.y,
                8,
                0,
                0,
                0,
                18,
                130,
                1.0,
                0.58,
                0.24,
                0.92,
                0.26,
                1.8
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
            142,
            0.99,
            0.84,
            0.32,
            1,
            0.28,
            2.3
          );
          this.spawnDirectionalImpactSparks(ev.pos.x, ev.pos.y, state.player.facingAngle, 8, 0.52, 0.96, 1.0, true);
          break;
        }

        case 'enemy_death': {
          const big = ev.isBoss || ev.finalInRoom;
          const count = big ? 26 : 14;
          const dx = ev.pos.x - state.player.pos.x;
          const dy = ev.pos.y - state.player.pos.y;
          const killAngle = dx * dx + dy * dy > 16 ? Math.atan2(dy, dx) : state.player.facingAngle;

          this.spawnDirectionalImpactSparks(
            ev.pos.x,
            ev.pos.y,
            killAngle,
            big ? 14 : 8,
            ev.isBoss ? 1.0 : 0.96,
            ev.isBoss ? 0.42 : 0.92,
            ev.isBoss ? 0.72 : 0.45,
            big
          );

          for (let k = 0; k < count; k++) {
            const a = this.randRange(0, Math.PI * 2);
            const spd = this.randRange(70, big ? 360 : 230);
            this.spawnParticle(
              k % 3 === 0 ? 'smoke' : 'spark_streak',
              ev.pos.x,
              ev.pos.y,
              26,
              Math.cos(a) * spd,
              Math.sin(a) * spd,
              this.randRange(40, 160),
              big ? 36 : 24,
              5,
              ev.isBoss ? 0.98 : 0.45,
              ev.isBoss ? 0.28 : 0.95,
              ev.isBoss ? 0.82 : 0.72,
              0.95,
              big ? 0.58 : 0.4,
              1.75,
              a,
              k % 3 === 0 ? this.randRange(-4, 4) : 0
            );
          }

          const [ir, ig, ib] = this.getFactionIchorColor(state.room.biome, ev.archetype, ev.isBoss);
          this.spawnDecal(
            'ichor',
            ev.pos.x,
            ev.pos.y,
            big ? 1.75 : 1.08,
            big ? 1.75 : 1.08,
            this.randRange(0, 6.28),
            ir,
            ig,
            ib,
            0.7,
            this.randRange(16, 22)
          );
          if (big) {
            this.spawnDecal('crater', ev.pos.x, ev.pos.y, 1.4, 1.4, this.randRange(0, 6.28), 1, 1, 1, 0.74, 22);
          }
          if (state.room.biome === 'cinder_mire' || ev.archetype === 'infernal_bomber') {
            this.spawnDecal('scorch', ev.pos.x, ev.pos.y, 1.25, 1.25, this.randRange(0, 6.28), 1, 1, 1, 0.68, 18);
          }

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
              big ? 340 : 210,
              1.0,
              0.88,
              0.42,
              1,
              0.46,
              2.4
            );
            this.triggerScreenFx({
              kind: 'shockwave',
              intensity: ev.isBoss ? 0.85 : 0.55,
              worldX: ev.pos.x,
              worldY: ev.pos.y,
              colorHex: '#FFE072',
            });
          }
          break;
        }

        case 'boss_phase': {
          // Sleek biome/boss-themed crisp shockwave rings + radial spark streaks (never thick hot-pink donuts!)
          let pr = 0.86;
          let pg = 0.2;
          let pb = 0.28;
          let cr = 1.0;
          let cg = 0.88;
          let cb = 0.56;
          let fxHex = '#E5B952';

          if (ev.bossId === 'bone_leviathan' || state.room.biome === 'cinder_mire') {
            pr = 1.0; pg = 0.42; pb = 0.08;
            cr = 1.0; cg = 0.92; cb = 0.58;
            fxHex = '#FF6A14';
          } else if (
            ev.bossId === 'colosseum_bull' ||
            ev.bossId === 'colosseum_spearlord' ||
            state.room.biome === 'verdant_colosseum'
          ) {
            pr = 0.95; pg = 0.74; pb = 0.2;
            cr = 1.0; cg = 0.96; cb = 0.72;
            fxHex = '#F2C95E';
          } else if (ev.bossId === 'the_ferryman' || state.room.biome === 'crypt_of_bile') {
            pr = 0.66; pg = 0.86; pb = 0.22;
            cr = 0.95; cg = 0.92; cb = 0.52;
            fxHex = '#C49B3E';
          } else if (ev.bossId === 'sovereign_lord' || state.room.biome === 'frozen_summit') {
            pr = 0.92; pg = 0.14; pb = 0.2;
            cr = 1.0; cg = 0.86; cb = 0.52;
            fxHex = '#D92234';
          } else {
            // Obsidian Pit Wardens: deep crimson-bronze & stygian jade edge
            pr = 0.84; pg = 0.18; pb = 0.26;
            cr = 0.96; cg = 0.84; cb = 0.54;
            fxHex = '#D83244';
          }

          this.spawnParticle(
            'shockwave',
            ev.pos.x,
            ev.pos.y,
            8,
            0,
            0,
            0,
            42,
            360,
            pr,
            pg,
            pb,
            0.68,
            0.36,
            1.35
          );
          this.spawnSlashRibbon(
            'whip',
            ev.pos.x,
            ev.pos.y,
            0,
            Math.PI * 2,
            235,
            18,
            pr,
            pg,
            pb,
            cr,
            cg,
            cb,
            0.32,
            1
          );
          // Crisp radial directional spark-streak burst keeping boss silhouette 100% legible
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2 + this.randRange(-0.1, 0.1);
            const spd = this.randRange(240, 480);
            this.spawnParticle(
              'spark_streak',
              ev.pos.x + Math.cos(a) * 36,
              ev.pos.y + Math.sin(a) * 24,
              28,
              Math.cos(a) * spd,
              Math.sin(a) * spd,
              this.randRange(25, 110),
              this.randRange(26, 40),
              4,
              k % 2 === 0 ? cr : pr,
              k % 2 === 0 ? cg : pg,
              k % 2 === 0 ? cb : pb,
              0.96,
              0.26,
              1.85,
              a,
              0
            );
          }
          this.spawnDecal('crater', ev.pos.x, ev.pos.y, 1.75, 1.75, this.randRange(0, 6.28), 1, 1, 1, 0.78, 22);
          this.spawnDecal('scorch', ev.pos.x, ev.pos.y, 1.95, 1.95, 0, 1, 1, 1, 0.66, 22);
          this.triggerScreenFx({
            kind: 'boss_phase',
            intensity: 0.76,
            worldX: ev.pos.x,
            worldY: ev.pos.y,
            colorHex: fxHex,
          });
          break;
        }

        case 'status_applied':
        case 'status_triggered': {
          const [r, g, b] = this.statusColor(ev.statusId);
          for (let k = 0; k < 6; k++) {
            const a = this.randRange(0, Math.PI * 2);
            this.spawnParticle(
              'spark_streak',
              ev.pos.x,
              ev.pos.y,
              26,
              Math.cos(a) * 165,
              Math.sin(a) * 165,
              55,
              20,
              4,
              r,
              g,
              b,
              1,
              0.26,
              1.85,
              a,
              0
            );
          }
          break;
        }

        case 'god_call': {
          this.spawnPatronAccentBurst(ev.patronId, ev.pos.x, ev.pos.y, ev.greater ? 2.2 : 1.4);
          const colorHex = PATRON_CONSTANTS[ev.patronId].colorHex;
          const [r, g, b] = hexToRgbaTuple(colorHex);
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
          if (ev.greater) {
            this.triggerScreenFx({
              kind: 'greater_call',
              intensity: 0.85,
              worldX: ev.pos.x,
              worldY: ev.pos.y,
              colorHex,
            });
          }
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
          this.triggerScreenFx({
            kind: 'death_defiance',
            intensity: 1.0,
            worldX: ev.pos.x,
            worldY: ev.pos.y,
            colorHex: '#FFD266',
          });
          break;
        }

        case 'pickup_collected': {
          const [r, g, b] = ev.patronId
            ? hexToRgbaTuple(PATRON_CONSTANTS[ev.patronId].colorHex)
            : [1.0, 0.85, 0.35];
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            this.spawnParticle(
              'spark_streak',
              ev.pos.x,
              ev.pos.y,
              22,
              Math.cos(a) * 145,
              Math.sin(a) * 145,
              90,
              20,
              3,
              r,
              g,
              b,
              1,
              0.32,
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
        return isDashStrike ? 232 : comboStep === 2 ? 260 : 218;
      case 'eternal_spear':
        return 306;
      case 'shield_of_chaos':
        return 162;
      case 'twin_fists':
        return 142;
      default:
        return 172;
    }
  }

  /**
   * Advances all pools and post-FX pulses by `dt` seconds. Zero allocations!
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
    this.chromaticAmount = Math.max(0, this.chromaticAmount - safeDt * 0.036);

    if (this.shockwaveActive) {
      this.shockwaveElapsed += safeDt;
      const t = this.shockwaveElapsed / Math.max(0.05, this.shockwaveDuration);
      if (t >= 1) {
        this.shockwaveActive = false;
        this.shockwaveAmp = 0;
        this.shockwaveRadius = 0;
      } else {
        this.shockwaveRadius = 0.03 + 1.16 * Math.pow(t, 0.78);
        this.shockwaveAmp = this.shockwaveMaxAmp * Math.pow(1 - t, 1.35);
      }
    }

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

          this.spawnDecal('foot_scorch', fx, fy, 0.34, 0.34, moveAngle, 1.0, 0.45, 0.14, 0.62, 1.25);
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

    // Biome-specific ambient atmospheric particles
    this.ambientTimer += safeDt;
    const biome = state.room.biome;
    const spawnInterval =
      biome === 'frozen_summit' || biome === 'verdant_colosseum' || biome === 'cinder_mire' ? 0.085 : 0.15;
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
          this.randRange(-56, -18),
          this.randRange(14, 38),
          this.randRange(-76, -40),
          this.randRange(10, 18),
          this.randRange(8, 14),
          0.9,
          0.96,
          1.0,
          0.84,
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
          this.randRange(28, 72),
          this.randRange(8, 28),
          this.randRange(-46, -22),
          this.randRange(12, 20),
          this.randRange(10, 16),
          1.0,
          0.42,
          0.78,
          0.88,
          3.0,
          0.32,
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
          1.45,
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
          0.62,
          1.6,
          0.85
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
          isSanctum ? 0.96 : 0.2,
          isSanctum ? 0.72 : 0.94,
          isSanctum ? 0.3 : 0.72,
          0.54,
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

      if (p.kind === 'shard' || p.kind === 'splash') {
        p.vz -= 460 * safeDt;
        p.vx *= 1 - 1.8 * safeDt;
        p.vy *= 1 - 1.8 * safeDt;
      } else if (p.kind === 'spark_streak') {
        p.vx *= 1 - 3.6 * safeDt;
        p.vy *= 1 - 3.6 * safeDt;
        if (p.vx * p.vx + p.vy * p.vy > 4) {
          p.angle = Math.atan2(p.vy, p.vx);
        }
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
