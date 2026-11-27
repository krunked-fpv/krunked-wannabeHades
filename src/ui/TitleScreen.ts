import type { InputSource, MetaSaveState, RenderSettings } from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';

export interface TitleScreenCallbacks {
  onEnterCourtyard(): void;
  onStartRun(seed?: number): void;
  onOpenOptions(): void;
  onUpdateSettings(partial: Partial<RenderSettings>): void;
  onLoadCustomPackFolder?(): void;
}

const INPUT_SOURCE_LABELS: Record<InputSource, { badge: string; hint: string }> = {
  keyboard: {
    badge: 'INPUT: KEYBOARD & MOUSE',
    hint: '↑↓ Navigate · ENTER Select · F9 Debug Drawer',
  },
  gamepad: {
    badge: 'INPUT: XBOX CONTROLLER',
    hint: 'D-PAD / LS Navigate · A Select · START Pause',
  },
  touch: {
    badge: 'INPUT: TOUCH CONTROLS',
    hint: 'Tap any option to begin · Translucent controls activate in play',
  },
};

export class TitleScreen {
  private readonly root: HTMLDivElement;
  private readonly callbacks: TitleScreenCallbacks;
  private readonly buttons: HTMLButtonElement[];
  private readonly packModeTextEl: HTMLSpanElement;
  private readonly inputBadgeEl: HTMLDivElement;
  private readonly navHintEl: HTMLSpanElement;
  private readonly metaStatsEl: HTMLDivElement;

  private focusedIndex = 0;
  private visible = false;
  private currentPackMode: RenderSettings['packMode'] = 'BUILTIN';
  private lastMetaKey = '';
  private lastSource: InputSource | null = null;

  constructor(uiRoot: HTMLElement, callbacks: TitleScreenCallbacks) {
    this.callbacks = callbacks;

    this.root = document.createElement('div');
    this.root.className = 'kh-title-overlay kh-hidden';
    this.root.setAttribute('data-screen', 'title');

    const topMeander = document.createElement('div');
    topMeander.className = 'kh-meander-strip';

    const content = document.createElement('div');
    content.className = 'kh-title-content';

    const crest = document.createElement('div');
    crest.className = 'kh-title-crest';
    crest.textContent = '◆ UNDERWORLD ACTION ROGUELITE ◆';

    const heading = document.createElement('h1');
    heading.className = 'kh-title-heading';
    heading.textContent = 'KRUNKED WANNABEHADES';

    const sub = document.createElement('p');
    sub.className = 'kh-title-sub';
    sub.textContent = 'Escape the Sanctum of Ash';

    const menu = document.createElement('div');
    menu.className = 'kh-title-menu';

    const btnCourtyard = this.createMenuButton('ENTER COURTYARD', 'HUB', false);
    const btnStartRun = this.createMenuButton('BEGIN ESCAPE RUN', 'PLAY', true);
    const btnOptions = this.createMenuButton('OPTIONS', 'SETTINGS', false);

    const packRow = document.createElement('div');
    packRow.className = 'kh-title-pack-row';

    const btnPackMode = document.createElement('button');
    btnPackMode.type = 'button';
    btnPackMode.className = 'kh-btn';
    this.packModeTextEl = document.createElement('span');
    this.packModeTextEl.textContent = 'ART PACK: BUILT-IN';
    btnPackMode.appendChild(this.packModeTextEl);

    const btnLoadPack = document.createElement('button');
    btnLoadPack.type = 'button';
    btnLoadPack.className = 'kh-btn';
    btnLoadPack.textContent = 'LOAD CUSTOM PACK';

    packRow.append(btnPackMode, btnLoadPack);
    menu.append(btnCourtyard, btnStartRun, btnOptions, packRow);

    this.buttons = [btnCourtyard, btnStartRun, btnOptions, btnPackMode, btnLoadPack];

    btnCourtyard.addEventListener('click', () => this.callbacks.onEnterCourtyard());
    btnStartRun.addEventListener('click', () => this.callbacks.onStartRun());
    btnOptions.addEventListener('click', () => this.callbacks.onOpenOptions());
    btnPackMode.addEventListener('click', () => this.togglePackMode());
    btnLoadPack.addEventListener('click', () => this.callbacks.onLoadCustomPackFolder?.());

    this.buttons.forEach((btn, idx) => {
      btn.addEventListener('pointerenter', () => {
        this.focusedIndex = idx;
        this.applyFocusStyles();
      });
    });

    content.append(crest, heading, sub, menu);

    // Footer with live input mode badge + meta run counters
    const footer = document.createElement('div');
    footer.className = 'kh-title-footer';

    const leftFooter = document.createElement('div');
    leftFooter.style.display = 'flex';
    leftFooter.style.alignItems = 'center';
    leftFooter.style.gap = '12px';
    leftFooter.style.flexWrap = 'wrap';

    this.inputBadgeEl = document.createElement('div');
    this.inputBadgeEl.className = 'kh-input-badge';
    this.inputBadgeEl.setAttribute('data-input-badge', 'keyboard');

    this.navHintEl = document.createElement('span');
    this.navHintEl.style.fontSize = '11px';
    this.navHintEl.style.color = '#b8aea2';

    leftFooter.append(this.inputBadgeEl, this.navHintEl);

    this.metaStatsEl = document.createElement('div');
    this.metaStatsEl.className = 'kh-title-meta';

    footer.append(leftFooter, this.metaStatsEl);

    this.root.append(topMeander, content, footer);
    uiRoot.appendChild(this.root);

    this.focusedIndex = 1; // Default focus on BEGIN ESCAPE RUN
    this.applyFocusStyles();
  }

  public update(
    isVisible: boolean,
    meta: MetaSaveState,
    activeSource: InputSource,
    menuNav: MenuNavInput
  ): void {
    if (this.visible !== isVisible) {
      this.visible = isVisible;
      this.root.classList.toggle('kh-hidden', !isVisible);
      if (isVisible) {
        this.applyFocusStyles();
      }
    }
    if (!isVisible) {
      return;
    }

    // Update pack mode readout
    this.currentPackMode = meta.settings.packMode;
    const packLabel =
      this.currentPackMode === 'CUSTOM_PACK' ? 'ART PACK: CUSTOM' : 'ART PACK: BUILT-IN';
    if (this.packModeTextEl.textContent !== packLabel) {
      this.packModeTextEl.textContent = packLabel;
    }

    // Update live input mode badge
    if (this.lastSource !== activeSource) {
      this.lastSource = activeSource;
      const info = INPUT_SOURCE_LABELS[activeSource];
      this.inputBadgeEl.textContent = info.badge;
      this.inputBadgeEl.setAttribute('data-input-badge', activeSource);
      this.navHintEl.textContent = info.hint;
    }

    // Update meta run summary
    const metaKey = `${meta.totalRuns}:${meta.totalClears}:${meta.highestHeatCleared}:${meta.darkness}`;
    if (this.lastMetaKey !== metaKey) {
      this.lastMetaKey = metaKey;
      this.metaStatsEl.innerHTML = '';
      if (meta.totalRuns > 0 || meta.darkness > 0) {
        const items = [
          `RUNS: ${meta.totalRuns}`,
          `ESCAPES: ${meta.totalClears}`,
          `BEST HEAT: ${meta.highestHeatCleared}`,
          `DARKNESS: ${meta.darkness}`,
        ];
        for (const text of items) {
          const span = document.createElement('span');
          span.textContent = text;
          this.metaStatsEl.appendChild(span);
        }
      }
    }

    // Keyboard & Xbox D-Pad / A navigation
    if (menuNav.up) {
      this.focusedIndex = (this.focusedIndex - 1 + this.buttons.length) % this.buttons.length;
      this.applyFocusStyles();
    } else if (menuNav.down) {
      this.focusedIndex = (this.focusedIndex + 1) % this.buttons.length;
      this.applyFocusStyles();
    } else if (menuNav.left && this.focusedIndex === 4) {
      this.focusedIndex = 3;
      this.applyFocusStyles();
    } else if (menuNav.right && this.focusedIndex === 3) {
      this.focusedIndex = 4;
      this.applyFocusStyles();
    }

    if (menuNav.confirm) {
      this.activateFocused();
    }
  }

  public dispose(): void {
    this.root.remove();
  }

  private togglePackMode(): void {
    const next: RenderSettings['packMode'] =
      this.currentPackMode === 'BUILTIN' ? 'CUSTOM_PACK' : 'BUILTIN';
    this.callbacks.onUpdateSettings({ packMode: next });
  }

  private activateFocused(): void {
    switch (this.focusedIndex) {
      case 0:
        this.callbacks.onEnterCourtyard();
        break;
      case 1:
        this.callbacks.onStartRun();
        break;
      case 2:
        this.callbacks.onOpenOptions();
        break;
      case 3:
        this.togglePackMode();
        break;
      case 4:
        this.callbacks.onLoadCustomPackFolder?.();
        break;
      default:
        break;
    }
  }

  private applyFocusStyles(): void {
    this.buttons.forEach((btn, idx) => {
      btn.classList.toggle('kh-focused', idx === this.focusedIndex);
    });
  }

  private createMenuButton(label: string, tag: string, primary: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = primary ? 'kh-btn kh-btn-primary' : 'kh-btn';
    const left = document.createElement('span');
    left.textContent = label;
    const right = document.createElement('span');
    right.style.fontSize = '10px';
    right.style.opacity = '0.72';
    right.style.letterSpacing = '0.14em';
    right.textContent = tag;
    btn.append(left, right);
    return btn;
  }
}
