/**
 * Krunked WannabeHades — Presentation-Layer Cosmetic Camera Feel Controller
 *
 * 100% presentation-only & zero-allocation:
 * - NEVER mutates SimState or affects 60Hz deterministic simulation parity
 * - Ticked at real display `dt` (30/60/120/144Hz frame-rate independent)
 * - Produces a pre-allocated `CameraFeelOffset` passed to `GameRenderer.setCameraFeelOffset`:
 *   1. Dynamic Aim Look-Ahead (critically-damped ~58px lead, clamped <= 68px, eases to 0 in menus/pause)
 *   2. Directional Impact Recoil Kick (8–16px attacks/hits, 18–26px player hurt, spring-damped)
 *   3. Micro-Zoom Punch & Dash Breathing (+0.032 crit/backstab, +0.042 armor/deflect,
 *      +0.068 boss/final kill, +0.075 boss phase/greater call/death defiance w/ 240ms hold,
 *      -0.018 dash pull-out; clamped to [0.96, 1.09], 0.35x when screenShake is disabled)
 *   4. Damped Trauma Shake Layer (squared trauma * golden-ratio dual-sine complementary micro-shake)
 */

import type {
  InputFrame,
  RenderSettings,
  ScreenId,
  SimEvent,
  SimState,
} from '../contracts/index.js';

export interface CameraFeelOffset {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly zoomMult: number;
  readonly shakeX: number;
  readonly shakeY: number;
}

export type ScreenFxKind =
  | 'chromatic'
  | 'shockwave'
  | 'crit_burst'
  | 'boss_phase'
  | 'greater_call'
  | 'death_defiance';

export interface ScreenFxImpulse {
  readonly kind: ScreenFxKind;
  readonly intensity: number;
  readonly worldX?: number;
  readonly worldY?: number;
  readonly colorHex?: string;
}

export interface GameRendererFeelHooks {
  setCameraFeelOffset(offset: CameraFeelOffset): void;
  triggerScreenFx(fx: ScreenFxImpulse): void;
  rebakeFontAtlas(): void;
}

const LOOK_AHEAD_BASE_PX = 58;
const LOOK_AHEAD_MAX_PX = 68;
const LOOK_AHEAD_LAMBDA = 7.5;

const RECOIL_OMEGA = 28;
const RECOIL_ZETA = 0.78;
const RECOIL_MAX_PX = 32;

const ZOOM_MIN = 0.96;
const ZOOM_MAX = 1.09;
const ZOOM_DASH_PULLOUT = -0.018;
const ZOOM_ZETA = 0.88;

const TRAUMA_DECAY_PER_SEC = 2.6;
const TRAUMA_MAX_AMP_PX = 10;

const SPRING_MAX_SUBSTEP = 1 / 120;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function resolveShakeScale(screenShake: boolean | number): number {
  if (typeof screenShake === 'number') {
    return Number.isFinite(screenShake) ? clamp(screenShake, 0, 1) : 0;
  }
  return screenShake ? 1 : 0;
}

export class CameraFeelController {
  // Aim look-ahead state (world px)
  private lookX = 0;
  private lookY = 0;

  // Directional recoil spring state (world px & px/s)
  private recoilX = 0;
  private recoilY = 0;
  private recoilVelX = 0;
  private recoilVelY = 0;

  // Micro-zoom punch & dash breathing state
  private zoomOffset = 0;
  private zoomVel = 0;
  private zoomHoldTimer = 0;
  private zoomReturnOmega = 20;
  private dashZoomOffset = 0;

  // Complementary trauma micro-shake state
  private trauma = 0;
  private elapsedSec = 0;

  // Pre-allocated mutable output struct (zero per-frame GC allocations)
  private readonly outOffset: {
    offsetX: number;
    offsetY: number;
    zoomMult: number;
    shakeX: number;
    shakeY: number;
  } = {
    offsetX: 0,
    offsetY: 0,
    zoomMult: 1,
    shakeX: 0,
    shakeY: 0,
  };

  /**
   * Cleanly resets all springs, offsets, zoom punches, and trauma to neutral
   * (used on room transitions, run start, courtyard entry, and debug warps).
   */
  public reset(): void {
    this.lookX = 0;
    this.lookY = 0;
    this.recoilX = 0;
    this.recoilY = 0;
    this.recoilVelX = 0;
    this.recoilVelY = 0;
    this.zoomOffset = 0;
    this.zoomVel = 0;
    this.zoomHoldTimer = 0;
    this.zoomReturnOmega = 20;
    this.dashZoomOffset = 0;
    this.trauma = 0;
    this.outOffset.offsetX = 0;
    this.outOffset.offsetY = 0;
    this.outOffset.zoomMult = 1;
    this.outOffset.shakeX = 0;
    this.outOffset.shakeY = 0;
  }

  /**
   * Read-only consumer of authoritative SimEvents to trigger cosmetic directional kicks,
   * zoom punches, and complementary trauma impulses.
   */
  public consumeEvents(
    events: readonly SimEvent[],
    state: Readonly<SimState>,
    screenShake: boolean | number
  ): void {
    if (events.length === 0) return;

    const shakeScale = resolveShakeScale(screenShake);
    const zoomScale = shakeScale > 0 ? 1.0 : 0.35;
    const playerPos = state.player.pos;
    const facingX = Math.cos(state.player.facingAngle);
    const facingY = Math.sin(state.player.facingAngle);

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.type) {
        case 'attack_swing': {
          const dirX = Math.cos(ev.angle);
          const dirY = Math.sin(ev.angle);
          const isRanged =
            ev.weaponId === 'heart_seeking_bow' || ev.weaponId === 'adamant_rail';
          const sign = isRanged ? -1 : 1;
          const baseMag = isRanged
            ? ev.weaponId === 'heart_seeking_bow'
              ? 11
              : 8.5
            : ev.isDashStrike || ev.comboStep >= 2
              ? 12
              : 8.5;
          this.addRecoil(dirX * sign, dirY * sign, baseMag * shakeScale);
          this.addTrauma(ev.isDashStrike || ev.comboStep >= 2 ? 0.12 : 0.06);
          break;
        }

        case 'special_cast': {
          const dirX = Math.cos(ev.angle);
          const dirY = Math.sin(ev.angle);
          const isRanged =
            ev.weaponId === 'heart_seeking_bow' || ev.weaponId === 'adamant_rail';
          const sign = isRanged ? -1 : 1;
          this.addRecoil(dirX * sign, dirY * sign, 14 * shakeScale);
          this.addTrauma(0.2);
          break;
        }

        case 'bloodstone_fired': {
          const dirX = Math.cos(ev.angle);
          const dirY = Math.sin(ev.angle);
          this.addRecoil(-dirX, -dirY, 9 * shakeScale);
          this.addTrauma(0.1);
          break;
        }

        case 'dash': {
          const dirX = Math.cos(ev.angle);
          const dirY = Math.sin(ev.angle);
          this.addRecoil(dirX, dirY, 6.5 * shakeScale);
          if (ev.perfect) {
            this.triggerZoomPunch(0.026 * zoomScale, 24, 0);
            this.addTrauma(0.18);
          }
          break;
        }

        case 'damage': {
          if (ev.targetKind === 'player') {
            // Derive incoming hit vector from closest live hostile (fallback: opposite player facing)
            let hitX = -facingX;
            let hitY = -facingY;
            let bestDistSq = 640 * 640;
            for (let eIdx = 0; eIdx < state.enemies.length; eIdx++) {
              const foe = state.enemies[eIdx];
              if (foe.hp <= 0 || foe.aiState === 'dead') continue;
              const dx = playerPos.x - foe.pos.x;
              const dy = playerPos.y - foe.pos.y;
              const dSq = dx * dx + dy * dy;
              if (dSq > 1 && dSq < bestDistSq) {
                bestDistSq = dSq;
                const inv = 1 / Math.sqrt(dSq);
                hitX = dx * inv;
                hitY = dy * inv;
              }
            }
            const severity = clamp(ev.amount / 32, 0, 1);
            const recoilMag = (18 + severity * 8) * shakeScale;
            this.addRecoil(hitX, hitY, recoilMag);
            this.addTrauma(0.36 + severity * 0.28);
            this.triggerZoomPunch(0.022 * zoomScale, 22, 0);
          } else {
            // Strike vector from hero to impacted foe
            let dx = ev.pos.x - playerPos.x;
            let dy = ev.pos.y - playerPos.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 1) {
              dx /= dist;
              dy /= dist;
            } else {
              dx = facingX;
              dy = facingY;
            }

            const mag =
              ev.armorBroken || ev.wallSlam
                ? 16
                : ev.crit
                  ? 14.5
                  : ev.backstab || ev.amount >= 40
                    ? 12
                    : 8.5;
            this.addRecoil(dx, dy, mag * shakeScale);

            if (ev.armorBroken) {
              this.triggerZoomPunch(0.042 * zoomScale, 19, 0.025);
              this.addTrauma(0.34);
            } else if (ev.crit) {
              this.triggerZoomPunch(0.032 * zoomScale, 24, 0);
              this.addTrauma(0.24);
            } else if (ev.backstab) {
              this.triggerZoomPunch(0.032 * zoomScale, 24, 0);
              this.addTrauma(0.18);
            } else if (ev.wallSlam) {
              this.triggerZoomPunch(0.026 * zoomScale, 21, 0);
              this.addTrauma(0.28);
            } else if (ev.amount >= 40) {
              this.addTrauma(0.14);
            } else {
              this.addTrauma(0.06);
            }
          }
          break;
        }

        case 'deflect': {
          let dx = ev.pos.x - playerPos.x;
          let dy = ev.pos.y - playerPos.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 1) {
            dx /= dist;
            dy /= dist;
          } else {
            dx = facingX;
            dy = facingY;
          }
          this.addRecoil(dx, dy, 12.5 * shakeScale);
          this.triggerZoomPunch(0.042 * zoomScale, 19, 0.02);
          this.addTrauma(0.32);
          break;
        }

        case 'enemy_death': {
          if (ev.finalInRoom || ev.isBoss) {
            let dx = ev.pos.x - playerPos.x;
            let dy = ev.pos.y - playerPos.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 1) {
              dx /= dist;
              dy /= dist;
            } else {
              dx = facingX;
              dy = facingY;
            }
            this.addRecoil(dx, dy, 16 * shakeScale);
            this.triggerZoomPunch(0.068 * zoomScale, 13, 0.08);
            this.addTrauma(ev.isBoss ? 0.62 : 0.48);
          } else {
            this.triggerZoomPunch(0.012 * zoomScale, 24, 0);
            this.addTrauma(0.11);
          }
          break;
        }

        case 'boss_phase': {
          this.triggerZoomPunch(0.075 * zoomScale, 12, 0.24);
          this.addTrauma(0.66);
          break;
        }

        case 'god_call': {
          if (ev.greater) {
            this.triggerZoomPunch(0.075 * zoomScale, 12, 0.24);
            this.addTrauma(0.58);
          } else {
            this.triggerZoomPunch(0.042 * zoomScale, 18, 0.05);
            this.addTrauma(0.3);
          }
          break;
        }

        case 'death_defiance': {
          this.triggerZoomPunch(0.075 * zoomScale, 12, 0.24);
          this.addTrauma(0.72);
          break;
        }

        case 'room_entered': {
          this.recoilX = 0;
          this.recoilY = 0;
          this.recoilVelX = 0;
          this.recoilVelY = 0;
          this.zoomOffset = 0;
          this.zoomVel = 0;
          this.zoomHoldTimer = 0;
          this.dashZoomOffset = 0;
          this.trauma = 0;
          break;
        }

        default:
          break;
      }
    }
  }

  /**
   * Advances presentation camera springs at real display `dtSec` and returns
   * the reusable `CameraFeelOffset` struct.
   */
  public update(
    dtSec: number,
    state: Readonly<SimState>,
    input: Readonly<InputFrame>,
    screen: ScreenId,
    settings: Readonly<RenderSettings>
  ): CameraFeelOffset {
    const dt = Number.isFinite(dtSec) ? clamp(dtSec, 0, 0.05) : 0;
    this.elapsedSec += dt;

    const shakeScale = resolveShakeScale(settings.screenShake);
    const zoomScale = shakeScale > 0 ? 1.0 : 0.35;

    const inLiveGameplay =
      (screen === 'playing' || screen === 'hub') &&
      !state.run.paused &&
      state.run.pendingOffer === null &&
      !state.run.victory &&
      !state.run.defeat;

    // 1. Dynamic Aim Look-Ahead (critically damped ~58px lead, clamped <= 68px; 0 in menus/pause)
    let targetLookX = 0;
    let targetLookY = 0;

    if (inLiveGameplay) {
      const hubScale = screen === 'hub' ? 0.72 : 1.0;

      if (input.source === 'keyboard' && input.hasAimWorld) {
        const dx = input.aimWorldX - state.player.pos.x;
        const dy = input.aimWorldY - state.player.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          const normT = clamp((dist - 28) / 260, 0, 1);
          const smooth = normT * normT * (3 - 2 * normT);
          const mag = Math.min(LOOK_AHEAD_MAX_PX, LOOK_AHEAD_BASE_PX * smooth * hubScale);
          targetLookX = (dx / dist) * mag;
          targetLookY = (dy / dist) * mag;
        }
      } else {
        const moveMag = Math.hypot(input.moveX, input.moveY);
        const aimMag = Math.hypot(input.aimDirX, input.aimDirY);
        const activeAction =
          moveMag > 0.12 ||
          state.player.attackTimer > 0 ||
          state.player.attackChargeTimer > 0 ||
          state.player.specialTimer > 0 ||
          state.player.dashTimer > 0;

        if (activeAction && aimMag > 0.01) {
          const mag = Math.min(LOOK_AHEAD_MAX_PX, LOOK_AHEAD_BASE_PX * hubScale);
          targetLookX = (input.aimDirX / aimMag) * mag;
          targetLookY = (input.aimDirY / aimMag) * mag;
        } else if (screen === 'playing' && aimMag > 0.01) {
          // Gentle combat sightline bias even when standing still between dodges
          const mag = LOOK_AHEAD_BASE_PX * 0.42;
          targetLookX = (input.aimDirX / aimMag) * mag;
          targetLookY = (input.aimDirY / aimMag) * mag;
        }
      }

      // Hard safety clamp <= 68px world units
      const lookLen = Math.hypot(targetLookX, targetLookY);
      if (lookLen > LOOK_AHEAD_MAX_PX) {
        const s = LOOK_AHEAD_MAX_PX / lookLen;
        targetLookX *= s;
        targetLookY *= s;
      }
    }

    const lookLambda = inLiveGameplay ? LOOK_AHEAD_LAMBDA : 10.5;
    const lookAlpha = 1 - Math.exp(-lookLambda * dt);
    this.lookX += (targetLookX - this.lookX) * lookAlpha;
    this.lookY += (targetLookY - this.lookY) * lookAlpha;
    if (Math.abs(this.lookX) < 0.01 && targetLookX === 0) this.lookX = 0;
    if (Math.abs(this.lookY) < 0.01 && targetLookY === 0) this.lookY = 0;

    // 2. Directional Impact Recoil Spring-Damper (substepped for unconditional 30-144Hz stability)
    if (dt > 0) {
      let rem = dt;
      while (rem > 0.00001) {
        const h = rem > SPRING_MAX_SUBSTEP ? SPRING_MAX_SUBSTEP : rem;
        rem -= h;

        const omegaSq = RECOIL_OMEGA * RECOIL_OMEGA;
        const damp = 2 * RECOIL_ZETA * RECOIL_OMEGA;

        const ax = -omegaSq * this.recoilX - damp * this.recoilVelX;
        const ay = -omegaSq * this.recoilY - damp * this.recoilVelY;
        this.recoilVelX += ax * h;
        this.recoilVelY += ay * h;
        this.recoilX += this.recoilVelX * h;
        this.recoilY += this.recoilVelY * h;
      }
      if (
        Math.abs(this.recoilX) < 0.02 &&
        Math.abs(this.recoilY) < 0.02 &&
        Math.abs(this.recoilVelX) < 0.05 &&
        Math.abs(this.recoilVelY) < 0.05
      ) {
        this.recoilX = 0;
        this.recoilY = 0;
        this.recoilVelX = 0;
        this.recoilVelY = 0;
      }
    }

    // 3. Micro-Zoom Punch & Dash Breathing
    if (!inLiveGameplay) {
      this.zoomHoldTimer = 0;
      const menuZoomAlpha = 1 - Math.exp(-10 * dt);
      this.zoomOffset += (0 - this.zoomOffset) * menuZoomAlpha;
      this.zoomVel *= Math.exp(-12 * dt);
      this.dashZoomOffset += (0 - this.dashZoomOffset) * menuZoomAlpha;
    } else {
      if (this.zoomHoldTimer > 0) {
        this.zoomHoldTimer = Math.max(0, this.zoomHoldTimer - dt);
        // Subtle living hold drift during dramatic boss phase / Greater Call / Death Defiance beats
        this.zoomOffset *= Math.exp(-1.4 * dt);
        this.zoomVel = 0;
      } else if (dt > 0) {
        let rem = dt;
        const omega = this.zoomReturnOmega;
        const omegaSq = omega * omega;
        const damp = 2 * ZOOM_ZETA * omega;
        while (rem > 0.00001) {
          const h = rem > SPRING_MAX_SUBSTEP ? SPRING_MAX_SUBSTEP : rem;
          rem -= h;
          const az = -omegaSq * this.zoomOffset - damp * this.zoomVel;
          this.zoomVel += az * h;
          this.zoomOffset += this.zoomVel * h;
        }
        if (Math.abs(this.zoomOffset) < 0.0002 && Math.abs(this.zoomVel) < 0.001) {
          this.zoomOffset = 0;
          this.zoomVel = 0;
        }
      }

      // Dash breathing: -0.018 pull-out at dash velocity peak, snapping smoothly back on landing
      const isDashing = state.player.dashTimer > 0.02;
      const targetDashZoom = isDashing ? ZOOM_DASH_PULLOUT * zoomScale : 0;
      const dashLambda = isDashing ? 22 : 14;
      const dashAlpha = 1 - Math.exp(-dashLambda * dt);
      this.dashZoomOffset += (targetDashZoom - this.dashZoomOffset) * dashAlpha;
      if (!isDashing && Math.abs(this.dashZoomOffset) < 0.0002) {
        this.dashZoomOffset = 0;
      }
    }

    // 4. Damped Trauma Shake Layer (squared trauma * golden-ratio dual-sine)
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY_PER_SEC * dt);
    let shakeX = 0;
    let shakeY = 0;
    if (inLiveGameplay && shakeScale > 0 && this.trauma > 0.001) {
      const amp = this.trauma * this.trauma * TRAUMA_MAX_AMP_PX * shakeScale;
      const t = this.elapsedSec;
      shakeX = amp * (0.68 * Math.sin(t * 47.3) + 0.32 * Math.cos(t * 76.53));
      shakeY = amp * (0.68 * Math.cos(t * 53.7) + 0.32 * Math.sin(t * 86.91));
    }

    // Assemble pre-allocated output struct
    this.outOffset.offsetX = this.lookX + this.recoilX;
    this.outOffset.offsetY = this.lookY + this.recoilY;
    this.outOffset.zoomMult = clamp(1.0 + this.zoomOffset + this.dashZoomOffset, ZOOM_MIN, ZOOM_MAX);
    this.outOffset.shakeX = shakeX;
    this.outOffset.shakeY = shakeY;
    return this.outOffset;
  }

  public getOffset(): CameraFeelOffset {
    return this.outOffset;
  }

  private addRecoil(dirX: number, dirY: number, magnitudePx: number): void {
    if (magnitudePx <= 0.01) return;
    // Instantaneous snap kick + subtle follow-through velocity impulse
    this.recoilX += dirX * magnitudePx;
    this.recoilY += dirY * magnitudePx;
    this.recoilVelX += dirX * magnitudePx * 5.5;
    this.recoilVelY += dirY * magnitudePx * 5.5;

    const len = Math.hypot(this.recoilX, this.recoilY);
    if (len > RECOIL_MAX_PX) {
      const s = RECOIL_MAX_PX / len;
      this.recoilX *= s;
      this.recoilY *= s;
    }
  }

  private triggerZoomPunch(delta: number, returnOmega: number, holdSec: number): void {
    if (delta <= 0) return;
    // Preserve stronger active punches rather than overwriting a Boss Phase swell with a small crit
    if (delta >= this.zoomOffset * 0.85) {
      this.zoomOffset = Math.min(ZOOM_MAX - 1.0, Math.max(this.zoomOffset, delta));
      this.zoomVel = Math.max(0, this.zoomVel);
      this.zoomReturnOmega = returnOmega;
      if (holdSec > this.zoomHoldTimer) {
        this.zoomHoldTimer = holdSec;
      }
    }
  }

  private addTrauma(amount: number): void {
    if (amount <= 0) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }
}
