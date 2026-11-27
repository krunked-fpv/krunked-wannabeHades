import {
  PATRON_CONSTANTS,
  SIM_CONSTANTS,
  WEAPON_CONSTANTS,
  type BiomeId,
  type BossId,
  type DebugBridge,
  type InputSource,
  type PatronId,
  type SimState,
  type WeaponId,
} from '../contracts/index.js';
import type { HudRenderStats } from './HudOverlay.js';

export interface DebugDrawerCallbacks {
  getDebugBridge(): DebugBridge | null;
  onToggleGodMode(enabled: boolean): void;
  onResetSave(): void;
}

const PATRON_ORDER: readonly PatronId[] = [
  'voltaris',
  'tidebreaker',
  'aegira',
  'velouris',
  'sylvara',
  'bellum',
  'bacchion',
  'glaciera',
  'veloce',
  'abyssos',
];

const WEAPON_ORDER: readonly WeaponId[] = [
  'stygian_blade',
  'eternal_spear',
  'shield_of_chaos',
  'heart_seeking_bow',
  'twin_fists',
  'adamant_rail',
];

export class DebugDrawer {
  private readonly root: HTMLElement;
  private readonly callbacks: DebugDrawerCallbacks;
  private readonly telemetryEl: HTMLDivElement;
  private readonly weaponButtons = new Map<WeaponId, HTMLButtonElement>();
  private readonly godModeBtn: HTMLButtonElement;
  private readonly touchToggleBtn: HTMLButtonElement;
  private readonly gamepadSimBtn: HTMLButtonElement;

  private open = false;
  private touchOverrideOn = false;
  private gamepadSimOn = false;
  private latestState: SimState | null = null;

  constructor(uiRoot: HTMLElement, callbacks: DebugDrawerCallbacks) {
    this.callbacks = callbacks;

    this.root = document.createElement('aside');
    this.root.className = 'kh-debug-drawer kh-hidden';
    this.root.setAttribute('data-debug-drawer', 'true');

    // Header
    const head = document.createElement('div');
    head.className = 'kh-debug-head';
    const title = document.createElement('h3');
    title.className = 'kh-debug-title';
    title.textContent = 'PLAYTEST DRAWER [F9]';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'kh-debug-btn';
    closeBtn.style.minHeight = '30px';
    closeBtn.textContent = 'CLOSE';
    closeBtn.addEventListener('click', () => this.setOpen(false));
    head.append(title, closeBtn);

    // Live Telemetry Grid
    this.telemetryEl = document.createElement('div');
    this.telemetryEl.className = 'kh-debug-telemetry';

    // 1. Warp Section
    const warpTitle = this.makeSectionTitle('Warp Biomes & Bosses');
    const warpGrid = document.createElement('div');
    warpGrid.className = 'kh-debug-btn-grid';
    const warpTargets: { label: string; run: (b: DebugBridge) => void }[] = [
      { label: 'Courtyard', run: (b) => b.warpBiome('sanctum_hub' as BiomeId, 0) },
      { label: 'Obsidian Pit', run: (b) => b.warpBiome('obsidian_pit' as BiomeId, 1) },
      { label: 'Warden Malice', run: (b) => b.warpBoss('warden_malice' as BossId) },
      { label: 'Cinder Mire', run: (b) => b.warpBiome('cinder_mire' as BiomeId, 1) },
      { label: 'Verdant Colosseum', run: (b) => b.warpBiome('verdant_colosseum' as BiomeId, 1) },
      { label: 'Crypt of Bile', run: (b) => b.warpBiome('crypt_of_bile' as BiomeId, 1) },
      { label: 'Sovereign Lord', run: (b) => b.warpBoss('sovereign_lord' as BossId) },
    ];
    for (const target of warpTargets) {
      warpGrid.appendChild(
        this.makeActionBtn(target.label, () => {
          const bridge = this.callbacks.getDebugBridge();
          if (bridge) {
            target.run(bridge);
          }
        })
      );
    }

    // 2. Grant Patron Boons
    const boonTitle = this.makeSectionTitle('Grant Patron Boon');
    const boonGrid = document.createElement('div');
    boonGrid.className = 'kh-debug-btn-grid';
    for (const patronId of PATRON_ORDER) {
      const def = PATRON_CONSTANTS[patronId];
      const btn = this.makeActionBtn(def.displayName, () => {
        this.callbacks.getDebugBridge()?.giveBoon(patronId);
      });
      const dot = document.createElement('span');
      dot.className = 'kh-boon-dot';
      dot.style.background = def.colorHex;
      btn.prepend(dot);
      boonGrid.appendChild(btn);
    }
    boonGrid.appendChild(
      this.makeActionBtn('Grant Hammer', () => {
        this.callbacks.getDebugBridge()?.giveHammer();
      })
    );

    // 3. Weapon Switcher
    const weaponTitle = this.makeSectionTitle('Weapon Switcher');
    const weaponGrid = document.createElement('div');
    weaponGrid.className = 'kh-debug-btn-grid';
    for (const weaponId of WEAPON_ORDER) {
      const def = WEAPON_CONSTANTS[weaponId];
      const btn = this.makeActionBtn(def.displayName, () => {
        this.callbacks.getDebugBridge()?.setWeapon(weaponId);
      });
      this.weaponButtons.set(weaponId, btn);
      weaponGrid.appendChild(btn);
    }

    // 4. Dev Toggles & Utilities
    const toolsTitle = this.makeSectionTitle('Combat & Input Tools');
    const toolsGrid = document.createElement('div');
    toolsGrid.className = 'kh-debug-btn-grid';

    this.godModeBtn = this.makeActionBtn('God Mode: OFF', () => {
      const next = !(this.latestState?.meta.godModeEnabled || this.latestState?.run.godModeEnabled);
      this.callbacks.getDebugBridge()?.setGodMode(next);
      this.callbacks.onToggleGodMode(next);
    });

    this.touchToggleBtn = this.makeActionBtn('Touch Mode: AUTO', () => {
      this.touchOverrideOn = !this.touchOverrideOn;
      this.callbacks.getDebugBridge()?.triggerTouchMode(this.touchOverrideOn);
      this.touchToggleBtn.classList.toggle('kh-active', this.touchOverrideOn);
      this.touchToggleBtn.textContent = this.touchOverrideOn ? 'Touch Mode: ON' : 'Touch Mode: AUTO';
    });

    this.gamepadSimBtn = this.makeActionBtn('Sim Gamepad: OFF', () => {
      this.gamepadSimOn = !this.gamepadSimOn;
      if (this.gamepadSimOn) {
        this.callbacks.getDebugBridge()?.simulateGamepad({
          connected: true,
          moveX: 0.75,
          moveY: 0,
          attack: true,
          attackPressed: true,
        });
      } else {
        this.callbacks.getDebugBridge()?.simulateGamepad({ connected: false });
      }
      this.gamepadSimBtn.classList.toggle('kh-active', this.gamepadSimOn);
      this.gamepadSimBtn.textContent = this.gamepadSimOn ? 'Sim Gamepad: ON' : 'Sim Gamepad: OFF';
    });

    const killAllBtn = this.makeActionBtn('Kill All Foes', () => {
      this.callbacks.getDebugBridge()?.killAllEnemies?.();
    });

    const healBtn = this.makeActionBtn('Heal Full', () => {
      const maxHp = this.latestState?.player.maxHp ?? 100;
      this.callbacks.getDebugBridge()?.healPlayer?.(maxHp);
    });

    const resetBtn = this.makeActionBtn('Reset Save', () => {
      this.callbacks.getDebugBridge()?.resetSave();
      this.callbacks.onResetSave();
    });

    toolsGrid.append(this.godModeBtn, this.touchToggleBtn, this.gamepadSimBtn, killAllBtn, healBtn, resetBtn);

    this.root.append(
      head,
      this.telemetryEl,
      warpTitle,
      warpGrid,
      boonTitle,
      boonGrid,
      weaponTitle,
      weaponGrid,
      toolsTitle,
      toolsGrid
    );
    uiRoot.appendChild(this.root);
  }

  public isOpen(): boolean {
    return this.open;
  }

  public setOpen(open: boolean): void {
    this.open = open;
    this.root.classList.toggle('kh-hidden', !open);
  }

  public toggle(): void {
    this.setOpen(!this.open);
  }

  public update(
    state: SimState,
    activeSource: InputSource,
    renderStats: HudRenderStats,
    hash: string
  ): void {
    this.latestState = state;
    if (!this.open) {
      return;
    }

    const livingEnemies = state.enemies.filter((e) => e.aiState !== 'dead' && e.hp > 0).length;
    const shortHash = hash.length > 10 ? hash.slice(0, 10) : hash;

    this.telemetryEl.innerHTML = '';
    const rows: [string, string][] = [
      ['FPS', `${Math.round(renderStats.fps)} / ${state.meta.settings.targetFps}`],
      ['Backend', renderStats.backend],
      ['SimHz', `${SIM_CONSTANTS.simHz}Hz`],
      ['Tick', String(state.tick)],
      ['Hash', shortHash || 'n/a'],
      ['Enemies', String(livingEnemies)],
      ['Draws', `${renderStats.drawCalls} | P:${renderStats.particleCount}`],
      ['Input', activeSource.toUpperCase()],
    ];
    for (const [k, v] of rows) {
      const cell = document.createElement('div');
      cell.textContent = `${k}: ${v}`;
      if (k === 'Hash') {
        cell.title = hash;
      }
      this.telemetryEl.appendChild(cell);
    }

    // Highlight active weapon
    for (const [weaponId, btn] of this.weaponButtons.entries()) {
      btn.classList.toggle('kh-active', state.player.weaponId === weaponId);
    }

    // Sync God Mode button label
    const godOn = state.meta.godModeEnabled || state.run.godModeEnabled;
    this.godModeBtn.classList.toggle('kh-active', godOn);
    const godLabel = godOn ? 'God Mode: ON' : 'God Mode: OFF';
    if (this.godModeBtn.textContent !== godLabel) {
      this.godModeBtn.textContent = godLabel;
    }
  }

  public dispose(): void {
    this.root.remove();
  }

  private makeSectionTitle(text: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'kh-debug-section-title';
    el.textContent = text;
    return el;
  }

  private makeActionBtn(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kh-debug-btn';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }
}
