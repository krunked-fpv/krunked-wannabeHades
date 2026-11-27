/**
 * Krunked WannabeHades — Canonical Audio Manifest (Wave 2 Full Soundtrack & 6-Weapon Arsenal)
 *
 * 100% pure / DOM-free module: safe to import in pure Node scripts (e.g. Gate A `verify:assets`).
 * Defines every procedural SFX ID, Music Track ID, modal scale, polyphony cap, and Patron harmonic signature.
 */

import type { BiomeId, PatronId } from '../contracts/index';

export const SFX_IDS = [
  // Wave 1 Core Combat, Blade, Cast, Dash, Impact, Boss, Patron, UI
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
  // Wave 2 Bespoke Infernal Arms (Spear, Shield, Bow, Fists, Rail)
  'spear_thrust',
  'spear_spin',
  'spear_recall',
  'shield_bash',
  'shield_clang',
  'shield_boomerang',
  'bow_draw',
  'bow_power_shot',
  'bow_volley',
  'fists_flurry',
  'fists_uppercut',
  'rail_shot',
  'rail_reload',
  'rail_mortar',
  // Wave 2 Biome Hazards, Special Enemies, Statuses & Chaos
  'lava_sizzle',
  'poison_hiss',
  'curing_pool_chime',
  'soul_eye_shatter',
  'doom_gong',
  'hangover_fizz',
  'chill_crackle',
  'chaos_void_hum',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

export const MUSIC_TRACK_IDS = [
  'hub_sanctum',
  'boatman_shop',
  'obsidian_pit',
  'boss_warden',
  'cinder_mire',
  'boss_leviathan',
  'verdant_colosseum',
  'boss_champions',
  'crypt_of_bile',
  'boss_ferryman',
  'frozen_summit',
  'boss_sovereign',
  'boss_sovereign_p2',
  'victory_fanfare',
  'death_stinger',
] as const;

export type MusicTrackId = (typeof MUSIC_TRACK_IDS)[number];

export type AudioId = SfxId | MusicTrackId;

export type MusicIntensity = 'hub' | 'explore' | 'combat' | 'boss';

export type MusicalModeId = 'phrygian_dominant' | 'aeolian' | 'dorian' | 'harmonic_minor';

export type SfxCategory =
  | 'weapon'
  | 'movement'
  | 'impact'
  | 'combat_event'
  | 'patron'
  | 'hazard'
  | 'world'
  | 'ui';

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
  /** Wet send amount to the cavern reverb bus (0..1). */
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
  // Wave 2 — Eternal Spear
  spear_thrust: {
    id: 'spear_thrust',
    category: 'weapon',
    defaultGain: 0.48,
    maxPolyphony: 3,
    pitchJitter: 0.08,
    minIntervalMs: 35,
    reverbSend: 0.12,
  },
  spear_spin: {
    id: 'spear_spin',
    category: 'weapon',
    defaultGain: 0.62,
    maxPolyphony: 2,
    pitchJitter: 0.06,
    minIntervalMs: 80,
    reverbSend: 0.28,
  },
  spear_recall: {
    id: 'spear_recall',
    category: 'weapon',
    defaultGain: 0.54,
    maxPolyphony: 2,
    pitchJitter: 0.06,
    minIntervalMs: 60,
    reverbSend: 0.22,
  },
  // Wave 2 — Shield of Chaos
  shield_bash: {
    id: 'shield_bash',
    category: 'weapon',
    defaultGain: 0.58,
    maxPolyphony: 3,
    pitchJitter: 0.07,
    minIntervalMs: 45,
    reverbSend: 0.18,
  },
  shield_clang: {
    id: 'shield_clang',
    category: 'weapon',
    defaultGain: 0.64,
    maxPolyphony: 3,
    pitchJitter: 0.06,
    minIntervalMs: 45,
    reverbSend: 0.34,
  },
  shield_boomerang: {
    id: 'shield_boomerang',
    category: 'weapon',
    defaultGain: 0.54,
    maxPolyphony: 2,
    pitchJitter: 0.06,
    minIntervalMs: 60,
    reverbSend: 0.24,
  },
  // Wave 2 — Heart-Seeking Bow
  bow_draw: {
    id: 'bow_draw',
    category: 'weapon',
    defaultGain: 0.36,
    maxPolyphony: 2,
    pitchJitter: 0.06,
    minIntervalMs: 80,
    reverbSend: 0.08,
  },
  bow_power_shot: {
    id: 'bow_power_shot',
    category: 'weapon',
    defaultGain: 0.64,
    maxPolyphony: 3,
    pitchJitter: 0.05,
    minIntervalMs: 45,
    reverbSend: 0.28,
  },
  bow_volley: {
    id: 'bow_volley',
    category: 'weapon',
    defaultGain: 0.58,
    maxPolyphony: 2,
    pitchJitter: 0.07,
    minIntervalMs: 65,
    reverbSend: 0.22,
  },
  // Wave 2 — Twin Fists
  fists_flurry: {
    id: 'fists_flurry',
    category: 'weapon',
    defaultGain: 0.44,
    maxPolyphony: 4,
    pitchJitter: 0.08,
    minIntervalMs: 28,
    reverbSend: 0.08,
  },
  fists_uppercut: {
    id: 'fists_uppercut',
    category: 'weapon',
    defaultGain: 0.64,
    maxPolyphony: 2,
    pitchJitter: 0.06,
    minIntervalMs: 60,
    reverbSend: 0.24,
  },
  // Wave 2 — Adamant Rail
  rail_shot: {
    id: 'rail_shot',
    category: 'weapon',
    defaultGain: 0.46,
    maxPolyphony: 4,
    pitchJitter: 0.08,
    minIntervalMs: 32,
    reverbSend: 0.1,
  },
  rail_reload: {
    id: 'rail_reload',
    category: 'weapon',
    defaultGain: 0.52,
    maxPolyphony: 2,
    pitchJitter: 0.05,
    minIntervalMs: 120,
    reverbSend: 0.12,
  },
  rail_mortar: {
    id: 'rail_mortar',
    category: 'weapon',
    defaultGain: 0.72,
    maxPolyphony: 2,
    pitchJitter: 0.06,
    minIntervalMs: 85,
    reverbSend: 0.34,
  },
  // Wave 2 — Biome Hazards, Soul-Eye, Statuses, Chaos
  lava_sizzle: {
    id: 'lava_sizzle',
    category: 'hazard',
    defaultGain: 0.48,
    maxPolyphony: 2,
    pitchJitter: 0.08,
    minIntervalMs: 160,
    reverbSend: 0.14,
  },
  poison_hiss: {
    id: 'poison_hiss',
    category: 'hazard',
    defaultGain: 0.46,
    maxPolyphony: 2,
    pitchJitter: 0.08,
    minIntervalMs: 160,
    reverbSend: 0.16,
  },
  curing_pool_chime: {
    id: 'curing_pool_chime',
    category: 'world',
    defaultGain: 0.58,
    maxPolyphony: 2,
    pitchJitter: 0.04,
    minIntervalMs: 140,
    reverbSend: 0.4,
  },
  soul_eye_shatter: {
    id: 'soul_eye_shatter',
    category: 'combat_event',
    defaultGain: 0.62,
    maxPolyphony: 3,
    pitchJitter: 0.06,
    minIntervalMs: 55,
    reverbSend: 0.36,
  },
  doom_gong: {
    id: 'doom_gong',
    category: 'combat_event',
    defaultGain: 0.7,
    maxPolyphony: 3,
    pitchJitter: 0.05,
    minIntervalMs: 65,
    reverbSend: 0.42,
  },
  hangover_fizz: {
    id: 'hangover_fizz',
    category: 'combat_event',
    defaultGain: 0.44,
    maxPolyphony: 3,
    pitchJitter: 0.08,
    minIntervalMs: 70,
    reverbSend: 0.16,
  },
  chill_crackle: {
    id: 'chill_crackle',
    category: 'combat_event',
    defaultGain: 0.46,
    maxPolyphony: 3,
    pitchJitter: 0.08,
    minIntervalMs: 65,
    reverbSend: 0.24,
  },
  chaos_void_hum: {
    id: 'chaos_void_hum',
    category: 'world',
    defaultGain: 0.64,
    maxPolyphony: 1,
    pitchJitter: 0.03,
    minIntervalMs: 280,
    reverbSend: 0.5,
  },
};

/**
 * Phrygian Dominant (Hijaz / Freygish) semitone intervals from root:
 * D (0), Eb (1), F# (4), G (5), A (7), Bb (8), C (10).
 */
export const PHRYGIAN_DOMINANT_INTERVALS = [0, 1, 4, 5, 7, 8, 10] as const;

export const SCALE_INTERVALS: Readonly<Record<MusicalModeId, readonly number[]>> = {
  phrygian_dominant: PHRYGIAN_DOMINANT_INTERVALS,
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
};

export type DrumStyleId =
  | 'none'
  | 'shop'
  | 'tartarus_rock'
  | 'mire_syncopated'
  | 'colosseum_march'
  | 'crypt_sludge'
  | 'summit_gothic'
  | 'warden_thrash'
  | 'leviathan_tribal'
  | 'champions_gallop'
  | 'ferryman_heavy'
  | 'sovereign_orchestral'
  | 'sovereign_shred';

export interface MusicTrackSpec {
  readonly id: MusicTrackId;
  readonly displayName: string;
  readonly bpm: number;
  /** Semitone offset relative to D (0 = D, 2 = E, -1 = C#, -2 = C, 4 = F#, -5 = A). */
  readonly transposeSemitones: number;
  readonly mode: MusicalModeId;
  readonly defaultIntensity: MusicIntensity;
  readonly biome?: BiomeId;
  readonly isOneShot: boolean;
  readonly riffVariant: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly drumStyle: DrumStyleId;
  /** Weight of the orchestral brass/strings stem (0..1). */
  readonly orchestralWeight: number;
}

export const MUSIC_TRACK_MANIFEST: Readonly<Record<MusicTrackId, MusicTrackSpec>> = {
  hub_sanctum: {
    id: 'hub_sanctum',
    displayName: 'Sanctum of Ash (Lyre)',
    bpm: 92,
    transposeSemitones: 0, // D Phrygian Dominant
    mode: 'phrygian_dominant',
    defaultIntensity: 'hub',
    biome: 'sanctum_hub',
    isOneShot: false,
    riffVariant: 0,
    drumStyle: 'none',
    orchestralWeight: 0.12,
  },
  boatman_shop: {
    id: 'boatman_shop',
    displayName: 'Ferryman Crossing (Shop)',
    bpm: 98,
    transposeSemitones: -5, // A Dorian
    mode: 'dorian',
    defaultIntensity: 'explore',
    isOneShot: false,
    riffVariant: 4,
    drumStyle: 'shop',
    orchestralWeight: 0.22,
  },
  obsidian_pit: {
    id: 'obsidian_pit',
    displayName: 'Out of the Obsidian Pit',
    bpm: 128,
    transposeSemitones: 0, // D Phrygian Dominant
    mode: 'phrygian_dominant',
    defaultIntensity: 'combat',
    biome: 'obsidian_pit',
    isOneShot: false,
    riffVariant: 0,
    drumStyle: 'tartarus_rock',
    orchestralWeight: 0.14,
  },
  boss_warden: {
    id: 'boss_warden',
    displayName: 'Scourge of the Wardens',
    bpm: 148,
    transposeSemitones: 0, // D Phrygian Dominant
    mode: 'phrygian_dominant',
    defaultIntensity: 'boss',
    biome: 'obsidian_pit',
    isOneShot: false,
    riffVariant: 1,
    drumStyle: 'warden_thrash',
    orchestralWeight: 0.34,
  },
  cinder_mire: {
    id: 'cinder_mire',
    displayName: 'Ashes of the Cinder Mire',
    bpm: 136,
    transposeSemitones: 2, // E Harmonic Minor
    mode: 'harmonic_minor',
    defaultIntensity: 'combat',
    biome: 'cinder_mire',
    isOneShot: false,
    riffVariant: 2,
    drumStyle: 'mire_syncopated',
    orchestralWeight: 0.18,
  },
  boss_leviathan: {
    id: 'boss_leviathan',
    displayName: 'Serpent of the Molten Pit',
    bpm: 142,
    transposeSemitones: 2, // E Phrygian Dominant
    mode: 'phrygian_dominant',
    defaultIntensity: 'boss',
    biome: 'cinder_mire',
    isOneShot: false,
    riffVariant: 5,
    drumStyle: 'leviathan_tribal',
    orchestralWeight: 0.42,
  },
  verdant_colosseum: {
    id: 'verdant_colosseum',
    displayName: 'Crown of the Colosseum',
    bpm: 132,
    transposeSemitones: -1, // C# Aeolian
    mode: 'aeolian',
    defaultIntensity: 'combat',
    biome: 'verdant_colosseum',
    isOneShot: false,
    riffVariant: 6,
    drumStyle: 'colosseum_march',
    orchestralWeight: 0.56,
  },
  boss_champions: {
    id: 'boss_champions',
    displayName: 'Champions of the Arena',
    bpm: 146,
    transposeSemitones: -1, // C# Aeolian heroic anthem
    mode: 'aeolian',
    defaultIntensity: 'boss',
    biome: 'verdant_colosseum',
    isOneShot: false,
    riffVariant: 6,
    drumStyle: 'champions_gallop',
    orchestralWeight: 0.72,
  },
  crypt_of_bile: {
    id: 'crypt_of_bile',
    displayName: 'Gates of the Crypt',
    bpm: 122,
    transposeSemitones: -2, // C Phrygian Dominant sludge
    mode: 'phrygian_dominant',
    defaultIntensity: 'combat',
    biome: 'crypt_of_bile',
    isOneShot: false,
    riffVariant: 3,
    drumStyle: 'crypt_sludge',
    orchestralWeight: 0.24,
  },
  boss_ferryman: {
    id: 'boss_ferryman',
    displayName: 'Toll of the Oar',
    bpm: 136,
    transposeSemitones: -5, // A Dorian heavy groove
    mode: 'dorian',
    defaultIntensity: 'boss',
    isOneShot: false,
    riffVariant: 4,
    drumStyle: 'ferryman_heavy',
    orchestralWeight: 0.52,
  },
  frozen_summit: {
    id: 'frozen_summit',
    displayName: 'Frost of the Summit',
    bpm: 138,
    transposeSemitones: 4, // F# Dorian gothic
    mode: 'dorian',
    defaultIntensity: 'combat',
    biome: 'frozen_summit',
    isOneShot: false,
    riffVariant: 2,
    drumStyle: 'summit_gothic',
    orchestralWeight: 0.58,
  },
  boss_sovereign: {
    id: 'boss_sovereign',
    displayName: 'Sovereign of the Deep (Phase I)',
    bpm: 134,
    transposeSemitones: 0, // D Aeolian orchestral-metal
    mode: 'aeolian',
    defaultIntensity: 'boss',
    biome: 'frozen_summit',
    isOneShot: false,
    riffVariant: 7,
    drumStyle: 'sovereign_orchestral',
    orchestralWeight: 0.92,
  },
  boss_sovereign_p2: {
    id: 'boss_sovereign_p2',
    displayName: 'Sovereign Unbound (Phase II Shred)',
    bpm: 162,
    transposeSemitones: 0, // D Harmonic Minor double-kick shred
    mode: 'harmonic_minor',
    defaultIntensity: 'boss',
    biome: 'frozen_summit',
    isOneShot: false,
    riffVariant: 7,
    drumStyle: 'sovereign_shred',
    orchestralWeight: 0.78,
  },
  victory_fanfare: {
    id: 'victory_fanfare',
    displayName: 'Escape Triumphant',
    bpm: 120,
    transposeSemitones: 0,
    mode: 'dorian',
    defaultIntensity: 'hub',
    isOneShot: true,
    riffVariant: 0,
    drumStyle: 'none',
    orchestralWeight: 0.8,
  },
  death_stinger: {
    id: 'death_stinger',
    displayName: 'Return to Ash',
    bpm: 84,
    transposeSemitones: 0,
    mode: 'phrygian_dominant',
    defaultIntensity: 'hub',
    isOneShot: true,
    riffVariant: 0,
    drumStyle: 'none',
    orchestralWeight: 0.7,
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
