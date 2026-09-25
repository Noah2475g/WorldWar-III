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
  type Rules,
} from '@worldwar/core'
import { placeArmy, RAW_DEFAULT_RULES, smallWorld, TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { decide, emptyMemory } from './decide'
import { cessionProblem, explainProvinceWorth, provinceOfferCommands, provinceWorth } from './provinceValue'
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

const withAi = (patch: Partial<Rules['ai']>): Rules => ({ ...TEST_RULES, ai: { ...TEST_RULES.ai, ...patch } })
/** Ein Tag Horizont: nur so passt ein Provinzpreis unter tradeMaxMoney (Messung im Kopf des Bauplans, E1). */
const H1 = withAi({ provinceValueHorizonDays: 1 })
/** Kaufen feuert mit den ausgelieferten Zahlen nie (E8) — hier sind Aufschlag und Marge neutral. */
const KAUF = withAi({
  provinceValueHorizonDays: 1,
  provinceSalePremiumPermille: 1000,
  tradeAcceptMarginPermille: 1000,
  provinceValuePositionPermille: 0,
})
const contextFor = (state: GameState, id: string, rules: Rules = TEST_RULES): AiContext => ({
  view: publicView(state, id),
  memory: state.ai[id] ?? emptyMemory(600),
  rules,
  map,
  difficulty: rules.ai.difficulties[state.players[id]!.difficulty ?? 'normal'],
})
/** Tag 42: 42 % tradeOfferLifetimeDays (3) === 0 — der Angebotstakt. */
const angebotsTag = (state: GameState): GameState => {
  state.tick = 42 * ticksPerDay
  return state
}
const reasonFor = (explanations: Explanation[], offerId: string) => explanations.find((e) => e.action.includes(offerId))?.reason ?? ''

/**
 * Die Zahlen des Provinzhandels (R-DIP-09, D29.7, D29.8, T-M17-11). Ohne sie ergibt jede
 * Rechnung `NaN`, und die KI naehme nie eine Provinz an, ohne dass ein Test das bemerkte.
 */
describe('D29.7 Die Zahlen des Provinzhandels stehen im Regelwerk', () => {
  it('fuehrt die drei neuen Zahlen', () => {
    expect(TEST_RULES.ai.provinceValueHorizonDays).toBe(60)
    expect(TEST_RULES.ai.provinceSalePremiumPermille).toBe(1300)
    expect(TEST_RULES.ai.provinceValuePositionPermille).toBe(250)
  })

  it('wirft ohne provinceValueHorizonDays', () => {
    const rest = { ...(RAW_DEFAULT_RULES.ai as Record<string, unknown>) }
    delete rest.provinceValueHorizonDays
    const raw = { ...RAW_DEFAULT_RULES, ai: rest }
    expect(() => parseRules(raw, 'default')).toThrow(RulesError)
    try {
      parseRules(raw, 'default')
    } catch (error) {
      expect(error).toBeInstanceOf(RulesError)
      expect((error as RulesError).message).toContain('provinceValueHorizonDays')
    }
  })

  it('wirft bei einem Aufschlag unter 1000', () => {
    const raw = { ...RAW_DEFAULT_RULES, ai: { ...RAW_DEFAULT_RULES.ai, provinceSalePremiumPermille: 900 } }
    expect(() => parseRules(raw, 'default')).toThrow(RulesError)
  })

  it('wirft bei Horizont 0 und bei Lage ueber 1000', () => {
    const rawHorizon = { ...RAW_DEFAULT_RULES, ai: { ...RAW_DEFAULT_RULES.ai, provinceValueHorizonDays: 0 } }
    expect(() => parseRules(rawHorizon, 'default')).toThrow(RulesError)
    const rawLage = { ...RAW_DEFAULT_RULES, ai: { ...RAW_DEFAULT_RULES.ai, provinceValuePositionPermille: 1001 } }
    expect(() => parseRules(rawLage, 'default')).toThrow(RulesError)
  })
})

describe('R-DIP-09/AK3 Der Provinzwert kommt aus Karte, Marktpreisen und eigenem Wissen', () => {
  it('rechnet eine fremde sichtbare Provinz aus der Karte (o2)', () => {
    const worth = provinceWorth(contextFor(dreiMaechte(), 'p3'), 'o2')
    // Bevoelkerung 120.000 -> Faktor 400 -> geklemmt 500; Oel 2600 x 500/1000 = 1300 je Tick x
    // 1440 Ticks = 1.872.000 x Preis 1800 x Gewicht 1400/1000 = 4.717.440.000; Steuer
    // trunc(120) x 2 = 240 x 0,5 = 120 je Tick -> 172.800 x 1000; Lage: ein Nachbar von p3 (s2)
    // -> (4.717.440.000 + 172.800.000) x 250 x 1 / 3000.
    expect(worth).toEqual({
      provinceId: 'o2',
      deposits: 4_717_440_000,
      tax: 172_800_000,
      buildings: 0,
      position: 407_520_000,
      total: 5_297_760_000,
      largest: 'deposits',
      buildingsKnown: false,
    })
  })

  it('rechnet eigene Provinzen, Geld-Vorkommen zaehlt nicht (s1, s2)', () => {
    const context = contextFor(dreiMaechte(), 'p3')
    expect(provinceWorth(context, 's2')).toEqual({
      provinceId: 's2',
      deposits: 3_978_823_680,
      tax: 245_606_000,
      buildings: 0,
      position: 352_035_806,
      total: 4_576_465_486,
      largest: 'deposits',
      buildingsKnown: true,
    })
    // s1: nur Nahrung zaehlt, das Geld-Vorkommen (800) nicht (wie in provinceYieldScaled).
    expect(provinceWorth(context, 's1')).toEqual({
      provinceId: 's1',
      deposits: 3_888_000_000,
      tax: 2_592_000_000,
      buildings: 0,
      position: 540_000_000,
      total: 7_020_000_000,
      largest: 'deposits',
      buildingsKnown: true,
    })
  })

  it('kennt auch eine Provinz ausserhalb der Sicht (o3), und keine unbekannte', () => {
    const context = contextFor(dreiMaechte(), 'p3')
    expect(context.view.provinces.find((p) => p.id === 'o3')).toBeUndefined()
    const worth = provinceWorth(context, 'o3')
    expect(worth?.total).toBe(4_032_000_000)
    expect(worth?.position).toBe(0)
    expect(worth?.buildingsKnown).toBe(false)
    expect(provinceWorth(context, 'xx')).toBeNull()
  })

  it('aendert sich nicht, wenn sich verborgene Gebaeude einer fremden Provinz aendern (Sicht-Schnappschuss)', () => {
    const state = dreiMaechte()
    const vorher = publicView(state, 'p3')
    const contextVorher: AiContext = {
      view: vorher,
      memory: emptyMemory(600),
      rules: TEST_RULES,
      map,
      difficulty: TEST_RULES.ai.difficulties.normal,
    }
    const wo2 = provinceWorth(contextVorher, 'o2')
    const wo3 = provinceWorth(contextVorher, 'o3')

    state.provinces.o2!.buildings = { factory: 3, fortress: 5, railway: 3 }
    state.provinces.o3!.buildings = { factory: 2 }
    state.provinces.o2!.morale = 10_000
    state.provinces.o2!.targetMorale = 10_000
    state.players.p2!.resources.money = 1

    expect(publicView(state, 'p3')).toEqual(vorher)
    expect(provinceWorth(contextFor(state, 'p3'), 'o2')).toEqual(wo2)
    expect(provinceWorth(contextFor(state, 'p3'), 'o3')).toEqual(wo3)
  })

  it('rechnet eigene Gebaeude ein (Positivprobe zu W4)', () => {
    const state = dreiMaechte()
    state.provinces.s2!.buildings = { factory: 1 }
    const worth = provinceWorth(contextFor(state, 'p3'), 's2')
    expect(worth).toEqual({
      provinceId: 's2',
      deposits: 3_978_823_680,
      tax: 245_606_000,
      buildings: 3_026_839_680,
      position: 352_035_806,
      total: 7_603_305_166,
      largest: 'deposits',
      buildingsKnown: true,
    })
  })

  it('folgt den Marktpreisen', () => {
    const state = dreiMaechte()
    state.market.prices.oil = 3600
    const worth = provinceWorth(contextFor(state, 'p3'), 'o2')
    expect(worth?.deposits).toBe(9_434_880_000)
    expect(worth?.tax).toBe(172_800_000)
  })

  it('zaehlt die Lage aus Sicht des Halters', () => {
    const state = dreiMaechte()
    const fromP2 = provinceWorth(contextFor(state, 'p2'), 'o2')
    expect(fromP2?.position).toBe(815_040_000)
    expect(fromP2?.buildingsKnown).toBe(true)

    const fromP3ForP2 = provinceWorth(contextFor(state, 'p3'), 'o2', 'p2')
    expect(fromP3ForP2?.position).toBe(0)
  })

  it('haengt nicht an der Moral, auch nicht an der eigenen', () => {
    const state = dreiMaechte()
    state.provinces.s2!.morale = 30_000
    const worth = provinceWorth(contextFor(state, 'p3'), 's2')
    expect(worth).toEqual({
      provinceId: 's2',
      deposits: 3_978_823_680,
      tax: 245_606_000,
      buildings: 0,
      position: 352_035_806,
      total: 4_576_465_486,
      largest: 'deposits',
      buildingsKnown: true,
    })
  })

  it('die Erklaerung nennt Wert und groessten Anteil (AK3)', () => {
    const context = contextFor(dreiMaechte(), 'p3')
    const wo2 = provinceWorth(context, 'o2')!
    const text = explainProvinceWorth(wo2)
    expect(text).toContain('5297760')
    expect(text).toContain('größter Anteil Vorkommen')
    expect(text).toContain('Gebäude unbekannt')

    const ws2 = provinceWorth(context, 's2')!
    expect(explainProvinceWorth(ws2)).not.toContain('Gebäude unbekannt')
  })
})

describe('R-DIP-09 Die KI tritt nur ab, was der Kern abtreten liesse', () => {
  it('s2 ist abtretbar', () => {
    const context = contextFor(dreiMaechte(), 'p3')
    expect(cessionProblem(context, 's2', 'p2', [], new Set())).toBeNull()
  })

  it('nie die Hauptstadt', () => {
    const context = contextFor(dreiMaechte(), 'p3')
    expect(cessionProblem(context, 's1', 'p2', [], new Set())).toBe('Hauptstadt')
  })

  it('nie mit eigener Armee darin', () => {
    const state = dreiMaechte()
    placeArmy(state, { owner: 'p3', at: 's2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const context = contextFor(state, 'p3')
    expect(cessionProblem(context, 's2', 'p2', [], new Set())).toBe('eigene Armeen')
  })

  it('nie mit eigener Armee auf dem Weg hinein', () => {
    const state = dreiMaechte()
    const army = placeArmy(state, { owner: 'p3', at: 's1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    state.armies[army.id]!.path = ['s2']
    state.armies[army.id]!.arrivalTick = state.tick + 10
    state.armies[army.id]!.departureTick = state.tick
    const context = contextFor(state, 'p3')
    expect(cessionProblem(context, 's2', 'p2', [], new Set())).toBe('eigene Armeen')
  })

  it('nicht umkaempft', () => {
    const state = dreiMaechte()
    state.diplomacy.relations['p1|p3']!.state = 'war'
    placeArmy(state, { owner: 'p1', at: 's2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const context = contextFor(state, 'p3')
    expect(cessionProblem(context, 's2', 'p2', [], new Set())).toBe('umkämpft')
  })

  it('nicht mit fremder Armee darin', () => {
    const state = dreiMaechte()
    placeArmy(state, { owner: 'p1', at: 's2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const context = contextFor(state, 'p3')
    expect(cessionProblem(context, 's2', 'p2', [], new Set())).toBe('fremde Armeen')
    expect(cessionProblem(context, 's2', 'p1', [], new Set())).toBeNull()
  })

  it('nur eigene Provinzen', () => {
    const context = contextFor(dreiMaechte(), 'p3')
    expect(cessionProblem(context, 'o2', 'p2', [], new Set())).toBe('nicht im Besitz')
  })

  it('nichts, was derselbe Zug schon anders verplant', () => {
    const state = dreiMaechte()
    const context = contextFor(state, 'p3')

    expect(cessionProblem(context, 's2', 'p2', [{ type: 'SET_CAPITAL', playerId: 'p3', provinceId: 's2' }], new Set())).toBe('Hauptstadt')
    expect(
      cessionProblem(context, 's2', 'p2', [{ type: 'BUILD', playerId: 'p3', provinceId: 's2', building: 'barracks' }], new Set()),
    ).toBe('Auftrag in diesem Zug')
    expect(cessionProblem(context, 's2', 'p2', [], new Set(['s2']))).toBe('bereits abgetreten')

    const built = step(state, [{ type: 'BUILD', playerId: 'p3', provinceId: 's2', building: 'barracks' }], ctx)
    expect(built.events.find((e) => e.type === 'COMMAND_REJECTED')).toBeUndefined()
    expect(cessionProblem(contextFor(built.state, 'p3'), 's2', 'p2', [], new Set())).toBe('laufender Bau')
  })

  it('sagt fuer C2 bis C6 dasselbe wie der Kern', () => {
    const faelle: { aufbau: (state: GameState) => void; provinceId: string; receiver: string }[] = [
      { aufbau: () => {}, provinceId: 's1', receiver: 'p2' }, // C2 Hauptstadt
      {
        aufbau: (state) => placeArmy(state, { owner: 'p3', at: 's2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] }),
        provinceId: 's2',
        receiver: 'p2',
      }, // C3 eigene Armeen
      {
        aufbau: (state) => {
          state.diplomacy.relations['p1|p3']!.state = 'war'
          placeArmy(state, { owner: 'p1', at: 's2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
        },
        provinceId: 's2',
        receiver: 'p2',
      }, // C5 umkaempft
      {
        aufbau: (state) => placeArmy(state, { owner: 'p1', at: 's2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] }),
        provinceId: 's2',
        receiver: 'p2',
      }, // C6 fremde Armeen
    ]

    for (const fall of faelle) {
      const state = dreiMaechte()
      const { state: offered, offerId } = offer(state, { money: 1000 }, {}, [], [fall.provinceId])
      fall.aufbau(offered)
      const context = contextFor(offered, 'p3')
      const erwartet = cessionProblem(context, fall.provinceId, fall.receiver, [], new Set())
      const result = canApply(offered, { type: 'ACCEPT_TRADE', playerId: 'p3', offerId }, phaseCtx)
      expect(result.ok, JSON.stringify({ fall, result })).toBe(false)
      if (result.ok) throw new Error('unreachable')
      expect(result.code).toBe('INVALID_TARGET')
      expect(result.detail?.reason).toBe(erwartet)
    }
  })
})

describe('R-DIP-09/AK4 Die KI nimmt eine Provinz an ueber und lehnt ab unter dem Aufschlag', () => {
  it('nimmt an ab Wert mal Aufschlag', () => {
    const base = dreiMaechte()
    const wert = provinceWorth(contextFor(base, 'p3', H1), 's2')!.total
    expect(wert).toBe(76_269_830)
    const grenze = Math.ceil((wert * 1300) / 1_000_000)
    expect(grenze).toBe(99_151)

    const { state, offerId } = offer(base, { money: grenze }, {}, [], ['s2'])
    const commands = tradeOfferCommands(contextFor(state, 'p3', H1), [], [])
    expect(commands).toEqual([{ type: 'ACCEPT_TRADE', playerId: 'p3', offerId }])
    allAccepted(state, commands)
    const after = step(state, commands, ctx)
    expect(after.events.some((e) => e.type === 'PROVINCE_CEDED')).toBe(true)
    expect(after.state.provinces.s2!.owner).toBe('p2')
  })

  it('lehnt ab eins darunter', () => {
    const base = dreiMaechte()
    const wert = provinceWorth(contextFor(base, 'p3', H1), 's2')!.total
    const grenze = Math.ceil((wert * 1300) / 1_000_000)
    const { state, offerId } = offer(base, { money: grenze - 1 }, {}, [], ['s2'])
    const explanations: Explanation[] = []
    const commands = tradeOfferCommands(contextFor(state, 'p3', H1), explanations, [])
    expect(commands).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId }])
    const reason = reasonFor(explanations, offerId)
    expect(reason).toContain('‰')
    expect(reason).toContain('76269')
  })

  it('lehnt ab bei schlechtem Verhaeltnis, gleich zu welchem Preis', () => {
    const base = dreiMaechte()
    const wert = provinceWorth(contextFor(base, 'p3', H1), 's2')!.total
    const grenze = Math.ceil((wert * 1300) / 1_000_000)
    base.diplomacy.grievances.p3 = { p2: 900 }
    const { state, offerId } = offer(base, { money: grenze + 10_000 }, {}, [], ['s2'])
    const commands = tradeOfferCommands(contextFor(state, 'p3', H1), [], [])
    expect(commands).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId }])
  })

  it('kauft eine angebotene Provinz, wenn sie den Preis traegt', () => {
    const base = dreiMaechte()
    const wert = provinceWorth(contextFor(base, 'p3', H1), 'o2')!.total
    expect(wert).toBe(88_296_000)
    // o2 steht bei der Annahme auf der EMPFANGENEN Seite: nur die Annahmemarge zaehlt, nicht
    // der Abtretungsaufschlag (der gilt fuer Provinzen, die p3 GIBT).
    const grenze = Math.floor(wert / TEST_RULES.ai.tradeAcceptMarginPermille)
    expect(grenze).toBe(84_091)

    const { state, offerId } = offer(base, {}, { money: grenze }, ['o2'], [])
    const commands = tradeOfferCommands(contextFor(state, 'p3', H1), [], [])
    expect(commands).toEqual([{ type: 'ACCEPT_TRADE', playerId: 'p3', offerId }])
    allAccepted(state, commands)

    // Ein Y darueber ist fuer p3 ungünstiger (sie zahlt mehr) -> lehnt ab.
    const { state: stateZuViel, offerId: offerIdZuViel } = offer(base, {}, { money: grenze + 1 }, ['o2'], [])
    const declined = tradeOfferCommands(contextFor(stateZuViel, 'p3', H1), [], [])
    expect(declined).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId: offerIdZuViel }])
  })

  it('die Erklaerung der Annahme nennt Wert und groessten Anteil', () => {
    const base = dreiMaechte()
    const wert = provinceWorth(contextFor(base, 'p3', H1), 's2')!.total
    const grenze = Math.ceil((wert * 1300) / 1_000_000)
    const { state, offerId } = offer(base, { money: grenze }, {}, [], ['s2'])
    const explanations: Explanation[] = []
    tradeOfferCommands(contextFor(state, 'p3', H1), explanations, [])
    const reason = reasonFor(explanations, offerId)
    expect(reason).toContain('76269')
    expect(reason).toContain('größter Anteil Vorkommen')
  })

  it('bei 60 Tagen reicht die Hoechstmenge nicht (Befund M17-D12)', () => {
    const base = dreiMaechte()
    const { state, offerId } = offer(base, { money: TEST_RULES.constants.tradeMaxMoney }, {}, [], ['s2'])
    const commands = tradeOfferCommands(contextFor(state, 'p3'), [], [])
    expect(commands).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId }])
  })

  it('nie die Hauptstadt, nie mit eigener Armee', () => {
    const base = dreiMaechte()
    const { state: s1State, offerId: s1OfferId } = offer(base, { money: TEST_RULES.constants.tradeMaxMoney }, {}, [], ['s1'])
    const explanations1: Explanation[] = []
    const commands1 = tradeOfferCommands(contextFor(s1State, 'p3', H1), explanations1, [])
    expect(commands1).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId: s1OfferId }])
    allAccepted(s1State, commands1)
    expect(reasonFor(explanations1, s1OfferId)).toContain('Hauptstadt')

    const wert = provinceWorth(contextFor(base, 'p3', H1), 's2')!.total
    const grenze = Math.ceil((wert * 1300) / 1_000_000)
    const { state: s2State, offerId: s2OfferId } = offer(base, { money: grenze + 1000 }, {}, [], ['s2'])
    placeArmy(s2State, { owner: 'p3', at: 's2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const explanations2: Explanation[] = []
    const commands2 = tradeOfferCommands(contextFor(s2State, 'p3', H1), explanations2, [])
    expect(commands2).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId: s2OfferId }])
    allAccepted(s2State, commands2)
    expect(reasonFor(explanations2, s2OfferId)).toContain('eigene Armeen')
  })

  it('zwei Angebote um dieselbe Provinz: nur eines', () => {
    const base = dreiMaechte()
    const wert = provinceWorth(contextFor(base, 'p3', H1), 's2')!.total
    const grenze = Math.ceil((wert * 1300) / 1_000_000)
    const first = offer(base, { money: grenze }, {}, [], ['s2'])
    const second = offer(first.state, { money: grenze }, {}, [], ['s2'])
    const commands = tradeOfferCommands(contextFor(second.state, 'p3', H1), [], [])
    expect(commands.filter((c) => c.type === 'ACCEPT_TRADE')).toHaveLength(1)
    const declined = commands.filter((c) => c.type === 'DECLINE_TRADE')
    expect(declined).toHaveLength(1)
    // Beide Befehle in EINEM step (wie im echten Zug): getrennt angewandt schliesst die
    // Diplomatiephase des ersten Tick das zweite, jetzt hinfaellige Angebot schon selbst
    // (settleTradeOffers) — die zweite DECLINE_TRADE faende dann kein Angebot mehr vor.
    const applied = step(second.state, commands, ctx)
    expect(applied.events.find((e) => e.type === 'COMMAND_REJECTED')).toBeUndefined()
    expect(applied.state.provinces.s2!.owner).toBe('p2')

    const gift1 = offer(base, {}, {}, ['o2'], [])
    const gift2 = offer(gift1.state, {}, {}, ['o2'], [])
    const giftCommands = tradeOfferCommands(contextFor(gift2.state, 'p3', H1), [], [])
    expect(giftCommands.filter((c) => c.type === 'ACCEPT_TRADE')).toHaveLength(1)
  })

  it('keine Abtretung einer Provinz, die derselbe Zug bebaut', () => {
    const base = dreiMaechte()
    const { state, offerId } = offer(base, { money: TEST_RULES.constants.tradeMaxMoney }, {}, [], ['s2'])
    const explanations: Explanation[] = []
    const commands = tradeOfferCommands(contextFor(state, 'p3', H1), explanations, [
      { type: 'BUILD', playerId: 'p3', provinceId: 's2', building: 'barracks' },
    ])
    expect(commands).toEqual([{ type: 'DECLINE_TRADE', playerId: 'p3', offerId }])
    expect(reasonFor(explanations, offerId)).toContain('Auftrag in diesem Zug')
  })
})

describe('R-DIP-09 Aktiver Provinzhandel wird gebaut, aber nur gezaehlt (T-M17-15)', () => {
  it('verkauft bei Geldmangel die billigste abtretbare Provinz an einen Nachbarn', () => {
    const state = angebotsTag(dreiMaechte())
    state.players.p3!.shortages = ['money']
    const explanations: Explanation[] = []
    const commands = provinceOfferCommands(contextFor(state, 'p3', H1), explanations, [])
    expect(commands).toEqual([
      {
        type: 'OFFER_TRADE',
        playerId: 'p3',
        targetPlayerId: 'p2',
        give: { resources: {}, provinces: ['s2'] },
        want: { resources: { money: 99_151 }, provinces: [] },
      },
    ])
    allAccepted(state, commands)
  })

  it('verkauft nicht, wenn der Preis ueber der Hoechstmenge laege', () => {
    const state = angebotsTag(dreiMaechte())
    state.players.p3!.shortages = ['money']
    const explanations: Explanation[] = []
    const commands = provinceOfferCommands(contextFor(state, 'p3'), explanations, [])
    expect(commands).toEqual([])
    const fund = explanations.find((e) => e.action === 'Kein Provinzverkauf')
    expect(fund?.reason).toContain('Höchstmenge')
  })

  it('verkauft nicht ohne Geldmangel', () => {
    const state = angebotsTag(dreiMaechte())
    state.players.p3!.shortages = []
    const commands = provinceOfferCommands(contextFor(state, 'p3', H1), [], [])
    expect(commands.some((c) => c.type === 'OFFER_TRADE' && c.give.provinces.length > 0)).toBe(false)
  })

  it('verkauft weder Hauptstadt noch eine Provinz mit eigener Armee', () => {
    const state = angebotsTag(dreiMaechte())
    state.players.p3!.shortages = ['money']
    placeArmy(state, { owner: 'p3', at: 's2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const explanations: Explanation[] = []
    const commands = provinceOfferCommands(contextFor(state, 'p3', H1), explanations, [])
    expect(commands).toEqual([])
    const fund = explanations.find((e) => e.action === 'Kein Provinzverkauf')
    expect(fund?.reason).toContain('keine abtretbare Provinz')
  })

  it('verkauft an niemanden unter der Vertrauensschwelle', () => {
    const state = angebotsTag(dreiMaechte())
    state.players.p3!.shortages = ['money']
    state.diplomacy.grievances.p3 = { p2: 900 }
    const explanations: Explanation[] = []
    const commands = provinceOfferCommands(contextFor(state, 'p3', H1), explanations, [])
    expect(commands).toEqual([])
    const fund = explanations.find((e) => e.action === 'Kein Provinzverkauf')
    expect(fund?.reason).toContain('kein Käufer')
  })

  it('nur am Angebotstag und nur ein offenes Provinzangebot', () => {
    const state = dreiMaechte()
    state.tick = 43 * ticksPerDay
    state.players.p3!.shortages = ['money']
    const commands = provinceOfferCommands(contextFor(state, 'p3', H1), [], [])
    expect(commands).toEqual([])

    const angebot = angebotsTag(dreiMaechte())
    angebot.players.p3!.shortages = ['money']
    const erst = provinceOfferCommands(contextFor(angebot, 'p3', H1), [], [])
    const nachStep = step(angebot, erst, ctx)
    const danach = provinceOfferCommands(contextFor(nachStep.state, 'p3', H1), [], [])
    expect(danach).toEqual([])
  })

  it('kauft, wenn der geschaetzte Preis unter dem eigenen Wert liegt', () => {
    const state = angebotsTag(dreiMaechte())
    state.players.p3!.shortages = []
    const commands = provinceOfferCommands(contextFor(state, 'p3', KAUF), [], [])
    expect(commands).toEqual([
      {
        type: 'OFFER_TRADE',
        playerId: 'p3',
        targetPlayerId: 'p2',
        give: { resources: { money: 81_504 }, provinces: [] },
        want: { resources: {}, provinces: ['o2'] },
      },
    ])
    allAccepted(state, commands)
  })

  it('kauft mit den ausgelieferten Zahlen nie (E8)', () => {
    const stateTest = angebotsTag(dreiMaechte())
    stateTest.players.p3!.shortages = []
    const commandsTest = provinceOfferCommands(contextFor(stateTest, 'p3'), [], [])
    expect(commandsTest.some((c) => c.type === 'OFFER_TRADE' && c.want.provinces.length > 0)).toBe(false)

    const stateH1 = angebotsTag(dreiMaechte())
    stateH1.players.p3!.shortages = []
    const commandsH1 = provinceOfferCommands(contextFor(stateH1, 'p3', H1), [], [])
    expect(commandsH1.some((c) => c.type === 'OFFER_TRADE' && c.want.provinces.length > 0)).toBe(false)
  })

  it('verlangt nie die Start-Hauptstadt des Besitzers', () => {
    const state = angebotsTag(dreiMaechte())
    state.players.p3!.shortages = []
    state.provinces.m1!.owner = 'p3'
    state.diplomacy.grievances.p3 = { p1: 900 }
    state.provinces.o3!.owner = 'p1'
    placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    expect(publicView(state, 'p3').provinces.find((p) => p.id === 'o1')).toBeDefined()
    const commands = provinceOfferCommands(contextFor(state, 'p3', KAUF), [], [])
    expect(commands).toEqual([])
  })

  it('kauft nicht ueber den verfuegbaren Bestand', () => {
    const state = angebotsTag(dreiMaechte())
    state.players.p3!.shortages = []
    state.players.p3!.resources.money = 100_000
    const commands = provinceOfferCommands(contextFor(state, 'p3', KAUF), [], [])
    expect(commands).toEqual([])
  })

  it('bietet keine Provinz an, die derselbe Zug schon abtritt', () => {
    const base = angebotsTag(dreiMaechte())
    base.players.p3!.shortages = ['money']
    const wert = provinceWorth(contextFor(base, 'p3', H1), 's2')!.total
    const grenze = Math.ceil((wert * 1300) / 1_000_000)
    const { state } = offer(base, { money: grenze }, {}, [], ['s2'])
    const pending = tradeOfferCommands(contextFor(state, 'p3', H1), [], [])
    expect(pending.some((c) => c.type === 'ACCEPT_TRADE')).toBe(true)
    const commands = provinceOfferCommands(contextFor(state, 'p3', H1), [], pending)
    expect(commands.some((c) => c.type === 'OFFER_TRADE' && c.give.provinces.includes('s2'))).toBe(false)
  })

  it('im Zug einer eigenen Kriegserklaerung kein Geschaeft mit dem Ziel (M17-D11)', () => {
    const state = angebotsTag(dreiMaechte())
    state.players.p3!.shortages = ['money']
    const pending: Command[] = [{ type: 'DIPLOMACY', playerId: 'p3', targetPlayerId: 'p2', action: 'declareWar' }]
    const commands = provinceOfferCommands(contextFor(state, 'p3', H1), [], pending)
    expect(commands.some((c) => c.type === 'OFFER_TRADE' && c.targetPlayerId === 'p2')).toBe(false)
  })

  it('decide ruft den Provinzhandel im Strategietakt', () => {
    const state = angebotsTag(dreiMaechte())
    state.players.p3!.shortages = ['money']
    state.players.p3!.resources.money = 0
    const decision = decide({
      view: publicView(state, 'p3'),
      memory: emptyMemory(600),
      rules: H1,
      map,
      difficulty: H1.ai.difficulties.normal,
      explain: true,
    })
    const verkauft = decision.commands.some((c) => c.type === 'OFFER_TRADE' && c.give.provinces.includes('s2'))
    expect(verkauft, JSON.stringify(decision.commands)).toBe(true)
  })
})

describe('R-AI-09/AK4 Jede Provinzhandlung nennt Grund und Alternative', () => {
  it('sammelt Grund und Alternative aus A1, A2, A7, K1, K2, K7', () => {
    const explanations: Explanation[] = []

    const a1 = dreiMaechte()
    const wertA1 = provinceWorth(contextFor(a1, 'p3', H1), 's2')!.total
    const grenzeA1 = Math.ceil((wertA1 * 1300) / 1_000_000)
    const offerA1 = offer(a1, { money: grenzeA1 }, {}, [], ['s2'])
    tradeOfferCommands(contextFor(offerA1.state, 'p3', H1), explanations, [])

    const a2 = dreiMaechte()
    const offerA2 = offer(a2, { money: grenzeA1 - 1 }, {}, [], ['s2'])
    tradeOfferCommands(contextFor(offerA2.state, 'p3', H1), explanations, [])

    const a7 = dreiMaechte()
    const offerA7 = offer(a7, { money: TEST_RULES.constants.tradeMaxMoney }, {}, [], ['s1'])
    tradeOfferCommands(contextFor(offerA7.state, 'p3', H1), explanations, [])

    const k1 = angebotsTag(dreiMaechte())
    k1.players.p3!.shortages = ['money']
    provinceOfferCommands(contextFor(k1, 'p3', H1), explanations, [])

    const k2 = angebotsTag(dreiMaechte())
    k2.players.p3!.shortages = ['money']
    provinceOfferCommands(contextFor(k2, 'p3'), explanations, [])

    const k7 = angebotsTag(dreiMaechte())
    k7.players.p3!.shortages = []
    provinceOfferCommands(contextFor(k7, 'p3', KAUF), explanations, [])

    expect(explanations.length).toBeGreaterThan(0)
    for (const e of explanations) {
      expect(e.reason.length, JSON.stringify(e)).toBeGreaterThan(0)
      expect(e.alternative?.action.length ?? 0, JSON.stringify(e)).toBeGreaterThan(0)
    }
  })
})

describe('R-AI-01/AK1 Die Provinzbefehle bestehen die regulaere Pruefung', () => {
  it('allAccepted fuer A1, A4, A7, K1, K7', () => {
    const a1 = dreiMaechte()
    const wertA1 = provinceWorth(contextFor(a1, 'p3', H1), 's2')!.total
    const grenzeA1 = Math.ceil((wertA1 * 1300) / 1_000_000)
    const offerA1 = offer(a1, { money: grenzeA1 }, {}, [], ['s2'])
    allAccepted(offerA1.state, tradeOfferCommands(contextFor(offerA1.state, 'p3', H1), [], []))

    const a4 = dreiMaechte()
    const wertA4 = provinceWorth(contextFor(a4, 'p3', H1), 'o2')!.total
    const grenzeA4 = Math.floor(wertA4 / TEST_RULES.ai.tradeAcceptMarginPermille)
    const offerA4 = offer(a4, {}, { money: grenzeA4 }, ['o2'], [])
    allAccepted(offerA4.state, tradeOfferCommands(contextFor(offerA4.state, 'p3', H1), [], []))

    const a7 = dreiMaechte()
    const offerA7 = offer(a7, { money: TEST_RULES.constants.tradeMaxMoney }, {}, [], ['s1'])
    allAccepted(offerA7.state, tradeOfferCommands(contextFor(offerA7.state, 'p3', H1), [], []))

    const k1 = angebotsTag(dreiMaechte())
    k1.players.p3!.shortages = ['money']
    allAccepted(k1, provinceOfferCommands(contextFor(k1, 'p3', H1), [], []))

    const k7 = angebotsTag(dreiMaechte())
    k7.players.p3!.shortages = []
    allAccepted(k7, provinceOfferCommands(contextFor(k7, 'p3', KAUF), [], []))
  })
})
