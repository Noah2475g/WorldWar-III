import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { MapData } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import { readCsv } from './csv.ts'
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  drawableRings,
  ringAreaPx2,
  toMapX,
  toMapY,
  type MapPoint,
} from './project.ts'

/**
 * The drawn map against the map it was drawn from (T-M19-01, R-MAP-08).
 *
 * `worldmap.test.ts` next door checks that world.json is a *valid* map: every edge
 * indexed, every capital real, nothing stranded. It passed on 2026-09-03 while a third
 * of the world was missing from the picture, because a province with the wrong outline
 * is still a well-formed province. What was never checked is the one thing a player
 * sees: **is the land that the source knows about actually on the canvas.**
 *
 * These four checks read both files out of the tree and compare them through the same
 * projection the generator uses (`project.ts`) — not a copy of it. A guard that copies
 * the projection cannot fail when the projection is what went wrong.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as MapData
const shapes = JSON.parse(readFileSync(`${ROOT}/data/maps/world-shapes.json`, 'utf8')) as {
  provinces: { id: string; geometry: { type: string; coordinates: unknown } }[]
}
const landmarks = readCsv(readFileSync(`${ROOT}/data/maps/landmarks.csv`, 'utf8'))

/** The source outlines, projected onto the canvas — what the drawing *should* be. */
const source = new Map(shapes.provinces.map((p) => [p.id, drawableRings(p.geometry)]))

/** What the drawing *is*. */
const drawn = new Map(
  world.provinces.map((p) => [p.id, p.polygons as ReadonlyArray<ReadonlyArray<MapPoint>>]),
)

// ------------------------------------------------------------------ transition

/*
 * The provinces T-M19-02 has not repaired yet.
 *
 * These lists exist so that a guard measuring real damage does not have to be red in
 * `pnpm verify` while the repair is written — a new red guard blocking the chain is a
 * lesson this project already paid for on 2026-09-06. They are **not** a softer
 * threshold: every province outside a list is held to the full standard, and each test
 * also checks the other direction, so a list that has gone stale fails instead of
 * quietly protecting a province that is long since healthy.
 *
 * They may only shrink. T-M19-02 empties them.
 */

/** G1 — the anchor sits outside the province's own drawn area. Measured 2026-09-07. */
const G1_OFFEN: ReadonlySet<string> = new Set([])

/** G2 — less than 99 % of the source area is drawn. Measured 2026-09-07: 66 of 237. */
const G2_OFFEN: ReadonlySet<string> = new Set([])

/** G3 — the city is not inside the province the source puts it in. Measured 2026-09-07. */
const G3_OFFEN: ReadonlySet<string> = new Set([])

/** G4 — a point lies off the canvas. Emptied by T-M19-03. */
const G4_OFFEN: ReadonlySet<string> = new Set([])

// ------------------------------------------------------------------ geometry

/**
 * Tolerance for "the point is on this land", in pixels.
 *
 * Not a fudge factor: the coastline in the source is already simplified (Visvalingam,
 * 0,002 deg²), so a real place can sit a pixel outside the line that stands for its
 * coast. New York is 0,9 px off the drawn shore. Five pixels on a 4000 px canvas is
 * 0,125 % of the width — far too little to hide a missing landmass, which is what
 * these checks are for.
 */
const TOLERANCE = 5

function pointInRing(point: MapPoint, ring: ReadonlyArray<MapPoint>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    if (a[1] > point[1] !== b[1] > point[1]) {
      const x = ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
      if (point[0] < x) inside = !inside
    }
  }
  return inside
}

function distanceToSegment(point: MapPoint, a: MapPoint, b: MapPoint): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point[0] - a[0], point[1] - a[1])

  const t = Math.max(
    0,
    Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared),
  )
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy))
}

/** Inside one of the rings, or within `tolerance` of an edge of one. */
function onLand(
  point: MapPoint,
  rings: ReadonlyArray<ReadonlyArray<MapPoint>>,
  tolerance = 0,
): boolean {
  return rings.some((ring) => {
    if (pointInRing(point, ring)) return true
    if (tolerance === 0) return false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if (distanceToSegment(point, ring[i]!, ring[j]!) <= tolerance) return true
    }
    return false
  })
}

const areaOf = (rings: ReadonlyArray<ReadonlyArray<MapPoint>>): number =>
  rings.reduce((sum, ring) => sum + ringAreaPx2(ring), 0)

/**
 * Fails the list itself when a province on it is healthy again. Without this the
 * transition lists never shrink: a repair would make them merely redundant instead of
 * making them wrong, and nobody would notice they had become a lie.
 */
function keineVeralteteAusnahme(open: ReadonlySet<string>, broken: ReadonlySet<string>): void {
  const healed = [...open].filter((id) => !broken.has(id))
  expect(
    healed,
    `Diese Provinzen stehen auf der Uebergangsliste, sind aber heil: ${healed.join(', ')}. ` +
      `Streiche sie — sonst schuetzt die Liste einen Fehler, den es nicht mehr gibt.`,
  ).toEqual([])
}

// ------------------------------------------------------------------ the checks

describe('R-MAP-08 G1 Der Ankerpunkt liegt in der eigenen Flaeche', () => {
  it('setzt keine Provinzmarke ausserhalb ihrer Provinz', () => {
    // The anchor carries the army marker and the province label. An anchor outside its
    // own province puts Norway's army in the North Sea.
    const broken = new Set(
      world.provinces
        .filter((p) => !onLand([p.center.x, p.center.y], drawn.get(p.id) ?? []))
        .map((p) => p.id),
    )
    const unexpected = [...broken].filter((id) => !G1_OFFEN.has(id))

    expect(unexpected, `Ankerpunkt ausserhalb der eigenen Flaeche: ${unexpected.join(', ')}`).toEqual([])
    keineVeralteteAusnahme(G1_OFFEN, broken)
  })
})

describe('R-MAP-08 G2 Die gezeichnete Flaeche traegt die Quellflaeche', () => {
  it('zeichnet je Provinz mindestens 99 Prozent dessen, was die Quelle kennt', () => {
    // The whole finding in one number. A province drawn from one ring of a shape that
    // has 218 of them keeps a third of its land, and nothing else in the suite notices,
    // because the result is still a valid polygon.
    const broken = new Set<string>()
    const worst: string[] = []

    for (const [id, rings] of source) {
      const expected = areaOf(rings)
      if (expected === 0) continue
      const share = areaOf(drawn.get(id) ?? []) / expected
      if (share < 0.99) {
        broken.add(id)
        if (!G2_OFFEN.has(id)) worst.push(`${id} ${(share * 100).toFixed(1)} %`)
      }
    }

    expect(worst, `zeichnen weniger als 99 % ihrer Quellflaeche: ${worst.join(', ')}`).toEqual([])
    keineVeralteteAusnahme(G2_OFFEN, broken)
  })

  it('zeichnet die Landflaeche der Welt insgesamt', () => {
    // The per-province check can be satisfied while the world as a whole is not, so the
    // sum is named separately — and it is the figure the report quotes.
    let expected = 0
    let actual = 0
    for (const [id, rings] of source) {
      expected += areaOf(rings)
      actual += areaOf(drawn.get(id) ?? [])
    }
    const share = actual / expected

    // 85,78 % before T-M19-02, 100,00 % after: dropping only the rings that enclose no
    // area at all after rounding costs nothing measurable. The threshold stays at 99 %
    // rather than at 100 % so that a future simplification has room to cost a little.
    expect(share, `gezeichnet: ${(share * 100).toFixed(2)} % der Quellflaeche`).toBeGreaterThan(0.99)
  })
})

describe('R-MAP-08 G3 Bekannte Staedte liegen auf ihrer Provinz', () => {
  it.each(landmarks.map((l) => [l['name']!, l] as const))('%s', (name, row) => {
    // "On land somewhere" would be too weak: a city that falls out of its own province
    // into the neighbour's would pass. The source decides which province is right, so
    // the check stays honest when the curation changes.
    const point: MapPoint = [toMapX(Number(row['lon'])), toMapY(Number(row['lat']))]

    let owner: string | null = null
    for (const [id, rings] of source) {
      if (onLand(point, rings, TOLERANCE)) {
        owner = id
        break
      }
    }
    expect(owner, `${name} liegt in keiner Quellprovinz — stimmen die Koordinaten?`).not.toBeNull()

    const hits = onLand(point, drawn.get(owner!) ?? [], TOLERANCE)
    if (G3_OFFEN.has(name)) {
      expect(hits, `${name} ist heil — streiche sie aus G3_OFFEN`).toBe(false)
    } else {
      expect(hits, `${name} liegt nicht auf der gezeichneten Flaeche von ${owner}`).toBe(true)
    }
  })
})

describe('R-MAP-08 G4 Nichts liegt neben der Leinwand', () => {
  it('haelt jeden Punkt im Rechteck der Karte', () => {
    // The map declares its own size in width/height. A point outside it is not drawn at
    // all, and the province it belongs to loses that part of its coast without a word.
    const broken = new Set<string>()
    const unexpected: string[] = []

    for (const province of world.provinces) {
      const outside = (drawn.get(province.id) ?? [])
        .flat()
        .filter(([x, y]) => x < 0 || x > MAP_WIDTH || y < 0 || y > MAP_HEIGHT)
      if (outside.length === 0) continue

      broken.add(province.id)
      if (!G4_OFFEN.has(province.id)) {
        unexpected.push(`${province.id} (${outside.length} Punkte)`)
      }
    }

    expect(unexpected, `Punkte ausserhalb der Leinwand: ${unexpected.join(', ')}`).toEqual([])
    keineVeralteteAusnahme(G4_OFFEN, broken)
  })

  it('faltet die Nordkueste nicht auf die Kante', () => {
    // The check a green G4 cannot give on its own (T-M19-03). `y = Math.max(0, y)`
    // also puts every point inside the rectangle — by laying Greenland's whole north
    // coast on one straight line at the top. Before the clip, 796 of Greenland's 3430
    // points were above the edge; folded, all of them would sit exactly on y = 0.
    // Properly clipped only the crossings do, and there are seven.
    for (const province of world.provinces) {
      const points = (drawn.get(province.id) ?? []).flat()
      const onEdge = points.filter(
        ([x, y]) => x === 0 || x === MAP_WIDTH || y === 0 || y === MAP_HEIGHT,
      ).length

      expect(
        onEdge / points.length,
        `${province.id}: ${onEdge} von ${points.length} Punkten liegen genau auf der ` +
          `Leinwandkante — das ist eine zusammengefaltete Kueste, keine geklippte`,
      ).toBeLessThan(0.1)
    }
  })

  it('nennt die Leinwand so gross, wie die Karte selbst sagt', () => {
    // If these ever drift apart, every check above measures against the wrong rectangle.
    expect(world.width).toBe(MAP_WIDTH)
    expect(world.height).toBe(MAP_HEIGHT)
  })
})
