import { ONE, clampFixed, divFixed, mulChain, type Fixed } from '@worldwar/shared'
import { chance } from '@worldwar/shared'
import { emit } from '../events/emit'
import { atWar } from './combat'
import type { GameState, Province } from '../state/types'
import type { Rules } from '../rules/types'
import type { PhaseContext } from './index'

/**
 * Province morale (R-PROV-03/04, design D6.3).
 *
 * Two values per province: what morale *is* right now, and what it is heading towards.
 * The current value closes one seventh of the gap per game day (belegt) — slow enough
 * that a conquest stays painful for a while, fast enough that good governance pays off.
 *
 * This runs in the daily settlement, not hourly: the drift rate is defined per day,
 * and applying it every tick would be twenty-four times too strong.
 */

/** Distance in provinces to the nearest own capital, capped at the range that matters. */
export function distanceToCapital(state: GameState, province: Province, ctx: PhaseContext): number {
  const owner = province.owner
  if (!owner) return Number.MAX_SAFE_INTEGER
  const capital = state.players[owner]?.capitalProvinceId
  if (!capital) return Number.MAX_SAFE_INTEGER
  if (capital === province.id) return 0

  const limit = ctx.rules.constants.capitalDistanceRange
  const seen = new Set([province.id])
  let frontier = [province.id]

  for (let depth = 1; depth <= limit; depth++) {
    const next: string[] = []
    for (const id of frontier) {
      const current = state.provinces[id]
      if (!current) continue
      for (const neighbour of [...current.neighbors, ...current.seaLinks]) {
        if (seen.has(neighbour)) continue
        seen.add(neighbour)
        if (neighbour === capital) return depth
        next.push(neighbour)
      }
    }
    frontier = next
  }
  return limit + 1
}

/** Where morale is heading, from all the factors in design D6.3. */
export function targetMoraleFor(state: GameState, province: Province, ctx: PhaseContext): Fixed {
  const rules = ctx.rules
  if (!province.owner) return rules.constants.baseTargetMorale

  let target = rules.constants.baseTargetMorale

  // Distance from the capital is a penalty (belegt), which is why the base value of
  // 102 sits above the ceiling of 100: a province only reaches full morale when
  // everything is right at once.
  const distance = distanceToCapital(state, province, ctx)
  const range = rules.constants.capitalDistanceRange
  const reach = Math.min(distance, range)
  // eslint-disable-next-line no-restricted-syntax -- distance x range scaling before the single division
  target -= mulChain([rules.constants.capitalDistancePenalty, divFixed(reach * ONE, range)])

  // Over-expansion: every province beyond a comfortable core costs morale empire-wide.
  const held = state.provinceOrder.filter((id) => state.provinces[id]!.owner === province.owner).length
  const excess = Math.max(0, held - rules.constants.expansionFreeProvinces)
  target -= Math.min(
    rules.constants.expansionPenaltyMax,
    // eslint-disable-next-line no-restricted-syntax -- penalty per province x count, plain integers
    rules.constants.expansionPenaltyPerProvince * excess,
  )

  // Neighbours: friendly ones steady the province, hostile ones unsettle it.
  let friendly = 0
  let hostile = 0
  for (const id of province.neighbors) {
    const other = state.provinces[id]
    if (!other) continue
    if (other.owner === province.owner) friendly += 1
    else if (other.owner && atWar(state, province.owner, other.owner)) hostile += 1
  }
  // eslint-disable-next-line no-restricted-syntax -- bonus per neighbour x count, plain integers
  target += Math.min(rules.constants.ownNeighborBonusMax, rules.constants.ownNeighborBonus * friendly)
  // eslint-disable-next-line no-restricted-syntax -- penalty per neighbour x count, plain integers
  target -= Math.min(rules.constants.enemyNeighborPenaltyMax, rules.constants.enemyNeighborPenalty * hostile)

  // Buildings that keep people content (belegt: railway +15, harbour +10, fortress +5/level).
  for (const [key, level] of Object.entries(province.buildings)) {
    if (!level) continue
    const rule = rules.buildings[key as keyof typeof rules.buildings]
    // eslint-disable-next-line no-restricted-syntax -- morale bonus per level x level, plain integers
    if (rule?.moraleBonus) target += rule.moraleBonus * level
  }

  // Food: a fed province is a calm province.
  const player = state.players[province.owner]
  if (player?.shortages.includes('food')) target -= rules.constants.foodShortagePenalty
  else if ((player?.resources.food ?? 0) > 0) target += rules.constants.foodSurplusBonus

  // Occupation wears off over time.
  if (province.occupiedSince !== null) {
    // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
    const window = rules.constants.occupationPenaltyDays * rules.constants.ticksPerDay
    const elapsed = state.tick - province.occupiedSince
    if (elapsed < window) {
      // eslint-disable-next-line no-restricted-syntax -- scaling to permille before the single division
      const remaining = divFixed((window - elapsed) * ONE, window)
      target -= mulChain([rules.constants.occupationPenalty, remaining])
    }
  }

  if (player?.capitalLostUntil !== null && player !== undefined && state.tick < (player.capitalLostUntil ?? 0)) {
    target -= rules.constants.capitalLossMoralePenalty
  }

  // The target may exceed 100 — the original calls it "max morale" and puts its base
  // at 102. Only the *current* value is capped, in settleMorale. Capping the target
  // here would flatten every factor into the same number and make good governance
  // indistinguishable from neglect.
  return clampFixed(target, 0, 200_000)
}

/** Revolt chance per game day (belegt: (33 − morale) × 3 %). */
export function revoltChance(morale: Fixed, rules: Rules): Fixed {
  const threshold = rules.constants.revoltThreshold
  if (morale >= threshold) return 0
  // eslint-disable-next-line no-restricted-syntax -- morale points x permille per point, plain integers
  const raw = Math.trunc(((threshold - morale) / 1000) * rules.constants.revoltChancePerPointPermille)
  return clampFixed(raw, 0, ONE)
}

/** Daily morale settlement — drift towards the target, then the revolt roll. */
export function settleMorale(draft: GameState, ctx: PhaseContext): void {
  const rules = ctx.rules

  for (const provinceId of draft.provinceOrder) {
    const province = draft.provinces[provinceId]!
    province.targetMorale = targetMoraleFor(draft, province, ctx)

    const gap = province.targetMorale - province.morale
    const stepSize = divFixed(gap, rules.constants.moraleDriftDivisor)
    province.morale = clampFixed(province.morale + stepSize, 0, 100_000)

    if (!province.owner) continue

    const risk = revoltChance(province.morale, rules)
    if (risk > 0 && chance(draft.rng, risk)) {
      const previousOwner = province.owner
      province.owner = null
      province.morale = rules.constants.capturedMorale
      province.occupiedSince = draft.tick
      province.buildQueue = []
      province.recruitQueue = []

      // Ein Aufstand geht den an, dem die Provinz gerade abhandenkommt (T-M15-01).
      emit(ctx.events, draft.tick, 'PROVINCE_REVOLTED', {
        provinceId,
        previousOwner,
        morale: province.morale,
        concerns: previousOwner ? [previousOwner] : [],
      })
    }
  }
}
