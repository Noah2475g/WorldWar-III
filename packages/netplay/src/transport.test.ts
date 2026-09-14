import { describe, expect, it } from 'vitest'
import { createLoopback } from './loopback'
import { TransportClosedError } from './transport'
import { testMessage, transportContract } from './transportContract'

/**
 * Die Transportschnittstelle und ihr Schleifendoppel (T-M38-01, D28.9).
 *
 * Die Vertragsreihe steht in `transportContract.ts` und läuft hier gegen das Doppel im
 * selben Prozess; dieselbe Reihe läuft in `apps/desktop/src/net/websocketTransport.test.ts`
 * gegen die echte Leitung. Das ist der ganze Zweck der Naht: was beide Seiten versprechen,
 * steht an **einer** Stelle, und keine der beiden kann es allein lockern.
 *
 * Was darunter steht, gilt nur für das Doppel — die Zusagen, die eine Leitung nicht geben
 * kann (ein `raw`-Modus für Messungen) oder die es genauer gibt als der Vertrag verlangt
 * (welcher Fehler geworfen wird).
 */

transportContract('Schleifendoppel', () => {
  const { a, b } = createLoopback()
  return { a, b, settle: async () => undefined }
})

describe('R-MP-06 Das Schleifendoppel, ueber den Vertrag hinaus', () => {
  it('wirft einen benannten Fehler und nicht irgendeinen', () => {
    // Die Meldung landet in der Oberflaeche; ein blankes `Error` saehe dort aus wie ein
    // Absturz und nicht wie eine geschlossene Verbindung.
    const { a } = createLoopback()
    a.close('Schluss')

    expect(() => a.send(testMessage(1))).toThrow(TransportClosedError)
    expect(() => a.send(testMessage(1))).toThrow(/geschlossen/)
  })

  it('wirft auch, wenn nur die Gegenseite fort ist', () => {
    // Nicht dasselbe wie „ich habe geschlossen": das eigene Ende ist offen, und ohne
    // diese Zusicherung ginge die Nachricht in einen Brunnen.
    const { a, b } = createLoopback()
    b.close('die Gegenseite geht')

    expect(a.closed, 'ein Ende zu schliessen schliesst die Verbindung').toBe(true)
    expect(() => a.send(testMessage(1))).toThrow(TransportClosedError)
  })

  it('laesst den Umweg ueber JSON auf Wunsch aus — und nur dann', () => {
    // `raw` ist fuer Messungen da, in denen die Serialisierung selbst das Messobjekt
    // verfaelschte. Im Zweifel bleibt der Umweg an, weil er die halbe Zusage ist.
    const roh = createLoopback({ raw: true })
    const empfangen: unknown[] = []
    roh.b.onMessage((message) => empfangen.push(message))
    const gesendet = testMessage(5)
    roh.a.send(gesendet)

    expect(empfangen[0]).toBe(gesendet)
  })

  it('haelt eine Nachricht auf, die den Weg ueber die Leitung nicht uebersteht', () => {
    // Im Doppel kann so etwas nur aus einem Fehler im Programm stammen, und ein Fehler,
    // der als verworfene Nachricht durchgeht, kostet eine Sitzung.
    const { a } = createLoopback()
    const kaputt = { ...testMessage(1), kind: 'gibtsnicht' } as unknown as ReturnType<typeof testMessage>

    expect(() => a.send(kaputt)).toThrow(/unzustellbare Nachricht/)
  })
})
