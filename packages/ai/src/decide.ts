import type { AiMemory, Command, DifficultyRule, MapData, PublicView, Rules } from '@worldwar/core'
import { diplomacyCommands } from './diplomacy'
import { capitalCommands } from './capital'
import { consolidateCommands } from './consolidate'
import { economyCommands, recruitCommands, tradeCommands } from './economy'
import { militaryCommands } from './military'
import { passageCommands } from './passage'
import { provinceOfferCommands } from './provinceValue'
import { tradeOfferCommands } from './trade'
import { espionageCommands } from './espionage'
import type { AiContext, AiDecision, Explanation } from './types'

/**
 * One AI turn (R-AI-01/05, design D8).
 *
 * Three tiers at different rates: strategy once a day, operations every six hours,
 * tactics every hour. The rates come from the memory, not from a clock — the same
 * sequence of ticks always produces the same decisions (R-ARCH-01).
 */

export const STRATEGIC_INTERVAL = 24
export const OPERATIONAL_INTERVAL = 6

export function emptyMemory(buildShare: number): AiMemory {
  return {
    lastStrategicTick: -1,
    lastOperationalTick: -1,
    targetPriority: {},
    assignments: {},
    buildShare,
  }
}

/**
 * Die Armeen, die ein Zusammenlegen auflöst (T-M41-08).
 *
 * Der Kern behält die kleinste Kennung nach `sort()` und löscht die übrigen
 * (`commands/army.ts`). Dieselbe Sortierregel hier, nicht `localeCompare`: bei `a10` und
 * `a9` hielten beide Seiten sonst verschiedene Armeen für die bleibende.
 */
function absorbedBy(commands: readonly Command[]): Set<string> {
  const ids = new Set<string>()
  for (const command of commands) {
    if (command.type !== 'MERGE_ARMIES') continue
    for (const id of [...command.armyIds].sort().slice(1)) ids.add(id)
  }
  return ids
}

/**
 * Die Sicht der Taktikstufe ohne die Armeen, die in diesem Zug aufgehen (T-M41-08).
 *
 * Operativ- und Taktikstufe feuern praktisch immer im selben Tick — jede Macht denkt nur
 * jeden n-ten Tick (`shouldThinkThisTick`) —, und beide lasen dieselbe Sicht. Die Taktik
 * befahl also Armeen, die das Zusammenlegen davor auflöste, und der Kern lehnte jeden dieser
 * Befehle mit `ARMY_NOT_FOUND` ab: auf der Weltkarte 961 von 1177 Ablehnungen in 200
 * Spieltagen. Kein verlorener Zug — die bleibende Armee bekam ihren eigenen Befehl —, aber
 * Rauschen, das jede andere Ablehnung verdeckt.
 *
 * Herausgenommen werden nur eigene Armeen, und nur aus `view.armies`. Bedrohung,
 * Kräftevergleich und Zielbewertung zählen ausschließlich fremde Armeen; die Befehle aller
 * anderen Armeen bleiben dieselben. Begründungen (R-AI-05) und `assignments` für die
 * aufgegangenen Armeen entstehen damit gar nicht erst.
 */
function withoutAbsorbed(context: AiContext, absorbed: ReadonlySet<string>): AiContext {
  if (absorbed.size === 0) return context
  return {
    ...context,
    view: { ...context.view, armies: context.view.armies.filter((army) => !absorbed.has(army.id)) },
  }
}

export interface DecideOptions {
  view: PublicView
  memory: AiMemory
  rules: Rules
  map: MapData
  difficulty: DifficultyRule
  /** Collect reasons for the debug view (R-AI-05). Off by default: it costs time. */
  explain?: boolean
}

export function decide(options: DecideOptions): AiDecision {
  const memory: AiMemory = {
    ...options.memory,
    targetPriority: { ...options.memory.targetPriority },
    assignments: { ...options.memory.assignments },
  }

  const context: AiContext = {
    view: options.view,
    memory,
    rules: options.rules,
    map: options.map,
    difficulty: options.difficulty,
  }

  const explanations: Explanation[] = []
  const commands: Command[] = []
  const tick = options.view.tick

  // Strategy: what to build and whom to fight. Once a game day.
  if (memory.lastStrategicTick < 0 || tick - memory.lastStrategicTick >= STRATEGIC_INTERVAL) {
    memory.lastStrategicTick = tick
    // Zuerst die Hauptstadt: ohne sie trifft die Entfernungsstrafe jede eigene Provinz
    // mit vollem Betrag, und keine andere Entscheidung wiegt das auf (T-M14-12).
    commands.push(...capitalCommands(context, explanations))
    commands.push(...diplomacyCommands(context, explanations))
    commands.push(...passageCommands(context, explanations, commands)) // T-M17-10
    commands.push(...economyCommands(context, explanations))
    commands.push(...tradeOfferCommands(context, explanations, commands)) // T-M17-10
    commands.push(...provinceOfferCommands(context, explanations, commands)) // T-M17-11
    // Spionage zuletzt: sie rechnet mit dem Geld, das Bauauftrag und Handel dieses Zugs schon binden, und
    // zieht Saboteure von Maechten ab, denen die Diplomatie eben Frieden angeboten hat (T-M17-12, D29.8).
    commands.push(...espionageCommands(context, explanations, commands))
  }

  // Operations: raising troops and covering shortages. Every six hours.
  let absorbed = new Set<string>()
  if (memory.lastOperationalTick < 0 || tick - memory.lastOperationalTick >= OPERATIONAL_INTERVAL) {
    memory.lastOperationalTick = tick
    const merges = consolidateCommands(context, explanations)
    absorbed = absorbedBy(merges)
    commands.push(...merges)
    commands.push(...tradeCommands(context, explanations))
    commands.push(...recruitCommands(context, explanations))
  }

  // Tactics: where the armies go. How often depends on the difficulty — reaction
  // speed is what separates a cautious opponent from a relentless one.
  const interval = Math.max(1, options.difficulty.tacticalInterval)
  if (memory.lastTacticalTick === undefined || tick - memory.lastTacticalTick >= interval) {
    memory.lastTacticalTick = tick
    commands.push(...militaryCommands(withoutAbsorbed(context, absorbed), explanations, commands))
  }

  return {
    commands,
    memory,
    explanations: options.explain ? explanations : [],
  }
}

/**
 * Round-robin over the AI players.
 *
 * Which player thinks in which tick is decided by a counter, never by measured time:
 * a decision that depends on how fast the machine is would break determinism outright
 * (the review's finding on the original budget rule).
 */
export function shouldThinkThisTick(tick: number, playerIndex: number, aiCount: number): boolean {
  if (aiCount <= 1) return true
  return tick % aiCount === playerIndex % aiCount
}
