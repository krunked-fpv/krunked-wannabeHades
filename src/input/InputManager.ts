import type { InputFrame, InputSource, Vec2 } from '../contracts/index.js';
import { GamepadAdapter, type VirtualGamepadInput } from './GamepadAdapter.js';
import { TouchOverlayController, type TouchModeSetting } from './TouchOverlayController.js';

export interface MenuNavInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
  pause: boolean;
  toggleDebug: boolean;
}

export interface InputPollContext {
  nearInteractable: boolean;
  godGauge: number;
  isRail: boolean;
  inGameplay: boolean;
}

const POST_TOUCH_MOUSE_GUARD_MS = 450;
const MOUSE_SWITCH_DISTANCE_PX = 6;

const PREVENT_DEFAULT_CODES = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'F9',
]);

function createEmptyMenuNav(): MenuNavInput {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    confirm: false,
    back: false,
    pause: false,
    toggleDebug: false,
  };
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export class InputManager {
  private readonly canvas: HTMLCanvasElement;
  private readonly screenToWorld: (clientX: number, clientY: number) => Vec2;
  private readonly gamepad: GamepadAdapter;
  private readonly touch: TouchOverlayController;

  private activeSource: InputSource = 'keyboard';
  private touchMode: TouchModeSetting = 'auto';
  private touchOverride = false;

  // Keyboard held state
  private readonly keysDown = new Set<string>();
  private mouseLeftDown = false;
  private mouseRightDown = false;
  private mouseClientX = 0;
  private mouseClientY = 0;
  private hasMouseMoved = false;
  private lastMouseClientX = 0;
  private lastMouseClientY = 0;

  // Persistent unit aim vector fallback
  private lastAimDir: Vec2 = { x: 1, y: 0 };

  // One-shot keyboard/mouse gameplay action latches
  private kbPressed = {
    attack: false,
    special: false,
    cast: false,
    dash: false,
    call: false,
    reload: false,
    interact: false,
    pause: false,
    reroll: false,
  };
  private kbBoonSelectIndex: number | null = null;

  // Accumulated menu navigation latches (OR'd across substeps, drained on getMenuNav())
  private kbMenuNav: MenuNavInput = createEmptyMenuNav();
  private pendingMenuNav: MenuNavInput = createEmptyMenuNav();
  private polledSinceMenuRead = false;

  constructor(
    canvas: HTMLCanvasElement,
    touchRoot: HTMLElement,
    screenToWorld: (clientX: number, clientY: number) => Vec2
  ) {
    this.canvas = canvas;
    this.screenToWorld = screenToWorld;
    this.gamepad = new GamepadAdapter();
    this.touch = new TouchOverlayController(touchRoot, () => {
      this.activeSource = 'touch';
    });

    this.bindEvents();
  }

  public poll(tick: number, playerPos: Vec2, context: InputPollContext): InputFrame {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // Update contextual touch overlay cues (USE glow, CALL gold pulse, RLD rail visibility)
    this.touch.updateContext(context);

    const pad = this.gamepad.poll(nowMs);
    const touchState = this.touch.poll();

    if (pad.active) {
      this.activeSource = 'gamepad';
      this.touch.notifyNonTouchInput();
    }

    // Keyboard movement vector
    let kbMoveX = 0;
    let kbMoveY = 0;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) kbMoveX -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) kbMoveX += 1;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) kbMoveY -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) kbMoveY += 1;
    const kbMoveLen = Math.hypot(kbMoveX, kbMoveY);
    if (kbMoveLen > 1) {
      kbMoveX /= kbMoveLen;
      kbMoveY /= kbMoveLen;
    }

    // Combine movement across active sources (strongest vector wins smoothly)
    let moveX = 0;
    let moveY = 0;
    const kbMag = Math.hypot(kbMoveX, kbMoveY);
    const padMag = Math.hypot(pad.moveX, pad.moveY);
    const touchMag = Math.hypot(touchState.moveX, touchState.moveY);

    if (padMag >= kbMag && padMag >= touchMag && padMag > 0) {
      moveX = pad.moveX;
      moveY = pad.moveY;
    } else if (touchMag >= kbMag && touchMag > 0) {
      moveX = touchState.moveX;
      moveY = touchState.moveY;
    } else if (kbMag > 0) {
      moveX = kbMoveX;
      moveY = kbMoveY;
    }

    // Compute aim vector + optional world aim point
    let aimDirX = this.lastAimDir.x;
    let aimDirY = this.lastAimDir.y;
    let aimWorldX = playerPos.x + aimDirX * 220;
    let aimWorldY = playerPos.y + aimDirY * 220;
    let hasAimWorld = false;

    if (this.activeSource === 'keyboard' && this.hasMouseMoved) {
      const worldAim = this.screenToWorld(this.mouseClientX, this.mouseClientY);
      if (Number.isFinite(worldAim.x) && Number.isFinite(worldAim.y)) {
        aimWorldX = worldAim.x;
        aimWorldY = worldAim.y;
        hasAimWorld = true;
        const dx = aimWorldX - playerPos.x;
        const dy = aimWorldY - playerPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001) {
          aimDirX = dx / dist;
          aimDirY = dy / dist;
        }
      }
    } else if (this.activeSource === 'gamepad' && pad.hasAimStick) {
      aimDirX = pad.aimX;
      aimDirY = pad.aimY;
      aimWorldX = playerPos.x + aimDirX * 260;
      aimWorldY = playerPos.y + aimDirY * 260;
      hasAimWorld = false;
    } else if (Math.hypot(moveX, moveY) > 0.05) {
      const len = Math.hypot(moveX, moveY);
      aimDirX = moveX / len;
      aimDirY = moveY / len;
      aimWorldX = playerPos.x + aimDirX * 260;
      aimWorldY = playerPos.y + aimDirY * 260;
      hasAimWorld = false;
    }

    // Ensure unit length aim direction
    const aimLen = Math.hypot(aimDirX, aimDirY);
    if (aimLen > 0.0001) {
      aimDirX /= aimLen;
      aimDirY /= aimLen;
      this.lastAimDir = { x: aimDirX, y: aimDirY };
    } else {
      aimDirX = 1;
      aimDirY = 0;
      this.lastAimDir = { x: 1, y: 0 };
    }

    // Combine gameplay buttons (gate canvas mouse attacks to inGameplay)
    const kbAttack = (context.inGameplay && this.mouseLeftDown) || this.keysDown.has('KeyJ');
    const kbSpecial = (context.inGameplay && this.mouseRightDown) || this.keysDown.has('KeyK');
    const kbCast = this.keysDown.has('KeyQ');
    const kbDash = this.keysDown.has('Space');
    const kbCall = this.keysDown.has('KeyF');
    const kbReload = this.keysDown.has('KeyR');
    const kbInteract = this.keysDown.has('KeyE');

    const attack = kbAttack || pad.attack || touchState.attack;
    const attackPressed =
      (context.inGameplay && this.kbPressed.attack) || pad.attackPressed || touchState.attackPressed;
    const special = kbSpecial || pad.special || touchState.special;
    const specialPressed =
      (context.inGameplay && this.kbPressed.special) || pad.specialPressed || touchState.specialPressed;
    const cast = kbCast || pad.cast || touchState.cast;
    const castPressed = (context.inGameplay && this.kbPressed.cast) || pad.castPressed || touchState.castPressed;
    const dash = kbDash || pad.dash || touchState.dash;
    const dashPressed = (context.inGameplay && this.kbPressed.dash) || pad.dashPressed || touchState.dashPressed;
    const call = kbCall || pad.call || touchState.call;
    const callPressed = (context.inGameplay && this.kbPressed.call) || pad.callPressed || touchState.callPressed;
    const reload = kbReload || pad.reload || touchState.reload;
    const reloadPressed =
      (context.inGameplay && this.kbPressed.reload) || pad.reloadPressed || touchState.reloadPressed;
    const interact = kbInteract || pad.interact || touchState.interact;
    const interactPressed =
      (context.inGameplay && this.kbPressed.interact) || pad.interactPressed || touchState.interactPressed;
    const pausePressed = this.kbPressed.pause || pad.pausePressed || touchState.pausePressed;
    const rerollPressed = this.kbPressed.reroll || pad.rerollPressed;
    const boonSelectIndex = this.kbBoonSelectIndex ?? pad.boonSelectIndex;

    // Accumulate menu navigation from keyboard, gamepad, and touch pause pill
    this.mergeIntoPendingMenuNav(this.kbMenuNav);
    this.mergeIntoPendingMenuNav({
      ...pad.menuNav,
      pause: pad.menuNav.pause || touchState.pausePressed,
      toggleDebug: false,
    });
    this.kbMenuNav = createEmptyMenuNav();
    this.polledSinceMenuRead = true;

    // Clear one-shot gameplay latches
    this.clearKbPressed();

    return {
      tick,
      moveX,
      moveY,
      aimDirX,
      aimDirY,
      aimWorldX,
      aimWorldY,
      hasAimWorld,
      attack,
      attackPressed,
      special,
      specialPressed,
      cast,
      castPressed,
      dash,
      dashPressed,
      call,
      callPressed,
      reload,
      reloadPressed,
      interact,
      interactPressed,
      pausePressed,
      boonSelectIndex,
      rerollPressed,
      source: this.activeSource,
    };
  }

  public getMenuNav(): MenuNavInput {
    // If no sim poll ran since the previous render frame (e.g. Title, Pause, Options, Boon modal),
    // sample gamepad & touch pause pill here so menu navigation never stalls.
    if (!this.polledSinceMenuRead) {
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const pad = this.gamepad.poll(nowMs);
      const touchState = this.touch.poll();
      if (pad.active) {
        this.activeSource = 'gamepad';
        this.touch.notifyNonTouchInput();
      }
      this.mergeIntoPendingMenuNav(this.kbMenuNav);
      this.mergeIntoPendingMenuNav({
        ...pad.menuNav,
        pause: pad.menuNav.pause || touchState.pausePressed,
        toggleDebug: false,
      });
      this.kbMenuNav = createEmptyMenuNav();
    }

    const snapshot: MenuNavInput = { ...this.pendingMenuNav };
    this.pendingMenuNav = createEmptyMenuNav();
    this.polledSinceMenuRead = false;
    return snapshot;
  }

  public getActiveSource(): InputSource {
    return this.activeSource;
  }

  public setTouchMode(mode: 'auto' | 'always' | 'off'): void {
    this.touchMode = mode;
    this.touch.setMode(mode);
    if (mode === 'always') {
      this.activeSource = 'touch';
    } else if (mode === 'off' && !this.touchOverride && this.activeSource === 'touch') {
      this.activeSource = this.gamepad.isConnected() ? 'gamepad' : 'keyboard';
    }
  }

  public setTouchOverride(enabled: boolean): void {
    this.touchOverride = enabled;
    this.touch.setOverride(enabled);
    if (enabled) {
      this.activeSource = 'touch';
    } else if (this.touchMode !== 'always' && this.activeSource === 'touch') {
      this.activeSource = this.gamepad.isConnected() ? 'gamepad' : 'keyboard';
    }
  }

  public setVirtualGamepad(state: VirtualGamepadInput | null): void {
    this.gamepad.setVirtualGamepad(state);
    if (state && state.connected !== false) {
      this.activeSource = 'gamepad';
      this.touch.notifyNonTouchInput();
    }
  }

  public triggerRumble(weak: number, strong: number, durationMs: number): void {
    this.gamepad.triggerRumble(weak, strong, durationMs);
  }

  public dispose(): void {
    this.unbindEvents();
    this.gamepad.dispose();
    this.touch.dispose();
    this.keysDown.clear();
  }

  private mergeIntoPendingMenuNav(src: MenuNavInput): void {
    this.pendingMenuNav.up = this.pendingMenuNav.up || src.up;
    this.pendingMenuNav.down = this.pendingMenuNav.down || src.down;
    this.pendingMenuNav.left = this.pendingMenuNav.left || src.left;
    this.pendingMenuNav.right = this.pendingMenuNav.right || src.right;
    this.pendingMenuNav.confirm = this.pendingMenuNav.confirm || src.confirm;
    this.pendingMenuNav.back = this.pendingMenuNav.back || src.back;
    this.pendingMenuNav.pause = this.pendingMenuNav.pause || src.pause;
    this.pendingMenuNav.toggleDebug = this.pendingMenuNav.toggleDebug || src.toggleDebug;
  }

  private clearKbPressed(): void {
    this.kbPressed.attack = false;
    this.kbPressed.special = false;
    this.kbPressed.cast = false;
    this.kbPressed.dash = false;
    this.kbPressed.call = false;
    this.kbPressed.reload = false;
    this.kbPressed.interact = false;
    this.kbPressed.pause = false;
    this.kbPressed.reroll = false;
    this.kbBoonSelectIndex = null;
  }

  private switchToKeyboard(): void {
    this.activeSource = 'keyboard';
    this.touch.notifyNonTouchInput();
  }

  private isSyntheticTouchMouseEvent(ev: MouseEvent): boolean {
    const caps = (ev as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } })
      .sourceCapabilities;
    if (caps?.firesTouchEvents) {
      return true;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.touch.getLastTouchTimestamp() < POST_TOUCH_MOUSE_GUARD_MS) {
      const pos = this.touch.getLastTouchPosition();
      if (Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        if (Math.hypot(ev.clientX - pos.x, ev.clientY - pos.y) < MOUSE_SWITCH_DISTANCE_PX) {
          return true;
        }
      }
    }
    return false;
  }

  // ---- DOM Event Handlers ----

  private readonly onKeyDown = (ev: KeyboardEvent): void => {
    const editable = isEditableElement(ev.target);
    if (editable && ev.code !== 'Escape' && ev.code !== 'F9') {
      return;
    }

    if (PREVENT_DEFAULT_CODES.has(ev.code)) {
      ev.preventDefault();
    }

    this.switchToKeyboard();

    const isFresh = !this.keysDown.has(ev.code);
    this.keysDown.add(ev.code);

    // Directional menu navigation allows key-repeat smoothly
    if (ev.code === 'ArrowUp' || ev.code === 'KeyW') {
      this.kbMenuNav.up = true;
    } else if (ev.code === 'ArrowDown' || ev.code === 'KeyS') {
      this.kbMenuNav.down = true;
    } else if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') {
      this.kbMenuNav.left = true;
    } else if (ev.code === 'ArrowRight' || ev.code === 'KeyD') {
      this.kbMenuNav.right = true;
    }

    if (!isFresh) {
      return;
    }

    switch (ev.code) {
      case 'KeyJ':
        this.kbPressed.attack = true;
        break;
      case 'KeyK':
        this.kbPressed.special = true;
        break;
      case 'KeyQ':
        this.kbPressed.cast = true;
        break;
      case 'Space':
        this.kbPressed.dash = true;
        this.kbMenuNav.confirm = true;
        break;
      case 'KeyF':
        this.kbPressed.call = true;
        break;
      case 'KeyR':
        this.kbPressed.reload = true;
        this.kbPressed.reroll = true;
        break;
      case 'KeyE':
        this.kbPressed.interact = true;
        break;
      case 'Escape':
        this.kbPressed.pause = true;
        this.kbMenuNav.pause = true;
        this.kbMenuNav.back = true;
        break;
      case 'Backspace':
        this.kbMenuNav.back = true;
        break;
      case 'Enter':
        this.kbMenuNav.confirm = true;
        break;
      case 'F9':
        this.kbMenuNav.toggleDebug = true;
        break;
      case 'Digit1':
      case 'Numpad1':
        this.kbBoonSelectIndex = 0;
        break;
      case 'Digit2':
      case 'Numpad2':
        this.kbBoonSelectIndex = 1;
        break;
      case 'Digit3':
      case 'Numpad3':
        this.kbBoonSelectIndex = 2;
        break;
      default:
        break;
    }
  };

  private readonly onKeyUp = (ev: KeyboardEvent): void => {
    this.keysDown.delete(ev.code);
  };

  private readonly onPointerMove = (ev: PointerEvent): void => {
    if (ev.pointerType === 'touch') {
      return;
    }
    this.handleMousePointerPosition(ev.clientX, ev.clientY, false);
  };

  private readonly onMouseMoveFallback = (ev: MouseEvent): void => {
    if (this.isSyntheticTouchMouseEvent(ev)) {
      return;
    }
    this.handleMousePointerPosition(ev.clientX, ev.clientY, true);
  };

  private handleMousePointerPosition(clientX: number, clientY: number, isLegacyFallback: boolean): void {
    const dx = clientX - this.lastMouseClientX;
    const dy = clientY - this.lastMouseClientY;
    this.mouseClientX = clientX;
    this.mouseClientY = clientY;

    const threshold = isLegacyFallback ? MOUSE_SWITCH_DISTANCE_PX : 2;
    if (!this.hasMouseMoved || Math.hypot(dx, dy) >= threshold) {
      this.lastMouseClientX = clientX;
      this.lastMouseClientY = clientY;
      this.hasMouseMoved = true;
      this.switchToKeyboard();
    }
  }

  private readonly onCanvasPointerDown = (ev: PointerEvent): void => {
    if (ev.pointerType === 'touch') {
      return;
    }

    this.mouseClientX = ev.clientX;
    this.mouseClientY = ev.clientY;
    this.lastMouseClientX = ev.clientX;
    this.lastMouseClientY = ev.clientY;
    this.hasMouseMoved = true;
    this.switchToKeyboard();

    if (ev.button === 0) {
      if (!this.mouseLeftDown) {
        this.kbPressed.attack = true;
      }
      this.mouseLeftDown = true;
    } else if (ev.button === 2) {
      if (!this.mouseRightDown) {
        this.kbPressed.special = true;
      }
      this.mouseRightDown = true;
    }
  };

  private readonly onWindowPointerUp = (ev: PointerEvent): void => {
    if (ev.pointerType === 'touch') {
      return;
    }
    if (ev.button === 0) {
      this.mouseLeftDown = false;
    } else if (ev.button === 2) {
      this.mouseRightDown = false;
    }
  };

  private readonly onCanvasContextMenu = (ev: MouseEvent): void => {
    ev.preventDefault();
  };

  private readonly onWindowBlur = (): void => {
    this.keysDown.clear();
    this.mouseLeftDown = false;
    this.mouseRightDown = false;
  };

  private bindEvents(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      window.addEventListener('mousemove', this.onMouseMoveFallback, { passive: true });
      window.addEventListener('pointerup', this.onWindowPointerUp);
      window.addEventListener('blur', this.onWindowBlur);
    }
    this.canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.addEventListener('contextmenu', this.onCanvasContextMenu);
  }

  private unbindEvents(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('mousemove', this.onMouseMoveFallback);
      window.removeEventListener('pointerup', this.onWindowPointerUp);
      window.removeEventListener('blur', this.onWindowBlur);
    }
    this.canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
    this.canvas.removeEventListener('contextmenu', this.onCanvasContextMenu);
  }
}
