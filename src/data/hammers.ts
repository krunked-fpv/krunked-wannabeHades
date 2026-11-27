import {
  HAMMER_DEFS,
  type HammerDef,
  type HammerId,
  type PlayerState,
  type WeaponId,
} from '../contracts/index.js';

export type HammerCategory = 'attack' | 'dash_strike' | 'special' | 'defense' | 'utility';

export interface HammerMeta {
  id: HammerId;
  weaponId: WeaponId;
  category: HammerCategory;
  incompatibleWith?: readonly HammerId[];
}

export const HAMMERS: Readonly<Record<HammerId, HammerDef>> = HAMMER_DEFS;

export const HAMMER_IDS: readonly HammerId[] = Object.keys(HAMMER_DEFS) as HammerId[];

export const HAMMER_META: Readonly<Record<HammerId, HammerMeta>> = {
  // Stygian Blade (6)
  hammer_blade_double_edge: { id: 'hammer_blade_double_edge', weaponId: 'stygian_blade', category: 'dash_strike' },
  hammer_blade_cruel_thrust: { id: 'hammer_blade_cruel_thrust', weaponId: 'stygian_blade', category: 'attack', incompatibleWith: ['hammer_blade_flurry_slash'] },
  hammer_blade_flurry_slash: { id: 'hammer_blade_flurry_slash', weaponId: 'stygian_blade', category: 'attack', incompatibleWith: ['hammer_blade_cruel_thrust'] },
  hammer_blade_shadow_slash: { id: 'hammer_blade_shadow_slash', weaponId: 'stygian_blade', category: 'attack' },
  hammer_blade_cursed_slash: { id: 'hammer_blade_cursed_slash', weaponId: 'stygian_blade', category: 'utility' },
  hammer_blade_super_nova: { id: 'hammer_blade_super_nova', weaponId: 'stygian_blade', category: 'special' },
  // Eternal Spear (6)
  hammer_spear_extending_jab: { id: 'hammer_spear_extending_jab', weaponId: 'eternal_spear', category: 'attack' },
  hammer_spear_flurry_jab: { id: 'hammer_spear_flurry_jab', weaponId: 'eternal_spear', category: 'attack', incompatibleWith: ['hammer_spear_quick_spin'] },
  hammer_spear_serrated_point: { id: 'hammer_spear_serrated_point', weaponId: 'eternal_spear', category: 'dash_strike' },
  hammer_spear_exploding_launcher: { id: 'hammer_spear_exploding_launcher', weaponId: 'eternal_spear', category: 'special', incompatibleWith: ['hammer_spear_charged_skewer'] },
  hammer_spear_charged_skewer: { id: 'hammer_spear_charged_skewer', weaponId: 'eternal_spear', category: 'special', incompatibleWith: ['hammer_spear_exploding_launcher'] },
  hammer_spear_quick_spin: { id: 'hammer_spear_quick_spin', weaponId: 'eternal_spear', category: 'attack', incompatibleWith: ['hammer_spear_flurry_jab'] },
  // Shield of Chaos (6)
  hammer_shield_sudden_rush: { id: 'hammer_shield_sudden_rush', weaponId: 'shield_of_chaos', category: 'attack' },
  hammer_shield_charged_shot: { id: 'hammer_shield_charged_shot', weaponId: 'shield_of_chaos', category: 'attack' },
  hammer_shield_pulverizing_blow: { id: 'hammer_shield_pulverizing_blow', weaponId: 'shield_of_chaos', category: 'attack' },
  hammer_shield_dread_flight: { id: 'hammer_shield_dread_flight', weaponId: 'shield_of_chaos', category: 'special' },
  hammer_shield_explosive_return: { id: 'hammer_shield_explosive_return', weaponId: 'shield_of_chaos', category: 'special' },
  hammer_shield_ferocious_guard: { id: 'hammer_shield_ferocious_guard', weaponId: 'shield_of_chaos', category: 'defense' },
  // Heart-Seeking Bow (6)
  hammer_bow_twin_shot: { id: 'hammer_bow_twin_shot', weaponId: 'heart_seeking_bow', category: 'attack' },
  hammer_bow_flurry_shot: { id: 'hammer_bow_flurry_shot', weaponId: 'heart_seeking_bow', category: 'attack', incompatibleWith: ['hammer_bow_perfect_shot'] },
  hammer_bow_perfect_shot: { id: 'hammer_bow_perfect_shot', weaponId: 'heart_seeking_bow', category: 'attack', incompatibleWith: ['hammer_bow_flurry_shot'] },
  hammer_bow_point_blank_shot: { id: 'hammer_bow_point_blank_shot', weaponId: 'heart_seeking_bow', category: 'attack' },
  hammer_bow_relentless_volley: { id: 'hammer_bow_relentless_volley', weaponId: 'heart_seeking_bow', category: 'special' },
  hammer_bow_explosive_shot: { id: 'hammer_bow_explosive_shot', weaponId: 'heart_seeking_bow', category: 'attack' },
  // Twin Fists (6)
  hammer_fists_breaching_cross: { id: 'hammer_fists_breaching_cross', weaponId: 'twin_fists', category: 'dash_strike' },
  hammer_fists_long_knuckle: { id: 'hammer_fists_long_knuckle', weaponId: 'twin_fists', category: 'attack' },
  hammer_fists_rolling_knuckle: { id: 'hammer_fists_rolling_knuckle', weaponId: 'twin_fists', category: 'dash_strike' },
  hammer_fists_kinetic_launcher: { id: 'hammer_fists_kinetic_launcher', weaponId: 'twin_fists', category: 'special' },
  hammer_fists_quake_cutter: { id: 'hammer_fists_quake_cutter', weaponId: 'twin_fists', category: 'special' },
  hammer_fists_colossus_knuckle: { id: 'hammer_fists_colossus_knuckle', weaponId: 'twin_fists', category: 'defense' },
  // Adamant Rail (6)
  hammer_rail_spread_fire: { id: 'hammer_rail_spread_fire', weaponId: 'adamant_rail', category: 'attack', incompatibleWith: ['hammer_rail_delta_chamber'] },
  hammer_rail_delta_chamber: { id: 'hammer_rail_delta_chamber', weaponId: 'adamant_rail', category: 'attack', incompatibleWith: ['hammer_rail_spread_fire'] },
  hammer_rail_flurry_fire: { id: 'hammer_rail_flurry_fire', weaponId: 'adamant_rail', category: 'attack' },
  hammer_rail_cluster_bomb: { id: 'hammer_rail_cluster_bomb', weaponId: 'adamant_rail', category: 'special', incompatibleWith: ['hammer_rail_rocket_bomb'] },
  hammer_rail_hazard_bomb: { id: 'hammer_rail_hazard_bomb', weaponId: 'adamant_rail', category: 'special' },
  hammer_rail_rocket_bomb: { id: 'hammer_rail_rocket_bomb', weaponId: 'adamant_rail', category: 'special', incompatibleWith: ['hammer_rail_cluster_bomb'] },
};

export function getHammerDef(id: HammerId): HammerDef {
  return HAMMER_DEFS[id];
}

export function getHammersForWeapon(weaponId: WeaponId): HammerDef[] {
  return HAMMER_IDS.map((id) => HAMMER_DEFS[id]).filter((def) => def.weaponId === weaponId);
}

export function hasHammer(player: Pick<PlayerState, 'hammers'>, hammerId: HammerId): boolean {
  return player.hammers.includes(hammerId);
}

export function isHammerCompatible(player: Pick<PlayerState, 'hammers'>, hammerId: HammerId): boolean {
  if (player.hammers.includes(hammerId)) return false;
  const meta = HAMMER_META[hammerId];
  if (!meta.incompatibleWith) return true;
  return !meta.incompatibleWith.some((conflict) => player.hammers.includes(conflict));
}
