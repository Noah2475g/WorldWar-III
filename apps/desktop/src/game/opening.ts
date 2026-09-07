import { buildDuration, recruitDuration, type Rules } from '@worldwar/core'

/**
 * Wie lange die Eröffnung dauert, aus den Regeln gerechnet (T-M21-03).
 *
 * Der Playtest vom 2026-09-07 hat die Stelle gefunden, an der ein neuer Spieler aussteigt,
 * und sie ist nicht schwer, sondern **leer**: der Startvorrat trägt genau eine Kaserne,
 * die Kaserne braucht ihre Zeit, danach braucht die Infanterie ihre — und dazwischen gibt
 * es nichts zu klicken, was voranbringt. Wer nicht weiß, dass das so gemeint ist, hält
 * das Spiel für kaputt.
 *
 * Gerechnet wird hier, damit die Zahl **nirgends geschrieben** steht. `de.ts` hält für die
 * Erklärtexte ausdrücklich fest, dass eine Zahl nicht an zwei Orten stehen darf, und für
 * eine Führung gilt das doppelt: sie wird gelesen, wenn der Spieler die Regeln noch nicht
 * kennt und ihr deshalb glaubt. Wird an den Bauzeiten oder an der Moralskalierung
 * gedreht, ändert sich der Satz von selbst mit.
 */

/**
 * Der Tick, an dem die erste eigene Einheit stehen kann — Kaserne und Infanterie
 * nacheinander, beide mit der Moralskalierung des Spielanfangs.
 *
 * Nacheinander, weil es nicht anders geht: die Infanterie verlangt die Kaserne
 * (`requiresBuilding`), und der Startvorrat reicht ohnehin nur für eines von beidem.
 *
 * ⚠ **Zwei Kurven, nicht eine.** Bauen und Ausheben skalieren die Moral verschieden:
 * `buildSpeedFactor` ist auf 80 000 normiert und erreicht dort volle Geschwindigkeit,
 * `recruitSpeedFactor` erst bei 100 000. Bei der Startmoral von 70 000 macht das den
 * Unterschied zwischen 900 und 760 Promille — die Kaserne braucht 27 Ticks statt 24, die
 * Infanterie 16 statt 12. Wer hier zweimal dieselbe Funktion nimmt, bekommt 41 statt 43
 * und merkt nichts davon.
 */
export function firstUnitAt(rules: Rules): number {
  const morale = rules.constants.startMorale
  const barracks = rules.buildings['barracks']
  const infantry = rules.units['infantry']

  // Fehlt eines von beiden, ist es eine andere Partie als die, für die dieser Satz
  // geschrieben ist — dann lieber gar keine Zahl als eine erfundene.
  if (!barracks || !infantry) return 0

  return buildDuration(barracks.buildTicks, morale) + recruitDuration(infantry.buildTicks, morale)
}
