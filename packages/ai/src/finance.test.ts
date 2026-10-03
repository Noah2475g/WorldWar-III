import { describe, expect, it } from 'vitest'
import { createInitialState, economyOverview, publicView, spySalary, type GameConfig, type GameState, type SpyMission } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import {
  dailyArmyMoneyUpkeep,
  dailyArmyUpkeep,
  dailyMoneyIncome,
  dailyMoneyLedger,
  dailyOilYield,
  dailySpySalary,
  unitsWithinDailyBalance,
  unitsWithinStockHorizon,
} from './finance'

/**
 * T-M42-03 (D32.2, D32.4): Finanzen der KI aus der Sicht.
 *
 * F1-F3 sind woertlich aus `espionage.test.ts` umgezogen (Block "Finanzen aus der Sicht, Zwilling
 * zu economyOverview") — `dailyMoneyIncome`/`dailyArmyMoneyUpkeep` sind Zeichen fuer Zeichen aus
 * `espionage.ts` nach `finance.ts` gezogen (D32.2); dieser Test haelt die Gleichheit weiter.
 */

const map = smallWorld()
const ME = 'p2'
const CONFIG: GameConfig = {
  seed: 1812,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Feind', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'normal' },
    { name: 'Ich', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'Nachbar', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

interface Lage {
  spione?: { id?: string; provinceId: string; mission: SpyMission }[]
  mutate?: (state: GameState) => void
}

function lage(o: Lage = {}) {
  const rules = TEST_RULES
  const state = createInitialState(CONFIG, { map, rules })
  state.tick = 10 * 24 + 5
  state.nextIds.spy = 101
  for (const s of o.spione ?? []) {
    state.espionage.spies.push({
      id: s.id ?? `s${state.nextIds.spy++}`,
      owner: ME,
      provinceId: s.provinceId,
      mission: s.mission,
      recruitedTick: 0,
      assignedTick: 0,
      lastRunTick: null,
      lastOutcome: null,
    })
  }
  o.mutate?.(state)
  const view = publicView(state, ME)
  return { state, rules, view }
}

describe('F1-F2 dailyMoneyIncome ist der Ertrag der Wirtschaftsuebersicht (umgezogen)', () => {
  it('mit Moral, Besatzung und Hauptstadtverlust', () => {
    const l = lage({
      mutate: (s) => {
        s.provinces['o2']!.morale = 43_210
        s.provinces['o3']!.occupiedSince = s.tick - 50
        s.players[ME]!.capitalLostUntil = s.tick + 100
      },
    })
    for (const p of l.state.playerOrder) {
      const view = publicView(l.state, p)
      expect(dailyMoneyIncome(view, l.rules)).toBe(economyOverview(l.state, p, l.rules).money.production)
    }
  })

  it('ohne Hauptstadtverlust und ohne Besatzung ebenso', () => {
    const l = lage()
    for (const p of l.state.playerOrder) {
      const view = publicView(l.state, p)
      expect(dailyMoneyIncome(view, l.rules)).toBe(economyOverview(l.state, p, l.rules).money.production)
    }
  })
})

describe('F3-F4 dailyArmyMoneyUpkeep und dailySpySalary (umgezogen, F4 neu)', () => {
  it('F3: der Armeeunterhalt aus der Sicht ist der der Uebersicht, ohne Spione', () => {
    const l = lage({
      mutate: (s) => {
        placeArmy(s, {
          owner: ME,
          at: 'o1',
          units: [
            { unitKey: 'infantry', hpTotal: 12_345 },
            { unitKey: 'tank', hpTotal: 5_201 },
          ],
        })
      },
    })
    const view = publicView(l.state, ME)
    const upkeep = dailyArmyMoneyUpkeep(view, l.rules)
    expect(upkeep).toBe(economyOverview(l.state, ME, l.rules).money.consumption)
    expect(upkeep).toBeGreaterThan(0)
  })

  it('F4: mit zwei eigenen Spionen zaehlt der Sold in die Uebersicht mit', () => {
    const l = lage({
      spione: [
        { id: 'sc', provinceId: 'o1', mission: 'counter' },
        { id: 'si', provinceId: 'o1', mission: 'intel' },
      ],
      mutate: (s) => {
        placeArmy(s, {
          owner: ME,
          at: 'o1',
          units: [
            { unitKey: 'infantry', hpTotal: 12_345 },
            { unitKey: 'tank', hpTotal: 5_201 },
          ],
        })
      },
    })
    const view = publicView(l.state, ME)
    const upkeep = dailyArmyMoneyUpkeep(view, l.rules)
    const sold = dailySpySalary(view, l.rules)
    expect(upkeep + sold).toBe(economyOverview(l.state, ME, l.rules).money.consumption)
    expect(sold).toBe(spySalary(l.rules.constants, 'counter') + spySalary(l.rules.constants, 'intel'))
  })
})

describe('F5 dailyMoneyLedger ist die Bilanz der Uebersicht, ohne Aushebungs-Warteschlange', () => {
  it('eine Aushebung in der Warteschlange aendert die Bilanz nicht', () => {
    const l = lage({
      spione: [
        { id: 'sc', provinceId: 'o1', mission: 'counter' },
        { id: 'si', provinceId: 'o1', mission: 'intel' },
      ],
      mutate: (s) => {
        placeArmy(s, {
          owner: ME,
          at: 'o1',
          units: [
            { unitKey: 'infantry', hpTotal: 12_345 },
            { unitKey: 'tank', hpTotal: 5_201 },
          ],
        })
        s.provinces['o1']!.recruitQueue.push({
          id: 'q1',
          unitKey: 'infantry',
          count: 5,
          startedTick: s.tick,
          completesAtTick: s.tick + 12,
          ownerAtStart: ME,
        })
      },
    })
    const view = publicView(l.state, ME)
    const ledger = dailyMoneyLedger(view, l.rules)
    const overview = economyOverview(l.state, ME, l.rules)
    expect(ledger.margin).toBe(overview.money.balance)
    expect(ledger.income).toBe(overview.money.production)
    expect(ledger.upkeep + ledger.salary).toBe(overview.money.consumption)
  })
})

describe('F6 eine ausgeschiedene Macht denkt nicht mehr ueber Geld nach', () => {
  it('dailySpySalary und dailyMoneyIncome sind 0, wie economyOverview', () => {
    const l = lage({
      spione: [{ id: 'sc', provinceId: 'o1', mission: 'intel' }],
      mutate: (s) => {
        s.players[ME]!.alive = false
      },
    })
    const view = publicView(l.state, ME)
    expect(dailySpySalary(view, l.rules)).toBe(0)
    expect(dailyMoneyIncome(view, l.rules)).toBe(0)
    // dailyArmyMoneyUpkeep prueft `alive` nicht (alter Zwilling, verhaltensgleich umgezogen) —
    // die KI denkt als Ausgeschiedene ohnehin nie (runner.ts), F6 prueft deshalb nur Sold und Ertrag.
    const overview = economyOverview(l.state, ME, l.rules)
    expect(dailyMoneyIncome(view, l.rules)).toBe(overview.money.production)
  })
})

describe('F7-F8 unitsWithinDailyBalance, wörtlich aus tasks.yaml und den Grenzen (D32.4)', () => {
  it('F7: die zwei Beispiele aus tasks.yaml', () => {
    expect(unitsWithinDailyBalance(10_000 - 9_000, 1_440)).toBe(0)
    expect(unitsWithinDailyBalance(20_000 - 9_000, 1_440)).toBe(7)
  })

  it('F8: die Grenzen — bilanz(n) = 0 ist zulaessig, negative Bilanz traegt nichts, jeEinheit <= 0 traegt alles', () => {
    expect(unitsWithinDailyBalance(1_440, 1_440)).toBe(1)
    expect(unitsWithinDailyBalance(1_439, 1_440)).toBe(0)
    expect(unitsWithinDailyBalance(-5_000, 1_440)).toBe(0)
    expect(unitsWithinDailyBalance(0, 1_440)).toBe(0)
    expect(unitsWithinDailyBalance(123, 0)).toBe(Number.MAX_SAFE_INTEGER)
  })
})

/**
 * T-M42-07 (D32.2, R-AI-12/AK4): der Foerderungs-Zwilling fuer den Oel-Waechter.
 *
 * `dailyOilYield` ist die Foerderformel des Kerns (`provinceYieldScaled`) auf der Sicht, mit
 * Gebaeudefaktor; `dailyArmyUpkeep(view, rules, resource)` der Unterhalt je Rohstoff. Beide werden
 * gegen `economyOverview` gleich gehalten - aendert sich die Formel im Kern, faellt dieser Block.
 */
describe('F9-F11 dailyOilYield und dailyArmyUpkeep sind die Oel-Zahlen der Wirtschaftsuebersicht', () => {
  it('F9: Foerderung mit Fabrik, Moral, Besatzung und Hauptstadtverlust', () => {
    const l = lage({
      mutate: (s) => {
        s.provinces['o2']!.buildings = { ...s.provinces['o2']!.buildings, factory: 2 }
        s.provinces['o2']!.morale = 61_234
        s.provinces['o2']!.occupiedSince = s.tick - 37
        s.provinces['o1']!.deposits = { ...s.provinces['o1']!.deposits, oil: 333 }
        s.players[ME]!.capitalLostUntil = s.tick + 100
      },
    })
    for (const p of l.state.playerOrder) {
      const view = publicView(l.state, p)
      expect(dailyOilYield(view, l.rules), p).toBe(economyOverview(l.state, p, l.rules).oil.production)
    }
    expect(dailyOilYield(publicView(l.state, ME), l.rules), 'die Lage foerdert Oel').toBeGreaterThan(0)
  })

  it('F10: ohne Gebaeude, Besatzung und Hauptstadtverlust ebenso; eine Macht ohne Oel foerdert 0', () => {
    const l = lage()
    for (const p of l.state.playerOrder) {
      const view = publicView(l.state, p)
      expect(dailyOilYield(view, l.rules), p).toBe(economyOverview(l.state, p, l.rules).oil.production)
    }
    expect(dailyOilYield(publicView(l.state, 'p1'), l.rules)).toBe(0)
  })

  it('F11: der Oelunterhalt aller eigenen Armeen ist der Verbrauch der Uebersicht; Geld bleibt der alte Zwilling', () => {
    const l = lage({
      mutate: (s) => {
        placeArmy(s, {
          owner: ME,
          at: 'o1',
          units: [
            { unitKey: 'infantry', hpTotal: 12_345 },
            { unitKey: 'tank', hpTotal: 5_201 },
            { unitKey: 'artillery', hpTotal: 2_801 },
          ],
        })
      },
    })
    const view = publicView(l.state, ME)
    const overview = economyOverview(l.state, ME, l.rules)
    expect(dailyArmyUpkeep(view, l.rules, 'oil')).toBe(overview.oil.consumption)
    expect(dailyArmyUpkeep(view, l.rules, 'oil')).toBeGreaterThan(0)
    expect(dailyArmyUpkeep(view, l.rules, 'iron')).toBe(overview.iron.consumption)
    expect(dailyArmyUpkeep(view, l.rules, 'money')).toBe(dailyArmyMoneyUpkeep(view, l.rules))
  })

  it('F12: eine ausgeschiedene Macht foerdert kein Oel, wie economyOverview', () => {
    const l = lage({ mutate: (s) => (s.players[ME]!.alive = false) })
    expect(dailyOilYield(publicView(l.state, ME), l.rules)).toBe(economyOverview(l.state, ME, l.rules).oil.production)
  })
})

describe('F13 unitsWithinStockHorizon - der Vorrats-Horizont des Oel-Waechters (T-M42-14, R-AI-12/AK4)', () => {
  it('ohne Vorrat gilt die Tagesbilanz', () => {
    expect(unitsWithinStockHorizon(0, 2_880, 1_440, 30)).toBe(unitsWithinDailyBalance(2_880, 1_440))
  })
  it('ohne Foerderung traegt der Vorrat so viele Einheiten, wie er ueber den Horizont speist', () => {
    expect(unitsWithinStockHorizon(30 * 1_440 * 3, 0, 1_440, 30)).toBe(3)
    expect(unitsWithinStockHorizon(30 * 1_440 * 3 - 1, 0, 1_440, 30)).toBe(2)
  })
  it('ein bestehendes Defizit zehrt den Vorrat zuerst auf', () => {
    // Defizit 1 000 je Tag ueber 30 Tage = 30 000; der Rest traegt eine Einheit zu 1 440.
    expect(unitsWithinStockHorizon(30_000 + 43_200, -1_000, 1_440, 30)).toBe(1)
    expect(unitsWithinStockHorizon(29_999, -1_000, 1_440, 30)).toBe(0)
  })
  it('ein negativer Bestand zaehlt als leer, kein Unterhalt heisst keine Grenze', () => {
    expect(unitsWithinStockHorizon(-5_000, 1_440, 1_440, 30)).toBe(1)
    expect(unitsWithinStockHorizon(0, 0, 0, 30)).toBe(Number.MAX_SAFE_INTEGER)
  })
})
