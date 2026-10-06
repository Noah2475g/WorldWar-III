import { emit } from '../events/emit'
import type { ContractCloseReason } from '../events/types'
import type { PhaseContext } from '../phases/index'
import { relationKey } from '../state/create'
import {
  RESOURCE_KEYS,
  type DeliveryContract,
  type GameState,
  type PlayerId,
  type ResourceKey,
  type TradeOffer,
} from '../state/types'
import { registerCommand } from './registry'
import { fail, ok, type CancelContractCommand } from './types'

/**
 * Liefervertraege (Liefervertrag B1, D1 bis D6, P1 bis P7).
 *
 * Eine Annahme mit `schedule` ist Lieferung 1 (der bestehende Treuhandpfad in `tradeOffer.ts`)
 * und legt hier den Vertrag fuer die uebrigen Lieferungen an. Jede weitere Lieferung bucht beide
 * Seiten im selben Tick um — ohne Treuhand, ohne Teillieferung, ohne Schulden (D3). Je Lieferung
 * gibt es kein Ereignis (P6); nur das Ende meldet `CONTRACT_CLOSED`.
 */

/** Der Vertrag mit dieser Kennung, an dem `playerId` beteiligt ist — sonst wie ein fehlender (D4, Muster `partyTradeOffer`). */
export function partyContract(state: GameState, playerId: PlayerId, contractId: unknown): DeliveryContract | undefined {
  if (typeof contractId !== 'string') return undefined
  const contract = state.diplomacy.contracts.find((entry) => entry.id === contractId)
  return contract && (contract.from === playerId || contract.to === playerId) ? contract : undefined
}

/** Die laufenden Vertraege einer Macht (P3): Eintraege mit `from` oder `to` gleich `playerId`. */
export function activeContractCount(state: GameState, playerId: PlayerId): number {
  return state.diplomacy.contracts.filter((contract) => contract.from === playerId || contract.to === playerId).length
}

/** Kopie in der Reihenfolge von RESOURCE_KEYS — der Zustand haelt nie eine Referenz auf das Angebot. */
function copyAmounts(resources: Partial<Record<ResourceKey, number>>): Partial<Record<ResourceKey, number>> {
  const out: Partial<Record<ResourceKey, number>> = {}
  for (const key of RESOURCE_KEYS) {
    const amount = resources[key]
    if (amount !== undefined) out[key] = amount
  }
  return out
}

/**
 * Legt den Vertrag zu einem angenommenen Angebot mit `schedule` an (D2). Aufruf am Ende von
 * `ACCEPT_TRADE.apply`: Lieferung 1 ist dann schon gebucht, es bleiben `deliveries - 1`.
 */
export function createContract(draft: GameState, offer: TradeOffer, ctx: PhaseContext): void {
  const schedule = offer.schedule
  if (!schedule) return
  // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
  const intervalTicks = schedule.intervalDays * ctx.rules.constants.ticksPerDay
  draft.diplomacy.contracts = [
    ...draft.diplomacy.contracts,
    {
      id: `c${draft.nextIds.contract++}`,
      from: offer.from,
      to: offer.to,
      give: copyAmounts(offer.give.resources),
      want: copyAmounts(offer.want.resources),
      intervalTicks,
      remaining: schedule.deliveries - 1,
      nextDueTick: draft.tick + intervalTicks,
      createdTick: draft.tick,
    },
  ]
}

/** Beendet genau diesen Vertrag und meldet es beiden Parteien (P5). */
export function closeContract(
  draft: GameState,
  contract: DeliveryContract,
  reason: ContractCloseReason,
  closedBy: PlayerId | null,
  ctx: PhaseContext,
): void {
  draft.diplomacy.contracts = draft.diplomacy.contracts.filter((entry) => entry.id !== contract.id)
  emit(ctx.events, draft.tick, 'CONTRACT_CLOSED', {
    contractId: contract.id,
    playerId: contract.from,
    targetPlayerId: contract.to,
    reason,
    closedBy,
    audience: [contract.from, contract.to],
  })
}

/** Hat die Seite die volle Menge? Ohne Eintrag (Macht fehlt) nie. */
function canCover(draft: GameState, playerId: PlayerId, amounts: Partial<Record<ResourceKey, number>>): boolean {
  const player = draft.players[playerId]
  if (!player) return false
  for (const key of RESOURCE_KEYS) {
    const amount = amounts[key]
    if (amount !== undefined && player.resources[key] < amount) return false
  }
  return true
}

/**
 * Direkt nach `settleTradeOffers` (D3), in Array-Reihenfolge. Rangfolge je Vertrag:
 * ausgeschieden `invalid` > Krieg oder laufende Kriegserklaerung `war` > faellig: beide Seiten
 * voll, sonst `unpaid` (erst beide pruefen, dann buchen). `remaining` 0 → `completed`.
 */
export function settleContracts(draft: GameState, ctx: PhaseContext): void {
  if (draft.diplomacy.contracts.length === 0) return
  for (const contract of [...draft.diplomacy.contracts]) {
    const from = draft.players[contract.from]
    const to = draft.players[contract.to]
    if (!from || !to || !from.alive || !to.alive) {
      closeContract(draft, contract, 'invalid', null, ctx)
      continue
    }
    const relation = draft.diplomacy.relations[relationKey(contract.from, contract.to)]
    if (relation && (relation.state === 'war' || relation.warEffectiveAtTick !== null)) {
      closeContract(draft, contract, 'war', null, ctx)
      continue
    }
    if (draft.tick < contract.nextDueTick) continue

    if (!canCover(draft, contract.from, contract.give)) {
      closeContract(draft, contract, 'unpaid', contract.from, ctx)
      continue
    }
    if (!canCover(draft, contract.to, contract.want)) {
      closeContract(draft, contract, 'unpaid', contract.to, ctx)
      continue
    }
    for (const key of RESOURCE_KEYS) {
      const give = contract.give[key]
      const want = contract.want[key]
      if (give !== undefined) {
        from.resources[key] -= give
        to.resources[key] += give
      }
      if (want !== undefined) {
        to.resources[key] -= want
        from.resources[key] += want
      }
    }
    // `contract` ist der Eintrag im Entwurf (die Liste ist eine flache Kopie): direkt fortschreiben.
    contract.remaining -= 1
    contract.nextDueTick += contract.intervalTicks
    if (contract.remaining <= 0) closeContract(draft, contract, 'completed', null, ctx)
  }
}

registerCommand<CancelContractCommand>('CANCEL_CONTRACT', {
  check: (state, command) => {
    if (!partyContract(state, command.playerId, command.contractId)) return fail('INVALID_TARGET', { reason: 'kein Vertrag' })
    return ok
  },
  apply: (draft, command, ctx) => {
    const contract = partyContract(draft, command.playerId, command.contractId)!
    closeContract(draft, contract, 'cancelled', command.playerId, ctx)
  },
})
