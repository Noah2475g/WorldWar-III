import type { NeighbourEdge } from './adjacency.ts'

/**
 * Closing the holes a curated map leaves behind (T-M9-02c).
 *
 * A territory refused as too small does not stop existing: Liechtenstein, Luxembourg,
 * Andorra and eighteen others sit between provinces that were kept, and leaving them
 * out puts white patches on the map. Worse, the hole makes its neighbours look
 * coastal — the border to Liechtenstein is a stretch of outline shared with nobody,
 * which is exactly the shape of a coast. That is how Switzerland and Austria came out
 * as seafaring nations.
 *
 * So a hole with land neighbours is handed to one of them: the one it shares the
 * longest border with. Not the nearest centre, which for a sliver along a mountain
 * range is close to arbitrary, and not the largest neighbour, which would swallow
 * every hole into whichever big country happens to be next door.
 *
 * A refused *island* has no land neighbour and stays out. It is not a hole in
 * anything — the sea is already there.
 */

export interface Absorption {
  /** The refused territory. */
  id: string
  /** The province taking it over. */
  into: string
  borderKm: number
}

export function planAbsorptions(
  holes: readonly string[],
  edges: readonly NeighbourEdge[],
  kept: ReadonlySet<string>,
): Absorption[] {
  const byHole = new Map<string, Absorption>()

  for (const edge of edges) {
    for (const [hole, other] of [
      [edge.from, edge.to],
      [edge.to, edge.from],
    ] as const) {
      if (!holes.includes(hole) || !kept.has(other)) continue
      const held = byHole.get(hole)
      // Ties break on the id, so the same map always produces the same answer.
      const better =
        !held ||
        edge.borderKm > held.borderKm ||
        (edge.borderKm === held.borderKm && other.localeCompare(held.into, 'en') < 0)
      if (better) byHole.set(hole, { id: hole, into: other, borderKm: edge.borderKm })
    }
  }

  return [...byHole.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'))
}
