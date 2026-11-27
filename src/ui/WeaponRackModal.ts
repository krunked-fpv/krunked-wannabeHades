import {
  ASPECT_DEFS,
  WEAPON_CONSTANTS,
  type AspectId,
  type InputSource,
  type SimState,
  type WeaponId,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';
import { attachCornerFiligrees, svgWeaponSilhouette } from './svgArt.js';

export interface WeaponRackCallbacks {
  onSelectWeapon?(weaponId: WeaponId, aspectId: AspectId): void;
  onUpgradeAspect?(aspectId: AspectId): void;
  onCloseModal(): void;
  readonly onUiHover?: () => void;
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
    shell.className = 'kh-meta-shell kh-ornate-frame kh-theme-armory';
    attachCornerFiligrees(shell);

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
    sub.textContent = 'Six Infernal Arms · Twenty-Four Aspects · Titan Blood Awakening';
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

    // 6-Weapon Tab Strip with SVG Weapon Silhouettes
    this.tabStrip = document.createElement('div');
    this.tabStrip.className = 'kh-tab-strip';
    WEAPON_LIST.forEach((weaponId, idx) => {
      const def = WEAPON_CONSTANTS[weaponId];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kh-tab-btn';
      btn.dataset.weaponId = weaponId;
      btn.innerHTML = `<span class="kh-tab-icon">${svgWeaponSilhouette(weaponId, 18)}</span><span class="kh-tab-label">${def.displayName}</span>`;
      btn.addEventListener('click', () => {
        this.selectedWeaponIndex = idx;
        this.focusedAspectIndex = 0;
        this.lastRenderKey = '';
        if (this.latestState) {
          this.renderBody(this.latestState);
        }
      });
      btn.addEventListener('pointerenter', () => this.callbacks.onUiHover?.());
      this.tabButtons.push(btn);
      this.tabStrip.appendChild(btn);
    });

    // Scrollable Content
    const scroll = document.createElement('div');
    scroll.className = 'kh-meta-scroll kh-armory-scroll';

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
    closeBtn.className = 'kh-btn kh-btn-primary kh-btn-notched';
    closeBtn.textContent = 'CLOSE ARMORY';
    closeBtn.addEventListener('click', () => this.callbacks.onCloseModal());
    closeBtn.addEventListener('pointerenter', () => this.callbacks.onUiHover?.());
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

    if (menuNav.tabPrev) {
      this.selectedWeaponIndex =
        (this.selectedWeaponIndex - 1 + WEAPON_LIST.length) % WEAPON_LIST.length;
      this.focusedAspectIndex = 0;
      this.lastRenderKey = '';
      this.callbacks.onUiHover?.();
    } else if (menuNav.tabNext) {
      this.selectedWeaponIndex = (this.selectedWeaponIndex + 1) % WEAPON_LIST.length;
      this.focusedAspectIndex = 0;
      this.lastRenderKey = '';
      this.callbacks.onUiHover?.();
    }

    const prevAspect = this.focusedAspectIndex;
    if (menuNav.left) {
      this.focusedAspectIndex = (this.focusedAspectIndex + 3) % 4;
    } else if (menuNav.right) {
      this.focusedAspectIndex = (this.focusedAspectIndex + 1) % 4;
    } else if (menuNav.up) {
      this.focusedAspectIndex = (this.focusedAspectIndex + 2) % 4;
    } else if (menuNav.down) {
      this.focusedAspectIndex = (this.focusedAspectIndex + 2) % 4;
    }
    if (this.focusedAspectIndex !== prevAspect) {
      this.applyFocusStyles();
      this.callbacks.onUiHover?.();
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
      const labelEl = btn.querySelector('.kh-tab-label');
      if (labelEl) {
        labelEl.textContent = isEquippedArm
          ? `★ ${WEAPON_CONSTANTS[id].displayName}`
          : WEAPON_CONSTANTS[id].displayName;
      }
    });

    // Weapon Hero Banner with Large SVG Silhouette & Sculpted Stat Badges
    this.weaponSummaryEl.innerHTML = '';
    const leftInfo = document.createElement('div');
    leftInfo.className = 'kh-weapon-banner-head';

    const emblem = document.createElement('div');
    emblem.className = 'kh-weapon-emblem-medallion';
    emblem.innerHTML = svgWeaponSilhouette(weaponId, 34);

    const textWrap = document.createElement('div');
    textWrap.className = 'kh-weapon-banner-text';
    const wName = document.createElement('div');
    wName.className = 'kh-weapon-banner-name';
    wName.textContent = weaponDef.displayName;
    const wSub = document.createElement('div');
    wSub.className = 'kh-weapon-banner-sub';
    wSub.textContent = weaponDef.subtitle;
    textWrap.append(wName, wSub);

    leftInfo.append(emblem, textWrap);

    const chips = document.createElement('div');
    chips.className = 'kh-weapon-stat-chips';
    const statItems: [string, string][] = [
      ['ATK', weaponDef.attackComboDamage.join('/')],
      ['DASH-STRIKE', String(weaponDef.dashStrikeDamage)],
      ['RANGE', String(weaponDef.attackRange)],
      [
        `SPC (${weaponDef.specialName})`,
        `${weaponDef.specialDamage}${weaponDef.specialHits > 1 ? `×${weaponDef.specialHits}` : ''}`,
      ],
    ];
    if (weaponDef.clipSize) {
      statItems.push(['CLIP', String(weaponDef.clipSize)]);
    }
    for (const [k, v] of statItems) {
      const chip = document.createElement('span');
      chip.className = 'kh-stat-badge';
      chip.innerHTML = `<span class="kh-stat-badge-key">${k}</span><span class="kh-stat-badge-num">${v}</span>`;
      chips.appendChild(chip);
    }
    this.weaponSummaryEl.append(leftInfo, chips);

    // 4 Aspects Grid with Rank Pips
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
      topRow.className = 'kh-aspect-top-row';

      const nameEl = document.createElement('div');
      nameEl.className = def.isHiddenAspect ? 'kh-aspect-name kh-aspect-hidden' : 'kh-aspect-name';
      nameEl.textContent = def.displayName;

      const badgeRow = document.createElement('div');
      badgeRow.className = 'kh-aspect-badges';

      if (def.isHiddenAspect) {
        const hiddenTag = document.createElement('span');
        hiddenTag.className = 'kh-boon-slot-tag kh-tag-hidden';
        hiddenTag.textContent = 'HIDDEN';
        badgeRow.appendChild(hiddenTag);
      }

      const rankTag = document.createElement('span');
      rankTag.className = 'kh-boon-slot-tag kh-tag-rank';
      rankTag.textContent = `RANK ${rank}/${def.maxRank}`;
      badgeRow.appendChild(rankTag);

      topRow.append(nameEl, badgeRow);

      // Rank Pip Track (1/5 -> 5/5)
      const pipTrack = document.createElement('div');
      pipTrack.className = 'kh-rank-pip-track';
      pipTrack.setAttribute('aria-hidden', 'true');
      for (let r = 1; r <= def.maxRank; r++) {
        const pip = document.createElement('span');
        pip.className = r <= rank ? 'kh-rank-pip kh-filled' : 'kh-rank-pip';
        pipTrack.appendChild(pip);
      }

      const desc = document.createElement('p');
      desc.className = 'kh-boon-desc';
      desc.textContent = def.description;

      const actions = document.createElement('div');
      actions.className = 'kh-aspect-actions';

      const equipBtn = document.createElement('button');
      equipBtn.type = 'button';
      equipBtn.className = isEquipped ? 'kh-btn kh-btn-primary kh-btn-notched' : 'kh-btn kh-btn-notched';
      equipBtn.textContent = isEquipped ? '✓ EQUIPPED' : 'EQUIP ASPECT';
      equipBtn.addEventListener('click', () => {
        this.focusedAspectIndex = idx;
        this.callbacks.onSelectWeapon?.(weaponId, aspectId);
      });
      equipBtn.addEventListener('pointerenter', () => this.callbacks.onUiHover?.());

      const upgradeBtn = document.createElement('button');
      upgradeBtn.type = 'button';
      upgradeBtn.className = 'kh-btn kh-btn-notched';
      upgradeBtn.disabled = !canUpgrade;
      upgradeBtn.textContent =
        rank >= def.maxRank ? 'MAX RANK' : `RANK UP (${upgradeCost} BLOOD)`;
      upgradeBtn.addEventListener('click', () => {
        this.focusedAspectIndex = idx;
        if (this.callbacks.onUpgradeAspect) {
          this.callbacks.onUpgradeAspect(aspectId);
        } else if (canUpgrade) {
          state.meta.titanBlood -= upgradeCost;
          state.meta.aspectRanks[aspectId] = rank + 1;
          this.callbacks.onSelectWeapon?.(weaponId, aspectId);
          this.lastRenderKey = '';
        }
      });
      upgradeBtn.addEventListener('pointerenter', () => {
        if (!upgradeBtn.disabled) this.callbacks.onUiHover?.();
      });

      actions.append(equipBtn, upgradeBtn);
      card.append(topRow, pipTrack, desc, actions);
      card.addEventListener('pointerenter', () => {
        if (this.focusedAspectIndex !== idx) {
          this.focusedAspectIndex = idx;
          this.applyFocusStyles();
          this.callbacks.onUiHover?.();
        }
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
