import {
  KEEPSAKES,
  type KeepsakeDef,
  type KeepsakeId,
  type PatronId,
} from '../contracts/index.js';

export { KEEPSAKES };

export type KeepsakeCategory = 'defense' | 'offense' | 'economy' | 'patron';

export interface KeepsakeMetaInfo {
  id: KeepsakeId;
  category: KeepsakeCategory;
  accentHex: string;
}

export const KEEPSAKE_ORDER: readonly KeepsakeId[] = [
  'old_collar',
  'lucky_fang',
  'bone_sandglass',
  'coin_pouch',
  'evergreen_acorn',
  'shattered_shackle',
  'pierced_plume',
  'obsidian_shawl',
  'thunder_signet',
  'conch_shell',
  'owl_pendant',
  'eternal_rose',
  'adamant_arrowhead',
  'blood_vial',
  'overflowing_chalice',
  'frostbitten_horn',
] as const;

export const STARTER_UNLOCKED_KEEPSAKES: readonly KeepsakeId[] = [
  'old_collar',
  'lucky_fang',
  'coin_pouch',
  'evergreen_acorn',
  'shattered_shackle',
  'thunder_signet',
  'conch_shell',
  'owl_pendant',
  'eternal_rose',
] as const;

export const KEEPSAKE_META: Record<KeepsakeId, KeepsakeMetaInfo> = {
  old_collar: { id: 'old_collar', category: 'defense', accentHex: '#d94c4c' },
  lucky_fang: { id: 'lucky_fang', category: 'defense', accentHex: '#e6d8b5' },
  bone_sandglass: { id: 'bone_sandglass', category: 'economy', accentHex: '#b48cff' },
  coin_pouch: { id: 'coin_pouch', category: 'economy', accentHex: '#f5c742' },
  evergreen_acorn: { id: 'evergreen_acorn', category: 'defense', accentHex: '#63d471' },
  shattered_shackle: { id: 'shattered_shackle', category: 'offense', accentHex: '#9da5b8' },
  pierced_plume: { id: 'pierced_plume', category: 'offense', accentHex: '#ff7a33' },
  obsidian_shawl: { id: 'obsidian_shawl', category: 'offense', accentHex: '#6f5ca8' },
  thunder_signet: { id: 'thunder_signet', category: 'patron', accentHex: '#FFFA40' },
  conch_shell: { id: 'conch_shell', category: 'patron', accentHex: '#00C8FF' },
  owl_pendant: { id: 'owl_pendant', category: 'patron', accentHex: '#FDBD31' },
  eternal_rose: { id: 'eternal_rose', category: 'patron', accentHex: '#FF32F0' },
  adamant_arrowhead: { id: 'adamant_arrowhead', category: 'patron', accentHex: '#6EFF00' },
  blood_vial: { id: 'blood_vial', category: 'patron', accentHex: '#FF1400' },
  overflowing_chalice: { id: 'overflowing_chalice', category: 'patron', accentHex: '#C800FF' },
  frostbitten_horn: { id: 'frostbitten_horn', category: 'patron', accentHex: '#60BDFF' },
};

export function getKeepsakeDef(id: KeepsakeId): KeepsakeDef {
  return KEEPSAKES[id];
}

export function getKeepsakeValue(id: KeepsakeId, rank: number): number {
  const def = KEEPSAKES[id];
  const idx = Math.max(0, Math.min(2, Math.floor(rank) - 1));
  return def.valuesByRank[idx] ?? def.valuesByRank[0];
}

export function getKeepsakeForcedPatron(id: KeepsakeId | null): PatronId | null {
  if (!id) return null;
  return KEEPSAKES[id]?.forcedPatron ?? null;
}

export function getKeepsakeForPatron(patronId: PatronId): KeepsakeId | null {
  for (const id of KEEPSAKE_ORDER) {
    if (KEEPSAKES[id].forcedPatron === patronId) {
      return id;
    }
  }
  return null;
}
