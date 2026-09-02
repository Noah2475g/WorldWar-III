import type { Fixed } from '@worldwar/shared'
import type { ResourceKey } from '../state/types'

/**
 * Balancing data (design D-08): every number the game plays by lives in
 * `data/rules/<id>/*.json`, never in code. Changing balance must never require
 * touching a source file, and it must never break a test that is about rules.
 *
 * This file holds the slice needed to create a starting state; T-M3-01 adds
 * buildings, units and the full constant set.
 */
export interface Rules {
  id: string
  startResources: Record<ResourceKey, Fixed>
  storageLimits: Record<ResourceKey, Fixed>
  constants: RuleConstants
}

export interface RuleConstants {
  /** Ticks per game day. Belegt: the original settles accounts once per day. */
  ticksPerDay: number
  /** Morale a province starts the match with. Belegt: 70. */
  startMorale: Fixed
  /** Morale a province drops to when captured. Belegt: 25. */
  capturedMorale: Fixed
  /** Base target morale before modifiers. Belegt: 102. */
  baseTargetMorale: Fixed
  /** Fraction of the gap to target closed per game day. Belegt: one seventh. */
  moraleDriftDivisor: number
  /** Production floor at zero morale. Belegt: 0.20 + 0.80 * morale. */
  productionMoraleFloor: Fixed
}
