import { emit } from '../events/emit'
import { exchangeAmount, recordDemand } from '../rules/market'
import type { GameState } from '../state/types'
import { registerCommand } from './registry'
import { fail, ok, type TradeCommand } from './types'

/** Smallest sensible trade; below this the price movement rounds to nothing anyway. */
export const MIN_TRADE_AMOUNT = 1000

/**
 * Largest amount one TRADE may give (T-M43-03, M17-U1). Ten times the largest storage limit
 * (1 000 000 000, data/rules/default/resources.json), so no stored good ever reaches it; money
 * is uncapped but measured below 1 500 000 in 200 days. Chosen so that a legal trade never
 * saturates exchangeAmount (x marketMaxPrice) and one trade at extreme prices still fits the
 * demand arithmetic of settleMarket (x marketMaxPrice / marketMinPrice x 1000); market.test.ts
 * holds both against the shipped rules. Not a rule number: a technical bound, like the minimum.
 */
export const MAX_TRADE_AMOUNT = 10_000_000_000

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
    if (command.giveAmount > MAX_TRADE_AMOUNT) {
      return fail('INVALID_TARGET', { giveAmount: command.giveAmount, reason: 'Menge zu groß' })
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
