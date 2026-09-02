import type { Edge, MapData, ProvinceId } from '../state/types'

/**
 * Shortest paths across the province graph (R-UNIT-04).
 *
 * Two properties matter as much as correctness:
 *
 *  1. Determinism. When two routes cost the same, the choice must not depend on
 *     object iteration order — otherwise two identical games diverge (R-ARCH-01).
 *     Ties are broken by province id, which is stable and independent of insertion.
 *  2. Honest costs. The caller supplies the cost function, because what a route costs
 *     depends on the army walking it (design D6.4). The same function that plans the
 *     route is the one that later executes it, so the arrival time shown before the
 *     order and the arrival that happens cannot disagree (R-UNIT-04/AK1).
 */

export interface PathOptions {
  /** Whether sea edges may be used at all (needs transport capacity). */
  canUseSea?: boolean
  /** Veto for provinces the army may not enter — foreign territory, enemies, blockades. */
  canEnter?: (provinceId: ProvinceId) => boolean
  /** Cost of traversing one edge, in ticks. Must be a positive integer. */
  edgeCost?: (edge: Edge, from: ProvinceId, to: ProvinceId) => number
}

export interface PathResult {
  /** Waypoints excluding the start, including the destination. */
  path: ProvinceId[]
  /** Total cost in ticks. */
  cost: number
}

/** Default cost: distance alone, one tick per 100 km. Movement refines this in T-M4-02. */
export function defaultEdgeCost(edge: Edge): number {
  // eslint-disable-next-line no-restricted-syntax -- plain integer bookkeeping: fixed km -> ticks, no Fixed multiplication
  return Math.max(1, Math.ceil(edge.distanceKm / 100_000))
}

interface QueueEntry {
  id: ProvinceId
  cost: number
}

/** Binary heap ordered by (cost, id) so equal costs resolve the same way every run. */
class DeterministicQueue {
  private items: QueueEntry[] = []

  private better(a: QueueEntry, b: QueueEntry): boolean {
    if (a.cost !== b.cost) return a.cost < b.cost
    return a.id < b.id
  }

  push(entry: QueueEntry): void {
    this.items.push(entry)
    let index = this.items.length - 1
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (!this.better(this.items[index]!, this.items[parent]!)) break
      ;[this.items[index], this.items[parent]] = [this.items[parent]!, this.items[index]!]
      index = parent
    }
  }

  pop(): QueueEntry | undefined {
    const top = this.items[0]
    const last = this.items.pop()
    if (this.items.length > 0 && last) {
      this.items[0] = last
      let index = 0
      for (;;) {
        // eslint-disable-next-line no-restricted-syntax -- heap index arithmetic on plain integers, no Fixed values involved
        const left = index * 2 + 1
        const right = left + 1
        let best = index
        if (left < this.items.length && this.better(this.items[left]!, this.items[best]!)) best = left
        if (right < this.items.length && this.better(this.items[right]!, this.items[best]!)) best = right
        if (best === index) break
        ;[this.items[index], this.items[best]] = [this.items[best]!, this.items[index]!]
        index = best
      }
    }
    return top
  }

  get size(): number {
    return this.items.length
  }
}

/** Edges leaving a province, in a fixed order. */
export function edgesOf(map: MapData, provinceId: ProvinceId): Edge[] {
  const indices = map.edgesByProvince[provinceId] ?? []
  return indices.map((index) => map.edges[index]!).filter(Boolean)
}

/** Neighbours of a province, optionally restricted to land. */
export function neighborsOf(map: MapData, provinceId: ProvinceId, includeSea = true): ProvinceId[] {
  return edgesOf(map, provinceId)
    .filter((edge) => includeSea || edge.kind === 'land')
    .map((edge) => (edge.a === provinceId ? edge.b : edge.a))
    .sort()
}

/**
 * Cheapest route from `from` to `to`, or null when none exists under the given
 * restrictions — which is what the caller turns into a NO_PATH rejection.
 */
export function findPath(
  map: MapData,
  from: ProvinceId,
  to: ProvinceId,
  options: PathOptions = {},
): PathResult | null {
  const known = new Set(map.provinces.map((province) => province.id))
  if (!known.has(from) || !known.has(to)) return null
  if (from === to) return { path: [], cost: 0 }

  const canUseSea = options.canUseSea ?? true
  const canEnter = options.canEnter ?? (() => true)
  const edgeCost = options.edgeCost ?? defaultEdgeCost

  const best = new Map<ProvinceId, number>([[from, 0]])
  const cameFrom = new Map<ProvinceId, ProvinceId>()
  const settled = new Set<ProvinceId>()

  const queue = new DeterministicQueue()
  queue.push({ id: from, cost: 0 })

  while (queue.size > 0) {
    const current = queue.pop()!
    if (settled.has(current.id)) continue
    settled.add(current.id)

    if (current.id === to) break

    for (const edge of edgesOf(map, current.id)) {
      if (edge.kind === 'sea' && !canUseSea) continue

      const next = edge.a === current.id ? edge.b : edge.a
      if (settled.has(next)) continue
      // The destination itself is always enterable — attacking into a province is
      // exactly the case where `canEnter` would otherwise say no.
      if (next !== to && !canEnter(next)) continue

      const cost = current.cost + edgeCost(edge, current.id, next)
      const previous = best.get(next)
      // Strict improvement only: an equal cost must not overwrite, or the tie-break
      // would depend on visit order rather than on the id comparison in the queue.
      if (previous === undefined || cost < previous) {
        best.set(next, cost)
        cameFrom.set(next, current.id)
        queue.push({ id: next, cost })
      }
    }
  }

  if (!settled.has(to) || !best.has(to)) return null

  const path: ProvinceId[] = []
  let cursor: ProvinceId | undefined = to
  while (cursor !== undefined && cursor !== from) {
    path.unshift(cursor)
    cursor = cameFrom.get(cursor)
  }

  return { path, cost: best.get(to)! }
}

/** Every province reachable from `from` under the given restrictions. */
export function reachableFrom(map: MapData, from: ProvinceId, options: PathOptions = {}): Set<ProvinceId> {
  const canUseSea = options.canUseSea ?? true
  const canEnter = options.canEnter ?? (() => true)

  const seen = new Set<ProvinceId>([from])
  const queue: ProvinceId[] = [from]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of edgesOf(map, current)) {
      if (edge.kind === 'sea' && !canUseSea) continue
      const next = edge.a === current ? edge.b : edge.a
      if (seen.has(next) || !canEnter(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return seen
}
