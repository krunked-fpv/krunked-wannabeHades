/**
 * Krunked WannabeHades — Unified AudioEngine Facade (Wave 2 Full 5-Biome / 5-Boss / 6-Arm Suite)
 *
 * Orchestrates ProceduralSfx and MusicSynthesizer behind a strict, autoplay-safe API:
 * - Lazy AudioContext creation on user gesture (`unlock()`) -> zero browser autoplay warnings
 * - Safe no-op when AudioContext is absent (Node/headless) or suspended -> zero unhandled rejections
 * - Master DynamicsCompressorNode preventing clipping across simultaneous SFX + Greek-metal stems
 * - Bespoke SimEvent + PlayerState foley routing for all 6 Infernal Arms, hazards, statuses, and Chaos
 * - Adaptive 5-Biome + Hub + Boatman Shop + 5-Boss soundtrack (incl. Sovereign Lord P1->P2 shred ramp!)
 */

import {
  DEFAULT_RENDER_SETTINGS,
  type BiomeId,
  type BossId,
  type RenderSettings,
  type ScreenId,
  type SimEvent,
  type SimState,
} from '../contracts/index';
import { MusicSynthesizer } from './MusicSynthesizer';
import { ProceduralSfx } from './ProceduralSfx';
import {
  getBuiltinAudioIds,
  type MusicIntensity,
  type MusicTrackId,
  type SfxId,
} from './soundManifest';

interface AudioContextHost {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function resolveAudioContextCtor(): (typeof AudioContext) | null {
  if (typeof globalThis === 'undefined') return null;
  const host = globalThis as unknown as AudioContextHost;
  return host.AudioContext ?? host.webkitAudioContext ?? null;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private sfx: ProceduralSfx | null = null;
  private music: MusicSynthesizer | null = null;

  private settings: RenderSettings = { ...DEFAULT_RENDER_SETTINGS };
  private desiredTrack: MusicTrackId = 'hub_sanctum';
  private desiredIntensity: MusicIntensity = 'hub';
  private desiredBossPhase = 1;
  private desiredMuffled = false;

  // Edge-detection trackers for seamless PlayerState-driven foley
  private seenZeroBasedCombo = false;
  private prevTick = -1;
  private prevRoomIndex = -1;
  private prevCastAmmo = -1;
  private prevSpearOut = false;
  private prevReloadTimer = 0;
  private prevAttackChargeTimer = 0;
  private prevIsBlocking = false;
  private prevInLava = false;
  private prevInPoison = false;
  private prevHasPoisonStatus = false;
  private lastLavaSizzleTick = -999;
  private lastPoisonHissTick = -999;
  private lastUiHoverMs = -Infinity;
  private disposed = false;

  /**
   * Call from a user gesture (pointerdown / keydown / gamepad) to lazily construct
   * and resume the Web Audio graph without triggering browser autoplay warnings.
   */
  unlock(): void {
    if (this.disposed) return;

    if (!this.ctx) {
      const Ctor = resolveAudioContextCtor();
      if (!Ctor) return;
      try {
        const ctx = new Ctor();
        this.ctx = ctx;
        this.initGraph(ctx);
      } catch {
        this.ctx = null;
        return;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        const promise = this.ctx.resume();
        if (promise && typeof promise.then === 'function') {
          promise
            .then(() => {
              if (!this.disposed && this.music && this.ctx?.state === 'running') {
                this.music.setBossPhase(this.desiredBossPhase);
                this.music.setState(this.desiredTrack, this.desiredIntensity);
                this.music.setMenuMuffled(this.desiredMuffled);
              }
            })
            .catch(() => {
              // Swallow autoplay / gesture rejection safely
            });
        }
      } catch {
        // Ignore synchronous resume failures
      }
    }
  }

  /**
   * Translate authoritative 60Hz SimEvents into tactile combat foley & Patron stingers,
   * optionally spatially panned relative to `listenerX` (camera center X).
   */
  handleSimEvents(events: readonly SimEvent[], listenerX?: number): void {
    if (this.disposed || !this.sfx || !this.ctx || this.ctx.state !== 'running') return;
    if (this.settings.muted || this.settings.masterVolume <= 0.001 || this.settings.sfxVolume <= 0.001) {
      return;
    }

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      switch (ev.type) {
        case 'attack_swing': {
          if (ev.comboStep === 0) {
            this.seenZeroBasedCombo = true;
          }
          const step = this.seenZeroBasedCombo ? ev.comboStep + 1 : Math.max(1, ev.comboStep);
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          this.dispatchWeaponAttackSfx(ev.weaponId, step, ev.isDashStrike, pan);
          break;
        }

        case 'special_cast': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          this.dispatchWeaponSpecialSfx(ev.weaponId, pan);
          break;
        }

        case 'bloodstone_fired': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          this.sfx.play('cast_fire', { patronId: ev.patronId, pan });
          break;
        }

        case 'dash': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          this.sfx.play(ev.perfect ? 'dash_perfect' : 'dash', {
            patronId: ev.patronId,
            pan,
          });
          break;
        }

        case 'damage': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          if (ev.targetKind === 'player') {
            this.sfx.play('player_hit', { pan: pan !== undefined ? pan * 0.45 : undefined });
          } else {
            if (ev.armorBroken) {
              this.sfx.play('armor_break', { pan });
            }
            if (ev.wallSlam) {
              this.sfx.play('wall_slam', { pan });
            }
            if (ev.crit) {
              this.sfx.play('hit_crit', { pan });
            } else if (ev.backstab) {
              this.sfx.play('hit_backstab', { pan });
            } else if (ev.amount >= 40) {
              this.sfx.play('hit_heavy', { pan });
            } else {
              this.sfx.play('hit_light', { pan });
            }
          }
          break;
        }

        case 'deflect': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          this.sfx.play('deflect', { pan });
          break;
        }

        case 'enemy_spawn': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          this.sfx.play('enemy_spawn', { isBoss: ev.isBoss, pan });
          break;
        }

        case 'enemy_death': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          if (ev.archetype === 'soul_orb') {
            this.sfx.play('soul_eye_shatter', { pan });
          } else if (ev.finalInRoom || ev.isBoss) {
            this.sfx.play('final_kill_boom', { pan: pan !== undefined ? pan * 0.35 : undefined });
            this.music?.duck(0.32, 0.85);
          } else {
            this.sfx.play('enemy_death', { pan });
          }
          break;
        }

        case 'boss_phase': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          this.sfx.play('boss_phase', { pan: pan !== undefined ? pan * 0.4 : undefined });
          this.music?.duck(0.5, 0.65);
          if (ev.bossId === 'sovereign_lord' && ev.phase >= 2) {
            this.desiredTrack = 'boss_sovereign_p2';
            this.desiredIntensity = 'boss';
            this.desiredBossPhase = ev.phase;
            this.music?.setBossPhase(ev.phase);
            this.music?.setState('boss_sovereign_p2', 'boss');
          }
          break;
        }

        case 'status_applied': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          if (ev.statusId === 'chill') {
            this.sfx.play('chill_crackle', { volume: 0.65, pan });
          } else if (ev.statusId === 'hangover') {
            this.sfx.play('hangover_fizz', { volume: 0.65, pan });
          } else if (ev.statusId === 'poison') {
            this.sfx.play('poison_hiss', { volume: 0.65, pan });
          } else if (ev.statusId === 'doom') {
            this.sfx.play('doom_gong', { volume: 0.42, pitchScale: 1.45, pan });
          }
          break;
        }

        case 'status_triggered': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          if (ev.statusId === 'doom') {
            this.sfx.play('doom_gong', { pan });
          } else if (ev.statusId === 'hangover') {
            this.sfx.play('hangover_fizz', { pan });
          } else if (ev.statusId === 'chill') {
            this.sfx.play('chill_crackle', { pan });
          } else if (ev.statusId === 'poison') {
            this.sfx.play('poison_hiss', { pan });
          } else {
            this.sfx.play('status_proc', { statusId: ev.statusId, pan });
          }
          break;
        }

        case 'pickup_collected': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          const lower = ev.label.toLowerCase();
          if (ev.kind === 'chaos_gate') {
            this.sfx.play('chaos_void_hum', { pan });
          } else if (ev.kind === 'fountain') {
            this.sfx.play('curing_pool_chime', { pan });
          } else if (lower.includes('bloodstone') || lower.includes('cast')) {
            this.sfx.play('cast_pickup', { pan });
          } else {
            this.sfx.play('pickup_collect', { patronId: ev.patronId, pan });
          }
          break;
        }

        case 'boon_offered': {
          this.sfx.play('boon_offer', { patronId: ev.offer.patronId });
          break;
        }

        case 'boon_selected': {
          this.sfx.play('boon_select', {
            patronId: ev.patronId,
            rarity: ev.rarity,
          });
          break;
        }

        case 'god_call': {
          const pan = this.computeSpatialPan(ev.pos.x, listenerX);
          this.sfx.play('god_call', {
            patronId: ev.patronId,
            greater: ev.greater,
            pan: pan !== undefined ? pan * 0.35 : undefined,
          });
          if (ev.greater) {
            this.music?.duck(0.45, 0.9);
          }
          break;
        }

        case 'death_defiance': {
          this.sfx.play('death_defiance');
          this.music?.duck(0.25, 1.15);
          break;
        }

        case 'room_cleared': {
          this.sfx.play('door_unlock');
          break;
        }

        case 'room_entered': {
          if (ev.encounterKind === 'chaos') {
            this.sfx.play('chaos_void_hum');
          } else {
            this.sfx.play('room_enter');
          }
          break;
        }

        case 'run_ended': {
          this.desiredTrack = ev.victory ? 'victory_fanfare' : 'death_stinger';
          this.desiredIntensity = 'hub';
          this.music?.setState(this.desiredTrack, this.desiredIntensity);
          break;
        }

        case 'hitstop':
        case 'camera_shake':
        case 'rumble':
        case 'ui_toast':
          break;
      }
    }
  }

  /**
   * Synchronize adaptive 5-biome / 5-boss / shop soundtrack AND state-driven foley
   * (cast pickup, lava sizzle, poison hiss, curing pool cleanse, bow draw, rail reload, spear recall).
   */
  updateMusic(state: SimState, screen: ScreenId): void {
    if (this.disposed) return;

    const sameRoomAdvance =
      this.prevTick >= 0 &&
      state.tick > this.prevTick &&
      state.room.roomIndex === this.prevRoomIndex &&
      screen === 'playing';

    const hasPoisonStatus = state.player.statuses.some((s) => s.id === 'poison' && s.remaining > 0);
    const canPlaySfx =
      this.sfx !== null &&
      this.ctx !== null &&
      this.ctx.state === 'running' &&
      !this.settings.muted &&
      this.settings.masterVolume > 0.001 &&
      this.settings.sfxVolume > 0.001;

    if (sameRoomAdvance && canPlaySfx && this.sfx) {
      const camX = state.camera.zoom > 0.05 ? state.camera.x : state.player.pos.x;
      const heroPan = this.computeSpatialPan(state.player.pos.x, camX);
      // 1. Bloodstone pickup
      if (this.prevCastAmmo >= 0 && state.player.castAmmo > this.prevCastAmmo) {
        this.sfx.play('cast_pickup', { pan: heroPan });
      }
      // 2. Eternal Spear recall transition (spearOut true -> false)
      if (state.player.weaponId === 'eternal_spear' && this.prevSpearOut && !state.player.spearOut) {
        this.sfx.play('spear_recall', { pan: heroPan });
      }
      // 3. Adamant Rail reload clack transition (reloadTimer <= 0 -> > 0)
      if (
        state.player.weaponId === 'adamant_rail' &&
        this.prevReloadTimer <= 0 &&
        state.player.reloadTimer > 0
      ) {
        this.sfx.play('rail_reload', { pan: heroPan });
      }
      // 4. Heart-Seeking Bow draw creak + golden Power Shot glint
      if (state.player.weaponId === 'heart_seeking_bow') {
        if (this.prevAttackChargeTimer <= 0 && state.player.attackChargeTimer > 0) {
          this.sfx.play('bow_draw', { pan: heroPan });
        } else if (this.prevAttackChargeTimer < 0.42 && state.player.attackChargeTimer >= 0.42) {
          this.sfx.play('bow_power_shot', { volume: 0.35, pitchScale: 1.25, pan: heroPan });
        }
      }
      // 5. Shield of Chaos block/Bull Rush clang
      if (state.player.weaponId === 'shield_of_chaos' && !this.prevIsBlocking && state.player.isBlocking) {
        this.sfx.play('shield_clang', { volume: 0.45, pan: heroPan });
      }
      // 6. Cinder Mire lava sizzle
      if (state.player.inLava && (!this.prevInLava || state.tick - this.lastLavaSizzleTick >= 26)) {
        this.sfx.play('lava_sizzle', { pan: heroPan });
        this.lastLavaSizzleTick = state.tick;
      }
      // 7. Crypt of Bile poison hiss
      if (state.player.inPoison && (!this.prevInPoison || state.tick - this.lastPoisonHissTick >= 30)) {
        this.sfx.play('poison_hiss', { pan: heroPan });
        this.lastPoisonHissTick = state.tick;
      }
      // 8. Crypt of Bile curing pool cleanse chime
      if (this.prevHasPoisonStatus && !hasPoisonStatus) {
        this.sfx.play('curing_pool_chime', { pan: heroPan });
      }
    }

    this.prevTick = state.tick;
    this.prevRoomIndex = state.room.roomIndex;
    this.prevCastAmmo = state.player.castAmmo;
    this.prevSpearOut = state.player.spearOut;
    this.prevReloadTimer = state.player.reloadTimer;
    this.prevAttackChargeTimer = state.player.attackChargeTimer;
    this.prevIsBlocking = state.player.isBlocking;
    this.prevInLava = state.player.inLava;
    this.prevInPoison = state.player.inPoison;
    this.prevHasPoisonStatus = hasPoisonStatus;

    const { track, intensity, bossPhase, muffled } = this.resolveMusicTarget(state, screen);
    this.desiredTrack = track;
    this.desiredIntensity = intensity;
    this.desiredBossPhase = bossPhase;
    this.desiredMuffled = muffled;

    if (this.music && this.ctx && this.ctx.state === 'running') {
      this.music.setBossPhase(bossPhase);
      this.music.setState(track, intensity);
      this.music.setMenuMuffled(muffled);
    }
  }

  /**
   * Apply master/music/sfx volumes and mute flag smoothly (safe before or after unlock).
   */
  applySettings(settings: RenderSettings): void {
    this.settings = { ...settings };
    if (this.disposed || !this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const master = settings.muted ? 0 : clamp01(settings.masterVolume);
    const music = clamp01(settings.musicVolume);
    const sfx = clamp01(settings.sfxVolume);

    this.masterGain.gain.setTargetAtTime(master, now, 0.03);
    this.musicGain.gain.setTargetAtTime(music, now, 0.04);
    this.sfxGain.gain.setTargetAtTime(sfx, now, 0.03);
  }

  /**
   * Play crisp carved-marble and burnished-bronze UI feedback sounds.
   * Hover ticks are debounced at 45ms so rapid cursor sweeps remain velvety.
   */
  playUiSound(kind: 'click' | 'hover' | 'confirm' | 'back'): void {
    if (this.disposed || !this.sfx || !this.ctx || this.ctx.state !== 'running') return;
    if (this.settings.muted || this.settings.masterVolume <= 0.001 || this.settings.sfxVolume <= 0.001) {
      return;
    }

    if (kind === 'hover') {
      const nowMs = this.ctx.currentTime * 1000;
      if (nowMs - this.lastUiHoverMs < 45) return;
      this.lastUiHoverMs = nowMs;
    }

    const id: SfxId =
      kind === 'click'
        ? 'ui_click'
        : kind === 'hover'
          ? 'ui_hover'
          : kind === 'confirm'
            ? 'ui_confirm'
            : 'ui_back';
    this.sfx.play(id);
  }

  /**
   * Canonical list of all procedural SFX & Music Track IDs.
   */
  getManifestIds(): string[] {
    return getBuiltinAudioIds();
  }

  /**
   * Cleanly stop all loops, release AudioNodes, and close the AudioContext.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.music?.dispose();
    this.music = null;

    this.sfx?.dispose();
    this.sfx = null;

    try {
      this.musicGain?.disconnect();
      this.sfxGain?.disconnect();
      this.masterCompressor?.disconnect();
      this.masterGain?.disconnect();
    } catch {
      // ignore disconnect errors
    }

    const ctx = this.ctx;
    this.ctx = null;
    this.masterCompressor = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;

    if (ctx && typeof ctx.close === 'function' && ctx.state !== 'closed') {
      try {
        const p = ctx.close();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // ignore close rejection
          });
        }
      } catch {
        // ignore close exception
      }
    }
  }

  // ============================================================================
  // Spatial Panning & Bespoke 6-Weapon Foley Dispatch
  // ============================================================================

  private computeSpatialPan(worldX: number, listenerX?: number): number | undefined {
    if (listenerX === undefined || !Number.isFinite(worldX) || !Number.isFinite(listenerX)) {
      return undefined;
    }
    const raw = (worldX - listenerX) / 680;
    return raw < -0.75 ? -0.75 : raw > 0.75 ? 0.75 : raw;
  }

  private dispatchWeaponAttackSfx(
    weaponId: SimState['player']['weaponId'],
    step: number,
    isDashStrike: boolean,
    pan?: number
  ): void {
    if (!this.sfx) return;
    switch (weaponId) {
      case 'stygian_blade': {
        const swingId: SfxId =
          step <= 1 ? 'sword_swing_1' : step === 2 ? 'sword_swing_2' : 'sword_swing_3';
        this.sfx.play(swingId, { weaponId, isDashStrike, pan });
        break;
      }
      case 'eternal_spear': {
        if (step >= 4) {
          this.sfx.play('spear_spin', { weaponId, isDashStrike, pan });
        } else {
          const pitchScale = step <= 1 ? 1.0 : step === 2 ? 1.14 : 1.3;
          this.sfx.play('spear_thrust', { weaponId, isDashStrike, pitchScale, pan });
        }
        break;
      }
      case 'shield_of_chaos': {
        this.sfx.play(isDashStrike ? 'shield_clang' : 'shield_bash', { weaponId, isDashStrike, pan });
        break;
      }
      case 'heart_seeking_bow': {
        // Power Shot chime on full/empowered shots (or comboStep >= 2 / dash-strike); crisp twang on quick taps
        const pitchScale = isDashStrike ? 1.08 : step >= 2 ? 1.04 : 0.94;
        this.sfx.play('bow_power_shot', {
          weaponId,
          isDashStrike,
          pitchScale,
          volume: step >= 2 || isDashStrike ? 1.0 : 0.72,
          pan,
        });
        break;
      }
      case 'twin_fists': {
        const fistLadder = [0.94, 1.02, 1.1, 1.18, 1.32];
        const idx = Math.max(0, Math.min(fistLadder.length - 1, step - 1));
        this.sfx.play('fists_flurry', {
          weaponId,
          isDashStrike,
          pitchScale: fistLadder[idx],
          pan,
        });
        break;
      }
      case 'adamant_rail': {
        this.sfx.play('rail_shot', { weaponId, isDashStrike, pan });
        break;
      }
    }
  }

  private dispatchWeaponSpecialSfx(weaponId: SimState['player']['weaponId'], pan?: number): void {
    if (!this.sfx) return;
    switch (weaponId) {
      case 'stygian_blade':
        this.sfx.play('sword_nova', { weaponId, pan });
        break;
      case 'eternal_spear':
        this.sfx.play(this.prevSpearOut ? 'spear_recall' : 'spear_thrust', {
          weaponId,
          pitchScale: this.prevSpearOut ? 1.0 : 0.9,
          pan,
        });
        break;
      case 'shield_of_chaos':
        this.sfx.play('shield_boomerang', { weaponId, pan });
        break;
      case 'heart_seeking_bow':
        this.sfx.play('bow_volley', { weaponId, pan });
        break;
      case 'twin_fists':
        this.sfx.play('fists_uppercut', { weaponId, pan });
        break;
      case 'adamant_rail':
        this.sfx.play('rail_mortar', { weaponId, pan });
        break;
    }
  }

  // ============================================================================
  // Internals & Adaptive 5-Biome / 5-Boss Track Selection
  // ============================================================================

  private initGraph(ctx: AudioContext): void {
    const masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.value = -10;
    masterCompressor.knee.value = 8;
    masterCompressor.ratio.value = 8;
    masterCompressor.attack.value = 0.003;
    masterCompressor.release.value = 0.1;

    const masterGain = ctx.createGain();
    const musicGain = ctx.createGain();
    const sfxGain = ctx.createGain();

    musicGain.connect(masterCompressor);
    sfxGain.connect(masterCompressor);
    masterCompressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    this.masterCompressor = masterCompressor;
    this.masterGain = masterGain;
    this.musicGain = musicGain;
    this.sfxGain = sfxGain;

    this.sfx = new ProceduralSfx(ctx, sfxGain);
    this.music = new MusicSynthesizer(ctx, musicGain);

    this.applySettings(this.settings);
    this.music.setBossPhase(this.desiredBossPhase);
    this.music.setState(this.desiredTrack, this.desiredIntensity);
    this.music.setMenuMuffled(this.desiredMuffled);
    this.music.start();
  }

  private resolveMusicTarget(
    state: SimState,
    screen: ScreenId
  ): { track: MusicTrackId; intensity: MusicIntensity; bossPhase: number; muffled: boolean } {
    const muffled =
      state.run.paused ||
      screen === 'pause' ||
      screen === 'options' ||
      screen === 'boon_select' ||
      screen === 'weapon_menu' ||
      screen === 'mirror_menu' ||
      screen === 'shrine_menu' ||
      screen === 'keepsake_menu' ||
      screen === 'codex_menu';

    if (screen === 'victory' || state.run.victory) {
      return { track: 'victory_fanfare', intensity: 'hub', bossPhase: 1, muffled: false };
    }
    if (screen === 'death' || state.run.defeat) {
      return { track: 'death_stinger', intensity: 'hub', bossPhase: 1, muffled: false };
    }
    if (
      screen === 'title' ||
      screen === 'hub' ||
      state.run.inHub ||
      state.room.biome === 'sanctum_hub'
    ) {
      return { track: 'hub_sanctum', intensity: 'hub', bossPhase: 1, muffled };
    }

    let liveBossId: BossId | null = null;
    let liveBossPhase = 1;
    let hasLiveHostile = false;

    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.hp <= 0 || e.aiState === 'dead') continue;
      if (e.archetype === 'rattlebones_dummy') continue;
      hasLiveHostile = true;
      if (e.isBoss) {
        if (liveBossId === null || e.bossId === 'sovereign_lord') {
          liveBossId = e.bossId ?? null;
          liveBossPhase = Math.max(1, e.phase);
        }
      }
    }

    const isBossRoom =
      state.room.encounterKind === 'boss' ||
      state.room.encounterKind === 'surface_boss' ||
      liveBossId !== null;

    // 1. All 5 Boss Tiers (runs BEFORE shop check so borrowing Gold Bag -> Ferryman instantly triggers boss_ferryman!)
    if (isBossRoom && hasLiveHostile && !state.room.cleared) {
      const bossTrack = this.bossToTrack(liveBossId, state.room.biome, liveBossPhase);
      return { track: bossTrack, intensity: 'boss', bossPhase: liveBossPhase, muffled };
    }

    // 2. Boatman Shop / Styx Hub calm mysterious Dorian theme
    if (
      screen === 'shop_menu' ||
      state.room.encounterKind === 'shop' ||
      state.room.encounterKind === 'styx_hub'
    ) {
      return { track: 'boatman_shop', intensity: 'explore', bossPhase: 1, muffled };
    }

    // 3. Chaos Realm brooding sparse atmosphere
    if (state.room.encounterKind === 'chaos') {
      return { track: 'hub_sanctum', intensity: 'hub', bossPhase: 1, muffled };
    }

    // 4. All 5 Biomes (combat shred vs. explore tension)
    const biomeTrack = this.biomeToTrack(state.room.biome);
    if (hasLiveHostile && !state.room.cleared && state.room.combatStarted) {
      return { track: biomeTrack, intensity: 'combat', bossPhase: 1, muffled };
    }

    return { track: biomeTrack, intensity: 'explore', bossPhase: 1, muffled };
  }

  private bossToTrack(bossId: BossId | null, biome: BiomeId, phase: number): MusicTrackId {
    if (bossId === 'sovereign_lord' || (bossId === null && biome === 'frozen_summit')) {
      return phase >= 2 ? 'boss_sovereign_p2' : 'boss_sovereign';
    }
    if (bossId === 'the_ferryman') {
      return 'boss_ferryman';
    }
    if (
      bossId === 'colosseum_bull' ||
      bossId === 'colosseum_spearlord' ||
      (bossId === null && biome === 'verdant_colosseum')
    ) {
      return 'boss_champions';
    }
    if (bossId === 'bone_leviathan' || (bossId === null && biome === 'cinder_mire')) {
      return 'boss_leviathan';
    }
    return 'boss_warden';
  }

  private biomeToTrack(biome: BiomeId): MusicTrackId {
    switch (biome) {
      case 'sanctum_hub':
        return 'hub_sanctum';
      case 'obsidian_pit':
        return 'obsidian_pit';
      case 'cinder_mire':
        return 'cinder_mire';
      case 'verdant_colosseum':
        return 'verdant_colosseum';
      case 'crypt_of_bile':
        return 'crypt_of_bile';
      case 'frozen_summit':
        return 'frozen_summit';
    }
  }
}

export {
  getBuiltinAudioIds,
  MUSIC_TRACK_IDS,
  SCALE_INTERVALS,
  SFX_IDS,
} from './soundManifest';
export type {
  AudioId,
  DrumStyleId,
  MusicalModeId,
  MusicIntensity,
  MusicTrackId,
  SfxId,
} from './soundManifest';
