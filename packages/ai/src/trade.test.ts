import {
  canApply,
  createInitialState,
  parseRules,
  publicView,
  RulesError,
  step,
  type Command,
  type GameConfig,
  type GameState,
} from '@worldwar/core'
import { RAW_DEFAULT_RULES, smallWorld, TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { emptyMemory } from './decide'
import { tradeCommands } from './economy'
import { tradeOfferCommands } from './trade'
import type { AiContext, Explanation } from './types'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const phaseCtx = { map, rules: TEST_RULES, commands: [], events: [] }
const ticksPerDay = TEST_RULES.constants.ticksPerDay

const CONFIG3: GameConfig = {
  seed: 1010,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Nord', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'hard' }, // p1
    { name: 'Ost', kind: 'human', nation: 'Ostmark', color: '#b03a2e' }, // p2
    { name: 'Sued', kind: 'ai', nation: 'Sueden', color: '#4a5d2c', difficulty: 'normal' }, // p3
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

function dreiMaechte(): GameState {
  return createInitialState(CONFIG3, ctx)
}

const contextFor = (state: GameState, id: string): AiContext => ({
  view: publicView(state, id),
  memory: state.ai[id] ?? emptyMemory(600),
  rules: TEST_RULES,
  map,
  difficulty: TEST_RULES.ai.difficulties[state.players[id]!.difficulty ?? 'normal'],
})

const allAccepted = (state: GameState, commands: Command[]) =>
  commands.forEach((c) => expect(canApply(state, c, phaseCtx), JSON.stringify(c)).toEqual({ ok: true }))

/** Ein Angebot des Menschen (p2) an die KI p3; step() wendet es an, liefert offerId. */
function offer(
  state: GameState,
  give: Record<string, number>,
  want: Record<string, number>,
  giveProvinces: string[] = [],
  wantProvinces: string[] = [],
): { state: GameState; offerId: string } {
  const r = step(
    state,
    [
      {
        type: 'OFFER_TRADE',
        playerId: 'p2',
        targetPlayerId: 'p3',
        give: { resources: give, provinces: giveProvinces },
        want: { resources: want, provinces: wantProvinces },
      },
    ],
    ctx,
  )
  const rejected = r.events.find((e) => e.type === 'COMMAND_REJECTED')
  if (rejected) throw new Error(`Angebot abgelehnt: ${JSON.stringify(rejected)}`)
  const offerId = r.state.diplomacy.tradeOffers[r.state.diplomacy.tradeOffers.length - 1]!.id
  return { state: r.state, offerId }
}

function handelsLage(): GameState {
  return dreiMaechte()
}

/** Aufstellung T10-T16: Tag 42 (Fabrik verfuegbar), p3 mit Gebaeuden und Bestand fuer die Fehlmenge. */
function bedarfsLage(): GameState {
  const state = handelsLage()
  state.tick = 42 * ticksPerDay
  for (const id of ['s1', 's2']) {
    const buildings: Record<string, number> = { barracks: 1, railway: 1, fortress: 2, harbour: 1 }
    if (id === 's1') buildings.factory = 1
    state.provinces[id]!.buildings = { ...state.provinces[id]!.buildings, ...buildings }
  }
  state.players.p3!.resources = {
    food: 9_000_000,
    wood: 100_000,
    iron: 2_000_000,
    money: 3_000_000,
    coal: 300_000,
    oil: 300_000,
    rare: 50_000,
  }
  state.players.p3!.shortages = []
  return state
}

/**
 * Handelsangebote der KI (R-DIP-05, D29.7, D29.8, T-M17-10).
 *
 * Die Zahlen zuerst (L1–L3): ohne sie ergibt jede Rechnung `NaN`, und die KI naehme nie
 * etwas an und boete nie etwas an, ohne dass ein Test das je bemerkte (rules/load.ts).
 */
describe('D29.7 Die Handelszahlen der KI stehen im Regelwerk', () => {
  it('fuehrt die vier neuen Zahlen mit den vereinbarten Werten', () => {
    expect(TEST_RULES.ai.tradeAcceptMarginPermille).toBe(1050)
    expect(TEST_RULES.ai.tradeImpactPermille).toBe(30)
    expect(TEST_RULES.ai.tradeOfferPremiumPermille).toBe(1060)
    expect(TEST_RULES.ai.tradeKeepStockPermille).toBe(500)
  })

  it('wirft ohne tradeImpactPermille', () => {
    const rest = { ...(RAW_DEFAULT_RULES.ai as Record<string, unknown>) }
    delete rest.tradeImpactPermille
    const raw = { ...RAW_DEFAULT_RULES, ai: rest }
    expect(() => parseRules(raw, 'default')).toThrow(RulesError)
    try {
      parseRules(raw, 'default')
    } catch (error) {
      expect(error).toBeInstanceOf(RulesError)
      expect((error as RulesError).message).toContain('tradeImpactPermille')
    }
  })

  it('wirft bei einer Annahmemarge unter 1000', () => {
    const raw = { ...RAW_DEFAULT_RULES, ai: { ...RAW_DEFAULT_RULES.ai, tradeAcceptMarginPermille: 900 } }
    expect(() => parseRules(raw, 'default')).toThrow(RulesError)
  })
})

describe('R-DIP-05 Die KI nimmt ein lohnendes Angebot an und lehnt den Rest begruendet ab', () => {
  it('nimmt an, wenn der Gegenwert die Marge traegt', () => {
    const base = handelsLage()
    const { state, offerId } = offer(base, { food: 100_000 }, { wood: 90_000 })
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    expect(commands.find((c) => c.type === 'ACCEPT_TRADE')).toMatchObject({ type: 'ACCEPT_TRADE', playerId: 'p3', offerId })
    const after = step(state, commands, ctx)
    expect(after.events.some((e) => e.type === 'TRADE_AGREED')).toBe(true)
  })

  it('lehnt ab unter der Marge', () => {
    const base = handelsLage()
    const { state, offerId } = offer(base, { food: 100_000 }, { wood: 97_000 })
    const explanations: Explanation[] = []
    const commands = tradeOfferCommands(contextFor(state, 'p3'), explanations, [])
    expect(commands.find((c) => c.type === 'DECLINE_TRADE')).toMatchObject({ type: 'DECLINE_TRADE', playerId: 'p3', offerId })
    const reason = explanations.find((e) => e.action.includes(offerId))?.reason ?? ''
    expect(reason).toMatch(/‰/)
  })

  it('lehnt ab bei Verhaeltnis unter der Kriegsschwelle', () => {
    const base = handelsLage()
    const { state, offerId } = offer(base, { food: 100_000 }, { wood: 90_000 })
    state.diplomacy.grievances.p3 = { p2: 900 }
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    expect(commands).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId }])
  })

  it('lehnt ab, was sie selbst knapp hat', () => {
    const base = handelsLage()
    const { state, offerId } = offer(base, { food: 100_000 }, { wood: 90_000 })
    state.players.p3!.shortages = ['wood']
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    expect(commands).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId }])
  })

  it('lehnt ab, was die Haelfte ihres Bestands antastet', () => {
    const base = handelsLage()
    const { state, offerId } = offer(base, { food: 100_000 }, { wood: 90_000 })
    state.players.p3!.resources.wood = 150_000
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    expect(commands).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId }])
  })

  // Bis T-M17-11 lehnte die KI jedes Provinzangebot ab; der Fall hielt diesen Platzhalter
  // fest und ist mit ihm gegangen.
  it('nimmt eine geschenkte Provinz an (loest den Platzhalter aus T-M17-10 ab)', () => {
    const base = handelsLage()
    base.provinces.o2!.owner = 'p2'
    const { state, offerId } = offer(base, {}, {}, ['o2'])
    const explanations: Explanation[] = []
    const commands = tradeOfferCommands(contextFor(state, 'p3'), explanations, [])
    expect(commands).toEqual([{ type: 'ACCEPT_TRADE', playerId: 'p3', offerId }])
    const reason = explanations.find((e) => e.action.includes(offerId))?.reason ?? ''
    expect(reason).toContain('Geschenk')
    const after = step(state, commands, ctx)
    expect(after.events.some((e) => e.type === 'PROVINCE_CEDED')).toBe(true)
  })

  it('lehnt ab, solange eine Kriegserklaerung laeuft', () => {
    const base = handelsLage()
    const { state, offerId } = offer(base, { food: 100_000 }, { wood: 90_000 })
    state.diplomacy.relations['p2|p3']!.warEffectiveAtTick = state.tick + 12
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    expect(commands).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId }])
  })

  it('nimmt zwei Angebote nur an, soweit der Bestand beide traegt', () => {
    const base = handelsLage()
    base.players.p3!.resources.wood = 500_000
    const first = offer(base, { food: 140_000 }, { wood: 130_000 })
    const second = offer(first.state, { food: 140_000 }, { wood: 130_000 })
    const commands = tradeOfferCommands(contextFor(second.state, 'p3'), [], [])
    const accept = commands.filter((c) => c.type === 'ACCEPT_TRADE')
    const decline = commands.filter((c) => c.type === 'DECLINE_TRADE')
    expect(accept).toHaveLength(1)
    expect(decline).toHaveLength(1)
    let cur = second.state
    for (const command of commands) {
      const r = step(cur, [command], ctx)
      expect(r.events.find((e) => e.type === 'COMMAND_REJECTED')).toBeUndefined()
      cur = r.state
    }
  })

  it('jede Antwort nennt Grund und Alternative', () => {
    const base = handelsLage()
    const { state } = offer(base, { food: 100_000 }, { wood: 90_000 })
    const explanations: Explanation[] = []
    tradeOfferCommands(contextFor(state, 'p3'), explanations, [])
    for (const e of explanations) {
      expect(e.reason.length, JSON.stringify(e)).toBeGreaterThan(0)
      expect(e.alternative?.action.length ?? 0, JSON.stringify(e)).toBeGreaterThan(0)
    }
  })
})

describe('R-DIP-05 Die KI bietet nur an, wo die Boerse den Kurs verschoebe', () => {
  it('bietet an bei Kurswirkung ueber der Schwelle', () => {
    const state = bedarfsLage()
    const explanations: Explanation[] = []
    const commands = tradeOfferCommands(contextFor(state, 'p3'), explanations, [])
    const offers = commands.filter((c) => c.type === 'OFFER_TRADE')
    expect(offers, JSON.stringify(explanations)).toHaveLength(1)
    expect(offers[0]).toMatchObject({
      type: 'OFFER_TRADE',
      playerId: 'p3',
      targetPlayerId: 'p1',
      give: { resources: { food: 152_295 }, provinces: [] },
      want: { resources: { wood: 143_674 }, provinces: [] },
    })
    allAccepted(state, commands)
  })

  it('bietet nicht an unter der Schwelle', () => {
    const state = bedarfsLage()
    state.players.p3!.resources.wood = 900_000
    const explanations: Explanation[] = []
    const commands = tradeOfferCommands(contextFor(state, 'p3'), explanations, [])
    expect(commands.filter((c) => c.type === 'OFFER_TRADE')).toHaveLength(0)
    expect(explanations.some((e) => e.action === 'Kein Handelsangebot' && /‰/.test(e.reason))).toBe(true)
  })

  it('bietet nicht doppelt fuer denselben Bedarf', () => {
    let state = bedarfsLage()
    state = step(
      state,
      [{ type: 'OFFER_TRADE', playerId: 'p3', targetPlayerId: 'p2', give: { resources: { food: 1000 }, provinces: [] }, want: { resources: { wood: 1000 }, provinces: [] } }],
      ctx,
    ).state
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    expect(commands.filter((c) => c.type === 'OFFER_TRADE')).toHaveLength(0)
  })

  it('bietet nicht bei vollem Angebotsstapel', () => {
    let state = bedarfsLage()
    for (let i = 0; i < 5; i++) {
      state = step(
        state,
        [{ type: 'OFFER_TRADE', playerId: 'p3', targetPlayerId: 'p1', give: { resources: { food: 1000 + i }, provinces: [] }, want: { resources: { iron: 1000 }, provinces: [] } }],
        ctx,
      ).state
    }
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    expect(commands.filter((c) => c.type === 'OFFER_TRADE')).toHaveLength(0)
  })

  it('bietet nur jeden dritten Spieltag', () => {
    const state = bedarfsLage()
    state.tick = 43 * ticksPerDay
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    expect(commands.filter((c) => c.type === 'OFFER_TRADE')).toHaveLength(0)
  })

  it('bietet keinem an, der unter der Kriegsschwelle steht oder den Krieg erklaert', () => {
    const state = bedarfsLage()
    state.diplomacy.grievances.p3 = { p1: 900 }
    let commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    let offerCmd = commands.find((c) => c.type === 'OFFER_TRADE')
    expect(offerCmd).toMatchObject({ targetPlayerId: 'p2' })

    state.diplomacy.relations['p2|p3']!.warEffectiveAtTick = state.tick + 12
    commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    offerCmd = commands.find((c) => c.type === 'OFFER_TRADE')
    expect(offerCmd).toBeUndefined()
  })

  it('rechnet eine im selben Zug befohlene Baustelle gegen den Bestand', () => {
    const state = bedarfsLage()
    state.players.p3!.resources.food = 300_000
    state.players.p3!.resources.money = 2_500_000
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [
      { type: 'BUILD', playerId: 'p3', provinceId: 's1', building: 'factory' },
    ])
    const offers = commands.filter((c) => c.type === 'OFFER_TRADE')
    expect(offers).toHaveLength(1)
    expect(offers[0]).toMatchObject({
      give: { resources: { money: 49_400 }, provinces: [] },
      want: { resources: { wood: 46_603 }, provinces: [] },
    })
  })

  it('die Boerse bleibt unberuehrt', () => {
    // E17: tradeCommands (die Boerse) bekommt in dieser Aufgabe keine Aenderung — dieser Test
    // haelt den heutigen Wert fest (Gegenprobe: eine Aenderung an tradeCommands faellt hier).
    const state = bedarfsLage()
    const commands = tradeCommands(contextFor(state, 'p3'), [])
    expect(commands).toEqual([{ type: 'TRADE', playerId: 'p3', give: 'food', giveAmount: 900_000, want: 'wood' }])
  })
})

describe('R-AI-09/AK4 Jede Handels-Handlung nennt Grund und Alternative', () => {
  it('sammelt Grund und Alternative aus T1, T2, T6, T10', () => {
    const cases: Explanation[] = []

    const a = handelsLage()
    const oa = offer(a, { food: 100_000 }, { wood: 90_000 })
    let ex: Explanation[] = []
    tradeOfferCommands(contextFor(oa.state, 'p3'), ex, [])
    cases.push(...ex)

    const b = handelsLage()
    const ob = offer(b, { food: 100_000 }, { wood: 97_000 })
    ex = []
    tradeOfferCommands(contextFor(ob.state, 'p3'), ex, [])
    cases.push(...ex)

    const c = handelsLage()
    c.provinces.o2!.owner = 'p2'
    const oc = offer(c, {}, {}, ['o2'])
    ex = []
    tradeOfferCommands(contextFor(oc.state, 'p3'), ex, [])
    cases.push(...ex)

    const d = bedarfsLage()
    ex = []
    tradeOfferCommands(contextFor(d, 'p3'), ex, [])
    cases.push(...ex)

    expect(cases.length).toBeGreaterThan(0)
    for (const e of cases) {
      expect(e.reason.length, JSON.stringify(e)).toBeGreaterThan(0)
      expect(e.alternative?.action.length ?? 0, JSON.stringify(e)).toBeGreaterThan(0)
    }
  })
})

describe('R-AI-01/AK1 Die Handelsbefehle bestehen die regulaere Pruefung', () => {
  it('allAccepted fuer T1, T2, T6, T7, T10', () => {
    const a = handelsLage()
    const oa = offer(a, { food: 100_000 }, { wood: 90_000 })
    allAccepted(oa.state, tradeOfferCommands(contextFor(oa.state, 'p3'), [], []))

    const b = handelsLage()
    const ob = offer(b, { food: 100_000 }, { wood: 97_000 })
    allAccepted(ob.state, tradeOfferCommands(contextFor(ob.state, 'p3'), [], []))

    const c = handelsLage()
    c.provinces.o2!.owner = 'p2'
    const oc = offer(c, {}, {}, ['o2'])
    allAccepted(oc.state, tradeOfferCommands(contextFor(oc.state, 'p3'), [], []))

    const d = handelsLage()
    const od = offer(d, { food: 100_000 }, { wood: 90_000 })
    od.state.diplomacy.relations['p2|p3']!.warEffectiveAtTick = od.state.tick + 12
    allAccepted(od.state, tradeOfferCommands(contextFor(od.state, 'p3'), [], []))

    const e = bedarfsLage()
    allAccepted(e, tradeOfferCommands(contextFor(e, 'p3'), [], []))
  })
})

describe('R-DIP-05 Kein Geschaeft im Zug einer eigenen Kriegserklaerung (Befund M17-D11)', () => {
  it('lehnt ab statt anzunehmen', () => {
    const base = handelsLage()
    const { state, offerId } = offer(base, { food: 100_000 }, { wood: 90_000 })
    const pending: Command[] = [{ type: 'DIPLOMACY', playerId: 'p3', targetPlayerId: 'p2', action: 'declareWar' }]
    const explanations: Explanation[] = []
    const commands = tradeOfferCommands(contextFor(state, 'p3'), explanations, pending)
    expect(commands).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId }])
    const reason = explanations.find((e) => e.action.includes(offerId))?.reason ?? ''
    expect(reason).toContain('Kriegserklärung in diesem Zug')
    const r = step(state, [...pending, ...commands], ctx)
    expect(r.events.find((e) => e.type === 'COMMAND_REJECTED')).toBeUndefined()
  })

  it('bietet dem Ziel nichts an', () => {
    const state = bedarfsLage()
    const pending: Command[] = [{ type: 'DIPLOMACY', playerId: 'p3', targetPlayerId: 'p1', action: 'declareWar' }]
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], pending)
    const offered = commands.find((c) => c.type === 'OFFER_TRADE')
    expect(offered).toMatchObject({ type: 'OFFER_TRADE', targetPlayerId: 'p2' })
    const r = step(state, [...pending, ...commands], ctx)
    expect(r.events.find((e) => e.type === 'COMMAND_REJECTED')).toBeUndefined()
  })

  it('ohne die Erklaerung unveraendert', () => {
    const base = handelsLage()
    const { state, offerId } = offer(base, { food: 100_000 }, { wood: 90_000 })
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    expect(commands).toEqual([{ type: 'ACCEPT_TRADE', playerId: 'p3', offerId }])

    const bedarf = bedarfsLage()
    const bedarfCommands = tradeOfferCommands(contextFor(bedarf, 'p3'), [], [])
    const offered = bedarfCommands.find((c) => c.type === 'OFFER_TRADE')
    expect(offered).toMatchObject({ type: 'OFFER_TRADE', targetPlayerId: 'p1' })
  })
})
