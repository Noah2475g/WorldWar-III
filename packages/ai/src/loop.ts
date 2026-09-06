import { runTicks, type Command, type GameEvent, type GameState, type MapData, type PlayerId, type Rules } from '@worldwar/core'
import type { Explanation } from './types'
import { runAi, storeMemories } from './runner'

/**
 * The one loop that moves the game forward (T-M14-04).
 *
 * There were four of them, and they described different games. The desktop asked the AI
 * before every tick; the balance sweep asked it once per *game day* and re-applied the same
 * orders to all 24 ticks. That is not merely a second loop — it switches most of the AI off:
 * `shouldThinkThisTick` spreads thinking time across `tick % aiCount`, so when `tick` is
 * always a multiple of 24, only the first power ever thinks. Every balance figure the sweep
 * produced described a world in which five of six nations stood still.
 *
 * So the loop lives here, in the one package that may know both the core and the AI (the
 * import direction is shared ← core ← ai ← apps, which forbids the core from reaching for
 * the AI), and both applications import it.
 *
 * Two details are not decoration:
 *
 *  - **The player's orders belong to the first tick only.** They were given now, not again
 *    in an hour. The first desktop version re-applied them to every tick of a fast-forward:
 *    one "barracks started", then twenty-three refusals for a queue that was already full.
 *  - **The events of every tick are collected and returned.** The event log inside the state
 *    is a ring buffer; whoever counts from it counts too few. The balance sweep reported
 *    3 conquests where 101 had happened — a factor of 16 — because it read the buffer at the
 *    end instead of the stream as it went. T-M14-05 builds on this return value.
 */
export interface AdvanceResult {
  state: GameState
  /** Every event of every tick, in order — not the ring buffer left in the state. */
  events: GameEvent[]
  /** Every command that was applied, with the tick it belonged to. */
  applied: { tick: number; command: Command }[]
  /** How many ticks actually ran; fewer than asked when the game was decided. */
  ticks: number
  /**
   * Warum die KI tat, was sie tat — nur wenn danach gefragt wurde (R-AI-05).
   *
   * Die Begruendungen entstanden seit M7 in `decide`, `runAi` reichte sie weiter, und
   * hier endete die Kette: `advanceTicks` rief `runAi` ohne Optionen, also konnte die
   * Debug-Ansicht sie nie bekommen und zeigte eine leere Ueberschrift (T-M12-10).
   */
  explanations: Record<PlayerId, Explanation[]>
}

export interface AdvanceOptions {
  /** The human's orders. They belong to the first tick only — see above. */
  playerCommands?: readonly Command[]
  /**
   * Extra orders for a specific tick, asked for every tick.
   *
   * This is what recording and replay need (`apps/headless/src/replay.ts`), and the reason
   * it lives here rather than in a loop of its own: a recorder that runs a second loop
   * records a different game than the one that is played.
   */
  scripted?: ((tick: number) => readonly Command[]) | undefined
  /**
   * Begruendungen der KI mitfuehren. Aus, solange niemand fragt: sie kosten Zeit, und
   * das Vorspulen laeuft mit hundert Spielstunden je Sekunde durch diese Schleife.
   *
   * Sie duerfen die Partie nicht aendern — die Befehle sind mit und ohne dieselben.
   */
  explain?: boolean
}

export function advanceTicks(
  state: GameState,
  ticks: number,
  ctx: { map: MapData; rules: Rules },
  opts: AdvanceOptions = {},
): AdvanceResult {
  const playerCommands = opts.playerCommands ?? []

  let current = state
  const events: GameEvent[] = []
  const applied: { tick: number; command: Command }[] = []
  let explanations: Record<PlayerId, Explanation[]> = {}
  let ran = 0

  for (let i = 0; i < ticks; i++) {
    if (current.victory.winner !== null) break

    const { commands, memories, explanations: reasons } = runAi(current, ctx, opts.explain ? { explain: true } : {})
    if (opts.explain) explanations = reasons
    const scripted = opts.scripted?.(current.tick) ?? []
    const all = [...(i === 0 ? playerCommands : []), ...scripted, ...commands]

    for (const command of all) applied.push({ tick: current.tick, command })

    const result = runTicks(current, 1, ctx, () => all)
    current = result.state
    events.push(...result.events)
    ran += 1

    storeMemories(current, memories)
  }

  return { state: current, events, applied, ticks: ran, explanations }
}
