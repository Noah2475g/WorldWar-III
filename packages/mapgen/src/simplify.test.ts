import { describe, expect, it } from 'vitest'
import { simplify, simplifyRing } from './simplify'
import type { LonLat } from './project'

/**
 * Natural Earth draws coastlines at a detail no strategy map needs — a single country
 * can carry thousands of points. Simplification is what makes the map drawable; what
 * must survive it is the shape, the ends, and the fact that neighbours still touch.
 */

const line = (...pairs: [number, number][]): LonLat[] =>
  pairs.map(([lon, lat]) => ({ lon, lat }))

describe('R-MAP-04 Vereinfachung von Linienzuegen', () => {
  it('wirft Punkte weg, die auf der Verbindung liegen', () => {
    const straight = line([0, 0], [1, 0.0001], [2, 0], [3, 0])

    expect(simplify(straight, 0.01)).toHaveLength(2)
  })

  it('behaelt Anfang und Ende unveraendert', () => {
    const wiggly = line([0, 0], [1, 3], [2, -2], [3, 4], [4, 0])

    const result = simplify(wiggly, 0.5)

    expect(result[0]).toEqual({ lon: 0, lat: 0 })
    expect(result[result.length - 1]).toEqual({ lon: 4, lat: 0 })
  })

  it('behaelt Ecken, die weiter als die Toleranz abweichen', () => {
    const corner = line([0, 0], [5, 5], [10, 0])

    expect(simplify(corner, 1)).toHaveLength(3)
    expect(simplify(corner, 10)).toHaveLength(2)
  })

  it('aendert nichts mehr beim zweiten Durchgang', () => {
    const coast = line([0, 0], [1, 0.4], [2, 0.1], [3, 1.9], [4, 0.2], [5, 0])

    const once = simplify(coast, 0.3)

    expect(simplify(once, 0.3)).toEqual(once)
  })

  it('laesst zu kurze Zuege in Ruhe', () => {
    expect(simplify(line([0, 0], [1, 1]), 5)).toHaveLength(2)
    expect(simplify(line([0, 0]), 5)).toHaveLength(1)
    expect(simplify([], 5)).toHaveLength(0)
  })

  it('haelt einen Ring geschlossen und mindestens ein Dreieck gross', () => {
    // A ring simplified below three points is no longer an area. Provinces that
    // collapse to a line would disappear from the map and break adjacency.
    const ring = line([0, 0], [1, 0.001], [2, 0], [2, 2], [0, 2], [0, 0])

    const result = simplifyRing(ring, 0.5)

    expect(result.length).toBeGreaterThanOrEqual(4)
    expect(result[0]).toEqual(result[result.length - 1])
  })

  it('rettet ein Dreieck, das die Toleranz ganz verschlucken wuerde', () => {
    const tiny = line([0, 0], [0.1, 0], [0.05, 0.08], [0, 0])

    const result = simplifyRing(tiny, 10)

    expect(result.length).toBeGreaterThanOrEqual(4)
    expect(result[0]).toEqual(result[result.length - 1])
  })
})
