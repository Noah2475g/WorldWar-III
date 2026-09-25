import { emit } from '../events/emit'
import { grantsPassage, passageEndsAtTick, relationKey, setMapShared, setPassage } from '../state/create'
import type { DiplomaticOffer, GameState, PlayerId, Relation } from '../state/types'
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

/**
 * Durchmarsch in **beiden** Richtungen setzen — nur noch fuer das Buendnis und seinen Bruch.
 *
 * Ein Buendnis ist gegenseitig (D29.1): `acceptAlliance` setzt beide Richtungen beider Felder,
 * `breakAlliance` loescht sie. Alles andere setzt seit T-M17-04 genau **eine** Richtung
 * (`setPassage` in `state/create.ts`) — bis dahin tat es auch `grantRightOfWay`, und wer
 * gewaehrte, durfte damit selbst folgenlos ins Land des anderen (Befund B1).
 */
function setPassageBothWays(relation: Relation, value: boolean): void {
  relation.aGrantsPassage = value
  relation.bGrantsPassage = value
  relation.aPassageEndsAtTick = null
  relation.bPassageEndsAtTick = null
}

/** Kartenfreigabe in beiden Richtungen — aus demselben Grund wie `setPassageBothWays`. */
function setMapBothWays(relation: Relation, value: boolean): void {
  relation.aSharesMap = value
  relation.bSharesMap = value
}

/** Offers waiting for an answer, so acceptance is a real second step. */
export function pendingOffer(state: GameState, from: PlayerId, to: PlayerId, kind: DiplomaticOffer['kind']) {
  return state.diplomacy.offers.find(
    (offer) => offer.from === from && offer.to === to && offer.kind === kind,
  )
}

/** Nimmt **ein** Angebot vom Tisch — das von `from` an `to` dieser Art, sonst keines (B4). */
function dropOffer(state: GameState, from: PlayerId, to: PlayerId, kind: DiplomaticOffer['kind']): void {
  state.diplomacy.offers = state.diplomacy.offers.filter(
    (offer) => !(offer.from === from && offer.to === to && offer.kind === kind),
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
      // Der Antrag (R-DIP-08/AK2): ich bitte das Ziel, **mich** durch **sein** Land zu lassen.
      case 'requestRightOfWay':
        if (relation.state === 'war') return fail('INVALID_TARGET', { reason: 'im Krieg' })
        if (relation.warEffectiveAtTick !== null) return fail('INVALID_TARGET', { reason: 'Kriegserklärung läuft' })
        if (grantsPassage(state, command.targetPlayerId, command.playerId)) {
          // Waehrend einer laufenden Kuendigung ist das Recht noch da, aber schon auf dem Weg
          // hinaus (Nacharbeit kern, Pruefer-Befund: 'bereits gewährt' war hier irrefuehrend —
          // revokeRightOfWay nennt denselben Zustand richtig 'bereits gekündigt').
          if (passageEndsAtTick(state, command.targetPlayerId, command.playerId) !== null) {
            return fail('INVALID_TARGET', { reason: 'gekündigt' })
          }
          return fail('INVALID_TARGET', { reason: 'bereits gewährt' })
        }
        return ok
      // Die Annahme: das Ziel hat mich gebeten, ich lasse es durch.
      case 'acceptRightOfWay':
        if (!pendingOffer(state, command.targetPlayerId, command.playerId, 'rightOfWay')) {
          return fail('INVALID_TARGET', { reason: 'kein Angebot' })
        }
        // Ein Antrag, der den Kriegsausbruch ueberlebt hat, ist erledigt: im Krieg verweigert
        // schon `grantRightOfWay` jede Freigabe, und die Annahme ist nichts anderes.
        if (relation.state === 'war') return fail('INVALID_TARGET', { reason: 'im Krieg' })
        return ok
      // Die Kuendigung (R-DIP-08/AK3): nur, was ich gewaehrt habe, und nur einmal.
      case 'revokeRightOfWay':
        if (!grantsPassage(state, command.playerId, command.targetPlayerId)) {
          return fail('INVALID_TARGET', { reason: 'nicht gewährt' })
        }
        // Ein zweiter Widerruf wuerde die Frist nur verschieben — und damit dem Gast mehr Zeit
        // geben, als der erste versprochen hat.
        if (passageEndsAtTick(state, command.playerId, command.targetPlayerId) !== null) {
          return fail('INVALID_TARGET', { reason: 'bereits gekündigt' })
        }
        // Im Buendnis laesst das Buendnis selbst durch (`detectSurpriseAttacks`); ein Widerruf
        // aenderte dort nichts ausser der Anzeige — und die waere dann falsch.
        if (relation.state === 'alliance') return fail('INVALID_TARGET', { reason: 'im Bündnis' })
        return ok
    }
  },

  apply: (draft, command, ctx) => {
    const relation = findRelation(draft, command.playerId, command.targetPlayerId)!
    const both = [command.playerId, command.targetPlayerId]

    /** Das Recht `playerId → targetPlayerId` beginnt (wieder) unbefristet. */
    const grantPassage = (): void => {
      // Wer um das gebeten hat, was er gerade bekommt, muss nicht weiter warten.
      dropOffer(draft, command.targetPlayerId, command.playerId, 'rightOfWay')
      const unbefristet =
        grantsPassage(draft, command.playerId, command.targetPlayerId) &&
        passageEndsAtTick(draft, command.playerId, command.targetPlayerId) === null
      // Nichts geaendert, nichts zu erzaehlen: die alte KI schickte `grantRightOfWay` jeden
      // Tag (Befund B2), und alte Kommandologs tun es weiter.
      if (unbefristet) return
      setPassage(relation, command.playerId, command.targetPlayerId, true, null)
      emit(ctx.events, draft.tick, 'RIGHT_OF_WAY_CHANGED', {
        playerId: command.playerId,
        targetPlayerId: command.targetPlayerId,
        granted: true,
        effectiveAtTick: draft.tick,
        audience: both,
      })
    }

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
      case 'offerAlliance':
      case 'requestRightOfWay': {
        const kind = command.action === 'offerPeace' ? 'peace' : command.action === 'offerAlliance' ? 'alliance' : 'rightOfWay'
        // Ein wiederholtes Angebot ersetzt das alte und beginnt seine Frist neu.
        dropOffer(draft, command.playerId, command.targetPlayerId, kind)
        draft.diplomacy.offers = [
          ...draft.diplomacy.offers,
          { from: command.playerId, to: command.targetPlayerId, kind, tick: draft.tick },
        ]
        break
      }
      case 'acceptPeace': {
        relation.state = 'truce'
        relation.sinceTick = draft.tick
        relation.warEffectiveAtTick = null
        // Befund B4: nur das angenommene Angebot, nicht alle an mich.
        dropOffer(draft, command.targetPlayerId, command.playerId, 'peace')
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
        setMapBothWays(relation, true)
        setPassageBothWays(relation, true)
        // Befund B4: nur das angenommene Angebot, nicht alle an mich.
        dropOffer(draft, command.targetPlayerId, command.playerId, 'alliance')
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
        setMapBothWays(relation, false)
        setPassageBothWays(relation, false)
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
      // Beide setzen seit T-M17-04 nur die **eigene** Richtung (R-DIP-08/AK1). Ein
      // `grantRightOfWay` waehrend einer Kuendigung nimmt sie zurueck.
      case 'grantRightOfWay':
      case 'acceptRightOfWay':
        grantPassage()
        break
      case 'shareMap':
        setMapShared(relation, command.playerId, command.targetPlayerId, true)
        break
      case 'revokeRightOfWay': {
        const ends = draft.tick + ctx.rules.constants.rightOfWayNoticeTicks
        setPassage(relation, command.playerId, command.targetPlayerId, true, ends)
        emit(ctx.events, draft.tick, 'RIGHT_OF_WAY_CHANGED', {
          playerId: command.playerId,
          targetPlayerId: command.targetPlayerId,
          granted: false,
          effectiveAtTick: ends,
          audience: both,
        })
        break
      }
    }
  },
})
