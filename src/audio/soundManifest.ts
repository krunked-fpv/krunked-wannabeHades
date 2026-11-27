/**
 * Krunked WannabeHades — Canonical Audio Manifest
 *
 * 100% pure / DOM-free module: safe to import in pure Node scripts (e.g. Gate A `verify:assets`).
 * Defines every procedural SFX ID, Music Track ID, polyphony cap, and Patron harmonic signature.
 */

import type { BiomeId, PatronId } from '../contracts/index';

export const SFX_IDS = [
  'sword_swing_1',
  'sword_swing_2',
  'sword_swing_3',
  'sword_nova',
  'dash',
  'dash_perfect',
  'cast_fire',
  'cast_pickup',
  'hit_light',
  'hit_heavy',
  'hit_crit',
  'hit_backstab',
  'armor_break',
  'wall_slam',
  'deflect',
  'enemy_death',
  'final_kill_boom',
  'boss_phase',
  'boon_offer',
  'boon_select',
  'god_call',
  'player_hit',
  'death_defiance',
  'door_unlock',
  'room_enter',
  'ui_click',
  'ui_hover',
  'ui_confirm',
  'ui_back',
  'pickup_collect',
  'status_proc',
  'enemy_spawn',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

export const MUSIC_TRACK_IDS = [
  'hub_sanctum',
  'obsidian_pit',
  'boss_warden',
  'cinder_mire',
  'verdant_colosseum',
  'crypt_of_bile',
  'frozen_summit',
  'boss_sovereign',
  'victory_fanfare',
  'death_stinger',
] as const;

export type MusicTrackId = (typeof MUSIC_TRACK_IDS)[number];

export type AudioId = SfxId | MusicTrackId;

export type MusicIntensity = 'hub' | 'explore' | 'combat' | 'boss';

export type SfxCategory = 'weapon' | 'movement' | 'impact' | 'combat_event' | 'patron' | 'world' | 'ui';

export interface SfxSpec {
  readonly id: SfxId;
  readonly category: SfxCategory;
  readonly defaultGain: number;
  /** Per-ID polyphony cap (always <= 4). */
  readonly maxPolyphony: 1 | 2 | 3 | 4;
  /** Symmetric fractional pitch jitter (e.g. 0.08 = ±8%). */
  readonly pitchJitter: number;
  /** Minimum milliseconds between retriggers of the same ID to prevent wall-of-sound clipping. */
  readonly minIntervalMs: number;
  /** Whether this sound routes a wet send to the cavern reverb bus. */
  readonly reverbSend: number;
}

export const SFX_MANIFEST: Readonly<Record<SfxId, SfxSpec>> = {
  sword_swing_1: {
    id: 'sword_swing_1',
    category: 'weapon',
    defaultGain: 0.42,
    maxPolyphony: 3,
    pitchJitter: 0.08,
    minIntervalMs: 35,
    reverbSend: 0.1,
  },
  sword_swing_2: {
    id: 'sword_swing_2',
    category: 'weapon',
    defaultGain: 0.46,
    maxPolyphony: 3,
    pitchJitter: 0.08,
    minIntervalMs: 35,
    reverbSend: 0.12,
  },
  sword_swing_3: {
    id: 'sword_swing_3',
    category: 'weapon',
    defaultGain: 0.54,
    maxPolyphony: 3,
    pitchJitter: 0.07,
    minIntervalMs: 40,
    reverbSend: 0.18,
  },
  sword_nova: {
    id: 'sword_nova',
    category: 'weapon',
    defaultGain: 0.68,
    maxPolyphony: 2,
    pitchJitter: 0.06,
    minIntervalMs: 70,
    reverbSend: 0.32,
  },
  dash: {
    id: 'dash',
    category: 'movement',
    defaultGain: 0.38,
    maxPolyphony: 3,
    pitchJitter: 0.08,
    minIntervalMs: 45,
    reverbSend: 0.08,
  },
  dash_perfect: {
    id: 'dash_perfect',
    category: 'movement',
    defaultGain: 0.58,
    maxPolyphony: 2,
    pitchJitter: 0.05,
    minIntervalMs: 60,
    reverbSend: 0.28,
  },
  cast_fire: {
    id: 'cast_fire',
    category: 'weapon',
    defaultGain: 0.5,
    maxPolyphony: 4,
    pitchJitter: 0.08,
    minIntervalMs: 40,
    reverbSend: 0.18,
  },
  cast_pickup: {
    id: 'cast_pickup',
    category: 'world',
    defaultGain: 0.4,
    maxPolyphony: 3,
    pitchJitter: 0.06,
    minIntervalMs: 45,
    reverbSend: 0.16,
  },
  hit_light: {
    id: 'hit_light',
    category: 'impact',
    defaultGain: 0.46,
    maxPolyphony: 4,
    pitchJitter: 0.08,
    minIntervalMs: 24,
    reverbSend: 0.06,
  },
  hit_heavy: {
    id: 'hit_heavy',
    category: 'impact',
    defaultGain: 0.58,
    maxPolyphony: 4,
    pitchJitter: 0.08,
    minIntervalMs: 30,
    reverbSend: 0.14,
  },
  hit_crit: {
    id: 'hit_crit',
    category: 'impact',
    defaultGain: 0.68,
    maxPolyphony: 3,
    pitchJitter: 0.06,
    minIntervalMs: 35,
    reverbSend: 0.26,
  },
  hit_backstab: {
    id: 'hit_backstab',
    category: 'impact',
    defaultGain: 0.56,
    maxPolyphony: 3,
    pitchJitter: 0.07,
    minIntervalMs: 30,
    reverbSend: 0.15,
  },
  armor_break: {
    id: 'armor_break',
    category: 'combat_event',
    defaultGain: 0.72,
    maxPolyphony: 2,
    pitchJitter: 0.06,
    minIntervalMs: 80,
    reverbSend: 0.35,
  },
  wall_slam: {
    id: 'wall_slam',
    category: 'impact',
    defaultGain: 0.64,
    maxPolyphony: 3,
    pitchJitter: 0.08,
    minIntervalMs: 45,
    reverbSend: 0.22,
  },
  deflect: {
    id: 'deflect',
    category: 'combat_event',
    defaultGain: 0.66,
    maxPolyphony: 3,
    pitchJitter: 0.05,
    minIntervalMs: 45,
    reverbSend: 0.36,
  },
  enemy_death: {
    id: 'enemy_death',
    category: 'combat_event',
    defaultGain: 0.5,
    maxPolyphony: 4,
    pitchJitter: 0.08,
    minIntervalMs: 35,
    reverbSend: 0.2,
  },
  final_kill_boom: {
    id: 'final_kill_boom',
    category: 'combat_event',
    defaultGain: 0.85,
    maxPolyphony: 1,
    pitchJitter: 0.02,
    minIntervalMs: 300,
    reverbSend: 0.45,
  },
  boss_phase: {
    id: 'boss_phase',
    category: 'combat_event',
    defaultGain: 0.78,
    maxPolyphony: 1,
    pitchJitter: 0.03,
    minIntervalMs: 350,
    reverbSend: 0.42,
  },
  boon_offer: {
    id: 'boon_offer',
    category: 'patron',
    defaultGain: 0.62,
    maxPolyphony: 2,
    pitchJitter: 0.02,
    minIntervalMs: 120,
    reverbSend: 0.42,
  },
  boon_select: {
    id: 'boon_select',
    category: 'patron',
    defaultGain: 0.66,
    maxPolyphony: 2,
    pitchJitter: 0.02,
    minIntervalMs: 120,
    reverbSend: 0.45,
  },
  god_call: {
    id: 'god_call',
    category: 'patron',
    defaultGain: 0.8,
    maxPolyphony: 2,
    pitchJitter: 0.03,
    minIntervalMs: 150,
    reverbSend: 0.48,
  },
  player_hit: {
    id: 'player_hit',
    category: 'impact',
    defaultGain: 0.66,
    maxPolyphony: 2,
    pitchJitter: 0.06,
    minIntervalMs: 75,
    reverbSend: 0.14,
  },
  death_defiance: {
    id: 'death_defiance',
    category: 'combat_event',
    defaultGain: 0.82,
    maxPolyphony: 1,
    pitchJitter: 0.02,
    minIntervalMs: 400,
    reverbSend: 0.48,
  },
  door_unlock: {
    id: 'door_unlock',
    category: 'world',
    defaultGain: 0.62,
    maxPolyphony: 2,
    pitchJitter: 0.03,
    minIntervalMs: 150,
    reverbSend: 0.36,
  },
  room_enter: {
    id: 'room_enter',
    category: 'world',
    defaultGain: 0.48,
    maxPolyphony: 2,
    pitchJitter: 0.05,
    minIntervalMs: 150,
    reverbSend: 0.3,
  },
  ui_click: {
    id: 'ui_click',
    category: 'ui',
    defaultGain: 0.36,
    maxPolyphony: 3,
    pitchJitter: 0.04,
    minIntervalMs: 25,
    reverbSend: 0.05,
  },
  ui_hover: {
    id: 'ui_hover',
    category: 'ui',
    defaultGain: 0.2,
    maxPolyphony: 3,
    pitchJitter: 0.05,
    minIntervalMs: 28,
    reverbSend: 0.02,
  },
  ui_confirm: {
    id: 'ui_confirm',
    category: 'ui',
    defaultGain: 0.44,
    maxPolyphony: 2,
    pitchJitter: 0.03,
    minIntervalMs: 40,
    reverbSend: 0.14,
  },
  ui_back: {
    id: 'ui_back',
    category: 'ui',
    defaultGain: 0.34,
    maxPolyphony: 2,
    pitchJitter: 0.04,
    minIntervalMs: 35,
    reverbSend: 0.08,
  },
  pickup_collect: {
    id: 'pickup_collect',
    category: 'world',
    defaultGain: 0.44,
    maxPolyphony: 4,
    pitchJitter: 0.07,
    minIntervalMs: 35,
    reverbSend: 0.18,
  },
  status_proc: {
    id: 'status_proc',
    category: 'combat_event',
    defaultGain: 0.44,
    maxPolyphony: 4,
    pitchJitter: 0.08,
    minIntervalMs: 45,
    reverbSend: 0.16,
  },
  enemy_spawn: {
    id: 'enemy_spawn',
    category: 'world',
    defaultGain: 0.32,
    maxPolyphony: 3,
    pitchJitter: 0.08,
    minIntervalMs: 65,
    reverbSend: 0.24,
  },
};

export interface MusicTrackSpec {
  readonly id: MusicTrackId;
  readonly displayName: string;
  readonly bpm: number;
  /** Semitone offset relative to D Phrygian Dominant (0 = D). */
  readonly transposeSemitones: number;
  readonly defaultIntensity: MusicIntensity;
  readonly biome?: BiomeId;
  readonly isOneShot: boolean;
  readonly riffVariant: 0 | 1 | 2 | 3;
}

/**
 * Phrygian Dominant (Hijaz / Freygish) semitone intervals from D:
 * D (0), Eb (1), F# (4), G (5), A (7), Bb (8), C (10).
 */
export const PHRYGIAN_DOMINANT_INTERVALS = [0, 1, 4, 5, 7, 8, 10] as const;

export const MUSIC_TRACK_MANIFEST: Readonly<Record<MusicTrackId, MusicTrackSpec>> = {
  hub_sanctum: {
    id: 'hub_sanctum',
    displayName: 'Sanctum of Ash (Lyre)',
    bpm: 92,
    transposeSemitones: 0,
    defaultIntensity: 'hub',
    biome: 'sanctum_hub',
    isOneShot: false,
    riffVariant: 0,
  },
  obsidian_pit: {
    id: 'obsidian_pit',
    displayName: 'Out of the Obsidian Pit',
    bpm: 128,
    transposeSemitones: 0,
    defaultIntensity: 'combat',
    biome: 'obsidian_pit',
    isOneShot: false,
    riffVariant: 0,
  },
  boss_warden: {
    id: 'boss_warden',
    displayName: 'Scourge of the Wardens',
    bpm: 148,
    transposeSemitones: 0,
    defaultIntensity: 'boss',
    biome: 'obsidian_pit',
    isOneShot: false,
    riffVariant: 1,
  },
  cinder_mire: {
    id: 'cinder_mire',
    displayName: 'Ashes of the Mire',
    bpm: 134,
    transposeSemitones: 2, // E Phrygian Dominant
    defaultIntensity: 'combat',
    biome: 'cinder_mire',
    isOneShot: false,
    riffVariant: 2,
  },
  verdant_colosseum: {
    id: 'verdant_colosseum',
    displayName: 'Crown of the Colosseum',
    bpm: 132,
    transposeSemitones: -1, // C# Phrygian Dominant
    defaultIntensity: 'combat',
    biome: 'verdant_colosseum',
    isOneShot: false,
    riffVariant: 1,
  },
  crypt_of_bile: {
    id: 'crypt_of_bile',
    displayName: 'Gates of the Crypt',
    bpm: 124,
    transposeSemitones: -2, // C Phrygian Dominant
    defaultIntensity: 'combat',
    biome: 'crypt_of_bile',
    isOneShot: false,
    riffVariant: 3,
  },
  frozen_summit: {
    id: 'frozen_summit',
    displayName: 'Frost of the Summit',
    bpm: 138,
    transposeSemitones: 4, // F# Phrygian Dominant
    defaultIntensity: 'combat',
    biome: 'frozen_summit',
    isOneShot: false,
    riffVariant: 2,
  },
  boss_sovereign: {
    id: 'boss_sovereign',
    displayName: 'God of the Deep',
    bpm: 154,
    transposeSemitones: 0,
    defaultIntensity: 'boss',
    biome: 'frozen_summit',
    isOneShot: false,
    riffVariant: 3,
  },
  victory_fanfare: {
    id: 'victory_fanfare',
    displayName: 'Escape Triumphant',
    bpm: 120,
    transposeSemitones: 0,
    defaultIntensity: 'hub',
    isOneShot: true,
    riffVariant: 0,
  },
  death_stinger: {
    id: 'death_stinger',
    displayName: 'Return to Ash',
    bpm: 84,
    transposeSemitones: 0,
    defaultIntensity: 'hub',
    isOneShot: true,
    riffVariant: 0,
  },
};

export interface PatronAudioProfile {
  readonly id: PatronId;
  /** Root MIDI note for the patron's signature harmonic chord. */
  readonly rootMidi: number;
  /** Semitone intervals forming the patron's stinger chord. */
  readonly chordIntervals: readonly number[];
  /** Primary oscillator timbre character. */
  readonly wave: 'triangle' | 'sawtooth' | 'sine' | 'square';
  /** Brightness / lowpass filter cutoff in Hz. */
  readonly cutoffHz: number;
  /** Accent texture layered on the chord. */
  readonly texture: 'electric' | 'wave' | 'gong' | 'harp' | 'crystal' | 'brass' | 'chime' | 'ice' | 'wind' | 'void';
}

export const PATRON_AUDIO_PROFILES: Readonly<Record<PatronId, PatronAudioProfile>> = {
  voltaris: {
    id: 'voltaris',
    rootMidi: 62, // D4
    chordIntervals: [0, 7, 12, 18, 19], // Open electric fifth + Lydian #4 spark
    wave: 'sawtooth',
    cutoffHz: 4600,
    texture: 'electric',
  },
  tidebreaker: {
    id: 'tidebreaker',
    rootMidi: 55, // G3
    chordIntervals: [0, 7, 11, 14, 19], // Lush surging maj9
    wave: 'triangle',
    cutoffHz: 2600,
    texture: 'wave',
  },
  aegira: {
    id: 'aegira',
    rootMidi: 60, // C4
    chordIntervals: [0, 7, 12, 16, 19], // Noble major fifths + radiant bell
    wave: 'triangle',
    cutoffHz: 3800,
    texture: 'gong',
  },
  velouris: {
    id: 'velouris',
    rootMidi: 65, // F4
    chordIntervals: [0, 4, 7, 11, 14], // Warm velvet maj9 harp
    wave: 'sine',
    cutoffHz: 3200,
    texture: 'harp',
  },
  sylvara: {
    id: 'sylvara',
    rootMidi: 64, // E4
    chordIntervals: [0, 7, 11, 16, 19], // Crisp open woodland chime
    wave: 'triangle',
    cutoffHz: 4800,
    texture: 'crystal',
  },
  bellum: {
    id: 'bellum',
    rootMidi: 50, // D3
    chordIntervals: [0, 1, 7, 12, 13], // Menacing Phrygian b2 brass roar
    wave: 'sawtooth',
    cutoffHz: 2200,
    texture: 'brass',
  },
  bacchion: {
    id: 'bacchion',
    rootMidi: 58, // Bb3
    chordIntervals: [0, 4, 7, 10, 14], // Festive dominant 9th revelry
    wave: 'triangle',
    cutoffHz: 3000,
    texture: 'chime',
  },
  glaciera: {
    id: 'glaciera',
    rootMidi: 66, // F#4
    chordIntervals: [0, 3, 7, 14, 19], // Glacial minor 9th ice crystals
    wave: 'sine',
    cutoffHz: 5600,
    texture: 'ice',
  },
  veloce: {
    id: 'veloce',
    rootMidi: 67, // G4
    chordIntervals: [0, 5, 7, 12, 17], // Fleet sus4 arpeggio rush
    wave: 'triangle',
    cutoffHz: 4400,
    texture: 'wind',
  },
  abyssos: {
    id: 'abyssos',
    rootMidi: 48, // C3
    chordIntervals: [0, 6, 11, 13, 18], // Primordial void tritone & cluster
    wave: 'sawtooth',
    cutoffHz: 1800,
    texture: 'void',
  },
};

/**
 * Pure Node-safe helper returning every canonical built-in procedural audio ID
 * (SFX + Music Tracks) for Gate A `verify:assets` validation.
 */
export function getBuiltinAudioIds(): string[] {
  return [...SFX_IDS, ...MUSIC_TRACK_IDS];
}
