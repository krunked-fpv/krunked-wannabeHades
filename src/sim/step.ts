import {
  BIOME_CONSTANTS,
  COMBAT_CONSTANTS,
  DEFAULT_RENDER_SETTINGS,
  KEEPSAKES,
  LAVA_CONSTANTS,
  MIRROR_UPGRADES,
  PLAYER_CONSTANTS,
  SIM_CONSTANTS,
  WEAPON_CONSTANTS,
  type InputFrame,
  type MetaSaveState,
  type MirrorUpgradeId,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import { resolveEnemyWallSlam, resolveHeroEnemySeparation } from './collision.js';
import {
  addCameraShake,
  dealDamageToEnemy,
  dealDamageToPlayer,
  spawnProjectile,
  tickBloodstones,
  tickHazards,
  tickProjectiles,
  triggerHitstop,
  type SimCombatContext,
  type SimGameplayHooks,
} from './combat.js';
import { angleToFacingIdx } from './isometric.js';
import { stepPlayerPhysics } from './physics.js';
import { nextFloat, nextInt, seedRng } from './prng.js';
import { applyStatus, tickStatuses } from './status.js';
import { stepPlayerWeapons } from './weapons.js';

export type { SimCombatContext, SimGameplayHooks };

let activeHooksForTick: SimGameplayHooks | undefined;

const SHARED_COMBAT_CONTEXT: SimCombatContext = {
  nextFloat(state) {
    return nextFloat(state);
  },
  nextInt(state, min, max) {
    return nextInt(state, min, max);
  },
  dealDamageToEnemy(state, enemy, opts) {
    return dealDamageToEnemy(state, enemy, opts, activeHooksForTick, SHARED_COMBAT_CONTEXT);
  },
  dealDamageToPlayer(state, amount, opts) {
    return dealDamageToPlayer(state, amount, opts);
  },
  applyStatus(state, target, targetKind, statusId, stacks, sourceId) {
    applyStatus(state, target, targetKind, statusId, stacks, sourceId);
  },
  spawnProjectile(state, proj) {
    return spawnProjectile(state, proj);
  },
  triggerHitstop(state, duration, slowScale) {
    triggerHitstop(state, duration, slowScale);
  },
  addCameraShake(state, intensity, duration) {
    addCameraShake(state, intensity, duration);
  },
};

export function getCombatContext(): SimCombatContext {
  return SHARED_COMBAT_CONTEXT;
}

function createFallbackMetaSave(): MetaSaveState {
  const mirrorRanks: Record<MirrorUpgradeId, number> = {
    shadow_presence: 5,
    cinder_vitality: 1,
    death_defiance: 1,
    greater_reflex: 1,
    boiling_blood: 5,
    infernal_soul: 0,
    deep_pockets: 0,
    thick_skin: 5,
    privileged_status: 2,
    patron_favor: 0,
    divine_pride: 0,
    fated_authority: 0,
  };
  const mirrorActiveSide: Record<MirrorUpgradeId, 'a' | 'b'> = {
    shadow_presence: 'a',
    cinder_vitality: 'a',
    death_defiance: 'a',
    greater_reflex: 'a',
    boiling_blood: 'a',
    infernal_soul: 'a',
    deep_pockets: 'a',
    thick_skin: 'a',
    privileged_status: 'a',
    patron_favor: 'a',
    divine_pride: 'a',
    fated_authority: 'a',
  };

  return {
    version: 1,
    darkness: 150,
    gemstones: 0,
    keys: 0,
    nectar: 0,
    titanBlood: 0,
    diamonds: 0,
    ambrosia: 0,
    totalRuns: 0,
    totalClears: 0,
    totalDeaths: 0,
    bestClearTimeSeconds: null,
    highestHeatCleared: 0,
    godModeEnabled: false,
    godModeDeaths: 0,
    selectedWeapon: 'stygian_blade',
    selectedAspects: {
      stygian_blade: 'blade_scion',
      eternal_spear: 'spear_scion',
      shield_of_chaos: 'shield_scion',
      heart_seeking_bow: 'bow_scion',
      twin_fists: 'fists_scion',
      adamant_rail: 'rail_scion',
    },
    unlockedWeapons: ['stygian_blade'],
    aspectRanks: {
      blade_scion: 1,
    },
    selectedKeepsake: null,
    unlockedKeepsakes: [],
    keepsakeRanks: {},
    mirrorRanks,
    mirrorActiveSide,
    shrineVows: {},
    codexKills: {},
    codexBoonsSeen: [],
    settings: { ...DEFAULT_RENDER_SETTINGS },
  };
}

export function createDefaultSimState(seed: number, meta?: MetaSaveState): SimState {
  const resolvedMeta: MetaSaveState = meta
    ? {
        ...meta,
        selectedAspects: { ...meta.selectedAspects },
        unlockedWeapons: [...meta.unlockedWeapons],
        aspectRanks: { ...meta.aspectRanks },
        unlockedKeepsakes: [...meta.unlockedKeepsakes],
        keepsakeRanks: { ...meta.keepsakeRanks },
        mirrorRanks: { ...meta.mirrorRanks },
        mirrorActiveSide: { ...meta.mirrorActiveSide },
        shrineVows: { ...meta.shrineVows },
        codexKills: { ...meta.codexKills },
        codexBoonsSeen: [...meta.codexBoonsSeen],
        settings: { ...meta.settings },
      }
    : createFallbackMetaSave();

  const weaponId = resolvedMeta.selectedWeapon;
  const aspectId = resolvedMeta.selectedAspects[weaponId] ?? WEAPON_CONSTANTS[weaponId].aspects[0];
  const weaponDef = WEAPON_CONSTANTS[weaponId];

  // Derived starting stats from Mirror + Keepsake + Aspect
  let maxHp: number = PLAYER_CONSTANTS.baseMaxHealth;
  if (resolvedMeta.mirrorActiveSide.thick_skin === 'a') {
    const rank = Math.min(
      MIRROR_UPGRADES.thick_skin.sideA.maxRank,
      resolvedMeta.mirrorRanks.thick_skin ?? 0,
    );
    maxHp += Math.min(PLAYER_CONSTANTS.thickSkinMaxBonus, rank * MIRROR_UPGRADES.thick_skin.sideA.valuePerRank);
  }
  if (aspectId === 'blade_paladin') maxHp += 50;
  if (aspectId === 'spear_dragon') maxHp = Math.max(15, Math.round(maxHp * 0.5));
  if (resolvedMeta.selectedKeepsake === 'old_collar') {
    const rIdx = Math.max(0, Math.min(2, (resolvedMeta.keepsakeRanks.old_collar ?? 1) - 1));
    maxHp += KEEPSAKES.old_collar.valuesByRank[rIdx];
  }

  let maxDashCharges: number = PLAYER_CONSTANTS.dashBaseClip;
  if (resolvedMeta.mirrorActiveSide.greater_reflex === 'a' && (resolvedMeta.mirrorRanks.greater_reflex ?? 0) > 0) {
    maxDashCharges += 1;
  }
  if (aspectId === 'fists_feral') {
    maxDashCharges += 2;
  }

  let maxCastAmmo: number = PLAYER_CONSTANTS.baseCastAmmo;
  if (resolvedMeta.mirrorActiveSide.infernal_soul === 'a') {
    const rank = Math.min(
      PLAYER_CONSTANTS.infernalSoulMaxBonus,
      resolvedMeta.mirrorRanks.infernal_soul ?? 0,
    );
    maxCastAmmo += rank;
  }

  let maxDeathDefiances = 0;
  if (resolvedMeta.mirrorActiveSide.death_defiance === 'b') {
    maxDeathDefiances = (resolvedMeta.mirrorRanks.death_defiance ?? 0) > 0 ? 1 : 0;
  } else {
    maxDeathDefiances = Math.min(
      MIRROR_UPGRADES.death_defiance.sideA.maxRank,
      resolvedMeta.mirrorRanks.death_defiance ?? 0,
    );
  }

  let startingGold = 0;
  if (resolvedMeta.mirrorActiveSide.deep_pockets === 'a') {
    const rank = Math.min(
      MIRROR_UPGRADES.deep_pockets.sideA.maxRank,
      resolvedMeta.mirrorRanks.deep_pockets ?? 0,
    );
    startingGold += rank * MIRROR_UPGRADES.deep_pockets.sideA.valuePerRank;
  }
  if (resolvedMeta.selectedKeepsake === 'coin_pouch') {
    const rIdx = Math.max(0, Math.min(2, (resolvedMeta.keepsakeRanks.coin_pouch ?? 1) - 1));
    startingGold += KEEPSAKES.coin_pouch.valuesByRank[rIdx];
  }

  const maxAmmo = weaponDef.clipSize ?? 0;
  const fatedRank = resolvedMeta.mirrorRanks.fated_authority ?? 0;
  const boonRerolls = resolvedMeta.mirrorActiveSide.fated_authority === 'b' ? fatedRank : 0;
  const doorRerolls = resolvedMeta.mirrorActiveSide.fated_authority === 'a' ? fatedRank : 0;

  const initialZoom = BIOME_CONSTANTS.obsidian_pit.zoomRange[1];

  return {
    tick: 0,
    rngState: seedRng(seed),
    timeScale: 1.0,
    hitstopTimer: 0,
    hitstopCooldownTimer: 0,
    player: {
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      facingAngle: 0,
      facingIdx: angleToFacingIdx(0),
      hp: maxHp,
      maxHp,
      armor: 0,
      deathDefiances: maxDeathDefiances,
      maxDeathDefiances,
      weaponId,
      aspectId,
      hammers: [],
      ammo: maxAmmo,
      maxAmmo,
      reloadTimer: 0,
      castAmmo: maxCastAmmo,
      maxCastAmmo,
      castRegenTimer: 0,
      castCooldown: 0,
      castChargeTimer: 0,
      dashCharges: maxDashCharges,
      maxDashCharges,
      dashRegenTimer: 0,
      dashCooldown: 0,
      dashTimer: 0,
      dashDir: { x: 1, y: 0 },
      dashStartPos: { x: 0, y: 0 },
      dashStrikeWindowTimer: 0,
      perfectDashTimer: 0,
      dashGhosts: [],
      attackComboStep: 0,
      attackTimer: 0,
      attackChargeTimer: 0,
      attackRecoveryTimer: 0,
      attackBufferTimer: 0,
      specialTimer: 0,
      specialCooldown: 0,
      isBlocking: false,
      spearOut: false,
      shieldOut: false,
      iframeTimer: 0,
      cumulativeDamageWindowTimer: 0,
      cumulativeDamageInWindow: 0,
      godGauge: 0,
      godCallActiveTimer: 0,
      godCallPatron: null,
      greaterCallSlowTimer: 0,
      lavaGraceTimer: LAVA_CONSTANTS.graceDuration,
      lavaTickTimer: 0,
      inLava: false,
      inPoison: false,
      statuses: [],
      gold: startingGold,
      boons: [],
      chaosCurses: [],
      keepsakeId: resolvedMeta.selectedKeepsake,
      keepsakeUsed: false,
      acornShields: 0,
      plumeBonus: 0,
      empoweredAttacks: 0,
      consecutiveHits: 0,
      eruptBuffTimer: 0,
      hitstopTimer: 0,
      isDead: false,
    },
    enemies: [],
    projectiles: [],
    floatingNumbers: [],
    room: {
      biome: 'obsidian_pit',
      depth: 1,
      roomIndex: 0,
      templateId: 'obsidian_arena_default',
      encounterKind: 'combat',
      width: 1440,
      height: 840,
      bounds: {
        minX: -720,
        maxX: 720,
        minY: -420,
        maxY: 420,
      },
      waveIndex: 0,
      totalWaves: 1,
      cleared: false,
      combatStarted: false,
      encounterTimer: 0,
      noDamageTaken: true,
      obstacles: [],
      doors: [],
      hazards: [],
      pickups: [],
      bloodstones: [],
      telegraphs: [],
      zoom: initialZoom,
    },
    run: {
      seed,
      runNumber: resolvedMeta.totalRuns + 1,
      active: true,
      inHub: false,
      victory: false,
      defeat: false,
      paused: false,
      heat: 0,
      vows: { ...resolvedMeta.shrineVows },
      godModeEnabled: resolvedMeta.godModeEnabled,
      tightDeadlineTimer: null,
      biomeOrderIndex: 1,
      chambersCleared: 0,
      kills: 0,
      bossesDefeated: [],
      elapsedSeconds: 0,
      damageDealt: 0,
      damageTaken: 0,
      pendingOffer: null,
      boonRerolls,
      doorRerolls,
      seenPatrons: [],
      hammersCollected: 0,
      finalKillSlowTimer: 0,
    },
    meta: resolvedMeta,
    events: [],
    camera: {
      x: 0,
      y: 0,
      zoom: initialZoom,
      shakeX: 0,
      shakeY: 0,
      shakeIntensity: 0,
      shakeTimer: 0,
    },
  };
}

function tickCamera(state: SimState, dt: number): void {
  const cam = state.camera;
  const player = state.player;

  // Smooth camera tracking with slight aim lookahead
  const lookAhead = 42;
  const targetX = player.pos.x + Math.cos(player.facingAngle) * lookAhead;
  const targetY = player.pos.y + Math.sin(player.facingAngle) * lookAhead * SIM_CONSTANTS.isoScaleY;

  const lerpAlpha = 1 - Math.exp(-8.5 * dt);
  cam.x += (targetX - cam.x) * lerpAlpha;
  cam.y += (targetY - cam.y) * lerpAlpha;

  // Softly pull camera zoom toward room zoom
  cam.zoom += (state.room.zoom - cam.zoom) * Math.min(1, 5 * dt);

  // Deterministic shake offset driven strictly by state.tick (pure sin/cos)
  if (cam.shakeTimer > 0) {
    cam.shakeTimer = Math.max(0, cam.shakeTimer - dt);
    const decay = cam.shakeTimer > 0 ? Math.min(1, cam.shakeTimer * 6) : 0;
    const amp = cam.shakeIntensity * decay;
    cam.shakeX = Math.sin(state.tick * 2.13) * amp;
    cam.shakeY = Math.cos(state.tick * 2.79) * amp * 0.85;
    if (cam.shakeTimer === 0) {
      cam.shakeIntensity = 0;
      cam.shakeX = 0;
      cam.shakeY = 0;
    }
  } else {
    cam.shakeX = 0;
    cam.shakeY = 0;
  }
}

function tickFloatingNumbers(state: SimState, dt: number): void {
  for (let i = state.floatingNumbers.length - 1; i >= 0; i--) {
    const fn = state.floatingNumbers[i];
    fn.life -= dt;
    fn.pos.x += fn.vel.x * dt;
    fn.pos.y += fn.vel.y * dt;
    fn.vel.y += 190 * dt;
    if (fn.life <= 0) {
      state.floatingNumbers.splice(i, 1);
    }
  }
}

function tickTelegraphs(state: SimState, dt: number): void {
  for (let i = state.room.telegraphs.length - 1; i >= 0; i--) {
    const tel = state.room.telegraphs[i];
    tel.elapsed += dt;
    tel.progress = tel.duration > 0 ? Math.min(1, tel.elapsed / tel.duration) : 1;
    if (tel.elapsed >= tel.duration) {
      state.room.telegraphs.splice(i, 1);
    }
  }
}

/**
 * Deterministic 60Hz fixed-timestep simulation tick.
 */
export function stepSim(
  state: SimState,
  input: InputFrame,
  hooks?: SimGameplayHooks,
): void {
  const fixedDt = SIM_CONSTANTS.fixedDt;
  state.events.length = 0;
  activeHooksForTick = hooks;

  try {
    // 1. Handle Boon Offer modal input cleanly without advancing combat
    if (state.run.pendingOffer !== null) {
      if (input.boonSelectIndex !== null && hooks?.onSelectBoon) {
        hooks.onSelectBoon(state, input.boonSelectIndex, SHARED_COMBAT_CONTEXT);
      } else if (input.rerollPressed && hooks?.onRerollBoon) {
        hooks.onRerollBoon(state, SHARED_COMBAT_CONTEXT);
      }
      tickCamera(state, fixedDt);
      tickFloatingNumbers(state, fixedDt);
      return;
    }

    // 2. Paused or finished run
    if (state.run.paused || state.run.defeat || state.run.victory) {
      tickCamera(state, fixedDt);
      tickFloatingNumbers(state, fixedDt);
      return;
    }

    // 3. Hitstop & Slow-Mo Time-Scale
    if (state.hitstopCooldownTimer > 0) {
      state.hitstopCooldownTimer = Math.max(0, state.hitstopCooldownTimer - fixedDt);
    }

    if (state.hitstopTimer > 0) {
      state.hitstopTimer = Math.max(0, state.hitstopTimer - fixedDt);
      state.tick += 1;
      tickCamera(state, fixedDt);
      tickFloatingNumbers(state, fixedDt);
      return;
    }

    if (state.run.finalKillSlowTimer > 0) {
      state.run.finalKillSlowTimer = Math.max(0, state.run.finalKillSlowTimer - fixedDt);
      const lerpOut = COMBAT_CONSTANTS.finalKillSlowLerpOut;
      if (state.run.finalKillSlowTimer > lerpOut) {
        state.timeScale = COMBAT_CONSTANTS.finalKillSlowScale;
      } else if (lerpOut > 0) {
        const t = 1 - state.run.finalKillSlowTimer / lerpOut;
        state.timeScale =
          COMBAT_CONSTANTS.finalKillSlowScale +
          (1.0 - COMBAT_CONSTANTS.finalKillSlowScale) * Math.max(0, Math.min(1, t));
      } else {
        state.timeScale = 1.0;
      }
    } else if (state.player.greaterCallSlowTimer > 0) {
      state.player.greaterCallSlowTimer = Math.max(0, state.player.greaterCallSlowTimer - fixedDt);
      state.timeScale = PLAYER_CONSTANTS.greaterCallSlowScale;
    } else {
      state.timeScale = 1.0;
    }

    const dt = fixedDt * state.timeScale;
    state.tick += 1;
    state.run.elapsedSeconds += fixedDt;

    if (!state.room.cleared && state.room.combatStarted) {
      state.room.encounterTimer += dt;
      if (state.run.tightDeadlineTimer !== null) {
        state.run.tightDeadlineTimer = Math.max(0, state.run.tightDeadlineTimer - fixedDt);
        if (state.run.tightDeadlineTimer === 0 && state.tick % 60 === 0) {
          dealDamageToPlayer(state, 5, { source: 'chaos', ignoreIframes: true });
        }
      }
    }

    // 4. Interaction input (pickups, doors, training dummy / sanctuary)
    if (input.interactPressed && hooks?.onInteract) {
      hooks.onInteract(state, SHARED_COMBAT_CONTEXT);
    }

    // 5. Player Physics, Aim & Blink Dash
    stepPlayerPhysics(state, input, dt, SHARED_COMBAT_CONTEXT, hooks);

    // 6. Player Weapons, Combo, Dash-Strike, Special, Cast, Reload & God Call
    stepPlayerWeapons(state, input, dt, SHARED_COMBAT_CONTEXT, hooks);

    // 7. Status Effects (all 10 StatusEffectIds)
    tickStatuses(state, dt, {
      onEnemyStatusDamage(enemy, statusId, damage) {
        dealDamageToEnemy(
          state,
          enemy,
          {
            baseDamage: damage,
            source: 'status',
            statusId,
            canCrit: false,
            canBackstab: false,
          },
          hooks,
          SHARED_COMBAT_CONTEXT,
        );
      },
      onPlayerStatusDamage(statusId, damage) {
        dealDamageToPlayer(state, damage, {
          source: statusId === 'poison' ? 'poison' : 'hazard',
          ignoreIframes: true,
        });
      },
    });

    // 8. Snapshot enemy positions before AI hook so we never double-integrate AI movement,
    //    while still applying knockback physics & Wall-Slams seamlessly!
    const prevPositions = new Map<string, Vec2>();
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      prevPositions.set(e.id, { x: e.pos.x, y: e.pos.y });
    }

    if (hooks?.tickRoomAndAi) {
      hooks.tickRoomAndAi(state, dt, SHARED_COMBAT_CONTEXT);
    }

    // 9. Enemy timers, knockback integration, obstacle collision & Wall-Slam damage
    const kbFriction = Math.exp(-8.5 * dt);
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
      }
      if (e.invulnTimer > 0) {
        e.invulnTimer = Math.max(0, e.invulnTimer - dt);
        if (e.invulnTimer === 0 && e.aiState !== 'phase_transition') {
          e.invulnerable = false;
        }
      }
      if (e.hp <= 0 || e.aiState === 'dead') continue;

      if (e.stunTimer > 0) {
        e.stunTimer = Math.max(0, e.stunTimer - dt);
        if (e.stunTimer === 0 && e.aiState === 'stunned') {
          e.aiState = 'chase';
        }
      }

      const prev = prevPositions.get(e.id) ?? { x: e.pos.x, y: e.pos.y };
      const velSpeedSq = e.vel.x * e.vel.x + e.vel.y * e.vel.y;

      if (velSpeedSq > 1) {
        const expectedDx = e.vel.x * dt;
        const expectedDy = e.vel.y * dt;
        const actualDx = e.pos.x - prev.x;
        const actualDy = e.pos.y - prev.y;
        const proj = actualDx * expectedDx + actualDy * expectedDy;
        const expLenSq = expectedDx * expectedDx + expectedDy * expectedDy;

        // Only integrate e.vel if tickRoomAndAi did not already integrate it this tick
        if (expLenSq > 1e-6 && proj < 0.25 * expLenSq) {
          e.pos.x += expectedDx;
          e.pos.y += expectedDy;
          e.vel.x *= kbFriction;
          e.vel.y *= kbFriction;
          if (Math.hypot(e.vel.x, e.vel.y) < 8) {
            e.vel.x = 0;
            e.vel.y = 0;
          }
        }
      }

      const hpBeforeSlam = e.hp;
      resolveEnemyWallSlam(state, e, prev, { x: e.pos.x, y: e.pos.y });
      if (hpBeforeSlam > 0 && e.hp <= 0 && hooks?.onEnemyKilled) {
        hooks.onEnemyKilled(state, e, SHARED_COMBAT_CONTEXT);
      }
    }

    // Softly keep hero and enemies from collapsing onto identical coordinates
    resolveHeroEnemySeparation(state);

    // 10. Projectiles, Bloodstones, Hazards & Telegraphs
    tickProjectiles(state, dt, SHARED_COMBAT_CONTEXT, hooks);
    tickBloodstones(state, dt);
    tickHazards(state, dt, SHARED_COMBAT_CONTEXT, hooks);
    tickTelegraphs(state, dt);

    // 11. Floating numbers & Camera follow/shake
    tickFloatingNumbers(state, fixedDt);
    tickCamera(state, fixedDt);

    // 12. Room-clear check (fires once when final wave has zero living combat foes)
    if (
      !state.room.cleared &&
      state.room.combatStarted &&
      state.room.encounterKind !== 'hub' &&
      state.room.waveIndex + 1 >= state.room.totalWaves
    ) {
      const anyLiving = state.enemies.some(
        (e) => e.hp > 0 && e.aiState !== 'dead' && e.archetype !== 'rattlebones_dummy',
      );
      if (!anyLiving) {
        state.room.cleared = true;
        state.run.chambersCleared += 1;
        state.events.push({
          type: 'room_cleared',
          biome: state.room.biome,
          depth: state.room.depth,
        });
        if (hooks?.onRoomCleared) {
          hooks.onRoomCleared(state, SHARED_COMBAT_CONTEXT);
        }
      }
    }
  } finally {
    activeHooksForTick = undefined;
  }
}
