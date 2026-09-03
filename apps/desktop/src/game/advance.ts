import { runTicks, type Command, type GameState, type MapData, type Rules } from '@worldwar/core'
import { runAi, storeMemories } from '@worldwar/ai'

/**
 * Moves the game forward by whole hours, the computer players included (R-AI-01).
 *
 * The AI is consulted before every tick, and its orders apply to that tick alone. The
 * first version of the desktop asked it once and re-applied the same orders to every
 * tick of a fast-forward — the first tick built the barracks, the following
 * twenty-three were refused for a queue that was already full, and the log said so,
 * every hour. This is the loop the headless runner uses; the desktop does not get a
 * different one, because two loops are two games.
 *
 * The player's own orders belong to the first tick only: they were given now, not
 * again in an hour.
 */
export function advance(
  state: GameState,
  ticks: number,
  ctx: { map: MapData; rules: Rules },
  playerCommands: readonly Command[] = [],
): GameState {
  let current = state
  for (let i = 0; i < ticks; i++) {
    if (current.victory.winner !== null) break
    const { commands, memories } = runAi(current, ctx)
    const all = i === 0 ? [...playerCommands, ...commands] : commands
    current = runTicks(current, 1, ctx, () => all).state
    storeMemories(current, memories)
  }
  return current
}
