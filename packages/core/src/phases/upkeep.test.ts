import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { armyUpkeep, unitCount } from '../state/army'
import { createInitialState, type GameConfig } from '../state/create'
import type { Army, GameState, ResourceKey } from '../state/types'
import { step } from '../step'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 11,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const army = (id: string, owner: string, unitKey: string, hpTotal: number): Army => ({
  id,
  owner,
  name: id,
  locationProvinceId: 'n1',
  units: [{ unitKey, hpTotal }],
  path: [],
  arrivalTick: null,
  departureTick: null,
  deployDelayUntil: 0,
  stance: 'defensive',
  embarked: false,
  cannotAttackUntil: 0,
})

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
})

describe('R-ECON-03 Unterhalt der Streitkraefte', () => {
  it('leitet die Einheitenzahl aus dem Trefferpunkte-Vorrat ab', () => {
    // 10 infantry at 1000 hp each; a damaged unit still counts as present.
    expect(unitCount({ unitKey: 'infantry', hpTotal: 10_000 }, TEST_RULES)).toBe(10)
    expect(unitCount({ unitKey: 'infantry', hpTotal: 9_500 }, TEST_RULES)).toBe(10)
    expect(unitCount({ unitKey: 'infantry', hpTotal: 0 }, TEST_RULES)).toBe(0)
  })

  it('berechnet den Unterhalt aus Einheitenzahl und Regelwerk', () => {
    const owed = armyUpkeep(army('a1', 'p1', 'infantry', 10_000), TEST_RULES)
    expect(owed.food).toBe(TEST_RULES.units['infantry']!.upkeep.food! * 10)
    expect(owed.money).toBe(TEST_RULES.units['infantry']!.upkeep.money! * 10)
  })

  it('zieht den Unterhalt jede Stunde ab', () => {
    state.armies['a1'] = army('a1', 'p1', 'tank', 26_000) // 10 tanks
    state.armyOrder = ['a1']

    const before = state.players['p1']!.resources.oil
    const after = step(state, [], ctx).state
    const consumed = before - after.players['p1']!.resources.oil
    // n1..n3 produce no oil, so the whole difference is upkeep.
    expect(consumed).toBe(TEST_RULES.units['tank']!.upkeep.oil! * 10)
  })

  it('belastet nur den Eigentuemer', () => {
    state.armies['a1'] = army('a1', 'p2', 'tank', 26_000)
    state.armyOrder = ['a1']

    const after = step(state, [], ctx).state
    expect(after.players['p1']!.resources.oil).toBe(state.players['p1']!.resources.oil)
    expect(after.players['p2']!.resources.oil).toBeLessThan(state.players['p2']!.resources.oil)
  })
})

describe('R-ECON-03 Mangel statt negativer Bestaende', () => {
  it('laesst Vorraete niemals negativ werden', () => {
    state.players['p1']!.resources.oil = 1000
    state.armies['a1'] = army('a1', 'p1', 'tank', 260_000) // 100 tanks, far too expensive
    state.armyOrder = ['a1']

    const after = step(state, [], ctx).state
    expect(after.players['p1']!.resources.oil).toBe(0)
  })

  it('merkt sich den Mangel im Zustand', () => {
    state.players['p1']!.resources.oil = 0
    state.armies['a1'] = army('a1', 'p1', 'tank', 26_000)
    state.armyOrder = ['a1']

    const after = step(state, [], ctx).state
    expect(after.players['p1']!.shortages).toContain('oil')
  })

  it('meldet einen Mangel einmal, nicht jede Stunde', () => {
    // A three-day oil crisis must not produce 72 messages.
    state.players['p1']!.resources.oil = 0
    state.armies['a1'] = army('a1', 'p1', 'tank', 26_000)
    state.armyOrder = ['a1']

    let current = state
    let reports = 0
    for (let i = 0; i < 10; i++) {
      const result = step(current, [], ctx)
      current = result.state
      reports += result.events.filter((event) => event.type === 'RESOURCE_SHORTAGE').length
    }
    expect(reports).toBe(1)
  })

  it('hebt den Mangel auf, sobald wieder geliefert wird', () => {
    state.players['p1']!.resources.oil = 0
    state.armies['a1'] = army('a1', 'p1', 'tank', 26_000)
    state.armyOrder = ['a1']

    let current = step(state, [], ctx).state
    expect(current.players['p1']!.shortages).toContain('oil')

    current.players['p1']!.resources.oil = 10_000_000
    current = step(current, [], ctx).state
    expect(current.players['p1']!.shortages).not.toContain('oil')
  })

  it('meldet den Mangel nur dem betroffenen Spieler', () => {
    state.players['p1']!.resources.food = 0
    state.armies['a1'] = army('a1', 'p1', 'infantry', 100_000)
    state.armyOrder = ['a1']

    const result = step(state, [], ctx)
    const shortage = result.events.find((event) => event.type === 'RESOURCE_SHORTAGE')
    expect(shortage?.audience).toEqual(['p1'])
  })
})

describe('R-ECON-04 Lagergrenzen', () => {
  it('deckelt Vorraete auf die Lagergrenze', () => {
    const limit = TEST_RULES.storageLimits.iron as number
    state.players['p1']!.resources.iron = limit + 5_000_000

    const after = step(state, [], ctx).state
    expect(after.players['p1']!.resources.iron).toBe(limit)
  })

  it('laesst Geld unbegrenzt wachsen', () => {
    // Documented exception (D6.8): capping money would make taxes pointless.
    expect(TEST_RULES.storageLimits.money).toBeNull()
    state.players['p1']!.resources.money = 900_000_000

    const after = step(state, [], ctx).state
    expect(after.players['p1']!.resources.money).toBeGreaterThanOrEqual(900_000_000)
  })

  it('meldet Ueberlauf einmal je Spieltag', () => {
    const limit = TEST_RULES.storageLimits.wood as number
    let current = state
    current.players['p1']!.resources.wood = limit + 1_000_000

    let overflows = 0
    for (let i = 0; i < 48; i++) {
      const result = step(current, [], ctx)
      current = result.state
      current.players['p1']!.resources.wood = limit + 1_000_000 // keep it overflowing
      overflows += result.events.filter((event) => event.type === 'STORAGE_OVERFLOW').length
    }
    expect(overflows).toBe(2) // two game days
  })

  it('nennt die verworfene Menge und meldet nur an der Tagesgrenze', () => {
    const limit = TEST_RULES.storageLimits.coal as number
    state.players['p1']!.resources.coal = limit + 700_000

    // The check runs at the start of the tick, so tick 24 is a boundary and 25 is not.
    state.tick = 24
    const onBoundary = step(state, [], ctx)
    const reported = onBoundary.events.find((event) => event.type === 'STORAGE_OVERFLOW')
    expect(reported).toBeDefined()
    expect((reported as { wasted: number }).wasted).toBeGreaterThan(0)

    state.tick = 25
    const offBoundary = step(state, [], ctx)
    expect(offBoundary.events.find((event) => event.type === 'STORAGE_OVERFLOW')).toBeUndefined()
  })
})

describe('R-ECON-03 Mangelfolgen sind abfragbar', () => {
  it('nennt die betroffenen Ressourcen sortiert', () => {
    state.players['p1']!.resources.oil = 0
    state.players['p1']!.resources.food = 0
    state.armies['a1'] = army('a1', 'p1', 'tank', 26_000)
    state.armies['a2'] = army('a2', 'p1', 'infantry', 20_000)
    state.armyOrder = ['a1', 'a2']

    const after = step(state, [], ctx).state
    const shortages = after.players['p1']!.shortages as ResourceKey[]
    expect(shortages).toEqual([...shortages].sort())
    expect(shortages).toContain('oil')
  })
})
