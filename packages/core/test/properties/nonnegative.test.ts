import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../../src/state/create'
import { RESOURCE_KEYS, type GameState, type ResourceKey } from '../../src/state/types'
import { step } from '../../src/step'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 3,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

const unitKeys = Object.keys(TEST_RULES.units)

/**
 * Property tests over generated situations (design D14).
 *
 * Hand-written cases check the situations we thought of; these check the ones we did
 * not. "Stocks never go negative" is the kind of invariant that holds for every case
 * anyone writes by hand and breaks on the one nobody did.
 */
describe('R-ECON-03 Vorraete werden niemals negativ', () => {
  it('haelt auch bei beliebigen Startvorraeten und Armeen', () => {
    fc.assert(
      fc.property(
        fc.record({
          stocks: fc.array(fc.integer({ min: 0, max: 5_000_000 }), {
            minLength: RESOURCE_KEYS.length,
            maxLength: RESOURCE_KEYS.length,
          }),
          armies: fc.array(
            fc.record({
              unitKey: fc.constantFrom(...unitKeys),
              hp: fc.integer({ min: 1, max: 400_000 }),
              owner: fc.constantFrom('p1', 'p2'),
            }),
            { maxLength: 12 },
          ),
          ticks: fc.integer({ min: 1, max: 30 }),
        }),
        ({ stocks, armies, ticks }) => {
          let state: GameState = createInitialState(CONFIG, ctx)

          RESOURCE_KEYS.forEach((key, index) => {
            state.players['p1']!.resources[key] = stocks[index]!
            state.players['p2']!.resources[key] = stocks[index]!
          })

          armies.forEach((entry, index) => {
            const id = `a${index}`
            state.armies[id] = {
              id,
              owner: entry.owner,
              name: id,
              locationProvinceId: 'n1',
              units: [{ unitKey: entry.unitKey, hpTotal: entry.hp }],
              path: [],
              arrivalTick: null,
              departureTick: null,
              deployDelayUntil: 0,
              stance: 'defensive',
              embarked: false,
              cannotAttackUntil: 0,
    bombardTarget: null,
    holdFire: false,
            }
            state.armyOrder = [...state.armyOrder, id].sort()
          })

          for (let i = 0; i < ticks; i++) state = step(state, [], ctx).state

          for (const playerId of state.playerOrder) {
            for (const key of RESOURCE_KEYS) {
              const amount = state.players[playerId]!.resources[key as ResourceKey]
              expect(amount).toBeGreaterThanOrEqual(0)
              expect(Number.isSafeInteger(amount)).toBe(true)
            }
          }
          return true
        },
      ),
      { numRuns: 40 },
    )
  })

  it('haelt Vorraete innerhalb der Lagergrenzen', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 900_000_000 }), (amount) => {
        let state = createInitialState(CONFIG, ctx)
        state.players['p1']!.resources.iron = amount
        state = step(state, [], ctx).state

        const limit = TEST_RULES.storageLimits.iron as number
        expect(state.players['p1']!.resources.iron).toBeLessThanOrEqual(limit)
        return true
      }),
      { numRuns: 30 },
    )
  })

  it('haelt Provinzmoral im Wertebereich', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), fc.integer({ min: 1, max: 50 }), (morale, ticks) => {
        let state = createInitialState(CONFIG, ctx)
        for (const id of state.provinceOrder) state.provinces[id]!.morale = morale
        for (let i = 0; i < ticks; i++) state = step(state, [], ctx).state

        for (const id of state.provinceOrder) {
          expect(state.provinces[id]!.morale).toBeGreaterThanOrEqual(0)
          expect(state.provinces[id]!.morale).toBeLessThanOrEqual(100_000)
        }
        return true
      }),
      { numRuns: 30 },
    )
  })
})
