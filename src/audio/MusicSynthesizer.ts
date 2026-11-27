/**
 * Krunked WannabeHades — Adaptive 5-Biome & 5-Boss Greek-Metal Music Synthesizer (Wave 2)
 *
 * Real-time Web Audio lookahead step sequencer spanning Phrygian Dominant (Hijaz),
 * Aeolian (heroic metal), Dorian (mystic/gothic/shop), and Harmonic Minor (shred):
 *  - Hub (`hub_sanctum`) & Boatman Shop (`boatman_shop`)
 *  - All 5 Biomes (`obsidian_pit`, `cinder_mire`, `verdant_colosseum`, `crypt_of_bile`, `frozen_summit`)
 *  - All 5 Boss Tiers (`boss_warden`, `boss_leviathan`, `boss_champions`, `boss_ferryman`,
 *    and Sovereign Lord Phase 1 `boss_sovereign` orchestral-metal -> Phase 2 `boss_sovereign_p2`
 *    relentless 162 BPM double-kick guitar shred ramp!)
 *
 * 6 Layered Stems with Smooth Crossfades:
 *  1. Plucked Bouzouki / Oud metallic arpeggios (cached Karplus-Strong physical string pluck!)
 *  2. Driving distorted electric bass & power-chord synth riff (tube overdrive + cabinet EQ)
 *  3. Genre-tailored percussion kit (kick, snare, hats, tribal toms, double-kick battery, shop perc)
 *  4. Soaring Greek-metal electric lead guitar synth w/ stereo dotted-8th echo
 *  5. Majestic Orchestral Brass / Choir-Organ stem (Colosseum, Champions, Ferryman, Sovereign Phase 1 & 2!)
 *  6. Brooding Underworld modal drone
 */

import {
  MUSIC_TRACK_MANIFEST,
  SCALE_INTERVALS,
  type DrumStyleId,
  type MusicIntensity,
  type MusicTrackId,
  type MusicalModeId,
} from './soundManifest';

interface StemLevels {
  readonly bouzouki: number;
  readonly bass: number;
  readonly percussion: number;
  readonly lead: number;
  readonly orchestral: number;
  readonly drone: number;
}

const INTENSITY_MIX: Readonly<Record<MusicIntensity, StemLevels>> = {
  hub: {
    bouzouki: 0.72,
    bass: 0.0,
    percussion: 0.0,
    lead: 0.0,
    orchestral: 0.18,
    drone: 0.42,
  },
  explore: {
    bouzouki: 0.78,
    bass: 0.38,
    percussion: 0.34,
    lead: 0.0,
    orchestral: 0.28,
    drone: 0.28,
  },
  combat: {
    bouzouki: 0.76,
    bass: 0.84,
    percussion: 0.86,
    lead: 0.36,
    orchestral: 0.5,
    drone: 0.14,
  },
  boss: {
    bouzouki: 0.8,
    bass: 0.94,
    percussion: 0.96,
    lead: 0.86,
    orchestral: 0.86,
    drone: 0.16,
  },
};

// 32-step (2-bar) Hub sparse contemplative lyre/bouzouki arpeggio
const HUB_BOUZOUKI_PATTERN: readonly number[] = [
  0, -1, -1, 4, -1, -1, 2, -1, 1, -1, -1, 4, -1, -1, 0, -1,
  0, -1, -1, 5, -1, -1, 4, -1, 2, -1, 1, -1, 0, -1, -1, -1,
];

// 32-step Boatman Shop swaying subterranean Dorian oud melody
const SHOP_BOUZOUKI_PATTERN: readonly number[] = [
  0, -1, 2, 4, -1, 5, 4, -1, 2, -1, 0, -1, -1, 2, 4, -1,
  5, -1, 7, 5, -1, 4, 2, -1, 4, -1, 2, 0, -1, -1, 4, -1,
];

// 8 distinct 32-step Bouzouki / Oud arpeggio variants across Biomes & Bosses
const BOUZOUKI_PATTERNS: readonly (readonly number[])[] = [
  // 0: Obsidian Pit classic Hijaz ostinato (D-Eb-F#-A)
  [
    0, 4, 7, 4, 1, 4, 7, 4, 2, 4, 7, 4, 1, 4, 5, 4,
    0, 4, 7, 9, 8, 7, 5, 4, 2, 4, 5, 4, 2, 1, 0, 4,
  ],
  // 1: Warden Boss 148 BPM ferocious tremolo shred
  [
    7, 7, 8, 7, 9, 7, 8, 7, 11, 9, 8, 7, 9, 8, 7, 4,
    7, 7, 8, 7, 10, 9, 8, 7, 9, 8, 7, 5, 4, 2, 1, 0,
  ],
  // 2: Cinder Mire / Frozen Summit syncopated Eastern hook
  [
    0, -1, 2, 4, 7, -1, 5, 4, 2, -1, 1, 2, 4, -1, 1, 0,
    0, 4, 7, 8, 9, -1, 8, 7, 5, 4, 2, 4, 2, 1, 0, -1,
  ],
  // 3: Crypt of Bile gnarly twisting chug-arpeggio
  [
    0, 0, 7, 0, 1, 0, 8, 0, 2, 0, 9, 0, 1, 0, 7, 4,
    0, 0, 7, 8, 9, 8, 7, 4, 5, 4, 2, 4, 2, 1, 0, 1,
  ],
  // 4: Boatman Shop / Ferryman Dorian swinging arpeggio
  [
    0, -1, 4, 5, 7, -1, 5, 4, 2, -1, 4, 5, 4, -1, 2, 0,
    0, -1, 5, 7, 9, -1, 7, 5, 4, -1, 5, 4, 2, 0, -1, 4,
  ],
  // 5: Bone Leviathan volcanic cascading serpent runs
  [
    7, 5, 4, 2, 1, 2, 4, 5, 7, 8, 9, 8, 7, 5, 4, 1,
    0, 4, 7, 8, 9, 11, 9, 8, 7, 5, 4, 2, 1, 4, 2, 0,
  ],
  // 6: Verdant Colosseum & Dual Champions heroic Aeolian gallop
  [
    0, 4, 7, -1, 0, 4, 7, 9, 7, 4, 5, -1, 5, 4, 2, 4,
    0, 4, 7, -1, 9, 11, 9, 7, 5, 7, 5, 4, 2, 4, 5, 4,
  ],
  // 7: Sovereign Lord baroque-metal harpsichord/bouzouki arpeggios
  [
    0, 4, 7, 11, 7, 4, 2, 5, 9, 11, 9, 5, 4, 7, 11, 9,
    0, 4, 7, 12, 11, 9, 7, 5, 4, 6, 7, 9, 11, 9, 7, 6,
  ],
];

// 8 distinct 32-step Distorted Electric Bass & Power-Chord Riffs
const BASS_RIFF_PATTERNS: readonly (readonly number[])[] = [
  // 0: Obsidian Pit driving Phrygian groove
  [
    0, -1, 0, 0, -1, 0, 1, -1, 0, -1, 0, 0, 2, -1, 1, -1,
    0, -1, 0, 0, -1, 0, 5, -1, 4, -1, 2, -1, 1, -1, 1, 0,
  ],
  // 1: Warden Boss thrash riff
  [
    0, 0, 0, -1, 1, 0, 0, -1, 2, 0, 1, 0, 0, 0, 4, -1,
    0, 0, 0, -1, 5, 0, 4, -1, 2, 2, 1, 1, 0, 1, 2, 1,
  ],
  // 2: Cinder Mire / Frozen Summit syncopated rock bounce
  [
    0, -1, 0, 2, -1, 1, 0, -1, 0, -1, 4, 2, -1, 1, 0, -1,
    0, -1, 5, 4, -1, 2, 1, -1, 0, 0, 1, -1, 2, 1, 0, -1,
  ],
  // 3: Crypt of Bile heavy sludge-metal stomp
  [
    0, 0, -1, -1, 1, 1, -1, 0, 2, -1, 1, 0, 5, 4, 2, 1,
    0, 0, -1, -1, 4, 4, -1, 2, 5, -1, 4, 2, 1, 1, 0, 0,
  ],
  // 4: Ferryman / Shop syncopated Dorian groove
  [
    0, -1, -1, 0, 2, -1, 4, -1, 5, -1, 4, -1, 2, -1, 0, -1,
    0, -1, -1, 0, 5, -1, 4, -1, 2, 2, 4, -1, 5, 4, 2, 0,
  ],
  // 5: Bone Leviathan crushing magma stomp
  [
    0, 0, -1, 1, 0, -1, 0, 2, 1, 0, -1, 4, 5, 4, 2, 1,
    0, 0, -1, 1, 2, -1, 4, 5, 4, 2, 1, 0, 1, 2, 1, 0,
  ],
  // 6: Colosseum & Champions galloping stadium power-metal (1-2-3 gallop!)
  [
    0, 0, 0, -1, 0, 0, 0, -1, 5, 5, 5, -1, 4, 4, 2, -1,
    0, 0, 0, -1, 2, 2, 2, -1, 3, 3, 4, 4, 5, 4, 2, -1,
  ],
  // 7: Sovereign Lord majestic heavy pedal -> relentless shred gallop
  [
    0, 0, 0, 0, 5, 5, 4, 4, 3, 3, 3, 3, 2, 2, 4, 4,
    0, 0, 0, 0, 6, 6, 5, 5, 4, 4, 3, 2, 1, 2, 4, 6,
  ],
];

// 8 distinct 32-step Soaring Lead Melodies
const LEAD_MELODY_PATTERNS: readonly (readonly number[])[] = [
  // 0: Obsidian Pit heroic Phrygian call
  [
    7, -1, -1, 8, 9, -1, 8, 7, 11, -1, -1, 9, 8, -1, 7, -1,
    9, -1, 11, 12, 11, -1, 9, 8, 9, -1, 8, 7, 8, 7, 4, -1,
  ],
  // 1: Warden Malice 148 BPM screamer
  [
    11, -1, 12, 11, 9, -1, 8, 9, 11, -1, 14, -1, 12, 11, 9, -1,
    12, -1, 11, 9, 8, 9, 11, 9, 8, 7, 9, 8, 7, -1, 8, 9,
  ],
  // 2: Cinder Mire / Frozen Summit chromatic climb
  [
    7, -1, 9, -1, 11, 12, 11, 9, 8, -1, 9, 8, 7, -1, -1, -1,
    11, -1, 12, 14, 12, 11, 9, 8, 9, 11, 9, 8, 7, -1, -1, -1,
  ],
  // 3: Crypt of Bile sinister creeping lead
  [
    7, 8, -1, 9, -1, 8, 7, 4, 5, -1, 7, 5, 4, 2, 1, -1,
    7, 8, 9, 11, 9, 8, 7, 5, 4, 5, 4, 2, 1, -1, 0, -1,
  ],
  // 4: Ferryman haunting brass-lead toll
  [
    7, -1, -1, 9, 11, -1, 9, -1, 7, -1, 5, -1, 4, -1, -1, -1,
    9, -1, 11, 12, 11, -1, 9, 7, 9, -1, 7, 5, 7, -1, 4, -1,
  ],
  // 5: Bone Leviathan volcanic screaming slide lead
  [
    9, -1, 8, 7, 9, 11, 9, 8, 7, -1, 5, 4, 5, 7, 8, -1,
    11, -1, 12, 11, 9, 8, 9, 11, 12, 11, 9, 8, 7, 8, 9, -1,
  ],
  // 6: Colosseum Champions soaring dual-guitar anthem
  [
    7, -1, 9, 11, 11, -1, 9, 7, 12, -1, 11, 9, 11, -1, -1, -1,
    14, -1, 12, 11, 12, -1, 11, 9, 11, 12, 11, 9, 7, -1, 9, -1,
  ],
  // 7: Sovereign Lord Phase 1 stately theme (Phase 2 injects 16th-note shred runs!)
  [
    7, -1, -1, 9, 11, -1, 12, 11, 14, -1, 12, 11, 9, -1, 11, -1,
    14, -1, 15, 14, 12, -1, 11, 9, 11, 12, 11, 9, 7, 6, 7, -1,
  ],
];

// Dedicated blistering 16th-note Sovereign Phase 2 guitar shred lead!
const SOVEREIGN_P2_SHRED_LEAD: readonly number[] = [
  14, 11, 12, 14, 15, 14, 12, 11, 14, 12, 11, 9, 11, 12, 14, 11,
  16, 14, 12, 14, 15, 14, 12, 11, 12, 11, 9, 7, 9, 11, 12, 13,
];

// 4-step-per-bar Orchestral Chord Root Progressions (indexed by Math.floor(step / 8), 0..3)
const ORCHESTRAL_PROGRESSIONS: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 2, 1], // 0: Obsidian Pit Phrygian tension
  [0, 1, 5, 4], // 1: Warden dark clash
  [0, 5, 4, 2], // 2: Cinder Mire / Summit
  [0, 1, 4, 1], // 3: Crypt sludge
  [0, 3, 5, 4], // 4: Shop / Ferryman Dorian
  [0, 1, 5, 2], // 5: Bone Leviathan volcanic
  [0, 5, 2, 4], // 6: Colosseum / Champions heroic i - VI - III - v
  [0, 5, 3, 4], // 7: Sovereign Lord tragic epic i - VI - iv - V
];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function scaleDegreeToMidi(degree: number, baseRootMidi: number, mode: MusicalModeId): number {
  const intervals = SCALE_INTERVALS[mode];
  const len = intervals.length;
  const oct = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return baseRootMidi + oct * 12 + intervals[idx];
}

function createOverdriveCurve(drive: number, samples = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh((x + 0.06 * x * x) * drive) / norm;
  }
  return curve;
}

export class MusicSynthesizer {
  private readonly ctx: AudioContext;
  private readonly musicMaster: GainNode;
  private readonly busLimiter: DynamicsCompressorNode;
  private readonly muffleFilter: BiquadFilterNode;
  private readonly duckGain: GainNode;

  // 6 adaptive stem buses for smooth crossfading
  private readonly bouzoukiBus: GainNode;
  private readonly bassBus: GainNode;
  private readonly percussionBus: GainNode;
  private readonly leadBus: GainNode;
  private readonly orchestralBus: GainNode;
  private readonly droneBus: GainNode;

  // Shared instrument effects
  private readonly bassDistortion: WaveShaperNode;
  private readonly bassCabFilter: BiquadFilterNode;
  private readonly leadDistortion: WaveShaperNode;
  private readonly leadFilter: BiquadFilterNode;
  private readonly leadDelay: DelayNode;
  private readonly leadDelayFeedback: GainNode;
  private readonly orchestralFilter: BiquadFilterNode;

  // Continuous brooding modal drone (root + fifth)
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneLfo: OscillatorNode | null = null;

  // Pre-baked Karplus-Strong bouzouki string buffers keyed by MIDI note
  private readonly ksBufferCache = new Map<number, AudioBuffer>();
  private readonly snareNoiseBuffer: AudioBuffer;

  // Sequencer state
  private timerId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private disposed = false;
  private nextStepTime = 0;
  private stepIndex = 0;
  private barCount = 0;

  private currentTrack: MusicTrackId = 'hub_sanctum';
  private currentIntensity: MusicIntensity = 'hub';
  private currentBossPhase = 1;
  private currentBpm = 92;
  private targetBpm = 92;
  private oneShotPlaying = false;
  private isMuffled = false;
  private currentDroneTranspose = 0;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    // Gentle bus glue compressor prevents 6-stem boss peaks from ever clipping
    this.busLimiter = ctx.createDynamicsCompressor();
    this.busLimiter.threshold.value = -12;
    this.busLimiter.knee.value = 8;
    this.busLimiter.ratio.value = 4;
    this.busLimiter.attack.value = 0.005;
    this.busLimiter.release.value = 0.12;

    this.muffleFilter = ctx.createBiquadFilter();
    this.muffleFilter.type = 'lowpass';
    this.muffleFilter.frequency.value = 18000;
    this.muffleFilter.Q.value = 0.7;

    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = 1.0;

    this.musicMaster = ctx.createGain();
    this.musicMaster.gain.value = 0.72;

    this.musicMaster.connect(this.busLimiter);
    this.busLimiter.connect(this.muffleFilter);
    this.muffleFilter.connect(this.duckGain);
    this.duckGain.connect(destination);

    // Stem buses
    this.bouzoukiBus = ctx.createGain();
    this.bassBus = ctx.createGain();
    this.percussionBus = ctx.createGain();
    this.leadBus = ctx.createGain();
    this.orchestralBus = ctx.createGain();
    this.droneBus = ctx.createGain();

    this.bouzoukiBus.gain.value = 0.0001;
    this.bassBus.gain.value = 0.0001;
    this.percussionBus.gain.value = 0.0001;
    this.leadBus.gain.value = 0.0001;
    this.orchestralBus.gain.value = 0.0001;
    this.droneBus.gain.value = 0.0001;

    this.bouzoukiBus.connect(this.musicMaster);

    // Distorted electric bass / power-chord cabinet chain
    this.bassDistortion = ctx.createWaveShaper();
    this.bassDistortion.curve = createOverdriveCurve(4.4);
    this.bassDistortion.oversample = '2x';

    this.bassCabFilter = ctx.createBiquadFilter();
    this.bassCabFilter.type = 'lowpass';
    this.bassCabFilter.frequency.value = 2350;
    this.bassCabFilter.Q.value = 1.2;

    this.bassDistortion.connect(this.bassCabFilter);
    this.bassCabFilter.connect(this.bassBus);
    this.bassBus.connect(this.musicMaster);

    this.percussionBus.connect(this.musicMaster);

    // Soaring electric lead -> overdrive -> filter -> stereo echo -> leadBus
    this.leadDistortion = ctx.createWaveShaper();
    this.leadDistortion.curve = createOverdriveCurve(6.0);
    this.leadDistortion.oversample = '2x';

    this.leadFilter = ctx.createBiquadFilter();
    this.leadFilter.type = 'lowpass';
    this.leadFilter.frequency.value = 3500;
    this.leadFilter.Q.value = 1.4;

    this.leadDelay = ctx.createDelay(1.0);
    this.leadDelay.delayTime.value = 0.31;
    this.leadDelayFeedback = ctx.createGain();
    this.leadDelayFeedback.gain.value = 0.28;

    const leadDelayWet = ctx.createGain();
    leadDelayWet.gain.value = 0.26;

    this.leadDistortion.connect(this.leadFilter);
    this.leadFilter.connect(this.leadBus);
    this.leadFilter.connect(this.leadDelay);
    this.leadDelay.connect(this.leadDelayFeedback);
    this.leadDelayFeedback.connect(this.leadDelay);
    this.leadDelay.connect(leadDelayWet);
    leadDelayWet.connect(this.leadBus);
    this.leadBus.connect(this.musicMaster);

    // Orchestral brass / choir-organ chain
    this.orchestralFilter = ctx.createBiquadFilter();
    this.orchestralFilter.type = 'lowpass';
    this.orchestralFilter.frequency.value = 1950;
    this.orchestralFilter.Q.value = 0.9;
    this.orchestralFilter.connect(this.orchestralBus);
    this.orchestralBus.connect(this.musicMaster);

    this.droneBus.connect(this.musicMaster);

    this.snareNoiseBuffer = this.createNoiseBuffer(0.6);
  }

  start(): void {
    if (this.disposed || this.running) return;
    this.running = true;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.startDrone();
    this.applyIntensityMix(0.35);

    this.timerId = globalThis.setInterval(() => {
      this.schedulerTick();
    }, 25);
  }

  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      globalThis.clearInterval(this.timerId);
      this.timerId = null;
    }
    const now = this.ctx.currentTime;
    this.bouzoukiBus.gain.setTargetAtTime(0.0001, now, 0.08);
    this.bassBus.gain.setTargetAtTime(0.0001, now, 0.08);
    this.percussionBus.gain.setTargetAtTime(0.0001, now, 0.08);
    this.leadBus.gain.setTargetAtTime(0.0001, now, 0.08);
    this.orchestralBus.gain.setTargetAtTime(0.0001, now, 0.08);
    this.droneBus.gain.setTargetAtTime(0.0001, now, 0.08);
  }

  /**
   * Smoothly transition track & adaptive intensity (`hub` / `explore` / `combat` / `boss`).
   */
  setState(track: MusicTrackId, intensity: MusicIntensity): void {
    if (this.disposed) return;
    const spec = MUSIC_TRACK_MANIFEST[track];
    if (!spec) return;

    if (track === 'victory_fanfare' || track === 'death_stinger') {
      if (this.currentTrack !== track || !this.oneShotPlaying) {
        this.currentTrack = track;
        this.playOneShotTrack(track);
      }
      return;
    }

    const trackChanged = this.currentTrack !== track || this.oneShotPlaying;
    const intensityChanged = this.currentIntensity !== intensity;
    this.oneShotPlaying = false;
    this.currentTrack = track;
    this.currentIntensity = intensity;

    // Effective tempo: hub stays brooding ~92 BPM, shop ~98 BPM, bosses lock to spec
    // (Sovereign P1 134 BPM orchestral-metal -> P2 162 BPM shred ramp!), explore breathes slightly slower.
    const desiredBpm =
      track === 'boatman_shop'
        ? spec.bpm
        : intensity === 'hub'
          ? 92
          : intensity === 'boss'
            ? spec.bpm + (track === 'boss_sovereign_p2' && this.currentBossPhase >= 3 ? 6 : 0)
            : intensity === 'explore'
              ? Math.max(106, Math.round(spec.bpm * 0.9))
              : spec.bpm;
    this.targetBpm = desiredBpm;

    if (trackChanged) {
      this.updateDronePitch(spec.transposeSemitones);
      const dottedEighth = (60 / desiredBpm) * 0.75;
      this.leadDelay.delayTime.setTargetAtTime(Math.min(0.6, dottedEighth), this.ctx.currentTime, 0.2);
    }

    if (trackChanged || intensityChanged) {
      this.applyIntensityMix(0.38);
    }
  }

  /**
   * Inform sequencer of current boss phase (used for Sovereign Lord P1->P2->P3 intensity escalation).
   */
  setBossPhase(phase: number): void {
    const p = Math.max(1, Math.floor(phase));
    if (p === this.currentBossPhase) return;
    this.currentBossPhase = p;
    if (this.currentTrack === 'boss_sovereign_p2') {
      this.targetBpm = MUSIC_TRACK_MANIFEST.boss_sovereign_p2.bpm + (p >= 3 ? 6 : 0);
      this.applyIntensityMix(0.28);
    }
  }

  setMenuMuffled(muffled: boolean): void {
    if (this.disposed || muffled === this.isMuffled) return;
    this.isMuffled = muffled;
    const now = this.ctx.currentTime;
    this.smoothParam(this.muffleFilter.frequency, muffled ? 1350 : 18000, now, 0.14);
    this.smoothParam(this.musicMaster.gain, muffled ? 0.52 : 0.72, now, 0.14);
  }

  duck(level: number, holdSeconds: number): void {
    if (this.disposed || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.1, Math.min(1.0, level));
    this.duckGain.gain.cancelScheduledValues(now);
    this.duckGain.gain.setValueAtTime(Math.max(0.05, this.duckGain.gain.value), now);
    this.duckGain.gain.setTargetAtTime(clamped, now, 0.025);
    this.duckGain.gain.setTargetAtTime(1.0, now + Math.max(0.08, holdSeconds), 0.24);
  }

  playOneShotTrack(track: 'victory_fanfare' | 'death_stinger'): void {
    if (this.disposed || this.ctx.state !== 'running') return;
    this.oneShotPlaying = true;
    const now = this.ctx.currentTime;

    this.bouzoukiBus.gain.setTargetAtTime(0.0001, now, 0.12);
    this.bassBus.gain.setTargetAtTime(0.0001, now, 0.12);
    this.percussionBus.gain.setTargetAtTime(0.0001, now, 0.12);
    this.leadBus.gain.setTargetAtTime(0.0001, now, 0.12);
    this.orchestralBus.gain.setTargetAtTime(0.0001, now, 0.12);
    this.droneBus.gain.setTargetAtTime(0.0001, now, 0.18);

    if (track === 'victory_fanfare') {
      const notes = [62, 66, 69, 73, 74];
      const times = [0.04, 0.22, 0.4, 0.62, 0.85];
      for (let i = 0; i < notes.length; i++) {
        const t = now + times[i];
        const dur = i === notes.length - 1 ? 1.55 : 0.36;
        this.scheduleOneShotBrass(midiToHz(notes[i]), t, dur, 0.28);
        this.scheduleOneShotPluck(notes[i] + 12, t, 0.55);
      }
      this.scheduleOneShotBrass(midiToHz(50), now + 0.85, 1.6, 0.36);
      this.scheduleKick(now + 0.85, 0.85, this.musicMaster);
    } else {
      const notes = [54, 51, 50, 38];
      const times = [0.04, 0.36, 0.72, 1.05];
      for (let i = 0; i < notes.length; i++) {
        const t = now + times[i];
        const dur = i === notes.length - 1 ? 1.8 : 0.5;
        this.scheduleOneShotBrass(midiToHz(notes[i]), t, dur, 0.32);
      }
      this.scheduleOneShotPluck(62, now + 0.04, 0.35);
      this.scheduleOneShotPluck(63, now + 0.36, 0.35);
      this.scheduleOneShotPluck(62, now + 0.72, 0.42);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.stopDrone();
    this.ksBufferCache.clear();
    try {
      this.bouzoukiBus.disconnect();
      this.bassBus.disconnect();
      this.percussionBus.disconnect();
      this.leadBus.disconnect();
      this.orchestralBus.disconnect();
      this.droneBus.disconnect();
      this.bassDistortion.disconnect();
      this.bassCabFilter.disconnect();
      this.leadDistortion.disconnect();
      this.leadFilter.disconnect();
      this.leadDelay.disconnect();
      this.leadDelayFeedback.disconnect();
      this.orchestralFilter.disconnect();
      this.busLimiter.disconnect();
      this.muffleFilter.disconnect();
      this.duckGain.disconnect();
      this.musicMaster.disconnect();
    } catch {
      // safe ignore
    }
  }

  // ============================================================================
  // Lookahead Step Sequencer
  // ============================================================================

  private schedulerTick(): void {
    if (!this.running || this.disposed || this.oneShotPlaying) return;
    if (this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    if (this.nextStepTime < now - 0.15) {
      this.nextStepTime = now + 0.03;
    }

    const scheduleAheadSec = 0.11;
    while (this.nextStepTime < now + scheduleAheadSec) {
      this.scheduleStep(this.stepIndex, this.nextStepTime);

      // Smooth tempo glide (so Sovereign P1 134 BPM -> P2 162 BPM ramps exhilaratingly!)
      this.currentBpm += (this.targetBpm - this.currentBpm) * 0.16;
      const sixteenthSec = 60 / this.currentBpm / 4;
      this.nextStepTime += sixteenthSec;
      this.stepIndex = (this.stepIndex + 1) % 32;
      if (this.stepIndex === 0) {
        this.barCount = (this.barCount + 1) % 4;
      }
    }
  }

  private scheduleStep(step: number, time: number): void {
    const spec = MUSIC_TRACK_MANIFEST[this.currentTrack];
    if (!spec || spec.isOneShot) return;

    const transpose = spec.transposeSemitones;
    const mode = spec.mode;
    const variant = spec.riffVariant;
    const intensity = this.currentIntensity;
    const stepDur = 60 / this.currentBpm / 4;
    const isShop = this.currentTrack === 'boatman_shop';
    const isSovereignP2 = this.currentTrack === 'boss_sovereign_p2';

    // 1. Plucked Bouzouki / Oud Arpeggios
    const bouzoukiPattern =
      intensity === 'hub'
        ? HUB_BOUZOUKI_PATTERN
        : isShop
          ? SHOP_BOUZOUKI_PATTERN
          : BOUZOUKI_PATTERNS[variant];
    const bDeg = bouzoukiPattern[step];
    if (bDeg >= 0) {
      const playInExplore = isShop || intensity !== 'explore' || step % 2 === 0 || step % 8 === 3;
      if (playInExplore) {
        const midi = scaleDegreeToMidi(bDeg, 50 + transpose, mode);
        const accent = step % 4 === 0 ? 0.56 : 0.38;
        this.scheduleBouzoukiPluck(midi, time, accent, intensity === 'boss' || intensity === 'combat');
      }
    }

    // 2. Boatman Shop resonant oar/coin chime accents
    if (isShop && (step === 0 || step === 12 || step === 24)) {
      const bellMidi = scaleDegreeToMidi(step === 12 ? 4 : 7, 62 + transpose, mode);
      this.scheduleShopChime(midiToHz(bellMidi), time, 0.16);
    }

    // 3. Driving Distorted Electric Bass & Power-Chord Synth Riff (skip in hub & calm shop)
    if (intensity !== 'hub' && !isShop) {
      const riffPattern = BASS_RIFF_PATTERNS[variant];
      const rDeg = riffPattern[step];
      if (rDeg >= 0) {
        const bassMidi = scaleDegreeToMidi(rDeg, 38 + transpose, mode);
        const isPowerChord = intensity === 'combat' || intensity === 'boss';
        const isAccent = step % 4 === 0 || rDeg === 1 || rDeg === 2 || isSovereignP2;
        const noteLen = isAccent ? stepDur * 1.45 : stepDur * 0.82;
        this.scheduleElectricRiff(bassMidi, time, noteLen, isPowerChord, isAccent);
      }
    } else if (isShop && (step === 0 || step === 16)) {
      // Gentle clean plucked sub-bass pulse in Boatman Shop
      const bassMidi = scaleDegreeToMidi(step === 0 ? 0 : 4, 38 + transpose, mode);
      this.scheduleElectricRiff(bassMidi, time, stepDur * 4, false, false);
    }

    // 4. Orchestral Brass / Choir-Organ Chords (downbeats on every half-bar when orchestralWeight > 0.15)
    if (spec.orchestralWeight > 0.15 && step % 8 === 0) {
      const chordIdx = Math.floor(step / 8) as 0 | 1 | 2 | 3;
      const rootDeg = ORCHESTRAL_PROGRESSIONS[variant][chordIdx];
      const chordDur = stepDur * (isSovereignP2 ? 6.5 : 7.8);
      const gain = 0.24 * spec.orchestralWeight;
      this.scheduleOrchestralChord(rootDeg, 50 + transpose, mode, time, chordDur, gain, isSovereignP2);
    }

    // 5. Genre-Tailored Percussion Kit
    if (intensity !== 'hub') {
      this.schedulePercussionStep(step, time, intensity, spec.drumStyle);
    }

    // 6. Soaring Greek-Metal Electric Lead Guitar (full in boss, bars 1 & 3 of combat, blistering shred in Sovereign P2!)
    const playLead =
      !isShop &&
      (intensity === 'boss' || (intensity === 'combat' && (this.barCount === 1 || this.barCount === 3)));
    if (playLead) {
      const leadPattern = isSovereignP2 ? SOVEREIGN_P2_SHRED_LEAD : LEAD_MELODY_PATTERNS[variant];
      const lDeg = leadPattern[step];
      if (lDeg >= 0) {
        const leadMidi = scaleDegreeToMidi(lDeg, 62 + transpose, mode);
        let holdSteps = 1;
        while (holdSteps < 4 && leadPattern[(step + holdSteps) % 32] < 0) {
          holdSteps++;
        }
        const dur = stepDur * (holdSteps * 0.92);
        this.scheduleLeadNote(leadMidi, time, dur, isSovereignP2 ? 0.48 : intensity === 'boss' ? 0.44 : 0.3);
      }
    }
  }

  // ============================================================================
  // Instrument Synthesis Voices
  // ============================================================================

  private getOrCreateKarplusStrongBuffer(midi: number): AudioBuffer {
    const cached = this.ksBufferCache.get(midi);
    if (cached) return cached;

    const sr = this.ctx.sampleRate;
    const freq = midiToHz(midi);
    const period = Math.max(2, Math.round(sr / freq));
    const durSec = 0.72;
    const totalSamples = Math.floor(sr * durSec);
    const buf = this.ctx.createBuffer(1, totalSamples, sr);
    const out = buf.getChannelData(0);

    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) {
      const noise = Math.random() * 2 - 1;
      const saw = (i / period) * 2 - 1;
      ring[i] = noise * 0.78 + saw * 0.22;
    }

    let idx = 0;
    const decay = 0.992;
    for (let i = 0; i < totalSamples; i++) {
      const cur = ring[idx];
      const next = ring[(idx + 1) % period];
      out[i] = cur;
      ring[idx] = (cur * 0.62 + next * 0.38) * decay;
      idx = (idx + 1) % period;
    }

    let peak = 0;
    for (let i = 0; i < totalSamples; i++) {
      const a = Math.abs(out[i]);
      if (a > peak) peak = a;
    }
    if (peak > 0.001) {
      const scale = 0.88 / peak;
      for (let i = 0; i < totalSamples; i++) {
        out[i] *= scale;
      }
    }

    this.ksBufferCache.set(midi, buf);
    return buf;
  }

  private scheduleBouzoukiPluck(
    midi: number,
    time: number,
    gain: number,
    doubleOctaveCourse: boolean
  ): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.getOrCreateKarplusStrongBuffer(midi);

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(160, time);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.65);

    src.connect(hp);
    hp.connect(env);
    env.connect(this.bouzoukiBus);
    src.start(time);
    src.stop(time + 0.68);

    if (doubleOctaveCourse) {
      const twin = this.ctx.createBufferSource();
      twin.buffer = this.getOrCreateKarplusStrongBuffer(midi + 12);
      const tEnv = this.ctx.createGain();
      tEnv.gain.setValueAtTime(gain * 0.28, time + 0.004);
      tEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.42);
      twin.connect(tEnv);
      tEnv.connect(this.bouzoukiBus);
      twin.start(time + 0.004);
      twin.stop(time + 0.44);
    }
  }

  private scheduleShopChime(hz: number, time: number, gain: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(hz, time);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.95);
    osc.connect(env);
    env.connect(this.bouzoukiBus);
    osc.start(time);
    osc.stop(time + 1.0);
  }

  private scheduleOrchestralChord(
    rootDeg: number,
    baseRootMidi: number,
    mode: MusicalModeId,
    time: number,
    duration: number,
    gain: number,
    staccatoBrass: boolean
  ): void {
    const degrees = [rootDeg, rootDeg + 2, rootDeg + 4, rootDeg + 7];
    const env = this.ctx.createGain();
    const attack = staccatoBrass ? 0.025 : 0.14;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gain, time + attack);
    env.gain.setValueAtTime(gain * (staccatoBrass ? 0.72 : 0.88), time + duration * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    env.connect(this.orchestralFilter);

    for (let i = 0; i < degrees.length; i++) {
      const midi = scaleDegreeToMidi(degrees[i], baseRootMidi, mode);
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 || staccatoBrass ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(midiToHz(midi), time);
      osc.detune.setValueAtTime((i - 1.5) * 6, time);
      osc.connect(env);
      osc.start(time);
      osc.stop(time + duration + 0.04);
    }
  }

  private scheduleElectricRiff(
    rootMidi: number,
    time: number,
    duration: number,
    powerChord: boolean,
    accent: boolean
  ): void {
    const rootHz = midiToHz(rootMidi);
    const env = this.ctx.createGain();
    const peak = accent ? 0.34 : 0.23;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.008);
    env.gain.exponentialRampToValueAtTime(peak * 0.55, time + duration * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    env.connect(this.bassDistortion);

    const bassOsc = this.ctx.createOscillator();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(rootHz, time);
    bassOsc.connect(env);
    bassOsc.start(time);
    bassOsc.stop(time + duration + 0.02);

    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(rootHz, time);
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(peak * 0.75, time);
    subGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    subOsc.connect(subGain);
    subGain.connect(this.bassBus);
    subOsc.start(time);
    subOsc.stop(time + duration + 0.02);

    if (powerChord) {
      const fifth = this.ctx.createOscillator();
      fifth.type = 'sawtooth';
      fifth.frequency.setValueAtTime(midiToHz(rootMidi + 7), time);
      fifth.detune.setValueAtTime(5, time);
      const fGain = this.ctx.createGain();
      fGain.gain.setValueAtTime(0.55, time);
      fifth.connect(fGain);
      fGain.connect(env);
      fifth.start(time);
      fifth.stop(time + duration + 0.02);

      const oct = this.ctx.createOscillator();
      oct.type = 'square';
      oct.frequency.setValueAtTime(midiToHz(rootMidi + 12), time);
      oct.detune.setValueAtTime(-6, time);
      const oGain = this.ctx.createGain();
      oGain.gain.setValueAtTime(0.32, time);
      oct.connect(oGain);
      oGain.connect(env);
      oct.start(time);
      oct.stop(time + duration + 0.02);
    }
  }

  private scheduleLeadNote(midi: number, time: number, duration: number, peak: number): void {
    const hz = midiToHz(midi);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.014);
    env.gain.setValueAtTime(peak * 0.85, time + Math.max(0.02, duration * 0.7));
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.04);
    env.connect(this.leadDistortion);

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(hz, time);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(hz, time);
    osc2.detune.setValueAtTime(9, time);

    if (duration > 0.16) {
      const vib = this.ctx.createOscillator();
      vib.frequency.setValueAtTime(5.8, time);
      const vibGain = this.ctx.createGain();
      vibGain.gain.setValueAtTime(0, time);
      vibGain.gain.linearRampToValueAtTime(14, time + duration * 0.45);
      vib.connect(vibGain);
      vibGain.connect(osc1.detune);
      vibGain.connect(osc2.detune);
      vib.start(time);
      vib.stop(time + duration + 0.05);
    }

    osc1.connect(env);
    osc2.connect(env);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration + 0.05);
    osc2.stop(time + duration + 0.05);
  }

  private schedulePercussionStep(
    step: number,
    time: number,
    intensity: MusicIntensity,
    style: DrumStyleId
  ): void {
    const s16 = step % 16;

    // Boatman Shop: sparse warm wooden frame-drum & shaker pulse
    if (style === 'shop') {
      if (s16 === 0 || s16 === 10) {
        this.scheduleFloorTom(time, 0.34, 0.9);
      }
      if (s16 === 6 || s16 === 14) {
        this.scheduleHiHat(time, 0.12, false);
      }
      return;
    }

    // Explore: moody tribal toms & sparse pulse kick
    if (intensity === 'explore') {
      if (s16 === 0 || s16 === 10) {
        this.scheduleKick(time, 0.62, this.percussionBus);
      }
      if (s16 === 0 || s16 === 3 || s16 === 6 || s16 === 8 || s16 === 12 || s16 === 14) {
        this.scheduleFloorTom(time, s16 % 4 === 0 ? 0.52 : 0.32, s16 === 3 || s16 === 14 ? 1.24 : 1.0);
      }
      return;
    }

    // Sovereign Lord Phase 2: RELENTLESS 16th-note double-kick shred battery!
    if (style === 'sovereign_shred') {
      if (s16 % 2 === 0 || s16 === 1 || s16 === 3 || s16 === 9 || s16 === 11 || s16 === 15) {
        this.scheduleKick(time, s16 % 4 === 0 ? 0.9 : 0.64, this.percussionBus);
      }
      if (s16 === 4 || s16 === 12 || step === 30) {
        this.scheduleSnare(time, 0.84);
      }
      if (step % 2 === 0) {
        this.scheduleHiHat(time, s16 === 0 || s16 === 8 ? 0.34 : 0.2, s16 === 0 || s16 === 14);
      }
      if (step >= 28) {
        this.scheduleFloorTom(time, 0.52, 1.3 - (step - 28) * 0.1);
      }
      return;
    }

    // Sovereign Lord Phase 1: stately orchestral timpani + crushing metal backbeat
    if (style === 'sovereign_orchestral') {
      if (s16 === 0 || s16 === 6 || s16 === 8 || s16 === 14) {
        this.scheduleKick(time, 0.88, this.percussionBus);
      }
      if (s16 === 4 || s16 === 12) {
        this.scheduleSnare(time, 0.78);
      }
      if (s16 === 0 || s16 === 3 || s16 === 8 || s16 === 11) {
        this.scheduleFloorTom(time, 0.58, s16 === 0 ? 0.82 : 1.05);
      }
      if (step % 2 === 0) {
        this.scheduleHiHat(time, 0.22, s16 === 14);
      }
      return;
    }

    // Colosseum Champions / Verdant Colosseum: galloping martial anthem drums
    if (style === 'champions_gallop' || style === 'colosseum_march') {
      const gallopKick = s16 === 0 || s16 === 2 || s16 === 3 || s16 === 8 || s16 === 10 || s16 === 11;
      if (gallopKick) {
        this.scheduleKick(time, s16 === 0 || s16 === 8 ? 0.86 : 0.62, this.percussionBus);
      }
      if (s16 === 4 || s16 === 12 || (style === 'colosseum_march' && s16 === 15)) {
        this.scheduleSnare(time, 0.74);
      }
      if (step % 2 === 0) {
        this.scheduleHiHat(time, 0.24, s16 === 14);
      }
      if (step === 29 || step === 31) {
        this.scheduleFloorTom(time, 0.5, 1.15);
      }
      return;
    }

    // Bone Leviathan: thunderous volcanic tribal floor-tom assault
    if (style === 'leviathan_tribal') {
      if (s16 === 0 || s16 === 3 || s16 === 6 || s16 === 8 || s16 === 14) {
        this.scheduleKick(time, 0.86, this.percussionBus);
      }
      if (s16 === 4 || s16 === 12) {
        this.scheduleSnare(time, 0.76);
      }
      if (s16 === 2 || s16 === 6 || s16 === 10 || s16 === 13 || s16 === 15) {
        this.scheduleFloorTom(time, 0.58, s16 % 4 === 2 ? 1.25 : 0.88);
      }
      if (step % 2 === 0) {
        this.scheduleHiHat(time, 0.22, s16 === 12);
      }
      return;
    }

    // Crypt of Bile sludge / Ferryman heavy groove
    if (style === 'crypt_sludge' || style === 'ferryman_heavy') {
      if (s16 === 0 || s16 === 7 || s16 === 10 || (style === 'ferryman_heavy' && s16 === 14)) {
        this.scheduleKick(time, 0.88, this.percussionBus);
      }
      if (s16 === 4 || s16 === 12) {
        this.scheduleSnare(time, 0.78);
      }
      if (step % 2 === 0) {
        this.scheduleHiHat(time, 0.24, s16 === 8 || s16 === 14);
      }
      if (s16 === 3 || step === 31) {
        this.scheduleFloorTom(time, 0.54, 0.86);
      }
      return;
    }

    // Default Combat & Warden Boss Thrash / Mire / Summit Rock Kit
    const isBoss = intensity === 'boss';
    const kickHit =
      s16 === 0 ||
      s16 === 6 ||
      s16 === 8 ||
      (isBoss && (s16 === 2 || s16 === 10 || s16 === 14)) ||
      (!isBoss && s16 === 11);
    if (kickHit) {
      this.scheduleKick(time, s16 === 0 || s16 === 8 ? 0.85 : 0.68, this.percussionBus);
    }

    if (s16 === 4 || s16 === 12 || (step === 30 && isBoss)) {
      this.scheduleSnare(time, s16 === 4 || s16 === 12 ? 0.72 : 0.45);
    }

    if (step % 2 === 0 || (isBoss && step % 4 === 3)) {
      this.scheduleHiHat(time, step % 4 === 0 ? 0.28 : 0.16, s16 === 14);
    }

    if (s16 === 3 || s16 === 10 || step === 29 || step === 31) {
      this.scheduleFloorTom(time, 0.46, step === 29 ? 1.22 : 0.96);
    }
  }

  private scheduleKick(time: number, gain: number, dest: AudioNode): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(148, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.095);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.connect(env);
    env.connect(dest);
    osc.start(time);
    osc.stop(time + 0.18);

    const click = this.ctx.createOscillator();
    click.type = 'triangle';
    click.frequency.setValueAtTime(2400, time);
    click.frequency.exponentialRampToValueAtTime(280, time + 0.018);
    const cEnv = this.ctx.createGain();
    cEnv.gain.setValueAtTime(gain * 0.22, time);
    cEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    click.connect(cEnv);
    cEnv.connect(dest);
    click.start(time);
    click.stop(time + 0.025);
  }

  private scheduleSnare(time: number, gain: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.snareNoiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.Q.setValueAtTime(1.1, time);
    hp.frequency.setValueAtTime(2400, time);
    const nEnv = this.ctx.createGain();
    nEnv.gain.setValueAtTime(gain * 0.72, time);
    nEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
    src.connect(hp);
    hp.connect(nEnv);
    nEnv.connect(this.percussionBus);
    src.start(time);
    src.stop(time + 0.15);

    const body = this.ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(220, time);
    body.frequency.exponentialRampToValueAtTime(118, time + 0.07);
    const bEnv = this.ctx.createGain();
    bEnv.gain.setValueAtTime(gain * 0.52, time);
    bEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.085);
    body.connect(bEnv);
    bEnv.connect(this.percussionBus);
    body.start(time);
    body.stop(time + 0.095);
  }

  private scheduleHiHat(time: number, gain: number, open: boolean): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.snareNoiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6800, time);
    const dur = open ? 0.12 : 0.04;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(hp);
    hp.connect(env);
    env.connect(this.percussionBus);
    src.start(time);
    src.stop(time + dur + 0.01);
  }

  private scheduleFloorTom(time: number, gain: number, pitchMult: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125 * pitchMult, time);
    osc.frequency.exponentialRampToValueAtTime(68 * pitchMult, time + 0.16);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.21);

    osc.connect(env);
    env.connect(this.percussionBus);
    osc.start(time);
    osc.stop(time + 0.23);
  }

  private scheduleOneShotBrass(hz: number, time: number, dur: number, gain: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(hz, time);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, time);
    lp.frequency.exponentialRampToValueAtTime(550, time + dur);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.04);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(lp);
    lp.connect(env);
    env.connect(this.musicMaster);
    osc.start(time);
    osc.stop(time + dur + 0.04);
  }

  private scheduleOneShotPluck(midi: number, time: number, gain: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.getOrCreateKarplusStrongBuffer(midi);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.65);
    src.connect(env);
    env.connect(this.musicMaster);
    src.start(time);
    src.stop(time + 0.68);
  }

  // ============================================================================
  // Brooding Modal Drone & Crossfade Helpers
  // ============================================================================

  private startDrone(): void {
    if (this.droneOsc1) return;
    const spec = MUSIC_TRACK_MANIFEST[this.currentTrack];
    const rootMidi = 38 + (spec?.transposeSemitones ?? 0);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 1.8;
    filter.connect(this.droneBus);
    this.droneFilter = filter;

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = midiToHz(rootMidi);
    const g1 = this.ctx.createGain();
    g1.gain.value = 0.26;
    osc1.connect(g1);
    g1.connect(filter);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = midiToHz(rootMidi + 7);
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.2;
    osc2.connect(g2);
    g2.connect(filter);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc1.start();
    osc2.start();
    lfo.start();

    this.droneOsc1 = osc1;
    this.droneOsc2 = osc2;
    this.droneLfo = lfo;
  }

  private updateDronePitch(transposeSemitones: number): void {
    if (!this.droneOsc1 || !this.droneOsc2) return;
    if (transposeSemitones === this.currentDroneTranspose) return;
    this.currentDroneTranspose = transposeSemitones;
    const now = this.ctx.currentTime;
    const rootMidi = 38 + transposeSemitones;
    this.smoothParam(this.droneOsc1.frequency, midiToHz(rootMidi), now, 0.25);
    this.smoothParam(this.droneOsc2.frequency, midiToHz(rootMidi + 7), now, 0.25);
  }

  private smoothParam(param: AudioParam, target: number, now: number, timeConstant: number): void {
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.setTargetAtTime(target, now, timeConstant);
    } catch {
      param.setTargetAtTime(target, now, timeConstant);
    }
  }

  private stopDrone(): void {
    for (const osc of [this.droneOsc1, this.droneOsc2, this.droneLfo]) {
      if (osc) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore
        }
      }
    }
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneLfo = null;
    if (this.droneFilter) {
      try {
        this.droneFilter.disconnect();
      } catch {
        // ignore
      }
      this.droneFilter = null;
    }
  }

  private applyIntensityMix(timeConstant: number): void {
    const now = this.ctx.currentTime;
    const mix = INTENSITY_MIX[this.currentIntensity];
    const spec = MUSIC_TRACK_MANIFEST[this.currentTrack];
    const isShop = this.currentTrack === 'boatman_shop';
    const isSovereignP1 = this.currentTrack === 'boss_sovereign';
    const isSovereignP2 = this.currentTrack === 'boss_sovereign_p2';

    const orchLevel = Math.max(0.0001, mix.orchestral * (spec?.orchestralWeight ?? 0.3));
    const bassLevel = isShop ? 0.22 : isSovereignP2 ? 1.0 : mix.bass;
    const leadLevel = isSovereignP1 ? 0.56 : isSovereignP2 ? 0.98 : mix.lead;

    this.smoothParam(this.bouzoukiBus.gain, Math.max(0.0001, mix.bouzouki), now, timeConstant);
    this.smoothParam(this.bassBus.gain, Math.max(0.0001, bassLevel), now, timeConstant);
    this.smoothParam(this.percussionBus.gain, Math.max(0.0001, mix.percussion), now, timeConstant);
    this.smoothParam(this.leadBus.gain, Math.max(0.0001, leadLevel), now, timeConstant);
    this.smoothParam(this.orchestralBus.gain, orchLevel, now, timeConstant);
    this.smoothParam(this.droneBus.gain, Math.max(0.0001, mix.drone), now, timeConstant);
  }

  private createNoiseBuffer(seconds: number): AudioBuffer {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }
}
