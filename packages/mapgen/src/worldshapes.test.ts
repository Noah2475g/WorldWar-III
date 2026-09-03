import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readCsv } from './csv.ts'
import { shapeAreaKm2, type Shape } from './area.ts'
import type { MergeRules } from './curation.ts'

/**
 * The built world map (T-M9-02a, R-MAP-01/R-MAP-03).
 *
 * `provinces.test.ts` checks that merging is correct on shapes small enough to reason
 * about. This file checks the thing that was actually produced — 237 provinces built
 * from 1279 parts — because a merge can be right in the small and still deliver a map
 * with a country missing, a province of zero area, or Greenland where Chile should be.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world-shapes.json`, 'utf8')) as {
  scale: string
  toleranceDegrees: number
  provinces: {
    id: string
    name: string
    country: string
    areaKm2: number
    centre: { lon: number; lat: number }
    geometry: Shape
  }[]
}
const table = readCsv(readFileSync(`${ROOT}/data/maps/world-provinces.csv`, 'utf8'))
const rules = JSON.parse(readFileSync(`${ROOT}/data/mapgen/merge-rules.json`, 'utf8')) as MergeRules

describe('R-MAP-03 Die gebaute Weltkarte', () => {
  it('liegt im geforderten Korridor', () => {
    expect(world.provinces.length).toBeGreaterThanOrEqual(rules.targetProvinces.min)
    expect(world.provinces.length).toBeLessThanOrEqual(rules.targetProvinces.max)
  })

  it('enthaelt genau die Provinzen der kuratierten Tabelle', () => {
    // The geometry and the table are built from the same rules but by different runs;
    // if they ever disagree, something was rebuilt and something else was not.
    const inMap = world.provinces.map((p) => p.id).sort()
    const inTable = table.map((row) => row.id!).sort()
    expect(inMap).toEqual(inTable)
  })

  it('gibt jeder Provinz eine Flaeche groesser als null', () => {
    for (const province of world.provinces) {
      expect(province.areaKm2, `${province.id} (${province.name}) hat keine Flaeche`).toBeGreaterThan(0)
      expect(Math.round(shapeAreaKm2(province.geometry)), province.id).toBe(province.areaKm2)
    }
  })

  it('laesst kein Land ohne Provinz', () => {
    const countries = new Set(world.provinces.map((p) => p.country))
    for (const row of table) {
      expect(countries.has(row.country!), `${row.country} hat keine Provinz mit Geometrie`).toBe(true)
    }
  })

  it('setzt jede Startnation auf die Karte', () => {
    const countries = new Set(world.provinces.map((p) => p.country))
    for (const [iso, nation] of Object.entries(rules.startNations.nations)) {
      for (const country of nation.countries) {
        expect(countries.has(country), `${nation.name} (${iso}): ${country} fehlt`).toBe(true)
      }
    }
  })

  it('haelt jeden Schwerpunkt in gueltigen Koordinaten', () => {
    for (const { id, centre } of world.provinces) {
      expect(Math.abs(centre.lon), `${id} liegt bei Laenge ${centre.lon}`).toBeLessThanOrEqual(180)
      expect(Math.abs(centre.lat), `${id} liegt bei Breite ${centre.lat}`).toBeLessThanOrEqual(90)
    }
  })

  it('setzt bekannte Provinzen dorthin, wo sie hingehoeren', () => {
    // A merge that silently mixed up its groups would pass every count above. These
    // are the coordinates of the actual places, to within a few degrees.
    const expected: [string, number, number][] = [
      ['DEU-SE', 49, 11],
      ['FRA-NW', 48, -2],
      ['ITA-SOUTH', 38, 15],
      ['JPN-NORTH', 39, 141],
      ['ARG-SOUTH', -46, -69],
      ['ZAF-WEST', -31, 21],
      ['USA-WEST', 41, -114],
      ['IND-SOUTH', 14, 78],
    ]
    for (const [id, lat, lon] of expected) {
      const province = world.provinces.find((p) => p.id === id)
      expect(province, `${id} fehlt`).toBeDefined()
      expect(Math.abs(province!.centre.lat - lat), `${id}: Breite ${province!.centre.lat}`).toBeLessThan(8)
      expect(Math.abs(province!.centre.lon - lon), `${id}: Laenge ${province!.centre.lon}`).toBeLessThan(12)
    }
  })

  it('haelt jeden Ring geschlossen und dreipunktig', () => {
    for (const { id, geometry } of world.provinces) {
      const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates]
      for (const polygon of polygons) {
        for (const ring of polygon) {
          expect(ring.length, `${id}: Ring mit ${ring.length} Punkten`).toBeGreaterThanOrEqual(4)
          expect(ring[0], `${id}: Ring nicht geschlossen`).toEqual(ring[ring.length - 1])
        }
      }
    }
  })

  it('nennt Massstab und Vereinfachung, statt sie zu verschweigen', () => {
    expect(world.scale).toBe('10m')
    expect(world.toleranceDegrees).toBeGreaterThan(0)
    expect(world.toleranceDegrees).toBeLessThan(0.5)
  })
})
