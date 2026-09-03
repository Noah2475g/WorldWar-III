import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { revoltChance, targetMoraleFor } from './morale'
import { scoreOf } from '../rules/victory'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { runTicks } from '../clock'
import { step } from '../step'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 101,
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
  state.diplomacy.relations['p1|p2']!.state = 'war'
})

describe('R-BAT-04 Eroberung', () => {
  it('nimmt eine unverteidigte feindliche Provinz', () => {
    state.provinces['m1']!.owner = 'p2'
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })

    const result = step(state, [], ctx)
    expect(result.state.provinces['m1']!.owner).toBe('p1')
    expect(result.events.find((e) => e.type === 'PROVINCE_CAPTURED')).toBeDefined()
  })

  it('senkt die Moral der eroberten Provinz auf den belegten Wert', () => {
    state.provinces['m1']!.owner = 'p2'
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })

    const after = step(state, [], ctx).state
    expect(after.provinces['m1']!.morale).toBe(TEST_RULES.constants.capturedMorale)
    expect(after.provinces['m1']!.occupiedSince).toBe(0)
  })

  it('nimmt herrenlose Provinzen auch ohne Krieg', () => {
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const after = step(state, [], ctx).state
    expect(after.provinces['m1']!.owner).toBe('p1')
  })

  it('nimmt nichts, solange Verteidiger da sind', () => {
    state.provinces['m1']!.owner = 'p2'
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })

    const after = step(state, [], ctx).state
    expect(after.provinces['m1']!.owner).toBe('p2')
  })

  it('laesst Flugzeuge und Schiffe nichts erobern', () => {
    // Ground has to be taken by ground forces — that is what keeps them necessary.
    state.provinces['m1']!.owner = 'p2'
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'fighter', hpTotal: 2_400 }] })

    const after = step(state, [], ctx).state
    expect(after.provinces['m1']!.owner).toBe('p2')
  })

  it('meldet den Verlust der Hauptstadt und bestraft das ganze Land', () => {
    placeArmy(state, { owner: 'p1', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })

    const result = step(state, [], ctx)
    expect(result.events.find((e) => e.type === 'CAPITAL_LOST')).toBeDefined()
    expect(result.state.players['p2']!.capitalProvinceId).toBeNull()
    expect(result.state.players['p2']!.capitalLostUntil).toBeGreaterThan(0)
  })
})

describe('R-PROV-03 Moral', () => {
  it('zieht die Moral zum Zielwert, ein Siebtel je Tag', () => {
    const start = state.provinces['n1']!.morale
    const after = runTicks(state, 24, ctx).state
    expect(after.provinces['n1']!.morale).not.toBe(start)
    expect(after.provinces['n1']!.targetMorale).toBeGreaterThan(0)
  })

  it('belohnt Naehe zur Hauptstadt', () => {
    const capital = targetMoraleFor(state, state.provinces['n1']!, { ...ctx, commands: [], events: [] })
    const far = targetMoraleFor(state, state.provinces['n3']!, { ...ctx, commands: [], events: [] })
    expect(capital).toBeGreaterThan(far)
  })

  it('bestraft frisch erobertes Gebiet', () => {
    const province = state.provinces['n2']!
    const calm = targetMoraleFor(state, province, { ...ctx, commands: [], events: [] })

    province.occupiedSince = 0
    const occupied = targetMoraleFor(state, province, { ...ctx, commands: [], events: [] })
    expect(occupied).toBeLessThan(calm)
  })

  it('belohnt moralfoerdernde Gebaeude', () => {
    const province = state.provinces['n2']!
    const plain = targetMoraleFor(state, province, { ...ctx, commands: [], events: [] })

    province.buildings.railway = 2
    expect(targetMoraleFor(state, province, { ...ctx, commands: [], events: [] })).toBeGreaterThan(plain)
  })

  it('bestraft Nahrungsmangel', () => {
    const fed = targetMoraleFor(state, state.provinces['n1']!, { ...ctx, commands: [], events: [] })
    state.players['p1']!.shortages = ['food']
    const starving = targetMoraleFor(state, state.provinces['n1']!, { ...ctx, commands: [], events: [] })
    expect(starving).toBeLessThan(fed)
  })

  it('haelt die Moral im Wertebereich', () => {
    for (const id of state.provinceOrder) state.provinces[id]!.morale = 0
    const after = runTicks(state, 72, ctx).state
    for (const id of after.provinceOrder) {
      expect(after.provinces[id]!.morale).toBeGreaterThanOrEqual(0)
      expect(after.provinces[id]!.morale).toBeLessThanOrEqual(100_000)
    }
  })
})

describe('R-PROV-03 Aufstaende', () => {
  it('folgt der belegten Formel (33 minus Moral) mal 3 Prozent', () => {
    expect(revoltChance(33_000, TEST_RULES)).toBe(0)
    expect(revoltChance(23_000, TEST_RULES)).toBe(300) // 10 Punkte -> 30 %
    expect(revoltChance(0, TEST_RULES)).toBe(990)
  })

  it('laesst eine ausgelaugte Provinz abfallen', () => {
    for (const id of state.provinceOrder) {
      state.provinces[id]!.morale = 2_000
      state.provinces[id]!.targetMorale = 2_000
    }

    let current = state
    let revolted = false
    for (let day = 0; day < 10 && !revolted; day++) {
      const result = runTicks(current, 24, ctx)
      current = result.state
      revolted = result.events.some((e) => e.type === 'PROVINCE_REVOLTED')
    }
    expect(revolted).toBe(true)
  })

  it('laesst zufriedene Provinzen in Ruhe', () => {
    const result = runTicks(state, 240, ctx)
    expect(result.events.some((e) => e.type === 'PROVINCE_REVOLTED')).toBe(false)
  })
})

describe('R-GAME-02 Punkte und Sieg', () => {
  it('zaehlt Provinzen, Bevoelkerung, Gebaeude und Einheiten', () => {
    const before = scoreOf(state, 'p1', TEST_RULES)

    state.provinces['n1']!.buildings.fortress = 2
    expect(scoreOf(state, 'p1', TEST_RULES)).toBeGreaterThan(before)

    const withArmy = scoreOf(state, 'p1', TEST_RULES)
    placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    expect(scoreOf(state, 'p1', TEST_RULES)).toBeGreaterThan(withArmy)
  })

  it('meldet den Punktestand taeglich', () => {
    const result = runTicks(state, 24, ctx)
    expect(result.events.find((e) => e.type === 'DAY_REPORT')).toBeDefined()
  })

  it('laesst einen Spieler ohne Land und Armee ausscheiden', () => {
    for (const id of state.provinceOrder) {
      if (state.provinces[id]!.owner === 'p2') state.provinces[id]!.owner = 'p1'
    }

    const result = runTicks(state, 24, ctx)
    expect(result.state.players['p2']!.alive).toBe(false)
    expect(result.events.find((e) => e.type === 'PLAYER_ELIMINATED')).toBeDefined()
  })

  it('erklaert den letzten Verbliebenen zum Sieger', () => {
    for (const id of state.provinceOrder) {
      if (state.provinces[id]!.owner === 'p2') state.provinces[id]!.owner = 'p1'
    }

    const result = runTicks(state, 48, ctx)
    expect(result.state.victory.winner).toBe('p1')
    expect(result.events.find((e) => e.type === 'GAME_ENDED')).toBeDefined()
  })
})
