import type { Command, FastForwardTarget, GameEvent, PublicView, StopReason } from '@worldwar/core'

/**
 * The wire between interface and simulation (T-M10-02, design D-03).
 *
 * Everything the two sides say to each other is named here, and the message types are
 * the enforcement point for the fog of war (R-DIP-04): no message carries a GameState,
 * so no amount of poking at the interface — or at a memory dump of it — reveals what
 * the player has not seen. `GameState` is deliberately not imported in this file.
 */

/** Interface → simulation. */
export type SimRequest =
  | { kind: 'setSpeed'; hoursPerSecond: number }
  | { kind: 'command'; command: Command }
  | { kind: 'fastForward'; target: FastForwardTarget }
  | { kind: 'abortFastForward' }
  | { kind: 'requestView' }

/** Simulation → interface. */
export type SimMessage =
  | { kind: 'view'; view: PublicView }
  | { kind: 'events'; events: readonly GameEvent[] }
  | { kind: 'digest'; day: number; counts: Record<string, number>; alerts: readonly GameEvent[] }
  | { kind: 'fastForwardProgress'; ticksRun: number }
  | { kind: 'fastForwardDone'; ticksRun: number; stoppedBy: FastForwardStop; trigger: GameEvent | null }
  | { kind: 'rejected'; reason: string }

/** Fast-forward can end for the core's reasons or because the player pressed stop. */
export type FastForwardStop = StopReason | 'aborted'

/** What the host needs from a worker — narrow enough to fake in a test. */
export interface SimPort {
  post(request: SimRequest): void
  subscribe(listener: (message: SimMessage) => void): () => void
}
