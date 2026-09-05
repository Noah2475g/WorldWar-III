import { ONE, clampFixed, mulChain, quotFixed, type Fixed } from '@worldwar/shared'
import type { ProvinceId, PublicView } from '@worldwar/core'
import type { AiContext, ProvinceValue } from './types'
import { threatMap } from './threat'

/**
 * Which province is worth taking (design D8).
 *
 * Every term is normalised to 0..1000 with a stated reference, so the weights in
 * `ai.json` are genuine priorities. Un-normalised terms were the review's main
 * objection: a distance measured in kilometres would simply drown out morale
 * measured in points, and no weight could fix it.
 */

/**
 * Welche Provinzen eine Landarmee von hier aus zu Fuss erreicht (T-M14-11).
 *
 * `hopDistance` zaehlt Seewege mit — als Mass fuer 'wie weit ist das weg' richtig, als
 * Antwort auf 'kann ich dort hinmarschieren' falsch. Die KI benutzte es fuer beides:
 * 3046 von 4464 Marschbefehlen endeten mit NO_PATH, und weil sie denselben unmoeglichen
 * Befehl in jedem Tick neu fasste, wiederholte sie ihn bis zum Partieende. Inselmaechte
 * standen die ganze Partie still.
 *
 * Der Seetransport bleibt moeglich — er ist nur kein Marschbefehl, sondern ein eigener
 * Vorgang, den die KI heute nicht beherrscht (M17, amphibische KI).
 */
export function landReachable(view: PublicView, from: ProvinceId, limit = 8): Set<ProvinceId> {
  const seen = new Set([from])
  let frontier = [from]

  for (let depth = 1; depth <= limit; depth++) {
    const next: ProvinceId[] = []
    for (const id of frontier) {
      const province = view.provinces.find((entry) => entry.id === id)
      if (!province) continue
      for (const neighbour of province.neighbors) {
        if (seen.has(neighbour)) continue
        seen.add(neighbour)
        next.push(neighbour)
      }
    }
    if (next.length === 0) break
    frontier = next
  }
  return seen
}

/** Straight-line-ish distance in provinces, capped. */
export function hopDistance(view: PublicView, from: ProvinceId, to: ProvinceId, limit = 8): number {
  if (from === to) return 0
  const seen = new Set([from])
  let frontier = [from]

  for (let depth = 1; depth <= limit; depth++) {
    const next: ProvinceId[] = []
    for (const id of frontier) {
      const province = view.provinces.find((entry) => entry.id === id)
      if (!province) continue
      for (const neighbour of [...province.neighbors, ...province.seaLinks]) {
        if (seen.has(neighbour)) continue
        if (neighbour === to) return depth
        seen.add(neighbour)
        next.push(neighbour)
      }
    }
    frontier = next
  }
  return limit + 1
}

/** Economic worth of a province, relative to the best one in sight. */
function economyScores(context: AiContext): Map<ProvinceId, Fixed> {
  const raw = new Map<ProvinceId, number>()
  let best = 1

  for (const province of context.view.provinces) {
    let value = province.kind === 'city' ? 400 : 200
    for (const [key, amount] of Object.entries(province.deposits ?? {})) {
      const weight = context.rules.ai.resourceWeights[key as keyof typeof context.rules.ai.resourceWeights] ?? 1000
      value += Math.trunc((amount! * weight) / 10_000)
    }
    raw.set(province.id, value)
    best = Math.max(best, value)
  }

  const scaled = new Map<ProvinceId, Fixed>()
  for (const [id, value] of raw) scaled.set(id, clampFixed(quotFixed(value, best), 0, ONE))
  return scaled
}

/** Rates every province the AI could move against. */
export function rateProvinces(context: AiContext, fromProvince: ProvinceId): ProvinceValue[] {
  const { view, difficulty } = context
  const economy = economyScores(context)
  const threat = threatMap(view, context.rules.ai.threatRange)

  const values: ProvinceValue[] = []

  // Ein Ziel, das keine Landarmee erreicht, ist kein Ziel (T-M14-11). Vorher standen
  // Provinzen jenseits des Meeres in der Liste, weil `hopDistance` Seewege mitzaehlt —
  // die KI befahl den Marsch, der Kern lehnte mit NO_PATH ab, und im naechsten Tick
  // befahl sie ihn wieder. 3046 von 4464 Marschbefehlen gingen so ins Leere.
  const erreichbar = landReachable(view, fromProvince)

  for (const province of view.provinces) {
    if (province.owner === view.playerId) continue
    if (!erreichbar.has(province.id)) continue
    // Only enemies and no-man's land are targets; neutrals stay off-limits while at peace.
    if (province.owner && view.relations[province.owner]?.state !== 'war') continue

    const distance = hopDistance(view, fromProvince, province.id)
    const distanceScore = clampFixed(quotFixed(9 - Math.min(distance, 8), 9), 0, ONE)

    // Defence: enemy strength standing there, relative to the strongest concentration.
    const defenders = view.armies
      .filter((army) => army.provinceId === province.id && army.owner !== view.playerId)
      .reduce((sum, army) => sum + army.strength, 0)
    const defenceScore = clampFixed(quotFixed(defenders, Math.max(1, threat.peak)), 0, ONE)

    // A province next to something we already hold is worth more than an island.
    const adjacentOwn = province.neighbors.filter(
      (id) => view.provinces.find((entry) => entry.id === id)?.owner === view.playerId,
    ).length
    const positionScore = clampFixed(quotFixed(Math.min(adjacentOwn, 3), 3), 0, ONE)

    // Weakness: what we remember of its morale, if anything.
    const weaknessScore = province.stale ? 500 : 300

    const total = clampFixed(
      mulChain([economy.get(province.id) ?? 0, difficulty.economy]) +
        mulChain([positionScore, difficulty.position]) -
        mulChain([defenceScore, difficulty.defence]) +
        mulChain([distanceScore, difficulty.distance]) +
        mulChain([weaknessScore, difficulty.weakness]),
      0,
      ONE,
    )

    values.push({
      id: province.id,
      economy: economy.get(province.id) ?? 0,
      position: positionScore,
      defence: defenceScore,
      distance: distanceScore,
      weakness: weaknessScore,
      total,
      owner: province.owner,
    })
  }

  // Sorted by value, ties broken by id so the choice never depends on iteration order.
  return values.sort((a, b) => (b.total !== a.total ? b.total - a.total : a.id < b.id ? -1 : 1))
}
