/**
 * ProceduralInkCelAtlas — Pre-baked 4096x4096 Mythic Comic-Ink Chiaroscuro Sprite Atlas.
 *
 * Pre-renders every weathered floor tile (4 variants x 6 biomes), central chamber
 * mosaic medallion, 3D northern retaining wall, biome-matched southern chasm cliff,
 * fluted pillar, sculpted brazier, Hero pose, Infernal Arm, bespoke Enemy, Boss,
 * Pickup, Patron Sigil, and combat VFX sprite ONCE at startup onto a single 4096x4096
 * offscreen Canvas (zero per-frame canvas allocations).
 *
 * Pure metadata & `getBuiltinAssetIds()` are 100% Node-safe (no DOM access unless
 * `bakeProceduralInkCelAtlas()` is invoked in a browser environment).
 */

import type { BiomeId, EnemyArchetypeId, PatronId, PickupKind, WeaponId } from '../contracts/index.js';
import { PATRON_CONSTANTS } from '../contracts/index.js';

export const ATLAS_SIZE = 4096;

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

interface SpriteSizeDef {
  readonly id: string;
  readonly w: number;
  readonly h: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

interface SpriteSpec extends SpriteSizeDef {
  readonly x: number;
  readonly y: number;
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
// Deterministic Zero-Overlap 4096x4096 Shelf Packer (8px WebGL Bleed Gutters)
// ============================================================================

const SPRITE_SIZE_DEFS: readonly SpriteSizeDef[] = [
  // ---- Floor Flagstone Tiles (256x128 2:1 isometric diamonds) ----
  // All 15 legacy IDs preserved + 12 mandatory Section 3.1/7.2 c/d variants + courtyard a/b aliases
  { id: 'tile_obsidian_a', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_obsidian_b', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_obsidian_c', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_obsidian_d', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_obsidian_cracked', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_obsidian_mosaic', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_sanctum_a', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_sanctum_b', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_sanctum_mosaic', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_courtyard_a', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_courtyard_b', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_courtyard_c', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_courtyard_d', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_cinder_a', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_cinder_b', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_cinder_c', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_cinder_d', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_verdant_a', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_verdant_b', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_verdant_c', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_verdant_d', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_crypt_a', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_crypt_b', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_crypt_c', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_crypt_d', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_summit_a', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_summit_b', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_summit_c', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'tile_summit_d', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },

  // ---- Central Chamber Mosaic Medallions (6 x 384x192 isometric ellipses) ----
  { id: 'prop_medallion_courtyard', w: 384, h: 192, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_medallion_obsidian', w: 384, h: 192, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_medallion_cinder', w: 384, h: 192, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_medallion_verdant', w: 384, h: 192, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_medallion_crypt', w: 384, h: 192, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_medallion_summit', w: 384, h: 192, anchorX: 0.5, anchorY: 0.5 },

  // ---- 3D Northern Retaining Walls (6 x 256x160) & Southern Chasm Cliffs (5 x 256x128) ----
  { id: 'prop_wall_courtyard_n', w: 256, h: 160, anchorX: 0.5, anchorY: 0.96 },
  { id: 'prop_wall_obsidian_n', w: 256, h: 160, anchorX: 0.5, anchorY: 0.96 },
  { id: 'prop_wall_cinder_n', w: 256, h: 160, anchorX: 0.5, anchorY: 0.96 },
  { id: 'prop_wall_verdant_n', w: 256, h: 160, anchorX: 0.5, anchorY: 0.96 },
  { id: 'prop_wall_crypt_n', w: 256, h: 160, anchorX: 0.5, anchorY: 0.96 },
  { id: 'prop_wall_summit_n', w: 256, h: 160, anchorX: 0.5, anchorY: 0.96 },
  { id: 'prop_chasm_rim', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_chasm_cinder', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_chasm_verdant', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_chasm_crypt', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_chasm_summit', w: 256, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'trim_meander', w: 256, h: 48, anchorX: 0.5, anchorY: 0.5 },

  // ---- Architectural Pillars, Obelisks, Doors, Braziers, Sconces, Traps ----
  { id: 'prop_pillar_obsidian', w: 144, h: 288, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_pillar_sanctum', w: 144, h: 288, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_pillar_cinder', w: 144, h: 288, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_pillar_verdant', w: 144, h: 288, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_pillar_crypt', w: 144, h: 288, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_pillar_summit', w: 144, h: 288, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_statue', w: 144, h: 256, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_obelisk', w: 128, h: 256, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_obelisk_verdant', w: 128, h: 256, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_obelisk_summit', w: 128, h: 256, anchorX: 0.5, anchorY: 0.86 },
  { id: 'prop_exit_door_locked', w: 200, h: 232, anchorX: 0.5, anchorY: 0.85 },
  { id: 'prop_exit_door_open', w: 200, h: 232, anchorX: 0.5, anchorY: 0.85 },
  { id: 'prop_brazier', w: 112, h: 128, anchorX: 0.5, anchorY: 0.82 },
  { id: 'prop_wall_sconce', w: 96, h: 128, anchorX: 0.5, anchorY: 0.72 },
  { id: 'prop_urn', w: 88, h: 108, anchorX: 0.5, anchorY: 0.84 },
  { id: 'prop_spike_idle', w: 128, h: 80, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_spike_armed', w: 128, h: 80, anchorX: 0.5, anchorY: 0.5 },
  { id: 'prop_spike_active', w: 128, h: 80, anchorX: 0.5, anchorY: 0.5 },

  // ---- Hero — Prince Pyreus (5 directional combat poses) ----
  { id: 'hero_down', w: 160, h: 176, anchorX: 0.5, anchorY: 0.84 },
  { id: 'hero_up', w: 160, h: 176, anchorX: 0.5, anchorY: 0.84 },
  { id: 'hero_side', w: 160, h: 176, anchorX: 0.5, anchorY: 0.84 },
  { id: 'hero_diag_down', w: 160, h: 176, anchorX: 0.5, anchorY: 0.84 },
  { id: 'hero_diag_up', w: 160, h: 176, anchorX: 0.5, anchorY: 0.84 },

  // ---- All 6 Infernal Arms ----
  { id: 'weapon_stygian_blade', w: 144, h: 56, anchorX: 0.22, anchorY: 0.5 },
  { id: 'weapon_eternal_spear', w: 184, h: 48, anchorX: 0.28, anchorY: 0.5 },
  { id: 'weapon_shield_of_chaos', w: 96, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'weapon_heart_seeking_bow', w: 96, h: 104, anchorX: 0.45, anchorY: 0.5 },
  { id: 'weapon_twin_fists', w: 96, h: 80, anchorX: 0.5, anchorY: 0.5 },
  { id: 'weapon_adamant_rail', w: 152, h: 64, anchorX: 0.3, anchorY: 0.5 },

  // ---- All 22 Regular Enemies + Rattlebones + Generic Shade ----
  { id: 'enemy_numbskull', w: 120, h: 128, anchorX: 0.5, anchorY: 0.78 },
  { id: 'enemy_wretched_husk', w: 176, h: 204, anchorX: 0.5, anchorY: 0.86 },
  { id: 'enemy_bone_archer', w: 152, h: 188, anchorX: 0.5, anchorY: 0.84 },
  { id: 'enemy_brimstone_crystal', w: 136, h: 184, anchorX: 0.5, anchorY: 0.78 },
  { id: 'enemy_ember_lout', w: 184, h: 184, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_rattlebones_dummy', w: 156, h: 204, anchorX: 0.5, anchorY: 0.88 },
  { id: 'enemy_generic_shade', w: 152, h: 188, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_wretch_assassin', w: 136, h: 156, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_slag_thrower', w: 140, h: 156, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_lava_gorgon', w: 136, h: 148, anchorX: 0.5, anchorY: 0.78 },
  { id: 'enemy_bloodless_drifter', w: 140, h: 156, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_infernal_bomber', w: 140, h: 156, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_bone_hydra_head', w: 148, h: 168, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_colosseum_swordsman', w: 140, h: 156, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_colosseum_shieldbearer', w: 148, h: 156, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_colosseum_bowman', w: 144, h: 156, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_chariot_flame', w: 152, h: 140, anchorX: 0.5, anchorY: 0.82 },
  { id: 'enemy_soul_orb', w: 108, h: 108, anchorX: 0.5, anchorY: 0.65 },
  { id: 'enemy_venom_satyr', w: 144, h: 156, anchorX: 0.5, anchorY: 0.85 },
  { id: 'enemy_giant_vermin', w: 160, h: 136, anchorX: 0.5, anchorY: 0.82 },
  { id: 'enemy_snakestone_laser', w: 140, h: 156, anchorX: 0.5, anchorY: 0.78 },
  { id: 'enemy_heavy_brawler', w: 164, h: 164, anchorX: 0.5, anchorY: 0.86 },

  // ---- ALL 8 Bespoke Bosses + Generic Titan ----
  { id: 'boss_warden_malice', w: 304, h: 296, anchorX: 0.5, anchorY: 0.84 },
  { id: 'boss_warden_fury', w: 288, h: 288, anchorX: 0.5, anchorY: 0.85 },
  { id: 'boss_warden_murder', w: 288, h: 288, anchorX: 0.5, anchorY: 0.85 },
  { id: 'boss_bone_leviathan', w: 304, h: 304, anchorX: 0.5, anchorY: 0.85 },
  { id: 'boss_colosseum_bull', w: 292, h: 292, anchorX: 0.5, anchorY: 0.86 },
  { id: 'boss_colosseum_spearlord', w: 276, h: 288, anchorX: 0.5, anchorY: 0.86 },
  { id: 'boss_the_ferryman', w: 284, h: 296, anchorX: 0.5, anchorY: 0.86 },
  { id: 'boss_sovereign_lord', w: 344, h: 312, anchorX: 0.5, anchorY: 0.86 },
  { id: 'boss_generic_titan', w: 272, h: 288, anchorX: 0.5, anchorY: 0.85 },

  // ---- Pickups & Reward Emblems (13) ----
  { id: 'vfx_boon_orb', w: 96, h: 96, anchorX: 0.5, anchorY: 0.55 },
  { id: 'vfx_bloodstone', w: 72, h: 72, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_centaur_heart', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_gold_coin', w: 72, h: 72, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_darkness_orb', w: 80, h: 88, anchorX: 0.5, anchorY: 0.55 },
  { id: 'vfx_pom_icon', w: 80, h: 84, anchorX: 0.5, anchorY: 0.55 },
  { id: 'vfx_hammer_icon', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_skull_badge', w: 80, h: 84, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_shop_purse', w: 80, h: 84, anchorX: 0.5, anchorY: 0.55 },
  { id: 'vfx_fountain_chalice', w: 88, h: 92, anchorX: 0.5, anchorY: 0.55 },
  { id: 'vfx_gemstone', w: 76, h: 76, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_key', w: 76, h: 84, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_nectar', w: 76, h: 88, anchorX: 0.5, anchorY: 0.55 },

  // ---- 10 Patron Sigil Medallions ----
  { id: 'sigil_voltaris', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_tidebreaker', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_aegira', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_velouris', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_sylvara', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_bellum', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_bacchion', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_glaciera', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_veloce', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },
  { id: 'sigil_abyssos', w: 88, h: 88, anchorX: 0.5, anchorY: 0.5 },

  // ---- Combat VFX, Environmental VFX & Persistent Floor Decals (29 = 24 existing + 5 new) ----
  { id: 'vfx_glow_soft', w: 128, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_glow_star', w: 128, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_spark_burst', w: 104, h: 104, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_hit_spark', w: 128, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_spark_streak', w: 128, h: 48, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_slash_grain', w: 256, h: 64, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_light_cone', w: 192, h: 256, anchorX: 0.5, anchorY: 0.08 },
  { id: 'vfx_decal_crater', w: 192, h: 112, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_lightning_bolt', w: 144, h: 72, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_flame_tongue', w: 72, h: 104, anchorX: 0.5, anchorY: 0.85 },
  { id: 'vfx_wave_crest', w: 112, h: 72, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_decal_scorch', w: 144, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_decal_ichor', w: 144, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_decal_crack', w: 144, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_ring_soft', w: 128, h: 128, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_shadow_blob', w: 128, h: 80, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_projectile_orb', w: 64, h: 64, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_projectile_arrow', w: 96, h: 36, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_curing_basin', w: 128, h: 104, anchorX: 0.5, anchorY: 0.62 },
  { id: 'vfx_sawblade', w: 96, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_blade_rift', w: 112, h: 112, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_skull_proj', w: 96, h: 96, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_petal', w: 48, h: 48, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_snowflake', w: 48, h: 48, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_pylon', w: 104, h: 136, anchorX: 0.5, anchorY: 0.82 },
  { id: 'vfx_chaos_gate', w: 144, h: 104, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_muzzle_flash', w: 112, h: 96, anchorX: 0.2, anchorY: 0.5 },
  { id: 'vfx_bow_flash', w: 112, h: 112, anchorX: 0.5, anchorY: 0.5 },
  { id: 'vfx_shield_block', w: 112, h: 128, anchorX: 0.5, anchorY: 0.5 },
];

function packAtlasSpecs(defs: readonly SpriteSizeDef[]): readonly SpriteSpec[] {
  const pad = 8;
  const out: SpriteSpec[] = [{ id: 'white_pixel', x: 4, y: 4, w: 8, h: 8, anchorX: 0.5, anchorY: 0.5 }];
  let cursorX = pad;
  let cursorY = 20;
  let rowH = 0;

  for (const def of defs) {
    if (cursorX + def.w + pad > ATLAS_SIZE) {
      cursorX = pad;
      cursorY += rowH + pad;
      rowH = 0;
    }
    out.push({ ...def, x: cursorX, y: cursorY });
    cursorX += def.w + pad;
    if (def.h > rowH) rowH = def.h;
  }
  return out;
}

const SPRITE_SPECS: readonly SpriteSpec[] = packAtlasSpecs(SPRITE_SIZE_DEFS);

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
      return ['tile_sanctum_a', 'tile_sanctum_b', 'tile_courtyard_c', 'tile_courtyard_d'];
    case 'obsidian_pit':
      return ['tile_obsidian_a', 'tile_obsidian_b', 'tile_obsidian_c', 'tile_obsidian_d'];
    case 'cinder_mire':
      return ['tile_cinder_a', 'tile_cinder_b', 'tile_cinder_c', 'tile_cinder_d'];
    case 'verdant_colosseum':
      return ['tile_verdant_a', 'tile_verdant_b', 'tile_verdant_c', 'tile_verdant_d'];
    case 'crypt_of_bile':
      return ['tile_crypt_a', 'tile_crypt_b', 'tile_crypt_c', 'tile_crypt_d'];
    case 'frozen_summit':
      return ['tile_summit_a', 'tile_summit_b', 'tile_summit_c', 'tile_summit_d'];
  }
}

// ============================================================================
// Comic-Ink Chiaroscuro Primitives (Mignola Shadow Massing + Variable Ink)
// ============================================================================

const INK = '#09060E';
const INK_WARM = '#120810';

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

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
  color = 'rgba(9, 6, 14, 0.55)',
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

/**
 * Fills a closed polygon/path with 3-tone directional cel shading (NW lit -> SE dark),
 * optional heavy #09060E shadow pooling on the SE half + cross-hatching, rim light,
 * and bold comic ink contour.
 */
function paintChiaroscuroShape(
  ctx: CanvasRenderingContext2D,
  tracePath: () => void,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  cols: { lit: string; mid: string; dark: string; rim?: string },
  opts?: { shadowPoolFrac?: number; hatch?: boolean; inkW?: number }
): void {
  const poolFrac = Math.min(0.36, (opts?.shadowPoolFrac ?? 0.34) * 0.82);
  const inkW = opts?.inkW ?? 4.0;

  tracePath();
  const g = ctx.createLinearGradient(bounds.x0, bounds.y0, bounds.x1, bounds.y1);
  g.addColorStop(0, cols.lit);
  g.addColorStop(0.52, cols.mid);
  g.addColorStop(0.9, cols.dark);
  g.addColorStop(1, INK);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  tracePath();
  ctx.clip();

  // Sculpted angular Mignola shadow pool along SE silhouette (preserves vivid NW/mid readability!)
  if (poolFrac > 0.01) {
    const bw = bounds.x1 - bounds.x0;
    const bh = bounds.y1 - bounds.y0;
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.56;
    ctx.beginPath();
    ctx.moveTo(bounds.x1 - bw * poolFrac, bounds.y0 - 4);
    ctx.lineTo(bounds.x1 + 6, bounds.y0 - 4);
    ctx.lineTo(bounds.x1 + 6, bounds.y1 + 6);
    ctx.lineTo(bounds.x0 + bw * (1 - poolFrac * 1.18), bounds.y1 + 6);
    ctx.quadraticCurveTo(
      bounds.x1 - bw * (poolFrac * 0.8),
      bounds.y0 + bh * 0.52,
      bounds.x1 - bw * poolFrac,
      bounds.y0 - 4
    );
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    if (opts?.hatch !== false) {
      drawCrossHatch(
        ctx,
        bounds.x1 - bw * (poolFrac + 0.1),
        bounds.y0 + bh * 0.14,
        bw * 0.22,
        bh * 0.78,
        7.5,
        -0.55,
        'rgba(9, 6, 14, 0.34)',
        1.05
      );
    }
  }

  // Crisp NW colored rim highlight separating actor cleanly off dark arenas
  if (cols.rim) {
    ctx.save();
    ctx.translate(2.0, 1.6);
    tracePath();
    ctx.strokeStyle = cols.rim;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  tracePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = inkW;
  ctx.stroke();
}

function paintTaperedArc(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  width: number,
  color = INK
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  ctx.restore();
}

// ============================================================================
// Master Biome Palettes (Canonical Section 2 Color & Lighting Spec)
// ============================================================================

interface BiomeStonePalette {
  readonly key: 'courtyard' | 'obsidian' | 'cinder' | 'verdant' | 'crypt' | 'summit';
  readonly base: string;
  readonly mid: string;
  readonly lit: string;
  readonly seamRgba: string;
  readonly bevelLit: string;
  readonly bevelDark: string;
  readonly accent: string;
  readonly metal: string;
  readonly wallDark: string;
  readonly wallMid: string;
  readonly wallLit: string;
  readonly cliffTop: string;
  readonly cliffMid: string;
  readonly cliffDeep: string;
  readonly rim: string;
}

const BIOME_PALETTES: Readonly<Record<BiomeStonePalette['key'], BiomeStonePalette>> = {
  courtyard: {
    key: 'courtyard',
    base: '#1E1329',
    mid: '#2A1B3A',
    lit: '#442C59',
    seamRgba: 'rgba(15, 9, 22, 0.48)',
    bevelLit: 'rgba(126, 90, 152, 0.42)',
    bevelDark: 'rgba(9, 6, 14, 0.44)',
    accent: '#E6B84C',
    metal: '#D6A647',
    wallDark: '#160D21',
    wallMid: '#241731',
    wallLit: '#4A3361',
    cliffTop: '#321E45',
    cliffMid: '#1C1129',
    cliffDeep: '#0B0612',
    rim: '#FFAE5C',
  },
  obsidian: {
    key: 'obsidian',
    base: '#15242B',
    mid: '#1E343D',
    lit: '#31515E',
    seamRgba: 'rgba(10, 19, 23, 0.48)',
    bevelLit: 'rgba(104, 178, 176, 0.36)',
    bevelDark: 'rgba(9, 6, 14, 0.44)',
    accent: '#2CE6A8',
    metal: '#C89B44',
    wallDark: '#0E1A20',
    wallMid: '#18272E',
    wallLit: '#324E59',
    cliffTop: '#243C45',
    cliffMid: '#132229',
    cliffDeep: '#060E12',
    rim: '#6CF5C8',
  },
  cinder: {
    key: 'cinder',
    base: '#231312',
    mid: '#331B18',
    lit: '#522B22',
    seamRgba: 'rgba(18, 8, 8, 0.48)',
    bevelLit: 'rgba(166, 94, 62, 0.38)',
    bevelDark: 'rgba(9, 6, 14, 0.46)',
    accent: '#FF5A14',
    metal: '#E8822E',
    wallDark: '#1A0B0A',
    wallMid: '#241212',
    wallLit: '#4A241E',
    cliffTop: '#3C1D18',
    cliffMid: '#210D0C',
    cliffDeep: '#120505',
    rim: '#FFB668',
  },
  verdant: {
    key: 'verdant',
    base: '#1A4049',
    mid: '#265C66',
    lit: '#428B94',
    seamRgba: 'rgba(15, 39, 46, 0.44)',
    bevelLit: 'rgba(148, 224, 224, 0.36)',
    bevelDark: 'rgba(9, 24, 30, 0.42)',
    accent: '#F2C95E',
    metal: '#F2C95E',
    wallDark: '#163A42',
    wallMid: '#24535E',
    wallLit: '#58A4A8',
    cliffTop: '#3A7880',
    cliffMid: '#1D4750',
    cliffDeep: '#0E2932',
    rim: '#FFE694',
  },
  crypt: {
    key: 'crypt',
    base: '#262A18',
    mid: '#383E23',
    lit: '#586135',
    seamRgba: 'rgba(19, 22, 11, 0.48)',
    bevelLit: 'rgba(152, 168, 92, 0.36)',
    bevelDark: 'rgba(9, 12, 6, 0.46)',
    accent: '#9CF024',
    metal: '#C49B3E',
    wallDark: '#181C0E',
    wallMid: '#292E1A',
    wallLit: '#4F5630',
    cliffTop: '#3E4524',
    cliffMid: '#222614',
    cliffDeep: '#0C1207',
    rim: '#C8F068',
  },
  summit: {
    key: 'summit',
    base: '#233347',
    mid: '#334A66',
    lit: '#587BA3',
    seamRgba: 'rgba(18, 28, 41, 0.46)',
    bevelLit: 'rgba(186, 224, 250, 0.42)',
    bevelDark: 'rgba(9, 14, 24, 0.44)',
    accent: '#8CE8FF',
    metal: '#D6F0FF',
    wallDark: '#142133',
    wallMid: '#1F3047',
    wallLit: '#4B6E94',
    cliffTop: '#46688C',
    cliffMid: '#21344D',
    cliffDeep: '#0B1324',
    rim: '#B8EEFF',
  },
};

// ============================================================================
// 1. Weathered Ashlar Masonry Floor Tiles (ZERO Black Diamond Grid!)
// ============================================================================

function drawIsometricStoneTile(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pal: BiomeStonePalette,
  variant: 'a' | 'b' | 'c' | 'd',
  seed: number
): void {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const hw = w * 0.5;
  const hh = h * 0.5;
  const rand = seededRand(seed);

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

  // Base weathered stone gradient (strict 12%–32% floor luminance ceiling!)
  diamondPath(0);
  const baseGrad = ctx.createLinearGradient(cx - hw, cy - hh, cx + hw, cy + hh);
  baseGrad.addColorStop(0, pal.lit);
  baseGrad.addColorStop(0.42, pal.mid);
  baseGrad.addColorStop(1, pal.base);
  ctx.fillStyle = baseGrad;
  ctx.fill();

  ctx.save();
  diamondPath(0.6);
  ctx.clip();

  // Multi-slab asymmetric ashlar sub-blocks (breaks tile uniformity organically!)
  const splitU = variant === 'a' ? 0.08 : variant === 'b' ? -0.14 : variant === 'c' ? 0.16 : 0;
  const splitV = variant === 'a' ? -0.1 : variant === 'b' ? 0.14 : variant === 'c' ? -0.06 : 0.12;
  // Convert isometric (u, v) in [-1..1] to pixel coords inside 2:1 diamond
  const isoPt = (u: number, v: number): [number, number] => [cx + (u - v) * hw * 0.5, cy + (u + v) * hh * 0.5];

  const drawSubSlab = (u0: number, v0: number, u1: number, v1: number, shade: number) => {
    const p0 = isoPt(u0, v0);
    const p1 = isoPt(u1, v0);
    const p2 = isoPt(u1, v1);
    const p3 = isoPt(u0, v1);
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.fillStyle = shade > 0 ? pal.lit : pal.base;
    ctx.globalAlpha = Math.abs(shade);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Subtle recessed ashlar joint between sub-slabs (NEVER harsh jet black!)
    ctx.strokeStyle = pal.seamRgba;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Subtle NW chipped edge highlight on sub-slab
    ctx.strokeStyle = pal.bevelLit;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(p3[0] + 1.5, p3[1]);
    ctx.lineTo(p0[0], p0[1] + 1.2);
    ctx.lineTo(p1[0] - 1.5, p1[1]);
    ctx.stroke();
  };

  if (variant === 'a') {
    drawSubSlab(-1, -1, splitU, 1, 0.16);
    drawSubSlab(splitU, -1, 1, splitV, -0.14);
    drawSubSlab(splitU, splitV, 1, 1, -0.24);
  } else if (variant === 'b') {
    drawSubSlab(-1, -1, 1, splitV, 0.14);
    drawSubSlab(-1, splitV, splitU, 1, -0.16);
    drawSubSlab(splitU, splitV, 1, 1, -0.22);
  } else if (variant === 'c') {
    drawSubSlab(-1, -1, splitU, splitV, 0.18);
    drawSubSlab(splitU, -1, 1, splitV, -0.12);
    drawSubSlab(-1, splitV, 0.25, 1, -0.18);
    drawSubSlab(0.25, splitV, 1, 1, -0.34); // stepped sunken battle-scarred corner
  } else {
    // Variant d: carved ashlar border band + subtle worn meander/chevron recess
    drawSubSlab(-1, -1, 1, 1, 0.08);
    drawSubSlab(-0.62, -0.62, 0.62, 0.62, -0.18);
  }

  // Weathered stone grain speckles & mineral pitting
  for (let i = 0; i < 28; i++) {
    const u = rand() * 1.8 - 0.9;
    const v = rand() * 1.8 - 0.9;
    const [px, py] = isoPt(u, v);
    ctx.fillStyle = i % 3 === 0 ? pal.bevelLit : pal.seamRgba;
    ctx.globalAlpha = 0.22 + rand() * 0.22;
    ctx.beginPath();
    ctx.ellipse(px, py, 2 + rand() * 5, 1 + rand() * 2.5, rand() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Subtle comic shadow hatching tucked in lower SE bevel
  drawCrossHatch(ctx, cx + 14, cy + 8, hw * 0.65, hh * 0.58, 11, -0.52, 'rgba(9, 6, 14, 0.12)', 0.9);

  // Variant-specific subtle biome material details (ZERO gaudy yellow 4-point stars!)
  if (variant === 'b') {
    if (pal.key === 'courtyard') {
      // Subtle tarnished bronze corner inlay fret
      const p0 = isoPt(-0.65, -0.65);
      const p1 = isoPt(-0.22, -0.65);
      const p2 = isoPt(-0.22, -0.35);
      ctx.strokeStyle = 'rgba(214, 166, 71, 0.42)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    } else if (pal.key === 'obsidian') {
      // Faint hairline stygian jade mineral vein
      ctx.strokeStyle = 'rgba(44, 230, 168, 0.36)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - 42, cy - 12);
      ctx.lineTo(cx - 10, cy + 4);
      ctx.lineTo(cx + 28, cy - 6);
      ctx.stroke();
    } else if (pal.key === 'cinder') {
      // Recessed volcanic hairline ember crack
      ctx.strokeStyle = 'rgba(9, 6, 14, 0.65)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(cx - 38, cy + 6);
      ctx.lineTo(cx - 4, cy - 8);
      ctx.lineTo(cx + 34, cy + 12);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 114, 36, 0.56)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (pal.key === 'verdant') {
      // Subtle weathered gilded laurel scroll edge + tiny fallen rose petal
      ctx.strokeStyle = 'rgba(242, 201, 94, 0.38)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(cx - 12, cy - 4, 24, 0.2, 2.2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 108, 196, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx + 34, cy - 8, 5, 2.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (pal.key === 'crypt') {
      // Damp olive-chartreuse catacomb moss patch tucked in mortar joint
      ctx.fillStyle = 'rgba(116, 168, 36, 0.32)';
      ctx.beginPath();
      ctx.ellipse(cx - 22, cy + 10, 22, 10, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(156, 240, 36, 0.22)';
      ctx.beginPath();
      ctx.ellipse(cx - 16, cy + 8, 10, 5, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (pal.key === 'summit') {
      // Wind-swept boreal snow drift hugging NW stone lip
      ctx.fillStyle = 'rgba(214, 240, 255, 0.28)';
      ctx.beginPath();
      ctx.moveTo(cx - 64, cy - 12);
      ctx.quadraticCurveTo(cx - 12, cy - 44, cx + 28, cy - 22);
      ctx.quadraticCurveTo(cx - 18, cy - 18, cx - 64, cy - 12);
      ctx.closePath();
      ctx.fill();
    }
  } else if (variant === 'c') {
    // Fractured battle-scarred fissure + pebble scatter
    ctx.strokeStyle = 'rgba(9, 6, 14, 0.58)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(cx - 52, cy - 4);
    ctx.lineTo(cx - 14, cy + 6);
    ctx.lineTo(cx + 12, cy - 14);
    ctx.moveTo(cx - 14, cy + 6);
    ctx.lineTo(cx + 26, cy + 20);
    ctx.stroke();
    for (let p = 0; p < 5; p++) {
      ctx.fillStyle = p % 2 === 0 ? pal.lit : pal.base;
      ctx.beginPath();
      ctx.ellipse(cx - 18 + rand() * 54, cy - 10 + rand() * 28, 3 + rand() * 3, 1.8 + rand() * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (variant === 'd') {
    // Subtle worn recessed Greek chevron inlay (low contrast so floor stays calm!)
    const pA = isoPt(-0.56, -0.56);
    const pB = isoPt(0.56, -0.56);
    const pC = isoPt(0.56, 0.56);
    const pD = isoPt(-0.56, 0.56);
    ctx.strokeStyle = pal.metal;
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(pA[0], pA[1]);
    ctx.lineTo(pB[0], pB[1]);
    ctx.lineTo(pC[0], pC[1]);
    ctx.lineTo(pD[0], pD[1]);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Broken weathered perimeter mortar edges (LOW-CONTRAST 0.38–0.48 alpha, interrupted by stone overhang!)
  ctx.strokeStyle = pal.seamRgba;
  ctx.lineWidth = 1.8;
  ctx.setLineDash([42, 10, 34, 8]);
  diamondPath(0.9);
  ctx.stroke();
  ctx.setLineDash([]);

  // Soft NW lit stone lip & SE recessed lip
  ctx.strokeStyle = pal.bevelLit;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - hw + 8, cy);
  ctx.lineTo(cx, cy - hh + 4);
  ctx.lineTo(cx + hw - 14, cy - 3);
  ctx.stroke();

  ctx.strokeStyle = pal.bevelDark;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx - hw + 10, cy + 2);
  ctx.lineTo(cx, cy + hh - 3);
  ctx.lineTo(cx + hw - 8, cy + 1);
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// 2. Central Chamber Mosaic Medallions, 3D Retaining Walls & Biome Chasm Cliffs
// ============================================================================

function drawChamberMedallion(ctx: CanvasRenderingContext2D, w: number, h: number, pal: BiomeStonePalette): void {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const rx = w * 0.46;
  const ry = h * 0.44;

  // Outer carved stone ring recessed into arena floor
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  const baseG = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.2, 8, cx, cy, rx);
  baseG.addColorStop(0, pal.lit);
  baseG.addColorStop(0.55, pal.mid);
  baseG.addColorStop(1, pal.base);
  ctx.fillStyle = baseG;
  ctx.fill();
  ctx.strokeStyle = 'rgba(9, 6, 14, 0.62)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Concentric inlaid metal sanctuary rings & radial mosaic stone wedges
  ctx.strokeStyle = pal.metal;
  ctx.globalAlpha = 0.62;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.64, ry * 0.64, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 12 radial carved stone segments & classical compass rays
  for (let i = 0; i < 12; i++) {
    const ang = (i * Math.PI * 2) / 12;
    const x0 = cx + Math.cos(ang) * rx * 0.64;
    const y0 = cy + Math.sin(ang) * ry * 0.64;
    const x1 = cx + Math.cos(ang) * rx * 0.88;
    const y1 = cy + Math.sin(ang) * ry * 0.88;
    ctx.strokeStyle = i % 3 === 0 ? pal.metal : pal.seamRgba;
    ctx.lineWidth = i % 3 === 0 ? 2.8 : 1.6;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // Central biome heraldic compass rose inlay
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = pal.base;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.56, ry * 0.56, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = pal.metal;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const rMult = i % 2 === 0 ? (i % 4 === 0 ? 0.52 : 0.36) : 0.16;
    const ang = (i * Math.PI) / 8;
    const px = cx + Math.cos(ang) * rx * rMult;
    const py = cy + Math.sin(ang) * ry * rMult;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Inner biome emissive core stone
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.12, ry * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawNorthRetainingWall(ctx: CanvasRenderingContext2D, w: number, h: number, pal: BiomeStonePalette): void {
  // Base recessed masonry wall face (true 3D vertical architectural depth!)
  const wallG = ctx.createLinearGradient(0, 26, 0, h);
  wallG.addColorStop(0, pal.wallLit);
  wallG.addColorStop(0.42, pal.wallMid);
  wallG.addColorStop(0.84, pal.wallDark);
  wallG.addColorStop(1, INK);
  ctx.fillStyle = wallG;
  ctx.fillRect(0, 24, w, h - 24);

  // Carved ashlar stone block courses + recessed shadow niches
  ctx.strokeStyle = 'rgba(9, 6, 14, 0.55)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 4; row++) {
    const ry = 42 + row * 28;
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(w, ry);
    ctx.stroke();
    const off = (row & 1) * 32;
    for (let bx = off; bx < w; bx += 64) {
      ctx.beginPath();
      ctx.moveTo(bx, ry);
      ctx.lineTo(bx, ry + 28);
      ctx.stroke();
    }
  }

  // Recessed central sanctuary arch niche casting deep Mignola shadow
  ctx.fillStyle = 'rgba(9, 6, 14, 0.62)';
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h - 10);
  ctx.lineTo(w * 0.34, 72);
  ctx.quadraticCurveTo(w * 0.5, 42, w * 0.66, 72);
  ctx.lineTo(w * 0.66, h - 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = pal.metal;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Flanking fluted stone pilasters casting SE ground-ward shadows
  for (const px of [12, w - 40]) {
    const pG = ctx.createLinearGradient(px, 24, px + 28, 24);
    pG.addColorStop(0, pal.wallLit);
    pG.addColorStop(0.55, pal.wallMid);
    pG.addColorStop(1, INK);
    ctx.fillStyle = pG;
    ctx.fillRect(px, 24, 28, h - 28);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(px, 24, 28, h - 28);
    // Cast shadow to the right of pilaster
    ctx.fillStyle = 'rgba(9, 6, 14, 0.52)';
    ctx.fillRect(px + 28, 30, 14, h - 34);
  }

  // Heavy chiaroscuro cross-hatching along lower wall shadow skirt
  drawCrossHatch(ctx, 0, h - 46, w, 46, 8, -0.45, 'rgba(9, 6, 14, 0.45)', 1.4);

  // Biome-specific wall accent motif
  if (pal.key === 'cinder') {
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(78, 86);
    ctx.lineTo(96, 110);
    ctx.lineTo(88, 134);
    ctx.moveTo(176, 74);
    ctx.lineTo(162, 108);
    ctx.stroke();
  } else if (pal.key === 'verdant') {
    // Hanging pink blossom laurel vine draping off cornice
    ctx.strokeStyle = '#2B7A4B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(54, 28);
    ctx.quadraticCurveTo(86, 62, 118, 42);
    ctx.quadraticCurveTo(160, 74, 206, 34);
    ctx.stroke();
    ctx.fillStyle = '#FF64B8';
    for (const [bx, by] of [
      [78, 52],
      [126, 46],
      [168, 58],
    ]) {
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pal.key === 'crypt') {
    ctx.fillStyle = 'rgba(140, 230, 34, 0.45)';
    for (const sx of [68, 128, 186]) {
      ctx.fillRect(sx, 28, 4, 34 + (sx % 24));
    }
  } else if (pal.key === 'summit') {
    // Glacial icicles hanging under cornice ledge
    ctx.fillStyle = '#B8EAFF';
    for (let x = 22; x < w - 16; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x - 6, 26);
      ctx.lineTo(x, 44 + (x % 18));
      ctx.lineTo(x + 6, 26);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Overhanging Beveled Top Cornice Ledge + Gilded Trim!
  const cornG = ctx.createLinearGradient(0, 4, 0, 30);
  cornG.addColorStop(0, pal.lit);
  cornG.addColorStop(0.55, pal.wallLit);
  cornG.addColorStop(1, pal.wallDark);
  ctx.fillStyle = cornG;
  ctx.fillRect(0, 4, w, 24);
  ctx.fillStyle = pal.metal;
  ctx.fillRect(0, 22, w, 5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.lineTo(w, 5);
  ctx.moveTo(0, 28);
  ctx.lineTo(w, 28);
  ctx.stroke();

  // Bottom dark AO contact shadow line
  const ao = ctx.createLinearGradient(0, h - 18, 0, h);
  ao.addColorStop(0, 'rgba(9, 6, 14, 0)');
  ao.addColorStop(1, 'rgba(9, 6, 14, 0.85)');
  ctx.fillStyle = ao;
  ctx.fillRect(0, h - 18, w, 18);
}

function drawBiomeChasmCliff(ctx: CanvasRenderingContext2D, w: number, h: number, pal: BiomeStonePalette): void {
  // Deep vertical strata fading cleanly into abyssal void below
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, pal.cliffTop);
  grad.addColorStop(0.24, pal.cliffMid);
  grad.addColorStop(0.72, pal.cliffDeep);
  grad.addColorStop(1, 'rgba(9, 6, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Dark overhanging AO lip directly under southern floor parapet
  ctx.fillStyle = 'rgba(9, 6, 14, 0.72)';
  ctx.fillRect(0, 0, w, 10);
  ctx.fillStyle = pal.metal;
  ctx.fillRect(0, 2, w, 4);

  // Biome-authentic carved rock/arch/ice cliff architecture!
  if (pal.key === 'verdant') {
    // Fluted ivory-teal marble colonnade arches & hanging pink laurel vines!
    for (let x = 0; x < w; x += 64) {
      // Fluted marble pier
      const pierG = ctx.createLinearGradient(x, 12, x + 22, 12);
      pierG.addColorStop(0, '#6EB4B8');
      pierG.addColorStop(0.5, '#2E6670');
      pierG.addColorStop(1, '#102932');
      ctx.fillStyle = pierG;
      ctx.fillRect(x, 10, 22, h - 18);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(x, 10, 22, h - 18);
      // Recessed shaded archway between piers
      ctx.fillStyle = 'rgba(9, 24, 30, 0.72)';
      ctx.beginPath();
      ctx.arc(x + 43, 46, 20, Math.PI, 0);
      ctx.lineTo(x + 63, h - 12);
      ctx.lineTo(x + 23, h - 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = pal.metal;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
    ctx.strokeStyle = '#369664';
    ctx.lineWidth = 2.5;
    for (let x = 28; x < w; x += 52) {
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.quadraticCurveTo(x + 8, 38, x - 4, 68);
      ctx.stroke();
      ctx.fillStyle = '#FF64B8';
      ctx.beginPath();
      ctx.arc(x + 2, 42, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pal.key === 'cinder') {
    // Sculpted angular volcanic basalt cliff crags split by glowing #FF5814 magma seams!
    for (let x = 0; x < w; x += 42) {
      ctx.fillStyle = (x / 42) % 2 === 0 ? '#381B16' : '#26100E';
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x + 40, 8);
      ctx.lineTo(x + 34, 52);
      ctx.lineTo(x + 42, h - 10);
      ctx.lineTo(x + 4, h - 14);
      ctx.lineTo(x - 4, 48);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(x + 40, 8);
      ctx.lineTo(x + 34, 52);
      ctx.lineTo(x + 42, h - 12);
      ctx.stroke();
      ctx.strokeStyle = '#FF5814';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  } else if (pal.key === 'crypt') {
    // Vaulted catacomb brickwork & dripping chartreuse bile rivulets
    for (let x = 20; x < w; x += 48) {
      ctx.fillStyle = 'rgba(12, 18, 7, 0.72)';
      ctx.fillRect(x, 14, 24, h - 28);
      ctx.strokeStyle = '#8CE622';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(x + 12, 10);
      ctx.lineTo(x + 12, 66 + (x % 36));
      ctx.stroke();
    }
  } else if (pal.key === 'summit') {
    // Sheer jagged glacial frost crags & translucent cyan icicles
    for (let x = 10; x < w; x += 32) {
      ctx.fillStyle = x % 64 === 10 ? '#8AD8FF' : '#4C7BA6';
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x + 14, 58 + (x % 42));
      ctx.lineTo(x + 28, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
  } else {
    // Obsidian/Courtyard jagged basalt strata + spectral jade crack veins + chains
    for (let x = 22; x < w; x += 38) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x + 7, 46);
      ctx.lineTo(x - 5, h - 14);
      ctx.stroke();
      if (x % 76 === 22) {
        ctx.strokeStyle = 'rgba(44, 230, 168, 0.52)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  }

  drawCrossHatch(ctx, 0, 16, w, h - 24, 9, 0.35, 'rgba(9, 6, 14, 0.45)', 1.4);
}

// ============================================================================
// 3. Fluted Architectural Pillars, Cast-Bronze Brazier, Sconce, Obelisks, Props
// ============================================================================

function drawFlutedPillar(ctx: CanvasRenderingContext2D, w: number, h: number, pal: BiomeStonePalette): void {
  const cx = w * 0.5;
  const baseY = h * 0.88;
  const topY = h * 0.09;
  const shaftW = w * 0.54;

  // Stepped isometric octagonal pedestal plinth with dark AO underside
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - shaftW * 0.86, baseY + 4);
      ctx.lineTo(cx - shaftW * 0.54, baseY - 22);
      ctx.lineTo(cx + shaftW * 0.54, baseY - 22);
      ctx.lineTo(cx + shaftW * 0.86, baseY + 4);
      ctx.lineTo(cx + shaftW * 0.56, baseY + 26);
      ctx.lineTo(cx - shaftW * 0.56, baseY + 26);
      ctx.closePath();
    },
    { x0: cx - shaftW * 0.86, y0: baseY - 22, x1: cx + shaftW * 0.86, y1: baseY + 26 },
    { lit: pal.wallLit, mid: pal.wallMid, dark: pal.wallDark, rim: pal.rim },
    { shadowPoolFrac: 0.4, inkW: 4.4 }
  );

  // Upper torus base molding ring
  ctx.fillStyle = pal.metal;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 12, shaftW * 0.58, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  // Main Fluted Column Shaft (6 sculpted concave flutes + deep SE chiaroscuro mass!)
  ctx.save();
  const traceShaft = () => {
    ctx.beginPath();
    ctx.moveTo(cx - shaftW * 0.5, baseY - 10);
    ctx.lineTo(cx - shaftW * 0.45, topY + 34);
    ctx.lineTo(cx + shaftW * 0.45, topY + 34);
    ctx.lineTo(cx + shaftW * 0.5, baseY - 10);
    ctx.closePath();
  };
  traceShaft();
  const sGrad = ctx.createLinearGradient(cx - shaftW * 0.5, 0, cx + shaftW * 0.5, 0);
  sGrad.addColorStop(0, pal.lit);
  sGrad.addColorStop(0.28, pal.wallLit);
  sGrad.addColorStop(0.56, pal.wallMid);
  sGrad.addColorStop(0.8, pal.wallDark);
  sGrad.addColorStop(1, INK);
  ctx.fillStyle = sGrad;
  ctx.fill();
  ctx.clip();

  // 6 concave classical flutes with alternating lit ridges & dark troughs
  for (let i = -2; i <= 2; i++) {
    const fx = cx + i * (shaftW * 0.17);
    const fw = shaftW * 0.08;
    ctx.fillStyle = i < 0 ? 'rgba(255, 255, 255, 0.14)' : 'rgba(9, 6, 14, 0.58)';
    ctx.fillRect(fx - fw * 0.5, topY + 36, fw, baseY - topY - 48);
    ctx.strokeStyle = i < 0 ? 'rgba(9, 6, 14, 0.42)' : INK;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(fx + fw * 0.5, topY + 36);
    ctx.lineTo(fx + fw * 0.5, baseY - 12);
    ctx.stroke();
  }

  // Heavy Mignola SE half shadow pool + cross-hatching
  ctx.fillStyle = 'rgba(9, 6, 14, 0.68)';
  ctx.fillRect(cx + shaftW * 0.08, topY + 32, shaftW * 0.52, baseY - topY);
  drawCrossHatch(ctx, cx - 2, topY + 36, shaftW * 0.48, baseY - topY - 40, 7, -0.5, 'rgba(9, 6, 14, 0.6)', 1.4);

  // Carved horizontal stone block seams & biome-specific motifs!
  for (const bandFrac of [0.36, 0.66]) {
    const by = topY + (baseY - topY) * bandFrac;
    ctx.strokeStyle = 'rgba(9, 6, 14, 0.7)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(cx - shaftW * 0.52, by);
    ctx.lineTo(cx + shaftW * 0.52, by + 3);
    ctx.stroke();
  }

  if (pal.key === 'cinder') {
    // Glowing magma fissure cracks splitting basalt column
    ctx.strokeStyle = '#FF6418';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(cx - 18, baseY - 78);
    ctx.lineTo(cx - 4, baseY - 112);
    ctx.lineTo(cx + 12, baseY - 134);
    ctx.stroke();
  } else if (pal.key === 'verdant') {
    // Twining laurel vine & pink blossoms spiraling shaft
    ctx.strokeStyle = '#2A8A56';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(cx - 28, baseY - 30);
    ctx.bezierCurveTo(cx + 32, baseY - 82, cx - 34, baseY - 136, cx + 22, topY + 46);
    ctx.stroke();
    ctx.fillStyle = '#FF64B8';
    for (const [vx, vy] of [
      [cx - 8, baseY - 64],
      [cx + 10, baseY - 106],
      [cx - 12, baseY - 148],
    ]) {
      ctx.beginPath();
      ctx.arc(vx, vy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pal.key === 'crypt') {
    // Bronze skull-band & dripping acid moss
    ctx.fillStyle = '#8C6E2A';
    ctx.fillRect(cx - shaftW * 0.5, baseY - 110, shaftW, 14);
    ctx.fillStyle = 'rgba(140, 230, 34, 0.45)';
    ctx.fillRect(cx - 14, topY + 36, 12, 42);
  } else if (pal.key === 'summit') {
    // Frosted snow-ice crust hugging NW flank
    ctx.fillStyle = 'rgba(214, 244, 255, 0.48)';
    ctx.beginPath();
    ctx.moveTo(cx - shaftW * 0.5, topY + 34);
    ctx.lineTo(cx - 4, topY + 34);
    ctx.lineTo(cx - 18, topY + 114);
    ctx.lineTo(cx - shaftW * 0.5, topY + 136);
    ctx.closePath();
    ctx.fill();
  } else {
    // Courtyard/Obsidian carved metallic inlaid collar band
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(cx - shaftW * 0.44, baseY - 86);
    ctx.lineTo(cx, baseY - 94);
    ctx.lineTo(cx + shaftW * 0.44, baseY - 86);
    ctx.stroke();
  }
  ctx.restore();

  traceShaft();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4;
  ctx.stroke();

  // Carved Overhanging Echinus + Volute Scrolls + Stepped Abacus Capital!
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - shaftW * 0.78, topY + 34);
      ctx.lineTo(cx - shaftW * 0.86, topY + 10);
      ctx.lineTo(cx - shaftW * 0.46, topY - 4);
      ctx.lineTo(cx + shaftW * 0.46, topY - 4);
      ctx.lineTo(cx + shaftW * 0.86, topY + 10);
      ctx.lineTo(cx + shaftW * 0.78, topY + 34);
      ctx.closePath();
    },
    { x0: cx - shaftW * 0.86, y0: topY - 4, x1: cx + shaftW * 0.86, y1: topY + 34 },
    { lit: '#FFF2B8', mid: pal.metal, dark: '#4F2E0C', rim: pal.rim },
    { shadowPoolFrac: 0.36, inkW: 4.2 }
  );

  // Ionic/Corinthian spiral volutes at capital corners
  for (const dir of [-1, 1] as const) {
    ctx.fillStyle = pal.metal;
    ctx.beginPath();
    ctx.arc(cx + dir * shaftW * 0.62, topY + 26, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Razor left-edge rim light
  paintTaperedArc(ctx, cx - shaftW * 0.45, topY + 38, cx - shaftW * 0.48, (topY + baseY) * 0.5, cx - shaftW * 0.49, baseY - 14, 2.6, pal.rim);
}

function drawSculptedBrazier(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const baseY = h * 0.84;

  // Center forged bronze pedestal support + dark contact shadow collar
  ctx.fillStyle = '#241818';
  ctx.beginPath();
  ctx.moveTo(cx - 10, baseY - 34);
  ctx.lineTo(cx + 10, baseY - 34);
  ctx.lineTo(cx + 15, baseY + 10);
  ctx.lineTo(cx - 15, baseY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Curved Cast-Bronze Lion-Foot Tripod Legs (NO 3 straight sticks!)
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 20, baseY - 42);
    ctx.bezierCurveTo(cx + dir * 40, baseY - 34, cx + dir * 34, baseY - 6, cx + dir * 40, baseY + 8);
    ctx.lineTo(cx + dir * 28, baseY + 10);
    ctx.bezierCurveTo(cx + dir * 22, baseY - 8, cx + dir * 26, baseY - 26, cx + dir * 12, baseY - 32);
    ctx.closePath();
    const legG = ctx.createLinearGradient(cx + dir * 12, baseY - 42, cx + dir * 40, baseY + 10);
    legG.addColorStop(0, dir < 0 ? '#E5B24C' : '#8A5620');
    legG.addColorStop(0.55, '#543214');
    legG.addColorStop(1, INK);
    ctx.fillStyle = legG;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.6;
    ctx.stroke();
  }

  // Sculpted Fluted Cast-Bronze Fire-Bowl with Mignola shadow pool
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - 42, baseY - 50);
      ctx.bezierCurveTo(cx - 40, baseY - 18, cx - 18, baseY - 14, cx, baseY - 14);
      ctx.bezierCurveTo(cx + 18, baseY - 14, cx + 40, baseY - 18, cx + 42, baseY - 50);
      ctx.closePath();
    },
    { x0: cx - 42, y0: baseY - 50, x1: cx + 42, y1: baseY - 14 },
    { lit: '#E8B24A', mid: '#8A5422', dark: '#2E180C', rim: '#FFE89E' },
    { shadowPoolFrac: 0.42, inkW: 4.0 }
  );

  // Embossed vertical bronze bowl flutes & ornamental ring handles
  for (const fx of [-22, -8, 8, 22]) {
    ctx.strokeStyle = fx < 0 ? 'rgba(255, 228, 150, 0.42)' : 'rgba(9, 6, 14, 0.65)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx + fx, baseY - 44);
    ctx.quadraticCurveTo(cx + fx * 0.85, baseY - 28, cx + fx * 0.65, baseY - 18);
    ctx.stroke();
  }

  // Beveled Hammered-Gold Fire-Bowl Rim
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 50, 42, 14, 0, 0, Math.PI * 2);
  const rimG = ctx.createLinearGradient(cx - 42, baseY - 50, cx + 42, baseY - 50);
  rimG.addColorStop(0, '#FFF0A8');
  rimG.addColorStop(0.45, '#D49232');
  rimG.addColorStop(1, '#4A280C');
  ctx.fillStyle = rimG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();

  // Glowing Cracked Incandescent Coal Mound inside Fire-Bowl!
  ctx.beginPath();
  ctx.ellipse(cx, baseY - 50, 32, 9.5, 0, 0, Math.PI * 2);
  const coalG = ctx.createRadialGradient(cx - 4, baseY - 52, 2, cx, baseY - 50, 32);
  coalG.addColorStop(0, '#FFFAC2');
  coalG.addColorStop(0.42, '#FF8C1E');
  coalG.addColorStop(0.8, '#C82810');
  coalG.addColorStop(1, '#3A0A08');
  ctx.fillStyle = coalG;
  ctx.fill();

  // Charred angular ember chunks perched atop hot coals
  ctx.fillStyle = '#220B0A';
  for (const [ox, oy, rx, ry] of [
    [-14, -50, 6, 3.5],
    [12, -49, 7, 3.5],
    [-2, -46, 5, 3],
  ]) {
    ctx.beginPath();
    ctx.ellipse(cx + ox, baseY + oy, rx, ry, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWallSconce(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const bracketY = h * 0.72;
  // Iron wall backplate
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx, bracketY - 46);
      ctx.lineTo(cx + 18, bracketY - 26);
      ctx.lineTo(cx + 14, bracketY + 24);
      ctx.lineTo(cx, bracketY + 34);
      ctx.lineTo(cx - 14, bracketY + 24);
      ctx.lineTo(cx - 18, bracketY - 26);
      ctx.closePath();
    },
    { x0: cx - 18, y0: bracketY - 46, x1: cx + 18, y1: bracketY + 34 },
    { lit: '#B88438', mid: '#5E3A18', dark: '#1E110A' },
    { shadowPoolFrac: 0.42, inkW: 3.4 }
  );
  // Torch cup & leaping comic-ink flame
  ctx.fillStyle = '#E5AE3C';
  ctx.beginPath();
  ctx.moveTo(cx - 20, bracketY - 22);
  ctx.lineTo(cx + 20, bracketY - 22);
  ctx.lineTo(cx + 10, bracketY + 2);
  ctx.lineTo(cx - 10, bracketY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Multi-tongue flame
  ctx.beginPath();
  ctx.moveTo(cx, 10);
  ctx.bezierCurveTo(cx + 22, 34, cx + 22, bracketY - 18, cx, bracketY - 20);
  ctx.bezierCurveTo(cx - 22, bracketY - 18, cx - 22, 34, cx, 10);
  ctx.closePath();
  const fG = ctx.createLinearGradient(cx, 12, cx, bracketY - 20);
  fG.addColorStop(0, '#FFF8B8');
  fG.addColorStop(0.45, '#FF881E');
  fG.addColorStop(1, '#CC1E14');
  ctx.fillStyle = fG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.0;
  ctx.stroke();
}

function drawObelisk(ctx: CanvasRenderingContext2D, w: number, h: number, pal: BiomeStonePalette): void {
  const cx = w * 0.5;
  const baseY = h * 0.88;

  // Stepped carved plinth
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - 44, baseY + 2);
      ctx.lineTo(cx - 32, baseY - 22);
      ctx.lineTo(cx + 32, baseY - 22);
      ctx.lineTo(cx + 44, baseY + 2);
      ctx.lineTo(cx + 30, baseY + 20);
      ctx.lineTo(cx - 30, baseY + 20);
      ctx.closePath();
    },
    { x0: cx - 44, y0: baseY - 22, x1: cx + 44, y1: baseY + 20 },
    { lit: pal.wallLit, mid: pal.wallMid, dark: pal.wallDark, rim: pal.rim },
    { shadowPoolFrac: 0.42, inkW: 4.0 }
  );

  // Tapered pyramidion obelisk spire
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - 28, baseY - 14);
      ctx.lineTo(cx - 20, h * 0.22);
      ctx.lineTo(cx, h * 0.06);
      ctx.lineTo(cx + 20, h * 0.22);
      ctx.lineTo(cx + 28, baseY - 14);
      ctx.closePath();
    },
    { x0: cx - 28, y0: h * 0.06, x1: cx + 28, y1: baseY - 14 },
    { lit: pal.lit, mid: pal.wallMid, dark: pal.wallDark, rim: pal.rim },
    { shadowPoolFrac: 0.48, inkW: 4.2 }
  );

  // Gilded collar frieze & glowing biome sigil crystal
  ctx.fillStyle = pal.metal;
  ctx.fillRect(cx - 25, h * 0.34, 50, 12);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(cx - 25, h * 0.34, 50, 12);

  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.47);
  ctx.lineTo(cx + 12, h * 0.58);
  ctx.lineTo(cx, h * 0.69);
  ctx.lineTo(cx - 12, h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.stroke();
}

function drawMeanderTrim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#120E18';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#B8842E';
  ctx.fillRect(0, 4, w, 5);
  ctx.fillRect(0, h - 9, w, 5);
  ctx.fillStyle = '#FFF0B8';
  ctx.fillRect(0, 4, w, 2);

  ctx.strokeStyle = '#E5B952';
  ctx.lineWidth = 4;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  for (let x = 0; x < w; x += 32) {
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
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.strokeRect(1.4, 1.4, w - 2.8, h - 2.8);
}

function drawExitDoor(ctx: CanvasRenderingContext2D, w: number, h: number, open: boolean): void {
  const cx = w * 0.5;
  const baseY = h * 0.88;
  const archTop = h * 0.14;
  const archW = w * 0.76;

  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - archW * 0.54, baseY);
      ctx.lineTo(cx - archW * 0.5, archTop + 44);
      ctx.quadraticCurveTo(cx - archW * 0.46, archTop, cx, archTop - 6);
      ctx.quadraticCurveTo(cx + archW * 0.46, archTop, cx + archW * 0.5, archTop + 44);
      ctx.lineTo(cx + archW * 0.54, baseY);
      ctx.closePath();
    },
    { x0: cx - archW * 0.54, y0: archTop - 6, x1: cx + archW * 0.54, y1: baseY },
    { lit: '#567874', mid: '#263C3F', dark: '#0E171C', rim: '#9CEBD8' },
    { shadowPoolFrac: 0.36, inkW: 4.8 }
  );

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
    const portalGrad = ctx.createRadialGradient(cx, baseY - 72, 8, cx, baseY - 72, 94);
    portalGrad.addColorStop(0, '#F6FFFC');
    portalGrad.addColorStop(0.35, '#59F2B4');
    portalGrad.addColorStop(0.75, '#16665C');
    portalGrad.addColorStop(1, '#081D20');
    ctx.fillStyle = portalGrad;
  } else {
    const closedGrad = ctx.createLinearGradient(cx, archTop + 20, cx, baseY);
    closedGrad.addColorStop(0, '#181022');
    closedGrad.addColorStop(1, INK);
    ctx.fillStyle = closedGrad;
  }
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();

  if (!open) {
    ctx.save();
    innerPath();
    ctx.clip();
    ctx.strokeStyle = '#33414A';
    ctx.lineWidth = 7;
    for (let x = -2; x <= 2; x++) {
      ctx.beginPath();
      ctx.moveTo(cx + x * 18, archTop + 18);
      ctx.lineTo(cx + x * 18, baseY);
      ctx.stroke();
    }
    ctx.strokeStyle = '#D49E3E';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - archW * 0.35, baseY - 54);
    ctx.lineTo(cx + archW * 0.35, baseY - 54);
    ctx.moveTo(cx - archW * 0.35, baseY - 104);
    ctx.lineTo(cx + archW * 0.35, baseY - 104);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, baseY - 78, 17, 0, Math.PI * 2);
    ctx.fillStyle = '#A81C2E';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.6;
    ctx.stroke();
  } else {
    ctx.fillStyle = '#F2C15D';
    ctx.beginPath();
    ctx.moveTo(cx - archW * 0.42, baseY - 2);
    ctx.lineTo(cx + archW * 0.42, baseY - 2);
    ctx.lineTo(cx + archW * 0.54, baseY + 14);
    ctx.lineTo(cx - archW * 0.54, baseY + 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  // Ornate gilded keystone crest
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - 22, archTop + 26);
      ctx.lineTo(cx - 28, archTop - 4);
      ctx.lineTo(cx, archTop - 16);
      ctx.lineTo(cx + 28, archTop - 4);
      ctx.lineTo(cx + 22, archTop + 26);
      ctx.closePath();
    },
    { x0: cx - 28, y0: archTop - 16, x1: cx + 28, y1: archTop + 26 },
    { lit: '#FFF2B4', mid: '#E5AE44', dark: '#5E380C' },
    { shadowPoolFrac: 0.36, inkW: 3.6 }
  );

  ctx.fillStyle = open ? '#7EFFCC' : '#FF384E';
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

function drawUrn(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.5;
  const baseY = h * 0.86;
  ctx.strokeStyle = '#99472C';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - 12, baseY - 58);
  ctx.quadraticCurveTo(cx - 34, baseY - 56, cx - 22, baseY - 34);
  ctx.moveTo(cx + 12, baseY - 58);
  ctx.quadraticCurveTo(cx + 34, baseY - 56, cx + 22, baseY - 34);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.stroke();

  paintChiaroscuroShape(
    ctx,
    () => {
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
    },
    { x0: cx - 28, y0: baseY - 74, x1: cx + 28, y1: baseY },
    { lit: '#F09058', mid: '#C0522C', dark: '#4A1812', rim: '#FFD6A8' },
    { shadowPoolFrac: 0.38, inkW: 3.8 }
  );

  ctx.fillStyle = INK;
  ctx.fillRect(cx - 24, baseY - 46, 48, 13);
  ctx.strokeStyle = '#F2BF57';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - 24, baseY - 46);
  ctx.lineTo(cx + 24, baseY - 46);
  ctx.moveTo(cx - 24, baseY - 33);
  ctx.lineTo(cx + 24, baseY - 33);
  ctx.stroke();
}

function drawSpikeTrap(ctx: CanvasRenderingContext2D, w: number, h: number, mode: 'idle' | 'armed' | 'active'): void {
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
  ctx.fillStyle = mode === 'armed' ? '#4F1E22' : '#262330';
  ctx.fill();
  ctx.strokeStyle = mode === 'armed' ? '#FF4C36' : '#B88A44';
  ctx.lineWidth = 3.2;
  ctx.stroke();

  for (const [ox, oy] of [
    [0, -10],
    [-20, 0],
    [20, 0],
    [0, 10],
    [0, 0],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(cx + ox, cy + oy, 7, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = mode === 'armed' ? '#FF4838' : INK;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    if (mode === 'active') {
      paintChiaroscuroShape(
        ctx,
        () => {
          ctx.beginPath();
          ctx.moveTo(cx + ox - 5.5, cy + oy);
          ctx.lineTo(cx + ox, cy + oy - 28);
          ctx.lineTo(cx + ox + 5.5, cy + oy);
          ctx.closePath();
        },
        { x0: cx + ox - 6, y0: cy + oy - 28, x1: cx + ox + 6, y1: cy + oy },
        { lit: '#FFFFFF', mid: '#B6C5D4', dark: '#303846' },
        { shadowPoolFrac: 0.42, hatch: false, inkW: 2.4 }
      );
    }
  }
}

// ============================================================================
// 4. Prince Pyreus (5 Heroic Comic-Ink Poses) & All 6 Infernal Arms
// ============================================================================

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
  const leanX = isSide ? 5 : pose === 'diag_down' || pose === 'diag_up' ? 3 : 0;

  // Fiery Underworld Ember Footsteps licking around ankles
  const drawEmberAnkle = (fx: number, fy: number) => {
    const fGrad = ctx.createRadialGradient(fx, fy, 2, fx, fy - 4, 21);
    fGrad.addColorStop(0, '#FFF8B8');
    fGrad.addColorStop(0.45, '#FF681E');
    fGrad.addColorStop(1, 'rgba(200, 18, 14, 0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 19, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Multi-lick stylized flame curling back from heel
    ctx.beginPath();
    ctx.moveTo(fx - 8, fy);
    ctx.quadraticCurveTo(fx - 22, fy - 12, fx - 14, fy - 28);
    ctx.quadraticCurveTo(fx - 5, fy - 16, fx - 2, fy - 22);
    ctx.quadraticCurveTo(fx + 3, fy - 10, fx + 8, fy - 2);
    ctx.closePath();
    const lg = ctx.createLinearGradient(fx - 14, fy - 28, fx + 6, fy);
    lg.addColorStop(0, '#FFF6A8');
    lg.addColorStop(0.5, '#FF7824');
    lg.addColorStop(1, '#CC1E18');
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
  };

  const lFootX = cx - (isSide ? 16 : 20);
  const rFootX = cx + (isSide ? 21 : 19);
  drawEmberAnkle(lFootX, footY - 2);
  drawEmberAnkle(rFootX, footY + 3);

  // Dynamic Athletic Action-Crouch Legs & Wrapped Bronze Shin Greaves
  const drawAthleticLeg = (hipX: number, hipY: number, kneeX: number, kneeY: number, fx: number, fy: number, front: boolean) => {
    // Muscular thigh
    paintChiaroscuroShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(hipX - 8, hipY);
        ctx.lineTo(kneeX - 7, kneeY);
        ctx.lineTo(kneeX + 7, kneeY);
        ctx.lineTo(hipX + 8, hipY);
        ctx.closePath();
      },
      { x0: Math.min(hipX, kneeX) - 8, y0: hipY, x1: Math.max(hipX, kneeX) + 8, y1: kneeY },
      front
        ? { lit: '#F2BC94', mid: '#CC8A62', dark: '#6E3B28' }
        : { lit: '#BA7E5A', mid: '#824C34', dark: '#3D1D16' },
      { shadowPoolFrac: 0.4, hatch: false, inkW: 3.4 }
    );
    // Sculpted bronze shin greave & knee cop
    paintChiaroscuroShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(kneeX - 7, kneeY - 2);
        ctx.lineTo(kneeX + 7, kneeY - 2);
        ctx.lineTo(fx + 6, fy);
        ctx.lineTo(fx - 6, fy);
        ctx.closePath();
      },
      { x0: Math.min(kneeX, fx) - 7, y0: kneeY - 2, x1: Math.max(kneeX, fx) + 7, y1: fy },
      front
        ? { lit: '#FFF0A8', mid: '#D69834', dark: '#4A280A', rim: '#FFE894' }
        : { lit: '#C48A30', mid: '#784A18', dark: '#281408' },
      { shadowPoolFrac: 0.44, hatch: false, inkW: 3.2 }
    );
  };

  drawAthleticLeg(cx - 9, footY - 58, cx - 18, footY - 30, lFootX, footY - 2, false);
  drawAthleticLeg(cx + 9, footY - 58, cx + 19, footY - 28, rFootX, footY + 2, true);

  // Billowing Asymmetric Crimson Chlamys Cloak with Mignola Deep-Fold Shadows!
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - 24 + leanX, footY - 102);
      ctx.bezierCurveTo(cx - 60, footY - 74, cx - 64, footY - 28, cx - 44, footY - 10);
      ctx.lineTo(cx - 18, footY - 28);
      ctx.lineTo(cx + 8, footY - 16);
      ctx.quadraticCurveTo(cx + 32, footY - 54, cx + 24 + leanX, footY - 98);
      ctx.closePath();
    },
    { x0: cx - 60, y0: footY - 102, x1: cx + 30, y1: footY - 10 },
    { lit: '#EE2638', mid: '#9E1024', dark: '#3A0510', rim: '#FF8658' },
    { shadowPoolFrac: 0.42, inkW: 4.2 }
  );
  // Crisp ink cloak fold creases
  paintTaperedArc(ctx, cx - 22, footY - 92, cx - 38, footY - 56, cx - 38, footY - 18, 2.8, INK);
  paintTaperedArc(ctx, cx - 10, footY - 88, cx - 18, footY - 58, cx - 16, footY - 30, 2.4, INK);

  // Broad-Shouldered Tapered Obsidian Chiton Tunic & Pleated Gold-Key Hem
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - 23 + leanX, footY - 102);
      ctx.lineTo(cx + 23 + leanX, footY - 102);
      ctx.lineTo(cx + 14 + leanX, footY - 64);
      ctx.lineTo(cx + 25, footY - 40);
      ctx.lineTo(cx + 5, footY - 46);
      ctx.lineTo(cx - 25, footY - 40);
      ctx.lineTo(cx - 14 + leanX, footY - 64);
      ctx.closePath();
    },
    { x0: cx - 25, y0: footY - 102, x1: cx + 25, y1: footY - 40 },
    { lit: '#443854', mid: '#1D172B', dark: '#0B0814' },
    { shadowPoolFrac: 0.44, inkW: 3.8 }
  );

  // Gilded Greek-key hem & crimson chest sash
  ctx.strokeStyle = '#F5C44E';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx - 22, footY - 44);
  ctx.lineTo(cx + 22, footY - 44);
  ctx.stroke();

  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - 24 + leanX, footY - 102);
      ctx.lineTo(cx + 4 + leanX, footY - 94);
      ctx.lineTo(cx + 19 + leanX, footY - 60);
      ctx.lineTo(cx - 16 + leanX, footY - 66);
      ctx.closePath();
    },
    { x0: cx - 24 + leanX, y0: footY - 102, x1: cx + 19 + leanX, y1: footY - 60 },
    { lit: isUp ? '#A81426' : '#F22A3C', mid: '#8C0E20', dark: '#2E050E', rim: '#FF9A68' },
    { shadowPoolFrac: 0.36, hatch: false, inkW: 3.4 }
  );

  // Sculpted Bronze Skull-Medallion Left Shoulder Pauldron!
  const px = (isSide ? cx - 6 : cx - 22) + leanX;
  const py = footY - 98;
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(px - 20, py + 8);
      ctx.bezierCurveTo(px - 24, py - 15, px + 6, py - 20, px + 18, py - 4);
      ctx.bezierCurveTo(px + 16, py + 13, px - 6, py + 15, px - 20, py + 8);
      ctx.closePath();
    },
    { x0: px - 22, y0: py - 18, x1: px + 18, y1: py + 14 },
    { lit: '#FFF5BC', mid: '#EBA832', dark: '#542D0A', rim: '#FFFFFF' },
    { shadowPoolFrac: 0.36, hatch: false, inkW: 3.6 }
  );
  // Embossed tiny skull eyes on pauldron
  ctx.fillStyle = INK;
  ctx.fillRect(px - 6, py - 2, 4, 3);
  ctx.fillRect(px + 2, py - 2, 4, 3);

  // Chiseled 3/4 Warrior Head, Heavy Mignola Brow Shadow & Heterochromatic Glowing Eyes!
  const hx = cx + leanX;
  const hy = footY - 122;

  // Exposed Athletic Warrior Arms w/ Wrapped Bronze Combat Bracers (distinct per directional pose!)
  if (isSide) {
    // Forward lunging side-arm + rear balance arm
    paintChiaroscuroShape(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(cx + 8, footY - 92);
        ctx.lineTo(cx + 34, footY - 76);
        ctx.lineTo(cx + 28, footY - 64);
        ctx.lineTo(cx + 4, footY - 78);
        ctx.closePath();
      },
      { x0: cx + 4, y0: footY - 92, x1: cx + 34, y1: footY - 64 },
      { lit: '#FAD0AA', mid: '#D4946E', dark: '#6E3B28' },
      { shadowPoolFrac: 0.3, hatch: false, inkW: 3.2 }
    );
  } else {
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        ctx,
        () => {
          ctx.beginPath();
          ctx.moveTo(cx + dir * 20, footY - 94);
          ctx.lineTo(cx + dir * 32, footY - 68);
          ctx.lineTo(cx + dir * 21, footY - 64);
          ctx.lineTo(cx + dir * 12, footY - 84);
          ctx.closePath();
        },
        { x0: cx - 32, y0: footY - 94, x1: cx + 32, y1: footY - 64 },
        { lit: '#FAD0AA', mid: '#D4946E', dark: '#6E3B28' },
        { shadowPoolFrac: 0.3, hatch: false, inkW: 3.0 }
      );
      ctx.fillStyle = '#E5AE3C';
      ctx.fillRect(cx + dir * 26 - 5, footY - 74, 10, 9);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.strokeRect(cx + dir * 26 - 5, footY - 74, 10, 9);
    }
  }

  ctx.fillStyle = '#B87854';
  ctx.fillRect(hx - 5, hy + 10, 10, 11);

  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(hx - 14, hy - 14);
      ctx.quadraticCurveTo(hx, hy - 22, hx + 15, hy - 12);
      ctx.lineTo(hx + 14, hy + 7);
      ctx.quadraticCurveTo(hx + 4, hy + 19, hx - 2, hy + 18);
      ctx.quadraticCurveTo(hx - 14, hy + 13, hx - 14, hy - 14);
      ctx.closePath();
    },
    { x0: hx - 15, y0: hy - 22, x1: hx + 15, y1: hy + 18 },
    isUp
      ? { lit: '#322244', mid: '#160E24', dark: INK }
      : { lit: '#FCE0BE', mid: '#E0A07A', dark: '#7E4630', rim: '#FFF2D6' },
    { shadowPoolFrac: isUp ? 0.45 : 0.24, hatch: false, inkW: 3.6 }
  );

  if (!isUp) {
    // Sharp comic brow shadow + vivid crimson/emerald-gold heterochromatic eyes!
    const ex = isSide ? 4 : pose === 'diag_down' ? 2 : 0;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(hx - 11 + ex, hy - 6);
    ctx.lineTo(hx + 12 + ex, hy - 6);
    ctx.lineTo(hx + 10 + ex, hy + 2);
    ctx.lineTo(hx - 9 + ex, hy + 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FF384A';
    ctx.fillRect(hx - 8 + ex, hy - 3, 5, 3.2);
    ctx.fillStyle = '#56FFA8';
    ctx.fillRect(hx + 3.5 + ex, hy - 3, 5, 3.2);
  }

  // Swept Wild Obsidian-Black Hair Crowned with Ember Rim & Golden Laurel Wreath!
  paintChiaroscuroShape(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(hx - 17, hy + 5);
      ctx.lineTo(hx - 36, hy - 8);
      ctx.lineTo(hx - 19, hy - 13);
      ctx.lineTo(hx - 38, hy - 28);
      ctx.lineTo(hx - 15, hy - 23);
      ctx.lineTo(hx - 20, hy - 46);
      ctx.lineTo(hx - 2, hy - 27);
      ctx.lineTo(hx + 9, hy - 48);
      ctx.lineTo(hx + 16, hy - 26);
      ctx.lineTo(hx + 36, hy - 32);
      ctx.lineTo(hx + 22, hy - 14);
      ctx.lineTo(hx + 32, hy - 5);
      ctx.lineTo(hx + 15, hy - 2);
      ctx.quadraticCurveTo(hx + 2, hy - 15, hx - 17, hy + 5);
      ctx.closePath();
    },
    { x0: hx - 36, y0: hy - 48, x1: hx + 36, y1: hy + 4 },
    { lit: '#FF6A2C', mid: '#261830', dark: INK, rim: '#FFB668' },
    { shadowPoolFrac: 0.48, hatch: false, inkW: 3.6 }
  );

  // Gleaming Golden Laurel Wreath leaves
  ctx.fillStyle = '#F5CC58';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  for (let i = -3; i <= 3; i++) {
    const a = -Math.PI * 0.5 + i * 0.28;
    const lx = hx + Math.cos(a) * 17;
    const ly = hy - 11 + Math.sin(a) * 12;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 5.2, 2.3, a + 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawWeapons(ctx: CanvasRenderingContext2D): void {
  // 1. Stygian Blade (etched leaf-bladed Greek xiphos, obsidian fuller, crimson rune channel, gold crossguard)
  withCell(ctx, 'weapon_stygian_blade', (c, w, h) => {
    const cy = h * 0.5;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(34, cy - 8);
        c.quadraticCurveTo(w * 0.58, cy - 15, w - 34, cy - 11);
        c.lineTo(w - 3, cy);
        c.lineTo(w - 34, cy + 11);
        c.quadraticCurveTo(w * 0.58, cy + 15, 34, cy + 8);
        c.closePath();
      },
      { x0: 34, y0: cy - 14, x1: w - 3, y1: cy + 14 },
      { lit: '#FFF8E8', mid: '#98A8BE', dark: '#242A3A', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.32, hatch: false, inkW: 3.6 }
    );
    // Dark fuller & blazing crimson rune groove
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(42, cy);
    c.lineTo(w - 24, cy);
    c.stroke();
    c.strokeStyle = '#FF3846';
    c.lineWidth = 2.4;
    c.stroke();
    c.strokeStyle = '#FFF7D6';
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(44, cy - 7);
    c.lineTo(w - 14, cy - 2);
    c.stroke();
    // Winged bronze-gold crossguard & leather-wrapped hilt
    c.fillStyle = '#EBB03E';
    c.beginPath();
    c.moveTo(27, cy - 22);
    c.lineTo(43, cy - 12);
    c.lineTo(39, cy);
    c.lineTo(43, cy + 12);
    c.lineTo(27, cy + 22);
    c.lineTo(32, cy);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
    c.fillStyle = '#6E1420';
    c.fillRect(10, cy - 4.5, 20, 9);
    c.strokeRect(10, cy - 4.5, 20, 9);
    c.beginPath();
    c.arc(9, cy, 6.8, 0, Math.PI * 2);
    c.fillStyle = '#F5C452';
    c.fill();
    c.stroke();
  });

  // 2. Eternal Spear (crimson-wrapped ash shaft, bronze bands, winged razor spearhead w/ glowing rune)
  withCell(ctx, 'weapon_eternal_spear', (c, w, h) => {
    const cy = h * 0.5;
    c.fillStyle = '#6E1624';
    c.fillRect(12, cy - 4.5, w - 66, 9);
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.strokeRect(12, cy - 4.5, w - 66, 9);
    // Gold grip wrappings
    c.fillStyle = '#E8B242';
    for (const gx of [36, 56, 76, w - 64]) {
      c.fillRect(gx, cy - 5.5, 7, 11);
      c.strokeRect(gx, cy - 5.5, 7, 11);
    }
    // Counterweight butt spike
    c.beginPath();
    c.moveTo(12, cy - 5);
    c.lineTo(2, cy);
    c.lineTo(12, cy + 5);
    c.closePath();
    c.fill();
    c.stroke();
    // Sculpted winged mythic spearhead
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(w - 58, cy - 16);
        c.lineTo(w - 4, cy);
        c.lineTo(w - 58, cy + 16);
        c.lineTo(w - 44, cy);
        c.closePath();
      },
      { x0: w - 58, y0: cy - 16, x1: w - 4, y1: cy + 16 },
      { lit: '#FFF8C8', mid: '#F0B63A', dark: '#5E320A', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.35, hatch: false, inkW: 3.6 }
    );
    c.strokeStyle = '#FF4838';
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(w - 42, cy);
    c.lineTo(w - 16, cy);
    c.stroke();
  });

  // 3. Shield of Chaos (embossed dark-obsidian aspis, hammered gold rim, glowing crimson chaos eye!)
  withCell(ctx, 'weapon_shield_of_chaos', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.arc(cx, cy, 40, 0, Math.PI * 2);
      },
      { x0: cx - 40, y0: cy - 40, x1: cx + 40, y1: cy + 40 },
      { lit: '#5E3A4C', mid: '#261829', dark: INK, rim: '#FFE89E' },
      { shadowPoolFrac: 0.4, hatch: false, inkW: 4.0 }
    );
    c.strokeStyle = '#EBB446';
    c.lineWidth = 6.5;
    c.beginPath();
    c.arc(cx, cy, 36, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 2.8;
    c.stroke();
    // Glowing crimson eye boss
    c.fillStyle = '#FF2E44';
    c.beginPath();
    c.moveTo(cx - 18, cy);
    c.quadraticCurveTo(cx, cy - 14, cx + 18, cy);
    c.quadraticCurveTo(cx, cy + 14, cx - 18, cy);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#FFF6C8';
    c.beginPath();
    c.ellipse(cx, cy, 3.5, 9, 0, 0, Math.PI * 2);
    c.fill();
  });

  // 4. Heart-Seeking Bow (sculpted recurve golden limbs, glowing crystalline string & nocked arrow)
  withCell(ctx, 'weapon_heart_seeking_bow', (c, w, h) => {
    const cx = w * 0.45;
    const cy = h * 0.5;
    c.strokeStyle = '#FFE488';
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(cx - 16, 12);
    c.lineTo(cx - 16, h - 12);
    c.stroke();

    c.strokeStyle = INK;
    c.lineWidth = 13;
    c.beginPath();
    c.moveTo(cx - 16, 10);
    c.bezierCurveTo(cx + 12, 18, cx + 38, cy - 16, cx + 26, cy);
    c.bezierCurveTo(cx + 38, cy + 16, cx + 12, h - 18, cx - 16, h - 10);
    c.stroke();
    c.strokeStyle = '#F0B63E';
    c.lineWidth = 6.5;
    c.stroke();
    c.strokeStyle = '#FFF7D6';
    c.lineWidth = 2;
    c.stroke();
    // Ruby heart gem at riser
    c.fillStyle = '#FF3854';
    c.beginPath();
    c.arc(cx + 24, cy, 6.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();
  });

  // 5. Twin Fists (sculpted spiked brass-and-crimson clawed lion gauntlets)
  withCell(ctx, 'weapon_twin_fists', (c, w, h) => {
    const drawGauntlet = (gx: number, gy: number) => {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.roundRect(gx - 20, gy - 15, 40, 30, 8);
        },
        { x0: gx - 20, y0: gy - 15, x1: gx + 20, y1: gy + 15 },
        { lit: '#FFF2AE', mid: '#DE9632', dark: '#4A240C', rim: '#FFFFFF' },
        { shadowPoolFrac: 0.4, hatch: false, inkW: 3.4 }
      );
      // Spiked knuckle studs + molten ruby core
      c.fillStyle = '#FF3648';
      c.beginPath();
      c.arc(gx + 5, gy, 6.5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.6;
      c.stroke();
    };
    drawGauntlet(w * 0.34, h * 0.36);
    drawGauntlet(w * 0.66, h * 0.64);
  });

  // 6. Adamant Rail (etched mythic-bronze heavy siege cannon with glowing molten coil chamber!)
  withCell(ctx, 'weapon_adamant_rail', (c, w, h) => {
    const cy = h * 0.5;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(12, cy - 10);
        c.lineTo(w - 16, cy - 14);
        c.lineTo(w - 6, cy - 8);
        c.lineTo(w - 6, cy + 8);
        c.lineTo(w - 22, cy + 14);
        c.lineTo(12, cy + 10);
        c.closePath();
      },
      { x0: 12, y0: cy - 14, x1: w - 6, y1: cy + 14 },
      { lit: '#5C506E', mid: '#2A2336', dark: INK, rim: '#FFE694' },
      { shadowPoolFrac: 0.42, hatch: false, inkW: 3.6 }
    );
    // Gold sight rail & glowing orange energy chamber
    c.fillStyle = '#F0B63A';
    c.fillRect(36, cy - 17, 56, 7);
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.strokeRect(36, cy - 17, 56, 7);
    c.fillStyle = '#FF6220';
    c.fillRect(w - 56, cy - 5, 36, 9);
    c.fillStyle = '#FFF5B0';
    c.fillRect(w - 50, cy - 2, 24, 3);
  });
}

// ============================================================================
// 5. ALL 22 BESPOKE REGULAR ENEMIES + RATTLEBONES (ZERO Potato-Sack Clones!)
// ============================================================================

function drawAllRegularEnemies(ctx: CanvasRenderingContext2D): void {
  // 1. Numbskull: Horned demonic cranium w/ jagged jaw & spectral violet fire
  withCell(ctx, 'enemy_numbskull', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.52;
    const aura = c.createRadialGradient(cx, cy + 16, 4, cx, cy + 12, 44);
    aura.addColorStop(0, '#F5A6FF');
    aura.addColorStop(0.5, 'rgba(157, 43, 255, 0.7)');
    aura.addColorStop(1, 'rgba(92, 16, 160, 0)');
    c.fillStyle = aura;
    c.beginPath();
    c.arc(cx, cy + 12, 44, 0, Math.PI * 2);
    c.fill();

    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 20, cy - 16);
          c.quadraticCurveTo(cx + dir * 48, cy - 34, cx + dir * 34, cy - 54);
          c.quadraticCurveTo(cx + dir * 26, cy - 34, cx + dir * 10, cy - 26);
          c.closePath();
        },
        { x0: cx - 44, y0: cy - 54, x1: cx + 44, y1: cy - 14 },
        { lit: '#6E4C88', mid: '#322042', dark: INK },
        { shadowPoolFrac: 0.45, hatch: false, inkW: 3.6 }
      );
    }

    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 28, cy - 4);
        c.quadraticCurveTo(cx - 30, cy - 34, cx, cy - 34);
        c.quadraticCurveTo(cx + 30, cy - 34, cx + 28, cy - 4);
        c.lineTo(cx + 20, cy + 16);
        c.lineTo(cx + 12, cy + 28);
        c.lineTo(cx - 12, cy + 28);
        c.lineTo(cx - 20, cy + 16);
        c.closePath();
      },
      { x0: cx - 30, y0: cy - 34, x1: cx + 30, y1: cy + 28 },
      { lit: '#F7ECFF', mid: '#C0ACD6', dark: '#4A3664', rim: '#F0A4FF' },
      { shadowPoolFrac: 0.38, inkW: 4.2 }
    );
    // Angled furious sockets & violet embers
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(cx - 20, cy - 12);
    c.lineTo(cx - 4, cy - 4);
    c.lineTo(cx - 10, cy + 5);
    c.lineTo(cx - 20, cy + 1);
    c.closePath();
    c.moveTo(cx + 20, cy - 12);
    c.lineTo(cx + 4, cy - 4);
    c.lineTo(cx + 10, cy + 5);
    c.lineTo(cx + 20, cy + 1);
    c.closePath();
    c.fill();
    c.fillStyle = '#FF54FF';
    c.fillRect(cx - 15, cy - 5, 6, 4);
    c.fillRect(cx + 9, cy - 5, 6, 4);
  });

  // 2. Wretched Husk: Hulking emerald-hooded armored club brute
  withCell(ctx, 'enemy_wretched_husk', (c, w, h) => {
    const cx = w * 0.46;
    const baseY = h * 0.87;
    // Massive spiked obsidian war-club
    c.save();
    c.translate(cx + 46, baseY - 82);
    c.rotate(0.26);
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(-8, 56);
        c.lineTo(-18, -46);
        c.lineTo(18, -50);
        c.lineTo(10, 56);
        c.closePath();
      },
      { x0: -18, y0: -50, x1: 18, y1: 56 },
      { lit: '#6E7E8A', mid: '#2E3642', dark: INK },
      { shadowPoolFrac: 0.45, inkW: 3.8 }
    );
    c.fillStyle = '#E5B248';
    for (const sy of [-36, -16, 4]) {
      c.beginPath();
      c.moveTo(13, sy - 5);
      c.lineTo(26, sy);
      c.lineTo(13, sy + 5);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.6;
      c.stroke();
    }
    c.restore();

    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 48, baseY);
        c.quadraticCurveTo(cx - 58, baseY - 76, cx - 36, baseY - 124);
        c.quadraticCurveTo(cx, baseY - 166, cx + 38, baseY - 122);
        c.quadraticCurveTo(cx + 56, baseY - 74, cx + 46, baseY);
        c.lineTo(cx + 18, baseY - 12);
        c.lineTo(cx, baseY + 4);
        c.lineTo(cx - 22, baseY - 12);
        c.closePath();
      },
      { x0: cx - 56, y0: baseY - 166, x1: cx + 56, y1: baseY + 4 },
      { lit: '#4CC28A', mid: '#1E5C4A', dark: '#0B2020', rim: '#7EFFC2' },
      { shadowPoolFrac: 0.42, inkW: 4.6 }
    );

    // Sculpted bronze spiked pauldrons
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 16, baseY - 118);
          c.lineTo(cx + dir * 56, baseY - 110);
          c.lineTo(cx + dir * 48, baseY - 86);
          c.lineTo(cx + dir * 18, baseY - 92);
          c.closePath();
        },
        { x0: cx - 56, y0: baseY - 118, x1: cx + 56, y1: baseY - 86 },
        { lit: '#F2C058', mid: '#A66E24', dark: '#3A1E08' },
        { shadowPoolFrac: 0.42, hatch: false, inkW: 3.6 }
      );
    }

    // Cavernous hood shadow & fierce glowing amber eyes
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx, baseY - 120, 22, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#6CF0AE';
    c.lineWidth = 2.4;
    c.stroke();
    c.fillStyle = '#FFAE2B';
    c.beginPath();
    c.moveTo(cx - 14, baseY - 122);
    c.lineTo(cx - 4, baseY - 117);
    c.lineTo(cx - 12, baseY - 114);
    c.closePath();
    c.moveTo(cx + 14, baseY - 122);
    c.lineTo(cx + 4, baseY - 117);
    c.lineTo(cx + 12, baseY - 114);
    c.closePath();
    c.fill();
  });

  // 3. Bone Archer: Hooded skeletal ranger with exposed ribcage & crystalline recurve bow
  withCell(ctx, 'enemy_bone_archer', (c, w, h) => {
    const cx = w * 0.42;
    const baseY = h * 0.86;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 34, baseY - 6);
        c.lineTo(cx - 44, baseY - 46);
        c.quadraticCurveTo(cx - 38, baseY - 106, cx - 22, baseY - 136);
        c.quadraticCurveTo(cx, baseY - 168, cx + 22, baseY - 132);
        c.lineTo(cx + 30, baseY - 64);
        c.lineTo(cx + 22, baseY - 4);
        c.lineTo(cx + 6, baseY - 26);
        c.lineTo(cx - 8, baseY + 2);
        c.lineTo(cx - 20, baseY - 22);
        c.closePath();
      },
      { x0: cx - 44, y0: baseY - 168, x1: cx + 30, y1: baseY + 2 },
      { lit: '#4A7E9E', mid: '#1D2F4E', dark: '#0A0D1C', rim: '#7CF6FF' },
      { shadowPoolFrac: 0.44, inkW: 4.2 }
    );
    // Exposed ivory ribcage
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx + 2, baseY - 84, 15, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#DCE8F2';
    c.lineWidth = 3.2;
    for (const ry of [-96, -86, -76]) {
      c.beginPath();
      c.moveTo(cx - 10, baseY + ry);
      c.quadraticCurveTo(cx + 2, baseY + ry - 4, cx + 14, baseY + ry);
      c.stroke();
    }
    // Hooded skull & cyan eyes
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx + 2, baseY - 126, 18, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#E8F4FC';
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
    c.fillStyle = '#38FFF4';
    c.fillRect(cx - 7, baseY - 127, 6, 4);
    c.fillRect(cx + 4, baseY - 127, 6, 4);
    // Drawn crystalline longbow + nocked arrow
    c.strokeStyle = INK;
    c.lineWidth = 11;
    c.beginPath();
    c.moveTo(cx + 26, baseY - 148);
    c.bezierCurveTo(cx + 68, baseY - 122, cx + 68, baseY - 62, cx + 26, baseY - 38);
    c.stroke();
    c.strokeStyle = '#52F0FF';
    c.lineWidth = 5;
    c.stroke();
    c.strokeStyle = '#D6FFFF';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx + 26, baseY - 146);
    c.lineTo(cx + 10, baseY - 92);
    c.lineTo(cx + 26, baseY - 40);
    c.stroke();
    c.strokeStyle = '#70FFFF';
    c.lineWidth = 3.8;
    c.beginPath();
    c.moveTo(cx + 10, baseY - 92);
    c.lineTo(cx + 68, baseY - 92);
    c.stroke();
  });

  // 4. Brimstone Crystal: Faceted crimson-gold laser obelisk with orbiting obsidian shards
  withCell(ctx, 'enemy_brimstone_crystal', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.48;
    const glow = c.createRadialGradient(cx, cy, 8, cx, cy, 56);
    glow.addColorStop(0, 'rgba(255, 110, 60, 0.85)');
    glow.addColorStop(1, 'rgba(255, 20, 40, 0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(cx, cy, 56, 0, Math.PI * 2);
    c.fill();

    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx, cy - 68);
        c.lineTo(cx + 34, cy - 12);
        c.lineTo(cx + 22, cy + 56);
        c.lineTo(cx, cy + 72);
        c.lineTo(cx - 22, cy + 56);
        c.lineTo(cx - 34, cy - 12);
        c.closePath();
      },
      { x0: cx - 34, y0: cy - 68, x1: cx + 34, y1: cy + 72 },
      { lit: '#FF9A68', mid: '#D62034', dark: '#3E0816', rim: '#FFE084' },
      { shadowPoolFrac: 0.42, inkW: 4.4 }
    );
    c.strokeStyle = '#F5C04E';
    c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(cx, cy - 64);
    c.lineTo(cx, cy + 68);
    c.moveTo(cx - 32, cy - 12);
    c.lineTo(cx + 32, cy - 12);
    c.stroke();
    c.fillStyle = '#FFF5B8';
    c.beginPath();
    c.ellipse(cx, cy - 4, 12, 18, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
  });

  // 5. Ember Lout: Massive armored volcanic furnace brute with heavy magma fists
  withCell(ctx, 'enemy_ember_lout', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.87;
    // Heavy volcanic armored stance
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 60, baseY - 12);
        c.bezierCurveTo(cx - 78, baseY - 78, cx - 52, baseY - 128, cx - 28, baseY - 130);
        c.lineTo(cx + 28, baseY - 130);
        c.bezierCurveTo(cx + 52, baseY - 128, cx + 78, baseY - 78, cx + 60, baseY - 12);
        c.lineTo(cx + 24, baseY);
        c.lineTo(cx + 12, baseY - 26);
        c.lineTo(cx - 12, baseY - 26);
        c.lineTo(cx - 24, baseY);
        c.closePath();
      },
      { x0: cx - 76, y0: baseY - 130, x1: cx + 76, y1: baseY },
      { lit: '#644446', mid: '#2D1C22', dark: INK, rim: '#FF9A4C' },
      { shadowPoolFrac: 0.44, inkW: 4.6 }
    );
    // Glowing molten furnace core cracking through armored ribs
    c.fillStyle = '#FF5814';
    c.beginPath();
    c.moveTo(cx - 28, baseY - 82);
    c.lineTo(cx, baseY - 102);
    c.lineTo(cx + 28, baseY - 82);
    c.lineTo(cx + 14, baseY - 40);
    c.lineTo(cx, baseY - 28);
    c.lineTo(cx - 14, baseY - 40);
    c.closePath();
    c.fill();
    c.fillStyle = '#FFF088';
    c.beginPath();
    c.ellipse(cx, baseY - 68, 12, 16, 0, 0, Math.PI * 2);
    c.fill();
    // Horned iron juggernaut helm
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 22, baseY - 126);
        c.lineTo(cx - 36, baseY - 154);
        c.lineTo(cx - 12, baseY - 140);
        c.lineTo(cx + 12, baseY - 140);
        c.lineTo(cx + 36, baseY - 154);
        c.lineTo(cx + 22, baseY - 126);
        c.lineTo(cx + 18, baseY - 102);
        c.lineTo(cx - 18, baseY - 102);
        c.closePath();
      },
      { x0: cx - 36, y0: baseY - 154, x1: cx + 36, y1: baseY - 102 },
      { lit: '#705860', mid: '#32242D', dark: INK },
      { shadowPoolFrac: 0.42, hatch: false, inkW: 3.8 }
    );
    c.fillStyle = '#FFE048';
    c.fillRect(cx - 12, baseY - 122, 8, 4.5);
    c.fillRect(cx + 4, baseY - 122, 8, 4.5);
  });

  // 6. RATTLEBONES SPARRING COMPANION (Charismatic Armored Skeleton — ZERO Bullseye Stick!)
  withCell(ctx, 'enemy_rattlebones_dummy', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.89;

    // Iron-bound oak sparring pedestal & crossed bone/post mount
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.ellipse(cx, baseY, 36, 13, 0, 0, Math.PI * 2);
      },
      { x0: cx - 36, y0: baseY - 13, x1: cx + 36, y1: baseY + 13 },
      { lit: '#8C5A32', mid: '#523018', dark: '#1A0E08' },
      { shadowPoolFrac: 0.42, hatch: false, inkW: 3.8 }
    );

    // Skeletal pelvis & articulated bone femurs perched on post
    c.fillStyle = '#6A4022';
    c.fillRect(cx - 7, baseY - 64, 14, 62);
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.strokeRect(cx - 7, baseY - 64, 14, 62);

    // Tattered royal-crimson sparring cape draping off left shoulder!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 26, baseY - 114);
        c.bezierCurveTo(cx - 52, baseY - 84, cx - 50, baseY - 46, cx - 36, baseY - 28);
        c.lineTo(cx - 14, baseY - 46);
        c.lineTo(cx + 28, baseY - 110);
        c.closePath();
      },
      { x0: cx - 52, y0: baseY - 114, x1: cx + 28, y1: baseY - 28 },
      { lit: '#CC2638', mid: '#781222', dark: '#24050C', rim: '#FF8672' },
      { shadowPoolFrac: 0.42, inkW: 3.6 }
    );

    // Articulated ivory skeletal ribcage + painted bronze breastplate crest!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 24, baseY - 112);
        c.lineTo(cx + 24, baseY - 112);
        c.lineTo(cx + 18, baseY - 58);
        c.lineTo(cx, baseY - 48);
        c.lineTo(cx - 18, baseY - 58);
        c.closePath();
      },
      { x0: cx - 24, y0: baseY - 112, x1: cx + 24, y1: baseY - 48 },
      { lit: '#F7ECD2', mid: '#C8B89A', dark: '#54463C' },
      { shadowPoolFrac: 0.38, inkW: 3.8 }
    );
    // Rib slats
    c.strokeStyle = INK;
    c.lineWidth = 3;
    for (const ry of [-98, -86, -74]) {
      c.beginPath();
      c.moveTo(cx - 16, baseY + ry);
      c.lineTo(cx + 16, baseY + ry);
      c.stroke();
    }

    // Wooden & iron-riveted sparring buckler strapped on right arm!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.ellipse(cx + 32, baseY - 76, 18, 26, 0.16, 0, Math.PI * 2);
      },
      { x0: cx + 14, y0: baseY - 102, x1: cx + 50, y1: baseY - 50 },
      { lit: '#C48444', mid: '#7E4B22', dark: '#2A160A', rim: '#FFE6A8' },
      { shadowPoolFrac: 0.38, hatch: false, inkW: 3.6 }
    );
    c.fillStyle = '#E5B248';
    c.beginPath();
    c.arc(cx + 32, baseY - 76, 7, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();

    // Expressive Charismatic Grinning Articulated Skull + Glowing Emerald Soul Eyes!
    const sy = baseY - 134;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 21, sy - 10);
        c.quadraticCurveTo(cx, sy - 30, cx + 21, sy - 10);
        c.lineTo(cx + 22, sy + 6);
        c.lineTo(cx + 14, sy + 20);
        c.lineTo(cx - 14, sy + 20);
        c.lineTo(cx - 22, sy + 6);
        c.closePath();
      },
      { x0: cx - 22, y0: sy - 30, x1: cx + 22, y1: sy + 20 },
      { lit: '#FFF6E0', mid: '#D6C6A6', dark: '#5A4A3E', rim: '#78FFB8' },
      { shadowPoolFrac: 0.35, hatch: false, inkW: 3.8 }
    );
    // Jaunty angled hollow eye sockets & bright emerald glints
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(cx - 16, sy - 7);
    c.lineTo(cx - 3, sy - 1);
    c.lineTo(cx - 6, sy + 6);
    c.lineTo(cx - 16, sy + 2);
    c.closePath();
    c.moveTo(cx + 16, sy - 7);
    c.lineTo(cx + 3, sy - 1);
    c.lineTo(cx + 6, sy + 6);
    c.lineTo(cx + 16, sy + 2);
    c.closePath();
    c.fill();
    c.fillStyle = '#48FFA2';
    c.fillRect(cx - 12, sy - 2, 4.5, 3);
    c.fillRect(cx + 7.5, sy - 2, 4.5, 3);
    // Grinning articulated teeth
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(cx - 12, sy + 12);
    c.lineTo(cx + 12, sy + 12);
    for (const tx of [-7, -2, 3, 8]) {
      c.moveTo(cx + tx, sy + 9);
      c.lineTo(cx + tx, sy + 18);
    }
    c.stroke();

    // Tilted Battered Bronze Spartan Helm w/ Jaunty Crimson Horsehair Plume!
    c.save();
    c.translate(cx, sy - 13);
    c.rotate(-0.14);
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.arc(0, 0, 23, Math.PI * 1.05, -0.05);
        c.lineTo(21, 9);
        c.lineTo(10, 1);
        c.lineTo(0, 7);
        c.lineTo(-10, 1);
        c.lineTo(-21, 9);
        c.closePath();
      },
      { x0: -24, y0: -24, x1: 24, y1: 10 },
      { lit: '#FFF0A8', mid: '#D69836', dark: '#4A280A', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.36, hatch: false, inkW: 3.6 }
    );
    c.fillStyle = '#D62032';
    c.beginPath();
    c.moveTo(-6, -23);
    c.quadraticCurveTo(24, -44, 30, -12);
    c.quadraticCurveTo(10, -19, -6, -23);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
    c.restore();
  });

  // 7. Generic Armored Shade
  withCell(ctx, 'enemy_generic_shade', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.86;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 34, baseY);
        c.quadraticCurveTo(cx - 44, baseY - 76, cx - 22, baseY - 126);
        c.quadraticCurveTo(cx, baseY - 156, cx + 22, baseY - 126);
        c.quadraticCurveTo(cx + 44, baseY - 76, cx + 34, baseY);
        c.lineTo(cx + 12, baseY - 16);
        c.lineTo(cx - 12, baseY - 16);
        c.closePath();
      },
      { x0: cx - 42, y0: baseY - 156, x1: cx + 42, y1: baseY },
      { lit: '#8064A8', mid: '#3A2854', dark: INK, rim: '#C69EFF' },
      { shadowPoolFrac: 0.42, inkW: 4.2 }
    );
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx, baseY - 116, 16, 18, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#FF6B57';
    c.fillRect(cx - 10, baseY - 118, 6, 3.5);
    c.fillRect(cx + 4, baseY - 118, 6, 3.5);
  });

  // 8. Wretch Assassin: Low crouched jagged-cloak shadow stalker wielding twin serrated crimson daggers!
  withCell(ctx, 'enemy_wretch_assassin', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.86;
    // Dynamic forward crouch body + tattered assassin mantle
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 42, baseY - 6);
        c.lineTo(cx - 30, baseY - 72);
        c.quadraticCurveTo(cx - 4, baseY - 116, cx + 24, baseY - 84);
        c.lineTo(cx + 38, baseY - 22);
        c.lineTo(cx + 16, baseY - 4);
        c.lineTo(cx, baseY - 26);
        c.lineTo(cx - 22, baseY + 2);
        c.closePath();
      },
      { x0: cx - 42, y0: baseY - 112, x1: cx + 38, y1: baseY + 2 },
      { lit: '#4AC694', mid: '#184A3E', dark: INK, rim: '#7EFFCA' },
      { shadowPoolFrac: 0.44, inkW: 3.8 }
    );
    // Pointed shadow cowl & razor crimson eyes
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(cx - 14, baseY - 96);
    c.lineTo(cx + 6, baseY - 122);
    c.lineTo(cx + 22, baseY - 92);
    c.lineTo(cx + 10, baseY - 74);
    c.lineTo(cx - 10, baseY - 74);
    c.closePath();
    c.fill();
    c.fillStyle = '#FF3854';
    c.fillRect(cx - 3, baseY - 94, 6, 3.5);
    c.fillRect(cx + 8, baseY - 94, 6, 3.5);
    // Twin curved jagged crimson assassin daggers!
    for (const [dx, rot] of [
      [-36, -0.4],
      [38, 0.35],
    ]) {
      c.save();
      c.translate(cx + dx, baseY - 48);
      c.rotate(rot);
      c.fillStyle = '#FF3858';
      c.beginPath();
      c.moveTo(-4, -22);
      c.quadraticCurveTo(10, 0, 2, 34);
      c.lineTo(-8, 12);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.stroke();
      c.restore();
    }
  });

  // 9. Slag Thrower: Hunched volcanic basalt skeleton heaving a blazing molten magma boulder!
  withCell(ctx, 'enemy_slag_thrower', (c, w, h) => {
    const cx = w * 0.48;
    const baseY = h * 0.86;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 32, baseY);
        c.lineTo(cx - 38, baseY - 68);
        c.lineTo(cx - 12, baseY - 104);
        c.lineTo(cx + 26, baseY - 96);
        c.lineTo(cx + 34, baseY);
        c.lineTo(cx + 12, baseY - 22);
        c.lineTo(cx - 14, baseY - 22);
        c.closePath();
      },
      { x0: cx - 38, y0: baseY - 104, x1: cx + 34, y1: baseY },
      { lit: '#C84E24', mid: '#581A14', dark: INK, rim: '#FF9844' },
      { shadowPoolFrac: 0.44, inkW: 3.8 }
    );
    // Charred skull face
    c.fillStyle = '#E8D2B8';
    c.beginPath();
    c.ellipse(cx - 4, baseY - 98, 14, 15, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
    c.fillStyle = '#FFAE24';
    c.fillRect(cx - 10, baseY - 100, 5, 3.5);
    c.fillRect(cx + 1, baseY - 100, 5, 3.5);
    // Blazing cracked magma boulder hefted over shoulder!
    const bx = cx + 26;
    const by = baseY - 102;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(bx - 18, by - 6);
        c.lineTo(bx - 6, by - 22);
        c.lineTo(bx + 16, by - 16);
        c.lineTo(bx + 22, by + 6);
        c.lineTo(bx + 4, by + 20);
        c.lineTo(bx - 16, by + 12);
        c.closePath();
      },
      { x0: bx - 18, y0: by - 22, x1: bx + 22, y1: by + 20 },
      { lit: '#FFF088', mid: '#FF5E14', dark: '#3A0A08', rim: '#FFF6B8' },
      { shadowPoolFrac: 0.3, hatch: false, inkW: 3.6 }
    );
  });

  // 10. Lava Gorgon: Floating sculpted obsidian-jade Medusa skull w/ writhing magma serpents!
  withCell(ctx, 'enemy_lava_gorgon', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.52;
    // Writhing clawed magma snakes radiating from crown
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.85 + (i / 6) * Math.PI * 1.3;
      const sx = cx + Math.cos(a) * 20;
      const sy = cy + Math.sin(a) * 20;
      const mx = cx + Math.cos(a - 0.35) * 44;
      const my = cy + Math.sin(a - 0.35) * 44;
      const ex = cx + Math.cos(a) * 58;
      const ey = cy + Math.sin(a) * 54;
      paintTaperedArc(c, sx, sy, mx, my, ex, ey, 9.5, INK);
      paintTaperedArc(c, sx, sy, mx, my, ex, ey, 4.8, i % 2 === 0 ? '#FF6218' : '#FFA828');
      c.fillStyle = '#FFE878';
      c.beginPath();
      c.arc(ex, ey, 4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.stroke();
    }
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 24, cy - 16);
        c.quadraticCurveTo(cx, cy - 34, cx + 24, cy - 16);
        c.lineTo(cx + 22, cy + 12);
        c.lineTo(cx, cy + 32);
        c.lineTo(cx - 22, cy + 12);
        c.closePath();
      },
      { x0: cx - 24, y0: cy - 34, x1: cx + 24, y1: cy + 32 },
      { lit: '#6E4A4E', mid: '#321E24', dark: INK, rim: '#FF9852' },
      { shadowPoolFrac: 0.42, inkW: 4.2 }
    );
    // Petrifying glowing emerald Gorgon eyes & fanged snarl
    c.fillStyle = '#58FF62';
    c.beginPath();
    c.moveTo(cx - 16, cy - 6);
    c.lineTo(cx - 4, cy - 1);
    c.lineTo(cx - 14, cy + 3);
    c.closePath();
    c.moveTo(cx + 16, cy - 6);
    c.lineTo(cx + 4, cy - 1);
    c.lineTo(cx + 14, cy + 3);
    c.closePath();
    c.fill();
  });

  // 11. Bloodless Drifter: Armored skeletal lunging warrior w/ tattered lava-charred cloak & bone pike
  withCell(ctx, 'enemy_bloodless_drifter', (c, w, h) => {
    const cx = w * 0.46;
    const baseY = h * 0.86;
    // Articulated skeletal frame in forward dash pose
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 32, baseY - 4);
        c.lineTo(cx - 20, baseY - 62);
        c.lineTo(cx - 28, baseY - 104);
        c.lineTo(cx + 18, baseY - 106);
        c.lineTo(cx + 28, baseY - 48);
        c.lineTo(cx + 34, baseY);
        c.lineTo(cx + 12, baseY - 30);
        c.lineTo(cx - 14, baseY - 26);
        c.closePath();
      },
      { x0: cx - 32, y0: baseY - 106, x1: cx + 34, y1: baseY },
      { lit: '#EFE0CA', mid: '#9C7B64', dark: '#2E1A16', rim: '#FFA258' },
      { shadowPoolFrac: 0.44, inkW: 3.8 }
    );
    // Horned bone skull & glowing cinder eyes
    c.fillStyle = '#F5EAD6';
    c.beginPath();
    c.ellipse(cx + 2, baseY - 118, 15, 17, 0.1, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.4;
    c.stroke();
    c.fillStyle = '#FF5818';
    c.fillRect(cx - 5, baseY - 120, 5, 4);
    c.fillRect(cx + 5, baseY - 120, 5, 4);
    // Long jagged bone halberd angled forward
    c.strokeStyle = INK;
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(cx - 10, baseY - 44);
    c.lineTo(cx + 56, baseY - 118);
    c.stroke();
    c.strokeStyle = '#F0E6D2';
    c.lineWidth = 4.2;
    c.stroke();
  });

  // 12. Infernal Bomber: Skeletal grenadier hefting a volatile chained magma bomb overhead!
  withCell(ctx, 'enemy_infernal_bomber', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.86;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 28, baseY);
        c.lineTo(cx - 32, baseY - 64);
        c.lineTo(cx - 20, baseY - 96);
        c.lineTo(cx + 20, baseY - 96);
        c.lineTo(cx + 32, baseY - 64);
        c.lineTo(cx + 28, baseY);
        c.lineTo(cx + 10, baseY - 24);
        c.lineTo(cx - 10, baseY - 24);
        c.closePath();
      },
      { x0: cx - 32, y0: baseY - 96, x1: cx + 32, y1: baseY },
      { lit: '#E2D0B6', mid: '#785848', dark: '#221210', rim: '#FF7E38' },
      { shadowPoolFrac: 0.42, inkW: 3.8 }
    );
    // Raised bone arms gripping giant blazing infernal bomb overhead!
    c.strokeStyle = '#EDE0CC';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(cx - 22, baseY - 82);
    c.lineTo(cx - 24, baseY - 116);
    c.moveTo(cx + 22, baseY - 82);
    c.lineTo(cx + 24, baseY - 116);
    c.stroke();

    const by = baseY - 118;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.arc(cx, by, 22, 0, Math.PI * 2);
      },
      { x0: cx - 22, y0: by - 22, x1: cx + 22, y1: by + 22 },
      { lit: '#5A3A3A', mid: '#241418', dark: INK, rim: '#FF9A38' },
      { shadowPoolFrac: 0.4, hatch: false, inkW: 3.8 }
    );
    // Glowing molten furnace rune core on bomb
    c.fillStyle = '#FF5A14';
    c.beginPath();
    c.arc(cx, by, 10, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#FFF59C';
    c.beginPath();
    c.arc(cx, by, 5, 0, Math.PI * 2);
    c.fill();
  });

  // 13. BONE HYDRA AUXILIARY HEAD (Articulated Horned Dragon Skull + Segmented Vertebrae + Magma Gullet — ZERO Guitar Picks!)
  withCell(ctx, 'enemy_bone_hydra_head', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.87;
    // Articulated segmented bone vertebrae neck curving sinuously!
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const vx = cx + Math.sin(t * Math.PI * 1.4) * 18;
      const vy = baseY - 10 - t * 88;
      const vr = 17 - t * 4;
      // Glowing magma spine core behind vertebrae
      c.fillStyle = '#FF5A14';
      c.beginPath();
      c.arc(vx, vy, vr * 0.9, 0, Math.PI * 2);
      c.fill();
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.ellipse(vx, vy, vr, vr * 0.68, 0.15, 0, Math.PI * 2);
        },
        { x0: vx - vr, y0: vy - vr, x1: vx + vr, y1: vy + vr },
        { lit: '#F6ECD4', mid: '#C2B094', dark: '#463832', rim: '#FFAA58' },
        { shadowPoolFrac: 0.42, hatch: false, inkW: 3.2 }
      );
      // Dorsal bone spine spike
      c.fillStyle = '#E8DAC0';
      c.beginPath();
      c.moveTo(vx - vr - 8, vy);
      c.lineTo(vx - vr + 4, vy - 5);
      c.lineTo(vx - vr + 4, vy + 5);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.2;
      c.stroke();
    }

    // Articulated Horned Dragon Skull w/ Hinged Fanged Jaw & Blazing Ember Sockets!
    const hy = baseY - 114;
    // Swept obsidian-bone horns
    for (const dir of [-1, 1] as const) {
      c.fillStyle = '#381E22';
      c.beginPath();
      c.moveTo(cx + dir * 14, hy - 14);
      c.quadraticCurveTo(cx + dir * 42, hy - 28, cx + dir * 48, hy - 48);
      c.quadraticCurveTo(cx + dir * 32, hy - 32, cx + dir * 18, hy - 26);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3.2;
      c.stroke();
    }

    // Glowing molten gullet inside open hinged jaw
    c.fillStyle = '#FF6218';
    c.beginPath();
    c.ellipse(cx, hy + 18, 16, 12, 0, 0, Math.PI * 2);
    c.fill();

    // Sculpted angular horned dragon cranium
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 32, hy - 10);
        c.quadraticCurveTo(cx, hy - 34, cx + 32, hy - 10);
        c.lineTo(cx + 26, hy + 14);
        c.lineTo(cx + 12, hy + 28);
        c.lineTo(cx - 12, hy + 28);
        c.lineTo(cx - 26, hy + 14);
        c.closePath();
      },
      { x0: cx - 32, y0: hy - 34, x1: cx + 32, y1: hy + 28 },
      { lit: '#FAF0DC', mid: '#C8B89E', dark: '#54443E', rim: '#FFC078' },
      { shadowPoolFrac: 0.38, inkW: 3.8 }
    );
    // Deep shadow sockets + glowing ember eyes
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(cx - 24, hy - 6);
    c.lineTo(cx - 6, hy + 1);
    c.lineTo(cx - 12, hy + 8);
    c.lineTo(cx - 22, hy + 4);
    c.closePath();
    c.moveTo(cx + 24, hy - 6);
    c.lineTo(cx + 6, hy + 1);
    c.lineTo(cx + 12, hy + 8);
    c.lineTo(cx + 22, hy + 4);
    c.closePath();
    c.fill();
    c.fillStyle = '#FF9C1A';
    c.fillRect(cx - 18, hy - 1, 7, 4.5);
    c.fillRect(cx + 11, hy - 1, 7, 4.5);
    // Sharp white dragon fangs
    c.fillStyle = '#FFF8E8';
    for (const fx of [-14, -4, 6]) {
      c.beginPath();
      c.moveTo(cx + fx, hy + 20);
      c.lineTo(cx + fx + 3.5, hy + 34);
      c.lineTo(cx + fx + 7, hy + 20);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.stroke();
    }
  });

  // 14. Colosseum Swordsman: Exalted spectral hoplite in plumed bronze helm, cuirass & glowing teal kopis blade
  withCell(ctx, 'enemy_colosseum_swordsman', (c, w, h) => {
    const cx = w * 0.46;
    const baseY = h * 0.86;
    // Athletic Armored Legs + Cape
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 26, baseY - 94);
        c.lineTo(cx + 24, baseY - 94);
        c.lineTo(cx + 34, baseY - 8);
        c.lineTo(cx - 34, baseY - 12);
        c.closePath();
      },
      { x0: cx - 34, y0: baseY - 94, x1: cx + 34, y1: baseY - 8 },
      { lit: '#48D4CE', mid: '#185A68', dark: INK, rim: '#A8FFF8' },
      { shadowPoolFrac: 0.44, inkW: 3.6 }
    );
    // Golden Hoplite Cuirass
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 24, baseY - 96);
        c.lineTo(cx + 24, baseY - 96);
        c.lineTo(cx + 16, baseY - 52);
        c.lineTo(cx - 16, baseY - 52);
        c.closePath();
      },
      { x0: cx - 24, y0: baseY - 96, x1: cx + 24, y1: baseY - 52 },
      { lit: '#FFF2B0', mid: '#E0A838', dark: '#54300A' },
      { shadowPoolFrac: 0.38, hatch: false, inkW: 3.6 }
    );
    // Crested Corinthian Helm
    c.fillStyle = '#FF5CB8';
    c.beginPath();
    c.moveTo(cx - 8, baseY - 118);
    c.quadraticCurveTo(cx - 28, baseY - 144, cx + 16, baseY - 140);
    c.quadraticCurveTo(cx + 30, baseY - 124, cx + 14, baseY - 108);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.ellipse(cx, baseY - 108, 16, 18, 0, 0, Math.PI * 2);
      },
      { x0: cx - 16, y0: baseY - 126, x1: cx + 16, y1: baseY - 90 },
      { lit: '#FFF4B8', mid: '#E2AC3A', dark: '#54300A' },
      { shadowPoolFrac: 0.4, hatch: false, inkW: 3.4 }
    );
    c.fillStyle = INK;
    c.fillRect(cx - 10, baseY - 110, 20, 6);
    c.fillStyle = '#8CFFFA';
    c.fillRect(cx - 6, baseY - 109, 4, 3);
    c.fillRect(cx + 3, baseY - 109, 4, 3);
    // Sweeping gleaming ethereal kopis sword!
    c.fillStyle = '#99FFF8';
    c.beginPath();
    c.moveTo(cx + 22, baseY - 68);
    c.lineTo(cx + 58, baseY - 114);
    c.lineTo(cx + 64, baseY - 102);
    c.lineTo(cx + 28, baseY - 58);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
  });

  // 15. Colosseum Shieldbearer: Armoured hoplite champion behind embossed bronze tower-aspis greatshield
  withCell(ctx, 'enemy_colosseum_shieldbearer', (c, w, h) => {
    const cx = w * 0.44;
    const baseY = h * 0.86;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 28, baseY - 4);
        c.lineTo(cx - 30, baseY - 94);
        c.lineTo(cx + 22, baseY - 94);
        c.lineTo(cx + 24, baseY - 4);
        c.closePath();
      },
      { x0: cx - 30, y0: baseY - 94, x1: cx + 24, y1: baseY - 4 },
      { lit: '#54DCD4', mid: '#1B5A68', dark: INK, rim: '#A8FFF8' },
      { shadowPoolFrac: 0.42, inkW: 3.8 }
    );
    // Plumed helm
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.ellipse(cx - 4, baseY - 112, 16, 18, 0, 0, Math.PI * 2);
      },
      { x0: cx - 20, y0: baseY - 130, x1: cx + 12, y1: baseY - 94 },
      { lit: '#FFF4B8', mid: '#E2AC3A', dark: '#54300A' },
      { shadowPoolFrac: 0.4, hatch: false, inkW: 3.6 }
    );
    c.fillStyle = '#FFE66E';
    c.fillRect(cx - 8, baseY - 114, 14, 4);
    // Massive embossed golden hoplite greatshield covering right flank!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.ellipse(cx + 30, baseY - 58, 28, 46, 0.08, 0, Math.PI * 2);
      },
      { x0: cx + 2, y0: baseY - 104, x1: cx + 58, y1: baseY - 12 },
      { lit: '#FFF6BA', mid: '#E8B03C', dark: '#54300A', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.38, inkW: 4.0 }
    );
    c.fillStyle = '#28A8B2';
    c.beginPath();
    c.ellipse(cx + 30, baseY - 58, 15, 24, 0.08, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
  });

  // 16. Colosseum Bowman: Exalted emerald-gold archer in crested visor drawing a golden greatbow
  withCell(ctx, 'enemy_colosseum_bowman', (c, w, h) => {
    const cx = w * 0.42;
    const baseY = h * 0.86;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 26, baseY);
        c.lineTo(cx - 24, baseY - 96);
        c.lineTo(cx + 18, baseY - 96);
        c.lineTo(cx + 22, baseY);
        c.lineTo(cx + 4, baseY - 22);
        c.lineTo(cx - 10, baseY - 22);
        c.closePath();
      },
      { x0: cx - 26, y0: baseY - 96, x1: cx + 22, y1: baseY },
      { lit: '#72F5C4', mid: '#1E6654', dark: INK, rim: '#B8FFE6' },
      { shadowPoolFrac: 0.42, inkW: 3.8 }
    );
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.ellipse(cx, baseY - 112, 15, 17, 0, 0, Math.PI * 2);
      },
      { x0: cx - 15, y0: baseY - 129, x1: cx + 15, y1: baseY - 95 },
      { lit: '#FFF4B8', mid: '#E2AC3A', dark: '#54300A' },
      { shadowPoolFrac: 0.4, hatch: false, inkW: 3.4 }
    );
    c.fillStyle = '#FFF080';
    c.fillRect(cx - 6, baseY - 114, 14, 4);
    // Golden Elysian-grade warbow + glowing arrow
    c.strokeStyle = INK;
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(cx + 22, baseY - 118);
    c.quadraticCurveTo(cx + 62, baseY - 74, cx + 22, baseY - 30);
    c.stroke();
    c.strokeStyle = '#F5CA54';
    c.lineWidth = 5;
    c.stroke();
    c.strokeStyle = '#FFF5B8';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx + 8, baseY - 74);
    c.lineTo(cx + 58, baseY - 74);
    c.stroke();
  });

  // 17. FLAMEWHEEL CHARIOT (Ornate Spiked Bronze War-Chariot w/ Flaming Spoked Wheels & Spectral Fire-Core — ZERO 3 Concentric Circles!)
  withCell(ctx, 'enemy_chariot_flame', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.84;
    // Blazing flame plumes trailing behind spoked wheels
    const flame = c.createRadialGradient(cx - 10, baseY - 46, 8, cx - 10, baseY - 46, 58);
    flame.addColorStop(0, '#FFF8B8');
    flame.addColorStop(0.45, 'rgba(255, 112, 24, 0.85)');
    flame.addColorStop(1, 'rgba(200, 24, 10, 0)');
    c.fillStyle = flame;
    c.beginPath();
    c.arc(cx - 10, baseY - 46, 58, 0, Math.PI * 2);
    c.fill();

    // Rear spoked bronze chariot wheel
    const drawWheel = (wx: number, wy: number, r: number) => {
      c.save();
      c.beginPath();
      c.arc(wx, wy, r, 0, Math.PI * 2);
      c.strokeStyle = INK;
      c.lineWidth = 11;
      c.stroke();
      c.strokeStyle = '#E8B23C';
      c.lineWidth = 5.5;
      c.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        c.strokeStyle = '#C88424';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(wx, wy);
        c.lineTo(wx + Math.cos(a) * r, wy + Math.sin(a) * r);
        c.stroke();
      }
      // Scythed wheel hub blade
      c.fillStyle = '#FFF0A8';
      c.beginPath();
      c.arc(wx, wy, 7, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.6;
      c.stroke();
      c.restore();
    };
    drawWheel(cx - 24, baseY - 34, 28);

    // Ornate Bladed Bronze Chariot Hull & Spiked Ramming Prow!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 38, baseY - 36);
        c.lineTo(cx - 26, baseY - 82);
        c.quadraticCurveTo(cx + 12, baseY - 88, cx + 38, baseY - 62);
        c.lineTo(cx + 66, baseY - 38); // razor ramming prow!
        c.lineTo(cx + 34, baseY - 22);
        c.lineTo(cx - 32, baseY - 24);
        c.closePath();
      },
      { x0: cx - 38, y0: baseY - 88, x1: cx + 66, y1: baseY - 22 },
      { lit: '#FFF0A8', mid: '#D6942C', dark: '#46220A', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.4, inkW: 4.0 }
    );
    // Spectral blazing fire-spirit core crowning chariot cab!
    c.fillStyle = '#FF5814';
    c.beginPath();
    c.moveTo(cx - 2, baseY - 120);
    c.quadraticCurveTo(cx + 24, baseY - 94, cx + 14, baseY - 76);
    c.lineTo(cx - 18, baseY - 76);
    c.quadraticCurveTo(cx - 26, baseY - 96, cx - 2, baseY - 120);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
    c.fillStyle = '#FFF8B8';
    c.beginPath();
    c.ellipse(cx, baseY - 88, 7, 11, 0, 0, Math.PI * 2);
    c.fill();

    // Foreground spoked bronze chariot wheel
    drawWheel(cx + 10, baseY - 26, 30);
  });

  // 18. Soul-Eye Regenerating Orb (ornate magenta-gold floating eye reliquary!)
  withCell(ctx, 'enemy_soul_orb', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, 48);
    g.addColorStop(0, '#FFF2FC');
    g.addColorStop(0.45, 'rgba(255, 50, 212, 0.85)');
    g.addColorStop(1, 'rgba(180, 16, 160, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 48, 0, Math.PI * 2);
    c.fill();
    // Ornate golden claw bezel framing crystal eye
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx, cy - 32);
        c.lineTo(cx + 28, cy);
        c.lineTo(cx, cy + 32);
        c.lineTo(cx - 28, cy);
        c.closePath();
      },
      { x0: cx - 28, y0: cy - 32, x1: cx + 28, y1: cy + 32 },
      { lit: '#FFF4B8', mid: '#E8A836', dark: '#542A0A' },
      { shadowPoolFrac: 0.36, hatch: false, inkW: 3.4 }
    );
    c.fillStyle = '#FF38D4';
    c.beginPath();
    c.ellipse(cx, cy, 18, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx, cy, 4.5, 11, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.arc(cx - 5, cy - 3, 2.5, 0, Math.PI * 2);
    c.fill();
  });

  // 19. VENOM SATYR CULTIST (Hunched Goat-Horned Cultist, Cloven Hooves, Snout & Brass Blowpipe — ZERO Cone!)
  withCell(ctx, 'enemy_venom_satyr', (c, w, h) => {
    const cx = w * 0.46;
    const baseY = h * 0.87;
    // Digitigrade goat legs & cloven hooves
    for (const [lx, rx] of [
      [cx - 20, cx - 8],
      [cx + 6, cx + 18],
    ]) {
      c.fillStyle = '#361E1E';
      c.beginPath();
      c.moveTo(lx, baseY - 38);
      c.lineTo(rx, baseY - 38);
      c.lineTo(rx - 4, baseY - 16);
      c.lineTo(rx + 4, baseY);
      c.lineTo(lx - 2, baseY);
      c.lineTo(lx - 6, baseY - 18);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3.2;
      c.stroke();
    }
    // Tattered ragged crimson cultist mantle hunched forward!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 34, baseY - 22);
        c.bezierCurveTo(cx - 42, baseY - 68, cx - 24, baseY - 110, cx + 6, baseY - 116);
        c.lineTo(cx + 30, baseY - 82);
        c.lineTo(cx + 34, baseY - 26);
        c.lineTo(cx + 12, baseY - 36);
        c.lineTo(cx - 12, baseY - 20);
        c.closePath();
      },
      { x0: cx - 40, y0: baseY - 116, x1: cx + 34, y1: baseY - 20 },
      { lit: '#A82A3C', mid: '#4E1422', dark: INK, rim: '#A8F036' },
      { shadowPoolFrac: 0.44, inkW: 3.8 }
    );
    // Sinister horned goat snout emerging from crimson hood
    for (const dir of [-1, 1] as const) {
      c.fillStyle = '#D4C4A4';
      c.beginPath();
      c.moveTo(cx + dir * 10, baseY - 112);
      c.quadraticCurveTo(cx + dir * 32, baseY - 134, cx + dir * 20, baseY - 144);
      c.quadraticCurveTo(cx + dir * 18, baseY - 126, cx + dir * 4, baseY - 116);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.stroke();
    }
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx + 6, baseY - 96, 16, 17, 0.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#B8FF2E';
    c.fillRect(cx + 1, baseY - 101, 6, 3.5);
    c.fillRect(cx + 11, baseY - 100, 6, 3.5);
    // Ornate curved brass venom blowpipe dripping glowing green poison!
    c.strokeStyle = INK;
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(cx + 10, baseY - 88);
    c.lineTo(cx + 62, baseY - 80);
    c.stroke();
    c.strokeStyle = '#C89E3E';
    c.lineWidth = 4.4;
    c.stroke();
    c.fillStyle = '#9CF024';
    c.beginPath();
    c.arc(cx + 62, baseY - 76, 5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.stroke();
  });

  // 20. GIANT VERMIN (Armored Segmented Subterranean Plague-Beast w/ Venom Fangs & Pustules — ZERO Oval + 1 Dot!)
  withCell(ctx, 'enemy_giant_vermin', (c, w, h) => {
    const cx = w * 0.48;
    const baseY = h * 0.84;
    // Scuttling clawed chitin legs
    c.strokeStyle = INK;
    c.lineWidth = 6;
    for (const lx of [-38, -14, 12, 34]) {
      c.beginPath();
      c.moveTo(cx + lx, baseY - 22);
      c.lineTo(cx + lx + (lx < 0 ? -12 : 12), baseY - 6);
      c.lineTo(cx + lx + (lx < 0 ? -6 : 16), baseY + 6);
      c.stroke();
    }
    // Curled spiky rat-plague tail whipping behind
    paintTaperedArc(c, cx - 44, baseY - 26, cx - 72, baseY - 46, cx - 64, baseY - 72, 7.5, INK);
    paintTaperedArc(c, cx - 44, baseY - 26, cx - 72, baseY - 46, cx - 64, baseY - 72, 3.5, '#7A6E54');

    // Hunched segmented armored plague-carapace spine!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 52, baseY - 20);
        c.bezierCurveTo(cx - 58, baseY - 74, cx + 6, baseY - 88, cx + 44, baseY - 56);
        c.lineTo(cx + 64, baseY - 32); // snarling fanged snout!
        c.lineTo(cx + 42, baseY - 12);
        c.lineTo(cx - 38, baseY - 10);
        c.closePath();
      },
      { x0: cx - 54, y0: baseY - 84, x1: cx + 64, y1: baseY - 10 },
      { lit: '#6E744C', mid: '#343822', dark: INK, rim: '#C2FF48' },
      { shadowPoolFrac: 0.44, inkW: 4.2 }
    );
    // Segmented chitin armor plates & dorsal spines
    for (const sx of [-26, -6, 14]) {
      paintTaperedArc(c, cx + sx, baseY - 74, cx + sx - 8, baseY - 44, cx + sx - 4, baseY - 14, 3.2, INK);
    }
    // Glowing toxic chartreuse plague pustules!
    for (const [px, py, r] of [
      [-20, -56, 7.5],
      [2, -64, 9],
      [20, -52, 6.5],
    ]) {
      c.fillStyle = '#B4FF34';
      c.beginPath();
      c.arc(cx + px, baseY + py, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.4;
      c.stroke();
    }
    // Fierce glowing eye & dripping ivory fangs on snout!
    c.fillStyle = '#FF3842';
    c.beginPath();
    c.arc(cx + 38, baseY - 44, 4.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#FFF6DE';
    c.beginPath();
    c.moveTo(cx + 46, baseY - 28);
    c.lineTo(cx + 50, baseY - 16);
    c.lineTo(cx + 54, baseY - 26);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.stroke();
  });

  // 21. SNAKESTONE LASER (Coiled Carved Basalt Serpent-Idol Monolith + Blazing Crystalline Ocular Prism!)
  withCell(ctx, 'enemy_snakestone_laser', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.84;
    // Coiled carved stone serpent base
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.ellipse(cx, baseY - 14, 42, 18, 0, 0, Math.PI * 2);
      },
      { x0: cx - 42, y0: baseY - 32, x1: cx + 42, y1: baseY + 4 },
      { lit: '#56804A', mid: '#2A4226', dark: INK },
      { shadowPoolFrac: 0.44, inkW: 3.8 }
    );
    // Flared carved cobra-hood monolith spire
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 22, baseY - 16);
        c.bezierCurveTo(cx - 44, baseY - 64, cx - 42, baseY - 104, cx, baseY - 126);
        c.bezierCurveTo(cx + 42, baseY - 104, cx + 44, baseY - 64, cx + 22, baseY - 16);
        c.closePath();
      },
      { x0: cx - 42, y0: baseY - 126, x1: cx + 42, y1: baseY - 16 },
      { lit: '#64AD5A', mid: '#2D5830', dark: INK, rim: '#D8FF72' },
      { shadowPoolFrac: 0.44, inkW: 4.2 }
    );
    // Carved golden cobra-hood ribs
    c.strokeStyle = '#D4B048';
    c.lineWidth = 2.6;
    for (const ry of [-84, -66, -48]) {
      c.beginPath();
      c.moveTo(cx - 26, baseY + ry);
      c.quadraticCurveTo(cx, baseY + ry - 8, cx + 26, baseY + ry);
      c.stroke();
    }
    // Blazing ocular laser prism set in obsidian brow
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx, baseY - 82, 16, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#E8FF68';
    c.beginPath();
    c.moveTo(cx, baseY - 100);
    c.lineTo(cx + 12, baseY - 82);
    c.lineTo(cx, baseY - 64);
    c.lineTo(cx - 12, baseY - 82);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
  });

  // 22. HEAVY BRAWLER (Massive Hunched Stone-and-Iron Crypt Bruiser w/ Horned Iron Mask & Chained Stone-Slab Fists!)
  withCell(ctx, 'enemy_heavy_brawler', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.87;
    // Broad hunched iron-bound crypt juggernaut silhouette
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 46, baseY);
        c.bezierCurveTo(cx - 66, baseY - 62, cx - 54, baseY - 118, cx - 22, baseY - 126);
        c.lineTo(cx + 22, baseY - 126);
        c.bezierCurveTo(cx + 54, baseY - 118, cx + 66, baseY - 62, cx + 46, baseY);
        c.lineTo(cx + 16, baseY - 22);
        c.lineTo(cx - 16, baseY - 22);
        c.closePath();
      },
      { x0: cx - 64, y0: baseY - 126, x1: cx + 64, y1: baseY },
      { lit: '#5C5062', mid: '#2A2230', dark: INK, rim: '#E5B454' },
      { shadowPoolFrac: 0.44, inkW: 4.6 }
    );
    // Massive cracked stone-slab chained fists on left & right!
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.roundRect(cx + dir * 42 - 18, baseY - 52, 36, 44, 7);
        },
        { x0: cx + dir * 42 - 18, y0: baseY - 52, x1: cx + dir * 42 + 18, y1: baseY - 8 },
        { lit: '#8C8478', mid: '#48423E', dark: INK },
        { shadowPoolFrac: 0.42, hatch: false, inkW: 3.8 }
      );
      c.strokeStyle = '#D49E3C';
      c.lineWidth = 3.5;
      c.strokeRect(cx + dir * 42 - 14, baseY - 38, 28, 12);
    }
    // Horned Tarnished-Bronze Executioner Mask
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 22, baseY - 118);
        c.lineTo(cx - 32, baseY - 146);
        c.lineTo(cx - 10, baseY - 134);
        c.lineTo(cx + 10, baseY - 134);
        c.lineTo(cx + 32, baseY - 146);
        c.lineTo(cx + 22, baseY - 118);
        c.lineTo(cx + 16, baseY - 94);
        c.lineTo(cx - 16, baseY - 94);
        c.closePath();
      },
      { x0: cx - 32, y0: baseY - 146, x1: cx + 32, y1: baseY - 94 },
      { lit: '#F2C45A', mid: '#A87424', dark: '#3E2408' },
      { shadowPoolFrac: 0.42, hatch: false, inkW: 3.8 }
    );
    c.fillStyle = '#FF3828';
    c.fillRect(cx - 12, baseY - 114, 8, 4.5);
    c.fillRect(cx + 4, baseY - 114, 8, 4.5);
  });
}

// ============================================================================
// 6. ALL 8 BESPOKE BOSSES + TITAN (ZERO Primitive Clip-Art!)
// ============================================================================

function drawAllBosses(ctx: CanvasRenderingContext2D): void {
  // Helper for sculpted tattered Gothic Fury Wings (shared anatomy, individually styled per sister!)
  const drawFuryWing = (
    c: CanvasRenderingContext2D,
    ox: number,
    oy: number,
    dir: -1 | 1,
    spread: number,
    lift: number,
    cols: { lit: string; mid: string; rim: string }
  ) => {
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(ox + dir * 14, oy);
        c.bezierCurveTo(ox + dir * (68 * spread), oy - (94 + lift), ox + dir * (118 * spread), oy - (78 + lift), ox + dir * (142 * spread), oy - (38 + lift * 0.6));
        c.quadraticCurveTo(ox + dir * (116 * spread), oy + 4, ox + dir * (126 * spread), oy + 40);
        c.quadraticCurveTo(ox + dir * (90 * spread), oy + 22, ox + dir * (84 * spread), oy + 68);
        c.quadraticCurveTo(ox + dir * (52 * spread), oy + 42, ox + dir * (44 * spread), oy + 86);
        c.lineTo(ox + dir * 14, oy + 44);
        c.closePath();
      },
      { x0: ox - 142, y0: oy - 100, x1: ox + 142, y1: oy + 86 },
      { lit: cols.lit, mid: cols.mid, dark: INK, rim: cols.rim },
      { shadowPoolFrac: 0.46, inkW: 4.8 }
    );
    // Wing bone ribs
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(ox + dir * 24, oy + 2);
    c.lineTo(ox + dir * (118 * spread), oy + 36);
    c.moveTo(ox + dir * 24, oy + 8);
    c.lineTo(ox + dir * (80 * spread), oy + 64);
    c.stroke();
  };

  // BOSS 1: WARDEN MALICE (Gothic Bat-Winged Executioner w/ Coiled Barbed Crimson Whip!)
  withCell(ctx, 'boss_warden_malice', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.87;
    const halo = c.createRadialGradient(cx, baseY - 150, 10, cx, baseY - 150, 100);
    halo.addColorStop(0, 'rgba(210, 32, 160, 0.45)');
    halo.addColorStop(1, 'rgba(14, 4, 22, 0)');
    c.fillStyle = halo;
    c.beginPath();
    c.arc(cx, baseY - 150, 100, 0, Math.PI * 2);
    c.fill();

    drawFuryWing(c, cx, baseY - 150, -1, 1.0, 12, { lit: '#5E1E78', mid: '#240A36', rim: '#FF46B8' });
    drawFuryWing(c, cx, baseY - 150, 1, 0.92, -4, { lit: '#4A1664', mid: '#1C082A', rim: '#FF46B8' });

    // Armored thigh-high boots
    for (const [lx, rx] of [
      [cx - 20, cx - 6],
      [cx + 6, cx + 22],
    ]) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(lx, baseY - 78);
          c.lineTo(rx, baseY - 78);
          c.lineTo(rx + 2, baseY + 2);
          c.lineTo(lx - 2, baseY + 2);
          c.closePath();
        },
        { x0: lx - 2, y0: baseY - 78, x1: rx + 2, y1: baseY + 2 },
        { lit: '#462258', mid: '#1B0B28', dark: INK },
        { shadowPoolFrac: 0.45, hatch: false, inkW: 3.8 }
      );
    }

    // Flowing tattered crimson-violet battle skirt & corset
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 24, baseY - 104);
        c.lineTo(cx + 22, baseY - 104);
        c.bezierCurveTo(cx + 48, baseY - 64, cx + 56, baseY - 24, cx + 44, baseY + 4);
        c.lineTo(cx + 22, baseY - 28);
        c.lineTo(cx, baseY - 48);
        c.lineTo(cx - 22, baseY - 18);
        c.lineTo(cx - 46, baseY);
        c.closePath();
      },
      { x0: cx - 46, y0: baseY - 104, x1: cx + 54, y1: baseY + 4 },
      { lit: '#B8184C', mid: '#4E0A2A', dark: INK, rim: '#FF60D8' },
      { shadowPoolFrac: 0.44, inkW: 4.4 }
    );
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 24, baseY - 150);
        c.lineTo(cx + 24, baseY - 150);
        c.lineTo(cx + 14, baseY - 98);
        c.lineTo(cx, baseY - 88);
        c.lineTo(cx - 14, baseY - 98);
        c.closePath();
      },
      { x0: cx - 24, y0: baseY - 150, x1: cx + 24, y1: baseY - 88 },
      { lit: '#4C2062', mid: '#1D0A28', dark: INK },
      { shadowPoolFrac: 0.44, hatch: false, inkW: 4.0 }
    );
    // Gold filigree V-trim + swept spiked pauldron
    c.strokeStyle = '#F0B642';
    c.lineWidth = 2.8;
    c.beginPath();
    c.moveTo(cx - 17, baseY - 142);
    c.lineTo(cx, baseY - 104);
    c.lineTo(cx + 17, baseY - 142);
    c.stroke();

    // Coiled glowing barbed crimson whip
    c.strokeStyle = INK;
    c.lineWidth = 9.5;
    c.beginPath();
    c.moveTo(cx + 26, baseY - 118);
    c.bezierCurveTo(cx + 128, baseY - 104, cx + 116, baseY - 10, cx + 44, baseY - 16);
    c.stroke();
    c.strokeStyle = '#FF2474';
    c.lineWidth = 4;
    c.stroke();

    // Sculpted pale 3/4 face + dark violet hair + curved twin obsidian-gold horns
    const hy = baseY - 174;
    c.fillStyle = '#180828';
    c.beginPath();
    c.moveTo(cx - 26, hy + 28);
    c.bezierCurveTo(cx - 34, hy - 20, cx - 16, hy - 36, cx + 4, hy - 34);
    c.bezierCurveTo(cx + 28, hy - 30, cx + 38, hy + 4, cx + 24, hy + 46);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();

    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 13, hy - 12);
        c.quadraticCurveTo(cx, hy - 20, cx + 13, hy - 12);
        c.lineTo(cx + 11, hy + 10);
        c.lineTo(cx - 1, hy + 20);
        c.lineTo(cx - 12, hy + 9);
        c.closePath();
      },
      { x0: cx - 14, y0: hy - 20, x1: cx + 14, y1: hy + 20 },
      { lit: '#F2E4FA', mid: '#C8B0DE', dark: '#543674' },
      { shadowPoolFrac: 0.36, hatch: false, inkW: 3.4 }
    );
    for (const dir of [-1, 1] as const) {
      c.fillStyle = '#E8AE38';
      c.beginPath();
      c.moveTo(cx + dir * 8, hy - 16);
      c.quadraticCurveTo(cx + dir * 30, hy - 30, cx + dir * 24, hy - 56);
      c.quadraticCurveTo(cx + dir * 16, hy - 34, cx + dir * 2, hy - 20);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3.2;
      c.stroke();
    }
    c.fillStyle = '#FF1C5E';
    c.fillRect(cx - 10, hy - 3, 7, 3.5);
    c.fillRect(cx + 3, hy - 3, 7, 3.5);
  });

  // BOSS 2: WARDEN FURY (Bespoke Scorching Crimson Berserker w/ Twin Serrated Saw-Whips & Spiked Flame Pauldrons!)
  withCell(ctx, 'boss_warden_fury', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.87;
    const aura = c.createRadialGradient(cx, baseY - 140, 12, cx, baseY - 140, 108);
    aura.addColorStop(0, 'rgba(255, 86, 28, 0.48)');
    aura.addColorStop(1, 'rgba(30, 4, 8, 0)');
    c.fillStyle = aura;
    c.beginPath();
    c.arc(cx, baseY - 140, 108, 0, Math.PI * 2);
    c.fill();

    // Jagged flame-rimmed bat wings swept aggressively upward
    drawFuryWing(c, cx, baseY - 142, -1, 0.96, 24, { lit: '#8C1418', mid: '#38080E', rim: '#FF7824' });
    drawFuryWing(c, cx, baseY - 142, 1, 0.96, 16, { lit: '#781016', mid: '#2E060C', rim: '#FF7824' });

    // Wide berserker stance legs + crimson war-greaves
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 10, baseY - 76);
          c.lineTo(cx + dir * 26, baseY - 76);
          c.lineTo(cx + dir * 36, baseY);
          c.lineTo(cx + dir * 18, baseY);
          c.closePath();
        },
        { x0: cx - 36, y0: baseY - 76, x1: cx + 36, y1: baseY },
        { lit: '#C82228', mid: '#5A0C14', dark: INK },
        { shadowPoolFrac: 0.44, hatch: false, inkW: 3.8 }
      );
    }

    // Spiked Scorched-Bronze & Crimson Corset + Shredded Ember Tassets
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 28, baseY - 144);
        c.lineTo(cx + 28, baseY - 144);
        c.lineTo(cx + 42, baseY - 22);
        c.lineTo(cx + 12, baseY - 46);
        c.lineTo(cx, baseY - 20);
        c.lineTo(cx - 12, baseY - 46);
        c.lineTo(cx - 42, baseY - 22);
        c.closePath();
      },
      { x0: cx - 42, y0: baseY - 144, x1: cx + 42, y1: baseY - 20 },
      { lit: '#EB2824', mid: '#780E14', dark: INK, rim: '#FFAE38' },
      { shadowPoolFrac: 0.44, inkW: 4.4 }
    );

    // Massive Spiked Flame-Orange Pauldrons (asymmetric jagged blades!)
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 14, baseY - 144);
          c.lineTo(cx + dir * 56, baseY - 166);
          c.lineTo(cx + dir * 48, baseY - 134);
          c.lineTo(cx + dir * 60, baseY - 124);
          c.lineTo(cx + dir * 20, baseY - 118);
          c.closePath();
        },
        { x0: cx - 60, y0: baseY - 166, x1: cx + 60, y1: baseY - 118 },
        { lit: '#FFA838', mid: '#C83218', dark: '#2E080A', rim: '#FFF2A8' },
        { shadowPoolFrac: 0.36, hatch: false, inkW: 3.8 }
      );
      // Bent Armored Berserker Arms + Gauntlets wielding Jagged Spinning Saw-Chakrams!
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 24, baseY - 126);
          c.lineTo(cx + dir * 58, baseY - 102);
          c.lineTo(cx + dir * 74, baseY - 62);
          c.lineTo(cx + dir * 58, baseY - 56);
          c.lineTo(cx + dir * 42, baseY - 92);
          c.lineTo(cx + dir * 20, baseY - 108);
          c.closePath();
        },
        { x0: cx - 76, y0: baseY - 126, x1: cx + 76, y1: baseY - 56 },
        { lit: '#F2C4A8', mid: '#A83224', dark: '#2E0A10' },
        { shadowPoolFrac: 0.36, hatch: false, inkW: 3.6 }
      );
      // Blazing Serrated Saw-Whip Lash & Toothed Saw-Chakram!
      c.strokeStyle = INK;
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(cx + dir * 66, baseY - 60);
      c.quadraticCurveTo(cx + dir * 102, baseY - 40, cx + dir * 82, baseY - 14);
      c.stroke();
      c.strokeStyle = '#FF5818';
      c.lineWidth = 3.2;
      c.stroke();

      const sx = cx + dir * 78;
      const sy = baseY - 26;
      c.fillStyle = '#FFE088';
      c.beginPath();
      for (let t = 0; t < 16; t++) {
        const r = t % 2 === 0 ? 18 : 10;
        const ang = (t * Math.PI) / 8;
        const px = sx + Math.cos(ang) * r;
        const py = sy + Math.sin(ang) * r;
        if (t === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.8;
      c.stroke();
      c.fillStyle = '#E0222E';
      c.beginPath();
      c.arc(sx, sy, 6, 0, Math.PI * 2);
      c.fill();
    }

    // Wild Blazing Crimson Spiky Hair + Fierce Visage + Twin Horned Tiara!
    const hy = baseY - 170;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 28, hy + 16);
        c.lineTo(cx - 48, hy - 14);
        c.lineTo(cx - 26, hy - 26);
        c.lineTo(cx - 32, hy - 50);
        c.lineTo(cx - 8, hy - 34);
        c.lineTo(cx + 8, hy - 54);
        c.lineTo(cx + 22, hy - 32);
        c.lineTo(cx + 46, hy - 20);
        c.lineTo(cx + 28, hy + 16);
        c.closePath();
      },
      { x0: cx - 48, y0: hy - 54, x1: cx + 46, y1: hy + 16 },
      { lit: '#FF6A28', mid: '#B01620', dark: '#2A050C', rim: '#FFE078' },
      { shadowPoolFrac: 0.36, hatch: false, inkW: 3.8 }
    );
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 15, hy - 12);
        c.quadraticCurveTo(cx, hy - 20, cx + 15, hy - 12);
        c.lineTo(cx + 12, hy + 11);
        c.lineTo(cx, hy + 21);
        c.lineTo(cx - 12, hy + 11);
        c.closePath();
      },
      { x0: cx - 15, y0: hy - 20, x1: cx + 15, y1: hy + 21 },
      { lit: '#F7E2DC', mid: '#D4A8A4', dark: '#6E3C42' },
      { shadowPoolFrac: 0.32, hatch: false, inkW: 3.2 }
    );
    c.fillStyle = INK;
    c.fillRect(cx - 13, hy - 6, 26, 7);
    c.fillStyle = '#FFC224';
    c.fillRect(cx - 10, hy - 4, 6.5, 3.5);
    c.fillRect(cx + 3.5, hy - 4, 6.5, 3.5);
  });

  // BOSS 3: WARDEN MURDER (Bespoke Hooded Bronze-Masked Phantom Executioner w/ Emerald-Black Shroud & Twin Sickle-Cleavers!)
  withCell(ctx, 'boss_warden_murder', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.87;
    drawFuryWing(c, cx, baseY - 148, -1, 0.94, 4, { lit: '#1F5C4E', mid: '#0C2824', rim: '#52F5B4' });
    drawFuryWing(c, cx, baseY - 148, 1, 0.94, 4, { lit: '#1B4E44', mid: '#0A201E', rim: '#52F5B4' });

    // Ragged emerald-obsidian hooded shroud flowing down to jagged tatters
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 26, baseY - 160);
        c.quadraticCurveTo(cx, baseY - 210, cx + 26, baseY - 160);
        c.lineTo(cx + 48, baseY - 8);
        c.lineTo(cx + 22, baseY - 34);
        c.lineTo(cx + 4, baseY + 2);
        c.lineTo(cx - 16, baseY - 28);
        c.lineTo(cx - 48, baseY - 4);
        c.closePath();
      },
      { x0: cx - 48, y0: baseY - 208, x1: cx + 48, y1: baseY + 2 },
      { lit: '#2A6A5B', mid: '#122E2B', dark: INK, rim: '#68FFC6' },
      { shadowPoolFrac: 0.48, inkW: 4.6 }
    );

    // Twin Wicked Curved Crescent Sickle-Cleavers!
    for (const dir of [-1, 1] as const) {
      c.save();
      c.translate(cx + dir * 48, baseY - 94);
      c.scale(dir, 1);
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(-10, 26);
          c.lineTo(-4, -18);
          c.bezierCurveTo(24, -46, 56, -24, 46, 22);
          c.quadraticCurveTo(32, -8, 6, -4);
          c.lineTo(2, 26);
          c.closePath();
        },
        { x0: -10, y0: -40, x1: 52, y1: 26 },
        { lit: '#E4FFF4', mid: '#6E9C94', dark: '#182A2A', rim: '#78FFCC' },
        { shadowPoolFrac: 0.36, hatch: false, inkW: 3.8 }
      );
      c.restore();
    }

    // Haunting Engraved Bronze Executioner Mask inside Pitch-Black Hood Cavern!
    const hy = baseY - 168;
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx, hy, 22, 26, 0, 0, Math.PI * 2);
    c.fill();
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 15, hy - 14);
        c.lineTo(cx + 15, hy - 14);
        c.lineTo(cx + 12, hy + 12);
        c.lineTo(cx, hy + 22);
        c.lineTo(cx - 12, hy + 12);
        c.closePath();
      },
      { x0: cx - 15, y0: hy - 14, x1: cx + 15, y1: hy + 22 },
      { lit: '#F2E0B0', mid: '#B08C48', dark: '#3E2B12' },
      { shadowPoolFrac: 0.42, hatch: false, inkW: 3.4 }
    );
    // Razor glowing blood-red mask slits
    c.fillStyle = '#FF2040';
    c.fillRect(cx - 10, hy - 4, 7, 3.5);
    c.fillRect(cx + 3, hy - 4, 7, 3.5);
  });

  // BOSS 4: BONE LEVIATHAN (Colossal Articulated Obsidian-Ivory Serpent Dragon + Furnace Ribcage + Bronze Chains + Horned Skull!)
  withCell(ctx, 'boss_bone_leviathan', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.88;

    // Blazing molten magma swirl base
    const lava = c.createRadialGradient(cx, baseY - 12, 14, cx, baseY - 12, 122);
    lava.addColorStop(0, '#FFAE24');
    lava.addColorStop(0.48, 'rgba(225, 48, 12, 0.65)');
    lava.addColorStop(1, 'rgba(80, 10, 8, 0)');
    c.fillStyle = lava;
    c.beginPath();
    c.ellipse(cx, baseY - 12, 122, 46, 0, 0, Math.PI * 2);
    c.fill();

    // Articulated Segmented Obsidian-Bone Spinal Column + Jagged Dorsal Spikes
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 48, baseY);
        c.bezierCurveTo(cx - 72, baseY - 72, cx - 26, baseY - 130, cx - 30, baseY - 184);
        c.lineTo(cx + 30, baseY - 184);
        c.bezierCurveTo(cx + 42, baseY - 124, cx + 70, baseY - 68, cx + 50, baseY);
        c.closePath();
      },
      { x0: cx - 68, y0: baseY - 184, x1: cx + 68, y1: baseY },
      { lit: '#642A26', mid: '#2A0E12', dark: INK, rim: '#FF9442' },
      { shadowPoolFrac: 0.44, inkW: 5.0 }
    );

    // Incandescent Molten Magma Furnace Core glowing inside cavernous shadowed ribcage!
    const coreG = c.createRadialGradient(cx, baseY - 82, 6, cx, baseY - 82, 42);
    coreG.addColorStop(0, '#FFF8B8');
    coreG.addColorStop(0.45, '#FF6A14');
    coreG.addColorStop(1, 'rgba(180, 20, 8, 0)');
    c.fillStyle = coreG;
    c.beginPath();
    c.ellipse(cx, baseY - 82, 34, 62, 0, 0, Math.PI * 2);
    c.fill();

    // 5 Pairs of Heavy Articulated Curved Ivory Rib Plates + Bronze Collar Chains!
    for (let i = 0; i < 5; i++) {
      const ry = baseY - 24 - i * 27;
      const rw = 56 - i * 5;
      for (const dir of [-1, 1] as const) {
        paintChiaroscuroShape(
          c,
          () => {
            c.beginPath();
            c.moveTo(cx + dir * rw, ry + 8);
            c.quadraticCurveTo(cx + dir * (rw * 0.54), ry - 14, cx + dir * 10, ry - 4);
            c.lineTo(cx + dir * 12, ry + 10);
            c.quadraticCurveTo(cx + dir * (rw * 0.52), ry + 2, cx + dir * (rw - 4), ry + 16);
            c.closePath();
          },
          { x0: cx - rw, y0: ry - 14, x1: cx + rw, y1: ry + 16 },
          { lit: '#FAF0D8', mid: '#C8B89C', dark: '#4A3C36' },
          { shadowPoolFrac: 0.4, hatch: false, inkW: 3.4 }
        );
      }
    }

    // Heavy Tarnished-Bronze Collar Chains draped around dragon neck!
    c.strokeStyle = '#E5AA38';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(cx - 38, baseY - 146);
    c.quadraticCurveTo(cx, baseY - 122, cx + 38, baseY - 146);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 2.8;
    c.stroke();

    // Massive Horned Draconic Skull w/ Swept Obsidian Crown Horns, Hinged Serrated Jaw & Mignola Brow Cavern (fits cleanly inside cell!)
    const hy = baseY - 184;
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 24, hy - 16);
          c.quadraticCurveTo(cx + dir * 78, hy - 28, cx + dir * 92, hy - 68);
          c.quadraticCurveTo(cx + dir * 60, hy - 48, cx + dir * 34, hy - 38);
          c.closePath();
        },
        { x0: cx - 94, y0: hy - 68, x1: cx + 94, y1: hy - 16 },
        { lit: '#7E423C', mid: '#381A22', dark: INK, rim: '#FFC474' },
        { shadowPoolFrac: 0.36, hatch: false, inkW: 4.4 }
      );
    }

    // Glowing molten lower jaw cavern
    c.fillStyle = '#FF5A14';
    c.beginPath();
    c.ellipse(cx, hy + 36, 26, 18, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();

    // Chiseled Bony Draconic Cranium & Armored Snout
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 58, hy - 22);
        c.quadraticCurveTo(cx, hy - 62, cx + 58, hy - 22);
        c.lineTo(cx + 46, hy + 22);
        c.lineTo(cx + 24, hy + 46);
        c.lineTo(cx, hy + 52);
        c.lineTo(cx - 24, hy + 46);
        c.lineTo(cx - 46, hy + 22);
        c.closePath();
      },
      { x0: cx - 58, y0: hy - 62, x1: cx + 58, y1: hy + 52 },
      { lit: '#FFF6E2', mid: '#CBBCA0', dark: '#54463E', rim: '#FFC878' },
      { shadowPoolFrac: 0.4, inkW: 5.0 }
    );
    // Heavy Mignola Brow Shadow Mask & Blazing Molten Eye-Sockets!
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(cx - 44, hy - 14);
    c.lineTo(cx - 10, hy - 1);
    c.lineTo(cx - 18, hy + 13);
    c.lineTo(cx - 40, hy + 6);
    c.closePath();
    c.moveTo(cx + 44, hy - 14);
    c.lineTo(cx + 10, hy - 1);
    c.lineTo(cx + 18, hy + 13);
    c.lineTo(cx + 40, hy + 6);
    c.closePath();
    c.fill();
    c.fillStyle = '#FFA41C';
    c.fillRect(cx - 32, hy - 4, 12, 7);
    c.fillRect(cx + 20, hy - 4, 12, 7);
    c.fillStyle = '#FFFCE0';
    c.fillRect(cx - 29, hy - 2, 5, 3);
    c.fillRect(cx + 23, hy - 2, 5, 3);
    // Serrated jagged fangs
    c.fillStyle = '#FFF8E8';
    for (const fx of [-26, -14, -2, 10, 22]) {
      c.beginPath();
      c.moveTo(cx + fx - 4, hy + 32);
      c.lineTo(cx + fx, hy + 52);
      c.lineTo(cx + fx + 4, hy + 32);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.4;
      c.stroke();
    }
  });

  // BOSS 5: COLOSSEUM BULL (Massive Muscular Minotaur Juggernaut, Curved Ivory Horns, Harness, Shackles & Colossal Labrys Axe — ZERO Brown Box!)
  withCell(ctx, 'boss_colosseum_bull', (c, w, h) => {
    const cx = w * 0.47;
    const baseY = h * 0.88;

    // Colossal Cel-Shaded Double-Headed Labrys Battle-Axe angled dynamically behind shoulder!
    c.save();
    c.translate(cx + 68, baseY - 128);
    c.rotate(0.32);
    c.fillStyle = '#5C321C';
    c.fillRect(-7, -108, 14, 214);
    c.strokeStyle = INK;
    c.lineWidth = 4.2;
    c.strokeRect(-7, -108, 14, 214);
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(-54, -92);
        c.quadraticCurveTo(0, -56, 54, -92);
        c.lineTo(62, -18);
        c.quadraticCurveTo(0, -48, -62, -18);
        c.closePath();
      },
      { x0: -62, y0: -92, x1: 62, y1: -18 },
      { lit: '#FFF8D0', mid: '#E8B23E', dark: '#542C08', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.36, inkW: 4.4 }
    );
    c.restore();

    // Muscular Digitigrade Bull Legs + Heavy Iron Ankle Shackles + Cloven Hooves
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 16, baseY - 66);
          c.lineTo(cx + dir * 50, baseY - 66);
          c.lineTo(cx + dir * 60, baseY - 14);
          c.lineTo(cx + dir * 54, baseY + 2);
          c.lineTo(cx + dir * 24, baseY + 2);
          c.lineTo(cx + dir * 28, baseY - 18);
          c.closePath();
        },
        { x0: cx - 60, y0: baseY - 66, x1: cx + 60, y1: baseY + 2 },
        { lit: '#9C5A3E', mid: '#4E241A', dark: INK },
        { shadowPoolFrac: 0.44, inkW: 4.4 }
      );
    }

    // Massive Hunched Muscular Minotaur Shoulders, Scarred Bronze-Hide Pectorals & Heavy Deltoids!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 42, baseY - 60);
        c.bezierCurveTo(cx - 94, baseY - 94, cx - 98, baseY - 166, cx - 44, baseY - 184);
        c.quadraticCurveTo(cx, baseY - 202, cx + 44, baseY - 184);
        c.bezierCurveTo(cx + 98, baseY - 166, cx + 94, baseY - 94, cx + 42, baseY - 60);
        c.closePath();
      },
      { x0: cx - 96, y0: baseY - 196, x1: cx + 96, y1: baseY - 60 },
      { lit: '#CC7E58', mid: '#783B28', dark: '#240E0E', rim: '#FFE0A4' },
      { shadowPoolFrac: 0.42, inkW: 5.0 }
    );
    // Sculpted anatomical muscle-shadow ink lines across chest & shoulders
    paintTaperedArc(ctx, cx - 54, baseY - 114, cx - 24, baseY - 96, cx - 4, baseY - 116, 4.2, INK);
    paintTaperedArc(ctx, cx + 54, baseY - 114, cx + 24, baseY - 96, cx + 4, baseY - 116, 4.2, INK);

    // Diagonal Leather & Riveted Bronze War Harness + Iron Wrist Shackles!
    c.strokeStyle = INK;
    c.lineWidth = 15;
    c.beginPath();
    c.moveTo(cx - 64, baseY - 166);
    c.lineTo(cx + 42, baseY - 66);
    c.moveTo(cx + 64, baseY - 166);
    c.lineTo(cx - 42, baseY - 66);
    c.stroke();
    c.strokeStyle = '#D69A38';
    c.lineWidth = 8.5;
    c.stroke();

    // Pleated Crimson-and-Gold Gladiator War Kilt (layered armored pteruges — NOT a pink loincloth!)
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 48, baseY - 66);
        c.lineTo(cx + 48, baseY - 66);
        c.lineTo(cx + 52, baseY - 24);
        c.lineTo(cx + 22, baseY - 30);
        c.lineTo(cx, baseY - 14);
        c.lineTo(cx - 22, baseY - 30);
        c.lineTo(cx - 52, baseY - 24);
        c.closePath();
      },
      { x0: cx - 52, y0: baseY - 66, x1: cx + 52, y1: baseY - 14 },
      { lit: '#D42232', mid: '#780E1C', dark: INK, rim: '#F5C452' },
      { shadowPoolFrac: 0.42, inkW: 4.2 }
    );
    // Gold belt buckle
    c.fillStyle = '#F5C44E';
    c.fillRect(cx - 48, baseY - 72, 96, 12);
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.strokeRect(cx - 48, baseY - 72, 96, 12);

    // Sweeping Curved Ivory Bull Horns Banded in Bronze (fits cleanly inside cell!)
    const hy = baseY - 172;
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 24, hy - 12);
          c.quadraticCurveTo(cx + dir * 94, hy - 14, cx + dir * 78, hy - 74);
          c.quadraticCurveTo(cx + dir * 60, hy - 34, cx + dir * 18, hy - 26);
          c.closePath();
        },
        { x0: cx - 92, y0: hy - 74, x1: cx + 92, y1: hy - 10 },
        { lit: '#FFF8E4', mid: '#D4C2A2', dark: '#544234', rim: '#FFFFFF' },
        { shadowPoolFrac: 0.32, hatch: false, inkW: 4.2 }
      );
      c.strokeStyle = '#E8AE38';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(cx + dir * 46, hy - 30);
      c.lineTo(cx + dir * 54, hy - 18);
      c.stroke();
    }

    // Muscular Outstretched Forearms & Chained Iron Gauntlets gripping Labrys Axe!
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 64, baseY - 146);
          c.quadraticCurveTo(cx + dir * 102, baseY - 124, cx + dir * 94, baseY - 80);
          c.lineTo(cx + dir * 68, baseY - 76);
          c.quadraticCurveTo(cx + dir * 74, baseY - 106, cx + dir * 52, baseY - 122);
          c.closePath();
        },
        { x0: cx - 102, y0: baseY - 146, x1: cx + 102, y1: baseY - 76 },
        { lit: '#CC7E58', mid: '#783B28', dark: '#240E0E', rim: '#FFE0A4' },
        { shadowPoolFrac: 0.36, hatch: false, inkW: 4.2 }
      );
      // Heavy iron wrist shackle cuff
      c.fillStyle = '#4A5260';
      c.fillRect(cx + dir * 78 - 14, baseY - 88, 28, 12);
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.strokeRect(cx + dir * 78 - 14, baseY - 88, 28, 12);
    }

    // Fierce Sculpted Snorting Minotaur Snout + Golden Nose Ring + Glowing Amber Eyes!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 34, hy - 20);
        c.quadraticCurveTo(cx, hy - 42, cx + 34, hy - 20);
        c.lineTo(cx + 26, hy + 28);
        c.lineTo(cx, hy + 38);
        c.lineTo(cx - 26, hy + 28);
        c.closePath();
      },
      { x0: cx - 34, y0: hy - 42, x1: cx + 34, y1: hy + 38 },
      { lit: '#9C563C', mid: '#562A1E', dark: INK },
      { shadowPoolFrac: 0.44, inkW: 4.4 }
    );
    c.strokeStyle = '#F5CC54';
    c.lineWidth = 5.2;
    c.beginPath();
    c.arc(cx, hy + 26, 11, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#FF6A24';
    c.fillRect(cx - 17, hy - 7, 10, 5.5);
    c.fillRect(cx + 7, hy - 7, 10, 5.5);
  });

  // BOSS 6: COLOSSEUM SPEARLORD (Regal Golden-Armored Champion w/ Plumed Corinthian Helm, Sun-Spear Aspis Shield & Diagonal War-Spear — ZERO Tan Box!)
  withCell(ctx, 'boss_colosseum_spearlord', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.88;

    // Elongated Gleaming Bronze War-Spear held diagonally in heroic stance!
    c.save();
    c.strokeStyle = INK;
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(cx - 72, baseY - 8);
    c.lineTo(cx + 88, baseY - 226);
    c.stroke();
    c.strokeStyle = '#F2C448';
    c.lineWidth = 5.5;
    c.stroke();
    // Blazing sculpted spearhead
    c.fillStyle = '#FFF8C8';
    c.beginPath();
    c.moveTo(cx + 106, baseY - 252);
    c.lineTo(cx + 92, baseY - 208);
    c.lineTo(cx + 72, baseY - 224);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();
    c.restore();

    // Sweeping Royal Cobalt-and-Crimson Draped Champion Cape billowing heroically!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 38, baseY - 156);
        c.lineTo(cx + 42, baseY - 156);
        c.bezierCurveTo(cx + 82, baseY - 84, cx + 76, baseY - 24, cx + 60, baseY + 2);
        c.lineTo(cx + 16, baseY - 16);
        c.lineTo(cx - 46, baseY - 6);
        c.closePath();
      },
      { x0: cx - 46, y0: baseY - 156, x1: cx + 78, y1: baseY + 2 },
      { lit: '#C81E38', mid: '#6E0C24', dark: '#1C061A', rim: '#FFE684' },
      { shadowPoolFrac: 0.44, inkW: 4.6 }
    );

    // Sculpted Golden-Greaved Warrior Legs in Dynamic Stride
    for (const [lx, rx] of [
      [cx - 24, cx - 8],
      [cx + 10, cx + 28],
    ]) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(lx, baseY - 66);
          c.lineTo(rx, baseY - 66);
          c.lineTo(rx + 2, baseY + 2);
          c.lineTo(lx - 2, baseY + 2);
          c.closePath();
        },
        { x0: lx - 2, y0: baseY - 66, x1: rx + 2, y1: baseY + 2 },
        { lit: '#FFF2B4', mid: '#D6962C', dark: '#4A2608' },
        { shadowPoolFrac: 0.42, hatch: false, inkW: 3.8 }
      );
    }

    // Anatomical Sculpted Golden-Bronze Muscled Cuirass & Pteruges War-Skirt!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 42, baseY - 154);
        c.lineTo(cx + 42, baseY - 154);
        c.lineTo(cx + 26, baseY - 92);
        c.lineTo(cx + 40, baseY - 54);
        c.lineTo(cx - 40, baseY - 54);
        c.lineTo(cx - 26, baseY - 92);
        c.closePath();
      },
      { x0: cx - 42, y0: baseY - 154, x1: cx + 42, y1: baseY - 54 },
      { lit: '#FFF6BE', mid: '#E0A030', dark: '#4E2A0A', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.4, inkW: 4.6 }
    );
    // Embossed muscle pectoral ridge lines + cobalt waist sash
    paintTaperedArc(c, cx - 26, baseY - 122, cx - 12, baseY - 112, cx - 2, baseY - 122, 3, '#5E340A');
    paintTaperedArc(c, cx + 26, baseY - 122, cx + 12, baseY - 112, cx + 2, baseY - 122, 3, INK);
    c.fillStyle = '#1E548C';
    c.fillRect(cx - 28, baseY - 94, 56, 12);
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.strokeRect(cx - 28, baseY - 94, 56, 12);

    // Sculpted Armored Right Spear-Arm + Gold Pauldron
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx + 32, baseY - 148);
        c.lineTo(cx + 66, baseY - 134);
        c.lineTo(cx + 58, baseY - 102);
        c.lineTo(cx + 28, baseY - 116);
        c.closePath();
      },
      { x0: cx + 28, y0: baseY - 148, x1: cx + 66, y1: baseY - 102 },
      { lit: '#FFF6BE', mid: '#E0A030', dark: '#4E2A0A', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.34, hatch: false, inkW: 3.8 }
    );

    // Ornate Embossed Round Hoplite Aspis Shield w/ Radiant Sun-Spear Relief (NOT a pink circle!)
    const sx = cx - 46;
    const sy = baseY - 102;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.arc(sx, sy, 46, 0, Math.PI * 2);
      },
      { x0: sx - 46, y0: sy - 46, x1: sx + 46, y1: sy + 46 },
      { lit: '#FFF8C8', mid: '#EBAC32', dark: '#542C08', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.36, inkW: 4.8 }
    );
    c.fillStyle = '#183C5C';
    c.beginPath();
    c.arc(sx, sy, 31, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#F5C448';
    c.lineWidth = 3.2;
    c.stroke();
    // Radiant embossed golden sun-star relief on shield face
    c.fillStyle = '#FFF2AE';
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = i % 2 === 0 ? 24 : 9;
      const a = (i * Math.PI) / 8;
      const px = sx + Math.cos(a) * r;
      const py = sy + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.stroke();

    // Sweeping Crimson Horsehair Crest + Sculpted Corinthian War-Helm!
    const hy = baseY - 182;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 12, hy - 20);
        c.bezierCurveTo(cx - 56, hy - 74, cx + 28, hy - 84, cx + 52, hy - 44);
        c.quadraticCurveTo(cx + 60, hy - 14, cx + 26, hy - 10);
        c.closePath();
      },
      { x0: cx - 52, y0: hy - 78, x1: cx + 56, y1: hy - 10 },
      { lit: '#FF3648', mid: '#A81224', dark: '#36060E', rim: '#FFA89E' },
      { shadowPoolFrac: 0.38, inkW: 4.2 }
    );
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 22, hy - 14);
        c.quadraticCurveTo(cx, hy - 34, cx + 22, hy - 14);
        c.lineTo(cx + 20, hy + 20);
        c.lineTo(cx, hy + 28);
        c.lineTo(cx - 20, hy + 20);
        c.closePath();
      },
      { x0: cx - 22, y0: hy - 34, x1: cx + 22, y1: hy + 28 },
      { lit: '#FFF6C4', mid: '#E8AC34', dark: '#542C0A' },
      { shadowPoolFrac: 0.4, hatch: false, inkW: 4.2 }
    );
    c.fillStyle = INK;
    c.fillRect(cx - 14, hy - 5, 28, 8);
    c.fillStyle = '#5EF2FF';
    c.fillRect(cx - 10, hy - 3, 6, 3.5);
    c.fillRect(cx + 4, hy - 3, 6, 3.5);
  });

  // BOSS 7: THE FERRYMAN (Towering Hunched Skeletal River-Lord w/ Tattered Void-Indigo Cloak, Funerary Hat & Lantern-Hung Obsidian Oar — ZERO Paper Cone!)
  withCell(ctx, 'boss_the_ferryman', (c, w, h) => {
    const cx = w * 0.46;
    const baseY = h * 0.88;

    // Massive Brass-Bound Obsidian River Oar trailing glowing green-gold Ghost Lantern!
    c.save();
    c.translate(cx + 66, baseY - 124);
    c.rotate(0.24);
    c.fillStyle = '#2B1D34';
    c.fillRect(-7, -118, 14, 232);
    c.strokeStyle = INK;
    c.lineWidth = 4.2;
    c.strokeRect(-7, -118, 14, 232);
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(-24, -120);
        c.quadraticCurveTo(0, -172, 24, -120);
        c.lineTo(14, -68);
        c.lineTo(-14, -68);
        c.closePath();
      },
      { x0: -24, y0: -172, x1: 24, y1: -68 },
      { lit: '#FFF0A8', mid: '#D69A32', dark: '#46260A', rim: '#78FFCC' },
      { shadowPoolFrac: 0.4, inkW: 4.2 }
    );
    // Hanging Spectral Jade-Gold River Lantern!
    c.strokeStyle = '#E5B244';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(14, -64);
    c.lineTo(28, -32);
    c.stroke();
    const lGlow = c.createRadialGradient(28, -20, 2, 28, -20, 28);
    lGlow.addColorStop(0, '#EAFFF4');
    lGlow.addColorStop(0.45, 'rgba(64, 248, 186, 0.78)');
    lGlow.addColorStop(1, 'rgba(20, 140, 100, 0)');
    c.fillStyle = lGlow;
    c.beginPath();
    c.arc(28, -20, 28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#78FFD2';
    c.fillRect(21, -28, 14, 18);
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.strokeRect(21, -28, 14, 18);
    c.restore();

    // Towering Hunched Billowing Tattered Void-Indigo & Tarnished-Gold Mantle!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 64, baseY);
        c.bezierCurveTo(cx - 76, baseY - 94, cx - 54, baseY - 172, cx - 22, baseY - 188);
        c.lineTo(cx + 34, baseY - 180);
        c.bezierCurveTo(cx + 70, baseY - 104, cx + 68, baseY - 46, cx + 56, baseY - 4);
        c.lineTo(cx + 30, baseY - 26);
        c.lineTo(cx + 6, baseY + 4);
        c.lineTo(cx - 20, baseY - 24);
        c.lineTo(cx - 42, baseY + 2);
        c.closePath();
      },
      { x0: cx - 74, y0: baseY - 188, x1: cx + 68, y1: baseY + 4 },
      { lit: '#6C368E', mid: '#26103C', dark: INK, rim: '#E5B952' },
      { shadowPoolFrac: 0.48, inkW: 5.0 }
    );
    // Tarnished-gold funerary stole & draped cloak sleeve + articulated skeletal claws gripping oar shaft!
    c.strokeStyle = '#E8B242';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(cx - 44, baseY - 142);
    c.quadraticCurveTo(cx + 2, baseY - 104, cx + 46, baseY - 134);
    c.stroke();
    // Draped right sleeve reaching out to the oar shaft
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx + 18, baseY - 142);
        c.lineTo(cx + 58, baseY - 122);
        c.lineTo(cx + 52, baseY - 94);
        c.quadraticCurveTo(cx + 30, baseY - 82, cx + 12, baseY - 104);
        c.closePath();
      },
      { x0: cx + 12, y0: baseY - 142, x1: cx + 58, y1: baseY - 82 },
      { lit: '#743D99', mid: '#2D1246', dark: INK, rim: '#E5B952' },
      { shadowPoolFrac: 0.45, hatch: false, inkW: 3.8 }
    );
    // Articulated skeletal fingers wrapping around oar shaft at (cx + 62, baseY - 108)
    for (let f = 0; f < 3; f++) {
      const fy = baseY - 116 + f * 7;
      c.fillStyle = '#E8DFC8';
      c.beginPath();
      c.roundRect(cx + 52, fy, 18, 6.2, 3);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.4;
      c.stroke();
    }

    // Deep Pitch-Black Face Shadow Cavern w/ Glowing Skeletal Jaw + Amethyst-Cyan Eye Embers!
    const hy = baseY - 190;
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx + 4, hy + 4, 24, 26, 0, 0, Math.PI * 2);
    c.fill();
    // Spectral ivory skull cheek & jaw rim peeking from under hat shadow
    c.fillStyle = '#C8BCD8';
    c.beginPath();
    c.moveTo(cx - 12, hy + 10);
    c.lineTo(cx + 20, hy + 10);
    c.lineTo(cx + 12, hy + 26);
    c.lineTo(cx - 4, hy + 26);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    c.stroke();
    c.fillStyle = '#E068FF';
    c.beginPath();
    c.arc(cx - 6, hy + 2, 6, 0, Math.PI * 2);
    c.arc(cx + 14, hy + 2, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#FFFFFF';
    c.beginPath();
    c.arc(cx - 6, hy + 2, 2.5, 0, Math.PI * 2);
    c.arc(cx + 14, hy + 2, 2.5, 0, Math.PI * 2);
    c.fill();

    // Battered Asymmetric Tattered Wide-Brimmed Funerary Hat (organic bent peak, NOT a crisp triangle!)
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 88, hy - 6);
        c.quadraticCurveTo(cx - 26, hy - 34, cx - 8, hy - 74);
        c.quadraticCurveTo(cx + 22, hy - 62, cx + 32, hy - 34);
        c.quadraticCurveTo(cx + 68, hy - 22, cx + 92, hy - 4);
        c.quadraticCurveTo(cx + 4, hy + 16, cx - 88, hy - 6);
        c.closePath();
      },
      { x0: cx - 88, y0: hy - 74, x1: cx + 92, y1: hy + 14 },
      { lit: '#8A4AB0', mid: '#3A1858', dark: INK, rim: '#F2C452' },
      { shadowPoolFrac: 0.44, inkW: 4.8 }
    );
    // Gold hatband & dangling amulet coin
    c.strokeStyle = '#F2C452';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(cx - 34, hy - 24);
    c.quadraticCurveTo(cx + 4, hy - 14, cx + 40, hy - 24);
    c.stroke();
  });

  // BOSS 8: SOVEREIGN LORD OF THE ABYSS (Titanic Underworld Monarch w/ Jagged Spiked Obsidian-Bronze Pauldrons, Flame-Hemmed Mantle, Horned Crown & Incandescent Bident — ZERO Balloon Shoulders!)
  withCell(ctx, 'boss_sovereign_lord', (c, w, h) => {
    const cx = w * 0.46;
    const baseY = h * 0.88;

    // Dramatic molten crimson-and-gold royal furnace aura
    const aura = c.createRadialGradient(cx, baseY - 156, 16, cx, baseY - 156, 148);
    aura.addColorStop(0, 'rgba(255, 76, 36, 0.56)');
    aura.addColorStop(0.55, 'rgba(156, 14, 30, 0.26)');
    aura.addColorStop(1, 'rgba(18, 4, 12, 0)');
    c.fillStyle = aura;
    c.beginPath();
    c.arc(cx, baseY - 156, 148, 0, Math.PI * 2);
    c.fill();

    // Colossal Incandescent Twin-Pronged Infernal Bident blazing with #FF3044 core heat!
    c.save();
    c.translate(cx + 98, baseY - 134);
    c.rotate(0.18);
    // Radiant heat aura around bident prongs
    const bGlow = c.createRadialGradient(0, -138, 6, 0, -138, 56);
    bGlow.addColorStop(0, 'rgba(255, 224, 140, 0.9)');
    bGlow.addColorStop(0.45, 'rgba(255, 48, 68, 0.55)');
    bGlow.addColorStop(1, 'rgba(255, 48, 68, 0)');
    c.fillStyle = bGlow;
    c.beginPath();
    c.arc(0, -138, 56, 0, Math.PI * 2);
    c.fill();
    // Obsidian iron shaft
    c.fillStyle = '#221622';
    c.fillRect(-7, -108, 14, 242);
    c.strokeStyle = INK;
    c.lineWidth = 4.6;
    c.strokeRect(-7, -108, 14, 242);
    // Jagged twin blazing infernal bident prongs!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(-30, -102);
        c.lineTo(-24, -176);
        c.lineTo(-8, -120);
        c.lineTo(8, -120);
        c.lineTo(24, -176);
        c.lineTo(30, -102);
        c.lineTo(14, -92);
        c.lineTo(-14, -92);
        c.closePath();
      },
      { x0: -30, y0: -176, x1: 30, y1: -92 },
      { lit: '#FFF8C8', mid: '#FF6428', dark: '#8A1020', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.25, hatch: false, inkW: 4.4 }
    );
    c.restore();

    // Towering Broad-Shouldered Obsidian-Crimson Royal Mantle w/ Gold Filigree & Billowing Flame-Edged Hem!
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 98, baseY + 2);
        c.bezierCurveTo(cx - 114, baseY - 102, cx - 94, baseY - 180, cx - 48, baseY - 200);
        c.lineTo(cx + 48, baseY - 200);
        c.bezierCurveTo(cx + 94, baseY - 180, cx + 114, baseY - 102, cx + 98, baseY + 2);
        c.lineTo(cx + 58, baseY - 24);
        c.lineTo(cx + 28, baseY + 4);
        c.lineTo(cx, baseY - 22);
        c.lineTo(cx - 28, baseY + 4);
        c.lineTo(cx - 58, baseY - 24);
        c.closePath();
      },
      { x0: cx - 108, y0: baseY - 200, x1: cx + 108, y1: baseY + 4 },
      { lit: '#C4182C', mid: '#4E0A16', dark: INK, rim: '#FF7838' },
      { shadowPoolFrac: 0.48, inkW: 5.4 }
    );
    // Licking ember-gold royal filigree border along cape hem!
    c.strokeStyle = '#F5BC42';
    c.lineWidth = 4.6;
    c.beginPath();
    c.moveTo(cx - 90, baseY - 16);
    c.lineTo(cx - 56, baseY - 34);
    c.lineTo(cx, baseY - 14);
    c.lineTo(cx + 56, baseY - 34);
    c.lineTo(cx + 90, baseY - 16);
    c.stroke();

    // Titanic Sculpted Obsidian-Gold Royal Cuirass & Ribbed Underworld Crest
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 58, baseY - 196);
        c.lineTo(cx + 58, baseY - 196);
        c.lineTo(cx + 40, baseY - 76);
        c.lineTo(cx, baseY - 58);
        c.lineTo(cx - 40, baseY - 76);
        c.closePath();
      },
      { x0: cx - 58, y0: baseY - 196, x1: cx + 58, y1: baseY - 58 },
      { lit: '#48344E', mid: '#1E1424', dark: INK, rim: '#F2BC48' },
      { shadowPoolFrac: 0.46, inkW: 4.6 }
    );
    // Gold skull-pectoral medallion
    c.strokeStyle = '#F2BC48';
    c.lineWidth = 3.8;
    c.beginPath();
    c.moveTo(cx - 38, baseY - 178);
    c.lineTo(cx, baseY - 110);
    c.lineTo(cx + 38, baseY - 178);
    c.stroke();

    // GIGANTIC SPIKED OBSIDIAN-BRONZE LAYERED PAULDRONS (Jagged Angular Armor Plates — ZERO Balloon Circles!)
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 32, baseY - 198);
          c.lineTo(cx + dir * 94, baseY - 224); // sweeping armored shoulder blade spike!
          c.lineTo(cx + dir * 82, baseY - 182);
          c.lineTo(cx + dir * 102, baseY - 164); // lower secondary armor flange!
          c.lineTo(cx + dir * 72, baseY - 144);
          c.lineTo(cx + dir * 36, baseY - 156);
          c.closePath();
        },
        { x0: cx - 102, y0: baseY - 224, x1: cx + 102, y1: baseY - 144 },
        { lit: '#FFF0A8', mid: '#C88428', dark: '#2E1614', rim: '#FF7A38' },
        { shadowPoolFrac: 0.44, inkW: 4.8 }
      );
      // Crimson skull relief inlay on pauldron plate
      c.fillStyle = '#D62032';
      c.beginPath();
      c.arc(cx + dir * 64, baseY - 176, 9, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.6;
      c.stroke();
    }

    // Stern Deeply-Shadowed Sovereign Visage, Braided Dark Beard & Towering Horned Obsidian-Gold Royal Crown (100% inside cell!)
    const hy = baseY - 202;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 24, hy - 18);
        c.quadraticCurveTo(cx, hy - 34, cx + 24, hy - 18);
        c.lineTo(cx + 22, hy + 16);
        c.lineTo(cx, hy + 28);
        c.lineTo(cx - 22, hy + 16);
        c.closePath();
      },
      { x0: cx - 24, y0: hy - 34, x1: cx + 24, y1: hy + 28 },
      { lit: '#F2E6F2', mid: '#BAA8C4', dark: '#463452' },
      { shadowPoolFrac: 0.38, hatch: false, inkW: 4.2 }
    );
    // Heavy Mignola brow shadow mask + blazing ember sovereign eyes!
    c.fillStyle = INK;
    c.fillRect(cx - 22, hy - 14, 44, 15);
    c.fillStyle = '#FF4818';
    c.fillRect(cx - 16, hy - 8, 11, 5.5);
    c.fillRect(cx + 5, hy - 8, 11, 5.5);
    c.fillStyle = '#FFF8B8';
    c.fillRect(cx - 13, hy - 7, 5, 3);
    c.fillRect(cx + 8, hy - 7, 5, 3);

    // Sweeping Braided Dark Sovereign Beard w/ Gold Beard Clasps
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 24, hy + 6);
        c.lineTo(cx - 34, hy + 52);
        c.lineTo(cx - 8, hy + 34);
        c.lineTo(cx, hy + 62);
        c.lineTo(cx + 8, hy + 34);
        c.lineTo(cx + 34, hy + 52);
        c.lineTo(cx + 24, hy + 6);
        c.closePath();
      },
      { x0: cx - 34, y0: hy + 6, x1: cx + 34, y1: hy + 62 },
      { lit: '#4A385C', mid: '#1D142A', dark: INK },
      { shadowPoolFrac: 0.44, hatch: false, inkW: 4.0 }
    );

    // Towering Branching Crowned Horned Obsidian-Gold Royal Helm (cleanly framed below y=6!)
    for (const dir of [-1, 1] as const) {
      paintChiaroscuroShape(
        c,
        () => {
          c.beginPath();
          c.moveTo(cx + dir * 12, hy - 16);
          c.quadraticCurveTo(cx + dir * 60, hy - 18, cx + dir * 82, hy - 58);
          c.lineTo(cx + dir * 56, hy - 40);
          c.lineTo(cx + dir * 50, hy - 68);
          c.quadraticCurveTo(cx + dir * 30, hy - 32, cx + dir * 6, hy - 24);
          c.closePath();
        },
        { x0: cx - 82, y0: hy - 68, x1: cx + 82, y1: hy - 16 },
        { lit: '#FFF6BC', mid: '#EBA828', dark: '#462208', rim: '#FFFFFF' },
        { shadowPoolFrac: 0.32, hatch: false, inkW: 4.2 }
      );
    }
  });

  // BOSS 9: Generic Titan Boss fallback
  withCell(ctx, 'boss_generic_titan', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.86;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 66, baseY);
        c.lineTo(cx - 78, baseY - 144);
        c.lineTo(cx - 26, baseY - 198);
        c.lineTo(cx + 26, baseY - 198);
        c.lineTo(cx + 78, baseY - 144);
        c.lineTo(cx + 66, baseY);
        c.closePath();
      },
      { x0: cx - 78, y0: baseY - 198, x1: cx + 78, y1: baseY },
      { lit: '#96343C', mid: '#3E1420', dark: INK, rim: '#F2BE52' },
      { shadowPoolFrac: 0.44, inkW: 5.0 }
    );
    c.fillStyle = '#F2BE52';
    c.beginPath();
    c.moveTo(cx - 32, baseY - 198);
    c.lineTo(cx - 42, baseY - 244);
    c.lineTo(cx - 12, baseY - 214);
    c.lineTo(cx, baseY - 252);
    c.lineTo(cx + 12, baseY - 214);
    c.lineTo(cx + 42, baseY - 244);
    c.lineTo(cx + 32, baseY - 198);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.2;
    c.stroke();
    c.fillStyle = '#FF6B2B';
    c.fillRect(cx - 20, baseY - 170, 11, 6);
    c.fillRect(cx + 9, baseY - 170, 11, 6);
  });
}

// ============================================================================
// 7. Pickups, Patron Sigils, Curing Basin & All Combat VFX / Decals
// ============================================================================

function drawPickupsAndSigils(ctx: CanvasRenderingContext2D): void {
  withCell(ctx, 'vfx_boon_orb', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, 42);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.4, '#FFE278');
    g.addColorStop(0.75, '#E89D2C');
    g.addColorStop(1, 'rgba(232, 157, 44, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 42, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#FFF1B0';
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

  withCell(ctx, 'vfx_bloodstone', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx, 6);
        c.lineTo(w - 11, cy);
        c.lineTo(cx, h - 6);
        c.lineTo(11, cy);
        c.closePath();
      },
      { x0: 11, y0: 6, x1: w - 11, y1: h - 6 },
      { lit: '#FFA6B4', mid: '#E81A3C', dark: '#540616', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.34, hatch: false, inkW: 3.6 }
    );
    c.strokeStyle = '#FFE0E6';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx, 13);
    c.lineTo(cx - 10, cy);
    c.lineTo(cx, h - 13);
    c.stroke();
  });

  withCell(ctx, 'vfx_centaur_heart', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.52;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx, cy + 28);
        c.bezierCurveTo(cx - 38, cy + 2, cx - 34, cy - 32, cx, cy - 12);
        c.bezierCurveTo(cx + 34, cy - 32, cx + 38, cy + 2, cx, cy + 28);
        c.closePath();
      },
      { x0: cx - 34, y0: cy - 28, x1: cx + 34, y1: cy + 28 },
      { lit: '#FF9AA4', mid: '#DC1C34', dark: '#5A0816', rim: '#FFF2B8' },
      { shadowPoolFrac: 0.34, hatch: false, inkW: 3.8 }
    );
  });

  withCell(ctx, 'vfx_gold_coin', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.arc(cx, cy, 24, 0, Math.PI * 2);
      },
      { x0: cx - 24, y0: cy - 24, x1: cx + 24, y1: cy + 24 },
      { lit: '#FFF8BE', mid: '#F2B834', dark: '#7A460E', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.32, hatch: false, inkW: 3.8 }
    );
    c.strokeStyle = '#7A460E';
    c.lineWidth = 2.4;
    c.beginPath();
    c.arc(cx, cy, 15, 0, Math.PI * 2);
    c.stroke();
  });

  withCell(ctx, 'vfx_darkness_orb', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.54;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx, 8);
        c.bezierCurveTo(cx + 30, cy - 4, cx + 28, cy + 30, cx, cy + 30);
        c.bezierCurveTo(cx - 28, cy + 30, cx - 30, cy - 4, cx, 8);
        c.closePath();
      },
      { x0: cx - 28, y0: 8, x1: cx + 28, y1: cy + 30 },
      { lit: '#EAACFF', mid: '#7E28D4', dark: '#180630', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.36, hatch: false, inkW: 3.8 }
    );
  });

  withCell(ctx, 'vfx_pom_icon', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.56;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.arc(cx, cy, 25, 0, Math.PI * 2);
      },
      { x0: cx - 25, y0: cy - 25, x1: cx + 25, y1: cy + 25 },
      { lit: '#FF6A7E', mid: '#CE1A34', dark: '#4A0614', rim: '#FFE0A4' },
      { shadowPoolFrac: 0.36, hatch: false, inkW: 3.8 }
    );
    c.fillStyle = '#E8B048';
    c.beginPath();
    c.moveTo(cx - 10, cy - 22);
    c.lineTo(cx - 14, cy - 34);
    c.lineTo(cx, cy - 28);
    c.lineTo(cx + 14, cy - 34);
    c.lineTo(cx + 10, cy - 22);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = '#FFAAC0';
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

  withCell(ctx, 'vfx_hammer_icon', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.save();
    c.translate(cx, cy);
    c.rotate(-0.55);
    c.fillStyle = '#804C24';
    c.fillRect(-5, -8, 10, 40);
    c.strokeStyle = INK;
    c.lineWidth = 3.4;
    c.strokeRect(-5, -8, 10, 40);
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.roundRect(-24, -26, 48, 22, 5);
      },
      { x0: -24, y0: -26, x1: 24, y1: -4 },
      { lit: '#FFF6BA', mid: '#F0BC48', dark: '#6E420E' },
      { shadowPoolFrac: 0.34, hatch: false, inkW: 3.4 }
    );
    c.restore();
  });

  withCell(ctx, 'vfx_skull_badge', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 22, cy - 8);
        c.quadraticCurveTo(cx, cy - 32, cx + 22, cy - 8);
        c.lineTo(cx + 18, cy + 12);
        c.lineTo(cx + 10, cy + 24);
        c.lineTo(cx - 10, cy + 24);
        c.lineTo(cx - 18, cy + 12);
        c.closePath();
      },
      { x0: cx - 22, y0: cy - 32, x1: cx + 22, y1: cy + 24 },
      { lit: '#FFF8E4', mid: '#D6C4A4', dark: '#544438' },
      { shadowPoolFrac: 0.36, hatch: false, inkW: 3.8 }
    );
    c.fillStyle = '#FF243E';
    c.beginPath();
    c.arc(cx - 8, cy - 4, 5.2, 0, Math.PI * 2);
    c.arc(cx + 8, cy - 4, 5.2, 0, Math.PI * 2);
    c.fill();
  });

  withCell(ctx, 'vfx_shop_purse', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.58;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.arc(cx, cy, 24, 0, Math.PI * 2);
      },
      { x0: cx - 24, y0: cy - 24, x1: cx + 24, y1: cy + 24 },
      { lit: '#B8426A', mid: '#6E203E', dark: '#240814' },
      { shadowPoolFrac: 0.4, hatch: false, inkW: 3.8 }
    );
    c.fillStyle = '#F2C154';
    c.fillRect(cx - 12, cy - 26, 24, 8);
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.strokeRect(cx - 12, cy - 26, 24, 8);
  });

  withCell(ctx, 'vfx_fountain_chalice', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.52;
    c.fillStyle = '#48EAFF';
    c.beginPath();
    c.ellipse(cx, cy - 14, 22, 9, 0, 0, Math.PI * 2);
    c.fill();
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 22, cy - 12);
        c.quadraticCurveTo(cx - 16, cy + 12, cx - 5, cy + 14);
        c.lineTo(cx - 14, cy + 30);
        c.lineTo(cx + 14, cy + 30);
        c.lineTo(cx + 5, cy + 14);
        c.quadraticCurveTo(cx + 16, cy + 12, cx + 22, cy - 12);
        c.closePath();
      },
      { x0: cx - 22, y0: cy - 12, x1: cx + 22, y1: cy + 30 },
      { lit: '#FFF4B8', mid: '#DC9E38', dark: '#54300A' },
      { shadowPoolFrac: 0.36, hatch: false, inkW: 3.6 }
    );
  });

  withCell(ctx, 'vfx_gemstone', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx, 8);
        c.lineTo(w - 10, cy - 6);
        c.lineTo(w - 16, h - 10);
        c.lineTo(16, h - 10);
        c.lineTo(10, cy - 6);
        c.closePath();
      },
      { x0: 10, y0: 8, x1: w - 10, y1: h - 10 },
      { lit: '#B8F6FF', mid: '#34D4FF', dark: '#0E4C7A', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.32, hatch: false, inkW: 3.6 }
    );
  });

  withCell(ctx, 'vfx_key', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.34;
    c.strokeStyle = INK;
    c.lineWidth = 12;
    c.beginPath();
    c.arc(cx, cy, 14, 0, Math.PI * 2);
    c.moveTo(cx, cy + 14);
    c.lineTo(cx, h - 12);
    c.moveTo(cx, h - 22);
    c.lineTo(cx + 14, h - 22);
    c.moveTo(cx, h - 12);
    c.lineTo(cx + 12, h - 12);
    c.stroke();
    c.strokeStyle = '#DCE4EE';
    c.lineWidth = 6;
    c.stroke();
  });

  withCell(ctx, 'vfx_nectar', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.58;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.arc(cx, cy, 22, 0, Math.PI * 2);
      },
      { x0: cx - 22, y0: cy - 22, x1: cx + 22, y1: cy + 22 },
      { lit: '#FFF4A8', mid: '#FFAE28', dark: '#8A420C', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.34, hatch: false, inkW: 3.6 }
    );
    c.fillStyle = '#FFE58F';
    c.fillRect(cx - 7, cy - 34, 14, 14);
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.strokeRect(cx - 7, cy - 34, 14, 14);
  });

  // 10 Sculpted Patron Sigil Medallions (beveled obsidian-and-gold discs + crisp heraldic emblems!)
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
      const halo = c.createRadialGradient(cx, cy, 8, cx, cy, 42);
      halo.addColorStop(0, def.colorHex);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = halo;
      c.beginPath();
      c.arc(cx, cy, 42, 0, Math.PI * 2);
      c.fill();

      c.beginPath();
      c.arc(cx, cy, 32, 0, Math.PI * 2);
      const discG = c.createLinearGradient(cx - 28, cy - 28, cx + 28, cy + 28);
      discG.addColorStop(0, '#2B1F3A');
      discG.addColorStop(0.55, '#130C1E');
      discG.addColorStop(1, INK);
      c.fillStyle = discG;
      c.fill();
      c.strokeStyle = def.colorHex;
      c.lineWidth = 4.6;
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 2.4;
      c.stroke();

      c.fillStyle = def.colorHex;
      c.strokeStyle = INK;
      c.lineWidth = 3;
      switch (patronId) {
        case 'voltaris':
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
        case 'tidebreaker':
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
        case 'aegira':
          c.beginPath();
          c.moveTo(cx, cy - 20);
          c.lineTo(cx + 18, cy - 12);
          c.quadraticCurveTo(cx + 16, cy + 12, cx, cy + 22);
          c.quadraticCurveTo(cx - 16, cy + 12, cx - 18, cy - 12);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        case 'velouris':
          c.beginPath();
          c.moveTo(cx, cy + 18);
          c.bezierCurveTo(cx - 26, cy, cx - 22, cy - 22, cx, cy - 8);
          c.bezierCurveTo(cx + 22, cy - 22, cx + 26, cy, cx, cy + 18);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        case 'sylvara':
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
        case 'bellum':
          c.beginPath();
          c.moveTo(cx, cy - 22);
          c.lineTo(cx + 12, cy + 8);
          c.lineTo(cx, cy + 22);
          c.lineTo(cx - 12, cy + 8);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        case 'bacchion':
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
        case 'glaciera':
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
        case 'veloce':
          c.beginPath();
          c.moveTo(cx - 18, cy + 12);
          c.quadraticCurveTo(cx - 4, cy - 20, cx + 20, cy - 14);
          c.quadraticCurveTo(cx + 8, cy + 12, cx - 18, cy + 12);
          c.closePath();
          c.fill();
          c.stroke();
          break;
        case 'abyssos':
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
    });
  }
}

function drawAllVfxAndDecals(ctx: CanvasRenderingContext2D): void {
  // Sculpted Marble-and-Bronze Curing Basin Pedestal Font (NOT a flat cyan bowl!)
  withCell(ctx, 'vfx_curing_basin', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.56;
    // Carved stone pedestal base
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx - 46, cy + 4);
        c.lineTo(cx - 34, cy + 32);
        c.lineTo(cx + 34, cy + 32);
        c.lineTo(cx + 46, cy + 4);
        c.closePath();
      },
      { x0: cx - 46, y0: cy + 4, x1: cx + 46, y1: cy + 32 },
      { lit: '#C8D8D8', mid: '#6E8288', dark: '#222E34' },
      { shadowPoolFrac: 0.44, inkW: 3.8 }
    );
    // Octagonal carved marble rim lip + bronze filigree bevel
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.ellipse(cx, cy, 56, 28, 0, 0, Math.PI * 2);
      },
      { x0: cx - 56, y0: cy - 28, x1: cx + 56, y1: cy + 28 },
      { lit: '#F2F6EE', mid: '#8CA2A6', dark: '#2A3A40', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.36, hatch: false, inkW: 4.0 }
    );
    // Luminous rippling turquoise curing water + celestial runes
    const waterG = c.createRadialGradient(cx - 8, cy - 4, 4, cx, cy, 44);
    waterG.addColorStop(0, '#F0FFFF');
    waterG.addColorStop(0.42, '#48F2FF');
    waterG.addColorStop(0.82, '#0E8AB0');
    waterG.addColorStop(1, '#083A54');
    c.fillStyle = waterG;
    c.beginPath();
    c.ellipse(cx, cy - 2, 44, 20, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#E5B952';
    c.lineWidth = 3.2;
    c.stroke();
    // Rippling water caustics
    c.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(cx, cy - 2, 26, 11, 0, 0.4, 2.7);
    c.stroke();
    c.beginPath();
    c.ellipse(cx, cy - 2, 14, 6, 0, 3.6, 5.8);
    c.stroke();
  });

  // NEW 1: vfx_spark_streak (128x48 razor-sharp directional comic spark dart!)
  withCell(ctx, 'vfx_spark_streak', (c, w, h) => {
    const cy = h * 0.5;
    c.beginPath();
    c.moveTo(4, cy);
    c.quadraticCurveTo(w * 0.62, cy - 14, w - 4, cy);
    c.quadraticCurveTo(w * 0.62, cy + 14, 4, cy);
    c.closePath();
    const g = c.createLinearGradient(4, cy, w - 4, cy);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    g.addColorStop(0.45, '#FFFFFF');
    g.addColorStop(1, '#FFFFFF');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(9, 6, 14, 0.85)';
    c.lineWidth = 3;
    c.stroke();
  });

  // NEW 2: vfx_decal_crater (192x112 shattered isometric stone impact crater!)
  withCell(ctx, 'vfx_decal_crater', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, w * 0.44);
    g.addColorStop(0, 'rgba(9, 6, 14, 0.92)');
    g.addColorStop(0.45, 'rgba(22, 16, 26, 0.68)');
    g.addColorStop(0.75, 'rgba(42, 34, 46, 0.28)');
    g.addColorStop(1, 'rgba(9, 6, 14, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, cy, w * 0.44, h * 0.42, 0, 0, Math.PI * 2);
    c.fill();
    // Radial jagged fracture lines & shattered stone rubble shards
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 6);
      c.lineTo(cx + Math.cos(a + 0.12) * 44, cy + Math.sin(a + 0.12) * 24);
      c.lineTo(cx + Math.cos(a - 0.08) * 76, cy + Math.sin(a - 0.08) * 42);
      c.stroke();
    }
    // Chipped isometric stone rubble nuggets around rim
    for (const [ox, oy, rx, ry] of [
      [-42, -16, 10, 5],
      [48, -12, 12, 6],
      [-34, 22, 9, 5],
      [36, 20, 11, 5],
      [6, -28, 8, 4],
    ]) {
      c.fillStyle = '#383042';
      c.beginPath();
      c.ellipse(cx + ox, cy + oy, rx, ry, 0.2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.stroke();
    }
  });

  // NEW 3: vfx_slash_grain (256x64 painterly calligraphic speed-line brush stroke!)
  withCell(ctx, 'vfx_slash_grain', (c, w, h) => {
    const cy = h * 0.5;
    for (const [yOff, thick, alpha] of [
      [-14, 5, 0.55],
      [-5, 9, 0.85],
      [4, 14, 1.0],
      [14, 6, 0.65],
      [21, 3, 0.45],
    ]) {
      const g = c.createLinearGradient(8, cy + yOff, w - 8, cy + yOff);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.25, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.82, `rgba(255,255,255,${alpha})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(8, cy + yOff);
      c.quadraticCurveTo(w * 0.55, cy + yOff - thick, w - 6, cy + yOff);
      c.quadraticCurveTo(w * 0.55, cy + yOff + thick, 8, cy + yOff);
      c.closePath();
      c.fill();
    }
  });

  // NEW 4: vfx_light_cone (192x256 soft volumetric diagonal god-ray / brazier light cone!)
  withCell(ctx, 'vfx_light_cone', (c, w, h) => {
    const cx = w * 0.5;
    c.beginPath();
    c.moveTo(cx - 18, 8);
    c.lineTo(cx + 18, 8);
    c.lineTo(w - 10, h - 8);
    c.lineTo(10, h - 8);
    c.closePath();
    const g = c.createLinearGradient(cx, 8, cx, h - 8);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    g.addColorStop(0.45, 'rgba(255, 255, 255, 0.28)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = g;
    c.fill();
  });

  // NEW 5: vfx_hit_spark (128x128 directional comic impact starburst flare — fixes missing sprite ref!)
  withCell(ctx, 'vfx_hit_spark', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const spikes = 12;
    c.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? (i % 4 === 0 ? 58 : 38) : 14;
      const a = (i * Math.PI) / spikes;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = '#FFFFFF';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
  });

  // Existing Core VFX sprites (upgraded comic-ink flame tongue, spark burst, lightning, etc.)
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

  withCell(ctx, 'vfx_spark_burst', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const spikes = 10;
    c.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? (i % 4 === 0 ? 48 : 34) : 13;
      const a = (i * Math.PI) / spikes;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = '#FFFFFF';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
  });

  withCell(ctx, 'vfx_lightning_bolt', (c, w, h) => {
    const cy = h * 0.5;
    c.strokeStyle = INK;
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(8, cy);
    c.lineTo(38, cy - 20);
    c.lineTo(60, cy + 12);
    c.lineTo(96, cy - 18);
    c.lineTo(116, cy + 9);
    c.lineTo(w - 8, cy - 4);
    c.stroke();
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 4.5;
    c.stroke();
  });

  // Upgraded Multi-Tongued Stylized Ink-Cel Leaping Flame (NO lemon teardrop!)
  withCell(ctx, 'vfx_flame_tongue', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.88;
    // Outer fiery crimson-orange leaping multi-tongue silhouette
    c.beginPath();
    c.moveTo(cx, 6);
    c.bezierCurveTo(cx + 14, h * 0.34, cx + 28, h * 0.42, cx + 26, h * 0.54);
    c.quadraticCurveTo(cx + 18, h * 0.46, cx + 24, h * 0.72);
    c.quadraticCurveTo(cx + 22, baseY + 6, cx, baseY + 4);
    c.quadraticCurveTo(cx - 24, baseY + 6, cx - 24, h * 0.68);
    c.quadraticCurveTo(cx - 28, h * 0.44, cx - 18, h * 0.36);
    c.quadraticCurveTo(cx - 12, h * 0.46, cx - 12, h * 0.28);
    c.quadraticCurveTo(cx - 8, h * 0.16, cx, 6);
    c.closePath();
    const g = c.createLinearGradient(cx, 6, cx, baseY);
    g.addColorStop(0, '#FF4218');
    g.addColorStop(0.35, '#FF8C1E');
    g.addColorStop(0.78, '#FFE258');
    g.addColorStop(1, '#FFFCE0');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
    // Blazing white-gold inner core tongue
    c.fillStyle = '#FFFCE0';
    c.beginPath();
    c.moveTo(cx, h * 0.34);
    c.bezierCurveTo(cx + 13, h * 0.58, cx + 11, baseY - 2, cx, baseY);
    c.bezierCurveTo(cx - 11, baseY - 2, cx - 13, h * 0.58, cx, h * 0.34);
    c.closePath();
    c.fill();
  });

  withCell(ctx, 'vfx_wave_crest', (c, w, h) => {
    c.beginPath();
    c.moveTo(10, h - 12);
    c.bezierCurveTo(28, 12, w - 24, 6, w - 12, 34);
    c.bezierCurveTo(w - 22, 24, w - 38, 30, w - 30, 44);
    c.quadraticCurveTo(w * 0.5, h - 10, 10, h - 12);
    c.closePath();
    c.fillStyle = '#FFFFFF';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
  });

  withCell(ctx, 'vfx_decal_scorch', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, w * 0.46);
    g.addColorStop(0, 'rgba(9, 6, 14, 0.9)');
    g.addColorStop(0.55, 'rgba(34, 16, 18, 0.55)');
    g.addColorStop(1, 'rgba(9, 6, 14, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, cy, w * 0.46, h * 0.42, 0, 0, Math.PI * 2);
    c.fill();
  });

  withCell(ctx, 'vfx_decal_ichor', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.fillStyle = '#FFFFFF';
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

  withCell(ctx, 'vfx_ring_soft', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(cx, cy, cx - 10, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 18;
    c.stroke();
  });

  withCell(ctx, 'vfx_shadow_blob', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.save();
    c.translate(cx, cy);
    c.scale(1, h / w);
    const g = c.createRadialGradient(0, 0, 4, 0, 0, cx * 0.92);
    g.addColorStop(0, 'rgba(9, 6, 14, 0.78)');
    g.addColorStop(0.65, 'rgba(9, 6, 14, 0.38)');
    g.addColorStop(1, 'rgba(9, 6, 14, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, cx * 0.92, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });

  withCell(ctx, 'vfx_projectile_orb', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, 26);
    g.addColorStop(0, '#FFFFFF');
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

  withCell(ctx, 'vfx_projectile_arrow', (c, w, h) => {
    const cy = h * 0.5;
    c.strokeStyle = INK;
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(10, cy);
    c.lineTo(w - 14, cy);
    c.stroke();
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 3.6;
    c.stroke();
    c.fillStyle = '#FFFFFF';
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
    c.fillStyle = '#C4D0DE';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.5;
    c.stroke();
    c.fillStyle = '#E02238';
    c.beginPath();
    c.arc(cx, cy, 14, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  });

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
      c.fillStyle = i % 2 === 0 ? '#FF2418' : '#240B12';
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.stroke();
      c.restore();
    }
    c.fillStyle = '#FF6454';
    c.beginPath();
    c.arc(cx, cy, 12, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
  });

  withCell(ctx, 'vfx_skull_proj', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 4, cx, cy, 42);
    g.addColorStop(0, '#9CFF70');
    g.addColorStop(0.55, '#E82C38');
    g.addColorStop(1, 'rgba(200,20,30,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 42, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ECF5E0';
    c.beginPath();
    c.arc(cx, cy - 4, 22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();
    c.fillStyle = '#24FF62';
    c.fillRect(cx - 12, cy - 8, 7, 5);
    c.fillRect(cx + 5, cy - 8, 7, 5);
  });

  withCell(ctx, 'vfx_petal', (c, w, h) => {
    const cx = w * 0.5;
    c.beginPath();
    c.moveTo(cx, 6);
    c.bezierCurveTo(w - 6, 12, w - 10, h - 8, cx, h - 6);
    c.bezierCurveTo(10, h - 8, 6, 12, cx, 6);
    c.closePath();
    c.fillStyle = '#FFFFFF';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();
  });

  withCell(ctx, 'vfx_snowflake', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 3.6;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      c.beginPath();
      c.moveTo(cx - Math.cos(a) * 18, cy - Math.sin(a) * 18);
      c.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
      c.stroke();
    }
  });

  withCell(ctx, 'vfx_pylon', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.48;
    paintChiaroscuroShape(
      c,
      () => {
        c.beginPath();
        c.moveTo(cx, 12);
        c.lineTo(cx + 28, cy);
        c.lineTo(cx + 16, h - 18);
        c.lineTo(cx - 16, h - 18);
        c.lineTo(cx - 28, cy);
        c.closePath();
      },
      { x0: cx - 28, y0: 12, x1: cx + 28, y1: h - 18 },
      { lit: '#E2F8FF', mid: '#4EB4FF', dark: '#143464', rim: '#FFFFFF' },
      { shadowPoolFrac: 0.36, inkW: 4.0 }
    );
  });

  withCell(ctx, 'vfx_chaos_gate', (c, w, h) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const g = c.createRadialGradient(cx, cy, 6, cx, cy, 66);
    g.addColorStop(0, INK);
    g.addColorStop(0.45, '#6419FF');
    g.addColorStop(0.78, '#D49EFF');
    g.addColorStop(1, 'rgba(100,25,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, cy, 66, 42, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#F2C154';
    c.lineWidth = 3.5;
    c.beginPath();
    c.ellipse(cx, cy, 46, 26, 0, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#C48EFF';
    c.beginPath();
    c.ellipse(cx, cy, 20, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(cx, cy, 4, 10, 0, 0, Math.PI * 2);
    c.fill();
  });

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
    c.fillStyle = '#FF9824';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
    c.fillStyle = '#FFF9C4';
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
    c.fillStyle = '#FFE966';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.8;
    c.stroke();
  });

  withCell(ctx, 'vfx_shield_block', (c, w, h) => {
    const cx = w * 0.38;
    const cy = h * 0.5;
    c.strokeStyle = '#FFCF48';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(cx, cy, 46, -1.1, 1.1);
    c.stroke();
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 4;
    c.stroke();
  });
}

// ============================================================================
// Atlas Baking Entry Point (Called ONCE at Renderer Init)
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

  // 1. All 6 Biomes x 4 Weathered Ashlar Stone Variants (ZERO black diamond grid!)
  const biomeList: readonly BiomeStonePalette['key'][] = [
    'courtyard',
    'obsidian',
    'cinder',
    'verdant',
    'crypt',
    'summit',
  ];
  let tileSeed = 100;
  for (const key of biomeList) {
    const pal = BIOME_PALETTES[key];
    for (const v of ['a', 'b', 'c', 'd'] as const) {
      withCell(ctx, `tile_${key}_${v}`, (c, w, h) => drawIsometricStoneTile(c, w, h, pal, v, ++tileSeed));
    }
    // Central chamber mosaic medallion + 3D Northern Retaining Wall
    withCell(ctx, `prop_medallion_${key}`, (c, w, h) => drawChamberMedallion(c, w, h, pal));
    withCell(ctx, `prop_wall_${key}_n`, (c, w, h) => drawNorthRetainingWall(c, w, h, pal));
  }

  // Legacy tile IDs painted with the exact same weathered non-grid ashlar style
  withCell(ctx, 'tile_sanctum_a', (c, w, h) => drawIsometricStoneTile(c, w, h, BIOME_PALETTES.courtyard, 'a', 901));
  withCell(ctx, 'tile_sanctum_b', (c, w, h) => drawIsometricStoneTile(c, w, h, BIOME_PALETTES.courtyard, 'b', 902));
  withCell(ctx, 'tile_sanctum_mosaic', (c, w, h) => drawIsometricStoneTile(c, w, h, BIOME_PALETTES.courtyard, 'd', 903));
  withCell(ctx, 'tile_obsidian_cracked', (c, w, h) => drawIsometricStoneTile(c, w, h, BIOME_PALETTES.obsidian, 'c', 904));
  withCell(ctx, 'tile_obsidian_mosaic', (c, w, h) => drawIsometricStoneTile(c, w, h, BIOME_PALETTES.obsidian, 'd', 905));

  // 2. Biome-Matched 3D Southern Chasm Cliff Drops
  withCell(ctx, 'prop_chasm_rim', (c, w, h) => drawBiomeChasmCliff(c, w, h, BIOME_PALETTES.obsidian));
  withCell(ctx, 'prop_chasm_cinder', (c, w, h) => drawBiomeChasmCliff(c, w, h, BIOME_PALETTES.cinder));
  withCell(ctx, 'prop_chasm_verdant', (c, w, h) => drawBiomeChasmCliff(c, w, h, BIOME_PALETTES.verdant));
  withCell(ctx, 'prop_chasm_crypt', (c, w, h) => drawBiomeChasmCliff(c, w, h, BIOME_PALETTES.crypt));
  withCell(ctx, 'prop_chasm_summit', (c, w, h) => drawBiomeChasmCliff(c, w, h, BIOME_PALETTES.summit));
  withCell(ctx, 'trim_meander', drawMeanderTrim);

  // 3. Fluted Architectural Pillars, Obelisks, Statue, Doors, Cast-Bronze Brazier, Sconce, Urn & Traps
  withCell(ctx, 'prop_pillar_sanctum', (c, w, h) => drawFlutedPillar(c, w, h, BIOME_PALETTES.courtyard));
  withCell(ctx, 'prop_pillar_obsidian', (c, w, h) => drawFlutedPillar(c, w, h, BIOME_PALETTES.obsidian));
  withCell(ctx, 'prop_pillar_cinder', (c, w, h) => drawFlutedPillar(c, w, h, BIOME_PALETTES.cinder));
  withCell(ctx, 'prop_pillar_verdant', (c, w, h) => drawFlutedPillar(c, w, h, BIOME_PALETTES.verdant));
  withCell(ctx, 'prop_pillar_crypt', (c, w, h) => drawFlutedPillar(c, w, h, BIOME_PALETTES.crypt));
  withCell(ctx, 'prop_pillar_summit', (c, w, h) => drawFlutedPillar(c, w, h, BIOME_PALETTES.summit));
  withCell(ctx, 'prop_statue', (c, w, h) => drawObelisk(c, w, h, BIOME_PALETTES.obsidian));
  withCell(ctx, 'prop_obelisk', (c, w, h) => drawObelisk(c, w, h, BIOME_PALETTES.obsidian));
  withCell(ctx, 'prop_obelisk_verdant', (c, w, h) => drawObelisk(c, w, h, BIOME_PALETTES.verdant));
  withCell(ctx, 'prop_obelisk_summit', (c, w, h) => drawObelisk(c, w, h, BIOME_PALETTES.summit));
  withCell(ctx, 'prop_exit_door_locked', (c, w, h) => drawExitDoor(c, w, h, false));
  withCell(ctx, 'prop_exit_door_open', (c, w, h) => drawExitDoor(c, w, h, true));
  withCell(ctx, 'prop_brazier', drawSculptedBrazier);
  withCell(ctx, 'prop_wall_sconce', drawWallSconce);
  withCell(ctx, 'prop_urn', drawUrn);
  withCell(ctx, 'prop_spike_idle', (c, w, h) => drawSpikeTrap(c, w, h, 'idle'));
  withCell(ctx, 'prop_spike_armed', (c, w, h) => drawSpikeTrap(c, w, h, 'armed'));
  withCell(ctx, 'prop_spike_active', (c, w, h) => drawSpikeTrap(c, w, h, 'active'));

  // 4. Hero Poses, Weapons, All Enemies, All 8 Bosses, Pickups, Patron Sigils & VFX
  withCell(ctx, 'hero_down', (c, w, h) => drawHeroPose(c, w, h, 'down'));
  withCell(ctx, 'hero_up', (c, w, h) => drawHeroPose(c, w, h, 'up'));
  withCell(ctx, 'hero_side', (c, w, h) => drawHeroPose(c, w, h, 'side'));
  withCell(ctx, 'hero_diag_down', (c, w, h) => drawHeroPose(c, w, h, 'diag_down'));
  withCell(ctx, 'hero_diag_up', (c, w, h) => drawHeroPose(c, w, h, 'diag_up'));

  drawWeapons(ctx);
  drawAllRegularEnemies(ctx);
  drawAllBosses(ctx);
  drawPickupsAndSigils(ctx);
  drawAllVfxAndDecals(ctx);

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
 * Clones the built-in 4096x4096 atlas ONCE and overlays any matching custom-pack sprites
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
