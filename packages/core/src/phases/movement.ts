import { emit } from '../events/emit'
import { findPath } from '../map/pathfinding'
import { canUseSea, edgeBetween, edgeTravelTicks } from '../rules/movement'
import type { Army, GameState, ProvinceId, Tick } from '../state/types'
import type { PhaseContext } from './index'
import type { Phase } from './index'
import type { Rules } from '../rules/types'
import type { MapData } from '../state/types'

/**
 * Army movement (R-UNIT-04/05, design D3 phase 7).
 *
 * Two rules that shape the whole war: an army entering a province held by enemy land
 * units stops there — no marching past a defender — and every departure costs a
 * deployment delay during which the army fights at reduced strength.
 */

export interface PlannedRoute {
  path: ProvinceId[]
  arrivalTick: Tick
  totalTicks: number
}

/** Plans a route and its arrival time. Used by the command *and* by the interface. */
export function planRoute(
  state: GameState,
  army: Army,
  target: ProvinceId,
  map: MapData,
  rules: Rules,
): PlannedRoute | null {
  const sea = canUseSea(army, rules)
  const result = findPath(map, army.locationProvinceId, target, {
    canUseSea: sea,
    edgeCost: (edge, from, to) => edgeTravelTicks(state, army, edge, from, to, rules),
  })
  if (!result || result.path.length === 0) return null

  return {
    path: result.path,
    arrivalTick: state.tick + result.cost,
    totalTicks: result.cost,
  }
}

/** Enemy land units sitting in a province stop an army that enters it. */
export function hasHostileLandForces(state: GameState, provinceId: ProvinceId, playerId: string, rules: Rules): boolean {
  for (const armyId of state.armyOrder) {
    const other = state.armies[armyId]
    if (!other || other.owner === playerId) continue
    if (other.locationProvinceId !== provinceId || other.embarked) continue

    const key = playerId < other.owner ? `${playerId}|${other.owner}` : `${other.owner}|${playerId}`
    if (state.diplomacy.relations[key]?.state !== 'war') continue

    const hasLand = other.units.some((stack) => {
      const rule = rules.units[stack.unitKey]
      return rule && rule.class !== 'air' && rule.class !== 'navy'
    })
    if (hasLand) return true
  }
  return false
}

export const movement: Phase = (draft: GameState, ctx: PhaseContext) => {
  const { map, rules } = ctx

  for (const armyId of draft.armyOrder) {
    const army = draft.armies[armyId]
    if (!army || army.path.length === 0 || army.arrivalTick === null) continue
    if (draft.tick + 1 < army.arrivalTick) continue

    const from = army.locationProvinceId
    const next = army.path[0]!
    const travelled = edgeBetween(map.edges, map.edgesByProvince[from], from, next)

    army.locationProvinceId = next
    army.path = army.path.slice(1)

    // A sea leg means the army is afloat; it disembarks on reaching its destination.
    army.embarked = travelled?.kind === 'sea' && army.path.length > 0

    const blocked = hasHostileLandForces(draft, next, army.owner, rules)
    if (blocked || army.path.length === 0) {
      // Arrived — either at the destination or stopped by a defender.
      army.path = []
      army.arrivalTick = null
      army.departureTick = null
      army.embarked = false

      emit(ctx.events, draft.tick, 'ARMY_ARRIVED', {
        playerId: army.owner,
        armyId: army.id,
        provinceId: next,
        audience: [army.owner],
      })
      continue
    }

    const following = army.path[0]!
    const nextEdge = edgeBetween(map.edges, map.edgesByProvince[next], next, following)
    if (!nextEdge) {
      army.path = []
      army.arrivalTick = null
      continue
    }
    army.arrivalTick = draft.tick + 1 + edgeTravelTicks(draft, army, nextEdge, next, following, rules)
  }
}
