const UI_STYLE_ID = 'kh-mythic-ui-styles';

// Inline Greek Meander SVG data URI (burnished gold on transparent)
const MEANDER_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="10" viewBox="0 0 24 10" fill="none"><path d="M0 9H24M1 1H11V7H5V4H8M13 1H23V7H17V4H20" stroke="#d99f4c" stroke-opacity="0.58" stroke-width="1.2"/></svg>`
);

export const MYTHIC_UI_CSS = `
:root {
  --kh-bg-obsidian: rgba(11, 9, 18, 0.92);
  --kh-bg-panel: rgba(17, 13, 27, 0.94);
  --kh-bg-card: rgba(24, 18, 36, 0.92);
  --kh-ink: #06050a;
  --kh-gold: #d99f4c;
  --kh-gold-bright: #f5cb70;
  --kh-gold-dim: rgba(217, 159, 76, 0.36);
  --kh-crimson: #d82f3c;
  --kh-crimson-bright: #ff4f5c;
  --kh-ivory: #f5ede0;
  --kh-ash: #b8aea2;
  --kh-font-display: 'Cinzel', 'Trajan Pro', 'Palatino Linotype', 'Book Antiqua', Georgia, 'Times New Roman', serif;
  --kh-font-sans: 'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;

  /* Rarity Palette */
  --kh-rarity-common: #b69d81;
  --kh-rarity-rare: #3b96ff;
  --kh-rarity-epic: #ae5cff;
  --kh-rarity-heroic: #eb4754;
  --kh-rarity-duo: #3ee491;
  --kh-rarity-legendary: #ffb133;
}

#ui-root {
  font-family: var(--kh-font-sans);
  color: var(--kh-ivory);
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
  opacity: 0.85;
  pointer-events: none;
}

/* Shared Mythic Buttons & Focus Outlines */
.kh-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 48px;
  padding: 10px 22px;
  border: 1.5px solid rgba(217, 159, 76, 0.62);
  border-radius: 3px;
  background: linear-gradient(180deg, rgba(35, 25, 48, 0.94) 0%, rgba(16, 12, 24, 0.96) 100%);
  color: var(--kh-ivory);
  font-family: var(--kh-font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  cursor: pointer;
  pointer-events: auto;
  box-shadow:
    inset 0 1px 0 rgba(255, 232, 180, 0.16),
    0 4px 16px rgba(0, 0, 0, 0.55);
  transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.14s ease, background 0.14s ease;
  -webkit-tap-highlight-color: transparent;
}

.kh-btn:hover:not(:disabled),
.kh-btn.kh-focused:not(:disabled),
.kh-btn:focus-visible:not(:disabled) {
  outline: 2px solid var(--kh-gold-bright);
  outline-offset: 2px;
  border-color: var(--kh-gold-bright);
  background: linear-gradient(180deg, rgba(64, 34, 46, 0.96) 0%, rgba(28, 16, 30, 0.98) 100%);
  box-shadow:
    0 0 0 4px rgba(245, 203, 112, 0.22),
    0 0 24px rgba(245, 203, 112, 0.36),
    inset 0 1px 0 rgba(255, 240, 200, 0.3);
  transform: translateY(-1px);
}

.kh-btn:active:not(:disabled) {
  transform: translateY(1px) scale(0.99);
}

.kh-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  filter: grayscale(0.4);
}

.kh-btn-primary {
  border-color: var(--kh-gold-bright);
  background: linear-gradient(180deg, rgba(132, 30, 42, 0.96) 0%, rgba(74, 15, 26, 0.98) 100%);
  color: #fff6e3;
}

.kh-btn-primary:hover:not(:disabled),
.kh-btn-primary.kh-focused:not(:disabled),
.kh-btn-primary:focus-visible:not(:disabled) {
  background: linear-gradient(180deg, rgba(168, 38, 52, 0.98) 0%, rgba(98, 20, 32, 0.98) 100%);
}

.kh-btn-danger {
  border-color: rgba(235, 71, 84, 0.72);
  color: #ffd5d8;
}

.kh-btn-sm {
  min-height: 40px;
  padding: 6px 12px;
  font-size: 11px;
  letter-spacing: 0.08em;
}

/* ============================================================================
   HUD OVERLAY
   ============================================================================ */

.kh-hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 12;
  padding:
    max(14px, env(safe-area-inset-top, 0px))
    max(16px, env(safe-area-inset-right, 0px))
    max(14px, env(safe-area-inset-bottom, 0px))
    max(16px, env(safe-area-inset-left, 0px));
}

/* Top-Center Boss Health Bar */
.kh-boss-stack {
  position: fixed;
  top: max(14px, calc(env(safe-area-inset-top, 0px) + 10px));
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, 68vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.kh-boss-bar-card {
  background: linear-gradient(180deg, rgba(16, 10, 22, 0.88) 0%, rgba(10, 7, 14, 0.82) 100%);
  border: 1.5px solid rgba(217, 159, 76, 0.72);
  border-radius: 3px;
  padding: 8px 14px 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.68), inset 0 1px 0 rgba(255, 228, 174, 0.16);
}

.kh-boss-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.kh-boss-title-group {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.kh-boss-name {
  font-family: var(--kh-font-display);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #ffe8b8;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
}

.kh-boss-subtitle {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--kh-ash);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kh-boss-phase-badge {
  font-family: var(--kh-font-display);
  font-size: 11px;
  font-weight: 700;
  color: var(--kh-gold-bright);
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.kh-boss-armor-track {
  position: relative;
  height: 6px;
  border-radius: 2px;
  background: rgba(255, 210, 96, 0.14);
  border: 1px solid rgba(245, 203, 112, 0.55);
  margin-bottom: 4px;
  overflow: hidden;
}

.kh-boss-armor-fill {
  height: 100%;
  background: linear-gradient(90deg, #e09c2b 0%, #ffe078 65%, #fff5c2 100%);
  transition: width 0.1s linear;
}

.kh-boss-hp-track {
  position: relative;
  height: 16px;
  border-radius: 2px;
  background: rgba(24, 9, 14, 0.92);
  border: 1.5px solid rgba(217, 159, 76, 0.7);
  overflow: hidden;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.78);
}

.kh-boss-hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b1322 0%, #d82b3a 60%, #ff5a5f 100%);
  transition: width 0.09s linear;
}

.kh-boss-notch {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  z-index: 1;
  background: rgba(255, 232, 168, 0.85);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.95);
  pointer-events: none;
}

.kh-boss-hp-text {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #fff6ea;
  text-shadow: 0 1px 3px #000;
  pointer-events: none;
}

.kh-boss-hp-pill {
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  height: 14px;
  border-radius: 2px;
  background: rgba(11, 8, 18, 0.9);
  border: 1px solid rgba(217, 159, 76, 0.45);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.78);
  line-height: 1;
}

/* Top-Right Chamber / Biome / Currencies / FPS Readout */
.kh-hud-topright {
  position: fixed;
  top: max(12px, calc(env(safe-area-inset-top, 0px) + 8px));
  right: max(14px, calc(env(safe-area-inset-right, 0px) + 10px));
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.kh-hud-topright.kh-touch-offset,
.kh-hud.kh-touch-active .kh-hud-topright {
  right: max(92px, calc(env(safe-area-inset-right, 0px) + 88px));
}

.kh-chamber-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  background: linear-gradient(90deg, rgba(15, 11, 24, 0.78) 0%, rgba(12, 9, 19, 0.92) 100%);
  border: 1px solid rgba(217, 159, 76, 0.52);
  border-right: 3px solid var(--kh-gold);
  border-radius: 3px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.52);
}

.kh-biome-name {
  font-family: var(--kh-font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.kh-chamber-depth {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--kh-gold-bright);
  padding-left: 8px;
  border-left: 1px solid rgba(217, 159, 76, 0.35);
}

.kh-heat-pill {
  padding: 2px 7px;
  border-radius: 2px;
  background: rgba(185, 42, 42, 0.34);
  border: 1px solid rgba(255, 108, 72, 0.65);
  color: #ffb899;
  font-size: 11px;
  font-weight: 700;
}

.kh-currency-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kh-currency-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 3px;
  background: rgba(12, 9, 20, 0.84);
  border: 1px solid rgba(217, 159, 76, 0.38);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}

.kh-currency-gold {
  color: #ffd866;
}
.kh-currency-darkness {
  color: #c88cff;
}
.kh-currency-fps {
  color: #8ceec9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}

/* Bottom-Left Ornate Hero HUD (moves cleanly to Top-Left when touch controls are active) */
.kh-hud-bottomleft {
  position: fixed;
  left: max(16px, calc(env(safe-area-inset-left, 0px) + 12px));
  bottom: max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px));
  display: flex;
  flex-direction: column;
  gap: 7px;
  width: min(350px, 46vw);
}

.kh-hud.kh-touch-active .kh-hud-bottomleft {
  top: max(12px, calc(env(safe-area-inset-top, 0px) + 8px));
  bottom: auto;
  left: max(14px, calc(env(safe-area-inset-left, 0px) + 10px));
  flex-direction: column-reverse;
  width: min(320px, 38vw);
}

.kh-hud.kh-touch-active .kh-boss-stack {
  width: min(440px, 40vw);
}

.kh-boon-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}

.kh-boon-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 3px;
  background: rgba(14, 11, 22, 0.88);
  border: 1.5px solid var(--kh-gold-dim);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--kh-ivory);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.kh-boon-dot {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  transform: rotate(45deg);
  flex-shrink: 0;
}

.kh-hero-frame {
  background: linear-gradient(135deg, rgba(19, 13, 28, 0.92) 0%, rgba(10, 8, 16, 0.88) 100%);
  border: 1.5px solid rgba(217, 159, 76, 0.65);
  border-left: 4px solid var(--kh-gold);
  border-radius: 4px;
  padding: 10px 12px;
  box-shadow:
    0 8px 26px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 228, 174, 0.16);
}

.kh-hero-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.kh-weapon-tag {
  font-family: var(--kh-font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kh-dd-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.kh-dd-skull {
  width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 5px rgba(255, 92, 92, 0.55));
}

.kh-dd-skull.kh-spent {
  opacity: 0.28;
  filter: grayscale(1);
}

.kh-godmode-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 2px;
  background: rgba(245, 203, 112, 0.18);
  border: 1px solid rgba(245, 203, 112, 0.6);
  color: #ffe8a3;
}

/* HP Bar */
.kh-hp-track {
  position: relative;
  height: 20px;
  border-radius: 3px;
  background: rgba(28, 9, 14, 0.94);
  border: 1.5px solid rgba(217, 159, 76, 0.72);
  overflow: hidden;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.76);
}

.kh-hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #8b1624 0%, #cf2638 55%, #f04854 100%);
  transition: width 0.12s ease-out;
}

.kh-hp-track.kh-hp-low .kh-hp-fill {
  animation: kh-low-hp-pulse 0.9s ease-in-out infinite;
}

.kh-hp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 9px;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
}

/* Sub-row: Bloodstones, Dash Pips, Rail Ammo */
.kh-resources-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 7px;
}

.kh-pip-group {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.kh-pip-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--kh-ash);
  margin-right: 2px;
}

.kh-bloodstone-pip {
  width: 11px;
  height: 14px;
  background: linear-gradient(180deg, #ff5d78 0%, #c81938 100%);
  clip-path: polygon(50% 0%, 100% 42%, 50% 100%, 0% 42%);
  box-shadow: 0 0 8px rgba(255, 76, 108, 0.75);
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.kh-bloodstone-pip.kh-empty {
  background: rgba(140, 82, 96, 0.25);
  box-shadow: none;
  opacity: 0.35;
}

.kh-dash-pip {
  width: 14px;
  height: 7px;
  border-radius: 2px;
  transform: skewX(-18deg);
  background: linear-gradient(90deg, #43d6f5 0%, #9df3ff 100%);
  box-shadow: 0 0 8px rgba(84, 224, 248, 0.6);
  transition: opacity 0.1s ease;
}

.kh-dash-pip.kh-empty {
  background: rgba(96, 140, 152, 0.24);
  box-shadow: none;
  opacity: 0.35;
}

.kh-rail-ammo {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #d6c4ff;
  padding: 1px 6px;
  border-radius: 2px;
  background: rgba(92, 68, 164, 0.28);
  border: 1px solid rgba(176, 154, 255, 0.5);
}

/* 4-Segment God Gauge */
.kh-god-gauge-wrap {
  margin-top: 7px;
}

.kh-god-gauge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--kh-ash);
  margin-bottom: 3px;
}

.kh-god-gauge-status.kh-ready {
  color: var(--kh-gold-bright);
  text-shadow: 0 0 8px rgba(245, 203, 112, 0.65);
}

.kh-god-gauge-segments {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.kh-god-seg {
  height: 7px;
  border-radius: 2px;
  background: rgba(24, 19, 34, 0.92);
  border: 1px solid rgba(217, 159, 76, 0.44);
  overflow: hidden;
}

.kh-god-seg-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #d99f4c 0%, #ffe680 100%);
  transition: width 0.1s linear;
}

.kh-god-gauge-wrap.kh-call-max .kh-god-seg {
  border-color: #fff0a8;
  box-shadow: 0 0 10px rgba(255, 214, 96, 0.55);
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
  max-width: 44vw;
}

.kh-prompt-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 3px;
  background: rgba(12, 9, 20, 0.82);
  border: 1px solid rgba(217, 159, 76, 0.36);
  font-size: 11px;
  color: #ded5c8;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.48);
}

.kh-prompt-chip.kh-highlight {
  border-color: var(--kh-gold-bright);
  color: #fff6d9;
  box-shadow: 0 0 14px rgba(245, 203, 112, 0.34);
}

.kh-keycap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 5px;
  border-radius: 3px;
  background: linear-gradient(180deg, #2b2238 0%, #161121 100%);
  border: 1px solid rgba(245, 203, 112, 0.56);
  color: #fff4da;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.kh-xbox-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 21px;
  height: 21px;
  padding: 0 5px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 800;
  color: #0b0812;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.45);
}
.kh-xbox-a { background: #4cd964; }
.kh-xbox-b { background: #ff4f58; color: #fff; }
.kh-xbox-x { background: #3aa0ff; color: #fff; }
.kh-xbox-y { background: #ffcc33; }
.kh-xbox-bumper {
  border-radius: 5px;
  background: #2e2840;
  color: #f4e6c9;
  border: 1px solid rgba(245, 203, 112, 0.65);
}

/* Contextual World Interact Banner */
.kh-interact-banner {
  position: fixed;
  left: 50%;
  bottom: max(96px, 16vh);
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px;
  border-radius: 4px;
  background: linear-gradient(180deg, rgba(22, 16, 34, 0.94) 0%, rgba(11, 8, 18, 0.96) 100%);
  border: 1.5px solid var(--kh-gold-bright);
  box-shadow: 0 6px 26px rgba(0, 0, 0, 0.72), 0 0 18px rgba(245, 203, 112, 0.25);
  font-family: var(--kh-font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #fff6e0;
  white-space: nowrap;
}

/* Event Toast Banner — sits cleanly top-center above playfield (drops below boss bar only when boss active) */
.kh-toast-container {
  position: fixed;
  top: max(14px, calc(env(safe-area-inset-top, 0px) + 10px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  pointer-events: none;
  z-index: 14;
}

.kh-hud.kh-has-boss .kh-toast-container {
  top: max(92px, calc(env(safe-area-inset-top, 0px) + 86px));
}

.kh-toast {
  padding: 6px 16px;
  border-radius: 3px;
  background: rgba(10, 8, 18, 0.9);
  border: 1px solid rgba(245, 203, 112, 0.62);
  border-left: 3px solid currentColor;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.78);
  font-family: var(--kh-font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-shadow: 0 1px 4px #000;
  white-space: nowrap;
  max-width: min(460px, 60vw);
  overflow: hidden;
  text-overflow: ellipsis;
  animation: kh-toast-in 0.14s ease-out;
}

@keyframes kh-low-hp-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.45); }
}

@keyframes kh-toast-in {
  from { opacity: 0.94; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ============================================================================
   TITLE SCREEN OVERLAY
   ============================================================================ */

.kh-title-overlay {
  position: fixed;
  inset: 0;
  z-index: 15;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding:
    max(22px, calc(env(safe-area-inset-top, 0px) + 18px))
    max(28px, calc(env(safe-area-inset-right, 0px) + 22px))
    max(18px, calc(env(safe-area-inset-bottom, 0px) + 14px))
    max(28px, calc(env(safe-area-inset-left, 0px) + 22px));
  background: radial-gradient(
    ellipse at 65% 42%,
    rgba(18, 12, 28, 0.22) 0%,
    rgba(10, 7, 16, 0.72) 58%,
    rgba(7, 5, 12, 0.92) 100%
  );
  pointer-events: auto;
}

.kh-title-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  max-width: min(820px, 92vw);
  gap: 16px;
}

.kh-title-crest {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--kh-font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
}

.kh-title-heading {
  margin: 0;
  padding-right: 0.1em;
  width: fit-content;
  max-width: 100%;
  font-family: var(--kh-font-display);
  font-size: clamp(26px, 4.3vw, 54px);
  font-weight: 800;
  line-height: 1.06;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  background: linear-gradient(180deg, #fff5dc 0%, #f1c46d 56%, #c87b33 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 4px 16px rgba(0, 0, 0, 0.88));
}

.kh-title-sub {
  margin: 0;
  font-family: var(--kh-font-display);
  font-size: clamp(12px, 1.4vw, 15px);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #d6c8b6;
  text-shadow: 0 2px 8px #000;
}

.kh-title-menu {
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: min(490px, 90vw);
  margin-top: 6px;
}

.kh-title-menu .kh-btn {
  justify-content: space-between;
  width: 100%;
  text-align: left;
}

.kh-title-pack-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.kh-title-pack-row .kh-btn {
  justify-content: center;
  text-align: center;
  white-space: nowrap;
  padding: 10px 14px;
  font-size: 12.5px;
  letter-spacing: 0.08em;
}

.kh-title-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(217, 159, 76, 0.28);
}

.kh-input-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 3px;
  background: rgba(16, 12, 26, 0.88);
  border: 1px solid rgba(217, 159, 76, 0.54);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
}

.kh-title-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--kh-ash);
}

/* ============================================================================
   MODAL BACKDROP & BOON SELECT MODAL
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
  background: radial-gradient(circle at 50% 50%, rgba(16, 11, 26, 0.78) 0%, rgba(5, 4, 9, 0.92) 100%);
  backdrop-filter: blur(4px);
  pointer-events: auto;
}

.kh-boon-shell {
  width: min(1040px, 95vw);
  max-height: 92vh;
  display: grid;
  grid-template-columns: minmax(220px, 310px) 1fr;
  gap: 20px;
  align-items: stretch;
  background: linear-gradient(160deg, rgba(20, 14, 30, 0.97) 0%, rgba(10, 8, 16, 0.98) 100%);
  border: 2px solid var(--kh-gold);
  border-radius: 5px;
  padding: 18px 20px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.85), 0 0 40px rgba(217, 159, 76, 0.16);
}

.kh-boon-portrait-col {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 4px;
  overflow: hidden;
  border: 1.5px solid rgba(217, 159, 76, 0.5);
  background: radial-gradient(circle at 50% 35%, rgba(245, 203, 112, 0.2), rgba(10, 8, 16, 0.95) 75%);
  min-height: 260px;
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
  padding-bottom: 54px;
}

.kh-boon-emblem {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 3px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--kh-font-display);
  font-size: 40px;
  font-weight: 800;
  background: rgba(10, 8, 16, 0.72);
  box-shadow: 0 0 32px currentColor;
}

.kh-boon-patron-plate {
  position: relative;
  z-index: 2;
  padding: 14px 14px 12px;
  background: linear-gradient(180deg, rgba(10, 8, 16, 0) 0%, rgba(10, 8, 16, 0.92) 38%, rgba(8, 6, 14, 0.98) 100%);
}

.kh-boon-patron-name {
  font-family: var(--kh-font-display);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.kh-boon-patron-title {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--kh-ash);
  margin-top: 2px;
}

.kh-boon-cards-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.kh-boon-offer-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.kh-boon-offer-title {
  margin: 0;
  font-family: var(--kh-font-display);
  font-size: 19px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
}

.kh-boon-offer-hint {
  font-size: 11px;
  color: var(--kh-ash);
  letter-spacing: 0.05em;
}

.kh-boon-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
  flex: 1;
}

.kh-boon-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  min-height: 78px;
  padding: 11px 14px;
  text-align: left;
  border-radius: 4px;
  border: 2px solid var(--kh-rarity-common);
  border-left-width: 6px;
  background: linear-gradient(95deg, rgba(28, 22, 42, 0.94) 0%, rgba(16, 12, 24, 0.96) 100%);
  color: var(--kh-ivory);
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.12s ease, box-shadow 0.14s ease, border-color 0.12s ease;
}

.kh-boon-card[data-rarity="common"] { border-color: var(--kh-rarity-common); }
.kh-boon-card[data-rarity="rare"] { border-color: var(--kh-rarity-rare); }
.kh-boon-card[data-rarity="epic"] { border-color: var(--kh-rarity-epic); }
.kh-boon-card[data-rarity="heroic"] {
  border-color: var(--kh-rarity-heroic);
  box-shadow: inset 0 0 18px rgba(235, 71, 84, 0.14);
}
.kh-boon-card[data-rarity="duo"] {
  border-color: var(--kh-rarity-duo);
  box-shadow: inset 0 0 18px rgba(62, 228, 145, 0.14);
}
.kh-boon-card[data-rarity="legendary"] {
  border-color: var(--kh-rarity-legendary);
  box-shadow: inset 0 0 22px rgba(255, 177, 51, 0.18);
}

.kh-boon-card:hover,
.kh-boon-card.kh-focused,
.kh-boon-card:focus-visible {
  outline: 2px solid var(--kh-gold-bright);
  outline-offset: 2px;
  transform: translateX(4px);
  box-shadow: 0 0 0 4px rgba(245, 203, 112, 0.2), 0 8px 26px rgba(0, 0, 0, 0.72);
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
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 8, 16, 0.9);
  border: 1px solid rgba(245, 203, 112, 0.65);
  color: var(--kh-gold-bright);
  font-family: var(--kh-font-display);
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.kh-boon-name {
  font-family: var(--kh-font-display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #fff6e5;
}

.kh-boon-badges {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.kh-boon-slot-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  color: #dfd6cb;
}

.kh-boon-rarity-pill {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 2px;
  background: rgba(8, 6, 14, 0.75);
}

.kh-boon-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.38;
  color: #dfd5c8;
}

.kh-boon-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

.kh-boon-stat {
  font-size: 12px;
  font-weight: 800;
  color: #79f7b8;
  letter-spacing: 0.03em;
}

.kh-boon-replace {
  font-size: 11px;
  font-weight: 700;
  color: #ffd37a;
}

.kh-boon-curse {
  font-size: 11px;
  font-weight: 700;
  color: #d8a6ff;
}

.kh-boon-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 2px;
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
  padding: 18px 22px;
  border-radius: 5px;
  background: linear-gradient(170deg, rgba(22, 15, 32, 0.97) 0%, rgba(10, 8, 16, 0.98) 100%);
  border: 2px solid var(--kh-gold);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.85), 0 0 36px rgba(217, 159, 76, 0.14);
}

.kh-modal-panel-narrow {
  width: min(440px, 92vw);
}

.kh-modal-panel-wide {
  width: min(820px, 95vw);
}

.kh-modal-title {
  margin: 0;
  text-align: center;
  font-family: var(--kh-font-display);
  font-size: clamp(20px, 3vw, 28px);
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--kh-gold-bright);
  text-shadow: 0 3px 12px rgba(0, 0, 0, 0.85);
}

.kh-modal-title.kh-victory-title {
  color: #82f5be;
}

.kh-modal-title.kh-death-title {
  color: #ff5864;
}

.kh-modal-subtitle {
  margin: -4px 0 2px;
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--kh-ash);
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

/* Options Grid */
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
  padding: 6px 11px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(217, 159, 76, 0.24);
  transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
}

.kh-option-row.kh-focused {
  border-color: var(--kh-gold-bright);
  background: rgba(245, 203, 112, 0.1);
  box-shadow: 0 0 0 2px rgba(245, 203, 112, 0.24);
}

.kh-option-label-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.kh-option-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--kh-ivory);
}

.kh-option-sub {
  font-size: 10px;
  color: var(--kh-gold-bright);
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
  border-radius: 3px;
  border: 1px solid rgba(217, 159, 76, 0.4);
  background: rgba(16, 12, 24, 0.9);
  color: var(--kh-ash);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.kh-seg-btn.kh-active {
  border-color: var(--kh-gold-bright);
  background: rgba(217, 159, 76, 0.26);
  color: #fff8e6;
}

.kh-slider-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.kh-slider {
  width: 96px;
  accent-color: var(--kh-gold-bright);
  cursor: pointer;
}

.kh-slider-val {
  width: 34px;
  text-align: right;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--kh-gold-bright);
}

/* Victory / Death Summary Stats Grid */
.kh-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.kh-stat-card {
  padding: 9px 11px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(217, 159, 76, 0.3);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kh-stat-key {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--kh-ash);
}

.kh-stat-val {
  font-family: var(--kh-font-display);
  font-size: 16px;
  font-weight: 700;
  color: #fff6e2;
  font-variant-numeric: tabular-nums;
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
  border-radius: 5px;
  background: rgba(9, 8, 15, 0.95);
  border: 1.5px solid var(--kh-gold);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.85);
  pointer-events: auto;
  overflow-y: auto;
  scrollbar-width: thin;
}

.kh-debug-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(217, 159, 76, 0.35);
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: #c8f5dc;
}

.kh-debug-section-title {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--kh-gold);
  margin: 2px 0 4px;
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
  border: 1px solid rgba(217, 159, 76, 0.42);
  background: rgba(24, 19, 36, 0.92);
  color: #f3eadc;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.kh-debug-btn:hover {
  border-color: var(--kh-gold-bright);
  background: rgba(62, 42, 74, 0.92);
}

.kh-debug-btn.kh-active {
  border-color: #6ef5b8;
  background: rgba(34, 112, 82, 0.55);
}

/* ============================================================================
   RESPONSIVE FIT (844x390 Mobile Landscape & Small Screens — ZERO Scrollbars)
   ============================================================================ */

@media (max-height: 500px) {
  .kh-title-overlay {
    padding: 10px 20px;
  }
  .kh-title-content {
    gap: 8px;
  }
  .kh-title-menu {
    gap: 5px;
  }
  .kh-title-menu .kh-btn {
    min-height: 48px;
    padding: 6px 16px;
    font-size: 12px;
  }
  .kh-boon-shell {
    grid-template-columns: 180px 1fr;
    gap: 12px;
    padding: 10px 14px;
  }
  .kh-boon-portrait-col {
    min-height: 180px;
  }
  .kh-boon-card {
    min-height: 60px;
    padding: 7px 10px;
  }
  .kh-boon-name {
    font-size: 13px;
  }
  .kh-boon-desc {
    font-size: 11px;
  }
  .kh-modal-panel {
    padding: 8px 12px;
    gap: 6px;
  }
  .kh-options-grid {
    gap: 4px 10px;
  }
  .kh-option-row {
    min-height: 48px;
    padding: 2px 8px;
  }
  .kh-hud-bottomleft {
    width: min(290px, 44vw);
  }
  .kh-hud.kh-touch-active .kh-hud-bottomleft {
    width: min(264px, 34vw);
    gap: 4px;
  }
  .kh-hud.kh-touch-active .kh-boss-stack {
    width: min(260px, 31vw);
  }
  .kh-toast-container {
    top: max(10px, calc(env(safe-area-inset-top, 0px) + 8px));
    max-width: 31vw;
  }
  .kh-hud.kh-has-boss .kh-toast-container {
    top: max(70px, calc(env(safe-area-inset-top, 0px) + 66px));
  }
  .kh-toast {
    padding: 4px 10px;
    font-size: 10.5px;
    letter-spacing: 0.06em;
    max-width: 31vw;
  }
  .kh-hero-frame {
    padding: 7px 9px;
  }
}

@media (max-width: 720px) {
  .kh-boon-shell {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .kh-boon-portrait-col {
    min-height: 92px;
  }
  .kh-options-grid {
    grid-template-columns: 1fr;
  }
  .kh-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .kh-btn,
  .kh-boon-card,
  .kh-hp-fill,
  .kh-boss-hp-fill,
  .kh-toast {
    transition: none !important;
    animation: none !important;
  }
}
`;

export function injectUiStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(UI_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = UI_STYLE_ID;
  style.textContent = MYTHIC_UI_CSS;
  document.head.appendChild(style);
}
