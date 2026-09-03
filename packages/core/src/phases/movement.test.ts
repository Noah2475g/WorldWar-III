import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Command } from '../commands/types'
import { armySpeed, canUseSea, railwayFactor, territoryFactor } from '../rules/movement'
import { createInitialState, type GameConfig } from '../state/create'
import type { Army, GameState } from '../state/types'
import { step } from '../step'
import { planRoute } from './movement'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 51,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const makeArmy = (id: string, owner: string, at: string, units: { unitKey: string; hpTotal: number }[]): Army => ({
  id,
  owner,
  name: id,
  locationProvinceId: at,
  units,
  path: [],
  arrivalTick: null,
  departureTick: null,
  deployDelayUntil: 0,
  stance: 'aggressive',
  embarked: false,
  cannotAttackUntil: 0,
})

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
  state.armies['a1'] = makeArmy('a1', 'p1', 'n1', [{ unitKey: 'infantry', hpTotal: 10_000 }])
  state.armyOrder = ['a1']
})

const move = (armyId: string, target: string, playerId = 'p1'): Command =>
  ({ type: 'MOVE_ARMY', playerId, armyId, targetProvinceId: target }) as Command

/** Runs until the army stops moving, or the limit is hit. */
function runUntilArrived(from: GameState, armyId: string, limit = 400) {
  let current = from
  const events = []
  for (let i = 0; i < limit; i++) {
    const result = step(current, [], ctx)
    current = result.state
    events.push(...result.events)
    if (current.armies[armyId]?.path.length === 0) break
  }
  return { state: current, events }
}

describe('R-UNIT-04 Marschbefehl', () => {
  it('setzt Weg und Ankunftszeit', () => {
    const after = step(state, [move('a1', 'n2')], ctx).state
    const army = after.armies['a1']!
    expect(army.path).toEqual(['n2'])
    expect(army.arrivalTick).toBeGreaterThan(after.tick)
  })

  it('meldet die Ankunft am Ziel im Voraus', () => {
    const route = planRoute(state, state.armies['a1']!, 'm1', map, TEST_RULES)
    expect(route).not.toBeNull()

    const result = step(state, [move('a1', 'm1')], ctx)
    const departed = result.events.find((e) => e.type === 'ARMY_DEPARTED') as { arrivalTick: number }
    expect(departed.arrivalTick).toBe(route!.arrivalTick)
  })

  it('haelt die angekuendigte Ankunftszeit ein', () => {
    // R-UNIT-04/AK1: the estimate and the event must be the same number, because the
    // same function produces both.
    const route = planRoute(state, state.armies['a1']!, 'm1', map, TEST_RULES)!
    const started = step(state, [move('a1', 'm1')], ctx).state
    const { state: arrived } = runUntilArrived(started, 'a1')

    expect(arrived.armies['a1']!.locationProvinceId).toBe('m1')
    expect(arrived.tick).toBe(route.arrivalTick)
  })

  it('weist Ziele ohne Weg zurueck', () => {
    // Infantry cannot walk to an island.
    const result = step(state, [move('a1', 'i1')], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'NO_PATH' })
  })

  it('weist das eigene Feld und fremde Armeen zurueck', () => {
    expect(
      step(state, [move('a1', 'n1')], ctx).events.find((e) => e.type === 'COMMAND_REJECTED'),
    ).toMatchObject({ code: 'INVALID_TARGET' })

    expect(
      step(state, [move('a1', 'n2', 'p2')], ctx).events.find((e) => e.type === 'COMMAND_REJECTED'),
    ).toMatchObject({ code: 'NOT_OWNER' })
  })

  it('haelt die Armee auf Befehl an', () => {
    const marching = step(state, [move('a1', 'm1')], ctx).state
    const stopped = step(marching, [{ type: 'STOP_ARMY', playerId: 'p1', armyId: 'a1' } as Command], ctx).state
    expect(stopped.armies['a1']!.path).toEqual([])
  })
})

describe('R-UNIT-05 Aufmarschverzoegerung', () => {
  it('setzt die Verzoegerung beim Abmarsch', () => {
    const after = step(state, [move('a1', 'n2')], ctx).state
    expect(after.armies['a1']!.deployDelayUntil).toBe(after.tick - 1 + TEST_RULES.constants.deployDelayTicks)
  })
})

describe('R-UNIT-04 Geschwindigkeit', () => {
  it('richtet sich nach der langsamsten Einheit', () => {
    const mixed = makeArmy('a2', 'p1', 'n1', [
      { unitKey: 'motorized', hpTotal: 12_000 },
      { unitKey: 'artillery', hpTotal: 1_400 },
    ])
    expect(armySpeed(mixed, TEST_RULES)).toBe(TEST_RULES.units['artillery']!.speedKmh)
  })

  it('bremst in fremdem und feindlichem Gebiet', () => {
    // Belegt: foreign ground 0.70, hostile ground 0.35.
    const neutral = state.provinces['m1']!
    expect(territoryFactor(state, neutral, 'p1', TEST_RULES)).toBe(
      TEST_RULES.constants.foreignTerritoryFactor,
    )

    state.diplomacy.relations['p1|p2']!.state = 'war'
    expect(territoryFactor(state, state.provinces['o1']!, 'p1', TEST_RULES)).toBe(
      TEST_RULES.constants.hostileTerritoryFactor,
    )
  })

  it('beschleunigt entlang der Eisenbahn', () => {
    const plain = state.provinces['n1']!
    expect(railwayFactor(plain, TEST_RULES)).toBe(1000)

    plain.buildings.railway = 3
    expect(railwayFactor(plain, TEST_RULES)).toBeGreaterThan(1000)
    expect(railwayFactor(plain, TEST_RULES)).toBeLessThanOrEqual(TEST_RULES.constants.railwayFactor)
  })

  it('halbiert das Tempo bei Oelmangel', () => {
    const withOil = planRoute(state, state.armies['a1']!, 'm1', map, TEST_RULES)!
    state.players['p1']!.shortages = ['oil']
    const withoutOil = planRoute(state, state.armies['a1']!, 'm1', map, TEST_RULES)!
    expect(withoutOil.totalTicks).toBeGreaterThan(withOil.totalTicks)
  })
})

describe('R-UNIT-06 Seewege brauchen Transportkapazitaet', () => {
  it('laesst Landeinheiten ohne Schiff nicht aufs Meer', () => {
    expect(canUseSea(state.armies['a1']!, TEST_RULES)).toBe(false)
  })

  it('erlaubt reinen Flotten die See', () => {
    const fleet = makeArmy('a3', 'p1', 'n1', [{ unitKey: 'destroyer', hpTotal: 6_400 }])
    expect(canUseSea(fleet, TEST_RULES)).toBe(true)
  })

  it('traegt Landeinheiten mit ausreichender Transportkapazitaet', () => {
    const convoy = makeArmy('a4', 'p1', 'n1', [
      { unitKey: 'transport', hpTotal: 3_600 }, // 2 ships, capacity 12
      { unitKey: 'infantry', hpTotal: 5_000 }, // 5 units
    ])
    expect(canUseSea(convoy, TEST_RULES)).toBe(true)

    const overloaded = makeArmy('a5', 'p1', 'n1', [
      { unitKey: 'transport', hpTotal: 1_800 }, // 1 ship, capacity 6
      { unitKey: 'infantry', hpTotal: 20_000 }, // 20 units
    ])
    expect(canUseSea(overloaded, TEST_RULES)).toBe(false)
  })

  it('bringt eine Flotte ueber See zur Insel', () => {
    state.armies['a3'] = makeArmy('a3', 'p1', 'n1', [{ unitKey: 'destroyer', hpTotal: 6_400 }])
    state.armyOrder = ['a1', 'a3']

    const started = step(state, [move('a3', 'i1')], ctx).state
    const { state: arrived } = runUntilArrived(started, 'a3')
    expect(arrived.armies['a3']!.locationProvinceId).toBe('i1')
    expect(arrived.armies['a3']!.embarked).toBe(false)
  })
})

describe('R-UNIT-04 Kein Durchmarsch an Verteidigern vorbei', () => {
  it('haelt die Armee an, wenn sie auf feindliche Landeinheiten trifft', () => {
    // Without this rule no front line can ever form: armies would simply walk past
    // each other to the undefended capital.
    state.diplomacy.relations['p1|p2']!.state = 'war'
    state.armies['def'] = makeArmy('def', 'p2', 'm1', [{ unitKey: 'infantry', hpTotal: 10_000 }])
    state.armyOrder = ['a1', 'def']

    const started = step(state, [move('a1', 'o1')], ctx).state // route runs through m1
    const { state: stopped } = runUntilArrived(started, 'a1')

    expect(stopped.armies['a1']!.locationProvinceId).toBe('m1')
    expect(stopped.armies['a1']!.path).toEqual([])
  })

  it('laesst friedliche Nachbarn passieren', () => {
    state.armies['other'] = makeArmy('other', 'p2', 'm1', [{ unitKey: 'infantry', hpTotal: 10_000 }])
    state.armyOrder = ['a1', 'other']

    const started = step(state, [move('a1', 'm2')], ctx).state
    const { state: arrived } = runUntilArrived(started, 'a1')
    expect(arrived.armies['a1']!.locationProvinceId).toBe('m2')
  })
})
