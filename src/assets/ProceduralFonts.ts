/**
 * ProceduralFonts — Chiseled mythic display styling & high-contrast ink-outlined
 * floating combat numbers (both Canvas2D direct drawing and pre-baked WebGL2 glyph atlas).
 */

import type { FloatingNumber } from '../contracts/index.js';

export const MYTHIC_DISPLAY_FONT =
  "'Cinzel', 'Trajan Pro', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
export const COMBAT_NUMBER_FONT =
  "'Impact', 'Arial Black', 'Trebuchet MS', system-ui, sans-serif";

export interface DamageNumberStyle {
  readonly fillTop: string;
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
        fillTop: '#FFF9B8',
        fillBottom: '#FF8414',
        strokeHex: '#0A060E',
        scale: 1.52,
        tag: 'CRIT!',
        tagHex: '#FFE047',
        tintRgba: [1.0, 0.84, 0.24, 1.0],
      };
    case 'backstab':
      return {
        fillTop: '#F7D2FF',
        fillBottom: '#C855FF',
        strokeHex: '#0A060E',
        scale: 1.28,
        tag: 'BACKSTAB',
        tagHex: '#E8A8FF',
        tintRgba: [0.88, 0.52, 1.0, 1.0],
      };
    case 'deflect':
      return {
        fillTop: '#D8FFFF',
        fillBottom: '#42D4FF',
        strokeHex: '#070912',
        scale: 1.32,
        tag: 'DEFLECT!',
        tagHex: '#94F2FF',
        tintRgba: [0.45, 0.92, 1.0, 1.0],
      };
    case 'heal':
      return {
        fillTop: '#C9FFE0',
        fillBottom: '#2CE882',
        strokeHex: '#07120C',
        scale: 1.18,
        tag: 'HEAL',
        tagHex: '#7DFFBC',
        tintRgba: [0.35, 1.0, 0.62, 1.0],
      };
    case 'armor':
      return {
        fillTop: '#FFF0B0',
        fillBottom: '#FFA41C',
        strokeHex: '#120A05',
        scale: 1.3,
        tag: typeof fn.value === 'string' ? undefined : 'ARMOR',
        tagHex: '#FFCA4B',
        tintRgba: [1.0, 0.74, 0.24, 1.0],
      };
    case 'status':
      return {
        fillTop: '#FFFFFF',
        fillBottom: fn.colorHex || '#C98BFF',
        strokeHex: '#0A060E',
        scale: 1.08,
        tintRgba: hexToRgbaTuple(fn.colorHex || '#C98BFF'),
      };
    case 'dodge':
      return {
        fillTop: '#E4F9FF',
        fillBottom: '#78E2FF',
        strokeHex: '#090912',
        scale: 1.16,
        tintRgba: [0.64, 0.94, 1.0, 1.0],
      };
    case 'blocked':
      return {
        fillTop: '#FFE9A8',
        fillBottom: '#D69F3E',
        strokeHex: '#0A060E',
        scale: 1.12,
        tintRgba: [0.96, 0.78, 0.36, 1.0],
      };
    case 'gold':
      return {
        fillTop: '#FFF9B8',
        fillBottom: '#F2B830',
        strokeHex: '#120C04',
        scale: 1.12,
        tintRgba: [1.0, 0.85, 0.3, 1.0],
      };
    case 'normal':
    default:
      return {
        fillTop: '#FFFFFF',
        fillBottom: fn.colorHex || '#F5DFB0',
        strokeHex: '#09060E',
        scale: 1.0,
        tintRgba: [1.0, 0.96, 0.86, 1.0],
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

/**
 * Draw a crisp, comic-ink-outlined floating combat number on a Canvas2D context.
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
      ? 0.55 + 0.72 * Math.sin((progress / 0.14) * Math.PI * 0.65)
      : progress < 0.25
        ? 1.15 - 0.15 * ((progress - 0.14) / 0.11)
        : 1.0;
  const alpha = progress > 0.7 ? Math.max(0, 1 - (progress - 0.7) / 0.3) : 1;

  const text = formatFloatingNumberText(fn);
  const fontSize = Math.round(24 * style.scale * pop);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(screenX, screenY);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Optional mythic callout tag above critical / backstab / deflect / armor break
  if (style.tag) {
    const tagSize = Math.max(11, Math.round(12 * style.scale));
    ctx.font = `900 ${tagSize}px ${MYTHIC_DISPLAY_FONT}`;
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = style.strokeHex;
    ctx.strokeText(style.tag, 0, -fontSize * 0.72);
    ctx.fillStyle = style.tagHex ?? style.fillTop;
    ctx.fillText(style.tag, 0, -fontSize * 0.72);
  }

  // Primary bold number with drop shadow, thick jet-black ink outline, and chiseled gradient fill
  ctx.font = `900 ${fontSize}px ${COMBAT_NUMBER_FONT}`;

  // Hard comic drop shadow
  ctx.fillStyle = 'rgba(8, 5, 14, 0.85)';
  ctx.fillText(text, 2.5, 3.5);

  // Thick jet-black ink stroke
  ctx.lineWidth = Math.max(4.5, fontSize * 0.22);
  ctx.strokeStyle = style.strokeHex;
  ctx.strokeText(text, 0, 0);

  // Chiseled vertical fill gradient
  const grad = ctx.createLinearGradient(0, -fontSize * 0.5, 0, fontSize * 0.5);
  grad.addColorStop(0, style.fillTop);
  grad.addColorStop(1, style.fillBottom);
  ctx.fillStyle = grad;
  ctx.fillText(text, 0, 0);

  ctx.restore();
}

// ============================================================================
// Pre-Baked High-DPI Bitmap Glyph Atlas for Zero-Allocation WebGL2 Combat Text
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
const GLYPH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!+-%.,:?/ ';

let cachedFontAtlas: BakedFontAtlas | null = null;

/**
 * Pre-bakes a crisp high-DPI white-filled, thick jet-black comic-ink outlined glyph
 * sheet ONCE at startup so WebGL2 can draw arbitrary floating damage numbers and callouts
 * (`CRIT!`, `BACKSTAB`, `DEFLECT!`, `ARMOR BREAK!`, `+25`, `142!`) with ZERO per-frame
 * canvas allocations or texture re-uploads!
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
  const fontSize = 54;
  const cellW = 72;
  const cellH = 80;
  const cols = Math.floor(FONT_ATLAS_W / cellW);

  ctx.font = `900 ${fontSize}px ${COMBAT_NUMBER_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const glyphs = new Map<string, GlyphMetric>();

  for (let i = 0; i < GLYPH_CHARS.length; i++) {
    const ch = GLYPH_CHARS[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW;
    const y = row * cellH;
    const cx = x + cellW * 0.5;
    const cy = y + cellH * 0.52;

    if (ch !== ' ') {
      // Comic drop shadow
      ctx.fillStyle = 'rgba(8, 5, 14, 0.9)';
      ctx.fillText(ch, cx + 3, cy + 4);

      // Thick jet-black comic outline
      ctx.lineWidth = 11;
      ctx.strokeStyle = '#08050e';
      ctx.strokeText(ch, cx, cy);

      // Bright neutral chiseled white-silver gradient (tinted dynamically in WebGL2!)
      const g = ctx.createLinearGradient(cx, cy - 26, cx, cy + 26);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.65, '#f2f2f6');
      g.addColorStop(1, '#c8c8d4');
      ctx.fillStyle = g;
      ctx.fillText(ch, cx, cy);
    }

    const measured = ch === ' ' ? 22 : Math.max(24, Math.min(cellW - 8, ctx.measureText(ch).width + 8));
    glyphs.set(ch, {
      ch,
      u0: x / FONT_ATLAS_W,
      v0: y / FONT_ATLAS_H,
      u1: (x + cellW) / FONT_ATLAS_W,
      v1: (y + cellH) / FONT_ATLAS_H,
      w: cellW,
      h: cellH,
      advance: measured,
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
