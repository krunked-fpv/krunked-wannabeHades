import {
  BOSS_CONSTANTS,
  PATRON_CONSTANTS,
  type BossId,
  type EnemyState,
  type PatronId,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import {
  getBossConfig,
  type BossAttackMove,
  type BossRuntimeConfig,
} from '../data/bosses.js';
import { WAVE1_PATRONS } from '../data/boons.js';
import { getKeepsakeValue } from '../data/keepsakes.js';
import {
  clampEnemyToArena,
  clearOwnerTelegraphs,
  createTelegraph,
  getEnemyDamageMultiplier,
  getEnemySpeedMultiplier,
  setHydraHeadVariant,
  spawnEnemy,
  triggerEnemyJoltedOnAttack,
  type HydraHeadVariant,
} from './enemies.js';
import {
  detNextFloat,
  detNextInt,
  detPick,
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
  leapStart: Vec2;
  leapTarget: Vec2;
  bombCenters: Vec2[];
  beamBaseAngle: number;
  beamTickAcc: number;
  comboHitsDone: number;
  attackStruck: boolean;
  waitingForHydraHeads: boolean;
  spearlordPatron: PatronId;
  cloakActive: boolean;
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
      leapStart: { x: boss.pos.x, y: boss.pos.y },
      leapTarget: { x: boss.pos.x, y: boss.pos.y },
      bombCenters: [],
      beamBaseAngle: 0,
      beamTickAcc: 0,
      comboHitsDone: 0,
      attackStruck: false,
      waitingForHydraHeads: false,
      spearlordPatron: 'voltaris',
      cloakActive: false,
    };
    bossRuntimeMap.set(boss, rt);
  }
  return rt;
}

// ============================================================================
// Pillar Line-of-Sight Ray Check (Sovereign Lord Phase 2 Brimstone Beams!)
// ============================================================================

function rayBlockedByPillar(
  state: SimState,
  origin: Vec2,
  target: Vec2
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const segLen = Math.hypot(dx, dy);
  if (segLen < 1) return false;

  for (const obs of state.room.obstacles) {
    if (!obs.blocksProjectiles) continue;
    if (obs.destructible && (obs.hp ?? 1) <= 0) continue;

    // Slab intersection test between segment [origin -> target] and obstacle AABB
    const minX = obs.pos.x - obs.halfW;
    const maxX = obs.pos.x + obs.halfW;
    const minY = obs.pos.y - obs.halfH;
    const maxY = obs.pos.y + obs.halfH;

    let tMin = 0;
    let tMax = 1;

    if (Math.abs(dx) < 1e-6) {
      if (origin.x < minX || origin.x > maxX) continue;
    } else {
      let t1 = (minX - origin.x) / dx;
      let t2 = (maxX - origin.x) / dx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }

    if (Math.abs(dy) < 1e-6) {
      if (origin.y < minY || origin.y > maxY) continue;
    } else {
      let t1 = (minY - origin.y) / dy;
      let t2 = (maxY - origin.y) / dy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }

    if (tMin < 1 && tMax > 0) {
      return true;
    }
  }
  return false;
}

function pointToRayDistance(
  origin: Vec2,
  angle: number,
  maxLen: number,
  point: Vec2
): number {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const vx = point.x - origin.x;
  const vy = point.y - origin.y;
  const along = vx * dirX + vy * dirY;
  if (along < 0 || along > maxLen) return Infinity;
  return Math.abs(vx * -dirY + vy * dirX);
}

// ============================================================================
// Boss Spawning (including Dual Colosseum Champions!)
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
    : { x: 0, y: Math.max(state.room.bounds.minY + 185, -210) };

  const id = `boss_${bossId}_${state.tick}_${state.enemies.length}_${detNextInt(state, 100, 999, ctx)}`;

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

  if (bossId === 'colosseum_spearlord') {
    getBossRuntime(boss).spearlordPatron = detPick(state, WAVE1_PATRONS, ctx);
  }

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

/**
 * Verdant Colosseum Dual Boss Encounter: Spawns BOTH The Bull (14000 HP)
 * and The Spearlord (9000 HP) simultaneously!
 */
export function spawnDualColosseumChampions(
  state: SimState,
  ctx?: RngProvider
): [EnemyState, EnemyState] {
  const bull = spawnBoss(state, 'colosseum_bull', { x: -240, y: -200 }, ctx);
  const spearlord = spawnBoss(
    state,
    'colosseum_spearlord',
    { x: 240, y: -200 },
    ctx
  );
  state.events.push({
    type: 'ui_toast',
    text: 'THE CHAMPIONS OF THE COLOSSEUM AWAIT!',
    colorHex: '#ffd043',
  });
  return [bull, spearlord];
}

// ============================================================================
// Boss Phase Transitions & Specialized Arena Effects
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
  boss.invulnTimer = cfg.shieldUntilEscortsDead ? 999 : cfg.phaseTransitionDuration;
  boss.aiTimer = cfg.phaseTransitionDuration;
  boss.vel.x = 0;
  boss.vel.y = 0;

  rt.spiralShotsFired = 0;
  rt.spiralBaseAngle = boss.facingAngle;

  // Warden Murder shrinks playable arena bounds on each phase transition!
  if (cfg.shrinksArenaOnPhase) {
    const b = state.room.bounds;
    const minWidth = 760;
    const minHeight = 560;
    if (b.maxX - b.minX > minWidth) {
      b.minX += 110;
      b.maxX -= 110;
    }
    if (b.maxY - b.minY > minHeight) {
      b.minY += 75;
      b.maxY -= 75;
    }
    state.player.pos.x = Math.max(
      b.minX + 64,
      Math.min(b.maxX - 64, state.player.pos.x)
    );
    state.player.pos.y = Math.max(
      b.minY + 64,
      Math.min(b.maxY - 64, state.player.pos.y)
    );
  }

  // Warden Fury spawns orbiting Arena Sawblades on transition!
  if (cfg.id === 'warden_fury') {
    const sawCount = 2 + thresholdIdx;
    for (let s = 0; s < sawCount; s++) {
      const ang = (Math.PI * 2 * s) / sawCount;
      state.room.hazards.push({
        id: `saw_${state.tick}_${s}`,
        kind: 'sawblade',
        pos: {
          x: boss.pos.x + Math.cos(ang) * 180,
          y: boss.pos.y + Math.sin(ang) * 130,
        },
        radius: 34,
        active: true,
        armed: true,
        timer: 9.0,
        cooldown: ang, // stores travel heading cleanly
        damage: 14,
        owner: 'enemy',
      });
    }
  }

  createTelegraph(
    state,
    {
      kind: 'ring',
      pos: boss.pos,
      angle: 0,
      radius: 175,
      innerRadius: 65,
      duration: cfg.phaseTransitionDuration,
      dangerColor: cfg.accentColor,
      ownerId: boss.id,
    },
    ctx
  );

  // Summon escorts / Bone Leviathan auxiliary Hydra Heads
  const emRank = Math.max(0, Math.min(4, Math.floor(state.run.vows.extreme_measures ?? 0)));
  if (cfg.shieldUntilEscortsDead && cfg.id === 'bone_leviathan') {
    rt.waitingForHydraHeads = true;
    const headCount =
      (cfg.escortCountByPhase[thresholdIdx] ?? 3) + (emRank >= 2 ? 1 : 0);
    const variants: readonly HydraHeadVariant[] = ['dart', 'wave', 'lava', 'slam'];
    for (let i = 0; i < headCount; i++) {
      const spread = (i / Math.max(1, headCount - 1) - 0.5) * 1.9;
      const sx = Math.max(
        state.room.bounds.minX + 140,
        Math.min(state.room.bounds.maxX - 140, spread * 540)
      );
      const sy = Math.max(
        state.room.bounds.minY + 150,
        Math.min(state.room.bounds.maxY - 170, -80 + Math.abs(spread) * 180)
      );
      const variant = variants[i % variants.length];
      const head = spawnEnemy(
        state,
        'bone_hydra_head',
        { x: sx, y: sy },
        { parentBossId: boss.id, hydraVariant: variant },
        ctx
      );
      setHydraHeadVariant(head, variant);
    }
  } else {
    const emBonus = emRank >= 1 ? 1 : 0;
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
  }

  state.events.push({
    type: 'boss_phase',
    bossId: cfg.id,
    phase: boss.maxPhases > 1 ? boss.phase : rt.thresholdsTriggered + 1,
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

  // Fire rotating bullet-spiral burst of deflectable orbs across transition!
  const totalOrbs = cfg.spiralOrbCount;
  const elapsed = Math.max(0, cfg.phaseTransitionDuration - Math.max(0, boss.aiTimer));
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

  // Bone Leviathan remains invulnerable until ALL summoned Hydra Heads are slain!
  if (rt.waitingForHydraHeads) {
    const livingHeads = state.enemies.filter(
      (e) =>
        e.archetype === 'bone_hydra_head' &&
        e.parentBossId === boss.id &&
        e.aiState !== 'dead' &&
        e.hp > 0
    ).length;
    if (livingHeads > 0) {
      boss.invulnTimer = 0.5;
      return;
    }
    rt.waitingForHydraHeads = false;
    state.events.push({
      type: 'ui_toast',
      text: "Bone Leviathan's shield shatters!",
      colorHex: '#ffae42',
    });
    ctx.triggerHitstop(state, 0.05, 0.1);
    ctx.addCameraShake(state, 10, 0.25);
  }

  if (boss.aiTimer <= 0) {
    boss.invulnerable = false;
    boss.invulnTimer = 0;
    boss.aiState = 'chase';
    boss.attackCooldown = 0.35;
    clearOwnerTelegraphs(state, boss.id);
  }
}

// ============================================================================
// Boss Attack Pattern Windups & Executions (ALL 8 BOSSES)
// ============================================================================

function pickBossMoveSequence(
  boss: EnemyState,
  cfg: BossRuntimeConfig,
  rt: BossRuntimeState
): readonly BossAttackMove[] {
  const inPhase2Plus = boss.phase >= 2 || rt.thresholdsTriggered >= 1;
  if (inPhase2Plus && cfg.phase2AttackSequence && cfg.phase2AttackSequence.length > 0) {
    return cfg.phase2AttackSequence;
  }
  return cfg.attackSequence;
}

function beginBossAttackWindup(
  state: SimState,
  boss: EnemyState,
  cfg: BossRuntimeConfig,
  speedMult: number,
  ctx: SimCombatContext
): void {
  const rt = getBossRuntime(boss);
  const seq = pickBossMoveSequence(boss, cfg, rt);
  const move = seq[boss.attackPatternIdx % seq.length];
  boss.attackPatternIdx += 1;
  rt.currentMove = move;
  rt.attackStruck = false;
  rt.bombCenters = [];
  rt.comboHitsDone = 0;
  rt.beamTickAcc = 0;
  rt.cloakActive = false;

  const player = state.player;
  const dx = player.pos.x - boss.pos.x;
  const dy = player.pos.y - boss.pos.y;
  const angle = Math.atan2(dy, dx);
  boss.facingAngle = angle;
  boss.aiState = 'windup';

  const rageSpeed = speedMult * (1 + rt.thresholdsTriggered * 0.08 + (boss.phase - 1) * 0.12);

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
        length: 560,
        width: 68,
        duration: dur,
        dangerColor: cfg.dangerColor,
        ownerId: boss.id,
      },
      ctx
    );
  } else if (move === 'whip_whirl' || move === 'radial_slam') {
    const dur = Math.max(0.45, 0.7 / rageSpeed);
    const radius =
      cfg.id === 'sovereign_lord'
        ? 295
        : move === 'radial_slam'
          ? 275
          : 240;
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
  } else if (move === 'orb_spread' || move === 'murder_laser' || move === 'sovereign_skulls') {
    const dur = Math.max(0.38, 0.56 / rageSpeed);
    boss.aiTimer = dur;
    createTelegraph(
      state,
      {
        kind: 'cone',
        pos: boss.pos,
        angle,
        radius: 380,
        arcDeg: move === 'murder_laser' ? 42 : 62,
        duration: dur,
        dangerColor: cfg.accentColor,
        ownerId: boss.id,
      },
      ctx
    );
  } else if (move === 'sawblade_barrage') {
    const dur = Math.max(0.4, 0.58 / rageSpeed);
    boss.aiTimer = dur;
    createTelegraph(
      state,
      {
        kind: 'ring',
        pos: boss.pos,
        angle: 0,
        radius: 190,
        innerRadius: 70,
        duration: dur,
        dangerColor: '#ff7043',
        ownerId: boss.id,
      },
      ctx
    );
  } else if (move === 'bull_combo') {
    const dur = Math.max(0.38, 0.56 / rageSpeed);
    boss.aiTimer = dur;
    createTelegraph(
      state,
      {
        kind: 'cone',
        pos: boss.pos,
        angle,
        radius: 265,
        arcDeg: 150,
        duration: dur,
        dangerColor: cfg.dangerColor,
        ownerId: boss.id,
      },
      ctx
    );
  } else if (move === 'bull_leap') {
    const dur = Math.max(0.55, 0.78 / rageSpeed);
    boss.aiTimer = dur;
    rt.leapStart = { x: boss.pos.x, y: boss.pos.y };
    rt.leapTarget = { x: player.pos.x, y: player.pos.y };
    createTelegraph(
      state,
      {
        kind: 'circle',
        pos: rt.leapTarget,
        angle: 0,
        radius: 195,
        duration: dur,
        dangerColor: cfg.dangerColor,
        ownerId: boss.id,
      },
      ctx
    );
  } else if (move === 'bomb_circles' || move === 'spearlord_call') {
    const dur = Math.max(0.68, 0.95 / rageSpeed);
    boss.aiTimer = dur;
    const count = move === 'spearlord_call' ? 6 : 3 + Math.min(3, rt.thresholdsTriggered);
    const bounds = state.room.bounds;
    const color =
      move === 'spearlord_call'
        ? PATRON_CONSTANTS[rt.spearlordPatron].colorHex
        : cfg.dangerColor;

    for (let i = 0; i < count; i++) {
      let cx = player.pos.x;
      let cy = player.pos.y;
      if (i > 0) {
        const ringAngle =
          (Math.PI * 2 * (i - 1)) / Math.max(1, count - 1) +
          detNextFloat(state, ctx) * 0.6;
        const dist = 175 + detNextFloat(state, ctx) * 165;
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
          radius: move === 'spearlord_call' ? 128 : 112,
          duration: dur,
          dangerColor: color,
          ownerId: boss.id,
        },
        ctx
      );
    }
  } else if (move === 'ferryman_mist_wall') {
    const dur = Math.max(0.45, 0.68 / rageSpeed);
    boss.aiTimer = dur;
    createTelegraph(
      state,
      {
        kind: 'line',
        pos: boss.pos,
        angle,
        radius: 40,
        length: 620,
        width: 240,
        duration: dur,
        dangerColor: '#9c4dff',
        ownerId: boss.id,
      },
      ctx
    );
  } else if (move === 'sovereign_cloak') {
    // Darkness Cloak Ambush: vanishes briefly, reappears flanking player, then lunges!
    const dur = 0.72;
    boss.aiTimer = dur;
    boss.invulnerable = true;
    boss.invulnTimer = dur;
    rt.cloakActive = true;
    state.events.push({
      type: 'ui_toast',
      text: 'Sovereign Lord vanishes into Darkness!',
      colorHex: '#9c4dff',
    });
  } else if (move === 'sovereign_beams') {
    // Phase 2 Signature: 360° Sweeping Brimstone Beams (Pillars block rays!)
    const dur = 0.85;
    boss.aiTimer = dur;
    rt.beamBaseAngle = angle;
    const beamCount = boss.phase >= 3 ? 6 : 4;
    for (let b = 0; b < beamCount; b++) {
      const bAng = rt.beamBaseAngle + (Math.PI * 2 * b) / beamCount;
      createTelegraph(
        state,
        {
          kind: 'line',
          pos: boss.pos,
          angle: bAng,
          radius: 26,
          length: 920,
          width: 42,
          duration: dur,
          dangerColor: '#ff2a3c',
          ownerId: boss.id,
        },
        ctx
      );
    }
  } else if (move === 'sovereign_urns') {
    const dur = 0.65;
    boss.aiTimer = dur;
    createTelegraph(
      state,
      {
        kind: 'ring',
        pos: boss.pos,
        angle: 0,
        radius: 210,
        innerRadius: 90,
        duration: dur,
        dangerColor: '#52ffb4',
        ownerId: boss.id,
      },
      ctx
    );
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
        radius: 300,
        arcDeg: 150,
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
  dt: number,
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
    const dashSpeed =
      (1240 + (cfg.rageSpeedBonusPerPhase ?? 0) * rt.thresholdsTriggered) * speedMult;
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

  if (rt.currentMove === 'bull_leap') {
    const totalDur = 0.34;
    const t = Math.min(1, 1 - boss.aiTimer / totalDur);
    boss.pos.x = rt.leapStart.x + (rt.leapTarget.x - rt.leapStart.x) * t;
    boss.pos.y = rt.leapStart.y + (rt.leapTarget.y - rt.leapStart.y) * t;

    if (!rt.attackStruck && t >= 0.9) {
      rt.attackStruck = true;
      const dx = player.pos.x - rt.leapTarget.x;
      const dy = player.pos.y - rt.leapTarget.y;
      if (dx * dx + dy * dy <= 200 * 200) {
        ctx.dealDamageToPlayer(state, Math.round(dmg * 1.2), {
          source: 'enemy',
          fromPos: rt.leapTarget,
        });
      }
      // Phase 2 @ 50% erupts shockwave orbs on every leap!
      if (rt.thresholdsTriggered >= 1) {
        for (let k = 0; k < 6; k++) {
          const ang = (Math.PI * 2 * k) / 6;
          ctx.spawnProjectile(state, {
            owner: 'enemy',
            ownerId: boss.id,
            kind: 'wave',
            pos: { x: rt.leapTarget.x, y: rt.leapTarget.y },
            vel: { x: Math.cos(ang) * 440, y: Math.sin(ang) * 440 },
            startPos: { x: rt.leapTarget.x, y: rt.leapTarget.y },
            radius: 16,
            angle: ang,
            damage: Math.round(dmg * 0.65),
            range: 640,
            maxLife: 1.7,
            pierceLeft: 0,
            bouncesLeft: 0,
            deflectable: true,
            deflected: false,
            homingStrength: 0,
            isLob: false,
            lobHeight: 0,
            lobDuration: 0,
            lobElapsed: 0,
            colorHex: '#ffd166',
          });
        }
      }
      ctx.addCameraShake(state, 10, 0.25);
    }
    return;
  }

  if (rt.currentMove === 'bull_combo') {
    const expected = Math.min(3, Math.floor((0.6 - boss.aiTimer) / 0.18) + 1);
    while (rt.comboHitsDone < expected) {
      rt.comboHitsDone += 1;
      const dx = player.pos.x - boss.pos.x;
      const dy = player.pos.y - boss.pos.y;
      const ang = Math.atan2(dy, dx);
      boss.facingAngle = ang;
      boss.vel.x = Math.cos(ang) * 340;
      boss.vel.y = Math.sin(ang) * 340;
      if (dx * dx + dy * dy <= 270 * 270) {
        ctx.dealDamageToPlayer(state, Math.round(dmg * 0.85), {
          source: 'enemy',
          fromPos: boss.pos,
        });
      }
      ctx.addCameraShake(state, 6, 0.14);
    }
    return;
  }

  if (rt.currentMove === 'whip_whirl' || rt.currentMove === 'radial_slam') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      const radius =
        cfg.id === 'sovereign_lord'
          ? 300
          : rt.currentMove === 'radial_slam'
            ? 275
            : 245;
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

  if (rt.currentMove === 'orb_spread' || rt.currentMove === 'murder_laser') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      const isLaser = rt.currentMove === 'murder_laser';
      const orbCount = isLaser ? 5 : rt.thresholdsTriggered >= 2 ? 5 : 3;
      const step = isLaser ? 0.16 : 0.22;
      const startAng = boss.facingAngle - ((orbCount - 1) * step) * 0.5;
      const speed = (isLaser ? 780 : 490) * speedMult;
      const orbDmg = Math.max(8, Math.round(dmg * 0.68));

      for (let i = 0; i < orbCount; i++) {
        const ang = startAng + i * step;
        ctx.spawnProjectile(state, {
          owner: 'enemy',
          ownerId: boss.id,
          kind: isLaser ? 'laser' : 'orb',
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

  if (rt.currentMove === 'sawblade_barrage') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      for (let s = 0; s < 3; s++) {
        const ang = boss.facingAngle + (s - 1) * 0.45;
        state.room.hazards.push({
          id: `saw_${state.tick}_${state.room.hazards.length}_${s}`,
          kind: 'sawblade',
          pos: {
            x: boss.pos.x + Math.cos(ang) * 70,
            y: boss.pos.y + Math.sin(ang) * 70,
          },
          radius: 34,
          active: true,
          armed: true,
          timer: 6.5,
          cooldown: ang,
          damage: Math.round(dmg * 0.75),
          owner: 'enemy',
        });
      }
      ctx.addCameraShake(state, 6, 0.18);
    }
    return;
  }

  if (rt.currentMove === 'ferryman_mist_wall') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      const perpX = -Math.sin(boss.facingAngle);
      const perpY = Math.cos(boss.facingAngle);
      const fwdX = Math.cos(boss.facingAngle);
      const fwdY = Math.sin(boss.facingAngle);
      const speed = 340 * speedMult;
      const orbDmg = Math.max(12, Math.round(dmg * 0.78));

      // 7-orb mist wall with a guaranteed navigable dodge gap!
      const gapIdx = detNextInt(state, 1, 5, ctx);
      for (let i = 0; i < 7; i++) {
        if (i === gapIdx) continue;
        const offset = (i - 3) * 84;
        ctx.spawnProjectile(state, {
          owner: 'enemy',
          ownerId: boss.id,
          kind: 'orb',
          pos: {
            x: boss.pos.x + perpX * offset,
            y: boss.pos.y + perpY * offset,
          },
          vel: { x: fwdX * speed, y: fwdY * speed },
          startPos: { x: boss.pos.x, y: boss.pos.y },
          radius: 22,
          angle: boss.facingAngle,
          damage: orbDmg,
          range: 1100,
          maxLife: 3.4,
          pierceLeft: 0,
          bouncesLeft: 0,
          deflectable: true,
          deflected: false,
          homingStrength: 0,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          colorHex: '#9c4dff',
        });
      }
      ctx.addCameraShake(state, 7, 0.2);
    }
    return;
  }

  if (rt.currentMove === 'sovereign_skulls') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      const skullCount = boss.phase >= 2 ? 4 : 3;
      const step = 0.36;
      const startAng = boss.facingAngle - ((skullCount - 1) * step) * 0.5;
      for (let i = 0; i < skullCount; i++) {
        const ang = startAng + i * step;
        ctx.spawnProjectile(state, {
          owner: 'enemy',
          ownerId: boss.id,
          kind: 'skull',
          pos: {
            x: boss.pos.x + Math.cos(ang) * (boss.radius + 16),
            y: boss.pos.y + Math.sin(ang) * (boss.radius + 16),
          },
          vel: { x: Math.cos(ang) * 470, y: Math.sin(ang) * 470 },
          startPos: { x: boss.pos.x, y: boss.pos.y },
          radius: 17,
          angle: ang,
          damage: Math.round(dmg * 0.8),
          range: 880,
          maxLife: 2.3,
          pierceLeft: 0,
          bouncesLeft: 0,
          deflectable: true,
          deflected: false,
          homingStrength: 0,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          aoeRadius: 120,
          colorHex: '#ff2a3c',
        });
      }
      ctx.addCameraShake(state, 6, 0.16);
    }
    return;
  }

  if (rt.currentMove === 'sovereign_cloak') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      boss.invulnerable = false;
      boss.invulnTimer = 0;
      const ambushAng = detNextFloat(state, ctx) * Math.PI * 2;
      boss.pos.x = player.pos.x + Math.cos(ambushAng) * 210;
      boss.pos.y = player.pos.y + Math.sin(ambushAng) * 150;
      clampEnemyToArena(state, boss, true);
      boss.facingAngle = Math.atan2(
        player.pos.y - boss.pos.y,
        player.pos.x - boss.pos.x
      );
      rt.dashDir = { x: Math.cos(boss.facingAngle), y: Math.sin(boss.facingAngle) };
      boss.vel.x = rt.dashDir.x * 1150;
      boss.vel.y = rt.dashDir.y * 1150;
      const dx = player.pos.x - boss.pos.x;
      const dy = player.pos.y - boss.pos.y;
      if (dx * dx + dy * dy <= 240 * 240) {
        ctx.dealDamageToPlayer(state, dmg, {
          source: 'enemy',
          fromPos: boss.pos,
        });
      }
      ctx.addCameraShake(state, 8, 0.22);
    }
    return;
  }

  if (rt.currentMove === 'sovereign_beams') {
    // 360° Sweeping Brimstone Beams — Pillars block ray damage!
    const beamCount = boss.phase >= 3 ? 6 : 4;
    const sweepSpeed = boss.phase >= 3 ? 0.92 : 0.68;
    rt.beamBaseAngle += sweepSpeed * dt;
    rt.beamTickAcc += dt;

    if (rt.beamTickAcc >= 0.16) {
      rt.beamTickAcc -= 0.16;
      const pillarBlocked = rayBlockedByPillar(state, boss.pos, player.pos);
      for (let b = 0; b < beamCount; b++) {
        const bAng = rt.beamBaseAngle + (Math.PI * 2 * b) / beamCount;
        // Visual laser beam bolt
        ctx.spawnProjectile(state, {
          owner: 'hazard',
          ownerId: boss.id,
          kind: 'beam',
          pos: {
            x: boss.pos.x + Math.cos(bAng) * (boss.radius + 10),
            y: boss.pos.y + Math.sin(bAng) * (boss.radius + 10),
          },
          vel: { x: Math.cos(bAng) * 1450, y: Math.sin(bAng) * 1450 },
          startPos: { x: boss.pos.x, y: boss.pos.y },
          radius: 14,
          angle: bAng,
          damage: 0,
          range: 900,
          maxLife: 0.18,
          pierceLeft: 99,
          bouncesLeft: 0,
          deflectable: false,
          deflected: false,
          homingStrength: 0,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          colorHex: '#ff2a3c',
        });

        if (!pillarBlocked) {
          const d = pointToRayDistance(boss.pos, bAng, 920, player.pos);
          if (d <= 36) {
            ctx.dealDamageToPlayer(state, Math.max(8, Math.round(dmg * 0.48)), {
              source: 'enemy',
              fromPos: boss.pos,
            });
          }
        }
      }
    }
    return;
  }

  if (rt.currentMove === 'sovereign_urns') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      const bounds = state.room.bounds;
      for (let u = 0; u < 4; u++) {
        const ang = (Math.PI * 2 * u) / 4 + detNextFloat(state, ctx) * 0.5;
        const ux = Math.max(
          bounds.minX + 140,
          Math.min(bounds.maxX - 140, player.pos.x + Math.cos(ang) * 240)
        );
        const uy = Math.max(
          bounds.minY + 140,
          Math.min(bounds.maxY - 140, player.pos.y + Math.sin(ang) * 180)
        );
        state.room.hazards.push({
          id: `grasping_urn_${state.tick}_${u}`,
          kind: 'urn',
          pos: { x: ux, y: uy },
          radius: 86,
          active: true,
          armed: false,
          timer: 7.5,
          cooldown: 0.7,
          damage: Math.round(dmg * 0.85),
          owner: 'enemy',
          hp: 20,
        });
      }
      state.events.push({
        type: 'ui_toast',
        text: 'Cursed Urns rise around the summit!',
        colorHex: '#52ffb4',
      });
    }
    return;
  }

  if (rt.currentMove === 'bomb_circles' || rt.currentMove === 'spearlord_call') {
    if (!rt.attackStruck) {
      rt.attackStruck = true;
      const blastRadius = rt.currentMove === 'spearlord_call' ? 132 : 118;
      const blastColor =
        rt.currentMove === 'spearlord_call'
          ? PATRON_CONSTANTS[rt.spearlordPatron].colorHex
          : cfg.dangerColor;
      let hit = false;
      for (const center of rt.bombCenters) {
        const dx = player.pos.x - center.x;
        const dy = player.pos.y - center.y;
        if (!hit && dx * dx + dy * dy <= blastRadius * blastRadius) {
          hit = true;
          ctx.dealDamageToPlayer(state, dmg, {
            source: 'enemy',
            fromPos: center,
          });
        }
        ctx.spawnProjectile(state, {
          owner: 'hazard',
          ownerId: boss.id,
          kind: 'wave',
          pos: { x: center.x, y: center.y },
          vel: { x: 0, y: 0 },
          startPos: { x: center.x, y: center.y },
          radius: 68,
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
          aoeRadius: blastRadius,
          colorHex: blastColor,
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
    if (dist <= 310 && Math.abs(angDiff) <= 1.38) {
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

  // Knock player gently back with golden revival shockwave
  const dx = state.player.pos.x - boss.pos.x;
  const dy = state.player.pos.y - boss.pos.y;
  const d = Math.hypot(dx, dy);
  if (d > 1 && d < 320) {
    state.player.vel.x += (dx / d) * 650;
    state.player.vel.y += (dy / d) * 650;
  }

  enterBossPhaseTransition(state, boss, cfg, boss.phase - 1, ctx);
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

    if (checkBossPhaseThreshold(state, boss, cfg, ctx)) {
      continue;
    }

    if (boss.invulnTimer > 0 && !rt.cloakActive) {
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
        if (rt.currentMove === 'sovereign_beams') {
          boss.aiTimer = boss.phase >= 3 ? 2.6 : 2.2;
        } else if (rt.currentMove === 'bull_combo') {
          boss.aiTimer = 0.6;
        } else if (rt.currentMove === 'bull_leap') {
          boss.aiTimer = 0.34;
        } else if (rt.currentMove === 'lunge_dash') {
          boss.aiTimer = 0.42;
        } else {
          boss.aiTimer = 0.24;
        }
      }
    } else if (boss.aiState === 'attack') {
      boss.aiTimer -= dt;
      executeBossAttackTick(state, boss, cfg, dt, speedMult, ctx);
      if (boss.aiTimer <= 0) {
        rt.cloakActive = false;
        boss.invulnerable = false;
        boss.aiState = 'recover';
        boss.aiTimer = Math.max(
          0.3,
          (0.62 - rt.thresholdsTriggered * 0.08 - (boss.phase - 1) * 0.08) / speedMult
        );
        boss.attackCooldown = Math.max(
          0.32,
          0.76 - rt.thresholdsTriggered * 0.12 - (boss.phase - 1) * 0.1
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
      const dx = player.pos.x - boss.pos.x;
      const dy = player.pos.y - boss.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ang = Math.atan2(dy, dx);
      boss.facingAngle = ang;

      if (!player.isDead && boss.attackCooldown <= 0 && dist <= 780) {
        beginBossAttackWindup(state, boss, cfg, speedMult, ctx);
      } else if (!player.isDead && dist > 90 && cfg.moveSpeed > 0) {
        const rageBonus =
          (cfg.rageSpeedBonusPerPhase ?? 0) * rt.thresholdsTriggered;
        const moveSpd =
          (cfg.moveSpeed + rageBonus) *
          speedMult *
          (1 + rt.thresholdsTriggered * 0.06);
        const targetVx = Math.cos(ang) * moveSpd;
        const targetVy = Math.sin(ang) * moveSpd;
        const blend = Math.min(1, dt * 6);
        boss.vel.x += (targetVx - boss.vel.x) * blend;
        boss.vel.y += (targetVy - boss.vel.y) * blend;
      }
    }

    if (!(boss.aiState === 'attack' && rt.currentMove === 'bull_leap')) {
      boss.pos.x += boss.vel.x * dt;
      boss.pos.y += boss.vel.y * dt;
    }
    const crashed = clampEnemyToArena(state, boss, true);
    // Colosseum Bull charging into arena walls/pillars stuns himself briefly!
    if (
      crashed &&
      boss.bossId === 'colosseum_bull' &&
      boss.aiState === 'attack' &&
      rt.currentMove === 'lunge_dash'
    ) {
      boss.stunTimer = 1.1;
      boss.aiState = 'stunned';
      boss.vel.x = 0;
      boss.vel.y = 0;
      ctx.addCameraShake(state, 9, 0.22);
    }
  }
}
