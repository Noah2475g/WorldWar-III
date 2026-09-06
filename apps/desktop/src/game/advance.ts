import { type Command, type GameState, type MapData, type Rules } from '@worldwar/core'
import { advanceTicks } from '@worldwar/ai'

/**
 * Moves the game forward by whole hours, the computer players included (R-AI-01).
 *
 * The loop itself lives in `@worldwar/ai` since T-M14-04 — this is the desktop's name for
 * it, nothing more. It used to be a copy, and the copy was the point of failure: the
 * headless sweep had its own version that asked the AI once per game day, which silently
 * switched off five of six nations. Two loops are two games, and this project had four.
 *
 * The player's own orders belong to the first tick only: they were given now, not again
 * in an hour.
 */
export function advance(
  state: GameState,
  ticks: number,
  ctx: { map: MapData; rules: Rules },
  playerCommands: readonly Command[] = [],
): GameState {
  return advanceTicks(state, ticks, ctx, { playerCommands }).state
}

/**
 * Dasselbe, aber mit dem, was die Debug-Ansicht braucht (T-M12-10, R-AI-05).
 *
 * `advance` gibt nur den Zustand zurueck und wirft `applied` weg — die Kommandoliste
 * gab es also seit M14, und die Ansicht zeigte darueber eine leere Ueberschrift. Die
 * Begruendungen der KI kosten Zeit, deshalb werden sie nur geholt, wenn die Ansicht
 * offen ist; die Befehle sind mit und ohne dieselben.
 */
export function advanceWithTrace(
  state: GameState,
  ticks: number,
  ctx: { map: MapData; rules: Rules },
  playerCommands: readonly Command[] = [],
): ReturnType<typeof advanceTicks> {
  return advanceTicks(state, ticks, ctx, { playerCommands, explain: true })
}
