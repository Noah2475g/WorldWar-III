import { emit } from '../events/emit'
import type { TradeOfferCloseReason } from '../events/types'
import { atWar } from '../phases/combat'
import type { PhaseContext } from '../phases/index'
import { transferProvince } from '../phases/occupation'
import { relationKey } from '../state/create'
import {
  RESOURCE_KEYS,
  type GameState,
  type PlayerId,
  type ProvinceId,
  type ResourceKey,
  type TradeBundle,
  type TradeOffer,
} from '../state/types'
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
 * abgelaufene Frist). Provinzen wechseln bei der Annahme ueber `transferProvince` (T-M17-06); sie
 * liegen nicht in Treuhand.
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
 * Wie tief eine Provinzseite geprueft wird (R-DIP-04, T-M17-06).
 * `full`: alles, was der Abtretende selbst weiss — er ist der Befehlende oder seine Provinz wird
 *   gleich uebergeben. `public`: nur, was jeder weiss — Existenz und Besitz (Besitzwechsel stehen
 *   im Weltgeschehen). Hauptstadt und Armeen des ANDEREN verraet ein Angebot nie.
 */
type CessionDepth = 'full' | 'public'

/**
 * Warum `ceder` die Provinz nicht an `receiver` abtreten kann (R-DIP-09/AK1), oder `null`.
 * Pruefreihenfolge: Existenz, Besitz, Hauptstadt, umkaempft, eigene Armeen (darin oder auf dem
 * Weg hinein), Armeen einer dritten Macht darin. Die Armeen des Empfaengers stoeren nicht: sie
 * stehen danach im eigenen Land.
 */
function cessionProblem(
  state: GameState,
  provinceId: unknown,
  ceder: PlayerId,
  receiver: PlayerId,
  depth: CessionDepth,
): CommandResult | null {
  // `Object.hasOwn`: eine Kennung wie 'toString' traefe sonst den Prototyp.
  if (typeof provinceId !== 'string' || !Object.hasOwn(state.provinces, provinceId)) {
    return typeof provinceId === 'string' ? fail('PROVINCE_NOT_FOUND', { provinceId }) : fail('PROVINCE_NOT_FOUND')
  }
  const province = state.provinces[provinceId]!
  if (province.owner !== ceder) return fail('INVALID_TARGET', { reason: 'nicht im Besitz', provinceId })
  if (depth === 'public') return null

  if (state.players[ceder]?.capitalProvinceId === provinceId) return fail('INVALID_TARGET', { reason: 'Hauptstadt', provinceId })

  const armies = state.armyOrder.map((id) => state.armies[id]!)
  const present = armies.filter((army) => army.locationProvinceId === provinceId)
  if (present.some((army) => atWar(state, ceder, army.owner))) return fail('INVALID_TARGET', { reason: 'umkämpft', provinceId })
  // Auch auf dem Weg hinein: sie kaeme im Land des Empfaengers an — ein Ueberfall (dod T-M17-06).
  if (armies.some((army) => army.owner === ceder && (army.locationProvinceId === provinceId || army.path.includes(provinceId)))) {
    return fail('INVALID_TARGET', { reason: 'eigene Armeen', provinceId })
  }
  // Eine dritte Macht steht nur mit Recht des Abtretenden darin; das Recht geht nicht mit ueber.
  // Fremde Maersche prueft der Kern NICHT — ihr Ziel kennt der Abtretende nicht (E3, M17-D5).
  if (present.some((army) => army.owner !== ceder && army.owner !== receiver)) {
    return fail('INVALID_TARGET', { reason: 'fremde Armeen', provinceId })
  }
  return null
}

/** Eine Seite eines Buendels: erst doppelte Eintraege, dann jede Provinz in Listenreihenfolge. */
function provincesProblem(
  state: GameState,
  provinces: readonly unknown[],
  ceder: PlayerId,
  receiver: PlayerId,
  depth: CessionDepth,
): CommandResult | null {
  if (new Set(provinces).size !== provinces.length) return fail('INVALID_TARGET', { reason: 'doppelte Provinz' })
  for (const provinceId of provinces) {
    const problem = cessionProblem(state, provinceId, ceder, receiver, depth)
    if (problem !== null) return problem
  }
  return null
}

/**
 * Ist ein Angebot mit Provinzen nicht mehr abschliessbar (R-DIP-09/AK1)? Die gebende Seite voll —
 * ihr Anbieter hat sie auf den Tisch gelegt und haelt sie sauber, oder das Angebot faellt; die
 * verlangte nur oeffentlich, sonst verriete ein Verfall dem Anbieter Armeen und Hauptstadt des
 * Ziels (R-DIP-04). Ohne Provinzen: nie — und ohne einen Blick auf die Armeen.
 */
function provincesLapsed(state: GameState, offer: TradeOffer): boolean {
  if (offer.give.provinces.length === 0 && offer.want.provinces.length === 0) return false
  return (
    provincesProblem(state, offer.give.provinces, offer.from, offer.to, 'full') !== null ||
    provincesProblem(state, offer.want.provinces, offer.to, offer.from, 'public') !== null
  )
}

/** Die Abtretung selbst (R-DIP-09/AK2): Besitzerwechsel ueber den Helfer der Eroberung — sonst nichts. */
function cedeProvince(draft: GameState, provinceId: ProvinceId, ceder: PlayerId, receiver: PlayerId, ctx: PhaseContext): void {
  transferProvince(draft, provinceId, receiver)
  // Keine Moral, keine Besatzungszeit, keine Verstimmung, kein Preis, kein Alarm.
  emit(ctx.events, draft.tick, 'PROVINCE_CEDED', {
    provinceId,
    previousOwner: ceder,
    newOwner: receiver,
    concerns: [ceder, receiver],
  })
}

/**
 * Schliesst genau dieses eine Angebot (B4). Ausser bei `accepted` geht die Treuhand an den
 * Anbieter zurueck — auch an einen ausgeschiedenen, damit Bestaende plus Treuhand erhalten bleiben.
 *
 * `from` kann bei einem geladenen Stand fehlen (Nachtrag Befund M17-D6): `validateState` prueft
 * heute nur die Form von `give`/`want`, nicht, ob `from`/`to` bekannte Maechte sind. Ohne
 * Anbieter gibt es keinen Bestand, dem etwas zurueckginge — die Treuhand verfaellt dann
 * stillschweigend, statt den Tick mit einem TypeError abzubrechen.
 */
export function closeTradeOffer(draft: GameState, offer: TradeOffer, reason: TradeOfferCloseReason, ctx: PhaseContext): void {
  if (reason !== 'accepted') {
    const from = draft.players[offer.from]
    if (from) {
      for (const key of RESOURCE_KEYS) {
        const amount = offer.give.resources[key]
        if (amount !== undefined) from.resources[key] += amount
      }
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
 *
 * Eine Provinz, die nicht mehr abtretbar ist, schliesst als `invalid` — nach dem Krieg, vor der
 * Frist (T-M17-06).
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
          : provincesLapsed(draft, offer)
            ? 'invalid'
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

    // Provinzen (R-DIP-09/AK1): die gebende Seite voll, die verlangte nur oeffentlich (R-DIP-04).
    const giveProvinces = provincesProblem(state, command.give.provinces, command.playerId, command.targetPlayerId, 'full')
    if (giveProvinces !== null) return giveProvinces
    const wantProvinces = provincesProblem(state, command.want.provinces, command.targetPlayerId, command.playerId, 'public')
    if (wantProvinces !== null) return wantProvinces

    const giveProblem = amountProblem(command.give.resources as Record<string, unknown>)
    if (!giveProblem.ok) return giveProblem
    const wantProblem = amountProblem(command.want.resources as Record<string, unknown>)
    if (!wantProblem.ok) return wantProblem

    if (Object.keys(command.give.resources).length === 0 && command.give.provinces.length === 0) {
      return fail('INVALID_TARGET', { reason: 'leeres Angebot' })
    }

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
        give: { resources: give, provinces: command.give.provinces.slice() },
        want: { resources: copyResources(command.want.resources), provinces: command.want.provinces.slice() },
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

    // Beide Seiten erneut und voll (R-DIP-09/AK1): zwischen Angebot und Annahme kann eine Provinz
    // veralten. Die verlangte ist die eigene des Annehmenden; die gebende scheitert hier nur, wenn
    // sie seit der letzten Diplomatiephase veraltet ist — dann schliesst diese sie noch im selben
    // Tick als `invalid`, mit Rueckgabe.
    const giveProvinces = provincesProblem(state, offer.give.provinces, offer.from, offer.to, 'full')
    if (giveProvinces !== null) return giveProvinces
    const wantProvinces = provincesProblem(state, offer.want.provinces, offer.to, offer.from, 'full')
    if (wantProvinces !== null) return wantProvinces

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
    // Die Provinzen zuletzt (E9): erst die gegebene Seite, dann die verlangte, je in Listenreihenfolge.
    for (const provinceId of offer.give.provinces) cedeProvince(draft, provinceId, offer.from, offer.to, ctx)
    for (const provinceId of offer.want.provinces) cedeProvince(draft, provinceId, offer.to, offer.from, ctx)
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
