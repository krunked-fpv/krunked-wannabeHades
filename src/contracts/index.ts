/**
 * Krunked WannabeHades — Single Source of Truth Contracts
 *
 * ZERO DOM dependencies: safely importable by pure Node simulation, CLI tools, and tests.
 * All user-facing labels use clean-room Krunked nomenclature.
 */

export const CONTRACT_VERSION = '1.0.0' as const;

// ============================================================================
// Identifiers & Enumerations
// ============================================================================

export type BiomeId =
  | 'sanctum_hub'
  | 'obsidian_pit'
  | 'cinder_mire'
  | 'verdant_colosseum'
  | 'crypt_of_bile'
  | 'frozen_summit';

export type WeaponId =
  | 'stygian_blade'
  | 'eternal_spear'
  | 'shield_of_chaos'
  | 'heart_seeking_bow'
  | 'twin_fists'
  | 'adamant_rail';

export type AspectId =
  // Stygian Blade (4)
  | 'blade_scion'
  | 'blade_vengeance'
  | 'blade_maelstrom'
  | 'blade_paladin'
  // Eternal Spear (4)
  | 'spear_scion'
  | 'spear_vanguard'
  | 'spear_sovereign'
  | 'spear_dragon'
  // Shield of Chaos (4)
  | 'shield_scion'
  | 'shield_abyss'
  | 'shield_thunder'
  | 'shield_behemoth'
  // Heart-Seeking Bow (4)
  | 'bow_scion'
  | 'bow_tracker'
  | 'bow_loaded'
  | 'bow_celestial'
  // Twin Fists (4)
  | 'fists_scion'
  | 'fists_magnet'
  | 'fists_cutter'
  | 'fists_feral'
  // Adamant Rail (4)
  | 'rail_scion'
  | 'rail_blast'
  | 'rail_sniper'
  | 'rail_beam';

export type HammerId =
  // Stygian Blade (6)
  | 'hammer_blade_double_edge'
  | 'hammer_blade_cruel_thrust'
  | 'hammer_blade_flurry_slash'
  | 'hammer_blade_shadow_slash'
  | 'hammer_blade_cursed_slash'
  | 'hammer_blade_super_nova'
  // Eternal Spear (6)
  | 'hammer_spear_extending_jab'
  | 'hammer_spear_flurry_jab'
  | 'hammer_spear_serrated_point'
  | 'hammer_spear_exploding_launcher'
  | 'hammer_spear_charged_skewer'
  | 'hammer_spear_quick_spin'
  // Shield of Chaos (6)
  | 'hammer_shield_sudden_rush'
  | 'hammer_shield_charged_shot'
  | 'hammer_shield_pulverizing_blow'
  | 'hammer_shield_dread_flight'
  | 'hammer_shield_explosive_return'
  | 'hammer_shield_ferocious_guard'
  // Heart-Seeking Bow (6)
  | 'hammer_bow_twin_shot'
  | 'hammer_bow_flurry_shot'
  | 'hammer_bow_perfect_shot'
  | 'hammer_bow_point_blank_shot'
  | 'hammer_bow_relentless_volley'
  | 'hammer_bow_explosive_shot'
  // Twin Fists (6)
  | 'hammer_fists_breaching_cross'
  | 'hammer_fists_long_knuckle'
  | 'hammer_fists_rolling_knuckle'
  | 'hammer_fists_kinetic_launcher'
  | 'hammer_fists_quake_cutter'
  | 'hammer_fists_colossus_knuckle'
  // Adamant Rail (6)
  | 'hammer_rail_spread_fire'
  | 'hammer_rail_delta_chamber'
  | 'hammer_rail_flurry_fire'
  | 'hammer_rail_cluster_bomb'
  | 'hammer_rail_hazard_bomb'
  | 'hammer_rail_rocket_bomb';

export type PatronId =
  | 'voltaris'
  | 'tidebreaker'
  | 'aegira'
  | 'velouris'
  | 'sylvara'
  | 'bellum'
  | 'bacchion'
  | 'glaciera'
  | 'veloce'
  | 'abyssos';

export type BossId =
  | 'warden_malice'
  | 'warden_fury'
  | 'warden_murder'
  | 'bone_leviathan'
  | 'colosseum_bull'
  | 'colosseum_spearlord'
  | 'the_ferryman'
  | 'sovereign_lord';

export type EnemyArchetypeId =
  | 'rattlebones_dummy'
  | 'wretched_husk'
  | 'bone_archer'
  | 'brimstone_crystal'
  | 'ember_lout'
  | 'numbskull'
  | 'wretch_assassin'
  | 'slag_thrower'
  | 'lava_gorgon'
  | 'bloodless_drifter'
  | 'infernal_bomber'
  | 'bone_hydra_head'
  | 'colosseum_swordsman'
  | 'colosseum_shieldbearer'
  | 'colosseum_bowman'
  | 'chariot_flame'
  | 'soul_orb'
  | 'venom_satyr'
  | 'giant_vermin'
  | 'snakestone_laser'
  | 'heavy_brawler'
  | BossId;

export type StatusEffectId =
  | 'jolted'
  | 'ruptured'
  | 'exposed'
  | 'weak'
  | 'marked'
  | 'doom'
  | 'hangover'
  | 'chill'
  | 'maim'
  | 'poison';

export type BoonRarity = 'common' | 'rare' | 'epic' | 'heroic' | 'duo' | 'legendary';

export type BoonSlot =
  | 'attack'
  | 'special'
  | 'cast'
  | 'dash'
  | 'call'
  | 'passive'
  | 'duo'
  | 'legendary'
  | 'chaos';

export type InputSource = 'keyboard' | 'gamepad' | 'touch';

export type MirrorUpgradeId =
  | 'shadow_presence'
  | 'cinder_vitality'
  | 'death_defiance'
  | 'greater_reflex'
  | 'boiling_blood'
  | 'infernal_soul'
  | 'deep_pockets'
  | 'thick_skin'
  | 'privileged_status'
  | 'patron_favor'
  | 'divine_pride'
  | 'fated_authority';

export type ShrineVowId =
  | 'hard_labor'
  | 'lasting_consequences'
  | 'convenience_fee'
  | 'jury_summons'
  | 'extreme_measures'
  | 'calisthenics_program'
  | 'benefits_package'
  | 'middle_management'
  | 'underworld_customs'
  | 'forced_overtime'
  | 'heightened_security'
  | 'routine_inspection'
  | 'damage_control'
  | 'approval_process'
  | 'tight_deadline'
  | 'personal_liability';

export type KeepsakeId =
  | 'old_collar'
  | 'lucky_fang'
  | 'bone_sandglass'
  | 'coin_pouch'
  | 'evergreen_acorn'
  | 'shattered_shackle'
  | 'pierced_plume'
  | 'obsidian_shawl'
  | 'thunder_signet'
  | 'conch_shell'
  | 'owl_pendant'
  | 'eternal_rose'
  | 'adamant_arrowhead'
  | 'blood_vial'
  | 'overflowing_chalice'
  | 'frostbitten_horn';

export type PickupKind =
  | 'boon'
  | 'hammer'
  | 'pom'
  | 'centaur_heart'
  | 'gold'
  | 'darkness'
  | 'gemstone'
  | 'key'
  | 'nectar'
  | 'titan_blood'
  | 'diamond'
  | 'ambrosia'
  | 'heal_food'
  | 'chaos_gate'
  | 'shop_item'
  | 'fountain'
  | 'well_of_ash';

export type EncounterKind =
  | 'hub'
  | 'combat'
  | 'miniboss'
  | 'boss'
  | 'shop'
  | 'fountain'
  | 'story'
  | 'trial'
  | 'chaos'
  | 'styx_hub'
  | 'styx_wing'
  | 'surface_boss';

export type ScreenId =
  | 'title'
  | 'hub'
  | 'playing'
  | 'boon_select'
  | 'weapon_menu'
  | 'mirror_menu'
  | 'shrine_menu'
  | 'keepsake_menu'
  | 'shop_menu'
  | 'codex_menu'
  | 'pause'
  | 'options'
  | 'victory'
  | 'death';

// ============================================================================
// Core Simulation, Player & Combat Constants (Calibrated to Ground Truth)
// ============================================================================

export const SIM_CONSTANTS = {
  simHz: 60,
  fixedDt: 1 / 60,
  maxFrameDt: 0.1,
  maxSubStepsPerFrame: 5,
  isoScaleY: 0.56,
  aoeScaleYMin: 0.56,
  aoeScaleYMax: 0.62,
  heroOctagonSize: { x: 104, y: 64 } as const,
  heroOctagonVerts: [
    [-16, -24],
    [16, -24],
    [48, -8],
    [48, 8],
    [16, 24],
    [-16, 24],
    [-48, 8],
    [-48, -8],
  ] as readonly (readonly [number, number])[],
  numAngles: 32,
  cosmeticRotationSpeed: 1340,
  combatRotationSpeed: 216000,
  biomeZoom: {
    sanctum_hub: [0.85, 1.0],
    obsidian_pit: [0.75, 1.0],
    cinder_mire: [0.75, 0.88],
    verdant_colosseum: [0.80, 0.95],
    crypt_of_bile: [0.85, 0.95],
    frozen_summit: [0.60, 0.90],
  } as const satisfies Record<BiomeId, readonly [number, number]>,
} as const;

export const PLAYER_CONSTANTS = {
  speed: 540,
  acceleration: 2000,
  grip: 1000,
  backpedalSpeedModifier: 0.34,
  fullControlVelocityThreshold: 400,
  touchdownVelocityRetention: 0.7,
  minMoveDistance: 8,
  reticleMagnetismDistance: 100,
  reticleMagnetismSpeed: 1000,
  reticleMoveSpeed: 2500,
  dashDuration: 0.21,
  dashTicks: 13,
  dashEaseIn: 0,
  dashEaseOut: 0.8,
  dashRange: 300,
  dashMaxRange: 400,
  dashBaseClip: 1,
  dashClipRegenInterval: 0.74,
  dashCooldown: 0.05,
  dashGhosts: 3,
  dashStrikeWindow: 0.4,
  perfectDashHitDisableDuration: 0.3,
  baseMaxHealth: 50,
  thickSkinMaxBonus: 50,
  baseCastAmmo: 1,
  infernalSoulMaxBonus: 2,
  postHitIframeDuration: 1.3,
  postHitIframeMinDamage: 10,
  postHitIframeCumulativeWindow: 0.6,
  godModeBaseMultiplier: 0.8,
  godModePerDeathStep: 0.02,
  godModeMaxDeaths: 30,
  godGaugeDamageDealtMult: 0.01,
  godGaugeDamageTakenMult: 60,
  godGaugeBars: 4,
  godGaugeMax: 100,
  greaterCallSlowScale: 0.1,
  greaterCallSlowDuration: 1.2,
  castDamage: 50,
  castSpeed: 900,
  castRange: 1100,
  castChargeFrames: 13,
  castCooldown: 0.2,
  castSelfVelocity: -320,
  castLodgeDuration: 16,
  castMagnetSpeed: 2000,
} as const;

export const COMBAT_CONSTANTS = {
  critMultiplier: 3.0,
  backstabBonus: 0.5,
  boilingBloodBonus: 0.5,
  privilegedStatusBonus: 0.4,
  armorBreakStun: 1.0,
  wallSlamDamagePerVelocity: 0.01,
  deflectSpeedMultiplier: 3.0,
  deflectLobSpeedMultiplier: 1.5,
  hitstopCooldown: 0.2,
  finalKillSlowScale: 0.00001,
  finalKillSlowDuration: 0.6,
  finalKillSlowLerpOut: 0.1,
  rarityMultipliers: {
    common: 1.0,
    rare: 1.4,
    epic: 2.0,
    heroic: 2.5,
    duo: 1.0,
    legendary: 1.0,
  } as const satisfies Record<BoonRarity, number>,
  pomDiminishingScale: 0.7,
  statusDefaults: {
    jolted: {
      duration: 10.0,
      baseDamage: 60,
      triggerOnAttack: true,
    },
    ruptured: {
      duration: 3.0,
      baseDamage: 10,
      tickInterval: 0.2,
      requiresMovement: true,
    },
    exposed: {
      duration: 5.0,
      backstabBonus: 0.5,
    },
    weak: {
      duration: 4.0,
      outgoingDamageMult: 0.7,
    },
    marked: {
      duration: 6.0,
      bonusCritChance: 0.3,
    },
    doom: {
      delay: 1.1,
      baseDamage: 50,
    },
    hangover: {
      damagePerTick: 4,
      tickInterval: 0.5,
      duration: 4.0,
      maxStacks: 5,
    },
    chill: {
      slowPerStack: 0.04,
      maxStacks: 10,
      duration: 8.0,
    },
    maim: {
      duration: 4.0,
      burstDamage: 400,
      incomingDamageBonus: 0.5,
      outgoingDamageBonus: 0.25,
    },
    poison: {
      damagePerTick: 4,
      tickInterval: 0.5,
      duration: 12.0,
    },
  } as const,
} as const;

export const LAVA_CONSTANTS = {
  damage: 5,
  tickInterval: 0.4,
  graceDuration: 0.35,
} as const;

// ============================================================================
// Weapons, Aspects (24), and Hammers (36)
// ============================================================================

export interface WeaponBaseDef {
  id: WeaponId;
  displayName: string;
  subtitle: string;
  attackKind: 'melee_combo' | 'spear_thrust' | 'shield_bash' | 'bow_charge' | 'rapid_combo' | 'rail_auto';
  attackComboDamage: readonly number[];
  attackChargeTimes: readonly number[];
  dashStrikeDamage: number;
  attackRange: number;
  attackArcDeg: number;
  attackProjectileSpeed?: number;
  chargeMinDamage?: number;
  chargeMaxDamage?: number;
  powerShotDamage?: number;
  chargeDuration?: number;
  clipSize?: number;
  fireInterval?: number;
  reloadTime?: number;
  specialName: string;
  specialDamage: number;
  specialHits: number;
  specialRadius: number;
  specialRange: number;
  specialCooldown: number;
  specialProjectileSpeed?: number;
  specialBounces?: number;
  specialLobTime?: number;
  aspects: readonly [AspectId, AspectId, AspectId, AspectId];
  hammers: readonly [HammerId, HammerId, HammerId, HammerId, HammerId, HammerId];
}

export interface AspectDef {
  id: AspectId;
  weaponId: WeaponId;
  displayName: string;
  description: string;
  isHiddenAspect: boolean;
  bonusPerRank: number;
  maxRank: number;
}

export interface HammerDef {
  id: HammerId;
  weaponId: WeaponId;
  displayName: string;
  description: string;
}

export const WEAPON_CONSTANTS: Record<WeaponId, WeaponBaseDef> = {
  stygian_blade: {
    id: 'stygian_blade',
    displayName: 'Stygian Blade',
    subtitle: 'Infernal Arm of Swift Ruin',
    attackKind: 'melee_combo',
    attackComboDamage: [20, 25, 30],
    attackChargeTimes: [0.12, 0.14, 0.18],
    dashStrikeDamage: 30,
    attackRange: 260,
    attackArcDeg: 130,
    specialName: 'Nova Smash',
    specialDamage: 50,
    specialHits: 1,
    specialRadius: 380,
    specialRange: 380,
    specialCooldown: 0.5,
    aspects: ['blade_scion', 'blade_vengeance', 'blade_maelstrom', 'blade_paladin'],
    hammers: [
      'hammer_blade_double_edge',
      'hammer_blade_cruel_thrust',
      'hammer_blade_flurry_slash',
      'hammer_blade_shadow_slash',
      'hammer_blade_cursed_slash',
      'hammer_blade_super_nova',
    ],
  },
  eternal_spear: {
    id: 'eternal_spear',
    displayName: 'Eternal Spear',
    subtitle: 'Infernal Arm of Relentless Reach',
    attackKind: 'spear_thrust',
    attackComboDamage: [25, 30, 30],
    attackChargeTimes: [0.13, 0.13, 0.17],
    dashStrikeDamage: 20,
    attackRange: 430,
    attackArcDeg: 44,
    chargeMinDamage: 30,
    chargeMaxDamage: 100,
    chargeDuration: 0.75,
    specialName: 'Skewer Throw',
    specialDamage: 25,
    specialHits: 2,
    specialRadius: 48,
    specialRange: 880,
    specialCooldown: 0.8,
    specialProjectileSpeed: 1450,
    aspects: ['spear_scion', 'spear_vanguard', 'spear_sovereign', 'spear_dragon'],
    hammers: [
      'hammer_spear_extending_jab',
      'hammer_spear_flurry_jab',
      'hammer_spear_serrated_point',
      'hammer_spear_exploding_launcher',
      'hammer_spear_charged_skewer',
      'hammer_spear_quick_spin',
    ],
  },
  shield_of_chaos: {
    id: 'shield_of_chaos',
    displayName: 'Aegis of Ruin',
    subtitle: 'Infernal Arm of Unyielding Ward',
    attackKind: 'shield_bash',
    attackComboDamage: [25],
    attackChargeTimes: [0.14],
    dashStrikeDamage: 25,
    attackRange: 155,
    attackArcDeg: 140,
    chargeMinDamage: 20,
    chargeMaxDamage: 40,
    chargeDuration: 0.8,
    specialName: 'Rebound Throw',
    specialDamage: 15,
    specialHits: 1,
    specialRadius: 42,
    specialRange: 700,
    specialCooldown: 0.55,
    specialProjectileSpeed: 1200,
    specialBounces: 2,
    aspects: ['shield_scion', 'shield_abyss', 'shield_thunder', 'shield_behemoth'],
    hammers: [
      'hammer_shield_sudden_rush',
      'hammer_shield_charged_shot',
      'hammer_shield_pulverizing_blow',
      'hammer_shield_dread_flight',
      'hammer_shield_explosive_return',
      'hammer_shield_ferocious_guard',
    ],
  },
  heart_seeking_bow: {
    id: 'heart_seeking_bow',
    displayName: 'Heart-Seeking Bow',
    subtitle: 'Infernal Arm of True Aim',
    attackKind: 'bow_charge',
    attackComboDamage: [60],
    attackChargeTimes: [0.6],
    dashStrikeDamage: 40,
    attackRange: 900,
    attackArcDeg: 14,
    attackProjectileSpeed: 1850,
    chargeMinDamage: 10,
    chargeMaxDamage: 60,
    powerShotDamage: 70,
    chargeDuration: 0.6,
    specialName: 'Volley Fan',
    specialDamage: 10,
    specialHits: 9,
    specialRadius: 24,
    specialRange: 1000,
    specialCooldown: 0.85,
    specialProjectileSpeed: 1500,
    aspects: ['bow_scion', 'bow_tracker', 'bow_loaded', 'bow_celestial'],
    hammers: [
      'hammer_bow_twin_shot',
      'hammer_bow_flurry_shot',
      'hammer_bow_perfect_shot',
      'hammer_bow_point_blank_shot',
      'hammer_bow_relentless_volley',
      'hammer_bow_explosive_shot',
    ],
  },
  twin_fists: {
    id: 'twin_fists',
    displayName: 'Twin Gauntlets',
    subtitle: 'Infernal Arm of Relentless Fury',
    attackKind: 'rapid_combo',
    attackComboDamage: [15, 15, 15, 15, 15],
    attackChargeTimes: [0.11, 0.11, 0.11, 0.11, 0.14],
    dashStrikeDamage: 25,
    attackRange: 120,
    attackArcDeg: 112,
    fireInterval: 0.13,
    specialName: 'Rising Uppercut',
    specialDamage: 30,
    specialHits: 2,
    specialRadius: 128,
    specialRange: 135,
    specialCooldown: 0.5,
    aspects: ['fists_scion', 'fists_magnet', 'fists_cutter', 'fists_feral'],
    hammers: [
      'hammer_fists_breaching_cross',
      'hammer_fists_long_knuckle',
      'hammer_fists_rolling_knuckle',
      'hammer_fists_kinetic_launcher',
      'hammer_fists_quake_cutter',
      'hammer_fists_colossus_knuckle',
    ],
  },
  adamant_rail: {
    id: 'adamant_rail',
    displayName: 'Adamant Rail',
    subtitle: 'Infernal Arm of Siege Fire',
    attackKind: 'rail_auto',
    attackComboDamage: [10],
    attackChargeTimes: [0.1],
    dashStrikeDamage: 10,
    attackRange: 710,
    attackArcDeg: 8,
    attackProjectileSpeed: 1750,
    clipSize: 12,
    fireInterval: 0.1,
    reloadTime: 0.75,
    specialName: 'Bombard Shell',
    specialDamage: 60,
    specialHits: 1,
    specialRadius: 400,
    specialRange: 600,
    specialCooldown: 1.5,
    specialLobTime: 0.55,
    aspects: ['rail_scion', 'rail_blast', 'rail_sniper', 'rail_beam'],
    hammers: [
      'hammer_rail_spread_fire',
      'hammer_rail_delta_chamber',
      'hammer_rail_flurry_fire',
      'hammer_rail_cluster_bomb',
      'hammer_rail_hazard_bomb',
      'hammer_rail_rocket_bomb',
    ],
  },
};

export const ASPECT_DEFS: Record<AspectId, AspectDef> = {
  // Stygian Blade
  blade_scion: {
    id: 'blade_scion',
    weaponId: 'stygian_blade',
    displayName: 'Aspect of the Scion',
    description: '+15% Attack Speed and Move Speed at max rank.',
    isHiddenAspect: false,
    bonusPerRank: 0.03,
    maxRank: 5,
  },
  blade_vengeance: {
    id: 'blade_vengeance',
    weaponId: 'stygian_blade',
    displayName: 'Aspect of Vengeance',
    description: 'For 3s after Special, Attack has +30% Critical chance.',
    isHiddenAspect: false,
    bonusPerRank: 0.06,
    maxRank: 5,
  },
  blade_maelstrom: {
    id: 'blade_maelstrom',
    weaponId: 'stygian_blade',
    displayName: 'Aspect of Maelstrom',
    description: 'Special dislodges Bloodstones from foes; +50% Cast damage.',
    isHiddenAspect: false,
    bonusPerRank: 0.1,
    maxRank: 5,
  },
  blade_paladin: {
    id: 'blade_paladin',
    weaponId: 'stygian_blade',
    displayName: 'Aspect of the Paladin',
    description: 'Heavy 60/80/200 combo, +50 Max HP, and Special creates a Consecrated Aura.',
    isHiddenAspect: true,
    bonusPerRank: 0.08,
    maxRank: 5,
  },
  // Eternal Spear
  spear_scion: {
    id: 'spear_scion',
    weaponId: 'eternal_spear',
    displayName: 'Aspect of the Scion',
    description: '+25% Special damage, range, and throw speed.',
    isHiddenAspect: false,
    bonusPerRank: 0.05,
    maxRank: 5,
  },
  spear_vanguard: {
    id: 'spear_vanguard',
    weaponId: 'eternal_spear',
    displayName: 'Aspect of the Vanguard',
    description: 'Recall rushes to your spear; next 4 Attacks or Casts deal +150% damage.',
    isHiddenAspect: false,
    bonusPerRank: 0.3,
    maxRank: 5,
  },
  spear_sovereign: {
    id: 'spear_sovereign',
    weaponId: 'eternal_spear',
    displayName: 'Aspect of the Sovereign',
    description: 'Spin Attack inflicts Punishing Sweep (+150% Attack & Special damage for 10s).',
    isHiddenAspect: false,
    bonusPerRank: 0.3,
    maxRank: 5,
  },
  spear_dragon: {
    id: 'spear_dragon',
    weaponId: 'eternal_spear',
    displayName: 'Aspect of the Frost Dragon',
    description: 'Sweeping Frost Spin heals on hit; reduces Max HP by 50%.',
    isHiddenAspect: true,
    bonusPerRank: 0.05,
    maxRank: 5,
  },
  // Shield of Chaos
  shield_scion: {
    id: 'shield_scion',
    weaponId: 'shield_of_chaos',
    displayName: 'Aspect of the Scion',
    description: '+15 Base Attack and Dash-Strike damage.',
    isHiddenAspect: false,
    bonusPerRank: 3,
    maxRank: 5,
  },
  shield_abyss: {
    id: 'shield_abyss',
    weaponId: 'shield_of_chaos',
    displayName: 'Aspect of the Abyss',
    description: 'After Bull Rush, next Special throws up to 5 extra shields.',
    isHiddenAspect: false,
    bonusPerRank: 1,
    maxRank: 5,
  },
  shield_thunder: {
    id: 'shield_thunder',
    weaponId: 'shield_of_chaos',
    displayName: 'Aspect of the Storm Disc',
    description: 'Special throws a lingering spinning Blitz Disc that pulses damage.',
    isHiddenAspect: false,
    bonusPerRank: 0.15,
    maxRank: 5,
  },
  shield_behemoth: {
    id: 'shield_behemoth',
    weaponId: 'shield_of_chaos',
    displayName: 'Aspect of the Behemoth',
    description: 'Load Cast Bloodstones into Dragon Rush for massive area detonation.',
    isHiddenAspect: true,
    bonusPerRank: 0.2,
    maxRank: 5,
  },
  // Heart-Seeking Bow
  bow_scion: {
    id: 'bow_scion',
    weaponId: 'heart_seeking_bow',
    displayName: 'Aspect of the Scion',
    description: '+15% Critical chance on Attack.',
    isHiddenAspect: false,
    bonusPerRank: 0.03,
    maxRank: 5,
  },
  bow_tracker: {
    id: 'bow_tracker',
    weaponId: 'heart_seeking_bow',
    displayName: 'Aspect of the Tracker',
    description: 'Special arrows automatically seek the foe last struck by Attack.',
    isHiddenAspect: false,
    bonusPerRank: 1,
    maxRank: 5,
  },
  bow_loaded: {
    id: 'bow_loaded',
    weaponId: 'heart_seeking_bow',
    displayName: 'Aspect of the Vessel',
    description: 'Load Cast Bloodstones into your next Attack shot.',
    isHiddenAspect: false,
    bonusPerRank: 0.15,
    maxRank: 5,
  },
  bow_celestial: {
    id: 'bow_celestial',
    weaponId: 'heart_seeking_bow',
    displayName: 'Aspect of the Celestial',
    description: 'Special marks foes with Shared Suffering; Attack deals heavy piercing damage.',
    isHiddenAspect: true,
    bonusPerRank: 0.12,
    maxRank: 5,
  },
  // Twin Fists
  fists_scion: {
    id: 'fists_scion',
    weaponId: 'twin_fists',
    displayName: 'Aspect of the Scion',
    description: '+15% passive Dodge chance.',
    isHiddenAspect: false,
    bonusPerRank: 0.03,
    maxRank: 5,
  },
  fists_magnet: {
    id: 'fists_magnet',
    weaponId: 'twin_fists',
    displayName: 'Aspect of the Magnet',
    description: 'Special Magnetic Cutter pulls foes in and amplifies Attack & Cast damage.',
    isHiddenAspect: false,
    bonusPerRank: 0.1,
    maxRank: 5,
  },
  fists_cutter: {
    id: 'fists_cutter',
    weaponId: 'twin_fists',
    displayName: 'Aspect of the Tempest',
    description: 'After landing 12 Attacks, your next Special strikes up to 5 additional times.',
    isHiddenAspect: false,
    bonusPerRank: 1,
    maxRank: 5,
  },
  fists_feral: {
    id: 'fists_feral',
    weaponId: 'twin_fists',
    displayName: 'Aspect of the Feral Claws',
    description: 'Dash-Uppercut inflicts Maim (+50% dmg taken, 400 burst after 4s); +2 Dashes.',
    isHiddenAspect: true,
    bonusPerRank: 0.08,
    maxRank: 5,
  },
  // Adamant Rail
  rail_scion: {
    id: 'rail_scion',
    weaponId: 'adamant_rail',
    displayName: 'Aspect of the Scion',
    description: '+12 maximum ammo capacity.',
    isHiddenAspect: false,
    bonusPerRank: 2.4,
    maxRank: 5,
  },
  rail_blast: {
    id: 'rail_blast',
    weaponId: 'adamant_rail',
    displayName: 'Aspect of Strife',
    description: 'Absorbing your Special blast empowers all damage by +75% for 4s.',
    isHiddenAspect: false,
    bonusPerRank: 0.15,
    maxRank: 5,
  },
  rail_sniper: {
    id: 'rail_sniper',
    weaponId: 'adamant_rail',
    displayName: 'Aspect of the Hearth',
    description: 'Manual reload empowers your next shot to 150 base damage with extended range.',
    isHiddenAspect: false,
    bonusPerRank: 20,
    maxRank: 5,
  },
  rail_beam: {
    id: 'rail_beam',
    weaponId: 'adamant_rail',
    displayName: 'Aspect of the Hellfire',
    description: 'Fires a continuous ramping beam; Special deploys pulse mines.',
    isHiddenAspect: true,
    bonusPerRank: 0.15,
    maxRank: 5,
  },
};

export const HAMMER_DEFS: Record<HammerId, HammerDef> = {
  // Stygian Blade
  hammer_blade_double_edge: {
    id: 'hammer_blade_double_edge',
    weaponId: 'stygian_blade',
    displayName: 'Double Edge',
    description: 'Dash-Strike hits twice and deals +20% damage.',
  },
  hammer_blade_cruel_thrust: {
    id: 'hammer_blade_cruel_thrust',
    weaponId: 'stygian_blade',
    displayName: 'Cruel Thrust',
    description: 'Thrust deals +200% damage and has +40% Critical chance.',
  },
  hammer_blade_flurry_slash: {
    id: 'hammer_blade_flurry_slash',
    weaponId: 'stygian_blade',
    displayName: 'Flurry Slash',
    description: 'Hold Attack to strike rapidly, dealing 25 base damage per slash.',
  },
  hammer_blade_shadow_slash: {
    id: 'hammer_blade_shadow_slash',
    weaponId: 'stygian_blade',
    displayName: 'Shadow Slash',
    description: 'Attack deals +200% damage when striking foes from behind.',
  },
  hammer_blade_cursed_slash: {
    id: 'hammer_blade_cursed_slash',
    weaponId: 'stygian_blade',
    displayName: 'Cursed Slash',
    description: 'Attack restores 2 HP on hit, but reduces Max HP by 60%.',
  },
  hammer_blade_super_nova: {
    id: 'hammer_blade_super_nova',
    weaponId: 'stygian_blade',
    displayName: 'Super Nova',
    description: 'Special hits a wider area (+25% radius) and deals +20% damage.',
  },
  // Eternal Spear
  hammer_spear_extending_jab: {
    id: 'hammer_spear_extending_jab',
    weaponId: 'eternal_spear',
    displayName: 'Extending Jab',
    description: 'Attack has +30% range and deals +40% damage to distant foes.',
  },
  hammer_spear_flurry_jab: {
    id: 'hammer_spear_flurry_jab',
    weaponId: 'eternal_spear',
    displayName: 'Flurry Jab',
    description: 'Hold Attack to strike rapidly, disabling Spin Attack.',
  },
  hammer_spear_serrated_point: {
    id: 'hammer_spear_serrated_point',
    weaponId: 'eternal_spear',
    displayName: 'Serrated Point',
    description: 'Dash-Strike hits 3 times, but reduces Dash range by 25%.',
  },
  hammer_spear_exploding_launcher: {
    id: 'hammer_spear_exploding_launcher',
    weaponId: 'eternal_spear',
    displayName: 'Exploding Launcher',
    description: 'Special fires a 50-damage explosive blast instead of lodging.',
  },
  hammer_spear_charged_skewer: {
    id: 'hammer_spear_charged_skewer',
    weaponId: 'eternal_spear',
    displayName: 'Charged Skewer',
    description: 'Hold Special to charge up to +200% base damage.',
  },
  hammer_spear_quick_spin: {
    id: 'hammer_spear_quick_spin',
    weaponId: 'eternal_spear',
    displayName: 'Quick Spin',
    description: 'Spin Attack charges 50% faster and covers a wider area.',
  },
  // Shield of Chaos
  hammer_shield_sudden_rush: {
    id: 'hammer_shield_sudden_rush',
    weaponId: 'shield_of_chaos',
    displayName: 'Sudden Rush',
    description: 'Bull Rush charges 40% faster.',
  },
  hammer_shield_charged_shot: {
    id: 'hammer_shield_charged_shot',
    weaponId: 'shield_of_chaos',
    displayName: 'Charged Shot',
    description: 'Bull Rush fires a piercing 80-damage wave instead of dashing.',
  },
  hammer_shield_pulverizing_blow: {
    id: 'hammer_shield_pulverizing_blow',
    weaponId: 'shield_of_chaos',
    displayName: 'Pulverizing Blow',
    description: 'Attack hits twice, but no longer knocks foes away.',
  },
  hammer_shield_dread_flight: {
    id: 'hammer_shield_dread_flight',
    weaponId: 'shield_of_chaos',
    displayName: 'Dread Flight',
    description: 'Special strikes up to 4 additional foes before returning.',
  },
  hammer_shield_explosive_return: {
    id: 'hammer_shield_explosive_return',
    weaponId: 'shield_of_chaos',
    displayName: 'Explosive Return',
    description: 'Catching your Special deals 50 damage to nearby foes.',
  },
  hammer_shield_ferocious_guard: {
    id: 'hammer_shield_ferocious_guard',
    weaponId: 'shield_of_chaos',
    displayName: 'Ferocious Guard',
    description: 'Blocking an attack grants +20% damage and move speed for 10s.',
  },
  // Heart-Seeking Bow
  hammer_bow_twin_shot: {
    id: 'hammer_bow_twin_shot',
    weaponId: 'heart_seeking_bow',
    displayName: 'Twin Shot',
    description: 'Attack fires 2 arrows side-by-side with slightly reduced range.',
  },
  hammer_bow_flurry_shot: {
    id: 'hammer_bow_flurry_shot',
    weaponId: 'heart_seeking_bow',
    displayName: 'Flurry Shot',
    description: 'Hold Attack to fire rapidly without Power Shot charging.',
  },
  hammer_bow_perfect_shot: {
    id: 'hammer_bow_perfect_shot',
    weaponId: 'heart_seeking_bow',
    displayName: 'Perfect Shot',
    description: 'Power Shot window is easier to hit and deals +150% damage.',
  },
  hammer_bow_point_blank_shot: {
    id: 'hammer_bow_point_blank_shot',
    weaponId: 'heart_seeking_bow',
    displayName: 'Point-Blank Shot',
    description: 'Attack deals +150% damage to nearby foes.',
  },
  hammer_bow_relentless_volley: {
    id: 'hammer_bow_relentless_volley',
    weaponId: 'heart_seeking_bow',
    displayName: 'Relentless Volley',
    description: 'Special fires +4 additional arrows.',
  },
  hammer_bow_explosive_shot: {
    id: 'hammer_bow_explosive_shot',
    weaponId: 'heart_seeking_bow',
    displayName: 'Explosive Shot',
    description: 'Attack deals +300% damage in an area, but charges slower.',
  },
  // Twin Fists
  hammer_fists_breaching_cross: {
    id: 'hammer_fists_breaching_cross',
    weaponId: 'twin_fists',
    displayName: 'Breaching Cross',
    description: 'Dash-Strike pierces foes and deals +900% damage to Armor.',
  },
  hammer_fists_long_knuckle: {
    id: 'hammer_fists_long_knuckle',
    weaponId: 'twin_fists',
    displayName: 'Long Knuckle',
    description: 'Attack has +35% range and deals +10% damage.',
  },
  hammer_fists_rolling_knuckle: {
    id: 'hammer_fists_rolling_knuckle',
    weaponId: 'twin_fists',
    displayName: 'Rolling Knuckle',
    description: 'Dash-Strike deals +60% damage and counts toward your Attack combo.',
  },
  hammer_fists_kinetic_launcher: {
    id: 'hammer_fists_kinetic_launcher',
    weaponId: 'twin_fists',
    displayName: 'Kinetic Launcher',
    description: 'Special becomes a 50-damage ranged blast.',
  },
  hammer_fists_quake_cutter: {
    id: 'hammer_fists_quake_cutter',
    weaponId: 'twin_fists',
    displayName: 'Quake Cutter',
    description: 'After Special, deal 90 damage in a shockwave around you.',
  },
  hammer_fists_colossus_knuckle: {
    id: 'hammer_fists_colossus_knuckle',
    weaponId: 'twin_fists',
    displayName: 'Colossus Knuckle',
    description: 'While using Attack or Special, gain Sturdy (-30% damage taken).',
  },
  // Adamant Rail
  hammer_rail_spread_fire: {
    id: 'hammer_rail_spread_fire',
    weaponId: 'adamant_rail',
    displayName: 'Spread Fire',
    description: 'Attack becomes a short-range 5-pellet burst dealing 40 base damage.',
  },
  hammer_rail_delta_chamber: {
    id: 'hammer_rail_delta_chamber',
    weaponId: 'adamant_rail',
    displayName: 'Delta Chamber',
    description: 'Attack fires 3-round bursts and never needs to reload.',
  },
  hammer_rail_flurry_fire: {
    id: 'hammer_rail_flurry_fire',
    weaponId: 'adamant_rail',
    displayName: 'Flurry Fire',
    description: 'Attack fires 25% faster and gains +6 ammo capacity.',
  },
  hammer_rail_cluster_bomb: {
    id: 'hammer_rail_cluster_bomb',
    weaponId: 'adamant_rail',
    displayName: 'Cluster Bomb',
    description: 'Special fires a spread of 5 bombs, each dealing -30% damage.',
  },
  hammer_rail_hazard_bomb: {
    id: 'hammer_rail_hazard_bomb',
    weaponId: 'adamant_rail',
    displayName: 'Hazard Bomb',
    description: 'Special deals +300% damage in a huge area, but can also hurt you.',
  },
  hammer_rail_rocket_bomb: {
    id: 'hammer_rail_rocket_bomb',
    weaponId: 'adamant_rail',
    displayName: 'Rocket Bomb',
    description: 'Special fires a fast straight rocket dealing 80 base damage.',
  },
};

// ============================================================================
// Patrons (10 Clean-Room Patrons + Exact Colors + Internal Retail LootData Keys)
// ============================================================================

export interface PatronDef {
  id: PatronId;
  displayName: string;
  title: string;
  retailLootKey: string;
  colorHex: string;
  accentHex: string;
  primaryStatus: StatusEffectId | null;
}

export const PATRON_CONSTANTS: Record<PatronId, PatronDef> = {
  voltaris: {
    id: 'voltaris',
    displayName: 'Voltaris',
    title: 'Lord of Storms',
    retailLootKey: 'ZeusUpgrade',
    colorHex: '#FFFA40',
    accentHex: '#FFF599',
    primaryStatus: 'jolted',
  },
  tidebreaker: {
    id: 'tidebreaker',
    displayName: 'Tidebreaker',
    title: 'Sovereign of Tides',
    retailLootKey: 'PoseidonUpgrade',
    colorHex: '#00C8FF',
    accentHex: '#94E8FF',
    primaryStatus: 'ruptured',
  },
  aegira: {
    id: 'aegira',
    displayName: 'Aegira',
    title: 'Warden of Valor',
    retailLootKey: 'AthenaUpgrade',
    colorHex: '#FDBD31',
    accentHex: '#FFE49E',
    primaryStatus: 'exposed',
  },
  velouris: {
    id: 'velouris',
    displayName: 'Velouris',
    title: 'Mistress of Allure',
    retailLootKey: 'AphroditeUpgrade',
    colorHex: '#FF32F0',
    accentHex: '#FFADF9',
    primaryStatus: 'weak',
  },
  sylvara: {
    id: 'sylvara',
    displayName: 'Sylvara',
    title: 'Stalker of the Wilds',
    retailLootKey: 'ArtemisUpgrade',
    colorHex: '#6EFF00',
    accentHex: '#C2FF94',
    primaryStatus: 'marked',
  },
  bellum: {
    id: 'bellum',
    displayName: 'Bellum',
    title: 'Herald of Slaughter',
    retailLootKey: 'AresUpgrade',
    colorHex: '#FF1400',
    accentHex: '#FF8D82',
    primaryStatus: 'doom',
  },
  bacchion: {
    id: 'bacchion',
    displayName: 'Bacchion',
    title: 'Prince of Revelry',
    retailLootKey: 'DionysusUpgrade',
    colorHex: '#C800FF',
    accentHex: '#E594FF',
    primaryStatus: 'hangover',
  },
  glaciera: {
    id: 'glaciera',
    displayName: 'Glaciera',
    title: 'Matron of Frost',
    retailLootKey: 'DemeterUpgrade',
    colorHex: '#60BDFF',
    accentHex: '#BEE3FF',
    primaryStatus: 'chill',
  },
  veloce: {
    id: 'veloce',
    displayName: 'Veloce',
    title: 'Herald of Swiftness',
    retailLootKey: 'HermesUpgrade',
    colorHex: '#FF5A00',
    accentHex: '#FFB58A',
    primaryStatus: null,
  },
  abyssos: {
    id: 'abyssos',
    displayName: 'Abyssos',
    title: 'Primordial Void',
    retailLootKey: 'TrialUpgrade',
    colorHex: '#6419FF',
    accentHex: '#B694FF',
    primaryStatus: null,
  },
};

// ============================================================================
// Bosses & Biomes
// ============================================================================

export interface BossDef {
  id: BossId;
  displayName: string;
  title: string;
  biome: BiomeId;
  maxHp: number;
  phases: number;
  phaseHp: readonly number[];
  phaseThresholds: readonly number[];
  optional?: boolean;
  shieldThresholds?: readonly number[];
  headWaves?: readonly number[];
  em4MaxHp?: number;
  em4Phases?: number;
  em4PhaseHp?: readonly number[];
}

export const BOSS_CONSTANTS: Record<BossId, BossDef> = {
  warden_malice: {
    id: 'warden_malice',
    displayName: 'Warden Malice',
    title: 'First of the Wardens',
    biome: 'obsidian_pit',
    maxHp: 4400,
    phases: 1,
    phaseHp: [4400],
    phaseThresholds: [0.75, 0.5, 0.25],
  },
  warden_fury: {
    id: 'warden_fury',
    displayName: 'Warden Fury',
    title: 'Scourge of Rage',
    biome: 'obsidian_pit',
    maxHp: 4600,
    phases: 1,
    phaseHp: [4600],
    phaseThresholds: [0.75, 0.5, 0.25],
  },
  warden_murder: {
    id: 'warden_murder',
    displayName: 'Warden Murder',
    title: 'Avenger of Blood',
    biome: 'obsidian_pit',
    maxHp: 5200,
    phases: 1,
    phaseHp: [5200],
    phaseThresholds: [0.66, 0.33],
  },
  bone_leviathan: {
    id: 'bone_leviathan',
    displayName: 'Bone Leviathan',
    title: 'Serpent of the Mire',
    biome: 'cinder_mire',
    maxHp: 6000,
    phases: 1,
    phaseHp: [6000],
    phaseThresholds: [0.66, 0.33],
    shieldThresholds: [0.66, 0.33],
    headWaves: [3, 6],
  },
  colosseum_bull: {
    id: 'colosseum_bull',
    displayName: 'Colosseum Bull',
    title: 'Horned Juggernaut',
    biome: 'verdant_colosseum',
    maxHp: 14000,
    phases: 1,
    phaseHp: [14000],
    phaseThresholds: [0.5],
  },
  colosseum_spearlord: {
    id: 'colosseum_spearlord',
    displayName: 'Colosseum Spearlord',
    title: 'Champion of the Arena',
    biome: 'verdant_colosseum',
    maxHp: 9000,
    phases: 1,
    phaseHp: [9000],
    phaseThresholds: [0.5],
  },
  the_ferryman: {
    id: 'the_ferryman',
    displayName: 'The Ferryman',
    title: 'Keeper of the Crossing',
    biome: 'obsidian_pit',
    maxHp: 16500,
    phases: 1,
    phaseHp: [16500],
    phaseThresholds: [0.66, 0.33],
    optional: true,
  },
  sovereign_lord: {
    id: 'sovereign_lord',
    displayName: 'Sovereign Lord',
    title: 'Ruler of the Deep',
    biome: 'frozen_summit',
    maxHp: 17000,
    phases: 2,
    phaseHp: [17000, 17000],
    phaseThresholds: [0.5],
    em4MaxHp: 22000,
    em4Phases: 3,
    em4PhaseHp: [22000, 22000, 22000],
  },
};

export interface BiomeDef {
  id: BiomeId;
  displayName: string;
  order: number;
  bossDepth: number;
  wingCount?: number;
  wallSlamMultiplier: number;
  zoomRange: readonly [number, number];
  ambientLight: string;
  backdropHex: string;
  floorHex: string;
  accentHex: string;
  hasLava: boolean;
  lavaDamage?: number;
  lavaTickInterval?: number;
  lavaGraceDuration?: number;
  hasPoison: boolean;
}

export const BIOME_CONSTANTS: Record<BiomeId, BiomeDef> = {
  sanctum_hub: {
    id: 'sanctum_hub',
    displayName: 'Sanctum of Ash',
    order: 0,
    bossDepth: 0,
    wallSlamMultiplier: 1.0,
    zoomRange: SIM_CONSTANTS.biomeZoom.sanctum_hub,
    ambientLight: '#2c1e34',
    backdropHex: '#0d0914',
    floorHex: '#201829',
    accentHex: '#d99f4c',
    hasLava: false,
    hasPoison: false,
  },
  obsidian_pit: {
    id: 'obsidian_pit',
    displayName: 'Obsidian Pit',
    order: 1,
    bossDepth: 11,
    wallSlamMultiplier: 1.0,
    zoomRange: SIM_CONSTANTS.biomeZoom.obsidian_pit,
    ambientLight: '#284a3d',
    backdropHex: '#0a1514',
    floorHex: '#1b2c2a',
    accentHex: '#4de09d',
    hasLava: false,
    hasPoison: false,
  },
  cinder_mire: {
    id: 'cinder_mire',
    displayName: 'Cinder Mire',
    order: 2,
    bossDepth: 7,
    wallSlamMultiplier: 1.5,
    zoomRange: SIM_CONSTANTS.biomeZoom.cinder_mire,
    ambientLight: '#5c2818',
    backdropHex: '#190805',
    floorHex: '#331c18',
    accentHex: '#ff6a2b',
    hasLava: true,
    lavaDamage: LAVA_CONSTANTS.damage,
    lavaTickInterval: LAVA_CONSTANTS.tickInterval,
    lavaGraceDuration: LAVA_CONSTANTS.graceDuration,
    hasPoison: false,
  },
  verdant_colosseum: {
    id: 'verdant_colosseum',
    displayName: 'Verdant Colosseum',
    order: 3,
    bossDepth: 9,
    wallSlamMultiplier: 2.0,
    zoomRange: SIM_CONSTANTS.biomeZoom.verdant_colosseum,
    ambientLight: '#204a58',
    backdropHex: '#071a23',
    floorHex: '#18353f',
    accentHex: '#5ef2e6',
    hasLava: false,
    hasPoison: false,
  },
  crypt_of_bile: {
    id: 'crypt_of_bile',
    displayName: 'Crypt of Bile',
    order: 4,
    bossDepth: 5,
    wingCount: 5,
    wallSlamMultiplier: 2.5,
    zoomRange: SIM_CONSTANTS.biomeZoom.crypt_of_bile,
    ambientLight: '#3c441b',
    backdropHex: '#111508',
    floorHex: '#252a16',
    accentHex: '#a8d93b',
    hasLava: false,
    hasPoison: true,
  },
  frozen_summit: {
    id: 'frozen_summit',
    displayName: 'Frozen Summit',
    order: 5,
    bossDepth: 1,
    wallSlamMultiplier: 1.0,
    zoomRange: SIM_CONSTANTS.biomeZoom.frozen_summit,
    ambientLight: '#3f5a72',
    backdropHex: '#0c1623',
    floorHex: '#27394c',
    accentHex: '#c7ebff',
    hasLava: false,
    hasPoison: false,
  },
};

// ============================================================================
// Mirror Upgrades (12 Pairs), Shrine Vows (16), Keepsakes (16)
// ============================================================================

export interface MirrorSideDef {
  name: string;
  description: string;
  maxRank: number;
  baseCost: number;
  costStep: number;
  valuePerRank: number;
}

export interface MirrorUpgradeDef {
  id: MirrorUpgradeId;
  row: number;
  sideA: MirrorSideDef;
  sideB: MirrorSideDef;
}

export const MIRROR_UPGRADES: Record<MirrorUpgradeId, MirrorUpgradeDef> = {
  shadow_presence: {
    id: 'shadow_presence',
    row: 1,
    sideA: {
      name: 'Shadow Presence',
      description: '+10% backstab damage per rank.',
      maxRank: 5,
      baseCost: 10,
      costStep: 15,
      valuePerRank: 0.1,
    },
    sideB: {
      name: 'Fiery Presence',
      description: '+15% damage per rank against undamaged foes.',
      maxRank: 5,
      baseCost: 10,
      costStep: 15,
      valuePerRank: 0.15,
    },
  },
  cinder_vitality: {
    id: 'cinder_vitality',
    row: 2,
    sideA: {
      name: 'Cinder Vitality',
      description: 'Restore 1 HP per rank whenever you enter a chamber.',
      maxRank: 3,
      baseCost: 10,
      costStep: 20,
      valuePerRank: 1,
    },
    sideB: {
      name: 'Dark Regeneration',
      description: 'Restore 30% of Darkness collected as HP per rank.',
      maxRank: 2,
      baseCost: 30,
      costStep: 60,
      valuePerRank: 0.3,
    },
  },
  death_defiance: {
    id: 'death_defiance',
    row: 3,
    sideA: {
      name: 'Death Defiance',
      description: 'Restore 50% HP instead of dying (1 charge per rank).',
      maxRank: 3,
      baseCost: 30,
      costStep: 470,
      valuePerRank: 1,
    },
    sideB: {
      name: 'Stubborn Defiance',
      description: 'Restore 30% HP once per chamber instead of dying.',
      maxRank: 1,
      baseCost: 600,
      costStep: 0,
      valuePerRank: 1,
    },
  },
  greater_reflex: {
    id: 'greater_reflex',
    row: 4,
    sideA: {
      name: 'Greater Reflex',
      description: '+1 Dash charge in a row.',
      maxRank: 1,
      baseCost: 50,
      costStep: 0,
      valuePerRank: 1,
    },
    sideB: {
      name: 'Ruthless Reflex',
      description: 'Near-miss Dash grants +50% damage & dodge for 2s.',
      maxRank: 1,
      baseCost: 75,
      costStep: 0,
      valuePerRank: 0.5,
    },
  },
  boiling_blood: {
    id: 'boiling_blood',
    row: 5,
    sideA: {
      name: 'Boiling Blood',
      description: '+10% Attack & Special damage per rank to foes with lodged Bloodstones.',
      maxRank: 5,
      baseCost: 10,
      costStep: 20,
      valuePerRank: 0.1,
    },
    sideB: {
      name: 'Abyssal Blood',
      description: 'Foes with lodged Bloodstones move and deal -6% damage per rank.',
      maxRank: 5,
      baseCost: 20,
      costStep: 30,
      valuePerRank: 0.06,
    },
  },
  infernal_soul: {
    id: 'infernal_soul',
    row: 6,
    sideA: {
      name: 'Infernal Soul',
      description: '+1 Cast Bloodstone per rank.',
      maxRank: 2,
      baseCost: 20,
      costStep: 60,
      valuePerRank: 1,
    },
    sideB: {
      name: 'Stygian Soul',
      description: 'Cast regenerates every 3s (-1s per rank) instead of dropping.',
      maxRank: 2,
      baseCost: 60,
      costStep: 60,
      valuePerRank: 1,
    },
  },
  deep_pockets: {
    id: 'deep_pockets',
    row: 7,
    sideA: {
      name: 'Deep Pockets',
      description: 'Start each run with +20 Gold per rank.',
      maxRank: 5,
      baseCost: 30,
      costStep: 5,
      valuePerRank: 20,
    },
    sideB: {
      name: 'Golden Touch',
      description: 'Gain +5% interest on current Gold per rank after each biome.',
      maxRank: 3,
      baseCost: 70,
      costStep: 20,
      valuePerRank: 0.05,
    },
  },
  thick_skin: {
    id: 'thick_skin',
    row: 8,
    sideA: {
      name: 'Thick Skin',
      description: '+5 Max HP per rank (up to +50).',
      maxRank: 10,
      baseCost: 40,
      costStep: 5,
      valuePerRank: 5,
    },
    sideB: {
      name: 'High Confidence',
      description: '+5% damage per rank while at 80% HP or higher.',
      maxRank: 5,
      baseCost: 50,
      costStep: 50,
      valuePerRank: 0.05,
    },
  },
  privileged_status: {
    id: 'privileged_status',
    row: 9,
    sideA: {
      name: 'Privileged Status',
      description: '+20% damage per rank to foes afflicted by 2+ Status Curses.',
      maxRank: 2,
      baseCost: 50,
      costStep: 450,
      valuePerRank: 0.2,
    },
    sideB: {
      name: 'Family Favorite',
      description: '+2.5% damage per rank for each unique Patron blessing held.',
      maxRank: 2,
      baseCost: 50,
      costStep: 100,
      valuePerRank: 0.025,
    },
  },
  patron_favor: {
    id: 'patron_favor',
    row: 10,
    sideA: {
      name: 'Patron Favor',
      description: '+1% chance per rank for Rare Boons.',
      maxRank: 40,
      baseCost: 50,
      costStep: 0,
      valuePerRank: 0.01,
    },
    sideB: {
      name: 'Dark Foresight',
      description: '+2% chance per rank for Gold/Boon/Hammer/Pom chamber rewards.',
      maxRank: 10,
      baseCost: 150,
      costStep: 150,
      valuePerRank: 0.02,
    },
  },
  divine_pride: {
    id: 'divine_pride',
    row: 11,
    sideA: {
      name: 'Divine Pride',
      description: '+1% chance per rank for Epic Boons.',
      maxRank: 20,
      baseCost: 100,
      costStep: 0,
      valuePerRank: 0.01,
    },
    sideB: {
      name: 'Divine Legacy',
      description: '+1% chance per rank for Duo or Legendary Boons.',
      maxRank: 10,
      baseCost: 250,
      costStep: 0,
      valuePerRank: 0.01,
    },
  },
  fated_authority: {
    id: 'fated_authority',
    row: 12,
    sideA: {
      name: 'Fated Authority',
      description: '+1 dice charge per rank to reroll chamber door rewards.',
      maxRank: 8,
      baseCost: 500,
      costStep: 250,
      valuePerRank: 1,
    },
    sideB: {
      name: 'Fated Persuasion',
      description: '+1 dice charge per rank to reroll Boon and Well choices.',
      maxRank: 4,
      baseCost: 1000,
      costStep: 1000,
      valuePerRank: 1,
    },
  },
};

export interface ShrineVowDef {
  id: ShrineVowId;
  displayName: string;
  description: string;
  maxRank: number;
  heatPerRank: readonly number[];
}

export const SHRINE_VOWS: Record<ShrineVowId, ShrineVowDef> = {
  hard_labor: {
    id: 'hard_labor',
    displayName: 'Hard Labor',
    description: 'Foes deal +20% damage per rank.',
    maxRank: 5,
    heatPerRank: [1, 1, 1, 1, 1],
  },
  lasting_consequences: {
    id: 'lasting_consequences',
    displayName: 'Lasting Consequences',
    description: 'Healing effects are reduced by 25% per rank.',
    maxRank: 4,
    heatPerRank: [1, 1, 1, 1],
  },
  convenience_fee: {
    id: 'convenience_fee',
    displayName: 'Convenience Fee',
    description: 'Shop and Well items cost +40% Gold per rank.',
    maxRank: 2,
    heatPerRank: [1, 1],
  },
  jury_summons: {
    id: 'jury_summons',
    displayName: 'Jury Summons',
    description: '+20% more foes in standard encounters per rank.',
    maxRank: 3,
    heatPerRank: [1, 1, 1],
  },
  extreme_measures: {
    id: 'extreme_measures',
    displayName: 'Extreme Measures',
    description: 'Biome bosses gain deadlier phases and arenas (Rank 4 unlocks 3-phase Sovereign Lord).',
    maxRank: 4,
    heatPerRank: [1, 2, 3, 4],
  },
  calisthenics_program: {
    id: 'calisthenics_program',
    displayName: 'Calisthenics Program',
    description: 'Foes have +15% Max HP per rank.',
    maxRank: 2,
    heatPerRank: [1, 1],
  },
  benefits_package: {
    id: 'benefits_package',
    displayName: 'Benefits Package',
    description: 'Armored foes gain +1 elite perk per rank.',
    maxRank: 2,
    heatPerRank: [2, 3],
  },
  middle_management: {
    id: 'middle_management',
    displayName: 'Middle Management',
    description: 'Mini-boss encounters feature reinforced armor and escorts.',
    maxRank: 1,
    heatPerRank: [2],
  },
  underworld_customs: {
    id: 'underworld_customs',
    displayName: 'Underworld Customs',
    description: 'Must purge 1 Boon after clearing each biome.',
    maxRank: 1,
    heatPerRank: [2],
  },
  forced_overtime: {
    id: 'forced_overtime',
    displayName: 'Forced Overtime',
    description: 'Foes move and attack +20% faster per rank.',
    maxRank: 2,
    heatPerRank: [3, 3],
  },
  heightened_security: {
    id: 'heightened_security',
    displayName: 'Heightened Security',
    description: 'Traps and magma deal +400% damage.',
    maxRank: 1,
    heatPerRank: [1],
  },
  routine_inspection: {
    id: 'routine_inspection',
    displayName: 'Routine Inspection',
    description: 'Disables the bottom 3 Mirror rows per rank.',
    maxRank: 4,
    heatPerRank: [2, 2, 2, 2],
  },
  damage_control: {
    id: 'damage_control',
    displayName: 'Damage Control',
    description: 'Foes spawn with shields absorbing the first hit per rank.',
    maxRank: 2,
    heatPerRank: [1, 1],
  },
  approval_process: {
    id: 'approval_process',
    displayName: 'Approval Process',
    description: 'Removes 1 choice from Boon and Hammer offers per rank.',
    maxRank: 2,
    heatPerRank: [2, 3],
  },
  tight_deadline: {
    id: 'tight_deadline',
    displayName: 'Tight Deadline',
    description: 'Biome timer limited to 9m / 7m / 5m per rank.',
    maxRank: 3,
    heatPerRank: [1, 2, 3],
  },
  personal_liability: {
    id: 'personal_liability',
    displayName: 'Personal Liability',
    description: 'Disables post-hit invulnerability frames.',
    maxRank: 1,
    heatPerRank: [1],
  },
};

export interface KeepsakeDef {
  id: KeepsakeId;
  displayName: string;
  description: string;
  forcedPatron?: PatronId;
  valuesByRank: readonly [number, number, number];
}

export const KEEPSAKES: Record<KeepsakeId, KeepsakeDef> = {
  old_collar: {
    id: 'old_collar',
    displayName: 'Spiked Collar',
    description: 'Gain +25/+38/+50 Max HP.',
    valuesByRank: [25, 38, 50],
  },
  lucky_fang: {
    id: 'lucky_fang',
    displayName: 'Lucky Fang',
    description: 'Restore 50/75/100 HP automatically once when reduced to 0.',
    valuesByRank: [50, 75, 100],
  },
  bone_sandglass: {
    id: 'bone_sandglass',
    displayName: 'Bone Sandglass',
    description: 'Well of Ash items last +4/+6/+8 encounters.',
    valuesByRank: [4, 6, 8],
  },
  coin_pouch: {
    id: 'coin_pouch',
    displayName: 'Gilded Pouch',
    description: 'Gain +100/+125/+150 Gold once per run.',
    valuesByRank: [100, 125, 150],
  },
  evergreen_acorn: {
    id: 'evergreen_acorn',
    displayName: 'Evergreen Acorn',
    description: 'Ignore the first 3/4/5 hits in the final encounter of a biome.',
    valuesByRank: [3, 4, 5],
  },
  shattered_shackle: {
    id: 'shattered_shackle',
    displayName: 'Shattered Shackle',
    description: 'Unbooned Attack, Special, and Cast deal +50%/+75%/+100% damage.',
    valuesByRank: [0.5, 0.75, 1.0],
  },
  pierced_plume: {
    id: 'pierced_plume',
    displayName: 'Pierced Plume',
    description: 'Fast room clears grant +1%/+1.1%/+1.2% Dodge and Move Speed.',
    valuesByRank: [0.01, 0.011, 0.012],
  },
  obsidian_shawl: {
    id: 'obsidian_shawl',
    displayName: 'Obsidian Shawl',
    description: '+10%/+15%/+20% damage to undamaged foes and from behind.',
    valuesByRank: [0.1, 0.15, 0.2],
  },
  thunder_signet: {
    id: 'thunder_signet',
    displayName: 'Thunder Signet',
    description: 'Next Boon is from Voltaris with +10%/+15%/+20% Rare chance.',
    forcedPatron: 'voltaris',
    valuesByRank: [0.1, 0.15, 0.2],
  },
  conch_shell: {
    id: 'conch_shell',
    displayName: 'Conch Shell',
    description: 'Next Boon is from Tidebreaker with +10%/+15%/+20% Rare chance.',
    forcedPatron: 'tidebreaker',
    valuesByRank: [0.1, 0.15, 0.2],
  },
  owl_pendant: {
    id: 'owl_pendant',
    displayName: 'Owl Pendant',
    description: 'Next Boon is from Aegira with +10%/+15%/+20% Rare chance.',
    forcedPatron: 'aegira',
    valuesByRank: [0.1, 0.15, 0.2],
  },
  eternal_rose: {
    id: 'eternal_rose',
    displayName: 'Eternal Rose',
    description: 'Next Boon is from Velouris with +10%/+15%/+20% Rare chance.',
    forcedPatron: 'velouris',
    valuesByRank: [0.1, 0.15, 0.2],
  },
  adamant_arrowhead: {
    id: 'adamant_arrowhead',
    displayName: 'Adamant Arrowhead',
    description: 'Next Boon is from Sylvara with +10%/+15%/+20% Rare chance.',
    forcedPatron: 'sylvara',
    valuesByRank: [0.1, 0.15, 0.2],
  },
  blood_vial: {
    id: 'blood_vial',
    displayName: 'Blood Vial',
    description: 'Next Boon is from Bellum with +10%/+15%/+20% Rare chance.',
    forcedPatron: 'bellum',
    valuesByRank: [0.1, 0.15, 0.2],
  },
  overflowing_chalice: {
    id: 'overflowing_chalice',
    displayName: 'Overflowing Chalice',
    description: 'Next Boon is from Bacchion with +10%/+15%/+20% Rare chance.',
    forcedPatron: 'bacchion',
    valuesByRank: [0.1, 0.15, 0.2],
  },
  frostbitten_horn: {
    id: 'frostbitten_horn',
    displayName: 'Frostbitten Horn',
    description: 'Next Boon is from Glaciera with +10%/+15%/+20% Rare chance.',
    forcedPatron: 'glaciera',
    valuesByRank: [0.1, 0.15, 0.2],
  },
};

// ============================================================================
// Runtime Simulation Types (Pure Data, Serializable, Deterministic)
// ============================================================================

export interface Vec2 {
  x: number;
  y: number;
}

export interface InputFrame {
  tick: number;
  moveX: number;
  moveY: number;
  aimDirX: number;
  aimDirY: number;
  aimWorldX: number;
  aimWorldY: number;
  hasAimWorld: boolean;
  attack: boolean;
  attackPressed: boolean;
  special: boolean;
  specialPressed: boolean;
  cast: boolean;
  castPressed: boolean;
  dash: boolean;
  dashPressed: boolean;
  call: boolean;
  callPressed: boolean;
  reload: boolean;
  reloadPressed: boolean;
  interact: boolean;
  interactPressed: boolean;
  pausePressed: boolean;
  boonSelectIndex: number | null;
  rerollPressed?: boolean;
  source: InputSource;
}

export const EMPTY_INPUT_FRAME: Readonly<InputFrame> = {
  tick: 0,
  moveX: 0,
  moveY: 0,
  aimDirX: 1,
  aimDirY: 0,
  aimWorldX: 0,
  aimWorldY: 0,
  hasAimWorld: false,
  attack: false,
  attackPressed: false,
  special: false,
  specialPressed: false,
  cast: false,
  castPressed: false,
  dash: false,
  dashPressed: false,
  call: false,
  callPressed: false,
  reload: false,
  reloadPressed: false,
  interact: false,
  interactPressed: false,
  pausePressed: false,
  boonSelectIndex: null,
  rerollPressed: false,
  source: 'keyboard',
};

export interface ActiveStatus {
  id: StatusEffectId;
  remaining: number;
  stacks: number;
  tickTimer: number;
  magnitude: number;
  sourceId?: string;
}

export interface DashGhost {
  x: number;
  y: number;
  angle: number;
  alpha: number;
  life: number;
}

export interface BoonInstance {
  id: string;
  patronId: PatronId;
  name: string;
  description: string;
  slot: BoonSlot;
  rarity: BoonRarity;
  level: number;
  baseValue: number;
  scaledValue: number;
  secondaryValue?: number;
  statusEffect?: StatusEffectId;
  prerequisiteIds?: readonly string[];
  duoPatrons?: readonly [PatronId, PatronId];
}

export interface BoonOfferOption {
  id: string;
  kind: 'boon' | 'hammer' | 'pom_upgrade' | 'chaos_blessing' | 'well_item';
  name: string;
  description: string;
  rarity: BoonRarity;
  patronId?: PatronId;
  slot?: BoonSlot;
  hammerId?: HammerId;
  boonId?: string;
  previewValue?: string;
  curseDescription?: string;
  curseEncounters?: number;
  replacesBoonId?: string;
}

export interface BoonOffer {
  source: 'patron' | 'hammer' | 'pom' | 'chaos' | 'well';
  patronId?: PatronId;
  title: string;
  subtitle?: string;
  options: BoonOfferOption[];
  rerollsRemaining: number;
}

export interface ChaosCurse {
  id: string;
  curseKind:
    | 'take_damage_on_attack'
    | 'take_damage_on_special'
    | 'take_damage_on_cast'
    | 'take_damage_on_dash'
    | 'reduced_move_speed'
    | 'extra_damage_taken'
    | 'hidden_door_rewards'
    | 'no_gold_gain';
  curseMagnitude: number;
  encountersRemaining: number;
  blessingBoon: BoonInstance;
}

export interface PlayerState {
  pos: Vec2;
  vel: Vec2;
  facingAngle: number;
  facingIdx: number;
  hp: number;
  maxHp: number;
  armor: number;
  deathDefiances: number;
  maxDeathDefiances: number;
  weaponId: WeaponId;
  aspectId: AspectId;
  hammers: HammerId[];
  ammo: number;
  maxAmmo: number;
  reloadTimer: number;
  castAmmo: number;
  maxCastAmmo: number;
  castRegenTimer: number;
  castCooldown: number;
  castChargeTimer: number;
  dashCharges: number;
  maxDashCharges: number;
  dashRegenTimer: number;
  dashCooldown: number;
  dashTimer: number;
  dashDir: Vec2;
  dashStartPos: Vec2;
  dashStrikeWindowTimer: number;
  perfectDashTimer: number;
  dashGhosts: DashGhost[];
  attackComboStep: number;
  attackTimer: number;
  attackChargeTimer: number;
  attackRecoveryTimer: number;
  attackBufferTimer: number;
  specialTimer: number;
  specialCooldown: number;
  isBlocking: boolean;
  spearOut: boolean;
  shieldOut: boolean;
  iframeTimer: number;
  cumulativeDamageWindowTimer: number;
  cumulativeDamageInWindow: number;
  godGauge: number;
  godCallActiveTimer: number;
  godCallPatron: PatronId | null;
  greaterCallSlowTimer: number;
  lavaGraceTimer: number;
  lavaTickTimer: number;
  inLava: boolean;
  inPoison: boolean;
  statuses: ActiveStatus[];
  gold: number;
  boons: BoonInstance[];
  chaosCurses: ChaosCurse[];
  keepsakeId: KeepsakeId | null;
  keepsakeUsed: boolean;
  acornShields: number;
  plumeBonus: number;
  empoweredAttacks: number;
  consecutiveHits: number;
  eruptBuffTimer: number;
  hitstopTimer: number;
  isDead: boolean;
}

export interface EnemyState {
  id: string;
  archetype: EnemyArchetypeId;
  name: string;
  isBoss: boolean;
  isMiniBoss: boolean;
  bossId?: BossId;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  facingAngle: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  phase: number;
  maxPhases: number;
  invulnerable: boolean;
  invulnTimer: number;
  aiState:
    | 'spawning'
    | 'idle'
    | 'chase'
    | 'windup'
    | 'attack'
    | 'recover'
    | 'stunned'
    | 'phase_transition'
    | 'dead';
  aiTimer: number;
  attackCooldown: number;
  attackPatternIdx: number;
  stunTimer: number;
  lodgedCasts: number;
  lodgedCastTimers: number[];
  statuses: ActiveStatus[];
  hitFlashTimer: number;
  hitstopTimer: number;
  damageControlHits: number;
  targetPos?: Vec2;
  parentBossId?: string;
}

export interface ProjectileState {
  id: string;
  owner: 'player' | 'enemy' | 'hazard';
  ownerId: string;
  kind:
    | 'arrow'
    | 'bullet'
    | 'bomb'
    | 'cast'
    | 'spear'
    | 'shield'
    | 'orb'
    | 'wave'
    | 'beam'
    | 'dart'
    | 'lightning'
    | 'blade_rift'
    | 'skull'
    | 'laser';
  pos: Vec2;
  vel: Vec2;
  startPos: Vec2;
  radius: number;
  angle: number;
  damage: number;
  range: number;
  distanceTraveled: number;
  life: number;
  maxLife: number;
  pierceLeft: number;
  bouncesLeft: number;
  deflectable: boolean;
  deflected: boolean;
  homingStrength: number;
  isLob: boolean;
  lobHeight: number;
  lobDuration: number;
  lobElapsed: number;
  targetPos?: Vec2;
  aoeRadius?: number;
  patronId?: PatronId;
  statusToApply?: StatusEffectId;
  critBonus?: number;
  lodgesCast?: boolean;
  returning?: boolean;
  hitIds: string[];
  colorHex?: string;
}

export interface HazardState {
  id: string;
  kind:
    | 'lava_pool'
    | 'poison_pool'
    | 'spike_trap'
    | 'dart_trap'
    | 'arrow_trap'
    | 'sawblade'
    | 'urn'
    | 'pylon'
    | 'consecrated_aura'
    | 'curing_pool'
    | 'boiling_geyser'
    | 'rift_vortex';
  pos: Vec2;
  radius: number;
  width?: number;
  height?: number;
  active: boolean;
  armed: boolean;
  timer: number;
  cooldown: number;
  damage: number;
  owner: 'environment' | 'player' | 'enemy';
  hp?: number;
}

export interface BloodstoneDrop {
  id: string;
  pos: Vec2;
  vel: Vec2;
  life: number;
  magnetizing: boolean;
}

export interface PickupItem {
  id: string;
  kind: PickupKind;
  pos: Vec2;
  radius: number;
  label: string;
  costGold: number;
  patronId?: PatronId;
  amount?: number;
  collected: boolean;
  rarityHint?: BoonRarity;
  colorHex?: string;
}

export interface ArenaObstacle {
  id: string;
  kind: 'pillar' | 'wall' | 'pit' | 'statue' | 'destructible_urn' | 'gate';
  pos: Vec2;
  halfW: number;
  halfH: number;
  radius?: number;
  blocksMovement: boolean;
  blocksProjectiles: boolean;
  destructible: boolean;
  hp?: number;
  maxHp?: number;
}

export interface RewardPreview {
  kind: PickupKind;
  patronId?: PatronId;
  label: string;
  isMiniBoss?: boolean;
  isBoss?: boolean;
  isShop?: boolean;
  isStory?: boolean;
  isTrial?: boolean;
  isChaos?: boolean;
}

export interface ArenaDoor {
  id: string;
  pos: Vec2;
  direction: 'north' | 'east' | 'west' | 'south' | 'portal';
  locked: boolean;
  reward: RewardPreview;
  targetBiome?: BiomeId;
  isChaosGate?: boolean;
  chaosHpCost?: number;
}

export interface TelegraphShape {
  id: string;
  kind: 'circle' | 'cone' | 'line' | 'ring' | 'rect';
  pos: Vec2;
  angle: number;
  radius: number;
  innerRadius?: number;
  length?: number;
  width?: number;
  arcDeg?: number;
  progress: number;
  duration: number;
  elapsed: number;
  dangerColor: string;
  ownerId?: string;
}

export interface FloatingNumber {
  id: string;
  pos: Vec2;
  vel: Vec2;
  value: number | string;
  kind:
    | 'normal'
    | 'crit'
    | 'backstab'
    | 'status'
    | 'heal'
    | 'armor'
    | 'dodge'
    | 'deflect'
    | 'blocked'
    | 'gold';
  colorHex: string;
  life: number;
  maxLife: number;
}

export interface RoomState {
  biome: BiomeId;
  depth: number;
  roomIndex: number;
  templateId: string;
  encounterKind: EncounterKind;
  width: number;
  height: number;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  waveIndex: number;
  totalWaves: number;
  cleared: boolean;
  combatStarted: boolean;
  encounterTimer: number;
  noDamageTaken: boolean;
  obstacles: ArenaObstacle[];
  doors: ArenaDoor[];
  hazards: HazardState[];
  pickups: PickupItem[];
  bloodstones: BloodstoneDrop[];
  telegraphs: TelegraphShape[];
  zoom: number;
  styxWingsCleared?: number;
  satyrSackFound?: boolean;
  trialPatronA?: PatronId;
  trialPatronB?: PatronId;
  trialSpurnedPatron?: PatronId;
}

export interface RunState {
  seed: number;
  runNumber: number;
  active: boolean;
  inHub: boolean;
  victory: boolean;
  defeat: boolean;
  paused: boolean;
  heat: number;
  vows: Partial<Record<ShrineVowId, number>>;
  godModeEnabled: boolean;
  tightDeadlineTimer: number | null;
  biomeOrderIndex: number;
  chambersCleared: number;
  kills: number;
  bossesDefeated: BossId[];
  elapsedSeconds: number;
  damageDealt: number;
  damageTaken: number;
  pendingOffer: BoonOffer | null;
  boonRerolls: number;
  doorRerolls: number;
  seenPatrons: PatronId[];
  hammersCollected: number;
  finalKillSlowTimer: number;
}

export interface RenderSettings {
  targetFps: 30 | 60 | 120;
  classicSnap60Hz: boolean;
  packMode: 'BUILTIN' | 'CUSTOM_PACK';
  screenShake: boolean;
  hitFlash: boolean;
  showDamageNumbers: boolean;
  showFps: boolean;
  showTouchControls: 'auto' | 'always' | 'off';
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export const DEFAULT_RENDER_SETTINGS: Readonly<RenderSettings> = {
  targetFps: 120,
  classicSnap60Hz: false,
  packMode: 'BUILTIN',
  screenShake: true,
  hitFlash: true,
  showDamageNumbers: true,
  showFps: false,
  showTouchControls: 'auto',
  masterVolume: 0.8,
  musicVolume: 0.65,
  sfxVolume: 0.85,
  muted: false,
};

export interface MetaSaveState {
  version: number;
  darkness: number;
  gemstones: number;
  keys: number;
  nectar: number;
  titanBlood: number;
  diamonds: number;
  ambrosia: number;
  totalRuns: number;
  totalClears: number;
  totalDeaths: number;
  bestClearTimeSeconds: number | null;
  highestHeatCleared: number;
  godModeEnabled: boolean;
  godModeDeaths: number;
  selectedWeapon: WeaponId;
  selectedAspects: Record<WeaponId, AspectId>;
  unlockedWeapons: WeaponId[];
  aspectRanks: Partial<Record<AspectId, number>>;
  selectedKeepsake: KeepsakeId | null;
  unlockedKeepsakes: KeepsakeId[];
  keepsakeRanks: Partial<Record<KeepsakeId, number>>;
  mirrorRanks: Record<MirrorUpgradeId, number>;
  mirrorActiveSide: Record<MirrorUpgradeId, 'a' | 'b'>;
  shrineVows: Partial<Record<ShrineVowId, number>>;
  codexKills: Partial<Record<EnemyArchetypeId, number>>;
  codexBoonsSeen: string[];
  settings: RenderSettings;
}

export type SimEvent =
  | {
      type: 'attack_swing';
      weaponId: WeaponId;
      pos: Vec2;
      angle: number;
      comboStep: number;
      isDashStrike: boolean;
    }
  | {
      type: 'special_cast';
      weaponId: WeaponId;
      pos: Vec2;
      angle: number;
    }
  | {
      type: 'bloodstone_fired';
      pos: Vec2;
      angle: number;
      patronId?: PatronId;
    }
  | {
      type: 'dash';
      pos: Vec2;
      endPos: Vec2;
      angle: number;
      perfect: boolean;
      patronId?: PatronId;
    }
  | {
      type: 'damage';
      targetId: string;
      targetKind: 'player' | 'enemy';
      pos: Vec2;
      amount: number;
      crit: boolean;
      backstab: boolean;
      armorBroken: boolean;
      wallSlam: boolean;
      statusId?: StatusEffectId;
    }
  | {
      type: 'deflect';
      pos: Vec2;
      projectileId: string;
    }
  | {
      type: 'enemy_spawn';
      enemyId: string;
      archetype: EnemyArchetypeId;
      pos: Vec2;
      isBoss: boolean;
    }
  | {
      type: 'enemy_death';
      enemyId: string;
      archetype: EnemyArchetypeId;
      pos: Vec2;
      isBoss: boolean;
      finalInRoom: boolean;
    }
  | {
      type: 'boss_phase';
      bossId: BossId;
      phase: number;
      pos: Vec2;
    }
  | {
      type: 'status_applied';
      targetId: string;
      statusId: StatusEffectId;
      pos: Vec2;
      stacks: number;
    }
  | {
      type: 'status_triggered';
      targetId: string;
      statusId: StatusEffectId;
      pos: Vec2;
      damage: number;
    }
  | {
      type: 'pickup_collected';
      kind: PickupKind;
      pos: Vec2;
      label: string;
      patronId?: PatronId;
    }
  | {
      type: 'boon_offered';
      offer: BoonOffer;
    }
  | {
      type: 'boon_selected';
      optionId: string;
      patronId?: PatronId;
      rarity: BoonRarity;
    }
  | {
      type: 'god_call';
      patronId: PatronId;
      greater: boolean;
      pos: Vec2;
    }
  | {
      type: 'death_defiance';
      pos: Vec2;
      remaining: number;
    }
  | {
      type: 'room_cleared';
      biome: BiomeId;
      depth: number;
    }
  | {
      type: 'room_entered';
      biome: BiomeId;
      depth: number;
      encounterKind: EncounterKind;
    }
  | {
      type: 'run_ended';
      victory: boolean;
      chambersCleared: number;
      elapsedSeconds: number;
    }
  | {
      type: 'hitstop';
      duration: number;
      intensity: number;
    }
  | {
      type: 'camera_shake';
      intensity: number;
      duration: number;
    }
  | {
      type: 'rumble';
      weak: number;
      strong: number;
      durationMs: number;
    }
  | {
      type: 'ui_toast';
      text: string;
      colorHex?: string;
    };

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  shakeX: number;
  shakeY: number;
  shakeIntensity: number;
  shakeTimer: number;
}

export interface SimState {
  tick: number;
  rngState: number;
  timeScale: number;
  hitstopTimer: number;
  hitstopCooldownTimer: number;
  player: PlayerState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  floatingNumbers: FloatingNumber[];
  room: RoomState;
  run: RunState;
  meta: MetaSaveState;
  events: SimEvent[];
  camera: CameraState;
}

// ============================================================================
// Debug Bridge Interface (mounted as window.__KRUNKED_DEBUG__ in browser)
// ============================================================================

export interface DebugBridge {
  warpBiome(biome: BiomeId, depth?: number): void;
  warpBoss(bossId: BossId): void;
  giveBoon(patronId: PatronId, slot?: BoonSlot, rarity?: BoonRarity): void;
  giveHammer(hammerId?: HammerId): void;
  setWeapon(weaponId: WeaponId, aspectId?: AspectId): void;
  setHeat(heat: number, vows?: Partial<Record<ShrineVowId, number>>): void;
  setGodMode(enabled: boolean, deaths?: number): void;
  triggerTouchMode(enabled: boolean): void;
  simulateGamepad(state: Partial<InputFrame> & { connected?: boolean }): void;
  stepTicks(count: number, input?: Partial<InputFrame>): void;
  getState(): SimState;
  getHash(): string;
  resetSave(): void;
  setRenderSettings?(partial: Partial<RenderSettings>): void;
  startRun?(seed?: number): void;
  spawnEnemy?(archetype: EnemyArchetypeId, pos?: Vec2): void;
  killAllEnemies?(): void;
  healPlayer?(amount?: number): void;
}
