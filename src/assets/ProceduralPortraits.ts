/**
 * ProceduralPortraits — High-resolution (480x640) painterly comic-ink chiaroscuro
 * character portraits for all 10 Patrons, Prince Pyreus, and Warden Malice.
 *
 * Features individualized 3/4 anatomy (distinct turn direction, head tilt, jaw/cheekbone
 * bone structure, sculpted expressive eyes with multi-ring glowing irises, bold #09060E
 * Mignola chiaroscuro shadow pooling + delicate shadow-edge hatching, variable-weight
 * calligraphic ink brushwork, layered multi-strand hair/beards, vibrant colored rim light,
 * gouache painted backdrops, and dynamic foreground hands/weapons/props breaking the frame).
 *
 * `getPortraitAssetIds()` is 100% pure Node-safe for Gate A `verify:assets`.
 */

import type { PatronId } from '../contracts/index.js';
import { PATRON_CONSTANTS } from '../contracts/index.js';

export type CharacterPortraitId = PatronId | 'prince_pyreus' | 'warden_malice';

export const PORTRAIT_WIDTH = 480;
export const PORTRAIT_HEIGHT = 640;

const ALL_PORTRAIT_IDS: readonly CharacterPortraitId[] = [
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
  'prince_pyreus',
  'warden_malice',
];

const INK = '#09060E';
const portraitCache = new Map<CharacterPortraitId, string>();

/** Pure Node-safe inventory of all built-in procedural portrait IDs (EXACTLY 12). */
export function getPortraitAssetIds(): string[] {
  return ALL_PORTRAIT_IDS.map((id) => `portrait_${id}`);
}

export function getPatronPortraitDataUrl(patronId: PatronId): string {
  return getCharacterPortraitDataUrl(patronId);
}

export function getCharacterPortraitDataUrl(id: CharacterPortraitId): string {
  const cached = portraitCache.get(id);
  if (cached) {
    return cached;
  }

  if (typeof document === 'undefined') {
    const color =
      id in PATRON_CONSTANTS
        ? PATRON_CONSTANTS[id as PatronId].colorHex
        : id === 'prince_pyreus'
          ? '#E6343E'
          : '#D42EFF';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PORTRAIT_WIDTH}" height="${PORTRAIT_HEIGHT}"><rect width="100%" height="100%" fill="#09060E"/><circle cx="240" cy="270" r="150" fill="${color}" opacity="0.35"/></svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    portraitCache.set(id, url);
    return url;
  }

  const canvas = document.createElement('canvas');
  canvas.width = PORTRAIT_WIDTH;
  canvas.height = PORTRAIT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  paintPortrait(ctx, id);

  const dataUrl = canvas.toDataURL('image/png');
  portraitCache.set(id, dataUrl);
  return dataUrl;
}

// ============================================================================
// Comic-Ink Chiaroscuro Primitives (Calligraphic Brush, Hatching, Gouache)
// ============================================================================

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** Tapered calligraphic quadratic brush stroke (thick belly, fine razor tips). */
function paintBrushCurve(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  maxW: number,
  color = INK,
  taperStart = 0.22,
  taperEnd = 0.14
): void {
  const steps = 14;
  const leftPts: [number, number][] = [];
  const rightPts: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const it = 1 - t;
    const px = it * it * x0 + 2 * it * t * cx + t * t * x1;
    const py = it * it * y0 + 2 * it * t * cy + t * t * y1;
    const tx = 2 * it * (cx - x0) + 2 * t * (x1 - cx);
    const ty = 2 * it * (cy - y0) + 2 * t * (y1 - cy);
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;

    const belly = Math.sin(t * Math.PI);
    const w =
      maxW * (taperStart * (1 - t) + taperEnd * t + (1 - Math.max(taperStart, taperEnd)) * belly) * 0.5;
    leftPts.push([px + nx * w, py + ny * w]);
    rightPts.push([px - nx * w, py - ny * w]);
  }

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(leftPts[0][0], leftPts[0][1]);
  for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i][0], leftPts[i][1]);
  for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i][0], rightPts[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Delicate fine-pen cross-hatching tucked strictly along a shadow terminator. */
function paintInkHatchCluster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  len: number,
  spacing: number,
  angleRad: number,
  alpha = 0.42,
  lineW = 1.2
): void {
  ctx.save();
  ctx.strokeStyle = `rgba(9, 6, 14, ${alpha})`;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  const ca = Math.cos(angleRad);
  const sa = Math.sin(angleRad);
  const px = -sa;
  const py = ca;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? i / (count - 1) : 0.5;
    const taper = 0.5 + 0.5 * Math.sin(frac * Math.PI);
    const ox = x + px * (i * spacing);
    const oy = y + py * (i * spacing);
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + ca * len * taper, oy + sa * len * taper);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders a smooth sculpted hair/cloth ribbon with 3-tone gradient, organic curved
 * chiaroscuro shadow mass inside clip, rim highlight, and clean re-traced comic outline.
 */
function paintSculptedRibbon(
  ctx: CanvasRenderingContext2D,
  pts: readonly [number, number][],
  lit: string,
  mid: string,
  dark: string,
  rim?: string,
  inkW = 5.0
): void {
  if (pts.length < 3) return;
  let minX = pts[0][0],
    maxX = pts[0][0],
    minY = pts[0][1],
    maxY = pts[0][1];
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const traceRibbon = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const mx = (prev[0] + cur[0]) * 0.5;
      const my = (prev[1] + cur[1]) * 0.5;
      if (i === 1) ctx.lineTo(mx, my);
      else ctx.quadraticCurveTo(prev[0], prev[1], mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.quadraticCurveTo(last[0], last[1], pts[0][0], pts[0][1]);
    ctx.closePath();
  };

  ctx.save();
  traceRibbon();
  const grad = ctx.createLinearGradient(minX, minY, maxX, maxY);
  grad.addColorStop(0, lit);
  grad.addColorStop(0.45, mid);
  grad.addColorStop(0.84, dark);
  grad.addColorStop(1, INK);
  ctx.fillStyle = grad;
  ctx.fill();

  // Clip organic curved SE chiaroscuro shadow mass + NW rim light cleanly inside ribbon
  ctx.save();
  traceRibbon();
  ctx.clip();
  const bw = maxX - minX;
  const bh = maxY - minY;
  ctx.fillStyle = 'rgba(9, 6, 14, 0.56)';
  ctx.beginPath();
  ctx.moveTo(minX + bw * 0.62, minY - 10);
  ctx.lineTo(maxX + 12, minY - 10);
  ctx.lineTo(maxX + 12, maxY + 12);
  ctx.lineTo(minX + bw * 0.42, maxY + 12);
  ctx.quadraticCurveTo(minX + bw * 0.72, minY + bh * 0.5, minX + bw * 0.62, minY - 10);
  ctx.closePath();
  ctx.fill();

  if (rim) {
    ctx.save();
    ctx.translate(2.2, 1.8);
    traceRibbon();
    ctx.strokeStyle = rim;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Re-trace ribbon path explicitly so outer stroke follows the exact contour!
  traceRibbon();
  ctx.strokeStyle = INK;
  ctx.lineWidth = inkW;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws a sharp tapered crescent hair-lock spike (ideal for dynamic comic hair & beards!).
 */
function paintHairLock(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cx1: number,
  cy1: number,
  tipX: number,
  tipY: number,
  cx2: number,
  cy2: number,
  lit: string,
  mid: string,
  dark: string,
  rim?: string
): void {
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx1, cy1, tipX, tipY);
    ctx.quadraticCurveTo(cx2, cy2, x0, y0);
    ctx.closePath();
  };
  ctx.save();
  trace();
  const g = ctx.createLinearGradient(x0, y0, tipX, tipY);
  g.addColorStop(0, dark);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, lit);
  ctx.fillStyle = g;
  ctx.fill();
  if (rim) {
    ctx.save();
    trace();
    ctx.clip();
    paintBrushCurve(ctx, x0, y0, cx1, cy1, tipX, tipY, 3.6, rim);
    ctx.restore();
  }
  trace();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();
  ctx.restore();
}

/**
 * Painterly gouache backdrop with organic brushwork clouds, off-center Greco-Roman
 * celestial astrolabe halo, and dramatic chiaroscuro corner vignette.
 */
function paintGouacheBackdrop(
  ctx: CanvasRenderingContext2D,
  opts: {
    primary: string;
    highlight: string;
    deep: string;
    voidCol: string;
    haloX: number;
    haloY: number;
    seed: number;
    starPoints?: number;
  }
): void {
  const w = PORTRAIT_WIDTH;
  const h = PORTRAIT_HEIGHT;
  const rand = seededRand(opts.seed);

  const bg = ctx.createLinearGradient(0, 0, w * 0.85, h);
  bg.addColorStop(0, opts.deep);
  bg.addColorStop(0.52, '#120A1C');
  bg.addColorStop(1, opts.voidCol);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle organic gouache cloud washes
  ctx.save();
  for (let i = 0; i < 24; i++) {
    const bx = rand() * w;
    const by = rand() * h * 0.88;
    const rx = 50 + rand() * 110;
    const ry = 20 + rand() * 48;
    const rot = (rand() - 0.5) * 1.3;
    ctx.fillStyle = i % 3 === 0 ? opts.primary : i % 3 === 1 ? opts.deep : INK;
    ctx.globalAlpha = i % 3 === 2 ? 0.24 : 0.07 + rand() * 0.08;
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Radiant divine backlight bloom behind figure
  ctx.save();
  const bloom = ctx.createRadialGradient(opts.haloX, opts.haloY, 16, opts.haloX, opts.haloY, 310);
  bloom.addColorStop(0, opts.highlight);
  bloom.addColorStop(0.24, opts.primary);
  bloom.addColorStop(0.62, 'rgba(18, 10, 28, 0.24)');
  bloom.addColorStop(1, 'rgba(9, 6, 14, 0)');
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Architectural Greco-Roman astrolabe halo
  ctx.save();
  ctx.translate(opts.haloX, opts.haloY);
  const pts = opts.starPoints ?? 8;
  ctx.fillStyle = opts.highlight;
  ctx.globalAlpha = 0.13;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? 228 : 96;
    const a = (i * Math.PI) / pts - Math.PI * 0.5;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = opts.primary;
  ctx.globalAlpha = 0.44;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 162, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.26;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 178, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = opts.highlight;
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI * 2) / 24;
    const r0 = i % 3 === 0 ? 152 : 162;
    const r1 = i % 3 === 0 ? 186 : 174;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();

  // Moody corner chiaroscuro vignette
  const cornerVig = ctx.createRadialGradient(w * 0.5, h * 0.42, 130, w * 0.5, h * 0.48, 395);
  cornerVig.addColorStop(0, 'rgba(9, 6, 14, 0)');
  cornerVig.addColorStop(0.74, 'rgba(9, 6, 14, 0.26)');
  cornerVig.addColorStop(1, 'rgba(9, 6, 14, 0.8)');
  ctx.fillStyle = cornerVig;
  ctx.fillRect(0, 0, w, h);
}

// ============================================================================
// Parameterized Individualized Comic-Ink Anatomy Engine
// ============================================================================

type JawArchetype =
  | 'square_titan'
  | 'aristocratic_sharp'
  | 'sculpted_youth'
  | 'sensual_taper'
  | 'relaxed_broad'
  | 'elongated_ethereal';

type ExpressionStyle =
  | 'imperious'
  | 'boisterous'
  | 'fierce'
  | 'alluring'
  | 'focused'
  | 'smirk'
  | 'austere'
  | 'surreal';

interface CharacterAnatomy {
  headX: number;
  headY: number;
  turnDir: -1 | 1;
  tiltRad: number;
  headScale: number;
  jaw: JawArchetype;
  expression: ExpressionStyle;
  skinLit: string;
  skinMid: string;
  skinShadow: string;
  skinDeep: string;
  lipHex: string;
  clothLit: string;
  clothMid: string;
  clothDark: string;
  metalLit: string;
  metalMid: string;
  metalDark: string;
  eyeOuter: string;
  eyeInner: string;
  eyeRightOuter?: string;
  eyeRightInner?: string;
  scleraHex?: string;
  pupilSlit?: boolean;
  rimHex: string;
  shoulderSpan: number;
  neckWidth: number;
  collarStyle: 'chiton_drape' | 'high_armor' | 'plunge_velvet' | 'fur_mantle' | 'shroud_void' | 'corset_spike';
  pauldronSide: 'left' | 'right' | 'both' | 'none';
  warPaint?: 'bellum_crimson';
  scar?: boolean;
}

function paintComicTorso(ctx: CanvasRenderingContext2D, a: CharacterAnatomy): void {
  const cx = a.headX;
  const dir = a.turnDir;
  const nearSide = -dir;
  const farSide = dir;

  const neckBaseY = a.headY + 124 * a.headScale;
  const nearShX = cx + nearSide * (a.shoulderSpan * 0.56);
  const nearShY = neckBaseY + 32;
  const farShX = cx + farSide * (a.shoulderSpan * 0.46);
  const farShY = neckBaseY + 14;

  const traceTorso = () => {
    ctx.beginPath();
    ctx.moveTo(nearShX + nearSide * 58, PORTRAIT_HEIGHT + 12);
    ctx.bezierCurveTo(
      nearShX + nearSide * 38,
      nearShY + 90,
      nearShX + nearSide * 18,
      nearShY - 12,
      cx + nearSide * 54,
      neckBaseY - 8
    );
    ctx.lineTo(cx + farSide * 48, neckBaseY - 14);
    ctx.bezierCurveTo(
      farShX + farSide * 10,
      farShY - 10,
      farShX + farSide * 40,
      farShY + 86,
      farShX + farSide * 64,
      PORTRAIT_HEIGHT + 12
    );
    ctx.closePath();
  };

  ctx.save();
  traceTorso();
  const litX = Math.min(nearShX, farShX);
  const shdX = Math.max(nearShX, farShX);
  const torsoGrad = ctx.createLinearGradient(litX, neckBaseY, shdX, PORTRAIT_HEIGHT);
  torsoGrad.addColorStop(0, a.clothLit);
  torsoGrad.addColorStop(0.4, a.clothMid);
  torsoGrad.addColorStop(0.76, a.clothDark);
  torsoGrad.addColorStop(1, INK);
  ctx.fillStyle = torsoGrad;
  ctx.fill();

  ctx.save();
  traceTorso();
  ctx.clip();

  // Bold Mignola heavy-black chiaroscuro shadow mass on right/SE side of torso
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.86;
  ctx.beginPath();
  ctx.moveTo(cx + 34, neckBaseY - 12);
  ctx.bezierCurveTo(cx + 76, neckBaseY + 86, cx + 46, neckBaseY + 190, cx - 4, PORTRAIT_HEIGHT + 14);
  ctx.lineTo(PORTRAIT_WIDTH + 20, PORTRAIT_HEIGHT + 14);
  ctx.lineTo(PORTRAIT_WIDTH + 20, neckBaseY - 30);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  paintInkHatchCluster(ctx, cx + 18, neckBaseY + 72, 9, 32, 9, 0.56, 0.42, 1.4);

  // Exposed sunlit collarbone & décolletage plane
  if (a.collarStyle === 'chiton_drape' || a.collarStyle === 'plunge_velvet' || a.collarStyle === 'corset_spike') {
    const vDepth = a.collarStyle === 'plunge_velvet' ? 124 : a.collarStyle === 'corset_spike' ? 88 : 98;
    const traceChest = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 64, neckBaseY - 14);
      ctx.quadraticCurveTo(cx + dir * 8, neckBaseY + vDepth, cx + 68, neckBaseY - 18);
      ctx.closePath();
    };
    traceChest();
    const skG = ctx.createLinearGradient(cx - 64, neckBaseY, cx + 52, neckBaseY + vDepth);
    skG.addColorStop(0, a.skinLit);
    skG.addColorStop(0.54, a.skinMid);
    skG.addColorStop(0.84, a.skinShadow);
    skG.addColorStop(1, a.skinDeep);
    ctx.fillStyle = skG;
    ctx.fill();

    ctx.save();
    traceChest();
    ctx.clip();
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.58;
    ctx.beginPath();
    ctx.moveTo(cx + 16, neckBaseY - 16);
    ctx.quadraticCurveTo(cx + 30, neckBaseY + 52, cx + 6, neckBaseY + vDepth + 8);
    ctx.lineTo(cx + 80, neckBaseY + vDepth + 8);
    ctx.lineTo(cx + 80, neckBaseY - 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    paintBrushCurve(ctx, cx - 52, neckBaseY + 24, cx - 22, neckBaseY + 38, cx - 4, neckBaseY + 32, 3.8, a.skinDeep);
    paintBrushCurve(ctx, cx + 50, neckBaseY + 20, cx + 26, neckBaseY + 36, cx + 8, neckBaseY + 32, 4.2, INK);
    paintBrushCurve(ctx, cx - 64, neckBaseY - 12, cx + dir * 8, neckBaseY + vDepth, cx + 68, neckBaseY - 16, 4.6, INK);
  }

  if (a.collarStyle === 'high_armor' || a.collarStyle === 'corset_spike') {
    ctx.beginPath();
    ctx.moveTo(cx - 108, neckBaseY + 46);
    ctx.quadraticCurveTo(cx, neckBaseY + 86, cx + 108, neckBaseY + 42);
    ctx.lineTo(cx + 122, PORTRAIT_HEIGHT + 12);
    ctx.lineTo(cx - 122, PORTRAIT_HEIGHT + 12);
    ctx.closePath();
    const plateG = ctx.createLinearGradient(cx - 110, neckBaseY + 40, cx + 110, PORTRAIT_HEIGHT);
    plateG.addColorStop(0, a.metalLit);
    plateG.addColorStop(0.32, a.metalMid);
    plateG.addColorStop(0.68, a.metalDark);
    plateG.addColorStop(1, INK);
    ctx.fillStyle = plateG;
    ctx.fill();

    ctx.fillStyle = 'rgba(9, 6, 14, 0.68)';
    ctx.beginPath();
    ctx.moveTo(cx + 16, neckBaseY + 62);
    ctx.lineTo(cx + 118, neckBaseY + 40);
    ctx.lineTo(cx + 128, PORTRAIT_HEIGHT + 12);
    ctx.lineTo(cx - 2, PORTRAIT_HEIGHT + 12);
    ctx.closePath();
    ctx.fill();

    paintBrushCurve(ctx, cx - 86, neckBaseY + 62, cx, neckBaseY + 132, cx + 86, neckBaseY + 58, 6.2, a.metalLit);
    paintBrushCurve(ctx, cx - 86, neckBaseY + 66, cx, neckBaseY + 136, cx + 86, neckBaseY + 62, 3.0, INK);
  } else {
    // Flowing diagonal Greco-Roman himation drapery
    ctx.beginPath();
    ctx.moveTo(nearShX - nearSide * 12, nearShY - 4);
    ctx.bezierCurveTo(
      cx - nearSide * 10,
      neckBaseY + 98,
      cx + farSide * 44,
      neckBaseY + 122,
      farShX + farSide * 58,
      PORTRAIT_HEIGHT + 10
    );
    ctx.lineTo(nearShX + nearSide * 66, PORTRAIT_HEIGHT + 10);
    ctx.closePath();
    const sashG = ctx.createLinearGradient(nearShX, nearShY, farShX, PORTRAIT_HEIGHT);
    sashG.addColorStop(0, a.clothLit);
    sashG.addColorStop(0.48, a.clothMid);
    sashG.addColorStop(0.86, a.clothDark);
    sashG.addColorStop(1, INK);
    ctx.fillStyle = sashG;
    ctx.fill();

    for (let f = 0; f < 3; f++) {
      const fx0 = nearShX - nearSide * (18 + f * 20);
      const fy0 = nearShY + 18 + f * 24;
      const fcx = cx + (f - 1) * 32;
      const fcy = neckBaseY + 130 + f * 26;
      const fx1 = cx + farSide * (36 - f * 24) + (f - 1) * 44;
      const fy1 = PORTRAIT_HEIGHT + 10;
      ctx.fillStyle = 'rgba(9, 6, 14, 0.65)';
      ctx.beginPath();
      ctx.moveTo(fx0, fy0);
      ctx.quadraticCurveTo(fcx, fcy, fx1, fy1);
      ctx.quadraticCurveTo(fcx - nearSide * 22, fcy + 14, fx0, fy0);
      ctx.closePath();
      ctx.fill();
      paintBrushCurve(ctx, fx0, fy0, fcx, fcy, fx1, fy1, 4.2, INK);
    }

    paintBrushCurve(
      ctx,
      nearShX - nearSide * 6,
      nearShY - 2,
      cx + farSide * 12,
      neckBaseY + 108,
      farShX + farSide * 52,
      PORTRAIT_HEIGHT + 4,
      9.0,
      a.metalLit
    );
    paintBrushCurve(
      ctx,
      nearShX - nearSide * 6,
      nearShY + 3,
      cx + farSide * 12,
      neckBaseY + 114,
      farShX + farSide * 52,
      PORTRAIT_HEIGHT + 8,
      3.5,
      INK
    );
  }

  paintBrushCurve(
    ctx,
    Math.min(nearShX, farShX) - 26,
    PORTRAIT_HEIGHT - 80,
    Math.min(nearShX, farShX) - 8,
    nearShY + 12,
    cx - 56,
    neckBaseY - 6,
    6.2,
    a.rimHex,
    0.2,
    0.3
  );
  ctx.restore();

  traceTorso();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.5;
  ctx.stroke();
  ctx.restore();

  // Sculpted Metallic Pauldrons
  const drawPauldron = (px: number, py: number, flip: number) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(flip, 1);
    const traceP = () => {
      ctx.beginPath();
      ctx.moveTo(-58, 36);
      ctx.bezierCurveTo(-64, -12, -14, -44, 46, -24);
      ctx.bezierCurveTo(64, 4, 42, 48, -12, 50);
      ctx.closePath();
    };
    traceP();
    const pGrad = ctx.createLinearGradient(-48, -32, 46, 44);
    pGrad.addColorStop(0, a.metalLit);
    pGrad.addColorStop(0.4, a.metalMid);
    pGrad.addColorStop(0.76, a.metalDark);
    pGrad.addColorStop(1, INK);
    ctx.fillStyle = pGrad;
    ctx.fill();

    ctx.save();
    traceP();
    ctx.clip();
    ctx.fillStyle = 'rgba(9, 6, 14, 0.62)';
    ctx.beginPath();
    ctx.moveTo(-60, 16);
    ctx.quadraticCurveTo(0, 8, 58, 22);
    ctx.lineTo(62, 60);
    ctx.lineTo(-64, 60);
    ctx.closePath();
    ctx.fill();
    paintBrushCurve(ctx, -42, 12, -8, -24, 34, -12, 5.0, '#FFFFFF', 0.1, 0.1);
    paintBrushCurve(ctx, -50, 26, -12, -32, 38, -18, 3.4, a.rimHex);
    ctx.restore();

    traceP();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.6;
    ctx.stroke();
    paintBrushCurve(ctx, -42, 26, 2, 10, 42, 18, 3.8, INK);
    ctx.restore();
  };

  if (a.pauldronSide === 'left' || a.pauldronSide === 'both') {
    drawPauldron(Math.min(nearShX, farShX) + 46, nearShY + 12, 1);
  }
  if (a.pauldronSide === 'right' || a.pauldronSide === 'both') {
    drawPauldron(Math.max(nearShX, farShX) - 46, farShY + 14, -1);
  }
}

function paintComicHead(ctx: CanvasRenderingContext2D, a: CharacterAnatomy): void {
  ctx.save();
  ctx.translate(a.headX, a.headY);
  ctx.rotate(a.tiltRad);
  ctx.scale(a.headScale, a.headScale);

  const d = a.turnDir;
  const nw = a.neckWidth;

  // 1. Sculpted Neck + Clean Cast Shadow (hatching tucked strictly inside right shadow edge!)
  const traceNeck = () => {
    ctx.beginPath();
    ctx.moveTo(-nw * 0.68, 66);
    ctx.quadraticCurveTo(-nw * 0.78, 114, -nw * 0.88, 152);
    ctx.quadraticCurveTo(0, 174, nw * 0.88, 148);
    ctx.quadraticCurveTo(nw * 0.74, 110, nw * 0.66, 62);
    ctx.closePath();
  };
  traceNeck();
  const neckG = ctx.createLinearGradient(-nw, 72, nw, 150);
  neckG.addColorStop(0, a.skinLit);
  neckG.addColorStop(0.48, a.skinMid);
  neckG.addColorStop(0.84, a.skinShadow);
  neckG.addColorStop(1, a.skinDeep);
  ctx.fillStyle = neckG;
  ctx.fill();

  ctx.save();
  traceNeck();
  ctx.clip();
  // Clean cast jaw chiaroscuro shadow mass spilling down right half of neck
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(-nw, 60);
  ctx.lineTo(nw + 10, 60);
  ctx.lineTo(nw + 10, 168);
  ctx.lineTo(6, 168);
  ctx.bezierCurveTo(18, 134, -4, 114, -nw, 96);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  // Subtle sternocleidomastoid shadow line
  paintBrushCurve(ctx, -nw * 0.42, 92, -nw * 0.24, 124, -4, 152, 2.8, a.skinDeep);
  ctx.restore();

  traceNeck();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.0;
  ctx.stroke();

  // 2. Sculpted Ear on back 3/4 side (-d)
  const earX = -d * 68;
  ctx.beginPath();
  ctx.moveTo(earX, -6);
  ctx.bezierCurveTo(earX - d * 24, -14, earX - d * 24, 34, earX + d * 2, 42);
  ctx.closePath();
  ctx.fillStyle = a.skinShadow;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4;
  ctx.stroke();
  paintBrushCurve(ctx, earX - d * 6, 4, earX - d * 14, 16, earX - d * 4, 28, 2.8, INK);

  // 3. Individualized 3/4 Facial Bone Structure
  let jawW = 68;
  let chinY = 98;
  let chinW = 18;
  let cheekBulge = 74;
  let browH = -82;

  switch (a.jaw) {
    case 'square_titan':
      jawW = 76;
      chinY = 104;
      chinW = 30;
      cheekBulge = 80;
      browH = -84;
      break;
    case 'aristocratic_sharp':
      jawW = 63;
      chinY = 102;
      chinW = 12;
      cheekBulge = 72;
      browH = -86;
      break;
    case 'sculpted_youth':
      jawW = 66;
      chinY = 98;
      chinW = 17;
      cheekBulge = 73;
      browH = -82;
      break;
    case 'sensual_taper':
      jawW = 61;
      chinY = 96;
      chinW = 12;
      cheekBulge = 70;
      browH = -82;
      break;
    case 'relaxed_broad':
      jawW = 72;
      chinY = 100;
      chinW = 24;
      cheekBulge = 77;
      browH = -80;
      break;
    case 'elongated_ethereal':
      jawW = 58;
      chinY = 114;
      chinW = 10;
      cheekBulge = 66;
      browH = -94;
      break;
  }

  const buildFacePath = () => {
    ctx.beginPath();
    ctx.moveTo(d * (jawW * 0.82), -54);
    ctx.bezierCurveTo(d * (cheekBulge + 6), -22, d * (cheekBulge + 2), 6, d * (jawW * 0.86), 34);
    ctx.bezierCurveTo(d * (jawW * 0.72), 68, d * (chinW + 14), chinY - 8, d * (chinW * 0.5), chinY);
    ctx.bezierCurveTo(-d * (chinW * 0.7), chinY + 1, -d * (jawW * 0.65), 76, -d * (jawW * 0.96), 34);
    ctx.bezierCurveTo(-d * (jawW * 1.06), -14, -d * (jawW * 0.96), -76, -d * 8, browH);
    ctx.bezierCurveTo(d * 40, browH, d * (jawW * 0.76), -70, d * (jawW * 0.82), -54);
    ctx.closePath();
  };

  buildFacePath();
  const faceGrad = ctx.createLinearGradient(-jawW, browH, jawW, chinY);
  faceGrad.addColorStop(0, a.skinLit);
  faceGrad.addColorStop(0.45, a.skinMid);
  faceGrad.addColorStop(0.78, a.skinShadow);
  faceGrad.addColorStop(1, a.skinDeep);
  ctx.fillStyle = faceGrad;
  ctx.fill();

  ctx.save();
  buildFacePath();
  ctx.clip();

  // 4. Sculpted Mignola Chiaroscuro Shadow Mask on SE side of face
  ctx.fillStyle = a.skinShadow;
  ctx.globalAlpha = 0.74;
  ctx.beginPath();
  ctx.moveTo(18, browH - 10);
  ctx.lineTo(110, browH - 10);
  ctx.lineTo(110, chinY + 20);
  ctx.lineTo(-4, chinY + 20);
  ctx.bezierCurveTo(26, 68, 36, 34, 22, 12);
  ctx.bezierCurveTo(44, -8, 36, -48, 18, browH - 10);
  ctx.closePath();
  ctx.fill();

  // Crisp deep ink shadow edge along temple, cheekbone hollow & lower jaw
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.moveTo(46, browH - 8);
  ctx.lineTo(110, browH - 8);
  ctx.lineTo(110, chinY + 20);
  ctx.lineTo(22, chinY + 20);
  ctx.bezierCurveTo(48, 72, 56, 40, 42, 18);
  ctx.bezierCurveTo(60, -4, 56, -44, 46, browH - 8);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Delicate comic pen hatching tucked strictly inside cheekbone shadow transition
  paintInkHatchCluster(ctx, 28, 20, 6, 16, 5.5, 0.56, 0.36, 1.1);

  if (a.warPaint === 'bellum_crimson') {
    ctx.fillStyle = '#C9121C';
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.moveTo(-jawW - 10, -14);
    ctx.lineTo(d * 18, -2);
    ctx.lineTo(jawW + 10, -16);
    ctx.lineTo(jawW + 10, 24);
    ctx.lineTo(d * 18, 30);
    ctx.lineTo(-jawW - 10, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#75060C';
    ctx.fillRect(-38, 18, 5, 20);
    ctx.fillRect(26, 18, 5, 16);
    ctx.globalAlpha = 1;
  }

  // Warm/cool sunlit NW cheekbone specular plane
  ctx.fillStyle = a.skinLit;
  ctx.globalAlpha = 0.56;
  ctx.beginPath();
  ctx.ellipse(-34, 12, 20, 11, -0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Vibrant Colored Rim Light ribbons peeling face cleanly off background!
  paintBrushCurve(ctx, -jawW + 4, -36, -jawW - 2, 26, -chinW + 2, chinY - 4, 5.8, a.rimHex, 0.15, 0.2);
  paintBrushCurve(ctx, jawW - 6, 10, jawW - 10, 52, chinW + 12, chinY - 8, 3.6, a.rimHex, 0.1, 0.1);

  if (a.scar) {
    paintBrushCurve(ctx, -28, -28, -16, 4, -8, 34, 2.8, '#6E1E26', 0.1, 0.1);
  }
  ctx.restore();

  buildFacePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.2;
  ctx.stroke();

  // 5. Sculpted 3/4 Nose Bridge + Chiaroscuro Cast Shadow Wedge
  const noseX = d * 18;
  const noseTipX = noseX + d * 12;
  const noseY = 26;

  ctx.fillStyle = a.skinDeep;
  ctx.beginPath();
  ctx.moveTo(noseX - d * 2, -22);
  ctx.lineTo(noseTipX, noseY);
  ctx.lineTo(noseX - d * 10, noseY + 9);
  ctx.lineTo(noseX - d * 13, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(noseTipX - d * 2, noseY + 1);
  ctx.lineTo(noseX - d * 9, noseY + 7);
  ctx.lineTo(noseX - d * 4, noseY + 11);
  ctx.closePath();
  ctx.fill();

  paintBrushCurve(ctx, noseX - d * 1, -22, noseX + d * 6, 4, noseTipX, noseY, 3.4, INK, 0.15, 0.7);
  paintBrushCurve(ctx, noseX + d * 2, -16, noseX + d * 8, 4, noseTipX - d * 1, noseY - 3, 2.2, a.skinLit, 0.1, 0.1);

  // 6. Sculpted Expressive Eyes (Multi-ring Glowing Irises + Winged Lashes — ZERO Dot Eyes!)
  const farEyeX = d * 42;
  const nearEyeX = -d * 18;
  const eyeY = -10;

  const paintExpressiveEye = (
    ex: number,
    ey: number,
    ew: number,
    eh: number,
    irisOuter: string,
    irisInner: string,
    isNear: boolean
  ) => {
    ctx.fillStyle = INK;
    ctx.globalAlpha = a.expression === 'fierce' || a.expression === 'imperious' ? 0.68 : 0.4;
    ctx.beginPath();
    ctx.moveTo(ex - ew * 1.25, ey - eh * 1.6);
    ctx.quadraticCurveTo(ex, ey - eh * 2.5, ex + ew * 1.2, ey - eh * 1.4);
    ctx.quadraticCurveTo(ex, ey - eh * 0.65, ex - ew * 1.25, ey - eh * 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    const buildAperture = () => {
      ctx.beginPath();
      ctx.moveTo(ex - ew, ey + 1);
      ctx.bezierCurveTo(ex - ew * 0.4, ey - eh * 1.15, ex + ew * 0.45, ey - eh * 1.1, ex + ew, ey - 1);
      ctx.bezierCurveTo(ex + ew * 0.45, ey + eh * 0.9, ex - ew * 0.4, ey + eh * 0.95, ex - ew, ey + 1);
      ctx.closePath();
    };

    buildAperture();
    const sclG = ctx.createLinearGradient(ex, ey - eh, ex, ey + eh);
    if (a.scleraHex) {
      sclG.addColorStop(0, INK);
      sclG.addColorStop(0.5, a.scleraHex);
      sclG.addColorStop(1, a.scleraHex);
    } else {
      sclG.addColorStop(0, '#998CA8');
      sclG.addColorStop(0.45, '#F5ECE2');
      sclG.addColorStop(1, '#DFD0C6');
    }
    ctx.fillStyle = sclG;
    ctx.fill();

    ctx.save();
    buildAperture();
    ctx.clip();

    const irisR = eh * 0.96;
    const gazeX = ex + d * 2.2;
    const irisG = ctx.createRadialGradient(gazeX, ey, irisR * 0.14, gazeX, ey, irisR);
    irisG.addColorStop(0, '#FFFFFF');
    irisG.addColorStop(0.32, irisInner);
    irisG.addColorStop(0.78, irisOuter);
    irisG.addColorStop(1, INK);
    ctx.fillStyle = irisG;
    ctx.beginPath();
    ctx.arc(gazeX, ey + 0.5, irisR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = INK;
    ctx.beginPath();
    if (a.pupilSlit) {
      ctx.ellipse(gazeX, ey + 0.5, irisR * 0.2, irisR * 0.78, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(gazeX, ey + 0.5, irisR * 0.34, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.fillStyle = 'rgba(9, 6, 14, 0.4)';
    ctx.fillRect(ex - ew - 2, ey - eh - 2, ew * 2 + 4, eh * 0.6);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(gazeX - irisR * 0.36, ey - irisR * 0.3, Math.max(2.1, irisR * 0.24), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gazeX + irisR * 0.32, ey + irisR * 0.28, Math.max(1.1, irisR * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const wingOut = isNear ? -d * 8 : d * 6;
    paintBrushCurve(
      ctx,
      ex - ew + (wingOut < 0 ? wingOut : -1),
      ey + (wingOut < 0 ? -4 : 1),
      ex,
      ey - eh * 1.25,
      ex + ew + (wingOut > 0 ? wingOut : 1),
      ey + (wingOut > 0 ? -4 : -1),
      a.jaw === 'sensual_taper' || a.jaw === 'aristocratic_sharp' ? 6.0 : 5.0,
      INK,
      0.22,
      0.22
    );
    paintBrushCurve(ctx, ex - ew * 0.65, ey + eh * 0.72, ex, ey + eh * 1.05, ex + ew * 0.7, ey + eh * 0.65, 2.0, a.skinDeep);
  };

  paintExpressiveEye(farEyeX, eyeY, 15.5, 8.8, a.eyeOuter, a.eyeInner, false);
  paintExpressiveEye(
    nearEyeX,
    eyeY + 1,
    19.5,
    9.6,
    a.eyeRightOuter ?? a.eyeOuter,
    a.eyeRightInner ?? a.eyeInner,
    true
  );

  // 7. Expressive Comic Eyebrows
  const browDrop =
    a.expression === 'fierce' || a.expression === 'imperious'
      ? 9
      : a.expression === 'focused' || a.expression === 'austere'
        ? 5
        : a.expression === 'alluring'
          ? -3
          : 2;
  const browThick = a.jaw === 'square_titan' || a.jaw === 'relaxed_broad' ? 8.0 : 6.0;

  paintBrushCurve(
    ctx,
    farEyeX + d * 18,
    eyeY - 18 - browDrop * 0.35,
    farEyeX,
    eyeY - 26 - browDrop * 0.15,
    farEyeX - d * 17,
    eyeY - 17 + browDrop,
    browThick * 0.9,
    INK,
    0.2,
    0.85
  );
  paintBrushCurve(
    ctx,
    nearEyeX + d * 20,
    eyeY - 17 + browDrop,
    nearEyeX - d * 2,
    eyeY - 29 - browDrop * 0.3,
    nearEyeX - d * 26,
    eyeY - 17 - browDrop * 0.45,
    browThick,
    INK,
    0.85,
    0.15
  );

  // 8. Sculpted Chiaroscuro Lips
  const mouthX = d * 13;
  const mouthY = 55;
  const mw = a.jaw === 'sensual_taper' ? 22 : a.jaw === 'square_titan' ? 25 : 23;
  const smirkLift = a.expression === 'smirk' || a.expression === 'boisterous' ? -7 : a.expression === 'fierce' ? 4 : 0;

  ctx.fillStyle = a.lipHex;
  ctx.beginPath();
  ctx.moveTo(mouthX - mw, mouthY + (d < 0 ? smirkLift : 1));
  ctx.quadraticCurveTo(mouthX, mouthY + 2, mouthX + mw, mouthY + (d > 0 ? smirkLift : 1));
  ctx.quadraticCurveTo(
    mouthX,
    mouthY + (a.jaw === 'sensual_taper' ? 16 : 12),
    mouthX - mw,
    mouthY + (d < 0 ? smirkLift : 1)
  );
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(mouthX - mw - 2, mouthY + (d < 0 ? smirkLift : 1));
  ctx.quadraticCurveTo(mouthX - mw * 0.35, mouthY - 7, mouthX, mouthY - 3);
  ctx.quadraticCurveTo(mouthX + mw * 0.35, mouthY - 7, mouthX + mw + 2, mouthY + (d > 0 ? smirkLift : 1));
  ctx.quadraticCurveTo(mouthX, mouthY + 3, mouthX - mw - 2, mouthY + (d < 0 ? smirkLift : 1));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.56)';
  ctx.beginPath();
  ctx.ellipse(mouthX - d * 4, mouthY + 5.5, 7, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  paintBrushCurve(ctx, mouthX - 11, mouthY + 17, mouthX, mouthY + 22, mouthX + 11, mouthY + 17, 4.2, INK, 0.15, 0.15);

  ctx.restore();
}

function paintMythicFrame(ctx: CanvasRenderingContext2D, accentHex: string): void {
  const w = PORTRAIT_WIDTH;
  const h = PORTRAIT_HEIGHT;

  const vig = ctx.createLinearGradient(0, h - 156, 0, h);
  vig.addColorStop(0, 'rgba(9, 6, 14, 0)');
  vig.addColorStop(0.68, 'rgba(9, 6, 14, 0.78)');
  vig.addColorStop(1, 'rgba(9, 6, 14, 0.96)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, h - 156, w, 156);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.save();
  ctx.strokeStyle = accentHex;
  ctx.globalAlpha = 0.84;
  ctx.lineWidth = 2.6;
  ctx.strokeRect(13, 13, w - 26, h - 26);

  const corners: readonly [number, number, number, number][] = [
    [13, 13, 1, 1],
    [w - 13, 13, -1, 1],
    [13, h - 13, 1, -1],
    [w - 13, h - 13, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(cx + sx * 28, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * 28);
    ctx.stroke();

    ctx.fillStyle = '#FFF0B8';
    ctx.beginPath();
    ctx.moveTo(cx + sx * 10, cy + sy * 4);
    ctx.lineTo(cx + sx * 16, cy + sy * 10);
    ctx.lineTo(cx + sx * 10, cy + sy * 16);
    ctx.lineTo(cx + sx * 4, cy + sy * 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.restore();
}

function paintForegroundGauntlet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rot: number,
  scale: number,
  lit: string,
  mid: string,
  dark: string,
  rim: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);

  ctx.beginPath();
  ctx.moveTo(-26, 20);
  ctx.lineTo(28, 22);
  ctx.lineTo(36, 92);
  ctx.lineTo(-32, 88);
  ctx.closePath();
  const cG = ctx.createLinearGradient(-28, 20, 34, 88);
  cG.addColorStop(0, lit);
  cG.addColorStop(0.5, mid);
  cG.addColorStop(1, INK);
  ctx.fillStyle = cG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();

  for (let i = 0; i < 4; i++) {
    const fx = -24 + i * 16;
    const fy = -22 + Math.abs(i - 1.5) * 4;
    ctx.beginPath();
    ctx.roundRect(fx, fy, 15, 34, 6);
    ctx.fillStyle = i < 2 ? lit : i === 2 ? mid : dark;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.0;
    ctx.stroke();
    paintBrushCurve(ctx, fx + 3, fy + 8, fx + 7.5, fy + 6, fx + 12, fy + 8, 2.2, rim);
  }

  ctx.beginPath();
  ctx.moveTo(-28, 12);
  ctx.bezierCurveTo(-40, -6, -18, -16, 12, -8);
  ctx.bezierCurveTo(18, 2, 10, 14, -14, 20);
  ctx.closePath();
  ctx.fillStyle = lit;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4;
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// ALL 12 INDIVIDUALIZED COMIC-INK CHIAROSCURO PORTRAITS (480x640)
// ============================================================================

function paintVoltaris(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#FFEA38',
    highlight: '#FFFBE0',
    deep: '#241B06',
    voidCol: '#07050C',
    haloX: 256,
    haloY: 224,
    seed: 101,
    starPoints: 12,
  });

  // Layered multi-lock silver storm-cloud mane (NO flat blob!)
  paintSculptedRibbon(
    ctx,
    [
      [96, 342],
      [62, 260],
      [92, 224],
      [74, 150],
      [138, 102],
      [234, 64],
      [336, 86],
      [392, 154],
      [368, 218],
      [402, 274],
      [352, 354],
      [290, 340],
      [148, 348],
    ],
    '#FFFFFF',
    '#C4D2EA',
    '#3E4C6E',
    '#FFF696',
    5.8
  );
  paintBrushCurve(ctx, 106, 180, 126, 236, 104, 304, 5.2, '#4A5878');
  paintBrushCurve(ctx, 352, 174, 336, 236, 360, 300, 5.4, INK);

  const a: CharacterAnatomy = {
    headX: 244,
    headY: 246,
    turnDir: -1,
    tiltRad: -0.05,
    headScale: 1.06,
    jaw: 'square_titan',
    expression: 'imperious',
    skinLit: '#F5C49E',
    skinMid: '#CF8B62',
    skinShadow: '#7E452C',
    skinDeep: '#3D1C14',
    lipHex: '#94523E',
    clothLit: '#FAF4E6',
    clothMid: '#B9C3D8',
    clothDark: '#313C59',
    metalLit: '#FFFAB8',
    metalMid: '#F2BF30',
    metalDark: '#6E460A',
    eyeOuter: '#FFC400',
    eyeInner: '#FFFFB8',
    rimHex: '#FFF678',
    shoulderSpan: 382,
    neckWidth: 56,
    collarStyle: 'chiton_drape',
    pauldronSide: 'left',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  // Monumental sculpted curling storm-cloud beard (overlapping sculpted S-locks!)
  paintSculptedRibbon(
    ctx,
    [
      [168, 274],
      [144, 352],
      [176, 434],
      [226, 488],
      [278, 458],
      [322, 372],
      [304, 266],
      [276, 302],
      [230, 290],
      [190, 298],
    ],
    '#FFFFFF',
    '#CCD8EE',
    '#4A5A7E',
    '#FFF58A',
    5.4
  );
  paintSculptedRibbon(
    ctx,
    [
      [172, 304],
      [208, 282],
      [236, 294],
      [268, 284],
      [302, 312],
      [266, 316],
      [234, 306],
      [198, 318],
    ],
    '#FFFFFF',
    '#DCE4F5',
    '#657599',
    '#FFF9B8',
    4.4
  );
  paintBrushCurve(ctx, 184, 340, 200, 404, 228, 456, 4.6, '#485676');
  paintBrushCurve(ctx, 276, 336, 264, 400, 236, 450, 5.2, INK);

  // Swept silver temple mane framing crown base
  paintSculptedRibbon(
    ctx,
    [
      [158, 198],
      [192, 134],
      [262, 128],
      [326, 166],
      [308, 200],
      [256, 162],
      [192, 174],
    ],
    '#FFFFFF',
    '#DCE5F6',
    '#6B7B9E',
    '#FFF8B0',
    4.8
  );

  // Forged Bladed Golden Lightning Crown
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(164, 170);
  ctx.lineTo(126, 76);
  ctx.lineTo(192, 134);
  ctx.lineTo(206, 42);
  ctx.lineTo(246, 118);
  ctx.lineTo(294, 40);
  ctx.lineTo(296, 132);
  ctx.lineTo(358, 82);
  ctx.lineTo(320, 174);
  ctx.quadraticCurveTo(242, 146, 164, 170);
  ctx.closePath();
  const crG = ctx.createLinearGradient(140, 44, 340, 172);
  crG.addColorStop(0, '#FFFEC4');
  crG.addColorStop(0.45, '#F5C428');
  crG.addColorStop(0.82, '#8F5C10');
  crG.addColorStop(1, '#3D2206');
  ctx.fillStyle = crG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.6;
  ctx.stroke();
  paintBrushCurve(ctx, 206, 48, 210, 96, 214, 142, 3.2, '#FFFEC8');
  paintBrushCurve(ctx, 292, 46, 286, 98, 280, 142, 3.6, '#5A3608');
  ctx.restore();

  // FOREGROUND PROP: Gauntleted Hand Gripping Crackling Blazing Thunderbolt!
  const boltGlow = ctx.createRadialGradient(102, 452, 10, 102, 452, 152);
  boltGlow.addColorStop(0, 'rgba(255, 255, 210, 0.72)');
  boltGlow.addColorStop(0.42, 'rgba(255, 232, 48, 0.34)');
  boltGlow.addColorStop(1, 'rgba(255, 232, 48, 0)');
  ctx.fillStyle = boltGlow;
  ctx.fillRect(0, 276, 260, 364);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(154, 248);
  ctx.lineTo(94, 384);
  ctx.lineTo(126, 388);
  ctx.lineTo(54, 576);
  ctx.lineTo(106, 434);
  ctx.lineTo(74, 428);
  ctx.closePath();
  const bG = ctx.createLinearGradient(70, 248, 140, 560);
  bG.addColorStop(0, '#FFFFFF');
  bG.addColorStop(0.35, '#FFF870');
  bG.addColorStop(1, '#FFAE14');
  ctx.fillStyle = bG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.2;
  ctx.stroke();
  ctx.restore();

  paintForegroundGauntlet(ctx, 94, 470, -0.22, 1.12, '#FFF7B8', '#E5B030', '#6E460C', '#FFFFFF');

  const drawFork = (pts: readonly [number, number][]) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 9.0;
    ctx.stroke();
    ctx.strokeStyle = '#FFF048';
    ctx.lineWidth = 5.0;
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.restore();
  };
  drawFork([
    [126, 344],
    [164, 304],
    [148, 286],
    [186, 242],
  ]);
  drawFork([
    [438, 520],
    [388, 444],
    [412, 424],
    [360, 350],
  ]);

  paintMythicFrame(ctx, '#FFEA38');
}

function paintTidebreaker(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#00C8FF',
    highlight: '#B4F6FF',
    deep: '#052232',
    voidCol: '#040B14',
    haloX: 218,
    haloY: 226,
    seed: 202,
    starPoints: 10,
  });

  // Wild ocean-wave curling mane
  paintSculptedRibbon(
    ctx,
    [
      [88, 354],
      [62, 274],
      [104, 248],
      [78, 168],
      [146, 100],
      [242, 66],
      [340, 92],
      [398, 166],
      [366, 232],
      [412, 294],
      [356, 368],
      [288, 350],
      [146, 360],
    ],
    '#8EFBFF',
    '#0E85AD',
    '#052942',
    '#C4FCFF',
    5.8
  );
  paintBrushCurve(ctx, 102, 184, 134, 224, 96, 294, 4.8, '#B8FCFF');
  paintBrushCurve(ctx, 370, 186, 336, 240, 378, 308, 5.2, INK);

  const a: CharacterAnatomy = {
    headX: 232,
    headY: 248,
    turnDir: 1,
    tiltRad: 0.08,
    headScale: 1.05,
    jaw: 'square_titan',
    expression: 'boisterous',
    skinLit: '#EEA87E',
    skinMid: '#C2744C',
    skinShadow: '#783B24',
    skinDeep: '#3A1912',
    lipHex: '#944836',
    clothLit: '#2FAAC7',
    clothMid: '#105A78',
    clothDark: '#062238',
    metalLit: '#FFF3B0',
    metalMid: '#EBAA32',
    metalDark: '#66380A',
    eyeOuter: '#00D8FF',
    eyeInner: '#D4FFFF',
    rimHex: '#84F4FF',
    shoulderSpan: 392,
    neckWidth: 58,
    collarStyle: 'chiton_drape',
    pauldronSide: 'right',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  // Rolling sea-foam curling beard & mustache
  paintSculptedRibbon(
    ctx,
    [
      [164, 278],
      [152, 366],
      [196, 444],
      [246, 474],
      [304, 434],
      [326, 350],
      [304, 272],
      [268, 302],
      [226, 296],
      [194, 302],
    ],
    '#70F2FF',
    '#0C7B9E',
    '#042840',
    '#D4FDFF',
    5.4
  );
  paintBrushCurve(ctx, 184, 344, 210, 404, 244, 448, 4.6, '#A8FBFF');
  paintBrushCurve(ctx, 290, 336, 270, 396, 244, 440, 5.0, INK);

  // Jaunty angled Golden Sea-Crown
  ctx.save();
  ctx.translate(232, 162);
  ctx.rotate(0.08);
  ctx.beginPath();
  ctx.moveTo(-70, 14);
  ctx.lineTo(-82, -52);
  ctx.lineTo(-36, -16);
  ctx.lineTo(0, -82);
  ctx.lineTo(36, -16);
  ctx.lineTo(82, -56);
  ctx.lineTo(68, 16);
  ctx.quadraticCurveTo(0, -6, -70, 14);
  ctx.closePath();
  const cG = ctx.createLinearGradient(-72, -80, 72, 16);
  cG.addColorStop(0, '#FFF5B8');
  cG.addColorStop(0.5, '#EBA932');
  cG.addColorStop(1, '#5E3208');
  ctx.fillStyle = cG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.2;
  ctx.stroke();
  ctx.restore();

  // FOREGROUND PROP: Ornate Gilded Trident + Crashing Surf Wave!
  ctx.save();
  ctx.translate(382, 354);
  ctx.rotate(0.24);
  ctx.fillStyle = '#4A2B12';
  ctx.fillRect(-10, -140, 20, 440);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.4;
  ctx.strokeRect(-10, -140, 20, 440);
  ctx.beginPath();
  ctx.moveTo(0, -258);
  ctx.lineTo(16, -168);
  ctx.lineTo(38, -162);
  ctx.lineTo(54, -228);
  ctx.lineTo(64, -140);
  ctx.quadraticCurveTo(38, -112, 12, -124);
  ctx.lineTo(-12, -124);
  ctx.quadraticCurveTo(-38, -112, -64, -140);
  ctx.lineTo(-54, -228);
  ctx.lineTo(-38, -162);
  ctx.lineTo(-16, -168);
  ctx.closePath();
  const trG = ctx.createLinearGradient(-60, -250, 60, -120);
  trG.addColorStop(0, '#FFF8C4');
  trG.addColorStop(0.45, '#F0B63A');
  trG.addColorStop(1, '#6E3E0A');
  ctx.fillStyle = trG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.4;
  ctx.stroke();
  ctx.restore();

  paintForegroundGauntlet(ctx, 360, 464, 0.24, 1.1, '#FFF3B0', '#E5A830', '#5E340A', '#9CF8FF');

  paintBrushCurve(ctx, 18, 560, 146, 468, 286, 566, 22, '#00B8F0', 0.2, 0.2);
  paintBrushCurve(ctx, 26, 550, 148, 464, 280, 554, 9, '#E6FDFF', 0.15, 0.15);
  paintBrushCurve(ctx, 22, 572, 148, 484, 286, 578, 5.5, INK);

  paintMythicFrame(ctx, '#00C8FF');
}

function paintAegira(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#FDBD31',
    highlight: '#FFF6C4',
    deep: '#2A1B05',
    voidCol: '#09060E',
    haloX: 256,
    haloY: 224,
    seed: 303,
    starPoints: 16,
  });

  // Sweeping Ivory Horsehair Plume
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(246, 110);
  ctx.bezierCurveTo(284, 20, 404, 52, 418, 192);
  ctx.bezierCurveTo(428, 288, 392, 364, 344, 404);
  ctx.bezierCurveTo(354, 304, 346, 204, 298, 150);
  ctx.closePath();
  const plG = ctx.createLinearGradient(246, 40, 418, 384);
  plG.addColorStop(0, '#FFFDF5');
  plG.addColorStop(0.5, '#DED0B6');
  plG.addColorStop(0.85, '#735F4C');
  plG.addColorStop(1, INK);
  ctx.fillStyle = plG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.0;
  ctx.stroke();
  paintBrushCurve(ctx, 286, 68, 368, 118, 382, 268, 4.2, '#4E3E30');
  paintBrushCurve(ctx, 302, 102, 362, 168, 360, 324, 3.8, INK);
  ctx.restore();

  const a: CharacterAnatomy = {
    headX: 238,
    headY: 256,
    turnDir: -1,
    tiltRad: -0.04,
    headScale: 1.0,
    jaw: 'aristocratic_sharp',
    expression: 'imperious',
    skinLit: '#C98A62',
    skinMid: '#995A3A',
    skinShadow: '#5E2E1E',
    skinDeep: '#2E120E',
    lipHex: '#7A362C',
    clothLit: '#FFF8E8',
    clothMid: '#D9CCB2',
    clothDark: '#5B4C3E',
    metalLit: '#FFF6BC',
    metalMid: '#F0B232',
    metalDark: '#693B0C',
    eyeOuter: '#F5B824',
    eyeInner: '#FFFAC2',
    rimHex: '#FFE98E',
    shoulderSpan: 344,
    neckWidth: 44,
    collarStyle: 'high_armor',
    pauldronSide: 'both',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  paintSculptedRibbon(
    ctx,
    [
      [284, 274],
      [324, 326],
      [314, 412],
      [274, 396],
      [272, 312],
    ],
    '#41324A',
    '#1D1426',
    '#09060E',
    '#FFE68A',
    4.6
  );

  // Burnished-Gold Winged-Owl Corinthian War Helm
  ctx.save();
  ctx.translate(238, 256);
  ctx.rotate(-0.04);
  const traceHelm = () => {
    ctx.beginPath();
    ctx.moveTo(-76, -12);
    ctx.bezierCurveTo(-86, -88, -46, -148, 16, -148);
    ctx.bezierCurveTo(80, -148, 104, -82, 88, 6);
    ctx.lineTo(58, 70);
    ctx.lineTo(38, 52);
    ctx.lineTo(52, -26);
    ctx.quadraticCurveTo(18, -48, -12, -34);
    ctx.lineTo(-18, 4);
    ctx.lineTo(-26, -34);
    ctx.quadraticCurveTo(-48, -46, -64, -26);
    ctx.lineTo(-62, 42);
    ctx.lineTo(-78, 18);
    ctx.closePath();
  };
  traceHelm();
  const hG = ctx.createLinearGradient(-80, -148, 92, 56);
  hG.addColorStop(0, '#FFFAC8');
  hG.addColorStop(0.32, '#F5BA36');
  hG.addColorStop(0.7, '#995D14');
  hG.addColorStop(1, '#3A1E06');
  ctx.fillStyle = hG;
  ctx.fill();

  ctx.save();
  traceHelm();
  ctx.clip();
  ctx.fillStyle = 'rgba(9, 6, 14, 0.62)';
  ctx.beginPath();
  ctx.moveTo(26, -150);
  ctx.lineTo(110, -150);
  ctx.lineTo(110, 80);
  ctx.lineTo(20, 80);
  ctx.quadraticCurveTo(48, -36, 26, -150);
  ctx.closePath();
  ctx.fill();
  paintBrushCurve(ctx, -56, -92, -12, -132, 48, -110, 6.2, '#FFFEE8');
  ctx.restore();

  traceHelm();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.8;
  ctx.stroke();

  paintBrushCurve(ctx, -18, -56, -46, -80, -68, -70, 3.8, '#542E08');
  paintBrushCurve(ctx, -18, -56, 24, -86, 66, -66, 3.8, '#542E08');
  paintBrushCurve(ctx, -18, -72, 28, -104, 74, -84, 3.4, '#542E08');

  ctx.fillStyle = '#F5BE3E';
  ctx.beginPath();
  ctx.moveTo(-24, -142);
  ctx.quadraticCurveTo(22, -182, 68, -136);
  ctx.quadraticCurveTo(22, -152, -24, -142);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.8;
  ctx.stroke();
  ctx.restore();

  // FOREGROUND PROPS: Golden Aegis Shield + Owl-Crested Spear
  ctx.save();
  ctx.beginPath();
  ctx.arc(416, 486, 164, 0, Math.PI * 2);
  const shG = ctx.createRadialGradient(360, 434, 18, 416, 486, 168);
  shG.addColorStop(0, '#FFFAD0');
  shG.addColorStop(0.38, '#F0B634');
  shG.addColorStop(0.75, '#8F5612');
  shG.addColorStop(1, '#2D1605');
  ctx.fillStyle = shG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.8;
  ctx.stroke();
  ctx.strokeStyle = '#5A320A';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(416, 486, 134, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#FFF0A8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(416, 486, 118, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(72, 420);
  ctx.rotate(-0.26);
  ctx.fillStyle = '#E8AE36';
  ctx.fillRect(-6, -240, 12, 480);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4;
  ctx.strokeRect(-6, -240, 12, 480);
  ctx.beginPath();
  ctx.moveTo(0, -324);
  ctx.lineTo(24, -228);
  ctx.lineTo(0, -246);
  ctx.lineTo(-24, -228);
  ctx.closePath();
  ctx.fillStyle = '#FFF5B8';
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  paintMythicFrame(ctx, '#FDBD31');
}

function paintVelouris(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#FF32E8',
    highlight: '#FFD4FA',
    deep: '#2D0726',
    voidCol: '#09040E',
    haloX: 230,
    haloY: 242,
    seed: 404,
    starPoints: 10,
  });

  // Layered cascading silky rose-magenta hair waves (sculpted multi-tiered silhouette!)
  paintSculptedRibbon(
    ctx,
    [
      [44, PORTRAIT_HEIGHT + 16],
      [26, 430],
      [68, 290],
      [48, 200],
      [118, 108],
      [246, 78],
      [368, 106],
      [432, 224],
      [406, 330],
      [442, 444],
      [414, PORTRAIT_HEIGHT + 16],
    ],
    '#FFD0FA',
    '#EB2EBC',
    '#4A0846',
    '#FFFFFF',
    6.2
  );
  paintBrushCurve(ctx, 94, 210, 66, 366, 108, 550, 7.5, '#FFC2F6');
  paintBrushCurve(ctx, 386, 224, 414, 376, 368, 560, 7.0, '#FF76E4');

  const a: CharacterAnatomy = {
    headX: 242,
    headY: 256,
    turnDir: 1,
    tiltRad: -0.11,
    headScale: 1.0,
    jaw: 'sensual_taper',
    expression: 'alluring',
    skinLit: '#FFE8F2',
    skinMid: '#F0BCD6',
    skinShadow: '#B46D98',
    skinDeep: '#612A54',
    lipHex: '#DB2488',
    clothLit: '#FF7CEB',
    clothMid: '#C01894',
    clothDark: '#3E083A',
    metalLit: '#FFE4FA',
    metalMid: '#F568DF',
    metalDark: '#691264',
    eyeOuter: '#FF2EE2',
    eyeInner: '#FFD0FA',
    rimHex: '#FFBEF7',
    shoulderSpan: 332,
    neckWidth: 40,
    collarStyle: 'plunge_velvet',
    pauldronSide: 'none',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  // Flowing swept bangs & cascading side waves framing cheek
  paintSculptedRibbon(
    ctx,
    [
      [152, 232],
      [194, 146],
      [288, 142],
      [340, 226],
      [318, 392],
      [292, 248],
      [246, 178],
      [176, 224],
    ],
    '#FFD8FA',
    '#EE32C2',
    '#5E0C58',
    '#FFFFFF',
    5.0
  );
  paintHairLock(ctx, 176, 178, 118, 250, 128, 390, 164, 274, '#FFC2F6', '#D624AC', '#480844', '#FFFFFF');

  // FOREGROUND PROP: Silken Magenta Ribbons & Hand-Inked Layered Crimson Roses + Petals!
  paintBrushCurve(ctx, 18, 594, 134, 476, 78, 336, 14, '#FF54DE', 0.25, 0.15);
  paintBrushCurve(ctx, 22, 590, 130, 476, 78, 336, 4.5, '#FFD8FA', 0.15, 0.1);
  paintBrushCurve(ctx, 464, 578, 354, 464, 408, 326, 13, '#FF54DE', 0.25, 0.15);

  const paintRose = (rx: number, ry: number, r: number) => {
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI * 2) / 6 - 0.25;
      ctx.fillStyle = i % 2 === 0 ? '#D91480' : '#FF4AC2';
      ctx.beginPath();
      ctx.ellipse(rx + Math.cos(ang) * r * 0.48, ry + Math.sin(ang) * r * 0.48, r * 0.56, r * 0.4, ang, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.0;
      ctx.stroke();
    }
    ctx.fillStyle = '#FF9EF0';
    ctx.beginPath();
    ctx.arc(rx, ry, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = '#6B0848';
    ctx.beginPath();
    ctx.arc(rx + 1.5, ry + 1.5, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  paintRose(304, 174, 28);
  paintRose(334, 220, 20);
  paintRose(142, 444, 26);
  paintRose(376, 488, 22);

  for (const [px, py, rot, sz] of [
    [82, 176, 0.4, 13],
    [412, 232, -0.6, 11],
    [104, 526, 0.9, 14],
    [354, 548, -0.3, 12],
  ]) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.fillStyle = '#FF7CE8';
    ctx.beginPath();
    ctx.moveTo(0, -sz);
    ctx.quadraticCurveTo(sz * 0.9, 0, 0, sz);
    ctx.quadraticCurveTo(-sz * 0.9, 0, 0, -sz);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
  }

  paintMythicFrame(ctx, '#FF32E8');
}

function paintSylvara(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#6EFF00',
    highlight: '#D6FFB8',
    deep: '#08220C',
    voidCol: '#050C07',
    haloX: 256,
    haloY: 234,
    seed: 505,
    starPoints: 8,
  });

  for (let i = 0; i < 3; i++) {
    paintBrushCurve(ctx, 368 + i * 18, 260 + i * 16, 344 + i * 16, 314 + i * 14, 320 + i * 14, 368 + i * 12, 6.5, INK);
    paintBrushCurve(ctx, 368 + i * 18, 260 + i * 16, 344 + i * 16, 314 + i * 14, 320 + i * 14, 368 + i * 12, 3.2, '#7CFF24');
  }

  // Deep Hooded Forest-Emerald Hunter Mantle
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(86, 456);
  ctx.bezierCurveTo(68, 200, 148, 72, 256, 76);
  ctx.bezierCurveTo(364, 80, 412, 218, 384, 456);
  ctx.closePath();
  const hoodG = ctx.createLinearGradient(88, 76, 386, 456);
  hoodG.addColorStop(0, '#3C9446');
  hoodG.addColorStop(0.45, '#164622');
  hoodG.addColorStop(0.8, '#081D0F');
  hoodG.addColorStop(1, INK);
  ctx.fillStyle = hoodG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.5;
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(248, 258, 102, 134, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const a: CharacterAnatomy = {
    headX: 252,
    headY: 258,
    turnDir: -1,
    tiltRad: -0.06,
    headScale: 0.98,
    jaw: 'aristocratic_sharp',
    expression: 'focused',
    skinLit: '#F7D4BA',
    skinMid: '#D09B7A',
    skinShadow: '#824E3A',
    skinDeep: '#3E1D16',
    lipHex: '#A05248',
    clothLit: '#48B552',
    clothMid: '#1C5E28',
    clothDark: '#0A2210',
    metalLit: '#E4FFCC',
    metalMid: '#7BE044',
    metalDark: '#205218',
    eyeOuter: '#6EFF00',
    eyeInner: '#E4FFC2',
    rimHex: '#BAFF82',
    shoulderSpan: 344,
    neckWidth: 42,
    collarStyle: 'chiton_drape',
    pauldronSide: 'left',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  // Layered windblown auburn hunter bangs & side locks
  paintSculptedRibbon(
    ctx,
    [
      [172, 212],
      [208, 146],
      [304, 158],
      [340, 260],
      [322, 382],
      [294, 256],
      [252, 180],
      [182, 224],
    ],
    '#CF784A',
    '#7E3C20',
    '#290F0A',
    '#C4FF8C',
    4.8
  );
  paintHairLock(ctx, 212, 168, 164, 198, 146, 258, 192, 204, '#E28A58', '#8C4422', '#2E120A', '#D0FFA0');

  // Silver Crescent Moon Circlet
  ctx.save();
  ctx.fillStyle = '#ECF8E4';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.arc(236, 174, 25, 0.35 * Math.PI, 1.65 * Math.PI);
  ctx.quadraticCurveTo(234, 174, 248, 195);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // FOREGROUND PROP: Recurve Spirit-Bow + Gloved Hand Drawing Luminous Emerald Arrow!
  ctx.save();
  paintBrushCurve(ctx, 108, 118, 22, 276, 126, 594, 20, INK);
  paintBrushCurve(ctx, 108, 118, 22, 276, 126, 594, 10, '#A86E38');
  paintBrushCurve(ctx, 102, 126, 26, 276, 118, 586, 3.6, '#A6FF68');

  ctx.strokeStyle = '#B8FF8C';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(108, 122);
  ctx.lineTo(298, 434);
  ctx.lineTo(126, 590);
  ctx.stroke();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(306, 436);
  ctx.lineTo(24, 382);
  ctx.stroke();
  ctx.strokeStyle = '#8CFF38';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = '#E6FFCC';
  ctx.beginPath();
  ctx.moveTo(10, 380);
  ctx.lineTo(52, 368);
  ctx.lineTo(42, 386);
  ctx.lineTo(48, 404);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  paintForegroundGauntlet(ctx, 314, 466, -0.35, 0.92, '#56B85E', '#1E5E28', '#0A2210', '#BAFF82');

  paintMythicFrame(ctx, '#6EFF00');
}

function paintBellum(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#FF1808',
    highlight: '#FF9888',
    deep: '#290407',
    voidCol: '#090306',
    haloX: 236,
    haloY: 236,
    seed: 606,
    starPoints: 16,
  });

  // Back-mounted jagged war blade
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(210, 410);
  ctx.lineTo(66, 84);
  ctx.lineTo(104, 118);
  ctx.lineTo(244, 424);
  ctx.closePath();
  ctx.fillStyle = '#2B0D14';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.8;
  ctx.stroke();
  paintBrushCurve(ctx, 198, 396, 134, 240, 74, 98, 4.2, '#FF3E2E');
  ctx.restore();

  const a: CharacterAnatomy = {
    headX: 236,
    headY: 256,
    turnDir: 1,
    tiltRad: 0.06,
    headScale: 1.05,
    jaw: 'square_titan',
    expression: 'fierce',
    skinLit: '#B88D88',
    skinMid: '#825756',
    skinShadow: '#47252A',
    skinDeep: '#1E0B10',
    lipHex: '#5A2228',
    clothLit: '#D41C22',
    clothMid: '#6E0A12',
    clothDark: '#1A0408',
    metalLit: '#FFBAA4',
    metalMid: '#A62022',
    metalDark: '#26060A',
    eyeOuter: '#FF1400',
    eyeInner: '#FFB8A8',
    rimHex: '#FF6A58',
    shoulderSpan: 392,
    neckWidth: 58,
    collarStyle: 'high_armor',
    pauldronSide: 'both',
    warPaint: 'bellum_crimson',
    scar: true,
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  // Cohesive sculpted ash-white & obsidian swept warlord hair crown + dynamic outer spikes
  paintSculptedRibbon(
    ctx,
    [
      [164, 224],
      [146, 174],
      [166, 124],
      [234, 96],
      [304, 120],
      [326, 176],
      [314, 232],
      [294, 192],
      [244, 170],
      [186, 184],
    ],
    '#E8E6EE',
    '#4C3D46',
    '#120A12',
    '#FF7868',
    4.8
  );
  paintHairLock(ctx, 174, 200, 128, 152, 118, 98, 178, 134, '#F5F7FA', '#5C4A52', '#120A12', '#FF7868');
  paintHairLock(ctx, 212, 174, 176, 108, 184, 48, 232, 106, '#FFFFFF', '#5C4A52', '#120A12', '#FF9888');
  paintHairLock(ctx, 248, 174, 256, 102, 286, 56, 286, 124, '#EAECEF', '#44363E', '#100810', '#FF6858');
  paintHairLock(ctx, 286, 184, 334, 134, 362, 112, 326, 182, '#C8C4CC', '#382C34', '#0E070E');
  paintHairLock(ctx, 306, 208, 344, 198, 358, 246, 314, 232, '#8A7A84', '#281E26', '#0A050B');

  // Blood-red forehead war sigil
  ctx.fillStyle = '#FF1E10';
  ctx.beginPath();
  ctx.moveTo(250, 194);
  ctx.lineTo(259, 214);
  ctx.lineTo(250, 234);
  ctx.lineTo(241, 214);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.stroke();

  // FOREGROUND PROP: Serrated Blood-Runed Obsidian War-Blade
  ctx.save();
  ctx.translate(384, 420);
  ctx.rotate(0.18);
  ctx.beginPath();
  ctx.moveTo(-26, 40);
  ctx.lineTo(-22, -236);
  ctx.lineTo(4, -296);
  ctx.lineTo(28, -214);
  ctx.lineTo(14, -184);
  ctx.lineTo(30, -142);
  ctx.lineTo(14, -110);
  ctx.lineTo(26, 40);
  ctx.closePath();
  const blG = ctx.createLinearGradient(-26, -280, 30, 40);
  blG.addColorStop(0, '#58444E');
  blG.addColorStop(0.45, '#1D1218');
  blG.addColorStop(1, INK);
  ctx.fillStyle = blG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.4;
  ctx.stroke();
  paintBrushCurve(ctx, -2, -252, -2, -120, -2, 20, 6.2, '#FF2818');
  paintBrushCurve(ctx, -2, -244, -2, -120, -2, 12, 2.2, '#FFE0A0');
  ctx.restore();

  paintForegroundGauntlet(ctx, 376, 514, 0.18, 1.12, '#C83434', '#5A1016', '#1A0408', '#FF7868');

  paintMythicFrame(ctx, '#FF1808');
}

function paintBacchion(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#C800FF',
    highlight: '#F0B4FF',
    deep: '#20052E',
    voidCol: '#090310',
    haloX: 256,
    haloY: 244,
    seed: 707,
    starPoints: 12,
  });

  // Layered wavy dark-violet revelry curls (broken locks, NOT a mushroom bob!)
  paintSculptedRibbon(
    ctx,
    [
      [96, 386],
      [74, 300],
      [104, 240],
      [88, 168],
      [148, 114],
      [242, 82],
      [338, 114],
      [392, 186],
      [368, 256],
      [396, 336],
      [352, 404],
      [292, 366],
      [158, 368],
    ],
    '#9438D6',
    '#3E0E6E',
    '#120324',
    '#EE9EFF',
    5.8
  );

  const a: CharacterAnatomy = {
    headX: 240,
    headY: 260,
    turnDir: -1,
    tiltRad: -0.09,
    headScale: 1.02,
    jaw: 'relaxed_broad',
    expression: 'smirk',
    skinLit: '#E6A882',
    skinMid: '#BA7654',
    skinShadow: '#733B28',
    skinDeep: '#3A1A14',
    lipHex: '#9A4844',
    clothLit: '#BA3CF2',
    clothMid: '#621492',
    clothDark: '#1E0636',
    metalLit: '#FFF2AC',
    metalMid: '#E8A930',
    metalDark: '#66380C',
    eyeOuter: '#CC2EFF',
    eyeInner: '#F6C2FF',
    rimHex: '#F0A4FF',
    shoulderSpan: 374,
    neckWidth: 52,
    collarStyle: 'plunge_velvet',
    pauldronSide: 'left',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  // Foreground tousled curly violet locks sweeping across forehead & ears!
  paintHairLock(ctx, 212, 158, 152, 188, 134, 258, 188, 206, '#B854FF', '#581694', '#1A0432', '#F2B8FF');
  paintHairLock(ctx, 276, 164, 332, 206, 338, 294, 296, 224, '#8A2CD6', '#3A0C66', '#120324');
  paintHairLock(ctx, 240, 152, 214, 184, 198, 208, 238, 184, '#A844F2', '#4C1282', '#16042A');

  // Sculpted Crown of Emerald Ivy Leaves & Amethyst Grape Clusters
  ctx.save();
  for (const [lx, ly, ang] of [
    [176, 178, -0.5],
    [214, 156, -0.15],
    [258, 154, 0.15],
    [298, 174, 0.5],
  ] as const) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(ang);
    ctx.fillStyle = '#38C858';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.quadraticCurveTo(16, -6, 12, 14);
    ctx.lineTo(0, 8);
    ctx.lineTo(-12, 14);
    ctx.quadraticCurveTo(-16, -6, 0, -18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.restore();
  }
  for (const [gx, gy, col] of [
    [164, 200, '#C828FF'],
    [174, 218, '#E67EFF'],
    [156, 218, '#8E14CC'],
    [310, 198, '#C828FF'],
    [300, 218, '#E67EFF'],
    [318, 216, '#8E14CC'],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(gx, gy, 11.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.0;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(gx - 3.5, gy - 3.5, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // FOREGROUND PROP: Tilted Jeweled Golden Goblet & Splashing Violet Wine!
  ctx.save();
  ctx.translate(384, 492);
  ctx.rotate(-0.24);
  const chG = ctx.createLinearGradient(-44, -42, 44, 68);
  chG.addColorStop(0, '#FFF5B8');
  chG.addColorStop(0.45, '#EDB034');
  chG.addColorStop(1, '#5E3208');
  ctx.fillStyle = chG;
  ctx.beginPath();
  ctx.moveTo(-44, -40);
  ctx.lineTo(44, -40);
  ctx.quadraticCurveTo(32, 18, 9, 26);
  ctx.lineTo(26, 72);
  ctx.lineTo(-26, 72);
  ctx.lineTo(-9, 26);
  ctx.quadraticCurveTo(-32, 18, -44, -40);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.2;
  ctx.stroke();
  ctx.fillStyle = '#DF42FF';
  ctx.beginPath();
  ctx.ellipse(0, -40, 38, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();
  paintBrushCurve(ctx, -34, -44, -68, -78, -94, -34, 9.5, '#E85CFF');
  paintBrushCurve(ctx, -34, -46, -68, -78, -92, -36, 3.6, '#FFFFFF');
  ctx.restore();

  paintMythicFrame(ctx, '#C800FF');
}

function paintGlaciera(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#60BDFF',
    highlight: '#E0F6FF',
    deep: '#07192E',
    voidCol: '#040914',
    haloX: 230,
    haloY: 234,
    seed: 808,
    starPoints: 12,
  });

  // Braided silver-frost tresses cascading beneath ice mantle
  paintSculptedRibbon(
    ctx,
    [
      [88, 420],
      [78, 240],
      [148, 114],
      [246, 86],
      [352, 122],
      [398, 264],
      [378, 438],
      [298, 384],
      [164, 384],
    ],
    '#FFFFFF',
    '#C4D8EE',
    '#4A648A',
    '#D8F6FF',
    5.8
  );

  const a: CharacterAnatomy = {
    headX: 238,
    headY: 256,
    turnDir: 1,
    tiltRad: 0.04,
    headScale: 1.0,
    jaw: 'aristocratic_sharp',
    expression: 'austere',
    skinLit: '#F0F6FC',
    skinMid: '#C4D6EC',
    skinShadow: '#768FB4',
    skinDeep: '#324468',
    lipHex: '#7A8CB0',
    clothLit: '#ACE0FF',
    clothMid: '#3A76AC',
    clothDark: '#102642',
    metalLit: '#FFFFFF',
    metalMid: '#8AD4FF',
    metalDark: '#265480',
    eyeOuter: '#44CCFF',
    eyeInner: '#E8FCFF',
    rimHex: '#D8F6FF',
    shoulderSpan: 348,
    neckWidth: 42,
    collarStyle: 'high_armor',
    pauldronSide: 'both',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  // Sculpted silver temple braids
  paintSculptedRibbon(
    ctx,
    [
      [166, 206],
      [216, 146],
      [302, 160],
      [326, 266],
      [296, 222],
      [244, 178],
      [178, 218],
    ],
    '#FFFFFF',
    '#D6E8FA',
    '#6682AA',
    '#FFFFFF',
    4.6
  );

  // Faceted Crystalline Glacial Diadem (beveled crystal prism facets!)
  ctx.save();
  const shards: readonly [number, number, number, number][] = [
    [164, 180, 142, 106],
    [194, 164, 186, 74],
    [238, 156, 238, 46],
    [282, 164, 294, 72],
    [314, 180, 340, 108],
  ];
  for (const [bx, by, tx, ty] of shards) {
    ctx.beginPath();
    ctx.moveTo(bx - 16, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 16, by);
    ctx.closePath();
    const sG = ctx.createLinearGradient(bx - 16, ty, bx + 16, by);
    sG.addColorStop(0, '#FFFFFF');
    sG.addColorStop(0.5, '#8EE0FF');
    sG.addColorStop(1, '#265C8E');
    ctx.fillStyle = sG;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.2;
    ctx.stroke();
  }
  ctx.restore();

  // FOREGROUND PROP: Translucent Frosted Veil + Swirling Icy Breath Mist & Faceted Ice Shards
  ctx.save();
  const mist = ctx.createLinearGradient(20, 480, 460, 360);
  mist.addColorStop(0, 'rgba(180, 240, 255, 0.34)');
  mist.addColorStop(0.5, 'rgba(230, 250, 255, 0.14)');
  mist.addColorStop(1, 'rgba(120, 210, 255, 0.32)');
  ctx.fillStyle = mist;
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.bezierCurveTo(140, 410, 320, 490, 480, 356);
  ctx.lineTo(480, 434);
  ctx.bezierCurveTo(320, 560, 140, 490, 0, 600);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#E6F8FF';
  ctx.lineWidth = 3.2;
  for (const [fx, fy, r] of [
    [72, 168, 20],
    [414, 198, 18],
    [88, 494, 24],
    [396, 468, 16],
  ]) {
    for (let k = 0; k < 3; k++) {
      const ang = (k * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(fx - Math.cos(ang) * r, fy - Math.sin(ang) * r);
      ctx.lineTo(fx + Math.cos(ang) * r, fy + Math.sin(ang) * r);
      ctx.stroke();
    }
  }
  ctx.restore();

  paintMythicFrame(ctx, '#60BDFF');
}

function paintVeloce(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#FF6A00',
    highlight: '#FFD29E',
    deep: '#2D1105',
    voidCol: '#090406',
    haloX: 256,
    haloY: 236,
    seed: 909,
    starPoints: 16,
  });

  ctx.save();
  for (let i = 0; i < 8; i++) {
    paintBrushCurve(
      ctx,
      14,
      118 + i * 64,
      240,
      86 + i * 64,
      468,
      48 + i * 64,
      i % 2 === 0 ? 7.5 : 4.2,
      i % 2 === 0 ? 'rgba(255, 168, 56, 0.52)' : 'rgba(255, 240, 180, 0.38)'
    );
  }
  ctx.restore();

  const a: CharacterAnatomy = {
    headX: 250,
    headY: 258,
    turnDir: -1,
    tiltRad: -0.1,
    headScale: 0.99,
    jaw: 'sculpted_youth',
    expression: 'smirk',
    skinLit: '#F8D0A8',
    skinMid: '#D0946A',
    skinShadow: '#824A30',
    skinDeep: '#3E1C12',
    lipHex: '#9E503E',
    clothLit: '#FF8A34',
    clothMid: '#C04210',
    clothDark: '#3A1206',
    metalLit: '#FFF2AC',
    metalMid: '#F2AA30',
    metalDark: '#6C3A0A',
    eyeOuter: '#FF9418',
    eyeInner: '#FFF4A8',
    rimHex: '#FFCF82',
    shoulderSpan: 344,
    neckWidth: 44,
    collarStyle: 'chiton_drape',
    pauldronSide: 'left',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  // Windblown tousled auburn bangs
  paintHairLock(ctx, 212, 184, 164, 198, 152, 232, 198, 210, '#E07034', '#8A3614', '#2C0E06', '#FFCF78');
  paintHairLock(ctx, 276, 184, 326, 206, 336, 266, 294, 224, '#C85E28', '#702A10', '#240B06');

  // Sculpted Contoured Burnished-Bronze Winged Swift-Helm (with brow ridge & cheek flares!)
  ctx.save();
  ctx.translate(250, 258);
  ctx.rotate(-0.1);
  ctx.beginPath();
  ctx.moveTo(-78, -36);
  ctx.bezierCurveTo(-82, -126, -34, -158, 14, -156);
  ctx.bezierCurveTo(66, -152, 88, -110, 82, -36);
  ctx.lineTo(54, -56);
  ctx.quadraticCurveTo(2, -78, -50, -56);
  ctx.closePath();
  const hG = ctx.createLinearGradient(-76, -154, 80, -36);
  hG.addColorStop(0, '#FFF6BE');
  hG.addColorStop(0.45, '#E89828');
  hG.addColorStop(0.85, '#5E2E08');
  hG.addColorStop(1, INK);
  ctx.fillStyle = hG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.4;
  ctx.stroke();
  paintBrushCurve(ctx, -56, -86, 4, -126, 58, -96, 4.8, '#FFFBE0');

  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(dir * 62, -74);
    ctx.quadraticCurveTo(dir * 136, -152, dir * 176, -182);
    ctx.quadraticCurveTo(dir * 158, -118, dir * 124, -84);
    ctx.quadraticCurveTo(dir * 144, -82, dir * 92, -56);
    ctx.closePath();
    const wG = ctx.createLinearGradient(dir * 62, -176, dir * 170, -56);
    wG.addColorStop(0, '#FFFDF2');
    wG.addColorStop(0.6, '#F5DEC0');
    wG.addColorStop(1, '#A67A50');
    ctx.fillStyle = wG;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.8;
    ctx.stroke();
    paintBrushCurve(ctx, dir * 74, -78, dir * 118, -122, dir * 162, -162, 3.0, INK);
    paintBrushCurve(ctx, dir * 74, -70, dir * 108, -98, dir * 138, -118, 2.6, INK);
  }
  ctx.restore();

  // FOREGROUND PROP: Golden Winged Herald Staff + Kinetic Speed Ribbon
  ctx.save();
  ctx.translate(96, 472);
  ctx.rotate(-0.34);
  ctx.fillStyle = '#E8A832';
  ctx.fillRect(-6, -190, 12, 340);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.6;
  ctx.strokeRect(-6, -190, 12, 340);
  ctx.fillStyle = '#FFF5C4';
  ctx.beginPath();
  ctx.moveTo(0, -176);
  ctx.quadraticCurveTo(-56, -216, -68, -176);
  ctx.quadraticCurveTo(-36, -156, 0, -160);
  ctx.quadraticCurveTo(36, -156, 68, -176);
  ctx.quadraticCurveTo(56, -216, 0, -176);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  paintBrushCurve(ctx, 14, 514, 210, 424, 466, 488, 12, '#FF9E38', 0.15, 0.15);
  paintBrushCurve(ctx, 18, 508, 210, 422, 462, 482, 4.2, '#FFF2B8', 0.1, 0.1);

  paintMythicFrame(ctx, '#FF6A00');
}

function paintAbyssos(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#7224FF',
    highlight: '#D6BEFF',
    deep: '#100326',
    voidCol: '#04010A',
    haloX: 240,
    haloY: 256,
    seed: 1010,
    starPoints: 8,
  });

  ctx.save();
  ctx.strokeStyle = '#DFC0FF';
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.ellipse(240, 260, 198, 72, -0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#F5C452';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(240, 260, 178, 56, 0.48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Star-Strewn Cosmic Nebula Shroud
  ctx.save();
  const traceShroud = () => {
    ctx.beginPath();
    ctx.moveTo(58, PORTRAIT_HEIGHT + 12);
    ctx.bezierCurveTo(44, 344, 96, 94, 244, 80);
    ctx.bezierCurveTo(392, 94, 438, 344, 422, PORTRAIT_HEIGHT + 12);
    ctx.closePath();
  };
  traceShroud();
  const nebG = ctx.createLinearGradient(64, 80, 416, PORTRAIT_HEIGHT);
  nebG.addColorStop(0, '#5E1EE0');
  nebG.addColorStop(0.45, '#1D064A');
  nebG.addColorStop(1, '#060212');
  ctx.fillStyle = nebG;
  ctx.fill();
  ctx.save();
  traceShroud();
  ctx.clip();
  const rand = seededRand(1011);
  for (let i = 0; i < 48; i++) {
    ctx.fillStyle = i % 3 === 0 ? '#FFE8A6' : '#E2C8FF';
    ctx.globalAlpha = 0.35 + rand() * 0.65;
    ctx.beginPath();
    ctx.arc(60 + rand() * 360, 90 + rand() * 520, 1 + rand() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  traceShroud();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.5;
  ctx.stroke();
  ctx.restore();

  const a: CharacterAnatomy = {
    headX: 242,
    headY: 244,
    turnDir: -1,
    tiltRad: 0.05,
    headScale: 0.96,
    jaw: 'elongated_ethereal',
    expression: 'surreal',
    skinLit: '#EFE6FF',
    skinMid: '#B59EEB',
    skinShadow: '#593D9E',
    skinDeep: '#1E0D48',
    lipHex: '#563298',
    clothLit: '#7C36FF',
    clothMid: '#340C80',
    clothDark: '#0D0322',
    metalLit: '#FFF2BC',
    metalMid: '#DCA63E',
    metalDark: '#48280E',
    eyeOuter: '#9A48FF',
    eyeInner: '#FFFFFF',
    scleraHex: '#180834',
    pupilSlit: true,
    rimHex: '#DFC2FF',
    shoulderSpan: 342,
    neckWidth: 38,
    collarStyle: 'shroud_void',
    pauldronSide: 'none',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  const paintVoidEye = (ex: number, ey: number, rx: number, ry: number) => {
    ctx.save();
    ctx.fillStyle = '#090414';
    ctx.beginPath();
    ctx.moveTo(ex - rx, ey);
    ctx.quadraticCurveTo(ex, ey - ry * 1.35, ex + rx, ey);
    ctx.quadraticCurveTo(ex, ey + ry * 1.35, ex - rx, ey);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#F2BE52';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    const g = ctx.createRadialGradient(ex, ey, 2, ex, ey, ry * 0.9);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.45, '#C074FF');
    g.addColorStop(1, '#4C1299');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx * 0.44, ry * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx * 0.13, ry * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  paintVoidEye(236, 186, 26, 12);
  paintVoidEye(92, 188, 32, 15);
  paintVoidEye(392, 294, 30, 14);

  // FOREGROUND PROP: Twin Ringed Cosmic Hands Cradling Hovering Void Eye
  const galGlow = ctx.createRadialGradient(240, 496, 8, 240, 496, 86);
  galGlow.addColorStop(0, '#FFFFFF');
  galGlow.addColorStop(0.28, '#B86CFF');
  galGlow.addColorStop(0.62, 'rgba(100, 25, 255, 0.45)');
  galGlow.addColorStop(1, 'rgba(9, 6, 14, 0)');
  ctx.fillStyle = galGlow;
  ctx.beginPath();
  ctx.arc(240, 496, 86, 0, Math.PI * 2);
  ctx.fill();
  paintVoidEye(240, 496, 40, 19);

  for (const dir of [-1, 1] as const) {
    ctx.save();
    ctx.translate(240 + dir * 102, 524);
    ctx.scale(dir, 1);
    ctx.beginPath();
    ctx.moveTo(46, 80);
    ctx.quadraticCurveTo(22, 26, -8, -18);
    ctx.lineTo(-22, -26);
    ctx.lineTo(-4, 6);
    ctx.lineTo(-28, 2);
    ctx.lineTo(-6, 24);
    ctx.lineTo(-24, 30);
    ctx.quadraticCurveTo(4, 54, 14, 92);
    ctx.closePath();
    ctx.fillStyle = dir < 0 ? '#DCCEFF' : '#8A70C8';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.4;
    ctx.stroke();
    ctx.restore();
  }

  paintMythicFrame(ctx, '#7224FF');
}

function paintPrincePyreus(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#E6343E',
    highlight: '#FFAC70',
    deep: '#2A0810',
    voidCol: '#09040A',
    haloX: 224,
    haloY: 244,
    seed: 1111,
    starPoints: 10,
  });

  // Billowing crimson chlamys cloak flare
  paintSculptedRibbon(
    ctx,
    [
      [40, 646],
      [26, 444],
      [92, 344],
      [188, 352],
      [164, 646],
    ],
    '#F02C3C',
    '#9E1224',
    '#2C050E',
    '#FF9868',
    5.8
  );

  const a: CharacterAnatomy = {
    headX: 236,
    headY: 256,
    turnDir: 1,
    tiltRad: -0.07,
    headScale: 1.01,
    jaw: 'sculpted_youth',
    expression: 'smirk',
    skinLit: '#F8CCA8',
    skinMid: '#D4946E',
    skinShadow: '#824834',
    skinDeep: '#3E1C16',
    lipHex: '#A25446',
    clothLit: '#EC2C3C',
    clothMid: '#981224',
    clothDark: '#2A0610',
    metalLit: '#FFF2AE',
    metalMid: '#E8AC38',
    metalDark: '#66380C',
    eyeOuter: '#FF2A24',
    eyeInner: '#FFB894',
    eyeRightOuter: '#28E888',
    eyeRightInner: '#E4FFE6',
    rimHex: '#FF8A58',
    shoulderSpan: 356,
    neckWidth: 46,
    collarStyle: 'chiton_drape',
    pauldronSide: 'left',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  // Cohesive sculpted wild raven-black hair crown base + fiery-ember rimmed spikes!
  paintSculptedRibbon(
    ctx,
    [
      [160, 230],
      [142, 174],
      [168, 122],
      [234, 98],
      [298, 118],
      [322, 178],
      [308, 236],
      [288, 194],
      [238, 172],
      [182, 192],
    ],
    '#4A2438',
    '#1F1228',
    INK,
    '#FF9860',
    4.8
  );
  paintHairLock(ctx, 174, 212, 118, 178, 92, 144, 152, 150, '#FF7838', '#26182E', INK, '#FFB878');
  paintHairLock(ctx, 198, 184, 134, 118, 128, 62, 196, 112, '#FF642C', '#24152C', INK, '#FFA468');
  paintHairLock(ctx, 232, 172, 206, 98, 224, 42, 260, 108, '#FF5C28', '#221428', INK, '#FF985C');
  paintHairLock(ctx, 268, 178, 294, 108, 336, 76, 304, 146, '#E84C24', '#1E1226', INK, '#FF884E');
  paintHairLock(ctx, 294, 196, 344, 158, 378, 148, 326, 202, '#4A2438', '#1A1022', INK);
  paintHairLock(ctx, 298, 216, 336, 228, 328, 286, 294, 246, '#301A2C', '#120A1A', INK);
  // Swept dark bangs curling down toward brow
  paintHairLock(ctx, 236, 170, 204, 196, 182, 222, 224, 194, '#38223C', '#160E1E', INK);

  // Sculpted Burnished-Gold Laurel Wreath Crown
  ctx.save();
  for (let i = -4; i <= 4; i++) {
    const ang = -Math.PI * 0.5 + i * 0.23;
    const lx = 238 + Math.cos(ang) * 78;
    const ly = 216 + Math.sin(ang) * 52;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(ang + 0.72);
    ctx.fillStyle = i % 2 === 0 ? '#FFE26A' : '#E8AE30';
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.0;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // FOREGROUND PROP: Raised Crimson-Runed Stygian Blade Edge + Gauntlet!
  ctx.save();
  ctx.translate(392, 434);
  ctx.rotate(0.28);
  ctx.beginPath();
  ctx.moveTo(-20, 74);
  ctx.quadraticCurveTo(-24, -100, -16, -210);
  ctx.lineTo(0, -274);
  ctx.lineTo(18, -206);
  ctx.quadraticCurveTo(24, -96, 20, 74);
  ctx.closePath();
  const swG = ctx.createLinearGradient(-22, -260, 22, 60);
  swG.addColorStop(0, '#F5F8FF');
  swG.addColorStop(0.45, '#8A98B2');
  swG.addColorStop(0.7, '#2A3042');
  swG.addColorStop(1, INK);
  ctx.fillStyle = swG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.4;
  ctx.stroke();
  paintBrushCurve(ctx, 0, -220, 0, -80, 0, 54, 5.2, '#FF3242');
  paintBrushCurve(ctx, -11, -212, -14, -84, -12, 48, 2.8, '#FFFFFF');
  ctx.fillStyle = '#F0B63A';
  ctx.beginPath();
  ctx.moveTo(-48, 72);
  ctx.lineTo(48, 72);
  ctx.lineTo(34, 92);
  ctx.lineTo(-34, 92);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.6;
  ctx.stroke();
  ctx.restore();

  paintForegroundGauntlet(ctx, 366, 542, 0.28, 1.0, '#E8A838', '#981626', '#280610', '#FFA878');

  for (const [ex, ey, r] of [
    [68, 224, 5],
    [118, 464, 6],
    [418, 174, 4.5],
    [318, 530, 5.5],
  ]) {
    ctx.fillStyle = '#FF9C38';
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF8C4';
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  paintMythicFrame(ctx, '#E6343E');
}

function paintWardenMalice(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#D42EFF',
    highlight: '#FF7EC4',
    deep: '#200628',
    voidCol: '#07030C',
    haloX: 256,
    haloY: 238,
    seed: 1212,
    starPoints: 10,
  });

  // Dramatic Ribbed Gothic Bat-Wings arcing behind shoulders
  for (const [dir, spread] of [
    [-1, 1.05],
    [1, 0.96],
  ] as const) {
    ctx.save();
    const traceWing = () => {
      ctx.beginPath();
      ctx.moveTo(240 + dir * 56, 396);
      ctx.bezierCurveTo(
        240 + dir * (142 * spread),
        214,
        240 + dir * (206 * spread),
        138,
        240 + dir * (232 * spread),
        198
      );
      ctx.quadraticCurveTo(240 + dir * (198 * spread), 288, 240 + dir * (212 * spread), 358);
      ctx.quadraticCurveTo(240 + dir * (162 * spread), 344, 240 + dir * (148 * spread), 468);
      ctx.closePath();
    };
    traceWing();
    const wG = ctx.createLinearGradient(240, 148, 240 + dir * 230, 444);
    wG.addColorStop(0, '#6B1C84');
    wG.addColorStop(0.45, '#260A38');
    wG.addColorStop(1, INK);
    ctx.fillStyle = wG;
    ctx.fill();
    ctx.save();
    traceWing();
    ctx.clip();
    paintInkHatchCluster(ctx, 240 + dir * 130, 260, 7, 36, 11, dir * 0.6, 0.44, 1.5);
    ctx.restore();
    traceWing();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6.0;
    ctx.stroke();
    paintBrushCurve(
      ctx,
      240 + dir * 64,
      362,
      240 + dir * (148 * spread),
      216,
      240 + dir * (222 * spread),
      198,
      4.5,
      '#FF4ED8'
    );
    ctx.restore();
  }

  const a: CharacterAnatomy = {
    headX: 248,
    headY: 254,
    turnDir: -1,
    tiltRad: -0.09,
    headScale: 0.98,
    jaw: 'aristocratic_sharp',
    expression: 'fierce',
    skinLit: '#F2E6FA',
    skinMid: '#CCB4E0',
    skinShadow: '#765498',
    skinDeep: '#341D4E',
    lipHex: '#9C164A',
    clothLit: '#CC245A',
    clothMid: '#6A103A',
    clothDark: '#1A0518',
    metalLit: '#FFEAA0',
    metalMid: '#E6A836',
    metalDark: '#5E340C',
    eyeOuter: '#FF1858',
    eyeInner: '#FFB8D6',
    rimHex: '#FF60E0',
    shoulderSpan: 340,
    neckWidth: 40,
    collarStyle: 'corset_spike',
    pauldronSide: 'both',
  };

  paintComicTorso(ctx, a);
  paintComicHead(ctx, a);

  // Swept asymmetrical raven-violet executioner locks cascading past right cheek
  paintSculptedRibbon(
    ctx,
    [
      [164, 224],
      [196, 146],
      [292, 146],
      [338, 234],
      [318, 372],
      [292, 230],
      [244, 174],
      [182, 200],
    ],
    '#5C267A',
    '#200B34',
    '#090412',
    '#FF66E2',
    5.0
  );
  paintHairLock(ctx, 294, 178, 354, 242, 344, 384, 306, 266, '#6E2A92', '#260B3C', INK, '#FF76E6');

  // Curved Twin Obsidian & Gold Executioner Horns
  ctx.save();
  ctx.translate(248, 254);
  ctx.rotate(-0.09);
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(dir * 30, -68);
    ctx.bezierCurveTo(dir * 86, -86, dir * 102, -144, dir * 74, -184);
    ctx.bezierCurveTo(dir * 72, -138, dir * 50, -104, dir * 8, -80);
    ctx.closePath();
    const hG = ctx.createLinearGradient(dir * 12, -180, dir * 86, -68);
    hG.addColorStop(0, '#FFE494');
    hG.addColorStop(0.35, '#D4922A');
    hG.addColorStop(0.75, '#3E1C46');
    hG.addColorStop(1, INK);
    ctx.fillStyle = hG;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.0;
    ctx.stroke();
  }
  ctx.restore();

  // FOREGROUND PROP: Coiled Barbed Crimson-Glowing Executioner Whip + Gauntleted Hand!
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(96, 514);
  ctx.bezierCurveTo(220, 444, 428, 520, 444, 370);
  ctx.bezierCurveTo(454, 294, 344, 314, 380, 422);
  ctx.stroke();
  ctx.strokeStyle = '#FF206E';
  ctx.lineWidth = 6.5;
  ctx.stroke();
  ctx.strokeStyle = '#FFB8DF';
  ctx.lineWidth = 2.4;
  ctx.stroke();

  for (const [bx, by, ang] of [
    [206, 476, -0.5],
    [308, 476, 0.2],
    [408, 446, -0.8],
    [438, 366, -1.2],
  ]) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ang);
    ctx.fillStyle = '#FFE494';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(0, -18);
    ctx.lineTo(6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  paintForegroundGauntlet(ctx, 94, 534, -0.32, 0.98, '#6A227E', '#2A0C3C', '#090412', '#FF66E2');

  paintMythicFrame(ctx, '#FF389C');
}

function paintPortrait(ctx: CanvasRenderingContext2D, id: CharacterPortraitId): void {
  switch (id) {
    case 'voltaris':
      paintVoltaris(ctx);
      break;
    case 'tidebreaker':
      paintTidebreaker(ctx);
      break;
    case 'aegira':
      paintAegira(ctx);
      break;
    case 'velouris':
      paintVelouris(ctx);
      break;
    case 'sylvara':
      paintSylvara(ctx);
      break;
    case 'bellum':
      paintBellum(ctx);
      break;
    case 'bacchion':
      paintBacchion(ctx);
      break;
    case 'glaciera':
      paintGlaciera(ctx);
      break;
    case 'veloce':
      paintVeloce(ctx);
      break;
    case 'abyssos':
      paintAbyssos(ctx);
      break;
    case 'prince_pyreus':
      paintPrincePyreus(ctx);
      break;
    case 'warden_malice':
      paintWardenMalice(ctx);
      break;
  }
}
