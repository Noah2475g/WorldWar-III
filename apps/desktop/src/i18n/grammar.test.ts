import { describe, expect, it } from 'vitest'
import { de } from './de.ts'
import { accusativePronoun, genusOf, isPluralNation } from './grammar.ts'

/**
 * Die Beugungstabellen bleiben vollstaendig (T-M23-02, R-UI-07, Befund V2-11).
 *
 * Der Rueckfall bei unbekanntem Schluessel ist das Neutrum — genau der Fehler von vor
 * der Reparatur („Sie koennen es jetzt bauen" ueber der Kaserne). Damit er nie wieder
 * eintritt, haengt jede Sache mit deutschem Namen auch in der Genus-Tabelle: ein neues
 * Gebaeude ohne Genus faellt hier auf, nicht erst im Spiel.
 */
describe('R-UI-07 Genus- und Numerus-Tabelle', () => {
  it('kennt das Genus jedes benannten Gebaeudes und jeder benannten Einheit', () => {
    for (const key of Object.keys(de.buildings)) {
      expect(de.grammar.buildings, `Genus fuer buildings.${key} fehlt`).toHaveProperty(key)
    }
    for (const key of Object.keys(de.units)) {
      expect(de.grammar.units, `Genus fuer units.${key} fehlt`).toHaveProperty(key)
    }
  })

  it('traegt in den Tabellen nur echte Genera', () => {
    for (const [key, genus] of [...Object.entries(de.grammar.buildings), ...Object.entries(de.grammar.units)]) {
      expect(['f', 'm', 'n'], `${key}: "${genus}" ist kein Genus`).toContain(genus)
    }
  })

  it('beugt das Akkusativpronomen nach dem Genus', () => {
    expect(genusOf('buildings', 'barracks')).toBe('f')
    expect(accusativePronoun('buildings', 'barracks')).toBe('sie')
    expect(accusativePronoun('buildings', 'harbour')).toBe('ihn')
    expect(accusativePronoun('units', 'fighter')).toBe('es')
  })

  it('kennt die Mehrzahl-Maechte der Weltkarte', () => {
    expect(isPluralNation('Vereinigte Staaten')).toBe(true)
    expect(isPluralNation('Mexiko')).toBe(false)
    // Das Vereinigte Koenigreich ist trotz des aehnlichen Namens Einzahl.
    expect(isPluralNation('Vereinigtes Königreich')).toBe(false)
  })
})
