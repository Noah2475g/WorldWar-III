import { describe, expect, it } from 'vitest'
import { splitGeographically } from './geosplit.ts'
import type { Admin1Record } from './curation.ts'

/**
 * Cutting a country into provinces by where its parts lie (T-M9-00).
 *
 * At 1:10m almost every country is subdivided, and most carry no usable grouping of
 * their own: Germany arrives as sixteen states with no regions, Turkey as eighty-one
 * provinces. Writing those groups out by hand for two dozen countries would be a day
 * of typing and a permanent liability — every Natural Earth release could rename a
 * unit and quietly drop it. Splitting by position is reproducible and needs only three
 * decisions per country: how many bands, along which axis, and what to call them.
 */

const at = (name: string, lat: number, lon: number): Admin1Record => ({
  code: name,
  countryIso: 'XX',
  name,
  nameDe: name,
  region: '',
  lat,
  lon,
})

describe('R-MAP-01 Aufteilung nach Lage', () => {
  it('teilt in Nord und Sued, wenn die Breite die Achse ist', () => {
    const units = [at('a', 54, 10), at('b', 53, 9), at('c', 48, 11), at('d', 47, 12)]

    const groups = splitGeographically(units, { lat: 2, lon: 1 })

    expect(groups).toHaveLength(2)
    // The first cell is the southern one: bands run from low latitude upwards, so the
    // order is stable and a name list can rely on it.
    expect(groups[0]?.units.map((u) => u.name).sort()).toEqual(['c', 'd'])
    expect(groups[1]?.units.map((u) => u.name).sort()).toEqual(['a', 'b'])
  })

  it('teilt in vier Felder, wenn beide Achsen zaehlen', () => {
    const units = [
      at('sw', 47, 7),
      at('so', 48, 13),
      at('nw', 53, 8),
      at('no', 54, 13),
    ]

    const groups = splitGeographically(units, { lat: 2, lon: 2 })

    expect(groups).toHaveLength(4)
    for (const group of groups) expect(group.units).toHaveLength(1)
    expect(groups[0]?.units[0]?.name).toBe('sw')
    expect(groups[3]?.units[0]?.name).toBe('no')
  })

  it('verteilt gleich viele Einheiten je Streifen, nicht gleich viel Flaeche', () => {
    // Equal spans would give Bavaria a province and the rest of Germany one, because
    // one unit happens to sit far south. Equal counts keep the provinces comparable.
    const units = [at('a', 10, 0), at('b', 11, 0), at('c', 12, 0), at('d', 80, 0)]

    const groups = splitGeographically(units, { lat: 2, lon: 1 })

    expect(groups.map((g) => g.units.length)).toEqual([2, 2])
  })

  it('laesst keinen Streifen leer', () => {
    const units = [at('a', 1, 1), at('b', 1, 1), at('c', 1, 1)]

    const groups = splitGeographically(units, { lat: 2, lon: 2 })

    for (const group of groups) expect(group.units.length).toBeGreaterThan(0)
    expect(groups.length).toBeLessThanOrEqual(3)
  })

  it('haengt nicht von der Reihenfolge der Eingabe ab', () => {
    const units = [at('a', 54, 10), at('b', 48, 11), at('c', 50, 9), at('d', 52, 13)]

    const forwards = splitGeographically(units, { lat: 2, lon: 2 })
    const backwards = splitGeographically([...units].reverse(), { lat: 2, lon: 2 })

    const shape = (groups: typeof forwards) =>
      groups.map((g) => g.units.map((u) => u.name).sort().join(','))
    expect(shape(forwards)).toEqual(shape(backwards))
  })

  it('gibt eine einzelne Provinz zurueck, wenn nicht geteilt wird', () => {
    const units = [at('a', 1, 1), at('b', 2, 2)]

    expect(splitGeographically(units, { lat: 1, lon: 1 })).toHaveLength(1)
  })

  it('kommt mit einer einzigen Einheit zurecht', () => {
    expect(splitGeographically([at('a', 1, 1)], { lat: 3, lon: 3 })).toHaveLength(1)
  })

  it('gibt bei leerer Eingabe nichts zurueck', () => {
    expect(splitGeographically([], { lat: 2, lon: 2 })).toEqual([])
  })
})
