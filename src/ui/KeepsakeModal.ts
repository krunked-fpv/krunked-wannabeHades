import {
  KEEPSAKES,
  PATRON_CONSTANTS,
  type InputSource,
  type KeepsakeId,
  type SimState,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';

export interface KeepsakeModalCallbacks {
  onSelectKeepsake?(id: KeepsakeId | null): void;
  onCloseModal(): void;
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
  old_collar: '#e05858',
  lucky_fang: '#f0e2bd',
  bone_sandglass: '#b894ff',
  coin_pouch: '#f5c742',
  evergreen_acorn: '#63d471',
  shattered_shackle: '#a4aec4',
  pierced_plume: '#ff823d',
  obsidian_shawl: '#8872c8',
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
    shell.className = 'kh-meta-shell';

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
    sub.textContent = '16 Relics · Rank I–III · Equip One Relic Before Descending';
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

    // Scrollable 16-Keepsake 4x4 Grid
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
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    this.unequipBtn = document.createElement('button');
    this.unequipBtn.type = 'button';
    this.unequipBtn.className = 'kh-btn';
    this.unequipBtn.textContent = 'UNEQUIP';
    this.unequipBtn.addEventListener('click', () => this.callbacks.onSelectKeepsake?.(null));

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kh-btn kh-btn-primary';
    closeBtn.textContent = 'CLOSE CABINET';
    closeBtn.addEventListener('click', () => this.callbacks.onCloseModal());

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
    if (menuNav.left) {
      this.focusedIndex = (this.focusedIndex - 1 + total) % total;
      this.applyFocusStyles();
    } else if (menuNav.right) {
      this.focusedIndex = (this.focusedIndex + 1) % total;
      this.applyFocusStyles();
    } else if (menuNav.up) {
      this.focusedIndex = (this.focusedIndex - cols + total) % total;
      this.applyFocusStyles();
    } else if (menuNav.down) {
      this.focusedIndex = (this.focusedIndex + cols) % total;
      this.applyFocusStyles();
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
        : (NON_PATRON_ACCENTS[id] ?? '#f5cb70');

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'kh-keepsake-card';
      if (isEquipped) card.classList.add('kh-equipped');
      if (!unlocked) card.classList.add('kh-locked');
      card.dataset.keepsakeId = id;
      card.style.borderTop = `3px solid ${accent}`;

      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.alignItems = 'center';
      top.style.justifyContent = 'space-between';
      top.style.gap = '6px';

      const nameWrap = document.createElement('div');
      nameWrap.style.display = 'flex';
      nameWrap.style.alignItems = 'center';
      nameWrap.style.gap = '6px';
      nameWrap.style.minWidth = '0';

      const dot = document.createElement('span');
      dot.className = 'kh-boon-dot';
      dot.style.background = accent;

      const nameEl = document.createElement('span');
      nameEl.style.fontFamily = 'var(--kh-font-display)';
      nameEl.style.fontSize = '12px';
      nameEl.style.fontWeight = '700';
      nameEl.style.color = isEquipped ? '#fff6dc' : '#eae0d2';
      nameEl.textContent = def.displayName;

      nameWrap.append(dot, nameEl);

      const stars = document.createElement('span');
      stars.style.fontSize = '11px';
      stars.style.color = '#f5cb70';
      stars.style.letterSpacing = '1px';
      stars.style.flexShrink = '0';
      stars.textContent = unlocked ? renderRankStars(rank) : 'LOCKED';

      top.append(nameWrap, stars);

      const desc = document.createElement('div');
      desc.style.fontSize = '11px';
      desc.style.lineHeight = '1.35';
      desc.style.color = '#cfc5b8';
      desc.textContent = def.description;

      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.justifyContent = 'space-between';
      footer.style.alignItems = 'center';
      footer.style.fontSize = '10px';
      footer.style.fontWeight = '700';
      footer.style.letterSpacing = '0.07em';

      const tag = document.createElement('span');
      tag.style.color = accent;
      tag.textContent = def.forcedPatron
        ? `PATRON: ${PATRON_CONSTANTS[def.forcedPatron].displayName.toUpperCase()}`
        : 'RELIC';

      const status = document.createElement('span');
      status.style.color = isEquipped ? '#7cf5be' : unlocked ? '#b8aea2' : '#ff8c94';
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
        this.focusedIndex = idx;
        this.applyFocusStyles();
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
