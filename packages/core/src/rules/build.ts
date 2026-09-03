import { ONE, clampFixed, divFixed, mulChain, quotFixed, type Fixed } from '@worldwar/shared'
import type { Rules } from './types'
import type { Province, ResourceKey, Tick } from '../state/types'

/**
 * Shared rules around building and recruiting (T-M3-04, T-M3-05).
 *
 * Kept out of the phases so the interface can ask the same questions the core asks —
 * "can I afford this?", "how long will it take?" — without duplicating a formula.
 */

/**
 * How morale scales construction speed. Belegt from the original:
 * 80 morale is the baseline (100 %), 100 morale gives 110 %, 0 morale gives 20 %.
 */
export function buildSpeedFactor(morale: Fixed): Fixed {
  const baseline = 80_000
  if (morale <= baseline) {
    // 0.2 .. 1.0 across 0..80 morale
    const share = quotFixed(morale, baseline) // 0..1000
    return 200 + mulChain([800, clampFixed(share, 0, ONE)])
  }
  // 1.0 .. 1.1 across 80..100 morale
  const share = quotFixed(morale - baseline, 20_000)
  return ONE + mulChain([100, clampFixed(share, 0, ONE)])
}

/** Ticks a build order actually takes in this province. */
export function buildDuration(baseTicks: number, morale: Fixed): number {
  const factor = buildSpeedFactor(morale)
  // eslint-disable-next-line no-restricted-syntax -- ticks scaled by a permille factor, integer arithmetic with explicit rounding
  return Math.max(1, Math.ceil((baseTicks * ONE) / factor))
}

export function completionTick(tick: Tick, baseTicks: number, morale: Fixed): Tick {
  return tick + buildDuration(baseTicks, morale)
}

/** Build slots a province offers — cities take more work in parallel than farmland. */
export function buildSlots(province: Province, rules: Rules): number {
  return province.kind === 'city' ? rules.constants.maxBuildSlotsCity : rules.constants.maxBuildSlotsRural
}

export function canAfford(
  stock: Record<ResourceKey, Fixed>,
  cost: Partial<Record<ResourceKey, Fixed>>,
): boolean {
  for (const [key, amount] of Object.entries(cost)) {
    if (!amount) continue
    if (stock[key as ResourceKey] < amount) return false
  }
  return true
}

export function payCost(
  stock: Record<ResourceKey, Fixed>,
  cost: Partial<Record<ResourceKey, Fixed>>,
): void {
  for (const [key, amount] of Object.entries(cost)) {
    if (!amount) continue
    stock[key as ResourceKey] -= amount
  }
}

/** Partial refund when a player cancels their own order. Geschätzt: half back. */
export const CANCEL_REFUND_PERMILLE = 500

export function refundCost(
  stock: Record<ResourceKey, Fixed>,
  cost: Partial<Record<ResourceKey, Fixed>>,
  permille = CANCEL_REFUND_PERMILLE,
): void {
  for (const [key, amount] of Object.entries(cost)) {
    if (!amount) continue
    // eslint-disable-next-line no-restricted-syntax -- amount x permille before the single rounding division
    stock[key as ResourceKey] += divFixed(amount * permille, ONE)
  }
}
