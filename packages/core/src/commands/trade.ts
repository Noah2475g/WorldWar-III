import { emit } from '../events/emit'
import { exchangeAmount, recordDemand } from '../rules/market'
import type { GameState } from '../state/types'
import { registerCommand } from './registry'
import { fail, ok, type TradeCommand } from './types'

/** Smallest sensible trade; below this the price movement rounds to nothing anyway. */
export const MIN_TRADE_AMOUNT = 1000

/**
 * Trading on the exchange (R-ECON-05, T-M3-06).
 *
 * The price is the same for everyone and is frozen for the duration of the tick, so
 * the first player in turn order does not get a better deal than the last. That is
 * the whole difference between a market and a pay-to-win shop.
 */
registerCommand<TradeCommand>('TRADE', {
  check: (state: GameState, command) => {
    if (command.give === command.want) return fail('INVALID_TARGET', { reason: 'gleiche Ressource' })
    if (!Number.isSafeInteger(command.giveAmount) || command.giveAmount < MIN_TRADE_AMOUNT) {
      return fail('INVALID_TARGET', { giveAmount: command.giveAmount })
    }

    const player = state.players[command.playerId]!
    if (player.resources[command.give] < command.giveAmount) {
      return fail('INSUFFICIENT_RESOURCES', { resource: command.give })
    }

    if (exchangeAmount(state.market, command.give, command.giveAmount, command.want) <= 0) {
      return fail('INVALID_TARGET', { reason: 'Gegenwert zu klein' })
    }
    return ok
  },

  apply: (draft, command, ctx) => {
    const player = draft.players[command.playerId]!
    const wantAmount = exchangeAmount(draft.market, command.give, command.giveAmount, command.want)

    player.resources[command.give] -= command.giveAmount
    player.resources[command.want] += wantAmount

    // Demand is collected now and priced in at the end of the tick.
    recordDemand(draft.market, command.give, command.giveAmount, command.want, wantAmount)

    emit(ctx.events, draft.tick, 'TRADE_EXECUTED', {
      playerId: command.playerId,
      give: command.give,
      giveAmount: command.giveAmount,
      want: command.want,
      wantAmount,
      audience: [command.playerId],
    })
  },
})
