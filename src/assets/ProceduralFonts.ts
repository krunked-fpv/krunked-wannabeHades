/**
 * ProceduralFonts — Chiseled mythic display styling & high-contrast comic-ink
 * floating combat numbers (both Canvas2D direct drawing and pre-baked WebGL2 glyph atlas).
 *
 * Uses our self-hosted OFL mythic typography stack:
 * - `"Barlow Condensed"` (900) for razor-chiseled athletic-mythic combat numerals & symbols
 * - `"Cinzel"` (900) for engraved Greco-Roman combat callout words (`CRIT`, `DODGE`,
 *   `DEFLECT`, `IMMUNE`, `ARMOR`, `BACKSTAB`, `BLOCKED`)
 */

import type { FloatingNumber } from '../contracts/index.js';

export const MYTHIC_DISPLAY_FONT = "'Cinzel', serif";
export const COMBAT_NUMBER_FONT = "'Barlow Condensed', 'Cinzel', sans-serif";

const INK_SHADOW = '#09060E';

export interface DamageNumberStyle {
  readonly fillTop: string;
  readonly fillMid: string;
  readonly fillBottom: string;
  readonly strokeHex: string;
  readonly scale: number;
  readonly tag?: string;
  readonly tagHex?: string;
  readonly tintRgba: readonly [number, number, number, number];
}

export function getDamageNumberStyle(fn: FloatingNumber): DamageNumberStyle {
  switch (fn.kind) {
    case 'crit':
      return {
        fillTop: '#FFFDE0',
        fillMid: '#FFE05C',
        fillBottom: '#FF7E12',
        strokeHex: INK_SHADOW,
        scale: 1.56,
        tag: 'CRIT!',
        tagHex: '#FFE866',
        tintRgba: [1.0, 0.87, 0.24, 1.0],
      };
    case 'backstab':
      return {
        fillTop: '#FFE0EE',
        fillMid: '#FF668E',
        fillBottom: '#D61E48',
        strokeHex: INK_SHADOW,
        scale: 1.32,
        tag: 'BACKSTAB',
        tagHex: '#FF8AA8',
        tintRgba: [1.0, 0.42, 0.56, 1.0],
      };
    case 'deflect':
      return {
        fillTop: '#E8FFFF',
        fillMid: '#7AF2FF',
        fillBottom: '#22B8FF',
        strokeHex: INK_SHADOW,
        scale: 1.34,
        tag: 'DEFLECT!',
        tagHex: '#9CF6FF',
        tintRgba: [0.46, 0.94, 1.0, 1.0],
      };
    case 'heal':
      return {
        fillTop: '#DBFFE8',
        fillMid: '#68F5A6',
        fillBottom: '#1CC86A',
        strokeHex: '#07120C',
        scale: 1.2,
        tag: 'HEAL',
        tagHex: '#84FFC0',
        tintRgba: [0.38, 1.0, 0.64, 1.0],
      };
    case 'armor':
      return {
        fillTop: '#E8FFFF',
        fillMid: '#74ECFF',
        fillBottom: '#28A8FF',
        strokeHex: INK_SHADOW,
        scale: 1.32,
        tag: typeof fn.value === 'string' ? undefined : 'ARMOR',
        tagHex: '#7CEEFF',
        tintRgba: [0.48, 0.92, 1.0, 1.0],
      };
    case 'status':
      return {
        fillTop: '#FFFFFF',
        fillMid: '#EAD4FF',
        fillBottom: fn.colorHex || '#C274FF',
        strokeHex: INK_SHADOW,
        scale: 1.1,
        tintRgba: hexToRgbaTuple(fn.colorHex || '#C274FF'),
      };
    case 'dodge':
      return {
        fillTop: '#ECFBFF',
        fillMid: '#98ECFF',
        fillBottom: '#42C8F5',
        strokeHex: INK_SHADOW,
        scale: 1.18,
        tintRgba: [0.64, 0.95, 1.0, 1.0],
      };
    case 'blocked':
      return {
        fillTop: '#FFF4CE',
        fillMid: '#E5B952',
        fillBottom: '#9E6E2E',
        strokeHex: INK_SHADOW,
        scale: 1.14,
        tintRgba: [0.96, 0.8, 0.4, 1.0],
      };
    case 'gold':
      return {
        fillTop: '#FFFAD0',
        fillMid: '#F5CB54',
        fillBottom: '#C8821A',
        strokeHex: INK_SHADOW,
        scale: 1.16,
        tintRgba: [1.0, 0.86, 0.32, 1.0],
      };
    case 'normal':
    default:
      return {
        fillTop: '#FFFFFF',
        fillMid: '#FAF0DA',
        fillBottom: fn.colorHex || '#DFCFAF',
        strokeHex: INK_SHADOW,
        scale: 1.02,
        tintRgba: [1.0, 0.97, 0.89, 1.0],
      };
  }
}

export function hexToRgbaTuple(hex: string, alpha = 1): [number, number, number, number] {
  let clean = hex.trim();
  if (clean.startsWith('#')) clean = clean.slice(1);
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  const num = Number.parseInt(clean, 16);
  if (!Number.isFinite(num)) {
    return [1, 1, 1, alpha];
  }
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255, alpha];
}

export function formatFloatingNumberText(fn: FloatingNumber): string {
  if (typeof fn.value === 'string') {
    return fn.value.toUpperCase();
  }
  const n = Math.round(fn.value);
  if (fn.kind === 'heal') return `+${n}`;
  if (fn.kind === 'gold') return `+${n}G`;
  if (fn.kind === 'crit') return `${n}!`;
  return String(n);
}

function isCombatWordString(text: string): boolean {
  return /[A-Z]{2,}/.test(text);
}

/**
 * Draw a crisp, chiseled metallic comic-ink floating combat number on a Canvas2D context.
 */
export function drawFloatingNumber2D(
  ctx: CanvasRenderingContext2D,
  fn: FloatingNumber,
  screenX: number,
  screenY: number
): void {
  const style = getDamageNumberStyle(fn);
  const progress = 1 - Math.max(0, Math.min(1, fn.life / Math.max(0.001, fn.maxLife)));

  // Spring pop-in over first 14% of lifetime, fade out over final 30%
  const pop =
    progress < 0.14
      ? 0.56 + 0.72 * Math.sin((progress / 0.14) * Math.PI * 0.65)
      : progress < 0.25
        ? 1.16 - 0.16 * ((progress - 0.14) / 0.11)
        : 1.0;
  const alpha = progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;

  const text = formatFloatingNumberText(fn);
  const wordMode = isCombatWordString(text);
  const fontSize = Math.round((wordMode ? 20 : 27) * style.scale * pop);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(screenX, screenY);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Optional mythic callout tag above critical / backstab / deflect / armor break
  if (style.tag) {
    const tagSize = Math.max(11, Math.round(13 * style.scale));
    ctx.font = `900 ${tagSize}px ${MYTHIC_DISPLAY_FONT}`;
    ctx.fillStyle = INK_SHADOW;
    ctx.fillText(style.tag, 2, -fontSize * 0.74 + 2.5);
    ctx.lineWidth = 5;
    ctx.strokeStyle = style.strokeHex;
    ctx.strokeText(style.tag, 0, -fontSize * 0.74);
    const tg = ctx.createLinearGradient(0, -fontSize * 0.74 - tagSize * 0.5, 0, -fontSize * 0.74 + tagSize * 0.5);
    tg.addColorStop(0, '#FFFFFF');
    tg.addColorStop(0.55, style.tagHex ?? style.fillTop);
    tg.addColorStop(1, style.fillBottom);
    ctx.fillStyle = tg;
    ctx.fillText(style.tag, 0, -fontSize * 0.74);
  }

  ctx.font = wordMode
    ? `900 ${fontSize}px ${MYTHIC_DISPLAY_FONT}`
    : `900 ${fontSize}px ${COMBAT_NUMBER_FONT}`;

  // Deep extruded comic drop shadow (#09060E)
  ctx.fillStyle = INK_SHADOW;
  ctx.fillText(text, 3, 4.5);

  // Heavy comic-ink outer contour
  ctx.lineWidth = Math.max(5.5, fontSize * 0.24);
  ctx.strokeStyle = style.strokeHex;
  ctx.strokeText(text, 0, 0);

  // Chiseled metallic bevel vertical gradient
  const grad = ctx.createLinearGradient(0, -fontSize * 0.52, 0, fontSize * 0.52);
  grad.addColorStop(0, style.fillTop);
  grad.addColorStop(0.46, style.fillMid);
  grad.addColorStop(0.56, style.fillBottom);
  grad.addColorStop(1, style.fillBottom);
  ctx.fillStyle = grad;
  ctx.fillText(text, 0, 0);

  // Crisp top specular bevel edge
  ctx.save();
  ctx.beginPath();
  ctx.rect(-fontSize * 4, -fontSize * 0.6, fontSize * 8, fontSize * 0.44);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillText(text, 0, -1.1);
  ctx.restore();

  ctx.restore();
}

// ============================================================================
// Pre-Baked High-DPI Mythic Bitmap Glyph Atlas for Zero-Allocation WebGL2 Text
// ============================================================================

export interface GlyphMetric {
  readonly ch: string;
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
  readonly w: number;
  readonly h: number;
  readonly advance: number;
}

export interface BakedFontAtlas {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly lineHeight: number;
  readonly glyphs: ReadonlyMap<string, GlyphMetric>;
}

const FONT_ATLAS_W = 1024;
const FONT_ATLAS_H = 512;
const GLYPH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!+-%.,:?/ x';

const NUMERIC_GLYPH_SET = new Set('0123456789!+-%.,:?/x'.split(''));

let cachedFontAtlas: BakedFontAtlas | null = null;

function renderChiseledGlyphCell(
  ctx: CanvasRenderingContext2D,
  ch: string,
  cx: number,
  cy: number,
  fontStr: string,
  halfH: number
): number {
  ctx.save();
  ctx.font = fontStr;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Deep chiseled offset drop shadow (#09060E, +3px, +5px)
  ctx.fillStyle = INK_SHADOW;
  ctx.strokeStyle = INK_SHADOW;
  ctx.lineWidth = 9.5;
  ctx.strokeText(ch, cx + 3, cy + 5);
  ctx.fillText(ch, cx + 3, cy + 5);

  // 2. Heavy comic-ink outer contour (lineWidth 9.5, #09060E)
  ctx.lineWidth = 9.5;
  ctx.strokeStyle = INK_SHADOW;
  ctx.strokeText(ch, cx, cy);

  // 3. Chiseled metallic bevel gradient (neutral bright ivory-gold so WebGL2 vertex tinting pops!)
  const bevel = ctx.createLinearGradient(cx, cy - halfH, cx, cy + halfH);
  bevel.addColorStop(0.0, '#FFFFFF');
  bevel.addColorStop(0.38, '#FAF2DC');
  bevel.addColorStop(0.52, '#E8DAC0');
  bevel.addColorStop(0.84, '#CFC0A2');
  bevel.addColorStop(1.0, '#B5A486');
  ctx.fillStyle = bevel;
  ctx.fillText(ch, cx, cy);

  // 4. Crisp 1.5px top specular highlight bevel on upper half of glyph
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 34, cy - halfH - 4, 68, halfH * 0.88);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.lineWidth = 1.6;
  ctx.strokeText(ch, cx, cy - 1.1);
  ctx.fillStyle = bevel;
  ctx.fillText(ch, cx, cy);
  ctx.restore();

  // 5. Subtle engraved lower edge line to sharpen metallic crease
  ctx.strokeStyle = 'rgba(9, 6, 14, 0.24)';
  ctx.lineWidth = 1;
  ctx.strokeText(ch, cx, cy + 0.5);

  const measured = ctx.measureText(ch).width;
  ctx.restore();
  return measured;
}

/**
 * Pre-bakes a crisp high-DPI chiseled metallic comic-ink glyph atlas ONCE at startup
 * so WebGL2 can draw floating damage numbers (`142!`, `+25`, `CRIT!`, `BACKSTAB`,
 * `DEFLECT!`, `DODGE`, `IMMUNE`, `ARMOR`, `BLOCKED`) with ZERO per-frame allocations!
 */
export function bakeProceduralFontAtlas(): BakedFontAtlas {
  if (cachedFontAtlas) {
    return cachedFontAtlas;
  }

  const canvas = document.createElement('canvas');
  canvas.width = FONT_ATLAS_W;
  canvas.height = FONT_ATLAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ProceduralFonts: failed to acquire 2D canvas context');
  }

  ctx.clearRect(0, 0, FONT_ATLAS_W, FONT_ATLAS_H);
  const cellW = 72;
  const cellH = 84;
  const cols = Math.floor(FONT_ATLAS_W / cellW);

  const numFont = `900 58px ${COMBAT_NUMBER_FONT}`;
  const wordFont = `900 44px ${MYTHIC_DISPLAY_FONT}`;

  const glyphs = new Map<string, GlyphMetric>();

  for (let i = 0; i < GLYPH_CHARS.length; i++) {
    const ch = GLYPH_CHARS[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;
    const cx = x + cellW * 0.5;
    const cy = y + cellH * 0.5;

    let advance = 22;
    if (ch !== ' ') {
      const isNumeric = NUMERIC_GLYPH_SET.has(ch);
      const fontStr = isNumeric ? numFont : wordFont;
      const halfH = isNumeric ? 27 : 21;
      const measured = renderChiseledGlyphCell(ctx, ch, cx, cy, fontStr, halfH);
      // Slight wider tracking for engraved Cinzel capitals, tight athletic kerning for Barlow numerals
      const pad = isNumeric ? 6 : 9;
      advance = Math.max(20, Math.min(cellW - 6, measured + pad));
    }

    glyphs.set(ch, {
      ch,
      u0: x / FONT_ATLAS_W,
      v0: y / FONT_ATLAS_H,
      u1: (x + cellW) / FONT_ATLAS_W,
      v1: (y + cellH) / FONT_ATLAS_H,
      w: cellW,
      h: cellH,
      advance,
    });
  }

  cachedFontAtlas = {
    canvas,
    width: FONT_ATLAS_W,
    height: FONT_ATLAS_H,
    lineHeight: cellH,
    glyphs,
  };
  return cachedFontAtlas;
}

/**
 * Clears the cached combat glyph atlas and re-bakes it immediately.
 * Called once `document.fonts.ready` resolves so WebGL2 and Canvas2D pick up
 * the self-hosted `"Barlow Condensed"` and `"Cinzel"` WOFF2 fonts immediately.
 */
export function rebakeProceduralFontAtlas(): BakedFontAtlas {
  cachedFontAtlas = null;
  return bakeProceduralFontAtlas();
}
