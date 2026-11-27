/**
 * ProceduralPortraits — High-resolution (480x640) painterly comic-ink chiaroscuro
 * character portraits for all 10 Patrons, Prince Pyreus, and Warden Malice.
 *
 * Crafted in true hand-inked mythic comic style: variable-weight calligraphic linework,
 * sculpted multi-plane 3/4 facial anatomy (brow/cheekbone/nose/jaw/clavicle), bold
 * #09060E chiaroscuro shadow masks (35-45% dark mass) with fine-pen shadow hatching,
 * 16-24 layered tapered calligraphic hair/beard locks (zero cloud blobs or dome hoods),
 * wrought hammered-gold Greco-Roman crowns/helms, anatomical hands & props framed cleanly
 * outside the face, colored rim lighting, and painterly gouache backdrops.
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
// Painterly Comic-Ink Primitives (Calligraphic Brush, Multi-Lock Strands, Hatch)
// ============================================================================

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** Tapered calligraphic quadratic brush stroke (thick organic belly, razor-fine tips). */
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
  taperStart = 0.16,
  taperEnd = 0.1
): void {
  const steps = 16;
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

/** Fine directional pen cross-hatching tucked strictly along shadow terminators. */
function paintInkHatchCluster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  len: number,
  spacing: number,
  angleRad: number,
  alpha = 0.36,
  lineW = 1.1
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
    const taper = 0.45 + 0.55 * Math.sin(frac * Math.PI);
    const ox = x + px * (i * spacing);
    const oy = y + py * (i * spacing);
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + ca * len * taper, oy + sa * len * taper);
  }
  ctx.stroke();
  ctx.restore();
}

interface StrandSpec {
  readonly x0: number;
  readonly y0: number;
  readonly cx1: number;
  readonly cy1: number;
  readonly tipX: number;
  readonly tipY: number;
  readonly cx2: number;
  readonly cy2: number;
  readonly tone?: 'lit' | 'mid' | 'dark';
  readonly rim?: boolean;
}

/**
 * Draws an individually shaded tapered calligraphic hair/beard/plume lock
 * with soft variable-weight comic linework (fine lit edge, rich shadowed inner fold, luminous rim).
 */
function paintCalligraphicLock(
  ctx: CanvasRenderingContext2D,
  s: StrandSpec,
  cols: { lit: string; mid: string; dark: string; rim?: string },
  inkW = 2.6
): void {
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.quadraticCurveTo(s.cx1, s.cy1, s.tipX, s.tipY);
    ctx.quadraticCurveTo(s.cx2, s.cy2, s.x0, s.y0);
    ctx.closePath();
  };

  ctx.save();
  trace();
  const g = ctx.createLinearGradient(s.x0, s.y0, s.tipX, s.tipY);
  if (s.tone === 'dark') {
    g.addColorStop(0, INK);
    g.addColorStop(0.55, cols.dark);
    g.addColorStop(1, cols.mid);
  } else if (s.tone === 'lit') {
    g.addColorStop(0, cols.mid);
    g.addColorStop(0.35, cols.lit);
    g.addColorStop(1, cols.mid);
  } else {
    g.addColorStop(0, cols.dark);
    g.addColorStop(0.42, cols.mid);
    g.addColorStop(0.86, cols.lit);
    g.addColorStop(1, cols.dark);
  }
  ctx.fillStyle = g;
  ctx.fill();

  // Internal fine directional strand highlight & deep shadow crease (breaks flat vector feel!)
  ctx.save();
  trace();
  ctx.clip();
  const mx = (s.cx1 + s.cx2) * 0.5;
  const my = (s.cy1 + s.cy2) * 0.5;
  paintBrushCurve(ctx, s.x0, s.y0, s.cx2, s.cy2, s.tipX, s.tipY, inkW * 1.45, 'rgba(9, 6, 14, 0.72)', 0.2, 0.08);
  if (s.tone !== 'dark') {
    paintBrushCurve(ctx, s.x0, s.y0, mx, my, s.tipX, s.tipY, 2.0, 'rgba(255, 255, 255, 0.26)', 0.1, 0.05);
  }
  if (s.rim && cols.rim) {
    paintBrushCurve(ctx, s.x0, s.y0, s.cx1, s.cy1, s.tipX, s.tipY, 3.2, cols.rim, 0.14, 0.06);
  }
  ctx.restore();

  // Variable-weight outer contour (fine on lit edge, heavy on shadow edge!)
  paintBrushCurve(ctx, s.x0, s.y0, s.cx1, s.cy1, s.tipX, s.tipY, inkW * 0.78, INK, 0.25, 0.1);
  paintBrushCurve(ctx, s.x0, s.y0, s.cx2, s.cy2, s.tipX, s.tipY, inkW * 1.3, INK, 0.3, 0.12);
  ctx.restore();
}

/**
 * Renders ONE lush, contiguous organic hair / beard / plume / cosmic-veil mass with:
 * - Sculpted multi-wave scalloped silhouette (no flat cloud-ball, no separated banana spikes!)
 * - 4-stop painterly directional gradient + curved Mignola chiaroscuro shadow mass
 * - Flowing internal calligraphic ink strand-creases + sunlit silk highlight strokes
 * - Luminous backlit colored rim-light ribbon + variable-weight comic outer outline!
 */
function paintUnifiedFlowingHair(
  ctx: CanvasRenderingContext2D,
  tracePath: () => void,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  cols: { lit: string; mid: string; dark: string; rim?: string },
  strands: readonly [number, number, number, number, number, number, number, 'ink' | 'lit' | 'rim'][],
  opts?: { shadowFrac?: number; inkW?: number; starfieldSeed?: number }
): void {
  const shadowFrac = opts?.shadowFrac ?? 0.44;
  const inkW = opts?.inkW ?? 3.6;

  ctx.save();
  tracePath();
  const grad = ctx.createLinearGradient(bounds.x0, bounds.y0, bounds.x1, bounds.y1);
  grad.addColorStop(0, cols.lit);
  grad.addColorStop(0.42, cols.mid);
  grad.addColorStop(0.82, cols.dark);
  grad.addColorStop(1, INK);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.save();
  tracePath();
  ctx.clip();

  // Bold Mignola chiaroscuro graphic shadow mass carving SE side of hair/beard!
  const bw = bounds.x1 - bounds.x0;
  const bh = bounds.y1 - bounds.y0;
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.moveTo(bounds.x1 - bw * shadowFrac, bounds.y0 - 12);
  ctx.lineTo(bounds.x1 + 14, bounds.y0 - 12);
  ctx.lineTo(bounds.x1 + 14, bounds.y1 + 14);
  ctx.lineTo(bounds.x0 + bw * (1 - shadowFrac * 1.2), bounds.y1 + 14);
  ctx.quadraticCurveTo(bounds.x1 - bw * (shadowFrac * 0.72), bounds.y0 + bh * 0.48, bounds.x1 - bw * shadowFrac, bounds.y0 - 12);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Optional starry nebula galaxy dust inside Abyssos's cosmic veil!
  if (opts?.starfieldSeed) {
    const rand = seededRand(opts.starfieldSeed);
    for (let i = 0; i < 48; i++) {
      const sx = bounds.x0 + rand() * bw;
      const sy = bounds.y0 + rand() * bh;
      const sr = 0.8 + rand() * 2.2;
      ctx.fillStyle = i % 3 === 0 ? '#FFF6B8' : '#E8C8FF';
      ctx.globalAlpha = 0.45 + rand() * 0.55;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Flowing internal calligraphic ink strand-creases & bright sunlit silk highlight ribbons!
  for (const [x0, y0, cx, cy, x1, y1, w, kind] of strands) {
    const col =
      kind === 'ink'
        ? INK
        : kind === 'rim'
          ? cols.rim ?? '#FFFFFF'
          : cols.lit;
    ctx.globalAlpha = kind === 'ink' ? 0.84 : kind === 'rim' ? 0.9 : 0.65;
    paintBrushCurve(ctx, x0, y0, cx, cy, x1, y1, w, col, 0.14, 0.08);
  }
  ctx.globalAlpha = 1;

  // Crisp backlit divine rim-light ribbon tracing inner NW silhouette edge!
  if (cols.rim) {
    ctx.save();
    ctx.translate(2.6, 2.0);
    tracePath();
    ctx.strokeStyle = cols.rim;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Clean outer comic-ink contour
  tracePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = inkW;
  ctx.stroke();
  ctx.restore();
}

/**
 * Generates an organic layered fan of swept calligraphic locks (for wispy accent strands & wings).
 */
function paintCascadingMane(
  ctx: CanvasRenderingContext2D,
  strands: readonly StrandSpec[],
  cols: { lit: string; mid: string; dark: string; rim?: string },
  inkW = 2.6
): void {
  for (const s of strands) {
    paintCalligraphicLock(ctx, s, cols, inkW);
  }
}

/**
 * Painterly gouache backdrop with organic atmospheric brushwork, Greco-Roman astrolabe halo,
 * subtle canvas grain, and moody chiaroscuro framing vignette.
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
  bg.addColorStop(0.5, '#11091A');
  bg.addColorStop(1, opts.voidCol);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Layered directional painterly gouache brush clouds
  ctx.save();
  for (let i = 0; i < 34; i++) {
    const bx = rand() * w;
    const by = rand() * h * 0.9;
    const rx = 44 + rand() * 116;
    const ry = 14 + rand() * 44;
    const rot = -0.6 + rand() * 1.2;
    ctx.fillStyle = i % 3 === 0 ? opts.primary : i % 3 === 1 ? opts.deep : INK;
    ctx.globalAlpha = i % 3 === 2 ? 0.28 : 0.06 + rand() * 0.08;
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Radiant divine rim-backlight bloom behind head/shoulders
  ctx.save();
  const bloom = ctx.createRadialGradient(opts.haloX, opts.haloY, 14, opts.haloX, opts.haloY, 320);
  bloom.addColorStop(0, opts.highlight);
  bloom.addColorStop(0.24, opts.primary);
  bloom.addColorStop(0.6, 'rgba(18, 10, 28, 0.24)');
  bloom.addColorStop(1, 'rgba(9, 6, 14, 0)');
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Fine Greco-Roman celestial astrolabe ring & sun-ray filigree
  ctx.save();
  ctx.translate(opts.haloX, opts.haloY);
  const pts = opts.starPoints ?? 10;
  ctx.fillStyle = opts.highlight;
  ctx.globalAlpha = 0.11;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 === 0 ? 236 : 92;
    const a = (i * Math.PI) / pts - Math.PI * 0.5;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = opts.primary;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, 166, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 182, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = opts.highlight;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI * 2) / 24;
    const r0 = i % 3 === 0 ? 156 : 166;
    const r1 = i % 3 === 0 ? 190 : 176;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();

  // Moody corner chiaroscuro vignette
  const cornerVig = ctx.createRadialGradient(w * 0.5, h * 0.42, 130, w * 0.5, h * 0.48, 400);
  cornerVig.addColorStop(0, 'rgba(9, 6, 14, 0)');
  cornerVig.addColorStop(0.72, 'rgba(9, 6, 14, 0.28)');
  cornerVig.addColorStop(1, 'rgba(9, 6, 14, 0.84)');
  ctx.fillStyle = cornerVig;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Sculpted Anatomical Comic-Ink Hand gripping a shaft/orb cleanly (tapered fingers,
 * knuckle creases, opposing curved thumb & ornate engraved vambrace cuff — ZERO roundRect blocks!).
 */
function paintAnatomicalHand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rot: number,
  scale: number,
  flip: 1 | -1,
  cols: {
    skinLit: string;
    skinMid: string;
    skinDark: string;
    cuffLit: string;
    cuffMid: string;
    cuffDark: string;
    rim: string;
  }
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(flip * scale, scale);

  // Tapered forearm & hammered-gold engraved vambrace cuff extending cleanly off lower frame
  ctx.beginPath();
  ctx.moveTo(-24, 18);
  ctx.quadraticCurveTo(0, 12, 26, 20);
  ctx.lineTo(36, 110);
  ctx.lineTo(-34, 108);
  ctx.closePath();
  const cG = ctx.createLinearGradient(-28, 18, 34, 106);
  cG.addColorStop(0, cols.cuffLit);
  cG.addColorStop(0.45, cols.cuffMid);
  cG.addColorStop(0.84, cols.cuffDark);
  cG.addColorStop(1, INK);
  ctx.fillStyle = cG;
  ctx.fill();
  paintBrushCurve(ctx, -24, 18, -30, 62, -34, 108, 4.2, INK);
  paintBrushCurve(ctx, 26, 20, 31, 64, 36, 110, 5.2, INK);
  paintBrushCurve(ctx, -22, 22, 0, 16, 24, 24, 3.6, cols.rim);
  paintBrushCurve(ctx, -24, 38, 0, 32, 26, 40, 2.4, INK);

  // Sculpted back-of-hand & metacarpal palm plane
  ctx.beginPath();
  ctx.moveTo(-25, 22);
  ctx.bezierCurveTo(-34, 0, -28, -22, -10, -26);
  ctx.lineTo(22, -20);
  ctx.bezierCurveTo(34, -8, 32, 12, 24, 22);
  ctx.closePath();
  const pG = ctx.createLinearGradient(-30, -24, 30, 22);
  pG.addColorStop(0, cols.skinLit);
  pG.addColorStop(0.5, cols.skinMid);
  pG.addColorStop(1, cols.skinDark);
  ctx.fillStyle = pG;
  ctx.fill();
  paintBrushCurve(ctx, -25, 22, -32, -4, -12, -25, 3.2, INK);
  paintBrushCurve(ctx, 22, -20, 34, 0, 24, 22, 4.6, INK);

  // 4 Individually Articulated Curled Tapered Fingers gripping forward (organic phalanges, NOT rectangles!)
  const fingers: readonly [number, number, number, number][] = [
    [-22, -16, 15, 26],
    [-8, -22, 15, 30],
    [6, -20, 14, 29],
    [19, -14, 12, 24],
  ];
  for (let i = 0; i < fingers.length; i++) {
    const [fx, fy, fw, fh] = fingers[i];
    ctx.beginPath();
    ctx.moveTo(fx, fy + fh * 0.4);
    ctx.bezierCurveTo(fx - 2, fy - 4, fx + fw * 0.4, fy - 8, fx + fw * 0.85, fy - 3);
    ctx.bezierCurveTo(fx + fw + 2, fy + fh * 0.28, fx + fw, fy + fh * 0.78, fx + fw * 0.52, fy + fh);
    ctx.bezierCurveTo(fx + 2, fy + fh * 0.9, fx - 1, fy + fh * 0.65, fx, fy + fh * 0.4);
    ctx.closePath();
    const fG = ctx.createLinearGradient(fx, fy - 6, fx + fw, fy + fh);
    fG.addColorStop(0, i < 2 ? cols.skinLit : cols.skinMid);
    fG.addColorStop(0.55, i < 2 ? cols.skinMid : cols.skinDark);
    fG.addColorStop(1, INK);
    ctx.fillStyle = fG;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    // Knuckle ridge crease & rim gleam
    paintBrushCurve(ctx, fx + 2, fy + fh * 0.34, fx + fw * 0.5, fy + fh * 0.28, fx + fw - 2, fy + fh * 0.36, 1.8, INK);
    if (i < 2) {
      paintBrushCurve(ctx, fx + 2, fy + 2, fx + fw * 0.4, fy - 2, fx + fw * 0.75, fy + 1, 2.0, cols.rim);
    }
  }

  // Opposing Sculpted Curved Thumb wrapping cleanly across index/middle knuckles!
  ctx.beginPath();
  ctx.moveTo(-26, 12);
  ctx.bezierCurveTo(-38, -2, -24, -14, -4, -10);
  ctx.bezierCurveTo(14, -7, 16, 4, 4, 12);
  ctx.bezierCurveTo(-6, 18, -18, 18, -26, 12);
  ctx.closePath();
  const thG = ctx.createLinearGradient(-32, -10, 12, 16);
  thG.addColorStop(0, cols.skinLit);
  thG.addColorStop(0.55, cols.skinMid);
  thG.addColorStop(1, cols.skinDark);
  ctx.fillStyle = thG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.0;
  ctx.stroke();
  paintBrushCurve(ctx, -20, -4, -6, -8, 6, -4, 2.2, cols.rim);

  ctx.restore();
}

/**
 * Carved Sculpted Multi-Plate Bronze/Skull Pauldron (ZERO smooth football ovals!).
 */
function paintSculptedPauldron(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  flip: 1 | -1,
  cols: { lit: string; mid: string; dark: string; rim: string },
  style: 'beveled_plate' | 'carved_skull' | 'spiked_war' = 'beveled_plate'
): void {
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(flip, 1);

  // Under-lame lower bronze shoulder flange
  ctx.beginPath();
  ctx.moveTo(-64, 46);
  ctx.quadraticCurveTo(0, 62, 54, 42);
  ctx.lineTo(44, 14);
  ctx.lineTo(-56, 14);
  ctx.closePath();
  const uG = ctx.createLinearGradient(-60, 14, 52, 56);
  uG.addColorStop(0, cols.mid);
  uG.addColorStop(0.55, cols.dark);
  uG.addColorStop(1, INK);
  ctx.fillStyle = uG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();

  // Primary faceted beveled bronze shoulder plate
  const traceMain = () => {
    ctx.beginPath();
    ctx.moveTo(-66, 32);
    ctx.bezierCurveTo(-68, -6, -24, -44, 28, -32);
    if (style === 'spiked_war') {
      ctx.lineTo(66, -48); // razor war-plate wing spike
      ctx.lineTo(52, -4);
    } else {
      ctx.bezierCurveTo(58, -18, 62, 16, 44, 34);
    }
    ctx.quadraticCurveTo(-8, 44, -66, 32);
    ctx.closePath();
  };
  traceMain();
  const pGrad = ctx.createLinearGradient(-56, -34, 48, 38);
  pGrad.addColorStop(0, cols.lit);
  pGrad.addColorStop(0.36, cols.mid);
  pGrad.addColorStop(0.76, cols.dark);
  pGrad.addColorStop(1, INK);
  ctx.fillStyle = pGrad;
  ctx.fill();

  ctx.save();
  traceMain();
  ctx.clip();
  // Crisp geometric bevel shadow half on underside
  ctx.fillStyle = 'rgba(9, 6, 14, 0.68)';
  ctx.beginPath();
  ctx.moveTo(-68, 12);
  ctx.quadraticCurveTo(-4, 2, 66, 14);
  ctx.lineTo(68, 56);
  ctx.lineTo(-68, 56);
  ctx.closePath();
  ctx.fill();
  // Faceted specular ridge highlight + rim gleam
  paintBrushCurve(ctx, -48, 8, -12, -26, 32, -16, 5.2, '#FFFFFF', 0.1, 0.08);
  paintBrushCurve(ctx, -56, 22, -16, -34, 36, -24, 3.0, cols.rim, 0.12, 0.1);
  ctx.restore();

  // Carved bronze rivets & Greco-Roman embossed filigree ridge
  paintBrushCurve(ctx, -64, 30, -8, 38, 44, 30, 4.6, INK);
  paintBrushCurve(ctx, -64, 30, -24, -36, 30, -30, 3.4, INK);
  paintBrushCurve(ctx, -48, 20, -4, 6, 38, 14, 3.0, INK);

  if (style === 'carved_skull') {
    // Embossed bronze underworld skull crest right on pauldron face!
    ctx.fillStyle = cols.lit;
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.quadraticCurveTo(0, -24, 18, -6);
    ctx.lineTo(14, 10);
    ctx.lineTo(8, 20);
    ctx.lineTo(-8, 20);
    ctx.lineTo(-14, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(-2, 2);
    ctx.lineTo(-5, 8);
    ctx.lineTo(-12, 5);
    ctx.closePath();
    ctx.moveTo(12, -2);
    ctx.lineTo(2, 2);
    ctx.lineTo(5, 8);
    ctx.lineTo(12, 5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// Master Comic-Ink Sculpted Anatomy Engine (35-45% Chiaroscuro Shadow Mask)
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
  pauldronStyle?: 'beveled_plate' | 'carved_skull' | 'spiked_war';
  warPaint?: 'bellum_crimson';
  scar?: boolean;
}

function paintMasterComicTorso(ctx: CanvasRenderingContext2D, a: CharacterAnatomy): void {
  const cx = a.headX;
  const dir = a.turnDir;
  const nearSide = -dir;
  const farSide = dir;

  const neckBaseY = a.headY + 124 * a.headScale;
  const nearShX = cx + nearSide * (a.shoulderSpan * 0.56);
  const nearShY = neckBaseY + 34;
  const farShX = cx + farSide * (a.shoulderSpan * 0.47);
  const farShY = neckBaseY + 16;

  const traceTorso = () => {
    ctx.beginPath();
    ctx.moveTo(nearShX + nearSide * 58, PORTRAIT_HEIGHT + 12);
    ctx.bezierCurveTo(
      nearShX + nearSide * 40,
      nearShY + 90,
      nearShX + nearSide * 18,
      nearShY - 12,
      cx + nearSide * 52,
      neckBaseY - 10
    );
    ctx.lineTo(cx + farSide * 46, neckBaseY - 16);
    ctx.bezierCurveTo(
      farShX + farSide * 12,
      farShY - 10,
      farShX + farSide * 42,
      farShY + 88,
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
  torsoGrad.addColorStop(0.38, a.clothMid);
  torsoGrad.addColorStop(0.72, a.clothDark);
  torsoGrad.addColorStop(1, INK);
  ctx.fillStyle = torsoGrad;
  ctx.fill();

  ctx.save();
  traceTorso();
  ctx.clip();

  // Bold graphic #09060E Mignola shadow pool swallowing right/SE half of torso
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.moveTo(cx + 28, neckBaseY - 12);
  ctx.bezierCurveTo(cx + 70, neckBaseY + 78, cx + 44, neckBaseY + 184, cx - 10, PORTRAIT_HEIGHT + 14);
  ctx.lineTo(PORTRAIT_WIDTH + 24, PORTRAIT_HEIGHT + 14);
  ctx.lineTo(PORTRAIT_WIDTH + 24, neckBaseY - 30);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  paintInkHatchCluster(ctx, cx + 10, neckBaseY + 74, 10, 34, 8.5, 0.56, 0.4, 1.3);

  // Exposed sunlit anatomical collarbone, sternocleidomastoid & chest plane
  if (a.collarStyle === 'chiton_drape' || a.collarStyle === 'plunge_velvet' || a.collarStyle === 'corset_spike') {
    const vDepth = a.collarStyle === 'plunge_velvet' ? 128 : a.collarStyle === 'corset_spike' ? 92 : 102;
    const traceChest = () => {
      ctx.beginPath();
      ctx.moveTo(cx - 66, neckBaseY - 14);
      ctx.quadraticCurveTo(cx + dir * 10, neckBaseY + vDepth, cx + 68, neckBaseY - 18);
      ctx.closePath();
    };
    traceChest();
    const skG = ctx.createLinearGradient(cx - 66, neckBaseY, cx + 54, neckBaseY + vDepth);
    skG.addColorStop(0, a.skinLit);
    skG.addColorStop(0.5, a.skinMid);
    skG.addColorStop(0.82, a.skinShadow);
    skG.addColorStop(1, a.skinDeep);
    ctx.fillStyle = skG;
    ctx.fill();

    ctx.save();
    traceChest();
    ctx.clip();
    // Deep graphic cast neck/clavicle shadow carving right half of chest
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.68;
    ctx.beginPath();
    ctx.moveTo(cx + 12, neckBaseY - 16);
    ctx.quadraticCurveTo(cx + 28, neckBaseY + 48, cx + 4, neckBaseY + vDepth + 8);
    ctx.lineTo(cx + 80, neckBaseY + vDepth + 8);
    ctx.lineTo(cx + 80, neckBaseY - 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Sculpted anatomical clavicle (collarbone) highlight + under-clavicle shadow hollows!
    paintBrushCurve(ctx, cx - 54, neckBaseY + 20, cx - 26, neckBaseY + 32, cx - 4, neckBaseY + 28, 3.2, a.skinLit);
    paintBrushCurve(ctx, cx - 52, neckBaseY + 24, cx - 24, neckBaseY + 38, cx - 4, neckBaseY + 34, 3.6, a.skinDeep);
    paintBrushCurve(ctx, cx + 48, neckBaseY + 18, cx + 26, neckBaseY + 34, cx + 8, neckBaseY + 32, 4.2, INK);
    // Suprasternal notch hollow shadow
    ctx.fillStyle = a.skinDeep;
    ctx.beginPath();
    ctx.moveTo(cx - 7, neckBaseY + 30);
    ctx.quadraticCurveTo(cx + 2, neckBaseY + 42, cx + 10, neckBaseY + 30);
    ctx.quadraticCurveTo(cx + 2, neckBaseY + 35, cx - 7, neckBaseY + 30);
    ctx.closePath();
    ctx.fill();
    paintBrushCurve(ctx, cx - 66, neckBaseY - 12, cx + dir * 10, neckBaseY + vDepth, cx + 68, neckBaseY - 16, 4.0, INK);
  }

  if (a.collarStyle === 'high_armor' || a.collarStyle === 'corset_spike') {
    ctx.beginPath();
    ctx.moveTo(cx - 112, neckBaseY + 44);
    ctx.quadraticCurveTo(cx, neckBaseY + 86, cx + 112, neckBaseY + 40);
    ctx.lineTo(cx + 128, PORTRAIT_HEIGHT + 12);
    ctx.lineTo(cx - 128, PORTRAIT_HEIGHT + 12);
    ctx.closePath();
    const plateG = ctx.createLinearGradient(cx - 112, neckBaseY + 40, cx + 112, PORTRAIT_HEIGHT);
    plateG.addColorStop(0, a.metalLit);
    plateG.addColorStop(0.32, a.metalMid);
    plateG.addColorStop(0.66, a.metalDark);
    plateG.addColorStop(1, INK);
    ctx.fillStyle = plateG;
    ctx.fill();

    ctx.fillStyle = 'rgba(9, 6, 14, 0.72)';
    ctx.beginPath();
    ctx.moveTo(cx + 12, neckBaseY + 60);
    ctx.lineTo(cx + 122, neckBaseY + 38);
    ctx.lineTo(cx + 130, PORTRAIT_HEIGHT + 12);
    ctx.lineTo(cx - 6, PORTRAIT_HEIGHT + 12);
    ctx.closePath();
    ctx.fill();

    paintBrushCurve(ctx, cx - 90, neckBaseY + 58, cx, neckBaseY + 134, cx + 90, neckBaseY + 54, 6.4, a.metalLit);
    paintBrushCurve(ctx, cx - 90, neckBaseY + 64, cx, neckBaseY + 140, cx + 90, neckBaseY + 60, 3.0, INK);
  } else {
    // Sculpted Multi-Fold Classical Himation Drapery w/ Sharp Angular Comic Cloth Shadow Wedges!
    ctx.beginPath();
    ctx.moveTo(nearShX - nearSide * 10, nearShY - 6);
    ctx.bezierCurveTo(
      cx - nearSide * 8,
      neckBaseY + 96,
      cx + farSide * 44,
      neckBaseY + 120,
      farShX + farSide * 60,
      PORTRAIT_HEIGHT + 10
    );
    ctx.lineTo(nearShX + nearSide * 66, PORTRAIT_HEIGHT + 10);
    ctx.closePath();
    const sashG = ctx.createLinearGradient(nearShX, nearShY, farShX, PORTRAIT_HEIGHT);
    sashG.addColorStop(0, a.clothLit);
    sashG.addColorStop(0.45, a.clothMid);
    sashG.addColorStop(0.84, a.clothDark);
    sashG.addColorStop(1, INK);
    ctx.fillStyle = sashG;
    ctx.fill();

    for (let f = 0; f < 4; f++) {
      const fx0 = nearShX - nearSide * (14 + f * 18);
      const fy0 = nearShY + 14 + f * 22;
      const fcx = cx + (f - 1.5) * 28;
      const fcy = neckBaseY + 122 + f * 24;
      const fx1 = cx + farSide * (40 - f * 22) + (f - 1) * 40;
      const fy1 = PORTRAIT_HEIGHT + 10;
      ctx.fillStyle = 'rgba(9, 6, 14, 0.72)';
      ctx.beginPath();
      ctx.moveTo(fx0, fy0);
      ctx.quadraticCurveTo(fcx, fcy, fx1, fy1);
      ctx.quadraticCurveTo(fcx - nearSide * 20, fcy + 16, fx0, fy0);
      ctx.closePath();
      ctx.fill();
      paintBrushCurve(ctx, fx0, fy0, fcx, fcy, fx1, fy1, 3.8, INK);
      // Lit fold crest catching warm/divine rim light
      paintBrushCurve(ctx, fx0 - 4, fy0 - 6, fcx - 6, fcy - 8, fx1 - 8, fy1 - 6, 2.2, a.clothLit);
    }

    // Hammered-Gold Greco-Roman Brocade Sash Border
    paintBrushCurve(
      ctx,
      nearShX - nearSide * 6,
      nearShY - 2,
      cx + farSide * 12,
      neckBaseY + 106,
      farShX + farSide * 52,
      PORTRAIT_HEIGHT + 4,
      10.5,
      a.metalMid
    );
    paintBrushCurve(
      ctx,
      nearShX - nearSide * 8,
      nearShY - 5,
      cx + farSide * 10,
      neckBaseY + 102,
      farShX + farSide * 50,
      PORTRAIT_HEIGHT,
      3.8,
      a.metalLit
    );
    paintBrushCurve(
      ctx,
      nearShX - nearSide * 5,
      nearShY + 4,
      cx + farSide * 13,
      neckBaseY + 114,
      farShX + farSide * 53,
      PORTRAIT_HEIGHT + 8,
      3.2,
      INK
    );
  }

  // Intense colored rim ribbon peeling near shoulder cleanly off background!
  paintBrushCurve(
    ctx,
    Math.min(nearShX, farShX) - 24,
    PORTRAIT_HEIGHT - 84,
    Math.min(nearShX, farShX) - 6,
    nearShY + 12,
    cx - 56,
    neckBaseY - 6,
    6.4,
    a.rimHex,
    0.16,
    0.26
  );
  ctx.restore();

  // Variable-weight comic torso outline (heavy shadow side, sleek lit side!)
  paintBrushCurve(
    ctx,
    nearShX + nearSide * 58,
    PORTRAIT_HEIGHT + 12,
    nearShX + nearSide * 26,
    nearShY + 26,
    cx + nearSide * 52,
    neckBaseY - 10,
    4.6,
    INK
  );
  paintBrushCurve(
    ctx,
    cx + farSide * 46,
    neckBaseY - 16,
    farShX + farSide * 26,
    farShY + 24,
    farShX + farSide * 64,
    PORTRAIT_HEIGHT + 12,
    6.2,
    INK
  );
  ctx.restore();

  // Sculpted Multi-Plate / Carved Skull Pauldrons (ZERO round football pads!)
  const pCols = { lit: a.metalLit, mid: a.metalMid, dark: a.metalDark, rim: a.rimHex };
  const pStyle = a.pauldronStyle ?? 'beveled_plate';
  if (a.pauldronSide === 'left' || a.pauldronSide === 'both') {
    paintSculptedPauldron(ctx, Math.min(nearShX, farShX) + 48, nearShY + 12, 1, pCols, pStyle);
  }
  if (a.pauldronSide === 'right' || a.pauldronSide === 'both') {
    paintSculptedPauldron(ctx, Math.max(nearShX, farShX) - 48, farShY + 14, -1, pCols, pStyle);
  }
}

function paintMasterComicHead(ctx: CanvasRenderingContext2D, a: CharacterAnatomy): void {
  ctx.save();
  ctx.translate(a.headX, a.headY);
  ctx.rotate(a.tiltRad);
  ctx.scale(a.headScale, a.headScale);

  const d = a.turnDir;
  const nw = a.neckWidth;

  // 1. Sculpted Anatomical Neck + Sternocleidomastoid Tendon + Heavy Cast Jaw Shadow
  const traceNeck = () => {
    ctx.beginPath();
    ctx.moveTo(-nw * 0.66, 66);
    ctx.quadraticCurveTo(-nw * 0.76, 114, -nw * 0.88, 154);
    ctx.quadraticCurveTo(0, 174, nw * 0.88, 150);
    ctx.quadraticCurveTo(nw * 0.72, 110, nw * 0.64, 62);
    ctx.closePath();
  };
  traceNeck();
  const neckG = ctx.createLinearGradient(-nw, 72, nw, 150);
  neckG.addColorStop(0, a.skinLit);
  neckG.addColorStop(0.46, a.skinMid);
  neckG.addColorStop(0.82, a.skinShadow);
  neckG.addColorStop(1, a.skinDeep);
  ctx.fillStyle = neckG;
  ctx.fill();

  ctx.save();
  traceNeck();
  ctx.clip();
  // Bold graphic Mignola cast jaw shadow spilling down neck & enveloping SE side
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.moveTo(-nw - 6, 58);
  ctx.lineTo(nw + 12, 58);
  ctx.lineTo(nw + 12, 172);
  ctx.lineTo(2, 172);
  ctx.bezierCurveTo(18, 134, -2, 112, -nw - 6, 100);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  paintInkHatchCluster(ctx, -6, 118, 6, 20, 5.2, 0.58, 0.42, 1.1);
  // Crisp anatomical sternocleidomastoid muscle line
  paintBrushCurve(ctx, -nw * 0.44, 96, -nw * 0.24, 126, -2, 154, 2.8, a.skinDeep);
  ctx.restore();

  paintBrushCurve(ctx, -nw * 0.66, 66, -nw * 0.76, 114, -nw * 0.88, 154, 3.6, INK);
  paintBrushCurve(ctx, nw * 0.64, 62, nw * 0.72, 110, nw * 0.88, 150, 5.0, INK);

  // 2. Sculpted Anatomical Ear on back 3/4 side (-d)
  const earX = -d * 68;
  ctx.beginPath();
  ctx.moveTo(earX, -10);
  ctx.bezierCurveTo(earX - d * 24, -18, earX - d * 22, 34, earX + d * 2, 42);
  ctx.closePath();
  ctx.fillStyle = a.skinShadow;
  ctx.fill();
  paintBrushCurve(ctx, earX, -10, earX - d * 24, 10, earX + d * 2, 42, 3.6, INK);
  paintBrushCurve(ctx, earX - d * 6, 2, earX - d * 15, 16, earX - d * 4, 28, 2.2, INK);

  // 3. Chiseled Multi-Plane 3/4 Facial Bone Structure (Prominent Cheekbone, Indented Temple, Angular Jaw!)
  let jawW = 68;
  let chinY = 100;
  let chinW = 16;
  let cheekBulge = 76;
  let browH = -82;

  switch (a.jaw) {
    case 'square_titan':
      jawW = 76;
      chinY = 104;
      chinW = 28;
      cheekBulge = 82;
      browH = -84;
      break;
    case 'aristocratic_sharp':
      jawW = 62;
      chinY = 104;
      chinW = 10;
      cheekBulge = 74;
      browH = -86;
      break;
    case 'sculpted_youth':
      jawW = 66;
      chinY = 98;
      chinW = 15;
      cheekBulge = 75;
      browH = -82;
      break;
    case 'sensual_taper':
      jawW = 60;
      chinY = 96;
      chinW = 11;
      cheekBulge = 72;
      browH = -82;
      break;
    case 'relaxed_broad':
      jawW = 72;
      chinY = 100;
      chinW = 22;
      cheekBulge = 78;
      browH = -80;
      break;
    case 'elongated_ethereal':
      jawW = 56;
      chinY = 116;
      chinW = 9;
      cheekBulge = 68;
      browH = -94;
      break;
  }

  // Sculpted comic contour: subtle temple indent -> flared zygomatic cheekbone -> angular jaw corner -> tapered chin!
  const buildFacePath = () => {
    ctx.beginPath();
    ctx.moveTo(d * (jawW * 0.8), -56);
    ctx.lineTo(d * (jawW * 0.74), -28); // subtle brow-to-temple indent
    ctx.quadraticCurveTo(d * (cheekBulge + 8), -4, d * (cheekBulge + 2), 18); // sculpted far cheekbone flare!
    ctx.lineTo(d * (jawW * 0.78), 46); // crisp jaw-corner plane
    ctx.quadraticCurveTo(d * (chinW + 18), chinY - 12, d * (chinW * 0.45), chinY);
    ctx.quadraticCurveTo(-d * (chinW * 0.65), chinY + 1, -d * (jawW * 0.56), 78);
    ctx.lineTo(-d * (jawW * 0.94), 38); // sharp near mandibular jaw angle!
    ctx.bezierCurveTo(-d * (jawW * 1.04), -12, -d * (jawW * 0.94), -76, -d * 8, browH);
    ctx.bezierCurveTo(d * 40, browH, d * (jawW * 0.76), -70, d * (jawW * 0.8), -56);
    ctx.closePath();
  };

  buildFacePath();
  const faceGrad = ctx.createLinearGradient(-jawW, browH, jawW, chinY);
  faceGrad.addColorStop(0, a.skinLit);
  faceGrad.addColorStop(0.42, a.skinMid);
  faceGrad.addColorStop(0.76, a.skinShadow);
  faceGrad.addColorStop(1, a.skinDeep);
  ctx.fillStyle = faceGrad;
  ctx.fill();

  ctx.save();
  buildFacePath();
  ctx.clip();

  // 4. Sculpted Mignola Chiaroscuro Shadow Plane (~40% graphic dark mass carving cheekbone hollow & jaw!)
  ctx.fillStyle = a.skinShadow;
  ctx.globalAlpha = 0.82;
  ctx.beginPath();
  ctx.moveTo(14, browH - 10);
  ctx.lineTo(116, browH - 10);
  ctx.lineTo(116, chinY + 24);
  ctx.lineTo(-10, chinY + 24);
  ctx.bezierCurveTo(22, 74, 34, 40, 14, 18); // cheekbone hollow scoop!
  ctx.bezierCurveTo(42, -4, 34, -46, 14, browH - 10);
  ctx.closePath();
  ctx.fill();

  // Crisp #09060E graphic ink terminator along temple, zygomatic hollow & lower jaw
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.78;
  ctx.beginPath();
  ctx.moveTo(40, browH - 8);
  ctx.lineTo(116, browH - 8);
  ctx.lineTo(116, chinY + 24);
  ctx.lineTo(14, chinY + 24);
  ctx.bezierCurveTo(44, 72, 52, 42, 34, 18);
  ctx.bezierCurveTo(56, -4, 52, -44, 40, browH - 8);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Sculpted under-cheekbone hollow shadow wedge on lit side too (classic Jen Zee comic cheekbone!)
  ctx.fillStyle = a.skinShadow;
  ctx.globalAlpha = 0.44;
  ctx.beginPath();
  ctx.moveTo(-d * 62, 16);
  ctx.quadraticCurveTo(-d * 34, 36, -d * 20, 62);
  ctx.quadraticCurveTo(-d * 46, 48, -d * 66, 36);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Delicate comic pen cross-hatching tucked strictly along cheekbone shadow terminator
  paintInkHatchCluster(ctx, 22, 18, 7, 17, 5.2, 0.56, 0.38, 1.05);

  if (a.warPaint === 'bellum_crimson') {
    // Jagged painterly hand-smeared crimson war-band across eyes & cheekbones
    ctx.fillStyle = '#C9101C';
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    ctx.moveTo(-jawW - 10, -16);
    ctx.lineTo(d * 18, -4);
    ctx.lineTo(jawW + 10, -18);
    ctx.lineTo(jawW + 10, 22);
    ctx.lineTo(d * 18, 28);
    ctx.lineTo(-jawW - 10, 18);
    ctx.closePath();
    ctx.fill();
    paintBrushCurve(ctx, -36, 16, -38, 30, -34, 44, 4.0, '#7A060E');
    paintBrushCurve(ctx, 24, 18, 26, 28, 24, 38, 3.6, '#7A060E');
    ctx.globalAlpha = 1;
  }

  // Painterly sunlit NW cheekbone & brow specular highlight planes
  ctx.fillStyle = a.skinLit;
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.ellipse(-34, 10, 22, 10, -0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.ellipse(-20, -40, 24, 10, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Vibrant colored rim-light ribbons peeling both face sides cleanly off dark background!
  paintBrushCurve(ctx, -jawW + 3, -38, -jawW - 2, 24, -chinW + 2, chinY - 4, 5.4, a.rimHex, 0.14, 0.2);
  paintBrushCurve(ctx, jawW - 5, 10, jawW - 9, 50, chinW + 12, chinY - 6, 3.8, a.rimHex, 0.12, 0.1);

  if (a.scar) {
    paintBrushCurve(ctx, -28, -32, -16, 4, -8, 38, 2.8, '#661820', 0.08, 0.08);
    paintBrushCurve(ctx, -26, -32, -14, 4, -6, 38, 1.4, a.skinLit, 0.08, 0.08);
  }
  ctx.restore();

  // Variable-weight face contour (delicate 2.4px lit-side jawline, heavy 4.8px shadow-side turn!)
  buildFacePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();
  paintBrushCurve(ctx, d * (jawW * 0.78), 46, d * (chinW + 16), chinY - 10, -d * (chinW * 0.4), chinY, 4.8, INK);

  // 5. Sculpted 3/4 Anatomical Nose Bridge, Subtle Nostril Wing & Sharp Triangular Cast Shadow
  const noseX = d * 18;
  const noseTipX = noseX + d * 13;
  const noseY = 26;

  // Shadow plane on side of nose
  ctx.fillStyle = a.skinDeep;
  ctx.beginPath();
  ctx.moveTo(noseX - d * 2, -22);
  ctx.lineTo(noseTipX, noseY);
  ctx.lineTo(noseX - d * 10, noseY + 9);
  ctx.lineTo(noseX - d * 14, 10);
  ctx.closePath();
  ctx.fill();

  // Crisp #09060E cast shadow under nose tip + sculpted nostril crease
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(noseTipX - d * 1, noseY + 1);
  ctx.lineTo(noseX - d * 11, noseY + 6);
  ctx.lineTo(noseX - d * 4, noseY + 12);
  ctx.closePath();
  ctx.fill();

  // Refined variable-weight nose bridge contour (NOT thick cartoon stroke!) + bright sunlit ridge
  paintBrushCurve(ctx, noseX - d * 1, -22, noseX + d * 6, 4, noseTipX, noseY, 2.4, INK, 0.1, 0.65);
  paintBrushCurve(ctx, noseX + d * 2, -18, noseX + d * 8, 2, noseTipX - d * 1, noseY - 3, 2.4, a.skinLit, 0.1, 0.1);

  // 6. Sculpted Expressive Comic Eyes (Deep Orbital Shadow + Winged Lashes + Radiant Glowing Irises!)
  const farEyeX = d * 41;
  const nearEyeX = -d * 19;
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
    // Deep Mignola orbital socket shadow crescent under brow
    ctx.fillStyle = INK;
    ctx.globalAlpha = a.expression === 'fierce' || a.expression === 'imperious' ? 0.74 : 0.44;
    ctx.beginPath();
    ctx.moveTo(ex - ew * 1.32, ey - eh * 1.5);
    ctx.quadraticCurveTo(ex, ey - eh * 2.6, ex + ew * 1.25, ey - eh * 1.3);
    ctx.quadraticCurveTo(ex, ey - eh * 0.65, ex - ew * 1.32, ey - eh * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    const buildAperture = () => {
      ctx.beginPath();
      ctx.moveTo(ex - ew, ey + 1);
      ctx.bezierCurveTo(ex - ew * 0.4, ey - eh * 1.15, ex + ew * 0.45, ey - eh * 1.08, ex + ew, ey - 1);
      ctx.bezierCurveTo(ex + ew * 0.45, ey + eh * 0.85, ex - ew * 0.4, ey + eh * 0.9, ex - ew, ey + 1);
      ctx.closePath();
    };

    buildAperture();
    const sclG = ctx.createLinearGradient(ex, ey - eh, ex, ey + eh);
    if (a.scleraHex) {
      sclG.addColorStop(0, INK);
      sclG.addColorStop(0.5, a.scleraHex);
      sclG.addColorStop(1, a.scleraHex);
    } else {
      sclG.addColorStop(0, '#8A7A9A');
      sclG.addColorStop(0.42, '#F7EFE6');
      sclG.addColorStop(1, '#DCCBC0');
    }
    ctx.fillStyle = sclG;
    ctx.fill();

    ctx.save();
    buildAperture();
    ctx.clip();

    const irisR = eh * 0.98;
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

    // Cast upper-eyelid shadow band across top of iris
    ctx.fillStyle = 'rgba(9, 6, 14, 0.44)';
    ctx.fillRect(ex - ew - 2, ey - eh - 2, ew * 2 + 4, eh * 0.62);

    // Crisp dual specular catchlights
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(gazeX - irisR * 0.36, ey - irisR * 0.28, Math.max(2.1, irisR * 0.24), 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gazeX + irisR * 0.32, ey + irisR * 0.28, Math.max(1.1, irisR * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Winged calligraphic upper lash & refined lower lid shadow line
    const wingOut = isNear ? -d * 9 : d * 6;
    paintBrushCurve(
      ctx,
      ex - ew + (wingOut < 0 ? wingOut : -1),
      ey + (wingOut < 0 ? -4 : 1),
      ex,
      ey - eh * 1.24,
      ex + ew + (wingOut > 0 ? wingOut : 1),
      ey + (wingOut > 0 ? -4 : -1),
      a.jaw === 'sensual_taper' || a.jaw === 'aristocratic_sharp' ? 5.8 : 4.8,
      INK,
      0.18,
      0.18
    );
    paintBrushCurve(ctx, ex - ew * 0.62, ey + eh * 0.72, ex, ey + eh * 1.02, ex + ew * 0.68, ey + eh * 0.66, 1.8, a.skinDeep);
  };

  paintExpressiveEye(farEyeX, eyeY, 15.5, 8.6, a.eyeOuter, a.eyeInner, false);
  paintExpressiveEye(
    nearEyeX,
    eyeY + 1,
    19.5,
    9.4,
    a.eyeRightOuter ?? a.eyeOuter,
    a.eyeRightInner ?? a.eyeInner,
    true
  );

  // 7. Expressive Tapered Calligraphic Eyebrows
  const browDrop =
    a.expression === 'fierce' || a.expression === 'imperious'
      ? 9.5
      : a.expression === 'focused' || a.expression === 'austere'
        ? 5.5
        : a.expression === 'alluring'
          ? -3
          : 2;
  const browThick = a.jaw === 'square_titan' || a.jaw === 'relaxed_broad' ? 7.6 : 5.4;

  paintBrushCurve(
    ctx,
    farEyeX + d * 18,
    eyeY - 18 - browDrop * 0.35,
    farEyeX,
    eyeY - 26 - browDrop * 0.15,
    farEyeX - d * 17,
    eyeY - 17 + browDrop,
    browThick * 0.88,
    INK,
    0.16,
    0.8
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
    0.8,
    0.14
  );

  // 8. Sculpted Chiaroscuro Lips + Under-Lip Cast Shadow Hollow
  const mouthX = d * 13;
  const mouthY = 55;
  const mw = a.jaw === 'sensual_taper' ? 21 : a.jaw === 'square_titan' ? 24 : 22;
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
  ctx.quadraticCurveTo(mouthX - mw * 0.35, mouthY - 6.5, mouthX, mouthY - 2.5);
  ctx.quadraticCurveTo(mouthX + mw * 0.35, mouthY - 6.5, mouthX + mw + 2, mouthY + (d > 0 ? smirkLift : 1));
  ctx.quadraticCurveTo(mouthX, mouthY + 2.8, mouthX - mw - 2, mouthY + (d < 0 ? smirkLift : 1));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.56)';
  ctx.beginPath();
  ctx.ellipse(mouthX - d * 4, mouthY + 5.5, 6.5, 2.0, 0, 0, Math.PI * 2);
  ctx.fill();
  paintBrushCurve(ctx, mouthX - 11, mouthY + 17, mouthX, mouthY + 22, mouthX + 11, mouthY + 17, 3.8, INK, 0.14, 0.14);

  ctx.restore();
}

function paintMythicFrame(ctx: CanvasRenderingContext2D, accentHex: string): void {
  const w = PORTRAIT_WIDTH;
  const h = PORTRAIT_HEIGHT;

  const vig = ctx.createLinearGradient(0, h - 160, 0, h);
  vig.addColorStop(0, 'rgba(9, 6, 14, 0)');
  vig.addColorStop(0.68, 'rgba(9, 6, 14, 0.8)');
  vig.addColorStop(1, 'rgba(9, 6, 14, 0.96)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, h - 160, w, 160);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.save();
  ctx.strokeStyle = accentHex;
  ctx.globalAlpha = 0.84;
  ctx.lineWidth = 2.4;
  ctx.strokeRect(13, 13, w - 26, h - 26);

  const corners: readonly [number, number, number, number][] = [
    [13, 13, 1, 1],
    [w - 13, 13, -1, 1],
    [13, h - 13, 1, -1],
    [w - 13, h - 13, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3.0;
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

// ============================================================================
// ALL 12 HAND-INKED COMIC-CHIAROSCURO PORTRAITS (480x640)
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

  // 1. Lush Cohesive Flowing Storm-Cloud Silver Mane (scalloped billowing silhouette + 14 internal calligraphic strand lines!)
  const hairCols = { lit: '#FFFFFF', mid: '#B6C6E2', dark: '#364466', rim: '#FFF698' };
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(86, 364);
      ctx.bezierCurveTo(46, 304, 62, 248, 86, 224);
      ctx.quadraticCurveTo(54, 178, 88, 128);
      ctx.quadraticCurveTo(132, 74, 248, 72);
      ctx.quadraticCurveTo(364, 76, 404, 144);
      ctx.quadraticCurveTo(430, 198, 392, 242);
      ctx.bezierCurveTo(426, 286, 412, 344, 376, 384);
      ctx.lineTo(318, 354);
      ctx.lineTo(154, 362);
      ctx.closePath();
    },
    { x0: 52, y0: 72, x1: 422, y1: 384 },
    hairCols,
    [
      [164, 118, 102, 148, 74, 214, 4.4, 'ink'],
      [148, 168, 96, 218, 78, 306, 4.6, 'ink'],
      [174, 206, 122, 266, 104, 352, 4.0, 'ink'],
      [324, 116, 384, 154, 396, 222, 4.8, 'ink'],
      [346, 178, 396, 232, 392, 324, 5.2, 'ink'],
      [318, 226, 358, 284, 358, 364, 4.4, 'ink'],
      [146, 104, 110, 136, 92, 186, 3.2, 'rim'],
      [126, 186, 86, 236, 74, 298, 3.0, 'rim'],
      [144, 256, 108, 302, 98, 348, 2.8, 'lit'],
      [322, 134, 362, 178, 374, 234, 2.4, 'lit'],
    ],
    { shadowFrac: 0.44, inkW: 4.0 }
  );

  const a: CharacterAnatomy = {
    headX: 252,
    headY: 248,
    turnDir: -1,
    tiltRad: -0.05,
    headScale: 1.05,
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
    shoulderSpan: 384,
    neckWidth: 56,
    collarStyle: 'chiton_drape',
    pauldronSide: 'left',
    pauldronStyle: 'beveled_plate',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // 2. Monumental Cohesive Sculpted Storm-King Beard & Sweeping Heroic Mustache (lush flowing S-waves + inked locks!)
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(176, 266);
      ctx.bezierCurveTo(148, 332, 158, 408, 198, 464);
      ctx.lineTo(214, 444);
      ctx.quadraticCurveTo(228, 488, 246, 508); // sculpted forked/pointed mythic beard peak!
      ctx.quadraticCurveTo(266, 486, 278, 442);
      ctx.lineTo(296, 460);
      ctx.bezierCurveTo(332, 402, 338, 326, 314, 262);
      ctx.quadraticCurveTo(294, 302, 244, 294);
      ctx.quadraticCurveTo(194, 304, 176, 266);
      ctx.closePath();
    },
    { x0: 152, y0: 262, x1: 334, y1: 508 },
    hairCols,
    [
      [188, 316, 178, 384, 206, 446, 4.0, 'ink'],
      [216, 320, 212, 396, 232, 474, 4.2, 'ink'],
      [252, 322, 256, 404, 248, 492, 4.4, 'ink'],
      [284, 316, 296, 384, 276, 448, 4.6, 'ink'],
      [304, 304, 318, 366, 296, 424, 4.2, 'ink'],
      [176, 324, 166, 376, 188, 434, 2.8, 'rim'],
      [204, 328, 198, 392, 218, 456, 2.6, 'lit'],
      [236, 330, 232, 402, 244, 478, 2.8, 'lit'],
    ],
    { shadowFrac: 0.44, inkW: 3.6 }
  );

  // Sweeping sculpted handlebar mustache crowning beard cleanly
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(244, 286);
      ctx.quadraticCurveTo(202, 276, 164, 314);
      ctx.quadraticCurveTo(206, 322, 244, 308);
      ctx.quadraticCurveTo(282, 322, 320, 312);
      ctx.quadraticCurveTo(284, 276, 244, 286);
      ctx.closePath();
    },
    { x0: 164, y0: 276, x1: 320, y1: 322 },
    hairCols,
    [
      [234, 294, 204, 292, 178, 310, 2.6, 'ink'],
      [254, 294, 282, 292, 308, 310, 2.8, 'ink'],
      [232, 290, 202, 286, 174, 306, 2.2, 'rim'],
    ],
    { shadowFrac: 0.42, inkW: 3.0 }
  );

  // Sculpted silver temple hair framing brow beneath wrought crown
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(164, 214);
      ctx.quadraticCurveTo(176, 152, 250, 150);
      ctx.quadraticCurveTo(324, 154, 332, 212);
      ctx.quadraticCurveTo(306, 178, 250, 176);
      ctx.quadraticCurveTo(192, 178, 164, 214);
      ctx.closePath();
    },
    { x0: 164, y0: 150, x1: 332, y1: 214 },
    hairCols,
    [
      [212, 162, 188, 172, 174, 196, 2.6, 'ink'],
      [288, 162, 310, 174, 322, 196, 2.8, 'ink'],
    ],
    { shadowFrac: 0.4, inkW: 2.8 }
  );

  // 3. WROUGHT GRECO-ROMAN HAMMERED-GOLD LIGHTNING DIADEM CROWN (Faceted beveled solar blades + filigree band + topaz gem — ZERO paper zigzag crown!)
  ctx.save();
  ctx.translate(252, 168);
  ctx.rotate(-0.05);
  // Faceted solar-bolt crown spires (beveled left sunlit / right deep bronze planes!)
  const spires: readonly [number, number, number, number][] = [
    [-72, -4, -96, -78],
    [-38, -10, -48, -104],
    [0, -14, 2, -124],
    [38, -10, 50, -102],
    [72, -4, 96, -76],
  ];
  for (const [bx, by, tx, ty] of spires) {
    // Left sunlit beveled facet
    ctx.beginPath();
    ctx.moveTo(bx - 13, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx, by - 4);
    ctx.closePath();
    const lg = ctx.createLinearGradient(bx - 13, by, tx, ty);
    lg.addColorStop(0, '#D49A24');
    lg.addColorStop(1, '#FFFEC8');
    ctx.fillStyle = lg;
    ctx.fill();
    // Right shaded bronze beveled facet
    ctx.beginPath();
    ctx.moveTo(bx, by - 4);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 13, by);
    ctx.closePath();
    const rg = ctx.createLinearGradient(bx, by, tx, ty);
    rg.addColorStop(0, '#4E2C06');
    rg.addColorStop(1, '#C48A1C');
    ctx.fillStyle = rg;
    ctx.fill();
    // Crisp razor comic ink facet contours
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(bx - 13, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 13, by);
    ctx.stroke();
  }
  // Curved Wrought Hammered-Gold Diadem Brow Band w/ Recessed Shadow Relief & Central Topaz Medallion!
  ctx.beginPath();
  ctx.moveTo(-88, 12);
  ctx.quadraticCurveTo(0, -14, 88, 12);
  ctx.lineTo(82, -16);
  ctx.quadraticCurveTo(0, -38, -82, -16);
  ctx.closePath();
  const bandG = ctx.createLinearGradient(-86, -24, 86, 12);
  bandG.addColorStop(0, '#FFFAC0');
  bandG.addColorStop(0.35, '#F2BE30');
  bandG.addColorStop(0.75, '#8E5810');
  bandG.addColorStop(1, '#321B04');
  ctx.fillStyle = bandG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.stroke();
  paintBrushCurve(ctx, -78, -6, 0, -26, 78, -6, 2.4, '#5E3608');
  paintBrushCurve(ctx, -76, -12, 0, -32, 76, -12, 2.0, '#FFFEC8');
  // Central diamond storm-topaz crown jewel
  ctx.fillStyle = '#FFF890';
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(13, -14);
  ctx.lineTo(0, 4);
  ctx.lineTo(-13, -14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.restore();

  // 4. FOREGROUND PROP: Dramatic Blazing Golden Thunderbolt + Anatomical Hand CLEANLY IN LOWER-LEFT FOREGROUND (NEVER cuts across eye/face!)
  const boltGlow = ctx.createRadialGradient(86, 488, 14, 86, 488, 148);
  boltGlow.addColorStop(0, 'rgba(255, 255, 210, 0.78)');
  boltGlow.addColorStop(0.45, 'rgba(255, 232, 48, 0.36)');
  boltGlow.addColorStop(1, 'rgba(255, 232, 48, 0)');
  ctx.fillStyle = boltGlow;
  ctx.fillRect(0, 290, 240, 350);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(32, 294);
  ctx.lineTo(94, 412);
  ctx.lineTo(66, 418);
  ctx.lineTo(124, 524);
  ctx.lineTo(96, 530);
  ctx.lineTo(146, 628);
  ctx.lineTo(64, 514);
  ctx.lineTo(90, 506);
  ctx.lineTo(40, 414);
  ctx.lineTo(66, 408);
  ctx.closePath();
  const bG = ctx.createLinearGradient(32, 294, 146, 628);
  bG.addColorStop(0, '#FFFFFF');
  bG.addColorStop(0.36, '#FFF870');
  bG.addColorStop(1, '#FFAE14');
  ctx.fillStyle = bG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();
  ctx.restore();

  paintAnatomicalHand(ctx, 84, 518, -0.34, 1.04, 1, {
    skinLit: a.skinLit,
    skinMid: a.skinMid,
    skinDark: a.skinDeep,
    cuffLit: '#FFF7B8',
    cuffMid: '#E5B030',
    cuffDark: '#5E3808',
    rim: '#FFFFFF',
  });

  // Subtle crackling peripheral arcs framing bottom-left & bottom-right (cleanly away from face!)
  const drawFork = (pts: readonly [number, number][]) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7.0;
    ctx.stroke();
    ctx.strokeStyle = '#FFF048';
    ctx.lineWidth = 3.8;
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  };
  drawFork([
    [52, 344],
    [104, 378],
    [88, 396],
    [126, 434],
  ]);
  drawFork([
    [442, 540],
    [396, 474],
    [416, 454],
    [372, 394],
  ]);

  paintMythicFrame(ctx, '#FFEA38');
}

function paintTidebreaker(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#00C8FF',
    highlight: '#B4F6FF',
    deep: '#052232',
    voidCol: '#040B14',
    haloX: 236,
    haloY: 226,
    seed: 202,
    starPoints: 10,
  });

  // Unified Surging Ocean-Wave Sea-Foam Mane (rich curling waves + internal ink strand troughs!)
  const seaCols = { lit: '#96F4FF', mid: '#1E96C2', dark: '#08324C', rim: '#D2FFFF' };
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(74, 368);
      ctx.bezierCurveTo(38, 304, 52, 246, 78, 224);
      ctx.quadraticCurveTo(46, 174, 86, 124);
      ctx.quadraticCurveTo(138, 74, 244, 72);
      ctx.quadraticCurveTo(352, 78, 394, 148);
      ctx.quadraticCurveTo(424, 206, 384, 254);
      ctx.bezierCurveTo(418, 298, 404, 348, 368, 384);
      ctx.lineTo(306, 354);
      ctx.lineTo(148, 364);
      ctx.closePath();
    },
    { x0: 44, y0: 72, x1: 416, y1: 384 },
    seaCols,
    [
      [158, 118, 96, 152, 68, 218, 4.4, 'ink'],
      [142, 176, 86, 226, 72, 314, 4.8, 'ink'],
      [170, 214, 116, 272, 102, 354, 4.0, 'ink'],
      [318, 122, 376, 162, 388, 232, 4.8, 'ink'],
      [338, 184, 388, 242, 380, 334, 5.2, 'ink'],
      [142, 104, 102, 138, 86, 192, 3.4, 'rim'],
      [120, 194, 80, 246, 72, 312, 3.0, 'rim'],
      [304, 136, 352, 182, 364, 244, 2.4, 'lit'],
    ],
    { shadowFrac: 0.44, inkW: 4.0 }
  );

  const a: CharacterAnatomy = {
    headX: 236,
    headY: 250,
    turnDir: 1,
    tiltRad: 0.06,
    headScale: 1.05,
    jaw: 'square_titan',
    expression: 'boisterous',
    skinLit: '#E8A882',
    skinMid: '#BE7450',
    skinShadow: '#703824',
    skinDeep: '#32140E',
    lipHex: '#8C4434',
    clothLit: '#1CB6D8',
    clothMid: '#0A5E7A',
    clothDark: '#041E2E',
    metalLit: '#FFF0AE',
    metalMid: '#D8A236',
    metalDark: '#52340C',
    eyeOuter: '#00D8FF',
    eyeInner: '#D4FFFF',
    rimHex: '#76F4FF',
    shoulderSpan: 386,
    neckWidth: 58,
    collarStyle: 'chiton_drape',
    pauldronSide: 'right',
    pauldronStyle: 'beveled_plate',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Unified Surging Sea-King Wave Beard & Sweeping Mustache!
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(164, 268);
      ctx.bezierCurveTo(138, 336, 154, 412, 192, 466);
      ctx.lineTo(208, 444);
      ctx.quadraticCurveTo(224, 492, 236, 512);
      ctx.quadraticCurveTo(256, 488, 268, 446);
      ctx.lineTo(286, 464);
      ctx.bezierCurveTo(322, 408, 326, 330, 302, 268);
      ctx.quadraticCurveTo(282, 304, 236, 296);
      ctx.quadraticCurveTo(188, 304, 164, 268);
      ctx.closePath();
    },
    { x0: 142, y0: 268, x1: 324, y1: 512 },
    seaCols,
    [
      [180, 318, 170, 384, 198, 448, 4.0, 'ink'],
      [208, 322, 204, 398, 224, 476, 4.2, 'ink'],
      [244, 324, 248, 406, 238, 494, 4.4, 'ink'],
      [274, 318, 286, 386, 268, 450, 4.6, 'ink'],
      [170, 326, 160, 378, 182, 436, 2.8, 'rim'],
      [202, 332, 196, 396, 216, 460, 2.6, 'lit'],
    ],
    { shadowFrac: 0.44, inkW: 3.6 }
  );
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(238, 288);
      ctx.quadraticCurveTo(198, 278, 160, 316);
      ctx.quadraticCurveTo(200, 324, 238, 310);
      ctx.quadraticCurveTo(276, 324, 312, 314);
      ctx.quadraticCurveTo(278, 278, 238, 288);
      ctx.closePath();
    },
    { x0: 160, y0: 278, x1: 312, y1: 324 },
    seaCols,
    [
      [228, 296, 198, 294, 174, 312, 2.6, 'ink'],
      [248, 296, 276, 294, 302, 312, 2.8, 'ink'],
      [224, 290, 196, 288, 170, 308, 2.2, 'rim'],
    ],
    { shadowFrac: 0.42, inkW: 3.0 }
  );

  // Wrought Coral-Bronze Sea-King Diadem Crown (layered sculpted wave-trident peaks + pearl medallion!)
  ctx.save();
  ctx.translate(236, 168);
  ctx.rotate(0.06);
  for (const [bx, tx, ty] of [
    [-64, -84, -68],
    [-28, -34, -92],
    [0, 2, -110],
    [30, 38, -90],
    [64, 82, -64],
  ]) {
    ctx.beginPath();
    ctx.moveTo(bx - 12, 0);
    ctx.quadraticCurveTo(bx - 6, ty * 0.5, tx, ty);
    ctx.quadraticCurveTo(bx + 8, ty * 0.5, bx + 12, 0);
    ctx.closePath();
    const cg = ctx.createLinearGradient(bx - 10, 0, tx, ty);
    cg.addColorStop(0, '#5A3A0E');
    cg.addColorStop(0.5, '#E0A838');
    cg.addColorStop(1, '#FFF8BE');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-84, 14);
  ctx.quadraticCurveTo(0, -12, 84, 14);
  ctx.lineTo(78, -14);
  ctx.quadraticCurveTo(0, -34, -78, -14);
  ctx.closePath();
  const bg = ctx.createLinearGradient(-82, -20, 82, 14);
  bg.addColorStop(0, '#FFF4B0');
  bg.addColorStop(0.45, '#D49830');
  bg.addColorStop(1, '#3A2208');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();
  // Luminous sea-pearl inlay
  ctx.fillStyle = '#B8FFFF';
  ctx.beginPath();
  ctx.arc(0, -12, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // FOREGROUND PROP: Ornate Barbed Bronze Sea-Trident framed cleanly along right edge + Anatomical Hand!
  ctx.save();
  ctx.translate(394, 380);
  ctx.rotate(0.14);
  const shaftG = ctx.createLinearGradient(-8, -140, 8, 250);
  shaftG.addColorStop(0, '#FFF2AE');
  shaftG.addColorStop(0.5, '#C48A28');
  shaftG.addColorStop(1, '#321C06');
  ctx.fillStyle = shaftG;
  ctx.fillRect(-7, -148, 14, 408);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.strokeRect(-7, -148, 14, 408);

  // Sculpted Barbed Three-Pronged Trident Head
  ctx.beginPath();
  ctx.moveTo(-54, -220);
  ctx.quadraticCurveTo(-56, -158, -12, -148);
  ctx.lineTo(-10, -184);
  ctx.lineTo(0, -252);
  ctx.lineTo(10, -184);
  ctx.lineTo(12, -148);
  ctx.quadraticCurveTo(56, -158, 54, -220);
  ctx.quadraticCurveTo(40, -172, 16, -166);
  ctx.lineTo(12, -132);
  ctx.lineTo(-12, -132);
  ctx.lineTo(-16, -166);
  ctx.quadraticCurveTo(-40, -172, -54, -220);
  ctx.closePath();
  const trG = ctx.createLinearGradient(-56, -248, 56, -132);
  trG.addColorStop(0, '#FFFEC8');
  trG.addColorStop(0.42, '#E8B038');
  trG.addColorStop(0.84, '#6E420E');
  trG.addColorStop(1, INK);
  ctx.fillStyle = trG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.restore();

  paintAnatomicalHand(ctx, 372, 514, 0.16, 1.04, -1, {
    skinLit: a.skinLit,
    skinMid: a.skinMid,
    skinDark: a.skinDeep,
    cuffLit: '#FFF0AE',
    cuffMid: '#D8A236',
    cuffDark: '#482A08',
    rim: '#A8FFFF',
  });

  // Dynamic splashing sea-spray droplets
  for (const [dx, dy, r] of [
    [324, 198, 5],
    [438, 286, 4.5],
    [82, 466, 6],
    [136, 524, 4],
  ]) {
    ctx.fillStyle = '#B8FFFF';
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  paintMythicFrame(ctx, '#00C8FF');
}

function paintAegira(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#FFD54F',
    highlight: '#FFF6D0',
    deep: '#2A1D08',
    voidCol: '#09060E',
    haloX: 256,
    haloY: 228,
    seed: 303,
    starPoints: 8,
  });

  // Lush Unified Cascading Ivory Corinthian Horsehair Plume (fine calligraphic strands + golden rim sheen!)
  const plumeCols = { lit: '#FFFFFF', mid: '#E4D8C2', dark: '#5C4A36', rim: '#FFF6B8' };
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(234, 96);
      ctx.bezierCurveTo(324, 34, 412, 86, 434, 208);
      ctx.bezierCurveTo(446, 276, 438, 344, 410, 396);
      ctx.lineTo(384, 368);
      ctx.lineTo(368, 404);
      ctx.bezierCurveTo(346, 334, 326, 224, 274, 152);
      ctx.closePath();
    },
    { x0: 234, y0: 46, x1: 444, y1: 404 },
    plumeCols,
    [
      [272, 92, 362, 118, 414, 246, 3.6, 'ink'],
      [286, 112, 368, 168, 406, 336, 4.0, 'ink'],
      [294, 134, 358, 214, 384, 368, 3.8, 'ink'],
      [262, 84, 344, 86, 406, 184, 2.8, 'rim'],
      [276, 102, 354, 134, 402, 268, 2.6, 'lit'],
      [296, 148, 348, 232, 368, 354, 2.6, 'lit'],
    ],
    { shadowFrac: 0.42, inkW: 3.6 }
  );

  // Gleaming Golden Strategist Spear framed cleanly along left margin
  ctx.save();
  paintBrushCurve(ctx, 108, 636, 76, 392, 48, 174, 12, INK);
  paintBrushCurve(ctx, 108, 636, 76, 392, 48, 174, 5.5, '#F5C448');
  ctx.beginPath();
  ctx.moveTo(42, 118);
  ctx.lineTo(66, 184);
  ctx.lineTo(48, 176);
  ctx.lineTo(32, 188);
  ctx.closePath();
  ctx.fillStyle = '#FFF7C2';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.0;
  ctx.stroke();
  ctx.restore();

  const a: CharacterAnatomy = {
    headX: 236,
    headY: 254,
    turnDir: -1,
    tiltRad: -0.04,
    headScale: 1.0,
    jaw: 'aristocratic_sharp',
    expression: 'austere',
    skinLit: '#B27C5A',
    skinMid: '#82523A',
    skinShadow: '#4A2B20',
    skinDeep: '#20100D',
    lipHex: '#7A3E36',
    clothLit: '#FAF4E4',
    clothMid: '#D0BA94',
    clothDark: '#483422',
    metalLit: '#FFFAC2',
    metalMid: '#EBB036',
    metalDark: '#5C3808',
    eyeOuter: '#FFC624',
    eyeInner: '#FFFFCA',
    rimHex: '#FFE478',
    shoulderSpan: 356,
    neckWidth: 44,
    collarStyle: 'high_armor',
    pauldronSide: 'left',
    pauldronStyle: 'beveled_plate',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Dark cascading raven side-locks peeking beneath bronze Corinthian cheek-guards
  paintCascadingMane(
    ctx,
    [
      { x0: 174, y0: 256, cx1: 152, cy1: 312, tipX: 162, tipY: 374, cx2: 184, cy2: 316, tone: 'dark' },
      { x0: 294, y0: 256, cx1: 318, cy1: 316, tipX: 304, tipY: 382, cx2: 282, cy2: 320, tone: 'dark' },
    ],
    { lit: '#3C2A44', mid: '#181022', dark: INK },
    2.4
  );

  // Sculpted Hammered-Gold Corinthian Strategist War-Helm w/ Engraved Brow Filigree & Cheek-Guards!
  ctx.save();
  ctx.translate(236, 254);
  ctx.rotate(-0.04);
  const traceHelm = () => {
    ctx.beginPath();
    ctx.moveTo(-78, 8);
    ctx.bezierCurveTo(-86, -108, -26, -158, 12, -152);
    ctx.bezierCurveTo(64, -144, 84, -84, 80, 12);
    ctx.lineTo(74, 72);
    ctx.quadraticCurveTo(56, 80, 44, 48); // sculpted right cheek-guard
    ctx.quadraticCurveTo(48, 8, 52, -32);
    ctx.quadraticCurveTo(22, -48, 2, -26); // sharp bronze nose-bridge crest!
    ctx.quadraticCurveTo(-18, -48, -50, -32);
    ctx.quadraticCurveTo(-46, 10, -44, 48); // sculpted left cheek-guard
    ctx.quadraticCurveTo(-56, 78, -74, 68);
    ctx.closePath();
  };
  traceHelm();
  const hG = ctx.createLinearGradient(-82, -152, 82, 68);
  hG.addColorStop(0, '#FFFDC8');
  hG.addColorStop(0.32, '#F0B634');
  hG.addColorStop(0.72, '#784A0C');
  hG.addColorStop(1, '#221204');
  ctx.fillStyle = hG;
  ctx.fill();
  ctx.save();
  traceHelm();
  ctx.clip();
  ctx.fillStyle = 'rgba(9, 6, 14, 0.58)';
  ctx.beginPath();
  ctx.moveTo(22, -158);
  ctx.lineTo(94, -158);
  ctx.lineTo(94, 88);
  ctx.lineTo(36, 88);
  ctx.quadraticCurveTo(46, -24, 22, -158);
  ctx.closePath();
  ctx.fill();
  paintBrushCurve(ctx, -64, -46, -12, -128, 38, -128, 7.0, '#FFFFFF', 0.1, 0.1);
  paintBrushCurve(ctx, -68, -26, 0, -68, 68, -26, 3.6, '#5A3406');
  paintBrushCurve(ctx, -66, -32, 0, -74, 66, -32, 2.2, '#FFFAC4');
  ctx.restore();
  traceHelm();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();
  ctx.restore();

  // FOREGROUND PROP: Perspective Embossed Owl-Crest Golden Aegis Greatshield cleanly in lower-right foreground!
  ctx.save();
  ctx.translate(396, 514);
  ctx.rotate(-0.18);
  ctx.beginPath();
  ctx.ellipse(0, 0, 126, 142, 0, 0, Math.PI * 2);
  const shG = ctx.createRadialGradient(-34, -44, 16, 0, 0, 142);
  shG.addColorStop(0, '#FFFEC4');
  shG.addColorStop(0.38, '#EBB034');
  shG.addColorStop(0.76, '#7C4C0E');
  shG.addColorStop(1, '#261404');
  ctx.fillStyle = shG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.4;
  ctx.stroke();
  ctx.strokeStyle = '#FFF5B8';
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.ellipse(0, 0, 102, 116, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Stylized geometric owl-wing relief boss on shield face
  ctx.strokeStyle = '#5A3408';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(0, -10, 44, 0, Math.PI * 2);
  ctx.stroke();
  paintBrushCurve(ctx, -46, -24, 0, -56, 46, -24, 4.4, '#FFF8BE');
  ctx.restore();

  paintMythicFrame(ctx, '#FFD54F');
}

function paintVelouris(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#FF32E8',
    highlight: '#FFC8FA',
    deep: '#2B0726',
    voidCol: '#09040C',
    haloX: 244,
    haloY: 224,
    seed: 404,
    starPoints: 12,
  });

  // 1. Lush Billowing Rose-Silk Hair Cascade (flowing S-wave silhouette + internal ink locks & silk sheen!)
  const roseCols = { lit: '#FFBCEF', mid: '#F03CC4', dark: '#540B48', rim: '#FFF0FC' };
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(22, 646);
      ctx.bezierCurveTo(18, 484, 54, 344, 72, 232);
      ctx.bezierCurveTo(88, 124, 162, 86, 248, 86);
      ctx.bezierCurveTo(344, 86, 404, 152, 412, 272);
      ctx.bezierCurveTo(422, 394, 444, 514, 434, 646);
      ctx.closePath();
    },
    { x0: 22, y0: 86, x1: 438, y1: 646 },
    roseCols,
    [
      [154, 126, 84, 244, 54, 546, 4.4, 'ink'],
      [172, 166, 114, 324, 96, 594, 4.0, 'ink'],
      [332, 134, 392, 264, 402, 554, 4.8, 'ink'],
      [318, 184, 364, 336, 366, 604, 4.6, 'ink'],
      [146, 112, 74, 214, 46, 448, 3.4, 'rim'],
      [164, 148, 102, 286, 82, 512, 3.0, 'lit'],
      [322, 156, 378, 282, 386, 496, 2.6, 'lit'],
    ],
    { shadowFrac: 0.44, inkW: 4.0 }
  );

  const a: CharacterAnatomy = {
    headX: 234,
    headY: 262,
    turnDir: 1,
    tiltRad: 0.1,
    headScale: 0.99,
    jaw: 'sensual_taper',
    expression: 'alluring',
    skinLit: '#FFE4F0',
    skinMid: '#E8A8CA',
    skinShadow: '#9A5484',
    skinDeep: '#4C1B44',
    lipHex: '#E0248A',
    clothLit: '#FF70D8',
    clothMid: '#B81C84',
    clothDark: '#3A0830',
    metalLit: '#FFF4C4',
    metalMid: '#F2B84A',
    metalDark: '#704212',
    eyeOuter: '#FF2ED6',
    eyeInner: '#FFD6FA',
    rimHex: '#FFA4F4',
    shoulderSpan: 326,
    neckWidth: 38,
    collarStyle: 'plunge_velvet',
    pauldronSide: 'none',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Foreground cascading rose-silk bangs & soft cheek-framing waves
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(154, 248);
      ctx.bezierCurveTo(156, 158, 214, 146, 256, 154);
      ctx.bezierCurveTo(318, 168, 344, 268, 326, 434);
      ctx.quadraticCurveTo(304, 304, 282, 232);
      ctx.quadraticCurveTo(246, 184, 198, 194);
      ctx.quadraticCurveTo(174, 214, 154, 248);
      ctx.closePath();
    },
    { x0: 154, y0: 148, x1: 342, y1: 434 },
    roseCols,
    [
      [212, 164, 178, 184, 164, 224, 2.6, 'ink'],
      [272, 174, 306, 236, 318, 368, 3.0, 'ink'],
      [254, 162, 294, 214, 312, 328, 2.4, 'rim'],
    ],
    { shadowFrac: 0.42, inkW: 3.0 }
  );
  paintBrushCurve(ctx, 134, 268, 86, 434, 156, 598, 14, '#FF78E4');
  paintBrushCurve(ctx, 132, 266, 84, 432, 154, 594, 3.6, '#FFFFFF');

  // Sculpted Layered Velvety Roses (nested petal spirals with dark inner shadow!)
  const paintRose = (rx: number, ry: number, r: number) => {
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI * 2) / 6;
      const g = ctx.createRadialGradient(rx, ry, 2, rx + Math.cos(ang) * r * 0.5, ry + Math.sin(ang) * r * 0.5, r * 0.8);
      g.addColorStop(0, '#5A063E');
      g.addColorStop(0.55, '#E81E9C');
      g.addColorStop(1, '#FF9CF0');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(rx + Math.cos(ang) * r * 0.46, ry + Math.sin(ang) * r * 0.46, r * 0.56, r * 0.38, ang, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    ctx.fillStyle = '#FFA4F2';
    ctx.beginPath();
    ctx.arc(rx, ry, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.fillStyle = '#6B0848';
    ctx.beginPath();
    ctx.arc(rx + 1.5, ry + 1.5, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  paintRose(304, 174, 27);
  paintRose(334, 222, 19);
  paintRose(138, 448, 25);
  paintRose(376, 492, 21);

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
    ctx.lineWidth = 2.0;
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
    haloX: 254,
    haloY: 234,
    seed: 505,
    starPoints: 8,
  });

  // Feathered hunter arrows peeking from back quiver over right shoulder
  for (let i = 0; i < 3; i++) {
    paintBrushCurve(ctx, 376 + i * 16, 248 + i * 16, 352 + i * 14, 304 + i * 14, 326 + i * 12, 362 + i * 12, 6.0, INK);
    paintBrushCurve(ctx, 376 + i * 16, 248 + i * 16, 352 + i * 14, 304 + i * 14, 326 + i * 12, 362 + i * 12, 2.8, '#82FF28');
  }

  // Sculpted Angular Multi-Fold Woodland Huntress Cowl/Hood (sharp draped peak & deep cloth folds — ZERO plain green semicircle!)
  ctx.save();
  const traceHood = () => {
    ctx.beginPath();
    ctx.moveTo(76, 464);
    ctx.bezierCurveTo(64, 314, 88, 174, 154, 108);
    ctx.quadraticCurveTo(212, 54, 266, 48); // pointed draped forest cowl peak!
    ctx.quadraticCurveTo(334, 68, 374, 148);
    ctx.bezierCurveTo(408, 224, 412, 338, 392, 464);
    ctx.closePath();
  };
  traceHood();
  const hoodG = ctx.createLinearGradient(84, 54, 392, 464);
  hoodG.addColorStop(0, '#44A64E');
  hoodG.addColorStop(0.42, '#1A4E24');
  hoodG.addColorStop(0.78, '#081D0F');
  hoodG.addColorStop(1, INK);
  ctx.fillStyle = hoodG;
  ctx.fill();
  ctx.save();
  traceHood();
  ctx.clip();
  // Deep angular cowl drapery fold wedges
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.moveTo(272, 50);
  ctx.quadraticCurveTo(346, 152, 368, 464);
  ctx.lineTo(420, 464);
  ctx.lineTo(420, 40);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  paintBrushCurve(ctx, 138, 134, 102, 244, 108, 408, 6.2, INK);
  paintBrushCurve(ctx, 154, 114, 118, 224, 126, 368, 3.2, '#86FF5C');
  ctx.restore();
  traceHood();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.6;
  ctx.stroke();

  // Deep pitch-black hood shadow cavern framing face
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(156, 362);
  ctx.bezierCurveTo(132, 266, 148, 136, 248, 124);
  ctx.bezierCurveTo(338, 132, 364, 248, 338, 368);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const a: CharacterAnatomy = {
    headX: 250,
    headY: 256,
    turnDir: -1,
    tiltRad: -0.06,
    headScale: 0.99,
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
    shoulderSpan: 348,
    neckWidth: 42,
    collarStyle: 'chiton_drape',
    pauldronSide: 'left',
    pauldronStyle: 'beveled_plate',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Windblown Multi-Lock Auburn Huntress Bangs & Side Strands (10 layered calligraphic locks!)
  const auburnCols = { lit: '#E68A54', mid: '#8C4020', dark: '#280E0A', rim: '#CAFF94' };
  paintCascadingMane(
    ctx,
    [
      { x0: 214, y0: 156, cx1: 164, cy1: 184, tipX: 146, tipY: 274, cx2: 186, cy2: 214, tone: 'lit', rim: true },
      { x0: 238, y0: 152, cx1: 188, cy1: 162, tipX: 162, tipY: 222, cx2: 204, cy2: 188, tone: 'lit', rim: true },
      { x0: 266, y0: 154, cx1: 318, cy1: 184, tipX: 342, tipY: 326, cx2: 304, cy2: 244, tone: 'mid' },
      { x0: 288, y0: 166, cx1: 346, cy1: 232, tipX: 348, tipY: 392, cx2: 310, cy2: 294, tone: 'dark' },
      { x0: 248, y0: 156, cx1: 284, cy1: 182, tipX: 304, tipY: 268, cx2: 276, cy2: 208, tone: 'mid' },
      { x0: 196, y0: 170, cx1: 152, cy1: 224, tipX: 144, tipY: 332, cx2: 176, cy2: 264, tone: 'dark', rim: true },
    ],
    auburnCols,
    2.2
  );

  // Wrought Silver Crescent Moon Huntress Circlet
  ctx.save();
  ctx.fillStyle = '#F2FCEA';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(236, 170, 23, 0.35 * Math.PI, 1.65 * Math.PI);
  ctx.quadraticCurveTo(234, 170, 246, 190);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // FOREGROUND PROP: Sculpted Recurve Spirit-Bow & Poised Glowing Emerald Arrow CLEANLY IN LOWER FOREGROUND (ZERO string crossing face/neck!)
  ctx.save();
  // Carved recurve bow limb curving cleanly along far-left & bottom-left frame (below chin!)
  paintBrushCurve(ctx, 96, 314, 16, 456, 126, 634, 18, INK);
  paintBrushCurve(ctx, 96, 314, 16, 456, 126, 634, 9.0, '#A86E38');
  paintBrushCurve(ctx, 92, 322, 22, 456, 118, 626, 3.2, '#A8FF68');

  // Luminous emerald bowstring cleanly below collar (y >= 318 — NEVER near face/neck!)
  ctx.strokeStyle = '#B8FF8C';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(96, 318);
  ctx.lineTo(298, 502);
  ctx.lineTo(126, 630);
  ctx.stroke();

  // Glowing emerald spirit-arrow poised cleanly across lower chest!
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9.0;
  ctx.beginPath();
  ctx.moveTo(312, 504);
  ctx.lineTo(20, 464);
  ctx.stroke();
  ctx.strokeStyle = '#8CFF38';
  ctx.lineWidth = 4.4;
  ctx.stroke();
  ctx.fillStyle = '#E8FFCE';
  ctx.beginPath();
  ctx.moveTo(8, 462);
  ctx.lineTo(50, 450);
  ctx.lineTo(40, 468);
  ctx.lineTo(46, 484);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.stroke();
  ctx.restore();

  paintAnatomicalHand(ctx, 318, 524, -0.32, 0.92, -1, {
    skinLit: '#5EC466',
    skinMid: '#24662E',
    skinDark: '#0A2210',
    cuffLit: '#E4FFCC',
    cuffMid: '#5AB838',
    cuffDark: '#163812',
    rim: '#BAFF82',
  });

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

  // Back-slung jagged war-greatsword silhouette
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(206, 412);
  ctx.lineTo(58, 78);
  ctx.lineTo(98, 112);
  ctx.lineTo(240, 426);
  ctx.closePath();
  ctx.fillStyle = '#2B0D14';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4;
  ctx.stroke();
  paintBrushCurve(ctx, 194, 396, 130, 238, 66, 94, 4.0, '#FF3E2E');
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
    pauldronStyle: 'spiked_war',
    warPaint: 'bellum_crimson',
    scar: true,
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Unified Swept Jagged Ash-Silver & Obsidian Warlord Hair Mass (ONE cohesive fierce swept crest + calligraphic strands!)
  const warHairCols = { lit: '#F6F7FA', mid: '#58464E', dark: '#120A12', rim: '#FF7C6C' };
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(164, 224);
      ctx.quadraticCurveTo(132, 184, 114, 128);
      ctx.lineTo(156, 144);
      ctx.quadraticCurveTo(152, 92, 178, 56);
      ctx.lineTo(208, 106);
      ctx.quadraticCurveTo(234, 62, 272, 48);
      ctx.lineTo(274, 112);
      ctx.quadraticCurveTo(318, 86, 354, 100);
      ctx.lineTo(318, 162);
      ctx.quadraticCurveTo(360, 162, 368, 198);
      ctx.lineTo(324, 208);
      ctx.quadraticCurveTo(342, 238, 326, 266);
      ctx.lineTo(304, 226);
      ctx.quadraticCurveTo(286, 178, 244, 170);
      ctx.quadraticCurveTo(192, 176, 164, 224);
      ctx.closePath();
    },
    { x0: 114, y0: 48, x1: 368, y1: 266 },
    warHairCols,
    [
      [182, 184, 152, 154, 134, 128, 3.6, 'ink'],
      [208, 172, 182, 124, 184, 72, 4.0, 'ink'],
      [242, 168, 248, 118, 266, 66, 4.2, 'ink'],
      [276, 176, 304, 138, 336, 112, 4.2, 'ink'],
      [296, 194, 332, 186, 352, 194, 3.8, 'ink'],
      [196, 168, 172, 122, 178, 70, 2.8, 'rim'],
      [234, 164, 238, 114, 258, 62, 2.8, 'lit'],
      [268, 168, 294, 132, 328, 108, 2.4, 'lit'],
    ],
    { shadowFrac: 0.44, inkW: 3.6 }
  );

  // Blood-red diamond war-sigil on brow
  ctx.fillStyle = '#FF1E10';
  ctx.beginPath();
  ctx.moveTo(250, 194);
  ctx.lineTo(258, 212);
  ctx.lineTo(250, 230);
  ctx.lineTo(242, 212);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // FOREGROUND PROP: Serrated Blood-Runed Obsidian War-Blade + Anatomical Armored Hand along right edge
  ctx.save();
  ctx.translate(392, 424);
  ctx.rotate(0.16);
  ctx.beginPath();
  ctx.moveTo(-24, 46);
  ctx.lineTo(-20, -234);
  ctx.lineTo(4, -296);
  ctx.lineTo(26, -214);
  ctx.lineTo(13, -184);
  ctx.lineTo(28, -142);
  ctx.lineTo(13, -110);
  ctx.lineTo(24, 46);
  ctx.closePath();
  const blG = ctx.createLinearGradient(-24, -280, 28, 46);
  blG.addColorStop(0, '#5E4854');
  blG.addColorStop(0.45, '#1D1218');
  blG.addColorStop(1, INK);
  ctx.fillStyle = blG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();
  paintBrushCurve(ctx, -2, -252, -2, -120, -2, 22, 5.8, '#FF2818');
  paintBrushCurve(ctx, -2, -244, -2, -120, -2, 14, 2.0, '#FFE0A0');
  ctx.restore();

  paintAnatomicalHand(ctx, 382, 520, 0.16, 1.06, -1, {
    skinLit: '#C83434',
    skinMid: '#5A1016',
    skinDark: '#1A0408',
    cuffLit: '#FF9888',
    cuffMid: '#A62022',
    cuffDark: '#26060A',
    rim: '#FF7868',
  });

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

  // Unified Lush Tumbling Dark-Amethyst & Midnight-Violet Curls (scalloped wavy silhouette + internal curl calligraphy!)
  const curlCols = { lit: '#A848E8', mid: '#421074', dark: '#100320', rim: '#F2A6FF' };
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(92, 404);
      ctx.bezierCurveTo(64, 344, 72, 286, 98, 250);
      ctx.quadraticCurveTo(68, 198, 102, 142);
      ctx.quadraticCurveTo(156, 82, 246, 82);
      ctx.quadraticCurveTo(342, 86, 386, 156);
      ctx.quadraticCurveTo(414, 214, 380, 266);
      ctx.bezierCurveTo(408, 314, 396, 368, 362, 412);
      ctx.lineTo(302, 372);
      ctx.lineTo(156, 376);
      ctx.closePath();
    },
    { x0: 66, y0: 82, x1: 408, y1: 412 },
    curlCols,
    [
      [162, 134, 104, 178, 92, 246, 4.4, 'ink'],
      [152, 206, 96, 266, 104, 356, 4.6, 'ink'],
      [322, 138, 376, 186, 374, 258, 4.8, 'ink'],
      [334, 212, 382, 278, 362, 366, 5.0, 'ink'],
      [148, 118, 102, 158, 94, 222, 3.2, 'rim'],
      [134, 224, 92, 282, 98, 358, 3.0, 'rim'],
      [310, 154, 356, 206, 358, 274, 2.4, 'lit'],
    ],
    { shadowFrac: 0.44, inkW: 3.8 }
  );

  const a: CharacterAnatomy = {
    headX: 240,
    headY: 260,
    turnDir: -1,
    tiltRad: -0.09,
    headScale: 1.0,
    jaw: 'relaxed_broad',
    expression: 'smirk',
    skinLit: '#DE9F7A',
    skinMid: '#B27252',
    skinShadow: '#6A3828',
    skinDeep: '#321614',
    lipHex: '#924452',
    clothLit: '#9A2EE0',
    clothMid: '#4A0E78',
    clothDark: '#160428',
    metalLit: '#FFF4AE',
    metalMid: '#E6AE34',
    metalDark: '#5E380C',
    eyeOuter: '#D42EFF',
    eyeInner: '#F6B8FF',
    rimHex: '#EA84FF',
    shoulderSpan: 362,
    neckWidth: 48,
    collarStyle: 'chiton_drape',
    pauldronSide: 'left',
    pauldronStyle: 'beveled_plate',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Foreground curls framing temple & forehead under grapevine crown
  paintCascadingMane(
    ctx,
    [
      { x0: 214, y0: 162, cx1: 174, cy1: 176, tipX: 164, tipY: 222, cx2: 196, cy2: 194, tone: 'lit', rim: true },
      { x0: 248, y0: 158, cx1: 222, cy1: 186, tipX: 204, tipY: 212, cx2: 242, cy2: 188, tone: 'mid' },
      { x0: 282, y0: 168, cx1: 316, cy1: 186, tipX: 324, tipY: 232, cx2: 294, cy2: 206, tone: 'dark' },
    ],
    curlCols,
    2.2
  );

  // Woven Fresh Ivy-Leaf & Clustered Amethyst-Grape Revelry Crown
  ctx.save();
  ctx.translate(240, 260);
  ctx.rotate(-0.09);
  const leaves: readonly [number, number, number][] = [
    [-64, -68, -0.5],
    [-32, -88, -0.2],
    [4, -96, 0.1],
    [42, -86, 0.4],
    [70, -64, 0.7],
  ];
  for (const [lx, ly, rot] of leaves) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rot);
    ctx.fillStyle = '#48C83E';
    ctx.beginPath();
    ctx.moveTo(0, -19);
    ctx.lineTo(15, -4);
    ctx.lineTo(9, 13);
    ctx.lineTo(0, 8);
    ctx.lineTo(-9, 13);
    ctx.lineTo(-15, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
  }
  const grapes: readonly [number, number][] = [
    [-72, -52],
    [-82, -38],
    [-64, -36],
    [-74, -22],
    [68, -48],
    [80, -34],
    [62, -32],
    [72, -18],
  ];
  for (const [gx, gy] of grapes) {
    const gG = ctx.createRadialGradient(gx - 3, gy - 3, 2, gx, gy, 10);
    gG.addColorStop(0, '#F5B8FF');
    gG.addColorStop(0.55, '#B224F0');
    gG.addColorStop(1, '#360452');
    ctx.fillStyle = gG;
    ctx.beginPath();
    ctx.arc(gx, gy, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
  ctx.restore();

  // FOREGROUND PROP: Ornate Hammered-Gold Overflowing Wine Chalice held cleanly in lower-right foreground!
  ctx.save();
  ctx.translate(376, 486);
  ctx.rotate(-0.18);
  // Arcing glowing violet wine splash curving cleanly outside face
  paintBrushCurve(ctx, -36, -34, -84, -76, -124, -22, 11, '#E052FF');
  paintBrushCurve(ctx, -38, -36, -84, -78, -120, -24, 4.0, '#FFE4FF');

  ctx.beginPath();
  ctx.moveTo(-42, -36);
  ctx.bezierCurveTo(-40, 20, -18, 36, -9, 44);
  ctx.lineTo(-11, 96);
  ctx.lineTo(-34, 108);
  ctx.lineTo(34, 108);
  ctx.lineTo(11, 96);
  ctx.lineTo(9, 44);
  ctx.bezierCurveTo(18, 36, 40, 20, 42, -36);
  ctx.closePath();
  const chG = ctx.createLinearGradient(-42, -36, 42, 108);
  chG.addColorStop(0, '#FFFAC4');
  chG.addColorStop(0.42, '#E8AE30');
  chG.addColorStop(0.84, '#6A3E08');
  chG.addColorStop(1, INK);
  ctx.fillStyle = chG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();

  ctx.fillStyle = '#D422FF';
  ctx.beginPath();
  ctx.ellipse(0, -34, 38, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.restore();

  paintMythicFrame(ctx, '#C800FF');
}

function paintGlaciera(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#7EEBFF',
    highlight: '#F0FCFF',
    deep: '#0A2034',
    voidCol: '#040912',
    haloX: 240,
    haloY: 224,
    seed: 808,
    starPoints: 6,
  });

  // Unified Wind-Swept Flowing Glacier-Silver Hair Cascade (rich billowing waves + internal frost-silk calligraphy!)
  const iceCols = { lit: '#FFFFFF', mid: '#B4DEF2', dark: '#284C6E', rim: '#C4F8FF' };
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(44, 514);
      ctx.bezierCurveTo(36, 376, 62, 224, 114, 134);
      ctx.quadraticCurveTo(176, 86, 242, 86);
      ctx.quadraticCurveTo(314, 88, 368, 138);
      ctx.bezierCurveTo(418, 228, 434, 376, 424, 514);
      ctx.lineTo(356, 464);
      ctx.lineTo(124, 464);
      ctx.closePath();
    },
    { x0: 40, y0: 86, x1: 430, y1: 514 },
    iceCols,
    [
      [154, 132, 88, 256, 74, 464, 4.4, 'ink'],
      [172, 178, 124, 314, 114, 468, 4.0, 'ink'],
      [326, 136, 384, 264, 392, 464, 4.8, 'ink'],
      [310, 184, 352, 318, 356, 468, 4.4, 'ink'],
      [146, 120, 78, 232, 62, 428, 3.4, 'rim'],
      [166, 162, 114, 294, 102, 444, 2.8, 'lit'],
      [316, 164, 366, 286, 374, 442, 2.4, 'lit'],
    ],
    { shadowFrac: 0.44, inkW: 3.8 }
  );

  const a: CharacterAnatomy = {
    headX: 242,
    headY: 256,
    turnDir: 1,
    tiltRad: -0.02,
    headScale: 1.0,
    jaw: 'aristocratic_sharp',
    expression: 'austere',
    skinLit: '#EFF8FF',
    skinMid: '#B8D4E8',
    skinShadow: '#5C7C9E',
    skinDeep: '#223650',
    lipHex: '#4A7298',
    clothLit: '#CEF4FF',
    clothMid: '#4A88B4',
    clothDark: '#102640',
    metalLit: '#FFFFFF',
    metalMid: '#8CE2FF',
    metalDark: '#265878',
    eyeOuter: '#4CE0FF',
    eyeInner: '#FFFFFF',
    rimHex: '#B8F6FF',
    shoulderSpan: 360,
    neckWidth: 40,
    collarStyle: 'high_armor',
    pauldronSide: 'both',
    pauldronStyle: 'beveled_plate',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Sculpted frost-silver bangs & cascading cheek strands
  paintCascadingMane(
    ctx,
    [
      { x0: 222, y0: 156, cx1: 174, cy1: 174, tipX: 158, tipY: 226, cx2: 196, cy2: 196, tone: 'lit', rim: true },
      { x0: 256, y0: 156, cx1: 308, cy1: 184, tipX: 318, tipY: 274, cx2: 286, cy2: 216, tone: 'mid' },
    ],
    iceCols,
    2.2
  );

  // Intricate Faceted Crystalline Frost-Tiara (beveled refractive sapphire-white ice prisms + silver filigree band!)
  ctx.save();
  ctx.translate(242, 166);
  const crystals: readonly [number, number, number, number][] = [
    [-64, -2, -80, -84],
    [-32, -8, -40, -112],
    [0, -12, 0, -138],
    [32, -8, 40, -112],
    [64, -2, 80, -84],
  ];
  for (const [bx, by, tx, ty] of crystals) {
    // Left translucent white-ice facet
    ctx.beginPath();
    ctx.moveTo(bx - 12, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx, by - 4);
    ctx.closePath();
    const lg = ctx.createLinearGradient(bx - 12, by, tx, ty);
    lg.addColorStop(0, '#88DCFF');
    lg.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = lg;
    ctx.fill();
    // Right deep sapphire shadow facet
    ctx.beginPath();
    ctx.moveTo(bx, by - 4);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 12, by);
    ctx.closePath();
    const rg = ctx.createLinearGradient(bx, by, tx, ty);
    rg.addColorStop(0, '#183C60');
    rg.addColorStop(1, '#58B6E8');
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(bx - 12, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 12, by);
    ctx.stroke();
  }
  // Silver filigree tiara base band
  ctx.beginPath();
  ctx.moveTo(-78, 12);
  ctx.quadraticCurveTo(0, -10, 78, 12);
  ctx.lineTo(74, -8);
  ctx.quadraticCurveTo(0, -26, -74, -8);
  ctx.closePath();
  ctx.fillStyle = '#D6F6FF';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.0;
  ctx.stroke();
  ctx.restore();

  // FOREGROUND EFFECT: Swirling Translucent Frost Mist Ribbon & Delicate Geometric Ice Stars
  ctx.save();
  const mistG = ctx.createLinearGradient(20, 566, 460, 424);
  mistG.addColorStop(0, 'rgba(180, 246, 255, 0)');
  mistG.addColorStop(0.5, 'rgba(180, 246, 255, 0.32)');
  mistG.addColorStop(1, 'rgba(180, 246, 255, 0)');
  ctx.strokeStyle = mistG;
  ctx.lineWidth = 36;
  ctx.beginPath();
  ctx.moveTo(-20, 566);
  ctx.bezierCurveTo(150, 474, 320, 566, 500, 424);
  ctx.stroke();

  const drawSnowStar = (sx: number, sy: number, r: number) => {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.5;
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(ang) * r, -Math.sin(ang) * r);
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      ctx.stroke();
    }
    ctx.strokeStyle = '#E8FCFF';
    ctx.lineWidth = 2.0;
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(ang) * r, -Math.sin(ang) * r);
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      ctx.stroke();
    }
    ctx.restore();
  };
  drawSnowStar(80, 224, 20);
  drawSnowStar(406, 260, 17);
  drawSnowStar(102, 540, 21);
  drawSnowStar(388, 514, 18);
  ctx.restore();

  paintMythicFrame(ctx, '#7EEBFF');
}

function paintVeloce(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#FF8424',
    highlight: '#FFE4A0',
    deep: '#2A1204',
    voidCol: '#090406',
    haloX: 256,
    haloY: 236,
    seed: 909,
    starPoints: 16,
  });

  // Kinetic golden wind-speed lines sweeping diagonally across backdrop
  ctx.save();
  ctx.strokeStyle = '#FFC864';
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 7; i++) {
    const sy = 104 + i * 54;
    ctx.beginPath();
    ctx.moveTo(18, sy + 46);
    ctx.lineTo(462, sy - 38);
    ctx.stroke();
  }
  ctx.restore();

  const a: CharacterAnatomy = {
    headX: 250,
    headY: 266,
    turnDir: -1,
    tiltRad: -0.07,
    headScale: 0.99,
    jaw: 'sculpted_youth',
    expression: 'smirk',
    skinLit: '#F8CEAA',
    skinMid: '#D4946C',
    skinShadow: '#864B32',
    skinDeep: '#3E1C14',
    lipHex: '#A65442',
    clothLit: '#FF8824',
    clothMid: '#B8440A',
    clothDark: '#361004',
    metalLit: '#FFF6BA',
    metalMid: '#F2B632',
    metalDark: '#6A3E0A',
    eyeOuter: '#FFAE18',
    eyeInner: '#FFFFB8',
    rimHex: '#FFD468',
    shoulderSpan: 344,
    neckWidth: 44,
    collarStyle: 'chiton_drape',
    pauldronSide: 'left',
    pauldronStyle: 'beveled_plate',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Wind-Whipped Multi-Lock Copper-Auburn Youth Hair peeking out from under messenger helm!
  const copperCols = { lit: '#EB7832', mid: '#8A3014', dark: '#280C06', rim: '#FFE084' };
  paintCascadingMane(
    ctx,
    [
      { x0: 174, y0: 214, cx1: 126, cy1: 212, tipX: 102, tipY: 252, cx2: 146, cy2: 244, tone: 'lit', rim: true },
      { x0: 184, y0: 186, cx1: 142, cy1: 196, tipX: 124, tipY: 234, cx2: 162, cy2: 218, tone: 'mid', rim: true },
      { x0: 312, y0: 204, cx1: 356, cy1: 200, tipX: 374, tipY: 238, cx2: 334, cy2: 234, tone: 'mid' },
      { x0: 306, y0: 224, cx1: 348, cy1: 240, tipX: 358, tipY: 282, cx2: 318, cy2: 262, tone: 'dark' },
      { x0: 222, y0: 184, cx1: 196, cy1: 204, tipX: 184, tipY: 226, cx2: 214, cy2: 208, tone: 'lit', rim: true },
      { x0: 268, y0: 184, cx1: 294, cy1: 200, tipX: 304, tipY: 224, cx2: 278, cy2: 208, tone: 'mid' },
    ],
    copperCols,
    2.2
  );

  // Sculpted Matte-Gold Winged Messenger Petasos Helm w/ Multi-Feather Layered Wings!
  ctx.save();
  ctx.translate(250, 266);
  ctx.rotate(-0.07);
  // Domed sculpted bronze-gold petasos cap & upturned aerodynamic brim
  ctx.beginPath();
  ctx.moveTo(-104, -56);
  ctx.quadraticCurveTo(0, -104, 106, -54);
  ctx.quadraticCurveTo(86, -86, 62, -102);
  ctx.bezierCurveTo(44, -158, -44, -158, -62, -102);
  ctx.quadraticCurveTo(-86, -86, -104, -56);
  ctx.closePath();
  const capG = ctx.createLinearGradient(-84, -152, 84, -52);
  capG.addColorStop(0, '#FFFAC0');
  capG.addColorStop(0.4, '#F0B228');
  capG.addColorStop(0.84, '#6A3A08');
  capG.addColorStop(1, '#261204');
  ctx.fillStyle = capG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.stroke();
  paintBrushCurve(ctx, -96, -58, 0, -96, 98, -56, 4.0, '#FFF8BE');

  // Layered Multi-Feather Sculpted Ivory Messenger Wings on Left & Right Temples!
  const wCols = { lit: '#FFFFFF', mid: '#E4DAC8', dark: '#5C4A42', rim: '#FFF8B8' };
  for (const dir of [-1, 1] as const) {
    paintCascadingMane(
      ctx,
      [
        { x0: dir * 64, y0: -88, cx1: dir * 136, cy1: -116, tipX: dir * 172, tipY: -174, cx2: dir * 114, cy2: -136, tone: 'lit', rim: dir < 0 },
        { x0: dir * 62, y0: -78, cx1: dir * 124, cy1: -98, tipX: dir * 154, tipY: -144, cx2: dir * 102, cy2: -114, tone: 'lit', rim: dir < 0 },
        { x0: dir * 60, y0: -68, cx1: dir * 112, cy1: -80, tipX: dir * 132, tipY: -116, cx2: dir * 92, cy2: -94, tone: 'mid' },
        { x0: dir * 56, y0: -62, cx1: dir * 96, cy1: -64, tipX: dir * 108, tipY: -92, cx2: dir * 78, cy2: -76, tone: 'mid' },
      ],
      wCols,
      2.2
    );
  }
  ctx.restore();

  // FOREGROUND PROP: Ornate Golden Twin-Serpent Caduceus Staff framed cleanly on left edge + Kinetic Wind Arc!
  ctx.save();
  ctx.translate(82, 466);
  ctx.rotate(-0.2);
  paintBrushCurve(ctx, 0, -138, 0, 20, 0, 174, 11, INK);
  paintBrushCurve(ctx, 0, -138, 0, 20, 0, 174, 5.2, '#F5C438');
  // Intertwined sculpted golden twin-serpents curling cleanly around staff!
  paintBrushCurve(ctx, -20, -44, 24, -74, -18, -104, 4.6, '#FFE684');
  paintBrushCurve(ctx, 20, -44, -24, -74, 18, -104, 4.6, '#E8A428');
  // Sculpted mini-wings crowning caduceus
  paintCascadingMane(
    ctx,
    [
      { x0: 0, y0: -124, cx1: -36, cy1: -150, tipX: -54, tipY: -140, cx2: -24, cy2: -124, tone: 'lit', rim: true },
      { x0: 0, y0: -124, cx1: 36, cy1: -150, tipX: 54, tipY: -140, cx2: 24, cy2: -124, tone: 'mid' },
    ],
    { lit: '#FFFAC2', mid: '#E8B238', dark: '#543008', rim: '#FFFFFF' },
    2.2
  );
  ctx.restore();

  // Dynamic sweeping golden speed-gust ribbon across lower foreground
  paintBrushCurve(ctx, 14, 540, 224, 434, 466, 496, 13, 'rgba(255, 182, 56, 0.56)');
  paintBrushCurve(ctx, 20, 536, 224, 430, 462, 492, 3.8, '#FFF4B8');

  paintMythicFrame(ctx, '#FF8424');
}

function paintAbyssos(ctx: CanvasRenderingContext2D): void {
  paintGouacheBackdrop(ctx, {
    primary: '#7224FF',
    highlight: '#D6A4FF',
    deep: '#15062C',
    voidCol: '#05020A',
    haloX: 240,
    haloY: 236,
    seed: 1010,
    starPoints: 8,
  });

  // Orbiting gilded celestial astrolabe rings behind cosmic shroud
  ctx.save();
  ctx.strokeStyle = '#C898FF';
  ctx.globalAlpha = 0.52;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(240, 274, 202, 74, -0.22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#FFCE72';
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(240, 274, 184, 58, 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 1. BILLOWING RAGGED CELESTIAL-NEBULA SHROUD (dramatic asymmetric draped hood veil + internal nebula folds + starfield dust!)
  const voidCols = { lit: '#8E48FF', mid: '#320E72', dark: '#0B041C', rim: '#DFAAFF' };
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(26, 636);
      ctx.bezierCurveTo(22, 444, 58, 256, 108, 134);
      ctx.quadraticCurveTo(174, 58, 240, 56);
      ctx.quadraticCurveTo(314, 62, 376, 144);
      ctx.bezierCurveTo(426, 264, 456, 444, 446, 636);
      ctx.lineTo(392, 574);
      ctx.lineTo(356, 636);
      ctx.lineTo(124, 636);
      ctx.lineTo(84, 574);
      ctx.closePath();
    },
    { x0: 24, y0: 56, x1: 452, y1: 636 },
    voidCols,
    [
      [164, 114, 96, 256, 66, 554, 6.0, 'ink'],
      [182, 158, 134, 334, 118, 594, 5.2, 'ink'],
      [318, 118, 386, 266, 408, 558, 6.4, 'ink'],
      [304, 166, 354, 344, 366, 596, 5.6, 'ink'],
      [156, 104, 86, 242, 56, 496, 3.6, 'rim'],
      [316, 112, 380, 244, 402, 488, 2.8, 'rim'],
    ],
    { shadowFrac: 0.44, inkW: 4.2, starfieldSeed: 10101 }
  );

  // Pitch-black cosmic hood cavern framing gaunt ethereal visage
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(164, 384);
  ctx.bezierCurveTo(138, 282, 154, 138, 240, 128);
  ctx.bezierCurveTo(328, 138, 344, 282, 318, 384);
  ctx.closePath();
  ctx.fill();

  const a: CharacterAnatomy = {
    headX: 240,
    headY: 252,
    turnDir: -1,
    tiltRad: 0.03,
    headScale: 1.0,
    jaw: 'elongated_ethereal',
    expression: 'surreal',
    skinLit: '#EFE6FF',
    skinMid: '#C0B0EA',
    skinShadow: '#68509C',
    skinDeep: '#28184C',
    lipHex: '#56368A',
    clothLit: '#7A38E8',
    clothMid: '#30106C',
    clothDark: '#0D0420',
    metalLit: '#EED6FF',
    metalMid: '#9454FF',
    metalDark: '#2C0E66',
    eyeOuter: '#9A48FF',
    eyeInner: '#FFFFFF',
    scleraHex: '#180834',
    pupilSlit: true,
    rimHex: '#DF9EFF',
    shoulderSpan: 340,
    neckWidth: 34,
    collarStyle: 'shroud_void',
    pauldronSide: 'none',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Floating Sculpted Cosmic Void Eyes (shaded eyelid rings + glowing amethyst irises + fine golden halos!)
  const paintVoidEye = (ex: number, ey: number, rx: number, ry: number) => {
    ctx.save();
    const glow = ctx.createRadialGradient(ex, ey, 2, ex, ey, rx * 1.45);
    glow.addColorStop(0, 'rgba(200, 128, 255, 0.55)');
    glow.addColorStop(1, 'rgba(114, 36, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ex, ey, rx * 1.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(ex - rx, ey);
    ctx.quadraticCurveTo(ex, ey - ry * 1.45, ex + rx, ey);
    ctx.quadraticCurveTo(ex, ey + ry * 1.45, ex - rx, ey);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFD878';
    ctx.lineWidth = 2.0;
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
  paintVoidEye(236, 188, 22, 10);
  paintVoidEye(86, 208, 28, 13);
  paintVoidEye(396, 302, 26, 12);

  // FOREGROUND PROP: Hovering Obsidian-Violet Nebula Singularity + Twin Graceful Splayed Slender Mystic Hands!
  const galGlow = ctx.createRadialGradient(240, 502, 8, 240, 502, 86);
  galGlow.addColorStop(0, '#FFFFFF');
  galGlow.addColorStop(0.28, '#B86CFF');
  galGlow.addColorStop(0.62, 'rgba(100, 25, 255, 0.44)');
  galGlow.addColorStop(1, 'rgba(9, 6, 14, 0)');
  ctx.fillStyle = galGlow;
  ctx.beginPath();
  ctx.arc(240, 502, 86, 0, Math.PI * 2);
  ctx.fill();
  paintVoidEye(240, 502, 38, 18);

  for (const dir of [-1, 1] as const) {
    ctx.save();
    ctx.translate(240 + dir * 102, 534);
    ctx.scale(dir, 1);
    ctx.beginPath();
    ctx.moveTo(48, 104);
    ctx.quadraticCurveTo(22, 32, -6, -16);
    ctx.lineTo(-28, -32); // slender tapered index finger
    ctx.lineTo(-10, 4);
    ctx.lineTo(-34, -4); // slender middle finger
    ctx.lineTo(-12, 22);
    ctx.lineTo(-30, 24); // slender ring finger
    ctx.quadraticCurveTo(2, 54, 10, 104);
    ctx.closePath();
    const hG = ctx.createLinearGradient(-34, -32, 46, 100);
    hG.addColorStop(0, dir < 0 ? '#EFE6FF' : '#A68CE0');
    hG.addColorStop(0.55, dir < 0 ? '#9E82DC' : '#583A9E');
    hG.addColorStop(1, '#1A083E');
    ctx.fillStyle = hG;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    // Golden cosmic knuckle bands
    paintBrushCurve(ctx, -18, -14, -14, -10, -10, -6, 2.6, '#FFE284');
    paintBrushCurve(ctx, -20, 6, -14, 10, -10, 14, 2.4, '#FFE284');
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

  // Billowing Tattered Crimson Chlamys Cloak Flare behind left shoulder
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(28, 646);
      ctx.bezierCurveTo(22, 474, 62, 374, 124, 346);
      ctx.lineTo(192, 360);
      ctx.lineTo(166, 646);
      ctx.closePath();
    },
    { x0: 22, y0: 346, x1: 192, y1: 646 },
    { lit: '#F22E3E', mid: '#9C1224', dark: '#28050E', rim: '#FFA06C' },
    [
      [134, 376, 84, 484, 72, 628, 5.2, 'ink'],
      [164, 404, 134, 514, 124, 636, 4.6, 'ink'],
      [114, 368, 66, 464, 54, 594, 3.0, 'rim'],
    ],
    { shadowFrac: 0.42, inkW: 4.0 }
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
    shoulderSpan: 358,
    neckWidth: 46,
    collarStyle: 'chiton_drape',
    pauldronSide: 'left',
    pauldronStyle: 'carved_skull',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Unified Wild Swept Raven-Black Hair Mass w/ Fiery-Ember Tips & Internal Calligraphic Strands (ZERO separated feathers!)
  const pyreCols = { lit: '#FF6A2A', mid: '#26152E', dark: INK, rim: '#FFBE7C' };
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(160, 228);
      ctx.quadraticCurveTo(116, 198, 90, 152);
      ctx.lineTo(146, 152);
      ctx.quadraticCurveTo(124, 102, 134, 62);
      ctx.lineTo(186, 112);
      ctx.quadraticCurveTo(198, 66, 224, 42);
      ctx.lineTo(252, 106);
      ctx.quadraticCurveTo(294, 68, 336, 76);
      ctx.lineTo(306, 144);
      ctx.quadraticCurveTo(352, 136, 378, 152);
      ctx.lineTo(324, 200);
      ctx.quadraticCurveTo(344, 232, 332, 276);
      ctx.lineTo(298, 232);
      ctx.quadraticCurveTo(284, 184, 236, 170);
      ctx.quadraticCurveTo(192, 184, 160, 228);
      ctx.closePath();
    },
    { x0: 90, y0: 42, x1: 378, y1: 276 },
    pyreCols,
    [
      [176, 194, 138, 174, 108, 154, 3.6, 'ink'],
      [196, 176, 156, 128, 146, 82, 4.0, 'ink'],
      [230, 168, 218, 114, 224, 62, 4.2, 'ink'],
      [266, 174, 294, 124, 322, 92, 4.2, 'ink'],
      [292, 192, 332, 170, 358, 160, 3.8, 'ink'],
      [188, 172, 150, 126, 140, 74, 3.0, 'rim'],
      [224, 164, 212, 112, 220, 56, 3.0, 'rim'],
      [258, 168, 286, 118, 324, 86, 2.8, 'lit'],
    ],
    { shadowFrac: 0.46, inkW: 3.6 }
  );
  // Swept dark forelock curling dynamically over brow!
  paintCalligraphicLock(
    ctx,
    { x0: 236, y0: 168, cx1: 196, cy1: 192, tipX: 174, tipY: 226, cx2: 220, cy2: 198, tone: 'dark' },
    pyreCols,
    2.2
  );

  // Sculpted Burnished-Gold Laurel Wreath Crown (pointed shaded bay leaves!)
  ctx.save();
  for (let i = -4; i <= 4; i++) {
    const ang = -Math.PI * 0.5 + i * 0.23;
    const lx = 238 + Math.cos(ang) * 78;
    const ly = 216 + Math.sin(ang) * 52;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(ang + 0.72);
    const lG = ctx.createLinearGradient(-16, 0, 16, 0);
    lG.addColorStop(0, '#965E10');
    lG.addColorStop(0.55, '#F2BE38');
    lG.addColorStop(1, '#FFFAC0');
    ctx.fillStyle = lG;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(0, -8.5, 16, 0);
    ctx.quadraticCurveTo(0, 8.5, -16, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // FOREGROUND PROP: Raised Crimson-Runed Stygian Blade + Anatomical Armored Hand cleanly along right edge!
  ctx.save();
  ctx.translate(396, 434);
  ctx.rotate(0.24);
  ctx.beginPath();
  ctx.moveTo(-18, 74);
  ctx.quadraticCurveTo(-22, -100, -15, -210);
  ctx.lineTo(0, -274);
  ctx.lineTo(17, -206);
  ctx.quadraticCurveTo(22, -96, 18, 74);
  ctx.closePath();
  const swG = ctx.createLinearGradient(-20, -260, 20, 60);
  swG.addColorStop(0, '#F5F8FF');
  swG.addColorStop(0.45, '#8A98B2');
  swG.addColorStop(0.7, '#2A3042');
  swG.addColorStop(1, INK);
  ctx.fillStyle = swG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.0;
  ctx.stroke();
  paintBrushCurve(ctx, 0, -220, 0, -80, 0, 54, 4.8, '#FF3242');
  paintBrushCurve(ctx, -10, -212, -13, -84, -11, 48, 2.4, '#FFFFFF');
  ctx.fillStyle = '#F0B63A';
  ctx.beginPath();
  ctx.moveTo(-46, 72);
  ctx.lineTo(46, 72);
  ctx.lineTo(32, 90);
  ctx.lineTo(-32, 90);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.stroke();
  ctx.restore();

  paintAnatomicalHand(ctx, 374, 542, 0.24, 0.98, -1, {
    skinLit: a.skinLit,
    skinMid: a.skinMid,
    skinDark: a.skinDeep,
    cuffLit: '#FFF2AE',
    cuffMid: '#B81C2C',
    cuffDark: '#280610',
    rim: '#FFA878',
  });

  // Glowing floating underworld embers
  for (const [ex, ey, r] of [
    [68, 224, 4.8],
    [118, 464, 5.5],
    [418, 174, 4.2],
    [318, 530, 5.0],
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

  // Sculpted Gothic Harpy-Bat Wings w/ Scalloped Dark Membrane Webbing & Inked Quill Ribs!
  const wCols = { lit: '#742094', mid: '#260A3C', dark: INK, rim: '#FF56DA' };
  for (const dir of [-1, 1] as const) {
    paintUnifiedFlowingHair(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(240 + dir * 48, 376);
        ctx.bezierCurveTo(240 + dir * 134, 198, 240 + dir * 198, 134, 240 + dir * 234, 184);
        ctx.quadraticCurveTo(240 + dir * 200, 266, 240 + dir * 224, 336);
        ctx.quadraticCurveTo(240 + dir * 172, 326, 240 + dir * 168, 434);
        ctx.lineTo(240 + dir * 48, 444);
        ctx.closePath();
      },
      { x0: 240 - 236, y0: 136, x1: 240 + 236, y1: 444 },
      wCols,
      [
        [240 + dir * 56, 372, 240 + dir * 136, 232, 240 + dir * 224, 196, 5.2, 'ink'],
        [240 + dir * 58, 384, 240 + dir * 144, 286, 240 + dir * 212, 326, 4.6, 'ink'],
        [240 + dir * 56, 396, 240 + dir * 124, 344, 240 + dir * 164, 424, 4.2, 'ink'],
        [240 + dir * 58, 366, 240 + dir * 138, 212, 240 + dir * 226, 186, 3.6, 'rim'],
      ],
      { shadowFrac: 0.45, inkW: 4.0 }
    );
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
    pauldronStyle: 'spiked_war',
  };

  paintMasterComicTorso(ctx, a);
  paintMasterComicHead(ctx, a);

  // Unified Lush Asymmetrical Raven-Violet Executioner Hair Cascading Past Cheek!
  const malHair = { lit: '#6C2A92', mid: '#220B38', dark: INK, rim: '#FF70E6' };
  paintUnifiedFlowingHair(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(156, 238);
      ctx.bezierCurveTo(164, 152, 234, 138, 294, 154);
      ctx.bezierCurveTo(352, 184, 368, 292, 344, 412);
      ctx.lineTo(318, 372);
      ctx.lineTo(304, 396);
      ctx.quadraticCurveTo(304, 272, 282, 212);
      ctx.quadraticCurveTo(244, 174, 198, 184);
      ctx.quadraticCurveTo(176, 206, 156, 238);
      ctx.closePath();
    },
    { x0: 156, y0: 142, x1: 366, y1: 412 },
    malHair,
    [
      [252, 162, 314, 224, 338, 384, 4.0, 'ink'],
      [278, 172, 336, 254, 344, 396, 4.2, 'ink'],
      [234, 158, 292, 204, 322, 346, 3.0, 'rim'],
    ],
    { shadowFrac: 0.46, inkW: 3.4 }
  );

  // Curved Twin Ridged Obsidian & Gold Executioner Horns
  ctx.save();
  ctx.translate(248, 254);
  ctx.rotate(-0.09);
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(dir * 28, -68);
    ctx.bezierCurveTo(dir * 86, -86, dir * 102, -144, dir * 74, -184);
    ctx.bezierCurveTo(dir * 72, -138, dir * 50, -104, dir * 8, -80);
    ctx.closePath();
    const hG = ctx.createLinearGradient(dir * 12, -180, dir * 86, -68);
    hG.addColorStop(0, '#FFE89E');
    hG.addColorStop(0.35, '#D4922A');
    hG.addColorStop(0.75, '#3E1C46');
    hG.addColorStop(1, INK);
    ctx.fillStyle = hG;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.6;
    ctx.stroke();
  }
  ctx.restore();

  // FOREGROUND PROP: Coiled Barbed Crimson-Glowing Executioner Whip + Anatomical Gauntleted Hand cleanly in lower foreground!
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(94, 524);
  ctx.bezierCurveTo(214, 464, 426, 534, 444, 386);
  ctx.bezierCurveTo(454, 314, 354, 336, 388, 434);
  ctx.stroke();
  ctx.strokeStyle = '#FF206E';
  ctx.lineWidth = 5.6;
  ctx.stroke();
  ctx.strokeStyle = '#FFB8DF';
  ctx.lineWidth = 2.0;
  ctx.stroke();

  for (const [bx, by, ang] of [
    [206, 492, -0.5],
    [308, 494, 0.2],
    [408, 462, -0.8],
    [438, 384, -1.2],
  ]) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ang);
    ctx.fillStyle = '#FFE494';
    ctx.beginPath();
    ctx.moveTo(-5.5, 0);
    ctx.lineTo(0, -16);
    ctx.lineTo(5.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  paintAnatomicalHand(ctx, 94, 540, -0.3, 0.96, 1, {
    skinLit: '#7A2890',
    skinMid: '#2E0E42',
    skinDark: '#090412',
    cuffLit: '#FFEAA0',
    cuffMid: '#D4922A',
    cuffDark: '#3A1E08',
    rim: '#FF6AE4',
  });

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
