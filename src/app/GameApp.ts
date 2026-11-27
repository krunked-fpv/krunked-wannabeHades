/**
 * Krunked WannabeHades — Application Composition Root
 *
 * Orchestrates:
 * - Fixed 60Hz deterministic SimState + SimGameplayHooks
 * - 6-Pass WebGL2 / Canvas2D Ink-Cel GameRenderer with smooth `interpAlpha` & 30/60/120 FPS pacing
 * - Omnidevice InputManager (Keyboard+Mouse, Xbox Gamepad + Dual-Rumble, Auto-Translucent Touch)
 * - Autoplay-safe Greek-Metal AudioEngine + Combat SFX
 * - Mythic UiManager (Title, HUD, Boon Select, Pause/Options, Victory/Death, F9 Debug Drawer)
 * - Schema-validated SaveManager & `window.__KRUNKED_DEBUG__` DebugBridge
 */

import { AudioEngine } from '../audio/AudioEngine.js';
import {
  SIM_CONSTANTS,
  type DebugBridge,
  type InputFrame,
  type RenderSettings,
  type ScreenId,
  type SimEvent,
  type SimState,
} from '../contracts/index.js';
import { InputManager, type MenuNavInput } from '../input/InputManager.js';
import { GameRenderer } from '../render/GameRenderer.js';
import { applySelectedBoon, rerollBoonOffer } from '../sim/boons.js';
import { hashSimState } from '../sim/hash.js';
import { applyMetaToPlayer } from '../sim/meta.js';
import {
  createGameplayHooks,
  enterTrainingCourtyard,
  findNearestInteractable,
  startNewRun,
} from '../sim/rooms.js';
import {
  createDefaultSimState,
  getCombatContext,
  stepSim,
  type SimGameplayHooks,
} from '../sim/step.js';
import { UiManager } from '../ui/UiManager.js';
import { createDebugBridge } from './DebugBridge.js';
import { loadSave, resetSave as resetPersistedSave, writeSave } from './SaveManager.js';

declare global {
  interface Window {
    __KRUNKED_DEBUG__?: DebugBridge;
  }
}

export interface GameAppElements {
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;
  touchRoot: HTMLElement;
}

function hasAnyMenuNav(nav: MenuNavInput): boolean {
  return (
    nav.up ||
    nav.down ||
    nav.left ||
    nav.right ||
    nav.confirm ||
    nav.back ||
    nav.pause ||
    nav.toggleDebug
  );
}

/**
 * Lightweight positional snapshot for smooth `interpAlpha` rendering without deep-cloning SimState.
 */
function snapshotPrevState(state: SimState): SimState {
  return {
    ...state,
    camera: { ...state.camera },
    player: {
      ...state.player,
      pos: { x: state.player.pos.x, y: state.player.pos.y },
      vel: { x: state.player.vel.x, y: state.player.vel.y },
    },
    enemies: state.enemies.map((e) => ({
      ...e,
      pos: { x: e.pos.x, y: e.pos.y },
      vel: { x: e.vel.x, y: e.vel.y },
    })),
    projectiles: state.projectiles.map((p) => ({
      ...p,
      pos: { x: p.pos.x, y: p.pos.y },
      vel: { x: p.vel.x, y: p.vel.y },
    })),
  };
}

function stripOneShotPresses(frame: InputFrame): InputFrame {
  return {
    ...frame,
    attackPressed: false,
    specialPressed: false,
    castPressed: false,
    dashPressed: false,
    callPressed: false,
    reloadPressed: false,
    interactPressed: false,
    pausePressed: false,
    rerollPressed: false,
    boonSelectIndex: null,
  };
}

export class GameApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly state: SimState;
  private readonly hooks: SimGameplayHooks;
  private readonly renderer: GameRenderer;
  private readonly input: InputManager;
  private readonly audio: AudioEngine;
  private readonly ui: UiManager;
  private readonly debugBridge: DebugBridge;

  private screen: ScreenId = 'title';
  private returnScreenBeforeOptions: ScreenId = 'title';
  private prevState: SimState | null = null;
  private rafId: number | null = null;
  private lastRafMs = 0;
  private lastRenderMs = 0;
  private simAccumulator = 0;
  private disposed = false;

  // Latched one-shot gameplay inputs so >60Hz displays (120Hz/144Hz) NEVER drop presses
  // on RAF frames where simAccumulator < fixedDt (0 sim ticks executed).
  private readonly pendingOneShots = {
    attackPressed: false,
    specialPressed: false,
    castPressed: false,
    dashPressed: false,
    callPressed: false,
    reloadPressed: false,
    interactPressed: false,
    pausePressed: false,
    rerollPressed: false,
    boonSelectIndex: null as number | null,
  };

  // Buffered SimEvents passed to UiManager.update(..., drainedEvents) for HUD toasts
  private pendingUiEvents: SimEvent[] = [];

  private readonly handleResizeBound: () => void;
  private readonly handleGestureUnlockBound: () => void;

  constructor(elements?: GameAppElements) {
    const canvas =
      elements?.canvas ??
      (document.getElementById('game-canvas') as HTMLCanvasElement | null);
    const uiRoot = elements?.uiRoot ?? document.getElementById('ui-root');
    const touchRoot = elements?.touchRoot ?? document.getElementById('touch-root');

    if (!canvas || !uiRoot || !touchRoot) {
      throw new Error(
        'Krunked WannabeHades boot failed: missing #game-canvas, #ui-root, or #touch-root.'
      );
    }

    this.canvas = canvas;

    // 1. Load validated meta save & create deterministic SimState
    const meta = loadSave();
    this.state = createDefaultSimState(1337, meta);
    this.hooks = createGameplayHooks();

    // Enter Training Courtyard immediately so the live WebGL2 ink-cel arena breathes behind Title
    enterTrainingCourtyard(this.state);
    this.state.events.length = 0;

    // 2. Initialize 6-pass WebGL2 / Canvas2D Ink-Cel Renderer
    this.renderer = new GameRenderer();
    this.renderer.init(this.canvas);

    // 3. Initialize Omnidevice Input (Keyboard+Mouse, Xbox Gamepad, Auto-Translucent Touch)
    this.input = new InputManager(this.canvas, touchRoot, (clientX, clientY) =>
      this.renderer.screenToWorld(clientX, clientY, this.state)
    );
    this.input.setTouchMode(this.state.meta.settings.showTouchControls);

    // 4. Initialize Autoplay-Safe Procedural Audio Engine
    this.audio = new AudioEngine();
    this.audio.applySettings(this.state.meta.settings);

    // 5. Build DebugBridge before UI so F9 Playtest Drawer can access it immediately
    this.debugBridge = createDebugBridge({
      getState: () => this.state,
      getHooks: () => this.hooks,
      setScreen: (screen) => {
        this.screen = screen;
        this.state.run.paused = screen === 'pause' || screen === 'options';
        this.audio.updateMusic(this.state, this.screen);
      },
      clearPrevState: () => {
        this.prevState = null;
      },
      drainEvents: () => this.drainEvents(),
      persistSave: () => this.persistSave(),
      syncScreenFromState: () => this.syncScreenFromState(),
      startRun: (seed) => this.handleStartRun(seed),
      updateSettings: (partial) => this.handleUpdateSettings(partial),
      setTouchOverride: (enabled) => this.input.setTouchOverride(enabled),
      setVirtualGamepad: (gpState) => this.input.setVirtualGamepad(gpState),
      resetSave: () => this.handleResetSave(),
    });
    window.__KRUNKED_DEBUG__ = this.debugBridge;

    // 6. Initialize Mythic UI Manager
    this.ui = new UiManager(uiRoot, {
      onEnterCourtyard: () => {
        this.audio.unlock();
        this.audio.playUiSound('confirm');
        this.handleEnterCourtyard();
      },
      onStartRun: (seed) => {
        this.audio.unlock();
        this.audio.playUiSound('confirm');
        this.handleStartRun(seed);
      },
      onSelectBoon: (index) => {
        this.audio.unlock();
        this.audio.playUiSound('confirm');
        if (applySelectedBoon(this.state, index, getCombatContext())) {
          this.drainEvents();
          this.syncScreenFromState();
          this.persistSave();
        }
      },
      onRerollBoon: () => {
        this.audio.unlock();
        this.audio.playUiSound('click');
        if (rerollBoonOffer(this.state, getCombatContext())) {
          this.drainEvents();
        }
      },
      onResume: () => {
        this.audio.unlock();
        this.audio.playUiSound('back');
        this.state.run.paused = false;
        this.screen = this.state.room.biome === 'sanctum_hub' ? 'hub' : 'playing';
        this.simAccumulator = 0;
      },
      onReturnToCourtyard: () => {
        this.audio.unlock();
        this.audio.playUiSound('confirm');
        this.handleEnterCourtyard();
      },
      onReturnToTitle: () => {
        this.audio.unlock();
        this.audio.playUiSound('back');
        this.handleEnterCourtyard();
        this.screen = 'title';
        this.state.run.paused = false;
        this.audio.updateMusic(this.state, this.screen);
      },
      onOpenOptions: () => {
        this.audio.unlock();
        this.audio.playUiSound('click');
        if (this.screen !== 'options') {
          this.returnScreenBeforeOptions = this.screen;
        }
        this.screen = 'options';
        this.state.run.paused = true;
      },
      onCloseModal: () => {
        this.audio.unlock();
        this.audio.playUiSound('back');
        if (this.screen === 'options') {
          this.screen = this.returnScreenBeforeOptions;
          this.state.run.paused = this.screen === 'pause';
        } else if (
          this.screen === 'weapon_menu' ||
          this.screen === 'mirror_menu' ||
          this.screen === 'shrine_menu' ||
          this.screen === 'keepsake_menu' ||
          this.screen === 'shop_menu' ||
          this.screen === 'codex_menu'
        ) {
          this.screen = this.state.room.biome === 'sanctum_hub' ? 'hub' : 'playing';
          this.state.run.paused = false;
        }
      },
      onUpdateSettings: (partial) => {
        this.audio.unlock();
        this.handleUpdateSettings(partial);
      },
      onToggleGodMode: (enabled) => {
        this.audio.unlock();
        this.state.meta.godModeEnabled = Boolean(enabled);
        this.state.run.godModeEnabled = Boolean(enabled);
        this.persistSave();
      },
      onResetSave: () => {
        this.audio.unlock();
        this.audio.playUiSound('back');
        this.handleResetSave();
      },
      getPortraitUrl: (patronId) => this.renderer.getPatronPortraitDataUrl(patronId),
      getDebugBridge: () => this.debugBridge,
    });

    // 7. Window listeners (HiDPI resize & gesture audio unlock)
    this.handleResizeBound = () => this.handleResize();
    this.handleGestureUnlockBound = () => this.audio.unlock();
    window.addEventListener('resize', this.handleResizeBound);
    window.addEventListener('pointerdown', this.handleGestureUnlockBound, { passive: true });
    window.addEventListener('keydown', this.handleGestureUnlockBound, { passive: true });
    this.handleResize();
  }

  public start(): void {
    if (this.disposed || this.rafId !== null) return;
    this.lastRafMs = performance.now();
    this.lastRenderMs = 0;
    this.simAccumulator = 0;
    this.audio.updateMusic(this.state, this.screen);

    const tickLoop = (nowMs: number) => {
      if (this.disposed) return;
      this.frame(nowMs);
      this.rafId = window.requestAnimationFrame(tickLoop);
    };
    this.rafId = window.requestAnimationFrame(tickLoop);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('resize', this.handleResizeBound);
    window.removeEventListener('pointerdown', this.handleGestureUnlockBound);
    window.removeEventListener('keydown', this.handleGestureUnlockBound);
    if (window.__KRUNKED_DEBUG__ === this.debugBridge) {
      delete window.__KRUNKED_DEBUG__;
    }
    this.ui.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }

  private handleResize(): void {
    const w = Math.max(1, window.innerWidth || this.canvas.clientWidth || 1280);
    const h = Math.max(1, window.innerHeight || this.canvas.clientHeight || 720);
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this.renderer.resize(w, h, dpr);
  }

  private handleEnterCourtyard(): void {
    enterTrainingCourtyard(this.state);
    this.state.run.paused = false;
    this.screen = 'hub';
    this.prevState = null;
    this.simAccumulator = 0;
    this.clearPendingOneShots();
    this.drainEvents();
    this.audio.updateMusic(this.state, this.screen);
    this.persistSave();
  }

  private handleStartRun(seed?: number): void {
    const chosenSeed =
      typeof seed === 'number' && Number.isFinite(seed)
        ? Math.floor(seed)
        : ((this.state.meta.totalRuns + 1) * 2654435761 + Math.floor(performance.now())) >>> 0;
    startNewRun(this.state, chosenSeed);
    this.state.run.paused = false;
    this.screen = 'playing';
    this.prevState = null;
    this.simAccumulator = 0;
    this.clearPendingOneShots();
    this.drainEvents();
    this.audio.updateMusic(this.state, this.screen);
    this.persistSave();
  }

  private handleUpdateSettings(partial: Partial<RenderSettings>): void {
    this.state.meta.settings = {
      ...this.state.meta.settings,
      ...partial,
    };
    this.audio.applySettings(this.state.meta.settings);
    this.input.setTouchMode(this.state.meta.settings.showTouchControls);
    this.persistSave();
  }

  private handleResetSave(): void {
    const fresh = resetPersistedSave();
    this.state.meta = fresh;
    this.state.run.godModeEnabled = fresh.godModeEnabled;
    this.state.run.vows = { ...fresh.shrineVows };
    this.state.run.heat = 0;
    applyMetaToPlayer(this.state, { resetVitals: true });
    this.audio.applySettings(fresh.settings);
    this.input.setTouchMode(fresh.settings.showTouchControls);
  }

  private persistSave(): void {
    writeSave(this.state.meta);
  }

  private isGameplaySimRunning(): boolean {
    return (
      (this.screen === 'playing' || this.screen === 'hub') &&
      !this.state.run.paused &&
      this.state.run.pendingOffer === null &&
      !this.state.run.victory &&
      !this.state.run.defeat
    );
  }

  private syncScreenFromState(): void {
    if (this.screen === 'title' || this.screen === 'pause' || this.screen === 'options') {
      return;
    }
    if (this.state.run.victory) {
      this.screen = 'victory';
      return;
    }
    if (this.state.run.defeat) {
      this.screen = 'death';
      return;
    }
    if (this.state.run.pendingOffer !== null) {
      this.screen = 'boon_select';
      return;
    }
    this.screen = this.state.room.biome === 'sanctum_hub' ? 'hub' : 'playing';
  }

  private clearPendingOneShots(): void {
    this.pendingOneShots.attackPressed = false;
    this.pendingOneShots.specialPressed = false;
    this.pendingOneShots.castPressed = false;
    this.pendingOneShots.dashPressed = false;
    this.pendingOneShots.callPressed = false;
    this.pendingOneShots.reloadPressed = false;
    this.pendingOneShots.interactPressed = false;
    this.pendingOneShots.pausePressed = false;
    this.pendingOneShots.rerollPressed = false;
    this.pendingOneShots.boonSelectIndex = null;
  }

  private latchOneShots(frame: InputFrame): void {
    if (frame.attackPressed) this.pendingOneShots.attackPressed = true;
    if (frame.specialPressed) this.pendingOneShots.specialPressed = true;
    if (frame.castPressed) this.pendingOneShots.castPressed = true;
    if (frame.dashPressed) this.pendingOneShots.dashPressed = true;
    if (frame.callPressed) this.pendingOneShots.callPressed = true;
    if (frame.reloadPressed) this.pendingOneShots.reloadPressed = true;
    if (frame.interactPressed) this.pendingOneShots.interactPressed = true;
    if (frame.pausePressed) this.pendingOneShots.pausePressed = true;
    if (frame.rerollPressed) this.pendingOneShots.rerollPressed = true;
    if (frame.boonSelectIndex !== null) {
      this.pendingOneShots.boonSelectIndex = frame.boonSelectIndex;
    }
  }

  private applyAndClearOneShots(frame: InputFrame): InputFrame {
    const merged: InputFrame = {
      ...frame,
      attackPressed: frame.attackPressed || this.pendingOneShots.attackPressed,
      specialPressed: frame.specialPressed || this.pendingOneShots.specialPressed,
      castPressed: frame.castPressed || this.pendingOneShots.castPressed,
      dashPressed: frame.dashPressed || this.pendingOneShots.dashPressed,
      callPressed: frame.callPressed || this.pendingOneShots.callPressed,
      reloadPressed: frame.reloadPressed || this.pendingOneShots.reloadPressed,
      interactPressed: frame.interactPressed || this.pendingOneShots.interactPressed,
      pausePressed: frame.pausePressed || this.pendingOneShots.pausePressed,
      rerollPressed: Boolean(frame.rerollPressed || this.pendingOneShots.rerollPressed),
      boonSelectIndex: frame.boonSelectIndex ?? this.pendingOneShots.boonSelectIndex,
    };
    this.clearPendingOneShots();
    return merged;
  }

  private drainEvents(): void {
    if (this.state.events.length === 0) return;

    const batch = this.state.events.splice(0, this.state.events.length);
    this.renderer.consumeEvents(batch, this.state);
    this.audio.handleSimEvents(batch);

    // Retain toast-relevant events for HudOverlay.processToasts() on the next ui.update()
    for (let i = 0; i < batch.length; i++) {
      const ev = batch[i];
      if (
        ev.type === 'ui_toast' ||
        ev.type === 'room_cleared' ||
        ev.type === 'death_defiance' ||
        ev.type === 'god_call' ||
        ev.type === 'boss_phase'
      ) {
        this.pendingUiEvents.push(ev);
      }
    }
    if (this.pendingUiEvents.length > 32) {
      this.pendingUiEvents.splice(0, this.pendingUiEvents.length - 32);
    }

    let shouldSave = false;
    let roomChanged = false;
    for (let i = 0; i < batch.length; i++) {
      const ev = batch[i];
      if (ev.type === 'rumble') {
        this.input.triggerRumble(ev.weak, ev.strong, ev.durationMs);
      } else if (ev.type === 'room_entered') {
        roomChanged = true;
        shouldSave = true;
      } else if (
        ev.type === 'room_cleared' ||
        ev.type === 'run_ended' ||
        ev.type === 'boon_selected'
      ) {
        shouldSave = true;
      }
    }

    if (roomChanged) {
      this.prevState = null;
    }
    if (shouldSave) {
      this.persistSave();
    }
  }

  private frame(nowMs: number): void {
    const rawDtSec = this.lastRafMs > 0 ? (nowMs - this.lastRafMs) * 0.001 : SIM_CONSTANTS.fixedDt;
    this.lastRafMs = nowMs;
    const clampedDt = Math.max(0, Math.min(SIM_CONSTANTS.maxFrameDt, rawDtSec));

    const inGameplay = this.isGameplaySimRunning();
    const nearInteractable = inGameplay && findNearestInteractable(this.state) !== null;

    // 1. Poll omnidevice input once per frame (updates active source, touch context & menuNav)
    const polledInput = this.input.poll(this.state.tick + 1, this.state.player.pos, {
      nearInteractable,
      godGauge: this.state.player.godGauge,
      isRail: this.state.player.weaponId === 'adamant_rail',
      inGameplay,
    });

    if (polledInput.source === 'gamepad') {
      this.audio.unlock();
    }

    const menuNav = this.input.getMenuNav();
    let uiMenuNav: MenuNavInput = menuNav;

    // 2. Open Pause menu cleanly when pressing Esc / Start during live gameplay
    if (
      (this.screen === 'playing' || this.screen === 'hub') &&
      (menuNav.pause || polledInput.pausePressed)
    ) {
      this.screen = 'pause';
      this.state.run.paused = true;
      this.simAccumulator = 0;
      this.audio.playUiSound('click');
      // Prevent PauseAndOptionsModal from immediately resuming on the exact same frame
      uiMenuNav = { ...menuNav, pause: false, back: false };
    }

    // 3. Fixed 60Hz deterministic simulation substeps
    const simRunningNow = this.isGameplaySimRunning();
    if (simRunningNow) {
      // Always latch one-shot presses before checking accumulator so 120Hz/144Hz RAF frames
      // with 0 sim substeps never drop dash/attack/special/cast/interact presses!
      this.latchOneShots(polledInput);
      this.simAccumulator += clampedDt;
      let steps = 0;
      let stepInput: InputFrame | null = null;

      while (
        this.simAccumulator >= SIM_CONSTANTS.fixedDt &&
        steps < SIM_CONSTANTS.maxSubStepsPerFrame
      ) {
        if (stepInput === null) {
          stepInput = this.applyAndClearOneShots(polledInput);
        } else {
          stepInput = stripOneShotPresses(stepInput);
        }
        this.prevState = snapshotPrevState(this.state);
        stepSim(this.state, { ...stepInput, tick: this.state.tick + 1 }, this.hooks);
        this.drainEvents();
        this.syncScreenFromState();

        this.simAccumulator -= SIM_CONSTANTS.fixedDt;
        steps += 1;

        if (!this.isGameplaySimRunning()) {
          this.simAccumulator = 0;
          this.clearPendingOneShots();
          break;
        }
      }
    } else {
      this.simAccumulator = 0;
      this.clearPendingOneShots();
      this.syncScreenFromState();
    }

    // 4. Adaptive Greek-metal soundtrack state sync
    this.audio.updateMusic(this.state, this.screen);

    // 5. Render pacing honoring targetFps (30 | 60 | 120) and classicSnap60Hz
    const settings = this.state.meta.settings;
    const minRenderMs = settings.targetFps >= 120 ? 0 : 1000 / settings.targetFps - 1.5;
    const shouldRender = this.lastRenderMs === 0 || nowMs - this.lastRenderMs >= minRenderMs;

    if (shouldRender) {
      this.lastRenderMs = nowMs;
      const interpAlpha =
        !this.isGameplaySimRunning() || settings.classicSnap60Hz
          ? 1
          : Math.max(0, Math.min(1, this.simAccumulator / SIM_CONSTANTS.fixedDt));
      this.renderer.render(this.state, this.prevState, interpAlpha, settings, nowMs);
    }

    // 6. Always update UI when rendering OR when a menu/debug input edge occurred
    if (shouldRender || hasAnyMenuNav(uiMenuNav) || this.pendingUiEvents.length > 0) {
      const renderStats = this.renderer.getStats();
      const hash = this.ui.isDebugDrawerOpen() ? hashSimState(this.state) : '';
      const drainedForUi = this.pendingUiEvents.length > 0 ? this.pendingUiEvents : undefined;
      if (drainedForUi) {
        this.pendingUiEvents = [];
      }
      this.ui.update(
        this.state,
        this.screen,
        this.input.getActiveSource(),
        renderStats,
        uiMenuNav,
        hash,
        drainedForUi
      );
    }
  }
}
