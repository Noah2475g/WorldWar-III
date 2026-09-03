import type { PlayerId, ProvinceId } from '../state/types'
import type { EventType, GameEvent } from './types'

/**
 * Reading the event stream (R-GAME-06, T-M5-04).
 *
 * At a hundred game hours per second the simulation produces events far faster than
 * anyone can read them. Filtering and condensing therefore belong to the reading side,
 * not the writing side: the log keeps everything, the reader decides what to show.
 */

export interface EventFilter {
  types?: readonly EventType[]
  playerId?: PlayerId
  provinceId?: ProvinceId
  severity?: 'info' | 'alert'
  sinceTick?: number
}

function provinceOf(event: GameEvent): ProvinceId | undefined {
  const candidate = event as unknown as Record<string, unknown>
  const value = candidate['provinceId'] ?? candidate['targetProvinceId'] ?? candidate['toProvinceId']
  return typeof value === 'string' ? value : undefined
}

function playerOf(event: GameEvent): PlayerId | undefined {
  const candidate = event as unknown as Record<string, unknown>
  const value = candidate['playerId']
  return typeof value === 'string' ? value : undefined
}

export function filterEvents(events: readonly GameEvent[], filter: EventFilter): GameEvent[] {
  return events.filter((event) => {
    if (filter.types && !filter.types.includes(event.type)) return false
    if (filter.severity && event.severity !== filter.severity) return false
    if (filter.sinceTick !== undefined && event.tick < filter.sinceTick) return false
    if (filter.provinceId && provinceOf(event) !== filter.provinceId) return false
    if (filter.playerId) {
      const visible = event.audience.length === 0 || event.audience.includes(filter.playerId)
      if (!visible) return false
      // A player-specific filter means "about me", not just "visible to me".
      if (playerOf(event) !== undefined && playerOf(event) !== filter.playerId) return false
    }
    return true
  })
}

export interface CondensedEntry {
  day: number
  type: EventType
  count: number
  /** The most recent event of this kind, so the interface can still link somewhere. */
  latest: GameEvent
}

/**
 * Bundles routine events per game day, keeping alerts individual.
 *
 * This is what makes fast-forward readable: three skipped days should produce a short
 * digest plus every alert, not four thousand lines.
 */
export function condenseEvents(
  events: readonly GameEvent[],
  ticksPerDay: number,
): { alerts: GameEvent[]; digest: CondensedEntry[] } {
  const alerts: GameEvent[] = []
  const buckets = new Map<string, CondensedEntry>()

  for (const event of events) {
    if (event.severity === 'alert') {
      alerts.push(event)
      continue
    }
    // eslint-disable-next-line no-restricted-syntax -- tick divided by ticks-per-day, plain integers
    const day = Math.trunc(event.tick / ticksPerDay)
    const key = `${day}:${event.type}`
    const existing = buckets.get(key)
    if (existing) {
      existing.count += 1
      existing.latest = event
    } else {
      buckets.set(key, { day, type: event.type, count: 1, latest: event })
    }
  }

  const digest = [...buckets.values()].sort((a, b) => (a.day !== b.day ? a.day - b.day : a.type < b.type ? -1 : 1))
  return { alerts, digest }
}

/** The most recent events first — what a log panel wants. */
export function recentEvents(events: readonly GameEvent[], limit = 50): GameEvent[] {
  return events.slice(-limit).reverse()
}
