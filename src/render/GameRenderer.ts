/**
 * GameRenderer — Unified Rendering Facade for Krunked WannabeHades.
 *
 * Automatically initializes the 6-pass WebGL2 Supergiant Ink-Cel pipeline and
 * gracefully falls back to Canvas2DInkCelRenderer if WebGL2 is unavailable.
 * Guarantees exact inverse camera/isometric math for laser-precise `screenToWorld`
 * aiming, smooth `interpAlpha` interpolation (with `classicSnap60Hz` toggle),
 * cached comic-ink Patron portrait URLs, and live `RenderStats`.
 */

import type { PatronId, RenderSettings, SimEvent, SimState, Vec2 } from '../contracts/index.js';
import { SIM_CONSTANTS } from '../contracts/index.js';
import { bakeProceduralInkCelAtlas } from '../assets/ProceduralInkCelAtlas.js';
import { bakeProceduralFontAtlas } from '../assets/ProceduralFonts.js';
import { getPatronPortraitDataUrl as getCachedPatronPortraitDataUrl } from '../assets/ProceduralPortraits.js';
import { ParticlesAndDecals } from './ParticlesAndDecals.js';
import { WebGL2InkCelRenderer } from './WebGL2InkCelRenderer.js';
import { Canvas2DInkCelRenderer } from './Canvas2DInkCelRenderer.js';

export interface RenderStats {
  backend: 'webgl2' | 'canvas2d';
  fps: number;
  drawCalls: number;
  particleCount: number;
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

export class GameRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private backend: RenderBackend | null = null;
  private readonly vfx = new ParticlesAndDecals();

  private viewW = 1280;
  private viewH = 720;
  private dpr = 1;

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
    const fontAtlas = bakeProceduralFontAtlas();

    const glBackend = WebGL2InkCelRenderer.tryCreate(canvas, atlas, fontAtlas);
    if (glBackend) {
      this.backend = glBackend;
    } else {
      this.backend = new Canvas2DInkCelRenderer(canvas, atlas);
    }

    const rect = canvas.getBoundingClientRect();
    const initW = rect.width > 0 ? rect.width : window.innerWidth || 1280;
    const initH = rect.height > 0 ? rect.height : window.innerHeight || 720;
    const initDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.resize(initW, initH, initDpr);
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

  public consumeEvents(events: readonly SimEvent[], state: SimState): void {
    if (events.length === 0) return;
    this.vfx.consumeEvents(events, state);
  }

  private computeEffectiveZoom(state: SimState, prevState: SimState | null, alpha: number): number {
    const curZoom = state.camera.zoom > 0.05 ? state.camera.zoom : state.room.zoom > 0.05 ? state.room.zoom : 0.85;
    const prevZoom =
      prevState && prevState.camera.zoom > 0.05 ? prevState.camera.zoom : curZoom;
    const baseZoom = prevState ? prevZoom + (curZoom - prevZoom) * alpha : curZoom;
    const viewportScale = Math.max(
      0.55,
      Math.min(1.5, Math.min(this.viewW / 1280, this.viewH / 720))
    );
    return baseZoom * viewportScale;
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

    this.cameraView.camX = camX;
    this.cameraView.camY = camY;
    this.cameraView.shakeX = settings?.screenShake ? state.camera.shakeX : 0;
    this.cameraView.shakeY = settings?.screenShake ? state.camera.shakeY : 0;
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
   * Exact inverse of camera zoom, camera center, screen center, and 2:1 isometric
   * projection (`SIM_CONSTANTS.isoScaleY = 0.56`) so mouse aiming is laser-precise.
   */
  public screenToWorld(clientX: number, clientY: number, state: SimState): Vec2 {
    const rect = this.canvas?.getBoundingClientRect();
    const viewW = rect && rect.width > 0 ? rect.width : this.viewW;
    const viewH = rect && rect.height > 0 ? rect.height : this.viewH;
    const sx = rect ? clientX - rect.left : clientX;
    const sy = rect ? clientY - rect.top : clientY;

    const hasCamera = state.camera.zoom > 0.05;
    const camX = hasCamera ? state.camera.x : state.player.pos.x;
    const camY = hasCamera ? state.camera.y : state.player.pos.y;
    const baseZoom =
      state.camera.zoom > 0.05
        ? state.camera.zoom
        : state.room.zoom > 0.05
          ? state.room.zoom
          : 0.85;
    const viewportScale = Math.max(0.55, Math.min(1.5, Math.min(viewW / 1280, viewH / 720)));
    const zoom = Math.max(0.05, baseZoom * viewportScale);

    return {
      x: camX + (sx - viewW * 0.5) / zoom,
      y: camY + (sy - viewH * 0.5) / (zoom * SIM_CONSTANTS.isoScaleY),
    };
  }

  public getPatronPortraitDataUrl(patronId: PatronId): string {
    return getCachedPatronPortraitDataUrl(patronId);
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
    this.canvas = null;
  }
}
