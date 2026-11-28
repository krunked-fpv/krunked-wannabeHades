/**
 * GameRenderer — Unified Rendering Facade for Krunked WannabeHades.
 *
 * Automatically initializes the 7-pass WebGL2 Mythic Ink-Cel pipeline and
 * gracefully falls back to Canvas2DInkCelRenderer if WebGL2 is unavailable.
 * Guarantees exact inverse camera/isometric/feel-offset math for laser-precise
 * `screenToWorld` aiming, smooth `interpAlpha` interpolation (`classicSnap60Hz`
 * toggle), live `BUILTIN <-> CUSTOM_PACK` sprite override swapping, async WOFF2
 * font atlas re-baking (`rebakeFontAtlas`), cosmetic camera feel offsets
 * (`setCameraFeelOffset`), Pass 6 post-FX impulses (`triggerScreenFx`), cached
 * comic-ink Patron portrait URLs, and live `RenderStats`.
 */

import type { BiomeId, PatronId, RenderSettings, SimEvent, SimState, Vec2 } from '../contracts/index.js';
import { SIM_CONSTANTS } from '../contracts/index.js';
import type { BakedAtlas } from '../assets/ProceduralInkCelAtlas.js';
import {
  bakeProceduralInkCelAtlas,
  buildCompositeCustomAtlas,
} from '../assets/ProceduralInkCelAtlas.js';
import * as ProceduralFonts from '../assets/ProceduralFonts.js';
import type { BakedFontAtlas } from '../assets/ProceduralFonts.js';
import { getPatronPortraitDataUrl as getCachedPatronPortraitDataUrl } from '../assets/ProceduralPortraits.js';
import {
  getPaintedPortraitUrl,
  loadBuiltInPaintedArtPack,
  type BiomeSurfaceTextures,
} from '../assets/PaintedArtLoader.js';
import { ParticlesAndDecals } from './ParticlesAndDecals.js';
import { WebGL2InkCelRenderer } from './WebGL2InkCelRenderer.js';
import { Canvas2DInkCelRenderer } from './Canvas2DInkCelRenderer.js';

export interface RenderStats {
  backend: 'webgl2' | 'canvas2d';
  fps: number;
  drawCalls: number;
  particleCount: number;
}

export interface CustomPackSpriteRef {
  readonly image: CanvasImageSource;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Clean structural interface accepted by `GameRenderer.attachCustomPack(registry)`.
 * Keeps renderer 100% decoupled from AssetRegistry internals while enabling live
 * BUILTIN <-> CUSTOM_PACK sprite and portrait swapping!
 */
export interface CustomPackProvider {
  getPackMode(): 'BUILTIN' | 'CUSTOM_PACK';
  hasCustomPack(): boolean;
  getCustomSprite(cleanId: string): CustomPackSpriteRef | null;
  getCustomPortraitDataUrl?(patronId: PatronId): string | null;
  getCustomPortraitUrl?(patronId: PatronId): string | null;
}

// ============================================================================
// Cross-Module Camera Feel & Post-FX Contracts (Section 7.4)
// ============================================================================

export interface CameraFeelOffset {
  readonly offsetX: number; // World-space X offset (aim look-ahead + directional recoil)
  readonly offsetY: number; // World-space Y offset (aim look-ahead + directional recoil)
  readonly zoomMult: number; // Multiplicative zoom punch (default 1.0, clamped 0.96..1.09)
  readonly shakeX: number; // Extra cosmetic shake X (world px, scaled by settings.screenShake)
  readonly shakeY: number; // Extra cosmetic shake Y (world px, scaled by settings.screenShake)
}

export type ScreenFxKind =
  | 'chromatic'
  | 'shockwave'
  | 'crit_burst'
  | 'boss_phase'
  | 'greater_call'
  | 'death_defiance';

export interface ScreenFxImpulse {
  readonly kind: ScreenFxKind;
  readonly intensity: number; // 0..1 normalized strength
  readonly worldX?: number; // Optional world-space epicenter for radial shockwave
  readonly worldY?: number;
  readonly colorHex?: string; // Optional tint color hex
}

export interface GameRendererFeelHooks {
  setCameraFeelOffset(offset: CameraFeelOffset): void;
  triggerScreenFx(fx: ScreenFxImpulse): void;
  rebakeFontAtlas(): void;
}

export interface CameraView {
  camX: number;
  camY: number;
  shakeX: number;
  shakeY: number;
  zoom: number;
  isoScaleY: number;
  viewW: number;
  viewH: number;
  dpr: number;
  interpAlpha: number;
}

export interface RenderBackend {
  readonly kind: 'webgl2' | 'canvas2d';
  resize(width: number, height: number, dpr: number): void;
  setAtlasCanvas?(canvas: HTMLCanvasElement): void;
  setBiomeSurfaces?(surfaces: Partial<Record<BiomeId, BiomeSurfaceTextures>>): void;
  setFontAtlas?(fontAtlas: BakedFontAtlas): void;
  render(
    state: SimState,
    prevState: SimState | null,
    cam: CameraView,
    vfx: ParticlesAndDecals,
    settings: RenderSettings,
    nowMs: number
  ): number;
  dispose(): void;
}

function getBiomeFramingZoomBoost(biome: BiomeId): number {
  switch (biome) {
    case 'frozen_summit':
      return 1.11;
    case 'obsidian_pit':
      return 1.08;
    case 'cinder_mire':
    case 'verdant_colosseum':
    case 'crypt_of_bile':
    case 'sanctum_hub':
    default:
      return 1.06;
  }
}

export class GameRenderer implements GameRendererFeelHooks {
  private canvas: HTMLCanvasElement | null = null;
  private backend: RenderBackend | null = null;
  private baseAtlas: BakedAtlas | null = null;
  private paintedAtlasCanvas: HTMLCanvasElement | null = null;
  private biomeSurfaces: Partial<Record<BiomeId, BiomeSurfaceTextures>> | null = null;
  private paintedArtLoaded = false;
  private customPack: CustomPackProvider | null = null;
  private customCompositeCanvas: HTMLCanvasElement | null = null;
  private activePackMode: 'BUILTIN' | 'CUSTOM_PACK' = 'BUILTIN';
  private customPackDirty = false;

  private readonly vfx = new ParticlesAndDecals();

  private viewW = 1280;
  private viewH = 720;
  private dpr = 1;

  // Pre-allocated mutable presentation-layer camera feel offsets (zero GC!)
  private readonly feelOffset = {
    offsetX: 0,
    offsetY: 0,
    zoomMult: 1,
    shakeX: 0,
    shakeY: 0,
  };

  // Reusable CameraView struct (zero per-frame allocations)
  private readonly cameraView: CameraView = {
    camX: 0,
    camY: 0,
    shakeX: 0,
    shakeY: 0,
    zoom: 0.85,
    isoScaleY: SIM_CONSTANTS.isoScaleY,
    viewW: 1280,
    viewH: 720,
    dpr: 1,
    interpAlpha: 1,
  };

  // Frame pacing / FPS telemetry
  private lastRenderMs = 0;
  private fpsEma = 60;
  private lastDrawCalls = 0;

  public init(canvas: HTMLCanvasElement): void {
    this.dispose();
    this.canvas = canvas;

    const atlas = bakeProceduralInkCelAtlas();
    const fontAtlas = ProceduralFonts.bakeProceduralFontAtlas();
    this.baseAtlas = atlas;

    const glBackend = WebGL2InkCelRenderer.tryCreate(canvas, atlas, fontAtlas);
    if (glBackend) {
      this.backend = glBackend;
    } else {
      const c2d = new Canvas2DInkCelRenderer(canvas, atlas);
      c2d.setFontAtlas(fontAtlas);
      this.backend = c2d;
    }

    if (this.customPack) {
      this.customPackDirty = true;
      this.syncAtlasPackMode(this.customPack.getPackMode());
    }

    // Asynchronously load the shipped hand-painted WebP art pack and hot-swap onto GPU!
    const currentBackend = this.backend;
    void loadBuiltInPaintedArtPack(atlas).then((pack) => {
      if (!pack || this.backend !== currentBackend || !this.backend) {
        return;
      }
      this.paintedAtlasCanvas = pack.compositeAtlasCanvas;
      this.biomeSurfaces = pack.biomeSurfaces;
      this.paintedArtLoaded = true;
      this.customCompositeCanvas = null; // Rebuild custom pack over painted base if toggled later
      this.backend.setBiomeSurfaces?.(pack.biomeSurfaces);
      if (this.activePackMode === 'BUILTIN') {
        this.backend.setAtlasCanvas?.(pack.compositeAtlasCanvas);
      } else {
        this.customPackDirty = true;
        this.syncAtlasPackMode(this.activePackMode);
      }
    });

    const rect = canvas.getBoundingClientRect();
    const initW = rect.width > 0 ? rect.width : window.innerWidth || 1280;
    const initH = rect.height > 0 ? rect.height : window.innerHeight || 720;
    const initDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.resize(initW, initH, initDpr);
  }

  /**
   * Attaches (or clears) an optional Custom Pack AssetRegistry so toggling
   * `BUILTIN` <-> `CUSTOM_PACK` hot-swaps sprites live without breaking Built-In fallback!
   */
  public attachCustomPack(registry: CustomPackProvider | null): void {
    this.customPack = registry;
    this.customCompositeCanvas = null;
    this.customPackDirty = true;
    if (registry) {
      this.syncAtlasPackMode(registry.getPackMode());
    } else {
      this.syncAtlasPackMode('BUILTIN');
    }
  }

  private syncAtlasPackMode(desiredMode: 'BUILTIN' | 'CUSTOM_PACK'): void {
    if (!this.backend || !this.baseAtlas) return;
    const useCustom =
      desiredMode === 'CUSTOM_PACK' &&
      this.customPack !== null &&
      this.customPack.hasCustomPack();
    const targetMode: 'BUILTIN' | 'CUSTOM_PACK' = useCustom ? 'CUSTOM_PACK' : 'BUILTIN';

    if (targetMode === this.activePackMode && !this.customPackDirty) {
      return;
    }

    this.activePackMode = targetMode;
    this.customPackDirty = false;

    if (targetMode === 'CUSTOM_PACK' && this.customPack) {
      if (!this.customCompositeCanvas) {
        const effectiveBase: BakedAtlas = this.paintedAtlasCanvas
          ? { ...this.baseAtlas, canvas: this.paintedAtlasCanvas }
          : this.baseAtlas;
        const res = buildCompositeCustomAtlas(effectiveBase, this.customPack);
        this.customCompositeCanvas = res.canvas;
      }
      this.backend.setAtlasCanvas?.(this.customCompositeCanvas);
    } else {
      this.backend.setAtlasCanvas?.(this.paintedAtlasCanvas ?? this.baseAtlas.canvas);
    }
  }

  public resize(width: number, height: number, dpr: number): void {
    this.viewW = Math.max(1, Math.floor(width));
    this.viewH = Math.max(1, Math.floor(height));
    this.dpr = Math.max(1, Math.min(2, dpr || 1));
    this.cameraView.viewW = this.viewW;
    this.cameraView.viewH = this.viewH;
    this.cameraView.dpr = this.dpr;
    if (this.backend) {
      this.backend.resize(this.viewW, this.viewH, this.dpr);
    }
  }

  public setCameraFeelOffset(offset: CameraFeelOffset): void {
    this.feelOffset.offsetX = Number.isFinite(offset.offsetX) ? offset.offsetX : 0;
    this.feelOffset.offsetY = Number.isFinite(offset.offsetY) ? offset.offsetY : 0;
    const rawZoom = Number.isFinite(offset.zoomMult) && offset.zoomMult > 0 ? offset.zoomMult : 1;
    this.feelOffset.zoomMult = Math.max(0.78, Math.min(1.12, rawZoom));
    this.feelOffset.shakeX = Number.isFinite(offset.shakeX) ? offset.shakeX : 0;
    this.feelOffset.shakeY = Number.isFinite(offset.shakeY) ? offset.shakeY : 0;
  }

  public triggerScreenFx(fx: ScreenFxImpulse): void {
    this.vfx.triggerScreenFx(fx);
  }

  public rebakeFontAtlas(): void {
    const fontsModule = ProceduralFonts as typeof ProceduralFonts & {
      rebakeProceduralFontAtlas?: () => BakedFontAtlas;
    };
    const freshFontAtlas =
      fontsModule.rebakeProceduralFontAtlas?.() ?? ProceduralFonts.bakeProceduralFontAtlas();
    this.backend?.setFontAtlas?.(freshFontAtlas);
  }

  public consumeEvents(events: readonly SimEvent[], state: SimState): void {
    if (events.length === 0) return;
    this.vfx.consumeEvents(events, state);
  }

  private computeEffectiveZoom(
    state: SimState,
    prevState: SimState | null,
    alpha: number,
    viewW = this.viewW,
    viewH = this.viewH
  ): number {
    const curZoom =
      state.camera.zoom > 0.05 ? state.camera.zoom : state.room.zoom > 0.05 ? state.room.zoom : 0.85;
    const prevZoom = prevState && prevState.camera.zoom > 0.05 ? prevState.camera.zoom : curZoom;
    const baseZoom = prevState ? prevZoom + (curZoom - prevZoom) * alpha : curZoom;
    const viewportScale = Math.max(0.55, Math.min(1.5, Math.min(viewW / 1280, viewH / 720)));
    const framingBoost = getBiomeFramingZoomBoost(state.room.biome);
    return Math.max(0.05, baseZoom * viewportScale * framingBoost * this.feelOffset.zoomMult);
  }

  private updateCameraView(
    state: SimState,
    prevState: SimState | null,
    interpAlpha: number,
    settings: RenderSettings | null
  ): void {
    const alpha = settings?.classicSnap60Hz ? 1 : Math.max(0, Math.min(1, interpAlpha));

    const hasCamera = state.camera.zoom > 0.05;
    const curX = hasCamera ? state.camera.x : state.player.pos.x;
    const curY = hasCamera ? state.camera.y : state.player.pos.y;

    let camX = curX;
    let camY = curY;
    if (prevState && alpha < 0.999) {
      const prevHasCam = prevState.camera.zoom > 0.05;
      const px = prevHasCam ? prevState.camera.x : prevState.player.pos.x;
      const py = prevHasCam ? prevState.camera.y : prevState.player.pos.y;
      const dx = curX - px;
      const dy = curY - py;
      if (dx * dx + dy * dy < 320 * 320) {
        camX = px + dx * alpha;
        camY = py + dy * alpha;
      }
    }

    this.cameraView.camX = camX + this.feelOffset.offsetX;
    this.cameraView.camY = camY + this.feelOffset.offsetY;
    this.cameraView.shakeX = (settings?.screenShake ? state.camera.shakeX : 0) + this.feelOffset.shakeX;
    this.cameraView.shakeY = (settings?.screenShake ? state.camera.shakeY : 0) + this.feelOffset.shakeY;
    this.cameraView.zoom = this.computeEffectiveZoom(state, prevState, alpha);
    this.cameraView.isoScaleY = SIM_CONSTANTS.isoScaleY;
    this.cameraView.viewW = this.viewW;
    this.cameraView.viewH = this.viewH;
    this.cameraView.dpr = this.dpr;
    this.cameraView.interpAlpha = alpha;
  }

  public render(
    state: SimState,
    prevState: SimState | null,
    interpAlpha: number,
    settings: RenderSettings,
    nowMs: number
  ): void {
    if (!this.backend) return;

    this.syncAtlasPackMode(settings.packMode);

    const dtSec =
      this.lastRenderMs > 0
        ? Math.max(0.001, Math.min(0.1, (nowMs - this.lastRenderMs) * 0.001))
        : SIM_CONSTANTS.fixedDt;
    if (this.lastRenderMs > 0 && nowMs > this.lastRenderMs) {
      const instFps = 1000 / Math.max(1, nowMs - this.lastRenderMs);
      this.fpsEma = this.fpsEma * 0.9 + Math.min(240, instFps) * 0.1;
    }
    this.lastRenderMs = nowMs;

    // Advance cosmetic VFX & fiery footsteps cleanly respecting hitstop/slow-mo timeScale
    const vfxDt = state.run.paused ? 0 : dtSec * Math.max(0.15, state.timeScale);
    this.vfx.update(vfxDt, state);

    this.updateCameraView(state, prevState, interpAlpha, settings);
    this.lastDrawCalls = this.backend.render(
      state,
      prevState,
      this.cameraView,
      this.vfx,
      settings,
      nowMs
    );
  }

  /**
   * Exact inverse of camera zoom, framing boost, feel offset/zoom, screen center, and 2:1
   * isometric projection (`SIM_CONSTANTS.isoScaleY = 0.56`) so mouse aiming NEVER drifts!
   */
  public screenToWorld(clientX: number, clientY: number, state: SimState): Vec2 {
    const rect = this.canvas?.getBoundingClientRect();
    const viewW = rect && rect.width > 0 ? rect.width : this.viewW;
    const viewH = rect && rect.height > 0 ? rect.height : this.viewH;
    const sx = rect ? clientX - rect.left : clientX;
    const sy = rect ? clientY - rect.top : clientY;

    const hasCamera = state.camera.zoom > 0.05;
    const camX = (hasCamera ? state.camera.x : state.player.pos.x) + this.feelOffset.offsetX;
    const camY = (hasCamera ? state.camera.y : state.player.pos.y) + this.feelOffset.offsetY;
    const zoom = this.computeEffectiveZoom(state, null, 1, viewW, viewH);

    return {
      x: camX + (sx - viewW * 0.5) / zoom,
      y: camY + (sy - viewH * 0.5) / (zoom * SIM_CONSTANTS.isoScaleY),
    };
  }

  public getPatronPortraitDataUrl(patronId: PatronId): string {
    if (this.activePackMode === 'CUSTOM_PACK' && this.customPack) {
      const customUrl =
        this.customPack.getCustomPortraitDataUrl?.(patronId) ??
        this.customPack.getCustomPortraitUrl?.(patronId) ??
        null;
      if (customUrl) return customUrl;
    }
    if (typeof window !== 'undefined') {
      return getPaintedPortraitUrl(patronId);
    }
    return getCachedPatronPortraitDataUrl(patronId);
  }

  public isPaintedArtLoaded(): boolean {
    return this.paintedArtLoaded;
  }

  public getStats(): RenderStats {
    return {
      backend: this.backend?.kind ?? 'canvas2d',
      fps: Math.round(this.fpsEma),
      drawCalls: this.lastDrawCalls,
      particleCount:
        this.vfx.activeParticleCount + this.vfx.activeRibbonCount + this.vfx.activeDecalCount,
    };
  }

  public dispose(): void {
    if (this.backend) {
      this.backend.dispose();
      this.backend = null;
    }
    this.vfx.reset();
    this.feelOffset.offsetX = 0;
    this.feelOffset.offsetY = 0;
    this.feelOffset.zoomMult = 1;
    this.feelOffset.shakeX = 0;
    this.feelOffset.shakeY = 0;
    this.canvas = null;
  }
}
