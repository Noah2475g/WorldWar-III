import type { PlayerId, ProvinceId, Tick } from '../state/types'

/**
 * Events are the game's output stream: they feed the log, the interface and the
 * AI explanation view (design D-07). They are deliberately kept out of the state
 * hash, so rewording a message never looks like a rule change.
 *
 * This file holds the minimum needed to build a state; T-M1-08 completes the union.
 */

export type EventSeverity = 'info' | 'alert'

export interface BaseEvent {
  tick: Tick
  severity: EventSeverity
  /** Players who should see this event; empty means everyone. */
  audience: PlayerId[]
}

export interface GameStartedEvent extends BaseEvent {
  type: 'GAME_STARTED'
  mapId: string
  playerCount: number
}

export interface CommandRejectedEvent extends BaseEvent {
  type: 'COMMAND_REJECTED'
  playerId: PlayerId
  command: string
  code: string
  provinceId?: ProvinceId
}

export type GameEvent = GameStartedEvent | CommandRejectedEvent
