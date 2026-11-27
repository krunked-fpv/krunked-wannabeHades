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
  | 'spear_sweep';

export interface BossRuntimeConfig {
  id: BossId;
  def: BossDef;
  radius: number;
  moveSpeed: number;
  baseDamage: number;
  attackSequence: readonly BossAttackMove[];
  phaseTransitionDuration: number;
  spiralOrbCount: number;
  spiralOrbSpeed: number;
  escortArchetype: EnemyArchetypeId;
  escortCountByPhase: readonly number[];
  dangerColor: string;
  accentColor: string;
  phaseLines: readonly string[];
  defeatToast: string;
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
    moveSpeed: 270,
    baseDamage: 19,
    attackSequence: ['lunge_dash', 'whip_whirl', 'bomb_circles', 'orb_spread'],
    phaseTransitionDuration: 1.15,
    spiralOrbCount: 16,
    spiralOrbSpeed: 400,
    escortArchetype: 'numbskull',
    escortCountByPhase: [1, 2, 3],
    dangerColor: '#ff3232',
    accentColor: '#ff7043',
    phaseLines: [
      'Warden Fury ignites with rage!',
      'Warden Fury tears the stone apart!',
      'Warden Fury strikes without mercy!',
    ],
    defeatToast: 'Warden Fury Vanquished!',
  },
  warden_murder: {
    id: 'warden_murder',
    def: BOSS_CONSTANTS.warden_murder,
    radius: 46,
    moveSpeed: 255,
    baseDamage: 21,
    attackSequence: ['whip_whirl', 'lunge_dash', 'bomb_circles', 'orb_spread'],
    phaseTransitionDuration: 1.2,
    spiralOrbCount: 16,
    spiralOrbSpeed: 410,
    escortArchetype: 'wretched_husk',
    escortCountByPhase: [1, 2],
    dangerColor: '#d91645',
    accentColor: '#8d1b5c',
    phaseLines: [
      'Warden Murder closes the chamber!',
      'Warden Murder calls the Pit!',
    ],
    defeatToast: 'Warden Murder Vanquished!',
  },
  bone_leviathan: {
    id: 'bone_leviathan',
    def: BOSS_CONSTANTS.bone_leviathan,
    radius: 62,
    moveSpeed: 120,
    baseDamage: 20,
    attackSequence: ['radial_slam', 'orb_spread', 'bomb_circles', 'whip_whirl'],
    phaseTransitionDuration: 1.3,
    spiralOrbCount: 16,
    spiralOrbSpeed: 390,
    escortArchetype: 'bone_hydra_head',
    escortCountByPhase: [2, 3],
    dangerColor: '#ff5d22',
    accentColor: '#ffae42',
    phaseLines: [
      'Bone Leviathan raises its molten spines!',
      'Bone Leviathan summons the Mire Heads!',
    ],
    defeatToast: 'Bone Leviathan Shattered! Verdant Colosseum awaits.',
  },
  colosseum_bull: {
    id: 'colosseum_bull',
    def: BOSS_CONSTANTS.colosseum_bull,
    radius: 56,
    moveSpeed: 260,
    baseDamage: 24,
    attackSequence: ['lunge_dash', 'radial_slam', 'whip_whirl', 'lunge_dash'],
    phaseTransitionDuration: 1.2,
    spiralOrbCount: 12,
    spiralOrbSpeed: 420,
    escortArchetype: 'colosseum_swordsman',
    escortCountByPhase: [0],
    dangerColor: '#ff4838',
    accentColor: '#ffd166',
    phaseLines: ['Colosseum Bull roars into a frenzied charge!'],
    defeatToast: 'Colosseum Bull Defeated!',
  },
  colosseum_spearlord: {
    id: 'colosseum_spearlord',
    def: BOSS_CONSTANTS.colosseum_spearlord,
    radius: 44,
    moveSpeed: 240,
    baseDamage: 22,
    attackSequence: ['spear_sweep', 'orb_spread', 'lunge_dash', 'bomb_circles'],
    phaseTransitionDuration: 1.25,
    spiralOrbCount: 14,
    spiralOrbSpeed: 430,
    escortArchetype: 'colosseum_bowman',
    escortCountByPhase: [2],
    dangerColor: '#ffd043',
    accentColor: '#5ef2e6',
    phaseLines: ['Colosseum Spearlord invokes Divine Aid!'],
    defeatToast: 'Champions of the Colosseum Defeated! Crypt of Bile awaits.',
  },
  the_ferryman: {
    id: 'the_ferryman',
    def: BOSS_CONSTANTS.the_ferryman,
    radius: 52,
    moveSpeed: 190,
    baseDamage: 26,
    attackSequence: ['spear_sweep', 'orb_spread', 'bomb_circles', 'whip_whirl'],
    phaseTransitionDuration: 1.25,
    spiralOrbCount: 18,
    spiralOrbSpeed: 380,
    escortArchetype: 'numbskull',
    escortCountByPhase: [0, 0],
    dangerColor: '#9c4dff',
    accentColor: '#ffd54f',
    phaseLines: [
      'The Ferryman parts the Stygian tide!',
      'The Ferryman raises his gilded oar!',
    ],
    defeatToast: 'The Ferryman nods in grim respect.',
  },
  sovereign_lord: {
    id: 'sovereign_lord',
    def: BOSS_CONSTANTS.sovereign_lord,
    radius: 58,
    moveSpeed: 255,
    baseDamage: 28,
    attackSequence: ['spear_sweep', 'lunge_dash', 'bomb_circles', 'orb_spread', 'radial_slam'],
    phaseTransitionDuration: 1.4,
    spiralOrbCount: 18,
    spiralOrbSpeed: 420,
    escortArchetype: 'wretched_husk',
    escortCountByPhase: [2, 3],
    dangerColor: '#ff2a3c',
    accentColor: '#c7ebff',
    phaseLines: [
      'Sovereign Lord refuses to yield — Phase II Awakens!',
      'Sovereign Lord unleashes the Abyssal Crown!',
    ],
    defeatToast: 'VICTORY! Sovereign Lord has fallen — you have escaped the Deep!',
  },
};

export function getBossConfig(bossId: BossId): BossRuntimeConfig {
  return BOSS_CONFIGS[bossId];
}
