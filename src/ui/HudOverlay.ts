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
} from '../contracts/index.js';

export interface HudRenderStats {
  backend: string;
  fps: number;
  drawCalls: number;
  particleCount: number;
}

const SKULL_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true"><path d="M12 2.5C7.3 2.5 4 5.9 4 10.3c0 2.6 1.2 4.7 3 6v3.2c0 .8.6 1.5 1.4 1.5h7.2c.8 0 1.4-.7 1.4-1.5v-3.2c1.8-1.3 3-3.4 3-6C20 5.9 16.7 2.5 12 2.5Z" fill="#f5cb70" stroke="#4a1019" stroke-width="1.4"/><circle cx="9.2" cy="10.4" r="1.7" fill="#4a1019"/><circle cx="14.8" cy="10.4" r="1.7" fill="#4a1019"/><path d="M10 17.5v3M12 17.5v3M14 17.5v3" stroke="#4a1019" stroke-width="1.3"/></svg>`;

const COIN_SVG = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#f3c44d" stroke="#7a4c11" stroke-width="1.2"/><circle cx="8" cy="8" r="3.6" stroke="#fff3be" stroke-width="1"/></svg>`;

const DARKNESS_SVG = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true"><path d="M8 1.5C5.2 4.8 3.5 7.4 3.5 10a4.5 4.5 0 0 0 9 0c0-2.6-1.7-5.2-4.5-8.5Z" fill="#b46eff" stroke="#2c104d" stroke-width="1.1"/></svg>`;

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
  common: '#b69d81',
  rare: '#3b96ff',
  epic: '#ae5cff',
  heroic: '#eb4754',
  duo: '#3ee491',
  legendary: '#ffb133',
};

interface ActiveToast {
  el: HTMLDivElement;
  expiresAt: number;
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
  private lastBossSignature = '';

  // Top-right chamber + currency + fps
  private readonly topRight: HTMLDivElement;
  private readonly biomeEl: HTMLSpanElement;
  private readonly depthEl: HTMLSpanElement;
  private readonly heatEl: HTMLSpanElement;
  private readonly goldValEl: HTMLSpanElement;
  private readonly darknessValEl: HTMLSpanElement;
  private readonly fpsChip: HTMLDivElement;

  // Bottom-left hero panel
  private readonly boonStrip: HTMLDivElement;
  private readonly weaponTagEl: HTMLSpanElement;
  private readonly godModeBadgeEl: HTMLSpanElement;
  private readonly ddRowEl: HTMLDivElement;
  private readonly hpTrackEl: HTMLDivElement;
  private readonly hpFillEl: HTMLDivElement;
  private readonly hpTextMainEl: HTMLSpanElement;
  private readonly hpArmorEl: HTMLSpanElement;
  private readonly bloodstoneGroupEl: HTMLDivElement;
  private readonly dashGroupEl: HTMLDivElement;
  private readonly railAmmoEl: HTMLSpanElement;
  private readonly godGaugeWrapEl: HTMLDivElement;
  private readonly godGaugeStatusEl: HTMLSpanElement;
  private readonly godSegFills: HTMLDivElement[] = [];

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

  // Dirty-checking caches for zero-churn 120fps updates
  private lastBoonsKey = '';
  private lastDdKey = '';
  private lastBloodstoneKey = '';
  private lastDashKey = '';
  private lastPromptKey = '';

  constructor(uiRoot: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'kh-hud kh-hidden';
    this.root.setAttribute('data-hud-root', 'true');

    // Top-center Boss Stack
    this.bossStack = document.createElement('div');
    this.bossStack.className = 'kh-boss-stack kh-hidden';

    // Top-right Chamber / Biome / Gold / Darkness / FPS
    this.topRight = document.createElement('div');
    this.topRight.className = 'kh-hud-topright';

    const chamberPill = document.createElement('div');
    chamberPill.className = 'kh-chamber-pill';
    this.biomeEl = document.createElement('span');
    this.biomeEl.className = 'kh-biome-name';
    this.depthEl = document.createElement('span');
    this.depthEl.className = 'kh-chamber-depth';
    this.heatEl = document.createElement('span');
    this.heatEl.className = 'kh-heat-pill kh-hidden';
    chamberPill.append(this.biomeEl, this.depthEl, this.heatEl);

    const currencyRow = document.createElement('div');
    currencyRow.className = 'kh-currency-row';

    const goldChip = document.createElement('div');
    goldChip.className = 'kh-currency-chip kh-currency-gold';
    goldChip.innerHTML = COIN_SVG;
    this.goldValEl = document.createElement('span');
    this.goldValEl.textContent = '0';
    goldChip.appendChild(this.goldValEl);

    const darknessChip = document.createElement('div');
    darknessChip.className = 'kh-currency-chip kh-currency-darkness';
    darknessChip.innerHTML = DARKNESS_SVG;
    this.darknessValEl = document.createElement('span');
    this.darknessValEl.textContent = '0';
    darknessChip.appendChild(this.darknessValEl);

    this.fpsChip = document.createElement('div');
    this.fpsChip.className = 'kh-currency-chip kh-currency-fps kh-hidden';

    currencyRow.append(goldChip, darknessChip, this.fpsChip);
    this.topRight.append(chamberPill, currencyRow);

    // Bottom-left Ornate Hero HUD
    const bottomLeft = document.createElement('div');
    bottomLeft.className = 'kh-hud-bottomleft';

    this.boonStrip = document.createElement('div');
    this.boonStrip.className = 'kh-boon-strip';

    const heroFrame = document.createElement('div');
    heroFrame.className = 'kh-hero-frame';

    const topRow = document.createElement('div');
    topRow.className = 'kh-hero-top-row';
    this.weaponTagEl = document.createElement('span');
    this.weaponTagEl.className = 'kh-weapon-tag';
    const rightMeta = document.createElement('div');
    rightMeta.style.display = 'flex';
    rightMeta.style.alignItems = 'center';
    rightMeta.style.gap = '6px';
    this.godModeBadgeEl = document.createElement('span');
    this.godModeBadgeEl.className = 'kh-godmode-badge kh-hidden';
    this.ddRowEl = document.createElement('div');
    this.ddRowEl.className = 'kh-dd-row';
    rightMeta.append(this.godModeBadgeEl, this.ddRowEl);
    topRow.append(this.weaponTagEl, rightMeta);

    this.hpTrackEl = document.createElement('div');
    this.hpTrackEl.className = 'kh-hp-track';
    this.hpFillEl = document.createElement('div');
    this.hpFillEl.className = 'kh-hp-fill';
    const hpText = document.createElement('div');
    hpText.className = 'kh-hp-text';
    this.hpTextMainEl = document.createElement('span');
    this.hpArmorEl = document.createElement('span');
    this.hpArmorEl.style.color = '#ffe588';
    hpText.append(this.hpTextMainEl, this.hpArmorEl);
    this.hpTrackEl.append(this.hpFillEl, hpText);

    const resourcesRow = document.createElement('div');
    resourcesRow.className = 'kh-resources-row';
    this.bloodstoneGroupEl = document.createElement('div');
    this.bloodstoneGroupEl.className = 'kh-pip-group';
    this.dashGroupEl = document.createElement('div');
    this.dashGroupEl.className = 'kh-pip-group';
    this.railAmmoEl = document.createElement('span');
    this.railAmmoEl.className = 'kh-rail-ammo kh-hidden';
    resourcesRow.append(this.bloodstoneGroupEl, this.dashGroupEl, this.railAmmoEl);

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

    heroFrame.append(topRow, this.hpTrackEl, resourcesRow, this.godGaugeWrapEl);
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

    this.root.append(
      this.bossStack,
      this.topRight,
      bottomLeft,
      this.promptStrip,
      this.interactBanner,
      this.toastContainer
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
    const showHud =
      screen === 'hub' ||
      screen === 'playing' ||
      screen === 'pause' ||
      screen === 'boon_select';

    this.root.classList.toggle('kh-hidden', !showHud);
    if (!showHud) {
      return;
    }

    const inLiveGameplay = screen === 'hub' || screen === 'playing';
    const player = state.player;
    const room = state.room;
    const biome = BIOME_CONSTANTS[room.biome];

    // Relocate Hero HUD + Boons to top-left & shift top-right away from pause pill when touch is active
    this.root.classList.toggle('kh-touch-active', activeSource === 'touch');
    this.topRight.classList.toggle('kh-touch-offset', activeSource === 'touch');

    // Top-right Biome & Chamber Depth
    this.biomeEl.textContent = biome.displayName;
    this.biomeEl.style.color = biome.accentHex;
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
      if (this.heatEl.textContent !== heatText) {
        this.heatEl.textContent = heatText;
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

    // Hero Weapon + God Mode + Death Defiances
    const weaponName = WEAPON_CONSTANTS[player.weaponId].displayName;
    if (this.weaponTagEl.textContent !== weaponName) {
      this.weaponTagEl.textContent = weaponName;
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

    // HP Bar
    const maxHp = Math.max(1, Math.round(player.maxHp));
    const hp = Math.max(0, Math.ceil(player.hp));
    const hpPct = Math.max(0, Math.min(100, (player.hp / maxHp) * 100));
    this.hpFillEl.style.width = `${hpPct.toFixed(1)}%`;
    this.hpTrackEl.classList.toggle('kh-hp-low', hpPct > 0 && hpPct <= 25);
    const hpStr = `${hp} / ${maxHp}`;
    if (this.hpTextMainEl.textContent !== hpStr) {
      this.hpTextMainEl.textContent = hpStr;
    }
    const armorStr = player.armor > 0 ? `+${Math.ceil(player.armor)} ARM` : '';
    if (this.hpArmorEl.textContent !== armorStr) {
      this.hpArmorEl.textContent = armorStr;
    }

    // Bloodstone slots, Dash pips, Rail ammo
    this.updateBloodstones(player.castAmmo, player.maxCastAmmo);
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

    // 4-Segment God Gauge
    this.updateGodGauge(player.godGauge, player.godCallPatron);

    // Active Boons Strip
    this.updateBoons(player.boons);

    // Top-center Boss Health Bars
    this.updateBossBars(state.enemies);

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
    this.activeToasts = [];
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
      const span = document.createElement('span');
      span.className = i < clampedCur ? 'kh-dd-skull' : 'kh-dd-skull kh-spent';
      span.innerHTML = SKULL_SVG;
      span.title = i < clampedCur ? 'Death Defiance Ready' : 'Death Defiance Spent';
      this.ddRowEl.appendChild(span);
    }
  }

  private updateBloodstones(current: number, max: number): void {
    const clampedMax = Math.max(1, Math.min(8, Math.round(max)));
    const clampedCur = Math.max(0, Math.min(clampedMax, Math.round(current)));
    const key = `${clampedCur}/${clampedMax}`;
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
      const pip = document.createElement('span');
      pip.className = i < clampedCur ? 'kh-bloodstone-pip' : 'kh-bloodstone-pip kh-empty';
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
      const pip = document.createElement('span');
      pip.className = i < clampedCur ? 'kh-dash-pip' : 'kh-dash-pip kh-empty';
      this.dashGroupEl.appendChild(pip);
    }
  }

  private updateGodGauge(gauge: number, patronId: SimState['player']['godCallPatron']): void {
    const clamped = Math.max(0, Math.min(100, gauge));
    const patronColor = patronId ? PATRON_CONSTANTS[patronId].colorHex : '#f5cb70';
    for (let i = 0; i < 4; i++) {
      const segMin = i * 25;
      const segPct = Math.max(0, Math.min(100, ((clamped - segMin) / 25) * 100));
      const fill = this.godSegFills[i];
      fill.style.width = `${segPct.toFixed(1)}%`;
      fill.style.background = `linear-gradient(90deg, #d99f4c 0%, ${patronColor} 100%)`;
    }

    const isMax = clamped >= 100;
    const isReady = clamped >= 25;
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
      const chip = document.createElement('div');
      chip.className = 'kh-boon-chip';
      chip.style.borderColor = RARITY_COLOR[boon.rarity] ?? '#b69d81';
      chip.title = `${boon.name} (${PATRON_CONSTANTS[boon.patronId].displayName}) — ${boon.description}`;

      const dot = document.createElement('span');
      dot.className = 'kh-boon-dot';
      dot.style.background = PATRON_CONSTANTS[boon.patronId].colorHex;

      const label = document.createElement('span');
      const slotCode = SLOT_SHORT_LABEL[boon.slot] ?? 'BON';
      label.textContent = boon.level > 1 ? `${slotCode} Lv.${boon.level}` : slotCode;

      chip.append(dot, label);
      this.boonStrip.appendChild(chip);
    }

    if (boons.length > visibleLimit) {
      const more = document.createElement('div');
      more.className = 'kh-boon-chip';
      more.textContent = `+${boons.length - visibleLimit}`;
      this.boonStrip.appendChild(more);
    }
  }

  private updateBossBars(enemies: readonly EnemyState[]): void {
    const bosses = enemies.filter((e) => e.isBoss && e.aiState !== 'dead' && e.hp > 0);
    this.root.classList.toggle('kh-has-boss', bosses.length > 0);
    if (bosses.length === 0) {
      if (this.lastBossSignature !== '') {
        this.lastBossSignature = '';
        this.bossStack.innerHTML = '';
        this.bossStack.classList.add('kh-hidden');
      }
      return;
    }

    this.bossStack.classList.remove('kh-hidden');
    const sig = bosses
      .map(
        (b) =>
          `${b.id}:${Math.ceil(b.hp)}/${Math.ceil(b.maxHp)}:${Math.ceil(b.armor)}/${Math.ceil(b.maxArmor)}:${b.phase}/${b.maxPhases}`
      )
      .join('|');
    if (sig === this.lastBossSignature) {
      return;
    }
    this.lastBossSignature = sig;
    this.bossStack.innerHTML = '';

    for (const boss of bosses.slice(0, 2)) {
      const def = boss.bossId ? BOSS_CONSTANTS[boss.bossId] : undefined;
      const card = document.createElement('div');
      card.className = 'kh-boss-bar-card';

      const head = document.createElement('div');
      head.className = 'kh-boss-header';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'kh-boss-title-group';
      const nameEl = document.createElement('span');
      nameEl.className = 'kh-boss-name';
      nameEl.textContent = def?.displayName ?? boss.name;
      titleGroup.appendChild(nameEl);

      if (def?.title) {
        const subEl = document.createElement('span');
        subEl.className = 'kh-boss-subtitle';
        subEl.textContent = def.title;
        titleGroup.appendChild(subEl);
      }

      const phaseBadge = document.createElement('span');
      phaseBadge.className = 'kh-boss-phase-badge';
      phaseBadge.textContent =
        boss.maxPhases > 1 ? `PHASE ${boss.phase} / ${boss.maxPhases}` : `${Math.ceil(boss.hp)} HP`;

      head.append(titleGroup, phaseBadge);
      card.appendChild(head);

      // Golden Armor Bar if armored
      if (boss.maxArmor > 0 && boss.armor > 0) {
        const armorTrack = document.createElement('div');
        armorTrack.className = 'kh-boss-armor-track';
        const armorFill = document.createElement('div');
        armorFill.className = 'kh-boss-armor-fill';
        armorFill.style.width = `${Math.max(0, Math.min(100, (boss.armor / boss.maxArmor) * 100)).toFixed(1)}%`;
        armorTrack.appendChild(armorFill);
        card.appendChild(armorTrack);
      }

      // Crimson Boss HP Bar with Phase Notches
      const hpTrack = document.createElement('div');
      hpTrack.className = 'kh-boss-hp-track';
      const hpFill = document.createElement('div');
      hpFill.className = 'kh-boss-hp-fill';
      const hpPct = Math.max(0, Math.min(100, (boss.hp / Math.max(1, boss.maxHp)) * 100));
      hpFill.style.width = `${hpPct.toFixed(1)}%`;
      hpTrack.appendChild(hpFill);

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
      hpPill.textContent = `${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`;
      hpText.appendChild(hpPill);
      hpTrack.appendChild(hpText);

      card.appendChild(hpTrack);
      this.bossStack.appendChild(card);
    }
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
    // Hidden in touch mode so prompts never overlap translucent touch buttons
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
    }
  }

  private processToasts(
    tick: number,
    stateEvents: readonly SimEvent[],
    drainedEvents?: readonly SimEvent[]
  ): void {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // Expire old toasts
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
      if (ev.type === 'ui_toast') {
        this.pushToast(ev.text, ev.colorHex ?? '#f5cb70', now);
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

  private pushToast(text: string, colorHex: string, now: number): void {
    const isCompactViewport = typeof window !== 'undefined' && window.innerHeight <= 500;
    const maxToasts = isCompactViewport ? 1 : 2;
    while (this.activeToasts.length >= maxToasts) {
      const oldest = this.activeToasts.shift();
      oldest?.el.remove();
    }
    const el = document.createElement('div');
    el.className = 'kh-toast';
    el.textContent = text;
    el.style.color = colorHex;
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
