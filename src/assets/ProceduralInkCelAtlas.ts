/**
 * ProceduralInkCelAtlas — Pre-baked 2048x2048 Supergiant-style Ink-Cel Sprite Atlas.
 *
 * Pre-renders every tile, prop, character, boss, weapon, pickup, Patron sigil, and VFX
 * sprite ONCE at startup onto a single 2048x2048 offscreen Canvas (zero per-frame canvas
 * allocations). Pure metadata & `getBuiltinAssetIds()` are 100% Node-safe (no DOM access
 * unless `bakeProceduralAtlas()` is invoked in a browser environment).
 */

import type { BiomeId, EnemyArchetypeId, PatronId, PickupKind, WeaponId } from '../contracts/index.js';
import { PATRON_CONSTANTS } from '../contracts/index.js';

export const ATLAS_SIZE = 2048;

export interface AtlasSpriteRect {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Normalized anchor X (0..1, 0.5 = horizontal center) */
  readonly anchorX: number;
  /** Normalized anchor Y (0..1, ~0.85 = feet for grounded characters, 0.5 = centered VFX) */
  readonly anchorY: number;
  /** Precomputed normalized UVs [u0, v0, u1, v1] */
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

export interface BakedAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly sprites: ReadonlyMap<string, AtlasSpriteRect>;
}

interface SpriteSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  anchorX: number;
  anchorY: number;
}

function makeRect(spec: SpriteSpec): AtlasSpriteRect {
  return {
    ...spec,
    u0: spec.x / ATLAS_SIZE,
    v0: spec.y / ATLAS_SIZE,
    u1: (spec.x + spec.w) / ATLAS_SIZE,
    v1: (spec.y + spec.h) / ATLAS_SIZE,
  };
}

// ============================================================================
// Canonical 2048x2048 Atlas Packing Layout (Non-overlapping, 4px+ padding)
// ============================================================================

const SPRITE_SPECS: readonly SpriteSpec[] = [
  // Solid white texel block for untextured vector/ribbon/telegraph batching
  { id: 'white_pixel', x: 4, y: 4, w: 8, h: 8, anchorX: 0.5, anchorY: 0.5 },

  // Row 0 (y=16..152): Isometric Carved Stone Floor Tiles (256x128 diamonds)
  { id: 'tile_obsidian_a', x: 16, y: 16, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_obsidian_b', x: 280, y: 16, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_obsidian_cracked', x: 544, y: 16, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_obsidian_mosaic', x: 808, y: 16, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_sanctum_a', x: 1072, y: 16, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_sanctum_b', x: 1336, y: 16, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_sanctum_mosaic', x: 1600, y: 16, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },

  // Row 1 (y=156..292): Additional Biome Tiles + Greek Meander Trim + Chasm Rim
  { id: 'tile_cinder_a', x: 16, y: 156, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_verdant_a', x: 280, y: 156, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_crypt_a', x: 544, y: 156, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_summit_a', x: 808, y: 156, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'trim_meander', x: 1072, y: 156, w: 256, h: 48, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_chasm_rim', x: 1072, y: 212, w: 256, h: 64, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_spike_idle', x: 1344, y: 156, w: 128, h: 80, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_spike_armed', x: 1480, y: 156, w: 128, h: 80, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_spike_active', x: 1616, y: 156, w: 128, h: 80, anchorX: 0.5, anchorY: 0.5 },

  // Row 2 (y=300..596): Architectural Props & Exit Doors
  { id: 'prop_pillar_obsidian', x: 16, y: 300, w: 144, h: 288, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_pillar_sanctum', x: 168, y: 300, w: 144, h: 288, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_statue', x: 320, y: 300, w: 144, h: 256, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_exit_door_locked', x: 472, y: 300, w: 200, h: 232, anchorX: 0.5, anchorY: 0.85 },
  { id: 'prop_exit_door_open', x: 680, y: 300, w: 200, h: 232, anchorX: 0.5, anchorY: 0.85 },
  { id: 'prop_brazier', x: 892, y: 300, w: 112, h: 128, anchorX: 0.5, anchorY: 0.82 },
  { id: 'prop_urn', x: 1016, y: 300, w: 88, h: 108, anchorX: 0.5, anchorY: 0.84 },

  // Hero — Prince Pyreus (y=300..476 right half)
  { id: 'hero_down', x: 1120, y: 300, w: 160, h: 176, anchorX: 0.5, anchorY: 0.84 },
  { id: 'hero_up', x: 1288, y: 300, w: 160, h: 176, anchorX: 0.5, anchorY: 0.84 },
  { id: 'hero_side', x: 1456, y: 300, w: 160, h: 176, anchorX: 0.5, anchorY: 0.84 },
  { id: 'hero_diag_down', x: 1624, y: 300, w: 160, h: 176, anchorX: 0.5, anchorY: 0.84 },
  { id: 'hero_diag_up', x: 1792, y: 300, w: 160, h: 176, anchorX: 0.5, anchorY: 0.84 },

  // Infernal Arms (y=488..588 right half)
  { id: 'weapon_stygian_blade', x: 1120, y: 492, w: 144, h: 56, anchorX: 0.22, anchorY: 0.5 },
  { id: 'weapon_eternal_spear', x: 1276, y: 492, w: 184, h: 48, anchorX: 0.28, anchorY: 0.5 },
  { id: 'weapon_shield_of_chaos', x: 1472, y: 484, w: 96, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'weapon_heart_seeking_bow', x: 1580, y: 484, w: 96, h: 104, anchorX: 0.45, anchorY: 0.5 },
  { id: 'weapon_twin_fists', x: 1688, y: 492, w: 96, h: 80, anchorX: 0.5, anchorY: 0.5 },
  { id: 'weapon_adamant_rail', x: 1796, y: 492, w: 152, h: 64, anchorX: 0.3, anchorY: 0.5 },

  // Row 3 (y=604..904): Wave 1 Enemies & Bosses
  { id: 'enemy_numbskull', x: 16, y: 608, w: 120, h: 128, anchorX: 0.5, anchorY: 0.78 },
  { id: 'enemy_wretched_husk', x: 148, y: 608, w: 176, h: 204, anchorX: 0.5, anchorY: 0.86 },
  { id: 'enemy_bone_archer', x: 336, y: 608, w: 152, h: 188, anchorX: 0.5, anchorY: 0.84 },
  { id: 'enemy_brimstone_crystal', x: 500, y: 608, w: 136, h: 184, anchorX: 0.5, anchorY: 0.78 },
  { id: 'enemy_ember_lout', x: 648, y: 608, w: 184, h: 184, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_rattlebones_dummy', x: 844, y: 608, w: 156, h: 204, anchorX: 0.5, anchorY: 0.88 },
  { id: 'enemy_generic_shade', x: 1012, y: 608, w: 152, h: 188, anchorX: 0.5, anchorY: 0.85 },
  { id: 'boss_warden_malice', x: 1180, y: 604, w: 304, h: 296, anchorX: 0.5, anchorY: 0.84 },
  { id: 'boss_generic_titan', x: 1500, y: 604, w: 272, h: 288, anchorX: 0.5, anchorY: 0.85 },

  // Row 4 (y=916..1040): Pickups & Reward Emblems
  { id: 'vfx_boon_orb', x: 16, y: 920, w: 96, h: 96, anchorX: 0.5, anchorY: 0.55 },
  { id: 'vfx_bloodstone', x: 124, y: 920, w: 72, h: 72, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_centaur_heart', x: 208, y: 920, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_gold_coin', x: 308, y: 920, w: 72, h: 72, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_darkness_orb', x: 392, y: 920, w: 80, h: 88, anchorX: 0.5, anchorY: 0.55 },
  { id: 'vfx_pom_icon', x: 484, y: 920, w: 80, h: 84, anchorX: 0.5, anchorY: 0.55 },
  { id: 'vfx_hammer_icon', x: 576, y: 920, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_skull_badge', x: 676, y: 920, w: 80, h: 84, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_shop_purse', x: 768, y: 920, w: 80, h: 84, anchorX: 0.5, anchorY: 0.55 },
  { id: 'vfx_fountain_chalice', x: 860, y: 920, w: 88, h: 92, anchorX: 0.5, anchorY: 0.55 },
  { id: 'vfx_gemstone', x: 960, y: 920, w: 76, h: 76, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_key', x: 1048, y: 920, w: 76, h: 84, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_nectar', x: 1136, y: 920, w: 76, h: 88, anchorX: 0.5, anchorY: 0.55 },

  // Row 5 (y=1036..1136): 10 Patron Sigil Medallions (88x88)
  { id: 'sigil_voltaris', x: 16, y: 1036, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_tidebreaker', x: 112, y: 1036, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_aegira', x: 208, y: 1036, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_velouris', x: 304, y: 1036, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_sylvara', x: 400, y: 1036, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_bellum', x: 496, y: 1036, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_bacchion', x: 592, y: 1036, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_glaciera', x: 688, y: 1036, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_veloce', x: 784, y: 1036, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_abyssos', x: 880, y: 1036, w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },

  // Row 6 (y=1144..1320): VFX Sprites & Persistent Floor Decals
  { id: 'vfx_glow_soft', x: 16, y: 1148, w: 128, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_glow_star', x: 156, y: 1148, w: 128, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_spark_burst', x: 296, y: 1148, w: 104, h: 104, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_lightning_bolt', x: 412, y: 1148, w: 144, h: 72, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_flame_tongue', x: 568, y: 1148, w: 72, h: 104, anchorX: 0.5, anchorY: 0.85 },
  { id: 'vfx_wave_crest', x: 652, y: 1148, w: 112, h: 72, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_decal_scorch', x: 780, y: 1148, w: 144, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_decal_ichor', x: 936, y: 1148, w: 144, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_decal_crack', x: 1092, y: 1148, w: 144, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_ring_soft', x: 1248, y: 1148, w: 128, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_shadow_blob', x: 1388, y: 1148, w: 128, h: 80, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_projectile_orb', x: 1528, y: 1148, w: 64, h: 64, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_projectile_arrow', x: 1604, y: 1148, w: 96, h: 36, anchorX: 0.5, anchorY: 0.5 },

  // Row 7 (y=1284..1560): Wave 2 Biome Tiles, Pillars & Environmental VFX
  { id: 'tile_cinder_b', x: 16, y: 1284, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_verdant_b', x: 280, y: 1284, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_crypt_b', x: 544, y: 1284, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_summit_b', x: 808, y: 1284, w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_pillar_cinder', x: 1080, y: 1284, w: 128, h: 248, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_pillar_verdant', x: 1216, y: 1284, w: 128, h: 248, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_pillar_crypt', x: 1352, y: 1284, w: 128, h: 248, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_pillar_summit', x: 1488, y: 1284, w: 128, h: 248, anchorX: 0.5, anchorY: 0.86 },
  { id: 'vfx_curing_basin', x: 1628, y: 1284, w: 128, h: 104, anchorX: 0.5, anchorY: 0.62 },
  { id: 'vfx_sawblade', x: 1764, y: 1284, w: 96, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_blade_rift', x: 1868, y: 1284, w: 112, h: 112, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_skull_proj', x: 1628, y: 1400, w: 96, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_petal', x: 1736, y: 1400, w: 48, h: 48, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_snowflake', x: 1796, y: 1400, w: 48, h: 48, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_pylon', x: 1856, y: 1400, w: 104, h: 136, anchorX: 0.5, anchorY: 0.82 },

  // Row 8 (y=1420..1564, left half x=16..1068): Wave 2 Enemies Part 1 (8 bespoke archetypes)
  { id: 'enemy_wretch_assassin', x: 16, y: 1420, w: 124, h: 144, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_slag_thrower', x: 146, y: 1420, w: 124, h: 144, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_lava_gorgon', x: 276, y: 1420, w: 124, h: 144, anchorX: 0.5, anchorY: 0.78 },
  { id: 'enemy_bloodless_drifter', x: 406, y: 1420, w: 124, h: 144, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_infernal_bomber', x: 536, y: 1420, w: 124, h: 144, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_bone_hydra_head', x: 666, y: 1420, w: 128, h: 144, anchorX: 0.5, anchorY: 0.84 },
  { id: 'enemy_colosseum_swordsman', x: 800, y: 1420, w: 124, h: 144, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_colosseum_shieldbearer', x: 930, y: 1420, w: 132, h: 144, anchorX: 0.5, anchorY: 0.85 },

  // Row 9 (y=1572..1720): Wave 2 Enemies Part 2 (7 archetypes) + Weapon/Portal VFX
  { id: 'enemy_colosseum_bowman', x: 16, y: 1572, w: 128, h: 144, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_chariot_flame', x: 152, y: 1572, w: 132, h: 132, anchorX: 0.5, anchorY: 0.82 },
  { id: 'enemy_soul_orb', x: 292, y: 1572, w: 104, h: 104, anchorX: 0.5, anchorY: 0.65 },
  { id: 'enemy_venom_satyr', x: 404, y: 1572, w: 128, h: 144, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_giant_vermin', x: 540, y: 1572, w: 144, h: 128, anchorX: 0.5, anchorY: 0.82 },
  { id: 'enemy_snakestone_laser', x: 692, y: 1572, w: 124, h: 144, anchorX: 0.5, anchorY: 0.78 },
  { id: 'enemy_heavy_brawler', x: 824, y: 1572, w: 152, h: 148, anchorX: 0.5, anchorY: 0.86 },
  { id: 'vfx_chaos_gate', x: 988, y: 1572, w: 144, h: 104, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_muzzle_flash', x: 1144, y: 1572, w: 112, h: 96, anchorX: 0.2, anchorY: 0.5 },
  { id: 'vfx_bow_flash', x: 1268, y: 1572, w: 112, h: 112, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_shield_block', x: 1392, y: 1572, w: 112, h: 128, anchorX: 0.5, anchorY: 0.5 },

  // Row 10 (y=1728..2036): ALL 7 Remaining Wave 2 Bosses (All 8 Bosses Bespoke!)
  { id: 'boss_warden_fury', x: 16, y: 1732, w: 264, h: 272, anchorX: 0.5, anchorY: 0.85 },
  { id: 'boss_warden_murder', x: 288, y: 1732, w: 264, h: 272, anchorX: 0.5, anchorY: 0.85 },
  { id: 'boss_bone_leviathan', x: 560, y: 1732, w: 288, h: 288, anchorX: 0.5, anchorY: 0.85 },
  { id: 'boss_colosseum_bull', x: 856, y: 1732, w: 276, h: 284, anchorX: 0.5, anchorY: 0.86 },
  { id: 'boss_colosseum_spearlord', x: 1140, y: 1732, w: 256, h: 280, anchorX: 0.5, anchorY: 0.86 },
  { id: 'boss_the_ferryman', x: 1404, y: 1732, w: 268, h: 288, anchorX: 0.5, anchorY: 0.86 },
  { id: 'boss_sovereign_lord', x: 1680, y: 1728, w: 344, h: 308, anchorX: 0.5, anchorY: 0.86 },
];

export const ATLAS_SPRITE_RECTS: ReadonlyMap<string, AtlasSpriteRect> = new Map(
  SPRITE_SPECS.map((s) => [s.id, makeRect(s)])
);

/**
 * Pure Node-safe inventory of all built-in procedural ink-cel atlas asset IDs
 * for Gate A `verify:assets` validation.
 */
export function getBuiltinAssetIds(): string[] {
  return SPRITE_SPECS.map((s) => s.id);
}

/** Resolve bespoke ink-cel sprite ID for EVERY enemy archetype & boss! */
export function getEnemySpriteId(archetype: EnemyArchetypeId, isBoss: boolean): string {
  switch (archetype) {
    case 'numbskull':
      return 'enemy_numbskull';
    case 'wretched_husk':
      return 'enemy_wretched_husk';
    case 'bone_archer':
      return 'enemy_bone_archer';
    case 'brimstone_crystal':
      return 'enemy_brimstone_crystal';
    case 'ember_lout':
      return 'enemy_ember_lout';
    case 'rattlebones_dummy':
      return 'enemy_rattlebones_dummy';
    case 'wretch_assassin':
      return 'enemy_wretch_assassin';
    case 'slag_thrower':
      return 'enemy_slag_thrower';
    case 'lava_gorgon':
      return 'enemy_lava_gorgon';
    case 'bloodless_drifter':
      return 'enemy_bloodless_drifter';
    case 'infernal_bomber':
      return 'enemy_infernal_bomber';
    case 'bone_hydra_head':
      return 'enemy_bone_hydra_head';
    case 'colosseum_swordsman':
      return 'enemy_colosseum_swordsman';
    case 'colosseum_shieldbearer':
      return 'enemy_colosseum_shieldbearer';
    case 'colosseum_bowman':
      return 'enemy_colosseum_bowman';
    case 'chariot_flame':
      return 'enemy_chariot_flame';
    case 'soul_orb':
      return 'enemy_soul_orb';
    case 'venom_satyr':
      return 'enemy_venom_satyr';
    case 'giant_vermin':
      return 'enemy_giant_vermin';
    case 'snakestone_laser':
      return 'enemy_snakestone_laser';
    case 'heavy_brawler':
      return 'enemy_heavy_brawler';
    case 'warden_malice':
      return 'boss_warden_malice';
    case 'warden_fury':
      return 'boss_warden_fury';
    case 'warden_murder':
      return 'boss_warden_murder';
    case 'bone_leviathan':
      return 'boss_bone_leviathan';
    case 'colosseum_bull':
      return 'boss_colosseum_bull';
    case 'colosseum_spearlord':
      return 'boss_colosseum_spearlord';
    case 'the_ferryman':
      return 'boss_the_ferryman';
    case 'sovereign_lord':
      return 'boss_sovereign_lord';
    default:
      return isBoss ? 'boss_generic_titan' : 'enemy_generic_shade';
  }
}

export function getBiomePillarSpriteId(biome: BiomeId): string {
  switch (biome) {
    case 'sanctum_hub':
      return 'prop_pillar_sanctum';
    case 'cinder_mire':
      return 'prop_pillar_cinder';
    case 'verdant_colosseum':
      return 'prop_pillar_verdant';
    case 'crypt_of_bile':
      return 'prop_pillar_crypt';
    case 'frozen_summit':
      return 'prop_pillar_summit';
    case 'obsidian_pit':
    default:
      return 'prop_pillar_obsidian';
  }
}

export function getWeaponSpriteId(weaponId: WeaponId): string {
  return `weapon_${weaponId}`;
}

export function getPatronSigilSpriteId(patronId: PatronId): string {
  return `sigil_${patronId}`;
}

export function getPickupSpriteId(kind: PickupKind, patronId?: PatronId): string {
  if (kind === 'boon' && patronId) {
    return getPatronSigilSpriteId(patronId);
  }
  switch (kind) {
    case 'boon':
      return 'vfx_boon_orb';
    case 'hammer':
      return 'vfx_hammer_icon';
    case 'pom':
      return 'vfx_pom_icon';
    case 'centaur_heart':
      return 'vfx_centaur_heart';
    case 'gold':
      return 'vfx_gold_coin';
    case 'darkness':
      return 'vfx_darkness_orb';
    case 'gemstone':
      return 'vfx_gemstone';
    case 'key':
      return 'vfx_key';
    case 'nectar':
    case 'ambrosia':
      return 'vfx_nectar';
    case 'shop_item':
      return 'vfx_shop_purse';
    case 'fountain':
    case 'heal_food':
      return 'vfx_fountain_chalice';
    case 'chaos_gate':
      return 'sigil_abyssos';
    default:
      return 'vfx_boon_orb';
  }
}

export function getBiomeTileIds(biome: BiomeId): readonly string[] {
  switch (biome) {
    case 'sanctum_hub':
      return ['tile_sanctum_a', 'tile_sanctum_b', 'tile_sanctum_a', 'tile_sanctum_mosaic'];
    case 'obsidian_pit':
      return ['tile_obsidian_a', 'tile_obsidian_b', 'tile_obsidian_cracked', 'tile_obsidian_mosaic'];
    case 'cinder_mire':
      return ['tile_cinder_a', 'tile_cinder_b', 'tile_cinder_a', 'tile_cinder_b'];
    case 'verdant_colosseum':
      return ['tile_verdant_a', 'tile_verdant_b', 'tile_verdant_a', 'tile_verdant_b'];
    case 'crypt_of_bile':
      return ['tile_crypt_a', 'tile_crypt_b', 'tile_crypt_a', 'tile_crypt_b'];
    case 'frozen_summit':
      return ['tile_summit_a', 'tile_summit_b', 'tile_summit_a', 'tile_summit_b'];
  }
}

// ============================================================================
// Comic-Ink & 3-Tone Cel Painting Primitives
// ============================================================================

const INK = '#08060e';
const INK_WARM = '#110912';

function withCell(
  ctx: CanvasRenderingContext2D,
  id: string,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): void {
  const rect = ATLAS_SPRITE_RECTS.get(id);
  if (!rect) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.translate(rect.x, rect.y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, rect.w, rect.h);
  ctx.restore();
}

function drawCrossHatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spacing: number,
  angleRad: number,
  color = 'rgba(8, 6, 14, 0.42)',
  lineWidth = 1.4
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  const cx = x + w * 0.5;
  const cy = y + h * 0.5;
  const diag = Math.hypot(w, h) * 0.65;
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);
  ctx.beginPath();
  for (let d = -diag; d <= diag; d += spacing) {
    ctx.moveTo(d, -diag);
    ctx.lineTo(d, diag);
  }
  ctx.stroke();
  ctx.restore();
}

function drawIsometricStoneTile(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: {
    base: string;
    dark: string;
    lit: string;
    bevelLit: string;
    bevelDark: string;
    inlay: string;
    accent: string;
  },
  variant: 'plain' | 'alt' | 'cracked' | 'mosaic'
): void {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const hw = w * 0.49;
  const hh = h * 0.48;

  const diamondPath = (inset = 0) => {
    const ihw = hw - inset;
    const ihh = hh - inset * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ihh);
    ctx.lineTo(cx + ihw, cy);
    ctx.lineTo(cx, cy + ihh);
    ctx.lineTo(cx - ihw, cy);
    ctx.closePath();
  };

  // Base stone body with directional 3-tone gradient
  diamondPath(0);
  const grad = ctx.createLinearGradient(cx - hw, cy - hh, cx + hw, cy + hh);
  grad.addColorStop(0, palette.lit);
  grad.addColorStop(0.48, palette.base);
  grad.addColorStop(1, palette.dark);
  ctx.fillStyle = grad;
  ctx.fill();

  // Clip interior detail to stone diamond
  ctx.save();
  diamondPath(2);
  ctx.clip();

  // Hand-painted angular stone facets & subtle weathered mottled patches
  ctx.fillStyle = palette.lit;
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.65, cy - hh * 0.15);
  ctx.lineTo(cx - hw * 0.08, cy - hh * 0.72);
  ctx.lineTo(cx + hw * 0.25, cy - hh * 0.25);
  ctx.lineTo(cx - hw * 0.2, cy + hh * 0.08);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.dark;
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.moveTo(cx + hw * 0.05, cy + hh * 0.05);
  ctx.lineTo(cx + hw * 0.72, cy - hh * 0.1);
  ctx.lineTo(cx + hw * 0.18, cy + hh * 0.78);
  ctx.lineTo(cx - hw * 0.35, cy + hh * 0.35);
  ctx.closePath();
  ctx.fill();

  // Comic shadow cross-hatching in bottom-right corner
  ctx.globalAlpha = 1;
  drawCrossHatch(ctx, cx, cy, hw, hh, 8, -0.55, 'rgba(7, 5, 14, 0.28)', 1.2);

  if (variant === 'alt') {
    // Recessed carved sub-slabs
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.48, cy - hh * 0.48);
    ctx.lineTo(cx + hw * 0.48, cy + hh * 0.48);
    ctx.stroke();

    ctx.strokeStyle = palette.bevelLit;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.46, cy - hh * 0.45);
    ctx.lineTo(cx + hw * 0.46, cy + hh * 0.45);
    ctx.stroke();
  }

  if (variant === 'cracked') {
    // Dramatic chiseled stone fracture lines with glowing mineral glint
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.42, cy - hh * 0.12);
    ctx.lineTo(cx - hw * 0.14, cy - hh * 0.03);
    ctx.lineTo(cx + hw * 0.08, cy + hh * 0.22);
    ctx.lineTo(cx + hw * 0.36, cy + hh * 0.16);
    ctx.moveTo(cx - hw * 0.14, cy - hh * 0.03);
    ctx.lineTo(cx + hw * 0.05, cy - hh * 0.34);
    ctx.stroke();

    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (variant === 'mosaic') {
    // Ornate inlaid Greek diamond & gold/jade starburst filigree
    diamondPath(16);
    ctx.strokeStyle = palette.inlay;
    ctx.lineWidth = 3;
    ctx.stroke();

    diamondPath(26);
    ctx.fillStyle = palette.dark;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // 4-point inlaid sun/diamond motif
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh * 0.42);
    ctx.lineTo(cx + hw * 0.12, cy - hh * 0.1);
    ctx.lineTo(cx + hw * 0.44, cy);
    ctx.lineTo(cx + hw * 0.12, cy + hh * 0.1);
    ctx.lineTo(cx, cy + hh * 0.42);
    ctx.lineTo(cx - hw * 0.12, cy + hh * 0.1);
    ctx.lineTo(cx - hw * 0.44, cy);
    ctx.lineTo(cx - hw * 0.12, cy - hh * 0.1);
    ctx.closePath();
    ctx.fillStyle = palette.inlay;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner jade/ruby jewel center
    ctx.beginPath();
    ctx.ellipse(cx, cy, 10, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = palette.accent;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  // Crisp chiseled top-left bevel highlight & bottom-right bevel shadow
  ctx.beginPath();
  ctx.moveTo(cx - hw + 4, cy);
  ctx.lineTo(cx, cy - hh + 2.5);
  ctx.lineTo(cx + hw - 4, cy);
  ctx.strokeStyle = palette.bevelLit;
  ctx.lineWidth = 2.6;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - hw + 4, cy);
  ctx.lineTo(cx, cy + hh - 2.5);
  ctx.lineTo(cx + hw - 4, cy);
  ctx.strokeStyle = palette.bevelDark;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  ctx.restore();

  // Bold comic ink mortar seam around tile perimeter
  diamondPath(0.8);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();
}

function drawMeanderTrim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Deep obsidian border plate with inlaid burnished gold Greek key meander
  ctx.fillStyle = '#12191c';
  ctx.fillRect(0, 0, w, h);

  // Top & bottom gilded rails
  ctx.fillStyle = '#c8923a';
  ctx.fillRect(0, 4, w, 5);
  ctx.fillRect(0, h - 9, w, 5);

  ctx.fillStyle = '#f6d178';
  ctx.fillRect(0, 4, w, 2);

  // Repeating Greek key spiral units
  ctx.strokeStyle = '#e5af4d';
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  const step = 32;
  ctx.beginPath();
  for (let x = 0; x < w; x += step) {
    ctx.moveTo(x + 2, h - 13);
    ctx.lineTo(x + 2, 13);
    ctx.lineTo(x + 24, 13);
    ctx.lineTo(x + 24, 28);
    ctx.lineTo(x + 12, 28);
    ctx.lineTo(x + 12, 21);
    ctx.lineTo(x + 18, 21);
    ctx.moveTo(x + 2, h - 13);
    ctx.lineTo(x + 30, h - 13);
  }
  ctx.stroke();

  // Subtle emerald inlay sheen + ink frame lines
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.strokeRect(1.4, 1.4, w - 2.8, h - 2.8);
}

function drawChasmRim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // Dramatic carved obsidian cliff-face drop with emerald underglow
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#273f3a');
  grad.addColorStop(0.22, '#142122');
  grad.addColorStop(0.75, '#0b1014');
  grad.addColorStop(1, 'rgba(6, 12, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Top gilded lip
  ctx.fillStyle = '#53b896';
  ctx.fillRect(0, 0, w, 5);
  ctx.fillStyle = '#d4a34c';
  ctx.fillRect(0, 5, w, 4);

  // Jagged vertical basalt facets & ink grooves
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 24; x < w; x += 36) {
    ctx.moveTo(x, 8);
    ctx.lineTo(x + 5, 28);
    ctx.lineTo(x - 3, h - 10);
  }
  ctx.stroke();
  drawCrossHatch(ctx, 0, 12, w, h - 18, 9, 0.35, 'rgba(8, 6, 14, 0.45)', 1.5);
}

function drawPillar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: 'obsidian' | 'sanctum'
): void {
  const cx = w * 0.5;
  const baseY = h * 0.87;
  const topY = h * 0.11;
  const shaftW = w * 0.54;

  const colDark = theme === 'obsidian' ? '#131d21' : '#241422';
  const colMid = theme === 'obsidian' ? '#243a3c' : '#4a2234';
  const colLit = theme === 'obsidian' ? '#49736b' : '#7b394e';
  const trimGold = theme === 'obsidian' ? '#d8a54a' : '#efbe5c';
  const glowAccent = theme === 'obsidian' ? '#4de09d' : '#ff6347';

  // Pedestal plinth (isometric octagon base)
  ctx.beginPath();
  ctx.moveTo(cx - shaftW * 0.8, baseY);
  ctx.lineTo(cx - shaftW * 0.5, baseY - 22);
  ctx.lineTo(cx + shaftW * 0.5, baseY - 22);
  ctx.lineTo(cx + shaftW * 0.8, baseY);
  ctx.lineTo(cx + shaftW * 0.5, baseY + 24);
  ctx.lineTo(cx - shaftW * 0.5, baseY + 24);
  ctx.closePath();
  const baseGrad = ctx.createLinearGradient(cx - shaftW, baseY - 20, cx + shaftW, baseY + 20);
  baseGrad.addColorStop(0, colLit);
  baseGrad.addColorStop(0.5, colMid);
  baseGrad.addColorStop(1, colDark);
  ctx.fillStyle = baseGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();

  // Main fluted shaft
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - shaftW * 0.5, baseY - 4);
  ctx.lineTo(cx - shaftW * 0.47, topY + 26);
  ctx.lineTo(cx + shaftW * 0.47, topY + 26);
  ctx.lineTo(cx + shaftW * 0.5, baseY - 4);
  ctx.closePath();
  const shaftGrad = ctx.createLinearGradient(cx - shaftW * 0.5, 0, cx + shaftW * 0.5, 0);
  shaftGrad.addColorStop(0, colLit);
  shaftGrad.addColorStop(0.32, colMid);
  shaftGrad.addColorStop(0.68, colDark);
  shaftGrad.addColorStop(1, '#0c1015');
  ctx.fillStyle = shaftGrad;
  ctx.fill();
  ctx.clip();

  // Vertical comic flutes
  for (let i = -2; i <= 2; i++) {
    const fx = cx + i * (shaftW * 0.19);
    ctx.strokeStyle = i < 0 ? 'rgba(190, 255, 226, 0.25)' : 'rgba(6, 5, 12, 0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(fx, topY + 30);
    ctx.lineTo(fx, baseY - 6);
    ctx.stroke();
  }

  // Dramatic shadow side cross-hatching
  drawCrossHatch(ctx, cx + 2, topY + 24, shaftW * 0.55, baseY - topY, 8, -0.45, 'rgba(8, 6, 14, 0.55)', 1.6);

  // Glowing carved rune strip near mid-shaft
  ctx.strokeStyle = glowAccent;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx - shaftW * 0.36, baseY - 62);
  ctx.lineTo(cx - shaftW * 0.14, baseY - 72);
  ctx.lineTo(cx + shaftW * 0.14, baseY - 72);
  ctx.lineTo(cx + shaftW * 0.36, baseY - 62);
  ctx.stroke();
  ctx.restore();

  // Shaft bold ink outline
  ctx.beginPath();
  ctx.moveTo(cx - shaftW * 0.5, baseY - 4);
  ctx.lineTo(cx - shaftW * 0.47, topY + 26);
  ctx.lineTo(cx + shaftW * 0.47, topY + 26);
  ctx.lineTo(cx + shaftW * 0.5, baseY - 4);
  ctx.closePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();

  // Gilded Greek Capital Crown (top)
  ctx.beginPath();
  ctx.moveTo(cx - shaftW * 0.72, topY + 28);
  ctx.lineTo(cx - shaftW * 0.78, topY + 6);
  ctx.lineTo(cx - shaftW * 0.22, topY - 4);
  ctx.lineTo(cx + shaftW * 0.32, topY + 2);
  ctx.lineTo(cx + shaftW * 0.78, topY + 12);
  ctx.lineTo(cx + shaftW * 0.7, topY + 28);
  ctx.closePath();
  const capGrad = ctx.createLinearGradient(cx - shaftW * 0.7, topY, cx + shaftW * 0.7, topY + 28);
  capGrad.addColorStop(0, '#ffe39b');
  capGrad.addColorStop(0.45, trimGold);
  capGrad.addColorStop(1, '#5c3c16');
  ctx.fillStyle = capGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Rim highlight along left silhouette
  ctx.strokeStyle = theme === 'obsidian' ? '#7ff2c4' : '#ffb884';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx - shaftW * 0.47, topY + 32);
  ctx.lineTo(cx - shaftW * 0.49, baseY - 10);
  ctx.stroke();
}

function drawStatue(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const baseY = h * 0.88;

  // Stepped isometric carved obsidian pedestal plinth
  ctx.beginPath();
  ctx.moveTo(cx - 48, baseY + 2);
  ctx.lineTo(cx - 34, baseY - 20);
  ctx.lineTo(cx + 34, baseY - 20);
  ctx.lineTo(cx + 48, baseY + 2);
  ctx.lineTo(cx + 32, baseY + 20);
  ctx.lineTo(cx - 32, baseY + 20);
  ctx.closePath();
  const baseG = ctx.createLinearGradient(cx - 48, baseY - 20, cx + 48, baseY + 20);
  baseG.addColorStop(0, '#4f5e66');
  baseG.addColorStop(0.5, '#252f38');
  baseG.addColorStop(1, '#0f131a');
  ctx.fillStyle = baseG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();

  // Tall chiseled fluted obsidian Greek stele/monolith shaft with beveled obelisk crown
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - 32, baseY - 14);
  ctx.lineTo(cx - 26, h * 0.24);
  ctx.lineTo(cx, h * 0.08);
  ctx.lineTo(cx + 26, h * 0.24);
  ctx.lineTo(cx + 32, baseY - 14);
  ctx.closePath();
  const monoG = ctx.createLinearGradient(cx - 32, h * 0.1, cx + 32, baseY - 14);
  monoG.addColorStop(0, '#5a6f75');
  monoG.addColorStop(0.38, '#2b3a42');
  monoG.addColorStop(0.7, '#151d24');
  monoG.addColorStop(1, '#090c12');
  ctx.fillStyle = monoG;
  ctx.fill();
  ctx.clip();

  // Central carved ridge & sharp cel shadow half
  ctx.fillStyle = 'rgba(7, 5, 14, 0.48)';
  ctx.fillRect(cx, h * 0.08, 40, baseY);
  // Vertical architectural flutes
  for (const fx of [-16, -6, 6, 16]) {
    ctx.strokeStyle = fx < 0 ? 'rgba(186, 224, 218, 0.28)' : 'rgba(6, 5, 12, 0.65)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx + fx, h * 0.26);
    ctx.lineTo(cx + fx, baseY - 16);
    ctx.stroke();
  }
  // Dramatic diagonal comic cross-hatching on shadow plane
  drawCrossHatch(ctx, cx, h * 0.22, 34, baseY - h * 0.3, 7, -0.52, 'rgba(7, 5, 14, 0.56)', 1.5);
  ctx.restore();

  // Bold ink monolith outline
  ctx.beginPath();
  ctx.moveTo(cx - 32, baseY - 14);
  ctx.lineTo(cx - 26, h * 0.24);
  ctx.lineTo(cx, h * 0.08);
  ctx.lineTo(cx + 26, h * 0.24);
  ctx.lineTo(cx + 32, baseY - 14);
  ctx.closePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4;
  ctx.stroke();

  // Ornate burnished-gold Greek collar frieze & glowing Underworld crest inlay!
  ctx.fillStyle = '#e5b149';
  ctx.beginPath();
  ctx.moveTo(cx - 30, h * 0.34);
  ctx.lineTo(cx + 30, h * 0.34);
  ctx.lineTo(cx + 28, h * 0.4);
  ctx.lineTo(cx - 28, h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Engraved glowing diamond Underworld sigil on front face
  ctx.fillStyle = '#4de09d';
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.48);
  ctx.lineTo(cx + 12, h * 0.58);
  ctx.lineTo(cx, h * 0.68);
  ctx.lineTo(cx - 12, h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Crisp left rim highlight catching light
  ctx.strokeStyle = '#92d6c8';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx - 25, h * 0.25);
  ctx.lineTo(cx - 31, baseY - 18);
  ctx.stroke();
}

function drawExitDoor(ctx: CanvasRenderingContext2D, w: number, h: number, open: boolean): void {
  const cx = w * 0.5;
  const baseY = h * 0.88;
  const archTop = h * 0.14;
  const archW = w * 0.74;

  // Outer carved stone archway frame
  const stoneGrad = ctx.createLinearGradient(cx - archW * 0.5, archTop, cx + archW * 0.5, baseY);
  stoneGrad.addColorStop(0, '#4f6d6a');
  stoneGrad.addColorStop(0.5, '#25393b');
  stoneGrad.addColorStop(1, '#10191d');

  ctx.beginPath();
  ctx.moveTo(cx - archW * 0.54, baseY);
  ctx.lineTo(cx - archW * 0.5, archTop + 44);
  ctx.quadraticCurveTo(cx - archW * 0.46, archTop, cx, archTop - 6);
  ctx.quadraticCurveTo(cx + archW * 0.46, archTop, cx + archW * 0.5, archTop + 44);
  ctx.lineTo(cx + archW * 0.54, baseY);
  ctx.closePath();
  ctx.fillStyle = stoneGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.5;
  ctx.stroke();

  // Inner doorway cavity
  const innerPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx - archW * 0.34, baseY - 4);
    ctx.lineTo(cx - archW * 0.32, archTop + 56);
    ctx.quadraticCurveTo(cx - archW * 0.28, archTop + 22, cx, archTop + 18);
    ctx.quadraticCurveTo(cx + archW * 0.28, archTop + 22, cx + archW * 0.32, archTop + 56);
    ctx.lineTo(cx + archW * 0.34, baseY - 4);
    ctx.closePath();
  };

  innerPath();
  if (open) {
    const portalGrad = ctx.createRadialGradient(cx, baseY - 68, 8, cx, baseY - 68, 92);
    portalGrad.addColorStop(0, '#f4fff9');
    portalGrad.addColorStop(0.35, '#59f2b4');
    portalGrad.addColorStop(0.75, '#1b6d62');
    portalGrad.addColorStop(1, '#0b2224');
    ctx.fillStyle = portalGrad;
  } else {
    const closedGrad = ctx.createLinearGradient(cx, archTop + 20, cx, baseY);
    closedGrad.addColorStop(0, '#16111e');
    closedGrad.addColorStop(1, '#08060c');
    ctx.fillStyle = closedGrad;
  }
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();

  if (!open) {
    // Heavy obsidian & gold iron gate bars + crimson seal lock
    ctx.save();
    innerPath();
    ctx.clip();
    ctx.strokeStyle = '#33414a';
    ctx.lineWidth = 7;
    for (let x = -2; x <= 2; x++) {
      ctx.beginPath();
      ctx.moveTo(cx + x * 18, archTop + 18);
      ctx.lineTo(cx + x * 18, baseY);
      ctx.stroke();
    }
    ctx.strokeStyle = '#c8923a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - archW * 0.35, baseY - 54);
    ctx.lineTo(cx + archW * 0.35, baseY - 54);
    ctx.moveTo(cx - archW * 0.35, baseY - 104);
    ctx.lineTo(cx + archW * 0.35, baseY - 104);
    ctx.stroke();
    ctx.restore();

    // Crimson chain lock medallion
    ctx.beginPath();
    ctx.arc(cx, baseY - 78, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#991f2a';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  } else {
    // Radiating golden threshold steps
    ctx.fillStyle = '#f2c15d';
    ctx.beginPath();
    ctx.moveTo(cx - archW * 0.42, baseY - 2);
    ctx.lineTo(cx + archW * 0.42, baseY - 2);
    ctx.lineTo(cx + archW * 0.52, baseY + 14);
    ctx.lineTo(cx - archW * 0.52, baseY + 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  // Ornate gilded keystone crest with horned skull motif at top of arch
  ctx.fillStyle = '#e5b14c';
  ctx.beginPath();
  ctx.moveTo(cx - 22, archTop + 26);
  ctx.lineTo(cx - 28, archTop - 4);
  ctx.lineTo(cx, archTop - 16);
  ctx.lineTo(cx + 28, archTop - 4);
  ctx.lineTo(cx + 22, archTop + 26);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  // Glowing jewel in keystone
  ctx.fillStyle = open ? '#7effcc' : '#ff3d4f';
  ctx.beginPath();
  ctx.moveTo(cx, archTop - 6);
  ctx.lineTo(cx + 8, archTop + 6);
  ctx.lineTo(cx, archTop + 18);
  ctx.lineTo(cx - 8, archTop + 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

function drawBrazier(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const baseY = h * 0.84;

  // Forged iron tripod legs
  ctx.strokeStyle = '#1b1d26';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(cx - 22, baseY - 28);
  ctx.lineTo(cx - 32, baseY + 8);
  ctx.moveTo(cx + 22, baseY - 28);
  ctx.lineTo(cx + 32, baseY + 8);
  ctx.moveTo(cx, baseY - 26);
  ctx.lineTo(cx, baseY + 12);
  ctx.stroke();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Iron & gold fire bowl
  ctx.beginPath();
  ctx.moveTo(cx - 36, baseY - 46);
  ctx.quadraticCurveTo(cx - 32, baseY - 14, cx, baseY - 12);
  ctx.quadraticCurveTo(cx + 32, baseY - 14, cx + 36, baseY - 46);
  ctx.closePath();
  const bowlGrad = ctx.createLinearGradient(cx - 36, baseY - 46, cx + 36, baseY - 16);
  bowlGrad.addColorStop(0, '#5a606e');
  bowlGrad.addColorStop(0.5, '#2b2d38');
  bowlGrad.addColorStop(1, '#12121a');
  ctx.fillStyle = bowlGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();

  // Gold rim ellipse
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 46, 36, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#c88d36';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Glowing hot coal mound
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 46, 28, 9, 0, 0, Math.PI * 2);
  const coalGrad = ctx.createRadialGradient(cx, baseY - 48, 3, cx, baseY - 46, 28);
  coalGrad.addColorStop(0, '#fff4a8');
  coalGrad.addColorStop(0.5, '#ff7722');
  coalGrad.addColorStop(1, '#7a1911');
  ctx.fillStyle = coalGrad;
  ctx.fill();
}

function drawUrn(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const baseY = h * 0.86;

  // Twin curved amphora handles
  ctx.strokeStyle = '#99472c';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - 12, baseY - 58);
  ctx.quadraticCurveTo(cx - 34, baseY - 56, cx - 22, baseY - 34);
  ctx.moveTo(cx + 12, baseY - 58);
  ctx.quadraticCurveTo(cx + 34, baseY - 56, cx + 22, baseY - 34);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Classic Greek terracotta amphora body
  ctx.beginPath();
  ctx.moveTo(cx - 14, baseY);
  ctx.lineTo(cx + 14, baseY);
  ctx.quadraticCurveTo(cx + 28, baseY - 22, cx + 26, baseY - 40);
  ctx.quadraticCurveTo(cx + 24, baseY - 56, cx + 11, baseY - 62);
  ctx.lineTo(cx + 14, baseY - 74);
  ctx.lineTo(cx - 14, baseY - 74);
  ctx.lineTo(cx - 11, baseY - 62);
  ctx.quadraticCurveTo(cx - 24, baseY - 56, cx - 26, baseY - 40);
  ctx.quadraticCurveTo(cx - 28, baseY - 22, cx - 14, baseY);
  ctx.closePath();

  const urnGrad = ctx.createLinearGradient(cx - 26, baseY - 60, cx + 26, baseY - 10);
  urnGrad.addColorStop(0, '#eb8b54');
  urnGrad.addColorStop(0.42, '#c05531');
  urnGrad.addColorStop(0.8, '#5f2218');
  urnGrad.addColorStop(1, '#2a0e0e');
  ctx.fillStyle = urnGrad;
  ctx.fill();

  // Black-figure decorative band & gold stripe
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#17111a';
  ctx.fillRect(cx - 32, baseY - 46, 64, 15);
  ctx.strokeStyle = '#f2bf57';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx - 30, baseY - 46);
  ctx.lineTo(cx + 30, baseY - 46);
  ctx.moveTo(cx - 30, baseY - 31);
  ctx.lineTo(cx + 30, baseY - 31);
  ctx.stroke();
  // Specular highlight arc
  ctx.strokeStyle = 'rgba(255, 224, 184, 0.65)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 15, baseY - 52);
  ctx.quadraticCurveTo(cx - 20, baseY - 34, cx - 12, baseY - 14);
  ctx.stroke();
  ctx.restore();

  // Crisp ink outline
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();

  // Rim ellipse
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 74, 15, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#241010';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();
}

function drawSpikeTrap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: 'idle' | 'armed' | 'active'
): void {
  const cx = w * 0.5;
  const cy = h * 0.55;
  const hw = w * 0.44;
  const hh = h * 0.36;

  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fillStyle = mode === 'armed' ? '#4a2024' : '#2c2934';
  ctx.fill();
  ctx.strokeStyle = mode === 'armed' ? '#ff5138' : '#b88a44';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  const holes: readonly [number, number][] = [
    [0, -10],
    [-20, 0],
    [20, 0],
    [0, 10],
    [0, 0],
  ];

  for (const [ox, oy] of holes) {
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy, 7, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = mode === 'armed' ? '#ff4838' : '#09070e';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    if (mode === 'active') {
      // Razor cel-shaded steel spike shooting out
      ctx.beginPath();
      ctx.moveTo(cx + ox - 5.5, cy + oy);
      ctx.lineTo(cx + ox, cy + oy - 26);
      ctx.lineTo(cx + ox + 5.5, cy + oy);
      ctx.closePath();
      const spGrad = ctx.createLinearGradient(cx + ox - 5, cy + oy - 26, cx + ox + 5, cy + oy);
      spGrad.addColorStop(0, '#ffffff');
      spGrad.addColorStop(0.5, '#b6c5d4');
      spGrad.addColorStop(1, '#39414f');
      ctx.fillStyle = spGrad;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
  }
}

function drawHeroPose(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pose: 'down' | 'up' | 'side' | 'diag_down' | 'diag_up'
): void {
  const cx = w * 0.5;
  const footY = h * 0.87;
  const isUp = pose === 'up' || pose === 'diag_up';
  const isSide = pose === 'side';

  // Sleek Sculpted Fiery Ankle Flames & Athletic Combat Boots/Greaves
  const drawEmberAnkle = (fx: number, fy: number) => {
    const fGrad = ctx.createRadialGradient(fx, fy, 2, fx, fy - 4, 19);
    fGrad.addColorStop(0, '#fff7b0');
    fGrad.addColorStop(0.45, '#ff5b14');
    fGrad.addColorStop(1, 'rgba(200, 18, 14, 0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 17, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tapered stylized flame lick curling back from heel
    ctx.fillStyle = '#ff6b1a';
    ctx.beginPath();
    ctx.moveTo(fx - 7, fy);
    ctx.quadraticCurveTo(fx - 18, fy - 12, fx - 12, fy - 24);
    ctx.quadraticCurveTo(fx - 3, fy - 14, fx + 6, fy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  };

  const lFootX = cx - (isSide ? 13 : 17);
  const rFootX = cx + (isSide ? 18 : 16);
  drawEmberAnkle(lFootX, footY - 2);
  drawEmberAnkle(rFootX, footY + 3);

  // Tall athletic combat legs with dark-bronze greaves & knee guards (sleek Hades proportions!)
  const drawLeg = (hipX: number, hipY: number, footX: number, footYPos: number, front: boolean) => {
    ctx.beginPath();
    ctx.moveTo(hipX - 7, hipY);
    ctx.lineTo(footX - 5, footYPos - 18);
    ctx.lineTo(footX - 6, footYPos);
    ctx.lineTo(footX + 7, footYPos);
    ctx.lineTo(footX + 5, footYPos - 18);
    ctx.lineTo(hipX + 7, hipY);
    ctx.closePath();
    ctx.fillStyle = front ? '#d69973' : '#9c6649';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.8;
    ctx.stroke();

    // Burnished bronze shin greave
    ctx.fillStyle = front ? '#c98e3a' : '#784e1d';
    ctx.beginPath();
    ctx.moveTo(footX - 6, footYPos - 22);
    ctx.lineTo(footX + 6, footYPos - 22);
    ctx.lineTo(footX + 5, footYPos - 2);
    ctx.lineTo(footX - 5, footYPos - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.stroke();
  };

  drawLeg(cx - 8, footY - 56, lFootX, footY - 2, false);
  drawLeg(cx + 8, footY - 56, rFootX, footY + 2, true);

  // Billowing Asymmetric Crimson Cloak Mantle sweeping behind warrior stride
  ctx.beginPath();
  ctx.moveTo(cx - 22, footY - 98);
  ctx.bezierCurveTo(cx - 52, footY - 72, cx - 54, footY - 30, cx - 40, footY - 12);
  ctx.lineTo(cx - 16, footY - 26);
  ctx.lineTo(cx + 4, footY - 18);
  ctx.quadraticCurveTo(cx + 26, footY - 54, cx + 20, footY - 96);
  ctx.closePath();
  const cloakGrad = ctx.createLinearGradient(cx - 50, footY - 98, cx + 22, footY - 14);
  cloakGrad.addColorStop(0, '#e82334');
  cloakGrad.addColorStop(0.55, '#961022');
  cloakGrad.addColorStop(1, '#3b0612');
  ctx.fillStyle = cloakGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Sleek Tapered Obsidian Warrior Chiton (broad shoulders -> athletic narrow waist -> pleated battle-skirt!)
  ctx.beginPath();
  ctx.moveTo(cx - 20, footY - 98);
  ctx.lineTo(cx + 20, footY - 98);
  ctx.lineTo(cx + 13, footY - 64); // narrow athletic waist!
  ctx.lineTo(cx + 22, footY - 40); // flared battle skirt
  ctx.lineTo(cx + 6, footY - 46);
  ctx.lineTo(cx - 22, footY - 40);
  ctx.lineTo(cx - 13, footY - 64);
  ctx.closePath();
  const tunicGrad = ctx.createLinearGradient(cx - 20, footY - 98, cx + 20, footY - 40);
  tunicGrad.addColorStop(0, '#3a3248');
  tunicGrad.addColorStop(0.55, '#191424');
  tunicGrad.addColorStop(1, '#090710');
  ctx.fillStyle = tunicGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();

  // Gold filigree hem & sculpted diagonal crimson chest-drape
  ctx.strokeStyle = '#f2be4c';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - 20, footY - 44);
  ctx.lineTo(cx + 20, footY - 44);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 22, footY - 98);
  ctx.lineTo(cx + 4, footY - 92);
  ctx.lineTo(cx + 18, footY - 60);
  ctx.lineTo(cx - 15, footY - 64);
  ctx.closePath();
  ctx.fillStyle = isUp ? '#8a1020' : '#df2234';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  // Sculpted Burnished-Gold Skull Shoulder Pauldron (angled heroically!)
  const px = isSide ? cx - 6 : cx - 20;
  const py = footY - 96;
  ctx.beginPath();
  ctx.moveTo(px - 18, py + 8);
  ctx.bezierCurveTo(px - 22, py - 14, px + 6, py - 19, px + 16, py - 4);
  ctx.bezierCurveTo(px + 15, py + 12, px - 5, py + 14, px - 18, py + 8);
  ctx.closePath();
  const paulGrad = ctx.createLinearGradient(px - 16, py - 14, px + 16, py + 12);
  paulGrad.addColorStop(0, '#fff4b8');
  paulGrad.addColorStop(0.45, '#eba934');
  paulGrad.addColorStop(1, '#63370c');
  ctx.fillStyle = paulGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  // Refined 3/4 Angular Warrior Head & Neck (sleek heroic chin, NEVER a flat square!)
  const headY = footY - 118;
  ctx.fillStyle = '#a86b4c';
  ctx.fillRect(cx - 5, headY + 10, 10, 10);

  ctx.beginPath();
  ctx.moveTo(cx - 12, headY - 12);
  ctx.quadraticCurveTo(cx, headY - 20, cx + 13, headY - 10);
  ctx.lineTo(cx + 12, headY + 6);
  ctx.quadraticCurveTo(cx + 4, headY + 18, cx - 2, headY + 17);
  ctx.quadraticCurveTo(cx - 12, headY + 12, cx - 12, headY - 12);
  ctx.closePath();
  ctx.fillStyle = isUp ? '#171222' : '#e4aa84';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  if (!isUp) {
    // Bold sharp comic brow shadow + gleaming crimson/emerald warrior eyes!
    const exOff = isSide ? 4 : 1;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx - 9 + exOff, headY - 4);
    ctx.lineTo(cx - 1 + exOff, headY - 2);
    ctx.lineTo(cx - 8 + exOff, headY + 1);
    ctx.closePath();
    ctx.moveTo(cx + 10 + exOff, headY - 4);
    ctx.lineTo(cx + 2 + exOff, headY - 2);
    ctx.lineTo(cx + 9 + exOff, headY + 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff3636';
    ctx.fillRect(cx - 7 + exOff, headY - 2, 3, 2);
    ctx.fillStyle = '#48ffa6';
    ctx.fillRect(cx + 4 + exOff, headY - 2, 3, 2);
  }

  // Wild Layered Raven-Black Spiky Underworld Prince Hair w/ Fiery Ember Underglow!
  ctx.beginPath();
  ctx.moveTo(cx - 16, headY + 4);
  ctx.lineTo(cx - 32, headY - 8);
  ctx.lineTo(cx - 18, headY - 12);
  ctx.lineTo(cx - 34, headY - 26);
  ctx.lineTo(cx - 14, headY - 22);
  ctx.lineTo(cx - 18, headY - 42);
  ctx.lineTo(cx - 2, headY - 26);
  ctx.lineTo(cx + 8, headY - 44);
  ctx.lineTo(cx + 14, headY - 24);
  ctx.lineTo(cx + 32, headY - 30);
  ctx.lineTo(cx + 20, headY - 14);
  ctx.lineTo(cx + 30, headY - 6);
  ctx.lineTo(cx + 14, headY - 2);
  ctx.quadraticCurveTo(cx + 2, headY - 14, cx - 16, headY + 4);
  ctx.closePath();
  const hairGrad = ctx.createLinearGradient(cx, headY - 44, cx, headY + 2);
  hairGrad.addColorStop(0, '#ff5c28');
  hairGrad.addColorStop(0.24, '#24172b');
  hairGrad.addColorStop(1, '#0a0712');
  ctx.fillStyle = hairGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  // Gleaming Gold Laurel Wreath woven delicately around temple
  ctx.fillStyle = '#ffd84d';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  for (let i = -3; i <= 3; i++) {
    const a = -Math.PI * 0.5 + i * 0.3;
    const lx = cx + Math.cos(a) * 16;
    const ly = headY - 10 + Math.sin(a) * 12;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 4.8, 2.2, a + 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawWeapons(ctx: CanvasRenderingContext2D): void {
  // Stygian Blade (sleek tapered leaf-bladed mythic short-sword w/ obsidian fuller & rune edge!)
  withCell(ctx, 'weapon_stygian_blade', (c, w, h) => {
    const cy = h * 0.5;
    // Sleek Greek xiphos leaf-blade silhouette tapering to deadly needle point!
    c.beginPath();
    c.moveTo(34, cy - 7);
    c.quadraticCurveTo(w * 0.58, cy - 13, w - 34, cy - 10);
    c.lineTo(w - 4, cy);
    c.lineTo(w - 34, cy + 10);
    c.quadraticCurveTo(w * 0.58, cy + 13, 34, cy + 7);
    c.closePath();
    const bGrad = c.createLinearGradient(34, cy - 12, w - 4, cy + 12);
    bGrad.addColorStop(0, '#f2f6ff');
    bGrad.addColorStop(0.38, '#9aa8bd');
    bGrad.addColorStop(0.62, '#2f3647');
    bGrad.addColorStop(1, '#12151f');
    c.fillStyle = bGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();

    // Central recessed obsidian blood-fuller & glowing crimson ember edge streak
    c.strokeStyle = '#ff3838';
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(42, cy);
    c.lineTo(w - 28, cy);
    c.stroke();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(44, cy - 6);
    c.lineTo(w - 16, cy - 2);
    c.stroke();

    // Angled winged burnished-gold crossguard & wrapped crimson hilt
    c.fillStyle = '#e8ae3c';
    c.beginPath();
    c.moveTo(28, cy - 20);
    c.lineTo(42, cy - 11);
    c.lineTo(39, cy);
    c.lineTo(42, cy + 11);
    c.lineTo(28, cy + 20);
    c.lineTo(32, cy);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();

    c.fillStyle = '#751520';
    c.fillRect(10, cy - 4, 21, 8);
    c.strokeRect(10, cy - 4, 21, 8);
    c.beginPath();
    c.arc(9, cy, 6.5, 0, Math.PI * 2);
    c.fillStyle = '#f2be4c';
    c.fill();
    c.stroke();
  });

  // Eternal Spear
  withCell(ctx, 'weapon_eternal_spear', (c, w, h) => {
    const cy = h * 0.5;
    c.fillStyle = '#7a1c28';
    c.fillRect(10, cy - 4, w - 58, 8);
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.strokeRect(10, cy - 4, w - 58, 8);

    // Ornate golden spearhead
    c.beginPath();
    c.moveTo(w - 52, cy - 12);
    c.lineTo(w - 6, cy);
    c.lineTo(w - 52, cy + 12);
    c.lineTo(w - 42, cy);
    c.closePath();
    c.fillStyle = '#f5ca64';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();
  });

  // Shield of Chaos
  withCell(ctx, 'weapon_shield_of_chaos', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.beginPath();
    c.arc(cx, cy, 38, 0, Math.PI * 2);
    const sGrad = c.createRadialGradient(cx - 10, cy - 10, 6, cx, cy, 38);
    sGrad.addColorStop(0, '#5a3846');
    sGrad.addColorStop(0.7, '#241825');
    sGrad.addColorStop(1, '#120b14');
    c.fillStyle = sGrad;
    c.fill();
    c.strokeStyle = '#ebb446';
    c.lineWidth = 7;
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 3.5;
    c.stroke();
    // Glowing chaos eye core
    c.fillStyle = '#ff384c';
    c.beginPath();
    c.ellipse(cx, cy, 14, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  });

  // Heart-Seeking Bow
  withCell(ctx, 'weapon_heart_seeking_bow', (c, w, h) => {
    const cx = w * 0.45;
    const cy = h * 0.5;
    c.strokeStyle = '#ffda78';
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(cx - 14, 14);
    c.lineTo(cx - 14, h - 14);
    c.stroke();

    c.strokeStyle = INK;
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(cx - 14, 12);
    c.quadraticCurveTo(cx + 36, cy, cx - 14, h - 12);
    c.stroke();

    c.strokeStyle = '#e5a840';
    c.lineWidth = 6.5;
    c.stroke();
  });

  // Twin Fists
  withCell(ctx, 'weapon_twin_fists', (c, w, h) => {
    const drawGauntlet = (gx: number, gy: number) => {
      c.beginPath();
      c.roundRect(gx - 18, gy - 14, 36, 28, 9);
      c.fillStyle = '#d48d3b';
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3.5;
      c.stroke();
      c.fillStyle = '#ff3d4c';
      c.beginPath();
      c.arc(gx + 6, gy, 6, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    };
    drawGauntlet(w * 0.34, h * 0.38);
    drawGauntlet(w * 0.66, h * 0.62);
  });

  // Adamant Rail
  withCell(ctx, 'weapon_adamant_rail', (c, w, h) => {
    const cy = h * 0.5;
    c.fillStyle = '#2d2838';
    c.beginPath();
    c.roundRect(14, cy - 12, w - 26, 22, 6);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();
    c.fillStyle = '#e6ad42';
    c.fillRect(36, cy - 14, 54, 7);
    c.fillStyle = '#ff5e28';
    c.fillRect(w - 50, cy - 5, 32, 8);
  });
}

function drawEnemiesAndBosses(ctx: CanvasRenderingContext2D): void {
  // 1. Numbskull: Inked horned skull w/ glowing violet jaw
  withCell(ctx, 'enemy_numbskull', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.52;

    // Spectral violet flame aura beneath jaw
    const aura = c.createRadialGradient(cx, cy + 18, 4, cx, cy + 14, 42);
    aura.addColorStop(0, '#f299ff');
    aura.addColorStop(0.5, '#9d2bff');
    aura.addColorStop(1, 'rgba(92, 16, 160, 0)');
    c.fillStyle = aura;
    c.beginPath();
    c.arc(cx, cy + 12, 42, 0, Math.PI * 2);
    c.fill();

    // Swept obsidian devil horns
    c.fillStyle = '#312340';
    c.beginPath();
    c.moveTo(cx - 22, cy - 16);
    c.quadraticCurveTo(cx - 46, cy - 36, cx - 32, cy - 52);
    c.quadraticCurveTo(cx - 26, cy - 34, cx - 10, cy - 26);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();

    c.beginPath();
    c.moveTo(cx + 22, cy - 16);
    c.quadraticCurveTo(cx + 46, cy - 36, cx + 32, cy - 52);
    c.quadraticCurveTo(cx + 26, cy - 34, cx + 10, cy - 26);
    c.closePath();
    c.fill();
    c.stroke();

    // Cranium
    c.beginPath();
    c.moveTo(cx - 28, cy - 4);
    c.quadraticCurveTo(cx - 30, cy - 34, cx, cy - 34);
    c.quadraticCurveTo(cx + 30, cy - 34, cx + 28, cy - 4);
    c.lineTo(cx + 20, cy + 16);
    c.lineTo(cx + 12, cy + 28);
    c.lineTo(cx - 12, cy + 28);
    c.lineTo(cx - 20, cy + 16);
    c.closePath();
    const skGrad = c.createLinearGradient(cx - 28, cy - 34, cx + 28, cy + 28);
    skGrad.addColorStop(0, '#f7ecff');
    skGrad.addColorStop(0.5, '#c4b1d9');
    skGrad.addColorStop(1, '#574270');
    c.fillStyle = skGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.2;
    c.stroke();

    // Glowing violet eye sockets
    c.fillStyle = '#12081c';
    c.beginPath();
    c.ellipse(cx - 11, cy - 4, 8, 9, -0.2, 0, Math.PI * 2);
    c.ellipse(cx + 11, cy - 4, 8, 9, 0.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ff54ff';
    c.beginPath();
    c.arc(cx - 11, cy - 3, 4.2, 0, Math.PI * 2);
    c.arc(cx + 11, cy - 3, 4.2, 0, Math.PI * 2);
    c.fill();

    // Jagged inked teeth
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx - 14, cy + 16);
    c.lineTo(cx + 14, cy + 16);
    for (let tx = -8; tx <= 8; tx += 8) {
      c.moveTo(cx + tx, cy + 12);
      c.lineTo(cx + tx, cy + 26);
    }
    c.stroke();
  });

  // 2. Wretched Husk: Hulking emerald-hooded armored club wretch
  withCell(ctx, 'enemy_wretched_husk', (c, w, h) => {
    const cx = w * 0.48;
    const baseY = h * 0.87;

    // Massive spiked obsidian war-club on right
    c.save();
    c.translate(cx + 42, baseY - 78);
    c.rotate(0.28);
    c.beginPath();
    c.moveTo(-8, 52);
    c.lineTo(-16, -42);
    c.lineTo(16, -46);
    c.lineTo(10, 52);
    c.closePath();
    const clubGrad = c.createLinearGradient(-16, -44, 16, 44);
    clubGrad.addColorStop(0, '#5d6b75');
    clubGrad.addColorStop(0.5, '#2b323b');
    clubGrad.addColorStop(1, '#11141a');
    c.fillStyle = clubGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
    // Club spikes
    c.fillStyle = '#d9a44b';
    for (const sy of [-34, -14, 6]) {
      c.beginPath();
      c.moveTo(12, sy - 5);
      c.lineTo(24, sy);
      c.lineTo(12, sy + 5);
      c.closePath();
      c.fill();
      c.stroke();
    }
    c.restore();

    // Hulking emerald hooded cloak body
    c.beginPath();
    c.moveTo(cx - 46, baseY);
    c.quadraticCurveTo(cx - 56, baseY - 76, cx - 34, baseY - 122);
    c.quadraticCurveTo(cx, baseY - 160, cx + 36, baseY - 120);
    c.quadraticCurveTo(cx + 54, baseY - 74, cx + 44, baseY);
    c.lineTo(cx + 18, baseY - 10);
    c.lineTo(cx, baseY + 4);
    c.lineTo(cx - 22, baseY - 10);
    c.closePath();
    const robeGrad = c.createLinearGradient(cx - 50, baseY - 150, cx + 50, baseY);
    robeGrad.addColorStop(0, '#4bb382');
    robeGrad.addColorStop(0.45, '#1f5e4b');
    robeGrad.addColorStop(1, '#0d2624');
    c.fillStyle = robeGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.6;
    c.stroke();

    // Armored bronze shoulder pauldrons
    c.fillStyle = '#c49043';
    c.beginPath();
    c.ellipse(cx - 34, baseY - 104, 22, 16, -0.35, 0, Math.PI * 2);
    c.ellipse(cx + 34, baseY - 104, 22, 16, 0.35, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();

    // Deep hooded shadow cavity & glowing amber eyes
    c.fillStyle = '#08060d';
    c.beginPath();
    c.ellipse(cx, baseY - 118, 22, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#6cf0ae';
    c.lineWidth = 2.6;
    c.stroke();

    c.fillStyle = '#ffaa2b';
    c.beginPath();
    c.moveTo(cx - 13, baseY - 120);
    c.lineTo(cx - 4, baseY - 116);
    c.lineTo(cx - 12, baseY - 113);
    c.closePath();
    c.moveTo(cx + 13, baseY - 120);
    c.lineTo(cx + 4, baseY - 116);
    c.lineTo(cx + 12, baseY - 113);
    c.closePath();
    c.fill();
  });

  // 3. Bone Archer: Sinister hooded skeletal ranger drawing crystalline longbow!
  withCell(ctx, 'enemy_bone_archer', (c, w, h) => {
    const cx = w * 0.42;
    const baseY = h * 0.86;

    // Billowing tattered dark indigo-emerald assassin cloak with jagged tails
    c.beginPath();
    c.moveTo(cx - 34, baseY - 6);
    c.lineTo(cx - 44, baseY - 44);
    c.quadraticCurveTo(cx - 38, baseY - 104, cx - 22, baseY - 134);
    c.quadraticCurveTo(cx, baseY - 166, cx + 22, baseY - 130);
    c.lineTo(cx + 30, baseY - 64);
    c.lineTo(cx + 22, baseY - 4);
    c.lineTo(cx + 6, baseY - 26);
    c.lineTo(cx - 8, baseY + 2);
    c.lineTo(cx - 20, baseY - 22);
    c.closePath();
    const aGrad = c.createLinearGradient(cx - 42, baseY - 160, cx + 32, baseY);
    aGrad.addColorStop(0, '#3e6d8a');
    aGrad.addColorStop(0.5, '#1d2d4a');
    aGrad.addColorStop(1, '#0b0e1c');
    c.fillStyle = aGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.2;
    c.stroke();

    // Exposed inked ivory ribcage & dark bronze quiver strap
    c.fillStyle = '#110d1a';
    c.beginPath();
    c.ellipse(cx + 2, baseY - 84, 15, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#dce8f2';
    c.lineWidth = 3.2;
    for (const ry of [-96, -86, -76]) {
      c.beginPath();
      c.moveTo(cx - 10, baseY + ry);
      c.quadraticCurveTo(cx + 2, baseY + ry - 4, cx + 14, baseY + ry);
      c.stroke();
    }

    // Shadowed pointed cowl cavity + angular grinning skeletal skull & glowing cyan eyes
    c.fillStyle = '#07050c';
    c.beginPath();
    c.ellipse(cx + 2, baseY - 126, 18, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e5f2fa';
    c.beginPath();
    c.moveTo(cx - 11, baseY - 130);
    c.quadraticCurveTo(cx + 2, baseY - 144, cx + 14, baseY - 128);
    c.lineTo(cx + 10, baseY - 110);
    c.lineTo(cx - 6, baseY - 110);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = '#38fff4';
    c.beginPath();
    c.moveTo(cx - 6, baseY - 128);
    c.lineTo(cx, baseY - 124);
    c.lineTo(cx - 5, baseY - 122);
    c.closePath();
    c.moveTo(cx + 11, baseY - 128);
    c.lineTo(cx + 4, baseY - 124);
    c.lineTo(cx + 10, baseY - 122);
    c.closePath();
    c.fill();

    // Skeletal bow-arm reaching forward + ornate curved bone-and-crystal recurve longbow!
    c.strokeStyle = '#dce8f2';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(cx + 12, baseY - 96);
    c.lineTo(cx + 42, baseY - 92);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();

    c.strokeStyle = INK;
    c.lineWidth = 11;
    c.beginPath();
    c.moveTo(cx + 26, baseY - 146);
    c.bezierCurveTo(cx + 68, baseY - 122, cx + 68, baseY - 62, cx + 26, baseY - 38);
    c.stroke();
    c.strokeStyle = '#52f0ff';
    c.lineWidth = 5;
    c.stroke();

    // Taut bowstring + glowing nocked energy arrow!
    c.strokeStyle = '#d6ffff';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx + 26, baseY - 144);
    c.lineTo(cx + 10, baseY - 92);
    c.lineTo(cx + 26, baseY - 40);
    c.stroke();
    c.strokeStyle = '#70ffff';
    c.lineWidth = 3.8;
    c.beginPath();
    c.moveTo(cx + 10, baseY - 92);
    c.lineTo(cx + 66, baseY - 92);
    c.stroke();
  });

  // 4. Brimstone Crystal: Floating crimson-gold geometric laser obelisk
  withCell(ctx, 'enemy_brimstone_crystal', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.48;

    // Crimson aura behind crystal
    const glow = c.createRadialGradient(cx, cy, 8, cx, cy, 56);
    glow.addColorStop(0, 'rgba(255, 110, 60, 0.85)');
    glow.addColorStop(1, 'rgba(255, 20, 40, 0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(cx, cy, 56, 0, Math.PI * 2);
    c.fill();

    // Faceted main crystal obelisk
    c.beginPath();
    c.moveTo(cx, cy - 68);
    c.lineTo(cx + 34, cy - 12);
    c.lineTo(cx + 22, cy + 56);
    c.lineTo(cx, cy + 72);
    c.lineTo(cx - 22, cy + 56);
    c.lineTo(cx - 34, cy - 12);
    c.closePath();
    const crGrad = c.createLinearGradient(cx - 34, cy - 68, cx + 34, cy + 72);
    crGrad.addColorStop(0, '#ff8e5c');
    crGrad.addColorStop(0.45, '#d62235');
    crGrad.addColorStop(1, '#4a0b1b');
    c.fillStyle = crGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.4;
    c.stroke();

    // Gold geometric bands & laser core eye
    c.strokeStyle = '#f5c04e';
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(cx, cy - 64);
    c.lineTo(cx, cy + 68);
    c.moveTo(cx - 32, cy - 12);
    c.lineTo(cx + 32, cy - 12);
    c.stroke();

    c.fillStyle = '#fff5b8';
    c.beginPath();
    c.ellipse(cx, cy - 4, 13, 18, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();

    // Orbiting dark obsidian shards
    for (const [ox, oy] of [
      [-46, -24],
      [46, 18],
    ]) {
      c.fillStyle = '#241a29';
      c.beginPath();
      c.moveTo(cx + ox, cy + oy - 14);
      c.lineTo(cx + ox + 10, cy + oy);
      c.lineTo(cx + ox, cy + oy + 14);
      c.lineTo(cx + ox - 10, cy + oy);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.stroke();
    }
  });

  // 5. Ember Lout: Heavy armored magma-core brute
  withCell(ctx, 'enemy_ember_lout', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.86;

    // Massive volcanic carapace shoulders
    c.beginPath();
    c.moveTo(cx - 58, baseY - 12);
    c.quadraticCurveTo(cx - 72, baseY - 78, cx - 36, baseY - 118);
    c.lineTo(cx + 36, baseY - 118);
    c.quadraticCurveTo(cx + 72, baseY - 78, cx + 58, baseY - 12);
    c.lineTo(cx + 26, baseY);
    c.lineTo(cx - 26, baseY);
    c.closePath();
    const lGrad = c.createLinearGradient(cx - 64, baseY - 120, cx + 64, baseY);
    lGrad.addColorStop(0, '#4f3a3c');
    lGrad.addColorStop(0.5, '#261a20');
    lGrad.addColorStop(1, '#120b10');
    c.fillStyle = lGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.6;
    c.stroke();

    // Blazing molten magma chest fissures
    c.fillStyle = '#ff5e1a';
    c.beginPath();
    c.moveTo(cx - 26, baseY - 76);
    c.lineTo(cx, baseY - 94);
    c.lineTo(cx + 26, baseY - 76);
    c.lineTo(cx + 14, baseY - 38);
    c.lineTo(cx, baseY - 26);
    c.lineTo(cx - 14, baseY - 38);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffe97a';
    c.beginPath();
    c.ellipse(cx, baseY - 62, 12, 16, 0, 0, Math.PI * 2);
    c.fill();

    // Horned iron helm
    c.fillStyle = '#382a33';
    c.beginPath();
    c.arc(cx, baseY - 114, 22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
    // Glowing eyes
    c.fillStyle = '#ffda42';
    c.fillRect(cx - 11, baseY - 116, 7, 4);
    c.fillRect(cx + 4, baseY - 116, 7, 4);
  });

  // 6. Rattlebones Training Dummy: Expressive grinning skeleton warrior mannequin (no googly dots!)
  withCell(ctx, 'enemy_rattlebones_dummy', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.89;

    // Staked oak training post & iron-banded base block
    c.fillStyle = '#5e391f';
    c.beginPath();
    c.ellipse(cx, baseY, 34, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();

    c.fillStyle = '#6e4526';
    c.fillRect(cx - 8, baseY - 128, 16, 124);
    c.strokeRect(cx - 8, baseY - 128, 16, 124);

    // Tattered burgundy sparring scarf draped over wooden crossbar
    c.fillStyle = '#8c1d2c';
    c.beginPath();
    c.moveTo(cx - 34, baseY - 102);
    c.lineTo(cx + 34, baseY - 102);
    c.lineTo(cx + 42, baseY - 72);
    c.lineTo(cx + 22, baseY - 82);
    c.lineTo(cx - 24, baseY - 78);
    c.lineTo(cx - 42, baseY - 68);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();

    // Weathered iron-riveted oak bullseye practice plaque strapped across ribcage
    c.fillStyle = '#a86e39';
    c.beginPath();
    c.arc(cx, baseY - 76, 26, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = '#b8212e';
    c.beginPath();
    c.arc(cx, baseY - 76, 17, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#efe0c2';
    c.beginPath();
    c.arc(cx, baseY - 76, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#b8212e';
    c.beginPath();
    c.arc(cx, baseY - 76, 4, 0, Math.PI * 2);
    c.fill();

    // Sculpted angular grinning skull (cheekbones + toothed jaw + angled hollow emerald eye sockets!)
    const sy = baseY - 128;
    c.fillStyle = '#f2e5c9';
    c.beginPath();
    c.moveTo(cx - 20, sy - 10);
    c.quadraticCurveTo(cx, sy - 28, cx + 20, sy - 10);
    c.lineTo(cx + 22, sy + 4);
    c.lineTo(cx + 13, sy + 18);
    c.lineTo(cx - 13, sy + 18);
    c.lineTo(cx - 22, sy + 4);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();

    // Fierce jaunty angled hollow eye sockets (NOT googly circles!) + glowing emerald flames
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(cx - 15, sy - 6);
    c.lineTo(cx - 3, sy - 1);
    c.lineTo(cx - 6, sy + 5);
    c.lineTo(cx - 15, sy + 2);
    c.closePath();
    c.moveTo(cx + 15, sy - 6);
    c.lineTo(cx + 3, sy - 1);
    c.lineTo(cx + 6, sy + 5);
    c.lineTo(cx + 15, sy + 2);
    c.closePath();
    c.fill();
    c.fillStyle = '#48ffa2';
    c.fillRect(cx - 11, sy - 2, 4, 3);
    c.fillRect(cx + 7, sy - 2, 4, 3);

    // Grinning inked teeth
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(cx - 11, sy + 11);
    c.lineTo(cx + 11, sy + 11);
    for (const tx of [-6, 0, 6]) {
      c.moveTo(cx + tx, sy + 8);
      c.lineTo(cx + tx, sy + 17);
    }
    c.stroke();

    // Tilted battered bronze Spartan warrior helmet & torn crimson crest plume!
    c.save();
    c.translate(cx, sy - 12);
    c.rotate(-0.14);
    c.fillStyle = '#d99e3e';
    c.beginPath();
    c.arc(0, 0, 22, Math.PI * 1.05, -0.05);
    c.lineTo(20, 8);
    c.lineTo(10, 0);
    c.lineTo(0, 6);
    c.lineTo(-10, 0);
    c.lineTo(-20, 8);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();
    c.fillStyle = '#cf2232';
    c.beginPath();
    c.moveTo(-6, -22);
    c.quadraticCurveTo(22, -40, 26, -12);
    c.quadraticCurveTo(10, -18, -6, -22);
    c.fill();
    c.stroke();
    c.restore();
  });

  // 7. Generic Armored Shade (clean fallback for Wave 2 archetypes)
  withCell(ctx, 'enemy_generic_shade', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.85;
    c.beginPath();
    c.moveTo(cx - 34, baseY);
    c.quadraticCurveTo(cx - 42, baseY - 76, cx - 22, baseY - 124);
    c.quadraticCurveTo(cx, baseY - 152, cx + 22, baseY - 124);
    c.quadraticCurveTo(cx + 42, baseY - 76, cx + 34, baseY);
    c.closePath();
    const g = c.createLinearGradient(cx - 34, baseY - 140, cx + 34, baseY);
    g.addColorStop(0, '#725c94');
    g.addColorStop(0.5, '#34264a');
    g.addColorStop(1, '#120d1c');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.2;
    c.stroke();
    c.fillStyle = '#ff6b57';
    c.beginPath();
    c.arc(cx - 8, baseY - 114, 4, 0, Math.PI * 2);
    c.arc(cx + 8, baseY - 114, 4, 0, Math.PI * 2);
    c.fill();
  });

  // 8. WARDEN MALICE (BOSS): Gothic dark-ink winged Fury warrior (asymmetric dramatic silhouette!)
  withCell(ctx, 'boss_warden_malice', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.87;

    // Moody violet-crimson underworld backlight aura
    const halo = c.createRadialGradient(cx, baseY - 152, 10, cx, baseY - 152, 92);
    halo.addColorStop(0, 'rgba(198, 28, 138, 0.48)');
    halo.addColorStop(0.58, 'rgba(72, 12, 74, 0.2)');
    halo.addColorStop(1, 'rgba(14, 4, 22, 0)');
    c.fillStyle = halo;
    c.beginPath();
    c.arc(cx, baseY - 152, 92, 0, Math.PI * 2);
    c.fill();

    // Layered Gothic Razor-Ribbed Obsidian Fury Wings (asymmetric 3/4 flare + comic cross-hatching!)
    const drawGothicWing = (dir: -1 | 1, spreadX: number, liftY: number) => {
      c.save();
      c.beginPath();
      c.moveTo(cx + dir * 14, baseY - 148);
      c.bezierCurveTo(cx + dir * (66 * spreadX), baseY - (236 + liftY), cx + dir * (114 * spreadX), baseY - (222 + liftY), cx + dir * (142 * spreadX), baseY - (184 + liftY * 0.6));
      c.quadraticCurveTo(cx + dir * (116 * spreadX), baseY - 148, cx + dir * (126 * spreadX), baseY - 110);
      c.quadraticCurveTo(cx + dir * (92 * spreadX), baseY - 128, cx + dir * (88 * spreadX), baseY - 82);
      c.quadraticCurveTo(cx + dir * (56 * spreadX), baseY - 108, cx + dir * (46 * spreadX), baseY - 62);
      c.lineTo(cx + dir * 14, baseY - 102);
      c.closePath();

      const wGrad = c.createLinearGradient(cx, baseY - 230, cx + dir * 138, baseY - 66);
      wGrad.addColorStop(0, '#46155e');
      wGrad.addColorStop(0.45, '#1c0929');
      wGrad.addColorStop(1, '#08030f');
      c.fillStyle = wGrad;
      c.fill();

      c.clip();
      // Wing bone struts & gothic cross-hatching inside membrane shadows
      drawCrossHatch(c, cx + (dir < 0 ? -145 : 10), baseY - 230, 140, 175, 9, dir * 0.55, 'rgba(6, 3, 12, 0.52)', 1.5);
      c.strokeStyle = '#090410';
      c.lineWidth = 4.5;
      c.beginPath();
      c.moveTo(cx + dir * 24, baseY - 150);
      c.lineTo(cx + dir * (118 * spreadX), baseY - 114);
      c.moveTo(cx + dir * 24, baseY - 146);
      c.lineTo(cx + dir * (84 * spreadX), baseY - 84);
      c.stroke();
      c.restore();

      // Bold outer ink wing edge + crimson-magenta rim highlight along upper bone spur!
      c.beginPath();
      c.moveTo(cx + dir * 14, baseY - 148);
      c.bezierCurveTo(cx + dir * (66 * spreadX), baseY - (236 + liftY), cx + dir * (114 * spreadX), baseY - (222 + liftY), cx + dir * (142 * spreadX), baseY - (184 + liftY * 0.6));
      c.quadraticCurveTo(cx + dir * (116 * spreadX), baseY - 148, cx + dir * (126 * spreadX), baseY - 110);
      c.quadraticCurveTo(cx + dir * (92 * spreadX), baseY - 128, cx + dir * (88 * spreadX), baseY - 82);
      c.quadraticCurveTo(cx + dir * (56 * spreadX), baseY - 108, cx + dir * (46 * spreadX), baseY - 62);
      c.lineTo(cx + dir * 14, baseY - 102);
      c.closePath();
      c.strokeStyle = INK;
      c.lineWidth = 4.8;
      c.stroke();

      c.strokeStyle = '#ff3898';
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(cx + dir * 20, baseY - 150);
      c.bezierCurveTo(cx + dir * (68 * spreadX), baseY - (228 + liftY), cx + dir * (112 * spreadX), baseY - (214 + liftY), cx + dir * (138 * spreadX), baseY - (182 + liftY * 0.6));
      c.stroke();
    };
    drawGothicWing(-1, 1.04, 10);
    drawGothicWing(1, 0.94, -4);

    // Armored Warrior Legs & Thigh-High Obsidian Boots (sleek athletic silhouette, NO triangle dress!)
    for (const [lx, rx] of [
      [cx - 18, cx - 5],
      [cx + 6, cx + 22],
    ]) {
      c.fillStyle = '#190c24';
      c.beginPath();
      c.moveTo(lx, baseY - 76);
      c.lineTo(rx, baseY - 76);
      c.lineTo(rx + 2, baseY + 2);
      c.lineTo(lx - 2, baseY + 2);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3.8;
      c.stroke();
    }

    // Flowing Asymmetric Tattered Crimson-Violet Battle Cloak & Hip Tassets
    c.beginPath();
    c.moveTo(cx - 24, baseY - 104);
    c.lineTo(cx + 22, baseY - 104);
    c.bezierCurveTo(cx + 46, baseY - 64, cx + 56, baseY - 26, cx + 44, baseY + 4);
    c.lineTo(cx + 24, baseY - 26);
    c.lineTo(cx + 2, baseY - 46);
    c.lineTo(cx - 22, baseY - 16);
    c.lineTo(cx - 46, baseY - 2);
    c.bezierCurveTo(cx - 48, baseY - 46, cx - 34, baseY - 78, cx - 24, baseY - 104);
    c.closePath();
    const cloakG = c.createLinearGradient(cx - 44, baseY - 104, cx + 48, baseY);
    cloakG.addColorStop(0, '#96123e');
    cloakG.addColorStop(0.55, '#420926');
    cloakG.addColorStop(1, '#120414');
    c.fillStyle = cloakG;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.4;
    c.stroke();

    // Sculpted Obsidian Armor Corset + Gold Filigree Trim & Spiked Collar
    c.fillStyle = '#1c0c26';
    c.beginPath();
    c.moveTo(cx - 22, baseY - 148);
    c.lineTo(cx + 22, baseY - 148);
    c.lineTo(cx + 14, baseY - 98);
    c.lineTo(cx, baseY - 88);
    c.lineTo(cx - 14, baseY - 98);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
    // Gold V-breastplate filigree
    c.strokeStyle = '#e5a93c';
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(cx - 16, baseY - 140);
    c.lineTo(cx, baseY - 104);
    c.lineTo(cx + 16, baseY - 140);
    c.stroke();

    // Swept Spiked Obsidian Pauldron (asymmetric left battle-shoulder!)
    c.fillStyle = '#2d123d';
    c.beginPath();
    c.moveTo(cx - 14, baseY - 146);
    c.lineTo(cx - 48, baseY - 158);
    c.lineTo(cx - 38, baseY - 130);
    c.lineTo(cx - 16, baseY - 132);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();

    // Crackling Coiled Barbed Fury Whip in Extended Right Hand!
    c.strokeStyle = INK;
    c.lineWidth = 8.5;
    c.beginPath();
    c.moveTo(cx + 26, baseY - 118);
    c.bezierCurveTo(cx + 124, baseY - 104, cx + 114, baseY - 10, cx + 44, baseY - 18);
    c.stroke();
    c.strokeStyle = '#ff2874';
    c.lineWidth = 3.4;
    c.stroke();

    // Fierce Pale 3/4 Warrior Face + Cascading Wild Dark-Violet Hair Locks
    const hy = baseY - 172;
    c.fillStyle = '#140721';
    c.beginPath();
    c.moveTo(cx - 26, hy + 28);
    c.bezierCurveTo(cx - 34, hy - 18, cx - 16, hy - 34, cx + 4, hy - 32);
    c.bezierCurveTo(cx + 26, hy - 30, cx + 36, hy + 4, cx + 24, hy + 44);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();

    c.fillStyle = '#dfd2eb';
    c.beginPath();
    c.moveTo(cx - 13, hy - 12);
    c.quadraticCurveTo(cx, hy - 20, cx + 13, hy - 12);
    c.lineTo(cx + 11, hy + 9);
    c.lineTo(cx - 1, hy + 19);
    c.lineTo(cx - 12, hy + 8);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();

    // Sweeping dark side-bang framing temple
    c.fillStyle = '#1b0a2b';
    c.beginPath();
    c.moveTo(cx - 14, hy - 14);
    c.quadraticCurveTo(cx + 4, hy - 24, cx + 18, hy - 6);
    c.lineTo(cx + 12, hy + 14);
    c.lineTo(cx + 6, hy - 6);
    c.closePath();
    c.fill();

    // Curved Swept Obsidian-and-Gold Twin Fury Horns (gothic & menacing, NO cartoon paper crown!)
    c.fillStyle = '#d99e36';
    c.strokeStyle = INK;
    c.lineWidth = 3.4;
    for (const dir of [-1, 1] as const) {
      c.beginPath();
      c.moveTo(cx + dir * 8, hy - 16);
      c.quadraticCurveTo(cx + dir * 28, hy - 30, cx + dir * 24, hy - 54);
      c.quadraticCurveTo(cx + dir * 16, hy - 34, cx + dir * 2, hy - 20);
      c.closePath();
      c.fill();
      c.stroke();
    }

    // Fierce blazing crimson Fury eyes
    c.fillStyle = '#ff1c5e';
    c.beginPath();
    c.moveTo(cx - 10, hy - 3);
    c.lineTo(cx - 2, hy);
    c.lineTo(cx - 9, hy + 2);
    c.closePath();
    c.moveTo(cx + 9, hy - 3);
    c.lineTo(cx + 2, hy);
    c.lineTo(cx + 8, hy + 2);
    c.closePath();
    c.fill();
  });

  // 9. Generic Titan Boss fallback
  withCell(ctx, 'boss_generic_titan', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.86;
    c.beginPath();
    c.moveTo(cx - 66, baseY);
    c.lineTo(cx - 78, baseY - 142);
    c.lineTo(cx - 26, baseY - 196);
    c.lineTo(cx + 26, baseY - 196);
    c.lineTo(cx + 78, baseY - 142);
    c.lineTo(cx + 66, baseY);
    c.closePath();
    const g = c.createLinearGradient(cx - 76, baseY - 200, cx + 76, baseY);
    g.addColorStop(0, '#8c3138');
    g.addColorStop(0.5, '#3b1520');
    g.addColorStop(1, '#120912');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.stroke();

    // Crowned skull crest
    c.fillStyle = '#f2be52';
    c.beginPath();
    c.moveTo(cx - 32, baseY - 198);
    c.lineTo(cx - 42, baseY - 242);
    c.lineTo(cx - 12, baseY - 214);
    c.lineTo(cx, baseY - 250);
    c.lineTo(cx + 12, baseY - 214);
    c.lineTo(cx + 42, baseY - 242);
    c.lineTo(cx + 32, baseY - 198);
    c.closePath();
    c.fill();
    c.stroke();

    c.fillStyle = '#ff6b2b';
    c.beginPath();
    c.arc(cx - 14, baseY - 166, 6, 0, Math.PI * 2);
    c.arc(cx + 14, baseY - 166, 6, 0, Math.PI * 2);
    c.fill();
  });
}

function drawPickupsAndSigils(ctx: CanvasRenderingContext2D): void {
  // Boon Orb
  withCell(ctx, 'vfx_boon_orb', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, 42);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#ffe074');
    g.addColorStop(0.75, '#e89d2c');
    g.addColorStop(1, 'rgba(232, 157, 44, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 42, 0, Math.PI * 2);
    c.fill();

    c.strokeStyle = '#fff1b0';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(cx, cy, 26, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx, cy, 30, 0, Math.PI * 2);
    c.stroke();
  });

  // Bloodstone Crystal
  withCell(ctx, 'vfx_bloodstone', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.beginPath();
    c.moveTo(cx, 6);
    c.lineTo(w - 12, cy);
    c.lineTo(cx, h - 6);
    c.lineTo(12, cy);
    c.closePath();
    const g = c.createLinearGradient(12, 6, w - 12, h - 6);
    g.addColorStop(0, '#ff9aa8');
    g.addColorStop(0.45, '#e61c3c');
    g.addColorStop(1, '#5c0719');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();
    c.strokeStyle = '#ffd2da';
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(cx, 13);
    c.lineTo(cx - 10, cy);
    c.lineTo(cx, h - 13);
    c.stroke();
  });

  // Centaur Heart
  withCell(ctx, 'vfx_centaur_heart', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.52;
    c.beginPath();
    c.moveTo(cx, cy + 28);
    c.bezierCurveTo(cx - 38, cy + 2, cx - 34, cy - 32, cx, cy - 12);
    c.bezierCurveTo(cx + 34, cy - 32, cx + 38, cy + 2, cx, cy + 28);
    c.closePath();
    const g = c.createLinearGradient(cx - 24, cy - 26, cx + 24, cy + 28);
    g.addColorStop(0, '#ff8e96');
    g.addColorStop(0.5, '#dc1f36');
    g.addColorStop(1, '#610918');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = '#f5ca64';
    c.lineWidth = 4;
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
  });

  // Gold Coin
  withCell(ctx, 'vfx_gold_coin', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.beginPath();
    c.arc(cx, cy, 24, 0, Math.PI * 2);
    const g = c.createLinearGradient(cx - 24, cy - 24, cx + 24, cy + 24);
    g.addColorStop(0, '#fff4a8');
    g.addColorStop(0.5, '#f2b838');
    g.addColorStop(1, '#8c5412');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, 15, 0, Math.PI * 2);
    c.strokeStyle = '#8c5412';
    c.lineWidth = 2.4;
    c.stroke();
  });

  // Darkness Orb
  withCell(ctx, 'vfx_darkness_orb', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.54;
    c.beginPath();
    c.moveTo(cx, 8);
    c.bezierCurveTo(cx + 30, cy - 4, cx + 28, cy + 30, cx, cy + 30);
    c.bezierCurveTo(cx - 28, cy + 30, cx - 30, cy - 4, cx, 8);
    c.closePath();
    const g = c.createRadialGradient(cx - 6, cy - 6, 3, cx, cy, 32);
    g.addColorStop(0, '#e39eff');
    g.addColorStop(0.45, '#7c28cc');
    g.addColorStop(1, '#1d0936');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();
  });

  // Pom of Power
  withCell(ctx, 'vfx_pom_icon', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.55;
    c.beginPath();
    c.arc(cx, cy, 26, 0, Math.PI * 2);
    c.fillStyle = '#cf1d36';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();
    // Crown stem
    c.fillStyle = '#e8b048';
    c.beginPath();
    c.moveTo(cx - 10, cy - 22);
    c.lineTo(cx - 14, cy - 34);
    c.lineTo(cx, cy - 28);
    c.lineTo(cx + 14, cy - 34);
    c.lineTo(cx + 10, cy - 22);
    c.closePath();
    c.fill();
    c.stroke();
    // Glistening ruby seeds
    c.fillStyle = '#ff9cb4';
    for (const [ox, oy] of [
      [-8, -2],
      [6, -6],
      [2, 8],
      [-6, 10],
    ]) {
      c.beginPath();
      c.arc(cx + ox, cy + oy, 3.6, 0, Math.PI * 2);
      c.fill();
    }
  });

  // Forge Hammer
  withCell(ctx, 'vfx_hammer_icon', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.save();
    c.translate(cx, cy);
    c.rotate(-0.55);
    c.fillStyle = '#804c24';
    c.fillRect(-5, -8, 10, 40);
    c.strokeStyle = INK;
    c.lineWidth = 3.4;
    c.strokeRect(-5, -8, 10, 40);
    c.fillStyle = '#f2c158';
    c.beginPath();
    c.roundRect(-24, -26, 48, 22, 5);
    c.fill();
    c.stroke();
    c.restore();
  });

  // Boss/Miniboss Skull Badge
  withCell(ctx, 'vfx_skull_badge', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.beginPath();
    c.arc(cx, cy - 4, 24, 0, Math.PI * 2);
    c.fillStyle = '#f5e8cc';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = '#ff2c42';
    c.beginPath();
    c.arc(cx - 9, cy - 6, 5.5, 0, Math.PI * 2);
    c.arc(cx + 9, cy - 6, 5.5, 0, Math.PI * 2);
    c.fill();
  });

  // Shop Purse
  withCell(ctx, 'vfx_shop_purse', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.58;
    c.fillStyle = '#7e2a4a';
    c.beginPath();
    c.arc(cx, cy, 24, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();
    c.fillStyle = '#f2c154';
    c.fillRect(cx - 12, cy - 26, 24, 8);
    c.strokeRect(cx - 12, cy - 26, 24, 8);
  });

  // Fountain Chalice
  withCell(ctx, 'vfx_fountain_chalice', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.52;
    c.fillStyle = '#48e6ff';
    c.beginPath();
    c.ellipse(cx, cy - 14, 22, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#d9a443';
    c.beginPath();
    c.moveTo(cx - 22, cy - 12);
    c.quadraticCurveTo(cx - 16, cy + 12, cx - 5, cy + 14);
    c.lineTo(cx - 14, cy + 30);
    c.lineTo(cx + 14, cy + 30);
    c.lineTo(cx + 5, cy + 14);
    c.quadraticCurveTo(cx + 16, cy + 12, cx + 22, cy - 12);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();
  });

  // Gemstone / Key / Nectar
  withCell(ctx, 'vfx_gemstone', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.beginPath();
    c.moveTo(cx, 8);
    c.lineTo(w - 10, cy - 6);
    c.lineTo(w - 16, h - 10);
    c.lineTo(16, h - 10);
    c.lineTo(10, cy - 6);
    c.closePath();
    c.fillStyle = '#38d9ff';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();
  });

  withCell(ctx, 'vfx_key', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.34;
    c.strokeStyle = '#c8cfd9';
    c.lineWidth = 8;
    c.beginPath();
    c.arc(cx, cy, 14, 0, Math.PI * 2);
    c.moveTo(cx, cy + 14);
    c.lineTo(cx, h - 12);
    c.moveTo(cx, h - 22);
    c.lineTo(cx + 14, h - 22);
    c.moveTo(cx, h - 12);
    c.lineTo(cx + 12, h - 12);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
  });

  withCell(ctx, 'vfx_nectar', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.58;
    c.fillStyle = '#ffae2b';
    c.beginPath();
    c.arc(cx, cy, 22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();
    c.fillStyle = '#ffe58f';
    c.fillRect(cx - 7, cy - 34, 14, 14);
    c.strokeRect(cx - 7, cy - 34, 14, 14);
  });

  // 10 Iconic Patron Sigil Medallions
  const patrons: readonly PatronId[] = [
    'voltaris',
    'tidebreaker',
    'aegira',
    'velouris',
    'sylvara',
    'bellum',
    'bacchion',
    'glaciera',
    'veloce',
    'abyssos',
  ];

  for (const patronId of patrons) {
    const def = PATRON_CONSTANTS[patronId];
    withCell(ctx, `sigil_${patronId}`, (c, w, h) => {
      const cx = w * 0.5;
      const cy = h * 0.5;

      // Glowing halo + dark obsidian bevel disc + patron colored ring
      const halo = c.createRadialGradient(cx, cy, 10, cx, cy, 42);
      halo.addColorStop(0, def.colorHex);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = halo;
      c.beginPath();
      c.arc(cx, cy, 42, 0, Math.PI * 2);
      c.fill();

      c.beginPath();
      c.arc(cx, cy, 31, 0, Math.PI * 2);
      c.fillStyle = '#14101e';
      c.fill();
      c.strokeStyle = def.colorHex;
      c.lineWidth = 4.5;
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 2.4;
      c.stroke();

      // Crisp patron emblem icon inside medallion
      c.fillStyle = def.colorHex;
      c.strokeStyle = INK;
      c.lineWidth = 3;

      switch (patronId) {
        case 'voltaris': {
          // Jagged lightning bolt
          c.beginPath();
          c.moveTo(cx + 6, cy - 22);
          c.lineTo(cx - 12, cy + 2);
          c.lineTo(cx + 1, cy + 2);
          c.lineTo(cx - 8, cy + 23);
          c.lineTo(cx + 14, cy - 3);
          c.lineTo(cx + 1, cy - 3);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        }
        case 'tidebreaker': {
          // Sea trident
          c.strokeStyle = def.colorHex;
          c.lineWidth = 5;
          c.beginPath();
          c.moveTo(cx, cy + 22);
          c.lineTo(cx, cy - 20);
          c.moveTo(cx - 14, cy - 16);
          c.lineTo(cx - 14, cy - 2);
          c.lineTo(cx + 14, cy - 2);
          c.lineTo(cx + 14, cy - 16);
          c.stroke();
          break;
        }
        case 'aegira': {
          // Owl-crested Aegis shield
          c.beginPath();
          c.moveTo(cx, cy - 20);
          c.lineTo(cx + 18, cy - 12);
          c.quadraticCurveTo(cx + 16, cy + 12, cx, cy + 22);
          c.quadraticCurveTo(cx - 16, cy + 12, cx - 18, cy - 12);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        }
        case 'velouris': {
          // Glowing passion heart-rose
          c.beginPath();
          c.moveTo(cx, cy + 18);
          c.bezierCurveTo(cx - 26, cy, cx - 22, cy - 22, cx, cy - 8);
          c.bezierCurveTo(cx + 22, cy - 22, cx + 26, cy, cx, cy + 18);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        }
        case 'sylvara': {
          // Hunting arrow & crescent
          c.strokeStyle = def.colorHex;
          c.lineWidth = 4.5;
          c.beginPath();
          c.moveTo(cx - 16, cy + 16);
          c.lineTo(cx + 16, cy - 16);
          c.moveTo(cx + 4, cy - 16);
          c.lineTo(cx + 16, cy - 16);
          c.lineTo(cx + 16, cy - 4);
          c.stroke();
          break;
        }
        case 'bellum': {
          // Crossed crimson blade crest
          c.beginPath();
          c.moveTo(cx, cy - 22);
          c.lineTo(cx + 12, cy + 8);
          c.lineTo(cx, cy + 22);
          c.lineTo(cx - 12, cy + 8);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        }
        case 'bacchion': {
          // Revelry goblet
          c.beginPath();
          c.moveTo(cx - 14, cy - 16);
          c.lineTo(cx + 14, cy - 16);
          c.lineTo(cx + 6, cy + 4);
          c.lineTo(cx + 12, cy + 18);
          c.lineTo(cx - 12, cy + 18);
          c.lineTo(cx - 6, cy + 4);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        }
        case 'glaciera': {
          // 6-point frost crystal
          c.strokeStyle = def.colorHex;
          c.lineWidth = 4;
          for (let i = 0; i < 3; i++) {
            const a = (i * Math.PI) / 3;
            c.beginPath();
            c.moveTo(cx - Math.cos(a) * 18, cy - Math.sin(a) * 18);
            c.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
            c.stroke();
          }
          break;
        }
        case 'veloce': {
          // Swept swift wing
          c.beginPath();
          c.moveTo(cx - 18, cy + 12);
          c.quadraticCurveTo(cx - 4, cy - 20, cx + 20, cy - 14);
          c.quadraticCurveTo(cx + 8, cy + 12, cx - 18, cy + 12);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        }
        case 'abyssos': {
          // Primordial void eye
          c.beginPath();
          c.ellipse(cx, cy, 20, 12, 0, 0, Math.PI * 2);
          c.fill();
          c.stroke();
          c.fillStyle = INK;
          c.beginPath();
          c.ellipse(cx, cy, 5, 11, 0, 0, Math.PI * 2);
          c.fill();
          break;
        }
      }
    });
  }
}

function drawVfxSprites(ctx: CanvasRenderingContext2D): void {
  // Soft radial lightmap/bloom glow blob
  withCell(ctx, 'vfx_glow_soft', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, cx);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.25, 'rgba(255, 255, 255, 0.7)');
    g.addColorStop(0.6, 'rgba(255, 255, 255, 0.22)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

  // 4-point mythic star flare
  withCell(ctx, 'vfx_glow_star', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 2, cx, cy, cx * 0.8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(cx, 2);
    c.quadraticCurveTo(cx + 6, cy - 6, w - 2, cy);
    c.quadraticCurveTo(cx + 6, cy + 6, cx, h - 2);
    c.quadraticCurveTo(cx - 6, cy + 6, 2, cy);
    c.quadraticCurveTo(cx - 6, cy - 6, cx, 2);
    c.closePath();
    c.fill();
  });

  // Comic starburst hit-spark
  withCell(ctx, 'vfx_spark_burst', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const spikes = 10;
    c.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? 46 : 16;
      const a = (i * Math.PI) / spikes;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
  });

  // Jagged comic lightning bolt
  withCell(ctx, 'vfx_lightning_bolt', (c, w, h) => {
    const cy = h * 0.5;
    c.strokeStyle = INK;
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(8, cy);
    c.lineTo(38, cy - 18);
    c.lineTo(60, cy + 12);
    c.lineTo(96, cy - 16);
    c.lineTo(116, cy + 8);
    c.lineTo(w - 8, cy - 4);
    c.stroke();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4.5;
    c.stroke();
  });

  // Stylized ink-cel flame tongue
  withCell(ctx, 'vfx_flame_tongue', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.88;
    c.beginPath();
    c.moveTo(cx, 8);
    c.bezierCurveTo(cx + 28, h * 0.42, cx + 26, baseY, cx, baseY + 4);
    c.bezierCurveTo(cx - 26, baseY, cx - 28, h * 0.42, cx, 8);
    c.closePath();
    const g = c.createLinearGradient(cx, 8, cx, baseY);
    g.addColorStop(0, '#fff9c4');
    g.addColorStop(0.5, '#ff982b');
    g.addColorStop(1, '#e62c1c');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
  });

  // Stylized Greek wave crest
  withCell(ctx, 'vfx_wave_crest', (c, w, h) => {
    c.beginPath();
    c.moveTo(10, h - 12);
    c.bezierCurveTo(28, 12, w - 24, 6, w - 12, 34);
    c.bezierCurveTo(w - 22, 24, w - 38, 30, w - 30, 44);
    c.quadraticCurveTo(w * 0.5, h - 10, 10, h - 12);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
  });

  // Persistent Floor Decals (scorch, ichor, crack)
  withCell(ctx, 'vfx_decal_scorch', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, w * 0.46);
    g.addColorStop(0, 'rgba(10, 7, 14, 0.88)');
    g.addColorStop(0.55, 'rgba(34, 16, 18, 0.55)');
    g.addColorStop(1, 'rgba(10, 7, 14, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, cy, w * 0.46, h * 0.42, 0, 0, Math.PI * 2);
    c.fill();
  });

  withCell(ctx, 'vfx_decal_ichor', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.fillStyle = '#ffffff';
    for (const [ox, oy, rx, ry] of [
      [0, 0, 34, 19],
      [-28, -8, 14, 9],
      [26, 10, 18, 10],
      [12, -16, 10, 7],
      [-18, 15, 11, 6],
    ]) {
      c.beginPath();
      c.ellipse(cx + ox, cy + oy, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    }
  });

  withCell(ctx, 'vfx_decal_crack', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.strokeStyle = INK;
    c.lineWidth = 3.5;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + 0.25;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 16);
      c.lineTo(cx + Math.cos(a + 0.25) * 56, cy + Math.sin(a + 0.25) * 30);
      c.stroke();
    }
  });

  // Soft ring for shockwaves & telegraphs
  withCell(ctx, 'vfx_ring_soft', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(cx, cy, cx - 10, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 18;
    c.stroke();
  });

  // Ground contact shadow ellipse
  withCell(ctx, 'vfx_shadow_blob', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.save();
    c.translate(cx, cy);
    c.scale(1, h / w);
    const g = c.createRadialGradient(0, 0, 4, 0, 0, cx * 0.92);
    g.addColorStop(0, 'rgba(6, 4, 12, 0.72)');
    g.addColorStop(0.65, 'rgba(6, 4, 12, 0.36)');
    g.addColorStop(1, 'rgba(6, 4, 12, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, cx * 0.92, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });

  // Projectile energy orb
  withCell(ctx, 'vfx_projectile_orb', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, 26);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, 'rgba(255, 255, 255, 0.85)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 26, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx, cy, 18, 0, Math.PI * 2);
    c.stroke();
  });

  // Projectile arrow
  withCell(ctx, 'vfx_projectile_arrow', (c, w, h) => {
    const cy = h * 0.5;
    c.strokeStyle = INK;
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(10, cy);
    c.lineTo(w - 14, cy);
    c.stroke();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3.6;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(w - 4, cy);
    c.lineTo(w - 22, cy - 10);
    c.lineTo(w - 18, cy);
    c.lineTo(w - 22, cy + 10);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
  });
}

// ============================================================================
// Atlas Baking Entry Point (Called ONCE at Renderer Init)
// ============================================================================

function drawWave2BiomePropsAndVfx(ctx: CanvasRenderingContext2D): void {
  // 4 Secondary Biome Stone Tile Variants (matching 2:1 isometric flagstones)
  withCell(ctx, 'tile_cinder_b', (c, w, h) =>
    drawIsometricStoneTile(
      c,
      w,
      h,
      {
        base: '#2b1615',
        dark: '#14090a',
        lit: '#4c2620',
        bevelLit: '#ff8a38',
        bevelDark: '#0b0405',
        inlay: '#ff6a22',
        accent: '#ffaa32',
      },
      'mosaic'
    )
  );
  withCell(ctx, 'tile_verdant_b', (c, w, h) =>
    drawIsometricStoneTile(
      c,
      w,
      h,
      {
        base: '#275963',
        dark: '#14333d',
        lit: '#478d94',
        bevelLit: '#9ff2eb',
        bevelDark: '#0a1c24',
        inlay: '#f2cb68',
        accent: '#ff6ec7',
      },
      'alt'
    )
  );
  withCell(ctx, 'tile_crypt_b', (c, w, h) =>
    drawIsometricStoneTile(
      c,
      w,
      h,
      {
        base: '#363b22',
        dark: '#1c2010',
        lit: '#575e34',
        bevelLit: '#9aa84f',
        bevelDark: '#0f1208',
        inlay: '#c9a342',
        accent: '#a8e62e',
      },
      'cracked'
    )
  );
  withCell(ctx, 'tile_summit_b', (c, w, h) =>
    drawIsometricStoneTile(
      c,
      w,
      h,
      {
        base: '#3c546e',
        dark: '#1e2e42',
        lit: '#6d94b8',
        bevelLit: '#e3f5ff',
        bevelDark: '#0d1624',
        inlay: '#e8f7ff',
        accent: '#7cdfff',
      },
      'cracked'
    )
  );

  // 4 Bespoke Biome Pillars (Cinder basalt spire, Verdant marble+laurel, Crypt bronze-bone, Summit frost monolith)
  const drawBiomePillar = (
    id: string,
    cols: { dark: string; mid: string; lit: string; cap: string; accent: string; rim: string }
  ) => {
    withCell(ctx, id, (c, w, h) => {
      const cx = w * 0.5;
      const baseY = h * 0.88;
      const topY = h * 0.1;
      const sw = w * 0.56;
      c.beginPath();
      c.moveTo(cx - sw * 0.78, baseY);
      c.lineTo(cx - sw * 0.48, baseY - 20);
      c.lineTo(cx + sw * 0.48, baseY - 20);
      c.lineTo(cx + sw * 0.78, baseY);
      c.lineTo(cx + sw * 0.48, baseY + 20);
      c.lineTo(cx - sw * 0.48, baseY + 20);
      c.closePath();
      c.fillStyle = cols.mid;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 4;
      c.stroke();

      c.save();
      c.beginPath();
      c.moveTo(cx - sw * 0.48, baseY - 4);
      c.lineTo(cx - sw * 0.44, topY + 22);
      c.lineTo(cx + sw * 0.44, topY + 22);
      c.lineTo(cx + sw * 0.48, baseY - 4);
      c.closePath();
      const sg = c.createLinearGradient(cx - sw * 0.5, 0, cx + sw * 0.5, 0);
      sg.addColorStop(0, cols.lit);
      sg.addColorStop(0.42, cols.mid);
      sg.addColorStop(0.75, cols.dark);
      sg.addColorStop(1, '#090910');
      c.fillStyle = sg;
      c.fill();
      c.clip();
      drawCrossHatch(c, cx + 2, topY + 22, sw * 0.5, baseY - topY, 8, -0.45, 'rgba(7,5,14,0.5)', 1.5);
      c.strokeStyle = cols.accent;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(cx - sw * 0.34, baseY - 72);
      c.lineTo(cx, baseY - 84);
      c.lineTo(cx + sw * 0.34, baseY - 72);
      c.stroke();
      c.restore();

      c.beginPath();
      c.moveTo(cx - sw * 0.48, baseY - 4);
      c.lineTo(cx - sw * 0.44, topY + 22);
      c.lineTo(cx + sw * 0.44, topY + 22);
      c.lineTo(cx + sw * 0.48, baseY - 4);
      c.closePath();
      c.strokeStyle = INK;
      c.lineWidth = 4;
      c.stroke();

      c.fillStyle = cols.cap;
      c.beginPath();
      c.moveTo(cx - sw * 0.72, topY + 26);
      c.lineTo(cx - sw * 0.76, topY + 6);
      c.lineTo(cx, topY - 4);
      c.lineTo(cx + sw * 0.76, topY + 8);
      c.lineTo(cx + sw * 0.7, topY + 26);
      c.closePath();
      c.fill();
      c.stroke();

      c.strokeStyle = cols.rim;
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(cx - sw * 0.44, topY + 28);
      c.lineTo(cx - sw * 0.47, baseY - 8);
      c.stroke();
    });
  };

  drawBiomePillar('prop_pillar_cinder', {
    dark: '#1c0d0d',
    mid: '#3b1e1c',
    lit: '#6e382e',
    cap: '#e07a2f',
    accent: '#ff5e1a',
    rim: '#ffaa5c',
  });
  drawBiomePillar('prop_pillar_verdant', {
    dark: '#102933',
    mid: '#245863',
    lit: '#5aa6ab',
    cap: '#f2cb64',
    accent: '#ff64c8',
    rim: '#a6fff8',
  });
  drawBiomePillar('prop_pillar_crypt', {
    dark: '#1b1e10',
    mid: '#3a4021',
    lit: '#6b703b',
    cap: '#b89440',
    accent: '#a8e62e',
    rim: '#d4f27c',
  });
  drawBiomePillar('prop_pillar_summit', {
    dark: '#182538',
    mid: '#324d6e',
    lit: '#78a4cc',
    cap: '#e6f6ff',
    accent: '#7cdfff',
    rim: '#ffffff',
  });

  // Curing Pool Basin (Crypt of Bile luminous turquoise cleansing fountain!)
  withCell(ctx, 'vfx_curing_basin', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.58;
    c.fillStyle = '#3c454a';
    c.beginPath();
    c.ellipse(cx, cy + 8, 52, 26, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, 42);
    g.addColorStop(0, '#e6ffff');
    g.addColorStop(0.55, '#38e6ff');
    g.addColorStop(1, '#0d6e8f');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, cy, 42, 20, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#d9b152';
    c.lineWidth = 3.2;
    c.stroke();
  });

  // Spinning Sawblade (Warden Fury)
  withCell(ctx, 'vfx_sawblade', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const teeth = 12;
    c.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const r = i % 2 === 0 ? 44 : 28;
      const a = (i * Math.PI) / teeth;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = '#b4c0cf';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.5;
    c.stroke();
    c.fillStyle = '#d62238';
    c.beginPath();
    c.arc(cx, cy, 14, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  });

  // Bellum Spinning Crimson Blade Rift Vortex
  withCell(ctx, 'vfx_blade_rift', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      c.save();
      c.translate(cx, cy);
      c.rotate(a);
      c.beginPath();
      c.moveTo(8, -4);
      c.quadraticCurveTo(38, -24, 48, 2);
      c.quadraticCurveTo(30, 6, 8, 4);
      c.closePath();
      c.fillStyle = i % 2 === 0 ? '#ff2418' : '#240b12';
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.stroke();
      c.restore();
    }
    c.fillStyle = '#ff6454';
    c.beginPath();
    c.arc(cx, cy, 12, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
  });

  // Boiling Blood Skull Projectile (Sovereign Lord)
  withCell(ctx, 'vfx_skull_proj', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, 42);
    g.addColorStop(0, '#9cff70');
    g.addColorStop(0.55, '#e82c38');
    g.addColorStop(1, 'rgba(200,20,30,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 42, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8f5e0';
    c.beginPath();
    c.arc(cx, cy - 4, 22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();
    c.fillStyle = '#24ff62';
    c.beginPath();
    c.arc(cx - 8, cy - 6, 5, 0, Math.PI * 2);
    c.arc(cx + 8, cy - 6, 5, 0, Math.PI * 2);
    c.fill();
  });

  // Painted Petal (Verdant Colosseum / Velouris) & Snowflake (Frozen Summit)
  withCell(ctx, 'vfx_petal', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.beginPath();
    c.moveTo(cx, 6);
    c.bezierCurveTo(w - 6, 12, w - 10, h - 8, cx, h - 6);
    c.bezierCurveTo(10, h - 8, 6, 12, cx, 6);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();
  });

  withCell(ctx, 'vfx_snowflake', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3.6;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      c.beginPath();
      c.moveTo(cx - Math.cos(a) * 18, cy - Math.sin(a) * 18);
      c.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
      c.stroke();
    }
  });

  // Crystal Turret Pylon (Glaciera Frost Crystal / Hazard Pylon)
  withCell(ctx, 'vfx_pylon', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.48;
    c.beginPath();
    c.moveTo(cx, 12);
    c.lineTo(cx + 28, cy);
    c.lineTo(cx + 16, h - 18);
    c.lineTo(cx - 16, h - 18);
    c.lineTo(cx - 28, cy);
    c.closePath();
    const g = c.createLinearGradient(cx - 26, 12, cx + 26, h - 18);
    g.addColorStop(0, '#d8f6ff');
    g.addColorStop(0.5, '#4eb4ff');
    g.addColorStop(1, '#193b6b');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
  });

  // Chaos Gate Swirling Primordial Floor Portal
  withCell(ctx, 'vfx_chaos_gate', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 6, cx, cy, 66);
    g.addColorStop(0, '#090214');
    g.addColorStop(0.45, '#6419ff');
    g.addColorStop(0.78, '#d49eff');
    g.addColorStop(1, 'rgba(100,25,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, cy, 66, 42, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#f2c154';
    c.lineWidth = 3.5;
    c.beginPath();
    c.ellipse(cx, cy, 46, 26, 0, 0, Math.PI * 2);
    c.stroke();
    // Primordial eye in center
    c.fillStyle = '#c48eff';
    c.beginPath();
    c.ellipse(cx, cy, 20, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#090214';
    c.beginPath();
    c.ellipse(cx, cy, 4, 10, 0, 0, Math.PI * 2);
    c.fill();
  });

  // Weapon VFX: Adamant Rail Muzzle Flash, Bow Power-Shot Starburst, Shield Frontal Block Arc
  withCell(ctx, 'vfx_muzzle_flash', (c, w, h) => {
    const cy = h * 0.5;
    c.beginPath();
    c.moveTo(8, cy);
    c.lineTo(38, cy - 32);
    c.lineTo(52, cy - 10);
    c.lineTo(w - 6, cy);
    c.lineTo(52, cy + 10);
    c.lineTo(38, cy + 32);
    c.closePath();
    c.fillStyle = '#ff9824';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
    c.fillStyle = '#fff9c4';
    c.beginPath();
    c.ellipse(38, cy, 24, 10, 0, 0, Math.PI * 2);
    c.fill();
  });

  withCell(ctx, 'vfx_bow_flash', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const spikes = 8;
    c.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? 50 : 12;
      const a = (i * Math.PI) / spikes;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = '#ffe966';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.8;
    c.stroke();
  });

  withCell(ctx, 'vfx_shield_block', (c, w, h) => {
    const cx = w * 0.38;
    const cy = h * 0.5;
    c.strokeStyle = '#ffcf48';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(cx, cy, 46, -1.1, 1.1);
    c.stroke();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4;
    c.stroke();
  });
}

function drawWave2EnemiesAndBosses(ctx: CanvasRenderingContext2D): void {
  // 15 Bespoke Wave 2 Enemies
  const drawCloakedWarrior = (
    id: string,
    cols: { top: string; mid: string; dark: string; eye: string; trim: string },
    extra: (c: CanvasRenderingContext2D, cx: number, baseY: number) => void
  ) => {
    withCell(ctx, id, (c, w, h) => {
      const cx = w * 0.5;
      const baseY = h * 0.86;
      c.beginPath();
      c.moveTo(cx - 28, baseY);
      c.quadraticCurveTo(cx - 38, baseY - 58, cx - 22, baseY - 96);
      c.quadraticCurveTo(cx, baseY - 124, cx + 22, baseY - 96);
      c.quadraticCurveTo(cx + 38, baseY - 58, cx + 28, baseY);
      c.lineTo(cx + 10, baseY - 12);
      c.lineTo(cx - 10, baseY - 12);
      c.closePath();
      const g = c.createLinearGradient(cx - 32, baseY - 120, cx + 32, baseY);
      g.addColorStop(0, cols.top);
      g.addColorStop(0.5, cols.mid);
      g.addColorStop(1, cols.dark);
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 4;
      c.stroke();

      // Hooded face & eyes
      c.fillStyle = '#08060e';
      c.beginPath();
      c.ellipse(cx, baseY - 94, 14, 16, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = cols.trim;
      c.lineWidth = 2.4;
      c.stroke();
      c.fillStyle = cols.eye;
      c.fillRect(cx - 8, baseY - 96, 5, 3);
      c.fillRect(cx + 3, baseY - 96, 5, 3);

      extra(c, cx, baseY);
    });
  };

  drawCloakedWarrior(
    'enemy_wretch_assassin',
    { top: '#44b888', mid: '#184d3d', dark: '#081b18', eye: '#ff405c', trim: '#5ef2b6' },
    (c, cx, by) => {
      // Twin curved glowing daggers
      c.strokeStyle = '#ff4b64';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(cx - 24, by - 56);
      c.quadraticCurveTo(cx - 48, by - 36, cx - 42, by - 14);
      c.moveTo(cx + 24, by - 56);
      c.quadraticCurveTo(cx + 48, by - 36, cx + 42, by - 14);
      c.stroke();
    }
  );

  drawCloakedWarrior(
    'enemy_slag_thrower',
    { top: '#c44b24', mid: '#591b14', dark: '#1a0808', eye: '#ffcf48', trim: '#ff7a2b' },
    (c, cx, by) => {
      // Glowing volcanic boulder cradled overhead
      c.fillStyle = '#ff6a1a';
      c.beginPath();
      c.arc(cx + 18, by - 78, 16, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3.5;
      c.stroke();
    }
  );

  // Lava Gorgon: Floating horned Medusa head w/ writhing magma serpents!
  withCell(ctx, 'enemy_lava_gorgon', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.54;
    // Writhing magma snake hair
    c.strokeStyle = '#ff5e1a';
    c.lineWidth = 7;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
      c.quadraticCurveTo(cx + Math.cos(a - 0.3) * 44, cy + Math.sin(a - 0.3) * 44, cx + Math.cos(a) * 52, cy + Math.sin(a) * 46);
      c.stroke();
    }
    c.fillStyle = '#3a2224';
    c.beginPath();
    c.ellipse(cx, cy, 24, 28, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.2;
    c.stroke();
    // Petrifying glowing emerald eyes
    c.fillStyle = '#58ff62';
    c.fillRect(cx - 12, cy - 4, 8, 4);
    c.fillRect(cx + 4, cy - 4, 8, 4);
  });

  drawCloakedWarrior(
    'enemy_bloodless_drifter',
    { top: '#e6d8c5', mid: '#8c6d58', dark: '#2e1d18', eye: '#ff6424', trim: '#ff8e38' },
    (c, cx, by) => {
      c.strokeStyle = '#e8eef5';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(cx + 22, by - 70);
      c.lineTo(cx + 48, by - 108);
      c.stroke();
    }
  );

  drawCloakedWarrior(
    'enemy_infernal_bomber',
    { top: '#d9ccb8', mid: '#6e5245', dark: '#211310', eye: '#ffde40', trim: '#ff5218' },
    (c, cx, by) => {
      c.fillStyle = '#291a1c';
      c.beginPath();
      c.arc(cx, by - 118, 19, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ff6a18';
      c.lineWidth = 3.5;
      c.stroke();
      c.fillStyle = '#ffe978';
      c.beginPath();
      c.arc(cx, by - 118, 7, 0, Math.PI * 2);
      c.fill();
    }
  );

  // Bone Hydra Auxiliary Head
  withCell(ctx, 'enemy_bone_hydra_head', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.86;
    // Sinuous bone vertebrae neck
    c.strokeStyle = INK;
    c.lineWidth = 22;
    c.beginPath();
    c.moveTo(cx, baseY);
    c.bezierCurveTo(cx - 24, baseY - 38, cx + 24, baseY - 68, cx, baseY - 96);
    c.stroke();
    c.strokeStyle = '#e8dec8';
    c.lineWidth = 13;
    c.stroke();
    // Fanged dragon skull
    c.fillStyle = '#f5ecd6';
    c.beginPath();
    c.moveTo(cx - 26, baseY - 94);
    c.lineTo(cx, baseY - 126);
    c.lineTo(cx + 28, baseY - 94);
    c.lineTo(cx + 14, baseY - 70);
    c.lineTo(cx - 14, baseY - 70);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = '#ff4524';
    c.fillRect(cx - 11, baseY - 102, 7, 5);
    c.fillRect(cx + 5, baseY - 102, 7, 5);
  });

  // Verdant Colosseum Exalted Shades (Swordsman, Shieldbearer, Bowman)
  drawCloakedWarrior(
    'enemy_colosseum_swordsman',
    { top: '#68f2eb', mid: '#1e6e7d', dark: '#0b2430', eye: '#ffe66e', trim: '#f2c652' },
    (c, cx, by) => {
      c.fillStyle = '#f2c652';
      c.beginPath();
      c.moveTo(cx, by - 128);
      c.lineTo(cx + 16, by - 114);
      c.lineTo(cx - 16, by - 114);
      c.closePath();
      c.fill();
      c.strokeStyle = '#99fff8';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(cx + 22, by - 58);
      c.lineTo(cx + 50, by - 96);
      c.stroke();
    }
  );

  drawCloakedWarrior(
    'enemy_colosseum_shieldbearer',
    { top: '#59e0d6', mid: '#1c5c6b', dark: '#0a202b', eye: '#ffe66e', trim: '#f2c652' },
    (c, cx, by) => {
      // Gleaming gilded hoplite greatshield in front!
      c.fillStyle = '#e8b342';
      c.beginPath();
      c.roundRect(cx + 8, by - 88, 38, 66, 12);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 4;
      c.stroke();
      c.fillStyle = '#38c7c4';
      c.beginPath();
      c.arc(cx + 27, by - 55, 11, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
  );

  drawCloakedWarrior(
    'enemy_colosseum_bowman',
    { top: '#78f5c8', mid: '#1f6b58', dark: '#0a2420', eye: '#fff080', trim: '#f2c652' },
    (c, cx, by) => {
      c.strokeStyle = '#f2c652';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(cx + 22, by - 108);
      c.quadraticCurveTo(cx + 52, by - 72, cx + 22, by - 36);
      c.stroke();
    }
  );

  // Flamewheel Chariot
  withCell(ctx, 'enemy_chariot_flame', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.56;
    c.fillStyle = '#ff6a18';
    c.beginPath();
    c.arc(cx, cy, 44, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e0a938';
    c.beginPath();
    c.arc(cx, cy, 32, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.2;
    c.stroke();
    c.fillStyle = '#291c22';
    c.beginPath();
    c.arc(cx, cy, 18, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  });

  // Soul-Eye Regenerating Orb (bright magenta-gold eye crystal — unmistakable target!)
  withCell(ctx, 'enemy_soul_orb', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, 46);
    g.addColorStop(0, '#fff2fc');
    g.addColorStop(0.45, '#ff32d4');
    g.addColorStop(1, 'rgba(200, 20, 180, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 46, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ff40d4';
    c.beginPath();
    c.arc(cx, cy, 22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#f2c852';
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(cx, cy, 12, 7, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(cx, cy, 4.5, 0, Math.PI * 2);
    c.fill();
  });

  // Crypt of Bile: Venom Satyr, Giant Vermin, Snakestone Laser, Heavy Brawler
  drawCloakedWarrior(
    'enemy_venom_satyr',
    { top: '#8c2838', mid: '#3d1520', dark: '#14080c', eye: '#a8ff2e', trim: '#a8e62e' },
    (c, cx, by) => {
      // Curved goat horns + green dart pipe
      c.strokeStyle = '#c4b898';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(cx - 10, by - 108);
      c.quadraticCurveTo(cx - 26, by - 126, cx - 18, by - 134);
      c.moveTo(cx + 10, by - 108);
      c.quadraticCurveTo(cx + 26, by - 126, cx + 18, by - 134);
      c.stroke();
      c.strokeStyle = '#82e62e';
      c.lineWidth = 4.5;
      c.beginPath();
      c.moveTo(cx + 10, by - 88);
      c.lineTo(cx + 50, by - 82);
      c.stroke();
    }
  );

  withCell(ctx, 'enemy_giant_vermin', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.84;
    c.beginPath();
    c.ellipse(cx, baseY - 36, 48, 30, 0, 0, Math.PI * 2);
    const g = c.createLinearGradient(cx - 48, baseY - 64, cx + 48, baseY);
    g.addColorStop(0, '#595e42');
    g.addColorStop(0.55, '#2b2e1f');
    g.addColorStop(1, '#10120c');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.4;
    c.stroke();
    c.fillStyle = '#b4ff38';
    c.beginPath();
    c.arc(cx + 26, baseY - 40, 5, 0, Math.PI * 2);
    c.fill();
  });

  withCell(ctx, 'enemy_snakestone_laser', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.48;
    c.beginPath();
    c.moveTo(cx, cy - 54);
    c.lineTo(cx + 30, cy - 10);
    c.lineTo(cx + 18, cy + 48);
    c.lineTo(cx - 18, cy + 48);
    c.lineTo(cx - 30, cy - 10);
    c.closePath();
    c.fillStyle = '#409e48';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.2;
    c.stroke();
    c.fillStyle = '#e8ff6e';
    c.beginPath();
    c.ellipse(cx, cy - 4, 12, 18, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  });

  withCell(ctx, 'enemy_heavy_brawler', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.86;
    c.beginPath();
    c.moveTo(cx - 50, baseY);
    c.quadraticCurveTo(cx - 64, baseY - 68, cx - 32, baseY - 106);
    c.lineTo(cx + 32, baseY - 106);
    c.quadraticCurveTo(cx + 64, baseY - 68, cx + 50, baseY);
    c.closePath();
    c.fillStyle = '#3b323d';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.6;
    c.stroke();
    c.fillStyle = '#d49e42';
    c.beginPath();
    c.arc(cx, baseY - 102, 20, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#ff4830';
    c.fillRect(cx - 10, baseY - 104, 7, 4);
    c.fillRect(cx + 3, baseY - 104, 7, 4);
  });

  // ============================================================================
  // ALL 7 REMAINING WAVE 2 BOSSES (Every Boss in the Game is Bespoke Ink-Cel!)
  // ============================================================================

  // Boss 2: Warden Fury (Crimson Rage Fury w/ flame-rimmed wings!)
  const drawSisterFury = (
    id: string,
    cols: { wingTop: string; wingRim: string; cloak: string; eye: string; hair: string; crown: string }
  ) => {
    withCell(ctx, id, (c, w, h) => {
      const cx = w * 0.5;
      const baseY = h * 0.86;
      for (const dir of [-1, 1] as const) {
        c.beginPath();
        c.moveTo(cx + dir * 14, baseY - 138);
        c.bezierCurveTo(cx + dir * 68, baseY - 226, cx + dir * 108, baseY - 208, cx + dir * 124, baseY - 168);
        c.quadraticCurveTo(cx + dir * 94, baseY - 118, cx + dir * 98, baseY - 82);
        c.lineTo(cx + dir * 16, baseY - 96);
        c.closePath();
        c.fillStyle = cols.wingTop;
        c.fill();
        c.strokeStyle = INK;
        c.lineWidth = 4.6;
        c.stroke();
        c.strokeStyle = cols.wingRim;
        c.lineWidth = 2.6;
        c.stroke();
      }
      c.fillStyle = cols.cloak;
      c.beginPath();
      c.moveTo(cx - 24, baseY - 138);
      c.lineTo(cx + 24, baseY - 138);
      c.lineTo(cx + 42, baseY);
      c.lineTo(cx, baseY - 30);
      c.lineTo(cx - 42, baseY);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 4.4;
      c.stroke();
      const hy = baseY - 164;
      c.fillStyle = cols.hair;
      c.beginPath();
      c.arc(cx, hy - 4, 24, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#e8dceb';
      c.beginPath();
      c.ellipse(cx, hy, 14, 17, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = cols.crown;
      c.beginPath();
      c.moveTo(cx - 18, hy - 14);
      c.lineTo(cx - 26, hy - 46);
      c.lineTo(cx, hy - 22);
      c.lineTo(cx + 26, hy - 46);
      c.lineTo(cx + 18, hy - 14);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = cols.eye;
      c.fillRect(cx - 9, hy - 3, 6, 3);
      c.fillRect(cx + 3, hy - 3, 6, 3);
    });
  };

  drawSisterFury('boss_warden_fury', {
    wingTop: '#4f1018',
    wingRim: '#ff4824',
    cloak: '#b81a24',
    eye: '#ffae24',
    hair: '#a61420',
    crown: '#ff7024',
  });
  drawSisterFury('boss_warden_murder', {
    wingTop: '#102e28',
    wingRim: '#4de09d',
    cloak: '#1a423a',
    eye: '#ff2442',
    hair: '#0c1c1a',
    crown: '#c7d9cf',
  });

  // Boss 4: Bone Leviathan (Menacing Sinuous Skeletal Hydra Dragon Head & Spined Ribcage over Lava!)
  withCell(ctx, 'boss_bone_leviathan', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.87;
    // Molten magma pool glow beneath skeletal column
    const lava = c.createRadialGradient(cx, baseY - 8, 12, cx, baseY - 8, 112);
    lava.addColorStop(0, '#ff8e24');
    lava.addColorStop(0.55, 'rgba(210, 42, 12, 0.5)');
    lava.addColorStop(1, 'rgba(80, 10, 8, 0)');
    c.fillStyle = lava;
    c.beginPath();
    c.ellipse(cx, baseY - 8, 112, 42, 0, 0, Math.PI * 2);
    c.fill();

    // Sinuous curving dark-obsidian & molten-veined Hydra spinal neck!
    c.beginPath();
    c.moveTo(cx - 42, baseY);
    c.bezierCurveTo(cx - 64, baseY - 68, cx - 22, baseY - 122, cx - 26, baseY - 172);
    c.lineTo(cx + 28, baseY - 172);
    c.bezierCurveTo(cx + 38, baseY - 118, cx + 62, baseY - 64, cx + 44, baseY);
    c.closePath();
    const neckG = c.createLinearGradient(cx - 50, baseY - 170, cx + 50, baseY);
    neckG.addColorStop(0, '#4f2222');
    neckG.addColorStop(0.5, '#260d12');
    neckG.addColorStop(1, '#0e0509');
    c.fillStyle = neckG;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.stroke();

    // Jagged curved ivory rib-plates & molten orange furnace core glowing between ribs!
    c.fillStyle = '#ff6a18';
    c.beginPath();
    c.ellipse(cx, baseY - 76, 18, 52, 0, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 4; i++) {
      const ry = baseY - 28 - i * 28;
      const rw = 46 - i * 4;
      c.fillStyle = '#e8dcc2';
      c.beginPath();
      c.moveTo(cx - rw, ry + 6);
      c.quadraticCurveTo(cx - rw * 0.5, ry - 12, cx - 10, ry - 4);
      c.lineTo(cx - 12, ry + 8);
      c.quadraticCurveTo(cx - rw * 0.5, ry + 2, cx - rw + 4, ry + 14);
      c.closePath();
      c.moveTo(cx + rw, ry + 6);
      c.quadraticCurveTo(cx + rw * 0.5, ry - 12, cx + 10, ry - 4);
      c.lineTo(cx + 12, ry + 8);
      c.quadraticCurveTo(cx + rw * 0.5, ry + 2, cx + rw - 4, ry + 14);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3.2;
      c.stroke();
    }

    // Fierce Sculpted Horned Dragon Skull w/ Jagged Lower Jaw & Swept Obsidian Crown Horns!
    const hy = baseY - 180;
    // Dark swept dragon horns behind skull
    c.fillStyle = '#381e24';
    for (const dir of [-1, 1] as const) {
      c.beginPath();
      c.moveTo(cx + dir * 24, hy - 18);
      c.quadraticCurveTo(cx + dir * 74, hy - 34, cx + dir * 88, hy - 78);
      c.quadraticCurveTo(cx + dir * 56, hy - 54, cx + dir * 34, hy - 44);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 4.4;
      c.stroke();
    }

    // Sculpted bony dragon cranium & snout with 3-tone shading
    c.beginPath();
    c.moveTo(cx - 52, hy - 22);
    c.quadraticCurveTo(cx, hy - 56, cx + 52, hy - 22);
    c.lineTo(cx + 42, hy + 20);
    c.lineTo(cx + 22, hy + 46);
    c.lineTo(cx, hy + 52);
    c.lineTo(cx - 22, hy + 46);
    c.lineTo(cx - 42, hy + 20);
    c.closePath();
    const skG = c.createLinearGradient(cx - 48, hy - 48, cx + 48, hy + 48);
    skG.addColorStop(0, '#f5ebd6');
    skG.addColorStop(0.55, '#c7b89d');
    skG.addColorStop(1, '#5e4f47');
    c.fillStyle = skG;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.8;
    c.stroke();

    // Fierce angled eye sockets w/ blazing molten orange flames + sharp fanged jaw!
    c.fillStyle = '#12060a';
    c.beginPath();
    c.moveTo(cx - 38, hy - 12);
    c.lineTo(cx - 10, hy - 2);
    c.lineTo(cx - 18, hy + 10);
    c.lineTo(cx - 36, hy + 4);
    c.closePath();
    c.moveTo(cx + 38, hy - 12);
    c.lineTo(cx + 10, hy - 2);
    c.lineTo(cx + 18, hy + 10);
    c.lineTo(cx + 36, hy + 4);
    c.closePath();
    c.fill();
    c.fillStyle = '#ff9c1a';
    c.fillRect(cx - 28, hy - 4, 10, 6);
    c.fillRect(cx + 18, hy - 4, 10, 6);

    // Jagged inked dragon fangs along muzzle
    c.fillStyle = '#fff5e0';
    for (const fx of [-22, -10, 2, 14]) {
      c.beginPath();
      c.moveTo(cx + fx, hy + 30);
      c.lineTo(cx + fx + 4, hy + 48);
      c.lineTo(cx + fx + 8, hy + 30);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.4;
      c.stroke();
    }
  });

  // Boss 5: Colosseum Bull (Sculpted Muscular Horned Minotaur Juggernaut w/ Harness, Hooves & Labrys Axe!)
  withCell(ctx, 'boss_colosseum_bull', (c, w, h) => {
    const cx = w * 0.48;
    const baseY = h * 0.88;

    // Massive Gilded Double-Headed Labrys Battle-Axe angled behind shoulder
    c.save();
    c.translate(cx + 62, baseY - 126);
    c.rotate(0.32);
    c.fillStyle = '#5c341d';
    c.fillRect(-6, -96, 12, 195);
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.strokeRect(-6, -96, 12, 195);
    c.fillStyle = '#e8b648';
    c.beginPath();
    c.moveTo(-46, -80);
    c.quadraticCurveTo(0, -50, 46, -80);
    c.lineTo(52, -22);
    c.quadraticCurveTo(0, -44, -52, -22);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();

    // Muscular armored legs & cloven hooves in wide stomping stance
    for (const dir of [-1, 1] as const) {
      c.fillStyle = '#47221a';
      c.beginPath();
      c.moveTo(cx + dir * 16, baseY - 62);
      c.lineTo(cx + dir * 48, baseY - 62);
      c.lineTo(cx + dir * 56, baseY);
      c.lineTo(cx + dir * 24, baseY);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 4.4;
      c.stroke();
    }

    // Broad V-tapered muscular bronzed minotaur torso + dark ink pectoral planes!
    c.beginPath();
    c.moveTo(cx - 42, baseY - 58);
    c.lineTo(cx - 78, baseY - 132);
    c.quadraticCurveTo(cx, baseY - 178, cx + 78, baseY - 132);
    c.lineTo(cx + 42, baseY - 58);
    c.closePath();
    const bGrad = c.createLinearGradient(cx - 76, baseY - 165, cx + 76, baseY - 58);
    bGrad.addColorStop(0, '#b56e4d');
    bGrad.addColorStop(0.5, '#693426');
    bGrad.addColorStop(1, '#261010');
    c.fillStyle = bGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.stroke();

    // Crossed bronze gladiator chest harness & gilded waist belt + crimson loincloth!
    c.strokeStyle = '#d99e3c';
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(cx - 56, baseY - 144);
    c.lineTo(cx + 38, baseY - 66);
    c.moveTo(cx + 56, baseY - 144);
    c.lineTo(cx - 38, baseY - 66);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
    c.fillStyle = '#a81c2c';
    c.beginPath();
    c.moveTo(cx - 36, baseY - 64);
    c.lineTo(cx + 36, baseY - 64);
    c.lineTo(cx + 22, baseY - 16);
    c.lineTo(cx - 22, baseY - 16);
    c.closePath();
    c.fill();
    c.stroke();

    // Sculpted Bull Head + Massive Curved Ivory Horns & Gold Nose Ring!
    const hy = baseY - 178;
    c.fillStyle = '#f2e6cf';
    c.beginPath();
    c.moveTo(cx - 26, hy - 14);
    c.quadraticCurveTo(cx - 92, hy - 18, cx - 78, hy - 78);
    c.quadraticCurveTo(cx - 58, hy - 36, cx - 18, hy - 28);
    c.closePath();
    c.moveTo(cx + 26, hy - 14);
    c.quadraticCurveTo(cx + 92, hy - 18, cx + 78, hy - 78);
    c.quadraticCurveTo(cx + 58, hy - 36, cx + 18, hy - 28);
    c.closePath();
    c.fill();
    c.stroke();

    c.fillStyle = '#5c2e22';
    c.beginPath();
    c.moveTo(cx - 32, hy - 18);
    c.quadraticCurveTo(cx, hy - 38, cx + 32, hy - 18);
    c.lineTo(cx + 24, hy + 28);
    c.lineTo(cx, hy + 36);
    c.lineTo(cx - 24, hy + 28);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = '#f5ca52';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(cx, hy + 24, 10, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#ff6428';
    c.fillRect(cx - 16, hy - 6, 9, 5);
    c.fillRect(cx + 7, hy - 6, 9, 5);
  });

  // Boss 6: Colosseum Spearlord (Athletic Golden Spartan Champion w/ Flowing Crimson Cape, Shield & Spear!)
  withCell(ctx, 'boss_colosseum_spearlord', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.88;
    // Blazing golden arena spear
    c.strokeStyle = INK;
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(cx - 64, baseY - 12);
    c.lineTo(cx + 80, baseY - 216);
    c.stroke();
    c.strokeStyle = '#ffdf66';
    c.lineWidth = 5;
    c.stroke();

    // Sweeping royal crimson Champion Cape billowing behind golden armor!
    c.fillStyle = '#a61428';
    c.beginPath();
    c.moveTo(cx - 36, baseY - 148);
    c.lineTo(cx + 36, baseY - 148);
    c.quadraticCurveTo(cx + 68, baseY - 76, cx + 58, baseY - 4);
    c.lineTo(cx - 42, baseY - 12);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.4;
    c.stroke();

    // Armored greaved warrior legs
    for (const lx of [cx - 20, cx + 10]) {
      c.fillStyle = '#c48628';
      c.fillRect(lx, baseY - 62, 14, 60);
      c.strokeStyle = INK;
      c.lineWidth = 3.8;
      c.strokeRect(lx, baseY - 62, 14, 60);
    }

    // Tapered Sculpted Golden Spartan Cuirass & Pleated Pteruges Skirt!
    c.beginPath();
    c.moveTo(cx - 38, baseY - 146);
    c.lineTo(cx + 38, baseY - 146);
    c.lineTo(cx + 26, baseY - 88);
    c.lineTo(cx + 36, baseY - 52);
    c.lineTo(cx - 36, baseY - 52);
    c.lineTo(cx - 26, baseY - 88);
    c.closePath();
    const g = c.createLinearGradient(cx - 38, baseY - 146, cx + 38, baseY - 52);
    g.addColorStop(0, '#fff2b0');
    g.addColorStop(0.45, '#d6972c');
    g.addColorStop(1, '#54300c');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.4;
    c.stroke();

    // Gleaming round golden hoplite shield w/ sunburst rim
    c.fillStyle = '#f5c448';
    c.beginPath();
    c.arc(cx - 44, baseY - 96, 42, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#b81d2c';
    c.beginPath();
    c.arc(cx - 44, baseY - 96, 24, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Plumed Corinthian Champion Helm w/ fierce eye slits
    const hy = baseY - 174;
    c.fillStyle = '#d92234';
    c.beginPath();
    c.moveTo(cx - 10, hy - 22);
    c.quadraticCurveTo(cx - 48, hy - 68, cx + 20, hy - 64);
    c.quadraticCurveTo(cx + 54, hy - 48, cx + 26, hy - 14);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#f2be44';
    c.beginPath();
    c.ellipse(cx, hy, 22, 26, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = INK;
    c.fillRect(cx - 12, hy - 4, 24, 7);
    c.fillStyle = '#5ef2ff';
    c.fillRect(cx - 8, hy - 2, 5, 3);
    c.fillRect(cx + 3, hy - 2, 5, 3);
  });

  // Boss 7: The Ferryman (Towering Draped Boatman w/ Ink Fold Cloak, Gold Shoulder Trim, Conical Hat & Giant Oar!)
  withCell(ctx, 'boss_the_ferryman', (c, w, h) => {
    const cx = w * 0.48;
    const baseY = h * 0.87;
    // Colossal gilded Stygian Oar diagonally behind body!
    c.save();
    c.translate(cx + 56, baseY - 122);
    c.rotate(0.28);
    c.fillStyle = '#332238';
    c.fillRect(-7, -110, 14, 220);
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.strokeRect(-7, -110, 14, 220);
    c.fillStyle = '#e5b244';
    c.beginPath();
    c.ellipse(0, -104, 24, 46, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();

    // Tall billowing tattered dark-violet & gold-hemmed Ferryman robes w/ diagonal ink folds!
    c.save();
    c.beginPath();
    c.moveTo(cx - 58, baseY);
    c.quadraticCurveTo(cx - 66, baseY - 96, cx - 34, baseY - 172);
    c.lineTo(cx + 34, baseY - 172);
    c.quadraticCurveTo(cx + 66, baseY - 96, cx + 58, baseY);
    c.lineTo(cx + 22, baseY - 14);
    c.lineTo(cx, baseY + 4);
    c.lineTo(cx - 24, baseY - 14);
    c.closePath();
    const rG = c.createLinearGradient(cx - 56, baseY - 172, cx + 56, baseY);
    rG.addColorStop(0, '#5a2d75');
    rG.addColorStop(0.5, '#241136');
    rG.addColorStop(1, '#0b0514');
    c.fillStyle = rG;
    c.fill();
    c.clip();
    drawCrossHatch(c, cx + 4, baseY - 164, 58, 168, 9, -0.45, 'rgba(6, 3, 12, 0.5)', 1.5);
    c.strokeStyle = '#e5b244';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(cx - 46, baseY - 134);
    c.quadraticCurveTo(cx, baseY - 102, cx + 46, baseY - 134);
    c.stroke();
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.stroke();

    // Shadowed veil face & glowing turquoise eyes
    const hy = baseY - 188;
    c.fillStyle = '#07050c';
    c.beginPath();
    c.ellipse(cx, hy, 22, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#52fff4';
    c.beginPath();
    c.arc(cx - 8, hy, 4.5, 0, Math.PI * 2);
    c.arc(cx + 8, hy, 4.5, 0, Math.PI * 2);
    c.fill();

    // Iconic wide-brimmed gilded conical Boatman Hat!
    c.beginPath();
    c.moveTo(cx - 80, hy - 8);
    c.lineTo(cx, hy - 66);
    c.lineTo(cx + 80, hy - 8);
    c.quadraticCurveTo(cx, hy + 10, cx - 80, hy - 8);
    c.closePath();
    const hatG = c.createLinearGradient(cx - 72, hy - 58, cx + 72, hy);
    hatG.addColorStop(0, '#854aa8');
    hatG.addColorStop(0.55, '#3b1854');
    hatG.addColorStop(1, '#160824');
    c.fillStyle = hatG;
    c.fill();
    c.strokeStyle = '#f2be4c';
    c.lineWidth = 4;
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
  });

  // Boss 8: FINAL BOSS — SOVEREIGN LORD OF THE ABYSS (Towering Horned Monarch w/ Twin-Pronged Bident!)
  withCell(ctx, 'boss_sovereign_lord', (c, w, h) => {
    const cx = w * 0.48;
    const baseY = h * 0.88;

    // Dramatic volcanic crimson-and-gold royal backlight aura
    const aura = c.createRadialGradient(cx, baseY - 150, 14, cx, baseY - 150, 140);
    aura.addColorStop(0, 'rgba(255, 86, 36, 0.52)');
    aura.addColorStop(0.55, 'rgba(150, 16, 28, 0.25)');
    aura.addColorStop(1, 'rgba(20, 4, 12, 0)');
    c.fillStyle = aura;
    c.beginPath();
    c.arc(cx, baseY - 150, 140, 0, Math.PI * 2);
    c.fill();

    // Colossal Twin-Pronged Abyssal Bident held diagonally across right flank!
    c.save();
    c.translate(cx + 88, baseY - 134);
    c.rotate(0.2);
    c.fillStyle = '#241a24';
    c.fillRect(-7, -110, 14, 240);
    c.strokeStyle = INK;
    c.lineWidth = 4.5;
    c.strokeRect(-7, -110, 14, 240);
    // Twin jagged molten-gold prongs!
    c.fillStyle = '#f5ba38';
    c.beginPath();
    c.moveTo(-26, -104);
    c.lineTo(-22, -168);
    c.lineTo(-8, -118);
    c.lineTo(8, -118);
    c.lineTo(22, -168);
    c.lineTo(26, -104);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();

    // Massive billowing dark-crimson & gold-hemmed Sovereign Mantle w/ dramatic ink folds!
    c.save();
    c.beginPath();
    c.moveTo(cx - 90, baseY + 2);
    c.bezierCurveTo(cx - 106, baseY - 104, cx - 88, baseY - 178, cx - 44, baseY - 196);
    c.lineTo(cx + 44, baseY - 196);
    c.bezierCurveTo(cx + 88, baseY - 178, cx + 106, baseY - 104, cx + 90, baseY + 2);
    c.lineTo(cx + 38, baseY - 18);
    c.lineTo(cx, baseY + 6);
    c.lineTo(cx - 38, baseY - 18);
    c.closePath();
    const capeG = c.createLinearGradient(cx - 94, baseY - 196, cx + 94, baseY);
    capeG.addColorStop(0, '#b51828');
    capeG.addColorStop(0.5, '#4c0a16');
    capeG.addColorStop(1, '#12040a');
    c.fillStyle = capeG;
    c.fill();
    c.clip();
    drawCrossHatch(c, cx + 12, baseY - 186, 90, 190, 9, -0.45, 'rgba(6, 3, 10, 0.55)', 1.6);
    c.strokeStyle = '#f2ba44';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(cx - 86, baseY - 14);
    c.lineTo(cx - 38, baseY - 30);
    c.lineTo(cx, baseY - 10);
    c.lineTo(cx + 38, baseY - 30);
    c.lineTo(cx + 86, baseY - 14);
    c.stroke();
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 5.4;
    c.stroke();

    // Broad sculpted obsidian armor breastplate & golden Underworld skull medallion!
    c.fillStyle = '#1f1522';
    c.beginPath();
    c.moveTo(cx - 56, baseY - 190);
    c.lineTo(cx + 56, baseY - 190);
    c.lineTo(cx + 40, baseY - 76);
    c.lineTo(cx, baseY - 62);
    c.lineTo(cx - 40, baseY - 76);
    c.closePath();
    c.fill();
    c.strokeStyle = '#f2ba44';
    c.lineWidth = 4;
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 3.5;
    c.stroke();

    // Twin sculpted gilded skull pauldrons!
    for (const dir of [-1, 1] as const) {
      c.fillStyle = '#e8ac38';
      c.beginPath();
      c.ellipse(cx + dir * 58, baseY - 184, 28, 20, dir * 0.3, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 4.5;
      c.stroke();
    }

    // Imposing Sovereign Visage, Sweeping Forked Dark Beard & Massive Branching Golden Crown-Horns!
    const hy = baseY - 216;
    c.fillStyle = '#dfd3e0';
    c.beginPath();
    c.ellipse(cx, hy, 24, 28, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.6;
    c.stroke();

    // Sweeping forked sovereign dark-charcoal beard
    c.fillStyle = '#120d17';
    c.beginPath();
    c.moveTo(cx - 24, hy + 4);
    c.lineTo(cx - 32, hy + 48);
    c.lineTo(cx - 6, hy + 30);
    c.lineTo(cx, hy + 58);
    c.lineTo(cx + 6, hy + 30);
    c.lineTo(cx + 32, hy + 48);
    c.lineTo(cx + 24, hy + 4);
    c.closePath();
    c.fill();
    c.stroke();

    // Massive iconic branching golden Crown-Horns sweeping wide above brow!
    c.fillStyle = '#ffcf48';
    c.strokeStyle = INK;
    c.lineWidth = 4.5;
    for (const dir of [-1, 1] as const) {
      c.beginPath();
      c.moveTo(cx + dir * 14, hy - 18);
      c.quadraticCurveTo(cx + dir * 58, hy - 22, cx + dir * 78, hy - 68);
      c.lineTo(cx + dir * 54, hy - 48);
      c.lineTo(cx + dir * 50, hy - 80);
      c.quadraticCurveTo(cx + dir * 32, hy - 36, cx + dir * 6, hy - 26);
      c.closePath();
      c.fill();
      c.stroke();
    }

    // Blazing Molten-Gold Sovereign Eyes!
    c.fillStyle = '#ff6818';
    c.fillRect(cx - 14, hy - 6, 9, 5);
    c.fillRect(cx + 5, hy - 6, 9, 5);
    c.fillStyle = '#fff5a8';
    c.fillRect(cx - 12, hy - 5, 5, 3);
    c.fillRect(cx + 7, hy - 5, 5, 3);
  });
}

// ============================================================================
// Atlas Baking & Optional Custom-Pack Composite Builder
// ============================================================================

let cachedAtlas: BakedAtlas | null = null;

export function bakeProceduralInkCelAtlas(): BakedAtlas {
  if (cachedAtlas) {
    return cachedAtlas;
  }

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ProceduralInkCelAtlas: failed to acquire 2D canvas context');
  }

  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  // Solid white texel block (padded) for untextured ribbons/telegraphs
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(2, 2, 12, 12);

  // Obsidian Pit flagstones (emerald-jade & carved dark slate)
  const obsidianPal = {
    base: '#223634',
    dark: '#121f21',
    lit: '#365650',
    bevelLit: '#5f9a88',
    bevelDark: '#0b1214',
    inlay: '#d4a348',
    accent: '#4de09d',
  };
  withCell(ctx, 'tile_obsidian_a', (c, w, h) => drawIsometricStoneTile(c, w, h, obsidianPal, 'plain'));
  withCell(ctx, 'tile_obsidian_b', (c, w, h) => drawIsometricStoneTile(c, w, h, obsidianPal, 'alt'));
  withCell(ctx, 'tile_obsidian_cracked', (c, w, h) =>
    drawIsometricStoneTile(c, w, h, obsidianPal, 'cracked')
  );
  withCell(ctx, 'tile_obsidian_mosaic', (c, w, h) =>
    drawIsometricStoneTile(c, w, h, obsidianPal, 'mosaic')
  );

  // Sanctum Courtyard flagstones (deep plum-obsidian with royal crimson & burnished gold)
  const sanctumPal = {
    base: '#2b1f34',
    dark: '#171020',
    lit: '#473152',
    bevelLit: '#7d567e',
    bevelDark: '#0c0812',
    inlay: '#e6b14e',
    accent: '#e03e4b',
  };
  withCell(ctx, 'tile_sanctum_a', (c, w, h) => drawIsometricStoneTile(c, w, h, sanctumPal, 'plain'));
  withCell(ctx, 'tile_sanctum_b', (c, w, h) => drawIsometricStoneTile(c, w, h, sanctumPal, 'alt'));
  withCell(ctx, 'tile_sanctum_mosaic', (c, w, h) =>
    drawIsometricStoneTile(c, w, h, sanctumPal, 'mosaic')
  );

  // Primary Wave 2 Biome Tiles
  withCell(ctx, 'tile_cinder_a', (c, w, h) =>
    drawIsometricStoneTile(
      c,
      w,
      h,
      {
        base: '#3a221d',
        dark: '#1f100e',
        lit: '#5b362b',
        bevelLit: '#9e5c3e',
        bevelDark: '#120807',
        inlay: '#e5923c',
        accent: '#ff6a2b',
      },
      'cracked'
    )
  );
  withCell(ctx, 'tile_verdant_a', (c, w, h) =>
    drawIsometricStoneTile(
      c,
      w,
      h,
      {
        base: '#1f4450',
        dark: '#10252e',
        lit: '#356f7b',
        bevelLit: '#72c9cc',
        bevelDark: '#09161c',
        inlay: '#e8c468',
        accent: '#5ef2e6',
      },
      'mosaic'
    )
  );
  withCell(ctx, 'tile_crypt_a', (c, w, h) =>
    drawIsometricStoneTile(
      c,
      w,
      h,
      {
        base: '#2d341c',
        dark: '#181c0f',
        lit: '#48542a',
        bevelLit: '#7b8f42',
        bevelDark: '#0d1008',
        inlay: '#c4a846',
        accent: '#a8d93b',
      },
      'alt'
    )
  );
  withCell(ctx, 'tile_summit_a', (c, w, h) =>
    drawIsometricStoneTile(
      c,
      w,
      h,
      {
        base: '#2d4157',
        dark: '#182536',
        lit: '#4e6f8f',
        bevelLit: '#9ccbe8',
        bevelDark: '#0d1521',
        inlay: '#c7ebff',
        accent: '#7cd4ff',
      },
      'plain'
    )
  );

  // Trim, Chasm Rim, Spike Traps, Pillars, Doors, Braziers, Urns
  withCell(ctx, 'trim_meander', drawMeanderTrim);
  withCell(ctx, 'prop_chasm_rim', drawChasmRim);
  withCell(ctx, 'prop_spike_idle', (c, w, h) => drawSpikeTrap(c, w, h, 'idle'));
  withCell(ctx, 'prop_spike_armed', (c, w, h) => drawSpikeTrap(c, w, h, 'armed'));
  withCell(ctx, 'prop_spike_active', (c, w, h) => drawSpikeTrap(c, w, h, 'active'));
  withCell(ctx, 'prop_pillar_obsidian', (c, w, h) => drawPillar(c, w, h, 'obsidian'));
  withCell(ctx, 'prop_pillar_sanctum', (c, w, h) => drawPillar(c, w, h, 'sanctum'));
  withCell(ctx, 'prop_statue', drawStatue);
  withCell(ctx, 'prop_exit_door_locked', (c, w, h) => drawExitDoor(c, w, h, false));
  withCell(ctx, 'prop_exit_door_open', (c, w, h) => drawExitDoor(c, w, h, true));
  withCell(ctx, 'prop_brazier', drawBrazier);
  withCell(ctx, 'prop_urn', drawUrn);

  // Hero poses
  withCell(ctx, 'hero_down', (c, w, h) => drawHeroPose(c, w, h, 'down'));
  withCell(ctx, 'hero_up', (c, w, h) => drawHeroPose(c, w, h, 'up'));
  withCell(ctx, 'hero_side', (c, w, h) => drawHeroPose(c, w, h, 'side'));
  withCell(ctx, 'hero_diag_down', (c, w, h) => drawHeroPose(c, w, h, 'diag_down'));
  withCell(ctx, 'hero_diag_up', (c, w, h) => drawHeroPose(c, w, h, 'diag_up'));

  // Weapons, Enemies, Bosses, Pickups, Sigils, VFX (Wave 1 + Full Wave 2 Roster!)
  drawWeapons(ctx);
  drawEnemiesAndBosses(ctx);
  drawPickupsAndSigils(ctx);
  drawVfxSprites(ctx);
  drawWave2BiomePropsAndVfx(ctx);
  drawWave2EnemiesAndBosses(ctx);

  cachedAtlas = {
    canvas,
    width: ATLAS_SIZE,
    height: ATLAS_SIZE,
    sprites: ATLAS_SPRITE_RECTS,
  };
  return cachedAtlas;
}

export interface CustomSpritePatchSource {
  getCustomSprite(
    cleanId: string
  ): { readonly image: CanvasImageSource; readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null;
}

/**
 * Clones the built-in 2048x2048 atlas ONCE and overlays any matching custom-pack sprites
 * cleanly into their exact UV slots (preserving built-in fallback for every non-overridden slot).
 */
export function buildCompositeCustomAtlas(
  baseAtlas: BakedAtlas,
  provider: CustomSpritePatchSource
): { canvas: HTMLCanvasElement; overriddenCount: number } {
  const canvas = document.createElement('canvas');
  canvas.width = baseAtlas.width;
  canvas.height = baseAtlas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { canvas: baseAtlas.canvas, overriddenCount: 0 };
  }
  ctx.drawImage(baseAtlas.canvas, 0, 0);

  let overriddenCount = 0;
  for (const [id, rect] of baseAtlas.sprites.entries()) {
    if (id === 'white_pixel') continue;
    const custom = provider.getCustomSprite(id);
    if (!custom || custom.w <= 0 || custom.h <= 0) continue;
    try {
      ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
      ctx.drawImage(custom.image, custom.x, custom.y, custom.w, custom.h, rect.x, rect.y, rect.w, rect.h);
      overriddenCount++;
    } catch {
      // Keep built-in fallback if a custom image source isn't ready
    }
  }
  return { canvas, overriddenCount };
}

export { INK_WARM };
