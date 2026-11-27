/**
 * Krunked WannabeHades — Schema-Validated Save Persistence
 *
 * Pure validation (`validateAndMigrateSave`) is 100% DOM-free and Node-testable.
 * `localStorage` access is guarded for private browsing, quota errors, and headless Node.
 */

import {
  ASPECT_DEFS,
  DEFAULT_RENDER_SETTINGS,
  KEEPSAKES,
  MIRROR_UPGRADES,
  PLAYER_CONSTANTS,
  SHRINE_VOWS,
  WEAPON_CONSTANTS,
  type AspectId,
  type EnemyArchetypeId,
  type KeepsakeId,
  type MetaSaveState,
  type MirrorUpgradeId,
  type RenderSettings,
  type ShrineVowId,
  type WeaponId,
} from '../contracts/index.js';

export const SAVE_STORAGE_KEY = 'krunked_wannabehades_save_v1' as const;
export const SAVE_SCHEMA_VERSION = 1 as const;

const VALID_WEAPONS = new Set<WeaponId>(Object.keys(WEAPON_CONSTANTS) as WeaponId[]);
const VALID_ASPECTS = new Set<AspectId>(Object.keys(ASPECT_DEFS) as AspectId[]);
const VALID_MIRROR_IDS = Object.keys(MIRROR_UPGRADES) as MirrorUpgradeId[];
const VALID_VOW_IDS = Object.keys(SHRINE_VOWS) as ShrineVowId[];
const VALID_KEEPSAKE_IDS = new Set<KeepsakeId>(Object.keys(KEEPSAKES) as KeepsakeId[]);

const VALID_ENEMY_ARCHETYPES = new Set<EnemyArchetypeId>([
  'rattlebones_dummy',
  'wretched_husk',
  'bone_archer',
  'brimstone_crystal',
  'ember_lout',
  'numbskull',
  'wretch_assassin',
  'slag_thrower',
  'lava_gorgon',
  'bloodless_drifter',
  'infernal_bomber',
  'bone_hydra_head',
  'colosseum_swordsman',
  'colosseum_shieldbearer',
  'colosseum_bowman',
  'chariot_flame',
  'soul_orb',
  'venom_satyr',
  'giant_vermin',
  'snakestone_laser',
  'heavy_brawler',
  'warden_malice',
  'warden_fury',
  'warden_murder',
  'bone_leviathan',
  'colosseum_bull',
  'colosseum_spearlord',
  'the_ferryman',
  'sovereign_lord',
]);

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function sanitizeInt(val: unknown, fallback: number, min: number, max: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return fallback;
  }
  const rounded = Math.floor(val);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function sanitizeFloat(val: unknown, fallback: number, min: number, max: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return fallback;
  }
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

function sanitizeBool(val: unknown, fallback: boolean): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

function getDefaultSelectedAspects(): Record<WeaponId, AspectId> {
  return {
    stygian_blade: 'blade_scion',
    eternal_spear: 'spear_scion',
    shield_of_chaos: 'shield_scion',
    heart_seeking_bow: 'bow_scion',
    twin_fists: 'fists_scion',
    adamant_rail: 'rail_scion',
  };
}

function getDefaultMirrorRanks(): Record<MirrorUpgradeId, number> {
  return {
    shadow_presence: 1,
    cinder_vitality: 1,
    death_defiance: 1,
    greater_reflex: 1,
    boiling_blood: 1,
    infernal_soul: 0,
    deep_pockets: 0,
    thick_skin: 5,
    privileged_status: 0,
    patron_favor: 0,
    divine_pride: 0,
    fated_authority: 0,
  };
}

function getDefaultMirrorSides(): Record<MirrorUpgradeId, 'a' | 'b'> {
  return {
    shadow_presence: 'a',
    cinder_vitality: 'a',
    death_defiance: 'a',
    greater_reflex: 'a',
    boiling_blood: 'a',
    infernal_soul: 'a',
    deep_pockets: 'a',
    thick_skin: 'a',
    privileged_status: 'a',
    patron_favor: 'a',
    divine_pride: 'a',
    fated_authority: 'a',
  };
}

export function createDefaultMetaSave(): MetaSaveState {
  return {
    version: SAVE_SCHEMA_VERSION,
    darkness: 120,
    gemstones: 25,
    keys: 2,
    nectar: 1,
    titanBlood: 1,
    diamonds: 0,
    ambrosia: 0,
    totalRuns: 0,
    totalClears: 0,
    totalDeaths: 0,
    bestClearTimeSeconds: null,
    highestHeatCleared: 0,
    godModeEnabled: false,
    godModeDeaths: 0,
    selectedWeapon: 'stygian_blade',
    selectedAspects: getDefaultSelectedAspects(),
    unlockedWeapons: [
      'stygian_blade',
      'eternal_spear',
      'shield_of_chaos',
      'heart_seeking_bow',
      'twin_fists',
      'adamant_rail',
    ],
    aspectRanks: {
      blade_scion: 1,
      spear_scion: 1,
      shield_scion: 1,
      bow_scion: 1,
      fists_scion: 1,
      rail_scion: 1,
    },
    selectedKeepsake: 'old_collar',
    unlockedKeepsakes: ['old_collar', 'lucky_fang', 'thunder_signet', 'conch_shell', 'owl_pendant', 'eternal_rose'],
    keepsakeRanks: {
      old_collar: 1,
      lucky_fang: 1,
      thunder_signet: 1,
      conch_shell: 1,
      owl_pendant: 1,
      eternal_rose: 1,
    },
    mirrorRanks: getDefaultMirrorRanks(),
    mirrorActiveSide: getDefaultMirrorSides(),
    shrineVows: {},
    codexKills: {},
    codexBoonsSeen: [],
    settings: { ...DEFAULT_RENDER_SETTINGS },
  };
}

function sanitizeSettings(raw: unknown): RenderSettings {
  const base: RenderSettings = { ...DEFAULT_RENDER_SETTINGS };
  if (!isRecord(raw)) {
    return base;
  }

  const targetFps = raw.targetFps;
  if (targetFps === 30 || targetFps === 60 || targetFps === 120) {
    base.targetFps = targetFps;
  }

  const packMode = raw.packMode;
  if (packMode === 'BUILTIN' || packMode === 'CUSTOM_PACK') {
    base.packMode = packMode;
  }

  const showTouch = raw.showTouchControls;
  if (showTouch === 'auto' || showTouch === 'always' || showTouch === 'off') {
    base.showTouchControls = showTouch;
  }

  base.classicSnap60Hz = sanitizeBool(raw.classicSnap60Hz, base.classicSnap60Hz);
  base.screenShake = sanitizeBool(raw.screenShake, base.screenShake);
  base.hitFlash = sanitizeBool(raw.hitFlash, base.hitFlash);
  base.showDamageNumbers = sanitizeBool(raw.showDamageNumbers, base.showDamageNumbers);
  base.showFps = sanitizeBool(raw.showFps, base.showFps);
  base.masterVolume = sanitizeFloat(raw.masterVolume, base.masterVolume, 0, 1);
  base.musicVolume = sanitizeFloat(raw.musicVolume, base.musicVolume, 0, 1);
  base.sfxVolume = sanitizeFloat(raw.sfxVolume, base.sfxVolume, 0, 1);
  base.muted = sanitizeBool(raw.muted, base.muted);

  return base;
}

/**
 * Pure, DOM-free validator and migrator. Never throws on malformed or corrupt inputs.
 */
export function validateAndMigrateSave(raw: unknown): MetaSaveState {
  const defaults = createDefaultMetaSave();

  let input: unknown = raw;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      return defaults;
    }
  }

  if (!isRecord(input)) {
    return defaults;
  }

  // Currencies & lifetime counters
  const darkness = sanitizeInt(input.darkness, defaults.darkness, 0, 9_999_999);
  const gemstones = sanitizeInt(input.gemstones, defaults.gemstones, 0, 9_999_999);
  const keys = sanitizeInt(input.keys, defaults.keys, 0, 99_999);
  const nectar = sanitizeInt(input.nectar, defaults.nectar, 0, 99_999);
  const titanBlood = sanitizeInt(input.titanBlood, defaults.titanBlood, 0, 99_999);
  const diamonds = sanitizeInt(input.diamonds, defaults.diamonds, 0, 99_999);
  const ambrosia = sanitizeInt(input.ambrosia, defaults.ambrosia, 0, 99_999);

  const totalRuns = sanitizeInt(input.totalRuns, defaults.totalRuns, 0, 9_999_999);
  const totalClears = sanitizeInt(input.totalClears, defaults.totalClears, 0, 9_999_999);
  const totalDeaths = sanitizeInt(input.totalDeaths, defaults.totalDeaths, 0, 9_999_999);
  const bestClearTimeSeconds =
    typeof input.bestClearTimeSeconds === 'number' &&
    Number.isFinite(input.bestClearTimeSeconds) &&
    input.bestClearTimeSeconds > 0 &&
    input.bestClearTimeSeconds < 86_400 * 7
      ? input.bestClearTimeSeconds
      : null;
  const highestHeatCleared = sanitizeInt(input.highestHeatCleared, defaults.highestHeatCleared, 0, 64);

  const godModeEnabled = sanitizeBool(input.godModeEnabled, defaults.godModeEnabled);
  const godModeDeaths = sanitizeInt(
    input.godModeDeaths,
    defaults.godModeDeaths,
    0,
    PLAYER_CONSTANTS.godModeMaxDeaths
  );

  // Weapons & Aspects
  const unlockedWeaponsSet = new Set<WeaponId>(['stygian_blade']);
  if (Array.isArray(input.unlockedWeapons)) {
    for (const entry of input.unlockedWeapons) {
      if (typeof entry === 'string' && VALID_WEAPONS.has(entry as WeaponId)) {
        unlockedWeaponsSet.add(entry as WeaponId);
      }
    }
  } else {
    for (const w of defaults.unlockedWeapons) {
      unlockedWeaponsSet.add(w);
    }
  }
  const unlockedWeapons = Array.from(unlockedWeaponsSet);

  let selectedWeapon: WeaponId = defaults.selectedWeapon;
  if (typeof input.selectedWeapon === 'string' && VALID_WEAPONS.has(input.selectedWeapon as WeaponId)) {
    selectedWeapon = input.selectedWeapon as WeaponId;
    if (!unlockedWeaponsSet.has(selectedWeapon)) {
      unlockedWeapons.push(selectedWeapon);
    }
  }

  const selectedAspects = getDefaultSelectedAspects();
  if (isRecord(input.selectedAspects)) {
    for (const weaponId of VALID_WEAPONS) {
      const candidate = input.selectedAspects[weaponId];
      if (
        typeof candidate === 'string' &&
        VALID_ASPECTS.has(candidate as AspectId) &&
        ASPECT_DEFS[candidate as AspectId].weaponId === weaponId
      ) {
        selectedAspects[weaponId] = candidate as AspectId;
      }
    }
  }

  const aspectRanks: Partial<Record<AspectId, number>> = { ...defaults.aspectRanks };
  if (isRecord(input.aspectRanks)) {
    for (const [key, val] of Object.entries(input.aspectRanks)) {
      if (VALID_ASPECTS.has(key as AspectId)) {
        const aspectId = key as AspectId;
        const maxRank = ASPECT_DEFS[aspectId].maxRank;
        aspectRanks[aspectId] = sanitizeInt(val, 1, 0, maxRank);
      }
    }
  }

  // Keepsakes
  const unlockedKeepsakesSet = new Set<KeepsakeId>();
  if (Array.isArray(input.unlockedKeepsakes)) {
    for (const entry of input.unlockedKeepsakes) {
      if (typeof entry === 'string' && VALID_KEEPSAKE_IDS.has(entry as KeepsakeId)) {
        unlockedKeepsakesSet.add(entry as KeepsakeId);
      }
    }
  } else {
    for (const k of defaults.unlockedKeepsakes) {
      unlockedKeepsakesSet.add(k);
    }
  }

  let selectedKeepsake: KeepsakeId | null = defaults.selectedKeepsake;
  if (input.selectedKeepsake === null) {
    selectedKeepsake = null;
  } else if (
    typeof input.selectedKeepsake === 'string' &&
    VALID_KEEPSAKE_IDS.has(input.selectedKeepsake as KeepsakeId)
  ) {
    selectedKeepsake = input.selectedKeepsake as KeepsakeId;
    unlockedKeepsakesSet.add(selectedKeepsake);
  }
  const unlockedKeepsakes = Array.from(unlockedKeepsakesSet);

  const keepsakeRanks: Partial<Record<KeepsakeId, number>> = { ...defaults.keepsakeRanks };
  if (isRecord(input.keepsakeRanks)) {
    for (const [key, val] of Object.entries(input.keepsakeRanks)) {
      if (VALID_KEEPSAKE_IDS.has(key as KeepsakeId)) {
        keepsakeRanks[key as KeepsakeId] = sanitizeInt(val, 1, 1, 3);
      }
    }
  }

  // Mirror of Night (12 pairs)
  const mirrorActiveSide = getDefaultMirrorSides();
  if (isRecord(input.mirrorActiveSide)) {
    for (const id of VALID_MIRROR_IDS) {
      const side = input.mirrorActiveSide[id];
      if (side === 'a' || side === 'b') {
        mirrorActiveSide[id] = side;
      }
    }
  }

  const mirrorRanks = getDefaultMirrorRanks();
  if (isRecord(input.mirrorRanks)) {
    for (const id of VALID_MIRROR_IDS) {
      const def = MIRROR_UPGRADES[id];
      const maxRank = mirrorActiveSide[id] === 'b' ? def.sideB.maxRank : def.sideA.maxRank;
      mirrorRanks[id] = sanitizeInt(input.mirrorRanks[id], mirrorRanks[id], 0, maxRank);
    }
  }

  // Shrine Vows (16 vows)
  const shrineVows: Partial<Record<ShrineVowId, number>> = {};
  if (isRecord(input.shrineVows)) {
    for (const id of VALID_VOW_IDS) {
      const rawRank = input.shrineVows[id];
      if (rawRank !== undefined) {
        const rank = sanitizeInt(rawRank, 0, 0, SHRINE_VOWS[id].maxRank);
        if (rank > 0) {
          shrineVows[id] = rank;
        }
      }
    }
  }

  // Codex
  const codexKills: Partial<Record<EnemyArchetypeId, number>> = {};
  if (isRecord(input.codexKills)) {
    for (const [key, val] of Object.entries(input.codexKills)) {
      if (VALID_ENEMY_ARCHETYPES.has(key as EnemyArchetypeId)) {
        const count = sanitizeInt(val, 0, 0, 9_999_999);
        if (count > 0) {
          codexKills[key as EnemyArchetypeId] = count;
        }
      }
    }
  }

  const codexBoonsSeenSet = new Set<string>();
  if (Array.isArray(input.codexBoonsSeen)) {
    for (const item of input.codexBoonsSeen) {
      if (typeof item === 'string' && item.length > 0 && item.length <= 96 && codexBoonsSeenSet.size < 512) {
        codexBoonsSeenSet.add(item);
      }
    }
  }

  return {
    version: SAVE_SCHEMA_VERSION,
    darkness,
    gemstones,
    keys,
    nectar,
    titanBlood,
    diamonds,
    ambrosia,
    totalRuns,
    totalClears,
    totalDeaths,
    bestClearTimeSeconds,
    highestHeatCleared,
    godModeEnabled,
    godModeDeaths,
    selectedWeapon,
    selectedAspects,
    unlockedWeapons,
    aspectRanks,
    selectedKeepsake,
    unlockedKeepsakes,
    keepsakeRanks,
    mirrorRanks,
    mirrorActiveSide,
    shrineVows,
    codexKills,
    codexBoonsSeen: Array.from(codexBoonsSeenSet),
    settings: sanitizeSettings(input.settings),
  };
}

interface StorageLike {
  getItem?(key: string): string | null;
  setItem?(key: string, value: string): void;
  removeItem?(key: string): void;
}

function resolveBrowserStorage(): StorageLike | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      const storage = (globalThis as unknown as { localStorage?: StorageLike }).localStorage;
      if (storage && typeof storage.getItem === 'function') {
        return storage;
      }
    }
  } catch {
    // Ignore SecurityError in sandboxed iframes or restricted contexts
  }
  return null;
}

export function loadSave(storage?: StorageLike | null): MetaSaveState {
  const target = storage === undefined ? resolveBrowserStorage() : storage;
  if (!target || typeof target.getItem !== 'function') {
    return createDefaultMetaSave();
  }
  try {
    const raw = target.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      return createDefaultMetaSave();
    }
    return validateAndMigrateSave(raw);
  } catch {
    return createDefaultMetaSave();
  }
}

export function writeSave(meta: MetaSaveState, storage?: StorageLike | null): boolean {
  const target = storage === undefined ? resolveBrowserStorage() : storage;
  if (!target || typeof target.setItem !== 'function') {
    return false;
  }
  try {
    const clean = validateAndMigrateSave(meta);
    target.setItem(SAVE_STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

export function resetSave(storage?: StorageLike | null): MetaSaveState {
  const fresh = createDefaultMetaSave();
  const target = storage === undefined ? resolveBrowserStorage() : storage;
  if (target) {
    try {
      if (typeof target.removeItem === 'function') {
        target.removeItem(SAVE_STORAGE_KEY);
      }
      if (typeof target.setItem === 'function') {
        target.setItem(SAVE_STORAGE_KEY, JSON.stringify(fresh));
      }
    } catch {
      // Ignore restricted storage errors
    }
  }
  return fresh;
}
