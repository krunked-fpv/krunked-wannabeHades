/**
 * ProceduralPortraits — High-resolution (360x480) painterly comic-ink
 * 3/4-angle comic-ink illustrated mythic character portraits for all 10 Patrons,
 * Prince Pyreus, and Warden Malice.
 *
 * Features dynamic 3/4 anatomy, variable-weight jet-black ink lineart, sculpted
 * draped folds, 3-tone cel lighting, selective shadow hatching, dramatic colored
 * rim-lighting, and iconic patron regalia. Lazily baked & cached as PNG data URLs.
 * `getPortraitAssetIds()` is 100% pure Node-safe for Gate A `verify:assets`.
 */

import type { PatronId } from '../contracts/index.js';
import { PATRON_CONSTANTS } from '../contracts/index.js';

export type CharacterPortraitId = PatronId | 'prince_pyreus' | 'warden_malice';

export const PORTRAIT_WIDTH = 360;
export const PORTRAIT_HEIGHT = 480;

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

const INK = '#07050c';
const portraitCache = new Map<CharacterPortraitId, string>();

/** Pure Node-safe inventory of all built-in procedural portrait IDs. */
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
          ? '#e0363e'
          : '#c92bff';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PORTRAIT_WIDTH}" height="${PORTRAIT_HEIGHT}"><rect width="100%" height="100%" fill="#100b1a"/><circle cx="180" cy="210" r="120" fill="${color}" opacity="0.35"/></svg>`;
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
// Painterly Mythic Comic-Ink Anatomy & Lighting Engine
// ============================================================================

interface BustConfig {
  skinHighlight: string;
  skinMid: string;
  skinShadow: string;
  skinDeepShadow: string;
  lipHex: string;
  clothLit: string;
  clothMid: string;
  clothDark: string;
  metalLit: string;
  metalMid: string;
  metalDark: string;
  eyeHex: string;
  eyeSecondaryHex?: string;
  rimHex: string;
  feminine?: boolean;
  broad?: boolean;
  expression?: 'regal' | 'fierce' | 'smirk' | 'alluring';
  pauldronSide?: 'left' | 'right' | 'both' | 'none';
}

function paintMythicBackdrop(
  ctx: CanvasRenderingContext2D,
  primaryHex: string,
  accentHex: string,
  deepHex: string,
  rayCount: number
): void {
  const w = PORTRAIT_WIDTH;
  const h = PORTRAIT_HEIGHT;

  // Deep dramatic jewel-tone atmospheric gradient
  const bg = ctx.createLinearGradient(0, 0, w * 0.7, h);
  bg.addColorStop(0, deepHex);
  bg.addColorStop(0.55, '#120c1c');
  bg.addColorStop(1, '#06040b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Diagonal dramatic divine light shaft behind figure
  ctx.save();
  const shaft = ctx.createRadialGradient(w * 0.56, h * 0.34, 18, w * 0.52, h * 0.36, 250);
  shaft.addColorStop(0, accentHex);
  shaft.addColorStop(0.28, primaryHex);
  shaft.addColorStop(0.68, 'rgba(18, 11, 28, 0.2)');
  shaft.addColorStop(1, 'rgba(6, 4, 12, 0)');
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = shaft;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Sharp tapered sunburst rays (offset to focal point behind 3/4 head!)
  ctx.save();
  ctx.translate(w * 0.53, h * 0.35);
  ctx.fillStyle = primaryHex;
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < rayCount; i++) {
    const a0 = (i * Math.PI * 2) / rayCount + 0.12;
    const a1 = a0 + Math.PI / (rayCount * 2.1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * 340, Math.sin(a0) * 340);
    ctx.lineTo(Math.cos(a1) * 340, Math.sin(a1) * 340);
    ctx.closePath();
    ctx.fill();
  }

  // Ornate concentric filigree mandala halo
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = primaryHex;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 124, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.25;
  ctx.setLineDash([14, 7, 4, 7]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 140, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTaperedInkArc(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  width: number,
  color = INK
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  ctx.restore();
}

function drawTightShadowHatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  len: number,
  spacing: number,
  angle: number,
  alpha = 0.32
): void {
  ctx.save();
  ctx.strokeStyle = `rgba(7, 5, 14, ${alpha})`;
  ctx.lineWidth = 1.4;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const px = -sa;
  const py = ca;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const ox = x + px * (i * spacing);
    const oy = y + py * (i * spacing);
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + ca * len, oy + sa * len);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders a sculptural 3/4-turned heroic torso with asymmetric shoulder elevation,
 * anatomical collarbones, layered Greek chiton drapery folds, and dramatic dark-ink cel shadows.
 */
function paintHeroicTorso34(ctx: CanvasRenderingContext2D, cfg: BustConfig): void {
  const fem = cfg.feminine ?? false;
  const broad = cfg.broad ?? false;
  const leftShX = broad ? 40 : fem ? 64 : 52;
  const leftShY = fem ? 338 : 326;
  const rightShX = broad ? 326 : fem ? 298 : 314;
  const rightShY = fem ? 314 : 300;

  // Back mantle shadow silhouette
  ctx.beginPath();
  ctx.moveTo(leftShX - 24, PORTRAIT_HEIGHT + 8);
  ctx.bezierCurveTo(leftShX - 18, 370, leftShX + 6, leftShY - 12, 136, 286);
  ctx.lineTo(226, 276);
  ctx.bezierCurveTo(rightShX - 20, rightShY - 16, rightShX + 16, 360, rightShX + 26, PORTRAIT_HEIGHT + 8);
  ctx.closePath();

  const torsoGrad = ctx.createLinearGradient(leftShX, 290, rightShX, PORTRAIT_HEIGHT);
  torsoGrad.addColorStop(0, cfg.clothLit);
  torsoGrad.addColorStop(0.42, cfg.clothMid);
  torsoGrad.addColorStop(0.78, cfg.clothDark);
  torsoGrad.addColorStop(1, '#0b0812');
  ctx.fillStyle = torsoGrad;
  ctx.fill();

  // Clip organic draped cloth folds & bold comic shadow wedges inside torso
  ctx.save();
  ctx.clip();

  // Dramatic diagonal shadow wedge across lower-right chest (bold comic-ink lighting!)
  ctx.fillStyle = cfg.clothDark;
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.moveTo(192, 290);
  ctx.bezierCurveTo(232, 344, 212, 412, 168, PORTRAIT_HEIGHT + 10);
  ctx.lineTo(PORTRAIT_WIDTH + 10, PORTRAIT_HEIGHT + 10);
  ctx.lineTo(PORTRAIT_WIDTH + 10, 270);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Exposed sunlit décolletage / muscular collarbone wedge
  ctx.beginPath();
  ctx.moveTo(132, 284);
  ctx.quadraticCurveTo(176, 356, 232, 280);
  ctx.closePath();
  const chestGrad = ctx.createLinearGradient(132, 280, 224, 340);
  chestGrad.addColorStop(0, cfg.skinHighlight);
  chestGrad.addColorStop(0.55, cfg.skinMid);
  chestGrad.addColorStop(1, cfg.skinShadow);
  ctx.fillStyle = chestGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Sculpted collarbones & sternal notch ink accents
  drawTaperedInkArc(ctx, 138, 304, 160, 314, 174, 310, 2.8, cfg.skinDeepShadow);
  drawTaperedInkArc(ctx, 218, 298, 200, 312, 185, 310, 2.8, cfg.skinDeepShadow);

  // Authentic Asymmetric Diagonal Greek Himation Drapery (converging V-folds off left shoulder — zero horizontal stripes!)
  ctx.beginPath();
  ctx.moveTo(leftShX + 8, leftShY - 8);
  ctx.bezierCurveTo(136, 362, 220, 376, rightShX + 18, PORTRAIT_HEIGHT + 8);
  ctx.lineTo(leftShX - 24, PORTRAIT_HEIGHT + 8);
  ctx.closePath();
  const sashGrad = ctx.createLinearGradient(leftShX, leftShY, rightShX - 40, PORTRAIT_HEIGHT);
  sashGrad.addColorStop(0, cfg.clothLit);
  sashGrad.addColorStop(0.55, cfg.clothMid);
  sashGrad.addColorStop(1, cfg.clothDark);
  ctx.fillStyle = sashGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.6;
  ctx.stroke();

  // Deep diagonal cloth fold shadow wedges radiating naturally from shoulder clasp!
  const vFolds: readonly [number, number, number, number, number, number][] = [
    [leftShX + 26, leftShY + 6, 138, 386, 204, 476],
    [leftShX + 14, leftShY + 24, 114, 412, 138, 482],
    [rightShX - 42, rightShY + 22, 246, 384, 276, 478],
  ];
  for (const [x0, y0, cx, cy, x1, y1] of vFolds) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.quadraticCurveTo(cx - 14, cy + 8, x0, y0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(7, 5, 14, 0.42)';
    ctx.fill();
    drawTaperedInkArc(ctx, x0, y0, cx, cy, x1, y1, 2.8, INK);
  }

  // Ornate gilded Greek border edging the diagonal drapery & brooched clasp!
  ctx.strokeStyle = cfg.metalLit;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(leftShX + 14, leftShY - 4);
  ctx.bezierCurveTo(142, 366, 224, 380, rightShX + 12, PORTRAIT_HEIGHT + 4);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Rim highlight along lit left shoulder edge
  drawTaperedInkArc(ctx, leftShX - 6, 420, leftShX + 6, leftShY + 8, 128, 290, 4.5, cfg.rimHex);
  ctx.restore();

  // Outer heroic silhouette ink line
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.2;
  ctx.stroke();

  // Sculpted ornate shoulder pauldron(s) for heroic armor silhouette!
  const drawPauldron = (px: number, py: number, flip: number) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(flip, 1);
    ctx.beginPath();
    ctx.moveTo(-42, 22);
    ctx.bezierCurveTo(-48, -14, -10, -34, 34, -18);
    ctx.bezierCurveTo(46, 2, 28, 32, -8, 34);
    ctx.closePath();
    const pGrad = ctx.createLinearGradient(-36, -24, 32, 32);
    pGrad.addColorStop(0, cfg.metalLit);
    pGrad.addColorStop(0.45, cfg.metalMid);
    pGrad.addColorStop(1, cfg.metalDark);
    ctx.fillStyle = pGrad;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
    // Specular ridge & filigree trim
    drawTaperedInkArc(ctx, -28, 10, -4, -16, 24, -8, 3.2, '#ffffff');
    drawTaperedInkArc(ctx, -26, 22, 2, 12, 28, 12, 3, INK);
    ctx.restore();
  };

  if (cfg.pauldronSide === 'left' || cfg.pauldronSide === 'both') {
    drawPauldron(leftShX + 34, leftShY + 8, 1);
  }
  if (cfg.pauldronSide === 'right' || cfg.pauldronSide === 'both') {
    drawPauldron(rightShX - 34, rightShY + 4, -1);
  }
}

/**
 * Renders a refined 3/4 mythic neck & head with organic cheekbones, subtle brow/nose
 * planes, expressive eyes with winged liner, sculpted lips, and crisp cel shadows!
 * Returns anchor coords for hair/crown/beard overlays.
 */
function paintHeroicHead34(
  ctx: CanvasRenderingContext2D,
  cfg: BustConfig
): { headCx: number; headCy: number } {
  const fem = cfg.feminine ?? false;
  // Slightly turned 3/4 head facing slightly left for dynamic dramatic tension
  const headCx = 180;
  const headCy = 196;

  // Sculpted tapered neck with sternocleidomastoid muscle shadow
  ctx.beginPath();
  ctx.moveTo(154, 244);
  ctx.quadraticCurveTo(150, 280, 144, 304);
  ctx.quadraticCurveTo(178, 322, 214, 298);
  ctx.quadraticCurveTo(210, 272, 212, 236);
  ctx.closePath();
  const neckGrad = ctx.createLinearGradient(148, 250, 214, 298);
  neckGrad.addColorStop(0, cfg.skinMid);
  neckGrad.addColorStop(0.55, cfg.skinShadow);
  neckGrad.addColorStop(1, cfg.skinDeepShadow);
  ctx.fillStyle = neckGrad;
  ctx.fill();

  // Sharp angular cast jaw shadow falling down onto neck
  ctx.save();
  ctx.clip();
  ctx.fillStyle = cfg.skinDeepShadow;
  ctx.beginPath();
  ctx.moveTo(148, 242);
  ctx.lineTo(220, 238);
  ctx.lineTo(220, 282);
  ctx.quadraticCurveTo(182, 292, 152, 266);
  ctx.closePath();
  ctx.fill();
  drawTightShadowHatch(ctx, 174, 252, 5, 22, 5, 0.72, 0.35);
  ctx.restore();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.8;
  ctx.stroke();

  // Sculpted ear visible on far-right 3/4 side
  ctx.beginPath();
  ctx.moveTo(226, 186);
  ctx.bezierCurveTo(240, 180, 242, 214, 224, 222);
  ctx.closePath();
  ctx.fillStyle = cfg.skinShadow;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();

  // 3/4 Sculpted Face Silhouette (subtle left cheekbone dip, graceful tapered jaw, strong chin!)
  const chinY = fem ? 268 : 272;
  const jawLeftX = fem ? 132 : 128;
  const jawRightX = fem ? 226 : 230;
  ctx.beginPath();
  ctx.moveTo(136, 146);
  ctx.bezierCurveTo(126, 172, jawLeftX - 4, 198, jawLeftX + 6, 220); // left cheek & cheekbone
  ctx.bezierCurveTo(jawLeftX + 12, 244, 152, chinY - 4, 168, chinY); // tapered left jaw to chin
  ctx.bezierCurveTo(192, chinY - 2, jawRightX - 10, 246, jawRightX - 2, 214); // sweeping right jaw
  ctx.bezierCurveTo(jawRightX + 8, 178, 230, 134, 184, 122); // right temple to crown
  ctx.bezierCurveTo(152, 122, 142, 132, 136, 146);
  ctx.closePath();

  const faceGrad = ctx.createLinearGradient(128, 134, 232, 262);
  faceGrad.addColorStop(0, cfg.skinHighlight);
  faceGrad.addColorStop(0.48, cfg.skinMid);
  faceGrad.addColorStop(0.82, cfg.skinShadow);
  faceGrad.addColorStop(1, cfg.skinDeepShadow);
  ctx.fillStyle = faceGrad;
  ctx.fill();

  // Clip anatomical 3-tone cel shadows & rim light cleanly inside face
  ctx.save();
  ctx.clip();

  // Right-side sculpted cheekbone & temple shadow plane (bold comic-ink cel shape!)
  ctx.fillStyle = cfg.skinShadow;
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.moveTo(198, 122);
  ctx.lineTo(242, 122);
  ctx.lineTo(242, 278);
  ctx.lineTo(174, 278);
  ctx.bezierCurveTo(198, 250, 206, 226, 194, 208); // hollow beneath right cheekbone
  ctx.bezierCurveTo(212, 190, 206, 156, 198, 122);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Clean bold comic-ink cel shadow plane — subtle cheekbone bevel highlight inside shadow
  drawTaperedInkArc(ctx, 206, 206, 204, 232, 186, 256, 2.4, cfg.skinDeepShadow);

  // Warm sunlit cheek & brow specular highlight plane on lit left side
  ctx.fillStyle = cfg.skinHighlight;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(148, 204, 16, 10, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Dramatic colored rim-light ribbon kissing the left jaw & cheek edge!
  drawTaperedInkArc(ctx, 133, 166, 128, 214, 162, chinY - 3, 4.2, cfg.rimHex);
  ctx.restore();

  // Crisp variable-weight jet-black facial contour
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Sculpted 3/4 Nose Bridge + Cast Shadow Wedge
  ctx.fillStyle = cfg.skinShadow;
  ctx.beginPath();
  ctx.moveTo(164, 180);
  ctx.lineTo(156, 214);
  ctx.lineTo(168, 219);
  ctx.lineTo(171, 208);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(164, 182);
  ctx.lineTo(155, 212);
  ctx.quadraticCurveTo(160, 218, 168, 215);
  ctx.stroke();

  // Expressive Swept Comic Eyebrows
  const expr = cfg.expression ?? 'regal';
  const browDrop = expr === 'fierce' ? 7 : expr === 'alluring' ? -2 : 3;
  ctx.fillStyle = INK;
  // Left eyebrow (slightly foreshortened on 3/4 far side)
  ctx.beginPath();
  ctx.moveTo(134, 178 - browDrop * 0.4);
  ctx.quadraticCurveTo(146, 170 - browDrop * 0.2, 160, 177 + browDrop);
  ctx.quadraticCurveTo(147, 177, 134, 181 - browDrop * 0.4);
  ctx.closePath();
  ctx.fill();
  // Right eyebrow (closer, longer expressive arch)
  ctx.beginPath();
  ctx.moveTo(176, 177 + browDrop);
  ctx.quadraticCurveTo(196, 167 - browDrop * 0.3, 216, 176 - browDrop * 0.5);
  ctx.quadraticCurveTo(196, 174, 176, 182 + browDrop);
  ctx.closePath();
  ctx.fill();

  // Sculpted Mythic Eyes (winged comic lashes + luminous glowing iris + catchlight!)
  const drawEye = (ex: number, ey: number, ew: number, eh: number, irisHex: string, flipWing: number) => {
    // Upper eye socket shadow crease
    drawTaperedInkArc(ctx, ex - ew, ey - eh * 0.9, ex, ey - eh * 1.45, ex + ew, ey - eh * 0.8, 2, cfg.skinDeepShadow);

    // Sclera & dark rim
    ctx.beginPath();
    ctx.moveTo(ex - ew, ey);
    ctx.quadraticCurveTo(ex, ey - eh, ex + ew, ey + 1);
    ctx.quadraticCurveTo(ex, ey + eh * 0.85, ex - ew, ey);
    ctx.closePath();
    ctx.fillStyle = '#1b1426';
    ctx.fill();

    // Glowing divine iris
    ctx.fillStyle = irisHex;
    ctx.beginPath();
    ctx.ellipse(ex - 1, ey, eh * 0.82, eh * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bright specular catchlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 3, ey - 2, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Thick dramatic upper lash wing (bold calligraphic brushwork!)
    ctx.strokeStyle = INK;
    ctx.lineWidth = fem ? 4.4 : 3.8;
    ctx.beginPath();
    ctx.moveTo(ex - ew - (flipWing < 0 ? 5 : 1), ey - (flipWing < 0 ? 3 : 0));
    ctx.quadraticCurveTo(ex, ey - eh - 1, ex + ew + (flipWing > 0 ? 6 : 1), ey - (flipWing > 0 ? 3 : 0));
    ctx.stroke();
  };

  drawEye(148, 190, 12, 6.5, cfg.eyeHex, -1);
  drawEye(194, 190, 15, 7.2, cfg.eyeSecondaryHex ?? cfg.eyeHex, 1);

  // Sculpted Lips + Lower-Lip Gloss Highlight + Chin Shadow
  const mouthY = 235;
  ctx.fillStyle = cfg.lipHex;
  ctx.beginPath();
  if (expr === 'smirk') {
    ctx.moveTo(154, mouthY + 2);
    ctx.quadraticCurveTo(170, mouthY - 4, 188, mouthY - 5);
    ctx.quadraticCurveTo(172, mouthY + 8, 154, mouthY + 2);
  } else {
    ctx.moveTo(153, mouthY);
    ctx.quadraticCurveTo(163, mouthY - 5, 169, mouthY - 2);
    ctx.quadraticCurveTo(175, mouthY - 5, 186, mouthY);
    ctx.quadraticCurveTo(170, mouthY + (fem ? 10 : 7), 153, mouthY);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Crisp glossy highlight on lower lip
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(166, mouthY + 3.5, 5, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle shadow notch under lower lip
  drawTaperedInkArc(ctx, 162, mouthY + 12, 170, mouthY + 15, 178, mouthY + 12, 2.4, cfg.skinDeepShadow);

  return { headCx, headCy };
}

function paintPortraitBorder(ctx: CanvasRenderingContext2D, accentHex: string): void {
  const w = PORTRAIT_WIDTH;
  const h = PORTRAIT_HEIGHT;

  // Smooth bottom gradient fade so UI Patron name reads razor-clearly
  const vig = ctx.createLinearGradient(0, h - 118, 0, h);
  vig.addColorStop(0, 'rgba(7, 5, 13, 0)');
  vig.addColorStop(0.75, 'rgba(7, 5, 13, 0.78)');
  vig.addColorStop(1, 'rgba(7, 5, 13, 0.94)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, h - 118, w, 118);

  // Subtle double-framed mythic gilded border
  ctx.strokeStyle = accentHex;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(9, 9, w - 18, h - 18);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.strokeRect(2.5, 2.5, w - 5, h - 5);
}

function paintLockRibbon(
  ctx: CanvasRenderingContext2D,
  pts: readonly [number, number][],
  litHex: string,
  midHex: string,
  darkHex: string
): void {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[Math.floor(pts.length / 2)][0], pts[Math.floor(pts.length / 2)][1]);
  g.addColorStop(0, litHex);
  g.addColorStop(0.5, midHex);
  g.addColorStop(1, darkHex);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();
}

// ============================================================================
// Flagship Bespoke Comic-Ink Character Portraits
// ============================================================================

function paintAegira(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#FDBD31', '#FFF2B2', '#261907', 16);

  // Ornate engraved circular Aegis shield rising majestically behind right shoulder
  const shX = 278;
  const shY = 338;
  ctx.save();
  ctx.beginPath();
  ctx.arc(shX, shY, 118, 0, Math.PI * 2);
  const shGrad = ctx.createRadialGradient(shX - 38, shY - 38, 12, shX, shY, 122);
  shGrad.addColorStop(0, '#fff7c7');
  shGrad.addColorStop(0.35, '#f2b838');
  shGrad.addColorStop(0.75, '#995e16');
  shGrad.addColorStop(1, '#3b2008');
  ctx.fillStyle = shGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Concentric engraved Aegis geometric rings & owl-wing filigree
  ctx.strokeStyle = '#5e360a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(shX, shY, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffe994';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(shX, shY, 84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Flowing sculpted horsehair war-plume cascading behind helm & right shoulder!
  ctx.beginPath();
  ctx.moveTo(188, 92);
  ctx.bezierCurveTo(212, 22, 294, 46, 304, 146);
  ctx.bezierCurveTo(312, 212, 286, 268, 250, 296);
  ctx.bezierCurveTo(258, 224, 254, 152, 222, 118);
  ctx.closePath();
  const plumeGrad = ctx.createLinearGradient(188, 36, 304, 286);
  plumeGrad.addColorStop(0, '#fffbf0');
  plumeGrad.addColorStop(0.55, '#dfd0b8');
  plumeGrad.addColorStop(1, '#7a6452');
  ctx.fillStyle = plumeGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.2;
  ctx.stroke();
  // Inked sweeping plume hair strands
  drawTaperedInkArc(ctx, 214, 58, 272, 92, 282, 198, 2.4, '#5e4b3c');
  drawTaperedInkArc(ctx, 224, 80, 268, 128, 266, 242, 2.2, '#5e4b3c');

  // Sculpted ivory & gold war-maiden torso with ornate bronze pauldrons
  paintHeroicTorso34(ctx, {
    skinHighlight: '#c98862',
    skinMid: '#9a5b3d',
    skinShadow: '#613222',
    skinDeepShadow: '#341612',
    lipHex: '#7d3a2f',
    clothLit: '#fff7e6',
    clothMid: '#d9ccb4',
    clothDark: '#695849',
    metalLit: '#fff3b0',
    metalMid: '#f0b132',
    metalDark: '#6e3f0d',
    eyeHex: '#FFE26A',
    rimHex: '#FFE88A',
    feminine: true,
    expression: 'regal',
    pauldronSide: 'both',
  });

  // 3/4 Sculpted Bronze Warrior Visage
  paintHeroicHead34(ctx, {
    skinHighlight: '#c98862',
    skinMid: '#9a5b3d',
    skinShadow: '#613222',
    skinDeepShadow: '#341612',
    lipHex: '#7d3a2f',
    clothLit: '#fff7e6',
    clothMid: '#d9ccb4',
    clothDark: '#695849',
    metalLit: '#fff3b0',
    metalMid: '#f0b132',
    metalDark: '#6e3f0d',
    eyeHex: '#FFE26A',
    rimHex: '#FFE88A',
    feminine: true,
    expression: 'regal',
  });

  // Dark cascading braided hair locks framing neck under helmet
  paintLockRibbon(
    ctx,
    [
      [216, 212],
      [246, 248],
      [238, 306],
      [210, 294],
      [208, 238],
    ],
    '#3d3145',
    '#1f1629',
    '#0c0812'
  );

  // Iconic Sculpted Burnished-Gold Winged-Owl Corinthian Helm (3/4 perspective!)
  ctx.beginPath();
  ctx.moveTo(126, 184);
  ctx.bezierCurveTo(118, 128, 146, 86, 192, 86); // sweeping vaulted gold dome
  ctx.bezierCurveTo(238, 86, 256, 134, 244, 198); // back sweeping neck guard
  ctx.lineTo(222, 244); // angular right cheek guard
  ctx.lineTo(208, 232);
  ctx.lineTo(218, 174); // right eye cutout
  ctx.quadraticCurveTo(192, 158, 171, 168); // sleek golden brow arch
  ctx.lineTo(166, 194); // slender tapered nasal guard!
  ctx.lineTo(161, 168);
  ctx.quadraticCurveTo(146, 160, 134, 174); // left eye cutout
  ctx.lineTo(136, 224); // left cheek guard
  ctx.lineTo(124, 206);
  ctx.closePath();

  const helmGrad = ctx.createLinearGradient(122, 86, 248, 224);
  helmGrad.addColorStop(0, '#fff7c2');
  helmGrad.addColorStop(0.32, '#f5ba3b');
  helmGrad.addColorStop(0.7, '#a86919');
  helmGrad.addColorStop(1, '#472709');
  ctx.fillStyle = helmGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.2;
  ctx.stroke();

  // Sculpted metallic specular crest + engraved feathered owl-brow motif (zero goofy dots!)
  drawTaperedInkArc(ctx, 142, 126, 174, 98, 218, 114, 4.5, '#fffbe0');
  // Feathered owl-wing engraved brow ridge curving outward from center
  ctx.strokeStyle = '#5e360a';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(166, 152);
  ctx.quadraticCurveTo(146, 134, 132, 142);
  ctx.moveTo(166, 152);
  ctx.quadraticCurveTo(196, 130, 226, 144);
  ctx.moveTo(166, 142);
  ctx.quadraticCurveTo(198, 118, 232, 132);
  ctx.stroke();

  // Gleaming golden plume crest holder atop dome
  ctx.fillStyle = '#f5be42';
  ctx.beginPath();
  ctx.moveTo(164, 92);
  ctx.quadraticCurveTo(196, 62, 230, 96);
  ctx.quadraticCurveTo(196, 84, 164, 92);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.stroke();

  paintPortraitBorder(ctx, '#FDBD31');
}

function paintVoltaris(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#FFFA40', '#FFF9B8', '#1f1a08', 18);

  // Multi-lock billowing storm-cloud hair (organic swept tufts breaking silhouette!)
  paintLockRibbon(
    ctx,
    [
      [82, 248],
      [68, 190],
      [92, 174],
      [84, 122],
      [126, 90],
      [186, 62],
      [256, 78],
      [294, 128],
      [284, 172],
      [304, 212],
      [272, 266],
      [230, 262],
      [126, 264],
    ],
    '#ffffff',
    '#cfd9eb',
    '#526080'
  );
  drawTaperedInkArc(ctx, 94, 152, 108, 198, 98, 240, 3.2, '#4a5878');
  drawTaperedInkArc(ctx, 276, 148, 270, 196, 282, 238, 3.2, '#4a5878');

  const cfg: BustConfig = {
    skinHighlight: '#f5c7a2',
    skinMid: '#d6976e',
    skinShadow: '#8c5338',
    skinDeepShadow: '#4a261c',
    lipHex: '#9e5d47',
    clothLit: '#faf6eb',
    clothMid: '#c4cad9',
    clothDark: '#3f4b66',
    metalLit: '#fff9b0',
    metalMid: '#f2c438',
    metalDark: '#734d0e',
    eyeHex: '#FFFA40',
    rimHex: '#FFF68A',
    broad: true,
    expression: 'fierce',
    pauldronSide: 'left',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Majestic sculpted multi-lock storm-cloud beard (organic overlapping S-locks!)
  paintLockRibbon(
    ctx,
    [
      [130, 214],
      [114, 276],
      [142, 336],
      [172, 370],
      [212, 344],
      [246, 284],
      [230, 206],
      [206, 232],
      [170, 224],
      [144, 230],
    ],
    '#ffffff',
    '#d2dcef',
    '#5e6d8f'
  );
  // Sculpted curling silver mustache & beard lock contours
  drawTaperedInkArc(ctx, 134, 234, 162, 220, 174, 234, 3.8, INK);
  drawTaperedInkArc(ctx, 174, 234, 198, 222, 222, 240, 3.8, INK);
  drawTaperedInkArc(ctx, 140, 266, 152, 314, 174, 346, 3.2, '#4a5778');
  drawTaperedInkArc(ctx, 214, 262, 202, 308, 182, 342, 3.2, '#4a5778');

  // Swept silver brow-locks framing temples
  paintLockRibbon(
    ctx,
    [
      [120, 162],
      [144, 114],
      [196, 108],
      [242, 136],
      [230, 162],
      [190, 134],
      [144, 144],
    ],
    '#ffffff',
    '#dce5f5',
    '#7c8cad'
  );

  // Forged Swept Golden Lightning Crown (bladed metallic spikes angled heroically!)
  ctx.beginPath();
  ctx.moveTo(124, 140);
  ctx.lineTo(100, 74);
  ctx.lineTo(148, 114);
  ctx.lineTo(156, 46);
  ctx.lineTo(186, 100);
  ctx.lineTo(220, 44);
  ctx.lineTo(222, 112);
  ctx.lineTo(266, 78);
  ctx.lineTo(240, 144);
  ctx.quadraticCurveTo(184, 122, 124, 140);
  ctx.closePath();
  const crG = ctx.createLinearGradient(110, 46, 250, 142);
  crG.addColorStop(0, '#fffcb8');
  crG.addColorStop(0.5, '#f5c838');
  crG.addColorStop(1, '#7a5210');
  ctx.fillStyle = crG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.8;
  ctx.stroke();

  // Foreground crackling electric arcs!
  const drawBolt = (pts: readonly [number, number][]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = '#FFFA40';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  };
  drawBolt([
    [34, 410],
    [72, 356],
    [54, 342],
    [98, 286],
    [86, 272],
    [118, 236],
  ]);
  drawBolt([
    [328, 396],
    [290, 342],
    [308, 326],
    [268, 274],
  ]);

  paintPortraitBorder(ctx, '#FFFA40');
}

function paintTidebreaker(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#00C8FF', '#9EF0FF', '#06202e', 14);

  // Gleaming Gilded Trident angled dramatically behind left shoulder
  ctx.save();
  ctx.translate(78, 250);
  ctx.rotate(-0.18);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(0, 220);
  ctx.lineTo(0, -140);
  ctx.moveTo(-34, -126);
  ctx.quadraticCurveTo(-32, -74, 0, -76);
  ctx.quadraticCurveTo(32, -74, 34, -126);
  ctx.stroke();
  ctx.strokeStyle = '#f2be49';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.restore();

  // Wild curling ocean-wave hair locks bursting outward like crashing surf!
  paintLockRibbon(
    ctx,
    [
      [78, 268],
      [58, 214],
      [88, 196],
      [72, 134],
      [118, 88],
      [186, 62],
      [256, 76],
      [304, 128],
      [282, 178],
      [312, 224],
      [278, 282],
      [226, 272],
      [120, 274],
    ],
    '#7cf8ff',
    '#0e82a6',
    '#062c42'
  );
  drawTaperedInkArc(ctx, 84, 146, 104, 184, 82, 232, 3.4, '#9ff9ff');
  drawTaperedInkArc(ctx, 286, 142, 268, 188, 294, 238, 3.4, '#051f30');

  const cfg: BustConfig = {
    skinHighlight: '#e8aa80',
    skinMid: '#c47d56',
    skinShadow: '#7d432c',
    skinDeepShadow: '#421e16',
    lipHex: '#944e3c',
    clothLit: '#2da2bd',
    clothMid: '#125a75',
    clothDark: '#072538',
    metalLit: '#fff1a6',
    metalMid: '#eba934',
    metalDark: '#693c0c',
    eyeHex: '#63F5FF',
    rimHex: '#8CF4FF',
    broad: true,
    expression: 'smirk',
    pauldronSide: 'right',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Flowing sculpted curling wave beard!
  paintLockRibbon(
    ctx,
    [
      [130, 216],
      [118, 282],
      [152, 344],
      [182, 366],
      [226, 336],
      [244, 274],
      [228, 210],
      [198, 236],
      [168, 230],
      [146, 234],
    ],
    '#4ce4f2',
    '#0e7694',
    '#062d42'
  );
  drawTaperedInkArc(ctx, 144, 270, 162, 314, 184, 344, 3.2, '#8ef8ff');
  drawTaperedInkArc(ctx, 214, 266, 200, 308, 184, 338, 3, INK);

  // Jaunty angled Golden Sea-Crown
  ctx.fillStyle = '#f2be49';
  ctx.beginPath();
  ctx.moveTo(132, 138);
  ctx.lineTo(124, 90);
  ctx.lineTo(160, 114);
  ctx.lineTo(186, 68);
  ctx.lineTo(212, 114);
  ctx.lineTo(246, 88);
  ctx.lineTo(234, 140);
  ctx.quadraticCurveTo(184, 122, 132, 138);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.8;
  ctx.stroke();

  // Foaming cyan-white tidal surf ribbon swirling in foreground
  drawTaperedInkArc(ctx, 16, 424, 112, 356, 202, 428, 9, '#00C8FF');
  drawTaperedInkArc(ctx, 22, 418, 114, 354, 198, 420, 3.8, '#e6fcff');
  drawTaperedInkArc(ctx, 184, 424, 266, 368, 346, 408, 7, '#00C8FF');

  paintPortraitBorder(ctx, '#00C8FF');
}

function paintVelouris(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#FF32F0', '#FFC7FA', '#290924', 14);

  // Sweeping voluminous rose-magenta hair billows cascading across the frame
  ctx.beginPath();
  ctx.moveTo(42, PORTRAIT_HEIGHT + 10);
  ctx.bezierCurveTo(22, 310, 48, 86, 186, 68);
  ctx.bezierCurveTo(318, 78, 344, 290, 318, PORTRAIT_HEIGHT + 10);
  ctx.closePath();
  const hGrad = ctx.createLinearGradient(50, 74, 310, PORTRAIT_HEIGHT);
  hGrad.addColorStop(0, '#ffc2f8');
  hGrad.addColorStop(0.38, '#eb32be');
  hGrad.addColorStop(0.78, '#751268');
  hGrad.addColorStop(1, '#29062b');
  ctx.fillStyle = hGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Glossy hair highlight ribbons sweeping behind shoulders
  drawTaperedInkArc(ctx, 74, 184, 58, 286, 86, 410, 5, '#ffb8f5');
  drawTaperedInkArc(ctx, 290, 180, 308, 294, 276, 416, 4.5, '#ff8eed');

  const cfg: BustConfig = {
    skinHighlight: '#ffe6f1',
    skinMid: '#f2bed8',
    skinShadow: '#b8729c',
    skinDeepShadow: '#6b335c',
    lipHex: '#d9298a',
    clothLit: '#ff78eb',
    clothMid: '#c41e98',
    clothDark: '#470a40',
    metalLit: '#ffe0fa',
    metalMid: '#f56ee0',
    metalDark: '#701869',
    eyeHex: '#FF4CE8',
    rimHex: '#FFBEF7',
    feminine: true,
    expression: 'alluring',
    pauldronSide: 'none',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Soft rosy cheekbone highlight
  ctx.fillStyle = 'rgba(255, 76, 196, 0.25)';
  ctx.beginPath();
  ctx.ellipse(148, 212, 14, 8, -0.2, 0, Math.PI * 2);
  ctx.ellipse(196, 214, 14, 8, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Flowing foreground bangs & silky side-locks framing cheek
  paintLockRibbon(
    ctx,
    [
      [130, 150],
      [168, 108],
      [234, 126],
      [252, 210],
      [226, 286],
      [224, 186],
      [188, 134],
      [136, 166],
    ],
    '#ffcdf9',
    '#ee38c4',
    '#6e1064'
  );

  // Layered sculpted crimson-rose blossoms (multi-petal brushwork, zero flat spiral circles!)
  const drawRose = (rx: number, ry: number, r: number) => {
    // Outer scalloped rose petals
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - 0.3;
      ctx.fillStyle = i % 2 === 0 ? '#e81e96' : '#ff4ec2';
      ctx.beginPath();
      ctx.ellipse(rx + Math.cos(a) * r * 0.45, ry + Math.sin(a) * r * 0.45, r * 0.56, r * 0.42, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // Inner glowing rose heart petals
    ctx.fillStyle = '#ff9ef0';
    ctx.beginPath();
    ctx.arc(rx, ry, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.fillStyle = '#7a0a52';
    ctx.beginPath();
    ctx.arc(rx + 1, ry + 1, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  };
  drawRose(232, 134, 21);
  drawRose(252, 166, 15);
  drawRose(118, 330, 17);

  drawTaperedInkArc(ctx, 26, 446, 94, 366, 62, 258, 4, '#ff6be8');
  drawTaperedInkArc(ctx, 336, 434, 272, 356, 298, 248, 4, '#ff6be8');

  paintPortraitBorder(ctx, '#FF32F0');
}

function paintPrincePyreus(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#E6343E', '#FF9F68', '#24090f', 14);

  const cfg: BustConfig = {
    skinHighlight: '#f7cba8',
    skinMid: '#d69772',
    skinShadow: '#854c38',
    skinDeepShadow: '#421f19',
    lipHex: '#a35648',
    clothLit: '#eb313e',
    clothMid: '#9c1424',
    clothDark: '#2e0814',
    metalLit: '#fff0a8',
    metalMid: '#e8ae3c',
    metalDark: '#693d10',
    eyeHex: '#ff4238',
    eyeSecondaryHex: '#54ffa8', // iconic heterochromia!
    rimHex: '#ff8a5c',
    expression: 'smirk',
    pauldronSide: 'left',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Spiky charcoal underworld hair with blazing crimson-orange tips
  paintLockRibbon(
    ctx,
    [
      [126, 178],
      [96, 132],
      [138, 122],
      [126, 68],
      [172, 102],
      [196, 54],
      [218, 104],
      [264, 84],
      [246, 150],
      [234, 198],
      [218, 144],
      [172, 132],
      [136, 156],
    ],
    '#ff6230',
    '#2a1c2e',
    '#0d0914'
  );

  // Glowing Burnished-Gold Laurel Wreath Crown
  ctx.strokeStyle = '#ffcf48';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(182, 158, 58, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();

  paintPortraitBorder(ctx, '#E6343E');
}

function paintWardenMalice(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#D42EFF', '#FF68B8', '#1d0724', 14);

  // Sweeping serrated bat-feathered Fury wings behind shoulders
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(180 + dir * 42, 304);
    ctx.bezierCurveTo(180 + dir * 108, 172, 180 + dir * 158, 114, 180 + dir * 176, 158);
    ctx.bezierCurveTo(180 + dir * 158, 224, 180 + dir * 144, 286, 180 + dir * 116, 356);
    ctx.closePath();
    const wG = ctx.createLinearGradient(180, 120, 180 + dir * 174, 340);
    wG.addColorStop(0, '#6b2280');
    wG.addColorStop(0.55, '#2a0e3b');
    wG.addColorStop(1, '#0e0617');
    ctx.fillStyle = wG;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.5;
    ctx.stroke();
    drawTaperedInkArc(ctx, 180 + dir * 48, 280, 180 + dir * 114, 170, 180 + dir * 168, 158, 3.2, '#ff54dc');
  }

  const cfg: BustConfig = {
    skinHighlight: '#f2e6fa',
    skinMid: '#cfb8e3',
    skinShadow: '#7b5a9c',
    skinDeepShadow: '#3a2254',
    lipHex: '#9e194c',
    clothLit: '#c9265a',
    clothMid: '#6e123c',
    clothDark: '#1c071b',
    metalLit: '#ffe89c',
    metalMid: '#e8ac3c',
    metalDark: '#63380e',
    eyeHex: '#ff2864',
    rimHex: '#ff64e2',
    feminine: true,
    expression: 'fierce',
    pauldronSide: 'both',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Swept dark-violet hair & horned crimson-gold Fury crown
  paintLockRibbon(
    ctx,
    [
      [126, 170],
      [148, 114],
      [218, 114],
      [248, 178],
      [234, 260],
      [218, 174],
      [182, 134],
      [138, 152],
    ],
    '#4c2266',
    '#1e0c2e',
    '#0a0412'
  );

  ctx.fillStyle = '#f2be48';
  ctx.beginPath();
  ctx.moveTo(132, 146);
  ctx.lineTo(100, 66);
  ctx.lineTo(160, 118);
  ctx.lineTo(182, 66);
  ctx.lineTo(206, 118);
  ctx.lineTo(264, 66);
  ctx.lineTo(234, 146);
  ctx.quadraticCurveTo(182, 126, 132, 146);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.8;
  ctx.stroke();

  paintPortraitBorder(ctx, '#FF3B9A');
}

function paintSylvara(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#6EFF00', '#C6FFA0', '#0a210d', 14);

  // Gleaming Sylvan Spirit Bow & Quiver of Fletched Arrows angled behind shoulder
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(68, 92);
  ctx.bezierCurveTo(18, 200, 28, 326, 86, 444);
  ctx.stroke();
  ctx.strokeStyle = '#a86e3b';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = '#9dff66';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(68, 96);
  ctx.lineTo(86, 440);
  ctx.stroke();
  // Quiver arrow fletchings peeking behind right shoulder
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = '#6EFF00';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(270 + i * 14, 210 + i * 10);
    ctx.lineTo(240 + i * 10, 284 + i * 8);
    ctx.stroke();
  }
  ctx.restore();

  // Deep hooded forest-emerald hunter cloak framing head
  ctx.beginPath();
  ctx.moveTo(68, 340);
  ctx.bezierCurveTo(54, 152, 114, 58, 192, 62);
  ctx.bezierCurveTo(270, 66, 302, 166, 282, 340);
  ctx.closePath();
  const hoodG = ctx.createLinearGradient(70, 62, 280, 340);
  hoodG.addColorStop(0, '#368a40');
  hoodG.addColorStop(0.5, '#164522');
  hoodG.addColorStop(1, '#07170d');
  ctx.fillStyle = hoodG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();

  const cfg: BustConfig = {
    skinHighlight: '#f7d5bc',
    skinMid: '#d4a382',
    skinShadow: '#875742',
    skinDeepShadow: '#45241c',
    lipHex: '#a85a4f',
    clothLit: '#48b552',
    clothMid: '#1f612a',
    clothDark: '#0b2613',
    metalLit: '#e0ffc4',
    metalMid: '#7fe048',
    metalDark: '#23571a',
    eyeHex: '#7DFF26',
    rimHex: '#B6FF7A',
    feminine: true,
    expression: 'regal',
    pauldronSide: 'left',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Swept auburn-chestnut windblown hunter locks framing temple & cheek
  paintLockRibbon(
    ctx,
    [
      [126, 158],
      [154, 108],
      [226, 118],
      [252, 196],
      [238, 284],
      [218, 192],
      [186, 134],
      [134, 168],
    ],
    '#c77346',
    '#7d3d22',
    '#2e120c'
  );

  // Sculpted Silver Crescent Moon & Antler Circlet at temple!
  ctx.fillStyle = '#e8f5e0';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.arc(178, 126, 20, 0.35 * Math.PI, 1.65 * Math.PI);
  ctx.quadraticCurveTo(176, 126, 188, 143);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  paintPortraitBorder(ctx, '#6EFF00');
}

function paintBellum(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#FF1400', '#FF8E82', '#260507', 18);

  // Crossed Crimson-Steel War Blades rising behind obsidian armored shoulders
  ctx.save();
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(180 + dir * 24, 300);
    ctx.lineTo(180 + dir * 136, 62);
    ctx.lineTo(180 + dir * 154, 96);
    ctx.lineTo(180 + dir * 54, 316);
    ctx.closePath();
    ctx.fillStyle = dir < 0 ? '#4d1a24' : '#2b0d14';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.stroke();
    drawTaperedInkArc(ctx, 180 + dir * 34, 290, 180 + dir * 90, 180, 180 + dir * 138, 74, 3, '#ff4538');
  }
  ctx.restore();

  const cfg: BustConfig = {
    skinHighlight: '#ad847e',
    skinMid: '#7d5452',
    skinShadow: '#47282b',
    skinDeepShadow: '#210e12',
    lipHex: '#5c262b',
    clothLit: '#cc1f24',
    clothMid: '#6e0d14',
    clothDark: '#1c0508',
    metalLit: '#ffb59e',
    metalMid: '#a82222',
    metalDark: '#2b080b',
    eyeHex: '#FF2A1A',
    rimHex: '#FF7066',
    broad: true,
    expression: 'fierce',
    pauldronSide: 'both',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Iconic Crimson Blood War-Paint Mask across cheekbones & nose bridge!
  ctx.fillStyle = 'rgba(224, 18, 26, 0.86)';
  ctx.beginPath();
  ctx.moveTo(130, 186);
  ctx.lineTo(166, 198);
  ctx.lineTo(222, 186);
  ctx.lineTo(216, 214);
  ctx.lineTo(168, 218);
  ctx.lineTo(134, 210);
  ctx.closePath();
  ctx.fill();

  // Swept Raven-Black & Ash-White War Mane + Spiked Obsidian War-Crest!
  paintLockRibbon(
    ctx,
    [
      [126, 166],
      [112, 114],
      [154, 96],
      [182, 54],
      [216, 98],
      [256, 116],
      [240, 174],
      [216, 138],
      [172, 128],
      [136, 152],
    ],
    '#eef0f5',
    '#3d3138',
    '#120b12'
  );

  // Blood-red forehead battle sigil
  ctx.fillStyle = '#ff2214';
  ctx.beginPath();
  ctx.moveTo(170, 144);
  ctx.lineTo(176, 158);
  ctx.lineTo(170, 172);
  ctx.lineTo(164, 158);
  ctx.closePath();
  ctx.fill();

  paintPortraitBorder(ctx, '#FF1400');
}

function paintBacchion(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#C800FF', '#EBA8FF', '#1e0629', 14);

  // Lush Cascading Dark-Violet Wavy Revelry Hair Locks!
  paintLockRibbon(
    ctx,
    [
      [78, 286],
      [62, 206],
      [94, 118],
      [182, 68],
      [268, 102],
      [296, 200],
      [274, 294],
      [226, 272],
      [122, 274],
    ],
    '#7c2eb8',
    '#3b0f66',
    '#140426'
  );

  const cfg: BustConfig = {
    skinHighlight: '#e3a682',
    skinMid: '#ba7756',
    skinShadow: '#733e2c',
    skinDeepShadow: '#3d1c16',
    lipHex: '#964742',
    clothLit: '#b83df2',
    clothMid: '#641594',
    clothDark: '#210738',
    metalLit: '#fff0a6',
    metalMid: '#e8aa34',
    metalDark: '#693c0e',
    eyeHex: '#E04CFF',
    rimHex: '#EE9EFF',
    broad: true,
    expression: 'smirk',
    pauldronSide: 'left',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Crown of Lush Emerald Ivy Leaves & Glistening Amethyst Grape Clusters!
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  for (const [gx, gy, col] of [
    [136, 134, '#4ce064'],
    [164, 118, '#36b550'],
    [196, 118, '#4ce064'],
    [224, 132, '#36b550'],
    [126, 152, '#c82eff'],
    [134, 164, '#e478ff'],
    [234, 152, '#c82eff'],
    [226, 166, '#e478ff'],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(gx, gy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Overflowing Golden Revelry Chalice raised in foreground right!
  ctx.save();
  ctx.translate(292, 370);
  ctx.rotate(-0.18);
  ctx.fillStyle = '#f2be44';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(-30, -28);
  ctx.lineTo(30, -28);
  ctx.quadraticCurveTo(22, 12, 6, 18);
  ctx.lineTo(18, 48);
  ctx.lineTo(-18, 48);
  ctx.lineTo(-6, 18);
  ctx.quadraticCurveTo(-22, 12, -30, -28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Glowing violet wine splash cresting over rim
  ctx.fillStyle = '#df4cff';
  ctx.beginPath();
  ctx.ellipse(0, -28, 26, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  paintPortraitBorder(ctx, '#C800FF');
}

function paintGlaciera(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#60BDFF', '#D6F0FF', '#081829', 16);

  // Sweeping Frost-Silver Braided Tresses & Crystalline Ice Halo
  paintLockRibbon(
    ctx,
    [
      [70, 312],
      [62, 180],
      [112, 86],
      [186, 68],
      [264, 92],
      [298, 198],
      [284, 326],
      [224, 286],
      [126, 286],
    ],
    '#ffffff',
    '#c6d9ed',
    '#526c8f'
  );

  const cfg: BustConfig = {
    skinHighlight: '#eff5fc',
    skinMid: '#c6d6eb',
    skinShadow: '#7b92b5',
    skinDeepShadow: '#384b6e',
    lipHex: '#7d8eb0',
    clothLit: '#a8deff',
    clothMid: '#3d79ad',
    clothDark: '#122945',
    metalLit: '#ffffff',
    metalMid: '#8cd4ff',
    metalDark: '#2c5b85',
    eyeHex: '#7CE0FF',
    rimHex: '#D4F4FF',
    feminine: true,
    expression: 'regal',
    pauldronSide: 'both',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Swept silver temple locks framing austere cheekbone
  paintLockRibbon(
    ctx,
    [
      [128, 154],
      [164, 112],
      [226, 122],
      [244, 200],
      [222, 166],
      [184, 134],
      [136, 164],
    ],
    '#ffffff',
    '#d8e8fa',
    '#6d87ab'
  );

  // Sharp Faceted Crystalline Glacial Diadem!
  ctx.beginPath();
  ctx.moveTo(124, 140);
  ctx.lineTo(116, 86);
  ctx.lineTo(148, 116);
  ctx.lineTo(164, 52);
  ctx.lineTo(182, 102);
  ctx.lineTo(206, 46);
  ctx.lineTo(216, 112);
  ctx.lineTo(248, 84);
  ctx.lineTo(238, 140);
  ctx.closePath();
  const iceG = ctx.createLinearGradient(120, 48, 240, 140);
  iceG.addColorStop(0, '#ffffff');
  iceG.addColorStop(0.45, '#8ee0ff');
  iceG.addColorStop(1, '#2b6c9e');
  ctx.fillStyle = iceG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4;
  ctx.stroke();

  // Floating geometric frost snowflakes in foreground
  ctx.strokeStyle = '#d9f4ff';
  ctx.lineWidth = 2.6;
  for (const [fx, fy, r] of [
    [54, 128, 14],
    [310, 148, 12],
    [62, 378, 16],
  ]) {
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(fx - Math.cos(a) * r, fy - Math.sin(a) * r);
      ctx.lineTo(fx + Math.cos(a) * r, fy + Math.sin(a) * r);
      ctx.stroke();
    }
  }

  paintPortraitBorder(ctx, '#60BDFF');
}

function paintVeloce(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#FF5A00', '#FFC18F', '#291006', 16);

  // Kinetic diagonal golden speed streaks zooming behind herald!
  ctx.save();
  ctx.strokeStyle = '#ff9838';
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(20, 110 + i * 54);
    ctx.lineTo(340, 62 + i * 54);
    ctx.stroke();
  }
  ctx.restore();

  const cfg: BustConfig = {
    skinHighlight: '#f7cfa8',
    skinMid: '#d1986e',
    skinShadow: '#854e32',
    skinDeepShadow: '#422014',
    lipHex: '#9e5340',
    clothLit: '#ff8a36',
    clothMid: '#c44512',
    clothDark: '#3d1408',
    metalLit: '#fff0a8',
    metalMid: '#f2ac34',
    metalDark: '#703d0c',
    eyeHex: '#FF9E2C',
    rimHex: '#FFCB80',
    expression: 'smirk',
    pauldronSide: 'left',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Tousled wind-swept auburn bangs peeking beneath winged messenger helm
  paintLockRibbon(
    ctx,
    [
      [126, 166],
      [148, 134],
      [212, 138],
      [242, 184],
      [226, 198],
      [192, 152],
      [142, 162],
    ],
    '#c7622e',
    '#7d3214',
    '#2e1008'
  );

  // Iconic Burnished-Bronze Winged Swift-Helm with Swept Feathered Wings!
  ctx.beginPath();
  ctx.moveTo(126, 156);
  ctx.bezierCurveTo(124, 96, 160, 74, 192, 76);
  ctx.bezierCurveTo(228, 78, 246, 108, 242, 158);
  ctx.quadraticCurveTo(182, 134, 126, 156);
  ctx.closePath();
  const hG = ctx.createLinearGradient(126, 76, 242, 156);
  hG.addColorStop(0, '#fff2b0');
  hG.addColorStop(0.45, '#e89b2c');
  hG.addColorStop(1, '#66340a');
  ctx.fillStyle = hG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.8;
  ctx.stroke();

  // Sweeping white-and-gold feathered wings bursting from both temples!
  for (const dir of [-1, 1] as const) {
    ctx.fillStyle = '#fff5dc';
    ctx.beginPath();
    ctx.moveTo(184 + dir * 48, 134);
    ctx.quadraticCurveTo(184 + dir * 102, 78, 184 + dir * 130, 56);
    ctx.quadraticCurveTo(184 + dir * 116, 102, 184 + dir * 92, 126);
    ctx.quadraticCurveTo(184 + dir * 108, 126, 184 + dir * 68, 146);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.2;
    ctx.stroke();
  }

  paintPortraitBorder(ctx, '#FF5A00');
}

function paintAbyssos(ctx: CanvasRenderingContext2D): void {
  paintMythicBackdrop(ctx, '#6419FF', '#C4A8FF', '#0d041f', 12);

  // Floating Golden Primordial Orbit Rings & Starlit Cosmic Nebula Cloak
  ctx.save();
  ctx.strokeStyle = '#d9b5ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(180, 198, 148, 54, -0.32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#f2c154';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(180, 198, 134, 42, 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Ethereal Swirling Starry Nebula Shroud
  ctx.beginPath();
  ctx.moveTo(46, PORTRAIT_HEIGHT + 8);
  ctx.bezierCurveTo(36, 260, 74, 72, 184, 62);
  ctx.bezierCurveTo(294, 72, 326, 260, 314, PORTRAIT_HEIGHT + 8);
  ctx.closePath();
  const nebG = ctx.createLinearGradient(50, 62, 310, PORTRAIT_HEIGHT);
  nebG.addColorStop(0, '#5a1cd6');
  nebG.addColorStop(0.5, '#1f084d');
  nebG.addColorStop(1, '#070214');
  ctx.fillStyle = nebG;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.5;
  ctx.stroke();

  const cfg: BustConfig = {
    skinHighlight: '#ebe3ff',
    skinMid: '#b5a0ed',
    skinShadow: '#5e43a3',
    skinDeepShadow: '#241252',
    lipHex: '#5c389e',
    clothLit: '#7c36ff',
    clothMid: '#370f85',
    clothDark: '#0f0426',
    metalLit: '#fff0b8',
    metalMid: '#d9a441',
    metalDark: '#4a2b10',
    eyeHex: '#B67CFF',
    rimHex: '#D8B8FF',
    expression: 'regal',
    pauldronSide: 'none',
  };

  paintHeroicTorso34(ctx, cfg);
  paintHeroicHead34(ctx, cfg);

  // Surreal Floating Third Void Eye on Brow + Twin Orbiting Eldritch Eyes!
  const drawVoidEye = (ex: number, ey: number, rx: number, ry: number) => {
    ctx.fillStyle = '#090414';
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f2be54';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#b46eff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx * 0.45, ry * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx * 0.14, ry * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drawVoidEye(174, 146, 22, 11);
  drawVoidEye(72, 140, 26, 13);
  drawVoidEye(292, 232, 24, 12);

  paintPortraitBorder(ctx, '#6419FF');
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
