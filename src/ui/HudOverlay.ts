import {
  BIOME_CONSTANTS,
  BOSS_CONSTANTS,
  PATRON_CONSTANTS,
  PLAYER_CONSTANTS,
  WEAPON_CONSTANTS,
  type BoonInstance,
  type EnemyState,
  type InputSource,
  type ScreenId,
  type SimEvent,
  type SimState,
  type WeaponId,
} from '../contracts/index.js';
import {
  getPaintedPatronSigilUrl,
  getPaintedWeaponIconUrl,
} from '../assets/PaintedArtLoader.js';
import {
  svgBloodstoneSocket,
  svgBossCrownOrnament,
  svgDarknessFlame,
  svgDashWing,
  svgDeathDefianceSkull,
  svgHeatFlame,
  svgObolCoin,
  svgPatronSigil,
  svgWeaponSilhouette,
  svgWingedHpFrame,
} from './svgArt.js';

export interface HudRenderStats {
  backend: string;
  fps: number;
  drawCalls: number;
  particleCount: number;
}

const SLOT_SHORT_LABEL: Record<string, string> = {
  attack: 'ATK',
  special: 'SPC',
  cast: 'CST',
  dash: 'DSH',
  call: 'CAL',
  passive: 'PSV',
  duo: 'DUO',
  legendary: 'LEG',
  chaos: 'VOD',
};

const RARITY_COLOR: Record<string, string> = {
  common: '#b8ada0',
  rare: '#3ea4ff',
  epic: '#b25cff',
  heroic: '#ff465a',
  duo: '#c9f238',
  legendary: '#ffae24',
};

interface ActiveToast {
  el: HTMLDivElement;
  expiresAt: number;
}

interface BossCardRefs {
  card: HTMLDivElement;
  nameEl: HTMLSpanElement;
  subtitleEl: HTMLSpanElement | null;
  phaseBadge: HTMLSpanElement;
  armorTrack: HTMLDivElement;
  armorFill: HTMLDivElement;
  hpTrack: HTMLDivElement;
  hpGhost: HTMLDivElement;
  hpFill: HTMLDivElement;
  hpInvuln: HTMLDivElement;
  hpPill: HTMLSpanElement;
  lastHpPct: number;
  ghostPct: number;
  ghostHoldUntil: number;
}

export function findNearestInteractableLabel(state: SimState): string | null {
  const px = state.player.pos.x;
  const py = state.player.pos.y;
  let bestDistSq = Number.POSITIVE_INFINITY;
  let bestLabel: string | null = null;

  for (const pickup of state.room.pickups) {
    if (pickup.collected) {
      continue;
    }
    const maxDist = Math.max(pickup.radius + 95, 130);
    const dx = pickup.pos.x - px;
    const dy = pickup.pos.y - py;
    const dSq = dx * dx + dy * dy;
    if (dSq <= maxDist * maxDist && dSq < bestDistSq) {
      bestDistSq = dSq;
      if (pickup.costGold > 0) {
        bestLabel = `Buy ${pickup.label} (${pickup.costGold} Gold)`;
      } else if (pickup.kind === 'boon' && pickup.patronId) {
        bestLabel = `Claim ${PATRON_CONSTANTS[pickup.patronId].displayName} Boon`;
      } else {
        bestLabel = `Claim ${pickup.label}`;
      }
    }
  }

  for (const door of state.room.doors) {
    if (door.locked) {
      continue;
    }
    const maxDist = 148;
    const dx = door.pos.x - px;
    const dy = door.pos.y - py;
    const dSq = dx * dx + dy * dy;
    if (dSq <= maxDist * maxDist && dSq < bestDistSq) {
      bestDistSq = dSq;
      if (door.isChaosGate) {
        const hpCost = door.chaosHpCost ?? 20;
        bestLabel = `Enter Void Gate (-${hpCost} HP)`;
      } else if (door.targetBiome && door.targetBiome !== state.room.biome) {
        bestLabel = `Descend to ${BIOME_CONSTANTS[door.targetBiome].displayName}`;
      } else {
        bestLabel = `Enter Chamber — ${door.reward.label}`;
      }
    }
  }

  return bestLabel;
}

function formatGodModeDr(deaths: number): number {
  const clamped = Math.min(PLAYER_CONSTANTS.godModeMaxDeaths, Math.max(0, deaths));
  const mult = PLAYER_CONSTANTS.godModeBaseMultiplier - clamped * PLAYER_CONSTANTS.godModePerDeathStep;
  return Math.round((1 - mult) * 100);
}

export class HudOverlay {
  private readonly root: HTMLDivElement;

  // Top-center boss stack
  private readonly bossStack: HTMLDivElement;
  private readonly bossCards = new Map<string, BossCardRefs>();
  private lastBossOrderKey = '';

  // Top-right chamber + currency + fps
  private readonly topRight: HTMLDivElement;
  private readonly chamberPill: HTMLDivElement;
  private readonly biomeEl: HTMLSpanElement;
  private readonly depthEl: HTMLSpanElement;
  private readonly heatEl: HTMLSpanElement;
  private readonly goldValEl: HTMLSpanElement;
  private readonly darknessValEl: HTMLSpanElement;
  private readonly fpsChip: HTMLDivElement;

  // Bottom-left hero panel
  private readonly boonStrip: HTMLDivElement;
  private readonly weaponIconEl: HTMLSpanElement;
  private readonly weaponTagEl: HTMLSpanElement;
  private readonly godModeBadgeEl: HTMLSpanElement;
  private readonly ddRowEl: HTMLDivElement;
  private readonly hpTrackEl: HTMLDivElement;
  private readonly hpGhostEl: HTMLDivElement;
  private readonly hpFillEl: HTMLDivElement;
  private readonly hpTextMainEl: HTMLSpanElement;
  private readonly hpArmorEl: HTMLSpanElement;
  private readonly bloodstoneGroupEl: HTMLDivElement;
  private readonly dashGroupEl: HTMLDivElement;
  private readonly railAmmoEl: HTMLSpanElement;
  private readonly godGaugeWrapEl: HTMLDivElement;
  private readonly godGaugeStatusEl: HTMLSpanElement;
  private readonly godSegFills: HTMLDivElement[] = [];

  // Delayed hero damage-drain ghost tracking
  private lastHeroHpPct = 100;
  private heroGhostPct = 100;
  private heroGhostHoldUntil = 0;
  private lastFrameNow = 0;

  // Bottom-right dynamic prompt strip
  private readonly promptStrip: HTMLDivElement;

  // Contextual world interact banner
  private readonly interactBanner: HTMLDivElement;
  private readonly interactKeyEl: HTMLSpanElement;
  private readonly interactTextEl: HTMLSpanElement;

  // Floating event toasts
  private readonly toastContainer: HTMLDivElement;
  private activeToasts: ActiveToast[] = [];
  private lastProcessedTick = -1;

  // Hub Courtyard Quick-Dock Bar
  private readonly hubDock: HTMLElement;
  private readonly dockCodexKeyEl: HTMLSpanElement;
  private readonly onOpenScreen?: (screen: ScreenId) => void;
  private readonly onUiHover?: () => void;
  private isHubActive = false;

  // Dirty-checking caches for zero-churn 120fps updates
  private lastWeaponId: WeaponId | null = null;
  private lastBoonsKey = '';
  private lastDdKey = '';
  private lastBloodstoneKey = '';
  private lastDashKey = '';
  private lastPromptKey = '';

  private readonly onHubKeyDown = (ev: KeyboardEvent): void => {
    if (!this.isHubActive || !this.onOpenScreen) {
      return;
    }
    const target = ev.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
    ) {
      return;
    }
    if (ev.code === 'Digit1' || ev.code === 'Numpad1') {
      ev.preventDefault();
      this.onOpenScreen('weapon_menu');
    } else if (ev.code === 'Digit2' || ev.code === 'Numpad2') {
      ev.preventDefault();
      this.onOpenScreen('mirror_menu');
    } else if (ev.code === 'Digit3' || ev.code === 'Numpad3') {
      ev.preventDefault();
      this.onOpenScreen('shrine_menu');
    } else if (ev.code === 'Digit4' || ev.code === 'Numpad4') {
      ev.preventDefault();
      this.onOpenScreen('keepsake_menu');
    }
  };

  constructor(
    uiRoot: HTMLElement,
    onOpenScreen?: (screen: ScreenId) => void,
    onUiHover?: () => void
  ) {
    this.onOpenScreen = onOpenScreen;
    this.onUiHover = onUiHover;
    this.root = document.createElement('div');
    this.root.className = 'kh-hud kh-hidden';
    this.root.setAttribute('data-hud-root', 'true');

    // Top-center Boss Stack
    this.bossStack = document.createElement('div');
    this.bossStack.className = 'kh-boss-stack kh-hidden';

    // Top-right Chamber / Biome / Gold / Darkness / FPS
    this.topRight = document.createElement('div');
    this.topRight.className = 'kh-hud-topright';

    this.chamberPill = document.createElement('div');
    this.chamberPill.className = 'kh-chamber-pill';
    this.biomeEl = document.createElement('span');
    this.biomeEl.className = 'kh-biome-name';
    this.depthEl = document.createElement('span');
    this.depthEl.className = 'kh-chamber-depth';
    this.heatEl = document.createElement('span');
    this.heatEl.className = 'kh-heat-pill kh-hidden';
    this.chamberPill.append(this.biomeEl, this.depthEl, this.heatEl);

    const currencyRow = document.createElement('div');
    currencyRow.className = 'kh-currency-row';

    const goldChip = document.createElement('div');
    goldChip.className = 'kh-currency-chip kh-currency-gold';
    goldChip.innerHTML = svgObolCoin();
    this.goldValEl = document.createElement('span');
    this.goldValEl.className = 'kh-currency-num';
    this.goldValEl.textContent = '0';
    goldChip.appendChild(this.goldValEl);

    const darknessChip = document.createElement('div');
    darknessChip.className = 'kh-currency-chip kh-currency-darkness';
    darknessChip.innerHTML = svgDarknessFlame();
    this.darknessValEl = document.createElement('span');
    this.darknessValEl.className = 'kh-currency-num';
    this.darknessValEl.textContent = '0';
    darknessChip.appendChild(this.darknessValEl);

    this.fpsChip = document.createElement('div');
    this.fpsChip.className = 'kh-currency-chip kh-currency-fps kh-hidden';

    currencyRow.append(goldChip, darknessChip, this.fpsChip);
    this.topRight.append(this.chamberPill, currencyRow);

    // Bottom-left Sculpted Filigree Hero HUD
    const bottomLeft = document.createElement('div');
    bottomLeft.className = 'kh-hud-bottomleft';

    this.boonStrip = document.createElement('div');
    this.boonStrip.className = 'kh-boon-strip';

    const heroFrame = document.createElement('div');
    heroFrame.className = 'kh-hero-frame';

    const topRow = document.createElement('div');
    topRow.className = 'kh-hero-top-row';

    const weaponGroup = document.createElement('div');
    weaponGroup.className = 'kh-hero-weapon-group';
    this.weaponIconEl = document.createElement('span');
    this.weaponIconEl.className = 'kh-weapon-icon';
    this.weaponIconEl.setAttribute('aria-hidden', 'true');
    this.weaponTagEl = document.createElement('span');
    this.weaponTagEl.className = 'kh-weapon-tag';
    weaponGroup.append(this.weaponIconEl, this.weaponTagEl);

    const rightMeta = document.createElement('div');
    rightMeta.className = 'kh-hero-right-meta';
    this.godModeBadgeEl = document.createElement('span');
    this.godModeBadgeEl.className = 'kh-godmode-badge kh-hidden';
    this.ddRowEl = document.createElement('div');
    this.ddRowEl.className = 'kh-dd-row';
    rightMeta.append(this.godModeBadgeEl, this.ddRowEl);
    topRow.append(weaponGroup, rightMeta);

    // Winged Bronze-Filigree HP Bar with Delayed Damage-Drain Ghost Bar
    const hpRow = document.createElement('div');
    hpRow.className = 'kh-hp-winged-row';
    const leftWing = document.createElement('span');
    leftWing.className = 'kh-hp-wing kh-hp-wing-left';
    leftWing.innerHTML = svgWingedHpFrame('left');
    const rightWing = document.createElement('span');
    rightWing.className = 'kh-hp-wing kh-hp-wing-right';
    rightWing.innerHTML = svgWingedHpFrame('right');

    this.hpTrackEl = document.createElement('div');
    this.hpTrackEl.className = 'kh-hp-track';
    this.hpGhostEl = document.createElement('div');
    this.hpGhostEl.className = 'kh-hp-ghost';
    this.hpGhostEl.style.width = '100%';
    this.hpFillEl = document.createElement('div');
    this.hpFillEl.className = 'kh-hp-fill';
    const hpText = document.createElement('div');
    hpText.className = 'kh-hp-text';
    this.hpTextMainEl = document.createElement('span');
    this.hpArmorEl = document.createElement('span');
    this.hpArmorEl.className = 'kh-hp-armor-val';
    hpText.append(this.hpTextMainEl, this.hpArmorEl);
    this.hpTrackEl.append(this.hpGhostEl, this.hpFillEl, hpText);
    hpRow.append(leftWing, this.hpTrackEl, rightWing);

    // Sub-row: Jeweled Bloodstone Sockets, Swept Bronze Dash Wings, Rail Ammo
    const resourcesRow = document.createElement('div');
    resourcesRow.className = 'kh-resources-row';
    this.bloodstoneGroupEl = document.createElement('div');
    this.bloodstoneGroupEl.className = 'kh-pip-group';
    this.dashGroupEl = document.createElement('div');
    this.dashGroupEl.className = 'kh-pip-group';
    this.railAmmoEl = document.createElement('span');
    this.railAmmoEl.className = 'kh-rail-ammo kh-hidden';
    resourcesRow.append(this.bloodstoneGroupEl, this.dashGroupEl, this.railAmmoEl);

    // 4-Segment Gilded Patron Call Gauge
    this.godGaugeWrapEl = document.createElement('div');
    this.godGaugeWrapEl.className = 'kh-god-gauge-wrap';
    const gaugeHead = document.createElement('div');
    gaugeHead.className = 'kh-god-gauge-header';
    const gaugeTitle = document.createElement('span');
    gaugeTitle.textContent = 'Patron Call';
    this.godGaugeStatusEl = document.createElement('span');
    this.godGaugeStatusEl.className = 'kh-god-gauge-status';
    gaugeHead.append(gaugeTitle, this.godGaugeStatusEl);
    const segRow = document.createElement('div');
    segRow.className = 'kh-god-gauge-segments';
    for (let i = 0; i < 4; i++) {
      const seg = document.createElement('div');
      seg.className = 'kh-god-seg';
      const fill = document.createElement('div');
      fill.className = 'kh-god-seg-fill';
      seg.appendChild(fill);
      segRow.appendChild(seg);
      this.godSegFills.push(fill);
    }
    this.godGaugeWrapEl.append(gaugeHead, segRow);

    heroFrame.append(topRow, hpRow, resourcesRow, this.godGaugeWrapEl);
    bottomLeft.append(this.boonStrip, heroFrame);

    // Bottom-right dynamic prompt strip
    this.promptStrip = document.createElement('div');
    this.promptStrip.className = 'kh-hud-prompts';

    // Contextual World Interact Banner
    this.interactBanner = document.createElement('div');
    this.interactBanner.className = 'kh-interact-banner kh-hidden';
    this.interactKeyEl = document.createElement('span');
    this.interactTextEl = document.createElement('span');
    this.interactBanner.append(this.interactKeyEl, this.interactTextEl);

    // Toast container
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'kh-toast-container';

    // Hub Courtyard Quick-Dock Bar (Weapons / Mirror / Shrine / Keepsakes / Codex)
    this.hubDock = document.createElement('nav');
    this.hubDock.className = 'kh-hub-dock kh-hidden';
    this.hubDock.setAttribute('aria-label', 'Courtyard Sanctum Stations');
    this.hubDock.setAttribute('data-hub-dock', 'true');

    const dockItems: { screen: ScreenId; label: string; hotkey: string }[] = [
      { screen: 'weapon_menu', label: 'ARMS', hotkey: '1' },
      { screen: 'mirror_menu', label: 'MIRROR', hotkey: '2' },
      { screen: 'shrine_menu', label: 'SHRINE', hotkey: '3' },
      { screen: 'keepsake_menu', label: 'KEEPSAKES', hotkey: '4' },
      { screen: 'codex_menu', label: 'CODEX', hotkey: 'TAB' },
    ];

    let codexKeySpan: HTMLSpanElement | null = null;
    for (const item of dockItems) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'kh-dock-btn';
      btn.dataset.dockScreen = item.screen;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;

      const keySpan = document.createElement('span');
      keySpan.className = 'kh-dock-hotkey';
      keySpan.textContent = item.hotkey;
      if (item.screen === 'codex_menu') {
        codexKeySpan = keySpan;
      }

      btn.append(labelSpan, keySpan);
      btn.addEventListener('click', () => this.onOpenScreen?.(item.screen));
      btn.addEventListener('pointerenter', () => this.onUiHover?.());
      this.hubDock.appendChild(btn);
    }
    this.dockCodexKeyEl = codexKeySpan as HTMLSpanElement;

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onHubKeyDown);
    }

    const topCenterStack = document.createElement('div');
    topCenterStack.className = 'kh-top-center-stack';
    topCenterStack.append(this.bossStack, this.toastContainer);

    this.root.append(
      topCenterStack,
      this.hubDock,
      this.topRight,
      bottomLeft,
      this.promptStrip,
      this.interactBanner
    );
    uiRoot.appendChild(this.root);
  }

  public update(
    state: SimState,
    screen: ScreenId,
    activeSource: InputSource,
    renderStats: HudRenderStats,
    drainedEvents?: readonly SimEvent[]
  ): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dtSec = this.lastFrameNow > 0 ? Math.min(0.1, Math.max(0, (now - this.lastFrameNow) / 1000)) : 0.016;
    this.lastFrameNow = now;

    const showHud =
      screen === 'hub' ||
      screen === 'playing' ||
      screen === 'pause' ||
      screen === 'boon_select';

    const touchActive = activeSource === 'touch';
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('kh-touch-active', touchActive && showHud);
    }

    this.root.classList.toggle('kh-hidden', !showHud);
    this.isHubActive = screen === 'hub';
    this.root.classList.toggle('kh-is-hub', this.isHubActive);
    this.hubDock.classList.toggle('kh-hidden', !this.isHubActive);
    if (this.isHubActive) {
      const codexGlyph = activeSource === 'gamepad' ? 'LB' : 'TAB';
      if (this.dockCodexKeyEl.textContent !== codexGlyph) {
        this.dockCodexKeyEl.textContent = codexGlyph;
      }
    }

    if (!showHud) {
      return;
    }

    const inLiveGameplay = screen === 'hub' || screen === 'playing';
    const player = state.player;
    const room = state.room;
    const biome = BIOME_CONSTANTS[room.biome];

    // Relocate Hero HUD + Boons to top-left & shift top-right away from pause pill when touch is active
    this.root.classList.toggle('kh-touch-active', touchActive);
    this.topRight.classList.toggle('kh-touch-offset', touchActive);

    // Top-right Biome & Chamber Depth
    this.biomeEl.textContent = biome.displayName;
    this.biomeEl.style.color = biome.accentHex;
    this.chamberPill.style.borderRightColor = biome.accentHex;
    const depthLabel =
      room.biome === 'sanctum_hub'
        ? 'COURTYARD'
        : `CHAMBER ${String(room.depth).padStart(2, '0')}`;
    if (this.depthEl.textContent !== depthLabel) {
      this.depthEl.textContent = depthLabel;
    }

    if (state.run.heat > 0) {
      this.heatEl.classList.remove('kh-hidden');
      const heatText =
        state.run.tightDeadlineTimer !== null
          ? `HEAT ${state.run.heat} · ${this.formatTimer(state.run.tightDeadlineTimer)}`
          : `HEAT ${state.run.heat}`;
      if (this.heatEl.dataset.heatText !== heatText) {
        this.heatEl.dataset.heatText = heatText;
        this.heatEl.innerHTML = `${svgHeatFlame()}<span>${heatText}</span>`;
      }
    } else {
      this.heatEl.classList.add('kh-hidden');
    }

    // Currencies & FPS
    const goldStr = String(Math.floor(player.gold));
    if (this.goldValEl.textContent !== goldStr) {
      this.goldValEl.textContent = goldStr;
    }
    const darkStr = String(Math.floor(state.meta.darkness));
    if (this.darknessValEl.textContent !== darkStr) {
      this.darknessValEl.textContent = darkStr;
    }

    const showFps = state.meta.settings.showFps;
    this.fpsChip.classList.toggle('kh-hidden', !showFps);
    if (showFps) {
      const fpsText = `${Math.round(renderStats.fps)} FPS · ${renderStats.backend}`;
      if (this.fpsChip.textContent !== fpsText) {
        this.fpsChip.textContent = fpsText;
      }
    }

    // Hero Weapon Painted Icon (w/ SVG Fallback) + Name + God Mode + Death Defiances
    if (this.lastWeaponId !== player.weaponId) {
      this.lastWeaponId = player.weaponId;
      this.weaponIconEl.innerHTML = '';
      const wImg = document.createElement('img');
      wImg.className = 'kh-hud-weapon-img';
      wImg.alt = '';
      wImg.src = getPaintedWeaponIconUrl(player.weaponId);
      const fallbackWeaponId = player.weaponId;
      wImg.addEventListener('error', () => {
        this.weaponIconEl.innerHTML = svgWeaponSilhouette(fallbackWeaponId, 16);
      });
      this.weaponIconEl.appendChild(wImg);
      this.weaponTagEl.textContent = WEAPON_CONSTANTS[player.weaponId].displayName;
    }

    const showGod = state.run.godModeEnabled || state.meta.godModeEnabled;
    this.godModeBadgeEl.classList.toggle('kh-hidden', !showGod);
    if (showGod) {
      const godText = `GOD -${formatGodModeDr(state.meta.godModeDeaths)}%`;
      if (this.godModeBadgeEl.textContent !== godText) {
        this.godModeBadgeEl.textContent = godText;
      }
    }

    this.updateDeathDefiances(player.deathDefiances, player.maxDeathDefiances);

    // HP Bar + Delayed Damage-Drain Ghost Bar
    const maxHp = Math.max(1, Math.round(player.maxHp));
    const hp = Math.max(0, Math.ceil(player.hp));
    const hpPct = Math.max(0, Math.min(100, (player.hp / maxHp) * 100));
    if (hpPct < this.lastHeroHpPct - 0.1) {
      this.heroGhostPct = Math.max(this.heroGhostPct, this.lastHeroHpPct);
      this.heroGhostHoldUntil = now + 340;
    } else if (hpPct > this.heroGhostPct) {
      this.heroGhostPct = hpPct;
    }
    this.lastHeroHpPct = hpPct;
    if (this.heroGhostPct > hpPct && now >= this.heroGhostHoldUntil) {
      this.heroGhostPct = Math.max(hpPct, this.heroGhostPct - dtSec * 42);
    }

    this.hpFillEl.style.width = `${hpPct.toFixed(1)}%`;
    this.hpGhostEl.style.width = `${this.heroGhostPct.toFixed(1)}%`;
    this.hpTrackEl.classList.toggle('kh-hp-low', hpPct > 0 && hpPct <= 25);
    const hpStr = `${hp} / ${maxHp}`;
    if (this.hpTextMainEl.textContent !== hpStr) {
      this.hpTextMainEl.textContent = hpStr;
    }
    const armorStr = player.armor > 0 ? `+${Math.ceil(player.armor)} ARM` : '';
    if (this.hpArmorEl.textContent !== armorStr) {
      this.hpArmorEl.textContent = armorStr;
    }

    // Jeweled Bloodstone sockets, Swept Bronze Dash wings, Rail ammo
    const lodgedCount = state.enemies.reduce(
      (acc, enemy) => acc + (enemy.aiState !== 'dead' && enemy.hp > 0 ? enemy.lodgedCasts : 0),
      0
    );
    this.updateBloodstones(player.castAmmo, player.maxCastAmmo, lodgedCount);
    this.updateDashPips(player.dashCharges, player.maxDashCharges);

    const isRail = player.weaponId === 'adamant_rail';
    this.railAmmoEl.classList.toggle('kh-hidden', !isRail);
    if (isRail) {
      const ammoText =
        player.reloadTimer > 0
          ? 'RELOADING...'
          : `AMMO ${player.ammo}/${player.maxAmmo}`;
      if (this.railAmmoEl.textContent !== ammoText) {
        this.railAmmoEl.textContent = ammoText;
      }
    }

    // 4-Segment Gilded Patron Call Gauge
    this.updateGodGauge(player.godGauge, player.godCallPatron);

    // Patron Boon Medallion Rail
    this.updateBoons(player.boons);

    // Top-center Sculpted Boss Health Bars
    this.updateBossBars(state.enemies, now, dtSec);

    // Contextual World Interact Banner
    const interactLabel = inLiveGameplay ? findNearestInteractableLabel(state) : null;
    this.updateInteractBanner(interactLabel, activeSource);

    // Bottom-right dynamic prompt strip (hidden on touch)
    this.updatePromptStrip(
      activeSource,
      inLiveGameplay,
      player.godGauge >= 25,
      isRail,
      interactLabel !== null
    );

    // Mythic event toasts
    this.processToasts(state.tick, state.events, drainedEvents);
  }

  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onHubKeyDown);
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('kh-touch-active');
    }
    this.activeToasts = [];
    this.bossCards.clear();
    this.root.remove();
  }

  private updateDeathDefiances(current: number, max: number): void {
    const clampedMax = Math.max(0, Math.min(6, Math.round(max)));
    const clampedCur = Math.max(0, Math.min(clampedMax, Math.round(current)));
    const key = `${clampedCur}/${clampedMax}`;
    if (this.lastDdKey === key) {
      return;
    }
    this.lastDdKey = key;
    this.ddRowEl.innerHTML = '';
    for (let i = 0; i < clampedMax; i++) {
      const ready = i < clampedCur;
      const span = document.createElement('span');
      span.className = ready ? 'kh-dd-skull' : 'kh-dd-skull kh-spent';
      span.innerHTML = svgDeathDefianceSkull(ready);
      span.title = ready ? 'Death Defiance Ready' : 'Death Defiance Spent';
      this.ddRowEl.appendChild(span);
    }
  }

  private updateBloodstones(current: number, max: number, lodged: number): void {
    const clampedMax = Math.max(1, Math.min(8, Math.round(max)));
    const clampedCur = Math.max(0, Math.min(clampedMax, Math.round(current)));
    const clampedLodged = Math.max(0, Math.min(clampedMax - clampedCur, Math.round(lodged)));
    const key = `${clampedCur}/${clampedLodged}/${clampedMax}`;
    if (this.lastBloodstoneKey === key) {
      return;
    }
    this.lastBloodstoneKey = key;
    this.bloodstoneGroupEl.innerHTML = '';
    const lbl = document.createElement('span');
    lbl.className = 'kh-pip-label';
    lbl.textContent = 'Cast';
    this.bloodstoneGroupEl.appendChild(lbl);
    for (let i = 0; i < clampedMax; i++) {
      const state: 'ready' | 'lodged' | 'spent' =
        i < clampedCur ? 'ready' : i < clampedCur + clampedLodged ? 'lodged' : 'spent';
      const pip = document.createElement('span');
      pip.className = `kh-bloodstone-socket kh-bs-${state}`;
      pip.innerHTML = svgBloodstoneSocket(state);
      this.bloodstoneGroupEl.appendChild(pip);
    }
  }

  private updateDashPips(current: number, max: number): void {
    const clampedMax = Math.max(1, Math.min(6, Math.round(max)));
    const clampedCur = Math.max(0, Math.min(clampedMax, Math.round(current)));
    const key = `${clampedCur}/${clampedMax}`;
    if (this.lastDashKey === key) {
      return;
    }
    this.lastDashKey = key;
    this.dashGroupEl.innerHTML = '';
    const lbl = document.createElement('span');
    lbl.className = 'kh-pip-label';
    lbl.textContent = 'Dash';
    this.dashGroupEl.appendChild(lbl);
    for (let i = 0; i < clampedMax; i++) {
      const ready = i < clampedCur;
      const pip = document.createElement('span');
      pip.className = ready ? 'kh-dash-wing kh-ready' : 'kh-dash-wing kh-empty';
      pip.innerHTML = svgDashWing(ready);
      this.dashGroupEl.appendChild(pip);
    }
  }

  private updateGodGauge(gauge: number, patronId: SimState['player']['godCallPatron']): void {
    const clamped = Math.max(0, Math.min(100, gauge));
    const patronColor = patronId ? PATRON_CONSTANTS[patronId].colorHex : '#fff0b8';
    for (let i = 0; i < 4; i++) {
      const segMin = i * 25;
      const segPct = Math.max(0, Math.min(100, ((clamped - segMin) / 25) * 100));
      const fill = this.godSegFills[i];
      fill.style.width = `${segPct.toFixed(1)}%`;
      fill.style.background = `linear-gradient(90deg, #9e6e2e 0%, #e5b952 48%, ${patronColor} 100%)`;
    }

    const isMax = clamped >= 100;
    const isReady = clamped >= 25;
    this.godGaugeWrapEl.classList.toggle('kh-call-ready', isReady && !isMax);
    this.godGaugeWrapEl.classList.toggle('kh-call-max', isMax);
    this.godGaugeStatusEl.classList.toggle('kh-ready', isReady);
    const statusText = isMax
      ? 'GREATER CALL READY'
      : isReady
        ? `CALL READY (${Math.floor(clamped)}%)`
        : `${Math.floor(clamped)}%`;
    if (this.godGaugeStatusEl.textContent !== statusText) {
      this.godGaugeStatusEl.textContent = statusText;
    }
  }

  private updateBoons(boons: readonly BoonInstance[]): void {
    const key = boons.map((b) => `${b.id}:${b.level}:${b.rarity}`).join('|');
    if (this.lastBoonsKey === key) {
      return;
    }
    this.lastBoonsKey = key;
    this.boonStrip.innerHTML = '';

    const visibleLimit = 7;
    const shown = boons.slice(0, visibleLimit);
    for (const boon of shown) {
      const patron = PATRON_CONSTANTS[boon.patronId];
      const rarityColor = RARITY_COLOR[boon.rarity] ?? '#b8ada0';
      const slotCode = SLOT_SHORT_LABEL[boon.slot] ?? 'BON';

      const med = document.createElement('div');
      med.className = 'kh-boon-medallion';
      med.dataset.rarity = boon.rarity;
      med.style.setProperty('--kh-medallion-ring', rarityColor);
      med.style.setProperty('--kh-patron-color', patron.colorHex);
      med.title = `${boon.name}${boon.level > 1 ? ` (Lv.${boon.level})` : ''} · ${patron.displayName} [${boon.rarity.toUpperCase()}] — ${boon.description}`;

      const sigilWrap = document.createElement('span');
      sigilWrap.className = 'kh-boon-medallion-sigil';
      const sigImg = document.createElement('img');
      sigImg.className = 'kh-hud-sigil-img';
      sigImg.alt = '';
      sigImg.src = getPaintedPatronSigilUrl(boon.patronId);
      const fallbackPatronId = boon.patronId;
      sigImg.addEventListener('error', () => {
        sigilWrap.innerHTML = svgPatronSigil(fallbackPatronId, 17);
      });
      sigilWrap.appendChild(sigImg);

      const slotBadge = document.createElement('span');
      slotBadge.className = 'kh-boon-medallion-slot';
      slotBadge.textContent = slotCode;

      med.append(sigilWrap, slotBadge);

      if (boon.level > 1) {
        const lvlBadge = document.createElement('span');
        lvlBadge.className = 'kh-boon-medallion-lvl';
        lvlBadge.textContent = `${boon.level}`;
        med.appendChild(lvlBadge);
      }

      this.boonStrip.appendChild(med);
    }

    if (boons.length > visibleLimit) {
      const more = document.createElement('div');
      more.className = 'kh-boon-medallion kh-boon-medallion-more';
      more.textContent = `+${boons.length - visibleLimit}`;
      this.boonStrip.appendChild(more);
    }
  }

  private updateBossBars(enemies: readonly EnemyState[], now: number, dtSec: number): void {
    const bosses = enemies.filter((e) => e.isBoss && e.aiState !== 'dead' && e.hp > 0).slice(0, 2);
    this.root.classList.toggle('kh-has-boss', bosses.length > 0);
    this.root.classList.toggle('kh-has-dual-boss', bosses.length >= 2);
    if (bosses.length === 0) {
      if (this.lastBossOrderKey !== '') {
        this.lastBossOrderKey = '';
        this.bossCards.clear();
        this.bossStack.innerHTML = '';
        this.bossStack.classList.add('kh-hidden');
      }
      return;
    }

    this.bossStack.classList.remove('kh-hidden');
    const orderKey = bosses.map((b) => b.id).join('|');
    if (orderKey !== this.lastBossOrderKey) {
      this.lastBossOrderKey = orderKey;
      const activeIds = new Set(bosses.map((b) => b.id));
      for (const [id, refs] of this.bossCards.entries()) {
        if (!activeIds.has(id)) {
          refs.card.remove();
          this.bossCards.delete(id);
        }
      }
      for (const boss of bosses) {
        if (!this.bossCards.has(boss.id)) {
          const refs = this.createBossCard(boss);
          this.bossCards.set(boss.id, refs);
          this.bossStack.appendChild(refs.card);
        }
      }
    }

    for (const boss of bosses) {
      const refs = this.bossCards.get(boss.id);
      if (!refs) continue;

      const phaseText =
        boss.maxPhases > 1 ? `PHASE ${boss.phase} / ${boss.maxPhases}` : `${Math.ceil(boss.hp)} HP`;
      if (refs.phaseBadge.textContent !== phaseText) {
        refs.phaseBadge.textContent = phaseText;
      }

      // Golden Armor Bar
      const hasArmor = boss.maxArmor > 0 && boss.armor > 0;
      refs.armorTrack.classList.toggle('kh-hidden', !hasArmor);
      if (hasArmor) {
        const armorPct = Math.max(0, Math.min(100, (boss.armor / boss.maxArmor) * 100));
        refs.armorFill.style.width = `${armorPct.toFixed(1)}%`;
      }

      // Beveled Crimson Boss HP Bar + Delayed Ghost Drain Trail + Invulnerable Shimmer
      const hpPct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100));
      if (hpPct < refs.lastHpPct - 0.1) {
        refs.ghostPct = Math.max(refs.ghostPct, refs.lastHpPct);
        refs.ghostHoldUntil = now + 350;
      } else if (hpPct > refs.ghostPct) {
        refs.ghostPct = hpPct;
      }
      refs.lastHpPct = hpPct;
      if (refs.ghostPct > hpPct && now >= refs.ghostHoldUntil) {
        refs.ghostPct = Math.max(hpPct, refs.ghostPct - dtSec * 36);
      }

      refs.hpFill.style.width = `${hpPct.toFixed(1)}%`;
      refs.hpGhost.style.width = `${refs.ghostPct.toFixed(1)}%`;

      const isInvuln = boss.invulnerable || boss.invulnTimer > 0;
      refs.card.classList.toggle('kh-boss-invulnerable', isInvuln);
      refs.hpInvuln.classList.toggle('kh-hidden', !isInvuln);

      const hpLabel = isInvuln
        ? `SHIELDED · ${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`
        : `${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`;
      if (refs.hpPill.textContent !== hpLabel) {
        refs.hpPill.textContent = hpLabel;
      }
    }
  }

  private createBossCard(boss: EnemyState): BossCardRefs {
    const def = boss.bossId ? BOSS_CONSTANTS[boss.bossId] : undefined;
    const card = document.createElement('div');
    card.className = 'kh-boss-bar-card';

    const leftCrown = document.createElement('span');
    leftCrown.className = 'kh-boss-crown kh-boss-crown-left';
    leftCrown.innerHTML = svgBossCrownOrnament('left');

    const rightCrown = document.createElement('span');
    rightCrown.className = 'kh-boss-crown kh-boss-crown-right';
    rightCrown.innerHTML = svgBossCrownOrnament('right');

    const inner = document.createElement('div');
    inner.className = 'kh-boss-card-inner';

    const head = document.createElement('div');
    head.className = 'kh-boss-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'kh-boss-title-group';
    const nameEl = document.createElement('span');
    nameEl.className = 'kh-boss-name';
    nameEl.textContent = def?.displayName ?? boss.name;
    titleGroup.appendChild(nameEl);

    let subtitleEl: HTMLSpanElement | null = null;
    if (def?.title) {
      subtitleEl = document.createElement('span');
      subtitleEl.className = 'kh-boss-subtitle';
      subtitleEl.textContent = def.title;
      titleGroup.appendChild(subtitleEl);
    }

    const phaseBadge = document.createElement('span');
    phaseBadge.className = 'kh-boss-phase-badge';

    head.append(titleGroup, phaseBadge);
    inner.appendChild(head);

    const armorTrack = document.createElement('div');
    armorTrack.className = 'kh-boss-armor-track kh-hidden';
    const armorFill = document.createElement('div');
    armorFill.className = 'kh-boss-armor-fill';
    armorTrack.appendChild(armorFill);
    inner.appendChild(armorTrack);

    const hpTrack = document.createElement('div');
    hpTrack.className = 'kh-boss-hp-track';

    const hpGhost = document.createElement('div');
    hpGhost.className = 'kh-boss-hp-ghost';
    const initPct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100));
    hpGhost.style.width = `${initPct.toFixed(1)}%`;

    const hpFill = document.createElement('div');
    hpFill.className = 'kh-boss-hp-fill';
    hpFill.style.width = `${initPct.toFixed(1)}%`;

    const hpInvuln = document.createElement('div');
    hpInvuln.className = 'kh-boss-invuln-shimmer kh-hidden';

    hpTrack.append(hpGhost, hpFill, hpInvuln);

    const thresholds = def?.phaseThresholds ?? [];
    for (const threshold of thresholds) {
      const notch = document.createElement('div');
      notch.className = 'kh-boss-notch';
      notch.style.left = `${(threshold * 100).toFixed(1)}%`;
      hpTrack.appendChild(notch);
    }

    const hpText = document.createElement('div');
    hpText.className = 'kh-boss-hp-text';
    const hpPill = document.createElement('span');
    hpPill.className = 'kh-boss-hp-pill';
    hpText.appendChild(hpPill);
    hpTrack.appendChild(hpText);

    const trackRow = document.createElement('div');
    trackRow.className = 'kh-boss-track-row';
    trackRow.append(leftCrown, hpTrack, rightCrown);

    inner.appendChild(trackRow);
    card.appendChild(inner);

    return {
      card,
      nameEl,
      subtitleEl,
      phaseBadge,
      armorTrack,
      armorFill,
      hpTrack,
      hpGhost,
      hpFill,
      hpInvuln,
      hpPill,
      lastHpPct: initPct,
      ghostPct: initPct,
      ghostHoldUntil: 0,
    };
  }

  private updateInteractBanner(label: string | null, activeSource: InputSource): void {
    if (!label) {
      this.interactBanner.classList.add('kh-hidden');
      return;
    }
    this.interactBanner.classList.remove('kh-hidden');
    if (activeSource === 'gamepad') {
      this.interactKeyEl.className = 'kh-xbox-btn kh-xbox-bumper';
      this.interactKeyEl.textContent = 'RB';
    } else if (activeSource === 'touch') {
      this.interactKeyEl.className = 'kh-keycap';
      this.interactKeyEl.textContent = 'USE';
    } else {
      this.interactKeyEl.className = 'kh-keycap';
      this.interactKeyEl.textContent = 'E';
    }
    if (this.interactTextEl.textContent !== label) {
      this.interactTextEl.textContent = label;
    }
  }

  private updatePromptStrip(
    activeSource: InputSource,
    inLiveGameplay: boolean,
    callReady: boolean,
    isRail: boolean,
    nearInteractable: boolean
  ): void {
    if (!inLiveGameplay || activeSource === 'touch') {
      this.promptStrip.classList.add('kh-hidden');
      return;
    }
    this.promptStrip.classList.remove('kh-hidden');

    const key = `${activeSource}:${callReady ? 1 : 0}:${isRail ? 1 : 0}:${nearInteractable ? 1 : 0}`;
    if (this.lastPromptKey === key) {
      return;
    }
    this.lastPromptKey = key;
    this.promptStrip.innerHTML = '';

    const appendChip = (glyph: string, glyphClass: string, text: string, highlight = false): void => {
      const chip = document.createElement('div');
      chip.className = highlight ? 'kh-prompt-chip kh-highlight' : 'kh-prompt-chip';
      const g = document.createElement('span');
      g.className = glyphClass;
      g.textContent = glyph;
      const t = document.createElement('span');
      t.textContent = text;
      chip.append(g, t);
      this.promptStrip.appendChild(chip);
    };

    if (activeSource === 'gamepad') {
      appendChip('LS', 'kh-xbox-btn kh-xbox-bumper', 'Move');
      appendChip('X', 'kh-xbox-btn kh-xbox-x', 'Attack');
      appendChip('Y', 'kh-xbox-btn kh-xbox-y', 'Special');
      appendChip('A', 'kh-xbox-btn kh-xbox-a', 'Dash');
      appendChip('B', 'kh-xbox-btn kh-xbox-b', 'Cast');
      appendChip('RT', 'kh-xbox-btn kh-xbox-bumper', 'Call', callReady);
      if (isRail) {
        appendChip('LT', 'kh-xbox-btn kh-xbox-bumper', 'Reload');
      }
      if (nearInteractable) {
        appendChip('RB', 'kh-xbox-btn kh-xbox-bumper', 'Use', true);
      }
      appendChip('LB', 'kh-xbox-btn kh-xbox-bumper', 'Codex');
    } else {
      appendChip('WASD', 'kh-keycap', 'Move');
      appendChip('LMB', 'kh-keycap', 'Attack');
      appendChip('RMB', 'kh-keycap', 'Special');
      appendChip('SPACE', 'kh-keycap', 'Dash');
      appendChip('Q', 'kh-keycap', 'Cast');
      appendChip('F', 'kh-keycap', 'Call', callReady);
      if (isRail) {
        appendChip('R', 'kh-keycap', 'Reload');
      }
      if (nearInteractable) {
        appendChip('E', 'kh-keycap', 'Use', true);
      }
      appendChip('TAB', 'kh-keycap', 'Codex');
    }
  }

  private processToasts(
    tick: number,
    stateEvents: readonly SimEvent[],
    drainedEvents?: readonly SimEvent[]
  ): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (this.activeToasts.length > 0) {
      const remaining: ActiveToast[] = [];
      for (const toast of this.activeToasts) {
        if (now >= toast.expiresAt) {
          toast.el.remove();
        } else {
          remaining.push(toast);
        }
      }
      this.activeToasts = remaining;
    }

    let eventsToShow: readonly SimEvent[];
    if (drainedEvents && drainedEvents.length > 0) {
      eventsToShow = drainedEvents;
      this.lastProcessedTick = tick;
    } else {
      if (tick === this.lastProcessedTick) {
        return;
      }
      this.lastProcessedTick = tick;
      eventsToShow = stateEvents;
    }

    for (const ev of eventsToShow) {
      if (ev.type === 'room_entered') {
        for (const t of this.activeToasts) {
          t.el.remove();
        }
        this.activeToasts = [];
      } else if (ev.type === 'ui_toast') {
        this.pushToast(ev.text, ev.colorHex ?? '#fff0b8', now);
      } else if (ev.type === 'room_cleared') {
        this.pushToast('CHAMBER CLEARED', '#7cf5be', now);
      } else if (ev.type === 'death_defiance') {
        this.pushToast(`DEATH DEFIED (${ev.remaining} LEFT)`, '#ff7b82', now);
      } else if (ev.type === 'god_call') {
        const patron = PATRON_CONSTANTS[ev.patronId];
        this.pushToast(
          ev.greater ? `GREATER CALL: ${patron.displayName.toUpperCase()}!` : `${patron.displayName.toUpperCase()} AID!`,
          patron.colorHex,
          now
        );
      } else if (ev.type === 'boss_phase') {
        const boss = BOSS_CONSTANTS[ev.bossId];
        this.pushToast(`${boss.displayName.toUpperCase()} — PHASE ${ev.phase}`, '#ff8066', now);
      }
    }
  }

  private brightenReadableToastColor(hex: string): string {
    const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum >= 0.42) return hex;
    // Lift dark saturated Patron colors so text pops crisply over obsidian
    const lift = 0.44;
    const lr = Math.min(255, Math.round(r + (255 - r) * lift));
    const lg = Math.min(255, Math.round(g + (255 - g) * lift));
    const lb = Math.min(255, Math.round(b + (255 - b) * lift));
    return `rgb(${lr}, ${lg}, ${lb})`;
  }

  private pushToast(text: string, colorHex: string, now: number): void {
    const isCompactViewport = typeof window !== 'undefined' && window.innerHeight <= 500;
    const maxToasts = isCompactViewport || this.bossCards.size > 0 ? 1 : 2;
    while (this.activeToasts.length >= maxToasts) {
      const oldest = this.activeToasts.shift();
      oldest?.el.remove();
    }
    const el = document.createElement('div');
    el.className = 'kh-toast';
    el.textContent = text;
    el.style.color = this.brightenReadableToastColor(colorHex);
    el.style.setProperty('--kh-toast-accent', colorHex);
    this.toastContainer.appendChild(el);
    this.activeToasts.push({ el, expiresAt: now + 2400 });
  }

  private formatTimer(seconds: number): string {
    const clamped = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }
}
