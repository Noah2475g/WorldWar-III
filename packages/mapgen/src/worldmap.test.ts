import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateMap } from '@worldwar/core'
import type { MapData } from '@worldwar/core'
import { describe, expect, it } from 'vitest'

/**
 * The finished world map, checked against the core's own validator (T-M9-02c).
 *
 * Everything up to here tested the pipeline. This tests the product: the file the game
 * will actually load, judged by the same ten error classes that guard the test map
 * (T-M2-01). If the world map cannot pass what the small map passes, it is not a map.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const shapes = JSON.parse(readFileSync(`${ROOT}/data/maps/world-shapes.json`, 'utf8')) as {
  provinces: { id: string; coastal: boolean }[]
  seaLanes: { from: string; to: string; crossing: string; name: string }[]
}

describe('R-MAP-01 Die Weltkarte besteht den Kartenvalidator', () => {
  it('meldet keinen einzigen Fehler', () => {
    const result = validateMap(world)
    // MapValidation is a union: on success there is no error list at all.
    const errors = result.ok ? [] : result.errors

    expect(
      errors,
      `Validator meldet ${errors.length} Fehler:\n` +
        errors
          .slice(0, 12)
          .map((error: unknown) => `  ${JSON.stringify(error)}`)
          .join('\n'),
    ).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('traegt Kanten in beide Richtungen im Index', () => {
    world.edges.forEach((edge, index) => {
      expect(world.edgesByProvince[edge.a], `${edge.a} kennt Kante ${index} nicht`).toContain(index)
      expect(world.edgesByProvince[edge.b], `${edge.b} kennt Kante ${index} nicht`).toContain(index)
    })
  })

  it('gibt jeder Provinz einen Eintrag im Index, auch ohne Kanten', () => {
    for (const province of world.provinces) {
      expect(world.edgesByProvince[province.id], `${province.id} fehlt im Index`).toBeDefined()
    }
  })
})

describe('R-UNIT-06 Seewege der Weltkarte', () => {
  const seaEdges = world.edges.filter((e) => e.kind === 'sea')

  it('gibt jeder Kuestenprovinz einen Seeweg', () => {
    // Without this a coastal province cannot be reached by ship, and half the map is
    // closed to fleets while looking perfectly normal.
    const reachableBySea = new Set(seaEdges.flatMap((e) => [e.a, e.b]))
    const stranded = shapes.provinces
      .filter((p) => p.coastal && !reachableBySea.has(p.id))
      .map((p) => p.id)

    expect(stranded, `ohne Seeweg: ${stranded.join(', ')}`).toEqual([])
  })

  it('legt keinen Seeweg an eine Binnenprovinz', () => {
    const coastal = new Set(shapes.provinces.filter((p) => p.coastal).map((p) => p.id))
    for (const edge of seaEdges) {
      expect(coastal.has(edge.a), `${edge.a} hat keine Küste, aber einen Seeweg`).toBe(true)
      expect(coastal.has(edge.b), `${edge.b} hat keine Küste, aber einen Seeweg`).toBe(true)
    }
  })

  it('markiert die Meerengen', () => {
    // A strait is a chokepoint: holding it decides a campaign, so the map has to say
    // which crossings are one.
    const straits = world.edges.filter((e) => e.crossing === 'strait')

    expect(straits.length).toBeGreaterThan(15)
    const named = shapes.seaLanes.filter((l) => l.crossing === 'strait').map((l) => l.name)
    for (const expected of ['Straße von Gibraltar', 'Straße von Hormus', 'Straße von Malakka', 'Bosporus']) {
      expect(named, `${expected} fehlt`).toContain(expected)
    }
  })

  it('misst jeden Seeweg auf der Kugel, nicht ueber die halbe Welt', () => {
    for (const edge of seaEdges) {
      // Fixed-point: the core stores kilometres with three decimals.
      const km = edge.distanceKm / 1000
      expect(km, `${edge.a}-${edge.b}`).toBeGreaterThan(0)
      expect(km, `${edge.a}-${edge.b} ist ${Math.round(km)} km lang`).toBeLessThan(9000)
    }
  })

  it('verbindet die Landmassen ueber See zu einem Ganzen', () => {
    // With ships, everything must be reachable from everything. A map where Australia
    // cannot be reached at all is not a world map.
    const links = new Map<string, string[]>()
    for (const edge of world.edges) {
      ;(links.get(edge.a) ?? links.set(edge.a, []).get(edge.a)!).push(edge.b)
      ;(links.get(edge.b) ?? links.set(edge.b, []).get(edge.b)!).push(edge.a)
    }

    const start = world.provinces[0]!.id
    const seen = new Set([start])
    const queue = [start]
    while (queue.length > 0) {
      for (const next of links.get(queue.pop()!) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }

    const unreachable = world.provinces.filter((p) => !seen.has(p.id)).map((p) => p.name)
    expect(unreachable, `nicht erreichbar: ${unreachable.join(', ')}`).toEqual([])
  })
})

describe('R-GAME-01 Startaufstellung der Weltkarte', () => {
  it('gibt jeder Startnation eine Hauptstadt und mindestens drei Provinzen', () => {
    expect(world.startPositions.length).toBeGreaterThanOrEqual(12)
    const ids = new Set(world.provinces.map((p) => p.id))

    for (const start of world.startPositions) {
      expect(start.capital, `${start.nation} ohne Hauptstadt`).not.toBe('')
      expect(ids.has(start.capital), `${start.nation}: Hauptstadt ${start.capital} gibt es nicht`).toBe(true)
      expect(start.provinces, `${start.nation} hat zu wenige Provinzen`).toContain(start.capital)
      expect(start.provinces.length, `${start.nation} hat ${start.provinces.length} Provinzen`).toBeGreaterThanOrEqual(3)
    }
  })

  it('gibt keine Provinz an zwei Nationen', () => {
    const owner = new Map<string, string>()
    for (const start of world.startPositions) {
      for (const province of start.provinces) {
        expect(
          owner.has(province),
          `${province} gehoert ${owner.get(province)} und ${start.nation}`,
        ).toBe(false)
        owner.set(province, start.nation)
      }
    }
  })
})
