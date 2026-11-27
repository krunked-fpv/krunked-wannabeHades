import {
  COMBAT_CONSTANTS,
  HAMMER_DEFS,
  PATRON_CONSTANTS,
  PLAYER_CONSTANTS,
  WEAPON_CONSTANTS,
  type BoonInstance,
  type BoonOffer,
  type BoonOfferOption,
  type BoonRarity,
  type BoonSlot,
  type EnemyState,
  type HammerId,
  type PatronId,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import {
  BOON_CATALOG,
  BOON_CATALOG_BY_ID,
  CORE_BOON_SLOTS,
  WAVE1_PATRONS,
  computeBoonScaledValue,
  formatBoonDescription,
  formatBoonValue,
  getBoonCatalogEntry,
  getBoonsForPatron,
  type BoonCatalogEntry,
} from '../data/boons.js';
import {
  getKeepsakeForcedPatron,
  getKeepsakeValue,
} from '../data/keepsakes.js';
import {
  applyMetaToPlayer,
  detNextFloat,
  detNextInt,
  detPick,
  getEffectiveMirrorUpgrade,
  getKeepsakeRank,
  type RngProvider,
  type SimCombatContext,
} from './meta.js';

// ============================================================================
// Internal Call Runtime Tracker (WeakMap avoids mutating SimState shape)
// ============================================================================

interface GodCallRuntime {
  lastSeenTimer: number;
  greater: boolean;
  pulseAccumulator: number;
}

const godCallStateMap = new WeakMap<SimState, GodCallRuntime>();

function getGodCallRuntime(state: SimState): GodCallRuntime {
  let rt = godCallStateMap.get(state);
  if (!rt) {
    rt = { lastSeenTimer: 0, greater: false, pulseAccumulator: 0 };
    godCallStateMap.set(state, rt);
  }
  return rt;
}

// ============================================================================
// Helper Queries & Rarity Rolls
// ============================================================================

export function getBoonInSlot(
  state: SimState,
  slot: BoonSlot
): BoonInstance | undefined {
  return state.player.boons.find((b) => b.slot === slot);
}

export function hasBoon(state: SimState, boonId: string): boolean {
  return state.player.boons.some((b) => b.id === boonId);
}

export function getBoonById(
  state: SimState,
  boonId: string
): BoonInstance | undefined {
  return state.player.boons.find((b) => b.id === boonId);
}

export function hasPatronBoon(state: SimState, patronId: PatronId): boolean {
  return state.player.boons.some((b) => b.patronId === patronId);
}

export function instantiateBoon(
  entry: BoonCatalogEntry,
  rarity: BoonRarity,
  level = 1
): BoonInstance {
  const effectiveRarity: BoonRarity =
    entry.slot === 'duo' ? 'duo' : entry.slot === 'legendary' ? 'legendary' : rarity;
  const scaledValue = computeBoonScaledValue(
    entry.baseValue,
    effectiveRarity,
    level,
    entry.pommable !== false
  );
  return {
    id: entry.id,
    patronId: entry.patronId,
    name: entry.name,
    description: formatBoonDescription(entry, scaledValue),
    slot: entry.slot,
    rarity: effectiveRarity,
    level,
    baseValue: entry.baseValue,
    scaledValue,
    secondaryValue: entry.secondaryValue,
    statusEffect: entry.statusEffect,
    prerequisiteIds: entry.prerequisiteIds,
    duoPatrons: entry.duoPatrons,
  };
}

function upgradeRarityOneTier(rarity: BoonRarity): BoonRarity {
  if (rarity === 'common') return 'rare';
  if (rarity === 'rare') return 'epic';
  if (rarity === 'epic') return 'heroic';
  return 'heroic';
}

function rollBoonRarity(
  state: SimState,
  patronId: PatronId,
  ctx?: RngProvider
): BoonRarity {
  const favor = getEffectiveMirrorUpgrade(state.meta, state.run.vows, 'patron_favor');
  const pride = getEffectiveMirrorUpgrade(state.meta, state.run.vows, 'divine_pride');

  let rareChance = 0.16 + (favor.side === 'a' ? favor.value : 0);
  let epicChance = 0.05 + (pride.side === 'a' ? pride.value : 0);

  const keepsakeId = state.player.keepsakeId;
  if (
    keepsakeId &&
    !state.player.keepsakeUsed &&
    getKeepsakeForcedPatron(keepsakeId) === patronId
  ) {
    rareChance += getKeepsakeValue(keepsakeId, getKeepsakeRank(state.meta, keepsakeId));
  }

  const roll = detNextFloat(state, ctx);
  if (roll < epicChance) {
    return 'epic';
  }
  if (roll < epicChance + rareChance) {
    return 'rare';
  }
  return 'common';
}

function isEntryEligible(state: SimState, entry: BoonCatalogEntry): boolean {
  if (hasBoon(state, entry.id)) {
    return false;
  }
  if (entry.slot === 'duo' && entry.duoPatrons) {
    const [pA, pB] = entry.duoPatrons;
    return hasPatronBoon(state, pA) && hasPatronBoon(state, pB);
  }
  if (entry.prerequisiteIds && entry.prerequisiteIds.length > 0) {
    return entry.prerequisiteIds.some((reqId) => hasBoon(state, reqId));
  }
  if (entry.prerequisiteSlots && entry.prerequisiteSlots.length > 0) {
    return state.player.boons.some(
      (b) => b.patronId === entry.patronId && entry.prerequisiteSlots!.includes(b.slot)
    );
  }
  return true;
}

function getOfferOptionCount(state: SimState): number {
  const approval = Math.max(0, Math.min(2, Math.floor(state.run.vows.approval_process ?? 0)));
  return Math.max(1, 3 - approval);
}

// ============================================================================
// Boon, Pom, and Hammer Offer Generation
// ============================================================================

export function generateBoonOffer(
  state: SimState,
  patronId?: PatronId,
  ctx?: RngProvider,
  excludeIds?: ReadonlySet<string>
): BoonOffer {
  // Choose Patron (respecting Keepsake forced patron if unspecified)
  let chosenPatron: PatronId = patronId ?? detPick(state, WAVE1_PATRONS, ctx);
  if (!patronId && state.player.keepsakeId && !state.player.keepsakeUsed) {
    const forced = getKeepsakeForcedPatron(state.player.keepsakeId);
    if (forced) {
      chosenPatron = forced;
    }
  }

  if (!state.run.seenPatrons.includes(chosenPatron)) {
    state.run.seenPatrons.push(chosenPatron);
  }

  const targetCount = getOfferOptionCount(state);
  const patronPool = getBoonsForPatron(chosenPatron);

  interface Candidate {
    entry: BoonCatalogEntry;
    replaces?: BoonInstance;
    weight: number;
  }

  const candidates: Candidate[] = [];
  for (const entry of patronPool) {
    if (excludeIds?.has(entry.id)) continue;
    if (!isEntryEligible(state, entry)) continue;

    if (CORE_BOON_SLOTS.includes(entry.slot)) {
      const existing = getBoonInSlot(state, entry.slot);
      if (!existing) {
        candidates.push({ entry, weight: 4 });
      } else if (existing.patronId !== chosenPatron) {
        // Replacement / Exchange offer with guaranteed +1 rarity bump!
        candidates.push({ entry, replaces: existing, weight: 1.3 });
      }
    } else if (entry.slot === 'duo') {
      const legacy = getEffectiveMirrorUpgrade(state.meta, state.run.vows, 'divine_pride');
      const duoWeight = 2.2 + (legacy.side === 'b' ? legacy.value * 20 : 0);
      candidates.push({ entry, weight: duoWeight });
    } else {
      candidates.push({ entry, weight: 2.5 });
    }
  }

  // Fallback if exclusion narrowed pool too far
  if (candidates.length < targetCount) {
    for (const entry of patronPool) {
      if (hasBoon(state, entry.id)) continue;
      if (candidates.some((c) => c.entry.id === entry.id)) continue;
      const existing = CORE_BOON_SLOTS.includes(entry.slot)
        ? getBoonInSlot(state, entry.slot)
        : undefined;
      if (existing && existing.patronId === chosenPatron) continue;
      candidates.push({ entry, replaces: existing, weight: 1 });
    }
  }

  // Weighted deterministic selection without replacement
  const selected: Candidate[] = [];
  const pool = [...candidates];
  let hasReplacement = false;

  while (selected.length < targetCount && pool.length > 0) {
    const filteredPool = hasReplacement
      ? pool.filter((c) => !c.replaces)
      : pool;
    const activePool = filteredPool.length > 0 ? filteredPool : pool;

    let totalWeight = 0;
    for (const c of activePool) {
      totalWeight += c.weight;
    }
    let roll = detNextFloat(state, ctx) * totalWeight;
    let picked = activePool[0];
    for (const c of activePool) {
      roll -= c.weight;
      if (roll <= 0) {
        picked = c;
        break;
      }
    }
    selected.push(picked);
    if (picked.replaces) {
      hasReplacement = true;
    }
    const idx = pool.indexOf(picked);
    if (idx >= 0) {
      pool.splice(idx, 1);
    }
  }

  const options: BoonOfferOption[] = selected.map((c) => {
    let rarity: BoonRarity =
      c.entry.slot === 'duo'
        ? 'duo'
        : c.replaces
          ? upgradeRarityOneTier(c.replaces.rarity)
          : rollBoonRarity(state, chosenPatron, ctx);
    const level = c.replaces ? c.replaces.level : 1;
    const scaled = computeBoonScaledValue(
      c.entry.baseValue,
      rarity,
      level,
      c.entry.pommable !== false
    );
    const previewVal = formatBoonValue(scaled, c.entry.valueFormat);
    const desc = formatBoonDescription(c.entry, scaled);
    return {
      id: c.entry.id,
      kind: 'boon',
      name: c.entry.name,
      description: c.replaces
        ? `${desc} (Replaces ${c.replaces.name})`
        : desc,
      rarity,
      patronId: chosenPatron,
      slot: c.entry.slot,
      boonId: c.entry.id,
      previewValue:
        c.entry.valueFormat === 'percent' ? `+${previewVal}` : previewVal,
      replacesBoonId: c.replaces?.id,
    };
  });

  // Safety fallback if player literally collected every boon of this patron
  if (options.length === 0) {
    options.push({
      id: `${chosenPatron}_tribute_gold`,
      kind: 'well_item',
      name: `${PATRON_CONSTANTS[chosenPatron].displayName}'s Tribute`,
      description: 'Receive +90 Gold and restore 25 HP.',
      rarity: 'rare',
      patronId: chosenPatron,
      previewValue: '+90 Gold',
    });
  }

  // Consume patron keepsake guarantee once this patron's offer is generated
  if (
    state.player.keepsakeId &&
    !state.player.keepsakeUsed &&
    getKeepsakeForcedPatron(state.player.keepsakeId) === chosenPatron
  ) {
    state.player.keepsakeUsed = true;
  }

  const patronDef = PATRON_CONSTANTS[chosenPatron];
  const offer: BoonOffer = {
    source: 'patron',
    patronId: chosenPatron,
    title: `${patronDef.displayName}, ${patronDef.title}`,
    subtitle: 'Choose a Divine Blessing',
    options,
    rerollsRemaining: state.run.boonRerolls,
  };

  state.run.pendingOffer = offer;
  state.events.push({ type: 'boon_offered', offer });
  return offer;
}

export function generatePomOffer(
  state: SimState,
  ctx?: RngProvider
): BoonOffer {
  const targetCount = getOfferOptionCount(state);
  const upgradable = state.player.boons.filter((b) => {
    const entry = getBoonCatalogEntry(b.id);
    return !entry || entry.pommable !== false;
  });

  const pool = [...upgradable];
  const options: BoonOfferOption[] = [];

  while (options.length < targetCount && pool.length > 0) {
    const idx = detNextInt(state, 0, pool.length - 1, ctx);
    const boon = pool.splice(idx, 1)[0];
    const entry = getBoonCatalogEntry(boon.id);
    const nextLevel = boon.level + 1;
    const nextScaled = computeBoonScaledValue(
      boon.baseValue,
      boon.rarity,
      nextLevel,
      true
    );
    const fmt = entry?.valueFormat ?? (boon.baseValue < 10 ? 'percent' : 'flat');
    options.push({
      id: `pom_${boon.id}`,
      kind: 'pom_upgrade',
      name: `${boon.name} (Lv ${boon.level} -> ${nextLevel})`,
      description: entry
        ? formatBoonDescription(entry, nextScaled)
        : `Upgrade ${boon.name} to Lv ${nextLevel}.`,
      rarity: boon.rarity,
      patronId: boon.patronId,
      slot: boon.slot,
      boonId: boon.id,
      previewValue: `${formatBoonValue(boon.scaledValue, fmt)} -> ${formatBoonValue(nextScaled, fmt)}`,
    });
  }

  if (options.length === 0) {
    options.push({
      id: 'pom_vitality_fallback',
      kind: 'well_item',
      name: 'Nectar of Power',
      description: 'No upgradable Boons yet. Gain +25 Max HP and +60 Gold.',
      rarity: 'rare',
      previewValue: '+25 Max HP',
    });
  }

  const offer: BoonOffer = {
    source: 'pom',
    title: 'Pom of Power',
    subtitle: 'Empower an active Blessing',
    options,
    rerollsRemaining: state.run.boonRerolls,
  };
  state.run.pendingOffer = offer;
  state.events.push({ type: 'boon_offered', offer });
  return offer;
}

export function generateHammerOffer(
  state: SimState,
  ctx?: RngProvider
): BoonOffer {
  const targetCount = getOfferOptionCount(state);
  const weaponDef = WEAPON_CONSTANTS[state.player.weaponId];
  const available = weaponDef.hammers.filter(
    (hId) => !state.player.hammers.includes(hId)
  );
  const pool = [...available];
  const options: BoonOfferOption[] = [];

  while (options.length < targetCount && pool.length > 0) {
    const idx = detNextInt(state, 0, pool.length - 1, ctx);
    const hammerId = pool.splice(idx, 1)[0];
    const def = HAMMER_DEFS[hammerId];
    options.push({
      id: hammerId,
      kind: 'hammer',
      name: def.displayName,
      description: def.description,
      rarity: 'epic',
      hammerId,
      previewValue: weaponDef.displayName,
    });
  }

  if (options.length === 0) {
    options.push({
      id: 'hammer_anvil_gold',
      kind: 'well_item',
      name: 'Forged Ingot',
      description: 'All arm upgrades mastered. Gain +120 Gold.',
      rarity: 'epic',
      previewValue: '+120 Gold',
    });
  }

  const offer: BoonOffer = {
    source: 'hammer',
    title: 'Forge Hammer',
    subtitle: `Transform your ${weaponDef.displayName}`,
    options,
    rerollsRemaining: 0,
  };
  state.run.pendingOffer = offer;
  state.events.push({ type: 'boon_offered', offer });
  return offer;
}

// ============================================================================
// Apply Selected Boon / Reroll / Direct Debug Grants
// ============================================================================

export function applySelectedBoon(
  state: SimState,
  optionIndex: number,
  _ctx?: RngProvider
): boolean {
  const offer = state.run.pendingOffer;
  if (!offer) return false;
  if (optionIndex < 0 || optionIndex >= offer.options.length) return false;

  const opt = offer.options[optionIndex];
  if (opt.kind === 'boon' && opt.boonId) {
    const entry = getBoonCatalogEntry(opt.boonId);
    if (!entry) return false;

    let inheritedLevel = 1;
    if (opt.replacesBoonId) {
      const prevIdx = state.player.boons.findIndex((b) => b.id === opt.replacesBoonId);
      if (prevIdx >= 0) {
        inheritedLevel = state.player.boons[prevIdx].level;
        state.player.boons.splice(prevIdx, 1);
      }
    } else if (CORE_BOON_SLOTS.includes(entry.slot)) {
      const sameSlotIdx = state.player.boons.findIndex((b) => b.slot === entry.slot);
      if (sameSlotIdx >= 0) {
        inheritedLevel = state.player.boons[sameSlotIdx].level;
        state.player.boons.splice(sameSlotIdx, 1);
      }
    }

    const instance = instantiateBoon(entry, opt.rarity, inheritedLevel);
    state.player.boons.push(instance);
    if (!state.meta.codexBoonsSeen.includes(instance.id)) {
      state.meta.codexBoonsSeen.push(instance.id);
    }

    // Immediate stat passives (e.g. Hyper Reflex extra dash)
    if (instance.id === 'veloce_greatest_reflex') {
      applyMetaToPlayer(state, { resetVitals: false });
    }

    state.events.push({
      type: 'boon_selected',
      optionId: opt.id,
      patronId: instance.patronId,
      rarity: instance.rarity,
    });
    state.events.push({
      type: 'ui_toast',
      text: `Acquired ${instance.name} (${instance.rarity.toUpperCase()})`,
      colorHex: PATRON_CONSTANTS[instance.patronId].colorHex,
    });
  } else if (opt.kind === 'pom_upgrade' && opt.boonId) {
    const boon = getBoonById(state, opt.boonId);
    if (boon) {
      boon.level += 1;
      const entry = getBoonCatalogEntry(boon.id);
      boon.scaledValue = computeBoonScaledValue(
        boon.baseValue,
        boon.rarity,
        boon.level,
        entry?.pommable !== false
      );
      if (entry) {
        boon.description = formatBoonDescription(entry, boon.scaledValue);
      }
      state.events.push({
        type: 'boon_selected',
        optionId: opt.id,
        patronId: boon.patronId,
        rarity: boon.rarity,
      });
      state.events.push({
        type: 'ui_toast',
        text: `${boon.name} upgraded to Lv ${boon.level}!`,
        colorHex: '#ff5266',
      });
    }
  } else if (opt.kind === 'hammer' && opt.hammerId) {
    if (!state.player.hammers.includes(opt.hammerId)) {
      state.player.hammers.push(opt.hammerId);
      state.run.hammersCollected += 1;
      applyMetaToPlayer(state, { resetVitals: false });
    }
    state.events.push({
      type: 'boon_selected',
      optionId: opt.id,
      rarity: opt.rarity,
    });
    state.events.push({
      type: 'ui_toast',
      text: `Forged ${opt.name}!`,
      colorHex: '#f5c742',
    });
  } else if (opt.kind === 'well_item') {
    if (opt.id === 'pom_vitality_fallback') {
      state.player.maxHp += 25;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
      state.player.gold += 60;
    } else if (opt.id === 'hammer_anvil_gold') {
      state.player.gold += 120;
    } else {
      state.player.gold += 90;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
    }
    state.events.push({
      type: 'boon_selected',
      optionId: opt.id,
      patronId: opt.patronId,
      rarity: opt.rarity,
    });
  }

  state.run.pendingOffer = null;
  return true;
}

export function rerollBoonOffer(
  state: SimState,
  ctx?: RngProvider
): boolean {
  const offer = state.run.pendingOffer;
  if (!offer) return false;
  if (state.run.boonRerolls <= 0 || offer.rerollsRemaining <= 0) {
    return false;
  }

  state.run.boonRerolls -= 1;
  const previousIds = new Set(offer.options.map((o) => o.boonId ?? o.id));

  if (offer.source === 'patron' && offer.patronId) {
    generateBoonOffer(state, offer.patronId, ctx, previousIds);
    return true;
  }
  if (offer.source === 'pom') {
    generatePomOffer(state, ctx);
    return true;
  }
  return false;
}

export function grantBoonDirect(
  state: SimState,
  patronId: PatronId,
  slot?: BoonSlot,
  rarity: BoonRarity = 'rare',
  ctx?: RngProvider
): BoonInstance | null {
  const patronEntries = getBoonsForPatron(patronId);
  let entry: BoonCatalogEntry | undefined;

  if (slot) {
    entry = patronEntries.find((e) => e.slot === slot && !hasBoon(state, e.id));
    if (!entry) {
      entry = patronEntries.find((e) => e.slot === slot);
    }
  } else {
    // Pick first unoccupied core slot for this patron, else passive
    entry =
      patronEntries.find(
        (e) =>
          CORE_BOON_SLOTS.includes(e.slot) &&
          !getBoonInSlot(state, e.slot) &&
          !hasBoon(state, e.id)
      ) ??
      patronEntries.find((e) => !hasBoon(state, e.id)) ??
      patronEntries[0];
  }

  if (!entry) {
    entry = BOON_CATALOG[0];
  }

  if (CORE_BOON_SLOTS.includes(entry.slot)) {
    const existingIdx = state.player.boons.findIndex((b) => b.slot === entry!.slot);
    if (existingIdx >= 0) {
      state.player.boons.splice(existingIdx, 1);
    }
  } else {
    const dupIdx = state.player.boons.findIndex((b) => b.id === entry!.id);
    if (dupIdx >= 0) {
      const existing = state.player.boons[dupIdx];
      existing.level += 1;
      existing.scaledValue = computeBoonScaledValue(
        existing.baseValue,
        existing.rarity,
        existing.level,
        entry.pommable !== false
      );
      existing.description = formatBoonDescription(entry, existing.scaledValue);
      return existing;
    }
  }

  const rolledRarity = rarity ?? rollBoonRarity(state, patronId, ctx);
  const instance = instantiateBoon(entry, rolledRarity, 1);
  state.player.boons.push(instance);
  if (!state.meta.codexBoonsSeen.includes(instance.id)) {
    state.meta.codexBoonsSeen.push(instance.id);
  }
  if (!state.run.seenPatrons.includes(patronId)) {
    state.run.seenPatrons.push(patronId);
  }
  if (instance.id === 'veloce_greatest_reflex') {
    applyMetaToPlayer(state, { resetVitals: false });
  }

  state.events.push({
    type: 'boon_selected',
    optionId: instance.id,
    patronId: instance.patronId,
    rarity: instance.rarity,
  });
  state.events.push({
    type: 'ui_toast',
    text: `Granted ${instance.name} (${PATRON_CONSTANTS[patronId].displayName})`,
    colorHex: PATRON_CONSTANTS[patronId].colorHex,
  });

  return instance;
}

export function grantHammerDirect(
  state: SimState,
  hammerId?: HammerId,
  ctx?: RngProvider
): HammerId | null {
  const weaponDef = WEAPON_CONSTANTS[state.player.weaponId];
  const chosen: HammerId | undefined =
    hammerId && HAMMER_DEFS[hammerId]
      ? hammerId
      : weaponDef.hammers.find((id) => !state.player.hammers.includes(id)) ??
        detPick(state, weaponDef.hammers, ctx);

  if (!chosen) return null;
  if (!state.player.hammers.includes(chosen)) {
    state.player.hammers.push(chosen);
    state.run.hammersCollected += 1;
    applyMetaToPlayer(state, { resetVitals: false });
  }
  state.events.push({
    type: 'ui_toast',
    text: `Hammer: ${HAMMER_DEFS[chosen].displayName}`,
    colorHex: '#f5c742',
  });
  return chosen;
}

// ============================================================================
// Live Combat Boon Hook Runners (Voltaris, Tidebreaker, Aegira, Velouris)
// ============================================================================

function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function isLivingEnemy(enemy: EnemyState): boolean {
  return enemy.aiState !== 'dead' && enemy.hp > 0;
}

export function deflectProjectilesInRadius(
  state: SimState,
  center: Vec2,
  radius: number,
  applyExposed: boolean,
  ctx: SimCombatContext
): number {
  const rSq = radius * radius;
  let deflectedCount = 0;

  for (const proj of state.projectiles) {
    if (proj.owner !== 'enemy' || !proj.deflectable || proj.deflected) {
      continue;
    }
    if (distSq(center, proj.pos) > rSq) {
      continue;
    }

    const mult = proj.isLob
      ? COMBAT_CONSTANTS.deflectLobSpeedMultiplier
      : COMBAT_CONSTANTS.deflectSpeedMultiplier;
    proj.owner = 'player';
    proj.ownerId = 'player';
    proj.deflected = true;
    proj.deflectable = false;
    proj.vel.x = -proj.vel.x * mult;
    proj.vel.y = -proj.vel.y * mult;
    proj.angle = Math.atan2(proj.vel.y, proj.vel.x);
    proj.damage = Math.max(45, Math.round(proj.damage * 2.5));
    proj.life = 0;
    proj.maxLife = Math.max(proj.maxLife, 1.8);
    proj.hitIds = [];
    proj.patronId = 'aegira';
    proj.colorHex = PATRON_CONSTANTS.aegira.colorHex;
    if (applyExposed) {
      proj.statusToApply = 'exposed';
    }

    state.events.push({
      type: 'deflect',
      pos: { x: proj.pos.x, y: proj.pos.y },
      projectileId: proj.id,
    });
    state.floatingNumbers.push({
      id: `fl_deflect_${state.tick}_${deflectedCount}`,
      pos: { x: proj.pos.x, y: proj.pos.y - 26 },
      vel: { x: 0, y: -65 },
      value: 'DEFLECT!',
      kind: 'deflect',
      colorHex: PATRON_CONSTANTS.aegira.colorHex,
      life: 0,
      maxLife: 0.75,
    });
    deflectedCount += 1;
  }

  if (deflectedCount > 0) {
    ctx.triggerHitstop(state, 0.028, 0.08);
    ctx.addCameraShake(state, 5, 0.12);
  }
  return deflectedCount;
}

function triggerVoltarisChainLightning(
  state: SimState,
  originEnemy: EnemyState,
  baseDamage: number,
  bounces: number,
  ctx: SimCombatContext
): void {
  const stormBoon = getBoonById(state, 'voltaris_storm_lightning');
  const hasJolted = hasBoon(state, 'voltaris_static_discharge');
  const totalBounces = bounces + (stormBoon ? Math.round(stormBoon.scaledValue) : 0);
  const arcDamage = Math.round(
    baseDamage * (1 + (stormBoon?.secondaryValue ?? 0))
  );

  if (hasJolted) {
    ctx.applyStatus(state, originEnemy, 'enemy', 'jolted', 1, 'voltaris');
  }

  const visited = new Set<string>([originEnemy.id]);
  let currentPos: Vec2 = { x: originEnemy.pos.x, y: originEnemy.pos.y };
  const jumpRangeSq = 300 * 300;

  for (let b = 0; b < totalBounces; b++) {
    let bestTarget: EnemyState | null = null;
    let bestDistSq = jumpRangeSq;

    for (const candidate of state.enemies) {
      if (!isLivingEnemy(candidate) || visited.has(candidate.id)) continue;
      const dSq = distSq(currentPos, candidate.pos);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestTarget = candidate;
      }
    }

    if (!bestTarget) break;
    visited.add(bestTarget.id);

    const angle = Math.atan2(
      bestTarget.pos.y - currentPos.y,
      bestTarget.pos.x - currentPos.x
    );
    ctx.dealDamageToEnemy(state, bestTarget, {
      baseDamage: arcDamage,
      source: 'status',
      angle,
      canCrit: false,
      canBackstab: false,
      statusId: hasJolted ? 'jolted' : undefined,
      patronId: 'voltaris',
    });

    // Visual lightning arc projectile (short-lived, zero secondary damage)
    ctx.spawnProjectile(state, {
      owner: 'player',
      ownerId: 'player',
      kind: 'lightning',
      pos: { x: currentPos.x, y: currentPos.y },
      vel: { x: Math.cos(angle) * 1800, y: Math.sin(angle) * 1800 },
      startPos: { x: currentPos.x, y: currentPos.y },
      radius: 10,
      angle,
      damage: 0,
      range: Math.sqrt(bestDistSq),
      maxLife: 0.14,
      pierceLeft: 99,
      bouncesLeft: 0,
      deflectable: false,
      deflected: false,
      homingStrength: 0,
      isLob: false,
      lobHeight: 0,
      lobDuration: 0,
      lobElapsed: 0,
      targetPos: { x: bestTarget.pos.x, y: bestTarget.pos.y },
      patronId: 'voltaris',
      colorHex: PATRON_CONSTANTS.voltaris.colorHex,
    });

    currentPos = { x: bestTarget.pos.x, y: bestTarget.pos.y };
  }
}

function triggerVoltarisBoltStrike(
  state: SimState,
  center: Vec2,
  baseDamage: number,
  baseRadius: number,
  source: 'status' | 'dash' | 'call',
  ctx: SimCombatContext
): void {
  const highVoltage = getBoonById(state, 'voltaris_high_voltage');
  const hasJolted = hasBoon(state, 'voltaris_static_discharge');
  const radius = baseRadius * (1 + (highVoltage ? highVoltage.scaledValue : 0));
  const dmg = Math.round(
    baseDamage * (1 + (highVoltage?.secondaryValue ?? 0))
  );
  const rSq = radius * radius;

  for (const enemy of state.enemies) {
    if (!isLivingEnemy(enemy)) continue;
    if (distSq(center, enemy.pos) <= rSq) {
      ctx.dealDamageToEnemy(state, enemy, {
        baseDamage: dmg,
        source,
        canCrit: false,
        canBackstab: false,
        statusId: hasJolted ? 'jolted' : undefined,
        patronId: 'voltaris',
      });
    }
  }

  ctx.spawnProjectile(state, {
    owner: 'player',
    ownerId: 'player',
    kind: 'lightning',
    pos: { x: center.x, y: center.y },
    vel: { x: 0, y: 0 },
    startPos: { x: center.x, y: center.y },
    radius: Math.round(radius * 0.45),
    angle: -Math.PI * 0.5,
    damage: 0,
    range: 10,
    maxLife: 0.22,
    pierceLeft: 99,
    bouncesLeft: 0,
    deflectable: false,
    deflected: false,
    homingStrength: 0,
    isLob: false,
    lobHeight: 0,
    lobDuration: 0,
    lobElapsed: 0,
    aoeRadius: radius,
    patronId: 'voltaris',
    colorHex: PATRON_CONSTANTS.voltaris.colorHex,
  });
}

function triggerTidebreakerSplash(
  state: SimState,
  center: Vec2,
  pushOrigin: Vec2,
  damage: number,
  knockback: number,
  radius: number,
  source: 'status' | 'dash' | 'call',
  ctx: SimCombatContext,
  excludeEnemyId?: string
): void {
  const hasShoals = hasBoon(state, 'tidebreaker_razor_shoals');
  const seaStorm = getBoonById(state, 'duo_sea_storm');
  const rSq = radius * radius;

  for (const enemy of state.enemies) {
    if (!isLivingEnemy(enemy)) continue;
    if (distSq(center, enemy.pos) > rSq) continue;

    const angle = Math.atan2(enemy.pos.y - pushOrigin.y, enemy.pos.x - pushOrigin.x);
    if (enemy.id !== excludeEnemyId && damage > 0) {
      ctx.dealDamageToEnemy(state, enemy, {
        baseDamage: damage,
        source,
        angle,
        knockback,
        canCrit: false,
        canBackstab: false,
        statusId: hasShoals ? 'ruptured' : undefined,
        patronId: 'tidebreaker',
      });
    } else {
      // Apply knockback impulse & ruptured even on primary target
      const kbFactor = enemy.isBoss ? 0.15 : enemy.armor > 0 ? 0.4 : 1.0;
      enemy.vel.x += Math.cos(angle) * knockback * kbFactor;
      enemy.vel.y += Math.sin(angle) * knockback * kbFactor;
      if (hasShoals) {
        ctx.applyStatus(state, enemy, 'enemy', 'ruptured', 1, 'tidebreaker');
      }
    }

    if (seaStorm) {
      triggerVoltarisBoltStrike(
        state,
        enemy.pos,
        seaStorm.scaledValue,
        130,
        'status',
        ctx
      );
    }
  }

  ctx.spawnProjectile(state, {
    owner: 'player',
    ownerId: 'player',
    kind: 'wave',
    pos: { x: center.x, y: center.y },
    vel: { x: 0, y: 0 },
    startPos: { x: center.x, y: center.y },
    radius: Math.round(radius * 0.55),
    angle: state.player.facingAngle,
    damage: 0,
    range: 10,
    maxLife: 0.22,
    pierceLeft: 99,
    bouncesLeft: 0,
    deflectable: false,
    deflected: false,
    homingStrength: 0,
    isLob: false,
    lobHeight: 0,
    lobDuration: 0,
    lobElapsed: 0,
    aoeRadius: radius,
    patronId: 'tidebreaker',
    colorHex: PATRON_CONSTANTS.tidebreaker.colorHex,
  });
}

export function handleBoonOnAttackHit(
  state: SimState,
  enemy: EnemyState,
  source: 'attack' | 'special' | 'cast',
  damage: number,
  ctx: SimCombatContext
): void {
  const boon = getBoonInSlot(state, source);

  // Sweet Surrender: Weak-afflicted foes take bonus damage
  const sweetSurrender = getBoonById(state, 'velouris_sweet_surrender');
  if (
    sweetSurrender &&
    damage > 0 &&
    enemy.statuses.some((s) => s.id === 'weak')
  ) {
    const bonus = Math.max(2, Math.round(damage * sweetSurrender.scaledValue));
    ctx.dealDamageToEnemy(state, enemy, {
      baseDamage: bonus,
      source: 'status',
      canCrit: false,
      canBackstab: false,
      patronId: 'velouris',
    });
  }

  // Hydraulic Might: extra punch during first 10s of encounter
  const hydraulic = getBoonById(state, 'tidebreaker_hydraulic_might');
  if (
    hydraulic &&
    (source === 'attack' || source === 'special') &&
    state.room.encounterTimer <= 10 &&
    damage > 0
  ) {
    const bonus = Math.max(2, Math.round(damage * hydraulic.scaledValue));
    ctx.dealDamageToEnemy(state, enemy, {
      baseDamage: bonus,
      source: 'status',
      canCrit: false,
      canBackstab: false,
      patronId: 'tidebreaker',
    });
  }

  // Duo: Lightning Phalanx / Parting Shot on Cast
  if (source === 'cast') {
    const phalanx = getBoonById(state, 'duo_lightning_phalanx');
    if (phalanx) {
      triggerVoltarisChainLightning(state, enemy, phalanx.scaledValue, 3, ctx);
    }
    const parting = getBoonById(state, 'duo_parting_shot');
    if (parting) {
      ctx.applyStatus(state, enemy, 'enemy', 'exposed', 1, 'aegira');
      ctx.applyStatus(state, enemy, 'enemy', 'weak', 1, 'velouris');
    }
  }

  if (!boon) return;

  switch (boon.patronId) {
    case 'voltaris': {
      if (source === 'attack' || source === 'cast') {
        const bounces = Math.round(boon.secondaryValue ?? 4);
        const chainDmg =
          source === 'cast'
            ? Math.round(boon.scaledValue * 0.5)
            : Math.round(boon.scaledValue);
        triggerVoltarisChainLightning(state, enemy, chainDmg, bounces, ctx);
      } else if (source === 'special') {
        triggerVoltarisBoltStrike(
          state,
          enemy.pos,
          boon.scaledValue,
          boon.secondaryValue ?? 180,
          'status',
          ctx
        );
      }
      break;
    }
    case 'tidebreaker': {
      const kb = boon.secondaryValue ?? 680;
      const splashDmg =
        source === 'cast'
          ? Math.round(boon.scaledValue * 0.45)
          : Math.max(8, Math.round(damage * 0.25));
      triggerTidebreakerSplash(
        state,
        enemy.pos,
        state.player.pos,
        splashDmg,
        kb,
        source === 'special' ? 175 : 145,
        'status',
        ctx,
        enemy.id
      );
      break;
    }
    case 'aegira': {
      const hasFlash = hasBoon(state, 'aegira_blinding_flash');
      if (hasFlash) {
        ctx.applyStatus(state, enemy, 'enemy', 'exposed', 1, 'aegira');
      }
      const radius = source === 'special' ? 310 : source === 'cast' ? 230 : 210;
      deflectProjectilesInRadius(state, state.player.pos, radius, hasFlash, ctx);
      if (source === 'cast') {
        deflectProjectilesInRadius(state, enemy.pos, 200, hasFlash, ctx);
      }
      break;
    }
    case 'velouris': {
      ctx.applyStatus(state, enemy, 'enemy', 'weak', 1, 'velouris');
      const emptyInside = getBoonById(state, 'velouris_empty_inside');
      if (emptyInside) {
        const weakStatus = enemy.statuses.find((s) => s.id === 'weak');
        if (weakStatus) {
          weakStatus.remaining = Math.max(
            weakStatus.remaining,
            COMBAT_CONSTANTS.statusDefaults.weak.duration + emptyInside.scaledValue
          );
        }
      }
      break;
    }
    case 'sylvara': {
      ctx.applyStatus(state, enemy, 'enemy', 'marked', 1, 'sylvara');
      break;
    }
    case 'bellum': {
      ctx.applyStatus(state, enemy, 'enemy', 'doom', 1, 'bellum');
      break;
    }
    case 'bacchion': {
      ctx.applyStatus(state, enemy, 'enemy', 'hangover', 1, 'bacchion');
      break;
    }
    case 'glaciera': {
      ctx.applyStatus(state, enemy, 'enemy', 'chill', 1, 'glaciera');
      break;
    }
    default:
      break;
  }
}

export function handleBoonOnDash(
  state: SimState,
  startPos: Vec2,
  endPos: Vec2,
  perfect: boolean,
  ctx: SimCombatContext
): void {
  // Ruthless Reflex (Mirror side B): Near-miss perfect dash grants +50% damage buff for 2s
  if (perfect) {
    const reflex = getEffectiveMirrorUpgrade(state.meta, state.run.vows, 'greater_reflex');
    if (reflex.side === 'b' && reflex.rank > 0) {
      state.player.eruptBuffTimer = Math.max(state.player.eruptBuffTimer, 2.0);
    }
  }

  const dashBoon = getBoonInSlot(state, 'dash');
  if (!dashBoon) return;

  switch (dashBoon.patronId) {
    case 'voltaris': {
      triggerVoltarisBoltStrike(
        state,
        startPos,
        dashBoon.scaledValue,
        dashBoon.secondaryValue ?? 210,
        'dash',
        ctx
      );
      ctx.addCameraShake(state, 3, 0.08);
      break;
    }
    case 'tidebreaker': {
      triggerTidebreakerSplash(
        state,
        endPos,
        startPos,
        dashBoon.scaledValue,
        dashBoon.secondaryValue ?? 620,
        220,
        'dash',
        ctx
      );
      ctx.addCameraShake(state, 4, 0.1);
      break;
    }
    case 'aegira': {
      const hasFlash = hasBoon(state, 'aegira_blinding_flash');
      const radius = dashBoon.secondaryValue ?? 195;
      deflectProjectilesInRadius(state, startPos, radius, hasFlash, ctx);
      deflectProjectilesInRadius(state, endPos, radius, hasFlash, ctx);
      const rSq = radius * radius;
      for (const enemy of state.enemies) {
        if (!isLivingEnemy(enemy)) continue;
        if (distSq(endPos, enemy.pos) <= rSq) {
          ctx.dealDamageToEnemy(state, enemy, {
            baseDamage: dashBoon.scaledValue,
            source: 'dash',
            canCrit: false,
            canBackstab: false,
            statusId: hasFlash ? 'exposed' : undefined,
            patronId: 'aegira',
          });
        }
      }
      break;
    }
    case 'velouris': {
      const radius = dashBoon.secondaryValue ?? 220;
      const rSq = radius * radius;
      for (const enemy of state.enemies) {
        if (!isLivingEnemy(enemy)) continue;
        if (distSq(endPos, enemy.pos) <= rSq) {
          ctx.dealDamageToEnemy(state, enemy, {
            baseDamage: dashBoon.scaledValue,
            source: 'dash',
            canCrit: false,
            canBackstab: false,
            statusId: 'weak',
            patronId: 'velouris',
          });
        }
      }
      break;
    }
    case 'bellum': {
      ctx.spawnProjectile(state, {
        owner: 'player',
        ownerId: 'player',
        kind: 'blade_rift',
        pos: { x: startPos.x, y: startPos.y },
        vel: { x: 0, y: 0 },
        startPos: { x: startPos.x, y: startPos.y },
        radius: 65,
        angle: state.player.facingAngle,
        damage: dashBoon.scaledValue,
        range: 100,
        maxLife: 0.9,
        pierceLeft: 99,
        bouncesLeft: 0,
        deflectable: false,
        deflected: false,
        homingStrength: 0,
        isLob: false,
        lobHeight: 0,
        lobDuration: 0,
        lobElapsed: 0,
        aoeRadius: 95,
        patronId: 'bellum',
        colorHex: PATRON_CONSTANTS.bellum.colorHex,
      });
      break;
    }
    default:
      break;
  }
}

export function handleBoonOnGodCall(
  state: SimState,
  patronId: PatronId,
  greater: boolean,
  ctx: SimCombatContext
): void {
  const callBoon = getBoonInSlot(state, 'call');
  const activePatron: PatronId = callBoon?.patronId ?? patronId;
  const rt = getGodCallRuntime(state);
  rt.greater = greater;
  rt.pulseAccumulator = 0;

  let duration = greater ? 5.0 : 1.5;

  if (activePatron === 'voltaris') {
    duration = greater ? 5.5 : 1.5;
    const dmg = callBoon?.scaledValue ?? 60;
    const initialStrikes = greater ? 6 : 3;
    const living = state.enemies.filter(isLivingEnemy);
    for (let i = 0; i < initialStrikes && living.length > 0; i++) {
      const target = living[i % living.length];
      triggerVoltarisBoltStrike(state, target.pos, dmg, 170, 'call', ctx);
    }
  } else if (activePatron === 'tidebreaker') {
    duration = greater ? 4.8 : 1.4;
    state.player.iframeTimer = Math.max(state.player.iframeTimer, duration);
    const dmg = callBoon?.scaledValue ?? 220;
    triggerTidebreakerSplash(
      state,
      state.player.pos,
      state.player.pos,
      dmg,
      900,
      270,
      'call',
      ctx
    );
  } else if (activePatron === 'aegira') {
    const baseDur = callBoon?.scaledValue ?? 1.5;
    duration = greater ? Math.max(6.0, baseDur * 3.5) : baseDur;
    state.player.iframeTimer = Math.max(state.player.iframeTimer, duration);
    const hasFlash = hasBoon(state, 'aegira_blinding_flash');
    deflectProjectilesInRadius(state, state.player.pos, 380, hasFlash, ctx);
    const burstDmg = greater ? 240 : (callBoon?.secondaryValue ?? 90);
    for (const enemy of state.enemies) {
      if (!isLivingEnemy(enemy)) continue;
      if (distSq(state.player.pos, enemy.pos) <= 340 * 340) {
        ctx.dealDamageToEnemy(state, enemy, {
          baseDamage: burstDmg,
          source: 'call',
          canCrit: false,
          canBackstab: false,
          statusId: hasFlash ? 'exposed' : undefined,
          patronId: 'aegira',
        });
      }
    }
  } else if (activePatron === 'velouris') {
    duration = greater ? 1.2 : 0.6;
    const living = state.enemies.filter(isLivingEnemy);
    // Target nearest enemy (prefer boss if present)
    let target: EnemyState | null = null;
    let bestScore = Infinity;
    for (const e of living) {
      const d = Math.sqrt(distSq(state.player.pos, e.pos));
      const score = e.isBoss ? d * 0.4 : d;
      if (score < bestScore) {
        bestScore = score;
        target = e;
      }
    }
    const burstDamage = greater
      ? (callBoon?.secondaryValue ?? 2500)
      : (callBoon?.scaledValue ?? 240);

    if (target) {
      const angle = Math.atan2(
        target.pos.y - state.player.pos.y,
        target.pos.x - state.player.pos.x
      );
      ctx.dealDamageToEnemy(state, target, {
        baseDamage: burstDamage,
        source: 'call',
        angle,
        canCrit: false,
        canBackstab: false,
        statusId: 'weak',
        patronId: 'velouris',
      });
      target.stunTimer = Math.max(target.stunTimer, greater ? 2.5 : 1.4);
      ctx.spawnProjectile(state, {
        owner: 'player',
        ownerId: 'player',
        kind: 'orb',
        pos: { x: state.player.pos.x, y: state.player.pos.y },
        vel: { x: Math.cos(angle) * 1400, y: Math.sin(angle) * 1400 },
        startPos: { x: state.player.pos.x, y: state.player.pos.y },
        radius: greater ? 34 : 22,
        angle,
        damage: 0,
        range: 900,
        maxLife: 0.35,
        pierceLeft: 1,
        bouncesLeft: 0,
        deflectable: false,
        deflected: false,
        homingStrength: 8,
        isLob: false,
        lobHeight: 0,
        lobDuration: 0,
        lobElapsed: 0,
        patronId: 'velouris',
        colorHex: PATRON_CONSTANTS.velouris.colorHex,
      });
    }
  }

  state.player.godCallPatron = activePatron;
  state.player.godCallActiveTimer = Math.max(state.player.godCallActiveTimer, duration);
  rt.lastSeenTimer = state.player.godCallActiveTimer;

  if (greater) {
    state.player.greaterCallSlowTimer = Math.max(
      state.player.greaterCallSlowTimer,
      PLAYER_CONSTANTS.greaterCallSlowDuration
    );
    ctx.triggerHitstop(state, 0.06, PLAYER_CONSTANTS.greaterCallSlowScale);
    ctx.addCameraShake(state, 12, 0.35);
    state.events.push({
      type: 'ui_toast',
      text: `GREATER CALL — ${PATRON_CONSTANTS[activePatron].displayName.toUpperCase()}!`,
      colorHex: PATRON_CONSTANTS[activePatron].colorHex,
    });
  } else {
    ctx.addCameraShake(state, 7, 0.2);
  }

  state.events.push({
    type: 'god_call',
    patronId: activePatron,
    greater,
    pos: { x: state.player.pos.x, y: state.player.pos.y },
  });
}

export function tickBoons(
  state: SimState,
  dt: number,
  ctx: SimCombatContext
): void {
  // Duo: Smoldering Air auto-charges God Gauge up to 25% during combat
  const smoldering = getBoonById(state, 'duo_smoldering_air');
  if (smoldering && !state.room.cleared && state.room.combatStarted) {
    const cap = PLAYER_CONSTANTS.godGaugeMax / PLAYER_CONSTANTS.godGaugeBars;
    if (state.player.godGauge < cap) {
      state.player.godGauge = Math.min(
        cap,
        state.player.godGauge + smoldering.scaledValue * dt
      );
    }
  }

  const player = state.player;
  if (player.godCallActiveTimer <= 0 || !player.godCallPatron) {
    return;
  }

  const rt = getGodCallRuntime(state);
  // Avoid double-decrementing if simcore already ticked godCallActiveTimer
  if (Math.abs(player.godCallActiveTimer - rt.lastSeenTimer) < 1e-6) {
    player.godCallActiveTimer = Math.max(0, player.godCallActiveTimer - dt);
  }
  rt.lastSeenTimer = player.godCallActiveTimer;
  rt.pulseAccumulator += dt;

  const patron = player.godCallPatron;
  const callBoon = getBoonInSlot(state, 'call');

  if (patron === 'voltaris') {
    const interval = rt.greater ? 0.18 : 0.24;
    if (rt.pulseAccumulator >= interval) {
      rt.pulseAccumulator -= interval;
      const living = state.enemies.filter(isLivingEnemy);
      if (living.length > 0) {
        const target = detPick(state, living, ctx);
        triggerVoltarisBoltStrike(
          state,
          target.pos,
          callBoon?.scaledValue ?? 60,
          175,
          'call',
          ctx
        );
      }
    }
  } else if (patron === 'tidebreaker') {
    player.iframeTimer = Math.max(player.iframeTimer, 0.12);
    if (rt.pulseAccumulator >= 0.24) {
      rt.pulseAccumulator -= 0.24;
      triggerTidebreakerSplash(
        state,
        player.pos,
        player.pos,
        Math.round((callBoon?.scaledValue ?? 220) * 0.65),
        860,
        195,
        'call',
        ctx
      );
    }
  } else if (patron === 'aegira') {
    player.iframeTimer = Math.max(player.iframeTimer, 0.12);
    const hasFlash = hasBoon(state, 'aegira_blinding_flash');
    deflectProjectilesInRadius(state, player.pos, 230, hasFlash, ctx);
    if (rt.pulseAccumulator >= 0.35) {
      rt.pulseAccumulator -= 0.35;
      for (const enemy of state.enemies) {
        if (!isLivingEnemy(enemy)) continue;
        if (distSq(player.pos, enemy.pos) <= 210 * 210) {
          ctx.dealDamageToEnemy(state, enemy, {
            baseDamage: 45,
            source: 'call',
            canCrit: false,
            canBackstab: false,
            statusId: hasFlash ? 'exposed' : undefined,
            patronId: 'aegira',
          });
        }
      }
    }
  }

  if (player.godCallActiveTimer <= 0) {
    player.godCallPatron = null;
  }
}

export function getBoonCatalogCount(): number {
  return Object.keys(BOON_CATALOG_BY_ID).length;
}
