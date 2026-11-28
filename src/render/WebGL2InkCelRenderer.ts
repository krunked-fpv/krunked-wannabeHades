/**
 * WebGL2InkCelRenderer — 7-Pass Mythic Ink-Cel Chiaroscuro WebGL2 Pipeline.
 *
 *   Pass 1:   All-Biome Deep Abyssal Chasm Parallax & Atmospheric Spectacle (sceneFBO)
 *   Pass 2:   Architectural 3D Retaining Walls, Stepped Parapets, Corner Obelisks, Biome-Matched
 *             3D Chasm Cliffs, Varied 4-Variant Weathered Flagstones + Central Mosaic Medallion,
 *             Pits & Persistent Floor Decals (sceneFBO)
 *   Pass 1.5: Dedicated Procedural Animated GLSL Hazard Pass (FBM Magma, Voronoi Caustic Bile,
 *             Rotating Consecrated Runes, Rippling Turquoise Curing Caustics) (sceneFBO)
 *   Pass 2b:  Biome/Boss-Themed Danger Rune Telegraphs + Two-Layer Contact AO & Directional SE
 *             Cast Ground Shadows (sceneFBO)
 *   Pass 3:   Y-Sorted Ink-Cel Entities, Braziers, Obelisks, Doors, Pickups, Dash Ghosts, Hero
 *             + Cloak + Weapon, 4-Layer Searing Beams, 3-Layer Sweeping Comic Slash Smears,
 *             Directional Hit-Spark Streaks & Volumetric Light Cones (sceneFBO)
 *   Pass 4:   Additive Dynamic Lightmap FBO (flickering braziers, wall sconces, hazards, portals)
 *   Pass 5:   Dual-Pass Selective Bloom FBO (bright extract + separable H/V 9-tap Gaussian blur)
 *   Pass 6:   Radial Shockwave, Chromatic Aberration, Chiaroscuro Lightmap, Jewel-Tone Color Grade,
 *             Split Vignette, Ink/Paper Micro-Grain + Pre-Baked Mythic Floating Damage Numbers!
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
  ATLAS_SPRITE_RECTS,
  getBiomePillarSpriteId,
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
import type { BiomeSurfaceTextures } from '../assets/PaintedArtLoader.js';
import type { ParticlesAndDecals, SlashRibbon } from './ParticlesAndDecals.js';
import { MAX_DECALS, MAX_PARTICLES, MAX_SLASH_RIBBONS } from './ParticlesAndDecals.js';
import {
  ABYSS_FRAG,
  BATCH_FRAG,
  BATCH_VERT,
  BLOOM_BLUR_FRAG,
  BLOOM_EXTRACT_FRAG,
  COMPOSITE_FRAG,
  FLOOR_FRAG,
  FLOOR_VERT,
  FULLSCREEN_VERT,
  HAZARD_FRAG,
  HAZARD_VERT,
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
  floorBase: [number, number, number];
  wallDark: [number, number, number];
  wallLit: [number, number, number];
  wallTrim: [number, number, number];
  cliffFallbackTint: [number, number, number];
  telegraphPrimary: [number, number, number];
  telegraphAccent: [number, number, number];
}

// Canonical Master Biome & Courtyard Color/Lighting Palettes (Style Bible Section 2)
const BIOME_THEMES: Record<BiomeId, BiomeVisualTheme> = {
  sanctum_hub: {
    deep: [0.043, 0.024, 0.071], // #0B0612
    mid: [0.135, 0.068, 0.175],
    mist: [0.34, 0.14, 0.28],
    accent: [0.902, 0.722, 0.298], // #E6B84C
    ambientLight: [0.22, 0.16, 0.27],
    shadowTint: [0.96, 0.9, 1.06],
    midtoneTint: [1.03, 0.99, 1.05],
    highlightTint: [1.08, 1.02, 0.94],
    brazierColor: [1.0, 0.549, 0.212], // #FF8C36
    rimGlow: [0.95, 0.5, 0.24],
    floorBase: [0.118, 0.075, 0.161], // #1E1329
    wallDark: [0.141, 0.09, 0.192], // #241731
    wallLit: [0.29, 0.2, 0.38], // #4A3361
    wallTrim: [0.839, 0.651, 0.278], // #D6A647
    cliffFallbackTint: [0.68, 0.56, 0.84],
    telegraphPrimary: [1.0, 0.22, 0.32],
    telegraphAccent: [0.94, 0.74, 0.3],
  },
  obsidian_pit: {
    deep: [0.024, 0.055, 0.071], // #060E12
    mid: [0.062, 0.15, 0.172],
    mist: [0.105, 0.36, 0.32],
    accent: [0.157, 0.941, 0.706], // #28F0B4
    ambientLight: [0.15, 0.25, 0.24],
    shadowTint: [0.88, 1.02, 1.04],
    midtoneTint: [0.95, 1.03, 1.04],
    highlightTint: [1.06, 1.04, 0.96],
    brazierColor: [1.0, 0.471, 0.173], // #FF782C
    rimGlow: [0.173, 0.902, 0.659], // #2CE6A8
    floorBase: [0.082, 0.141, 0.169], // #15242B
    wallDark: [0.094, 0.153, 0.18], // #18272E
    wallLit: [0.196, 0.306, 0.349], // #324E59
    wallTrim: [0.173, 0.902, 0.659], // #2CE6A8
    cliffFallbackTint: [0.88, 0.98, 1.0],
    telegraphPrimary: [1.0, 0.165, 0.29], // #FF2A4A
    telegraphAccent: [0.72, 0.22, 1.0],
  },
  cinder_mire: {
    deep: [0.102, 0.027, 0.024], // #1A0706
    mid: [0.25, 0.075, 0.045],
    mist: [0.64, 0.21, 0.075],
    accent: [1.0, 0.353, 0.078], // #FF5A14
    ambientLight: [0.27, 0.14, 0.11],
    shadowTint: [1.08, 0.88, 0.84],
    midtoneTint: [1.1, 0.96, 0.86],
    highlightTint: [1.12, 1.01, 0.86],
    brazierColor: [1.0, 0.44, 0.12],
    rimGlow: [1.0, 0.353, 0.078],
    floorBase: [0.137, 0.075, 0.071], // #231312
    wallDark: [0.141, 0.071, 0.071], // #241212
    wallLit: [0.29, 0.141, 0.118], // #4A241E
    wallTrim: [0.91, 0.51, 0.18], // #E8822E
    cliffFallbackTint: [1.06, 0.52, 0.36],
    telegraphPrimary: [1.0, 0.33, 0.08],
    telegraphAccent: [1.0, 0.82, 0.28],
  },
  verdant_colosseum: {
    deep: [0.059, 0.176, 0.22], // #0F2D38
    mid: [0.12, 0.34, 0.4],
    mist: [0.24, 0.58, 0.58],
    accent: [1.0, 0.886, 0.522], // #FFE285
    ambientLight: [0.21, 0.32, 0.33],
    shadowTint: [0.88, 1.03, 1.06],
    midtoneTint: [0.98, 1.05, 1.02],
    highlightTint: [1.08, 1.07, 0.96],
    brazierColor: [1.0, 0.82, 0.44],
    rimGlow: [0.949, 0.788, 0.369], // #F2C95E
    floorBase: [0.102, 0.251, 0.286], // #1A4049
    wallDark: [0.141, 0.325, 0.369], // #24535E
    wallLit: [0.345, 0.643, 0.659], // #58A4A8
    wallTrim: [0.949, 0.788, 0.369], // #F2C95E
    cliffFallbackTint: [0.8, 1.05, 1.06],
    telegraphPrimary: [0.95, 0.72, 0.19],
    telegraphAccent: [1.0, 0.18, 0.3],
  },
  crypt_of_bile: {
    deep: [0.047, 0.071, 0.027], // #0C1207
    mid: [0.135, 0.18, 0.068],
    mist: [0.32, 0.43, 0.11],
    accent: [0.612, 0.941, 0.141], // #9CF024
    ambientLight: [0.2, 0.24, 0.13],
    shadowTint: [0.95, 1.03, 0.84],
    midtoneTint: [0.97, 1.04, 0.88],
    highlightTint: [1.06, 1.07, 0.88],
    brazierColor: [0.96, 0.76, 0.28], // warm tarnished brass torch contrasting bile green!
    rimGlow: [0.55, 0.9, 0.14],
    floorBase: [0.149, 0.165, 0.094], // #262A18
    wallDark: [0.161, 0.18, 0.102], // #292E1A
    wallLit: [0.31, 0.337, 0.188], // #4F5630
    wallTrim: [0.769, 0.608, 0.243], // #C49B3E
    cliffFallbackTint: [0.84, 0.92, 0.56],
    telegraphPrimary: [0.65, 0.94, 0.13],
    telegraphAccent: [1.0, 0.22, 0.31],
  },
  frozen_summit: {
    deep: [0.043, 0.075, 0.141], // #0B1324
    mid: [0.125, 0.21, 0.33],
    mist: [0.32, 0.51, 0.68],
    accent: [0.424, 0.902, 1.0], // #6CE6FF
    ambientLight: [0.22, 0.29, 0.39],
    shadowTint: [0.88, 0.96, 1.11],
    midtoneTint: [0.96, 1.01, 1.09],
    highlightTint: [1.06, 1.08, 1.14],
    brazierColor: [1.0, 0.56, 0.28], // warm fire vs boreal cold
    rimGlow: [0.54, 0.88, 1.0],
    floorBase: [0.137, 0.2, 0.278], // #233347
    wallDark: [0.122, 0.188, 0.278], // #1F3047
    wallLit: [0.294, 0.431, 0.58], // #4B6E94
    wallTrim: [0.839, 0.941, 1.0], // #D6F0FF
    cliffFallbackTint: [0.76, 0.92, 1.18],
    telegraphPrimary: [1.0, 0.14, 0.26], // Royal Sovereign crimson
    telegraphAccent: [0.98, 0.74, 0.28], // Hammered imperial gold
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
  | 'obelisk'
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

interface CornerObelisk {
  x: number;
  y: number;
  north: boolean;
}

const MAX_BATCH_VERTS = 60000; // 20,000 triangles per flush
const FLOATS_PER_VERT = 10; // x, y, u, v, r, g, b, a, flashWhite, emissiveBoost
const MAX_LIGHTS = 160;
const FLOATS_PER_LIGHT_VERT = 8; // x, y, lx, ly, r, g, b, intensity
const MAX_SORT_ITEMS = 540;

// Strict Global Light Rig (Style Bible Section 1.1): Key Light NW [-0.62, -0.78] -> Cast SE [+0.68, +0.44]
const SHADOW_DIR_X = 0.68;
const SHADOW_DIR_Y = 0.44;
const INK_R = 0.035; // #09060E
const INK_G = 0.024;
const INK_B = 0.055;

export class WebGL2InkCelRenderer implements RenderBackend {
  public readonly kind = 'webgl2' as const;

  private readonly gl: WebGL2RenderingContext;
  private readonly atlas: BakedAtlas;
  private fontAtlas: BakedFontAtlas;
  private readonly whiteRect: AtlasSpriteRect;

  private atlasTex: WebGLTexture;
  private fontTex: WebGLTexture;
  private readonly biomeTex = new Map<
    BiomeId,
    { floor: WebGLTexture; wall: WebGLTexture; cliff: WebGLTexture }
  >();

  private abyssProg: WebGLProgram;
  private floorProg: WebGLProgram;
  private hazardProg: WebGLProgram;
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

  // Pre-allocated pools & room architecture caches (zero per-frame allocations!)
  private readonly sortPool: SortItem[];
  private sortCount = 0;
  private readonly braziers: { x: number; y: number }[] = [];
  private readonly wallSconces: { x: number; y: number }[] = [];
  private readonly cornerObelisks: CornerObelisk[] = [];
  private lastArchBoundsKey = '';

  // Cached uniform locations
  private readonly uAbyss: Record<string, WebGLUniformLocation | null>;
  private readonly uFloor: Record<string, WebGLUniformLocation | null>;
  private readonly uHazard: Record<string, WebGLUniformLocation | null>;
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

    // Compile all 7-pass programs + dedicated hand-painted floor shader
    this.abyssProg = this.createProgram(FULLSCREEN_VERT, ABYSS_FRAG);
    this.floorProg = this.createProgram(FLOOR_VERT, FLOOR_FRAG);
    this.hazardProg = this.createProgram(HAZARD_VERT, HAZARD_FRAG);
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
    this.uFloor = {
      uResolution: gl.getUniformLocation(this.floorProg, 'uResolution'),
      uScreenRect: gl.getUniformLocation(this.floorProg, 'uScreenRect'),
      uWorldRect: gl.getUniformLocation(this.floorProg, 'uWorldRect'),
      uFloorTex: gl.getUniformLocation(this.floorProg, 'uFloorTex'),
      uTrimColor: gl.getUniformLocation(this.floorProg, 'uTrimColor'),
      uDeepColor: gl.getUniformLocation(this.floorProg, 'uDeepColor'),
      uRoomSeed: gl.getUniformLocation(this.floorProg, 'uRoomSeed'),
    };
    this.uHazard = {
      uResolution: gl.getUniformLocation(this.hazardProg, 'uResolution'),
      uCenterScreen: gl.getUniformLocation(this.hazardProg, 'uCenterScreen'),
      uHalfSizeScreen: gl.getUniformLocation(this.hazardProg, 'uHalfSizeScreen'),
      uCenterWorld: gl.getUniformLocation(this.hazardProg, 'uCenterWorld'),
      uRadius: gl.getUniformLocation(this.hazardProg, 'uRadius'),
      uTime: gl.getUniformLocation(this.hazardProg, 'uTime'),
      uKind: gl.getUniformLocation(this.hazardProg, 'uKind'),
      uSeed: gl.getUniformLocation(this.hazardProg, 'uSeed'),
      uOpacity: gl.getUniformLocation(this.hazardProg, 'uOpacity'),
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
      uChromaticAmount: gl.getUniformLocation(this.compositeProg, 'uChromaticAmount'),
      uShockwave: gl.getUniformLocation(this.compositeProg, 'uShockwave'),
      uTime: gl.getUniformLocation(this.compositeProg, 'uTime'),
      uResolution: gl.getUniformLocation(this.compositeProg, 'uResolution'),
      uShockwaveTint: gl.getUniformLocation(this.compositeProg, 'uShockwaveTint'),
    };

    // Upload pre-baked Ink-Cel Atlas & Font Glyph Atlas ONCE
    this.atlasTex = this.uploadCanvasTexture(atlas.canvas);
    this.fontTex = this.uploadCanvasTexture(fontAtlas.canvas);

    // Fullscreen & procedural-quad empty VAO
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
   * Probes WebGL2 availability, shader compilation (including HAZARD_VERT/FRAG), and FBO
   * completeness on a detached 16x16 canvas FIRST so a failing driver NEVER locks the live
   * `#game-canvas` out of Canvas2D fallback!
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
      checkPair('floor', FLOOR_VERT, FLOOR_FRAG);
      checkPair('hazard', HAZARD_VERT, HAZARD_FRAG);
      checkPair('batch', BATCH_VERT, BATCH_FRAG);
      checkPair('light', LIGHT_VERT, LIGHT_FRAG);
      checkPair('bloomExtract', FULLSCREEN_VERT, BLOOM_EXTRACT_FRAG);
      checkPair('bloomBlur', FULLSCREEN_VERT, BLOOM_BLUR_FRAG);
      checkPair('composite', FULLSCREEN_VERT, COMPOSITE_FRAG);

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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }

  private uploadSurfaceTexture(img: HTMLImageElement, repeatY: boolean): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('WebGL2: createTexture failed');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeatY ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }

  public setBiomeSurfaces(surfaces: Partial<Record<BiomeId, BiomeSurfaceTextures>>): void {
    const gl = this.gl;
    for (const prev of this.biomeTex.values()) {
      gl.deleteTexture(prev.floor);
      gl.deleteTexture(prev.wall);
      gl.deleteTexture(prev.cliff);
    }
    this.biomeTex.clear();
    for (const [biomeId, surf] of Object.entries(surfaces) as [BiomeId, BiomeSurfaceTextures][]) {
      if (!surf) continue;
      this.biomeTex.set(biomeId, {
        floor: this.uploadSurfaceTexture(surf.floor, true),
        wall: this.uploadSurfaceTexture(surf.wall, false),
        cliff: this.uploadSurfaceTexture(surf.cliff, false),
      });
    }
  }

  private drawTexturedStrip(
    tex: WebGLTexture,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    repeatX: number,
    r = 1,
    g = 1,
    b = 1,
    a = 1
  ): void {
    this.flushBatch();
    this.setBatchState(tex, 'alpha');
    if (this.batchVertCount + 6 > MAX_BATCH_VERTS) this.flushBatch();
    this.pushVert(x0, y0, 0, 0, r, g, b, a, 0, 0);
    this.pushVert(x1, y0, repeatX, 0, r, g, b, a, 0, 0);
    this.pushVert(x1, y1, repeatX, 1, r, g, b, a, 0, 0);
    this.pushVert(x0, y0, 0, 0, r, g, b, a, 0, 0);
    this.pushVert(x1, y1, repeatX, 1, r, g, b, a, 0, 0);
    this.pushVert(x0, y1, 0, 1, r, g, b, a, 0, 0);
    this.flushBatch();
    this.setBatchState(this.atlasTex, 'alpha');
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

  private pushQuadGradientV(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    rTop: number,
    gTop: number,
    bTop: number,
    aTop: number,
    rBot: number,
    gBot: number,
    bBot: number,
    aBot: number,
    emissive = 0
  ): void {
    if (this.batchVertCount + 6 > MAX_BATCH_VERTS) this.flushBatch();
    const u = (this.whiteRect.u0 + this.whiteRect.u1) * 0.5;
    const v = (this.whiteRect.v0 + this.whiteRect.v1) * 0.5;
    this.pushVert(x0, y0, u, v, rTop, gTop, bTop, aTop, 0, emissive);
    this.pushVert(x1, y1, u, v, rTop, gTop, bTop, aTop, 0, emissive);
    this.pushVert(x2, y2, u, v, rBot, gBot, bBot, aBot, 0, emissive);
    this.pushVert(x0, y0, u, v, rTop, gTop, bTop, aTop, 0, emissive);
    this.pushVert(x2, y2, u, v, rBot, gBot, bBot, aBot, 0, emissive);
    this.pushVert(x3, y3, u, v, rBot, gBot, bBot, aBot, 0, emissive);
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
  // Coordinate, Sprite Variant & Room Architecture Helpers
  // ============================================================================

  private wxToSx(wx: number, cam: CameraView): number {
    return cam.viewW * 0.5 + (wx - cam.camX + cam.shakeX) * cam.zoom;
  }

  private wyToSy(wy: number, wz: number, cam: CameraView): number {
    return cam.viewH * 0.5 + (wy - cam.camY + cam.shakeY) * cam.isoScaleY * cam.zoom - wz * cam.zoom;
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

  /**
   * Resolves 4 floor flagstone variants (`a/b/c/d`) checking `ATLAS_SPRITE_RECTS` so the
   * branch compiles cleanly pre-merge and lights up all 12 new variants automatically!
   */
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

  private ensureRoomArchitecture(state: SimState): void {
    const b = state.room.bounds;
    const key = `${state.room.biome}:${state.room.depth}:${b.minX}:${b.maxX}:${b.minY}:${b.maxY}:${state.room.doors.length}`;
    if (key === this.lastArchBoundsKey) return;
    this.lastArchBoundsKey = key;

    // 1. Braziers
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
      tryAddBrazier(midX - 210, b.maxY - inset * 0.85);
      tryAddBrazier(midX + 210, b.maxY - inset * 0.85);
    }
    if (b.maxY - b.minY > 750) {
      tryAddBrazier(b.minX + inset * 0.85, midY);
      tryAddBrazier(b.maxX - inset * 0.85, midY);
    }

    // 2. Northern Retaining Wall Sconces (spaced every ~240 world units, cleanly avoiding north doors)
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
      if (!nearDoor) {
        this.wallSconces.push({ x: sx, y: b.minY });
      }
    }

    // 3. 4 Sculpted Corner Obelisk Plinths anchoring the arena perimeter
    this.cornerObelisks.length = 0;
    this.cornerObelisks.push(
      { x: b.minX - 10, y: b.minY - 6, north: true },
      { x: b.maxX + 10, y: b.minY - 6, north: true },
      { x: b.minX - 10, y: b.maxY + 6, north: false },
      { x: b.maxX + 10, y: b.maxY + 6, north: false }
    );
  }

  /**
   * Exact slab ray-AABB intersection matching `src/sim/bosses.ts` pillar LoS occlusion.
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
  // Master 7-Pass Render Entry Point
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
    this.ensureRoomArchitecture(state);

    // ------------------------------------------------------------------------
    // PASS 1: All-Biome Deep Abyssal Chasm Parallax & Atmospheric Spectacle
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
      state.room.biome === 'sanctum_hub'
        ? -1.0
        : state.room.biome === 'cinder_mire'
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
    // PASS 2: Architectural 3D Perimeter Walls, Biome Cliff Drop, Varied
    //         Weathered Flagstones, Central Mosaic, Pits & Floor Decals
    // ------------------------------------------------------------------------
    this.renderChamberArchitectureAndFloor(state, cam, vfx, theme, timeSec);

    // ------------------------------------------------------------------------
    // PASS 1.5: Dedicated Animated Procedural GLSL Hazard Pass (Zero Ovals!)
    //   Render stone curing basin rims first so GLSL turquoise caustics shimmer
    //   visibly inside the carved basin water!
    // ------------------------------------------------------------------------
    this.renderCuringBasinFrames(state.room.hazards, cam, timeSec);
    this.renderShaderHazards(state.room.hazards, cam, timeSec);
    this.renderNonShaderHazards(state.room.hazards, cam, timeSec);

    // ------------------------------------------------------------------------
    // PASS 2b: Biome/Boss Danger Rune Telegraphs + 2-Layer Cast Shadows & AO
    // ------------------------------------------------------------------------
    this.renderTelegraphs(state, theme, cam, timeSec);
    this.renderContactAndCastShadows(state, prevState, cam);

    // ------------------------------------------------------------------------
    // PASS 3: Y-Sorted Ink-Cel Entities, Cloak, Weapons, 3-Layer Smears,
    //         Directional Hit-Sparks & Volumetric Light Cones
    // ------------------------------------------------------------------------
    this.renderYSortedEntities(state, prevState, cam, settings, theme, timeSec);
    this.renderSlashRibbons(vfx, cam);
    this.renderParticles(vfx, cam);
    this.renderVolumetricLightCones(state, theme, cam, timeSec);
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

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboB.fbo);
    gl.viewport(0, 0, this.bloomFboB.w, this.bloomFboB.h);
    gl.useProgram(this.bloomBlurProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFboA.tex);
    gl.uniform1i(this.uBloomBlur.uTex, 0);
    gl.uniform2f(this.uBloomBlur.uTexelStep, 1.4 / this.bloomFboA.w, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCalls++;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFboA.fbo);
    gl.viewport(0, 0, this.bloomFboA.w, this.bloomFboA.h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFboB.tex);
    gl.uniform2f(this.uBloomBlur.uTexelStep, 0, 1.4 / this.bloomFboB.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.drawCalls++;

    // ------------------------------------------------------------------------
    // PASS 6: Final Post-Process Composite + Mythic Comic-Ink Damage Numbers
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
    gl.uniform1f(this.uComposite.uBloomStrength, 0.58);
    gl.uniform1f(this.uComposite.uVignetteStrength, 0.23);
    gl.uniform1f(this.uComposite.uHitFlash, settings.hitFlash ? vfx.hitFlashPulse : 0);
    gl.uniform1f(this.uComposite.uDeathDefiance, vfx.deathDefiancePulse);
    gl.uniform1f(this.uComposite.uFinalKillPulse, vfx.finalKillPulse);
    gl.uniform1f(this.uComposite.uChromaticAmount, settings.screenShake ? vfx.chromaticAmount : vfx.chromaticAmount * 0.4);
    gl.uniform1f(this.uComposite.uTime, timeSec);
    gl.uniform2f(this.uComposite.uResolution, this.viewW, this.viewH);

    // Compute radial shockwave screen UV (WebGL UV y=0 is bottom -> invert screen y!)
    let swUvX = 0.5;
    let swUvY = 0.5;
    if (vfx.shockwaveActive && vfx.shockwaveHasWorld) {
      swUvX = Math.max(0, Math.min(1, this.wxToSx(vfx.shockwaveWorldX, cam) / Math.max(1, this.viewW)));
      swUvY = Math.max(0, Math.min(1, 1 - this.wyToSy(vfx.shockwaveWorldY, 20, cam) / Math.max(1, this.viewH)));
    }
    const swAmp = vfx.shockwaveActive ? (settings.screenShake ? vfx.shockwaveAmp : vfx.shockwaveAmp * 0.35) : 0;
    gl.uniform4f(this.uComposite.uShockwave, swUvX, swUvY, vfx.shockwaveRadius, swAmp);
    gl.uniform3f(this.uComposite.uShockwaveTint, vfx.shockwaveR, vfx.shockwaveG, vfx.shockwaveB);
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
  // Pass 2: 3D Architectural Perimeter Walls, Cliffs, Weathered Floors & Decals
  // ============================================================================

  private renderChamberArchitectureAndFloor(
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
    const z = cam.zoom;
    const biome = state.room.biome;

    // 1. Subtle chasm atmospheric under-glow framing the sanctuary platform
    const rimPulse = 0.8 + 0.2 * Math.sin(timeSec * 2.2);
    this.pushQuadSolid(
      x0 - 34 * z,
      y0 - 110 * z,
      x1 + 34 * z,
      y0 - 110 * z,
      x1 + 40 * z,
      y1 + 52 * z,
      x0 - 40 * z,
      y1 + 52 * z,
      theme.rimGlow[0],
      theme.rimGlow[1],
      theme.rimGlow[2],
      0.16 * rimPulse,
      0.75
    );

    // 2. Biome-Matched Southern 3D Chasm Cliff Drop (128-144px descending into abyss)
    this.renderSouthernChasmCliff(biome, x0, x1, y1, theme, z);

    // 3. Continuous Beveled 3D Northern Retaining Wall + Pilasters + Sconces + Portal Recesses
    this.renderNorthernRetainingWall(state, x0, x1, y0, theme, cam, timeSec);

    // Flush perimeter cliff & northern wall BEFORE enabling hardware scissor clip for floor flagstones
    this.flushBatch();

    // 4. Hardware SCISSOR_TEST clipped 4-Variant Weathered Flagstone Floor + Central Mosaic Medallion
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

      const centerX = (b.minX + b.maxX) * 0.5;
      const centerY = (b.minY + b.maxY) * 0.5;
      const roomSeed = (state.room.roomIndex * 131 + state.room.depth * 37 + state.run.seed) | 0;
      const surf = this.biomeTex.get(biome);

      if (surf?.floor) {
        // Dedicated Hand-Painted Seamless Isometric Floor Shader (1024x1024 gouache stone + trim + AO!)
        this.flushBatch();
        gl.useProgram(this.floorProg);
        gl.bindVertexArray(this.emptyVao);
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, surf.floor);
        gl.uniform1i(this.uFloor.uFloorTex, 0);
        gl.uniform2f(this.uFloor.uResolution, this.viewW, this.viewH);
        gl.uniform4f(this.uFloor.uScreenRect, x0, y0, x1, y1);
        gl.uniform4f(this.uFloor.uWorldRect, b.minX, b.minY, b.maxX, b.maxY);
        gl.uniform3fv(this.uFloor.uTrimColor, theme.wallTrim);
        gl.uniform3fv(this.uFloor.uDeepColor, theme.deep);
        gl.uniform1f(this.uFloor.uRoomSeed, (roomSeed & 255) * 0.13);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.drawCalls++;
        gl.enable(gl.BLEND);
        this.activeTexture = null;
        this.currentBlend = 'alpha';
        this.setBatchState(this.atlasTex, 'alpha');
      } else {
        // Fallback 4-variant flagstone tiles while WebP floor textures decode
        this.pushQuadSolid(
          x0,
          y0,
          x1,
          y0,
          x1,
          y1,
          x0,
          y1,
          theme.floorBase[0] * 0.72,
          theme.floorBase[1] * 0.72,
          theme.floorBase[2] * 0.72,
          1,
          0
        );

        const tileWorldW = 210;
        const tileWorldH = 210;
        const halfTileW = tileWorldW * 0.5;
        const halfTileH = tileWorldH * 0.5;
        const sampleRect = this.atlas.sprites.get(this.resolveFloorVariantId(biome, 0));
        const baseTileW = sampleRect ? sampleRect.w : 256;
        const baseTileH = sampleRect ? sampleRect.h : 128;
        const tileScaleX = (tileWorldW / (baseTileW * 0.984)) * z;
        const tileScaleY = ((tileWorldH * cam.isoScaleY) / (baseTileH * 0.968)) * z;

        const invHalfW = 1 / Math.max(200, (b.maxX - b.minX) * 0.5);
        const invHalfH = 1 / Math.max(200, (b.maxY - b.minY) * 0.5);
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
            let h = ((col * 73856093) ^ (row * 19349663) ^ (roomSeed * 83492791)) >>> 0;
            h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
            const bucket = (h >>> 24) % 100;
            const variantIdx = bucket < 45 ? 0 : bucket < 70 ? 1 : bucket < 88 ? 2 : 3;
            const tileId = this.resolveFloorVariantId(biome, variantIdx);
            const nx = (wx - centerX) * invHalfW;
            const ny = (wy - centerY) * invHalfH;
            const rNorm = Math.min(1.2, Math.hypot(nx * 0.92, ny * 0.92));
            const spatialLum = 1.04 - 0.2 * Math.pow(rNorm, 1.55);
            const tempDrift = (((h >>> 8) & 255) / 255 - 0.5) * 0.1;
            const lum = Math.max(0.74, Math.min(1.1, spatialLum));
            this.pushSprite(
              tileId,
              this.wxToSx(wx, cam),
              this.wyToSy(wy, 0, cam),
              tileScaleX,
              tileScaleY,
              0,
              lum * (1 + tempDrift * 0.9),
              lum * (1 + tempDrift * 0.2),
              lum * (1 - tempDrift * 0.85),
              1,
              0,
              0
            );
          }
        }
      }

      // Sanctum Courtyard Hand-Painted Woven Crimson-Gold Tapestry Runner (UNDER central medallion!)
      if (biome === 'sanctum_hub') {
        const midSx = this.wxToSx(centerX, cam);
        const rugW = 148 * z;
        const rugTop = y0 + 18 * z;
        const rugBot = y1 - 28 * z;
        const rugH = Math.max(64 * z, rugBot - rugTop);
        // Subtle cast shadow beneath woven carpet edge
        this.pushQuadSolid(
          midSx - rugW * 0.5 - 5 * z,
          rugTop + 2 * z,
          midSx + rugW * 0.5 + 7 * z,
          rugTop + 2 * z,
          midSx + rugW * 0.5 + 7 * z,
          rugBot + 6 * z,
          midSx - rugW * 0.5 - 5 * z,
          rugBot + 6 * z,
          INK_R,
          INK_G,
          INK_B,
          0.52
        );
        if (this.hasSprite('prop_sanctum_rug')) {
          this.pushSpriteSized(
            'prop_sanctum_rug',
            midSx - rugW * 0.5,
            rugTop,
            rugW,
            rugH,
            0.96,
            0.92,
            0.94,
            0.96,
            0
          );
        }
      }

      // Central Chamber Mosaic Medallion inlaid cleanly into the stone floor (on top of runner seam!)
      this.renderCentralMosaicMedallion(biome, centerX, centerY, theme, cam);

      // Northern wall base contact AO strip & Western parapet SE inner shadow strip
      this.pushQuadGradientV(
        x0,
        y0,
        x1,
        y0,
        x1,
        y0 + 26 * z,
        x0,
        y0 + 26 * z,
        INK_R,
        INK_G,
        INK_B,
        0.74,
        INK_R,
        INK_G,
        INK_B,
        0.0
      );
      // West parapet inner SE shadow strip
      this.pushQuadSolid(
        x0,
        y0,
        x0 + 18 * z,
        y0 + 8 * z,
        x0 + 18 * z,
        y1,
        x0,
        y1,
        INK_R,
        INK_G,
        INK_B,
        0.34
      );

      this.flushBatch();
      gl.disable(gl.SCISSOR_TEST);
    }

    // 5. Stepped Beveled East & West Stone Parapets + Southern Stone Cornice Kerb
    this.renderEastWestParapetsAndSouthernKerb(state, x0, x1, y0, y1, theme, cam);

    // 6. Northern Corner Obelisk Plinths (drawn behind actors cleanly)
    for (let i = 0; i < this.cornerObelisks.length; i++) {
      const ob = this.cornerObelisks[i];
      if (ob.north) {
        this.renderCornerObelisk(ob.x, ob.y, biome, theme, cam);
      }
    }

    // 7. Chasm Pits (Beveled Octagonal Carved-Stone Cutouts)
    this.renderChasmPits(state.room.obstacles, theme, cam);

    // 8. Persistent Room Floor Decals (crater, scorch, faction-tinted ichor, crack, foot_scorch)
    this.renderFloorDecals(vfx, cam);
  }

  private renderSouthernChasmCliff(
    biome: BiomeId,
    x0: number,
    x1: number,
    y1: number,
    theme: BiomeVisualTheme,
    z: number
  ): void {
    const cliffH = 176 * z;
    const spanX0 = x0 - 30 * z;
    const spanX1 = x1 + 30 * z;
    const spanW = Math.max(64, spanX1 - spanX0);
    const surf = this.biomeTex.get(biome);

    if (surf?.cliff) {
      // Dedicated full-resolution seamless painted chasm cliff with jagged alpha overhangs!
      const repeatX = spanW / Math.max(120, 480 * z);
      this.drawTexturedStrip(surf.cliff, spanX0, y1 + 4 * z, spanX1, y1 + 4 * z + cliffH, repeatX, 1, 1, 1, 1);
    } else {
      const shortName = this.getBiomeShortName(biome);
      const preferredCliff = `prop_chasm_${shortName}`;
      const cliffId = this.hasSprite(preferredCliff) ? preferredCliff : 'prop_chasm_rim';
      const segW = 380 * z;
      const segCount = Math.max(1, Math.ceil(spanW / segW));
      const stepW = spanW / segCount;
      for (let i = 0; i < segCount; i++) {
        this.pushSpriteSized(cliffId, spanX0 + i * stepW, y1 + 4 * z, stepW + 1, cliffH, 1, 1, 1, 0.98, 0);
      }
    }

    // Crisp dark #09060E overhang AO shadow immediately beneath southern platform kerb
    this.pushQuadGradientV(
      spanX0,
      y1 + 6 * z,
      spanX1,
      y1 + 6 * z,
      spanX1,
      y1 + 34 * z,
      spanX0,
      y1 + 34 * z,
      INK_R,
      INK_G,
      INK_B,
      0.82,
      INK_R,
      INK_G,
      INK_B,
      0.0
    );
    void theme;
  }

  private renderNorthernRetainingWall(
    state: SimState,
    x0: number,
    x1: number,
    y0: number,
    theme: BiomeVisualTheme,
    cam: CameraView,
    timeSec: number
  ): void {
    const z = cam.zoom;
    const b = state.room.bounds;
    const wallH = 138 * z;
    const parapetPad = 28 * z;
    const wx0 = x0 - parapetPad;
    const wx1 = x1 + parapetPad;
    const topY = y0 - wallH;

    // 1. Solid obsidian ink outer silhouette backing behind retaining wall
    this.pushQuadSolid(wx0 - 4 * z, topY - 4 * z, wx1 + 4 * z, topY - 4 * z, wx1 + 4 * z, y0 + 2 * z, wx0 - 4 * z, y0 + 2 * z, INK_R, INK_G, INK_B, 0.98);

    const surf = this.biomeTex.get(state.room.biome);
    if (surf?.wall) {
      // Dedicated full-resolution horizontally-seamless hand-painted temple wall!
      const repeatX = Math.max(1, (wx1 - wx0) / Math.max(140, 480 * z));
      this.drawTexturedStrip(surf.wall, wx0, topY, wx1, y0 + 2 * z, repeatX, 1, 1, 1, 1);
    } else {
      const shortName = this.getBiomeShortName(state.room.biome);
      const wallSpriteId = `prop_wall_${shortName}_n`;
      if (this.hasSprite(wallSpriteId)) {
        const segW = 360 * z;
        const segCount = Math.max(1, Math.ceil((wx1 - wx0) / segW));
        const stepW = (wx1 - wx0) / segCount;
        for (let i = 0; i < segCount; i++) {
          this.pushSpriteSized(wallSpriteId, wx0 + i * stepW, topY, stepW + 1, wallH + 4 * z, 1, 1, 1, 1, 0);
        }
      }
    }

    // 2. Wall-Mounted Hand-Painted Ram-Horn Sconces + Animated Flickering Flame along North Wall
    const hasSconceSprite = this.hasSprite('prop_wall_sconce');
    for (let i = 0; i < this.wallSconces.length; i++) {
      const sc = this.wallSconces[i];
      const px = this.wxToSx(sc.x, cam);
      const sconceY = y0 - 46 * z;
      if (hasSconceSprite) {
        const sScale = this.spriteScaleForHeight('prop_wall_sconce', 74 * z);
        this.pushSprite('prop_wall_sconce', px, sconceY + 12 * z, sScale, sScale, 0, 1, 1, 1, 1, 0, 0.2);
      }

      const flick = 0.88 + 0.12 * Math.sin(timeSec * 11.3 + i * 2.1) + 0.06 * Math.sin(timeSec * 27.1 + i * 3.7);
      const sway = Math.sin(timeSec * 7.8 + i * 1.7) * 0.14;
      const flameSc = this.spriteScaleForHeight('vfx_flame_tongue', 34 * z);
      this.pushSprite('vfx_glow_soft', px, sconceY - 10 * z, 0.62 * z * flick, 0.62 * z * flick, 0, theme.brazierColor[0], theme.brazierColor[1], theme.brazierColor[2], 0.42, 0, 1.35);
      this.pushSprite(
        'vfx_flame_tongue',
        px,
        sconceY - 12 * z,
        flameSc * 0.8 * flick,
        flameSc * flick,
        sway,
        1.0,
        0.52,
        0.14,
        0.64,
        0,
        1.45
      );
      this.pushSprite(
        'vfx_flame_tongue',
        px + 1.2 * z,
        sconceY - 14 * z,
        flameSc * 0.44 * flick,
        flameSc * 0.56 * flick,
        -sway * 1.1,
        1.0,
        0.88,
        0.48,
        0.58,
        0,
        1.8
      );
    }

    // Crisp wall-to-floor seam shadow line
    this.pushLine(wx0, y0, wx1, y0, 3.6 * z, INK_R, INK_G, INK_B, 0.96);
    void b;
  }

  private renderEastWestParapetsAndSouthernKerb(
    state: SimState,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    theme: BiomeVisualTheme,
    cam: CameraView
  ): void {
    const z = cam.zoom;
    const pW = 28 * z; // 28px stepped beveled stone parapet kerb
    const stepH = 14 * z;
    const dropSkirt = 34 * z;

    // --- WEST PARAPET (NW Key Light hits outer top & inner lip!) ---
    // Deep abyssal drop skirt beneath west edge
    this.pushQuadSolid(x0 - pW - 4 * z, y0, x0, y0, x0, y1 + dropSkirt, x0 - pW - 4 * z, y1 + dropSkirt, INK_R, INK_G, INK_B, 0.92);
    // Stepped stone bevel top face (lit NW!)
    this.pushQuadSolid(x0 - pW, y0 - stepH, x0, y0 - stepH, x0, y1, x0 - pW, y1, theme.wallLit[0] * 1.12, theme.wallLit[1] * 1.12, theme.wallLit[2] * 1.12, 1);
    // Inner kerb bevel vertical face
    this.pushQuadSolid(x0 - 8 * z, y0 - stepH, x0, y0 - stepH, x0, y1, x0 - 8 * z, y1, theme.wallDark[0] * 1.05, theme.wallDark[1] * 1.05, theme.wallDark[2] * 1.05, 1);
    // Subtle metallic trim + broken weathered stone joints + outer ink contour
    this.pushLine(x0 - pW, y0 - stepH, x0 - pW, y1, 3.8 * z, INK_R, INK_G, INK_B, 0.96);
    this.pushLine(x0, y0 - stepH, x0, y1, 3.2 * z, INK_R, INK_G, INK_B, 0.94);
    this.pushLine(x0 - pW + 7 * z, y0 - stepH, x0 - pW + 7 * z, y1, 2.2 * z, theme.wallTrim[0], theme.wallTrim[1], theme.wallTrim[2], 0.72, 0.12);

    // --- EAST PARAPET (SE shadow side — deeper chiaroscuro value!) ---
    this.pushQuadSolid(x1, y0, x1 + pW + 4 * z, y0, x1 + pW + 4 * z, y1 + dropSkirt, x1, y1 + dropSkirt, INK_R, INK_G, INK_B, 0.94);
    this.pushQuadSolid(x1, y0 - stepH, x1 + pW, y0 - stepH, x1 + pW, y1, x1, y1, theme.wallDark[0] * 1.15, theme.wallDark[1] * 1.15, theme.wallDark[2] * 1.15, 1);
    this.pushQuadSolid(x1, y0 - stepH, x1 + 9 * z, y0 - stepH, x1 + 9 * z, y1, x1, y1, theme.wallLit[0] * 0.85, theme.wallLit[1] * 0.85, theme.wallLit[2] * 0.85, 1);
    this.pushLine(x1, y0 - stepH, x1, y1, 3.2 * z, INK_R, INK_G, INK_B, 0.94);
    this.pushLine(x1 + pW, y0 - stepH, x1 + pW, y1, 4.0 * z, INK_R, INK_G, INK_B, 0.96);
    this.pushLine(x1 + pW - 7 * z, y0 - stepH, x1 + pW - 7 * z, y1, 2.2 * z, theme.wallTrim[0] * 0.84, theme.wallTrim[1] * 0.84, theme.wallTrim[2] * 0.84, 0.68, 0.1);

    // Weathered stone joint ticks along East & West parapets
    const jointStep = 64 * z;
    const jointCount = Math.max(2, Math.floor((y1 - y0) / jointStep));
    for (let i = 1; i < jointCount; i++) {
      const jy = y0 + i * jointStep;
      this.pushLine(x0 - pW + 2 * z, jy, x0 - 2 * z, jy, 2.0 * z, INK_R, INK_G, INK_B, 0.72);
      this.pushLine(x1 + 2 * z, jy, x1 + pW - 2 * z, jy, 2.0 * z, INK_R, INK_G, INK_B, 0.72);
    }

    // --- SOUTHERN BEVELED CORNICE KERB (clean architectural edge over chasm cliff, zero flat sticker tape!) ---
    const kerbH = 16 * z;
    this.pushQuadSolid(x0 - pW, y1 - 4 * z, x1 + pW, y1 - 4 * z, x1 + pW, y1 + kerbH, x0 - pW, y1 + kerbH, INK_R, INK_G, INK_B, 0.98);
    this.pushQuadSolid(x0 - pW + 2 * z, y1 - 2 * z, x1 + pW - 2 * z, y1 - 2 * z, x1 + pW - 2 * z, y1 + 6 * z, x0 - pW + 2 * z, y1 + 6 * z, theme.wallLit[0] * 1.05, theme.wallLit[1] * 1.05, theme.wallLit[2] * 1.05, 1);
    this.pushQuadSolid(x0 - pW + 2 * z, y1 + 6 * z, x1 + pW - 2 * z, y1 + 6 * z, x1 + pW - 2 * z, y1 + kerbH - 2 * z, x0 - pW + 2 * z, y1 + kerbH - 2 * z, theme.wallDark[0] * 0.84, theme.wallDark[1] * 0.84, theme.wallDark[2] * 0.84, 1);
    this.pushLine(x0 - pW, y1 - 2 * z, x1 + pW, y1 - 2 * z, 2.2 * z, theme.wallTrim[0], theme.wallTrim[1], theme.wallTrim[2], 0.78, 0.14);
    this.pushLine(x0 - pW, y1 + kerbH, x1 + pW, y1 + kerbH, 3.4 * z, INK_R, INK_G, INK_B, 0.96);

    // Subtle weathered stone joint ticks on southern kerb
    const sStep = 82 * z;
    const sCount = Math.max(2, Math.floor((x1 - x0) / sStep));
    for (let i = 1; i < sCount; i++) {
      const jx = x0 + i * sStep;
      this.pushLine(jx, y1 - 2 * z, jx, y1 + kerbH - 2 * z, 1.8 * z, INK_R, INK_G, INK_B, 0.65);
    }
    void state;
  }

  private renderCornerObelisk(
    wx: number,
    wy: number,
    biome: BiomeId,
    theme: BiomeVisualTheme,
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
      this.pushSprite(spriteId, sx, sy, sc, sc, 0, 1, 1, 1, 1, 0, 0.08);
      return;
    }

    // Procedural sculpted multi-faceted comic-ink Corner Obelisk Plinth (pre-merge high-craft fallback)
    const baseW = 28 * z;
    const topW = 14 * z;
    const shaftH = 128 * z;
    const capH = 26 * z;

    // 1. Stepped square plinth base + ink casing
    this.pushQuadSolid(sx - baseW - 5 * z, sy - 16 * z, sx + baseW + 5 * z, sy - 16 * z, sx + baseW + 5 * z, sy + 10 * z, sx - baseW - 5 * z, sy + 10 * z, INK_R, INK_G, INK_B, 0.96);
    this.pushQuadSolid(sx - baseW - 1 * z, sy - 13 * z, sx + 2 * z, sy - 13 * z, sx + 2 * z, sy + 7 * z, sx - baseW - 1 * z, sy + 7 * z, theme.wallLit[0] * 1.08, theme.wallLit[1] * 1.08, theme.wallLit[2] * 1.08, 1);
    this.pushQuadSolid(sx + 2 * z, sy - 13 * z, sx + baseW + 1 * z, sy - 13 * z, sx + baseW + 1 * z, sy + 7 * z, sx + 2 * z, sy + 7 * z, theme.wallDark[0] * 0.72, theme.wallDark[1] * 0.72, theme.wallDark[2] * 0.72, 1);

    // 2. Heavy comic-ink tapered obelisk silhouette
    this.pushQuadSolid(sx - topW - 4 * z, sy - shaftH, sx + topW + 4 * z, sy - shaftH, sx + baseW * 0.72 + 4 * z, sy - 12 * z, sx - baseW * 0.72 - 4 * z, sy - 12 * z, INK_R, INK_G, INK_B, 0.98);
    this.pushTriSolid(sx, sy - shaftH - capH - 4 * z, sx - topW - 4 * z, sy - shaftH, sx + topW + 4 * z, sy - shaftH, INK_R, INK_G, INK_B, 0.98);

    // 3. Lit NW facet + deep chiaroscuro SE facet
    this.pushQuadSolid(sx - topW, sy - shaftH, sx + 2 * z, sy - shaftH, sx + 2 * z, sy - 14 * z, sx - baseW * 0.68, sy - 14 * z, theme.wallLit[0] * 1.15, theme.wallLit[1] * 1.15, theme.wallLit[2] * 1.15, 1);
    this.pushQuadSolid(sx + 2 * z, sy - shaftH, sx + topW, sy - shaftH, sx + baseW * 0.68, sy - 14 * z, sx + 2 * z, sy - 14 * z, theme.wallDark[0] * 0.65, theme.wallDark[1] * 0.65, theme.wallDark[2] * 0.65, 1);

    // 4. Pyramidion gilded/icy capstone
    this.pushTriSolid(sx, sy - shaftH - capH, sx - topW, sy - shaftH, sx + 2 * z, sy - shaftH, theme.wallTrim[0], theme.wallTrim[1], theme.wallTrim[2], 1, 0.35);
    this.pushTriSolid(sx, sy - shaftH - capH, sx + 2 * z, sy - shaftH, sx + topW, sy - shaftH, theme.wallTrim[0] * 0.56, theme.wallTrim[1] * 0.56, theme.wallTrim[2] * 0.56, 1, 0.12);

    // 5. Glowing carved biome rune line down central ridge
    this.pushLine(sx - 2 * z, sy - shaftH + 14 * z, sx - 2 * z, sy - 34 * z, 2.8 * z, theme.wallTrim[0], theme.wallTrim[1], theme.wallTrim[2], 0.88, 0.75);
  }

  private renderCentralMosaicMedallion(
    biome: BiomeId,
    cxWorld: number,
    cyWorld: number,
    theme: BiomeVisualTheme,
    cam: CameraView
  ): void {
    const sx = this.wxToSx(cxWorld, cam);
    const sy = this.wyToSy(cyWorld, 0, cam);
    const z = cam.zoom;
    const shortName = this.getBiomeShortName(biome);
    const medId = `prop_medallion_${shortName}`;

    if (this.hasSprite(medId)) {
      const sc = this.spriteScaleForHeight(medId, 248 * z);
      this.pushSprite(medId, sx, sy, sc, sc, 0, 1, 1, 1, 0.92, 0, 0.08);
      return;
    }

    // Ornate procedural Greco-Roman inlaid floor medallion fallback (0.85 alpha blended into stone)
    const rx = 196 * z;
    const ry = rx * cam.isoScaleY;

    // Recessed obsidian outer groove
    this.pushEllipseRing(sx, sy, rx + 6 * z, ry + 3.5 * z, rx - 3 * z, ry - 2 * z, 32, INK_R, INK_G, INK_B, 0.65);
    // Subtle dark inlaid slate disc
    this.pushEllipseFill(sx, sy, rx - 3 * z, ry - 2 * z, 32, theme.floorBase[0] * 0.84, theme.floorBase[1] * 0.84, theme.floorBase[2] * 0.84, 0.68);
    // Outer hammered bronze/trim band + 16 carved Greek key radial ticks
    this.pushEllipseRing(sx, sy, rx - 4 * z, ry - 2.5 * z, rx * 0.84, ry * 0.84, 32, theme.wallTrim[0] * 0.78, theme.wallTrim[1] * 0.78, theme.wallTrim[2] * 0.78, 0.56, 0.08);
    this.pushEllipseRing(sx, sy, rx * 0.84, ry * 0.84, rx * 0.81, ry * 0.81, 32, INK_R, INK_G, INK_B, 0.62);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      this.pushLine(
        sx + ca * rx * 0.84,
        sy + sa * ry * 0.84,
        sx + ca * (rx - 4 * z),
        sy + sa * (ry - 2.5 * z),
        2.4 * z,
        INK_R,
        INK_G,
        INK_B,
        0.58
      );
    }
    // 8-point compass diamond rays inlaid in stone
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const aL = a - 0.14;
      const aR = a + 0.14;
      const tipFrac = (i & 1) === 0 ? 0.78 : 0.56;
      const colMul = (i & 1) === 0 ? 0.88 : 0.58;
      this.pushTriSolid(
        sx + Math.cos(a) * rx * tipFrac,
        sy + Math.sin(a) * ry * tipFrac,
        sx + Math.cos(aL) * rx * 0.24,
        sy + Math.sin(aL) * ry * 0.24,
        sx + Math.cos(aR) * rx * 0.24,
        sy + Math.sin(aR) * ry * 0.24,
        theme.wallTrim[0] * colMul,
        theme.wallTrim[1] * colMul,
        theme.wallTrim[2] * colMul,
        0.52,
        0.1
      );
    }
    // Inner boss-seal ring & central metallic rivet
    this.pushEllipseRing(sx, sy, rx * 0.34, ry * 0.34, rx * 0.27, ry * 0.27, 24, theme.wallTrim[0] * 0.85, theme.wallTrim[1] * 0.85, theme.wallTrim[2] * 0.85, 0.64, 0.14);
    this.pushEllipseFill(sx, sy, rx * 0.12, ry * 0.12, 16, theme.wallTrim[0], theme.wallTrim[1], theme.wallTrim[2], 0.52, 0.22);
  }

  private renderChasmPits(
    obstacles: readonly ArenaObstacle[],
    theme: BiomeVisualTheme,
    cam: CameraView
  ): void {
    const z = cam.zoom;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (obs.kind !== 'pit') continue;
      const cx = this.wxToSx(obs.pos.x, cam);
      const cy = this.wyToSy(obs.pos.y, 0, cam);
      const hw = obs.halfW * z;
      const hh = obs.halfH * cam.isoScaleY * z;
      const cxOff = hw * 0.36;
      const cyOff = hh * 0.42;

      const p0x = cx - hw + cxOff, p0y = cy - hh;
      const p1x = cx + hw - cxOff, p1y = cy - hh;
      const p2x = cx + hw, p2y = cy - hh + cyOff;
      const p3x = cx + hw, p3y = cy + hh - cyOff;
      const p4x = cx + hw - cxOff, p4y = cy + hh;
      const p5x = cx - hw + cxOff, p5y = cy + hh;
      const p6x = cx - hw, p6y = cy + hh - cyOff;
      const p7x = cx - hw, p7y = cy - hh + cyOff;

      // Outer carved recessed stone bevel coping collar framing the sunken chasm
      const pad = 11 * z;
      const o0x = p0x - pad * 0.35, o0y = p0y - pad * 0.65;
      const o1x = p1x + pad * 0.35, o1y = p1y - pad * 0.65;
      const o2x = p2x + pad, o2y = p2y - pad * 0.25;
      const o3x = p3x + pad, o3y = p3y + pad * 0.25;
      const o4x = p4x + pad * 0.35, o4y = p4y + pad * 0.65;
      const o5x = p5x - pad * 0.35, o5y = p5y + pad * 0.65;
      const o6x = p6x - pad, o6y = p6y + pad * 0.25;
      const o7x = p7x - pad, o7y = p7y - pad * 0.25;

      // Lit stone collar bevel (NW warm edge, SE deep shadow edge) + carved outer masonry mortar lip
      this.pushQuadSolid(o0x, o0y, o1x, o1y, p1x, p1y, p0x, p0y, theme.wallDark[0] * 0.84, theme.wallDark[1] * 0.84, theme.wallDark[2] * 0.84, 0.96);
      this.pushQuadSolid(o7x, o7y, o0x, o0y, p0x, p0y, p7x, p7y, theme.wallDark[0] * 0.74, theme.wallDark[1] * 0.74, theme.wallDark[2] * 0.74, 0.96);
      this.pushQuadSolid(o1x, o1y, o2x, o2y, p2x, p2y, p1x, p1y, theme.wallDark[0] * 0.64, theme.wallDark[1] * 0.64, theme.wallDark[2] * 0.64, 0.96);
      this.pushQuadSolid(p2x, p2y, o2x, o2y, o3x, o3y, p3x, p3y, theme.wallDark[0] * 0.76, theme.wallDark[1] * 0.76, theme.wallDark[2] * 0.76, 0.96);
      this.pushQuadSolid(p6x, p6y, p7x, p7y, o7x, o7y, o6x, o6y, theme.wallLit[0] * 0.84, theme.wallLit[1] * 0.84, theme.wallLit[2] * 0.84, 0.96);
      this.pushQuadSolid(p3x, p3y, p4x, p4y, o4x, o4y, o3x, o3y, theme.wallLit[0] * 0.94, theme.wallLit[1] * 0.94, theme.wallLit[2] * 0.94, 0.97);
      this.pushQuadSolid(p4x, p4y, p5x, p5y, o5x, o5y, o4x, o4y, theme.wallLit[0] * 1.04, theme.wallLit[1] * 1.04, theme.wallLit[2] * 1.04, 0.97);
      this.pushQuadSolid(p5x, p5y, p6x, p6y, o6x, o6y, o5x, o5y, theme.wallLit[0] * 0.9, theme.wallLit[1] * 0.9, theme.wallLit[2] * 0.9, 0.97);

      // Outer carved stone coping perimeter ink outline (integrates coping naturally into flagstones)
      this.pushLine(o0x, o0y, o1x, o1y, 2.8 * z, INK_R, INK_G, INK_B, 0.86);
      this.pushLine(o1x, o1y, o2x, o2y, 2.8 * z, INK_R, INK_G, INK_B, 0.86);
      this.pushLine(o2x, o2y, o3x, o3y, 2.8 * z, INK_R, INK_G, INK_B, 0.86);
      this.pushLine(o3x, o3y, o4x, o4y, 2.8 * z, INK_R, INK_G, INK_B, 0.86);
      this.pushLine(o4x, o4y, o5x, o5y, 2.8 * z, INK_R, INK_G, INK_B, 0.86);
      this.pushLine(o5x, o5y, o6x, o6y, 2.8 * z, INK_R, INK_G, INK_B, 0.86);
      this.pushLine(o6x, o6y, o7x, o7y, 2.8 * z, INK_R, INK_G, INK_B, 0.86);
      this.pushLine(o7x, o7y, o0x, o0y, 2.8 * z, INK_R, INK_G, INK_B, 0.86);
      // Coping corner stone slab miter joints
      this.pushLine(p0x, p0y, o0x, o0y, 2.0 * z, INK_R, INK_G, INK_B, 0.72);
      this.pushLine(p1x, p1y, o1x, o1y, 2.0 * z, INK_R, INK_G, INK_B, 0.72);
      this.pushLine(p4x, p4y, o4x, o4y, 2.0 * z, INK_R, INK_G, INK_B, 0.72);
      this.pushLine(p5x, p5y, o5x, o5y, 2.0 * z, INK_R, INK_G, INK_B, 0.72);

      // Deep pitch-black abyssal pit interior
      const vr = INK_R * 0.6;
      const vg = INK_G * 0.7;
      const vb = INK_B * 0.85;
      this.pushTriSolid(cx, cy, p0x, p0y, p1x, p1y, vr, vg, vb, 0.99);
      this.pushTriSolid(cx, cy, p1x, p1y, p2x, p2y, vr, vg, vb, 0.99);
      this.pushTriSolid(cx, cy, p2x, p2y, p3x, p3y, vr, vg, vb, 0.99);
      this.pushTriSolid(cx, cy, p3x, p3y, p4x, p4y, vr, vg, vb, 0.99);
      this.pushTriSolid(cx, cy, p4x, p4y, p5x, p5y, vr, vg, vb, 0.99);
      this.pushTriSolid(cx, cy, p5x, p5y, p6x, p6y, vr, vg, vb, 0.99);
      this.pushTriSolid(cx, cy, p6x, p6y, p7x, p7y, vr, vg, vb, 0.99);
      this.pushTriSolid(cx, cy, p7x, p7y, p0x, p0y, vr, vg, vb, 0.99);

      // Tiered 3D inner carved masonry wall dropping downward into abyssal shadow
      const dropH = Math.min(hh * 1.28, 48 * z);
      this.pushQuadGradientV(p0x, p0y, p1x, p1y, p1x, p1y + dropH, p0x, p0y + dropH, theme.wallLit[0] * 0.78, theme.wallLit[1] * 0.78, theme.wallLit[2] * 0.78, 0.98, INK_R, INK_G, INK_B, 0.98);
      this.pushQuadGradientV(p7x, p7y, p0x, p0y, p0x, p0y + dropH, p7x, p7y + dropH * 0.88, theme.wallDark[0] * 0.72, theme.wallDark[1] * 0.72, theme.wallDark[2] * 0.72, 0.98, INK_R, INK_G, INK_B, 0.98);
      this.pushQuadGradientV(p1x, p1y, p2x, p2y, p2x, p2y + dropH * 0.88, p1x, p1y + dropH, theme.wallDark[0] * 0.56, theme.wallDark[1] * 0.56, theme.wallDark[2] * 0.56, 0.98, INK_R, INK_G, INK_B, 0.98);
      // Stone masonry courses carved across inner north cliff face
      this.pushLine(p0x, p0y + dropH * 0.42, p1x, p1y + dropH * 0.42, 2.0 * z, INK_R, INK_G, INK_B, 0.78);
      const midTopX = (p0x + p1x) * 0.5;
      this.pushLine(midTopX, p0y, midTopX, p0y + dropH * 0.42, 1.8 * z, INK_R, INK_G, INK_B, 0.72);
      this.pushLine(p0x + (p1x - p0x) * 0.28, p0y + dropH * 0.42, p0x + (p1x - p0x) * 0.28, p0y + dropH * 0.85, 1.6 * z, INK_R, INK_G, INK_B, 0.65);
      this.pushLine(p0x + (p1x - p0x) * 0.72, p0y + dropH * 0.42, p0x + (p1x - p0x) * 0.72, p0y + dropH * 0.85, 1.6 * z, INK_R, INK_G, INK_B, 0.65);

      // Rising spectral abyssal mist swirling deep inside the chasm
      this.pushSprite('vfx_glow_soft', cx, cy + hh * 0.28, (hw * 1.15) / 64, (hh * 0.88) / 64, 0, theme.rimGlow[0], theme.rimGlow[1], theme.rimGlow[2], 0.34, 0, 0.75);

      // Crisp jet-black comic ink lip + metallic highlight edge on south/inner bevel
      this.pushLine(p0x, p0y, p1x, p1y, 4.4 * z, INK_R, INK_G, INK_B, 0.98);
      this.pushLine(p1x, p1y, p2x, p2y, 4.4 * z, INK_R, INK_G, INK_B, 0.98);
      this.pushLine(p2x, p2y, p3x, p3y, 4.4 * z, INK_R, INK_G, INK_B, 0.98);
      this.pushLine(p3x, p3y, p4x, p4y, 4.4 * z, INK_R, INK_G, INK_B, 0.98);
      this.pushLine(p4x, p4y, p5x, p5y, 4.4 * z, INK_R, INK_G, INK_B, 0.98);
      this.pushLine(p5x, p5y, p6x, p6y, 4.4 * z, INK_R, INK_G, INK_B, 0.98);
      this.pushLine(p6x, p6y, p7x, p7y, 4.4 * z, INK_R, INK_G, INK_B, 0.98);
      this.pushLine(p7x, p7y, p0x, p0y, 4.4 * z, INK_R, INK_G, INK_B, 0.98);

      this.pushLine(p3x, p3y, p4x, p4y, 2.0 * z, theme.wallTrim[0] * 0.82, theme.wallTrim[1] * 0.82, theme.wallTrim[2] * 0.82, 0.78, 0.22);
      this.pushLine(p4x, p4y, p5x, p5y, 2.2 * z, theme.wallTrim[0] * 0.88, theme.wallTrim[1] * 0.88, theme.wallTrim[2] * 0.88, 0.84, 0.26);
      this.pushLine(p5x, p5y, p6x, p6y, 2.0 * z, theme.wallTrim[0] * 0.82, theme.wallTrim[1] * 0.82, theme.wallTrim[2] * 0.82, 0.78, 0.22);
    }
  }

  private renderFloorDecals(vfx: ParticlesAndDecals, cam: CameraView): void {
    const z = cam.zoom;
    for (let i = 0; i < MAX_DECALS; i++) {
      const d = vfx.decals[i];
      if (!d.active) continue;
      const fade = Math.min(1, d.life / Math.min(2.2, d.maxLife * 0.3));
      const sx = this.wxToSx(d.x, cam);
      const sy = this.wyToSy(d.y, 0, cam);
      const spriteId =
        d.kind === 'crater'
          ? this.resolveSprite('vfx_decal_crater', 'vfx_decal_crack')
          : d.kind === 'ichor'
            ? 'vfx_decal_ichor'
            : d.kind === 'crack'
              ? 'vfx_decal_crack'
              : 'vfx_decal_scorch';
      const baseScale = this.spriteScaleForMaxDim(spriteId, 144 * z);
      const emissive = d.kind === 'foot_scorch' ? 1.5 * fade : 0;
      this.pushSprite(
        spriteId,
        sx,
        sy,
        d.scaleX * baseScale,
        d.scaleY * baseScale,
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

  // ============================================================================
  // Pass 1.5: Dedicated Animated Procedural GLSL Hazard Shader Pass
  // ============================================================================

  private renderCuringBasinFrames(
    hazards: readonly HazardState[],
    cam: CameraView,
    timeSec: number
  ): void {
    const z = cam.zoom;
    for (let i = 0; i < hazards.length; i++) {
      const h = hazards[i];
      if (h.kind !== 'curing_pool') continue;
      const sx = this.wxToSx(h.pos.x, cam);
      const sy = this.wyToSy(h.pos.y, 0, cam);
      const rx = h.radius * z;
      const ry = h.radius * cam.isoScaleY * z;
      const pulse = 0.92 + 0.08 * Math.sin(timeSec * 4.2);
      this.pushSprite('vfx_glow_soft', sx, sy, (rx * 1.55) / 64, (ry * 1.55) / 64, 0, 0.22, 0.92, 1.0, 0.45 * pulse, 0, 0.95);
      const basinSc = this.spriteScaleForMaxDim('vfx_curing_basin', Math.max(96, h.radius * 2.35) * z);
      this.pushSprite('vfx_curing_basin', sx, sy, basinSc, basinSc, 0, 1, 1, 1, 0.96, 0, 0.25);
    }
  }

  private renderShaderHazards(
    hazards: readonly HazardState[],
    cam: CameraView,
    timeSec: number
  ): void {
    if (hazards.length === 0) return;

    let anyShaderHazard = false;
    for (let i = 0; i < hazards.length; i++) {
      const k = hazards[i].kind as string;
      if (
        k === 'lava_pool' ||
        k === 'boiling_geyser' ||
        k === 'poison_pool' ||
        k === 'consecrated_aura' ||
        k === 'consecrated_ground' ||
        k === 'curing_pool'
      ) {
        anyShaderHazard = true;
        break;
      }
    }
    if (!anyShaderHazard) return;

    // Flush batched sprites before switching to HAZARD_VERT / HAZARD_FRAG
    this.flushBatch();

    const gl = this.gl;
    gl.useProgram(this.hazardProg);
    gl.bindVertexArray(this.emptyVao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(this.uHazard.uResolution, this.viewW, this.viewH);
    gl.uniform1f(this.uHazard.uTime, timeSec);

    for (let i = 0; i < hazards.length; i++) {
      const h = hazards[i];
      const k = h.kind as string;
      let shaderKind = -1;
      let radiusScale = 1.0;
      let yOffset = 0;

      if (k === 'lava_pool' || k === 'boiling_geyser') {
        shaderKind = 0;
      } else if (k === 'poison_pool') {
        shaderKind = 1;
      } else if (k === 'consecrated_aura' || k === 'consecrated_ground') {
        shaderKind = 2;
      } else if (k === 'curing_pool') {
        shaderKind = 3;
        radiusScale = 0.72; // ripples visibly right inside the carved marble basin bowl!
        yOffset = -8 * cam.zoom;
      } else {
        continue;
      }

      const sx = this.wxToSx(h.pos.x, cam);
      const sy = this.wyToSy(h.pos.y, 0, cam) + yOffset;
      const rx = h.radius * radiusScale * cam.zoom;
      const ry = h.radius * radiusScale * cam.isoScaleY * cam.zoom;
      const seed = Math.abs(Math.sin(h.pos.x * 0.037 + h.pos.y * 0.023 + i * 1.17));

      gl.uniform2f(this.uHazard.uCenterScreen, sx, sy);
      gl.uniform2f(this.uHazard.uHalfSizeScreen, rx, ry);
      gl.uniform2f(this.uHazard.uCenterWorld, h.pos.x, h.pos.y);
      gl.uniform1f(this.uHazard.uRadius, Math.max(12, h.radius * radiusScale));
      gl.uniform1f(this.uHazard.uKind, shaderKind);
      gl.uniform1f(this.uHazard.uSeed, seed);
      gl.uniform1f(this.uHazard.uOpacity, 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.drawCalls++;
    }

    // Restore sprite batch state cleanly
    this.activeTexture = null;
    this.currentBlend = 'alpha';
    this.setBatchState(this.atlasTex, 'alpha');
  }

  private renderNonShaderHazards(
    hazards: readonly HazardState[],
    cam: CameraView,
    timeSec: number
  ): void {
    const z = cam.zoom;
    for (let i = 0; i < hazards.length; i++) {
      const h = hazards[i];
      const sx = this.wxToSx(h.pos.x, cam);
      const sy = this.wyToSy(h.pos.y, 0, cam);

      if (h.kind === 'spike_trap') {
        const id = h.active ? 'prop_spike_active' : h.armed ? 'prop_spike_armed' : 'prop_spike_idle';
        const scale = this.spriteScaleForMaxDim(id, Math.max(96, h.radius * 2.1) * z);
        this.pushSprite(id, sx, sy, scale, scale, 0, 1, 1, 1, 1, 0, h.armed ? 0.5 : 0);
      } else if (h.kind === 'sawblade') {
        const sc = this.spriteScaleForMaxDim('vfx_sawblade', Math.max(66, h.radius * 2.15) * z);
        this.pushSprite('vfx_sawblade', sx, sy - 8 * z, sc, sc * 0.86, timeSec * 14, 1, 1, 1, 1, 0, 0.45);
      } else if (h.kind === 'pylon') {
        const sc = this.spriteScaleForMaxDim('vfx_pylon', Math.max(76, h.radius * 2.35) * z);
        this.pushSprite('vfx_pylon', sx, sy, sc, sc, 0, 1, 1, 1, 1, 0, 0.55);
      } else if (h.kind === 'rift_vortex') {
        const sc = this.spriteScaleForMaxDim('vfx_blade_rift', Math.max(92, h.radius * 2.2) * z);
        this.pushSprite('vfx_blade_rift', sx, sy - 6 * z, sc, sc * cam.isoScaleY, timeSec * 9, 1, 1, 1, 0.95, 0, 0.8);
      }
    }
  }

  // ============================================================================
  // Pass 2b: Biome/Boss-Themed Danger Rune Telegraphs + Cast Ground Shadows
  // ============================================================================

  private renderTelegraphs(
    state: SimState,
    theme: BiomeVisualTheme,
    cam: CameraView,
    timeSec: number
  ): void {
    const telegraphs = state.room.telegraphs;
    const obstacles = state.room.obstacles;
    const z = cam.zoom;

    for (let i = 0; i < telegraphs.length; i++) {
      const t = telegraphs[i];
      const prog = Math.max(0, Math.min(1, t.progress));

      // Derive biome/boss-themed crisp danger rune colors (no generic pink donuts!)
      let cr = theme.telegraphPrimary[0];
      let cg = theme.telegraphPrimary[1];
      let cb = theme.telegraphPrimary[2];
      let ar = theme.telegraphAccent[0];
      let ag = theme.telegraphAccent[1];
      let ab = theme.telegraphAccent[2];

      if (t.ownerId) {
        for (let eIdx = 0; eIdx < state.enemies.length; eIdx++) {
          const en = state.enemies[eIdx];
          if (en.id === t.ownerId && en.bossId) {
            if (en.bossId === 'sovereign_lord') {
              cr = 1.0; cg = 0.13; cb = 0.24;
              ar = 0.98; ag = 0.72; ab = 0.28;
            } else if (en.bossId === 'bone_leviathan') {
              cr = 1.0; cg = 0.34; cb = 0.06;
              ar = 1.0; ag = 0.86; ab = 0.3;
            } else if (en.bossId === 'colosseum_bull' || en.bossId === 'colosseum_spearlord') {
              cr = 0.96; cg = 0.72; cb = 0.16;
              ar = 1.0; ag = 0.18; ab = 0.3;
            } else if (en.bossId === 'the_ferryman') {
              cr = 0.68; cg = 0.24; cb = 1.0;
              ar = 0.95; ag = 0.8; ab = 0.32;
            }
            break;
          }
        }
      }

      const hotFlash = prog > 0.78 ? (prog - 0.78) / 0.22 : 0;
      // Preserve rich jewel chromaticity through 100% progress (never clip RGBA8 FBO to white-silver!)
      const r = Math.min(1.0, cr + (1.0 - cr) * hotFlash * 0.26);
      const g = Math.min(1.0, cg + (Math.max(cg, 0.36) - cg) * hotFlash * 0.28);
      const b = Math.min(1.0, cb * (1.0 - hotFlash * 0.42));
      const sx = this.wxToSx(t.pos.x, cam);
      const sy = this.wyToSy(t.pos.y, 0, cam);
      const fillEmissive = 0.14 + hotFlash * 0.18 + 0.04 * Math.sin(timeSec * 26);
      const rimEmissive = 0.30 + hotFlash * 0.34 + 0.08 * Math.sin(timeSec * 26);

      if (t.kind === 'circle' || t.kind === 'ring') {
        const rx = t.radius * z;
        const ry = t.radius * cam.isoScaleY * z;
        const irx = (t.innerRadius ?? 0) * z;
        const iry = (t.innerRadius ?? 0) * cam.isoScaleY * z;

        // 1. Translucent dark-ink backed footprint + animated radial countdown fill
        if (t.kind === 'ring' && irx > 2) {
          this.pushEllipseRing(sx, sy, rx, ry, irx, iry, 28, INK_R, INK_G, INK_B, 0.34);
          this.pushEllipseRing(sx, sy, rx, ry, irx, iry, 28, cr, cg, cb, 0.22, 0.16);
          const fillRx = irx + (rx - irx) * prog;
          const fillRy = iry + (ry - iry) * prog;
          this.pushEllipseRing(sx, sy, fillRx, fillRy, irx, iry, 28, r, g, b, 0.42 + prog * 0.26, fillEmissive);
        } else {
          this.pushEllipseFill(sx, sy, rx, ry, 28, INK_R, INK_G, INK_B, 0.3);
          this.pushEllipseFill(sx, sy, rx, ry, 28, cr, cg, cb, 0.18, 0.14);
          this.pushEllipseFill(sx, sy, rx * prog, ry * prog, 28, r, g, b, 0.4 + prog * 0.26, fillEmissive);
        }

        // 2. Heavy #09060E outer ink contour + razor bright danger border
        this.pushEllipseRing(sx, sy, rx + 5.5 * z, ry + 3.4 * z, Math.max(1, rx - 1.0 * z), Math.max(1, ry - 0.6 * z), 32, INK_R, INK_G, INK_B, 0.94);
        this.pushEllipseRing(sx, sy, rx, ry, Math.max(1, rx - 3.6 * z), Math.max(1, ry - 2.2 * z), 32, r, g, b, 0.96, rimEmissive);

        // 3. Rotating notched danger rune dashes & inward spikes around circumference
        const notchCount = rx > 110 * z ? 16 : 12;
        const rotOff = timeSec * 0.9 * (i % 2 === 0 ? 1 : -1);
        for (let n = 0; n < notchCount; n++) {
          const a = rotOff + (n / notchCount) * Math.PI * 2;
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const isMajor = (n & 3) === 0;
          const inFrac = isMajor ? 0.78 : 0.88;
          this.pushLine(
            sx + ca * rx * 0.98,
            sy + sa * ry * 0.98,
            sx + ca * rx * inFrac,
            sy + sa * ry * inFrac,
            (isMajor ? 3.2 : 2.0) * z,
            isMajor ? ar : r,
            isMajor ? ag : g,
            isMajor ? ab : b,
            0.94,
            isMajor ? 0.26 : rimEmissive * 0.7
          );
        }
      } else if (t.kind === 'cone') {
        const halfArc = ((t.arcDeg ?? 65) * Math.PI) / 360;
        const segs = 16;
        const rx = t.radius * z;
        const ry = t.radius * cam.isoScaleY * z;
        const step = (halfArc * 2) / segs;
        for (let s = 0; s < segs; s++) {
          const a0 = t.angle - halfArc + s * step;
          const a1 = a0 + step;
          this.pushTriSolid(sx, sy, sx + Math.cos(a0) * rx, sy + Math.sin(a0) * ry, sx + Math.cos(a1) * rx, sy + Math.sin(a1) * ry, INK_R, INK_G, INK_B, 0.28);
          this.pushTriSolid(sx, sy, sx + Math.cos(a0) * rx, sy + Math.sin(a0) * ry, sx + Math.cos(a1) * rx, sy + Math.sin(a1) * ry, cr, cg, cb, 0.2, 0.14);
          this.pushTriSolid(sx, sy, sx + Math.cos(a0) * rx * prog, sy + Math.sin(a0) * ry * prog, sx + Math.cos(a1) * rx * prog, sy + Math.sin(a1) * ry * prog, r, g, b, 0.42 + prog * 0.24, fillEmissive);
          this.pushLine(sx + Math.cos(a0) * (rx + 3 * z), sy + Math.sin(a0) * (ry + 2 * z), sx + Math.cos(a1) * (rx + 3 * z), sy + Math.sin(a1) * (ry + 2 * z), 5.5 * z, INK_R, INK_G, INK_B, 0.92);
          this.pushLine(sx + Math.cos(a0) * rx, sy + Math.sin(a0) * ry, sx + Math.cos(a1) * rx, sy + Math.sin(a1) * ry, 3.4 * z, r, g, b, 0.96, rimEmissive);
        }
        this.pushLine(sx, sy, sx + Math.cos(t.angle - halfArc) * rx, sy + Math.sin(t.angle - halfArc) * ry, 5.2 * z, INK_R, INK_G, INK_B, 0.92);
        this.pushLine(sx, sy, sx + Math.cos(t.angle + halfArc) * rx, sy + Math.sin(t.angle + halfArc) * ry, 5.2 * z, INK_R, INK_G, INK_B, 0.92);
        this.pushLine(sx, sy, sx + Math.cos(t.angle - halfArc) * rx, sy + Math.sin(t.angle - halfArc) * ry, 3.0 * z, ar, ag, ab, 0.95, 0.28);
        this.pushLine(sx, sy, sx + Math.cos(t.angle + halfArc) * rx, sy + Math.sin(t.angle + halfArc) * ry, 3.0 * z, ar, ag, ab, 0.95, 0.28);
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
        const hitPillar = len < rawLen - 0.5;
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
        const endSx = this.wxToSx(t.pos.x + c * len, cam);
        const endSy = this.wyToSy(t.pos.y + s * len, 0, cam);

        // 1. Deep chiaroscuro obsidian backing + rich saturated danger zone fill (zero pink/white washout!)
        this.pushQuadSolid(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, INK_R, INK_G, INK_B, 0.52);
        this.pushQuadSolid(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, cr, cg, cb, 0.26, 0.12);

        // 2. Advancing countdown danger fill sweeping along lane (deep saturated crimson)
        const fLen = len * prog;
        const f2x = this.wxToSx(t.pos.x + c * fLen - px, cam);
        const f2y = this.wyToSy(t.pos.y + s * fLen - py, 0, cam);
        const f3x = this.wxToSx(t.pos.x + c * fLen + px, cam);
        const f3y = this.wyToSy(t.pos.y + s * fLen + py, 0, cam);
        this.pushQuadSolid(p0x, p0y, p1x, p1y, f2x, f2y, f3x, f3y, r, g, b, 0.48 + prog * 0.24, fillEmissive);

        // 3. Animated directional hammered-gold chevron danger pulses marching along the beam lane
        const chevSpacing = 92;
        const scroll = (timeSec * 220) % chevSpacing;
        const chevSpread = Math.min(halfW * 0.72, 22);
        const chevBack = Math.min(26, chevSpread * 1.15);
        for (let d = scroll + 26; d < len - 18; d += chevSpacing) {
          const tipWx = t.pos.x + c * d;
          const tipWy = t.pos.y + s * d;
          const baseWx = tipWx - c * chevBack;
          const baseWy = tipWy - s * chevBack;
          const tx = this.wxToSx(tipWx, cam);
          const ty = this.wyToSy(tipWy, 0, cam);
          const lx = this.wxToSx(baseWx - s * chevSpread, cam);
          const ly = this.wyToSy(baseWy + c * chevSpread, 0, cam);
          const rx2 = this.wxToSx(baseWx + s * chevSpread, cam);
          const ry2 = this.wyToSy(baseWy - c * chevSpread, 0, cam);
          const cAlpha = 0.78 + prog * 0.2;
          this.pushLine(lx, ly, tx, ty, 4.6 * z, INK_R, INK_G, INK_B, cAlpha * 0.9);
          this.pushLine(rx2, ry2, tx, ty, 4.6 * z, INK_R, INK_G, INK_B, cAlpha * 0.9);
          this.pushLine(lx, ly, tx, ty, 2.3 * z, ar, ag, ab, cAlpha, 0.28 + hotFlash * 0.16);
          this.pushLine(rx2, ry2, tx, ty, 2.3 * z, ar, ag, ab, cAlpha, 0.28 + hotFlash * 0.16);
        }

        // 4. Heavy #09060E outer ink rails + razor-bright crimson inner rails
        const bw = 3.2 * z;
        this.pushLine(p0x, p0y, p3x, p3y, bw + 4.2 * z, INK_R, INK_G, INK_B, 0.96);
        this.pushLine(p1x, p1y, p2x, p2y, bw + 4.2 * z, INK_R, INK_G, INK_B, 0.96);
        this.pushLine(p0x, p0y, p3x, p3y, bw, r, g, b, 0.98, rimEmissive);
        this.pushLine(p1x, p1y, p2x, p2y, bw, r, g, b, 0.98, rimEmissive);

        // 5. Glowing crimson-gold center laser sightline + crisp gold filament
        const sightPulse = 0.85 + 0.15 * Math.sin(timeSec * 34);
        this.pushLine(sx, sy, endSx, endSy, 5.4 * z, INK_R, INK_G, INK_B, 0.78);
        this.pushLine(sx, sy, endSx, endSy, 3.0 * z * sightPulse, r, g, b, 0.96, rimEmissive + 0.18);
        this.pushLine(sx, sy, endSx, endSy, 1.35 * z * sightPulse, 1.0, 0.92, 0.56, 0.96, 0.45);

        // 6. Bright emitter origin ring + reinforced pillar/end termination flare
        const emR = Math.max(12, halfW * 0.65) * z;
        this.pushEllipseRing(sx, sy, emR + 3 * z, (emR + 3 * z) * cam.isoScaleY, Math.max(1, emR - 1 * z), Math.max(1, (emR - 1 * z) * cam.isoScaleY), 16, INK_R, INK_G, INK_B, 0.92);
        this.pushEllipseRing(sx, sy, emR, emR * cam.isoScaleY, Math.max(1, emR - 3 * z), Math.max(1, (emR - 3 * z) * cam.isoScaleY), 16, ar, ag, ab, 0.95, 0.34);
        this.pushSprite('vfx_glow_soft', sx, sy, 0.42 * z, 0.28 * z, 0, r, g, b, 0.62, 0, 0.45);

        this.pushLine(p2x, p2y, p3x, p3y, (hitPillar ? bw * 2.1 : bw * 1.4) + 3 * z, INK_R, INK_G, INK_B, 0.95);
        this.pushLine(p2x, p2y, p3x, p3y, hitPillar ? bw * 1.85 : bw * 1.15, ar, ag, ab, 0.98, 0.36);
        const flareScale = hitPillar ? 0.74 : 0.44;
        this.pushSprite('vfx_glow_soft', endSx, endSy, flareScale * z, flareScale * 0.72 * z, 0, r, g, b, 0.74, 0, 0.55);
        const endSpark = this.resolveSprite('vfx_hit_spark', 'vfx_spark_burst');
        const spSc = this.spriteScaleForMaxDim(endSpark, (hitPillar ? 44 : 26) * z * sightPulse);
        this.pushSprite(endSpark, endSx, endSy, spSc, spSc, timeSec * 12, 1.0, 0.88, 0.46, 0.92, 0, 0.55);
      }
    }
  }

  /**
   * Projects a skewed directional SE cast ground shadow (`[+0.68, +0.44]`) across flagstones
   * with subtle brazier-proximity softening so warm firelight feels physically grounded.
   */
  private pushDirectionalCastShadow(
    wx: number,
    wy: number,
    baseRadiusW: number,
    heightWorld: number,
    alpha: number,
    cam: CameraView
  ): void {
    const z = cam.zoom;
    let dirX = SHADOW_DIR_X;
    let dirY = SHADOW_DIR_Y;
    let modAlpha = alpha;

    // Subtle firelight softening / direction bend when right beside a burning brazier
    for (let i = 0; i < this.braziers.length; i++) {
      const br = this.braziers[i];
      const dx = wx - br.x;
      const dy = wy - br.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 16 && d2 < 210 * 210) {
        const dist = Math.sqrt(d2);
        const w = (1 - dist / 210) * 0.32;
        dirX = dirX * (1 - w) + (dx / dist) * 0.72 * w;
        dirY = dirY * (1 - w) + (dy / dist) * 0.52 * w;
        modAlpha *= 1 - w * 0.45;
      }
    }

    const bx = this.wxToSx(wx, cam);
    const by = this.wyToSy(wy, 0, cam);
    const tx = this.wxToSx(wx + dirX * heightWorld, cam);
    const ty = this.wyToSy(wy + dirY * heightWorld, 0, cam);

    const sdx = tx - bx;
    const sdy = ty - by;
    const sLen = Math.hypot(sdx, sdy);
    if (sLen < 2) return;

    // Soft feathered painterly directional shadow using radial gradient sprite (zero hard geometric edges!)
    const midX = (bx + tx) * 0.5;
    const midY = (by + ty) * 0.5;
    const ang = Math.atan2(sdy, sdx);
    const scaleX = (sLen * 0.72 + baseRadiusW * z * 0.65) / 64;
    const scaleY = (baseRadiusW * z * 1.08) / 64;
    this.pushSprite('vfx_glow_soft', midX, midY, scaleX, scaleY, ang, INK_R, INK_G, INK_B, modAlpha * 0.88, 0, 0);
  }

  /**
   * Two-Layer Ground Shadow System (Style Bible Section 4.3):
   *   Layer 1: Directional SE `[+0.68, +0.44]` cast ground shadows across flagstones
   *   Layer 2: Tight dark `#09060E` Contact AO skirts beneath bases & feet
   */
  private renderContactAndCastShadows(
    state: SimState,
    prevState: SimState | null,
    cam: CameraView
  ): void {
    const z = cam.zoom;
    const heroPos = this.interpPlayerPos(state, prevState, cam.interpAlpha);

    // 1. Directional SE Cast Shadows across flagstones (pillars, obelisks, braziers, urns, Hero, enemies, bosses)
    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind === 'pit') continue;
      if (obs.kind === 'destructible_urn') {
        this.pushDirectionalCastShadow(obs.pos.x, obs.pos.y + 4, obs.halfW * 0.9, 46, 0.44, cam);
      } else if (obs.kind === 'statue') {
        this.pushDirectionalCastShadow(obs.pos.x, obs.pos.y + obs.halfH * 0.3, obs.halfW * 0.95, 148, 0.5, cam);
      } else {
        // Pillars & wall blocks cast long dramatic architectural shadows!
        this.pushDirectionalCastShadow(obs.pos.x, obs.pos.y + obs.halfH * 0.35, obs.halfW * 0.96, 195, 0.52, cam);
      }
    }

    for (let i = 0; i < this.cornerObelisks.length; i++) {
      const ob = this.cornerObelisks[i];
      this.pushDirectionalCastShadow(ob.x, ob.y, 26, 162, 0.48, cam);
    }

    for (let i = 0; i < this.braziers.length; i++) {
      const br = this.braziers[i];
      this.pushDirectionalCastShadow(br.x, br.y, 22, 58, 0.34, cam);
    }

    const heroHeight = state.player.dashTimer > 0 ? 72 : 98;
    this.pushDirectionalCastShadow(heroPos.x, heroPos.y, 24, heroHeight, 0.46, cam);

    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.aiState === 'dead') continue;
      const ep = this.interpEnemyPos(e, prevState, cam.interpAlpha);
      const castH = e.isBoss ? 175 : Math.max(76, e.radius * 3.1);
      this.pushDirectionalCastShadow(ep.x, ep.y, Math.max(20, e.radius * 0.85), castH, e.isBoss ? 0.54 : 0.45, cam);
    }

    // 2. Soft Feathered Dark `#09060E` Contact AO Skirts (zero hard oval cutouts!)
    const drawSoftContactAo = (sx: number, sy: number, rx: number, alpha: number) => {
      const ry = rx * cam.isoScaleY;
      this.pushSprite('vfx_glow_soft', sx, sy, (rx * 1.45) / 64, (ry * 1.45) / 64, 0, INK_R, INK_G, INK_B, alpha, 0, 0);
      this.pushSprite('vfx_glow_soft', sx, sy, (rx * 0.88) / 64, (ry * 0.88) / 64, 0, INK_R, INK_G, INK_B, alpha * 0.72, 0, 0);
    };

    drawSoftContactAo(this.wxToSx(heroPos.x, cam), this.wyToSy(heroPos.y, 0, cam), 36 * z, 0.74);

    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.aiState === 'dead') continue;
      const ep = this.interpEnemyPos(e, prevState, cam.interpAlpha);
      const rx = Math.max(26, e.radius * (e.isBoss ? 1.32 : 1.16)) * z;
      drawSoftContactAo(this.wxToSx(ep.x, cam), this.wyToSy(ep.y, 0, cam), rx, 0.76);
    }

    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind === 'pit') continue;
      const rx = Math.max(28, obs.halfW * 1.32) * z;
      drawSoftContactAo(this.wxToSx(obs.pos.x, cam), this.wyToSy(obs.pos.y + obs.halfH * 0.35, 0, cam), rx, 0.78);
    }

    for (let i = 0; i < this.braziers.length; i++) {
      const br = this.braziers[i];
      drawSoftContactAo(this.wxToSx(br.x, cam), this.wyToSy(br.y, 0, cam), 30 * z, 0.72);
    }
  }

  // ============================================================================
  // Pass 3: Y-Sorted Ink-Cel Entities, Cloak, Weapons, Beams & Smears
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
    theme: BiomeVisualTheme,
    timeSec: number
  ): void {
    this.sortCount = 0;

    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind === 'pit') continue;
      this.pushSortItem('obstacle', obs.pos.y + obs.halfH * 0.4, i, obs.pos.x, obs.pos.y);
    }
    for (let i = 0; i < this.braziers.length; i++) {
      const br = this.braziers[i];
      this.pushSortItem('brazier', br.y, i, br.x, br.y);
    }
    for (let i = 0; i < this.cornerObelisks.length; i++) {
      const ob = this.cornerObelisks[i];
      if (!ob.north) {
        this.pushSortItem('obelisk', ob.y + 10, i, ob.x, ob.y);
      }
    }
    for (let i = 0; i < state.room.doors.length; i++) {
      const door = state.room.doors[i];
      this.pushSortItem('door', door.pos.y - 10, i, door.pos.x, door.pos.y);
    }
    for (let i = 0; i < state.room.pickups.length; i++) {
      const pk = state.room.pickups[i];
      if (pk.collected) continue;
      this.pushSortItem('pickup', pk.pos.y, i, pk.pos.x, pk.pos.y);
    }
    for (let i = 0; i < state.room.bloodstones.length; i++) {
      const bs = state.room.bloodstones[i];
      this.pushSortItem('bloodstone', bs.pos.y, i, bs.pos.x, bs.pos.y);
    }
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.aiState === 'dead') continue;
      const ep = this.interpEnemyPos(e, prevState, cam.interpAlpha);
      this.pushSortItem('enemy', ep.y, i, ep.x, ep.y);
    }
    const heroPos = this.interpPlayerPos(state, prevState, cam.interpAlpha);
    this.pushSortItem('hero', heroPos.y, 0, heroPos.x, heroPos.y);

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

    this.renderDashGhosts(state, cam);

    for (let i = 0; i < this.sortCount; i++) {
      const item = this.sortPool[i];
      switch (item.kind) {
        case 'obstacle':
          this.renderObstacle(state.room.obstacles[item.idx], state.room.biome, cam);
          break;
        case 'brazier':
          this.renderBrazier(item.x, item.y, item.idx, theme, cam, timeSec);
          break;
        case 'obelisk':
          this.renderCornerObelisk(item.x, item.y, state.room.biome, theme, cam);
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
    const z = cam.zoom;

    if (obs.kind === 'destructible_urn') {
      const scale = this.spriteScaleForHeight('prop_urn', Math.max(82, obs.halfW * 3.6) * z);
      this.pushSprite('prop_urn', sx, sy, scale, scale, 0, 1, 1, 1, 1);
      return;
    }

    if (obs.kind === 'statue') {
      const scale = this.spriteScaleForHeight('prop_statue', Math.max(236, obs.halfW * 4.8) * z);
      this.pushSprite('prop_statue', sx, sy, scale, scale, 0, 1, 1, 1, 1);
      return;
    }

    if (obs.kind === 'wall' || obs.kind === 'gate') {
      const x0 = this.wxToSx(obs.pos.x - obs.halfW, cam);
      const x1 = this.wxToSx(obs.pos.x + obs.halfW, cam);
      const y0 = this.wyToSy(obs.pos.y - obs.halfH, 0, cam);
      const y1 = this.wyToSy(obs.pos.y + obs.halfH, 0, cam);
      const wallH = 68 * z;
      const theme = BIOME_THEMES[biome] ?? BIOME_THEMES.obsidian_pit;
      this.pushQuadSolid(x0, y1 - wallH, x1, y1 - wallH, x1, y1, x0, y1, theme.wallDark[0], theme.wallDark[1], theme.wallDark[2], 1);
      this.pushQuadSolid(x0, y0 - wallH, x1, y0 - wallH, x1, y1 - wallH, x0, y1 - wallH, theme.wallLit[0], theme.wallLit[1], theme.wallLit[2], 1);
      this.pushLine(x0, y1 - wallH, x1, y1 - wallH, 3.2 * z, theme.wallTrim[0], theme.wallTrim[1], theme.wallTrim[2], 0.95);
      this.pushLine(x0, y1, x1, y1, 3.6 * z, INK_R, INK_G, INK_B, 1);
      return;
    }

    // Biome-specific carved architectural pillar (monumental painted column!)
    const pillarId = getBiomePillarSpriteId(biome);
    const scale = this.spriteScaleForHeight(pillarId, Math.max(264, obs.halfW * 5.6) * z);
    this.pushSprite(pillarId, sx, sy, scale, scale, 0, 1, 1, 1, 1);
  }

  private renderBrazier(
    wx: number,
    wy: number,
    idx: number,
    theme: BiomeVisualTheme,
    cam: CameraView,
    timeSec: number
  ): void {
    const sx = this.wxToSx(wx, cam);
    const sy = this.wyToSy(wy, 0, cam);
    const z = cam.zoom;
    const s = this.spriteScaleForHeight('prop_brazier', 106 * z);
    this.pushSprite('prop_brazier', sx, sy, s, s, 0, 1, 1, 1, 1);

    // Painterly volumetric ember glow + delicate translucent flickering fire licking above painted coals
    const flick = 0.88 + 0.14 * Math.sin(timeSec * 11.3 + idx * 1.9) + 0.06 * Math.sin(timeSec * 27.1 + idx * 3.1);
    const sway = Math.sin(timeSec * 8.2 + idx * 2.7) * 0.14;
    this.pushSprite(
      'vfx_glow_soft',
      sx,
      sy - 48 * z,
      0.95 * z * flick,
      0.72 * z * flick,
      0,
      theme.brazierColor[0],
      theme.brazierColor[1],
      theme.brazierColor[2],
      0.46,
      0,
      1.35
    );
    const fSc = this.spriteScaleForHeight('vfx_flame_tongue', 44 * z);
    this.pushSprite(
      'vfx_flame_tongue',
      sx,
      sy - 46 * z,
      fSc * 0.92 * flick,
      fSc * flick,
      sway,
      1.0,
      0.48,
      0.12,
      0.66,
      0,
      1.45
    );
    this.pushSprite(
      'vfx_flame_tongue',
      sx + 2.0 * z,
      sy - 48 * z,
      fSc * 0.52 * flick,
      fSc * 0.62 * flick,
      -sway * 1.15,
      1.0,
      0.9,
      0.52,
      0.56,
      0,
      1.85
    );
  }

  private renderDoor(door: ArenaDoor, cam: CameraView, timeSec: number): void {
    const sx = this.wxToSx(door.pos.x, cam);
    const sy = this.wyToSy(door.pos.y, 0, cam);
    const z = cam.zoom;
    const isOpen = !door.locked;

    if (isOpen) {
      const pulse = 0.86 + 0.14 * Math.sin(timeSec * 4.2);
      const [rr, rg, rb] = door.reward.patronId
        ? hexToRgbaTuple(PATRON_CONSTANTS[door.reward.patronId].colorHex)
        : [0.35, 0.96, 0.72];
      this.pushSprite('vfx_glow_soft', sx, sy - 24 * z, 2.1 * z * pulse, 1.35 * z * pulse, 0, rr, rg, rb, 0.58, 0, 1.45);
    }

    const doorId = isOpen ? 'prop_exit_door_open' : 'prop_exit_door_locked';
    const scale = this.spriteScaleForHeight(doorId, 238 * z);
    this.pushSprite(doorId, sx, sy, scale, scale, 0, 1, 1, 1, 1, 0, isOpen ? 0.25 : 0);

    const bob = Math.sin(timeSec * 3.4 + door.pos.x * 0.01) * 7 * z;
    const sigilY = sy - 134 * z + bob;
    const sigilId = door.reward.isBoss
      ? 'vfx_skull_badge'
      : door.reward.patronId
        ? getPatronSigilSpriteId(door.reward.patronId)
        : getPickupSpriteId(door.reward.kind);
    const sigilScale = this.spriteScaleForMaxDim(sigilId, (isOpen ? 76 : 62) * z);
    this.pushSprite(sigilId, sx, sigilY, sigilScale, sigilScale, 0, 1, 1, 1, isOpen ? 1.0 : 0.78, 0, isOpen ? 0.42 : 0.14);
  }

  private renderPickup(pk: PickupItem, cam: CameraView, timeSec: number): void {
    const sx = this.wxToSx(pk.pos.x, cam);
    const sy = this.wyToSy(pk.pos.y, 0, cam);
    const z = cam.zoom;
    const bob = Math.sin(timeSec * 4.0 + pk.pos.x * 0.03) * 8 * z;

    const [r, g, b] = pk.patronId
      ? hexToRgbaTuple(PATRON_CONSTANTS[pk.patronId].colorHex)
      : pk.colorHex
        ? hexToRgbaTuple(pk.colorHex)
        : [1.0, 0.84, 0.34];

    const pulse = 0.9 + 0.14 * Math.sin(timeSec * 5.2);
    this.pushSprite('vfx_glow_soft', sx, sy, 1.05 * z * pulse, 0.65 * z * pulse, 0, r, g, b, 0.54, 0, 1.45);
    this.pushEllipseRing(sx, sy, 36 * z * pulse, 20 * z * pulse, 31 * z * pulse, 17 * z * pulse, 20, r, g, b, 0.85, 1.5);

    if (pk.kind === 'chaos_gate') {
      const cPulse = 0.94 + 0.08 * Math.sin(timeSec * 3.6);
      const sc = this.spriteScaleForMaxDim('vfx_chaos_gate', 152 * z * cPulse);
      this.pushSprite('vfx_chaos_gate', sx, sy, sc, sc, 0, 1, 1, 1, 1, 0, 0.75);
      return;
    }

    const spriteId = getPickupSpriteId(pk.kind, pk.patronId);
    const sc = this.spriteScaleForMaxDim(spriteId, 74 * z);
    this.pushSprite(spriteId, sx, sy - 30 * z + bob, sc, sc, 0, 1, 1, 1, 1, 0, 0.34);
  }

  private renderBloodstone(bs: BloodstoneDrop, cam: CameraView, timeSec: number): void {
    const sx = this.wxToSx(bs.pos.x, cam);
    const sy = this.wyToSy(bs.pos.y, 0, cam);
    const z = cam.zoom;
    const bob = Math.sin(timeSec * 6.5 + bs.pos.x * 0.04) * 5 * z;
    this.pushSprite('vfx_glow_soft', sx, sy - 6 * z, 0.55 * z, 0.4 * z, 0, 1.0, 0.16, 0.28, 0.65, 0, 1.4);
    const sc = this.spriteScaleForMaxDim('vfx_bloodstone', 42 * z);
    this.pushSprite('vfx_bloodstone', sx, sy - 16 * z + bob, sc, sc, Math.sin(timeSec * 3) * 0.15, 1, 1, 1, 1, 0, 1.15);
  }

  private renderDashGhosts(state: SimState, cam: CameraView): void {
    const ghosts = state.player.dashGhosts;
    if (ghosts.length === 0) return;

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
      const scale = this.spriteScaleForHeight(pose, 142 * cam.zoom);
      this.pushSprite(pose, sx, sy, scale * flip, scale, 0, gr, gg, gb, Math.max(0.08, g.alpha * 0.58), 0.25, 1.1);
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
    const z = cam.zoom;
    const speed = Math.hypot(p.vel.x, p.vel.y);
    const runBob = speed > 40 ? Math.abs(Math.sin(timeSec * 15.5)) * 6.5 * z : Math.sin(timeSec * 3.2) * 1.8 * z;

    // Subtle warm ember shimmer under Prince Pyreus's blazing boots (no muddy yellow puddle!)
    this.pushSprite('vfx_glow_soft', sx, sy + 2 * z, 0.72 * z, 0.42 * z, 0, 1.0, 0.34, 0.14, 0.18, 0, 0.45);

    if (p.godCallActiveTimer > 0 && p.godCallPatron) {
      const [cr, cg, cb] = hexToRgbaTuple(PATRON_CONSTANTS[p.godCallPatron].colorHex);
      const pulse = 1.0 + 0.16 * Math.sin(timeSec * 14);
      this.pushEllipseRing(sx, sy, 66 * z * pulse, 38 * z * pulse, 56 * z * pulse, 32 * z * pulse, 24, cr, cg, cb, 0.9, 2.2);
    }

    // Hand-painted Prince Pyreus sprites carry an integrated crimson-gold meander cloak!
    const pose = this.selectHeroPose(p.facingAngle);
    const flip = Math.cos(p.facingAngle) < -0.12 ? -1 : 1;
    const scale = this.spriteScaleForHeight(pose, 162 * z);
    const flash = settings.hitFlash && p.iframeTimer > 1.12 ? 0.82 : 0;
    const iframeBlink = p.iframeTimer > 0 && Math.floor(timeSec * 22) % 2 === 0 ? 0.72 : 1.0;

    const stretchX = p.dashTimer > 0 ? 1.15 : p.attackTimer > 0 ? 1.08 : 1.0;
    const stretchY = p.dashTimer > 0 ? 0.91 : p.attackTimer > 0 ? 0.95 : 1.0;
    const leanRot = speed > 60 ? (p.vel.x / 540) * 0.06 : 0;

    const wepId = getWeaponSpriteId(p.weaponId);
    const isSwinging = p.attackTimer > 0;
    const isCharging = p.attackChargeTimer > 0.12;
    const facingLeft = Math.cos(p.facingAngle) < -0.12;
    const sideSign = facingLeft ? -1 : 1;
    let wepAngle: number;
    let handX: number;
    let handY: number;

    if (isSwinging || isCharging) {
      const swingOffset = isSwinging ? (p.attackComboStep % 2 === 1 ? -1.1 : 1.1) : 0;
      wepAngle = p.facingAngle + swingOffset;
      handX = sx + Math.cos(p.facingAngle) * 24 * z;
      handY = sy - 54 * z - runBob + Math.sin(p.facingAngle) * 12 * z;
    } else {
      const idleSway = Math.sin(timeSec * 4.4) * 0.045;
      if (pose === 'hero_up') {
        wepAngle = (facingLeft ? Math.PI + 0.45 : -0.45) + idleSway;
        handX = sx + sideSign * 22 * z;
        handY = sy - 66 * z - runBob;
      } else if (pose === 'hero_diag_up') {
        wepAngle = (facingLeft ? Math.PI + 0.28 : -0.28) + idleSway;
        handX = sx + sideSign * 24 * z;
        handY = sy - 62 * z - runBob;
      } else if (pose === 'hero_down') {
        wepAngle = (facingLeft ? Math.PI - 0.46 : 0.46) + idleSway;
        handX = sx + sideSign * 20 * z;
        handY = sy - 48 * z - runBob;
      } else {
        wepAngle = (facingLeft ? Math.PI - 0.28 : 0.28) + idleSway;
        handX = sx + sideSign * 23 * z;
        handY = sy - 52 * z - runBob;
      }
    }

    const targetWepSize =
      p.weaponId === 'eternal_spear'
        ? 138
        : p.weaponId === 'adamant_rail'
          ? 108
          : p.weaponId === 'stygian_blade'
            ? 104
            : p.weaponId === 'heart_seeking_bow'
              ? 84
              : 74;
    const wepScale = this.spriteScaleForMaxDim(wepId, targetWepSize * z);
    const wepEmissive = isSwinging || isCharging ? 0.55 : 0.1;

    const drawWeaponBehindHero = !isSwinging && !isCharging && pose === 'hero_up';
    if (drawWeaponBehindHero) {
      this.pushSprite(wepId, handX, handY, wepScale, wepScale * (Math.cos(wepAngle) < 0 ? -1 : 1), wepAngle, 1, 1, 1, 1, 0, wepEmissive);
    }

    this.pushSprite(pose, sx, sy - runBob, scale * stretchX * flip, scale * stretchY, leanRot, 1, 1, 1, iframeBlink, flash, 0.06);

    if (!drawWeaponBehindHero) {
      this.pushSprite(wepId, handX, handY, wepScale, wepScale * (Math.cos(wepAngle) < 0 ? -1 : 1), wepAngle, 1, 1, 1, 1, 0, wepEmissive);
    }

    if (p.weaponId === 'shield_of_chaos' && (p.isBlocking || p.attackChargeTimer > 0.08)) {
      const sc = this.spriteScaleForMaxDim('vfx_shield_block', 112 * z);
      this.pushSprite('vfx_shield_block', sx + Math.cos(p.facingAngle) * 32 * z, sy - 40 * z + Math.sin(p.facingAngle) * 18 * z, sc, sc, p.facingAngle, 1, 0.88, 0.38, 0.92, 0, 1.25);
    } else if (p.weaponId === 'heart_seeking_bow' && p.attackChargeTimer > 0.06) {
      const chargeFrac = Math.min(1, p.attackChargeTimer / 0.6);
      const spread = (1 - chargeFrac) * 0.42;
      const inPowerWindow = chargeFrac >= 0.72 && chargeFrac <= 0.98;
      const lineLen = (180 + chargeFrac * 260) * z;
      const lR = inPowerWindow ? 1.0 : 0.96;
      const lG = inPowerWindow ? 0.92 : 0.74;
      const lB = inPowerWindow ? 0.34 : 0.3;
      this.pushLine(handX, handY, handX + Math.cos(p.facingAngle - spread) * lineLen, handY + Math.sin(p.facingAngle - spread) * lineLen * cam.isoScaleY, 2.2 * z, lR, lG, lB, 0.78, 0.6);
      this.pushLine(handX, handY, handX + Math.cos(p.facingAngle + spread) * lineLen, handY + Math.sin(p.facingAngle + spread) * lineLen * cam.isoScaleY, 2.2 * z, lR, lG, lB, 0.78, 0.6);
      if (inPowerWindow) {
        const bSc = this.spriteScaleForMaxDim('vfx_bow_flash', 86 * z);
        this.pushSprite('vfx_bow_flash', handX + Math.cos(p.facingAngle) * 18 * z, handY + Math.sin(p.facingAngle) * 10 * z, bSc, bSc, timeSec * 8, 1, 0.95, 0.45, 0.95, 0, 1.3);
      }
    } else if (p.weaponId === 'eternal_spear' && p.attackChargeTimer > 0.1) {
      const frac = Math.min(1, p.attackChargeTimer / 0.75);
      const rad = (170 + frac * 260) * z;
      this.pushEllipseRing(sx, sy, rad, rad * cam.isoScaleY, rad - 3.5 * z, (rad - 3.5 * z) * cam.isoScaleY, 28, 1.0, 0.86, 0.36, 0.65, 0.6);
    } else if (p.weaponId === 'twin_fists' && (p.attackTimer > 0 || p.specialTimer > 0)) {
      this.pushSprite('vfx_glow_soft', handX, handY, 0.7 * z, 0.7 * z, 0, 1.0, 0.42, 0.18, 0.72, 0, 1.2);
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
        this.pushQuadSolid(prevLx - 2.6 * z, prevLy, prevRx + 2.6 * z, prevRy, rx + 2.6 * z, ry + 2.6 * z, lx - 2.6 * z, ly + 2.6 * z, INK_R, INK_G, INK_B, 0.96);
        const cr = 0.84 - t * 0.36;
        const cg = 0.12 - t * 0.07;
        const cb = 0.19 - t * 0.08;
        this.pushQuadSolid(prevLx, prevLy, prevRx, prevRy, rx, ry, lx, ly, cr, cg, cb, 0.96);
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
    const z = cam.zoom;
    const spriteId = getEnemySpriteId(e.archetype, e.isBoss);
    const flip = Math.cos(e.facingAngle) < -0.15 ? -1 : 1;

    const breath = 1 + 0.03 * Math.sin(timeSec * 5.2 + e.pos.x * 0.05);
    const windupShake = e.aiState === 'windup' ? Math.sin(timeSec * 45) * 3.5 * z : 0;
    const hoverZ =
      e.archetype === 'numbskull' || e.archetype === 'brimstone_crystal' || e.bossId === 'warden_malice'
        ? (12 + Math.sin(timeSec * 4.5 + e.pos.y * 0.04) * 6) * z
        : 0;

    // Resolution-independent heroic scale across painted 4096 atlas
    let baseScale: number;
    if (e.isBoss) {
      const bossH =
        e.bossId === 'sovereign_lord'
          ? 348
          : e.bossId === 'bone_leviathan'
            ? 340
            : e.bossId === 'colosseum_bull'
              ? 330
              : e.bossId === 'the_ferryman'
                ? 326
                : e.bossId === 'colosseum_spearlord'
                  ? 312
                  : 304;
      baseScale = this.spriteScaleForHeight(spriteId, bossH * z);
    } else if (e.archetype === 'rattlebones_dummy') {
      baseScale = this.spriteScaleForHeight(spriteId, 170 * z);
    } else if (e.archetype === 'numbskull' || e.archetype === 'soul_orb') {
      baseScale = this.spriteScaleForHeight(spriteId, 108 * z);
    } else if (
      e.archetype === 'wretched_husk' ||
      e.archetype === 'ember_lout' ||
      e.archetype === 'heavy_brawler' ||
      e.archetype === 'bone_hydra_head'
    ) {
      baseScale = this.spriteScaleForHeight(spriteId, 184 * z);
    } else {
      const targetH = Math.max(134, Math.min(174, e.radius * 3.85));
      baseScale = this.spriteScaleForHeight(spriteId, targetH * z);
    }

    if (e.invulnerable) {
      // Silky-smooth anti-aliased gilded ward halo at entity feet (zero jagged pixel circles!)
      const wPulse = 0.96 + 0.05 * Math.sin(timeSec * 5.2);
      const wDiam = (e.radius * 2 + (e.isBoss ? 86 : 36)) * z * wPulse;
      const ringSc = this.spriteScaleForMaxDim('vfx_ring_soft', wDiam);
      this.pushSprite('vfx_glow_soft', sx, sy + 2 * z, (wDiam * 0.55) / 64, (wDiam * 0.36) / 64, 0, 1.0, 0.86, 0.44, 0.22, 0, 0.6);
      this.pushSprite('vfx_ring_soft', sx, sy + 2 * z, ringSc, ringSc * cam.isoScaleY, 0, 1.0, 0.88, 0.52, 0.56, 0, 0.85);
    }

    if (e.armor > 0) {
      const pulse = 0.95 + 0.06 * Math.sin(timeSec * 7.5);
      const aDiam = (e.radius * 2 + 30) * z * pulse;
      const aSc = this.spriteScaleForMaxDim('vfx_ring_soft', aDiam);
      this.pushSprite('vfx_ring_soft', sx, sy + 1 * z, aSc, aSc * cam.isoScaleY, 0, 1.0, 0.78, 0.24, 0.74, 0, 1.15);
    }

    const flash = settings.hitFlash && e.hitFlashTimer > 0 ? Math.min(1, e.hitFlashTimer * 12) : 0;
    const windupTintR = e.aiState === 'windup' ? 1.25 : 1.0;
    const windupTintG = e.aiState === 'windup' ? 0.82 : 1.0;
    const windupTintB = e.aiState === 'windup' ? 0.85 : 1.0;

    this.pushSprite(spriteId, sx + windupShake, sy - hoverZ, baseScale * flip, baseScale * breath, 0, windupTintR, windupTintG, windupTintB, 1, flash, e.isBoss ? 0.22 : e.aiState === 'windup' ? 0.45 : 0);

    const bsSc = this.spriteScaleForMaxDim('vfx_bloodstone', 30 * z);
    for (let c = 0; c < Math.min(3, e.lodgedCasts); c++) {
      const ca = timeSec * 1.4 + c * 2.1;
      this.pushSprite('vfx_bloodstone', sx + Math.cos(ca) * 20 * z, sy - 44 * z + Math.sin(ca) * 8 * z, bsSc, bsSc, ca, 1, 1, 1, 1, 0, 1.3);
    }

    if (e.statuses.length > 0) {
      const topY = sy - (e.isBoss ? 186 : 112) * z - hoverZ;
      const startX = sx - ((e.statuses.length - 1) * 14 * z) * 0.5;
      for (let s = 0; s < e.statuses.length; s++) {
        const st = e.statuses[s];
        const px = startX + s * 14 * z;
        const [sr, sg, sb] = this.statusRgb(st.id);
        this.pushEllipseFill(px, topY, 6 * z, 6 * z, 10, INK_R, INK_G, INK_B, 0.95);
        this.pushEllipseFill(px, topY, 4.2 * z, 4.2 * z, 10, sr, sg, sb, 1, 1.5);
      }
    }

    if (!e.isBoss && (e.hp < e.maxHp || e.armor > 0) && e.archetype !== 'rattlebones_dummy') {
      const bw = Math.max(46, e.radius * 1.6) * z;
      const bh = 7 * z;
      const bx = sx - bw * 0.5;
      const by = sy - 102 * z - hoverZ;
      this.pushQuadSolid(bx - 2, by - 2, bx + bw + 2, by - 2, bx + bw + 2, by + bh + 2, bx - 2, by + bh + 2, INK_R, INK_G, INK_B, 0.95);
      this.pushQuadSolid(bx, by, bx + bw, by, bx + bw, by + bh, bx, by + bh, 0.18, 0.07, 0.1, 0.95);
      const hpFrac = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));
      this.pushQuadSolid(bx, by, bx + bw * hpFrac, by, bx + bw * hpFrac, by + bh, bx, by + bh, 0.94, 0.2, 0.28, 1, 0.3);
      if (e.armor > 0 && e.maxArmor > 0) {
        const arFrac = Math.max(0, Math.min(1, e.armor / e.maxArmor));
        const ay = by - 5.5 * z;
        this.pushQuadSolid(bx - 1, ay - 1, bx + bw + 1, ay - 1, bx + bw + 1, ay + 4 * z, bx - 1, ay + 4 * z, INK_R, INK_G, INK_B, 0.95);
        this.pushQuadSolid(bx, ay, bx + bw * arFrac, ay, bx + bw * arFrac, ay + 3 * z, bx, ay + 3 * z, 1.0, 0.8, 0.24, 1, 0.8);
      }
    }
  }

  /**
   * Renders projectiles including 4-layer searing boss beams with emitter rings & pillar impact starburst!
   */
  private renderProjectile(
    pr: ProjectileState,
    obstacles: readonly ArenaObstacle[],
    cam: CameraView,
    timeSec: number
  ): void {
    const z = cam.zoom;
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
            : [1.0, 0.2, 0.34];

    if (pr.isLob && pr.targetPos) {
      const tx = this.wxToSx(pr.targetPos.x, cam);
      const ty = this.wyToSy(pr.targetPos.y, 0, cam);
      const rAoe = (pr.aoeRadius ?? 80) * z;
      this.pushEllipseRing(tx, ty, rAoe + 3 * z, (rAoe + 3 * z) * cam.isoScaleY, rAoe, rAoe * cam.isoScaleY, 20, INK_R, INK_G, INK_B, 0.85);
      this.pushEllipseRing(tx, ty, rAoe, rAoe * cam.isoScaleY, rAoe - 3 * z, (rAoe - 3 * z) * cam.isoScaleY, 20, r, g, b, 0.8, 1.25);
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
          const preClip = this.clipRayToObstacles(obstacles, pr.startPos.x, pr.startPos.y, travelDx / travelDist, travelDy / travelDist, travelDist);
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

      const pulse = 1 + 0.14 * Math.sin(timeSec * 42 + pr.angle * 3.1);
      const baseW = Math.max(12, pr.radius) * z;

      // LAYER 1: Wide soft bloom aura (2.6x radius, emissive lift)
      this.pushLine(x0, y0, x1, y1, baseW * 2.6 * pulse, r, g, b, 0.34, 1.9);
      // LAYER 2: Pulsing heavy #09060E comic-ink outer sheath
      this.pushLine(x0, y0, x1, y1, baseW * 1.66 * pulse, INK_R, INK_G, INK_B, 0.96, 0);
      // LAYER 3: Crackling high-energy crimson/Patron plasma body
      this.pushLine(x0, y0, x1, y1, baseW * 1.12 * pulse, r, g, b, 0.98, 1.75);

      // Animated crackling energy arc weaving down the beam shaft
      const bdx = x1 - x0;
      const bdy = y1 - y0;
      const bLen = Math.hypot(bdx, bdy);
      if (bLen > 24) {
        const bnx = -bdy / bLen;
        const bny = bdx / bLen;
        const segs = 10;
        let prevX = x0;
        let prevY = y0;
        for (let seg = 1; seg <= segs; seg++) {
          const frac = seg / segs;
          const amp = Math.sin(frac * Math.PI) * baseW * 0.44;
          const wave = Math.sin(frac * 18.0 - timeSec * 36.0 + pr.angle) * amp;
          const cx = x0 + bdx * frac + bnx * wave;
          const cy = y0 + bdy * frac + bny * wave;
          this.pushLine(prevX, prevY, cx, cy, baseW * 0.26, 1.0, 0.94, 0.78, 0.85, 2.1);
          prevX = cx;
          prevY = cy;
        }
      }

      // LAYER 4: Blinding pure-white laser core (0.42x radius)
      this.pushLine(x0, y0, x1, y1, baseW * 0.42 * pulse, 1, 1, 1, 1, 2.55);

      // Rotating emitter energy rings + core flare at beam origin
      const emitR = baseW * 1.05 * pulse;
      this.pushSprite('vfx_glow_soft', x0, y0, (emitR * 1.8) / 64, (emitR * 1.8) / 64, 0, r, g, b, 0.72, 0, 1.9);
      this.pushEllipseRing(x0, y0, emitR + 3 * z, (emitR + 3 * z) * 0.76, emitR - 2 * z, (emitR - 2 * z) * 0.76, 16, INK_R, INK_G, INK_B, 0.85);
      this.pushEllipseRing(x0, y0, emitR, emitR * 0.76, Math.max(2, emitR - 4 * z), Math.max(2, (emitR - 4 * z) * 0.76), 16, 1.0, 0.95, 0.82, 0.95, 2.2);

      // Blazing impact starburst & radiating sparks at beam endpoint (fixes missing 'vfx_hit_spark' cleanly!)
      const impactSprite = this.resolveSprite('vfx_hit_spark', 'vfx_spark_burst');
      const impactBoost = hitPillar ? 1.28 : 0.9;
      this.pushSprite('vfx_glow_soft', x1, y1, 0.92 * z * impactBoost * pulse, 0.92 * z * impactBoost * pulse, 0, r, g, b, 0.86, 0, 1.95);
      const sparkSc = this.spriteScaleForMaxDim(impactSprite, 74 * z * impactBoost * pulse);
      this.pushSprite(impactSprite, x1, y1, sparkSc, sparkSc, timeSec * 15, 1, 0.96, 0.82, 0.98, 0, 2.4);
      if (hitPillar) {
        const streakSprite = this.resolveSprite('vfx_spark_streak', 'vfx_projectile_arrow');
        const stSc = this.spriteScaleForMaxDim(streakSprite, 48 * z);
        for (let k = 0; k < 4; k++) {
          const sa = pr.angle + Math.PI + ((k - 1.5) * 0.55) + Math.sin(timeSec * 30 + k * 2.1) * 0.18;
          this.pushSprite(streakSprite, x1 + Math.cos(sa) * 18 * z, y1 + Math.sin(sa) * 12 * z, stSc, stSc * 0.75, sa, 1.0, 0.9, 0.52, 0.94, 0, 2.2);
        }
      }
      return;
    }

    if (pr.kind === 'cast') {
      this.pushSprite('vfx_glow_soft', sx, sy, 0.58 * z, 0.58 * z, 0, r, g, b, 0.72, 0, 1.6);
      const sc = this.spriteScaleForMaxDim('vfx_bloodstone', 40 * z);
      this.pushSprite('vfx_bloodstone', sx, sy, sc, sc, pr.angle + Math.PI * 0.5, 1, 1, 1, 1, 0, 1.3);
      return;
    }

    if (pr.kind === 'arrow' || pr.kind === 'dart' || pr.kind === 'bullet' || pr.kind === 'spear') {
      const sc = this.spriteScaleForMaxDim('vfx_projectile_arrow', (pr.kind === 'spear' ? 86 : 70) * z);
      this.pushSprite('vfx_projectile_arrow', sx, sy, sc, sc, pr.angle, r, g, b, 1, 0, 1.5);
      return;
    }

    if (pr.kind === 'shield') {
      const sc = this.spriteScaleForMaxDim('weapon_shield_of_chaos', 64 * z);
      this.pushSprite('weapon_shield_of_chaos', sx, sy, sc, sc, timeSec * 14, 1, 1, 1, 1, 0, 1.0);
      return;
    }

    if (pr.kind === 'blade_rift') {
      const sc = this.spriteScaleForMaxDim('vfx_blade_rift', Math.max(84, pr.radius * 2.2) * z);
      this.pushSprite('vfx_blade_rift', sx, sy, sc, sc * cam.isoScaleY, timeSec * 12, 1, 1, 1, 0.96, 0, 0.7);
      return;
    }

    if (pr.kind === 'skull') {
      const sc = this.spriteScaleForMaxDim('vfx_skull_proj', Math.max(60, pr.radius * 2.4) * z);
      this.pushSprite('vfx_skull_proj', sx, sy, sc, sc, Math.sin(timeSec * 6) * 0.2, 1, 1, 1, 1, 0, 0.85);
      return;
    }

    const orbSize = Math.max(24, pr.radius * 2.4) * z;
    this.pushSprite('vfx_glow_soft', sx, sy, (orbSize * 1.2) / 64, (orbSize * 1.2) / 64, 0, r, g, b, 0.58, 0, 1.6);
    const orbSc = this.spriteScaleForMaxDim('vfx_projectile_orb', orbSize);
    this.pushSprite('vfx_projectile_orb', sx, sy, orbSc, orbSc, timeSec * 5, r, g, b, 1, 0, 1.8);
  }

  // ============================================================================
  // 3-Layer Sweeping Curved Comic Weapon Slash Smears & Directional Particles
  // ============================================================================

  private renderSlashRibbons(vfx: ParticlesAndDecals, cam: CameraView): void {
    for (let i = 0; i < MAX_SLASH_RIBBONS; i++) {
      const rb = vfx.ribbons[i];
      if (!rb.active) continue;
      this.drawSlashRibbon(rb, cam);
    }
  }

  private drawSlashRibbon(rb: SlashRibbon, cam: CameraView): void {
    const z = cam.zoom;
    const progress = 1 - Math.max(0, Math.min(1, rb.life / Math.max(0.001, rb.maxLife)));
    const fade = Math.pow(1 - progress, 0.64);
    const sx = this.wxToSx(rb.x, cam);
    const sy = this.wyToSy(rb.y, 26, cam);

    if (rb.kind === 'whip') {
      // Sleek biome/boss-themed crisp phase ring (thin <= 20px, zero blinding pink donut washout!)
      const grow = 0.42 + 0.72 * Math.pow(progress, 0.46);
      const rx = rb.radius * grow * z;
      const ry = rb.radius * grow * cam.isoScaleY * z;
      const thick = Math.min(20, rb.thickness) * (1 - progress * 0.56) * z;

      this.pushEllipseRing(sx, sy, rx + 4.5 * z, ry + 2.8 * z, Math.max(1, rx - thick - 3.5 * z), Math.max(1, ry - thick * cam.isoScaleY - 2.2 * z), 32, INK_R, INK_G, INK_B, fade * 0.84);
      this.pushEllipseRing(sx, sy, rx, ry, Math.max(1, rx - thick), Math.max(1, ry - thick * cam.isoScaleY), 32, rb.r, rb.g, rb.b, fade * 0.76, 0.35);
      this.pushEllipseRing(sx, sy, rx + 0.8 * z, ry + 0.5 * z, Math.max(1, rx - thick * 0.28), Math.max(1, ry - thick * 0.28 * cam.isoScaleY), 32, rb.coreR, rb.coreG, rb.coreB, fade * 0.85, 1.05);
      return;
    }

    if (rb.kind === 'nova') {
      const grow = 0.35 + 0.78 * Math.pow(progress, 0.44);
      const rx = rb.radius * grow * z;
      const ry = rb.radius * grow * cam.isoScaleY * z;
      const thick = rb.thickness * (1 - progress * 0.52) * z;

      // Layer 1: Bold #09060E tapered ink casing
      this.pushEllipseRing(sx, sy, rx + 9 * z, ry + 5.5 * z, Math.max(1, rx - thick - 6 * z), Math.max(1, ry - thick * cam.isoScaleY - 3.5 * z), 32, INK_R, INK_G, INK_B, fade * 0.96);
      // Layer 2: Vivid Patron wave + internal speed-line rings
      this.pushEllipseRing(sx, sy, rx, ry, Math.max(1, rx - thick), Math.max(1, ry - thick * cam.isoScaleY), 32, rb.r, rb.g, rb.b, fade * 0.95, 0.32);
      this.pushEllipseRing(sx, sy, rx - thick * 0.52, ry - thick * 0.52 * cam.isoScaleY, Math.max(1, rx - thick * 0.62), Math.max(1, ry - thick * 0.62 * cam.isoScaleY), 32, INK_R, INK_G, INK_B, fade * 0.52);
      // Layer 3: Incandescent white-gold leading blade edge (emissive 2.2!)
      this.pushEllipseRing(sx, sy, rx + 1 * z, ry + 0.6 * z, Math.max(1, rx - thick * 0.22), Math.max(1, ry - thick * 0.22 * cam.isoScaleY), 32, 1.0, 0.976, 0.878, fade, 2.2);
      return;
    }

    if (rb.kind === 'thrust') {
      const reach = rb.radius * 0.92 * (0.45 + 0.65 * Math.min(1, progress * 2.2)) * z;
      const c = Math.cos(rb.angle);
      const s = Math.sin(rb.angle);
      const perpX = -s * rb.thickness * (1 - progress * 0.4) * z;
      const perpY = c * rb.thickness * cam.isoScaleY * (1 - progress * 0.4) * z;
      const tipX = sx + c * reach;
      const tipY = sy + s * reach * cam.isoScaleY;
      const baseX = sx + c * 16 * z;
      const baseY = sy + s * 16 * cam.isoScaleY * z;

      // Layer 1: Bold #09060E ink lance casing
      this.pushTriSolid(tipX + c * 12 * z, tipY + s * 7 * z, baseX + perpX * 1.38, baseY + perpY * 1.38, baseX - perpX * 1.38, baseY - perpY * 1.38, INK_R, INK_G, INK_B, fade * 0.96);
      // Layer 2: Patron speed-line body
      this.pushTriSolid(tipX, tipY, baseX + perpX, baseY + perpY, baseX - perpX, baseY - perpY, rb.r, rb.g, rb.b, fade * 0.96, 0.35);
      // Speed-line striations
      this.pushLine(baseX + perpX * 0.48, baseY + perpY * 0.48, tipX - c * 18 * z, tipY - s * 10 * z, 2.4 * z, rb.coreR, rb.coreG, rb.coreB, fade * 0.85, 1.3);
      this.pushLine(baseX - perpX * 0.48, baseY - perpY * 0.48, tipX - c * 18 * z, tipY - s * 10 * z, 2.4 * z, rb.coreR, rb.coreG, rb.coreB, fade * 0.85, 1.3);
      // Layer 3: Incandescent white-gold core blade filament (emissive 2.2!)
      this.pushTriSolid(tipX - c * 2 * z, tipY - s * 1 * z, baseX + perpX * 0.24, baseY + perpY * 0.24, baseX - perpX * 0.24, baseY - perpY * 0.24, 1.0, 0.976, 0.878, fade, 2.2);
      return;
    }

    // =========================================================================
    // 3-Layer Sweeping Curved Comic Crescent Slash Smear ('arc')
    //   1.35x wider sweep, sharp razor-tapered crescent tips, +10px #09060E ink
    //   casing, Patron body with 4 internal curved speed-lines, white-gold 2.2
    //   emissive leading blade edge!
    // =========================================================================
    const segs = 22;
    const sweepHead = Math.min(1, progress * 2.9);
    const sweepTail = Math.max(0, (progress - 0.14) * 1.18);
    const visualArc = rb.arcSpan * 1.35;
    const startA = rb.angle - visualArc * 0.5 * rb.flip;
    const endA = rb.angle + visualArc * 0.5 * rb.flip;

    const rx = rb.radius * 0.72 * z;
    const ry = rb.radius * 0.72 * cam.isoScaleY * z;
    const maxThick = Math.max(62, rb.thickness * 1.48) * z * (1 - progress * 0.3);

    const drawRibbonBand = (
      outerPad: number,
      innerOffsetRatio: number,
      thickScale: number,
      r: number,
      g: number,
      b: number,
      a: number,
      emissive: number,
      useGrainTex = false
    ) => {
      const grainRect = useGrainTex && this.hasSprite('vfx_slash_grain') ? this.atlas.sprites.get('vfx_slash_grain') : null;
      let prevOx = 0,
        prevOy = 0,
        prevIx = 0,
        prevIy = 0,
        prevU = 0;

      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const t = sweepTail + (sweepHead - sweepTail) * u;
        const ang = startA + (endA - startA) * t;
        // Razor-sharp crescent taper: converges cleanly to 0 at both tips, swells toward leading blade!
        const taper = Math.pow(Math.sin(u * Math.PI), 0.85) * (0.28 + 0.88 * Math.pow(u, 0.7));
        const padTaper = outerPad * taper * z;
        const w = maxThick * thickScale * taper;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);

        const outerR = rx + padTaper - maxThick * innerOffsetRatio * taper;
        const outerRy = ry + padTaper * cam.isoScaleY - maxThick * innerOffsetRatio * taper * cam.isoScaleY;
        const innerR = Math.max(8 * z, outerR - w);
        const innerRy = Math.max(5 * z, outerRy - w * cam.isoScaleY);

        const ox = sx + ca * outerR;
        const oy = sy + sa * outerRy;
        const ix = sx + ca * innerR;
        const iy = sy + sa * innerRy;

        if (s > 0) {
          const segAlpha = a * (0.28 + 0.72 * u);
          if (grainRect) {
            if (this.batchVertCount + 6 > MAX_BATCH_VERTS) this.flushBatch();
            const uA = grainRect.u0 + (grainRect.u1 - grainRect.u0) * prevU;
            const uB = grainRect.u0 + (grainRect.u1 - grainRect.u0) * u;
            this.pushVert(prevIx, prevIy, uA, grainRect.v1, r, g, b, segAlpha, 0, emissive);
            this.pushVert(prevOx, prevOy, uA, grainRect.v0, r, g, b, segAlpha, 0, emissive);
            this.pushVert(ox, oy, uB, grainRect.v0, r, g, b, segAlpha, 0, emissive);
            this.pushVert(prevIx, prevIy, uA, grainRect.v1, r, g, b, segAlpha, 0, emissive);
            this.pushVert(ox, oy, uB, grainRect.v0, r, g, b, segAlpha, 0, emissive);
            this.pushVert(ix, iy, uB, grainRect.v1, r, g, b, segAlpha, 0, emissive);
          } else {
            this.pushQuadSolid(prevIx, prevIy, prevOx, prevOy, ox, oy, ix, iy, r, g, b, segAlpha, emissive);
          }
        }
        prevOx = ox;
        prevOy = oy;
        prevIx = ix;
        prevIy = iy;
        prevU = u;
      }
    };

    // LAYER 1: Bold #09060E tapered ink casing (+10px along leading outer sweep, 0px at tips!)
    drawRibbonBand(10.0, 0.0, 1.18, INK_R, INK_G, INK_B, fade * 0.98, 0);

    // LAYER 2: Rich Patron-tinted saturated mid-band + calligraphic grain overlay
    drawRibbonBand(2.0, 0.02, 1.0, rb.r, rb.g, rb.b, fade * 0.95, 0.24);
    if (this.hasSprite('vfx_slash_grain')) {
      drawRibbonBand(2.0, 0.04, 0.92, rb.coreR, rb.coreG, rb.coreB, fade * 0.55, 0.65, true);
    }

    // 4 Curved Internal Comic Speed-Line Streaks carved across the sweeping crescent!
    const speedLineBands = [0.22, 0.42, 0.64, 0.82];
    for (let bIdx = 0; bIdx < speedLineBands.length; bIdx++) {
      const bandFrac = speedLineBands[bIdx];
      const isDarkStreak = (bIdx & 1) === 1;
      const uMin = bIdx * 0.1;
      const uMax = 0.88 + (bIdx % 2) * 0.1;
      let prevX = 0;
      let prevY = 0;
      for (let s = 0; s <= 12; s++) {
        const lu = uMin + (uMax - uMin) * (s / 12);
        const t = sweepTail + (sweepHead - sweepTail) * lu;
        const ang = startA + (endA - startA) * t;
        const taper = Math.pow(Math.sin(lu * Math.PI), 0.85) * (0.28 + 0.88 * Math.pow(lu, 0.7));
        const rCur = Math.max(10 * z, rx - maxThick * bandFrac * taper);
        const ryCur = Math.max(6 * z, ry - maxThick * bandFrac * taper * cam.isoScaleY);
        const px = sx + Math.cos(ang) * rCur;
        const py = sy + Math.sin(ang) * ryCur;
        if (s > 0) {
          this.pushLine(
            prevX,
            prevY,
            px,
            py,
            (isDarkStreak ? 2.6 : 2.8) * z * taper,
            isDarkStreak ? INK_R : rb.coreR,
            isDarkStreak ? INK_G : rb.coreG,
            isDarkStreak ? INK_B : rb.coreB,
            fade * (isDarkStreak ? 0.62 : 0.86),
            isDarkStreak ? 0 : 1.15
          );
        }
        prevX = px;
        prevY = py;
      }
    }

    // LAYER 3: Incandescent white-gold hot leading blade-edge filament (#FFF9E0, emissive 2.2!)
    drawRibbonBand(1.5, 0.0, 0.19, 1.0, 0.976, 0.878, fade, 2.2);
  }

  private renderParticles(vfx: ParticlesAndDecals, cam: CameraView): void {
    const z = cam.zoom;

    // 1. Alpha-blended particles (shards, smoke, rose petals, splashes, petals, snowflakes)
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
      const sz = (p.size + (p.endSize - p.size) * t) * z;
      const a = p.alpha * (1 - t);
      const sx = this.wxToSx(p.x, cam);
      const sy = this.wyToSy(p.y, p.z, cam);

      if (p.kind === 'petal' || p.kind === 'rose') {
        const sc = this.spriteScaleForMaxDim('vfx_petal', sz * 1.25);
        this.pushSprite('vfx_petal', sx, sy, sc, sc, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'snowflake') {
        const sc = this.spriteScaleForMaxDim('vfx_snowflake', sz * 1.25);
        this.pushSprite('vfx_snowflake', sx, sy, sc, sc, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'splash') {
        const sc = this.spriteScaleForMaxDim('vfx_wave_crest', sz * 1.45);
        this.pushSprite('vfx_wave_crest', sx, sy, sc, sc, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'shard') {
        const sc = this.spriteScaleForMaxDim('vfx_spark_burst', sz * 1.4);
        this.pushSprite('vfx_spark_burst', sx, sy, sc, sc * 0.72, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else {
        const sc = this.spriteScaleForMaxDim('vfx_glow_soft', sz * 2.1);
        this.pushSprite('vfx_glow_soft', sx, sy, sc, sc, p.angle, p.r, p.g, p.b, a * 0.65, 0, p.emissive * 0.6);
      }
    }

    // 2. Additive glowing VFX particles (directional spark streaks, impact bursts, embers, bolts, shockwaves)
    this.setBatchState(this.atlasTex, 'additive');
    const streakSprite = this.resolveSprite('vfx_spark_streak', 'vfx_projectile_arrow');
    const burstSprite = this.resolveSprite('vfx_hit_spark', 'vfx_spark_burst');

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
      const sz = (p.size + (p.endSize - p.size) * t) * z;
      const a = p.alpha * (1 - t);
      const sx = this.wxToSx(p.x, cam);
      const sy = this.wyToSy(p.y, p.z, cam);

      if (p.kind === 'spark_streak') {
        const sc = this.spriteScaleForMaxDim(streakSprite, sz * 1.85);
        this.pushSprite(streakSprite, sx, sy, sc * 1.35, sc * 0.72, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'impact_burst') {
        const sc = this.spriteScaleForMaxDim(burstSprite, sz * 1.65);
        this.pushSprite(burstSprite, sx, sy, sc, sc, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'muzzle_flash') {
        const sc = this.spriteScaleForMaxDim('vfx_muzzle_flash', sz * 1.9);
        this.pushSprite('vfx_muzzle_flash', sx, sy, sc, sc, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'shockwave' || p.kind === 'deflect_ring') {
        const sc = this.spriteScaleForMaxDim('vfx_ring_soft', sz * 2.15);
        this.pushSprite('vfx_ring_soft', sx, sy, sc, sc * cam.isoScaleY, 0, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'bolt') {
        const sc = this.spriteScaleForMaxDim('vfx_lightning_bolt', sz * 2.2);
        this.pushSprite('vfx_lightning_bolt', sx, sy, sc, sc, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else if (p.kind === 'ember_footstep' || p.kind === 'flame') {
        const sc = this.spriteScaleForMaxDim('vfx_flame_tongue', sz * 1.7);
        this.pushSprite('vfx_flame_tongue', sx, sy, sc, sc, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      } else {
        const sc = this.spriteScaleForMaxDim(burstSprite, sz * 1.7);
        this.pushSprite(burstSprite, sx, sy, sc * 1.25, sc * 0.82, p.angle, p.r, p.g, p.b, a, 0, p.emissive);
      }
    }
    this.setBatchState(this.atlasTex, 'alpha');
  }

  /**
   * Subtle diagonal volumetric light cones (`vfx_light_cone` / smooth shaft fallback)
   * on northern wall sconces, open exit portals, and glowing Curing Pools!
   */
  private renderVolumetricLightCones(
    state: SimState,
    theme: BiomeVisualTheme,
    cam: CameraView,
    timeSec: number
  ): void {
    const z = cam.zoom;
    const hasConeSprite = this.hasSprite('vfx_light_cone');
    this.setBatchState(this.atlasTex, 'additive');

    const drawCone = (
      sx: number,
      sy: number,
      wTop: number,
      wBot: number,
      height: number,
      tiltX: number,
      r: number,
      g: number,
      b: number,
      alpha: number
    ) => {
      if (hasConeSprite) {
        const scX = this.spriteScaleForMaxDim('vfx_light_cone', wBot * 1.15);
        const scY = this.spriteScaleForHeight('vfx_light_cone', height);
        const angle = Math.atan2(tiltX, height);
        this.pushSprite('vfx_light_cone', sx + tiltX * 0.5, sy + height * 0.45, scX, scY, -angle, r, g, b, alpha, 0, 0.85);
      } else {
        // Two-segment feathered shaft (0 -> peak -> 0) so there is NEVER a hard horizontal edge!
        const midFrac = 0.24;
        const midX = sx + tiltX * midFrac;
        const midY = sy + height * midFrac;
        const wMid = wTop + (wBot - wTop) * midFrac;
        this.pushQuadGradientV(
          sx - wTop * 0.5,
          sy,
          sx + wTop * 0.5,
          sy,
          midX + wMid * 0.5,
          midY,
          midX - wMid * 0.5,
          midY,
          r,
          g,
          b,
          0.0,
          r,
          g,
          b,
          alpha,
          0.65
        );
        this.pushQuadGradientV(
          midX - wMid * 0.5,
          midY,
          midX + wMid * 0.5,
          midY,
          sx + tiltX + wBot * 0.5,
          sy + height,
          sx + tiltX - wBot * 0.5,
          sy + height,
          r,
          g,
          b,
          alpha,
          r,
          g,
          b,
          0.0,
          0.65
        );
      }
    };

    // 1. Diagonal warm shafts pouring off Northern Wall Sconces onto flagstones
    for (let i = 0; i < this.wallSconces.length; i++) {
      const sc = this.wallSconces[i];
      const flick = 0.86 + 0.09 * Math.sin(timeSec * 11.3 + i * 2.1) + 0.05 * Math.sin(timeSec * 27.1 + i * 3.7);
      const sx = this.wxToSx(sc.x, cam);
      const sy = this.wyToSy(sc.y, 38, cam);
      drawCone(sx, sy, 22 * z, 118 * z, 138 * z, 34 * z, theme.brazierColor[0], theme.brazierColor[1], theme.brazierColor[2], 0.14 * flick);
    }

    // 2. Radiant divine light cones pouring from open Exit Portals
    for (let i = 0; i < state.room.doors.length; i++) {
      const d = state.room.doors[i];
      if (d.locked) continue;
      const [r, g, b] = d.reward.patronId
        ? hexToRgbaTuple(PATRON_CONSTANTS[d.reward.patronId].colorHex)
        : theme.rimGlow;
      const pulse = 0.88 + 0.12 * Math.sin(timeSec * 3.8 + i);
      const sx = this.wxToSx(d.pos.x, cam);
      const sy = this.wyToSy(d.pos.y, 132, cam);
      drawCone(sx, sy, 46 * z, 168 * z, 182 * z, 36 * z, r, g, b, 0.16 * pulse);
    }

    // 3. Ascending turquoise healing shafts over Curing Pools
    for (let i = 0; i < state.room.hazards.length; i++) {
      const h = state.room.hazards[i];
      if (h.kind !== 'curing_pool') continue;
      const sx = this.wxToSx(h.pos.x, cam);
      const sy = this.wyToSy(h.pos.y, 148, cam);
      const pulse = 0.88 + 0.12 * Math.sin(timeSec * 3.2 + i);
      drawCone(sx, sy, 42 * z, 136 * z, 162 * z, 22 * z, 0.22, 0.93, 1.0, 0.18 * pulse);
    }

    this.setBatchState(this.atlasTex, 'alpha');
  }

  // ============================================================================
  // Pass 4: Dynamic Additive Lightmap FBO (Boosted Flickering Pools)
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
    const z = cam.zoom;

    // 1. Boosted flickering stone braziers (205-242px world pools with 2-freq flicker!)
    for (let i = 0; i < this.braziers.length; i++) {
      const br = this.braziers[i];
      const flick = 0.88 + 0.08 * Math.sin(timeSec * 11.3 + i * 2.1) + 0.04 * Math.sin(timeSec * 27.1 + i * 4.3);
      const rad = 232 * z * flick;
      this.pushLight(
        this.wxToSx(br.x, cam),
        this.wyToSy(br.y, 26, cam),
        rad,
        rad * 0.72,
        theme.brazierColor[0],
        theme.brazierColor[1],
        theme.brazierColor[2],
        1.08
      );
    }

    // 2. Northern Retaining Wall Burning Sconces (warm pools onto north flagstones!)
    for (let i = 0; i < this.wallSconces.length; i++) {
      const sc = this.wallSconces[i];
      const flick = 0.88 + 0.08 * Math.sin(timeSec * 11.3 + i * 3.3) + 0.04 * Math.sin(timeSec * 27.1 + i * 1.9);
      const rad = 198 * z * flick;
      this.pushLight(
        this.wxToSx(sc.x, cam),
        this.wyToSy(sc.y + 24, 16, cam),
        rad,
        rad * 0.68,
        theme.brazierColor[0],
        theme.brazierColor[1],
        theme.brazierColor[2],
        0.92
      );
    }

    // 3. Glowing Hazards (lava magma glow, poison bile glow, curing font glow, consecrated aura)
    for (let i = 0; i < state.room.hazards.length; i++) {
      const h = state.room.hazards[i];
      const k = h.kind as string;
      const sx = this.wxToSx(h.pos.x, cam);
      const sy = this.wyToSy(h.pos.y, 12, cam);
      if (k === 'lava_pool' || k === 'boiling_geyser') {
        const pulse = 0.9 + 0.1 * Math.sin(timeSec * 4.4 + i * 1.7);
        const rad = Math.max(150, h.radius * 2.1) * z * pulse;
        this.pushLight(sx, sy, rad, rad * 0.66, 1.0, 0.36, 0.08, 0.95);
      } else if (k === 'poison_pool') {
        const rad = Math.max(125, h.radius * 1.85) * z;
        this.pushLight(sx, sy, rad, rad * 0.66, 0.56, 0.95, 0.16, 0.65);
      } else if (k === 'curing_pool') {
        const rad = Math.max(175, h.radius * 2.6) * z;
        this.pushLight(sx, sy, rad, rad * 0.72, 0.22, 0.93, 1.0, 1.05);
      } else if (k === 'consecrated_aura' || k === 'consecrated_ground') {
        const rad = Math.max(165, h.radius * 2.0) * z;
        this.pushLight(sx, sy, rad, rad * 0.68, 1.0, 0.88, 0.44, 0.82);
      }
    }

    // 4. Hero ember glow
    const heroPos = this.interpPlayerPos(state, prevState, cam.interpAlpha);
    const heroRad = 215 * z;
    this.pushLight(this.wxToSx(heroPos.x, cam), this.wyToSy(heroPos.y, 24, cam), heroRad, heroRad * 0.7, 1.0, 0.56, 0.28, 0.74);

    // 5. Open chamber exit portals & Boon pickups
    for (let i = 0; i < state.room.doors.length; i++) {
      const d = state.room.doors[i];
      if (d.locked) continue;
      const [r, g, b] = d.reward.patronId
        ? hexToRgbaTuple(PATRON_CONSTANTS[d.reward.patronId].colorHex)
        : theme.rimGlow;
      const rad = 235 * z;
      this.pushLight(this.wxToSx(d.pos.x, cam), this.wyToSy(d.pos.y, 30, cam), rad, rad * 0.72, r, g, b, 0.98);
    }
    for (let i = 0; i < state.room.pickups.length; i++) {
      const pk = state.room.pickups[i];
      if (pk.collected) continue;
      const [r, g, b] = pk.patronId
        ? hexToRgbaTuple(PATRON_CONSTANTS[pk.patronId].colorHex)
        : [1.0, 0.84, 0.35];
      const rad = 180 * z;
      this.pushLight(this.wxToSx(pk.pos.x, cam), this.wyToSy(pk.pos.y, 18, cam), rad, rad * 0.7, r, g, b, 0.92);
    }

    // 6. Active Slash Ribbons illuminating nearby stone flagstones with Boon color
    for (let i = 0; i < MAX_SLASH_RIBBONS; i++) {
      const rb = vfx.ribbons[i];
      if (!rb.active) continue;
      const fade = rb.life / Math.max(0.001, rb.maxLife);
      const rad = rb.radius * 1.5 * z;
      this.pushLight(this.wxToSx(rb.x, cam), this.wyToSy(rb.y, 22, cam), rad, rad * 0.7, rb.r, rb.g, rb.b, fade * 1.18);
    }

    // 7. Projectiles & Boss aura
    for (let i = 0; i < state.projectiles.length; i++) {
      const pr = state.projectiles[i];
      const [r, g, b] = pr.patronId
        ? hexToRgbaTuple(PATRON_CONSTANTS[pr.patronId].colorHex)
        : pr.owner === 'player'
          ? [1.0, 0.35, 0.25]
          : [1.0, 0.22, 0.38];
      const rad = Math.max(76, pr.radius * 4.8) * z;
      this.pushLight(this.wxToSx(pr.pos.x, cam), this.wyToSy(pr.pos.y, 20, cam), rad, rad * 0.7, r, g, b, 0.68);
    }
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (!e.isBoss || e.aiState === 'dead') continue;
      const rad = 325 * z;
      this.pushLight(this.wxToSx(e.pos.x, cam), this.wyToSy(e.pos.y, 40, cam), rad, rad * 0.72, theme.telegraphPrimary[0], theme.telegraphPrimary[1], theme.telegraphPrimary[2], 0.85);
    }

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
  // Crisp Mythic Comic-Ink Floating Damage Numbers (Pre-Baked Glyph Atlas)
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
      const scale = 0.46 * style.scale * pop;
      const [tr, tg, tb] = style.tintRgba;

      if (style.tag) {
        this.drawBitmapString(style.tag, sx, sy - 25 * style.scale, scale * 0.56, tr, tg, tb, alpha);
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
      this.pushVert(gx, gy, m.u0, m.v0, r, g, b, a, 0, 0.18);
      this.pushVert(gx + gw, gy, m.u1, m.v0, r, g, b, a, 0, 0.18);
      this.pushVert(gx + gw, gy + gh, m.u1, m.v1, r, g, b, a, 0, 0.18);
      this.pushVert(gx, gy, m.u0, m.v0, r, g, b, a, 0, 0.18);
      this.pushVert(gx + gw, gy + gh, m.u1, m.v1, r, g, b, a, 0, 0.18);
      this.pushVert(gx, gy + gh, m.u0, m.v1, r, g, b, a, 0, 0.18);
      cursorX += m.advance * scale;
    }
  }

  // ============================================================================
  // Interpolation, Asset Hot-Swap & Cleanup Helpers
  // ============================================================================

  private interpPlayerPos(state: SimState, prevState: SimState | null, alpha: number): { x: number; y: number } {
    if (!prevState || alpha >= 0.999) return state.player.pos;
    const dx = state.player.pos.x - prevState.player.pos.x;
    const dy = state.player.pos.y - prevState.player.pos.y;
    if (dx * dx + dy * dy > 220 * 220) return state.player.pos;
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

  /** Hot-swaps the GPU atlas texture ONCE when painted art loads or toggling BUILTIN <-> CUSTOM_PACK. */
  public setAtlasCanvas(canvas: HTMLCanvasElement): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  /** Re-uploads the baked combat font glyph texture once self-hosted WOFF2 fonts load. */
  public setFontAtlas(fontAtlas: BakedFontAtlas): void {
    this.fontAtlas = fontAtlas;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.fontTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fontAtlas.canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
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
    for (const surf of this.biomeTex.values()) {
      gl.deleteTexture(surf.floor);
      gl.deleteTexture(surf.wall);
      gl.deleteTexture(surf.cliff);
    }
    this.biomeTex.clear();
    gl.deleteTexture(this.atlasTex);
    gl.deleteTexture(this.fontTex);
    gl.deleteBuffer(this.batchVbo);
    gl.deleteVertexArray(this.batchVao);
    gl.deleteBuffer(this.lightVbo);
    gl.deleteVertexArray(this.lightVao);
    gl.deleteVertexArray(this.emptyVao);
    gl.deleteProgram(this.abyssProg);
    gl.deleteProgram(this.floorProg);
    gl.deleteProgram(this.hazardProg);
    gl.deleteProgram(this.batchProg);
    gl.deleteProgram(this.lightProg);
    gl.deleteProgram(this.bloomExtractProg);
    gl.deleteProgram(this.bloomBlurProg);
    gl.deleteProgram(this.compositeProg);
  }
}
