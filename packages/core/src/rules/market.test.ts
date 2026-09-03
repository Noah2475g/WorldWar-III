import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Command } from '../commands/types'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'
import { createMarket, exchangeAmount, settleMarket } from './market'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 41,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const trade = (playerId: string, give: string, giveAmount: number, want: string): Command =>
  ({ type: 'TRADE', playerId, give, giveAmount, want }) as Command

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
})

describe('R-ECON-05 Umtausch zu Marktpreisen', () => {
  it('startet mit den Preisen aus dem Regelwerk', () => {
    for (const [key, rule] of Object.entries(TEST_RULES.resources)) {
      expect(state.market.prices[key as keyof typeof state.market.prices]).toBe(rule.basePrice)
    }
  })

  it('rechnet den Gegenwert ueber beide Preise', () => {
    const market = createMarket(TEST_RULES)
    // Iron costs 1400, food 1000: a ton of iron buys 1.4 tons of food.
    expect(exchangeAmount(market, 'iron', 100_000, 'food')).toBe(140_000)
    expect(exchangeAmount(market, 'food', 140_000, 'iron')).toBe(100_000)
  })

  it('fuehrt einen Tausch aus und meldet ihn', () => {
    const foodBefore = state.players['p1']!.resources.food
    const ironBefore = state.players['p1']!.resources.iron

    const result = step(state, [trade('p1', 'iron', 100_000, 'food')], ctx)
    const player = result.state.players['p1']!

    expect(player.resources.iron).toBeLessThan(ironBefore)
    expect(player.resources.food).toBeGreaterThan(foodBefore)
    expect(result.events.find((e) => e.type === 'TRADE_EXECUTED')).toMatchObject({
      give: 'iron',
      want: 'food',
      audience: ['p1'],
    })
  })

  it('weist Taeusche ohne Deckung ab', () => {
    state.players['p1']!.resources.rare = 0
    const result = step(state, [trade('p1', 'rare', 100_000, 'food')], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'INSUFFICIENT_RESOURCES',
    })
  })

  it('weist sinnlose Taeusche ab', () => {
    const same = step(state, [trade('p1', 'food', 100_000, 'food')], ctx)
    expect(same.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'INVALID_TARGET' })

    const tiny = step(state, [trade('p1', 'food', 5, 'iron')], ctx)
    expect(tiny.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'INVALID_TARGET' })
  })
})

describe('R-FREE-02 Der Markt bevorzugt niemanden', () => {
  it('gibt beiden Spielern im selben Tick denselben Kurs', () => {
    // The price is frozen for the tick. Without that, the first player in turn order
    // would structurally buy cheaper — which is exactly the advantage the original
    // sells for money and we refuse to sell at all.
    const result = step(
      state,
      [trade('p2', 'iron', 100_000, 'food'), trade('p1', 'iron', 100_000, 'food')],
      ctx,
    )

    // Read the trades themselves, not the stocks: both nations also produce food,
    // and at different rates.
    const trades = result.events.filter((event) => event.type === 'TRADE_EXECUTED')
    expect(trades).toHaveLength(2)
    const amounts = trades.map((event) => (event as { wantAmount: number }).wantAmount)
    expect(amounts[0]).toBe(amounts[1])
  })

  it('bewegt den Preis erst nach dem Tick', () => {
    const priceBefore = state.market.prices.food
    const after = step(state, [trade('p1', 'iron', 200_000, 'food')], ctx).state
    expect(after.market.prices.food).not.toBe(priceBefore)
  })
})

describe('R-ECON-05 Preisbildung', () => {
  it('hebt den Preis bei Nachfrage und senkt ihn bei Angebot', () => {
    const market = createMarket(TEST_RULES)
    const base = market.prices.food

    market.tickDemand.food = 5_000_000 // heavy buying
    settleMarket(market, TEST_RULES, false)
    expect(market.prices.food).toBeGreaterThan(base)

    const raised = market.prices.food
    market.tickDemand.food = -5_000_000 // heavy selling
    settleMarket(market, TEST_RULES, false)
    expect(market.prices.food).toBeLessThan(raised)
  })

  it('laesst den Preis taeglich zum Grundwert zurueckwandern', () => {
    // Nobody can corner a resource forever.
    const market = createMarket(TEST_RULES)
    market.prices.oil = 4000
    const start = market.prices.oil

    for (let day = 0; day < 20; day++) settleMarket(market, TEST_RULES, true)

    expect(market.prices.oil).toBeLessThan(start)
    expect(market.prices.oil).toBeGreaterThan(TEST_RULES.resources.oil.basePrice)
  })

  it('haelt den Preis zwischen Unter- und Obergrenze', () => {
    const market = createMarket(TEST_RULES)
    for (let i = 0; i < 50; i++) {
      market.tickDemand.rare = 50_000_000
      settleMarket(market, TEST_RULES, false)
    }
    expect(market.prices.rare).toBeLessThanOrEqual(TEST_RULES.constants.marketMaxPrice)

    for (let i = 0; i < 200; i++) {
      market.tickDemand.rare = -50_000_000
      settleMarket(market, TEST_RULES, false)
    }
    expect(market.prices.rare).toBeGreaterThanOrEqual(TEST_RULES.constants.marketMinPrice)
  })

  it('setzt die Tagesnachfrage nach der Abrechnung zurueck', () => {
    const market = createMarket(TEST_RULES)
    market.tickDemand.coal = 1_000_000
    settleMarket(market, TEST_RULES, false)
    expect(market.tickDemand.coal).toBe(0)
  })
})
