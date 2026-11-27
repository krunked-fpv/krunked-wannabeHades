import {
  COMBAT_CONSTANTS,
  PATRON_CONSTANTS,
  type BoonRarity,
  type BoonSlot,
  type ChaosCurse,
  type PatronId,
  type StatusEffectId,
} from '../contracts/index.js';

export { PATRON_CONSTANTS };

export const WAVE1_PATRONS: readonly PatronId[] = [
  'voltaris',
  'tidebreaker',
  'aegira',
  'velouris',
] as const;

/** All 8 primary Olympian-tier Patrons appearing in standard Boon chamber doors */
export const STANDARD_PATRONS: readonly PatronId[] = [
  'voltaris',
  'tidebreaker',
  'aegira',
  'velouris',
  'sylvara',
  'bellum',
  'bacchion',
  'glaciera',
] as const;

export const ALL_PATRONS: readonly PatronId[] = [
  'voltaris',
  'tidebreaker',
  'aegira',
  'velouris',
  'sylvara',
  'bellum',
  'bacchion',
  'glaciera',
  'veloce',
  'abyssos',
] as const;

export const CORE_BOON_SLOTS: readonly BoonSlot[] = [
  'attack',
  'special',
  'cast',
  'dash',
  'call',
] as const;

export interface BoonCatalogEntry {
  id: string;
  patronId: PatronId;
  name: string;
  slot: BoonSlot;
  baseValue: number;
  secondaryValue?: number;
  valueFormat: 'percent' | 'flat' | 'seconds';
  descriptionTemplate: string;
  statusEffect?: StatusEffectId;
  prerequisiteSlots?: readonly BoonSlot[];
  prerequisiteIds?: readonly string[];
  duoPatrons?: readonly [PatronId, PatronId];
  pommable?: boolean;
}

export interface ChaosCurseTemplate {
  curseKind: ChaosCurse['curseKind'];
  label: string;
  description: string;
  magnitude: number;
  minEncounters: number;
  maxEncounters: number;
}

export const CHAOS_CURSE_TEMPLATES: readonly ChaosCurseTemplate[] = [
  {
    curseKind: 'take_damage_on_attack',
    label: 'Fraying',
    description: 'Each Attack costs 4 HP for {n} encounters.',
    magnitude: 4,
    minEncounters: 3,
    maxEncounters: 4,
  },
  {
    curseKind: 'take_damage_on_special',
    label: 'Flayed',
    description: 'Each Special costs 5 HP for {n} encounters.',
    magnitude: 5,
    minEncounters: 3,
    maxEncounters: 4,
  },
  {
    curseKind: 'take_damage_on_cast',
    label: 'Hemorrhage',
    description: 'Each Cast costs 5 HP for {n} encounters.',
    magnitude: 5,
    minEncounters: 3,
    maxEncounters: 4,
  },
  {
    curseKind: 'take_damage_on_dash',
    label: 'Slipping',
    description: 'Each Dash costs 3 HP for {n} encounters.',
    magnitude: 3,
    minEncounters: 3,
    maxEncounters: 4,
  },
  {
    curseKind: 'reduced_move_speed',
    label: 'Slothful',
    description: 'Move Speed reduced by 30% for {n} encounters.',
    magnitude: 0.3,
    minEncounters: 3,
    maxEncounters: 4,
  },
  {
    curseKind: 'extra_damage_taken',
    label: 'Exposed Flesh',
    description: 'Take +35% damage from foes for {n} encounters.',
    magnitude: 0.35,
    minEncounters: 3,
    maxEncounters: 4,
  },
  {
    curseKind: 'hidden_door_rewards',
    label: 'Shrouded',
    description: 'Chamber door rewards are veiled for {n} encounters.',
    magnitude: 1,
    minEncounters: 3,
    maxEncounters: 4,
  },
  {
    curseKind: 'no_gold_gain',
    label: 'Pauper',
    description: 'Cannot gain Gold for {n} encounters.',
    magnitude: 1,
    minEncounters: 3,
    maxEncounters: 4,
  },
] as const;

export interface WellOfAshItemDef {
  id: string;
  name: string;
  description: string;
  costGold: number;
  baseEncounters: number;
  effectKind: 'heal' | 'attack_buff' | 'special_buff' | 'cast_buff' | 'defiance_refill' | 'gold_burst';
  magnitude: number;
}

export const WELL_OF_ASH_ITEMS: readonly WellOfAshItemDef[] = [
  {
    id: 'well_hydralite',
    name: 'Hydra-Lite Draught',
    description: 'Restore 30% HP immediately (+10 HP per encounter for {n} rooms).',
    costGold: 45,
    baseEncounters: 4,
    effectKind: 'heal',
    magnitude: 0.3,
  },
  {
    id: 'well_cyclops_jerky',
    name: 'Cyclops Jerky',
    description: 'Attack deals +30% damage for {n} encounters.',
    costGold: 55,
    baseEncounters: 5,
    effectKind: 'attack_buff',
    magnitude: 0.3,
  },
  {
    id: 'well_chimera_jerky',
    name: 'Chimera Jerky',
    description: 'Special deals +40% damage for {n} encounters.',
    costGold: 55,
    baseEncounters: 5,
    effectKind: 'special_buff',
    magnitude: 0.4,
  },
  {
    id: 'well_braid_of_atlas',
    name: 'Braid of Atlas',
    description: 'Cast deals +50% damage for {n} encounters.',
    costGold: 50,
    baseEncounters: 5,
    effectKind: 'cast_buff',
    magnitude: 0.5,
  },
  {
    id: 'well_kiss_of_styx',
    name: 'Kiss of Ash',
    description: 'Replenish 1 spent Death Defiance immediately.',
    costGold: 180,
    baseEncounters: 1,
    effectKind: 'defiance_refill',
    magnitude: 1,
  },
] as const;

export const BOON_CATALOG: readonly BoonCatalogEntry[] = [
  // ==========================================================================
  // 1. VOLTARIS — Lord of Storms (Chain Lightning, Bolts, Jolted)
  // ==========================================================================
  {
    id: 'voltaris_attack',
    patronId: 'voltaris',
    name: 'Lightning Strike',
    slot: 'attack',
    baseValue: 12,
    secondaryValue: 4,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Attack emits chain-lightning for {val} damage, bouncing between up to 4 nearby foes.',
  },
  {
    id: 'voltaris_special',
    patronId: 'voltaris',
    name: 'Thunder Flourish',
    slot: 'special',
    baseValue: 32,
    secondaryValue: 180,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Special calls down a thunderbolt striking foes around impact for {val} damage.',
  },
  {
    id: 'voltaris_cast',
    patronId: 'voltaris',
    name: 'Electric Shot',
    slot: 'cast',
    baseValue: 62,
    secondaryValue: 4,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Cast fires a storm-charged burst dealing {val} damage that arcs to nearby foes.',
  },
  {
    id: 'voltaris_dash',
    patronId: 'voltaris',
    name: 'Thunder Dash',
    slot: 'dash',
    baseValue: 18,
    secondaryValue: 210,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Dash calls a lightning strike onto nearby foes for {val} damage.',
  },
  {
    id: 'voltaris_call',
    patronId: 'voltaris',
    name: "Voltaris' Aid",
    slot: 'call',
    baseValue: 60,
    secondaryValue: 1.5,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Call repeatedly blasts nearby foes with lightning for {val} damage per bolt (Greater Call lasts 5.5s).',
  },
  {
    id: 'voltaris_static_discharge',
    patronId: 'voltaris',
    name: 'Static Discharge',
    slot: 'passive',
    baseValue: 60,
    valueFormat: 'flat',
    statusEffect: 'jolted',
    prerequisiteSlots: ['attack', 'special', 'cast', 'dash', 'call'],
    descriptionTemplate:
      'Your lightning effects inflict Jolted; afflicted foes take {val} shock damage when they next attack.',
  },
  {
    id: 'voltaris_storm_lightning',
    patronId: 'voltaris',
    name: 'Storm Lightning',
    slot: 'passive',
    baseValue: 2,
    secondaryValue: 0.15,
    valueFormat: 'flat',
    prerequisiteIds: ['voltaris_attack', 'voltaris_cast'],
    pommable: false,
    descriptionTemplate:
      'Your chain-lightning effects bounce +{val} additional times and deal +15% arc damage.',
  },
  {
    id: 'voltaris_high_voltage',
    patronId: 'voltaris',
    name: 'High Voltage',
    slot: 'passive',
    baseValue: 0.6,
    secondaryValue: 0.2,
    valueFormat: 'percent',
    prerequisiteSlots: ['special', 'dash', 'call'],
    descriptionTemplate:
      'Your lightning bolt strikes cover a +{val} wider area and deal +20% bonus storm damage.',
  },

  // ==========================================================================
  // 2. TIDEBREAKER — Sovereign of Tides (Knockback, Wall Slams, Ruptured)
  // ==========================================================================
  {
    id: 'tidebreaker_attack',
    patronId: 'tidebreaker',
    name: 'Tempest Strike',
    slot: 'attack',
    baseValue: 0.35,
    secondaryValue: 680,
    valueFormat: 'percent',
    descriptionTemplate:
      'Your Attack deals +{val} damage and knocks foes away with crashing surf.',
  },
  {
    id: 'tidebreaker_special',
    patronId: 'tidebreaker',
    name: 'Tempest Flourish',
    slot: 'special',
    baseValue: 0.7,
    secondaryValue: 820,
    valueFormat: 'percent',
    descriptionTemplate:
      'Your Special deals +{val} damage and blasts foes back into walls and obstacles.',
  },
  {
    id: 'tidebreaker_cast',
    patronId: 'tidebreaker',
    name: 'Flood Shot',
    slot: 'cast',
    baseValue: 68,
    secondaryValue: 750,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Cast surges forward in a wave dealing {val} area damage and knocking foes back.',
  },
  {
    id: 'tidebreaker_dash',
    patronId: 'tidebreaker',
    name: 'Tidal Dash',
    slot: 'dash',
    baseValue: 38,
    secondaryValue: 620,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Dash erupts in a crashing wave around you for {val} damage and strong knockback.',
  },
  {
    id: 'tidebreaker_call',
    patronId: 'tidebreaker',
    name: "Tidebreaker's Aid",
    slot: 'call',
    baseValue: 220,
    secondaryValue: 900,
    valueFormat: 'flat',
    descriptionTemplate:
      'Surge forward as an Impervious riptide, slamming foes for {val} damage (Greater Call lasts 4.8s).',
  },
  {
    id: 'tidebreaker_razor_shoals',
    patronId: 'tidebreaker',
    name: 'Razor Shoals',
    slot: 'passive',
    baseValue: 14,
    valueFormat: 'flat',
    statusEffect: 'ruptured',
    prerequisiteSlots: ['attack', 'special', 'cast', 'dash', 'call'],
    descriptionTemplate:
      'Your knock-away effects inflict Ruptured, dealing {val} damage whenever afflicted foes move.',
  },
  {
    id: 'tidebreaker_typhoons_fury',
    patronId: 'tidebreaker',
    name: "Typhoon's Fury",
    slot: 'passive',
    baseValue: 2.0,
    valueFormat: 'percent',
    prerequisiteSlots: ['attack', 'special', 'cast', 'dash'],
    descriptionTemplate:
      'You deal +{val} bonus damage when slamming foes into arena walls or pillars.',
  },
  {
    id: 'tidebreaker_hydraulic_might',
    patronId: 'tidebreaker',
    name: 'Hydraulic Might',
    slot: 'passive',
    baseValue: 0.14,
    valueFormat: 'percent',
    descriptionTemplate:
      'Your Attack and Special deal +{val} bonus damage during the first 10 seconds of each encounter.',
  },

  // ==========================================================================
  // 3. AEGIRA — Warden of Valor (Deflect, Shielding, Exposed)
  // ==========================================================================
  {
    id: 'aegira_attack',
    patronId: 'aegira',
    name: 'Divine Strike',
    slot: 'attack',
    baseValue: 0.4,
    secondaryValue: 1,
    valueFormat: 'percent',
    descriptionTemplate:
      'Your Attack deals +{val} damage and Deflects hostile projectiles back at 3x speed.',
  },
  {
    id: 'aegira_special',
    patronId: 'aegira',
    name: 'Divine Flourish',
    slot: 'special',
    baseValue: 0.6,
    secondaryValue: 1,
    valueFormat: 'percent',
    descriptionTemplate:
      'Your Special deals +{val} damage in a radiant ward that Deflects incoming projectiles.',
  },
  {
    id: 'aegira_cast',
    patronId: 'aegira',
    name: 'Phalanx Shot',
    slot: 'cast',
    baseValue: 85,
    secondaryValue: 1,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Cast fires a gleaming ward dealing {val} damage in a blast that Deflects fire.',
  },
  {
    id: 'aegira_dash',
    patronId: 'aegira',
    name: 'Divine Dash',
    slot: 'dash',
    baseValue: 20,
    secondaryValue: 195,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Dash deals {val} radiant damage in a ward ring and Deflects all nearby projectiles.',
  },
  {
    id: 'aegira_call',
    patronId: 'aegira',
    name: "Aegira's Aid",
    slot: 'call',
    baseValue: 1.5,
    secondaryValue: 90,
    valueFormat: 'seconds',
    descriptionTemplate:
      'Become Impervious and Deflect all nearby threats for {val} (Greater Call lasts 6.0s with radiant burst).',
  },
  {
    id: 'aegira_blinding_flash',
    patronId: 'aegira',
    name: 'Blinding Flash',
    slot: 'passive',
    baseValue: 0.5,
    valueFormat: 'percent',
    statusEffect: 'exposed',
    prerequisiteSlots: ['attack', 'special', 'cast', 'dash', 'call'],
    descriptionTemplate:
      'Your Deflect abilities inflict Exposed, increasing backstab damage against foes by +{val}.',
  },
  {
    id: 'aegira_bronze_skin',
    patronId: 'aegira',
    name: 'Bronze Skin',
    slot: 'passive',
    baseValue: 0.08,
    valueFormat: 'percent',
    descriptionTemplate:
      'You resist {val} of all incoming damage from enemies and hazards.',
  },
  {
    id: 'aegira_holy_shield',
    patronId: 'aegira',
    name: 'Holy Shield',
    slot: 'passive',
    baseValue: 35,
    valueFormat: 'flat',
    descriptionTemplate:
      'After taking damage, unleash a deflecting shockwave dealing {val} damage around you.',
  },

  // ==========================================================================
  // 4. VELOURIS — Mistress of Allure (High % Multipliers, Weak, Charm Burst)
  // ==========================================================================
  {
    id: 'velouris_attack',
    patronId: 'velouris',
    name: 'Heartbreak Strike',
    slot: 'attack',
    baseValue: 0.5,
    valueFormat: 'percent',
    statusEffect: 'weak',
    descriptionTemplate:
      'Your Attack deals +{val} damage and inflicts Weak (-30% enemy outgoing damage for 4s).',
  },
  {
    id: 'velouris_special',
    patronId: 'velouris',
    name: 'Heartbreak Flourish',
    slot: 'special',
    baseValue: 0.8,
    valueFormat: 'percent',
    statusEffect: 'weak',
    descriptionTemplate:
      'Your Special deals +{val} damage and inflicts Weak on struck foes.',
  },
  {
    id: 'velouris_cast',
    patronId: 'velouris',
    name: 'Crush Shot',
    slot: 'cast',
    baseValue: 96,
    valueFormat: 'flat',
    statusEffect: 'weak',
    descriptionTemplate:
      'Your Cast unleashes a wide close-range blast for {val} damage that inflicts Weak.',
  },
  {
    id: 'velouris_dash',
    patronId: 'velouris',
    name: 'Passion Dash',
    slot: 'dash',
    baseValue: 24,
    secondaryValue: 220,
    valueFormat: 'flat',
    statusEffect: 'weak',
    descriptionTemplate:
      'Your Dash erupts in a rose burst at your destination for {val} damage, inflicting Weak.',
  },
  {
    id: 'velouris_call',
    patronId: 'velouris',
    name: "Velouris' Aid",
    slot: 'call',
    baseValue: 240,
    secondaryValue: 2500,
    valueFormat: 'flat',
    statusEffect: 'weak',
    descriptionTemplate:
      'Fire a seeking heart-lance that Charms and deals {val} damage (Greater Call deals 2500 burst!).',
  },
  {
    id: 'velouris_sweet_surrender',
    patronId: 'velouris',
    name: 'Sweet Surrender',
    slot: 'passive',
    baseValue: 0.12,
    valueFormat: 'percent',
    prerequisiteSlots: ['attack', 'special', 'cast', 'dash', 'call'],
    descriptionTemplate:
      'Weak-afflicted foes take +{val} additional damage from all of your strikes.',
  },
  {
    id: 'velouris_different_league',
    patronId: 'velouris',
    name: 'Different League',
    slot: 'passive',
    baseValue: 0.12,
    valueFormat: 'percent',
    descriptionTemplate:
      'Resist {val} damage from nearby enemies within close quarters.',
  },
  {
    id: 'velouris_empty_inside',
    patronId: 'velouris',
    name: 'Empty Inside',
    slot: 'passive',
    baseValue: 5.0,
    valueFormat: 'seconds',
    prerequisiteSlots: ['attack', 'special', 'cast', 'dash', 'call'],
    descriptionTemplate:
      'Your Weak effects last +{val} longer, keeping foes crippled across the entire clash.',
  },

  // ==========================================================================
  // 5. SYLVARA — Stalker of the Wilds (Critical Strikes, Marked, Support Fire)
  // ==========================================================================
  {
    id: 'sylvara_attack',
    patronId: 'sylvara',
    name: 'Deadly Strike',
    slot: 'attack',
    baseValue: 0.2,
    secondaryValue: 0.15,
    valueFormat: 'percent',
    statusEffect: 'marked',
    descriptionTemplate:
      'Your Attack deals +{val} damage with +15% Critical chance (3x damage).',
  },
  {
    id: 'sylvara_special',
    patronId: 'sylvara',
    name: 'Deadly Flourish',
    slot: 'special',
    baseValue: 0.4,
    secondaryValue: 0.2,
    valueFormat: 'percent',
    statusEffect: 'marked',
    descriptionTemplate:
      'Your Special deals +{val} damage with +20% Critical chance.',
  },
  {
    id: 'sylvara_cast',
    patronId: 'sylvara',
    name: 'True Shot',
    slot: 'cast',
    baseValue: 76,
    secondaryValue: 0.15,
    valueFormat: 'flat',
    statusEffect: 'marked',
    descriptionTemplate:
      'Your Cast fires a seeking crystal arrow dealing {val} damage with +15% Critical chance.',
  },
  {
    id: 'sylvara_dash',
    patronId: 'sylvara',
    name: 'Hunter Dash',
    slot: 'dash',
    baseValue: 0.5,
    valueFormat: 'percent',
    descriptionTemplate:
      'Your Dash-Strike deals +{val} bonus damage and empowers your next strike.',
  },
  {
    id: 'sylvara_call',
    patronId: 'sylvara',
    name: "Sylvara's Aid",
    slot: 'call',
    baseValue: 95,
    secondaryValue: 12,
    valueFormat: 'flat',
    statusEffect: 'marked',
    descriptionTemplate:
      'Launch 5 seeking arrows for {val} damage with +35% Crit chance (Greater Call fires 12 arrows!).',
  },
  {
    id: 'sylvara_hunters_mark',
    patronId: 'sylvara',
    name: "Hunter's Mark",
    slot: 'passive',
    baseValue: 0.3,
    valueFormat: 'percent',
    statusEffect: 'marked',
    descriptionTemplate:
      'Striking foes inflicts Marked (+{val} Critical chance) onto a nearby enemy.',
  },
  {
    id: 'sylvara_support_fire',
    patronId: 'sylvara',
    name: 'Support Fire',
    slot: 'passive',
    baseValue: 14,
    valueFormat: 'flat',
    descriptionTemplate:
      'Each Attack, Special, or Cast hit fires a seeking arrow dealing {val} damage.',
  },
  {
    id: 'sylvara_pressure_points',
    patronId: 'sylvara',
    name: 'Pressure Points',
    slot: 'passive',
    baseValue: 0.04,
    valueFormat: 'percent',
    descriptionTemplate:
      'Any damage you deal has +{val} chance to strike as a Critical hit.',
  },

  // ==========================================================================
  // 6. BELLUM — Herald of Slaughter (Doom 1.1s Burst & Spinning Blade Rifts)
  // ==========================================================================
  {
    id: 'bellum_attack',
    patronId: 'bellum',
    name: 'Curse of Agony',
    slot: 'attack',
    baseValue: 55,
    valueFormat: 'flat',
    statusEffect: 'doom',
    descriptionTemplate:
      'Your Attack inflicts Doom, striking foes after 1.1s for {val} heavy damage.',
  },
  {
    id: 'bellum_special',
    patronId: 'bellum',
    name: 'Curse of Pain',
    slot: 'special',
    baseValue: 70,
    valueFormat: 'flat',
    statusEffect: 'doom',
    descriptionTemplate:
      'Your Special inflicts Doom, detonating after 1.1s for {val} heavy damage.',
  },
  {
    id: 'bellum_cast',
    patronId: 'bellum',
    name: 'Slicing Shot',
    slot: 'cast',
    baseValue: 22,
    secondaryValue: 4.0,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Cast unleashes a whirling Blade Rift slicing foes for {val} damage every 0.14s.',
  },
  {
    id: 'bellum_dash',
    patronId: 'bellum',
    name: 'Blade Dash',
    slot: 'dash',
    baseValue: 16,
    secondaryValue: 1.4,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Dash leaves a spinning Blade Rift behind you dealing {val} damage per slice.',
  },
  {
    id: 'bellum_call',
    patronId: 'bellum',
    name: "Bellum's Aid",
    slot: 'call',
    baseValue: 46,
    secondaryValue: 1.5,
    valueFormat: 'flat',
    descriptionTemplate:
      'Become an Impervious spinning Blade Vortex dealing {val} rapid damage (Greater Call lasts 5.0s).',
  },
  {
    id: 'bellum_dire_misfortune',
    patronId: 'bellum',
    name: 'Dire Misfortune',
    slot: 'passive',
    baseValue: 12,
    valueFormat: 'flat',
    prerequisiteIds: ['bellum_attack', 'bellum_special'],
    descriptionTemplate:
      'Applying Doom repeatedly deals +{val} bonus damage per stack.',
  },
  {
    id: 'bellum_impending_doom',
    patronId: 'bellum',
    name: 'Impending Doom',
    slot: 'passive',
    baseValue: 0.6,
    valueFormat: 'percent',
    prerequisiteIds: ['bellum_attack', 'bellum_special'],
    descriptionTemplate:
      'Your Doom effects deal +{val} bonus damage after +0.5s longer delay.',
  },
  {
    id: 'bellum_black_metal',
    patronId: 'bellum',
    name: 'Black Metal',
    slot: 'passive',
    baseValue: 0.25,
    valueFormat: 'percent',
    prerequisiteIds: ['bellum_cast', 'bellum_dash', 'bellum_call'],
    descriptionTemplate:
      'Your Blade Rift vortexes have +{val} wider radius and spin +1.0s longer.',
  },

  // ==========================================================================
  // 7. BACCHION — Prince of Revelry (Hangover 5-Stack DoT & Festive Fog Lob)
  // ==========================================================================
  {
    id: 'bacchion_attack',
    patronId: 'bacchion',
    name: 'Drunken Strike',
    slot: 'attack',
    baseValue: 5,
    valueFormat: 'flat',
    statusEffect: 'hangover',
    descriptionTemplate:
      'Your Attack inflicts stacking Hangover (up to 5x) dealing {val} damage every 0.5s.',
  },
  {
    id: 'bacchion_special',
    patronId: 'bacchion',
    name: 'Drunken Flourish',
    slot: 'special',
    baseValue: 7,
    valueFormat: 'flat',
    statusEffect: 'hangover',
    descriptionTemplate:
      'Your Special inflicts stacking Hangover dealing {val} damage every 0.5s.',
  },
  {
    id: 'bacchion_cast',
    patronId: 'bacchion',
    name: 'Trippy Shot',
    slot: 'cast',
    baseValue: 112,
    secondaryValue: 210,
    valueFormat: 'flat',
    statusEffect: 'hangover',
    descriptionTemplate:
      'Your Cast lobs Festive Fog exploding for {val} damage and stunning foes in the mist.',
  },
  {
    id: 'bacchion_dash',
    patronId: 'bacchion',
    name: 'Drunken Dash',
    slot: 'dash',
    baseValue: 5,
    secondaryValue: 195,
    valueFormat: 'flat',
    statusEffect: 'hangover',
    descriptionTemplate:
      'Your Dash leaves a revelry vapor cloud inflicting {val}-damage Hangover nearby.',
  },
  {
    id: 'bacchion_call',
    patronId: 'bacchion',
    name: "Bacchion's Aid",
    slot: 'call',
    baseValue: 12,
    secondaryValue: 2.0,
    valueFormat: 'flat',
    statusEffect: 'hangover',
    descriptionTemplate:
      'Radiate intoxicating mist inflicting heavy {val}-damage Hangover stacks (Greater Call lasts 6.0s).',
  },
  {
    id: 'bacchion_positive_outlook',
    patronId: 'bacchion',
    name: 'Positive Outlook',
    slot: 'passive',
    baseValue: 0.12,
    valueFormat: 'percent',
    descriptionTemplate:
      'Take -{val} less damage whenever your HP is at or below 40%.',
  },
  {
    id: 'bacchion_after_party',
    patronId: 'bacchion',
    name: 'After Party',
    slot: 'passive',
    baseValue: 0.35,
    valueFormat: 'percent',
    descriptionTemplate:
      'After clearing any encounter, restore HP up to {val} of your Max HP.',
  },
  {
    id: 'bacchion_strong_drink',
    patronId: 'bacchion',
    name: 'Strong Drink',
    slot: 'passive',
    baseValue: 0.05,
    valueFormat: 'percent',
    descriptionTemplate:
      'Fountains restore 100% HP and permanently empower your damage by +{val}.',
  },

  // ==========================================================================
  // 8. GLACIERA — Matron of Frost (Chill 10-Stack Slow & Frost Crystal Beam)
  // ==========================================================================
  {
    id: 'glaciera_attack',
    patronId: 'glaciera',
    name: 'Frost Strike',
    slot: 'attack',
    baseValue: 0.4,
    valueFormat: 'percent',
    statusEffect: 'chill',
    descriptionTemplate:
      'Your Attack deals +{val} damage and inflicts Chill (up to 10 stacks, -40% slow).',
  },
  {
    id: 'glaciera_special',
    patronId: 'glaciera',
    name: 'Frost Flourish',
    slot: 'special',
    baseValue: 0.6,
    valueFormat: 'percent',
    statusEffect: 'chill',
    descriptionTemplate:
      'Your Special deals +{val} damage and inflicts stacking Chill.',
  },
  {
    id: 'glaciera_cast',
    patronId: 'glaciera',
    name: 'Crystal Beam',
    slot: 'cast',
    baseValue: 14,
    secondaryValue: 4.5,
    valueFormat: 'flat',
    statusEffect: 'chill',
    descriptionTemplate:
      'Your Cast deploys a Frost Crystal firing a tracking beam for {val} damage every 0.2s.',
  },
  {
    id: 'glaciera_dash',
    patronId: 'glaciera',
    name: 'Mistral Dash',
    slot: 'dash',
    baseValue: 20,
    secondaryValue: 225,
    valueFormat: 'flat',
    statusEffect: 'chill',
    descriptionTemplate:
      'Your Dash fires a sweeping frost gust dealing {val} damage and inflicting Chill.',
  },
  {
    id: 'glaciera_call',
    patronId: 'glaciera',
    name: "Glaciera's Aid",
    slot: 'call',
    baseValue: 18,
    secondaryValue: 1.8,
    valueFormat: 'flat',
    statusEffect: 'chill',
    descriptionTemplate:
      'Unleash an expanding Winter Vortex dealing {val} damage per tick + Chill (Greater Call lasts 5.5s).',
  },
  {
    id: 'glaciera_arctic_blast',
    patronId: 'glaciera',
    name: 'Arctic Blast',
    slot: 'passive',
    baseValue: 85,
    valueFormat: 'flat',
    prerequisiteSlots: ['attack', 'special', 'cast', 'dash', 'call'],
    descriptionTemplate:
      'Inflicting 10 stacks of Chill causes a shattering {val}-damage frost explosion.',
  },
  {
    id: 'glaciera_killing_freeze',
    patronId: 'glaciera',
    name: 'Killing Freeze',
    slot: 'passive',
    baseValue: 24,
    valueFormat: 'flat',
    prerequisiteSlots: ['attack', 'special', 'cast', 'dash', 'call'],
    descriptionTemplate:
      'While all foes in the chamber are Chilled, they decay for {val} damage per second.',
  },
  {
    id: 'glaciera_glacial_glare',
    patronId: 'glaciera',
    name: 'Glacial Glare',
    slot: 'passive',
    baseValue: 2.0,
    valueFormat: 'seconds',
    prerequisiteIds: ['glaciera_cast'],
    descriptionTemplate:
      'Your Frost Crystal beams last +{val} longer and rapidly stack Chill.',
  },

  // ==========================================================================
  // 9. VELOCE — Herald of Swiftness (Speed, Extra Dashes, Dodge, Hyper Sprint)
  // ==========================================================================
  {
    id: 'veloce_swift_strike',
    patronId: 'veloce',
    name: 'Swift Strike',
    slot: 'passive',
    baseValue: 0.15,
    valueFormat: 'percent',
    pommable: false,
    descriptionTemplate: 'Your Attack strikes +{val} faster.',
  },
  {
    id: 'veloce_swift_flourish',
    patronId: 'veloce',
    name: 'Swift Flourish',
    slot: 'passive',
    baseValue: 0.15,
    valueFormat: 'percent',
    pommable: false,
    descriptionTemplate: 'Your Special executes +{val} faster.',
  },
  {
    id: 'veloce_greater_speed',
    patronId: 'veloce',
    name: 'Greater Haste',
    slot: 'passive',
    baseValue: 0.2,
    valueFormat: 'percent',
    pommable: false,
    descriptionTemplate: 'You move +{val} faster across every chamber.',
  },
  {
    id: 'veloce_greatest_reflex',
    patronId: 'veloce',
    name: 'Greatest Reflex',
    slot: 'passive',
    baseValue: 1,
    valueFormat: 'flat',
    pommable: false,
    descriptionTemplate: 'Gain +{val} extra Dash charge in a row.',
  },
  {
    id: 'veloce_greater_evasion',
    patronId: 'veloce',
    name: 'Greater Evasion',
    slot: 'passive',
    baseValue: 0.12,
    valueFormat: 'percent',
    pommable: false,
    descriptionTemplate: 'Gain +{val} passive chance to Dodge incoming enemy hits.',
  },
  {
    id: 'veloce_hyper_sprint',
    patronId: 'veloce',
    name: 'Hyper Sprint',
    slot: 'passive',
    baseValue: 0.9,
    valueFormat: 'seconds',
    pommable: false,
    descriptionTemplate:
      'After Dashing, become Sturdy and surge with +60% sprint speed for {val}.',
  },
  {
    id: 'veloce_side_hustle',
    patronId: 'veloce',
    name: 'Side Hustle',
    slot: 'passive',
    baseValue: 12,
    valueFormat: 'flat',
    pommable: false,
    descriptionTemplate: 'Gain +{val} Gold every time you enter a chamber.',
  },

  // ==========================================================================
  // 10. ABYSSOS / CHAOS — Primordial Void (Curse -> Maturing Huge Blessings!)
  // ==========================================================================
  {
    id: 'abyssos_attack_strike',
    patronId: 'abyssos',
    name: 'Primordial Strike',
    slot: 'chaos',
    baseValue: 0.48,
    valueFormat: 'percent',
    pommable: false,
    descriptionTemplate: 'Your Attack deals +{val} unbridled void damage.',
  },
  {
    id: 'abyssos_special_flourish',
    patronId: 'abyssos',
    name: 'Primordial Flourish',
    slot: 'chaos',
    baseValue: 0.58,
    valueFormat: 'percent',
    pommable: false,
    descriptionTemplate: 'Your Special deals +{val} unbridled void damage.',
  },
  {
    id: 'abyssos_cast_shot',
    patronId: 'abyssos',
    name: 'Primordial Shot',
    slot: 'chaos',
    baseValue: 0.52,
    valueFormat: 'percent',
    pommable: false,
    descriptionTemplate: 'Your Cast deals +{val} unbridled void damage.',
  },
  {
    id: 'abyssos_dash_surge',
    patronId: 'abyssos',
    name: 'Primordial Lunge',
    slot: 'chaos',
    baseValue: 0.65,
    valueFormat: 'percent',
    pommable: false,
    descriptionTemplate: 'Your Dash-Strike deals +{val} unbridled void damage.',
  },
  {
    id: 'abyssos_vitality',
    patronId: 'abyssos',
    name: 'Primordial Soul',
    slot: 'chaos',
    baseValue: 40,
    valueFormat: 'flat',
    pommable: false,
    descriptionTemplate: 'Gain +{val} Max HP upon curse maturation.',
  },
  {
    id: 'abyssos_affluence',
    patronId: 'abyssos',
    name: 'Primordial Affluence',
    slot: 'chaos',
    baseValue: 0.5,
    valueFormat: 'percent',
    pommable: false,
    descriptionTemplate: 'Gain +{val} more Gold from foes and chamber troves.',
  },
  {
    id: 'abyssos_grasp',
    patronId: 'abyssos',
    name: 'Primordial Grasp',
    slot: 'chaos',
    baseValue: 1,
    valueFormat: 'flat',
    pommable: false,
    descriptionTemplate: 'Gain +{val} extra Cast Bloodstone capacity.',
  },

  // ==========================================================================
  // 14 REAL DUO BOONS (Cross-Patron Mythic Synergies)
  // ==========================================================================
  {
    id: 'duo_merciful_doom',
    patronId: 'bellum',
    name: 'Merciful Doom',
    slot: 'duo',
    baseValue: 45,
    valueFormat: 'flat',
    duoPatrons: ['bellum', 'aegira'],
    pommable: false,
    descriptionTemplate:
      'Duo: Your Aegira abilities immediately trigger active Doom with +{val} bonus damage.',
  },
  {
    id: 'duo_hunting_blades',
    patronId: 'bellum',
    name: 'Hunting Blades',
    slot: 'duo',
    baseValue: 2.0,
    valueFormat: 'seconds',
    duoPatrons: ['bellum', 'sylvara'],
    pommable: false,
    descriptionTemplate:
      'Duo: Your Slicing Blade Rifts actively hunt down foes and last +{val} longer.',
  },
  {
    id: 'duo_sea_storm',
    patronId: 'voltaris',
    name: 'Sea Storm',
    slot: 'duo',
    baseValue: 40,
    valueFormat: 'flat',
    duoPatrons: ['voltaris', 'tidebreaker'],
    pommable: false,
    descriptionTemplate:
      'Duo: Your knock-away effects also strike foes with a {val}-damage thunderbolt.',
  },
  {
    id: 'duo_smoldering_air',
    patronId: 'voltaris',
    name: 'Smoldering Air',
    slot: 'duo',
    baseValue: 6,
    valueFormat: 'flat',
    duoPatrons: ['voltaris', 'velouris'],
    pommable: false,
    descriptionTemplate:
      'Duo: Your God Gauge charges automatically (+{val}/sec), capping at 25% for rapid Calls.',
  },
  {
    id: 'duo_crystal_clarity',
    patronId: 'glaciera',
    name: 'Crystal Clarity',
    slot: 'duo',
    baseValue: 0.25,
    valueFormat: 'percent',
    duoPatrons: ['glaciera', 'sylvara'],
    pommable: false,
    descriptionTemplate:
      'Duo: Your Frost Crystal beams track foes rapidly and deal +{val} bonus damage.',
  },
  {
    id: 'duo_splitting_headache',
    patronId: 'bacchion',
    name: 'Splitting Headache',
    slot: 'duo',
    baseValue: 0.03,
    valueFormat: 'percent',
    duoPatrons: ['bacchion', 'sylvara'],
    pommable: false,
    descriptionTemplate:
      'Duo: Each stack of Hangover grants +{val} Critical chance against afflicted foes.',
  },
  {
    id: 'duo_lightning_rod',
    patronId: 'voltaris',
    name: 'Lightning Rod',
    slot: 'duo',
    baseValue: 70,
    valueFormat: 'flat',
    duoPatrons: ['voltaris', 'sylvara'],
    pommable: false,
    descriptionTemplate:
      'Duo: Uncollected Bloodstones on the floor strike nearby foes for {val} lightning damage every 1s.',
  },
  {
    id: 'duo_deadly_reversal',
    patronId: 'aegira',
    name: 'Deadly Reversal',
    slot: 'duo',
    baseValue: 0.2,
    valueFormat: 'percent',
    duoPatrons: ['aegira', 'sylvara'],
    pommable: false,
    descriptionTemplate:
      'Duo: For 2.5s after Deflecting, gain +{val} Critical strike chance.',
  },
  {
    id: 'duo_heart_rend',
    patronId: 'velouris',
    name: 'Heart Rend',
    slot: 'duo',
    baseValue: 0.5,
    valueFormat: 'percent',
    duoPatrons: ['velouris', 'sylvara'],
    pommable: false,
    descriptionTemplate:
      'Duo: Your Critical strikes deal +{val} extra bonus damage to Weak-afflicted foes.',
  },
  {
    id: 'duo_vengeful_mood',
    patronId: 'bellum',
    name: 'Vengeful Mood',
    slot: 'duo',
    baseValue: 65,
    valueFormat: 'flat',
    duoPatrons: ['bellum', 'voltaris'],
    pommable: false,
    descriptionTemplate:
      'Duo: Revenge thunder-slaughter shocks nearby foes automatically every 3s for {val} damage.',
  },
  {
    id: 'duo_ice_wine',
    patronId: 'bacchion',
    name: 'Ice Wine',
    slot: 'duo',
    baseValue: 0.35,
    valueFormat: 'percent',
    duoPatrons: ['bacchion', 'glaciera'],
    pommable: false,
    descriptionTemplate:
      'Duo: Your Festive Fog detonates with +{val} bonus damage and inflicts Chill.',
  },
  {
    id: 'duo_blizzard_shot',
    patronId: 'tidebreaker',
    name: 'Blizzard Shot',
    slot: 'duo',
    baseValue: 26,
    valueFormat: 'flat',
    duoPatrons: ['tidebreaker', 'glaciera'],
    pommable: false,
    descriptionTemplate:
      'Duo: Your Cast erupts into icy piercing shards dealing {val} damage and Chill.',
  },
  {
    id: 'duo_lightning_phalanx',
    patronId: 'aegira',
    name: 'Lightning Phalanx',
    slot: 'duo',
    baseValue: 35,
    valueFormat: 'flat',
    duoPatrons: ['voltaris', 'aegira'],
    pommable: false,
    descriptionTemplate:
      'Duo: Your Cast arcs radiant lightning to nearby foes for +{val} bonus damage.',
  },
  {
    id: 'duo_parting_shot',
    patronId: 'velouris',
    name: 'Parting Shot',
    slot: 'duo',
    baseValue: 0.35,
    valueFormat: 'percent',
    duoPatrons: ['aegira', 'velouris'],
    pommable: false,
    descriptionTemplate:
      'Duo: Your Cast gains +{val} bonus backstab damage and inflicts Exposed and Weak.',
  },
];

export const BOON_CATALOG_BY_ID: Readonly<Record<string, BoonCatalogEntry>> = Object.fromEntries(
  BOON_CATALOG.map((entry) => [entry.id, entry])
);

export function getBoonCatalogEntry(id: string): BoonCatalogEntry | undefined {
  return BOON_CATALOG_BY_ID[id];
}

export function getBoonsForPatron(patronId: PatronId): BoonCatalogEntry[] {
  return BOON_CATALOG.filter(
    (entry) =>
      entry.patronId === patronId ||
      (entry.duoPatrons ? entry.duoPatrons.includes(patronId) : false)
  );
}

export function getAllDuoBoons(): BoonCatalogEntry[] {
  return BOON_CATALOG.filter((entry) => entry.slot === 'duo');
}

export function computeBoonScaledValue(
  baseValue: number,
  rarity: BoonRarity,
  level: number,
  pommable = true
): number {
  const mult = COMBAT_CONSTANTS.rarityMultipliers[rarity] ?? 1.0;
  let val = baseValue * mult;
  if (pommable && level > 1) {
    const pomScale = COMBAT_CONSTANTS.pomDiminishingScale;
    for (let lv = 2; lv <= level; lv++) {
      val += baseValue * 0.35 * Math.pow(pomScale, lv - 2);
    }
  }
  if (baseValue >= 10) {
    return Math.round(val);
  }
  return Math.round(val * 100) / 100;
}

export function formatBoonValue(
  value: number,
  format: BoonCatalogEntry['valueFormat']
): string {
  if (format === 'percent') {
    return `${Math.round(value * 100)}%`;
  }
  if (format === 'seconds') {
    return `${value.toFixed(1)}s`;
  }
  return `${Math.round(value)}`;
}

export function formatBoonDescription(
  entry: BoonCatalogEntry,
  scaledValue: number
): string {
  return entry.descriptionTemplate.replace(
    '{val}',
    formatBoonValue(scaledValue, entry.valueFormat)
  );
}
