import { mulChain, quotFixed } from '@worldwar/shared'
import {
  buildingCostForLevel,
  MARKET_REFERENCE_VOLUME,
  RESOURCE_KEYS,
  type Command,
  type PlayerId,
  type ResourceKey,
} from '@worldwar/core'
import { nextBuildingShortfall } from './economy'
import { explainRelationship, relationship } from './relationship'
import type { AiContext, Explanation } from './types'

/**
 * Handelsangebote der KI (T-M17-10, R-DIP-05, D29.7, D29.8).
 *
 * Zwei Haelften: eingehende Angebote werden begruendet angenommen oder abgelehnt
 * (`ACCEPT_TRADE`/`DECLINE_TRADE`), und hoechstens ein eigenes Angebot (`OFFER_TRADE`)
 * entsteht, wenn die Fehlmenge fuer das naechste Bauvorhaben den Boersenkurs spuerbar
 * bewegen wuerde (E13, E17: die Boerse selbst bleibt unveraendert).
 */

/** Kurswirkung in ‰, wenn `amount` an der Börse gekauft würde (Nachbau von `settleMarket`). */
export function marketImpactPermille(context: AiContext, amount: number): number {
  return mulChain([context.rules.constants.marketElasticity, quotFixed(amount, MARKET_REFERENCE_VOLUME)])
}

/** Marktwert eines Bündels, ganze Zahlen: Menge × Preis je Rohstoff. */
function bundleValue(resources: Partial<Record<ResourceKey, number>>, prices: Record<ResourceKey, number>): number {
  let total = 0
  for (const [key, amount] of Object.entries(resources)) {
    if (!amount) continue
    total += amount * (prices[key as ResourceKey] ?? 0)
  }
  return total
}

export function tradeOfferCommands(
  context: AiContext,
  explanations: Explanation[],
  pending: readonly Command[],
): Command[] {
  const { view, difficulty, rules } = context
  const me = view.playerId
  const ai = rules.ai
  const grievances = view.self.grievances
  const commands: Command[] = []

  // Buchführung je Aufruf: der Sichtbestand, gemindert um eigene BUILD-Befehle desselben
  // Zugs (E16) — sonst rechnete die KI mit Geld, das eine Baustelle im selben Tick ausgibt.
  const ledger: Record<ResourceKey, number> = { ...view.self.resources }
  for (const command of pending) {
    if (command.type !== 'BUILD' || command.playerId !== me) continue
    const province = view.provinces.find((entry) => entry.id === command.provinceId)
    const level = province?.buildings?.[command.building] ?? 0
    const rule = rules.buildings[command.building]
    const cost = buildingCostForLevel(rule, level + 1, rules.constants)
    for (const [key, amount] of Object.entries(cost)) {
      if (!amount) continue
      ledger[key as ResourceKey] -= amount
    }
  }

  const keep = (key: ResourceKey): number => Math.trunc((view.self.resources[key] * ai.tradeKeepStockPermille) / 1000)
  const spendable = (key: ResourceKey): number => ledger[key] - keep(key)

  // Antworten — view.tradeOffers.incoming, nach der Nummer im Angebot sortiert.
  const incoming = [...view.tradeOffers.incoming].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))

  for (const offer of incoming) {
    const from = offer.from
    const relation = view.relations[from]
    const wert = relationship(view, from, grievances, rules)
    const given = bundleValue(offer.want.resources, view.marketPrices)
    const received = bundleValue(offer.give.resources, view.marketPrices)
    const ratio = given > 0 ? Math.trunc((received * 1000) / given) : 0

    let reason: string | null = null
    if (offer.give.provinces.length > 0 || offer.want.provinces.length > 0) {
      reason = 'Provinzen bewertet die KI erst mit dem Provinzhandel (T-M17-11)'
    } else if (relation?.warEffectiveAtTick !== undefined) {
      reason = 'Kriegserklärung läuft'
    } else if (wert.value < difficulty.warThreshold) {
      reason = `${explainRelationship(wert)} unter der Kriegsschwelle ${difficulty.warThreshold}`
    } else {
      for (const key of Object.keys(offer.want.resources) as ResourceKey[]) {
        if (view.self.shortages.includes(key)) {
          reason = `${key} ist selbst knapp`
          break
        }
      }
      if (!reason) {
        for (const [key, amount] of Object.entries(offer.want.resources) as [ResourceKey, number][]) {
          const avail = spendable(key)
          if (amount > avail) {
            reason = `${key}: ${amount} tastet den geschützten Bestand an (verfügbar ${avail})`
            break
          }
        }
      }
      if (!reason && given > 0 && received * 1000 < given * ai.tradeAcceptMarginPermille) {
        reason = `Gegenwert ${ratio} ‰ unter der Marge ${ai.tradeAcceptMarginPermille} ‰`
      }
    }

    if (reason) {
      commands.push({ type: 'DECLINE_TRADE', playerId: me, offerId: offer.id })
      explanations.push({
        action: `Lehnt Angebot ${offer.id} von ${from} ab`,
        reason,
        score: 500,
        alternative: { action: 'annehmen', score: 100 },
      })
      continue
    }

    commands.push({ type: 'ACCEPT_TRADE', playerId: me, offerId: offer.id })
    for (const [key, amount] of Object.entries(offer.want.resources)) {
      if (amount) ledger[key as ResourceKey] -= amount
    }
    explanations.push({
      action: `Nimmt Angebot ${offer.id} von ${from} an`,
      reason:
        given === 0
          ? `Geschenk, ${explainRelationship(wert)}`
          : `Gegenwert ${ratio} ‰ erreicht die Marge ${ai.tradeAcceptMarginPermille} ‰, ${explainRelationship(wert)}`,
      score: 600,
      alternative: { action: 'ablehnen', score: 200 },
    })
  }

  // Eigenes Angebot — hoechstens eines, und nur bei spuerbarer Kurswirkung (E13).
  const ticksPerDay = rules.constants.ticksPerDay
  const day = Math.trunc(view.tick / ticksPerDay)
  if (day % rules.constants.tradeOfferLifetimeDays !== 0) return commands

  const shortfall = nextBuildingShortfall(context)
  if (!shortfall) return commands

  const impact = marketImpactPermille(context, shortfall.amount)
  const need = shortfall.resource
  if (impact <= ai.tradeImpactPermille) {
    explanations.push({
      action: 'Kein Handelsangebot',
      reason: `Kurswirkung ${impact} ‰ nicht über ${ai.tradeImpactPermille} ‰ — die Börse genügt`,
      score: 100,
      alternative: { action: `${need} einer Macht anbieten lassen`, score: 50 },
    })
    return commands
  }

  const outgoing = view.tradeOffers.outgoing
  if (outgoing.some((offer) => (offer.want.resources[need] ?? 0) > 0)) {
    explanations.push({
      action: 'Kein Handelsangebot',
      reason: `Angebot für ${need} läuft`,
      score: 100,
      alternative: { action: 'abwarten', score: 50 },
    })
    return commands
  }

  if (outgoing.length >= rules.constants.maxOpenTradeOffers) {
    explanations.push({
      action: 'Kein Handelsangebot',
      reason: 'Angebotsstapel voll',
      score: 100,
      alternative: { action: 'abwarten', score: 50 },
    })
    return commands
  }

  // Partner: bestes Verhältnis ohne Krieg und ohne laufende Kriegserklärung.
  let partner: PlayerId | null = null
  let partnerValue = -1
  for (const other of view.others) {
    if (!other.alive) continue
    const relation = view.relations[other.id]
    if (!relation || relation.state === 'war' || relation.warEffectiveAtTick !== undefined) continue
    const wert = relationship(view, other.id, grievances, rules)
    if (wert.value < difficulty.warThreshold) continue
    if (partner === null || wert.value > partnerValue || (wert.value === partnerValue && other.id < partner)) {
      partner = other.id
      partnerValue = wert.value
    }
  }
  if (!partner) {
    explanations.push({
      action: 'Kein Handelsangebot',
      reason: 'kein Handelspartner',
      score: 100,
      alternative: { action: 'abwarten', score: 50 },
    })
    return commands
  }

  // Gabe-Rohstoff: der größte Bestand, der nach der Rücklage noch Spielraum lässt (T-M17-10).
  //
  // Abweichung vom Plantext (der hier "größtes spendable(k)" nennt): sortiert nach dem
  // **Bestand** (`ledger[k]`), nicht nach dem um die Rücklage geminderten `spendable(k)` —
  // sonst würde ein knapper Bau wie in T16 (Geld durch die Baustelle fast aufgebraucht)
  // nie Geld anbieten, obwohl Geld dort mit Abstand der größte Posten ist. `spendable(k)`
  // bleibt die Zulässigkeits- und die Mengengrenze (muss > 0 sein, begrenzt `limit` unten).
  let give: ResourceKey | null = null
  let giveStock = -1
  for (const key of RESOURCE_KEYS) {
    if (key === need) continue
    if (view.self.shortages.includes(key)) continue
    if (spendable(key) <= 0) continue
    if (ledger[key] > giveStock) {
      give = key
      giveStock = ledger[key]
    }
  }
  if (!give) {
    explanations.push({
      action: 'Kein Handelsangebot',
      reason: 'kein Überschuss zum Anbieten',
      score: 100,
      alternative: { action: 'abwarten', score: 50 },
    })
    return commands
  }

  const priceNeed = view.marketPrices[need]
  const priceGive = view.marketPrices[give]
  if (!(priceNeed > 0) || !(priceGive > 0)) {
    explanations.push({
      action: 'Kein Handelsangebot',
      reason: `kein Marktpreis für ${need} oder ${give}`,
      score: 100,
      alternative: { action: 'abwarten', score: 50 },
    })
    return commands
  }

  const cap = (key: ResourceKey): number => (key === 'money' ? rules.constants.tradeMaxMoney : rules.constants.tradeMaxResource)
  const premium = ai.tradeOfferPremiumPermille
  const giveFor = (wantAmount: number): number => Math.ceil((wantAmount * priceNeed * premium) / (priceGive * 1000))
  const limit = Math.min(cap(give), spendable(give))

  let want = Math.min(shortfall.amount, cap(need))
  if (giveFor(want) > limit) {
    want = Math.floor((limit * priceGive * 1000) / (priceNeed * premium))
  }
  const giveAmount = giveFor(want)

  if (want < 1000 || giveAmount < 1 || giveAmount > limit) {
    explanations.push({
      action: 'Kein Handelsangebot',
      reason: 'zu wenig Überschuss',
      score: 100,
      alternative: { action: 'abwarten', score: 50 },
    })
    return commands
  }

  const wertPartner = relationship(view, partner, grievances, rules)
  commands.push({
    type: 'OFFER_TRADE',
    playerId: me,
    targetPlayerId: partner,
    give: { resources: { [give]: giveAmount }, provinces: [] },
    want: { resources: { [need]: want }, provinces: [] },
  })
  explanations.push({
    action: `Bietet ${partner} ${giveAmount} ${give} gegen ${want} ${need}`,
    reason: `Kurswirkung ${impact} ‰ über ${ai.tradeImpactPermille} ‰, ${explainRelationship(wertPartner)}`,
    score: 600,
    alternative: { action: `${need} an der Börse kaufen`, score: 300 },
  })

  return commands
}
