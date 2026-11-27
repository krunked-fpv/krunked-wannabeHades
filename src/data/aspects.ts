import {
  ASPECT_DEFS,
  type AspectDef,
  type AspectId,
  type WeaponId,
} from '../contracts/index.js';

export type AspectMechanicTag =
  | 'speed_boost'
  | 'post_special_crit'
  | 'dislodge_cast_amp'
  | 'hallowed_heavy_combo'
  | 'special_boost'
  | 'rush_to_spear'
  | 'punishing_sweep'
  | 'frost_healing_spin'
  | 'base_attack_bonus'
  | 'extra_shields_after_rush'
  | 'blitz_disc'
  | 'bloodstone_dragon_rush'
  | 'attack_crit'
  | 'homing_volley'
  | 'loaded_cast_arrow'
  | 'shared_suffering'
  | 'passive_dodge'
  | 'magnetic_pull'
  | 'twelve_hit_super_special'
  | 'feral_maim_dashes'
  | 'bonus_ammo'
  | 'self_blast_empower'
  | 'reload_sniper_shot'
  | 'ramp_beam_mines';

export interface AspectMechanicMeta {
  id: AspectId;
  tag: AspectMechanicTag;
  valueLabel: string;
}

export const ASPECTS: Readonly<Record<AspectId, AspectDef>> = ASPECT_DEFS;

export const ASPECT_IDS: readonly AspectId[] = Object.keys(ASPECT_DEFS) as AspectId[];

export const ASPECT_MECHANICS: Readonly<Record<AspectId, AspectMechanicMeta>> = {
  blade_scion: { id: 'blade_scion', tag: 'speed_boost', valueLabel: 'Attack & Move Speed' },
  blade_vengeance: { id: 'blade_vengeance', tag: 'post_special_crit', valueLabel: 'Post-Special Attack Crit' },
  blade_maelstrom: { id: 'blade_maelstrom', tag: 'dislodge_cast_amp', valueLabel: 'Cast Damage & Dislodge' },
  blade_paladin: { id: 'blade_paladin', tag: 'hallowed_heavy_combo', valueLabel: 'Hallowed Aura DR & Heavy Combo' },
  spear_scion: { id: 'spear_scion', tag: 'special_boost', valueLabel: 'Special Damage, Range & Speed' },
  spear_vanguard: { id: 'spear_vanguard', tag: 'rush_to_spear', valueLabel: 'Post-Rush Empower (4 Hits)' },
  spear_sovereign: { id: 'spear_sovereign', tag: 'punishing_sweep', valueLabel: 'Punishing Sweep Bonus' },
  spear_dragon: { id: 'spear_dragon', tag: 'frost_healing_spin', valueLabel: 'Frost Spin Healing & Speed' },
  shield_scion: { id: 'shield_scion', tag: 'base_attack_bonus', valueLabel: 'Base Attack & Dash-Strike' },
  shield_abyss: { id: 'shield_abyss', tag: 'extra_shields_after_rush', valueLabel: 'Extra Thrown Shields' },
  shield_thunder: { id: 'shield_thunder', tag: 'blitz_disc', valueLabel: 'Blitz Disc Pulse Damage' },
  shield_behemoth: { id: 'shield_behemoth', tag: 'bloodstone_dragon_rush', valueLabel: 'Dragon Rush Cast Bonus' },
  bow_scion: { id: 'bow_scion', tag: 'attack_crit', valueLabel: 'Attack Critical Chance' },
  bow_tracker: { id: 'bow_tracker', tag: 'homing_volley', valueLabel: 'Seeking Volley Arrows' },
  bow_loaded: { id: 'bow_loaded', tag: 'loaded_cast_arrow', valueLabel: 'Loaded Cast Detonation Bonus' },
  bow_celestial: { id: 'bow_celestial', tag: 'shared_suffering', valueLabel: 'Shared Suffering Link %' },
  fists_scion: { id: 'fists_scion', tag: 'passive_dodge', valueLabel: 'Passive Dodge Chance' },
  fists_magnet: { id: 'fists_magnet', tag: 'magnetic_pull', valueLabel: 'Magnetic Pull Vulnerability' },
  fists_cutter: { id: 'fists_cutter', tag: 'twelve_hit_super_special', valueLabel: 'Extra Special Strikes (12 Hits)' },
  fists_feral: { id: 'fists_feral', tag: 'feral_maim_dashes', valueLabel: 'Maim Burst & +2 Dashes' },
  rail_scion: { id: 'rail_scion', tag: 'bonus_ammo', valueLabel: 'Max Ammo Capacity' },
  rail_blast: { id: 'rail_blast', tag: 'self_blast_empower', valueLabel: 'Self-Blast Global Damage (4s)' },
  rail_sniper: { id: 'rail_sniper', tag: 'reload_sniper_shot', valueLabel: 'Empowered Sniper Base Damage' },
  rail_beam: { id: 'rail_beam', tag: 'ramp_beam_mines', valueLabel: 'Hellfire Beam & Mine Blast' },
};

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

export function getAspectMechanic(id: AspectId): AspectMechanicMeta {
  return ASPECT_MECHANICS[id];
}
