import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ANCHOR_EDGE_MARGIN,
  ANCHOR_MAX,
  ANCHOR_SPACING,
  anchorsFor,
  edgeDistanceOf,
  insideRing,
  largestRing,
  placeBuildings,
  ringArea,
} from './anchors.ts'
import type { Ring } from './picking.ts'

/**
 * Gebaeude stehen verteilt in der Provinz (T-M30-02, D27.3).
 *
 * Drei Zusagen, jede als Test: kein Anker ausserhalb der Flaeche, keine zwei naeher
 * als der Marker breit ist, und dieselbe Geometrie ergibt dieselben Anker — sonst
 * spraengen die Gebaeude beim Laden eines Spielstands an andere Orte.
 */

const square: Ring = [
  [0, 0],
  [200, 0],
  [200, 200],
  [0, 200],
]
const centre = { x: 100, y: 100 }

describe('T-M30-02 Anker in der Provinzflaeche', () => {
  it('rechnet Flaeche, Innenliegen und Randabstand', () => {
    expect(ringArea(square)).toBe(40_000)
    expect(insideRing({ x: 50, y: 50 }, square)).toBe(true)
    expect(insideRing({ x: 250, y: 50 }, square)).toBe(false)
    expect(edgeDistanceOf({ x: 30, y: 100 }, square)).toBe(30)
  })

  it('legt keinen Anker ausserhalb des Polygons und keinen zu nah am Rand', () => {
    for (const anchor of anchorsFor([square], centre)) {
      expect(insideRing(anchor, square)).toBe(true)
      expect(anchor.edgeDistance).toBeGreaterThanOrEqual(ANCHOR_EDGE_MARGIN)
    }
  })

  it('haelt zwischen zwei Ankern den Mindestabstand und deckelt die Anzahl', () => {
    const anchors = anchorsFor([square], centre)
    expect(anchors.length).toBeGreaterThan(3)
    expect(anchors.length).toBeLessThanOrEqual(ANCHOR_MAX)
    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        const d = Math.hypot(anchors[i]!.x - anchors[j]!.x, anchors[i]!.y - anchors[j]!.y)
        expect(d, `Anker ${i} und ${j}`).toBeGreaterThanOrEqual(ANCHOR_SPACING)
      }
    }
  })

  it('sortiert nah am Mittelpunkt zuerst', () => {
    const anchors = anchorsFor([square], centre)
    const d = (a: { x: number; y: number }) => Math.hypot(a.x - centre.x, a.y - centre.y)
    for (let i = 1; i < anchors.length; i++) expect(d(anchors[i]!)).toBeGreaterThanOrEqual(d(anchors[i - 1]!))
  })

  it('ergibt aus gleicher Eingabe gleiche Anker', () => {
    expect(anchorsFor([square], centre)).toEqual(anchorsFor([square], centre))
  })

  it('nimmt den groessten Ring, nicht die Insel', () => {
    const island: Ring = [
      [500, 500],
      [520, 500],
      [520, 520],
      [500, 520],
    ]
    expect(largestRing([island, square])).toBe(square)
    for (const anchor of anchorsFor([island, square], centre)) expect(insideRing(anchor, square)).toBe(true)
  })

  it('gibt einer zu kleinen Provinz ihren Mittelpunkt als einzigen Anker', () => {
    const tiny: Ring = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    expect(anchorsFor([tiny], { x: 5, y: 5 })).toEqual([{ x: 5, y: 5, edgeDistance: 5 }])
    expect(anchorsFor([], { x: 5, y: 5 })).toEqual([{ x: 5, y: 5, edgeDistance: 0 }])
  })

  it('setzt Hafen und Werft an den Rand, die anderen in fester Reihenfolge nach innen', () => {
    const anchors = anchorsFor([square], centre)
    const placed = placeBuildings({ barracks: 1, harbour: 1, factory: 2, shipyard: 1 }, anchors)

    expect(placed.map((p) => p.building)).toEqual(['barracks', 'factory', 'harbour', 'shipyard'])
    // Hafen: der randnaechste Anker ueberhaupt, Werft der zweitnaechste.
    const byEdge = [...anchors].sort((a, b) => a.edgeDistance - b.edgeDistance)
    expect(placed.find((p) => p.building === 'harbour')).toMatchObject({ x: byEdge[0]!.x, y: byEdge[0]!.y })
    expect(placed.find((p) => p.building === 'shipyard')).toMatchObject({ x: byEdge[1]!.x, y: byEdge[1]!.y })
    // Kaserne: der mittelpunktnaechste Anker, der nicht fuer die Kueste reserviert ist.
    const inland = anchors.filter((a) => a !== byEdge[0] && a !== byEdge[1])
    expect(placed[0]).toMatchObject({ x: inland[0]!.x, y: inland[0]!.y, level: 1 })
    expect(placed.find((p) => p.building === 'factory')!.level).toBe(2)
  })

  it('verschiebt bestehende Gebaeude nicht, wenn ein neues dazukommt', () => {
    const anchors = anchorsFor([square], centre)
    const before = placeBuildings({ barracks: 1, factory: 1 }, anchors)
    const after = placeBuildings({ barracks: 1, factory: 1, fortress: 1 }, anchors)

    for (const b of before) {
      expect(after.find((a) => a.building === b.building)).toMatchObject({ x: b.x, y: b.y })
    }
  })

  it('findet auf der echten Weltkarte fuer jede Provinz mindestens einen Anker im Land', () => {
    const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
    const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as {
      provinces: { id: string; center: { x: number; y: number }; polygons: Ring[] }[]
    }
    let inland = 0
    for (const province of world.provinces) {
      const anchors = anchorsFor(province.polygons, province.center)
      expect(anchors.length, province.id).toBeGreaterThan(0)
      const ring = largestRing(province.polygons)!
      for (const anchor of anchors) {
        if (anchor.edgeDistance >= ANCHOR_EDGE_MARGIN) {
          expect(insideRing(anchor, ring), `${province.id} ${anchor.x},${anchor.y}`).toBe(true)
          inland++
        }
      }
    }
    // Die allermeisten Provinzen sind gross genug fuer echte Anker — sonst stuenden
    // die Gebaeude doch wieder alle in der Mitte.
    expect(inland).toBeGreaterThan(world.provinces.length * 3)
  })
})
