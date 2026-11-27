import type { InputFrame } from '../contracts/index.js';

export interface GamepadMenuNav {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
  pause: boolean;
  codex?: boolean;
  tabPrev?: boolean;
  tabNext?: boolean;
}

export interface GamepadPollResult {
  connected: boolean;
  active: boolean;
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  hasAimStick: boolean;
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
  codexPressed: boolean;
  pausePressed: boolean;
  boonSelectIndex: number | null;
  rerollPressed: boolean;
  menuNav: GamepadMenuNav;
}

export type VirtualGamepadInput = Partial<InputFrame> & { connected?: boolean };

interface GamepadHapticActuatorLike {
  playEffect?: (
    type: string,
    params: {
      startDelay?: number;
      duration: number;
      weakMagnitude: number;
      strongMagnitude: number;
    }
  ) => Promise<string> | void;
}

type GamepadWithHaptics = Gamepad & {
  vibrationActuator?: GamepadHapticActuatorLike | null;
};

const LEFT_STICK_DEADZONE = 0.16;
const LOW_SPEED_FRACTION = 0.2;
const RIGHT_STICK_DEADZONE = 0.18;
const TRIGGER_THRESHOLD = 0.25;
const MENU_AXIS_PRESS_THRESHOLD = 0.55;
const MENU_AXIS_RELEASE_THRESHOLD = 0.35;
const MENU_REPEAT_INITIAL_MS = 380;
const MENU_REPEAT_INTERVAL_MS = 130;

// Standard W3C / Xbox Controller Button Indices (Hades mapping)
const BTN_A = 0; // Dash / Menu Confirm
const BTN_B = 1; // Cast / Menu Back
const BTN_X = 2; // Attack
const BTN_Y = 3; // Special
const BTN_LB = 4; // Codex
const BTN_RB = 5; // Interact
const BTN_LT = 6; // Reload
const BTN_RT = 7; // Call
const BTN_START = 9; // Pause
const BTN_DPAD_UP = 12;
const BTN_DPAD_DOWN = 13;
const BTN_DPAD_LEFT = 14;
const BTN_DPAD_RIGHT = 15;

interface RepeatTracker {
  held: boolean;
  nextRepeatAt: number;
}

function applyRadialDeadzoneAndCurve(
  rawX: number,
  rawY: number,
  deadzone: number,
  lowSpeedFraction: number
): { x: number; y: number; magnitude: number } {
  const mag = Math.hypot(rawX, rawY);
  if (!Number.isFinite(mag) || mag <= deadzone) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const normalized = Math.min(1, (mag - deadzone) / (1 - deadzone));
  const curved = lowSpeedFraction * normalized + (1 - lowSpeedFraction) * normalized * normalized;
  const invMag = 1 / mag;
  return {
    x: rawX * invMag * curved,
    y: rawY * invMag * curved,
    magnitude: curved,
  };
}

function readButton(pad: Gamepad, index: number, analogThreshold = 0.5): boolean {
  const btn = pad.buttons[index];
  if (!btn) {
    return false;
  }
  return btn.pressed || btn.value > analogThreshold;
}

function createEmptyResult(): GamepadPollResult {
  return {
    connected: false,
    active: false,
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    hasAimStick: false,
    attack: false,
    attackPressed: false,
    special: false,
    specialPressed: false,
    cast: false,
    castPressed: false,
    dash: false,
    dashPressed: false,
    call: false,
    callPressed: false,
    reload: false,
    reloadPressed: false,
    interact: false,
    interactPressed: false,
    codexPressed: false,
    pausePressed: false,
    boonSelectIndex: null,
    rerollPressed: false,
    menuNav: {
      up: false,
      down: false,
      left: false,
      right: false,
      confirm: false,
      back: false,
      pause: false,
      codex: false,
      tabPrev: false,
      tabNext: false,
    },
  };
}

export class GamepadAdapter {
  private activePadIndex: number | null = null;
  private virtualState: VirtualGamepadInput | null = null;
  private virtualRevision = 0;
  private lastConsumedVirtualRevision = 0;

  private prevHeld = {
    attack: false,
    special: false,
    cast: false,
    dash: false,
    call: false,
    reload: false,
    interact: false,
    codex: false,
    pause: false,
  };

  private navRepeats: Record<'up' | 'down' | 'left' | 'right', RepeatTracker> = {
    up: { held: false, nextRepeatAt: 0 },
    down: { held: false, nextRepeatAt: 0 },
    left: { held: false, nextRepeatAt: 0 },
    right: { held: false, nextRepeatAt: 0 },
  };

  private readonly onConnected = (ev: GamepadEvent): void => {
    if (this.activePadIndex === null) {
      this.activePadIndex = ev.gamepad.index;
    }
  };

  private readonly onDisconnected = (ev: GamepadEvent): void => {
    if (this.activePadIndex === ev.gamepad.index) {
      this.activePadIndex = null;
    }
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', this.onConnected);
      window.addEventListener('gamepaddisconnected', this.onDisconnected);
    }
  }

  public setVirtualGamepad(state: VirtualGamepadInput | null): void {
    if (state === null || state.connected === false) {
      this.virtualState = null;
      this.virtualRevision++;
      return;
    }
    this.virtualState = { ...state, connected: true };
    this.virtualRevision++;
  }

  public isConnected(): boolean {
    if (this.virtualState?.connected) {
      return true;
    }
    return this.getPrimaryGamepad() !== null;
  }

  public triggerRumble(weak: number, strong: number, durationMs: number): void {
    const pad = this.getPrimaryGamepad() as GamepadWithHaptics | null;
    if (!pad?.vibrationActuator?.playEffect) {
      return;
    }
    const clampedWeak = Math.max(0, Math.min(1, weak));
    const clampedStrong = Math.max(0, Math.min(1, strong));
    const clampedDuration = Math.max(10, Math.min(2000, Math.round(durationMs)));
    try {
      const result = pad.vibrationActuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: clampedDuration,
        weakMagnitude: clampedWeak,
        strongMagnitude: clampedStrong,
      });
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          // Ignore rejected haptic promises on unsupported hardware or background tabs.
        });
      }
    } catch {
      // Ignore haptic errors gracefully.
    }
  }

  public poll(nowMs: number = typeof performance !== 'undefined' ? performance.now() : Date.now()): GamepadPollResult {
    const out = createEmptyResult();
    const pad = this.getPrimaryGamepad();
    const virt = this.virtualState;
    const hasVirtual = Boolean(virt && virt.connected !== false);

    if (!pad && !hasVirtual) {
      this.resetTransientState();
      return out;
    }

    out.connected = true;

    let moveX = 0;
    let moveY = 0;
    let aimX = 0;
    let aimY = 0;
    let hasAimStick = false;

    let attack = false;
    let special = false;
    let cast = false;
    let dash = false;
    let call = false;
    let reload = false;
    let interact = false;
    let codex = false;
    let pause = false;

    let dpadUp = false;
    let dpadDown = false;
    let dpadLeft = false;
    let dpadRight = false;
    let rawStickX = 0;
    let rawStickY = 0;

    if (pad) {
      rawStickX = pad.axes[0] ?? 0;
      rawStickY = pad.axes[1] ?? 0;
      const leftStick = applyRadialDeadzoneAndCurve(
        rawStickX,
        rawStickY,
        LEFT_STICK_DEADZONE,
        LOW_SPEED_FRACTION
      );
      moveX = leftStick.x;
      moveY = leftStick.y;

      const rightRawX = pad.axes[2] ?? 0;
      const rightRawY = pad.axes[3] ?? 0;
      const rightStick = applyRadialDeadzoneAndCurve(rightRawX, rightRawY, RIGHT_STICK_DEADZONE, 0.25);
      if (rightStick.magnitude > 0) {
        const len = Math.hypot(rightStick.x, rightStick.y) || 1;
        aimX = rightStick.x / len;
        aimY = rightStick.y / len;
        hasAimStick = true;
      }

      dash = readButton(pad, BTN_A);
      cast = readButton(pad, BTN_B);
      attack = readButton(pad, BTN_X);
      special = readButton(pad, BTN_Y);
      codex = readButton(pad, BTN_LB);
      interact = readButton(pad, BTN_RB);
      reload = readButton(pad, BTN_LT, TRIGGER_THRESHOLD);
      call = readButton(pad, BTN_RT, TRIGGER_THRESHOLD);
      pause = readButton(pad, BTN_START);

      dpadUp = readButton(pad, BTN_DPAD_UP);
      dpadDown = readButton(pad, BTN_DPAD_DOWN);
      dpadLeft = readButton(pad, BTN_DPAD_LEFT);
      dpadRight = readButton(pad, BTN_DPAD_RIGHT);
    }

    const freshVirtualUpdate = hasVirtual && this.virtualRevision !== this.lastConsumedVirtualRevision;
    let virtAttackPressed = false;
    let virtSpecialPressed = false;
    let virtCastPressed = false;
    let virtDashPressed = false;
    let virtCallPressed = false;
    let virtReloadPressed = false;
    let virtInteractPressed = false;
    let virtPausePressed = false;
    let virtRerollPressed = false;
    let virtBoonSelect: number | null = null;

    if (hasVirtual && virt) {
      if (typeof virt.moveX === 'number' || typeof virt.moveY === 'number') {
        const vx = virt.moveX ?? 0;
        const vy = virt.moveY ?? 0;
        const vLen = Math.hypot(vx, vy);
        if (vLen > 1) {
          moveX = vx / vLen;
          moveY = vy / vLen;
        } else {
          moveX = vx;
          moveY = vy;
        }
        rawStickX = moveX;
        rawStickY = moveY;
      }

      if (typeof virt.aimDirX === 'number' || typeof virt.aimDirY === 'number') {
        const ax = virt.aimDirX ?? 0;
        const ay = virt.aimDirY ?? 0;
        const aLen = Math.hypot(ax, ay);
        if (aLen > 0.01) {
          aimX = ax / aLen;
          aimY = ay / aLen;
          hasAimStick = true;
        }
      }

      attack = attack || Boolean(virt.attack);
      special = special || Boolean(virt.special);
      cast = cast || Boolean(virt.cast);
      dash = dash || Boolean(virt.dash);
      call = call || Boolean(virt.call);
      reload = reload || Boolean(virt.reload);
      interact = interact || Boolean(virt.interact);
      pause = pause || Boolean(virt.pausePressed);

      if (freshVirtualUpdate) {
        virtAttackPressed = Boolean(virt.attackPressed);
        virtSpecialPressed = Boolean(virt.specialPressed);
        virtCastPressed = Boolean(virt.castPressed);
        virtDashPressed = Boolean(virt.dashPressed);
        virtCallPressed = Boolean(virt.callPressed);
        virtReloadPressed = Boolean(virt.reloadPressed);
        virtInteractPressed = Boolean(virt.interactPressed);
        virtPausePressed = Boolean(virt.pausePressed);
        virtRerollPressed = Boolean(virt.rerollPressed);
        if (typeof virt.boonSelectIndex === 'number') {
          virtBoonSelect = virt.boonSelectIndex;
        }
        this.lastConsumedVirtualRevision = this.virtualRevision;
      }
    }

    const attackPressed = (attack && !this.prevHeld.attack) || virtAttackPressed;
    const specialPressed = (special && !this.prevHeld.special) || virtSpecialPressed;
    const castPressed = (cast && !this.prevHeld.cast) || virtCastPressed;
    const dashPressed = (dash && !this.prevHeld.dash) || virtDashPressed;
    const callPressed = (call && !this.prevHeld.call) || virtCallPressed;
    const reloadPressed = (reload && !this.prevHeld.reload) || virtReloadPressed;
    const interactPressed = (interact && !this.prevHeld.interact) || virtInteractPressed;
    const codexPressed = codex && !this.prevHeld.codex;
    const pausePressed = (pause && !this.prevHeld.pause) || virtPausePressed;

    this.prevHeld.attack = attack;
    this.prevHeld.special = special;
    this.prevHeld.cast = cast;
    this.prevHeld.dash = dash;
    this.prevHeld.call = call;
    this.prevHeld.reload = reload;
    this.prevHeld.interact = interact;
    this.prevHeld.codex = codex;
    this.prevHeld.pause = pause;

    // Menu navigation with D-Pad + Left Stick hysteresis and repeat
    const navUpHeld =
      dpadUp ||
      rawStickY < -(this.navRepeats.up.held ? MENU_AXIS_RELEASE_THRESHOLD : MENU_AXIS_PRESS_THRESHOLD);
    const navDownHeld =
      dpadDown ||
      rawStickY > (this.navRepeats.down.held ? MENU_AXIS_RELEASE_THRESHOLD : MENU_AXIS_PRESS_THRESHOLD);
    const navLeftHeld =
      dpadLeft ||
      rawStickX < -(this.navRepeats.left.held ? MENU_AXIS_RELEASE_THRESHOLD : MENU_AXIS_PRESS_THRESHOLD);
    const navRightHeld =
      dpadRight ||
      rawStickX > (this.navRepeats.right.held ? MENU_AXIS_RELEASE_THRESHOLD : MENU_AXIS_PRESS_THRESHOLD);

    const navUp = this.stepRepeat('up', navUpHeld, nowMs);
    const navDown = this.stepRepeat('down', navDownHeld, nowMs);
    const navLeft = this.stepRepeat('left', navLeftHeld, nowMs);
    const navRight = this.stepRepeat('right', navRightHeld, nowMs);

    const anyActivity =
      freshVirtualUpdate ||
      Math.hypot(moveX, moveY) > 0.01 ||
      hasAimStick ||
      attack ||
      special ||
      cast ||
      dash ||
      call ||
      reload ||
      interact ||
      codex ||
      pause ||
      dpadUp ||
      dpadDown ||
      dpadLeft ||
      dpadRight ||
      attackPressed ||
      specialPressed ||
      castPressed ||
      dashPressed ||
      callPressed ||
      reloadPressed ||
      interactPressed ||
      pausePressed ||
      virtRerollPressed ||
      virtBoonSelect !== null;

    out.active = anyActivity;
    out.moveX = moveX;
    out.moveY = moveY;
    out.aimX = aimX;
    out.aimY = aimY;
    out.hasAimStick = hasAimStick;
    out.attack = attack;
    out.attackPressed = attackPressed;
    out.special = special;
    out.specialPressed = specialPressed;
    out.cast = cast;
    out.castPressed = castPressed;
    out.dash = dash;
    out.dashPressed = dashPressed;
    out.call = call;
    out.callPressed = callPressed;
    out.reload = reload;
    out.reloadPressed = reloadPressed;
    out.interact = interact;
    out.interactPressed = interactPressed;
    out.codexPressed = codexPressed;
    out.pausePressed = pausePressed;
    out.boonSelectIndex = virtBoonSelect;
    out.rerollPressed = virtRerollPressed;
    out.menuNav = {
      up: navUp,
      down: navDown,
      left: navLeft,
      right: navRight,
      confirm: dashPressed, // Xbox A
      back: castPressed, // Xbox B
      pause: pausePressed, // Xbox Start
      codex: codexPressed, // Xbox LB
      tabPrev: codexPressed, // Xbox LB
      tabNext: interactPressed, // Xbox RB
    };

    return out;
  }

  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('gamepadconnected', this.onConnected);
      window.removeEventListener('gamepaddisconnected', this.onDisconnected);
    }
    this.virtualState = null;
    this.resetTransientState();
  }

  private stepRepeat(dir: 'up' | 'down' | 'left' | 'right', isHeld: boolean, nowMs: number): boolean {
    const tracker = this.navRepeats[dir];
    if (!isHeld) {
      tracker.held = false;
      tracker.nextRepeatAt = 0;
      return false;
    }
    if (!tracker.held) {
      tracker.held = true;
      tracker.nextRepeatAt = nowMs + MENU_REPEAT_INITIAL_MS;
      return true;
    }
    if (nowMs >= tracker.nextRepeatAt) {
      tracker.nextRepeatAt = nowMs + MENU_REPEAT_INTERVAL_MS;
      return true;
    }
    return false;
  }

  private resetTransientState(): void {
    this.prevHeld.attack = false;
    this.prevHeld.special = false;
    this.prevHeld.cast = false;
    this.prevHeld.dash = false;
    this.prevHeld.call = false;
    this.prevHeld.reload = false;
    this.prevHeld.interact = false;
    this.prevHeld.codex = false;
    this.prevHeld.pause = false;
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      this.navRepeats[dir].held = false;
      this.navRepeats[dir].nextRepeatAt = 0;
    }
  }

  private getPrimaryGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return null;
    }
    let pads: (Gamepad | null)[];
    try {
      pads = Array.from(navigator.getGamepads() ?? []);
    } catch {
      return null;
    }

    if (this.activePadIndex !== null) {
      const preferred = pads[this.activePadIndex];
      if (preferred && preferred.connected) {
        return preferred;
      }
      this.activePadIndex = null;
    }

    for (const pad of pads) {
      if (pad && pad.connected) {
        this.activePadIndex = pad.index;
        return pad;
      }
    }

    return null;
  }
}
