import {
  KEEPSAKES,
  PATRON_CONSTANTS,
  type InputSource,
  type KeepsakeId,
  type SimState,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';
import { attachCornerFiligrees, svgPatronSigil, svgRelicGem } from './svgArt.js';

export interface KeepsakeModalCallbacks {
  onSelectKeepsake?(id: KeepsakeId | null): void;
  onCloseModal(): void;
  readonly onUiHover?: () => void;
}

const KEEPSAKE_ORDER: readonly KeepsakeId[] = [
  'old_collar',
  'lucky_fang',
  'bone_sandglass',
  'coin_pouch',
  'evergreen_acorn',
  'shattered_shackle',
  'pierced_plume',
  'obsidian_shawl',
  'thunder_signet',
  'conch_shell',
  'owl_pendant',
  'eternal_rose',
  'adamant_arrowhead',
  'blood_vial',
  'overflowing_chalice',
  'frostbitten_horn',
];

const NON_PATRON_ACCENTS: Partial<Record<KeepsakeId, string>> = {
  old_collar: '#f02e46',
  lucky_fang: '#f0e2bd',
  bone_sandglass: '#b25cff',
  coin_pouch: '#e5b952',
  evergreen_acorn: '#44e68c',
  shattered_shackle: '#a4b2c8',
  pierced_plume: '#ff823d',
  obsidian_shawl: '#8f74d4',
};

function renderRankStars(rank: number): string {
  const clamped = Math.max(1, Math.min(3, Math.floor(rank)));
  return '★'.repeat(clamped) + '☆'.repeat(3 - clamped);
}

export class KeepsakeModal {
  private readonly backdrop: HTMLDivElement;
  private readonly callbacks: KeepsakeModalCallbacks;

  private readonly equippedBadge: HTMLDivElement;
  private readonly unlockedBadge: HTMLDivElement;
  private readonly gridEl: HTMLDivElement;
  private readonly hintEl: HTMLSpanElement;
  private readonly unequipBtn: HTMLButtonElement;

  private visible = false;
  private focusedIndex = 0;
  private cardButtons: HTMLButtonElement[] = [];
  private lastRenderKey = '';

  constructor(uiRoot: HTMLElement, callbacks: KeepsakeModalCallbacks) {
    this.callbacks = callbacks;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'kh-modal-backdrop kh-hidden';
    this.backdrop.setAttribute('data-screen', 'keepsake_menu');

    const shell = document.createElement('div');
    shell.className = 'kh-meta-shell kh-ornate-frame kh-theme-keepsake';
    attachCornerFiligrees(shell);

    // Header
    const header = document.createElement('div');
    header.className = 'kh-meta-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'kh-meta-title-group';
    const title = document.createElement('h2');
    title.className = 'kh-meta-title';
    title.textContent = 'KEEPSAKE CABINET';
    const sub = document.createElement('div');
    sub.className = 'kh-meta-sub';
    sub.textContent = 'Sixteen Sanctum Relics · Rank I–III · Equip One Before Descending';
    titleGroup.append(title, sub);

    const badges = document.createElement('div');
    badges.className = 'kh-meta-badges';
    this.unlockedBadge = document.createElement('div');
    this.unlockedBadge.className = 'kh-meta-pill';
    this.equippedBadge = document.createElement('div');
    this.equippedBadge.className = 'kh-meta-pill kh-meta-pill-heat';
    badges.append(this.unlockedBadge, this.equippedBadge);
    header.append(titleGroup, badges);

    const meander = document.createElement('div');
    meander.className = 'kh-meander-strip';

    // Scrollable 16-Keepsake 4x4 Velvet-Crimson & Gold Grid
    const scroll = document.createElement('div');
    scroll.className = 'kh-meta-scroll';
    this.gridEl = document.createElement('div');
    this.gridEl.className = 'kh-keepsake-grid';
    scroll.appendChild(this.gridEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'kh-meta-footer';
    this.hintEl = document.createElement('span');
    this.hintEl.className = 'kh-meta-hint';

    const actions = document.createElement('div');
    actions.className = 'kh-footer-btn-group';

    this.unequipBtn = document.createElement('button');
    this.unequipBtn.type = 'button';
    this.unequipBtn.className = 'kh-btn kh-btn-notched';
    this.unequipBtn.textContent = 'UNEQUIP';
    this.unequipBtn.addEventListener('click', () => this.callbacks.onSelectKeepsake?.(null));
    this.unequipBtn.addEventListener('pointerenter', () => {
      if (!this.unequipBtn.disabled) this.callbacks.onUiHover?.();
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kh-btn kh-btn-primary kh-btn-notched';
    closeBtn.textContent = 'CLOSE CABINET';
    closeBtn.addEventListener('click', () => this.callbacks.onCloseModal());
    closeBtn.addEventListener('pointerenter', () => this.callbacks.onUiHover?.());

    actions.append(this.unequipBtn, closeBtn);
    footer.append(this.hintEl, actions);

    shell.append(header, meander, scroll, footer);
    this.backdrop.appendChild(shell);
    uiRoot.appendChild(this.backdrop);
  }

  public update(
    isVisible: boolean,
    state: SimState,
    activeSource: InputSource,
    menuNav: MenuNavInput
  ): void {
    if (this.visible !== isVisible) {
      this.visible = isVisible;
      this.backdrop.classList.toggle('kh-hidden', !isVisible);
      if (isVisible) {
        const idx = state.meta.selectedKeepsake
          ? KEEPSAKE_ORDER.indexOf(state.meta.selectedKeepsake)
          : 0;
        this.focusedIndex = idx >= 0 ? idx : 0;
        this.lastRenderKey = '';
      }
    }
    if (!isVisible) {
      return;
    }

    const hint =
      activeSource === 'gamepad'
        ? 'D-PAD / LS Browse 4×4 Grid · A Equip · B Close'
        : activeSource === 'touch'
          ? 'Tap any unlocked Keepsake to equip immediately'
          : '↑↓←→ Browse Grid · ENTER Equip · ESC Close';
    if (this.hintEl.textContent !== hint) {
      this.hintEl.textContent = hint;
    }

    if (menuNav.back || menuNav.pause) {
      this.callbacks.onCloseModal();
      return;
    }

    const cols = 4;
    const total = KEEPSAKE_ORDER.length;
    const prevIdx = this.focusedIndex;
    if (menuNav.left) {
      this.focusedIndex = (this.focusedIndex - 1 + total) % total;
    } else if (menuNav.right) {
      this.focusedIndex = (this.focusedIndex + 1) % total;
    } else if (menuNav.up) {
      this.focusedIndex = (this.focusedIndex - cols + total) % total;
    } else if (menuNav.down) {
      this.focusedIndex = (this.focusedIndex + cols) % total;
    }
    if (this.focusedIndex !== prevIdx) {
      this.applyFocusStyles();
      this.callbacks.onUiHover?.();
    }

    if (menuNav.confirm) {
      const targetId = KEEPSAKE_ORDER[this.focusedIndex];
      if (state.meta.unlockedKeepsakes.includes(targetId)) {
        this.callbacks.onSelectKeepsake?.(targetId);
      }
    }

    const key = `${state.meta.selectedKeepsake ?? 'none'}:${state.meta.unlockedKeepsakes.join(',')}:${KEEPSAKE_ORDER.map(
      (id) => state.meta.keepsakeRanks[id] ?? 1
    ).join(',')}`;
    if (key !== this.lastRenderKey) {
      this.lastRenderKey = key;
      this.renderGrid(state);
    }
  }

  public dispose(): void {
    this.backdrop.remove();
  }

  private renderGrid(state: SimState): void {
    const equipped = state.meta.selectedKeepsake;
    const unlockedSet = new Set(state.meta.unlockedKeepsakes);

    this.unlockedBadge.textContent = `UNLOCKED: ${unlockedSet.size} / ${KEEPSAKE_ORDER.length}`;
    this.equippedBadge.textContent = equipped
      ? `EQUIPPED: ${KEEPSAKES[equipped].displayName}`
      : 'EQUIPPED: NONE';
    this.unequipBtn.disabled = equipped === null;

    this.gridEl.innerHTML = '';
    this.cardButtons = [];

    KEEPSAKE_ORDER.forEach((id, idx) => {
      const def = KEEPSAKES[id];
      const unlocked = unlockedSet.has(id);
      const isEquipped = equipped === id;
      const rank = Math.max(1, Math.min(3, Math.floor(state.meta.keepsakeRanks[id] ?? 1)));
      const accent = def.forcedPatron
        ? PATRON_CONSTANTS[def.forcedPatron].colorHex
        : (NON_PATRON_ACCENTS[id] ?? '#e5b952');

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'kh-keepsake-card';
      if (isEquipped) card.classList.add('kh-equipped');
      if (!unlocked) card.classList.add('kh-locked');
      card.dataset.keepsakeId = id;
      card.style.setProperty('--kh-relic-accent', accent);

      const top = document.createElement('div');
      top.className = 'kh-keepsake-top';

      const nameWrap = document.createElement('div');
      nameWrap.className = 'kh-keepsake-name-wrap';

      const gem = document.createElement('span');
      gem.className = 'kh-keepsake-gem';
      gem.style.color = unlocked ? accent : '#6e6258';
      gem.innerHTML = def.forcedPatron
        ? svgPatronSigil(def.forcedPatron, 22)
        : svgRelicGem(accent, unlocked);

      const nameEl = document.createElement('span');
      nameEl.className = 'kh-keepsake-name';
      nameEl.textContent = def.displayName;

      nameWrap.append(gem, nameEl);

      const stars = document.createElement('span');
      stars.className = 'kh-keepsake-stars';
      stars.textContent = unlocked ? renderRankStars(rank) : 'LOCKED';

      top.append(nameWrap, stars);

      const desc = document.createElement('div');
      desc.className = 'kh-keepsake-desc';
      desc.textContent = def.description;

      const footer = document.createElement('div');
      footer.className = 'kh-keepsake-card-footer';

      const tag = document.createElement('span');
      tag.style.color = accent;
      tag.textContent = def.forcedPatron
        ? `PATRON: ${PATRON_CONSTANTS[def.forcedPatron].displayName.toUpperCase()}`
        : 'RELIC';

      const status = document.createElement('span');
      status.className = 'kh-keepsake-status';
      status.style.color = isEquipped ? '#66f2b4' : unlocked ? '#cbbca0' : '#ff7b8a';
      status.textContent = isEquipped ? '✓ EQUIPPED' : unlocked ? `RANK ${rank}` : 'NECTAR';

      footer.append(tag, status);
      card.append(top, desc, footer);

      card.addEventListener('click', () => {
        this.focusedIndex = idx;
        if (unlocked) {
          this.callbacks.onSelectKeepsake?.(id);
        }
      });
      card.addEventListener('pointerenter', () => {
        if (this.focusedIndex !== idx) {
          this.focusedIndex = idx;
          this.applyFocusStyles();
          this.callbacks.onUiHover?.();
        }
      });

      this.gridEl.appendChild(card);
      this.cardButtons.push(card);
    });

    this.applyFocusStyles();
  }

  private applyFocusStyles(): void {
    this.cardButtons.forEach((btn, idx) => {
      const focused = idx === this.focusedIndex;
      btn.classList.toggle('kh-focused', focused);
      if (focused && typeof btn.scrollIntoView === 'function') {
        btn.scrollIntoView({ block: 'nearest' });
      }
    });
  }
}
