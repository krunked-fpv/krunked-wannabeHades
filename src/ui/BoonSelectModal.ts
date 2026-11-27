import {
  PATRON_CONSTANTS,
  type BoonOffer,
  type BoonRarity,
  type InputSource,
  type PatronId,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';

export interface BoonSelectCallbacks {
  onSelectBoon(index: number): void;
  onRerollBoon(): void;
  getPortraitUrl(patronId: PatronId): string;
}

const RARITY_DISPLAY: Record<BoonRarity, { label: string; color: string }> = {
  common: { label: 'COMMON', color: '#c4ab8e' },
  rare: { label: 'RARE', color: '#58a8ff' },
  epic: { label: 'EPIC', color: '#c580ff' },
  heroic: { label: 'HEROIC', color: '#ff6670' },
  duo: { label: 'DUO', color: '#4ef2a0' },
  legendary: { label: 'LEGENDARY', color: '#ffc247' },
};

const SOURCE_FALLBACK_META: Record<
  BoonOffer['source'],
  { name: string; title: string; color: string; glyph: string }
> = {
  patron: { name: 'Divine Patron', title: 'Blessing of the Pantheon', color: '#f5cb70', glyph: '✦' },
  hammer: { name: 'Forge Hammer', title: 'Infernal Arm Augmentation', color: '#ff9b42', glyph: '⚒' },
  pom: { name: 'Pomegranate', title: 'Amplify Existing Boon', color: '#ff5268', glyph: '❖' },
  chaos: { name: 'Abyssos', title: 'Primordial Void', color: '#8f52ff', glyph: '◈' },
  well: { name: 'Well of Ash', title: 'Fleeting Underworld Ware', color: '#5ef2d6', glyph: '✧' },
};

export class BoonSelectModal {
  private readonly backdrop: HTMLDivElement;
  private readonly callbacks: BoonSelectCallbacks;

  private readonly portraitCol: HTMLDivElement;
  private readonly portraitImg: HTMLImageElement;
  private readonly portraitFallback: HTMLDivElement;
  private readonly emblemEl: HTMLDivElement;
  private readonly patronNameEl: HTMLHeadingElement;
  private readonly patronTitleEl: HTMLDivElement;

  private readonly offerTitleEl: HTMLHeadingElement;
  private readonly offerHintEl: HTMLSpanElement;
  private readonly cardsList: HTMLDivElement;
  private readonly rerollBtn: HTMLButtonElement;

  private visible = false;
  private currentOffer: BoonOffer | null = null;
  private lastOfferSignature = '';
  private cardButtons: HTMLButtonElement[] = [];
  private focusedIndex = 0;

  private readonly onKeyDown = (ev: KeyboardEvent): void => {
    if (!this.visible || !this.currentOffer) {
      return;
    }
    const optCount = this.currentOffer.options.length;
    if (ev.code === 'Digit1' || ev.code === 'Numpad1') {
      if (optCount >= 1) {
        ev.preventDefault();
        this.callbacks.onSelectBoon(0);
      }
    } else if (ev.code === 'Digit2' || ev.code === 'Numpad2') {
      if (optCount >= 2) {
        ev.preventDefault();
        this.callbacks.onSelectBoon(1);
      }
    } else if (ev.code === 'Digit3' || ev.code === 'Numpad3') {
      if (optCount >= 3) {
        ev.preventDefault();
        this.callbacks.onSelectBoon(2);
      }
    } else if (ev.code === 'KeyR') {
      if (this.currentOffer.rerollsRemaining > 0) {
        ev.preventDefault();
        this.callbacks.onRerollBoon();
      }
    }
  };

  constructor(uiRoot: HTMLElement, callbacks: BoonSelectCallbacks) {
    this.callbacks = callbacks;

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'kh-modal-backdrop kh-hidden';
    this.backdrop.setAttribute('data-screen', 'boon_select');

    const shell = document.createElement('div');
    shell.className = 'kh-boon-shell';

    // Left column: Large Patron Comic-Ink Portrait
    this.portraitCol = document.createElement('div');
    this.portraitCol.className = 'kh-boon-portrait-col';

    this.portraitFallback = document.createElement('div');
    this.portraitFallback.className = 'kh-boon-portrait-fallback';
    this.emblemEl = document.createElement('div');
    this.emblemEl.className = 'kh-boon-emblem';
    this.portraitFallback.appendChild(this.emblemEl);

    this.portraitImg = document.createElement('img');
    this.portraitImg.className = 'kh-boon-portrait-img kh-hidden';
    this.portraitImg.alt = 'Patron Portrait';
    this.portraitImg.addEventListener('load', () => {
      this.portraitImg.classList.remove('kh-hidden');
      this.portraitFallback.classList.add('kh-hidden');
    });
    this.portraitImg.addEventListener('error', () => {
      this.portraitImg.classList.add('kh-hidden');
      this.portraitFallback.classList.remove('kh-hidden');
    });

    const patronPlate = document.createElement('div');
    patronPlate.className = 'kh-boon-patron-plate';
    this.patronNameEl = document.createElement('h2');
    this.patronNameEl.className = 'kh-boon-patron-name';
    this.patronTitleEl = document.createElement('div');
    this.patronTitleEl.className = 'kh-boon-patron-title';
    patronPlate.append(this.patronNameEl, this.patronTitleEl);

    this.portraitCol.append(this.portraitFallback, this.portraitImg, patronPlate);

    // Right column: Header + 3 ornate rarity-colored Boon cards + Fated Persuasion Reroll
    const cardsCol = document.createElement('div');
    cardsCol.className = 'kh-boon-cards-col';

    const head = document.createElement('div');
    head.className = 'kh-boon-offer-head';
    this.offerTitleEl = document.createElement('h3');
    this.offerTitleEl.className = 'kh-boon-offer-title';
    this.offerHintEl = document.createElement('span');
    this.offerHintEl.className = 'kh-boon-offer-hint';
    head.append(this.offerTitleEl, this.offerHintEl);

    const meander = document.createElement('div');
    meander.className = 'kh-meander-strip';

    this.cardsList = document.createElement('div');
    this.cardsList.className = 'kh-boon-list';

    const footer = document.createElement('div');
    footer.className = 'kh-boon-footer';

    this.rerollBtn = document.createElement('button');
    this.rerollBtn.type = 'button';
    this.rerollBtn.className = 'kh-btn';
    this.rerollBtn.addEventListener('click', () => {
      if (this.currentOffer && this.currentOffer.rerollsRemaining > 0) {
        this.callbacks.onRerollBoon();
      }
    });
    this.rerollBtn.addEventListener('pointerenter', () => {
      if (this.currentOffer && this.currentOffer.rerollsRemaining > 0) {
        this.focusedIndex = this.cardButtons.length;
        this.applyFocusStyles();
      }
    });

    footer.appendChild(this.rerollBtn);
    cardsCol.append(head, meander, this.cardsList, footer);

    shell.append(this.portraitCol, cardsCol);
    this.backdrop.appendChild(shell);
    uiRoot.appendChild(this.backdrop);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
    }
  }

  public update(
    isVisible: boolean,
    offer: BoonOffer | null,
    activeSource: InputSource,
    menuNav: MenuNavInput
  ): void {
    const shouldShow = isVisible && offer !== null && offer.options.length > 0;
    if (this.visible !== shouldShow) {
      this.visible = shouldShow;
      this.backdrop.classList.toggle('kh-hidden', !shouldShow);
      if (shouldShow) {
        this.focusedIndex = 0;
      }
    }

    if (!shouldShow || !offer) {
      this.currentOffer = null;
      return;
    }

    this.currentOffer = offer;

    // Update control hint based on active device
    const hintText =
      activeSource === 'gamepad'
        ? 'D-PAD / LS Choose · A Accept'
        : activeSource === 'touch'
          ? 'Tap a Blessing to Claim'
          : '1 / 2 / 3 or ↑↓ + ENTER · R Reroll';
    if (this.offerHintEl.textContent !== hintText) {
      this.offerHintEl.textContent = hintText;
    }

    const sig = `${offer.source}:${offer.patronId ?? ''}:${offer.title}:${offer.rerollsRemaining}:${offer.options
      .map((o) => `${o.id}:${o.rarity}:${o.previewValue ?? ''}`)
      .join('|')}`;
    if (sig !== this.lastOfferSignature) {
      this.lastOfferSignature = sig;
      this.renderOffer(offer);
    }

    // D-Pad / Arrow + Confirm navigation (includes Reroll button if charges > 0)
    const canReroll = offer.rerollsRemaining > 0;
    const totalFocusable = this.cardButtons.length + (canReroll ? 1 : 0);
    if (totalFocusable > 0) {
      if (this.focusedIndex >= totalFocusable) {
        this.focusedIndex = 0;
        this.applyFocusStyles();
      }
      if (menuNav.up || menuNav.left) {
        this.focusedIndex = (this.focusedIndex - 1 + totalFocusable) % totalFocusable;
        this.applyFocusStyles();
      } else if (menuNav.down || menuNav.right) {
        this.focusedIndex = (this.focusedIndex + 1) % totalFocusable;
        this.applyFocusStyles();
      }
      if (menuNav.confirm) {
        if (this.focusedIndex < this.cardButtons.length) {
          this.callbacks.onSelectBoon(this.focusedIndex);
        } else if (canReroll) {
          this.callbacks.onRerollBoon();
        }
      }
    }
  }

  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
    }
    this.backdrop.remove();
  }

  private renderOffer(offer: BoonOffer): void {
    const patronId = offer.patronId ?? (offer.source === 'chaos' ? 'abyssos' : undefined);
    const patronDef = patronId ? PATRON_CONSTANTS[patronId] : undefined;
    const fallback = SOURCE_FALLBACK_META[offer.source];

    const accentColor = patronDef?.colorHex ?? fallback.color;
    this.patronNameEl.textContent = patronDef?.displayName ?? fallback.name;
    this.patronNameEl.style.color = accentColor;
    this.patronTitleEl.textContent = offer.subtitle ?? patronDef?.title ?? fallback.title;
    this.offerTitleEl.textContent = offer.title || 'CHOOSE A BLESSING';

    this.portraitCol.style.borderColor = accentColor;
    this.portraitCol.style.background = `radial-gradient(circle at 50% 35%, ${accentColor}33, rgba(10, 8, 16, 0.96) 76%)`;
    this.emblemEl.style.color = accentColor;
    this.emblemEl.textContent = patronDef ? patronDef.displayName.charAt(0).toUpperCase() : fallback.glyph;

    // Load comic-ink Patron portrait via callbacks.getPortraitUrl(patronId)
    if (patronId) {
      const url = this.callbacks.getPortraitUrl(patronId);
      if (url) {
        this.portraitImg.src = url;
        this.portraitImg.alt = `${patronDef?.displayName ?? patronId} Portrait`;
      } else {
        this.portraitImg.removeAttribute('src');
        this.portraitImg.classList.add('kh-hidden');
        this.portraitFallback.classList.remove('kh-hidden');
      }
    } else {
      this.portraitImg.removeAttribute('src');
      this.portraitImg.classList.add('kh-hidden');
      this.portraitFallback.classList.remove('kh-hidden');
    }

    // Build ornate rarity-colored Boon cards
    this.cardsList.innerHTML = '';
    this.cardButtons = [];

    offer.options.forEach((opt, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'kh-boon-card';
      card.dataset.rarity = opt.rarity;
      card.dataset.boonIndex = String(idx);

      const rarityInfo = RARITY_DISPLAY[opt.rarity] ?? RARITY_DISPLAY.common;

      const top = document.createElement('div');
      top.className = 'kh-boon-card-top';

      const titleRow = document.createElement('div');
      titleRow.className = 'kh-boon-card-title-row';

      const hotkey = document.createElement('span');
      hotkey.className = 'kh-boon-hotkey';
      hotkey.textContent = String(idx + 1);

      const nameEl = document.createElement('span');
      nameEl.className = 'kh-boon-name';
      nameEl.textContent = opt.name;

      titleRow.append(hotkey, nameEl);

      const badges = document.createElement('div');
      badges.className = 'kh-boon-badges';

      const slotTag = document.createElement('span');
      slotTag.className = 'kh-boon-slot-tag';
      slotTag.textContent = (opt.slot ?? opt.kind.replace('_', ' ')).toUpperCase();

      const rarityPill = document.createElement('span');
      rarityPill.className = 'kh-boon-rarity-pill';
      rarityPill.textContent = rarityInfo.label;
      rarityPill.style.color = rarityInfo.color;
      rarityPill.style.border = `1px solid ${rarityInfo.color}88`;

      badges.append(slotTag, rarityPill);
      top.append(titleRow, badges);

      const desc = document.createElement('p');
      desc.className = 'kh-boon-desc';
      desc.textContent = opt.description;

      card.append(top, desc);

      if (opt.previewValue || opt.replacesBoonId || opt.curseDescription) {
        const metaRow = document.createElement('div');
        metaRow.className = 'kh-boon-meta-row';

        if (opt.previewValue) {
          const stat = document.createElement('span');
          stat.className = 'kh-boon-stat';
          stat.textContent = `▸ ${opt.previewValue}`;
          metaRow.appendChild(stat);
        }

        if (opt.replacesBoonId) {
          const rep = document.createElement('span');
          rep.className = 'kh-boon-replace';
          rep.textContent = '⇄ REPLACES CURRENT SLOT';
          metaRow.appendChild(rep);
        }

        if (opt.curseDescription) {
          const curse = document.createElement('span');
          curse.className = 'kh-boon-curse';
          const enc = opt.curseEncounters ? ` (${opt.curseEncounters} Chambers)` : '';
          curse.textContent = `✦ VOID CURSE${enc}: ${opt.curseDescription}`;
          metaRow.appendChild(curse);
        }

        card.appendChild(metaRow);
      }

      card.addEventListener('click', () => this.callbacks.onSelectBoon(idx));
      card.addEventListener('pointerenter', () => {
        this.focusedIndex = idx;
        this.applyFocusStyles();
      });

      this.cardsList.appendChild(card);
      this.cardButtons.push(card);
    });

    // Fated Persuasion Reroll Button
    const rerolls = Math.max(0, offer.rerollsRemaining);
    this.rerollBtn.disabled = rerolls <= 0;
    this.rerollBtn.textContent =
      rerolls > 0
        ? `⚄ FATED PERSUASION REROLL [R] (${rerolls})`
        : '⚄ FATED PERSUASION (0 LEFT)';

    this.focusedIndex = 0;
    this.applyFocusStyles();
  }

  private applyFocusStyles(): void {
    this.cardButtons.forEach((btn, idx) => {
      btn.classList.toggle('kh-focused', idx === this.focusedIndex);
    });
    this.rerollBtn.classList.toggle(
      'kh-focused',
      !this.rerollBtn.disabled && this.focusedIndex === this.cardButtons.length
    );
  }
}
