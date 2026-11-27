export type TouchModeSetting = 'auto' | 'always' | 'off';

export type TouchActionKey = 'attack' | 'dash' | 'special' | 'cast' | 'interact' | 'call' | 'reload' | 'pause';

export interface TouchContext {
  nearInteractable: boolean;
  godGauge: number;
  isRail: boolean;
  inGameplay: boolean;
}

export interface TouchPollResult {
  visible: boolean;
  moveX: number;
  moveY: number;
  attack: boolean;
  attackPressed: boolean;
  special: boolean;
  specialPressed: boolean;
  cast: boolean;
  castPressed: boolean;
  dash: boolean;
  dashPressed: boolean;
  call: boolean;
  callPressed: boolean;
  reload: boolean;
  reloadPressed: boolean;
  interact: boolean;
  interactPressed: boolean;
  pausePressed: boolean;
}

const TOUCH_STYLE_ID = 'kh-touch-overlay-styles';
const STICK_DEADZONE = 0.14;
const STICK_LOW_SPEED_FRACTION = 0.22;

const TOUCH_OVERLAY_CSS = `
#touch-root[data-touch-visible="false"],
.kh-touch-layer[data-touch-visible="false"] {
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
  visibility: hidden !important;
}

#touch-root[data-touch-visible="true"] {
  display: block;
  opacity: 1;
  pointer-events: none;
  visibility: visible;
}

.kh-touch-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  font-family: var(--kh-font-display, 'Cinzel', serif);
}

.kh-touch-layer.kh-touch-menu-inactive .kh-touch-stick-zone,
.kh-touch-layer.kh-touch-menu-inactive .kh-touch-cluster,
.kh-touch-layer.kh-touch-menu-inactive .kh-touch-btn {
  pointer-events: none !important;
}

.kh-touch-layer.kh-touch-menu-inactive .kh-touch-stick-base,
.kh-touch-layer.kh-touch-menu-inactive .kh-touch-btn {
  opacity: 0.16;
}

/* Left 45% dynamic floating thumbstick zone (stays cleanly below top-left Hero HUD) */
.kh-touch-stick-zone {
  position: fixed;
  left: env(safe-area-inset-left, 0px);
  top: max(168px, calc(env(safe-area-inset-top, 0px) + 156px));
  bottom: env(safe-area-inset-bottom, 0px);
  width: 45vw;
  pointer-events: auto;
  touch-action: none;
}

.kh-touch-stick-base {
  position: fixed;
  width: 126px;
  height: 126px;
  margin-left: -63px;
  margin-top: -63px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 45%, rgba(27, 18, 38, 0.24) 0%, rgba(17, 11, 24, 0.42) 72%, rgba(158, 110, 46, 0.28) 100%);
  border: 2px solid rgba(229, 185, 82, 0.62);
  box-shadow:
    0 0 0 2px rgba(9, 6, 14, 0.78),
    inset 0 1px 0 rgba(255, 240, 184, 0.24),
    inset 0 0 16px rgba(9, 6, 14, 0.56);
  opacity: 0.38;
  pointer-events: none;
  transition: opacity 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
  will-change: transform, opacity;
}

.kh-touch-stick-base.kh-active {
  opacity: 0.78;
  border-color: var(--kh-gold-bright, #fff0b8);
  box-shadow:
    0 0 0 2px rgba(9, 6, 14, 0.85),
    0 0 20px rgba(229, 185, 82, 0.34),
    inset 0 0 18px rgba(9, 6, 14, 0.6);
}

.kh-touch-stick-ring-inner {
  position: absolute;
  inset: 14px;
  border-radius: 50%;
  border: 1.25px dashed rgba(229, 185, 82, 0.42);
  pointer-events: none;
}

.kh-touch-stick-knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52px;
  height: 52px;
  margin-left: -26px;
  margin-top: -26px;
  border-radius: 50%;
  background: radial-gradient(circle at 36% 32%, rgba(255, 240, 184, 0.62), rgba(92, 61, 24, 0.66) 45%, rgba(17, 11, 24, 0.82) 82%);
  border: 2px solid var(--kh-gold, #e5b952);
  box-shadow:
    0 3px 12px rgba(0, 0, 0, 0.65),
    inset 0 1px 2px rgba(255, 240, 184, 0.45);
  pointer-events: none;
  will-change: transform;
}

/* Right ergonomic thumb arc cluster */
.kh-touch-cluster {
  position: fixed;
  right: max(18px, calc(env(safe-area-inset-right, 0px) + 14px));
  bottom: max(18px, calc(env(safe-area-inset-bottom, 0px) + 14px));
  width: 268px;
  height: 244px;
  pointer-events: none;
  touch-action: none;
}

/* Sculpted Obsidian & Burnished Bronze Beveled Medallions */
.kh-touch-btn {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  min-height: 48px;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 30%, rgba(39, 27, 54, 0.56) 0%, rgba(17, 11, 24, 0.66) 66%, rgba(9, 6, 14, 0.78) 100%);
  border: 2px solid rgba(229, 185, 82, 0.74);
  box-shadow:
    0 0 0 2px rgba(9, 6, 14, 0.82),
    0 4px 12px rgba(0, 0, 0, 0.52),
    inset 0 0 0 3px rgba(9, 6, 14, 0.48),
    inset 0 0 0 4px rgba(229, 185, 82, 0.24),
    inset 0 2px 4px rgba(255, 240, 184, 0.22);
  color: var(--kh-text-primary, #f7eedb);
  font-family: var(--kh-font-display, 'Cinzel', serif);
  font-weight: 700;
  letter-spacing: 0.07em;
  text-shadow: 0 1px 4px rgba(9, 6, 14, 0.96);
  opacity: 0.44;
  pointer-events: auto;
  touch-action: none;
  transition: opacity 0.09s ease, transform 0.09s ease, border-color 0.12s ease, box-shadow 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}

.kh-touch-btn-label {
  font-size: 11px;
  line-height: 1;
  pointer-events: none;
}

.kh-touch-btn-sub {
  font-family: var(--kh-font-num, 'Barlow Condensed', sans-serif);
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--kh-gold-bright, #fff0b8);
  opacity: 0.92;
  margin-top: 2px;
  line-height: 1;
  pointer-events: none;
}

.kh-touch-btn.kh-pressed {
  opacity: 0.82 !important;
  transform: scale(0.93);
  background: radial-gradient(circle at 50% 45%, rgba(92, 61, 24, 0.62) 0%, rgba(27, 18, 38, 0.78) 100%);
  border-color: var(--kh-gold-bright, #fff0b8);
  box-shadow:
    0 0 0 2px rgba(9, 6, 14, 0.9),
    0 0 20px rgba(229, 185, 82, 0.55),
    inset 0 0 14px rgba(255, 240, 184, 0.28);
}

/* Primary Attack — large crimson-bronze ergonomic thumb anchor */
.kh-touch-btn[data-action="attack"] {
  right: 8px;
  bottom: 14px;
  width: 78px;
  height: 78px;
  border-color: rgba(240, 46, 70, 0.86);
  background: radial-gradient(circle at 42% 36%, rgba(184, 25, 50, 0.58) 0%, rgba(90, 11, 26, 0.64) 60%, rgba(17, 11, 24, 0.76) 100%);
  box-shadow:
    0 0 0 2px rgba(9, 6, 14, 0.86),
    0 0 14px rgba(240, 46, 70, 0.28),
    inset 0 0 0 3px rgba(9, 6, 14, 0.45),
    inset 0 0 0 4px rgba(229, 185, 82, 0.34);
}
.kh-touch-btn[data-action="attack"] .kh-touch-btn-label {
  font-size: 13px;
}

/* Adjacent thumb-roll Dash — positioned for effortless Dash-Strike roll into ATK */
.kh-touch-btn[data-action="dash"] {
  right: 96px;
  bottom: 6px;
  width: 64px;
  height: 64px;
  border-color: rgba(94, 224, 242, 0.78);
  background: radial-gradient(circle at 44% 38%, rgba(34, 124, 152, 0.42), rgba(17, 11, 24, 0.64));
}
.kh-touch-btn[data-action="dash"] .kh-touch-btn-label {
  font-size: 11px;
}

/* Special — upper-left of Attack along natural thumb arc */
.kh-touch-btn[data-action="special"] {
  right: 86px;
  bottom: 84px;
  width: 58px;
  height: 58px;
  border-color: rgba(229, 185, 82, 0.82);
}

/* Cast — left arc */
.kh-touch-btn[data-action="cast"] {
  right: 162px;
  bottom: 52px;
  width: 56px;
  height: 56px;
  border-color: rgba(240, 46, 70, 0.72);
}

/* Call — upper right above Attack, glows fiery gold when godGauge >= 25 */
.kh-touch-btn[data-action="call"] {
  right: 14px;
  bottom: 106px;
  width: 56px;
  height: 56px;
  border-color: rgba(158, 110, 46, 0.62);
  opacity: 0.34;
}
.kh-touch-btn[data-action="call"].kh-call-ready {
  opacity: 0.68;
  border-color: var(--kh-gold, #e5b952);
  color: var(--kh-gold-bright, #fff0b8);
  background: radial-gradient(circle at 50% 42%, rgba(229, 185, 82, 0.48), rgba(92, 61, 24, 0.56) 62%, rgba(17, 11, 24, 0.74) 100%);
  animation: kh-touch-gold-pulse 1.35s ease-in-out infinite;
}
.kh-touch-btn[data-action="call"].kh-call-max {
  opacity: 0.82;
  border-color: var(--kh-gold-bright, #fff0b8);
  box-shadow:
    0 0 0 2px rgba(9, 6, 14, 0.86),
    0 0 24px rgba(255, 220, 108, 0.72),
    inset 0 0 12px rgba(255, 240, 184, 0.35);
}

/* Contextual Interact — lights up near doors/boons/pickups */
.kh-touch-btn[data-action="interact"] {
  right: 148px;
  bottom: 128px;
  width: 54px;
  height: 54px;
  border-color: rgba(68, 230, 184, 0.48);
  opacity: 0.24;
}
.kh-touch-btn[data-action="interact"].kh-use-ready {
  opacity: 0.72;
  border-color: #44e6b8;
  color: #e4fff6;
  background: radial-gradient(circle at 50% 45%, rgba(44, 178, 138, 0.44), rgba(17, 11, 24, 0.64));
  box-shadow: 0 0 0 2px rgba(9, 6, 14, 0.8), 0 0 16px rgba(68, 230, 184, 0.48);
}

/* Reload — shown ONLY when Adamant Rail equipped */
.kh-touch-btn[data-action="reload"] {
  right: 78px;
  bottom: 158px;
  width: 52px;
  height: 52px;
  border-color: rgba(178, 92, 255, 0.76);
}
.kh-touch-btn[data-action="reload"].kh-hidden {
  display: none;
}

/* Top-right Pause medallion (fixed >=48px circular target clear of top-right banner) */
.kh-touch-pause-pill {
  position: fixed;
  top: max(10px, calc(env(safe-area-inset-top, 0px) + 8px));
  right: max(12px, calc(env(safe-area-inset-right, 0px) + 10px));
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  padding: 0;
  border-radius: 50%;
  flex-direction: row;
  font-size: 11px;
  opacity: 0.56;
}

@keyframes kh-touch-gold-pulse {
  0%, 100% {
    box-shadow: 0 0 0 2px rgba(9, 6, 14, 0.84), 0 0 12px rgba(229, 185, 82, 0.42);
  }
  50% {
    box-shadow: 0 0 0 2px rgba(9, 6, 14, 0.84), 0 0 24px rgba(255, 240, 184, 0.82);
  }
}

/* Compact Mobile Landscape (844x390) */
@media (max-height: 500px) {
  .kh-touch-pause-pill {
    top: max(6px, env(safe-area-inset-top, 0px));
    right: max(8px, env(safe-area-inset-right, 0px));
    width: 48px;
    height: 48px;
  }
  .kh-touch-stick-zone {
    top: max(142px, calc(env(safe-area-inset-top, 0px) + 134px));
  }
  .kh-touch-stick-base {
    width: 110px;
    height: 110px;
    margin-left: -55px;
    margin-top: -55px;
  }
  .kh-touch-stick-knob {
    width: 44px;
    height: 44px;
    margin-left: -22px;
    margin-top: -22px;
  }
  .kh-touch-cluster {
    right: max(10px, calc(env(safe-area-inset-right, 0px) + 8px));
    bottom: max(10px, calc(env(safe-area-inset-bottom, 0px) + 8px));
    width: 240px;
    height: 214px;
  }
  .kh-touch-btn[data-action="attack"] {
    width: 70px;
    height: 70px;
    right: 6px;
    bottom: 10px;
  }
  .kh-touch-btn[data-action="dash"] {
    width: 58px;
    height: 58px;
    right: 84px;
    bottom: 4px;
  }
  .kh-touch-btn[data-action="special"] {
    width: 52px;
    height: 52px;
    right: 76px;
    bottom: 72px;
  }
  .kh-touch-btn[data-action="cast"] {
    width: 50px;
    height: 50px;
    right: 142px;
    bottom: 44px;
  }
  .kh-touch-btn[data-action="call"] {
    width: 50px;
    height: 50px;
    right: 12px;
    bottom: 92px;
  }
  .kh-touch-btn[data-action="interact"] {
    width: 48px;
    height: 48px;
    right: 132px;
    bottom: 108px;
  }
  .kh-touch-btn[data-action="reload"] {
    width: 48px;
    height: 48px;
    right: 70px;
    bottom: 136px;
  }
}

/* Mobile Portrait (390x844 — clear separation between left thumbstick & right action arc, all targets >= 48px) */
@media (max-width: 680px) {
  .kh-touch-pause-pill {
    top: max(8px, env(safe-area-inset-top, 0px));
    right: max(8px, env(safe-area-inset-right, 0px));
    width: 48px;
    height: 48px;
  }
  .kh-touch-stick-base {
    width: 108px;
    height: 108px;
    margin-left: -54px;
    margin-top: -54px;
  }
  .kh-touch-stick-knob {
    width: 44px;
    height: 44px;
    margin-left: -22px;
    margin-top: -22px;
  }
  .kh-touch-cluster {
    right: max(10px, env(safe-area-inset-right, 0px));
    bottom: max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px));
    width: 218px;
    height: 232px;
  }
  .kh-touch-btn[data-action="attack"] {
    width: 72px;
    height: 72px;
    right: 4px;
    bottom: 12px;
  }
  .kh-touch-btn[data-action="dash"] {
    width: 60px;
    height: 60px;
    right: 84px;
    bottom: 6px;
  }
  .kh-touch-btn[data-action="special"] {
    width: 54px;
    height: 54px;
    right: 76px;
    bottom: 78px;
  }
  .kh-touch-btn[data-action="cast"] {
    width: 52px;
    height: 52px;
    right: 146px;
    bottom: 48px;
  }
  .kh-touch-btn[data-action="call"] {
    width: 52px;
    height: 52px;
    right: 10px;
    bottom: 98px;
  }
  .kh-touch-btn[data-action="interact"] {
    width: 50px;
    height: 50px;
    right: 136px;
    bottom: 118px;
  }
  .kh-touch-btn[data-action="reload"] {
    width: 48px;
    height: 48px;
    right: 70px;
    bottom: 146px;
  }
}

/* Tesla & Large Wide Touchscreens (1280x720, 1440x900, 1920x1080 — all targets >= 52px) */
@media (min-width: 1200px) and (min-height: 700px) {
  .kh-touch-pause-pill {
    top: max(10px, env(safe-area-inset-top, 0px));
    right: max(12px, env(safe-area-inset-right, 0px));
    width: 52px;
    height: 52px;
    min-width: 52px;
    min-height: 52px;
  }
  .kh-touch-stick-base {
    width: 148px;
    height: 148px;
    margin-left: -74px;
    margin-top: -74px;
  }
  .kh-touch-stick-knob {
    width: 60px;
    height: 60px;
    margin-left: -30px;
    margin-top: -30px;
  }
  .kh-touch-cluster {
    right: max(30px, calc(env(safe-area-inset-right, 0px) + 24px));
    bottom: max(28px, calc(env(safe-area-inset-bottom, 0px) + 22px));
    width: 310px;
    height: 280px;
  }
  .kh-touch-btn[data-action="attack"] {
    width: 88px;
    height: 88px;
    right: 10px;
    bottom: 16px;
  }
  .kh-touch-btn[data-action="dash"] {
    width: 74px;
    height: 74px;
    right: 110px;
    bottom: 8px;
  }
  .kh-touch-btn[data-action="special"] {
    width: 66px;
    height: 66px;
    right: 98px;
    bottom: 98px;
  }
  .kh-touch-btn[data-action="cast"] {
    width: 62px;
    height: 62px;
    right: 186px;
    bottom: 60px;
  }
  .kh-touch-btn[data-action="call"] {
    width: 64px;
    height: 64px;
    right: 18px;
    bottom: 122px;
  }
  .kh-touch-btn[data-action="interact"] {
    width: 60px;
    height: 60px;
    right: 170px;
    bottom: 146px;
  }
  .kh-touch-btn[data-action="reload"] {
    width: 58px;
    height: 58px;
    right: 90px;
    bottom: 182px;
  }
}
`;

function injectTouchStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(TOUCH_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = TOUCH_STYLE_ID;
  style.textContent = TOUCH_OVERLAY_CSS;
  document.head.appendChild(style);
}

export class TouchOverlayController {
  private readonly touchRoot: HTMLElement;
  private readonly layer: HTMLDivElement;
  private readonly stickZone: HTMLDivElement;
  private readonly stickBase: HTMLDivElement;
  private readonly stickKnob: HTMLDivElement;
  private readonly cluster: HTMLDivElement;
  private readonly buttons: Record<TouchActionKey, HTMLButtonElement>;
  private readonly callSubLabel: HTMLSpanElement;

  private mode: TouchModeSetting = 'auto';
  private overrideEnabled = false;
  private touchActivated = false;
  private visible = false;
  private inGameplay = false;
  private lastTouchTimestamp = -10000;
  private lastTouchClientX = Number.NaN;
  private lastTouchClientY = Number.NaN;

  // Floating thumbstick state (independent pointerId)
  private stickPointerId: number | null = null;
  private stickOriginX = 110;
  private stickOriginY = 300;
  private stickMoveX = 0;
  private stickMoveY = 0;

  // Multi-touch action button tracking (pointerId -> action)
  private readonly buttonPointers = new Map<number, TouchActionKey>();
  private readonly heldActions: Record<TouchActionKey, boolean> = {
    attack: false,
    dash: false,
    special: false,
    cast: false,
    interact: false,
    call: false,
    reload: false,
    pause: false,
  };
  private readonly pressedLatches: Record<TouchActionKey, boolean> = {
    attack: false,
    dash: false,
    special: false,
    cast: false,
    interact: false,
    call: false,
    reload: false,
    pause: false,
  };

  private readonly onTouchDetectedCallback?: () => void;

  constructor(touchRoot: HTMLElement, onTouchDetected?: () => void) {
    injectTouchStyles();
    this.touchRoot = touchRoot;
    this.onTouchDetectedCallback = onTouchDetected;

    this.touchRoot.innerHTML = '';

    this.layer = document.createElement('div');
    this.layer.className = 'kh-touch-layer';
    this.layer.setAttribute('data-touch-visible', 'false');

    // Left 45% dynamic floating thumbstick zone
    this.stickZone = document.createElement('div');
    this.stickZone.className = 'kh-touch-stick-zone';
    this.stickZone.setAttribute('aria-label', 'Movement thumbstick area');

    this.stickBase = document.createElement('div');
    this.stickBase.className = 'kh-touch-stick-base';
    const ringInner = document.createElement('div');
    ringInner.className = 'kh-touch-stick-ring-inner';
    this.stickKnob = document.createElement('div');
    this.stickKnob.className = 'kh-touch-stick-knob';
    this.stickBase.append(ringInner, this.stickKnob);
    this.stickZone.appendChild(this.stickBase);

    // Right ergonomic thumb arc cluster
    this.cluster = document.createElement('div');
    this.cluster.className = 'kh-touch-cluster';

    const makeButton = (action: TouchActionKey, label: string, sub?: string): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kh-touch-btn';
      btn.dataset.action = action;
      btn.setAttribute('aria-label', label);
      btn.tabIndex = -1;
      const lbl = document.createElement('span');
      lbl.className = 'kh-touch-btn-label';
      lbl.textContent = label;
      btn.appendChild(lbl);
      if (sub !== undefined) {
        const subEl = document.createElement('span');
        subEl.className = 'kh-touch-btn-sub';
        subEl.textContent = sub;
        btn.appendChild(subEl);
      }
      return btn;
    };

    const btnAttack = makeButton('attack', 'ATK');
    const btnDash = makeButton('dash', 'DASH');
    const btnSpecial = makeButton('special', 'SPC');
    const btnCast = makeButton('cast', 'CAST');
    const btnInteract = makeButton('interact', 'USE');
    const btnCall = makeButton('call', 'CALL', '0%');
    this.callSubLabel = btnCall.querySelector('.kh-touch-btn-sub') as HTMLSpanElement;
    const btnReload = makeButton('reload', 'RLD');
    btnReload.classList.add('kh-hidden');

    const btnPause = makeButton('pause', 'II');
    btnPause.classList.add('kh-touch-pause-pill');
    btnPause.setAttribute('aria-label', 'Pause');

    this.buttons = {
      attack: btnAttack,
      dash: btnDash,
      special: btnSpecial,
      cast: btnCast,
      interact: btnInteract,
      call: btnCall,
      reload: btnReload,
      pause: btnPause,
    };

    this.cluster.append(btnAttack, btnDash, btnSpecial, btnCast, btnInteract, btnCall, btnReload);
    this.layer.append(this.stickZone, this.cluster, btnPause);
    this.touchRoot.appendChild(this.layer);

    this.positionIdleStick();
    this.bindEvents();

    // Enforce CRITICAL VISIBILITY INVARIANT immediately on desktop load: 100% invisible!
    this.applyVisibility(false);
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public getLastTouchTimestamp(): number {
    return this.lastTouchTimestamp;
  }

  public getLastTouchPosition(): { x: number; y: number } {
    return { x: this.lastTouchClientX, y: this.lastTouchClientY };
  }

  public setMode(mode: TouchModeSetting): void {
    this.mode = mode;
    this.recomputeVisibility();
  }

  public setOverride(enabled: boolean): void {
    this.overrideEnabled = enabled;
    if (enabled) {
      this.touchActivated = true;
    } else if (this.mode !== 'always') {
      this.touchActivated = false;
    }
    this.recomputeVisibility();
  }

  public notifyNonTouchInput(): void {
    if (this.mode === 'auto' && !this.overrideEnabled && this.touchActivated) {
      this.touchActivated = false;
      this.releaseAllInputs();
      this.recomputeVisibility();
    }
  }

  public notifyTouchActivated(nowMs: number = performance.now()): void {
    this.lastTouchTimestamp = nowMs;
    if (this.mode === 'off' && !this.overrideEnabled) {
      return;
    }
    if (!this.touchActivated) {
      this.touchActivated = true;
      this.recomputeVisibility();
    }
    this.onTouchDetectedCallback?.();
  }

  public updateContext(context: TouchContext): void {
    if (this.inGameplay !== context.inGameplay) {
      this.inGameplay = context.inGameplay;
      this.layer.classList.toggle('kh-touch-menu-inactive', !context.inGameplay);
      if (!context.inGameplay) {
        this.releaseAllInputs();
      }
    }

    if (!this.visible) {
      return;
    }

    // Contextual USE glow near doors/boons/pickups
    this.buttons.interact.classList.toggle('kh-use-ready', context.nearInteractable);

    // Glowing CALL when godGauge >= 25
    const gauge = Math.max(0, Math.min(100, Math.floor(context.godGauge)));
    this.buttons.call.classList.toggle('kh-call-ready', gauge >= 25);
    this.buttons.call.classList.toggle('kh-call-max', gauge >= 100);
    const gaugeText = `${gauge}%`;
    if (this.callSubLabel.textContent !== gaugeText) {
      this.callSubLabel.textContent = gaugeText;
    }

    // RLD visible only when Adamant Rail equipped
    this.buttons.reload.classList.toggle('kh-hidden', !context.isRail);
  }

  public poll(): TouchPollResult {
    const out: TouchPollResult = {
      visible: this.visible,
      moveX: this.inGameplay && this.visible ? this.stickMoveX : 0,
      moveY: this.inGameplay && this.visible ? this.stickMoveY : 0,
      attack: this.inGameplay && this.heldActions.attack,
      attackPressed: this.inGameplay && this.pressedLatches.attack,
      special: this.inGameplay && this.heldActions.special,
      specialPressed: this.inGameplay && this.pressedLatches.special,
      cast: this.inGameplay && this.heldActions.cast,
      castPressed: this.inGameplay && this.pressedLatches.cast,
      dash: this.inGameplay && this.heldActions.dash,
      dashPressed: this.inGameplay && this.pressedLatches.dash,
      call: this.inGameplay && this.heldActions.call,
      callPressed: this.inGameplay && this.pressedLatches.call,
      reload: this.inGameplay && this.heldActions.reload,
      reloadPressed: this.inGameplay && this.pressedLatches.reload,
      interact: this.inGameplay && this.heldActions.interact,
      interactPressed: this.inGameplay && this.pressedLatches.interact,
      pausePressed: this.pressedLatches.pause,
    };

    for (const key of Object.keys(this.pressedLatches) as TouchActionKey[]) {
      this.pressedLatches[key] = false;
    }

    return out;
  }

  public dispose(): void {
    this.unbindEvents();
    this.releaseAllInputs();
    this.applyVisibility(false);
    this.touchRoot.innerHTML = '';
  }

  private recomputeVisibility(): void {
    let shouldShow = false;
    if (this.overrideEnabled) {
      shouldShow = true;
    } else if (this.mode === 'always') {
      shouldShow = true;
    } else if (this.mode === 'off') {
      shouldShow = false;
    } else {
      // 'auto': ONLY visible when genuinely touch-activated
      shouldShow = this.touchActivated;
    }
    this.applyVisibility(shouldShow);
  }

  private applyVisibility(show: boolean): void {
    this.visible = show;
    const attr = show ? 'true' : 'false';

    this.touchRoot.setAttribute('data-touch-visible', attr);
    this.layer.setAttribute('data-touch-visible', attr);

    if (show) {
      this.touchRoot.style.display = 'block';
      this.touchRoot.style.opacity = '1';
      this.touchRoot.style.pointerEvents = 'none';
      this.touchRoot.removeAttribute('aria-hidden');

      this.layer.style.display = 'block';
      this.layer.style.opacity = '1';
      this.layer.style.pointerEvents = 'none';
      this.layer.removeAttribute('aria-hidden');
      this.positionIdleStick();
    } else {
      this.touchRoot.style.display = 'none';
      this.touchRoot.style.opacity = '0';
      this.touchRoot.style.pointerEvents = 'none';
      this.touchRoot.setAttribute('aria-hidden', 'true');

      this.layer.style.display = 'none';
      this.layer.style.opacity = '0';
      this.layer.style.pointerEvents = 'none';
      this.layer.setAttribute('aria-hidden', 'true');
      this.releaseAllInputs();
    }
  }

  private getStickMaxRadius(): number {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 720;
    if (h <= 500) {
      return 44;
    }
    if (w >= 1200 && h >= 700) {
      return 62;
    }
    return 52;
  }

  private positionIdleStick(): void {
    if (this.stickPointerId !== null) {
      return;
    }
    const h = typeof window !== 'undefined' ? window.innerHeight : 720;
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const x = w >= 1200 ? 132 : h <= 500 ? 94 : w <= 480 ? 74 : 108;
    const y = h - (w >= 1200 ? 140 : h <= 500 ? 96 : 118);
    this.stickOriginX = x;
    this.stickOriginY = y;
    this.stickBase.style.left = `${x}px`;
    this.stickBase.style.top = `${y}px`;
    this.stickKnob.style.transform = 'translate3d(0px, 0px, 0px)';
    this.stickBase.classList.remove('kh-active');
  }

  private updateStickFromPointer(clientX: number, clientY: number): void {
    const maxR = this.getStickMaxRadius();
    const dx = clientX - this.stickOriginX;
    const dy = clientY - this.stickOriginY;
    const dist = Math.hypot(dx, dy);

    const clampedDist = Math.min(dist, maxR);
    const inv = dist > 0.0001 ? 1 / dist : 0;
    const knobX = dx * inv * clampedDist;
    const knobY = dy * inv * clampedDist;
    this.stickKnob.style.transform = `translate3d(${knobX.toFixed(1)}px, ${knobY.toFixed(1)}px, 0px)`;

    const norm = Math.min(1, dist / maxR);
    if (norm <= STICK_DEADZONE) {
      this.stickMoveX = 0;
      this.stickMoveY = 0;
      return;
    }

    const rescaled = (norm - STICK_DEADZONE) / (1 - STICK_DEADZONE);
    const curved =
      STICK_LOW_SPEED_FRACTION * rescaled + (1 - STICK_LOW_SPEED_FRACTION) * rescaled * rescaled;
    this.stickMoveX = dx * inv * curved;
    this.stickMoveY = dy * inv * curved;
  }

  private syncHeldActions(): void {
    for (const key of Object.keys(this.heldActions) as TouchActionKey[]) {
      this.heldActions[key] = false;
    }
    for (const action of this.buttonPointers.values()) {
      this.heldActions[action] = true;
    }
    for (const [key, btn] of Object.entries(this.buttons) as [TouchActionKey, HTMLButtonElement][]) {
      btn.classList.toggle('kh-pressed', this.heldActions[key]);
    }
  }

  private assignPointerAction(pointerId: number, action: TouchActionKey): void {
    const prevAction = this.buttonPointers.get(pointerId);
    if (prevAction === action) {
      return;
    }
    const wasAlreadyHeld = this.heldActions[action];
    this.buttonPointers.set(pointerId, action);
    this.syncHeldActions();
    if (!wasAlreadyHeld) {
      this.pressedLatches[action] = true;
    }
  }

  private releasePointer(pointerId: number): void {
    if (this.stickPointerId === pointerId) {
      this.stickPointerId = null;
      this.stickMoveX = 0;
      this.stickMoveY = 0;
      this.positionIdleStick();
    }
    if (this.buttonPointers.has(pointerId)) {
      this.buttonPointers.delete(pointerId);
      this.syncHeldActions();
    }
  }

  private releaseAllInputs(): void {
    this.stickPointerId = null;
    this.stickMoveX = 0;
    this.stickMoveY = 0;
    this.buttonPointers.clear();
    this.syncHeldActions();
    this.positionIdleStick();
  }

  // ---- Event Listeners ----

  private readonly onWindowTouchStart = (ev: TouchEvent): void => {
    const first = ev.touches?.[0] ?? ev.changedTouches?.[0];
    if (first) {
      this.lastTouchClientX = first.clientX;
      this.lastTouchClientY = first.clientY;
    }
    this.notifyTouchActivated(performance.now());
  };

  private readonly onWindowPointerDown = (ev: PointerEvent): void => {
    if (ev.pointerType === 'touch') {
      this.lastTouchClientX = ev.clientX;
      this.lastTouchClientY = ev.clientY;
      this.notifyTouchActivated(performance.now());
    }
  };

  private readonly onStickPointerDown = (ev: PointerEvent): void => {
    if (!this.visible || !this.inGameplay) {
      return;
    }
    if (ev.pointerType === 'touch') {
      this.notifyTouchActivated(performance.now());
    } else if (!this.overrideEnabled && this.mode !== 'always') {
      return;
    }
    if (this.stickPointerId !== null) {
      return;
    }

    ev.preventDefault();
    this.stickPointerId = ev.pointerId;

    const pad = 64;
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    const minTopY = h <= 500 ? 186 : 226;
    this.stickOriginX = Math.max(pad, Math.min(w * 0.45 - 24, ev.clientX));
    this.stickOriginY = Math.max(minTopY, Math.min(h - pad, ev.clientY));
    this.stickBase.style.left = `${this.stickOriginX}px`;
    this.stickBase.style.top = `${this.stickOriginY}px`;
    this.stickBase.classList.add('kh-active');

    try {
      this.stickZone.setPointerCapture(ev.pointerId);
    } catch {
      // Synthetic pointer events may not support capture.
    }
    this.updateStickFromPointer(ev.clientX, ev.clientY);
  };

  private readonly onWindowPointerMove = (ev: PointerEvent): void => {
    if (this.stickPointerId === ev.pointerId) {
      ev.preventDefault();
      this.updateStickFromPointer(ev.clientX, ev.clientY);
      return;
    }

    // Support effortless thumb-roll Dash-Strike across right-side action buttons
    const currentAction = this.buttonPointers.get(ev.pointerId);
    if (currentAction && currentAction !== 'pause' && typeof document.elementFromPoint === 'function') {
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const btn = target?.closest?.('.kh-touch-btn') as HTMLButtonElement | null;
      const rolledAction = btn?.dataset.action as TouchActionKey | undefined;
      if (rolledAction && rolledAction !== 'pause' && rolledAction !== currentAction) {
        this.assignPointerAction(ev.pointerId, rolledAction);
      }
    }
  };

  private readonly onWindowPointerUpOrCancel = (ev: PointerEvent): void => {
    this.releasePointer(ev.pointerId);
  };

  private readonly onButtonPointerDown = (ev: PointerEvent): void => {
    if (!this.visible) {
      return;
    }
    const btn = ev.currentTarget as HTMLButtonElement | null;
    const action = btn?.dataset.action as TouchActionKey | undefined;
    if (!action) {
      return;
    }
    if (action !== 'pause' && !this.inGameplay) {
      return;
    }
    if (ev.pointerType === 'touch') {
      this.notifyTouchActivated(performance.now());
    } else if (!this.overrideEnabled && this.mode !== 'always') {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();
    this.assignPointerAction(ev.pointerId, action);
  };

  private readonly onWindowResize = (): void => {
    this.positionIdleStick();
  };

  private readonly onWindowBlur = (): void => {
    this.releaseAllInputs();
  };

  private bindEvents(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('touchstart', this.onWindowTouchStart, { passive: true });
      window.addEventListener('pointerdown', this.onWindowPointerDown, { passive: true });
      window.addEventListener('pointermove', this.onWindowPointerMove, { passive: false });
      window.addEventListener('pointerup', this.onWindowPointerUpOrCancel);
      window.addEventListener('pointercancel', this.onWindowPointerUpOrCancel);
      window.addEventListener('resize', this.onWindowResize);
      window.addEventListener('blur', this.onWindowBlur);
    }
    this.stickZone.addEventListener('pointerdown', this.onStickPointerDown);
    for (const btn of Object.values(this.buttons)) {
      btn.addEventListener('pointerdown', this.onButtonPointerDown);
    }
  }

  private unbindEvents(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('touchstart', this.onWindowTouchStart);
      window.removeEventListener('pointerdown', this.onWindowPointerDown);
      window.removeEventListener('pointermove', this.onWindowPointerMove);
      window.removeEventListener('pointerup', this.onWindowPointerUpOrCancel);
      window.removeEventListener('pointercancel', this.onWindowPointerUpOrCancel);
      window.removeEventListener('resize', this.onWindowResize);
      window.removeEventListener('blur', this.onWindowBlur);
    }
    this.stickZone.removeEventListener('pointerdown', this.onStickPointerDown);
    for (const btn of Object.values(this.buttons)) {
      btn.removeEventListener('pointerdown', this.onButtonPointerDown);
    }
  }
}
