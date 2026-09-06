import type { GameState } from '../state/types'
import type { Rules } from './types'

/**
 * Die Freischaltungsachse (T-M15-02, R-TECH-01).
 *
 * Der Befund war keine falsche Formel, sondern eine fehlende Achse: **Spieltag 1
 * unterschied sich von Spieltag 40 durch nichts als den Kontostand.** Alles war vom
 * ersten Tick an baubar; es gab nichts, worauf man hinarbeitet, und keinen Grund, eine
 * Partie über den Punkt hinaus zu spielen, an dem das Geld reicht.
 *
 * Die Antwort ist bewusst klein: ein Feld an jeder Sache, eine Ablehnung, die den Tag
 * nennt, und ein Filter in der Oberfläche (T-M15-03). Keine Forschungspunkte, kein Baum,
 * kein neues Zustandsfeld — die Achse ist die Spielzeit, die es ohnehin gibt.
 */

/**
 * Der laufende Spieltag, **eins-basiert**: der erste Tick der Partie liegt auf Tag 1.
 *
 * Das ist dieselbe Zählung, die die Oberfläche schon benutzt
 * (`apps/desktop/src/game/events.ts`, „Wirksam ab Tag {{day}}") und die die Referenz
 * meint, wenn sie „Kaserne ab Tag 1" schreibt. Eine null-basierte Zählung hier hätte
 * bedeutet, dass die Kaserne am ersten Spieltag nicht baubar ist — der Fehler wäre erst
 * im Playtest aufgefallen und hätte wie ein Wirtschaftsproblem ausgesehen.
 */
export function currentDay(state: GameState, rules: Rules): number {
  // eslint-disable-next-line no-restricted-syntax -- Tick durch Ticks je Tag, ganze Zahlen ohne Festkomma
  return Math.trunc(state.tick / rules.constants.ticksPerDay) + 1
}

/** Der erste Tick eines Spieltags — die Umkehrung von `currentDay`. */
export function tickOfDay(day: number, rules: Rules): number {
  // eslint-disable-next-line no-restricted-syntax -- Tage mal Ticks je Tag, ganze Zahlen ohne Festkomma
  return (day - 1) * rules.constants.ticksPerDay
}
