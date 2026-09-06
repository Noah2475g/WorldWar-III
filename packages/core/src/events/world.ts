import type { EventType, GameEvent } from './types'

/**
 * Weltgeschehen — der Ersatz für die Zeitung (R-NEWS-04, T-M15-09).
 *
 * Noahs Entscheidung 3 vom 2026-09-05: die Zeitung (R-NEWS-01/02/03) entfällt, und an
 * ihre Stelle tritt ein **Filter** im Ereignisprotokoll, das es ohnehin gibt.
 *
 * Die Begründung ist eine Rechnung, keine Vorliebe. R-NEWS-02 verbot der Zeitung
 * ausdrücklich Mengen, Vorräte, Truppenstärken und Gebäude — was danach übrig bleibt, ist
 * genau diese Positivliste, und sie liegt vollständig im Protokoll, dessen Filterbarkeit
 * R-GAME-06 seit M5 fordert. Die Zeitung hätte dagegen ein neues Zustandsfeld mit
 * Ringpuffer gekostet, eine Migration — und ein verstecktes Risiko: `HASH_OMIT_KEYS` nimmt
 * nur `eventLog` vom Simulationshash aus, jede Ausgabe wäre also in den Hash gelaufen, und
 * **jede spätere Umformulierung einer Schlagzeile hätte Golden-Master und Wiedergabe
 * gebrochen.** Der Filter kostet kein Zustandsfeld.
 */

/**
 * Was die Welt angeht — eine feste **Positivliste**, keine Ausschlussregel.
 *
 * Positivliste, weil eine Ausschlussregel („alles außer Wirtschaft") bei jeder neuen
 * Ereignisart stillschweigend die falsche Antwort gäbe: eine Meldung über Vorräte einer
 * fremden Macht wäre dann von selbst Weltgeschehen, und R-DIP-04 wäre gebrochen, ohne dass
 * jemand eine Zeile geändert hätte.
 */
export const WORLD_EVENT_TYPES = [
  'WAR_DECLARED',
  'DIPLOMACY_CHANGED',
  'PROVINCE_CAPTURED',
  'CAPITAL_LOST',
  'PROVINCE_REVOLTED',
  'PLAYER_ELIMINATED',
  'BATTLE_RESOLVED',
  'GAME_ENDED',
] as const satisfies readonly EventType[]

export function isWorldEventType(type: EventType): boolean {
  return (WORLD_EVENT_TYPES as readonly EventType[]).includes(type)
}

/**
 * Die Weltereignisse eines Protokolls, in der Reihenfolge des Protokolls.
 *
 * **`audience` wird bewusst nicht gelesen.** Wer wem den Krieg erklärt, ist öffentlich;
 * die Positivliste entscheidet, nicht der Empfängerkreis. Dass die *Zeile* für einen
 * Unbeteiligten weniger sagt als für einen Beteiligten, ist Sache der Textbildung
 * (`apps/desktop/src/game/events.ts`) und nicht dieser Auswahl — sonst stünde die
 * Geheimhaltung an zwei Stellen, und eine davon würde eines Tages vergessen.
 */
export function worldEventsIn(events: readonly GameEvent[]): GameEvent[] {
  return events.filter((event) => isWorldEventType(event.type))
}
