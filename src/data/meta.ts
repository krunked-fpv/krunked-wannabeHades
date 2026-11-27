import {
  ASPECT_DEFS,
  MIRROR_UPGRADES,
  SHRINE_VOWS,
  WEAPON_CONSTANTS,
  type AspectId,
  type MirrorUpgradeDef,
  type MirrorUpgradeId,
  type ShrineVowDef,
  type ShrineVowId,
  type WeaponId,
} from '../contracts/index.js';

export { MIRROR_UPGRADES, SHRINE_VOWS };

export const MIRROR_UPGRADE_ORDER: readonly MirrorUpgradeId[] = [
  'shadow_presence',
  'cinder_vitality',
  'death_defiance',
  'greater_reflex',
  'boiling_blood',
  'infernal_soul',
  'deep_pockets',
  'thick_skin',
  'privileged_status',
  'patron_favor',
  'divine_pride',
  'fated_authority',
] as const;

export const SHRINE_VOW_ORDER: readonly ShrineVowId[] = [
  'hard_labor',
  'lasting_consequences',
  'convenience_fee',
  'jury_summons',
  'extreme_measures',
  'calisthenics_program',
  'benefits_package',
  'middle_management',
  'underworld_customs',
  'forced_overtime',
  'heightened_security',
  'routine_inspection',
  'damage_control',
  'approval_process',
  'tight_deadline',
  'personal_liability',
] as const;

export const WEAPON_ORDER: readonly WeaponId[] = [
  'stygian_blade',
  'eternal_spear',
  'shield_of_chaos',
  'heart_seeking_bow',
  'twin_fists',
  'adamant_rail',
] as const;

export const DEFAULT_SELECTED_ASPECTS: Readonly<Record<WeaponId, AspectId>> = {
  stygian_blade: 'blade_scion',
  eternal_spear: 'spear_scion',
  shield_of_chaos: 'shield_scion',
  heart_seeking_bow: 'bow_scion',
  twin_fists: 'fists_scion',
  adamant_rail: 'rail_scion',
};

/**
 * Starter Mirror configuration so combat immediately feels sharp while leaving
 * meaningful Darkness progression for the 12-pair Mirror of Dusk modal.
 */
export const STARTER_MIRROR_RANKS: Readonly<Record<MirrorUpgradeId, number>> = {
  shadow_presence: 2,
  cinder_vitality: 1,
  death_defiance: 1,
  greater_reflex: 1,
  boiling_blood: 2,
  infernal_soul: 1,
  deep_pockets: 0,
  thick_skin: 5,
  privileged_status: 1,
  patron_favor: 5,
  divine_pride: 2,
  fated_authority: 1,
};

export const STARTER_MIRROR_SIDES: Readonly<Record<MirrorUpgradeId, 'a' | 'b'>> = {
  shadow_presence: 'a',
  cinder_vitality: 'a',
  death_defiance: 'a',
  greater_reflex: 'a',
  boiling_blood: 'a',
  infernal_soul: 'a',
  deep_pockets: 'a',
  thick_skin: 'a',
  privileged_status: 'a',
  patron_favor: 'a',
  divine_pride: 'a',
  fated_authority: 'b',
};

export const STARTER_CURRENCIES = {
  darkness: 300,
  gemstones: 50,
  keys: 4,
  nectar: 2,
  titanBlood: 6,
  diamonds: 0,
  ambrosia: 0,
} as const;

export const TIGHT_DEADLINE_SECONDS: readonly [number, number, number] = [540, 420, 300];

export function getMirrorUpgradeDef(id: MirrorUpgradeId): MirrorUpgradeDef {
  return MIRROR_UPGRADES[id];
}

export function getMirrorSideDef(id: MirrorUpgradeId, side: 'a' | 'b') {
  const def = MIRROR_UPGRADES[id];
  return side === 'a' ? def.sideA : def.sideB;
}

export function getMirrorUpgradeCost(
  id: MirrorUpgradeId,
  side: 'a' | 'b',
  currentRank: number
): number {
  const sideDef = getMirrorSideDef(id, side);
  if (currentRank >= sideDef.maxRank) {
    return 0;
  }
  return sideDef.baseCost + sideDef.costStep * Math.max(0, currentRank);
}

export function getMirrorTotalSpentForId(
  id: MirrorUpgradeId,
  side: 'a' | 'b',
  rank: number
): number {
  const clamped = Math.max(0, Math.floor(rank));
  let total = 0;
  for (let r = 0; r < clamped; r++) {
    total += getMirrorUpgradeCost(id, side, r);
  }
  return total;
}

export function getMirrorRankValue(
  id: MirrorUpgradeId,
  side: 'a' | 'b',
  rank: number
): number {
  const sideDef = getMirrorSideDef(id, side);
  const clamped = Math.max(0, Math.min(sideDef.maxRank, Math.floor(rank)));
  return clamped * sideDef.valuePerRank;
}

export function getAspectUpgradeCost(aspectId: AspectId, currentRank: number): number {
  const def = ASPECT_DEFS[aspectId];
  if (!def || currentRank >= def.maxRank) return 0;
  if (currentRank <= 0) {
    return def.isHiddenAspect ? 3 : 1;
  }
  const base = def.isHiddenAspect ? 2 : 1;
  return base + Math.max(0, currentRank - 1);
}

export function getShrineVowDef(id: ShrineVowId): ShrineVowDef {
  return SHRINE_VOWS[id];
}

export function getShrineVowHeat(id: ShrineVowId, rank: number): number {
  const def = SHRINE_VOWS[id];
  const clamped = Math.max(0, Math.min(def.maxRank, Math.floor(rank)));
  let total = 0;
  for (let i = 0; i < clamped; i++) {
    total += def.heatPerRank[i] ?? 0;
  }
  return total;
}

export function getDefaultAspectForWeapon(weaponId: WeaponId): AspectId {
  return DEFAULT_SELECTED_ASPECTS[weaponId] ?? WEAPON_CONSTANTS[weaponId].aspects[0];
}

export function isValidAspectForWeapon(weaponId: WeaponId, aspectId: AspectId): boolean {
  const aspect = ASPECT_DEFS[aspectId];
  return Boolean(aspect && aspect.weaponId === weaponId);
}
