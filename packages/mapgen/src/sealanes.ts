import { distanceKm } from './project.ts'
import type { Ring, Shape } from './area.ts'

/**
 * Sea lanes between coastal provinces (T-M9-02c, R-MAP-01/R-UNIT-06).
 *
 * Two rules decide whether a lane is real. It must not cross land — a route from Spain
 * to Italy that runs over France is not a sea route, it is a mistake nobody sees until
 * a fleet sails through the Alps. And it must be measured across the date line the
 * short way: Kamchatka and Alaska are 90 km apart, not 20 000.
 *
 * The strategically decisive lanes are curated by hand (`world-sealinks.csv`) because
 * what makes Hormuz matter is not its width. What is derived here is the rest: every
 * coastal province needs a way out to sea, or half the map cannot be reached by ship.
 */

export interface CoastalProvince {
  id: string
  centre: { lon: number; lat: number }
  shape: Shape
}

export interface SeaLane {
  from: string
  to: string
  distanceKm: number
}

export interface DeriveOptions {
  /** Lanes longer than this are not routes but ocean crossings; those are curated. */
  maxDistanceKm?: number
  /** How many lanes a province may gain. Enough to have options, not a spider's web. */
  perProvince?: number
  /**
   * Pairs that already have a *sea* lane between them, curated by hand.
   *
   * Distinct from `alreadyLinked`, which also holds land borders — and the difference
   * is the point. The second pass may well put a sea lane beside a land border, since
   * a fleet cannot sail a land border. What it must not do is lay a second lane beside
   * one somebody drew on purpose.
   */
  curatedPairs?: ReadonlySet<string>
}

/**
 * Longitude difference the short way round. Straight subtraction makes two provinces
 * either side of the date line look half a world apart, which is how a sea lane ends
 * up drawn across the entire map.
 */
export function shortestLonDelta(from: number, to: number): number {
  let delta = to - from
  while (delta > 180) delta -= 360
  while (delta < -180) delta += 360
  return delta
}

/** Point along the great-circle-ish path, taking the short way across the date line. */
export function interpolate(
  from: { lon: number; lat: number },
  to: { lon: number; lat: number },
  t: number,
): { lon: number; lat: number } {
  const lon = from.lon + shortestLonDelta(from.lon, to.lon) * t
  return {
    lon: lon > 180 ? lon - 360 : lon < -180 ? lon + 360 : lon,
    lat: from.lat + (to.lat - from.lat) * t,
  }
}

/**
 * Ray casting, with the date line handled by measuring every ring point relative to
 * the test point rather than in absolute longitude.
 *
 * That trick has a limit, and a test found it: a ring spanning the date line, measured
 * from a point on the far side of the planet, unfolds into one that appears to wrap
 * the whole globe — and swallows the point. So a ring that comes out more than half
 * the world wide relative to the point is simply too far away to contain it.
 */
export function pointInRing(point: { lon: number; lat: number }, ring: Ring): boolean {
  let inside = false
  let low = Infinity
  let high = -Infinity

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = shortestLonDelta(point.lon, ring[i]![0] ?? 0)
    const yi = (ring[i]![1] ?? 0) - point.lat
    const xj = shortestLonDelta(point.lon, ring[j]![0] ?? 0)
    const yj = (ring[j]![1] ?? 0) - point.lat

    if (xi < low) low = xi
    if (xi > high) high = xi

    if (yi > 0 !== yj > 0 && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) inside = !inside
  }

  if (high - low > 180) return false
  return inside
}

/** True when the point falls inside the shape, holes subtracted. */
export function pointInShape(point: { lon: number; lat: number }, shape: Shape): boolean {
  const polygons = shape.type === 'MultiPolygon' ? shape.coordinates : [shape.coordinates]
  for (const polygon of polygons) {
    const outer = polygon[0]
    if (!outer || !pointInRing(point, outer)) continue
    const inHole = polygon.slice(1).some((hole) => pointInRing(point, hole))
    if (!inHole) return true
  }
  return false
}

/**
 * Derives the lanes that keep every coastal province reachable by sea.
 *
 * `alreadyLinked` holds what is settled already — land borders and the curated lanes —
 * so this only fills gaps rather than duplicating decisions someone made deliberately.
 */
export function deriveSeaLanes(
  coastal: readonly CoastalProvince[],
  alreadyLinked: ReadonlySet<string>,
  options: DeriveOptions = {},
): SeaLane[] {
  const maxDistance = options.maxDistanceKm ?? 1200
  const perProvince = options.perProvince ?? 2
  const curatedPairs = options.curatedPairs ?? new Set<string>()
  const withSeaAccess = new Set<string>()
  for (const pair of curatedPairs) {
    const [a, b] = pair.split('|')
    if (a) withSeaAccess.add(a)
    if (b) withSeaAccess.add(b)
  }

  const byId = new Map(coastal.map((p) => [p.id, p]))
  const lanes = new Map<string, SeaLane>()
  const linkKey = (a: string, b: string): string => [a, b].sort((x, y) => x.localeCompare(y, 'en')).join('|')

  for (const province of [...coastal].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    const candidates = coastal
      .filter((other) => other.id !== province.id)
      .filter((other) => !alreadyLinked.has(linkKey(province.id, other.id)))
      .map((other) => ({ other, km: distanceKm(province.centre, other.centre) }))
      .filter((entry) => entry.km <= maxDistance)
      .sort((a, b) => a.km - b.km || a.other.id.localeCompare(b.other.id, 'en'))

    let taken = 0
    for (const { other, km } of candidates) {
      if (taken >= perProvince) break
      const key = linkKey(province.id, other.id)
      if (lanes.has(key)) {
        taken++
        continue
      }
      if (crossesLand(province, other, byId)) continue
      lanes.set(key, { from: province.id, to: other.id, distanceKm: Math.round(km) })
      taken++
    }
  }

  // Second pass: whoever still has no sea lane gets one to the nearest coast that can
  // be reached without crossing land, however far away that is.
  //
  // The first pass skips pairs that are already connected, and for a stretch of coast
  // where every neighbour is also a land neighbour — Benin and Togo, the West African
  // coast, the Siberian Arctic — that leaves the province with no way out to sea at
  // all. A land border is not a sea route: an army can walk it, a fleet cannot sail it.
  const hasLane = (id: string): boolean =>
    withSeaAccess.has(id) || [...lanes.values()].some((lane) => lane.from === id || lane.to === id)

  for (const province of [...coastal].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
    if (hasLane(province.id)) continue

    const nearest = coastal
      .filter((other) => other.id !== province.id)
      .map((other) => ({ other, km: distanceKm(province.centre, other.centre) }))
      .sort((a, b) => a.km - b.km || a.other.id.localeCompare(b.other.id, 'en'))

    for (const { other, km } of nearest) {
      const key = linkKey(province.id, other.id)
      if (lanes.has(key) || curatedPairs.has(key)) break
      if (crossesLand(province, other, byId)) continue
      lanes.set(key, { from: province.id, to: other.id, distanceKm: Math.round(km) })
      break
    }
  }

  return [...lanes.values()].sort(
    (a, b) => a.from.localeCompare(b.from, 'en') || a.to.localeCompare(b.to, 'en'),
  )
}

/**
 * Does the straight route between two provinces pass over a third?
 *
 * Sampled rather than computed exactly: an exact intersection test against a hundred
 * thousand points of coastline costs far more than it is worth here, and a lane that
 * clips a headland is not a mistake worth chasing — one that sails over Germany is.
 */
function crossesLand(
  from: CoastalProvince,
  to: CoastalProvince,
  byId: ReadonlyMap<string, CoastalProvince>,
): boolean {
  const SAMPLES = 8
  for (let i = 1; i < SAMPLES; i++) {
    const point = interpolate(from.centre, to.centre, i / SAMPLES)
    for (const other of byId.values()) {
      if (other.id === from.id || other.id === to.id) continue
      if (pointInShape(point, other.shape)) return true
    }
  }
  return false
}
