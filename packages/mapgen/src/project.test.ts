import { describe, expect, it } from 'vitest'
import { LAT_LIMIT, distanceKm, project, unproject } from './project'

/**
 * The point of these tests is one distinction: the picture and the world are not the
 * same thing. Projection serves the screen; distances that the game charges movement
 * for are measured on the globe. Conflating them makes northern provinces silently
 * expensive to cross.
 */

const PLACES = {
  berlin: { lon: 13.405, lat: 52.52 },
  paris: { lon: 2.3522, lat: 48.8566 },
  london: { lon: -0.1276, lat: 51.5072 },
  newYork: { lon: -74.006, lat: 40.7128 },
  quito: { lon: -78.4678, lat: -0.1807 },
  singapore: { lon: 103.8198, lat: 1.3521 },
  reykjavik: { lon: -21.8277, lat: 64.1265 },
}

describe('R-MAP-04 Projektion', () => {
  it('ist umkehrbar', () => {
    for (const place of Object.values(PLACES)) {
      const back = unproject(project(place))
      expect(back.lon).toBeCloseTo(place.lon, 9)
      expect(back.lat).toBeCloseTo(place.lat, 9)
    }
  })

  it('ist auch an den Raendern umkehrbar', () => {
    const edges = [
      { lon: -180, lat: 0 },
      { lon: 180, lat: 0 },
      { lon: 0, lat: LAT_LIMIT },
      { lon: 0, lat: -LAT_LIMIT },
    ]
    for (const edge of edges) {
      const back = unproject(project(edge))
      expect(back.lon).toBeCloseTo(edge.lon, 8)
      expect(back.lat).toBeCloseTo(edge.lat, 8)
    }
  })

  it('klammert die Pole, statt ins Unendliche zu laufen', () => {
    // Mercator sends the poles to infinity. An unclamped point would produce NaN
    // coordinates and a province that cannot be drawn at all.
    const north = project({ lon: 0, lat: 90 })
    const south = project({ lon: 0, lat: -90 })

    expect(Number.isFinite(north.y)).toBe(true)
    expect(Number.isFinite(south.y)).toBe(true)
    expect(north.y).toBeCloseTo(project({ lon: 0, lat: LAT_LIMIT }).y, 12)
    expect(south.y).toBeCloseTo(project({ lon: 0, lat: -LAT_LIMIT }).y, 12)
  })

  it('liefert Bildkoordinaten im Einheitsquadrat', () => {
    for (const place of Object.values(PLACES)) {
      const point = project(place)
      expect(point.x).toBeGreaterThanOrEqual(0)
      expect(point.x).toBeLessThanOrEqual(1)
      expect(point.y).toBeGreaterThanOrEqual(0)
      expect(point.y).toBeLessThanOrEqual(1)
    }
  })
})

describe('R-MAP-04 Geodaetische Entfernung', () => {
  it('trifft bekannte Strecken auf ein Prozent genau', () => {
    expect(distanceKm(PLACES.berlin, PLACES.paris)).toBeCloseTo(878, -1)
    expect(distanceKm(PLACES.london, PLACES.newYork)).toBeCloseTo(5570, -2)
    expect(distanceKm(PLACES.quito, PLACES.singapore)).toBeCloseTo(19_800, -3)
  })

  it('ist symmetrisch und null fuer denselben Punkt', () => {
    expect(distanceKm(PLACES.berlin, PLACES.paris)).toBeCloseTo(
      distanceKm(PLACES.paris, PLACES.berlin),
      9,
    )
    expect(distanceKm(PLACES.berlin, PLACES.berlin)).toBe(0)
  })

  it('rechnet ueber die Datumsgrenze den kurzen Weg', () => {
    // 179° E to 179° W is 222 km apart, not most of the way around the planet.
    const west = { lon: 179, lat: 0 }
    const east = { lon: -179, lat: 0 }

    expect(distanceKm(west, east)).toBeLessThan(250)
  })

  it('misst die Welt, nicht das Bild', () => {
    // Two spans of one degree of longitude: one at the equator, one near the Arctic
    // circle. On the map they are the same width; on the globe the northern one is
    // less than half as long. A game that charged the map's width would make the
    // north absurdly expensive to cross.
    const equatorKm = distanceKm({ lon: 0, lat: 0 }, { lon: 1, lat: 0 })
    const northKm = distanceKm({ lon: 0, lat: 64 }, { lon: 1, lat: 64 })

    const equatorPixels = project({ lon: 1, lat: 0 }).x - project({ lon: 0, lat: 0 }).x
    const northPixels = project({ lon: 1, lat: 64 }).x - project({ lon: 0, lat: 64 }).x

    expect(equatorPixels).toBeCloseTo(northPixels, 12)
    expect(northKm).toBeLessThan(equatorKm * 0.5)
  })
})
