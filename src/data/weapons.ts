import {
  WEAPON_CONSTANTS,
  type WeaponBaseDef,
  type WeaponId,
} from '../contracts/index.js';

export interface AttackStageTuning {
  damage: number;
  range: number;
  arcDeg: number;
  chargeSec: number;
  activeSec: number;
  recoverySec: number;
  comboWindowSec: number;
  selfVelocity: number;
  impactVelocity: number;
  isThrust?: boolean;
  reverseSweep?: boolean;
}

export interface WeaponCombatTuning {
  id: WeaponId;
  comboStages: readonly AttackStageTuning[];
  dashStrike: AttackStageTuning;
  specialChargeSec: number;
  specialActiveSec: number;
  specialImpactVelocity: number;
  specialSelfVelocity: number;
  specialScaleY: number;
}

export const WEAPON_IDS: readonly WeaponId[] = [
  'stygian_blade',
  'eternal_spear',
  'shield_of_chaos',
  'heart_seeking_bow',
  'twin_fists',
  'adamant_rail',
] as const;

export const WEAPONS: Readonly<Record<WeaponId, WeaponBaseDef>> = WEAPON_CONSTANTS;

export const WEAPON_TUNING: Readonly<Record<WeaponId, WeaponCombatTuning>> = {
  stygian_blade: {
    id: 'stygian_blade',
    comboStages: [
      {
        // Swing 1: 20 dmg, wide 130 deg arc, r=260, 4f charge
        damage: 20,
        range: 260,
        arcDeg: 130,
        chargeSec: 4 / 60,
        activeSec: 6 / 60,
        recoverySec: 0.18,
        comboWindowSec: 0.425,
        selfVelocity: 180,
        impactVelocity: 650,
        reverseSweep: false,
      },
      {
        // Swing 2: 25 dmg, reverse 130 deg arc, 10f charge, 0.425s window
        damage: 25,
        range: 265,
        arcDeg: 130,
        chargeSec: 10 / 60,
        activeSec: 6 / 60,
        recoverySec: 0.21,
        comboWindowSec: 0.35,
        selfVelocity: 220,
        impactVelocity: 820,
        reverseSweep: true,
      },
      {
        // Thrust 3: 30 dmg lunge SelfVelocity 600, ImpactVelocity 3000, 0.3s charge, 0.35s window
        damage: 30,
        range: 305,
        arcDeg: 64,
        chargeSec: 0.3,
        activeSec: 7 / 60,
        recoverySec: 0.28,
        comboWindowSec: 0,
        selfVelocity: 600,
        impactVelocity: 3000,
        isThrust: true,
      },
    ],
    dashStrike: {
      // Dash-Strike: 30 dmg, 0f charge, forward lunge 400
      damage: 30,
      range: 275,
      arcDeg: 140,
      chargeSec: 0,
      activeSec: 5 / 60,
      recoverySec: 0.16,
      comboWindowSec: 0.32,
      selfVelocity: 400,
      impactVelocity: 900,
      reverseSweep: false,
    },
    specialChargeSec: 0.2,
    specialActiveSec: 0.12,
    specialImpactVelocity: 1500,
    specialSelfVelocity: 0,
    specialScaleY: 0.56,
  },
  eternal_spear: {
    id: 'eternal_spear',
    comboStages: [
      {
        damage: 25,
        range: 430,
        arcDeg: 44,
        chargeSec: 0.11,
        activeSec: 0.08,
        recoverySec: 0.18,
        comboWindowSec: 0.4,
        selfVelocity: 140,
        impactVelocity: 500,
        isThrust: true,
      },
      {
        damage: 30,
        range: 430,
        arcDeg: 44,
        chargeSec: 0.11,
        activeSec: 0.08,
        recoverySec: 0.19,
        comboWindowSec: 0.38,
        selfVelocity: 160,
        impactVelocity: 600,
        isThrust: true,
      },
      {
        damage: 30,
        range: 455,
        arcDeg: 52,
        chargeSec: 0.15,
        activeSec: 0.1,
        recoverySec: 0.24,
        comboWindowSec: 0,
        selfVelocity: 240,
        impactVelocity: 1200,
        isThrust: true,
      },
    ],
    dashStrike: {
      damage: 20,
      range: 390,
      arcDeg: 95,
      chargeSec: 0,
      activeSec: 0.08,
      recoverySec: 0.15,
      comboWindowSec: 0.3,
      selfVelocity: 320,
      impactVelocity: 700,
    },
    specialChargeSec: 0.12,
    specialActiveSec: 0.08,
    specialImpactVelocity: 800,
    specialSelfVelocity: -120,
    specialScaleY: 0.56,
  },
  shield_of_chaos: {
    id: 'shield_of_chaos',
    comboStages: [
      {
        damage: 25,
        range: 155,
        arcDeg: 140,
        chargeSec: 0.12,
        activeSec: 0.09,
        recoverySec: 0.22,
        comboWindowSec: 0.35,
        selfVelocity: 180,
        impactVelocity: 1600,
      },
    ],
    dashStrike: {
      damage: 25,
      range: 175,
      arcDeg: 145,
      chargeSec: 0,
      activeSec: 0.08,
      recoverySec: 0.16,
      comboWindowSec: 0.3,
      selfVelocity: 360,
      impactVelocity: 1400,
    },
    specialChargeSec: 0.1,
    specialActiveSec: 0.08,
    specialImpactVelocity: 700,
    specialSelfVelocity: 0,
    specialScaleY: 0.56,
  },
  heart_seeking_bow: {
    id: 'heart_seeking_bow',
    comboStages: [
      {
        damage: 60,
        range: 900,
        arcDeg: 14,
        chargeSec: 0.6,
        activeSec: 0.08,
        recoverySec: 0.18,
        comboWindowSec: 0,
        selfVelocity: -140,
        impactVelocity: 850,
      },
    ],
    dashStrike: {
      damage: 40,
      range: 850,
      arcDeg: 14,
      chargeSec: 0.22,
      activeSec: 0.08,
      recoverySec: 0.14,
      comboWindowSec: 0,
      selfVelocity: -80,
      impactVelocity: 700,
    },
    specialChargeSec: 0.16,
    specialActiveSec: 0.1,
    specialImpactVelocity: 400,
    specialSelfVelocity: -120,
    specialScaleY: 0.56,
  },
  twin_fists: {
    id: 'twin_fists',
    comboStages: [
      { damage: 15, range: 120, arcDeg: 112, chargeSec: 0.05, activeSec: 0.06, recoverySec: 0.08, comboWindowSec: 0.35, selfVelocity: 140, impactVelocity: 320 },
      { damage: 15, range: 120, arcDeg: 112, chargeSec: 0.05, activeSec: 0.06, recoverySec: 0.08, comboWindowSec: 0.35, selfVelocity: 140, impactVelocity: 320, reverseSweep: true },
      { damage: 15, range: 125, arcDeg: 112, chargeSec: 0.05, activeSec: 0.06, recoverySec: 0.08, comboWindowSec: 0.35, selfVelocity: 150, impactVelocity: 360 },
      { damage: 15, range: 125, arcDeg: 112, chargeSec: 0.05, activeSec: 0.06, recoverySec: 0.08, comboWindowSec: 0.35, selfVelocity: 150, impactVelocity: 380, reverseSweep: true },
      { damage: 15, range: 135, arcDeg: 120, chargeSec: 0.07, activeSec: 0.07, recoverySec: 0.14, comboWindowSec: 0, selfVelocity: 220, impactVelocity: 900 },
    ],
    dashStrike: {
      damage: 25,
      range: 140,
      arcDeg: 120,
      chargeSec: 0,
      activeSec: 0.06,
      recoverySec: 0.11,
      comboWindowSec: 0.32,
      selfVelocity: 360,
      impactVelocity: 600,
    },
    specialChargeSec: 0.12,
    specialActiveSec: 0.12,
    specialImpactVelocity: 1200,
    specialSelfVelocity: 260,
    specialScaleY: 0.56,
  },
  adamant_rail: {
    id: 'adamant_rail',
    comboStages: [
      {
        damage: 10,
        range: 710,
        arcDeg: 8,
        chargeSec: 0.02,
        activeSec: 0.04,
        recoverySec: 0.08,
        comboWindowSec: 0,
        selfVelocity: -40,
        impactVelocity: 220,
      },
    ],
    dashStrike: {
      damage: 10,
      range: 710,
      arcDeg: 8,
      chargeSec: 0,
      activeSec: 0.04,
      recoverySec: 0.07,
      comboWindowSec: 0,
      selfVelocity: 0,
      impactVelocity: 220,
    },
    specialChargeSec: 0.14,
    specialActiveSec: 0.08,
    specialImpactVelocity: 1400,
    specialSelfVelocity: -100,
    specialScaleY: 0.56,
  },
};

export function getWeaponDef(id: WeaponId): WeaponBaseDef {
  return WEAPON_CONSTANTS[id];
}

export function getWeaponTuning(id: WeaponId): WeaponCombatTuning {
  return WEAPON_TUNING[id];
}
