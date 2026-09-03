import {
  createInitialState,
  runTicks,
  type Command,
  type GameConfig,
  type GameEvent,
  type GameState,
  type MapData,
  type Rules,
} from '@worldwar/core'

/**
 * Headless game runner (T-M4-06).
 *
 * The first end-to-end proof that the rules make a *game*: build, recruit, march,
 * fight, capture — without a single pixel. Everything after this milestone has to
 * keep this run green.
 */

export interface ScriptedCommand {
  atTick: number
  command: Command
}

export interface RunOptions {
  config: GameConfig
  map: MapData
  rules: Rules
  ticks: number
  script?: ScriptedCommand[]
  /** Called before each tick; lets the AI supply its commands later (M7). */
  commandSource?: (state: GameState) => readonly Command[]
  /** Mutates the freshly created state — used to set up scenarios. */
  setup?: (state: GameState) => void
}

export interface RunResult {
  state: GameState
  events: GameEvent[]
  ticksRun: number
}

export function runGame(options: RunOptions): RunResult {
  const state = createInitialState(options.config, { map: options.map, rules: options.rules })
  options.setup?.(state)

  const byTick = new Map<number, Command[]>()
  for (const entry of options.script ?? []) {
    byTick.set(entry.atTick, [...(byTick.get(entry.atTick) ?? []), entry.command])
  }

  let current = state
  const events: GameEvent[] = []

  for (let i = 0; i < options.ticks; i++) {
    const scripted = byTick.get(current.tick) ?? []
    const dynamic = options.commandSource?.(current) ?? []
    const result = runTicks(current, 1, { map: options.map, rules: options.rules }, () => [
      ...scripted,
      ...dynamic,
    ])
    current = result.state
    events.push(...result.events)

    if (current.victory.winner !== null) break
  }

  return { state: current, events, ticksRun: current.tick - state.tick }
}

/** Counts how often each event type occurred — the quick way to check a run. */
export function eventCounts(events: readonly GameEvent[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const event of events) counts[event.type] = (counts[event.type] ?? 0) + 1
  return counts
}
