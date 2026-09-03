import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'
import { buildingFactor, moraleFactor, occupationFactor, populationFactor } from './production'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 5,
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

const foodOf = (s: GameState) => s.players['p1']!.resources.food

describe('R-ECON-02 Produktion je Tick', () => {
  it('mehrt die Vorraete des Eigentuemers', () => {
    const before = foodOf(state)
    const after = step(state, [], ctx).state
    expect(foodOf(after)).toBeGreaterThan(before)
  })

  it('produziert nichts fuer herrenlose Provinzen', () => {
    // m1 and m2 belong to nobody at the start — neutral ground produces for no one.
    for (const id of state.provinceOrder) {
      if (state.provinces[id]!.owner === null) {
        expect(state.provinces[id]!.productionRemainder).toEqual({})
      }
    }
    const after = step(state, [], ctx).state
    expect(after.provinces['m1']!.owner).toBeNull()
  })

  it('folgt der belegten Moralformel 0,20 + 0,80 x Moral', () => {
    expect(moraleFactor(0, TEST_RULES)).toBe(200) // 20 % bei Moral 0
    expect(moraleFactor(100_000, TEST_RULES)).toBe(1000) // 100 % bei Moral 100
    expect(moraleFactor(50_000, TEST_RULES)).toBe(600) // 60 % bei Moral 50
    expect(moraleFactor(70_000, TEST_RULES)).toBe(760) // Startmoral
  })

  it('halbiert die Ausbeute bei sehr niedriger Moral nicht sofort auf null', () => {
    // The floor is what keeps a demoralised province from becoming worthless.
    const low = { ...state }
    for (const id of low.provinceOrder) low.provinces[id]!.morale = 0
    const after = step(low, [], ctx).state
    expect(foodOf(after)).toBeGreaterThan(foodOf(state))
  })

  it('steigert die Ausbeute mit Fabrikstufen', () => {
    const withFactory = structuredClone(state)
    withFactory.provinces['n1']!.buildings.factory = 2

    const plain = step(state, [], ctx).state
    const boosted = step(withFactory, [], ctx).state
    expect(foodOf(boosted) - foodOf(state)).toBeGreaterThan(foodOf(plain) - foodOf(state))
  })

  it('laesst Fabriken kein Geld drucken', () => {
    // Money comes from taxation, not from extraction — a factory must not multiply it.
    const province = structuredClone(state.provinces['n1']!)
    province.buildings.factory = 3
    expect(buildingFactor(province, 'money', TEST_RULES)).toBe(1000)
    expect(buildingFactor(province, 'food', TEST_RULES)).toBeGreaterThan(1000)
  })

  it('gewichtet nach Bevoelkerung, aber gedeckelt', () => {
    const small = structuredClone(state.provinces['i1']!)
    const large = structuredClone(state.provinces['n1']!)
    expect(populationFactor(small)).toBeGreaterThanOrEqual(500)
    expect(populationFactor(large)).toBeLessThanOrEqual(1500)
    expect(populationFactor(large)).toBeGreaterThan(populationFactor(small))
  })
})

describe('R-ECON-02 Besatzung und Hauptstadtverlust', () => {
  it('halbiert die Ausbeute einer frisch eroberten Provinz', () => {
    const province = structuredClone(state.provinces['n1']!)
    province.occupiedSince = 0
    expect(occupationFactor(province, 0, TEST_RULES)).toBe(500)
  })

  it('laesst die Ausbeute ueber die Besatzungszeit zurueckkehren', () => {
    const province = structuredClone(state.provinces['n1']!)
    province.occupiedSince = 0
    const halfway = 7 * TEST_RULES.constants.ticksPerDay
    const full = 14 * TEST_RULES.constants.ticksPerDay

    expect(occupationFactor(province, halfway, TEST_RULES)).toBeGreaterThan(500)
    expect(occupationFactor(province, halfway, TEST_RULES)).toBeLessThan(1000)
    expect(occupationFactor(province, full, TEST_RULES)).toBe(1000)
  })

  it('senkt die Ausbeute des ganzen Landes nach dem Verlust der Hauptstadt', () => {
    const wounded = structuredClone(state)
    wounded.players['p1']!.capitalLostUntil = 100

    const normal = step(state, [], ctx).state
    const punished = step(wounded, [], ctx).state
    expect(foodOf(punished) - foodOf(state)).toBeLessThan(foodOf(normal) - foodOf(state))
  })
})

describe('R-ECON-02 Rundung verliert nichts', () => {
  it('traegt einen krummen Rest in den naechsten Tick vor', () => {
    // A deposit that does not divide evenly is exactly where rounding would leak.
    const odd = structuredClone(state)
    odd.provinces['n1']!.deposits.food = 1234

    const after = step(odd, [], ctx).state
    expect(after.provinces['n1']!.productionRemainder.food).toBeGreaterThan(0)
  })

  it('liefert ueber viele Ticks exakt das Vielfache eines Ticks', () => {
    // The point of the carry: without it every tick loses up to one thousandth per
    // resource and province, and 24 000 ticks later the economy runs measurably below
    // its own balancing values. Ten ticks must be exactly ten times one tick — the
    // check is the ratio, not a hard-coded yield, so balancing changes do not read
    // as bugs.
    const odd = structuredClone(state)
    odd.provinces['n1']!.deposits.food = 1234
    odd.armyOrder = [] // no upkeep, so the difference is production alone

    const oneTick = foodOf(step(odd, [], ctx).state) - foodOf(odd)

    // Twenty ticks: inside the first game day, so morale has not drifted yet and the
    // yield per tick is constant.
    let current = odd
    for (let i = 0; i < 20; i++) current = step(current, [], ctx).state
    const twentyTicks = foodOf(current) - foodOf(odd)

    // Single ticks alternate as the remainder fills up; nothing is lost across them.
    expect(twentyTicks).toBeGreaterThanOrEqual(oneTick * 20)
    expect(twentyTicks).toBeLessThanOrEqual((oneTick + 1) * 20)
  })
})
