/**
 * ProceduralPortraits — High-resolution (360x480) Jen Zee / Supergiant-style comic-ink
 * illustrated character portraits for all 10 Patrons, Prince Pyreus, and Warden Malice.
 *
 * Lazily renders onto offscreen canvases and caches PNG data URLs (zero per-frame work).
 * `getPortraitAssetIds()` is 100% pure Node-safe for Gate A `verify:assets` validation.
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

const INK = '#08060e';
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

  // Graceful SVG fallback if invoked in a headless environment without Canvas 2D
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
// Comic-Ink Illustration Helpers
// ============================================================================

function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  primaryHex: string,
  accentHex: string,
  darkHex: string,
  rayCount: number
): void {
  const w = PORTRAIT_WIDTH;
  const h = PORTRAIT_HEIGHT;

  // Dramatic jewel-tone gradient
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, darkHex);
  bg.addColorStop(0.55, '#120d1c');
  bg.addColorStop(1, '#07050c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Backlight celestial halo
  const halo = ctx.createRadialGradient(w * 0.5, h * 0.37, 16, w * 0.5, h * 0.37, 210);
  halo.addColorStop(0, accentHex);
  halo.addColorStop(0.35, primaryHex);
  halo.addColorStop(0.75, 'rgba(18, 12, 28, 0.25)');
  halo.addColorStop(1, 'rgba(8, 6, 14, 0)');
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Sharp comic sunburst geometric rays
  ctx.save();
  ctx.translate(w * 0.5, h * 0.36);
  ctx.fillStyle = primaryHex;
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < rayCount; i++) {
    const a0 = (i * Math.PI * 2) / rayCount;
    const a1 = a0 + Math.PI / (rayCount * 1.9);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * 320, Math.sin(a0) * 320);
    ctx.lineTo(Math.cos(a1) * 320, Math.sin(a1) * 320);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Ornate concentric patron mandala ring
  ctx.save();
  ctx.strokeStyle = primaryHex;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.36, 132, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([12, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.36, 146, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function paintComicHatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  spacing = 7,
  angle = -0.55
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(8, 6, 14, 0.36)';
  ctx.lineWidth = 1.6;
  ctx.translate(x + w * 0.5, y + h * 0.5);
  ctx.rotate(angle);
  const diag = Math.hypot(w, h) * 0.6;
  ctx.beginPath();
  for (let p = -diag; p <= diag; p += spacing) {
    ctx.moveTo(p, -diag);
    ctx.lineTo(p, diag);
  }
  ctx.stroke();
  ctx.restore();
}

function paintBustBase(
  ctx: CanvasRenderingContext2D,
  opts: {
    skinLit: string;
    skinMid: string;
    skinDark: string;
    armorPrimary: string;
    armorDark: string;
    trimHex: string;
    eyeHex: string;
    rimHex: string;
    jawWidth?: number;
    shoulderWidth?: number;
    expression?: 'stern' | 'smirk' | 'fierce' | 'serene';
  }
): void {
  const cx = PORTRAIT_WIDTH * 0.5;
  const shoulderW = opts.shoulderWidth ?? 136;
  const jawW = opts.jawWidth ?? 54;

  // Broad sculptural shoulders & mythic drape
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, PORTRAIT_HEIGHT + 10);
  ctx.quadraticCurveTo(cx - shoulderW * 0.96, 336, cx - shoulderW * 0.62, 300);
  ctx.lineTo(cx - 32, 276);
  ctx.lineTo(cx + 32, 276);
  ctx.lineTo(cx + shoulderW * 0.62, 300);
  ctx.quadraticCurveTo(cx + shoulderW * 0.96, 336, cx + shoulderW, PORTRAIT_HEIGHT + 10);
  ctx.closePath();

  const shGrad = ctx.createLinearGradient(cx - shoulderW, 280, cx + shoulderW, PORTRAIT_HEIGHT);
  shGrad.addColorStop(0, opts.armorPrimary);
  shGrad.addColorStop(0.55, opts.armorDark);
  shGrad.addColorStop(1, '#0c0914');
  ctx.fillStyle = shGrad;
  ctx.fill();

  ctx.save();
  ctx.clip();
  paintComicHatch(ctx, cx + 10, 290, shoulderW, 190, 8, -0.5);
  // Diagonal sash / gilded trim
  ctx.strokeStyle = opts.trimHex;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW * 0.68, 304);
  ctx.quadraticCurveTo(cx, 368, cx + shoulderW * 0.68, 304);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Neck
  ctx.beginPath();
  ctx.moveTo(cx - 26, 240);
  ctx.lineTo(cx - 30, 300);
  ctx.quadraticCurveTo(cx, 322, cx + 30, 300);
  ctx.lineTo(cx + 26, 240);
  ctx.closePath();
  const neckGrad = ctx.createLinearGradient(cx - 26, 240, cx + 26, 300);
  neckGrad.addColorStop(0, opts.skinMid);
  neckGrad.addColorStop(0.65, opts.skinDark);
  neckGrad.addColorStop(1, '#1c121a');
  ctx.fillStyle = neckGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Cast chin shadow across upper neck
  ctx.fillStyle = 'rgba(10, 6, 18, 0.52)';
  ctx.beginPath();
  ctx.ellipse(cx, 266, 26, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sculpted mythic head & angular jawline
  const headY = 188;
  ctx.beginPath();
  ctx.moveTo(cx - jawW, headY - 12);
  ctx.quadraticCurveTo(cx - jawW * 1.04, headY - 76, cx, headY - 80);
  ctx.quadraticCurveTo(cx + jawW * 1.04, headY - 76, cx + jawW, headY - 12);
  ctx.lineTo(cx + jawW * 0.78, headY + 42);
  ctx.quadraticCurveTo(cx + jawW * 0.25, headY + 72, cx, headY + 76);
  ctx.quadraticCurveTo(cx - jawW * 0.25, headY + 72, cx - jawW * 0.78, headY + 42);
  ctx.closePath();

  const faceGrad = ctx.createLinearGradient(cx - jawW, headY - 70, cx + jawW, headY + 70);
  faceGrad.addColorStop(0, opts.skinLit);
  faceGrad.addColorStop(0.52, opts.skinMid);
  faceGrad.addColorStop(1, opts.skinDark);
  ctx.fillStyle = faceGrad;
  ctx.fill();

  // Hard 3-tone cel shadow plane on right cheek/temple
  ctx.save();
  ctx.clip();
  ctx.fillStyle = opts.skinDark;
  ctx.globalAlpha = 0.62;
  ctx.beginPath();
  ctx.moveTo(cx + 12, headY - 82);
  ctx.lineTo(cx + jawW + 10, headY - 82);
  ctx.lineTo(cx + jawW + 10, headY + 84);
  ctx.lineTo(cx + 6, headY + 84);
  ctx.quadraticCurveTo(cx + 24, headY + 12, cx + 12, headY - 82);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  paintComicHatch(ctx, cx + 16, headY - 40, jawW, 120, 7, -0.45);

  // Colored rim highlight along lit left jawline
  ctx.strokeStyle = opts.rimHex;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(cx - jawW + 4, headY - 30);
  ctx.lineTo(cx - jawW + 4, headY + 34);
  ctx.quadraticCurveTo(cx - jawW * 0.3, headY + 66, cx - 4, headY + 70);
  ctx.stroke();
  ctx.restore();

  // Bold tapered ink facial contour
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.5;
  ctx.stroke();

  // Sculpted angular nose bridge & shadow
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - 2, headY - 12);
  ctx.lineTo(cx - 7, headY + 18);
  ctx.lineTo(cx + 4, headY + 21);
  ctx.stroke();

  // Expressive inked brows & luminous divine eyes
  const expr = opts.expression ?? 'stern';
  const browTilt = expr === 'fierce' ? 7 : expr === 'serene' ? -2 : 4;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(cx - 38, headY - 18 - browTilt * 0.5);
  ctx.lineTo(cx - 10, headY - 14 + browTilt);
  ctx.moveTo(cx + 38, headY - 18 - browTilt * 0.5);
  ctx.lineTo(cx + 10, headY - 14 + browTilt);
  ctx.stroke();

  for (const dir of [-1, 1] as const) {
    const ex = cx + dir * 23;
    const ey = headY - 4;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(ex - 13, ey);
    ctx.quadraticCurveTo(ex, ey - 8, ex + 13, ey);
    ctx.quadraticCurveTo(ex, ey + 7, ex - 13, ey);
    ctx.closePath();
    ctx.fill();

    // Glowing divine iris
    ctx.fillStyle = opts.eyeHex;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 6.2, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 2, ey - 1.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Confident comic mouth line
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  if (expr === 'smirk') {
    ctx.moveTo(cx - 14, headY + 42);
    ctx.quadraticCurveTo(cx + 4, headY + 46, cx + 18, headY + 34);
  } else if (expr === 'serene') {
    ctx.moveTo(cx - 14, headY + 40);
    ctx.quadraticCurveTo(cx, headY + 46, cx + 14, headY + 40);
  } else {
    ctx.moveTo(cx - 15, headY + 42);
    ctx.quadraticCurveTo(cx, headY + 38, cx + 15, headY + 42);
  }
  ctx.stroke();
}

function paintPortraitFrame(ctx: CanvasRenderingContext2D, accentHex: string): void {
  const w = PORTRAIT_WIDTH;
  const h = PORTRAIT_HEIGHT;

  // Bottom shadow vignette for clean UI card blending
  const vig = ctx.createLinearGradient(0, h - 105, 0, h);
  vig.addColorStop(0, 'rgba(8, 6, 14, 0)');
  vig.addColorStop(1, 'rgba(8, 6, 14, 0.88)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, h - 105, w, 105);

  // Subtle gilded corner brackets & ink border
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.strokeRect(2.5, 2.5, w - 5, h - 5);
}

// ============================================================================
// Flagship Bespoke Portrait Illustrators
// ============================================================================

function paintVoltaris(ctx: CanvasRenderingContext2D): void {
  const cx = PORTRAIT_WIDTH * 0.5;
  paintBackdrop(ctx, '#FFFA40', '#FFF8A6', '#211c0c', 16);

  // Flowing tempest storm-cloud hair behind head
  ctx.beginPath();
  ctx.moveTo(cx - 98, 226);
  ctx.quadraticCurveTo(cx - 114, 128, cx - 56, 86);
  ctx.quadraticCurveTo(cx, 54, cx + 58, 86);
  ctx.quadraticCurveTo(cx + 114, 130, cx + 98, 226);
  ctx.closePath();
  const hairGrad = ctx.createLinearGradient(cx - 90, 70, cx + 90, 230);
  hairGrad.addColorStop(0, '#ffffff');
  hairGrad.addColorStop(0.5, '#cbd4e6');
  hairGrad.addColorStop(1, '#586480');
  ctx.fillStyle = hairGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();

  paintBustBase(ctx, {
    skinLit: '#f2c19b',
    skinMid: '#d4956c',
    skinDark: '#7d4b34',
    armorPrimary: '#f5f2e6',
    armorDark: '#4d5873',
    trimHex: '#ffd845',
    eyeHex: '#FFFA40',
    rimHex: '#FFF68A',
    jawWidth: 58,
    shoulderWidth: 146,
    expression: 'stern',
  });

  // Sculpted silver storm-cloud beard with bold comic curls!
  ctx.beginPath();
  ctx.moveTo(cx - 58, 198);
  ctx.quadraticCurveTo(cx - 72, 268, cx - 44, 316);
  ctx.quadraticCurveTo(cx - 24, 344, cx, 356);
  ctx.quadraticCurveTo(cx + 24, 344, cx + 44, 316);
  ctx.quadraticCurveTo(cx + 72, 268, cx + 58, 198);
  ctx.quadraticCurveTo(cx + 26, 224, cx, 218);
  ctx.quadraticCurveTo(cx - 26, 224, cx - 58, 198);
  ctx.closePath();
  const beardGrad = ctx.createLinearGradient(cx - 56, 200, cx + 56, 352);
  beardGrad.addColorStop(0, '#ffffff');
  beardGrad.addColorStop(0.55, '#ced8ea');
  beardGrad.addColorStop(1, '#687694');
  ctx.fillStyle = beardGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.5;
  ctx.stroke();

  // Beard ink curl lines
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx - 28, 250);
  ctx.quadraticCurveTo(cx - 18, 294, cx - 6, 326);
  ctx.moveTo(cx + 28, 250);
  ctx.quadraticCurveTo(cx + 18, 294, cx + 6, 326);
  ctx.stroke();

  // Crackling Golden Lightning Crown
  ctx.fillStyle = '#FFE44D';
  ctx.beginPath();
  ctx.moveTo(cx - 64, 134);
  ctx.lineTo(cx - 82, 76);
  ctx.lineTo(cx - 38, 108);
  ctx.lineTo(cx - 28, 48);
  ctx.lineTo(cx, 96);
  ctx.lineTo(cx + 28, 48);
  ctx.lineTo(cx + 38, 108);
  ctx.lineTo(cx + 82, 76);
  ctx.lineTo(cx + 64, 134);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Electric foreground lightning arcs framing shoulders
  ctx.strokeStyle = '#FFFA40';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(42, 396);
  ctx.lineTo(74, 344);
  ctx.lineTo(54, 332);
  ctx.lineTo(94, 276);
  ctx.moveTo(318, 392);
  ctx.lineTo(286, 340);
  ctx.lineTo(306, 326);
  ctx.lineTo(268, 270);
  ctx.stroke();

  paintPortraitFrame(ctx, '#FFFA40');
}

function paintTidebreaker(ctx: CanvasRenderingContext2D): void {
  const cx = PORTRAIT_WIDTH * 0.5;
  paintBackdrop(ctx, '#00C8FF', '#99EEFF', '#08202c', 12);

  // Gleaming golden trident crest behind left shoulder
  ctx.strokeStyle = '#f2c152';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(64, 460);
  ctx.lineTo(82, 108);
  ctx.moveTo(50, 124);
  ctx.lineTo(54, 174);
  ctx.lineTo(110, 174);
  ctx.lineTo(114, 124);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Flowing windswept sea-teal mane
  ctx.beginPath();
  ctx.moveTo(cx - 104, 250);
  ctx.bezierCurveTo(cx - 128, 132, cx - 54, 62, cx + 10, 74);
  ctx.bezierCurveTo(cx + 86, 62, cx + 130, 146, cx + 102, 258);
  ctx.closePath();
  const maneGrad = ctx.createLinearGradient(cx - 100, 70, cx + 100, 260);
  maneGrad.addColorStop(0, '#5ef4ff');
  maneGrad.addColorStop(0.5, '#0b7b9e');
  maneGrad.addColorStop(1, '#08324a');
  ctx.fillStyle = maneGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();

  paintBustBase(ctx, {
    skinLit: '#e3a57d',
    skinMid: '#bf7954',
    skinDark: '#693927',
    armorPrimary: '#1a6c85',
    armorDark: '#0b2c3d',
    trimHex: '#f2bd4e',
    eyeHex: '#59f4ff',
    rimHex: '#80ecff',
    jawWidth: 58,
    shoulderWidth: 148,
    expression: 'smirk',
  });

  // Flowing curling ocean-wave beard
  ctx.beginPath();
  ctx.moveTo(cx - 56, 206);
  ctx.quadraticCurveTo(cx - 72, 280, cx - 32, 336);
  ctx.quadraticCurveTo(cx, 360, cx + 38, 334);
  ctx.quadraticCurveTo(cx + 76, 274, cx + 56, 206);
  ctx.quadraticCurveTo(cx, 232, cx - 56, 206);
  ctx.closePath();
  ctx.fillStyle = '#0e6985';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.5;
  ctx.stroke();

  // Golden Sea-Crown
  ctx.fillStyle = '#f2be4c';
  ctx.beginPath();
  ctx.moveTo(cx - 54, 134);
  ctx.lineTo(cx - 60, 88);
  ctx.lineTo(cx - 24, 112);
  ctx.lineTo(cx, 72);
  ctx.lineTo(cx + 24, 112);
  ctx.lineTo(cx + 60, 88);
  ctx.lineTo(cx + 54, 134);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Foaming cyan surf crest across bottom
  ctx.strokeStyle = '#99f3ff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(22, 412);
  ctx.quadraticCurveTo(96, 362, 160, 418);
  ctx.quadraticCurveTo(234, 366, 336, 404);
  ctx.stroke();

  paintPortraitFrame(ctx, '#00C8FF');
}

function paintAegira(ctx: CanvasRenderingContext2D): void {
  const cx = PORTRAIT_WIDTH * 0.5;
  paintBackdrop(ctx, '#FDBD31', '#FFF0B0', '#241a0a', 18);

  // Radiant circular Aegis shield rising behind right shoulder
  ctx.beginPath();
  ctx.arc(cx + 96, 340, 108, 0, Math.PI * 2);
  const shGrad = ctx.createRadialGradient(cx + 74, 314, 12, cx + 96, 340, 108);
  shGrad.addColorStop(0, '#fff2b0');
  shGrad.addColorStop(0.55, '#d99a2b');
  shGrad.addColorStop(1, '#5e3c10');
  ctx.fillStyle = shGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();

  paintBustBase(ctx, {
    skinLit: '#b87654',
    skinMid: '#8c5136',
    skinDark: '#47251a',
    armorPrimary: '#f2e6cf',
    armorDark: '#6b5740',
    trimHex: '#FDBD31',
    eyeHex: '#FFE278',
    rimHex: '#FFE899',
    jawWidth: 48,
    shoulderWidth: 132,
    expression: 'stern',
  });

  // Iconic Burnished-Gold Owl-Crested Corinthian Helm!
  ctx.beginPath();
  ctx.moveTo(cx - 56, 174);
  ctx.quadraticCurveTo(cx - 64, 90, cx, 84);
  ctx.quadraticCurveTo(cx + 64, 90, cx + 56, 174);
  ctx.lineTo(cx + 46, 206);
  ctx.lineTo(cx + 38, 152);
  ctx.lineTo(cx, 166);
  ctx.lineTo(cx - 38, 152);
  ctx.lineTo(cx - 46, 206);
  ctx.closePath();
  const hGrad = ctx.createLinearGradient(cx - 60, 84, cx + 60, 204);
  hGrad.addColorStop(0, '#fff4b8');
  hGrad.addColorStop(0.45, '#f2b738');
  hGrad.addColorStop(1, '#7a4b12');
  ctx.fillStyle = hGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.5;
  ctx.stroke();

  // Towering Owl-Wing Plume Crest atop helm
  ctx.fillStyle = '#fff5dc';
  ctx.beginPath();
  ctx.moveTo(cx - 18, 90);
  ctx.quadraticCurveTo(cx - 34, 34, cx, 26);
  ctx.quadraticCurveTo(cx + 42, 34, cx + 22, 92);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Owl eye emblem etched on brow of helm
  ctx.fillStyle = '#291a0a';
  ctx.beginPath();
  ctx.arc(cx - 14, 128, 7, 0, Math.PI * 2);
  ctx.arc(cx + 14, 128, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFE478';
  ctx.beginPath();
  ctx.arc(cx - 14, 128, 3.2, 0, Math.PI * 2);
  ctx.arc(cx + 14, 128, 3.2, 0, Math.PI * 2);
  ctx.fill();

  paintPortraitFrame(ctx, '#FDBD31');
}

function paintVelouris(ctx: CanvasRenderingContext2D): void {
  const cx = PORTRAIT_WIDTH * 0.5;
  paintBackdrop(ctx, '#FF32F0', '#FFC2FA', '#260a24', 14);

  // Cascading sweeping rose-magenta hair billows framing the entire portrait
  ctx.beginPath();
  ctx.moveTo(cx - 140, 470);
  ctx.bezierCurveTo(cx - 154, 290, cx - 126, 94, cx, 78);
  ctx.bezierCurveTo(cx + 126, 94, cx + 156, 290, cx + 142, 470);
  ctx.closePath();
  const hairGrad = ctx.createLinearGradient(cx - 130, 80, cx + 130, 460);
  hairGrad.addColorStop(0, '#ffb0f6');
  hairGrad.addColorStop(0.45, '#e82cb8');
  hairGrad.addColorStop(1, '#540d4f');
  ctx.fillStyle = hairGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();

  paintBustBase(ctx, {
    skinLit: '#ffe0ee',
    skinMid: '#f2b8d4',
    skinDark: '#a6658c',
    armorPrimary: '#e328a8',
    armorDark: '#590d4a',
    trimHex: '#ffb5f2',
    eyeHex: '#FF5CF2',
    rimHex: '#FFADF9',
    jawWidth: 46,
    shoulderWidth: 118,
    expression: 'serene',
  });

  // Swept foreground locks & glowing rose blossom crown
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.fillStyle = '#ff6be4';
  for (const [rx, ry, r] of [
    [cx - 46, 118, 18],
    [cx + 46, 118, 18],
    [cx, 102, 22],
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffd4f8';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(rx, ry, r * 0.52, 0.2, Math.PI * 1.6);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
  }

  // Curling glowing thorn-rose vines in foreground
  ctx.strokeStyle = '#ff68e8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(28, 440);
  ctx.bezierCurveTo(84, 380, 52, 300, 104, 240);
  ctx.moveTo(332, 430);
  ctx.bezierCurveTo(278, 370, 308, 290, 256, 236);
  ctx.stroke();

  paintPortraitFrame(ctx, '#FF32F0');
}

function paintPrincePyreus(ctx: CanvasRenderingContext2D): void {
  const cx = PORTRAIT_WIDTH * 0.5;
  paintBackdrop(ctx, '#E6343E', '#FF9F68', '#1f0a10', 14);

  paintBustBase(ctx, {
    skinLit: '#f5c7a6',
    skinMid: '#d69772',
    skinDark: '#7a4734',
    armorPrimary: '#d92634',
    armorDark: '#301420',
    trimHex: '#f2ba48',
    eyeHex: '#ff4238',
    rimHex: '#ff8a5c',
    jawWidth: 50,
    shoulderWidth: 136,
    expression: 'smirk',
  });

  // Iconic heterochromia right emerald eye glint
  ctx.fillStyle = '#52ffa8';
  ctx.beginPath();
  ctx.ellipse(cx + 23, 184, 6.2, 4.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spiky charcoal hair w/ fiery tips
  ctx.beginPath();
  ctx.moveTo(cx - 64, 174);
  ctx.lineTo(cx - 88, 128);
  ctx.lineTo(cx - 46, 124);
  ctx.lineTo(cx - 56, 70);
  ctx.lineTo(cx - 10, 104);
  ctx.lineTo(cx + 16, 56);
  ctx.lineTo(cx + 38, 106);
  ctx.lineTo(cx + 84, 88);
  ctx.lineTo(cx + 66, 174);
  ctx.quadraticCurveTo(cx, 134, cx - 64, 174);
  ctx.closePath();
  const hGrad = ctx.createLinearGradient(cx, 56, cx, 176);
  hGrad.addColorStop(0, '#ff5c2e');
  hGrad.addColorStop(0.35, '#2b1e2e');
  hGrad.addColorStop(1, '#0e0b14');
  ctx.fillStyle = hGrad;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5.5;
  ctx.stroke();

  // Golden laurel crown
  ctx.strokeStyle = '#ffcf48';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, 160, 62, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();

  paintPortraitFrame(ctx, '#E6343E');
}

function paintWardenMalice(ctx: CanvasRenderingContext2D): void {
  const cx = PORTRAIT_WIDTH * 0.5;
  paintBackdrop(ctx, '#D42EFF', '#FF66B5', '#1d0824', 12);

  // Swept bat wings rising behind shoulders
  ctx.fillStyle = '#250e36';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + dir * 48, 300);
    ctx.quadraticCurveTo(cx + dir * 130, 120, cx + dir * 172, 168);
    ctx.quadraticCurveTo(cx + dir * 150, 260, cx + dir * 132, 340);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  paintBustBase(ctx, {
    skinLit: '#ede0f5',
    skinMid: '#cbb5de',
    skinDark: '#6b4d8a',
    armorPrimary: '#a61c4c',
    armorDark: '#2a0d2e',
    trimHex: '#f2ba48',
    eyeHex: '#ff2b68',
    rimHex: '#ff5CE0',
    jawWidth: 46,
    shoulderWidth: 126,
    expression: 'fierce',
  });

  // Horned crimson-gold Fury crown
  ctx.fillStyle = '#f2ba48';
  ctx.beginPath();
  ctx.moveTo(cx - 56, 148);
  ctx.lineTo(cx - 86, 62);
  ctx.lineTo(cx - 24, 118);
  ctx.lineTo(cx, 64);
  ctx.lineTo(cx + 24, 118);
  ctx.lineTo(cx + 86, 62);
  ctx.lineTo(cx + 56, 148);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();

  paintPortraitFrame(ctx, '#FF3B9A');
}

function paintSecondaryPatron(ctx: CanvasRenderingContext2D, patronId: PatronId): void {
  const cx = PORTRAIT_WIDTH * 0.5;
  const def = PATRON_CONSTANTS[patronId];
  paintBackdrop(ctx, def.colorHex, def.accentHex, '#120d1c', 12);

  const skinMap: Record<
    PatronId,
    { lit: string; mid: string; dark: string; armor: string; armorDark: string }
  > = {
    voltaris: { lit: '#f2c19b', mid: '#d4956c', dark: '#7d4b34', armor: '#f5f2e6', armorDark: '#4d5873' },
    tidebreaker: { lit: '#e3a57d', mid: '#bf7954', dark: '#693927', armor: '#1a6c85', armorDark: '#0b2c3d' },
    aegira: { lit: '#b87654', mid: '#8c5136', dark: '#47251a', armor: '#f2e6cf', armorDark: '#6b5740' },
    velouris: { lit: '#ffe0ee', mid: '#f2b8d4', dark: '#a6658c', armor: '#e328a8', armorDark: '#590d4a' },
    sylvara: { lit: '#f2ccb0', mid: '#cf9e7e', dark: '#784e3c', armor: '#266929', armorDark: '#102e16' },
    bellum: { lit: '#b58d86', mid: '#825a57', dark: '#422628', armor: '#9e1919', armorDark: '#2b090c' },
    bacchion: { lit: '#d49876', mid: '#a86a4e', dark: '#5c3224', armor: '#751fa6', armorDark: '#260b3d' },
    glaciera: { lit: '#e4ecf7', mid: '#b7c7de', dark: '#637594', armor: '#4384b8', armorDark: '#162d47' },
    veloce: { lit: '#f2c6a0', mid: '#cc9368', dark: '#73472c', armor: '#d95b16', armorDark: '#451d0d' },
    abyssos: { lit: '#d4c4ff', mid: '#8c6ee0', dark: '#37236e', armor: '#4c18a8', armorDark: '#14082b' },
  };
  const s = skinMap[patronId];

  // Swept regal mantle/hood silhouette
  ctx.fillStyle = s.armorDark;
  ctx.beginPath();
  ctx.moveTo(cx - 104, 290);
  ctx.quadraticCurveTo(cx - 118, 92, cx, 72);
  ctx.quadraticCurveTo(cx + 118, 92, cx + 104, 290);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();

  paintBustBase(ctx, {
    skinLit: s.lit,
    skinMid: s.mid,
    skinDark: s.dark,
    armorPrimary: s.armor,
    armorDark: s.armorDark,
    trimHex: def.colorHex,
    eyeHex: def.colorHex,
    rimHex: def.accentHex,
    expression: patronId === 'bellum' ? 'fierce' : patronId === 'bacchion' ? 'smirk' : 'stern',
  });

  // Iconic headpiece per patron
  ctx.fillStyle = def.colorHex;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (patronId === 'sylvara') {
    // Crescent huntress circlet
    ctx.arc(cx, 126, 26, 0.25 * Math.PI, 1.75 * Math.PI);
    ctx.closePath();
  } else if (patronId === 'bellum') {
    // Crimson war crest helm
    ctx.moveTo(cx - 48, 136);
    ctx.lineTo(cx, 54);
    ctx.lineTo(cx + 48, 136);
    ctx.closePath();
  } else if (patronId === 'glaciera') {
    // Frost-shard diadem
    ctx.moveTo(cx - 56, 134);
    ctx.lineTo(cx - 34, 72);
    ctx.lineTo(cx, 102);
    ctx.lineTo(cx + 34, 72);
    ctx.lineTo(cx + 56, 134);
    ctx.closePath();
  } else if (patronId === 'veloce') {
    // Winged messenger helm
    ctx.moveTo(cx - 58, 134);
    ctx.lineTo(cx - 96, 84);
    ctx.lineTo(cx - 38, 112);
    ctx.lineTo(cx + 38, 112);
    ctx.lineTo(cx + 96, 84);
    ctx.lineTo(cx + 58, 134);
    ctx.closePath();
  } else if (patronId === 'abyssos') {
    // Floating third void eye above brow
    ctx.ellipse(cx, 112, 34, 18, 0, 0, Math.PI * 2);
  } else {
    // Bacchion vine & grape laurel
    ctx.ellipse(cx, 124, 58, 16, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();

  paintPortraitFrame(ctx, def.colorHex);
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
    case 'prince_pyreus':
      paintPrincePyreus(ctx);
      break;
    case 'warden_malice':
      paintWardenMalice(ctx);
      break;
    default:
      paintSecondaryPatron(ctx, id);
      break;
  }
}
