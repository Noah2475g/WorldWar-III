import { ONE, clampFixed, quotFixed, type Fixed } from '@worldwar/shared'
import type { ProvinceId, PublicView } from '@worldwar/core'

/**
 * Threat map and force comparison (T-M7-02b).
 *
 * Without these two, "hold the front" and "break off a hopeless attack" cannot be
 * expressed at all — the AI would only ever see single provinces, never a situation.
 * Both return normalised values (0..1000) so the weights in `ai.json` stay meaningful.
 */

export interface ThreatMap {
  /** Province id -> pressure from hostile forces, 0..1000. */
  byProvince: Record<ProvinceId, Fixed>
  /** The strongest single threat seen, for scaling the display. */
  peak: Fixed
}

/** Distance in provinces, over land and sea, up to a limit. */
function distances(view: PublicView, from: ProvinceId, limit: number): Map<ProvinceId, number> {
  const result = new Map<ProvinceId, number>([[from, 0]])
  let frontier = [from]

  for (let depth = 1; depth <= limit; depth++) {
    const next: ProvinceId[] = []
    for (const id of frontier) {
      const province = view.provinces.find((entry) => entry.id === id)
      if (!province) continue
      for (const neighbour of [...province.neighbors, ...province.seaLinks]) {
        if (result.has(neighbour)) continue
        result.set(neighbour, depth)
        next.push(neighbour)
      }
    }
    frontier = next
  }
  return result
}

/**
 * How much hostile force is bearing on each province the player holds.
 *
 * Enemy strength counts fully when it stands in the province, and less the further
 * away it is — pressure is a matter of distance, not just presence.
 */
export function threatMap(view: PublicView, range: number): ThreatMap {
  const byProvince: Record<ProvinceId, Fixed> = {}
  let peak = 0

  const hostile = view.armies.filter((army) => {
    if (army.owner === view.playerId) return false
    return view.relations[army.owner]?.state === 'war'
  })

  for (const province of view.provinces) {
    if (province.owner !== view.playerId) continue

    const reach = distances(view, province.id, range)
    let pressure = 0
    for (const army of hostile) {
      const distance = reach.get(army.provinceId)
      if (distance === undefined) continue
      // Full weight at zero distance, falling to a quarter at the edge of the range.
      const falloff = quotFixed(range + 1 - distance, range + 1)
      pressure += Math.trunc((army.strength * falloff) / ONE)
    }

    byProvince[province.id] = pressure
    peak = Math.max(peak, pressure)
  }

  // Normalise against the strongest pressure so the term stays comparable.
  if (peak > 0) {
    for (const id of Object.keys(byProvince)) {
      byProvince[id] = clampFixed(quotFixed(byProvince[id]!, peak), 0, ONE)
    }
  }

  return { byProvince, peak }
}

export interface ForceComparison {
  own: Fixed
  enemy: Fixed
  /** Own strength relative to the enemy's, 0..1000 and beyond; 500 means half. */
  ratio: Fixed
  verdict: 'overwhelming' | 'favourable' | 'even' | 'risky' | 'hopeless'
}

/** Compares the forces at a place — the basis for attacking or breaking off. */
export function compareForces(view: PublicView, provinceId: ProvinceId, attackers: Fixed): ForceComparison {
  let enemy = 0
  for (const army of view.armies) {
    if (army.provinceId !== provinceId) continue
    if (army.owner === view.playerId) continue
    if (view.relations[army.owner]?.state !== 'war') continue
    enemy += army.strength
  }

  const ratio = enemy === 0 ? 4000 : quotFixed(attackers, enemy)
  const verdict =
    ratio >= 2500 ? 'overwhelming' : ratio >= 1400 ? 'favourable' : ratio >= 900 ? 'even' : ratio >= 600 ? 'risky' : 'hopeless'

  return { own: attackers, enemy, ratio, verdict }
}

/** Should this attack be pressed? Difficulty decides how much risk is acceptable. */
export function worthAttacking(comparison: ForceComparison, boldness: number): boolean {
  if (comparison.verdict === 'overwhelming' || comparison.verdict === 'favourable') return true
  if (comparison.verdict === 'even') return boldness >= 2
  if (comparison.verdict === 'risky') return boldness >= 3
  return false
}
