import { describe, expect, it } from 'vitest'
import { createInitialState, economyOverview, publicView, spySalary, type GameConfig, type GameState, type SpyMission } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { dailyArmyMoneyUpkeep, dailyMoneyIncome, dailyMoneyLedger, dailySpySalary, unitsWithinDailyBalance } from './finance'

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
