import {
  MIRROR_UPGRADES,
  type InputSource,
  type MirrorUpgradeId,
  type SimState,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';

export interface MirrorModalCallbacks {
  onUpgradeMirror?(id: MirrorUpgradeId): void;
  onToggleMirrorSide?(id: MirrorUpgradeId): void;
  onRefundMirror?(): void;
  onCloseModal(): void;
}

const MIRROR_ORDER: readonly MirrorUpgradeId[] = [
  'shadow_presence',
  'cinder_vitality',
  'death_defiance',
  'greater_reflex',
  'boiling_blood',
  'infernal_soul',
  'deep_pockets',
  'thick_skin',
  'privileged_status',
  'patron_favor',
  'divine_pride',
  'fated_authority',
];

function computeNextMirrorCost(id: MirrorUpgradeId, side: 'a' | 'b', rank: number): number {
  const def = side === 'a' ? MIRROR_UPGRADES[id].sideA : MIRROR_UPGRADES[id].sideB;
  if (rank >= def.maxRank) return 0;
  return def.baseCost + def.costStep * Math.max(0, rank);
}

function isRowDisabledByInspection(row: number, state: SimState): boolean {
  const rank = Math.max(
    0,
    Math.min(4, Math.floor(state.meta.shrineVows.routine_inspection ?? state.run.vows.routine_inspection ?? 0))
  );
  if (rank <= 0) return false;
  return row >= 13 - rank * 3;
}

function formatMirrorBonus(id: MirrorUpgradeId, side: 'a' | 'b', rank: number): string {
  const def = side === 'a' ? MIRROR_UPGRADES[id].sideA : MIRROR_UPGRADES[id].sideB;
  const val = rank * def.valuePerRank;
  if (def.valuePerRank < 1) {
    const pct = Math.round(val * 1000) / 10;
    return `+${pct}%`;
  }
  return `+${Math.round(val)}`;
}

export class MirrorModal {
  private readonly backdrop: HTMLDivElement;
  private readonly callbacks: MirrorModalCallbacks;

  private readonly darknessBadge: HTMLDivElement;
  private readonly inspectionBadge: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly hintEl: HTMLSpanElement;
  private readonly refundBtn: HTMLButtonElement;

  private visible = false;
  private focusedIndex = 0;
  private rowEls: HTMLDivElement[] = [];
  private lastRenderKey = '';
  private latestState: SimState | null = null;

  constructor(uiRoot: HTMLElement, callbacks: MirrorModalCallbacks) {
    this.callbacks = callbacks;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'kh-modal-backdrop kh-hidden';
    this.backdrop.setAttribute('data-screen', 'mirror_menu');

    const shell = document.createElement('div');
    shell.className = 'kh-meta-shell';

    // Header
    const header = document.createElement('div');
    header.className = 'kh-meta-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'kh-meta-title-group';
    const title = document.createElement('h2');
    title.className = 'kh-meta-title';
    title.textContent = 'MIRROR OF DUSK';
    const sub = document.createElement('div');
    sub.className = 'kh-meta-sub';
    sub.textContent = '12 Nightly Pairs · Toggle Purple Side A ⇄ Gold Side B';
    titleGroup.append(title, sub);

    const badges = document.createElement('div');
    badges.className = 'kh-meta-badges';
    this.inspectionBadge = document.createElement('div');
    this.inspectionBadge.className = 'kh-meta-pill kh-meta-pill-crimson kh-hidden';
    this.darknessBadge = document.createElement('div');
    this.darknessBadge.className = 'kh-meta-pill kh-meta-pill-purple';
    badges.append(this.inspectionBadge, this.darknessBadge);
    header.append(titleGroup, badges);

    const meander = document.createElement('div');
    meander.className = 'kh-meander-strip';

    // Scrollable 12-pair list
    const scroll = document.createElement('div');
    scroll.className = 'kh-meta-scroll';
    this.listEl = document.createElement('div');
    this.listEl.className = 'kh-mirror-list';
    scroll.appendChild(this.listEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'kh-meta-footer';
    this.hintEl = document.createElement('span');
    this.hintEl.className = 'kh-meta-hint';

    const footerActions = document.createElement('div');
    footerActions.style.display = 'flex';
    footerActions.style.gap = '8px';

    this.refundBtn = document.createElement('button');
    this.refundBtn.type = 'button';
    this.refundBtn.className = 'kh-btn';
    this.refundBtn.textContent = 'REFUND ALL DARKNESS';
    this.refundBtn.addEventListener('click', () => this.handleRefund());

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kh-btn kh-btn-primary';
    closeBtn.textContent = 'CLOSE MIRROR';
    closeBtn.addEventListener('click', () => this.callbacks.onCloseModal());

    footerActions.append(this.refundBtn, closeBtn);
    footer.append(this.hintEl, footerActions);

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
    this.latestState = state;
    if (this.visible !== isVisible) {
      this.visible = isVisible;
      this.backdrop.classList.toggle('kh-hidden', !isVisible);
      if (isVisible) {
        this.focusedIndex = 0;
        this.lastRenderKey = '';
      }
    }
    if (!isVisible) {
      return;
    }

    const hint =
      activeSource === 'gamepad'
        ? 'D-PAD ↑↓ Select Row · ←→ Toggle Side A/B · A Upgrade · B Close'
        : activeSource === 'touch'
          ? 'Tap SIDE A/B to flip · Tap Upgrade to spend Darkness'
          : '↑↓ Select Row · ←→ Toggle Side A/B · ENTER Upgrade · ESC Close';
    if (this.hintEl.textContent !== hint) {
      this.hintEl.textContent = hint;
    }

    if (menuNav.back || menuNav.pause) {
      this.callbacks.onCloseModal();
      return;
    }

    const len = MIRROR_ORDER.length;
    if (menuNav.up) {
      this.focusedIndex = (this.focusedIndex - 1 + len) % len;
      this.applyFocusStyles();
    } else if (menuNav.down) {
      this.focusedIndex = (this.focusedIndex + 1) % len;
      this.applyFocusStyles();
    }

    const focusedId = MIRROR_ORDER[this.focusedIndex];
    if (menuNav.left || menuNav.right) {
      this.callbacks.onToggleMirrorSide?.(focusedId);
    } else if (menuNav.confirm) {
      this.callbacks.onUpgradeMirror?.(focusedId);
    }

    const key = `${state.meta.darkness}:${state.meta.shrineVows.routine_inspection ?? 0}:${MIRROR_ORDER.map(
      (id) => `${state.meta.mirrorActiveSide[id] ?? 'a'}${state.meta.mirrorRanks[id] ?? 0}`
    ).join('|')}`;
    if (key !== this.lastRenderKey) {
      this.lastRenderKey = key;
      this.renderRows(state);
    }
  }

  public dispose(): void {
    this.backdrop.remove();
  }

  private handleRefund(): void {
    if (this.callbacks.onRefundMirror) {
      this.callbacks.onRefundMirror();
      return;
    }
    const state = this.latestState;
    if (!state) return;
    let refunded = 0;
    for (const id of MIRROR_ORDER) {
      const side = state.meta.mirrorActiveSide[id] ?? 'a';
      const rank = Math.max(0, Math.floor(state.meta.mirrorRanks[id] ?? 0));
      for (let r = 0; r < rank; r++) {
        refunded += computeNextMirrorCost(id, side, r);
      }
      state.meta.mirrorRanks[id] = 0;
    }
    state.meta.darkness += refunded;
    this.lastRenderKey = '';
  }

  private renderRows(state: SimState): void {
    this.darknessBadge.textContent = `DARKNESS: ${Math.floor(state.meta.darkness)}`;

    const inspRank = Math.max(0, Math.floor(state.meta.shrineVows.routine_inspection ?? 0));
    this.inspectionBadge.classList.toggle('kh-hidden', inspRank <= 0);
    if (inspRank > 0) {
      this.inspectionBadge.textContent = `ROUTINE INSPECTION: BOTTOM ${inspRank * 3} ROWS SEALED`;
    }

    this.listEl.innerHTML = '';
    this.rowEls = [];

    MIRROR_ORDER.forEach((id, idx) => {
      const pair = MIRROR_UPGRADES[id];
      const side: 'a' | 'b' = state.meta.mirrorActiveSide[id] ?? 'a';
      const activeDef = side === 'a' ? pair.sideA : pair.sideB;
      const altDef = side === 'a' ? pair.sideB : pair.sideA;
      const rank = Math.max(0, Math.min(activeDef.maxRank, Math.floor(state.meta.mirrorRanks[id] ?? 0)));
      const cost = computeNextMirrorCost(id, side, rank);
      const isMax = rank >= activeDef.maxRank;
      const disabledRow = isRowDisabledByInspection(pair.row, state);

      const row = document.createElement('div');
      row.className = disabledRow ? 'kh-mirror-row kh-disabled-row' : 'kh-mirror-row';
      row.dataset.side = side;
      row.dataset.mirrorId = id;

      // Side A <-> Side B toggle button
      const sideBtn = document.createElement('button');
      sideBtn.type = 'button';
      sideBtn.className = 'kh-mirror-side-btn';
      sideBtn.dataset.side = side;
      sideBtn.textContent = side === 'a' ? 'SIDE A ⇄' : 'SIDE B ⇄';
      sideBtn.title = `Switch to ${altDef.name}`;
      sideBtn.addEventListener('click', () => {
        this.focusedIndex = idx;
        this.callbacks.onToggleMirrorSide?.(id);
      });

      // Center details
      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.gap = '2px';
      info.style.minWidth = '0';

      const titleLine = document.createElement('div');
      titleLine.style.display = 'flex';
      titleLine.style.alignItems = 'center';
      titleLine.style.gap = '8px';
      titleLine.style.flexWrap = 'wrap';

      const nameEl = document.createElement('span');
      nameEl.style.fontFamily = 'var(--kh-font-display)';
      nameEl.style.fontSize = '13.5px';
      nameEl.style.fontWeight = '700';
      nameEl.style.color = side === 'a' ? '#e5c6ff' : '#ffe8a8';
      nameEl.textContent = `${pair.row}. ${activeDef.name}`;

      const rankPill = document.createElement('span');
      rankPill.className = 'kh-boon-slot-tag';
      rankPill.style.color = '#7cf5be';
      rankPill.textContent = `RANK ${rank}/${activeDef.maxRank} (${formatMirrorBonus(id, side, rank)})`;

      titleLine.append(nameEl, rankPill);

      if (disabledRow) {
        const seal = document.createElement('span');
        seal.className = 'kh-boon-slot-tag';
        seal.style.color = '#ff808a';
        seal.textContent = 'SEALED BY VOW';
        titleLine.appendChild(seal);
      }

      const desc = document.createElement('div');
      desc.style.fontSize = '11.5px';
      desc.style.color = '#d8cec2';
      desc.textContent = `${activeDef.description} (Alt: ${altDef.name})`;

      info.append(titleLine, desc);

      // Upgrade button
      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = isMax ? 'kh-btn' : 'kh-btn kh-btn-primary';
      upBtn.style.minWidth = '134px';
      upBtn.style.fontSize = '11px';
      upBtn.style.padding = '6px 12px';
      upBtn.disabled = isMax || state.meta.darkness < cost;
      upBtn.textContent = isMax ? 'MAX RANK' : `+1 (${cost} DARK)`;
      upBtn.addEventListener('click', () => {
        this.focusedIndex = idx;
        this.callbacks.onUpgradeMirror?.(id);
      });

      row.append(sideBtn, info, upBtn);
      row.addEventListener('pointerenter', () => {
        this.focusedIndex = idx;
        this.applyFocusStyles();
      });

      this.listEl.appendChild(row);
      this.rowEls.push(row);
    });

    this.applyFocusStyles();
  }

  private applyFocusStyles(): void {
    this.rowEls.forEach((row, idx) => {
      const focused = idx === this.focusedIndex;
      row.classList.toggle('kh-focused', focused);
      if (focused && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ block: 'nearest' });
      }
    });
  }
}
