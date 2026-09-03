import { emit } from '../events/emit'
import { relationKey } from '../state/create'
import type { GameState, PlayerId } from '../state/types'
import { registerCommand } from './registry'
import { fail, ok, type DiplomacyCommand } from './types'

/**
 * Diplomacy (R-DIP-01/02, T-M6-01).
 *
 * A declaration of war takes effect after a delay — long enough that the victim can
 * react, short enough to still be a threat. Attacking without one is possible, and
 * costs standing: the alternative would be a rule that simply forbids the interesting
 * move.
 */

export function findRelation(state: GameState, a: PlayerId, b: PlayerId) {
  return state.diplomacy.relations[relationKey(a, b)]
}

/** Offers waiting for an answer, so acceptance is a real second step. */
export function pendingOffer(state: GameState, from: PlayerId, to: PlayerId, kind: 'peace' | 'alliance') {
  return state.diplomacy.offers.find(
    (offer) => offer.from === from && offer.to === to && offer.kind === kind,
  )
}

registerCommand<DiplomacyCommand>('DIPLOMACY', {
  check: (state: GameState, command) => {
    if (command.playerId === command.targetPlayerId) return fail('INVALID_TARGET', { reason: 'sich selbst' })

    const target = state.players[command.targetPlayerId]
    if (!target) return fail('UNKNOWN_PLAYER', { playerId: command.targetPlayerId })
    if (!target.alive) return fail('PLAYER_ELIMINATED', { playerId: command.targetPlayerId })

    const relation = findRelation(state, command.playerId, command.targetPlayerId)
    if (!relation) return fail('UNKNOWN_PLAYER', { playerId: command.targetPlayerId })

    switch (command.action) {
      case 'declareWar':
        if (relation.state === 'war') return fail('INVALID_TARGET', { reason: 'bereits im Krieg' })
        if (relation.state === 'truce') return fail('ON_COOLDOWN', { reason: 'Waffenstillstand' })
        return ok
      case 'offerPeace':
        if (relation.state !== 'war') return fail('AT_WAR_REQUIRED', {})
        return ok
      case 'acceptPeace':
        if (!pendingOffer(state, command.targetPlayerId, command.playerId, 'peace')) {
          return fail('INVALID_TARGET', { reason: 'kein Angebot' })
        }
        return ok
      case 'offerAlliance':
        if (relation.state !== 'peace') return fail('INVALID_TARGET', { reason: 'nicht im Frieden' })
        return ok
      case 'acceptAlliance':
        if (!pendingOffer(state, command.targetPlayerId, command.playerId, 'alliance')) {
          return fail('INVALID_TARGET', { reason: 'kein Angebot' })
        }
        return ok
      case 'breakAlliance':
        if (relation.state !== 'alliance') return fail('INVALID_TARGET', { reason: 'kein Bündnis' })
        return ok
      case 'grantRightOfWay':
      case 'shareMap':
        if (relation.state === 'war') return fail('INVALID_TARGET', { reason: 'im Krieg' })
        return ok
    }
  },

  apply: (draft, command, ctx) => {
    const relation = findRelation(draft, command.playerId, command.targetPlayerId)!
    const both = [command.playerId, command.targetPlayerId]

    switch (command.action) {
      case 'declareWar': {
        relation.warEffectiveAtTick = draft.tick + ctx.rules.constants.warDeclarationDelayTicks
        emit(ctx.events, draft.tick, 'WAR_DECLARED', {
          playerId: command.playerId,
          targetPlayerId: command.targetPlayerId,
          effectiveAtTick: relation.warEffectiveAtTick,
          withoutDeclaration: false,
          audience: both,
        })
        break
      }
      case 'offerPeace':
      case 'offerAlliance': {
        const kind = command.action === 'offerPeace' ? 'peace' : 'alliance'
        draft.diplomacy.offers = [
          ...draft.diplomacy.offers.filter(
            (offer) => !(offer.from === command.playerId && offer.to === command.targetPlayerId && offer.kind === kind),
          ),
          { from: command.playerId, to: command.targetPlayerId, kind, tick: draft.tick },
        ]
        break
      }
      case 'acceptPeace': {
        relation.state = 'truce'
        relation.sinceTick = draft.tick
        relation.warEffectiveAtTick = null
        draft.diplomacy.offers = draft.diplomacy.offers.filter((offer) => offer.kind !== 'peace' || offer.to !== command.playerId)
        emit(ctx.events, draft.tick, 'DIPLOMACY_CHANGED', {
          playerId: command.playerId,
          targetPlayerId: command.targetPlayerId,
          newState: 'truce',
          audience: both,
        })
        break
      }
      case 'acceptAlliance': {
        relation.state = 'alliance'
        relation.sinceTick = draft.tick
        relation.sharedMap = true
        relation.rightOfWay = true
        draft.diplomacy.offers = draft.diplomacy.offers.filter((offer) => offer.kind !== 'alliance' || offer.to !== command.playerId)
        emit(ctx.events, draft.tick, 'DIPLOMACY_CHANGED', {
          playerId: command.playerId,
          targetPlayerId: command.targetPlayerId,
          newState: 'alliance',
          audience: both,
        })
        break
      }
      case 'breakAlliance': {
        relation.state = 'peace'
        relation.sinceTick = draft.tick
        relation.sharedMap = false
        relation.rightOfWay = false
        // Breaking a pact costs standing, even without a shot fired.
        draft.players[command.playerId]!.reputation -= ctx.rules.constants.surpriseAttackReputationLoss
        emit(ctx.events, draft.tick, 'DIPLOMACY_CHANGED', {
          playerId: command.playerId,
          targetPlayerId: command.targetPlayerId,
          newState: 'peace',
          audience: both,
        })
        break
      }
      case 'grantRightOfWay':
        relation.rightOfWay = true
        break
      case 'shareMap':
        relation.sharedMap = true
        break
    }
  },
})
