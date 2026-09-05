import { quotFixed } from '@worldwar/shared'
import type { Command, PlayerId } from '@worldwar/core'
import type { AiContext, Explanation } from './types'

/**
 * Diplomatic decisions (R-DIP-03, T-M7-04).
 *
 * The rules are deliberately legible rather than clever: accept peace when the war is
 * going badly, do not open a second front you cannot hold, and stay out of wars that
 * are not yours. A player should be able to predict roughly what an opponent will do —
 * unpredictability is not the same thing as difficulty.
 */

/** How many wars this AI is currently in. */
export function activeWars(context: AiContext): PlayerId[] {
  return Object.entries(context.view.relations)
    .filter(([, relation]) => relation.state === 'war')
    .map(([id]) => id)
}

/** Relative standing: our score against theirs, 1000 means equal. */
function standing(context: AiContext, other: PlayerId): number {
  const own = Math.max(1, context.view.self.score)
  const theirs = Math.max(1, context.view.others.find((entry) => entry.id === other)?.score ?? 1)
  return quotFixed(own, theirs)
}

export function diplomacyCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const commands: Command[] = []
  const playerId = context.view.playerId
  const wars = activeWars(context)

  // 1. Answer standing offers first.
  for (const [other, relation] of Object.entries(context.view.relations)) {
    if (relation.state !== 'war') continue

    const ratio = standing(context, other)
    if (ratio < 900) {
      // Losing: take the way out. Angenommen wird nur, was auch angeboten wurde
      // (T-M14-12, Befund 41): vorher warf die KI acceptPeace ins Blaue, weil die Sicht
      // die eingehenden Angebote gar nicht fuehrte — 99 % dieser Befehle wurden
      // abgelehnt, und zwischen zwei KI-Maechten konnte ein Krieg strukturell fast nie
      // enden, weil beide anboten und keine das Angebot der anderen sah.
      const liegtVor = context.view.incomingOffers.some(
        (offer) => offer.from === other && offer.kind === 'peace',
      )
      if (liegtVor) {
        commands.push({ type: 'DIPLOMACY', playerId, targetPlayerId: other, action: 'acceptPeace' })
      } else {
        commands.push({ type: 'DIPLOMACY', playerId, targetPlayerId: other, action: 'offerPeace' })
      }
      explanations.push({
        action: `Sucht Frieden mit ${other}`,
        reason: `unterlegen (Verhältnis ${ratio})`,
        score: 850,
        alternative: { action: 'weiterkämpfen', score: 200 },
      })
    }
  }

  // 2. Do not start what cannot be finished.
  if (wars.length >= context.difficulty.maxFronts) {
    explanations.push({
      action: 'Keine neue Kriegserklärung',
      reason: `bereits ${wars.length} Krieg(e), Grenze ${context.difficulty.maxFronts}`,
      score: 0,
    })
    return commands
  }

  // 3. Declare war on a neighbour that is clearly weaker — and only then.
  const neighbours = new Set<PlayerId>()
  for (const province of context.view.provinces) {
    if (province.owner !== playerId) continue
    for (const id of province.neighbors) {
      const owner = context.view.provinces.find((entry) => entry.id === id)?.owner
      if (owner && owner !== playerId) neighbours.add(owner)
    }
  }

  for (const other of [...neighbours].sort()) {
    const relation = context.view.relations[other]
    if (!relation || relation.state !== 'peace') continue

    const ratio = standing(context, other)
    // Boldness threshold falls with difficulty: a hard AI picks fights sooner.
    const threshold = context.difficulty.maxFronts >= 3 ? 1200 : 1600
    if (ratio < threshold) continue

    commands.push({ type: 'DIPLOMACY', playerId, targetPlayerId: other, action: 'declareWar' })
    explanations.push({
      action: `Erklärt ${other} den Krieg`,
      reason: `deutlich überlegen (Verhältnis ${ratio})`,
      score: 700,
      alternative: { action: 'Frieden halten', score: 400 },
    })
    break
  }

  return commands
}
