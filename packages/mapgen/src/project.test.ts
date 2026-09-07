import { describe, expect, it } from 'vitest'
import {
  LAT_LIMIT,
  MAP_HEIGHT,
  MAP_LAT_BOTTOM,
  MAP_LAT_TOP,
  MAP_WIDTH,
  anchorFor,
  anchorOf,
  distanceKm,
  drawableRings,
  project,
  ringAreaPx2,
  toMapX,
  toMapY,
  unproject,
} from './project.ts'

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

describe('T-M19-01 Die Leinwand', () => {
  it('legt die Beschnittkanten genau auf den Rand', () => {
    // The band the canvas shows is 78° N to 58° S. If these drifted, every point in
    // the map would be off by the same amount and nothing would look wrong.
    expect(toMapY(MAP_LAT_TOP)).toBe(0)
    expect(toMapY(MAP_LAT_BOTTOM)).toBe(MAP_HEIGHT)
  })

  it('legt den Nullmeridian in die Mitte und die Datumsgrenze an die Raender', () => {
    expect(toMapX(0)).toBe(MAP_WIDTH / 2)
    expect(toMapX(-180)).toBe(0)
    expect(toMapX(180)).toBe(MAP_WIDTH)
  })

  it('waechst nach Norden schneller als nach Sueden — das ist Mercator', () => {
    // Ten degrees at the equator against ten degrees at 60° N: on the globe the same
    // distance, on this canvas not. It is why "take the biggest ring" picks Alaska.
    const equator = toMapY(0) - toMapY(10)
    const north = toMapY(50) - toMapY(60)

    expect(north).toBeGreaterThan(equator * 1.5)
  })
})

describe('T-M19-02 Die Umrisse einer Provinz', () => {
  /** A square of `size` degrees with its bottom-left corner at (lon, lat). */
  const square = (lon: number, lat: number, size: number) => [
    [lon, lat],
    [lon + size, lat],
    [lon + size, lat + size],
    [lon, lat + size],
    [lon, lat],
  ]

  it('nimmt bei einem MultiPolygon jeden Teil, nicht den groessten', () => {
    // The whole of T-M19-02 in one assertion. Alaska and California belong to the same
    // power and do not touch; a province that may only have one outline loses one.
    const shape = {
      type: 'MultiPolygon',
      coordinates: [[square(-150, 60, 8)], [square(-120, 34, 8)]],
    }

    expect(drawableRings(shape)).toHaveLength(2)
  })

  it('laesst die Loecher eines Teils weg', () => {
    // Ring two of a part is a hole. The map fills a province in one colour, so a hole
    // would have to be cut out of a fill that something else has already painted.
    const shape = { type: 'Polygon', coordinates: [square(0, 0, 20), square(5, 5, 5)] }

    expect(drawableRings(shape)).toHaveLength(1)
  })

  it('verwirft Ringe, die nach dem Runden keine Flaeche mehr haben', () => {
    // 1228 of the world's 3393 outer rings are in this state: after rounding to whole
    // pixels they are a line or a point, and filling them covers nothing.
    const shape = {
      type: 'MultiPolygon',
      coordinates: [[square(0, 0, 20)], [square(100, 0, 0.0001)]],
    }
    const rings = drawableRings(shape)

    expect(rings).toHaveLength(1)
    expect(ringAreaPx2(rings[0]!)).toBeGreaterThan(0)
  })

  it('misst die Flaeche eines Rings unabhaengig von seiner Umlaufrichtung', () => {
    const clockwise: [number, number][] = [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ]
    const anticlockwise = [...clockwise].reverse()

    expect(ringAreaPx2(clockwise)).toBe(100)
    expect(ringAreaPx2(anticlockwise)).toBe(100)
    expect(ringAreaPx2([[0, 0], [10, 10]])).toBe(0)
  })
})

describe('T-M19-02 Der Ankerpunkt', () => {
  const ring = (points: [number, number][]) => points

  it('laesst einen Anker stehen, der schon auf seiner Flaeche liegt', () => {
    const square = ring([
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ])

    expect(anchorFor([50, 50], [square])).toEqual([50, 50])
  })

  it('holt einen Anker zurueck, der neben der Provinz liegt', () => {
    // A crescent: the average of its boundary points is in the bay, not on the land.
    // That is Norway, and its army marker stood in the North Sea until T-M19-02.
    const crescent = ring([
      [0, 0],
      [100, 0],
      [100, 20],
      [60, 20],
      [60, 80],
      [100, 80],
      [100, 100],
      [0, 100],
    ])

    const anchor = anchorFor([80, 50], [crescent])

    expect(anchor).not.toEqual([80, 50])
    expect(anchor[0]).toBeLessThan(60)
  })

  it('waehlt den groessten Teil, nicht irgendeinen', () => {
    // An anchor on a province's smallest offshore island would put its label out at sea.
    const mainland = ring([
      [0, 0],
      [200, 0],
      [200, 200],
      [0, 200],
    ])
    const islet = ring([
      [900, 900],
      [910, 900],
      [910, 910],
      [900, 910],
    ])

    const anchor = anchorFor([500, 500], [islet, mainland])

    expect(anchor[0]).toBeLessThan(200)
    expect(anchor[1]).toBeLessThan(200)
  })

  it('gibt null, wenn es nichts zu ankern gibt', () => {
    expect(anchorOf([])).toBeNull()
    expect(anchorOf([[[0, 0], [1, 1]]])).toBeNull()
  })
})
