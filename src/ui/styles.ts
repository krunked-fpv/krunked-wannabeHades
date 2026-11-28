const UI_STYLE_ID = 'kh-mythic-ui-styles';

// Inline Greco-Roman Meander SVG data URI (burnished hammered gold on transparent)
const MEANDER_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="10" viewBox="0 0 24 10" fill="none"><path d="M0 9H24M1 1H11V7H5V4H8M13 1H23V7H17V4H20" stroke="#e5b952" stroke-opacity="0.68" stroke-width="1.2"/></svg>`
);

export const MYTHIC_UI_CSS = `
:root {
  /* Canonical Offline OFL Font Stack — ZERO system fallback fonts */
  --kh-font-display: 'Cinzel', serif;
  --kh-font-deco: 'Cinzel Decorative', 'Cinzel', serif;
  --kh-font-ui: 'Alegreya Sans', sans-serif;
  --kh-font-num: 'Barlow Condensed', 'Cinzel', sans-serif;
  --kh-font-lore: 'Cormorant Garamond', 'Cinzel', serif;
  --kh-font-sans: var(--kh-font-ui);

  /* Master Ink / Obsidian Surfaces */
  --kh-ink: #09060E;
  --kh-panel-deep: #110B18;
  --kh-panel-mid: #1B1226;
  --kh-panel-raised: #271B36;
  --kh-bg-obsidian: rgba(17, 11, 24, 0.94);
  --kh-bg-panel: rgba(27, 18, 38, 0.95);
  --kh-bg-card: rgba(39, 27, 54, 0.92);

  /* Burnished Greco-Roman Metals */
  --kh-bronze-dark: #5C3D18;
  --kh-bronze: #9E6E2E;
  --kh-gold: #E5B952;
  --kh-gold-bright: #FFF0B8;
  --kh-gold-dim: rgba(229, 185, 82, 0.36);

  /* Underworld Crimson */
  --kh-crimson-deep: #5A0B1A;
  --kh-crimson: #B81932;
  --kh-crimson-bright: #F02E46;

  /* Parchment / Marble Typography */
  --kh-text-primary: #F7EEDB;
  --kh-text-secondary: #CBBCA0;
  --kh-text-muted: #8E7F69;
  --kh-ivory: var(--kh-text-primary);
  --kh-ash: var(--kh-text-secondary);

  /* Boon Rarity Metallic Accents */
  --kh-rarity-common: #B8ADA0;
  --kh-rarity-rare: #3EA4FF;
  --kh-rarity-epic: #B25CFF;
  --kh-rarity-heroic: #FF465A;
  --kh-rarity-duo: #C9F238;
  --kh-rarity-legendary: #FFAE24;
}

#ui-root {
  font-family: var(--kh-font-ui);
  color: var(--kh-text-primary);
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

.kh-hidden {
  display: none !important;
}

.kh-meander-strip {
  height: 10px;
  width: 100%;
  background-image: url("data:image/svg+xml,${MEANDER_SVG}");
  background-repeat: repeat-x;
  background-position: center;
  opacity: 0.9;
  pointer-events: none;
  flex-shrink: 0;
}

/* ============================================================================
   SCULPTED ORNATE FRAMES & SVG CORNER FILIGREE
   ============================================================================ */

.kh-ornate-frame {
  position: relative;
  border: 2px solid var(--kh-gold);
  box-shadow:
    0 0 0 1px var(--kh-ink),
    inset 0 0 0 4px rgba(9, 6, 14, 0.72),
    inset 0 0 0 5px rgba(158, 110, 46, 0.36),
    0 24px 68px rgba(0, 0, 0, 0.88),
    0 0 42px rgba(229, 185, 82, 0.14);
}

.kh-corner-ornament {
  position: absolute;
  width: 22px;
  height: 22px;
  z-index: 4;
  pointer-events: none;
  display: flex;
  filter: drop-shadow(0 1px 3px rgba(9, 6, 14, 0.95));
}

.kh-corner-tl { top: 4px; left: 4px; }
.kh-corner-tr { top: 4px; right: 4px; }
.kh-corner-bl { bottom: 4px; left: 4px; }
.kh-corner-br { bottom: 4px; right: 4px; }

/* ============================================================================
   SHARED NOTCHED BRONZE-OBSIDIAN MYTHIC BUTTONS
   ============================================================================ */

.kh-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 48px;
  padding: 10px 22px;
  border: 1.5px solid var(--kh-bronze);
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(39, 27, 54, 0.95) 0%, rgba(17, 11, 24, 0.98) 100%);
  color: var(--kh-text-primary);
  font-family: var(--kh-font-display);
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  cursor: pointer;
  pointer-events: auto;
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 184, 0.18),
    inset 0 -2px 0 rgba(9, 6, 14, 0.65),
    0 5px 18px rgba(0, 0, 0, 0.6);
  transition: transform 0.12s ease, border-color 0.14s ease, box-shadow 0.14s ease, background 0.14s ease;
  -webkit-tap-highlight-color: transparent;
}

.kh-btn-notched {
  clip-path: polygon(
    9px 0%,
    calc(100% - 9px) 0%,
    100% 9px,
    100% calc(100% - 9px),
    calc(100% - 9px) 100%,
    9px 100%,
    0% calc(100% - 9px),
    0% 9px
  );
}

.kh-btn::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 3px;
  background: linear-gradient(180deg, var(--kh-gold-bright), var(--kh-crimson-bright));
  opacity: 0;
  transition: opacity 0.14s ease, top 0.14s ease, bottom 0.14s ease;
  pointer-events: none;
}

.kh-btn:hover:not(:disabled),
.kh-btn.kh-focused:not(:disabled),
.kh-btn:focus-visible:not(:disabled) {
  outline: 2px solid var(--kh-gold-bright);
  outline-offset: 2px;
  border-color: var(--kh-gold-bright);
  background: linear-gradient(180deg, rgba(90, 22, 38, 0.96) 0%, rgba(34, 15, 28, 0.98) 100%);
  box-shadow:
    0 0 0 3px rgba(229, 185, 82, 0.24),
    0 0 26px rgba(229, 185, 82, 0.36),
    inset 0 1px 0 rgba(255, 240, 184, 0.34);
  transform: translateY(-1px);
}

.kh-btn:hover:not(:disabled)::before,
.kh-btn.kh-focused:not(:disabled)::before,
.kh-btn:focus-visible:not(:disabled)::before {
  opacity: 1;
  top: 8%;
  bottom: 8%;
}

.kh-btn:active:not(:disabled) {
  transform: translateY(1px) scale(0.99);
}

.kh-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  filter: grayscale(0.45);
}

.kh-btn-primary {
  border-color: var(--kh-gold);
  background: linear-gradient(180deg, rgba(162, 24, 46, 0.96) 0%, rgba(86, 11, 24, 0.98) 100%);
  color: #fff7e6;
}

.kh-btn-primary:hover:not(:disabled),
.kh-btn-primary.kh-focused:not(:disabled),
.kh-btn-primary:focus-visible:not(:disabled) {
  border-color: var(--kh-gold-bright);
  background: linear-gradient(180deg, rgba(208, 34, 58, 0.98) 0%, rgba(114, 16, 32, 0.98) 100%);
  box-shadow:
    0 0 0 3px rgba(240, 46, 70, 0.25),
    0 0 28px rgba(229, 185, 82, 0.44),
    inset 0 1px 0 rgba(255, 240, 184, 0.42);
}

.kh-btn-danger {
  border-color: rgba(240, 46, 70, 0.78);
  color: #ffd5da;
}

.kh-btn-sm {
  min-height: 40px;
  padding: 6px 12px;
  font-size: 11px;
  letter-spacing: 0.08em;
}

.kh-footer-btn-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ============================================================================
   HUD OVERLAY — DESKTOP 1440x900 & 1280x720 BASELINE GEOMETRY
   ============================================================================ */

.kh-hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 12;
  padding:
    max(12px, env(safe-area-inset-top, 0px))
    max(16px, env(safe-area-inset-right, 0px))
    max(14px, env(safe-area-inset-bottom, 0px))
    max(16px, env(safe-area-inset-left, 0px));
}

/* Top-Center Unified Stack (Sculpted Boss Bars + Zero-Truncation Underworld Toasts) */
.kh-top-center-stack {
  position: fixed;
  top: max(8px, calc(env(safe-area-inset-top, 0px) + 6px));
  left: 50%;
  transform: translateX(-50%);
  width: min(540px, calc(100vw - 600px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  pointer-events: none;
  z-index: 14;
}

.kh-hud.kh-is-hub:not(.kh-touch-active) .kh-top-center-stack {
  top: max(74px, calc(env(safe-area-inset-top, 0px) + 70px));
}

/* Sculpted Boss Health Bars */
.kh-boss-stack {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 5px;
  pointer-events: none;
}

.kh-boss-bar-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  background: linear-gradient(180deg, rgba(22, 13, 32, 0.88) 0%, rgba(10, 6, 15, 0.9) 100%);
  border: 1.5px solid var(--kh-gold);
  border-radius: 3px;
  padding: 5px 10px 6px;
  box-shadow:
    0 0 0 1px var(--kh-ink),
    0 8px 24px rgba(0, 0, 0, 0.72),
    inset 0 1px 0 rgba(255, 240, 184, 0.2);
}

.kh-boss-bar-card.kh-boss-invulnerable {
  border-color: var(--kh-gold-bright);
  box-shadow:
    0 0 0 1px var(--kh-ink),
    0 0 22px rgba(255, 240, 184, 0.36),
    0 10px 30px rgba(0, 0, 0, 0.76);
}

.kh-boss-track-row {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
}

.kh-boss-crown {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  margin-top: 0;
  filter: drop-shadow(0 2px 4px rgba(9, 6, 14, 0.92));
}

.kh-boss-crown-left { margin-right: -2px; margin-left: -4px; }
.kh-boss-crown-right { margin-left: -2px; margin-right: -4px; }

.kh-boss-card-inner {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.kh-boss-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
}

.kh-boss-title-group {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  column-gap: 8px;
  row-gap: 1px;
  min-width: 0;
}

.kh-boss-name {
  font-family: var(--kh-font-display);
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
  text-shadow: 0 2px 6px rgba(9, 6, 14, 0.95);
  line-height: 1.12;
}

/* ZERO ellipsis truncation on boss subtitles */
.kh-boss-subtitle {
  font-family: var(--kh-font-lore);
  font-style: italic;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--kh-text-secondary);
  white-space: normal;
  line-height: 1.14;
}

.kh-boss-phase-badge {
  font-family: var(--kh-font-num);
  font-variant-numeric: tabular-nums;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--kh-gold-bright);
  letter-spacing: 0.07em;
  white-space: nowrap;
  flex-shrink: 0;
}

.kh-boss-armor-track {
  position: relative;
  height: 5px;
  border-radius: 2px;
  background: rgba(255, 224, 120, 0.14);
  border: 1px solid rgba(229, 185, 82, 0.65);
  margin-bottom: 3px;
  overflow: hidden;
}

.kh-boss-armor-fill {
  height: 100%;
  background: linear-gradient(90deg, #b87a1c 0%, #e5b952 55%, #fff0b8 100%);
  transition: width 0.1s linear;
}

.kh-boss-hp-track {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 14px;
  border-radius: 2px;
  background: rgba(18, 6, 12, 0.96);
  border: 1.5px solid var(--kh-bronze);
  overflow: hidden;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.85);
}

.kh-boss-hp-ghost {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, #e5b952 0%, #fff0b8 100%);
  opacity: 0.88;
  z-index: 1;
}

.kh-boss-hp-fill {
  position: relative;
  z-index: 2;
  height: 100%;
  background: linear-gradient(180deg, #f02e46 0%, #b81932 58%, #6e0b1c 100%);
  box-shadow: inset 0 1px 0 rgba(255, 198, 206, 0.42);
  transition: width 0.08s linear;
}

.kh-boss-invuln-shimmer {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: linear-gradient(
    112deg,
    rgba(255, 240, 184, 0.16) 0%,
    rgba(255, 240, 184, 0.68) 45%,
    rgba(229, 185, 82, 0.24) 60%,
    rgba(255, 240, 184, 0.16) 100%
  );
  background-size: 220% 100%;
  animation: kh-invuln-shimmer 1.15s linear infinite;
  pointer-events: none;
}

.kh-boss-notch {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2.5px;
  z-index: 4;
  background: linear-gradient(180deg, #fff0b8 0%, #e5b952 50%, #5c3d18 100%);
  box-shadow: 0 0 4px rgba(9, 6, 14, 0.98);
  pointer-events: none;
}

.kh-boss-hp-text {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.kh-boss-hp-pill {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  height: 14px;
  border-radius: 2px;
  background: rgba(9, 6, 14, 0.88);
  border: 1px solid rgba(229, 185, 82, 0.55);
  font-family: var(--kh-font-num);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--kh-text-primary);
  text-shadow: 0 1px 2px #000;
  line-height: 1;
}

/* Top-Right Biome Ribbon & Currency Pills */
.kh-hud-topright {
  position: fixed;
  top: max(12px, calc(env(safe-area-inset-top, 0px) + 8px));
  right: max(16px, calc(env(safe-area-inset-right, 0px) + 12px));
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.kh-chamber-pill {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  white-space: nowrap;
  gap: 8px;
  padding: 6px 12px;
  background: linear-gradient(95deg, rgba(17, 11, 24, 0.84) 0%, rgba(27, 18, 38, 0.96) 100%);
  border: 1px solid rgba(229, 185, 82, 0.54);
  border-right: 4px solid var(--kh-gold);
  border-radius: 2px;
  box-shadow: 0 5px 18px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(255, 240, 184, 0.14);
}

.kh-biome-name {
  font-family: var(--kh-font-display);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-shadow: 0 1px 4px rgba(9, 6, 14, 0.9);
}

.kh-chamber-depth {
  font-family: var(--kh-font-num);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--kh-gold-bright);
  padding-left: 8px;
  border-left: 1px solid rgba(229, 185, 82, 0.42);
}

.kh-heat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 2px;
  background: rgba(140, 28, 22, 0.56);
  border: 1px solid rgba(255, 134, 62, 0.78);
  color: #ffd39e;
  font-family: var(--kh-font-num);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.kh-currency-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
}

.kh-currency-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(22, 15, 32, 0.92) 0%, rgba(11, 7, 17, 0.95) 100%);
  border: 1px solid rgba(229, 185, 82, 0.46);
  font-family: var(--kh-font-num);
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.56), inset 0 1px 0 rgba(255, 240, 184, 0.12);
}

.kh-currency-gold { color: #ffd966; }
.kh-currency-darkness { color: #cfa2ff; }
.kh-currency-fps {
  color: #8ceec9;
  font-size: 12px;
}

/* Bottom-Left Sculpted Hero Frame + Patron Boon Medallion Rail */
.kh-hud-bottomleft {
  position: fixed;
  left: max(18px, calc(env(safe-area-inset-left, 0px) + 14px));
  bottom: max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px));
  width: 380px;
  max-width: calc(100vw - 36px);
  display: flex;
  flex-direction: column;
  gap: 7px;
}

/* Circular / Hexagonal Patron Boon Medallion Rail */
.kh-boon-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  pointer-events: auto;
}

.kh-boon-medallion {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 42% 35%, rgba(39, 27, 54, 0.96) 0%, rgba(12, 8, 19, 0.98) 100%);
  border: 2px solid var(--kh-medallion-ring, var(--kh-gold));
  box-shadow:
    0 0 0 1.5px var(--kh-ink),
    0 3px 10px rgba(0, 0, 0, 0.65),
    inset 0 0 10px rgba(255, 240, 184, 0.14);
  color: var(--kh-patron-color, var(--kh-gold-bright));
  cursor: default;
  flex-shrink: 0;
}

.kh-boon-medallion-sigil {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: -3px;
  filter: drop-shadow(0 0 4px currentColor);
}

.kh-hud-sigil-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 1px 3px rgba(9, 6, 14, 0.95));
}

.kh-boon-medallion-slot {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0 4px;
  height: 12px;
  border-radius: 2px;
  background: var(--kh-ink);
  border: 1px solid var(--kh-medallion-ring, var(--kh-gold));
  font-family: var(--kh-font-num);
  font-size: 8.5px;
  font-weight: 800;
  line-height: 10px;
  letter-spacing: 0.06em;
  color: var(--kh-text-primary);
}

.kh-boon-medallion-lvl {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 50%;
  background: var(--kh-crimson);
  border: 1px solid var(--kh-gold-bright);
  font-family: var(--kh-font-num);
  font-size: 9px;
  font-weight: 800;
  line-height: 12px;
  text-align: center;
  color: #fff7e6;
}

.kh-boon-medallion-more {
  font-family: var(--kh-font-num);
  font-size: 12px;
  font-weight: 800;
  color: var(--kh-gold-bright);
}

/* Legacy chip class preserved for compact badges */
.kh-boon-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 2px;
  background: rgba(17, 11, 24, 0.92);
  border: 1px solid var(--kh-bronze);
  font-family: var(--kh-font-ui);
  font-size: 11px;
  font-weight: 700;
  color: var(--kh-text-primary);
}

.kh-boon-dot {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  transform: rotate(45deg);
  flex-shrink: 0;
}

.kh-hero-frame {
  position: relative;
  background: linear-gradient(140deg, rgba(27, 18, 38, 0.95) 0%, rgba(13, 9, 20, 0.95) 100%);
  border: 1.5px solid var(--kh-gold);
  border-left: 4px solid var(--kh-gold);
  border-radius: 3px;
  padding: 9px 11px;
  box-shadow:
    0 0 0 1px var(--kh-ink),
    0 10px 28px rgba(0, 0, 0, 0.72),
    inset 0 1px 0 rgba(255, 240, 184, 0.2);
}

.kh-hero-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}

.kh-hero-weapon-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.kh-weapon-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 2px;
  background: radial-gradient(circle at 45% 40%, rgba(44, 24, 52, 0.92), rgba(9, 6, 14, 0.94));
  border: 1px solid rgba(229, 185, 82, 0.64);
  flex-shrink: 0;
  overflow: hidden;
}

.kh-hud-weapon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
}

/* NEVER truncate weapon name with ellipsis */
.kh-weapon-tag {
  font-family: var(--kh-font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
  line-height: 1.15;
  white-space: normal;
}

.kh-hero-right-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.kh-dd-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.kh-dd-skull {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 5px rgba(240, 46, 70, 0.6));
}

.kh-dd-skull.kh-spent {
  opacity: 0.34;
  filter: grayscale(0.8);
}

.kh-godmode-badge {
  font-family: var(--kh-font-num);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 1px 6px;
  border-radius: 2px;
  background: rgba(229, 185, 82, 0.2);
  border: 1px solid rgba(229, 185, 82, 0.7);
  color: var(--kh-gold-bright);
  white-space: nowrap;
}

/* Winged Bronze-Filigree Hero HP Bar */
.kh-hp-winged-row {
  display: flex;
  align-items: center;
  gap: 0;
}

.kh-hp-wing {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 3px rgba(9, 6, 14, 0.92));
}
.kh-hp-wing-left { margin-right: -2px; }
.kh-hp-wing-right { margin-left: -2px; }

.kh-hp-track {
  position: relative;
  flex: 1;
  height: 21px;
  border-radius: 2px;
  background: rgba(20, 6, 12, 0.96);
  border: 1.5px solid var(--kh-gold);
  overflow: hidden;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.85);
}

.kh-hp-ghost {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, #e5b952 0%, #fff0b8 100%);
  opacity: 0.9;
  z-index: 1;
}

.kh-hp-fill {
  position: relative;
  z-index: 2;
  height: 100%;
  background: linear-gradient(180deg, #f02e46 0%, #b81932 55%, #720c1e 100%);
  box-shadow: inset 0 1px 0 rgba(255, 200, 208, 0.44);
  transition: width 0.09s ease-out;
}

.kh-hp-track.kh-hp-low .kh-hp-fill {
  animation: kh-low-hp-pulse 0.85s ease-in-out infinite;
}

.kh-hp-text {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 9px;
  font-family: var(--kh-font-num);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
  color: var(--kh-text-primary);
  text-shadow: 0 1px 3px rgba(9, 6, 14, 0.98);
}

.kh-hp-armor-val {
  color: var(--kh-gold-bright);
}

/* Sub-row: Jeweled Bloodstone Sockets & Swept Dash Wings */
.kh-resources-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
}

.kh-pip-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.kh-pip-label {
  font-family: var(--kh-font-display);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--kh-text-secondary);
  margin-right: 2px;
}

.kh-bloodstone-socket {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.kh-bloodstone-socket.kh-bs-ready {
  filter: drop-shadow(0 0 6px rgba(240, 46, 70, 0.75));
}

.kh-dash-wing {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.kh-dash-wing.kh-ready {
  filter: drop-shadow(0 0 5px rgba(70, 224, 255, 0.65));
}

.kh-rail-ammo {
  font-family: var(--kh-font-num);
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #e4d4ff;
  padding: 1px 6px;
  border-radius: 2px;
  background: rgba(92, 68, 164, 0.34);
  border: 1px solid rgba(178, 92, 255, 0.62);
}

/* 4-Segment Gilded Patron Call Gauge */
.kh-god-gauge-wrap {
  margin-top: 6px;
}

.kh-god-gauge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--kh-font-display);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--kh-text-secondary);
  margin-bottom: 3px;
}

.kh-god-gauge-status {
  font-family: var(--kh-font-num);
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
}

.kh-god-gauge-status.kh-ready {
  color: var(--kh-gold-bright);
  text-shadow: 0 0 9px rgba(229, 185, 82, 0.72);
}

.kh-god-gauge-segments {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.kh-god-seg {
  height: 7px;
  border-radius: 2px;
  background: rgba(17, 11, 24, 0.96);
  border: 1px solid rgba(229, 185, 82, 0.48);
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8);
}

.kh-god-seg-fill {
  height: 100%;
  width: 0%;
  transition: width 0.1s linear;
}

.kh-god-gauge-wrap.kh-call-ready .kh-god-seg {
  border-color: var(--kh-gold);
}

.kh-god-gauge-wrap.kh-call-max .kh-god-seg {
  border-color: var(--kh-gold-bright);
  box-shadow: 0 0 12px rgba(255, 224, 118, 0.65);
}

/* Bottom-Right Dynamic Control Prompts */
.kh-hud-prompts {
  position: fixed;
  right: max(16px, calc(env(safe-area-inset-right, 0px) + 12px));
  bottom: max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px));
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 50vw;
}

.kh-prompt-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 2px;
  background: rgba(17, 11, 24, 0.88);
  border: 1px solid rgba(158, 110, 46, 0.48);
  font-family: var(--kh-font-ui);
  font-size: 12px;
  font-weight: 700;
  color: var(--kh-text-secondary);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.52);
}

.kh-prompt-chip.kh-highlight {
  border-color: var(--kh-gold-bright);
  color: var(--kh-gold-bright);
  box-shadow: 0 0 14px rgba(229, 185, 82, 0.36);
}

.kh-keycap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 5px;
  border-radius: 2px;
  background: linear-gradient(180deg, #2d2040 0%, #150e20 100%);
  border: 1px solid rgba(229, 185, 82, 0.64);
  color: var(--kh-gold-bright);
  font-family: var(--kh-font-num);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.kh-xbox-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 21px;
  height: 21px;
  padding: 0 5px;
  border-radius: 50%;
  font-family: var(--kh-font-num);
  font-size: 11px;
  font-weight: 800;
  color: var(--kh-ink);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45);
}
.kh-xbox-a { background: #4cd964; }
.kh-xbox-b { background: #ff4f58; color: #fff; }
.kh-xbox-x { background: #3aa0ff; color: #fff; }
.kh-xbox-y { background: #ffcc33; }
.kh-xbox-bumper {
  border-radius: 4px;
  background: #271b36;
  color: var(--kh-gold-bright);
  border: 1px solid rgba(229, 185, 82, 0.68);
}

/* Contextual World Interact Banner */
.kh-interact-banner {
  position: fixed;
  left: 50%;
  bottom: max(96px, 15vh);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(27, 18, 38, 0.96) 0%, rgba(13, 9, 20, 0.98) 100%);
  border: 1.5px solid var(--kh-gold-bright);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.78), 0 0 20px rgba(229, 185, 82, 0.28);
  font-family: var(--kh-font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #fff6e0;
  white-space: nowrap;
}

/* ============================================================================
   ZERO-TRUNCATION UNDERWORLD PROCLAMATION TOASTS
   STRICT RULE: NEVER nowrap / ellipsis / overflow:hidden!
   ============================================================================ */

.kh-toast-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  pointer-events: none;
}

.kh-toast {
  position: relative;
  max-width: 100%;
  padding: 6px 24px;
  background: linear-gradient(
    90deg,
    rgba(9, 6, 14, 0.68) 0%,
    rgba(22, 13, 30, 0.95) 14%,
    rgba(22, 13, 30, 0.95) 86%,
    rgba(9, 6, 14, 0.68) 100%
  );
  border-top: 1.5px solid var(--kh-gold);
  border-bottom: 1.5px solid var(--kh-crimson);
  border-left: 2px solid var(--kh-toast-accent, var(--kh-gold));
  border-right: 2px solid var(--kh-toast-accent, var(--kh-gold));
  border-radius: 2px;
  box-shadow:
    0 5px 20px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 rgba(255, 240, 184, 0.22);
  font-family: var(--kh-font-display);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  text-shadow: 0 1px 5px rgba(9, 6, 14, 0.98);
  white-space: normal;
  text-wrap: balance;
  overflow-wrap: break-word;
  text-align: center;
  line-height: 1.28;
  animation: kh-toast-in 0.16s ease-out;
}

.kh-toast::before,
.kh-toast::after {
  content: '◆';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 8px;
  color: var(--kh-gold-bright);
  opacity: 0.88;
}
.kh-toast::before { left: 8px; }
.kh-toast::after { right: 8px; }

@keyframes kh-low-hp-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.48); }
}

@keyframes kh-toast-in {
  from { opacity: 0.92; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes kh-invuln-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

/* ============================================================================
   TITLE SCREEN REDESIGN — PAINTED KEY ART + CINEMATIC EDITORIAL LEFT PILLAR
   ============================================================================ */

.kh-title-overlay {
  position: fixed;
  inset: 0;
  z-index: 15;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  padding:
    max(18px, calc(env(safe-area-inset-top, 0px) + 14px))
    max(28px, calc(env(safe-area-inset-right, 0px) + 22px))
    max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))
    max(28px, calc(env(safe-area-inset-left, 0px) + 22px));
  background: #09060E;
  pointer-events: auto;
}

.kh-title-keyart {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.kh-title-keyart-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 64% center;
  display: block;
  transform: scale(1.03);
  filter: contrast(1.06) saturate(1.08);
  animation: kh-title-breathe 26s ease-in-out infinite alternate;
}

@keyframes kh-title-breathe {
  0% { transform: scale(1.02) translate3d(0, 0, 0); }
  100% { transform: scale(1.065) translate3d(-0.8%, -0.5%, 0); }
}

.kh-title-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(
      90deg,
      rgba(9, 6, 14, 0.96) 0%,
      rgba(12, 7, 19, 0.88) 28%,
      rgba(12, 7, 19, 0.56) 44%,
      rgba(9, 6, 14, 0.14) 62%,
      rgba(9, 6, 14, 0.08) 82%,
      rgba(9, 6, 14, 0.42) 100%
    ),
    linear-gradient(
      180deg,
      rgba(9, 6, 14, 0.62) 0%,
      rgba(9, 6, 14, 0.0) 18%,
      rgba(9, 6, 14, 0.0) 76%,
      rgba(9, 6, 14, 0.86) 100%
    );
}

.kh-title-overlay > .kh-meander-strip,
.kh-title-content,
.kh-title-footer {
  position: relative;
  z-index: 2;
}

.kh-title-content {
  display: flex;
  align-items: center;
  flex: 1;
  min-height: 0;
}

.kh-title-pillar {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  max-width: 472px;
  padding: 20px 28px 20px 10px;
  gap: 12px;
}

.kh-title-crest-art {
  display: flex;
  align-items: center;
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 18px rgba(240, 46, 70, 0.25));
}

.kh-title-eyebrow-rule {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 420px;
}

.kh-title-rule-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(158, 110, 46, 0.15) 0%, var(--kh-gold) 50%, rgba(158, 110, 46, 0.15) 100%);
}

.kh-title-crest {
  font-family: var(--kh-font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
  white-space: nowrap;
}

.kh-title-heading {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-family: var(--kh-font-deco);
  font-weight: 900;
  line-height: 1.02;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  filter: drop-shadow(0 4px 12px rgba(9, 6, 14, 0.96)) drop-shadow(0 0 24px rgba(229, 185, 82, 0.22));
}

.kh-title-word-top {
  font-size: clamp(24px, 3.1vw, 38px);
  letter-spacing: 0.16em;
  background: linear-gradient(180deg, #fff8dc 0%, #e5b952 62%, #b06d22 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.kh-title-word-main {
  font-size: clamp(28px, 3.7vw, 48px);
  background: linear-gradient(180deg, #fff6cf 0%, #f0c45c 48%, #b86c1e 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.kh-title-tagline-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 420px;
}

.kh-title-sub {
  margin: 0;
  font-family: var(--kh-font-lore);
  font-style: italic;
  font-weight: 600;
  font-size: clamp(17px, 1.9vw, 22px);
  letter-spacing: 0.08em;
  color: var(--kh-text-primary);
  text-shadow: 0 2px 10px rgba(9, 6, 14, 0.98);
}

.kh-title-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.kh-title-menu {
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: 100%;
  max-width: 432px;
  margin-top: 4px;
}

.kh-title-menu .kh-btn {
  justify-content: space-between;
  width: 100%;
  text-align: left;
  padding: 10px 18px;
}

.kh-title-btn-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.kh-title-btn-diamond {
  width: 7px;
  height: 7px;
  background: var(--kh-bronze);
  border: 1px solid var(--kh-gold);
  transform: rotate(45deg);
  transition: background 0.14s ease, transform 0.14s ease;
  flex-shrink: 0;
}

.kh-btn:hover .kh-title-btn-diamond,
.kh-btn.kh-focused .kh-title-btn-diamond {
  background: var(--kh-gold-bright);
  transform: rotate(45deg) scale(1.22);
}

.kh-title-btn-tag {
  font-family: var(--kh-font-num);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--kh-gold-bright);
  opacity: 0.82;
}

.kh-title-pack-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.kh-title-pack-row .kh-btn {
  justify-content: center;
  text-align: center;
  white-space: nowrap;
  padding: 10px 12px;
  font-size: 12px;
  letter-spacing: 0.08em;
}

.kh-title-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(229, 185, 82, 0.32);
}

.kh-title-footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.kh-title-nav-hint {
  font-family: var(--kh-font-ui);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--kh-text-secondary);
}

.kh-input-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-radius: 2px;
  background: rgba(17, 11, 24, 0.92);
  border: 1px solid rgba(229, 185, 82, 0.56);
  font-family: var(--kh-font-display);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
}

.kh-title-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.kh-title-meta-item {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.kh-title-meta-label {
  font-family: var(--kh-font-display);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--kh-text-muted);
}

.kh-title-meta-num {
  font-family: var(--kh-font-num);
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--kh-gold-bright);
}

/* ============================================================================
   MODAL BACKDROP & BOON SELECT MODAL (RARITY SHIMMER + STAGGERED ENTRANCE)
   ============================================================================ */

.kh-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 16;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    max(14px, env(safe-area-inset-top, 0px))
    max(16px, env(safe-area-inset-right, 0px))
    max(14px, env(safe-area-inset-bottom, 0px))
    max(16px, env(safe-area-inset-left, 0px));
  background: radial-gradient(circle at 50% 45%, rgba(20, 12, 32, 0.78) 0%, rgba(6, 4, 10, 0.94) 100%);
  backdrop-filter: blur(5px);
  pointer-events: auto;
}

.kh-boon-shell {
  width: min(1140px, 95vw);
  max-height: 92vh;
  display: grid;
  grid-template-columns: minmax(300px, 370px) 1fr;
  gap: 22px;
  align-items: stretch;
  background: linear-gradient(160deg, rgba(24, 15, 36, 0.97) 0%, rgba(11, 7, 18, 0.99) 100%);
  border-radius: 4px;
  padding: 20px 22px;
}

.kh-boon-portrait-col {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 3px;
  overflow: hidden;
  border: 2px solid var(--kh-patron-accent, var(--kh-gold));
  background: radial-gradient(circle at 50% 35%, rgba(229, 185, 82, 0.24), rgba(11, 7, 17, 0.98) 76%);
  min-height: 440px;
}

.kh-portrait-enter {
  animation: kh-portrait-slide 0.24s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.kh-boon-portrait-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.kh-boon-portrait-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-bottom: 58px;
}

.kh-boon-emblem {
  width: 104px;
  height: 104px;
  border-radius: 50%;
  border: 2.5px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, rgba(27, 18, 38, 0.9), rgba(9, 6, 14, 0.96));
  box-shadow: 0 0 34px currentColor, inset 0 0 18px rgba(255, 240, 184, 0.16);
}

.kh-boon-patron-plate {
  position: relative;
  z-index: 2;
  padding: 20px 16px 14px;
  background: linear-gradient(180deg, rgba(9, 6, 14, 0) 0%, rgba(11, 7, 17, 0.92) 42%, rgba(9, 6, 14, 0.98) 100%);
}

.kh-boon-patron-name {
  font-family: var(--kh-font-display);
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
  text-shadow: 0 2px 10px rgba(9, 6, 14, 0.95);
}

.kh-boon-patron-title {
  font-family: var(--kh-font-lore);
  font-style: italic;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--kh-text-secondary);
  margin-top: 2px;
}

.kh-boon-cards-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.kh-boon-offer-head {
  position: relative;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  overflow: hidden;
  padding-right: 4px;
}

.kh-boon-header-watermark {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.12;
  pointer-events: none;
}

.kh-boon-offer-title {
  margin: 0;
  font-family: var(--kh-font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
  text-shadow: 0 2px 8px rgba(9, 6, 14, 0.9);
}

.kh-boon-offer-hint {
  font-family: var(--kh-font-ui);
  font-size: 12px;
  font-weight: 500;
  color: var(--kh-text-secondary);
}

.kh-boon-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.kh-boon-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 88px;
  padding: 12px 15px;
  text-align: left;
  border-radius: 3px;
  border: 2px solid var(--kh-rarity-common);
  border-left-width: 6px;
  background: linear-gradient(100deg, rgba(34, 23, 50, 0.96) 0%, rgba(17, 11, 24, 0.98) 100%);
  color: var(--kh-text-primary);
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.13s ease, box-shadow 0.14s ease, border-color 0.12s ease;
}

.kh-boon-card-enter {
  animation: kh-card-enter 0.24s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--kh-card-delay, 0ms);
}

.kh-boon-shimmer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(
    115deg,
    transparent 20%,
    rgba(255, 248, 220, 0.18) 46%,
    rgba(255, 255, 255, 0.34) 50%,
    rgba(255, 248, 220, 0.14) 54%,
    transparent 80%
  );
  transform: translateX(-120%);
}

/* Rarity-Specific Metallic Borders & Shimmer */
.kh-boon-card[data-rarity="common"] {
  border-color: var(--kh-rarity-common);
}

.kh-boon-card[data-rarity="rare"] {
  border-color: var(--kh-rarity-rare);
  box-shadow: inset 0 0 18px rgba(62, 164, 255, 0.14), 0 0 14px rgba(62, 164, 255, 0.12);
}
.kh-boon-card[data-rarity="rare"]:hover .kh-boon-shimmer,
.kh-boon-card[data-rarity="rare"].kh-focused .kh-boon-shimmer {
  opacity: 0.75;
  animation: kh-rarity-shimmer 1.1s ease-out 1;
}

.kh-boon-card[data-rarity="epic"] {
  border-color: var(--kh-rarity-epic);
  box-shadow: inset 0 0 22px rgba(178, 92, 255, 0.18), 0 0 18px rgba(178, 92, 255, 0.16);
}
.kh-boon-card[data-rarity="epic"] .kh-boon-shimmer {
  opacity: 0.55;
  background: linear-gradient(115deg, transparent 22%, rgba(210, 154, 255, 0.24) 50%, transparent 78%);
  animation: kh-rarity-shimmer 3.8s ease-in-out infinite;
}

.kh-boon-card[data-rarity="heroic"] {
  border-color: var(--kh-rarity-heroic);
  box-shadow:
    inset 0 0 24px rgba(255, 70, 90, 0.22),
    inset 0 0 0 1px rgba(255, 240, 184, 0.25),
    0 0 20px rgba(255, 70, 90, 0.2);
}
.kh-boon-card[data-rarity="heroic"] .kh-boon-shimmer {
  opacity: 0.68;
  background: linear-gradient(115deg, transparent 22%, rgba(255, 198, 128, 0.3) 50%, transparent 78%);
  animation: kh-rarity-shimmer 3.1s ease-in-out infinite;
}

.kh-boon-card[data-rarity="duo"] {
  border-color: #44e6b8;
  border-left-color: #c9f238;
  box-shadow:
    inset 0 0 24px rgba(68, 230, 184, 0.2),
    0 0 20px rgba(201, 242, 56, 0.18);
}
.kh-boon-card[data-rarity="duo"] .kh-boon-shimmer {
  opacity: 0.72;
  background: linear-gradient(115deg, transparent 20%, rgba(201, 242, 56, 0.28) 46%, rgba(68, 230, 184, 0.28) 56%, transparent 80%);
  animation: kh-rarity-shimmer 2.8s ease-in-out infinite;
}

.kh-boon-card[data-rarity="legendary"] {
  border-color: var(--kh-rarity-legendary);
  box-shadow:
    inset 0 0 28px rgba(255, 174, 36, 0.26),
    inset 0 0 0 1px rgba(255, 243, 168, 0.42),
    0 0 24px rgba(255, 174, 36, 0.24);
}
.kh-boon-card[data-rarity="legendary"] .kh-boon-shimmer {
  opacity: 0.85;
  background: linear-gradient(115deg, transparent 18%, rgba(255, 243, 168, 0.36) 50%, transparent 82%);
  animation: kh-rarity-shimmer 2.4s ease-in-out infinite;
}

.kh-boon-card:hover,
.kh-boon-card.kh-focused,
.kh-boon-card:focus-visible {
  outline: 2px solid var(--kh-gold-bright);
  outline-offset: 2px;
  transform: translateX(4px);
  box-shadow:
    0 0 0 4px rgba(229, 185, 82, 0.22),
    0 10px 28px rgba(0, 0, 0, 0.76);
}

.kh-boon-card-layout {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 13px;
}

.kh-boon-card-sigil {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 2px solid var(--kh-gold);
  background: radial-gradient(circle at 42% 35%, rgba(39, 27, 54, 0.96), rgba(9, 6, 14, 0.98));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.65), inset 0 0 10px rgba(255, 240, 184, 0.16);
}

.kh-boon-sigil-img {
  width: 44px;
  height: 44px;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 2px 6px rgba(9, 6, 14, 0.92));
}

.kh-boon-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kh-boon-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kh-boon-card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.kh-boon-hotkey {
  width: 24px;
  height: 24px;
  border-radius: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--kh-ink);
  border: 1px solid rgba(229, 185, 82, 0.7);
  color: var(--kh-gold-bright);
  font-family: var(--kh-font-num);
  font-size: 13px;
  font-weight: 800;
  flex-shrink: 0;
}

.kh-boon-name {
  font-family: var(--kh-font-display);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--kh-text-primary);
}

.kh-boon-badges {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.kh-boon-slot-tag {
  font-family: var(--kh-font-num);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(229, 185, 82, 0.24);
  color: var(--kh-text-primary);
}

.kh-boon-rarity-pill {
  font-family: var(--kh-font-display);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 2px;
  border: 1px solid currentColor;
  background: rgba(9, 6, 14, 0.82);
}

.kh-boon-desc {
  margin: 0;
  font-family: var(--kh-font-ui);
  font-size: 14.5px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--kh-text-secondary);
}

.kh-boon-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

.kh-boon-stat {
  font-family: var(--kh-font-num);
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  font-weight: 800;
  color: #6ef5b8;
  letter-spacing: 0.04em;
}

.kh-boon-replace {
  font-family: var(--kh-font-display);
  font-size: 10.5px;
  font-weight: 700;
  color: var(--kh-gold-bright);
}

.kh-boon-curse {
  font-family: var(--kh-font-ui);
  font-size: 12px;
  font-weight: 700;
  color: #dcaeff;
}

.kh-boon-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 2px;
}

@keyframes kh-portrait-slide {
  from { opacity: 0; transform: translateX(-18px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes kh-card-enter {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes kh-rarity-shimmer {
  0% { transform: translateX(-125%); }
  45%, 100% { transform: translateX(135%); }
}

/* ============================================================================
   PAUSE, OPTIONS, VICTORY & DEATH MODALS
   ============================================================================ */

.kh-modal-panel {
  width: min(680px, 94vw);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 24px;
  border-radius: 4px;
  background: linear-gradient(170deg, rgba(27, 18, 38, 0.98) 0%, rgba(12, 8, 19, 0.99) 100%);
  overflow-y: auto;
}

.kh-modal-panel-narrow { width: min(450px, 92vw); }
.kh-modal-panel-wide { width: min(840px, 95vw); }

.kh-modal-title {
  margin: 0;
  text-align: center;
  font-family: var(--kh-font-display);
  font-size: clamp(20px, 3vw, 28px);
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
  text-shadow: 0 3px 14px rgba(9, 6, 14, 0.92);
}

.kh-modal-subtitle {
  margin: -4px 0 2px;
  text-align: center;
  font-family: var(--kh-font-lore);
  font-style: italic;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--kh-text-secondary);
}

/* Monumental Victory / Death Banners */
.kh-summary-panel {
  width: min(760px, 95vw);
}

.kh-summary-banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 18px 14px;
  margin: -6px -6px 0;
  border-radius: 3px;
  border-bottom: 1.5px solid rgba(229, 185, 82, 0.45);
}

.kh-summary-banner.kh-banner-victory {
  background: radial-gradient(ellipse at 50% 35%, rgba(229, 185, 82, 0.24) 0%, rgba(44, 128, 92, 0.18) 52%, rgba(17, 11, 24, 0.4) 100%);
}

.kh-summary-banner.kh-banner-death {
  background: radial-gradient(ellipse at 50% 35%, rgba(240, 46, 70, 0.3) 0%, rgba(90, 11, 26, 0.28) 55%, rgba(17, 11, 24, 0.4) 100%);
}

.kh-summary-crest svg {
  width: 120px;
  height: 46px;
}

.kh-summary-title {
  font-family: var(--kh-font-deco);
  font-size: clamp(24px, 3.6vw, 36px);
  letter-spacing: 0.12em;
}

.kh-modal-title.kh-victory-title {
  background: linear-gradient(180deg, #fff8dc 0%, #e5b952 55%, #66f2b4 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.kh-modal-title.kh-death-title {
  background: linear-gradient(180deg, #ffd4da 0%, #f02e46 52%, #9e1128 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.kh-summary-boons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.kh-summary-boon-pill {
  font-family: var(--kh-font-ui);
  font-size: 12px;
}

.kh-submenu-body {
  font-family: var(--kh-font-ui);
  font-size: 14px;
  line-height: 1.5;
  color: var(--kh-text-secondary);
  text-align: center;
}

.kh-modal-actions {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.kh-modal-actions-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

/* Options Grid & Custom Gilded Bronze Range Sliders */
.kh-options-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
}

.kh-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  padding: 6px 12px;
  border-radius: 3px;
  background: rgba(17, 11, 24, 0.72);
  border: 1px solid rgba(158, 110, 46, 0.36);
  transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
}

.kh-option-row.kh-focused {
  border-color: var(--kh-gold-bright);
  background: rgba(229, 185, 82, 0.12);
  box-shadow: 0 0 0 2px rgba(229, 185, 82, 0.25);
}

.kh-option-label-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.kh-option-label {
  font-family: var(--kh-font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--kh-text-primary);
}

.kh-option-sub {
  font-family: var(--kh-font-ui);
  font-size: 11px;
  font-weight: 500;
  color: var(--kh-gold);
}

.kh-seg-group {
  display: inline-flex;
  gap: 4px;
  flex-shrink: 0;
}

.kh-seg-btn {
  min-width: 48px;
  min-height: 48px;
  padding: 4px 10px;
  border-radius: 2px;
  border: 1px solid rgba(158, 110, 46, 0.56);
  background: linear-gradient(180deg, rgba(27, 18, 38, 0.94), rgba(14, 9, 20, 0.96));
  color: var(--kh-text-secondary);
  font-family: var(--kh-font-num);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.kh-seg-btn.kh-active {
  border-color: var(--kh-gold-bright);
  background: linear-gradient(180deg, rgba(162, 24, 46, 0.88), rgba(90, 11, 26, 0.94));
  color: var(--kh-gold-bright);
  box-shadow: 0 0 12px rgba(229, 185, 82, 0.28);
}

.kh-slider-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

/* Custom Gilded Bronze Range Slider */
input[type="range"].kh-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 112px;
  height: 18px;
  background: transparent;
  cursor: pointer;
}

input[type="range"].kh-slider::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 2px;
  border: 1px solid rgba(229, 185, 82, 0.58);
  background: linear-gradient(
    90deg,
    var(--kh-gold) 0%,
    var(--kh-gold-bright) var(--kh-slider-pct, 80%),
    rgba(17, 11, 24, 0.95) var(--kh-slider-pct, 80%),
    rgba(17, 11, 24, 0.95) 100%
  );
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.85);
}

input[type="range"].kh-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  background: linear-gradient(135deg, #fff4c4 0%, #e5b952 55%, #9e6e2e 100%);
  border: 1.5px solid var(--kh-ink);
  transform: rotate(45deg);
  box-shadow: 0 0 8px rgba(229, 185, 82, 0.72);
}

input[type="range"].kh-slider::-moz-range-track {
  height: 6px;
  border-radius: 2px;
  border: 1px solid rgba(229, 185, 82, 0.58);
  background: rgba(17, 11, 24, 0.95);
}

input[type="range"].kh-slider::-moz-range-progress {
  height: 6px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--kh-bronze), var(--kh-gold-bright));
}

input[type="range"].kh-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 0;
  background: linear-gradient(135deg, #fff4c4 0%, #e5b952 55%, #9e6e2e 100%);
  border: 1.5px solid var(--kh-ink);
  transform: rotate(45deg);
  box-shadow: 0 0 8px rgba(229, 185, 82, 0.72);
}

.kh-slider-val {
  width: 38px;
  text-align: right;
  font-family: var(--kh-font-num);
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--kh-gold-bright);
}

/* Victory / Death & Codex Stats Grid */
.kh-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.kh-stat-card {
  padding: 10px 12px;
  border-radius: 3px;
  background: linear-gradient(160deg, rgba(31, 21, 44, 0.88), rgba(14, 9, 22, 0.94));
  border: 1px solid rgba(229, 185, 82, 0.36);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.kh-stat-key {
  font-family: var(--kh-font-display);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--kh-text-secondary);
}

.kh-stat-val {
  font-family: var(--kh-font-num);
  font-size: 20px;
  font-weight: 800;
  color: var(--kh-gold-bright);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

/* ============================================================================
   F9 DEBUG PLAYTEST DRAWER
   ============================================================================ */

.kh-debug-drawer {
  position: fixed;
  top: max(10px, env(safe-area-inset-top, 0px));
  left: max(10px, env(safe-area-inset-left, 0px));
  bottom: max(10px, env(safe-area-inset-bottom, 0px));
  width: min(350px, 88vw);
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 4px;
  background: rgba(11, 7, 17, 0.96);
  border: 1.5px solid var(--kh-gold);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.88);
  pointer-events: auto;
  overflow-y: auto;
  scrollbar-width: thin;
}

.kh-debug-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(229, 185, 82, 0.35);
  padding-bottom: 8px;
}

.kh-debug-title {
  margin: 0;
  font-family: var(--kh-font-display);
  font-size: 13px;
  letter-spacing: 0.12em;
  color: var(--kh-gold-bright);
}

.kh-debug-telemetry {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 8px;
  padding: 8px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
  font-family: var(--kh-font-num);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: #8ceec9;
}

.kh-debug-section-title {
  font-family: var(--kh-font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--kh-gold);
  margin: 4px 0 3px;
}

.kh-debug-btn-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.kh-debug-btn {
  min-height: 36px;
  padding: 5px 8px;
  border-radius: 3px;
  border: 1px solid rgba(229, 185, 82, 0.44);
  background: rgba(27, 18, 38, 0.94);
  color: var(--kh-text-primary);
  font-family: var(--kh-font-ui);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.kh-debug-btn:hover {
  border-color: var(--kh-gold-bright);
  background: rgba(68, 34, 58, 0.94);
}

.kh-debug-btn.kh-active {
  border-color: #6ef5b8;
  background: rgba(34, 112, 82, 0.58);
}

/* ============================================================================
   COURTYARD QUICK-DOCK & UNIFIED META MODALS
   ============================================================================ */

.kh-hub-dock {
  position: fixed;
  top: max(12px, calc(env(safe-area-inset-top, 0px) + 8px));
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border-radius: 3px;
  background: linear-gradient(180deg, rgba(27, 18, 38, 0.94) 0%, rgba(12, 8, 20, 0.96) 100%);
  border: 1.5px solid var(--kh-gold);
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 240, 184, 0.16);
  pointer-events: auto;
  z-index: 15;
}

.kh-hud.kh-touch-active .kh-hub-dock {
  top: auto;
  bottom: max(12px, calc(env(safe-area-inset-bottom, 0px) + 8px));
  padding: 4px 6px;
  gap: 4px;
}

.kh-dock-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 48px;
  min-width: 48px;
  padding: 6px 12px;
  border-radius: 2px;
  border: 1px solid rgba(158, 110, 46, 0.54);
  background: linear-gradient(180deg, rgba(34, 23, 50, 0.94), rgba(17, 11, 24, 0.96));
  color: var(--kh-text-primary);
  font-family: var(--kh-font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.12s ease, background 0.12s ease, transform 0.1s ease;
  -webkit-tap-highlight-color: transparent;
}

.kh-dock-btn:hover,
.kh-dock-btn:focus-visible {
  outline: 2px solid var(--kh-gold-bright);
  border-color: var(--kh-gold-bright);
  background: linear-gradient(180deg, rgba(114, 24, 42, 0.94), rgba(48, 12, 24, 0.96));
  color: var(--kh-gold-bright);
}

.kh-dock-hotkey {
  font-family: var(--kh-font-num);
  font-size: 10.5px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--kh-ink);
  border: 1px solid rgba(229, 185, 82, 0.58);
  color: var(--kh-gold-bright);
}

.kh-hud.kh-touch-active .kh-dock-hotkey {
  display: none;
}

/* Shared Meta Modal Shell */
.kh-meta-shell {
  width: min(1060px, 95vw);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 22px;
  border-radius: 4px;
  background: linear-gradient(165deg, rgba(25, 16, 38, 0.98) 0%, rgba(11, 7, 18, 0.99) 100%);
  overflow: hidden;
}

/* Modal-Specific Atmospheric Tints */
.kh-theme-mirror {
  background: linear-gradient(165deg, rgba(32, 16, 52, 0.98) 0%, rgba(13, 8, 24, 0.99) 100%);
}
.kh-theme-keepsake {
  background: linear-gradient(165deg, rgba(38, 13, 24, 0.98) 0%, rgba(15, 8, 16, 0.99) 100%);
}
.kh-theme-shrine {
  background: linear-gradient(165deg, rgba(38, 17, 14, 0.98) 0%, rgba(14, 8, 12, 0.99) 100%);
}
.kh-theme-shop {
  background: linear-gradient(165deg, rgba(14, 30, 34, 0.98) 0%, rgba(10, 10, 18, 0.99) 100%);
}
.kh-theme-codex {
  background: linear-gradient(165deg, rgba(28, 20, 32, 0.98) 0%, rgba(13, 9, 18, 0.99) 100%);
}

.kh-meta-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.kh-meta-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kh-meta-title {
  margin: 0;
  font-family: var(--kh-font-display);
  font-size: clamp(19px, 2.5vw, 26px);
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
  text-shadow: 0 2px 10px rgba(9, 6, 14, 0.92);
}

.kh-meta-sub {
  font-family: var(--kh-font-lore);
  font-style: italic;
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--kh-text-secondary);
}

.kh-meta-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.kh-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 2px;
  background: rgba(13, 9, 20, 0.94);
  border: 1px solid rgba(229, 185, 82, 0.56);
  font-family: var(--kh-font-num);
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  color: var(--kh-text-primary);
}

.kh-meta-pill-gold {
  border-color: var(--kh-gold);
  color: var(--kh-gold-bright);
  background: rgba(92, 61, 24, 0.32);
}

.kh-meta-pill-purple {
  border-color: rgba(178, 92, 255, 0.78);
  color: #e2c2ff;
  background: rgba(74, 28, 120, 0.36);
}

.kh-meta-pill-crimson {
  border-color: rgba(240, 46, 70, 0.78);
  color: #ffc2c8;
  background: rgba(114, 16, 32, 0.55);
}

.kh-meta-pill-heat {
  border-color: rgba(255, 134, 62, 0.88);
  color: #ffd9a6;
  background: rgba(130, 38, 16, 0.58);
}

.kh-heat-crest .kh-heat-num {
  font-size: 16px;
  color: #fff0b8;
}

.kh-meta-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(229, 185, 82, 0.56) rgba(14, 10, 22, 0.6);
}

.kh-armory-scroll,
.kh-codex-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kh-meta-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid rgba(229, 185, 82, 0.32);
}

.kh-meta-hint {
  font-family: var(--kh-font-ui);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--kh-text-secondary);
}

/* Tab Strip (Weapons, Codex) */
.kh-tab-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.kh-tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex: 1 1 auto;
  min-height: 48px;
  padding: 6px 10px;
  border-radius: 2px;
  border: 1.5px solid rgba(158, 110, 46, 0.44);
  background: linear-gradient(180deg, rgba(27, 18, 38, 0.94), rgba(14, 9, 21, 0.96));
  color: var(--kh-text-secondary);
  font-family: var(--kh-font-display);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
}

.kh-tab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.kh-weapon-tab-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 1px 3px rgba(9, 6, 14, 0.9));
}

.kh-tab-btn.kh-active {
  border-color: var(--kh-gold-bright);
  background: linear-gradient(180deg, rgba(148, 22, 42, 0.94) 0%, rgba(62, 11, 24, 0.98) 100%);
  color: var(--kh-gold-bright);
  box-shadow: 0 0 16px rgba(229, 185, 82, 0.28);
}

.kh-tab-btn:hover,
.kh-tab-btn.kh-focused {
  outline: 2px solid var(--kh-gold-bright);
  outline-offset: 1px;
  color: var(--kh-gold-bright);
}

/* Weapon Rack Modal */
.kh-weapon-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-radius: 3px;
  background: linear-gradient(100deg, rgba(39, 27, 54, 0.85), rgba(17, 11, 24, 0.92));
  border: 1px solid rgba(229, 185, 82, 0.42);
}

.kh-weapon-banner-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.kh-weapon-emblem-medallion {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid var(--kh-gold);
  background: radial-gradient(circle at 40% 35%, rgba(90, 11, 26, 0.72), rgba(9, 6, 14, 0.96));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 0 18px rgba(229, 185, 82, 0.28), inset 0 0 14px rgba(0, 0, 0, 0.6);
}

.kh-weapon-banner-img {
  width: 54px;
  height: 54px;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.92));
}

.kh-weapon-banner-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.kh-weapon-banner-name {
  font-family: var(--kh-font-display);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
}

.kh-weapon-banner-sub {
  font-family: var(--kh-font-lore);
  font-style: italic;
  font-size: 14px;
  font-weight: 600;
  color: var(--kh-text-secondary);
}

.kh-weapon-stat-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.kh-stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border-radius: 2px;
  background: rgba(11, 7, 17, 0.9);
  border: 1px solid rgba(158, 110, 46, 0.56);
  font-size: 11px;
  font-weight: 700;
  color: var(--kh-text-primary);
}

.kh-stat-badge-key {
  font-family: var(--kh-font-display);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  color: var(--kh-text-secondary);
}

.kh-stat-badge-num {
  font-family: var(--kh-font-num);
  font-size: 13.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--kh-gold-bright);
}

.kh-hammer-badge {
  border-color: rgba(255, 155, 66, 0.72);
  color: #ffd39e;
}

.kh-aspect-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.kh-aspect-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  padding: 13px 15px;
  border-radius: 3px;
  background: linear-gradient(145deg, rgba(31, 21, 46, 0.96) 0%, rgba(14, 9, 21, 0.98) 100%);
  border: 1.5px solid rgba(158, 110, 46, 0.52);
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.kh-aspect-card.kh-equipped {
  border-color: var(--kh-gold-bright);
  box-shadow: inset 0 0 26px rgba(229, 185, 82, 0.16), 0 0 18px rgba(229, 185, 82, 0.14);
}

.kh-aspect-card.kh-focused {
  outline: 2px solid var(--kh-gold-bright);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(229, 185, 82, 0.22);
}

.kh-aspect-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kh-aspect-name {
  font-family: var(--kh-font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--kh-text-primary);
}

.kh-aspect-name.kh-aspect-hidden {
  color: #ff9aa6;
}

.kh-aspect-badges {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}

.kh-tag-hidden {
  color: #ff9ea8;
  border-color: rgba(240, 46, 70, 0.65);
}

.kh-tag-rank {
  color: var(--kh-gold-bright);
}

.kh-rank-pip-track {
  display: flex;
  align-items: center;
  gap: 5px;
}

.kh-rank-pip {
  width: 14px;
  height: 5px;
  border-radius: 1px;
  background: rgba(11, 7, 17, 0.9);
  border: 1px solid rgba(158, 110, 46, 0.48);
}

.kh-rank-pip.kh-filled {
  background: linear-gradient(90deg, var(--kh-crimson-bright), var(--kh-gold-bright));
  border-color: var(--kh-gold-bright);
  box-shadow: 0 0 7px rgba(229, 185, 82, 0.55);
}

.kh-aspect-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.kh-aspect-actions .kh-btn {
  flex: 1;
  min-height: 48px;
  padding: 6px 12px;
  font-size: 11px;
}

/* Mirror of Dusk Rows (Amethyst Side A <-> Crimson-Gold Side B) */
.kh-mirror-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.kh-mirror-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 11px;
  padding: 9px 12px;
  border-radius: 3px;
  background: linear-gradient(95deg, rgba(34, 18, 56, 0.92), rgba(16, 10, 26, 0.96));
  border: 1.5px solid rgba(178, 92, 255, 0.56);
  border-left-width: 5px;
  transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
}

.kh-mirror-row[data-side="b"] {
  border-color: rgba(229, 185, 82, 0.64);
  border-left-color: var(--kh-crimson-bright);
  background: linear-gradient(95deg, rgba(54, 18, 28, 0.92), rgba(22, 12, 18, 0.96));
}

.kh-mirror-row.kh-disabled-row {
  opacity: 0.46;
  filter: grayscale(0.5);
}

.kh-mirror-row.kh-focused {
  outline: 2px solid var(--kh-gold-bright);
  outline-offset: 1px;
  box-shadow: 0 0 0 3px rgba(229, 185, 82, 0.24);
}

.kh-mirror-side-btn {
  min-width: 90px;
  min-height: 48px;
  padding: 6px 10px;
  border-radius: 2px;
  border: 1.5px solid #b25cff;
  background: linear-gradient(180deg, rgba(108, 42, 178, 0.52), rgba(48, 18, 86, 0.68));
  color: #eedbff;
  font-family: var(--kh-font-display);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.kh-mirror-side-btn[data-side="b"] {
  border-color: var(--kh-gold);
  background: linear-gradient(180deg, rgba(168, 28, 46, 0.56), rgba(92, 34, 16, 0.68));
  color: var(--kh-gold-bright);
}

.kh-mirror-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.kh-mirror-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.kh-mirror-name {
  font-family: var(--kh-font-display);
  font-size: 14px;
  font-weight: 700;
  color: #e8ccff;
}

.kh-mirror-name[data-side="b"] {
  color: var(--kh-gold-bright);
}

.kh-tag-mirror-rank {
  color: #6ef5b8;
}

.kh-mirror-pips[data-side="a"] .kh-rank-pip.kh-filled {
  background: linear-gradient(90deg, #9846ff, #e4c4ff);
  border-color: #e4c4ff;
  box-shadow: 0 0 6px rgba(178, 92, 255, 0.6);
}

.kh-mirror-desc {
  font-family: var(--kh-font-ui);
  font-size: 13px;
  color: var(--kh-text-secondary);
}

.kh-mirror-up-btn {
  min-width: 138px;
  font-size: 11px;
  padding: 6px 12px;
}

/* Shrine of Torment Rows */
.kh-shrine-callouts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.kh-shrine-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.kh-shrine-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 3px;
  background: linear-gradient(120deg, rgba(28, 16, 22, 0.94), rgba(15, 9, 14, 0.96));
  border: 1.5px solid rgba(158, 110, 46, 0.42);
}

.kh-shrine-row.kh-active-vow {
  border-color: rgba(255, 118, 62, 0.85);
  background: linear-gradient(120deg, rgba(84, 24, 18, 0.92) 0%, rgba(24, 12, 18, 0.96) 100%);
  box-shadow: inset 0 0 18px rgba(255, 100, 44, 0.16);
}

.kh-shrine-row.kh-focused {
  outline: 2px solid var(--kh-gold-bright);
  outline-offset: 1px;
}

.kh-shrine-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.kh-shrine-top {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.kh-shrine-name {
  font-family: var(--kh-font-display);
  font-size: 13px;
  font-weight: 700;
  color: var(--kh-text-primary);
}

.kh-active-vow .kh-shrine-name {
  color: #ffd59c;
}

.kh-tag-heat-on {
  color: #ff9d66;
  border-color: rgba(255, 134, 62, 0.65);
}

.kh-shrine-desc {
  font-family: var(--kh-font-ui);
  font-size: 12.5px;
  color: var(--kh-text-secondary);
}

.kh-stepper {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.kh-step-btn {
  min-width: 48px;
  min-height: 48px;
  border-radius: 2px;
  border: 1.5px solid var(--kh-bronze);
  background: linear-gradient(180deg, rgba(39, 25, 42, 0.96), rgba(14, 9, 18, 0.98));
  color: var(--kh-gold-bright);
  font-family: var(--kh-font-num);
  font-size: 20px;
  font-weight: 900;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.kh-step-btn:hover:not(:disabled) {
  border-color: var(--kh-gold-bright);
  background: rgba(126, 26, 36, 0.92);
}

.kh-step-btn:disabled {
  opacity: 0.32;
  cursor: not-allowed;
}

.kh-step-rank {
  min-width: 36px;
  text-align: center;
  font-family: var(--kh-font-num);
  font-variant-numeric: tabular-nums;
  font-size: 15px;
  font-weight: 800;
  color: var(--kh-gold-bright);
}

/* Keepsake Cabinet Grid (Velvet-Crimson & Hammered-Gold Compartments) */
.kh-keepsake-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.kh-keepsake-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 7px;
  min-height: 126px;
  padding: 10px 11px;
  text-align: left;
  border-radius: 3px;
  background: linear-gradient(160deg, rgba(46, 16, 30, 0.94) 0%, rgba(16, 9, 19, 0.97) 100%);
  border: 1.5px solid rgba(158, 110, 46, 0.52);
  border-top: 3px solid var(--kh-relic-accent, var(--kh-gold));
  color: var(--kh-text-primary);
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.12s ease, box-shadow 0.12s ease;
}

.kh-keepsake-card.kh-equipped {
  border-color: var(--kh-gold-bright);
  box-shadow: inset 0 0 22px rgba(229, 185, 82, 0.22), 0 0 16px rgba(229, 185, 82, 0.26);
}

.kh-keepsake-card.kh-locked {
  opacity: 0.45;
  cursor: not-allowed;
}

.kh-keepsake-card.kh-focused,
.kh-keepsake-card:hover:not(.kh-locked) {
  outline: 2px solid var(--kh-gold-bright);
  outline-offset: 2px;
  transform: translateY(-1px);
}

.kh-keepsake-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.kh-keepsake-name-wrap {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.kh-keepsake-gem {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kh-keepsake-name {
  font-family: var(--kh-font-display);
  font-size: 12px;
  font-weight: 700;
  color: var(--kh-text-primary);
  line-height: 1.2;
}

.kh-keepsake-stars {
  font-size: 11px;
  color: var(--kh-gold-bright);
  letter-spacing: 1px;
  flex-shrink: 0;
}

.kh-keepsake-desc {
  font-family: var(--kh-font-ui);
  font-size: 12.5px;
  line-height: 1.35;
  color: var(--kh-text-secondary);
}

.kh-keepsake-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--kh-font-num);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.07em;
}

/* Shop & Codex Cards */
.kh-shop-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.kh-shop-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 80px;
  padding: 12px 15px;
  border-radius: 3px;
  background: linear-gradient(120deg, rgba(22, 34, 42, 0.95) 0%, rgba(12, 11, 22, 0.98) 100%);
  border: 1.5px solid rgba(229, 185, 82, 0.56);
  color: var(--kh-text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s ease, transform 0.1s ease;
}

.kh-shop-card-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.kh-shop-name-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.kh-shop-sigil {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.kh-shop-item-title {
  font-family: var(--kh-font-display);
  font-size: 14.5px;
  font-weight: 700;
  color: var(--kh-text-primary);
}

.kh-shop-item-sub {
  font-family: var(--kh-font-lore);
  font-style: italic;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--kh-text-secondary);
}

.kh-shop-card.kh-borrow-card {
  border-color: rgba(240, 46, 70, 0.85);
  background: linear-gradient(120deg, rgba(102, 16, 30, 0.92) 0%, rgba(30, 11, 20, 0.98) 100%);
}

.kh-shop-borrow-title {
  font-family: var(--kh-font-display);
  font-size: 14.5px;
  font-weight: 900;
  color: var(--kh-gold-bright);
}

.kh-shop-borrow-warn {
  font-family: var(--kh-font-ui);
  font-size: 12.5px;
  font-weight: 600;
  color: #ffb8c0;
}

.kh-shop-card.kh-unaffordable {
  opacity: 0.52;
}

.kh-shop-card.kh-focused,
.kh-shop-card:hover:not(:disabled) {
  outline: 2px solid var(--kh-gold-bright);
  outline-offset: 2px;
  transform: translateY(-1px);
}

.kh-codex-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.kh-codex-entry {
  padding: 10px 12px;
  border-radius: 3px;
  background: linear-gradient(155deg, rgba(31, 21, 42, 0.86), rgba(14, 10, 21, 0.94));
  border: 1px solid rgba(158, 110, 46, 0.38);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.kh-codex-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 20px;
  font-family: var(--kh-font-lore);
  font-style: italic;
  font-size: 16px;
  color: var(--kh-text-secondary);
}

.kh-codex-boss {
  border-color: rgba(229, 185, 82, 0.72);
}

.kh-codex-entry-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kh-codex-entry-title {
  font-family: var(--kh-font-display);
  font-size: 12.5px;
  font-weight: 700;
}

.kh-codex-entry-sub {
  font-family: var(--kh-font-num);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--kh-gold);
}

.kh-codex-entry-desc {
  font-family: var(--kh-font-ui);
  font-size: 12.5px;
  line-height: 1.35;
  color: var(--kh-text-secondary);
}

.kh-codex-kills {
  font-family: var(--kh-font-num);
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #6ef5b8;
}

/* ============================================================================
   MATHEMATICAL RESPONSIVE BREAKPOINTS (Section 5.5 — ZERO OVERLAP / ZERO TRUNCATION)
   ============================================================================ */

/* 1. TESLA TOUCH & TABLET / WIDE TOUCHSCREENS (1280x720, 1440x900, and tablets >= 681px) */
.kh-hud.kh-touch-active .kh-hud-bottomleft {
  top: max(10px, env(safe-area-inset-top, 0px));
  bottom: auto;
  left: max(12px, env(safe-area-inset-left, 0px));
  width: 292px;
  flex-direction: column-reverse;
  gap: 5px;
}

.kh-hud.kh-touch-active .kh-hud-topright,
.kh-hud-topright.kh-touch-offset {
  top: max(10px, env(safe-area-inset-top, 0px));
  right: max(72px, calc(env(safe-area-inset-right, 0px) + 72px));
  max-width: 228px;
}

.kh-hud.kh-touch-active .kh-top-center-stack {
  top: max(10px, env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  width: min(530px, calc(100vw - 644px));
}

.kh-hud.kh-touch-active .kh-boon-medallion {
  width: 28px;
  height: 28px;
}

.kh-hud.kh-touch-active .kh-boss-name {
  font-size: 14.5px;
}

.kh-hud.kh-touch-active .kh-boss-subtitle {
  font-size: 13px;
}

.kh-hud.kh-touch-active .kh-chamber-pill {
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  white-space: normal;
  padding: 5px 10px;
  gap: 2px;
}

.kh-hud.kh-touch-active .kh-biome-name {
  font-size: 11.5px;
}

.kh-hud.kh-touch-active .kh-chamber-depth {
  font-size: 11px;
  border-left: none;
  padding-left: 0;
}

/* 2. MOBILE LANDSCAPE (844x390 — max-height: 500px) */
@media (max-height: 500px) {
  .kh-title-overlay {
    padding: 8px 18px;
  }
  .kh-title-pillar {
    padding: 6px 12px 6px 0;
    gap: 6px;
    max-width: 440px;
  }
  .kh-title-crest-art svg {
    width: 102px;
    height: 38px;
  }
  .kh-title-word-top { font-size: 20px; }
  .kh-title-word-main { font-size: 26px; }
  .kh-title-sub { font-size: 14px; }
  .kh-title-menu { gap: 5px; margin-top: 2px; }
  .kh-title-menu .kh-btn {
    min-height: 48px;
    padding: 6px 14px;
    font-size: 11.5px;
  }

  /* Touch-Active Mobile Landscape Exact 3-Corridor Geometry */
  .kh-hud.kh-touch-active .kh-hud-bottomleft {
    top: max(6px, env(safe-area-inset-top, 0px));
    bottom: auto;
    left: max(8px, env(safe-area-inset-left, 0px));
    width: 212px;
    flex-direction: column-reverse;
    gap: 4px;
  }

  .kh-hud:not(.kh-touch-active) .kh-hud-bottomleft {
    width: 270px;
    left: 10px;
    bottom: 8px;
    gap: 4px;
  }

  .kh-hud.kh-touch-active .kh-hud-topright,
  .kh-hud-topright.kh-touch-offset {
    top: max(6px, env(safe-area-inset-top, 0px));
    right: max(62px, calc(env(safe-area-inset-right, 0px) + 62px));
    max-width: 196px;
    gap: 4px;
  }

  .kh-hud.kh-touch-active .kh-top-center-stack {
    top: max(6px, env(safe-area-inset-top, 0px));
    left: 226px;
    right: 264px;
    transform: none;
    width: auto;
    gap: 4px;
  }

  .kh-hud:not(.kh-touch-active) .kh-top-center-stack {
    top: 6px;
    width: min(440px, calc(100vw - 440px));
    gap: 4px;
  }

  /* Compact Hero Frame & Medallion Rail */
  .kh-hero-frame {
    padding: 5px 7px;
  }
  .kh-hero-top-row {
    margin-bottom: 3px;
    gap: 4px;
  }
  .kh-weapon-icon {
    width: 17px;
    height: 17px;
  }
  .kh-weapon-icon svg {
    width: 13px;
    height: 13px;
  }
  .kh-weapon-tag {
    font-size: 9.5px;
    letter-spacing: 0.04em;
  }
  .kh-godmode-badge {
    font-size: 9px;
    padding: 1px 4px;
  }
  .kh-dd-skull {
    width: 13px;
    height: 13px;
  }
  .kh-hp-wing svg {
    width: 14px;
    height: 14px;
  }
  .kh-hp-track {
    height: 15px;
  }
  .kh-hp-text {
    font-size: 11px;
    padding: 0 6px;
  }
  .kh-resources-row {
    margin-top: 3px;
    gap: 4px;
  }
  .kh-pip-label {
    font-size: 8px;
  }
  .kh-bloodstone-socket svg {
    width: 12px;
    height: 14px;
  }
  .kh-dash-wing svg {
    width: 16px;
    height: 11px;
  }
  .kh-god-gauge-wrap {
    margin-top: 3px;
  }
  .kh-god-gauge-header {
    font-size: 8px;
    margin-bottom: 2px;
  }
  .kh-god-gauge-status {
    font-size: 9.5px;
  }
  .kh-god-seg {
    height: 5px;
  }

  .kh-boon-strip {
    gap: 4px;
    flex-wrap: nowrap;
  }
  .kh-boon-medallion {
    width: 24px;
    height: 24px;
  }
  .kh-boon-medallion-sigil svg {
    width: 13px;
    height: 13px;
  }
  .kh-boon-medallion-slot {
    font-size: 7px;
    height: 10px;
    line-height: 8px;
  }

  /* Compact Top-Right Chamber Pill */
  .kh-chamber-pill {
    padding: 3px 8px;
    gap: 4px;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
  }
  .kh-biome-name {
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .kh-chamber-depth {
    font-size: 10px;
    border-left: none;
    padding-left: 0;
  }
  .kh-currency-chip {
    padding: 2px 7px;
    font-size: 11.5px;
  }

  /* Compact Dual Boss Bars inside 354px Landscape Corridor (ZERO truncation!) */
  .kh-boss-stack {
    gap: 4px;
  }
  .kh-boss-bar-card {
    padding: 4px 8px 5px;
  }
  .kh-boss-crown svg {
    width: 19px;
    height: 15px;
  }
  .kh-boss-crown-left { margin-right: -2px; margin-left: -2px; }
  .kh-boss-crown-right { margin-left: -2px; margin-right: -2px; }
  .kh-boss-header {
    margin-bottom: 3px;
    gap: 6px;
    align-items: flex-start;
  }
  .kh-boss-title-group {
    flex-direction: column;
    gap: 0;
  }
  .kh-boss-name {
    font-size: 12px;
    letter-spacing: 0.06em;
  }
  .kh-boss-subtitle {
    font-size: 11px;
    line-height: 1.1;
  }
  .kh-boss-phase-badge {
    font-size: 11px;
  }
  .kh-boss-hp-track {
    height: 13px;
  }
  .kh-boss-hp-pill {
    height: 11px;
    font-size: 9.5px;
    padding: 0 6px;
  }

  /* Unwrapped, cleanly balanced toasts inside landscape corridor */
  .kh-toast {
    padding: 4px 16px;
    font-size: 10px;
    letter-spacing: 0.05em;
    line-height: 1.22;
  }
  .kh-toast::before { left: 5px; font-size: 6px; }
  .kh-toast::after { right: 5px; font-size: 6px; }

  /* Compact Modals for Landscape */
  .kh-boon-shell {
    grid-template-columns: 185px 1fr;
    gap: 12px;
    padding: 10px 14px;
  }
  .kh-boon-portrait-col { min-height: 180px; }
  .kh-boon-card { min-height: 62px; padding: 8px 10px; }
  .kh-boon-card-sigil { width: 36px; height: 36px; }
  .kh-boon-sigil-img { width: 28px; height: 28px; }
  .kh-hud-sigil-img { width: 17px; height: 17px; }
  .kh-hud-weapon-img { width: 14px; height: 14px; }
  .kh-boon-name { font-size: 13.5px; }
  .kh-boon-desc { font-size: 12px; }
  .kh-modal-panel { padding: 10px 14px; gap: 7px; }
  .kh-options-grid { gap: 5px 10px; }
  .kh-option-row { min-height: 48px; padding: 3px 8px; }
  .kh-meta-shell { padding: 10px 14px; gap: 6px; }
  .kh-dock-btn { padding: 4px 8px; font-size: 10px; }
  .kh-keepsake-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .kh-keepsake-card { min-height: 88px; padding: 7px 8px; }
}

/* 3. MOBILE PORTRAIT (390x844 — max-width: 680px) — 2-ROW STACK, ZERO COLLISIONS */
@media (max-width: 680px) {
  .kh-title-overlay {
    padding: 14px 16px;
    background: linear-gradient(180deg, rgba(9, 6, 14, 0.88) 0%, rgba(9, 6, 14, 0.72) 55%, rgba(9, 6, 14, 0.94) 100%);
  }
  .kh-title-pillar {
    padding: 8px 0;
    max-width: 100%;
    align-items: center;
    text-align: center;
  }
  .kh-title-heading {
    align-items: center;
  }
  .kh-title-pack-row {
    grid-template-columns: 1fr;
  }

  /* Row 1 Left: Hero Frame + Single-Row Boon Strip (top: 8px, left: 8px, width: 204px) */
  .kh-hud.kh-touch-active .kh-hud-bottomleft {
    top: max(8px, env(safe-area-inset-top, 0px));
    bottom: auto;
    left: max(8px, env(safe-area-inset-left, 0px));
    width: 204px;
    flex-direction: column-reverse;
    gap: 4px;
  }

  .kh-hud:not(.kh-touch-active) .kh-hud-bottomleft {
    left: 8px;
    bottom: 8px;
    width: calc(100vw - 16px);
  }

  /* Row 1 Right: Compact Biome + Currency Pill (top: 8px, right: 62px, width: 112px — clears 48px pause at right: 8px) */
  .kh-hud.kh-touch-active .kh-hud-topright,
  .kh-hud-topright.kh-touch-offset {
    top: max(8px, env(safe-area-inset-top, 0px));
    right: max(62px, calc(env(safe-area-inset-right, 0px) + 62px));
    width: 112px;
    max-width: 112px;
    gap: 4px;
  }

  .kh-hud:not(.kh-touch-active) .kh-hud-topright {
    top: 8px;
    right: 8px;
    max-width: 180px;
  }

  .kh-chamber-pill {
    width: 100%;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
    padding: 4px 7px;
    gap: 1px;
  }
  .kh-biome-name {
    font-size: 9.5px;
    letter-spacing: 0.04em;
    line-height: 1.15;
    white-space: normal;
  }
  .kh-chamber-depth {
    font-size: 9.5px;
    border-left: none;
    padding-left: 0;
  }
  .kh-currency-row {
    gap: 3px;
    flex-wrap: nowrap;
  }
  .kh-currency-chip {
    padding: 2px 5px;
    font-size: 10.5px;
    gap: 3px;
  }
  .kh-currency-chip svg {
    width: 11px;
    height: 11px;
  }

  /* Compact Hero Frame — Full Unwrapped Weapon Name (NEVER "STYG..."), total height <= 86px */
  .kh-hero-frame {
    padding: 5px 7px;
  }
  .kh-hero-top-row {
    margin-bottom: 3px;
    gap: 3px;
    align-items: center;
  }
  .kh-hero-weapon-group {
    gap: 4px;
  }
  .kh-weapon-icon {
    width: 16px;
    height: 16px;
  }
  .kh-weapon-icon svg {
    width: 12px;
    height: 12px;
  }
  .kh-weapon-tag {
    font-size: 9.5px;
    letter-spacing: 0.03em;
    line-height: 1.1;
    white-space: normal;
  }
  .kh-godmode-badge {
    font-size: 8.5px;
    padding: 1px 4px;
  }
  .kh-dd-row {
    gap: 2px;
  }
  .kh-dd-skull {
    width: 13px;
    height: 13px;
  }
  .kh-hp-wing svg {
    width: 13px;
    height: 14px;
  }
  .kh-hp-track {
    height: 15px;
  }
  .kh-hp-text {
    font-size: 11px;
    padding: 0 5px;
  }
  .kh-resources-row {
    margin-top: 3px;
    gap: 4px;
  }
  .kh-pip-group {
    gap: 2px;
  }
  .kh-pip-label {
    font-size: 8px;
    margin-right: 1px;
  }
  .kh-bloodstone-socket svg {
    width: 12px;
    height: 14px;
  }
  .kh-dash-wing svg {
    width: 15px;
    height: 11px;
  }
  .kh-god-gauge-wrap {
    margin-top: 3px;
  }
  .kh-god-gauge-header {
    font-size: 8px;
    margin-bottom: 2px;
  }
  .kh-god-gauge-status {
    font-size: 9.5px;
  }
  .kh-god-seg {
    height: 5px;
  }

  /* Single-row Boon Medallions tucked neatly right below Hero Frame (y ~96..122px) */
  .kh-boon-strip {
    flex-wrap: nowrap;
    gap: 3px;
    overflow: hidden;
  }
  .kh-boon-medallion {
    width: 24px;
    height: 24px;
  }
  .kh-boon-medallion-sigil svg {
    width: 13px;
    height: 13px;
  }
  .kh-boon-medallion-slot {
    font-size: 7px;
    height: 10px;
    line-height: 8px;
    padding: 0 2px;
  }

  /* Row 2: Full-Width Boss Bars + Unwrapped Toasts STRICTLY BELOW Row 1 (top: 132px) */
  .kh-hud.kh-touch-active .kh-top-center-stack {
    top: max(132px, calc(env(safe-area-inset-top, 0px) + 132px));
    left: 8px;
    right: 8px;
    transform: none;
    width: auto;
    gap: 6px;
  }

  .kh-hud:not(.kh-touch-active) .kh-top-center-stack {
    top: 86px;
    left: 8px;
    right: 8px;
    transform: none;
    width: auto;
    gap: 6px;
  }

  .kh-boss-stack {
    gap: 5px;
  }
  .kh-boss-bar-card {
    padding: 5px 8px 6px;
  }
  .kh-boss-crown svg {
    width: 20px;
    height: 16px;
  }
  .kh-boss-crown-left { margin-right: -2px; margin-left: -2px; }
  .kh-boss-crown-right { margin-left: -2px; margin-right: -2px; }
  .kh-boss-header {
    margin-bottom: 4px;
    gap: 6px;
  }
  .kh-boss-name {
    font-size: 13px;
    letter-spacing: 0.06em;
  }
  .kh-boss-subtitle {
    font-size: 11.5px;
  }
  .kh-boss-phase-badge {
    font-size: 11.5px;
  }
  .kh-boss-hp-track {
    height: 14px;
  }
  .kh-boss-hp-pill {
    height: 12px;
    font-size: 10px;
  }

  .kh-toast {
    padding: 5px 18px;
    font-size: 11px;
    letter-spacing: 0.06em;
  }

  .kh-hub-dock {
    max-width: calc(100vw - 16px);
    overflow-x: auto;
  }
  .kh-dock-btn {
    padding: 5px 8px;
    font-size: 10px;
  }
}

@media (max-width: 720px) {
  .kh-boon-shell {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .kh-boon-portrait-col {
    min-height: 108px;
  }
  .kh-options-grid {
    grid-template-columns: 1fr;
  }
  .kh-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .kh-aspect-grid,
  .kh-shrine-grid,
  .kh-shop-grid {
    grid-template-columns: 1fr;
  }
  .kh-keepsake-grid,
  .kh-codex-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .kh-btn,
  .kh-title-keyart-img,
  .kh-boon-card,
  .kh-boon-card-enter,
  .kh-boon-shimmer,
  .kh-portrait-enter,
  .kh-boss-invuln-shimmer,
  .kh-hp-fill,
  .kh-boss-hp-fill,
  .kh-toast {
    transition: none !important;
    animation: none !important;
  }
}
`;

const PRELOAD_FONT_SPECS = [
  '400 16px "Cinzel"',
  '700 16px "Cinzel"',
  '900 16px "Cinzel"',
  '700 16px "Cinzel Decorative"',
  '900 16px "Cinzel Decorative"',
  '400 16px "Alegreya Sans"',
  '500 16px "Alegreya Sans"',
  '700 16px "Alegreya Sans"',
  '700 16px "Barlow Condensed"',
  '800 16px "Barlow Condensed"',
  '900 16px "Barlow Condensed"',
  '600 16px "Cormorant Garamond"',
  'italic 600 16px "Cormorant Garamond"',
] as const;

export function injectUiStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (!document.getElementById(UI_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = UI_STYLE_ID;
    style.textContent = MYTHIC_UI_CSS;
    document.head.appendChild(style);
  }
  // Eagerly warm all 5 self-hosted OFL WOFF2 font families (including 900 combat glyph weights)
  if (document.fonts && typeof document.fonts.load === 'function') {
    for (const spec of PRELOAD_FONT_SPECS) {
      void document.fonts.load(spec).catch(() => {});
    }
  }
}
