import { settleMarket } from '../rules/market'
import { updateIntel } from '../view/intel'
import type { Phase } from './index'

/**
 * Closes the hour: advance game time and file this tick's events.
 *
 * The log is a ring buffer. At high speed the simulation produces events far faster
 * than anyone can read them, and an unbounded list would grow into the save file
 * (design D5, "Ereignisse werden verdichtet").
 */
export const EVENT_LOG_LIMIT = 500

export const bookkeeping: Phase = (draft, ctx) => {
  // Prices move once per tick, after every trade has been settled at the frozen rate.
  settleMarket(draft.market, ctx.rules, draft.tick % ctx.rules.constants.ticksPerDay === 0)

  // What each player can see right now becomes what they remember (R-DIP-04).
  updateIntel(draft)

  draft.tick += 1

  if (ctx.events.length > 0) {
    draft.eventLog.push(...ctx.events)
    if (draft.eventLog.length > EVENT_LOG_LIMIT) {
      draft.eventLog.splice(0, draft.eventLog.length - EVENT_LOG_LIMIT)
    }
  }
}
