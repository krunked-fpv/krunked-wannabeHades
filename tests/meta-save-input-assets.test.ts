import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RENDER_SETTINGS,
  EMPTY_INPUT_FRAME,
  KEEPSAKES,
  MIRROR_UPGRADES,
  PLAYER_CONSTANTS,
  SHRINE_VOWS,
  WEAPON_CONSTANTS,
  type KeepsakeId,
  type MetaSaveState,
  type PatronId,
} from '../src/contracts/index.js';
import {
  SAVE_SCHEMA_VERSION,
  SAVE_STORAGE_KEY,
  createDefaultMetaSave as createSaveManagerDefault,
  loadSave,
  resetSave,
  validateAndMigrateSave,
  writeSave,
} from '../src/app/SaveManager.js';
import {
  AssetRegistry,
  CUSTOM_PACK_SCHEMA_VERSION,
  createAssetRegistry,
  getRecommendedCustomPackKeys,
  verifyCustomPackManifest,
  type CustomPackHandle,
  type CustomPackManifest,
} from '../src/assets/AssetRegistry.js';
import {
  ATLAS_SIZE,
  ATLAS_SPRITE_RECTS,
  getBuiltinAssetIds,
} from '../src/assets/ProceduralInkCelAtlas.js';
import { getPortraitAssetIds } from '../src/assets/ProceduralPortraits.js';
import {
  MUSIC_TRACK_IDS,
  MUSIC_TRACK_MANIFEST,
  SFX_IDS,
  SFX_MANIFEST,
  getBuiltinAudioIds,
} from '../src/audio/soundManifest.js';
import { KEEPSAKE_ORDER, getKeepsakeValue } from '../src/data/keepsakes.js';
import {
  MIRROR_UPGRADE_ORDER,
  SHRINE_VOW_ORDER,
  getMirrorUpgradeCost,
  getShrineVowHeat,
} from '../src/data/meta.js';
import { GamepadAdapter } from '../src/input/GamepadAdapter.js';
import { generateBoonOffer } from '../src/sim/boons.js';
import { dealDamageToEnemy, dealDamageToPlayer } from '../src/sim/combat.js';
import { spawnEnemy } from '../src/sim/enemies.js';
import {
  applyMetaToPlayer,
  computeHeat,
  createDefaultMetaSave,
  getEffectiveMirrorUpgrade,
  getHealingMultiplier,
  getShopPriceMultiplier,
  getWellBonusEncounters,
  isMirrorRowDisabled,
  purchaseMirrorUpgrade,
  refundMirrorUpgrades,
  selectKeepsake,
  setShrineVowRank,
  toggleMirrorSide,
  upgradeKeepsakeRank,
} from '../src/sim/meta.js';
import { createGameplayHooks, warpToBoss } from '../src/sim/rooms.js';
import { createDefaultSimState, stepSim } from '../src/sim/step.js';

describe('Mirror of Dusk (12 Pairs) — Toggle, Purchase, Refund & Routine Inspection', () => {
  it('supports A/B toggle, purchase cost deduction, maxRank cap, and exact refund across all 12 pairs', () => {
    expect(MIRROR_UPGRADE_ORDER).toHaveLength(12);
    const meta = createDefaultMetaSave();
    // Start clean from 0 ranks and generous darkness
    refundMirrorUpgrades(meta);
    meta.darkness = 100_000;

    let totalExpectedSpent = 0;
    for (const id of MIRROR_UPGRADE_ORDER) {
      expect(MIRROR_UPGRADES[id]).toBeDefined();
      expect(meta.mirrorRanks[id]).toBe(0);

      // Purchase 1 rank on active starter side (note: fated_authority defaults to 'b')
      const startSide = meta.mirrorActiveSide[id];
      const otherSide = startSide === 'a' ? 'b' : 'a';
      const cost = getMirrorUpgradeCost(id, startSide, 0);
      expect(cost).toBeGreaterThan(0);
      expect(purchaseMirrorUpgrade(meta, id)).toBe(true);
      expect(meta.mirrorRanks[id]).toBe(1);
      totalExpectedSpent += cost;

      // Toggle to alternate side and back to starter side
      expect(toggleMirrorSide(meta, id)).toBe(otherSide);
      expect(meta.mirrorActiveSide[id]).toBe(otherSide);
      expect(toggleMirrorSide(meta, id)).toBe(startSide);
      expect(meta.mirrorActiveSide[id]).toBe(startSide);
    }

    expect(meta.darkness).toBe(100_000 - totalExpectedSpent);

    // Refund returns exact darkness spent and zeroes all 12 ranks
    const refunded = refundMirrorUpgrades(meta);
    expect(refunded).toBe(totalExpectedSpent);
    expect(meta.darkness).toBe(100_000);
    for (const id of MIRROR_UPGRADE_ORDER) {
      expect(meta.mirrorRanks[id]).toBe(0);
    }

    // Purchase rejected when darkness insufficient
    meta.darkness = 5;
    expect(purchaseMirrorUpgrade(meta, 'shadow_presence')).toBe(false);
    expect(meta.mirrorRanks.shadow_presence).toBe(0);

    // Toggling side clamps rank if Side A maxRank > Side B maxRank (e.g. death_defiance 3 -> 1)
    meta.darkness = 50_000;
    meta.mirrorActiveSide.death_defiance = 'a';
    expect(purchaseMirrorUpgrade(meta, 'death_defiance')).toBe(true);
    expect(purchaseMirrorUpgrade(meta, 'death_defiance')).toBe(true);
    expect(purchaseMirrorUpgrade(meta, 'death_defiance')).toBe(true);
    expect(meta.mirrorRanks.death_defiance).toBe(3);
    expect(purchaseMirrorUpgrade(meta, 'death_defiance')).toBe(false); // capped at maxRank 3
    toggleMirrorSide(meta, 'death_defiance');
    expect(meta.mirrorRanks.death_defiance).toBe(1); // clamped to side B maxRank 1
  });

  it('Routine Inspection disables bottom 3 / 6 / 9 / 12 Mirror rows cleanly', () => {
    const meta = createDefaultMetaSave();
    for (const id of MIRROR_UPGRADE_ORDER) {
      meta.mirrorRanks[id] = 1;
    }

    // Rank 0: all 12 rows active
    for (let row = 1; row <= 12; row++) {
      expect(isMirrorRowDisabled(row, {})).toBe(false);
    }

    // Rank 1: disables rows 10..12
    expect(isMirrorRowDisabled(9, { routine_inspection: 1 })).toBe(false);
    expect(isMirrorRowDisabled(10, { routine_inspection: 1 })).toBe(true);
    expect(getEffectiveMirrorUpgrade(meta, { routine_inspection: 1 }, 'fated_authority')).toMatchObject({
      rank: 0,
      value: 0,
      disabled: true,
    });

    // Rank 2: disables rows 7..12
    expect(isMirrorRowDisabled(6, { routine_inspection: 2 })).toBe(false);
    expect(isMirrorRowDisabled(7, { routine_inspection: 2 })).toBe(true);
    expect(getEffectiveMirrorUpgrade(meta, { routine_inspection: 2 }, 'thick_skin').disabled).toBe(true);

    // Rank 3: disables rows 4..12
    expect(isMirrorRowDisabled(3, { routine_inspection: 3 })).toBe(false);
    expect(isMirrorRowDisabled(4, { routine_inspection: 3 })).toBe(true);

    // Rank 4: disables ALL 12 rows
    for (const id of MIRROR_UPGRADE_ORDER) {
      expect(getEffectiveMirrorUpgrade(meta, { routine_inspection: 4 }, id).disabled).toBe(true);
    }
  });
});

describe('Shrine of Torment (16 Vows) — computeHeat, Tight Deadline & EM1-4', () => {
  it('computes exact Heat across all 16 vows and clamps ranks cleanly', () => {
    expect(SHRINE_VOW_ORDER).toHaveLength(16);
    const meta = createDefaultMetaSave();
    meta.shrineVows = {};

    let expectedTotalHeat = 0;
    for (const vowId of SHRINE_VOW_ORDER) {
      const def = SHRINE_VOWS[vowId];
      const maxHeat = def.heatPerRank.reduce((acc, n) => acc + n, 0);
      expect(getShrineVowHeat(vowId, def.maxRank)).toBe(maxHeat);

      // Over-max rank clamps cleanly to def.maxRank
      const newHeat = setShrineVowRank(meta, vowId, def.maxRank + 10);
      expectedTotalHeat += maxHeat;
      expect(meta.shrineVows[vowId]).toBe(def.maxRank);
      expect(newHeat).toBe(expectedTotalHeat);
    }
    expect(computeHeat(meta.shrineVows)).toBe(expectedTotalHeat);
    expect(expectedTotalHeat).toBeGreaterThan(50);

    // Setting rank to 0 deletes vow cleanly
    setShrineVowRank(meta, 'hard_labor', 0);
    expect(meta.shrineVows.hard_labor).toBeUndefined();
    expect(computeHeat(meta.shrineVows)).toBe(expectedTotalHeat - 5);
  });

  it('wires Tight Deadline (9m / 7m / 5m) and Extreme Measures (EM1-4) into simulation', () => {
    const expectedDeadlines: Array<[number, number]> = [
      [1, 540], // 9m
      [2, 420], // 7m
      [3, 300], // 5m
    ];
    for (const [rank, seconds] of expectedDeadlines) {
      const meta = createDefaultMetaSave();
      setShrineVowRank(meta, 'tight_deadline', rank);
      const state = createDefaultSimState(101, meta);
      applyMetaToPlayer(state, { resetVitals: true });
      expect(state.run.tightDeadlineTimer).toBe(seconds);
    }

    // Tight Deadline expiry deals 5 damage every 60 ticks in active combat
    const tdMeta = createDefaultMetaSave();
    setShrineVowRank(tdMeta, 'tight_deadline', 3);
    const tdState = createDefaultSimState(102, tdMeta);
    applyMetaToPlayer(tdState, { resetVitals: true });
    tdState.room.combatStarted = true;
    tdState.room.cleared = false;
    spawnEnemy(tdState, 'wretched_husk', { x: 400, y: 0 });
    tdState.run.tightDeadlineTimer = 0.01;
    const hpBefore = tdState.player.hp;
    for (let i = 0; i < 65; i++) {
      stepSim(tdState, { ...EMPTY_INPUT_FRAME, tick: i });
    }
    expect(tdState.player.hp).toBeLessThan(hpBefore);

    // EM1-4 heat progression [1, 2, 3, 4] -> cumulative 1, 3, 6, 10
    expect(getShrineVowHeat('extreme_measures', 1)).toBe(1);
    expect(getShrineVowHeat('extreme_measures', 2)).toBe(3);
    expect(getShrineVowHeat('extreme_measures', 3)).toBe(6);
    expect(getShrineVowHeat('extreme_measures', 4)).toBe(10);

    // Additional vow multipliers
    expect(getHealingMultiplier({ lasting_consequences: 2 })).toBeCloseTo(0.5, 4);
    expect(getShopPriceMultiplier({ convenience_fee: 2 }, false)).toBeCloseTo(1.8, 4);
    expect(getShopPriceMultiplier({ convenience_fee: 0 }, true)).toBeCloseTo(0.8, 4);

    // Damage Control shields absorb first N non-status hits
    const dcMeta = createDefaultMetaSave();
    setShrineVowRank(dcMeta, 'damage_control', 2);
    const dcState = createDefaultSimState(103, dcMeta);
    applyMetaToPlayer(dcState, { resetVitals: true });
    const shielded = spawnEnemy(dcState, 'numbskull', { x: 150, y: 0 });
    shielded.invulnerable = false;
    shielded.invulnTimer = 0;
    expect(shielded.damageControlHits).toBe(2);
    expect(dealDamageToEnemy(dcState, shielded, { baseDamage: 50, source: 'attack' })).toBe(0);
    expect(dealDamageToEnemy(dcState, shielded, { baseDamage: 50, source: 'attack' })).toBe(0);
    expect(dealDamageToEnemy(dcState, shielded, { baseDamage: 50, source: 'attack' })).toBeGreaterThan(0);
  });
});

describe('All 16 Keepsakes — Selection, Ranks 1-3 & Gameplay Effects', () => {
  it('supports all 16 Keepsakes with monotonically scaling ranks 1..3', () => {
    expect(KEEPSAKE_ORDER).toHaveLength(16);
    const meta = createDefaultMetaSave();

    for (const id of KEEPSAKE_ORDER) {
      expect(KEEPSAKES[id]).toBeDefined();
      selectKeepsake(meta, id);
      expect(meta.selectedKeepsake).toBe(id);

      const v1 = getKeepsakeValue(id, 1);
      const v2 = getKeepsakeValue(id, 2);
      const v3 = getKeepsakeValue(id, 3);
      expect(v2).toBeGreaterThan(v1);
      expect(v3).toBeGreaterThan(v2);

      meta.keepsakeRanks[id] = 1;
      expect(upgradeKeepsakeRank(meta, id)).toBe(2);
      expect(upgradeKeepsakeRank(meta, id)).toBe(3);
      expect(upgradeKeepsakeRank(meta, id)).toBe(3); // clamped at 3
    }
  });

  it('activates runtime effects for utility/combat keepsakes and all 8 patron-forcing keepsakes', () => {
    // old_collar (+50 Max HP at rank 3)
    const collarMeta = createDefaultMetaSave();
    collarMeta.mirrorRanks.thick_skin = 0;
    selectKeepsake(collarMeta, 'old_collar');
    collarMeta.keepsakeRanks.old_collar = 3;
    const collarState = createDefaultSimState(201, collarMeta);
    applyMetaToPlayer(collarState, { resetVitals: true });
    expect(collarState.player.maxHp).toBe(PLAYER_CONSTANTS.baseMaxHealth + 50);

    // coin_pouch (+150 Gold at rank 3)
    const pouchMeta = createDefaultMetaSave();
    pouchMeta.mirrorRanks.deep_pockets = 0;
    selectKeepsake(pouchMeta, 'coin_pouch');
    pouchMeta.keepsakeRanks.coin_pouch = 3;
    const pouchState = createDefaultSimState(202, pouchMeta);
    applyMetaToPlayer(pouchState, { resetVitals: true });
    expect(pouchState.player.gold).toBe(150);

    // bone_sandglass (+8 Well encounters at rank 3)
    const glassMeta = createDefaultMetaSave();
    selectKeepsake(glassMeta, 'bone_sandglass');
    glassMeta.keepsakeRanks.bone_sandglass = 3;
    const glassState = createDefaultSimState(203, glassMeta);
    applyMetaToPlayer(glassState, { resetVitals: true });
    expect(getWellBonusEncounters(glassState)).toBe(8);

    // evergreen_acorn (5 boss hit shields at rank 3)
    const acornMeta = createDefaultMetaSave();
    selectKeepsake(acornMeta, 'evergreen_acorn');
    acornMeta.keepsakeRanks.evergreen_acorn = 3;
    const acornState = createDefaultSimState(204, acornMeta);
    applyMetaToPlayer(acornState, { resetVitals: true });
    warpToBoss(acornState, 'warden_malice');
    expect(acornState.player.acornShields).toBe(5);
    expect(dealDamageToPlayer(acornState, 25, { source: 'enemy' })).toBe(0);
    expect(acornState.player.acornShields).toBe(4);

    // shattered_shackle (+100% unbooned attack dmg at rank 3)
    const shackleMeta = createDefaultMetaSave();
    selectKeepsake(shackleMeta, 'shattered_shackle');
    shackleMeta.keepsakeRanks.shattered_shackle = 3;
    const shackleState = createDefaultSimState(205, shackleMeta);
    applyMetaToPlayer(shackleState, { resetVitals: true });
    const shEnemy = spawnEnemy(shackleState, 'wretched_husk', { x: 150, y: 0 });
    shEnemy.invulnerable = false;
    shEnemy.invulnTimer = 0;
    shEnemy.facingAngle = Math.PI;
    expect(
      dealDamageToEnemy(shackleState, shEnemy, { baseDamage: 100, source: 'attack', angle: 0, canCrit: false })
    ).toBe(200);

    // obsidian_shawl (+20% vs undamaged at rank 3)
    const shawlMeta = createDefaultMetaSave();
    shawlMeta.mirrorActiveSide.shadow_presence = 'a';
    selectKeepsake(shawlMeta, 'obsidian_shawl');
    shawlMeta.keepsakeRanks.obsidian_shawl = 3;
    const shawlState = createDefaultSimState(206, shawlMeta);
    applyMetaToPlayer(shawlState, { resetVitals: true });
    const swEnemy = spawnEnemy(shawlState, 'wretched_husk', { x: 150, y: 0 });
    swEnemy.invulnerable = false;
    swEnemy.invulnTimer = 0;
    swEnemy.facingAngle = Math.PI;
    expect(
      dealDamageToEnemy(shawlState, swEnemy, { baseDamage: 100, source: 'attack', angle: 0, canCrit: false })
    ).toBe(120);

    // lucky_fang (revives with 100 HP at rank 3 when 0 death defiances remain)
    const fangMeta = createDefaultMetaSave();
    fangMeta.mirrorRanks.death_defiance = 0;
    fangMeta.mirrorRanks.thick_skin = 10;
    selectKeepsake(fangMeta, 'lucky_fang');
    fangMeta.keepsakeRanks.lucky_fang = 3;
    const fangState = createDefaultSimState(207, fangMeta);
    fangState.player.deathDefiances = 0;
    fangState.player.hp = 10;
    dealDamageToPlayer(fangState, 50, { source: 'enemy', ignoreIframes: true });
    expect(fangState.player.isDead).toBe(false);
    expect(fangState.player.hp).toBe(100);
    expect(fangState.player.keepsakeUsed).toBe(true);

    // pierced_plume (fast room clear <= 28s grants plumeBonus)
    const plumeMeta = createDefaultMetaSave();
    selectKeepsake(plumeMeta, 'pierced_plume');
    plumeMeta.keepsakeRanks.pierced_plume = 3;
    const plumeState = createDefaultSimState(208, plumeMeta);
    const plumeHooks = createGameplayHooks();
    applyMetaToPlayer(plumeState, { resetVitals: true });
    plumeState.room.combatStarted = true;
    plumeState.room.cleared = false;
    plumeState.room.encounterTimer = 10;
    plumeState.room.totalWaves = 1;
    plumeState.enemies = [];
    stepSim(plumeState, { ...EMPTY_INPUT_FRAME }, plumeHooks);
    expect(plumeState.player.plumeBonus).toBeCloseTo(0.012, 5);

    // All 8 Patron-forcing Keepsakes force their exact Patron in generateBoonOffer
    const patronKeepsakes: Array<[KeepsakeId, PatronId]> = [
      ['thunder_signet', 'voltaris'],
      ['conch_shell', 'tidebreaker'],
      ['owl_pendant', 'aegira'],
      ['eternal_rose', 'velouris'],
      ['adamant_arrowhead', 'sylvara'],
      ['blood_vial', 'bellum'],
      ['overflowing_chalice', 'bacchion'],
      ['frostbitten_horn', 'glaciera'],
    ];
    for (const [kId, expectedPatron] of patronKeepsakes) {
      const m = createDefaultMetaSave();
      selectKeepsake(m, kId);
      const s = createDefaultSimState(300, m);
      applyMetaToPlayer(s, { resetVitals: true });
      const offer = generateBoonOffer(s);
      expect(offer.patronId).toBe(expectedPatron);
      expect(s.player.keepsakeUsed).toBe(true);
    }
  });
});

describe('SaveManager — Validation, Corruption Resilience & Round-Trip Persistence', () => {
  it('never throws on malformed JSON, null, primitives, arrays, or garbage payloads', () => {
    const defaults = createSaveManagerDefault();
    const corruptPayloads: unknown[] = [
      null,
      undefined,
      '',
      '   ',
      '{not valid json!!!',
      '42',
      'null',
      '[]',
      12345,
      true,
      ['weird', 'array'],
    ];

    for (const payload of corruptPayloads) {
      const result = validateAndMigrateSave(payload);
      expect(result.version).toBe(SAVE_SCHEMA_VERSION);
      expect(result.selectedWeapon).toBe(defaults.selectedWeapon);
      expect(result.darkness).toBe(defaults.darkness);
      expect(result.settings).toEqual(DEFAULT_RENDER_SETTINGS);
    }
  });

  it('sanitizes out-of-range numbers, NaN/Infinity, invalid weapon/aspect mismatches, and bogus settings', () => {
    const dirty = {
      version: 999,
      darkness: -500,
      gemstones: Number.NaN,
      keys: Infinity,
      titanBlood: 1_000_000,
      godModeDeaths: 9999,
      highestHeatCleared: 200,
      bestClearTimeSeconds: -42,
      selectedWeapon: 'plasma_bazooka',
      selectedAspects: {
        stygian_blade: 'bow_celestial', // mismatch!
        eternal_spear: 'spear_dragon', // valid!
        shield_of_chaos: 'not_an_aspect',
      },
      aspectRanks: {
        spear_dragon: 99,
        bogus_aspect: 5,
      },
      selectedKeepsake: 'fake_keepsake',
      keepsakeRanks: {
        old_collar: 99,
        coin_pouch: -3,
      },
      mirrorActiveSide: {
        death_defiance: 'b',
        thick_skin: 'z',
      },
      mirrorRanks: {
        death_defiance: 5, // exceeds side B maxRank 1!
        thick_skin: -10,
      },
      shrineVows: {
        extreme_measures: 99,
        hard_labor: 0,
        bogus_vow: 3,
      },
      codexKills: {
        sovereign_lord: 4,
        fake_enemy: 100,
      },
      settings: {
        targetFps: 999,
        packMode: 'HACKED',
        masterVolume: 4.5,
        musicVolume: -1,
        sfxVolume: Number.NaN,
        showTouchControls: 'invalid',
      },
    };

    const clean = validateAndMigrateSave(dirty);
    expect(clean.version).toBe(SAVE_SCHEMA_VERSION);
    expect(clean.darkness).toBe(0);
    expect(clean.gemstones).toBe(createSaveManagerDefault().gemstones);
    expect(clean.keys).toBe(createSaveManagerDefault().keys);
    expect(clean.titanBlood).toBe(99_999);
    expect(clean.godModeDeaths).toBe(PLAYER_CONSTANTS.godModeMaxDeaths);
    expect(clean.highestHeatCleared).toBe(64);
    expect(clean.bestClearTimeSeconds).toBeNull();

    // Weapon/aspect validation & mismatch rejection
    expect(clean.selectedWeapon).toBe('stygian_blade');
    expect(clean.selectedAspects.stygian_blade).toBe('blade_scion');
    expect(clean.selectedAspects.eternal_spear).toBe('spear_dragon');
    expect(clean.selectedAspects.shield_of_chaos).toBe('shield_scion');
    expect(clean.aspectRanks.spear_dragon).toBe(5);
    expect((clean.aspectRanks as Record<string, unknown>).bogus_aspect).toBeUndefined();

    // Keepsake / Mirror / Shrine / Codex clamping
    expect(clean.selectedKeepsake).toBe('old_collar');
    expect(clean.keepsakeRanks.old_collar).toBe(3);
    expect(clean.keepsakeRanks.coin_pouch).toBe(1);
    expect(clean.mirrorActiveSide.death_defiance).toBe('b');
    expect(clean.mirrorRanks.death_defiance).toBe(1);
    expect(clean.mirrorActiveSide.thick_skin).toBe('a');
    expect(clean.mirrorRanks.thick_skin).toBe(0);
    expect(clean.shrineVows.extreme_measures).toBe(4);
    expect(clean.shrineVows.hard_labor).toBeUndefined();
    expect((clean.shrineVows as Record<string, unknown>).bogus_vow).toBeUndefined();
    expect(clean.codexKills.sovereign_lord).toBe(4);
    expect((clean.codexKills as Record<string, unknown>).fake_enemy).toBeUndefined();

    // Settings sanitized
    expect(clean.settings.targetFps).toBe(DEFAULT_RENDER_SETTINGS.targetFps);
    expect(clean.settings.packMode).toBe('BUILTIN');
    expect(clean.settings.masterVolume).toBe(1);
    expect(clean.settings.musicVolume).toBe(0);
    expect(clean.settings.sfxVolume).toBe(DEFAULT_RENDER_SETTINGS.sfxVolume);
    expect(clean.settings.showTouchControls).toBe('auto');
  });

  it('performs clean JSON round-trip persistence and handles storage errors gracefully', () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };

    const custom: MetaSaveState = {
      ...createSaveManagerDefault(),
      darkness: 1450,
      titanBlood: 12,
      totalRuns: 7,
      totalClears: 3,
      bestClearTimeSeconds: 982.5,
      highestHeatCleared: 16,
      godModeEnabled: true,
      godModeDeaths: 8,
      selectedWeapon: 'heart_seeking_bow',
      selectedAspects: {
        ...createSaveManagerDefault().selectedAspects,
        heart_seeking_bow: 'bow_celestial',
      },
      selectedKeepsake: 'thunder_signet',
      shrineVows: { extreme_measures: 4, tight_deadline: 2 },
      codexKills: { sovereign_lord: 3 },
      codexBoonsSeen: ['voltaris_attack', 'duo_sea_storm'],
      settings: {
        ...DEFAULT_RENDER_SETTINGS,
        targetFps: 60,
        classicSnap60Hz: true,
        packMode: 'CUSTOM_PACK',
      },
    };

    expect(writeSave(custom, mockStorage)).toBe(true);
    expect(store.has(SAVE_STORAGE_KEY)).toBe(true);

    const loaded = loadSave(mockStorage);
    expect(loaded).toEqual(custom);

    const reset = resetSave(mockStorage);
    expect(reset.darkness).toBe(createSaveManagerDefault().darkness);
    expect(loadSave(mockStorage)).toEqual(reset);

    // Throwing storage never crashes
    const brokenStorage = {
      getItem: () => {
        throw new Error('QuotaExceededError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(writeSave(custom, brokenStorage)).toBe(false);
    expect(loadSave(brokenStorage).version).toBe(SAVE_SCHEMA_VERSION);
  });
});

describe('Input — GamepadAdapter Virtual Injection, Edge Latches & Menu Repeat', () => {
  it('handles virtual gamepad injection, one-shot rising edge latches, and clean disconnect', () => {
    const adapter = new GamepadAdapter();
    expect(adapter.isConnected()).toBe(false);
    expect(adapter.poll(1000).connected).toBe(false);

    adapter.setVirtualGamepad({
      connected: true,
      moveX: 1,
      moveY: 0,
      attack: true,
      attackPressed: true,
      dash: true,
      dashPressed: true,
    });
    expect(adapter.isConnected()).toBe(true);

    const first = adapter.poll(1000);
    expect(first.connected).toBe(true);
    expect(first.active).toBe(true);
    expect(first.moveX).toBe(1);
    expect(first.attack).toBe(true);
    expect(first.attackPressed).toBe(true);
    expect(first.menuNav.confirm).toBe(true); // Xbox A -> Dash / Confirm
    expect(first.menuNav.right).toBe(true);

    // Sustained hold next frame: attack remains held, *Pressed drops to false, repeat waits 380ms
    const second = adapter.poll(1016);
    expect(second.attack).toBe(true);
    expect(second.attackPressed).toBe(false);
    expect(second.menuNav.confirm).toBe(false);
    expect(second.menuNav.right).toBe(false);

    // Past 380ms initial delay: menu repeat fires again
    const repeated = adapter.poll(1400);
    expect(repeated.menuNav.right).toBe(true);

    // Disconnect clears state cleanly
    adapter.setVirtualGamepad({ connected: false });
    expect(adapter.isConnected()).toBe(false);
    expect(adapter.poll(1500).connected).toBe(false);
    adapter.dispose();
  });
});

describe('AssetRegistry Dual-Mode & Pure Node Built-In Manifests', () => {
  it('exports pure Node-safe built-in atlas (>=120), portrait (12), and audio (>=65) manifests with zero overlaps', () => {
    const atlasIds = getBuiltinAssetIds();
    const portraitIds = getPortraitAssetIds();
    const audioIds = getBuiltinAudioIds();

    expect(atlasIds.length).toBeGreaterThanOrEqual(120);
    expect(new Set(atlasIds).size).toBe(atlasIds.length);
    for (const wId of Object.keys(WEAPON_CONSTANTS)) {
      expect(atlasIds).toContain(`weapon_${wId}`);
    }

    // Verify every built-in atlas rect stays strictly within 2048x2048 bounds
    for (const id of atlasIds) {
      const rect = ATLAS_SPRITE_RECTS.get(id);
      expect(rect).toBeDefined();
      expect(rect!.x).toBeGreaterThanOrEqual(0);
      expect(rect!.y).toBeGreaterThanOrEqual(0);
      expect(rect!.w).toBeGreaterThan(0);
      expect(rect!.h).toBeGreaterThan(0);
      expect(rect!.x + rect!.w).toBeLessThanOrEqual(ATLAS_SIZE);
      expect(rect!.y + rect!.h).toBeLessThanOrEqual(ATLAS_SIZE);
    }

    expect(portraitIds).toHaveLength(12);
    expect(new Set(portraitIds).size).toBe(12);
    expect(portraitIds).toContain('portrait_voltaris');
    expect(portraitIds).toContain('portrait_abyssos');
    expect(portraitIds).toContain('portrait_prince_pyreus');
    expect(portraitIds).toContain('portrait_warden_malice');

    expect(audioIds.length).toBeGreaterThanOrEqual(65);
    expect(audioIds.length).toBe(SFX_IDS.length + MUSIC_TRACK_IDS.length);
    expect(new Set(audioIds).size).toBe(audioIds.length);
    for (const sfx of SFX_IDS) {
      expect(SFX_MANIFEST[sfx].maxPolyphony).toBeLessThanOrEqual(4);
    }
    for (const track of MUSIC_TRACK_IDS) {
      expect(MUSIC_TRACK_MANIFEST[track].bpm).toBeGreaterThan(0);
    }
  });

  it('switches BUILTIN <-> CUSTOM_PACK cleanly and falls back gracefully when absent or missing key', () => {
    const registry: AssetRegistry = createAssetRegistry();
    const listener = vi.fn();
    const unsub = registry.onChange(listener);

    // Defaults to BUILTIN with no custom pack attached
    expect(registry.getPackMode()).toBe('BUILTIN');
    expect(registry.hasCustomPack()).toBe(false);
    expect(registry.isCustomPackActive()).toBe(false);
    expect(registry.getCustomSprite('tile_obsidian_a')).toBeNull();
    expect(registry.getManifestSummary().label).toBe('Built-In Ink-Cel Art');

    // Switching to CUSTOM_PACK with no pack attached falls back cleanly to built-in (null sprites)
    registry.setPackMode('CUSTOM_PACK');
    expect(registry.getPackMode()).toBe('CUSTOM_PACK');
    expect(registry.isCustomPackActive()).toBe(false);
    expect(registry.getCustomSprite('tile_obsidian_a')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    // Attach a valid custom pack in memory
    const disposeSpy = vi.fn();
    const manifest: CustomPackManifest = {
      schemaVersion: CUSTOM_PACK_SCHEMA_VERSION,
      source: 'unit-test-pack',
      generatedAt: '2026-11-27T00:00:00.000Z',
      sheets: [{ id: 'sheet_main', file: 'sheets/main.png', width: 512, height: 512 }],
      sprites: {
        tile_obsidian_a: { sheet: 'sheet_main', x: 0, y: 0, w: 256, h: 128 },
        portrait_voltaris: { sheet: 'sheet_main', x: 256, y: 0, w: 128, h: 128 },
        prop_pillar_obsidian: { sheet: 'sheet_main', x: 0, y: 128, w: 64, h: 128 },
      },
    };
    const fakeImage = {} as CanvasImageSource;
    const pack: CustomPackHandle = {
      manifest,
      origin: 'memory',
      sheets: new Map([['sheet_main', fakeImage]]),
      dispose: disposeSpy,
    };

    registry.attachCustomPack(pack);
    expect(registry.hasCustomPack()).toBe(true);
    expect(registry.isCustomPackActive()).toBe(true);

    // Resolves direct clean-room key with accurate UVs
    const tile = registry.getCustomSprite('tile_obsidian_a');
    expect(tile).not.toBeNull();
    expect(tile!.u0).toBe(0);
    expect(tile!.u1).toBe(0.5);
    expect(tile!.v1).toBe(0.25);

    // Resolves portrait shorthand ('voltaris' -> 'portrait_voltaris')
    const portrait = registry.getCustomPortraitSprite('voltaris');
    expect(portrait).not.toBeNull();
    expect(portrait!.cleanId).toBe('portrait_voltaris');

    // Resolves sibling clean fallback alias ('prop_pillar_sanctum' -> 'prop_pillar_obsidian')
    const pillarFallback = registry.getCustomSprite('prop_pillar_sanctum');
    expect(pillarFallback).not.toBeNull();
    expect(pillarFallback!.anchorY).toBe(0.86);

    // Missing sprite key returns null cleanly for graceful built-in fallback!
    expect(registry.getCustomSprite('nonexistent_sprite_key')).toBeNull();
    expect(registry.getCustomSprite('weapon_stygian_blade')).toBeNull();

    // Switching back to BUILTIN immediately hides custom sprites while keeping pack loaded
    registry.setPackMode('BUILTIN');
    expect(registry.isCustomPackActive()).toBe(false);
    expect(registry.hasCustomPack()).toBe(true);
    expect(registry.getCustomSprite('tile_obsidian_a')).toBeNull();
    expect(registry.getCustomSprite('tile_obsidian_a', true)).not.toBeNull();

    // Detaching disposes old pack cleanly
    registry.detachCustomPack();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(registry.hasCustomPack()).toBe(false);
    unsub();
  });

  it('verifyCustomPackManifest validates good manifests and rejects malformed/out-of-bounds manifests', () => {
    expect(getRecommendedCustomPackKeys().length).toBeGreaterThan(40);

    const validResult = verifyCustomPackManifest({
      schemaVersion: 1,
      source: 'clean-test',
      generatedAt: '2026-11-27T00:00:00Z',
      sheets: [{ id: 's0', file: 's0.png', width: 256, height: 256 }],
      sprites: {
        tile_obsidian_a: { sheet: 's0', x: 0, y: 0, w: 128, h: 64 },
      },
    });
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);
    expect(validResult.matchedCleanKeys).toEqual(['tile_obsidian_a']);

    // Invalid cases: non-object, wrong schemaVersion, path traversal, out-of-bounds rect, unknown sheet
    expect(verifyCustomPackManifest(null).valid).toBe(false);
    const badResult = verifyCustomPackManifest({
      schemaVersion: 2,
      source: '',
      sheets: [{ id: 's0', file: '../evil.png', width: 64, height: 64 }],
      sprites: {
        oob: { sheet: 's0', x: 50, y: 0, w: 32, h: 32 },
        ghost: { sheet: 'missing_sheet', x: 0, y: 0, w: 16, h: 16 },
      },
    });
    expect(badResult.valid).toBe(false);
    expect(badResult.errors.length).toBeGreaterThanOrEqual(4);
  });
});
