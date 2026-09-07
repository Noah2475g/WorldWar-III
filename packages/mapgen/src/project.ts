/**
 * Geometry for the map pipeline (T-M9-01, R-MAP-04).
 *
 * Two jobs that must not be confused, which is why they live side by side here with
 * the difference spelled out: `project` turns the globe into a picture, `distanceKm`
 * measures the globe itself. The game charges movement in kilometres — if it charged
 * screen distance instead, a march across northern Russia would cost twice what the
 * same march costs at the equator, purely because Mercator stretches the north.
 */

export interface LonLat {
  /** Degrees east of Greenwich, -180 to 180. */
  lon: number
  /** Degrees north of the equator, -90 to 90. */
  lat: number
}

/** Picture coordinates, both in 0..1 with the origin at the top left. */
export interface Point {
  x: number
  y: number
}

/**
 * Mercator sends the poles to infinity, so latitude is clamped where the projection
 * becomes square (the usual web-map limit). Nothing of interest lives beyond it.
 */
export const LAT_LIMIT = 85.05112877980659

/** Mean earth radius, the figure the haversine formula assumes. */
export const EARTH_RADIUS_KM = 6371.0088

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180
const toDegrees = (radians: number): number => (radians * 180) / Math.PI

const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value

/** Globe to picture. Web Mercator, normalised to the unit square. */
export function project({ lon, lat }: LonLat): Point {
  const clamped = clamp(lat, -LAT_LIMIT, LAT_LIMIT)
  const x = (lon + 180) / 360
  const sin = Math.sin(toRadians(clamped))
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)
  return { x, y: clamp(y, 0, 1) }
}

/** Picture back to globe. Exact inverse of `project` within the clamped band. */
export function unproject({ x, y }: Point): LonLat {
  const lon = x * 360 - 180
  const lat = toDegrees(2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2)
  return { lon, lat }
}

/**
 * Great-circle distance in kilometres (haversine). Independent of the projection —
 * this is what the game measures, and it is why crossing the date line costs what it
 * looks like on a globe rather than a trip across the whole picture.
 */
export function distanceKm(from: LonLat, to: LonLat): number {
  const dLat = toRadians(to.lat - from.lat)
  const dLon = toRadians(to.lon - from.lon)
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Area-weighted centre of a ring, used as a province's anchor for distances. */
export function centroid(ring: readonly LonLat[]): LonLat {
  if (ring.length === 0) throw new RangeError('Ein leerer Ring hat keinen Schwerpunkt.')

  let twiceArea = 0
  let lon = 0
  let lat = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    const cross = a.lon * b.lat - b.lon * a.lat
    twiceArea += cross
    lon += (a.lon + b.lon) * cross
    lat += (a.lat + b.lat) * cross
  }

  // A degenerate ring (all points collinear) has no area; fall back to the mean.
  if (twiceArea === 0) {
    const mean = ring.reduce((sum, p) => ({ lon: sum.lon + p.lon, lat: sum.lat + p.lat }), {
      lon: 0,
      lat: 0,
    })
    return { lon: mean.lon / ring.length, lat: mean.lat / ring.length }
  }

  return { lon: lon / (3 * twiceArea), lat: lat / (3 * twiceArea) }
}

// ------------------------------------------------------------------ the canvas

/**
 * From the globe to the game's canvas (T-M19-01).
 *
 * This lived in `scripts/build-map.mjs` until 2026-09-07, and that was the reason the
 * map could be wrong without anything noticing: a guard that wants to check the drawn
 * map against its source has to project the source the same way, and the only way to
 * do that from a test was to copy these six lines. Two tables of the truth is exactly
 * the fault this project has already paid for twice — so the generator and the guard
 * now read from here, and neither owns it.
 */

/** Canvas size in pixels. The core stores it as `MapData.width`/`height`. */
export const MAP_WIDTH = 4000
export const MAP_HEIGHT = 2400

/**
 * The latitude band the canvas shows. Cut at 78° N and 58° S: further north there is
 * only ice, further south only Antarctica, and Mercator spends most of the picture on
 * both if it is allowed to.
 */
export const MAP_LAT_TOP = 78
export const MAP_LAT_BOTTOM = -58

const TOP = project({ lon: 0, lat: MAP_LAT_TOP }).y
const BOTTOM = project({ lon: 0, lat: MAP_LAT_BOTTOM }).y

/** Longitude to a whole pixel column. */
export const toMapX = (lon: number): number => Math.round(project({ lon, lat: 0 }).x * MAP_WIDTH)

/** Latitude to a whole pixel row, within the band above. */
export const toMapY = (lat: number): number =>
  Math.round(((project({ lon: 0, lat }).y - TOP) / (BOTTOM - TOP)) * MAP_HEIGHT)

/** A point on the canvas, as the core stores it in a province outline. */
export type MapPoint = readonly [number, number]

/**
 * The outer rings of a GeoJSON shape — one for a Polygon, one per part for a
 * MultiPolygon. Holes (every ring after the first of a part) are dropped: the game
 * fills a province in one colour, and a hole would have to be cut from a fill that
 * something else has already painted.
 */
export function outerRings(shape: {
  type: string
  coordinates: unknown
}): ReadonlyArray<ReadonlyArray<readonly number[]>> {
  const coordinates = shape.coordinates as number[][][] | number[][][][]
  return shape.type === 'MultiPolygon'
    ? (coordinates as number[][][][]).map((part) => part[0] ?? [])
    : [(coordinates as number[][][])[0] ?? []]
}

/** Shoelace area of a ring already in pixels. Sign discarded. */
export function ringAreaPx2(ring: ReadonlyArray<MapPoint>): number {
  if (ring.length < 3) return 0

  let twice = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    twice += b[0] * a[1] - a[0] * b[1]
  }
  return Math.abs(twice) / 2
}

/**
 * Every ring of a shape that actually paints something, in canvas pixels.
 *
 * Rings with no area left are dropped, and that threshold is not a taste: after
 * rounding to whole pixels 1228 of the world's 3393 outer rings enclose exactly zero
 * area — they are a line or a point, and a fill over them covers nothing. Dropping
 * them costs 0,000 % of the land and saves 4934 points (measured 2026-09-07).
 *
 * What this function must **not** do is pick one ring. The generator did that until
 * T-M19-02, taking the one with the most points, and so drew Alaska's fjord coast in
 * place of the western United States — 130 of 237 provinces lost land that way. A
 * province may be in more than one piece, because a power may be.
 */
export function drawableRings(shape: {
  type: string
  coordinates: unknown
}): ReadonlyArray<ReadonlyArray<MapPoint>> {
  return outerRings(shape)
    .map((ring) => ring.map((point): MapPoint => [toMapX(point[0] ?? 0), toMapY(point[1] ?? 0)]))
    .map((ring) => clipRing(ring))
    .filter((ring) => ringAreaPx2(ring) > 0)
}

/** Ray casting on canvas pixels. Mirrors the interface's `pointInPolygon`. */
function pointInRing(point: MapPoint, ring: ReadonlyArray<MapPoint>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    if (a[1] > point[1] !== b[1] > point[1]) {
      if (point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
    }
  }
  return inside
}

/**
 * A point that is certainly *inside* the province, for the army marker and the label.
 *
 * `shapeCentre` averages the boundary points of the largest ring, and for a coast as
 * folded as Norway's that average is at sea: nine provinces carried an anchor outside
 * their own land on 2026-09-07, among them Sweden, Greece, Croatia, Vietnam and
 * Thailand. The marker then floats in the water next to the country it belongs to.
 *
 * The answer is the midpoint of the longest horizontal chord of the largest ring. It
 * is inside by construction — a chord between two crossings of the outline lies in the
 * shape — it is deterministic, and it needs no iteration to converge.
 */
export function anchorOf(rings: ReadonlyArray<ReadonlyArray<MapPoint>>): MapPoint | null {
  let best: ReadonlyArray<MapPoint> | null = null
  let bestArea = -1
  for (const ring of rings) {
    const area = ringAreaPx2(ring)
    if (area > bestArea) {
      bestArea = area
      best = ring
    }
  }
  if (!best || best.length < 3) return null

  let minY = Infinity
  let maxY = -Infinity
  for (const [, y] of best) {
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  // Half-integer rows, so a scan line never runs exactly along a horizontal edge —
  // there the crossings come in the wrong parity and the chord would be nonsense.
  const ROWS = 128
  let widest = 0
  let anchor: MapPoint | null = null

  for (let row = 0; row < ROWS; row++) {
    const y = minY + ((maxY - minY) * (row + 0.5)) / ROWS
    const crossings: number[] = []
    for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
      const a = best[i]!
      const b = best[j]!
      if (a[1] > y !== b[1] > y) {
        crossings.push(((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      }
    }
    crossings.sort((p, q) => p - q)

    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const width = crossings[i + 1]! - crossings[i]!
      if (width <= widest) continue
      const candidate: MapPoint = [
        Math.round((crossings[i]! + crossings[i + 1]!) / 2),
        Math.round(y),
      ]
      // Rounding to whole pixels can push the midpoint of a very thin chord back out,
      // so the candidate is only taken once it has been checked.
      if (!pointInRing(candidate, best)) continue
      widest = width
      anchor = candidate
    }
  }
  return anchor
}

/**
 * The anchor a province should carry: its own centre when that already lies on its
 * land, and the chord midpoint when it does not. Keeping the centre where it works
 * means the repair touches only the provinces that were wrong.
 */
export function anchorFor(
  centre: MapPoint,
  rings: ReadonlyArray<ReadonlyArray<MapPoint>>,
): MapPoint {
  if (rings.some((ring) => pointInRing(centre, ring))) return centre
  return anchorOf(rings) ?? centre
}

/**
 * Clips a ring to the canvas rectangle (Sutherland–Hodgman, T-M19-03).
 *
 * The 78° cut decides which strip of the world the canvas shows, but until T-M19-03
 * nothing ever clipped against it: Greenland reached 436 pixels above the top edge, and
 * once every ring was drawn the arctic islands of Canada, Norway and Russia joined it —
 * 4087 of 97 463 points off the picture.
 *
 * The obvious repair is the wrong one. `y = Math.max(0, y)` folds the whole north coast
 * onto a single straight line at the top edge, which looks like a rendering fault rather
 * than like a map. Sutherland–Hodgman inserts the crossing points instead, so the
 * coastline runs to the edge, along it, and back — which is what a cut-off coast looks
 * like.
 *
 * The alternative was measured and rejected: moving the cut north to 83,7° fits
 * everything in, but it shrinks the scale from 11,96 to 10,00 pixels per degree — the
 * whole world 16 % smaller so that 4 % of it, all of it arctic islands, can be seen.
 */
export function clipRing(
  ring: ReadonlyArray<MapPoint>,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): ReadonlyArray<MapPoint> {
  // One pass per edge, each keeping what is on the inside and cutting what crosses.
  const edges: ReadonlyArray<[(p: MapPoint) => boolean, (a: MapPoint, b: MapPoint) => MapPoint]> = [
    [(p) => p[0] >= 0, (a, b) => atX(a, b, 0)],
    [(p) => p[0] <= width, (a, b) => atX(a, b, width)],
    [(p) => p[1] >= 0, (a, b) => atY(a, b, 0)],
    [(p) => p[1] <= height, (a, b) => atY(a, b, height)],
  ]

  let out: MapPoint[] = ring.map((p) => p)
  for (const [inside, crossing] of edges) {
    const input = out
    out = []
    for (let i = 0, j = input.length - 1; i < input.length; j = i++) {
      const current = input[i]!
      const previous = input[j]!
      const currentIn = inside(current)
      const previousIn = inside(previous)

      if (currentIn) {
        if (!previousIn) out.push(crossing(previous, current))
        out.push(current)
      } else if (previousIn) {
        out.push(crossing(previous, current))
      }
    }
    if (out.length === 0) return []
  }
  return out
}

const atX = (a: MapPoint, b: MapPoint, x: number): MapPoint => [
  x,
  Math.round(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])),
]

const atY = (a: MapPoint, b: MapPoint, y: number): MapPoint => [
  Math.round(a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1])),
  y,
]
