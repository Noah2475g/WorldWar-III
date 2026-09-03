import { ONE, clampFixed, mulChain, quotFixed, type Fixed } from '@worldwar/shared'
import type { Rules } from '../rules/types'
import type { GameState, Player, Province, ResourceKey } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Resource production per province and tick (R-ECON-02, design D6.1).
 *
 *   production = deposit x buildingFactor x moraleFactor x populationFactor x occupationFactor
 *
 * The morale factor is one of the few belegte numbers we have: 0.20 + 0.80 x morale,
 * so a province at zero morale still yields a fifth, and a province at full morale
 * yields exactly its deposit.
 */

/** Population a province needs for a factor of 1.0. Fixed, in thousands of people. */
export const REFERENCE_POPULATION: Fixed = 300_000

export function moraleFactor(morale: Fixed, rules: Rules): Fixed {
  const floor = rules.constants.productionMoraleFloor
  const share = quotFixed(morale, 100_000) // morale 0..100000 -> 0..1000
  return floor + mulChain([ONE - floor, clampFixed(share, 0, ONE)])
}

export function buildingFactor(province: Province, resource: ResourceKey, rules: Rules): Fixed {
  let factor = ONE
  for (const [key, level] of Object.entries(province.buildings)) {
    if (!level) continue
    const bonus = rules.buildings[key as keyof typeof rules.buildings]?.effects.productionBonusPermille
    if (!bonus) continue
    // Money is taxation, not extraction: factories do not print it.
    if (resource === 'money') continue
    // eslint-disable-next-line no-restricted-syntax -- permille bonus x building level, both plain integers
    factor += bonus * level
  }
  return factor
}

export function populationFactor(province: Province): Fixed {
  return clampFixed(quotFixed(province.population, REFERENCE_POPULATION), 500, 1500)
}

/**
 * Freshly captured provinces produce at half rate, recovering over the occupation
 * period (design D6.1). It is what stops a lightning conquest from paying for itself
 * on the same day.
 */
export function occupationFactor(province: Province, tick: number, rules: Rules): Fixed {
  if (province.occupiedSince === null) return ONE

  const elapsed = tick - province.occupiedSince
  // eslint-disable-next-line no-restricted-syntax -- plain integer bookkeeping: days x ticks-per-day
  const window = rules.constants.occupationPenaltyDays * rules.constants.ticksPerDay
  if (elapsed >= window) return ONE

  const recovered = quotFixed(elapsed, window) // 0..1000
  return 500 + mulChain([500, recovered])
}

/** Losing the capital hits the whole nation's output, not just one province (D6.8). */
export function capitalPenalty(player: Player, tick: number, rules: Rules): Fixed {
  return player.capitalLostUntil !== null && tick < player.capitalLostUntil
    ? rules.constants.capitalLossProductionFactor
    : ONE
}

/**
 * What one province yields in one tick — scaled by ONE, before the carry is applied.
 *
 * Split out of the phase so the economy overview (R-ECON-06) can add these up instead
 * of deriving the formula a second time. An overview with its own copy of the
 * arithmetic is an overview that starts lying the first time production changes, and
 * a balance sheet that lies is worse than none.
 */
export function provinceYieldScaled(
  province: Province,
  tick: number,
  penalty: Fixed,
  rules: Rules,
): Partial<Record<ResourceKey, number>> {
  const factorWithoutBuildings = mulChain([
    moraleFactor(province.morale, rules),
    populationFactor(province),
    occupationFactor(province, tick, rules),
    penalty,
  ])

  const scaled: Partial<Record<ResourceKey, number>> = {}

  // Taxes: money is raised from people, not dug out of the ground. Morale and
  // occupation apply the same way — an unhappy province pays less.
  // eslint-disable-next-line no-restricted-syntax -- population in thousands x rate, plain integers
  const taxBase = Math.trunc(province.population / 1000) * rules.constants.taxPerThousandPopulationPerTick
  if (taxBase > 0) {
    // eslint-disable-next-line no-restricted-syntax -- exact integer product; the carry keeps it lossless
    scaled.money = taxBase * factorWithoutBuildings
  }

  for (const [key, deposit] of Object.entries(province.deposits)) {
    if (!deposit) continue
    const resource = key as ResourceKey
    if (resource === 'money') continue // taxation handles money, above

    const factor = mulChain([buildingFactor(province, resource, rules), factorWithoutBuildings])
    // eslint-disable-next-line no-restricted-syntax -- exact integer product; the carry keeps it lossless
    scaled[resource] = deposit * factor
  }

  return scaled
}

export const production: Phase = (draft: GameState, ctx: PhaseContext) => {
  const { rules } = ctx

  for (const provinceId of draft.provinceOrder) {
    const province = draft.provinces[provinceId]!
    if (!province.owner) continue

    const player = draft.players[province.owner]
    if (!player || !player.alive) continue

    const yields = provinceYieldScaled(province, draft.tick, capitalPenalty(player, draft.tick, rules), rules)

    for (const [key, base] of Object.entries(yields)) {
      const resource = key as ResourceKey

      // Bresenham, not rounding: the fractional part is carried into the next tick.
      // Without it, fixed-point rounding quietly loses yield across 24 000 ticks —
      // and small provinces lose proportionally most.
      const scaled = base + (province.productionRemainder[resource] ?? 0)
      // eslint-disable-next-line no-restricted-syntax -- integer division with explicit remainder handling
      const produced = Math.trunc(scaled / ONE)

      province.productionRemainder[resource] = scaled % ONE
      if (produced !== 0) player.resources[resource] += produced
    }
  }
}
