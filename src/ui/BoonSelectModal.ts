import {
  PATRON_CONSTANTS,
  type BoonOffer,
  type BoonRarity,
  type InputSource,
  type PatronId,
} from '../contracts/index.js';
import type { MenuNavInput } from '../input/InputManager.js';
import { getPaintedPatronSigilUrl } from '../assets/PaintedArtLoader.js';
import { attachCornerFiligrees, svgPatronSigil, svgSourceEmblem } from './svgArt.js';

export interface BoonSelectCallbacks {
  onSelectBoon(index: number): void;
  onRerollBoon(): void;
  getPortraitUrl(patronId: PatronId): string;
  readonly onUiHover?: () => void;
}

const RARITY_DISPLAY: Record<BoonRarity, { label: string; color: string }> = {
  common: { label: 'COMMON', color: '#b8ada0' },
  rare: { label: 'RARE', color: '#3ea4ff' },
  epic: { label: 'EPIC', color: '#b25cff' },
  heroic: { label: 'HEROIC', color: '#ff465a' },
  duo: { label: 'DUO', color: '#c9f238' },
  legendary: { label: 'LEGENDARY', color: '#ffae24' },
};

const SOURCE_FALLBACK_META: Record<
  BoonOffer['source'],
  { name: string; title: string; color: string }
> = {
  patron: { name: 'Divine Patron', title: 'Blessing of the Pantheon', color: '#e5b952' },
  hammer: { name: 'Forge Hammer', title: 'Infernal Arm Augmentation', color: '#ff9b42' },
  pom: { name: 'Pomegranate', title: 'Amplify Existing Boon', color: '#ff465a' },
  chaos: { name: 'Abyssos', title: 'Primordial Void', color: '#a060ff' },
  well: { name: 'Well of Ash', title: 'Fleeting Underworld Ware', color: '#44e6b8' },
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
  private readonly headerWatermarkEl: HTMLDivElement;

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
    shell.className = 'kh-boon-shell kh-ornate-frame';
    attachCornerFiligrees(shell);

    // Left column: Tall Sculpted Patron Showcase Frame
    this.portraitCol = document.createElement('div');
    this.portraitCol.className = 'kh-boon-portrait-col';
    attachCornerFiligrees(this.portraitCol);

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

    // Right column: Header with Patron Sigil Watermark + 3 Staggered Rarity Cards + Reroll
    const cardsCol = document.createElement('div');
    cardsCol.className = 'kh-boon-cards-col';

    const head = document.createElement('div');
    head.className = 'kh-boon-offer-head';
    this.headerWatermarkEl = document.createElement('div');
    this.headerWatermarkEl.className = 'kh-boon-header-watermark';
    this.headerWatermarkEl.setAttribute('aria-hidden', 'true');
    this.offerTitleEl = document.createElement('h3');
    this.offerTitleEl.className = 'kh-boon-offer-title';
    this.offerHintEl = document.createElement('span');
    this.offerHintEl.className = 'kh-boon-offer-hint';
    head.append(this.headerWatermarkEl, this.offerTitleEl, this.offerHintEl);

    const meander = document.createElement('div');
    meander.className = 'kh-meander-strip';

    this.cardsList = document.createElement('div');
    this.cardsList.className = 'kh-boon-list';

    const footer = document.createElement('div');
    footer.className = 'kh-boon-footer';

    this.rerollBtn = document.createElement('button');
    this.rerollBtn.type = 'button';
    this.rerollBtn.className = 'kh-btn kh-btn-notched';
    this.rerollBtn.addEventListener('click', () => {
      if (this.currentOffer && this.currentOffer.rerollsRemaining > 0) {
        this.callbacks.onRerollBoon();
      }
    });
    this.rerollBtn.addEventListener('pointerenter', () => {
      if (this.currentOffer && this.currentOffer.rerollsRemaining > 0) {
        if (this.focusedIndex !== this.cardButtons.length) {
          this.focusedIndex = this.cardButtons.length;
          this.applyFocusStyles();
          this.callbacks.onUiHover?.();
        }
      }
    });
    this.rerollBtn.addEventListener('focus', () => {
      if (this.currentOffer && this.currentOffer.rerollsRemaining > 0) {
        if (this.focusedIndex !== this.cardButtons.length) {
          this.focusedIndex = this.cardButtons.length;
          this.applyFocusStyles();
          this.callbacks.onUiHover?.();
        }
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
        // Re-trigger showcase entrance motion cleanly
        this.portraitCol.classList.remove('kh-portrait-enter');
        void this.portraitCol.offsetWidth;
        this.portraitCol.classList.add('kh-portrait-enter');
      }
    }

    if (!shouldShow || !offer) {
      this.currentOffer = null;
      return;
    }

    this.currentOffer = offer;

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

    const canReroll = offer.rerollsRemaining > 0;
    const totalFocusable = this.cardButtons.length + (canReroll ? 1 : 0);
    if (totalFocusable > 0) {
      if (this.focusedIndex >= totalFocusable) {
        this.focusedIndex = 0;
        this.applyFocusStyles();
      }
      const prevIdx = this.focusedIndex;
      if (menuNav.up || menuNav.left) {
        this.focusedIndex = (this.focusedIndex - 1 + totalFocusable) % totalFocusable;
      } else if (menuNav.down || menuNav.right) {
        this.focusedIndex = (this.focusedIndex + 1) % totalFocusable;
      }
      if (this.focusedIndex !== prevIdx) {
        this.applyFocusStyles();
        this.callbacks.onUiHover?.();
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
    this.portraitCol.style.setProperty('--kh-patron-accent', accentColor);
    this.portraitCol.style.background = `radial-gradient(circle at 50% 32%, ${accentColor}3a, rgba(17, 11, 24, 0.96) 76%)`;
    this.portraitCol.style.boxShadow = `inset 0 0 28px ${accentColor}2e, 0 12px 32px rgba(0, 0, 0, 0.72)`;

    this.emblemEl.style.color = accentColor;
    this.emblemEl.innerHTML = patronId
      ? svgPatronSigil(patronId, 52)
      : svgSourceEmblem(offer.source, 52);

    this.headerWatermarkEl.style.color = accentColor;
    this.headerWatermarkEl.innerHTML = patronId
      ? svgPatronSigil(patronId, 58)
      : svgSourceEmblem(offer.source, 58);

    // Load comic-ink Patron portrait via callbacks.getPortraitUrl(patronId)
    if (patronId) {
      const url = this.callbacks.getPortraitUrl(patronId);
      if (url) {
        this.portraitImg.alt = `${patronDef?.displayName ?? patronId} Portrait`;
        if (this.portraitImg.getAttribute('src') !== url) {
          this.portraitImg.src = url;
        }
        if (this.portraitImg.complete && this.portraitImg.naturalWidth > 0) {
          this.portraitImg.classList.remove('kh-hidden');
          this.portraitFallback.classList.add('kh-hidden');
        }
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

    // Build 3 ornate staggered-entrance rarity-coded Boon cards
    this.cardsList.innerHTML = '';
    this.cardButtons = [];

    offer.options.forEach((opt, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'kh-boon-card kh-boon-card-enter';
      card.dataset.rarity = opt.rarity;
      card.dataset.boonIndex = String(idx);
      card.style.setProperty('--kh-card-delay', `${idx * 65}ms`);

      const optPatronId = opt.patronId ?? patronId;
      const optAccent = optPatronId ? PATRON_CONSTANTS[optPatronId].colorHex : accentColor;
      const rarityInfo = RARITY_DISPLAY[opt.rarity] ?? RARITY_DISPLAY.common;

      // Rarity foil shimmer sheen overlay
      const shimmer = document.createElement('span');
      shimmer.className = 'kh-boon-shimmer';
      shimmer.setAttribute('aria-hidden', 'true');
      card.appendChild(shimmer);

      const layout = document.createElement('div');
      layout.className = 'kh-boon-card-layout';

      // Left sculpted Patron Sigil Medallion (hand-painted hammered-gold enamel crest w/ SVG fallback)
      const sigilBadge = document.createElement('div');
      sigilBadge.className = 'kh-boon-card-sigil';
      sigilBadge.style.color = optAccent;
      sigilBadge.style.borderColor = rarityInfo.color;
      if (optPatronId) {
        const sigImg = document.createElement('img');
        sigImg.className = 'kh-boon-sigil-img';
        sigImg.alt = '';
        sigImg.src = getPaintedPatronSigilUrl(optPatronId);
        sigImg.addEventListener('error', () => {
          sigilBadge.innerHTML = svgPatronSigil(optPatronId, 28);
        });
        sigilBadge.appendChild(sigImg);
      } else {
        sigilBadge.innerHTML = svgSourceEmblem(offer.source, 28);
      }

      const body = document.createElement('div');
      body.className = 'kh-boon-card-body';

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
      rarityPill.style.borderColor = `${rarityInfo.color}99`;

      badges.append(slotTag, rarityPill);
      top.append(titleRow, badges);

      const desc = document.createElement('p');
      desc.className = 'kh-boon-desc';
      desc.textContent = opt.description;

      body.append(top, desc);

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

        body.appendChild(metaRow);
      }

      layout.append(sigilBadge, body);
      card.appendChild(layout);

      card.addEventListener('click', () => this.callbacks.onSelectBoon(idx));
      card.addEventListener('pointerenter', () => {
        if (this.focusedIndex !== idx) {
          this.focusedIndex = idx;
          this.applyFocusStyles();
          this.callbacks.onUiHover?.();
        }
      });
      card.addEventListener('focus', () => {
        if (this.focusedIndex !== idx) {
          this.focusedIndex = idx;
          this.applyFocusStyles();
          this.callbacks.onUiHover?.();
        }
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
