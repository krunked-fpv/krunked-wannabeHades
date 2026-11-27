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
import { breakUrnsInCone, breakUrnsInEllipse } from './collision.js';
import {
  addCameraShake,
  dealDamageToPlayer,
  deflectProjectiles,
  dropLodgedBloodstones,
  getBoonInSlot,
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
import { nextInt } from './prng.js';

function computeAttackSpeedMultiplier(state: SimState): number {
  const player = state.player;
  let mult = 1.0;

  if (player.aspectId === 'blade_scion') {
    const rank = getAspectRank(state.meta.aspectRanks, 'blade_scion');
    mult += getAspectBonus('blade_scion', rank);
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

/**
 * Built-in standalone on-hit Boon trigger (Voltaris chain lightning, Tidebreaker splash, etc.)
 * when SimGameplayHooks.onPlayerAttackHit is not provided.
 */
function runFallbackBoonOnHit(
  state: SimState,
  primaryTarget: EnemyState,
  slot: 'attack' | 'special' | 'cast',
  ctx: SimCombatContext,
): void {
  const boon = getBoonInSlot(state.player, slot);
  if (!boon) return;

  if (boon.patronId === 'voltaris') {
    // Voltaris chain lightning jumps to up to 2 nearby enemies within 320u
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
    // Tidebreaker bonus water splash on adjacent foes
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

/**
 * Execute a melee arc hit check against all enemies (used by Stygian Blade, Spear, Shield, Fists).
 */
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

  // Break destructible amphorae in swing arc
  breakUrnsInCone(state, player.pos, angle, range, arcDeg);

  // Aegira Attack / Special deflects enemy projectiles in swing arc!
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

/**
 * Execute Stygian Blade (or Spear/Shield/Fists) melee swing for a combo step or Dash-Strike.
 */
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

  // Stygian Blade Aspects & Hammers
  if (player.weaponId === 'stygian_blade') {
    if (player.aspectId === 'blade_paladin' && !isDashStrike) {
      const paladinCombo = [60, 80, 200];
      damage = paladinCombo[stageIdx % 3];
      range += 40;
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
      damage = Math.round(damage * 1.25);
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
    if (hasHammer(player, 'hammer_fists_long_knuckle')) {
      range = Math.round(range * 1.35);
      damage = Math.round(damage * 1.1);
    }
    if (isDashStrike && hasHammer(player, 'hammer_fists_rolling_knuckle')) {
      damage = Math.round(damage * 1.6);
    }
  }

  // Apply forward lunge impulse (e.g., Stygian Blade Thrust 3 SelfVelocity=600, Dash-Strike=400!)
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

/**
 * Execute Stygian Blade Nova Smash Special (50 dmg, r=380, scaleY=0.56, ImpactVelocity 1500, 0.5s cd)
 * AND baseline Specials for all other 5 weapons.
 */
function executeWeaponSpecial(
  state: SimState,
  angle: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const player = state.player;
  const def = getWeaponDef(player.weaponId);
  const tuning = getWeaponTuning(player.weaponId);
  const specialBoon = getBoonInSlot(player, 'special');

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

      // Break urns & deflect projectiles in full Nova ellipse
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

        // Aspect of Maelstrom dislodges lodged Bloodstones!
        if (player.aspectId === 'blade_maelstrom' && e.lodgedCasts > 0) {
          dropLodgedBloodstones(state, e);
        }

        if (dealt > 0) {
          notifyAttackHit(state, e, 'special', dealt, ctx, hooks);
        }
      }

      // Aspect of Vengeance: +30% Attack Crit for 3s after Special
      if (player.aspectId === 'blade_vengeance') {
        player.eruptBuffTimer = Math.max(player.eruptBuffTimer, 3.0);
      }

      // Aspect of the Paladin: Consecrated Aura zone
      if (player.aspectId === 'blade_paladin') {
        state.room.hazards.push({
          id: `aura_${state.tick}_${nextInt(state, 0, 999999)}`,
          kind: 'consecrated_aura',
          pos: { x: player.pos.x, y: player.pos.y },
          radius: 280,
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
      // Skewer Throw (piercing projectile that returns cleanly)
      const speed = def.specialProjectileSpeed ?? 1450;
      const range = def.specialRange; // 880
      let dmg = def.specialDamage; // 25
      if (player.aspectId === 'spear_scion') {
        const bonus = getAspectBonus('spear_scion', getAspectRank(state.meta.aspectRanks, 'spear_scion'));
        dmg = Math.round(dmg * (1 + bonus));
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
        maxLife: 1.5,
        pierceLeft: isExplosive ? 0 : 8,
        bouncesLeft: 0,
        deflectable: false,
        deflected: false,
        homingStrength: 0,
        isLob: false,
        lobHeight: 0,
        lobDuration: 0,
        lobElapsed: 0,
        aoeRadius: isExplosive ? 180 : undefined,
        patronId: specialBoon?.patronId,
        statusToApply: specialBoon?.statusEffect,
        returning: false,
        colorHex: specialBoon ? PATRON_CONSTANTS[specialBoon.patronId].colorHex : '#E8F6FF',
      });
      break;
    }

    case 'shield_of_chaos': {
      // Rebound Throw bouncing between enemies before returning
      const speed = def.specialProjectileSpeed ?? 1200;
      const bounces = (def.specialBounces ?? 2) + (hasHammer(player, 'hammer_shield_dread_flight') ? 4 : 0);
      player.shieldOut = true;

      ctx.spawnProjectile(state, {
        owner: 'player',
        ownerId: 'player',
        kind: 'shield',
        pos: { x: player.pos.x, y: player.pos.y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        startPos: { x: player.pos.x, y: player.pos.y },
        radius: 34,
        angle,
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
      break;
    }

    case 'heart_seeking_bow': {
      // 9-arrow Volley Fan (+4 with Relentless Volley)
      const count = def.specialHits + (hasHammer(player, 'hammer_bow_relentless_volley') ? 4 : 0);
      const spreadRad = (56 * Math.PI) / 180;
      const speed = def.specialProjectileSpeed ?? 1500;
      const homing = player.aspectId === 'bow_tracker' ? 7.5 : 0;

      for (let i = 0; i < count; i++) {
        const frac = count > 1 ? i / (count - 1) - 0.5 : 0;
        const a = normalizeAngle(angle + frac * spreadRad);
        ctx.spawnProjectile(state, {
          owner: 'player',
          ownerId: 'player',
          kind: 'arrow',
          pos: { x: player.pos.x, y: player.pos.y },
          vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
          startPos: { x: player.pos.x, y: player.pos.y },
          radius: 16,
          angle: a,
          damage: def.specialDamage,
          range: def.specialRange,
          maxLife: 1.0,
          pierceLeft: 0,
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
      // Rising Uppercut (2 rapid hits + forward surge)
      player.vel.x = Math.cos(angle) * tuning.specialSelfVelocity;
      player.vel.y = Math.sin(angle) * tuning.specialSelfVelocity;
      performMeleeConeStrike(
        state,
        angle,
        def.specialDamage,
        def.specialRange,
        130,
        tuning.specialImpactVelocity,
        'special',
        {
          comboStep: 0,
          multiHits: def.specialHits,
          applyMaim: player.aspectId === 'fists_feral',
        },
        ctx,
        hooks,
      );
      if (hasHammer(player, 'hammer_fists_quake_cutter')) {
        for (let i = 0; i < state.enemies.length; i++) {
          const e = state.enemies[i];
          if (e.hp <= 0 || e.aiState === 'dead') continue;
          if (ellipseDistance(e.pos.x - player.pos.x, e.pos.y - player.pos.y) <= 230 + e.radius) {
            ctx.dealDamageToEnemy(state, e, { baseDamage: 90, source: 'special', knockback: 1000 });
          }
        }
      }
      break;
    }

    case 'adamant_rail': {
      // Bombard Shell lob (60 dmg, r=400 AoE, 0.55s lobTime, 1.5s cd)
      const isRocket = hasHammer(player, 'hammer_rail_rocket_bomb');
      const isCluster = hasHammer(player, 'hammer_rail_cluster_bomb');
      const isHazard = hasHammer(player, 'hammer_rail_hazard_bomb');

      if (isRocket) {
        const speed = 1550;
        ctx.spawnProjectile(state, {
          owner: 'player',
          ownerId: 'player',
          kind: 'bomb',
          pos: { x: player.pos.x, y: player.pos.y },
          vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          startPos: { x: player.pos.x, y: player.pos.y },
          radius: 22,
          angle,
          damage: 80,
          range: 900,
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
        const aoeRadius = isHazard ? Math.round(def.specialRadius * 1.25) : def.specialRadius;

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
            maxLife: (def.specialLobTime ?? 0.55) + 0.1,
            pierceLeft: 0,
            bouncesLeft: 0,
            deflectable: false,
            deflected: false,
            homingStrength: 0,
            isLob: true,
            lobHeight: 170,
            lobDuration: def.specialLobTime ?? 0.55,
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

/**
 * Fire Bloodstone Cast (50 dmg, speed 900, range 1100, -320 recoil, 16s lodge).
 */
function fireBloodstoneCast(state: SimState, angle: number, ctx: SimCombatContext): void {
  const player = state.player;
  const castBoon = getBoonInSlot(player, 'cast');

  player.castAmmo = Math.max(0, player.castAmmo - 1);
  player.castCooldown = PLAYER_CONSTANTS.castCooldown;

  // Stygian Soul regen timer reset when spending cast
  if (state.meta.mirrorActiveSide.infernal_soul === 'b' && player.castRegenTimer <= 0) {
    const rank = state.meta.mirrorRanks.infernal_soul ?? 0;
    player.castRegenTimer = Math.max(1.0, 3.0 - rank);
  }

  // Authentic -320 cast recoil impulse
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

/**
 * Trigger God Call (partial >= 25 gauge or Greater Call at 100 gauge).
 */
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
    greater ? `${PATRON_CONSTANTS[patronId].displayName.toUpperCase()} GREATER CALL!` : `${PATRON_CONSTANTS[patronId].displayName.toUpperCase()} AID!`,
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

  // Built-in standalone God Call burst fallback
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

/**
 * Step all player weapon attacks, combos, Dash-Strikes, Specials, Bloodstone Cast,
 * Rail ammo/reload, and God Call.
 */
export function stepPlayerWeapons(
  state: SimState,
  input: InputFrame,
  dt: number,
  ctx: SimCombatContext,
  hooks?: SimGameplayHooks,
): void {
  const player = state.player;
  if (player.isDead || dt <= 0) return;

  const aimAngle = computeAimAngle(state, input);
  const speedMult = computeAttackSpeedMultiplier(state);
  const def = getWeaponDef(player.weaponId);
  const tuning = getWeaponTuning(player.weaponId);

  // 1. Decay timers
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

  // 4. Ongoing Bloodstone Cast 13-frame charge
  if (player.castChargeTimer > 0) {
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

  // 5. Ongoing Special windup & fire (e.g., Nova Smash)
  if (player.specialTimer > 0) {
    const prev = player.specialTimer;
    player.specialTimer = Math.max(0, player.specialTimer - dt);
    const activeSplit = tuning.specialActiveSec;
    if (prev > activeSplit && player.specialTimer <= activeSplit) {
      executeWeaponSpecial(state, player.facingAngle, ctx, hooks);
    }
  } else if (
    input.specialPressed &&
    player.specialCooldown <= 0 &&
    player.dashTimer <= 0
  ) {
    // Recall stuck spear/shield immediately if out
    if (player.weaponId === 'eternal_spear' && player.spearOut) {
      for (let i = 0; i < state.projectiles.length; i++) {
        if (state.projectiles[i].kind === 'spear' && state.projectiles[i].owner === 'player') {
          state.projectiles[i].returning = true;
        }
      }
    } else {
      player.attackTimer = 0;
      player.attackChargeTimer = 0;
      player.isBlocking = false;
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

  // 6. Heart-Seeking Bow hold-to-charge & Power Shot release
  if (player.weaponId === 'heart_seeking_bow') {
    const isFlurryBow = hasHammer(player, 'hammer_bow_flurry_shot');
    if (input.attackPressed && (player.dashTimer > 0 || player.dashStrikeWindowTimer > 0)) {
      // Instant Bow Dash-Strike (ends dash i-frames early!)
      player.dashTimer = 0;
      player.dashStrikeWindowTimer = 0;
      player.facingAngle = normalizeAngle(aimAngle);
      player.facingIdx = angleToFacingIdx(player.facingAngle);
      fireBowArrow(state, player.facingAngle, def.dashStrikeDamage, 0, true, ctx);
      player.attackTimer = 0.18;
      return;
    }

    if (isFlurryBow) {
      if (input.attack && player.attackTimer <= 0 && player.dashTimer <= 0) {
        player.facingAngle = normalizeAngle(aimAngle);
        player.facingIdx = angleToFacingIdx(player.facingAngle);
        fireBowArrow(state, player.facingAngle, 35, 0, false, ctx);
        player.attackTimer = 0.22 / speedMult;
      }
      return;
    }

    if (input.attack && player.attackTimer <= 0 && player.dashTimer <= 0) {
      player.facingAngle = rotateAngleToward(player.facingAngle, aimAngle, SIM_CONSTANTS.combatRotationSpeed, dt);
      player.facingIdx = angleToFacingIdx(player.facingAngle);
      player.attackChargeTimer = Math.min(def.chargeDuration ?? 0.6, player.attackChargeTimer + dt * speedMult);
    } else if (player.attackChargeTimer > 0) {
      const chargeDur = def.chargeDuration ?? 0.6;
      const frac = Math.min(1, player.attackChargeTimer / chargeDur);
      const isPowerShot = frac >= 0.78 && frac <= 1.0;
      const minD = def.chargeMinDamage ?? 10;
      const maxD = def.chargeMaxDamage ?? 60;
      let dmg = isPowerShot ? (def.powerShotDamage ?? 70) : Math.round(minD + (maxD - minD) * frac);
      if (isPowerShot && hasHammer(player, 'hammer_bow_perfect_shot')) {
        dmg = Math.round(dmg * 2.5);
      }
      fireBowArrow(state, player.facingAngle, dmg, isPowerShot ? 0.15 : 0, false, ctx);
      player.attackChargeTimer = 0;
      player.attackTimer = 0.18;
    }
    return;
  }

  // 7. Adamant Rail rapid-fire
  if (player.weaponId === 'adamant_rail') {
    const infiniteAmmo = hasHammer(player, 'hammer_rail_delta_chamber');
    if (
      (input.attack || input.attackPressed) &&
      player.attackTimer <= 0 &&
      player.reloadTimer <= 0
    ) {
      if (player.dashTimer > 0) {
        // Dash-fire ends dash i-frames cleanly if shooting during dash
        player.dashTimer = 0;
        player.dashStrikeWindowTimer = 0;
      }
      if (player.ammo > 0 || infiniteAmmo) {
        player.facingAngle = normalizeAngle(aimAngle);
        player.facingIdx = angleToFacingIdx(player.facingAngle);
        if (!infiniteAmmo) player.ammo -= 1;

        const attackBoon = getBoonInSlot(player, 'attack');
        const isSpread = hasHammer(player, 'hammer_rail_spread_fire');
        const pellets = isSpread ? 5 : 1;
        const speed = def.attackProjectileSpeed ?? 1750;
        const range = isSpread ? 340 : def.attackRange;
        const dmg = isSpread ? 40 : def.attackComboDamage[0];

        applyChaosActionCurse(state, 'take_damage_on_attack');
        state.events.push({
          type: 'attack_swing',
          weaponId: 'adamant_rail',
          pos: { x: player.pos.x, y: player.pos.y },
          angle: player.facingAngle,
          comboStep: 0,
          isDashStrike: false,
        });

        for (let pIdx = 0; pIdx < pellets; pIdx++) {
          const spread = pellets > 1 ? (pIdx - 2) * 0.12 : 0;
          const a = normalizeAngle(player.facingAngle + spread);
          ctx.spawnProjectile(state, {
            owner: 'player',
            ownerId: 'player',
            kind: 'bullet',
            pos: { x: player.pos.x + Math.cos(a) * 28, y: player.pos.y + Math.sin(a) * 28 },
            vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
            startPos: { x: player.pos.x, y: player.pos.y },
            radius: 11,
            angle: a,
            damage: dmg,
            range,
            maxLife: range / speed + 0.05,
            pierceLeft: 0,
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
            colorHex: attackBoon ? PATRON_CONSTANTS[attackBoon.patronId].colorHex : '#FFC45E',
          });
        }

        player.attackTimer = (def.fireInterval ?? 0.1) / speedMult;
        if (!infiniteAmmo && player.ammo <= 0) {
          player.reloadTimer = def.reloadTime ?? 0.75;
        }
      }
    }
    return;
  }

  // 8. Shield of Chaos frontal Block while holding Attack
  if (player.weaponId === 'shield_of_chaos' && input.attack && !input.attackPressed && player.dashTimer <= 0 && player.attackTimer <= 0 && player.attackChargeTimer <= 0) {
    player.isBlocking = true;
    player.facingAngle = rotateAngleToward(player.facingAngle, aimAngle, SIM_CONSTANTS.combatRotationSpeed, dt);
    player.facingIdx = angleToFacingIdx(player.facingAngle);
    return;
  } else {
    player.isBlocking = false;
  }

  // 9. Melee Weapons (Stygian Blade flagship 10/10 + Spear + Shield + Fists)
  // 9a. Dash-Strike: Attack during Dash or within 0.4s Dash-Strike window
  //     Immediately executes 0f Dash-Strike and ends dash i-frames early!
  if (
    input.attackPressed &&
    (player.dashTimer > 0 || player.dashStrikeWindowTimer > 0)
  ) {
    player.dashTimer = 0; // Authentic Hades risk-reward: ends dash i-frames immediately!
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
    // Blade Dash-Strike smoothly chains into Swing 2!
    player.attackComboStep = tuning.comboStages.length > 1 ? 1 : 0;
    return;
  }

  // 9b. Buffer Attack presses during an ongoing swing so combos NEVER drop inputs
  if (input.attackPressed && (player.attackTimer > 0 || player.attackChargeTimer > 0)) {
    player.attackBufferTimer = 0.18;
  }

  // 9c. Tick active windup/charge timer and fire hitbox when it hits 0
  if (player.attackChargeTimer > 0) {
    player.attackChargeTimer = Math.max(0, player.attackChargeTimer - dt);
    if (player.attackChargeTimer === 0) {
      const stageIdx = player.attackComboStep % tuning.comboStages.length;
      const stage = tuning.comboStages[stageIdx];

      executeMeleeSwing(state, player.facingAngle, stageIdx, false, ctx, hooks);

      const rec = stage.recoverySec / speedMult;
      player.attackTimer = rec;
      player.attackComboStep = (stageIdx + 1) % tuning.comboStages.length;
      player.attackRecoveryTimer = stage.comboWindowSec > 0 ? rec + stage.comboWindowSec : 0;
    }
    return;
  }

  // 9d. Start next combo stage when ready
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

    const stageIdx = player.attackComboStep % tuning.comboStages.length;
    const stage = tuning.comboStages[stageIdx];

    player.facingAngle = rotateAngleToward(
      player.facingAngle,
      aimAngle,
      SIM_CONSTANTS.combatRotationSpeed,
      dt,
    );
    player.facingIdx = angleToFacingIdx(player.facingAngle);

    let chargeSec = stage.chargeSec / speedMult;
    if (player.weaponId === 'stygian_blade' && hasHammer(player, 'hammer_blade_flurry_slash')) {
      chargeSec = (3 / 60) / speedMult;
    }

    if (chargeSec <= 0) {
      executeMeleeSwing(state, player.facingAngle, stageIdx, false, ctx, hooks);
      const rec = stage.recoverySec / speedMult;
      player.attackTimer = rec;
      player.attackComboStep = (stageIdx + 1) % tuning.comboStages.length;
      player.attackRecoveryTimer = stage.comboWindowSec > 0 ? rec + stage.comboWindowSec : 0;
    } else {
      player.attackChargeTimer = chargeSec;
    }
  }
}

function fireBowArrow(
  state: SimState,
  angle: number,
  damage: number,
  bonusCrit: number,
  isDashStrike: boolean,
  ctx: SimCombatContext,
): void {
  const player = state.player;
  const def = WEAPON_CONSTANTS.heart_seeking_bow;
  const attackBoon = getBoonInSlot(player, 'attack');
  const speed = def.attackProjectileSpeed ?? 1850;
  const isTwin = hasHammer(player, 'hammer_bow_twin_shot');
  const isExplosive = hasHammer(player, 'hammer_bow_explosive_shot');
  const arrows = isTwin ? 2 : 1;

  applyChaosActionCurse(state, 'take_damage_on_attack');
  state.events.push({
    type: 'attack_swing',
    weaponId: 'heart_seeking_bow',
    pos: { x: player.pos.x, y: player.pos.y },
    angle,
    comboStep: 0,
    isDashStrike,
  });

  for (let i = 0; i < arrows; i++) {
    const spread = arrows === 2 ? (i === 0 ? -0.05 : 0.05) : 0;
    const a = normalizeAngle(angle + spread);
    ctx.spawnProjectile(state, {
      owner: 'player',
      ownerId: 'player',
      kind: 'arrow',
      pos: { x: player.pos.x + Math.cos(a) * 24, y: player.pos.y + Math.sin(a) * 24 },
      vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
      startPos: { x: player.pos.x, y: player.pos.y },
      radius: 16,
      angle: a,
      damage: isExplosive ? damage * 3 : damage,
      range: isTwin ? Math.round(def.attackRange * 0.75) : def.attackRange,
      maxLife: 1.0,
      pierceLeft: 1,
      bouncesLeft: 0,
      deflectable: false,
      deflected: false,
      homingStrength: 0,
      isLob: false,
      lobHeight: 0,
      lobDuration: 0,
      lobElapsed: 0,
      aoeRadius: isExplosive ? 220 : undefined,
      patronId: attackBoon?.patronId,
      statusToApply: attackBoon?.statusEffect,
      critBonus: bonusCrit,
      colorHex: attackBoon ? PATRON_CONSTANTS[attackBoon.patronId].colorHex : '#7CFF5B',
    });
  }
}
