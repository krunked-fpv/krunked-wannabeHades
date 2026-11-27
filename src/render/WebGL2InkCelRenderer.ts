/**
 * WebGL2InkCelRenderer — 6-Pass Mythic Ink-Cel WebGL2 Pipeline.
 *
 *   Pass 1: Deep Abyssal Chasm Parallax & Animated Underworld Mist (sceneFBO)
 *   Pass 2: Isometric Carved Stone Chamber, Cliff Drop, Greek Meander Trim, Pits,
 *           Floor Hazards, Persistent Decals, Telegraphs & Contact Shadows (sceneFBO)
 *   Pass 3: Y-Sorted Ink-Cel Props, Braziers, Exit Doors + Sigils, Pickups, Dash Ghosts,
 *           Enemies, Warden Malice, Prince Pyreus + Flowing Cloak + Weapon, Projectiles,
 *           Painterly Bezier Slash Ribbons & Particles (sceneFBO)
 *   Pass 4: Additive Dynamic Lightmap FBO (half-res flickering braziers, chasm rim, embers, boons)
 *   Pass 5: Dual-Pass Selective Bloom FBO (bright extract + separable H/V 9-tap Gaussian blur)
 *   Pass 6: Per-Biome Jewel-Tone Color Grading + Vignette + Hit-Flash / Death-Defiance Pulse
 *           + Crisp Pre-Baked Comic-Ink Floating Damage Numbers!
 */

import type {
  ArenaDoor,
  ArenaObstacle,
  BiomeId,
  BloodstoneDrop,
  EnemyState,
  HazardState,
  PickupItem,
  ProjectileState,
  RenderSettings,
  SimState,
  TelegraphShape,
} from '../contracts/index.js';
import { PATRON_CONSTANTS } from '../contracts/index.js';
import type { AtlasSpriteRect, BakedAtlas } from '../assets/ProceduralInkCelAtlas.js';
import {
  getBiomePillarSpriteId,
  getBiomeTileIds,
  getEnemySpriteId,
  getPatronSigilSpriteId,
  getPickupSpriteId,
  getWeaponSpriteId,
} from '../assets/ProceduralInkCelAtlas.js';
import type { BakedFontAtlas } from '../assets/ProceduralFonts.js';
import {
  formatFloatingNumberText,
  getDamageNumberStyle,
  hexToRgbaTuple,
} from '../assets/ProceduralFonts.js';
import type { ParticlesAndDecals, SlashRibbon } from './ParticlesAndDecals.js';
import { MAX_DECALS, MAX_PARTICLES, MAX_SLASH_RIBBONS } from './ParticlesAndDecals.js';
import {
  ABYSS_FRAG,
  BATCH_FRAG,
  BATCH_VERT,
  BLOOM_BLUR_FRAG,
  BLOOM_EXTRACT_FRAG,
  COMPOSITE_FRAG,
  FULLSCREEN_VERT,
  LIGHT_FRAG,
  LIGHT_VERT,
} from './shaders.js';
import type { CameraView, RenderBackend } from './GameRenderer.js';

interface BiomeVisualTheme {
  deep: [number, number, number];
  mid: [number, number, number];
  mist: [number, number, number];
  accent: [number, number, number];
  ambientLight: [number, number, number];
  shadowTint: [number, number, number];
  midtoneTint: [number, number, number];
  highlightTint: [number, number, number];
  brazierColor: [number, number, number];
  rimGlow: [number, number, number];
}

const BIOME_THEMES: Record<BiomeId, BiomeVisualTheme> = {
  sanctum_hub: {
    deep: [0.05, 0.03, 0.08],
    mid: [0.14, 0.07, 0.16],
    mist: [0.36, 0.14, 0.24],
    accent: [0.95, 0.56, 0.26],
    ambientLight: [0.24, 0.17, 0.28],
    shadowTint: [0.96, 0.88, 1.06],
    midtoneTint: [1.05, 0.98, 0.96],
    highlightTint: [1.1, 1.02, 0.92],
    brazierColor: [1.0, 0.58, 0.24],
    rimGlow: [0.92, 0.44, 0.28],
  },
  obsidian_pit: {
    deep: [0.03, 0.07, 0.08],
    mid: [0.06, 0.16, 0.15],
    mist: [0.11, 0.36, 0.29],
    accent: [0.28, 0.88, 0.62],
    ambientLight: [0.16, 0.27, 0.24],
    shadowTint: [0.88, 1.03, 1.02],
    midtoneTint: [0.98, 1.04, 1.0],
    highlightTint: [1.08, 1.05, 0.94],
    brazierColor: [1.0, 0.64, 0.24],
    rimGlow: [0.3, 0.9, 0.64],
  },
  cinder_mire: {
    deep: [0.09, 0.02, 0.02],
    mid: [0.24, 0.07, 0.04],
    mist: [0.68, 0.22, 0.08],
    accent: [1.0, 0.45, 0.15],
    ambientLight: [0.32, 0.16, 0.12],
    shadowTint: [1.08, 0.86, 0.84],
    midtoneTint: [1.08, 0.96, 0.88],
    highlightTint: [1.14, 1.02, 0.86],
    brazierColor: [1.0, 0.48, 0.16],
    rimGlow: [1.0, 0.42, 0.14],
  },
  verdant_colosseum: {
    deep: [0.03, 0.09, 0.13],
    mid: [0.07, 0.22, 0.27],
    mist: [0.16, 0.48, 0.52],
    accent: [0.38, 0.95, 0.9],
    ambientLight: [0.18, 0.3, 0.34],
    shadowTint: [0.86, 1.02, 1.08],
    midtoneTint: [0.96, 1.05, 1.04],
    highlightTint: [1.08, 1.08, 1.0],
    brazierColor: [0.44, 0.95, 1.0],
    rimGlow: [0.38, 0.96, 0.92],
  },
  crypt_of_bile: {
    deep: [0.05, 0.07, 0.03],
    mid: [0.14, 0.17, 0.07],
    mist: [0.35, 0.42, 0.12],
    accent: [0.68, 0.88, 0.22],
    ambientLight: [0.24, 0.26, 0.14],
    shadowTint: [0.96, 1.04, 0.84],
    midtoneTint: [1.02, 1.04, 0.9],
    highlightTint: [1.08, 1.08, 0.88],
    brazierColor: [0.84, 0.96, 0.26],
    rimGlow: [0.66, 0.86, 0.24],
  },
  frozen_summit: {
    deep: [0.04, 0.08, 0.14],
    mid: [0.12, 0.2, 0.3],
    mist: [0.35, 0.52, 0.68],
    accent: [0.76, 0.92, 1.0],
    ambientLight: [0.24, 0.31, 0.4],
    shadowTint: [0.88, 0.96, 1.12],
    midtoneTint: [0.96, 1.02, 1.08],
    highlightTint: [1.05, 1.08, 1.14],
    brazierColor: [1.0, 0.68, 0.32],
    rimGlow: [0.7, 0.9, 1.0],
  },
};

interface FboTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

type SortItemKind =
  | 'obstacle'
  | 'brazier'
  | 'door'
  | 'pickup'
  | 'bloodstone'
  | 'enemy'
  | 'hero'
  | 'projectile';

interface SortItem {
  kind: SortItemKind;
  sortY: number;
  idx: number;
  x: number;
  y: number;
}

const MAX_BATCH_VERTS = 48000; // 16,000 triangles per flush
const FLOATS_PER_VERT = 10; // x, y, u, v, r, g, b, a, flashWhite, emissiveBoost
const MAX_LIGHTS = 128;
const FLOATS_PER_LIGHT_VERT = 8; // x, y, lx, ly, r, g, b, intensity
const MAX_SORT_ITEMS = 512;

export class WebGL2InkCelRenderer implements RenderBackend {
  public readonly kind = 'webgl2' as const;

  private readonly gl: WebGL2RenderingContext;
  private readonly atlas: BakedAtlas;
  private readonly fontAtlas: BakedFontAtlas;
  private readonly whiteRect: AtlasSpriteRect;

  private atlasTex: WebGLTexture;
  private fontTex: WebGLTexture;

  private abyssProg: WebGLProgram;
  private batchProg: WebGLProgram;
  private lightProg: WebGLProgram;
  private bloomExtractProg: WebGLProgram;
  private bloomBlurProg: WebGLProgram;
  private compositeProg: WebGLProgram;

  private emptyVao: WebGLVertexArrayObject;
  private batchVao: WebGLVertexArrayObject;
  private batchVbo: WebGLBuffer;
  private readonly batchData: Float32Array;
  private batchVertCount = 0;

  private lightVao: WebGLVertexArrayObject;
  private lightVbo: WebGLBuffer;
  private readonly lightData: Float32Array;
  private lightVertCount = 0;

  private sceneFbo: FboTarget | null = null;
  private lightFbo: FboTarget | null = null;
  private bloomFboA: FboTarget | null = null;
  private bloomFboB: FboTarget | null = null;

  private fbW = 1;
  private fbH = 1;
  private viewW = 1;
  private viewH = 1;
  private dpr = 1;
  private drawCalls = 0;
  private activeTexture: WebGLTexture | null = null;
  private currentBlend: 'alpha' | 'additive' = 'alpha';
  private contextLost = false;

  // Pre-allocated Y-sort pool (zero per-frame allocations!)
  private readonly sortPool: SortItem[];
  private sortCount = 0;
  private readonly braziers: { x: number; y: number }[] = [];
  private lastBrazierBoundsKey = '';

  // Cached uniform locations
  private readonly uAbyss: Record<string, WebGLUniformLocation | null>;
  private readonly uBatch: Record<string, WebGLUniformLocation | null>;
  private readonly uLight: Record<string, WebGLUniformLocation | null>;
  private readonly uBloomExtract: Record<string, WebGLUniformLocation | null>;
  private readonly uBloomBlur: Record<string, WebGLUniformLocation | null>;
  private readonly uComposite: Record<string, WebGLUniformLocation | null>;

  private constructor(
    gl: WebGL2RenderingContext,
    atlas: BakedAtlas,
    fontAtlas: BakedFontAtlas
  ) {
    this.gl = gl;
    this.atlas = atlas;
    this.fontAtlas = fontAtlas;
    const wr = atlas.sprites.get('white_pixel');
    if (!wr) throw new Error('WebGL2InkCelRenderer: white_pixel missing from atlas');
    this.whiteRect = wr;

    // Compile all 6-pass programs
    this.abyssProg = this.createProgram(FULLSCREEN_VERT, ABYSS_FRAG);
    this.batchProg = this.createProgram(BATCH_VERT, BATCH_FRAG);
    this.lightProg = this.createProgram(LIGHT_VERT, LIGHT_FRAG);
    this.bloomExtractProg = this.createProgram(FULLSCREEN_VERT, BLOOM_EXTRACT_FRAG);
    this.bloomBlurProg = this.createProgram(FULLSCREEN_VERT, BLOOM_BLUR_FRAG);
    this.compositeProg = this.createProgram(FULLSCREEN_VERT, COMPOSITE_FRAG);

    this.uAbyss = {
      uTime: gl.getUniformLocation(this.abyssProg, 'uTime'),
      uCamPos: gl.getUniformLocation(this.abyssProg, 'uCamPos'),
      uZoom: gl.getUniformLocation(this.abyssProg, 'uZoom'),
      uResolution: gl.getUniformLocation(this.abyssProg, 'uResolution'),
      uDeepColor: gl.getUniformLocation(this.abyssProg, 'uDeepColor'),
      uMidColor: gl.getUniformLocation(this.abyssProg, 'uMidColor'),
      uMistColor: gl.getUniformLocation(this.abyssProg, 'uMistColor'),
      uAccentColor: gl.getUniformLocation(this.abyssProg, 'uAccentColor'),
      uBiomeMode: gl.getUniformLocation(this.abyssProg, 'uBiomeMode'),
    };
    this.uBatch = {
      uResolution: gl.getUniformLocation(this.batchProg, 'uResolution'),
      uAtlas: gl.getUniformLocation(this.batchProg, 'uAtlas'),
    };
    this.uLight = {
      uResolution: gl.getUniformLocation(this.lightProg, 'uResolution'),
    };
    this.uBloomExtract = {
      uSceneTex: gl.getUniformLocation(this.bloomExtractProg, 'uSceneTex'),
      uLightTex: gl.getUniformLocation(this.bloomExtractProg, 'uLightTex'),
      uThreshold: gl.getUniformLocation(this.bloomExtractProg, 'uThreshold'),
      uKnee: gl.getUniformLocation(this.bloomExtractProg, 'uKnee'),
    };
    this.uBloomBlur = {
      uTex: gl.getUniformLocation(this.bloomBlurProg, 'uTex'),
      uTexelStep: gl.getUniformLocation(this.bloomBlurProg, 'uTexelStep'),
    };
    this.uComposite = {
      uSceneTex: gl.getUniformLocation(this.compositeProg, 'uSceneTex'),
      uLightTex: gl.getUniformLocation(this.compositeProg, 'uLightTex'),
      uBloomTex: gl.getUniformLocation(this.compositeProg, 'uBloomTex'),
      uShadowTint: gl.getUniformLocation(this.compositeProg, 'uShadowTint'),
      uMidtoneTint: gl.getUniformLocation(this.compositeProg, 'uMidtoneTint'),
      uHighlightTint: gl.getUniformLocation(this.compositeProg, 'uHighlightTint'),
      uBloomStrength: gl.getUniformLocation(this.compositeProg, 'uBloomStrength'),
      uVignetteStrength: gl.getUniformLocation(this.compositeProg, 'uVignetteStrength'),
      uHitFlash: gl.getUniformLocation(this.compositeProg, 'uHitFlash'),
      uDeathDefiance: gl.getUniformLocation(this.compositeProg, 'uDeathDefiance'),
      uFinalKillPulse: gl.getUniformLocation(this.compositeProg, 'uFinalKillPulse'),
    };

    // Upload pre-baked 2048x2048 Ink-Cel Atlas & Font Glyph Atlas ONCE
    this.atlasTex = this.uploadCanvasTexture(atlas.canvas);
    this.fontTex = this.uploadCanvasTexture(fontAtlas.canvas);

    // Fullscreen empty VAO
    const eVao = gl.createVertexArray();
    if (!eVao) throw new Error('WebGL2: failed to create VAO');
    this.emptyVao = eVao;

    // Sprite/ribbon dynamic batch VAO + VBO
    this.batchData = new Float32Array(MAX_BATCH_VERTS * FLOATS_PER_VERT);
    const bVao = gl.createVertexArray();
    const bVbo = gl.createBuffer();
    if (!bVao || !bVbo) throw new Error('WebGL2: failed to create batch VAO/VBO');
    this.batchVao = bVao;
    this.batchVbo = bVbo;
    gl.bindVertexArray(this.batchVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.batchVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.batchData.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS_PER_VERT * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 32);

    // Lightmap batch VAO + VBO
    this.lightData = new Float32Array(MAX_LIGHTS * 6 * FLOATS_PER_LIGHT_VERT);
    const lVao = gl.createVertexArray();
    const lVbo = gl.createBuffer();
    if (!lVao || !lVbo) throw new Error('WebGL2: failed to create light VAO/VBO');
    this.lightVao = lVao;
    this.lightVbo = lVbo;
    gl.bindVertexArray(this.lightVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lightVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.lightData.byteLength, gl.DYNAMIC_DRAW);
    const lStride = FLOATS_PER_LIGHT_VERT * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, lStride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, lStride, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, lStride, 16);

    gl.bindVertexArray(null);

    // Pre-allocate Y-sort items
    this.sortPool = new Array<SortItem>(MAX_SORT_ITEMS);
    for (let i = 0; i < MAX_SORT_ITEMS; i++) {
      this.sortPool[i] = { kind: 'hero', sortY: 0, idx: 0, x: 0, y: 0 };
    }

    gl.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    gl.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
    });
  }

  /**
   * Probes WebGL2 availability, shader compilation, and FBO completeness on a detached
   * 16x16 canvas FIRST so a failing driver/shader NEVER locks the live `#game-canvas`
   * out of Canvas2D fallback!
   */
  private static probeWebGL2Support(): { ok: true } | { ok: false; reason: string } {
    if (typeof document === 'undefined') {
      return { ok: false, reason: 'document unavailable' };
    }
    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = 16;
    probeCanvas.height = 16;
    const gl = probeCanvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      return { ok: false, reason: 'webgl2 context unavailable' };
    }

    const cleanup = () => {
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // Ignore loseContext cleanup errors
      }
    };

    try {
      const checkPair = (name: string, vsSrc: string, fsSrc: string) => {
        const vs = gl.createShader(gl.VERTEX_SHADER);
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        if (!vs || !fs) throw new Error(`${name}: createShader failed`);
        gl.shaderSource(vs, vsSrc);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
          throw new Error(`${name} VS: ${gl.getShaderInfoLog(vs) ?? 'compile failed'}`);
        }
        gl.shaderSource(fs, fsSrc);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
          throw new Error(`${name} FS: ${gl.getShaderInfoLog(fs) ?? 'compile failed'}`);
        }
        const prog = gl.createProgram();
        if (!prog) throw new Error(`${name}: createProgram failed`);
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          const log = gl.getProgramInfoLog(prog) ?? 'link failed';
          gl.deleteProgram(prog);
          throw new Error(`${name} link: ${log}`);
        }
        gl.deleteProgram(prog);
      };

      checkPair('abyss', FULLSCREEN_VERT, ABYSS_FRAG);
      checkPair('batch', BATCH_VERT, BATCH_FRAG);
      checkPair('light', LIGHT_VERT, LIGHT_FRAG);
      checkPair('bloomExtract', FULLSCREEN_VERT, BLOOM_EXTRACT_FRAG);
      checkPair('bloomBlur', FULLSCREEN_VERT, BLOOM_BLUR_FRAG);
      checkPair('composite', FULLSCREEN_VERT, COMPOSITE_FRAG);

      // Verify RGBA8 offscreen FBO completeness
      const tex = gl.createTexture();
      const fbo = gl.createFramebuffer();
      if (!tex || !fbo) throw new Error('probe FBO allocation failed');
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 16, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(tex);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`FBO incomplete (0x${status.toString(16)})`);
      }

      cleanup();
      return { ok: true };
    } catch (err) {
      cleanup();
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }

  public static tryCreate(
    canvas: HTMLCanvasElement,
    atlas: BakedAtlas,
    fontAtlas: BakedFontAtlas
  ): WebGL2InkCelRenderer | null {
    const probe = WebGL2InkCelRenderer.probeWebGL2Support();
    if (!probe.ok) {
      console.warn(`[WebGL2InkCelRenderer] Probe failed (${probe.reason}); falling back cleanly to Canvas2D.`);
      return null;
    }

    try {
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: 'high-performance',
      });
      if (!gl) {
        console.warn('[WebGL2InkCelRenderer] Failed to acquire webgl2 context on canvas; falling back to Canvas2D.');
        return null;
      }
      return new WebGL2InkCelRenderer(gl, atlas, fontAtlas);
    } catch (err) {
      console.warn('[WebGL2InkCelRenderer] Init failed after probe; falling back to Canvas2D:', err);
      return null;
    }
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL2: createShader failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) ?? 'unknown shader error';
      gl.deleteShader(shader);
      throw new Error(`WebGL2 shader compile error: ${info}`);
    }
    return shader;
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    if (!prog) throw new Error('WebGL2: createProgram failed');
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog) ?? 'unknown link error';
      gl.deleteProgram(prog);
      throw new Error(`WebGL2 program link error: ${info}`);
    }
    return prog;
  }

  private uploadCanvasTexture(canvas: HTMLCanvasElement): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('WebGL2: createTexture failed');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    return tex;
  }

  private createFbo(w: number, h: number): FboTarget {
    const gl = this.gl;
    const safeW = Math.max(1, w);
    const safeH = Math.max(1, h);
    const tex = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!tex || !fbo) throw new Error('WebGL2: failed to create FBO');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, safeW, safeH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, w: safeW, h: safeH };
  }

  private destroyFbo(target: FboTarget | null): void {
    if (!target) return;
    this.gl.deleteFramebuffer(target.fbo);
    this.gl.deleteTexture(target.tex);
  }

  public resize(width: number, height: number, dpr: number): void {
    this.viewW = Math.max(1, Math.floor(width));
    this.viewH = Math.max(1, Math.floor(height));
    this.dpr = Math.max(1, Math.min(2, dpr));
    const newFbW = Math.max(1, Math.floor(this.viewW * this.dpr));
    const newFbH = Math.max(1, Math.floor(this.viewH * this.dpr));

    if (newFbW === this.fbW && newFbH === this.fbH && this.sceneFbo) {
      return;
    }

    this.fbW = newFbW;
    this.fbH = newFbH;

    const canvas = this.gl.canvas as HTMLCanvasElement;
    canvas.width = this.fbW;
    canvas.height = this.fbH;

    this.destroyFbo(this.sceneFbo);
    this.destroyFbo(this.lightFbo);
    this.destroyFbo(this.bloomFboA);
    this.destroyFbo(this.bloomFboB);

    const halfW = Math.max(1, this.fbW >> 1);
    const halfH = Math.max(1, this.fbH >> 1);
    this.sceneFbo = this.createFbo(this.fbW, this.fbH);
    this.lightFbo = this.createFbo(halfW, halfH);
    this.bloomFboA = this.createFbo(halfW, halfH);
    this.bloomFboB = this.createFbo(halfW, halfH);
  }

  // ============================================================================
  // Low-Level Zero-Allocation Geometry Batchers
  // ============================================================================

  private setBatchState(tex: WebGLTexture, blend: 'alpha' | 'additive'): void {
    if (this.activeTexture !== tex || this.currentBlend !== blend) {
      this.flushBatch();
      this.activeTexture = tex;
      this.currentBlend = blend;
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (blend === 'additive') {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
    }
  }

  private flushBatch(): void {
    if (this.batchVertCount === 0) return;
    const gl = this.gl;
    gl.useProgram(this.batchProg);
    gl.uniform2f(this.uBatch.uResolution, this.viewW, this.viewH);
    gl.uniform1i(this.uBatch.uAtlas, 0);
    gl.bindVertexArray(this.batchVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.batchVbo);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.batchData.subarray(0, this.batchVertCount * FLOATS_PER_VERT)
    );
    gl.drawArrays(gl.TRIANGLES, 0, this.batchVertCount);
    this.drawCalls++;
    this.batchVertCount = 0;
  }

  private pushVert(
    x: number,
    y: number,
    u: number,
    v: number,
    r: number,
    g: number,
    b: number,
    a: number,
    flash: number,
    emissive: number
  ): void {
    const o = this.batchVertCount * FLOATS_PER_VERT;
    const d = this.batchData;
    d[o] = x;
    d[o + 1] = y;
    d[o + 2] = u;
    d[o + 3] = v;
    d[o + 4] = r;
    d[o + 5] = g;
    d[o + 6] = b;
    d[o + 7] = a;
    d[o + 8] = flash;
    d[o + 9] = emissive;
    this.batchVertCount++;
  }

  private pushTriSolid(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number,
    g: number,
    b: number,
    a: number,
    emissive = 0
  ): void {
    if (this.batchVertCount + 3 > MAX_BATCH_VERTS) this.flushBatch();
    const u = (this.whiteRect.u0 + this.whiteRect.u1) * 0.5;
    const v = (this.whiteRect.v0 + this.whiteRect.v1) * 0.5;
    this.pushVert(x0, y0, u, v, r, g, b, a, 0, emissive);
    this.pushVert(x1, y1, u, v, r, g, b, a, 0, emissive);
    this.pushVert(x2, y2, u, v, r, g, b, a, 0, emissive);
  }

  private pushQuadSolid(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    r: number,
    g: number,
    b: number,
    a: number,
    emissive = 0
  ): void {
    if (this.batchVertCount + 6 > MAX_BATCH_VERTS) this.flushBatch();
    const u = (this.whiteRect.u0 + this.whiteRect.u1) * 0.5;
    const v = (this.whiteRect.v0 + this.whiteRect.v1) * 0.5;
    this.pushVert(x0, y0, u, v, r, g, b, a, 0, emissive);
    this.pushVert(x1, y1, u, v, r, g, b, a, 0, emissive);
    this.pushVert(x2, y2, u, v, r, g, b, a, 0, emissive);
    this.pushVert(x0, y0, u, v, r, g, b, a, 0, emissive);
    this.pushVert(x2, y2, u, v, r, g, b, a, 0, emissive);
    this.pushVert(x3, y3, u, v, r, g, b, a, 0, emissive);
  }

  private pushSprite(
    id: string,
    sx: number,
    sy: number,
    scaleX: number,
    scaleY: number,
    rotation = 0,
    r = 1,
    g = 1,
    b = 1,
    a = 1,
    flash = 0,
    emissive = 0
  ): void {
    const rect = this.atlas.sprites.get(id);
    if (!rect) return;
    if (this.batchVertCount + 6 > MAX_BATCH_VERTS) this.flushBatch();

    const w = rect.w * scaleX;
    const h = rect.h * scaleY;
    const lx0 = -w * rect.anchorX;
    const ly0 = -h * rect.anchorY;
    const lx1 = lx0 + w;
    const ly1 = ly0 + h;

    let x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number;
    if (rotation === 0) {
      x0 = sx + lx0;
      y0 = sy + ly0;
      x1 = sx + lx1;
      y1 = sy + ly0;
      x2 = sx + lx1;
      y2 = sy + ly1;
      x3 = sx + lx0;
      y3 = sy + ly1;
    } else {
      const c = Math.cos(rotation);
      const s = Math.sin(rotation);
      x0 = sx + lx0 * c - ly0 * s;
      y0 = sy + lx0 * s + ly0 * c;
      x1 = sx + lx1 * c - ly0 * s;
      y1 = sy + lx1 * s + ly0 * c;
      x2 = sx + lx1 * c - ly1 * s;
      y2 = sy + lx1 * s + ly1 * c;
      x3 = sx + lx0 * c - ly1 * s;
      y3 = sy + lx0 * s + ly1 * c;
    }

    this.pushVert(x0, y0, rect.u0, rect.v0, r, g, b, a, flash, emissive);
    this.pushVert(x1, y1, rect.u1, rect.v0, r, g, b, a, flash, emissive);
    this.pushVert(x2, y2, rect.u1, rect.v1, r, g, b, a, flash, emissive);
    this.pushVert(x0, y0, rect.u0, rect.v0, r, g, b, a, flash, emissive);
    this.pushVert(x2, y2, rect.u1, rect.v1, r, g, b, a, flash, emissive);
    this.pushVert(x3, y3, rect.u0, rect.v1, r, g, b, a, flash, emissive);
  }

  private pushSpriteSized(
    id: string,
    x0: number,
    y0: number,
    w: number,
    h: number,
    r = 1,
    g = 1,
    b = 1,
    a = 1,
    emissive = 0
  ): void {
    const rect = this.atlas.sprites.get(id);
    if (!rect) return;
    if (this.batchVertCount + 6 > MAX_BATCH_VERTS) this.flushBatch();
    const x1 = x0 + w;
    const y1 = y0 + h;
    this.pushVert(x0, y0, rect.u0, rect.v0, r, g, b, a, 0, emissive);
    this.pushVert(x1, y0, rect.u1, rect.v0, r, g, b, a, 0, emissive);
    this.pushVert(x1, y1, rect.u1, rect.v1, r, g, b, a, 0, emissive);
    this.pushVert(x0, y0, rect.u0, rect.v0, r, g, b, a, 0, emissive);
    this.pushVert(x1, y1, rect.u1, rect.v1, r, g, b, a, 0, emissive);
    this.pushVert(x0, y1, rect.u0, rect.v1, r, g, b, a, 0, emissive);
  }

  private pushLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    width: number,
    r: number,
    g: number,
    b: number,
    a: number,
    emissive = 0
  ): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const nx = (-dy / len) * (width * 0.5);
    const ny = (dx / len) * (width * 0.5);
    this.pushQuadSolid(
      x0 + nx,
      y0 + ny,
      x1 + nx,
      y1 + ny,
      x1 - nx,
      y1 - ny,
      x0 - nx,
      y0 - ny,
      r,
      g,
      b,
      a,
      emissive
    );
  }

  private pushEllipseFill(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    segments: number,
    r: number,
    g: number,
    b: number,
    a: number,
    emissive = 0
  ): void {
    const step = (Math.PI * 2) / segments;
    for (let i = 0; i < segments; i++) {
      const a0 = i * step;
      const a1 = (i + 1) * step;
      this.pushTriSolid(
        cx,
        cy,
        cx + Math.cos(a0) * rx,
        cy + Math.sin(a0) * ry,
        cx + Math.cos(a1) * rx,
        cy + Math.sin(a1) * ry,
        r,
        g,
        b,
        a,
        emissive
      );
    }
  }

  private pushEllipseRing(
    cx: number,
    cy: number,
    rxOuter: number,
    ryOuter: number,
    rxInner: number,
    ryInner: number,
    segments: number,
    r: number,
    g: number,
    b: number,
    a: number,
    emissive = 0
  ): void {
    const step = (Math.PI * 2) / segments;
    for (let i = 0; i < segments; i++) {
      const a0 = i * step;
      const a1 = (i + 1) * step;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);
      this.pushQuadSolid(
        cx + c0 * rxInner,
        cy + s0 * ryInner,
        cx + c0 * rxOuter,
        cy + s0 * ryOuter,
        cx + c1 * rxOuter,
        cy + s1 * ryOuter,
        cx + c1 * rxInner,
        cy + s1 * ryInner,
        r,
        g,
        b,
        a,
        emissive
      );
    }
  }

  private pushLight(
    sx: number,
    sy: number,
    rx: number,
    ry: number,
    r: number,
    g: number,
    b: number,
    intensity: number
  ): void {
    if (this.lightVertCount + 6 > MAX_LIGHTS * 6) return;
    const d = this.lightData;
    const write = (x: number, y: number, lx: number, ly: number) => {
      const o = this.lightVertCount * FLOATS_PER_LIGHT_VERT;
      d[o] = x;
      d[o + 1] = y;
      d[o + 2] = lx;
      d[o + 3] = ly;
      d[o + 4] = r;
      d[o + 5] = g;
      d[o + 6] = b;
      d[o + 7] = intensity;
      this.lightVertCount++;
    };
    const x0 = sx - rx;
    const x1 = sx + rx;
    const y0 = sy - ry;
    const y1 = sy + ry;
    write(x0, y0, -1, -1);
    write(x1, y0, 1, -1);
    write(x1, y1, 1, 1);
    write(x0, y0, -1, -1);
    write(x1, y1, 1, 1);
    write(x0, y1, -1, 1);
  }

  // ============================================================================
  // Coordinate & Scene Helpers
  // ============================================================================

  private wxToSx(wx: number, cam: CameraView): number {
    return cam.viewW * 0.5 + (wx - cam.camX + cam.shakeX) * cam.zoom;
  }

  private wyToSy(wy: number, wz: number, cam: CameraView): number {
    return cam.viewH * 0.5 + (wy - cam.camY + cam.shakeY) * cam.isoScaleY * cam.zoom - wz * cam.zoom;
  }

  private ensureBraziers(state: SimState): void {
    const b = state.room.bounds;
    const key = `${state.room.biome}:${state.room.depth}:${b.minX}:${b.maxX}:${b.minY}:${b.maxY}:${state.room.doors.length}`;
    if (key === this.lastBrazierBoundsKey) return;
    this.lastBrazierBoundsKey = key;
    this.braziers.length = 0;

    const inset = 64;
    this.braziers.push(
      { x: b.minX + inset, y: b.minY + inset },
      { x: b.maxX - inset, y: b.minY + inset },
      { x: b.minX + inset, y: b.maxY - inset },
      { x: b.maxX - inset, y: b.maxY - inset }
    );

    const midX = (b.minX + b.maxX) * 0.5;
    const midY = (b.minY + b.maxY) * 0.5;
    const isBlockedSpot = (x: number, y: number) => {
      for (let i = 0; i < state.room.doors.length; i++) {
        const d = state.room.doors[i];
        if (Math.hypot(x - d.pos.x, y - d.pos.y) < 135) return true;
      }
      for (let i = 0; i < state.room.obstacles.length; i++) {
        const o = state.room.obstacles[i];
        if (Math.abs(x - o.pos.x) < o.halfW + 44 && Math.abs(y - o.pos.y) < o.halfH + 44) return true;
      }
      for (let i = 0; i < state.room.hazards.length; i++) {
        const h = state.room.hazards[i];
        if (Math.hypot(x - h.pos.x, y - h.pos.y) < h.radius + 48) return true;
      }
      for (let i = 0; i < this.braziers.length; i++) {
        const br = this.braziers[i];
        if (Math.hypot(x - br.x, y - br.y) < 110) return true;
      }
      return false;
    };

    const tryAddBrazier = (x: number, y: number) => {
      if (!isBlockedSpot(x, y)) this.braziers.push({ x, y });
    };

    // Flank each chamber exit door symmetrically with twin burning braziers!
    for (let i = 0; i < state.room.doors.length; i++) {
      const d = state.room.doors[i];
      if (d.direction === 'north' || d.direction === 'south') {
        const by = d.direction === 'north' ? b.minY + inset * 0.72 : b.maxY - inset * 0.72;
        tryAddBrazier(d.pos.x - 132, by);
        tryAddBrazier(d.pos.x + 132, by);
      }
    }

    if (b.maxX - b.minX > 900) {
      tryAddBrazier(midX, b.minY + inset * 0.85);
      // Flank the southern Hero entry lane symmetrically instead of placing a brazier at center-south spawn
      tryAddBrazier(midX - 210, b.maxY - inset * 0.85);
      tryAddBrazier(midX + 210, b.maxY - inset * 0.85);
    }
    if (b.maxY - b.minY > 750) {
      tryAddBrazier(b.minX + inset * 0.85, midY);
      tryAddBrazier(b.maxX - inset * 0.85, midY);
    }
  }

  /**
   * Exact slab ray-AABB intersection matching `src/sim/bosses.ts` pillar LoS occlusion.
   * Returns clipped distance along ray `(ox, oy) + t * (dirX, dirY)` up to `maxLen`.
   */
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

  // ============================================================================
  // Master 6-Pass Render Entry Point
  // ============================================================================

  public render(
    state: SimState,
    prevState: SimState | null,
    cam: CameraView,
    vfx: ParticlesAndDecals,
    settings: RenderSettings,
    nowMs: number
  ): number {
    if (this.contextLost || !this.sceneFbo || !this.lightFbo || !this.bloomFboA || !this.bloomFboB) {
      return 0;
    }

    const gl = this.gl;
    this.drawCalls = 0;
    const timeSec = nowMs * 0.001;
    const theme = BIOME_THEMES[state.room.biome] ?? BIOME_THEMES.obsidian_pit;
    this.ensureBraziers(state);

    // ------------------------------------------------------------------------
    // PASS 1: Deep Abyssal Chasm Parallax & Animated Underworld Mist -> sceneFBO
    // ------------------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo.fbo);
    gl.viewport(0, 0, this.sceneFbo.w, this.sceneFbo.h);
    gl.disable(gl.BLEND);
    gl.useProgram(this.abyssProg);
    gl.uniform1f(this.uAbyss.uTime, timeSec);
    gl.uniform2f(this.uAbyss.uCamPos, cam.camX, cam.camY);
    gl.uniform1f(this.uAbyss.uZoom, cam.zoom);
    gl.uniform2f(this.uAbyss.uResolution, this.viewW, this.viewH);
    gl.uniform3fv(this.uAbyss.uDeepColor, theme.deep);
    gl.uniform3fv(this.uAbyss.uMidColor, theme.mid);
    gl.uniform3fv(this.uAbyss.uMistColor, theme.mist);
    gl.uniform3fv(this.uAbyss.uAccentColor, theme.accent);
    const biomeMode =
      state.room.biome === 'cinder_mire'
        ? 1.0
        : state.room.biome === 'verdant_colosseum'
          ? 2.0
          : state.room.biome === 'crypt_of_bile'
            ? 3.0
            : state.room.biome === 'frozen_summit'
              ? 4.0
              : 0.0;
    gl.uniform1f(this.uAbyss.uBiomeMode, biomeMode);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCalls++;

    // Prepare sprite batch state for Pass 2 & Pass 3
    gl.enable(gl.BLEND);
    this.activeTexture = null;
    this.currentBlend = 'alpha';
    this.setBatchState(this.atlasTex, 'alpha');

    // ------------------------------------------------------------------------
    // PASS 2: Isometric Stone Chamber, Cliff Drop, Meander Trim, Pits, Decals & Telegraphs
    // ------------------------------------------------------------------------
    this.renderChamberFloorAndDecals(state, cam, vfx, theme, timeSec);
    this.renderTelegraphs(state.room.telegraphs, state.room.obstacles, cam, timeSec);
    this.renderContactShadows(state, prevState, cam);

    // ------------------------------------------------------------------------
    // PASS 3: Y-Sorted Ink-Cel Entities, Cloak, Weapons, Slash Ribbons & Particles
    // ------------------------------------------------------------------------
    this.renderYSortedEntities(state, prevState, cam, settings, timeSec);
    this.renderSlashRibbons(vfx, cam);
    this.renderParticles(vfx, cam);
    this.flushBatch();

    // ------------------------------------------------------------------------
    // PASS 4: Additive Dynamic Lightmap FBO (Half-Resolution)
    // ------------------------------------------------------------------------
    this.renderDynamicLightmap(state, prevState, cam, vfx, theme, timeSec);

    // ------------------------------------------------------------------------
    // PASS 5: Dual-Pass Selective Bloom FBO (Extract -> H-Blur -> V-Blur)
    // ------------------------------------------------------------------------
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);

    // 5a: Bright extract -> bloomFboA
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboA.fbo);
    gl.viewport(0, 0, this.bloomFboA.w, this.bloomFboA.h);
    gl.useProgram(this.bloomExtractProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.tex);
    gl.uniform1i(this.uBloomExtract.uSceneTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lightFbo.tex);
    gl.uniform1i(this.uBloomExtract.uLightTex, 1);
    gl.uniform1f(this.uBloomExtract.uThreshold, 0.72);
    gl.uniform1f(this.uBloomExtract.uKnee, 0.35);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCalls++;

    // 5b: Horizontal Gaussian blur -> bloomFboB
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboB.fbo);
    gl.viewport(0, 0, this.bloomFboB.w, this.bloomFboB.h);
    gl.useProgram(this.bloomBlurProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFboA.tex);
    gl.uniform1i(this.uBloomBlur.uTex, 0);
    gl.uniform2f(this.uBloomBlur.uTexelStep, 1.4 / this.bloomFboA.w, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCalls++;

    // 5c: Vertical Gaussian blur -> bloomFboA
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboA.fbo);
    gl.viewport(0, 0, this.bloomFboA.w, this.bloomFboA.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFboB.tex);
    gl.uniform2f(this.uBloomBlur.uTexelStep, 0, 1.4 / this.bloomFboB.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCalls++;

    // ------------------------------------------------------------------------
    // PASS 6: Final Post-Process Composite + Crisp Ink-Outlined Floating Numbers
    // ------------------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.fbW, this.fbH);
    gl.useProgram(this.compositeProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFbo.tex);
    gl.uniform1i(this.uComposite.uSceneTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lightFbo.tex);
    gl.uniform1i(this.uComposite.uLightTex, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFboA.tex);
    gl.uniform1i(this.uComposite.uBloomTex, 2);
    gl.uniform3fv(this.uComposite.uShadowTint, theme.shadowTint);
    gl.uniform3fv(this.uComposite.uMidtoneTint, theme.midtoneTint);
    gl.uniform3fv(this.uComposite.uHighlightTint, theme.highlightTint);
    gl.uniform1f(this.uComposite.uBloomStrength, 0.56);
    gl.uniform1f(this.uComposite.uVignetteStrength, 0.24);
    gl.uniform1f(this.uComposite.uHitFlash, settings.hitFlash ? vfx.hitFlashPulse : 0);
    gl.uniform1f(this.uComposite.uDeathDefiance, vfx.deathDefiancePulse);
    gl.uniform1f(this.uComposite.uFinalKillPulse, vfx.finalKillPulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCalls++;

    // Render Crisp Comic-Ink Floating Damage Numbers cleanly over final graded frame
    if (settings.showDamageNumbers && state.floatingNumbers.length > 0) {
      gl.enable(gl.BLEND);
      this.activeTexture = null;
      this.currentBlend = 'alpha';
      this.setBatchState(this.fontTex, 'alpha');
      this.renderFloatingNumbers(state, cam);
      this.flushBatch();
    }

    return this.drawCalls;
  }

  // ============================================================================
  // Pass 2 Implementation: Chamber Floor, Cliff Drop, Meander Trim, Pits & Decals
  // ============================================================================

  private renderChamberFloorAndDecals(
    state: SimState,
    cam: CameraView,
    vfx: ParticlesAndDecals,
    theme: BiomeVisualTheme,
    timeSec: number
  ): void {
    const b = state.room.bounds;
    const x0 = this.wxToSx(b.minX, cam);
    const x1 = this.wxToSx(b.maxX, cam);
    const y0 = this.wyToSy(b.minY, 0, cam);
    const y1 = this.wyToSy(b.maxY, 0, cam);

    // Glowing chasm under-rim aura beneath floating arena platform
    const rimPulse = 0.78 + 0.22 * Math.sin(timeSec * 2.4);
    this.pushQuadSolid(
      x0 - 16 * cam.zoom,
      y0 - 12 * cam.zoom,
      x1 + 16 * cam.zoom,
      y0 - 12 * cam.zoom,
      x1 + 20 * cam.zoom,
      y1 + 26 * cam.zoom,
      x0 - 20 * cam.zoom,
      y1 + 26 * cam.zoom,
      theme.rimGlow[0],
      theme.rimGlow[1],
      theme.rimGlow[2],
      0.24 * rimPulse,
      0.9
    );

    // 3D Carved Obsidian Cliff Drop along Southern Edge (sells floating-over-abyss depth!)
    const cliffH = 92 * cam.zoom;
    const segW = 220 * cam.zoom;
    const segCount = Math.max(1, Math.ceil((x1 - x0) / segW));
    const stepW = (x1 - x0) / segCount;
    for (let i = 0; i < segCount; i++) {
      this.pushSpriteSized(
        'prop_chasm_rim',
        x0 + i * stepW,
        y1 - 2 * cam.zoom,
        stepW + 1,
        cliffH,
        1,
        1,
        1,
        0.96,
        0
      );
    }

    // Flush chasm rim & cliff face BEFORE enabling hardware scissor clip for diamond flagstones
    this.flushBatch();

    // Hardware SCISSOR_TEST cleanly clips staggered diamond flagstones inside the beveled stone platform!
    const gl = this.gl;
    const scX = Math.max(0, Math.floor(x0 * this.dpr));
    const scRight = Math.min(this.fbW, Math.ceil(x1 * this.dpr));
    const scTop = Math.max(0, Math.floor(y0 * this.dpr));
    const scBottom = Math.min(this.fbH, Math.ceil(y1 * this.dpr));
    const scW = Math.max(0, scRight - scX);
    const scH = Math.max(0, scBottom - scTop);
    const scY = Math.max(0, this.fbH - scBottom);

    if (scW > 0 && scH > 0) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(scX, scY, scW, scH);

      // Solid deep obsidian under-slab behind diamond tiles (zero subpixel seam gaps)
      this.pushQuadSolid(x0, y0, x1, y0, x1, y1, x0, y1, 0.05, 0.08, 0.09, 1, 0);

      // Staggered 2:1 Carved Isometric Stone Diamond Flagstones across room.bounds
      const tileWorldW = 210;
      const tileWorldH = 210;
      const tileIds = getBiomeTileIds(state.room.biome);
      const halfTileW = tileWorldW * 0.5;
      const halfTileH = tileWorldH * 0.5;
      const tileScaleX = (tileWorldW / 252) * cam.zoom;
      const tileScaleY = ((tileWorldH * cam.isoScaleY) / 124) * cam.zoom;

      const startRow = Math.floor(b.minY / halfTileH) - 1;
      const endRow = Math.ceil(b.maxY / halfTileH) + 1;
      const startCol = Math.floor(b.minX / tileWorldW) - 1;
      const endCol = Math.ceil(b.maxX / tileWorldW) + 1;

      for (let row = startRow; row <= endRow; row++) {
        const wy = row * halfTileH;
        const xShift = (row & 1) !== 0 ? halfTileW : 0;
        for (let col = startCol; col <= endCol; col++) {
          const wx = col * tileWorldW + xShift;
          if (
            wx + halfTileW < b.minX ||
            wx - halfTileW > b.maxX ||
            wy + halfTileH < b.minY ||
            wy - halfTileH > b.maxY
          ) {
            continue;
          }
          const hash = Math.abs((col * 73856093) ^ (row * 19349663)) % 13;
          const tileId =
            hash === 0
              ? tileIds[3]
              : hash < 3
                ? tileIds[2]
                : hash % 2 === 0
                  ? tileIds[0]
                  : tileIds[1];
          const sx = this.wxToSx(wx, cam);
          const sy = this.wyToSy(wy, 0, cam);
          const shade = 0.86 + (hash % 4) * 0.04;
          this.pushSprite(tileId, sx, sy, tileScaleX, tileScaleY, 0, shade, shade, shade, 1, 0, 0);
        }
      }

      // Sanctum Courtyard Crimson-Gold Carpet Runner leading toward Northern Escape Door
      if (state.room.biome === 'sanctum_hub') {
        const midX = this.wxToSx((b.minX + b.maxX) * 0.5, cam);
        const rugHalfW = 76 * cam.zoom;
        this.pushQuadSolid(
          midX - rugHalfW,
          y0 + 18 * cam.zoom,
          midX + rugHalfW,
          y0 + 18 * cam.zoom,
          midX + rugHalfW,
          y1 - 24 * cam.zoom,
          midX - rugHalfW,
          y1 - 24 * cam.zoom,
          0.54,
          0.1,
          0.16,
          0.86,
          0
        );
        this.pushLine(midX - rugHalfW + 6 * cam.zoom, y0 + 20 * cam.zoom, midX - rugHalfW + 6 * cam.zoom, y1 - 26 * cam.zoom, 4 * cam.zoom, 0.92, 0.72, 0.3, 0.95);
        this.pushLine(midX + rugHalfW - 6 * cam.zoom, y0 + 20 * cam.zoom, midX + rugHalfW - 6 * cam.zoom, y1 - 26 * cam.zoom, 4 * cam.zoom, 0.92, 0.72, 0.3, 0.95);
      }

      this.flushBatch();
      gl.disable(gl.SCISSOR_TEST);
    }

    // Inlaid Gold & Jade Greek Meander Border Trim around all 4 chamber edges
    const trimH = 26 * cam.zoom;
    const hSegs = Math.max(1, Math.ceil((x1 - x0) / (140 * cam.zoom)));
    const hStep = (x1 - x0) / hSegs;
    for (let i = 0; i < hSegs; i++) {
      this.pushSpriteSized('trim_meander', x0 + i * hStep, y0 - trimH * 0.5, hStep + 1, trimH, 1, 1, 1, 0.96, 0.12);
      this.pushSpriteSized('trim_meander', x0 + i * hStep, y1 - trimH * 0.5, hStep + 1, trimH, 1, 1, 1, 0.96, 0.12);
    }
    // Left & Right carved ink-and-gold side parapet borders
    this.pushLine(x0, y0, x0, y1, 12 * cam.zoom, 0.08, 0.09, 0.12, 1);
    this.pushLine(x0, y0, x0, y1, 4.5 * cam.zoom, 0.84, 0.65, 0.3, 0.95, 0.15);
    this.pushLine(x1, y0, x1, y1, 12 * cam.zoom, 0.08, 0.09, 0.12, 1);
    this.pushLine(x1, y0, x1, y1, 4.5 * cam.zoom, 0.84, 0.65, 0.3, 0.95, 0.15);

    // Chasm Pits — Beveled Isometric Carved-Obsidian Chasm Cutouts (matches 45° flagstones, never neon cyan UI boxes!)
    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind !== 'pit') continue;
      const cx = this.wxToSx(obs.pos.x, cam);
      const cy = this.wyToSy(obs.pos.y, 0, cam);
      const hw = obs.halfW * cam.zoom;
      const hh = obs.halfH * cam.isoScaleY * cam.zoom;
      // 8-point chamfered isometric stone chasm polygon aligned to 2:1 diamond bevels
      const cxOff = hw * 0.36;
      const cyOff = hh * 0.42;
      const pts: [number, number][] = [
        [cx - hw + cxOff, cy - hh],
        [cx + hw - cxOff, cy - hh],
        [cx + hw, cy - hh + cyOff],
        [cx + hw, cy + hh - cyOff],
        [cx + hw - cxOff, cy + hh],
        [cx - hw + cxOff, cy + hh],
        [cx - hw, cy + hh - cyOff],
        [cx - hw, cy - hh + cyOff],
      ];

      // Deep dark stone outer bevel lip
      for (let p = 0; p < 8; p++) {
        const a = pts[p];
        const next = pts[(p + 1) & 7];
        const pad = 5.5 * cam.zoom;
        const ax = cx + (a[0] - cx) * (1 + pad / Math.max(10, hw));
        const ay = cy + (a[1] - cy) * (1 + pad / Math.max(8, hh));
        const bx = cx + (next[0] - cx) * (1 + pad / Math.max(10, hw));
        const by = cy + (next[1] - cy) * (1 + pad / Math.max(8, hh));
        this.pushQuadSolid(ax, ay, bx, by, next[0], next[1], a[0], a[1], 0.1, 0.16, 0.17, 0.96);
      }

      // Recessed abyssal void interior
      for (let p = 0; p < 8; p++) {
        const a = pts[p];
        const next = pts[(p + 1) & 7];
        this.pushTriSolid(cx, cy, a[0], a[1], next[0], next[1], theme.deep[0] * 0.48, theme.deep[1] * 0.56, theme.deep[2] * 0.62, 0.98);
      }

      // Inner sunken basalt cliff face descending from north lip into chasm depth
      const dropH = Math.min(hh * 1.15, 34 * cam.zoom);
      this.pushQuadSolid(
        pts[0][0],
        pts[0][1],
        pts[1][0],
        pts[1][1],
        pts[1][0],
        pts[1][1] + dropH,
        pts[0][0],
        pts[0][1] + dropH,
        0.09,
        0.14,
        0.15,
        0.95
      );
      this.pushQuadSolid(
        pts[7][0],
        pts[7][1],
        pts[0][0],
        pts[0][1],
        pts[0][0],
        pts[0][1] + dropH,
        pts[7][0],
        pts[7][1] + dropH * 0.85,
        0.07,
        0.11,
        0.13,
        0.95
      );
      this.pushQuadSolid(
        pts[1][0],
        pts[1][1],
        pts[2][0],
        pts[2][1],
        pts[2][0],
        pts[2][1] + dropH * 0.85,
        pts[1][0],
        pts[1][1] + dropH,
        0.05,
        0.08,
        0.1,
        0.95
      );

      // Subtle glowing abyssal under-mist rising from center of pit
      this.pushSprite(
        'vfx_glow_soft',
        cx,
        cy + hh * 0.18,
        (hw * 1.3) / 64,
        (hh * 1.1) / 64,
        0,
        theme.rimGlow[0],
        theme.rimGlow[1],
        theme.rimGlow[2],
        0.24,
        0,
        0.45
      );

      // Crisp jet-black comic ink ledge + subtle inlaid carved emerald-gold rim bevel
      for (let p = 0; p < 8; p++) {
        const a = pts[p];
        const next = pts[(p + 1) & 7];
        this.pushLine(a[0], a[1], next[0], next[1], 4.2 * cam.zoom, 0.04, 0.03, 0.06, 0.96);
        const isLitEdge = p >= 3 && p <= 6; // southern/lower edge catches warm top-left light!
        this.pushLine(
          a[0],
          a[1],
          next[0],
          next[1],
          1.8 * cam.zoom,
          isLitEdge ? 0.62 : theme.rimGlow[0] * 0.55,
          isLitEdge ? 0.54 : theme.rimGlow[1] * 0.55,
          isLitEdge ? 0.34 : theme.rimGlow[2] * 0.55,
          0.75,
          0.18
        );
      }
    }

    // Floor Hazards (spike traps, lava pools, poison pools, consecrated auras)
    for (let i = 0; i < state.room.hazards.length; i++) {
      this.renderFloorHazard(state.room.hazards[i], cam, timeSec);
    }

    // Persistent Room Floor Decals (scorch craters, blood-ichor, cracks, glowing footprints)
    for (let i = 0; i < MAX_DECALS; i++) {
      const d = vfx.decals[i];
      if (!d.active) continue;
      const fade = Math.min(1, d.life / Math.min(2.0, d.maxLife * 0.35));
      const sx = this.wxToSx(d.x, cam);
      const sy = this.wyToSy(d.y, 0, cam);
      const spriteId =
        d.kind === 'ichor'
          ? 'vfx_decal_ichor'
          : d.kind === 'crack'
            ? 'vfx_decal_crack'
            : 'vfx_decal_scorch';
      const emissive = d.kind === 'foot_scorch' ? 1.5 * fade : 0;
      this.pushSprite(
        spriteId,
        sx,
        sy,
        d.scaleX * cam.zoom,
        d.scaleY * cam.zoom,
        d.angle,
        d.r,
        d.g,
        d.b,
        d.alpha * fade,
        0,
        emissive
      );
    }
  }

  private renderFloorHazard(h: HazardState, cam: CameraView, timeSec: number): void {
    const sx = this.wxToSx(h.pos.x, cam);
    const sy = this.wyToSy(h.pos.y, 0, cam);
    const rx = h.radius * cam.zoom;
    const ry = h.radius * cam.isoScaleY * cam.zoom;

    if (h.kind === 'spike_trap') {
      const id = h.active ? 'prop_spike_active' : h.armed ? 'prop_spike_armed' : 'prop_spike_idle';
      const scale = Math.max(0.75, (h.radius * 2) / 110) * cam.zoom;
      this.pushSprite(id, sx, sy, scale, scale, 0, 1, 1, 1, 1, 0, h.armed ? 0.5 : 0);
      return;
    }

    if (h.kind === 'lava_pool' || h.kind === 'boiling_geyser') {
      const seed = h.pos.x * 0.037 + h.pos.y * 0.023;
      const pulse = 0.92 + 0.08 * Math.sin(timeSec * 4.2 + seed);
      const curbX = Math.max(7.5 * cam.zoom, rx * 0.11);
      const curbY = Math.max(4.8 * cam.zoom, ry * 0.11);

      // 1. Grounded contact shadow & recessed 3D basalt crater drop-wall
      this.pushEllipseFill(sx, sy + 5 * cam.zoom, rx + curbX + 3.5 * cam.zoom, ry + curbY + 2.5 * cam.zoom, 24, 0.04, 0.02, 0.04, 0.72);
      // 2. Thick jet-black comic ink outer rim
      this.pushEllipseFill(sx, sy + 2.5 * cam.zoom, rx + curbX + 3.2 * cam.zoom, ry + curbY + 2.2 * cam.zoom, 24, 0.04, 0.02, 0.05, 0.98);
      // 3. Sculpted 3D volcanic basalt curb (shadowed outer lip + warm fire-lit top bevel)
      this.pushEllipseFill(sx, sy + 2.5 * cam.zoom, rx + curbX, ry + curbY, 24, 0.16, 0.09, 0.1, 0.98);
      this.pushEllipseFill(sx, sy - 0.5 * cam.zoom, rx + curbX * 0.96, ry + curbY * 0.96, 24, 0.34, 0.18, 0.14, 0.98);
      // Subtle fire-lit inner stone lip bevel
      this.pushEllipseRing(sx, sy, rx + 3.2 * cam.zoom, ry + 2.2 * cam.zoom, rx - 0.5 * cam.zoom, ry - 0.5 * cam.zoom, 24, 0.74, 0.28, 0.12, 0.92, 0.2);

      // 4. Deep volcanic magma basin (shifted inner glow creates realistic recessed northern rim shadow!)
      this.pushEllipseFill(sx, sy, rx, ry, 24, 0.58, 0.11, 0.04, 0.98, 0.28);
      this.pushEllipseFill(sx, sy + ry * 0.07, rx * 0.84, ry * 0.76, 20, 0.92, 0.32, 0.06, 0.94, 0.46 * pulse);

      // 5. Animated molten magma flow + jagged volcanic fissure veins (organic caldera crust, zero pareidolia!)
      const driftX = Math.sin(timeSec * 1.1 + seed) * rx * 0.06;
      const driftY = Math.cos(timeSec * 0.9 + seed) * ry * 0.05;
      this.pushEllipseFill(sx + driftX, sy + ry * 0.09 + driftY, rx * 0.64, ry * 0.52, 18, 0.98, 0.48, 0.08, 0.88, 0.56 * pulse);
      this.pushEllipseFill(sx - driftX * 0.8, sy + ry * 0.14, rx * 0.42, ry * 0.3, 14, 1.0, 0.72, 0.16, 0.82, 0.78 * pulse);

      // Jagged glowing volcanic fissure cracks + dark basalt crust ridge bands across the caldera
      const crA = Math.sin(seed * 3.1) * 0.35;
      const v1x = sx - rx * 0.56;
      const v1y = sy - ry * 0.12 + crA * ry * 0.25;
      const v2x = sx - rx * 0.12 + driftX * 0.6;
      const v2y = sy + ry * 0.18 + driftY * 0.5;
      const v3x = sx + rx * 0.24 - driftX * 0.4;
      const v3y = sy - ry * 0.06 - driftY * 0.4;
      const v4x = sx + rx * 0.58;
      const v4y = sy + ry * 0.22 - crA * ry * 0.2;
      // Dark volcanic crust shadow flanking fissure
      this.pushLine(v1x, v1y - 4 * cam.zoom, v2x, v2y - 4 * cam.zoom, 6.5 * cam.zoom, 0.24, 0.07, 0.05, 0.72);
      this.pushLine(v2x, v2y - 4 * cam.zoom, v3x, v3y - 4 * cam.zoom, 5.5 * cam.zoom, 0.24, 0.07, 0.05, 0.68);
      this.pushLine(v3x, v3y - 4 * cam.zoom, v4x, v4y - 4 * cam.zoom, 5.0 * cam.zoom, 0.24, 0.07, 0.05, 0.68);
      // Blazing white-gold molten vein cutting through the crust
      this.pushLine(v1x, v1y, v2x, v2y, 3.0 * cam.zoom, 1.0, 0.84, 0.28, 0.92, 0.98 * pulse);
      this.pushLine(v2x, v2y, v3x, v3y, 2.8 * cam.zoom, 1.0, 0.88, 0.36, 0.94, 1.05 * pulse);
      this.pushLine(v3x, v3y, v4x, v4y, 2.4 * cam.zoom, 1.0, 0.82, 0.26, 0.9, 0.95 * pulse);

      // Animated popping magma bubbles
      for (let bIdx = 0; bIdx < 3; bIdx++) {
        const phase = (timeSec * 0.85 + seed + bIdx * 0.33) % 1;
        const ang = seed + bIdx * 2.15;
        const bx = sx + Math.cos(ang) * rx * 0.46;
        const by = sy + ry * 0.08 + Math.sin(ang) * ry * 0.42;
        const br = (0.04 + phase * 0.075) * rx;
        const ba = Math.sin(phase * Math.PI) * 0.9;
        this.pushEllipseRing(bx, by, br, br * cam.isoScaleY, Math.max(0.5, br - 2.2 * cam.zoom), Math.max(0.5, (br - 2.2 * cam.zoom) * cam.isoScaleY), 10, 1.0, 0.84, 0.34, ba, 0.95);
      }

      // 6. Crisp jet-black inner basin contour + carved stone-curb radial seam ticks
      this.pushEllipseRing(sx, sy, rx + 1.6 * cam.zoom, ry + 1.1 * cam.zoom, Math.max(1, rx - 2.0 * cam.zoom), Math.max(1, ry - 1.4 * cam.zoom), 24, 0.04, 0.02, 0.05, 0.96);
      for (let sIdx = 0; sIdx < 8; sIdx++) {
        const a = sIdx * (Math.PI / 4) + 0.2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        this.pushLine(
          sx + ca * (rx + 1 * cam.zoom),
          sy + sa * (ry + 0.6 * cam.zoom),
          sx + ca * (rx + curbX),
          sy + sa * (ry + curbY),
          2.2 * cam.zoom,
          0.05,
          0.02,
          0.05,
          0.88
        );
      }
      return;
    }

    if (h.kind === 'poison_pool') {
      const seed = h.pos.x * 0.041 + h.pos.y * 0.029;
      const pulse = 0.93 + 0.07 * Math.sin(timeSec * 3.4 + seed);
      const curbX = Math.max(7.5 * cam.zoom, rx * 0.11);
      const curbY = Math.max(4.8 * cam.zoom, ry * 0.11);

      // 1. Grounded drop shadow & carved 3D mossy crypt-stone basin curb (matches curing_pool masonry!)
      this.pushEllipseFill(sx, sy + 5 * cam.zoom, rx + curbX + 3.5 * cam.zoom, ry + curbY + 2.5 * cam.zoom, 24, 0.03, 0.05, 0.03, 0.72);
      // 2. Bold jet-black comic ink outer rim
      this.pushEllipseFill(sx, sy + 2.5 * cam.zoom, rx + curbX + 3.2 * cam.zoom, ry + curbY + 2.2 * cam.zoom, 24, 0.04, 0.05, 0.04, 0.98);
      // 3. Carved crypt-stone rim bevel (shadowed lower wall + lit mossy-slate upper lip)
      this.pushEllipseFill(sx, sy + 2.5 * cam.zoom, rx + curbX, ry + curbY, 24, 0.16, 0.21, 0.14, 0.98);
      this.pushEllipseFill(sx, sy - 0.5 * cam.zoom, rx + curbX * 0.96, ry + curbY * 0.96, 24, 0.34, 0.42, 0.28, 0.98);
      this.pushEllipseRing(sx, sy, rx + 3.0 * cam.zoom, ry + 2.0 * cam.zoom, rx - 0.5 * cam.zoom, ry - 0.5 * cam.zoom, 24, 0.48, 0.64, 0.34, 0.85, 0.12);

      // 4. Deep recessed venomous emerald-bile liquid (southern shift yields sunken northern lip depth!)
      this.pushEllipseFill(sx, sy, rx, ry, 24, 0.11, 0.32, 0.08, 0.96, 0.12);
      this.pushEllipseFill(sx, sy + ry * 0.07, rx * 0.84, ry * 0.76, 20, 0.32, 0.72, 0.14, 0.92, 0.28 * pulse);

      // 5. Swirling toxic acid sheen + rising venomous bubbles
      const swX = Math.sin(timeSec * 1.3 + seed) * rx * 0.09;
      const swY = Math.cos(timeSec * 1.1 + seed) * ry * 0.08;
      this.pushEllipseFill(sx + swX, sy + ry * 0.08 + swY, rx * 0.52, ry * 0.44, 16, 0.58, 0.94, 0.2, 0.72, 0.42 * pulse);

      for (let bIdx = 0; bIdx < 4; bIdx++) {
        const phase = (timeSec * 0.95 + seed + bIdx * 0.25) % 1;
        const ang = seed * 1.3 + bIdx * 1.65;
        const bx = sx + Math.cos(ang) * rx * 0.48;
        const by = sy + ry * 0.08 + Math.sin(ang) * ry * 0.44;
        const br = (0.045 + phase * 0.07) * rx;
        const ba = Math.sin(phase * Math.PI) * 0.92;
        this.pushEllipseFill(bx, by, br + 1.4 * cam.zoom, (br + 1.4 * cam.zoom) * cam.isoScaleY, 10, 0.05, 0.14, 0.04, ba * 0.88);
        this.pushEllipseFill(bx, by, br, br * cam.isoScaleY, 10, 0.76, 1.0, 0.38, ba, 0.55);
      }

      // 6. Crisp jet-black inner basin ink rim + carved stone curb joints
      this.pushEllipseRing(sx, sy, rx + 1.6 * cam.zoom, ry + 1.1 * cam.zoom, Math.max(1, rx - 2.0 * cam.zoom), Math.max(1, ry - 1.4 * cam.zoom), 24, 0.04, 0.07, 0.04, 0.96);
      for (let sIdx = 0; sIdx < 8; sIdx++) {
        const a = sIdx * (Math.PI / 4) + 0.35;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        this.pushLine(
          sx + ca * (rx + 1 * cam.zoom),
          sy + sa * (ry + 0.6 * cam.zoom),
          sx + ca * (rx + curbX),
          sy + sa * (ry + curbY),
          2.2 * cam.zoom,
          0.04,
          0.06,
          0.04,
          0.86
        );
      }
      return;
    }

    if (h.kind === 'curing_pool') {
      const pulse = 0.92 + 0.08 * Math.sin(timeSec * 4.2);
      this.pushSprite('vfx_glow_soft', sx, sy, (rx * 1.45) / 64, (ry * 1.45) / 64, 0, 0.24, 0.92, 1.0, 0.48 * pulse, 0, 0.9);
      this.pushSprite('vfx_curing_basin', sx, sy, Math.max(0.7, rx / 52), Math.max(0.7, rx / 52), 0, 1, 1, 1, 1, 0, 0.35);
      return;
    }

    if (h.kind === 'sawblade') {
      const sc = Math.max(0.7, (h.radius * 2.1) / 88) * cam.zoom;
      this.pushSprite('vfx_sawblade', sx, sy - 8 * cam.zoom, sc, sc * 0.86, timeSec * 14, 1, 1, 1, 1, 0, 0.4);
      return;
    }

    if (h.kind === 'pylon') {
      const sc = Math.max(0.7, (h.radius * 2.1) / 76) * cam.zoom;
      this.pushSprite('vfx_pylon', sx, sy, sc, sc, 0, 1, 1, 1, 1, 0, 0.55);
      return;
    }

    if (h.kind === 'rift_vortex') {
      const sc = Math.max(0.85, (h.radius * 2.1) / 96) * cam.zoom;
      this.pushSprite('vfx_blade_rift', sx, sy - 6 * cam.zoom, sc, sc * cam.isoScaleY, timeSec * 9, 1, 1, 1, 0.95, 0, 0.75);
      return;
    }

    if (h.kind === 'consecrated_aura') {
      this.pushEllipseFill(sx, sy, rx, ry, 24, 1.0, 0.84, 0.34, 0.22, 0.65);
      this.pushEllipseRing(sx, sy, rx, ry, rx - 4 * cam.zoom, ry - 2.5 * cam.zoom, 24, 1.0, 0.9, 0.48, 0.85, 0.95);
    }
  }

  private renderTelegraphs(
    telegraphs: readonly TelegraphShape[],
    obstacles: readonly ArenaObstacle[],
    cam: CameraView,
    timeSec: number
  ): void {
    for (let i = 0; i < telegraphs.length; i++) {
      const t = telegraphs[i];
      const prog = Math.max(0, Math.min(1, t.progress));
      const [cr, cg, cb] = hexToRgbaTuple(t.dangerColor || '#FF2E4C');
      const hotFlash = prog > 0.8 ? (prog - 0.8) / 0.2 : 0;
      const r = cr + (1.0 - cr) * hotFlash * 0.55;
      const g = cg + (0.76 - cg) * hotFlash * 0.65;
      const b = cb * (1 - hotFlash * 0.55);
      const sx = this.wxToSx(t.pos.x, cam);
      const sy = this.wyToSy(t.pos.y, 0, cam);
      const rimEmissive = 0.55 + hotFlash * 0.55 + 0.12 * Math.sin(timeSec * 24);

      if (t.kind === 'circle' || t.kind === 'ring') {
        const rx = t.radius * cam.zoom;
        const ry = t.radius * cam.isoScaleY * cam.zoom;
        const irx = (t.innerRadius ?? 0) * cam.zoom;
        const iry = (t.innerRadius ?? 0) * cam.isoScaleY * cam.zoom;

        // Outer ink warning frame + base translucent danger zone
        if (t.kind === 'ring' && irx > 2) {
          this.pushEllipseRing(sx, sy, rx, ry, irx, iry, 28, cr, cg, cb, 0.22, 0.4);
          const fillRx = irx + (rx - irx) * prog;
          const fillRy = iry + (ry - iry) * prog;
          this.pushEllipseRing(sx, sy, fillRx, fillRy, irx, iry, 28, r, g, b, 0.36 + prog * 0.25, rimEmissive);
        } else {
          this.pushEllipseFill(sx, sy, rx, ry, 28, cr, cg, cb, 0.18, 0.3);
          this.pushEllipseFill(sx, sy, rx * prog, ry * prog, 28, r, g, b, 0.34 + prog * 0.24, rimEmissive);
        }
        // Ink contour + razor bright crimson/gold outer rim
        this.pushEllipseRing(sx, sy, rx + 4 * cam.zoom, ry + 2.5 * cam.zoom, rx, ry, 28, 0.05, 0.02, 0.06, 0.92);
        this.pushEllipseRing(sx, sy, rx, ry, Math.max(1, rx - 3.5 * cam.zoom), Math.max(1, ry - 2.2 * cam.zoom), 28, r, g, b, 0.95, rimEmissive);
      } else if (t.kind === 'cone') {
        const halfArc = ((t.arcDeg ?? 65) * Math.PI) / 360;
        const segs = 16;
        const rx = t.radius * cam.zoom;
        const ry = t.radius * cam.isoScaleY * cam.zoom;
        const step = (halfArc * 2) / segs;
        for (let s = 0; s < segs; s++) {
          const a0 = t.angle - halfArc + s * step;
          const a1 = a0 + step;
          // Base cone footprint
          this.pushTriSolid(
            sx,
            sy,
            sx + Math.cos(a0) * rx,
            sy + Math.sin(a0) * ry,
            sx + Math.cos(a1) * rx,
            sy + Math.sin(a1) * ry,
            cr,
            cg,
            cb,
            0.2,
            0.3
          );
          // Animated progress sweep outward
          this.pushTriSolid(
            sx,
            sy,
            sx + Math.cos(a0) * rx * prog,
            sy + Math.sin(a0) * ry * prog,
            sx + Math.cos(a1) * rx * prog,
            sy + Math.sin(a1) * ry * prog,
            r,
            g,
            b,
            0.38 + prog * 0.22,
            rimEmissive
          );
          // Razor bright rim
          this.pushLine(
            sx + Math.cos(a0) * rx,
            sy + Math.sin(a0) * ry,
            sx + Math.cos(a1) * rx,
            sy + Math.sin(a1) * ry,
            3.5 * cam.zoom,
            r,
            g,
            b,
            0.95,
            rimEmissive
          );
        }
        // Cone flank edges
        this.pushLine(sx, sy, sx + Math.cos(t.angle - halfArc) * rx, sy + Math.sin(t.angle - halfArc) * ry, 3 * cam.zoom, r, g, b, 0.92, rimEmissive);
        this.pushLine(sx, sy, sx + Math.cos(t.angle + halfArc) * rx, sy + Math.sin(t.angle + halfArc) * ry, 3 * cam.zoom, r, g, b, 0.92, rimEmissive);
      } else if (t.kind === 'line' || t.kind === 'rect') {
        const rawLen = t.length ?? t.radius;
        const laneW = t.width ?? 44;
        const halfW = laneW * 0.5;
        const c = Math.cos(t.angle);
        const s = Math.sin(t.angle);
        const len =
          t.kind === 'line' && laneW <= 96
            ? this.clipRayToObstacles(obstacles, t.pos.x, t.pos.y, c, s, rawLen)
            : rawLen;
        const px = -s * halfW;
        const py = c * halfW;

        const p0x = this.wxToSx(t.pos.x + px, cam);
        const p0y = this.wyToSy(t.pos.y + py, 0, cam);
        const p1x = this.wxToSx(t.pos.x - px, cam);
        const p1y = this.wyToSy(t.pos.y - py, 0, cam);
        const p2x = this.wxToSx(t.pos.x + c * len - px, cam);
        const p2y = this.wyToSy(t.pos.y + s * len - py, 0, cam);
        const p3x = this.wxToSx(t.pos.x + c * len + px, cam);
        const p3y = this.wyToSy(t.pos.y + s * len + py, 0, cam);

        // Full lane footprint (clipped cleanly at any blocking pillar AABB!)
        this.pushQuadSolid(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, cr, cg, cb, 0.22, 0.35);

        // Fill-up progress beam along lane
        const fLen = len * prog;
        const f2x = this.wxToSx(t.pos.x + c * fLen - px, cam);
        const f2y = this.wyToSy(t.pos.y + s * fLen - py, 0, cam);
        const f3x = this.wxToSx(t.pos.x + c * fLen + px, cam);
        const f3y = this.wyToSy(t.pos.y + s * fLen + py, 0, cam);
        this.pushQuadSolid(p0x, p0y, p1x, p1y, f2x, f2y, f3x, f3y, r, g, b, 0.42 + prog * 0.24, rimEmissive);

        // Razor borders (+ reinforced stopper bar when occluded by a pillar)
        const bw = 3.2 * cam.zoom;
        this.pushLine(p0x, p0y, p3x, p3y, bw, r, g, b, 0.95, rimEmissive);
        this.pushLine(p1x, p1y, p2x, p2y, bw, r, g, b, 0.95, rimEmissive);
        this.pushLine(p2x, p2y, p3x, p3y, len < rawLen - 0.5 ? bw * 1.55 : bw, r, g, b, 0.98, rimEmissive + 0.2);
      }
    }
  }

  private renderContactShadows(state: SimState, prevState: SimState | null, cam: CameraView): void {
    const heroPos = this.interpPlayerPos(state, prevState, cam.interpAlpha);
    this.pushSprite(
      'vfx_shadow_blob',
      this.wxToSx(heroPos.x, cam),
      this.wyToSy(heroPos.y, 0, cam),
      0.66 * cam.zoom,
      0.62 * cam.zoom,
      0,
      1,
      1,
      1,
      0.82
    );

    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.aiState === 'dead') continue;
      const ep = this.interpEnemyPos(e, prevState, cam.interpAlpha);
      const scale = Math.max(0.5, (e.radius * 2.2) / 110) * cam.zoom;
      this.pushSprite(
        'vfx_shadow_blob',
        this.wxToSx(ep.x, cam),
        this.wyToSy(ep.y, 0, cam),
        scale,
        scale * 0.95,
        0,
        1,
        1,
        1,
        0.78
      );
    }

    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind === 'pit') continue;
      const scale = Math.max(0.55, (obs.halfW * 2.4) / 110) * cam.zoom;
      this.pushSprite(
        'vfx_shadow_blob',
        this.wxToSx(obs.pos.x, cam),
        this.wyToSy(obs.pos.y + obs.halfH * 0.35, 0, cam),
        scale,
        scale,
        0,
        1,
        1,
        1,
        0.8
      );
    }

    for (let i = 0; i < this.braziers.length; i++) {
      const br = this.braziers[i];
      this.pushSprite(
        'vfx_shadow_blob',
        this.wxToSx(br.x, cam),
        this.wyToSy(br.y, 0, cam),
        0.58 * cam.zoom,
        0.55 * cam.zoom,
        0,
        1,
        1,
        1,
        0.75
      );
    }
  }

  // ============================================================================
  // Pass 3 Implementation: Y-Sorted Ink-Cel Entities, Cloak, Weapons & VFX
  // ============================================================================

  private pushSortItem(kind: SortItemKind, sortY: number, idx: number, x: number, y: number): void {
    if (this.sortCount >= MAX_SORT_ITEMS) return;
    const item = this.sortPool[this.sortCount++];
    item.kind = kind;
    item.sortY = sortY;
    item.idx = idx;
    item.x = x;
    item.y = y;
  }

  private renderYSortedEntities(
    state: SimState,
    prevState: SimState | null,
    cam: CameraView,
    settings: RenderSettings,
    timeSec: number
  ): void {
    this.sortCount = 0;

    // Obstacles (pillars, statues, urns, walls)
    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind === 'pit') continue;
      this.pushSortItem('obstacle', obs.pos.y + obs.halfH * 0.4, i, obs.pos.x, obs.pos.y);
    }

    // Perimeter flickering braziers
    for (let i = 0; i < this.braziers.length; i++) {
      const br = this.braziers[i];
      this.pushSortItem('brazier', br.y, i, br.x, br.y);
    }

    // Chamber Exit Doors
    for (let i = 0; i < state.room.doors.length; i++) {
      const door = state.room.doors[i];
      this.pushSortItem('door', door.pos.y - 10, i, door.pos.x, door.pos.y);
    }

    // Pickups & Bloodstones
    for (let i = 0; i < state.room.pickups.length; i++) {
      const pk = state.room.pickups[i];
      if (pk.collected) continue;
      this.pushSortItem('pickup', pk.pos.y, i, pk.pos.x, pk.pos.y);
    }
    for (let i = 0; i < state.room.bloodstones.length; i++) {
      const bs = state.room.bloodstones[i];
      this.pushSortItem('bloodstone', bs.pos.y, i, bs.pos.x, bs.pos.y);
    }

    // Enemies & Bosses
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.aiState === 'dead') continue;
      const ep = this.interpEnemyPos(e, prevState, cam.interpAlpha);
      this.pushSortItem('enemy', ep.y, i, ep.x, ep.y);
    }

    // Prince Pyreus (Hero)
    const heroPos = this.interpPlayerPos(state, prevState, cam.interpAlpha);
    this.pushSortItem('hero', heroPos.y, 0, heroPos.x, heroPos.y);

    // Projectiles (clip beam sortY to pillar impact face so occluded beams never cross foreground pillars!)
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
        const hitY = oy + s * clippedLen;
        this.pushSortItem('projectile', hitPillar ? hitY : oy + 8, i, ox, oy);
      } else {
        this.pushSortItem('projectile', pr.pos.y + 8, i, pr.pos.x, pr.pos.y);
      }
    }

    // Insertion sort on pre-allocated pool (nearly sorted frame-to-frame, O(N), zero alloc!)
    for (let i = 1; i < this.sortCount; i++) {
      const cur = this.sortPool[i];
      const curY = cur.sortY;
      let j = i - 1;
      while (j >= 0 && this.sortPool[j].sortY > curY) {
        this.sortPool[j + 1] = this.sortPool[j];
        j--;
      }
      this.sortPool[j + 1] = cur;
    }

    // Render Dash Ghosts cleanly behind active characters
    this.renderDashGhosts(state, cam);

    // Draw all Y-sorted entities in back-to-front painter order
    for (let i = 0; i < this.sortCount; i++) {
      const item = this.sortPool[i];
      switch (item.kind) {
        case 'obstacle':
          this.renderObstacle(state.room.obstacles[item.idx], state.room.biome, cam);
          break;
        case 'brazier':
          this.renderBrazier(item.x, item.y, item.idx, cam, timeSec);
          break;
        case 'door':
          this.renderDoor(state.room.doors[item.idx], cam, timeSec);
          break;
        case 'pickup':
          this.renderPickup(state.room.pickups[item.idx], cam, timeSec);
          break;
        case 'bloodstone':
          this.renderBloodstone(state.room.bloodstones[item.idx], cam, timeSec);
          break;
        case 'enemy':
          this.renderEnemy(state.enemies[item.idx], item.x, item.y, cam, settings, timeSec);
          break;
        case 'hero':
          this.renderHero(state, item.x, item.y, cam, settings, timeSec);
          break;
        case 'projectile':
          this.renderProjectile(state.projectiles[item.idx], state.room.obstacles, cam, timeSec);
          break;
      }
    }
  }

  private renderObstacle(obs: ArenaObstacle, biome: BiomeId, cam: CameraView): void {
    const sx = this.wxToSx(obs.pos.x, cam);
    const sy = this.wyToSy(obs.pos.y, 0, cam);

    if (obs.kind === 'destructible_urn') {
      const scale = Math.max(0.68, (obs.halfW * 2.2) / 76) * cam.zoom;
      this.pushSprite('prop_urn', sx, sy, scale, scale, 0, 1, 1, 1, 1);
      return;
    }

    if (obs.kind === 'statue') {
      const scale = Math.max(0.72, (obs.halfW * 2.3) / 110) * cam.zoom;
      this.pushSprite('prop_statue', sx, sy, scale, scale, 0, 1, 1, 1, 1);
      return;
    }

    if (obs.kind === 'wall' || obs.kind === 'gate') {
      const x0 = this.wxToSx(obs.pos.x - obs.halfW, cam);
      const x1 = this.wxToSx(obs.pos.x + obs.halfW, cam);
      const y0 = this.wyToSy(obs.pos.y - obs.halfH, 0, cam);
      const y1 = this.wyToSy(obs.pos.y + obs.halfH, 0, cam);
      const wallH = 68 * cam.zoom;
      // Front vertical slab
      this.pushQuadSolid(x0, y1 - wallH, x1, y1 - wallH, x1, y1, x0, y1, 0.14, 0.21, 0.23, 1);
      // Top bevel cap
      this.pushQuadSolid(x0, y0 - wallH, x1, y0 - wallH, x1, y1 - wallH, x0, y1 - wallH, 0.26, 0.39, 0.38, 1);
      // Ink & gilded highlight edge
      this.pushLine(x0, y1 - wallH, x1, y1 - wallH, 3.2 * cam.zoom, 0.85, 0.66, 0.32, 0.95);
      this.pushLine(x0, y1, x1, y1, 3.5 * cam.zoom, 0.04, 0.03, 0.06, 1);
      return;
    }

    // Biome-specific carved pillar
    const pillarId = getBiomePillarSpriteId(biome);
    const scale = Math.max(0.72, (obs.halfW * 2.15) / 100) * cam.zoom;
    this.pushSprite(pillarId, sx, sy, scale, scale, 0, 1, 1, 1, 1);
  }

  private renderBrazier(wx: number, wy: number, idx: number, cam: CameraView, timeSec: number): void {
    const sx = this.wxToSx(wx, cam);
    const sy = this.wyToSy(wy, 0, cam);
    const s = 0.72 * cam.zoom;
    this.pushSprite('prop_brazier', sx, sy, s, s, 0, 1, 1, 1, 1);

    // Animated dancing cel flames inside brazier bowl
    const flick = 0.88 + 0.18 * Math.sin(timeSec * 12.5 + idx * 1.9);
    const sway = Math.sin(timeSec * 8.2 + idx * 2.7) * 0.16;
    this.pushSprite(
      'vfx_flame_tongue',
      sx,
      sy - 32 * cam.zoom,
      0.56 * cam.zoom * flick,
      0.66 * cam.zoom * flick,
      sway,
      1.0,
      0.72,
      0.26,
      0.95,
      0,
      1.65
    );
    this.pushSprite(
      'vfx_flame_tongue',
      sx + 3 * cam.zoom,
      sy - 34 * cam.zoom,
      0.34 * cam.zoom * flick,
      0.44 * cam.zoom * flick,
      -sway * 1.2,
      1.0,
      0.96,
      0.72,
      0.92,
      0,
      2.1
    );
  }

  private renderDoor(door: ArenaDoor, cam: CameraView, timeSec: number): void {
    const sx = this.wxToSx(door.pos.x, cam);
    const sy = this.wyToSy(door.pos.y, 0, cam);
    const scale = 0.88 * cam.zoom;
    const isOpen = !door.locked;

    // Radiant beacon floor halo when unlocked!
    if (isOpen) {
      const pulse = 0.85 + 0.15 * Math.sin(timeSec * 4.2);
      const [rr, rg, rb] = door.reward.patronId
        ? hexToRgbaTuple(PATRON_CONSTANTS[door.reward.patronId].colorHex)
        : [0.35, 0.96, 0.72];
      this.pushSprite(
        'vfx_glow_soft',
        sx,
        sy - 18 * cam.zoom,
        1.7 * cam.zoom * pulse,
        1.1 * cam.zoom * pulse,
        0,
        rr,
        rg,
        rb,
        0.55,
        0,
        1.4
      );
    }

    this.pushSprite(
      isOpen ? 'prop_exit_door_open' : 'prop_exit_door_locked',
      sx,
      sy,
      scale,
      scale,
      0,
      1,
      1,
      1,
      1,
      0,
      isOpen ? 0.25 : 0
    );

    // Floating glowing Reward / Patron Sigil Medallion above doorway!
    const bob = Math.sin(timeSec * 3.4 + door.pos.x * 0.01) * 7 * cam.zoom;
    const sigilY = sy - 118 * cam.zoom + bob;
    const sigilId = door.reward.isBoss
      ? 'vfx_skull_badge'
      : door.reward.patronId
        ? getPatronSigilSpriteId(door.reward.patronId)
        : getPickupSpriteId(door.reward.kind);
    const sigilScale = (isOpen ? 0.78 : 0.62) * cam.zoom;
    this.pushSprite(
      sigilId,
      sx,
      sigilY,
      sigilScale,
      sigilScale,
      0,
      1,
      1,
      1,
      isOpen ? 1.0 : 0.72,
      0,
      isOpen ? 1.15 : 0.2
    );
  }

  private renderPickup(pk: PickupItem, cam: CameraView, timeSec: number): void {
    const sx = this.wxToSx(pk.pos.x, cam);
    const sy = this.wyToSy(pk.pos.y, 0, cam);
    const bob = Math.sin(timeSec * 4.0 + pk.pos.x * 0.03) * 8 * cam.zoom;

    const [r, g, b] = pk.patronId
      ? hexToRgbaTuple(PATRON_CONSTANTS[pk.patronId].colorHex)
      : pk.colorHex
        ? hexToRgbaTuple(pk.colorHex)
        : [1.0, 0.84, 0.34];

    // Radiant pulsing pedestal ring on the floor
    const pulse = 0.9 + 0.14 * Math.sin(timeSec * 5.2);
    this.pushSprite('vfx_glow_soft', sx, sy, 1.0 * cam.zoom * pulse, 0.62 * cam.zoom * pulse, 0, r, g, b, 0.52, 0, 1.4);
    this.pushEllipseRing(
      sx,
      sy,
      36 * cam.zoom * pulse,
      20 * cam.zoom * pulse,
      31 * cam.zoom * pulse,
      17 * cam.zoom * pulse,
      20,
      r,
      g,
      b,
      0.85,
      1.5
    );

    // Primordial Chaos Gate swirling floor chasm portal!
    if (pk.kind === 'chaos_gate') {
      const pulse = 0.94 + 0.08 * Math.sin(timeSec * 3.6);
      this.pushSprite('vfx_chaos_gate', sx, sy, 1.05 * cam.zoom * pulse, 1.05 * cam.zoom * pulse, 0, 1, 1, 1, 1, 0, 0.75);
      return;
    }

    const spriteId = getPickupSpriteId(pk.kind, pk.patronId);
    this.pushSprite(spriteId, sx, sy - 30 * cam.zoom + bob, 0.78 * cam.zoom, 0.78 * cam.zoom, 0, 1, 1, 1, 1, 0, 0.9);
  }

  private renderBloodstone(bs: BloodstoneDrop, cam: CameraView, timeSec: number): void {
    const sx = this.wxToSx(bs.pos.x, cam);
    const sy = this.wyToSy(bs.pos.y, 0, cam);
    const bob = Math.sin(timeSec * 6.5 + bs.pos.x * 0.04) * 5 * cam.zoom;
    this.pushSprite('vfx_glow_soft', sx, sy - 6 * cam.zoom, 0.55 * cam.zoom, 0.4 * cam.zoom, 0, 1.0, 0.16, 0.28, 0.65, 0, 1.4);
    this.pushSprite('vfx_bloodstone', sx, sy - 16 * cam.zoom + bob, 0.56 * cam.zoom, 0.56 * cam.zoom, Math.sin(timeSec * 3) * 0.15, 1, 1, 1, 1, 0, 1.15);
  }

  private renderDashGhosts(state: SimState, cam: CameraView): void {
    const ghosts = state.player.dashGhosts;
    if (ghosts.length === 0) return;

    // Tint ghosts with active Dash Boon color or default fiery crimson
    let gr = 0.98;
    let gg = 0.26;
    let gb = 0.3;
    for (let i = 0; i < state.player.boons.length; i++) {
      const b = state.player.boons[i];
      if (b.slot === 'dash') {
        const [r, g, bl] = hexToRgbaTuple(PATRON_CONSTANTS[b.patronId].colorHex);
        gr = r;
        gg = g;
        gb = bl;
        break;
      }
    }

    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      const pose = this.selectHeroPose(g.angle);
      const sx = this.wxToSx(g.x, cam);
      const sy = this.wyToSy(g.y, 0, cam);
      const flip = Math.cos(g.angle) < -0.15 ? -1 : 1;
      const scale = 0.8 * cam.zoom;
      this.pushSprite(
        pose,
        sx,
        sy,
        scale * flip,
        scale,
        0,
        gr,
        gg,
        gb,
        Math.max(0.08, g.alpha * 0.58),
        0.25,
        1.1
      );
    }
  }

  private renderHero(
    state: SimState,
    wx: number,
    wy: number,
    cam: CameraView,
    settings: RenderSettings,
    timeSec: number
  ): void {
    const p = state.player;
    const sx = this.wxToSx(wx, cam);
    const sy = this.wyToSy(wy, 0, cam);
    const speed = Math.hypot(p.vel.x, p.vel.y);
    const runBob = speed > 40 ? Math.abs(Math.sin(timeSec * 15.5)) * 6.5 * cam.zoom : Math.sin(timeSec * 3.2) * 1.8 * cam.zoom;

    // Fiery ember underfoot warm glow
    this.pushSprite(
      'vfx_glow_soft',
      sx,
      sy + 2 * cam.zoom,
      0.86 * cam.zoom,
      0.52 * cam.zoom,
      0,
      1.0,
      0.42,
      0.14,
      0.48,
      0,
      1.2
    );

    // Active Patron God Call radiant aura!
    if (p.godCallActiveTimer > 0 && p.godCallPatron) {
      const [cr, cg, cb] = hexToRgbaTuple(PATRON_CONSTANTS[p.godCallPatron].colorHex);
      const pulse = 1.0 + 0.16 * Math.sin(timeSec * 14);
      this.pushEllipseRing(sx, sy, 66 * cam.zoom * pulse, 38 * cam.zoom * pulse, 56 * cam.zoom * pulse, 32 * cam.zoom * pulse, 24, cr, cg, cb, 0.9, 2.2);
    }

    // Flowing Dynamic Crimson Bezier Cloak billowing opposite velocity!
    this.renderFlowingHeroCloak(sx, sy - runBob, p.vel.x, p.vel.y, p.facingAngle, cam, timeSec);

    // Directional Hero Ink-Cel Sprite
    const pose = this.selectHeroPose(p.facingAngle);
    const flip = Math.cos(p.facingAngle) < -0.12 ? -1 : 1;
    const scale = 0.82 * cam.zoom;
    const flash = settings.hitFlash && p.iframeTimer > 1.12 ? 0.82 : 0;
    const iframeBlink = p.iframeTimer > 0 && Math.floor(timeSec * 22) % 2 === 0 ? 0.72 : 1.0;

    // Subtle squash/stretch during dash or attack lunge
    const stretchX = p.dashTimer > 0 ? 1.16 : p.attackTimer > 0 ? 1.08 : 1.0;
    const stretchY = p.dashTimer > 0 ? 0.9 : p.attackTimer > 0 ? 0.95 : 1.0;

    this.pushSprite(
      pose,
      sx,
      sy - runBob,
      scale * stretchX * flip,
      scale * stretchY,
      0,
      1,
      1,
      1,
      iframeBlink,
      flash,
      0.08
    );

    // Equipped Infernal Arm held dynamically in heroic poise (never sticking vertically over head!)
    const wepId = getWeaponSpriteId(p.weaponId);
    const isSwinging = p.attackTimer > 0;
    const isCharging = p.attackChargeTimer > 0.12;
    const facingLeft = Math.cos(p.facingAngle) < -0.12;
    let wepAngle: number;
    let handX: number;
    let handY: number;

    if (isSwinging || isCharging) {
      const swingOffset = isSwinging ? (p.attackComboStep % 2 === 1 ? -1.1 : 1.1) : 0;
      wepAngle = p.facingAngle + swingOffset;
      handX = sx + Math.cos(p.facingAngle) * 20 * cam.zoom;
      handY = sy - 44 * cam.zoom - runBob + Math.sin(p.facingAngle) * 10 * cam.zoom;
    } else {
      // Heroic ready stance: blade angled low & outward at Prince Pyreus's sword-hand!
      const sideSign = facingLeft ? -1 : 1;
      const idleSway = Math.sin(timeSec * 4.4) * 0.06;
      wepAngle = facingLeft ? Math.PI - 0.38 + idleSway : 0.38 + idleSway;
      handX = sx + sideSign * 22 * cam.zoom;
      handY = sy - 36 * cam.zoom - runBob;
    }

    const wepScale = 0.72 * cam.zoom;
    const wepEmissive = isSwinging || isCharging ? 0.55 : 0.12;

    this.pushSprite(
      wepId,
      handX,
      handY,
      wepScale,
      wepScale * (Math.cos(wepAngle) < 0 ? -1 : 1),
      wepAngle,
      1,
      1,
      1,
      1,
      0,
      wepEmissive
    );

    // Bespoke Wave 2 Infernal Arm Active Stance VFX!
    if (p.weaponId === 'shield_of_chaos' && (p.isBlocking || p.attackChargeTimer > 0.08)) {
      // Glowing golden frontal Aegis Ward arc!
      this.pushSprite(
        'vfx_shield_block',
        sx + Math.cos(p.facingAngle) * 32 * cam.zoom,
        sy - 40 * cam.zoom + Math.sin(p.facingAngle) * 18 * cam.zoom,
        0.92 * cam.zoom,
        0.92 * cam.zoom,
        p.facingAngle,
        1,
        0.88,
        0.38,
        0.92,
        0,
        1.25
      );
    } else if (p.weaponId === 'heart_seeking_bow' && p.attackChargeTimer > 0.06) {
      // Converging golden aiming sight-lines + Power Shot starburst flash!
      const chargeFrac = Math.min(1, p.attackChargeTimer / 0.6);
      const spread = (1 - chargeFrac) * 0.42;
      const inPowerWindow = chargeFrac >= 0.72 && chargeFrac <= 0.98;
      const lineLen = (180 + chargeFrac * 260) * cam.zoom;
      const lR = inPowerWindow ? 1.0 : 0.96;
      const lG = inPowerWindow ? 0.92 : 0.74;
      const lB = inPowerWindow ? 0.34 : 0.3;
      this.pushLine(handX, handY, handX + Math.cos(p.facingAngle - spread) * lineLen, handY + Math.sin(p.facingAngle - spread) * lineLen * cam.isoScaleY, 2.2 * cam.zoom, lR, lG, lB, 0.78, 0.6);
      this.pushLine(handX, handY, handX + Math.cos(p.facingAngle + spread) * lineLen, handY + Math.sin(p.facingAngle + spread) * lineLen * cam.isoScaleY, 2.2 * cam.zoom, lR, lG, lB, 0.78, 0.6);
      if (inPowerWindow) {
        this.pushSprite('vfx_bow_flash', handX + Math.cos(p.facingAngle) * 18 * cam.zoom, handY + Math.sin(p.facingAngle) * 10 * cam.zoom, 0.75 * cam.zoom, 0.75 * cam.zoom, timeSec * 8, 1, 0.95, 0.45, 0.95, 0, 1.3);
      }
    } else if (p.weaponId === 'eternal_spear' && p.attackChargeTimer > 0.1) {
      // Expanding 3-tier Spear Spin Attack preview ring!
      const frac = Math.min(1, p.attackChargeTimer / 0.75);
      const rad = (170 + frac * 260) * cam.zoom;
      this.pushEllipseRing(sx, sy, rad, rad * cam.isoScaleY, rad - 3.5 * cam.zoom, (rad - 3.5 * cam.zoom) * cam.isoScaleY, 28, 1.0, 0.86, 0.36, 0.65, 0.6);
    } else if (p.weaponId === 'twin_fists' && (p.attackTimer > 0 || p.specialTimer > 0)) {
      // Fiery twin gauntlet burst glow!
      this.pushSprite('vfx_glow_soft', handX, handY, 0.7 * cam.zoom, 0.7 * cam.zoom, 0, 1.0, 0.42, 0.18, 0.72, 0, 1.2);
    }
  }

  private renderFlowingHeroCloak(
    sx: number,
    sy: number,
    vx: number,
    vy: number,
    facingAngle: number,
    cam: CameraView,
    timeSec: number
  ): void {
    const z = cam.zoom;
    const anchorX = sx - Math.cos(facingAngle) * 6 * z;
    const anchorY = sy - 54 * z;

    // Trail opposite velocity (or gently opposite facing direction when idle)
    const speed = Math.hypot(vx, vy);
    const dirX = speed > 30 ? -vx / speed : -Math.cos(facingAngle);
    const dirY = speed > 30 ? (-vy / speed) * cam.isoScaleY : -Math.sin(facingAngle) * cam.isoScaleY;
    const billowLen = (34 + Math.min(48, speed * 0.085)) * z;

    const segs = 6;
    let prevLx = 0,
      prevLy = 0,
      prevRx = 0,
      prevRy = 0;

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const flutter = Math.sin(timeSec * 11.5 - t * 4.2) * (3 + 9 * t) * z;
      const px = anchorX + dirX * billowLen * t + -dirY * flutter;
      const py = anchorY + (dirY * billowLen * t + 26 * t * z) + dirX * flutter * 0.4;
      const halfW = (13 + 14 * t - 4 * t * t) * z;
      const perpX = -dirY * halfW * 0.4 + halfW * 0.65;
      const perpY = dirX * halfW * 0.25;

      const lx = px - perpX;
      const ly = py - perpY;
      const rx = px + perpX;
      const ry = py + perpY;

      if (i > 0) {
        // Bold comic ink outer rim
        this.pushQuadSolid(
          prevLx - 2.5 * z,
          prevLy,
          prevRx + 2.5 * z,
          prevRy,
          rx + 2.5 * z,
          ry + 2.5 * z,
          lx - 2.5 * z,
          ly + 2.5 * z,
          0.04,
          0.02,
          0.06,
          0.95
        );
        // Deepening crimson cel cloak ribbon
        const cr = 0.86 - t * 0.34;
        const cg = 0.14 - t * 0.08;
        const cb = 0.2 - t * 0.08;
        this.pushQuadSolid(prevLx, prevLy, prevRx, prevRy, rx, ry, lx, ly, cr, cg, cb, 0.96);
        // Gold hem on tail tip
        if (i === segs) {
          this.pushLine(lx, ly, rx, ry, 3.2 * z, 0.94, 0.74, 0.32, 0.95, 0.3);
        }
      }
      prevLx = lx;
      prevLy = ly;
      prevRx = rx;
      prevRy = ry;
    }
  }

  private renderEnemy(
    e: EnemyState,
    wx: number,
    wy: number,
    cam: CameraView,
    settings: RenderSettings,
    timeSec: number
  ): void {
    const sx = this.wxToSx(wx, cam);
    const sy = this.wyToSy(wy, 0, cam);
    const spriteId = getEnemySpriteId(e.archetype, e.isBoss);
    const flip = Math.cos(e.facingAngle) < -0.15 ? -1 : 1;

    // Breathing + windup telegraph shake + boss commanding scale
    const breath = 1 + 0.03 * Math.sin(timeSec * 5.2 + e.pos.x * 0.05);
    const windupShake = e.aiState === 'windup' ? Math.sin(timeSec * 45) * 3.5 * cam.zoom : 0;
    const hoverZ =
      e.archetype === 'numbskull' || e.archetype === 'brimstone_crystal' || e.bossId === 'warden_malice'
        ? (12 + Math.sin(timeSec * 4.5 + e.pos.y * 0.04) * 6) * cam.zoom
        : 0;

    const baseScale = e.isBoss
      ? 0.98 * cam.zoom
      : e.archetype === 'rattlebones_dummy'
        ? 0.78 * cam.zoom
        : Math.max(0.68, (e.radius * 2.6) / 115) * cam.zoom;

    // Invulnerable boss phase shield dome!
    if (e.invulnerable) {
      this.pushEllipseRing(
        sx,
        sy - 56 * cam.zoom,
        74 * cam.zoom,
        88 * cam.zoom,
        64 * cam.zoom,
        78 * cam.zoom,
        24,
        0.95,
        0.35,
        1.0,
        0.85,
        1.8
      );
    }

    // Golden Armor Elite Aura beneath armored foes!
    if (e.armor > 0) {
      const pulse = 0.94 + 0.08 * Math.sin(timeSec * 7.5);
      this.pushEllipseRing(
        sx,
        sy,
        (e.radius + 12) * cam.zoom * pulse,
        (e.radius + 12) * cam.isoScaleY * cam.zoom * pulse,
        (e.radius + 6) * cam.zoom * pulse,
        (e.radius + 6) * cam.isoScaleY * cam.zoom * pulse,
        22,
        1.0,
        0.78,
        0.24,
        0.9,
        1.5
      );
    }

    // Main Ink-Cel Character Sprite (with crisp comic-ink white hit-flash!)
    const flash = settings.hitFlash && e.hitFlashTimer > 0 ? Math.min(1, e.hitFlashTimer * 12) : 0;
    const windupTintR = e.aiState === 'windup' ? 1.25 : 1.0;
    const windupTintG = e.aiState === 'windup' ? 0.82 : 1.0;
    const windupTintB = e.aiState === 'windup' ? 0.85 : 1.0;

    this.pushSprite(
      spriteId,
      sx + windupShake,
      sy - hoverZ,
      baseScale * flip,
      baseScale * breath,
      0,
      windupTintR,
      windupTintG,
      windupTintB,
      1,
      flash,
      e.isBoss ? 0.22 : e.aiState === 'windup' ? 0.45 : 0
    );

    // Lodged Bloodstone Crystals visibly embedded in target!
    for (let c = 0; c < Math.min(3, e.lodgedCasts); c++) {
      const ca = timeSec * 1.4 + c * 2.1;
      this.pushSprite(
        'vfx_bloodstone',
        sx + Math.cos(ca) * 20 * cam.zoom,
        sy - 44 * cam.zoom + Math.sin(ca) * 8 * cam.zoom,
        0.4 * cam.zoom,
        0.4 * cam.zoom,
        ca,
        1,
        1,
        1,
        1,
        0,
        1.3
      );
    }

    // Active Status Effect Badges orbiting above foe
    if (e.statuses.length > 0) {
      const topY = sy - (e.isBoss ? 186 : 112) * cam.zoom - hoverZ;
      const startX = sx - ((e.statuses.length - 1) * 14 * cam.zoom) * 0.5;
      for (let s = 0; s < e.statuses.length; s++) {
        const st = e.statuses[s];
        const px = startX + s * 14 * cam.zoom;
        const [sr, sg, sb] = this.statusRgb(st.id);
        this.pushEllipseFill(px, topY, 6 * cam.zoom, 6 * cam.zoom, 10, 0.05, 0.03, 0.08, 0.95);
        this.pushEllipseFill(px, topY, 4.2 * cam.zoom, 4.2 * cam.zoom, 10, sr, sg, sb, 1, 1.5);
      }
    }

    // Compact World Health & Gold Armor Bar for non-boss damaged enemies
    if (!e.isBoss && (e.hp < e.maxHp || e.armor > 0) && e.archetype !== 'rattlebones_dummy') {
      const bw = Math.max(46, e.radius * 1.6) * cam.zoom;
      const bh = 7 * cam.zoom;
      const bx = sx - bw * 0.5;
      const by = sy - 102 * cam.zoom - hoverZ;
      // Ink frame
      this.pushQuadSolid(bx - 2, by - 2, bx + bw + 2, by - 2, bx + bw + 2, by + bh + 2, bx - 2, by + bh + 2, 0.04, 0.03, 0.07, 0.95);
      // Dark track
      this.pushQuadSolid(bx, by, bx + bw, by, bx + bw, by + bh, bx, by + bh, 0.18, 0.07, 0.1, 0.95);
      // Crimson HP fill
      const hpFrac = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));
      this.pushQuadSolid(bx, by, bx + bw * hpFrac, by, bx + bw * hpFrac, by + bh, bx, by + bh, 0.94, 0.2, 0.28, 1, 0.3);
      // Gold Armor overlay bar above HP
      if (e.armor > 0 && e.maxArmor > 0) {
        const arFrac = Math.max(0, Math.min(1, e.armor / e.maxArmor));
        const ay = by - 5.5 * cam.zoom;
        this.pushQuadSolid(bx - 1, ay - 1, bx + bw + 1, ay - 1, bx + bw + 1, ay + 4 * cam.zoom, bx - 1, ay + 4 * cam.zoom, 0.05, 0.03, 0.05, 0.95);
        this.pushQuadSolid(bx, ay, bx + bw * arFrac, ay, bx + bw * arFrac, ay + 3 * cam.zoom, bx, ay + 3 * cam.zoom, 1.0, 0.8, 0.24, 1, 0.8);
      }
    }
  }

  private renderProjectile(
    pr: ProjectileState,
    obstacles: readonly ArenaObstacle[],
    cam: CameraView,
    timeSec: number
  ): void {
    const lobZ =
      pr.isLob && pr.lobDuration > 0
        ? Math.sin(Math.min(1, pr.lobElapsed / pr.lobDuration) * Math.PI) * pr.lobHeight
        : 22;

    const sx = this.wxToSx(pr.pos.x, cam);
    const sy = this.wyToSy(pr.pos.y, lobZ, cam);

    const [r, g, b] = pr.deflected
      ? [0.42, 0.96, 1.0]
      : pr.patronId
        ? hexToRgbaTuple(PATRON_CONSTANTS[pr.patronId].colorHex)
        : pr.colorHex
          ? hexToRgbaTuple(pr.colorHex)
          : pr.owner === 'player'
            ? [1.0, 0.34, 0.3]
            : [1.0, 0.26, 0.72];

    if (pr.isLob && pr.targetPos) {
      const tx = this.wxToSx(pr.targetPos.x, cam);
      const ty = this.wyToSy(pr.targetPos.y, 0, cam);
      const rAoe = (pr.aoeRadius ?? 80) * cam.zoom;
      this.pushEllipseRing(tx, ty, rAoe, rAoe * cam.isoScaleY, rAoe - 3 * cam.zoom, (rAoe - 3 * cam.zoom) * cam.isoScaleY, 20, r, g, b, 0.7, 1.2);
    }

    if (pr.kind === 'laser' || pr.kind === 'beam') {
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
        const travelDx = pr.pos.x - pr.startPos.x;
        const travelDy = pr.pos.y - pr.startPos.y;
        const travelDist = Math.hypot(travelDx, travelDy);
        if (travelDist > 4) {
          const preClip = this.clipRayToObstacles(
            obstacles,
            pr.startPos.x,
            pr.startPos.y,
            travelDx / travelDist,
            travelDy / travelDist,
            travelDist
          );
          if (preClip < travelDist - 1) return;
        }
        ox = pr.pos.x;
        oy = pr.pos.y;
        rawLen = Math.min(pr.range, 480);
      }

      const len = this.clipRayToObstacles(obstacles, ox, oy, c, s, Math.max(0, rawLen));
      const hitPillar = len < rawLen - 0.5;
      const x0 = this.wxToSx(ox, cam);
      const y0 = this.wyToSy(oy, 24, cam);
      const x1 = this.wxToSx(ox + c * len, cam);
      const y1 = this.wyToSy(oy + s * len, 24, cam);

      this.pushLine(x0, y0, x1, y1, (pr.radius * 1.48) * cam.zoom, 0.05, 0.02, 0.06, 0.94);
      this.pushLine(x0, y0, x1, y1, pr.radius * cam.zoom, r, g, b, 0.96, 1.45);
      this.pushLine(x0, y0, x1, y1, pr.radius * 0.42 * cam.zoom, 1, 0.98, 0.92, 1, 2.2);

      if (hitPillar) {
        // Pillar impact scorch flare & comic starburst where the beam terminates against stone!
        this.pushSprite('vfx_glow_soft', x1, y1, 0.65 * cam.zoom, 0.65 * cam.zoom, 0, r, g, b, 0.8, 0, 1.5);
        this.pushSprite('vfx_hit_spark', x1, y1, 0.54 * cam.zoom, 0.54 * cam.zoom, timeSec * 14, 1, 0.94, 0.78, 0.95, 0, 2.0);
      }
      return;
    }

    if (pr.kind === 'cast') {
      this.pushSprite('vfx_glow_soft', sx, sy, 0.56 * cam.zoom, 0.56 * cam.zoom, 0, r, g, b, 0.72, 0, 1.6);
      this.pushSprite('vfx_bloodstone', sx, sy, 0.55 * cam.zoom, 0.55 * cam.zoom, pr.angle + Math.PI * 0.5, 1, 1, 1, 1, 0, 1.3);
      return;
    }

    if (pr.kind === 'arrow' || pr.kind === 'dart' || pr.kind === 'bullet' || pr.kind === 'spear') {
      const sc = (pr.kind === 'spear' ? 0.9 : 0.74) * cam.zoom;
      this.pushSprite('vfx_projectile_arrow', sx, sy, sc, sc, pr.angle, r, g, b, 1, 0, 1.5);
      return;
    }

    if (pr.kind === 'shield') {
      this.pushSprite('weapon_shield_of_chaos', sx, sy, 0.65 * cam.zoom, 0.65 * cam.zoom, timeSec * 14, 1, 1, 1, 1, 0, 1.0);
      return;
    }

    if (pr.kind === 'blade_rift') {
      const sc = Math.max(0.75, (pr.radius * 2.2) / 96) * cam.zoom;
      this.pushSprite('vfx_blade_rift', sx, sy, sc, sc * cam.isoScaleY, timeSec * 12, 1, 1, 1, 0.96, 0, 0.7);
      return;
    }

    if (pr.kind === 'skull') {
      const sc = Math.max(0.62, (pr.radius * 2.4) / 68) * cam.zoom;
      this.pushSprite('vfx_skull_proj', sx, sy, sc, sc, Math.sin(timeSec * 6) * 0.2, 1, 1, 1, 1, 0, 0.85);
      return;
    }

    // Default glowing energy orb / wave / bomb
    const orbScale = Math.max(0.45, (pr.radius * 2.4) / 52) * cam.zoom;
    this.pushSprite('vfx_glow_soft', sx, sy, orbScale * 1.15, orbScale * 1.15, 0, r, g, b, 0.58, 0, 1.6);
    this.pushSprite('vfx_projectile_orb', sx, sy, orbScale, orbScale, timeSec * 5, r, g, b, 1, 0, 1.8);
  }

  // ============================================================================
  // Painterly Bezier Weapon Slash Ribbons & Particles
  // ============================================================================

  private renderSlashRibbons(vfx: ParticlesAndDecals, cam: CameraView): void {
    for (let i = 0; i < MAX_SLASH_RIBBONS; i++) {
      const rb = vfx.ribbons[i];
      if (!rb.active) continue;
      this.drawSlashRibbon(rb, cam);
    }
  }

  private drawSlashRibbon(rb: SlashRibbon, cam: CameraView): void {
    const progress = 1 - Math.max(0, Math.min(1, rb.life / Math.max(0.001, rb.maxLife)));
    const fade = Math.pow(1 - progress, 0.68);
    const sx = this.wxToSx(rb.x, cam);
    const sy = this.wyToSy(rb.y, 26, cam);

    if (rb.kind === 'nova' || rb.kind === 'whip') {
      const grow = 0.35 + 0.75 * Math.pow(progress, 0.45);
      const rx = rb.radius * grow * cam.zoom;
      const ry = rb.radius * grow * cam.isoScaleY * cam.zoom;
      const thick = rb.thickness * (1 - progress * 0.55) * cam.zoom;
      // Outer comic ink contour ring
      this.pushEllipseRing(sx, sy, rx + 5 * cam.zoom, ry + 3 * cam.zoom, Math.max(1, rx - thick - 4 * cam.zoom), Math.max(1, ry - thick * cam.isoScaleY - 2.5 * cam.zoom), 30, 0.04, 0.02, 0.06, fade * 0.94);
      // Vivid saturated Boon-tinted energy wave (low emissive preserves rich electric yellow/cyan/crimson hue!)
      this.pushEllipseRing(sx, sy, rx, ry, Math.max(1, rx - thick), Math.max(1, ry - thick * cam.isoScaleY), 30, rb.r, rb.g, rb.b, fade * 0.94, 0.28);
      // Thin hot inner rim
      this.pushEllipseRing(sx, sy, rx - thick * 0.32, ry - thick * 0.32 * cam.isoScaleY, Math.max(1, rx - thick * 0.5), Math.max(1, ry - thick * 0.5 * cam.isoScaleY), 30, rb.coreR, rb.coreG, rb.coreB, fade, 0.85);
      return;
    }

    if (rb.kind === 'thrust') {
      const reach = rb.radius * 0.84 * (0.45 + 0.65 * Math.min(1, progress * 2.2)) * cam.zoom;
      const c = Math.cos(rb.angle);
      const s = Math.sin(rb.angle);
      const perpX = -s * rb.thickness * (1 - progress * 0.4) * cam.zoom;
      const perpY = c * rb.thickness * cam.isoScaleY * (1 - progress * 0.4) * cam.zoom;
      const tipX = sx + c * reach;
      const tipY = sy + s * reach * cam.isoScaleY;
      const baseX = sx + c * 18 * cam.zoom;
      const baseY = sy + s * 18 * cam.isoScaleY * cam.zoom;

      // Bold ink lance contour
      this.pushTriSolid(tipX + c * 9 * cam.zoom, tipY + s * 5 * cam.zoom, baseX + perpX * 1.28, baseY + perpY * 1.28, baseX - perpX * 1.28, baseY - perpY * 1.28, 0.04, 0.02, 0.06, fade * 0.94);
      // Saturated Boon-tinted piercing blade wave
      this.pushTriSolid(tipX, tipY, baseX + perpX, baseY + perpY, baseX - perpX, baseY - perpY, rb.r, rb.g, rb.b, fade * 0.96, 0.25);
      // Thin bright inner spear streak
      this.pushTriSolid(tipX - c * 4 * cam.zoom, tipY - s * 2 * cam.zoom, baseX + perpX * 0.32, baseY + perpY * 0.32, baseX - perpX * 0.32, baseY - perpY * 0.32, rb.coreR, rb.coreG, rb.coreB, fade, 0.9);
      return;
    }

    // Sweeping Painterly Bezier Crescent Slash Ribbon ('arc') — hugs tightly around hero's blade reach!
    const segs = 18;
    const sweepHead = Math.min(1, progress * 2.8);
    const sweepTail = Math.max(0, (progress - 0.14) * 1.18);
    const startA = rb.angle - (rb.arcSpan * 0.52) * rb.flip;
    const endA = rb.angle + (rb.arcSpan * 0.52) * rb.flip;

    // Tighter radius around hero blade arc + dramatic wide crescent body so ribbon never floats detached!
    const rx = rb.radius * 0.68 * cam.zoom;
    const ry = rb.radius * 0.68 * cam.isoScaleY * cam.zoom;
    const maxThick = Math.max(58, rb.thickness * 1.38) * cam.zoom * (1 - progress * 0.32);

    const drawRibbonBand = (
      outerPad: number,
      thickScale: number,
      r: number,
      g: number,
      b: number,
      a: number,
      emissive: number
    ) => {
      let prevOx = 0,
        prevOy = 0,
        prevIx = 0,
        prevIy = 0;
      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const t = sweepTail + (sweepHead - sweepTail) * u;
        const ang = startA + (endA - startA) * t;
        // Painterly tapered crescent: razor-sharp tail & leading blade tip, sweeping wide crest!
        const taper = Math.sin(u * Math.PI) * (0.35 + 0.78 * u);
        const w = maxThick * thickScale * taper;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);

        const ox = sx + ca * (rx + outerPad * cam.zoom);
        const oy = sy + sa * (ry + outerPad * cam.isoScaleY * cam.zoom);
        const ix = sx + ca * Math.max(12 * cam.zoom, rx - w);
        const iy = sy + sa * Math.max(7 * cam.zoom, ry - w * cam.isoScaleY);

        if (s > 0) {
          this.pushQuadSolid(prevIx, prevIy, prevOx, prevOy, ox, oy, ix, iy, r, g, b, a * (0.3 + 0.7 * u), emissive);
        }
        prevOx = ox;
        prevOy = oy;
        prevIx = ix;
        prevIy = iy;
      }
    };

    // Layer 1: Bold jet-black comic ink outer rim (unmistakable painterly hand-inked slash!)
    drawRibbonBand(6.5, 1.14, 0.04, 0.02, 0.07, fade * 0.96, 0);
    // Layer 2: Rich saturated Boon-colored outer crescent (low emissive keeps Voltaris electric #FFFA40, never beige!)
    drawRibbonBand(2.0, 1.0, rb.r, rb.g, rb.b, fade * 0.95, 0.18);
    // Layer 3: Mid-inner high-chroma band
    drawRibbonBand(-1.5, 0.62, Math.min(1, rb.r * 1.08), Math.min(1, rb.g * 1.05), Math.min(1, rb.b * 1.05), fade * 0.92, 0.35);
    // Layer 4: Razor-thin blazing specular edge along outer blade tip!
    drawRibbonBand(0.5, 0.2, rb.coreR, rb.coreG, rb.coreB, fade * 0.95, 0.85);
  }

  private renderParticles(vfx: ParticlesAndDecals, cam: CameraView): void {
    // Alpha-blended particles first (shards, smoke, rose petals, splashes, petals, snowflakes)
    this.setBatchState(this.atlasTex, 'alpha');
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = vfx.particles[i];
      if (!p.active) continue;
      if (
        p.kind !== 'shard' &&
        p.kind !== 'smoke' &&
        p.kind !== 'rose' &&
        p.kind !== 'splash' &&
        p.kind !== 'petal' &&
        p.kind !== 'snowflake'
      ) {
        continue;
      }
      const t = 1 - p.life / Math.max(0.001, p.maxLife);
      const sz = (p.size + (p.endSize - p.size) * t) * cam.zoom;
      const a = p.alpha * (1 - t);
      const sx = this.wxToSx(p.x, cam);
      const sy = this.wyToSy(p.y, p.z, cam);

      if (p.kind === 'petal' || p.kind === 'rose') {
        this.pushSprite('vfx_petal', sx, sy, sz / 36, sz / 36, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'snowflake') {
        this.pushSprite('vfx_snowflake', sx, sy, sz / 38, sz / 38, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'splash') {
        this.pushSprite('vfx_wave_crest', sx, sy, sz / 72, sz / 72, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'shard') {
        this.pushSprite('vfx_spark_burst', sx, sy, sz / 64, sz / 84, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else {
        this.pushSprite('vfx_glow_soft', sx, sy, sz / 56, sz / 56, p.angle, p.r, p.g, p.b, a * 0.65, 0, p.emissive * 0.6);
      }
    }

    // Additive glowing VFX particles (ember footsteps, hit sparks, lightning bolts, flames, muzzle flash, shockwaves)
    this.setBatchState(this.atlasTex, 'additive');
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = vfx.particles[i];
      if (!p.active) continue;
      if (
        p.kind === 'shard' ||
        p.kind === 'smoke' ||
        p.kind === 'rose' ||
        p.kind === 'splash' ||
        p.kind === 'petal' ||
        p.kind === 'snowflake'
      ) {
        continue;
      }
      const t = 1 - p.life / Math.max(0.001, p.maxLife);
      const sz = (p.size + (p.endSize - p.size) * t) * cam.zoom;
      const a = p.alpha * (1 - t);
      const sx = this.wxToSx(p.x, cam);
      const sy = this.wyToSy(p.y, p.z, cam);

      if (p.kind === 'muzzle_flash') {
        this.pushSprite('vfx_muzzle_flash', sx, sy, sz / 54, sz / 54, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'shockwave' || p.kind === 'deflect_ring') {
        const sc = sz / 58;
        this.pushSprite('vfx_ring_soft', sx, sy, sc, sc * cam.isoScaleY, 0, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'bolt') {
        this.pushSprite('vfx_lightning_bolt', sx, sy, sz / 64, sz / 64, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'ember_footstep' || p.kind === 'flame') {
        this.pushSprite('vfx_flame_tongue', sx, sy, sz / 54, sz / 54, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else {
        // Directional comic hit spark
        this.pushSprite('vfx_spark_burst', sx, sy, (sz / 58) * 1.25, sz / 68, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      }
    }
    this.setBatchState(this.atlasTex, 'alpha');
  }

  // ============================================================================
  // Pass 4 Implementation: Dynamic Additive Lightmap FBO
  // ============================================================================

  private renderDynamicLightmap(
    state: SimState,
    prevState: SimState | null,
    cam: CameraView,
    vfx: ParticlesAndDecals,
    theme: BiomeVisualTheme,
    timeSec: number
  ): void {
    if (!this.lightFbo) return;
    const gl = this.gl;
    this.lightVertCount = 0;

    // 1. Flickering stone braziers (warm golden-orange light pools!)
    for (let i = 0; i < this.braziers.length; i++) {
      const br = this.braziers[i];
      const flick = 0.86 + 0.14 * Math.sin(timeSec * 11.4 + i * 2.1);
      const rad = 240 * cam.zoom * flick;
      this.pushLight(
        this.wxToSx(br.x, cam),
        this.wyToSy(br.y, 28, cam),
        rad,
        rad * 0.72,
        theme.brazierColor[0],
        theme.brazierColor[1],
        theme.brazierColor[2],
        0.92
      );
    }

    // 2. Hero ember glow + active weapon aura
    const heroPos = this.interpPlayerPos(state, prevState, cam.interpAlpha);
    const heroRad = 210 * cam.zoom;
    this.pushLight(
      this.wxToSx(heroPos.x, cam),
      this.wyToSy(heroPos.y, 24, cam),
      heroRad,
      heroRad * 0.7,
      1.0,
      0.56,
      0.28,
      0.72
    );

    // 3. Open chamber exit portals & Boon pickups
    for (let i = 0; i < state.room.doors.length; i++) {
      const d = state.room.doors[i];
      if (d.locked) continue;
      const [r, g, b] = d.reward.patronId
        ? hexToRgbaTuple(PATRON_CONSTANTS[d.reward.patronId].colorHex)
        : theme.rimGlow;
      const rad = 230 * cam.zoom;
      this.pushLight(this.wxToSx(d.pos.x, cam), this.wyToSy(d.pos.y, 30, cam), rad, rad * 0.72, r, g, b, 0.95);
    }
    for (let i = 0; i < state.room.pickups.length; i++) {
      const pk = state.room.pickups[i];
      if (pk.collected) continue;
      const [r, g, b] = pk.patronId
        ? hexToRgbaTuple(PATRON_CONSTANTS[pk.patronId].colorHex)
        : [1.0, 0.84, 0.35];
      const rad = 175 * cam.zoom;
      this.pushLight(this.wxToSx(pk.pos.x, cam), this.wyToSy(pk.pos.y, 18, cam), rad, rad * 0.7, r, g, b, 0.9);
    }

    // 4. Active Slash Ribbons illuminating nearby stone flagstones with Boon color!
    for (let i = 0; i < MAX_SLASH_RIBBONS; i++) {
      const rb = vfx.ribbons[i];
      if (!rb.active) continue;
      const fade = rb.life / Math.max(0.001, rb.maxLife);
      const rad = (rb.radius * 1.45) * cam.zoom;
      this.pushLight(
        this.wxToSx(rb.x, cam),
        this.wyToSy(rb.y, 22, cam),
        rad,
        rad * 0.7,
        rb.r,
        rb.g,
        rb.b,
        fade * 1.15
      );
    }

    // 5. Projectiles & Boss aura
    for (let i = 0; i < state.projectiles.length; i++) {
      const pr = state.projectiles[i];
      const [r, g, b] = pr.patronId
        ? hexToRgbaTuple(PATRON_CONSTANTS[pr.patronId].colorHex)
        : pr.owner === 'player'
          ? [1.0, 0.35, 0.25]
          : [1.0, 0.28, 0.76];
      const rad = Math.max(70, pr.radius * 4.5) * cam.zoom;
      this.pushLight(this.wxToSx(pr.pos.x, cam), this.wyToSy(pr.pos.y, 20, cam), rad, rad * 0.7, r, g, b, 0.65);
    }
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (!e.isBoss || e.aiState === 'dead') continue;
      const rad = 320 * cam.zoom;
      this.pushLight(this.wxToSx(e.pos.x, cam), this.wyToSy(e.pos.y, 40, cam), rad, rad * 0.72, 0.95, 0.24, 0.85, 0.88);
    }

    // Render lightmap FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightFbo.fbo);
    gl.viewport(0, 0, this.lightFbo.w, this.lightFbo.h);
    gl.clearColor(theme.ambientLight[0], theme.ambientLight[1], theme.ambientLight[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.lightVertCount > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.lightProg);
      gl.uniform2f(this.uLight.uResolution, this.viewW, this.viewH);
      gl.bindVertexArray(this.lightVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lightVbo);
      gl.bufferSubData(
        gl.ARRAY_BUFFER,
        0,
        this.lightData.subarray(0, this.lightVertCount * FLOATS_PER_LIGHT_VERT)
      );
      gl.drawArrays(gl.TRIANGLES, 0, this.lightVertCount);
      this.drawCalls++;
    }
  }

  // ============================================================================
  // Crisp Comic-Ink Floating Damage Numbers (Pre-Baked Glyph Atlas in WebGL2)
  // ============================================================================

  private renderFloatingNumbers(state: SimState, cam: CameraView): void {
    const list = state.floatingNumbers;
    for (let i = 0; i < list.length; i++) {
      const fn = list[i];
      const style = getDamageNumberStyle(fn);
      const progress = 1 - Math.max(0, Math.min(1, fn.life / Math.max(0.001, fn.maxLife)));
      const pop =
        progress < 0.14
          ? 0.58 + 0.7 * Math.sin((progress / 0.14) * Math.PI * 0.65)
          : progress < 0.25
            ? 1.14 - 0.14 * ((progress - 0.14) / 0.11)
            : 1.0;
      const alpha = progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;
      if (alpha <= 0.01) continue;

      const sx = this.wxToSx(fn.pos.x, cam);
      const sy = this.wyToSy(fn.pos.y, 64, cam);
      const scale = 0.44 * style.scale * pop;
      const [tr, tg, tb] = style.tintRgba;

      if (style.tag) {
        this.drawBitmapString(style.tag, sx, sy - 24 * style.scale, scale * 0.56, tr, tg, tb, alpha);
      }
      this.drawBitmapString(formatFloatingNumberText(fn), sx, sy, scale, tr, tg, tb, alpha);
    }
  }

  private drawBitmapString(
    text: string,
    cx: number,
    cy: number,
    scale: number,
    r: number,
    g: number,
    b: number,
    a: number
  ): void {
    const upper = text.toUpperCase();
    let totalW = 0;
    for (let i = 0; i < upper.length; i++) {
      const m = this.fontAtlas.glyphs.get(upper[i]);
      totalW += (m ? m.advance : 24) * scale;
    }

    let cursorX = cx - totalW * 0.5;
    for (let i = 0; i < upper.length; i++) {
      const m = this.fontAtlas.glyphs.get(upper[i]);
      if (!m) {
        cursorX += 20 * scale;
        continue;
      }
      const gw = m.w * scale;
      const gh = m.h * scale;
      const gx = cursorX + m.advance * scale * 0.5 - gw * 0.5;
      const gy = cy - gh * 0.5;
      if (this.batchVertCount + 6 > MAX_BATCH_VERTS) this.flushBatch();
      this.pushVert(gx, gy, m.u0, m.v0, r, g, b, a, 0, 0.15);
      this.pushVert(gx + gw, gy, m.u1, m.v0, r, g, b, a, 0, 0.15);
      this.pushVert(gx + gw, gy + gh, m.u1, m.v1, r, g, b, a, 0, 0.15);
      this.pushVert(gx, gy, m.u0, m.v0, r, g, b, a, 0, 0.15);
      this.pushVert(gx + gw, gy + gh, m.u1, m.v1, r, g, b, a, 0, 0.15);
      this.pushVert(gx, gy + gh, m.u0, m.v1, r, g, b, a, 0, 0.15);
      cursorX += m.advance * scale;
    }
  }

  // ============================================================================
  // Interpolation & Utility Helpers
  // ============================================================================

  private interpPlayerPos(state: SimState, prevState: SimState | null, alpha: number): { x: number; y: number } {
    if (!prevState || alpha >= 0.999) return state.player.pos;
    const dx = state.player.pos.x - prevState.player.pos.x;
    const dy = state.player.pos.y - prevState.player.pos.y;
    if (dx * dx + dy * dy > 220 * 220) return state.player.pos; // avoid lerp across room warp
    return {
      x: prevState.player.pos.x + dx * alpha,
      y: prevState.player.pos.y + dy * alpha,
    };
  }

  private interpEnemyPos(e: EnemyState, prevState: SimState | null, alpha: number): { x: number; y: number } {
    if (!prevState || alpha >= 0.999) return e.pos;
    for (let i = 0; i < prevState.enemies.length; i++) {
      const pe = prevState.enemies[i];
      if (pe.id === e.id) {
        const dx = e.pos.x - pe.pos.x;
        const dy = e.pos.y - pe.pos.y;
        if (dx * dx + dy * dy > 220 * 220) return e.pos;
        return { x: pe.pos.x + dx * alpha, y: pe.pos.y + dy * alpha };
      }
    }
    return e.pos;
  }

  private selectHeroPose(angle: number): string {
    const s = Math.sin(angle);
    const c = Math.abs(Math.cos(angle));
    if (s < -0.78) return 'hero_up';
    if (s > 0.78) return 'hero_down';
    if (c > 0.85) return 'hero_side';
    return s < 0 ? 'hero_diag_up' : 'hero_diag_down';
  }

  private statusRgb(id: string): [number, number, number] {
    switch (id) {
      case 'jolted':
        return [1.0, 0.98, 0.25];
      case 'ruptured':
        return [0.0, 0.8, 1.0];
      case 'exposed':
        return [1.0, 0.75, 0.2];
      case 'weak':
        return [1.0, 0.22, 0.94];
      case 'marked':
        return [0.44, 1.0, 0.0];
      case 'doom':
        return [1.0, 0.1, 0.1];
      case 'hangover':
        return [0.78, 0.0, 1.0];
      case 'chill':
        return [0.45, 0.82, 1.0];
      default:
        return [0.72, 0.94, 0.3];
    }
  }

  /** Hot-swaps the GPU atlas texture ONCE when toggling BUILTIN <-> CUSTOM_PACK. */
  public setAtlasCanvas(canvas: HTMLCanvasElement): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }

  public dispose(): void {
    const gl = this.gl;
    this.destroyFbo(this.sceneFbo);
    this.destroyFbo(this.lightFbo);
    this.destroyFbo(this.bloomFboA);
    this.destroyFbo(this.bloomFboB);
    this.sceneFbo = null;
    this.lightFbo = null;
    this.bloomFboA = null;
    this.bloomFboB = null;
    gl.deleteTexture(this.atlasTex);
    gl.deleteTexture(this.fontTex);
    gl.deleteBuffer(this.batchVbo);
    gl.deleteVertexArray(this.batchVao);
    gl.deleteBuffer(this.lightVbo);
    gl.deleteVertexArray(this.lightVao);
    gl.deleteVertexArray(this.emptyVao);
    gl.deleteProgram(this.abyssProg);
    gl.deleteProgram(this.batchProg);
    gl.deleteProgram(this.lightProg);
    gl.deleteProgram(this.bloomExtractProg);
    gl.deleteProgram(this.bloomBlurProg);
    gl.deleteProgram(this.compositeProg);
  }
}
