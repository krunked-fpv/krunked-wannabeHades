import {
  SHRINE_VOWS,
  type InputSource,
  type ShrineVowId,
  type SimState,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';

export interface ShrineModalCallbacks {
  onSetShrineVow?(id: ShrineVowId, rank: number): void;
  onCloseModal(): void;
}

const SHRINE_ORDER: readonly ShrineVowId[] = [
  'hard_labor',
  'lasting_consequences',
  'convenience_fee',
  'jury_summons',
  'extreme_measures',
  'calisthenics_program',
  'benefits_package',
  'middle_management',
  'underworld_customs',
  'forced_overtime',
  'heightened_security',
  'routine_inspection',
  'damage_control',
  'approval_process',
  'tight_deadline',
  'personal_liability',
];

const DEADLINE_LABELS = ['9:00 / Biome', '7:00 / Biome', '5:00 / Biome'] as const;
const EM_LABELS = [
  'EM1: Warden Arena Upgrade',
  'EM2: Bone Leviathan Upgraded Arena',
  'EM3: Armored Colosseum Champions',
  'EM4: 3-Phase Sovereign Lord Finale!',
] as const;

function computeVowHeat(id: ShrineVowId, rank: number): number {
  const def = SHRINE_VOWS[id];
  const clamped = Math.max(0, Math.min(def.maxRank, Math.floor(rank)));
  let total = 0;
  for (let i = 0; i < clamped; i++) {
    total += def.heatPerRank[i] ?? 0;
  }
  return total;
}

function computeTotalHeat(vows: Partial<Record<ShrineVowId, number>>): number {
  let total = 0;
  for (const id of SHRINE_ORDER) {
    total += computeVowHeat(id, vows[id] ?? 0);
  }
  return total;
}

export class ShrineModal {
  private readonly backdrop: HTMLDivElement;
  private readonly callbacks: ShrineModalCallbacks;

  private readonly totalHeatBadge: HTMLDivElement;
  private readonly bestHeatBadge: HTMLDivElement;
  private readonly calloutsEl: HTMLDivElement;
  private readonly gridEl: HTMLDivElement;
  private readonly hintEl: HTMLSpanElement;

  private visible = false;
  private focusedIndex = 0;
  private rowEls: HTMLDivElement[] = [];
  private lastRenderKey = '';
  private latestState: SimState | null = null;

  constructor(uiRoot: HTMLElement, callbacks: ShrineModalCallbacks) {
    this.callbacks = callbacks;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'kh-modal-backdrop kh-hidden';
    this.backdrop.setAttribute('data-screen', 'shrine_menu');

    const shell = document.createElement('div');
    shell.className = 'kh-meta-shell';

    // Header
    const header = document.createElement('div');
    header.className = 'kh-meta-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'kh-meta-title-group';
    const title = document.createElement('h2');
    title.className = 'kh-meta-title';
    title.textContent = 'SHRINE OF TORMENT';
    const sub = document.createElement('div');
    sub.className = 'kh-meta-sub';
    sub.textContent = '16 Heat Vows · Raise Torment for Greater Bounties';
    titleGroup.append(title, sub);

    const badges = document.createElement('div');
    badges.className = 'kh-meta-badges';
    this.bestHeatBadge = document.createElement('div');
    this.bestHeatBadge.className = 'kh-meta-pill';
    this.totalHeatBadge = document.createElement('div');
    this.totalHeatBadge.className = 'kh-meta-pill kh-meta-pill-heat';
    badges.append(this.bestHeatBadge, this.totalHeatBadge);
    header.append(titleGroup, badges);

    const meander = document.createElement('div');
    meander.className = 'kh-meander-strip';

    // Active Callout Strip (Tight Deadline & Extreme Measures EM1-4)
    this.calloutsEl = document.createElement('div');
    this.calloutsEl.className = 'kh-shrine-callouts';

    // Scrollable 16-Vow Grid
    const scroll = document.createElement('div');
    scroll.className = 'kh-meta-scroll';
    this.gridEl = document.createElement('div');
    this.gridEl.className = 'kh-shrine-grid';
    scroll.appendChild(this.gridEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'kh-meta-footer';
    this.hintEl = document.createElement('span');
    this.hintEl.className = 'kh-meta-hint';

    const footerBtns = document.createElement('div');
    footerBtns.style.display = 'flex';
    footerBtns.style.gap = '8px';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'kh-btn';
    clearBtn.textContent = 'CLEAR ALL VOWS';
    clearBtn.addEventListener('click', () => {
      for (const id of SHRINE_ORDER) {
        if ((this.latestState?.meta.shrineVows[id] ?? 0) > 0) {
          this.callbacks.onSetShrineVow?.(id, 0);
        }
      }
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kh-btn kh-btn-primary';
    closeBtn.textContent = 'SEAL SHRINE';
    closeBtn.addEventListener('click', () => this.callbacks.onCloseModal());

    footerBtns.append(clearBtn, closeBtn);
    footer.append(this.hintEl, footerBtns);

    shell.append(header, meander, this.calloutsEl, scroll, footer);
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
        ? 'D-PAD ↑↓ Select Vow · ←→ Adjust Rank · A Increase · B Close'
        : activeSource === 'touch'
          ? 'Tap − / + on any Vow to set Shrine Heat'
          : '↑↓ Select Vow · ←→ Adjust Rank · ENTER Cycle · ESC Close';
    if (this.hintEl.textContent !== hint) {
      this.hintEl.textContent = hint;
    }

    if (menuNav.back || menuNav.pause) {
      this.callbacks.onCloseModal();
      return;
    }

    const len = SHRINE_ORDER.length;
    if (menuNav.up) {
      this.focusedIndex = (this.focusedIndex - 1 + len) % len;
      this.applyFocusStyles();
    } else if (menuNav.down) {
      this.focusedIndex = (this.focusedIndex + 1) % len;
      this.applyFocusStyles();
    }

    const vowId = SHRINE_ORDER[this.focusedIndex];
    const vowDef = SHRINE_VOWS[vowId];
    const curRank = Math.max(0, Math.floor(state.meta.shrineVows[vowId] ?? 0));
    if (menuNav.left) {
      this.callbacks.onSetShrineVow?.(vowId, Math.max(0, curRank - 1));
    } else if (menuNav.right) {
      this.callbacks.onSetShrineVow?.(vowId, Math.min(vowDef.maxRank, curRank + 1));
    } else if (menuNav.confirm) {
      const next = curRank >= vowDef.maxRank ? 0 : curRank + 1;
      this.callbacks.onSetShrineVow?.(vowId, next);
    }

    const key = `${state.meta.highestHeatCleared}:${SHRINE_ORDER.map(
      (id) => state.meta.shrineVows[id] ?? 0
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
    const vows = state.meta.shrineVows;
    const totalHeat = computeTotalHeat(vows);

    this.totalHeatBadge.textContent = `🔥 TOTAL HEAT: ${totalHeat}`;
    this.bestHeatBadge.textContent = `HIGHEST CLEARED: ${state.meta.highestHeatCleared}`;

    // Special callouts for Tight Deadline, Extreme Measures (EM1-4), and Routine Inspection
    this.calloutsEl.innerHTML = '';
    const deadlineRank = Math.max(0, Math.min(3, Math.floor(vows.tight_deadline ?? 0)));
    const emRank = Math.max(0, Math.min(4, Math.floor(vows.extreme_measures ?? 0)));
    const inspRank = Math.max(0, Math.min(4, Math.floor(vows.routine_inspection ?? 0)));

    const addCallout = (text: string, urgent: boolean) => {
      const chip = document.createElement('span');
      chip.className = urgent ? 'kh-meta-pill kh-meta-pill-crimson' : 'kh-meta-pill kh-meta-pill-heat';
      chip.style.fontSize = '11px';
      chip.style.padding = '4px 10px';
      chip.textContent = text;
      this.calloutsEl.appendChild(chip);
    };

    if (deadlineRank > 0) {
      addCallout(`⏱ TIGHT DEADLINE ${deadlineRank}: ${DEADLINE_LABELS[deadlineRank - 1]}`, true);
    }
    if (emRank > 0) {
      addCallout(`⚔ ${EM_LABELS[emRank - 1]}`, emRank === 4);
    }
    if (inspRank > 0) {
      addCallout(`⊘ ROUTINE INSPECTION: Bottom ${inspRank * 3} Mirror rows disabled`, false);
    }
    this.calloutsEl.classList.toggle('kh-hidden', this.calloutsEl.childElementCount === 0);

    // 16 Shrine Vow Rows
    this.gridEl.innerHTML = '';
    this.rowEls = [];

    SHRINE_ORDER.forEach((id, idx) => {
      const def = SHRINE_VOWS[id];
      const rank = Math.max(0, Math.min(def.maxRank, Math.floor(vows[id] ?? 0)));
      const heatAdded = computeVowHeat(id, rank);

      const row = document.createElement('div');
      row.className = rank > 0 ? 'kh-shrine-row kh-active-vow' : 'kh-shrine-row';
      row.dataset.vowId = id;

      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.gap = '2px';
      info.style.minWidth = '0';

      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.alignItems = 'center';
      top.style.gap = '6px';
      top.style.flexWrap = 'wrap';

      const nameEl = document.createElement('span');
      nameEl.style.fontFamily = 'var(--kh-font-display)';
      nameEl.style.fontSize = '12.5px';
      nameEl.style.fontWeight = '700';
      nameEl.style.color = rank > 0 ? '#ffd59c' : '#f4ece0';
      nameEl.textContent = def.displayName;

      const heatPill = document.createElement('span');
      heatPill.className = 'kh-boon-slot-tag';
      heatPill.style.color = rank > 0 ? '#ff9d66' : '#b8aea2';
      heatPill.textContent =
        rank > 0 ? `+${heatAdded} HEAT` : `+${def.heatPerRank.join('/')} HEAT`;

      top.append(nameEl, heatPill);

      const desc = document.createElement('div');
      desc.style.fontSize = '11px';
      desc.style.color = '#cfc5b8';
      desc.textContent = def.description;

      info.append(top, desc);

      // − / + Stepper (>= 48px touch targets)
      const stepper = document.createElement('div');
      stepper.className = 'kh-stepper';

      const decBtn = document.createElement('button');
      decBtn.type = 'button';
      decBtn.className = 'kh-step-btn';
      decBtn.textContent = '−';
      decBtn.disabled = rank <= 0;
      decBtn.setAttribute('aria-label', `Decrease ${def.displayName}`);
      decBtn.addEventListener('click', () => {
        this.focusedIndex = idx;
        this.callbacks.onSetShrineVow?.(id, Math.max(0, rank - 1));
      });

      const rankText = document.createElement('span');
      rankText.className = 'kh-step-rank';
      rankText.textContent = `${rank}/${def.maxRank}`;

      const incBtn = document.createElement('button');
      incBtn.type = 'button';
      incBtn.className = 'kh-step-btn';
      incBtn.textContent = '+';
      incBtn.disabled = rank >= def.maxRank;
      incBtn.setAttribute('aria-label', `Increase ${def.displayName}`);
      incBtn.addEventListener('click', () => {
        this.focusedIndex = idx;
        this.callbacks.onSetShrineVow?.(id, Math.min(def.maxRank, rank + 1));
      });

      stepper.append(decBtn, rankText, incBtn);
      row.append(info, stepper);
      row.addEventListener('pointerenter', () => {
        this.focusedIndex = idx;
        this.applyFocusStyles();
      });

      this.gridEl.appendChild(row);
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
