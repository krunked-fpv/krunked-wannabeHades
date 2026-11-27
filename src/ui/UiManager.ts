import type {
  AspectId,
  DebugBridge,
  InputSource,
  KeepsakeId,
  MirrorUpgradeId,
  PatronId,
  RenderSettings,
  ScreenId,
  ShrineVowId,
  SimEvent,
  SimState,
  WeaponId,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';
import { BoonSelectModal } from './BoonSelectModal.js';
import { DebugDrawer } from './DebugDrawer.js';
import { HudOverlay, type HudRenderStats } from './HudOverlay.js';
import { KeepsakeModal } from './KeepsakeModal.js';
import { MirrorModal } from './MirrorModal.js';
import { PauseAndOptionsModal } from './PauseAndOptionsModal.js';
import { ShopAndCodexModal } from './ShopAndCodexModal.js';
import { ShrineModal } from './ShrineModal.js';
import { injectUiStyles } from './styles.js';
import { TitleScreen } from './TitleScreen.js';
import { WeaponRackModal } from './WeaponRackModal.js';

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
  readonly onUiHover?: () => void;

  // Wave 2 Hub Meta, Shop & Codex Callbacks (optional for backwards compatibility)
  onOpenScreen?(screen: ScreenId): void;
  onSelectWeapon?(weaponId: WeaponId, aspectId: AspectId): void;
  onUpgradeAspect?(aspectId: AspectId): void;
  onUpgradeMirror?(id: MirrorUpgradeId): void;
  onToggleMirrorSide?(id: MirrorUpgradeId): void;
  onRefundMirror?(): void;
  onSetShrineVow?(id: ShrineVowId, rank: number): void;
  onSelectKeepsake?(id: KeepsakeId | null): void;
  onBuyShopItem?(pickupId: string): void;
  onBorrowGoldBag?(): void;
}

export class UiManager {
  private readonly uiRoot: HTMLElement;
  private readonly callbacks: UiCallbacks;
  private readonly hud: HudOverlay;
  private readonly titleScreen: TitleScreen;
  private readonly boonModal: BoonSelectModal;
  private readonly pauseAndOptions: PauseAndOptionsModal;
  private readonly weaponRackModal: WeaponRackModal;
  private readonly mirrorModal: MirrorModal;
  private readonly shrineModal: ShrineModal;
  private readonly keepsakeModal: KeepsakeModal;
  private readonly shopAndCodexModal: ShopAndCodexModal;
  private readonly debugDrawer: DebugDrawer;

  constructor(uiRoot: HTMLElement, callbacks: UiCallbacks) {
    injectUiStyles();
    this.uiRoot = uiRoot;
    this.callbacks = callbacks;
    this.uiRoot.innerHTML = '';

    this.hud = new HudOverlay(uiRoot, callbacks.onOpenScreen, callbacks.onUiHover);
    this.titleScreen = new TitleScreen(uiRoot, callbacks);
    this.boonModal = new BoonSelectModal(uiRoot, callbacks);
    this.pauseAndOptions = new PauseAndOptionsModal(uiRoot, callbacks);
    this.weaponRackModal = new WeaponRackModal(uiRoot, callbacks);
    this.mirrorModal = new MirrorModal(uiRoot, callbacks);
    this.shrineModal = new ShrineModal(uiRoot, callbacks);
    this.keepsakeModal = new KeepsakeModal(uiRoot, callbacks);
    this.shopAndCodexModal = new ShopAndCodexModal(uiRoot, callbacks);
    this.debugDrawer = new DebugDrawer(uiRoot, callbacks);
  }

  /**
   * Updates all active UI views for the current render frame.
   * Note: Automatically handles `menuNav.toggleDebug` (F9) and `menuNav.codex` (LB / Tab).
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

    // Handle LB / Tab Codex shortcut cleanly without double-toggling on Xbox LB tab switching
    let effectiveNav = menuNav;
    if (menuNav.codex) {
      if (screen === 'hub' || screen === 'playing') {
        this.callbacks.onOpenScreen?.('codex_menu');
        effectiveNav = { ...menuNav, codex: false, tabPrev: false };
      } else if (screen === 'codex_menu' && !menuNav.tabPrev) {
        // Keyboard Tab toggles Codex closed; Xbox LB switches Codex tabs while B closes
        this.callbacks.onCloseModal();
        effectiveNav = { ...menuNav, codex: false };
      }
    }

    this.hud.update(state, screen, activeSource, renderStats, drainedEvents);
    this.titleScreen.update(screen === 'title', state.meta, activeSource, effectiveNav);
    this.boonModal.update(
      screen === 'boon_select',
      state.run.pendingOffer,
      activeSource,
      effectiveNav
    );
    this.pauseAndOptions.update(state, screen, effectiveNav);
    this.weaponRackModal.update(screen === 'weapon_menu', state, activeSource, effectiveNav);
    this.mirrorModal.update(screen === 'mirror_menu', state, activeSource, effectiveNav);
    this.shrineModal.update(screen === 'shrine_menu', state, activeSource, effectiveNav);
    this.keepsakeModal.update(screen === 'keepsake_menu', state, activeSource, effectiveNav);
    this.shopAndCodexModal.update(state, screen, activeSource, effectiveNav);
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
    this.weaponRackModal.dispose();
    this.mirrorModal.dispose();
    this.shrineModal.dispose();
    this.keepsakeModal.dispose();
    this.shopAndCodexModal.dispose();
    this.debugDrawer.dispose();
    this.uiRoot.innerHTML = '';
  }
}
