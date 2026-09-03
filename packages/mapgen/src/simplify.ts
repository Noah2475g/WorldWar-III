import type { LonLat } from './project'

/**
 * Line simplification for the map pipeline (T-M9-01).
 *
 * Douglas–Peucker, on degrees rather than projected pixels: the tolerance is a
 * geographic figure, so the same setting means the same thing in Norway as in Kenya.
 * Simplifying after projection would thin the tropics and leave the poles crowded.
 *
 * Order matters elsewhere too — provinces are merged first and simplified afterwards
 * (T-M9-02a), because simplifying the parts separately leaves gaps where they used to
 * meet.
 */

/** Perpendicular distance from `point` to the segment `a`–`b`, in degrees. */
function distanceToSegment(point: LonLat, a: LonLat, b: LonLat): number {
  const dx = b.lon - a.lon
  const dy = b.lat - a.lat

  if (dx === 0 && dy === 0) return Math.hypot(point.lon - a.lon, point.lat - a.lat)

  const t = ((point.lon - a.lon) * dx + (point.lat - a.lat) * dy) / (dx * dx + dy * dy)
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t
  return Math.hypot(point.lon - (a.lon + clamped * dx), point.lat - (a.lat + clamped * dy))
}

/** Thins an open line, keeping both ends and every point beyond `toleranceDegrees`. */
export function simplify(points: readonly LonLat[], toleranceDegrees: number): LonLat[] {
  if (points.length <= 2) return [...points]

  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1

  // Iterative rather than recursive: a coastline with tens of thousands of points
  // would otherwise overflow the stack on the one ring that needs it least.
  const pending: [number, number][] = [[0, points.length - 1]]
  while (pending.length > 0) {
    const [first, last] = pending.pop()!
    let farthest = -1
    let farthestDistance = toleranceDegrees

    for (let i = first + 1; i < last; i++) {
      const distance = distanceToSegment(points[i]!, points[first]!, points[last]!)
      if (distance > farthestDistance) {
        farthest = i
        farthestDistance = distance
      }
    }

    if (farthest !== -1) {
      keep[farthest] = 1
      pending.push([first, farthest], [farthest, last])
    }
  }

  return points.filter((_, index) => keep[index] === 1)
}

/**
 * Thins a closed ring. Two things a plain line simplification would get wrong: the
 * ring has to stay closed, and it has to stay an area — a province thinned down to
 * two points is a line, which would vanish from the map and take its borders with it.
 */
export function simplifyRing(ring: readonly LonLat[], toleranceDegrees: number): LonLat[] {
  if (ring.length <= 4) return [...ring]

  let tolerance = toleranceDegrees
  for (;;) {
    const simplified = simplify(ring, tolerance)
    if (simplified.length >= 4) return closed(simplified)
    if (tolerance <= 0) break
    // Too coarse for this shape: try again at half, rather than dropping the province.
    tolerance /= 2
    if (tolerance < 1e-9) break
  }

  return [...ring]
}

/** Re-closes a ring whose last point was thinned away. */
function closed(simplified: LonLat[]): LonLat[] {
  const first = simplified[0]!
  const last = simplified[simplified.length - 1]!
  if (first.lon === last.lon && first.lat === last.lat) return simplified
  return [...simplified, { lon: first.lon, lat: first.lat }]
}
