import {
  ASPECT_DEFS,
  type AspectDef,
  type AspectId,
  type WeaponId,
} from '../contracts/index.js';

export const ASPECTS: Readonly<Record<AspectId, AspectDef>> = ASPECT_DEFS;

export const ASPECT_IDS: readonly AspectId[] = Object.keys(ASPECT_DEFS) as AspectId[];

export function getAspectDef(id: AspectId): AspectDef {
  return ASPECT_DEFS[id];
}

export function getAspectsForWeapon(weaponId: WeaponId): AspectDef[] {
  return ASPECT_IDS.map((id) => ASPECT_DEFS[id]).filter((def) => def.weaponId === weaponId);
}

export function getAspectRank(
  aspectRanks: Partial<Record<AspectId, number>>,
  aspectId: AspectId,
): number {
  const def = ASPECT_DEFS[aspectId];
  const raw = aspectRanks[aspectId] ?? 1;
  return Math.max(1, Math.min(def.maxRank, Math.floor(raw)));
}

export function getAspectBonus(
  aspectId: AspectId,
  rank: number,
): number {
  const def = ASPECT_DEFS[aspectId];
  const clamped = Math.max(1, Math.min(def.maxRank, Math.floor(rank)));
  return def.bonusPerRank * clamped;
}
