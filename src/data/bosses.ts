import {
  BOSS_CONSTANTS,
  type BossDef,
  type BossId,
  type EnemyArchetypeId,
} from '../contracts/index.js';

export { BOSS_CONSTANTS };

export type BossAttackMove =
  | 'lunge_dash'
  | 'whip_whirl'
  | 'orb_spread'
  | 'bomb_circles'
  | 'radial_slam'
  | 'spear_sweep'
  | 'sawblade_barrage'
  | 'murder_laser'
  | 'bull_combo'
  | 'bull_leap'
  | 'spearlord_call'
  | 'ferryman_mist_wall'
  | 'sovereign_skulls'
  | 'sovereign_cloak'
  | 'sovereign_beams'
  | 'sovereign_urns';

export interface BossRuntimeConfig {
  id: BossId;
  def: BossDef;
  radius: number;
  moveSpeed: number;
  baseDamage: number;
  attackSequence: readonly BossAttackMove[];
  phase2AttackSequence?: readonly BossAttackMove[];
  phaseTransitionDuration: number;
  spiralOrbCount: number;
  spiralOrbSpeed: number;
  escortArchetype: EnemyArchetypeId;
  escortCountByPhase: readonly number[];
  dangerColor: string;
  accentColor: string;
  phaseLines: readonly string[];
  defeatToast: string;
  /** True for Bone Leviathan whose shield stays invulnerable until auxiliary heads die */
  shieldUntilEscortsDead?: boolean;
  /** True for Warden Murder who shrinks playable arena bounds on each phase transition */
  shrinksArenaOnPhase?: boolean;
  /** Extra move speed gained per triggered phase (Warden Fury +200 rage!) */
  rageSpeedBonusPerPhase?: number;
}

export const BOSS_CONFIGS: Record<BossId, BossRuntimeConfig> = {
  warden_malice: {
    id: 'warden_malice',
    def: BOSS_CONSTANTS.warden_malice,
    radius: 44,
    moveSpeed: 245,
    baseDamage: 18,
    attackSequence: ['lunge_dash', 'orb_spread', 'whip_whirl', 'bomb_circles'],
    phaseTransitionDuration: 1.2,
    spiralOrbCount: 14,
    spiralOrbSpeed: 370,
    escortArchetype: 'numbskull',
    escortCountByPhase: [0, 2, 3],
    dangerColor: '#ff2b68',
    accentColor: '#b94dff',
    phaseLines: [
      'Warden Malice cracks her barbed whip!',
      'Warden Malice unleashes a Storm of Orbs!',
      'Warden Malice enters Crimson Frenzy!',
    ],
    defeatToast: 'Warden Malice Vanquished! The path to Cinder Mire opens.',
  },
  warden_fury: {
    id: 'warden_fury',
    def: BOSS_CONSTANTS.warden_fury,
    radius: 44,
    moveSpeed: 280,
    baseDamage: 19,
    attackSequence: ['lunge_dash', 'sawblade_barrage', 'whip_whirl', 'orb_spread'],
    phaseTransitionDuration: 1.15,
    spiralOrbCount: 16,
    spiralOrbSpeed: 405,
    escortArchetype: 'numbskull',
    escortCountByPhase: [1, 2, 3],
    dangerColor: '#ff3232',
    accentColor: '#ff7043',
    rageSpeedBonusPerPhase: 70, // up to +210 rage speed at P4!
    phaseLines: [
      'Warden Fury ignites with blistering rage (+Speed)!',
      'Warden Fury unleashes spinning Arena Sawblades!',
      'Warden Fury tears through the chamber in crimson fury!',
    ],
    defeatToast: 'Warden Fury Vanquished! The path to Cinder Mire opens.',
  },
  warden_murder: {
    id: 'warden_murder',
    def: BOSS_CONSTANTS.warden_murder,
    radius: 46,
    moveSpeed: 255,
    baseDamage: 21,
    attackSequence: ['whip_whirl', 'murder_laser', 'lunge_dash', 'bomb_circles'],
    phaseTransitionDuration: 1.2,
    spiralOrbCount: 16,
    spiralOrbSpeed: 410,
    escortArchetype: 'wretched_husk',
    escortCountByPhase: [1, 2],
    dangerColor: '#d91645',
    accentColor: '#8d1b5c',
    shrinksArenaOnPhase: true,
    phaseLines: [
      'Warden Murder closes the walls — nowhere to run!',
      'Warden Murder crushes the arena inward!',
    ],
    defeatToast: 'Warden Murder Vanquished! The path to Cinder Mire opens.',
  },
  bone_leviathan: {
    id: 'bone_leviathan',
    def: BOSS_CONSTANTS.bone_leviathan,
    radius: 62,
    moveSpeed: 85,
    baseDamage: 20,
    attackSequence: ['radial_slam', 'orb_spread', 'bomb_circles', 'whip_whirl'],
    phaseTransitionDuration: 1.35,
    spiralOrbCount: 16,
    spiralOrbSpeed: 390,
    escortArchetype: 'bone_hydra_head',
    escortCountByPhase: [3, 6],
    shieldUntilEscortsDead: true,
    dangerColor: '#ff5d22',
    accentColor: '#ffae42',
    phaseLines: [
      'Bone Leviathan raises its Invulnerable Shield — 3 Mire Heads emerge!',
      'Bone Leviathan shields itself — 6 Mire Heads rise from the magma!',
    ],
    defeatToast: 'Bone Leviathan Shattered! Verdant Colosseum awaits.',
  },
  colosseum_bull: {
    id: 'colosseum_bull',
    def: BOSS_CONSTANTS.colosseum_bull,
    radius: 56,
    moveSpeed: 265,
    baseDamage: 24,
    attackSequence: ['bull_combo', 'bull_leap', 'lunge_dash', 'radial_slam'],
    phase2AttackSequence: ['bull_leap', 'radial_slam', 'lunge_dash', 'bull_combo', 'bomb_circles'],
    phaseTransitionDuration: 1.2,
    spiralOrbCount: 12,
    spiralOrbSpeed: 420,
    escortArchetype: 'colosseum_swordsman',
    escortCountByPhase: [0],
    dangerColor: '#ff4838',
    accentColor: '#ffd166',
    phaseLines: ['The Bull roars — shattering shockwaves erupt on every leap!'],
    defeatToast: 'Colosseum Bull Defeated!',
  },
  colosseum_spearlord: {
    id: 'colosseum_spearlord',
    def: BOSS_CONSTANTS.colosseum_spearlord,
    radius: 44,
    moveSpeed: 240,
    baseDamage: 22,
    attackSequence: ['spear_sweep', 'orb_spread', 'lunge_dash'],
    phase2AttackSequence: ['spearlord_call', 'spear_sweep', 'orb_spread', 'spearlord_call'],
    phaseTransitionDuration: 1.25,
    spiralOrbCount: 14,
    spiralOrbSpeed: 430,
    escortArchetype: 'colosseum_bowman',
    escortCountByPhase: [0],
    dangerColor: '#ffd043',
    accentColor: '#5ef2e6',
    phaseLines: ['Colosseum Spearlord invokes an Arena-Wide Patron Call!'],
    defeatToast: 'Colosseum Spearlord Vanquished!',
  },
  the_ferryman: {
    id: 'the_ferryman',
    def: BOSS_CONSTANTS.the_ferryman,
    radius: 52,
    moveSpeed: 195,
    baseDamage: 26,
    attackSequence: ['spear_sweep', 'ferryman_mist_wall', 'bomb_circles', 'whip_whirl'],
    phaseTransitionDuration: 1.25,
    spiralOrbCount: 18,
    spiralOrbSpeed: 380,
    escortArchetype: 'numbskull',
    escortCountByPhase: [0, 0],
    dangerColor: '#9c4dff',
    accentColor: '#ffd54f',
    phaseLines: [
      'The Ferryman parts the Stygian tide with mist-orb walls!',
      'The Ferryman raises his gilded oar in wrath!',
    ],
    defeatToast: 'The Ferryman nods in grim respect — Loyalty Card earned (-20% Shop prices)!',
  },
  sovereign_lord: {
    id: 'sovereign_lord',
    def: BOSS_CONSTANTS.sovereign_lord,
    radius: 58,
    moveSpeed: 260,
    baseDamage: 28,
    attackSequence: [
      'spear_sweep',
      'lunge_dash',
      'sovereign_skulls',
      'whip_whirl',
      'sovereign_cloak',
    ],
    phase2AttackSequence: [
      'sovereign_beams',
      'spear_sweep',
      'sovereign_urns',
      'sovereign_skulls',
      'lunge_dash',
      'sovereign_beams',
    ],
    phaseTransitionDuration: 1.45,
    spiralOrbCount: 18,
    spiralOrbSpeed: 420,
    escortArchetype: 'wretched_husk',
    escortCountByPhase: [2, 3],
    dangerColor: '#ff2a3c',
    accentColor: '#c7ebff',
    phaseLines: [
      'Sovereign Lord summons the Deep Shades!',
      'Sovereign Lord refuses to yield — PHASE II AWAKENS!',
      'EXTREME MEASURES — PHASE III ABYSSAL CROWN!',
    ],
    defeatToast: 'VICTORY! Sovereign Lord has fallen — you have escaped the Deep!',
  },
};

export function getBossConfig(bossId: BossId): BossRuntimeConfig {
  return BOSS_CONFIGS[bossId];
}
