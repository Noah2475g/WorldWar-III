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
  payload: Omit<Extract<GameEvent, { type: T }>, 'type' | 'tick' | 'severity' | 'audience' | 'concerns'> & {
    audience?: PlayerId[]
    concerns?: PlayerId[]
  },
): void {
  const { audience, concerns, ...rest } = payload as {
    audience?: PlayerId[]
    concerns?: PlayerId[]
  } & Record<string, unknown>
  events.push({
    type,
    tick,
    severity: isAlertType(type) ? 'alert' : 'info',
    audience: audience ?? [],
    // Default: whoever may read it is whom it concerns. That is right for every private
    // event and wrong for exactly the case this field exists for — a public alert, where
    // the audience is empty. Those name their parties at the call site (T-M15-01).
    concerns: concerns ?? audience ?? [],
    ...rest,
  } as GameEvent)
}

/** Events a given player may see. Empty audience means public. */
export function eventsFor(events: readonly GameEvent[], playerId: PlayerId): GameEvent[] {
  return events.filter((event) => event.audience.length === 0 || event.audience.includes(playerId))
}

/** Whether an event is addressed to this player — not merely readable by them. */
export function concernsPlayer(event: GameEvent, playerId: PlayerId): boolean {
  return event.concerns.includes(playerId)
}

export function alertsIn(events: readonly GameEvent[]): GameEvent[] {
  return events.filter((event) => event.severity === 'alert')
}
