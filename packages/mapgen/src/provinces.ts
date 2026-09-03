import { topology } from 'topojson-server'
import { merge } from 'topojson-client'
import { presimplify, simplify } from 'topojson-simplify'
import type { Position, Ring, Shape } from './area.ts'

/**
 * Merging the parts of a province into one shape (T-M9-02a).
 *
 * The merge goes through a topology rather than through polygon arithmetic, and that
 * is the whole point. In a topology two units that share a border share the same *arc*
 * — one line, referenced twice. Dissolving them is then exact: the shared arc is
 * dropped and the outer arcs stay bit-for-bit where they were. Polygon union would
 * instead compare two lines that are merely equal to within floating point, and leave
 * hairline slivers between provinces that in truth touch — which the adjacency pass
 * (T-M9-02b) would read as "not neighbours".
 *
 * Order matters for the same reason: **merge first, simplify afterwards**. Simplifying
 * the parts first nudges their shared edges apart by a fraction of a degree each, and
 * the merge then has nothing exact left to cancel.
 */

export interface UnitShape {
  code: string
  provinceId: string
  geometry: Shape
}

export interface ProvinceShape {
  id: string
  geometry: Shape
  sourceUnits: string[]
}

export interface MergeOptions {
  /**
   * Visvalingam weight below which a point is dropped, in square degrees. Applied to
   * the topology, so a border is thinned once and both provinces along it keep the
   * same line — thinning each province separately pulls neighbours apart.
   */
  simplifyWeight?: number
}

export function mergeProvinces(
  units: readonly UnitShape[],
  options: MergeOptions = {},
): ProvinceShape[] {
  if (units.length === 0) return []

  const groups = new Map<string, UnitShape[]>()
  for (const unit of units) {
    const existing = groups.get(unit.provinceId)
    if (existing) existing.push(unit)
    else groups.set(unit.provinceId, [unit])
  }

  // One topology over *all* units, not one per province: that is what makes the arc
  // between two different provinces the same arc on both sides.
  const objects: Record<string, { type: string; coordinates: unknown }> = {}
  for (const unit of [...units].sort((a, b) => a.code.localeCompare(b.code, 'en'))) {
    objects[unit.code] = { type: unit.geometry.type, coordinates: unit.geometry.coordinates }
  }
  // The three packages describe the same topology with slightly different property
  // types; the one presimplify expects is the common denominator.
  let topo = topology(objects as Parameters<typeof topology>[0]) as Parameters<typeof presimplify>[0]
  if (options.simplifyWeight !== undefined && options.simplifyWeight > 0) {
    topo = simplify(presimplify(topo), options.simplifyWeight)
  }

  // Sorted by id, not by the order the units arrived in: the merged map is checked
  // in, and a file that reshuffles itself because an upstream sort changed produces
  // diffs nobody can review.
  const provinces: ProvinceShape[] = []
  for (const [id, members] of [...groups].sort((a, b) => a[0].localeCompare(b[0], 'en'))) {
    const geometries = members.map((unit) => topo.objects[unit.code]!)
    const merged = merge(topo, geometries as Parameters<typeof merge>[1])

    provinces.push({
      id,
      geometry: normalise(merged),
      sourceUnits: members.map((unit) => unit.code).sort((a, b) => a.localeCompare(b, 'en')),
    })
  }

  return provinces
}

/**
 * Brings a merged shape into a canonical form.
 *
 * Two things happen here, and both exist for the diff rather than for the geometry.
 * A province of one piece is unwrapped from MultiPolygon to Polygon, because that is
 * what it is. And every ring is rotated to start at its lowest point: merging the same
 * two squares in the other order produced the same rectangle starting at a different
 * corner, which as JSON is a different file. The map is checked in — a file that
 * reshuffles itself on every rebuild cannot be reviewed.
 */
function normalise(shape: { type: string; coordinates: unknown }): Shape {
  const polygons = (shape.coordinates as Ring[][]).map((polygon) => polygon.map(canonicalRing))
  const sorted = [...polygons].sort((a, b) => compare(a[0]?.[0], b[0]?.[0]))

  const single = sorted[0]
  if (shape.type === 'MultiPolygon' && sorted.length === 1 && single) {
    return { type: 'Polygon', coordinates: single }
  }
  return { type: 'MultiPolygon', coordinates: sorted }
}

/** Rotates a closed ring so it starts at its lowest point, by longitude then latitude. */
function canonicalRing(ring: Ring): Ring {
  if (ring.length < 3) return ring

  const closed =
    compare(ring[0], ring[ring.length - 1]) === 0 ? ring.slice(0, -1) : ring.slice()

  let start = 0
  for (let i = 1; i < closed.length; i++) {
    if (compare(closed[i], closed[start]) < 0) start = i
  }

  const rotated = [...closed.slice(start), ...closed.slice(0, start)]
  return [...rotated, rotated[0]!]
}

function compare(a: Position | undefined, b: Position | undefined): number {
  if (!a || !b) return 0
  return (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0)
}
