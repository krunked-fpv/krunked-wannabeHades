/**
 * AssetRegistry — Pure Clean-Room Dual-Mode Asset Registry for Krunked WannabeHades.
 *
 * Isolates all optional retail-compat sprite key mappings behind clean-room Krunked
 * asset IDs so user-facing UI NEVER exposes external IP or retail character names.
 *
 * 100% pure TypeScript with ZERO required DOM runtime dependencies: safely importable
 * in both Browser rendering (`GameRenderer` / `GameApp`) and pure Node verification
 * (`scripts/verify/verify-assets.ts`).
 */

export type PackMode = 'BUILTIN' | 'CUSTOM_PACK';

export const CUSTOM_PACK_SCHEMA_VERSION = 1 as const;

export interface CustomPackSheetSpec {
  readonly id: string;
  readonly file: string;
  readonly width: number;
  readonly height: number;
}

export interface CustomPackSpriteRect {
  readonly sheet: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly anchorX?: number;
  readonly anchorY?: number;
}

export interface CustomPackManifest {
  readonly schemaVersion: 1;
  readonly source: string;
  readonly generatedAt: string;
  readonly sheets: readonly CustomPackSheetSpec[];
  readonly sprites: Readonly<Record<string, CustomPackSpriteRect>>;
}

export type CustomPackOrigin = 'local-dev' | 'folder-picker' | 'indexeddb' | 'memory';

export interface CustomPackHandle {
  readonly manifest: CustomPackManifest;
  readonly origin?: CustomPackOrigin;
  readonly sheets: ReadonlyMap<string, CanvasImageSource>;
  dispose?(): void;
}

export interface ResolvedCustomSprite {
  readonly cleanId: string;
  readonly sheetId: string;
  readonly image: CanvasImageSource;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly sheetWidth: number;
  readonly sheetHeight: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

export interface PackManifestSummary {
  readonly mode: PackMode;
  readonly hasCustomPack: boolean;
  readonly active: boolean;
  readonly source: string | null;
  readonly origin: CustomPackOrigin | null;
  readonly generatedAt: string | null;
  readonly sheetCount: number;
  readonly spriteCount: number;
  readonly matchedBuiltinSpriteCount: number;
  /** Strictly clean-room label safe to render in Title/Options UI. */
  readonly label: string;
}

export interface ManifestVerificationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly sheetCount: number;
  readonly spriteCount: number;
  readonly matchedCleanKeys: readonly string[];
  readonly missingRecommendedKeys: readonly string[];
}

// ============================================================================
// Clean-Room Canonical Sprite Keys & Isolated Fallback/Compat Table
// ============================================================================

/**
 * Clean-room sprite keys aligned with ProceduralInkCelAtlas & ProceduralPortraits.
 */
export const RECOMMENDED_CUSTOM_PACK_KEYS: readonly string[] = [
  // Biome isometric floor tiles
  'tile_sanctum_a',
  'tile_sanctum_b',
  'tile_obsidian_a',
  'tile_obsidian_b',
  'tile_cinder_a',
  'tile_verdant_a',
  'tile_crypt_a',
  'tile_summit_a',
  // Architectural props
  'prop_pillar_obsidian',
  'prop_pillar_sanctum',
  'prop_statue',
  'prop_brazier',
  'prop_urn',
  'prop_exit_door_locked',
  'prop_exit_door_open',
  // 6 Infernal Arms
  'weapon_stygian_blade',
  'weapon_eternal_spear',
  'weapon_shield_of_chaos',
  'weapon_heart_seeking_bow',
  'weapon_twin_fists',
  'weapon_adamant_rail',
  // 10 Patron Sigils
  'sigil_voltaris',
  'sigil_tidebreaker',
  'sigil_aegira',
  'sigil_velouris',
  'sigil_sylvara',
  'sigil_bellum',
  'sigil_bacchion',
  'sigil_glaciera',
  'sigil_veloce',
  'sigil_abyssos',
  // Pickups & VFX
  'vfx_boon_orb',
  'vfx_centaur_heart',
  'vfx_gold_coin',
  'vfx_darkness_orb',
  'vfx_pom_icon',
  'vfx_hammer_icon',
  'vfx_shop_purse',
  'vfx_gemstone',
  'vfx_key',
  'vfx_nectar',
  'vfx_lightning_bolt',
  'vfx_wave_crest',
  'vfx_spark_burst',
  'vfx_glow_soft',
  // Portraits (10 Patrons + Hero + Key Bosses)
  'portrait_voltaris',
  'portrait_tidebreaker',
  'portrait_aegira',
  'portrait_velouris',
  'portrait_sylvara',
  'portrait_bellum',
  'portrait_bacchion',
  'portrait_glaciera',
  'portrait_veloce',
  'portrait_abyssos',
  'portrait_prince_pyreus',
  'portrait_warden_malice',
  'portrait_sovereign_lord',
];

const RECOMMENDED_KEY_SET: ReadonlySet<string> = new Set(RECOMMENDED_CUSTOM_PACK_KEYS);

/**
 * Clean-room fallback chains so partial custom packs seamlessly share related sprites
 * before falling back to Built-In Ink-Cel art.
 */
const CLEAN_FALLBACK_ALIASES: Readonly<Record<string, readonly string[]>> = {
  tile_sanctum_mosaic: ['tile_sanctum_b', 'tile_sanctum_a'],
  tile_obsidian_cracked: ['tile_obsidian_b', 'tile_obsidian_a'],
  tile_obsidian_mosaic: ['tile_obsidian_a'],
  prop_exit_door_open: ['prop_exit_door_locked'],
  prop_pillar_sanctum: ['prop_pillar_obsidian'],
  hero_diag_down: ['hero_down'],
  hero_diag_up: ['hero_up'],
  boss_warden_fury: ['boss_warden_malice'],
  boss_warden_murder: ['boss_warden_malice'],
  portrait_warden_fury: ['portrait_warden_malice'],
  portrait_warden_murder: ['portrait_warden_malice'],
  vfx_glow_star: ['vfx_glow_soft', 'vfx_spark_burst'],
  vfx_ring_soft: ['vfx_glow_soft'],
};

/**
 * Isolated internal retail-compat path aliases used ONLY when inspecting an external
 * user-supplied custom pack that uses raw sub-atlas names instead of clean-room keys.
 * NEVER surfaced in any UI string, toast, summary, or error message.
 */
const INTERNAL_COMPAT_SPRITE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  tile_sanctum_a: ['Tilesets\\House\\House_TerrainTile_01'],
  tile_sanctum_b: ['Tilesets\\House\\House_TerrainTile_04'],
  tile_sanctum_mosaic: ['Tilesets\\House\\House_TerrainTile_03'],
  tile_obsidian_a: ['Tilesets\\Tartarus\\Tartarus_BlankIsoTile_01'],
  tile_obsidian_b: ['Tilesets\\Tartarus\\Tartarus_Terrain_BrickSquare_01'],
  tile_obsidian_cracked: ['Tilesets\\Tartarus\\Tartarus_Terrain_Brick_07'],
  tile_cinder_a: ['Tilesets\\Asphodel\\Asphodel_IntroTile_01'],
  tile_verdant_a: ['Tilesets\\Elysium\\Elysium_Terrain_Moss_Tile_01b'],
  tile_crypt_a: ['Tilesets\\Travel\\Travel_CharonTerrain_Tile_01'],
  tile_summit_a: ['Tilesets\\Surface\\Surface_BaseTile_01'],
  prop_pillar_obsidian: ['Tilesets\\Tartarus\\Tartarus_PillarDecorative_01'],
  prop_pillar_sanctum: ['Tilesets\\House\\House_Pillar_01'],
  prop_statue: ['Tilesets\\Tartarus\\Tartarus_Statue_Cyclops_01'],
  prop_brazier: ['Tilesets\\Tartarus\\Tartarus_Brazier_03'],
  prop_urn: ['Tilesets\\Tartarus\\Tartarus_Urn_01', 'Tilesets\\Elysium\\Elysium_Urn_01'],
  prop_exit_door_locked: ['Tilesets\\Tartarus\\Tartarus_Door_03'],
  sigil_voltaris: ['GUI\\HUD\\BoonIconZeus', 'GUI\\Icons\\RoomReward\\Zeus'],
  sigil_tidebreaker: ['GUI\\HUD\\BoonIconPoseidon', 'GUI\\Icons\\RoomReward\\Poseidon'],
  sigil_aegira: ['GUI\\HUD\\BoonIconAthena', 'GUI\\Icons\\RoomReward\\Athena'],
  sigil_velouris: ['GUI\\HUD\\BoonIconAphrodite', 'GUI\\Icons\\RoomReward\\Aphrodite'],
  sigil_sylvara: ['GUI\\HUD\\BoonIconArtemis', 'GUI\\Icons\\RoomReward\\Artemis'],
  sigil_bellum: ['GUI\\HUD\\BoonIconAres', 'GUI\\Icons\\RoomReward\\Ares'],
  sigil_bacchion: ['GUI\\HUD\\BoonIconDionysus', 'GUI\\Icons\\RoomReward\\Dionysus'],
  sigil_glaciera: ['GUI\\HUD\\BoonIconDemeter', 'GUI\\Icons\\RoomReward\\Demeter'],
  sigil_veloce: ['GUI\\Icons\\RoomReward\\Hermes'],
  sigil_abyssos: ['GUI\\Icons\\RoomReward\\Chaos'],
  vfx_boon_orb: ['GUI\\Icons\\Boon', 'GUI\\Icons\\Loot_Small'],
  vfx_centaur_heart: ['GUI\\Icons\\RoomReward\\Health_01'],
  vfx_gold_coin: ['GUI\\Icons\\Currency', 'GUI\\Icons\\Currency_Small'],
  vfx_darkness_orb: ['GUI\\Icons\\Darkness', 'GUI\\Icons\\RoomReward\\Darkness'],
  vfx_pom_icon: ['GUI\\Icons\\Pom_Small'],
  vfx_hammer_icon: ['GUI\\Icons\\Hammer_Small', 'GUI\\Icons\\RoomReward\\Hammer_01'],
  vfx_shop_purse: ['GUI\\Icons\\RoomReward\\Shop'],
  vfx_gemstone: ['GUI\\Icons\\Gems', 'GUI\\Icons\\Gems_Small'],
  vfx_key: ['GUI\\Icons\\LockKey', 'GUI\\Icons\\RoomReward\\Key_01'],
  vfx_nectar: ['GUI\\Icons\\Gift', 'GUI\\Icons\\Gift_Small'],
  portrait_voltaris: ['Portraits\\Portraits_Zeus_01'],
  portrait_tidebreaker: ['Portraits\\Portraits_Poseidon_01'],
  portrait_aegira: ['Portraits\\Portraits_Athena_01'],
  portrait_velouris: ['Portraits\\Portraits_Aphrodite_01'],
  portrait_sylvara: ['Portraits\\Portraits_Artemis_01'],
  portrait_bellum: ['Portraits\\Portraits_Ares_01'],
  portrait_bacchion: ['Portraits\\Portraits_Dionysus_01'],
  portrait_glaciera: ['Portraits\\Portraits_Demeter_01'],
  portrait_veloce: ['Portraits\\Portraits_Hermes_01'],
  portrait_abyssos: ['Portraits\\Portraits_Chaos_01'],
  portrait_prince_pyreus: ['Portraits\\Portraits_Zagreus_01'],
  portrait_warden_malice: ['Portraits\\Portraits_Megaera_01'],
  portrait_warden_fury: ['Portraits\\Portraits_Alecto_01'],
  portrait_warden_murder: ['Portraits\\Portraits_Tisiphone_01'],
  portrait_colosseum_bull: ['Portraits\\Portraits_Minotaur_01'],
  portrait_colosseum_spearlord: ['Portraits\\Portraits_Theseus_01'],
  portrait_the_ferryman: ['Portraits\\Portraits_Charon_01'],
  portrait_sovereign_lord: ['Portraits\\Portraits_Hades_01'],
};

const DEFAULT_ANCHORS: Readonly<Record<string, readonly [number, number]>> = {
  prop_pillar_obsidian: [0.5, 0.86],
  prop_pillar_sanctum: [0.5, 0.86],
  prop_statue: [0.5, 0.86],
  prop_exit_door_locked: [0.5, 0.85],
  prop_exit_door_open: [0.5, 0.85],
  prop_brazier: [0.5, 0.82],
  prop_urn: [0.5, 0.84],
};

function isFinitePositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && Math.floor(value) === value;
}

function isFiniteNonNegInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && Math.floor(value) === value;
}

function normalizeSheetKey(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

/**
 * Pure Node-safe getter for recommended clean-room custom pack keys.
 */
export function getRecommendedCustomPackKeys(): readonly string[] {
  return RECOMMENDED_CUSTOM_PACK_KEYS;
}

/**
 * Pure Node-safe structural & bounds verifier for any custom pack `manifest.json`.
 */
export function verifyCustomPackManifest(raw: unknown): ManifestVerificationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const matchedCleanKeys: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      errors: ['Manifest must be a JSON object.'],
      warnings,
      sheetCount: 0,
      spriteCount: 0,
      matchedCleanKeys,
      missingRecommendedKeys: [...RECOMMENDED_CUSTOM_PACK_KEYS],
    };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== CUSTOM_PACK_SCHEMA_VERSION) {
    errors.push(
      `Unsupported manifest schemaVersion "${String(obj.schemaVersion)}" (expected ${CUSTOM_PACK_SCHEMA_VERSION}).`
    );
  }
  if (typeof obj.source !== 'string' || obj.source.trim().length === 0) {
    errors.push('Manifest "source" must be a non-empty string.');
  }
  if (typeof obj.generatedAt !== 'string' || obj.generatedAt.trim().length === 0) {
    warnings.push('Manifest "generatedAt" is missing or empty.');
  }

  if (!Array.isArray(obj.sheets) || obj.sheets.length === 0) {
    errors.push('Manifest "sheets" must be a non-empty array.');
  }

  const sheetById = new Map<string, CustomPackSheetSpec>();
  const sheetByFile = new Map<string, CustomPackSheetSpec>();

  if (Array.isArray(obj.sheets)) {
    obj.sheets.forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push(`sheets[${idx}] must be an object.`);
        return;
      }
      const s = entry as Record<string, unknown>;
      const id = typeof s.id === 'string' ? s.id.trim() : '';
      const file = typeof s.file === 'string' ? normalizeSheetKey(s.file.trim()) : '';
      if (!id) {
        errors.push(`sheets[${idx}].id must be a non-empty string.`);
      }
      if (!file || file.includes('..')) {
        errors.push(`sheets[${idx}].file must be a safe relative path.`);
      }
      if (!isFinitePositiveInt(s.width) || !isFinitePositiveInt(s.height)) {
        errors.push(`sheets[${idx}] width and height must be positive integers.`);
      }
      if (id && sheetById.has(id)) {
        errors.push(`Duplicate sheet id "${id}".`);
      }
      if (id && file && isFinitePositiveInt(s.width) && isFinitePositiveInt(s.height)) {
        const spec: CustomPackSheetSpec = { id, file, width: s.width, height: s.height };
        sheetById.set(id, spec);
        sheetByFile.set(file, spec);
      }
    });
  }

  if (!obj.sprites || typeof obj.sprites !== 'object' || Array.isArray(obj.sprites)) {
    errors.push('Manifest "sprites" must be a key-value map.');
  }

  let spriteCount = 0;
  const matchedSet = new Set<string>();

  if (obj.sprites && typeof obj.sprites === 'object' && !Array.isArray(obj.sprites)) {
    const spritesObj = obj.sprites as Record<string, unknown>;
    const entries = Object.entries(spritesObj);
    spriteCount = entries.length;
    if (spriteCount === 0) {
      errors.push('Manifest "sprites" map must contain at least one sprite entry.');
    }

    for (const [key, value] of entries) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`sprites["${key}"] must be an object.`);
        continue;
      }
      const r = value as Record<string, unknown>;
      const sheetRef = typeof r.sheet === 'string' ? r.sheet.trim() : '';
      const sheetSpec = sheetById.get(sheetRef) ?? sheetByFile.get(normalizeSheetKey(sheetRef));
      if (!sheetSpec) {
        errors.push(`sprites["${key}"] references unknown sheet "${sheetRef}".`);
        continue;
      }
      if (
        !isFiniteNonNegInt(r.x) ||
        !isFiniteNonNegInt(r.y) ||
        !isFinitePositiveInt(r.w) ||
        !isFinitePositiveInt(r.h)
      ) {
        errors.push(`sprites["${key}"] must have valid integer rect {x, y, w, h}.`);
        continue;
      }
      if (r.x + r.w > sheetSpec.width || r.y + r.h > sheetSpec.height) {
        errors.push(
          `sprites["${key}"] rect (${r.x},${r.y} ${r.w}x${r.h}) exceeds sheet "${sheetSpec.id}" (${sheetSpec.width}x${sheetSpec.height}).`
        );
        continue;
      }
      if (RECOMMENDED_KEY_SET.has(key)) {
        matchedSet.add(key);
      }
    }
  }

  for (const key of RECOMMENDED_CUSTOM_PACK_KEYS) {
    if (matchedSet.has(key)) {
      matchedCleanKeys.push(key);
    }
  }
  const missingRecommendedKeys = RECOMMENDED_CUSTOM_PACK_KEYS.filter((k) => !matchedSet.has(k));

  if (errors.length === 0 && matchedCleanKeys.length === 0) {
    warnings.push('No canonical clean-room sprite keys found; Built-In Ink-Cel art will serve as fallback.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sheetCount: sheetById.size,
    spriteCount,
    matchedCleanKeys,
    missingRecommendedKeys,
  };
}

// ============================================================================
// AssetRegistry Class
// ============================================================================

type RegistryChangeListener = (summary: PackManifestSummary) => void;

export class AssetRegistry {
  private mode: PackMode = 'BUILTIN';
  private customPack: CustomPackHandle | null = null;
  private readonly sheetSpecIndex = new Map<string, CustomPackSheetSpec>();
  private readonly sheetImageIndex = new Map<string, CanvasImageSource>();
  private readonly spriteCache = new Map<string, ResolvedCustomSprite | null>();
  private readonly portraitDataUrlCache = new Map<string, string>();
  private readonly listeners = new Set<RegistryChangeListener>();

  public setPackMode(mode: PackMode): void {
    const normalized: PackMode = mode === 'CUSTOM_PACK' ? 'CUSTOM_PACK' : 'BUILTIN';
    if (this.mode === normalized) {
      return;
    }
    this.mode = normalized;
    this.notifyListeners();
  }

  public getPackMode(): PackMode {
    return this.mode;
  }

  public hasCustomPack(): boolean {
    return this.customPack !== null && this.sheetImageIndex.size > 0;
  }

  public isCustomPackActive(): boolean {
    return this.mode === 'CUSTOM_PACK' && this.hasCustomPack();
  }

  public attachCustomPack(pack: CustomPackHandle | null): void {
    if (this.customPack && this.customPack !== pack) {
      try {
        this.customPack.dispose?.();
      } catch {
        // Ignore disposal errors from detached image resources
      }
    }

    this.customPack = null;
    this.sheetSpecIndex.clear();
    this.sheetImageIndex.clear();
    this.spriteCache.clear();
    this.portraitDataUrlCache.clear();

    if (pack) {
      const check = verifyCustomPackManifest(pack.manifest);
      if (check.valid) {
        this.customPack = pack;
        for (const spec of pack.manifest.sheets) {
          this.sheetSpecIndex.set(spec.id, spec);
          const normFile = normalizeSheetKey(spec.file);
          this.sheetSpecIndex.set(normFile, spec);

          const img =
            pack.sheets.get(spec.id) ??
            pack.sheets.get(spec.file) ??
            pack.sheets.get(normFile);
          if (img) {
            this.sheetImageIndex.set(spec.id, img);
            this.sheetImageIndex.set(normFile, img);
          }
        }
      }
    }

    this.notifyListeners();
  }

  public detachCustomPack(): void {
    this.attachCustomPack(null);
  }

  /**
   * Resolves a clean-room sprite ID against the attached Custom Pack when
   * `mode === 'CUSTOM_PACK'` (or always when `ignoreMode === true`).
   * Returns `null` if unavailable so callers fall back cleanly to Built-In Ink-Cel art.
   */
  public getCustomSprite(cleanId: string, ignoreMode = false): ResolvedCustomSprite | null {
    if (!this.customPack) {
      return null;
    }
    if (!ignoreMode && this.mode !== 'CUSTOM_PACK') {
      return null;
    }
    if (this.spriteCache.has(cleanId)) {
      return this.spriteCache.get(cleanId) ?? null;
    }

    const resolved = this.resolveSpriteInternal(cleanId);
    this.spriteCache.set(cleanId, resolved);
    return resolved;
  }

  /**
   * Convenience lookup for portrait sprites (accepts either `'voltaris'` or `'portrait_voltaris'`).
   */
  public getCustomPortraitSprite(
    portraitId: string,
    ignoreMode = false
  ): ResolvedCustomSprite | null {
    const cleanKey = portraitId.startsWith('portrait_') ? portraitId : `portrait_${portraitId}`;
    return this.getCustomSprite(cleanKey, ignoreMode);
  }

  /**
   * Browser-safe lazy portrait PNG data URL cropper for UI Boon/Dialogue portraits.
   * Returns `null` in Node, when Built-In mode is active, or when portrait is not in pack.
   */
  public getCustomPortraitDataUrl(portraitId: string): string | null {
    if (!this.isCustomPackActive() || typeof document === 'undefined') {
      return null;
    }
    const cleanKey = portraitId.startsWith('portrait_') ? portraitId : `portrait_${portraitId}`;
    const cached = this.portraitDataUrlCache.get(cleanKey);
    if (cached) {
      return cached;
    }
    const sprite = this.getCustomSprite(cleanKey);
    if (!sprite) {
      return null;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = sprite.w;
      canvas.height = sprite.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return null;
      }
      ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, sprite.w, sprite.h);
      const url = canvas.toDataURL('image/png');
      this.portraitDataUrlCache.set(cleanKey, url);
      return url;
    } catch {
      return null;
    }
  }

  /**
   * Returns a strictly clean-room summary safe for Title, Options, and Debug UI.
   */
  public getManifestSummary(): PackManifestSummary {
    const hasPack = this.hasCustomPack();
    const manifest = this.customPack?.manifest ?? null;
    const sheetCount = manifest ? manifest.sheets.length : 0;
    const spriteCount = manifest ? Object.keys(manifest.sprites).length : 0;

    let matchedBuiltinSpriteCount = 0;
    if (manifest) {
      for (const cleanKey of RECOMMENDED_CUSTOM_PACK_KEYS) {
        if (this.resolveSpriteInternal(cleanKey) !== null) {
          matchedBuiltinSpriteCount++;
        }
      }
    }

    const active = this.mode === 'CUSTOM_PACK' && hasPack;
    const label = active
      ? `Custom Art Pack (${sheetCount} sheets, ${spriteCount} sprites)`
      : hasPack
        ? `Built-In Ink-Cel Art (Custom Pack Ready: ${spriteCount} sprites)`
        : 'Built-In Ink-Cel Art';

    return {
      mode: this.mode,
      hasCustomPack: hasPack,
      active,
      source: manifest ? manifest.source : null,
      origin: this.customPack?.origin ?? null,
      generatedAt: manifest ? manifest.generatedAt : null,
      sheetCount,
      spriteCount,
      matchedBuiltinSpriteCount,
      label,
    };
  }

  public verifyCustomPackAgainstManifest(manifest: unknown): ManifestVerificationResult {
    return verifyCustomPackManifest(manifest);
  }

  public onChange(listener: RegistryChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public dispose(): void {
    this.detachCustomPack();
    this.listeners.clear();
  }

  private resolveSpriteInternal(cleanId: string): ResolvedCustomSprite | null {
    const pack = this.customPack;
    if (!pack) {
      return null;
    }
    const sprites = pack.manifest.sprites;

    // 1. Direct clean-room ID lookup (primary path for tools/extract-assets.ts)
    const direct = this.materializeSprite(cleanId, sprites[cleanId]);
    if (direct) {
      return direct;
    }

    // 2. Clean-room sibling fallback (e.g. hero_diag_down -> hero_down)
    const cleanFallbacks = CLEAN_FALLBACK_ALIASES[cleanId];
    if (cleanFallbacks) {
      for (const fallbackKey of cleanFallbacks) {
        const hit = this.materializeSprite(cleanId, sprites[fallbackKey]);
        if (hit) {
          return hit;
        }
      }
    }

    // 3. Isolated internal retail-compat path alias fallback for third-party manifests
    const compatAliases = INTERNAL_COMPAT_SPRITE_ALIASES[cleanId];
    if (compatAliases) {
      for (const alias of compatAliases) {
        const hit =
          this.materializeSprite(cleanId, sprites[alias]) ??
          this.materializeSprite(cleanId, sprites[alias.replace(/\\/g, '/')]);
        if (hit) {
          return hit;
        }
      }
    }

    return null;
  }

  private materializeSprite(
    cleanId: string,
    rect: CustomPackSpriteRect | undefined
  ): ResolvedCustomSprite | null {
    if (!rect) {
      return null;
    }
    const normRef = normalizeSheetKey(rect.sheet);
    const spec = this.sheetSpecIndex.get(rect.sheet) ?? this.sheetSpecIndex.get(normRef);
    const image = this.sheetImageIndex.get(rect.sheet) ?? this.sheetImageIndex.get(normRef);
    if (!spec || !image) {
      return null;
    }
    const defaultAnchor = DEFAULT_ANCHORS[cleanId];
    const anchorX = rect.anchorX ?? defaultAnchor?.[0] ?? 0.5;
    const anchorY = rect.anchorY ?? defaultAnchor?.[1] ?? 0.5;
    return {
      cleanId,
      sheetId: spec.id,
      image,
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      sheetWidth: spec.width,
      sheetHeight: spec.height,
      anchorX,
      anchorY,
      u0: rect.x / spec.width,
      v0: rect.y / spec.height,
      u1: (rect.x + rect.w) / spec.width,
      v1: (rect.y + rect.h) / spec.height,
    };
  }

  private notifyListeners(): void {
    if (this.listeners.size === 0) {
      return;
    }
    const summary = this.getManifestSummary();
    for (const listener of this.listeners) {
      try {
        listener(summary);
      } catch {
        // Isolate subscriber exceptions
      }
    }
  }
}

export function createAssetRegistry(): AssetRegistry {
  return new AssetRegistry();
}
