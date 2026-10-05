import type { Command, ResourceKey } from '@worldwar/core'
import { explainRelationship, relationship } from './relationship'
import type { AiContext, Explanation } from './types'

/**
 * Liefervertraege der KI (Liefervertrag B2, D7/P9): die KI kuendigt, nie sie schlaegt vor.
 *
 * Ein Vertrag gilt als faellig, wenn `view.tick < nextDueTick <= view.tick + window` — die
 * Kuendigung landet so vor der Lieferung. Grund in dieser Reihenfolge: Beziehung unter der
 * Kriegsschwelle, ein Gabe-Rohstoff knapp, Gegenwert unter 1000 ‰. Ohne Kuendigung keine
 * Erklaerung; ohne eigene Vertraege eine leere Rueckgabe.
 */

function bundleValue(resources: Partial<Record<ResourceKey, number>>, prices: Record<ResourceKey, number>): number {
  let total = 0
  for (const [key, amount] of Object.entries(resources)) {
    if (!amount) continue
    total += amount * (prices[key as ResourceKey] ?? 0)
  }
  return total
}

export function contractCommands(
  context: AiContext,
  explanations: Explanation[],
  _pending: readonly Command[],
  window: number,
): Command[] {
  const { view, difficulty, rules } = context
  const me = view.playerId
  const commands: Command[] = []

  for (const c of view.contracts) {
    if (!(view.tick < c.nextDueTick && c.nextDueTick <= view.tick + window)) continue
    const other = me === c.from ? c.to : c.from
    const myGive = me === c.from ? c.give : c.want
    const myGet = me === c.from ? c.want : c.give

    let reason: string | null = null
    const wert = relationship(view, other, view.self.grievances, rules)
    if (wert.value < difficulty.warThreshold) {
      reason = `${explainRelationship(wert)} unter der Kriegsschwelle ${difficulty.warThreshold}`
    } else {
      for (const key of Object.keys(myGive) as ResourceKey[]) {
        if (!myGive[key]) continue
        if (view.self.shortages.includes(key)) {
          reason = `${key} ist selbst knapp`
          break
        }
      }
      if (!reason) {
        const given = bundleValue(myGive, view.marketPrices)
        const received = bundleValue(myGet, view.marketPrices)
        if (given > 0 && received * 1000 < given * 1000) {
          const ratio = Math.trunc((received * 1000) / given)
          reason = `Gegenwert ${ratio} ‰ unter 1000 ‰`
        }
      }
    }
    if (!reason) continue

    commands.push({ type: 'CANCEL_CONTRACT', playerId: me, contractId: c.id })
    explanations.push({
      action: `Kündigt Vertrag ${c.id} mit ${other}`,
      reason,
      score: 600,
      alternative: { action: 'weiterliefern', score: 200 },
    })
  }
  return commands
}
