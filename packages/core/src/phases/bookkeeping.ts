import { settleMarket } from '../rules/market'
import { updateIntel } from '../view/intel'
import type { GameEvent } from '../events/types'
import type { Phase } from './index'

/**
 * Closes the hour: advance game time and file this tick's events.
 *
 * The log is a ring buffer. At high speed the simulation produces events far faster
 * than anyone can read them, and an unbounded list would grow into the save file
 * (design D5, "Ereignisse werden verdichtet").
 */
export const EVENT_LOG_LIMIT = 500

/**
 * Ereignisse ins Protokoll haengen und den Deckel einhalten.
 *
 * Steht hier als eigener Griff, weil `step` ihn ein zweites Mal braucht: was am
 * Tagesende entsteht, entsteht NACH dieser Phase und muss nachgetragen werden (T-M12-09).
 * Zwei Kopien des Deckels waeren zwei Stellen, an denen er sich aendern kann.
 */
export function appendEvents(log: GameEvent[], events: readonly GameEvent[]): void {
  if (events.length === 0) return
  log.push(...events)
  if (log.length > EVENT_LOG_LIMIT) {
    log.splice(0, log.length - EVENT_LOG_LIMIT)
  }
}

export const bookkeeping: Phase = (draft, ctx) => {
  // Prices move once per tick, after every trade has been settled at the frozen rate.
  settleMarket(draft.market, ctx.rules, draft.tick % ctx.rules.constants.ticksPerDay === 0)

  // What each player can see right now becomes what they remember (R-DIP-04).
  updateIntel(draft)

  draft.tick += 1

  appendEvents(draft.eventLog, ctx.events)
}
