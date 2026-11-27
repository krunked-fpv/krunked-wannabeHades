/**
 * CustomPackLoader — Browser-Safe Dual-Mode Custom Art Pack Loader.
 *
 * Supports two seamless loading paths with zero external dependencies:
 * 1. Local Dev / Preview Auto-Detect (`detectLocalDevPack()`): quietly probes
 *    `/.wannabehades-assets/manifest.json` served by `vitePackMiddleware` (returns `null`
 *    quietly on 404 so GitHub Pages & clean clones never log errors).
 * 2. Browser Folder Picker (`promptLoadCustomPackFolder()`): opens `showDirectoryPicker`
 *    with hidden `<input type="file" webkitdirectory>` fallback, validates `manifest.json`
 *    and PNG sheets, persists blobs in IndexedDB (`krunked_wannabehades_custom_pack_v1`),
 *    and restores across reloads via `loadCachedCustomPackFromIndexedDB()`.
 */

import {
  verifyCustomPackManifest,
  type CustomPackHandle,
  type CustomPackManifest,
  type CustomPackOrigin,
  type CustomPackSheetSpec,
} from './AssetRegistry.js';

export type { CustomPackHandle, CustomPackManifest, CustomPackOrigin, CustomPackSheetSpec };

export const CUSTOM_PACK_DB_NAME = 'krunked_wannabehades_custom_pack_v1';
const CUSTOM_PACK_DB_VERSION = 1;
const CUSTOM_PACK_STORE_NAME = 'packs';
const CUSTOM_PACK_ACTIVE_KEY = 'active';
export const LOCAL_DEV_PACK_BASE_URL = '/.wannabehades-assets';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export interface LoadedCustomPack extends CustomPackHandle {
  readonly origin: CustomPackOrigin;
  readonly sheetCount: number;
  readonly spriteCount: number;
  readonly loadedAt: string;
  dispose(): void;
}

export interface CustomPackLoadResult {
  readonly ok: boolean;
  readonly spriteCount: number;
  readonly sheetCount: number;
  readonly pack?: LoadedCustomPack;
  readonly error?: string;
}

interface StoredPackRecord {
  readonly manifest: CustomPackManifest;
  readonly sheetBlobs: Record<string, Blob>;
  readonly savedAt: string;
}

// Minimal File System Access API typings (zero extra @types packages needed)
interface FsFileHandleLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
}

interface FsDirectoryHandleLike {
  readonly kind: 'directory';
  readonly name: string;
  values(): AsyncIterable<FsFileHandleLike | FsDirectoryHandleLike>;
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FsDirectoryHandleLike>;
}

function normalizeRelPath(raw: string): string {
  return raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

async function hasPngSignature(blob: Blob): Promise<boolean> {
  if (blob.size < PNG_MAGIC.length) {
    return false;
  }
  const headerBuf = await blob.slice(0, PNG_MAGIC.length).arrayBuffer();
  const bytes = new Uint8Array(headerBuf);
  for (let i = 0; i < PNG_MAGIC.length; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) {
      return false;
    }
  }
  return true;
}

async function decodeBlobToImage(blob: Blob): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode PNG sheet image.'));
      img.src = objectUrl;
    });
    if (typeof img.decode === 'function') {
      try {
        await img.decode();
      } catch {
        // onload already succeeded; decode() rejection on some browsers is non-fatal
      }
    }
    return { image: img, objectUrl };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

async function materializePackFromBlobs(
  manifest: CustomPackManifest,
  blobsBySheetId: Map<string, Blob>,
  origin: CustomPackOrigin
): Promise<LoadedCustomPack> {
  const sheets = new Map<string, CanvasImageSource>();
  const objectUrls: string[] = [];

  try {
    for (const spec of manifest.sheets) {
      const blob = blobsBySheetId.get(spec.id);
      if (!blob) {
        continue;
      }
      const { image, objectUrl } = await decodeBlobToImage(blob);
      objectUrls.push(objectUrl);
      sheets.set(spec.id, image);
    }
  } catch (err) {
    for (const url of objectUrls) {
      URL.revokeObjectURL(url);
    }
    throw err;
  }

  let disposed = false;
  return {
    manifest,
    origin,
    sheets,
    sheetCount: sheets.size,
    spriteCount: Object.keys(manifest.sprites).length,
    loadedAt: new Date().toISOString(),
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const url of objectUrls) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // Ignore revoke errors
        }
      }
      objectUrls.length = 0;
    },
  };
}

// ============================================================================
// IndexedDB Persistence (`krunked_wannabehades_custom_pack_v1`)
// ============================================================================

function openPackDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(CUSTOM_PACK_DB_NAME, CUSTOM_PACK_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CUSTOM_PACK_STORE_NAME)) {
          db.createObjectStore(CUSTOM_PACK_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function savePackToIndexedDB(
  manifest: CustomPackManifest,
  blobsBySheetId: Map<string, Blob>
): Promise<boolean> {
  const db = await openPackDatabase();
  if (!db) {
    return false;
  }
  const sheetBlobs: Record<string, Blob> = {};
  for (const [id, blob] of blobsBySheetId.entries()) {
    sheetBlobs[id] = blob;
  }
  const record: StoredPackRecord = {
    manifest,
    sheetBlobs,
    savedAt: new Date().toISOString(),
  };

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(CUSTOM_PACK_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CUSTOM_PACK_STORE_NAME);
      store.put(record, CUSTOM_PACK_ACTIVE_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

/**
 * Loads a previously imported custom art pack from browser IndexedDB.
 * Returns `null` cleanly if none is stored or IndexedDB is unavailable.
 */
export async function loadCachedCustomPackFromIndexedDB(): Promise<LoadedCustomPack | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return null;
  }
  const db = await openPackDatabase();
  if (!db) {
    return null;
  }

  const record = await new Promise<StoredPackRecord | null>((resolve) => {
    try {
      const tx = db.transaction(CUSTOM_PACK_STORE_NAME, 'readonly');
      const store = tx.objectStore(CUSTOM_PACK_STORE_NAME);
      const req = store.get(CUSTOM_PACK_ACTIVE_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as StoredPackRecord | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });

  if (!record || !record.manifest || !record.sheetBlobs) {
    return null;
  }

  const check = verifyCustomPackManifest(record.manifest);
  if (!check.valid) {
    return null;
  }

  const blobsBySheetId = new Map<string, Blob>();
  for (const spec of record.manifest.sheets) {
    const blob = record.sheetBlobs[spec.id];
    if (blob instanceof Blob) {
      blobsBySheetId.set(spec.id, blob);
    }
  }
  if (blobsBySheetId.size === 0) {
    return null;
  }

  try {
    return await materializePackFromBlobs(record.manifest, blobsBySheetId, 'indexeddb');
  } catch {
    return null;
  }
}

/**
 * Clears any cached custom art pack from IndexedDB. Never throws.
 */
export async function clearCachedCustomPack(): Promise<void> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return;
  }
  const db = await openPackDatabase();
  if (!db) {
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(CUSTOM_PACK_STORE_NAME, 'readwrite');
      tx.objectStore(CUSTOM_PACK_STORE_NAME).delete(CUSTOM_PACK_ACTIVE_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

// ============================================================================
// Local Dev / Preview Auto-Detection (`/.wannabehades-assets/manifest.json`)
// ============================================================================

/**
 * Quietly checks `/.wannabehades-assets/manifest.json` served by `vitePackMiddleware`.
 * Returns `null` cleanly (no console noise) when absent (e.g. GitHub Pages or clean clone).
 */
export async function detectLocalDevPack(
  baseUrl = LOCAL_DEV_PACK_BASE_URL
): Promise<LoadedCustomPack | null> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return null;
  }
  const cleanBase = baseUrl.replace(/\/+$/, '');

  let manifestRaw: unknown;
  try {
    const res = await fetch(`${cleanBase}/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) {
      return null;
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType && !contentType.includes('json') && !contentType.includes('text/plain')) {
      return null;
    }
    manifestRaw = await res.json();
  } catch {
    return null;
  }

  const check = verifyCustomPackManifest(manifestRaw);
  if (!check.valid) {
    return null;
  }
  const manifest = manifestRaw as CustomPackManifest;

  const blobsBySheetId = new Map<string, Blob>();
  await Promise.all(
    manifest.sheets.map(async (spec) => {
      const rel = normalizeRelPath(spec.file);
      try {
        const res = await fetch(`${cleanBase}/${rel}`, { cache: 'no-cache' });
        if (!res.ok) return;
        const blob = await res.blob();
        if (await hasPngSignature(blob)) {
          blobsBySheetId.set(spec.id, blob);
        }
      } catch {
        // Skip missing or unreadable sheet silently
      }
    })
  );

  if (blobsBySheetId.size === 0) {
    return null;
  }

  try {
    return await materializePackFromBlobs(manifest, blobsBySheetId, 'local-dev');
  } catch {
    return null;
  }
}

// ============================================================================
// Browser Folder Picker (`showDirectoryPicker` + `<input webkitdirectory>` fallback)
// ============================================================================

async function collectDirectoryFiles(
  dirHandle: FsDirectoryHandleLike,
  prefix: string,
  out: Map<string, File>,
  depth = 0
): Promise<void> {
  if (depth > 4) {
    return;
  }
  for await (const entry of dirHandle.values()) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'file') {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.json') || lower.endsWith('.png')) {
        const file = await entry.getFile();
        out.set(normalizeRelPath(rel), file);
      }
    } else if (entry.kind === 'directory') {
      await collectDirectoryFiles(entry, rel, out, depth + 1);
    }
  }
}

function pickFolderViaHiddenInput(): Promise<Map<string, File> | null> {
  return new Promise<Map<string, File> | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.json,.png,image/png,application/json';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';

    let settled = false;
    const finish = (result: Map<string, File> | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
      resolve(result);
    };

    const onWindowFocus = () => {
      // If user closed the native dialog without choosing files, `change` never fires
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          finish(null);
        }
      }, 350);
    };

    input.addEventListener('cancel', () => finish(null));
    input.addEventListener('change', () => {
      const files = input.files;
      if (!files || files.length === 0) {
        finish(null);
        return;
      }
      const map = new Map<string, File>();
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const rawRel =
          (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        const normalized = normalizeRelPath(rawRel);
        // Strip top-level chosen folder name (e.g. ".wannabehades-assets/manifest.json" -> "manifest.json")
        const slashIdx = normalized.indexOf('/');
        const stripped = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized;
        map.set(stripped, f);
      }
      finish(map);
    });

    document.body.appendChild(input);
    window.addEventListener('focus', onWindowFocus, { once: true });
    input.click();
  });
}

function locateManifestAndPrefix(files: Map<string, File>): { file: File; prefix: string } | null {
  const direct = files.get('manifest.json');
  if (direct) {
    return { file: direct, prefix: '' };
  }
  for (const [relPath, file] of files.entries()) {
    if (relPath === '.wannabehades-assets/manifest.json') {
      return { file, prefix: '.wannabehades-assets/' };
    }
  }
  for (const [relPath, file] of files.entries()) {
    if (relPath.endsWith('/manifest.json')) {
      return { file, prefix: relPath.slice(0, relPath.length - 'manifest.json'.length) };
    }
  }
  return null;
}

/**
 * Prompts the player to choose their local custom pack folder (`.wannabehades-assets/`),
 * validates `manifest.json` + PNG sheets, persists blobs to IndexedDB, and returns a ready
 * `LoadedCustomPack` along with counts.
 */
export async function promptLoadCustomPackFolder(): Promise<CustomPackLoadResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      ok: false,
      spriteCount: 0,
      sheetCount: 0,
      error: 'Custom pack folder picker requires a browser environment.',
    };
  }

  let files: Map<string, File> | null = null;
  const win = window as WindowWithDirectoryPicker;

  if (typeof win.showDirectoryPicker === 'function') {
    try {
      const dirHandle = await win.showDirectoryPicker({ mode: 'read' });
      const collected = new Map<string, File>();
      await collectDirectoryFiles(dirHandle, '', collected);
      files = collected;
    } catch (err) {
      const errName = err instanceof DOMException ? err.name : '';
      if (errName === 'AbortError') {
        return {
          ok: false,
          spriteCount: 0,
          sheetCount: 0,
          error: 'Folder selection canceled.',
        };
      }
      // Fall back to hidden <input webkitdirectory> if showDirectoryPicker is restricted
      files = await pickFolderViaHiddenInput();
    }
  } else {
    files = await pickFolderViaHiddenInput();
  }

  if (!files || files.size === 0) {
    return {
      ok: false,
      spriteCount: 0,
      sheetCount: 0,
      error: 'No folder selected.',
    };
  }

  const located = locateManifestAndPrefix(files);
  if (!located) {
    return {
      ok: false,
      spriteCount: 0,
      sheetCount: 0,
      error: 'Selected folder does not contain manifest.json.',
    };
  }

  let parsedManifest: unknown;
  try {
    const text = await located.file.text();
    parsedManifest = JSON.parse(text);
  } catch {
    return {
      ok: false,
      spriteCount: 0,
      sheetCount: 0,
      error: 'manifest.json is not valid JSON.',
    };
  }

  const check = verifyCustomPackManifest(parsedManifest);
  if (!check.valid) {
    return {
      ok: false,
      spriteCount: 0,
      sheetCount: 0,
      error: `Invalid manifest.json: ${check.errors[0] ?? 'schema validation failed'}`,
    };
  }

  const manifest = parsedManifest as CustomPackManifest;
  const blobsBySheetId = new Map<string, Blob>();
  const missingSheets: string[] = [];

  for (const spec of manifest.sheets) {
    const rel = normalizeRelPath(spec.file);
    const basename = rel.includes('/') ? rel.slice(rel.lastIndexOf('/') + 1) : rel;
    const candidate =
      files.get(`${located.prefix}${rel}`) ??
      files.get(rel) ??
      files.get(`${located.prefix}${basename}`) ??
      files.get(basename);

    if (!candidate) {
      missingSheets.push(spec.file);
      continue;
    }
    if (!(await hasPngSignature(candidate))) {
      return {
        ok: false,
        spriteCount: 0,
        sheetCount: 0,
        error: `Sheet "${spec.file}" is not a valid PNG file.`,
      };
    }
    blobsBySheetId.set(spec.id, candidate);
  }

  if (blobsBySheetId.size === 0) {
    return {
      ok: false,
      spriteCount: 0,
      sheetCount: 0,
      error: `No valid PNG sheets found (missing: ${missingSheets.slice(0, 3).join(', ')}).`,
    };
  }

  let pack: LoadedCustomPack;
  try {
    pack = await materializePackFromBlobs(manifest, blobsBySheetId, 'folder-picker');
  } catch (err) {
    return {
      ok: false,
      spriteCount: 0,
      sheetCount: 0,
      error: err instanceof Error ? err.message : 'Failed to decode custom pack sheets.',
    };
  }

  // Persist to IndexedDB in background-safe await (non-fatal if storage quota/private mode blocks)
  await savePackToIndexedDB(manifest, blobsBySheetId);

  return {
    ok: true,
    spriteCount: pack.spriteCount,
    sheetCount: pack.sheetCount,
    pack,
  };
}

/**
 * Convenience startup helper: checks IndexedDB cached pack first, then quiet local dev pack.
 */
export async function autoLoadCustomPack(
  baseUrl = LOCAL_DEV_PACK_BASE_URL
): Promise<LoadedCustomPack | null> {
  const cached = await loadCachedCustomPackFromIndexedDB();
  if (cached) {
    return cached;
  }
  return detectLocalDevPack(baseUrl);
}
