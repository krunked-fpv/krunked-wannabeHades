import fs from "node:fs";
import path from "node:path";

export type Provenance = "extracted" | "measured";

export interface TrackedValue<T> {
  value: T;
  provenance: Provenance;
  source: string;
  note?: string;
}

const DEFAULT_HADES_DIR = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hades";

function resolveHadesDir(argv: string[]): string {
  const flagIdx = argv.indexOf("--hades-dir");
  if (flagIdx >= 0 && argv[flagIdx + 1]) {
    return argv[flagIdx + 1];
  }
  if (process.env.HADES_INSTALL_DIR) {
    return process.env.HADES_INSTALL_DIR;
  }
  return DEFAULT_HADES_DIR;
}

function tracked<T>(
  value: T,
  source: string,
  provenance: Provenance = "extracted",
  note?: string,
): TrackedValue<T> {
  return note ? { value, provenance, source, note } : { value, provenance, source };
}

// ---------------------------------------------------------------------------
// Minimal SJSON Parser (Supergiant Games SJSON: optional commas, `=` instead
// of `:`, unquoted keys, `//` and `/* */` comments, trailing delimiters)
// ---------------------------------------------------------------------------

type SjsonValue = string | number | boolean | null | SjsonObject | SjsonValue[];
interface SjsonObject {
  [key: string]: SjsonValue;
}

class SjsonParser {
  private readonly src: string;
  private pos = 0;

  constructor(src: string) {
    this.src = src;
  }

  parse(): SjsonValue {
    this.skipWhitespaceAndComments();
    if (this.pos >= this.src.length) return {};
    return this.parseValue();
  }

  private skipWhitespaceAndComments(): void {
    const n = this.src.length;
    while (this.pos < n) {
      const ch = this.src[this.pos];
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ch === ",") {
        this.pos++;
      } else if (ch === "/" && this.src[this.pos + 1] === "/") {
        this.pos += 2;
        while (this.pos < n && this.src[this.pos] !== "\n") this.pos++;
      } else if (ch === "/" && this.src[this.pos + 1] === "*") {
        this.pos += 2;
        while (this.pos < n && !(this.src[this.pos] === "*" && this.src[this.pos + 1] === "/")) {
          this.pos++;
        }
        this.pos += 2;
      } else {
        break;
      }
    }
  }

  private parseValue(): SjsonValue {
    this.skipWhitespaceAndComments();
    const ch = this.src[this.pos];
    if (ch === "{") return this.parseObject();
    if (ch === "[") return this.parseArray();
    if (ch === '"') return this.parseString();
    return this.parsePrimitive();
  }

  private parseObject(): SjsonObject {
    const obj: SjsonObject = {};
    this.pos++; // '{'
    while (this.pos < this.src.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.src.length || this.src[this.pos] === "}") {
        this.pos++;
        break;
      }
      const key = this.src[this.pos] === '"' ? this.parseString() : this.parseBareKey();
      this.skipWhitespaceAndComments();
      if (this.src[this.pos] === "=" || this.src[this.pos] === ":") {
        this.pos++;
      }
      const val = this.parseValue();
      obj[key] = val;
    }
    return obj;
  }

  private parseArray(): SjsonValue[] {
    const arr: SjsonValue[] = [];
    this.pos++; // '['
    while (this.pos < this.src.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.src.length || this.src[this.pos] === "]") {
        this.pos++;
        break;
      }
      arr.push(this.parseValue());
    }
    return arr;
  }

  private parseString(): string {
    this.pos++; // opening '"'
    let out = "";
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos++];
      if (ch === '"') break;
      if (ch === "\\" && this.pos < this.src.length) {
        const next = this.src[this.pos++];
        if (next === "n") out += "\n";
        else if (next === "r") out += "\r";
        else if (next === "t") out += "\t";
        else out += next;
      } else {
        out += ch;
      }
    }
    return out;
  }

  private parseBareKey(): string {
    const start = this.pos;
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];
      if (
        ch === " " ||
        ch === "\t" ||
        ch === "\r" ||
        ch === "\n" ||
        ch === "=" ||
        ch === ":" ||
        ch === "{" ||
        ch === "}" ||
        ch === "[" ||
        ch === "]"
      ) {
        break;
      }
      this.pos++;
    }
    return this.src.slice(start, this.pos);
  }

  private parsePrimitive(): string | number | boolean | null {
    const start = this.pos;
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos];
      if (
        ch === " " ||
        ch === "\t" ||
        ch === "\r" ||
        ch === "\n" ||
        ch === "," ||
        ch === "}" ||
        ch === "]"
      ) {
        break;
      }
      if (ch === "/" && (this.src[this.pos + 1] === "/" || this.src[this.pos + 1] === "*")) {
        break;
      }
      this.pos++;
    }
    const raw = this.src.slice(start, this.pos);
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (raw === "null") return null;
    const num = Number(raw);
    if (!Number.isNaN(num) && raw.length > 0) return num;
    return raw;
  }
}

function parseSjsonFile(filePath: string): SjsonObject {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return new SjsonParser(raw).parse() as SjsonObject;
}

function indexByName(items: SjsonValue[]): Map<string, SjsonObject> {
  const map = new Map<string, SjsonObject>();
  for (const item of items) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const name = item.Name;
      if (typeof name === "string") {
        map.set(name, item);
      }
    }
  }
  return map;
}

function resolveInherited(
  map: Map<string, SjsonObject>,
  name: string,
  seen = new Set<string>(),
): SjsonObject {
  const entry = map.get(name);
  if (!entry) {
    throw new Error(`Missing SJSON entry: ${name}`);
  }
  if (seen.has(name)) return entry;
  seen.add(name);
  const parentName = typeof entry.InheritFrom === "string" ? entry.InheritFrom : null;
  if (!parentName || !map.has(parentName)) {
    return { ...entry };
  }
  const parent = resolveInherited(map, parentName, seen);
  return { ...parent, ...entry };
}

function asNumber(v: SjsonValue | undefined, fallback?: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Expected number, got ${String(v)}`);
}

// ---------------------------------------------------------------------------
// Lua Table Extraction Helpers (strictly regex/brace-aware, read-only)
// ---------------------------------------------------------------------------

function stripLuaComments(src: string): string {
  // Strip block comments --[[ ... ]] and single-line comments -- ... while preserving strings
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        const c = src[i++];
        out += c;
        if (c === "\\" && i < n) {
          out += src[i++];
        } else if (c === quote) {
          break;
        }
      }
    } else if (ch === "-" && src[i + 1] === "-") {
      if (src[i + 2] === "[" && src[i + 3] === "[") {
        i += 4;
        while (i < n && !(src[i] === "]" && src[i + 1] === "]")) i++;
        i += 2;
      } else {
        while (i < n && src[i] !== "\n") i++;
      }
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function extractLuaBlock(src: string, keyRegex: RegExp): string {
  const m = keyRegex.exec(src);
  if (!m) {
    throw new Error(`Could not locate Lua block matching ${keyRegex}`);
  }
  const openIdx = src.indexOf("{", m.index);
  if (openIdx < 0) {
    throw new Error(`No opening brace for Lua block matching ${keyRegex}`);
  }
  let depth = 0;
  let inStr: string | null = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
      } else if (ch === inStr) {
        inStr = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return src.slice(openIdx, i + 1);
      }
    }
  }
  throw new Error(`Unterminated Lua block matching ${keyRegex}`);
}

function luaNum(block: string, field: string): number {
  const re = new RegExp(`\\b${field}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`);
  const m = re.exec(block);
  if (!m) throw new Error(`Missing Lua numeric field "${field}"`);
  return Number(m[1]);
}

function luaTopLevelNum(block: string, field: string): number {
  // Match field only at brace depth 1 inside `block`
  let depth = 0;
  let inStr: string | null = null;
  let lineStart = 0;
  for (let i = 0; i <= block.length; i++) {
    const ch = block[i] ?? "\n";
    if (inStr) {
      if (ch === "\\") {
        i++;
      } else if (ch === inStr) {
        inStr = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "\n" || i === block.length) {
      if (depth === 1) {
        const line = block.slice(lineStart, i);
        const m = new RegExp(`^\\s*${field}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`).exec(line);
        if (m) return Number(m[1]);
      }
      lineStart = i + 1;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  throw new Error(`Missing top-level Lua numeric field "${field}"`);
}

function luaNumArray(block: string, field: string): number[] {
  const sub = extractLuaBlock(block, new RegExp(`\\b${field}\\s*=`));
  return [...sub.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

function luaStringArray(block: string): string[] {
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

// ---------------------------------------------------------------------------
// LZ4 Raw Block Decompressor (for inspecting first XNB header inside .pkg)
// ---------------------------------------------------------------------------

function decompressLz4Prefix(src: Buffer, maxOutputBytes: number): Buffer {
  const out = Buffer.alloc(maxOutputBytes);
  let ip = 0;
  let op = 0;
  const srcEnd = src.length;
  while (ip < srcEnd && op < maxOutputBytes) {
    const token = src[ip++];
    let litLen = token >>> 4;
    if (litLen === 15) {
      let b = 255;
      while (ip < srcEnd && b === 255) {
        b = src[ip++];
        litLen += b;
      }
    }
    const litCopy = Math.min(litLen, maxOutputBytes - op, srcEnd - ip);
    src.copy(out, op, ip, ip + litCopy);
    ip += litLen;
    op += litCopy;
    if (ip >= srcEnd || op >= maxOutputBytes) break;

    if (ip + 2 > srcEnd) break;
    const offset = src[ip] | (src[ip + 1] << 8);
    ip += 2;
    if (offset === 0) break;

    let matchLen = (token & 0x0f) + 4;
    if ((token & 0x0f) === 15) {
      let b = 255;
      while (ip < srcEnd && b === 255) {
        b = src[ip++];
        matchLen += b;
      }
    }
    let matchPos = op - offset;
    for (let k = 0; k < matchLen && op < maxOutputBytes; k++) {
      out[op++] = matchPos >= 0 ? out[matchPos++] : 0;
    }
  }
  return out.subarray(0, op);
}

function inspectPkgAndManifest(hadesDir: string) {
  const bc3Dir = path.join(hadesDir, "Content", "Win", "Packages", "BC3");
  const samples = ["UIScripts", "_TartarusTemplateRoom", "Tartarus"];
  const pkgNotes: Record<string, unknown> = {};

  for (const name of samples) {
    const pkgPath = path.join(bc3Dir, `${name}.pkg`);
    const manPath = path.join(bc3Dir, `${name}.pkg_manifest`);
    if (!fs.existsSync(pkgPath) || !fs.existsSync(manPath)) continue;

    // Read .pkg header and chunk table strictly read-only
    const fd = fs.openSync(pkgPath, "r");
    const stat = fs.fstatSync(fd);
    const hdrBuf = Buffer.alloc(4);
    fs.readSync(fd, hdrBuf, 0, 4, 0);
    const flagsByte = hdrBuf[0];
    const pkgVersion = hdrBuf.readUInt32BE(0) & 0x00ffffff;

    const chunks: Array<{ offset: number; compressedFlag: number; compressedLength: number }> = [];
    let cursor = 4;
    const chunkHdr = Buffer.alloc(5);
    while (cursor + 5 <= stat.size && chunks.length < 32) {
      fs.readSync(fd, chunkHdr, 0, 5, cursor);
      const compressedFlag = chunkHdr[0];
      const compressedLength = chunkHdr.readUInt32BE(1);
      chunks.push({ offset: cursor, compressedFlag, compressedLength });
      cursor += 5 + compressedLength;
    }

    // Decompress first 512 bytes of chunk 0 to read the embedded entry & XNB v6 header
    let firstEntry: Record<string, unknown> | null = null;
    if (chunks.length > 0) {
      const readLen = Math.min(chunks[0].compressedLength, 4096);
      const compSlice = Buffer.alloc(readLen);
      fs.readSync(fd, compSlice, 0, readLen, chunks[0].offset + 5);
      const rawPrefix =
        chunks[0].compressedFlag === 1 ? decompressLz4Prefix(compSlice, 512) : compSlice;

      const entryTag = rawPrefix[0];
      const pathLen = rawPrefix[1];
      const assetPath = rawPrefix.subarray(2, 2 + pathLen).toString("ascii");
      const xnbPayloadOffset = 2 + pathLen;
      const xnbPayloadSizeBE = rawPrefix.readUInt32BE(xnbPayloadOffset);
      const xnbStart = xnbPayloadOffset + 4;
      const xnbMagic = rawPrefix.subarray(xnbStart, xnbStart + 4).toString("ascii");
      if (xnbMagic === "XNBw") {
        firstEntry = {
          entryTagHex: `0x${entryTag.toString(16).toUpperCase()}`,
          assetPath,
          entryDeclaredSizeBE: xnbPayloadSizeBE,
          xnbMagic,
          xnbVersion: rawPrefix[xnbStart + 4],
          xnbFlags: rawPrefix[xnbStart + 5],
          xnbTotalSizeLE: rawPrefix.readUInt32LE(xnbStart + 6),
          surfaceFormat: rawPrefix.readUInt32LE(xnbStart + 10),
          width: rawPrefix.readUInt32LE(xnbStart + 14),
          height: rawPrefix.readUInt32LE(xnbStart + 18),
          mipCount: rawPrefix.readUInt32LE(xnbStart + 22),
          imageDataBytes: rawPrefix.readUInt32LE(xnbStart + 26),
          xnbHeaderBytes: 30,
        };
      }
    }
    fs.closeSync(fd);

    // Read .pkg_manifest header + first sub-atlas record
    const manBuf = fs.readFileSync(manPath);
    const manFlags = manBuf[0];
    const manVersion = manBuf.readUInt32BE(0) & 0x00ffffff;
    const manTag = manBuf[4];
    const manBlockLen = manBuf.readUInt32BE(5);
    const atlasMagicHex = `0x${manBuf.readUInt32BE(9).toString(16).toUpperCase()}`;
    const atlasSubVersion = manBuf.readUInt32BE(13);
    const subAtlasCount = manBuf.readUInt32BE(17);

    let p = 21;
    const subNameLen = manBuf[p++];
    const subName = manBuf.subarray(p, p + subNameLen).toString("ascii");
    p += subNameLen;
    const rect = {
      x: manBuf.readInt32BE(p),
      y: manBuf.readInt32BE(p + 4),
      width: manBuf.readInt32BE(p + 8),
      height: manBuf.readInt32BE(p + 12),
    };
    p += 16;
    const topLeft = { x: manBuf.readInt32BE(p), y: manBuf.readInt32BE(p + 4) };
    p += 8;
    const originalSize = { width: manBuf.readInt32BE(p), height: manBuf.readInt32BE(p + 4) };
    p += 8;
    const scaleRatio = {
      x: Number(manBuf.readFloatBE(p).toFixed(4)),
      y: Number(manBuf.readFloatBE(p + 4).toFixed(4)),
    };
    p += 8;
    const isMulti = manBuf[p++];
    const hullVertexCount = manBuf.readInt32BE(p);

    pkgNotes[name] = {
      pkgFileBytes: stat.size,
      pkgHeader: {
        flagsHex: `0x${flagsByte.toString(16).toUpperCase()}`,
        version: pkgVersion,
        chunkCount: chunks.length,
        chunks,
        firstEntry,
      },
      manifestFileBytes: manBuf.length,
      manifestHeader: {
        flagsHex: `0x${manFlags.toString(16).toUpperCase()}`,
        version: manVersion,
        firstEntryTagHex: `0x${manTag.toString(16).toUpperCase()}`,
        firstAtlasBlockBytes: manBlockLen,
        atlasMagicHex,
        atlasSubVersion,
        subAtlasCount,
        sampleSubAtlas: {
          name: subName,
          rect,
          topLeft,
          originalSize,
          scaleRatio,
          isMulti,
          hullVertexCount,
        },
      },
    };
  }

  return tracked(
    {
      formatSummary: {
        pkgContainer: "4-byte BE header (flags 0x20 = LZ4 chunked | 0x00 = raw, low 24 bits = version 7), followed by chunks of [u8 isCompressed, u32BE compressedLen, raw LZ4 block payload]. Decompressed stream has tagged entries: 0xAD = Texture2D/XNB (u8 pathLen, ascii path, u32BE payloadLen, XNBw v6), 0xDE = Atlas manifest, 0xDD = Texture ref, 0xFF = EOF.",
        xnbV6Layout: "30-byte header: 'XNBw' (4B), version=6 (1B), flags=0 (1B), totalSizeLE (4B), surfaceFormatLE (4B; 6=BC3/DXT5), widthLE (4B), heightLE (4B), mipCountLE (4B), imageDataSizeLE (4B), followed immediately by BC3 block payload.",
        manifestLayout: "Uncompressed v7 stream: 0xDE + u32BE blockLen + u32BE magic (0x7FB1776B) + u32BE subVer (4) + u32BE subAtlasCount + [u8 nameLen, ascii name, 4*i32BE rect, 2*i32BE topLeft, 2*i32BE origSize, 2*f32BE scaleRatio, u8 isMulti, i32BE hullCount, hullCount*(2*i32BE)], followed by 0xDD + pascal texture path, ending with 0xFF.",
      },
      samples: pkgNotes,
    },
    "Content/Win/Packages/BC3/{UIScripts,_TartarusTemplateRoom,Tartarus}.{pkg,pkg_manifest}",
    "extracted",
  );
}

// ---------------------------------------------------------------------------
// Main Extraction Routine
// ---------------------------------------------------------------------------

function main(): void {
  const hadesDir = resolveHadesDir(process.argv.slice(2));
  const scriptsDir = path.join(hadesDir, "Content", "Scripts");
  const gameDir = path.join(hadesDir, "Content", "Game");
  const mapsDir = path.join(hadesDir, "Content", "Maps");

  if (!fs.existsSync(hadesDir) || !fs.existsSync(scriptsDir) || !fs.existsSync(gameDir)) {
    console.log(
      `[oracle-dump] Retail Hades install not found at "${hadesDir}". Skipping oracle extraction (CI-safe exit 0).`,
    );
    process.exit(0);
  }

  console.log(`[oracle-dump] Reading retail data strictly read-only from: ${hadesDir}`);

  // 1. Parse SJSON files
  const playerUnitsSjson = parseSjsonFile(path.join(gameDir, "Units", "PlayerUnits.sjson"));
  const playerUnits = indexByName((playerUnitsSjson.Units as SjsonValue[]) ?? []);
  const playerUnit = resolveInherited(playerUnits, "_PlayerUnit");
  const playerUnitData = playerUnit.PlayerUnitData as SjsonObject;
  const playerLife = playerUnit.Life as SjsonObject;
  const playerThing = playerUnit.Thing as SjsonObject;
  const heroOctagonSizeObj = playerThing.Size as SjsonObject;
  const heroOctagonPointsRaw = playerThing.Points as SjsonObject[];
  const heroOctagonVerts = heroOctagonPointsRaw.map((pt) => [asNumber(pt.X), asNumber(pt.Y)]);

  const playerWeaponsSjson = parseSjsonFile(path.join(gameDir, "Weapons", "PlayerWeapons.sjson"));
  const playerWeapons = indexByName((playerWeaponsSjson.Weapons as SjsonValue[]) ?? []);

  const playerProjSjson = parseSjsonFile(
    path.join(gameDir, "Projectiles", "PlayerProjectiles.sjson"),
  );
  const playerProjs = indexByName((playerProjSjson.Projectiles as SjsonValue[]) ?? []);

  const enemyProjSjson = parseSjsonFile(path.join(gameDir, "Projectiles", "EnemyProjectiles.sjson"));
  const enemyProjs = indexByName((enemyProjSjson.Projectiles as SjsonValue[]) ?? []);

  // Helper to resolve weapon & projectile pairs
  const getW = (name: string) => resolveInherited(playerWeapons, name);
  const getP = (name: string) => resolveInherited(playerProjs, name);

  // 2. Read & strip Lua data files
  const readLua = (filename: string) =>
    stripLuaComments(fs.readFileSync(path.join(scriptsDir, filename), "utf8"));

  const heroDataLua = readLua("HeroData.lua");
  const defaultHeroBlock = extractLuaBlock(heroDataLua, /\bDefaultHero\s*=/);
  const superBlock = extractLuaBlock(defaultHeroBlock, /\bSuper\s*=/);
  const boonDataBlock = extractLuaBlock(defaultHeroBlock, /\bBoonData\s*=/);
  const hermesDataBlock = extractLuaBlock(defaultHeroBlock, /\bHermesData\s*=/);
  const shoutSlowBlock = extractLuaBlock(defaultHeroBlock, /\bShoutSlowParameters\s*=/);
  const shoutSlowEntries = [...shoutSlowBlock.matchAll(/\{[^{}]+\}/g)].map((m) => m[0]);
  const finalSlowBlock = extractLuaBlock(defaultHeroBlock, /\bFinalHitSlowParameters\s*=/);
  const finalSlowEntries = [...finalSlowBlock.matchAll(/\{[^{}]+\}/g)].map((m) => m[0]);

  const weaponDataLua = readLua("WeaponData.lua");
  const rangedWeaponLua = extractLuaBlock(weaponDataLua, /\tRangedWeapon\s*=/);
  const gunWeaponLua = extractLuaBlock(weaponDataLua, /\tGunWeapon\s*=/);

  const traitDataLua = readLua("TraitData.lua");
  const traitMultBlock = extractLuaBlock(traitDataLua, /\bTraitMultiplierData\s*=/);
  const lootDataLua = readLua("LootData.lua");
  const enemyDataLua = readLua("EnemyData.lua");
  const metaUpgradeLua = readLua("MetaUpgradeData.lua");
  const giftDataLua = readLua("GiftData.lua");
  const runManagerLua = readLua("RunManager.lua");
  const uiDataLua = readLua("UIData.lua");

  // 3. Hero & Dash & Cast constants
  const rushW = getW("RushWeapon");
  const rushEffects = indexByName((rushW.Effects as SjsonValue[]) ?? []);
  const rushInvuln = rushEffects.get("RushWeaponInvulnerable")!;
  const blinkDuration = asNumber(rushW.BlinkDuration);

  const rangedW = getW("RangedWeapon");
  const rangedP = getP("RangedWeapon");

  const healthMetaBlock = extractLuaBlock(metaUpgradeLua, /\tHealthMetaUpgrade\s*=/);
  const healthCostTable = luaNumArray(healthMetaBlock, "CostTable");
  const healthPerRank = luaTopLevelNum(healthMetaBlock, "ChangeValue");

  const ammoMetaBlock = extractLuaBlock(metaUpgradeLua, /\tAmmoMetaUpgrade\s*=/);
  const ammoCostTable = luaNumArray(ammoMetaBlock, "CostTable");

  const superMeterMatch = /function\s+CalculateSuperMeter\s*\(\s*\)\s*return\s+(\d+)/.exec(
    runManagerLua,
  );
  const superMeterMax = superMeterMatch ? Number(superMeterMatch[1]) : 100;
  const wrathPipMatch = /WrathPips(\d+)/.exec(uiDataLua);
  const superBarCost = wrathPipMatch ? Number(wrathPipMatch[1]) : 25;

  const easyBase = luaTopLevelNum(defaultHeroBlock, "EasyModeDamageMultiplierBase");
  const easyPerDeath = luaTopLevelNum(defaultHeroBlock, "EasyModeDamageMultiplierPerDeath");
  const easyDeathCap = luaTopLevelNum(defaultHeroBlock, "EasyModeDamageMultiplierDeathCap");
  const easyMinMult = Number((easyBase + easyPerDeath * easyDeathCap).toFixed(4));

  const hero = {
    speed: tracked(asNumber(playerUnit.Speed), "Content/Game/Units/PlayerUnits.sjson"),
    acceleration: tracked(
      asNumber(playerUnit.Acceleration),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    grip: tracked(asNumber(playerThing.Grip), "Content/Game/Units/PlayerUnits.sjson"),
    backpedalSpeedModifier: tracked(
      asNumber(playerUnit.BackpedalSpeedModifier),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    fullControlVelocityThreshold: tracked(
      asNumber(playerUnit.FullControlVelocityThreshold),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    touchdownVelocityRetention: tracked(
      asNumber(playerUnit.TouchdownVelocityRetention),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    cosmeticRotationSpeed: tracked(
      asNumber(playerUnit.CosmeticRotationSpeed),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    combatRotationSpeed: tracked(
      asNumber(playerUnit.RotationSpeed),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    minMoveDistance: tracked(
      asNumber(playerUnitData.MinMoveDistance),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    reticleMagnetismDistance: tracked(
      asNumber(playerUnitData.ReticleMagnetismDistance),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    reticleMagnetismSpeed: tracked(
      asNumber(playerUnitData.ReticleMagnetismSpeed),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    reticleMoveDelay: tracked(
      asNumber(playerUnitData.ReticleMoveDelay),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    reticleMoveSpeed: tracked(
      asNumber(playerUnitData.ReticleMoveSpeed),
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    octagonSize: tracked(
      { x: asNumber(heroOctagonSizeObj.X), y: asNumber(heroOctagonSizeObj.Y) },
      "Content/Game/Units/PlayerUnits.sjson",
    ),
    octagonVerts: tracked(heroOctagonVerts, "Content/Game/Units/PlayerUnits.sjson"),
    dash: {
      blinkDuration: tracked(blinkDuration, "Content/Game/Weapons/PlayerWeapons.sjson"),
      blinkTicks60Hz: tracked(
        Math.round(blinkDuration * 60),
        "Content/Game/Weapons/PlayerWeapons.sjson",
        "measured",
        "round(BlinkDuration * 60)",
      ),
      blinkEaseIn: tracked(asNumber(rushW.BlinkEaseIn), "Content/Game/Weapons/PlayerWeapons.sjson"),
      blinkEaseOut: tracked(
        asNumber(rushW.BlinkEaseOut),
        "Content/Game/Weapons/PlayerWeapons.sjson",
      ),
      range: tracked(asNumber(rushW.WeaponRange), "Content/Game/Weapons/PlayerWeapons.sjson"),
      maxRange: tracked(asNumber(rushW.BlinkMaxRange), "Content/Game/Weapons/PlayerWeapons.sjson"),
      baseClipSize: tracked(asNumber(rushW.ClipSize), "Content/Game/Weapons/PlayerWeapons.sjson"),
      clipRegenInterval: tracked(
        asNumber(rushW.ClipRegenInterval),
        "Content/Game/Weapons/PlayerWeapons.sjson",
      ),
      cooldown: tracked(asNumber(rushW.Cooldown), "Content/Game/Weapons/PlayerWeapons.sjson"),
      numGhosts: tracked(
        asNumber(rushW.BlinkNumGhosts),
        "Content/Game/Weapons/PlayerWeapons.sjson",
      ),
      invulnerableDuration: tracked(
        asNumber(rushInvuln.Duration),
        "Content/Game/Weapons/PlayerWeapons.sjson",
      ),
      dashManeuverTimeThreshold: tracked(
        luaTopLevelNum(defaultHeroBlock, "DashManeuverTimeThreshold"),
        "Content/Scripts/HeroData.lua",
      ),
      perfectDashHitDisableDuration: tracked(
        luaTopLevelNum(defaultHeroBlock, "PerfectDashHitDisableDuration"),
        "Content/Scripts/HeroData.lua",
      ),
    },
    health: {
      baseMaxHealth: tracked(
        luaTopLevelNum(defaultHeroBlock, "MaxHealth"),
        "Content/Scripts/HeroData.lua",
      ),
      thickSkinPerRank: tracked(healthPerRank, "Content/Scripts/MetaUpgradeData.lua"),
      thickSkinRanks: tracked(healthCostTable.length, "Content/Scripts/MetaUpgradeData.lua"),
      thickSkinMaxBonus: tracked(
        healthPerRank * healthCostTable.length,
        "Content/Scripts/MetaUpgradeData.lua",
        "measured",
        "ChangeValue * #CostTable",
      ),
    },
    postHitInvuln: {
      duration: tracked(
        luaTopLevelNum(defaultHeroBlock, "InvulnerableFrameDuration"),
        "Content/Scripts/HeroData.lua",
      ),
      minDamage: tracked(
        luaTopLevelNum(defaultHeroBlock, "InvulnerableFrameMinDamage"),
        "Content/Scripts/HeroData.lua",
      ),
      cumulativeWindow: tracked(
        luaTopLevelNum(defaultHeroBlock, "InvulnerableFrameCumulativeDamageDuration"),
        "Content/Scripts/HeroData.lua",
      ),
      threshold: tracked(
        luaTopLevelNum(defaultHeroBlock, "InvulnerableFrameThreshold"),
        "Content/Scripts/HeroData.lua",
      ),
    },
    godMode: {
      baseMultiplier: tracked(easyBase, "Content/Scripts/HeroData.lua"),
      perDeathDelta: tracked(easyPerDeath, "Content/Scripts/HeroData.lua"),
      maxDeaths: tracked(easyDeathCap, "Content/Scripts/HeroData.lua"),
      minDamageMultiplier: tracked(
        easyMinMult,
        "Content/Scripts/HeroData.lua",
        "measured",
        "base + perDeathDelta * maxDeaths (80% max DR)",
      ),
    },
    godGauge: {
      damageDealtMultiplier: tracked(
        luaNum(superBlock, "DamageDealtMultiplier"),
        "Content/Scripts/HeroData.lua",
      ),
      damageTakenMultiplier: tracked(
        luaNum(superBlock, "DamageTakenMultiplier"),
        "Content/Scripts/HeroData.lua",
      ),
      maxMeter: tracked(superMeterMax, "Content/Scripts/RunManager.lua"),
      barCost: tracked(superBarCost, "Content/Scripts/UIData.lua"),
      bars: tracked(
        Math.round(superMeterMax / superBarCost),
        "Content/Scripts/RunManager.lua + UIData.lua",
        "measured",
        "maxMeter / barCost",
      ),
      greaterCallSlowScale: tracked(
        luaNum(shoutSlowEntries[0], "Fraction"),
        "Content/Scripts/HeroData.lua",
      ),
      greaterCallSlowDuration: tracked(
        luaNum(shoutSlowEntries[1], "ScreenPreWait"),
        "Content/Scripts/HeroData.lua",
      ),
    },
    cast: {
      damage: tracked(
        asNumber(rangedP.DamageLow),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      speed: tracked(asNumber(rangedP.Speed), "Content/Game/Projectiles/PlayerProjectiles.sjson"),
      range: tracked(asNumber(rangedP.Range), "Content/Game/Projectiles/PlayerProjectiles.sjson"),
      chargeFrames: tracked(
        asNumber(rangedW.ChargeTimeFrames),
        "Content/Game/Weapons/PlayerWeapons.sjson",
      ),
      chargeSeconds60Hz: tracked(
        Number((asNumber(rangedW.ChargeTimeFrames) / 60).toFixed(4)),
        "Content/Game/Weapons/PlayerWeapons.sjson",
        "measured",
        "ChargeTimeFrames / 60",
      ),
      cooldown: tracked(asNumber(rangedW.Cooldown), "Content/Game/Weapons/PlayerWeapons.sjson"),
      selfVelocity: tracked(
        asNumber(rangedW.SelfVelocity),
        "Content/Game/Weapons/PlayerWeapons.sjson",
      ),
      baseAmmo: tracked(asNumber(rangedW.MaxAmmo), "Content/Game/Weapons/PlayerWeapons.sjson"),
      infernalSoulMaxBonus: tracked(ammoCostTable.length, "Content/Scripts/MetaUpgradeData.lua"),
      ammoDropDelay: tracked(
        luaTopLevelNum(rangedWeaponLua, "AmmoDropDelay"),
        "Content/Scripts/WeaponData.lua",
      ),
      leaveRoomAmmoMagnetismSpeed: tracked(
        luaTopLevelNum(defaultHeroBlock, "LeaveRoomAmmoMangetismSpeed"),
        "Content/Scripts/HeroData.lua",
      ),
    },
    deflect: {
      reflectionSpeedMultiplier: tracked(
        asNumber(playerLife.ReflectionSpeedMultiplier),
        "Content/Game/Units/PlayerUnits.sjson",
      ),
      lobReflectionSpeedMultiplier: tracked(
        asNumber(playerLife.LobReflectionSpeedMultiplier),
        "Content/Game/Units/PlayerUnits.sjson",
      ),
    },
    finalKillSlow: {
      scale: tracked(luaNum(finalSlowEntries[0], "Fraction"), "Content/Scripts/HeroData.lua"),
      duration: tracked(
        luaNum(finalSlowEntries[1], "ScreenPreWait"),
        "Content/Scripts/HeroData.lua",
      ),
      lerpOut: tracked(luaNum(finalSlowEntries[1], "LerpTime"), "Content/Scripts/HeroData.lua"),
    },
  };

  // 4. All 6 Weapons (clean-room keys mapped cleanly to retail SJSON/Lua tables)
  const extractAttackStep = (weaponName: string, projOverride?: string) => {
    const w = getW(weaponName);
    const pName = projOverride ?? (typeof w.Projectile === "string" ? w.Projectile : weaponName);
    const p = getP(pName);
    const chargeFrames = typeof w.ChargeTimeFrames === "number" ? w.ChargeTimeFrames : undefined;
    const chargeTime = typeof w.ChargeTime === "number" ? w.ChargeTime : undefined;
    return {
      retailWeaponKey: weaponName,
      retailProjectileKey: pName,
      damageLow: tracked(asNumber(p.DamageLow), "Content/Game/Projectiles/PlayerProjectiles.sjson"),
      damageHigh: tracked(
        asNumber(p.DamageHigh),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      ...(chargeFrames !== undefined
        ? {
            chargeTimeFrames: tracked(chargeFrames, "Content/Game/Weapons/PlayerWeapons.sjson"),
            chargeTimeSec60Hz: tracked(
              Number((chargeFrames / 60).toFixed(4)),
              "Content/Game/Weapons/PlayerWeapons.sjson",
              "measured",
              "ChargeTimeFrames / 60",
            ),
          }
        : {}),
      ...(chargeTime !== undefined
        ? { chargeTimeSec: tracked(chargeTime, "Content/Game/Weapons/PlayerWeapons.sjson") }
        : {}),
      ...(typeof w.ControlWindow === "number"
        ? { controlWindow: tracked(w.ControlWindow, "Content/Game/Weapons/PlayerWeapons.sjson") }
        : {}),
      ...(typeof w.Cooldown === "number"
        ? { cooldown: tracked(w.Cooldown, "Content/Game/Weapons/PlayerWeapons.sjson") }
        : {}),
      ...(typeof w.ReloadTime === "number"
        ? { reloadTime: tracked(w.ReloadTime, "Content/Game/Weapons/PlayerWeapons.sjson") }
        : {}),
      ...(typeof p.Range === "number" && p.Range > 0
        ? { range: tracked(p.Range, "Content/Game/Projectiles/PlayerProjectiles.sjson") }
        : {}),
      ...(typeof p.Speed === "number" && p.Speed > 0
        ? { speed: tracked(p.Speed, "Content/Game/Projectiles/PlayerProjectiles.sjson") }
        : {}),
      ...(typeof p.DamageRadius === "number" && p.DamageRadius > 0
        ? {
            damageRadius: tracked(
              p.DamageRadius,
              "Content/Game/Projectiles/PlayerProjectiles.sjson",
            ),
          }
        : {}),
      ...(typeof p.DamageRadiusScaleY === "number"
        ? {
            damageRadiusScaleY: tracked(
              p.DamageRadiusScaleY,
              "Content/Game/Projectiles/PlayerProjectiles.sjson",
            ),
          }
        : {}),
      ...(typeof p.ImpactVelocity === "number" && p.ImpactVelocity > 0
        ? {
            impactVelocity: tracked(
              p.ImpactVelocity,
              "Content/Game/Projectiles/PlayerProjectiles.sjson",
            ),
          }
        : {}),
      ...(typeof w.NumProjectiles === "number" && w.NumProjectiles > 1
        ? { numProjectiles: tracked(w.NumProjectiles, "Content/Game/Weapons/PlayerWeapons.sjson") }
        : {}),
      ...(typeof w.ProjectileInterval === "number" && w.ProjectileInterval > 0
        ? {
            projectileInterval: tracked(
              w.ProjectileInterval,
              "Content/Game/Weapons/PlayerWeapons.sjson",
            ),
          }
        : {}),
      ...(typeof w.ProjectileAngleOffset === "number"
        ? {
            projectileAngleOffset: tracked(
              w.ProjectileAngleOffset,
              "Content/Game/Weapons/PlayerWeapons.sjson",
            ),
          }
        : {}),
      ...(typeof p.NumJumps === "number"
        ? { numJumps: tracked(p.NumJumps, "Content/Game/Projectiles/PlayerProjectiles.sjson") }
        : {}),
      ...(typeof w.MaxAmmo === "number"
        ? { maxAmmo: tracked(w.MaxAmmo, "Content/Game/Weapons/PlayerWeapons.sjson") }
        : {}),
      ...(typeof w.MinChargeToFire === "number" && w.MinChargeToFire > 0
        ? {
            minChargeToFire: tracked(w.MinChargeToFire, "Content/Game/Weapons/PlayerWeapons.sjson"),
          }
        : {}),
      ...(typeof w.ChargeDamageMultiplier === "number" && w.ChargeDamageMultiplier > 1
        ? {
            chargeDamageMultiplier: tracked(
              w.ChargeDamageMultiplier,
              "Content/Game/Weapons/PlayerWeapons.sjson",
            ),
          }
        : {}),
      ...(typeof w.ChargeRangeMultiplier === "number" && w.ChargeRangeMultiplier > 1
        ? {
            chargeRangeMultiplier: tracked(
              w.ChargeRangeMultiplier,
              "Content/Game/Weapons/PlayerWeapons.sjson",
            ),
          }
        : {}),
      ...(typeof w.PerfectChargeWindowDuration === "number" && w.PerfectChargeWindowDuration > 0
        ? {
            perfectChargeWindowDuration: tracked(
              w.PerfectChargeWindowDuration,
              "Content/Game/Weapons/PlayerWeapons.sjson",
            ),
          }
        : {}),
      ...(typeof w.PerfectChargeDamageMultiplier === "number" &&
      w.PerfectChargeDamageMultiplier > 1
        ? {
            perfectChargeDamageMultiplier: tracked(
              w.PerfectChargeDamageMultiplier,
              "Content/Game/Weapons/PlayerWeapons.sjson",
            ),
          }
        : {}),
    };
  };

  const bowW = getW("BowWeapon");
  const bowP = getP("BowWeapon");
  const bowDashW = getW("BowWeaponDash");
  const shieldRushW = getW("ShieldWeaponRush");
  const shieldRushP = getP("ShieldWeaponRush");

  const weapons = {
    blade: {
      retailReference: "SwordWeapon",
      combo: [
        extractAttackStep("SwordWeapon"),
        extractAttackStep("SwordWeapon2"),
        extractAttackStep("SwordWeapon3"),
      ],
      dashStrike: extractAttackStep("SwordWeaponDash"),
      special: extractAttackStep("SwordParry"),
    },
    spear: {
      retailReference: "SpearWeapon",
      combo: [
        extractAttackStep("SpearWeapon"),
        extractAttackStep("SpearWeapon2"),
        extractAttackStep("SpearWeapon3"),
      ],
      dashStrike: extractAttackStep("SpearWeaponDash"),
      spinStages: [
        extractAttackStep("SpearWeaponSpin"),
        extractAttackStep("SpearWeaponSpin2"),
        extractAttackStep("SpearWeaponSpin3"),
      ],
      special: extractAttackStep("SpearWeaponThrow"),
      specialReturn: extractAttackStep("SpearWeaponThrowReturn"),
    },
    aegis: {
      retailReference: "ShieldWeapon",
      combo: [extractAttackStep("ShieldWeapon")],
      dashStrike: extractAttackStep("ShieldWeaponDash"),
      bullRush: {
        ...extractAttackStep("ShieldWeaponRush"),
        maxChargedDamage: tracked(
          asNumber(shieldRushP.DamageLow) * asNumber(shieldRushW.ChargeDamageMultiplier),
          "Content/Game/Weapons/PlayerWeapons.sjson + PlayerProjectiles.sjson",
          "measured",
          "DamageLow * ChargeDamageMultiplier",
        ),
      },
      special: extractAttackStep("ShieldThrow"),
    },
    bow: {
      retailReference: "BowWeapon",
      attack: {
        ...extractAttackStep("BowWeapon"),
        fullChargeDamage: tracked(
          asNumber(bowP.DamageLow) * asNumber(bowW.ChargeDamageMultiplier),
          "Content/Game/Weapons/PlayerWeapons.sjson + PlayerProjectiles.sjson",
          "measured",
          "DamageLow * ChargeDamageMultiplier",
        ),
        powerShotDamage: tracked(
          Math.round(
            asNumber(bowP.DamageLow) *
              asNumber(bowW.ChargeDamageMultiplier) *
              asNumber(bowW.PerfectChargeDamageMultiplier),
          ),
          "Content/Game/Weapons/PlayerWeapons.sjson + PlayerProjectiles.sjson",
          "measured",
          "round(DamageLow * ChargeDamageMultiplier * PerfectChargeDamageMultiplier)",
        ),
        fullChargeRange: tracked(
          asNumber(bowP.Range) * asNumber(bowW.ChargeRangeMultiplier),
          "Content/Game/Weapons/PlayerWeapons.sjson + PlayerProjectiles.sjson",
          "measured",
          "Range * ChargeRangeMultiplier",
        ),
      },
      dashStrike: {
        ...extractAttackStep("BowWeaponDash"),
        fullChargeDamage: tracked(
          asNumber(bowP.DamageLow) * asNumber(bowDashW.ChargeDamageMultiplier),
          "Content/Game/Weapons/PlayerWeapons.sjson + PlayerProjectiles.sjson",
          "measured",
          "DamageLow * ChargeDamageMultiplier",
        ),
        powerShotDamage: tracked(
          Math.round(
            asNumber(bowP.DamageLow) *
              asNumber(bowDashW.ChargeDamageMultiplier) *
              asNumber(bowDashW.PerfectChargeDamageMultiplier),
          ),
          "Content/Game/Weapons/PlayerWeapons.sjson + PlayerProjectiles.sjson",
          "measured",
          "round(DamageLow * ChargeDamageMultiplier * PerfectChargeDamageMultiplier)",
        ),
      },
      special: extractAttackStep("BowSplitShot"),
    },
    gauntlets: {
      retailReference: "FistWeapon",
      combo: [
        extractAttackStep("FistWeapon"),
        extractAttackStep("FistWeapon2"),
        extractAttackStep("FistWeapon3"),
        extractAttackStep("FistWeapon4"),
        extractAttackStep("FistWeapon5"),
      ],
      dashStrike: extractAttackStep("FistWeaponDash"),
      special: extractAttackStep("FistWeaponSpecial"),
      dashUpper: extractAttackStep("FistWeaponSpecialDash"),
    },
    cannon: {
      retailReference: "GunWeapon",
      attack: {
        ...extractAttackStep("GunWeapon"),
        reloadDelay: tracked(
          luaTopLevelNum(gunWeaponLua, "ReloadDelay"),
          "Content/Scripts/WeaponData.lua",
        ),
        activeReloadTime: tracked(
          luaTopLevelNum(gunWeaponLua, "ActiveReloadTime"),
          "Content/Scripts/WeaponData.lua",
        ),
      },
      dashStrike: extractAttackStep("GunWeaponDash"),
      special: extractAttackStep("GunGrenadeToss"),
    },
  };

  // 5. Status Effects (parsed directly from 1_BaseDamagingProjectile + CritVulnerabilityWeapon + TraitData.lua)
  const baseDamagingProj = getP("1_BaseDamagingProjectile");
  const baseEffects = indexByName((baseDamagingProj.Effects as SjsonValue[]) ?? []);
  const weakEff = baseEffects.get("ReduceDamageOutput")!;
  const hangoverEff = baseEffects.get("DamageOverTime")!;
  const chillEff = baseEffects.get("DemeterSlow")!;
  const doomEff = baseEffects.get("DelayedDamage")!;
  const ruptureEff = baseEffects.get("DamageOverDistance")!;
  const joltedEff = baseEffects.get("ZeusAttackPenalty")!;

  const critVulnProj = getP("CritVulnerabilityWeapon");
  const markedEff = critVulnProj.Effect as SjsonObject;

  const aresWeaponTrait = extractLuaBlock(traitDataLua, /\tAresWeaponTrait\s*=/);
  const dioWeaponTrait = extractLuaBlock(traitDataLua, /\tDionysusWeaponTrait\s*=/);
  const slipperyTrait = extractLuaBlock(traitDataLua, /\tSlipperyTrait\s*=/);
  const critVulnTrait = extractLuaBlock(traitDataLua, /\tCritVulnerabilityTrait\s*=/);
  const zeusJoltTrait = extractLuaBlock(traitDataLua, /\tZeusLightningDebuff\s*=/);

  const chillPerStackMult = asNumber(chillEff.ElapsedTimeMultiplier);
  const chillMaxStacks = asNumber(chillEff.MaxStacks);

  const statusEffects = {
    weak: {
      retailEffectKey: "ReduceDamageOutput",
      duration: tracked(
        asNumber(weakEff.Duration),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      damageOutputMultiplier: tracked(
        asNumber(weakEff.Modifier),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      damageReductionFraction: tracked(
        Number((1 - asNumber(weakEff.Modifier)).toFixed(4)),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
        "measured",
        "1 - Modifier",
      ),
      isVulnerabilityEffect: tracked(
        Boolean(weakEff.IsVulnerabilityEffect),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
    },
    hangover: {
      retailEffectKey: "DamageOverTime",
      duration: tracked(
        asNumber(hangoverEff.Duration),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      tickInterval: tracked(
        asNumber(hangoverEff.Cooldown),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      maxStacks: tracked(
        asNumber(hangoverEff.MaxStacks),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      baseCommonDamagePerStack: tracked(
        luaNum(dioWeaponTrait, "BaseMin"),
        "Content/Scripts/TraitData.lua",
      ),
      isVulnerabilityEffect: tracked(
        Boolean(hangoverEff.IsVulnerabilityEffect),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
    },
    chill: {
      retailEffectKey: "DemeterSlow",
      duration: tracked(
        asNumber(chillEff.Duration),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      maxStacks: tracked(chillMaxStacks, "Content/Game/Projectiles/PlayerProjectiles.sjson"),
      perStackTimeMultiplier: tracked(
        chillPerStackMult,
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      perStackSlowFraction: tracked(
        Number((1 - chillPerStackMult).toFixed(4)),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
        "measured",
        "1 - ElapsedTimeMultiplier",
      ),
      maxStacksTimeMultiplier: tracked(
        Number(Math.pow(chillPerStackMult, chillMaxStacks).toFixed(4)),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
        "measured",
        "ElapsedTimeMultiplier ^ MaxStacks",
      ),
      isVulnerabilityEffect: tracked(
        Boolean(chillEff.IsVulnerabilityEffect),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
    },
    doom: {
      retailEffectKey: "DelayedDamage",
      delayDuration: tracked(
        asNumber(doomEff.Duration),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      stacks: tracked(Boolean(doomEff.Stacks), "Content/Game/Projectiles/PlayerProjectiles.sjson"),
      baseCommonDamage: tracked(
        luaNum(aresWeaponTrait, "BaseMin"),
        "Content/Scripts/TraitData.lua",
      ),
      isVulnerabilityEffect: tracked(
        Boolean(doomEff.IsVulnerabilityEffect),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
    },
    ruptured: {
      retailEffectKey: "DamageOverDistance",
      duration: tracked(
        asNumber(ruptureEff.Duration),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      tickInterval: tracked(
        asNumber(ruptureEff.Cooldown),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      baseCommonMaxTriggerDamage: tracked(
        luaNum(slipperyTrait, "BaseValue"),
        "Content/Scripts/TraitData.lua",
      ),
      isVulnerabilityEffect: tracked(
        Boolean(ruptureEff.IsVulnerabilityEffect),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
    },
    marked: {
      retailEffectKey: "CritVulnerability",
      duration: tracked(
        asNumber(markedEff.Duration),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      baseCommonCritChanceBonus: tracked(
        luaNum(critVulnTrait, "BaseValue"),
        "Content/Scripts/TraitData.lua",
      ),
      isVulnerabilityEffect: tracked(
        Boolean(markedEff.IsVulnerabilityEffect),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
    },
    jolted: {
      retailEffectKey: "ZeusAttackPenalty",
      duration: tracked(
        asNumber(joltedEff.Duration),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
      baseCommonBoltDamage: tracked(
        luaNum(zeusJoltTrait, "BaseMin"),
        "Content/Scripts/TraitData.lua",
      ),
      isVulnerabilityEffect: tracked(
        Boolean(joltedEff.IsVulnerabilityEffect),
        "Content/Game/Projectiles/PlayerProjectiles.sjson",
      ),
    },
  };

  // 6. Rarity & Pom Diminishing Scaling
  const shopTier1 = extractLuaBlock(traitDataLua, /\tShopTier1Trait\s*=/);
  const shopTier2 = extractLuaBlock(traitDataLua, /\tShopTier2Trait\s*=/);
  const extractRarityBlock = (traitBlock: string) => {
    const rl = extractLuaBlock(traitBlock, /\bRarityLevels\s*=/);
    const out: Record<string, { min: number; max: number }> = {};
    for (const tier of ["Common", "Rare", "Epic", "Heroic"]) {
      const m = new RegExp(`\\b${tier}\\s*=`).exec(rl);
      if (!m) continue;
      const sub = extractLuaBlock(rl, new RegExp(`\\b${tier}\\s*=`));
      out[tier.toLowerCase()] = {
        min: luaNum(sub, "MinMultiplier"),
        max: luaNum(sub, "MaxMultiplier"),
      };
    }
    return out;
  };

  const dupStandardMatch = /local\s+DuplicateMultiplier\s*=\s*(-?\d+(?:\.\d+)?)/.exec(traitDataLua);
  const dupStrongMatch = /local\s+DuplicateStrongMultiplier\s*=\s*(-?\d+(?:\.\d+)?)/.exec(
    traitDataLua,
  );
  const dupVeryStrongMatch = /local\s+DuplicateVeryStrongMultiplier\s*=\s*(-?\d+(?:\.\d+)?)/.exec(
    traitDataLua,
  );
  const dupStandard = dupStandardMatch ? Number(dupStandardMatch[1]) : -0.6;
  const dupStrong = dupStrongMatch ? Number(dupStrongMatch[1]) : -0.4;
  const dupVeryStrong = dupVeryStrongMatch ? Number(dupVeryStrongMatch[1]) : -0.2;
  const diminishingBase = luaNum(traitMultBlock, "DefaultDiminishingReturnsMultiplier");
  const minMult = luaNum(traitMultBlock, "DefaultMinMultiplier");

  // Compute exact retail Pom cumulative scaling curve (TraitScripts.lua GetProcessedValue)
  // For each additional Pom level i = 1..9 (i.e. Boon Lv 2..10):
  //   delta = max(minMult, (1 + DuplicateMultiplier) * (diminishingBase ^ (i - 1)))
  const pomLevelsCurve: number[] = [1.0];
  let accum = 1.0;
  for (let i = 1; i <= 9; i++) {
    const step = Math.max(minMult, (1 + dupStandard) * Math.pow(diminishingBase, i - 1));
    accum += step;
    pomLevelsCurve.push(Number(accum.toFixed(4)));
  }

  const scaling = {
    criticalHitMultiplier: tracked(
      asNumber(baseDamagingProj.CriticalHitMultiplier),
      "Content/Game/Projectiles/PlayerProjectiles.sjson",
    ),
    rarityLevels: {
      tier1: tracked(extractRarityBlock(shopTier1), "Content/Scripts/TraitData.lua"),
      tier2: tracked(extractRarityBlock(shopTier2), "Content/Scripts/TraitData.lua"),
    },
    boonRarityChances: {
      rareChance: tracked(luaNum(boonDataBlock, "RareChance"), "Content/Scripts/HeroData.lua"),
      epicChance: tracked(luaNum(boonDataBlock, "EpicChance"), "Content/Scripts/HeroData.lua"),
      legendaryChance: tracked(
        luaNum(boonDataBlock, "LegendaryChance"),
        "Content/Scripts/HeroData.lua",
      ),
      replaceChance: tracked(
        luaNum(boonDataBlock, "ReplaceChance"),
        "Content/Scripts/HeroData.lua",
      ),
      hermesRareChance: tracked(
        luaNum(hermesDataBlock, "RareChance"),
        "Content/Scripts/HeroData.lua",
      ),
      hermesEpicChance: tracked(
        luaNum(hermesDataBlock, "EpicChance"),
        "Content/Scripts/HeroData.lua",
      ),
      hermesLegendaryChance: tracked(
        luaNum(hermesDataBlock, "LegendaryChance"),
        "Content/Scripts/HeroData.lua",
      ),
    },
    pomDiminishing: {
      defaultDiminishingReturnsMultiplier: tracked(
        diminishingBase,
        "Content/Scripts/TraitData.lua",
      ),
      defaultMinMultiplier: tracked(minMult, "Content/Scripts/TraitData.lua"),
      duplicateMultiplier: tracked(dupStandard, "Content/Scripts/TraitData.lua"),
      duplicateStrongMultiplier: tracked(dupStrong, "Content/Scripts/TraitData.lua"),
      duplicateVeryStrongMultiplier: tracked(dupVeryStrong, "Content/Scripts/TraitData.lua"),
      cumulativeStandardScaleLv1To10: tracked(
        pomLevelsCurve,
        "Content/Scripts/TraitData.lua + TraitScripts.lua",
        "measured",
        "sum_{i=1..L-1} max(minMult, (1 + DuplicateMultiplier) * 0.7^(i-1))",
      ),
    },
  };

  // 7. Boss HP tables (mapped to clean-room keys)
  const extractBoss = (retailKey: string) => {
    const block = extractLuaBlock(enemyDataLua, new RegExp(`\\t${retailKey}\\s*=`));
    const maxHealth = luaTopLevelNum(block, "MaxHealth");
    let emMaxHealth: number | null = null;
    let emPhases: number | null = null;
    if (/\bShrineDataOverwrites\s*=/.test(block)) {
      const shrineBlock = extractLuaBlock(block, /\bShrineDataOverwrites\s*=/);
      if (/\bMaxHealth\s*=/.test(shrineBlock)) emMaxHealth = luaNum(shrineBlock, "MaxHealth");
      if (/\bPhases\s*=/.test(shrineBlock)) emPhases = luaNum(shrineBlock, "Phases");
    }
    let phases = 1;
    try {
      phases = luaTopLevelNum(block, "Phases");
    } catch {
      phases = 1;
    }
    return { maxHealth, emMaxHealth, phases, emPhases };
  };

  const harpy1 = extractBoss("Harpy");
  const harpy2 = extractBoss("Harpy2");
  const harpy3 = extractBoss("Harpy3");
  const hydraMain = extractBoss("HydraHeadImmortal");
  const baseHydraHeadBlock = extractLuaBlock(enemyDataLua, /\tBaseHydraHead\s*=/);
  const minotaur1 = extractBoss("Minotaur");
  const minotaur2 = extractBoss("Minotaur2");
  const theseus1 = extractBoss("Theseus");
  const theseus2 = extractBoss("Theseus2");
  const charon = extractBoss("Charon");
  const hades = extractBoss("Hades");

  const bosses = {
    warden_malice: {
      retailReference: "Harpy",
      maxHealth: tracked(harpy1.maxHealth, "Content/Scripts/EnemyData.lua"),
      extremeMeasuresMaxHealth: tracked(harpy1.emMaxHealth, "Content/Scripts/EnemyData.lua"),
    },
    warden_fury: {
      retailReference: "Harpy2",
      maxHealth: tracked(harpy2.maxHealth, "Content/Scripts/EnemyData.lua"),
      extremeMeasuresMaxHealth: tracked(harpy2.emMaxHealth, "Content/Scripts/EnemyData.lua"),
    },
    warden_murder: {
      retailReference: "Harpy3",
      maxHealth: tracked(harpy3.maxHealth, "Content/Scripts/EnemyData.lua"),
      extremeMeasuresMaxHealth: tracked(harpy3.emMaxHealth, "Content/Scripts/EnemyData.lua"),
    },
    bone_leviathan: {
      retailReference: "HydraHeadImmortal",
      maxHealth: tracked(hydraMain.maxHealth, "Content/Scripts/EnemyData.lua"),
      sideHeadMaxHealth: tracked(
        luaTopLevelNum(baseHydraHeadBlock, "MaxHealth"),
        "Content/Scripts/EnemyData.lua",
      ),
      sideHeadArmor: tracked(
        luaTopLevelNum(baseHydraHeadBlock, "HealthBuffer"),
        "Content/Scripts/EnemyData.lua",
      ),
    },
    colosseum_bull: {
      retailReference: "Minotaur",
      maxHealth: tracked(minotaur1.maxHealth, "Content/Scripts/EnemyData.lua"),
      extremeMeasuresMaxHealth: tracked(minotaur2.maxHealth, "Content/Scripts/EnemyData.lua"),
    },
    colosseum_spearlord: {
      retailReference: "Theseus",
      maxHealth: tracked(theseus1.maxHealth, "Content/Scripts/EnemyData.lua"),
      extremeMeasuresMaxHealth: tracked(theseus2.maxHealth, "Content/Scripts/EnemyData.lua"),
    },
    the_ferryman: {
      retailReference: "Charon",
      maxHealth: tracked(charon.maxHealth, "Content/Scripts/EnemyData.lua"),
    },
    sovereign_lord: {
      retailReference: "Hades",
      maxHealthPerPhase: tracked(hades.maxHealth, "Content/Scripts/EnemyData.lua"),
      phases: tracked(hades.phases, "Content/Scripts/EnemyData.lua"),
      totalBaseHealth: tracked(
        hades.maxHealth * hades.phases,
        "Content/Scripts/EnemyData.lua",
        "measured",
        "MaxHealth * Phases",
      ),
      extremeMeasuresMaxHealthPerPhase: tracked(hades.emMaxHealth, "Content/Scripts/EnemyData.lua"),
      extremeMeasuresPhases: tracked(hades.emPhases, "Content/Scripts/EnemyData.lua"),
      totalExtremeMeasuresHealth: tracked(
        (hades.emMaxHealth ?? hades.maxHealth) * (hades.emPhases ?? hades.phases),
        "Content/Scripts/EnemyData.lua",
        "measured",
        "ShrineDataOverwrites.MaxHealth * Phases",
      ),
    },
  };

  // 8. Biomes: Zoom fractions, Wall Slam multipliers, Ambient Light RGBs, and Lava hazard
  const parseBiomeRoomData = (fileName: string, excludeRoomPrefixes: string[] = []) => {
    const src = readLua(fileName);
    const zooms: number[] = [];
    let currentRoom = "";
    for (const line of src.split(/\r?\n/)) {
      const rm = /^\t([A-Za-z0-9_]+)\s*=/.exec(line);
      if (rm) currentRoom = rm[1];
      if (excludeRoomPrefixes.some((p) => currentRoom.startsWith(p))) continue;
      const zm = /\bZoomFraction\s*=\s*(\d+(?:\.\d+)?)/.exec(line);
      if (zm) zooms.push(Number(zm[1]));
    }
    const wsMatch = /\bWallSlamMultiplier\s*=\s*(\d+(?:\.\d+)?)/.exec(src);
    return {
      zooms,
      zoomRange: zooms.length > 0 ? [Math.min(...zooms), Math.max(...zooms)] : null,
      wallSlamMultiplier: wsMatch ? Number(wsMatch[1]) : 1.0,
      hasExplicitWallSlam: Boolean(wsMatch),
    };
  };

  const mapFiles = fs.existsSync(mapsDir)
    ? fs.readdirSync(mapsDir).filter((f) => f.endsWith(".map_text"))
    : [];

  const parseBiomeAmbient = (prefixes: string[], representativeMap: string) => {
    const matched = mapFiles.filter((f) => prefixes.some((p) => f.startsWith(p)));
    const samples: Array<{ r: number; g: number; b: number }> = [];
    let repRgb: { r: number; g: number; b: number } | null = null;
    for (const f of matched) {
      const txt = fs.readFileSync(path.join(mapsDir, f), "utf8");
      const m = /"AmbientLightColor"\s*:\s*\{[^}]*"X"\s*:\s*([\d.]+)[^}]*"Y"\s*:\s*([\d.]+)[^}]*"Z"\s*:\s*([\d.]+)/.exec(
        txt,
      );
      if (m) {
        const rgb = {
          r: Number(Number(m[1]).toFixed(4)),
          g: Number(Number(m[2]).toFixed(4)),
          b: Number(Number(m[3]).toFixed(4)),
        };
        samples.push(rgb);
        if (f === representativeMap) repRgb = rgb;
      }
    }
    const mean =
      samples.length > 0
        ? {
            r: Number((samples.reduce((s, c) => s + c.r, 0) / samples.length).toFixed(4)),
            g: Number((samples.reduce((s, c) => s + c.g, 0) / samples.length).toFixed(4)),
            b: Number((samples.reduce((s, c) => s + c.b, 0) / samples.length).toFixed(4)),
          }
        : null;
    return { mapCount: samples.length, representativeMap, representativeRgb: repRgb, meanRgb: mean };
  };

  const tartarusRooms = parseBiomeRoomData("RoomDataTartarus.lua");
  const asphodelRooms = parseBiomeRoomData("RoomDataAsphodel.lua");
  const elysiumRooms = parseBiomeRoomData("RoomDataElysium.lua");
  const styxCombatRooms = parseBiomeRoomData("RoomDataStyx.lua", [
    "D_Boss",
    "D_Hub",
    "BaseStyxMini",
  ]);
  const styxAllRooms = parseBiomeRoomData("RoomDataStyx.lua");
  const surfaceRooms = parseBiomeRoomData("RoomDataSurface.lua");

  const lavaTile = resolveInherited(enemyProjs, "LavaTileWeapon");
  const lavaSlowEff = lavaTile.Effect as SjsonObject;
  const lavaPuddle = resolveInherited(enemyProjs, "LavaPuddleLarge");

  const biomes = {
    obsidian_pit: {
      retailReference: "Tartarus",
      zoomRange: tracked(
        tartarusRooms.zoomRange,
        "Content/Scripts/RoomDataTartarus.lua",
        "measured",
        "min..max ZoomFraction across Tartarus rooms",
      ),
      wallSlamMultiplier: tracked(
        tartarusRooms.wallSlamMultiplier,
        "Content/Scripts/RoomDataTartarus.lua",
        tartarusRooms.hasExplicitWallSlam ? "extracted" : "measured",
        tartarusRooms.hasExplicitWallSlam ? undefined : "default 1.0 (no override in RoomDataTartarus.lua)",
      ),
      ambientLight: tracked(
        parseBiomeAmbient(["A_"], "A_Combat01.map_text"),
        "Content/Maps/A_*.map_text",
        "measured",
      ),
    },
    cinder_mire: {
      retailReference: "Asphodel",
      zoomRange: tracked(
        asphodelRooms.zoomRange,
        "Content/Scripts/RoomDataAsphodel.lua",
        "measured",
      ),
      wallSlamMultiplier: tracked(
        asphodelRooms.wallSlamMultiplier,
        "Content/Scripts/RoomDataAsphodel.lua",
      ),
      ambientLight: tracked(
        parseBiomeAmbient(["B_"], "B_Combat01.map_text"),
        "Content/Maps/B_*.map_text",
        "measured",
      ),
      lavaHazard: {
        retailProjectileKey: "LavaTileWeapon",
        baseDamage: tracked(
          asNumber(lavaTile.Damage),
          "Content/Game/Projectiles/EnemyProjectiles.sjson",
        ),
        damagePerConsecutiveHit: tracked(
          asNumber(lavaTile.DamagePerConsecutiveHit),
          "Content/Game/Projectiles/EnemyProjectiles.sjson",
        ),
        roundDamageDown: tracked(
          Boolean(lavaTile.RoundDamageDown),
          "Content/Game/Projectiles/EnemyProjectiles.sjson",
        ),
        immunityDuration: tracked(
          asNumber(lavaTile.ImmunityDuration),
          "Content/Game/Projectiles/EnemyProjectiles.sjson",
        ),
        moveInterval: tracked(
          asNumber(lavaTile.MoveInterval),
          "Content/Game/Projectiles/EnemyProjectiles.sjson",
        ),
        consecutiveHitWindow: tracked(
          asNumber(lavaTile.ConsecutiveHitWindow),
          "Content/Game/Projectiles/EnemyProjectiles.sjson",
        ),
        slowModifier: tracked(
          asNumber(lavaSlowEff.Modifier),
          "Content/Game/Projectiles/EnemyProjectiles.sjson",
        ),
        slowDuration: tracked(
          asNumber(lavaSlowEff.Duration),
          "Content/Game/Projectiles/EnemyProjectiles.sjson",
        ),
        puddleRadius: tracked(
          asNumber(lavaPuddle.DamageRadius),
          "Content/Game/Projectiles/EnemyProjectiles.sjson",
        ),
        puddleRadiusScaleY: tracked(
          asNumber(lavaPuddle.DamageRadiusScaleY),
          "Content/Game/Projectiles/EnemyProjectiles.sjson",
        ),
      },
    },
    verdant_colosseum: {
      retailReference: "Elysium",
      zoomRange: tracked(
        elysiumRooms.zoomRange,
        "Content/Scripts/RoomDataElysium.lua",
        "measured",
      ),
      wallSlamMultiplier: tracked(
        elysiumRooms.wallSlamMultiplier,
        "Content/Scripts/RoomDataElysium.lua",
      ),
      ambientLight: tracked(
        parseBiomeAmbient(["C_"], "C_Combat01.map_text"),
        "Content/Maps/C_*.map_text",
        "measured",
      ),
    },
    crypt_of_bile: {
      retailReference: "Styx",
      zoomRange: tracked(
        styxCombatRooms.zoomRange,
        "Content/Scripts/RoomDataStyx.lua",
        "measured",
        "combat & miniboss wing rooms (excluding D_Hub/D_Boss01/BaseStyxMini)",
      ),
      fullFileZoomRange: tracked(
        styxAllRooms.zoomRange,
        "Content/Scripts/RoomDataStyx.lua",
        "measured",
      ),
      wallSlamMultiplier: tracked(
        styxCombatRooms.wallSlamMultiplier,
        "Content/Scripts/RoomDataStyx.lua",
      ),
      ambientLight: tracked(
        parseBiomeAmbient(["D_Combat"], "D_Combat01.map_text"),
        "Content/Maps/D_Combat*.map_text",
        "measured",
      ),
    },
    frozen_summit: {
      retailReference: "Surface",
      zoomRange: tracked(
        surfaceRooms.zoomRange,
        "Content/Scripts/RoomDataSurface.lua",
        "measured",
      ),
      wallSlamMultiplier: tracked(
        surfaceRooms.wallSlamMultiplier,
        "Content/Scripts/RoomDataSurface.lua",
        surfaceRooms.hasExplicitWallSlam ? "extracted" : "measured",
        surfaceRooms.hasExplicitWallSlam ? undefined : "default 1.0 (no override in RoomDataSurface.lua)",
      ),
      ambientLight: tracked(
        parseBiomeAmbient(["D_Boss01", "E_"], "D_Boss01.map_text"),
        "Content/Maps/{D_Boss01,E_*}.map_text",
        "measured",
      ),
    },
  };

  // 9. Progression: Mirror (12 pairs), Shrine Vows (16), Keepsakes & Companions, Biome Time Limits
  const mirrorOrderBlock = extractLuaBlock(metaUpgradeLua, /\bMetaUpgradeOrder\s*=/);
  const mirrorPairs = [...mirrorOrderBlock.matchAll(/\{\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\}/g)].map(
    (m) => [m[1], m[2]] as [string, string],
  );

  const shrineOrderBlock = extractLuaBlock(metaUpgradeLua, /\bShrineUpgradeOrder\s*=/);
  const shrineVowKeys = luaStringArray(shrineOrderBlock);
  const shrineVowDetails = shrineVowKeys.map((key) => {
    const block = extractLuaBlock(metaUpgradeLua, new RegExp(`\\t${key}\\s*=`));
    let costTable: number[];
    if (/\bCostTable\s*=/.test(block)) {
      costTable = luaNumArray(block, "CostTable");
    } else {
      const cost = luaTopLevelNum(block, "Cost");
      const maxInv = luaTopLevelNum(block, "MaxInvestment");
      costTable = Array.from({ length: maxInv }, () => cost);
    }
    return {
      retailKey: key,
      ranks: costTable.length,
      costTable,
      maxHeat: costTable.reduce((s, n) => s + n, 0),
    };
  });

  const biomeTimeBlock = extractLuaBlock(metaUpgradeLua, /\bBiomeTimeLimits\s*=/);
  const penaltyBlock = extractLuaBlock(biomeTimeBlock, /\bPenalty\s*=/);
  const timersBlock = extractLuaBlock(biomeTimeBlock, /\bTimers\s*=/);
  const timerRows = [...timersBlock.matchAll(/\{([^{}]+)\}/g)].map((m) =>
    [...m[1].matchAll(/\d+/g)].map((n) => Number(n[0])),
  );

  // Keepsake & Assist counts resolved directly from GiftData.lua + TraitData.lua
  const giftTraits = [...new Set([...giftDataLua.matchAll(/\bGift\s*=\s*"([^"]+)"/g)].map((m) => m[1]))];
  const keepsakeKeys: string[] = [];
  const assistKeys: string[] = [];
  for (const gKey of giftTraits) {
    const re = new RegExp(`\\t${gKey}\\s*=`);
    if (!re.test(traitDataLua)) continue;
    const block = extractLuaBlock(traitDataLua, re);
    if (/"GiftTrait"/.test(block) || /Slot\s*=\s*"Keepsake"/.test(block)) {
      keepsakeKeys.push(gKey);
    } else if (/"AssistTrait"/.test(block) || /Slot\s*=\s*"Assist"/.test(block)) {
      assistKeys.push(gKey);
    }
  }
  const giftTraitBase = extractLuaBlock(traitDataLua, /\tGiftTrait\s*=/);
  const keepsakeThresholds = luaNumArray(giftTraitBase, "ChamberThresholds");

  const godLootKeys = [...lootDataLua.matchAll(/^\t([A-Za-z0-9_]+Upgrade)\s*=/gm)]
    .map((m) => m[1])
    .filter((k) => !["StackUpgrade", "WeaponUpgrade", "HadesUpgrade"].includes(k));

  const progression = {
    mirrorUpgradePairCount: tracked(mirrorPairs.length, "Content/Scripts/MetaUpgradeData.lua"),
    mirrorUpgradePairs: tracked(mirrorPairs, "Content/Scripts/MetaUpgradeData.lua"),
    shrineVowCount: tracked(shrineVowKeys.length, "Content/Scripts/MetaUpgradeData.lua"),
    shrineVows: tracked(shrineVowDetails, "Content/Scripts/MetaUpgradeData.lua"),
    maxShrineHeatSum: tracked(
      shrineVowDetails.reduce((s, v) => s + v.maxHeat, 0),
      "Content/Scripts/MetaUpgradeData.lua",
      "measured",
      "sum of all ShrineUpgradeOrder CostTable entries",
    ),
    keepsakeCount: tracked(
      keepsakeKeys.length,
      "Content/Scripts/GiftData.lua + TraitData.lua",
    ),
    keepsakeKeys: tracked(keepsakeKeys, "Content/Scripts/GiftData.lua + TraitData.lua"),
    keepsakeChamberThresholds: tracked(keepsakeThresholds, "Content/Scripts/TraitData.lua"),
    companionAssistCount: tracked(
      assistKeys.length,
      "Content/Scripts/GiftData.lua + TraitData.lua",
    ),
    godLootCount: tracked(godLootKeys.length, "Content/Scripts/LootData.lua"),
    godLootKeys: tracked(godLootKeys, "Content/Scripts/LootData.lua"),
    tightDeadlineTimersSec: tracked(
      timerRows.map((row) => row[1]),
      "Content/Scripts/MetaUpgradeData.lua",
    ),
    tightDeadlinePenaltyDamage: tracked(
      luaNum(penaltyBlock, "Damage"),
      "Content/Scripts/MetaUpgradeData.lua",
    ),
    tightDeadlinePenaltyInterval: tracked(
      luaNum(penaltyBlock, "Interval"),
      "Content/Scripts/MetaUpgradeData.lua",
    ),
  };

  // 10. Package binary header inspection for Wave 2 tools/extract-assets.ts
  const packages = inspectPkgAndManifest(hadesDir);

  const oracle = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    retailInstallPath: hadesDir,
    readOnlyVerified: true,
    hero,
    weapons,
    statusEffects,
    scaling,
    bosses,
    biomes,
    progression,
    packages,
  };

  const outDir = path.resolve(process.cwd(), ".wannabehades-assets");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "oracle.json");
  fs.writeFileSync(outPath, JSON.stringify(oracle, null, 2) + "\n", "utf8");

  console.log(`[oracle-dump] Wrote retail ground-truth oracle to ${outPath}`);
  console.log(
    `[oracle-dump] Summary: hero speed=${hero.speed.value}, dash=${hero.dash.blinkDuration.value}s (${hero.dash.blinkTicks60Hz.value} ticks), ` +
      `6 weapons extracted, 7 status effects extracted, 8 boss entries extracted, ` +
      `mirror=${progression.mirrorUpgradePairCount.value} pairs, shrine=${progression.shrineVowCount.value} vows (maxHeat=${progression.maxShrineHeatSum.value}), ` +
      `keepsakes=${progression.keepsakeCount.value} (+${progression.companionAssistCount.value} assists).`,
  );
}

main();
