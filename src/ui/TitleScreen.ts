import type { InputSource, MetaSaveState, RenderSettings } from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';
import { getPaintedTitleKeyArtUrl } from '../assets/PaintedArtLoader.js';
import { svgDividerFinial, svgTitleCrest } from './svgArt.js';

export interface TitleScreenCallbacks {
  onEnterCourtyard(): void;
  onStartRun(seed?: number): void;
  onOpenOptions(): void;
  onUpdateSettings(partial: Partial<RenderSettings>): void;
  onLoadCustomPackFolder?(): void;
  readonly onUiHover?: () => void;
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

    // Full-bleed hand-painted mythic comic-ink Key Art backdrop with subtle living vignette
    const keyArtLayer = document.createElement('div');
    keyArtLayer.className = 'kh-title-keyart';
    keyArtLayer.setAttribute('aria-hidden', 'true');
    const keyArtImg = document.createElement('img');
    keyArtImg.className = 'kh-title-keyart-img';
    keyArtImg.alt = '';
    keyArtImg.decoding = 'async';
    keyArtImg.src = getPaintedTitleKeyArtUrl();
    keyArtImg.addEventListener('error', () => {
      keyArtLayer.classList.add('kh-hidden');
    });
    keyArtLayer.appendChild(keyArtImg);

    const keyArtScrim = document.createElement('div');
    keyArtScrim.className = 'kh-title-scrim';
    keyArtScrim.setAttribute('aria-hidden', 'true');

    const topMeander = document.createElement('div');
    topMeander.className = 'kh-meander-strip';

    const content = document.createElement('div');
    content.className = 'kh-title-content';

    // Editorial Left Pillar framing the wordmark & menu while the live Courtyard breathes on the right
    const pillar = document.createElement('div');
    pillar.className = 'kh-title-pillar';

    const crestArt = document.createElement('div');
    crestArt.className = 'kh-title-crest-art';
    crestArt.innerHTML = svgTitleCrest();

    const eyebrowRule = document.createElement('div');
    eyebrowRule.className = 'kh-title-eyebrow-rule';
    const ruleLeft = document.createElement('span');
    ruleLeft.className = 'kh-title-rule-line';
    const crest = document.createElement('div');
    crest.className = 'kh-title-crest';
    crest.textContent = 'UNDERWORLD ACTION ROGUELITE';
    const ruleRight = document.createElement('span');
    ruleRight.className = 'kh-title-rule-line';
    eyebrowRule.append(ruleLeft, crest, ruleRight);

    const heading = document.createElement('h1');
    heading.className = 'kh-title-heading';
    const topWord = document.createElement('span');
    topWord.className = 'kh-title-word-top';
    topWord.textContent = 'KRUNKED ';
    const mainWord = document.createElement('span');
    mainWord.className = 'kh-title-word-main';
    mainWord.textContent = 'WANNABEHADES';
    heading.append(topWord, mainWord);

    const taglineWrap = document.createElement('div');
    taglineWrap.className = 'kh-title-tagline-wrap';
    const sub = document.createElement('p');
    sub.className = 'kh-title-sub';
    sub.textContent = 'Escape the Sanctum of Ash';
    const divider = document.createElement('div');
    divider.className = 'kh-title-divider';
    divider.innerHTML = `<span class="kh-title-rule-line"></span>${svgDividerFinial()}<span class="kh-title-rule-line"></span>`;
    taglineWrap.append(sub, divider);

    const menu = document.createElement('div');
    menu.className = 'kh-title-menu';

    const btnCourtyard = this.createMenuButton('ENTER COURTYARD', 'HUB', false);
    const btnStartRun = this.createMenuButton('BEGIN ESCAPE RUN', 'PLAY', true);
    const btnOptions = this.createMenuButton('OPTIONS', 'SETTINGS', false);

    const packRow = document.createElement('div');
    packRow.className = 'kh-title-pack-row';

    const btnPackMode = document.createElement('button');
    btnPackMode.type = 'button';
    btnPackMode.className = 'kh-btn kh-btn-notched';
    this.packModeTextEl = document.createElement('span');
    this.packModeTextEl.textContent = 'ART PACK: BUILT-IN';
    btnPackMode.appendChild(this.packModeTextEl);

    const btnLoadPack = document.createElement('button');
    btnLoadPack.type = 'button';
    btnLoadPack.className = 'kh-btn kh-btn-notched';
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
        if (this.focusedIndex !== idx) {
          this.focusedIndex = idx;
          this.applyFocusStyles();
          this.callbacks.onUiHover?.();
        }
      });
      btn.addEventListener('focus', () => {
        if (this.focusedIndex !== idx) {
          this.focusedIndex = idx;
          this.applyFocusStyles();
          this.callbacks.onUiHover?.();
        }
      });
    });

    pillar.append(crestArt, eyebrowRule, heading, taglineWrap, menu);
    content.appendChild(pillar);

    // Footer with live input mode badge + meta run counters
    const footer = document.createElement('div');
    footer.className = 'kh-title-footer';

    const leftFooter = document.createElement('div');
    leftFooter.className = 'kh-title-footer-left';

    this.inputBadgeEl = document.createElement('div');
    this.inputBadgeEl.className = 'kh-input-badge';
    this.inputBadgeEl.setAttribute('data-input-badge', 'keyboard');

    this.navHintEl = document.createElement('span');
    this.navHintEl.className = 'kh-title-nav-hint';

    leftFooter.append(this.inputBadgeEl, this.navHintEl);

    this.metaStatsEl = document.createElement('div');
    this.metaStatsEl.className = 'kh-title-meta';

    footer.append(leftFooter, this.metaStatsEl);

    this.root.append(keyArtLayer, keyArtScrim, topMeander, content, footer);
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
        const items: readonly [string, number][] = [
          ['RUNS', meta.totalRuns],
          ['ESCAPES', meta.totalClears],
          ['BEST HEAT', meta.highestHeatCleared],
          ['DARKNESS', Math.floor(meta.darkness)],
        ];
        for (const [label, val] of items) {
          const item = document.createElement('span');
          item.className = 'kh-title-meta-item';
          const lbl = document.createElement('span');
          lbl.className = 'kh-title-meta-label';
          lbl.textContent = label;
          const num = document.createElement('span');
          num.className = 'kh-title-meta-num';
          num.textContent = String(val);
          item.append(lbl, num);
          this.metaStatsEl.appendChild(item);
        }
      } else {
        const badge = document.createElement('span');
        badge.className = 'kh-title-meta-item';
        const lbl = document.createElement('span');
        lbl.className = 'kh-title-meta-label';
        lbl.textContent = 'SANCTUM';
        const num = document.createElement('span');
        num.className = 'kh-title-meta-num';
        num.textContent = '60HZ · 5 BIOMES';
        badge.append(lbl, num);
        this.metaStatsEl.appendChild(badge);
      }
    }

    // Keyboard & Xbox D-Pad / A navigation
    const prevIdx = this.focusedIndex;
    if (menuNav.up) {
      this.focusedIndex = (this.focusedIndex - 1 + this.buttons.length) % this.buttons.length;
    } else if (menuNav.down) {
      this.focusedIndex = (this.focusedIndex + 1) % this.buttons.length;
    } else if (menuNav.left && this.focusedIndex === 4) {
      this.focusedIndex = 3;
    } else if (menuNav.right && this.focusedIndex === 3) {
      this.focusedIndex = 4;
    }
    if (this.focusedIndex !== prevIdx) {
      this.applyFocusStyles();
      this.callbacks.onUiHover?.();
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
    btn.className = primary ? 'kh-btn kh-btn-primary kh-btn-notched' : 'kh-btn kh-btn-notched';

    const leftWrap = document.createElement('span');
    leftWrap.className = 'kh-title-btn-left';
    const diamond = document.createElement('span');
    diamond.className = 'kh-title-btn-diamond';
    diamond.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = label;
    leftWrap.append(diamond, text);

    const right = document.createElement('span');
    right.className = 'kh-title-btn-tag';
    right.textContent = tag;

    btn.append(leftWrap, right);
    return btn;
  }
}
