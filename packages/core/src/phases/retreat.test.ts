import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Command } from '../commands/types'
import { armyHp } from '../state/army'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { regeneration } from './regeneration'
import { step } from '../step'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 81,
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

describe('R-BAT-05 Rueckzug', () => {
  it('bringt die Armee in eine benachbarte eigene Provinz', () => {
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 20_000 }], stance: 'retreat' })

    const after = step(state, [], ctx).state
    const army = after.armies['a1']!
    expect(['n1', 'n3']).toContain(army.locationProvinceId)
  })

  it('kostet Staerke', () => {
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 20_000 }], stance: 'retreat' })

    const after = step(state, [], ctx).state
    expect(armyHp(after.armies['a1']!)).toBeLessThan(20_000)
    expect(armyHp(after.armies['a1']!)).toBeGreaterThan(15_000)
  })

  it('sperrt den Angriff fuer einen Spieltag und verdoppelt die Aufmarschzeit', () => {
    // Otherwise "attack, retreat, repeat" would be the dominant strategy.
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 20_000 }], stance: 'retreat' })

    const after = step(state, [], ctx).state
    const army = after.armies['a1']!
    expect(army.cannotAttackUntil).toBe(TEST_RULES.constants.retreatCooldownTicks)
    expect(army.deployDelayUntil).toBe(TEST_RULES.constants.deployDelayTicks * 2)
    expect(army.stance).toBe('defensive')
  })

  it('meldet den Rueckzug mit Verlusten', () => {
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 20_000 }], stance: 'retreat' })

    const result = step(state, [], ctx)
    const event = result.events.find((e) => e.type === 'ARMY_RETREATED') as { hpLost: number }
    expect(event).toBeDefined()
    expect(event.hpLost).toBeGreaterThan(0)
  })

  it('laesst eine eingeschlossene Armee stehen und kaempfen', () => {
    // i1 is an island: no land neighbour to fall back to.
    placeArmy(state, { owner: 'p1', at: 'i1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }], stance: 'retreat' })

    const after = step(state, [], ctx).state
    expect(after.armies['a1']!.locationProvinceId).toBe('i1')
    expect(after.armies['a1']!.stance).toBe('defensive')
  })

  it('loest sich vor dem Kampf auf, nicht danach', () => {
    // Retreating must be a decision made in advance, not a free escape after the blow.
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 20_000 }], stance: 'retreat' })
    placeArmy(state, { owner: 'p2', at: 'n2', units: [{ unitKey: 'tank', hpTotal: 52_000 }] })

    const after = step(state, [], ctx).state
    // The retreating army left before combat, so it only paid the retreat cost.
    expect(armyHp(after.armies['a1']!)).toBe(18_000)
  })
})

describe('R-UNIT-07 Regeneration', () => {
  it('frischt eine angebrochene Einheit in eigener Provinz auf', () => {
    const army = placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 3_500 }] })
    const before = army.units[0]!.hpTotal

    const after = step(state, [], ctx).state
    expect(after.armies['a1']!.units[0]!.hpTotal).toBeGreaterThan(before)
  })

  it('fuellt hoechstens bis zur vollen Staerke der vorhandenen Einheiten auf', () => {
    // 3500 hit points are four units' worth: the ceiling is 4000, not more.
    placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 3_500 }] })

    let current = state
    for (let i = 0; i < 200; i++) current = step(current, [], ctx).state
    expect(current.armies['a1']!.units[0]!.hpTotal).toBe(4_000)
  })

  it('frischt in fremdem Gebiet nicht auf', () => {
    // The phase is called directly: within a full tick the occupation phase would
    // claim the undefended province first, and the army would be at home again.
    placeArmy(state, { owner: 'p1', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 3_500 }] })
    regeneration(state, { map, rules: TEST_RULES, commands: [], events: [] })
    expect(state.armies['a1']!.units[0]!.hpTotal).toBe(3_500)
  })

  it('frischt im Kampf nicht auf', () => {
    placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 3_500 }] })
    placeArmy(state, { owner: 'p2', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })

    const after = step(state, [], ctx).state
    expect(after.armies['a1']!.units[0]!.hpTotal).toBeLessThan(3_500)
  })

  it('frischt bei Materialmangel langsamer auf', () => {
    const supplied = structuredClone(state)
    placeArmy(supplied, { owner: 'p1', at: 'n1', units: [{ unitKey: 'infantry', hpTotal: 2_800 }] })

    const short = structuredClone(supplied)
    short.players['p1']!.shortages = ['wood']

    const base = { map, rules: TEST_RULES, commands: [], events: [] }
    regeneration(supplied, base)
    regeneration(short, base)

    expect(short.armies['a1']!.units[0]!.hpTotal).toBeLessThan(supplied.armies['a1']!.units[0]!.hpTotal)
  })
})

describe('R-BAT-06 Bombardement', () => {
  const bombard = (armyId: string, target: string, playerId = 'p1'): Command =>
    ({ type: 'BOMBARD', playerId, armyId, targetProvinceId: target }) as Command

  it('fuegt Schaden zu, ohne selbst getroffen zu werden', () => {
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'artillery', hpTotal: 14_000 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    state.provinces['m1']!.owner = 'p2'

    const after = step(state, [bombard('a1', 'm1')], ctx).state
    expect(armyHp(after.armies['a2']!)).toBeLessThan(20_000)
    expect(armyHp(after.armies['a1']!)).toBe(14_000)
  })

  it('erobert nichts', () => {
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'artillery', hpTotal: 14_000 }] })
    state.provinces['m1']!.owner = 'p2'

    const after = step(state, [bombard('a1', 'm1')], ctx).state
    expect(after.provinces['m1']!.owner).toBe('p2')
  })

  it('verlangt eine Fernwaffe', () => {
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    state.provinces['m1']!.owner = 'p2'

    const result = step(state, [bombard('a1', 'm1')], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'INVALID_TARGET' })
  })

  it('haelt die Reichweite ein', () => {
    placeArmy(state, { owner: 'p1', at: 'n1', units: [{ unitKey: 'artillery', hpTotal: 14_000 }] })
    state.provinces['o2']!.owner = 'p2'

    const result = step(state, [bombard('a1', 'o2')], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'OUT_OF_RANGE' })
  })

  it('verlangt Krieg', () => {
    state.diplomacy.relations['p1|p2']!.state = 'peace'
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'artillery', hpTotal: 14_000 }] })
    state.provinces['m1']!.owner = 'p2'

    const result = step(state, [bombard('a1', 'm1')], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'AT_WAR_REQUIRED' })
  })

  it('trifft eine leere Provinz nur an der Moral', () => {
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'artillery', hpTotal: 14_000 }] })
    state.provinces['m1']!.owner = 'p2'
    const moraleBefore = state.provinces['m1']!.morale

    const after = step(state, [bombard('a1', 'm1')], ctx).state
    expect(after.provinces['m1']!.morale).toBeLessThan(moraleBefore)
  })
})

describe('R-BAT-05 Die Rueckzugssperre wirkt auch im Nahkampf', () => {
  it('laesst eine eben zurueckgezogene Armee nicht sofort wieder angreifen', () => {
    // Befund 49: `cannotAttackUntil` wurde gesetzt (hier und beim Beschuss) und nur vom
    // Beschuss gelesen. Der Nahkampf sah die Sperre nie — eine Armee zog sich zurueck und
    // schlug im selben Tick wieder zu, als waere nichts gewesen. Eine Sperre, die nur die
    // Haelfte der Kampfarten kennt, ist keine.
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p1|p2']!.state = 'war'

    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })

    // p1 steht unter Sperre, p2 nicht.
    const gesperrt = state.armyOrder.find((id) => state.armies[id]!.owner === 'p1')!
    state.armies[gesperrt]!.cannotAttackUntil = state.tick + 10

    const nachher = step(state, [], ctx).state
    const verlusteP2 =
      20_000 -
      nachher.armyOrder
        .filter((id) => nachher.armies[id]!.owner === 'p2')
        .reduce((sum, id) => sum + armyHp(nachher.armies[id]!), 0)

    expect(verlusteP2, 'die gesperrte Armee hat trotzdem zugeschlagen').toBe(0)
  })

  it('laesst sie sich aber weiterhin verteidigen', () => {
    // Nicht angreifen heisst nicht wehrlos: wer unter Sperre steht, wird getroffen und
    // haelt stand. Sonst waere der Rueckzug ein Selbstmordbefehl.
    const state = createInitialState(CONFIG, ctx)
    state.diplomacy.relations['p1|p2']!.state = 'war'

    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    placeArmy(state, { owner: 'p2', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 20_000 }] })
    const gesperrt = state.armyOrder.find((id) => state.armies[id]!.owner === 'p1')!
    state.armies[gesperrt]!.cannotAttackUntil = state.tick + 10

    const nachher = step(state, [], ctx).state
    const verlusteP1 =
      20_000 -
      nachher.armyOrder
        .filter((id) => nachher.armies[id]!.owner === 'p1')
        .reduce((sum, id) => sum + armyHp(nachher.armies[id]!), 0)

    expect(verlusteP1, 'die gesperrte Armee blieb unbehelligt').toBeGreaterThan(0)
  })
})
