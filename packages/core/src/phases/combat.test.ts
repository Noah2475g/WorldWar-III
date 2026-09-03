import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { defenceMultiplier, stackContribution } from '../rules/combat'
import { armyHp } from '../state/army'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 71,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
    { name: 'C', kind: 'ai', nation: 'Sueden', color: '#2e7d32', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
  state.diplomacy.relations['p1|p2']!.state = 'war'
})

const totalHp = (s: GameState, owner: string) =>
  s.armyOrder.filter((id) => s.armies[id]!.owner === owner).reduce((sum, id) => sum + armyHp(s.armies[id]!), 0)

describe('R-BAT-01 Kampf entsteht bei feindlichem Kontakt', () => {
  it('fuegt beiden Seiten Verluste zu', () => {
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })

    const after = step(state, [], ctx).state
    expect(totalHp(after, 'p1')).toBeLessThan(20_000)
    expect(totalHp(after, 'p2')).toBeLessThan(20_000)
  })

  it('laesst Armeen im Frieden in Ruhe', () => {
    state.diplomacy.relations['p1|p2']!.state = 'peace'
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })

    const after = step(state, [], ctx).state
    expect(totalHp(after, 'p1')).toBe(20_000)
    expect(totalHp(after, 'p2')).toBe(20_000)
  })

  it('meldet den Kampf mit Verlusten beider Seiten', () => {
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })

    const result = step(state, [], ctx)
    const report = result.events.find((e) => e.type === 'BATTLE_RESOLVED') as {
      losses: Record<string, number>
    }
    expect(report).toBeDefined()
    expect(report.losses['p1']).toBeGreaterThan(0)
    expect(report.losses['p2']).toBeGreaterThan(0)
  })
})

describe('R-BAT-02 Einheitenklassen wirken unterschiedlich', () => {
  it('laesst Panzer gegen Infanterie besser abschneiden als umgekehrt', () => {
    const tanks = structuredClone(state)
    placeArmy(tanks, { owner: 'p1', at: 'm1', units: [{ unitKey: 'tank', hpTotal: 26_000 }] })
    placeArmy(tanks, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 26_000 }] })

    const after = step(tanks, [], ctx).state
    const tankLosses = 26_000 - totalHp(after, 'p1')
    const infantryLosses = 26_000 - totalHp(after, 'p2')
    expect(infantryLosses).toBeGreaterThan(tankLosses)
  })

  it('laesst Schaden nicht verpuffen, wenn eine Klasse fehlt', () => {
    // A pure tank force against pure infantry must deal its full weight — the
    // anti-tank share of its value has to flow into the classes that are present.
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'tank', hpTotal: 26_000 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })

    const after = step(state, [], ctx).state
    expect(totalHp(after, 'p2')).toBeLessThan(10_000 * 0.98)
  })
})

describe('R-BAT-03 Verteidigungsvorteile', () => {
  it('erhoeht die Verteidigung durch Festungen', () => {
    const plain = state.provinces['m1']!
    const base = defenceMultiplier(plain, false, TEST_RULES)

    plain.buildings.fortress = 3
    expect(defenceMultiplier(plain, false, TEST_RULES)).toBeGreaterThan(base)
  })

  it('erhoeht die Verteidigung im Gebirge und in der Stadt', () => {
    expect(defenceMultiplier(state.provinces['n3']!, false, TEST_RULES)).toBeGreaterThan(
      defenceMultiplier(state.provinces['m1']!, false, TEST_RULES),
    )
    expect(defenceMultiplier(state.provinces['n1']!, false, TEST_RULES)).toBeGreaterThan(1000)
  })

  it('deckelt gestapelte Verteidigungsboni', () => {
    // Additive and capped: three multiplied bonuses would make a province invulnerable
    // and the battle would never end.
    const fortified = state.provinces['n3']!
    fortified.buildings.fortress = TEST_RULES.buildings.fortress.maxLevel
    expect(defenceMultiplier(fortified, true, TEST_RULES)).toBeLessThanOrEqual(
      TEST_RULES.constants.defenceCap,
    )
  })

  it('schuetzt den Verteidiger messbar', () => {
    const open = structuredClone(state)
    placeArmy(open, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(open, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })

    const fortified = structuredClone(open)
    fortified.provinces['m1']!.buildings.fortress = 5

    const openLosses = 20_000 - totalHp(step(open, [], ctx).state, 'p2')
    const fortLosses = 20_000 - totalHp(step(fortified, [], ctx).state, 'p2')
    expect(fortLosses).toBeLessThan(openLosses)
  })
})

describe('R-BAT-01 Stapelgrenze', () => {
  it('folgt der belegten Kurve 20 bis 50', () => {
    expect(stackContribution(10, TEST_RULES)).toBe(1000)
    expect(stackContribution(20, TEST_RULES)).toBe(1000)
    expect(stackContribution(35, TEST_RULES)).toBe(500)
    expect(stackContribution(50, TEST_RULES)).toBe(0)
    expect(stackContribution(80, TEST_RULES)).toBe(0)
  })

  it('laesst 60 Einheiten nicht mehr ausrichten als 50', () => {
    const fifty = structuredClone(state)
    placeArmy(fifty, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 50_000 }] })
    placeArmy(fifty, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 30_000 }] })

    const sixty = structuredClone(state)
    placeArmy(sixty, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 60_000 }] })
    placeArmy(sixty, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 30_000 }] })

    const lossesFifty = 30_000 - totalHp(step(fifty, [], ctx).state, 'p2')
    const lossesSixty = 30_000 - totalHp(step(sixty, [], ctx).state, 'p2')
    expect(lossesSixty).toBeLessThanOrEqual(lossesFifty)
  })

  it('macht zwanzig Einheiten staerker als fuenfzig', () => {
    // The sweet spot the original is built around.
    expect(stackContribution(20, TEST_RULES)).toBeGreaterThan(stackContribution(45, TEST_RULES))
  })
})

describe('R-BAT-01 Zustand und Mindestschaden', () => {
  it('laesst eine geschwaechte Armee weniger ausrichten', () => {
    // The pool model does this by itself: fewer hit points are fewer units are less
    // damage. There is no separate condition curve (see DECISIONS.md).
    const strong = structuredClone(state)
    placeArmy(strong, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(strong, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 30_000 }] })

    const weak = structuredClone(state)
    placeArmy(weak, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 8_000 }] })
    placeArmy(weak, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 30_000 }] })

    const lossesFromStrong = 30_000 - totalHp(step(strong, [], ctx).state, 'p2')
    const lossesFromWeak = 30_000 - totalHp(step(weak, [], ctx).state, 'p2')
    expect(lossesFromWeak).toBeLessThan(lossesFromStrong)
  })

  it('beendet auch aussichtslose Kaempfe irgendwann', () => {
    // Without a minimum damage, a heavily fortified province plus fixed-point rounding
    // produces a battle that runs forever and a province that never falls.
    state.provinces['n3']!.buildings.fortress = 5
    placeArmy(state, { owner: 'p1', at: 'n3', units: [{ unitKey: 'infantry', hpTotal: 2_000 }] })
    placeArmy(state, { owner: 'p2', at: 'n3', units: [{ unitKey: 'infantry', hpTotal: 40_000 }] })

    let current = state
    let ticks = 0
    while (current.armyOrder.length > 1 && ticks < 500) {
      current = step(current, [], ctx).state
      ticks++
    }
    expect(current.armyOrder.length).toBe(1)
    expect(ticks).toBeLessThan(500)
  })
})

describe('R-BAT-07 Kampf mit mehreren Parteien', () => {
  it('loest einen Kampf mit drei Parteien auf', () => {
    state.diplomacy.relations['p1|p3']!.state = 'war'
    state.diplomacy.relations['p2|p3']!.state = 'war'

    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(state, { owner: 'p3', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })

    const result = step(state, [], ctx)
    const report = result.events.find((e) => e.type === 'BATTLE_RESOLVED') as {
      losses: Record<string, number>
    }
    expect(Object.keys(report.losses).sort()).toEqual(['p1', 'p2', 'p3'])
  })

  it('laesst Verbuendete in Ruhe, waehrend sie gemeinsam kaempfen', () => {
    // p1 and p3 are at peace; both fight p2. Neither may hurt the other.
    state.diplomacy.relations['p2|p3']!.state = 'war'
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(state, { owner: 'p3', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })

    const after = step(state, [], ctx).state
    const report = after.eventLog.find((e) => e.type === 'BATTLE_RESOLVED') as {
      losses: Record<string, number>
    }
    expect(report.losses['p2']).toBeGreaterThan(0)
  })

  it('meldet vernichtete Armeen', () => {
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 200 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'tank', hpTotal: 52_000 }] })

    let current = state
    let destroyed
    for (let i = 0; i < 50 && !destroyed; i++) {
      const result = step(current, [], ctx)
      current = result.state
      destroyed = result.events.find((e) => e.type === 'ARMY_DESTROYED')
    }
    expect(destroyed).toBeDefined()
  })
})

describe('R-ARCH-01 Kampf ist deterministisch', () => {
  it('liefert bei gleichem Seed dasselbe Ergebnis', () => {
    const build = () => {
      const s = createInitialState(CONFIG, ctx)
      s.diplomacy.relations['p1|p2']!.state = 'war'
      placeArmy(s, { owner: 'p1', at: 'm1', units: [{ unitKey: 'tank', hpTotal: 26_000 }] })
      placeArmy(s, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 30_000 }] })
      return s
    }

    let a = build()
    let b = build()
    for (let i = 0; i < 20; i++) {
      a = step(a, [], ctx).state
      b = step(b, [], ctx).state
    }
    expect(totalHp(a, 'p2')).toBe(totalHp(b, 'p2'))
  })
})
