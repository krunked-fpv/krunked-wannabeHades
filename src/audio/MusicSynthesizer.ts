/**
 * Krunked WannabeHades — Adaptive Mediterranean / Greek-Metal Music Synthesizer
 *
 * Real-time Web Audio lookahead step sequencer built around the iconic
 * D Phrygian Dominant (Hijaz / Freygish) scale: D, Eb, F#, G, A, Bb, C.
 *
 * Layered Stems with Smooth Crossfades:
 *  1. Plucked Bouzouki / Oud metallic arpeggios (cached Karplus-Strong physical string pluck!)
 *  2. Driving distorted electric bass & power-chord synth riff (tube overdrive + cabinet EQ)
 *  3. Crisp kick, snare, metallic hats, and tribal floor-tom percussion
 *  4. Soaring Greek-metal electric lead synth w/ stereo echo (combat climax & 148 BPM boss shred!)
 *  5. Brooding Underworld modal drone for Sanctum Hub & exploration tension
 *
 * Smoothly crossfades across: `hub` -> `explore` -> `combat` -> `boss`.
 */

import {
  MUSIC_TRACK_MANIFEST,
  PHRYGIAN_DOMINANT_INTERVALS,
  type MusicIntensity,
  type MusicTrackId,
} from './soundManifest';

interface StemLevels {
  readonly bouzouki: number;
  readonly bass: number;
  readonly percussion: number;
  readonly lead: number;
  readonly drone: number;
}

const INTENSITY_MIX: Readonly<Record<MusicIntensity, StemLevels>> = {
  hub: {
    bouzouki: 0.72,
    bass: 0.0,
    percussion: 0.0,
    lead: 0.0,
    drone: 0.42,
  },
  explore: {
    bouzouki: 0.78,
    bass: 0.4,
    percussion: 0.36,
    lead: 0.0,
    drone: 0.28,
  },
  combat: {
    bouzouki: 0.76,
    bass: 0.84,
    percussion: 0.86,
    lead: 0.36,
    drone: 0.14,
  },
  boss: {
    bouzouki: 0.8,
    bass: 0.94,
    percussion: 0.96,
    lead: 0.86,
    drone: 0.16,
  },
};

// Scale-degree index helpers into PHRYGIAN_DOMINANT_INTERVALS (0=D, 1=Eb, 2=F#, 3=G, 4=A, 5=Bb, 6=C)
// Negative values mean rest (-1). Values >= 7 wrap to higher octaves.

// 32-step (2-bar) Hub sparse contemplative lyre/bouzouki arpeggio
const HUB_BOUZOUKI_PATTERN: readonly number[] = [
  0, -1, -1, 4, -1, -1, 2, -1, 1, -1, -1, 4, -1, -1, 0, -1,
  0, -1, -1, 5, -1, -1, 4, -1, 2, -1, 1, -1, 0, -1, -1, -1,
];

// 32-step driving Obsidian Pit / Greek-metal bouzouki arpeggio variants
const BOUZOUKI_PATTERNS: readonly (readonly number[])[] = [
  // Variant 0: Classic Hades Obsidian Pit Hijaz ostinato (D-Eb-F#-A leaping arpeggios)
  [
    0, 4, 7, 4, 1, 4, 7, 4, 2, 4, 7, 4, 1, 4, 5, 4,
    0, 4, 7, 9, 8, 7, 5, 4, 2, 4, 5, 4, 2, 1, 0, 4,
  ],
  // Variant 1: Aggressive Warden Malice 148 BPM tremolo shred
  [
    7, 7, 8, 7, 9, 7, 8, 7, 11, 9, 8, 7, 9, 8, 7, 4,
    7, 7, 8, 7, 10, 9, 8, 7, 9, 8, 7, 5, 4, 2, 1, 0,
  ],
  // Variant 2: Cinder Mire / Summit syncopated Eastern hook
  [
    0, -1, 2, 4, 7, -1, 5, 4, 2, -1, 1, 2, 4, -1, 1, 0,
    0, 4, 7, 8, 9, -1, 8, 7, 5, 4, 2, 4, 2, 1, 0, -1,
  ],
  // Variant 3: Heavy Sovereign / Crypt relentless chug-arpeggio
  [
    0, 0, 7, 0, 1, 0, 8, 0, 2, 0, 9, 0, 1, 0, 7, 4,
    0, 0, 7, 8, 9, 8, 7, 4, 5, 4, 2, 4, 2, 1, 0, 1,
  ],
];

// 32-step distorted electric bass & power-chord root riff variants
const BASS_RIFF_PATTERNS: readonly (readonly number[])[] = [
  // Variant 0: Driving Obsidian Pit Phrygian rock groove
  [
    0, -1, 0, 0, -1, 0, 1, -1, 0, -1, 0, 0, 2, -1, 1, -1,
    0, -1, 0, 0, -1, 0, 5, -1, 4, -1, 2, -1, 1, -1, 1, 0,
  ],
  // Variant 1: Warden Malice relentless 148 BPM thrash-metal riff
  [
    0, 0, 0, -1, 1, 0, 0, -1, 2, 0, 1, 0, 0, 0, 4, -1,
    0, 0, 0, -1, 5, 0, 4, -1, 2, 2, 1, 1, 0, 1, 2, 1,
  ],
  // Variant 2: Syncopated bouncing rock riff
  [
    0, -1, 0, 2, -1, 1, 0, -1, 0, -1, 4, 2, -1, 1, 0, -1,
    0, -1, 5, 4, -1, 2, 1, -1, 0, 0, 1, -1, 2, 1, 0, -1,
  ],
  // Variant 3: Chugging doom/sovereign riff
  [
    0, 0, -1, 0, 1, 1, -1, 0, 2, -1, 1, 0, 5, 4, 2, 1,
    0, 0, -1, 0, 4, 4, -1, 2, 5, -1, 4, 2, 1, 1, 0, 0,
  ],
];

// 32-step soaring Greek-metal lead melody (plays in boss & bar 3-4 of combat)
const LEAD_MELODY_PATTERNS: readonly (readonly number[])[] = [
  // Variant 0: Heroic Phrygian call
  [
    7, -1, -1, 8, 9, -1, 8, 7, 11, -1, -1, 9, 8, -1, 7, -1,
    9, -1, 11, 12, 11, -1, 9, 8, 9, -1, 8, 7, 8, 7, 4, -1,
  ],
  // Variant 1: Warden Malice soaring 148 BPM screamer
  [
    11, -1, 12, 11, 9, -1, 8, 9, 11, -1, 14, -1, 12, 11, 9, -1,
    12, -1, 11, 9, 8, 9, 11, 9, 8, 7, 9, 8, 7, -1, 8, 9,
  ],
  // Variant 2: Fiery chromatic Hijaz climb
  [
    7, -1, 9, -1, 11, 12, 11, 9, 8, -1, 9, 8, 7, -1, -1, -1,
    11, -1, 12, 14, 12, 11, 9, 8, 9, 11, 9, 8, 7, -1, -1, -1,
  ],
  // Variant 3: Apocalyptic Sovereign finale solo
  [
    14, -1, 12, 11, 12, -1, 11, 9, 11, 9, 8, 7, 9, -1, 8, 7,
    11, 12, 14, 15, 14, -1, 12, 11, 12, 11, 9, 8, 9, 8, 7, -1,
  ],
];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function scaleDegreeToMidi(degree: number, baseRootMidi: number): number {
  const len = PHRYGIAN_DOMINANT_INTERVALS.length;
  const oct = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return baseRootMidi + oct * 12 + PHRYGIAN_DOMINANT_INTERVALS[idx];
}

function createOverdriveCurve(drive: number, samples = 1024): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    // Slight asymmetric tube warmth
    curve[i] = Math.tanh((x + 0.06 * x * x) * drive) / norm;
  }
  return curve;
}

export class MusicSynthesizer {
  private readonly ctx: AudioContext;
  private readonly musicMaster: GainNode;
  private readonly muffleFilter: BiquadFilterNode;
  private readonly duckGain: GainNode;

  // Adaptive stem buses for smooth crossfading
  private readonly bouzoukiBus: GainNode;
  private readonly bassBus: GainNode;
  private readonly percussionBus: GainNode;
  private readonly leadBus: GainNode;
  private readonly droneBus: GainNode;

  // Shared instrument effects
  private readonly bassDistortion: WaveShaperNode;
  private readonly bassCabFilter: BiquadFilterNode;
  private readonly leadDistortion: WaveShaperNode;
  private readonly leadFilter: BiquadFilterNode;
  private readonly leadDelay: DelayNode;
  private readonly leadDelayFeedback: GainNode;

  // Continuous brooding modal drone (D2 + A2)
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
  private currentBpm = 92;
  private targetBpm = 92;
  private oneShotPlaying = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.muffleFilter = ctx.createBiquadFilter();
    this.muffleFilter.type = 'lowpass';
    this.muffleFilter.frequency.value = 18000;
    this.muffleFilter.Q.value = 0.7;

    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = 1.0;

    this.musicMaster = ctx.createGain();
    this.musicMaster.gain.value = 0.72;

    this.musicMaster.connect(this.muffleFilter);
    this.muffleFilter.connect(this.duckGain);
    this.duckGain.connect(destination);

    // Stem buses
    this.bouzoukiBus = ctx.createGain();
    this.bassBus = ctx.createGain();
    this.percussionBus = ctx.createGain();
    this.leadBus = ctx.createGain();
    this.droneBus = ctx.createGain();

    this.bouzoukiBus.gain.value = 0.0001;
    this.bassBus.gain.value = 0.0001;
    this.percussionBus.gain.value = 0.0001;
    this.leadBus.gain.value = 0.0001;
    this.droneBus.gain.value = 0.0001;

    // Bouzouki bus -> gentle stereo presence directly to musicMaster
    this.bouzoukiBus.connect(this.musicMaster);

    // Distorted electric bass / power-chord cabinet chain
    this.bassDistortion = ctx.createWaveShaper();
    this.bassDistortion.curve = createOverdriveCurve(4.2);
    this.bassDistortion.oversample = '2x';

    this.bassCabFilter = ctx.createBiquadFilter();
    this.bassCabFilter.type = 'lowpass';
    this.bassCabFilter.frequency.value = 2300;
    this.bassCabFilter.Q.value = 1.2;

    this.bassDistortion.connect(this.bassCabFilter);
    this.bassCabFilter.connect(this.bassBus);
    this.bassBus.connect(this.musicMaster);

    // Percussion -> direct punch
    this.percussionBus.connect(this.musicMaster);

    // Soaring electric lead -> overdrive -> filter -> stereo echo -> leadBus
    this.leadDistortion = ctx.createWaveShaper();
    this.leadDistortion.curve = createOverdriveCurve(5.8);
    this.leadDistortion.oversample = '2x';

    this.leadFilter = ctx.createBiquadFilter();
    this.leadFilter.type = 'lowpass';
    this.leadFilter.frequency.value = 3400;
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

    // Drone bus
    this.droneBus.connect(this.musicMaster);

    // Pre-bake snare/hat noise buffer once
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

    // Effective tempo: hub stays brooding ~92 BPM, boss locks to spec (e.g. 148 BPM Warden!),
    // explore scales slightly back from combat for breathing room.
    const desiredBpm =
      intensity === 'hub'
        ? 92
        : intensity === 'boss'
          ? Math.max(148, spec.bpm)
          : intensity === 'explore'
            ? Math.max(108, Math.round(spec.bpm * 0.9))
            : spec.bpm;
    this.targetBpm = desiredBpm;

    if (trackChanged) {
      this.updateDronePitch(spec.transposeSemitones);
      // Sync dotted-8th lead echo to tempo
      const dottedEighth = (60 / desiredBpm) * 0.75;
      this.leadDelay.delayTime.setTargetAtTime(Math.min(0.6, dottedEighth), this.ctx.currentTime, 0.2);
    }

    if (trackChanged || intensityChanged) {
      this.applyIntensityMix(0.38);
    }
  }

  /**
   * Gentle lowpass muffle + trim during pause/boon menus.
   */
  setMenuMuffled(muffled: boolean): void {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    this.muffleFilter.frequency.setTargetAtTime(muffled ? 1350 : 18000, now, 0.14);
    this.musicMaster.gain.setTargetAtTime(muffled ? 0.52 : 0.72, now, 0.14);
  }

  /**
   * Temporary cinematic ducking (e.g., for Final-Kill Boom or Death Defiance).
   */
  duck(level: number, holdSeconds: number): void {
    if (this.disposed || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.1, Math.min(1.0, level));
    this.duckGain.gain.cancelScheduledValues(now);
    this.duckGain.gain.setTargetAtTime(clamped, now, 0.025);
    this.duckGain.gain.setTargetAtTime(1.0, now + Math.max(0.08, holdSeconds), 0.24);
  }

  /**
   * Play one-shot victory fanfare or death stinger cleanly, fading out looping stems.
   */
  playOneShotTrack(track: 'victory_fanfare' | 'death_stinger'): void {
    if (this.disposed || this.ctx.state !== 'running') return;
    this.oneShotPlaying = true;
    const now = this.ctx.currentTime;

    // Fade out active loop stems smoothly
    this.bouzoukiBus.gain.setTargetAtTime(0.0001, now, 0.12);
    this.bassBus.gain.setTargetAtTime(0.0001, now, 0.12);
    this.percussionBus.gain.setTargetAtTime(0.0001, now, 0.12);
    this.leadBus.gain.setTargetAtTime(0.0001, now, 0.12);
    this.droneBus.gain.setTargetAtTime(0.0001, now, 0.18);

    if (track === 'victory_fanfare') {
      // Triumphant Greek-Lydian brass + bouzouki flourish (D4 -> F#4 -> A4 -> C#5 -> D5!)
      const notes = [62, 66, 69, 73, 74];
      const times = [0.04, 0.22, 0.4, 0.62, 0.85];
      for (let i = 0; i < notes.length; i++) {
        const t = now + times[i];
        const dur = i === notes.length - 1 ? 1.55 : 0.36;
        this.scheduleOneShotBrass(midiToHz(notes[i]), t, dur, 0.28);
        this.scheduleOneShotPluck(notes[i] + 12, t, 0.55);
      }
      this.scheduleOneShotBrass(midiToHz(50), now + 0.85, 1.6, 0.36); // D3 heroic pedal
      this.scheduleKick(now + 0.85, 0.85, this.musicMaster);
    } else {
      // Death stinger: solemn descending Phrygian toll (F#3 -> Eb3 -> D3 -> D2)
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
      this.droneBus.disconnect();
      this.bassDistortion.disconnect();
      this.bassCabFilter.disconnect();
      this.leadDistortion.disconnect();
      this.leadFilter.disconnect();
      this.leadDelay.disconnect();
      this.leadDelayFeedback.disconnect();
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
    // Recover cleanly if tab was backgrounded and clock jumped ahead
    if (this.nextStepTime < now - 0.15) {
      this.nextStepTime = now + 0.03;
    }

    const scheduleAheadSec = 0.11;
    while (this.nextStepTime < now + scheduleAheadSec) {
      this.scheduleStep(this.stepIndex, this.nextStepTime);

      // Smoothly glide BPM toward target to avoid abrupt rhythmic jerks
      this.currentBpm += (this.targetBpm - this.currentBpm) * 0.18;
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
    const variant = spec.riffVariant;
    const intensity = this.currentIntensity;
    const stepDur = 60 / this.currentBpm / 4;

    // 1. Plucked Bouzouki / Oud Arpeggios (always active, sparse in hub, blistering in combat/boss)
    const bouzoukiPattern =
      intensity === 'hub' ? HUB_BOUZOUKI_PATTERN : BOUZOUKI_PATTERNS[variant];
    const bDeg = bouzoukiPattern[step];
    if (bDeg >= 0) {
      // In explore mode, thin out some off-16ths so it pulses darkly rather than shredding
      const playInExplore = intensity !== 'explore' || step % 2 === 0 || step % 8 === 3;
      if (playInExplore) {
        const midi = scaleDegreeToMidi(bDeg, 50 + transpose); // D3 root
        const accent = step % 4 === 0 ? 0.56 : 0.38;
        this.scheduleBouzoukiPluck(midi, time, accent, intensity === 'boss' || intensity === 'combat');
      }
    }

    // 2. Driving Distorted Electric Bass & Power-Chord Synth Riff (explore, combat, boss)
    if (intensity !== 'hub') {
      const riffPattern = BASS_RIFF_PATTERNS[variant];
      const rDeg = riffPattern[step];
      if (rDeg >= 0) {
        const bassMidi = scaleDegreeToMidi(rDeg, 38 + transpose); // D2 root
        const isPowerChord = intensity === 'combat' || intensity === 'boss';
        const isAccent = step % 4 === 0 || rDeg === 1 || rDeg === 2;
        const noteLen = isAccent ? stepDur * 1.45 : stepDur * 0.82;
        this.scheduleElectricRiff(bassMidi, time, noteLen, isPowerChord, isAccent);
      }
    }

    // 3. Crisp Kick, Snare, Hats & Tribal Floor-Tom Percussion (explore, combat, boss)
    if (intensity !== 'hub') {
      this.schedulePercussionStep(step, time, intensity);
    }

    // 4. Soaring Greek-Metal Lead Synth (full in boss, soaring on bars 2-3 of combat!)
    if (intensity === 'boss' || (intensity === 'combat' && (this.barCount === 1 || this.barCount === 3))) {
      const leadPattern = LEAD_MELODY_PATTERNS[variant];
      const lDeg = leadPattern[step];
      if (lDeg >= 0) {
        const leadMidi = scaleDegreeToMidi(lDeg, 62 + transpose); // D4 -> D5 range
        // Look ahead to hold legato until next note or up to 3 sixteenths
        let holdSteps = 1;
        while (holdSteps < 4 && leadPattern[(step + holdSteps) % 32] < 0) {
          holdSteps++;
        }
        const dur = stepDur * (holdSteps * 0.92);
        this.scheduleLeadNote(leadMidi, time, dur, intensity === 'boss' ? 0.44 : 0.3);
      }
    }
  }

  // ============================================================================
  // Instrument Synthesis Voices
  // ============================================================================

  /**
   * Karplus-Strong physical string synthesis cached per MIDI note for authentic
   * metallic Greek bouzouki / oud resonance (including subtle doubled course!).
   */
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

    // Metallic plectrum pluck excitation (bright noise + slight sawtooth impulse)
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) {
      const noise = Math.random() * 2 - 1;
      const saw = (i / period) * 2 - 1;
      ring[i] = noise * 0.78 + saw * 0.22;
    }

    // Damped lowpass averaging feedback loop (high metallic brightness)
    let idx = 0;
    const decay = 0.992;
    for (let i = 0; i < totalSamples; i++) {
      const cur = ring[idx];
      const next = ring[(idx + 1) % period];
      out[i] = cur;
      // Weighted averaging keeps bright steel harmonics ringing like a bouzouki
      ring[idx] = (cur * 0.62 + next * 0.38) * decay;
      idx = (idx + 1) % period;
    }

    // Normalize peak cleanly
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

    // Real Greek bouzoukis have paired octave/unison metal strings for shimmering bite!
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

  /**
   * Distorted electric bass + chugging rock power chord (Root + 5th + Octave).
   */
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

    // Sub-tight bass fundamental (sawtooth + sub sine)
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
    subGain.connect(this.bassBus); // clean tight sub bypasses distortion
    subOsc.start(time);
    subOsc.stop(time + duration + 0.02);

    if (powerChord) {
      // Guitar 5th + Octave chord stack into overdrive
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

  /**
   * Soaring Greek-metal electric lead guitar synth with subtle vibrato.
   */
  private scheduleLeadNote(midi: number, time: number, duration: number, peak: number): void {
    const hz = midiToHz(midi);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.016);
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

    // Expressive rock vibrato on held notes
    if (duration > 0.16) {
      const vib = this.ctx.createOscillator();
      vib.frequency.setValueAtTime(5.6, time);
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

  /**
   * Kick, snare, metallic hi-hat, and tribal Mediterranean floor-tom drum kit.
   */
  private schedulePercussionStep(step: number, time: number, intensity: MusicIntensity): void {
    const s16 = step % 16;

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

    // Combat & Boss: full driving rock kit + tribal tom accents!
    const isBoss = intensity === 'boss';

    // Kick: rock drive (double-kick bursts in boss!)
    const kickHit =
      s16 === 0 ||
      s16 === 6 ||
      s16 === 8 ||
      (isBoss && (s16 === 2 || s16 === 10 || s16 === 14)) ||
      (!isBoss && s16 === 11);
    if (kickHit) {
      this.scheduleKick(time, s16 === 0 || s16 === 8 ? 0.85 : 0.68, this.percussionBus);
    }

    // Crisp backbeat snare on 2 & 4 (steps 4 & 12), plus fill ghost on step 30/31
    if (s16 === 4 || s16 === 12 || (step === 30 && isBoss)) {
      this.scheduleSnare(time, s16 === 4 || s16 === 12 ? 0.72 : 0.45);
    }

    // Driving 8th / 16th hi-hats
    if (step % 2 === 0 || (isBoss && step % 4 === 3)) {
      const open = s16 === 14;
      this.scheduleHiHat(time, step % 4 === 0 ? 0.28 : 0.16, open);
    }

    // Tribal floor-tom groove & end-of-bar fills
    if (s16 === 3 || s16 === 10 || step === 29 || step === 31) {
      const high = step === 29;
      this.scheduleFloorTom(time, 0.46, high ? 1.22 : 0.96);
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

    // Beater punch click
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
    // Wire noise rattle
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

    // Shell crack body
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
    const rootMidi = 38 + (spec?.transposeSemitones ?? 0); // D2

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
    osc2.frequency.value = midiToHz(rootMidi + 7); // Perfect fifth drone
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.2;
    osc2.connect(g2);
    g2.connect(filter);

    // Slow breathing filter sweep
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
    const now = this.ctx.currentTime;
    const rootMidi = 38 + transposeSemitones;
    this.droneOsc1.frequency.setTargetAtTime(midiToHz(rootMidi), now, 0.25);
    this.droneOsc2.frequency.setTargetAtTime(midiToHz(rootMidi + 7), now, 0.25);
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
    this.bouzoukiBus.gain.setTargetAtTime(Math.max(0.0001, mix.bouzouki), now, timeConstant);
    this.bassBus.gain.setTargetAtTime(Math.max(0.0001, mix.bass), now, timeConstant);
    this.percussionBus.gain.setTargetAtTime(Math.max(0.0001, mix.percussion), now, timeConstant);
    this.leadBus.gain.setTargetAtTime(Math.max(0.0001, mix.lead), now, timeConstant);
    this.droneBus.gain.setTargetAtTime(Math.max(0.0001, mix.drone), now, timeConstant);
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
