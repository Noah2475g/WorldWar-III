import { emit } from '../events/emit'
import type { TradeOfferCloseReason } from '../events/types'
import type { PhaseContext } from '../phases/index'
import { relationKey } from '../state/create'
import { RESOURCE_KEYS, type GameState, type PlayerId, type ResourceKey, type TradeBundle, type TradeOffer } from '../state/types'
import { registerCommand } from './registry'
import {
  fail,
  ok,
  type AcceptTradeCommand,
  type CommandResult,
  type DeclineTradeCommand,
  type OfferTradeCommand,
  type WithdrawTradeCommand,
} from './types'

/**
 * Handelsangebote mit Treuhand (R-DIP-05, T-M17-05, D29.2 bis D29.5).
 *
 * `give.resources` IST die Treuhand: sie verlaesst den Bestand des Anbieters im selben
 * `applyCommand`, in dem das Angebot entsteht. `want` zahlt erst der Annehmende, im selben Tick
 * wie die Annahme. Jede Schliessung trifft genau **eine** `offerId` (B4) — anders als
 * `acceptPeace`/`acceptAlliance`, die alle Angebote ihrer Art an den Annehmenden loeschen.
 *
 * Geschlossen wird an genau zwei Stellen: in den Befehlen selbst (Annahme, Ablehnung, Rueckzug)
 * und in `settleTradeOffers` (Schritt 4 der Diplomatiephase, D29.3: ausgeschiedene Macht, Krieg,
 * abgelaufene Frist). Provinzen im Handel bringt T-M17-06.
 */

/** Das Angebot mit dieser Kennung, oder `undefined`. Eine Kennung aus dem Netz ist nicht vertrauenswuerdig. */
function findTradeOffer(state: GameState, offerId: unknown): TradeOffer | undefined {
  if (typeof offerId !== 'string') return undefined
  return state.diplomacy.tradeOffers.find((offer) => offer.id === offerId)
}

/** Form eines Buendels: Objekt mit Objekt `resources` und Array `provinces` (D28: Befehle kommen von einer zweiten Maschine). */
function isBundle(value: unknown): value is TradeBundle {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const resources = record['resources']
  return typeof resources === 'object' && resources !== null && !Array.isArray(resources) && Array.isArray(record['provinces'])
}

/** Prueft die Mengen einer Seite: nur bekannte Rohstoffe, nur ganze positive Zahlen. */
function amountProblem(resources: Record<string, unknown>): CommandResult {
  for (const [key, amount] of Object.entries(resources)) {
    if (!RESOURCE_KEYS.includes(key as ResourceKey)) return fail('INVALID_TARGET', { reason: 'unbekannter Rohstoff' })
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
      return fail('INVALID_TARGET', { reason: 'ungültige Menge', resource: key })
    }
  }
  return ok
}

/** Kopie in der Reihenfolge von RESOURCE_KEYS — der Zustand haelt nie eine Referenz auf den Befehl. */
function copyResources(resources: TradeBundle['resources']): TradeBundle['resources'] {
  const out: TradeBundle['resources'] = {}
  for (const key of RESOURCE_KEYS) {
    const amount = resources[key]
    if (amount !== undefined) out[key] = amount
  }
  return out
}

/** Beziehungszustand, der Handel verbietet (R-DIP-05/AK3), oder `null`. */
function warProblem(state: GameState, a: PlayerId, b: PlayerId): CommandResult | null {
  const relation = state.diplomacy.relations[relationKey(a, b)]
  if (!relation) return fail('UNKNOWN_PLAYER', { playerId: b })
  if (relation.state === 'war') return fail('INVALID_TARGET', { reason: 'im Krieg' })
  if (relation.warEffectiveAtTick !== null) return fail('INVALID_TARGET', { reason: 'Kriegserklärung läuft' })
  return null
}

/**
 * Schliesst genau dieses eine Angebot (B4). Ausser bei `accepted` geht die Treuhand an den
 * Anbieter zurueck — auch an einen ausgeschiedenen, damit Bestaende plus Treuhand erhalten bleiben.
 */
export function closeTradeOffer(draft: GameState, offer: TradeOffer, reason: TradeOfferCloseReason, ctx: PhaseContext): void {
  if (reason !== 'accepted') {
    const from = draft.players[offer.from]!
    for (const key of RESOURCE_KEYS) {
      const amount = offer.give.resources[key]
      if (amount !== undefined) from.resources[key] += amount
    }
  }
  draft.diplomacy.tradeOffers = draft.diplomacy.tradeOffers.filter((entry) => entry.id !== offer.id)
  emit(ctx.events, draft.tick, 'TRADE_OFFER_CLOSED', {
    offerId: offer.id,
    playerId: offer.from,
    targetPlayerId: offer.to,
    reason,
    audience: [offer.from, offer.to],
  })
}

/**
 * Schritt 4 der Diplomatiephase (D29.3), NACH den Ueberfaellen. Ein Durchlauf, ein Grund je
 * Angebot, in dieser Rangfolge: eine Macht ausgeschieden (`invalid`) vor Krieg (`war`) vor Frist
 * (`expired`). Deshalb geht die Treuhand bei „Ueberfall und Verfall im selben Tick" genau einmal
 * zurueck, und der Grund ist der Krieg. In Array-Reihenfolge (R-ARCH-01), ohne Zufall.
 */
export function settleTradeOffers(draft: GameState, ctx: PhaseContext): void {
  if (draft.diplomacy.tradeOffers.length === 0) return
  for (const offer of [...draft.diplomacy.tradeOffers]) {
    const relation = draft.diplomacy.relations[relationKey(offer.from, offer.to)]
    const reason: TradeOfferCloseReason | null =
      !draft.players[offer.from]?.alive || !draft.players[offer.to]?.alive
        ? 'invalid'
        : relation?.state === 'war'
          ? 'war'
          : draft.tick >= offer.expiresAtTick
            ? 'expired'
            : null
    if (reason !== null) closeTradeOffer(draft, offer, reason, ctx)
  }
}

registerCommand<OfferTradeCommand>('OFFER_TRADE', {
  check: (state, command, ctx) => {
    if (command.playerId === command.targetPlayerId) return fail('INVALID_TARGET', { reason: 'sich selbst' })

    const target = state.players[command.targetPlayerId]
    if (!target) return fail('UNKNOWN_PLAYER', { playerId: command.targetPlayerId })
    if (!target.alive) return fail('PLAYER_ELIMINATED', { playerId: command.targetPlayerId })

    if (!isBundle(command.give) || !isBundle(command.want)) return fail('INVALID_TARGET', { reason: 'ungültiges Angebot' })

    const warIssue = warProblem(state, command.playerId, command.targetPlayerId)
    if (warIssue !== null) return warIssue

    // Diese eine Zeile ersetzt T-M17-06 (Provinzhandel).
    if (command.give.provinces.length > 0 || command.want.provinces.length > 0) {
      return fail('INVALID_TARGET', { reason: 'Provinzen erst mit dem Provinzhandel' })
    }

    const giveProblem = amountProblem(command.give.resources as Record<string, unknown>)
    if (!giveProblem.ok) return giveProblem
    const wantProblem = amountProblem(command.want.resources as Record<string, unknown>)
    if (!wantProblem.ok) return wantProblem

    if (Object.keys(command.give.resources).length === 0) return fail('INVALID_TARGET', { reason: 'leeres Angebot' })

    for (const key of Object.keys(command.give.resources)) {
      if (key in command.want.resources) return fail('INVALID_TARGET', { reason: 'gleicher Rohstoff auf beiden Seiten' })
    }

    const C = ctx.rules.constants
    for (const [key, amount] of [...Object.entries(command.give.resources), ...Object.entries(command.want.resources)]) {
      const limit = key === 'money' ? C.tradeMaxMoney : C.tradeMaxResource
      if ((amount as number) > limit) return fail('INVALID_TARGET', { reason: 'über der Höchstmenge', resource: key })
    }

    const open = state.diplomacy.tradeOffers.filter((o) => o.from === command.playerId).length
    if (open >= C.maxOpenTradeOffers) return fail('QUEUE_FULL', { max: C.maxOpenTradeOffers })

    const player = state.players[command.playerId]!
    for (const key of RESOURCE_KEYS) {
      const amount = command.give.resources[key]
      if (amount !== undefined && player.resources[key] < amount) return fail('INSUFFICIENT_RESOURCES', { resource: key })
    }

    return ok
  },
  apply: (draft, command, ctx) => {
    const player = draft.players[command.playerId]!
    const give = copyResources(command.give.resources)
    for (const key of RESOURCE_KEYS) {
      const amount = give[key]
      if (amount !== undefined) player.resources[key] -= amount
    }
    // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
    const lifetime = ctx.rules.constants.tradeOfferLifetimeDays * ctx.rules.constants.ticksPerDay
    draft.diplomacy.tradeOffers = [
      ...draft.diplomacy.tradeOffers,
      {
        id: `t${draft.nextIds.offer++}`,
        from: command.playerId,
        to: command.targetPlayerId,
        give: { resources: give, provinces: [] },
        want: { resources: copyResources(command.want.resources), provinces: [] },
        createdTick: draft.tick,
        expiresAtTick: draft.tick + lifetime,
      },
    ]
    // Kein Ereignis (D29.5): ein Angebot meldet sich ueber die Sicht, nicht per Ereignis.
  },
})

registerCommand<AcceptTradeCommand>('ACCEPT_TRADE', {
  check: (state, command) => {
    const offer = findTradeOffer(state, command.offerId)
    if (!offer) return fail('INVALID_TARGET', { reason: 'kein Angebot' })
    if (offer.to !== command.playerId) return fail('NOT_OWNER', { offerId: offer.id })
    if (!state.players[offer.from]?.alive) return fail('INVALID_TARGET', { reason: 'Anbieter ausgeschieden' })

    const warIssue = warProblem(state, offer.from, offer.to)
    if (warIssue !== null) return warIssue

    const player = state.players[command.playerId]!
    for (const key of RESOURCE_KEYS) {
      const amount = offer.want.resources[key]
      if (amount !== undefined && player.resources[key] < amount) return fail('INSUFFICIENT_RESOURCES', { resource: key })
    }

    return ok
  },
  apply: (draft, command, ctx) => {
    const offer = findTradeOffer(draft, command.offerId)!
    const from = draft.players[offer.from]!
    const to = draft.players[offer.to]!
    for (const key of RESOURCE_KEYS) {
      const give = offer.give.resources[key]
      const want = offer.want.resources[key]
      if (give !== undefined) to.resources[key] += give
      if (want !== undefined) {
        to.resources[key] -= want
        from.resources[key] += want
      }
    }
    closeTradeOffer(draft, offer, 'accepted', ctx)
    // Die Welt erfaehrt, DASS gehandelt wird (R-DIP-05/AK4) — kein Mengenfeld: `describeEvent`
    // uebernimmt jedes flache Feld.
    emit(ctx.events, draft.tick, 'TRADE_AGREED', {
      playerId: offer.from,
      targetPlayerId: offer.to,
      concerns: [offer.from, offer.to],
    })
  },
})

registerCommand<DeclineTradeCommand>('DECLINE_TRADE', {
  check: (state, command) => {
    const offer = findTradeOffer(state, command.offerId)
    if (!offer) return fail('INVALID_TARGET', { reason: 'kein Angebot' })
    if (offer.to !== command.playerId) return fail('NOT_OWNER', { offerId: offer.id })
    return ok
  },
  apply: (draft, command, ctx) => {
    closeTradeOffer(draft, findTradeOffer(draft, command.offerId)!, 'declined', ctx)
  },
})

registerCommand<WithdrawTradeCommand>('WITHDRAW_TRADE', {
  check: (state, command) => {
    const offer = findTradeOffer(state, command.offerId)
    if (!offer) return fail('INVALID_TARGET', { reason: 'kein Angebot' })
    if (offer.from !== command.playerId) return fail('NOT_OWNER', { offerId: offer.id })
    return ok
  },
  apply: (draft, command, ctx) => {
    closeTradeOffer(draft, findTradeOffer(draft, command.offerId)!, 'withdrawn', ctx)
  },
})
