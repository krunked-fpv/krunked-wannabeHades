/**
 * Krunked WannabeHades — Unified AudioEngine Facade
 *
 * Orchestrates ProceduralSfx and MusicSynthesizer behind a strict, autoplay-safe API:
 * - Lazy AudioContext creation on user gesture (`unlock()`) -> zero browser autoplay warnings
 * - Safe no-op when AudioContext is absent (Node/headless) or suspended -> zero unhandled rejections
 * - Master DynamicsCompressorNode preventing clipping across simultaneous SFX + Greek-metal stems
 * - Automatic SimEvent -> Hades combat foley dispatch & adaptive biome/combat/boss music tracking
 */

import {
  DEFAULT_RENDER_SETTINGS,
  type BiomeId,
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
  private desiredMuffled = false;

  private seenZeroBasedCombo = false;
  private prevTick = -1;
  private prevRoomIndex = -1;
  private prevCastAmmo = -1;
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
   * Translate authoritative 60Hz SimEvents into tactile Hades combat foley & Patron stingers.
   */
  handleSimEvents(events: readonly SimEvent[]): void {
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
          const normalizedStep = this.seenZeroBasedCombo ? ev.comboStep + 1 : ev.comboStep;
          const swingId: SfxId =
            normalizedStep <= 1
              ? 'sword_swing_1'
              : normalizedStep === 2
                ? 'sword_swing_2'
                : 'sword_swing_3';
          this.sfx.play(swingId, {
            weaponId: ev.weaponId,
            isDashStrike: ev.isDashStrike,
          });
          break;
        }

        case 'special_cast': {
          this.sfx.play('sword_nova', { weaponId: ev.weaponId });
          break;
        }

        case 'bloodstone_fired': {
          this.sfx.play('cast_fire', { patronId: ev.patronId });
          break;
        }

        case 'dash': {
          this.sfx.play(ev.perfect ? 'dash_perfect' : 'dash', {
            patronId: ev.patronId,
          });
          break;
        }

        case 'damage': {
          if (ev.targetKind === 'player') {
            this.sfx.play('player_hit');
          } else {
            if (ev.armorBroken) {
              this.sfx.play('armor_break');
            }
            if (ev.wallSlam) {
              this.sfx.play('wall_slam');
            }
            if (ev.crit) {
              this.sfx.play('hit_crit');
            } else if (ev.backstab) {
              this.sfx.play('hit_backstab');
            } else if (ev.amount >= 40) {
              this.sfx.play('hit_heavy');
            } else {
              this.sfx.play('hit_light');
            }
          }
          break;
        }

        case 'deflect': {
          this.sfx.play('deflect');
          break;
        }

        case 'enemy_spawn': {
          this.sfx.play('enemy_spawn', { isBoss: ev.isBoss });
          break;
        }

        case 'enemy_death': {
          if (ev.finalInRoom || ev.isBoss) {
            this.sfx.play('final_kill_boom');
            this.music?.duck(0.32, 0.85);
          } else {
            this.sfx.play('enemy_death');
          }
          break;
        }

        case 'boss_phase': {
          this.sfx.play('boss_phase');
          this.music?.duck(0.55, 0.55);
          break;
        }

        case 'status_triggered': {
          this.sfx.play('status_proc', { statusId: ev.statusId });
          break;
        }

        case 'pickup_collected': {
          const lower = ev.label.toLowerCase();
          if (lower.includes('bloodstone') || lower.includes('cast')) {
            this.sfx.play('cast_pickup');
          } else {
            this.sfx.play('pickup_collect', { patronId: ev.patronId });
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
          this.sfx.play('god_call', {
            patronId: ev.patronId,
            greater: ev.greater,
          });
          if (ev.greater) {
            this.music?.duck(0.45, 0.9);
          }
          break;
        }

        case 'death_defiance': {
          this.sfx.play('death_defiance');
          this.music?.duck(0.25, 1.05);
          break;
        }

        case 'room_cleared': {
          this.sfx.play('door_unlock');
          break;
        }

        case 'room_entered': {
          this.sfx.play('room_enter');
          break;
        }

        case 'run_ended': {
          this.desiredTrack = ev.victory ? 'victory_fanfare' : 'death_stinger';
          this.desiredIntensity = 'hub';
          this.music?.setState(this.desiredTrack, this.desiredIntensity);
          break;
        }

        case 'status_applied':
        case 'hitstop':
        case 'camera_shake':
        case 'rumble':
        case 'ui_toast':
          break;
      }
    }
  }

  /**
   * Synchronize adaptive soundtrack (hub / explore / combat / boss + biome track)
   * and detect Bloodstone ammo pickups cleanly from simulation state.
   */
  updateMusic(state: SimState, screen: ScreenId): void {
    if (this.disposed) return;

    // Detect Bloodstone pickup cleanly without requiring a custom SimEvent
    if (
      this.prevTick >= 0 &&
      state.tick > this.prevTick &&
      state.room.roomIndex === this.prevRoomIndex &&
      this.prevCastAmmo >= 0 &&
      state.player.castAmmo > this.prevCastAmmo &&
      screen === 'playing'
    ) {
      if (this.sfx && this.ctx && this.ctx.state === 'running' && !this.settings.muted) {
        this.sfx.play('cast_pickup');
      }
    }
    this.prevTick = state.tick;
    this.prevRoomIndex = state.room.roomIndex;
    this.prevCastAmmo = state.player.castAmmo;

    const { track, intensity, muffled } = this.resolveMusicTarget(state, screen);
    this.desiredTrack = track;
    this.desiredIntensity = intensity;
    this.desiredMuffled = muffled;

    if (this.music && this.ctx && this.ctx.state === 'running') {
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
   * Play crisp obsidian-and-bronze UI feedback sounds.
   */
  playUiSound(kind: 'click' | 'hover' | 'confirm' | 'back'): void {
    if (this.disposed || !this.sfx || !this.ctx || this.ctx.state !== 'running') return;
    if (this.settings.muted || this.settings.masterVolume <= 0.001 || this.settings.sfxVolume <= 0.001) {
      return;
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
  // Internals
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
    this.music.setState(this.desiredTrack, this.desiredIntensity);
    this.music.setMenuMuffled(this.desiredMuffled);
    this.music.start();
  }

  private resolveMusicTarget(
    state: SimState,
    screen: ScreenId
  ): { track: MusicTrackId; intensity: MusicIntensity; muffled: boolean } {
    const muffled =
      state.run.paused ||
      screen === 'pause' ||
      screen === 'options' ||
      screen === 'boon_select' ||
      screen === 'weapon_menu' ||
      screen === 'mirror_menu' ||
      screen === 'shrine_menu' ||
      screen === 'keepsake_menu' ||
      screen === 'shop_menu' ||
      screen === 'codex_menu';

    if (screen === 'victory' || state.run.victory) {
      return { track: 'victory_fanfare', intensity: 'hub', muffled: false };
    }
    if (screen === 'death' || state.run.defeat) {
      return { track: 'death_stinger', intensity: 'hub', muffled: false };
    }
    if (
      screen === 'title' ||
      screen === 'hub' ||
      state.run.inHub ||
      state.room.biome === 'sanctum_hub'
    ) {
      return { track: 'hub_sanctum', intensity: 'hub', muffled };
    }

    let hasLiveBoss = false;
    let hasSovereign = false;
    let hasLiveHostile = false;
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.hp <= 0 || e.aiState === 'dead') continue;
      if (e.archetype === 'rattlebones_dummy') continue;
      hasLiveHostile = true;
      if (e.isBoss) {
        hasLiveBoss = true;
        if (e.bossId === 'sovereign_lord') {
          hasSovereign = true;
        }
      }
    }

    const isBossRoom =
      state.room.encounterKind === 'boss' ||
      state.room.encounterKind === 'surface_boss' ||
      hasLiveBoss;

    if (isBossRoom && hasLiveHostile && !state.room.cleared) {
      const bossTrack: MusicTrackId =
        hasSovereign || state.room.biome === 'frozen_summit' ? 'boss_sovereign' : 'boss_warden';
      return { track: bossTrack, intensity: 'boss', muffled };
    }

    const biomeTrack = this.biomeToTrack(state.room.biome);
    if (hasLiveHostile && !state.room.cleared && state.room.combatStarted) {
      return { track: biomeTrack, intensity: 'combat', muffled };
    }

    // Cleared chamber, shop, fountain, story, or pre-combat suspense
    return { track: biomeTrack, intensity: 'explore', muffled };
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

export { getBuiltinAudioIds, MUSIC_TRACK_IDS, SFX_IDS } from './soundManifest';
export type { AudioId, MusicIntensity, MusicTrackId, SfxId } from './soundManifest';
