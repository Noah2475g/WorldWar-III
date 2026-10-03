/* global structuredClone */
/**
 * Ein Siegstand, der die Siegbedingung wirklich erfüllt (T-M44-02, Befund B-22, R-UX-05/AK4).
 *
 * Die Aufnahme von T-M44-01 setzte `victory.winner` auf einen echten Spielstand und ließ den
 * Besitz, wie er war: die Kopfleiste zeigte „7 % von 70 %“ neben „Sie haben gewonnen“. Das ist
 * ein Endedialog über einem Stand, den es im Spiel nie gibt. Hier bekommt der Sieger den Besitz,
 * den die Bedingung verlangt — Provinz für Provinz, bis **`checkVictory` des Kerns selbst** ihn
 * als Sieger nach Punkten meldet. Danach (und erst danach) setzt der Aufrufer `victory.winner`
 * und versiegelt den Stand mit `serialise`.
 *
 * Der Kern bleibt unberührt: gelesen werden nur `checkVictory` und `pointShare`; geändert wird
 * ausschließlich die Kopie des Standes.
 *
 * **Die Funktion ist absichtlich in sich geschlossen** (nur Argumente, keine Importe, keine
 * Hilfsfunktionen außerhalb): `ux-capture.mjs` schickt ihren Quelltext in die Seite und führt
 * sie dort gegen den Kern des Dev-Servers aus; `test/ux-victory.test.ts` führt sie in Node gegen
 * denselben Kern aus. Derselbe Text, zwei Orte.
 *
 * @param {{ checkVictory: Function, pointShare: Function }} core
 * @param {any} rules die geparsten Regeln
 * @param {any} source der Stand, aus dem kopiert wird
 * @param {string} to die Macht, die den Besitz bekommt
 * @returns {{ next: any, moved: number, real: boolean, share: number, goal: number, condition: string|null }}
 */
export function grantUntilVictory(core, rules, source, to) {
  const next = structuredClone(source)
  let moved = 0
  for (const id of next.provinceOrder) {
    if (core.checkVictory(next, rules).winner === to) break
    if (next.provinces[id].owner === to) continue
    next.provinces[id].owner = to
    moved += 1
  }
  const check = core.checkVictory(next, rules)
  const share = core.pointShare(next, to, rules)
  const goal = next.victory.pointsShareToWin
  return {
    next,
    moved,
    // „Wirklich“ heißt: der Kern meldet den Sieg nach Punkten, und der Anteil hält die Schwelle.
    real: check.winner === to && check.condition === 'points' && share >= goal,
    share,
    goal,
    condition: check.condition,
  }
}
