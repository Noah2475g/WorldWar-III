import type { Command } from './commands/types'
import type { GameEvent } from './events/types'
import type { ArmyId, GameState, PlayerId, ProvinceId, Tick } from './state/types'
import { step, type StepContext } from './step'

/**
 * Game time lives here (R-TIME-01, R-TIME-05).
 *
 * The core knows ticks and nothing else — no wall clock, no timers, no frames. That is
 * what makes fast-forward possible at all: the same function that runs one game hour
 * runs ten thousand, and the result is identical either way. The interface decides how
 * fast to call it; the simulation never notices the difference.
 */

export type FastForwardTarget =
  | { kind: 'ticks'; ticks: number }
  | { kind: 'days'; days: number }
  | { kind: 'nextDay' }
  | { kind: 'buildComplete'; playerId?: PlayerId; provinceId?: ProvinceId }
  | { kind: 'armyArrived'; playerId?: PlayerId; armyId?: ArmyId }
  | { kind: 'battleStarts'; playerId?: PlayerId }

export type StopReason = 'target' | 'alert' | 'limit'

export interface FastForwardOptions {
  /** Commands to inject for a given tick — how the AI feeds the simulation. */
  /**
   * Die Befehle dieses Ticks. Bekommt den **Zustand**, nicht nur den Tick (T-M15-06).
   *
   * Der Grund ist die KI: sie entscheidet aus der Lage, und mit einer Tickzahl allein
   * konnte sie hier gar nicht aufgerufen werden. Deshalb rief bis zum 2026-09-06 kein
   * einziger Spieler-Pfad `fastForward` — die Oberfläche rechnete stattdessen ihre eigene
   * Schleife, und der Kern hatte eine Betriebsart, die niemand ausführte.
   */
  commandSource?: (state: GameState) => readonly Command[]
  /**
   * Läuft nach jedem Tick auf dem **neuen** Zustand.
   *
   * Nur für das, was zum Tick gehört und nicht in den Zustand des Kerns: das Gedächtnis
   * der KI wird so mitgeführt, ohne dass der Kern die KI kennen muss (R-ARCH-01).
   */
  afterTick?: (state: GameState, events: readonly GameEvent[]) => void
  /**
   * Whose alerts interrupt. Usually the human player: skipping three game days and
   * only then learning that a province fell is the worst thing this game could do.
   */
  alertsFor?: PlayerId | null
  /** Hard ceiling so a target that never occurs cannot spin forever. */
  maxTicks?: number
  /** Extra stop conditions, evaluated after every tick. */
  guards?: ((state: GameState, events: readonly GameEvent[]) => boolean)[]
}

export interface RunResult {
  state: GameState
  events: GameEvent[]
}

export interface FastForwardResult extends RunResult {
  ticksRun: number
  stoppedBy: StopReason
  /** The event that ended the run, when it was an alert or a target event. */
  trigger: GameEvent | null
}

export const DEFAULT_MAX_TICKS = 100_000

/** Run exactly `ticks` game hours. No clock involved — only counting. */
export function runTicks(
  state: GameState,
  ticks: number,
  ctx: StepContext,
  commandSource?: (tick: Tick) => readonly Command[],
): RunResult {
  if (!Number.isSafeInteger(ticks) || ticks < 0) {
    throw new RangeError(`Tickzahl muss eine nicht-negative ganze Zahl sein, war: ${ticks}`)
  }

  let current = state
  const collected: GameEvent[] = []
  for (let i = 0; i < ticks; i++) {
    const result = step(current, commandSource?.(current.tick) ?? [], ctx)
    current = result.state
    collected.push(...result.events)
  }
  return { state: current, events: collected }
}

/** Does this tick's outcome satisfy the fast-forward target? */
export function targetReached(
  target: FastForwardTarget,
  events: readonly GameEvent[],
  state: GameState,
  ticksRun: number,
  ticksPerDay: number,
): GameEvent | true | false {
  switch (target.kind) {
    case 'ticks':
      return ticksRun >= target.ticks
    case 'days':
      // eslint-disable-next-line no-restricted-syntax -- plain integer bookkeeping: days x ticks-per-day, no Fixed values involved
      return ticksRun >= target.days * ticksPerDay
    case 'nextDay':
      return state.tick % ticksPerDay === 0
    case 'buildComplete':
      return (
        events.find(
          (event) =>
            event.type === 'BUILD_COMPLETED' &&
            (!target.playerId || event.playerId === target.playerId) &&
            (!target.provinceId || event.provinceId === target.provinceId),
        ) ?? false
      )
    case 'armyArrived':
      return (
        events.find(
          (event) =>
            event.type === 'ARMY_ARRIVED' &&
            (!target.playerId || event.playerId === target.playerId) &&
            (!target.armyId || event.armyId === target.armyId),
        ) ?? false
      )
    case 'battleStarts':
      return (
        events.find(
          (event) =>
            event.type === 'BATTLE_STARTED' &&
            (!target.playerId || event.sides.some((side) => side.includes(target.playerId!))),
        ) ?? false
      )
  }
}

/**
 * The first alert this player must see before time moves on (R-TIME-03/AK1).
 *
 * Two conditions, and until 2026-09-06 only the first: he must be allowed to read it
 * (`audience`) **and** it must be about him (`concerns`, T-M15-01). Without the second,
 * every public alert stopped everybody — a capture between two foreign powers halted an
 * uninvolved player's fast-forward, which on an eight-power world map meant it could not
 * run three game days. An alert without any party named stops nobody: that is the safe
 * direction of the mistake, and the property test in events/audience.test.ts makes sure
 * the situation does not arise in play.
 */
export function firstAlertFor(
  events: readonly GameEvent[],
  playerId: PlayerId | null | undefined,
): GameEvent | null {
  if (!playerId) return null
  return (
    events.find(
      (event) =>
        event.severity === 'alert' &&
        (event.audience.length === 0 || event.audience.includes(playerId)) &&
        event.concerns.includes(playerId),
    ) ?? null
  )
}

/**
 * Run until the target is reached — or until something happens that the player has to
 * see. No rendering, no snapshots, no per-event notification: this is the mode that
 * makes thousands of game hours per second possible (design D5, mode b).
 */
export function fastForward(
  state: GameState,
  target: FastForwardTarget,
  ctx: StepContext,
  options: FastForwardOptions = {},
): FastForwardResult {
  const maxTicks = options.maxTicks ?? DEFAULT_MAX_TICKS
  const ticksPerDay = ctx.rules.constants.ticksPerDay

  let current = state
  const collected: GameEvent[] = []
  let ticksRun = 0

  while (ticksRun < maxTicks) {
    const result = step(current, options.commandSource?.(current) ?? [], ctx)
    current = result.state
    ticksRun += 1
    collected.push(...result.events)
    options.afterTick?.(current, result.events)

    const alert = firstAlertFor(result.events, options.alertsFor)
    if (alert) {
      return { state: current, events: collected, ticksRun, stoppedBy: 'alert', trigger: alert }
    }

    for (const guard of options.guards ?? []) {
      if (guard(current, result.events)) {
        return { state: current, events: collected, ticksRun, stoppedBy: 'alert', trigger: null }
      }
    }

    const reached = targetReached(target, result.events, current, ticksRun, ticksPerDay)
    if (reached) {
      return {
        state: current,
        events: collected,
        ticksRun,
        stoppedBy: 'target',
        trigger: reached === true ? null : reached,
      }
    }
  }

  return { state: current, events: collected, ticksRun, stoppedBy: 'limit', trigger: null }
}
