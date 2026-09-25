import './build' // registers BUILD and CANCEL_BUILD
import './recruit' // registers RECRUIT
import './trade' // registers TRADE
import './army' // registers SPLIT_ARMY, MERGE_ARMIES, STOP_ARMY
import './move' // registers MOVE_ARMY
import './bombard' // registers BOMBARD
import './diplomacy' // registers DIPLOMACY
import './tradeOffer' // registers OFFER_TRADE, ACCEPT_TRADE, DECLINE_TRADE, WITHDRAW_TRADE
import './espionage' // registers RECRUIT_SPY, REASSIGN_SPY, DISMISS_SPY
import { emit } from '../events/emit'
import type { PhaseContext } from '../phases/index'
import { STANCE_VALUES, type GameState } from '../state/types'
import { registerCommand } from './registry'
import { fail, ok, type SetCapitalCommand, type SetHoldFireCommand, type SetStanceCommand } from './types'

/**
 * The first two real command handlers.
 *
 * They are the ones that need nothing but the state itself; the rest arrive with the
 * mechanic they belong to (BUILD in T-M3-04, MOVE_ARMY in T-M4-02, …). Registering
 * them here keeps the wiring in one place.
 */

/** Days a player must wait before moving the capital again (design D6.8). */
export const CAPITAL_MOVE_COOLDOWN_DAYS = 30

registerCommand<SetStanceCommand>('SET_STANCE', {
  check: (state: GameState, command) => {
    const army = state.armies[command.armyId]
    if (!army) return fail('ARMY_NOT_FOUND', { armyId: command.armyId })
    if (army.owner !== command.playerId) return fail('NOT_OWNER', { armyId: command.armyId })
    // The value is checked, not trusted (T-M40-01, D30.1): the interface cannot produce a
    // wrong one, but a command in lockstep (D28) comes from another machine.
    if (!STANCE_VALUES.includes(command.stance)) return fail('INVALID_TARGET', { reason: 'unbekannte Haltung' })
    return ok
  },
  apply: (draft, command) => {
    draft.armies[command.armyId]!.stance = command.stance
  },
})

registerCommand<SetHoldFireCommand>('SET_HOLD_FIRE', {
  check: (state: GameState, command) => {
    const army = state.armies[command.armyId]
    if (!army) return fail('ARMY_NOT_FOUND', { armyId: command.armyId })
    if (army.owner !== command.playerId) return fail('NOT_OWNER', { armyId: command.armyId })
    return ok
  },
  apply: (draft, command) => {
    draft.armies[command.armyId]!.holdFire = command.holdFire
  },
})

registerCommand<SetCapitalCommand>('SET_CAPITAL', {
  check: (state: GameState, command, ctx: PhaseContext) => {
    const province = state.provinces[command.provinceId]
    if (!province) return fail('PROVINCE_NOT_FOUND', { provinceId: command.provinceId })
    if (province.owner !== command.playerId) return fail('NOT_OWNER', { provinceId: command.provinceId })
    if (province.kind !== 'city') return fail('INVALID_TARGET', { provinceId: command.provinceId })

    const player = state.players[command.playerId]!
    if (player.capitalProvinceId === command.provinceId) {
      return fail('INVALID_TARGET', { provinceId: command.provinceId })
    }

    // eslint-disable-next-line no-restricted-syntax -- plain integer bookkeeping: days x ticks-per-day, no Fixed values involved
    const cooldownTicks = CAPITAL_MOVE_COOLDOWN_DAYS * ctx.rules.constants.ticksPerDay
    if (player.capitalMovedAtTick !== null && state.tick < player.capitalMovedAtTick + cooldownTicks) {
      return fail('ON_COOLDOWN', {
        readyAtTick: player.capitalMovedAtTick + cooldownTicks,
      })
    }
    return ok
  },
  apply: (draft, command, ctx) => {
    const player = draft.players[command.playerId]!
    player.capitalProvinceId = command.provinceId
    player.capitalMovedAtTick = draft.tick
    // Moving the capital ends the penalty for having lost the old one (D6.8).
    player.capitalLostUntil = null

    emit(ctx.events, draft.tick, 'CAPITAL_MOVED', {
      playerId: command.playerId,
      provinceId: command.provinceId,
    })
  },
})
