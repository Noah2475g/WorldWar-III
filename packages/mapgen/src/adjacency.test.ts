import { describe, expect, it } from 'vitest'
import { buildAdjacency, findEnclaves, type NeighbourEdge } from './adjacency.ts'
import type { UnitShape } from './provinces.ts'

/**
 * Who borders whom (T-M9-02b, R-MAP-01/R-MAP-02).
 *
 * Derived from shared arcs, not from coordinates that happen to match: after
 * simplification two neighbours no longer carry identical points, so comparing points
 * would silently declare Poland and Germany strangers. The topology knows they share an
 * arc, and it knows it exactly.
 *
 * Distance is a separate question from adjacency and gets a separate instrument:
 * neighbours are found on the map, distances are measured on the globe.
 */

const square = (code: string, province: string, x: number, y: number, w = 1, h = 1): UnitShape => ({
  code,
  provinceId: province,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
        [x, y],
      ],
    ],
  },
})

const between = (edges: readonly NeighbourEdge[], a: string, b: string): NeighbourEdge | undefined =>
  edges.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a))

describe('R-MAP-01 Nachbarschaft aus geteilten Boegen', () => {
  it('erkennt zwei Provinzen, die sich eine Kante teilen', () => {
    const { edges } = buildAdjacency([square('a', 'P1', 0, 0), square('b', 'P2', 1, 0)])

    expect(edges).toHaveLength(1)
    expect(between(edges, 'P1', 'P2')).toBeDefined()
  })

  it('erkennt keine Nachbarschaft ueber eine Luecke hinweg', () => {
    const { edges } = buildAdjacency([square('a', 'P1', 0, 0), square('b', 'P2', 5, 0)])

    expect(edges).toEqual([])
  })

  it('fuehrt jede Nachbarschaft genau einmal, nicht in beide Richtungen', () => {
    const { edges } = buildAdjacency([
      square('a', 'P1', 0, 0),
      square('b', 'P2', 1, 0),
      square('c', 'P3', 2, 0),
    ])

    expect(edges).toHaveLength(2)
    expect(between(edges, 'P1', 'P2')).toBeDefined()
    expect(between(edges, 'P2', 'P3')).toBeDefined()
    expect(between(edges, 'P1', 'P3')).toBeUndefined()
  })

  it('gibt die Nachbarn beider Seiten symmetrisch zurueck', () => {
    const { neighbours } = buildAdjacency([square('a', 'P1', 0, 0), square('b', 'P2', 1, 0)])

    expect(neighbours.P1).toEqual(['P2'])
    expect(neighbours.P2).toEqual(['P1'])
  })

  it('zaehlt Teile derselben Provinz nicht als Nachbarn ihrer selbst', () => {
    const { edges, neighbours } = buildAdjacency([
      square('a', 'P1', 0, 0),
      square('b', 'P1', 1, 0),
      square('c', 'P2', 2, 0),
    ])

    expect(edges).toHaveLength(1)
    expect(neighbours.P1).toEqual(['P2'])
  })

  it('misst die Entfernung auf der Kugel, nicht auf dem Bild', () => {
    // One degree of longitude at the equator is about 111 km; at 60° north it is half
    // that. A neighbour list that charged map width would make the north unaffordable.
    const equator = buildAdjacency([square('a', 'P1', 0, 0), square('b', 'P2', 1, 0)])
    const north = buildAdjacency([square('a', 'P1', 0, 60), square('b', 'P2', 1, 60)])

    const south = between(equator.edges, 'P1', 'P2')!
    const cold = between(north.edges, 'P1', 'P2')!

    expect(south.distanceKm).toBeGreaterThan(100)
    expect(south.distanceKm).toBeLessThan(125)
    expect(cold.distanceKm).toBeLessThan(south.distanceKm * 0.6)
  })

  it('sortiert Kanten und Nachbarn, damit die Karte reproduzierbar bleibt', () => {
    const parts = [square('a', 'P2', 1, 0), square('b', 'P1', 0, 0), square('c', 'P3', 2, 0)]

    const forwards = buildAdjacency(parts)
    const backwards = buildAdjacency([...parts].reverse())

    expect(JSON.stringify(forwards)).toBe(JSON.stringify(backwards))
    expect(forwards.edges.map((e) => `${e.from}-${e.to}`)).toEqual(['P1-P2', 'P2-P3'])
  })

  it('gibt bei leerer Eingabe nichts zurueck', () => {
    expect(buildAdjacency([])).toEqual({ edges: [], neighbours: {}, islands: [], ringed: [] })
  })
})

describe('R-MAP-02 Enklaven und abgeschnittene Gebiete', () => {
  it('findet eine Provinz, die ganz von einer einzigen anderen umschlossen ist', () => {
    // Eight unit squares around one in the middle. They have to be unit squares: a
    // topology recognises a shared border only where the point sequences match, and
    // one long rectangle along the bottom would share no arc with the small square
    // above part of it — which is exactly how real map data can go wrong too.
    const parts = [
      square('r1', 'RING', 0, 0),
      square('r2', 'RING', 1, 0),
      square('r3', 'RING', 2, 0),
      square('r4', 'RING', 0, 1),
      square('r5', 'RING', 2, 1),
      square('r6', 'RING', 0, 2),
      square('r7', 'RING', 1, 2),
      square('r8', 'RING', 2, 2),
      square('inner', 'INNER', 1, 1),
    ]

    const { neighbours, ringed } = buildAdjacency(parts)
    const country = { INNER: 'AAA', RING: 'BBB' }

    // Not RING, although its only neighbour is foreign too: RING's own border faces
    // the open map, and an enclave is precisely the thing that has no such edge.
    expect(ringed).toEqual(['INNER'])
    expect(findEnclaves(neighbours, country, ringed)).toEqual(['INNER'])
  })

  it('haelt eine Provinz mit zwei Nachbarn nicht fuer eine Enklave', () => {
    const { neighbours } = buildAdjacency([
      square('a', 'P1', 0, 0),
      square('b', 'P2', 1, 0),
      square('c', 'P3', 2, 0),
    ])

    // Same country throughout: nobody is surrounded by a foreign power.
    expect(findEnclaves(neighbours, { P1: 'AAA', P2: 'AAA', P3: 'AAA' }, [])).toEqual([])
  })

  it('erkennt eine Enklave auch, wenn das umschliessende Land selbst geteilt ist', () => {
    // Lesotho is the case that sent the first definition back: it touches two South
    // African provinces, so "surrounded by one province" found nothing at all.
    const parts = [
      square('r1', 'BIG-W', 0, 0),
      square('r2', 'BIG-W', 1, 0),
      square('r3', 'BIG-E', 2, 0),
      square('r4', 'BIG-W', 0, 1),
      square('r5', 'BIG-E', 2, 1),
      square('r6', 'BIG-W', 0, 2),
      square('r7', 'BIG-E', 1, 2),
      square('r8', 'BIG-E', 2, 2),
      square('inner', 'SMALL', 1, 1),
    ]

    const { neighbours, ringed } = buildAdjacency(parts)
    const country = { 'BIG-W': 'BIG', 'BIG-E': 'BIG', SMALL: 'SML' }

    expect(findEnclaves(neighbours, country, ringed)).toEqual(['SMALL'])
  })

  it('haelt eine Insel ohne Nachbarn nicht fuer eine Enklave', () => {
    // An island is cut off, but not surrounded — the distinction matters, because an
    // enclave can be taken by land and an island cannot be reached without ships.
    const { neighbours, islands } = buildAdjacency([square('a', 'P1', 0, 0), square('b', 'P2', 9, 9)])

    expect(findEnclaves(neighbours, { P1: 'AAA', P2: 'BBB' }, [])).toEqual([])
    expect(islands).toEqual(['P1', 'P2'])
  })
})
