import {
  COMBAT_CONSTANTS,
  PATRON_CONSTANTS,
  type BoonRarity,
  type BoonSlot,
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

export const BOON_CATALOG: readonly BoonCatalogEntry[] = [
  // ==========================================================================
  // VOLTARIS — Lord of Storms (Chain Lightning, Bolts, Jolted)
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
  // TIDEBREAKER — Sovereign of Tides (Knockback, Wall Slams, Ruptured)
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
  // AEGIRA — Warden of Valor (Deflect, Shielding, Exposed)
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
  // VELOURIS — Mistress of Allure (High % Multipliers, Weak, Charm Burst)
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
  // FLAGSHIP DUO BOONS (Cross-Patron Synergies)
  // ==========================================================================
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

  // ==========================================================================
  // BASELINE WAVE-1 ENTRIES FOR REMAINING 6 PATRONS (Full Expansion in Wave 2)
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
      'Your Attack deals +{val} damage with +15% Critical chance and Marks nearby foes.',
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
    baseValue: 72,
    secondaryValue: 0.1,
    valueFormat: 'flat',
    statusEffect: 'marked',
    descriptionTemplate:
      'Your Cast fires a seeking crystal arrow dealing {val} damage with +10% Crit chance.',
  },
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
    baseValue: 68,
    valueFormat: 'flat',
    statusEffect: 'doom',
    descriptionTemplate:
      'Your Special inflicts Doom, detonating for {val} heavy damage.',
  },
  {
    id: 'bellum_dash',
    patronId: 'bellum',
    name: 'Blade Dash',
    slot: 'dash',
    baseValue: 22,
    valueFormat: 'flat',
    descriptionTemplate:
      'Your Dash leaves a whirling Blade Rift slicing foes for {val} damage.',
  },
  {
    id: 'bacchion_attack',
    patronId: 'bacchion',
    name: 'Drunken Strike',
    slot: 'attack',
    baseValue: 5,
    valueFormat: 'flat',
    statusEffect: 'hangover',
    descriptionTemplate:
      'Your Attack inflicts stacking Hangover dealing {val} damage per tick.',
  },
  {
    id: 'bacchion_special',
    patronId: 'bacchion',
    name: 'Drunken Flourish',
    slot: 'special',
    baseValue: 6,
    valueFormat: 'flat',
    statusEffect: 'hangover',
    descriptionTemplate:
      'Your Special inflicts stacking Hangover dealing {val} damage per tick.',
  },
  {
    id: 'glaciera_attack',
    patronId: 'glaciera',
    name: 'Frost Strike',
    slot: 'attack',
    baseValue: 0.4,
    valueFormat: 'percent',
    statusEffect: 'chill',
    descriptionTemplate:
      'Your Attack deals +{val} damage and inflicts Chill, slowing foes by up to 40%.',
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
    id: 'veloce_swift_strike',
    patronId: 'veloce',
    name: 'Swift Strike',
    slot: 'passive',
    baseValue: 0.15,
    valueFormat: 'percent',
    descriptionTemplate: 'Your Attack strikes +{val} faster.',
  },
  {
    id: 'veloce_greatest_reflex',
    patronId: 'veloce',
    name: 'Hyper Reflex',
    slot: 'dash',
    baseValue: 1,
    valueFormat: 'flat',
    pommable: false,
    descriptionTemplate: 'Gain +{val} extra Dash charge in a row.',
  },
  {
    id: 'abyssos_strike',
    patronId: 'abyssos',
    name: 'Primordial Strike',
    slot: 'chaos',
    baseValue: 0.45,
    valueFormat: 'percent',
    pommable: false,
    descriptionTemplate: 'Your Attack deals +{val} unbridled void damage.',
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
