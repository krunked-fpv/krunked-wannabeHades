import {
  ASPECT_DEFS,
  WEAPON_CONSTANTS,
  type AspectId,
  type InputSource,
  type SimState,
  type WeaponId,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';

export interface WeaponRackCallbacks {
  onSelectWeapon?(weaponId: WeaponId, aspectId: AspectId): void;
  onUpgradeAspect?(aspectId: AspectId): void;
  onCloseModal(): void;
}

const WEAPON_LIST: readonly WeaponId[] = [
  'stygian_blade',
  'eternal_spear',
  'shield_of_chaos',
  'heart_seeking_bow',
  'twin_fists',
  'adamant_rail',
];

export function getAspectUpgradeCost(currentRank: number, isHidden: boolean): number {
  const rank = Math.max(1, Math.floor(currentRank));
  if (rank >= 5) return 0;
  if (isHidden) {
    return [3, 3, 3, 3][rank - 1] ?? 3;
  }
  return [1, 1, 2, 3][rank - 1] ?? 2;
}

export class WeaponRackModal {
  private readonly backdrop: HTMLDivElement;
  private readonly callbacks: WeaponRackCallbacks;

  private readonly titanBloodBadge: HTMLDivElement;
  private readonly equippedBadge: HTMLDivElement;
  private readonly tabStrip: HTMLDivElement;
  private readonly weaponSummaryEl: HTMLDivElement;
  private readonly aspectGrid: HTMLDivElement;
  private readonly hintEl: HTMLSpanElement;

  private visible = false;
  private selectedWeaponIndex = 0;
  private focusedAspectIndex = 0;
  private lastRenderKey = '';

  private tabButtons: HTMLButtonElement[] = [];
  private aspectCards: HTMLDivElement[] = [];
  private currentAspects: readonly AspectId[] = [];
  private latestState: SimState | null = null;

  constructor(uiRoot: HTMLElement, callbacks: WeaponRackCallbacks) {
    this.callbacks = callbacks;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'kh-modal-backdrop kh-hidden';
    this.backdrop.setAttribute('data-screen', 'weapon_menu');

    const shell = document.createElement('div');
    shell.className = 'kh-meta-shell';

    // Header
    const header = document.createElement('div');
    header.className = 'kh-meta-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'kh-meta-title-group';
    const title = document.createElement('h2');
    title.className = 'kh-meta-title';
    title.textContent = 'INFERNAL ARMORY';
    const sub = document.createElement('div');
    sub.className = 'kh-meta-sub';
    sub.textContent = '6 Infernal Arms · 24 Aspects · Titan Blood Awakening';
    titleGroup.append(title, sub);

    const badges = document.createElement('div');
    badges.className = 'kh-meta-badges';
    this.equippedBadge = document.createElement('div');
    this.equippedBadge.className = 'kh-meta-pill';
    this.titanBloodBadge = document.createElement('div');
    this.titanBloodBadge.className = 'kh-meta-pill kh-meta-pill-crimson';
    badges.append(this.equippedBadge, this.titanBloodBadge);
    header.append(titleGroup, badges);

    const meander = document.createElement('div');
    meander.className = 'kh-meander-strip';

    // 6-Weapon Tab Strip
    this.tabStrip = document.createElement('div');
    this.tabStrip.className = 'kh-tab-strip';
    WEAPON_LIST.forEach((weaponId, idx) => {
      const def = WEAPON_CONSTANTS[weaponId];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kh-tab-btn';
      btn.dataset.weaponId = weaponId;
      btn.textContent = def.displayName;
      btn.addEventListener('click', () => {
        this.selectedWeaponIndex = idx;
        this.focusedAspectIndex = 0;
        this.lastRenderKey = '';
        if (this.latestState) {
          this.renderBody(this.latestState);
        }
      });
      this.tabButtons.push(btn);
      this.tabStrip.appendChild(btn);
    });

    // Scrollable Content
    const scroll = document.createElement('div');
    scroll.className = 'kh-meta-scroll';
    scroll.style.display = 'flex';
    scroll.style.flexDirection = 'column';
    scroll.style.gap = '10px';

    this.weaponSummaryEl = document.createElement('div');
    this.weaponSummaryEl.className = 'kh-weapon-summary';

    this.aspectGrid = document.createElement('div');
    this.aspectGrid.className = 'kh-aspect-grid';

    scroll.append(this.weaponSummaryEl, this.aspectGrid);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'kh-meta-footer';
    this.hintEl = document.createElement('span');
    this.hintEl.className = 'kh-meta-hint';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kh-btn kh-btn-primary';
    closeBtn.textContent = 'CLOSE ARMORY';
    closeBtn.addEventListener('click', () => this.callbacks.onCloseModal());
    footer.append(this.hintEl, closeBtn);

    shell.append(header, meander, this.tabStrip, scroll, footer);
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
        const idx = WEAPON_LIST.indexOf(state.meta.selectedWeapon);
        this.selectedWeaponIndex = idx >= 0 ? idx : 0;
        const wDef = WEAPON_CONSTANTS[WEAPON_LIST[this.selectedWeaponIndex]];
        const equippedAspect = state.meta.selectedAspects[wDef.id];
        const aIdx = wDef.aspects.indexOf(equippedAspect);
        this.focusedAspectIndex = aIdx >= 0 ? aIdx : 0;
        this.lastRenderKey = '';
      }
    }
    if (!isVisible) {
      return;
    }

    const hint =
      activeSource === 'gamepad'
        ? 'LB / RB Switch Arm · D-PAD Choose Aspect · A Equip · B Close'
        : activeSource === 'touch'
          ? 'Tap Arm tab · Tap Equip or Rank Up with Titan Blood'
          : '[ / ] Switch Arm · ↑↓←→ Choose Aspect · ENTER Equip · ESC Close';
    if (this.hintEl.textContent !== hint) {
      this.hintEl.textContent = hint;
    }

    if (menuNav.back || menuNav.pause) {
      this.callbacks.onCloseModal();
      return;
    }

    // Switch Weapon Arm via LB/RB or [/]
    if (menuNav.tabPrev) {
      this.selectedWeaponIndex =
        (this.selectedWeaponIndex - 1 + WEAPON_LIST.length) % WEAPON_LIST.length;
      this.focusedAspectIndex = 0;
      this.lastRenderKey = '';
    } else if (menuNav.tabNext) {
      this.selectedWeaponIndex = (this.selectedWeaponIndex + 1) % WEAPON_LIST.length;
      this.focusedAspectIndex = 0;
      this.lastRenderKey = '';
    }

    // Navigate 2x2 Aspect Grid
    if (menuNav.left) {
      this.focusedAspectIndex = (this.focusedAspectIndex + 3) % 4;
      this.applyFocusStyles();
    } else if (menuNav.right) {
      this.focusedAspectIndex = (this.focusedAspectIndex + 1) % 4;
      this.applyFocusStyles();
    } else if (menuNav.up) {
      this.focusedAspectIndex = (this.focusedAspectIndex + 2) % 4;
      this.applyFocusStyles();
    } else if (menuNav.down) {
      this.focusedAspectIndex = (this.focusedAspectIndex + 2) % 4;
      this.applyFocusStyles();
    }

    const activeWeaponId = WEAPON_LIST[this.selectedWeaponIndex];
    const key = `${activeWeaponId}:${state.meta.selectedWeapon}:${state.meta.selectedAspects[activeWeaponId]}:${state.meta.titanBlood}:${JSON.stringify(
      WEAPON_CONSTANTS[activeWeaponId].aspects.map((a) => state.meta.aspectRanks[a] ?? 1)
    )}`;
    if (key !== this.lastRenderKey) {
      this.lastRenderKey = key;
      this.renderBody(state);
    }

    if (menuNav.confirm) {
      const targetAspect = this.currentAspects[this.focusedAspectIndex];
      if (targetAspect) {
        this.callbacks.onSelectWeapon?.(activeWeaponId, targetAspect);
      }
    }
  }

  public dispose(): void {
    this.backdrop.remove();
  }

  private renderBody(state: SimState): void {
    const weaponId = WEAPON_LIST[this.selectedWeaponIndex];
    const weaponDef = WEAPON_CONSTANTS[weaponId];
    const equippedWeapon = WEAPON_CONSTANTS[state.meta.selectedWeapon];
    const equippedAspect = ASPECT_DEFS[state.meta.selectedAspects[state.meta.selectedWeapon]];

    this.equippedBadge.textContent = `ACTIVE: ${equippedWeapon.displayName} (${equippedAspect.displayName})`;
    this.titanBloodBadge.textContent = `TITAN BLOOD: ${state.meta.titanBlood}`;

    this.tabButtons.forEach((btn, idx) => {
      const id = WEAPON_LIST[idx];
      btn.classList.toggle('kh-active', idx === this.selectedWeaponIndex);
      const isEquippedArm = state.meta.selectedWeapon === id;
      btn.textContent = isEquippedArm
        ? `★ ${WEAPON_CONSTANTS[id].displayName}`
        : WEAPON_CONSTANTS[id].displayName;
    });

    // Weapon Base Summary Bar
    this.weaponSummaryEl.innerHTML = '';
    const leftInfo = document.createElement('div');
    const wName = document.createElement('div');
    wName.style.fontFamily = 'var(--kh-font-display)';
    wName.style.fontSize = '15px';
    wName.style.fontWeight = '700';
    wName.style.color = '#ffe8b8';
    wName.textContent = `${weaponDef.displayName} — ${weaponDef.subtitle}`;
    leftInfo.appendChild(wName);

    const chips = document.createElement('div');
    chips.className = 'kh-weapon-stat-chips';
    const statItems = [
      `ATK: ${weaponDef.attackComboDamage.join('/')}`,
      `DASH-STRIKE: ${weaponDef.dashStrikeDamage}`,
      `RANGE: ${weaponDef.attackRange}`,
      `SPC (${weaponDef.specialName}): ${weaponDef.specialDamage}${weaponDef.specialHits > 1 ? `×${weaponDef.specialHits}` : ''}`,
    ];
    if (weaponDef.clipSize) {
      statItems.push(`CLIP: ${weaponDef.clipSize}`);
    }
    for (const st of statItems) {
      const chip = document.createElement('span');
      chip.className = 'kh-boon-chip';
      chip.textContent = st;
      chips.appendChild(chip);
    }
    this.weaponSummaryEl.append(leftInfo, chips);

    // 4 Aspects Grid
    this.aspectGrid.innerHTML = '';
    this.aspectCards = [];
    this.currentAspects = weaponDef.aspects;

    weaponDef.aspects.forEach((aspectId, idx) => {
      const def = ASPECT_DEFS[aspectId];
      const rank = Math.max(1, Math.min(def.maxRank, Math.floor(state.meta.aspectRanks[aspectId] ?? 1)));
      const isEquipped =
        state.meta.selectedWeapon === weaponId && state.meta.selectedAspects[weaponId] === aspectId;
      const upgradeCost = getAspectUpgradeCost(rank, def.isHiddenAspect);
      const canUpgrade = rank < def.maxRank && state.meta.titanBlood >= upgradeCost;

      const card = document.createElement('div');
      card.className = isEquipped ? 'kh-aspect-card kh-equipped' : 'kh-aspect-card';
      card.dataset.aspectId = aspectId;

      const topRow = document.createElement('div');
      topRow.style.display = 'flex';
      topRow.style.alignItems = 'center';
      topRow.style.justifyContent = 'space-between';
      topRow.style.gap = '8px';

      const nameEl = document.createElement('div');
      nameEl.style.fontFamily = 'var(--kh-font-display)';
      nameEl.style.fontSize = '14px';
      nameEl.style.fontWeight = '700';
      nameEl.style.color = def.isHiddenAspect ? '#ff96a2' : '#fff5df';
      nameEl.textContent = def.displayName;

      const badgeRow = document.createElement('div');
      badgeRow.style.display = 'flex';
      badgeRow.style.gap = '5px';

      if (def.isHiddenAspect) {
        const hiddenTag = document.createElement('span');
        hiddenTag.className = 'kh-boon-slot-tag';
        hiddenTag.style.color = '#ff9ea8';
        hiddenTag.style.border = '1px solid rgba(255, 110, 126, 0.55)';
        hiddenTag.textContent = 'HIDDEN';
        badgeRow.appendChild(hiddenTag);
      }

      const rankTag = document.createElement('span');
      rankTag.className = 'kh-boon-slot-tag';
      rankTag.style.color = '#f5cb70';
      rankTag.textContent = `RANK ${rank}/${def.maxRank}`;
      badgeRow.appendChild(rankTag);

      topRow.append(nameEl, badgeRow);

      const desc = document.createElement('p');
      desc.className = 'kh-boon-desc';
      desc.textContent = def.description;

      const actions = document.createElement('div');
      actions.className = 'kh-aspect-actions';

      const equipBtn = document.createElement('button');
      equipBtn.type = 'button';
      equipBtn.className = isEquipped ? 'kh-btn kh-btn-primary' : 'kh-btn';
      equipBtn.textContent = isEquipped ? '✓ EQUIPPED' : 'EQUIP ASPECT';
      equipBtn.addEventListener('click', () => {
        this.focusedAspectIndex = idx;
        this.callbacks.onSelectWeapon?.(weaponId, aspectId);
      });

      const upgradeBtn = document.createElement('button');
      upgradeBtn.type = 'button';
      upgradeBtn.className = 'kh-btn';
      upgradeBtn.disabled = !canUpgrade;
      upgradeBtn.textContent =
        rank >= def.maxRank ? 'MAX RANK' : `RANK UP (${upgradeCost} BLOOD)`;
      upgradeBtn.addEventListener('click', () => {
        this.focusedAspectIndex = idx;
        if (this.callbacks.onUpgradeAspect) {
          this.callbacks.onUpgradeAspect(aspectId);
        } else if (canUpgrade) {
          // Graceful local fallback before App wires dedicated onUpgradeAspect
          state.meta.titanBlood -= upgradeCost;
          state.meta.aspectRanks[aspectId] = rank + 1;
          this.callbacks.onSelectWeapon?.(weaponId, aspectId);
          this.lastRenderKey = '';
        }
      });

      actions.append(equipBtn, upgradeBtn);
      card.append(topRow, desc, actions);
      card.addEventListener('pointerenter', () => {
        this.focusedAspectIndex = idx;
        this.applyFocusStyles();
      });

      this.aspectGrid.appendChild(card);
      this.aspectCards.push(card);
    });

    this.applyFocusStyles();
  }

  private applyFocusStyles(): void {
    this.aspectCards.forEach((card, idx) => {
      card.classList.toggle('kh-focused', idx === this.focusedAspectIndex);
    });
  }
}
