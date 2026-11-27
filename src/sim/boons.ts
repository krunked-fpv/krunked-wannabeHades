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
  type ChaosCurse,
  type EnemyState,
  type HammerId,
  type PatronId,
  type SimState,
  type Vec2,
} from '../contracts/index.js';
import {
  BOON_CATALOG,
  BOON_CATALOG_BY_ID,
  CHAOS_CURSE_TEMPLATES,
  CORE_BOON_SLOTS,
  STANDARD_PATRONS,
  WELL_OF_ASH_ITEMS,
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
  getHealingMultiplier,
  getKeepsakeRank,
  getShopPriceMultiplier,
  getWellBonusEncounters,
  type RngProvider,
  type SimCombatContext,
} from './meta.js';

// ============================================================================
// Internal Runtime Trackers (WeakMap keeps SimState 100% pure & serializable)
// ============================================================================

interface BoonRuntimeState {
  lastSeenCallTimer: number;
  greaterCall: boolean;
  callPulseAcc: number;
  deadlyReversalTimer: number;
  vengefulMoodAcc: number;
  lightningRodAcc: number;
  killingFreezeAcc: number;
  hyperSprintTimer: number;
  /** Pending Chaos curses generated for the active pendingOffer */
  pendingChaosMap: Map<string, ChaosCurse>;
  /** Pending Well-of-Ash gold costs for active offer */
  pendingWellCostMap: Map<string, number>;
  /** Temporary Well of Ash encounter buffs */
  wellBuffs: Array<{
    effectKind: 'heal' | 'attack_buff' | 'special_buff' | 'cast_buff';
    magnitude: number;
    encountersLeft: number;
  }>;
  /** Permanent Strong Drink fountain damage stacks */
  strongDrinkStacks: number;
}

const boonRuntimeMap = new WeakMap<SimState, BoonRuntimeState>();

function getBoonRuntime(state: SimState): BoonRuntimeState {
  let rt = boonRuntimeMap.get(state);
  if (!rt) {
    rt = {
      lastSeenCallTimer: 0,
      greaterCall: false,
      callPulseAcc: 0,
      deadlyReversalTimer: 0,
      vengefulMoodAcc: 0,
      lightningRodAcc: 0,
      killingFreezeAcc: 0,
      hyperSprintTimer: 0,
      pendingChaosMap: new Map(),
      pendingWellCostMap: new Map(),
      wellBuffs: [],
      strongDrinkStacks: 0,
    };
    boonRuntimeMap.set(state, rt);
  }
  return rt;
}

export function onChamberEnteredBoons(state: SimState): void {
  const rt = getBoonRuntime(state);

  // Veloce Side Hustle (+Gold on every chamber entry)
  const sideHustle = getBoonById(state, 'veloce_side_hustle');
  if (sideHustle && !state.player.chaosCurses.some((c) => c.curseKind === 'no_gold_gain')) {
    const gain = Math.round(sideHustle.scaledValue);
    state.player.gold += gain;
  }

  // Well of Ash encounter buffs tick down
  for (let i = rt.wellBuffs.length - 1; i >= 0; i--) {
    const buff = rt.wellBuffs[i];
    if (buff.effectKind === 'heal') {
      const heal = Math.round(10 * getHealingMultiplier(state.run.vows));
      if (heal > 0) {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
      }
    }
    buff.encountersLeft -= 1;
    if (buff.encountersLeft <= 0) {
      rt.wellBuffs.splice(i, 1);
    }
  }
}

export function onChamberClearedBoons(state: SimState): void {
  // Bacchion After Party: restore up to 35%+ HP after clearing any combat encounter
  const afterParty = getBoonById(state, 'bacchion_after_party');
  if (afterParty && !state.player.isDead) {
    const targetHp = Math.round(state.player.maxHp * afterParty.scaledValue);
    if (state.player.hp < targetHp) {
      const gain = Math.round(
        (targetHp - state.player.hp) * getHealingMultiplier(state.run.vows)
      );
      if (gain > 0) {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + gain);
        state.events.push({
          type: 'ui_toast',
          text: `After Party restored +${gain} HP!`,
          colorHex: PATRON_CONSTANTS.bacchion.colorHex,
        });
      }
    }
  }
}

export function onFountainUsedBoons(state: SimState): boolean {
  const strongDrink = getBoonById(state, 'bacchion_strong_drink');
  if (!strongDrink) return false;
  const rt = getBoonRuntime(state);
  rt.strongDrinkStacks += 1;
  state.player.hp = state.player.maxHp;
  state.events.push({
    type: 'ui_toast',
    text: `Strong Drink: Full HP & +${Math.round(strongDrink.scaledValue * 100 * rt.strongDrinkStacks)}% Damage!`,
    colorHex: PATRON_CONSTANTS.bacchion.colorHex,
  });
  return true;
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
// Boon, Chaos, Pom, Hammer, Well of Ash & Underworld Customs Offer Generators
// ============================================================================

export function generateChaosOffer(
  state: SimState,
  ctx?: RngProvider,
  excludeIds?: ReadonlySet<string>
): BoonOffer {
  const targetCount = getOfferOptionCount(state);
  const rt = getBoonRuntime(state);
  rt.pendingChaosMap.clear();

  const chaosEntries = getBoonsForPatron('abyssos').filter((e) => !excludeIds?.has(e.id));
  const pool = chaosEntries.length > 0 ? [...chaosEntries] : [...getBoonsForPatron('abyssos')];
  const options: BoonOfferOption[] = [];

  if (!state.run.seenPatrons.includes('abyssos')) {
    state.run.seenPatrons.push('abyssos');
  }

  while (options.length < targetCount && pool.length > 0) {
    const idx = detNextInt(state, 0, pool.length - 1, ctx);
    const entry = pool.splice(idx, 1)[0];
    const curseTpl = detPick(state, CHAOS_CURSE_TEMPLATES, ctx);
    const encounters = detNextInt(
      state,
      curseTpl.minEncounters,
      curseTpl.maxEncounters,
      ctx
    );
    const rarity = rollBoonRarity(state, 'abyssos', ctx);
    const blessing = instantiateBoon(entry, rarity, 1);
    const optId = `chaos_${entry.id}_${state.tick}_${options.length}`;
    const curseDesc = curseTpl.description.replace('{n}', String(encounters));

    const curseObj: ChaosCurse = {
      id: optId,
      curseKind: curseTpl.curseKind,
      curseMagnitude: curseTpl.magnitude,
      encountersRemaining: encounters,
      blessingBoon: blessing,
    };
    rt.pendingChaosMap.set(optId, curseObj);

    const previewVal = formatBoonValue(blessing.scaledValue, entry.valueFormat);
    options.push({
      id: optId,
      kind: 'chaos_blessing',
      name: `${curseTpl.label} -> ${blessing.name}`,
      description: `After ${encounters} encounters: ${blessing.description}`,
      rarity,
      patronId: 'abyssos',
      slot: 'chaos',
      boonId: entry.id,
      previewValue: entry.valueFormat === 'percent' ? `+${previewVal}` : `+${previewVal}`,
      curseDescription: curseDesc,
      curseEncounters: encounters,
    });
  }

  const offer: BoonOffer = {
    source: 'chaos',
    patronId: 'abyssos',
    title: 'Abyssos, Primordial Void',
    subtitle: 'Endure a Void Curse to Awaken Immense Power',
    options,
    rerollsRemaining: state.run.boonRerolls,
  };
  state.run.pendingOffer = offer;
  state.events.push({ type: 'boon_offered', offer });
  return offer;
}

export function generateWellOfAshOffer(
  state: SimState,
  ctx?: RngProvider,
  hasLoyaltyCard = false
): BoonOffer {
  const targetCount = getOfferOptionCount(state);
  const rt = getBoonRuntime(state);
  rt.pendingWellCostMap.clear();

  const priceMult = getShopPriceMultiplier(state.run.vows, hasLoyaltyCard);
  const bonusEnc = getWellBonusEncounters(state);
  const pool = [...WELL_OF_ASH_ITEMS];
  const options: BoonOfferOption[] = [];

  while (options.length < targetCount && pool.length > 0) {
    const idx = detNextInt(state, 0, pool.length - 1, ctx);
    const item = pool.splice(idx, 1)[0];
    const cost = Math.round(item.costGold * priceMult);
    const totalEnc = item.baseEncounters + (item.effectKind === 'defiance_refill' ? 0 : bonusEnc);
    rt.pendingWellCostMap.set(item.id, cost);

    options.push({
      id: item.id,
      kind: 'well_item',
      name: `${item.name} (${cost}g)`,
      description: item.description.replace('{n}', String(totalEnc)),
      rarity: item.effectKind === 'defiance_refill' ? 'epic' : 'rare',
      previewValue: `${cost} Gold`,
    });
  }

  const offer: BoonOffer = {
    source: 'well',
    title: 'Well of Ash',
    subtitle: 'Purchase Temporary Underworld Provisions',
    options,
    rerollsRemaining: state.run.boonRerolls,
  };
  state.run.pendingOffer = offer;
  state.events.push({ type: 'boon_offered', offer });
  return offer;
}

export function generateUnderworldCustomsPurgeOffer(
  state: SimState,
  ctx?: RngProvider
): BoonOffer | null {
  if (state.player.boons.length === 0) return null;
  const pool = [...state.player.boons];
  const options: BoonOfferOption[] = [];

  while (options.length < 3 && pool.length > 0) {
    const idx = detNextInt(state, 0, pool.length - 1, ctx);
    const boon = pool.splice(idx, 1)[0];
    options.push({
      id: `purge_${boon.id}`,
      kind: 'well_item',
      name: `Purge ${boon.name} (+55g)`,
      description: `Sacrifice ${boon.name} to satisfy Underworld Customs and claim +55 Gold.`,
      rarity: boon.rarity,
      patronId: boon.patronId,
      boonId: boon.id,
      previewValue: '+55 Gold',
    });
  }

  const offer: BoonOffer = {
    source: 'well',
    title: 'Pool of Purging (Underworld Customs)',
    subtitle: 'Purge 1 Blessing before entering the next Biome',
    options,
    rerollsRemaining: 0,
  };
  state.run.pendingOffer = offer;
  state.events.push({ type: 'boon_offered', offer });
  return offer;
}

export function generateBoonOffer(
  state: SimState,
  patronId?: PatronId,
  ctx?: RngProvider,
  excludeIds?: ReadonlySet<string>
): BoonOffer {
  if (patronId === 'abyssos') {
    return generateChaosOffer(state, ctx, excludeIds);
  }

  let chosenPatron: PatronId = patronId ?? detPick(state, STANDARD_PATRONS, ctx);
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
        candidates.push({ entry, replaces: existing, weight: 1.3 });
      }
    } else if (entry.slot === 'duo') {
      const legacy = getEffectiveMirrorUpgrade(state.meta, state.run.vows, 'divine_pride');
      const duoWeight = 2.6 + (legacy.side === 'b' ? legacy.value * 25 : 0);
      candidates.push({ entry, weight: duoWeight });
    } else {
      candidates.push({ entry, weight: 2.5 });
    }
  }

  if (candidates.length < targetCount) {
    for (const entry of patronPool) {
      if (hasBoon(state, entry.id)) continue;
      if (candidates.some((c) => c.entry.id === entry.id)) continue;
      if (entry.slot === 'duo' && !isEntryEligible(state, entry)) continue;
      const existing = CORE_BOON_SLOTS.includes(entry.slot)
        ? getBoonInSlot(state, entry.slot)
        : undefined;
      if (existing && existing.patronId === chosenPatron) continue;
      candidates.push({ entry, replaces: existing, weight: 1 });
    }
  }

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
    const rarity: BoonRarity =
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
      patronId: c.entry.patronId,
      slot: c.entry.slot,
      boonId: c.entry.id,
      previewValue:
        c.entry.valueFormat === 'percent' ? `+${previewVal}` : previewVal,
      replacesBoonId: c.replaces?.id,
    };
  });

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
// Apply Selected Boon / Chaos / Well / Reroll / Direct Debug Grants
// ============================================================================

export function applySelectedBoon(
  state: SimState,
  optionIndex: number,
  _ctx?: RngProvider
): boolean {
  const offer = state.run.pendingOffer;
  if (!offer) return false;
  if (optionIndex < 0 || optionIndex >= offer.options.length) return false;

  const rt = getBoonRuntime(state);
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

    if (
      instance.id === 'veloce_greatest_reflex' ||
      instance.id === 'veloce_greater_evasion'
    ) {
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
  } else if (opt.kind === 'chaos_blessing') {
    let curse = rt.pendingChaosMap.get(opt.id);
    if (!curse && opt.boonId) {
      const entry = getBoonCatalogEntry(opt.boonId);
      if (entry) {
        curse = {
          id: opt.id,
          curseKind: 'extra_damage_taken',
          curseMagnitude: 0.35,
          encountersRemaining: opt.curseEncounters ?? 3,
          blessingBoon: instantiateBoon(entry, opt.rarity, 1),
        };
      }
    }
    if (curse) {
      state.player.chaosCurses.push(curse);
      state.events.push({
        type: 'boon_selected',
        optionId: opt.id,
        patronId: 'abyssos',
        rarity: opt.rarity,
      });
      state.events.push({
        type: 'ui_toast',
        text: `Void Pact sealed (${curse.encountersRemaining} rooms -> ${curse.blessingBoon.name})`,
        colorHex: PATRON_CONSTANTS.abyssos.colorHex,
      });
    }
    rt.pendingChaosMap.clear();
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
    if (opt.id.startsWith('purge_') && opt.boonId) {
      const idx = state.player.boons.findIndex((b) => b.id === opt.boonId);
      if (idx >= 0) {
        const purged = state.player.boons.splice(idx, 1)[0];
        state.player.gold += 55;
        state.events.push({
          type: 'ui_toast',
          text: `Purged ${purged.name} for +55 Gold`,
          colorHex: '#ffd942',
        });
      }
    } else if (opt.id === 'pom_vitality_fallback') {
      state.player.maxHp += 25;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
      state.player.gold += 60;
    } else if (opt.id === 'hammer_anvil_gold') {
      state.player.gold += 120;
    } else {
      const wellDef = WELL_OF_ASH_ITEMS.find((w) => w.id === opt.id);
      if (wellDef) {
        const cost = rt.pendingWellCostMap.get(wellDef.id) ?? wellDef.costGold;
        if (state.player.gold < cost) {
          state.events.push({
            type: 'ui_toast',
            text: `Need ${cost} Gold for ${wellDef.name}!`,
            colorHex: '#ff6666',
          });
          return false;
        }
        state.player.gold -= cost;
        const enc = wellDef.baseEncounters + getWellBonusEncounters(state);
        if (wellDef.effectKind === 'defiance_refill') {
          state.player.deathDefiances = Math.min(
            Math.max(1, state.player.maxDeathDefiances),
            state.player.deathDefiances + 1
          );
          state.events.push({
            type: 'ui_toast',
            text: 'Death Defiance replenished!',
            colorHex: '#ffd942',
          });
        } else {
          if (wellDef.effectKind === 'heal') {
            const gain = Math.round(
              state.player.maxHp *
                wellDef.magnitude *
                getHealingMultiplier(state.run.vows)
            );
            state.player.hp = Math.min(state.player.maxHp, state.player.hp + gain);
          }
          if (
            wellDef.effectKind === 'heal' ||
            wellDef.effectKind === 'attack_buff' ||
            wellDef.effectKind === 'special_buff' ||
            wellDef.effectKind === 'cast_buff'
          ) {
            rt.wellBuffs.push({
              effectKind: wellDef.effectKind,
              magnitude: wellDef.magnitude,
              encountersLeft: enc,
            });
          }
          state.events.push({
            type: 'ui_toast',
            text: `Purchased ${wellDef.name} (${enc} rooms)`,
            colorHex: '#c084fc',
          });
        }
      } else {
        state.player.gold += 90;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
      }
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
  if (offer.source === 'chaos') {
    generateChaosOffer(state, ctx, previousIds);
    return true;
  }
  if (offer.source === 'well') {
    generateWellOfAshOffer(state, ctx);
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
    entry =
      patronEntries.find(
        (e) =>
          CORE_BOON_SLOTS.includes(e.slot) &&
          !getBoonInSlot(state, e.slot) &&
          !hasBoon(state, e.id)
      ) ??
      patronEntries.find((e) => e.slot !== 'duo' && !hasBoon(state, e.id)) ??
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
  if (
    instance.id === 'veloce_greatest_reflex' ||
    instance.id === 'veloce_greater_evasion' ||
    instance.id === 'abyssos_vitality' ||
    instance.id === 'abyssos_grasp'
  ) {
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
// Live Combat Boon & Duo Hook Runners (ALL 10 Patrons + ALL 14 Duo Boons!)
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
      life: 0.75,
      maxLife: 0.75,
    });
    deflectedCount += 1;
  }

  if (deflectedCount > 0) {
    // Duo: Deadly Reversal (+20% Crit chance for 2.5s after deflecting)
    if (hasBoon(state, 'duo_deadly_reversal')) {
      getBoonRuntime(state).deadlyReversalTimer = 2.5;
    }
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

function spawnBladeRiftVortex(
  state: SimState,
  pos: Vec2,
  damagePerTick: number,
  baseDuration: number,
  baseRadius: number
): void {
  const blackMetal = getBoonById(state, 'bellum_black_metal');
  const huntingBlades = getBoonById(state, 'duo_hunting_blades');
  const radius = Math.round(
    baseRadius * (1 + (blackMetal ? blackMetal.scaledValue : 0))
  );
  const duration =
    baseDuration +
    (blackMetal ? 1.0 : 0) +
    (huntingBlades ? huntingBlades.scaledValue : 0);

  state.room.hazards.push({
    id: `rift_${state.tick}_${state.room.hazards.length}`,
    kind: 'rift_vortex',
    pos: { x: pos.x, y: pos.y },
    radius,
    active: true,
    armed: true,
    timer: duration,
    cooldown: 0.06,
    damage: Math.max(8, Math.round(damagePerTick)),
    owner: 'player',
  });
}

function spawnFrostCrystalPylon(
  state: SimState,
  pos: Vec2,
  damagePerTick: number,
  baseDuration: number
): void {
  const glare = getBoonById(state, 'glaciera_glacial_glare');
  const clarity = getBoonById(state, 'duo_crystal_clarity');
  const duration = baseDuration + (glare ? glare.scaledValue : 0);
  const dmg = Math.round(
    damagePerTick * (1 + (clarity ? clarity.scaledValue : 0))
  );

  state.room.hazards.push({
    id: `crystal_${state.tick}_${state.room.hazards.length}`,
    kind: 'pylon',
    pos: { x: pos.x, y: pos.y },
    radius: 26,
    active: true,
    armed: true,
    timer: duration,
    cooldown: 0.2,
    damage: Math.max(6, dmg),
    owner: 'player',
  });
}

function tryTriggerArcticBlast(
  state: SimState,
  enemy: EnemyState,
  ctx: SimCombatContext
): void {
  const arctic = getBoonById(state, 'glaciera_arctic_blast');
  if (!arctic) return;
  const chillIdx = enemy.statuses.findIndex((s) => s.id === 'chill');
  if (chillIdx < 0) return;
  if (enemy.statuses[chillIdx].stacks < COMBAT_CONSTANTS.statusDefaults.chill.maxStacks) {
    return;
  }

  enemy.statuses.splice(chillIdx, 1);
  ctx.dealDamageToEnemy(state, enemy, {
    baseDamage: arctic.scaledValue,
    source: 'status',
    canCrit: false,
    canBackstab: false,
    patronId: 'glaciera',
  });
  state.floatingNumbers.push({
    id: `fl_arctic_${state.tick}_${state.floatingNumbers.length}`,
    pos: { x: enemy.pos.x, y: enemy.pos.y - 34 },
    vel: { x: 0, y: -70 },
    value: 'SHATTER!',
    kind: 'status',
    colorHex: PATRON_CONSTANTS.glaciera.colorHex,
    life: 0.85,
    maxLife: 0.85,
  });
  ctx.addCameraShake(state, 5, 0.14);
}

function tryTriggerMercifulDoom(
  state: SimState,
  enemy: EnemyState,
  ctx: SimCombatContext
): void {
  const merciful = getBoonById(state, 'duo_merciful_doom');
  if (!merciful) return;
  const doomIdx = enemy.statuses.findIndex((s) => s.id === 'doom');
  if (doomIdx < 0) return;

  const doomSt = enemy.statuses[doomIdx];
  enemy.statuses.splice(doomIdx, 1);
  const dmg = Math.round(
    (doomSt.magnitude || COMBAT_CONSTANTS.statusDefaults.doom.baseDamage) +
      merciful.scaledValue
  );
  ctx.dealDamageToEnemy(state, enemy, {
    baseDamage: dmg,
    source: 'status',
    canCrit: false,
    canBackstab: false,
    patronId: 'bellum',
  });
  state.events.push({
    type: 'status_triggered',
    targetId: enemy.id,
    statusId: 'doom',
    pos: { x: enemy.pos.x, y: enemy.pos.y },
    damage: dmg,
  });
}

function fireSupportFireArrow(
  state: SimState,
  target: EnemyState,
  damage: number,
  ctx: SimCombatContext
): void {
  const angle = Math.atan2(
    target.pos.y - state.player.pos.y,
    target.pos.x - state.player.pos.x
  );
  ctx.spawnProjectile(state, {
    owner: 'player',
    ownerId: 'player',
    kind: 'arrow',
    pos: { x: state.player.pos.x, y: state.player.pos.y },
    vel: { x: Math.cos(angle) * 1050, y: Math.sin(angle) * 1050 },
    startPos: { x: state.player.pos.x, y: state.player.pos.y },
    radius: 10,
    angle,
    damage: Math.round(damage),
    range: 880,
    maxLife: 1.1,
    pierceLeft: 0,
    bouncesLeft: 0,
    deflectable: false,
    deflected: false,
    homingStrength: 7,
    isLob: false,
    lobHeight: 0,
    lobDuration: 0,
    lobElapsed: 0,
    patronId: 'sylvara',
    colorHex: PATRON_CONSTANTS.sylvara.colorHex,
  });
}

export function handleBoonOnAttackHit(
  state: SimState,
  enemy: EnemyState,
  source: 'attack' | 'special' | 'cast',
  damage: number,
  ctx: SimCombatContext
): void {
  const rt = getBoonRuntime(state);
  const boon = getBoonInSlot(state, source);

  // Well of Ash temporary weapon buffs + Strong Drink permanent fountain bonus
  let extraMult = 0;
  for (const wb of rt.wellBuffs) {
    if (
      (source === 'attack' && wb.effectKind === 'attack_buff') ||
      (source === 'special' && wb.effectKind === 'special_buff') ||
      (source === 'cast' && wb.effectKind === 'cast_buff')
    ) {
      extraMult += wb.magnitude;
    }
  }
  const strongDrink = getBoonById(state, 'bacchion_strong_drink');
  if (strongDrink && rt.strongDrinkStacks > 0) {
    extraMult += strongDrink.scaledValue * rt.strongDrinkStacks;
  }
  if (extraMult > 0 && damage > 0) {
    ctx.dealDamageToEnemy(state, enemy, {
      baseDamage: Math.max(2, Math.round(damage * extraMult)),
      source: 'status',
      canCrit: false,
      canBackstab: false,
    });
  }

  // Sylvara Support Fire: every attack/special/cast hit fires a homing arrow
  const supportFire = getBoonById(state, 'sylvara_support_fire');
  if (supportFire) {
    fireSupportFireArrow(state, enemy, supportFire.scaledValue, ctx);
  }

  // Sylvara Hunter's Mark: mark a different nearby enemy for +30% Crit
  if (hasBoon(state, 'sylvara_hunters_mark')) {
    let markTarget: EnemyState | null = null;
    let bestD = 380 * 380;
    for (const other of state.enemies) {
      if (other.id === enemy.id || !isLivingEnemy(other)) continue;
      const dSq = distSq(enemy.pos, other.pos);
      if (dSq < bestD) {
        bestD = dSq;
        markTarget = other;
      }
    }
    ctx.applyStatus(state, markTarget ?? enemy, 'enemy', 'marked', 1, 'sylvara');
  }

  // Duo: Heart Rend / Splitting Headache / Pressure Points / Deadly Reversal crit-echo bursts
  const pressure = getBoonById(state, 'sylvara_pressure_points');
  const headache = getBoonById(state, 'duo_splitting_headache');
  const heartRend = getBoonById(state, 'duo_heart_rend');
  let bonusCritChance = pressure ? pressure.scaledValue : 0;
  if (rt.deadlyReversalTimer > 0) {
    bonusCritChance += getBoonById(state, 'duo_deadly_reversal')?.scaledValue ?? 0.2;
  }
  if (headache) {
    const hang = enemy.statuses.find((s) => s.id === 'hangover');
    if (hang) {
      bonusCritChance += hang.stacks * headache.scaledValue;
    }
  }
  if (bonusCritChance > 0 && damage > 0 && detNextFloat(state, ctx) < bonusCritChance) {
    const isWeak = enemy.statuses.some((s) => s.id === 'weak');
    const rendBonus = heartRend && isWeak ? heartRend.scaledValue : 0;
    const critEcho = Math.max(8, Math.round(damage * (0.85 + rendBonus)));
    ctx.dealDamageToEnemy(state, enemy, {
      baseDamage: critEcho,
      source: 'status',
      canCrit: false,
      canBackstab: false,
      patronId: 'sylvara',
    });
  }

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

  // Cast Duo Triggers: Lightning Phalanx / Parting Shot / Blizzard Shot
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
    const blizzard = getBoonById(state, 'duo_blizzard_shot');
    if (blizzard) {
      for (let k = 0; k < 6; k++) {
        const ang = (Math.PI * 2 * k) / 6;
        ctx.spawnProjectile(state, {
          owner: 'player',
          ownerId: 'player',
          kind: 'dart',
          pos: { x: enemy.pos.x, y: enemy.pos.y },
          vel: { x: Math.cos(ang) * 760, y: Math.sin(ang) * 760 },
          startPos: { x: enemy.pos.x, y: enemy.pos.y },
          radius: 11,
          angle: ang,
          damage: Math.round(blizzard.scaledValue),
          range: 420,
          maxLife: 0.65,
          pierceLeft: 2,
          bouncesLeft: 0,
          deflectable: false,
          deflected: false,
          homingStrength: 0,
          isLob: false,
          lobHeight: 0,
          lobDuration: 0,
          lobElapsed: 0,
          patronId: 'glaciera',
          statusToApply: 'chill',
          colorHex: PATRON_CONSTANTS.glaciera.colorHex,
        });
      }
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
      tryTriggerMercifulDoom(state, enemy, ctx);
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
      if (source === 'cast') {
        spawnBladeRiftVortex(
          state,
          enemy.pos,
          boon.scaledValue,
          boon.secondaryValue ?? 4.0,
          98
        );
      } else {
        ctx.applyStatus(state, enemy, 'enemy', 'doom', 1, 'bellum');
        const doomSt = enemy.statuses.find((s) => s.id === 'doom');
        if (doomSt) {
          const dire = getBoonById(state, 'bellum_dire_misfortune');
          const impending = getBoonById(state, 'bellum_impending_doom');
          const baseDoom =
            boon.scaledValue +
            (dire ? Math.max(0, doomSt.stacks - 1) * dire.scaledValue : 0);
          doomSt.magnitude = Math.round(
            baseDoom * (1 + (impending ? impending.scaledValue : 0))
          );
          if (impending && doomSt.stacks === 1) {
            doomSt.remaining = COMBAT_CONSTANTS.statusDefaults.doom.delay + 0.5;
          }
        }
      }
      break;
    }
    case 'bacchion': {
      if (source === 'cast') {
        // Festive Fog blast + stun + Ice Wine synergy
        const iceWine = getBoonById(state, 'duo_ice_wine');
        const fogRadius = boon.secondaryValue ?? 210;
        const fogDmg = Math.round(
          boon.scaledValue * (1 + (iceWine ? iceWine.scaledValue : 0))
        );
        for (const other of state.enemies) {
          if (!isLivingEnemy(other)) continue;
          if (distSq(enemy.pos, other.pos) <= fogRadius * fogRadius) {
            if (other.id !== enemy.id) {
              ctx.dealDamageToEnemy(state, other, {
                baseDamage: fogDmg,
                source: 'status',
                canCrit: false,
                canBackstab: false,
                statusId: iceWine ? 'chill' : 'hangover',
                patronId: 'bacchion',
              });
            } else if (iceWine) {
              ctx.applyStatus(state, other, 'enemy', 'chill', 2, 'glaciera');
            }
            if (!other.isBoss) {
              other.stunTimer = Math.max(other.stunTimer, 0.9);
            }
          }
        }
        ctx.addCameraShake(state, 6, 0.16);
      } else {
        ctx.applyStatus(state, enemy, 'enemy', 'hangover', 1, 'bacchion');
        const hang = enemy.statuses.find((s) => s.id === 'hangover');
        if (hang) {
          hang.magnitude = Math.max(hang.magnitude, boon.scaledValue);
        }
      }
      break;
    }
    case 'glaciera': {
      if (source === 'cast') {
        spawnFrostCrystalPylon(
          state,
          {
            x: (state.player.pos.x + enemy.pos.x) * 0.5,
            y: (state.player.pos.y + enemy.pos.y) * 0.5,
          },
          boon.scaledValue,
          boon.secondaryValue ?? 4.5
        );
      }
      ctx.applyStatus(state, enemy, 'enemy', 'chill', 1, 'glaciera');
      tryTriggerArcticBlast(state, enemy, ctx);
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
  // Chaos Curse: take_damage_on_dash
  for (const c of state.player.chaosCurses) {
    if (c.curseKind === 'take_damage_on_dash') {
      ctx.dealDamageToPlayer(state, Math.max(1, c.curseMagnitude), {
        source: 'chaos',
        ignoreIframes: true,
        canDodge: false,
      });
    }
  }

  // Ruthless Reflex (Mirror side B): Near-miss perfect dash grants +50% buff
  if (perfect) {
    const reflex = getEffectiveMirrorUpgrade(state.meta, state.run.vows, 'greater_reflex');
    if (reflex.side === 'b' && reflex.rank > 0) {
      state.player.eruptBuffTimer = Math.max(state.player.eruptBuffTimer, 2.0);
    }
  }

  // Veloce Hyper Sprint: post-dash speed + brief Sturdy surge
  const hyperSprint = getBoonById(state, 'veloce_hyper_sprint');
  if (hyperSprint) {
    getBoonRuntime(state).hyperSprintTimer = hyperSprint.scaledValue;
    state.player.eruptBuffTimer = Math.max(
      state.player.eruptBuffTimer,
      hyperSprint.scaledValue
    );
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
          tryTriggerMercifulDoom(state, enemy, ctx);
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
    case 'sylvara': {
      // Hunter Dash empowers the upcoming Dash-Strike!
      state.player.empoweredAttacks = Math.max(state.player.empoweredAttacks, 1);
      break;
    }
    case 'bellum': {
      spawnBladeRiftVortex(
        state,
        startPos,
        dashBoon.scaledValue,
        dashBoon.secondaryValue ?? 1.4,
        84
      );
      break;
    }
    case 'bacchion': {
      const radius = dashBoon.secondaryValue ?? 195;
      const rSq = radius * radius;
      for (const enemy of state.enemies) {
        if (!isLivingEnemy(enemy)) continue;
        if (distSq(startPos, enemy.pos) <= rSq) {
          ctx.applyStatus(state, enemy, 'enemy', 'hangover', 1, 'bacchion');
          const h = enemy.statuses.find((s) => s.id === 'hangover');
          if (h) h.magnitude = Math.max(h.magnitude, dashBoon.scaledValue);
        }
      }
      break;
    }
    case 'glaciera': {
      const radius = dashBoon.secondaryValue ?? 225;
      const rSq = radius * radius;
      for (const enemy of state.enemies) {
        if (!isLivingEnemy(enemy)) continue;
        if (distSq(endPos, enemy.pos) <= rSq) {
          ctx.dealDamageToEnemy(state, enemy, {
            baseDamage: dashBoon.scaledValue,
            source: 'dash',
            canCrit: false,
            canBackstab: false,
            statusId: 'chill',
            patronId: 'glaciera',
          });
          tryTriggerArcticBlast(state, enemy, ctx);
        }
      }
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
  const rt = getBoonRuntime(state);
  rt.greaterCall = greater;
  rt.callPulseAcc = 0;

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
  } else if (activePatron === 'sylvara') {
    duration = 1.0;
    const arrowCount = greater ? 12 : 5;
    const arrowDmg = callBoon?.scaledValue ?? 95;
    const living = state.enemies.filter(isLivingEnemy);
    for (let i = 0; i < arrowCount; i++) {
      const target = living.length > 0 ? living[i % living.length] : null;
      const ang = target
        ? Math.atan2(target.pos.y - state.player.pos.y, target.pos.x - state.player.pos.x) +
          (i - arrowCount * 0.5) * 0.12
        : state.player.facingAngle + (i - arrowCount * 0.5) * 0.25;
      ctx.spawnProjectile(state, {
        owner: 'player',
        ownerId: 'player',
        kind: 'arrow',
        pos: { x: state.player.pos.x, y: state.player.pos.y },
        vel: { x: Math.cos(ang) * 1300, y: Math.sin(ang) * 1300 },
        startPos: { x: state.player.pos.x, y: state.player.pos.y },
        radius: 13,
        angle: ang,
        damage: Math.round(arrowDmg),
        range: 1100,
        maxLife: 1.5,
        pierceLeft: 1,
        bouncesLeft: 0,
        deflectable: false,
        deflected: false,
        homingStrength: 10,
        isLob: false,
        lobHeight: 0,
        lobDuration: 0,
        lobElapsed: 0,
        critBonus: 0.35,
        patronId: 'sylvara',
        statusToApply: 'marked',
        colorHex: PATRON_CONSTANTS.sylvara.colorHex,
      });
    }
  } else if (activePatron === 'bellum') {
    duration = greater ? 5.0 : 1.5;
    state.player.iframeTimer = Math.max(state.player.iframeTimer, duration);
    spawnBladeRiftVortex(
      state,
      state.player.pos,
      callBoon?.scaledValue ?? 46,
      duration,
      greater ? 175 : 135
    );
  } else if (activePatron === 'bacchion') {
    duration = greater ? 6.0 : 2.0;
    for (const enemy of state.enemies) {
      if (!isLivingEnemy(enemy)) continue;
      if (distSq(state.player.pos, enemy.pos) <= 340 * 340) {
        ctx.applyStatus(state, enemy, 'enemy', 'hangover', 2, 'bacchion');
      }
    }
  } else if (activePatron === 'glaciera') {
    duration = greater ? 5.5 : 1.8;
    for (const enemy of state.enemies) {
      if (!isLivingEnemy(enemy)) continue;
      if (distSq(state.player.pos, enemy.pos) <= 340 * 340) {
        ctx.dealDamageToEnemy(state, enemy, {
          baseDamage: (callBoon?.scaledValue ?? 18) * 2,
          source: 'call',
          canCrit: false,
          canBackstab: false,
          statusId: 'chill',
          statusStacks: 2,
          patronId: 'glaciera',
        });
      }
    }
  }

  state.player.godCallPatron = activePatron;
  state.player.godCallActiveTimer = Math.max(state.player.godCallActiveTimer, duration);
  rt.lastSeenCallTimer = state.player.godCallActiveTimer;

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
  const rt = getBoonRuntime(state);

  if (rt.deadlyReversalTimer > 0) {
    rt.deadlyReversalTimer = Math.max(0, rt.deadlyReversalTimer - dt);
  }
  if (rt.hyperSprintTimer > 0) {
    rt.hyperSprintTimer = Math.max(0, rt.hyperSprintTimer - dt);
    state.player.vel.x *= 1 + Math.min(0.25, dt * 4);
    state.player.vel.y *= 1 + Math.min(0.25, dt * 4);
  }

  const inActiveCombat = !state.room.cleared && state.room.combatStarted;
  const livingEnemies = state.enemies.filter(isLivingEnemy);

  // Duo: Hunting Blades — steer active Bellum Blade Rifts toward nearest foe
  if (hasBoon(state, 'duo_hunting_blades') && livingEnemies.length > 0) {
    for (const h of state.room.hazards) {
      if (h.kind !== 'rift_vortex' || h.owner !== 'player' || !h.active) continue;
      let nearest = livingEnemies[0];
      let bestSq = distSq(h.pos, nearest.pos);
      for (let i = 1; i < livingEnemies.length; i++) {
        const dSq = distSq(h.pos, livingEnemies[i].pos);
        if (dSq < bestSq) {
          bestSq = dSq;
          nearest = livingEnemies[i];
        }
      }
      if (bestSq > 16) {
        const d = Math.sqrt(bestSq);
        h.pos.x += ((nearest.pos.x - h.pos.x) / d) * 240 * dt;
        h.pos.y += ((nearest.pos.y - h.pos.y) / d) * 240 * dt;
      }
    }
  }

  // Glaciera Crystal Beam Pylons (tick player-owned 'pylon' hazards)
  for (let i = state.room.hazards.length - 1; i >= 0; i--) {
    const h = state.room.hazards[i];
    if (h.kind !== 'pylon' || h.owner !== 'player') continue;
    h.timer -= dt;
    h.cooldown -= dt;
    if (h.cooldown <= 0 && livingEnemies.length > 0) {
      h.cooldown = 0.2;
      let nearest = livingEnemies[0];
      let bestSq = distSq(h.pos, nearest.pos);
      for (let j = 1; j < livingEnemies.length; j++) {
        const dSq = distSq(h.pos, livingEnemies[j].pos);
        if (dSq < bestSq) {
          bestSq = dSq;
          nearest = livingEnemies[j];
        }
      }
      if (bestSq <= 540 * 540) {
        const ang = Math.atan2(nearest.pos.y - h.pos.y, nearest.pos.x - h.pos.x);
        ctx.dealDamageToEnemy(state, nearest, {
          baseDamage: h.damage,
          source: 'status',
          angle: ang,
          canCrit: false,
          canBackstab: false,
          statusId: 'chill',
          patronId: 'glaciera',
        });
        tryTriggerArcticBlast(state, nearest, ctx);
        ctx.spawnProjectile(state, {
          owner: 'player',
          ownerId: 'player',
          kind: 'beam',
          pos: { x: h.pos.x, y: h.pos.y },
          vel: { x: Math.cos(ang) * 1400, y: Math.sin(ang) * 1400 },
          startPos: { x: h.pos.x, y: h.pos.y },
          radius: 8,
          angle: ang,
          damage: 0,
          range: Math.sqrt(bestSq),
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
          targetPos: { x: nearest.pos.x, y: nearest.pos.y },
          patronId: 'glaciera',
          colorHex: PATRON_CONSTANTS.glaciera.colorHex,
        });
      }
    }
    if (h.timer <= 0) {
      state.room.hazards.splice(i, 1);
    }
  }

  // Duo: Smoldering Air auto-charges God Gauge up to 25% during combat
  const smoldering = getBoonById(state, 'duo_smoldering_air');
  if (smoldering && inActiveCombat) {
    const cap = PLAYER_CONSTANTS.godGaugeMax / PLAYER_CONSTANTS.godGaugeBars;
    if (state.player.godGauge < cap) {
      state.player.godGauge = Math.min(
        cap,
        state.player.godGauge + smoldering.scaledValue * dt
      );
    }
  }

  // Duo: Lightning Rod — dropped floor Bloodstones zap nearby foes every 1.0s
  const lightningRod = getBoonById(state, 'duo_lightning_rod');
  if (lightningRod && state.room.bloodstones.length > 0 && livingEnemies.length > 0) {
    rt.lightningRodAcc += dt;
    if (rt.lightningRodAcc >= 1.0) {
      rt.lightningRodAcc -= 1.0;
      for (const bs of state.room.bloodstones) {
        triggerVoltarisBoltStrike(
          state,
          bs.pos,
          lightningRod.scaledValue,
          200,
          'status',
          ctx
        );
      }
    }
  }

  // Duo: Vengeful Mood — automatic thunder-slaughter pulse every 3.0s
  const vengefulMood = getBoonById(state, 'duo_vengeful_mood');
  if (vengefulMood && inActiveCombat && livingEnemies.length > 0) {
    rt.vengefulMoodAcc += dt;
    if (rt.vengefulMoodAcc >= 3.0) {
      rt.vengefulMoodAcc -= 3.0;
      triggerVoltarisBoltStrike(
        state,
        state.player.pos,
        vengefulMood.scaledValue,
        280,
        'status',
        ctx
      );
    }
  }

  // Glaciera Killing Freeze — decay damage when ALL living enemies are Chilled
  const killingFreeze = getBoonById(state, 'glaciera_killing_freeze');
  if (killingFreeze && livingEnemies.length > 0) {
    const allChilled = livingEnemies.every((e) =>
      e.statuses.some((s) => s.id === 'chill')
    );
    if (allChilled) {
      rt.killingFreezeAcc += dt;
      if (rt.killingFreezeAcc >= 0.5) {
        rt.killingFreezeAcc -= 0.5;
        const tickDmg = Math.max(4, Math.round(killingFreeze.scaledValue * 0.5));
        for (const e of livingEnemies) {
          ctx.dealDamageToEnemy(state, e, {
            baseDamage: tickDmg,
            source: 'status',
            canCrit: false,
            canBackstab: false,
            patronId: 'glaciera',
          });
        }
      }
    }
  }

  // Active God Call periodic pulses
  const player = state.player;
  if (player.godCallActiveTimer <= 0 || !player.godCallPatron) {
    return;
  }

  if (Math.abs(player.godCallActiveTimer - rt.lastSeenCallTimer) < 1e-6) {
    player.godCallActiveTimer = Math.max(0, player.godCallActiveTimer - dt);
  }
  rt.lastSeenCallTimer = player.godCallActiveTimer;
  rt.callPulseAcc += dt;

  const patron = player.godCallPatron;
  const callBoon = getBoonInSlot(state, 'call');

  if (patron === 'voltaris') {
    const interval = rt.greaterCall ? 0.18 : 0.24;
    if (rt.callPulseAcc >= interval) {
      rt.callPulseAcc -= interval;
      if (livingEnemies.length > 0) {
        const target = detPick(state, livingEnemies, ctx);
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
    if (rt.callPulseAcc >= 0.24) {
      rt.callPulseAcc -= 0.24;
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
    if (rt.callPulseAcc >= 0.35) {
      rt.callPulseAcc -= 0.35;
      for (const enemy of livingEnemies) {
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
  } else if (patron === 'bellum') {
    player.iframeTimer = Math.max(player.iframeTimer, 0.12);
    if (rt.callPulseAcc >= 0.16) {
      rt.callPulseAcc -= 0.16;
      const dmg = callBoon?.scaledValue ?? 46;
      for (const enemy of livingEnemies) {
        if (distSq(player.pos, enemy.pos) <= 170 * 170) {
          ctx.dealDamageToEnemy(state, enemy, {
            baseDamage: dmg,
            source: 'call',
            canCrit: false,
            canBackstab: false,
            patronId: 'bellum',
          });
        }
      }
    }
  } else if (patron === 'bacchion') {
    if (rt.callPulseAcc >= 0.35) {
      rt.callPulseAcc -= 0.35;
      for (const enemy of livingEnemies) {
        if (distSq(player.pos, enemy.pos) <= 280 * 280) {
          ctx.applyStatus(state, enemy, 'enemy', 'hangover', 1, 'bacchion');
          const h = enemy.statuses.find((s) => s.id === 'hangover');
          if (h) h.magnitude = Math.max(h.magnitude, callBoon?.scaledValue ?? 12);
        }
      }
    }
  } else if (patron === 'glaciera') {
    if (rt.callPulseAcc >= 0.24) {
      rt.callPulseAcc -= 0.24;
      for (const enemy of livingEnemies) {
        if (distSq(player.pos, enemy.pos) <= 300 * 300) {
          ctx.dealDamageToEnemy(state, enemy, {
            baseDamage: callBoon?.scaledValue ?? 18,
            source: 'call',
            canCrit: false,
            canBackstab: false,
            statusId: 'chill',
            patronId: 'glaciera',
          });
          tryTriggerArcticBlast(state, enemy, ctx);
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
