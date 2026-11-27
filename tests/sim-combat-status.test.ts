import { describe, expect, it } from 'vitest';
import {
  BIOME_CONSTANTS,
  COMBAT_CONSTANTS,
  EMPTY_INPUT_FRAME,
  PLAYER_CONSTANTS,
  SIM_CONSTANTS,
  type BiomeId,
  type EnemyState,
  type InputFrame,
  type SimState,
  type StatusEffectId,
} from '../src/contracts/index.js';
import { grantBoonDirect } from '../src/sim/boons.js';
import { resolveEnemyWallSlam, resolveHeroCollision } from '../src/sim/collision.js';
import {
  dealDamageToEnemy,
  dealDamageToPlayer,
  deflectProjectiles,
  spawnProjectile,
} from '../src/sim/combat.js';
import { getEnemySpeedMultiplier, spawnEnemy } from '../src/sim/enemies.js';
import {
  applyMetaToPlayer,
  createDefaultMetaSave,
  getGodModeDamageMultiplier,
} from '../src/sim/meta.js';
import {
  applyStatus,
  countUniqueStatuses,
  getChillSpeedMultiplier,
  getEnemyOutgoingDamageMultiplier,
  getStatus,
  tickStatuses,
  triggerJoltedOnEnemy,
} from '../src/sim/status.js';
import { createDefaultSimState, stepSim } from '../src/sim/step.js';

function makeInput(overrides: Partial<InputFrame> = {}): InputFrame {
  return {
    ...EMPTY_INPUT_FRAME,
    ...overrides,
  };
}

function createCombatSandbox(seed = 5150): SimState {
  const meta = createDefaultMetaSave();
  meta.mirrorRanks.shadow_presence = 5;
  meta.mirrorActiveSide.shadow_presence = 'a';
  meta.mirrorRanks.boiling_blood = 5;
  meta.mirrorActiveSide.boiling_blood = 'a';
  meta.mirrorRanks.privileged_status = 2;
  meta.mirrorActiveSide.privileged_status = 'a';
  meta.mirrorRanks.death_defiance = 2;
  meta.mirrorActiveSide.death_defiance = 'a';
  meta.mirrorRanks.thick_skin = 10;
  meta.mirrorActiveSide.thick_skin = 'a';
  meta.selectedKeepsake = null;
  meta.godModeEnabled = false;
  meta.godModeDeaths = 0;

  const state = createDefaultSimState(seed, meta);
  state.room.biome = 'obsidian_pit';
  state.room.combatStarted = true;
  state.room.cleared = false;
  state.room.waveIndex = 0;
  state.room.totalWaves = 2;
  state.room.bounds = { minX: -600, maxX: 600, minY: -400, maxY: 400 };
  state.room.obstacles = [];
  state.room.hazards = [];
  state.player.pos = { x: 0, y: 0 };
  state.player.facingAngle = 0;
  return state;
}

function addTarget(
  state: SimState,
  x: number,
  y: number,
  opts?: { hp?: number; armor?: number; facingAngle?: number; isBoss?: boolean }
): EnemyState {
  const enemy = spawnEnemy(state, 'wretched_husk', { x, y });
  enemy.invulnerable = false;
  enemy.invulnTimer = 0;
  enemy.aiState = 'idle';
  enemy.hp = opts?.hp ?? 2000;
  enemy.maxHp = enemy.hp;
  enemy.armor = opts?.armor ?? 0;
  enemy.maxArmor = enemy.armor;
  enemy.isBoss = opts?.isBoss ?? false;
  enemy.facingAngle = opts?.facingAngle ?? Math.PI;
  return enemy;
}

describe('All 10 Status Curses — Timings, Caps, DoTs & Multipliers', () => {
  const ALL_10_STATUSES: readonly StatusEffectId[] = [
    'jolted',
    'ruptured',
    'exposed',
    'weak',
    'marked',
    'doom',
    'hangover',
    'chill',
    'maim',
    'poison',
  ];

  it('applies and tracks all 10 canonical StatusEffectIds with accurate durations', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0);

    for (const statusId of ALL_10_STATUSES) {
      applyStatus(state, enemy, 'enemy', statusId, 1, 'player');
    }
    expect(countUniqueStatuses(enemy.statuses)).toBe(10);
    expect(getStatus(enemy.statuses, 'jolted')?.remaining).toBe(10.0);
    expect(getStatus(enemy.statuses, 'ruptured')?.remaining).toBe(3.0);
    expect(getStatus(enemy.statuses, 'exposed')?.remaining).toBe(5.0);
    expect(getStatus(enemy.statuses, 'weak')?.remaining).toBe(4.0);
    expect(getStatus(enemy.statuses, 'marked')?.remaining).toBe(6.0);
    expect(getStatus(enemy.statuses, 'doom')?.remaining).toBe(1.1);
    expect(getStatus(enemy.statuses, 'hangover')?.remaining).toBe(4.0);
    expect(getStatus(enemy.statuses, 'chill')?.remaining).toBe(8.0);
    expect(getStatus(enemy.statuses, 'maim')?.remaining).toBe(4.0);
    expect(getStatus(enemy.statuses, 'poison')?.remaining).toBe(12.0);
  });

  it('jolted: triggers 60-dmg self-zap on enemy attack and clears status', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0);
    applyStatus(state, enemy, 'enemy', 'jolted', 1, 'player');

    // Idle enemy does not self-zap
    let zapped = 0;
    tickStatuses(state, 0.5, {
      onEnemyStatusDamage: (_e, id, dmg) => {
        if (id === 'jolted') zapped += dmg;
      },
      onPlayerStatusDamage: () => {},
    });
    expect(zapped).toBe(0);
    expect(getStatus(enemy.statuses, 'jolted')).toBeDefined();

    // Entering attack state immediately triggers Jolted 60 dmg
    enemy.aiState = 'attack';
    tickStatuses(state, 1 / 60, {
      onEnemyStatusDamage: (_e, id, dmg) => {
        if (id === 'jolted') zapped += dmg;
      },
      onPlayerStatusDamage: () => {},
    });
    expect(zapped).toBe(60);
    expect(getStatus(enemy.statuses, 'jolted')).toBeUndefined();

    // Direct helper triggerJoltedOnEnemy also works
    applyStatus(state, enemy, 'enemy', 'jolted', 1, 'player', 85);
    let directDmg = 0;
    expect(triggerJoltedOnEnemy(state, enemy, (_e, _id, d) => (directDmg = d))).toBe(true);
    expect(directDmg).toBe(85);
  });

  it('ruptured: deals 10 dmg / 0.2s ONLY while enemy is moving', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0);
    applyStatus(state, enemy, 'enemy', 'ruptured', 1, 'player');

    let dmg = 0;
    const cb = {
      onEnemyStatusDamage: (_e: EnemyState, id: StatusEffectId, d: number) => {
        if (id === 'ruptured') dmg += d;
      },
      onPlayerStatusDamage: () => {},
    };

    // Stationary: 0 damage across 0.6s
    enemy.vel = { x: 0, y: 0 };
    enemy.aiState = 'idle';
    for (let i = 0; i < 36; i++) tickStatuses(state, 1 / 60, cb);
    expect(dmg).toBe(0);

    // Moving: 3 ticks over 0.65s -> 30 damage
    enemy.vel = { x: 180, y: 0 };
    for (let i = 0; i < 39; i++) tickStatuses(state, 1 / 60, cb);
    expect(dmg).toBe(30);
  });

  it('exposed: adds +50% backstab damage from behind, 0% from front', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0, { facingAngle: 0 }); // facing +X

    // Frontal hit (angle = PI, into face) vs Exposed
    applyStatus(state, enemy, 'enemy', 'exposed', 1, 'player');
    const frontDmg = dealDamageToEnemy(state, enemy, {
      baseDamage: 100,
      source: 'attack',
      angle: Math.PI,
      canCrit: false,
    });
    expect(frontDmg).toBe(100);

    // Backstab hit (angle = 0, same direction as enemy facing) -> +50% base backstab + 50% Exposed = 200
    const backDmg = dealDamageToEnemy(state, enemy, {
      baseDamage: 100,
      source: 'attack',
      angle: 0,
      canCrit: false,
    });
    expect(backDmg).toBe(200);
  });

  it('weak: reduces enemy outgoing damage multiplier to exactly 0.7x', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0);
    expect(getEnemyOutgoingDamageMultiplier(state, enemy)).toBeCloseTo(1.0, 5);
    applyStatus(state, enemy, 'enemy', 'weak', 1, 'player');
    expect(getEnemyOutgoingDamageMultiplier(state, enemy)).toBeCloseTo(0.7, 5);
  });

  it('marked: adds +30% bonus crit chance and is consumed when a Crit lands', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0, { hp: 5000 });
    applyStatus(state, enemy, 'enemy', 'marked', 1, 'player');
    expect(getStatus(enemy.statuses, 'marked')?.magnitude).toBe(0.3);

    // With 0.7 base bonusCritChance + 0.3 marked = 1.0 guaranteed crit -> 300 dmg & consumes marked!
    const dmg = dealDamageToEnemy(state, enemy, {
      baseDamage: 100,
      source: 'attack',
      angle: 0,
      bonusCritChance: 0.7,
    });
    expect(dmg).toBe(300);
    expect(getStatus(enemy.statuses, 'marked')).toBeUndefined();
  });

  it('doom: bursts after 1.1s delay without resetting timer on reapply and scales stacks up to 5', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0);
    applyStatus(state, enemy, 'enemy', 'doom', 1, 'player');

    let burstDmg = 0;
    const cb = {
      onEnemyStatusDamage: (_e: EnemyState, id: StatusEffectId, d: number) => {
        if (id === 'doom') burstDmg += d;
      },
      onPlayerStatusDamage: () => {},
    };

    // Advance 0.5s: should not burst yet
    tickStatuses(state, 0.5, cb);
    expect(burstDmg).toBe(0);
    expect(getStatus(enemy.statuses, 'doom')?.remaining).toBeCloseTo(0.6, 4);

    // Reapply 6 more times -> caps at 5 stacks AND keeps remaining at 0.6s (never resets to 1.1s!)
    for (let i = 0; i < 6; i++) {
      applyStatus(state, enemy, 'enemy', 'doom', 1, 'player');
    }
    const doomSt = getStatus(enemy.statuses, 'doom')!;
    expect(doomSt.stacks).toBe(5);
    expect(doomSt.remaining).toBeCloseTo(0.6, 4);

    // Advance remaining 0.61s -> bursts for 50 + (5 - 1) * 10 = 90 dmg!
    tickStatuses(state, 0.61, cb);
    expect(burstDmg).toBe(90);
    expect(getStatus(enemy.statuses, 'doom')).toBeUndefined();
  });

  it('hangover: caps at 5 stacks and ticks stacks * 4 damage every 0.5s for 4.0s', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0);
    for (let i = 0; i < 8; i++) {
      applyStatus(state, enemy, 'enemy', 'hangover', 1, 'player');
    }
    expect(getStatus(enemy.statuses, 'hangover')?.stacks).toBe(5);

    const ticks: number[] = [];
    for (let step = 0; step < 122; step++) {
      tickStatuses(state, 1 / 60, {
        onEnemyStatusDamage: (_e, id, d) => {
          if (id === 'hangover') ticks.push(d);
        },
        onPlayerStatusDamage: () => {},
      });
    }
    // Over ~2.03s (122 ticks at 60Hz, past floating-point 0.5s boundary) expect 4 ticks of 20 dmg each
    expect(ticks).toEqual([20, 20, 20, 20]);
  });

  it('chill: caps at 10 stacks and slows speed by 4% per stack down to 0.6x (-40%)', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0);
    expect(getChillSpeedMultiplier(enemy.statuses)).toBe(1.0);

    applyStatus(state, enemy, 'enemy', 'chill', 5, 'player');
    expect(getChillSpeedMultiplier(enemy.statuses)).toBeCloseTo(0.8, 5);
    expect(getEnemySpeedMultiplier(state, enemy)).toBeCloseTo(0.8, 5);

    applyStatus(state, enemy, 'enemy', 'chill', 12, 'player');
    expect(getStatus(enemy.statuses, 'chill')?.stacks).toBe(10);
    expect(getChillSpeedMultiplier(enemy.statuses)).toBeCloseTo(0.6, 5);
    expect(getEnemySpeedMultiplier(state, enemy)).toBeCloseTo(0.6, 5);
  });

  it('maim: grants +50% incoming dmg, +25% enemy outgoing dmg, and 400 burst after 4.0s', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0);
    applyStatus(state, enemy, 'enemy', 'maim', 1, 'player');

    expect(getEnemyOutgoingDamageMultiplier(state, enemy)).toBeCloseTo(1.25, 5);
    const hitDmg = dealDamageToEnemy(state, enemy, {
      baseDamage: 100,
      source: 'attack',
      angle: 0,
      canCrit: false,
    });
    expect(hitDmg).toBe(150);

    let maimBurst = 0;
    tickStatuses(state, 3.9, {
      onEnemyStatusDamage: (_e, id, d) => {
        if (id === 'maim') maimBurst += d;
      },
      onPlayerStatusDamage: () => {},
    });
    expect(maimBurst).toBe(0);

    tickStatuses(state, 0.15, {
      onEnemyStatusDamage: (_e, id, d) => {
        if (id === 'maim') maimBurst += d;
      },
      onPlayerStatusDamage: () => {},
    });
    expect(maimBurst).toBe(400);
    expect(getStatus(enemy.statuses, 'maim')).toBeUndefined();
  });

  it('poison: ticks 4 damage every 0.5s for 12.0s on player (ignoring i-frames) and enemies', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0);
    applyStatus(state, enemy, 'enemy', 'poison', 1, 'player');
    applyStatus(state, state.player, 'player', 'poison', 1, 'hazard');
    state.player.iframeTimer = 5.0;

    const enemyHpBefore = enemy.hp;
    const playerHpBefore = state.player.hp;
    // Step 1.05s (63 ticks) -> 2 ticks of 4 dmg = 8 dmg each
    for (let i = 0; i < 63; i++) {
      stepSim(state, makeInput());
    }
    expect(enemy.hp).toBe(enemyHpBefore - 8);
    expect(state.player.hp).toBe(playerHpBefore - 8);
  });
});

describe('Additive Damage Stack + Multiplicative 3.0x Crit', () => {
  it('stacks Boon %, +50% Backstab, +50% Boiling Blood, +40% Privileged Status additively, then x3.0 Crit', () => {
    const state = createCombatSandbox();
    // Grant Velouris Attack (+50% Common)
    grantBoonDirect(state, 'velouris', 'attack', 'common');
    const enemy = addTarget(state, 150, 0, { hp: 5000, facingAngle: 0 }); // facing +X for backstab

    // Lodge 1 Bloodstone -> Boiling Blood (+50%)
    enemy.lodgedCasts = 1;
    enemy.lodgedCastTimers = [16];

    // 1 unique status: Privileged Status (+40%) must NOT activate yet
    applyStatus(state, enemy, 'enemy', 'weak', 1, 'player');
    const oneStatusDmg = dealDamageToEnemy(state, enemy, {
      baseDamage: 100,
      source: 'attack',
      angle: 0, // backstab!
      canCrit: false,
    });
    // 100 * (1 + 0.50 boon + 0.50 backstab + 0.50 boiling blood) = 250
    expect(oneStatusDmg).toBe(250);

    // 2 unique statuses (weak + chill): Privileged Status (+40%) activates!
    applyStatus(state, enemy, 'enemy', 'chill', 1, 'player');
    const twoStatusDmg = dealDamageToEnemy(state, enemy, {
      baseDamage: 100,
      source: 'attack',
      angle: 0,
      canCrit: false,
    });
    // 100 * (1 + 0.50 + 0.50 + 0.50 + 0.40) = 290
    expect(twoStatusDmg).toBe(290);

    // Guaranteed Crit multiplies entire additive stack by 3.0x -> 290 * 3 = 870!
    const critDmg = dealDamageToEnemy(state, enemy, {
      baseDamage: 100,
      source: 'attack',
      angle: 0,
      bonusCritChance: 1.0,
    });
    expect(critDmg).toBe(870);
  });
});

describe('Armor (HealthBuffer), Wall-Slam & Deflect', () => {
  it('Armor resists hitstun until broken, overflows cleanly into HP, and triggers 1.0s ArmorBreakStun', () => {
    const state = createCombatSandbox();
    const enemy = addTarget(state, 150, 0, { hp: 500, armor: 100 });
    enemy.aiState = 'windup';

    // Hit 1: 60 dmg into armor -> armor=40, hp=500, NO hitstun!
    dealDamageToEnemy(state, enemy, { baseDamage: 60, source: 'attack', angle: 0, canCrit: false });
    expect(enemy.armor).toBe(40);
    expect(enemy.hp).toBe(500);
    expect(enemy.aiState).toBe('windup');
    expect(enemy.stunTimer).toBe(0);

    // Hit 2: 70 dmg breaks remaining 40 armor, overflows 30 to HP, applies 1.0s stun!
    state.events.length = 0;
    dealDamageToEnemy(state, enemy, { baseDamage: 70, source: 'attack', angle: 0, canCrit: false });
    expect(enemy.armor).toBe(0);
    expect(enemy.hp).toBe(470);
    expect(enemy.aiState).toBe('stunned');
    expect(enemy.stunTimer).toBeCloseTo(COMBAT_CONSTANTS.armorBreakStun, 4);
    expect(state.events.some((e) => e.type === 'damage' && e.armorBroken)).toBe(true);
  });

  it('Wall-Slam scales damage by biome wallSlamMultiplier (1.0x / 1.5x / 2.0x / 2.5x) and emits wallSlam event', () => {
    const cases: Array<[BiomeId, number]> = [
      ['obsidian_pit', 10],
      ['cinder_mire', 15],
      ['verdant_colosseum', 20],
      ['crypt_of_bile', 25],
    ];

    for (const [biome, expectedDmg] of cases) {
      const state = createCombatSandbox();
      state.room.biome = biome;
      const enemy = addTarget(state, 550, 0, { hp: 1000 });
      enemy.vel = { x: 1000, y: 0 }; // 1000 u/s * 0.01 * biomeMult

      const dealt = resolveEnemyWallSlam(state, enemy, { x: 550, y: 0 }, { x: 640, y: 0 });
      expect(dealt).toBe(expectedDmg);
      expect(BIOME_CONSTANTS[biome].wallSlamMultiplier * 10).toBe(expectedDmg);
      expect(state.events.some((e) => e.type === 'damage' && e.wallSlam && e.amount === expectedDmg)).toBe(true);
    }

    // Gentle wall bump (< 200 u/s) deals 0 wall-slam damage
    const gentleState = createCombatSandbox();
    const gentleEnemy = addTarget(gentleState, 550, 0, { hp: 1000 });
    gentleEnemy.vel = { x: 120, y: 0 };
    expect(resolveEnemyWallSlam(gentleState, gentleEnemy, { x: 550, y: 0 }, { x: 620, y: 0 })).toBe(0);
  });

  it('Deflect returns normal projectiles at 3.0x speed and lobs at 1.5x speed', () => {
    const state = createCombatSandbox();
    addTarget(state, 300, 0);

    const normalProj = spawnProjectile(state, {
      owner: 'enemy',
      ownerId: 'e1',
      kind: 'orb',
      pos: { x: 80, y: 0 },
      vel: { x: -400, y: 0 },
      startPos: { x: 300, y: 0 },
      radius: 14,
      angle: Math.PI,
      damage: 20,
      range: 800,
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

    const lobProj = spawnProjectile(state, {
      owner: 'enemy',
      ownerId: 'e1',
      kind: 'bomb',
      pos: { x: 90, y: 20 },
      vel: { x: -400, y: 0 },
      startPos: { x: 300, y: 20 },
      radius: 16,
      angle: Math.PI,
      damage: 20,
      range: 800,
      maxLife: 2,
      pierceLeft: 0,
      bouncesLeft: 0,
      deflectable: true,
      deflected: false,
      homingStrength: 0,
      isLob: true,
      lobHeight: 120,
      lobDuration: 0.7,
      lobElapsed: 0.2,
      targetPos: { x: 0, y: 0 },
    });

    const count = deflectProjectiles(state, { x: 0, y: 0 }, 200, 0, 360);
    expect(count).toBe(2);
    expect(normalProj.owner).toBe('player');
    expect(normalProj.deflected).toBe(true);
    expect(Math.hypot(normalProj.vel.x, normalProj.vel.y)).toBeCloseTo(400 * 3.0, 2);

    expect(lobProj.owner).toBe('player');
    expect(lobProj.deflected).toBe(true);
    expect(lobProj.isLob).toBe(false);
    expect(Math.hypot(lobProj.vel.x, lobProj.vel.y)).toBeCloseTo(400 * 1.5, 2);
  });
});

describe('Post-Hit I-Frames, God Mode DR Curve & Death Defiance', () => {
  it('grants 1.3s post-hit i-frames on >=10 dmg (and cumulative >=10 in 0.6s), disabled by personal_liability', () => {
    const state = createCombatSandbox();
    const first = dealDamageToPlayer(state, 12, { source: 'enemy' });
    expect(first).toBe(12);
    expect(state.player.iframeTimer).toBeCloseTo(PLAYER_CONSTANTS.postHitIframeDuration, 4);

    // Follow-up hit during i-frames deals 0
    expect(dealDamageToPlayer(state, 15, { source: 'enemy' })).toBe(0);

    // Cumulative small hits summing >= 10 within 0.6s also grant 1.3s i-frames
    const cumState = createCombatSandbox();
    expect(dealDamageToPlayer(cumState, 6, { source: 'enemy' })).toBe(6);
    expect(cumState.player.iframeTimer).toBe(0);
    expect(dealDamageToPlayer(cumState, 5, { source: 'enemy' })).toBe(5);
    expect(cumState.player.iframeTimer).toBeCloseTo(1.3, 4);

    // Shrine Vow: personal_liability disables post-hit i-frames completely
    const plState = createCombatSandbox();
    plState.run.vows.personal_liability = 1;
    expect(dealDamageToPlayer(plState, 12, { source: 'enemy' })).toBe(12);
    expect(plState.player.iframeTimer).toBe(0);
    expect(dealDamageToPlayer(plState, 12, { source: 'enemy' })).toBe(12);
  });

  it('God Mode scales damage multiplier smoothly from 0.8 down to 0.2 at 30 deaths', () => {
    const state = createCombatSandbox();
    state.meta.godModeEnabled = true;
    state.run.godModeEnabled = true;

    const checkpoints: Array<[number, number]> = [
      [0, 0.8],
      [5, 0.7],
      [15, 0.5],
      [30, 0.2],
      [50, 0.2], // clamped at 30 deaths
    ];

    for (const [deaths, expectedMult] of checkpoints) {
      state.meta.godModeDeaths = deaths;
      expect(getGodModeDamageMultiplier(state.meta)).toBeCloseTo(expectedMult, 5);
      state.player.hp = state.player.maxHp;
      state.player.iframeTimer = 0;
      const dmg = dealDamageToPlayer(state, 100, { source: 'enemy', ignoreIframes: true });
      expect(dmg).toBe(Math.round(100 * expectedMult));
    }
  });

  it('Death Defiance restores 50% HP (Side A) / 30% HP (Side B) + knocks back enemies; 0 left triggers defeat', () => {
    const state = createCombatSandbox();
    state.player.maxHp = 100;
    state.player.hp = 20;
    state.player.deathDefiances = 1;
    const nearby = addTarget(state, 120, 0);

    dealDamageToPlayer(state, 50, { source: 'enemy', ignoreIframes: true });
    expect(state.player.isDead).toBe(false);
    expect(state.player.deathDefiances).toBe(0);
    expect(state.player.hp).toBe(50);
    expect(state.player.iframeTimer).toBe(2.0);
    expect(nearby.vel.x).toBeGreaterThan(200);
    expect(state.events.some((e) => e.type === 'death_defiance')).toBe(true);

    // Side B Stubborn Defiance restores 30%
    state.meta.mirrorActiveSide.death_defiance = 'b';
    state.player.deathDefiances = 1;
    state.player.hp = 10;
    dealDamageToPlayer(state, 50, { source: 'enemy', ignoreIframes: true });
    expect(state.player.hp).toBe(30);

    // Next lethal blow with 0 defiances ends the run
    dealDamageToPlayer(state, 100, { source: 'enemy', ignoreIframes: true });
    expect(state.player.isDead).toBe(true);
    expect(state.run.defeat).toBe(true);
    expect(state.run.active).toBe(false);
    expect(state.events.some((e) => e.type === 'run_ended' && !e.victory)).toBe(true);
  });
});

describe('Dash-Cancel, Dash-Strike I-Frame Cut, Pit-Crossing, Pillar Sliding & Final-Kill Slow-Mo', () => {
  it('Dash cancels attack windup/recovery immediately, and Dash-Strike terminates dash i-frames early', () => {
    const state = createCombatSandbox();
    // Start Stygian Blade attack windup
    stepSim(state, makeInput({ aimDirX: 1, attack: true, attackPressed: true }));
    expect(state.player.attackChargeTimer).toBeGreaterThan(0);

    // Dash-cancel immediately clears attackChargeTimer and activates dash i-frames
    stepSim(state, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    expect(state.player.attackChargeTimer).toBe(0);
    expect(state.player.dashTimer).toBeGreaterThan(0);
    expect(dealDamageToPlayer(state, 20, { source: 'enemy' })).toBe(0); // invulnerable during dash

    // Pressing Attack during Dash executes Dash-Strike and ends dashTimer immediately (vulnerable!)
    stepSim(state, makeInput({ aimDirX: 1, attack: true, attackPressed: true }));
    expect(state.player.dashTimer).toBe(0);
    const hitAfterDashStrike = dealDamageToPlayer(state, 12, { source: 'enemy' });
    expect(hitAfterDashStrike).toBe(12);
  });

  it('walking is blocked by pits while Blink Dash crosses pits cleanly', () => {
    const state = createCombatSandbox();
    state.room.obstacles = [
      {
        id: 'pit_center',
        kind: 'pit',
        pos: { x: 140, y: 0 },
        halfW: 50,
        halfH: 140,
        blocksMovement: true,
        blocksProjectiles: false,
        destructible: false,
      },
    ];
    state.player.pos = { x: 20, y: 0 };

    // Walking right stops at pit edge (140 - 50 - HERO_HALF_W(48) = 42)
    for (let i = 0; i < 40; i++) {
      stepSim(state, makeInput({ moveX: 1 }));
    }
    expect(state.player.pos.x).toBeLessThanOrEqual(45);

    // Blink Dash crosses right over the pit to the far ledge (> 220)!
    stepSim(state, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    for (let i = 0; i < 16; i++) {
      stepSim(state, makeInput({ moveX: 1 }));
    }
    expect(state.player.pos.x).toBeGreaterThan(220);
  });

  it('octagonal hero collision slides smoothly around pillar bevel corners without stalling', () => {
    const state = createCombatSandbox();
    state.room.obstacles = [
      {
        id: 'pillar_slide',
        kind: 'pillar',
        pos: { x: 150, y: 0 },
        halfW: 44,
        halfH: 34,
        radius: 42,
        blocksMovement: true,
        blocksProjectiles: true,
        destructible: false,
      },
    ];
    // Position hero slightly below center (y = +30) walking directly +X toward pillar bevel
    state.player.pos = { x: 40, y: 30 };
    const startY = state.player.pos.y;

    for (let i = 0; i < 45; i++) {
      stepSim(state, makeInput({ moveX: 1, moveY: 0 }));
    }

    // Hero smoothly nudges downward around the bevel and passes past the pillar!
    expect(state.player.pos.y).toBeGreaterThan(startY + 20);
    expect(state.player.pos.x).toBeGreaterThan(180);

    // Direct call to resolveHeroCollision also reports smooth separation without NaN
    const res = resolveHeroCollision(state, { x: 150, y: 0 }, false);
    expect(Number.isFinite(res.pos.x)).toBe(true);
    expect(Number.isFinite(res.pos.y)).toBe(true);
  });

  it('0.6s Final-Kill Slow-Mo drops timeScale <= 0.0001 then lerps cleanly back to 1.0', () => {
    const state = createCombatSandbox();
    state.room.waveIndex = 0;
    state.room.totalWaves = 1; // Final wave!
    const lastFoe = addTarget(state, 120, 0, { hp: 40 });

    dealDamageToEnemy(state, lastFoe, { baseDamage: 100, source: 'attack', angle: Math.PI });
    expect(lastFoe.hp).toBe(0);
    expect(state.timeScale).toBeLessThanOrEqual(0.0001);
    expect(state.run.finalKillSlowTimer).toBeCloseTo(
      COMBAT_CONSTANTS.finalKillSlowDuration + COMBAT_CONSTANTS.finalKillSlowLerpOut,
      4
    );

    // Stay in ultra slow-mo across the 0.6s duration (35 ticks at 60Hz = 0.583s)
    for (let i = 0; i < 35; i++) {
      stepSim(state, makeInput());
      expect(state.timeScale).toBeLessThanOrEqual(0.0001);
    }

    // Advance past the 0.1s lerp-out (10 more ticks) -> restored cleanly to 1.0
    for (let i = 0; i < 10; i++) {
      stepSim(state, makeInput());
    }
    expect(state.run.finalKillSlowTimer).toBe(0);
    expect(state.timeScale).toBe(1.0);
    expect(state.room.cleared).toBe(true);
  });

  it('applies meta consistently via applyMetaToPlayer without corrupting combat invariants', () => {
    const state = createCombatSandbox();
    applyMetaToPlayer(state, { resetVitals: true });
    expect(state.player.maxHp).toBe(PLAYER_CONSTANTS.baseMaxHealth + PLAYER_CONSTANTS.thickSkinMaxBonus);
    expect(SIM_CONSTANTS.isoScaleY).toBe(0.56);
  });
});
