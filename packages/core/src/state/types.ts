import type { Fixed, RngState } from '@worldwar/shared'
import type { GameEvent } from '../events/types'

/**
 * The complete game state (design D2).
 *
 * Three rules hold everywhere in this file:
 *  1. Plain JSON only — no classes, no Map/Set, no undefined. Saving is then lossless
 *     and hashing is exact (D-04).
 *  2. Every quantity is Fixed (thousandths), never a float (D-02).
 *  3. Anything order-sensitive has an explicit `*Order` array. Iterating object keys
 *     would make evaluation order depend on insertion order (R-ARCH-01).
 */

export type Tick = number
export type PlayerId = string
export type ProvinceId = string
export type ArmyId = string
export type BattleId = string
export type OrderId = string

export type ResourceKey = 'food' | 'wood' | 'iron' | 'coal' | 'oil' | 'rare' | 'money'

export const RESOURCE_KEYS: readonly ResourceKey[] = [
  'food',
  'wood',
  'iron',
  'coal',
  'oil',
  'rare',
  'money',
]

export type UnitClass = 'infantry' | 'armor' | 'artillery' | 'air' | 'navy'

export type BuildingKey =
  | 'barracks'
  | 'fortress'
  | 'factory'
  | 'shipyard'
  | 'airfield'
  | 'railway'
  | 'harbour'

export type Terrain = 'plains' | 'forest' | 'mountain' | 'desert' | 'urban'
export type ProvinceKind = 'city' | 'rural'
export type Stance = 'aggressive' | 'defensive' | 'retreat'
export type DiplomaticState = 'peace' | 'war' | 'truce' | 'alliance'
export type PlayerKind = 'human' | 'ai'
export type Difficulty = 'easy' | 'normal' | 'hard'
export type VictoryCondition = 'points' | 'conquest' | 'time'

// ---------------------------------------------------------------------------
// Static map data — passed in as context, never part of the state (design D2).
// ---------------------------------------------------------------------------

export type EdgeKind = 'land' | 'sea'
export type Crossing = 'none' | 'river' | 'strait'

export interface Edge {
  a: ProvinceId
  b: ProvinceId
  kind: EdgeKind
  /** Geodetic distance in kilometres — a game quantity, never derived from pixels. */
  distanceKm: Fixed
  crossing: Crossing
}

export interface MapProvince {
  id: ProvinceId
  name: string
  kind: ProvinceKind
  terrain: Terrain
  coastal: boolean
  /** Screen position of the province centre, for rendering and labels only. */
  center: { x: number; y: number }
  polygon: ReadonlyArray<readonly [number, number]>
  population: Fixed
  deposits: Partial<Record<ResourceKey, Fixed>>
}

export interface StartPosition {
  nation: string
  capital: ProvinceId
  provinces: readonly ProvinceId[]
}

export interface MapData {
  id: string
  name: string
  width: number
  height: number
  provinces: readonly MapProvince[]
  edges: readonly Edge[]
  /** province id -> indices into `edges`. Built once, used on every movement query. */
  edgesByProvince: Readonly<Record<ProvinceId, readonly number[]>>
  startPositions: readonly StartPosition[]
}

// ---------------------------------------------------------------------------
// Dynamic state
// ---------------------------------------------------------------------------

export interface BuildOrder {
  id: OrderId
  building: BuildingKey
  /** Level being built, i.e. current level + 1. */
  level: number
  startedTick: Tick
  completesAtTick: Tick
}

export interface RecruitOrder {
  id: OrderId
  unitKey: string
  count: number
  startedTick: Tick
  completesAtTick: Tick
}

export interface Province {
  id: ProvinceId
  name: string
  owner: PlayerId | null // null = neutral or held by rebels
  kind: ProvinceKind
  terrain: Terrain
  coastal: boolean
  neighbors: readonly ProvinceId[]
  seaLinks: readonly ProvinceId[]
  population: Fixed
  /** Acts immediately; 0..100000 (= 0..100). */
  morale: Fixed
  /** Where morale is heading; the current value drifts towards it once per game day. */
  targetMorale: Fixed
  deposits: Partial<Record<ResourceKey, Fixed>>
  buildings: Partial<Record<BuildingKey, number>>
  buildQueue: BuildOrder[]
  recruitQueue: RecruitOrder[]
  occupiedSince: Tick | null
  /**
   * Carried-over production remainders. Without them, fixed-point rounding quietly
   * loses yield across 24 000 ticks, and small provinces lose proportionally most.
   */
  productionRemainder: Partial<Record<ResourceKey, Fixed>>
}

/**
 * A stack holds a pool of hit points, not a unit count. The count is derived
 * (`ceil(hpTotal / hpPerUnit)`) and never stored twice — otherwise the two drift
 * apart. Losses become continuous instead of arriving in one lump.
 */
export interface UnitStack {
  unitKey: string
  hpTotal: Fixed
}

export interface Army {
  id: ArmyId
  owner: PlayerId
  name: string
  locationProvinceId: ProvinceId
  units: UnitStack[]
  /** Remaining path; empty means the army is stationary. */
  path: ProvinceId[]
  arrivalTick: Tick | null
  departureTick: Tick | null
  /** Until this tick the army fights at reduced strength (R-UNIT-05). */
  deployDelayUntil: Tick
  stance: Stance
  embarked: boolean
  /** Set while a retreat cooldown is running (D6.8). */
  cannotAttackUntil: Tick
}

export interface IntelEntry {
  tick: Tick
  owner: PlayerId | null
  strength: Fixed
}

export interface Player {
  id: PlayerId
  name: string
  nation: string
  color: string
  kind: PlayerKind
  difficulty: Difficulty | null
  /** 1000 = no bonus. Any other value is shown openly in the interface (R-AI-02). */
  aiBonusMultiplier: Fixed
  resources: Record<ResourceKey, Fixed>
  capitalProvinceId: ProvinceId | null
  /** While set, the penalties for losing the capital apply (D6.8). */
  capitalLostUntil: Tick | null
  /** Last time the capital was moved; null means never. Drives the cooldown (D6.8). */
  capitalMovedAtTick: Tick | null
  alive: boolean
  score: number
  reputation: Fixed
  /** Last known state of foreign provinces — part of the state, so it survives loading. */
  intel: Record<ProvinceId, IntelEntry>
}

export interface Relation {
  state: DiplomaticState
  sinceTick: Tick
  /** War declared but not yet in force (R-DIP-02). */
  warEffectiveAtTick: Tick | null
  rightOfWay: boolean
  sharedMap: boolean
}

export interface DiplomacyState {
  /** Key is `${a}|${b}` with a < b, so each pair is stored exactly once. */
  relations: Record<string, Relation>
}

export interface Battle {
  id: BattleId
  provinceId: ProvinceId
  /** N sides, not two: three parties plus rebels in one province is normal. */
  sides: PlayerId[][]
  startedTick: Tick
}

export interface AiMemory {
  lastStrategicTick: Tick
  lastOperationalTick: Tick
  /** How much each opponent is worth attacking, 0..1000. */
  targetPriority: Record<PlayerId, Fixed>
  /** Army id -> assignment key ("defend:PROV", "attack:PROV", "reserve"). */
  assignments: Record<ArmyId, string>
  /** Share of income earmarked for building versus recruiting, 0..1000. */
  buildShare: Fixed
}

export interface VictoryState {
  condition: VictoryCondition
  /** For 'points': share of all points on the map needed to win. */
  pointsShareToWin: Fixed
  /** For 'time': game days after which the leader wins. */
  dayLimit: number | null
  winner: PlayerId | null
  endedAtTick: Tick | null
}

export interface GameState {
  schemaVersion: number
  seed: number
  rng: RngState
  /** Elapsed game hours since the start of the match. */
  tick: Tick
  mapId: string
  rulesId: string

  players: Record<PlayerId, Player>
  playerOrder: PlayerId[]
  provinces: Record<ProvinceId, Province>
  provinceOrder: ProvinceId[]
  armies: Record<ArmyId, Army>
  armyOrder: ArmyId[]

  diplomacy: DiplomacyState
  ai: Record<PlayerId, AiMemory>
  battles: Battle[]
  /** Output, not simulation input: excluded from the hash on purpose. */
  eventLog: GameEvent[]
  victory: VictoryState
  nextIds: { army: number; battle: number; order: number }
}

/** Keys the simulation hash ignores (design D2, "Was der Hash umfasst"). */
export const HASH_OMIT_KEYS: readonly string[] = ['eventLog']

export const SCHEMA_VERSION = 1
