import { ONE, divFixed, mulChain, type Fixed } from '@worldwar/shared'
import type { Rules } from './types'
import type { Army, Edge, GameState, PlayerId, Province, ProvinceId, Terrain } from '../state/types'

/**
 * Movement speed and travel time (R-UNIT-04, design D6.4).
 *
 * The factors for foreign and hostile ground and for railways are belegt from the
 * original; the terrain factors are estimates. Everything funnels through
 * `edgeTravelTicks`, so the arrival time shown before an order and the arrival that
 * actually happens come from the same function (R-UNIT-04/AK1).
 */

export const TERRAIN_FACTORS: Record<Terrain, Fixed> = {
  plains: 1000,
  forest: 800,
  mountain: 600,
  desert: 900,
  urban: 1000,
}

/** Slowest unit sets the pace of the whole army. */
export function armySpeed(army: Army, rules: Rules): Fixed {
  let slowest = Number.MAX_SAFE_INTEGER
  for (const stack of army.units) {
    const rule = rules.units[stack.unitKey]
    if (rule) slowest = Math.min(slowest, rule.speedKmh)
  }
  return slowest === Number.MAX_SAFE_INTEGER ? 0 : slowest
}

/** Belegt: foreign ground costs 30 %, hostile ground 65 % of your speed. */
export function territoryFactor(
  state: GameState,
  province: Province,
  playerId: PlayerId,
  rules: Rules,
): Fixed {
  if (province.owner === playerId) return ONE
  if (province.owner === null) return rules.constants.foreignTerritoryFactor

  const key = playerId < province.owner ? `${playerId}|${province.owner}` : `${province.owner}|${playerId}`
  const relation = state.diplomacy.relations[key]
  if (relation?.state === 'war') return rules.constants.hostileTerritoryFactor
  return rules.constants.foreignTerritoryFactor
}

/** Belegt: a railway multiplies movement by 2.5 at full level. */
export function railwayFactor(province: Province, rules: Rules): Fixed {
  const level = province.buildings.railway ?? 0
  if (level === 0) return ONE
  const bonus = rules.buildings.railway.effects.movementBonusPermille ?? 0
  // eslint-disable-next-line no-restricted-syntax -- permille bonus x level, plain integers
  return Math.min(rules.constants.railwayFactor, ONE + bonus * level)
}

/**
 * Travel time along one edge, in ticks.
 *
 * Oil shortage halves the pace — mechanised armies stop being fast the moment the
 * fuel runs out (design D6.2).
 */
export function edgeTravelTicks(
  state: GameState,
  army: Army,
  edge: Edge,
  from: ProvinceId,
  to: ProvinceId,
  rules: Rules,
): number {
  const speed = armySpeed(army, rules)
  if (speed <= 0) return Number.MAX_SAFE_INTEGER

  const fromProvince = state.provinces[from]!
  const toProvince = state.provinces[to]!

  const factors: Fixed[] = [
    railwayFactor(fromProvince, rules),
    territoryFactor(state, toProvince, army.owner, rules),
  ]

  if (edge.kind === 'land') {
    factors.push(TERRAIN_FACTORS[toProvince.terrain])
  }

  const player = state.players[army.owner]
  if (player?.shortages.includes('oil')) factors.push(500)

  const effectiveSpeed = mulChain([speed, ...factors])
  if (effectiveSpeed <= 0) return Number.MAX_SAFE_INTEGER

  // distance / speed, both in Fixed, rounded up: an hour begun is an hour spent.
  const ticks = Math.ceil(divFixed(edge.distanceKm * ONE, effectiveSpeed) / ONE)
  return Math.max(1, ticks)
}

/** Edge connecting two provinces, or undefined if they are not neighbours. */
export function edgeBetween(
  edges: readonly Edge[],
  indices: readonly number[] | undefined,
  from: ProvinceId,
  to: ProvinceId,
): Edge | undefined {
  for (const index of indices ?? []) {
    const edge = edges[index]
    if (!edge) continue
    if ((edge.a === from && edge.b === to) || (edge.a === to && edge.b === from)) return edge
  }
  return undefined
}

/** Can this army use sea routes? Ships always, land units only when carried. */
export function canUseSea(army: Army, rules: Rules): boolean {
  let capacity = 0
  let landUnits = 0
  for (const stack of army.units) {
    const rule = rules.units[stack.unitKey]
    if (!rule) continue
    if (rule.transportCapacity) {
      // eslint-disable-next-line no-restricted-syntax -- capacity per ship x ship count, plain integers
      capacity += rule.transportCapacity * Math.ceil(stack.hpTotal / rule.hpPerUnit)
    }
    if (rule.class !== 'navy' && rule.class !== 'air') {
      landUnits += Math.ceil(stack.hpTotal / rule.hpPerUnit)
    }
  }
  return landUnits === 0 || capacity >= landUnits
}
