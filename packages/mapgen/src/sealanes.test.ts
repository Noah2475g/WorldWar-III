import { describe, expect, it } from 'vitest'
import {
  deriveSeaLanes,
  interpolate,
  pointInShape,
  shortestLonDelta,
  type CoastalProvince,
} from './sealanes.ts'
import type { Shape } from './area.ts'

/**
 * Sea lanes (T-M9-02c, R-MAP-01/R-UNIT-06).
 *
 * The two failures worth testing for are the ones nobody sees in a screenshot: a lane
 * that runs over land, and a lane measured the long way round the date line. Both look
 * fine on a map and both break the game — the first lets fleets sail through the Alps,
 * the second makes Kamchatka and Alaska twenty thousand kilometres apart.
 */

const box = (x: number, y: number, w = 1, h = 1): Shape => ({
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
})

const province = (id: string, lon: number, lat: number, shape?: Shape): CoastalProvince => ({
  id,
  centre: { lon, lat },
  shape: shape ?? box(lon - 0.5, lat - 0.5),
})

describe('R-UNIT-06 Die Datumsgrenze', () => {
  it('nimmt den kurzen Weg', () => {
    expect(shortestLonDelta(179, -179)).toBe(2)
    expect(shortestLonDelta(-179, 179)).toBe(-2)
    expect(shortestLonDelta(10, 20)).toBe(10)
    expect(shortestLonDelta(-170, 170)).toBe(-20)
  })

  it('fuehrt einen Zwischenpunkt ueber die Grenze statt um die Welt', () => {
    const middle = interpolate({ lon: 179, lat: 0 }, { lon: -179, lat: 0 }, 0.5)

    // Halfway between 179°E and 179°W is the date line itself, not Greenwich.
    expect(Math.abs(Math.abs(middle.lon) - 180)).toBeLessThan(0.001)
  })

  it('haelt jeden Zwischenpunkt in gueltigen Koordinaten', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const point = interpolate({ lon: 170, lat: 60 }, { lon: -170, lat: 55 }, t)
      expect(Math.abs(point.lon)).toBeLessThanOrEqual(180)
      expect(point.lat).toBeGreaterThan(50)
      expect(point.lat).toBeLessThan(65)
    }
  })
})

describe('R-MAP-01 Punkt in Flaeche', () => {
  it('erkennt innen und aussen', () => {
    const shape = box(0, 0, 2, 2)

    expect(pointInShape({ lon: 1, lat: 1 }, shape)).toBe(true)
    expect(pointInShape({ lon: 3, lat: 1 }, shape)).toBe(false)
    expect(pointInShape({ lon: 1, lat: 3 }, shape)).toBe(false)
  })

  it('erkennt ein Loch als aussen', () => {
    const withHole: Shape = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [4, 4],
          [0, 4],
          [0, 0],
        ],
        [
          [1, 1],
          [3, 1],
          [3, 3],
          [1, 3],
          [1, 1],
        ],
      ],
    }

    expect(pointInShape({ lon: 0.5, lat: 0.5 }, withHole)).toBe(true)
    expect(pointInShape({ lon: 2, lat: 2 }, withHole)).toBe(false)
  })

  it('funktioniert auch beiderseits der Datumsgrenze', () => {
    const straddling: Shape = {
      type: 'Polygon',
      coordinates: [
        [
          [179, 0],
          [-179, 0],
          [-179, 2],
          [179, 2],
          [179, 0],
        ],
      ],
    }

    expect(pointInShape({ lon: 180, lat: 1 }, straddling)).toBe(true)
    expect(pointInShape({ lon: 0, lat: 1 }, straddling)).toBe(false)
  })
})

describe('R-MAP-01 Abgeleitete Seewege', () => {
  it('verbindet zwei nahe Kuestenprovinzen', () => {
    const lanes = deriveSeaLanes([province('A', 0, 0), province('B', 3, 0)], new Set())

    expect(lanes).toHaveLength(1)
    expect(lanes[0]).toMatchObject({ from: 'A', to: 'B' })
    expect(lanes[0]!.distanceKm).toBeGreaterThan(300)
  })

  it('fuehrt keinen Seeweg ueber eine dritte Provinz', () => {
    // A and C are close, but B sits squarely between them: that is a road, not a sea
    // lane, and a fleet taking it would sail over land.
    const lanes = deriveSeaLanes(
      [province('A', 0, 0), province('B', 2, 0, box(1, -1, 2, 2)), province('C', 4, 0)],
      new Set(),
    )

    expect(lanes.some((l) => [l.from, l.to].sort().join() === 'A,C')).toBe(false)
  })

  it('legt keinen zweiten Weg auf ein bereits verbundenes Paar', () => {
    // A and B share a land border. C is nearby and unconnected, so both get a lane to
    // C — and A-B stays as it was, rather than being doubled by a sea route beside the
    // land one.
    const lanes = deriveSeaLanes(
      [province('A', 0, 0), province('B', 3, 0), province('C', 1.5, 3)],
      new Set(['A|B']),
    )

    expect(lanes.some((l) => [l.from, l.to].sort().join() === 'A,B')).toBe(false)
    expect(lanes.length).toBeGreaterThan(0)
  })

  it('zieht in der ersten Runde keine Verbindung ueber den halben Ozean', () => {
    // A has a near neighbour, so nothing forces a lane to the far side of the world.
    const lanes = deriveSeaLanes(
      [province('A', 0, 0), province('B', 3, 0), province('FAR', 120, 0), province('FAR2', 123, 0)],
      new Set(),
    )

    expect(lanes.some((l) => [l.from, l.to].sort().join() === 'A,FAR')).toBe(false)
    expect(lanes.some((l) => [l.from, l.to].sort().join() === 'A,B')).toBe(true)
    expect(lanes.some((l) => [l.from, l.to].sort().join() === 'FAR,FAR2')).toBe(true)
  })

  it('rechnet ueber die Datumsgrenze den kurzen Weg', () => {
    const lanes = deriveSeaLanes([province('A', 179, 50), province('B', -179, 50)], new Set())

    expect(lanes).toHaveLength(1)
    expect(lanes[0]!.distanceKm).toBeLessThan(200)
  })

  it('deckelt, wie viele Seewege eine Provinz bekommt', () => {
    const many = [0, 1, 2, 3, 4, 5].map((i) => province(`P${i}`, i, 0))

    const lanes = deriveSeaLanes(many, new Set(), { perProvince: 1 })

    for (const p of many) {
      const own = lanes.filter((l) => l.from === p.id || l.to === p.id)
      expect(own.length, `${p.id} hat ${own.length} Seewege`).toBeLessThanOrEqual(3)
    }
  })

  it('haengt nicht von der Reihenfolge der Eingabe ab', () => {
    const parts = [province('A', 0, 0), province('B', 3, 0), province('C', 6, 0)]

    const forwards = deriveSeaLanes(parts, new Set())
    const backwards = deriveSeaLanes([...parts].reverse(), new Set())

    expect(JSON.stringify(forwards)).toBe(JSON.stringify(backwards))
  })

  it('gibt auch Landnachbarn einen Seeweg, wenn sie sonst keinen haetten', () => {
    // Benin and Togo are land neighbours and each other's only nearby coast. Skipping
    // the pair as "already connected" left both with no way out to sea — an army can
    // walk a land border, a fleet cannot sail it.
    const lanes = deriveSeaLanes(
      [province('A', 0, 0), province('B', 3, 0)],
      new Set(['A|B']),
    )

    expect(lanes).toHaveLength(1)
    expect(lanes[0]).toMatchObject({ from: 'A', to: 'B' })
  })

  it('verbindet eine abgelegene Kueste auch ueber grosse Entfernung', () => {
    // Beyond the ordinary range, but a coastal province with no lane at all is worse
    // than a long one.
    const lanes = deriveSeaLanes([province('A', 0, 0), province('B', 40, 0)], new Set())

    expect(lanes).toHaveLength(1)
    expect(lanes[0]!.distanceKm).toBeGreaterThan(4000)
  })

  it('gibt bei einer einzigen Provinz nichts zurueck', () => {
    expect(deriveSeaLanes([province('A', 0, 0)], new Set())).toEqual([])
  })
})
