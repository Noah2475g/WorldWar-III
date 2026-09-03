import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import fc from 'fast-check'
import { beforeEach, describe, expect, it } from 'vitest'
import { armyHp } from '../state/army'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'
import type { Command } from './types'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 61,
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
  placeArmy(state, {
    owner: 'p1',
    at: 'm2',
    units: [
      { unitKey: 'infantry', hpTotal: 10_000 },
      { unitKey: 'tank', hpTotal: 5_200 },
    ],
  })
})

const totalHp = (s: GameState) =>
  s.armyOrder.reduce((sum, id) => sum + armyHp(s.armies[id]!), 0)

describe('R-UNIT-03 Armeen teilen', () => {
  it('legt eine neue Armee am selben Ort an', () => {
    const command: Command = {
      type: 'SPLIT_ARMY',
      playerId: 'p1',
      armyId: 'a1',
      take: [{ unitKey: 'infantry', hpTotal: 4_000 }],
    }
    const after = step(state, [command], ctx).state

    expect(after.armyOrder).toHaveLength(2)
    const fresh = after.armies[after.armyOrder.find((id) => id !== 'a1')!]!
    expect(fresh.locationProvinceId).toBe('m2')
    expect(fresh.units).toEqual([{ unitKey: 'infantry', hpTotal: 4_000 }])
    expect(after.armies['a1']!.units.find((u) => u.unitKey === 'infantry')!.hpTotal).toBe(6_000)
  })

  it('erhaelt die Gesamtstaerke exakt', () => {
    // On neutral ground, so regeneration does not add to the pool in the same tick.
    const before = totalHp(state)
    const command: Command = {
      type: 'SPLIT_ARMY',
      playerId: 'p1',
      armyId: 'a1',
      take: [
        // Whole units on both sides: a partially filled unit would regenerate in the
        // same tick and hide the conservation being tested here.
        { unitKey: 'infantry', hpTotal: 3_000 },
        { unitKey: 'tank', hpTotal: 2_600 },
      ],
    }
    const after = step(state, [command], ctx).state
    expect(totalHp(after)).toBe(before)
  })

  it('weist das Abtrennen der vollen Staerke zurueck', () => {
    const command: Command = {
      type: 'SPLIT_ARMY',
      playerId: 'p1',
      armyId: 'a1',
      take: [{ unitKey: 'infantry', hpTotal: 10_000 }],
    }
    const result = step(state, [command], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'INVALID_TARGET' })
  })

  it('weist marschierende Armeen zurueck', () => {
    state.armies['a1']!.path = ['n2']
    const command: Command = {
      type: 'SPLIT_ARMY',
      playerId: 'p1',
      armyId: 'a1',
      take: [{ unitKey: 'infantry', hpTotal: 1_000 }],
    }
    expect(step(state, [command], ctx).events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'ARMY_BUSY',
    })
  })
})

describe('R-UNIT-03 Armeen zusammenlegen', () => {
  beforeEach(() => {
    placeArmy(state, { owner: 'p1', at: 'm2', units: [{ unitKey: 'infantry', hpTotal: 7_000 }] })
  })

  it('vereint die Staerke in einer Armee', () => {
    const before = totalHp(state)
    const command: Command = { type: 'MERGE_ARMIES', playerId: 'p1', armyIds: ['a1', 'a2'] }
    const after = step(state, [command], ctx).state

    expect(after.armyOrder).toEqual(['a1'])
    expect(after.armies['a1']!.units.find((u) => u.unitKey === 'infantry')!.hpTotal).toBe(17_000)
    expect(totalHp(after)).toBe(before)
  })

  it('uebernimmt die laengere Aufmarschverzoegerung', () => {
    // Fresh troops do not cancel the disorder of the ones they join.
    state.armies['a2']!.deployDelayUntil = 50
    const command: Command = { type: 'MERGE_ARMIES', playerId: 'p1', armyIds: ['a1', 'a2'] }
    const after = step(state, [command], ctx).state
    expect(after.armies['a1']!.deployDelayUntil).toBe(50)
  })

  it('weist Armeen an verschiedenen Orten zurueck', () => {
    state.armies['a2']!.locationProvinceId = 'n2'
    const command: Command = { type: 'MERGE_ARMIES', playerId: 'p1', armyIds: ['a1', 'a2'] }
    expect(step(state, [command], ctx).events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'INVALID_TARGET',
    })
  })

  it('weist fremde Armeen zurueck', () => {
    state.armies['a2']!.owner = 'p2'
    const command: Command = { type: 'MERGE_ARMIES', playerId: 'p1', armyIds: ['a1', 'a2'] }
    expect(step(state, [command], ctx).events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'NOT_OWNER',
    })
  })
})

describe('R-UNIT-03 Staerke bleibt erhalten', () => {
  it('haelt ueber beliebige Teilungen und Zusammenlegungen', () => {
    // The invariant every later combat calculation relies on.
    fc.assert(
      fc.property(
        // Whole units only, for the same reason as above.
        fc.array(fc.integer({ min: 1, max: 9 }).map((n) => n * 1000), { minLength: 1, maxLength: 6 }),
        (splits) => {
          let current = createInitialState(CONFIG, ctx)
          placeArmy(current, { owner: 'p1', at: 'm2', units: [{ unitKey: 'infantry', hpTotal: 40_000 }] })
          const before = totalHp(current)

          for (const amount of splits) {
            const command: Command = {
              type: 'SPLIT_ARMY',
              playerId: 'p1',
              armyId: 'a1',
              take: [{ unitKey: 'infantry', hpTotal: amount }],
            }
            current = step(current, [command], ctx).state
          }

          const merge: Command = { type: 'MERGE_ARMIES', playerId: 'p1', armyIds: [...current.armyOrder] }
          current = step(current, [merge], ctx).state

          expect(totalHp(current)).toBe(before)
          return true
        },
      ),
      { numRuns: 25 },
    )
  })
})
