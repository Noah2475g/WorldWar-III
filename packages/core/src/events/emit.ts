import type { PlayerId, Tick } from '../state/types'
import { isAlertType, type GameEvent } from './types'

/**
 * Builds an event with the boring parts filled in.
 *
 * Severity is derived from the type rather than passed in: whether losing a province
 * interrupts fast-forward must not depend on the call site that happens to report it.
 */
export function emit<T extends GameEvent['type']>(
  events: GameEvent[],
  tick: Tick,
  type: T,
  payload: Omit<Extract<GameEvent, { type: T }>, 'type' | 'tick' | 'severity' | 'audience'> & {
    audience?: PlayerId[]
  },
): void {
  const { audience, ...rest } = payload as { audience?: PlayerId[] } & Record<string, unknown>
  events.push({
    type,
    tick,
    severity: isAlertType(type) ? 'alert' : 'info',
    audience: audience ?? [],
    ...rest,
  } as GameEvent)
}

/** Events a given player may see. Empty audience means public. */
export function eventsFor(events: readonly GameEvent[], playerId: PlayerId): GameEvent[] {
  return events.filter((event) => event.audience.length === 0 || event.audience.includes(playerId))
}

export function alertsIn(events: readonly GameEvent[]): GameEvent[] {
  return events.filter((event) => event.severity === 'alert')
}
