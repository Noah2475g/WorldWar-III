import { runAi, storeMemories } from '@worldwar/ai'
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
  trace?: (entry: { tick: number; commands: readonly Command[]; explanations: ReturnType<typeof runAi>['explanations'] }) => void,
): FastForwardResult {
  // Das Gedächtnis, das zu den Befehlen dieses Ticks gehört. Es wird *einmal* gerechnet
  // und nach dem Tick abgelegt — ein zweiter `runAi`-Aufruf im Nachlauf wäre nicht nur
  // doppelte Arbeit, sondern falsch: er entschiede auf dem neuen Zustand und legte damit
  // Absichten ab, die die KI nie gefasst hat.
  let pending: ReturnType<typeof runAi>['memories'] | null = null

  // Nur der erste Tick bekommt die Spielerbefehle — dieselbe Regel wie in der Schleife
  // des Kerns (loop.ts): sie wurden einmal gegeben, nicht stündlich erneut.
  let firstTick = true

  return fastForward(state, request.target, ctx, {
    alertsFor: request.alertsFor,
    maxTicks: Math.max(1, Math.min(remainingTicks, request.chunkTicks ?? DEFAULT_CHUNK_TICKS)),
    // Die KI entscheidet aus der Lage — deshalb bekommt `commandSource` seit T-M15-06 den
    // Zustand und nicht nur die Tickzahl. Mit einer Tickzahl allein konnte die KI hier
    // gar nicht aufgerufen werden, und *das* ist der Grund, warum die Oberfläche sich eine
    // eigene Schleife gebaut hat.
    commandSource: (current: GameState): readonly Command[] => {
      const { commands, memories, explanations } = runAi(current, ctx, trace ? { explain: true } : {})
      pending = memories
      trace?.({ tick: current.tick, commands, explanations })
      const player = firstTick ? (request.playerCommands ?? []) : []
      firstTick = false
      return [...player, ...commands]
    },
    afterTick: (next: GameState): void => {
      if (pending) storeMemories(next, pending)
      pending = null
    },
  })
}
