import { describe, expect, it } from 'vitest';
import {
  ASPECT_DEFS,
  EMPTY_INPUT_FRAME,
  HAMMER_DEFS,
  PLAYER_CONSTANTS,
  SIM_CONSTANTS,
  WEAPON_CONSTANTS,
  type AspectId,
  type EnemyState,
  type HammerId,
  type InputFrame,
  type SimState,
  type WeaponId,
} from '../src/contracts/index.js';
import { ASPECT_IDS } from '../src/data/aspects.js';
import { HAMMER_IDS } from '../src/data/hammers.js';
import { WEAPON_IDS } from '../src/data/weapons.js';
import { dealDamageToPlayer, getWeaponRuntime } from '../src/sim/combat.js';
import { spawnEnemy } from '../src/sim/enemies.js';
import { hashSimState } from '../src/sim/hash.js';
import { createDefaultMetaSave, selectWeaponAndAspect } from '../src/sim/meta.js';
import { createGameplayHooks, startNewRun } from '../src/sim/rooms.js';
import { createDefaultSimState, stepSim } from '../src/sim/step.js';

function makeInput(overrides: Partial<InputFrame> = {}): InputFrame {
  return {
    ...EMPTY_INPUT_FRAME,
    ...overrides,
  };
}

function createArenaState(
  weaponId: WeaponId,
  aspectId?: AspectId,
  opts?: { aspectRank?: number; seed?: number; hammers?: HammerId[] }
): SimState {
  const meta = createDefaultMetaSave();
  const chosenAspect = aspectId ?? WEAPON_CONSTANTS[weaponId].aspects[0];
  selectWeaponAndAspect(meta, weaponId, chosenAspect);
  meta.aspectRanks[chosenAspect] = opts?.aspectRank ?? 5;
  // Normalize mirror to predictable combat defaults (no random extra crits or odd sides)
  meta.mirrorRanks.shadow_presence = 0;
  meta.mirrorActiveSide.shadow_presence = 'a';
  meta.mirrorRanks.greater_reflex = 1;
  meta.mirrorActiveSide.greater_reflex = 'a';
  meta.mirrorRanks.thick_skin = 5;
  meta.mirrorActiveSide.thick_skin = 'a';
  meta.mirrorRanks.infernal_soul = 2;
  meta.mirrorActiveSide.infernal_soul = 'a';
  meta.selectedKeepsake = null;

  const state = createDefaultSimState(opts?.seed ?? 1337, meta);
  state.room.combatStarted = true;
  state.room.cleared = false;
  state.room.totalWaves = 2; // prevent accidental final-kill slow-mo during weapon unit tests
  state.player.pos = { x: 0, y: 0 };
  state.player.facingAngle = 0;
  if (opts?.hammers) {
    state.player.hammers = [...opts.hammers];
  }
  return state;
}

function addDummyTarget(
  state: SimState,
  x: number,
  y: number,
  opts?: { hp?: number; armor?: number; facingAngle?: number }
): EnemyState {
  const e = spawnEnemy(state, 'wretched_husk', { x, y });
  e.invulnerable = false;
  e.invulnTimer = 0;
  e.aiState = 'idle';
  e.hp = opts?.hp ?? 4000;
  e.maxHp = e.hp;
  e.armor = opts?.armor ?? 0;
  e.maxArmor = e.armor;
  // Face toward player by default (so frontal hits are not backstabs unless explicitly positioned behind)
  e.facingAngle = opts?.facingAngle ?? Math.atan2(state.player.pos.y - y, state.player.pos.x - x);
  return e;
}

function stepMany(state: SimState, ticks: number, input: Partial<InputFrame> = {}): void {
  for (let i = 0; i < ticks; i++) {
    stepSim(
      state,
      makeInput({
        ...input,
        // One-shot press flags only fire on first tick unless caller passes them individually
        attackPressed: i === 0 ? Boolean(input.attackPressed) : false,
        specialPressed: i === 0 ? Boolean(input.specialPressed) : false,
        castPressed: i === 0 ? Boolean(input.castPressed) : false,
        dashPressed: i === 0 ? Boolean(input.dashPressed) : false,
        reloadPressed: i === 0 ? Boolean(input.reloadPressed) : false,
        callPressed: i === 0 ? Boolean(input.callPressed) : false,
        interactPressed: i === 0 ? Boolean(input.interactPressed) : false,
      })
    );
  }
}

function assertAllFinite(state: SimState): void {
  const p = state.player;
  expect(Number.isFinite(p.pos.x)).toBe(true);
  expect(Number.isFinite(p.pos.y)).toBe(true);
  expect(Number.isFinite(p.vel.x)).toBe(true);
  expect(Number.isFinite(p.vel.y)).toBe(true);
  expect(Number.isFinite(p.hp)).toBe(true);
  expect(Number.isFinite(p.maxHp)).toBe(true);
  expect(Number.isFinite(p.ammo)).toBe(true);
  expect(Number.isFinite(p.castAmmo)).toBe(true);
  expect(Number.isFinite(p.dashCharges)).toBe(true);
  for (const e of state.enemies) {
    expect(Number.isFinite(e.pos.x)).toBe(true);
    expect(Number.isFinite(e.pos.y)).toBe(true);
    expect(Number.isFinite(e.hp)).toBe(true);
    expect(Number.isFinite(e.armor)).toBe(true);
  }
  for (const pr of state.projectiles) {
    expect(Number.isFinite(pr.pos.x)).toBe(true);
    expect(Number.isFinite(pr.pos.y)).toBe(true);
    expect(Number.isFinite(pr.damage)).toBe(true);
  }
}

function collectDamageEvents(state: SimState, ticks: number, perTick: (t: number) => Partial<InputFrame>): number[] {
  const amounts: number[] = [];
  for (let t = 0; t < ticks; t++) {
    stepSim(state, makeInput(perTick(t)));
    for (const ev of state.events) {
      if (ev.type === 'damage' && ev.targetKind === 'enemy' && ev.amount > 0) {
        amounts.push(ev.amount);
      }
    }
  }
  return amounts;
}

describe('Infernal Arms — All 6 Weapons Core Mechanics', () => {
  it('defines all 6 canonical Infernal Arms', () => {
    expect(WEAPON_IDS).toEqual([
      'stygian_blade',
      'eternal_spear',
      'shield_of_chaos',
      'heart_seeking_bow',
      'twin_fists',
      'adamant_rail',
    ]);
  });

  it('stygian_blade: 3-hit melee combo (20/25/30), Dash-Strike (30), and Nova Smash Special (50)', () => {
    // Use blade_vengeance (no speed boost) at rank 1 for clean base timings
    const state = createArenaState('stygian_blade', 'blade_vengeance', { aspectRank: 1 });
    const target = addDummyTarget(state, 130, 0);

    // 3-hit combo progression (press next swing immediately when recovery finishes)
    const hits: number[] = [];
    for (let swing = 0; swing < 3; swing++) {
      target.pos = { x: state.player.pos.x + 120, y: state.player.pos.y };
      target.vel = { x: 0, y: 0 };
      target.facingAngle = Math.PI;
      // Trigger swing
      stepSim(state, makeInput({ aimDirX: 1, aimDirY: 0, attack: true, attackPressed: true }));
      for (const e of state.events) if (e.type === 'damage') hits.push(e.amount);
      // Wait for windup + recovery to complete so next swing chains cleanly inside comboWindowSec
      for (let t = 0; t < 45; t++) {
        target.pos = { x: state.player.pos.x + 120, y: state.player.pos.y };
        target.vel = { x: 0, y: 0 };
        target.facingAngle = Math.PI;
        stepSim(state, makeInput({ aimDirX: 1, aimDirY: 0 }));
        for (const e of state.events) if (e.type === 'damage') hits.push(e.amount);
        if (state.player.attackChargeTimer <= 0 && state.player.attackTimer <= 0) break;
      }
    }
    expect(hits).toEqual([20, 25, 30]);
    expect(state.player.attackComboStep).toBe(0);

    // Dash-Strike: instant 0f lunge dealing 30 dmg
    const dsState = createArenaState('stygian_blade', 'blade_vengeance', { aspectRank: 1 });
    const dsTarget = addDummyTarget(dsState, 160, 0);
    stepSim(dsState, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    expect(dsState.player.dashTimer).toBeGreaterThan(0);
    const dsHits = collectDamageEvents(dsState, 2, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(dsHits).toEqual([30]);
    expect(dsTarget.hp).toBe(dsTarget.maxHp - 30);

    // Special: Nova Smash radial AoE (50 dmg) hitting foes on both sides
    const spState = createArenaState('stygian_blade', 'blade_vengeance', { aspectRank: 1 });
    const leftEnemy = addDummyTarget(spState, -220, 0);
    const rightEnemy = addDummyTarget(spState, 220, 0);
    const spHits = collectDamageEvents(spState, 25, (t) => ({
      special: t === 0,
      specialPressed: t === 0,
    }));
    expect(spHits).toEqual([50, 50]);
    expect(leftEnemy.hp).toBe(leftEnemy.maxHp - 50);
    expect(rightEnemy.hp).toBe(rightEnemy.maxHp - 50);
  });

  it('eternal_spear: 3-hit thrust combo (25/30/30), Dash-Strike (20), 3-tier Spin Attack, and Skewer Throw + Recall', () => {
    const state = createArenaState('eternal_spear', 'spear_sovereign', { aspectRank: 1 });
    const target = addDummyTarget(state, 280, 0);

    // Tap attacks execute 3-hit thrust combo (25 -> 30 -> 30)
    const comboDmg: number[] = [];
    for (let i = 0; i < 3; i++) {
      target.pos = { x: state.player.pos.x + 260, y: state.player.pos.y };
      target.vel = { x: 0, y: 0 };
      target.facingAngle = Math.PI;
      // Hold 1 tick then release to trigger quick tap
      const dmgs = collectDamageEvents(state, 18, (t) => ({
        aimDirX: 1,
        attack: t === 0,
        attackPressed: t === 0,
      }));
      comboDmg.push(...dmgs);
    }
    expect(comboDmg).toEqual([25, 30, 30]);

    // Dash-Strike: 20 dmg wide sweep
    const dsState = createArenaState('eternal_spear', 'spear_sovereign', { aspectRank: 1 });
    addDummyTarget(dsState, 180, 30);
    stepSim(dsState, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    const dsDmg = collectDamageEvents(dsState, 2, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(dsDmg).toEqual([20]);

    // Hold-Attack Spin Attack (full tier 3 charge -> 100 dmg)
    const spinState = createArenaState('eternal_spear', 'spear_scion', { aspectRank: 1 });
    const spinTarget = addDummyTarget(spinState, 350, 0);
    // Hold attack for ~65 ticks (> 0.18 + 0.75 * 0.85) then release
    const spinDmg = collectDamageEvents(spinState, 72, (t) => ({
      aimDirX: 1,
      attack: t < 66,
      attackPressed: t === 0,
    }));
    expect(spinDmg).toEqual([100]);
    expect(spinTarget.hp).toBe(spinTarget.maxHp - 100);

    // Special: Skewer Throw lodges (`spearOut = true`), then re-press recalls piercing back (`spearOut = false`)
    const spState = createArenaState('eternal_spear', 'spear_sovereign', { aspectRank: 1 });
    const spTarget = addDummyTarget(spState, 320, 0);
    stepMany(spState, 15, { aimDirX: 1, special: true, specialPressed: true });
    expect(spState.player.spearOut).toBe(true);
    // Let spear fly past target and lodge at max range / wall
    stepMany(spState, 50, {});
    const hpAfterThrow = spTarget.hp;
    expect(hpAfterThrow).toBeLessThan(spTarget.maxHp);
    expect(spState.player.spearOut).toBe(true);

    // Re-press Special to recall
    stepSim(spState, makeInput({ special: true, specialPressed: true }));
    const spearProj = spState.projectiles.find((p) => p.kind === 'spear');
    expect(spearProj?.returning).toBe(true);
    stepMany(spState, 60, {});
    expect(spState.player.spearOut).toBe(false);
    expect(spTarget.hp).toBeLessThan(hpAfterThrow);
  });

  it('shield_of_chaos: Bash (25), Dash-Strike (25), Frontal Block + Bull Rush, and Rebound Throw bounces + return', () => {
    const state = createArenaState('shield_of_chaos', 'shield_abyss', { aspectRank: 1 });
    const target = addDummyTarget(state, 110, 0);

    // Quick tap -> Shield Bash (25 dmg + heavy knockback)
    const bashDmg = collectDamageEvents(state, 15, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(bashDmg).toEqual([25]);
    expect(target.vel.x).toBeGreaterThan(200);

    // Dash-Strike -> 25 dmg
    const dsState = createArenaState('shield_of_chaos', 'shield_abyss', { aspectRank: 1 });
    addDummyTarget(dsState, 140, 0);
    stepSim(dsState, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    const dsDmg = collectDamageEvents(dsState, 2, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(dsDmg).toEqual([25]);

    // Hold Attack -> Frontal Block negates frontal hit, then release -> Bull Rush moves hero & hits enemy
    const brState = createArenaState('shield_of_chaos', 'shield_scion', { aspectRank: 1 });
    const brTarget = addDummyTarget(brState, 320, 0);
    stepMany(brState, 24, { aimDirX: 1, attack: true, attackPressed: true });
    expect(brState.player.isBlocking).toBe(true);
    const hpBeforeBlock = brState.player.hp;
    const blockedDmg = dealDamageToPlayer(brState, 25, { source: 'enemy', fromPos: { x: 200, y: 0 } });
    expect(blockedDmg).toBe(0);
    expect(brState.player.hp).toBe(hpBeforeBlock);

    // Release Bull Rush
    const xBeforeRush = brState.player.pos.x;
    stepSim(brState, makeInput({ aimDirX: 1, attack: false }));
    expect(brState.player.isBlocking).toBe(false);
    expect(brState.player.pos.x).toBeGreaterThan(xBeforeRush + 180);
    expect(brTarget.hp).toBeLessThan(brTarget.maxHp);

    // Special Rebound Throw: bounces between enemies and returns to player
    const spState = createArenaState('shield_of_chaos', 'shield_scion', { aspectRank: 1 });
    const e1 = addDummyTarget(spState, 220, 0);
    const e2 = addDummyTarget(spState, 320, 120);
    stepMany(spState, 12, { aimDirX: 1, special: true, specialPressed: true });
    expect(spState.player.shieldOut).toBe(true);
    stepMany(spState, 75, {});
    expect(e1.hp).toBeLessThan(e1.maxHp);
    expect(e2.hp).toBeLessThan(e2.maxHp);
    expect(spState.player.shieldOut).toBe(false);
  });

  it('heart_seeking_bow: Tap vs Full Charge vs Power Shot (70), Dash-Strike (-35% charge), and 9-arrow Volley Fan', () => {
    // Power Shot golden window (0.78..0.98 of 0.6s = ~0.52s = 31 ticks)
    const psState = createArenaState('heart_seeking_bow', 'bow_loaded', { aspectRank: 1 });
    const psTarget = addDummyTarget(psState, 320, 0);
    const psHits = collectDamageEvents(psState, 50, (t) => ({
      aimDirX: 1,
      attack: t < 32,
      attackPressed: t === 0,
    }));
    expect(psHits).toEqual([70]);
    expect(psTarget.hp).toBe(psTarget.maxHp - 70);
    expect(psState.floatingNumbers.some((f) => f.value === 'POWER SHOT!')).toBe(true);

    // Dash-Strike faster charge (0.6 * 0.65 = 0.39s -> ~20 ticks hits Power Shot window vs 32 ticks normal!)
    // Also verifies dash velocity is damped cleanly on dash-cancel (no ~2500 u/s velocity leak)
    const dsState = createArenaState('heart_seeking_bow', 'bow_loaded', { aspectRank: 1 });
    const dsTarget = addDummyTarget(dsState, 420, 0);
    stepSim(dsState, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    stepSim(
      dsState,
      makeInput({
        hasAimWorld: true,
        aimWorldX: dsTarget.pos.x,
        aimWorldY: dsTarget.pos.y,
        attack: true,
        attackPressed: true,
      })
    );
    expect(dsState.player.dashTimer).toBe(0);
    expect(Math.hypot(dsState.player.vel.x, dsState.player.vel.y)).toBeLessThanOrEqual(
      PLAYER_CONSTANTS.speed * 0.8
    );
    const dsHits = collectDamageEvents(dsState, 44, (t) => ({
      hasAimWorld: true,
      aimWorldX: dsTarget.pos.x,
      aimWorldY: dsTarget.pos.y,
      attack: t < 20,
      attackPressed: false,
    }));
    expect(dsHits.length).toBeGreaterThan(0);
    expect(dsHits[0]).toBe(70);
    expect(dsState.floatingNumbers.some((f) => f.value === 'POWER SHOT!')).toBe(true);

    // Special Volley Fan -> spawns 9 arrows
    const spState = createArenaState('heart_seeking_bow', 'bow_scion', { aspectRank: 1 });
    stepMany(spState, 16, { aimDirX: 1, special: true, specialPressed: true });
    const arrows = spState.projectiles.filter((p) => p.ownerId === 'player_special' && p.kind === 'arrow');
    expect(arrows.length).toBe(9);
  });

  it('twin_fists: 5-hit rapid combo (15x5), Dash-Strike (25), Rising Uppercut (30x2), and Dash-Special (45)', () => {
    const state = createArenaState('twin_fists', 'fists_scion', { aspectRank: 1 });
    const target = addDummyTarget(state, 95, 0);

    // Hold Attack fires rapid 15-dmg punches
    const hits = collectDamageEvents(state, 55, (t) => {
      target.pos = { x: state.player.pos.x + 85, y: state.player.pos.y };
      target.vel = { x: 0, y: 0 };
      target.facingAngle = Math.PI;
      return { aimDirX: 1, attack: true, attackPressed: t === 0 };
    });
    expect(hits.length).toBeGreaterThanOrEqual(5);
    expect(hits.slice(0, 5)).toEqual([15, 15, 15, 15, 15]);

    // Dash-Strike -> 25 dmg
    const dsState = createArenaState('twin_fists', 'fists_scion', { aspectRank: 1 });
    addDummyTarget(dsState, 110, 0);
    stepSim(dsState, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    const dsHits = collectDamageEvents(dsState, 2, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(dsHits).toEqual([25]);

    // Special Rising Uppercut -> 2 hits of 30 dmg
    const spState = createArenaState('twin_fists', 'fists_scion', { aspectRank: 1 });
    addDummyTarget(spState, 100, 0);
    const spHits = collectDamageEvents(spState, 18, (t) => ({
      aimDirX: 1,
      special: t === 0,
      specialPressed: t === 0,
    }));
    expect(spHits).toEqual([30, 30]);

    // Dash-Special -> single 45-dmg forward uppercut cancelling dash early
    const dspState = createArenaState('twin_fists', 'fists_scion', { aspectRank: 1 });
    addDummyTarget(dspState, 130, 0);
    stepSim(dspState, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    expect(dspState.player.dashTimer).toBeGreaterThan(0);
    const dspHits = collectDamageEvents(dspState, 2, (t) => ({
      aimDirX: 1,
      special: t === 0,
      specialPressed: t === 0,
    }));
    expect(dspState.player.dashTimer).toBe(0);
    expect(dspHits).toEqual([45]);
  });

  it('adamant_rail: 12-round auto clip + auto/manual reload (0.75s), Dash-Strike, and Bombard Shell lob (60 AoE)', () => {
    const state = createArenaState('adamant_rail', 'rail_blast', { aspectRank: 1 });
    const target = addDummyTarget(state, 260, 0);
    expect(state.player.maxAmmo).toBe(12);
    expect(state.player.ammo).toBe(12);

    // Fire 12 rounds -> auto reload triggers
    stepMany(state, 90, { aimDirX: 1, attack: true, attackPressed: true });
    expect(target.hp).toBeLessThan(target.maxHp);
    // Wait until reload completes
    stepMany(state, 60, {});
    expect(state.player.ammo).toBe(12);
    expect(state.player.reloadTimer).toBe(0);

    // Manual reload after firing 1 shot
    stepSim(state, makeInput({ aimDirX: 1, attack: true, attackPressed: true }));
    expect(state.player.ammo).toBe(11);
    stepSim(state, makeInput({ reload: true, reloadPressed: true }));
    expect(state.player.reloadTimer).toBeCloseTo(0.75, 2);
    stepMany(state, 50, {});
    expect(state.player.ammo).toBe(12);

    // Special Bombard Shell lob (60 dmg AoE after 0.55s)
    const spState = createArenaState('adamant_rail', 'rail_blast', { aspectRank: 1 });
    const bombTarget = addDummyTarget(spState, 400, 0);
    stepMany(spState, 15, { aimDirX: 1, special: true, specialPressed: true });
    const bomb = spState.projectiles.find((p) => p.kind === 'bomb' && p.isLob);
    expect(bomb).toBeDefined();
    stepMany(spState, 45, {});
    expect(bombTarget.hp).toBe(bombTarget.maxHp - 60);
  });
});

describe('All 24 Weapon Aspects — Real Behavior & Zero NaN/Throws', () => {
  it('registers exactly 24 Weapon Aspects across 6 Arms (4 each)', () => {
    expect(ASPECT_IDS).toHaveLength(24);
    for (const wId of WEAPON_IDS) {
      expect(WEAPON_CONSTANTS[wId].aspects).toHaveLength(4);
      for (const aId of WEAPON_CONSTANTS[wId].aspects) {
        expect(ASPECT_DEFS[aId].weaponId).toBe(wId);
      }
    }
  });

  it.each(ASPECT_IDS)('aspect %s executes full combat loop cleanly with finite state', (aspectId) => {
    const def = ASPECT_DEFS[aspectId];
    const state = createArenaState(def.weaponId, aspectId, { aspectRank: 5, seed: 2026 });
    const e1 = addDummyTarget(state, 160, 0);
    const e2 = addDummyTarget(state, 240, 40);
    const totalBefore = e1.hp + e2.hp;

    // Cast, Attack (hold & release), Dash-Strike, Special, Reload
    stepSim(state, makeInput({ aimDirX: 1, cast: true, castPressed: true }));
    stepMany(state, 20, { aimDirX: 1 });
    stepMany(state, 35, { aimDirX: 1, attack: true, attackPressed: true });
    stepMany(state, 10, { aimDirX: 1 });
    stepSim(state, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    stepSim(state, makeInput({ aimDirX: 1, attack: true, attackPressed: true }));
    stepMany(state, 15, { aimDirX: 1 });
    stepMany(state, 20, { aimDirX: 1, special: true, specialPressed: true });
    stepMany(state, 40, { aimDirX: 1 });
    stepSim(state, makeInput({ reload: true, reloadPressed: true }));
    stepMany(state, 50, { aimDirX: 1 });

    assertAllFinite(state);
    expect(e1.hp + e2.hp).toBeLessThan(totalBefore);
  });

  it('verifies unique combat mechanics of all 4 Stygian Blade aspects', () => {
    // blade_scion: +15% Move & Attack Speed
    const scion = createArenaState('stygian_blade', 'blade_scion', { aspectRank: 5 });
    const base = createArenaState('stygian_blade', 'blade_vengeance', { aspectRank: 1 });
    stepMany(scion, 40, { moveX: 1 });
    stepMany(base, 40, { moveX: 1 });
    expect(scion.player.pos.x).toBeGreaterThan(base.player.pos.x);

    // blade_vengeance: Special grants 3s +30% Attack Crit window
    const veng = createArenaState('stygian_blade', 'blade_vengeance', { aspectRank: 5 });
    const vTarget = addDummyTarget(veng, 130, 0, { hp: 20000 });
    stepMany(veng, 20, { special: true, specialPressed: true });
    expect(veng.player.eruptBuffTimer).toBeGreaterThan(2.5);
    let crits = 0;
    for (let i = 0; i < 20; i++) {
      veng.player.eruptBuffTimer = 3.0;
      vTarget.pos = { x: veng.player.pos.x + 110, y: veng.player.pos.y };
      vTarget.vel = { x: 0, y: 0 };
      for (let t = 0; t < 24; t++) {
        stepSim(veng, makeInput({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }));
        if (veng.events.some((e) => e.type === 'damage' && e.crit)) crits++;
      }
    }
    expect(crits).toBeGreaterThan(0);

    // blade_maelstrom: +50% Cast damage & Special dislodges Bloodstones
    const mael = createArenaState('stygian_blade', 'blade_maelstrom', { aspectRank: 5 });
    const mTarget = addDummyTarget(mael, 180, 0);
    const castHits = collectDamageEvents(mael, 40, (t) => ({
      aimDirX: 1,
      cast: t === 0,
      castPressed: t === 0,
    }));
    expect(castHits[0]).toBe(75); // 50 * 1.5
    expect(mTarget.lodgedCasts).toBe(1);
    stepMany(mael, 20, { special: true, specialPressed: true });
    expect(mTarget.lodgedCasts).toBe(0);
    expect(mael.room.bloodstones.length).toBeGreaterThanOrEqual(1);

    // blade_paladin: +50 Max HP, 60/80/200 combo, Consecrated Aura DR on Special
    const pal = createArenaState('stygian_blade', 'blade_paladin', { aspectRank: 5 });
    expect(pal.player.maxHp).toBe(base.player.maxHp + 50);
    const pTarget = addDummyTarget(pal, 140, 0);
    const palHits: number[] = [];
    for (let s = 0; s < 3; s++) {
      pTarget.pos = { x: pal.player.pos.x + 120, y: pal.player.pos.y };
      pTarget.vel = { x: 0, y: 0 };
      pTarget.facingAngle = Math.PI;
      stepSim(pal, makeInput({ aimDirX: 1, attack: true, attackPressed: true }));
      for (const e of pal.events) if (e.type === 'damage') palHits.push(e.amount);
      for (let t = 0; t < 60; t++) {
        pTarget.pos = { x: pal.player.pos.x + 120, y: pal.player.pos.y };
        pTarget.vel = { x: 0, y: 0 };
        pTarget.facingAngle = Math.PI;
        stepSim(pal, makeInput({ aimDirX: 1 }));
        for (const e of pal.events) if (e.type === 'damage') palHits.push(e.amount);
        if (pal.player.attackChargeTimer <= 0 && pal.player.attackTimer <= 0) break;
      }
    }
    expect(palHits).toEqual([60, 80, 200]);
    stepMany(pal, 25, { special: true, specialPressed: true });
    expect(pal.room.hazards.some((h) => h.kind === 'consecrated_aura' && h.active)).toBe(true);
    const drTaken = dealDamageToPlayer(pal, 20, { source: 'enemy', ignoreIframes: true });
    expect(drTaken).toBeLessThan(20);
  });

  it('verifies unique combat mechanics of all 4 Eternal Spear aspects', () => {
    // spear_scion: +25% Special dmg/range/speed
    const scion = createArenaState('eternal_spear', 'spear_scion', { aspectRank: 5 });
    stepMany(scion, 12, { aimDirX: 1, special: true, specialPressed: true });
    const scionSpear = scion.projectiles.find((p) => p.kind === 'spear')!;
    expect(scionSpear.damage).toBe(31); // round(25 * 1.25)
    expect(scionSpear.range).toBe(1100); // round(880 * 1.25)

    // spear_vanguard: Recall rushes hero to spear & grants 4 empowered attacks (+150% dmg)
    const van = createArenaState('eternal_spear', 'spear_vanguard', { aspectRank: 5 });
    stepMany(van, 12, { aimDirX: 1, special: true, specialPressed: true });
    stepMany(van, 20, {});
    const xBefore = van.player.pos.x;
    stepSim(van, makeInput({ special: true, specialPressed: true }));
    expect(van.player.pos.x).toBeGreaterThan(xBefore + 200);
    expect(van.player.empoweredAttacks).toBe(4);
    const vTarget = addDummyTarget(van, van.player.pos.x + 150, van.player.pos.y);
    const empHits = collectDamageEvents(van, 18, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(empHits[0]).toBe(63); // round(25 * (1 + 1.5))
    expect(van.player.empoweredAttacks).toBe(3);
    expect(vTarget.hp).toBe(vTarget.maxHp - 63);

    // spear_sovereign: Spin applies Punishing Sweep (+150% Attack & Special dmg)
    const sov = createArenaState('eternal_spear', 'spear_sovereign', { aspectRank: 5 });
    const sovTarget = addDummyTarget(sov, 180, 0);
    stepMany(sov, 26, { aimDirX: 1, attack: true, attackPressed: true });
    stepSim(sov, makeInput({ aimDirX: 1, attack: false }));
    expect(getWeaponRuntime(sov).punishingSweep.has(sovTarget.id)).toBe(true);
    stepMany(sov, 20, {});
    sovTarget.pos = { x: sov.player.pos.x + 180, y: sov.player.pos.y };
    sovTarget.facingAngle = Math.PI;
    const punHits = collectDamageEvents(sov, 18, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(punHits[0]).toBe(63); // 25 * 2.5

    // spear_dragon: -50% Max HP & Frost Spin launches healing wave
    const drag = createArenaState('eternal_spear', 'spear_dragon', { aspectRank: 5 });
    expect(drag.player.maxHp).toBe(Math.round(scion.player.maxHp * 0.5));
    drag.player.hp = 10;
    addDummyTarget(drag, 240, 0);
    stepMany(drag, 26, { aimDirX: 1, attack: true, attackPressed: true });
    stepSim(drag, makeInput({ aimDirX: 1, attack: false }));
    expect(drag.projectiles.some((p) => p.kind === 'wave')).toBe(true);
    stepMany(drag, 30, {});
    expect(drag.player.hp).toBeGreaterThan(10);
  });

  it('verifies unique combat mechanics of all 4 Shield of Chaos aspects', () => {
    // shield_scion: +15 base Attack & Dash-Strike dmg (25 + 15 = 40)
    const scion = createArenaState('shield_of_chaos', 'shield_scion', { aspectRank: 5 });
    addDummyTarget(scion, 110, 0);
    const scionDmg = collectDamageEvents(scion, 15, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(scionDmg).toEqual([40]);

    // shield_abyss: after Bull Rush, Special throws 1 + 5 = 6 shields
    const abyss = createArenaState('shield_of_chaos', 'shield_abyss', { aspectRank: 5 });
    stepMany(abyss, 20, { aimDirX: 1, attack: true, attackPressed: true });
    stepSim(abyss, makeInput({ aimDirX: 1, attack: false }));
    stepMany(abyss, 20, {});
    stepMany(abyss, 12, { aimDirX: 1, special: true, specialPressed: true });
    const shields = abyss.projectiles.filter((p) => p.kind === 'shield');
    expect(shields.length).toBe(6);

    // shield_thunder: Blitz Disc lingers, pulses multiple times, and recalls on Special re-press
    const thunder = createArenaState('shield_of_chaos', 'shield_thunder', { aspectRank: 5 });
    const thTarget = addDummyTarget(thunder, 160, 0);
    stepMany(thunder, 12, { aimDirX: 1, special: true, specialPressed: true });
    expect(thunder.player.shieldOut).toBe(true);
    const pulseHits = collectDamageEvents(thunder, 45, () => ({}));
    expect(pulseHits.length).toBeGreaterThanOrEqual(2);
    expect(thTarget.hp).toBeLessThan(thTarget.maxHp - 60);
    stepSim(thunder, makeInput({ special: true, specialPressed: true }));
    stepMany(thunder, 40, {});
    expect(thunder.player.shieldOut).toBe(false);

    // shield_behemoth: Cast loads Bloodstones into Dragon Rush AoE detonation
    const beh = createArenaState('shield_of_chaos', 'shield_behemoth', { aspectRank: 5 });
    const bTarget = addDummyTarget(beh, 260, 0);
    stepSim(beh, makeInput({ cast: true, castPressed: true }));
    stepMany(beh, 8, {});
    stepSim(beh, makeInput({ cast: true, castPressed: true }));
    expect(getWeaponRuntime(beh).loadedCasts).toBe(2);
    stepMany(beh, 20, { aimDirX: 1, attack: true, attackPressed: true });
    stepSim(beh, makeInput({ aimDirX: 1, attack: false }));
    expect(getWeaponRuntime(beh).loadedCasts).toBe(0);
    expect(beh.floatingNumbers.some((f) => String(f.value).includes('DRAGON RUSH x2'))).toBe(true);
    expect(bTarget.hp).toBeLessThan(bTarget.maxHp - 150);
  });

  it('verifies unique combat mechanics of all 4 Heart-Seeking Bow aspects', () => {
    // bow_scion: +15% Attack crit chance
    const scion = createArenaState('heart_seeking_bow', 'bow_scion', { aspectRank: 5 });
    const sTarget = addDummyTarget(scion, 260, 0, { hp: 20000 });
    let crits = 0;
    for (let i = 0; i < 30; i++) {
      sTarget.pos = { x: 260, y: 0 };
      sTarget.vel = { x: 0, y: 0 };
      for (let t = 0; t < 20; t++) {
        stepSim(scion, makeInput({ aimDirX: 1, attack: t < 8, attackPressed: t === 0 }));
        if (scion.events.some((e) => e.type === 'damage' && e.crit)) crits++;
      }
    }
    expect(crits).toBeGreaterThan(0);

    // bow_tracker: Attack locks target, Special volley homes onto locked target
    const trk = createArenaState('heart_seeking_bow', 'bow_tracker', { aspectRank: 5 });
    const tTarget = addDummyTarget(trk, 320, 0);
    stepMany(trk, 25, { aimDirX: 1, attack: true, attackPressed: true });
    stepMany(trk, 18, { aimDirX: 1, attack: false });
    expect(getWeaponRuntime(trk).bowTrackerTargetId).toBe(tTarget.id);
    // Fire Special slightly off-axis and confirm arrows home in and hit
    const hpBefore = tTarget.hp;
    stepMany(trk, 14, { aimDirX: 0.7, aimDirY: 0.7, special: true, specialPressed: true });
    expect(trk.projectiles.some((p) => p.kind === 'arrow' && p.homingStrength > 0)).toBe(true);
    stepMany(trk, 40, {});
    expect(tTarget.hp).toBeLessThan(hpBefore);

    // bow_loaded: Cast loads Bloodstones into Attack arrow for AoE detonation
    const load = createArenaState('heart_seeking_bow', 'bow_loaded', { aspectRank: 5 });
    const l1 = addDummyTarget(load, 260, 0);
    const l2 = addDummyTarget(load, 310, 60);
    stepSim(load, makeInput({ cast: true, castPressed: true }));
    expect(getWeaponRuntime(load).loadedCasts).toBe(1);
    stepMany(load, 12, { aimDirX: 1, attack: true, attackPressed: true });
    stepMany(load, 20, { aimDirX: 1, attack: false });
    expect(l1.lodgedCasts).toBe(1);
    expect(l2.hp).toBeLessThan(l2.maxHp); // AoE detonation hit neighbor

    // bow_celestial: Special marks Shared Suffering, Attack propagates damage to linked foe
    const cel = createArenaState('heart_seeking_bow', 'bow_celestial', { aspectRank: 5 });
    const c1 = addDummyTarget(cel, 260, 0);
    const c2 = addDummyTarget(cel, 260, 140);
    stepMany(cel, 16, { aimDirX: 0.9, aimDirY: 0.4, special: true, specialPressed: true });
    stepMany(cel, 30, {});
    expect(getWeaponRuntime(cel).sharedSuffering.has(c2.id)).toBe(true);
    const c2HpBefore = c2.hp;
    // Shoot strictly along +X at c1 only (c2 is 140u south)
    stepMany(cel, 25, { aimDirX: 1, aimDirY: 0, attack: true, attackPressed: true });
    stepMany(cel, 20, { aimDirX: 1, aimDirY: 0, attack: false });
    expect(c1.hp).toBeLessThan(c1.maxHp);
    expect(c2.hp).toBeLessThan(c2HpBefore);
  });

  it('verifies unique combat mechanics of all 4 Twin Fists aspects', () => {
    // fists_scion: +15% passive Dodge chance
    const scion = createArenaState('twin_fists', 'fists_scion', { aspectRank: 5 });
    let dodges = 0;
    for (let i = 0; i < 60; i++) {
      scion.player.hp = scion.player.maxHp;
      scion.player.iframeTimer = 0;
      const dmg = dealDamageToPlayer(scion, 5, { source: 'enemy', ignoreIframes: true });
      if (dmg === 0) dodges++;
    }
    expect(dodges).toBeGreaterThan(0);

    // fists_magnet: Special pulls distant enemy closer and amps Attack dmg
    const mag = createArenaState('twin_fists', 'fists_magnet', { aspectRank: 5 });
    const mTarget = addDummyTarget(mag, 340, 0);
    stepMany(mag, 18, { aimDirX: 1, special: true, specialPressed: true });
    expect(mTarget.pos.x).toBeLessThan(200);
    expect(getWeaponRuntime(mag).magneticPullTargets.has(mTarget.id)).toBe(true);
    const ampHits = collectDamageEvents(mag, 15, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(ampHits[0]).toBe(23); // round(15 * (1 + 0.5))

    // fists_cutter: 12 attacks charge Giga Cutter (+5 extra Special strikes)
    const cut = createArenaState('twin_fists', 'fists_cutter', { aspectRank: 5 });
    const cTarget = addDummyTarget(cut, 90, 0, { hp: 10000 });
    for (let t = 0; t < 180 && getWeaponRuntime(cut).fistsCutterHits < 12; t++) {
      cTarget.pos = { x: cut.player.pos.x + 80, y: cut.player.pos.y };
      cTarget.vel = { x: 0, y: 0 };
      cTarget.facingAngle = Math.PI;
      stepSim(cut, makeInput({ aimDirX: 1, attack: true, attackPressed: t === 0 }));
    }
    expect(getWeaponRuntime(cut).fistsCutterHits).toBe(12);
    cTarget.pos = { x: cut.player.pos.x + 85, y: cut.player.pos.y };
    cTarget.vel = { x: 0, y: 0 };
    const spHits = collectDamageEvents(cut, 20, (t) => ({
      aimDirX: 1,
      special: t === 0,
      specialPressed: t === 0,
    }));
    expect(spHits).toHaveLength(7); // 2 base + 5 extra hits!

    // fists_feral: +2 Dashes, 40-dmg heavy claw attack, Special inflicts Maim
    const fer = createArenaState('twin_fists', 'fists_feral', { aspectRank: 5 });
    expect(fer.player.maxDashCharges).toBe(scion.player.maxDashCharges + 2);
    const fTarget = addDummyTarget(fer, 100, 0);
    const ferAtk = collectDamageEvents(fer, 14, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(ferAtk[0]).toBe(40);
    fTarget.pos = { x: fer.player.pos.x + 95, y: fer.player.pos.y };
    stepMany(fer, 20, { aimDirX: 1, special: true, specialPressed: true });
    expect(fTarget.statuses.some((s) => s.id === 'maim')).toBe(true);
  });

  it('verifies unique combat mechanics of all 4 Adamant Rail aspects', () => {
    // rail_scion: +12 maxAmmo (total 24)
    const scion = createArenaState('adamant_rail', 'rail_scion', { aspectRank: 5 });
    expect(scion.player.maxAmmo).toBe(24);
    expect(scion.player.ammo).toBe(24);

    // rail_blast: absorbing own Special bomb grants 4s +75% Strife buff
    const blast = createArenaState('adamant_rail', 'rail_blast', { aspectRank: 5 });
    stepMany(blast, 14, { aimDirX: 1, special: true, specialPressed: true });
    // Move hero right to the bomb targetPos so blast hits hero
    const bomb = blast.projectiles.find((p) => p.kind === 'bomb')!;
    blast.player.pos = { x: bomb.targetPos!.x, y: bomb.targetPos!.y };
    stepMany(blast, 40, {});
    expect(blast.player.eruptBuffTimer).toBeGreaterThan(3.5);
    const bTarget = addDummyTarget(blast, blast.player.pos.x + 150, blast.player.pos.y);
    const empShot = collectDamageEvents(blast, 16, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(empShot[0]).toBe(18); // round(10 * 1.75)
    expect(bTarget.hp).toBe(bTarget.maxHp - 18);

    // rail_sniper: manual reload empowers next shot to 150 base damage with pierce
    const snip = createArenaState('adamant_rail', 'rail_sniper', { aspectRank: 5 });
    const sTarget = addDummyTarget(snip, 300, 0);
    stepSim(snip, makeInput({ aimDirX: 1, attack: true, attackPressed: true }));
    stepSim(snip, makeInput({ reload: true, reloadPressed: true }));
    stepMany(snip, 50, {});
    expect(snip.player.empoweredAttacks).toBe(1);
    const sHpBefore = sTarget.hp;
    const snipDmg = collectDamageEvents(snip, 25, (t) => ({
      aimDirX: 1,
      attack: t === 0,
      attackPressed: t === 0,
    }));
    expect(snipDmg[0]).toBe(150);
    expect(sTarget.hp).toBe(sHpBefore - 150);

    // rail_beam: ramping continuous beam + Special deploys pulsing Hellfire Mines detonated by beam
    const beam = createArenaState('adamant_rail', 'rail_beam', { aspectRank: 5 });
    const bmTarget = addDummyTarget(beam, 260, 0);
    stepMany(beam, 15, { aimDirX: 1, special: true, specialPressed: true });
    expect(beam.room.hazards.some((h) => h.kind === 'pylon' && h.owner === 'player')).toBe(true);
    // Fire beam into mine -> detonates HELLFIRE! dealing massive AoE damage
    stepMany(beam, 25, { aimDirX: 1, attack: true, attackPressed: true });
    expect(beam.floatingNumbers.some((f) => f.value === 'HELLFIRE!')).toBe(true);
    expect(bmTarget.hp).toBeLessThan(bmTarget.maxHp - 150);
  });
});

describe('All 36 Forge Hammers — Real Behavior Verification', () => {
  it('registers exactly 36 Forge Hammers (6 per weapon)', () => {
    expect(HAMMER_IDS).toHaveLength(36);
    for (const wId of WEAPON_IDS) {
      expect(WEAPON_CONSTANTS[wId].hammers).toHaveLength(6);
      for (const hId of WEAPON_CONSTANTS[wId].hammers) {
        expect(HAMMER_DEFS[hId].weaponId).toBe(wId);
      }
    }
  });

  it('verifies all 6 Stygian Blade hammers', () => {
    // 1. double_edge: Dash-Strike hits twice & +20% dmg (36 x 2)
    const s1 = createArenaState('stygian_blade', 'blade_vengeance', {
      aspectRank: 1,
      hammers: ['hammer_blade_double_edge'],
    });
    addDummyTarget(s1, 160, 0);
    stepSim(s1, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    expect(collectDamageEvents(s1, 2, (t) => ({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }))).toEqual([
      36, 36,
    ]);

    // 2. cruel_thrust: 3rd combo hit deals +200% (90 dmg, or 270 on crit)
    const s2 = createArenaState('stygian_blade', 'blade_vengeance', {
      aspectRank: 1,
      hammers: ['hammer_blade_cruel_thrust'],
    });
    const t2 = addDummyTarget(s2, 120, 0);
    s2.player.attackComboStep = 2;
    s2.player.attackRecoveryTimer = 0.5;
    const h2 = collectDamageEvents(s2, 30, (t) => ({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }));
    expect(h2[0] === 90 || h2[0] === 270).toBe(true);
    expect(t2.hp).toBeLessThan(t2.maxHp);

    // 3. flurry_slash: Hold Attack fires rapid 25-dmg slashes
    const s3 = createArenaState('stygian_blade', 'blade_vengeance', {
      aspectRank: 1,
      hammers: ['hammer_blade_flurry_slash'],
    });
    const t3 = addDummyTarget(s3, 120, 0);
    const h3 = collectDamageEvents(s3, 45, (t) => {
      t3.pos = { x: s3.player.pos.x + 110, y: s3.player.pos.y };
      t3.vel = { x: 0, y: 0 };
      t3.facingAngle = Math.PI;
      return { aimDirX: 1, attack: true, attackPressed: t === 0 };
    });
    expect(h3.length).toBeGreaterThanOrEqual(2);
    expect(h3[0]).toBe(25);

    // 4. shadow_slash: +200% backstab Attack dmg (20 * (1 + 0.5 + 2.0) = 70)
    const s4 = createArenaState('stygian_blade', 'blade_vengeance', {
      aspectRank: 1,
      hammers: ['hammer_blade_shadow_slash'],
    });
    addDummyTarget(s4, 120, 0, { facingAngle: 0 }); // facing away (+X) -> backstab!
    const h4 = collectDamageEvents(s4, 15, (t) => ({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }));
    expect(h4).toEqual([70]);

    // 5. cursed_slash: reduces Max HP by 60% and restores +2 HP on hit
    const s5 = createArenaState('stygian_blade', 'blade_vengeance', {
      aspectRank: 1,
      hammers: [],
    });
    // Initialize runtime state before acquiring Cursed Slash hammer (mirrors real run pickup flow)
    stepSim(s5, makeInput());
    const origMaxHp = s5.player.maxHp;
    s5.player.hammers.push('hammer_blade_cursed_slash');
    addDummyTarget(s5, 120, 0);
    stepSim(s5, makeInput());
    expect(s5.player.maxHp).toBe(Math.max(20, Math.round(origMaxHp * 0.4)));
    s5.player.hp = 10;
    stepMany(s5, 15, { aimDirX: 1, attack: true, attackPressed: true });
    expect(s5.player.hp).toBe(12);

    // 6. super_nova: wider Special (+25% radius = 475) and +20% dmg (60)
    const s6 = createArenaState('stygian_blade', 'blade_vengeance', {
      aspectRank: 1,
      hammers: ['hammer_blade_super_nova'],
    });
    const t6 = addDummyTarget(s6, 440, 0); // beyond 380 base radius, inside 475
    const h6 = collectDamageEvents(s6, 25, (t) => ({ special: t === 0, specialPressed: t === 0 }));
    expect(h6).toEqual([60]);
    expect(t6.hp).toBe(t6.maxHp - 60);
  });

  it('verifies all 6 Eternal Spear hammers', () => {
    // 1. extending_jab: +30% range (559) & +40% dmg at >=240u (round(25*1.4)=35)
    const s1 = createArenaState('eternal_spear', 'spear_sovereign', {
      aspectRank: 1,
      hammers: ['hammer_spear_extending_jab'],
    });
    addDummyTarget(s1, 500, 0);
    const h1 = collectDamageEvents(s1, 15, (t) => ({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }));
    expect(h1).toEqual([35]);

    // 2. flurry_jab: hold attack rapid thrusts, disables spin
    const s2 = createArenaState('eternal_spear', 'spear_sovereign', {
      aspectRank: 1,
      hammers: ['hammer_spear_flurry_jab'],
    });
    const t2 = addDummyTarget(s2, 200, 0);
    const h2 = collectDamageEvents(s2, 50, (t) => {
      t2.pos = { x: s2.player.pos.x + 190, y: s2.player.pos.y };
      t2.vel = { x: 0, y: 0 };
      t2.facingAngle = Math.PI;
      return { aimDirX: 1, attack: true, attackPressed: t === 0 };
    });
    expect(h2.length).toBeGreaterThanOrEqual(2);
    expect(getWeaponRuntime(s2).spearSpinCharging).toBe(false);

    // 3. serrated_point: Dash-Strike hits 3x, Dash range -25%
    const s3 = createArenaState('eternal_spear', 'spear_sovereign', {
      aspectRank: 1,
      hammers: ['hammer_spear_serrated_point'],
    });
    const baseDash = createArenaState('eternal_spear', 'spear_sovereign', { aspectRank: 1 });
    stepMany(s3, 15, { moveX: 1, dash: true, dashPressed: true });
    stepMany(baseDash, 15, { moveX: 1, dash: true, dashPressed: true });
    expect(s3.player.pos.x).toBeLessThan(baseDash.player.pos.x * 0.82);

    const s3b = createArenaState('eternal_spear', 'spear_sovereign', {
      aspectRank: 1,
      hammers: ['hammer_spear_serrated_point'],
    });
    addDummyTarget(s3b, 180, 0);
    stepSim(s3b, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    expect(collectDamageEvents(s3b, 2, (t) => ({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }))).toEqual([
      20, 20, 20,
    ]);

    // 4. exploding_launcher: Special fires 50-dmg AoE blast without lodging
    const s4 = createArenaState('eternal_spear', 'spear_sovereign', {
      aspectRank: 1,
      hammers: ['hammer_spear_exploding_launcher'],
    });
    const t4a = addDummyTarget(s4, 240, 0);
    const t4b = addDummyTarget(s4, 300, 60);
    stepMany(s4, 15, { aimDirX: 1, special: true, specialPressed: true });
    expect(s4.player.spearOut).toBe(false);
    stepMany(s4, 20, {});
    expect(t4a.hp).toBe(t4a.maxHp - 50);
    expect(t4b.hp).toBeLessThan(t4b.maxHp);

    // 5. charged_skewer: hold Special charges up to +200% (75 dmg)
    const s5 = createArenaState('eternal_spear', 'spear_sovereign', {
      aspectRank: 1,
      hammers: ['hammer_spear_charged_skewer'],
    });
    addDummyTarget(s5, 300, 0);
    const h5 = collectDamageEvents(s5, 65, (t) => ({
      aimDirX: 1,
      special: t < 42,
      specialPressed: t === 0,
    }));
    expect(h5[0]).toBe(75);

    // 6. quick_spin: charges 50% faster (0.375s) & +25% wider radius (625)
    const s6 = createArenaState('eternal_spear', 'spear_scion', {
      aspectRank: 1,
      hammers: ['hammer_spear_quick_spin'],
    });
    addDummyTarget(s6, 560, 0); // beyond 500 base radius, inside 625
    const h6 = collectDamageEvents(s6, 42, (t) => ({
      aimDirX: 1,
      attack: t < 36,
      attackPressed: t === 0,
    }));
    expect(h6).toEqual([100]);
  });

  it('verifies all 6 Shield of Chaos hammers', () => {
    // 1. sudden_rush: charges 40% faster (0.48s vs 0.8s)
    const s1 = createArenaState('shield_of_chaos', 'shield_abyss', {
      aspectRank: 1,
      hammers: ['hammer_shield_sudden_rush'],
    });
    const base1 = createArenaState('shield_of_chaos', 'shield_abyss', { aspectRank: 1 });
    addDummyTarget(s1, 300, 0);
    addDummyTarget(base1, 300, 0);
    // Charge for 32 ticks (~0.53s -> 0.39s after 0.14 threshold -> 81% charge with Sudden Rush vs 49% base)
    const h1 = collectDamageEvents(s1, 36, (t) => ({ aimDirX: 1, attack: t < 33, attackPressed: t === 0 }));
    const hb = collectDamageEvents(base1, 36, (t) => ({ aimDirX: 1, attack: t < 33, attackPressed: t === 0 }));
    expect(h1[0]).toBeGreaterThan(hb[0]);

    // 2. charged_shot: fires piercing wave up to 80 dmg without dashing forward
    const s2 = createArenaState('shield_of_chaos', 'shield_abyss', {
      aspectRank: 1,
      hammers: ['hammer_shield_charged_shot'],
    });
    addDummyTarget(s2, 320, 0);
    const xBefore = s2.player.pos.x;
    const h2 = collectDamageEvents(s2, 80, (t) => ({ aimDirX: 1, attack: t < 62, attackPressed: t === 0 }));
    expect(s2.player.pos.x).toBe(xBefore);
    expect(h2[0]).toBe(80);

    // 3. pulverizing_blow: hits twice with 0 knockback
    const s3 = createArenaState('shield_of_chaos', 'shield_abyss', {
      aspectRank: 1,
      hammers: ['hammer_shield_pulverizing_blow'],
    });
    const t3 = addDummyTarget(s3, 110, 0);
    const h3 = collectDamageEvents(s3, 15, (t) => ({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }));
    expect(h3).toEqual([25, 25]);
    expect(t3.vel.x).toBe(0);

    // 4. dread_flight: Special shield has 2 + 4 = 6 bounces
    const s4 = createArenaState('shield_of_chaos', 'shield_abyss', {
      aspectRank: 1,
      hammers: ['hammer_shield_dread_flight'],
    });
    stepMany(s4, 12, { aimDirX: 1, special: true, specialPressed: true });
    const sh = s4.projectiles.find((p) => p.kind === 'shield')!;
    expect(sh.bouncesLeft).toBe(6);

    // 5. explosive_return: catching returning shield deals 50 AoE dmg
    const s5 = createArenaState('shield_of_chaos', 'shield_abyss', {
      aspectRank: 1,
      hammers: ['hammer_shield_explosive_return'],
    });
    const nearBack = addDummyTarget(s5, -140, 0); // behind player so outgoing throw misses
    stepMany(s5, 12, { hasAimWorld: true, aimWorldX: 500, aimWorldY: 0, special: true, specialPressed: true });
    stepMany(s5, 75, {});
    expect(s5.player.shieldOut).toBe(false);
    expect(nearBack.hp).toBe(nearBack.maxHp - 50);

    // 6. ferocious_guard: blocking grants 10s +20% dmg & +20% move speed
    const s6 = createArenaState('shield_of_chaos', 'shield_abyss', {
      aspectRank: 1,
      hammers: ['hammer_shield_ferocious_guard'],
    });
    stepMany(s6, 15, { aimDirX: 1, attack: true, attackPressed: true });
    expect(s6.player.isBlocking).toBe(true);
    expect(dealDamageToPlayer(s6, 20, { source: 'enemy', fromPos: { x: 180, y: 0 } })).toBe(0);
    expect(s6.player.eruptBuffTimer).toBeCloseTo(10.0, 1);
  });

  it('verifies all 6 Heart-Seeking Bow hammers', () => {
    // 1. twin_shot: fires 2 arrows with 75% range
    const s1 = createArenaState('heart_seeking_bow', 'bow_loaded', {
      aspectRank: 1,
      hammers: ['hammer_bow_twin_shot'],
    });
    stepMany(s1, 10, { aimDirX: 1, attack: true, attackPressed: true });
    stepSim(s1, makeInput({ aimDirX: 1, attack: false }));
    const arrows1 = s1.projectiles.filter((p) => p.kind === 'arrow');
    expect(arrows1).toHaveLength(2);
    expect(arrows1[0].range).toBe(Math.round(WEAPON_CONSTANTS.heart_seeking_bow.attackRange * 0.75));

    // 2. flurry_shot: hold Attack fires rapid 35-dmg arrows without charging
    const s2 = createArenaState('heart_seeking_bow', 'bow_loaded', {
      aspectRank: 1,
      hammers: ['hammer_bow_flurry_shot'],
    });
    addDummyTarget(s2, 200, 0);
    const h2 = collectDamageEvents(s2, 32, (t) => ({ aimDirX: 1, attack: true, attackPressed: t === 0 }));
    expect(h2.length).toBeGreaterThanOrEqual(2);
    expect(h2[0]).toBe(35);

    // 3. perfect_shot: wider Power Shot window & +150% dmg (175)
    const s3 = createArenaState('heart_seeking_bow', 'bow_loaded', {
      aspectRank: 1,
      hammers: ['hammer_bow_perfect_shot'],
    });
    addDummyTarget(s3, 320, 0);
    const h3 = collectDamageEvents(s3, 45, (t) => ({ aimDirX: 1, attack: t < 26, attackPressed: t === 0 }));
    expect(h3[0] === 175 || h3[0] === 525).toBe(true); // 175 base or 525 on 15% power shot crit

    // 4. point_blank_shot: +150% Attack dmg to foes within 280u
    const s4 = createArenaState('heart_seeking_bow', 'bow_loaded', {
      aspectRank: 1,
      hammers: ['hammer_bow_point_blank_shot'],
    });
    addDummyTarget(s4, 150, 0);
    const h4 = collectDamageEvents(s4, 25, (t) => ({ aimDirX: 1, attack: t < 6, attackPressed: t === 0 }));
    // Base ~18 dmg * 2.5 = ~45 (far above unboosted ~18)
    expect(h4[0]).toBeGreaterThanOrEqual(38);

    // 5. relentless_volley: Special fires 9 + 4 = 13 arrows
    const s5 = createArenaState('heart_seeking_bow', 'bow_scion', {
      aspectRank: 1,
      hammers: ['hammer_bow_relentless_volley'],
    });
    stepMany(s5, 16, { aimDirX: 1, special: true, specialPressed: true });
    expect(s5.projectiles.filter((p) => p.ownerId === 'player_special')).toHaveLength(13);

    // 6. explosive_shot: 4x dmg with AoE radius 230
    const s6 = createArenaState('heart_seeking_bow', 'bow_loaded', {
      aspectRank: 1,
      hammers: ['hammer_bow_explosive_shot'],
    });
    const t6a = addDummyTarget(s6, 260, 0);
    const t6b = addDummyTarget(s6, 340, 80);
    stepMany(s6, 20, { aimDirX: 1, attack: true, attackPressed: true });
    stepSim(s6, makeInput({ aimDirX: 1, attack: false }));
    const expArrow = s6.projectiles.find((p) => p.kind === 'arrow')!;
    expect(expArrow.aoeRadius).toBe(230);
    stepMany(s6, 25, {});
    expect(t6a.hp).toBeLessThan(t6a.maxHp - 80);
    expect(t6b.hp).toBeLessThan(t6b.maxHp);
  });

  it('verifies all 6 Twin Fists hammers', () => {
    // 1. breaching_cross: Dash-Strike deals +900% to Armor (25 * 10 = 250)
    const s1 = createArenaState('twin_fists', 'fists_scion', {
      aspectRank: 1,
      hammers: ['hammer_fists_breaching_cross'],
    });
    const t1 = addDummyTarget(s1, 110, 0, { armor: 400 });
    stepSim(s1, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    expect(collectDamageEvents(s1, 2, (t) => ({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }))).toEqual([250]);
    expect(t1.armor).toBe(150);

    // 2. long_knuckle: +35% range (162) & +10% dmg (round(15*1.1) = 17)
    const s2 = createArenaState('twin_fists', 'fists_scion', {
      aspectRank: 1,
      hammers: ['hammer_fists_long_knuckle'],
    });
    addDummyTarget(s2, 165, 0); // beyond 120 + radius? wait radius=38 so 165 > 120+38=158, inside 162+38=200
    const h2 = collectDamageEvents(s2, 14, (t) => ({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }));
    expect(h2).toEqual([17]);

    // 3. rolling_knuckle: Dash-Strike deals +60% (40) & increments combo step
    const s3 = createArenaState('twin_fists', 'fists_scion', {
      aspectRank: 1,
      hammers: ['hammer_fists_rolling_knuckle'],
    });
    s3.player.attackComboStep = 2;
    addDummyTarget(s3, 120, 0);
    stepSim(s3, makeInput({ moveX: 1, dash: true, dashPressed: true }));
    expect(collectDamageEvents(s3, 2, (t) => ({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }))).toEqual([40]);
    expect(s3.player.attackComboStep).toBe(3);

    // 4. kinetic_launcher: Special fires ranged 50-dmg wave projectile
    const s4 = createArenaState('twin_fists', 'fists_scion', {
      aspectRank: 1,
      hammers: ['hammer_fists_kinetic_launcher'],
    });
    const t4 = addDummyTarget(s4, 420, 0);
    stepMany(s4, 14, { aimDirX: 1, special: true, specialPressed: true });
    expect(s4.projectiles.some((p) => p.kind === 'wave' && p.damage === 50)).toBe(true);
    stepMany(s4, 30, {});
    expect(t4.hp).toBe(t4.maxHp - 50);

    // 5. quake_cutter: Special triggers radial 90-dmg shockwave around hero
    const s5 = createArenaState('twin_fists', 'fists_scion', {
      aspectRank: 1,
      hammers: ['hammer_fists_quake_cutter'],
    });
    const behind = addDummyTarget(s5, -180, 0);
    stepMany(s5, 16, { aimDirX: 1, special: true, specialPressed: true });
    expect(behind.hp).toBe(behind.maxHp - 90);

    // 6. colossus_knuckle: Sturdy -30% damage taken during Attack/Special
    const s6 = createArenaState('twin_fists', 'fists_magnet', {
      aspectRank: 1,
      hammers: ['hammer_fists_colossus_knuckle'],
    });
    s6.player.attackTimer = 0.2;
    const dmg = dealDamageToPlayer(s6, 20, { source: 'enemy', ignoreIframes: true, canDodge: false });
    expect(dmg).toBe(14); // 20 * 0.7
  });

  it('verifies all 6 Adamant Rail hammers', () => {
    // 1. spread_fire: 5 pellets at 40 dmg each, clip size 6
    const s1 = createArenaState('adamant_rail', 'rail_blast', {
      aspectRank: 1,
      hammers: ['hammer_rail_spread_fire'],
    });
    stepSim(s1, makeInput({ aimDirX: 1, attack: true, attackPressed: true }));
    expect(s1.player.maxAmmo).toBe(6);
    const pellets = s1.projectiles.filter((p) => p.kind === 'bullet');
    expect(pellets).toHaveLength(5);
    expect(pellets[0].damage).toBe(40);

    // 2. delta_chamber: 3-round burst and never consumes ammo or reloads
    const s2 = createArenaState('adamant_rail', 'rail_blast', {
      aspectRank: 1,
      hammers: ['hammer_rail_delta_chamber'],
    });
    const ammoBefore = s2.player.ammo;
    let bulletsSpawned = 0;
    for (let t = 0; t < 16; t++) {
      const before = s2.projectiles.length;
      stepSim(s2, makeInput({ aimDirX: 1, attack: t === 0, attackPressed: t === 0 }));
      if (s2.projectiles.length > before) bulletsSpawned += s2.projectiles.length - before;
    }
    expect(bulletsSpawned).toBe(3);
    expect(s2.player.ammo).toBe(ammoBefore);
    stepSim(s2, makeInput({ reload: true, reloadPressed: true }));
    expect(s2.player.reloadTimer).toBe(0);

    // 3. flurry_fire: +6 ammo capacity (18) and 25% faster fire rate
    const s3 = createArenaState('adamant_rail', 'rail_blast', {
      aspectRank: 1,
      hammers: ['hammer_rail_flurry_fire'],
    });
    stepSim(s3, makeInput({ aimDirX: 1, attack: true, attackPressed: true }));
    expect(s3.player.maxAmmo).toBe(18);
    expect(s3.player.attackTimer).toBeCloseTo(0.1 / 1.25, 3);

    // 4. cluster_bomb: 5 lobbed bombs at 70% dmg (42)
    const s4 = createArenaState('adamant_rail', 'rail_blast', {
      aspectRank: 1,
      hammers: ['hammer_rail_cluster_bomb'],
    });
    stepMany(s4, 15, { aimDirX: 1, special: true, specialPressed: true });
    const bombs4 = s4.projectiles.filter((p) => p.kind === 'bomb' && p.isLob);
    expect(bombs4).toHaveLength(5);
    expect(bombs4[0].damage).toBe(42);

    // 5. hazard_bomb: 4x Special damage (240) and self-damages player if inside blast
    const s5 = createArenaState('adamant_rail', 'rail_blast', {
      aspectRank: 1,
      hammers: ['hammer_rail_hazard_bomb'],
    });
    const t5 = addDummyTarget(s5, 400, 0);
    stepMany(s5, 15, { aimDirX: 1, special: true, specialPressed: true });
    const bomb5 = s5.projectiles.find((p) => p.kind === 'bomb')!;
    expect(bomb5.damage).toBe(240);
    // Position t5 slightly right of blast center facing left (frontal hit -> exact 240) and place player inside blast
    t5.pos = { x: bomb5.targetPos!.x + 40, y: bomb5.targetPos!.y };
    t5.facingAngle = Math.PI;
    s5.player.pos = { x: bomb5.targetPos!.x, y: bomb5.targetPos!.y };
    const hpBefore = s5.player.hp;
    stepMany(s5, 45, {});
    expect(t5.hp).toBe(t5.maxHp - 240);
    expect(s5.player.hp).toBeLessThan(hpBefore);

    // 6. rocket_bomb: fast straight non-lob 80-dmg rocket
    const s6 = createArenaState('adamant_rail', 'rail_blast', {
      aspectRank: 1,
      hammers: ['hammer_rail_rocket_bomb'],
    });
    const t6 = addDummyTarget(s6, 300, 0);
    stepMany(s6, 15, { aimDirX: 1, special: true, specialPressed: true });
    const rocket = s6.projectiles.find((p) => p.kind === 'bomb')!;
    expect(rocket.isLob).toBe(false);
    expect(rocket.damage).toBe(80);
    stepMany(s6, 20, {});
    expect(t6.hp).toBe(t6.maxHp - 80);
  });
});

describe('Deterministic FNV-1a Replay — hashSimState()', () => {
  function runScriptedTape(weaponId: WeaponId, seed: number, mutateTick?: number): string[] {
    const meta = createDefaultMetaSave();
    selectWeaponAndAspect(meta, weaponId, WEAPON_CONSTANTS[weaponId].aspects[0]);
    const state = createDefaultSimState(seed, meta);
    const hooks = createGameplayHooks();
    startNewRun(state, seed);

    const checkpoints: string[] = [];
    for (let tick = 1; tick <= 180; tick++) {
      const target = state.enemies.find((e) => e.hp > 0 && e.aiState !== 'dead');
      const dx = target ? target.pos.x - state.player.pos.x : 1;
      const dy = target ? target.pos.y - state.player.pos.y : 0;
      const len = Math.hypot(dx, dy) || 1;

      const frame = makeInput({
        tick,
        moveX: tick === mutateTick ? -1 : Math.cos(tick * 0.08),
        moveY: Math.sin(tick * 0.08),
        aimDirX: dx / len,
        aimDirY: dy / len,
        attack: tick % 20 < 8,
        attackPressed: tick % 20 === 0,
        special: tick % 45 === 10,
        specialPressed: tick % 45 === 10,
        dash: tick % 35 === 5,
        dashPressed: tick % 35 === 5,
        cast: tick % 50 === 15,
        castPressed: tick % 50 === 15,
        reload: tick % 60 === 30,
        reloadPressed: tick % 60 === 30,
      });

      stepSim(state, frame, hooks);
      if (tick === 60 || tick === 120 || tick === 180) {
        checkpoints.push(hashSimState(state));
      }
    }
    return checkpoints;
  }

  it.each(WEAPON_IDS)('produces bit-for-bit identical FNV-1a hashes across repeated runs for %s', (weaponId) => {
    const runA = runScriptedTape(weaponId, 987654);
    const runB = runScriptedTape(weaponId, 987654);
    expect(runA).toEqual(runB);
    expect(runA[2]).toMatch(/^[0-9a-f]{8}$/);
  });

  it('diverges deterministically when seed or input frame changes', () => {
    const base = runScriptedTape('stygian_blade', 7777);
    const diffSeed = runScriptedTape('stygian_blade', 7778);
    // Tick 22 is outside the dash window (ticks 5..17), so moveX alteration immediately diverges state
    const diffInput = runScriptedTape('stygian_blade', 7777, 22);
    expect(base[2]).not.toBe(diffSeed[2]);
    expect(base[2]).not.toBe(diffInput[2]);
  });

  it('matches SIM_CONSTANTS and PLAYER_CONSTANTS timing invariants', () => {
    expect(SIM_CONSTANTS.simHz).toBe(60);
    expect(PLAYER_CONSTANTS.dashDuration).toBe(0.21);
    expect(PLAYER_CONSTANTS.dashClipRegenInterval).toBe(0.74);
  });
});
