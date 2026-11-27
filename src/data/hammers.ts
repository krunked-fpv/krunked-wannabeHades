import {
  HAMMER_DEFS,
  type HammerDef,
  type HammerId,
  type PlayerState,
  type WeaponId,
} from '../contracts/index.js';

export const HAMMERS: Readonly<Record<HammerId, HammerDef>> = HAMMER_DEFS;

export const HAMMER_IDS: readonly HammerId[] = Object.keys(HAMMER_DEFS) as HammerId[];

export function getHammerDef(id: HammerId): HammerDef {
  return HAMMER_DEFS[id];
}

export function getHammersForWeapon(weaponId: WeaponId): HammerDef[] {
  return HAMMER_IDS.map((id) => HAMMER_DEFS[id]).filter((def) => def.weaponId === weaponId);
}

export function hasHammer(player: Pick<PlayerState, 'hammers'>, hammerId: HammerId): boolean {
  return player.hammers.includes(hammerId);
}
