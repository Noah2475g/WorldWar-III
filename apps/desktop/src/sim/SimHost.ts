import type { Command, FastForwardTarget, GameEvent, PublicView } from '@worldwar/core'
import type { FastForwardStop, SimMessage, SimPort } from './protocol'

/**
 * The interface side of the wire (T-M10-02).
 *
 * The host owns no simulation — it owns the last picture of one, plus the knobs. It
 * never sees a GameState, and that is the point: the fog of war holds even against the
 * person holding the debugger (R-DIP-04).
 */

/**
 * Detents on the speed control (design D5, mode a). Between them the value is free;
 * these are what the buttons and the arrow keys snap to.
 */
export const SPEED_STOPS = [0, 1, 2, 5, 10, 25, 50, 100] as const

export interface FastForwardProgress {
  ticksRun: number
  running: boolean
  stoppedBy: FastForwardStop | null
  trigger: GameEvent | null
}

export type HostListener = (host: SimHost) => void

export class SimHost {
  readonly #port: SimPort
  readonly #unsubscribe: () => void
  readonly #listeners = new Set<HostListener>()

  #speed = 0
  #view: PublicView | null = null
  #events: GameEvent[] = []
  #fastForward: FastForwardProgress = { ticksRun: 0, running: false, stoppedBy: null, trigger: null }

  constructor(port: SimPort) {
    this.#port = port
    this.#unsubscribe = port.subscribe((message) => {
      this.#receive(message)
    })
  }

  get speed(): number {
    return this.#speed
  }

  get view(): PublicView | null {
    return this.#view
  }

  /** Events since the last time the interface took them. */
  get events(): readonly GameEvent[] {
    return this.#events
  }

  get fastForward(): FastForwardProgress {
    return this.#fastForward
  }

  /** Clamped to the interactive range; the value itself may sit between detents. */
  setSpeed(hoursPerSecond: number): void {
    const last = SPEED_STOPS[SPEED_STOPS.length - 1]!
    this.#speed = Math.max(0, Math.min(last, hoursPerSecond))
    this.#port.post({ kind: 'setSpeed', hoursPerSecond: this.#speed })
  }

  pause(): void {
    this.setSpeed(0)
  }

  /** The next detent up or down — what the speed buttons do. */
  stepSpeed(direction: 1 | -1): void {
    const index = SPEED_STOPS.findIndex((stop) => stop >= this.#speed)
    const current = index === -1 ? SPEED_STOPS.length - 1 : index
    const next = Math.max(0, Math.min(SPEED_STOPS.length - 1, current + direction))
    this.setSpeed(SPEED_STOPS[next]!)
  }

  send(command: Command): void {
    this.#port.post({ kind: 'command', command })
  }

  requestFastForward(target: FastForwardTarget): void {
    this.#fastForward = { ticksRun: 0, running: true, stoppedBy: null, trigger: null }
    this.#port.post({ kind: 'fastForward', target })
  }

  abortFastForward(): void {
    this.#port.post({ kind: 'abortFastForward' })
  }

  takeEvents(): readonly GameEvent[] {
    const taken = this.#events
    this.#events = []
    return taken
  }

  subscribe(listener: HostListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  dispose(): void {
    this.#unsubscribe()
    this.#listeners.clear()
  }

  #receive(message: SimMessage): void {
    switch (message.kind) {
      case 'view':
        this.#view = message.view
        break
      case 'events':
        this.#events = [...this.#events, ...message.events]
        break
      case 'digest':
        this.#events = [...this.#events, ...message.alerts]
        break
      case 'fastForwardProgress':
        this.#fastForward = { ...this.#fastForward, ticksRun: message.ticksRun, running: true }
        break
      case 'fastForwardDone':
        this.#fastForward = {
          ticksRun: message.ticksRun,
          running: false,
          stoppedBy: message.stoppedBy,
          trigger: message.trigger,
        }
        break
      case 'rejected':
        break
    }
    for (const listener of this.#listeners) listener(this)
  }
}
