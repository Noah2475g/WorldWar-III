import type { Fixed } from '@worldwar/shared'
import type { BuildingKey, ResourceKey, UnitClass } from '../state/types'

/**
 * Balancing data (design D-08): every number the game plays by lives in
 * `data/rules/<id>/*.json`, never in code. Changing balance must never require
 * touching a source file, and it must never break a test that is about rules.
 *
 * The core only ever sees parsed rules — reading files is the caller's job, so the
 * simulation stays free of I/O (R-ARCH-01).
 */

export type ResourceAmounts = Partial<Record<ResourceKey, Fixed>>

export interface ResourceRule {
  name: string
  startAmount: Fixed
  /** null means uncapped — money is (design D6.8). */
  storageLimit: Fixed | null
  basePrice: Fixed
}

export interface BuildingEffects {
  productionBonusPermille?: number
  defenceBonusPermille?: number
  movementBonusPermille?: number
  recruitSpeedPermille?: number
  embarkSpeedPermille?: number
  airRangeProvinces?: number
}

export interface BuildingRule {
  name: string
  maxLevel: number
  cost: ResourceAmounts
  buildTicks: number
  requiresCoastal?: boolean
  requiresBuilding?: BuildingKey
  /** Unit classes this building unlocks for recruitment. */
  allowsUnitClasses: UnitClass[]
  /** Added to the province's target morale per level (belegt for several buildings). */
  moraleBonus: Fixed
  effects: BuildingEffects
}

export interface UnitRule {
  name: string
  class: UnitClass
  cost: ResourceAmounts
  buildTicks: number
  requiresBuilding: BuildingKey
  requiresBuildingLevel?: number
  /** Hit points of a single unit; a stack stores the pool, the count is derived. */
  hpPerUnit: Fixed
  /** Fixed km/h. Belegt for the original's unit set; scaled to this one. */
  speedKmh: Fixed
  /** Ranged units bombard from this many provinces away (R-BAT-06). */
  rangeProvinces?: number
  /** Land units this ship can carry (R-UNIT-06). */
  transportCapacity?: number
  upkeep: ResourceAmounts
  /** Damage against each target class — every class must be present. */
  attack: Record<UnitClass, Fixed>
  defence: Record<UnitClass, Fixed>
}

export interface DifficultyRule {
  economy: Fixed
  position: Fixed
  defence: Fixed
  distance: Fixed
  weakness: Fixed
  planningDepth: number
  maxFronts: number
  /** 1000 = no bonus. Anything else is shown openly (R-AI-02). */
  resourceBonus: Fixed
}

export interface AiRules {
  difficulties: Record<'easy' | 'normal' | 'hard', DifficultyRule>
  resourceWeights: Record<ResourceKey, Fixed>
  buildShareDefault: Fixed
  threatRange: number
}

export interface RuleConstants {
  ticksPerDay: number

  startMorale: Fixed
  capturedMorale: Fixed
  baseTargetMorale: Fixed
  moraleDriftDivisor: number
  productionMoraleFloor: Fixed

  revoltThreshold: Fixed
  revoltChancePerPointPermille: number

  capitalProximityBonus: Fixed
  capitalProximityRange: number
  ownNeighborBonus: Fixed
  ownNeighborBonusMax: Fixed
  enemyNeighborPenalty: Fixed
  enemyNeighborPenaltyMax: Fixed
  foodSurplusBonus: Fixed
  foodShortagePenalty: Fixed
  occupationPenalty: Fixed
  occupationPenaltyDays: number
  capitalLossDays: number
  capitalLossProductionFactor: Fixed
  capitalLossMoralePenalty: Fixed

  battleRate: Fixed
  minDamage: Fixed
  defenceCap: Fixed
  battleMoraleLoss: Fixed
  combatSpreadPermille: number
  stackFullContribution: number
  stackZeroContribution: number
  healthDamageFloor: Fixed
  deployDelayTicks: number
  deployDelayFactor: Fixed

  retreatLossPermille: number
  retreatCooldownTicks: number
  bombardFactor: Fixed

  regenPermillePerTick: number
  regenShortageFactor: Fixed

  foreignTerritoryFactor: Fixed
  hostileTerritoryFactor: Fixed
  railwayFactor: Fixed
  embarkTicks: number
  disembarkTicks: number
  hostileCoastFactor: Fixed

  maxBuildSlotsCity: number
  maxBuildSlotsRural: number
  capitalMoveCooldownDays: number

  warDeclarationDelayTicks: number
  surpriseAttackReputationLoss: Fixed
  truceDurationDays: number

  marketElasticity: number
  marketReversionPermille: number
  marketMinPrice: Fixed
  marketMaxPrice: Fixed

  scoreProvince: number
  scorePopulationPer1000: number
  scoreBuildingLevel: number
  scoreUnit: number
}

export interface Rules {
  id: string
  resources: Record<ResourceKey, ResourceRule>
  buildings: Record<BuildingKey, BuildingRule>
  units: Record<string, UnitRule>
  ai: AiRules
  constants: RuleConstants
  /** Derived for convenience; both come straight from `resources`. */
  startResources: Record<ResourceKey, Fixed>
  storageLimits: Record<ResourceKey, Fixed | null>
}

export interface RawRules {
  constants: unknown
  resources: unknown
  buildings: unknown
  units: unknown
  ai: unknown
}
