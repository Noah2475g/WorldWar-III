import { commandsForTick, storeMemories, type Explanation } from '@worldwar/ai'
import {
  fastForward,
  type Command,
  type FastForwardResult,
  type FastForwardTarget,
  type GameState,
  type MapData,
  type PlayerId,
  type Rules,
} from '@worldwar/core'

/**
 * Vorspulen, wie der Spieler es drückt (T-M15-06, R-TIME-02, R-TIME-03, R-TIME-06).
 *
 * Bis zum 2026-09-06 rief **kein einziger Spieler-Pfad** `fastForward` des Kerns. `App.tsx`
 * und die Taste `F` rechneten `step(ticksPerDay)`, also genau einen Spieltag; `fastForwarding`
 * stand hart auf `false`, wodurch der Abbruchzweig in der Kopfleiste toter Code war. Der
 * einzige Aufrufer war `sim/SimEngine.ts` — ein Simulations-Host in einem Hintergrundprozess,
 * den nichts gestartet hat. Ziel Z1, die frei regelbare Spielgeschwindigkeit und das erste
 * erklärte Produktziel dieses Spiels, war damit halb eingelöst.
 *
 * **Eine Schleife**, und zwar die des Kerns: diese Datei ruft `fastForward` und schiebt die
 * KI über `commandSource` und `afterTick` hinein. Sie rechnet nicht selbst. T-M14-04 hat
 * genau den umgekehrten Fehler behoben — vier Fassungen derselben Schleife, von denen eine
 * die KI nur einmal je Spieltag fragte und dadurch bei sechs Mächten fünf stillstellte.
 */

export interface FastForwardChunk {
  /** Der Lauf bis hierher. */
  state: GameState
  /** Vorgerückte Ticks, über alle Häppchen summiert. */
  ticksRun: number
  /** Null, solange weitergerechnet wird. */
  result: FastForwardResult | null
}

export interface FastForwardRequest {
  target: FastForwardTarget
  /** Wessen Alarme anhalten — der Mensch am Bildschirm. */
  alertsFor: PlayerId
  /** Obergrenze, damit ein Ziel, das nie eintritt, nicht ewig läuft. */
  maxTicks: number
  /** Häppchengröße in Ticks. Zwischen zwei Häppchen kann abgebrochen werden. */
  chunkTicks?: number
  /**
   * Die gesammelten Befehle des Menschen (T-M22-05): sie gehören dem ERSTEN Tick
   * dieses Häppchens — gegeben wurden sie jetzt, nicht in jeder Spielstunde erneut.
   * Der Aufrufer reicht sie nur dem ersten Häppchen eines Laufs.
   */
  playerCommands?: readonly Command[]
  /**
   * Wie viele Ticks dieser Lauf in früheren Häppchen schon gerechnet hat (T-M41-15).
   *
   * Ein Zählziel — `ticks`, `days` — gilt für den ganzen Lauf. Der Kern zählt es ab dem Beginn
   * seines Aufrufs, und jedes Häppchen ist ein neuer Aufruf: ohne diesen Stand trat ein Ziel über
   * mehr als ein Häppchen nie ein, und der Lauf hielt erst an der Obergrenze von 30 Spieltagen.
   */
  ticksRunBefore?: number
}

/**
 * Das Ziel für dieses Häppchen (T-M41-15): ein Zählziel auf den Rest des Laufs umgerechnet, jedes
 * andere unverändert — ein Ereignisziel tritt ein, wann immer es eintritt.
 */
function targetForChunk(request: FastForwardRequest, ticksPerDay: number): FastForwardTarget {
  const before = request.ticksRunBefore ?? 0
  const { target } = request
  if (target.kind === 'ticks') return { kind: 'ticks', ticks: Math.max(1, target.ticks - before) }
  if (target.kind === 'days') return { kind: 'ticks', ticks: Math.max(1, target.days * ticksPerDay - before) }
  return target
}

/** Ein Häppchen: das Ergebnis des Kerns und die Befehle der Automatik darin (T-M40-13). */
export interface FastForwardChunkResult extends FastForwardResult {
  /** Die Marschbefehle, die die Haltung einer menschlichen Armee von selbst gab, mit ihrem Tick. */
  adjutant: { tick: number; command: Command }[]
}

/** Wie viele Ticks ein Häppchen rechnet, bevor die Ereignisschleife wieder drankommt. */
export const DEFAULT_CHUNK_TICKS = 24

/**
 * Ein Häppchen vorspulen — dieselbe Funktion des Kerns, nur mit gedeckelter Ticks-Zahl.
 *
 * Der Deckel ist der ganze Unterschied zwischen „das Spiel rechnet" und „das Spiel hängt":
 * bei den gemessenen 2,463 ms je Tick auf der Weltkarte sind tausend Spieltage rund eine
 * Minute Rechenzeit, und ohne Häppchen wäre die Oberfläche eine Minute lang tot — kein
 * Abbruch, keine Anzeige, kein Zeichen von Leben (R-TIME-03/AK2).
 */
export function fastForwardChunk(
  state: GameState,
  request: FastForwardRequest,
  ctx: { map: MapData; rules: Rules },
  remainingTicks: number,
  /**
   * Mitschreiben, was die KI befiehlt und warum (T-M12-10, R-AI-05).
   *
   * Ohne diesen Griff bliebe die Debug-Ansicht beim Vorspulen leer, und das Vorspulen
   * ist der Weg, auf dem die meisten Spielstunden vergehen. Die Begruendungen werden nur
   * geholt, wenn jemand zusieht: sie kosten Zeit und aendern die Befehle nicht.
   */
  trace?: (entry: { tick: number; commands: readonly Command[]; explanations: Record<PlayerId, Explanation[]> }) => void,
): FastForwardChunkResult {
  // Was die Automatik in diesem Häppchen befohlen hat (T-M40-13) — die Oberfläche schreibt daraus
  // eine leise Zeile, auch beim Vorspulen. Aus `commandsForTick`, nicht aus einem Ereignis des Kerns.
  const adjutant: FastForwardChunkResult['adjutant'] = []
  // Das Gedächtnis, das zu den Befehlen dieses Ticks gehört. Es wird *einmal* gerechnet
  // und nach dem Tick abgelegt — ein zweiter Aufruf im Nachlauf wäre nicht nur doppelte
  // Arbeit, sondern falsch: er entschiede auf dem neuen Zustand und legte damit Absichten
  // ab, die die KI nie gefasst hat.
  let pending: ReturnType<typeof commandsForTick>['memories'] | null = null

  // Nur der erste Tick bekommt die Spielerbefehle — dieselbe Regel wie in der Schleife
  // (loop.ts): sie wurden einmal gegeben, nicht stündlich erneut.
  let firstTick = true

  const result = fastForward(state, targetForChunk(request, ctx.rules.constants.ticksPerDay), ctx, {
    alertsFor: request.alertsFor,
    maxTicks: Math.max(1, Math.min(remainingTicks, request.chunkTicks ?? DEFAULT_CHUNK_TICKS)),
    // Die Befehle eines Ticks kommen aus DERSELBEN Funktion wie in `advanceTicks` (T-M40-08,
    // Befund K1 der Durchsicht M40). Bis dahin fragte diese Stelle nur `runAi`: der Adjutant
    // lief beim Vorspulen nie, und dieselbe Lage ergab über die Uhr und über das Vorspulen zwei
    // verschiedene Partien — ausgerechnet auf dem Weg, auf dem die meisten Spielstunden vergehen.
    // Den Zustand statt der Tickzahl bekommt `commandSource` seit T-M15-06, weil KI und Adjutant
    // aus der Lage entscheiden.
    commandSource: (current: GameState): readonly Command[] => {
      const given = firstTick ? (request.playerCommands ?? []) : []
      firstTick = false
      const tick = commandsForTick(current, ctx, { given, explain: trace !== undefined })
      pending = tick.memories
      for (const command of tick.adjutant) adjutant.push({ tick: current.tick, command })
      trace?.({ tick: current.tick, commands: tick.ai, explanations: tick.explanations })
      return tick.commands
    },
    afterTick: (next: GameState): void => {
      if (pending) storeMemories(next, pending)
      pending = null
    },
  })
  return { ...result, adjutant }
}
