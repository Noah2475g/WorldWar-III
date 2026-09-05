import { advanceTicks } from '@worldwar/ai'
import {
  HASH_OMIT_KEYS,
  createInitialState,
  runTicks,
  type Command,
  type GameConfig,
  type GameState,
  type MapData,
  type Rules,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'

/**
 * Recording and replaying a match (R-ARCH-03, T-M8-02).
 *
 * Seed plus command log is enough to reproduce a game exactly — including everything
 * the AI did, because AI orders are ordinary commands. That is what makes a bug report
 * reproducible instead of anecdotal, and it is the same mechanism a later multiplayer
 * server would use to verify clients.
 *
 * The comparison deliberately leaves out the AI's memory. A replay follows the orders
 * that were given; it does not re-run the thinking behind them, so the opponents' plans
 * are empty afterwards. What has to match is the world — provinces, armies, stocks,
 * diplomacy — not the notes the AI made along the way.
 */

/** Keys excluded when comparing a replay against its recording. */
export const REPLAY_OMIT_KEYS = [...HASH_OMIT_KEYS, 'ai'] as const

export function worldHash(state: GameState): string {
  return hashValue(state, { omitKeys: REPLAY_OMIT_KEYS })
}

export interface Recording {
  config: GameConfig
  mapId: string
  rulesId: string
  /** Commands by tick, in the order they were applied. */
  commands: { tick: number; command: Command }[]
  ticks: number
  finalHash: string
}

export function recordGame(options: {
  config: GameConfig
  map: MapData
  rules: Rules
  ticks: number
  scripted?: (tick: number) => readonly Command[]
  setup?: (state: GameState) => void
}): { recording: Recording; state: GameState } {
  const ctx = { map: options.map, rules: options.rules }
  let state = createInitialState(options.config, ctx)
  options.setup?.(state)

  // Aufgezeichnet wird dieselbe Schleife, die auch gespielt wird (T-M14-04). Ein
  // Rekorder mit eigener Schleife zeichnet ein anderes Spiel auf als das gespielte —
  // und genau das waere bei einer Wiedergabe nicht zu bemerken, sondern erst am
  // abweichenden Endhash, ohne jeden Hinweis worauf.
  const gespielt = advanceTicks(state, options.ticks, ctx, { scripted: options.scripted })
  const commands: Recording['commands'] = gespielt.applied
  state = gespielt.state

  return {
    recording: {
      config: options.config,
      mapId: options.map.id,
      rulesId: options.rules.id,
      commands,
      ticks: state.tick,
      finalHash: worldHash(state),
    },
    state,
  }
}

/**
 * Replays a recording without running the AI at all — the recorded commands already
 * contain what it decided. If the result differs, something in the rules changed.
 */
export function replayGame(
  recording: Recording,
  map: MapData,
  rules: Rules,
  setup?: (state: GameState) => void,
): { state: GameState; matches: boolean } {
  const ctx = { map, rules }
  let state = createInitialState(recording.config, ctx)
  setup?.(state)

  const byTick = new Map<number, Command[]>()
  for (const entry of recording.commands) {
    byTick.set(entry.tick, [...(byTick.get(entry.tick) ?? []), entry.command])
  }

  for (let i = 0; i < recording.ticks; i++) {
    state = runTicks(state, 1, ctx, (tick) => byTick.get(tick) ?? []).state
  }

  return {
    state,
    matches: worldHash(state) === recording.finalHash,
  }
}
