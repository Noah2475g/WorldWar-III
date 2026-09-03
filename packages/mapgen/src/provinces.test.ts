import { describe, expect, it } from 'vitest'
import { mergeProvinces, type UnitShape } from './provinces.ts'
import { ringAreaKm2, shapeAreaKm2, type Ring, type Shape } from './area.ts'

/**
 * Merging the parts of a province into one shape (T-M9-02a, R-MAP-01/R-MAP-03).
 *
 * Two properties decide whether the map is usable at all. The border between two units
 * of the same province has to *disappear* — not be drawn twice, not leave a hairline —
 * and the outer border has to stay exactly where it was, because the next step derives
 * neighbours from shared edges. Merging through the topology gives both: shared arcs
 * are recognised as the same arc, not as two lines that happen to coincide.
 *
 * And the order matters: merge first, simplify afterwards. Simplifying the parts first
 * moves their shared edges apart by a hair each, and the merge then leaves slivers
 * between provinces that no longer touch.
 */

/** A unit square from (x, y) to (x + 1, y + 1), as a GeoJSON ring. */
const square = (code: string, province: string, x: number, y: number): UnitShape => ({
  code,
  provinceId: province,
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
        [x, y],
      ],
    ],
  },
})

/** The rings of a shape, whether it is one polygon or several. */
const ringsOf = (shape: Shape): Ring[] =>
  shape.type === 'MultiPolygon' ? shape.coordinates.flat() : shape.coordinates

/** The rings of the outer polygon, for a shape known to have exactly one. */
const outerRings = (shape: Shape): Ring[] =>
  shape.type === 'Polygon' ? shape.coordinates : (shape.coordinates[0] ?? [])

describe('R-MAP-01 Provinzen entstehen durch Verschmelzen', () => {
  it('macht aus zwei angrenzenden Einheiten eine Flaeche', () => {
    const merged = mergeProvinces([square('a', 'P1', 0, 0), square('b', 'P1', 1, 0)])

    expect(merged).toHaveLength(1)
    expect(merged[0]?.id).toBe('P1')
    // Two unit squares side by side make one rectangle, not two squares in a bag.
    expect(merged[0]?.geometry.type).toBe('Polygon')
  })

  it('loescht die Grenze zwischen den Teilen', () => {
    const merged = mergeProvinces([square('a', 'P1', 0, 0), square('b', 'P1', 1, 0)])
    const ring = outerRings(merged[0]!.geometry)[0]!

    // The two points where the seam met the outline survive as vertices, and that is
    // fine — a vertex costs nothing. What must be gone is the seam as an *edge*: no
    // two consecutive points may both sit on x = 1, because that segment would be the
    // old border, still drawn straight through the middle of the province.
    for (let i = 0; i < ring.length - 1; i++) {
      const here = ring[i]!
      const next = ring[i + 1]!
      const isSeam = here[0] === 1 && next[0] === 1 && here[1] !== next[1]
      expect(isSeam, `Naht von ${here.join()} nach ${next.join()} ueberlebt`).toBe(false)
    }
    // One ring, not two: the parts really became one shape.
    expect(ringsOf(merged[0]!.geometry)).toHaveLength(1)
  })

  it('haelt die Aussengrenze zweier Provinzen deckungsgleich', () => {
    // The shared edge must survive as the *same* edge on both sides, or the adjacency
    // pass in T-M9-02b will not see the two provinces as neighbours.
    const merged = mergeProvinces([
      square('a', 'P1', 0, 0),
      square('b', 'P2', 1, 0),
    ])

    expect(merged).toHaveLength(2)
    const left = merged.find((p) => p.id === 'P1')!
    const right = merged.find((p) => p.id === 'P2')!
    const points = (p: typeof left) =>
      new Set(ringsOf(p.geometry).flat().map(([x, y]) => `${x},${y}`))

    const shared = [...points(left)].filter((point) => points(right).has(point))
    expect(shared.sort()).toEqual(['1,0', '1,1'])
  })

  it('haelt getrennte Inseln als mehrteilige Flaeche zusammen', () => {
    const merged = mergeProvinces([square('a', 'P1', 0, 0), square('b', 'P1', 5, 5)])

    expect(merged).toHaveLength(1)
    expect(merged[0]?.geometry.type).toBe('MultiPolygon')
    expect(merged[0]!.geometry.coordinates).toHaveLength(2)
  })

  it('behaelt die Gesamtflaeche bei', () => {
    // The merge must not lose or invent land. Two unit squares stay two unit squares.
    const parts = [square('a', 'P1', 0, 0), square('b', 'P1', 1, 0)]
    const before = parts.reduce((sum, part) => sum + ringAreaKm2(outerRings(part.geometry)[0]!), 0)

    const after = shapeAreaKm2(mergeProvinces(parts)[0]!.geometry)

    expect(after).toBeCloseTo(before, 0)
  })

  it('gibt jeder Provinz eine Flaeche groesser als null', () => {
    const merged = mergeProvinces([square('a', 'P1', 0, 0), square('b', 'P2', 3, 3)])

    for (const province of merged) expect(shapeAreaKm2(province.geometry)).toBeGreaterThan(0)
  })

  it('haengt nicht von der Reihenfolge der Eingabe ab', () => {
    const parts = [square('a', 'P1', 0, 0), square('b', 'P1', 1, 0), square('c', 'P2', 3, 0)]

    const forwards = mergeProvinces(parts)
    const backwards = mergeProvinces([...parts].reverse())

    expect(forwards.map((p) => p.id)).toEqual(backwards.map((p) => p.id))
    expect(JSON.stringify(forwards)).toBe(JSON.stringify(backwards))
  })

  it('gibt bei leerer Eingabe nichts zurueck', () => {
    expect(mergeProvinces([])).toEqual([])
  })
})
