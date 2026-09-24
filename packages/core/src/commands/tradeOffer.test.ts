import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { RAW_DEFAULT_RULES, TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GameEvent } from '../events/types'
import { isWorldEventType, worldEventsIn } from '../events/world'
import { diplomacy } from '../phases/diplomacy'
import type { PhaseContext } from '../phases/index'
import { parseRules } from '../rules/load'
import { createInitialState, type GameConfig } from '../state/create'
import { RESOURCE_KEYS, type GameState, type ResourceKey, type TradeBundle } from '../state/types'
import { step } from '../step'
import { runTicks } from '../clock'
import { publicView } from '../view/publicView'
import './handlers'
import { applyCommand, canApply } from './registry'
import type { Command } from './types'

/**
 * Handelsangebote mit Treuhand (T-M17-05, R-DIP-05, D29.2 bis D29.6).
 *
 * Die meisten Faelle rufen Befehl und Diplomatiephase **direkt** auf, nicht `step()`: Produktion
 * und Unterhalt veraendern die Bestaende in jedem Tick, und die Treuhand ist nur dann bewiesen,
 * wenn eine Menge **genau** stimmt. Wo es um die Reihenfolge im Tick geht, laeuft `step()`.
 */

const map = smallWorld()
const rules = TEST_RULES
const C = rules.constants

const CONFIG: GameConfig = {
  seed: 505,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'C', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

let state: GameState
let events: GameEvent[]
let ctx: PhaseContext

beforeEach(() => {
  state = createInitialState(CONFIG, { map, rules })
  events = []
  ctx = { map, rules, commands: [], events }
})

const bundle = (resources: Partial<Record<ResourceKey, number>> = {}): TradeBundle => ({ resources, provinces: [] })

const offer = (
  from: string,
  to: string,
  give: Partial<Record<ResourceKey, number>>,
  want: Partial<Record<ResourceKey, number>> = {},
): Command => ({ type: 'OFFER_TRADE', playerId: from, targetPlayerId: to, give: bundle(give), want: bundle(want) })

const accept = (playerId: string, offerId: string): Command => ({ type: 'ACCEPT_TRADE', playerId, offerId })
const decline = (playerId: string, offerId: string): Command => ({ type: 'DECLINE_TRADE', playerId, offerId })
const withdraw = (playerId: string, offerId: string): Command => ({ type: 'WITHDRAW_TRADE', playerId, offerId })

const money = (id: string) => state.players[id]!.resources.money
const res = (id: string, key: ResourceKey) => state.players[id]!.resources[key]

/** Legt ein Angebot und gibt seine Kennung zurueck — der Test faellt, wenn es abgelehnt wird. */
function place(command: Command): string {
  const result = applyCommand(state, command, ctx)
  expect(result, 'Angebot abgelehnt').toEqual({ ok: true })
  return state.diplomacy.tradeOffers[state.diplomacy.tradeOffers.length - 1]!.id
}

/** Laeuft die Diplomatiephase im Tick `tick` — ohne Produktion und Unterhalt. */
function diplomacyAt(tick: number): GameEvent[] {
  state.tick = tick
  const before = events.length
  diplomacy(state, ctx)
  return events.slice(before)
}

const closed = (list: readonly GameEvent[]) => list.filter((e) => e.type === 'TRADE_OFFER_CLOSED')

/** Bestand plus Treuhand je Rohstoff, ueber alle Maechte — die Groesse, die nie wandern darf. */
function totals(s: GameState): Record<ResourceKey, number> {
  const sum = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0])) as Record<ResourceKey, number>
  for (const id of s.playerOrder) for (const key of RESOURCE_KEYS) sum[key] += s.players[id]!.resources[key]
  for (const o of s.diplomacy.tradeOffers) {
    for (const key of RESOURCE_KEYS) sum[key] += o.give.resources[key] ?? 0
  }
  return sum
}

describe('R-DIP-05/AK1 Treuhand beim Angebot, Verfall mit Rueckgabe', () => {
  it('zieht die angebotene Menge sofort vom Bestand ab und legt sie ins Angebot', () => {
    const vorher = { money: money('p1'), iron: res('p1', 'iron') }

    const id = place(offer('p1', 'p2', { money: 100_000, iron: 20_000 }, { food: 50_000 }))

    expect(money('p1')).toBe(vorher.money - 100_000)
    expect(res('p1', 'iron')).toBe(vorher.iron - 20_000)
    const o = state.diplomacy.tradeOffers.find((entry) => entry.id === id)!
    expect(o).toMatchObject({ from: 'p1', to: 'p2', createdTick: 0 })
    expect(o.give.resources).toEqual({ money: 100_000, iron: 20_000 })
    expect(o.want.resources).toEqual({ food: 50_000 })
    // Die Frist kommt aus den Regeln, nicht aus dem Code.
    expect(o.expiresAtTick).toBe(C.tradeOfferLifetimeDays * C.ticksPerDay)
  })

  it('vergibt die Kennung aus nextIds.offer, fortlaufend', () => {
    const first = place(offer('p1', 'p2', { money: 1_000 }))
    const second = place(offer('p1', 'p3', { money: 1_000 }))

    expect(first).not.toBe(second)
    expect(state.nextIds.offer).toBe(3)
  })

  it('verfaellt nach der Regelfrist ohne Antwort — und gibt genau die Treuhand zurueck', () => {
    const vorher = money('p1')
    place(offer('p1', 'p2', { money: 100_000 }))
    const expires = state.diplomacy.tradeOffers[0]!.expiresAtTick

    // Einen Tick vorher liegt es noch.
    expect(closed(diplomacyAt(expires - 1))).toEqual([])
    expect(state.diplomacy.tradeOffers).toHaveLength(1)
    expect(money('p1')).toBe(vorher - 100_000)

    const fired = closed(diplomacyAt(expires))
    expect(state.diplomacy.tradeOffers).toEqual([])
    expect(money('p1')).toBe(vorher)
    expect(fired).toHaveLength(1)
    expect(fired[0]).toMatchObject({ playerId: 'p1', targetPlayerId: 'p2', reason: 'expired' })
    expect([...fired[0]!.audience].sort()).toEqual(['p1', 'p2'])
  })

  it('verfaellt auch in einer echten Partie durch step()', () => {
    let s = step(state, [offer('p1', 'p2', { money: 100_000 })], { map, rules }).state
    expect(s.diplomacy.tradeOffers).toHaveLength(1)
    const lifetime = C.tradeOfferLifetimeDays * C.ticksPerDay
    const all: GameEvent[] = []
    for (let i = 1; i <= lifetime; i++) {
      const result = step(s, [], { map, rules })
      all.push(...result.events)
      s = result.state
    }
    expect(s.diplomacy.tradeOffers).toEqual([])
    expect(closed(all).map((e) => (e as { reason: string }).reason)).toEqual(['expired'])
  })

  it('der Befehl bleibt vom Zustand getrennt', () => {
    const command = offer('p1', 'p2', { money: 5_000 }, { food: 1_000 })
    expect(applyCommand(state, command, ctx)).toEqual({ ok: true })
    ;(command as { give: TradeBundle }).give.resources.money = 1
    ;(command as { want: TradeBundle }).want.resources.food = 1
    expect(state.diplomacy.tradeOffers[0]!.give.resources.money).toBe(5_000)
    expect(state.diplomacy.tradeOffers[0]!.want.resources.food).toBe(1_000)
  })
})

describe('R-DIP-05/AK1 Was ein Angebot nicht darf', () => {
  const rejects = (command: Command, code: string) => {
    const before = structuredClone(state)
    expect(canApply(state, command, ctx)).toMatchObject({ ok: false, code })
    expect(applyCommand(state, command, ctx).ok).toBe(false)
    expect(state).toEqual(before)
  }

  it('an sich selbst', () => rejects(offer('p1', 'p1', { money: 1_000 }), 'INVALID_TARGET'))
  it('an eine unbekannte Macht', () => rejects(offer('p1', 'p9', { money: 1_000 }), 'UNKNOWN_PLAYER'))
  it('an eine ausgeschiedene Macht', () => {
    state.players['p2']!.alive = false
    rejects(offer('p1', 'p2', { money: 1_000 }), 'PLAYER_ELIMINATED')
  })
  it('mit leerem give', () => rejects(offer('p1', 'p2', {}, { money: 1_000 }), 'INVALID_TARGET'))
  it('mit einer Menge null', () => rejects(offer('p1', 'p2', { money: 0 }), 'INVALID_TARGET'))
  it('mit einer negativen Menge', () => rejects(offer('p1', 'p2', { money: -5 }), 'INVALID_TARGET'))
  it('mit einer negativen Menge in want', () => rejects(offer('p1', 'p2', { money: 1_000 }, { iron: -5 }), 'INVALID_TARGET'))
  it('mit einer gebrochenen Menge', () => rejects(offer('p1', 'p2', { money: 1.5 }), 'INVALID_TARGET'))
  it('mit einem unbekannten Rohstoff', () =>
    rejects(offer('p1', 'p2', { gold: 1_000 } as Partial<Record<ResourceKey, number>>), 'INVALID_TARGET'))
  it('mit demselben Rohstoff auf beiden Seiten', () =>
    rejects(offer('p1', 'p2', { money: 1_000 }, { money: 2_000 }), 'INVALID_TARGET'))
  it('ueber tradeMaxMoney', () => rejects(offer('p1', 'p2', { money: C.tradeMaxMoney + 1 }), 'INVALID_TARGET'))
  it('ueber tradeMaxResource', () => rejects(offer('p1', 'p2', { iron: C.tradeMaxResource + 1 }), 'INVALID_TARGET'))
  it('ueber tradeMaxResource in want', () =>
    rejects(offer('p1', 'p2', { money: 1_000 }, { food: C.tradeMaxResource + 1 }), 'INVALID_TARGET'))
  it('mit Provinzen — das ist der Provinzhandel (T-M17-06)', () => {
    const command = offer('p1', 'p2', { money: 1_000 }) as Command & { give: TradeBundle }
    command.give.provinces = ['n1']
    rejects(command, 'INVALID_TARGET')
  })
  it('ohne Deckung', () => {
    state.players['p1']!.resources.iron = 999
    rejects(offer('p1', 'p2', { iron: 1_000 }), 'INSUFFICIENT_RESOURCES')
  })
  it('ueber maxOpenTradeOffers', () => {
    for (let i = 0; i < C.maxOpenTradeOffers; i++) place(offer('p1', i % 2 === 0 ? 'p2' : 'p3', { money: 1_000 }))
    rejects(offer('p1', 'p2', { money: 1_000 }), 'QUEUE_FULL')
    // Die Obergrenze gilt je Anbieter: ein anderer darf weiter anbieten.
    place(offer('p2', 'p1', { money: 1_000 }))
  })
  it('mit einem Buendel, das kein Objekt ist (ein Befehl aus dem Netz ist nicht vertrauenswuerdig)', () => {
    rejects({ type: 'OFFER_TRADE', playerId: 'p1', targetPlayerId: 'p2', give: null, want: bundle() } as unknown as Command, 'INVALID_TARGET')
  })
})

describe('R-DIP-05/AK2 Annahme tauscht im selben Tick', () => {
  it('bewegt beide Seiten genau um die vereinbarten Mengen', () => {
    const p1 = { money: money('p1'), food: res('p1', 'food') }
    const p2 = { money: money('p2'), food: res('p2', 'food') }
    const id = place(offer('p1', 'p2', { money: 100_000 }, { food: 50_000 }))

    expect(applyCommand(state, accept('p2', id), ctx)).toEqual({ ok: true })

    expect(money('p1')).toBe(p1.money - 100_000)
    expect(res('p1', 'food')).toBe(p1.food + 50_000)
    expect(money('p2')).toBe(p2.money + 100_000)
    expect(res('p2', 'food')).toBe(p2.food - 50_000)
    expect(state.diplomacy.tradeOffers).toEqual([])
    expect(closed(events)).toHaveLength(1)
    expect(closed(events)[0]).toMatchObject({ offerId: id, reason: 'accepted' })
  })

  it('tauscht in dem Tick, in dem die Annahme kommt — durch step()', () => {
    let s = step(state, [offer('p1', 'p2', { money: 100_000 }, { food: 50_000 })], { map, rules }).state
    const id = s.diplomacy.tradeOffers[0]!.id
    const result = step(s, [accept('p2', id)], { map, rules })
    s = result.state
    expect(s.diplomacy.tradeOffers).toEqual([])
    expect(result.events.filter((e) => e.type === 'TRADE_AGREED')).toHaveLength(1)
  })

  it('lehnt mit INSUFFICIENT_RESOURCES ab, wenn der Empfaenger nicht zahlen kann — und das Angebot bleibt', () => {
    const id = place(offer('p1', 'p2', { money: 100_000 }, { iron: 50_000 }))
    state.players['p2']!.resources.iron = 49_999
    const vorher = structuredClone(state)

    expect(applyCommand(state, accept('p2', id), ctx)).toMatchObject({
      ok: false,
      code: 'INSUFFICIENT_RESOURCES',
      detail: { resource: 'iron' },
    })
    expect(state).toEqual(vorher)
    expect(state.diplomacy.tradeOffers.map((o) => o.id)).toEqual([id])

    // Und spaeter, mit Deckung, geht es.
    state.players['p2']!.resources.iron = 50_000
    expect(applyCommand(state, accept('p2', id), ctx)).toEqual({ ok: true })
  })

  it('nimmt nur der Empfaenger an', () => {
    const id = place(offer('p1', 'p2', { money: 1_000 }))
    expect(canApply(state, accept('p3', id), ctx)).toMatchObject({ ok: false, code: 'NOT_OWNER' })
    expect(canApply(state, accept('p1', id), ctx)).toMatchObject({ ok: false, code: 'NOT_OWNER' })
  })

  it('kennt kein Angebot, das es nicht gibt', () => {
    expect(canApply(state, accept('p2', 'x1'), ctx)).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
  })

  it('ein Geschenk (want leer) laesst sich annehmen', () => {
    const vorher = money('p2')
    const id = place(offer('p1', 'p2', { money: 5_000 }))
    expect(applyCommand(state, accept('p2', id), ctx)).toEqual({ ok: true })
    expect(money('p2')).toBe(vorher + 5_000)
  })

  it('gilt noch im Tick des Verfalls — die Annahme kommt vor der Diplomatiephase', () => {
    let s = step(state, [offer('p1', 'p2', { money: 10_000 })], { map, rules }).state
    const lifetime = C.tradeOfferLifetimeDays * C.ticksPerDay
    s = runTicks(s, lifetime - 1, { map, rules }).state
    expect(s.tick).toBe(lifetime)

    const r = step(s, [accept('p2', s.diplomacy.tradeOffers[0]!.id)], { map, rules })
    expect(r.events.filter((e) => e.type === 'TRADE_AGREED')).toHaveLength(1)
    expect(r.events.filter((e) => e.type === 'TRADE_OFFER_CLOSED' && (e as { reason: string }).reason === 'expired')).toEqual([])
    expect(r.state.diplomacy.tradeOffers).toEqual([])
  })
})

describe('B4 Handelsangebote erben nicht das Loeschen aller Angebote an den Annehmenden', () => {
  it('laesst das Angebot eines anderen Absenders liegen', () => {
    const vonP1 = place(offer('p1', 'p2', { money: 1_000 }))
    const vonP3 = place(offer('p3', 'p2', { money: 2_000 }))

    expect(applyCommand(state, accept('p2', vonP1), ctx)).toEqual({ ok: true })
    expect(state.diplomacy.tradeOffers.map((o) => o.id)).toEqual([vonP3])
  })

  it('laesst ein zweites Angebot desselben Absenders liegen', () => {
    const erstes = place(offer('p1', 'p2', { money: 1_000 }))
    const zweites = place(offer('p1', 'p2', { iron: 1_000 }))

    expect(applyCommand(state, accept('p2', erstes), ctx)).toEqual({ ok: true })
    expect(state.diplomacy.tradeOffers.map((o) => o.id)).toEqual([zweites])
  })

  it('schliesst beim Ablehnen nur das eine', () => {
    const erstes = place(offer('p1', 'p2', { money: 1_000 }))
    const zweites = place(offer('p3', 'p2', { money: 1_000 }))
    expect(applyCommand(state, decline('p2', erstes), ctx)).toEqual({ ok: true })
    expect(state.diplomacy.tradeOffers.map((o) => o.id)).toEqual([zweites])
  })
})

describe('R-DIP-05 Ablehnen und Zurueckziehen geben die Treuhand zurueck', () => {
  it('Ablehnen: nur der Empfaenger, Treuhand zurueck an den Anbieter', () => {
    const vorher = money('p1')
    const id = place(offer('p1', 'p2', { money: 30_000 }))
    expect(canApply(state, decline('p1', id), ctx)).toMatchObject({ ok: false, code: 'NOT_OWNER' })

    expect(applyCommand(state, decline('p2', id), ctx)).toEqual({ ok: true })
    expect(money('p1')).toBe(vorher)
    expect(state.diplomacy.tradeOffers).toEqual([])
    expect(closed(events)[0]).toMatchObject({ reason: 'declined' })
  })

  it('Zurueckziehen: nur der Anbieter, Treuhand zurueck', () => {
    const vorher = money('p1')
    const id = place(offer('p1', 'p2', { money: 30_000 }))
    expect(canApply(state, withdraw('p2', id), ctx)).toMatchObject({ ok: false, code: 'NOT_OWNER' })

    expect(applyCommand(state, withdraw('p1', id), ctx)).toEqual({ ok: true })
    expect(money('p1')).toBe(vorher)
    expect(state.diplomacy.tradeOffers).toEqual([])
    expect(closed(events)[0]).toMatchObject({ reason: 'withdrawn' })
  })

  it('ein geschlossenes Angebot laesst sich nicht noch einmal schliessen', () => {
    const id = place(offer('p1', 'p2', { money: 30_000 }))
    applyCommand(state, withdraw('p1', id), ctx)
    expect(canApply(state, withdraw('p1', id), ctx)).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(canApply(state, decline('p2', id), ctx)).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(canApply(state, accept('p2', id), ctx)).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
  })
})

describe('R-DIP-05/AK3 Im Krieg kein Handel', () => {
  const declare = (from: string, to: string): Command => ({
    type: 'DIPLOMACY',
    playerId: from,
    targetPlayerId: to,
    action: 'declareWar',
  })

  it('kein Angebot im Krieg', () => {
    state.diplomacy.relations['p1|p2']!.state = 'war'
    expect(canApply(state, offer('p1', 'p2', { money: 1_000 }), ctx)).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
  })

  it('kein Angebot, solange eine Kriegserklaerung laeuft', () => {
    applyCommand(state, declare('p2', 'p1'), ctx)
    expect(canApply(state, offer('p1', 'p2', { money: 1_000 }), ctx)).toMatchObject({
      ok: false,
      code: 'INVALID_TARGET',
      detail: { reason: 'Kriegserklärung läuft' },
    })
  })

  it('keine Annahme, solange eine Kriegserklaerung laeuft — das Angebot bleibt bis zum Krieg liegen', () => {
    const id = place(offer('p1', 'p2', { money: 1_000 }))
    applyCommand(state, declare('p2', 'p1'), ctx)
    expect(canApply(state, accept('p2', id), ctx)).toMatchObject({ ok: false, code: 'INVALID_TARGET' })
    expect(state.diplomacy.tradeOffers).toHaveLength(1)
  })

  it('ein offenes Angebot verfaellt mit Rueckgabe, sobald die Erklaerung wirksam wird', () => {
    const vorher = money('p1')
    place(offer('p1', 'p2', { money: 40_000 }))
    place(offer('p1', 'p3', { money: 1_000 }))
    applyCommand(state, declare('p2', 'p1'), ctx)

    const fired = closed(diplomacyAt(C.warDeclarationDelayTicks))
    expect(state.diplomacy.relations['p1|p2']!.state).toBe('war')
    expect(fired).toHaveLength(1)
    expect(fired[0]).toMatchObject({ targetPlayerId: 'p2', reason: 'war' })
    expect(money('p1')).toBe(vorher - 1_000)
    // Ein Angebot an eine Macht im Frieden bleibt.
    expect(state.diplomacy.tradeOffers.map((o) => o.to)).toEqual(['p3'])
  })

  it('ein offenes Angebot verfaellt mit Rueckgabe beim Ueberfall — im selben Tick', () => {
    const vorher = money('p2')
    place(offer('p2', 'p1', { money: 40_000 }))
    placeArmy(state, { owner: 'p1', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })

    const fired = closed(diplomacyAt(5))
    expect(state.diplomacy.relations['p1|p2']!.state).toBe('war')
    expect(fired).toHaveLength(1)
    expect(fired[0]).toMatchObject({ reason: 'war' })
    expect(money('p2')).toBe(vorher)
    expect(state.diplomacy.tradeOffers).toEqual([])
  })

  it('Ablehnen und Zurueckziehen bleiben waehrend einer Erklaerung moeglich', () => {
    const vorher = money('p1')
    const erstes = place(offer('p1', 'p2', { money: 5_000 }))
    const zweites = place(offer('p1', 'p2', { money: 6_000 }))
    applyCommand(state, declare('p2', 'p1'), ctx)

    expect(applyCommand(state, decline('p2', erstes), ctx)).toEqual({ ok: true })
    expect(applyCommand(state, withdraw('p1', zweites), ctx)).toEqual({ ok: true })
    expect(money('p1')).toBe(vorher)
    expect(state.diplomacy.tradeOffers).toEqual([])
  })
})

describe('R-DIP-05/AK4 Die Welt erfaehrt, dass gehandelt wird — nicht wie viel', () => {
  it('TRADE_AGREED hat kein Mengenfeld, steht im Weltgeschehen und geht beide an', () => {
    const id = place(offer('p1', 'p2', { money: 123_000 }, { iron: 45_000 }))
    applyCommand(state, accept('p2', id), ctx)

    const agreed = events.filter((e) => e.type === 'TRADE_AGREED')
    expect(agreed).toHaveLength(1)
    const event = agreed[0]!
    // Genau diese Felder und keine anderen: jedes flache Feld landet im Satz (D29.5, Falle).
    expect(Object.keys(event).sort()).toEqual(['audience', 'concerns', 'playerId', 'severity', 'targetPlayerId', 'tick', 'type'])
    expect(event.audience).toEqual([])
    expect([...event.concerns].sort()).toEqual(['p1', 'p2'])
    expect(event.severity).toBe('info')
    expect(isWorldEventType('TRADE_AGREED')).toBe(true)
    expect(worldEventsIn(events)).toContain(event)
    // Keine der beiden Mengen steckt irgendwo im Ereignis.
    const text = JSON.stringify(event)
    expect(text).not.toContain('123000')
    expect(text).not.toContain('45000')
  })

  it('TRADE_OFFER_CLOSED liest nur, wer beteiligt ist, und steht nicht im Weltgeschehen', () => {
    const id = place(offer('p1', 'p2', { money: 1_000 }))
    applyCommand(state, decline('p2', id), ctx)
    const event = closed(events)[0]!
    expect([...event.audience].sort()).toEqual(['p1', 'p2'])
    expect(isWorldEventType('TRADE_OFFER_CLOSED')).toBe(false)
    expect(JSON.stringify(event)).not.toContain('1000')
  })

  it('ein Dritter sieht fremde Angebote nicht in seiner Sicht', () => {
    const id = place(offer('p1', 'p2', { money: 7_000 }, { food: 3_000 }))
    const p3 = publicView(state, 'p3')
    expect(p3.tradeOffers).toEqual({ incoming: [], outgoing: [] })
    expect(JSON.stringify(p3)).not.toContain(`"${id}"`)
  })
})

describe('D29.6 Die Sicht nennt die eigenen Angebote', () => {
  it('der Empfaenger sieht es als eingehend, der Anbieter als ausgehend — mit beiden Buendeln', () => {
    const id = place(offer('p1', 'p2', { money: 7_000 }, { food: 3_000 }))
    const p1 = publicView(state, 'p1').tradeOffers
    const p2 = publicView(state, 'p2').tradeOffers

    expect(p1.incoming).toEqual([])
    expect(p1.outgoing.map((o) => o.id)).toEqual([id])
    expect(p2.outgoing).toEqual([])
    expect(p2.incoming).toEqual([
      {
        id,
        from: 'p1',
        to: 'p2',
        give: { resources: { money: 7_000 }, provinces: [] },
        want: { resources: { food: 3_000 }, provinces: [] },
        createdTick: 0,
        expiresAtTick: C.tradeOfferLifetimeDays * C.ticksPerDay,
      },
    ])
  })

  it('ist eine Kopie — wer die Sicht veraendert, veraendert nicht den Zustand', () => {
    place(offer('p1', 'p2', { money: 7_000 }))
    const view = publicView(state, 'p2')
    view.tradeOffers.incoming[0]!.give.resources.money = 1
    expect(state.diplomacy.tradeOffers[0]!.give.resources.money).toBe(7_000)
  })
})

describe('D29.5 Ein Angebot mit einer ausgeschiedenen Macht ist hinfaellig', () => {
  it('schliesst es mit Rueckgabe und Grund invalid', () => {
    const vorher = money('p1')
    place(offer('p1', 'p2', { money: 20_000 }))
    state.players['p2']!.alive = false
    const fired = closed(diplomacyAt(1))
    expect(fired).toHaveLength(1)
    expect(fired[0]).toMatchObject({ reason: 'invalid' })
    expect(state.diplomacy.tradeOffers).toEqual([])
    expect(money('p1')).toBe(vorher)
  })

  it('nimmt kein Angebot eines ausgeschiedenen Anbieters an', () => {
    const id = place(offer('p1', 'p2', { money: 20_000 }))
    state.players['p1']!.alive = false
    expect(canApply(state, accept('p2', id), ctx)).toMatchObject({
      ok: false,
      code: 'INVALID_TARGET',
      detail: { reason: 'Anbieter ausgeschieden' },
    })
  })
})

describe('D29.7 Die Handelszahlen stehen in den Regeln', () => {
  it('setzt die Hoechstmenge Geld im Verhaeltnis der Referenz auf den Anker aus T-M17-02', () => {
    const baseline = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../../../docs/reports/m17-baseline.json', import.meta.url)), 'utf8'),
    ) as { soldAnker: { soldAnkerFuenfProzent: number } }
    expect(C.tradeMaxMoney).toBe((baseline.soldAnker.soldAnkerFuenfProzent * 100_000) / 2_000)
  })

  it('haelt Geld zu Rohstoff wie 100.000 zu 30.000', () => {
    expect(C.tradeMaxResource * 100_000).toBe(C.tradeMaxMoney * 30_000)
  })

  it('lehnt eine Frist ohne Dauer ab', () => {
    expect(() =>
      parseRules({ ...RAW_DEFAULT_RULES, constants: { ...RAW_DEFAULT_RULES.constants, tradeOfferLifetimeDays: 0 } }, 'kaputt'),
    ).toThrow(/tradeOfferLifetimeDays/)
    expect(() =>
      parseRules({ ...RAW_DEFAULT_RULES, constants: { ...RAW_DEFAULT_RULES.constants, maxOpenTradeOffers: 0 } }, 'kaputt'),
    ).toThrow(/maxOpenTradeOffers/)
  })
})

describe('R-DIP-05 Eigenschaft: Bestaende plus Treuhand bleiben ueber jede Folge konstant', () => {
  type Op =
    | { kind: 'offer'; from: number; to: number; give: ResourceKey; giveAmount: number; want: ResourceKey; wantAmount: number }
    | { kind: 'accept' | 'decline' | 'withdraw'; pick: number; as: number }
    | { kind: 'advance'; ticks: number }
    | { kind: 'declare'; from: number; to: number }
    | { kind: 'surprise'; attacker: number }

  const player = fc.integer({ min: 0, max: 2 })
  const resource = fc.constantFrom(...RESOURCE_KEYS)
  const op: fc.Arbitrary<Op> = fc.oneof(
    { weight: 5, arbitrary: fc.record({ kind: fc.constant('offer' as const), from: player, to: player, give: resource, giveAmount: fc.integer({ min: -10, max: 150_000 }), want: resource, wantAmount: fc.integer({ min: 0, max: 150_000 }) }) },
    { weight: 5, arbitrary: fc.record({ kind: fc.constantFrom('accept' as const, 'decline' as const, 'withdraw' as const), pick: fc.nat(10), as: player }) },
    { weight: 5, arbitrary: fc.record({ kind: fc.constant('advance' as const), ticks: fc.integer({ min: 1, max: 80 }) }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant('declare' as const), from: player, to: player }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant('surprise' as const), attacker: player }) },
  )

  /** Eine fremde Provinz je Macht, in die eine andere einmarschieren kann. */
  const homeOf = (s: GameState, id: string) => s.provinceOrder.find((p) => s.provinces[p]!.owner === id)

  it('Angebot, Rueckzug, Ablehnung, Annahme, Verfall, Kriegserklaerung und Ueberfall', () => {
    const seen: Record<string, number> = { agreed: 0, declined: 0, withdrawn: 0, expired: 0, war: 0 }
    fc.assert(
      fc.property(fc.array(op, { minLength: 15, maxLength: 40 }), (ops) => {
        state = createInitialState(CONFIG, { map, rules })
        events = []
        ctx = { map, rules, commands: [], events }
        const ids = state.playerOrder
        const start = totals(state)
        const startRng = structuredClone(state.rng)

        for (const o of ops) {
          switch (o.kind) {
            case 'offer':
              applyCommand(state, offer(ids[o.from]!, ids[o.to]!, { [o.give]: o.giveAmount }, { [o.want]: o.wantAmount }), ctx)
              break
            case 'accept':
            case 'decline':
            case 'withdraw': {
              const open = state.diplomacy.tradeOffers
              if (open.length === 0) break
              const target = open[o.pick % open.length]!
              const make = o.kind === 'accept' ? accept : o.kind === 'decline' ? decline : withdraw
              applyCommand(state, make(ids[o.as]!, target.id), ctx)
              break
            }
            case 'advance':
              for (let i = 0; i < o.ticks; i++) diplomacyAt(state.tick + 1)
              break
            case 'declare':
              applyCommand(state, { type: 'DIPLOMACY', playerId: ids[o.from]!, targetPlayerId: ids[o.to]!, action: 'declareWar' }, ctx)
              break
            case 'surprise': {
              const victim = ids[(o.attacker + 1) % ids.length]!
              const at = homeOf(state, victim)
              if (at) placeArmy(state, { owner: ids[o.attacker]!, at, units: [{ unitKey: 'infantry', hpTotal: 5_000 }] })
              diplomacyAt(state.tick + 1)
              break
            }
          }

          expect(totals(state)).toEqual(start)
          for (const id of ids) {
            for (const key of RESOURCE_KEYS) expect(state.players[id]!.resources[key]).toBeGreaterThanOrEqual(0)
          }
          // Kein Angebot ueberlebt einen Krieg zwischen seinen beiden Maechten.
          for (const t of state.diplomacy.tradeOffers) {
            const [a, b] = [t.from, t.to].sort()
            expect(state.diplomacy.relations[`${a}|${b}`]!.state).not.toBe('war')
          }
        }
        // Und die Kennungen sind eindeutig.
        const offered = state.diplomacy.tradeOffers.map((t) => t.id)
        expect(new Set(offered).size).toBe(offered.length)
        // Handel und Diplomatiephase wuerfeln nie (D29.4).
        expect(state.rng).toEqual(startRng)
        for (const e of events) {
          if (e.type === 'TRADE_AGREED') seen['agreed']! += 1
          else if (e.type === 'TRADE_OFFER_CLOSED') {
            const reason = (e as { reason: string }).reason
            if (reason in seen) seen[reason]! += 1
          }
        }
      }),
      { numRuns: 200, seed: 1705 },
    )
    for (const [ausgang, anzahl] of Object.entries(seen)) {
      expect(anzahl, `${ausgang}: die Eigenschaft hat diesen Ausgang nie gesehen — sie waere leer gruen`).toBeGreaterThanOrEqual(10)
    }
  })
})
