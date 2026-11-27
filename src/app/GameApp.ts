/**
 * Krunked WannabeHades — Application Composition Root
 *
 * Orchestrates:
 * - Fixed 60Hz deterministic SimState + SimGameplayHooks (all 6 Arms, 5 Biomes, 8 Bosses, 10 Patrons)
 * - 6-Pass WebGL2 / Canvas2D Ink-Cel GameRenderer with smooth `interpAlpha` & 30/60/120 FPS pacing
 * - Dual-Mode `AssetRegistry` + `CustomPackLoader` (`BUILTIN` default + optional local `CUSTOM_PACK`)
 * - Omnidevice InputManager (Keyboard+Mouse, Xbox Gamepad + Dual-Rumble, Auto-Translucent Touch)
 * - Autoplay-safe Greek-Metal AudioEngine + Combat SFX
 * - Mythic UiManager (Title, HUD, Boon Select, Weapons/Mirror/Shrine/Keepsakes/Shop/Codex, Pause/Options, F9 Drawer)
 * - Schema-validated SaveManager & `window.__KRUNKED_DEBUG__` DebugBridge
 */

import { AssetRegistry } from '../assets/AssetRegistry.js';
import { autoLoadCustomPack, promptLoadCustomPackFolder } from '../assets/CustomPackLoader.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import {
  PATRON_CONSTANTS,
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
import {
  applyMetaToPlayer,
  purchaseMirrorUpgrade,
  refundMirrorUpgrades,
  selectKeepsake,
  selectWeaponAndAspect,
  setShrineVowRank,
  toggleMirrorSide,
  upgradeWeaponAspect,
} from '../sim/meta.js';
import {
  borrowFerrymanGoldBag,
  buyShopPickup,
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
import { UiManager, type UiCallbacks } from '../ui/UiManager.js';
import {
  CameraFeelController,
  type GameRendererFeelHooks,
  type ScreenFxImpulse,
} from './CameraFeelController.js';
import { createDebugBridge, type ExtendedDebugBridge } from './DebugBridge.js';
import { loadSave, resetSave as resetPersistedSave, writeSave } from './SaveManager.js';

type FeelAwareRenderer = GameRenderer & Partial<GameRendererFeelHooks>;
type UiCallbacksWithHover = UiCallbacks & { onUiHover?: () => void };

const MAX_COSMETIC_FREEZE_SEC = 0.024;
const COSMETIC_FREEZE_COOLDOWN_SEC = 0.22;

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

const MODAL_PAUSING_SCREENS = new Set<ScreenId>([
  'pause',
  'options',
  'weapon_menu',
  'mirror_menu',
  'shrine_menu',
  'keepsake_menu',
  'shop_menu',
  'codex_menu',
]);

function isModalOverlayScreen(screen: ScreenId): boolean {
  return screen === 'title' || MODAL_PAUSING_SCREENS.has(screen);
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
    nav.toggleDebug ||
    Boolean(nav.codex) ||
    Boolean(nav.tabPrev) ||
    Boolean(nav.tabNext)
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
  private readonly assetRegistry: AssetRegistry;
  private readonly renderer: GameRenderer;
  private readonly input: InputManager;
  private readonly audio: AudioEngine;
  private readonly ui: UiManager;
  private readonly debugBridge: ExtendedDebugBridge;
  private readonly cameraFeel = new CameraFeelController();

  private screen: ScreenId = 'title';
  private returnScreenBeforeOptions: ScreenId = 'title';
  private prevState: SimState | null = null;
  private rafId: number | null = null;
  private lastRafMs = 0;
  private lastRenderMs = 0;
  private simAccumulator = 0;
  private cosmeticFreezeRemainingSec = 0;
  private cosmeticFreezeCooldownSec = 0;
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

    // 2. Initialize Dual-Mode Asset Registry + 6-Pass WebGL2 / Canvas2D Ink-Cel Renderer
    this.assetRegistry = new AssetRegistry();
    this.assetRegistry.setPackMode(this.state.meta.settings.packMode);
    this.renderer = new GameRenderer();
    this.renderer.init(this.canvas);
    this.renderer.attachCustomPack(this.assetRegistry);

    // Re-bake combat numeral glyph atlas once self-hosted OFL WOFF2 fonts finish loading
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (this.disposed) return;
        (this.renderer as FeelAwareRenderer).rebakeFontAtlas?.();
      });
    }

    // Non-blocking background check for cached IndexedDB pack or local dev `/.wannabehades-assets/`
    void this.initCustomPackAutoDetect();

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
      getRenderStats: () => this.renderer.getStats(),
      getPackSummary: () => this.assetRegistry.getManifestSummary(),
      setScreen: (screen) => this.applyScreenTransition(screen),
      clearPrevState: () => {
        this.prevState = null;
        this.cameraFeel.reset();
        this.cosmeticFreezeRemainingSec = 0;
      },
      drainEvents: () => this.drainEvents(true),
      persistSave: () => this.persistSave(),
      syncScreenFromState: () => this.syncScreenFromState(),
      startRun: (seed) => this.handleStartRun(seed),
      updateSettings: (partial) => this.handleUpdateSettings(partial),
      setTouchOverride: (enabled) => this.input.setTouchOverride(enabled),
      setVirtualGamepad: (gpState) => this.input.setVirtualGamepad(gpState),
      resetSave: () => this.handleResetSave(),
    });
    window.__KRUNKED_DEBUG__ = this.debugBridge;

    // 6. Initialize Mythic UI Manager (Wave 1 + all Wave 2 Hub Meta, Shop & Codex modals)
    const uiCallbacks: UiCallbacksWithHover = {
      onUiHover: () => {
        this.audio.playUiSound('hover');
      },
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
        this.applyScreenTransition('options');
      },
      onOpenScreen: (screen) => {
        this.audio.unlock();
        this.audio.playUiSound('click');
        if (screen === 'options' && this.screen !== 'options') {
          this.returnScreenBeforeOptions = this.screen;
        }
        this.applyScreenTransition(screen);
      },
      onCloseModal: () => {
        this.audio.unlock();
        this.audio.playUiSound('back');
        if (this.screen === 'options') {
          this.applyScreenTransition(this.returnScreenBeforeOptions);
        } else if (MODAL_PAUSING_SCREENS.has(this.screen)) {
          this.applyScreenTransition(
            this.state.room.biome === 'sanctum_hub' ? 'hub' : 'playing'
          );
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
      onLoadCustomPackFolder: () => {
        this.audio.unlock();
        this.audio.playUiSound('click');
        void this.handleLoadCustomPackFolder();
      },
      onResetSave: () => {
        this.audio.unlock();
        this.audio.playUiSound('back');
        this.handleResetSave();
      },
      onSelectWeapon: (weaponId, aspectId) => {
        this.audio.unlock();
        this.audio.playUiSound('confirm');
        const prevMaxHp = this.state.player.maxHp;
        selectWeaponAndAspect(this.state.meta, weaponId, aspectId);
        const inHub = this.state.room.biome === 'sanctum_hub';
        applyMetaToPlayer(this.state, { resetVitals: inHub });
        this.state.player.ammo = this.state.player.maxAmmo;
        this.state.player.reloadTimer = 0;
        if (!inHub && this.state.player.maxHp > prevMaxHp) {
          this.state.player.hp = Math.min(
            this.state.player.maxHp,
            this.state.player.hp + (this.state.player.maxHp - prevMaxHp)
          );
        }
        this.persistSave();
      },
      onUpgradeAspect: (aspectId) => {
        this.audio.unlock();
        if (upgradeWeaponAspect(this.state.meta, aspectId)) {
          this.audio.playUiSound('confirm');
          applyMetaToPlayer(this.state, { resetVitals: this.state.room.biome === 'sanctum_hub' });
          this.persistSave();
        } else {
          this.audio.playUiSound('back');
        }
      },
      onUpgradeMirror: (id) => {
        this.audio.unlock();
        if (purchaseMirrorUpgrade(this.state.meta, id)) {
          this.audio.playUiSound('confirm');
          applyMetaToPlayer(this.state, { resetVitals: this.state.room.biome === 'sanctum_hub' });
          this.persistSave();
        } else {
          this.audio.playUiSound('back');
        }
      },
      onToggleMirrorSide: (id) => {
        this.audio.unlock();
        this.audio.playUiSound('click');
        toggleMirrorSide(this.state.meta, id);
        applyMetaToPlayer(this.state, { resetVitals: this.state.room.biome === 'sanctum_hub' });
        this.persistSave();
      },
      onRefundMirror: () => {
        this.audio.unlock();
        const refunded = refundMirrorUpgrades(this.state.meta);
        if (refunded > 0) {
          this.audio.playUiSound('confirm');
          applyMetaToPlayer(this.state, { resetVitals: this.state.room.biome === 'sanctum_hub' });
          this.pushLocalToast(`Mirror Refunded: +${refunded} Darkness`, '#c084fc');
          this.persistSave();
        } else {
          this.audio.playUiSound('back');
        }
      },
      onSetShrineVow: (id, rank) => {
        this.audio.unlock();
        this.audio.playUiSound('click');
        const totalHeat = setShrineVowRank(this.state.meta, id, rank);
        this.state.run.vows = { ...this.state.meta.shrineVows };
        this.state.run.heat = totalHeat;
        applyMetaToPlayer(this.state, { resetVitals: this.state.room.biome === 'sanctum_hub' });
        this.persistSave();
      },
      onSelectKeepsake: (id) => {
        this.audio.unlock();
        this.audio.playUiSound('confirm');
        selectKeepsake(this.state.meta, id);
        applyMetaToPlayer(this.state, { resetVitals: this.state.room.biome === 'sanctum_hub' });
        this.persistSave();
      },
      onBuyShopItem: (pickupId) => {
        this.audio.unlock();
        if (buyShopPickup(this.state, pickupId, getCombatContext())) {
          this.audio.playUiSound('confirm');
          this.drainEvents();
          if (this.state.run.pendingOffer !== null) {
            this.screen = 'boon_select';
            this.state.run.paused = false;
          }
          this.persistSave();
        } else {
          this.audio.playUiSound('back');
        }
      },
      onBorrowGoldBag: () => {
        this.audio.unlock();
        if (borrowFerrymanGoldBag(this.state, getCombatContext())) {
          this.audio.playUiSound('confirm');
          this.prevState = null;
          this.simAccumulator = 0;
          this.clearPendingOneShots();
          this.applyScreenTransition('playing');
          this.drainEvents();
          this.persistSave();
        }
      },
      getPortraitUrl: (patronId) => this.renderer.getPatronPortraitDataUrl(patronId),
      getDebugBridge: () => this.debugBridge,
    };
    this.ui = new UiManager(uiRoot, uiCallbacks);

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
    this.assetRegistry.dispose();
  }

  private async initCustomPackAutoDetect(): Promise<void> {
    try {
      const pack = await autoLoadCustomPack();
      if (!this.disposed && pack) {
        this.assetRegistry.attachCustomPack(pack);
        this.assetRegistry.setPackMode(this.state.meta.settings.packMode);
        this.renderer.attachCustomPack(this.assetRegistry);
      }
    } catch {
      // Quietly remain in BUILTIN mode when no local pack is present
    }
  }

  private async handleLoadCustomPackFolder(): Promise<void> {
    try {
      const res = await promptLoadCustomPackFolder();
      if (this.disposed) return;

      if (res.ok && res.pack) {
        this.assetRegistry.attachCustomPack(res.pack);
        this.state.meta.settings = {
          ...this.state.meta.settings,
          packMode: 'CUSTOM_PACK',
        };
        this.assetRegistry.setPackMode('CUSTOM_PACK');
        this.renderer.attachCustomPack(this.assetRegistry);
        this.persistSave();
        this.pushLocalToast(
          `Custom Pack Loaded (${res.spriteCount} sprites / ${res.sheetCount} sheets)`,
          '#7cf5be'
        );
      } else if (res.error) {
        this.pushLocalToast(res.error, '#ff8066');
      }
    } catch {
      if (!this.disposed) {
        this.pushLocalToast('Custom Pack selection cancelled or unavailable.', '#f5cb70');
      }
    }
  }

  private pushLocalToast(text: string, colorHex?: string): void {
    this.pendingUiEvents.push({ type: 'ui_toast', text, colorHex });
    if (this.pendingUiEvents.length > 32) {
      this.pendingUiEvents.splice(0, this.pendingUiEvents.length - 32);
    }
  }

  private applyScreenTransition(screen: ScreenId): void {
    this.screen = screen;
    this.state.run.paused = MODAL_PAUSING_SCREENS.has(screen);
    this.simAccumulator = 0;
    this.cosmeticFreezeRemainingSec = 0;
    if (isModalOverlayScreen(screen)) {
      this.clearPendingOneShots();
    }
    this.audio.updateMusic(this.state, this.screen);
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
    this.cosmeticFreezeRemainingSec = 0;
    this.cameraFeel.reset();
    this.clearPendingOneShots();
    this.drainEvents(true);
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
    this.cosmeticFreezeRemainingSec = 0;
    this.cameraFeel.reset();
    this.clearPendingOneShots();
    this.drainEvents(true);
    this.audio.updateMusic(this.state, this.screen);
    this.persistSave();
  }

  private handleUpdateSettings(partial: Partial<RenderSettings>): void {
    const prevPackMode = this.state.meta.settings.packMode;
    this.state.meta.settings = {
      ...this.state.meta.settings,
      ...partial,
    };
    this.audio.applySettings(this.state.meta.settings);
    this.input.setTouchMode(this.state.meta.settings.showTouchControls);

    if (partial.packMode && partial.packMode !== prevPackMode) {
      this.assetRegistry.setPackMode(this.state.meta.settings.packMode);
      this.renderer.attachCustomPack(this.assetRegistry);
      if (this.state.meta.settings.packMode === 'CUSTOM_PACK' && !this.assetRegistry.hasCustomPack()) {
        this.pushLocalToast(
          'No Custom Pack loaded — using Built-In Ink-Cel (load folder or run npm run extract)',
          '#f5cb70'
        );
      }
    }

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
    this.assetRegistry.setPackMode(fresh.settings.packMode);
    this.renderer.attachCustomPack(this.assetRegistry);
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
    if (isModalOverlayScreen(this.screen)) {
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

  private dispatchScreenFx(batch: readonly SimEvent[]): void {
    const feelRenderer = this.renderer as FeelAwareRenderer;
    if (typeof feelRenderer.triggerScreenFx !== 'function') return;

    for (let i = 0; i < batch.length; i++) {
      const ev = batch[i];
      let fx: ScreenFxImpulse | null = null;
      switch (ev.type) {
        case 'damage':
          if (ev.targetKind === 'enemy') {
            if (ev.armorBroken) {
              fx = {
                kind: 'shockwave',
                intensity: 0.58,
                worldX: ev.pos.x,
                worldY: ev.pos.y,
                colorHex: '#6CEEFF',
              };
            } else if (ev.crit) {
              fx = {
                kind: 'crit_burst',
                intensity: 0.48,
                worldX: ev.pos.x,
                worldY: ev.pos.y,
                colorHex: '#FFE066',
              };
            }
          }
          break;

        case 'deflect':
          fx = {
            kind: 'shockwave',
            intensity: 0.55,
            worldX: ev.pos.x,
            worldY: ev.pos.y,
            colorHex: '#6CEEFF',
          };
          break;

        case 'god_call': {
          const patronColor = PATRON_CONSTANTS[ev.patronId]?.colorHex ?? '#FFE066';
          fx = ev.greater
            ? {
                kind: 'greater_call',
                intensity: 0.85,
                worldX: ev.pos.x,
                worldY: ev.pos.y,
                colorHex: patronColor,
              }
            : {
                kind: 'chromatic',
                intensity: 0.42,
                worldX: ev.pos.x,
                worldY: ev.pos.y,
                colorHex: patronColor,
              };
          break;
        }

        case 'boss_phase':
          fx = {
            kind: 'boss_phase',
            intensity: 0.92,
            worldX: ev.pos.x,
            worldY: ev.pos.y,
            colorHex: '#FF2E46',
          };
          break;

        case 'death_defiance':
          fx = {
            kind: 'death_defiance',
            intensity: 1.0,
            worldX: ev.pos.x,
            worldY: ev.pos.y,
            colorHex: '#FFD266',
          };
          break;

        case 'enemy_death':
          if (ev.finalInRoom || ev.isBoss) {
            fx = {
              kind: 'shockwave',
              intensity: ev.isBoss ? 0.82 : 0.52,
              worldX: ev.pos.x,
              worldY: ev.pos.y,
              colorHex: ev.isBoss ? '#FF465A' : '#FFE066',
            };
          }
          break;

        default:
          break;
      }

      if (fx !== null) {
        feelRenderer.triggerScreenFx(fx);
      }
    }
  }

  private dispatchRumbleProfiles(batch: readonly SimEvent[]): void {
    let bestWeak = 0;
    let bestStrong = 0;
    let bestMs = 0;

    const consider = (weak: number, strong: number, ms: number): void => {
      if (weak > bestWeak) bestWeak = weak;
      if (strong > bestStrong) bestStrong = strong;
      if (ms > bestMs) bestMs = ms;
    };

    for (let i = 0; i < batch.length; i++) {
      const ev = batch[i];
      switch (ev.type) {
        case 'rumble':
          consider(ev.weak, ev.strong, ev.durationMs);
          break;

        case 'damage':
          if (ev.targetKind === 'player') {
            consider(0.68, 0.72, 125);
          } else if (ev.armorBroken) {
            consider(0.85, 0.65, 135);
          } else if (ev.crit || ev.backstab) {
            consider(0.78, 0.42, 110);
          } else if (ev.wallSlam || ev.amount >= 40) {
            consider(0.45, 0.55, 95);
          } else {
            consider(0.18, 0.08, 42);
          }
          break;

        case 'special_cast':
          consider(0.45, 0.55, 95);
          break;

        case 'deflect':
          consider(0.85, 0.65, 135);
          break;

        case 'enemy_death':
          if (ev.finalInRoom || ev.isBoss) {
            consider(0.85, 0.75, 165);
          }
          break;

        case 'boss_phase':
        case 'death_defiance':
          consider(0.9, 0.95, 260);
          break;

        case 'god_call':
          if (ev.greater) {
            consider(0.9, 0.95, 260);
          } else {
            consider(0.62, 0.52, 120);
          }
          break;

        default:
          break;
      }
    }

    if (bestMs > 0 && (bestWeak > 0 || bestStrong > 0)) {
      this.input.triggerRumble(bestWeak, bestStrong, bestMs);
    }
  }

  private drainEvents(isDebugStep = false): void {
    if (this.state.events.length === 0) return;

    const batch = this.state.events.splice(0, this.state.events.length);
    const camX =
      this.state.camera.zoom > 0.05 ? this.state.camera.x : this.state.player.pos.x;

    this.renderer.consumeEvents(batch, this.state);
    this.audio.handleSimEvents(batch, camX);
    this.cameraFeel.consumeEvents(batch, this.state, this.state.meta.settings.screenShake);
    this.dispatchScreenFx(batch);

    if (!isDebugStep) {
      this.dispatchRumbleProfiles(batch);
    }

    // Retain toast-relevant events for HudOverlay.processToasts() on the next ui.update()
    let freezeRequestSec = 0;
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

      if (!isDebugStep && this.state.hitstopTimer <= 0) {
        if (ev.type === 'deflect') {
          freezeRequestSec = Math.max(freezeRequestSec, 0.022);
        } else if (ev.type === 'damage' && ev.targetKind === 'enemy') {
          if (ev.armorBroken) {
            freezeRequestSec = Math.max(freezeRequestSec, 0.022);
          } else if (ev.crit) {
            freezeRequestSec = Math.max(freezeRequestSec, 0.018);
          }
        }
      }
    }
    if (this.pendingUiEvents.length > 32) {
      this.pendingUiEvents.splice(0, this.pendingUiEvents.length - 32);
    }

    // Crisp presentation-only micro-freeze grace (strictly clamped <= 24ms, 0ms in headless/debug step)
    if (
      !isDebugStep &&
      freezeRequestSec > 0 &&
      this.cosmeticFreezeCooldownSec <= 0 &&
      this.state.hitstopTimer <= 0 &&
      this.isGameplaySimRunning()
    ) {
      this.cosmeticFreezeRemainingSec = Math.min(MAX_COSMETIC_FREEZE_SEC, freezeRequestSec);
      this.cosmeticFreezeCooldownSec = COSMETIC_FREEZE_COOLDOWN_SEC;
    }

    let shouldSave = false;
    let roomChanged = false;
    for (let i = 0; i < batch.length; i++) {
      const ev = batch[i];
      if (ev.type === 'room_entered') {
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
      this.cameraFeel.reset();
      this.cosmeticFreezeRemainingSec = 0;
    }
    if (shouldSave) {
      this.persistSave();
    }
  }

  private frame(nowMs: number): void {
    const rawDtSec = this.lastRafMs > 0 ? (nowMs - this.lastRafMs) * 0.001 : SIM_CONSTANTS.fixedDt;
    this.lastRafMs = nowMs;
    const clampedDt = Math.max(0, Math.min(SIM_CONSTANTS.maxFrameDt, rawDtSec));
    this.cosmeticFreezeCooldownSec = Math.max(0, this.cosmeticFreezeCooldownSec - clampedDt);

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
      this.cosmeticFreezeRemainingSec = 0;
      this.clearPendingOneShots();
      this.audio.playUiSound('click');
      // Prevent PauseAndOptionsModal from immediately resuming on the exact same frame
      uiMenuNav = { ...menuNav, pause: false, back: false };
    }

    // 3. Fixed 60Hz deterministic simulation substeps
    const simRunningNow = this.isGameplaySimRunning();
    if (simRunningNow) {
      // Always latch one-shot presses before checking accumulator or micro-freeze so 120Hz/144Hz
      // frames never drop dash/attack/special/cast/interact presses!
      this.latchOneShots(polledInput);

      if (this.cosmeticFreezeRemainingSec > 0) {
        this.cosmeticFreezeRemainingSec = Math.max(
          0,
          this.cosmeticFreezeRemainingSec - clampedDt
        );
      } else {
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
          this.drainEvents(false);
          this.syncScreenFromState();

          this.simAccumulator -= SIM_CONSTANTS.fixedDt;
          steps += 1;

          if (!this.isGameplaySimRunning()) {
            this.simAccumulator = 0;
            this.clearPendingOneShots();
            break;
          }
        }
      }
    } else {
      this.simAccumulator = 0;
      this.cosmeticFreezeRemainingSec = 0;
      this.clearPendingOneShots();
      this.syncScreenFromState();
    }

    // 4. Adaptive Greek-metal soundtrack state sync
    this.audio.updateMusic(this.state, this.screen);

    // 5. Presentation-layer cosmetic camera feel update (aim look-ahead, recoil, zoom punch, trauma)
    const settings = this.state.meta.settings;
    const feelOffset = this.cameraFeel.update(
      clampedDt,
      this.state,
      polledInput,
      this.screen,
      settings
    );
    (this.renderer as FeelAwareRenderer).setCameraFeelOffset?.(feelOffset);

    // 6. Render pacing honoring targetFps (30 | 60 | 120) and classicSnap60Hz
    const minRenderMs = settings.targetFps >= 120 ? 0 : 1000 / settings.targetFps - 1.5;
    const shouldRender = this.lastRenderMs === 0 || nowMs - this.lastRenderMs >= minRenderMs;

    if (shouldRender) {
      this.lastRenderMs = nowMs;
      const interpAlpha =
        !this.isGameplaySimRunning() || settings.classicSnap60Hz || this.cosmeticFreezeRemainingSec > 0
          ? 1
          : Math.max(0, Math.min(1, this.simAccumulator / SIM_CONSTANTS.fixedDt));
      this.renderer.render(this.state, this.prevState, interpAlpha, settings, nowMs);
    }

    // 7. Always update UI when rendering OR when a menu/debug input edge occurred
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
