/**
 * Canvas2DInkCelRenderer — High-Craft Painterly Ink-Cel Canvas2D Fallback Renderer.
 *
 * Maintains full visual parity with WebGL2InkCelRenderer:
 *  - All-biome atmospheric abyssal backdrops (all 6 biomes including Verdant colonnade & Crypt vaults)
 *  - Deterministic 4-variant weathered flagstones + central chamber mosaic medallion
 *  - Architectural 3D Northern Retaining Wall, sconces, stepped E/W parapets, corner obelisks,
 *    and biome-matched Southern 3D Chasm Cliff drops
 *  - Two-layer ground shadow pass (tight #09060E contact AO + directional SE [+0.68, +0.44] cast shadows)
 *  - Organic multi-lobe Bezier hazard polygons (magma crust cracks, bubbling bile, sacred runes, curing caustics)
 *  - Biome/boss-themed crisp danger rune telegraphs & 4-layer searing boss beams
 *  - 3-layer sweeping comic weapon slash smears, directional hit-spark streaks, craters/ichor decals,
 *    volumetric light cones, flickering brazier/sconce glow pools, shockwave/chromatic post-FX fallback,
 *    and hot-swappable baked combat font atlas support!
 */

import type {
  ArenaDoor,
  ArenaObstacle,
  BiomeId,
  EnemyState,
  ProjectileState,
  RenderSettings,
  SimState,
  TelegraphShape,
} from '../contracts/index.js';
import { PATRON_CONSTANTS } from '../contracts/index.js';
import type { BakedAtlas } from '../assets/ProceduralInkCelAtlas.js';
import {
  ATLAS_SPRITE_RECTS,
  getBiomePillarSpriteId,
  getEnemySpriteId,
  getPatronSigilSpriteId,
  getPickupSpriteId,
  getWeaponSpriteId,
} from '../assets/ProceduralInkCelAtlas.js';
import type { BakedFontAtlas } from '../assets/ProceduralFonts.js';
import { drawFloatingNumber2D } from '../assets/ProceduralFonts.js';
import type { ParticlesAndDecals, SlashRibbon } from './ParticlesAndDecals.js';
import { MAX_DECALS, MAX_PARTICLES, MAX_SLASH_RIBBONS } from './ParticlesAndDecals.js';
import type { CameraView, RenderBackend } from './GameRenderer.js';

type SortKind =
  | 'obstacle'
  | 'brazier'
  | 'obelisk'
  | 'door'
  | 'pickup'
  | 'bloodstone'
  | 'enemy'
  | 'hero'
  | 'projectile';

interface SortEntry {
  kind: SortKind;
  sortY: number;
  idx: number;
  x: number;
  y: number;
}

interface BiomeTheme2D {
  deepHex: string;
  midHex: string;
  accentHex: string;
  floorHex: string;
  wallDarkHex: string;
  wallLitHex: string;
  wallTrimHex: string;
  brazierRgba: string;
  brazierFadeRgba: string;
  telegraphPrimary: string;
  telegraphAccent: string;
}

const BIOME_THEMES_2D: Record<BiomeId, BiomeTheme2D> = {
  sanctum_hub: {
    deepHex: '#0B0612',
    midHex: '#241130',
    accentHex: '#E6B84C',
    floorHex: '#1E1329',
    wallDarkHex: '#241731',
    wallLitHex: '#4A3361',
    wallTrimHex: '#D6A647',
    brazierRgba: 'rgba(255, 140, 54, 0.42)',
    brazierFadeRgba: 'rgba(255, 78, 24, 0)',
    telegraphPrimary: '#FF3854',
    telegraphAccent: '#F0BC4C',
  },
  obsidian_pit: {
    deepHex: '#060E12',
    midHex: '#102830',
    accentHex: '#28F0B4',
    floorHex: '#15242B',
    wallDarkHex: '#18272E',
    wallLitHex: '#324E59',
    wallTrimHex: '#2CE6A8',
    brazierRgba: 'rgba(255, 120, 44, 0.42)',
    brazierFadeRgba: 'rgba(255, 68, 20, 0)',
    telegraphPrimary: '#FF2A4A',
    telegraphAccent: '#B838FF',
  },
  cinder_mire: {
    deepHex: '#1A0706',
    midHex: '#40120C',
    accentHex: '#FF5A14',
    floorHex: '#231312',
    wallDarkHex: '#241212',
    wallLitHex: '#4A241E',
    wallTrimHex: '#E8822E',
    brazierRgba: 'rgba(255, 108, 30, 0.44)',
    brazierFadeRgba: 'rgba(255, 58, 12, 0)',
    telegraphPrimary: '#FF5414',
    telegraphAccent: '#FFD248',
  },
  verdant_colosseum: {
    deepHex: '#0F2D38',
    midHex: '#1F5663',
    accentHex: '#FFE285',
    floorHex: '#1A4049',
    wallDarkHex: '#24535E',
    wallLitHex: '#58A4A8',
    wallTrimHex: '#F2C95E',
    brazierRgba: 'rgba(255, 224, 122, 0.38)',
    brazierFadeRgba: 'rgba(255, 180, 64, 0)',
    telegraphPrimary: '#F2B830',
    telegraphAccent: '#FF2E4C',
  },
  crypt_of_bile: {
    deepHex: '#0C1207',
    midHex: '#222F10',
    accentHex: '#9CF024',
    floorHex: '#262A18',
    wallDarkHex: '#292E1A',
    wallLitHex: '#4F5630',
    wallTrimHex: '#C49B3E',
    brazierRgba: 'rgba(245, 194, 72, 0.40)',
    brazierFadeRgba: 'rgba(180, 130, 28, 0)',
    telegraphPrimary: '#A6F022',
    telegraphAccent: '#FF3850',
  },
  frozen_summit: {
    deepHex: '#0B1324',
    midHex: '#1F3654',
    accentHex: '#6CE6FF',
    floorHex: '#233347',
    wallDarkHex: '#1F3047',
    wallLitHex: '#4B6E94',
    wallTrimHex: '#D6F0FF',
    brazierRgba: 'rgba(255, 146, 72, 0.42)',
    brazierFadeRgba: 'rgba(255, 92, 36, 0)',
    telegraphPrimary: '#FF2442',
    telegraphAccent: '#9A1432',
  },
};

const MAX_SORT = 540;
const SHADOW_DIR_X = 0.68;
const SHADOW_DIR_Y = 0.44;
const INK_HEX = '#09060E';

export class Canvas2DInkCelRenderer implements RenderBackend {
  public readonly kind = 'canvas2d' as const;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly atlas: BakedAtlas;
  private atlasCanvas: HTMLCanvasElement;
  private fontCanvas: HTMLCanvasElement | null = null;

  private viewW = 1;
  private viewH = 1;
  private dpr = 1;
  private drawCalls = 0;

  private readonly sortPool: SortEntry[];
  private sortCount = 0;
  private readonly braziers: { x: number; y: number }[] = [];
  private readonly wallSconces: { x: number; y: number }[] = [];
  private readonly cornerObelisks: { x: number; y: number; north: boolean }[] = [];
  private lastArchKey = '';

  // Pre-allocated scratch buffers for organic multi-lobe Bezier hazard polygons (zero GC!)
  private readonly polyX = new Float32Array(12);
  private readonly polyY = new Float32Array(12);

  constructor(canvas: HTMLCanvasElement, atlas: BakedAtlas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.atlas = atlas;
    this.atlasCanvas = atlas.canvas;
    this.sortPool = new Array<SortEntry>(MAX_SORT);
    for (let i = 0; i < MAX_SORT; i++) {
      this.sortPool[i] = { kind: 'hero', sortY: 0, idx: 0, x: 0, y: 0 };
    }
  }

  public setAtlasCanvas(canvas: HTMLCanvasElement): void {
    this.atlasCanvas = canvas;
  }

  public setFontAtlas(fontAtlas: BakedFontAtlas): void {
    this.fontCanvas = fontAtlas.canvas;
  }

  public getFontCanvas(): HTMLCanvasElement | null {
    return this.fontCanvas;
  }

  public resize(width: number, height: number, dpr: number): void {
    this.viewW = Math.max(1, Math.floor(width));
    this.viewH = Math.max(1, Math.floor(height));
    this.dpr = Math.max(1, Math.min(2, dpr));
    this.canvas.width = Math.max(1, Math.floor(this.viewW * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.viewH * this.dpr));
  }

  private hasSprite(id: string): boolean {
    return ATLAS_SPRITE_RECTS.has(id) && this.atlas.sprites.has(id);
  }

  private resolveSprite(preferredId: string, fallbackId: string): string {
    return this.hasSprite(preferredId) ? preferredId : fallbackId;
  }

  private spriteScaleForHeight(id: string, targetH: number): number {
    const rect = this.atlas.sprites.get(id);
    if (!rect || rect.h <= 0) return 1;
    return targetH / rect.h;
  }

  private spriteScaleForMaxDim(id: string, targetSize: number): number {
    const rect = this.atlas.sprites.get(id);
    if (!rect) return 1;
    return targetSize / Math.max(1, Math.max(rect.w, rect.h));
  }

  private getBiomeShortName(biome: BiomeId): string {
    switch (biome) {
      case 'sanctum_hub':
        return 'courtyard';
      case 'obsidian_pit':
        return 'obsidian';
      case 'cinder_mire':
        return 'cinder';
      case 'verdant_colosseum':
        return 'verdant';
      case 'crypt_of_bile':
        return 'crypt';
      case 'frozen_summit':
        return 'summit';
    }
  }

  private resolveFloorVariantId(biome: BiomeId, variantIdx: number): string {
    switch (biome) {
      case 'sanctum_hub':
        if (variantIdx === 0) return 'tile_sanctum_a';
        if (variantIdx === 1) return 'tile_sanctum_b';
        if (variantIdx === 2) return this.resolveSprite('tile_courtyard_c', 'tile_sanctum_a');
        return this.resolveSprite('tile_courtyard_d', 'tile_sanctum_mosaic');
      case 'obsidian_pit':
        if (variantIdx === 0) return 'tile_obsidian_a';
        if (variantIdx === 1) return 'tile_obsidian_b';
        if (variantIdx === 2) return this.resolveSprite('tile_obsidian_c', 'tile_obsidian_cracked');
        return this.resolveSprite('tile_obsidian_d', 'tile_obsidian_mosaic');
      case 'cinder_mire':
        if (variantIdx === 0) return 'tile_cinder_a';
        if (variantIdx === 1) return 'tile_cinder_b';
        if (variantIdx === 2) return this.resolveSprite('tile_cinder_c', 'tile_cinder_a');
        return this.resolveSprite('tile_cinder_d', 'tile_cinder_b');
      case 'verdant_colosseum':
        if (variantIdx === 0) return 'tile_verdant_a';
        if (variantIdx === 1) return 'tile_verdant_b';
        if (variantIdx === 2) return this.resolveSprite('tile_verdant_c', 'tile_verdant_a');
        return this.resolveSprite('tile_verdant_d', 'tile_verdant_b');
      case 'crypt_of_bile':
        if (variantIdx === 0) return 'tile_crypt_a';
        if (variantIdx === 1) return 'tile_crypt_b';
        if (variantIdx === 2) return this.resolveSprite('tile_crypt_c', 'tile_crypt_a');
        return this.resolveSprite('tile_crypt_d', 'tile_crypt_b');
      case 'frozen_summit':
        if (variantIdx === 0) return 'tile_summit_a';
        if (variantIdx === 1) return 'tile_summit_b';
        if (variantIdx === 2) return this.resolveSprite('tile_summit_c', 'tile_summit_a');
        return this.resolveSprite('tile_summit_d', 'tile_summit_b');
    }
  }

  private wxToSx(wx: number, cam: CameraView): number {
    return cam.viewW * 0.5 + (wx - cam.camX + cam.shakeX) * cam.zoom;
  }

  private wyToSy(wy: number, wz: number, cam: CameraView): number {
    return cam.viewH * 0.5 + (wy - cam.camY + cam.shakeY) * cam.isoScaleY * cam.zoom - wz * cam.zoom;
  }

  private drawSprite(
    ctx: CanvasRenderingContext2D,
    id: string,
    sx: number,
    sy: number,
    scaleX: number,
    scaleY: number,
    rot = 0,
    alpha = 1
  ): void {
    const rect = this.atlas.sprites.get(id);
    if (!rect) return;
    ctx.save();
    if (alpha < 0.999) ctx.globalAlpha *= alpha;
    ctx.translate(sx, sy);
    if (rot !== 0) ctx.rotate(rot);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(
      this.atlasCanvas,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      -rect.w * rect.anchorX,
      -rect.h * rect.anchorY,
      rect.w,
      rect.h
    );
    ctx.restore();
    this.drawCalls++;
  }

  private ensureArchitecture(state: SimState): void {
    const b = state.room.bounds;
    const key = `${state.room.biome}:${state.room.depth}:${b.minX}:${b.maxX}:${b.minY}:${b.maxY}:${state.room.doors.length}`;
    if (key === this.lastArchKey) return;
    this.lastArchKey = key;

    this.braziers.length = 0;
    const inset = 64;
    this.braziers.push(
      { x: b.minX + inset, y: b.minY + inset },
      { x: b.maxX - inset, y: b.minY + inset },
      { x: b.minX + inset, y: b.maxY - inset },
      { x: b.maxX - inset, y: b.maxY - inset }
    );

    this.wallSconces.length = 0;
    const spanW = b.maxX - b.minX;
    const pilasterCount = Math.max(3, Math.round(spanW / 240));
    const step = spanW / pilasterCount;
    for (let i = 1; i < pilasterCount; i++) {
      const sx = b.minX + i * step;
      let nearDoor = false;
      for (let d = 0; d < state.room.doors.length; d++) {
        const door = state.room.doors[d];
        if (door.direction === 'north' && Math.abs(door.pos.x - sx) < 118) {
          nearDoor = true;
          break;
        }
      }
      if (!nearDoor) this.wallSconces.push({ x: sx, y: b.minY });
    }

    this.cornerObelisks.length = 0;
    this.cornerObelisks.push(
      { x: b.minX - 10, y: b.minY - 6, north: true },
      { x: b.maxX + 10, y: b.minY - 6, north: true },
      { x: b.minX - 10, y: b.maxY + 6, north: false },
      { x: b.maxX + 10, y: b.maxY + 6, north: false }
    );
  }

  public render(
    state: SimState,
    prevState: SimState | null,
    cam: CameraView,
    vfx: ParticlesAndDecals,
    settings: RenderSettings,
    nowMs: number
  ): number {
    const ctx = this.ctx;
    if (!ctx) return 0;

    this.drawCalls = 0;
    const timeSec = nowMs * 0.001;
    const theme = BIOME_THEMES_2D[state.room.biome] ?? BIOME_THEMES_2D.obsidian_pit;
    this.ensureArchitecture(state);

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 1. All-Biome Deep Parallax Abyss & Atmospheric Spectacle
    this.drawAbyssBackdrop(ctx, state.room.biome, theme, cam, timeSec);

    // 2. Architectural 3D Perimeter Walls, Biome Cliff Drop, 4-Variant Weathered Floor,
    //    Central Mosaic Medallion, Organic Bezier Hazards & Floor Decals
    this.drawChamberFloorAndWalls(ctx, state, theme, cam, vfx, timeSec);

    // 3. Biome/Boss-Themed Crisp Danger Rune Telegraphs
    this.drawTelegraphs(ctx, state, theme, cam, timeSec);

    // 4. Two-Layer Contact AO & Directional SE Cast Ground Shadows
    this.drawCastShadowsAndAO(ctx, state, prevState, cam);

    // 5. Y-Sorted Entities, Props, Braziers, Obelisks, Doors, Cloak, Hero, Enemies & 4-Layer Beams
    this.drawYSortedWorld(ctx, state, prevState, theme, cam, settings, timeSec);

    // 6. 3-Layer Sweeping Comic Weapon Slash Smears & Directional Hit-Spark Streaks
    this.drawSlashRibbons(ctx, vfx, cam);
    this.drawParticles(ctx, vfx, cam);

    // 7. Additive Dynamic Glows (Flickering Braziers, Wall Sconces, Volumetric Light Cones)
    this.drawAdditiveLightsAndCones(ctx, state, prevState, theme, cam, timeSec);

    // 8. Atmospheric Vignette, Shockwave/Chromatic Post-FX Fallback & Combat Pulses
    this.drawPostOverlay(ctx, vfx, cam, settings);

    // 9. Crisp Comic-Ink Floating Damage Numbers
    if (settings.showDamageNumbers) {
      for (let i = 0; i < state.floatingNumbers.length; i++) {
        const fn = state.floatingNumbers[i];
        drawFloatingNumber2D(ctx, fn, this.wxToSx(fn.pos.x, cam), this.wyToSy(fn.pos.y, 64, cam));
        this.drawCalls++;
      }
    }

    ctx.restore();
    return this.drawCalls;
  }

  private drawAbyssBackdrop(
    ctx: CanvasRenderingContext2D,
    biome: BiomeId,
    theme: BiomeTheme2D,
    cam: CameraView,
    timeSec: number
  ): void {
    const g = ctx.createLinearGradient(0, 0, 0, this.viewH);
    g.addColorStop(0, theme.deepHex);
    g.addColorStop(0.55, theme.midHex);
    g.addColorStop(1, theme.deepHex);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // Distant parallax architectural silhouettes tailored per biome
    const offset = (-cam.camX * 0.14) % 190;
    if (biome === 'verdant_colosseum') {
      // Sunlit classical colonnades + warm diagonal golden sunbeams
      ctx.fillStyle = 'rgba(12, 42, 52, 0.58)';
      for (let x = offset - 190; x < this.viewW + 190; x += 170) {
        ctx.fillRect(x, this.viewH * 0.16, 46, this.viewH * 0.85);
        ctx.fillRect(x - 16, this.viewH * 0.14, 172, 24);
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255, 226, 133, 0.08)';
      for (let i = 0; i < 4; i++) {
        const rx = ((i * 340 + timeSec * 14) % (this.viewW + 260)) - 130;
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        ctx.lineTo(rx + 120, 0);
        ctx.lineTo(rx + 280, this.viewH);
        ctx.lineTo(rx + 140, this.viewH);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (biome === 'crypt_of_bile') {
      // Vaulted gothic catacomb arches + chartreuse miasma glow
      ctx.fillStyle = 'rgba(8, 12, 5, 0.72)';
      for (let x = offset - 190; x < this.viewW + 190; x += 180) {
        ctx.fillRect(x, 0, 52, this.viewH);
        ctx.beginPath();
        ctx.arc(x + 90, this.viewH * 0.25, 68, Math.PI, 0);
        ctx.lineWidth = 22;
        ctx.strokeStyle = 'rgba(10, 16, 6, 0.72)';
        ctx.stroke();
      }
    } else if (biome === 'cinder_mire') {
      // Glowing molten magma river bands beneath volcanic abyss
      ctx.save();
      ctx.globalAlpha = 0.26 + 0.08 * Math.sin(timeSec * 2.1);
      const lavaG = ctx.createLinearGradient(0, this.viewH * 0.4, this.viewW, this.viewH);
      lavaG.addColorStop(0, '#FF4500');
      lavaG.addColorStop(0.5, '#FFAE22');
      lavaG.addColorStop(1, '#8C1404');
      ctx.fillStyle = lavaG;
      ctx.fillRect(0, this.viewH * 0.45, this.viewW, this.viewH * 0.55);
      ctx.restore();
    } else if (biome === 'frozen_summit') {
      // Sweeping emerald/violet/rose aurora ribbons
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const ag = ctx.createLinearGradient(0, 0, this.viewW, this.viewH * 0.5);
      ag.addColorStop(0, 'rgba(54, 242, 184, 0.16)');
      ag.addColorStop(0.5, 'rgba(180, 100, 255, 0.18)');
      ag.addColorStop(1, 'rgba(255, 110, 136, 0.14)');
      ctx.fillStyle = ag;
      ctx.fillRect(0, 0, this.viewW, this.viewH * 0.56);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(6, 5, 12, 0.62)';
      for (let x = offset - 190; x < this.viewW + 190; x += 190) {
        ctx.fillRect(x, this.viewH * 0.16, 62, this.viewH * 0.86);
      }
    }

    const mistGrad = ctx.createLinearGradient(0, this.viewH * 0.55, 0, this.viewH);
    mistGrad.addColorStop(0, 'rgba(0,0,0,0)');
    mistGrad.addColorStop(1, theme.accentHex);
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.04 * Math.sin(timeSec * 1.4);
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, this.viewH * 0.55, this.viewW, this.viewH * 0.45);
    ctx.restore();
    this.drawCalls += 3;
  }

  private buildOrganicHazardPoly(sx: number, sy: number, rx: number, ry: number, seed: number): void {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const perturb =
        1.0 +
        0.13 * Math.sin(3 * a + seed * 6.283) +
        0.09 * Math.cos(5 * a - seed * 9.17) +
        0.05 * Math.sin(7 * a + seed * 3.7);
      this.polyX[i] = sx + Math.cos(a) * rx * perturb;
      this.polyY[i] = sy + Math.sin(a) * ry * perturb;
    }
  }

  private traceClosedSmoothPoly(ctx: CanvasRenderingContext2D): void {
    const n = 12;
    const lastX = (this.polyX[n - 1] + this.polyX[0]) * 0.5;
    const lastY = (this.polyY[n - 1] + this.polyY[0]) * 0.5;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const mx = (this.polyX[i] + this.polyX[next]) * 0.5;
      const my = (this.polyY[i] + this.polyY[next]) * 0.5;
      ctx.quadraticCurveTo(this.polyX[i], this.polyY[i], mx, my);
    }
    ctx.closePath();
  }

  private drawChamberFloorAndWalls(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    theme: BiomeTheme2D,
    cam: CameraView,
    vfx: ParticlesAndDecals,
    timeSec: number
  ): void {
    const b = state.room.bounds;
    const x0 = this.wxToSx(b.minX, cam);
    const x1 = this.wxToSx(b.maxX, cam);
    const y0 = this.wyToSy(b.minY, 0, cam);
    const y1 = this.wyToSy(b.maxY, 0, cam);
    const z = cam.zoom;
    const biome = state.room.biome;
    const shortName = this.getBiomeShortName(biome);

    // 1. Biome-Matched Southern 3D Chasm Cliff Drop
    const cliffId = this.resolveSprite(`prop_chasm_${shortName}`, 'prop_chasm_rim');
    const rimRect = this.atlas.sprites.get(cliffId);
    if (rimRect) {
      const cliffH = 132 * z;
      const spanX0 = x0 - 26 * z;
      const spanW = x1 - x0 + 52 * z;
      const segs = Math.max(1, Math.ceil(spanW / (220 * z)));
      const sw = spanW / segs;
      for (let i = 0; i < segs; i++) {
        ctx.drawImage(this.atlasCanvas, rimRect.x, rimRect.y, rimRect.w, rimRect.h, spanX0 + i * sw, y1 - 2 * z, sw + 1, cliffH);
      }
      const aoGrad = ctx.createLinearGradient(0, y1, 0, y1 + 26 * z);
      aoGrad.addColorStop(0, 'rgba(9, 6, 14, 0.85)');
      aoGrad.addColorStop(1, 'rgba(9, 6, 14, 0)');
      ctx.fillStyle = aoGrad;
      ctx.fillRect(spanX0, y1, spanW, 26 * z);
      this.drawCalls += segs + 1;
    }

    // 2. Continuous Beveled 3D Northern Retaining Wall + Pilasters + Sconces
    const wallH = 98 * z;
    const pW = 28 * z;
    const wx0 = x0 - pW;
    const wx1 = x1 + pW;
    const topY = y0 - wallH;
    const wallSpriteId = `prop_wall_${shortName}_n`;

    ctx.fillStyle = INK_HEX;
    ctx.fillRect(wx0 - 3 * z, topY - 3 * z, wx1 - wx0 + 6 * z, wallH + 6 * z);

    const wallRect = this.hasSprite(wallSpriteId) ? this.atlas.sprites.get(wallSpriteId) : null;
    if (wallRect) {
      const segs = Math.max(1, Math.ceil((wx1 - wx0) / (230 * z)));
      const sw = (wx1 - wx0) / segs;
      for (let i = 0; i < segs; i++) {
        ctx.drawImage(this.atlasCanvas, wallRect.x, wallRect.y, wallRect.w, wallRect.h, wx0 + i * sw, topY, sw + 1, wallH + 3 * z);
      }
    } else {
      const wg = ctx.createLinearGradient(0, topY, 0, y0);
      wg.addColorStop(0, theme.wallLitHex);
      wg.addColorStop(1, theme.wallDarkHex);
      ctx.fillStyle = wg;
      ctx.fillRect(wx0, topY + 16 * z, wx1 - wx0, wallH - 16 * z);
      // Cornice cap
      ctx.fillStyle = theme.wallLitHex;
      ctx.fillRect(wx0 - 2 * z, topY, wx1 - wx0 + 4 * z, 15 * z);
      ctx.fillStyle = theme.wallTrimHex;
      ctx.fillRect(wx0, topY + 10 * z, wx1 - wx0, 3 * z);
      ctx.fillStyle = INK_HEX;
      ctx.fillRect(wx0, topY + 14 * z, wx1 - wx0, 3 * z);
    }

    // Pilasters & burning wall sconces
    for (let i = 0; i < this.wallSconces.length; i++) {
      const sc = this.wallSconces[i];
      const px = this.wxToSx(sc.x, cam);
      ctx.fillStyle = INK_HEX;
      ctx.fillRect(px - 14 * z, topY + 6 * z, 28 * z, wallH - 4 * z);
      ctx.fillStyle = theme.wallLitHex;
      ctx.fillRect(px - 11 * z, topY + 10 * z, 12 * z, wallH - 10 * z);
      ctx.fillStyle = theme.wallDarkHex;
      ctx.fillRect(px + 1 * z, topY + 10 * z, 10 * z, wallH - 10 * z);
      ctx.fillStyle = theme.wallTrimHex;
      ctx.fillRect(px - 15 * z, topY + 8 * z, 30 * z, 10 * z);

      const sconceY = y0 - 38 * z;
      if (this.hasSprite('prop_wall_sconce')) {
        const scS = this.spriteScaleForHeight('prop_wall_sconce', 66 * z);
        this.drawSprite(ctx, 'prop_wall_sconce', px, sconceY + 14 * z, scS, scS);
      } else {
        ctx.fillStyle = '#9E6E2E';
        ctx.fillRect(px - 7 * z, sconceY - 2 * z, 14 * z, 9 * z);
      }
      const flick = 0.88 + 0.14 * Math.sin(timeSec * 11.3 + i * 2.1);
      const flS = this.spriteScaleForHeight('vfx_flame_tongue', 42 * z);
      this.drawSprite(ctx, 'vfx_flame_tongue', px, sconceY - 4 * z, flS * 0.85 * flick, flS * flick);
    }

    // 3. Clipped 4-Variant Weathered Flagstone Floor + Central Mosaic Medallion
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.fillStyle = theme.floorHex;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    const tileWorldW = 210;
    const tileWorldH = 210;
    const halfW = tileWorldW * 0.5;
    const halfH = tileWorldH * 0.5;
    const sampleRect = this.atlas.sprites.get(this.resolveFloorVariantId(biome, 0));
    const sxScale = (tileWorldW / ((sampleRect?.w ?? 256) * 0.984)) * z;
    const syScale = ((tileWorldH * cam.isoScaleY) / ((sampleRect?.h ?? 128) * 0.968)) * z;
    const roomSeed = (state.room.roomIndex * 131 + state.room.depth * 37 + state.run.seed) | 0;

    const startRow = Math.floor(b.minY / halfH) - 1;
    const endRow = Math.ceil(b.maxY / halfH) + 1;
    const startCol = Math.floor(b.minX / tileWorldW) - 1;
    const endCol = Math.ceil(b.maxX / tileWorldW) + 1;

    for (let row = startRow; row <= endRow; row++) {
      const wy = row * halfH;
      const xShift = (row & 1) !== 0 ? halfW : 0;
      for (let col = startCol; col <= endCol; col++) {
        const wx = col * tileWorldW + xShift;
        if (wx + halfW < b.minX || wx - halfW > b.maxX || wy + halfH < b.minY || wy - halfH > b.maxY) {
          continue;
        }
        let h = ((col * 73856093) ^ (row * 19349663) ^ (roomSeed * 83492791)) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
        const bucket = (h >>> 24) % 100;
        const variantIdx = bucket < 45 ? 0 : bucket < 70 ? 1 : bucket < 88 ? 2 : 3;
        this.drawSprite(ctx, this.resolveFloorVariantId(biome, variantIdx), this.wxToSx(wx, cam), this.wyToSy(wy, 0, cam), sxScale, syScale);
      }
    }

    // Spatial value vignette wash across stone floor
    const cxWorld = (b.minX + b.maxX) * 0.5;
    const cyWorld = (b.minY + b.maxY) * 0.5;
    const cxSx = this.wxToSx(cxWorld, cam);
    const cySy = this.wyToSy(cyWorld, 0, cam);
    const floorVig = ctx.createRadialGradient(cxSx, cySy, (x1 - x0) * 0.18, cxSx, cySy, (x1 - x0) * 0.62);
    floorVig.addColorStop(0, 'rgba(0,0,0,0)');
    floorVig.addColorStop(1, 'rgba(9, 6, 14, 0.24)');
    ctx.fillStyle = floorVig;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // Sanctum Courtyard Crimson-Gold Carpet Runner (drawn beneath Central Medallion inlay)
    if (biome === 'sanctum_hub') {
      const rugHalfW = 74 * z;
      ctx.fillStyle = 'rgba(143, 21, 43, 0.88)';
      ctx.fillRect(cxSx - rugHalfW, y0 + 10 * z, rugHalfW * 2, y1 - y0 - 34 * z);
      ctx.strokeStyle = '#E6B84C';
      ctx.lineWidth = 3.2 * z;
      ctx.strokeRect(cxSx - rugHalfW + 6 * z, y0 + 10 * z, rugHalfW * 2 - 12 * z, y1 - y0 - 34 * z);
    }

    // Central Chamber Mosaic Medallion (above floor & carpet runner)
    const medId = `prop_medallion_${shortName}`;
    if (this.hasSprite(medId)) {
      const sc = this.spriteScaleForHeight(medId, 210 * z);
      this.drawSprite(ctx, medId, cxSx, cySy, sc, sc, 0, 0.85);
    } else {
      const mRx = 192 * z;
      const mRy = mRx * cam.isoScaleY;
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.ellipse(cxSx, cySy, mRx, mRy, 0, 0, Math.PI * 2);
      ctx.fillStyle = theme.floorHex;
      ctx.fill();
      ctx.lineWidth = 6 * z;
      ctx.strokeStyle = INK_HEX;
      ctx.stroke();
      ctx.lineWidth = 3 * z;
      ctx.strokeStyle = theme.wallTrimHex;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cxSx, cySy, mRx * 0.76, mRy * 0.76, 0, 0, Math.PI * 2);
      ctx.lineWidth = 2.4 * z;
      ctx.stroke();
      ctx.restore();
    }

    // Northern wall contact AO strip
    const nAo = ctx.createLinearGradient(0, y0, 0, y0 + 26 * z);
    nAo.addColorStop(0, 'rgba(9, 6, 14, 0.72)');
    nAo.addColorStop(1, 'rgba(9, 6, 14, 0)');
    ctx.fillStyle = nAo;
    ctx.fillRect(x0, y0, x1 - x0, 26 * z);
    ctx.restore();

    // 4. Stepped Beveled East & West Stone Parapets + Southern Kerb
    ctx.fillStyle = theme.wallLitHex;
    ctx.fillRect(x0 - pW, y0 - 12 * z, pW, y1 - y0 + 12 * z);
    ctx.fillStyle = theme.wallDarkHex;
    ctx.fillRect(x1, y0 - 12 * z, pW, y1 - y0 + 12 * z);
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 3.2 * z;
    ctx.strokeRect(x0 - pW, y0 - 12 * z, pW, y1 - y0 + 12 * z);
    ctx.strokeRect(x1, y0 - 12 * z, pW, y1 - y0 + 12 * z);
    ctx.fillStyle = theme.wallDarkHex;
    ctx.fillRect(x0 - pW, y1 - 3 * z, x1 - x0 + pW * 2, 16 * z);
    ctx.strokeStyle = theme.wallTrimHex;
    ctx.lineWidth = 2.2 * z;
    ctx.beginPath();
    ctx.moveTo(x0 - pW, y1 - 2 * z);
    ctx.lineTo(x1 + pW, y1 - 2 * z);
    ctx.stroke();

    // Northern Corner Obelisks
    for (let i = 0; i < this.cornerObelisks.length; i++) {
      const ob = this.cornerObelisks[i];
      if (ob.north) this.drawCornerObelisk(ctx, ob.x, ob.y, biome, theme, cam);
    }

    // 5. Chasm Pits (beveled octagonal cutouts)
    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind !== 'pit') continue;
      const cx = this.wxToSx(obs.pos.x, cam);
      const cy = this.wyToSy(obs.pos.y, 0, cam);
      const hw = obs.halfW * z;
      const hh = obs.halfH * cam.isoScaleY * z;
      const cxOff = hw * 0.36;
      const cyOff = hh * 0.42;
      ctx.beginPath();
      ctx.moveTo(cx - hw + cxOff, cy - hh);
      ctx.lineTo(cx + hw - cxOff, cy - hh);
      ctx.lineTo(cx + hw, cy - hh + cyOff);
      ctx.lineTo(cx + hw, cy + hh - cyOff);
      ctx.lineTo(cx + hw - cxOff, cy + hh);
      ctx.lineTo(cx - hw + cxOff, cy + hh);
      ctx.lineTo(cx - hw, cy + hh - cyOff);
      ctx.lineTo(cx - hw, cy - hh + cyOff);
      ctx.closePath();
      ctx.fillStyle = theme.deepHex;
      ctx.fill();
      ctx.strokeStyle = INK_HEX;
      ctx.lineWidth = 4.5 * z;
      ctx.stroke();
    }

    // 6. Persistent Floor Decals (crater, scorch, ichor, crack)
    for (let i = 0; i < MAX_DECALS; i++) {
      const d = vfx.decals[i];
      if (!d.active) continue;
      const fade = Math.min(1, d.life / Math.min(2, d.maxLife * 0.35));
      const id =
        d.kind === 'crater'
          ? this.resolveSprite('vfx_decal_crater', 'vfx_decal_crack')
          : d.kind === 'ichor'
            ? 'vfx_decal_ichor'
            : d.kind === 'crack'
              ? 'vfx_decal_crack'
              : 'vfx_decal_scorch';
      const baseSc = this.spriteScaleForMaxDim(id, 144 * z);
      this.drawSprite(ctx, id, this.wxToSx(d.x, cam), this.wyToSy(d.y, 0, cam), d.scaleX * baseSc, d.scaleY * baseSc, d.angle, d.alpha * fade);
    }

    // 7. Organic Multi-Lobe Bezier Hazards (ZERO plain ovals!)
    for (let i = 0; i < state.room.hazards.length; i++) {
      const h = state.room.hazards[i];
      const k = h.kind as string;
      const sx = this.wxToSx(h.pos.x, cam);
      const sy = this.wyToSy(h.pos.y, 0, cam);
      const rx = h.radius * z;
      const ry = h.radius * cam.isoScaleY * z;
      const seed = Math.abs(Math.sin(h.pos.x * 0.037 + h.pos.y * 0.023 + i * 1.17));

      if (k === 'spike_trap') {
        const id = h.active ? 'prop_spike_active' : h.armed ? 'prop_spike_armed' : 'prop_spike_idle';
        const sc = this.spriteScaleForMaxDim(id, Math.max(96, h.radius * 2.1) * z);
        this.drawSprite(ctx, id, sx, sy, sc, sc);
      } else if (k === 'lava_pool' || k === 'boiling_geyser') {
        // Organic 12-lobe molten magma pool with basalt crust & glowing fissures
        this.buildOrganicHazardPoly(sx, sy, rx * 1.09, ry * 1.09, seed);
        this.traceClosedSmoothPoly(ctx);
        ctx.fillStyle = '#1C0908';
        ctx.fill();
        ctx.strokeStyle = INK_HEX;
        ctx.lineWidth = 4.2 * z;
        ctx.stroke();

        this.buildOrganicHazardPoly(sx, sy, rx, ry, seed);
        this.traceClosedSmoothPoly(ctx);
        const mg = ctx.createRadialGradient(sx, sy + ry * 0.08, rx * 0.1, sx, sy, rx);
        mg.addColorStop(0, '#FFF099');
        mg.addColorStop(0.45, '#FF7A12');
        mg.addColorStop(0.85, '#D92B04');
        mg.addColorStop(1, '#4A120A');
        ctx.fillStyle = mg;
        ctx.fill();

        // Drifting dark basalt crust plates
        const driftX = Math.sin(timeSec * 0.9 + seed * 6) * rx * 0.08;
        ctx.save();
        ctx.clip();
        ctx.fillStyle = 'rgba(28, 9, 8, 0.72)';
        for (let p = 0; p < 4; p++) {
          const pa = seed * 6 + p * 1.55 + timeSec * 0.14;
          const px = sx + Math.cos(pa) * rx * 0.42 + driftX;
          const py = sy + Math.sin(pa) * ry * 0.36;
          ctx.beginPath();
          ctx.ellipse(px, py, rx * 0.24, ry * 0.2, pa, 0, Math.PI * 2);
          ctx.fill();
        }
        // Glowing jagged fissures
        ctx.strokeStyle = '#FFF099';
        ctx.lineWidth = 2.6 * z;
        ctx.beginPath();
        ctx.moveTo(sx - rx * 0.65, sy - ry * 0.1);
        ctx.lineTo(sx - rx * 0.15 + driftX, sy + ry * 0.18);
        ctx.lineTo(sx + rx * 0.22 - driftX, sy - ry * 0.08);
        ctx.lineTo(sx + rx * 0.62, sy + ry * 0.2);
        ctx.stroke();
        ctx.restore();

        this.traceClosedSmoothPoly(ctx);
        ctx.strokeStyle = INK_HEX;
        ctx.lineWidth = 2.6 * z;
        ctx.stroke();
      } else if (k === 'poison_pool') {
        // Organic 12-lobe bubbling caustic bile spill
        this.buildOrganicHazardPoly(sx, sy, rx * 1.07, ry * 1.07, seed);
        this.traceClosedSmoothPoly(ctx);
        ctx.fillStyle = '#1E2E14';
        ctx.fill();
        ctx.strokeStyle = INK_HEX;
        ctx.lineWidth = 3.8 * z;
        ctx.stroke();

        this.buildOrganicHazardPoly(sx, sy, rx, ry, seed);
        this.traceClosedSmoothPoly(ctx);
        const pg = ctx.createRadialGradient(sx, sy, rx * 0.1, sx, sy, rx);
        pg.addColorStop(0, '#8CE622');
        pg.addColorStop(0.6, '#3C8C14');
        pg.addColorStop(1, '#19380A');
        ctx.fillStyle = pg;
        ctx.fill();

        // Popping Voronoi-like cellular acid bubbles
        for (let bIdx = 0; bIdx < 5; bIdx++) {
          const ph = (timeSec * 0.68 + seed + bIdx * 0.21) % 1;
          const ba = seed * 6.2 + bIdx * 1.3;
          const bx = sx + Math.cos(ba) * rx * 0.46;
          const by = sy + Math.sin(ba) * ry * 0.42;
          const br = (0.06 + ph * 0.11) * rx;
          ctx.beginPath();
          ctx.ellipse(bx, by, br, br * cam.isoScaleY, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(210, 255, 84, ${Math.sin(ph * Math.PI) * 0.92})`;
          ctx.lineWidth = 2.0 * z;
          ctx.stroke();
        }
      } else if (k === 'consecrated_aura' || k === 'consecrated_ground') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(1, cam.isoScaleY);
        ctx.rotate(timeSec * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 226, 122, 0.2)';
        ctx.fill();
        ctx.setLineDash([16 * z, 8 * z]);
        ctx.strokeStyle = '#FFE27A';
        ctx.lineWidth = 3.5 * z;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (k === 'curing_pool') {
        const sc = this.spriteScaleForMaxDim('vfx_curing_basin', Math.max(96, h.radius * 2.3) * z);
        this.drawSprite(ctx, 'vfx_curing_basin', sx, sy, sc, sc);
        // Animated turquoise healing ripple
        const rip = (timeSec * 0.9) % 1;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx * 0.72 * rip, ry * 0.72 * rip, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(216, 255, 255, ${(1 - rip) * 0.85})`;
        ctx.lineWidth = 2.4 * z;
        ctx.stroke();
      } else if (k === 'sawblade') {
        const sc = this.spriteScaleForMaxDim('vfx_sawblade', Math.max(66, h.radius * 2.1) * z);
        this.drawSprite(ctx, 'vfx_sawblade', sx, sy - 8 * z, sc, sc * 0.86, timeSec * 14);
      } else if (k === 'pylon') {
        const sc = this.spriteScaleForMaxDim('vfx_pylon', Math.max(76, h.radius * 2.3) * z);
        this.drawSprite(ctx, 'vfx_pylon', sx, sy, sc, sc);
      } else if (k === 'rift_vortex') {
        const sc = this.spriteScaleForMaxDim('vfx_blade_rift', Math.max(92, h.radius * 2.2) * z);
        this.drawSprite(ctx, 'vfx_blade_rift', sx, sy - 6 * z, sc, sc * cam.isoScaleY, timeSec * 9);
      }
    }
  }

  private drawCornerObelisk(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wy: number,
    biome: BiomeId,
    theme: BiomeTheme2D,
    cam: CameraView
  ): void {
    const sx = this.wxToSx(wx, cam);
    const sy = this.wyToSy(wy, 0, cam);
    const z = cam.zoom;
    const preferredId =
      biome === 'verdant_colosseum'
        ? 'prop_obelisk_verdant'
        : biome === 'frozen_summit'
          ? 'prop_obelisk_summit'
          : 'prop_obelisk';
    const spriteId = this.hasSprite(preferredId)
      ? preferredId
      : this.hasSprite('prop_obelisk')
        ? 'prop_obelisk'
        : null;
    if (spriteId) {
      const sc = this.spriteScaleForHeight(spriteId, 178 * z);
      this.drawSprite(ctx, spriteId, sx, sy, sc, sc);
      return;
    }

    ctx.save();
    ctx.fillStyle = INK_HEX;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 154 * z);
    ctx.lineTo(sx + 18 * z, sy - 126 * z);
    ctx.lineTo(sx + 26 * z, sy + 6 * z);
    ctx.lineTo(sx - 26 * z, sy + 6 * z);
    ctx.lineTo(sx - 18 * z, sy - 126 * z);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = theme.wallLitHex;
    ctx.fillRect(sx - 15 * z, sy - 124 * z, 16 * z, 118 * z);
    ctx.fillStyle = theme.wallDarkHex;
    ctx.fillRect(sx + 1 * z, sy - 124 * z, 14 * z, 118 * z);
    ctx.fillStyle = theme.wallTrimHex;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 150 * z);
    ctx.lineTo(sx + 14 * z, sy - 124 * z);
    ctx.lineTo(sx - 14 * z, sy - 124 * z);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    this.drawCalls++;
  }

  private drawCastShadowsAndAO(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    prevState: SimState | null,
    cam: CameraView
  ): void {
    const z = cam.zoom;
    const drawCast = (wx: number, wy: number, radiusW: number, heightW: number, alpha: number) => {
      const bx = this.wxToSx(wx, cam);
      const by = this.wyToSy(wy, 0, cam);
      const tx = this.wxToSx(wx + SHADOW_DIR_X * heightW, cam);
      const ty = this.wyToSy(wy + SHADOW_DIR_Y * heightW, 0, cam);
      const sdx = tx - bx;
      const sdy = ty - by;
      const len = Math.hypot(sdx, sdy);
      if (len < 2) return;
      const nx = (-sdy / len) * radiusW * z;
      const ny = (sdx / len) * radiusW * z;

      ctx.fillStyle = `rgba(9, 6, 14, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(bx + nx, by + ny);
      ctx.lineTo(bx - nx, by - ny);
      ctx.lineTo(tx - nx * 0.62, ty - ny * 0.62);
      ctx.lineTo(tx + nx * 0.62, ty + ny * 0.62);
      ctx.closePath();
      ctx.fill();

      // Tight contact AO skirt
      ctx.fillStyle = 'rgba(9, 6, 14, 0.72)';
      ctx.beginPath();
      ctx.ellipse(bx, by, radiusW * 1.15 * z, radiusW * 1.15 * cam.isoScaleY * z, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind === 'pit') continue;
      drawCast(obs.pos.x, obs.pos.y + obs.halfH * 0.35, obs.halfW * 0.95, obs.kind === 'destructible_urn' ? 46 : 185, 0.48);
    }
    for (let i = 0; i < this.cornerObelisks.length; i++) {
      drawCast(this.cornerObelisks[i].x, this.cornerObelisks[i].y, 26, 158, 0.46);
    }
    for (let i = 0; i < this.braziers.length; i++) {
      drawCast(this.braziers[i].x, this.braziers[i].y, 22, 56, 0.34);
    }
    const hp = this.interpPos(state.player.pos, prevState?.player.pos ?? null, cam.interpAlpha);
    drawCast(hp.x, hp.y, 24, 96, 0.45);
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.aiState === 'dead') continue;
      const ep = this.interpPos(e.pos, prevState?.enemies.find((p) => p.id === e.id)?.pos ?? null, cam.interpAlpha);
      drawCast(ep.x, ep.y, Math.max(20, e.radius * 0.85), e.isBoss ? 170 : 88, e.isBoss ? 0.52 : 0.44);
    }
    this.drawCalls += 2;
  }

  private clipRayToObstacles(
    obstacles: readonly ArenaObstacle[],
    ox: number,
    oy: number,
    dirX: number,
    dirY: number,
    maxLen: number
  ): number {
    let bestT = maxLen;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (!obs.blocksProjectiles) continue;
      if (obs.destructible && (obs.hp ?? 1) <= 0) continue;

      const minX = obs.pos.x - obs.halfW;
      const maxX = obs.pos.x + obs.halfW;
      const minY = obs.pos.y - obs.halfH;
      const maxY = obs.pos.y + obs.halfH;

      let tMin = 0;
      let tMax = bestT;

      if (Math.abs(dirX) < 1e-6) {
        if (ox < minX || ox > maxX) continue;
      } else {
        let t1 = (minX - ox) / dirX;
        let t2 = (maxX - ox) / dirX;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tMin) tMin = t1;
        if (t2 < tMax) tMax = t2;
        if (tMin > tMax) continue;
      }

      if (Math.abs(dirY) < 1e-6) {
        if (oy < minY || oy > maxY) continue;
      } else {
        let t1 = (minY - oy) / dirY;
        let t2 = (maxY - oy) / dirY;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tMin) tMin = t1;
        if (t2 < tMax) tMax = t2;
        if (tMin > tMax) continue;
      }

      if (tMin > 0.5 && tMin < bestT && tMax > 0) {
        bestT = tMin;
      }
    }
    return bestT;
  }

  private drawTelegraphs(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    theme: BiomeTheme2D,
    cam: CameraView,
    timeSec: number
  ): void {
    const telegraphs: readonly TelegraphShape[] = state.room.telegraphs;
    const obstacles = state.room.obstacles;
    const z = cam.zoom;

    for (let i = 0; i < telegraphs.length; i++) {
      const t = telegraphs[i];
      const prog = Math.max(0, Math.min(1, t.progress));
      const sx = this.wxToSx(t.pos.x, cam);
      const sy = this.wyToSy(t.pos.y, 0, cam);
      const color = prog > 0.82 ? '#FFD24C' : theme.telegraphPrimary;

      ctx.save();
      if (t.kind === 'circle' || t.kind === 'ring') {
        const rx = t.radius * z;
        const ry = t.radius * cam.isoScaleY * z;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(9, 6, 14, 0.28)';
        ctx.fill();
        ctx.lineWidth = 6 * z;
        ctx.strokeStyle = INK_HEX;
        ctx.stroke();
        ctx.lineWidth = 3.2 * z;
        ctx.strokeStyle = color;
        ctx.stroke();

        // Inner countdown sweep
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx * prog, ry * prog, 0, 0, Math.PI * 2);
        ctx.fillStyle = prog > 0.82 ? 'rgba(255, 212, 76, 0.42)' : 'rgba(255, 56, 84, 0.32)';
        ctx.fill();

        // Rotating notched danger rune ticks
        const rot = timeSec * 0.9;
        ctx.strokeStyle = theme.telegraphAccent;
        ctx.lineWidth = 2.4 * z;
        for (let n = 0; n < 12; n++) {
          const a = rot + (n / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * rx * 0.98, sy + Math.sin(a) * ry * 0.98);
          ctx.lineTo(sx + Math.cos(a) * rx * 0.84, sy + Math.sin(a) * ry * 0.84);
          ctx.stroke();
        }
      } else if (t.kind === 'cone') {
        const halfArc = ((t.arcDeg ?? 65) * Math.PI) / 360;
        ctx.translate(sx, sy);
        ctx.scale(1, cam.isoScaleY);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, t.radius * z, t.angle - halfArc, t.angle + halfArc);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 42, 72, 0.22)';
        ctx.fill();
        ctx.strokeStyle = INK_HEX;
        ctx.lineWidth = 5.5 * z;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3.2 * z;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, t.radius * prog * z, t.angle - halfArc, t.angle + halfArc);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 92, 68, 0.36)';
        ctx.fill();
      } else {
        const rawLen = t.length ?? t.radius;
        const laneW = t.width ?? 44;
        const hw = laneW * 0.5;
        const c = Math.cos(t.angle);
        const s = Math.sin(t.angle);
        const len =
          t.kind === 'line' && laneW <= 96
            ? this.clipRayToObstacles(obstacles, t.pos.x, t.pos.y, c, s, rawLen)
            : rawLen;
        const px = -s * hw;
        const py = c * hw;
        ctx.beginPath();
        ctx.moveTo(this.wxToSx(t.pos.x + px, cam), this.wyToSy(t.pos.y + py, 0, cam));
        ctx.lineTo(this.wxToSx(t.pos.x - px, cam), this.wyToSy(t.pos.y - py, 0, cam));
        ctx.lineTo(this.wxToSx(t.pos.x + c * len - px, cam), this.wyToSy(t.pos.y + s * len - py, 0, cam));
        ctx.lineTo(this.wxToSx(t.pos.x + c * len + px, cam), this.wyToSy(t.pos.y + s * len + py, 0, cam));
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 42, 72, 0.24)';
        ctx.fill();
        ctx.strokeStyle = INK_HEX;
        ctx.lineWidth = 5 * z;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 * z;
        ctx.stroke();
      }
      ctx.restore();
      this.drawCalls++;
    }
  }

  private pushSort(kind: SortKind, sortY: number, idx: number, x: number, y: number): void {
    if (this.sortCount >= MAX_SORT) return;
    const s = this.sortPool[this.sortCount++];
    s.kind = kind;
    s.sortY = sortY;
    s.idx = idx;
    s.x = x;
    s.y = y;
  }

  private drawYSortedWorld(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    prevState: SimState | null,
    theme: BiomeTheme2D,
    cam: CameraView,
    settings: RenderSettings,
    timeSec: number
  ): void {
    this.sortCount = 0;

    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind === 'pit') continue;
      this.pushSort('obstacle', obs.pos.y + obs.halfH * 0.4, i, obs.pos.x, obs.pos.y);
    }
    for (let i = 0; i < this.braziers.length; i++) {
      this.pushSort('brazier', this.braziers[i].y, i, this.braziers[i].x, this.braziers[i].y);
    }
    for (let i = 0; i < this.cornerObelisks.length; i++) {
      const ob = this.cornerObelisks[i];
      if (!ob.north) this.pushSort('obelisk', ob.y + 10, i, ob.x, ob.y);
    }
    for (let i = 0; i < state.room.doors.length; i++) {
      this.pushSort('door', state.room.doors[i].pos.y - 10, i, state.room.doors[i].pos.x, state.room.doors[i].pos.y);
    }
    for (let i = 0; i < state.room.pickups.length; i++) {
      const pk = state.room.pickups[i];
      if (!pk.collected) this.pushSort('pickup', pk.pos.y, i, pk.pos.x, pk.pos.y);
    }
    for (let i = 0; i < state.room.bloodstones.length; i++) {
      const bs = state.room.bloodstones[i];
      this.pushSort('bloodstone', bs.pos.y, i, bs.pos.x, bs.pos.y);
    }
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.aiState !== 'dead') {
        const ep = this.interpPos(e.pos, prevState?.enemies.find((p) => p.id === e.id)?.pos ?? null, cam.interpAlpha);
        this.pushSort('enemy', ep.y, i, ep.x, ep.y);
      }
    }
    const heroPos = this.interpPos(state.player.pos, prevState?.player.pos ?? null, cam.interpAlpha);
    this.pushSort('hero', heroPos.y, 0, heroPos.x, heroPos.y);
    for (let i = 0; i < state.projectiles.length; i++) {
      const pr = state.projectiles[i];
      if (pr.kind === 'beam') {
        const c = Math.cos(pr.angle);
        const s = Math.sin(pr.angle);
        const startOffset = pr.targetPos ? 0 : 28;
        const ox = pr.startPos.x + c * startOffset;
        const oy = pr.startPos.y + s * startOffset;
        const rawLen = pr.targetPos
          ? Math.min(pr.range, Math.hypot(pr.targetPos.x - ox, pr.targetPos.y - oy))
          : Math.min(pr.range, 920);
        const clippedLen = this.clipRayToObstacles(state.room.obstacles, ox, oy, c, s, Math.max(0, rawLen));
        const hitPillar = clippedLen < rawLen - 0.5;
        this.pushSort('projectile', hitPillar ? oy + s * clippedLen : oy + 8, i, ox, oy);
      } else {
        this.pushSort('projectile', pr.pos.y + 8, i, pr.pos.x, pr.pos.y);
      }
    }

    for (let i = 1; i < this.sortCount; i++) {
      const cur = this.sortPool[i];
      let j = i - 1;
      while (j >= 0 && this.sortPool[j].sortY > cur.sortY) {
        this.sortPool[j + 1] = this.sortPool[j];
        j--;
      }
      this.sortPool[j + 1] = cur;
    }

    for (let i = 0; i < state.player.dashGhosts.length; i++) {
      const g = state.player.dashGhosts[i];
      const flip = Math.cos(g.angle) < -0.15 ? -1 : 1;
      const pose = this.selectHeroPose(g.angle);
      const sc = this.spriteScaleForHeight(pose, 142 * cam.zoom);
      this.drawSprite(ctx, pose, this.wxToSx(g.x, cam), this.wyToSy(g.y, 0, cam), sc * flip, sc, 0, g.alpha * 0.48);
    }

    const z = cam.zoom;
    for (let i = 0; i < this.sortCount; i++) {
      const item = this.sortPool[i];
      switch (item.kind) {
        case 'obstacle':
          this.drawObstacle(ctx, state.room.obstacles[item.idx], state.room.biome, cam);
          break;
        case 'brazier': {
          const bSc = this.spriteScaleForHeight('prop_brazier', 94 * z);
          const fSc = this.spriteScaleForHeight('vfx_flame_tongue', 62 * z);
          const flick = 0.88 + 0.14 * Math.sin(timeSec * 11.3 + item.idx);
          this.drawSprite(ctx, 'prop_brazier', this.wxToSx(item.x, cam), this.wyToSy(item.y, 0, cam), bSc, bSc);
          this.drawSprite(ctx, 'vfx_flame_tongue', this.wxToSx(item.x, cam), this.wyToSy(item.y, 32, cam), fSc * 0.86 * flick, fSc * flick);
          break;
        }
        case 'obelisk':
          this.drawCornerObelisk(ctx, item.x, item.y, state.room.biome, theme, cam);
          break;
        case 'door':
          this.drawDoor(ctx, state.room.doors[item.idx], cam, timeSec);
          break;
        case 'pickup': {
          const pk = state.room.pickups[item.idx];
          const bob = Math.sin(timeSec * 4 + pk.pos.x * 0.03) * 7 * z;
          const id = getPickupSpriteId(pk.kind, pk.patronId);
          const sc = this.spriteScaleForMaxDim(id, 72 * z);
          this.drawSprite(ctx, id, this.wxToSx(pk.pos.x, cam), this.wyToSy(pk.pos.y, 28, cam) + bob, sc, sc);
          break;
        }
        case 'bloodstone': {
          const sc = this.spriteScaleForMaxDim('vfx_bloodstone', 42 * z);
          this.drawSprite(ctx, 'vfx_bloodstone', this.wxToSx(item.x, cam), this.wyToSy(item.y, 14, cam), sc, sc);
          break;
        }
        case 'enemy':
          this.drawEnemy(ctx, state.enemies[item.idx], item.x, item.y, cam, settings, timeSec);
          break;
        case 'hero':
          this.drawHero(ctx, state, item.x, item.y, cam, timeSec);
          break;
        case 'projectile':
          this.drawProjectile(ctx, state.projectiles[item.idx], state.room.obstacles, cam, timeSec);
          break;
      }
    }
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, obs: ArenaObstacle, biome: BiomeId, cam: CameraView): void {
    const sx = this.wxToSx(obs.pos.x, cam);
    const sy = this.wyToSy(obs.pos.y, 0, cam);
    const z = cam.zoom;
    const id =
      obs.kind === 'destructible_urn'
        ? 'prop_urn'
        : obs.kind === 'statue'
          ? 'prop_statue'
          : getBiomePillarSpriteId(biome);
    const targetH = obs.kind === 'destructible_urn' ? Math.max(72, obs.halfW * 3.4) : obs.kind === 'statue' ? 198 : Math.max(226, obs.halfW * 5.25);
    const sc = this.spriteScaleForHeight(id, targetH * z);
    this.drawSprite(ctx, id, sx, sy, sc, sc);
  }

  private drawDoor(ctx: CanvasRenderingContext2D, door: ArenaDoor, cam: CameraView, timeSec: number): void {
    const sx = this.wxToSx(door.pos.x, cam);
    const sy = this.wyToSy(door.pos.y, 0, cam);
    const z = cam.zoom;
    const id = door.locked ? 'prop_exit_door_locked' : 'prop_exit_door_open';
    const sc = this.spriteScaleForHeight(id, 204 * z);
    this.drawSprite(ctx, id, sx, sy, sc, sc);
    const sigilId = door.reward.isBoss
      ? 'vfx_skull_badge'
      : door.reward.patronId
        ? getPatronSigilSpriteId(door.reward.patronId)
        : getPickupSpriteId(door.reward.kind);
    const bob = Math.sin(timeSec * 3.4) * 6 * z;
    const sSc = this.spriteScaleForMaxDim(sigilId, (door.locked ? 54 : 68) * z);
    this.drawSprite(ctx, sigilId, sx, sy - 116 * z + bob, sSc, sSc, 0, door.locked ? 0.72 : 1);
  }

  private drawHero(ctx: CanvasRenderingContext2D, state: SimState, wx: number, wy: number, cam: CameraView, timeSec: number): void {
    const p = state.player;
    const sx = this.wxToSx(wx, cam);
    const sy = this.wyToSy(wy, 0, cam);
    const z = cam.zoom;
    const speed = Math.hypot(p.vel.x, p.vel.y);
    const runBob = speed > 40 ? Math.abs(Math.sin(timeSec * 15)) * 6 * z : 0;

    const dirX = speed > 30 ? -p.vel.x / speed : -Math.cos(p.facingAngle);
    const dirY = speed > 30 ? (-p.vel.y / speed) * cam.isoScaleY : -Math.sin(p.facingAngle) * cam.isoScaleY;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx - 10 * z, sy - 56 * z - runBob);
    ctx.quadraticCurveTo(sx + dirX * 36 * z, sy - 30 * z + dirY * 22 * z, sx + dirX * 56 * z, sy - 8 * z + dirY * 32 * z);
    ctx.lineTo(sx + dirX * 34 * z + 16 * z, sy - 12 * z + dirY * 22 * z);
    ctx.lineTo(sx + 10 * z, sy - 54 * z - runBob);
    ctx.closePath();
    ctx.fillStyle = '#C41E2E';
    ctx.fill();
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 3 * z;
    ctx.stroke();
    ctx.restore();

    const flip = Math.cos(p.facingAngle) < -0.12 ? -1 : 1;
    const pose = this.selectHeroPose(p.facingAngle);
    const sc = this.spriteScaleForHeight(pose, 146 * z);
    this.drawSprite(ctx, pose, sx, sy - runBob, sc * flip, sc);

    const isSwinging = p.attackTimer > 0;
    const facingLeft = Math.cos(p.facingAngle) < -0.12;
    const wepAngle = isSwinging ? p.facingAngle + (p.attackComboStep % 2 === 1 ? -1.1 : 1.1) : facingLeft ? Math.PI - 0.38 : 0.38;
    const handX = isSwinging ? sx + Math.cos(p.facingAngle) * 20 * z : sx + (facingLeft ? -22 : 22) * z;
    const handY = isSwinging ? sy - 44 * z - runBob + Math.sin(p.facingAngle) * 10 * z : sy - 36 * z - runBob;
    const wepId = getWeaponSpriteId(p.weaponId);
    const wSc = this.spriteScaleForMaxDim(wepId, 102 * z);
    this.drawSprite(ctx, wepId, handX, handY, wSc, wSc * (Math.cos(wepAngle) < 0 ? -1 : 1), wepAngle);
  }

  private drawEnemy(
    ctx: CanvasRenderingContext2D,
    e: EnemyState,
    wx: number,
    wy: number,
    cam: CameraView,
    settings: RenderSettings,
    timeSec: number
  ): void {
    const sx = this.wxToSx(wx, cam);
    const sy = this.wyToSy(wy, 0, cam);
    const z = cam.zoom;
    const flip = Math.cos(e.facingAngle) < -0.15 ? -1 : 1;
    const spriteId = getEnemySpriteId(e.archetype, e.isBoss);
    const rect = this.atlas.sprites.get(spriteId);
    const scale = e.isBoss
      ? this.spriteScaleForHeight(spriteId, 286 * z)
      : rect && rect.h > 210
        ? Math.max(0.68, (e.radius * 2.5) / 115) * z * (168 / rect.h)
        : Math.max(0.68, (e.radius * 2.5) / 115) * z;

    this.drawSprite(ctx, spriteId, sx, sy - (e.isBoss ? Math.sin(timeSec * 4) * 5 * z : 0), scale * flip, scale);

    if (settings.hitFlash && e.hitFlashTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(sx, sy - 46 * z, e.radius * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!e.isBoss && (e.hp < e.maxHp || e.armor > 0) && e.archetype !== 'rattlebones_dummy') {
      const bw = 54 * z;
      const bh = 6.5 * z;
      const bx = sx - bw * 0.5;
      const by = sy - 98 * z;
      ctx.fillStyle = INK_HEX;
      ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#EB2F42';
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / Math.max(1, e.maxHp)), bh);
      if (e.armor > 0 && e.maxArmor > 0) {
        ctx.fillStyle = '#FFCB38';
        ctx.fillRect(bx, by - 5 * z, bw * Math.max(0, e.armor / e.maxArmor), 3.5 * z);
      }
    }
  }

  private drawProjectile(
    ctx: CanvasRenderingContext2D,
    pr: ProjectileState,
    obstacles: readonly ArenaObstacle[],
    cam: CameraView,
    timeSec: number
  ): void {
    const z = cam.zoom;
    const sx = this.wxToSx(pr.pos.x, cam);
    const sy = this.wyToSy(pr.pos.y, 20, cam);

    if (pr.kind === 'beam' || pr.kind === 'laser') {
      const c = Math.cos(pr.angle);
      const s = Math.sin(pr.angle);
      let ox: number;
      let oy: number;
      let rawLen: number;
      if (pr.kind === 'beam') {
        const startOffset = pr.targetPos ? 0 : 28;
        ox = pr.startPos.x + c * startOffset;
        oy = pr.startPos.y + s * startOffset;
        rawLen = pr.targetPos
          ? Math.min(pr.range, Math.hypot(pr.targetPos.x - ox, pr.targetPos.y - oy))
          : Math.min(pr.range, 920);
      } else {
        const dx = pr.pos.x - pr.startPos.x;
        const dy = pr.pos.y - pr.startPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 4 && this.clipRayToObstacles(obstacles, pr.startPos.x, pr.startPos.y, dx / dist, dy / dist, dist) < dist - 1) {
          return;
        }
        ox = pr.pos.x;
        oy = pr.pos.y;
        rawLen = Math.min(pr.range, 480);
      }
      const len = this.clipRayToObstacles(obstacles, ox, oy, c, s, Math.max(0, rawLen));
      const x0 = this.wxToSx(ox, cam);
      const y0 = this.wyToSy(oy, 24, cam);
      const x1 = this.wxToSx(ox + c * len, cam);
      const y1 = this.wyToSy(oy + s * len, 24, cam);
      const pulse = 1 + 0.14 * Math.sin(timeSec * 42 + pr.angle * 3.1);
      const baseW = Math.max(12, pr.radius) * z;
      const beamCol = pr.patronId ? PATRON_CONSTANTS[pr.patronId].colorHex : pr.colorHex || '#FF2A42';

      ctx.save();
      ctx.lineCap = 'round';
      // Layer 1: Wide additive bloom aura
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.34;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = beamCol;
      ctx.lineWidth = baseW * 2.6 * pulse;
      ctx.stroke();
      ctx.restore();

      // Layer 2: Pulsing #09060E ink sheath
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = INK_HEX;
      ctx.lineWidth = baseW * 1.66 * pulse;
      ctx.stroke();
      // Layer 3: High-energy plasma body
      ctx.strokeStyle = beamCol;
      ctx.lineWidth = baseW * 1.12 * pulse;
      ctx.stroke();
      // Layer 4: Blinding pure white laser core
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = baseW * 0.42 * pulse;
      ctx.stroke();

      // Emitter ring + blazing impact starburst
      ctx.beginPath();
      ctx.ellipse(x0, y0, baseW * pulse, baseW * 0.76 * pulse, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFF7DE';
      ctx.lineWidth = 3 * z;
      ctx.stroke();
      ctx.restore();

      const impactSprite = this.resolveSprite('vfx_hit_spark', 'vfx_spark_burst');
      const spSc = this.spriteScaleForMaxDim(impactSprite, 74 * z * pulse);
      this.drawSprite(ctx, impactSprite, x1, y1, spSc, spSc, timeSec * 14);
    } else if (pr.kind === 'cast') {
      const sc = this.spriteScaleForMaxDim('vfx_bloodstone', 40 * z);
      this.drawSprite(ctx, 'vfx_bloodstone', sx, sy, sc, sc, pr.angle);
    } else if (pr.kind === 'arrow' || pr.kind === 'dart' || pr.kind === 'bullet' || pr.kind === 'spear') {
      const sc = this.spriteScaleForMaxDim('vfx_projectile_arrow', 72 * z);
      this.drawSprite(ctx, 'vfx_projectile_arrow', sx, sy, sc, sc, pr.angle);
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(7, pr.radius) * z, 0, Math.PI * 2);
      ctx.fillStyle = pr.deflected ? '#6CF4FF' : pr.colorHex || (pr.owner === 'player' ? '#FF5442' : '#FF3860');
      ctx.fill();
      ctx.strokeStyle = INK_HEX;
      ctx.lineWidth = 2.5 * z;
      ctx.stroke();
    }
    this.drawCalls++;
  }

  private drawSlashRibbons(ctx: CanvasRenderingContext2D, vfx: ParticlesAndDecals, cam: CameraView): void {
    for (let i = 0; i < MAX_SLASH_RIBBONS; i++) {
      const rb = vfx.ribbons[i];
      if (!rb.active) continue;
      this.drawSingleRibbon2D(ctx, rb, cam);
    }
  }

  /**
   * 3-Layer Sweeping Tapered Comic Crescent Slash Smear (Canvas2D parity!)
   */
  private drawSingleRibbon2D(ctx: CanvasRenderingContext2D, rb: SlashRibbon, cam: CameraView): void {
    const z = cam.zoom;
    const prog = 1 - Math.max(0, Math.min(1, rb.life / Math.max(0.001, rb.maxLife)));
    const alpha = Math.pow(1 - prog, 0.64);
    const sx = this.wxToSx(rb.x, cam);
    const sy = this.wyToSy(rb.y, 26, cam);
    const col = `rgba(${Math.round(rb.r * 255)}, ${Math.round(rb.g * 255)}, ${Math.round(rb.b * 255)}, ${alpha})`;
    const core = `rgba(255, 249, 224, ${alpha})`;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, cam.isoScaleY);

    if (rb.kind === 'nova' || rb.kind === 'whip') {
      const rad = rb.radius * (0.35 + 0.78 * Math.pow(prog, 0.44)) * z;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.strokeStyle = INK_HEX;
      ctx.lineWidth = (rb.thickness * 0.8 + 10) * z;
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = rb.thickness * 0.68 * z;
      ctx.stroke();
      ctx.strokeStyle = core;
      ctx.lineWidth = rb.thickness * 0.22 * z;
      ctx.stroke();
    } else {
      // Tapered filled comic crescent (outer arc + inner offset arc)
      const sweepHead = Math.min(1, prog * 2.9);
      const sweepTail = Math.max(0, (prog - 0.14) * 1.18);
      const visualArc = rb.arcSpan * 1.35;
      const startA = rb.angle - visualArc * 0.5 * rb.flip;
      const endA = rb.angle + visualArc * 0.5 * rb.flip;
      const rad = rb.radius * 0.72 * z;
      const maxThick = Math.max(58, rb.thickness * 1.44) * z * (1 - prog * 0.3);
      const segs = 16;

      const traceCrescent = (outerPad: number, thickScale: number) => {
        ctx.beginPath();
        for (let s = 0; s <= segs; s++) {
          const u = s / segs;
          const t = sweepTail + (sweepHead - sweepTail) * u;
          const a = startA + (endA - startA) * t;
          const taper = Math.pow(Math.sin(u * Math.PI), 0.85) * (0.28 + 0.88 * Math.pow(u, 0.7));
          const rOut = rad + outerPad * taper * z;
          const x = Math.cos(a) * rOut;
          const y = Math.sin(a) * rOut;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let s = segs; s >= 0; s--) {
          const u = s / segs;
          const t = sweepTail + (sweepHead - sweepTail) * u;
          const a = startA + (endA - startA) * t;
          const taper = Math.pow(Math.sin(u * Math.PI), 0.85) * (0.28 + 0.88 * Math.pow(u, 0.7));
          const rIn = Math.max(10 * z, rad - maxThick * thickScale * taper);
          ctx.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
        }
        ctx.closePath();
      };

      // Layer 1: Bold #09060E tapered ink casing
      traceCrescent(10, 1.16);
      ctx.fillStyle = `rgba(9, 6, 14, ${alpha * 0.96})`;
      ctx.fill();
      // Layer 2: Saturated Patron crescent body
      traceCrescent(2, 1.0);
      ctx.fillStyle = col;
      ctx.fill();
      // Layer 3: Blazing white-gold leading blade filament
      traceCrescent(1.5, 0.22);
      ctx.fillStyle = core;
      ctx.fill();
    }

    ctx.restore();
    this.drawCalls++;
  }

  private drawParticles(ctx: CanvasRenderingContext2D, vfx: ParticlesAndDecals, cam: CameraView): void {
    const z = cam.zoom;
    ctx.save();
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = vfx.particles[i];
      if (!p.active) continue;
      const t = 1 - p.life / Math.max(0.001, p.maxLife);
      const sz = (p.size + (p.endSize - p.size) * t) * z;
      const sx = this.wxToSx(p.x, cam);
      const sy = this.wyToSy(p.y, p.z, cam);
      const alpha = p.alpha * (1 - t);
      ctx.globalCompositeOperation = p.emissive > 1.1 ? 'lighter' : 'source-over';
      const fillCol = `rgba(${Math.round(p.r * 255)}, ${Math.round(p.g * 255)}, ${Math.round(p.b * 255)}, ${alpha})`;

      if (p.kind === 'shockwave' || p.kind === 'deflect_ring') {
        ctx.strokeStyle = fillCol;
        ctx.lineWidth = 4 * z;
        ctx.beginPath();
        ctx.ellipse(sx, sy, sz, sz * cam.isoScaleY, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'spark_streak') {
        // Directional razor-sharp comic spark dart
        const c = Math.cos(p.angle);
        const s = Math.sin(p.angle);
        ctx.strokeStyle = fillCol;
        ctx.lineWidth = Math.max(1.8, sz * 0.16);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx - c * sz * 0.85, sy - s * sz * 0.55);
        ctx.lineTo(sx + c * sz * 0.85, sy + s * sz * 0.55);
        ctx.stroke();
      } else if (p.kind === 'impact_burst') {
        const sp = this.resolveSprite('vfx_hit_spark', 'vfx_spark_burst');
        const sc = this.spriteScaleForMaxDim(sp, sz * 1.55);
        this.drawSprite(ctx, sp, sx, sy, sc, sc, p.angle, alpha);
      } else {
        ctx.fillStyle = fillCol;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, sz * 0.38), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    this.drawCalls++;
  }

  private drawAdditiveLightsAndCones(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    prevState: SimState | null,
    theme: BiomeTheme2D,
    cam: CameraView,
    timeSec: number
  ): void {
    const z = cam.zoom;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Boosted flickering braziers (190-240px world pools)
    for (let i = 0; i < this.braziers.length; i++) {
      const br = this.braziers[i];
      const sx = this.wxToSx(br.x, cam);
      const sy = this.wyToSy(br.y, 26, cam);
      const flick = 0.88 + 0.08 * Math.sin(timeSec * 11.3 + i * 2.1) + 0.04 * Math.sin(timeSec * 27.1 + i * 4.3);
      const rad = 220 * z * flick;
      const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, rad);
      g.addColorStop(0, theme.brazierRgba);
      g.addColorStop(1, theme.brazierFadeRgba);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Wall sconce volumetric diagonal light cones
    for (let i = 0; i < this.wallSconces.length; i++) {
      const sc = this.wallSconces[i];
      const sx = this.wxToSx(sc.x, cam);
      const sy = this.wyToSy(sc.y, 36, cam);
      const cg = ctx.createLinearGradient(sx, sy, sx + 30 * z, sy + 132 * z);
      cg.addColorStop(0, 'rgba(255, 168, 76, 0.16)');
      cg.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(sx - 12 * z, sy);
      ctx.lineTo(sx + 12 * z, sy);
      ctx.lineTo(sx + 84 * z, sy + 132 * z);
      ctx.lineTo(sx - 24 * z, sy + 132 * z);
      ctx.closePath();
      ctx.fill();
    }

    const hp = this.interpPos(state.player.pos, prevState?.player.pos ?? null, cam.interpAlpha);
    const hx = this.wxToSx(hp.x, cam);
    const hy = this.wyToSy(hp.y, 20, cam);
    const hRad = 135 * z;
    const hg = ctx.createRadialGradient(hx, hy, 4, hx, hy, hRad);
    hg.addColorStop(0, 'rgba(255, 120, 62, 0.24)');
    hg.addColorStop(1, 'rgba(255, 60, 20, 0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(hx, hy, hRad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.drawCalls += 3;
  }

  private drawPostOverlay(
    ctx: CanvasRenderingContext2D,
    vfx: ParticlesAndDecals,
    cam: CameraView,
    settings: RenderSettings
  ): void {
    // Expanding radial shockwave ring fallback
    if (vfx.shockwaveActive && vfx.shockwaveAmp > 0.0005) {
      const cx = vfx.shockwaveHasWorld ? this.wxToSx(vfx.shockwaveWorldX, cam) : this.viewW * 0.5;
      const cy = vfx.shockwaveHasWorld ? this.wyToSy(vfx.shockwaveWorldY, 20, cam) : this.viewH * 0.5;
      const rad = vfx.shockwaveRadius * Math.max(this.viewW, this.viewH) * 0.65;
      const a = Math.min(0.65, vfx.shockwaveAmp * 26);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${Math.round(vfx.shockwaveR * 255)}, ${Math.round(vfx.shockwaveG * 255)}, ${Math.round(vfx.shockwaveB * 255)}, ${a})`;
      ctx.lineWidth = Math.max(3, 18 * (vfx.shockwaveAmp / 0.028));
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Subtle chromatic edge snap fallback
    if (vfx.chromaticAmount > 0.001) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 224, 110, ${Math.min(0.32, vfx.chromaticAmount * 22)})`;
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, this.viewW - 8, this.viewH - 8);
      ctx.restore();
    }

    const vig = ctx.createRadialGradient(
      this.viewW * 0.5,
      this.viewH * 0.5,
      this.viewH * 0.25,
      this.viewW * 0.5,
      this.viewH * 0.5,
      Math.hypot(this.viewW, this.viewH) * 0.62
    );
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(9, 6, 14, 0.54)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (settings.hitFlash && vfx.hitFlashPulse > 0.01) {
      ctx.fillStyle = `rgba(255, 28, 42, ${vfx.hitFlashPulse * 0.26})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    if (vfx.deathDefiancePulse > 0.01) {
      ctx.fillStyle = `rgba(255, 210, 140, ${vfx.deathDefiancePulse * 0.22})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
  }

  private interpPos(
    cur: { x: number; y: number },
    prev: { x: number; y: number } | null,
    alpha: number
  ): { x: number; y: number } {
    if (!prev || alpha >= 0.999) return cur;
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    if (dx * dx + dy * dy > 220 * 220) return cur;
    return { x: prev.x + dx * alpha, y: prev.y + dy * alpha };
  }

  private selectHeroPose(angle: number): string {
    const s = Math.sin(angle);
    const c = Math.abs(Math.cos(angle));
    if (s < -0.78) return 'hero_up';
    if (s > 0.78) return 'hero_down';
    if (c > 0.85) return 'hero_side';
    return s < 0 ? 'hero_diag_up' : 'hero_diag_down';
  }

  public dispose(): void {
    // Canvas2D context requires no manual GPU frees
  }
}
