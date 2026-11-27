import {
  BOSS_CONSTANTS,
  type BossId,
  type EnemyState,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import {
  getBossConfig,
  type BossAttackMove,
  type BossRuntimeConfig,
} from '../data/bosses.js';
import { getKeepsakeValue } from '../data/keepsakes.js';
import {
  clampEnemyToArena,
  clearOwnerTelegraphs,
  createTelegraph,
  getEnemyDamageMultiplier,
  getEnemySpeedMultiplier,
  spawnEnemy,
  triggerEnemyJoltedOnAttack,
} from './enemies.js';
import {
  detNextFloat,
  detNextInt,
  getKeepsakeRank,
  type RngProvider,
  type SimCombatContext,
} from './meta.js';

// ============================================================================
// Boss Runtime Tracking (WeakMap keeps SimState 100% pure)
// ============================================================================

interface BossRuntimeState {
  currentMove: BossAttackMove;
  thresholdsTriggered: number;
  spiralShotsFired: number;
  spiralBaseAngle: number;
  dashDir: Vec2;
  bombCenters: Vec2[];
  attackStruck: boolean;
}

const bossRuntimeMap = new WeakMap<EnemyState, BossRuntimeState>();

function getBossRuntime(boss: EnemyState): BossRuntimeState {
  let rt = bossRuntimeMap.get(boss);
  if (!rt) {
    rt = {
      currentMove: 'lunge_dash',
      thresholdsTriggered: 0,
      spiralShotsFired: 0,
      spiralBaseAngle: 0,
      dashDir: { x: 1, y: 0 },
      bombCenters: [],
      attackStruck: false,
    };
    bossRuntimeMap.set(boss, rt);
  }
  return rt;
}

// ============================================================================
// Boss Spawning
// ============================================================================

export function spawnBoss(
  state: SimState,
  bossId: BossId,
  pos?: Vec2,
  ctx?: RngProvider
): EnemyState {
  const cfg = getBossConfig(bossId);
  const def = BOSS_CONSTANTS[bossId];

  const emRank = Math.max(
    0,
    Math.min(4, Math.floor(state.run.vows.extreme_measures ?? 0))
  );
  const calisthenicsRank = Math.max(
    0,
    Math.min(2, Math.floor(state.run.vows.calisthenics_program ?? 0))
  );
  const hpMult = 1 + calisthenicsRank * 0.15;

  const useEm4 = bossId === 'sovereign_lord' && emRank >= 4 && def.em4MaxHp;
  const maxHp = Math.round((useEm4 ? def.em4MaxHp! : def.maxHp) * hpMult);
  const maxPhases = useEm4 ? (def.em4Phases ?? 3) : def.phases;

  const spawnPos: Vec2 = pos
    ? { x: pos.x, y: pos.y }
    : { x: 0, y: Math.max(state.room.bounds.minY + 180, -200) };

  const id = `boss_${bossId}_${state.tick}_${detNextInt(state, 100, 999, ctx)}`;

  const boss: EnemyState = {
    id,
    archetype: bossId,
    name: def.displayName,
    isBoss: true,
    isMiniBoss: false,
    bossId,
    pos: spawnPos,
    vel: { x: 0, y: 0 },
    radius: cfg.radius,
    facingAngle: Math.atan2(
      state.player.pos.y - spawnPos.y,
      state.player.pos.x - spawnPos.x
    ),
    hp: maxHp,
    maxHp,
    armor: 0,
    maxArmor: 0,
    phase: 1,
    maxPhases,
    invulnerable: true,
    invulnTimer: 0.75,
    aiState: 'spawning',
    aiTimer: 0.75,
    attackCooldown: 0.8,
    attackPatternIdx: 0,
    stunTimer: 0,
    lodgedCasts: 0,
    lodgedCastTimers: [],
    statuses: [],
    hitFlashTimer: 0,
    hitstopTimer: 0,
    damageControlHits: Math.max(
      0,
      Math.min(2, Math.floor(state.run.vows.damage_control ?? 0))
    ),
  };

  // Evergreen Acorn keepsake grants boss-room hit shields
  if (state.player.keepsakeId === 'evergreen_acorn') {
    const rank = getKeepsakeRank(state.meta, 'evergreen_acorn');
    state.player.acornShields = getKeepsakeValue('evergreen_acorn', rank);
  }

  state.enemies.push(boss);
  state.events.push({
    type: 'enemy_spawn',
    enemyId: boss.id,
    archetype: boss.archetype,
    pos: { x: boss.pos.x, y: boss.pos.y },
    isBoss: true,
  });
  state.events.push({
    type: 'ui_toast',
    text: `${def.displayName} — ${def.title}`,
    colorHex: cfg.dangerColor,
  });

  return boss;
}

// ============================================================================
// Boss Phase Transitions & Pattern Execution
// ============================================================================

function enterBossPhaseTransition(
  state: SimState,
  boss: EnemyState,
  cfg: BossRuntimeConfig,
  thresholdIdx: number,
  ctx: SimCombatContext
): void {
  const rt = getBossRuntime(boss);
  clearOwnerTelegraphs(state, boss.id);

  boss.aiState = 'phase_transition';
  boss.invulnerable = true;
  boss.invulnTimer = cfg.phaseTransitionDuration;
  boss.aiTimer = cfg.phaseTransitionDuration;
  boss.vel.x = 0;
  boss.vel.y = 0;

  rt.spiralShotsFired = 0;
  rt.spiralBaseAngle = boss.facingAngle;

  // Shockwave warning ring during shield invuln
  createTelegraph(
    state,
    {
      kind: 'ring',
      pos: boss.pos,
      angle: 0,
      radius: 170,
      innerRadius: 65,
      duration: cfg.phaseTransitionDuration,
      dangerColor: cfg.accentColor,
      ownerId: boss.id,
    },
    ctx
  );

  // Summon escorts on later phases (Warden Malice spawns Numbskull escorts at 50% / 25%!)
  const emBonus = (state.run.vows.extreme_measures ?? 0) >= 1 ? 1 : 0;
  const escortCount =
    (cfg.escortCountByPhase[thresholdIdx] ?? 0) +
    (thresholdIdx >= 1 ? emBonus : 0);

  if (escortCount > 0) {
    const livingNonBoss = state.enemies.filter(
      (e) => !e.isBoss && e.aiState !== 'dead' && e.hp > 0
    ).length;
    const toSpawn = Math.max(0, Math.min(escortCount, 5 - livingNonBoss));
    for (let i = 0; i < toSpawn; i++) {
      const ang = (Math.PI * 2 * i) / Math.max(1, toSpawn) + 0.5;
      const sx = Math.max(
        state.room.bounds.minX + 120,
        Math.min(state.room.bounds.maxX - 120, boss.pos.x + Math.cos(ang) * 260)
      );
      const sy = Math.max(
        state.room.bounds.minY + 120,
        Math.min(state.room.bounds.maxY - 120, boss.pos.y + Math.sin(ang) * 190)
      );
      spawnEnemy(
        state,
        cfg.escortArchetype,
        { x: sx, y: sy },
        { parentBossId: boss.id },
        ctx
      );
    }
  }

  state.events.push({
    type: 'boss_phase',
    bossId: cfg.id,
    phase: rt.thresholdsTriggered + 1,
    pos: { x: boss.pos.x, y: boss.pos.y },
  });
  const line =
    cfg.phaseLines[Math.min(thresholdIdx, cfg.phaseLines.length - 1)] ??
    `${boss.name} surges with renewed fury!`;
  state.events.push({
    type: 'ui_toast',
    text: line,
    colorHex: cfg.dangerColor,
  });
  ctx.addCameraShake(state, 10, 0.35);
}

function checkBossPhaseThreshold(
  state: SimState,
  boss: EnemyState,
  cfg: BossRuntimeConfig,
  ctx: SimCombatContext
): boolean {
  const rt = getBossRuntime(boss);
  const thresholds = cfg.def.phaseThresholds;
  const hpRatio = boss.hp / Math.max(1, boss.maxHp);

  if (
    rt.thresholdsTriggered < thresholds.length &&
    hpRatio <= thresholds[rt.thresholdsTriggered]
  ) {
    const idx = rt.thresholdsTriggered;
    rt.thresholdsTriggered += 1;
    // Clamp boss HP cleanly to threshold on transition so burst doesn't skip phases
    boss.hp = Math.max(1, Math.round(boss.maxHp * thresholds[idx]));
    enterBossPhaseTransition(state, boss, cfg, idx, ctx);
    return true;
  }
  return false;
}

function tickBossPhaseTransition(
  state: SimState,
  boss: EnemyState,
  cfg: BossRuntimeConfig,
  dt: number,
  ctx: SimCombatContext
): void {
  const rt = getBossRuntime(boss);
  boss.aiTimer -= dt;
  boss.invulnerable = true;

  // Fire rotating bullet-spiral burst of 14 deflectable orbs across the 1.2s shield!
  const totalOrbs = cfg.spiralOrbCount;
  const elapsed = Math.max(0, cfg.phaseTransitionDuration - boss.aiTimer);
  const targetFired = Math.min(
    totalOrbs,
    Math.floor((elapsed / Math.max(0.1, cfg.phaseTransitionDuration * 0.9)) * totalOrbs) + 1
  );
  const orbDmg = Math.max(
    6,
    Math.round(cfg.baseDamage * 0.62 * getEnemyDamageMultiplier(state, boss))
  );

  while (rt.spiralShotsFired < targetFired) {
    const idx = rt.spiralShotsFired;
    rt.spiralShotsFired += 1;
    const ang = rt.spiralBaseAngle + (idx / totalOrbs) * Math.PI * 2 * 1.5;
    const speed = cfg.spiralOrbSpeed;

    ctx.spawnProjectile(state, {
      owner: 'enemy',
      ownerId: boss.id,
      kind: 'orb',
      pos: {
        x: boss.pos.x + Math.cos(ang) * (boss.radius + 14),
        y: boss.pos.y + Math.sin(ang) * (boss.radius + 14),
      },
      vel: { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed },
      startPos: { x: boss.pos.x, y: boss.pos.y },
      radius: 14,
      angle: ang,
      damage: orbDmg,
      range: 920,
      maxLife: 2.8,
      pierceLeft: 0,
      bouncesLeft: 0,
      deflectable: true,
      deflected: false,
      homingStrength: 0,
      isLob: false,
      lobHeight: 0,
      lobDuration: 0,
      lobElapsed: 0,
      colorHex: cfg.dangerColor,
    });
  }

  if (boss.aiTimer <= 0) {
    boss.invulnerable = false;
    boss.invulnTimer = 0;
    boss.aiState = 'chase';
    boss.attackCooldown = 0.35;
    clearOwnerTelegraphs(state, boss.id);
  }
}

function beginBossAttackWindup(
  state: SimState,
  boss: EnemyState,
  cfg: BossRuntimeConfig,
  speedMult: number,
  ctx: SimCombatContext
): void {
  const rt = getBossRuntime(boss);
  const move = cfg.attackSequence[boss.attackPatternIdx % cfg.attackSequence.length];
  boss.attackPatternIdx += 1;
  rt.currentMove = move;
  rt.attackStruck = false;
  rt.bombCenters = [];

  const player = state.player;
  const dx = player.pos.x - boss.pos.x;
  const dy = player.pos.y - boss.pos.y;
  const angle = Math.atan2(dy, dx);
  boss.facingAngle = angle;
  boss.aiState = 'windup';

  const rageSpeed = speedMult * (1 + rt.thresholdsTriggered * 0.08);

  if (move === 'lunge_dash') {
    const dur = Math.max(0.36, 0.58 / rageSpeed);
    boss.aiTimer = dur;
    rt.dashDir = { x: Math.cos(angle), y: Math.sin(angle) };
    createTelegraph(
      state,
      {
        kind: 'line',
        pos: boss.pos,
        angle,
        radius: 36,
        length: 540,
        width: 64,
        duration: dur,
        dangerColor: cfg.dangerColor,
        ownerId: boss.id,
      },
      ctx
    );
  } else if (move === 'whip_whirl' || move === 'radial_slam') {
    const dur = Math.max(0.45, 0.7 / rageSpeed);
    const radius = move === 'radial_slam' ? 270 : 240;
    boss.aiTimer = dur;
    createTelegraph(
      state,
      {
        kind: 'circle',
        pos: boss.pos,
        angle: 0,
        radius,
        duration: dur,
        dangerColor: cfg.dangerColor,
        ownerId: boss.id,
      },
      ctx
    );
  } else if (move === 'orb_spread') {
    const dur = Math.max(0.38, 0.55 / rageSpeed);
    boss.aiTimer = dur;
    createTelegraph(
      state,
      {
        kind: 'cone',
        pos: boss.pos,
        angle,
        radius: 360,
        arcDeg: 58,
        duration: dur,
        dangerColor: cfg.accentColor,
        ownerId: boss.id,
      },
      ctx
    );
  } else if (move === 'bomb_circles') {
    const dur = Math.max(0.68, 0.95 / rageSpeed);
    boss.aiTimer = dur;
    const count = 3 + Math.min(3, rt.thresholdsTriggered);
    const bounds = state.room.bounds;

    // First bomb right on player position, remaining flanking the arena
    for (let i = 0; i < count; i++) {
      let cx = player.pos.x;
      let cy = player.pos.y;
      if (i > 0) {
        const ringAngle =
          (Math.PI * 2 * (i - 1)) / Math.max(1, count - 1) +
          detNextFloat(state, ctx) * 0.6;
        const dist = 175 + detNextFloat(state, ctx) * 145;
        cx = player.pos.x + Math.cos(ringAngle) * dist;
        cy = player.pos.y + Math.sin(ringAngle) * dist;
      }
      cx = Math.max(bounds.minX + 120, Math.min(bounds.maxX - 120, cx));
      cy = Math.max(bounds.minY + 120, Math.min(bounds.maxY - 120, cy));
      const center = { x: cx, y: cy };
      rt.bombCenters.push(center);
      createTelegraph(
        state,
        {
          kind: 'circle',
          pos: center,
          angle: 0,
          radius: 112,
          duration: dur,
          dangerColor: cfg.dangerColor,
          ownerId: boss.id,
        },
        ctx
      );
    }
  } else {
    // spear_sweep
    const dur = Math.max(0.42, 0.62 / rageSpeed);
    boss.aiTimer = dur;
    createTelegraph(
      state,
      {
        kind: 'cone',
        pos: boss.pos,
        angle,
        radius: 295,
        arcDeg: 145,
        duration: dur,
        dangerColor: cfg.dangerColor,
        ownerId: boss.id,
      },
      ctx
    );
  }
}

function executeBossAttackTick(
  state: SimState,
  boss: EnemyState,
  cfg: BossRuntimeConfig,
  speedMult: number,
  ctx: SimCombatContext
): void {
  const rt = getBossRuntime(boss);
  const player = state.player;
  const dmg = Math.max(
    1,
    Math.round(cfg.baseDamage * getEnemyDamageMultiplier(state, boss))
  );

  if (rt.currentMove === 'lunge_dash') {
    const dashSpeed = 1240 * speedMult;
    boss.vel.x = rt.dashDir.x * dashSpeed;
    boss.vel.y = rt.dashDir.y * dashSpeed;

    if (!rt.attackStruck) {
      const dx = player.pos.x - boss.pos.x;
      const dy = player.pos.y - boss.pos.y;
      const hitDist = boss.radius + 38;
      if (dx * dx + dy * dy <= hitDist * hitDist) {
        rt.attackStruck = true;
        ctx.dealDamageToPlayer(state, dmg, {
          source: 'enemy',
          fromPos: boss.pos,
        });
        ctx.addCameraShake(state, 7, 0.16);
      }
    }
    return;
  }

  if (rt.currentMove === 'whip_whirl' || rt.currentMove === 'radial_slam') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      const radius = rt.currentMove === 'radial_slam' ? 275 : 245;
      const dx = player.pos.x - boss.pos.x;
      const dy = player.pos.y - boss.pos.y;
      if (dx * dx + dy * dy <= (radius + 16) ** 2) {
        ctx.dealDamageToPlayer(state, Math.round(dmg * 1.1), {
          source: 'enemy',
          fromPos: boss.pos,
        });
      }
      ctx.addCameraShake(state, 8, 0.22);
    }
    return;
  }

  if (rt.currentMove === 'orb_spread') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      const orbCount = rt.thresholdsTriggered >= 2 ? 5 : 3;
      const step = 0.22;
      const startAng = boss.facingAngle - ((orbCount - 1) * step) * 0.5;
      const speed = 490 * speedMult;
      const orbDmg = Math.max(8, Math.round(dmg * 0.68));

      for (let i = 0; i < orbCount; i++) {
        const ang = startAng + i * step;
        ctx.spawnProjectile(state, {
          owner: 'enemy',
          ownerId: boss.id,
          kind: 'orb',
          pos: {
            x: boss.pos.x + Math.cos(ang) * (boss.radius + 12),
            y: boss.pos.y + Math.sin(ang) * (boss.radius + 12),
          },
          vel: { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed },
          startPos: { x: boss.pos.x, y: boss.pos.y },
          radius: 14,
          angle: ang,
          damage: orbDmg,
          range: 920,
          maxLife: 2.5,
          pierceLeft: 0,
          bouncesLeft: 0,
          deflectable: true,
          deflected: false,
          homingStrength: 0,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          colorHex: cfg.accentColor,
        });
      }
    }
    return;
  }

  if (rt.currentMove === 'bomb_circles') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      let hit = false;
      for (const center of rt.bombCenters) {
        const dx = player.pos.x - center.x;
        const dy = player.pos.y - center.y;
        if (!hit && dx * dx + dy * dy <= 118 * 118) {
          hit = true;
          ctx.dealDamageToPlayer(state, dmg, {
            source: 'enemy',
            fromPos: center,
          });
        }
        // Brief visual detonation pulse
        ctx.spawnProjectile(state, {
          owner: 'hazard',
          ownerId: boss.id,
          kind: 'wave',
          pos: { x: center.x, y: center.y },
          vel: { x: 0, y: 0 },
          startPos: { x: center.x, y: center.y },
          radius: 64,
          angle: 0,
          damage: 0,
          range: 10,
          maxLife: 0.24,
          pierceLeft: 99,
          bouncesLeft: 0,
          deflectable: false,
          deflected: false,
          homingStrength: 0,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          aoeRadius: 112,
          colorHex: cfg.dangerColor,
        });
      }
      ctx.addCameraShake(state, 9, 0.25);
    }
    return;
  }

  // spear_sweep
  if (!rt.attackStruck) {
    rt.attackStruck = true;
    const dx = player.pos.x - boss.pos.x;
    const dy = player.pos.y - boss.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let angDiff = Math.atan2(dy, dx) - boss.facingAngle;
    while (angDiff > Math.PI) angDiff -= Math.PI * 2;
    while (angDiff < -Math.PI) angDiff += Math.PI * 2;
    if (dist <= 305 && Math.abs(angDiff) <= 1.35) {
      ctx.dealDamageToPlayer(state, Math.round(dmg * 1.15), {
        source: 'enemy',
        fromPos: boss.pos,
      });
    }
    ctx.addCameraShake(state, 8, 0.2);
  }
}

export function tryTriggerMultiBarBossRevive(
  state: SimState,
  boss: EnemyState,
  ctx: SimCombatContext
): boolean {
  if (!boss.isBoss || !boss.bossId) return false;
  if (boss.phase >= boss.maxPhases) return false;

  const cfg = getBossConfig(boss.bossId);
  boss.phase += 1;
  boss.hp = boss.maxHp;
  boss.aiState = 'phase_transition';
  const rt = getBossRuntime(boss);
  rt.thresholdsTriggered = 0;
  enterBossPhaseTransition(state, boss, cfg, boss.phase - 2, ctx);
  return true;
}

export function tickBosses(
  state: SimState,
  dt: number,
  ctx: SimCombatContext
): void {
  const player = state.player;

  for (const boss of state.enemies) {
    if (!boss.isBoss || !boss.bossId) continue;
    if (boss.aiState === 'dead' || boss.hp <= 0) {
      if (boss.phase < boss.maxPhases) {
        tryTriggerMultiBarBossRevive(state, boss, ctx);
        continue;
      }
      boss.aiState = 'dead';
      continue;
    }

    const cfg = getBossConfig(boss.bossId);
    const rt = getBossRuntime(boss);

    if (boss.hitstopTimer > 0) {
      boss.hitstopTimer = Math.max(0, boss.hitstopTimer - dt);
      continue;
    }

    if (boss.aiState === 'spawning') {
      boss.aiTimer -= dt;
      if (boss.aiTimer <= 0) {
        boss.invulnerable = false;
        boss.invulnTimer = 0;
        boss.aiState = 'chase';
      }
      continue;
    }

    if (boss.aiState === 'phase_transition') {
      tickBossPhaseTransition(state, boss, cfg, dt, ctx);
      continue;
    }

    // Check 75% / 50% / 25% phase thresholds immediately
    if (checkBossPhaseThreshold(state, boss, cfg, ctx)) {
      continue;
    }

    if (boss.invulnTimer > 0) {
      boss.invulnTimer = Math.max(0, boss.invulnTimer - dt);
      if (boss.invulnTimer <= 0) {
        boss.invulnerable = false;
      }
    }

    const speedMult = getEnemySpeedMultiplier(state, boss);
    if (boss.attackCooldown > 0) {
      boss.attackCooldown = Math.max(0, boss.attackCooldown - dt * speedMult);
    }

    if (boss.stunTimer > 0) {
      // Bosses suffer reduced stun duration (50%)
      boss.stunTimer = Math.max(0, boss.stunTimer - dt * 1.6);
      boss.vel.x *= Math.pow(0.06, dt);
      boss.vel.y *= Math.pow(0.06, dt);
      continue;
    }

    if (boss.aiState === 'windup') {
      boss.vel.x *= Math.pow(0.04, dt);
      boss.vel.y *= Math.pow(0.04, dt);
      boss.aiTimer -= dt;
      if (boss.aiTimer <= 0) {
        clearOwnerTelegraphs(state, boss.id);
        triggerEnemyJoltedOnAttack(state, boss, ctx);
        if (boss.hp <= 0) continue;
        boss.aiState = 'attack';
        boss.aiTimer = rt.currentMove === 'lunge_dash' ? 0.4 : 0.22;
      }
    } else if (boss.aiState === 'attack') {
      boss.aiTimer -= dt;
      executeBossAttackTick(state, boss, cfg, speedMult, ctx);
      if (boss.aiTimer <= 0) {
        boss.aiState = 'recover';
        boss.aiTimer = Math.max(
          0.32,
          (0.62 - rt.thresholdsTriggered * 0.08) / speedMult
        );
        boss.attackCooldown = Math.max(
          0.35,
          0.78 - rt.thresholdsTriggered * 0.12
        );
      }
    } else if (boss.aiState === 'recover') {
      boss.vel.x *= Math.pow(0.04, dt);
      boss.vel.y *= Math.pow(0.04, dt);
      boss.aiTimer -= dt;
      if (boss.aiTimer <= 0) {
        boss.aiState = 'chase';
      }
    } else {
      // Aggressive stalking / positioning
      const dx = player.pos.x - boss.pos.x;
      const dy = player.pos.y - boss.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ang = Math.atan2(dy, dx);
      boss.facingAngle = ang;

      if (!player.isDead && boss.attackCooldown <= 0 && dist <= 720) {
        beginBossAttackWindup(state, boss, cfg, speedMult, ctx);
      } else if (!player.isDead && dist > 90) {
        const moveSpd =
          cfg.moveSpeed * speedMult * (1 + rt.thresholdsTriggered * 0.08);
        const targetVx = Math.cos(ang) * moveSpd;
        const targetVy = Math.sin(ang) * moveSpd;
        const blend = Math.min(1, dt * 6);
        boss.vel.x += (targetVx - boss.vel.x) * blend;
        boss.vel.y += (targetVy - boss.vel.y) * blend;
      }
    }

    boss.pos.x += boss.vel.x * dt;
    boss.pos.y += boss.vel.y * dt;
    clampEnemyToArena(state, boss, true);
  }
}
