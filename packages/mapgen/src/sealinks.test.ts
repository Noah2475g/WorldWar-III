import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readCsv } from './csv.ts'

/**
 * The curated sea lanes (T-M9-00, R-MAP-01/R-UNIT-06).
 *
 * These are the routes a geometry pass cannot find: Gibraltar and Hormus matter
 * because of what passes through them, not because of how wide they are. T-M9-02c
 * derives the remaining coastal links from the polygons and will check that each end
 * really is on a coast — what can be checked now is that every lane points at a
 * province that exists, in both directions, exactly once.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const provinces = readCsv(readFileSync(`${ROOT}/data/maps/world-provinces.csv`, 'utf8'))
const lanes = readCsv(readFileSync(`${ROOT}/data/maps/world-sealinks.csv`, 'utf8'))
const ids = new Set(provinces.map((row) => row.id!))

describe('R-MAP-01 Seewege', () => {
  it('verbindet nur Provinzen, die es gibt', () => {
    for (const lane of lanes) {
      expect(ids.has(lane.from!), `Seeweg "${lane.name}": ${lane.from} ist keine Provinz`).toBe(true)
      expect(ids.has(lane.to!), `Seeweg "${lane.name}": ${lane.to} ist keine Provinz`).toBe(true)
    }
  })

  it('verbindet keine Provinz mit sich selbst', () => {
    for (const lane of lanes) {
      expect(lane.from, `Seeweg "${lane.name}" beginnt und endet gleich`).not.toBe(lane.to)
    }
  })

  it('fuehrt keine Verbindung doppelt, auch nicht andersherum', () => {
    // A duplicated lane would double a coast's capacity in the pathfinder without
    // anyone seeing it on the map.
    const seen = new Set<string>()
    for (const lane of lanes) {
      const key = [lane.from, lane.to].sort().join('|')
      expect(seen.has(key), `Seeweg ${lane.from}-${lane.to} steht zweimal in der Tabelle`).toBe(false)
      seen.add(key)
    }
  })

  it('kennt nur die beiden vorgesehenen Arten', () => {
    for (const lane of lanes) {
      expect(['strait', 'sea']).toContain(lane.kind)
    }
  })

  it('begruendet jede Meerenge', () => {
    // A strait is a chokepoint: blocking it decides campaigns, so the reason it counts
    // as one belongs in the table and not in someone's memory.
    const straits = lanes.filter((lane) => lane.kind === 'strait')
    expect(straits.length).toBeGreaterThan(10)
    for (const strait of straits) {
      expect(strait.name!.length, `Meerenge ${strait.from}-${strait.to} ohne Namen`).toBeGreaterThan(3)
    }
  })

  it('bindet jede Startnation ans Meer an', () => {
    // A landlocked great power cannot play the naval half of the game at all.
    const rules = JSON.parse(readFileSync(`${ROOT}/data/mapgen/merge-rules.json`, 'utf8')) as {
      startNations: { nations: Record<string, { countries: string[] }> }
    }
    const connected = new Set(lanes.flatMap((lane) => [lane.from!, lane.to!]))

    for (const [key, nation] of Object.entries(rules.startNations.nations)) {
      const own = provinces.filter((row) => nation.countries.includes(row.country!))
      const atSea = own.some((row) => connected.has(row.id!))
      expect(atSea, `Startnation ${key} hat keinen Seeweg`).toBe(true)
    }
  })
})
