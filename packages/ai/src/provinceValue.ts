import { ONE } from '@worldwar/shared'
import {
  buildingCostForLevel,
  provinceYieldScaled,
  RESOURCE_KEYS,
  type BuildingKey,
  type Command,
  type MapData,
  type MapProvince,
  type PlayerId,
  type Province,
  type ProvinceId,
  type ResourceKey,
} from '@worldwar/core'
import { explainRelationship, relationship } from './relationship'
import type { AiContext, Explanation } from './types'

/**
 * Provinzwert und Provinzhandel der KI (R-DIP-09, D29.7, D29.8, T-M17-11).
 *
 * `provinceWorth` liest nur Karte, Marktpreise und eigenes Wissen (Sicht) — nie den
 * Zustand: Bevölkerung und Vorkommen kommen aus `context.map` (Befund B5: die Sicht
 * führt sie für fremde Provinzen nicht), Gebäude nur, wenn die Sicht sie führt.
 */

export type ProvinceWorthShare = 'deposits' | 'tax' | 'buildings' | 'position'

/** Was eine Provinz der KI wert ist (R-DIP-09/AK3, D29.8) — in Preiseinheiten wie `bundleValue` in trade.ts: Menge × Preis, Preis 1000 = eine Geldeinheit. */
export interface ProvinceWorth {
  provinceId: ProvinceId
  deposits: number
  tax: number
  buildings: number
  position: number
  total: number
  largest: ProvinceWorthShare
  /** Eigene Provinz, oder eine, deren Gebäude die Sicht führt (nach dem Merge: aufgedeckt). */
  buildingsKnown: boolean
}

/** Eine Provinz nur aus der Karte, mit voller Moral, ohne Besatzung — was jeder weiß (E5). */
function probeProvince(source: MapProvince, buildings: Partial<Record<BuildingKey, number>>): Province {
  return {
    id: source.id,
    name: source.name,
    owner: null,
    kind: source.kind,
    terrain: source.terrain,
    coastal: source.coastal,
    neighbors: [],
    seaLinks: [],
    population: source.population,
    morale: 100_000,
    targetMorale: 100_000,
    deposits: source.deposits,
    buildings,
    buildQueue: [],
    recruitQueue: [],
    occupiedSince: null,
    productionRemainder: {},
  }
}

/** Landnachbarn laut Karte — öffentlich, auch für Provinzen außerhalb der Sicht. */
function mapLandNeighbours(map: MapData, provinceId: ProvinceId): ProvinceId[] {
  const out: ProvinceId[] = []
  for (const index of map.edgesByProvince[provinceId] ?? []) {
    const edge = map.edges[index]!
    if (edge.kind !== 'land') continue
    out.push(edge.a === provinceId ? edge.b : edge.a)
  }
  return out
}

/**
 * Der Wert der Provinz `provinceId` aus Sicht des Halters `holder` (Standard: ich selbst).
 *
 * `null`, wenn die Provinz nicht auf der Karte steht. `buildingsKnown` sagt, ob die
 * Sicht die Gebäude führt — bei einer fremden, nicht aufgedeckten Provinz nicht: der
 * Wert nimmt dann nur, was jeder aus der Lage und den Vorkommen ablesen kann.
 */
export function provinceWorth(context: AiContext, provinceId: ProvinceId, holder: PlayerId = context.view.playerId): ProvinceWorth | null {
  const { view, map, rules } = context
  const source = map.provinces.find((p) => p.id === provinceId)
  if (!source) return null

  const seen = view.provinces.find((p) => p.id === provinceId)
  const known = seen && !seen.stale ? seen.buildings : undefined

  const ticks = rules.constants.ticksPerDay * rules.ai.provinceValueHorizonDays
  const bare = provinceYieldScaled(probeProvince(source, {}), 0, ONE, rules)
  const built = known ? provinceYieldScaled(probeProvince(source, known), 0, ONE, rules) : bare

  const over = (s: number | undefined): number => Math.trunc(((s ?? 0) * ticks) / ONE)
  const prices = view.marketPrices
  const weights = rules.ai.resourceWeights

  const tax = over(bare.money) * prices.money

  let deposits = 0
  let bonus = 0
  for (const key of RESOURCE_KEYS) {
    if (key === 'money') continue
    const price = prices[key]
    const weight = weights[key]
    deposits += Math.trunc((over(bare[key]) * price * weight) / 1000)
    bonus += Math.trunc(((over(built[key]) - over(bare[key])) * price * weight) / 1000)
  }

  let cost = 0
  if (known) {
    for (const key of (Object.keys(known) as BuildingKey[]).sort()) {
      const level = known[key] ?? 0
      const rule = rules.buildings[key]
      for (let l = 1; l <= level; l++) {
        const amounts = buildingCostForLevel(rule, l, rules.constants)
        for (const [resource, amount] of Object.entries(amounts)) {
          if (!amount) continue
          cost += amount * prices[resource as ResourceKey]
        }
      }
    }
  }
  const buildings = bonus + cost

  const adjacent = Math.min(
    3,
    mapLandNeighbours(map, provinceId).filter((n) => view.provinces.find((p) => p.id === n)?.owner === holder).length,
  )
  const position = Math.trunc(((deposits + tax) * rules.ai.provinceValuePositionPermille * adjacent) / 3000)

  const total = deposits + tax + buildings + position
  const shares: [ProvinceWorthShare, number][] = [
    ['deposits', deposits],
    ['tax', tax],
    ['buildings', buildings],
    ['position', position],
  ]
  let largest: ProvinceWorthShare = 'deposits'
  let largestValue = -Infinity
  for (const [key, value] of shares) {
    if (value > largestValue) {
      largest = key
      largestValue = value
    }
  }

  return { provinceId, deposits, tax, buildings, position, total, largest, buildingsKnown: known !== undefined }
}

const SHARE_NAMES: Record<ProvinceWorthShare, string> = {
  deposits: 'Vorkommen',
  tax: 'Steuer',
  buildings: 'Gebäude',
  position: 'Lage',
}

export function explainProvinceWorth(worth: ProvinceWorth): string {
  return `${worth.provinceId} ist ${Math.trunc(worth.total / 1000)} wert, größter Anteil ${SHARE_NAMES[worth.largest]}${
    worth.buildingsKnown ? '' : ', Gebäude unbekannt'
  }`
}

/**
 * Warum die KI `provinceId` nicht an `receiver` abtreten kann — aus der **Sicht**, nie aus
 * dem Zustand (R-DIP-09). Spiegelt `commands/tradeOffer.ts` `cessionProblem` im Kern und
 * sperrt zusätzlich laufende Bauten und Aufträge desselben Zugs (E7).
 */
export function cessionProblem(
  context: AiContext,
  provinceId: ProvinceId,
  receiver: PlayerId,
  pending: readonly Command[],
  ceded: ReadonlySet<ProvinceId>,
): string | null {
  const { view } = context
  const me = view.playerId

  if (ceded.has(provinceId)) return 'bereits abgetreten'

  const seen = view.provinces.find((p) => p.id === provinceId)
  if (!seen || seen.stale || seen.owner !== me) return 'nicht im Besitz'

  if (view.self.capitalProvinceId === provinceId) return 'Hauptstadt'
  if (pending.some((c) => c.type === 'SET_CAPITAL' && c.playerId === me && c.provinceId === provinceId)) return 'Hauptstadt'

  const armiesHere = view.armies.filter((a) => a.provinceId === provinceId)
  if (armiesHere.some((a) => view.relations[a.owner]?.state === 'war')) return 'umkämpft'

  if (view.armies.some((a) => a.owner === me && (a.provinceId === provinceId || (a.path ?? []).includes(provinceId)))) {
    return 'eigene Armeen'
  }

  if (armiesHere.some((a) => a.owner !== me && a.owner !== receiver)) return 'fremde Armeen'

  if ((seen.buildQueueLength ?? 0) > 0) return 'laufender Bau'

  if (pending.some((c) => (c.type === 'BUILD' || c.type === 'RECRUIT') && c.playerId === me && c.provinceId === provinceId)) {
    return 'Auftrag in diesem Zug'
  }

  return null
}

/**
 * Die Mächte, denen ich in diesem Zug den Krieg erkläre (Befund M17-D11): der Kern setzt
 * `warEffectiveAtTick` sofort. Hier statt in `trade.ts`, damit beide Module sie ohne
 * Zyklus importieren können (E13) — `trade.ts` benutzt sie ebenfalls.
 */
export function warDeclaredThisTurn(context: AiContext, pending: readonly Command[]): Set<PlayerId> {
  const me = context.view.playerId
  const out = new Set<PlayerId>()
  for (const command of pending) {
    if (command.type === 'DIPLOMACY' && command.playerId === me && command.action === 'declareWar') {
      out.add(command.targetPlayerId)
    }
  }
  return out
}

/**
 * Sichtbestand, gemindert um alles, was eigene Befehle desselben Zugs ausgeben (E16 aus
 * T-M17-10, erweitert um eigene Handelsbefehle). Hier statt in `trade.ts` aus demselben
 * Grund wie `warDeclaredThisTurn` (E13).
 */
export function ledgerAfter(context: AiContext, pending: readonly Command[]): Record<ResourceKey, number> {
  const { view, rules } = context
  const me = view.playerId
  const ledger: Record<ResourceKey, number> = { ...view.self.resources }

  for (const command of pending) {
    if (command.type === 'BUILD' && command.playerId === me) {
      const province = view.provinces.find((entry) => entry.id === command.provinceId)
      const level = province?.buildings?.[command.building] ?? 0
      const rule = rules.buildings[command.building]
      const cost = buildingCostForLevel(rule, level + 1, rules.constants)
      for (const [key, amount] of Object.entries(cost)) {
        if (!amount) continue
        ledger[key as ResourceKey] -= amount
      }
    } else if (command.type === 'OFFER_TRADE' && command.playerId === me) {
      for (const [key, amount] of Object.entries(command.give.resources)) {
        if (!amount) continue
        ledger[key as ResourceKey] -= amount
      }
    } else if (command.type === 'ACCEPT_TRADE' && command.playerId === me) {
      const offer = view.tradeOffers.incoming.find((o) => o.id === command.offerId)
      if (!offer) continue
      for (const [key, amount] of Object.entries(offer.want.resources)) {
        if (!amount) continue
        ledger[key as ResourceKey] -= amount
      }
    }
  }

  return ledger
}

/**
 * Aktiver Provinzhandel (D29.8): hoechstens ein Befehl, nur am Angebotstakt. Verkauft wird
 * nur bei Geldmangel (die billigste abtretbare Provinz an einen vertrauten Nachbarn),
 * gekauft nur, wenn der geschaetzte Preis des Verkaeufers unter dem eigenen Wert liegt.
 *
 * **Nicht zugesagt** (dod T-M17-11): gebaut und gezaehlt, aber die Zahl gehoert T-M17-15
 * (E8). Mit den ausgelieferten Zahlen kauft die KI mit diesen Regeln praktisch nie und
 * verkauft fast nie (Befund M17-D12) — das ist die ehrliche Folge von Aufschlag und Marge.
 */
export function provinceOfferCommands(context: AiContext, explanations: Explanation[], pending: readonly Command[]): Command[] {
  const { view, map, rules, difficulty } = context
  const me = view.playerId
  const ai = rules.ai
  const grievances = view.self.grievances

  // 1. Takt, ein offenes Provinzangebot, Stapel.
  const ticksPerDay = rules.constants.ticksPerDay
  const day = Math.trunc(view.tick / ticksPerDay)
  if (day % rules.constants.tradeOfferLifetimeDays !== 0) return []

  const outgoing = view.tradeOffers.outgoing
  if (outgoing.some((o) => o.give.provinces.length > 0 || o.want.provinces.length > 0)) return []

  const pendingOffer = pending.find((c) => c.type === 'OFFER_TRADE' && c.playerId === me) as
    | Extract<Command, { type: 'OFFER_TRADE' }>
    | undefined
  if (pendingOffer && (pendingOffer.give.provinces.length > 0 || pendingOffer.want.provinces.length > 0)) return []
  if (outgoing.length + (pendingOffer ? 1 : 0) >= rules.constants.maxOpenTradeOffers) return []

  // 2. Abtretungen und Erhalt dieses Zugs (aus den ACCEPT_TRADE in `pending`).
  const ceded = new Set<ProvinceId>()
  const received = new Set<ProvinceId>()
  for (const command of pending) {
    if (command.type !== 'ACCEPT_TRADE' || command.playerId !== me) continue
    const offer = view.tradeOffers.incoming.find((o) => o.id === command.offerId)
    if (!offer) continue
    for (const p of offer.want.provinces) ceded.add(p)
    for (const p of offer.give.provinces) received.add(p)
  }

  const declaring = warDeclaredThisTurn(context, pending)

  // 3. Partner: kein Krieg, keine laufende Kriegserklaerung, keine Kriegserklaerung dieses
  // Zugs (M17-D11), Verhaeltnis ab der Vertrauensschwelle (E9).
  const isPartner = (id: PlayerId): boolean => {
    const other = view.others.find((o) => o.id === id)
    if (!other || !other.alive) return false
    const relation = view.relations[id]
    if (!relation || relation.state === 'war' || relation.warEffectiveAtTick !== undefined) return false
    if (declaring.has(id)) return false
    return relationship(view, id, grievances, rules).value >= difficulty.trustThreshold
  }

  if (!(view.marketPrices.money > 0)) return []

  // 4. Verkaufen, nur bei Geldmangel.
  if (view.self.shortages.includes('money')) {
    const owned = view.provinces.filter((p) => !p.stale && p.owner === me)
    const abtretbar = owned.filter((p) => cessionProblem(context, p.id, me, pending, ceded) === null)

    if (abtretbar.length === 0) {
      explanations.push({
        action: 'Kein Provinzverkauf',
        reason: 'keine abtretbare Provinz',
        score: 100,
        alternative: { action: 'Geld an der Börse beschaffen', score: 50 },
      })
      return []
    }

    type Pair = { provinceId: ProvinceId; worth: ProvinceWorth; buyer: PlayerId; buyerValue: number }
    const pairs: Pair[] = []
    for (const province of abtretbar) {
      const worth = provinceWorth(context, province.id)
      if (!worth) continue
      const neighbourOwners = new Set(
        mapLandNeighbours(map, province.id)
          .map((n) => view.provinces.find((p) => p.id === n)?.owner)
          .filter((owner): owner is PlayerId => !!owner && owner !== me),
      )
      for (const buyer of neighbourOwners) {
        if (!isPartner(buyer)) continue
        if (cessionProblem(context, province.id, buyer, pending, ceded) !== null) continue
        pairs.push({ provinceId: province.id, worth, buyer, buyerValue: relationship(view, buyer, grievances, rules).value })
      }
    }

    if (pairs.length === 0) {
      explanations.push({
        action: 'Kein Provinzverkauf',
        reason: 'kein Käufer',
        score: 100,
        alternative: { action: 'Geld an der Börse beschaffen', score: 50 },
      })
      return []
    }

    pairs.sort((a, b) => {
      if (a.worth.total !== b.worth.total) return a.worth.total - b.worth.total
      if (a.provinceId !== b.provinceId) return a.provinceId < b.provinceId ? -1 : 1
      if (a.buyerValue !== b.buyerValue) return b.buyerValue - a.buyerValue
      return a.buyer < b.buyer ? -1 : 1
    })
    const chosen = pairs[0]!

    const ask = Math.ceil((chosen.worth.total * ai.provinceSalePremiumPermille) / (view.marketPrices.money * 1000))
    if (ask > rules.constants.tradeMaxMoney) {
      explanations.push({
        action: 'Kein Provinzverkauf',
        reason: `Preis ${ask} über der Höchstmenge ${rules.constants.tradeMaxMoney}; ${explainProvinceWorth(chosen.worth)}`,
        score: 100,
        alternative: { action: 'Geld an der Börse beschaffen', score: 50 },
      })
      return []
    }

    const wertKaeufer = relationship(view, chosen.buyer, grievances, rules)
    const befehl: Command = {
      type: 'OFFER_TRADE',
      playerId: me,
      targetPlayerId: chosen.buyer,
      give: { resources: {}, provinces: [chosen.provinceId] },
      want: { resources: { money: ask }, provinces: [] },
    }
    explanations.push({
      action: `Bietet ${chosen.buyer} ${chosen.provinceId} für ${ask} Geld an`,
      reason: `Geldmangel; ${explainProvinceWorth(chosen.worth)}, Aufschlag ${ai.provinceSalePremiumPermille} ‰, ${explainRelationship(wertKaeufer)}`,
      score: 600,
      alternative: { action: 'Provinz halten', score: 300 },
    })
    return [befehl]
  }

  // 5. Kaufen, nur ohne Geldmangel.
  const ledger = ledgerAfter(context, pending)
  const spendableMoney = ledger.money - Math.trunc((view.self.resources.money * ai.tradeKeepStockPermille) / 1000)
  const priceMoney = view.marketPrices.money

  type Candidate = { id: ProvinceId; owner: PlayerId; ask: number; limit: number }
  const candidates: Candidate[] = []
  for (const entry of view.provinces) {
    if (entry.stale) continue
    const owner = entry.owner
    if (!owner || owner === me) continue
    if (!isPartner(owner)) continue
    const neighbourMine = mapLandNeighbours(map, entry.id).some((n) => view.provinces.find((p) => p.id === n)?.owner === me)
    if (!neighbourMine) continue
    const ownerNation = view.others.find((o) => o.id === owner)?.nation
    const startCapital = map.startPositions.find((s) => s.nation === ownerNation)?.capital
    if (entry.id === startCapital) continue
    if (received.has(entry.id)) continue
    const armiesHere = view.armies.filter((a) => a.provinceId === entry.id)
    if (armiesHere.some((a) => a.owner !== me)) continue

    const mine = provinceWorth(context, entry.id, me)
    const theirs = provinceWorth(context, entry.id, owner)
    if (!mine || !theirs) continue

    const ask = Math.ceil((theirs.total * ai.provinceSalePremiumPermille) / (priceMoney * 1000))
    const limit = Math.floor((mine.total * 1000) / (ai.tradeAcceptMarginPermille * priceMoney))
    if (!(ask >= 1 && ask <= limit && ask <= rules.constants.tradeMaxMoney && ask <= spendableMoney)) continue

    candidates.push({ id: entry.id, owner, ask, limit })
  }

  if (candidates.length === 0) return []

  candidates.sort((a, b) => {
    const diffA = a.limit - a.ask
    const diffB = b.limit - b.ask
    if (diffA !== diffB) return diffB - diffA
    return a.id < b.id ? -1 : 1
  })
  const chosenBuy = candidates[0]!
  const worthMine = provinceWorth(context, chosenBuy.id, me)!

  const befehlKauf: Command = {
    type: 'OFFER_TRADE',
    playerId: me,
    targetPlayerId: chosenBuy.owner,
    give: { resources: { money: chosenBuy.ask }, provinces: [] },
    want: { resources: {}, provinces: [chosenBuy.id] },
  }
  explanations.push({
    action: `Bietet ${chosenBuy.owner} ${chosenBuy.ask} Geld für ${chosenBuy.id}`,
    reason: `${explainProvinceWorth(worthMine)}; geschätzter Preis ${chosenBuy.ask} unter ${chosenBuy.limit}`,
    score: 600,
    alternative: { action: 'Provinz nicht kaufen', score: 300 },
  })
  return [befehlKauf]
}
