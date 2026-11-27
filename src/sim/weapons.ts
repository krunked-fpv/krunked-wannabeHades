import {
  PATRON_CONSTANTS,
  PLAYER_CONSTANTS,
  SIM_CONSTANTS,
  WEAPON_CONSTANTS,
  type BoonInstance,
  type EnemyState,
  type InputFrame,
  type PatronId,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import { getAspectBonus, getAspectRank } from '../data/aspects.js';
import { hasHammer } from '../data/hammers.js';
import { getWeaponDef, getWeaponTuning } from '../data/weapons.js';
import { breakUrnsInCone, breakUrnsInEllipse, resolveHeroCollision } from './collision.js';
import {
  BLITZ_DISC_PIERCE_SENTINEL,
  FROST_SPIN_WAVE_SENTINEL,
  addCameraShake,
  dealDamageToPlayer,
  deflectProjectiles,
  detonateHellfireMine,
  dropLodgedBloodstones,
  getBoonInSlot,
  getWeaponRuntime,
  spawnFloatingNumber,
  triggerHitstop,
  type SimCombatContext,
  type SimGameplayHooks,
} from './combat.js';
import {
  angleToFacingIdx,
  ellipseDistance,
  isInEllipticalCone,
  normalizeAngle,
  rotateAngleToward,
} from './isometric.js';
import { computeAimAngle } from './physics.js';
import { nextFloat, nextInt } from './prng.js';

function computeAttackSpeedMultiplier(state: SimState): number {
  const player = state.player;
  let mult = 1.0;

  if (player.aspectId === 'blade_scion') {
    const rank = getAspectRank(state.meta.aspectRanks, 'blade_scion');
    mult += getAspectBonus('blade_scion', rank);
  }
  if (player.aspectId === 'spear_dragon') {
    const rank = getAspectRank(state.meta.aspectRanks, 'spear_dragon');
    mult += getAspectBonus('spear_dragon', rank);
  }

  for (let i = 0; i < player.boons.length; i++) {
    const b = player.boons[i];
    if (b.patronId === 'veloce' && b.slot === 'passive' && (b.id.includes('attack') || b.id.includes('swift'))) {
      mult += b.scaledValue <= 1 ? b.scaledValue : b.scaledValue / 100;
    }
  }

  if (player.weaponId === 'adamant_rail' && hasHammer(player, 'hammer_rail_flurry_fire')) {
    mult += 0.25;
  }

  return mult;
}

function applyChaosActionCurse(
  state: SimState,
  curseKind: 'take_damage_on_attack' | 'take_damage_on_special' | 'take_damage_on_cast',
): void {
  const curses = state.player.chaosCurses;
  for (let i = 0; i < curses.length; i++) {
    if (curses[i].curseKind === curseKind) {
      dealDamageToPlayer(state, Math.max(1, curses[i].curseMagnitude), {
        source: 'chaos',
        ignoreIframes: true,
      });
    }
  }
}

function runFallbackBoonOnHit(
  state: SimState,
  primaryTarget: EnemyState,
  slot: 'attack' | 'special' | 'cast',
  ctx: SimCombatContext,
): void {
  const boon = getBoonInSlot(state.player, slot);
  if (!boon) return;

  if (boon.patronId === 'voltaris') {
    const boltDmg = boon.scaledValue >= 5 ? Math.round(boon.scaledValue) : 16;
    let jumps = 0;
    const hitSet = new Set<string>([primaryTarget.id]);
    let origin = primaryTarget.pos;

    while (jumps < 2) {
      let nextEnemy: EnemyState | null = null;
      let bestDist = 320;
      for (let i = 0; i < state.enemies.length; i++) {
        const e = state.enemies[i];
        if (e.hp <= 0 || e.aiState === 'dead' || hitSet.has(e.id)) continue;
        const d = ellipseDistance(e.pos.x - origin.x, e.pos.y - origin.y);
        if (d < bestDist) {
          bestDist = d;
          nextEnemy = e;
        }
      }
      if (!nextEnemy) break;
      hitSet.add(nextEnemy.id);
      ctx.dealDamageToEnemy(state, nextEnemy, {
        baseDamage: boltDmg,
        source: 'status',
        patronId: 'voltaris',
        statusId: 'jolted',
        canCrit: false,
        canBackstab: false,
      });
      origin = nextEnemy.pos;
      jumps++;
    }
  } else if (boon.patronId === 'tidebreaker' && slot !== 'cast') {
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.id === primaryTarget.id || e.hp <= 0 || e.aiState === 'dead') continue;
      if (ellipseDistance(e.pos.x - primaryTarget.pos.x, e.pos.y - primaryTarget.pos.y) <= 135) {
        ctx.dealDamageToEnemy(state, e, {
          baseDamage: 12,
          source: 'status',
          knockback: 750,
          patronId: 'tidebreaker',
          statusId: 'ruptured',
          canCrit: false,
          canBackstab: false,
        });
      }
    }
  }
}

function notifyAttackHit(
  state: SimState,
  enemy: EnemyState,
  source: 'attack' | 'special' | 'cast',
  damage: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  if (damage <= 0) return;
  if (hooks?.onPlayerAttackHit) {
    hooks.onPlayerAttackHit(state, enemy, source, damage, ctx);
  } else {
    runFallbackBoonOnHit(state, enemy, source, ctx);
  }
}

function performMeleeConeStrike(
  state: SimState,
  angle: number,
  damage: number,
  range: number,
  arcDeg: number,
  impactVelocity: number,
  source: 'attack' | 'special',
  opts: {
    isDashStrike?: boolean;
    bonusCritChance?: number;
    comboStep: number;
    multiHits?: number;
    applyMaim?: boolean;
  },
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): number {
  const player = state.player;
  const slotBoon = getBoonInSlot(player, source);
  const hits = opts.multiHits ?? 1;

  breakUrnsInCone(state, player.pos, angle, range, arcDeg);

  if (slotBoon?.patronId === 'aegira') {
    deflectProjectiles(state, player.pos, range, angle, arcDeg);
  }

  let totalHitEnemies = 0;
  for (let h = 0; h < hits; h++) {
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.hp <= 0 || e.aiState === 'dead') continue;
      const dx = e.pos.x - player.pos.x;
      const dy = e.pos.y - player.pos.y;
      if (!isInEllipticalCone(dx, dy, angle, range + e.radius, arcDeg, SIM_CONSTANTS.isoScaleY)) {
        continue;
      }

      const dealt = ctx.dealDamageToEnemy(state, e, {
        baseDamage: damage,
        source,
        angle,
        knockback: impactVelocity,
        bonusCritChance: opts.bonusCritChance,
        patronId: slotBoon?.patronId,
        statusId: opts.applyMaim ? 'maim' : slotBoon?.statusEffect,
        isDashStrike: opts.isDashStrike,
      });

      if (dealt > 0) {
        totalHitEnemies++;
        notifyAttackHit(state, e, source, dealt, ctx, hooks);
      }
    }
  }

  return totalHitEnemies;
}

// ============================================================================
// Stygian Blade, Spear, Shield & Fists Melee Combo + Dash-Strike
// ============================================================================

function executeMeleeSwing(
  state: SimState,
  angle: number,
  stageIdx: number,
  isDashStrike: boolean,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const player = state.player;
  const tuning = getWeaponTuning(player.weaponId);
  const stage = isDashStrike
    ? tuning.dashStrike
    : tuning.comboStages[stageIdx % tuning.comboStages.length];

  let damage = stage.damage;
  let range = stage.range;
  let arcDeg = stage.arcDeg;
  let knockback = stage.impactVelocity;
  let selfVel = stage.selfVelocity;
  let bonusCrit = 0;
  let multiHits = 1;

  if (player.weaponId === 'stygian_blade') {
    if (player.aspectId === 'blade_paladin' && !isDashStrike) {
      const paladinCombo = [60, 80, 200];
      damage = paladinCombo[stageIdx % 3];
      range += 45;
      knockback = Math.max(knockback, 1400);
    }
    if (!isDashStrike && hasHammer(player, 'hammer_blade_flurry_slash')) {
      damage = 25;
      arcDeg = 130;
    }
    if (!isDashStrike && stageIdx === 2 && hasHammer(player, 'hammer_blade_cruel_thrust')) {
      damage = Math.round(damage * 3.0); // +200%
      bonusCrit += 0.4;
    }
    if (isDashStrike && hasHammer(player, 'hammer_blade_double_edge')) {
      damage = Math.round(damage * 1.2); // +20%
      multiHits = 2;
    }
  } else if (player.weaponId === 'eternal_spear') {
    if (hasHammer(player, 'hammer_spear_extending_jab')) {
      range = Math.round(range * 1.3);
    }
    if (isDashStrike && hasHammer(player, 'hammer_spear_serrated_point')) {
      multiHits = 3;
    }
  } else if (player.weaponId === 'shield_of_chaos') {
    if (player.aspectId === 'shield_scion') {
      damage += getAspectBonus('shield_scion', getAspectRank(state.meta.aspectRanks, 'shield_scion'));
    }
    if (hasHammer(player, 'hammer_shield_pulverizing_blow') && !isDashStrike) {
      multiHits = 2;
      knockback = 0;
    }
  } else if (player.weaponId === 'twin_fists') {
    if (player.aspectId === 'fists_feral' && !isDashStrike) {
      damage = 40;
      arcDeg = 135;
      range = Math.max(range, 145);
    }
    if (hasHammer(player, 'hammer_fists_long_knuckle')) {
      range = Math.round(range * 1.35);
      damage = Math.round(damage * 1.1);
    }
    if (isDashStrike && hasHammer(player, 'hammer_fists_rolling_knuckle')) {
      damage = Math.round(damage * 1.6);
    }
  }

  if (selfVel !== 0) {
    player.vel.x = Math.cos(angle) * selfVel;
    player.vel.y = Math.sin(angle) * selfVel;
  }

  applyChaosActionCurse(state, 'take_damage_on_attack');

  state.events.push({
    type: 'attack_swing',
    weaponId: player.weaponId,
    pos: { x: player.pos.x, y: player.pos.y },
    angle,
    comboStep: stageIdx,
    isDashStrike,
  });

  performMeleeConeStrike(
    state,
    angle,
    damage,
    range,
    arcDeg,
    knockback,
    'attack',
    {
      isDashStrike,
      bonusCritChance: bonusCrit,
      comboStep: stageIdx,
      multiHits,
    },
    ctx,
    hooks,
  );
}

// ============================================================================
// Eternal Spear: 3-Tier Spin Attack, Recall & Vanguard Rush
// ============================================================================

function executeSpearSpinAttack(
  state: SimState,
  chargeFrac: number,
  angle: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const player = state.player;
  const tuning = getWeaponTuning('eternal_spear');
  const tiers = tuning.spinTiers!;
  const attackBoon = getBoonInSlot(player, 'attack');
  const rt = getWeaponRuntime(state);

  let chosen = tiers[0];
  for (let i = 0; i < tiers.length; i++) {
    if (chargeFrac >= tiers[i].minFrac) {
      chosen = tiers[i];
    }
  }

  let radius = chosen.radius;
  const dmg = chosen.damage;
  if (hasHammer(player, 'hammer_spear_quick_spin')) {
    radius = Math.round(radius * 1.25);
  }
  if (player.aspectId === 'spear_sovereign') {
    radius = Math.round(radius * 1.25);
  }

  applyChaosActionCurse(state, 'take_damage_on_attack');
  state.events.push({
    type: 'attack_swing',
    weaponId: 'eternal_spear',
    pos: { x: player.pos.x, y: player.pos.y },
    angle,
    comboStep: 3,
    isDashStrike: false,
  });

  // Aspect of the Frost Dragon (spear_dragon): launches traveling healing frost spin wave!
  if (player.aspectId === 'spear_dragon') {
    const speed = 520;
    ctx.spawnProjectile(state, {
      owner: 'player',
      ownerId: 'player',
      kind: 'wave',
      pos: { x: player.pos.x + Math.cos(angle) * 32, y: player.pos.y + Math.sin(angle) * 32 },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      startPos: { x: player.pos.x, y: player.pos.y },
      radius: Math.round(radius * 0.45),
      angle,
      damage: Math.round(dmg * 0.75),
      range: 640,
      maxLife: 1.4,
      pierceLeft: 25,
      bouncesLeft: 0,
      deflectable: false,
      deflected: false,
      homingStrength: 0,
      isLob: false,
      lobHeight: FROST_SPIN_WAVE_SENTINEL,
      lobDuration: 0,
      lobElapsed: 0,
      patronId: attackBoon?.patronId,
      statusToApply: 'chill',
      colorHex: '#60BDFF',
    });
    addCameraShake(state, 6.5, 0.16);
    return;
  }

  breakUrnsInEllipse(state, player.pos, radius);
  if (attackBoon?.patronId === 'aegira') {
    deflectProjectiles(state, player.pos, radius, 0, 360);
  }

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0 || e.aiState === 'dead') continue;
    const dx = e.pos.x - player.pos.x;
    const dy = e.pos.y - player.pos.y;
    if (ellipseDistance(dx, dy) > radius + e.radius) continue;

    const dealt = ctx.dealDamageToEnemy(state, e, {
      baseDamage: dmg,
      source: 'attack',
      angle: Math.atan2(dy, dx),
      knockback: chosen.impactVelocity,
      patronId: attackBoon?.patronId,
      statusId: attackBoon?.statusEffect,
    });
    if (dealt > 0) {
      notifyAttackHit(state, e, 'attack', dealt, ctx, hooks);
      // Aspect of the Sovereign: inflict Punishing Sweep (+150% Attack & Special dmg for 10s)
      if (player.aspectId === 'spear_sovereign' && e.hp > 0) {
        rt.punishingSweep.set(e.id, 10.0);
        spawnFloatingNumber(state, { x: e.pos.x, y: e.pos.y - 18 }, 'PUNISHED', 'status', '#FF5266');
      }
    }
  }

  addCameraShake(state, chosen.radius >= 500 ? 9.0 : 5.5, 0.16);
}

function executeSpearRecallOrVanguardRush(
  state: SimState,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const player = state.player;
  const spearIdx = state.projectiles.findIndex(
    (p) => p.owner === 'player' && p.kind === 'spear',
  );
  if (spearIdx === -1) {
    player.spearOut = false;
    return;
  }
  const spear = state.projectiles[spearIdx];

  // Aspect of the Vanguard (spear_vanguard): Hero rushes directly to spear & empowers next 4 Attacks/Casts!
  if (player.aspectId === 'spear_vanguard') {
    const startPos: Vec2 = { x: player.pos.x, y: player.pos.y };
    const targetPos: Vec2 = { x: spear.pos.x, y: spear.pos.y };
    const rushAngle = Math.atan2(targetPos.y - startPos.y, targetPos.x - startPos.x);
    const rushDist = Math.hypot(targetPos.x - startPos.x, targetPos.y - startPos.y);

    // Damage enemies along the Raging Rush line
    const specialBoon = getBoonInSlot(player, 'special');
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.hp <= 0 || e.aiState === 'dead') continue;
      if (
        isInEllipticalCone(
          e.pos.x - startPos.x,
          e.pos.y - startPos.y,
          rushAngle,
          rushDist + 70,
          46,
        )
      ) {
        const dealt = ctx.dealDamageToEnemy(state, e, {
          baseDamage: 35,
          source: 'special',
          angle: rushAngle,
          knockback: 900,
          patronId: specialBoon?.patronId,
          statusId: specialBoon?.statusEffect,
        });
        if (dealt > 0) notifyAttackHit(state, e, 'special', dealt, ctx, hooks);
      }
    }

    // Swept rush across pits straight to the spear
    resolveHeroCollision(state, targetPos, true);
    resolveHeroCollision(state, player.pos, false);
    player.facingAngle = normalizeAngle(rushAngle);
    player.facingIdx = angleToFacingIdx(player.facingAngle);
    player.spearOut = false;
    player.empoweredAttacks = 4;
    state.projectiles.splice(spearIdx, 1);

    spawnFloatingNumber(state, player.pos, 'RAGING RUSH x4!', 'crit', '#FFD54F');
    state.events.push({
      type: 'dash',
      pos: startPos,
      endPos: { x: player.pos.x, y: player.pos.y },
      angle: rushAngle,
      perfect: false,
    });
    addCameraShake(state, 7.0, 0.15);
    return;
  }

  // Standard Spear Recall: spear pierces swiftly back to the hero!
  spear.returning = true;
  spear.hitIds = [];
  spear.maxLife = spear.life + 2.5;
  const dx = player.pos.x - spear.pos.x;
  const dy = player.pos.y - spear.pos.y;
  const d = Math.hypot(dx, dy) || 1;
  const retSpeed = 1650;
  spear.vel.x = (dx / d) * retSpeed;
  spear.vel.y = (dy / d) * retSpeed;
  spear.angle = Math.atan2(dy, dx);
}

// ============================================================================
// Shield of Chaos: Bull Rush, Charged Shot & Behemoth Dragon Rush
// ============================================================================

function executeShieldBullRush(
  state: SimState,
  chargeFrac: number,
  angle: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const player = state.player;
  const tuning = getWeaponTuning('shield_of_chaos');
  const attackBoon = getBoonInSlot(player, 'attack');
  const rt = getWeaponRuntime(state);

  player.isBlocking = false;
  applyChaosActionCurse(state, 'take_damage_on_attack');

  state.events.push({
    type: 'attack_swing',
    weaponId: 'shield_of_chaos',
    pos: { x: player.pos.x, y: player.pos.y },
    angle,
    comboStep: 1,
    isDashStrike: false,
  });

  // Hammer: Charged Shot fires piercing 80-damage wave instead of dashing
  if (hasHammer(player, 'hammer_shield_charged_shot')) {
    const speed = 1350;
    const waveDmg = Math.round(50 + 30 * chargeFrac); // up to 80
    ctx.spawnProjectile(state, {
      owner: 'player',
      ownerId: 'player',
      kind: 'wave',
      pos: { x: player.pos.x + Math.cos(angle) * 28, y: player.pos.y + Math.sin(angle) * 28 },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      startPos: { x: player.pos.x, y: player.pos.y },
      radius: 42,
      angle,
      damage: waveDmg,
      range: 720,
      maxLife: 0.7,
      pierceLeft: 14,
      bouncesLeft: 0,
      deflectable: false,
      deflected: false,
      homingStrength: 0,
      isLob: false,
      lobHeight: 0,
      lobDuration: 0,
      lobElapsed: 0,
      patronId: attackBoon?.patronId,
      statusToApply: attackBoon?.statusEffect,
      colorHex: attackBoon ? PATRON_CONSTANTS[attackBoon.patronId].colorHex : '#F5C969',
    });
    if (player.aspectId === 'shield_abyss') {
      rt.abyssExtraShields = getAspectRank(state.meta.aspectRanks, 'shield_abyss');
    }
    return;
  }

  // Standard Bull Rush forward dash-charge smashing enemies for 4..40 dmg, kb 2200
  const minD = tuning.bullRushMinDamage ?? 4;
  const maxD = tuning.bullRushMaxDamage ?? 40;
  const rushDmg = Math.round(minD + (maxD - minD) * chargeFrac);
  const rushDist = 240 + 320 * chargeFrac;
  const kb = tuning.bullRushImpactVelocity ?? 2200;

  const startPos: Vec2 = { x: player.pos.x, y: player.pos.y };
  const dest: Vec2 = {
    x: startPos.x + Math.cos(angle) * rushDist,
    y: startPos.y + Math.sin(angle) * rushDist,
  };

  // Sweep hero cleanly across pits and shatter urns
  resolveHeroCollision(state, dest, true);
  breakUrnsInCone(state, startPos, angle, rushDist + 40, 65);
  resolveHeroCollision(state, player.pos, false);

  if (attackBoon?.patronId === 'aegira') {
    deflectProjectiles(state, startPos, rushDist + 40, angle, 70);
  }

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0 || e.aiState === 'dead') continue;
    const dx = e.pos.x - startPos.x;
    const dy = e.pos.y - startPos.y;
    if (
      isInEllipticalCone(dx, dy, angle, rushDist + e.radius + 32, 64) ||
      ellipseDistance(e.pos.x - player.pos.x, e.pos.y - player.pos.y) <= 95 + e.radius
    ) {
      const dealt = ctx.dealDamageToEnemy(state, e, {
        baseDamage: rushDmg,
        source: 'attack',
        angle,
        knockback: kb,
        patronId: attackBoon?.patronId,
        statusId: attackBoon?.statusEffect,
      });
      if (dealt > 0) notifyAttackHit(state, e, 'attack', dealt, ctx, hooks);
    }
  }

  // Aspect of the Abyss (shield_abyss): next Special throws up to +5 extra shields!
  if (player.aspectId === 'shield_abyss') {
    rt.abyssExtraShields = getAspectRank(state.meta.aspectRanks, 'shield_abyss');
  }

  // Aspect of the Behemoth (shield_behemoth): Dragon Rush detonates loaded Bloodstones!
  if (player.aspectId === 'shield_behemoth' && rt.loadedCasts > 0) {
    const count = rt.loadedCasts;
    rt.loadedCasts = 0;
    const castBoon = getBoonInSlot(player, 'cast');
    const rank = getAspectRank(state.meta.aspectRanks, 'shield_behemoth');
    const bonusMult = 1 + getAspectBonus('shield_behemoth', rank);
    const baseCast =
      castBoon && castBoon.scaledValue >= 10 ? castBoon.scaledValue : PLAYER_CONSTANTS.castDamage;
    const blastDmg = Math.round(baseCast * count * bonusMult);
    const blastRadius = 260;

    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.hp <= 0 || e.aiState === 'dead') continue;
      if (ellipseDistance(e.pos.x - player.pos.x, e.pos.y - player.pos.y) <= blastRadius + e.radius) {
        const dealt = ctx.dealDamageToEnemy(state, e, {
          baseDamage: blastDmg,
          source: 'cast',
          knockback: 1400,
          patronId: castBoon?.patronId,
          statusId: castBoon?.statusEffect,
        });
        if (dealt > 0) notifyAttackHit(state, e, 'cast', dealt, ctx, hooks);
      }
    }

    // Drop consumed Bloodstones nearby for retrieval
    if (state.meta.mirrorActiveSide.infernal_soul !== 'b') {
      for (let c = 0; c < count; c++) {
        const a = nextFloat(state) * Math.PI * 2;
        state.room.bloodstones.push({
          id: `bs_${state.tick}_${nextInt(state, 0, 999999)}`,
          pos: { x: player.pos.x, y: player.pos.y },
          vel: { x: Math.cos(a) * 140, y: Math.sin(a) * 140 * SIM_CONSTANTS.isoScaleY },
          life: 0,
          magnetizing: false,
        });
      }
    }

    spawnFloatingNumber(state, player.pos, `DRAGON RUSH x${count}!`, 'crit', '#C86BFF');
    addCameraShake(state, 11.0, 0.24);
  } else {
    addCameraShake(state, 6.5, 0.14);
  }

  state.events.push({
    type: 'dash',
    pos: startPos,
    endPos: { x: player.pos.x, y: player.pos.y },
    angle,
    perfect: false,
  });
}

// ============================================================================
// Weapon Specials (All 6 Arms + 24 Aspects + 36 Hammers)
// ============================================================================

function executeWeaponSpecial(
  state: SimState,
  angle: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
  opts?: { isDashSpecial?: boolean; spearChargeFrac?: number },
): void {
  const player = state.player;
  const def = getWeaponDef(player.weaponId);
  const tuning = getWeaponTuning(player.weaponId);
  const specialBoon = getBoonInSlot(player, 'special');
  const rt = getWeaponRuntime(state);

  applyChaosActionCurse(state, 'take_damage_on_special');

  state.events.push({
    type: 'special_cast',
    weaponId: player.weaponId,
    pos: { x: player.pos.x, y: player.pos.y },
    angle,
  });

  switch (player.weaponId) {
    case 'stygian_blade': {
      let radius = def.specialRadius; // 380
      let dmg = def.specialDamage; // 50
      if (hasHammer(player, 'hammer_blade_super_nova')) {
        radius = Math.round(radius * 1.25); // 475
        dmg = Math.round(dmg * 1.2); // 60
      }

      breakUrnsInEllipse(state, player.pos, radius, tuning.specialScaleY);
      if (specialBoon?.patronId === 'aegira') {
        deflectProjectiles(state, player.pos, radius, 0, 360, tuning.specialScaleY);
      }

      for (let i = 0; i < state.enemies.length; i++) {
        const e = state.enemies[i];
        if (e.hp <= 0 || e.aiState === 'dead') continue;
        const dx = e.pos.x - player.pos.x;
        const dy = e.pos.y - player.pos.y;
        if (ellipseDistance(dx, dy, tuning.specialScaleY) > radius + e.radius) continue;

        const outAngle = Math.atan2(dy, dx);
        const dealt = ctx.dealDamageToEnemy(state, e, {
          baseDamage: dmg,
          source: 'special',
          angle: outAngle,
          knockback: tuning.specialImpactVelocity, // 1500
          patronId: specialBoon?.patronId,
          statusId: specialBoon?.statusEffect,
        });

        if (player.aspectId === 'blade_maelstrom' && e.lodgedCasts > 0) {
          dropLodgedBloodstones(state, e);
        }

        if (dealt > 0) {
          notifyAttackHit(state, e, 'special', dealt, ctx, hooks);
        }
      }

      if (player.aspectId === 'blade_vengeance') {
        player.eruptBuffTimer = Math.max(player.eruptBuffTimer, 3.0);
      }

      // Aspect of the Paladin: Hallowed Ground (consecrated_aura)
      if (player.aspectId === 'blade_paladin') {
        // Replace existing Hallowed Ground so at most 1 aura is active cleanly
        for (let i = state.room.hazards.length - 1; i >= 0; i--) {
          if (state.room.hazards[i].kind === 'consecrated_aura') {
            state.room.hazards.splice(i, 1);
          }
        }
        state.room.hazards.push({
          id: `aura_${state.tick}_${nextInt(state, 0, 999999)}`,
          kind: 'consecrated_aura',
          pos: { x: player.pos.x, y: player.pos.y },
          radius: 300,
          active: true,
          armed: true,
          timer: 8.0,
          cooldown: 0,
          damage: 0,
          owner: 'player',
        });
      }

      addCameraShake(state, 7.5, 0.16);
      state.events.push({ type: 'rumble', weak: 0.4, strong: 0.65, durationMs: 110 });
      break;
    }

    case 'eternal_spear': {
      let speed = def.specialProjectileSpeed ?? 1450;
      let range = def.specialRange; // 880
      let dmg = def.specialDamage; // 25
      if (player.aspectId === 'spear_scion') {
        const bonus = getAspectBonus('spear_scion', getAspectRank(state.meta.aspectRanks, 'spear_scion'));
        dmg = Math.round(dmg * (1 + bonus));
        range = Math.round(range * (1 + bonus));
        speed = Math.round(speed * (1 + bonus));
      }
      if (hasHammer(player, 'hammer_spear_charged_skewer') && opts?.spearChargeFrac) {
        dmg = Math.round(dmg * (1 + 2.0 * Math.min(1, opts.spearChargeFrac))); // up to +200%
      }

      const isExplosive = hasHammer(player, 'hammer_spear_exploding_launcher');
      player.spearOut = !isExplosive;

      ctx.spawnProjectile(state, {
        owner: 'player',
        ownerId: 'player',
        kind: 'spear',
        pos: { x: player.pos.x, y: player.pos.y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        startPos: { x: player.pos.x, y: player.pos.y },
        radius: 26,
        angle,
        damage: isExplosive ? 50 : dmg,
        range,
        maxLife: isExplosive ? 0.9 : 8.5,
        pierceLeft: isExplosive ? 0 : 12,
        bouncesLeft: 0,
        deflectable: false,
        deflected: false,
        homingStrength: 0,
        isLob: false,
        lobHeight: 0,
        lobDuration: 0,
        lobElapsed: 0,
        aoeRadius: isExplosive ? 190 : undefined,
        patronId: specialBoon?.patronId,
        statusToApply: specialBoon?.statusEffect,
        returning: false,
        colorHex: specialBoon ? PATRON_CONSTANTS[specialBoon.patronId].colorHex : '#E8F6FF',
      });
      break;
    }

    case 'shield_of_chaos': {
      // Aspect of the Storm Disc (shield_thunder): lingering pulsing Blitz Disc!
      if (player.aspectId === 'shield_thunder') {
        const rank = getAspectRank(state.meta.aspectRanks, 'shield_thunder');
        const pulseDmg = Math.round(30 * (1 + getAspectBonus('shield_thunder', rank)));
        player.shieldOut = true;
        rt.blitzDiscPulseTimer = 0.08;
        ctx.spawnProjectile(state, {
          owner: 'player',
          ownerId: 'player',
          kind: 'shield',
          pos: { x: player.pos.x + Math.cos(angle) * 28, y: player.pos.y + Math.sin(angle) * 28 },
          vel: { x: Math.cos(angle) * 440, y: Math.sin(angle) * 440 },
          startPos: { x: player.pos.x, y: player.pos.y },
          radius: 44,
          angle,
          damage: pulseDmg,
          range: 460,
          maxLife: 8.0,
          pierceLeft: BLITZ_DISC_PIERCE_SENTINEL + 10,
          bouncesLeft: 0,
          deflectable: false,
          deflected: false,
          homingStrength: 0,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          patronId: specialBoon?.patronId,
          statusToApply: specialBoon?.statusEffect,
          returning: false,
          colorHex: specialBoon ? PATRON_CONSTANTS[specialBoon.patronId].colorHex : '#FFFA40',
        });
        break;
      }

      // Standard Rebound Throw (+ up to 5 extra shields from Aspect of the Abyss!)
      const speed = def.specialProjectileSpeed ?? 1200;
      const bounces = (def.specialBounces ?? 2) + (hasHammer(player, 'hammer_shield_dread_flight') ? 4 : 0);
      const extraCount = player.aspectId === 'shield_abyss' ? rt.abyssExtraShields : 0;
      rt.abyssExtraShields = 0;
      const totalShields = 1 + extraCount;
      player.shieldOut = true;

      for (let sIdx = 0; sIdx < totalShields; sIdx++) {
        const spread = totalShields > 1 ? ((sIdx / (totalShields - 1)) - 0.5) * 0.72 : 0;
        const a = normalizeAngle(angle + spread);
        ctx.spawnProjectile(state, {
          owner: 'player',
          ownerId: 'player',
          kind: 'shield',
          pos: { x: player.pos.x, y: player.pos.y },
          vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
          startPos: { x: player.pos.x, y: player.pos.y },
          radius: 34,
          angle: a,
          damage: def.specialDamage,
          range: def.specialRange,
          maxLife: 2.2,
          pierceLeft: 0,
          bouncesLeft: bounces,
          deflectable: false,
          deflected: false,
          homingStrength: 0,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          patronId: specialBoon?.patronId,
          statusToApply: specialBoon?.statusEffect,
          returning: false,
          colorHex: specialBoon ? PATRON_CONSTANTS[specialBoon.patronId].colorHex : '#F5C969',
        });
      }
      break;
    }

    case 'heart_seeking_bow': {
      let count = def.specialHits; // 9 arrows
      if (player.aspectId === 'bow_tracker') {
        const rank = getAspectRank(state.meta.aspectRanks, 'bow_tracker');
        count = 4 + Math.round(getAspectBonus('bow_tracker', rank)); // 5..9 seeking arrows
      }
      if (hasHammer(player, 'hammer_bow_relentless_volley')) {
        count += 4;
      }

      const spreadRad = (56 * Math.PI) / 180;
      const speed = def.specialProjectileSpeed ?? 1500;
      const homing = player.aspectId === 'bow_tracker' ? 12.0 : 0;

      for (let i = 0; i < count; i++) {
        const frac = count > 1 ? i / (count - 1) - 0.5 : 0;
        const a = normalizeAngle(angle + frac * spreadRad);
        ctx.spawnProjectile(state, {
          owner: 'player',
          ownerId: 'player_special',
          kind: 'arrow',
          pos: { x: player.pos.x, y: player.pos.y },
          vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
          startPos: { x: player.pos.x, y: player.pos.y },
          radius: 16,
          angle: a,
          damage: def.specialDamage,
          range: def.specialRange,
          maxLife: 1.1,
          pierceLeft: player.aspectId === 'bow_celestial' ? 2 : 0,
          bouncesLeft: 0,
          deflectable: false,
          deflected: false,
          homingStrength: homing,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          patronId: specialBoon?.patronId,
          statusToApply: specialBoon?.statusEffect,
          colorHex: specialBoon ? PATRON_CONSTANTS[specialBoon.patronId].colorHex : '#9EFF7A',
        });
      }
      break;
    }

    case 'twin_fists': {
      // Aspect of the Magnet (fists_magnet): pull enemies into melee range & apply Attack/Cast vulnerability!
      if (player.aspectId === 'fists_magnet') {
        for (let i = 0; i < state.enemies.length; i++) {
          const e = state.enemies[i];
          if (e.hp <= 0 || e.aiState === 'dead') continue;
          const dx = e.pos.x - player.pos.x;
          const dy = e.pos.y - player.pos.y;
          if (!isInEllipticalCone(dx, dy, angle, 420 + e.radius, 80)) continue;
          if (!e.isBoss && e.archetype !== 'rattlebones_dummy') {
            const targetDist = 72;
            const d = Math.hypot(dx, dy);
            if (d > targetDist) {
              const pull = d - targetDist;
              e.pos.x -= (dx / d) * pull * 0.8;
              e.pos.y -= (dy / d) * pull * 0.8;
            }
          }
          rt.magneticPullTargets.set(e.id, 5.0);
          spawnFloatingNumber(state, e.pos, 'PULLED!', 'status', '#78E2FF');
        }
      }

      // Aspect of the Tempest (fists_cutter): after 12 Attacks, next Special strikes +rank (up to +5) extra times!
      let extraCutterHits = 0;
      if (player.aspectId === 'fists_cutter' && rt.fistsCutterHits >= 12) {
        extraCutterHits = Math.round(
          getAspectBonus('fists_cutter', getAspectRank(state.meta.aspectRanks, 'fists_cutter')),
        );
        rt.fistsCutterHits = 0;
        player.consecutiveHits = 0;
        spawnFloatingNumber(state, player.pos, `GIGA CUTTER +${extraCutterHits}!`, 'crit', '#FFE03B');
      }

      // Hammer: Kinetic Launcher turns Special into a ranged 50-dmg blast
      if (hasHammer(player, 'hammer_fists_kinetic_launcher')) {
        const shots = 1 + extraCutterHits;
        const speed = 1450;
        for (let s = 0; s < shots; s++) {
          const spread = shots > 1 ? ((s / (shots - 1)) - 0.5) * 0.3 : 0;
          const a = normalizeAngle(angle + spread);
          ctx.spawnProjectile(state, {
            owner: 'player',
            ownerId: 'player_special',
            kind: 'wave',
            pos: { x: player.pos.x + Math.cos(a) * 24, y: player.pos.y + Math.sin(a) * 24 },
            vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
            startPos: { x: player.pos.x, y: player.pos.y },
            radius: 26,
            angle: a,
            damage: 50,
            range: 650,
            maxLife: 0.65,
            pierceLeft: 2,
            bouncesLeft: 0,
            deflectable: false,
            deflected: false,
            homingStrength: 0,
            isLob: false,
            lobHeight: 0,
            lobDuration: 0,
            lobElapsed: 0,
            patronId: specialBoon?.patronId,
            statusToApply: opts?.isDashSpecial && player.aspectId === 'fists_feral' ? 'maim' : specialBoon?.statusEffect,
            colorHex: specialBoon ? PATRON_CONSTANTS[specialBoon.patronId].colorHex : '#FF7733',
          });
        }
      } else {
        const isDashSpec = Boolean(opts?.isDashSpecial);
        const dmg = isDashSpec ? (tuning.dashSpecialDamage ?? 45) : def.specialDamage;
        const rng = isDashSpec ? (tuning.dashSpecialRange ?? 175) : def.specialRange;
        const hits = (isDashSpec ? 1 : def.specialHits) + extraCutterHits;
        const selfV = isDashSpec ? (tuning.dashSpecialSelfVelocity ?? 520) : tuning.specialSelfVelocity;

        player.vel.x = Math.cos(angle) * selfV;
        player.vel.y = Math.sin(angle) * selfV;

        performMeleeConeStrike(
          state,
          angle,
          dmg,
          rng,
          135,
          player.aspectId === 'fists_magnet' ? 120 : tuning.specialImpactVelocity,
          'special',
          {
            comboStep: 0,
            multiHits: hits,
            applyMaim: player.aspectId === 'fists_feral',
          },
          ctx,
          hooks,
        );
      }

      // Hammer: Quake Cutter radial 90-damage shockwave around Prince Pyreus
      if (hasHammer(player, 'hammer_fists_quake_cutter')) {
        for (let i = 0; i < state.enemies.length; i++) {
          const e = state.enemies[i];
          if (e.hp <= 0 || e.aiState === 'dead') continue;
          if (ellipseDistance(e.pos.x - player.pos.x, e.pos.y - player.pos.y) <= 240 + e.radius) {
            ctx.dealDamageToEnemy(state, e, { baseDamage: 90, source: 'special', knockback: 1000 });
          }
        }
        addCameraShake(state, 7.0, 0.16);
      }
      break;
    }

    case 'adamant_rail': {
      // Aspect of the Hellfire (rail_beam): deploy up to 3 pulsing Hellfire Mines!
      if (player.aspectId === 'rail_beam') {
        const existingMines = state.room.hazards.filter(
          (hz) => hz.kind === 'pylon' && hz.owner === 'player',
        );
        if (existingMines.length >= 3) {
          const oldestIdx = state.room.hazards.indexOf(existingMines[0]);
          if (oldestIdx !== -1) state.room.hazards.splice(oldestIdx, 1);
        }
        const dist = 260;
        const mx = Math.max(
          state.room.bounds.minX + 48,
          Math.min(state.room.bounds.maxX - 48, player.pos.x + Math.cos(angle) * dist),
        );
        const my = Math.max(
          state.room.bounds.minY + 48,
          Math.min(state.room.bounds.maxY - 48, player.pos.y + Math.sin(angle) * dist),
        );
        state.room.hazards.push({
          id: `mine_${state.tick}_${nextInt(state, 0, 999999)}`,
          kind: 'pylon',
          pos: { x: mx, y: my },
          radius: 36,
          active: true,
          armed: true,
          timer: 12.0,
          cooldown: 0.4,
          damage: 20,
          owner: 'player',
          hp: 1,
        });
        break;
      }

      const isRocket = hasHammer(player, 'hammer_rail_rocket_bomb');
      const isCluster = hasHammer(player, 'hammer_rail_cluster_bomb');
      const isHazard = hasHammer(player, 'hammer_rail_hazard_bomb');

      if (isRocket) {
        const speed = 1600;
        ctx.spawnProjectile(state, {
          owner: 'player',
          ownerId: 'player',
          kind: 'bomb',
          pos: { x: player.pos.x, y: player.pos.y },
          vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          startPos: { x: player.pos.x, y: player.pos.y },
          radius: 22,
          angle,
          damage: isHazard ? 320 : 80,
          range: 920,
          maxLife: 1.0,
          pierceLeft: 0,
          bouncesLeft: 0,
          deflectable: false,
          deflected: false,
          homingStrength: 0,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          aoeRadius: 240,
          patronId: specialBoon?.patronId,
          statusToApply: specialBoon?.statusEffect,
          colorHex: specialBoon ? PATRON_CONSTANTS[specialBoon.patronId].colorHex : '#FF8438',
        });
      } else {
        const bombCount = isCluster ? 5 : 1;
        const baseDmg = isHazard
          ? def.specialDamage * 4
          : isCluster
            ? Math.round(def.specialDamage * 0.7)
            : def.specialDamage;
        const aoeRadius = isHazard ? Math.round(def.specialRadius * 1.25) : def.specialRadius; // 400 base

        for (let b = 0; b < bombCount; b++) {
          const offsetAngle = bombCount > 1 ? (b - 2) * 0.22 : 0;
          const dist = Math.min(def.specialRange, 420);
          const tx = Math.max(
            state.room.bounds.minX + 40,
            Math.min(state.room.bounds.maxX - 40, player.pos.x + Math.cos(angle + offsetAngle) * dist),
          );
          const ty = Math.max(
            state.room.bounds.minY + 40,
            Math.min(state.room.bounds.maxY - 40, player.pos.y + Math.sin(angle + offsetAngle) * dist),
          );
          const lobDur = def.specialLobTime ?? 0.55;
          ctx.spawnProjectile(state, {
            owner: 'player',
            ownerId: 'player',
            kind: 'bomb',
            pos: { x: player.pos.x, y: player.pos.y },
            vel: { x: 0, y: 0 },
            startPos: { x: player.pos.x, y: player.pos.y },
            radius: 24,
            angle: angle + offsetAngle,
            damage: baseDmg,
            range: def.specialRange,
            maxLife: lobDur + 0.1,
            pierceLeft: 0,
            bouncesLeft: 0,
            deflectable: false,
            deflected: false,
            homingStrength: 0,
            isLob: true,
            lobHeight: 170,
            lobDuration: lobDur,
            lobElapsed: 0,
            targetPos: { x: tx, y: ty },
            aoeRadius,
            patronId: specialBoon?.patronId,
            statusToApply: specialBoon?.statusEffect,
            colorHex: specialBoon ? PATRON_CONSTANTS[specialBoon.patronId].colorHex : '#FF7733',
          });
        }
      }
      break;
    }
  }
}

// ============================================================================
// Bloodstone Cast & Cast-Loading Aspects (bow_loaded / shield_behemoth)
// ============================================================================

function fireBloodstoneCast(state: SimState, angle: number, ctx: SimCombatContext): void {
  const player = state.player;
  const castBoon = getBoonInSlot(player, 'cast');

  player.castAmmo = Math.max(0, player.castAmmo - 1);
  player.castCooldown = PLAYER_CONSTANTS.castCooldown;

  if (state.meta.mirrorActiveSide.infernal_soul === 'b' && player.castRegenTimer <= 0) {
    const rank = state.meta.mirrorRanks.infernal_soul ?? 0;
    player.castRegenTimer = Math.max(1.0, 3.0 - rank);
  }

  player.vel.x += Math.cos(angle) * PLAYER_CONSTANTS.castSelfVelocity;
  player.vel.y += Math.sin(angle) * PLAYER_CONSTANTS.castSelfVelocity;

  applyChaosActionCurse(state, 'take_damage_on_cast');

  let damage: number = PLAYER_CONSTANTS.castDamage; // 50
  let speed: number = PLAYER_CONSTANTS.castSpeed; // 900
  let range: number = PLAYER_CONSTANTS.castRange; // 1100
  let aoeRadius: number | undefined;
  let bouncesLeft = 0;
  let homingStrength = 1.6;
  let radius = 18;
  let colorHex = '#FF3355';

  if (castBoon) {
    colorHex = PATRON_CONSTANTS[castBoon.patronId].colorHex;
    if (castBoon.scaledValue >= 10) {
      damage = Math.round(castBoon.scaledValue);
    }
    switch (castBoon.patronId) {
      case 'voltaris':
        speed = 1150;
        bouncesLeft = 3;
        break;
      case 'tidebreaker':
        aoeRadius = 190;
        radius = 24;
        break;
      case 'aegira':
        aoeRadius = 150;
        radius = 24;
        deflectProjectiles(state, player.pos, 180, angle, 90);
        break;
      case 'velouris':
        range = 360;
        aoeRadius = 175;
        speed = 1050;
        damage = Math.round(damage * 1.5);
        break;
      case 'sylvara':
        speed = 1350;
        homingStrength = 6.5;
        break;
      default:
        break;
    }
  }

  ctx.spawnProjectile(state, {
    owner: 'player',
    ownerId: 'player',
    kind: 'cast',
    pos: { x: player.pos.x + Math.cos(angle) * 26, y: player.pos.y + Math.sin(angle) * 26 },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    startPos: { x: player.pos.x, y: player.pos.y },
    radius,
    angle,
    damage,
    range,
    maxLife: range / speed + 0.15,
    pierceLeft: 0,
    bouncesLeft,
    deflectable: false,
    deflected: false,
    homingStrength,
    isLob: false,
    lobHeight: 0,
    lobDuration: 0,
    lobElapsed: 0,
    aoeRadius,
    patronId: castBoon?.patronId,
    statusToApply: castBoon?.statusEffect,
    critBonus: castBoon?.patronId === 'sylvara' ? 0.1 : 0,
    lodgesCast: true,
    colorHex,
  });

  state.events.push({
    type: 'bloodstone_fired',
    pos: { x: player.pos.x, y: player.pos.y },
    angle,
    patronId: castBoon?.patronId,
  });
}

// ============================================================================
// God Call
// ============================================================================

function triggerGodCall(
  state: SimState,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const player = state.player;
  const callBoon: BoonInstance | undefined = getBoonInSlot(player, 'call');
  if (!callBoon || player.godGauge < 25) return;

  const greater = player.godGauge >= PLAYER_CONSTANTS.godGaugeMax;
  const patronId: PatronId = callBoon.patronId;

  if (greater) {
    player.godGauge = 0;
    player.greaterCallSlowTimer = PLAYER_CONSTANTS.greaterCallSlowDuration;
    player.godCallActiveTimer = 4.5;
    addCameraShake(state, 13.0, 0.35);
    triggerHitstop(state, 0.06, PLAYER_CONSTANTS.greaterCallSlowScale);
  } else {
    player.godGauge = Math.max(0, player.godGauge - 25);
    player.godCallActiveTimer = 1.6;
    addCameraShake(state, 7.5, 0.2);
  }

  player.godCallPatron = patronId;
  spawnFloatingNumber(
    state,
    player.pos,
    greater
      ? `${PATRON_CONSTANTS[patronId].displayName.toUpperCase()} GREATER CALL!`
      : `${PATRON_CONSTANTS[patronId].displayName.toUpperCase()} AID!`,
    'crit',
    PATRON_CONSTANTS[patronId].colorHex,
  );

  state.events.push({
    type: 'god_call',
    patronId,
    greater,
    pos: { x: player.pos.x, y: player.pos.y },
  });

  if (hooks?.onPlayerGodCall) {
    hooks.onPlayerGodCall(state, patronId, greater, ctx);
    return;
  }

  const baseDmg = greater ? 260 : 95;
  const radius = greater ? 620 : 380;
  if (patronId === 'aegira') {
    deflectProjectiles(state, player.pos, radius, 0, 360);
  }
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (e.hp <= 0 || e.aiState === 'dead') continue;
    if (ellipseDistance(e.pos.x - player.pos.x, e.pos.y - player.pos.y) <= radius + e.radius) {
      ctx.dealDamageToEnemy(state, e, {
        baseDamage: baseDmg,
        source: 'call',
        knockback: patronId === 'tidebreaker' ? 2200 : 800,
        patronId,
        statusId: PATRON_CONSTANTS[patronId].primaryStatus ?? undefined,
      });
    }
  }
}

// ============================================================================
// Heart-Seeking Bow & Adamant Rail Firing Helpers
// ============================================================================

function fireBowArrow(
  state: SimState,
  angle: number,
  damage: number,
  bonusCrit: number,
  isDashStrike: boolean,
  isPowerShot: boolean,
  ctx: SimCombatContext,
): void {
  const player = state.player;
  const def = WEAPON_CONSTANTS.heart_seeking_bow;
  const attackBoon = getBoonInSlot(player, 'attack');
  const rt = getWeaponRuntime(state);
  const speed = def.attackProjectileSpeed ?? 1850;
  const isTwin = hasHammer(player, 'hammer_bow_twin_shot');
  const isExplosive = hasHammer(player, 'hammer_bow_explosive_shot');
  const arrows = isTwin ? 2 : 1;

  // Aspect of the Vessel (bow_loaded): attach loaded Bloodstones to primary arrow!
  const loadedCount = player.aspectId === 'bow_loaded' ? rt.loadedCasts : 0;
  if (loadedCount > 0) {
    rt.loadedCasts = 0;
  }

  applyChaosActionCurse(state, 'take_damage_on_attack');
  state.events.push({
    type: 'attack_swing',
    weaponId: 'heart_seeking_bow',
    pos: { x: player.pos.x, y: player.pos.y },
    angle,
    comboStep: isPowerShot ? 2 : 0,
    isDashStrike,
  });

  if (isPowerShot) {
    spawnFloatingNumber(state, { x: player.pos.x, y: player.pos.y - 26 }, 'POWER SHOT!', 'crit', '#FFE03B');
    addCameraShake(state, 5.0, 0.1);
  }

  for (let i = 0; i < arrows; i++) {
    const spread = arrows === 2 ? (i === 0 ? -0.05 : 0.05) : 0;
    const a = normalizeAngle(angle + spread);
    const carriesCast = i === 0 && loadedCount > 0;
    ctx.spawnProjectile(state, {
      owner: 'player',
      ownerId: 'player',
      kind: 'arrow',
      pos: { x: player.pos.x + Math.cos(a) * 24, y: player.pos.y + Math.sin(a) * 24 },
      vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
      startPos: { x: player.pos.x, y: player.pos.y },
      radius: carriesCast ? 22 : 16,
      angle: a,
      damage: isExplosive ? damage * 4 : damage,
      range: isTwin ? Math.round(def.attackRange * 0.75) : def.attackRange,
      maxLife: 1.0,
      pierceLeft: player.aspectId === 'bow_celestial' ? 8 : isPowerShot ? 3 : 1,
      bouncesLeft: 0,
      deflectable: false,
      deflected: false,
      homingStrength: 0,
      isLob: false,
      lobHeight: carriesCast ? loadedCount : 0,
      lobDuration: 0,
      lobElapsed: 0,
      aoeRadius: isExplosive ? 230 : undefined,
      patronId: attackBoon?.patronId,
      statusToApply: attackBoon?.statusEffect,
      critBonus: bonusCrit,
      lodgesCast: carriesCast,
      colorHex: isPowerShot
        ? '#FFE03B'
        : attackBoon
          ? PATRON_CONSTANTS[attackBoon.patronId].colorHex
          : '#7CFF5B',
    });
  }
}

function fireRailBullet(
  state: SimState,
  angle: number,
  ctx: SimCombatContext,
): void {
  const player = state.player;
  const def = WEAPON_CONSTANTS.adamant_rail;
  const attackBoon = getBoonInSlot(player, 'attack');
  const isSpread = hasHammer(player, 'hammer_rail_spread_fire');
  const pellets = isSpread ? 5 : 1;
  const speed = def.attackProjectileSpeed ?? 1750;
  let range = isSpread ? 340 : def.attackRange;
  let dmg = isSpread ? 40 : def.attackComboDamage[0];
  let pierce = 0;

  // Aspect of the Hearth (rail_sniper): manual reload empowers next shot up to 150 dmg w/ extended range!
  if (player.aspectId === 'rail_sniper' && player.empoweredAttacks > 0) {
    player.empoweredAttacks -= 1;
    const rank = getAspectRank(state.meta.aspectRanks, 'rail_sniper');
    dmg = Math.round(50 + getAspectBonus('rail_sniper', rank)); // 70..150 base dmg!
    range = Math.round(def.attackRange * 1.35);
    pierce = 3;
    spawnFloatingNumber(state, player.pos, 'SNIPER SHOT!', 'crit', '#FFE03B');
    addCameraShake(state, 6.0, 0.12);
  }

  applyChaosActionCurse(state, 'take_damage_on_attack');
  state.events.push({
    type: 'attack_swing',
    weaponId: 'adamant_rail',
    pos: { x: player.pos.x, y: player.pos.y },
    angle,
    comboStep: 0,
    isDashStrike: false,
  });

  for (let pIdx = 0; pIdx < pellets; pIdx++) {
    const spread = pellets > 1 ? (pIdx - 2) * 0.12 : 0;
    const a = normalizeAngle(angle + spread);
    ctx.spawnProjectile(state, {
      owner: 'player',
      ownerId: 'player',
      kind: 'bullet',
      pos: { x: player.pos.x + Math.cos(a) * 28, y: player.pos.y + Math.sin(a) * 28 },
      vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
      startPos: { x: player.pos.x, y: player.pos.y },
      radius: pierce > 0 ? 15 : 11,
      angle: a,
      damage: dmg,
      range,
      maxLife: range / speed + 0.05,
      pierceLeft: pierce,
      bouncesLeft: 0,
      deflectable: false,
      deflected: false,
      homingStrength: 0,
      isLob: false,
      lobHeight: 0,
      lobDuration: 0,
      lobElapsed: 0,
      patronId: attackBoon?.patronId,
      statusToApply: attackBoon?.statusEffect,
      colorHex: pierce > 0 ? '#FFE03B' : attackBoon ? PATRON_CONSTANTS[attackBoon.patronId].colorHex : '#FFC45E',
    });
  }
}

function fireRailBeamTick(
  state: SimState,
  angle: number,
  rampFrac: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const player = state.player;
  const attackBoon = getBoonInSlot(player, 'attack');
  const range = 700;
  // Ramps smoothly from 10 -> 20 -> 30 per tick as beam sustains!
  const beamDmg = Math.round(10 + 20 * rampFrac);

  // Check if beam strikes any player-owned Hellfire Mines (detonating them!)
  for (let hIdx = state.room.hazards.length - 1; hIdx >= 0; hIdx--) {
    const h = state.room.hazards[hIdx];
    if (h.kind === 'pylon' && h.owner === 'player' && h.active) {
      if (isInEllipticalCone(h.pos.x - player.pos.x, h.pos.y - player.pos.y, angle, range, 18)) {
        detonateHellfireMine(state, hIdx, ctx, hooks);
      }
    }
  }

  // Emit visual beam projectile pulse
  ctx.spawnProjectile(state, {
    owner: 'player',
    ownerId: 'player',
    kind: 'beam',
    pos: { x: player.pos.x + Math.cos(angle) * 32, y: player.pos.y + Math.sin(angle) * 32 },
    vel: { x: Math.cos(angle) * 2400, y: Math.sin(angle) * 2400 },
    startPos: { x: player.pos.x, y: player.pos.y },
    radius: 18,
    angle,
    damage: beamDmg,
    range,
    maxLife: 0.28,
    pierceLeft: 6,
    bouncesLeft: 0,
    deflectable: false,
    deflected: false,
    homingStrength: 0,
    isLob: false,
    lobHeight: 0,
    lobDuration: 0,
    lobElapsed: 0,
    patronId: attackBoon?.patronId,
    statusToApply: attackBoon?.statusEffect,
    colorHex: attackBoon ? PATRON_CONSTANTS[attackBoon.patronId].colorHex : '#FF9440',
  });

  state.events.push({
    type: 'attack_swing',
    weaponId: 'adamant_rail',
    pos: { x: player.pos.x, y: player.pos.y },
    angle,
    comboStep: rampFrac >= 0.75 ? 2 : rampFrac >= 0.35 ? 1 : 0,
    isDashStrike: false,
  });
}

function syncWeaponMaxStats(state: SimState): void {
  const player = state.player;
  const rt = getWeaponRuntime(state);

  // Sync Cursed Slash -60% Max HP penalty if acquired mid-run
  if (hasHammer(player, 'hammer_blade_cursed_slash') && !rt.cursedSlashApplied) {
    rt.cursedSlashApplied = true;
    player.maxHp = Math.max(20, Math.round(player.maxHp * 0.4));
    player.hp = Math.min(player.hp, player.maxHp);
  }

  // Sync Adamant Rail dynamic clip capacity (rail_scion, flurry_fire, spread_fire)
  if (player.weaponId === 'adamant_rail') {
    const def = WEAPON_CONSTANTS.adamant_rail;
    let cap = hasHammer(player, 'hammer_rail_spread_fire') ? 6 : (def.clipSize ?? 12);
    if (player.aspectId === 'rail_scion') {
      const rank = getAspectRank(state.meta.aspectRanks, 'rail_scion');
      cap += Math.round(getAspectBonus('rail_scion', rank));
    }
    if (hasHammer(player, 'hammer_rail_flurry_fire')) {
      cap += 6;
    }
    if (player.maxAmmo !== cap) {
      const delta = cap - player.maxAmmo;
      player.maxAmmo = cap;
      if (delta > 0) {
        player.ammo = Math.min(cap, player.ammo + delta);
      } else {
        player.ammo = Math.min(cap, player.ammo);
      }
    }
  }
}

// ============================================================================
// Main Per-Tick Weapon Driver
// ============================================================================

export function stepPlayerWeapons(
  state: SimState,
  input: InputFrame,
  dt: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const player = state.player;
  if (player.isDead || dt <= 0) return;

  syncWeaponMaxStats(state);

  const rt = getWeaponRuntime(state);
  const aimAngle = computeAimAngle(state, input);
  const speedMult = computeAttackSpeedMultiplier(state);
  const def = getWeaponDef(player.weaponId);
  const tuning = getWeaponTuning(player.weaponId);

  // 1. Decay core timers
  if (player.attackTimer > 0) {
    player.attackTimer = Math.max(0, player.attackTimer - dt);
  }
  if (player.attackRecoveryTimer > 0) {
    player.attackRecoveryTimer = Math.max(0, player.attackRecoveryTimer - dt);
    if (player.attackRecoveryTimer === 0) {
      player.attackComboStep = 0;
    }
  }
  if (player.attackBufferTimer > 0) {
    player.attackBufferTimer = Math.max(0, player.attackBufferTimer - dt);
  }
  if (player.specialCooldown > 0) {
    player.specialCooldown = Math.max(0, player.specialCooldown - dt);
  }
  if (player.castCooldown > 0) {
    player.castCooldown = Math.max(0, player.castCooldown - dt);
  }

  // 2. God Call trigger
  if (input.callPressed && player.godGauge >= 25) {
    triggerGodCall(state, ctx, hooks);
  }

  // 3. Adamant Rail reload timer
  if (player.weaponId === 'adamant_rail') {
    if (player.reloadTimer > 0) {
      player.reloadTimer = Math.max(0, player.reloadTimer - dt);
      if (player.reloadTimer === 0) {
        player.ammo = player.maxAmmo;
        if (player.aspectId === 'rail_sniper') {
          player.empoweredAttacks = 1;
        }
      }
    } else if (
      input.reloadPressed &&
      player.ammo < player.maxAmmo &&
      !hasHammer(player, 'hammer_rail_delta_chamber')
    ) {
      player.reloadTimer = def.reloadTime ?? 0.75;
    }
  }

  // 4. Bloodstone Cast (or Load into Bow Vessel / Shield Behemoth!)
  const isCastLoaderAspect =
    player.aspectId === 'bow_loaded' || player.aspectId === 'shield_behemoth';

  if (isCastLoaderAspect) {
    if (input.castPressed && player.castAmmo > 0 && player.castCooldown <= 0) {
      player.castAmmo -= 1;
      rt.loadedCasts += 1;
      player.castCooldown = 0.1;
      if (state.meta.mirrorActiveSide.infernal_soul === 'b' && player.castRegenTimer <= 0) {
        const rank = state.meta.mirrorRanks.infernal_soul ?? 0;
        player.castRegenTimer = Math.max(1.0, 3.0 - rank);
      }
      spawnFloatingNumber(state, player.pos, `LOADED x${rt.loadedCasts}`, 'status', '#FF4D7A');
    }
  } else if (player.castChargeTimer > 0) {
    player.castChargeTimer = Math.max(0, player.castChargeTimer - dt);
    if (player.castChargeTimer === 0) {
      fireBloodstoneCast(state, player.facingAngle, ctx);
    }
  } else if (
    input.castPressed &&
    player.castAmmo > 0 &&
    player.castCooldown <= 0 &&
    player.dashTimer <= 0
  ) {
    player.facingAngle = rotateAngleToward(
      player.facingAngle,
      aimAngle,
      SIM_CONSTANTS.combatRotationSpeed,
      dt,
    );
    player.facingIdx = angleToFacingIdx(player.facingAngle);
    player.castChargeTimer = PLAYER_CONSTANTS.castChargeFrames * SIM_CONSTANTS.fixedDt;
  }

  // 5. Weapon Specials (including Twin Fists Dash-Special, Spear Charged Skewer & Recall, Shield Blitz Recall)
  if (player.weaponId === 'eternal_spear' && hasHammer(player, 'hammer_spear_charged_skewer') && !player.spearOut) {
    if (input.special && player.specialCooldown <= 0 && player.dashTimer <= 0) {
      rt.spearSpecialCharging = true;
      rt.spearSpecialHoldTimer = Math.min(0.65, rt.spearSpecialHoldTimer + dt);
      player.facingAngle = rotateAngleToward(player.facingAngle, aimAngle, SIM_CONSTANTS.combatRotationSpeed, dt);
      player.facingIdx = angleToFacingIdx(player.facingAngle);
    } else if (rt.spearSpecialCharging) {
      const frac = Math.min(1, rt.spearSpecialHoldTimer / 0.65);
      rt.spearSpecialCharging = false;
      rt.spearSpecialHoldTimer = 0;
      player.specialCooldown = def.specialCooldown;
      executeWeaponSpecial(state, player.facingAngle, ctx, hooks, { spearChargeFrac: frac });
    }
  } else if (
    player.weaponId === 'twin_fists' &&
    input.specialPressed &&
    player.specialCooldown <= 0 &&
    (player.dashTimer > 0 || player.dashStrikeWindowTimer > 0)
  ) {
    // Forward-lunging Twin Fists Dash-Special (ends dash i-frames early, inflicts Maim on fists_feral!)
    player.dashTimer = 0;
    player.dashStrikeWindowTimer = 0;
    player.attackTimer = 0;
    player.attackChargeTimer = 0;
    player.facingAngle = rotateAngleToward(player.facingAngle, aimAngle, SIM_CONSTANTS.combatRotationSpeed, dt);
    player.facingIdx = angleToFacingIdx(player.facingAngle);
    player.specialCooldown = def.specialCooldown;
    player.specialTimer = 0.14;
    executeWeaponSpecial(state, player.facingAngle, ctx, hooks, { isDashSpecial: true });
  } else if (player.specialTimer > 0) {
    const prev = player.specialTimer;
    player.specialTimer = Math.max(0, player.specialTimer - dt);
    const activeSplit = tuning.specialActiveSec;
    if (prev > activeSplit && player.specialTimer <= activeSplit) {
      executeWeaponSpecial(state, player.facingAngle, ctx, hooks);
    }
  } else if (
    input.specialPressed &&
    player.dashTimer <= 0 &&
    ((player.weaponId === 'eternal_spear' && player.spearOut) ||
      (player.weaponId === 'shield_of_chaos' && player.shieldOut && player.aspectId === 'shield_thunder'))
  ) {
    if (player.weaponId === 'eternal_spear' && player.spearOut) {
      executeSpearRecallOrVanguardRush(state, ctx, hooks);
      player.specialCooldown = Math.min(player.specialCooldown, 0.18);
    } else if (player.weaponId === 'shield_of_chaos' && player.shieldOut && player.aspectId === 'shield_thunder') {
      // Recall Blitz Disc immediately on re-press!
      for (let i = 0; i < state.projectiles.length; i++) {
        const pr = state.projectiles[i];
        if (pr.owner === 'player' && pr.kind === 'shield') {
          pr.returning = true;
          pr.hitIds = [];
        }
      }
      player.specialCooldown = Math.min(player.specialCooldown, 0.18);
    }
  } else if (
    input.specialPressed &&
    player.specialCooldown <= 0 &&
    player.dashTimer <= 0
  ) {
    if (player.weaponId === 'shield_of_chaos' && player.shieldOut) {
      // Wait for shield return
    } else {
      player.attackTimer = 0;
      player.attackChargeTimer = 0;
      player.isBlocking = false;
      rt.spearSpinCharging = false;
      rt.shieldBullCharging = false;
      player.facingAngle = rotateAngleToward(
        player.facingAngle,
        aimAngle,
        SIM_CONSTANTS.combatRotationSpeed,
        dt,
      );
      player.facingIdx = angleToFacingIdx(player.facingAngle);
      player.specialTimer = tuning.specialChargeSec + tuning.specialActiveSec;
      player.specialCooldown = def.specialCooldown;
    }
  }

  // 6. Heart-Seeking Bow: Hold-Attack Power Shot (10->60, 70 golden window, -35% dash charge!)
  if (player.weaponId === 'heart_seeking_bow') {
    const isFlurryBow = hasHammer(player, 'hammer_bow_flurry_shot');

    if (isFlurryBow) {
      if (input.attack && player.attackTimer <= 0) {
        if (player.dashTimer > 0) {
          player.dashTimer = 0;
          player.dashStrikeWindowTimer = 0;
        }
        player.facingAngle = normalizeAngle(aimAngle);
        player.facingIdx = angleToFacingIdx(player.facingAngle);
        fireBowArrow(state, player.facingAngle, 35, 0, false, false, ctx);
        player.attackTimer = 0.2 / speedMult;
      }
      return;
    }

    // Starting Bow draw during Dash / Dash-Strike window activates 35% faster Dash-Strike charge!
    if (input.attackPressed && (player.dashTimer > 0 || player.dashStrikeWindowTimer > 0)) {
      player.dashTimer = 0;
      player.dashStrikeWindowTimer = 0;
      rt.bowDashChargeActive = true;
      player.attackChargeTimer = SIM_CONSTANTS.fixedDt;
      player.facingAngle = normalizeAngle(aimAngle);
      player.facingIdx = angleToFacingIdx(player.facingAngle);
      // If user only tapped attackPressed for 1 frame without holding, fire quick Dash-Strike arrow next check
      if (!input.attack) {
        fireBowArrow(state, player.facingAngle, def.dashStrikeDamage, 0, true, false, ctx);
        player.attackChargeTimer = 0;
        rt.bowDashChargeActive = false;
        player.attackTimer = 0.16;
      }
      return;
    }

    if (input.attack && player.attackTimer <= 0 && player.dashTimer <= 0) {
      player.facingAngle = rotateAngleToward(
        player.facingAngle,
        aimAngle,
        SIM_CONSTANTS.combatRotationSpeed,
        dt,
      );
      player.facingIdx = angleToFacingIdx(player.facingAngle);

      let chargeDur = def.chargeDuration ?? 0.6;
      if (hasHammer(player, 'hammer_bow_explosive_shot')) chargeDur *= 1.45;
      if (player.aspectId === 'bow_celestial') chargeDur *= 1.25;
      if (rt.bowDashChargeActive) {
        chargeDur *= 1 - (tuning.bowDashChargeReduction ?? 0.35); // 35% faster!
      }

      player.attackChargeTimer = Math.min(chargeDur * 1.15, player.attackChargeTimer + dt * speedMult);
    } else if (player.attackChargeTimer > 0) {
      let chargeDur = def.chargeDuration ?? 0.6;
      if (hasHammer(player, 'hammer_bow_explosive_shot')) chargeDur *= 1.45;
      if (player.aspectId === 'bow_celestial') chargeDur *= 1.25;
      if (rt.bowDashChargeActive) {
        chargeDur *= 1 - (tuning.bowDashChargeReduction ?? 0.35);
      }

      const frac = Math.min(1.1, player.attackChargeTimer / chargeDur);
      const minPS = hasHammer(player, 'hammer_bow_perfect_shot')
        ? 0.65
        : (tuning.bowPowerShotMinFrac ?? 0.78);
      const maxPS = hasHammer(player, 'hammer_bow_perfect_shot')
        ? 1.1
        : (tuning.bowPowerShotMaxFrac ?? 0.98);
      const isPowerShot = frac >= minPS && frac <= maxPS;

      const minD = def.chargeMinDamage ?? 10;
      let maxD = player.aspectId === 'bow_celestial' ? 120 : (def.chargeMaxDamage ?? 60);
      let dmg = isPowerShot
        ? player.aspectId === 'bow_celestial'
          ? 145
          : (def.powerShotDamage ?? 70)
        : Math.round(minD + (maxD - minD) * Math.min(1, frac));

      if (isPowerShot && hasHammer(player, 'hammer_bow_perfect_shot')) {
        dmg = Math.round(dmg * 2.5); // +150%
      }

      fireBowArrow(
        state,
        player.facingAngle,
        dmg,
        isPowerShot ? 0.15 : 0,
        rt.bowDashChargeActive,
        isPowerShot,
        ctx,
      );
      player.attackChargeTimer = 0;
      rt.bowDashChargeActive = false;
      player.attackTimer = 0.16;
    }
    return;
  }

  // 7. Adamant Rail: 12-round full-auto, Delta Chamber 3-burst, Hellfire Ramping Beam
  if (player.weaponId === 'adamant_rail') {
    const infiniteAmmo = hasHammer(player, 'hammer_rail_delta_chamber');

    // Aspect of the Hellfire (rail_beam): continuous ramping beam while holding Attack
    if (player.aspectId === 'rail_beam') {
      if ((input.attack || input.attackPressed) && player.reloadTimer <= 0 && (player.ammo > 0 || infiniteAmmo)) {
        if (player.dashTimer > 0) {
          player.dashTimer = 0;
          player.dashStrikeWindowTimer = 0;
        }
        player.facingAngle = rotateAngleToward(player.facingAngle, aimAngle, SIM_CONSTANTS.combatRotationSpeed, dt);
        player.facingIdx = angleToFacingIdx(player.facingAngle);
        rt.railBeamRamp = Math.min(1, rt.railBeamRamp + dt * 0.65);
        rt.railBeamTickTimer -= dt;
        if (rt.railBeamTickTimer <= 0) {
          rt.railBeamTickTimer = 0.12 / speedMult;
          if (!infiniteAmmo) player.ammo = Math.max(0, player.ammo - 1);
          fireRailBeamTick(state, player.facingAngle, rt.railBeamRamp, ctx, hooks);
          if (!infiniteAmmo && player.ammo <= 0) {
            player.reloadTimer = def.reloadTime ?? 0.75;
            rt.railBeamRamp = 0;
          }
        }
      } else {
        rt.railBeamRamp = Math.max(0, rt.railBeamRamp - dt * 1.4);
        rt.railBeamTickTimer = 0;
      }
      return;
    }

    // Hammer: Delta Chamber 3-round burst follow-up shots
    if (rt.railBurstRemaining > 0) {
      rt.railBurstCooldown -= dt;
      if (rt.railBurstCooldown <= 0) {
        rt.railBurstRemaining -= 1;
        rt.railBurstCooldown = 0.06;
        player.facingAngle = normalizeAngle(aimAngle);
        player.facingIdx = angleToFacingIdx(player.facingAngle);
        fireRailBullet(state, player.facingAngle, ctx);
      }
      return;
    }

    if (
      (input.attack || input.attackPressed) &&
      player.attackTimer <= 0 &&
      player.reloadTimer <= 0
    ) {
      if (player.dashTimer > 0) {
        player.dashTimer = 0;
        player.dashStrikeWindowTimer = 0;
      }
      if (player.ammo > 0 || infiniteAmmo) {
        player.facingAngle = normalizeAngle(aimAngle);
        player.facingIdx = angleToFacingIdx(player.facingAngle);
        if (!infiniteAmmo) player.ammo -= 1;

        fireRailBullet(state, player.facingAngle, ctx);

        if (infiniteAmmo) {
          // Delta Chamber fires 3-round burst and never needs reload
          rt.railBurstRemaining = 2;
          rt.railBurstCooldown = 0.055;
          player.attackTimer = 0.28 / speedMult;
        } else {
          const baseInterval = hasHammer(player, 'hammer_rail_spread_fire') ? 0.28 : (def.fireInterval ?? 0.1);
          player.attackTimer = baseInterval / speedMult;
          if (player.ammo <= 0) {
            player.reloadTimer = def.reloadTime ?? 0.75;
          }
        }
      }
    }
    return;
  }

  // 8. Shield of Chaos: Hold-Attack Frontal Block + Bull Rush Charge -> Release!
  if (player.weaponId === 'shield_of_chaos') {
    // Dash-Strike takes immediate priority
    if (input.attackPressed && (player.dashTimer > 0 || player.dashStrikeWindowTimer > 0)) {
      player.dashTimer = 0;
      player.dashStrikeWindowTimer = 0;
      player.isBlocking = false;
      rt.shieldBullCharging = false;
      rt.shieldHoldTimer = 0;
      player.facingAngle = rotateAngleToward(player.facingAngle, aimAngle, SIM_CONSTANTS.combatRotationSpeed, dt);
      player.facingIdx = angleToFacingIdx(player.facingAngle);
      executeMeleeSwing(state, player.facingAngle, 0, true, ctx, hooks);
      player.attackTimer = tuning.dashStrike.recoverySec / speedMult;
      return;
    }

    const chargeDur = (def.chargeDuration ?? 0.8) * (hasHammer(player, 'hammer_shield_sudden_rush') ? 0.6 : 1.0);

    if (input.attack && player.dashTimer <= 0 && player.specialTimer <= 0 && player.attackTimer <= 0) {
      rt.shieldHoldTimer += dt * speedMult;
      player.facingAngle = rotateAngleToward(player.facingAngle, aimAngle, SIM_CONSTANTS.combatRotationSpeed, dt);
      player.facingIdx = angleToFacingIdx(player.facingAngle);

      if (rt.shieldHoldTimer >= 0.14) {
        rt.shieldBullCharging = true;
        player.isBlocking = true;
        player.attackChargeTimer = Math.min(chargeDur, rt.shieldHoldTimer - 0.14);
      }
      return;
    }

    if (rt.shieldBullCharging) {
      const frac = Math.min(1, player.attackChargeTimer / chargeDur);
      rt.shieldBullCharging = false;
      rt.shieldHoldTimer = 0;
      player.attackChargeTimer = 0;
      player.isBlocking = false;
      executeShieldBullRush(state, frac, player.facingAngle, ctx, hooks);
      player.attackTimer = 0.18;
      return;
    }

    if (rt.shieldHoldTimer > 0 && !input.attack) {
      // Quick tap -> Shield Bash (25 dmg, r160, kb 2500!)
      rt.shieldHoldTimer = 0;
      player.isBlocking = false;
      executeMeleeSwing(state, player.facingAngle, 0, false, ctx, hooks);
      player.attackTimer = tuning.comboStages[0].recoverySec / speedMult;
      return;
    }

    player.isBlocking = false;
    return;
  }

  // 9. Eternal Spear: Hold-Attack 3-Tier Spin Charge (disabled by Flurry Jab) + 3-Hit Thrust + Wide Dash-Strike
  if (player.weaponId === 'eternal_spear') {
    const flurryJab = hasHammer(player, 'hammer_spear_flurry_jab');

    if (input.attackPressed && (player.dashTimer > 0 || player.dashStrikeWindowTimer > 0)) {
      player.dashTimer = 0;
      player.dashStrikeWindowTimer = 0;
      rt.spearSpinCharging = false;
      rt.spearHoldTimer = 0;
      player.attackChargeTimer = 0;
      player.facingAngle = rotateAngleToward(player.facingAngle, aimAngle, SIM_CONSTANTS.combatRotationSpeed, dt);
      player.facingIdx = angleToFacingIdx(player.facingAngle);
      executeMeleeSwing(state, player.facingAngle, 0, true, ctx, hooks);
      player.attackTimer = tuning.dashStrike.recoverySec / speedMult;
      player.attackRecoveryTimer = player.attackTimer + tuning.dashStrike.comboWindowSec;
      player.attackComboStep = 1;
      return;
    }

    if (!flurryJab) {
      const spinDur =
        (def.chargeDuration ?? 0.75) * (hasHammer(player, 'hammer_spear_quick_spin') ? 0.5 : 1.0);

      if (input.attack && player.dashTimer <= 0 && player.specialTimer <= 0 && player.attackTimer <= 0) {
        rt.spearHoldTimer += dt * speedMult;
        player.facingAngle = rotateAngleToward(player.facingAngle, aimAngle, SIM_CONSTANTS.combatRotationSpeed, dt);
        player.facingIdx = angleToFacingIdx(player.facingAngle);

        if (rt.spearHoldTimer >= 0.18) {
          rt.spearSpinCharging = true;
          player.attackChargeTimer = Math.min(spinDur, rt.spearHoldTimer - 0.18);
          return;
        }
        // Still inside tap threshold — wait for release or hold threshold
        if (input.attackPressed) {
          return;
        }
        return;
      }

      if (rt.spearSpinCharging) {
        const frac = Math.min(1, player.attackChargeTimer / spinDur);
        rt.spearSpinCharging = false;
        rt.spearHoldTimer = 0;
        player.attackChargeTimer = 0;
        executeSpearSpinAttack(state, frac, player.facingAngle, ctx, hooks);
        player.attackTimer = 0.22 / speedMult;
        return;
      }

      if (rt.spearHoldTimer > 0 && !input.attack) {
        // Quick tap -> advance 3-hit Spear Thrust combo (25 / 30 / 30, r430)!
        rt.spearHoldTimer = 0;
        if (player.attackRecoveryTimer <= 0) {
          player.attackComboStep = 0;
        }
        const stageIdx = player.attackComboStep % tuning.comboStages.length;
        const stage = tuning.comboStages[stageIdx];
        executeMeleeSwing(state, player.facingAngle, stageIdx, false, ctx, hooks);
        const rec = stage.recoverySec / speedMult;
        player.attackTimer = rec;
        player.attackComboStep = (stageIdx + 1) % tuning.comboStages.length;
        player.attackRecoveryTimer = stage.comboWindowSec > 0 ? rec + stage.comboWindowSec : 0;
        return;
      }
    }
  }

  // 10. Stygian Blade (10/10 flagship), Twin Fists (5-hit combo), & Spear Flurry Jab
  // 10a. Dash-Strike: 0f instant lunge, ends dash i-frames early!
  if (
    input.attackPressed &&
    (player.dashTimer > 0 || player.dashStrikeWindowTimer > 0)
  ) {
    player.dashTimer = 0;
    player.dashStrikeWindowTimer = 0;
    player.attackChargeTimer = 0;
    player.attackBufferTimer = 0;
    player.facingAngle = rotateAngleToward(
      player.facingAngle,
      aimAngle,
      SIM_CONSTANTS.combatRotationSpeed,
      dt,
    );
    player.facingIdx = angleToFacingIdx(player.facingAngle);

    executeMeleeSwing(state, player.facingAngle, 0, true, ctx, hooks);

    const ds = tuning.dashStrike;
    player.attackTimer = ds.recoverySec / speedMult;
    player.attackRecoveryTimer = player.attackTimer + ds.comboWindowSec;
    if (player.weaponId === 'twin_fists' && hasHammer(player, 'hammer_fists_rolling_knuckle')) {
      player.attackComboStep = (player.attackComboStep + 1) % tuning.comboStages.length;
    } else {
      player.attackComboStep = tuning.comboStages.length > 1 ? 1 : 0;
    }
    return;
  }

  // 10b. Buffer Attack presses during an ongoing swing
  if (input.attackPressed && (player.attackTimer > 0 || player.attackChargeTimer > 0)) {
    player.attackBufferTimer = 0.18;
  }

  // 10c. Tick active windup/charge timer and fire hitbox when it hits 0
  if (player.attackChargeTimer > 0) {
    player.attackChargeTimer = Math.max(0, player.attackChargeTimer - dt);
    if (player.attackChargeTimer === 0) {
      const maxSteps =
        player.aspectId === 'fists_feral' ? 3 : tuning.comboStages.length;
      const stageIdx = player.attackComboStep % maxSteps;
      const stage = tuning.comboStages[stageIdx];

      executeMeleeSwing(state, player.facingAngle, stageIdx, false, ctx, hooks);

      const rec =
        (player.aspectId === 'blade_paladin' ? stage.recoverySec * 1.25 : stage.recoverySec) /
        speedMult;
      player.attackTimer = rec;
      player.attackComboStep = (stageIdx + 1) % maxSteps;
      player.attackRecoveryTimer = stage.comboWindowSec > 0 ? rec + stage.comboWindowSec : 0;
    }
    return;
  }

  // 10d. Start next combo stage when ready
  const autoHold =
    input.attack &&
    (player.weaponId === 'twin_fists' ||
      hasHammer(player, 'hammer_blade_flurry_slash') ||
      hasHammer(player, 'hammer_spear_flurry_jab'));

  if (
    player.attackTimer <= 0 &&
    player.specialTimer <= 0 &&
    player.dashTimer <= 0 &&
    (input.attackPressed || player.attackBufferTimer > 0 || autoHold)
  ) {
    player.attackBufferTimer = 0;
    if (player.attackRecoveryTimer <= 0) {
      player.attackComboStep = 0;
    }

    const maxSteps =
      player.aspectId === 'fists_feral' ? 3 : tuning.comboStages.length;
    const stageIdx = player.attackComboStep % maxSteps;
    const stage = tuning.comboStages[stageIdx];

    player.facingAngle = rotateAngleToward(
      player.facingAngle,
      aimAngle,
      SIM_CONSTANTS.combatRotationSpeed,
      dt,
    );
    player.facingIdx = angleToFacingIdx(player.facingAngle);

    let chargeSec = stage.chargeSec / speedMult;
    if (player.aspectId === 'blade_paladin') {
      const paladinCharge = [0.18, 0.24, 0.36];
      chargeSec = paladinCharge[stageIdx % 3] / speedMult;
    } else if (player.aspectId === 'fists_feral') {
      chargeSec = 0.09 / speedMult;
    }
    if (player.weaponId === 'stygian_blade' && hasHammer(player, 'hammer_blade_flurry_slash')) {
      chargeSec = (3 / 60) / speedMult;
    }
    if (player.weaponId === 'eternal_spear' && hasHammer(player, 'hammer_spear_flurry_jab')) {
      chargeSec = (4 / 60) / speedMult;
    }

    if (chargeSec <= 0) {
      executeMeleeSwing(state, player.facingAngle, stageIdx, false, ctx, hooks);
      const rec = stage.recoverySec / speedMult;
      player.attackTimer = rec;
      player.attackComboStep = (stageIdx + 1) % maxSteps;
      player.attackRecoveryTimer = stage.comboWindowSec > 0 ? rec + stage.comboWindowSec : 0;
    } else {
      player.attackChargeTimer = chargeSec;
    }
  }
}
