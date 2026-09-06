import { describe, expect, it } from 'vitest'
import { SPEED_STOPS } from './speed.ts'

/**
 * Die Geschwindigkeitsregelung (T-M15-06, R-TIME-02).
 *
 * **Diese Datei ist am 2026-09-06 entstanden, weil das Anforderungstor rot wurde.** Die
 * Belege für R-TIME-02 lagen in `sim/SimHost.test.ts` und `sim/worker.test.ts` — also in
 * den Tests eines Simulations-Hosts, den nie etwas gestartet hat. Mit dem Löschen dieses
 * Wurmfortsatzes verlor die Anforderung ihren einzigen Nachweis, und das Tor meldete
 * `V1 offen: 1`.
 *
 * Das ist genau der Befund, den M14 im Großen aufgearbeitet hat: **eine Anforderung war
 * durch Code belegt, den kein Spieler ausführt.** Der Beleg steht jetzt dort, wo die
 * Regelung wirklich liegt.
 */
describe('R-TIME-02/AK1 Die Rastpunkte reichen von Pause bis hundert', () => {
  it('beginnt bei der Pause und endet bei hundert Spielstunden je Sekunde', () => {
    expect(SPEED_STOPS[0], 'ohne Null gibt es keine Pause').toBe(0)
    expect(SPEED_STOPS[SPEED_STOPS.length - 1], 'R-TIME-02 verlangt bis 100').toBe(100)
  })

  it('steigt streng monoton — ein Regler, der zurückspringt, ist keiner', () => {
    for (let i = 1; i < SPEED_STOPS.length; i++) {
      expect(SPEED_STOPS[i]!, `Stufe ${i}`).toBeGreaterThan(SPEED_STOPS[i - 1]!)
    }
  })

  it('bietet genug Stufen, um dazwischen zu wählen', () => {
    // Drei Stufen wären ein Schalter, keine Regelung. Acht sind es, und die Abstände
    // wachsen: unten kommt es auf einzelne Stunden an, oben nicht mehr.
    expect(SPEED_STOPS.length).toBeGreaterThanOrEqual(6)
    expect(SPEED_STOPS).toContain(1)
    expect(SPEED_STOPS).toContain(10)
  })
})
