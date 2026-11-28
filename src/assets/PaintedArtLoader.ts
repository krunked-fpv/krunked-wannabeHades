/**
 * PaintedArtLoader — Loads the shipped hand-painted comic-ink WebP art assets
 * from `public/art/` (100% original clean-room assets) and upgrades the runtime
 * Built-In GPU atlas, seamless biome floor/wall/cliff textures, portraits, sigils,
 * weapon icons, and Title key art cleanly with automatic procedural fallback!
 */

import type { BiomeId, PatronId, WeaponId } from '../contracts/index.js';
import type { BakedAtlas } from './ProceduralInkCelAtlas.js';

export interface BiomeSurfaceTextures {
  readonly floor: HTMLImageElement;
  readonly wall: HTMLImageElement;
  readonly cliff: HTMLImageElement;
}

export interface LoadedPaintedArtPack {
  readonly compositeAtlasCanvas: HTMLCanvasElement;
  readonly biomeSurfaces: Partial<Record<BiomeId, BiomeSurfaceTextures>>;
}

const ALL_BIOMES: readonly BiomeId[] = [
  'sanctum_hub',
  'obsidian_pit',
  'cinder_mire',
  'verdant_colosseum',
  'crypt_of_bile',
  'frozen_summit',
];

/**
 * Procedural VFX sprite IDs that MUST stay procedural on the baked atlas
 * (smooth radial glows, sparks, flames, slash grain, craters, rings, projectiles).
 * Every OTHER sprite ID in ATLAS_SPRITE_RECTS is replaced cleanly by `atlas_painted.webp`.
 */
const KEEP_PROCEDURAL_SPRITE_IDS = new Set<string>([
  'white_pixel',
  'trim_meander',
  'vfx_glow_soft',
  'vfx_glow_star',
  'vfx_spark_burst',
  'vfx_hit_spark',
  'vfx_spark_streak',
  'vfx_slash_grain',
  'vfx_light_cone',
  'vfx_decal_crater',
  'vfx_lightning_bolt',
  'vfx_flame_tongue',
  'vfx_wave_crest',
  'vfx_decal_scorch',
  'vfx_decal_ichor',
  'vfx_decal_crack',
  'vfx_ring_soft',
  'vfx_shadow_blob',
  'vfx_projectile_orb',
  'vfx_projectile_arrow',
  'vfx_sawblade',
  'vfx_blade_rift',
  'vfx_skull_proj',
  'vfx_petal',
  'vfx_snowflake',
  'vfx_muzzle_flash',
  'vfx_bow_flash',
  'vfx_shield_block',
]);

function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Resolves relative asset path safely under Vite `./` base (works locally and on GitHub Pages!). */
export function resolveArtUrl(relPath: string): string {
  const clean = relPath.replace(/^\/+/, '');
  return `./art/${clean}`;
}

export function getPaintedPortraitUrl(id: PatronId | 'prince_pyreus' | 'warden_malice'): string {
  return resolveArtUrl(`portraits/portrait_${id}.webp`);
}

export function getPaintedPatronSigilUrl(patronId: PatronId): string {
  return resolveArtUrl(`sigils/sigil_${patronId}.webp`);
}

export function getPaintedWeaponIconUrl(weaponId: WeaponId): string {
  return resolveArtUrl(`weapons/weapon_${weaponId}.webp`);
}

export function getPaintedTitleKeyArtUrl(): string {
  return resolveArtUrl('title_keyart.webp');
}

/**
 * Composites the hand-painted 4096x4096 `atlas_painted.webp` cleanly over the procedural
 * fallback atlas (clearing each replaced cell first so zero procedural lines peek through,
 * while preserving every smooth procedural VFX glow/spark/ribbon/decal cell).
 */
export function buildPaintedCompositeAtlas(
  baseAtlas: BakedAtlas,
  paintedAtlasImg: HTMLImageElement
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = baseAtlas.width;
  canvas.height = baseAtlas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return baseAtlas.canvas;
  }

  // Start with procedural VFX, decals, and fallback base
  ctx.drawImage(baseAtlas.canvas, 0, 0);

  // Replace every painted cell cleanly with hand-painted comic-ink art!
  for (const [id, rect] of baseAtlas.sprites.entries()) {
    if (KEEP_PROCEDURAL_SPRITE_IDS.has(id)) {
      continue;
    }
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    ctx.drawImage(
      paintedAtlasImg,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    );
  }

  return canvas;
}

let cachedLoadPromise: Promise<LoadedPaintedArtPack | null> | null = null;

/**
 * Loads the complete built-in hand-painted art pack (atlas + 6 biome floor/wall/cliff textures)
 * concurrently. Safe to call multiple times (memoized per session).
 */
export function loadBuiltInPaintedArtPack(
  baseAtlas: BakedAtlas
): Promise<LoadedPaintedArtPack | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  if (cachedLoadPromise) {
    return cachedLoadPromise;
  }

  cachedLoadPromise = (async () => {
    const atlasPromise = loadImage(resolveArtUrl('atlas_painted.webp'));
    const surfacePromises = ALL_BIOMES.map(async (biome) => {
      const [floor, wall, cliff] = await Promise.all([
        loadImage(resolveArtUrl(`floors/floor_${biome}.webp`)),
        loadImage(resolveArtUrl(`walls/wall_${biome}.webp`)),
        loadImage(resolveArtUrl(`cliffs/cliff_${biome}.webp`)),
      ]);
      return { biome, floor, wall, cliff };
    });

    const [paintedAtlasImg, surfaces] = await Promise.all([
      atlasPromise,
      Promise.all(surfacePromises),
    ]);

    if (!paintedAtlasImg) {
      return null;
    }

    const compositeAtlasCanvas = buildPaintedCompositeAtlas(baseAtlas, paintedAtlasImg);
    const biomeSurfaces: Partial<Record<BiomeId, BiomeSurfaceTextures>> = {};
    for (const s of surfaces) {
      if (s.floor && s.wall && s.cliff) {
        biomeSurfaces[s.biome] = { floor: s.floor, wall: s.wall, cliff: s.cliff };
      }
    }

    return {
      compositeAtlasCanvas,
      biomeSurfaces,
    };
  })();

  return cachedLoadPromise;
}
