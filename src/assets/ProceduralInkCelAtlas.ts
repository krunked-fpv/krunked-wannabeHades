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

/** Resolve sprite ID for any enemy archetype cleanly */
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
    case 'warden_malice':
    case 'warden_fury':
    case 'warden_murder':
      return 'boss_warden_malice';
    default:
      return isBoss ? 'boss_generic_titan' : 'enemy_generic_shade';
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
      return ['tile_cinder_a', 'tile_obsidian_cracked', 'tile_cinder_a', 'tile_cinder_a'];
    case 'verdant_colosseum':
      return ['tile_verdant_a', 'tile_verdant_a', 'tile_obsidian_mosaic', 'tile_verdant_a'];
    case 'crypt_of_bile':
      return ['tile_crypt_a', 'tile_obsidian_cracked', 'tile_crypt_a', 'tile_crypt_a'];
    case 'frozen_summit':
      return ['tile_summit_a', 'tile_summit_a', 'tile_obsidian_cracked', 'tile_summit_a'];
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
  const baseY = h * 0.87;

  // Pedestal
  ctx.fillStyle = '#253237';
  ctx.beginPath();
  ctx.moveTo(cx - 50, baseY);
  ctx.lineTo(cx - 38, baseY - 26);
  ctx.lineTo(cx + 38, baseY - 26);
  ctx.lineTo(cx + 50, baseY);
  ctx.lineTo(cx, baseY + 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Cloaked Underworld sentinel torso
  const bodyGrad = ctx.createLinearGradient(cx - 42, 40, cx + 42, baseY - 20);
  bodyGrad.addColorStop(0, '#5a7076');
  bodyGrad.addColorStop(0.5, '#2f4147');
  bodyGrad.addColorStop(1, '#141e22');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 34, baseY - 22);
  ctx.quadraticCurveTo(cx - 42, h * 0.46, cx - 24, h * 0.28);
  ctx.quadraticCurveTo(cx, h * 0.08, cx + 24, h * 0.28);
  ctx.quadraticCurveTo(cx + 42, h * 0.48, cx + 34, baseY - 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();

  // Hooded void face + glowing emerald eyes
  ctx.fillStyle = '#09080f';
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.28, 14, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5effb6';
  ctx.beginPath();
  ctx.ellipse(cx - 5, h * 0.27, 3.2, 2, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + 5, h * 0.27, 3.2, 2, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Draped gold chain
  ctx.strokeStyle = '#dfb051';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx - 24, h * 0.4);
  ctx.quadraticCurveTo(cx, h * 0.56, cx + 24, h * 0.4);
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
  const footY = h * 0.85;
  const isUp = pose === 'up' || pose === 'diag_up';
  const isSide = pose === 'side';

  // Blazing Ember Feet (athletic combat stance with rising flame tongues!)
  const drawEmberFoot = (fx: number, fy: number) => {
    const fGrad = ctx.createRadialGradient(fx, fy, 2, fx, fy - 4, 20);
    fGrad.addColorStop(0, '#fff9b8');
    fGrad.addColorStop(0.45, '#ff6218');
    fGrad.addColorStop(1, 'rgba(210, 22, 16, 0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stylized rising ink-cel flame lick on ankle
    ctx.fillStyle = '#ff7b24';
    ctx.beginPath();
    ctx.moveTo(fx - 8, fy - 2);
    ctx.quadraticCurveTo(fx - 13, fy - 14, fx - 2, fy - 20);
    ctx.quadraticCurveTo(fx + 5, fy - 12, fx + 8, fy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  };

  const lFootX = cx - (isSide ? 14 : 18);
  const rFootX = cx + (isSide ? 18 : 18);
  drawEmberFoot(lFootX, footY - 1);
  drawEmberFoot(rFootX, footY + 3);

  // Athletic tapered legs in wide heroic warrior lunge + gilded shin greaves
  ctx.fillStyle = '#c4835e';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  // Back leg
  ctx.beginPath();
  ctx.moveTo(cx - 14, footY - 46);
  ctx.lineTo(lFootX - 6, footY - 2);
  ctx.lineTo(lFootX + 8, footY - 2);
  ctx.lineTo(cx - 2, footY - 44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Front leg
  ctx.beginPath();
  ctx.moveTo(cx + 2, footY - 46);
  ctx.lineTo(rFootX - 7, footY + 1);
  ctx.lineTo(rFootX + 8, footY + 1);
  ctx.lineTo(cx + 16, footY - 44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Flowing Asymmetric Crimson Cloak sweeping dramatically behind stride
  ctx.beginPath();
  ctx.moveTo(cx - 24, footY - 88);
  ctx.bezierCurveTo(cx - 48, footY - 56, cx - 50, footY - 22, cx - 36, footY - 6);
  ctx.lineTo(cx - 10, footY - 18);
  ctx.lineTo(cx + 22, footY - 14);
  ctx.quadraticCurveTo(cx + 36, footY - 54, cx + 24, footY - 88);
  ctx.closePath();
  const cloakGrad = ctx.createLinearGradient(cx - 46, footY - 88, cx + 32, footY - 8);
  cloakGrad.addColorStop(0, '#e62434');
  cloakGrad.addColorStop(0.52, '#961020');
  cloakGrad.addColorStop(1, '#3b0612');
  ctx.fillStyle = cloakGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();

  // Tapered Obsidian Warrior Chiton Tunic (V-shaped heroic torso!)
  ctx.beginPath();
  ctx.moveTo(cx - 22, footY - 88);
  ctx.lineTo(cx + 22, footY - 88);
  ctx.lineTo(cx + 17, footY - 54);
  ctx.lineTo(cx + 25, footY - 30);
  ctx.lineTo(cx - 25, footY - 30);
  ctx.lineTo(cx - 17, footY - 54);
  ctx.closePath();
  const tunicGrad = ctx.createLinearGradient(cx - 22, footY - 88, cx + 22, footY - 30);
  tunicGrad.addColorStop(0, '#362e42');
  tunicGrad.addColorStop(0.55, '#191522');
  tunicGrad.addColorStop(1, '#0b0812');
  ctx.fillStyle = tunicGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Gold skirt border & diagonal crimson himation drape across chest
  ctx.fillStyle = '#ebb446';
  ctx.fillRect(cx - 23, footY - 37, 46, 5.5);
  ctx.beginPath();
  ctx.moveTo(cx - 24, footY - 88);
  ctx.lineTo(cx + 2, footY - 84);
  ctx.lineTo(cx + 22, footY - 52);
  ctx.lineTo(cx - 18, footY - 56);
  ctx.closePath();
  ctx.fillStyle = isUp ? '#850e1c' : '#db2232';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();

  // Sculpted Burnished-Gold Horned-Skull Shoulder Pauldron (left shoulder!)
  const px = isSide ? cx - 6 : cx - 23;
  const py = footY - 86;
  ctx.beginPath();
  ctx.moveTo(px - 17, py + 8);
  ctx.bezierCurveTo(px - 20, py - 14, px + 6, py - 18, px + 18, py - 4);
  ctx.bezierCurveTo(px + 16, py + 12, px - 4, py + 14, px - 17, py + 8);
  ctx.closePath();
  const paulGrad = ctx.createLinearGradient(px - 16, py - 14, px + 16, py + 12);
  paulGrad.addColorStop(0, '#fff2b0');
  paulGrad.addColorStop(0.45, '#e8ac3c');
  paulGrad.addColorStop(1, '#663a0e');
  ctx.fillStyle = paulGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();

  // Sculpted Angular Heroic Head (3/4 jawline, not a flat pill!)
  const headY = footY - 108;
  ctx.beginPath();
  ctx.moveTo(cx - 14, headY - 12);
  ctx.quadraticCurveTo(cx, headY - 22, cx + 15, headY - 10);
  ctx.lineTo(cx + 13, headY + 8);
  ctx.quadraticCurveTo(cx + 2, headY + 19, cx - 2, headY + 18);
  ctx.lineTo(cx - 14, headY + 7);
  ctx.closePath();
  ctx.fillStyle = isUp ? '#1a1524' : '#e0a580';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();

  if (!isUp) {
    // Fierce narrow comic eyes (glowing crimson + emerald heterochromia!)
    const exOff = isSide ? 4 : 0;
    ctx.fillStyle = INK;
    ctx.fillRect(cx - 10 + exOff, headY - 4, 8, 4.5);
    ctx.fillRect(cx + 2 + exOff, headY - 4, 8, 4.5);
    ctx.fillStyle = '#ff3838';
    ctx.fillRect(cx - 8 + exOff, headY - 3, 3.6, 2.5);
    ctx.fillStyle = '#48ffa2';
    ctx.fillRect(cx + 4 + exOff, headY - 3, 3.6, 2.5);
  }

  // Wild Swept Charcoal Hair with Blazing Crimson-Gold Tips
  ctx.beginPath();
  ctx.moveTo(cx - 18, headY - 2);
  ctx.lineTo(cx - 28, headY - 16);
  ctx.lineTo(cx - 14, headY - 17);
  ctx.lineTo(cx - 20, headY - 34);
  ctx.lineTo(cx - 4, headY - 22);
  ctx.lineTo(cx + 5, headY - 38);
  ctx.lineTo(cx + 12, headY - 22);
  ctx.lineTo(cx + 28, headY - 26);
  ctx.lineTo(cx + 18, headY - 6);
  ctx.quadraticCurveTo(cx, headY - 14, cx - 18, headY - 2);
  ctx.closePath();
  const hairGrad = ctx.createLinearGradient(cx, headY - 38, cx, headY);
  hairGrad.addColorStop(0, '#ff592b');
  hairGrad.addColorStop(0.32, '#291c2e');
  hairGrad.addColorStop(1, '#0d0914');
  ctx.fillStyle = hairGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();

  // Glowing Golden Laurel Crown
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.arc(cx, headY - 11, 17, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
}

function drawWeapons(ctx: CanvasRenderingContext2D): void {
  // Stygian Blade (broad glowing mythic short-sword)
  withCell(ctx, 'weapon_stygian_blade', (c, w, h) => {
    const cy = h * 0.5;
    // Broad double-edged blade
    c.beginPath();
    c.moveTo(34, cy - 11);
    c.lineTo(w - 28, cy - 14);
    c.lineTo(w - 6, cy);
    c.lineTo(w - 28, cy + 14);
    c.lineTo(34, cy + 11);
    c.closePath();
    const bGrad = c.createLinearGradient(34, cy - 14, w - 6, cy + 14);
    bGrad.addColorStop(0, '#ffe8b6');
    bGrad.addColorStop(0.45, '#d6dde8');
    bGrad.addColorStop(0.75, '#596378');
    bGrad.addColorStop(1, '#222634');
    c.fillStyle = bGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();

    // Glowing crimson-gold fuller rune line
    c.strokeStyle = '#ff4b3a';
    c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(42, cy);
    c.lineTo(w - 26, cy);
    c.stroke();

    // Gold crossguard & hilt
    c.fillStyle = '#e8b246';
    c.beginPath();
    c.moveTo(32, cy - 22);
    c.lineTo(42, cy - 16);
    c.lineTo(42, cy + 16);
    c.lineTo(32, cy + 22);
    c.lineTo(26, cy);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.4;
    c.stroke();

    c.fillStyle = '#7e1a24';
    c.fillRect(10, cy - 5, 20, 10);
    c.strokeRect(10, cy - 5, 20, 10);
    c.beginPath();
    c.arc(9, cy, 7, 0, Math.PI * 2);
    c.fillStyle = '#f2c15d';
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

  // 3. Bone Archer: Cloaked crystalline shade with glowing bow
  withCell(ctx, 'enemy_bone_archer', (c, w, h) => {
    const cx = w * 0.45;
    const baseY = h * 0.85;

    // Tattered floating teal-violet robes
    c.beginPath();
    c.moveTo(cx - 28, baseY);
    c.quadraticCurveTo(cx - 38, baseY - 64, cx - 22, baseY - 112);
    c.quadraticCurveTo(cx, baseY - 148, cx + 24, baseY - 112);
    c.quadraticCurveTo(cx + 34, baseY - 64, cx + 26, baseY - 4);
    c.lineTo(cx + 8, baseY - 22);
    c.lineTo(cx - 8, baseY + 2);
    c.closePath();
    const aGrad = c.createLinearGradient(cx - 32, baseY - 140, cx + 32, baseY);
    aGrad.addColorStop(0, '#5a94b8');
    aGrad.addColorStop(0.5, '#2b3e5e');
    aGrad.addColorStop(1, '#121526');
    c.fillStyle = aGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.2;
    c.stroke();

    // Glowing skeletal skull mask inside hood
    c.fillStyle = '#e2eef7';
    c.beginPath();
    c.ellipse(cx, baseY - 114, 15, 18, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#40fff4';
    c.beginPath();
    c.arc(cx - 5, baseY - 115, 3.6, 0, Math.PI * 2);
    c.arc(cx + 5, baseY - 115, 3.6, 0, Math.PI * 2);
    c.fill();

    // Crystalline cyan bow held forward
    c.strokeStyle = '#6cf8ff';
    c.lineWidth = 6.5;
    c.beginPath();
    c.moveTo(cx + 22, baseY - 122);
    c.quadraticCurveTo(cx + 58, baseY - 82, cx + 22, baseY - 42);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();

    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx + 22, baseY - 120);
    c.lineTo(cx + 12, baseY - 82);
    c.lineTo(cx + 22, baseY - 44);
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

  // 6. Rattlebones Training Dummy: Charming skeletal mannequin w/ emerald eyes & wooden plaque!
  withCell(ctx, 'enemy_rattlebones_dummy', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.88;

    // Wooden training post & cross-brace base
    c.fillStyle = '#6e4527';
    c.fillRect(cx - 8, baseY - 122, 16, 118);
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.strokeRect(cx - 8, baseY - 122, 16, 118);

    c.fillStyle = '#57351d';
    c.beginPath();
    c.ellipse(cx, baseY, 34, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    // Skeletal arms & jaunty wooden practice buckler
    c.strokeStyle = '#efe2c6';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(cx - 38, baseY - 94);
    c.lineTo(cx + 38, baseY - 94);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();

    // Ribcage + nailed painted target bullseye plaque on chest
    c.fillStyle = '#c88c4b';
    c.beginPath();
    c.arc(cx, baseY - 76, 26, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = '#cf2a34';
    c.beginPath();
    c.arc(cx, baseY - 76, 17, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f8ecd4';
    c.beginPath();
    c.arc(cx, baseY - 76, 9, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#cf2a34';
    c.beginPath();
    c.arc(cx, baseY - 76, 4, 0, Math.PI * 2);
    c.fill();

    // Grinning inked skull
    c.fillStyle = '#f4ead2';
    c.beginPath();
    c.ellipse(cx, baseY - 128, 22, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();

    // Glowing emerald eye sockets
    c.fillStyle = '#09070f';
    c.beginPath();
    c.arc(cx - 8, baseY - 130, 6.5, 0, Math.PI * 2);
    c.arc(cx + 8, baseY - 130, 6.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#54ff9f';
    c.beginPath();
    c.arc(cx - 8, baseY - 130, 3.2, 0, Math.PI * 2);
    c.arc(cx + 8, baseY - 130, 3.2, 0, Math.PI * 2);
    c.fill();

    // Jaunty dented bronze warrior helm
    c.fillStyle = '#d49e46';
    c.beginPath();
    c.arc(cx, baseY - 138, 23, Math.PI, 0);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();
    // Red plume
    c.fillStyle = '#d92938';
    c.beginPath();
    c.moveTo(cx, baseY - 160);
    c.quadraticCurveTo(cx + 26, baseY - 178, cx + 22, baseY - 146);
    c.quadraticCurveTo(cx + 8, baseY - 154, cx, baseY - 160);
    c.fill();
    c.stroke();
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

  // 8. WARDEN MALICE (BOSS): Commanding dark-ink winged violet-and-crimson Fury boss!
  withCell(ctx, 'boss_warden_malice', (c, w, h) => {
    const cx = w * 0.5;
    const baseY = h * 0.85;

    // Subtle dark crimson-violet Fury aura behind silhouette
    const halo = c.createRadialGradient(cx, baseY - 156, 10, cx, baseY - 156, 86);
    halo.addColorStop(0, 'rgba(220, 42, 168, 0.55)');
    halo.addColorStop(0.55, 'rgba(110, 18, 92, 0.22)');
    halo.addColorStop(1, 'rgba(20, 6, 26, 0)');
    c.fillStyle = halo;
    c.beginPath();
    c.arc(cx, baseY - 156, 86, 0, Math.PI * 2);
    c.fill();

    // Sweeping dramatic jagged bat-feathered obsidian wings (left & right)
    const drawWing = (dir: -1 | 1) => {
      c.beginPath();
      c.moveTo(cx + dir * 16, baseY - 144);
      c.bezierCurveTo(cx + dir * 72, baseY - 240, cx + dir * 124, baseY - 226, cx + dir * 144, baseY - 196);
      c.quadraticCurveTo(cx + dir * 120, baseY - 146, cx + dir * 130, baseY - 104);
      c.quadraticCurveTo(cx + dir * 96, baseY - 124, cx + dir * 92, baseY - 76);
      c.quadraticCurveTo(cx + dir * 60, baseY - 102, cx + dir * 50, baseY - 56);
      c.lineTo(cx + dir * 16, baseY - 98);
      c.closePath();
      const wGrad = c.createLinearGradient(cx, baseY - 228, cx + dir * 140, baseY - 70);
      wGrad.addColorStop(0, '#441559');
      wGrad.addColorStop(0.45, '#1d0a2b');
      wGrad.addColorStop(1, '#090410');
      c.fillStyle = wGrad;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 5;
      c.stroke();

      // Wing bone spurs & crimson inner edge highlight
      c.strokeStyle = '#ff3898';
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(cx + dir * 22, baseY - 144);
      c.bezierCurveTo(cx + dir * 74, baseY - 232, cx + dir * 122, baseY - 218, cx + dir * 140, baseY - 194);
      c.stroke();
    };
    drawWing(-1);
    drawWing(1);

    // Coiled barbed ink whip arcing menacingly around right flank
    c.strokeStyle = INK;
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(cx + 30, baseY - 108);
    c.bezierCurveTo(cx + 122, baseY - 96, cx + 114, baseY - 12, cx + 48, baseY - 16);
    c.stroke();
    c.strokeStyle = '#ff2864';
    c.lineWidth = 3.5;
    c.stroke();

    // Tattered flowing dark obsidian-crimson battle-skirt with boots visible below!
    c.beginPath();
    c.moveTo(cx - 24, baseY - 138);
    c.lineTo(cx + 24, baseY - 138);
    c.lineTo(cx + 16, baseY - 92);
    c.quadraticCurveTo(cx + 42, baseY - 46, cx + 48, baseY + 2);
    c.lineTo(cx + 22, baseY - 20);
    c.lineTo(cx + 6, baseY + 6);
    c.lineTo(cx - 8, baseY - 18);
    c.lineTo(cx - 24, baseY + 4);
    c.lineTo(cx - 46, baseY - 4);
    c.quadraticCurveTo(cx - 38, baseY - 52, cx - 16, baseY - 92);
    c.closePath();
    const dressGrad = c.createLinearGradient(cx - 38, baseY - 138, cx + 38, baseY + 4);
    dressGrad.addColorStop(0, '#8f133b');
    dressGrad.addColorStop(0.5, '#3b0924');
    dressGrad.addColorStop(1, '#120514');
    c.fillStyle = dressGrad;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4.6;
    c.stroke();

    // Sleek spiked obsidian corset armor + burnished gold V-trim
    c.fillStyle = '#1b0d24';
    c.beginPath();
    c.moveTo(cx - 24, baseY - 144);
    c.lineTo(cx + 24, baseY - 144);
    c.lineTo(cx + 15, baseY - 88);
    c.lineTo(cx - 15, baseY - 88);
    c.closePath();
    c.fill();
    c.strokeStyle = '#e8ac3c';
    c.lineWidth = 2.8;
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.stroke();

    // Sharp angular spiked shoulder blades (NOT round balls!)
    for (const dir of [-1, 1] as const) {
      c.fillStyle = '#2d123b';
      c.beginPath();
      c.moveTo(cx + dir * 14, baseY - 142);
      c.lineTo(cx + dir * 48, baseY - 154);
      c.lineTo(cx + dir * 36, baseY - 126);
      c.lineTo(cx + dir * 18, baseY - 128);
      c.closePath();
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 3.8;
      c.stroke();
    }

    // Fierce alabaster angular visage & wild flowing dark-violet hair
    const hy = baseY - 170;
    c.fillStyle = '#dcd0e8';
    c.beginPath();
    c.moveTo(cx - 15, hy - 14);
    c.quadraticCurveTo(cx, hy - 22, cx + 15, hy - 14);
    c.lineTo(cx + 13, hy + 10);
    c.lineTo(cx, hy + 20);
    c.lineTo(cx - 13, hy + 10);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.stroke();

    c.fillStyle = '#150821';
    c.beginPath();
    c.moveTo(cx - 22, hy + 18);
    c.quadraticCurveTo(cx - 28, hy - 26, cx, hy - 30);
    c.quadraticCurveTo(cx + 28, hy - 26, cx + 24, hy + 22);
    c.lineTo(cx + 14, hy - 8);
    c.lineTo(cx - 14, hy - 8);
    c.closePath();
    c.fill();
    c.stroke();

    // Curved dark-gold twin-horned Fury crown
    c.fillStyle = '#ebae38';
    c.beginPath();
    c.moveTo(cx - 18, hy - 16);
    c.quadraticCurveTo(cx - 32, hy - 36, cx - 26, hy - 54);
    c.quadraticCurveTo(cx - 14, hy - 34, cx - 6, hy - 22);
    c.lineTo(cx, hy - 36);
    c.lineTo(cx + 6, hy - 22);
    c.quadraticCurveTo(cx + 14, hy - 34, cx + 26, hy - 54);
    c.quadraticCurveTo(cx + 32, hy - 36, cx + 18, hy - 16);
    c.closePath();
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3.6;
    c.stroke();

    // Fierce blazing crimson slit eyes
    c.fillStyle = '#ff1f5a';
    c.beginPath();
    c.moveTo(cx - 11, hy - 3);
    c.lineTo(cx - 3, hy);
    c.lineTo(cx - 10, hy + 2);
    c.closePath();
    c.moveTo(cx + 11, hy - 3);
    c.lineTo(cx + 3, hy);
    c.lineTo(cx + 10, hy + 2);
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

  // Additional Biome Tiles
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

  // Weapons, Enemies, Bosses, Pickups, Sigils, VFX
  drawWeapons(ctx);
  drawEnemiesAndBosses(ctx);
  drawPickupsAndSigils(ctx);
  drawVfxSprites(ctx);

  cachedAtlas = {
    canvas,
    width: ATLAS_SIZE,
    height: ATLAS_SIZE,
    sprites: ATLAS_SPRITE_RECTS,
  };
  return cachedAtlas;
}

export { INK_WARM };
