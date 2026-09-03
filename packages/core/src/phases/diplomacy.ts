import { emit } from '../events/emit'
import { relationKey } from '../state/create'
import type { GameState, PlayerId } from '../state/types'
import type { Phase, PhaseContext } from './index'

/**
 * Diplomatic state over time (R-DIP-02, design D3 phase 11).
 *
 * Declarations come into force, truces run out, and an attack launched without a
 * declaration is recorded as what it is. The delay is what makes a declaration a
 * decision rather than a formality.
 */

/** An army standing in someone's territory while not at war is an act of aggression. */
function detectSurpriseAttacks(draft: GameState, ctx: PhaseContext): void {
  for (const armyId of draft.armyOrder) {
    const army = draft.armies[armyId]
    if (!army) continue
    const province = draft.provinces[army.locationProvinceId]
    if (!province?.owner || province.owner === army.owner) continue

    const relation = draft.diplomacy.relations[relationKey(army.owner, province.owner)]
    if (!relation || relation.state === 'war') continue
    if (relation.rightOfWay || relation.state === 'alliance') continue

    // No declaration, but boots on foreign soil: war starts immediately and costs
    // standing. Forbidding the move outright would remove the interesting choice.
    relation.state = 'war'
    relation.sinceTick = draft.tick
    relation.warEffectiveAtTick = null
    draft.players[army.owner]!.reputation -= ctx.rules.constants.surpriseAttackReputationLoss

    emit(ctx.events, draft.tick, 'WAR_DECLARED', {
      playerId: army.owner,
      targetPlayerId: province.owner,
      effectiveAtTick: draft.tick,
      withoutDeclaration: true,
      audience: [army.owner, province.owner] as PlayerId[],
    })
  }
}

export const diplomacy: Phase = (draft: GameState, ctx: PhaseContext) => {
  for (const [key, relation] of Object.entries(draft.diplomacy.relations)) {
    // Declarations coming into force.
    if (relation.warEffectiveAtTick !== null && draft.tick >= relation.warEffectiveAtTick) {
      relation.state = 'war'
      relation.sinceTick = draft.tick
      relation.warEffectiveAtTick = null
      relation.rightOfWay = false
      relation.sharedMap = false

      const [a, b] = key.split('|') as [PlayerId, PlayerId]
      emit(ctx.events, draft.tick, 'DIPLOMACY_CHANGED', {
        playerId: a,
        targetPlayerId: b,
        newState: 'war',
        audience: [a, b],
      })
    }

    // Truces expire back into plain peace.
    if (relation.state === 'truce') {
      // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
      const duration = ctx.rules.constants.truceDurationDays * ctx.rules.constants.ticksPerDay
      if (draft.tick >= relation.sinceTick + duration) {
        relation.state = 'peace'
        relation.sinceTick = draft.tick
      }
    }
  }

  // Offers do not stay on the table forever.
  // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
  const offerLifetime = 3 * ctx.rules.constants.ticksPerDay
  draft.diplomacy.offers = draft.diplomacy.offers.filter((offer) => draft.tick - offer.tick < offerLifetime)

  detectSurpriseAttacks(draft, ctx)
}
