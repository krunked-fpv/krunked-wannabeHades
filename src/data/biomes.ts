import {
  BIOME_CONSTANTS,
  LAVA_CONSTANTS,
  type ArenaObstacle,
  type BiomeDef,
  type BiomeId,
  type BossId,
  type EnemyArchetypeId,
  type HazardState,
  type Vec2,
} from '../contracts/index.js';

export { BIOME_CONSTANTS };

export const BIOME_PROGRESSION_ORDER: readonly BiomeId[] = [
  'obsidian_pit',
  'cinder_mire',
  'verdant_colosseum',
  'crypt_of_bile',
  'frozen_summit',
] as const;

export interface RoomTemplateObstacle {
  kind: ArenaObstacle['kind'];
  x: number;
  y: number;
  halfW: number;
  halfH: number;
  radius?: number;
  hp?: number;
}

export interface RoomTemplateHazard {
  kind: HazardState['kind'];
  x: number;
  y: number;
  radius: number;
  damage: number;
  cooldown?: number;
}

export interface RoomTemplateDef {
  id: string;
  biome: BiomeId;
  width: number;
  height: number;
  playerSpawn: Vec2;
  rewardPos: Vec2;
  spawnPoints: readonly Vec2[];
  obstacles: readonly RoomTemplateObstacle[];
  hazards: readonly RoomTemplateHazard[];
  isBossArena?: boolean;
  isHub?: boolean;
}

export interface BiomeEncounterTable {
  biome: BiomeId;
  def: BiomeDef;
  nextBiome: BiomeId | null;
  bossId: BossId;
  altBossIds?: readonly BossId[];
  miniBossArchetypes: readonly EnemyArchetypeId[];
  commonEnemies: readonly EnemyArchetypeId[];
  rangedEnemies: readonly EnemyArchetypeId[];
  heavyEnemies: readonly EnemyArchetypeId[];
  combatTemplates: readonly string[];
  bossTemplate: string;
  shopTemplate: string;
  fountainTemplate: string;
  baseWaveCount: number;
  baseEnemiesPerWave: number;
  eliteChanceBase: number;
}

export const ROOM_TEMPLATES: Record<string, RoomTemplateDef> = {
  sanctum_courtyard: {
    id: 'sanctum_courtyard',
    biome: 'sanctum_hub',
    width: 1320,
    height: 920,
    playerSpawn: { x: -220, y: 80 },
    rewardPos: { x: -280, y: -150 },
    spawnPoints: [{ x: 240, y: -20 }],
    isHub: true,
    obstacles: [
      { kind: 'pillar', x: -390, y: -210, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'pillar', x: 390, y: -210, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'pillar', x: -390, y: 210, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'pillar', x: 390, y: 210, halfW: 44, halfH: 34, radius: 42 },
      // Symmetrical obsidian statues flanking the crimson runner carpet (Escape Door archway unobstructed)
      { kind: 'statue', x: -185, y: -315, halfW: 44, halfH: 34, radius: 40 },
      { kind: 'statue', x: 185, y: -315, halfW: 44, halfH: 34, radius: 40 },
      { kind: 'destructible_urn', x: -520, y: -90, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: -540, y: 20, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: 520, y: -80, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: 540, y: 35, halfW: 22, halfH: 20, radius: 22, hp: 10 },
    ],
    hazards: [],
  },

  pit_pillars: {
    id: 'pit_pillars',
    biome: 'obsidian_pit',
    width: 1440,
    height: 1000,
    playerSpawn: { x: 0, y: 330 },
    rewardPos: { x: 0, y: 0 },
    spawnPoints: [
      { x: -360, y: -230 },
      { x: 360, y: -230 },
      { x: 0, y: -270 },
      { x: -450, y: 40 },
      { x: 450, y: 40 },
      { x: -240, y: -60 },
      { x: 240, y: -60 },
    ],
    obstacles: [
      { kind: 'pillar', x: -270, y: -120, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'pillar', x: 270, y: -120, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'pillar', x: -270, y: 150, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'pillar', x: 270, y: 150, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'destructible_urn', x: -560, y: -240, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: -520, y: -275, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: 560, y: -240, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: 540, y: 240, halfW: 22, halfH: 20, radius: 22, hp: 10 },
    ],
    hazards: [],
  },

  pit_chasm_bridge: {
    id: 'pit_chasm_bridge',
    biome: 'obsidian_pit',
    width: 1500,
    height: 1040,
    playerSpawn: { x: 0, y: 355 },
    rewardPos: { x: 0, y: -20 },
    spawnPoints: [
      { x: -430, y: -220 },
      { x: 430, y: -220 },
      { x: -420, y: 130 },
      { x: 420, y: 130 },
      { x: 0, y: -280 },
      { x: -160, y: -170 },
      { x: 160, y: -170 },
    ],
    obstacles: [
      // Dash-crossable abyssal pits flanking the central stone bridge
      { kind: 'pit', x: -230, y: 0, halfW: 85, halfH: 105 },
      { kind: 'pit', x: 230, y: 0, halfW: 85, halfH: 105 },
      { kind: 'pillar', x: -480, y: -60, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'pillar', x: 480, y: -60, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'destructible_urn', x: -610, y: 180, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: 610, y: 180, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: 0, y: -360, halfW: 22, halfH: 20, radius: 22, hp: 10 },
    ],
    hazards: [],
  },

  pit_trap_gauntlet: {
    id: 'pit_trap_gauntlet',
    biome: 'obsidian_pit',
    width: 1460,
    height: 1020,
    playerSpawn: { x: 0, y: 340 },
    rewardPos: { x: 0, y: 0 },
    spawnPoints: [
      { x: -420, y: -240 },
      { x: 420, y: -240 },
      { x: 0, y: -290 },
      { x: -460, y: 70 },
      { x: 460, y: 70 },
      { x: -210, y: -90 },
      { x: 210, y: -90 },
    ],
    obstacles: [
      { kind: 'pillar', x: -340, y: -30, halfW: 46, halfH: 34, radius: 44 },
      { kind: 'pillar', x: 340, y: -30, halfW: 46, halfH: 34, radius: 44 },
      { kind: 'statue', x: 0, y: -155, halfW: 48, halfH: 36, radius: 44 },
      { kind: 'destructible_urn', x: -570, y: -180, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: 570, y: -180, halfW: 22, halfH: 20, radius: 22, hp: 10 },
    ],
    hazards: [
      { kind: 'spike_trap', x: -165, y: 95, radius: 52, damage: 15, cooldown: 3.2 },
      { kind: 'spike_trap', x: 165, y: 95, radius: 52, damage: 15, cooldown: 3.2 },
      { kind: 'spike_trap', x: 0, y: -20, radius: 52, damage: 15, cooldown: 3.8 },
    ],
  },

  pit_twin_braziers: {
    id: 'pit_twin_braziers',
    biome: 'obsidian_pit',
    width: 1400,
    height: 980,
    playerSpawn: { x: 0, y: 325 },
    rewardPos: { x: 0, y: -10 },
    spawnPoints: [
      { x: -380, y: -200 },
      { x: 380, y: -200 },
      { x: -340, y: 120 },
      { x: 340, y: 120 },
      { x: 0, y: -260 },
      { x: -150, y: -140 },
      { x: 150, y: -140 },
    ],
    obstacles: [
      { kind: 'pillar', x: -195, y: -40, halfW: 42, halfH: 32, radius: 40 },
      { kind: 'pillar', x: 195, y: -40, halfW: 42, halfH: 32, radius: 40 },
      { kind: 'pit', x: -500, y: -250, halfW: 72, halfH: 60 },
      { kind: 'pit', x: 500, y: -250, halfW: 72, halfH: 60 },
      { kind: 'destructible_urn', x: -540, y: 180, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: -495, y: 210, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: 540, y: 180, halfW: 22, halfH: 20, radius: 22, hp: 10 },
    ],
    hazards: [{ kind: 'spike_trap', x: 0, y: 110, radius: 50, damage: 15, cooldown: 3.4 }],
  },

  pit_warden_sanctum: {
    id: 'pit_warden_sanctum',
    biome: 'obsidian_pit',
    width: 1620,
    height: 1120,
    playerSpawn: { x: 0, y: 370 },
    rewardPos: { x: 0, y: 0 },
    spawnPoints: [
      { x: 0, y: -180 },
      { x: -360, y: -180 },
      { x: 360, y: -180 },
      { x: -420, y: 120 },
      { x: 420, y: 120 },
    ],
    isBossArena: true,
    obstacles: [
      { kind: 'pillar', x: -380, y: -190, halfW: 48, halfH: 36, radius: 46 },
      { kind: 'pillar', x: 380, y: -190, halfW: 48, halfH: 36, radius: 46 },
      { kind: 'pillar', x: -380, y: 190, halfW: 48, halfH: 36, radius: 46 },
      { kind: 'pillar', x: 380, y: 190, halfW: 48, halfH: 36, radius: 46 },
      { kind: 'destructible_urn', x: -640, y: 0, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: 640, y: 0, halfW: 22, halfH: 20, radius: 22, hp: 10 },
    ],
    hazards: [],
  },

  pit_shop_sanctuary: {
    id: 'pit_shop_sanctuary',
    biome: 'obsidian_pit',
    width: 1300,
    height: 900,
    playerSpawn: { x: 0, y: 290 },
    rewardPos: { x: 0, y: -40 },
    spawnPoints: [],
    obstacles: [
      { kind: 'pillar', x: -380, y: -160, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'pillar', x: 380, y: -160, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'destructible_urn', x: -470, y: 140, halfW: 22, halfH: 20, radius: 22, hp: 10 },
      { kind: 'destructible_urn', x: 470, y: 140, halfW: 22, halfH: 20, radius: 22, hp: 10 },
    ],
    hazards: [],
  },

  cinder_island: {
    id: 'cinder_island',
    biome: 'cinder_mire',
    width: 1520,
    height: 1060,
    playerSpawn: { x: 0, y: 350 },
    rewardPos: { x: 0, y: 0 },
    spawnPoints: [
      { x: -380, y: -220 },
      { x: 380, y: -220 },
      { x: 0, y: -260 },
      { x: -420, y: 100 },
      { x: 420, y: 100 },
    ],
    obstacles: [
      { kind: 'pillar', x: -310, y: -80, halfW: 44, halfH: 34, radius: 42 },
      { kind: 'pillar', x: 310, y: -80, halfW: 44, halfH: 34, radius: 42 },
    ],
    hazards: [
      { kind: 'lava_pool', x: -490, y: -260, radius: 115, damage: LAVA_CONSTANTS.damage },
      { kind: 'lava_pool', x: 490, y: -260, radius: 115, damage: LAVA_CONSTANTS.damage },
      { kind: 'lava_pool', x: 0, y: 115, radius: 85, damage: LAVA_CONSTANTS.damage },
    ],
  },

  cinder_boss_caldera: {
    id: 'cinder_boss_caldera',
    biome: 'cinder_mire',
    width: 1640,
    height: 1140,
    playerSpawn: { x: 0, y: 380 },
    rewardPos: { x: 0, y: 0 },
    spawnPoints: [
      { x: 0, y: -240 },
      { x: -340, y: -150 },
      { x: 340, y: -150 },
    ],
    isBossArena: true,
    obstacles: [
      { kind: 'pillar', x: -340, y: 120, halfW: 46, halfH: 36, radius: 44 },
      { kind: 'pillar', x: 340, y: 120, halfW: 46, halfH: 36, radius: 44 },
    ],
    hazards: [
      { kind: 'lava_pool', x: -560, y: -280, radius: 130, damage: LAVA_CONSTANTS.damage },
      { kind: 'lava_pool', x: 560, y: -280, radius: 130, damage: LAVA_CONSTANTS.damage },
    ],
  },

  verdant_arena: {
    id: 'verdant_arena',
    biome: 'verdant_colosseum',
    width: 1580,
    height: 1080,
    playerSpawn: { x: 0, y: 360 },
    rewardPos: { x: 0, y: 0 },
    spawnPoints: [
      { x: -400, y: -220 },
      { x: 400, y: -220 },
      { x: 0, y: -260 },
      { x: -440, y: 100 },
      { x: 440, y: 100 },
    ],
    obstacles: [
      { kind: 'pillar', x: -320, y: -140, halfW: 46, halfH: 36, radius: 44 },
      { kind: 'pillar', x: 320, y: -140, halfW: 46, halfH: 36, radius: 44 },
      { kind: 'pillar', x: -320, y: 160, halfW: 46, halfH: 36, radius: 44 },
      { kind: 'pillar', x: 320, y: 160, halfW: 46, halfH: 36, radius: 44 },
    ],
    hazards: [],
  },

  crypt_chamber: {
    id: 'crypt_chamber',
    biome: 'crypt_of_bile',
    width: 1360,
    height: 940,
    playerSpawn: { x: 0, y: 310 },
    rewardPos: { x: 0, y: 0 },
    spawnPoints: [
      { x: -330, y: -200 },
      { x: 330, y: -200 },
      { x: 0, y: -230 },
      { x: -350, y: 80 },
      { x: 350, y: 80 },
    ],
    obstacles: [
      { kind: 'pillar', x: -240, y: -40, halfW: 42, halfH: 32, radius: 40 },
      { kind: 'pillar', x: 240, y: -40, halfW: 42, halfH: 32, radius: 40 },
    ],
    hazards: [
      { kind: 'poison_pool', x: -120, y: -160, radius: 75, damage: 4 },
      { kind: 'poison_pool', x: 120, y: -160, radius: 75, damage: 4 },
      { kind: 'curing_pool', x: -480, y: 200, radius: 55, damage: 0 },
      { kind: 'curing_pool', x: 480, y: 200, radius: 55, damage: 0 },
    ],
  },

  summit_throne: {
    id: 'summit_throne',
    biome: 'frozen_summit',
    width: 1760,
    height: 1200,
    playerSpawn: { x: 0, y: 410 },
    rewardPos: { x: 0, y: 0 },
    spawnPoints: [
      { x: 0, y: -210 },
      { x: -420, y: -180 },
      { x: 420, y: -180 },
    ],
    isBossArena: true,
    obstacles: [
      { kind: 'pillar', x: -420, y: -160, halfW: 54, halfH: 40, radius: 50 },
      { kind: 'pillar', x: 420, y: -160, halfW: 54, halfH: 40, radius: 50 },
    ],
    hazards: [],
  },
};

export const BIOME_ENCOUNTER_TABLES: Record<BiomeId, BiomeEncounterTable> = {
  sanctum_hub: {
    biome: 'sanctum_hub',
    def: BIOME_CONSTANTS.sanctum_hub,
    nextBiome: 'obsidian_pit',
    bossId: 'warden_malice',
    miniBossArchetypes: [],
    commonEnemies: ['rattlebones_dummy'],
    rangedEnemies: [],
    heavyEnemies: [],
    combatTemplates: ['sanctum_courtyard'],
    bossTemplate: 'sanctum_courtyard',
    shopTemplate: 'sanctum_courtyard',
    fountainTemplate: 'sanctum_courtyard',
    baseWaveCount: 1,
    baseEnemiesPerWave: 1,
    eliteChanceBase: 0,
  },
  obsidian_pit: {
    biome: 'obsidian_pit',
    def: BIOME_CONSTANTS.obsidian_pit,
    nextBiome: 'cinder_mire',
    bossId: 'warden_malice',
    altBossIds: ['warden_fury', 'warden_murder'],
    miniBossArchetypes: ['ember_lout', 'wretched_husk'],
    commonEnemies: ['numbskull', 'wretched_husk'],
    rangedEnemies: ['bone_archer', 'brimstone_crystal'],
    heavyEnemies: ['ember_lout', 'wretched_husk'],
    combatTemplates: ['pit_pillars', 'pit_chasm_bridge', 'pit_trap_gauntlet', 'pit_twin_braziers'],
    bossTemplate: 'pit_warden_sanctum',
    shopTemplate: 'pit_shop_sanctuary',
    fountainTemplate: 'pit_shop_sanctuary',
    baseWaveCount: 2,
    baseEnemiesPerWave: 4,
    eliteChanceBase: 0.14,
  },
  cinder_mire: {
    biome: 'cinder_mire',
    def: BIOME_CONSTANTS.cinder_mire,
    nextBiome: 'verdant_colosseum',
    bossId: 'bone_leviathan',
    miniBossArchetypes: ['infernal_bomber', 'lava_gorgon'],
    commonEnemies: ['bloodless_drifter', 'slag_thrower'],
    rangedEnemies: ['lava_gorgon', 'brimstone_crystal'],
    heavyEnemies: ['infernal_bomber', 'ember_lout'],
    combatTemplates: ['cinder_island'],
    bossTemplate: 'cinder_boss_caldera',
    shopTemplate: 'pit_shop_sanctuary',
    fountainTemplate: 'pit_shop_sanctuary',
    baseWaveCount: 2,
    baseEnemiesPerWave: 4,
    eliteChanceBase: 0.22,
  },
  verdant_colosseum: {
    biome: 'verdant_colosseum',
    def: BIOME_CONSTANTS.verdant_colosseum,
    nextBiome: 'crypt_of_bile',
    bossId: 'colosseum_spearlord',
    altBossIds: ['colosseum_bull'],
    miniBossArchetypes: ['colosseum_shieldbearer', 'chariot_flame'],
    commonEnemies: ['colosseum_swordsman', 'chariot_flame'],
    rangedEnemies: ['colosseum_bowman', 'soul_orb'],
    heavyEnemies: ['colosseum_shieldbearer'],
    combatTemplates: ['verdant_arena'],
    bossTemplate: 'verdant_arena',
    shopTemplate: 'pit_shop_sanctuary',
    fountainTemplate: 'pit_shop_sanctuary',
    baseWaveCount: 2,
    baseEnemiesPerWave: 5,
    eliteChanceBase: 0.28,
  },
  crypt_of_bile: {
    biome: 'crypt_of_bile',
    def: BIOME_CONSTANTS.crypt_of_bile,
    nextBiome: 'frozen_summit',
    bossId: 'sovereign_lord',
    miniBossArchetypes: ['heavy_brawler', 'snakestone_laser'],
    commonEnemies: ['giant_vermin', 'venom_satyr'],
    rangedEnemies: ['venom_satyr', 'snakestone_laser'],
    heavyEnemies: ['heavy_brawler'],
    combatTemplates: ['crypt_chamber'],
    bossTemplate: 'crypt_chamber',
    shopTemplate: 'pit_shop_sanctuary',
    fountainTemplate: 'pit_shop_sanctuary',
    baseWaveCount: 2,
    baseEnemiesPerWave: 4,
    eliteChanceBase: 0.34,
  },
  frozen_summit: {
    biome: 'frozen_summit',
    def: BIOME_CONSTANTS.frozen_summit,
    nextBiome: null,
    bossId: 'sovereign_lord',
    miniBossArchetypes: ['heavy_brawler'],
    commonEnemies: ['numbskull', 'wretched_husk'],
    rangedEnemies: ['bone_archer'],
    heavyEnemies: ['ember_lout'],
    combatTemplates: ['summit_throne'],
    bossTemplate: 'summit_throne',
    shopTemplate: 'summit_throne',
    fountainTemplate: 'summit_throne',
    baseWaveCount: 1,
    baseEnemiesPerWave: 1,
    eliteChanceBase: 0.4,
  },
};

export function getBiomeEncounterTable(biome: BiomeId): BiomeEncounterTable {
  return BIOME_ENCOUNTER_TABLES[biome];
}

export function getRoomTemplate(templateId: string): RoomTemplateDef {
  return ROOM_TEMPLATES[templateId] ?? ROOM_TEMPLATES.pit_pillars;
}
