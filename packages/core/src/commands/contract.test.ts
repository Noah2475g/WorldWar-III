import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GameEvent } from '../events/types'
import { diplomacy } from '../phases/diplomacy'
import type { PhaseContext } from '../phases/index'
import { createInitialState, relationKey, type GameConfig } from '../state/create'
import { HASH_OMIT_KEYS, RESOURCE_KEYS, type GameState, type ResourceKey } from '../state/types'
import { deserialise, serialise } from '../persistence/save'
import { hashValue } from '@worldwar/shared'
import { step } from '../step'
import { publicView } from '../view/publicView'
import './handlers'
import { applyCommand, canApply } from './registry'
import type { Command } from './types'

/**
 * Liefervertraege (Liefervertrag B1, AK1 bis AK5): Annahme = Lieferung 1, danach `settleContracts`
 * in der Diplomatiephase. Die Bestaende setzt jeder Test selbst (keine festen Laenderannahmen);
 * Befehle und Diplomatiephase laufen direkt, damit Produktion und Unterhalt die Mengen nicht
 * verfaelschen.
 */

const map = smallWorld()
const rules = TEST_RULES
const C = rules.constants
const DAY = C.ticksPerDay

const CONFIG: GameConfig = {
  seed: 707,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'human', nation: 'Ostmark', color: '#b03a2e' },
    { name: 'C', kind: 'human', nation: 'Sueden', color: '#2e7d32' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

const GIVE = 10_000
const WANT = 4_000

let state: GameState
let events: GameEvent[]
let ctx: PhaseContext

beforeEach(() => {
  state = createInitialState(CONFIG, { map, rules })
  events = []
  ctx = { map, rules, commands: [], events }
  // Bestaende selbst setzen: Anbieter p1 hat Eisen, Annehmender p2 hat Geld.
  for (const id of state.playerOrder) for (const key of RESOURCE_KEYS) state.players[id]!.resources[key] = 0
  state.players['p1']!.resources.iron = 1_000_000
  state.players['p2']!.resources.money = 1_000_000
  state.players['p1']!.resources.money = 50_000
  state.players['p2']!.resources.iron = 20_000
})

const scheduled = (
  from: string,
  to: string,
  give: Partial<Record<ResourceKey, number>>,
  want: Partial<Record<ResourceKey, number>>,
  schedule: { intervalDays: number; deliveries: number },
): Command => ({
  type: 'OFFER_TRADE',
  playerId: from,
  targetPlayerId: to,
  give: { resources: give, provinces: [] },
  want: { resources: want, provinces: [] },
  schedule,
})
const accept = (playerId: string, offerId: string): Command => ({ type: 'ACCEPT_TRADE', playerId, offerId })
const cancel = (playerId: string, contractId: string): Command => ({ type: 'CANCEL_CONTRACT', playerId, contractId })

/** Legt ein Angebot mit Zeitplan und nimmt es an (Tick 0): Lieferung 1. Gibt die Vertragskennung zurueck. */
function startContract(deliveries = 5, intervalDays = 3, from = 'p1', to = 'p2'): string {
  expect(applyCommand(state, scheduled(from, to, { iron: GIVE }, { money: WANT }, { intervalDays, deliveries }), ctx)).toEqual({ ok: true })
  const offerId = state.diplomacy.tradeOffers[state.diplomacy.tradeOffers.length - 1]!.id
  expect(applyCommand(state, accept(to, offerId), ctx)).toEqual({ ok: true })
  return state.diplomacy.contracts[state.diplomacy.contracts.length - 1]!.id
}

function diplomacyAt(tick: number): GameEvent[] {
  state.tick = tick
  const before = events.length
  diplomacy(state, ctx)
  return events.slice(before)
}

const closedEvents = (list: readonly GameEvent[]) =>
  list.filter((e) => e.type === 'CONTRACT_CLOSED') as Array<Extract<GameEvent, { type: 'CONTRACT_CLOSED' }>>

function totals(s: GameState): Record<ResourceKey, number> {
  const sum = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0])) as Record<ResourceKey, number>
  for (const id of s.playerOrder) for (const key of RESOURCE_KEYS) sum[key] += s.players[id]!.resources[key]
  for (const o of s.diplomacy.tradeOffers) for (const key of RESOURCE_KEYS) sum[key] += o.give.resources[key] ?? 0
  return sum
}

const stock = (id: string) => ({ ...state.players[id]!.resources })

describe('AK1 Liefervertrag: 5 Lieferungen alle 3 Tage, termingerecht, Summen erhalten', () => {
  it('Annahme ist Lieferung 1 und legt den Vertrag mit den Planwerten an', () => {
    const ironP1 = state.players['p1']!.resources.iron
    const moneyP2 = state.players['p2']!.resources.money
    const id = startContract(5, 3)

    expect(id).toBe('c1')
    expect(state.nextIds.contract).toBe(2)
    expect(state.players['p1']!.resources.iron).toBe(ironP1 - GIVE)
    expect(state.players['p2']!.resources.money).toBe(moneyP2 - WANT)
    expect(state.diplomacy.contracts).toEqual([
      {
        id: 'c1',
        from: 'p1',
        to: 'p2',
        give: { iron: GIVE },
        want: { money: WANT },
        intervalTicks: 3 * DAY,
        remaining: 4,
        nextDueTick: 3 * DAY,
        createdTick: 0,
      },
    ])
    expect(state.diplomacy.tradeOffers).toEqual([])
  })

  it('5 Lieferungen: 2 bis 5 genau an T + k x intervalTicks, Summe je Rohstoff gleich, dann completed', () => {
    const ironP1 = state.players['p1']!.resources.iron
    const ironP2 = state.players['p2']!.resources.iron
    startContract(5, 3)
    const interval = 3 * DAY
    expect(interval).toBe(72) // ticksPerDay 24 in den Testregeln

    for (let k = 1; k <= 4; k++) {
      const vorher = totals(state)
      const ironBefore = state.players['p1']!.resources.iron

      // Einen Tick vor der Faelligkeit passiert nichts.
      diplomacyAt(k * interval - 1)
      expect(state.players['p1']!.resources.iron, `k=${k} zu frueh`).toBe(ironBefore)

      const ev = diplomacyAt(k * interval)
      expect(state.players['p1']!.resources.iron, `k=${k} Lieferung`).toBe(ironBefore - GIVE)
      expect(totals(state), `k=${k} Summe`).toEqual(vorher)
      if (k < 4) {
        expect(closedEvents(ev)).toEqual([])
        expect(state.diplomacy.contracts[0]).toMatchObject({ remaining: 4 - k, nextDueTick: (k + 1) * interval })
      } else {
        expect(state.diplomacy.contracts).toEqual([])
        const [closed] = closedEvents(ev)
        expect(closedEvents(ev)).toHaveLength(1)
        expect(closed).toMatchObject({
          contractId: 'c1',
          playerId: 'p1',
          targetPlayerId: 'p2',
          reason: 'completed',
          closedBy: null,
          audience: ['p1', 'p2'],
        })
      }
    }
    expect(state.players['p1']!.resources.iron).toBe(ironP1 - 5 * GIVE)
    expect(state.players['p2']!.resources.iron).toBe(ironP2 + 5 * GIVE)
  })

  it('je Lieferung kein Ereignis (P6)', () => {
    startContract(3, 1)
    const ev = diplomacyAt(DAY)
    expect(closedEvents(ev)).toEqual([])
    expect(ev.filter((e) => e.type === 'TRADE_AGREED' || e.type === 'TRADE_EXECUTED')).toEqual([])
  })

  it('vergibt Kennungen fortlaufend c1, c2', () => {
    expect(startContract(2, 1)).toBe('c1')
    expect(startContract(2, 1)).toBe('c2')
  })
})

describe('AK2 Ende bei Ausscheiden, Krieg und laufender Kriegserklaerung — Rangfolge', () => {
  const relation = () => state.diplomacy.relations[relationKey('p1', 'p2')]!

  it('Krieg schliesst den Vertrag im selben Durchlauf, ohne Buchung', () => {
    startContract()
    const vorher = { p1: stock('p1'), p2: stock('p2') }
    relation().state = 'war'
    const ev = diplomacyAt(10)

    expect(state.diplomacy.contracts).toEqual([])
    expect(closedEvents(ev).map((e) => [e.reason, e.closedBy])).toEqual([['war', null]])
    expect({ p1: stock('p1'), p2: stock('p2') }).toEqual(vorher)
  })

  it('eine laufende Kriegserklaerung (warEffectiveAtTick) schliesst ebenfalls als war', () => {
    startContract()
    relation().warEffectiveAtTick = 10_000
    const ev = diplomacyAt(10)

    expect(state.diplomacy.contracts).toEqual([])
    expect(closedEvents(ev).map((e) => e.reason)).toEqual(['war'])
  })

  it('Krieg + faellig -> war, keine Buchung', () => {
    startContract(5, 3)
    const vorher = { p1: stock('p1'), p2: stock('p2') }
    relation().state = 'war'
    const ev = diplomacyAt(3 * DAY)

    expect(closedEvents(ev).map((e) => e.reason)).toEqual(['war'])
    expect({ p1: stock('p1'), p2: stock('p2') }).toEqual(vorher)
  })

  it('Ausscheiden schlaegt Krieg: invalid', () => {
    startContract()
    relation().state = 'war'
    state.players['p2']!.alive = false
    const ev = diplomacyAt(10)

    expect(closedEvents(ev).map((e) => [e.reason, e.closedBy])).toEqual([['invalid', null]])
  })

  it('fehlt eine Macht ganz im Zustand: invalid ohne Absturz', () => {
    startContract()
    delete (state.players as Record<string, unknown>)['p2']
    expect(() => diplomacyAt(10)).not.toThrow()
    expect(state.diplomacy.contracts).toEqual([])
  })

  it('im selben step() geschlossen, in dem der Krieg beginnt', () => {
    startContract()
    relation().state = 'war'
    const result = step(state, [], { map, rules })
    expect(result.state.diplomacy.contracts).toEqual([])
    expect(closedEvents(result.events).map((e) => e.reason)).toEqual(['war'])
  })
})

describe('AK3 Fehlmenge: unpaid, keine Teillieferung, Bestaende unveraendert', () => {
  it('der Anbieter kann nicht liefern: closedBy = from', () => {
    startContract(5, 3)
    state.players['p1']!.resources.iron = GIVE - 1
    const vorher = { p1: stock('p1'), p2: stock('p2') }
    const ev = diplomacyAt(3 * DAY)

    expect(state.diplomacy.contracts).toEqual([])
    expect(closedEvents(ev).map((e) => [e.reason, e.closedBy])).toEqual([['unpaid', 'p1']])
    expect({ p1: stock('p1'), p2: stock('p2') }).toEqual(vorher)
  })

  it('der Annehmende kann nicht zahlen: closedBy = to', () => {
    startContract(5, 3)
    state.players['p2']!.resources.money = WANT - 1
    const vorher = { p1: stock('p1'), p2: stock('p2') }
    const ev = diplomacyAt(3 * DAY)

    expect(closedEvents(ev).map((e) => [e.reason, e.closedBy])).toEqual([['unpaid', 'p2']])
    expect({ p1: stock('p1'), p2: stock('p2') }).toEqual(vorher)
  })

  it('beide knapp: zuerst from geprueft', () => {
    startContract(5, 3)
    state.players['p1']!.resources.iron = 0
    state.players['p2']!.resources.money = 0
    const ev = diplomacyAt(3 * DAY)
    expect(closedEvents(ev).map((e) => e.closedBy)).toEqual(['p1'])
  })

  it('keine Schulden und keine Treuhand fuer kuenftige Lieferungen', () => {
    startContract(5, 3)
    // Nach Lieferung 1 liegt nichts mehr in Treuhand.
    expect(state.diplomacy.tradeOffers).toEqual([])
    state.players['p1']!.resources.iron = 0
    diplomacyAt(3 * DAY)
    for (const id of ['p1', 'p2', 'p3']) for (const key of RESOURCE_KEYS) expect(state.players[id]!.resources[key]).toBeGreaterThanOrEqual(0)
  })
})

describe('AK4 Kuendigung', () => {
  it('der Anbieter kuendigt sofort: Ereignis cancelled, closedBy = Kuendigender', () => {
    const id = startContract()
    expect(applyCommand(state, cancel('p1', id), ctx)).toEqual({ ok: true })
    expect(state.diplomacy.contracts).toEqual([])
    expect(closedEvents(events).map((e) => [e.reason, e.closedBy, e.audience])).toEqual([['cancelled', 'p1', ['p1', 'p2']]])
  })

  it('der Annehmende kuendigt sofort', () => {
    const id = startContract()
    expect(applyCommand(state, cancel('p2', id), ctx)).toEqual({ ok: true })
    expect(closedEvents(events).map((e) => [e.reason, e.closedBy])).toEqual([['cancelled', 'p2']])
  })

  it('keine Bestandsaenderung durch die Kuendigung', () => {
    const id = startContract()
    const vorher = totals(state)
    const s1 = stock('p1')
    applyCommand(state, cancel('p1', id), ctx)
    expect(totals(state)).toEqual(vorher)
    expect(stock('p1')).toEqual(s1)
  })

  it('eine fremde Kennung wirkt wie eine fehlende: kein Vertrag', () => {
    const id = startContract()
    const before = structuredClone(state)
    for (const [who, contractId] of [
      ['p3', id],
      ['p1', 'c99'],
      ['p1', 'toString'],
    ] as const) {
      expect(canApply(state, cancel(who, contractId), ctx)).toEqual({ ok: false, code: 'INVALID_TARGET', detail: { reason: 'kein Vertrag' } })
      expect(applyCommand(state, cancel(who, contractId), ctx).ok).toBe(false)
    }
    expect(canApply(state, { type: 'CANCEL_CONTRACT', playerId: 'p1', contractId: 5 as unknown as string }, ctx)).toMatchObject({ ok: false })
    expect(state).toEqual(before)
  })
})

describe('Grenzen: Zeitplan-Form, Provinzen, Vertragsgrenze, Hoechstmengen', () => {
  const rejectsWith = (command: Command, reason: string) => {
    const before = structuredClone(state)
    expect(canApply(state, command, ctx)).toEqual({ ok: false, code: 'INVALID_TARGET', detail: { reason } })
    expect(applyCommand(state, command, ctx).ok).toBe(false)
    expect(state).toEqual(before)
  }
  const sched = (schedule: unknown) =>
    ({ ...scheduled('p1', 'p2', { iron: GIVE }, { money: WANT }, { intervalDays: 1, deliveries: 2 }), schedule }) as Command

  it('lehnt ungueltige Zeitplaene ab', () => {
    for (const schedule of [
      { intervalDays: C.contractMinIntervalDays - 1, deliveries: 3 },
      { intervalDays: C.contractMaxIntervalDays + 1, deliveries: 3 },
      { intervalDays: 2, deliveries: C.contractMinDeliveries - 1 },
      { intervalDays: 2, deliveries: C.contractMaxDeliveries + 1 },
      { intervalDays: 1.5, deliveries: 3 },
      { intervalDays: 2, deliveries: 2.5 },
      { intervalDays: 'x', deliveries: 3 },
      null,
    ]) {
      rejectsWith(sched(schedule), 'ungültiger Zeitplan')
    }
  })

  it('nimmt die Grenzwerte an', () => {
    expect(canApply(state, sched({ intervalDays: C.contractMinIntervalDays, deliveries: C.contractMinDeliveries }), ctx)).toEqual({ ok: true })
    expect(canApply(state, sched({ intervalDays: C.contractMaxIntervalDays, deliveries: C.contractMaxDeliveries }), ctx)).toEqual({ ok: true })
  })

  it('Zeitplan nur mit Rohstoffen, keine Provinzen', () => {
    const province = state.provinceOrder.find((id) => state.provinces[id]!.owner === 'p1')!
    const command = scheduled('p1', 'p2', { iron: GIVE }, { money: WANT }, { intervalDays: 2, deliveries: 3 }) as Extract<Command, { type: 'OFFER_TRADE' }>
    rejectsWith({ ...command, give: { resources: { iron: GIVE }, provinces: [province] } }, 'Zeitplan nur mit Rohstoffen')
  })

  /** Drei fremde Vertraege, die `playerId` beteiligen — ohne Bestandsbuchung. */
  function fillContracts(playerId: string, other: string): void {
    for (let i = 0; i < C.maxActiveContracts; i++) {
      state.diplomacy.contracts.push({
        id: `c${state.nextIds.contract++}`,
        from: playerId,
        to: other,
        give: { iron: 1 },
        want: { money: 1 },
        intervalTicks: DAY,
        remaining: 5,
        nextDueTick: 99_999,
        createdTick: 0,
      })
    }
  }

  it('maxActiveContracts beim Angebot: zu viele Vertraege (nur mit Zeitplan)', () => {
    fillContracts('p1', 'p3')
    rejectsWith(sched({ intervalDays: 2, deliveries: 3 }), 'zu viele Verträge')
    // Ein Einmalangebot bleibt davon unberuehrt.
    expect(canApply(state, scheduledWithout(), ctx)).toEqual({ ok: true })
  })

  const scheduledWithout = (): Command => ({
    type: 'OFFER_TRADE',
    playerId: 'p1',
    targetPlayerId: 'p2',
    give: { resources: { iron: GIVE }, provinces: [] },
    want: { resources: { money: WANT }, provinces: [] },
  })

  it('maxActiveContracts bei der Annahme: Anbieter ODER Annehmender voll', () => {
    for (const full of ['p1', 'p2']) {
      state = createInitialState(CONFIG, { map, rules })
      for (const id of state.playerOrder) for (const key of RESOURCE_KEYS) state.players[id]!.resources[key] = 0
      state.players['p1']!.resources.iron = 1_000_000
      state.players['p2']!.resources.money = 1_000_000
      expect(applyCommand(state, scheduled('p1', 'p2', { iron: GIVE }, { money: WANT }, { intervalDays: 2, deliveries: 3 }), ctx)).toEqual({ ok: true })
      const offerId = state.diplomacy.tradeOffers[0]!.id
      fillContracts(full, 'p3')
      const before = structuredClone(state)
      expect(canApply(state, accept('p2', offerId), ctx)).toEqual({ ok: false, code: 'INVALID_TARGET', detail: { reason: 'zu viele Verträge' } })
      expect(state).toEqual(before)
    }
  })

  it('Hoechstmengen je Lieferung gelten auch mit Zeitplan', () => {
    const over = scheduled('p1', 'p2', { iron: C.tradeMaxResource + 1 }, { money: WANT }, { intervalDays: 2, deliveries: 3 })
    expect(canApply(state, over, ctx)).toMatchObject({ ok: false, code: 'INVALID_TARGET', detail: { reason: 'über der Höchstmenge' } })
    const overMoney = scheduled('p1', 'p2', { iron: GIVE }, { money: C.tradeMaxMoney + 1 }, { intervalDays: 2, deliveries: 3 })
    expect(canApply(state, overMoney, ctx)).toMatchObject({ ok: false, code: 'INVALID_TARGET', detail: { reason: 'über der Höchstmenge' } })
  })

  it('der Befehl bleibt vom Zustand getrennt: schedule wird kopiert', () => {
    const command = scheduled('p1', 'p2', { iron: GIVE }, { money: WANT }, { intervalDays: 2, deliveries: 3 }) as Extract<Command, { type: 'OFFER_TRADE' }>
    expect(applyCommand(state, command, ctx)).toEqual({ ok: true })
    command.schedule!.deliveries = 99
    expect(state.diplomacy.tradeOffers[0]!.schedule).toEqual({ intervalDays: 2, deliveries: 3 })
  })
})

describe('R-DIP-04 Sicht: Dritte sehen fremde Vertraege nicht', () => {
  it('p1 und p2 sehen ihren Vertrag als Kopie, p3 sieht nichts', () => {
    startContract()
    expect(publicView(state, 'p1').contracts).toHaveLength(1)
    expect(publicView(state, 'p2').contracts).toEqual(state.diplomacy.contracts)
    expect(publicView(state, 'p3').contracts).toEqual([])
    const view = publicView(state, 'p1')
    view.contracts[0]!.give.iron = 1
    expect(state.diplomacy.contracts[0]!.give.iron).toBe(GIVE)
  })
})

describe('AK5 Wiederaufnahme mit laufendem Vertrag', () => {
  it('37 Ticks + JSON-Rundreise + Rest == am Stueck', () => {
    // Echter Ablauf ueber step(): Angebot in Tick 0, Annahme in Tick 1, Vertrag alle 1 Tag, 8 Lieferungen.
    let s = createInitialState(CONFIG, { map, rules })
    s.players['p1']!.resources.iron = 1_000_000
    s.players['p2']!.resources.money = 1_000_000
    s = step(s, [scheduled('p1', 'p2', { iron: GIVE }, { money: WANT }, { intervalDays: 1, deliveries: 8 })], { map, rules }).state
    s = step(s, [accept('p2', s.diplomacy.tradeOffers[0]!.id)], { map, rules }).state
    expect(s.diplomacy.contracts).toHaveLength(1)
    const start = s

    let whole = start
    for (let i = 0; i < 80; i++) whole = step(whole, [], { map, rules }).state

    let part = start
    for (let i = 0; i < 37; i++) part = step(part, [], { map, rules }).state
    part = deserialise(serialise(part))
    expect(part.diplomacy.contracts).toHaveLength(1)
    for (let i = 0; i < 43; i++) part = step(part, [], { map, rules }).state

    const h = (x: GameState) => hashValue(x, { omitKeys: HASH_OMIT_KEYS })
    expect(h(part)).toBe(h(whole))
    // Es wurde nach der Rundreise tatsaechlich geliefert.
    expect(whole.diplomacy.contracts[0]!.remaining, 'Lieferungen bei Tick 24, 48, 72').toBe(4)
  })
})
