import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GEO_SOURCES, NATURAL_EARTH_LICENCE, geoSource } from './sources.ts'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const assets = readFileSync(`${ROOT}/docs/ASSETS.md`, 'utf8')

/**
 * R-ASSET-02 is not a matter of good intentions: the project may only ship freely
 * licensed material, and the way to keep that true a year from now is a test that
 * fails when someone adds a source without saying where it came from.
 */
describe('R-ASSET-02 Herkunft und Lizenz jeder Datenquelle', () => {
  it('nennt fuer jede Quelle Adresse, Lizenz und Zweck', () => {
    expect(GEO_SOURCES.length).toBeGreaterThan(0)
    for (const source of GEO_SOURCES) {
      expect(source.url).toMatch(/^https:\/\//)
      expect(source.licence).toBe(NATURAL_EARTH_LICENCE)
      expect(source.attribution).toMatch(/naturalearthdata\.com/)
      expect(source.purpose.length).toBeGreaterThan(20)
      expect(source.bytes).toBeGreaterThan(0)
    }
  })

  it('fuehrt jede Quelle auch in docs/ASSETS.md', () => {
    // The document is what a person reads; the table above is what the code reads.
    // They drift apart the moment nothing checks them against each other.
    for (const source of GEO_SOURCES) {
      expect(assets).toContain(source.name)
      expect(assets).toContain(source.url)
    }
  })

  it('verlangt fuer Zeichensaetze eine freie Lizenz', () => {
    expect(assets).toMatch(/IBM Plex/)
    expect(assets).toMatch(/OFL|Open Font License/)
  })

  it('nennt unbekannte Quellen beim Namen, statt undefined zurueckzugeben', () => {
    expect(() => geoSource('gibtsnicht')).toThrow(/admin1/)
    expect(geoSource('admin1').name).toBe('ne_10m_admin_1_states_provinces')
  })
})
