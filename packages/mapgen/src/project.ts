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
