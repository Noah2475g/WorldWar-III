import type { Admin1Record } from './curation.ts'

/**
 * Cutting a country into provinces by where its parts lie (T-M9-00).
 *
 * Bands hold equal *numbers* of units, not equal spans of degrees. The difference
 * matters: Germany's sixteen states are spread unevenly, and a split by degrees would
 * put fourteen of them in one province and two in the other. Equal counts give
 * provinces of comparable weight, which is what a strategy map needs.
 *
 * The result is deterministic and independent of input order — units are sorted by
 * position first, with the unit code as the tie-break, so two units at the same point
 * always land the same way round.
 */

export interface Grid {
  /** Bands from south to north. */
  lat: number
  /** Bands from west to east, within each latitude band. */
  lon: number
}

export interface GeoGroup {
  /** Position in the grid, south-west first: 0 is the southernmost, westernmost cell. */
  index: number
  units: Admin1Record[]
}

export function splitGeographically(units: readonly Admin1Record[], grid: Grid): GeoGroup[] {
  if (units.length === 0) return []

  const latBands = bandsOf(units, grid.lat, (unit) => unit.lat ?? 0)
  const groups: GeoGroup[] = []

  for (const band of latBands) {
    for (const cell of bandsOf(band, grid.lon, (unit) => unit.lon ?? 0)) {
      groups.push({ index: groups.length, units: cell })
    }
  }

  return groups
}

/**
 * Splits into at most `count` bands of near-equal size, ordered by the given axis.
 * Fewer units than bands means fewer bands — an empty province would be a hole in the
 * map, and a province of one unit next to one of twenty is not a split worth making.
 */
function bandsOf(
  units: readonly Admin1Record[],
  count: number,
  axis: (unit: Admin1Record) => number,
): Admin1Record[][] {
  const wanted = Math.max(1, Math.min(count, units.length))
  if (wanted === 1) return [[...units]]

  const sorted = [...units].sort((a, b) => axis(a) - axis(b) || a.code.localeCompare(b.code, 'en'))
  const bands: Admin1Record[][] = []
  const size = sorted.length / wanted

  for (let i = 0; i < wanted; i++) {
    const from = Math.round(i * size)
    const to = Math.round((i + 1) * size)
    bands.push(sorted.slice(from, to))
  }

  return bands.filter((band) => band.length > 0)
}
