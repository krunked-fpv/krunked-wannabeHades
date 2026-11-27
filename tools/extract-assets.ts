/**
 * Supergiant v7 BC3/DXT5 `.pkg` & `.pkg_manifest` Local Asset Pack Extractor.
 *
 * STRICTLY READ-ONLY on Steam Hades — NEVER writes inside the Steam install folder.
 * Outputs exclusively into gitignored `.wannabehades-assets/` (`sheets/*.png` + `manifest.json`)
 * using clean-room Krunked WannabeHades sprite keys.
 *
 * ZERO external npm dependencies:
 * - Pure TypeScript raw LZ4 block decompressor
 * - Pure TypeScript BC3/DXT5 (and BC1/DXT1 + RGBA8) block decoder
 * - Pure TypeScript bilinear scaler + shelf atlas packer
 * - Pure TypeScript CRC-32 + Node `zlib.deflateSync` RGBA8 PNG encoder
 *
 * 100% CI-safe: gracefully exits with code 0 when the local Steam Hades install is absent.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  CUSTOM_PACK_SCHEMA_VERSION,
  verifyCustomPackManifest,
  type CustomPackManifest,
  type CustomPackSheetSpec,
  type CustomPackSpriteRect,
} from '../src/assets/AssetRegistry.js';

const DEFAULT_HADES_DIR = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hades';
const DEFAULT_MAX_SPRITE_DIM = 512;
const DEFAULT_SHEET_MAX_WIDTH = 2048;
const DEFAULT_SHEET_PADDING = 4;

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface ExtractorOptions {
  readonly hadesDir: string;
  readonly outDir: string;
  readonly maxSpriteDim: number;
}

function parseCliArgs(argv: readonly string[]): ExtractorOptions {
  const npmConfigHadesDir =
    process.env.npm_config_hades_dir && process.env.npm_config_hades_dir !== 'true'
      ? process.env.npm_config_hades_dir
      : undefined;
  let hadesDir = npmConfigHadesDir || process.env.HADES_INSTALL_DIR || DEFAULT_HADES_DIR;
  let hadesDirExplicit = Boolean(npmConfigHadesDir);
  let outDir = path.resolve(process.cwd(), '.wannabehades-assets');
  let maxSpriteDim = DEFAULT_MAX_SPRITE_DIM;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--hades-dir' && next) {
      hadesDir = next;
      hadesDirExplicit = true;
      i++;
    } else if (arg.startsWith('--hades-dir=')) {
      hadesDir = arg.slice('--hades-dir='.length);
      hadesDirExplicit = true;
    } else if (arg === '--out-dir' && next) {
      outDir = path.resolve(next);
      i++;
    } else if (arg.startsWith('--out-dir=')) {
      outDir = path.resolve(arg.slice('--out-dir='.length));
    } else if (arg === '--max-sprite-dim' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 64 && parsed <= 2048) {
        maxSpriteDim = Math.floor(parsed);
      }
      i++;
    } else if (!arg.startsWith('-') && !hadesDirExplicit) {
      // Handles PowerShell `npm run extract -- --hades-dir <path>` where PowerShell strips `--`
      // and npm consumes `--hades-dir` as a boolean config flag, leaving `<path>` positional.
      hadesDir = arg;
      hadesDirExplicit = true;
    }
  }

  return { hadesDir, outDir, maxSpriteDim };
}

// ============================================================================
// Pure TypeScript Raw LZ4 Block Decompressor
// ============================================================================

// Reusable 36 MiB scratch buffer (Supergiant v7 chunks max out at ~33.5 MiB)
let lz4Scratch = Buffer.allocUnsafe(36 * 1024 * 1024);

function decompressLz4Block(src: Buffer): Buffer {
  let ip = 0;
  let op = 0;
  const srcEnd = src.length;

  const ensureCapacity = (extra: number): void => {
    if (op + extra <= lz4Scratch.length) return;
    let nextCap = lz4Scratch.length * 2;
    while (nextCap < op + extra) nextCap *= 2;
    const grown = Buffer.allocUnsafe(nextCap);
    lz4Scratch.copy(grown, 0, 0, op);
    lz4Scratch = grown;
  };

  while (ip < srcEnd) {
    const token = src[ip++];
    let litLen = token >>> 4;
    if (litLen === 15) {
      let ext = 255;
      while (ip < srcEnd && ext === 255) {
        ext = src[ip++];
        litLen += ext;
      }
    }

    if (litLen > 0) {
      ensureCapacity(litLen);
      src.copy(lz4Scratch, op, ip, ip + litLen);
      ip += litLen;
      op += litLen;
    }

    if (ip >= srcEnd) break;
    if (ip + 2 > srcEnd) break;

    const offset = src[ip] | (src[ip + 1] << 8);
    ip += 2;
    if (offset === 0 || offset > op) {
      throw new Error(`Invalid LZ4 back-reference offset ${offset} at op=${op}`);
    }

    let matchLen = (token & 0x0f) + 4;
    if ((token & 0x0f) === 15) {
      let ext = 255;
      while (ip < srcEnd && ext === 255) {
        ext = src[ip++];
        matchLen += ext;
      }
    }

    ensureCapacity(matchLen);
    let matchPos = op - offset;
    if (offset >= matchLen) {
      lz4Scratch.copy(lz4Scratch, op, matchPos, matchPos + matchLen);
      op += matchLen;
    } else {
      // Overlapping RLE copy byte-by-byte
      for (let k = 0; k < matchLen; k++) {
        lz4Scratch[op++] = lz4Scratch[matchPos++];
      }
    }
  }

  return lz4Scratch.subarray(0, op);
}

// ============================================================================
// Pure TypeScript BC3/DXT5 (+ BC1/DXT1 & RGBA8) Sub-Rect Decoder
// ============================================================================

const ALPHA_LUT = new Uint8Array(8);
const COLOR_R = new Uint8Array(4);
const COLOR_G = new Uint8Array(4);
const COLOR_B = new Uint8Array(4);
const COLOR_A = new Uint8Array(4);

function decodeRgb565(c: number, slot: number): void {
  const r5 = (c >>> 11) & 0x1f;
  const g6 = (c >>> 5) & 0x3f;
  const b5 = c & 0x1f;
  COLOR_R[slot] = (r5 << 3) | (r5 >>> 2);
  COLOR_G[slot] = (g6 << 2) | (g6 >>> 4);
  COLOR_B[slot] = (b5 << 3) | (b5 >>> 2);
}

function decodeBc3RegionToRgba(
  src: Buffer,
  texW: number,
  texH: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): Uint8Array {
  const out = new Uint8Array(rw * rh * 4);
  const blocksX = Math.max(1, Math.ceil(texW / 4));
  const blocksY = Math.max(1, Math.ceil(texH / 4));

  const bxStart = Math.max(0, Math.floor(rx / 4));
  const bxEnd = Math.min(blocksX, Math.ceil((rx + rw) / 4));
  const byStart = Math.max(0, Math.floor(ry / 4));
  const byEnd = Math.min(blocksY, Math.ceil((ry + rh) / 4));

  for (let by = byStart; by < byEnd; by++) {
    const baseY = by * 4;
    for (let bx = bxStart; bx < bxEnd; bx++) {
      const baseX = bx * 4;
      const off = (by * blocksX + bx) * 16;
      if (off + 16 > src.length) continue;

      // 1. DXT5 / BC3 8-byte interpolated alpha block
      const a0 = src[off];
      const a1 = src[off + 1];
      ALPHA_LUT[0] = a0;
      ALPHA_LUT[1] = a1;
      if (a0 > a1) {
        ALPHA_LUT[2] = ((6 * a0 + 1 * a1 + 3) / 7) | 0;
        ALPHA_LUT[3] = ((5 * a0 + 2 * a1 + 3) / 7) | 0;
        ALPHA_LUT[4] = ((4 * a0 + 3 * a1 + 3) / 7) | 0;
        ALPHA_LUT[5] = ((3 * a0 + 4 * a1 + 3) / 7) | 0;
        ALPHA_LUT[6] = ((2 * a0 + 5 * a1 + 3) / 7) | 0;
        ALPHA_LUT[7] = ((1 * a0 + 6 * a1 + 3) / 7) | 0;
      } else {
        ALPHA_LUT[2] = ((4 * a0 + 1 * a1 + 2) / 5) | 0;
        ALPHA_LUT[3] = ((3 * a0 + 2 * a1 + 2) / 5) | 0;
        ALPHA_LUT[4] = ((2 * a0 + 3 * a1 + 2) / 5) | 0;
        ALPHA_LUT[5] = ((1 * a0 + 4 * a1 + 2) / 5) | 0;
        ALPHA_LUT[6] = 0;
        ALPHA_LUT[7] = 255;
      }

      // 48-bit LSB-first alpha index stream split into two 24-bit words
      const alphaLo = src[off + 2] | (src[off + 3] << 8) | (src[off + 4] << 16);
      const alphaHi = src[off + 5] | (src[off + 6] << 8) | (src[off + 7] << 16);

      // 2. BC3 8-byte RGB565 4-color interpolation block
      const c0 = src[off + 8] | (src[off + 9] << 8);
      const c1 = src[off + 10] | (src[off + 11] << 8);
      decodeRgb565(c0, 0);
      decodeRgb565(c1, 1);
      COLOR_R[2] = ((2 * COLOR_R[0] + COLOR_R[1] + 1) / 3) | 0;
      COLOR_G[2] = ((2 * COLOR_G[0] + COLOR_G[1] + 1) / 3) | 0;
      COLOR_B[2] = ((2 * COLOR_B[0] + COLOR_B[1] + 1) / 3) | 0;
      COLOR_R[3] = ((COLOR_R[0] + 2 * COLOR_R[1] + 1) / 3) | 0;
      COLOR_G[3] = ((COLOR_G[0] + 2 * COLOR_G[1] + 1) / 3) | 0;
      COLOR_B[3] = ((COLOR_B[0] + 2 * COLOR_B[1] + 1) / 3) | 0;

      const colorIndices =
        (src[off + 12] |
          (src[off + 13] << 8) |
          (src[off + 14] << 16) |
          (src[off + 15] << 24)) >>>
        0;

      for (let py = 0; py < 4; py++) {
        const wy = baseY + py;
        if (wy < ry || wy >= ry + rh) continue;
        const dstRow = (wy - ry) * rw;
        for (let px = 0; px < 4; px++) {
          const wx = baseX + px;
          if (wx < rx || wx >= rx + rw) continue;
          const idx = py * 4 + px;
          const aIdx = idx < 8 ? (alphaLo >>> (idx * 3)) & 7 : (alphaHi >>> ((idx - 8) * 3)) & 7;
          const cIdx = (colorIndices >>> (idx * 2)) & 3;
          const dst = (dstRow + (wx - rx)) * 4;
          out[dst] = COLOR_R[cIdx];
          out[dst + 1] = COLOR_G[cIdx];
          out[dst + 2] = COLOR_B[cIdx];
          out[dst + 3] = ALPHA_LUT[aIdx];
        }
      }
    }
  }

  return out;
}

function decodeBc1RegionToRgba(
  src: Buffer,
  texW: number,
  texH: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): Uint8Array {
  const out = new Uint8Array(rw * rh * 4);
  const blocksX = Math.max(1, Math.ceil(texW / 4));
  const blocksY = Math.max(1, Math.ceil(texH / 4));

  const bxStart = Math.max(0, Math.floor(rx / 4));
  const bxEnd = Math.min(blocksX, Math.ceil((rx + rw) / 4));
  const byStart = Math.max(0, Math.floor(ry / 4));
  const byEnd = Math.min(blocksY, Math.ceil((ry + rh) / 4));

  for (let by = byStart; by < byEnd; by++) {
    const baseY = by * 4;
    for (let bx = bxStart; bx < bxEnd; bx++) {
      const baseX = bx * 4;
      const off = (by * blocksX + bx) * 8;
      if (off + 8 > src.length) continue;

      const c0 = src[off] | (src[off + 1] << 8);
      const c1 = src[off + 2] | (src[off + 3] << 8);
      decodeRgb565(c0, 0);
      decodeRgb565(c1, 1);
      COLOR_A[0] = 255;
      COLOR_A[1] = 255;
      if (c0 > c1) {
        COLOR_R[2] = ((2 * COLOR_R[0] + COLOR_R[1] + 1) / 3) | 0;
        COLOR_G[2] = ((2 * COLOR_G[0] + COLOR_G[1] + 1) / 3) | 0;
        COLOR_B[2] = ((2 * COLOR_B[0] + COLOR_B[1] + 1) / 3) | 0;
        COLOR_A[2] = 255;
        COLOR_R[3] = ((COLOR_R[0] + 2 * COLOR_R[1] + 1) / 3) | 0;
        COLOR_G[3] = ((COLOR_G[0] + 2 * COLOR_G[1] + 1) / 3) | 0;
        COLOR_B[3] = ((COLOR_B[0] + 2 * COLOR_B[1] + 1) / 3) | 0;
        COLOR_A[3] = 255;
      } else {
        COLOR_R[2] = (COLOR_R[0] + COLOR_R[1]) >>> 1;
        COLOR_G[2] = (COLOR_G[0] + COLOR_G[1]) >>> 1;
        COLOR_B[2] = (COLOR_B[0] + COLOR_B[1]) >>> 1;
        COLOR_A[2] = 255;
        COLOR_R[3] = 0;
        COLOR_G[3] = 0;
        COLOR_B[3] = 0;
        COLOR_A[3] = 0;
      }

      const colorIndices =
        (src[off + 4] | (src[off + 5] << 8) | (src[off + 6] << 16) | (src[off + 7] << 24)) >>> 0;

      for (let py = 0; py < 4; py++) {
        const wy = baseY + py;
        if (wy < ry || wy >= ry + rh) continue;
        const dstRow = (wy - ry) * rw;
        for (let px = 0; px < 4; px++) {
          const wx = baseX + px;
          if (wx < rx || wx >= rx + rw) continue;
          const idx = py * 4 + px;
          const cIdx = (colorIndices >>> (idx * 2)) & 3;
          const dst = (dstRow + (wx - rx)) * 4;
          out[dst] = COLOR_R[cIdx];
          out[dst + 1] = COLOR_G[cIdx];
          out[dst + 2] = COLOR_B[cIdx];
          out[dst + 3] = COLOR_A[cIdx];
        }
      }
    }
  }

  return out;
}

function decodeRgba8Region(
  src: Buffer,
  texW: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): Uint8Array {
  const out = new Uint8Array(rw * rh * 4);
  for (let row = 0; row < rh; row++) {
    const srcOff = ((ry + row) * texW + rx) * 4;
    const dstOff = row * rw * 4;
    if (srcOff >= 0 && srcOff + rw * 4 <= src.length) {
      out.set(src.subarray(srcOff, srcOff + rw * 4), dstOff);
    }
  }
  return out;
}

function decodeXnbRegionToRgba(
  surfaceFormat: number,
  pixelData: Buffer,
  texW: number,
  texH: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): Uint8Array {
  if (surfaceFormat === 6) {
    return decodeBc3RegionToRgba(pixelData, texW, texH, rx, ry, rw, rh);
  }
  if (surfaceFormat === 4) {
    return decodeBc1RegionToRgba(pixelData, texW, texH, rx, ry, rw, rh);
  }
  if (surfaceFormat === 0) {
    return decodeRgba8Region(pixelData, texW, rx, ry, rw, rh);
  }
  throw new Error(`Unsupported XNB surfaceFormat=${surfaceFormat}`);
}

// ============================================================================
// Pure TypeScript Premultiplied-Safe Bilinear Downscaler
// ============================================================================

interface DecodedSpriteImage {
  readonly cleanKey: string;
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
  readonly anchorX?: number;
  readonly anchorY?: number;
}

function downscaleRgbaBilinear(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH * 4);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const sy = (y + 0.5) * scaleY - 0.5;
    const y0 = Math.max(0, Math.min(srcH - 1, Math.floor(sy)));
    const y1 = Math.max(0, Math.min(srcH - 1, y0 + 1));
    const fy = Math.max(0, Math.min(1, sy - y0));

    for (let x = 0; x < dstW; x++) {
      const sx = (x + 0.5) * scaleX - 0.5;
      const x0 = Math.max(0, Math.min(srcW - 1, Math.floor(sx)));
      const x1 = Math.max(0, Math.min(srcW - 1, x0 + 1));
      const fx = Math.max(0, Math.min(1, sx - x0));

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      const a = src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11;
      const dstOff = (y * dstW + x) * 4;

      if (a <= 0.5) {
        dst[dstOff] = 0;
        dst[dstOff + 1] = 0;
        dst[dstOff + 2] = 0;
        dst[dstOff + 3] = 0;
      } else {
        const wa00 = w00 * src[i00 + 3];
        const wa10 = w10 * src[i10 + 3];
        const wa01 = w01 * src[i01 + 3];
        const wa11 = w11 * src[i11 + 3];
        const invA = 1 / (wa00 + wa10 + wa01 + wa11);

        dst[dstOff] = Math.round(
          (src[i00] * wa00 + src[i10] * wa10 + src[i01] * wa01 + src[i11] * wa11) * invA
        );
        dst[dstOff + 1] = Math.round(
          (src[i00 + 1] * wa00 + src[i10 + 1] * wa10 + src[i01 + 1] * wa01 + src[i11 + 1] * wa11) *
            invA
        );
        dst[dstOff + 2] = Math.round(
          (src[i00 + 2] * wa00 + src[i10 + 2] * wa10 + src[i01 + 2] * wa01 + src[i11 + 2] * wa11) *
            invA
        );
        dst[dstOff + 3] = Math.round(Math.min(255, a));
      }
    }
  }
  return dst;
}

// ============================================================================
// Pure TypeScript RGBA8 PNG Writer (CRC-32 + Node `zlib.deflateSync`)
// ============================================================================

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.allocUnsafe(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + data.length));
  chunk.writeUInt32BE(crc, 8 + data.length);
  return chunk;
}

function encodePngRgba(rgba: Uint8Array, width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // deflate compression
  ihdr[11] = 0; // standard filter method
  ihdr[12] = 0; // non-interlaced

  const rowBytes = width * 4;
  const rawScanlines = Buffer.allocUnsafe(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    const dstRow = y * (rowBytes + 1);
    rawScanlines[dstRow] = 0; // Filter None
    const srcRow = y * rowBytes;
    rawScanlines.set(rgba.subarray(srcRow, srcRow + rowBytes), dstRow + 1);
  }

  const compressed = zlib.deflateSync(rawScanlines, { level: 3 });

  return Buffer.concat([
    sig,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ============================================================================
// Pure TypeScript Shelf Atlas Packer
// ============================================================================

interface PackedSheetResult {
  readonly spec: CustomPackSheetSpec;
  readonly png: Buffer;
  readonly rects: Record<string, CustomPackSpriteRect>;
}

function packSpritesIntoSheet(
  sheetId: string,
  sprites: readonly DecodedSpriteImage[],
  maxWidth = DEFAULT_SHEET_MAX_WIDTH,
  padding = DEFAULT_SHEET_PADDING
): PackedSheetResult {
  // Sort tallest first for tight shelf packing
  const sorted = [...sprites].sort((a, b) => b.height - a.height || b.width - a.width);

  interface Placement {
    sprite: DecodedSpriteImage;
    x: number;
    y: number;
  }

  const placements: Placement[] = [];
  let cursorX = padding;
  let cursorY = padding;
  let shelfH = 0;
  let usedW = padding;

  for (const sprite of sorted) {
    if (cursorX > padding && cursorX + sprite.width + padding > maxWidth) {
      cursorX = padding;
      cursorY += shelfH + padding;
      shelfH = 0;
    }
    placements.push({ sprite, x: cursorX, y: cursorY });
    cursorX += sprite.width + padding;
    if (cursorX > usedW) usedW = cursorX;
    if (sprite.height > shelfH) shelfH = sprite.height;
  }

  const width = Math.max(16, Math.min(maxWidth, Math.ceil(usedW / 4) * 4));
  const height = Math.max(16, Math.ceil((cursorY + shelfH + padding) / 4) * 4);
  const rgba = new Uint8Array(width * height * 4);
  const rects: Record<string, CustomPackSpriteRect> = {};

  for (const { sprite, x, y } of placements) {
    for (let row = 0; row < sprite.height; row++) {
      const srcOff = row * sprite.width * 4;
      const dstOff = ((y + row) * width + x) * 4;
      rgba.set(sprite.rgba.subarray(srcOff, srcOff + sprite.width * 4), dstOff);
    }
    rects[sprite.cleanKey] = {
      sheet: sheetId,
      x,
      y,
      w: sprite.width,
      h: sprite.height,
      ...(sprite.anchorX !== undefined ? { anchorX: sprite.anchorX } : {}),
      ...(sprite.anchorY !== undefined ? { anchorY: sprite.anchorY } : {}),
    };
  }

  const file = `sheets/${sheetId}.png`;
  return {
    spec: { id: sheetId, file, width, height },
    png: encodePngRgba(rgba, width, height),
    rects,
  };
}

// ============================================================================
// Supergiant v7 `.pkg_manifest` & `.pkg` Reader
// ============================================================================

interface SubAtlasEntry {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface ManifestAtlasGroup {
  readonly texPath: string;
  readonly texBasename: string;
  readonly sprites: readonly SubAtlasEntry[];
}

function parsePkgManifest(manPath: string): ManifestAtlasGroup[] {
  const buf = fs.readFileSync(manPath);
  const version = buf.readUInt32BE(0) & 0x00ffffff;
  if (version !== 7) {
    throw new Error(`Unsupported .pkg_manifest version ${version} in ${path.basename(manPath)}`);
  }

  let p = 4;
  const groups: ManifestAtlasGroup[] = [];
  let pendingSprites: SubAtlasEntry[] = [];

  while (p < buf.length) {
    const tag = buf[p++];
    if (tag === 0xff) break;

    if (tag === 0xde) {
      const blockLen = buf.readUInt32BE(p);
      p += 4;
      const blockEnd = p + blockLen;
      const magic = buf.readUInt32BE(p);
      p += 4;
      if (magic !== 0x7fb1776b) {
        throw new Error(`Unexpected sub-atlas magic 0x${magic.toString(16)} in ${path.basename(manPath)}`);
      }
      p += 4; // subVer (4)
      const count = buf.readUInt32BE(p);
      p += 4;

      const sprites: SubAtlasEntry[] = [];
      for (let i = 0; i < count && p < blockEnd; i++) {
        const slen = buf[p++];
        const name = buf.subarray(p, p + slen).toString('ascii');
        p += slen;
        const x = buf.readInt32BE(p);
        const y = buf.readInt32BE(p + 4);
        const w = buf.readInt32BE(p + 8);
        const h = buf.readInt32BE(p + 12);
        p += 16 + 8 + 8 + 8 + 1; // rect + topLeft + origSize + scaleRatio + isMulti
        const hullCount = buf.readInt32BE(p);
        p += 4 + hullCount * 8;
        if (w > 0 && h > 0) {
          sprites.push({ name, x, y, w, h });
        }
      }
      p = blockEnd;
      pendingSprites = sprites;
    } else if (tag === 0xdd) {
      const slen = buf[p++];
      const texPath = buf.subarray(p, p + slen).toString('ascii');
      p += slen;
      const texBasename = path.win32.basename(texPath);
      groups.push({ texPath, texBasename, sprites: pendingSprites });
      pendingSprites = [];
    } else {
      break;
    }
  }

  return groups;
}

interface SpriteExtractionRequest {
  readonly cleanKey: string;
  readonly targetSheet: string;
  readonly nameMatcher: RegExp;
  readonly maxDim?: number;
  readonly anchorX?: number;
  readonly anchorY?: number;
}

interface PackageExtractionPlan {
  readonly pkgName: string;
  readonly requests: readonly SpriteExtractionRequest[];
}

/**
 * Curated representative extraction plan spanning ALL biomes, weapons, patron upgrades,
 * patron sigils, pickups, and character portraits while keeping total runtime fast (~2-4s).
 */
const EXTRACTION_PLANS: readonly PackageExtractionPlan[] = [
  {
    pkgName: 'DeathArea',
    requests: [
      { cleanKey: 'tile_sanctum_a', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\House\\House_TerrainTile_01$/i },
      { cleanKey: 'tile_sanctum_b', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\House\\House_TerrainTile_04$/i },
      { cleanKey: 'tile_sanctum_mosaic', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\House\\House_TerrainTile_03$/i },
      { cleanKey: 'prop_pillar_sanctum', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\House\\House_Pillar_04$/i, anchorX: 0.5, anchorY: 0.86 },
      { cleanKey: 'prop_urn', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\House\\House_UrnDarkness_01$/i, anchorX: 0.5, anchorY: 0.84 },
    ],
  },
  {
    pkgName: 'Tartarus',
    requests: [
      { cleanKey: 'tile_obsidian_a', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\Tartarus\\Tartarus_BlankIsoTile_01$/i },
      { cleanKey: 'tile_obsidian_b', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\Tartarus\\Tartarus_Terrain_BrickSquare_01$/i },
      { cleanKey: 'tile_obsidian_cracked', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\Tartarus\\Tartarus_Terrain_Brick_07$/i },
      { cleanKey: 'tile_obsidian_mosaic', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\Tartarus\\Tartarus_Terrain_BrickSquare_09$/i },
      { cleanKey: 'prop_pillar_obsidian', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\Tartarus\\Tartarus_PillarDecorative_01$/i, anchorX: 0.5, anchorY: 0.86 },
      { cleanKey: 'prop_brazier', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\Tartarus\\Tartarus_Brazier_03$/i, anchorX: 0.5, anchorY: 0.82 },
      { cleanKey: 'prop_statue', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\Tartarus\\Tartarus_Statue_Cyclops_01$/i, anchorX: 0.5, anchorY: 0.86 },
      { cleanKey: 'prop_exit_door_locked', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\Tartarus\\Tartarus_Door_03$/i, anchorX: 0.5, anchorY: 0.85 },
      { cleanKey: 'prop_exit_door_open', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\Tartarus\\Tartarus_Door_03$/i, anchorX: 0.5, anchorY: 0.85 },
      { cleanKey: 'prop_spike_idle', targetSheet: 'biomes_props', nameMatcher: /tilesets\\tartarus\\tartarus_traptile_01$/i },
    ],
  },
  {
    pkgName: 'Asphodel',
    requests: [
      { cleanKey: 'tile_cinder_a', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\Asphodel\\Asphodel_IntroTile_01$/i },
      { cleanKey: 'prop_cinder_pillar', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\Asphodel\\Asphodel_Pillar_05$/i, anchorX: 0.5, anchorY: 0.86 },
    ],
  },
  {
    pkgName: 'Elysium',
    requests: [
      { cleanKey: 'tile_verdant_a', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\Elysium\\Elysium_Terrain_Moss_Tile_01b$/i },
      { cleanKey: 'prop_verdant_statue', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\Elysium\\Elysium_Statue_05$/i, anchorX: 0.5, anchorY: 0.86 },
    ],
  },
  {
    pkgName: 'Styx',
    requests: [
      { cleanKey: 'tile_crypt_a', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\Travel\\Travel_CharonTerrain_Tile_01$/i },
      { cleanKey: 'prop_crypt_door', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\Styx\\Styx_Door_01a$/i, anchorX: 0.5, anchorY: 0.85 },
    ],
  },
  {
    pkgName: 'Surface',
    requests: [
      { cleanKey: 'tile_summit_a', targetSheet: 'biomes_tiles', nameMatcher: /Tilesets\\Surface\\Surface_BaseTile_01$/i },
      { cleanKey: 'prop_summit_pillar', targetSheet: 'biomes_props', nameMatcher: /Tilesets\\Surface\\Surface_Pillar_03$/i, anchorX: 0.5, anchorY: 0.86 },
    ],
  },
  {
    pkgName: 'SwordWeapon',
    requests: [
      { cleanKey: 'vfx_spark_burst', targetSheet: 'combat_fx', nameMatcher: /Fx\\AthenaProtectionFrontOut\\AthenaProtectionFrontOut0003$/i },
      { cleanKey: 'vfx_decal_crack', targetSheet: 'combat_fx', nameMatcher: /Tilesets\\Tartarus\\Tartarus_Rubble_02$/i },
    ],
  },
  {
    pkgName: 'ZeusUpgrade',
    requests: [
      { cleanKey: 'vfx_lightning_bolt', targetSheet: 'combat_fx', nameMatcher: /Fx\\ZeusLightningStrikeGroundNova\\ZeusLightningStrikeGroundNova0001$/i },
      { cleanKey: 'vfx_glow_star', targetSheet: 'combat_fx', nameMatcher: /Fx\\BoonDissipateA\\BoonDissipateA0007$/i },
    ],
  },
  {
    pkgName: 'AthenaUpgrade',
    requests: [
      { cleanKey: 'vfx_glow_soft', targetSheet: 'combat_fx', nameMatcher: /Fx\\AthenaProjectileImpact\\AthenaProjectileImpact0005$/i },
      { cleanKey: 'vfx_ring_soft', targetSheet: 'combat_fx', nameMatcher: /Fx\\SwordSwipeA-Athena\\SwordSwipeA-Athena0005$/i },
    ],
  },
  {
    pkgName: 'PoseidonUpgrade',
    requests: [
      { cleanKey: 'vfx_wave_crest', targetSheet: 'combat_fx', nameMatcher: /Fx\\PoseidonProjectileImpactPiece\\PoseidonProjectileImpactPiece0009$/i },
    ],
  },
  {
    pkgName: 'AphroditeUpgrade',
    requests: [
      { cleanKey: 'vfx_flame_tongue', targetSheet: 'combat_fx', nameMatcher: /Fx\\.*Aphrodite.*000[1-5]$/i },
    ],
  },
  {
    pkgName: 'GUI',
    requests: [
      // All 10 Patron Sigils
      { cleanKey: 'sigil_voltaris', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Zeus$/i },
      { cleanKey: 'sigil_tidebreaker', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Poseidon$/i },
      { cleanKey: 'sigil_aegira', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Athena$/i },
      { cleanKey: 'sigil_velouris', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Aphrodite$/i },
      { cleanKey: 'sigil_sylvara', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Artemis$/i },
      { cleanKey: 'sigil_bellum', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Ares$/i },
      { cleanKey: 'sigil_bacchion', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Dionysus$/i },
      { cleanKey: 'sigil_glaciera', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Demeter$/i },
      { cleanKey: 'sigil_veloce', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Hermes$/i },
      { cleanKey: 'sigil_abyssos', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Chaos$/i },
      // Pickups & Currency Icons
      { cleanKey: 'vfx_boon_orb', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\Boon$/i },
      { cleanKey: 'vfx_centaur_heart', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Health_01$/i },
      { cleanKey: 'vfx_gold_coin', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\Currency$/i },
      { cleanKey: 'vfx_darkness_orb', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Darkness$/i },
      { cleanKey: 'vfx_pom_icon', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\Pom_Small$/i },
      { cleanKey: 'vfx_hammer_icon', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Hammer_01$/i },
      { cleanKey: 'vfx_shop_purse', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\RoomReward\\Shop$/i },
      { cleanKey: 'vfx_gemstone', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\Gems$/i },
      { cleanKey: 'vfx_key', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\LockKey$/i },
      { cleanKey: 'vfx_nectar', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Icons\\Gift$/i },
      // All 6 Infernal Arms Weapon Icons
      { cleanKey: 'weapon_stygian_blade', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Screens\\WeaponIcons\\sword_sudden_slash_01$/i },
      { cleanKey: 'weapon_eternal_spear', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Screens\\WeaponIcons\\spear_dash_multistrike_10$/i },
      { cleanKey: 'weapon_shield_of_chaos', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Screens\\WeaponIcons\\shield_divine_immunity_02$/i },
      { cleanKey: 'weapon_heart_seeking_bow', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Screens\\WeaponIcons\\bow_perfect_shot_06$/i },
      { cleanKey: 'weapon_twin_fists', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Screens\\WeaponIcons\\fist_reaching_punch_08$/i },
      { cleanKey: 'weapon_adamant_rail', targetSheet: 'ui_sigils_weapons', nameMatcher: /GUI\\Screens\\WeaponIcons\\gun_consecutive_fire_trait_11$/i },
      // All 10 Patron Portraits
      { cleanKey: 'portrait_voltaris', targetSheet: 'portraits_patrons', nameMatcher: /Portraits\\Portraits_Zeus_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_tidebreaker', targetSheet: 'portraits_patrons', nameMatcher: /Portraits\\Portraits_Poseidon_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_aegira', targetSheet: 'portraits_patrons', nameMatcher: /Portraits\\Portraits_Athena_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_velouris', targetSheet: 'portraits_patrons', nameMatcher: /Portraits\\Portraits_Aphrodite_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_sylvara', targetSheet: 'portraits_patrons', nameMatcher: /Portraits\\Portraits_Artemis_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_bellum', targetSheet: 'portraits_patrons', nameMatcher: /Portraits\\Portraits_Ares_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_bacchion', targetSheet: 'portraits_patrons', nameMatcher: /Portraits\\Portraits_Dionysus_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_glaciera', targetSheet: 'portraits_patrons', nameMatcher: /Portraits\\Portraits_Demeter_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_veloce', targetSheet: 'portraits_patrons', nameMatcher: /Portraits\\Portraits_Hermes_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_abyssos', targetSheet: 'portraits_patrons', nameMatcher: /Portraits\\Portraits_Chaos_01$/i, maxDim: 480 },
      // Hero & Boss Portraits
      { cleanKey: 'portrait_prince_pyreus', targetSheet: 'portraits_characters', nameMatcher: /Portraits\\Portraits_Zagreus_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_warden_malice', targetSheet: 'portraits_characters', nameMatcher: /Portraits\\Portraits_Megaera_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_warden_fury', targetSheet: 'portraits_characters', nameMatcher: /Portraits\\Portraits_Alecto_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_warden_murder', targetSheet: 'portraits_characters', nameMatcher: /Portraits\\Portraits_Tisiphone_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_colosseum_bull', targetSheet: 'portraits_characters', nameMatcher: /Portraits\\Portraits_Minotaur_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_colosseum_spearlord', targetSheet: 'portraits_characters', nameMatcher: /Portraits\\Portraits_Theseus_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_the_ferryman', targetSheet: 'portraits_characters', nameMatcher: /Portraits\\Portraits_Charon_01$/i, maxDim: 480 },
      { cleanKey: 'portrait_sovereign_lord', targetSheet: 'portraits_characters', nameMatcher: /Portraits\\Portraits_Hades_01$/i, maxDim: 480 },
    ],
  },
];

interface ResolvedPkgTarget {
  readonly req: SpriteExtractionRequest;
  readonly sub: SubAtlasEntry;
}

function extractFromPackage(
  bc3Dir: string,
  plan: PackageExtractionPlan,
  maxSpriteDim: number,
  sheetBuckets: Map<string, DecodedSpriteImage[]>
): { decodedCount: number; texturesTouched: number } {
  const pkgPath = path.join(bc3Dir, `${plan.pkgName}.pkg`);
  const manPath = path.join(bc3Dir, `${plan.pkgName}.pkg_manifest`);
  if (!fs.existsSync(pkgPath) || !fs.existsSync(manPath)) {
    return { decodedCount: 0, texturesTouched: 0 };
  }

  // 1. Parse .pkg_manifest to map each requested cleanKey -> exact (texPath, subAtlasRect)
  const manifestGroups = parsePkgManifest(manPath);
  const targetsByTex = new Map<string, ResolvedPkgTarget[]>();

  for (const req of plan.requests) {
    let foundTex: string | null = null;
    let foundSub: SubAtlasEntry | null = null;
    for (const group of manifestGroups) {
      for (const sub of group.sprites) {
        if (req.nameMatcher.test(sub.name)) {
          foundTex = group.texPath;
          foundSub = sub;
          break;
        }
      }
      if (foundSub) break;
    }
    if (foundTex && foundSub) {
      const list = targetsByTex.get(foundTex) ?? [];
      list.push({ req, sub: foundSub });
      targetsByTex.set(foundTex, list);
    }
  }

  if (targetsByTex.size === 0) {
    return { decodedCount: 0, texturesTouched: 0 };
  }

  // 2. Stream .pkg chunk-by-chunk strictly read-only, stopping early once all targets are decoded
  const fd = fs.openSync(pkgPath, 'r');
  let decodedCount = 0;
  let texturesTouched = 0;

  try {
    const stat = fs.fstatSync(fd);
    const hdrBuf = Buffer.alloc(4);
    fs.readSync(fd, hdrBuf, 0, 4, 0);
    const pkgFlags = hdrBuf[0];
    const pkgVer = hdrBuf.readUInt32BE(0) & 0x00ffffff;
    if (pkgVer !== 7) {
      throw new Error(`Unsupported .pkg version ${pkgVer} in ${plan.pkgName}.pkg`);
    }

    const isChunked = (pkgFlags & 0x20) !== 0;
    let cursor = 4;
    const chunkHdr = Buffer.alloc(5);
    const remainingTex = new Set<string>(targetsByTex.keys());

    const processDecompressedStream = (stream: Buffer): void => {
      let sp = 0;
      while (sp < stream.length && remainingTex.size > 0) {
        const tag = stream[sp++];
        if (tag === 0xff || tag === 0xbe) {
          break;
        }
        if (tag === 0xad) {
          const pathLen = stream[sp++];
          const assetPath = stream.subarray(sp, sp + pathLen).toString('ascii');
          sp += pathLen;
          const payloadLen = stream.readUInt32BE(sp);
          sp += 4;
          const xnbStart = sp;
          sp += payloadLen;

          const targets = targetsByTex.get(assetPath);
          if (!targets || !remainingTex.has(assetPath)) {
            continue;
          }
          remainingTex.delete(assetPath);

          const magic = stream.subarray(xnbStart, xnbStart + 4).toString('ascii');
          const xnbVer = stream[xnbStart + 4];
          if (magic !== 'XNBw' || xnbVer !== 6) {
            continue;
          }

          const surfaceFormat = stream.readUInt32LE(xnbStart + 10);
          const texW = stream.readUInt32LE(xnbStart + 14);
          const texH = stream.readUInt32LE(xnbStart + 18);
          const imageDataBytes = stream.readUInt32LE(xnbStart + 26);
          const pixelData = stream.subarray(xnbStart + 30, xnbStart + 30 + imageDataBytes);
          texturesTouched++;

          for (const { req, sub } of targets) {
            const rx = Math.max(0, Math.min(texW - 1, sub.x));
            const ry = Math.max(0, Math.min(texH - 1, sub.y));
            const rw = Math.max(1, Math.min(texW - rx, sub.w));
            const rh = Math.max(1, Math.min(texH - ry, sub.h));

            let rgba = decodeXnbRegionToRgba(surfaceFormat, pixelData, texW, texH, rx, ry, rw, rh);
            let outW = rw;
            let outH = rh;

            const cap = req.maxDim ?? maxSpriteDim;
            if (outW > cap || outH > cap) {
              const scale = cap / Math.max(outW, outH);
              const nextW = Math.max(1, Math.round(outW * scale));
              const nextH = Math.max(1, Math.round(outH * scale));
              rgba = downscaleRgbaBilinear(rgba, outW, outH, nextW, nextH);
              outW = nextW;
              outH = nextH;
            }

            const bucket = sheetBuckets.get(req.targetSheet) ?? [];
            bucket.push({
              cleanKey: req.cleanKey,
              width: outW,
              height: outH,
              rgba,
              anchorX: req.anchorX,
              anchorY: req.anchorY,
            });
            sheetBuckets.set(req.targetSheet, bucket);
            decodedCount++;
          }
        } else if (tag === 0xde) {
          const blen = stream.readUInt32BE(sp);
          sp += 4 + blen;
        } else if (tag === 0xdd) {
          const plen = stream[sp++];
          sp += plen;
        } else {
          break;
        }
      }
    };

    if (isChunked) {
      while (cursor + 5 <= stat.size && remainingTex.size > 0) {
        fs.readSync(fd, chunkHdr, 0, 5, cursor);
        const compressedFlag = chunkHdr[0];
        const compressedLen = chunkHdr.readUInt32BE(1);
        cursor += 5;
        if (compressedLen === 0 || cursor + compressedLen > stat.size) break;

        const chunkBuf = Buffer.allocUnsafe(compressedLen);
        fs.readSync(fd, chunkBuf, 0, compressedLen, cursor);
        cursor += compressedLen;

        const raw = compressedFlag === 1 ? decompressLz4Block(chunkBuf) : chunkBuf;
        processDecompressedStream(raw);
      }
    } else {
      const bodyLen = stat.size - 4;
      const bodyBuf = Buffer.allocUnsafe(bodyLen);
      fs.readSync(fd, bodyBuf, 0, bodyLen, 4);
      processDecompressedStream(bodyBuf);
    }
  } finally {
    fs.closeSync(fd);
  }

  return { decodedCount, texturesTouched };
}

// ============================================================================
// Main CLI Entrypoint
// ============================================================================

function main(): void {
  const startMs = Date.now();
  const opts = parseCliArgs(process.argv.slice(2));
  const bc3Dir = path.join(opts.hadesDir, 'Content', 'Win', 'Packages', 'BC3');

  if (!fs.existsSync(opts.hadesDir) || !fs.existsSync(bc3Dir)) {
    console.log(
      `[extract-assets] Local retail Hades BC3 packages not found at "${bc3Dir}". Skipping optional custom pack extraction (CI-safe exit 0).`
    );
    process.exit(0);
  }

  console.log(`[extract-assets] Reading Supergiant BC3 packages strictly read-only from: ${bc3Dir}`);
  console.log(`[extract-assets] Writing gitignored custom pack to: ${opts.outDir}`);

  const sheetBuckets = new Map<string, DecodedSpriteImage[]>();
  let totalDecoded = 0;
  let totalTextures = 0;

  for (const plan of EXTRACTION_PLANS) {
    const res = extractFromPackage(bc3Dir, plan, opts.maxSpriteDim, sheetBuckets);
    totalDecoded += res.decodedCount;
    totalTextures += res.texturesTouched;
  }

  if (totalDecoded === 0) {
    console.log(
      '[extract-assets] No matching BC3 sprites found in source directory. Skipping write (exit 0).'
    );
    process.exit(0);
  }

  const sheetsOutDir = path.join(opts.outDir, 'sheets');
  fs.mkdirSync(sheetsOutDir, { recursive: true });

  const sheetSpecs: CustomPackSheetSpec[] = [];
  const allSprites: Record<string, CustomPackSpriteRect> = {};
  let totalPngBytes = 0;

  for (const [sheetId, sprites] of sheetBuckets.entries()) {
    if (sprites.length === 0) continue;
    const packed = packSpritesIntoSheet(sheetId, sprites);
    const pngPath = path.join(opts.outDir, packed.spec.file);
    fs.writeFileSync(pngPath, packed.png);
    totalPngBytes += packed.png.length;
    sheetSpecs.push(packed.spec);
    Object.assign(allSprites, packed.rects);
    console.log(
      `  -> ${packed.spec.file} (${packed.spec.width}x${packed.spec.height}, ${sprites.length} sprites, ${(packed.png.length / 1024).toFixed(1)} KiB)`
    );
  }

  const manifest: CustomPackManifest = {
    schemaVersion: CUSTOM_PACK_SCHEMA_VERSION,
    source: 'retail-hades',
    generatedAt: new Date().toISOString(),
    sheets: sheetSpecs,
    sprites: allSprites,
  };

  const verification = verifyCustomPackManifest(manifest);
  if (!verification.valid) {
    throw new Error(`Generated manifest failed validation: ${verification.errors.join('; ')}`);
  }

  const manifestPath = path.join(opts.outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(2);
  console.log(
    `[extract-assets] Done in ${elapsedSec}s: ${sheetSpecs.length} PNG sheets (${(totalPngBytes / (1024 * 1024)).toFixed(2)} MiB), ${totalDecoded} sprites from ${totalTextures} BC3 textures (${verification.matchedCleanKeys.length} canonical clean-room keys matched).`
  );
}

main();
