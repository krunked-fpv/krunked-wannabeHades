/**
 * Gate A — Asset Completeness, Custom Pack Validation, Mechanic Oracle Parity & IP Hygiene
 * Tracked in git & executed by CI via `npm run verify:assets`.
 *
 * 100% pure Node (zero browser/DOM required). Gracefully skips optional local-only
 * `.wannabehades-assets/` checks when absent (e.g. GitHub Actions CI).
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  ASPECT_DEFS,
  BIOME_CONSTANTS,
  BOSS_CONSTANTS,
  COMBAT_CONSTANTS,
  HAMMER_DEFS,
  KEEPSAKES,
  MIRROR_UPGRADES,
  PATRON_CONSTANTS,
  PLAYER_CONSTANTS,
  SHRINE_VOWS,
  SIM_CONSTANTS,
  WEAPON_CONSTANTS,
  type BiomeId,
  type BossId,
} from '../../src/contracts/index.js';
import { getBuiltinAssetIds } from '../../src/assets/ProceduralInkCelAtlas.js';
import { getPortraitAssetIds } from '../../src/assets/ProceduralPortraits.js';
import { verifyCustomPackManifest } from '../../src/assets/AssetRegistry.js';
import { getBuiltinAudioIds } from '../../src/audio/soundManifest.js';
import { getAllDuoBoons } from '../../src/data/boons.js';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, '.wannabehades-assets');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const FORBIDDEN_RETAIL_NAMES = [
  'Zagreus',
  'Megaera',
  'Alecto',
  'Tisiphone',
  'Theseus',
  'Asterius',
  'Achilles',
  'Patroclus',
  'Skelly',
  'Nyx',
  'Hypnos',
  'Charon',
  'Cerberus',
  'Persephone',
  'Supergiant',
] as const;

const FORBIDDEN_BINARY_EXTS = ['.pkg', '.bank', '.bink', '.xnb'] as const;

interface CheckEntry {
  name: string;
  pass: boolean;
  detail: string;
}

const results: CheckEntry[] = [];

function check(name: string, pass: boolean, detail: string): void {
  results.push({ name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}: ${detail}`);
}

function listFilesRecursive(dir: string, exts?: readonly string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full, exts));
    } else if (!exts || exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function stripTsComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function approxEq(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

// ============================================================================
// 1. Built-In Asset, Portrait & Audio Completeness (Pure Node)
// ============================================================================

const atlasIds = getBuiltinAssetIds();
const atlasUnique = new Set(atlasIds);
check(
  'builtin-atlas-sprites',
  atlasIds.length >= 120 && atlasUnique.size === atlasIds.length && atlasIds.every((id) => id.trim().length > 0),
  `count=${atlasIds.length} (unique=${atlasUnique.size}, min=120)`
);

const portraitIds = getPortraitAssetIds();
const portraitUnique = new Set(portraitIds);
check(
  'builtin-portraits',
  portraitIds.length === 12 && portraitUnique.size === 12,
  `count=${portraitIds.length} (expected=12)`
);

const audioIds = getBuiltinAudioIds();
const audioUnique = new Set(audioIds);
check(
  'builtin-audio-manifest',
  audioIds.length >= 65 && audioUnique.size === audioIds.length,
  `count=${audioIds.length} (unique=${audioUnique.size}, min=65)`
);

// ============================================================================
// 2. Optional Local Custom Pack Validation (.wannabehades-assets/manifest.json)
// ============================================================================

const manifestPath = path.join(ASSETS_DIR, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const verification = verifyCustomPackManifest(raw);
    const badSheets: string[] = [];

    if (Array.isArray(raw.sheets)) {
      for (const sheet of raw.sheets as { id?: string; file?: string }[]) {
        const rel = typeof sheet.file === 'string' ? sheet.file : '';
        const full = path.join(ASSETS_DIR, rel);
        if (!fs.existsSync(full)) {
          badSheets.push(`missing:${rel}`);
          continue;
        }
        const fd = fs.openSync(full, 'r');
        const header = Buffer.alloc(8);
        try {
          const bytes = fs.readSync(fd, header, 0, 8, 0);
          if (bytes < 8 || !header.equals(PNG_MAGIC)) {
            badSheets.push(`bad-png-magic:${rel}`);
          }
        } finally {
          fs.closeSync(fd);
        }
      }
    }

    check(
      'custom-pack-manifest-and-pngs',
      verification.valid && verification.errors.length === 0 && badSheets.length === 0 && verification.sheetCount > 0,
      `valid=${verification.valid}, sheets=${verification.sheetCount}, sprites=${verification.spriteCount}, matchedClean=${verification.matchedCleanKeys.length}, badSheets=[${badSheets.join(', ')}], errors=[${verification.errors.join('; ')}]`
    );
  } catch (err) {
    check('custom-pack-manifest-and-pngs', false, `parse error: ${String(err)}`);
  }
} else {
  check(
    'custom-pack-manifest-and-pngs',
    true,
    'SKIPPED cleanly (.wannabehades-assets/manifest.json absent — CI built-in mode)'
  );
}

// ============================================================================
// 3. Unconditional Core Contract Counts & Optional Mechanic Oracle Parity
// ============================================================================

const duoBoons = getAllDuoBoons();
const contractCountsOk =
  Object.keys(WEAPON_CONSTANTS).length === 6 &&
  Object.keys(ASPECT_DEFS).length === 24 &&
  Object.keys(HAMMER_DEFS).length === 36 &&
  Object.keys(PATRON_CONSTANTS).length === 10 &&
  duoBoons.length === 14 &&
  Object.keys(MIRROR_UPGRADES).length === 12 &&
  Object.keys(SHRINE_VOWS).length === 16 &&
  Object.keys(KEEPSAKES).length === 16 &&
  Object.keys(BOSS_CONSTANTS).length === 8 &&
  Object.keys(BIOME_CONSTANTS).length === 6 &&
  Object.keys(COMBAT_CONSTANTS.statusDefaults).length === 10;

check(
  'core-contract-counts',
  contractCountsOk,
  `arms=${Object.keys(WEAPON_CONSTANTS).length}/6, aspects=${Object.keys(ASPECT_DEFS).length}/24, hammers=${Object.keys(HAMMER_DEFS).length}/36, patrons=${Object.keys(PATRON_CONSTANTS).length}/10, duos=${duoBoons.length}/14, mirror=${Object.keys(MIRROR_UPGRADES).length}/12, shrine=${Object.keys(SHRINE_VOWS).length}/16, keepsakes=${Object.keys(KEEPSAKES).length}/16, bosses=${Object.keys(BOSS_CONSTANTS).length}/8, statuses=${Object.keys(COMBAT_CONSTANTS.statusDefaults).length}/10`
);

const corePhysicsOk =
  SIM_CONSTANTS.simHz === 60 &&
  approxEq(PLAYER_CONSTANTS.speed, 540) &&
  approxEq(PLAYER_CONSTANTS.acceleration, 2000) &&
  approxEq(PLAYER_CONSTANTS.grip, 1000) &&
  approxEq(PLAYER_CONSTANTS.dashDuration, 0.21) &&
  PLAYER_CONSTANTS.dashTicks === 13 &&
  approxEq(PLAYER_CONSTANTS.dashClipRegenInterval, 0.74) &&
  approxEq(PLAYER_CONSTANTS.dashRange, 300) &&
  approxEq(COMBAT_CONSTANTS.critMultiplier, 3.0) &&
  approxEq(COMBAT_CONSTANTS.finalKillSlowScale, 0.00001) &&
  approxEq(COMBAT_CONSTANTS.finalKillSlowDuration, 0.6);

check(
  'core-contract-physics-constants',
  corePhysicsOk,
  `simHz=${SIM_CONSTANTS.simHz}, speed=${PLAYER_CONSTANTS.speed}, dash=${PLAYER_CONSTANTS.dashDuration}s/${PLAYER_CONSTANTS.dashClipRegenInterval}s, crit=${COMBAT_CONSTANTS.critMultiplier}x`
);

const oraclePath = path.join(ASSETS_DIR, 'oracle.json');
if (fs.existsSync(oraclePath)) {
  const oracle = JSON.parse(fs.readFileSync(oraclePath, 'utf8'));
  const mismatches: string[] = [];

  const cmp = (label: string, actual: number, expected: unknown, tol = 1e-6) => {
    if (typeof expected !== 'number') {
      mismatches.push(`${label}: oracle missing numeric value`);
      return;
    }
    if (!approxEq(actual, expected, tol)) {
      mismatches.push(`${label}: contract=${actual} != oracle=${expected}`);
    }
  };

  // Hero & Dash constants
  cmp('hero.speed', PLAYER_CONSTANTS.speed, oracle.hero?.speed?.value);
  cmp('hero.acceleration', PLAYER_CONSTANTS.acceleration, oracle.hero?.acceleration?.value);
  cmp('hero.grip', PLAYER_CONSTANTS.grip, oracle.hero?.grip?.value);
  cmp('hero.backpedal', PLAYER_CONSTANTS.backpedalSpeedModifier, oracle.hero?.backpedalSpeedModifier?.value);
  cmp('hero.fullControl', PLAYER_CONSTANTS.fullControlVelocityThreshold, oracle.hero?.fullControlVelocityThreshold?.value);
  cmp('hero.touchdownRetention', PLAYER_CONSTANTS.touchdownVelocityRetention, oracle.hero?.touchdownVelocityRetention?.value);
  cmp('hero.cosmeticRot', SIM_CONSTANTS.cosmeticRotationSpeed, oracle.hero?.cosmeticRotationSpeed?.value);
  cmp('hero.combatRot', SIM_CONSTANTS.combatRotationSpeed, oracle.hero?.combatRotationSpeed?.value);
  cmp('hero.reticleMagDist', PLAYER_CONSTANTS.reticleMagnetismDistance, oracle.hero?.reticleMagnetismDistance?.value);
  cmp('dash.duration', PLAYER_CONSTANTS.dashDuration, oracle.hero?.dash?.blinkDuration?.value);
  cmp('dash.ticks', PLAYER_CONSTANTS.dashTicks, oracle.hero?.dash?.blinkTicks60Hz?.value);
  cmp('dash.easeOut', PLAYER_CONSTANTS.dashEaseOut, oracle.hero?.dash?.blinkEaseOut?.value);
  cmp('dash.range', PLAYER_CONSTANTS.dashRange, oracle.hero?.dash?.range?.value);
  cmp('dash.maxRange', PLAYER_CONSTANTS.dashMaxRange, oracle.hero?.dash?.maxRange?.value);
  cmp('dash.regenInterval', PLAYER_CONSTANTS.dashClipRegenInterval, oracle.hero?.dash?.clipRegenInterval?.value);
  cmp('dash.cooldown', PLAYER_CONSTANTS.dashCooldown, oracle.hero?.dash?.cooldown?.value);
  cmp('dash.numGhosts', PLAYER_CONSTANTS.dashGhosts, oracle.hero?.dash?.numGhosts?.value);
  cmp('dash.strikeWindow', PLAYER_CONSTANTS.dashStrikeWindow, oracle.hero?.dash?.dashManeuverTimeThreshold?.value);
  cmp('dash.perfectHitDisable', PLAYER_CONSTANTS.perfectDashHitDisableDuration, oracle.hero?.dash?.perfectDashHitDisableDuration?.value);

  // Scaling & Status timings
  cmp('scaling.crit', COMBAT_CONSTANTS.critMultiplier, oracle.scaling?.criticalHitMultiplier?.value);
  const tier1 = oracle.scaling?.rarityLevels?.tier1?.value;
  if (tier1) {
    for (const r of ['common', 'rare', 'epic', 'heroic'] as const) {
      const val = COMBAT_CONSTANTS.rarityMultipliers[r];
      const bounds = tier1[r];
      if (bounds && (val < bounds.min - 1e-6 || val > bounds.max + 1e-6)) {
        mismatches.push(`rarity.${r}: ${val} outside [${bounds.min}, ${bounds.max}]`);
      }
    }
  }
  if (oracle.statusEffects?.weak) {
    cmp('status.weak.duration', COMBAT_CONSTANTS.statusDefaults.weak.duration, oracle.statusEffects.weak.duration?.value);
    cmp('status.weak.mult', COMBAT_CONSTANTS.statusDefaults.weak.outgoingDamageMult, oracle.statusEffects.weak.damageOutputMultiplier?.value);
  }
  if (oracle.statusEffects?.hangover) {
    cmp('status.hangover.duration', COMBAT_CONSTANTS.statusDefaults.hangover.duration, oracle.statusEffects.hangover.duration?.value);
  }

  // All 8 Boss Max HP tables (including Sovereign Lord 2-phase & EM4 3-phase 22000 HP)
  for (const bossId of Object.keys(BOSS_CONSTANTS) as BossId[]) {
    const oBoss = oracle.bosses?.[bossId];
    const expectedHp = oBoss?.maxHealth?.value ?? oBoss?.maxHealthPerPhase?.value;
    cmp(`boss.${bossId}.maxHp`, BOSS_CONSTANTS[bossId].maxHp, expectedHp);
    if (bossId === 'sovereign_lord') {
      cmp('boss.sovereign_lord.phases', BOSS_CONSTANTS.sovereign_lord.phases, oBoss?.phases?.value);
      cmp(
        'boss.sovereign_lord.em4MaxHp',
        BOSS_CONSTANTS.sovereign_lord.em4MaxHp ?? -1,
        oBoss?.extremeMeasuresMaxHealthPerPhase?.value
      );
      cmp(
        'boss.sovereign_lord.em4Phases',
        BOSS_CONSTANTS.sovereign_lord.em4Phases ?? -1,
        oBoss?.extremeMeasuresPhases?.value
      );
    }
  }

  // All 5 Run Biomes (zoomRange & wallSlamMultiplier)
  // Allow 0.06 zoom tolerance for SPEC.md tuned framing (e.g. verdant_colosseum 0.80 vs oracle 0.75)
  const runBiomes: BiomeId[] = [
    'obsidian_pit',
    'cinder_mire',
    'verdant_colosseum',
    'crypt_of_bile',
    'frozen_summit',
  ];
  for (const biomeId of runBiomes) {
    const oBiome = oracle.biomes?.[biomeId];
    cmp(`biome.${biomeId}.wallSlam`, BIOME_CONSTANTS[biomeId].wallSlamMultiplier, oBiome?.wallSlamMultiplier?.value);
    const oZoom = oBiome?.zoomRange?.value;
    if (Array.isArray(oZoom) && oZoom.length === 2) {
      cmp(`biome.${biomeId}.zoomMin`, BIOME_CONSTANTS[biomeId].zoomRange[0], oZoom[0], 0.06);
      cmp(`biome.${biomeId}.zoomMax`, BIOME_CONSTANTS[biomeId].zoomRange[1], oZoom[1], 0.06);
    }
  }

  check(
    'mechanic-oracle-parity',
    mismatches.length === 0,
    mismatches.length === 0
      ? 'All hero, dash, scaling, status, 8 boss HP, and 5 biome zoom/wallSlam constants match oracle.json'
      : `mismatches: ${mismatches.join(' | ')}`
  );
} else {
  check(
    'mechanic-oracle-parity',
    true,
    'SKIPPED cleanly (.wannabehades-assets/oracle.json absent — CI built-in mode)'
  );
}

// ============================================================================
// 4. TASTE_NOTES & IP Hygiene Checks
// ============================================================================

// 4a. Input gates (Xbox Gamepad mapping & hidden-by-default touch gate)
const gamepadSrc = fs.readFileSync(path.join(ROOT, 'src/input/GamepadAdapter.ts'), 'utf8');
const touchSrc = fs.readFileSync(path.join(ROOT, 'src/input/TouchOverlayController.ts'), 'utf8');
const hasXboxMap =
  gamepadSrc.includes('BTN_A') &&
  gamepadSrc.includes('BTN_B') &&
  gamepadSrc.includes('BTN_X') &&
  gamepadSrc.includes('BTN_Y') &&
  gamepadSrc.includes('dual-rumble');
const hasTouchHiddenGate =
  touchSrc.includes('data-touch-visible') &&
  touchSrc.includes('data-touch-visible="false"') &&
  touchSrc.includes('applyVisibility(false)');
check(
  'taste-notes-input-gates',
  hasXboxMap && hasTouchHiddenGate,
  `xboxMapping=${hasXboxMap}, touchHiddenByDefault=${hasTouchHiddenGate}`
);

// 4b. Pure deterministic sim check (zero Math.random, window, document, AudioContext, localStorage in src/sim/)
const simFiles = listFilesRecursive(path.join(ROOT, 'src/sim'), ['.ts']);
const simViolations: string[] = [];
const bannedSimRegex = /\b(Math\.random|window|document|AudioContext|localStorage)\b/g;
for (const file of simFiles) {
  const code = stripTsComments(fs.readFileSync(file, 'utf8'));
  const hits = code.match(bannedSimRegex);
  if (hits && hits.length > 0) {
    simViolations.push(`${path.relative(ROOT, file)}:[${Array.from(new Set(hits)).join(',')}]`);
  }
}
check(
  'sim-purity-zero-dom-or-random',
  simViolations.length === 0 && simFiles.length > 0,
  simViolations.length === 0
    ? `Scanned ${simFiles.length} src/sim/*.ts files — 0 forbidden tokens`
    : `Violations: ${simViolations.join('; ')}`
);

// 4c. Zero copyrighted retail character/studio names in user-facing UI/built-in files
const ipScanDirs = ['src/ui', 'src/data', 'src/contracts', 'src/sim', 'src/audio', 'src/render'];
const ipFiles: string[] = [];
for (const d of ipScanDirs) {
  ipFiles.push(...listFilesRecursive(path.join(ROOT, d), ['.ts']));
}
for (const single of ['index.html', 'README.md']) {
  const full = path.join(ROOT, single);
  if (fs.existsSync(full)) ipFiles.push(full);
}

const ipRegex = new RegExp(`\\b(${FORBIDDEN_RETAIL_NAMES.join('|')})\\b`, 'gi');
const ipViolations: string[] = [];
for (const file of ipFiles) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (
    rel === 'src/assets/AssetRegistry.ts' ||
    rel === 'tools/oracle-dump.ts' ||
    rel === 'tools/extract-assets.ts'
  ) {
    continue;
  }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    const matches = line.match(ipRegex);
    if (matches) {
      ipViolations.push(`${rel}:${idx + 1} (${Array.from(new Set(matches)).join(',')})`);
    }
  });
}
check(
  'ip-hygiene-clean-room-names',
  ipViolations.length === 0,
  ipViolations.length === 0
    ? `Scanned ${ipFiles.length} user-facing/built-in files — 0 retail IP tokens`
    : `Found ${ipViolations.length} violations: ${ipViolations.slice(0, 12).join('; ')}`
);

// 4d. Zero retail binaries in git ls-files or dist/
const binaryViolations: string[] = [];
try {
  const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const f of tracked) {
    const norm = f.replace(/\\/g, '/');
    if (
      norm.startsWith('.wannabehades-assets/') ||
      FORBIDDEN_BINARY_EXTS.some((ext) => norm.toLowerCase().endsWith(ext))
    ) {
      binaryViolations.push(`git:${norm}`);
    }
  }
} catch (err) {
  binaryViolations.push(`git-ls-files-error:${String(err)}`);
}

const distDir = path.join(ROOT, 'dist');
if (fs.existsSync(distDir)) {
  for (const f of listFilesRecursive(distDir)) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (
      rel.includes('.wannabehades-assets') ||
      FORBIDDEN_BINARY_EXTS.some((ext) => rel.toLowerCase().endsWith(ext))
    ) {
      binaryViolations.push(`dist:${rel}`);
    }
  }
}
check(
  'ip-hygiene-zero-retail-binaries',
  binaryViolations.length === 0,
  binaryViolations.length === 0
    ? '0 retail binaries or .wannabehades-assets/ entries in git ls-files or dist/'
    : `Violations: ${binaryViolations.join('; ')}`
);

// ============================================================================
// Final Exit Verdict
// ============================================================================

const failed = results.filter((r) => !r.pass);
console.log(`\nGate A Summary: ${results.length - failed.length}/${results.length} passed.`);
if (failed.length > 0) {
  process.exit(1);
}
