import { describe, expect, it } from 'vitest';
import {
  BIOME_CONSTANTS,
  BOSS_CONSTANTS,
  COMBAT_CONSTANTS,
  EMPTY_INPUT_FRAME,
  LAVA_CONSTANTS,
  type BiomeId,
  type BoonRarity,
  type EnemyState,
  type InputFrame,
  type PatronId,
  type SimState,
} from '../src/contracts/index.js';
import { BIOME_PROGRESSION_ORDER } from '../src/data/biomes.js';
import {
  ALL_PATRONS,
  computeBoonScaledValue,
  getAllDuoBoons,
  getBoonCatalogEntry,
} from '../src/data/boons.js';
import {
  applySelectedBoon,
  deflectProjectilesInRadius,
  generateBoonOffer,
  generateChaosOffer,
  generateHammerOffer,
  generatePomOffer,
  grantBoonDirect,
  handleBoonOnAttackHit,
  handleBoonOnDash,
  instantiateBoon,
  rerollBoonOffer,
  tickBoons,
} from '../src/sim/boons.js';
import { dealDamageToEnemy } from '../src/sim/combat.js';
import { spawnEnemy } from '../src/sim/enemies.js';
import { createDefaultMetaSave } from '../src/sim/meta.js';
import {
  borrowFerrymanGoldBag,
  buyShopPickup,
  createGameplayHooks,
  loadRoom,
  startNewRun,
  warpToBiome,
  warpToBoss,
} from '../src/sim/rooms.js';
import { applyStatus, getStatus } from '../src/sim/status.js';
import { createDefaultSimState, getCombatContext, stepSim } from '../src/sim/step.js';

function makeInput(overrides: Partial<InputFrame> = {}): InputFrame {
  return {
    ...EMPTY_INPUT_FRAME,
    ...overrides,
  };
}

function createCampaignState(seed = 4242): {
  state: SimState;
  hooks: ReturnType<typeof createGameplayHooks>;
} {
  const meta = createDefaultMetaSave();
  meta.selectedKeepsake = null;
  meta.mirrorRanks.fated_authority = 3;
  meta.mirrorActiveSide.fated_authority = 'b'; // Fated Persuasion (3 boon rerolls)
  const state = createDefaultSimState(seed, meta);
  const hooks = createGameplayHooks();
  startNewRun(state, seed);
  return { state, hooks };
}

function addTarget(state: SimState, x: number, y: number, hp = 2000): EnemyState {
  const enemy = spawnEnemy(state, 'wretched_husk', { x, y });
  enemy.invulnerable = false;
  enemy.invulnTimer = 0;
  enemy.aiState = 'idle';
  enemy.hp = hp;
  enemy.maxHp = hp;
  enemy.armor = 0;
  enemy.maxArmor = 0;
  return enemy;
}

describe('Patrons (10), Rarity/Pom Scaling, Approval Process, Rerolls, Chaos & 14 Duos', () => {
  it('generates and applies valid Boon offers for ALL 10 Patrons (voltaris..abyssos)', () => {
    expect(ALL_PATRONS).toHaveLength(10);

    for (const patronId of ALL_PATRONS) {
      const { state } = createCampaignState(1000 + ALL_PATRONS.indexOf(patronId));
      const offer = generateBoonOffer(state, patronId);
      expect(offer.patronId).toBe(patronId);
      expect(offer.options.length).toBeGreaterThanOrEqual(1);
      expect(state.run.pendingOffer).toBe(offer);

      const applied = applySelectedBoon(state, 0);
      expect(applied).toBe(true);
      expect(state.run.pendingOffer).toBeNull();
      if (patronId === 'abyssos') {
        expect(state.player.chaosCurses.length).toBe(1);
      } else {
        expect(state.player.boons.some((b) => b.patronId === patronId)).toBe(true);
      }
    }
  });

  it('scales boon values across rarities (1.0 / 1.4 / 2.0 / 2.5) and Pom diminishing returns (0.7)', () => {
    const rarities: Array<[BoonRarity, number]> = [
      ['common', 100],
      ['rare', 140],
      ['epic', 200],
      ['heroic', 250],
    ];
    for (const [rarity, expected] of rarities) {
      expect(computeBoonScaledValue(100, rarity, 1)).toBe(expected);
    }

    // Pom diminishing curve: lv2 = +35, lv3 = +35*0.7 (24.5), lv4 = +35*0.49 (17.15)
    const lv1 = computeBoonScaledValue(100, 'common', 1);
    const lv2 = computeBoonScaledValue(100, 'common', 2);
    const lv3 = computeBoonScaledValue(100, 'common', 3);
    const lv4 = computeBoonScaledValue(100, 'common', 4);
    expect(lv1).toBe(100);
    expect(lv2).toBe(135);
    expect(lv3).toBe(160); // round(135 + 24.5)
    expect(lv4).toBe(177); // round(159.5 + 17.15)
    expect(lv3 - lv2).toBeLessThan(lv2 - lv1);
    expect(lv4 - lv3).toBeLessThan(lv3 - lv2);

    // Live Pom offer upgrades an active boon cleanly
    const { state } = createCampaignState();
    const boon = grantBoonDirect(state, 'voltaris', 'attack', 'common')!;
    const beforeVal = boon.scaledValue;
    const pomOffer = generatePomOffer(state);
    expect(pomOffer.options[0].kind).toBe('pom_upgrade');
    expect(applySelectedBoon(state, 0)).toBe(true);
    expect(boon.level).toBe(2);
    expect(boon.scaledValue).toBeGreaterThan(beforeVal);
  });

  it('approval_process reduces Patron, Hammer, and Chaos offer choices from 3 -> 2 -> 1', () => {
    const { state } = createCampaignState();

    state.run.vows.approval_process = 0;
    expect(generateBoonOffer(state, 'voltaris').options).toHaveLength(3);
    expect(generateHammerOffer(state).options).toHaveLength(3);
    expect(generateChaosOffer(state).options).toHaveLength(3);

    state.run.vows.approval_process = 1;
    expect(generateBoonOffer(state, 'tidebreaker').options).toHaveLength(2);
    expect(generateHammerOffer(state).options).toHaveLength(2);
    expect(generateChaosOffer(state).options).toHaveLength(2);

    state.run.vows.approval_process = 2;
    expect(generateBoonOffer(state, 'aegira').options).toHaveLength(1);
    expect(generateHammerOffer(state).options).toHaveLength(1);
    expect(generateChaosOffer(state).options).toHaveLength(1);
  });

  it('Fated Persuasion rerolls Boon offers, excludes previous IDs, and stops at 0 rerolls', () => {
    const { state } = createCampaignState();
    state.run.boonRerolls = 1;

    const first = generateBoonOffer(state, 'voltaris');
    const firstIds = first.options.map((o) => o.boonId);
    expect(first.rerollsRemaining).toBe(1);

    expect(rerollBoonOffer(state)).toBe(true);
    expect(state.run.boonRerolls).toBe(0);
    const second = state.run.pendingOffer!;
    expect(second.rerollsRemaining).toBe(0);
    // At least one option changed because previousIds were excluded
    const secondIds = second.options.map((o) => o.boonId);
    expect(secondIds).not.toEqual(firstIds);

    // No rerolls left -> returns false
    expect(rerollBoonOffer(state)).toBe(false);
  });

  it('Chaos curse matures over 3-4 encounters and awakens its Void blessing boon', () => {
    const { state } = createCampaignState(8080);
    const offer = generateChaosOffer(state);
    expect(offer.options.length).toBe(3);
    for (const opt of offer.options) {
      expect(opt.curseEncounters).toBeGreaterThanOrEqual(3);
      expect(opt.curseEncounters).toBeLessThanOrEqual(4);
    }

    expect(applySelectedBoon(state, 0)).toBe(true);
    expect(state.player.chaosCurses).toHaveLength(1);
    const curse = state.player.chaosCurses[0];
    const expectedEnc = curse.encountersRemaining;
    const blessingId = curse.blessingBoon.id;

    // Advance encounters one by one
    for (let i = 1; i < expectedEnc; i++) {
      loadRoom(state, 'obsidian_pit', i + 1, 'combat');
      expect(state.player.chaosCurses).toHaveLength(1);
      expect(state.player.chaosCurses[0].encountersRemaining).toBe(expectedEnc - i);
    }

    // Final encounter matures the curse into the blessing boon!
    loadRoom(state, 'obsidian_pit', expectedEnc + 1, 'combat');
    expect(state.player.chaosCurses).toHaveLength(0);
    expect(state.player.boons.some((b) => b.id === blessingId)).toBe(true);
  });

  it('verifies eligibility gating for ALL 14 Duo Boons', () => {
    const allDuos = getAllDuoBoons();
    expect(allDuos).toHaveLength(14);

    for (const duo of allDuos) {
      const [pA, pB] = duo.duoPatrons!;

      // 1. With ONLY Patron A (missing Patron B), the duo must NEVER be offered even when all Patron A non-duo boons are already owned
      const { state: sOnlyA } = createCampaignState(9001);
      grantBoonDirect(sOnlyA, pA, 'attack', 'common');
      // Exhaust all non-duo boons from pA
      for (let i = 0; i < 10; i++) {
        const offer = generateBoonOffer(sOnlyA, pA);
        expect(offer.options.some((o) => o.boonId === duo.id)).toBe(false);
        // Pick first non-fallback boon if any
        if (offer.options[0].kind === 'boon') {
          applySelectedBoon(sOnlyA, 0);
        }
      }

      // 2. With BOTH Patron A & Patron B, the duo MUST become eligible and appear in offers!
      const { state: sBoth } = createCampaignState(9002);
      grantBoonDirect(sBoth, pA, 'attack', 'common');
      grantBoonDirect(sBoth, pB, 'special', 'common');
      let foundDuo = false;
      for (let attempt = 0; attempt < 25 && !foundDuo; attempt++) {
        const offer = generateBoonOffer(sBoth, duo.patronId);
        if (offer.options.some((o) => o.boonId === duo.id)) {
          foundDuo = true;
        }
      }
      expect(foundDuo, `Expected Duo ${duo.id} (${pA}+${pB}) to appear when both patrons held`).toBe(true);
    }
  });

  it('verifies live combat effects for ALL 14 Duo Boons', () => {
    const ctx = getCombatContext();
    const giveDuo = (state: SimState, duoId: string) => {
      const entry = getBoonCatalogEntry(duoId)!;
      state.player.boons.push(instantiateBoon(entry, 'duo', 1));
    };

    // 1. duo_merciful_doom: Aegira attack instantly detonates Doom (+45 bonus)
    {
      const { state } = createCampaignState();
      grantBoonDirect(state, 'aegira', 'attack', 'common');
      giveDuo(state, 'duo_merciful_doom');
      const e = addTarget(state, 120, 0);
      applyStatus(state, e, 'enemy', 'doom', 1, 'bellum');
      const hpBefore = e.hp;
      handleBoonOnAttackHit(state, e, 'attack', 30, ctx);
      expect(getStatus(e.statuses, 'doom')).toBeUndefined();
      expect(e.hp).toBe(hpBefore - (COMBAT_CONSTANTS.statusDefaults.doom.baseDamage + 45));
    }

    // 2. duo_hunting_blades: Blade Rift lasts +2s longer and steers toward enemy
    {
      const { state } = createCampaignState();
      grantBoonDirect(state, 'bellum', 'dash', 'common');
      giveDuo(state, 'duo_hunting_blades');
      const e = addTarget(state, 300, 0);
      handleBoonOnDash(state, { x: 0, y: 0 }, { x: 100, y: 0 }, false, ctx);
      const rift = state.room.hazards.find((h) => h.kind === 'rift_vortex')!;
      expect(rift.timer).toBeGreaterThan(3.0); // 1.4 base + 2.0 duo
      const startX = rift.pos.x;
      tickBoons(state, 0.25, ctx);
      expect(rift.pos.x).toBeGreaterThan(startX + 40);
      expect(e.hp).toBeGreaterThan(0);
    }

    // 3. duo_sea_storm: Tidebreaker knockback triggers Voltaris bolt strike
    {
      const { state } = createCampaignState();
      grantBoonDirect(state, 'tidebreaker', 'attack', 'common');
      giveDuo(state, 'duo_sea_storm');
      const e = addTarget(state, 120, 0);
      const hpBefore = e.hp;
      handleBoonOnAttackHit(state, e, 'attack', 40, ctx);
      expect(state.projectiles.some((p) => p.kind === 'lightning' && p.patronId === 'voltaris')).toBe(true);
      expect(e.hp).toBeLessThanOrEqual(hpBefore - 40);
    }

    // 4. duo_smoldering_air: auto-charges God Gauge to 25% cap
    {
      const { state } = createCampaignState();
      giveDuo(state, 'duo_smoldering_air');
      state.player.godGauge = 0;
      tickBoons(state, 1.0, ctx);
      expect(state.player.godGauge).toBeCloseTo(6, 2);
      tickBoons(state, 10.0, ctx);
      expect(state.player.godGauge).toBe(25);
    }

    // 5. duo_crystal_clarity: Glaciera Crystal Beam pylon gets +25% damage
    {
      const { state: sBase } = createCampaignState();
      grantBoonDirect(sBase, 'glaciera', 'cast', 'common');
      const eBase = addTarget(sBase, 200, 0);
      handleBoonOnAttackHit(sBase, eBase, 'cast', 20, ctx);
      const basePylonDmg = sBase.room.hazards.find((h) => h.kind === 'pylon')!.damage;

      const { state: sDuo } = createCampaignState();
      grantBoonDirect(sDuo, 'glaciera', 'cast', 'common');
      giveDuo(sDuo, 'duo_crystal_clarity');
      const eDuo = addTarget(sDuo, 200, 0);
      handleBoonOnAttackHit(sDuo, eDuo, 'cast', 20, ctx);
      const duoPylonDmg = sDuo.room.hazards.find((h) => h.kind === 'pylon')!.damage;
      expect(duoPylonDmg).toBeGreaterThan(basePylonDmg);
    }

    // 6. duo_splitting_headache: Hangover stacks trigger Sylvara crit-echo procs
    {
      const { state } = createCampaignState(777);
      giveDuo(state, 'duo_splitting_headache');
      const e = addTarget(state, 120, 0, 20000);
      applyStatus(state, e, 'enemy', 'hangover', 5, 'bacchion');
      const hpBefore = e.hp;
      for (let i = 0; i < 40; i++) {
        handleBoonOnAttackHit(state, e, 'attack', 100, ctx);
      }
      expect(e.hp).toBeLessThan(hpBefore);
    }

    // 7. duo_lightning_rod: uncollected floor Bloodstones zap nearby foes every 1.0s
    {
      const { state } = createCampaignState();
      giveDuo(state, 'duo_lightning_rod');
      const e = addTarget(state, 100, 0);
      state.room.bloodstones.push({
        id: 'bs_rod_1',
        pos: { x: 100, y: 0 },
        vel: { x: 0, y: 0 },
        life: 0.5,
        magnetizing: false,
      });
      const hpBefore = e.hp;
      tickBoons(state, 1.05, ctx);
      expect(e.hp).toBe(hpBefore - 70);
    }

    // 8. duo_deadly_reversal: Deflecting grants 2.5s bonus crit chance
    {
      const { state } = createCampaignState(555);
      giveDuo(state, 'duo_deadly_reversal');
      const e = addTarget(state, 120, 0, 20000);
      ctx.spawnProjectile(state, {
        owner: 'enemy',
        ownerId: e.id,
        kind: 'orb',
        pos: { x: 40, y: 0 },
        vel: { x: -300, y: 0 },
        startPos: { x: 120, y: 0 },
        radius: 12,
        angle: Math.PI,
        damage: 15,
        range: 500,
        maxLife: 2,
        pierceLeft: 0,
        bouncesLeft: 0,
        deflectable: true,
        deflected: false,
        homingStrength: 0,
        isLob: false,
        lobHeight: 0,
        lobDuration: 0,
        lobElapsed: 0,
      });
      expect(deflectProjectilesInRadius(state, { x: 0, y: 0 }, 150, false, ctx)).toBe(1);
      const hpBefore = e.hp;
      for (let i = 0; i < 30; i++) {
        handleBoonOnAttackHit(state, e, 'attack', 100, ctx);
      }
      expect(e.hp).toBeLessThan(hpBefore);
    }

    // 9. duo_heart_rend: Crit-echo deals +50% extra bonus damage vs Weak enemy
    {
      const runEcho = (withWeak: boolean): number => {
        const { state } = createCampaignState(12345);
        // Set pressure_points scaledValue = 1.0 so crit-echo procs deterministically on hit 1
        const pp = grantBoonDirect(state, 'sylvara', 'passive', 'common')!;
        state.player.boons = [
          { ...pp, id: 'sylvara_pressure_points', scaledValue: 1.0 },
        ];
        giveDuo(state, 'duo_heart_rend');
        const e = addTarget(state, 120, 0, 5000);
        if (withWeak) applyStatus(state, e, 'enemy', 'weak', 1, 'velouris');
        const hpBefore = e.hp;
        handleBoonOnAttackHit(state, e, 'attack', 100, ctx);
        return hpBefore - e.hp;
      };
      expect(runEcho(true)).toBeGreaterThan(runEcho(false));
    }

    // 10. duo_vengeful_mood: automatic thunder pulse every 3.0s during combat
    {
      const { state } = createCampaignState();
      giveDuo(state, 'duo_vengeful_mood');
      const e = addTarget(state, state.player.pos.x + 120, state.player.pos.y);
      const hpBefore = e.hp;
      tickBoons(state, 3.05, ctx);
      expect(e.hp).toBe(hpBefore - 65);
    }

    // 11. duo_ice_wine: Festive Fog cast deals +35% AoE damage and inflicts Chill
    {
      const { state } = createCampaignState();
      grantBoonDirect(state, 'bacchion', 'cast', 'common');
      giveDuo(state, 'duo_ice_wine');
      const e1 = addTarget(state, 150, 0);
      const e2 = addTarget(state, 200, 0);
      const e2HpBefore = e2.hp;
      handleBoonOnAttackHit(state, e1, 'cast', 112, ctx);
      expect(getStatus(e1.statuses, 'chill')).toBeDefined();
      expect(getStatus(e2.statuses, 'chill')).toBeDefined();
      expect(e2HpBefore - e2.hp).toBe(Math.round(112 * 1.35));
    }

    // 12. duo_blizzard_shot: Cast hit spawns 6 frost shards with Chill
    {
      const { state } = createCampaignState();
      giveDuo(state, 'duo_blizzard_shot');
      const e = addTarget(state, 150, 0);
      handleBoonOnAttackHit(state, e, 'cast', 50, ctx);
      const shards = state.projectiles.filter((p) => p.kind === 'dart' && p.statusToApply === 'chill');
      expect(shards).toHaveLength(6);
    }

    // 13. duo_lightning_phalanx: Cast hit arcs chain lightning to nearby enemies
    {
      const { state } = createCampaignState();
      giveDuo(state, 'duo_lightning_phalanx');
      const e1 = addTarget(state, 150, 0);
      const e2 = addTarget(state, 260, 0);
      const hp2Before = e2.hp;
      handleBoonOnAttackHit(state, e1, 'cast', 50, ctx);
      expect(e2.hp).toBe(hp2Before - 35);
    }

    // 14. duo_parting_shot: Cast hit inflicts BOTH Exposed and Weak
    {
      const { state } = createCampaignState();
      giveDuo(state, 'duo_parting_shot');
      const e = addTarget(state, 150, 0);
      handleBoonOnAttackHit(state, e, 'cast', 50, ctx);
      expect(getStatus(e.statuses, 'exposed')).toBeDefined();
      expect(getStatus(e.statuses, 'weak')).toBeDefined();
    }
  });

  it('isolates rail_beam Hellfire Mines (mine_*) from Glaciera Crystal Beams (crystal_*) and deals exact 1x take_damage_on_dash', () => {
    const ctx = getCombatContext();

    // A. Hellfire Mine (`mine_*`) is NOT touched by tickBoons Crystal Beam loop
    const { state: sMine } = createCampaignState(4101);
    const mineTarget = addTarget(sMine, 180, 0, 2000);
    sMine.room.hazards.push({
      id: 'mine_isolation_1',
      kind: 'pylon',
      pos: { x: 100, y: 0 },
      radius: 40,
      active: true,
      armed: true,
      timer: 5.0,
      cooldown: 0,
      damage: 25,
      owner: 'player',
    });
    tickBoons(sMine, 0.25, ctx);
    const mineHazard = sMine.room.hazards.find((h) => h.id === 'mine_isolation_1')!;
    expect(mineHazard.timer).toBeCloseTo(5.0, 5);
    expect(getStatus(mineTarget.statuses, 'chill')).toBeUndefined();
    expect(sMine.projectiles.filter((p) => p.kind === 'beam')).toHaveLength(0);

    // B. Crystal Beam (`crystal_*`) is NOT ticked or pulsed by tickHazards Hellfire Mine loop
    const { state: sCrystal } = createCampaignState(4102);
    const cryTarget = addTarget(sCrystal, 100, 0, 2000);
    sCrystal.room.hazards.push({
      id: 'crystal_isolation_1',
      kind: 'pylon',
      pos: { x: 80, y: 0 },
      radius: 30,
      active: true,
      armed: true,
      timer: 5.0,
      cooldown: 0,
      damage: 18,
      owner: 'player',
    });
    const hpBeforeCry = cryTarget.hp;
    // Step sim WITHOUT gameplay hooks so only tickHazards runs
    for (let i = 0; i < 40; i++) stepSim(sCrystal, makeInput());
    const cryHazard = sCrystal.room.hazards.find((h) => h.id === 'crystal_isolation_1')!;
    expect(cryHazard.timer).toBeCloseTo(5.0, 5);
    expect(cryTarget.hp).toBe(hpBeforeCry);

    // C. Chaos curse `take_damage_on_dash` deals exact 1x curseMagnitude damage when gameplay hooks are active
    const { state: sDash, hooks: hDash } = createCampaignState(4103);
    sDash.player.chaosCurses.push({
      id: 'chaos_curse_dash',
      curseKind: 'take_damage_on_dash',
      curseMagnitude: 4,
      encountersRemaining: 3,
      blessingBoon: {
        id: 'abyssos_strike',
        patronId: 'abyssos',
        slot: 'passive',
        name: 'Void Strike',
        description: '+30% Attack',
        rarity: 'common',
        level: 1,
        baseValue: 0.3,
        scaledValue: 0.3,
      },
    });
    const hpBeforeDash = sDash.player.hp;
    stepSim(sDash, makeInput({ moveX: 1, dash: true, dashPressed: true }), hDash);
    expect(sDash.player.hp).toBe(hpBeforeDash - 4);
  });
});

describe('All 5 Biomes, Hazards, Soul-Eye, Styx 5-Wing Hub, Boatman Shop & Trial Room', () => {
  it('loads all 5 campaign biomes cleanly with valid geometry and enemy rosters', () => {
    const expectedBiomes: BiomeId[] = [
      'obsidian_pit',
      'cinder_mire',
      'verdant_colosseum',
      'crypt_of_bile',
      'frozen_summit',
    ];
    expect(BIOME_PROGRESSION_ORDER).toEqual(expectedBiomes);

    const { state } = createCampaignState();
    for (const biome of expectedBiomes) {
      warpToBiome(state, biome, biome === 'crypt_of_bile' ? 1 : 2);
      expect(state.room.biome).toBe(biome);
      expect(state.room.width).toBeGreaterThan(800);
      expect(state.room.height).toBeGreaterThan(600);
      const [zMin, zMax] = BIOME_CONSTANTS[biome].zoomRange;
      expect(state.room.zoom).toBeGreaterThanOrEqual(zMin - 0.001);
      expect(state.room.zoom).toBeLessThanOrEqual(zMax + 0.001);
    }
  });

  it('Cinder Mire: lava grace period (0.35s) prevents instant burn, then ticks 5 dmg / 0.4s', () => {
    const { state } = createCampaignState();
    warpToBiome(state, 'cinder_mire', 2);
    state.enemies = []; // isolate lava test
    const lava = state.room.hazards.find((h) => h.kind === 'lava_pool')!;
    expect(lava).toBeDefined();

    // 1 tick on safe floor ensures lavaGraceTimer resets to full 0.35s
    stepSim(state, makeInput());
    expect(state.player.lavaGraceTimer).toBeCloseTo(LAVA_CONSTANTS.graceDuration, 4);

    // Move onto lava pool
    state.player.pos = { x: lava.pos.x, y: lava.pos.y };
    const hpBefore = state.player.hp;

    // During 0.35s grace (20 ticks = 0.333s) -> 0 damage
    for (let i = 0; i < 20; i++) stepSim(state, makeInput());
    expect(state.player.inLava).toBe(true);
    expect(state.player.hp).toBe(hpBefore);

    // Next 3 ticks -> grace expires and first 5-dmg lava tick hits!
    for (let i = 0; i < 3; i++) stepSim(state, makeInput());
    expect(state.player.hp).toBe(hpBefore - LAVA_CONSTANTS.damage);

    // Another 30 ticks (accounts for 0.04s hitstop after hit 1 + 0.40s tick interval) -> second 5-dmg tick hits!
    for (let i = 0; i < 30; i++) stepSim(state, makeInput());
    expect(state.player.hp).toBe(hpBefore - LAVA_CONSTANTS.damage * 2);
  });

  it('Verdant Colosseum: Exalted warrior drops Soul-Eye that reforms after 4.0s OR shatters cleanly when killed', () => {
    // Case A: Soul-Eye left alive for 4.0s -> reforms Exalted Warrior!
    const { state: sRespawn, hooks: hRespawn } = createCampaignState();
    warpToBiome(sRespawn, 'verdant_colosseum', 2);
    sRespawn.room.totalWaves = 1;
    sRespawn.enemies = [];
    const exalted = spawnEnemy(sRespawn, 'colosseum_swordsman', { x: 200, y: 0 });
    exalted.invulnerable = false;
    exalted.invulnTimer = 0;
    dealDamageToEnemy(sRespawn, exalted, { baseDamage: 9999, source: 'attack' }, hRespawn, getCombatContext());

    const orb = sRespawn.enemies.find((e) => e.archetype === 'soul_orb' && e.hp > 0);
    expect(orb).toBeDefined();
    sRespawn.run.finalKillSlowTimer = 0;
    sRespawn.timeScale = 1.0;

    // Step 4.1s (246 ticks)
    for (let i = 0; i < 246; i++) {
      stepSim(sRespawn, makeInput(), hRespawn);
    }
    expect(orb!.hp).toBe(0);
    const reformed = sRespawn.enemies.find(
      (e) => e.archetype === 'colosseum_swordsman' && e.id !== exalted.id && e.hp > 0
    );
    expect(reformed).toBeDefined();
    expect(reformed!.hp).toBeLessThan(reformed!.maxHp); // ~55% HP

    // Case B: Shatter Soul-Eye before 4.0s -> NO respawn!
    const { state: sShatter, hooks: hShatter } = createCampaignState();
    warpToBiome(sShatter, 'verdant_colosseum', 2);
    sShatter.room.totalWaves = 1;
    sShatter.enemies = [];
    const ex2 = spawnEnemy(sShatter, 'colosseum_swordsman', { x: 200, y: 0 });
    ex2.invulnerable = false;
    ex2.invulnTimer = 0;
    dealDamageToEnemy(sShatter, ex2, { baseDamage: 9999, source: 'attack' }, hShatter, getCombatContext());
    const orb2 = sShatter.enemies.find((e) => e.archetype === 'soul_orb' && e.hp > 0)!;
    dealDamageToEnemy(sShatter, orb2, { baseDamage: 500, source: 'attack' }, hShatter, getCombatContext());
    expect(orb2.hp).toBe(0);
    sShatter.run.finalKillSlowTimer = 0;
    sShatter.timeScale = 1.0;

    for (let i = 0; i < 250; i++) {
      stepSim(sShatter, makeInput(), hShatter);
    }
    const livingExalted = sShatter.enemies.filter((e) => e.archetype === 'colosseum_swordsman' && e.hp > 0);
    expect(livingExalted).toHaveLength(0);
  });

  it('Crypt of Bile: 5-wing Styx Hub finds Abyssal Treat and unlocks Frozen Summit gate', () => {
    const { state, hooks } = createCampaignState(3333);
    warpToBiome(state, 'crypt_of_bile', 1);
    expect(state.room.encounterKind).toBe('styx_hub');

    const wingDoors = state.room.doors.filter((d) => d.id.startsWith('door_styx_wing_'));
    expect(wingDoors).toHaveLength(5);
    const summitGate = state.room.doors.find((d) => d.id === 'door_styx_summit_gate')!;
    expect(summitGate.locked).toBe(true);

    // Clear wings sequentially until satyrSackFound unlocks Summit Gate
    let unlocked = false;
    for (let attempt = 0; attempt < 5 && !unlocked; attempt++) {
      const nextWing = state.room.doors.find((d) => d.id.startsWith('door_styx_wing_') && !d.locked)!;
      expect(nextWing).toBeDefined();
      state.player.pos = { x: nextWing.pos.x, y: nextWing.pos.y };
      stepSim(state, makeInput({ interact: true, interactPressed: true }), hooks);
      expect(state.room.encounterKind).toBe('styx_wing');

      // Kill all waves in this wing
      for (let guard = 0; guard < 120 && !state.room.cleared; guard++) {
        for (const e of state.enemies) {
          if (e.hp > 0) {
            e.invulnerable = false;
            e.invulnTimer = 0;
            dealDamageToEnemy(state, e, { baseDamage: 99999, source: 'attack' }, hooks, getCombatContext());
          }
        }
        state.run.finalKillSlowTimer = 0;
        state.timeScale = 1.0;
        stepSim(state, makeInput(), hooks);
      }
      expect(state.room.cleared).toBe(true);

      // Return to Styx Hub
      const returnDoor = state.room.doors[0];
      state.player.pos = { x: returnDoor.pos.x, y: returnDoor.pos.y };
      stepSim(state, makeInput({ interact: true, interactPressed: true }), hooks);
      expect(state.room.encounterKind).toBe('styx_hub');

      const updatedGate = state.room.doors.find((d) => d.id === 'door_styx_summit_gate')!;
      if (!updatedGate.locked) {
        unlocked = true;
      }
    }

    expect(unlocked).toBe(true);
    expect(state.room.satyrSackFound).toBe(true);
    expect(state.room.styxWingsCleared).toBeGreaterThanOrEqual(2);
    expect(state.room.styxWingsCleared).toBeLessThanOrEqual(5);
  });

  it('Crypt of Bile: Poison Pool inflicts Poison DoT and Curing Pool cleanses immediately', () => {
    const { state } = createCampaignState();
    warpToBiome(state, 'crypt_of_bile', 2);
    state.enemies = [];
    const poisonPool = state.room.hazards.find((h) => h.kind === 'poison_pool')!;
    const curingPool = state.room.hazards.find((h) => h.kind === 'curing_pool')!;
    expect(poisonPool).toBeDefined();
    expect(curingPool).toBeDefined();

    // Stand in poison pool -> gains poison status and takes DoT
    state.player.pos = { x: poisonPool.pos.x, y: poisonPool.pos.y };
    const hpBefore = state.player.hp;
    for (let i = 0; i < 35; i++) stepSim(state, makeInput());
    expect(getStatus(state.player.statuses, 'poison')).toBeDefined();
    expect(state.player.hp).toBeLessThan(hpBefore);

    // Step into curing pool -> removes poison immediately and shows CURED
    state.player.pos = { x: curingPool.pos.x, y: curingPool.pos.y };
    stepSim(state, makeInput());
    expect(getStatus(state.player.statuses, 'poison')).toBeUndefined();
    expect(state.floatingNumbers.some((f) => f.value === 'CURED')).toBe(true);
  });

  it('Boatman Shop + Borrow Gold Bag grants +300g and triggers The Ferryman boss fight', () => {
    const { state } = createCampaignState();
    loadRoom(state, 'obsidian_pit', 5, 'shop');
    const heart = state.room.pickups.find((p) => p.kind === 'centaur_heart')!;
    const bag = state.room.pickups.find((p) => p.id.startsWith('shop_ferryman_bag_'))!;
    expect(heart).toBeDefined();
    expect(bag).toBeDefined();

    // Insufficient gold rejected
    state.player.gold = 10;
    expect(buyShopPickup(state, heart.id)).toBe(false);
    expect(heart.collected).toBe(false);

    // Sufficient gold buys Centaur Heart (+25 Max HP)
    state.player.gold = 200;
    const maxHpBefore = state.player.maxHp;
    expect(buyShopPickup(state, heart.id)).toBe(true);
    expect(state.player.gold).toBe(200 - heart.costGold);
    expect(state.player.maxHp).toBe(maxHpBefore + 25);

    // Borrow Gold Bag -> +300 Gold and warps into The Ferryman fight (16500 HP)!
    const goldBeforeBorrow = state.player.gold;
    expect(borrowFerrymanGoldBag(state)).toBe(true);
    expect(state.player.gold).toBe(goldBeforeBorrow + 300);
    const ferryman = state.enemies.find((e) => e.bossId === 'the_ferryman')!;
    expect(ferryman).toBeDefined();
    expect(ferryman.maxHp).toBe(BOSS_CONSTANTS.the_ferryman.maxHp);
  });

  it('Dual-Patron Trial Room enrages spurned Patron, spawns waves, and rewards second Boon on clear', () => {
    const { state, hooks } = createCampaignState();
    loadRoom(state, 'obsidian_pit', 4, 'trial');
    expect(state.room.trialPatronA).toBeDefined();
    expect(state.room.trialPatronB).toBeDefined();
    expect(state.room.trialPatronA).not.toBe(state.room.trialPatronB);
    expect(state.room.pickups).toHaveLength(2);

    // Interact with Patron A pedestal
    const pAPickup = state.room.pickups[0];
    const spurnedExpected: PatronId = state.room.trialPatronB!;
    state.player.pos = { x: pAPickup.pos.x, y: pAPickup.pos.y };
    stepSim(state, makeInput({ interact: true, interactPressed: true }), hooks);

    expect(state.room.trialSpurnedPatron).toBe(spurnedExpected);
    expect(state.run.pendingOffer?.patronId).toBe(state.room.trialPatronA);
    expect(applySelectedBoon(state, 0)).toBe(true);
    expect(state.enemies.length).toBeGreaterThan(0);

    // Step 3.6s so Spurned Patron launches at least one Trial hazard projectile
    let sawTrialHazard = false;
    for (let i = 0; i < 220; i++) {
      state.player.hp = state.player.maxHp;
      stepSim(state, makeInput(), hooks);
      if (state.projectiles.some((p) => p.ownerId === `trial_${spurnedExpected}`)) {
        sawTrialHazard = true;
        break;
      }
    }
    expect(sawTrialHazard).toBe(true);

    // Clear both waves -> Spurned Patron's Boon pedestal spawns!
    for (let guard = 0; guard < 100 && !state.room.cleared; guard++) {
      for (const e of state.enemies) {
        if (e.hp > 0) {
          e.invulnerable = false;
          e.invulnTimer = 0;
          dealDamageToEnemy(state, e, { baseDamage: 99999, source: 'attack' }, hooks, getCombatContext());
        }
      }
      state.run.finalKillSlowTimer = 0;
      state.timeScale = 1.0;
      stepSim(state, makeInput(), hooks);
    }
    expect(state.room.cleared).toBe(true);
    expect(
      state.room.pickups.some((p) => !p.collected && p.kind === 'boon' && p.patronId === spurnedExpected)
    ).toBe(true);
  });
});

describe('All 8 Boss State Machines (Including EM4 3-Phase Sovereign Lord)', () => {
  function tickPastSpawning(state: SimState, hooks: ReturnType<typeof createGameplayHooks>, ticks = 60): void {
    for (let i = 0; i < ticks; i++) {
      state.player.hp = state.player.maxHp;
      state.run.finalKillSlowTimer = 0;
      state.timeScale = 1.0;
      stepSim(state, makeInput(), hooks);
    }
  }

  it('Warden Malice (4400 HP): triggers all 3 phase thresholds (75% / 50% / 25%) and clears on defeat', () => {
    const { state, hooks } = createCampaignState();
    warpToBoss(state, 'warden_malice');
    const boss = state.enemies[0];
    expect(boss.bossId).toBe('warden_malice');
    expect(boss.maxHp).toBe(4400);

    tickPastSpawning(state, hooks, 55);
    expect(boss.invulnerable).toBe(false);

    const seenPhases: number[] = [];
    for (const targetHp of [3200, 2100, 1000]) {
      boss.hp = targetHp;
      stepSim(state, makeInput(), hooks);
      for (const ev of state.events) {
        if (ev.type === 'boss_phase') seenPhases.push(ev.phase);
      }
      expect(boss.aiState).toBe('phase_transition');
      expect(boss.invulnerable).toBe(true);
      // Finish 1.2s phase transition
      tickPastSpawning(state, hooks, 85);
      expect(boss.invulnerable).toBe(false);
    }
    expect(seenPhases).toEqual([2, 3, 4]);

    // Finish boss
    dealDamageToEnemy(state, boss, { baseDamage: 5000, source: 'attack' }, hooks, getCombatContext());
    expect(boss.hp).toBe(0);
    expect(state.run.bossesDefeated).toContain('warden_malice');
  });

  it('Warden Fury (4600 HP): spawns bouncing Arena Sawblades on phase transitions & barrage', () => {
    const { state, hooks } = createCampaignState();
    warpToBoss(state, 'warden_fury');
    const boss = state.enemies[0];
    expect(boss.maxHp).toBe(4600);

    tickPastSpawning(state, hooks, 55);
    boss.hp = 3300; // < 75%
    stepSim(state, makeInput(), hooks);
    expect(boss.aiState).toBe('phase_transition');

    const saws = state.room.hazards.filter((h) => h.kind === 'sawblade' && h.active);
    expect(saws.length).toBeGreaterThanOrEqual(2);
    const startX = saws[0].pos.x;
    const startY = saws[0].pos.y;
    stepSim(state, makeInput(), hooks);
    expect(Math.hypot(saws[0].pos.x - startX, saws[0].pos.y - startY)).toBeGreaterThan(1);
  });

  it('Warden Murder (5200 HP): shrinks playable arena bounds on 66% and 33% phase transitions', () => {
    const { state, hooks } = createCampaignState();
    warpToBoss(state, 'warden_murder');
    const boss = state.enemies[0];
    expect(boss.maxHp).toBe(5200);
    const initialWidth = state.room.bounds.maxX - state.room.bounds.minX;
    const initialHeight = state.room.bounds.maxY - state.room.bounds.minY;

    tickPastSpawning(state, hooks, 55);
    boss.hp = 3300; // < 66%
    stepSim(state, makeInput(), hooks);
    const w1 = state.room.bounds.maxX - state.room.bounds.minX;
    const h1 = state.room.bounds.maxY - state.room.bounds.minY;
    expect(w1).toBeLessThan(initialWidth);
    expect(h1).toBeLessThan(initialHeight);

    tickPastSpawning(state, hooks, 85);
    boss.hp = 1600; // < 33%
    stepSim(state, makeInput(), hooks);
    const w2 = state.room.bounds.maxX - state.room.bounds.minX;
    expect(w2).toBeLessThan(w1);
  });

  it('Bone Leviathan (6000 HP): invulnerable shield at 66% (3 heads) & 33% (6 heads) until all heads slain', () => {
    const { state, hooks } = createCampaignState();
    warpToBoss(state, 'bone_leviathan');
    const boss = state.enemies[0];
    expect(boss.maxHp).toBe(6000);
    tickPastSpawning(state, hooks, 55);

    const waves: Array<[number, number]> = [
      [3800, 3], // 66% -> 3 heads
      [1900, 6], // 33% -> 6 heads
    ];

    for (const [triggerHp, expectedHeads] of waves) {
      boss.hp = triggerHp;
      stepSim(state, makeInput(), hooks);
      expect(boss.invulnerable).toBe(true);
      const heads = state.enemies.filter(
        (e) => e.archetype === 'bone_hydra_head' && e.parentBossId === boss.id && e.hp > 0
      );
      expect(heads).toHaveLength(expectedHeads);

      // Even after 2 seconds, shield stays UP while heads are alive!
      tickPastSpawning(state, hooks, 120);
      expect(boss.invulnerable).toBe(true);
      expect(dealDamageToEnemy(state, boss, { baseDamage: 500, source: 'attack' }, hooks, getCombatContext())).toBe(0);

      // Kill all heads -> shield shatters!
      for (const h of heads) {
        h.invulnerable = false;
        h.invulnTimer = 0;
        dealDamageToEnemy(state, h, { baseDamage: 9999, source: 'attack' }, hooks, getCombatContext());
      }
      tickPastSpawning(state, hooks, 10);
      expect(boss.invulnerable).toBe(false);
    }
  });

  it('Dual Colosseum Champions: spawns Bull (14000 HP) + Spearlord (9000 HP) simultaneously with 50% transitions', () => {
    const { state, hooks } = createCampaignState();
    warpToBoss(state, 'colosseum_spearlord');

    const bull = state.enemies.find((e) => e.bossId === 'colosseum_bull')!;
    const spear = state.enemies.find((e) => e.bossId === 'colosseum_spearlord')!;
    expect(bull).toBeDefined();
    expect(spear).toBeDefined();
    expect(bull.maxHp).toBe(14000);
    expect(spear.maxHp).toBe(9000);

    tickPastSpawning(state, hooks, 55);

    // Trigger both 50% transitions
    bull.hp = 6800;
    spear.hp = 4400;
    stepSim(state, makeInput(), hooks);
    expect(bull.aiState).toBe('phase_transition');
    expect(spear.aiState).toBe('phase_transition');
    tickPastSpawning(state, hooks, 90);

    // Killing only Bull does NOT clear room while Spearlord lives
    dealDamageToEnemy(state, bull, { baseDamage: 20000, source: 'attack' }, hooks, getCombatContext());
    stepSim(state, makeInput(), hooks);
    expect(state.room.cleared).toBe(false);

    // Killing Spearlord completes the dual boss fight!
    dealDamageToEnemy(state, spear, { baseDamage: 20000, source: 'attack' }, hooks, getCombatContext());
    state.run.finalKillSlowTimer = 0;
    state.timeScale = 1.0;
    stepSim(state, makeInput(), hooks);
    expect(state.room.cleared).toBe(true);
    expect(state.run.bossesDefeated).toContain('colosseum_bull');
    expect(state.run.bossesDefeated).toContain('colosseum_spearlord');
  });

  it('The Ferryman (16500 HP): triggers 66/33% transitions, mist-wall orbs, and awards Loyalty Card on defeat', () => {
    const { state, hooks } = createCampaignState();
    warpToBoss(state, 'the_ferryman');
    const ferryman = state.enemies[0];
    expect(ferryman.bossId).toBe('the_ferryman');
    expect(ferryman.maxHp).toBe(16500);

    tickPastSpawning(state, hooks, 55);
    // Let Ferryman execute at least 2 attacks to verify mist wall & sweep don't throw
    let sawMistOrbs = false;
    for (let i = 0; i < 240; i++) {
      state.player.hp = state.player.maxHp;
      stepSim(state, makeInput(), hooks);
      if (state.projectiles.some((p) => p.ownerId === ferryman.id && p.kind === 'orb')) {
        sawMistOrbs = true;
      }
    }
    expect(sawMistOrbs).toBe(true);

    // Trigger 66% transition then defeat
    ferryman.hp = 10500;
    stepSim(state, makeInput(), hooks);
    expect(ferryman.aiState).toBe('phase_transition');
    tickPastSpawning(state, hooks, 90);
    dealDamageToEnemy(state, ferryman, { baseDamage: 20000, source: 'attack' }, hooks, getCombatContext());
    expect(state.run.bossesDefeated).toContain('the_ferryman');

    // Loyalty card reduces shop prices by 20% (150 -> 120)
    loadRoom(state, 'obsidian_pit', 6, 'shop');
    const boonItem = state.room.pickups.find((p) => p.kind === 'boon')!;
    expect(boonItem.costGold).toBe(120);
  });

  it('Sovereign Lord Standard (2-phase 17000 HP) revives for Phase 2 and triggers Victory Clear on Phase 2 defeat', () => {
    const { state, hooks } = createCampaignState();
    warpToBoss(state, 'sovereign_lord');
    const lord = state.enemies[0];
    expect(lord.bossId).toBe('sovereign_lord');
    expect(lord.maxHp).toBe(17000);
    expect(lord.maxPhases).toBe(2);
    expect(lord.phase).toBe(1);

    tickPastSpawning(state, hooks, 55);

    // Defeat Phase 1 -> revives at full 17000 HP as Phase 2 (NOT victory yet!)
    dealDamageToEnemy(state, lord, { baseDamage: 25000, source: 'attack' }, hooks, getCombatContext());
    expect(lord.phase).toBe(2);
    expect(lord.hp).toBe(17000);
    expect(lord.aiState).toBe('phase_transition');
    expect(state.run.victory).toBe(false);

    // Complete Phase 2 transition & step through Phase 2 beams/urns
    tickPastSpawning(state, hooks, 120);
    expect(lord.invulnerable).toBe(false);

    // Defeat Phase 2 -> Run Victory!
    dealDamageToEnemy(state, lord, { baseDamage: 25000, source: 'attack' }, hooks, getCombatContext());
    expect(lord.hp).toBe(0);
    expect(state.run.victory).toBe(true);
    expect(state.run.active).toBe(false);
    expect(state.run.bossesDefeated).toContain('sovereign_lord');
    expect(state.events.some((e) => e.type === 'run_ended' && e.victory)).toBe(true);
  });

  it('Sovereign Lord EM4 (extreme_measures = 4): 3-phase 22000 HP and victory only after Phase 3 defeat', () => {
    const { state, hooks } = createCampaignState();
    state.meta.shrineVows.extreme_measures = 4;
    state.run.vows.extreme_measures = 4;

    warpToBoss(state, 'sovereign_lord');
    const lord = state.enemies[0];
    expect(lord.maxHp).toBe(22000);
    expect(lord.maxPhases).toBe(3);
    expect(lord.phase).toBe(1);

    tickPastSpawning(state, hooks, 55);

    // Phase 1 -> Phase 2
    dealDamageToEnemy(state, lord, { baseDamage: 30000, source: 'attack' }, hooks, getCombatContext());
    expect(lord.phase).toBe(2);
    expect(lord.hp).toBe(22000);
    expect(state.run.victory).toBe(false);
    tickPastSpawning(state, hooks, 110);

    // Phase 2 -> Phase 3
    dealDamageToEnemy(state, lord, { baseDamage: 30000, source: 'attack' }, hooks, getCombatContext());
    expect(lord.phase).toBe(3);
    expect(lord.hp).toBe(22000);
    expect(state.run.victory).toBe(false);
    tickPastSpawning(state, hooks, 110);

    // Phase 3 -> Final Victory!
    dealDamageToEnemy(state, lord, { baseDamage: 30000, source: 'attack' }, hooks, getCombatContext());
    expect(lord.hp).toBe(0);
    expect(state.run.victory).toBe(true);
    expect(state.meta.totalClears).toBeGreaterThanOrEqual(1);
  });
});
