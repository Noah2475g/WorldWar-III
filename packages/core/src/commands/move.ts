import { emit } from '../events/emit'
import { planRoute } from '../phases/movement'
import type { PhaseContext } from '../phases/index'
import { edgeBetween, edgeTravelTicks, isAirFormation } from '../rules/movement'
import type { Army, GameState, ProvinceId } from '../state/types'
import { registerCommand } from './registry'
import { fail, ok, type MoveArmyCommand } from './types'

/** Ticks to the first waypoint — the movement phase advances one leg at a time. */
function firstLegTicks(state: GameState, army: Army, next: ProvinceId, ctx: PhaseContext): number {
  const edge = edgeBetween(ctx.map.edges, ctx.map.edgesByProvince[army.locationProvinceId], army.locationProvinceId, next)
  if (!edge) return 1
  return edgeTravelTicks(state, army, edge, army.locationProvinceId, next, ctx.rules)
}

/** Days an order may wait before it starts — long enough to plan, short enough to stay legible. */
export const MAX_DEPART_DELAY_DAYS = 14

/** The requested hold, normalised: absent, negative and fractional values all mean "leave now". */
function departDelay(command: MoveArmyCommand, ticksPerDay: number): number {
  const raw = command.departInTicks
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return 0
  return Math.min(Math.trunc(raw), MAX_DEPART_DELAY_DAYS * ticksPerDay)
}

/**
 * Ordering an army to march (R-UNIT-04, T-M4-02).
 *
 * The route is planned with the same cost function the movement phase uses, so the
 * arrival time reported here is the arrival time that happens (R-UNIT-04/AK1).
 */
registerCommand<MoveArmyCommand>('MOVE_ARMY', {
  check: (state: GameState, command, ctx) => {
    const army = state.armies[command.armyId]
    if (!army) return fail('ARMY_NOT_FOUND', { armyId: command.armyId })
    if (army.owner !== command.playerId) return fail('NOT_OWNER', { armyId: command.armyId })
    if (army.units.length === 0) return fail('INVALID_TARGET', { reason: 'leere Armee' })

    const target = state.provinces[command.targetProvinceId]
    if (!target) return fail('PROVINCE_NOT_FOUND', { provinceId: command.targetProvinceId })
    if (target.id === army.locationProvinceId) {
      return fail('INVALID_TARGET', { reason: 'bereits dort' })
    }

    // Aircraft are bound to their airfields; they strike at range instead of marching
    // (R-UNIT-08 — full sortie orders with return flights are V2).
    if (isAirFormation(army, ctx.rules)) {
      const ownsField = target.owner === command.playerId && (target.buildings.airfield ?? 0) > 0
      if (!ownsField) return fail('INVALID_TARGET', { reason: 'kein eigener Flugplatz' })
    }

    if (!planRoute(state, army, command.targetProvinceId, ctx.map, ctx.rules)) {
      return fail('NO_PATH', { from: army.locationProvinceId, to: command.targetProvinceId })
    }
    return ok
  },

  apply: (draft, command, ctx) => {
    const army = draft.armies[command.armyId]!
    const route = planRoute(draft, army, command.targetProvinceId, ctx.map, ctx.rules)!
    // A delayed order shifts every tick of the march by the same amount — nothing else
    // about it changes, which is why the movement phase needs no knowledge of it.
    const delay = departDelay(command, ctx.rules.constants.ticksPerDay)
    const departAt = draft.tick + delay

    army.path = route.path
    army.departureTick = departAt
    // `arrivalTick` tracks the *next leg*; the event reports the arrival at the
    // destination, which is what the player asked about.
    army.arrivalTick = departAt + firstLegTicks(draft, army, route.path[0]!, ctx)
    // Leaving costs order: the army fights at reduced strength while it forms up.
    // While it is still waiting it stands its ground at full strength (deploymentFactor).
    army.deployDelayUntil = departAt + ctx.rules.constants.deployDelayTicks

    emit(ctx.events, draft.tick, 'ARMY_DEPARTED', {
      playerId: army.owner,
      armyId: army.id,
      fromProvinceId: army.locationProvinceId,
      toProvinceId: command.targetProvinceId,
      arrivalTick: route.arrivalTick + delay,
      audience: [army.owner],
    })
  },
})
