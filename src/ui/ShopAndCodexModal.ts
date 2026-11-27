import {
  ASPECT_DEFS,
  BOSS_CONSTANTS,
  HAMMER_DEFS,
  PATRON_CONSTANTS,
  PLAYER_CONSTANTS,
  SHRINE_VOWS,
  WEAPON_CONSTANTS,
  type BossId,
  type EnemyArchetypeId,
  type InputSource,
  type PatronId,
  type PickupItem,
  type ScreenId,
  type ShrineVowId,
  type SimState,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';
import {
  attachCornerFiligrees,
  svgObolCoin,
  svgPatronSigil,
  svgWeaponSilhouette,
} from './svgArt.js';

export interface ShopAndCodexCallbacks {
  onBuyShopItem?(pickupId: string): void;
  onBorrowGoldBag?(): void;
  onCloseModal(): void;
  readonly onUiHover?: () => void;
}

type CodexTab = 'build' | 'bestiary' | 'archive';
const CODEX_TABS: readonly { id: CodexTab; label: string }[] = [
  { id: 'build', label: 'ACTIVE BUILD & BOONS' },
  { id: 'bestiary', label: 'FOE KILL LOG' },
  { id: 'archive', label: 'RUN HISTORY & VAULT' },
];

const PATRON_LIST: readonly PatronId[] = [
  'voltaris',
  'tidebreaker',
  'aegira',
  'velouris',
  'sylvara',
  'bellum',
  'bacchion',
  'glaciera',
  'veloce',
  'abyssos',
];

function formatArchetypeName(id: EnemyArchetypeId): string {
  if (id in BOSS_CONSTANTS) {
    return BOSS_CONSTANTS[id as BossId].displayName;
  }
  return id
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export class ShopAndCodexModal {
  private readonly backdrop: HTMLDivElement;
  private readonly callbacks: ShopAndCodexCallbacks;

  // Shop Panel
  private readonly shopShell: HTMLDivElement;
  private readonly shopTitleEl: HTMLHeadingElement;
  private readonly shopSubEl: HTMLDivElement;
  private readonly shopGoldBadge: HTMLDivElement;
  private readonly shopGridEl: HTMLDivElement;
  private readonly shopHintEl: HTMLSpanElement;

  // Codex Panel
  private readonly codexShell: HTMLDivElement;
  private readonly codexSeenBadge: HTMLDivElement;
  private readonly codexKillsBadge: HTMLDivElement;
  private readonly codexTabButtons: HTMLButtonElement[] = [];
  private readonly codexBodyEl: HTMLDivElement;
  private readonly codexHintEl: HTMLSpanElement;

  private activeMode: 'none' | 'shop' | 'codex' = 'none';
  private activeCodexTab: CodexTab = 'build';
  private shopFocusedIndex = 0;
  private shopCardButtons: HTMLButtonElement[] = [];
  private shopActions: (() => void)[] = [];
  private lastRenderKey = '';

  constructor(uiRoot: HTMLElement, callbacks: ShopAndCodexCallbacks) {
    this.callbacks = callbacks;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'kh-modal-backdrop kh-hidden';

    // ==================== 1. BOATMAN SHOP / WELL OF ASH ====================
    this.shopShell = document.createElement('div');
    this.shopShell.className = 'kh-meta-shell kh-ornate-frame kh-theme-shop kh-hidden';
    this.shopShell.setAttribute('data-screen', 'shop_menu');
    attachCornerFiligrees(this.shopShell);

    const shopHeader = document.createElement('div');
    shopHeader.className = 'kh-meta-header';

    const shopTitleGroup = document.createElement('div');
    shopTitleGroup.className = 'kh-meta-title-group';
    this.shopTitleEl = document.createElement('h2');
    this.shopTitleEl.className = 'kh-meta-title';
    this.shopTitleEl.textContent = "BOATMAN'S WARES";
    this.shopSubEl = document.createElement('div');
    this.shopSubEl.className = 'kh-meta-sub';
    shopTitleGroup.append(this.shopTitleEl, this.shopSubEl);

    this.shopGoldBadge = document.createElement('div');
    this.shopGoldBadge.className = 'kh-meta-pill kh-meta-pill-gold';
    shopHeader.append(shopTitleGroup, this.shopGoldBadge);

    const shopMeander = document.createElement('div');
    shopMeander.className = 'kh-meander-strip';

    const shopScroll = document.createElement('div');
    shopScroll.className = 'kh-meta-scroll';
    this.shopGridEl = document.createElement('div');
    this.shopGridEl.className = 'kh-shop-grid';
    shopScroll.appendChild(this.shopGridEl);

    const shopFooter = document.createElement('div');
    shopFooter.className = 'kh-meta-footer';
    this.shopHintEl = document.createElement('span');
    this.shopHintEl.className = 'kh-meta-hint';
    const shopCloseBtn = document.createElement('button');
    shopCloseBtn.type = 'button';
    shopCloseBtn.className = 'kh-btn kh-btn-primary kh-btn-notched';
    shopCloseBtn.textContent = 'LEAVE SHOP';
    shopCloseBtn.addEventListener('click', () => this.callbacks.onCloseModal());
    shopCloseBtn.addEventListener('pointerenter', () => this.callbacks.onUiHover?.());
    shopFooter.append(this.shopHintEl, shopCloseBtn);

    this.shopShell.append(shopHeader, shopMeander, shopScroll, shopFooter);

    // ==================== 2. SANCTUM CODEX (LB / TAB) ====================
    this.codexShell = document.createElement('div');
    this.codexShell.className = 'kh-meta-shell kh-ornate-frame kh-theme-codex kh-hidden';
    this.codexShell.setAttribute('data-screen', 'codex_menu');
    attachCornerFiligrees(this.codexShell);

    const codexHeader = document.createElement('div');
    codexHeader.className = 'kh-meta-header';

    const codexTitleGroup = document.createElement('div');
    codexTitleGroup.className = 'kh-meta-title-group';
    const codexTitle = document.createElement('h2');
    codexTitle.className = 'kh-meta-title';
    codexTitle.textContent = 'SANCTUM CODEX';
    const codexSub = document.createElement('div');
    codexSub.className = 'kh-meta-sub';
    codexSub.textContent = 'Boon Ledger · Foe Bestiary · Escape Archive';
    codexTitleGroup.append(codexTitle, codexSub);

    const codexBadges = document.createElement('div');
    codexBadges.className = 'kh-meta-badges';
    this.codexSeenBadge = document.createElement('div');
    this.codexSeenBadge.className = 'kh-meta-pill kh-meta-pill-purple';
    this.codexKillsBadge = document.createElement('div');
    this.codexKillsBadge.className = 'kh-meta-pill';
    codexBadges.append(this.codexSeenBadge, this.codexKillsBadge);
    codexHeader.append(codexTitleGroup, codexBadges);

    const codexMeander = document.createElement('div');
    codexMeander.className = 'kh-meander-strip';

    const codexTabStrip = document.createElement('div');
    codexTabStrip.className = 'kh-tab-strip';
    CODEX_TABS.forEach((tab) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kh-tab-btn';
      btn.dataset.codexTab = tab.id;
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        this.activeCodexTab = tab.id;
        this.lastRenderKey = '';
      });
      btn.addEventListener('pointerenter', () => this.callbacks.onUiHover?.());
      this.codexTabButtons.push(btn);
      codexTabStrip.appendChild(btn);
    });

    const codexScroll = document.createElement('div');
    codexScroll.className = 'kh-meta-scroll';
    this.codexBodyEl = document.createElement('div');
    this.codexBodyEl.className = 'kh-codex-body';
    codexScroll.appendChild(this.codexBodyEl);

    const codexFooter = document.createElement('div');
    codexFooter.className = 'kh-meta-footer';
    this.codexHintEl = document.createElement('span');
    this.codexHintEl.className = 'kh-meta-hint';
    const codexCloseBtn = document.createElement('button');
    codexCloseBtn.type = 'button';
    codexCloseBtn.className = 'kh-btn kh-btn-primary kh-btn-notched';
    codexCloseBtn.textContent = 'CLOSE CODEX';
    codexCloseBtn.addEventListener('click', () => this.callbacks.onCloseModal());
    codexCloseBtn.addEventListener('pointerenter', () => this.callbacks.onUiHover?.());
    codexFooter.append(this.codexHintEl, codexCloseBtn);

    this.codexShell.append(codexHeader, codexMeander, codexTabStrip, codexScroll, codexFooter);

    this.backdrop.append(this.shopShell, this.codexShell);
    uiRoot.appendChild(this.backdrop);
  }

  public update(
    state: SimState,
    screen: ScreenId,
    activeSource: InputSource,
    menuNav: MenuNavInput
  ): void {
    const nextMode: 'none' | 'shop' | 'codex' =
      screen === 'shop_menu' ? 'shop' : screen === 'codex_menu' ? 'codex' : 'none';

    if (nextMode !== this.activeMode) {
      this.activeMode = nextMode;
      this.shopFocusedIndex = 0;
      this.lastRenderKey = '';
      this.backdrop.classList.toggle('kh-hidden', nextMode === 'none');
      this.shopShell.classList.toggle('kh-hidden', nextMode !== 'shop');
      this.codexShell.classList.toggle('kh-hidden', nextMode !== 'codex');
    }

    if (nextMode === 'none') {
      return;
    }

    if (menuNav.back || menuNav.pause) {
      this.callbacks.onCloseModal();
      return;
    }

    if (nextMode === 'shop') {
      this.updateShop(state, activeSource, menuNav);
    } else {
      this.updateCodex(state, activeSource, menuNav);
    }
  }

  public dispose(): void {
    this.backdrop.remove();
  }

  // ==================== BOATMAN SHOP / WELL OF ASH ====================

  private updateShop(state: SimState, activeSource: InputSource, menuNav: MenuNavInput): void {
    const hint =
      activeSource === 'gamepad'
        ? 'D-PAD Select Ware · A Purchase · B Leave'
        : activeSource === 'touch'
          ? 'Tap any item to buy with Gold'
          : '↑↓←→ Select Ware · ENTER Purchase · ESC Leave';
    if (this.shopHintEl.textContent !== hint) {
      this.shopHintEl.textContent = hint;
    }

    const shopItems = this.getShopPickups(state);
    const showBorrowBag =
      state.room.encounterKind === 'shop' &&
      !state.run.bossesDefeated.includes('the_ferryman') &&
      !state.enemies.some((e) => e.bossId === 'the_ferryman' && e.hp > 0);

    const key = `shop:${Math.floor(state.player.gold)}:${showBorrowBag ? 1 : 0}:${shopItems
      .map((p) => `${p.id}:${p.costGold}:${p.collected ? 1 : 0}`)
      .join('|')}`;
    if (key !== this.lastRenderKey) {
      this.lastRenderKey = key;
      this.renderShop(state, shopItems, showBorrowBag);
    }

    const total = this.shopCardButtons.length;
    if (total > 0) {
      if (this.shopFocusedIndex >= total) {
        this.shopFocusedIndex = 0;
        this.applyShopFocus();
      }
      const prevIdx = this.shopFocusedIndex;
      if (menuNav.left || menuNav.up) {
        this.shopFocusedIndex = (this.shopFocusedIndex - 1 + total) % total;
      } else if (menuNav.right || menuNav.down) {
        this.shopFocusedIndex = (this.shopFocusedIndex + 1) % total;
      }
      if (this.shopFocusedIndex !== prevIdx) {
        this.applyShopFocus();
        this.callbacks.onUiHover?.();
      }
      if (menuNav.confirm) {
        this.shopActions[this.shopFocusedIndex]?.();
      }
    }
  }

  private getShopPickups(state: SimState): PickupItem[] {
    return state.room.pickups.filter(
      (p) => !p.collected && (p.costGold > 0 || p.kind === 'shop_item' || p.kind === 'well_of_ash')
    );
  }

  private renderShop(state: SimState, items: readonly PickupItem[], showBorrowBag: boolean): void {
    const isWell = items.length > 0 && items.every((p) => p.kind === 'well_of_ash');
    this.shopTitleEl.textContent = isWell ? 'WELL OF ASH' : "BOATMAN'S WARES";
    const feeRank = state.run.vows.convenience_fee ?? state.meta.shrineVows.convenience_fee ?? 0;
    this.shopSubEl.textContent =
      feeRank > 0
        ? `Underworld Peddler · Convenience Fee active (+${feeRank * 40}% prices)`
        : 'Exchange Underworld Gold for Blessings, Vitality, & Supplies';
    this.shopGoldBadge.innerHTML = `${svgObolCoin()}<span>GOLD: ${Math.floor(state.player.gold)}</span>`;

    this.shopGridEl.innerHTML = '';
    this.shopCardButtons = [];
    this.shopActions = [];

    if (items.length === 0 && !showBorrowBag) {
      const empty = document.createElement('div');
      empty.className = 'kh-codex-entry kh-codex-empty';
      empty.textContent = 'All wares in this chamber have been claimed.';
      this.shopGridEl.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const canAfford = state.player.gold >= item.costGold;
      const idx = this.shopCardButtons.length;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = canAfford ? 'kh-shop-card' : 'kh-shop-card kh-unaffordable';
      card.dataset.pickupId = item.id;

      const left = document.createElement('div');
      left.className = 'kh-shop-card-left';

      const nameRow = document.createElement('div');
      nameRow.className = 'kh-shop-name-row';
      if (item.patronId) {
        const sig = document.createElement('span');
        sig.className = 'kh-shop-sigil';
        sig.style.color = PATRON_CONSTANTS[item.patronId].colorHex;
        sig.innerHTML = svgPatronSigil(item.patronId, 20);
        nameRow.appendChild(sig);
      }
      const title = document.createElement('span');
      title.className = 'kh-shop-item-title';
      title.textContent = item.label;
      nameRow.appendChild(title);

      const kindSub = document.createElement('span');
      kindSub.className = 'kh-shop-item-sub';
      kindSub.textContent = item.patronId
        ? `${PATRON_CONSTANTS[item.patronId].displayName} Offering`
        : item.kind.replace(/_/g, ' ').toUpperCase();

      left.append(nameRow, kindSub);

      const price = document.createElement('span');
      price.className = canAfford ? 'kh-meta-pill kh-meta-pill-gold' : 'kh-meta-pill kh-meta-pill-crimson';
      price.innerHTML =
        item.costGold > 0 ? `${svgObolCoin()}<span>${item.costGold} GOLD</span>` : '<span>FREE</span>';

      card.append(left, price);

      const buyAction = () => {
        if (canAfford) {
          this.callbacks.onBuyShopItem?.(item.id);
        }
      };
      card.addEventListener('click', () => {
        this.shopFocusedIndex = idx;
        buyAction();
      });
      card.addEventListener('pointerenter', () => {
        if (this.shopFocusedIndex !== idx) {
          this.shopFocusedIndex = idx;
          this.applyShopFocus();
          this.callbacks.onUiHover?.();
        }
      });

      this.shopGridEl.appendChild(card);
      this.shopCardButtons.push(card);
      this.shopActions.push(buyAction);
    });

    if (showBorrowBag) {
      const idx = this.shopCardButtons.length;
      const borrowCard = document.createElement('button');
      borrowCard.type = 'button';
      borrowCard.className = 'kh-shop-card kh-borrow-card';
      borrowCard.dataset.action = 'borrow_gold_bag';

      const left = document.createElement('div');
      left.className = 'kh-shop-card-left';

      const title = document.createElement('span');
      title.className = 'kh-shop-borrow-title';
      title.textContent = 'BORROW GOLD BAG (+300 GOLD)';

      const warn = document.createElement('span');
      warn.className = 'kh-shop-borrow-warn';
      warn.textContent = 'WARNING: Disturbing the Boatman summons The Ferryman (Secret Boss)!';

      left.append(title, warn);

      const pill = document.createElement('span');
      pill.className = 'kh-meta-pill kh-meta-pill-crimson';
      pill.textContent = 'DARE';

      borrowCard.append(left, pill);

      const borrowAction = () => {
        this.callbacks.onBorrowGoldBag?.();
      };
      borrowCard.addEventListener('click', () => {
        this.shopFocusedIndex = idx;
        borrowAction();
      });
      borrowCard.addEventListener('pointerenter', () => {
        if (this.shopFocusedIndex !== idx) {
          this.shopFocusedIndex = idx;
          this.applyShopFocus();
          this.callbacks.onUiHover?.();
        }
      });

      this.shopGridEl.appendChild(borrowCard);
      this.shopCardButtons.push(borrowCard);
      this.shopActions.push(borrowAction);
    }

    this.applyShopFocus();
  }

  private applyShopFocus(): void {
    this.shopCardButtons.forEach((btn, idx) => {
      btn.classList.toggle('kh-focused', idx === this.shopFocusedIndex);
    });
  }

  // ==================== SANCTUM CODEX (LB / TAB) ====================

  private updateCodex(state: SimState, activeSource: InputSource, menuNav: MenuNavInput): void {
    const hint =
      activeSource === 'gamepad'
        ? 'LB / RB or ←→ Switch Tab · B Close Codex'
        : activeSource === 'touch'
          ? 'Tap any tab above to inspect Build, Kill Log, or Run Archive'
          : '←→ or [ / ] Switch Tab · TAB / ESC Close Codex';
    if (this.codexHintEl.textContent !== hint) {
      this.codexHintEl.textContent = hint;
    }

    const curIdx = CODEX_TABS.findIndex((t) => t.id === this.activeCodexTab);
    if (menuNav.tabPrev || menuNav.left) {
      const next = (curIdx - 1 + CODEX_TABS.length) % CODEX_TABS.length;
      this.activeCodexTab = CODEX_TABS[next].id;
      this.lastRenderKey = '';
      this.callbacks.onUiHover?.();
    } else if (menuNav.tabNext || menuNav.right) {
      const next = (curIdx + 1) % CODEX_TABS.length;
      this.activeCodexTab = CODEX_TABS[next].id;
      this.lastRenderKey = '';
      this.callbacks.onUiHover?.();
    }

    const totalKills = Object.values(state.meta.codexKills).reduce((a, b) => a + (b ?? 0), 0);
    const key = `codex:${this.activeCodexTab}:${state.player.boons.length}:${state.player.hammers.length}:${state.meta.codexBoonsSeen.length}:${totalKills}:${state.meta.totalRuns}`;
    if (key !== this.lastRenderKey) {
      this.lastRenderKey = key;
      this.renderCodex(state, totalKills);
    }
  }

  private renderCodex(state: SimState, totalKills: number): void {
    this.codexSeenBadge.textContent = `BOONS SEEN: ${state.meta.codexBoonsSeen.length}`;
    this.codexKillsBadge.textContent = `LIFETIME KILLS: ${totalKills}`;

    this.codexTabButtons.forEach((btn) => {
      btn.classList.toggle('kh-active', btn.dataset.codexTab === this.activeCodexTab);
    });

    this.codexBodyEl.innerHTML = '';

    if (this.activeCodexTab === 'build') {
      this.renderBuildTab(state);
    } else if (this.activeCodexTab === 'bestiary') {
      this.renderBestiaryTab(state);
    } else {
      this.renderArchiveTab(state);
    }
  }

  private renderBuildTab(state: SimState): void {
    const weapon = WEAPON_CONSTANTS[state.player.weaponId];
    const aspect = ASPECT_DEFS[state.player.aspectId];

    const armCard = document.createElement('div');
    armCard.className = 'kh-weapon-summary';

    const armHead = document.createElement('div');
    armHead.className = 'kh-weapon-banner-head';
    const emblem = document.createElement('div');
    emblem.className = 'kh-weapon-emblem-medallion';
    emblem.innerHTML = svgWeaponSilhouette(state.player.weaponId, 28);
    const armText = document.createElement('div');
    armText.className = 'kh-weapon-banner-text';
    armText.innerHTML = `<span class="kh-weapon-banner-name">${weapon.displayName}</span><span class="kh-weapon-banner-sub">${aspect.displayName}</span>`;
    armHead.append(emblem, armText);

    const hammerRow = document.createElement('div');
    hammerRow.className = 'kh-weapon-stat-chips';
    if (state.player.hammers.length === 0) {
      const none = document.createElement('span');
      none.className = 'kh-stat-badge';
      none.textContent = 'NO FORGE HAMMERS ACTIVE';
      hammerRow.appendChild(none);
    } else {
      for (const hid of state.player.hammers) {
        const chip = document.createElement('span');
        chip.className = 'kh-stat-badge kh-hammer-badge';
        chip.textContent = `⚒ ${HAMMER_DEFS[hid].displayName}`;
        hammerRow.appendChild(chip);
      }
    }
    armCard.append(armHead, hammerRow);
    this.codexBodyEl.appendChild(armCard);

    // Active Boons Grid
    const boonTitle = document.createElement('div');
    boonTitle.className = 'kh-debug-section-title';
    boonTitle.textContent = `Active Run Boons (${state.player.boons.length})`;
    this.codexBodyEl.appendChild(boonTitle);

    const grid = document.createElement('div');
    grid.className = 'kh-codex-grid';

    if (state.player.boons.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'kh-codex-entry kh-codex-empty';
      empty.textContent = 'No active Patron Boons yet in this run.';
      grid.appendChild(empty);
    } else {
      for (const boon of state.player.boons) {
        const patron = PATRON_CONSTANTS[boon.patronId];
        const entry = document.createElement('div');
        entry.className = 'kh-codex-entry';
        entry.style.borderLeft = `3px solid ${patron.colorHex}`;

        const headRow = document.createElement('div');
        headRow.className = 'kh-codex-entry-head';
        const sig = document.createElement('span');
        sig.style.color = patron.colorHex;
        sig.innerHTML = svgPatronSigil(boon.patronId, 16);
        const head = document.createElement('span');
        head.className = 'kh-codex-entry-title';
        head.style.color = patron.colorHex;
        head.textContent = `${boon.name} (Lv.${boon.level})`;
        headRow.append(sig, head);

        const sub = document.createElement('div');
        sub.className = 'kh-codex-entry-sub';
        sub.textContent = `${patron.displayName} · ${boon.slot.toUpperCase()} · ${boon.rarity.toUpperCase()}`;

        const desc = document.createElement('div');
        desc.className = 'kh-codex-entry-desc';
        desc.textContent = boon.description;

        entry.append(headRow, sub, desc);
        grid.appendChild(entry);
      }
    }
    this.codexBodyEl.appendChild(grid);

    // Pantheon Overview
    const pantheonTitle = document.createElement('div');
    pantheonTitle.className = 'kh-debug-section-title';
    pantheonTitle.textContent = 'Pantheon Patrons (10)';
    this.codexBodyEl.appendChild(pantheonTitle);

    const pGrid = document.createElement('div');
    pGrid.className = 'kh-codex-grid';
    for (const pid of PATRON_LIST) {
      const p = PATRON_CONSTANTS[pid];
      const seenCount = state.meta.codexBoonsSeen.filter((bid) => bid.startsWith(pid)).length;
      const entry = document.createElement('div');
      entry.className = 'kh-codex-entry';
      entry.style.borderLeft = `3px solid ${p.colorHex}`;

      const headRow = document.createElement('div');
      headRow.className = 'kh-codex-entry-head';
      const sig = document.createElement('span');
      sig.style.color = p.colorHex;
      sig.innerHTML = svgPatronSigil(pid, 16);
      const name = document.createElement('span');
      name.className = 'kh-codex-entry-title';
      name.style.color = p.colorHex;
      name.textContent = p.displayName;
      headRow.append(sig, name);

      const detail = document.createElement('div');
      detail.className = 'kh-codex-entry-desc';
      detail.textContent = `${p.title}${p.primaryStatus ? ` · ${p.primaryStatus.toUpperCase()}` : ''} (${seenCount} seen)`;
      entry.append(headRow, detail);
      pGrid.appendChild(entry);
    }
    this.codexBodyEl.appendChild(pGrid);
  }

  private renderBestiaryTab(state: SimState): void {
    const entries = Object.entries(state.meta.codexKills)
      .filter(([, count]) => (count ?? 0) > 0)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

    const grid = document.createElement('div');
    grid.className = 'kh-codex-grid';

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'kh-codex-entry kh-codex-empty';
      empty.textContent = 'Defeat underworld foes and wardens to populate the Foe Kill Log.';
      grid.appendChild(empty);
    } else {
      for (const [id, count] of entries) {
        const isBoss = id in BOSS_CONSTANTS;
        const card = document.createElement('div');
        card.className = isBoss ? 'kh-codex-entry kh-codex-boss' : 'kh-codex-entry';
        const name = document.createElement('div');
        name.className = 'kh-codex-entry-title';
        name.style.color = isBoss ? '#fff0b8' : '#f7eedb';
        name.textContent = `${isBoss ? '♛ ' : ''}${formatArchetypeName(id as EnemyArchetypeId)}`;

        const kills = document.createElement('div');
        kills.className = 'kh-codex-kills';
        kills.textContent = `Vanquished: ${count}`;

        card.append(name, kills);
        grid.appendChild(card);
      }
    }

    this.codexBodyEl.appendChild(grid);
  }

  private renderArchiveTab(state: SimState): void {
    const meta = state.meta;
    const clampedDeaths = Math.min(PLAYER_CONSTANTS.godModeMaxDeaths, Math.max(0, meta.godModeDeaths));
    const drPct = Math.round(
      (1 - (PLAYER_CONSTANTS.godModeBaseMultiplier - clampedDeaths * PLAYER_CONSTANTS.godModePerDeathStep)) *
        100
    );

    const statsGrid = document.createElement('div');
    statsGrid.className = 'kh-stats-grid';
    const statRows: [string, string][] = [
      ['Total Runs', String(meta.totalRuns)],
      ['Successful Escapes', String(meta.totalClears)],
      ['Total Deaths', String(meta.totalDeaths)],
      ['Best Escape Time', formatDuration(meta.bestClearTimeSeconds)],
      ['Highest Heat Cleared', String(meta.highestHeatCleared)],
      ['God Mode Resist', meta.godModeEnabled ? `ON (${drPct}%)` : `OFF (${drPct}%)`],
    ];
    for (const [label, val] of statRows) {
      const card = document.createElement('div');
      card.className = 'kh-stat-card';
      const k = document.createElement('span');
      k.className = 'kh-stat-key';
      k.textContent = label;
      const v = document.createElement('span');
      v.className = 'kh-stat-val';
      v.textContent = val;
      card.append(k, v);
      statsGrid.appendChild(card);
    }
    this.codexBodyEl.appendChild(statsGrid);

    const vaultTitle = document.createElement('div');
    vaultTitle.className = 'kh-debug-section-title';
    vaultTitle.textContent = 'Sanctum Vault Currencies';
    this.codexBodyEl.appendChild(vaultTitle);

    const vaultGrid = document.createElement('div');
    vaultGrid.className = 'kh-codex-grid';
    const vaultRows: [string, number][] = [
      ['Darkness', meta.darkness],
      ['Gemstones', meta.gemstones],
      ['Chthonic Keys', meta.keys],
      ['Nectar', meta.nectar],
      ['Titan Blood', meta.titanBlood],
      ['Diamonds', meta.diamonds],
      ['Ambrosia', meta.ambrosia],
    ];
    for (const [label, val] of vaultRows) {
      const card = document.createElement('div');
      card.className = 'kh-codex-entry';
      card.innerHTML = `<span class="kh-stat-key">${label}</span><span class="kh-stat-val">${Math.floor(val)}</span>`;
      vaultGrid.appendChild(card);
    }
    this.codexBodyEl.appendChild(vaultGrid);

    const activeVows = Object.entries(meta.shrineVows).filter(([, rank]) => (rank ?? 0) > 0);
    if (activeVows.length > 0) {
      const vowTitle = document.createElement('div');
      vowTitle.className = 'kh-debug-section-title';
      vowTitle.textContent = `Active Shrine Vows (${activeVows.length})`;
      this.codexBodyEl.appendChild(vowTitle);

      const vowStrip = document.createElement('div');
      vowStrip.className = 'kh-weapon-stat-chips';
      for (const [vid, rank] of activeVows) {
        const chip = document.createElement('span');
        chip.className = 'kh-stat-badge kh-hammer-badge';
        chip.textContent = `${SHRINE_VOWS[vid as ShrineVowId].displayName} (${rank})`;
        vowStrip.appendChild(chip);
      }
      this.codexBodyEl.appendChild(vowStrip);
    }
  }
}
