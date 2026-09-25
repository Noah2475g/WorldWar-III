import {
  runTicks,
  type Command,
  type GameEvent,
  type GameState,
  type MapData,
  type PlayerId,
  type Rules,
} from '@worldwar/core'
import type { Explanation } from './types'
import { adjutantCommands } from './adjutant'
import { runAi, storeMemories, type AiRunnerResult } from './runner'

/** What one tick is ordered to do, and by whom (T-M40-08). */
export interface TickCommands {
  /** Every command of the tick, in the order the core applies them: given, adjutant, AI. */
  commands: Command[]
  /** The adjutant's share — the marches a human's stance ordered by itself. */
  adjutant: Command[]
  /** The AI's share. */
  ai: Command[]
  /** The AI memories that belong to these commands; store them after the tick. */
  memories: AiRunnerResult['memories']
  explanations: Record<PlayerId, Explanation[]>
}

/**
 * The commands of one tick — the one place where orders, the adjutant and the AI meet (T-M40-08).
 *
 * Until then two places assembled them, and they disagreed: `advanceTicks` asked the AI and the
 * adjutant, the desktop's fast-forward asked only the AI. The adjutant never ran on the path on
 * which most game hours pass, and the same position gave two different games depending on
 * whether the clock or the fast-forward moved it (finding K1 of the M40 review). Both paths now
 * call this function; `fastForward.ts` feeds it to the core's `commandSource`.
 *
 * `given` are the orders a human or a script gave for this tick. The adjutant sees them: it leaves
 * the armies they name alone, and a march among them counts as an army on its way (finding M1).
 */
export function commandsForTick(
  state: GameState,
  ctx: { map: MapData; rules: Rules },
  options: { given?: readonly Command[]; explain?: boolean } = {},
): TickCommands {
  const given = options.given ?? []
  const { commands: ai, memories, explanations } = runAi(state, ctx, options.explain ? { explain: true } : {})
  // The adjutant (T-M40-03, D30.2): a human's stance becomes an order, on the same rail as a
  // click. Computed from this tick's state alone, so a loaded game gives the same orders.
  const adjutant = adjutantCommands(state, ctx, { given })
  return { commands: [...given, ...adjutant, ...ai], adjutant, ai, memories, explanations }
}

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
  /**
   * The adjutant's share of `applied` — marches a human's stance ordered by itself (T-M40-13).
   *
   * The desktop writes a quiet line from it ("the army moves up by itself"). Not an event of the
   * core: nothing in the state or the hash changes, and the golden masters do not see it.
   */
  adjutant: { tick: number; command: Command }[]
  /** How many ticks actually ran; fewer than asked when the game was decided. */
  ticks: number
  /**
   * AI commands `withhold` kept out of the tick (T-M17-15, R-AI-09/AK3) — the lever a
   * counter-run pulls, with the tick it belonged to. Empty when `withhold` was not given.
   */
  withheld: { tick: number; command: Command }[]
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
  /**
   * KI-Befehle, die der Kern nicht bekommt (T-M17-15, R-AI-09/AK3). Ein Messhebel fuer Gegenlaeufe
   * („derselbe Lauf ohne Durchmarsch-Antraege") in DER einen Schleife — eine zweite Schleife im Test
   * spielte eine andere Partie (T-M14-04). Nie im Spiel gesetzt. Betrifft nur die Befehle der KI; das
   * Gedaechtnis der KI wird trotzdem gespeichert, sie haelt den Befehl also fuer gegeben.
   */
  withhold?: (command: Command) => boolean
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
  const adjutant: { tick: number; command: Command }[] = []
  const withheld: { tick: number; command: Command }[] = []
  let explanations: Record<PlayerId, Explanation[]> = {}
  let ran = 0

  for (let i = 0; i < ticks; i++) {
    if (current.victory.winner !== null) break

    const scripted = opts.scripted?.(current.tick) ?? []
    const given = [...(i === 0 ? playerCommands : []), ...scripted]
    const tick = commandsForTick(current, ctx, { given, explain: opts.explain === true })
    if (opts.explain) explanations = tick.explanations

    const ai = opts.withhold ? tick.ai.filter((command) => !opts.withhold!(command)) : tick.ai
    if (opts.withhold) {
      for (const command of tick.ai) {
        if (opts.withhold(command)) withheld.push({ tick: current.tick, command })
      }
    }
    const commands = opts.withhold ? [...given, ...tick.adjutant, ...ai] : tick.commands

    for (const command of commands) applied.push({ tick: current.tick, command })
    for (const command of tick.adjutant) adjutant.push({ tick: current.tick, command })

    const result = runTicks(current, 1, ctx, () => commands)
    current = result.state
    events.push(...result.events)
    ran += 1

    storeMemories(current, tick.memories)
  }

  return { state: current, events, applied, adjutant, withheld, ticks: ran, explanations }
}
