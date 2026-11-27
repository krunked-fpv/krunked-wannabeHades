import {
  ASPECT_DEFS,
  BIOME_CONSTANTS,
  BOSS_CONSTANTS,
  PATRON_CONSTANTS,
  PLAYER_CONSTANTS,
  WEAPON_CONSTANTS,
  type RenderSettings,
  type ScreenId,
  type SimState,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';

export interface PauseAndOptionsCallbacks {
  onResume(): void;
  onReturnToCourtyard(): void;
  onReturnToTitle(): void;
  onStartRun(seed?: number): void;
  onOpenOptions(): void;
  onCloseModal(): void;
  onUpdateSettings(partial: Partial<RenderSettings>): void;
  onToggleGodMode(enabled: boolean): void;
  onLoadCustomPackFolder?(): void;
  onResetSave(): void;
}

const FPS_CHOICES: readonly (30 | 60 | 120)[] = [30, 60, 120];
const TOUCH_CHOICES: readonly ('auto' | 'always' | 'off')[] = ['auto', 'always', 'off'];
const PACK_CHOICES: readonly ('BUILTIN' | 'CUSTOM_PACK')[] = ['BUILTIN', 'CUSTOM_PACK'];

function computeGodModeDrPercent(deaths: number): number {
  const clamped = Math.min(PLAYER_CONSTANTS.godModeMaxDeaths, Math.max(0, deaths));
  const mult = PLAYER_CONSTANTS.godModeBaseMultiplier - clamped * PLAYER_CONSTANTS.godModePerDeathStep;
  return Math.round((1 - mult) * 100);
}

function formatRunDuration(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

type ModalMode = 'none' | 'pause' | 'options' | 'victory' | 'death' | 'submenu';

interface OptionRowControl {
  rowEl: HTMLElement;
  adjust(delta: -1 | 1): void;
  activate(): void;
}

export class PauseAndOptionsModal {
  private readonly backdrop: HTMLDivElement;
  private readonly callbacks: PauseAndOptionsCallbacks;

  private activeMode: ModalMode = 'none';
  private activeSubmenuScreen: ScreenId | null = null;
  private focusedIndex = 0;
  private resetArmed = false;

  // Pause elements
  private readonly pausePanel: HTMLDivElement;
  private readonly pauseSubtitleEl: HTMLDivElement;
  private readonly pauseButtons: HTMLButtonElement[];

  // Options elements
  private readonly optionsPanel: HTMLDivElement;
  private readonly optionRows: OptionRowControl[] = [];
  private readonly fpsSegButtons: HTMLButtonElement[] = [];
  private readonly snapToggleBtn: HTMLButtonElement;
  private readonly shakeToggleBtn: HTMLButtonElement;
  private readonly showFpsToggleBtn: HTMLButtonElement;
  private readonly godModeToggleBtn: HTMLButtonElement;
  private readonly godModeSubEl: HTMLSpanElement;
  private readonly touchSegButtons: HTMLButtonElement[] = [];
  private readonly masterSlider: HTMLInputElement;
  private readonly masterValEl: HTMLSpanElement;
  private readonly musicSlider: HTMLInputElement;
  private readonly musicValEl: HTMLSpanElement;
  private readonly sfxSlider: HTMLInputElement;
  private readonly sfxValEl: HTMLSpanElement;
  private readonly packSegButtons: HTMLButtonElement[] = [];
  private readonly loadPackBtn: HTMLButtonElement;
  private readonly resetSaveBtn: HTMLButtonElement;
  private readonly optionsBackBtn: HTMLButtonElement;

  // Victory / Death Summary elements
  private readonly summaryPanel: HTMLDivElement;
  private readonly summaryTitleEl: HTMLHeadingElement;
  private readonly summarySubEl: HTMLDivElement;
  private readonly summaryStatsEl: HTMLDivElement;
  private readonly summaryBoonsEl: HTMLDivElement;
  private readonly summaryButtons: HTMLButtonElement[];
  private lastSummaryKey = '';

  // Lightweight fallback panel for hub submenus (weapon/mirror/shrine/keepsake/shop/codex)
  private readonly submenuPanel: HTMLDivElement;
  private readonly submenuTitleEl: HTMLHeadingElement;
  private readonly submenuBodyEl: HTMLDivElement;
  private readonly submenuCloseBtn: HTMLButtonElement;

  private latestState: SimState | null = null;

  constructor(uiRoot: HTMLElement, callbacks: PauseAndOptionsCallbacks) {
    this.callbacks = callbacks;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'kh-modal-backdrop kh-hidden';

    // ==================== 1. PAUSE MENU ====================
    this.pausePanel = document.createElement('div');
    this.pausePanel.className = 'kh-modal-panel kh-modal-panel-narrow kh-hidden';
    this.pausePanel.setAttribute('data-screen', 'pause');

    const pauseTitle = document.createElement('h2');
    pauseTitle.className = 'kh-modal-title';
    pauseTitle.textContent = 'ESCAPE PAUSED';

    this.pauseSubtitleEl = document.createElement('div');
    this.pauseSubtitleEl.className = 'kh-modal-subtitle';

    const pauseMeander = document.createElement('div');
    pauseMeander.className = 'kh-meander-strip';

    const pauseActions = document.createElement('div');
    pauseActions.className = 'kh-modal-actions';

    const btnResume = this.makeBtn('RESUME ESCAPE', true);
    const btnOptions = this.makeBtn('OPTIONS', false);
    const btnCourtyard = this.makeBtn('RETURN TO COURTYARD', false);
    const btnTitle = this.makeBtn('RETURN TO TITLE', false);

    btnResume.addEventListener('click', () => this.callbacks.onResume());
    btnOptions.addEventListener('click', () => this.callbacks.onOpenOptions());
    btnCourtyard.addEventListener('click', () => this.callbacks.onReturnToCourtyard());
    btnTitle.addEventListener('click', () => this.callbacks.onReturnToTitle());

    this.pauseButtons = [btnResume, btnOptions, btnCourtyard, btnTitle];
    this.pauseButtons.forEach((b, idx) => {
      b.addEventListener('pointerenter', () => {
        if (this.activeMode === 'pause') {
          this.focusedIndex = idx;
          this.applyFocus();
        }
      });
    });

    pauseActions.append(...this.pauseButtons);
    this.pausePanel.append(pauseTitle, this.pauseSubtitleEl, pauseMeander, pauseActions);

    // ==================== 2. OPTIONS PANEL ====================
    this.optionsPanel = document.createElement('div');
    this.optionsPanel.className = 'kh-modal-panel kh-modal-panel-wide kh-hidden';
    this.optionsPanel.setAttribute('data-screen', 'options');

    const optTitle = document.createElement('h2');
    optTitle.className = 'kh-modal-title';
    optTitle.textContent = 'OPTIONS & ACCESSIBILITY';

    const optMeander = document.createElement('div');
    optMeander.className = 'kh-meander-strip';

    const optGrid = document.createElement('div');
    optGrid.className = 'kh-options-grid';

    // Target FPS: 30 / 60 / 120
    const fpsRow = this.createSegmentedRow(
      'Target FPS',
      'Display pacing cap',
      FPS_CHOICES.map((f) => String(f)),
      this.fpsSegButtons,
      (idx) => this.callbacks.onUpdateSettings({ targetFps: FPS_CHOICES[idx] }),
      () => {
        const cur = this.latestState?.meta.settings.targetFps ?? 120;
        return Math.max(0, FPS_CHOICES.indexOf(cur));
      }
    );

    // Classic 60Hz Snap
    this.snapToggleBtn = this.makeToggleBtn();
    const snapRow = this.createToggleRow(
      'Classic 60Hz Snap',
      'Authentic 60Hz frame cadence',
      this.snapToggleBtn,
      () => {
        const cur = this.latestState?.meta.settings.classicSnap60Hz ?? false;
        this.callbacks.onUpdateSettings({ classicSnap60Hz: !cur });
      }
    );

    // Screen Shake
    this.shakeToggleBtn = this.makeToggleBtn();
    const shakeRow = this.createToggleRow(
      'Screen Shake',
      'Impact & boss hit feedback',
      this.shakeToggleBtn,
      () => {
        const cur = this.latestState?.meta.settings.screenShake ?? true;
        this.callbacks.onUpdateSettings({ screenShake: !cur });
      }
    );

    // Show FPS
    this.showFpsToggleBtn = this.makeToggleBtn();
    const showFpsRow = this.createToggleRow(
      'Show FPS',
      'Display live FPS & renderer',
      this.showFpsToggleBtn,
      () => {
        const cur = this.latestState?.meta.settings.showFps ?? false;
        this.callbacks.onUpdateSettings({ showFps: !cur });
      }
    );

    // God Mode + Live DR%
    this.godModeToggleBtn = this.makeToggleBtn();
    const godRowPair = this.createToggleRowWithSub(
      'God Mode',
      'Damage Resist: 20%',
      this.godModeToggleBtn,
      () => {
        const cur = this.latestState?.meta.godModeEnabled ?? false;
        this.callbacks.onToggleGodMode(!cur);
      }
    );
    this.godModeSubEl = godRowPair.subEl;

    // Touch Controls: Auto / Always / Off
    const touchRow = this.createSegmentedRow(
      'Touch Controls',
      'Auto hides on desktop/gamepad',
      ['AUTO', 'ALWAYS', 'OFF'],
      this.touchSegButtons,
      (idx) => this.callbacks.onUpdateSettings({ showTouchControls: TOUCH_CHOICES[idx] }),
      () => {
        const cur = this.latestState?.meta.settings.showTouchControls ?? 'auto';
        return Math.max(0, TOUCH_CHOICES.indexOf(cur));
      }
    );

    // Volume Sliders: Master, Music, SFX
    const masterCtrl = this.createSliderRow('Master Volume', 'masterVolume');
    this.masterSlider = masterCtrl.slider;
    this.masterValEl = masterCtrl.valEl;

    const musicCtrl = this.createSliderRow('Music Volume', 'musicVolume');
    this.musicSlider = musicCtrl.slider;
    this.musicValEl = musicCtrl.valEl;

    const sfxCtrl = this.createSliderRow('SFX Volume', 'sfxVolume');
    this.sfxSlider = sfxCtrl.slider;
    this.sfxValEl = sfxCtrl.valEl;

    // Pack Mode: Built-In / Custom
    const packRow = this.createSegmentedRow(
      'Pack Mode',
      'Visual & audio asset source',
      ['BUILT-IN', 'CUSTOM'],
      this.packSegButtons,
      (idx) => this.callbacks.onUpdateSettings({ packMode: PACK_CHOICES[idx] }),
      () => {
        const cur = this.latestState?.meta.settings.packMode ?? 'BUILTIN';
        return Math.max(0, PACK_CHOICES.indexOf(cur));
      }
    );

    optGrid.append(
      fpsRow.rowEl,
      snapRow.rowEl,
      shakeRow.rowEl,
      showFpsRow.rowEl,
      godRowPair.control.rowEl,
      touchRow.rowEl,
      masterCtrl.control.rowEl,
      musicCtrl.control.rowEl,
      sfxCtrl.control.rowEl,
      packRow.rowEl
    );

    const optFooter = document.createElement('div');
    optFooter.className = 'kh-modal-actions-row';

    this.loadPackBtn = this.makeBtn('LOAD CUSTOM PACK', false);
    this.loadPackBtn.addEventListener('click', () => this.callbacks.onLoadCustomPackFolder?.());

    this.resetSaveBtn = this.makeBtn('RESET SAVE', false);
    this.resetSaveBtn.classList.add('kh-btn-danger');
    this.resetSaveBtn.addEventListener('click', () => this.handleResetSaveClick());

    this.optionsBackBtn = this.makeBtn('BACK', true);
    this.optionsBackBtn.addEventListener('click', () => {
      this.resetArmed = false;
      this.callbacks.onCloseModal();
    });

    optFooter.append(this.loadPackBtn, this.resetSaveBtn, this.optionsBackBtn);

    this.optionRows.push(
      fpsRow,
      snapRow,
      shakeRow,
      showFpsRow,
      godRowPair.control,
      touchRow,
      masterCtrl.control,
      musicCtrl.control,
      sfxCtrl.control,
      packRow,
      {
        rowEl: this.loadPackBtn,
        adjust: () => {},
        activate: () => this.callbacks.onLoadCustomPackFolder?.(),
      },
      {
        rowEl: this.resetSaveBtn,
        adjust: () => {},
        activate: () => this.handleResetSaveClick(),
      },
      {
        rowEl: this.optionsBackBtn,
        adjust: () => {},
        activate: () => {
          this.resetArmed = false;
          this.callbacks.onCloseModal();
        },
      }
    );

    this.optionRows.forEach((ctrl, idx) => {
      ctrl.rowEl.addEventListener('pointerenter', () => {
        if (this.activeMode === 'options') {
          this.focusedIndex = idx;
          this.applyFocus();
        }
      });
    });

    this.optionsPanel.append(optTitle, optMeander, optGrid, optFooter);

    // ==================== 3. VICTORY & DEATH SUMMARY ====================
    this.summaryPanel = document.createElement('div');
    this.summaryPanel.className = 'kh-modal-panel kh-hidden';

    this.summaryTitleEl = document.createElement('h2');
    this.summaryTitleEl.className = 'kh-modal-title';
    this.summarySubEl = document.createElement('div');
    this.summarySubEl.className = 'kh-modal-subtitle';
    const sumMeander = document.createElement('div');
    sumMeander.className = 'kh-meander-strip';

    this.summaryStatsEl = document.createElement('div');
    this.summaryStatsEl.className = 'kh-stats-grid';

    this.summaryBoonsEl = document.createElement('div');
    this.summaryBoonsEl.className = 'kh-boon-strip';
    this.summaryBoonsEl.style.justifyContent = 'center';

    const sumActions = document.createElement('div');
    sumActions.className = 'kh-modal-actions-row';
    const btnSumCourtyard = this.makeBtn('RETURN TO COURTYARD', true);
    const btnSumRetry = this.makeBtn('NEW ESCAPE RUN', false);
    const btnSumTitle = this.makeBtn('TITLE SCREEN', false);

    btnSumCourtyard.addEventListener('click', () => this.callbacks.onReturnToCourtyard());
    btnSumRetry.addEventListener('click', () => this.callbacks.onStartRun());
    btnSumTitle.addEventListener('click', () => this.callbacks.onReturnToTitle());

    this.summaryButtons = [btnSumCourtyard, btnSumRetry, btnSumTitle];
    this.summaryButtons.forEach((b, idx) => {
      b.addEventListener('pointerenter', () => {
        if (this.activeMode === 'victory' || this.activeMode === 'death') {
          this.focusedIndex = idx;
          this.applyFocus();
        }
      });
    });

    sumActions.append(...this.summaryButtons);
    this.summaryPanel.append(
      this.summaryTitleEl,
      this.summarySubEl,
      sumMeander,
      this.summaryStatsEl,
      this.summaryBoonsEl,
      sumActions
    );

    // ==================== 4. FALLBACK HUB SUBMENU ====================
    this.submenuPanel = document.createElement('div');
    this.submenuPanel.className = 'kh-modal-panel kh-modal-panel-narrow kh-hidden';
    this.submenuTitleEl = document.createElement('h2');
    this.submenuTitleEl.className = 'kh-modal-title';
    const subMeander = document.createElement('div');
    subMeander.className = 'kh-meander-strip';
    this.submenuBodyEl = document.createElement('div');
    this.submenuBodyEl.style.fontSize = '13px';
    this.submenuBodyEl.style.lineHeight = '1.5';
    this.submenuBodyEl.style.color = '#dfd5c8';
    this.submenuBodyEl.style.textAlign = 'center';
    this.submenuCloseBtn = this.makeBtn('CLOSE', true);
    this.submenuCloseBtn.addEventListener('click', () => this.callbacks.onCloseModal());
    this.submenuPanel.append(this.submenuTitleEl, subMeander, this.submenuBodyEl, this.submenuCloseBtn);

    this.backdrop.append(this.pausePanel, this.optionsPanel, this.summaryPanel, this.submenuPanel);
    uiRoot.appendChild(this.backdrop);
  }

  public update(state: SimState, screen: ScreenId, menuNav: MenuNavInput): void {
    this.latestState = state;
    const nextMode = this.resolveMode(screen);

    if (nextMode !== this.activeMode || (nextMode === 'submenu' && screen !== this.activeSubmenuScreen)) {
      this.activeMode = nextMode;
      this.activeSubmenuScreen = nextMode === 'submenu' ? screen : null;
      this.focusedIndex = 0;
      this.resetArmed = false;
      this.lastSummaryKey = '';
      this.syncPanelVisibility();
      this.applyFocus();
    }

    if (this.activeMode === 'none') {
      return;
    }

    if (this.activeMode === 'pause') {
      const biomeName = BIOME_CONSTANTS[state.room.biome].displayName;
      const subText = `${biomeName} · Chamber ${state.room.depth} · ${formatRunDuration(state.run.elapsedSeconds)}`;
      if (this.pauseSubtitleEl.textContent !== subText) {
        this.pauseSubtitleEl.textContent = subText;
      }
      this.handlePauseNav(menuNav);
    } else if (this.activeMode === 'options') {
      this.syncOptionsValues(state);
      this.handleOptionsNav(menuNav);
    } else if (this.activeMode === 'victory' || this.activeMode === 'death') {
      this.syncSummaryView(state, this.activeMode === 'victory');
      this.handleSummaryNav(menuNav);
    } else if (this.activeMode === 'submenu') {
      this.syncSubmenuView(state, screen);
      if (menuNav.confirm || menuNav.back || menuNav.pause) {
        this.callbacks.onCloseModal();
      }
    }
  }

  public dispose(): void {
    this.backdrop.remove();
  }

  private resolveMode(screen: ScreenId): ModalMode {
    switch (screen) {
      case 'pause':
        return 'pause';
      case 'options':
        return 'options';
      case 'victory':
        return 'victory';
      case 'death':
        return 'death';
      default:
        return 'none';
    }
  }

  private syncPanelVisibility(): void {
    this.backdrop.classList.toggle('kh-hidden', this.activeMode === 'none');
    this.pausePanel.classList.toggle('kh-hidden', this.activeMode !== 'pause');
    this.optionsPanel.classList.toggle('kh-hidden', this.activeMode !== 'options');
    this.summaryPanel.classList.toggle(
      'kh-hidden',
      this.activeMode !== 'victory' && this.activeMode !== 'death'
    );
    this.submenuPanel.classList.toggle('kh-hidden', this.activeMode !== 'submenu');
  }

  private handlePauseNav(menuNav: MenuNavInput): void {
    if (menuNav.back || menuNav.pause) {
      this.callbacks.onResume();
      return;
    }
    const len = this.pauseButtons.length;
    if (menuNav.up) {
      this.focusedIndex = (this.focusedIndex - 1 + len) % len;
      this.applyFocus();
    } else if (menuNav.down) {
      this.focusedIndex = (this.focusedIndex + 1) % len;
      this.applyFocus();
    }
    if (menuNav.confirm) {
      this.pauseButtons[this.focusedIndex]?.click();
    }
  }

  private handleOptionsNav(menuNav: MenuNavInput): void {
    if (menuNav.back || menuNav.pause) {
      this.resetArmed = false;
      this.callbacks.onCloseModal();
      return;
    }
    const len = this.optionRows.length;
    if (menuNav.up) {
      this.focusedIndex = (this.focusedIndex - 1 + len) % len;
      this.applyFocus();
    } else if (menuNav.down) {
      this.focusedIndex = (this.focusedIndex + 1) % len;
      this.applyFocus();
    } else if (menuNav.left) {
      this.optionRows[this.focusedIndex]?.adjust(-1);
    } else if (menuNav.right) {
      this.optionRows[this.focusedIndex]?.adjust(1);
    }
    if (menuNav.confirm) {
      this.optionRows[this.focusedIndex]?.activate();
    }
  }

  private handleSummaryNav(menuNav: MenuNavInput): void {
    const len = this.summaryButtons.length;
    if (menuNav.left || menuNav.up) {
      this.focusedIndex = (this.focusedIndex - 1 + len) % len;
      this.applyFocus();
    } else if (menuNav.right || menuNav.down) {
      this.focusedIndex = (this.focusedIndex + 1) % len;
      this.applyFocus();
    }
    if (menuNav.confirm) {
      this.summaryButtons[this.focusedIndex]?.click();
    }
  }

  private syncOptionsValues(state: SimState): void {
    const s = state.meta.settings;

    FPS_CHOICES.forEach((fps, i) => {
      this.fpsSegButtons[i]?.classList.toggle('kh-active', s.targetFps === fps);
    });

    this.setToggleBtnState(this.snapToggleBtn, s.classicSnap60Hz);
    this.setToggleBtnState(this.shakeToggleBtn, s.screenShake);
    this.setToggleBtnState(this.showFpsToggleBtn, s.showFps);

    const godOn = state.meta.godModeEnabled || state.run.godModeEnabled;
    this.setToggleBtnState(this.godModeToggleBtn, godOn);
    const drPct = computeGodModeDrPercent(state.meta.godModeDeaths);
    const drLabel = godOn
      ? `ACTIVE — ${drPct}% Damage Resist`
      : `OFF — Grants ${drPct}% DR (+2%/death)`;
    if (this.godModeSubEl.textContent !== drLabel) {
      this.godModeSubEl.textContent = drLabel;
    }

    TOUCH_CHOICES.forEach((mode, i) => {
      this.touchSegButtons[i]?.classList.toggle('kh-active', s.showTouchControls === mode);
    });

    const masterPct = Math.round(s.masterVolume * 100);
    if (document.activeElement !== this.masterSlider) {
      this.masterSlider.value = String(masterPct);
    }
    this.masterValEl.textContent = `${masterPct}%`;

    const musicPct = Math.round(s.musicVolume * 100);
    if (document.activeElement !== this.musicSlider) {
      this.musicSlider.value = String(musicPct);
    }
    this.musicValEl.textContent = `${musicPct}%`;

    const sfxPct = Math.round(s.sfxVolume * 100);
    if (document.activeElement !== this.sfxSlider) {
      this.sfxSlider.value = String(sfxPct);
    }
    this.sfxValEl.textContent = `${sfxPct}%`;

    PACK_CHOICES.forEach((mode, i) => {
      this.packSegButtons[i]?.classList.toggle('kh-active', s.packMode === mode);
    });

    const resetLabel = this.resetArmed ? 'CONFIRM RESET SAVE?' : 'RESET SAVE';
    if (this.resetSaveBtn.textContent !== resetLabel) {
      this.resetSaveBtn.textContent = resetLabel;
    }
  }

  private syncSummaryView(state: SimState, isVictory: boolean): void {
    const key = `${isVictory ? 'V' : 'D'}:${state.run.chambersCleared}:${state.run.kills}:${Math.round(state.run.damageDealt)}:${state.player.boons.length}:${state.player.weaponId}`;
    if (key === this.lastSummaryKey) {
      return;
    }
    this.lastSummaryKey = key;

    this.summaryPanel.setAttribute('data-screen', isVictory ? 'victory' : 'death');
    this.summaryTitleEl.className = isVictory
      ? 'kh-modal-title kh-victory-title'
      : 'kh-modal-title kh-death-title';
    this.summaryTitleEl.textContent = isVictory ? 'ESCAPE COMPLETE' : 'THERE IS NO ESCAPE';

    const biome = BIOME_CONSTANTS[state.room.biome].displayName;
    const weapon = WEAPON_CONSTANTS[state.player.weaponId].displayName;
    const aspect = ASPECT_DEFS[state.player.aspectId].displayName;
    this.summarySubEl.textContent = isVictory
      ? `THE FROZEN SUMMIT CONQUERED · ${weapon.toUpperCase()} (${aspect.toUpperCase()})`
      : `FALLEN IN ${biome.toUpperCase()} (CHAMBER ${state.room.depth}) · ${weapon.toUpperCase()}`;

    this.summaryStatsEl.innerHTML = '';
    const stats: [string, string][] = [
      ['Run Time', formatRunDuration(state.run.elapsedSeconds)],
      ['Chambers Cleared', String(state.run.chambersCleared)],
      ['Foes Vanquished', String(state.run.kills)],
      ['Damage Dealt', String(Math.round(state.run.damageDealt))],
      ['Shrine Heat', String(state.run.heat)],
      [
        'Bosses Slain',
        state.run.bossesDefeated.length > 0
          ? state.run.bossesDefeated.map((id) => BOSS_CONSTANTS[id].displayName).join(', ')
          : 'None',
      ],
    ];

    for (const [label, val] of stats) {
      const card = document.createElement('div');
      card.className = 'kh-stat-card';
      const k = document.createElement('span');
      k.className = 'kh-stat-key';
      k.textContent = label;
      const v = document.createElement('span');
      v.className = 'kh-stat-val';
      v.textContent = val;
      card.append(k, v);
      this.summaryStatsEl.appendChild(card);
    }

    this.summaryBoonsEl.innerHTML = '';
    for (const boon of state.player.boons.slice(0, 10)) {
      const chip = document.createElement('div');
      chip.className = 'kh-boon-chip';
      const dot = document.createElement('span');
      dot.className = 'kh-boon-dot';
      dot.style.background = PATRON_CONSTANTS[boon.patronId].colorHex;
      const text = document.createElement('span');
      text.textContent = `${boon.name}${boon.level > 1 ? ` Lv.${boon.level}` : ''}`;
      chip.append(dot, text);
      this.summaryBoonsEl.appendChild(chip);
    }

    this.summaryButtons[0].textContent = isVictory ? 'RETURN TO COURTYARD' : 'RISE IN COURTYARD';
    this.summaryButtons[1].textContent = isVictory ? 'NEW ESCAPE RUN' : 'TRY AGAIN';
  }

  private syncSubmenuView(state: SimState, screen: ScreenId): void {
    const titles: Partial<Record<ScreenId, string>> = {
      weapon_menu: 'INFERNAL ARMORY',
      mirror_menu: 'MIRROR OF ASH',
      shrine_menu: 'SHRINE OF VOWS',
      keepsake_menu: 'KEEPSAKE CABINET',
      shop_menu: 'FERRYMAN WARES',
      codex_menu: 'SANCTUM CODEX',
    };
    this.submenuTitleEl.textContent = titles[screen] ?? 'SANCTUM ARCHIVE';
    const weapon = WEAPON_CONSTANTS[state.player.weaponId].displayName;
    const aspect = ASPECT_DEFS[state.player.aspectId].displayName;
    this.submenuBodyEl.textContent = `Equipped: ${weapon} (${aspect}) · Darkness: ${state.meta.darkness} · Heat: ${state.run.heat} · Boons Discovered: ${state.meta.codexBoonsSeen.length}`;
    this.submenuCloseBtn.classList.add('kh-focused');
  }

  private handleResetSaveClick(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.resetSaveBtn.textContent = 'CONFIRM RESET SAVE?';
      return;
    }
    this.resetArmed = false;
    this.callbacks.onResetSave();
  }

  private applyFocus(): void {
    this.pauseButtons.forEach((b, idx) => {
      b.classList.toggle('kh-focused', this.activeMode === 'pause' && idx === this.focusedIndex);
    });
    this.optionRows.forEach((ctrl, idx) => {
      ctrl.rowEl.classList.toggle('kh-focused', this.activeMode === 'options' && idx === this.focusedIndex);
    });
    this.summaryButtons.forEach((b, idx) => {
      b.classList.toggle(
        'kh-focused',
        (this.activeMode === 'victory' || this.activeMode === 'death') && idx === this.focusedIndex
      );
    });
  }

  private makeBtn(label: string, primary: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = primary ? 'kh-btn kh-btn-primary' : 'kh-btn';
    btn.textContent = label;
    return btn;
  }

  private makeToggleBtn(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kh-seg-btn';
    btn.style.minWidth = '72px';
    return btn;
  }

  private setToggleBtnState(btn: HTMLButtonElement, on: boolean): void {
    btn.classList.toggle('kh-active', on);
    const label = on ? 'ON' : 'OFF';
    if (btn.textContent !== label) {
      btn.textContent = label;
    }
  }

  private createToggleRow(
    label: string,
    sub: string,
    btn: HTMLButtonElement,
    onToggle: () => void
  ): OptionRowControl {
    return this.createToggleRowWithSub(label, sub, btn, onToggle).control;
  }

  private createToggleRowWithSub(
    label: string,
    sub: string,
    btn: HTMLButtonElement,
    onToggle: () => void
  ): { control: OptionRowControl; subEl: HTMLSpanElement } {
    const row = document.createElement('div');
    row.className = 'kh-option-row';
    const labelWrap = document.createElement('div');
    labelWrap.className = 'kh-option-label-wrap';
    const lbl = document.createElement('span');
    lbl.className = 'kh-option-label';
    lbl.textContent = label;
    const subEl = document.createElement('span');
    subEl.className = 'kh-option-sub';
    subEl.textContent = sub;
    labelWrap.append(lbl, subEl);
    btn.addEventListener('click', onToggle);
    row.append(labelWrap, btn);

    return {
      subEl,
      control: {
        rowEl: row,
        adjust: () => onToggle(),
        activate: () => onToggle(),
      },
    };
  }

  private createSegmentedRow(
    label: string,
    sub: string,
    choices: string[],
    targetButtons: HTMLButtonElement[],
    onSelect: (index: number) => void,
    getIndex: () => number
  ): OptionRowControl {
    const row = document.createElement('div');
    row.className = 'kh-option-row';
    const labelWrap = document.createElement('div');
    labelWrap.className = 'kh-option-label-wrap';
    const lbl = document.createElement('span');
    lbl.className = 'kh-option-label';
    lbl.textContent = label;
    const subEl = document.createElement('span');
    subEl.className = 'kh-option-sub';
    subEl.textContent = sub;
    labelWrap.append(lbl, subEl);

    const group = document.createElement('div');
    group.className = 'kh-seg-group';
    choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kh-seg-btn';
      btn.textContent = choice;
      btn.addEventListener('click', () => onSelect(idx));
      targetButtons.push(btn);
      group.appendChild(btn);
    });

    row.append(labelWrap, group);

    return {
      rowEl: row,
      adjust: (delta) => {
        const next = (getIndex() + delta + choices.length) % choices.length;
        onSelect(next);
      },
      activate: () => {
        const next = (getIndex() + 1) % choices.length;
        onSelect(next);
      },
    };
  }

  private createSliderRow(
    label: string,
    settingKey: 'masterVolume' | 'musicVolume' | 'sfxVolume'
  ): { control: OptionRowControl; slider: HTMLInputElement; valEl: HTMLSpanElement } {
    const row = document.createElement('div');
    row.className = 'kh-option-row';
    const lbl = document.createElement('span');
    lbl.className = 'kh-option-label';
    lbl.textContent = label;

    const wrap = document.createElement('div');
    wrap.className = 'kh-slider-wrap';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '5';
    slider.className = 'kh-slider';
    slider.setAttribute('aria-label', label);

    const valEl = document.createElement('span');
    valEl.className = 'kh-slider-val';
    valEl.textContent = '80%';

    slider.addEventListener('input', () => {
      const pct = Math.max(0, Math.min(100, Number(slider.value) || 0));
      valEl.textContent = `${pct}%`;
      this.callbacks.onUpdateSettings({ [settingKey]: pct / 100 });
    });

    wrap.append(slider, valEl);
    row.append(lbl, wrap);

    const adjust = (delta: -1 | 1): void => {
      const cur = this.latestState?.meta.settings[settingKey] ?? 0.8;
      const next = Math.max(0, Math.min(1, Math.round((cur + delta * 0.05) * 20) / 20));
      this.callbacks.onUpdateSettings({ [settingKey]: next });
    };

    return {
      slider,
      valEl,
      control: {
        rowEl: row,
        adjust,
        activate: () => adjust(1),
      },
    };
  }
}
