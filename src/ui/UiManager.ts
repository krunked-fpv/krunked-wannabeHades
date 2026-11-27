import type {
  DebugBridge,
  InputSource,
  PatronId,
  RenderSettings,
  ScreenId,
  SimEvent,
  SimState,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';
import { BoonSelectModal } from './BoonSelectModal.js';
import { DebugDrawer } from './DebugDrawer.js';
import { HudOverlay, type HudRenderStats } from './HudOverlay.js';
import { PauseAndOptionsModal } from './PauseAndOptionsModal.js';
import { injectUiStyles } from './styles.js';
import { TitleScreen } from './TitleScreen.js';

export interface UiCallbacks {
  onEnterCourtyard(): void;
  onStartRun(seed?: number): void;
  onSelectBoon(index: number): void;
  onRerollBoon(): void;
  onResume(): void;
  onReturnToCourtyard(): void;
  onReturnToTitle(): void;
  onOpenOptions(): void;
  onCloseModal(): void;
  onUpdateSettings(partial: Partial<RenderSettings>): void;
  onToggleGodMode(enabled: boolean): void;
  onLoadCustomPackFolder?(): void;
  onResetSave(): void;
  getPortraitUrl(patronId: PatronId): string;
  getDebugBridge(): DebugBridge | null;
}

export class UiManager {
  private readonly uiRoot: HTMLElement;
  private readonly hud: HudOverlay;
  private readonly titleScreen: TitleScreen;
  private readonly boonModal: BoonSelectModal;
  private readonly pauseAndOptions: PauseAndOptionsModal;
  private readonly debugDrawer: DebugDrawer;

  constructor(uiRoot: HTMLElement, callbacks: UiCallbacks) {
    injectUiStyles();
    this.uiRoot = uiRoot;
    this.uiRoot.innerHTML = '';

    this.hud = new HudOverlay(uiRoot);
    this.titleScreen = new TitleScreen(uiRoot, callbacks);
    this.boonModal = new BoonSelectModal(uiRoot, callbacks);
    this.pauseAndOptions = new PauseAndOptionsModal(uiRoot, callbacks);
    this.debugDrawer = new DebugDrawer(uiRoot, callbacks);
  }

  /**
   * Updates all active UI views for the current render frame.
   * Note: Automatically handles `menuNav.toggleDebug` (F9) to toggle the Playtest Drawer.
   */
  public update(
    state: SimState,
    screen: ScreenId,
    activeSource: InputSource,
    renderStats: HudRenderStats,
    menuNav: MenuNavInput,
    hash: string,
    drainedEvents?: readonly SimEvent[]
  ): void {
    if (menuNav.toggleDebug) {
      this.debugDrawer.toggle();
    }

    this.hud.update(state, screen, activeSource, renderStats, drainedEvents);
    this.titleScreen.update(screen === 'title', state.meta, activeSource, menuNav);
    this.boonModal.update(
      screen === 'boon_select',
      state.run.pendingOffer,
      activeSource,
      menuNav
    );
    this.pauseAndOptions.update(state, screen, menuNav);
    this.debugDrawer.update(state, activeSource, renderStats, hash);
  }

  public toggleDebugDrawer(): void {
    this.debugDrawer.toggle();
  }

  public isDebugDrawerOpen(): boolean {
    return this.debugDrawer.isOpen();
  }

  public dispose(): void {
    this.hud.dispose();
    this.titleScreen.dispose();
    this.boonModal.dispose();
    this.pauseAndOptions.dispose();
    this.debugDrawer.dispose();
    this.uiRoot.innerHTML = '';
  }
}
