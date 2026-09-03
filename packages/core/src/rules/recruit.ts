import { ONE, clampFixed, mulChain, quotFixed, type Fixed } from '@worldwar/shared'

/**
 * Recruitment timing and starting condition (T-M3-05).
 *
 * Both curves are belegt from the original: recruiting runs at full speed at 100
 * morale and at a fifth at zero, and freshly raised infantry starts with hit points
 * in proportion to the province's morale — a demoralised province produces weak
 * soldiers, not just slow ones.
 */

/** 0 morale -> 20 % speed, 100 morale -> 100 % speed. */
export function recruitSpeedFactor(morale: Fixed): Fixed {
  const share = quotFixed(morale, 100_000)
  return 200 + mulChain([800, clampFixed(share, 0, ONE)])
}

export function recruitDuration(baseTicks: number, morale: Fixed): number {
  const factor = recruitSpeedFactor(morale)
  // eslint-disable-next-line no-restricted-syntax -- ticks scaled by a permille factor, integer arithmetic with explicit rounding
  return Math.max(1, Math.ceil((baseTicks * ONE) / factor))
}

/**
 * Hit points a newly recruited unit starts with, as a share of full strength.
 * Belegt: 75 morale gives roughly three quarters of full hit points.
 */
export function recruitStartCondition(morale: Fixed): Fixed {
  const share = quotFixed(morale, 100_000)
  // Never below a quarter: a unit that arrives already broken would be a trap.
  return clampFixed(share, 250, ONE)
}
