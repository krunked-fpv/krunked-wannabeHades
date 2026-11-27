/**
 * Krunked WannabeHades — Browser Debug & Automation Bridge
 *
 * Mounts `window.__KRUNKED_DEBUG__` conforming strictly to `DebugBridge` in `src/contracts/index.ts`,
 * plus Wave 2 inspection helpers for RenderStats, dual-mode AssetRegistry, and Hub Meta screens.
 */

import type { PackManifestSummary } from '../assets/AssetRegistry.js';
import {
  EMPTY_INPUT_FRAME,
  PLAYER_CONSTANTS,
  SHRINE_VOWS,
  type AspectId,
  type BiomeId,
  type BoonRarity,
  type BoonSlot,
  type BossId,
  type DebugBridge,
  type EnemyArchetypeId,
  type HammerId,
  type InputFrame,
  type PatronId,
  type RenderSettings,
  type ScreenId,
  type ShrineVowId,
  type SimState,
  type Vec2,
  type WeaponId,
} from '../contracts/index.js';
import type { RenderStats } from '../render/GameRenderer.js';
import { grantBoonDirect, grantHammerDirect } from '../sim/boons.js';
import { spawnEnemy } from '../sim/enemies.js';
import { hashSimState } from '../sim/hash.js';
import { applyMetaToPlayer, computeHeat, selectWeaponAndAspect } from '../sim/meta.js';
import { borrowFerrymanGoldBag, warpToBiome, warpToBoss } from '../sim/rooms.js';
import { getCombatContext, stepSim, type SimGameplayHooks } from '../sim/step.js';

export interface ExtendedDebugBridge extends DebugBridge {
  getRenderStats(): RenderStats;
  getPackSummary(): PackManifestSummary;
  openScreen(screen: ScreenId): void;
  borrowGoldBag(): boolean;
}

export interface DebugBridgeHost {
  getState(): SimState;
  getHooks(): SimGameplayHooks;
  getRenderStats(): RenderStats;
  getPackSummary(): PackManifestSummary;
  setScreen(screen: ScreenId): void;
  clearPrevState(): void;
  drainEvents(): void;
  persistSave(): void;
  syncScreenFromState(): void;
  startRun(seed?: number): void;
  updateSettings(partial: Partial<RenderSettings>): void;
  setTouchOverride(enabled: boolean): void;
  setVirtualGamepad(state: (Partial<InputFrame> & { connected?: boolean }) | null): void;
  resetSave(): void;
}

const HEAT_ALLOCATION_ORDER: readonly ShrineVowId[] = [
  'hard_labor',
  'calisthenics_program',
  'jury_summons',
  'lasting_consequences',
  'convenience_fee',
  'heightened_security',
  'damage_control',
  'extreme_measures',
  'tight_deadline',
  'middle_management',
  'underworld_customs',
  'benefits_package',
  'forced_overtime',
  'approval_process',
  'routine_inspection',
  'personal_liability',
];

function allocateVowsForHeat(targetHeat: number): Partial<Record<ShrineVowId, number>> {
  const clamped = Math.max(0, Math.min(64, Math.floor(targetHeat)));
  const vows: Partial<Record<ShrineVowId, number>> = {};
  let remaining = clamped;

  for (const id of HEAT_ALLOCATION_ORDER) {
    if (remaining <= 0) break;
    const def = SHRINE_VOWS[id];
    let rank = 0;
    for (let r = 0; r < def.maxRank; r++) {
      const cost = def.heatPerRank[r] ?? 1;
      if (cost <= remaining) {
        remaining -= cost;
        rank += 1;
      } else {
        break;
      }
    }
    if (rank > 0) {
      vows[id] = rank;
    }
  }
  return vows;
}

export function createDebugBridge(host: DebugBridgeHost): ExtendedDebugBridge {
  return {
    warpBiome(biome: BiomeId, depth = 1): void {
      const state = host.getState();
      warpToBiome(state, biome, depth);
      host.clearPrevState();
      host.setScreen(biome === 'sanctum_hub' ? 'hub' : 'playing');
      host.drainEvents();
      host.persistSave();
    },

    warpBoss(bossId: BossId): void {
      const state = host.getState();
      // Ensure warping to either Verdant Colosseum Champion spawns BOTH Dual Champions!
      const effectiveBoss: BossId =
        bossId === 'colosseum_bull' ? 'colosseum_spearlord' : bossId;
      warpToBoss(state, effectiveBoss, getCombatContext());
      host.clearPrevState();
      host.setScreen('playing');
      host.drainEvents();
      host.persistSave();
    },

    giveBoon(patronId: PatronId, slot?: BoonSlot, rarity?: BoonRarity): void {
      const state = host.getState();
      grantBoonDirect(state, patronId, slot, rarity ?? 'rare', getCombatContext());
      host.drainEvents();
      host.persistSave();
    },

    giveHammer(hammerId?: HammerId): void {
      const state = host.getState();
      grantHammerDirect(state, hammerId, getCombatContext());
      host.drainEvents();
    },

    setWeapon(weaponId: WeaponId, aspectId?: AspectId): void {
      const state = host.getState();
      const prevMaxHp = state.player.maxHp;
      selectWeaponAndAspect(state.meta, weaponId, aspectId);
      const inHub = state.room.biome === 'sanctum_hub';
      applyMetaToPlayer(state, { resetVitals: inHub });
      // Immediately refill clip and adjust HP upward if new Aspect grants extra Max HP (e.g., Paladin)
      state.player.ammo = state.player.maxAmmo;
      state.player.reloadTimer = 0;
      if (!inHub && state.player.maxHp > prevMaxHp) {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + (state.player.maxHp - prevMaxHp));
      }
      host.drainEvents();
      host.persistSave();
    },

    setHeat(heat: number, vows?: Partial<Record<ShrineVowId, number>>): void {
      const state = host.getState();
      let nextVows: Partial<Record<ShrineVowId, number>>;
      if (vows) {
        nextVows = {};
        for (const [key, val] of Object.entries(vows)) {
          const id = key as ShrineVowId;
          const def = SHRINE_VOWS[id];
          if (def && typeof val === 'number' && Number.isFinite(val)) {
            const clamped = Math.max(0, Math.min(def.maxRank, Math.floor(val)));
            if (clamped > 0) {
              nextVows[id] = clamped;
            }
          }
        }
      } else {
        nextVows = allocateVowsForHeat(heat);
      }

      state.meta.shrineVows = { ...nextVows };
      state.run.vows = { ...nextVows };
      state.run.heat = computeHeat(nextVows);
      applyMetaToPlayer(state, { resetVitals: false });
      host.persistSave();
    },

    setGodMode(enabled: boolean, deaths?: number): void {
      const state = host.getState();
      state.meta.godModeEnabled = Boolean(enabled);
      state.run.godModeEnabled = Boolean(enabled);
      if (typeof deaths === 'number' && Number.isFinite(deaths)) {
        state.meta.godModeDeaths = Math.max(
          0,
          Math.min(PLAYER_CONSTANTS.godModeMaxDeaths, Math.floor(deaths))
        );
      }
      host.persistSave();
    },

    triggerTouchMode(enabled: boolean): void {
      host.setTouchOverride(Boolean(enabled));
    },

    simulateGamepad(gpState: Partial<InputFrame> & { connected?: boolean }): void {
      if (gpState.connected === false) {
        host.setVirtualGamepad(null);
      } else {
        host.setVirtualGamepad({ connected: true, ...gpState });
      }
    },

    stepTicks(count: number, input?: Partial<InputFrame>): void {
      const state = host.getState();
      const hooks = host.getHooks();
      const total = Math.max(0, Math.min(36_000, Math.floor(count)));

      for (let i = 0; i < total; i++) {
        const isFirst = i === 0;
        const frame: InputFrame = {
          ...EMPTY_INPUT_FRAME,
          ...(input ?? {}),
          tick: state.tick + 1,
          attackPressed: isFirst ? Boolean(input?.attackPressed) : false,
          specialPressed: isFirst ? Boolean(input?.specialPressed) : false,
          castPressed: isFirst ? Boolean(input?.castPressed) : false,
          dashPressed: isFirst ? Boolean(input?.dashPressed) : false,
          callPressed: isFirst ? Boolean(input?.callPressed) : false,
          reloadPressed: isFirst ? Boolean(input?.reloadPressed) : false,
          interactPressed: isFirst ? Boolean(input?.interactPressed) : false,
          pausePressed: isFirst ? Boolean(input?.pausePressed) : false,
          rerollPressed: isFirst ? Boolean(input?.rerollPressed) : false,
          boonSelectIndex: isFirst ? (input?.boonSelectIndex ?? null) : null,
        };
        stepSim(state, frame, hooks);
        host.drainEvents();
      }
      host.clearPrevState();
      host.syncScreenFromState();
    },

    getState(): SimState {
      return host.getState();
    },

    getHash(): string {
      return hashSimState(host.getState());
    },

    resetSave(): void {
      host.resetSave();
    },

    setRenderSettings(partial: Partial<RenderSettings>): void {
      host.updateSettings(partial);
    },

    startRun(seed?: number): void {
      host.startRun(seed);
    },

    spawnEnemy(archetype: EnemyArchetypeId, pos?: Vec2): void {
      const state = host.getState();
      const spawnPos: Vec2 = pos
        ? { x: pos.x, y: pos.y }
        : {
            x: Math.min(state.room.bounds.maxX - 80, state.player.pos.x + 220),
            y: state.player.pos.y,
          };
      spawnEnemy(state, archetype, spawnPos, undefined, getCombatContext());
      host.drainEvents();
    },

    killAllEnemies(): void {
      const state = host.getState();
      const hooks = host.getHooks();
      const ctx = getCombatContext();
      const targets = state.enemies.filter(
        (e) => e.archetype !== 'rattlebones_dummy' && e.aiState !== 'dead' && e.hp > 0
      );

      for (let i = 0; i < targets.length; i++) {
        const enemy = targets[i];
        enemy.armor = 0;
        enemy.invulnerable = false;
        enemy.invulnTimer = 0;
        enemy.phase = enemy.maxPhases;
        enemy.hp = 0;
        enemy.aiState = 'dead';
        state.run.kills += 1;
        state.events.push({
          type: 'enemy_death',
          enemyId: enemy.id,
          archetype: enemy.archetype,
          pos: { x: enemy.pos.x, y: enemy.pos.y },
          isBoss: enemy.isBoss,
          finalInRoom: i === targets.length - 1,
        });
        hooks.onEnemyKilled?.(state, enemy, ctx);
      }

      // Advance wave / room clear cleanly via a single zero-input tick if combat is active
      if (targets.length > 0 && state.room.combatStarted && !state.room.cleared) {
        stepSim(state, { ...EMPTY_INPUT_FRAME, tick: state.tick + 1 }, hooks);
      }
      host.drainEvents();
      host.syncScreenFromState();
      host.persistSave();
    },

    healPlayer(amount?: number): void {
      const state = host.getState();
      const healAmt =
        typeof amount === 'number' && Number.isFinite(amount)
          ? Math.max(0, Math.floor(amount))
          : state.player.maxHp;
      state.player.isDead = false;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + healAmt);
      state.floatingNumbers.push({
        id: `fl_dbg_heal_${state.tick}_${state.floatingNumbers.length}`,
        pos: { x: state.player.pos.x, y: state.player.pos.y - 42 },
        vel: { x: 0, y: -55 },
        value: `+${healAmt}`,
        kind: 'heal',
        colorHex: '#63d471',
        life: 0,
        maxLife: 0.9,
      });
    },

    getRenderStats(): RenderStats {
      return host.getRenderStats();
    },

    getPackSummary(): PackManifestSummary {
      return host.getPackSummary();
    },

    openScreen(screen: ScreenId): void {
      host.setScreen(screen);
    },

    borrowGoldBag(): boolean {
      const state = host.getState();
      const ok = borrowFerrymanGoldBag(state, getCombatContext());
      if (ok) {
        host.clearPrevState();
        host.setScreen('playing');
        host.drainEvents();
        host.persistSave();
      }
      return ok;
    },
  };
}
