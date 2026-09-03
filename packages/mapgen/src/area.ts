import { EARTH_RADIUS_KM } from './project.ts'

/**
 * Areas on the sphere (T-M9-02a).
 *
 * The flat answer is not usable here: a degree square in Greenland covers a fraction
 * of what one covers in Kenya, so a planar sum would rank the Arctic as the largest
 * place on the map and hand its provinces the resources to match.
 */

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

/**
 * A position in GeoJSON is a list of numbers, not a pair: an elevation may follow the
 * longitude and latitude. Typing it as a two-tuple made every shape read from a file
 * need a cast, which is the sign of a wrong type rather than of careful code.
 */
export type Position = readonly number[]
export type Ring = readonly Position[]

/** Area enclosed by one ring, in square kilometres. Sign is discarded. */
export function ringAreaKm2(ring: Ring): number {
  if (ring.length < 3) return 0

  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const here = ring[i]!
    const next = ring[(i + 1) % ring.length]!
    const lon1 = here[0] ?? 0
    const lat1 = here[1] ?? 0
    const lon2 = next[0] ?? 0
    const lat2 = next[1] ?? 0
    sum += toRadians(lon2 - lon1) * (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)))
  }
  return Math.abs((sum * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2)
}

export type PolygonShape = { type: 'Polygon'; coordinates: Ring[] }
export type MultiPolygonShape = { type: 'MultiPolygon'; coordinates: Ring[][] }
export type Shape = PolygonShape | MultiPolygonShape

/** Area of a whole shape, holes subtracted. */
export function shapeAreaKm2(shape: Shape): number {
  const polygons = shape.type === 'MultiPolygon' ? shape.coordinates : [shape.coordinates]

  let total = 0
  for (const polygon of polygons) {
    // The first ring is the outline; the rest are holes cut out of it.
    polygon.forEach((ring, index) => {
      const area = ringAreaKm2(ring)
      total += index === 0 ? area : -area
    })
  }
  return total
}

/**
 * A single point standing for where a shape sits, taken from its largest ring.
 * Averaging every ring would put France's centre in the Atlantic, halfway to
 * French Guiana.
 */
export function shapeCentre(shape: Shape): { lon: number; lat: number } {
  const polygons = shape.type === 'MultiPolygon' ? shape.coordinates : [shape.coordinates]

  let best: Ring | null = null
  let bestArea = -1
  for (const polygon of polygons) {
    const ring = polygon[0]
    if (!ring) continue
    const area = ringAreaKm2(ring)
    if (area > bestArea) {
      bestArea = area
      best = ring
    }
  }
  if (!best || best.length === 0) return { lon: 0, lat: 0 }

  let lon = 0
  let lat = 0
  for (const point of best) {
    lon += point[0] ?? 0
    lat += point[1] ?? 0
  }
  return { lon: lon / best.length, lat: lat / best.length }
}
