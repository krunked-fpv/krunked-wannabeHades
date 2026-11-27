/**
 * Krunked WannabeHades — Procedural Web Audio Combat Foley & Patron SFX Synthesizer (Wave 2)
 *
 * Features:
 * - Master DynamicsCompressorNode + safety limiting (non-clipping even in chaotic AoE fights)
 * - Subtle pitch jitter (±8% default) so consecutive swings/hits stay organic
 * - Strict per-ID polyphony caps (<= 4) with click-free voice stealing and micro-cooldowns
 * - Pre-baked reusable noise buffers, waveshaper curves, and cavern hall impulse response
 * - Bespoke combat foley for ALL 6 Infernal Arms (Blade, Spear, Shield, Bow, Fists, Rail),
 *   biome hazards (lava sizzle, poison hiss, curing pool), Soul-Eye shatter, Doom gong,
 *   Hangover fizz, Chill crackle, Chaos void hum, and all 10 Patron chord stingers!
 */

import type { BoonRarity, PatronId, StatusEffectId, WeaponId } from '../contracts/index';
import {
  PATRON_AUDIO_PROFILES,
  SFX_MANIFEST,
  type SfxId,
} from './soundManifest';

export interface PlaySfxOptions {
  readonly volume?: number;
  readonly pitchScale?: number;
  readonly pan?: number;
  readonly patronId?: PatronId;
  readonly weaponId?: WeaponId;
  readonly statusId?: StatusEffectId;
  readonly rarity?: BoonRarity;
  readonly greater?: boolean;
  readonly isDashStrike?: boolean;
  readonly isBoss?: boolean;
}

interface ActiveVoice {
  readonly stopTime: number;
  readonly gainNode: GainNode;
  readonly stopFns: (() => void)[];
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function makeDriveCurve(amount: number, samples = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const k = Math.max(1, amount);
  const norm = Math.tanh(k);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(x * k) / norm;
  }
  return curve;
}

export class ProceduralSfx {
  private readonly ctx: AudioContext;
  private readonly outputBus: GainNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly dryBus: GainNode;
  private readonly wetBus: GainNode;
  private readonly convolver: ConvolverNode;

  private readonly whiteNoise: AudioBuffer;
  private readonly pinkNoise: AudioBuffer;
  private readonly softClipCurve: Float32Array<ArrayBuffer>;
  private readonly hardClipCurve: Float32Array<ArrayBuffer>;

  private readonly activeVoices = new Map<SfxId, ActiveVoice[]>();
  private readonly lastTriggerMs = new Map<SfxId, number>();
  private disposed = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    // Master SFX DynamicsCompressorNode for punchy cohesive glue & zero clipping
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.09;

    this.outputBus = ctx.createGain();
    this.outputBus.gain.value = 0.92;

    this.dryBus = ctx.createGain();
    this.dryBus.gain.value = 1.0;

    this.wetBus = ctx.createGain();
    this.wetBus.gain.value = 0.34;

    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.createCavernImpulse(0.55);

    this.dryBus.connect(this.compressor);
    this.wetBus.connect(this.convolver);
    this.convolver.connect(this.compressor);
    this.compressor.connect(this.outputBus);
    this.outputBus.connect(destination);

    // Pre-bake reusable noise buffers and saturation curves once
    this.whiteNoise = this.createWhiteNoiseBuffer(1.4);
    this.pinkNoise = this.createPinkNoiseBuffer(1.4);
    this.softClipCurve = makeDriveCurve(2.6);
    this.hardClipCurve = makeDriveCurve(7.5);
  }

  play(id: SfxId, opts: PlaySfxOptions = {}): void {
    if (this.disposed || this.ctx.state !== 'running') return;

    const spec = SFX_MANIFEST[id];
    if (!spec) return;

    const nowMs = this.ctx.currentTime * 1000;
    const prevMs = this.lastTriggerMs.get(id) ?? -Infinity;
    if (nowMs - prevMs < spec.minIntervalMs) return;
    this.lastTriggerMs.set(id, nowMs);

    const now = this.ctx.currentTime;
    const maxPoly = Math.min(4, spec.maxPolyphony);
    const list = this.pruneAndEnforcePolyphony(id, maxPoly, now);

    // Pitch jitter (±8% default from manifest)
    const jitter = spec.pitchJitter;
    const jitterMult = 1 + (Math.random() * 2 - 1) * jitter;
    const pitch = clamp((opts.pitchScale ?? 1) * jitterMult, 0.45, 2.5);
    const gain = clamp(spec.defaultGain * (opts.volume ?? 1), 0.01, 1.25);

    // Voice output stage (optional stereo pan -> dry + wet reverb send)
    const voiceGain = this.ctx.createGain();
    voiceGain.gain.setValueAtTime(gain, now);

    let routeOut: AudioNode = voiceGain;
    if (
      typeof this.ctx.createStereoPanner === 'function' &&
      opts.pan !== undefined &&
      Number.isFinite(opts.pan) &&
      Math.abs(opts.pan) > 0.01
    ) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(clamp(opts.pan, -0.75, 0.75), now);
      voiceGain.connect(panner);
      routeOut = panner;
    }

    routeOut.connect(this.dryBus);
    if (spec.reverbSend > 0.01) {
      const send = this.ctx.createGain();
      send.gain.setValueAtTime(spec.reverbSend, now);
      routeOut.connect(send);
      send.connect(this.wetBus);
    }

    const stopFns: (() => void)[] = [];
    const duration = this.synthesize(id, voiceGain, now, pitch, opts, stopFns);
    const stopTime = now + duration + 0.04;

    list.push({ stopTime, gainNode: voiceGain, stopFns });
  }

  /**
   * Play a standalone Patron harmonic chord stinger keyed to any of the 10 PatronIds.
   */
  playPatronStinger(
    patronId: PatronId,
    style: 'offer' | 'select' | 'call' | 'greater_call' = 'offer',
    rarity?: BoonRarity
  ): void {
    const id: SfxId =
      style === 'select' ? 'boon_select' : style === 'offer' ? 'boon_offer' : 'god_call';
    this.play(id, {
      patronId,
      rarity,
      greater: style === 'greater_call',
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const voices of this.activeVoices.values()) {
      for (const v of voices) {
        for (const fn of v.stopFns) {
          try {
            fn();
          } catch {
            // ignore already-stopped nodes
          }
        }
      }
    }
    this.activeVoices.clear();
    this.lastTriggerMs.clear();
    try {
      this.dryBus.disconnect();
      this.wetBus.disconnect();
      this.convolver.disconnect();
      this.compressor.disconnect();
      this.outputBus.disconnect();
    } catch {
      // ignore disconnect errors during teardown
    }
  }

  private pruneAndEnforcePolyphony(id: SfxId, maxPoly: number, now: number): ActiveVoice[] {
    let list = this.activeVoices.get(id);
    if (!list) {
      list = [];
      this.activeVoices.set(id, list);
    }
    let writeIdx = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].stopTime > now) {
        list[writeIdx++] = list[i];
      }
    }
    list.length = writeIdx;

    while (list.length >= maxPoly) {
      const oldest = list.shift();
      if (oldest) {
        try {
          oldest.gainNode.gain.cancelScheduledValues(now);
          oldest.gainNode.gain.setValueAtTime(Math.max(0.0001, oldest.gainNode.gain.value), now);
          oldest.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
          for (const stop of oldest.stopFns) {
            stop();
          }
        } catch {
          // safe ignore
        }
      }
    }
    return list;
  }

  // ============================================================================
  // Master Synthesis Router (All 54 Canonical SFX IDs)
  // ============================================================================

  private synthesize(
    id: SfxId,
    dest: AudioNode,
    now: number,
    pitch: number,
    opts: PlaySfxOptions,
    stops: (() => void)[]
  ): number {
    switch (id) {
      case 'sword_swing_1':
        return this.synthWeaponSwing(dest, now, pitch, 1, opts, stops);
      case 'sword_swing_2':
        return this.synthWeaponSwing(dest, now, pitch, 2, opts, stops);
      case 'sword_swing_3':
        return this.synthWeaponSwing(dest, now, pitch, 3, opts, stops);
      case 'sword_nova':
        return this.synthNovaSmash(dest, now, pitch, opts, stops);
      case 'dash':
        return this.synthDash(dest, now, pitch, false, opts.patronId, stops);
      case 'dash_perfect':
        return this.synthDash(dest, now, pitch, true, opts.patronId, stops);
      case 'cast_fire':
        return this.synthCastFire(dest, now, pitch, opts.patronId, stops);
      case 'cast_pickup':
        return this.synthCastPickup(dest, now, pitch, stops);
      case 'hit_light':
        return this.synthHitImpact(dest, now, pitch, 'light', stops);
      case 'hit_heavy':
        return this.synthHitImpact(dest, now, pitch, 'heavy', stops);
      case 'hit_crit':
        return this.synthHitCrit(dest, now, pitch, stops);
      case 'hit_backstab':
        return this.synthHitBackstab(dest, now, pitch, stops);
      case 'armor_break':
        return this.synthArmorBreak(dest, now, pitch, stops);
      case 'wall_slam':
        return this.synthWallSlam(dest, now, pitch, stops);
      case 'deflect':
        return this.synthDeflect(dest, now, pitch, stops);
      case 'enemy_death':
        return this.synthEnemyDeath(dest, now, pitch, stops);
      case 'final_kill_boom':
        return this.synthFinalKillBoom(dest, now, pitch, stops);
      case 'boss_phase':
        return this.synthBossPhase(dest, now, pitch, stops);
      case 'boon_offer':
        return this.synthPatronChord(dest, now, pitch, opts.patronId, 'offer', opts.rarity, stops);
      case 'boon_select':
        return this.synthPatronChord(dest, now, pitch, opts.patronId, 'select', opts.rarity, stops);
      case 'god_call':
        return this.synthPatronChord(
          dest,
          now,
          pitch,
          opts.patronId,
          opts.greater ? 'greater_call' : 'call',
          opts.rarity,
          stops
        );
      case 'player_hit':
        return this.synthPlayerHit(dest, now, pitch, stops);
      case 'death_defiance':
        return this.synthDeathDefiance(dest, now, pitch, stops);
      case 'door_unlock':
        return this.synthDoorUnlock(dest, now, pitch, stops);
      case 'room_enter':
        return this.synthRoomEnter(dest, now, pitch, stops);
      case 'ui_click':
        return this.synthUi(dest, now, pitch, 'click', stops);
      case 'ui_hover':
        return this.synthUi(dest, now, pitch, 'hover', stops);
      case 'ui_confirm':
        return this.synthUi(dest, now, pitch, 'confirm', stops);
      case 'ui_back':
        return this.synthUi(dest, now, pitch, 'back', stops);
      case 'pickup_collect':
        return this.synthPickup(dest, now, pitch, opts.patronId, stops);
      case 'status_proc':
        return this.synthStatusProc(dest, now, pitch, opts.statusId, stops);
      case 'enemy_spawn':
        return this.synthEnemySpawn(dest, now, pitch, Boolean(opts.isBoss), stops);

      // Wave 2 — Bespoke 6 Infernal Arms
      case 'spear_thrust':
        return this.synthSpearThrust(dest, now, pitch, Boolean(opts.isDashStrike), stops);
      case 'spear_spin':
        return this.synthSpearSpin(dest, now, pitch, stops);
      case 'spear_recall':
        return this.synthSpearRecall(dest, now, pitch, stops);
      case 'shield_bash':
        return this.synthShieldBash(dest, now, pitch, Boolean(opts.isDashStrike), stops);
      case 'shield_clang':
        return this.synthShieldClang(dest, now, pitch, stops);
      case 'shield_boomerang':
        return this.synthShieldBoomerang(dest, now, pitch, stops);
      case 'bow_draw':
        return this.synthBowDraw(dest, now, pitch, stops);
      case 'bow_power_shot':
        return this.synthBowPowerShot(dest, now, pitch, stops);
      case 'bow_volley':
        return this.synthBowVolley(dest, now, pitch, stops);
      case 'fists_flurry':
        return this.synthFistsFlurry(dest, now, pitch, Boolean(opts.isDashStrike), stops);
      case 'fists_uppercut':
        return this.synthFistsUppercut(dest, now, pitch, stops);
      case 'rail_shot':
        return this.synthRailShot(dest, now, pitch, stops);
      case 'rail_reload':
        return this.synthRailReload(dest, now, pitch, stops);
      case 'rail_mortar':
        return this.synthRailMortar(dest, now, pitch, stops);

      // Wave 2 — Biome Hazards, Soul-Eye, Statuses & Chaos
      case 'lava_sizzle':
        return this.synthLavaSizzle(dest, now, pitch, stops);
      case 'poison_hiss':
        return this.synthPoisonHiss(dest, now, pitch, stops);
      case 'curing_pool_chime':
        return this.synthCuringPoolChime(dest, now, pitch, stops);
      case 'soul_eye_shatter':
        return this.synthSoulEyeShatter(dest, now, pitch, stops);
      case 'doom_gong':
        return this.synthDoomGong(dest, now, pitch, stops);
      case 'hangover_fizz':
        return this.synthHangoverFizz(dest, now, pitch, stops);
      case 'chill_crackle':
        return this.synthChillCrackle(dest, now, pitch, stops);
      case 'chaos_void_hum':
        return this.synthChaosVoidHum(dest, now, pitch, stops);
    }
  }

  // ============================================================================
  // Wave 2 Bespoke Infernal Arms (Spear, Shield, Bow, Twin Fists, Adamant Rail)
  // ============================================================================

  /** Eternal Spear: 3-layer razor-focused piercing jab + keen steel polearm whistle + sub snap. */
  private synthSpearThrust(
    dest: AudioNode,
    now: number,
    pitch: number,
    isDashStrike: boolean,
    stops: (() => void)[]
  ): number {
    const p = pitch * (isDashStrike ? 1.14 : 1.0);
    const dur = 0.18;

    // Layer 1 — High Transient Bite (2.4kHz–6.2kHz razor air cut & spearhead glint)
    this.transientBand(dest, this.whiteNoise, 5200 * p, 1850 * p, 4.4, now, 0.022, 0.56, stops);
    const noise = this.startNoise(this.whiteNoise, now, dur, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(5.0, now);
    bp.frequency.setValueAtTime(clamp(2550 * p, 400, 11000), now);
    bp.frequency.exponentialRampToValueAtTime(clamp(680 * p, 200, 5000), now + dur * 0.9);
    const nEnv = this.ctx.createGain();
    nEnv.gain.setValueAtTime(0.001, now);
    nEnv.gain.linearRampToValueAtTime(0.62, now + 0.012);
    nEnv.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(bp);
    bp.connect(nEnv);
    nEnv.connect(dest);

    // Layer 2 — Waveshaped Mid Body (shaft & bronze tip resonance)
    this.shapedTone(dest, 'triangle', 520 * p, 240 * p, now, 0.085, 0.34, this.softClipCurve, 1800, stops);
    this.tone(dest, 'sine', 2080 * p, 1480 * p, now, 0.08, 0.19, stops);

    // Layer 3 — Tight Sub-Bass Weight (visceral lunge thrust)
    this.tone(dest, 'sine', (isDashStrike ? 155 : 122) * p, 52, now, isDashStrike ? 0.11 : 0.08, isDashStrike ? 0.44 : 0.3, stops);
    return dur;
  }

  /** Eternal Spear: 360° charging Spin Attack vortex sweep + waveshaped bronze arc + sub surge. */
  private synthSpearSpin(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.48;

    // Layer 1 — Swirling high transient vortex sweep
    this.transientBand(dest, this.whiteNoise, 4600 * pitch, 2100 * pitch, 3.2, now, 0.028, 0.48, stops);
    const noise = this.startNoise(this.pinkNoise, now, dur, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(3.0, now);
    bp.frequency.setValueAtTime(420 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(2950 * pitch, now + 0.14);
    bp.frequency.exponentialRampToValueAtTime(900 * pitch, now + 0.28);
    bp.frequency.exponentialRampToValueAtTime(2200 * pitch, now + 0.36);
    bp.frequency.exponentialRampToValueAtTime(340, now + dur);

    const nEnv = this.ctx.createGain();
    nEnv.gain.setValueAtTime(0.001, now);
    nEnv.gain.linearRampToValueAtTime(0.75, now + 0.04);
    nEnv.gain.setValueAtTime(0.62, now + 0.28);
    nEnv.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(bp);
    bp.connect(nEnv);
    nEnv.connect(dest);

    // Layer 2 — Waveshaped mid bronze spin body + FM ring
    this.shapedTone(dest, 'sawtooth', 320 * pitch, 180 * pitch, now, 0.22, 0.24, this.softClipCurve, 1300, stops);
    this.fmTone(dest, 587.33 * pitch, 880 * pitch, 250, now, 0.38, 0.3, stops);

    // Layer 3 — Sub-bass rotational momentum drop
    this.tone(dest, 'sine', 135 * pitch, 48, now, 0.28, 0.52, stops);
    return dur;
  }

  /** Eternal Spear: high-velocity piercing Recall zip + crisp handle snap. */
  private synthSpearRecall(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.29;

    // Rising magnetic zip sweep
    const zip = this.startNoise(this.pinkNoise, now, 0.2, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(4.2, now);
    bp.frequency.setValueAtTime(540 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(3300 * pitch, now + 0.18);
    const zEnv = this.ctx.createGain();
    zEnv.gain.setValueAtTime(0.001, now);
    zEnv.gain.linearRampToValueAtTime(0.58, now + 0.05);
    zEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    zip.connect(bp);
    bp.connect(zEnv);
    zEnv.connect(dest);

    // Ascending metallic shimmer + tactile 3-layer catch lock at 150ms
    this.tone(dest, 'sine', 520 * pitch, 1520 * pitch, now, 0.17, 0.28, stops);
    this.transientBand(dest, this.whiteNoise, 3800 * pitch, 1600 * pitch, 3.0, now + 0.15, 0.018, 0.45, stops);
    this.shapedTone(dest, 'triangle', 640 * pitch, 290 * pitch, now + 0.15, 0.085, 0.4, this.softClipCurve, 1800, stops);
    this.tone(dest, 'sine', 120 * pitch, 54, now + 0.15, 0.095, 0.42, stops);
    return dur;
  }

  /** Shield of Chaos: 3-layer heavy bronze-and-iron slam bash. */
  private synthShieldBash(
    dest: AudioNode,
    now: number,
    pitch: number,
    isDashStrike: boolean,
    stops: (() => void)[]
  ): number {
    const dur = 0.28;
    const boost = isDashStrike ? 1.12 : 1.0;

    // Layer 1 — Metallic bronze rim impact crack (2.2kHz–4.8kHz)
    this.transientBand(dest, this.whiteNoise, 4200 * pitch, 1900 * pitch, 2.4, now, 0.02, 0.54, stops);

    // Layer 2 — Waveshaped mid bronze body slam + FM face resonance
    this.shapedTone(dest, 'sawtooth', 290 * pitch, 120 * pitch, now, 0.12, 0.38, this.softClipCurve, 1200, stops);
    this.fmTone(dest, 310 * pitch, 468 * pitch, 320, now, 0.23, 0.38, stops);

    // Layer 3 — Deep sub-bass bronze mass thump (115Hz -> 36Hz)
    this.tone(dest, 'sine', 118 * pitch * boost, 36, now, 0.22, 0.88, stops);

    // Heavy air displacement shock
    const thud = this.startNoise(this.pinkNoise, now, 0.16, stops);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.15);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.54, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    thud.connect(lp);
    lp.connect(env);
    env.connect(dest);

    return dur;
  }

  /** Shield of Chaos: 3-layer resonant armored block / Bull Rush bronze clang! */
  private synthShieldClang(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.54;
    const f0 = 392.0 * pitch; // G4 noble bronze ring

    // Layer 1 — Crisp metal-on-metal spark impact (2.6kHz–6.2kHz)
    this.transientBand(dest, this.whiteNoise, 5400 * pitch, 2400 * pitch, 2.2, now, 0.022, 0.6, stops);

    // Layer 2 — Waveshaped resonant bronze bell & harmonics
    this.shapedTone(dest, 'triangle', f0 * 0.75, f0 * 0.5, now, 0.11, 0.32, this.softClipCurve, 1600, stops);
    this.fmTone(dest, f0, f0 * 1.48, 380, now, 0.48, 0.48, stops);
    this.tone(dest, 'triangle', f0 * 2.0, f0 * 1.98, now, 0.36, 0.25, stops);
    this.tone(dest, 'sine', f0 * 3.12, f0 * 3.08, now, 0.22, 0.17, stops);

    // Layer 3 — Tight sub-bass shield rebound weight
    this.tone(dest, 'sine', 115 * pitch, 46, now, 0.14, 0.48, stops);
    return dur;
  }

  /** Shield of Chaos: spinning Rebound Throw / Blitz Disc boomerang whirr! */
  private synthShieldBoomerang(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.44;

    // Layer 1 — Crisp bronze edge launch zip
    this.transientBand(dest, this.whiteNoise, 4600 * pitch, 2000 * pitch, 3.0, now, 0.02, 0.48, stops);

    // Rhythmic spinning blade-disc AM modulation (19 Hz rotation flutter)
    const disc = this.startNoise(this.pinkNoise, now, dur, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(3.6, now);
    bp.frequency.setValueAtTime(1450 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(720 * pitch, now + dur);

    const spinGain = this.ctx.createGain();
    spinGain.gain.setValueAtTime(0.48, now);
    spinGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(19, now);
    const lfoDepth = this.ctx.createGain();
    lfoDepth.gain.setValueAtTime(0.24, now);
    lfo.connect(lfoDepth);
    lfoDepth.connect(spinGain.gain);
    this.scheduleOsc(lfo, now, now + dur + 0.02, stops);

    disc.connect(bp);
    bp.connect(spinGain);
    spinGain.connect(dest);

    // Layer 2 & 3 — Bronze launch ping + sub sling kick
    this.fmTone(dest, 523.25 * pitch, 784 * pitch, 210, now, 0.3, 0.36, stops);
    this.tone(dest, 'sine', 120 * pitch, 52, now, 0.11, 0.38, stops);
    return dur;
  }

  /** Heart-Seeking Bow: taut string draw tension creak. */
  private synthBowDraw(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.34;
    this.shapedTone(dest, 'triangle', 175 * pitch, 370 * pitch, now, dur * 0.9, 0.24, this.softClipCurve, 1200, stops);

    const friction = this.startNoise(this.pinkNoise, now, dur, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(6.0, now);
    bp.frequency.setValueAtTime(620 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(1650 * pitch, now + dur * 0.85);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.32, now + 0.08);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);
    friction.connect(bp);
    bp.connect(env);
    env.connect(dest);
    return dur;
  }

  /** Heart-Seeking Bow: 3-layer taut bowstring snap + feathered zip + golden Power Shot chime! */
  private synthBowPowerShot(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.45;

    // Layer 1 — Crisp bowstring leather snap & feathered sonic zip (3.2kHz–6.2kHz)
    this.transientBand(dest, this.whiteNoise, 5800 * pitch, 2200 * pitch, 2.8, now, 0.018, 0.58, stops);
    const zip = this.startNoise(this.whiteNoise, now, 0.14, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(3.2, now);
    bp.frequency.setValueAtTime(3600 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(980 * pitch, now + 0.13);
    const zEnv = this.ctx.createGain();
    zEnv.gain.setValueAtTime(0.46, now);
    zEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    zip.connect(bp);
    bp.connect(zEnv);
    zEnv.connect(dest);

    // Layer 2 — Waveshaped resonant bowstring & timber twang body (220Hz–520Hz)
    this.shapedTone(dest, 'triangle', 420 * pitch, 155 * pitch, now, 0.13, 0.5, this.softClipCurve, 1900, stops);

    // Layer 3 — Tight sub-bass release kick (125Hz -> 50Hz)
    this.tone(dest, 'sine', 125 * pitch, 50, now, 0.11, 0.44, stops);

    // Radiant golden Power Shot harmonic chime (D6 -> A6 -> D7!)
    const f1 = 1174.66 * pitch;
    this.tone(dest, 'sine', f1, f1 * 1.005, now + 0.005, 0.34, 0.36, stops);
    this.tone(dest, 'triangle', f1 * 1.5, f1 * 1.51, now + 0.025, 0.32, 0.28, stops);
    this.tone(dest, 'sine', f1 * 2.0, f1 * 2.0, now + 0.045, 0.28, 0.16, stops);
    return dur;
  }

  /** Heart-Seeking Bow: 9-arrow Special Volley Fan cascading release! */
  private synthBowVolley(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.34;
    this.tone(dest, 'sine', 118 * pitch, 48, now, 0.12, 0.42, stops);
    for (let i = 0; i < 5; i++) {
      const t = now + i * 0.02;
      const stepPitch = pitch * (0.94 + i * 0.045);
      this.shapedTone(dest, 'triangle', 360 * stepPitch, 165 * stepPitch, t, 0.085, 0.28, this.softClipCurve, 1800, stops);
      this.tone(dest, 'sine', 1480 * stepPitch, 940 * stepPitch, t, 0.075, 0.15, stops);
    }

    const fan = this.startNoise(this.pinkNoise, now, 0.24, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(2.0, now);
    bp.frequency.setValueAtTime(2900 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(750 * pitch, now + 0.22);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.62, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    fan.connect(bp);
    bp.connect(env);
    env.connect(dest);
    return dur;
  }

  /** Twin Gauntlets: 3-layer rapid snappy gauntlet jab + ember crack + knuckle sub. */
  private synthFistsFlurry(
    dest: AudioNode,
    now: number,
    pitch: number,
    isDashStrike: boolean,
    stops: (() => void)[]
  ): number {
    const p = pitch * (isDashStrike ? 1.12 : 1.0);
    const dur = 0.12;

    // Layer 1 — Snappy ember-leather transient crack (2.4kHz–5.4kHz)
    this.transientBand(dest, this.whiteNoise, 4600 * p, 1900 * p, 2.4, now, 0.016, 0.56, stops);
    const snap = this.startNoise(this.pinkNoise, now, 0.08, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(2.4, now);
    bp.frequency.setValueAtTime(clamp(1650 * p, 300, 7000), now);
    bp.frequency.exponentialRampToValueAtTime(340, now + 0.075);
    const nEnv = this.ctx.createGain();
    nEnv.gain.setValueAtTime(0.62, now);
    nEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    snap.connect(bp);
    bp.connect(nEnv);
    nEnv.connect(dest);

    // Layer 2 — Waveshaped mid punch body (380Hz -> 145Hz)
    this.shapedTone(dest, 'triangle', 380 * p, 145 * p, now, 0.06, 0.38, this.softClipCurve, 1500, stops);

    // Layer 3 — Tight knuckle sub-thump (122Hz -> 50Hz)
    this.tone(dest, 'sine', 122 * p, 50, now, 0.085, 0.62, stops);
    return dur;
  }

  /** Twin Gauntlets: explosive 3-layer Rising Uppercut (twin ascending strikes + fiery lift!). */
  private synthFistsUppercut(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.38;

    // Layer 1 — Twin fiery transient cracks (0ms & 65ms)
    this.transientBand(dest, this.whiteNoise, 4400 * pitch, 1900 * pitch, 2.2, now, 0.018, 0.54, stops);
    this.transientBand(dest, this.whiteNoise, 5200 * pitch, 2100 * pitch, 2.2, now + 0.065, 0.024, 0.64, stops);

    // Layer 2 — Waveshaped ascending uppercut roar
    this.shapedTone(dest, 'sawtooth', 240 * pitch, 560 * pitch, now + 0.055, 0.16, 0.3, this.softClipCurve, 2100, stops);

    // Layer 3 — Twin sub-bass knockout thumps
    this.tone(dest, 'sine', 120 * pitch, 54, now, 0.12, 0.62, stops);
    this.tone(dest, 'sine', 135 * pitch, 40, now + 0.065, 0.24, 0.84, stops);

    const flame = this.startNoise(this.pinkNoise, now + 0.03, 0.28, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.8, now);
    bp.frequency.setValueAtTime(600, now + 0.03);
    bp.frequency.exponentialRampToValueAtTime(2700 * pitch, now + 0.14);
    bp.frequency.exponentialRampToValueAtTime(420, now + 0.3);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.62, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.31);
    flame.connect(bp);
    bp.connect(env);
    env.connect(dest);
    return dur;
  }

  /** Adamant Rail: 3-layer punchy mechanical muzzle crack + hard-clipped bark + chamber sub. */
  private synthRailShot(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.14;

    // Layer 1 — Supersonic high-frequency muzzle crack (2.8kHz–6.4kHz)
    this.transientBand(dest, this.whiteNoise, 6000 * pitch, 2400 * pitch, 1.8, now, 0.018, 0.64, stops);
    const crack = this.startNoise(this.whiteNoise, now, 0.068, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.3, now);
    bp.frequency.setValueAtTime(2800 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(620, now + 0.064);

    const drive = this.ctx.createWaveShaper();
    drive.curve = this.hardClipCurve;

    const cEnv = this.ctx.createGain();
    cEnv.gain.setValueAtTime(0.58, now);
    cEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.068);

    crack.connect(bp);
    bp.connect(drive);
    drive.connect(cEnv);
    cEnv.connect(dest);

    // Layer 2 — Waveshaped mechanical bark + brass bolt ping
    this.shapedTone(dest, 'sawtooth', 390 * pitch, 120 * pitch, now, 0.075, 0.42, this.hardClipCurve, 1900, stops);
    this.tone(dest, 'triangle', 1280 * pitch, 740 * pitch, now, 0.04, 0.2, stops);

    // Layer 3 — Tight chamber recoil sub (115Hz -> 48Hz)
    this.tone(dest, 'sine', 115 * pitch, 48, now, 0.085, 0.5, stops);
    return dur;
  }

  /** Adamant Rail: tactile 2-stage magazine eject & heavy bolt-rack reload clack! */
  private synthRailReload(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.42;

    // Stage 1 (0ms): crisp mag release metallic click
    this.tone(dest, 'square', 920 * pitch, 480 * pitch, now, 0.045, 0.24, stops);
    this.tone(dest, 'sine', 2100 * pitch, 1400 * pitch, now, 0.035, 0.18, stops);

    // Stage 2 (140ms): heavy iron bolt-rack clack-lock
    const t2 = now + 0.14;
    this.fmTone(dest, 420 * pitch, 670 * pitch, 300, t2, 0.11, 0.38, stops);
    this.tone(dest, 'sine', 210 * pitch, 82, t2, 0.08, 0.42, stops);

    // Stage 3 (240ms): energized chamber charge ready ping
    const t3 = now + 0.24;
    this.tone(dest, 'triangle', 740 * pitch, 1174.66 * pitch, t3, 0.14, 0.26, stops);
    return dur;
  }

  /** Adamant Rail: Special Bombard Shell mortar launch thump + explosive boom! */
  private synthRailMortar(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.64;

    // 1. Hollow mortar tube thump ("thoomp!")
    this.tone(dest, 'sine', 180 * pitch, 46, now, 0.18, 0.72, stops);
    this.tone(dest, 'triangle', 260 * pitch, 95, now, 0.12, 0.34, stops);

    // 2. Concussive bombardment blast wave (layered crisp boom + fiery rumble)
    const blast = this.startNoise(this.pinkNoise, now + 0.03, 0.54, stops);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, now + 0.03);
    lp.frequency.exponentialRampToValueAtTime(160, now + 0.55);

    const drive = this.ctx.createWaveShaper();
    drive.curve = this.softClipCurve;

    const bEnv = this.ctx.createGain();
    bEnv.gain.setValueAtTime(0.001, now + 0.03);
    bEnv.gain.linearRampToValueAtTime(0.82, now + 0.055);
    bEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    blast.connect(lp);
    lp.connect(drive);
    drive.connect(bEnv);
    bEnv.connect(dest);

    this.tone(dest, 'sine', 120 * pitch, 30, now + 0.04, 0.46, 0.85, stops);
    return dur;
  }

  // ============================================================================
  // Wave 2 Biome Hazards, Special Enemies, Statuses & Chaos
  // ============================================================================

  /** Cinder Mire: searing molten lava sizzle + low magma rumble. */
  private synthLavaSizzle(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.36;

    // High-frequency searing steam sizzle
    const sizzle = this.startNoise(this.whiteNoise, now, dur, stops);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.Q.setValueAtTime(1.4, now);
    hp.frequency.setValueAtTime(4200 * pitch, now);
    hp.frequency.exponentialRampToValueAtTime(1800 * pitch, now + dur);
    const sEnv = this.ctx.createGain();
    sEnv.gain.setValueAtTime(0.001, now);
    sEnv.gain.linearRampToValueAtTime(0.56, now + 0.025);
    sEnv.gain.exponentialRampToValueAtTime(0.001, now + dur);
    sizzle.connect(hp);
    hp.connect(sEnv);
    sEnv.connect(dest);

    // Molten bubble throb
    this.tone(dest, 'sine', 95 * pitch, 52, now, 0.24, 0.38, stops);
    return dur;
  }

  /** Crypt of Bile: caustic toxic poison hiss + bubbling acid pops. */
  private synthPoisonHiss(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.38;

    const hiss = this.startNoise(this.pinkNoise, now, dur, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(3.2, now);
    bp.frequency.setValueAtTime(2600 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(1100 * pitch, now + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.52, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);
    hiss.connect(bp);
    bp.connect(env);
    env.connect(dest);

    // Caustic liquid bubble pops
    const pops = [540, 780, 630];
    for (let i = 0; i < pops.length; i++) {
      const t = now + 0.03 + i * 0.075;
      this.tone(dest, 'sine', pops[i] * pitch, pops[i] * 1.65 * pitch, t, 0.06, 0.22, stops);
    }
    return dur;
  }

  /** Crypt of Bile / Fountain: pure cleansing curing-pool water & crystal bell chime! */
  private synthCuringPoolChime(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.82;

    // Sparkling water cascade shimmer
    const splash = this.startNoise(this.pinkNoise, now, 0.38, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(2.6, now);
    bp.frequency.setValueAtTime(900, now);
    bp.frequency.exponentialRampToValueAtTime(3600, now + 0.25);
    const sEnv = this.ctx.createGain();
    sEnv.gain.setValueAtTime(0.001, now);
    sEnv.gain.linearRampToValueAtTime(0.32, now + 0.06);
    sEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    splash.connect(bp);
    bp.connect(sEnv);
    sEnv.connect(dest);

    // Pure cleansing Lydian crystal bells (D5 -> F#5 -> A5 -> D6)
    const notes = [587.33, 739.99, 880.0, 1174.66];
    for (let i = 0; i < notes.length; i++) {
      const t = now + i * 0.07;
      const f = notes[i] * pitch;
      this.tone(dest, 'sine', f, f * 1.004, t, 0.56 - i * 0.05, 0.3, stops);
      this.tone(dest, 'triangle', f * 2, f * 2, t + 0.01, 0.35, 0.14, stops);
    }
    return dur;
  }

  /** Verdant Colosseum: Soul-Eye regeneration orb crystalline shatter + ghostly wisp fade. */
  private synthSoulEyeShatter(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.56;

    // Ethereal glassy core pop
    this.fmTone(dest, 880 * pitch, 1320 * pitch, 280, now, 0.34, 0.36, stops);
    this.tone(dest, 'sine', 1760 * pitch, 660 * pitch, now, 0.26, 0.24, stops);

    // Shimmering spirit crystal shards
    const shards = [2480, 3120, 3890, 4640, 2940];
    for (let i = 0; i < shards.length; i++) {
      const t = now + i * 0.025;
      const f = shards[i] * pitch;
      this.tone(dest, 'sine', f, f * 0.92, t, 0.22, 0.18, stops);
    }

    // Spirit exhale
    const wisp = this.startNoise(this.pinkNoise, now + 0.02, 0.42, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(3.0, now);
    bp.frequency.setValueAtTime(2200, now + 0.02);
    bp.frequency.exponentialRampToValueAtTime(520, now + 0.44);
    const wEnv = this.ctx.createGain();
    wEnv.gain.setValueAtTime(0.36, now + 0.02);
    wEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    wisp.connect(bp);
    bp.connect(wEnv);
    wEnv.connect(dest);
    return dur;
  }

  /** Bellum Doom: menacing heavy bronze war-gong detonation + crimson sub slam! */
  private synthDoomGong(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.88;
    const f0 = 146.83 * pitch; // D3 dark gong

    // Deep menacing sub drop
    this.tone(dest, 'sine', 130 * pitch, 34, now, 0.5, 0.85, stops);
    // Inharmonic bronze war gong partials (D3 + tritone + metallic ring)
    this.fmTone(dest, f0, f0 * 1.414, 340, now, 0.82, 0.48, stops);
    this.fmTone(dest, f0 * 2.0, f0 * 3.17, 220, now, 0.58, 0.26, stops);
    this.tone(dest, 'sawtooth', f0 * 0.5, f0 * 0.48, now, 0.42, 0.26, stops);
    return dur;
  }

  /** Bacchion Hangover: bubbly purple festive fizz + intoxicating harmonic pops! */
  private synthHangoverFizz(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.34;

    const fizz = this.startNoise(this.whiteNoise, now, 0.3, stops);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3200, now);
    const fEnv = this.ctx.createGain();
    fEnv.gain.setValueAtTime(0.001, now);
    fEnv.gain.linearRampToValueAtTime(0.36, now + 0.025);
    fEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    fizz.connect(hp);
    hp.connect(fEnv);
    fEnv.connect(dest);

    // Sparkling purple nectar bubbles
    const notes = [466.16, 587.33, 698.46, 932.33];
    for (let i = 0; i < notes.length; i++) {
      const t = now + i * 0.048;
      this.tone(dest, 'sine', notes[i] * pitch, notes[i] * 1.18 * pitch, t, 0.075, 0.22, stops);
    }
    return dur;
  }

  /** Glaciera Chill: crisp crystalline ice crackle + frosty breath! */
  private synthChillCrackle(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.36;

    // Staggered glassy ice-shard crackles
    const freqs = [3100, 4420, 3680, 5280, 4120];
    for (let i = 0; i < freqs.length; i++) {
      const t = now + i * 0.028;
      const f = freqs[i] * pitch;
      this.tone(dest, 'sine', f, f * 1.03, t, 0.14, 0.2, stops);
    }

    // Icy gust breath
    const wind = this.startNoise(this.whiteNoise, now, 0.28, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(4.0, now);
    bp.frequency.setValueAtTime(4800, now);
    bp.frequency.exponentialRampToValueAtTime(1600, now + 0.28);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.34, now + 0.04);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    wind.connect(bp);
    bp.connect(env);
    env.connect(dest);
    return dur;
  }

  /** Abyssos Chaos Gate / Realm: eerie primordial void hum + detuned tritone shimmer! */
  private synthChaosVoidHum(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 1.35;

    // Deep detuned void tritone swell (C2 + F#2 + beating sub)
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.setValueAtTime(3.2, now);
    lp.frequency.setValueAtTime(160, now);
    lp.frequency.exponentialRampToValueAtTime(1250, now + 0.55);
    lp.frequency.exponentialRampToValueAtTime(180, now + dur);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.54, now + 0.32);
    env.gain.setValueAtTime(0.46, now + 0.72);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);

    lp.connect(env);
    env.connect(dest);

    const freqs = [65.41, 92.5, 130.81, 195.99];
    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freqs[i] * pitch, now);
      osc.detune.setValueAtTime((i - 1.5) * 14, now);
      osc.connect(lp);
      this.scheduleOsc(osc, now, now + dur + 0.04, stops);
    }

    // Eerie high void harmonic bell
    this.fmTone(dest, 523.25 * pitch, 739.99 * pitch, 140, now + 0.16, 0.95, 0.18, stops);
    return dur;
  }

  // ============================================================================
  // Wave 1 Signature Combat Foley Generators (Preserved & Polished)
  // ============================================================================

  private synthWeaponSwing(
    dest: AudioNode,
    now: number,
    pitch: number,
    comboStep: 1 | 2 | 3,
    opts: PlaySfxOptions,
    stops: (() => void)[]
  ): number {
    const stepPitchMult = comboStep === 1 ? 1.0 : comboStep === 2 ? 1.2 : 1.4;
    const dashBoost = opts.isDashStrike ? 1.1 : 1.0;
    const p = pitch * stepPitchMult * dashBoost;
    const dur = comboStep === 3 ? 0.25 : 0.18;

    // Layer 1 — High Transient Steel Edge Whistle (2.2kHz–5.8kHz)
    this.transientBand(
      dest,
      this.whiteNoise,
      clamp(4200 * p, 1800, 9200),
      clamp(1650 * p, 900, 4800),
      3.4,
      now,
      0.02,
      comboStep === 3 ? 0.54 : 0.42,
      stops
    );

    const noise = this.startNoise(this.pinkNoise, now, dur, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(comboStep === 3 ? 3.0 : 2.1, now);
    const startFreq = 1080 * p;
    const endFreq = (comboStep === 3 ? 440 : 290) * p;
    bp.frequency.setValueAtTime(clamp(startFreq, 200, 9500), now);
    bp.frequency.exponentialRampToValueAtTime(clamp(endFreq, 120, 4000), now + dur * 0.9);

    const nEnv = this.ctx.createGain();
    nEnv.gain.setValueAtTime(0.001, now);
    nEnv.gain.linearRampToValueAtTime(0.72, now + 0.016);
    nEnv.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(bp);
    bp.connect(nEnv);
    nEnv.connect(dest);

    // Layer 2 — Waveshaped Mid Blade Body & Steel Harmonics (240Hz–640Hz)
    const steelBase = 480 * p;
    this.shapedTone(
      dest,
      'triangle',
      steelBase,
      steelBase * 0.56,
      now,
      dur * 0.72,
      comboStep === 3 ? 0.34 : 0.26,
      this.softClipCurve,
      2000,
      stops
    );
    this.tone(dest, 'sine', steelBase * 2.52, steelBase * 1.95, now, dur * 0.55, 0.14, stops);

    // Layer 3 — Tight Sub-Bass Swing Weight (heavier on finisher / dash-strike)
    const heavySwing = comboStep === 3 || Boolean(opts.isDashStrike);
    this.tone(
      dest,
      'sine',
      (heavySwing ? 124 : 104) * pitch,
      heavySwing ? 46 : 56,
      now,
      heavySwing ? 0.13 : 0.08,
      heavySwing ? 0.44 : 0.24,
      stops
    );

    return dur;
  }

  private synthNovaSmash(
    dest: AudioNode,
    now: number,
    pitch: number,
    opts: PlaySfxOptions,
    stops: (() => void)[]
  ): number {
    const dur = 0.52;

    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160 * pitch, now);
    subOsc.frequency.exponentialRampToValueAtTime(34, now + 0.32);

    const drive = this.ctx.createWaveShaper();
    drive.curve = this.softClipCurve;

    const subEnv = this.ctx.createGain();
    subEnv.gain.setValueAtTime(0.001, now);
    subEnv.gain.linearRampToValueAtTime(0.95, now + 0.012);
    subEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    subOsc.connect(drive);
    drive.connect(subEnv);
    subEnv.connect(dest);
    this.scheduleOsc(subOsc, now, now + 0.44, stops);

    const base = (opts.weaponId === 'shield_of_chaos' ? 440 : 587.33) * pitch;
    this.tone(dest, 'triangle', base, base * 0.96, now, 0.44, 0.3, stops);
    this.tone(dest, 'sine', base * 1.5, base * 1.48, now, 0.38, 0.22, stops);
    this.tone(dest, 'sine', base * 2.74, base * 2.68, now, 0.28, 0.14, stops);

    const blast = this.startNoise(this.pinkNoise, now, 0.34, stops);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3600, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.32);
    const bEnv = this.ctx.createGain();
    bEnv.gain.setValueAtTime(0.6, now);
    bEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    blast.connect(lp);
    lp.connect(bEnv);
    bEnv.connect(dest);

    return dur;
  }

  private synthDash(
    dest: AudioNode,
    now: number,
    pitch: number,
    perfect: boolean,
    patronId: PatronId | undefined,
    stops: (() => void)[]
  ): number {
    const dur = perfect ? 0.44 : 0.19;

    const air = this.startNoise(this.pinkNoise, now, 0.18, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(1.8, now);
    bp.frequency.setValueAtTime(520 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(2400 * pitch, now + 0.065);
    bp.frequency.exponentialRampToValueAtTime(640 * pitch, now + 0.17);

    const aEnv = this.ctx.createGain();
    aEnv.gain.setValueAtTime(0.001, now);
    aEnv.gain.linearRampToValueAtTime(0.8, now + 0.02);
    aEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    air.connect(bp);
    bp.connect(aEnv);
    aEnv.connect(dest);

    this.tone(dest, 'sine', 155 * pitch, 62 * pitch, now, 0.09, 0.32, stops);

    if (perfect) {
      const f1 = 1174.66 * pitch;
      const f2 = 1760.0 * pitch;
      this.tone(dest, 'sine', f1, f1 * 1.01, now + 0.01, 0.38, 0.38, stops);
      this.tone(dest, 'triangle', f2, f2 * 1.01, now + 0.055, 0.36, 0.32, stops);
      this.tone(dest, 'sine', f2 * 1.5, f2 * 1.5, now + 0.075, 0.28, 0.16, stops);
    }

    if (patronId) {
      const prof = PATRON_AUDIO_PROFILES[patronId];
      const f = midiToHz(prof.rootMidi + 12) * pitch;
      this.tone(dest, prof.wave, f, f * 1.12, now + 0.015, 0.14, 0.14, stops);
    }

    return dur;
  }

  private synthCastFire(
    dest: AudioNode,
    now: number,
    pitch: number,
    patronId: PatronId | undefined,
    stops: (() => void)[]
  ): number {
    const dur = 0.26;

    const c1 = 1480 * pitch;
    this.tone(dest, 'sine', c1, c1 * 0.68, now, 0.18, 0.42, stops);
    this.tone(dest, 'triangle', c1 * 2.02, c1 * 1.5, now, 0.12, 0.24, stops);
    this.tone(dest, 'sine', c1 * 3.17, c1 * 2.8, now, 0.08, 0.15, stops);

    const click = this.startNoise(this.whiteNoise, now, 0.09, stops);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.Q.setValueAtTime(3.5, now);
    hp.frequency.setValueAtTime(3800 * pitch, now);
    hp.frequency.exponentialRampToValueAtTime(1100 * pitch, now + 0.085);
    const cEnv = this.ctx.createGain();
    cEnv.gain.setValueAtTime(0.52, now);
    cEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    click.connect(hp);
    hp.connect(cEnv);
    cEnv.connect(dest);

    this.tone(dest, 'sine', 240 * pitch, 95 * pitch, now, 0.09, 0.3, stops);

    if (patronId) {
      const prof = PATRON_AUDIO_PROFILES[patronId];
      const pf = midiToHz(prof.rootMidi + 12) * pitch;
      this.tone(dest, 'sine', pf, pf * 1.25, now + 0.02, 0.18, 0.18, stops);
    }

    return dur;
  }

  private synthCastPickup(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.24;
    this.tone(dest, 'sine', 740 * pitch, 740 * pitch, now, 0.11, 0.32, stops);
    this.tone(dest, 'triangle', 1174.66 * pitch, 1174.66 * pitch, now + 0.045, 0.18, 0.34, stops);
    this.tone(dest, 'sine', 2349.32 * pitch, 2349.32 * pitch, now + 0.055, 0.14, 0.14, stops);
    return dur;
  }

  /** 3-Layer Punchy Combat Impact (Transient Bite + Waveshaped Mid Body + Tight Sub-Bass Weight). */
  private synthHitImpact(
    dest: AudioNode,
    now: number,
    pitch: number,
    weight: 'light' | 'heavy',
    stops: (() => void)[]
  ): number {
    const heavy = weight === 'heavy';
    const dur = heavy ? 0.22 : 0.13;

    // Layer 1 — High Transient Bite (1.8kHz–5.8kHz blade crack / metallic strike)
    this.transientBand(
      dest,
      this.whiteNoise,
      (heavy ? 4400 : 5200) * pitch,
      (heavy ? 1650 : 2100) * pitch,
      heavy ? 1.8 : 2.3,
      now,
      heavy ? 0.022 : 0.014,
      heavy ? 0.7 : 0.56,
      stops
    );
    this.tone(
      dest,
      'sine',
      (heavy ? 2400 : 3100) * pitch,
      (heavy ? 1150 : 1550) * pitch,
      now,
      heavy ? 0.028 : 0.02,
      heavy ? 0.24 : 0.18,
      stops
    );

    // Layer 2 — Waveshaped Mid Body Punch (180Hz–540Hz)
    this.shapedTone(
      dest,
      heavy ? 'sawtooth' : 'triangle',
      (heavy ? 360 : 440) * pitch,
      (heavy ? 115 : 175) * pitch,
      now,
      heavy ? 0.1 : 0.06,
      heavy ? 0.5 : 0.38,
      heavy ? this.hardClipCurve : this.softClipCurve,
      heavy ? 1500 : 2100,
      stops
    );

    const crunch = this.startNoise(this.whiteNoise, now, heavy ? 0.095 : 0.055, stops);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.5, now);
    filter.frequency.setValueAtTime((heavy ? 1350 : 2150) * pitch, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + (heavy ? 0.09 : 0.05));

    const drive = this.ctx.createWaveShaper();
    drive.curve = heavy ? this.hardClipCurve : this.softClipCurve;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(heavy ? 0.56 : 0.44, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.095 : 0.055));

    crunch.connect(filter);
    filter.connect(drive);
    drive.connect(env);
    env.connect(dest);

    // Layer 3 — Tight Sub-Bass Punch (115Hz -> 42Hz heavy / 112Hz -> 54Hz light)
    this.tone(
      dest,
      'sine',
      (heavy ? 115 : 112) * pitch,
      heavy ? 42 : 54,
      now,
      heavy ? 0.15 : 0.088,
      heavy ? 0.9 : 0.68,
      stops
    );

    return dur;
  }

  /** Critical Hit: heavy 3-layer impact + incandescent crack + crystalline golden triad shimmer. */
  private synthHitCrit(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.46;

    // 3-layer foundation impact
    this.synthHitImpact(dest, now, pitch * 1.04, 'heavy', stops);

    // Razor electric-gold high transient snap (3.0kHz -> 6.4kHz)
    this.transientBand(dest, this.whiteNoise, 6200 * pitch, 2600 * pitch, 2.6, now, 0.022, 0.66, stops);
    this.tone(dest, 'sawtooth', 980 * pitch, 2880 * pitch, now, 0.042, 0.24, stops);

    // Radiant golden crit shimmer triad (A6 + E7 + A7) + delicate FM bell glint
    const f1 = 1760 * pitch;
    this.fmTone(dest, f1, f1 * 1.5, 220, now + 0.006, 0.34, 0.34, stops);
    this.tone(dest, 'sine', f1, f1 * 1.006, now + 0.005, 0.4, 0.4, stops);
    this.tone(dest, 'triangle', f1 * 1.5, f1 * 1.51, now + 0.014, 0.32, 0.28, stops);
    this.tone(dest, 'sine', f1 * 2.0, f1 * 1.98, now + 0.022, 0.26, 0.18, stops);

    // Extra deep crit confirmation sub thump
    this.tone(dest, 'sine', 108 * pitch, 38, now, 0.17, 0.55, stops);

    return dur;
  }

  /** Backstab: 3-layer lethal steel-rend transient + waveshaped precision slash + sinister glint. */
  private synthHitBackstab(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.26;

    // Layer 1 — Razor high-Q blade rend (3.8kHz -> 1.1kHz)
    this.transientBand(dest, this.whiteNoise, 5600 * pitch, 2200 * pitch, 3.6, now, 0.018, 0.62, stops);
    const slice = this.startNoise(this.whiteNoise, now, 0.11, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(4.5, now);
    bp.frequency.setValueAtTime(3400 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(920 * pitch, now + 0.1);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.55, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    slice.connect(bp);
    bp.connect(env);
    env.connect(dest);

    // Layer 2 — Waveshaped mid body rend + sinister minor-second glint (A5 -> Bb5)
    this.shapedTone(dest, 'sawtooth', 540 * pitch, 210 * pitch, now, 0.08, 0.38, this.softClipCurve, 2200, stops);
    this.tone(dest, 'triangle', 880 * pitch, 932.33 * pitch, now + 0.01, 0.18, 0.34, stops);
    this.tone(dest, 'sine', 1760 * pitch, 1480 * pitch, now + 0.015, 0.15, 0.2, stops);

    // Layer 3 — Precision sub punch
    this.tone(dest, 'sine', 118 * pitch, 50, now, 0.1, 0.68, stops);
    return dur;
  }

  /** Armor Break: 3-layer gilded plate rupture + 7-shard shatter cascade + shield-break sub drop. */
  private synthArmorBreak(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.66;

    // Layer 1 — Blinding ceramic/metal crack transient + 7 cascading crystalline shards
    this.transientBand(dest, this.whiteNoise, 5800 * pitch, 2200 * pitch, 2.0, now, 0.024, 0.72, stops);
    const shardFreqs = [2180, 2890, 3420, 4150, 2610, 4780, 5360];
    for (let i = 0; i < shardFreqs.length; i++) {
      const t = now + i * 0.02 + Math.random() * 0.01;
      const f = shardFreqs[i] * pitch * (0.94 + Math.random() * 0.12);
      this.tone(dest, 'sine', f, f * 0.93, t, 0.16 + Math.random() * 0.12, 0.19, stops);
    }

    // Layer 2 — Waveshaped FM bronze-plate rupture body
    const brassBase = 233.08 * pitch;
    this.shapedTone(dest, 'sawtooth', 360 * pitch, 125 * pitch, now, 0.16, 0.44, this.hardClipCurve, 1800, stops);
    this.fmTone(dest, brassBase, brassBase * 1.414, 440, now, 0.44, 0.48, stops);

    // Layer 3 — Deep shield-shatter sub pressure drop (116Hz -> 36Hz)
    this.tone(dest, 'sine', 116 * pitch, 36, now, 0.26, 0.86, stops);

    const grit = this.startNoise(this.whiteNoise, now, 0.28, stops);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1500, now);
    const gEnv = this.ctx.createGain();
    gEnv.gain.setValueAtTime(0.58, now);
    gEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    grit.connect(hp);
    hp.connect(gEnv);
    gEnv.connect(dest);

    return dur;
  }

  /** Wall Slam: 3-layer carved-stone fracture crack + waveshaped granite crunch + architectural sub thud. */
  private synthWallSlam(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.38;

    // Layer 1 — Sharp granite fracture crack (2.6kHz -> 950Hz)
    this.transientBand(dest, this.whiteNoise, 3800 * pitch, 1300 * pitch, 2.0, now, 0.022, 0.64, stops);

    // Layer 2 — Waveshaped stone crunch + tumbling debris rubble
    this.shapedTone(dest, 'sawtooth', 310 * pitch, 92 * pitch, now, 0.15, 0.46, this.softClipCurve, 1100, stops);
    const rubble = this.startNoise(this.pinkNoise, now, 0.32, stops);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1050 * pitch, now);
    lp.frequency.exponentialRampToValueAtTime(140, now + 0.3);
    const rEnv = this.ctx.createGain();
    rEnv.gain.setValueAtTime(0.68, now);
    rEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    rubble.connect(lp);
    lp.connect(rEnv);
    rEnv.connect(dest);

    // Layer 3 — Deep architectural stone-impact sub thud (110Hz -> 30Hz)
    this.tone(dest, 'sine', 110 * pitch, 30, now, 0.28, 0.92, stops);

    return dur;
  }

  /** Deflect: 3-layer blade-on-aegis spark ping + noble bronze FM parry bell + rebound sub. */
  private synthDeflect(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.68;
    const f0 = 440 * pitch;

    // Layer 1 — Blinding parry spark transient + rising deflection gleam
    this.transientBand(dest, this.whiteNoise, 5800 * pitch, 2600 * pitch, 2.8, now, 0.02, 0.62, stops);
    this.tone(dest, 'sine', 1240 * pitch, 3020 * pitch, now, 0.09, 0.3, stops);

    // Layer 2 — Waveshaped bronze shield body + shimmering FM bell partials
    this.shapedTone(dest, 'triangle', 380 * pitch, 220 * pitch, now, 0.1, 0.32, this.softClipCurve, 1900, stops);
    this.fmTone(dest, f0, f0 * 1.41, 300, now, 0.6, 0.46, stops);
    this.tone(dest, 'sine', f0 * 2.0, f0 * 1.99, now, 0.5, 0.28, stops);
    this.tone(dest, 'triangle', f0 * 2.76, f0 * 2.73, now, 0.36, 0.18, stops);

    // Layer 3 — Tight resonant rebound sub thump (118Hz -> 48Hz)
    this.tone(dest, 'sine', 118 * pitch, 48, now, 0.13, 0.52, stops);

    return dur;
  }

  private synthEnemyDeath(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.34;

    this.tone(dest, 'triangle', 310 * pitch, 68 * pitch, now, 0.15, 0.5, stops);
    this.tone(dest, 'sine', 587.33 * pitch, 293.66 * pitch, now + 0.02, 0.22, 0.22, stops);

    const mist = this.startNoise(this.pinkNoise, now, 0.3, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(2.2, now);
    bp.frequency.setValueAtTime(1600 * pitch, now);
    bp.frequency.exponentialRampToValueAtTime(340, now + 0.29);
    const mEnv = this.ctx.createGain();
    mEnv.gain.setValueAtTime(0.001, now);
    mEnv.gain.linearRampToValueAtTime(0.48, now + 0.025);
    mEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    mist.connect(bp);
    bp.connect(mEnv);
    mEnv.connect(dest);

    return dur;
  }

  private synthFinalKillBoom(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 1.25;
    const hitTime = now + 0.11;

    const swell = this.startNoise(this.pinkNoise, now, 0.13, stops);
    const swellBp = this.ctx.createBiquadFilter();
    swellBp.type = 'bandpass';
    swellBp.Q.setValueAtTime(2.5, now);
    swellBp.frequency.setValueAtTime(260, now);
    swellBp.frequency.exponentialRampToValueAtTime(2600, hitTime);
    const swEnv = this.ctx.createGain();
    swEnv.gain.setValueAtTime(0.001, now);
    swEnv.gain.exponentialRampToValueAtTime(0.55, hitTime);
    swEnv.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.025);
    swell.connect(swellBp);
    swellBp.connect(swEnv);
    swEnv.connect(dest);

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(118 * pitch, hitTime);
    sub.frequency.exponentialRampToValueAtTime(27, hitTime + 0.85);

    const drive = this.ctx.createWaveShaper();
    drive.curve = this.softClipCurve;

    const subEnv = this.ctx.createGain();
    subEnv.gain.setValueAtTime(0.001, hitTime);
    subEnv.gain.linearRampToValueAtTime(1.0, hitTime + 0.015);
    subEnv.gain.exponentialRampToValueAtTime(0.001, hitTime + 1.05);

    sub.connect(drive);
    drive.connect(subEnv);
    subEnv.connect(dest);
    this.scheduleOsc(sub, hitTime, hitTime + 1.1, stops);

    this.fmTone(dest, 146.83 * pitch, 207.65 * pitch, 140, hitTime, 1.0, 0.36, stops);
    this.tone(dest, 'triangle', 73.42 * pitch, 69.3 * pitch, hitTime, 0.95, 0.35, stops);

    return dur;
  }

  /**
   * Boss Phase Shift: Bone-rattling low underworld war-horn brass fifth (D2 + A2 detuned),
   * dramatic 80Hz -> 30Hz cinematic sub-drop, and reverberant metallic anvil crash!
   */
  private synthBossPhase(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 1.25;

    // 1. Cinematic 80Hz -> 30Hz chest-rattling sub-drop
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(84 * pitch, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.72);
    const subDrive = this.ctx.createWaveShaper();
    subDrive.curve = this.softClipCurve;
    const subEnv = this.ctx.createGain();
    subEnv.gain.setValueAtTime(0.001, now);
    subEnv.gain.linearRampToValueAtTime(0.95, now + 0.016);
    subEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    sub.connect(subDrive);
    subDrive.connect(subEnv);
    subEnv.connect(dest);
    this.scheduleOsc(sub, now, now + 0.88, stops);

    // 2. Low underworld brass war-horn fifth (D2 73.42Hz + A2 110.0Hz, detuned unison pairs)
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.setValueAtTime(2.8, now);
    lp.frequency.setValueAtTime(240, now);
    lp.frequency.exponentialRampToValueAtTime(2350, now + 0.26);
    lp.frequency.exponentialRampToValueAtTime(460, now + 1.15);

    const drive = this.ctx.createWaveShaper();
    drive.curve = this.softClipCurve;

    const hEnv = this.ctx.createGain();
    hEnv.gain.setValueAtTime(0.001, now);
    hEnv.gain.linearRampToValueAtTime(0.46, now + 0.11);
    hEnv.gain.setValueAtTime(0.42, now + 0.58);
    hEnv.gain.exponentialRampToValueAtTime(0.001, now + 1.18);

    lp.connect(drive);
    drive.connect(hEnv);
    hEnv.connect(dest);

    const hornSpecs: readonly [number, number][] = [
      [73.42, -9],
      [73.42, 9],
      [110.0, -7],
      [110.0, 7],
      [146.83, 0],
    ];
    for (let i = 0; i < hornSpecs.length; i++) {
      const [freq, detune] = hornSpecs[i];
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * pitch, now);
      osc.detune.setValueAtTime(detune, now);
      osc.connect(lp);
      this.scheduleOsc(osc, now, now + 1.2, stops);
    }

    // 3. Reverberant metallic underworld anvil crash at 35ms
    const anvilT = now + 0.035;
    this.transientBand(dest, this.whiteNoise, 5600 * pitch, 2100 * pitch, 2.0, anvilT, 0.04, 0.64, stops);
    this.fmTone(dest, 587.33 * pitch, 932.33 * pitch, 340, anvilT, 0.85, 0.34, stops);
    this.fmTone(dest, 1174.66 * pitch, 1661.22 * pitch, 220, anvilT + 0.005, 0.62, 0.2, stops);

    return dur;
  }

  /**
   * Patron Stingers (`boon_offer`, `boon_select`, `god_call`, `greater_call`):
   * - `boon_offer`: shimmering lyre/harp rising arpeggio + radiant choir-pad swell
   * - `boon_select`: majestic divine chime + sub confirmation bloom + tiered rarity crystal sparkle
   * - `god_call` / `greater_call`: heroic Patron proclamation + brass/anvil surge
   */
  private synthPatronChord(
    dest: AudioNode,
    now: number,
    pitch: number,
    patronId: PatronId | undefined,
    style: 'offer' | 'select' | 'call' | 'greater_call',
    rarity: BoonRarity | undefined,
    stops: (() => void)[]
  ): number {
    const profile = patronId ? PATRON_AUDIO_PROFILES[patronId] : PATRON_AUDIO_PROFILES.aegira;
    const isCall = style === 'call' || style === 'greater_call';
    const isGreater = style === 'greater_call';
    const dur = isGreater ? 1.4 : isCall ? 1.0 : style === 'select' ? 0.98 : 0.96;

    const rarityTranspose =
      rarity === 'legendary' || rarity === 'duo'
        ? 4
        : rarity === 'heroic'
          ? 3
          : rarity === 'epic'
            ? 2
            : rarity === 'rare'
              ? 1
              : 0;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(profile.cutoffHz * (isCall ? 1.25 : 1.08), now);
    lp.frequency.exponentialRampToValueAtTime(Math.max(580, profile.cutoffHz * 0.34), now + dur);
    lp.connect(dest);

    if (style === 'offer') {
      // Shimmering harp/lyre rising arpeggio (D4–F4–A4–C#5–E5 blended with Patron voicing)
      const harpSemitones = [0, 3, 7, 11, 14];
      const baseMidi = patronId ? profile.rootMidi : 62; // D4 anchor
      for (let i = 0; i < harpSemitones.length; i++) {
        const startT = now + i * 0.056;
        const interval =
          i < profile.chordIntervals.length && i > 0
            ? Math.round((harpSemitones[i] + profile.chordIntervals[i]) * 0.5)
            : harpSemitones[i];
        const freq = midiToHz(baseMidi + interval) * pitch;
        const noteDur = Math.max(0.32, dur - i * 0.056);
        // Plucked lyre attack + silky octave overtone
        this.tone(lp, 'triangle', freq, freq * 1.003, startT, noteDur, 0.24, stops, -4);
        this.tone(lp, 'sine', freq * 2, freq * 2.004, startT + 0.004, noteDur * 0.72, 0.14, stops, 5);
        this.tone(dest, 'sine', freq * 3, freq * 2.99, startT + 0.006, 0.16, 0.05, stops);
      }

      // Radiant choir-pad swell underneath (warm detuned slow-attack triad bloom)
      const padFilter = this.ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(520, now);
      padFilter.frequency.exponentialRampToValueAtTime(2200, now + 0.36);
      padFilter.frequency.exponentialRampToValueAtTime(720, now + dur);

      const padEnv = this.ctx.createGain();
      padEnv.gain.setValueAtTime(0.001, now);
      padEnv.gain.linearRampToValueAtTime(0.24, now + 0.22);
      padEnv.gain.setValueAtTime(0.2, now + 0.54);
      padEnv.gain.exponentialRampToValueAtTime(0.001, now + dur);
      padFilter.connect(padEnv);
      padEnv.connect(dest);

      const padIntervals = [0, 7, 12];
      for (let i = 0; i < padIntervals.length; i++) {
        const f = midiToHz(baseMidi - 12 + padIntervals[i]) * pitch;
        const osc = this.ctx.createOscillator();
        osc.type = i === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(f, now);
        osc.detune.setValueAtTime((i - 1) * 8, now);
        osc.connect(padFilter);
        this.scheduleOsc(osc, now, now + dur + 0.03, stops);
      }
    } else {
      const arpeggioGap = style === 'select' ? 0.03 : 0.02;
      const notes = profile.chordIntervals;

      for (let i = 0; i < notes.length; i++) {
        const startT = now + i * arpeggioGap;
        const freq = midiToHz(profile.rootMidi + notes[i] + rarityTranspose) * pitch;
        const noteDur = Math.max(0.28, dur - i * arpeggioGap);
        const voiceVol = (0.29 / Math.sqrt(notes.length)) * (isCall ? 1.2 : 1.0);

        this.tone(lp, profile.wave, freq, freq, startT, noteDur, voiceVol, stops, -5);
        this.tone(lp, 'sine', freq * 2, freq * 2, startT + 0.008, noteDur * 0.78, voiceVol * 0.4, stops, 6);
      }

      // Divine chime + rarity crystalline sparkle for boon_select
      if (style === 'select') {
        const chimeRoot = midiToHz(profile.rootMidi + 12 + rarityTranspose) * pitch;
        this.fmTone(dest, chimeRoot, chimeRoot * 2.0, 140, now + 0.02, 0.56, 0.24, stops);

        if (rarity === 'rare') {
          this.tone(dest, 'sine', chimeRoot * 1.5, chimeRoot * 1.505, now + 0.09, 0.36, 0.16, stops);
        } else if (rarity === 'epic') {
          const spark = [12, 19, 24];
          for (let i = 0; i < spark.length; i++) {
            const sf = midiToHz(profile.rootMidi + spark[i] + rarityTranspose) * pitch;
            this.tone(dest, 'sine', sf, sf * 1.004, now + 0.07 + i * 0.045, 0.34, 0.15, stops);
          }
        } else if (rarity === 'heroic') {
          const spark = [12, 16, 19, 24];
          for (let i = 0; i < spark.length; i++) {
            const sf = midiToHz(profile.rootMidi + spark[i] + rarityTranspose) * pitch;
            this.tone(dest, 'triangle', sf, sf * 1.005, now + 0.06 + i * 0.042, 0.38, 0.16, stops);
          }
          this.fmTone(dest, chimeRoot * 1.5, chimeRoot * 3.0, 180, now + 0.14, 0.48, 0.14, stops);
        } else if (rarity === 'duo' || rarity === 'legendary') {
          const spark = [12, 16, 19, 24, 31];
          for (let i = 0; i < spark.length; i++) {
            const sf = midiToHz(profile.rootMidi + spark[i] + rarityTranspose) * pitch;
            this.tone(dest, 'sine', sf, sf * 1.006, now + 0.05 + i * 0.04, 0.46, 0.17, stops);
          }
          this.fmTone(dest, chimeRoot * 2.0, chimeRoot * 3.0, 210, now + 0.12, 0.62, 0.18, stops);
        }
      }
    }

    switch (profile.texture) {
      case 'electric': {
        const zap = this.startNoise(this.whiteNoise, now, 0.22, stops);
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 4;
        bp.frequency.setValueAtTime(4200, now);
        bp.frequency.exponentialRampToValueAtTime(900, now + 0.2);
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.32, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        zap.connect(bp);
        bp.connect(env);
        env.connect(dest);
        break;
      }
      case 'wave': {
        const surf = this.startNoise(this.pinkNoise, now, 0.55, stops);
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 1.6;
        bp.frequency.setValueAtTime(320, now);
        bp.frequency.exponentialRampToValueAtTime(1400, now + 0.22);
        bp.frequency.exponentialRampToValueAtTime(380, now + 0.54);
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.001, now);
        env.gain.linearRampToValueAtTime(0.38, now + 0.14);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        surf.connect(bp);
        bp.connect(env);
        env.connect(dest);
        break;
      }
      case 'gong': {
        this.fmTone(dest, 523.25 * pitch, 740 * pitch, 190, now, 0.55, 0.24, stops);
        break;
      }
      case 'brass': {
        this.tone(dest, 'sawtooth', 73.42 * pitch, 73.42 * pitch, now, 0.55, 0.26, stops);
        break;
      }
      case 'ice':
      case 'crystal': {
        const hi = midiToHz(profile.rootMidi + 24) * pitch;
        this.tone(dest, 'sine', hi, hi * 1.005, now + 0.06, 0.45, 0.2, stops);
        break;
      }
      case 'void': {
        this.tone(dest, 'sine', 65.4 * pitch, 49.0 * pitch, now, 0.7, 0.36, stops);
        break;
      }
      default: {
        const top = midiToHz(profile.rootMidi + 19 + rarityTranspose) * pitch;
        this.tone(dest, 'sine', top, top, now + 0.05, 0.45, 0.16, stops);
        break;
      }
    }

    if (style === 'select' || isCall) {
      this.tone(dest, 'sine', 124 * pitch, 42, now, isGreater ? 0.68 : 0.36, isGreater ? 0.88 : 0.52, stops);
    }
    if (isGreater) {
      const rootHz = midiToHz(profile.rootMidi - 12) * pitch;
      this.shapedTone(dest, 'sawtooth', rootHz, rootHz, now + 0.03, 0.98, 0.32, this.softClipCurve, 2400, stops, -6);
      this.shapedTone(dest, 'sawtooth', rootHz * 1.5, rootHz * 1.5, now + 0.04, 0.94, 0.24, this.softClipCurve, 2600, stops, 6);
      this.fmTone(dest, rootHz * 4, rootHz * 6, 340, now + 0.07, 0.95, 0.26, stops);
    }

    return dur;
  }

  /** Player Hurt: unmistakable 3-layer armor-dent bite + hard-clipped mid crunch + heavy gut sub. */
  private synthPlayerHit(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.28;

    // Layer 1 — Visceral armor-dent / impact bite transient (1.9kHz–4.4kHz)
    this.transientBand(dest, this.whiteNoise, 4100 * pitch, 1750 * pitch, 2.0, now, 0.02, 0.64, stops);

    // Layer 2 — Hard-saturated ominous low-mid crunch + dissonant iron FM groan
    this.shapedTone(dest, 'sawtooth', 260 * pitch, 78 * pitch, now, 0.18, 0.54, this.hardClipCurve, 980, stops);
    this.fmTone(dest, 310 * pitch, 465 * pitch, 280, now, 0.15, 0.34, stops);

    // Layer 3 — Heavy warning sub gut-punch drop (115Hz -> 36Hz)
    this.tone(dest, 'sine', 115 * pitch, 36, now, 0.21, 0.9, stops);

    return dur;
  }

  /**
   * Death Defiance:
   * Stage 1 (0–240ms): Dramatic time-warp reverse swell sweep
   * Stage 2 (240ms): Shattering obsidian glass crack + crystal scatter + resurrection sub thump
   * Stage 3 (300–1380ms): Triumphant soaring golden horn chord (D4 + A4 + D5 + F#5)!
   */
  private synthDeathDefiance(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 1.42;
    const shatterT = now + 0.24;

    // Stage 1 — Dramatic time-warp reverse swell (0..240ms)
    const revNoise = this.startNoise(this.pinkNoise, now, 0.26, stops);
    const revBp = this.ctx.createBiquadFilter();
    revBp.type = 'bandpass';
    revBp.Q.setValueAtTime(2.6, now);
    revBp.frequency.setValueAtTime(180 * pitch, now);
    revBp.frequency.exponentialRampToValueAtTime(3800 * pitch, shatterT);
    const revEnv = this.ctx.createGain();
    revEnv.gain.setValueAtTime(0.001, now);
    revEnv.gain.exponentialRampToValueAtTime(0.58, shatterT - 0.008);
    revEnv.gain.exponentialRampToValueAtTime(0.001, shatterT + 0.018);
    revNoise.connect(revBp);
    revBp.connect(revEnv);
    revEnv.connect(dest);

    // Rising reversed harmonic tension tone leading right into shatter
    const revOsc = this.ctx.createOscillator();
    revOsc.type = 'triangle';
    revOsc.frequency.setValueAtTime(146.83 * pitch, now);
    revOsc.frequency.exponentialRampToValueAtTime(587.33 * pitch, shatterT);
    const revToneEnv = this.ctx.createGain();
    revToneEnv.gain.setValueAtTime(0.001, now);
    revToneEnv.gain.exponentialRampToValueAtTime(0.36, shatterT - 0.006);
    revToneEnv.gain.exponentialRampToValueAtTime(0.001, shatterT + 0.015);
    revOsc.connect(revToneEnv);
    revToneEnv.connect(dest);
    this.scheduleOsc(revOsc, now, shatterT + 0.02, stops);

    // Stage 2 — Shattering obsidian glass crack + scattering shards + sub pulse (240ms)
    this.tone(dest, 'sine', 120 * pitch, 34, shatterT, 0.32, 0.88, stops);
    this.transientBand(dest, this.whiteNoise, 6400 * pitch, 2400 * pitch, 1.8, shatterT, 0.032, 0.72, stops);
    const glassShards = [2420, 3180, 3960, 4680, 2860, 5240];
    for (let i = 0; i < glassShards.length; i++) {
      const t = shatterT + i * 0.018;
      const f = glassShards[i] * pitch;
      this.tone(dest, 'sine', f, f * 0.92, t, 0.2, 0.16, stops);
    }

    // Stage 3 — Triumphant soaring golden horn chord (D4 + A4 + D5 + F#5)
    const hornT = now + 0.29;
    const hornDur = 1.08;
    const hornLp = this.ctx.createBiquadFilter();
    hornLp.type = 'lowpass';
    hornLp.Q.setValueAtTime(1.6, hornT);
    hornLp.frequency.setValueAtTime(580, hornT);
    hornLp.frequency.exponentialRampToValueAtTime(3400, hornT + 0.22);
    hornLp.frequency.exponentialRampToValueAtTime(1250, hornT + hornDur);

    const hornDrive = this.ctx.createWaveShaper();
    hornDrive.curve = this.softClipCurve;

    const hornEnv = this.ctx.createGain();
    hornEnv.gain.setValueAtTime(0.001, hornT);
    hornEnv.gain.linearRampToValueAtTime(0.38, hornT + 0.08);
    hornEnv.gain.setValueAtTime(0.32, hornT + 0.56);
    hornEnv.gain.exponentialRampToValueAtTime(0.001, hornT + hornDur);

    hornLp.connect(hornDrive);
    hornDrive.connect(hornEnv);
    hornEnv.connect(dest);

    const chordNotes = [293.66, 440.0, 587.33, 739.99];
    for (let i = 0; i < chordNotes.length; i++) {
      const f = chordNotes[i] * pitch;
      const osc = this.ctx.createOscillator();
      osc.type = i < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, hornT);
      osc.detune.setValueAtTime((i - 1.5) * 6, hornT);
      osc.connect(hornLp);
      this.scheduleOsc(osc, hornT, hornT + hornDur + 0.03, stops);

      // Gleaming golden upper octave shimmer
      this.tone(dest, 'sine', f * 2, f * 2.004, hornT + 0.03 + i * 0.035, 0.65, 0.12, stops);
    }

    return dur;
  }

  private synthDoorUnlock(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.78;

    const stone = this.startNoise(this.pinkNoise, now, 0.32, stops);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(340, now);
    lp.frequency.linearRampToValueAtTime(160, now + 0.3);
    const sEnv = this.ctx.createGain();
    sEnv.gain.setValueAtTime(0.5, now);
    sEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    stone.connect(lp);
    lp.connect(sEnv);
    sEnv.connect(dest);

    this.tone(dest, 'sine', 110 * pitch, 48, now + 0.08, 0.18, 0.45, stops);

    const chime = [587.33, 739.99, 880.0];
    for (let i = 0; i < chime.length; i++) {
      const t = now + 0.12 + i * 0.09;
      this.tone(dest, 'triangle', chime[i] * pitch, chime[i] * pitch, t, 0.45, 0.28, stops);
      this.tone(dest, 'sine', chime[i] * 2 * pitch, chime[i] * 2 * pitch, t, 0.3, 0.12, stops);
    }

    return dur;
  }

  private synthRoomEnter(
    dest: AudioNode,
    now: number,
    pitch: number,
    stops: (() => void)[]
  ): number {
    const dur = 0.52;

    const whoosh = this.startNoise(this.pinkNoise, now, 0.45, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(220, now);
    bp.frequency.exponentialRampToValueAtTime(920, now + 0.16);
    bp.frequency.exponentialRampToValueAtTime(240, now + 0.44);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.5, now + 0.1);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    whoosh.connect(bp);
    bp.connect(env);
    env.connect(dest);

    this.tone(dest, 'sine', 146.83 * pitch, 146.83 * pitch, now + 0.05, 0.42, 0.26, stops);
    return dur;
  }

  /**
   * Mythic Carved-Marble & Burnished-Bronze UI Foley (`hover`, `click`, `confirm`, `back`).
   */
  private synthUi(
    dest: AudioNode,
    now: number,
    pitch: number,
    kind: 'click' | 'hover' | 'confirm' | 'back',
    stops: (() => void)[]
  ): number {
    if (kind === 'hover') {
      // Delicate 28ms burnished-bronze chime tick + subtle woody parchment brush
      this.tone(dest, 'sine', 1760 * pitch, 1480 * pitch, now, 0.028, 0.3, stops);
      this.tone(dest, 'sine', 2640 * pitch, 2480 * pitch, now + 0.003, 0.022, 0.11, stops);
      this.transientBand(dest, this.pinkNoise, 2100 * pitch, 1400 * pitch, 3.4, now, 0.022, 0.24, stops);
      return 0.04;
    }
    if (kind === 'click') {
      // Solid weighted carved-marble stone-latch click + soft gilded D5/A5 overtone
      this.transientBand(dest, this.whiteNoise, 2600 * pitch, 1300 * pitch, 2.8, now, 0.014, 0.36, stops);
      this.shapedTone(dest, 'triangle', 380 * pitch, 128 * pitch, now, 0.055, 0.44, this.softClipCurve, 1300, stops);
      this.tone(dest, 'sine', 587.33 * pitch, 587.33 * pitch, now + 0.004, 0.075, 0.2, stops);
      this.tone(dest, 'sine', 880.0 * pitch, 880.0 * pitch, now + 0.008, 0.065, 0.12, stops);
      return 0.095;
    }
    if (kind === 'confirm') {
      // Resonant Greco-Roman bronze gong-chime chord (D4 + A4 + F#5) + stone-seal sub tap
      this.tone(dest, 'sine', 120 * pitch, 56, now, 0.09, 0.34, stops);
      this.fmTone(dest, 293.66 * pitch, 440.0 * pitch, 95, now, 0.46, 0.32, stops);
      this.tone(dest, 'triangle', 440.0 * pitch, 440.0 * pitch, now + 0.028, 0.42, 0.28, stops);
      this.tone(dest, 'sine', 739.99 * pitch, 739.99 * pitch, now + 0.055, 0.38, 0.24, stops);
      this.tone(dest, 'sine', 1479.98 * pitch, 1479.98 * pitch, now + 0.068, 0.28, 0.09, stops);
      return 0.5;
    }
    // `back`: warm low stone-slide thud + downward wooden fifth (A4 -> D4)
    this.transientBand(dest, this.pinkNoise, 780 * pitch, 260 * pitch, 1.8, now, 0.085, 0.32, stops);
    this.tone(dest, 'sine', 185 * pitch, 72, now, 0.1, 0.42, stops);
    this.tone(dest, 'triangle', 440.0 * pitch, 432.0 * pitch, now, 0.07, 0.24, stops);
    this.tone(dest, 'triangle', 293.66 * pitch, 286.0 * pitch, now + 0.042, 0.13, 0.28, stops);
    return 0.18;
  }

  private synthPickup(
    dest: AudioNode,
    now: number,
    pitch: number,
    patronId: PatronId | undefined,
    stops: (() => void)[]
  ): number {
    const dur = 0.28;
    const base = patronId ? midiToHz(PATRON_AUDIO_PROFILES[patronId].rootMidi + 12) : 880;
    this.tone(dest, 'sine', base * pitch, base * pitch, now, 0.12, 0.34, stops);
    this.tone(dest, 'triangle', base * 1.5 * pitch, base * 1.5 * pitch, now + 0.055, 0.2, 0.3, stops);
    return dur;
  }

  private synthStatusProc(
    dest: AudioNode,
    now: number,
    pitch: number,
    statusId: StatusEffectId | undefined,
    stops: (() => void)[]
  ): number {
    if (statusId === 'doom') {
      return this.synthDoomGong(dest, now, pitch, stops);
    }
    if (statusId === 'hangover') {
      return this.synthHangoverFizz(dest, now, pitch, stops);
    }
    if (statusId === 'chill') {
      return this.synthChillCrackle(dest, now, pitch, stops);
    }
    if (statusId === 'poison') {
      return this.synthPoisonHiss(dest, now, pitch, stops);
    }
    if (statusId === 'maim') {
      this.tone(dest, 'sawtooth', 165 * pitch, 42, now, 0.28, 0.58, stops);
      this.fmTone(dest, 440 * pitch, 622 * pitch, 300, now, 0.25, 0.32, stops);
      return 0.32;
    }
    if (statusId === 'jolted') {
      const zap = this.startNoise(this.whiteNoise, now, 0.12, stops);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 3.5;
      bp.frequency.setValueAtTime(3400 * pitch, now);
      bp.frequency.exponentialRampToValueAtTime(700, now + 0.11);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.5, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      zap.connect(bp);
      bp.connect(env);
      env.connect(dest);
      this.tone(dest, 'sawtooth', 920 * pitch, 420 * pitch, now, 0.09, 0.24, stops);
      return 0.14;
    }
    this.tone(dest, 'triangle', 680 * pitch, 410 * pitch, now, 0.14, 0.34, stops);
    return 0.16;
  }

  private synthEnemySpawn(
    dest: AudioNode,
    now: number,
    pitch: number,
    isBoss: boolean,
    stops: (() => void)[]
  ): number {
    const dur = isBoss ? 0.55 : 0.24;
    const fStart = (isBoss ? 140 : 220) * pitch;
    const fEnd = (isBoss ? 52 : 110) * pitch;
    this.tone(dest, 'sine', fStart, fEnd, now, dur, isBoss ? 0.7 : 0.34, stops);
    const puff = this.startNoise(this.pinkNoise, now, dur * 0.9, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(isBoss ? 480 : 900, now);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(isBoss ? 0.45 : 0.25, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);
    puff.connect(bp);
    bp.connect(env);
    env.connect(dest);
    return dur;
  }

  // ============================================================================
  // Low-Level DSP Building Blocks
  // ============================================================================

  private tone(
    dest: AudioNode,
    type: OscillatorType,
    startHz: number,
    endHz: number,
    startTime: number,
    duration: number,
    peakGain: number,
    stops: (() => void)[],
    detuneCents = 0
  ): void {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(clamp(startHz, 20, 16000), startTime);
    if (Math.abs(endHz - startHz) > 0.5) {
      osc.frequency.exponentialRampToValueAtTime(clamp(endHz, 20, 16000), startTime + duration);
    }
    if (detuneCents !== 0) {
      osc.detune.setValueAtTime(detuneCents, startTime);
    }

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(Math.max(0.001, peakGain), startTime + Math.min(0.012, duration * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(env);
    env.connect(dest);
    this.scheduleOsc(osc, startTime, startTime + duration + 0.015, stops);
  }

  /** Waveshaped mid-body punch helper (`osc -> lowpass -> waveShaper -> env -> dest`). */
  private shapedTone(
    dest: AudioNode,
    type: OscillatorType,
    startHz: number,
    endHz: number,
    startTime: number,
    duration: number,
    peakGain: number,
    curve: Float32Array<ArrayBuffer>,
    cutoffHz: number,
    stops: (() => void)[],
    detuneCents = 0
  ): void {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(clamp(startHz, 20, 14000), startTime);
    if (Math.abs(endHz - startHz) > 0.5) {
      osc.frequency.exponentialRampToValueAtTime(clamp(endHz, 20, 14000), startTime + duration);
    }
    if (detuneCents !== 0) {
      osc.detune.setValueAtTime(detuneCents, startTime);
    }

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(clamp(cutoffHz, 120, 14000), startTime);

    const shaper = this.ctx.createWaveShaper();
    shaper.curve = curve;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(Math.max(0.001, peakGain), startTime + Math.min(0.008, duration * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(lp);
    lp.connect(shaper);
    shaper.connect(env);
    env.connect(dest);
    this.scheduleOsc(osc, startTime, startTime + duration + 0.015, stops);
  }

  /** Crisp bandpass-filtered noise transient crack / bite helper (8–35ms). */
  private transientBand(
    dest: AudioNode,
    buffer: AudioBuffer,
    startHz: number,
    endHz: number,
    q: number,
    startTime: number,
    duration: number,
    peakGain: number,
    stops: (() => void)[]
  ): void {
    const src = this.startNoise(buffer, startTime, duration, stops);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.setValueAtTime(q, startTime);
    bp.frequency.setValueAtTime(clamp(startHz, 180, 14000), startTime);
    if (Math.abs(endHz - startHz) > 10) {
      bp.frequency.exponentialRampToValueAtTime(clamp(endHz, 120, 12000), startTime + duration);
    }
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(Math.max(0.001, peakGain), startTime);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    src.connect(bp);
    bp.connect(env);
    env.connect(dest);
  }

  private fmTone(
    dest: AudioNode,
    carrierHz: number,
    modHz: number,
    modDepth: number,
    startTime: number,
    duration: number,
    peakGain: number,
    stops: (() => void)[]
  ): void {
    const carrier = this.ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(clamp(carrierHz, 25, 12000), startTime);

    const mod = this.ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(clamp(modHz, 25, 16000), startTime);

    const modGain = this.ctx.createGain();
    modGain.gain.setValueAtTime(modDepth, startTime);
    modGain.gain.exponentialRampToValueAtTime(1, startTime + duration * 0.8);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(env);
    env.connect(dest);

    this.scheduleOsc(mod, startTime, startTime + duration + 0.02, stops);
    this.scheduleOsc(carrier, startTime, startTime + duration + 0.02, stops);
  }

  private startNoise(
    buffer: AudioBuffer,
    startTime: number,
    duration: number,
    stops: (() => void)[]
  ): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const offset = Math.random() * Math.max(0.05, buffer.duration - 0.1);
    src.start(startTime, offset);
    src.stop(startTime + duration + 0.02);
    stops.push(() => {
      try {
        src.stop();
      } catch {
        // already stopped
      }
    });
    return src;
  }

  private scheduleOsc(
    osc: OscillatorNode,
    startTime: number,
    stopTime: number,
    stops: (() => void)[]
  ): void {
    osc.start(startTime);
    osc.stop(stopTime);
    stops.push(() => {
      try {
        osc.stop();
      } catch {
        // already stopped
      }
    });
  }

  // ============================================================================
  // Pre-Baked Buffers (Zero Runtime GC)
  // ============================================================================

  private createWhiteNoiseBuffer(seconds: number): AudioBuffer {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  private createPinkNoiseBuffer(seconds: number): AudioBuffer {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buf;
  }

  private createCavernImpulse(seconds: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * seconds));
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const decay = Math.pow(1 - t, 2.7);
        const raw = (Math.random() * 2 - 1) * decay;
        lp = lp * 0.45 + raw * 0.55;
        data[i] = lp * 0.42;
      }
    }
    return buf;
  }
}
