import type { BoonOffer, PatronId, WeaponId } from '../contracts/index.js';

/**
 * Shared Sculpted Greco-Roman Bronze, Obsidian, Crimson & Hammered-Gold SVG Art Library.
 * Consumed by TitleScreen, HudOverlay, BoonSelectModal, and all Hub/System Modals.
 */

export function svgCornerFiligree(corner: 'tl' | 'tr' | 'bl' | 'br' = 'tl'): string {
  const transforms: Record<'tl' | 'tr' | 'bl' | 'br', string> = {
    tl: '',
    tr: 'scale(-1,1) translate(-28,0)',
    bl: 'scale(1,-1) translate(0,-28)',
    br: 'scale(-1,-1) translate(-28,-28)',
  };
  const tf = transforms[corner];
  const groupOpen = tf ? `<g transform="${tf}">` : '<g>';
  return `<svg class="kh-svg-corner" viewBox="0 0 28 28" width="22" height="22" fill="none" aria-hidden="true">${groupOpen}<path d="M2 24V4.5L4.5 2H24" stroke="#e5b952" stroke-width="2" stroke-linecap="square"/><path d="M5.5 20V8H11V12H8.5V10.2" stroke="#9e6e2e" stroke-width="1.35" stroke-linecap="square"/><path d="M8 5.5H20" stroke="#9e6e2e" stroke-width="1.35"/><path d="M4.5 4.5L7.5 1.5L10.5 4.5L7.5 7.5Z" fill="#fff0b8" stroke="#09060e" stroke-width="1"/></g></svg>`;
}

export function attachCornerFiligrees(container: HTMLElement): void {
  const corners: readonly ('tl' | 'tr' | 'bl' | 'br')[] = ['tl', 'tr', 'bl', 'br'];
  for (const c of corners) {
    const span = document.createElement('span');
    span.className = `kh-corner-ornament kh-corner-${c}`;
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = svgCornerFiligree(c);
    container.appendChild(span);
  }
}

export function svgTitleCrest(): string {
  return `<svg class="kh-svg-title-crest" viewBox="0 0 180 68" width="164" height="62" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="khCrestGold" x1="90" y1="4" x2="90" y2="62" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#fff4c4"/>
        <stop offset="52%" stop-color="#e5b952"/>
        <stop offset="100%" stop-color="#8a561a"/>
      </linearGradient>
      <linearGradient id="khCrestCrimson" x1="90" y1="12" x2="90" y2="56" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f02e46"/>
        <stop offset="100%" stop-color="#5a0b1a"/>
      </linearGradient>
    </defs>
    <!-- Crossed Infernal Blades -->
    <path d="M36 56L138 14L146 10L140 20L42 60Z" fill="url(#khCrestGold)" stroke="#09060e" stroke-width="2"/>
    <path d="M144 56L42 14L34 10L40 20L138 60Z" fill="url(#khCrestGold)" stroke="#09060e" stroke-width="2"/>
    <!-- Swept Greco-Roman Wings -->
    <path d="M72 34C54 22 30 22 10 30C24 34 38 35 50 38C34 40 22 44 16 48C34 48 54 45 70 42Z" fill="#1b1226" stroke="url(#khCrestGold)" stroke-width="1.8"/>
    <path d="M108 34C126 22 150 22 170 30C156 34 142 35 130 38C146 40 158 44 164 48C146 48 126 45 110 42Z" fill="#1b1226" stroke="url(#khCrestGold)" stroke-width="1.8"/>
    <!-- Golden Laurel Arc -->
    <path d="M62 52C52 38 56 18 76 11" stroke="#e5b952" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M118 52C128 38 124 18 104 11" stroke="#e5b952" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M56 38L49 34L54 43ZM59 26L53 21L57 31ZM67 16L62 10L65 20Z" fill="#fff0b8"/>
    <path d="M124 38L131 34L126 43ZM121 26L127 21L123 31ZM113 16L118 10L115 20Z" fill="#fff0b8"/>
    <!-- Central Obsidian-Crimson Heraldic Shield & Skull Crest -->
    <path d="M90 6L109 18L104 49L90 61L76 49L71 18Z" fill="url(#khCrestCrimson)" stroke="url(#khCrestGold)" stroke-width="2.4"/>
    <path d="M90 15C81.8 15 77 20.5 77 27.6C77 32 79.4 35.4 82.4 37.4V42.4C82.4 43.8 83.4 45 84.8 45H95.2C96.6 45 97.6 43.8 97.6 42.4V37.4C100.6 35.4 103 32 103 27.6C103 20.5 98.2 15 90 15Z" fill="url(#khCrestGold)" stroke="#09060e" stroke-width="2"/>
    <path d="M82.5 27.5L87.8 29.2L84.2 31.8Z" fill="#09060e"/>
    <path d="M97.5 27.5L92.2 29.2L95.8 31.8Z" fill="#09060e"/>
    <path d="M88.5 34.5L90 31.8L91.5 34.5Z" fill="#09060e"/>
    <path d="M86 39.5V44.2M90 39.5V44.2M94 39.5V44.2" stroke="#09060e" stroke-width="1.6"/>
    <!-- Crown Jewel -->
    <path d="M90 2L94 8L90 13L86 8Z" fill="#fff0b8" stroke="#09060e" stroke-width="1.2"/>
  </svg>`;
}

export function svgWingedHpFrame(side: 'left' | 'right' = 'left'): string {
  const flip = side === 'right' ? ' transform="scale(-1,1) translate(-28,0)"' : '';
  return `<svg class="kh-svg-hp-wing" viewBox="0 0 28 24" width="24" height="22" fill="none" aria-hidden="true"><g${flip}><path d="M26 3H12L2 8.5L13 10.5L5 14.5L15 16L9 20.5H26Z" fill="#1b1226" stroke="#e5b952" stroke-width="1.5" stroke-linejoin="round"/><path d="M25 6.5H13.5L7.5 9.2" stroke="#fff0b8" stroke-width="1.1"/><path d="M25 13H14.5L10.5 14.8" stroke="#9e6e2e" stroke-width="1.1"/><circle cx="22.5" cy="12" r="2.2" fill="#f02e46" stroke="#fff0b8" stroke-width="0.9"/></g></svg>`;
}

export function svgBloodstoneSocket(state: 'ready' | 'spent' | 'lodged'): string {
  if (state === 'ready') {
    return `<svg class="kh-svg-bloodstone kh-bs-ready" viewBox="0 0 20 24" width="16" height="19" fill="none" aria-hidden="true">
      <path d="M10 1.5L18 9.2L10 22.5L2 9.2Z" fill="#5a0b1a" stroke="#e5b952" stroke-width="1.6"/>
      <path d="M10 3.8L15.6 9.3L10 19.6L4.4 9.3Z" fill="#f02e46"/>
      <path d="M10 3.8L13.2 9.3L10 13.8L6.8 9.3Z" fill="#ff94a4"/>
      <path d="M10 3.8L10 19.6" stroke="#ffd8de" stroke-width="0.7" stroke-opacity="0.7"/>
      <path d="M3.5 7.5L1.2 10.5M16.5 7.5L18.8 10.5" stroke="#fff0b8" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`;
  }
  if (state === 'lodged') {
    return `<svg class="kh-svg-bloodstone kh-bs-lodged" viewBox="0 0 20 24" width="16" height="19" fill="none" aria-hidden="true">
      <path d="M10 1.5L18 9.2L10 22.5L2 9.2Z" fill="#1b1226" stroke="#e5b952" stroke-width="1.4" stroke-dasharray="2.5 1.8"/>
      <path d="M10 6.5L13.5 10L10 16.5L6.5 10Z" fill="#8f152b" fill-opacity="0.55" stroke="#ff6b7d" stroke-width="1"/>
    </svg>`;
  }
  return `<svg class="kh-svg-bloodstone kh-bs-spent" viewBox="0 0 20 24" width="16" height="19" fill="none" aria-hidden="true">
    <path d="M10 1.8L17.6 9.2L10 22.2L2.4 9.2Z" fill="#0d0814" stroke="#6f5430" stroke-width="1.4"/>
    <path d="M10 5.5L13.8 9.4L10 17L6.2 9.4Z" fill="#1a1224" stroke="#47341e" stroke-width="0.9"/>
  </svg>`;
}

export function svgDashWing(ready: boolean): string {
  if (ready) {
    return `<svg class="kh-svg-dash kh-dash-ready" viewBox="0 0 26 16" width="22" height="14" fill="none" aria-hidden="true">
      <path d="M2 13L11.5 2.5H24L18.2 7.2H22.2L13 13.5H2Z" fill="#46e0ff" stroke="#09060e" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M6.5 10.6L12.5 4.2H19.8" stroke="#fff4c4" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M3 13L11.5 2.5H24" stroke="#e5b952" stroke-width="1.1"/>
    </svg>`;
  }
  return `<svg class="kh-svg-dash kh-dash-spent" viewBox="0 0 26 16" width="22" height="14" fill="none" aria-hidden="true">
    <path d="M2 13L11.5 2.5H24L18.2 7.2H22.2L13 13.5H2Z" fill="#171122" stroke="#5c462b" stroke-width="1.3" stroke-linejoin="round"/>
  </svg>`;
}

export function svgBossCrownOrnament(side: 'left' | 'right' = 'left'): string {
  const flip = side === 'right' ? ' transform="scale(-1,1) translate(-34,0)"' : '';
  return `<svg class="kh-svg-boss-crown" viewBox="0 0 34 26" width="30" height="23" fill="none" aria-hidden="true"><g${flip}><path d="M32 4H15L3 1.5L10.5 9L2 13L11 16.5L5.5 23.5L17 20H32Z" fill="#21101d" stroke="#e5b952" stroke-width="1.6" stroke-linejoin="round"/><path d="M30 8.5H15L8.5 13L15 16.5H30Z" fill="#b81932" stroke="#09060e" stroke-width="1.1"/><path d="M23 10.2L26.2 13L23 15.8L19.8 13Z" fill="#fff0b8"/></g></svg>`;
}

export function svgPatronSigil(patronId: PatronId, size = 22): string {
  const open = `<svg class="kh-svg-patron-sigil" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">`;
  const close = '</svg>';
  switch (patronId) {
    case 'voltaris':
      // Jagged thunderbolt crest
      return `${open}<path d="M14.5 2L5.5 13H11.5L9.5 22L18.5 10.5H12.8L14.5 2Z" fill="currentColor" stroke="#09060e" stroke-width="1.5" stroke-linejoin="round"/><path d="M13 5L8.6 11.4H12.4" stroke="#fff7d6" stroke-width="1.1" stroke-linecap="round"/>${close}`;
    case 'tidebreaker':
      // Ornate trident & cresting wave
      return `${open}<path d="M12 2.5V21.5M12 2.5L9.6 6.2M12 2.5L14.4 6.2M6 5.5V10.8C6 13.6 8.6 15.2 12 15.2C15.4 15.2 18 13.6 18 10.8V5.5M6 5.5L4.3 8.2M18 5.5L19.7 8.2M8.5 18.8H15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="15.2" r="2.1" fill="#fff0b8" stroke="#09060e" stroke-width="1"/>${close}`;
    case 'aegira':
      // Owl-aegis winged shield
      return `${open}<path d="M12 2.5L20 6V12.2C20 16.8 16.5 20 12 21.8C7.5 20 4 16.8 4 12.2V6L12 2.5Z" fill="currentColor" fill-opacity="0.28" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8.4 9.5L12 12L15.6 9.5M12 6.5V17.5" stroke="#fff4c4" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.6" cy="11.8" r="1.2" fill="currentColor"/><circle cx="14.4" cy="11.8" r="1.2" fill="currentColor"/>${close}`;
    case 'velouris':
      // Thorny heart-rose
      return `${open}<path d="M12 20.8C12 20.8 4.2 15.8 4.2 9.8C4.2 6.8 6.4 4.6 9 4.6C10.5 4.6 11.5 5.4 12 6.6C12.5 5.4 13.5 4.6 15 4.6C17.6 4.6 19.8 6.8 19.8 9.8C19.8 15.8 12 20.8 12 20.8Z" fill="currentColor" stroke="#09060e" stroke-width="1.4"/><path d="M8.8 10.4C9.5 8.8 11.4 8.2 12.6 9.2C13.8 10.2 13.4 12.2 11.8 12.8C10.6 13.2 9.4 12.4 9.6 11.2" stroke="#fff2f8" stroke-width="1.3" stroke-linecap="round"/>${close}`;
    case 'sylvara':
      // Crescent moon & notched hunting arrow
      return `${open}<path d="M15.2 4.2C10.8 4.5 7.4 7.8 7.4 12C7.4 16.2 10.8 19.5 15.2 19.8C12.2 18.2 10.8 15.4 10.8 12C10.8 8.6 12.2 5.8 15.2 4.2Z" fill="currentColor" stroke="#09060e" stroke-width="1.2"/><path d="M4.5 19.5L19.5 4.5M14.2 4.5H19.5V9.8M4.5 19.5L7.8 18.8M4.5 19.5L5.2 16.2" stroke="#e4ffea" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${close}`;
    case 'bellum':
      // Crimson war-blade & spiked war-crest
      return `${open}<path d="M12 2L15.4 7.5L14.2 16.2H9.8L8.6 7.5L12 2Z" fill="currentColor" stroke="#09060e" stroke-width="1.4" stroke-linejoin="round"/><path d="M6.2 16.2H17.8M12 16.2V21.8M9.4 21.8H14.6M4 9.5L8.2 12M20 9.5L15.8 12" stroke="#fff0b8" stroke-width="1.8" stroke-linecap="round"/>${close}`;
    case 'bacchion':
      // Revelry wine chalice & vine gem
      return `${open}<path d="M6.2 4H17.8L16.4 10.8C15.9 13.2 14.1 14.8 12 14.8C9.9 14.8 8.1 13.2 7.6 10.8L6.2 4Z" fill="currentColor" stroke="#09060e" stroke-width="1.4"/><path d="M12 14.8V20.2M8.2 20.5H15.8" stroke="#e5b952" stroke-width="2" stroke-linecap="round"/><circle cx="10.2" cy="8.2" r="1.4" fill="#fff0f8"/><circle cx="13.8" cy="8.2" r="1.4" fill="#fff0f8"/><circle cx="12" cy="10.8" r="1.4" fill="#fff0f8"/>${close}`;
    case 'glaciera':
      // Six-point crystalline frost star
      return `${open}<path d="M12 2.2V21.8M3.5 7.1L20.5 16.9M20.5 7.1L3.5 16.9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.6 4.8L12 7L14.4 4.8M9.6 19.2L12 17L14.4 19.2M5.4 10.6L7.6 9.5L6.8 7M18.6 13.4L16.4 14.5L17.2 17M18.6 10.6L16.4 9.5L17.2 7M5.4 13.4L7.6 14.5L6.8 17" stroke="#eefaff" stroke-width="1.3" stroke-linecap="round"/><circle cx="12" cy="12" r="2.4" fill="#ffffff" stroke="currentColor" stroke-width="1.2"/>${close}`;
    case 'veloce':
      // Swept twin speed wings
      return `${open}<path d="M3 16.5C5.5 9.5 11.5 5.2 20.5 4.2C18 8.4 15.4 10.6 11.8 11.6C15.2 11.5 17.8 11.8 19.8 12.6C16.2 15.2 12.4 16.4 8.2 16.6C11.4 17.2 14 17.6 15.8 18.4C12.2 20.2 7.2 20.2 3 16.5Z" fill="currentColor" stroke="#09060e" stroke-width="1.4" stroke-linejoin="round"/><path d="M7.5 13.4C10.5 10.5 14 8.5 17.5 7.2" stroke="#fff5d4" stroke-width="1.2" stroke-linecap="round"/>${close}`;
    case 'abyssos':
      // Primordial void eye within cosmic rings
      return `${open}<path d="M2.5 12C5 7.4 8.4 5.5 12 5.5C15.6 5.5 19 7.4 21.5 12C19 16.6 15.6 18.5 12 18.5C8.4 18.5 5 16.6 2.5 12Z" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/><ellipse cx="12" cy="12" rx="1.2" ry="2.8" fill="#09060e"/><circle cx="12" cy="2.6" r="1.2" fill="#e6c8ff"/><circle cx="12" cy="21.4" r="1.2" fill="#e6c8ff"/>${close}`;
  }
}

export function svgWeaponSilhouette(weaponId: WeaponId, size = 22): string {
  const open = `<svg class="kh-svg-weapon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" aria-hidden="true">`;
  const close = '</svg>';
  switch (weaponId) {
    case 'stygian_blade':
      return `${open}<path d="M19.5 3.5L20.5 4.5L11.2 15.2L8.8 12.8L19.5 3.5Z" fill="#e5b952" stroke="#09060e" stroke-width="1.3" stroke-linejoin="round"/><path d="M19.5 3.5L10.2 13.8" stroke="#fff6d8" stroke-width="1"/><path d="M6.4 11.4L12.6 17.6M8.5 15.5L4.5 19.5" stroke="#f02e46" stroke-width="2.2" stroke-linecap="round"/><circle cx="4.2" cy="19.8" r="1.6" fill="#fff0b8" stroke="#09060e" stroke-width="0.9"/>${close}`;
    case 'eternal_spear':
      return `${open}<path d="M4 20L15.8 8.2" stroke="#c89242" stroke-width="2.2" stroke-linecap="round"/><path d="M21 3L17.4 11.4L15.4 8.6L12.6 6.6L21 3Z" fill="#fff0b8" stroke="#09060e" stroke-width="1.3" stroke-linejoin="round"/><path d="M12.8 8.8L15.2 11.2" stroke="#f02e46" stroke-width="1.8" stroke-linecap="round"/>${close}`;
    case 'shield_of_chaos':
      return `${open}<circle cx="12" cy="12" r="8.6" fill="#2a162c" stroke="#e5b952" stroke-width="2.1"/><circle cx="12" cy="12" r="5" fill="#b81932" stroke="#fff0b8" stroke-width="1.2"/><path d="M12 4.5V19.5M4.5 12H19.5" stroke="#e5b952" stroke-width="1.3"/><circle cx="12" cy="12" r="2" fill="#fff0b8"/>${close}`;
    case 'heart_seeking_bow':
      return `${open}<path d="M7.5 3.5C15 5 18.5 9.4 18.5 12C18.5 14.6 15 19 7.5 20.5" stroke="#e5b952" stroke-width="2.3" stroke-linecap="round"/><path d="M7.5 3.5L7.5 20.5" stroke="#cbbca0" stroke-width="1.1"/><path d="M4.5 12H20.5M17.2 9.2L20.5 12L17.2 14.8" stroke="#f02e46" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${close}`;
    case 'twin_fists':
      return `${open}<path d="M4.5 11.5L7 7.5H16.5L19.5 11L18 17.5L13 19.5H7.5L4.5 16Z" fill="#b81932" stroke="#e5b952" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 7.5V13.5M12 7.5V13.5M15.5 7.5V13.5" stroke="#fff0b8" stroke-width="1.5" stroke-linecap="round"/><path d="M7.5 16H16" stroke="#09060e" stroke-width="1.4"/>${close}`;
    case 'adamant_rail':
      return `${open}<path d="M3 13.5L6.5 9.5H19.5L21 11.5L19 14H12.5L10.5 18.5H6.5L8 14H3Z" fill="#322346" stroke="#e5b952" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 11.8H18.5" stroke="#6ceeff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10.2" cy="11.8" r="1.4" fill="#fff0b8"/>${close}`;
  }
}

export function svgDeathDefianceSkull(ready: boolean): string {
  const fill = ready ? '#f5cb70' : '#4a3d4f';
  const stroke = ready ? '#5a0b1a' : '#1b1226';
  const eye = ready ? '#f02e46' : '#09060e';
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M12 2.4C7.2 2.4 3.8 5.9 3.8 10.4c0 2.7 1.3 4.8 3.2 6.1v3.1c0 .9.7 1.6 1.5 1.6h7c.8 0 1.5-.7 1.5-1.6v-3.1c1.9-1.3 3.2-3.4 3.2-6.1 0-4.5-3.4-8-8.2-8Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><circle cx="9" cy="10.5" r="1.9" fill="${eye}"/><circle cx="15" cy="10.5" r="1.9" fill="${eye}"/><path d="M10 17.4v3.2M12 17.4v3.2M14 17.4v3.2" stroke="${stroke}" stroke-width="1.4"/></svg>`;
}

export function svgObolCoin(): string {
  return `<svg viewBox="0 0 18 18" width="14" height="14" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="7.4" fill="#e5b952" stroke="#5c3d18" stroke-width="1.5"/><circle cx="9" cy="9" r="4.6" stroke="#fff0b8" stroke-width="1.1"/><path d="M9 5.8L11.2 9L9 12.2L6.8 9Z" fill="#5c3d18"/></svg>`;
}

export function svgDarknessFlame(): string {
  return `<svg viewBox="0 0 18 18" width="14" height="14" fill="none" aria-hidden="true"><path d="M9 1.6C5.6 5.4 3.8 8.3 3.8 11.1A5.2 5.2 0 0 0 14.2 11.1C14.2 8.3 12.4 5.4 9 1.6Z" fill="#b25cff" stroke="#260c42" stroke-width="1.4"/><path d="M9 6.6C7.6 8.5 6.8 9.9 6.8 11.3A2.2 2.2 0 0 0 11.2 11.3C11.2 9.9 10.4 8.5 9 6.6Z" fill="#edd8ff"/></svg>`;
}

export function svgHeatFlame(): string {
  return `<svg viewBox="0 0 18 18" width="14" height="14" fill="none" aria-hidden="true"><path d="M9 1.4C11.8 4.6 14.4 7.6 14.4 10.9A5.4 5.4 0 0 1 3.6 10.9C3.6 8.4 5.1 6.2 6.8 4.4C6.6 6.4 7.5 7.5 8.5 7.6C7.9 5.5 8.3 3.2 9 1.4Z" fill="#ff7426" stroke="#3b0d0a" stroke-width="1.3"/><path d="M9 8.2C10.5 9.8 11.2 11 11.2 12.3A2.2 2.2 0 0 1 6.8 12.3C6.8 11 7.6 9.8 9 8.2Z" fill="#fff0b8"/></svg>`;
}

export function svgRelicGem(colorHex: string, unlocked: boolean): string {
  const gemFill = unlocked ? colorHex : '#2a2235';
  const ring = unlocked ? '#e5b952' : '#5e5042';
  const spec = unlocked ? '#fff8e2' : '#50455e';
  return `<svg class="kh-svg-relic-gem" viewBox="0 0 28 28" width="24" height="24" fill="none" aria-hidden="true"><circle cx="14" cy="14" r="12" fill="#120b1a" stroke="${ring}" stroke-width="1.8"/><path d="M14 4.5L22 14L14 23.5L6 14Z" fill="${gemFill}" stroke="#09060e" stroke-width="1.4"/><path d="M14 7.4L18.4 14L14 17.6L9.6 14Z" fill="${spec}" fill-opacity="0.34"/><circle cx="14" cy="3.2" r="1.4" fill="${ring}"/><circle cx="14" cy="24.8" r="1.4" fill="${ring}"/></svg>`;
}

export function svgSourceEmblem(source: BoonOffer['source'], size = 34): string {
  const open = `<svg viewBox="0 0 28 28" width="${size}" height="${size}" fill="none" aria-hidden="true">`;
  const close = '</svg>';
  switch (source) {
    case 'hammer':
      return `${open}<path d="M7 6H20L22 10.5L19 13H15V22.5H11.5V13H7L5.5 9.5Z" fill="currentColor" stroke="#09060e" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8.8H18.5" stroke="#fff4c4" stroke-width="1.2"/>${close}`;
    case 'pom':
      return `${open}<path d="M10.5 5L12 7.5L14 4.5L16 7.5L17.5 5L17 9H11Z" fill="#e5b952" stroke="#09060e" stroke-width="1.2"/><circle cx="14" cy="15.8" r="7.4" fill="currentColor" stroke="#09060e" stroke-width="1.5"/><path d="M11 13.5C11.8 11.8 13.5 11.2 15.2 11.5" stroke="#ffd8e0" stroke-width="1.4" stroke-linecap="round"/>${close}`;
    case 'well':
      return `${open}<path d="M6 10H22L19.5 21H8.5Z" fill="currentColor" fill-opacity="0.32" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><ellipse cx="14" cy="10" rx="8" ry="2.8" fill="currentColor" stroke="#09060e" stroke-width="1.3"/><path d="M14 3.5L15.6 6.8L14 8.5L12.4 6.8Z" fill="#fff4c4"/>${close}`;
    case 'chaos':
      return svgPatronSigil('abyssos', size);
    default:
      return `${open}<path d="M14 2.5L17.2 10.8L25.5 14L17.2 17.2L14 25.5L10.8 17.2L2.5 14L10.8 10.8Z" fill="currentColor" stroke="#09060e" stroke-width="1.4"/>${close}`;
  }
}

export function svgDividerFinial(): string {
  return `<svg class="kh-svg-divider-gem" viewBox="0 0 28 14" width="24" height="12" fill="none" aria-hidden="true"><path d="M14 1L23 7L14 13L5 7Z" fill="#1b1226" stroke="#e5b952" stroke-width="1.5"/><path d="M14 4L18.2 7L14 10L9.8 7Z" fill="#fff0b8"/></svg>`;
}
