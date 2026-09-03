import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Command } from '../commands/types'
import { embarkCost, isAirFormation, needsTransport } from '../rules/movement'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'
import { planRoute } from './movement'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 91,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
})

describe('R-UNIT-06 Ein- und Ausschiffung kosten Zeit', () => {
  it('erkennt, wann eine Armee verschifft werden muss', () => {
    const fleet = placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'destroyer', hpTotal: 3_200 }] })
    const troops = placeArmy(state, {
      owner: 'p1',
      at: 'n1',
      units: [
        { unitKey: 'transport', hpTotal: 3_600 },
        { unitKey: 'infantry', hpTotal: 5_000 },
      ],
    })
    expect(needsTransport(fleet, TEST_RULES)).toBe(false)
    expect(needsTransport(troops, TEST_RULES)).toBe(true)
  })

  it('kostet mit Hafen weniger Zeit als ohne', () => {
    const army = placeArmy(state, {
      owner: 'p1',
      at: 'n1',
      units: [
        { unitKey: 'transport', hpTotal: 3_600 },
        { unitKey: 'infantry', hpTotal: 5_000 },
      ],
    })
    const withoutHarbour = embarkCost(state, army, state.provinces['n1']!, state.provinces['i1']!, TEST_RULES)

    state.provinces['n1']!.buildings.harbour = 1
    const withHarbour = embarkCost(state, army, state.provinces['n1']!, state.provinces['i1']!, TEST_RULES)

    expect(withHarbour).toBeLessThan(withoutHarbour)
  })

  it('kostet an feindlicher Kueste mehr', () => {
    const army = placeArmy(state, {
      owner: 'p1',
      at: 'n1',
      units: [
        { unitKey: 'transport', hpTotal: 3_600 },
        { unitKey: 'infantry', hpTotal: 5_000 },
      ],
    })
    const neutral = embarkCost(state, army, state.provinces['n1']!, state.provinces['i1']!, TEST_RULES)

    state.provinces['i1']!.owner = 'p2'
    const hostile = embarkCost(state, army, state.provinces['n1']!, state.provinces['i1']!, TEST_RULES)

    expect(hostile).toBeGreaterThan(neutral)
  })

  it('macht die Ueberfahrt langsamer als die reine Seestrecke', () => {
    const fleet = placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'destroyer', hpTotal: 3_200 }] })
    const convoy = placeArmy(state, {
      owner: 'p1',
      at: 'n1',
      units: [
        { unitKey: 'transport', hpTotal: 3_600 },
        { unitKey: 'infantry', hpTotal: 5_000 },
      ],
    })

    const fleetRoute = planRoute(state, fleet, 'i1', map, TEST_RULES)!
    const convoyRoute = planRoute(state, convoy, 'i1', map, TEST_RULES)!
    expect(convoyRoute.totalTicks).toBeGreaterThan(fleetRoute.totalTicks)
  })
})

describe('R-UNIT-08 Luftstreitkraefte sind an Flugplaetze gebunden', () => {
  it('erkennt reine Luftverbaende', () => {
    const air = placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'fighter', hpTotal: 2_400 }] })
    const mixed = placeArmy(state, {
      owner: 'p1',
      at: 'n1',
      units: [
        { unitKey: 'fighter', hpTotal: 2_400 },
        { unitKey: 'infantry', hpTotal: 2_000 },
      ],
    })
    expect(isAirFormation(air, TEST_RULES)).toBe(true)
    expect(isAirFormation(mixed, TEST_RULES)).toBe(false)
  })

  it('verlegt nur auf eigene Flugplaetze', () => {
    placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'fighter', hpTotal: 2_400 }] })

    const noField = step(state, [{ type: 'MOVE_ARMY', playerId: 'p1', armyId: 'a1', targetProvinceId: 'n2' } as Command], ctx)
    expect(noField.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'INVALID_TARGET' })

    state.provinces['n2']!.buildings.airfield = 1
    const withField = step(state, [{ type: 'MOVE_ARMY', playerId: 'p1', armyId: 'a1', targetProvinceId: 'n2' } as Command], ctx)
    expect(withField.state.armies['a1']!.path).toEqual(['n2'])
  })
})
