import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Command } from '../commands/types'
import { tickOfDay } from '../rules/availability'
import { recruitDuration, recruitSpeedFactor, recruitStartCondition } from '../rules/recruit'
import { unitCount } from '../state/army'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 31,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

let state: GameState

const recruit = (unitKey: string, count = 5, provinceId = 'n1', playerId = 'p1'): Command =>
  ({ type: 'RECRUIT', playerId, provinceId, unitKey, count }) as Command

function runUntilQuiet(from: GameState, maxTicks = 60): GameState {
  let current = from
  for (let i = 0; i < maxTicks; i++) {
    current = step(current, [], ctx).state
    if (current.provinces['n1']!.recruitQueue.length === 0) break
  }
  return current
}

/** Der spaeteste erste Spieltag im Regelwerk — ab hier ist jede Einheit zu haben. */
const LATEST_UNIT_DAY = Math.max(...Object.values(TEST_RULES.units).map((rule) => rule.availableFromDay))

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
  state.provinces['n1']!.buildings.barracks = 1
  // T-M15-02: Diese Datei prueft die Gebaeudevoraussetzung und die Dauern, nicht die
  // Freischaltung nach Spieltag (R-TECH-01) — die Uhr steht deshalb hinter dem letzten
  // Freischaltungstag. Ohne das schluege die neue Ablehnung zu, und die alte Zusicherung
  // waere gruen, ohne noch etwas zu belegen.
  state.tick = tickOfDay(LATEST_UNIT_DAY, TEST_RULES)
  // Und volle Kasse, aus demselben Grund wie die Uhr: seit T-M34-06 der Startvorrat auf
  // zwei Dritteln steht, reichte er fuer zwei Panzer nicht mehr — die Zusicherung
  // "verlangt eine Fabrik" waere an INSUFFICIENT_RESOURCES gescheitert und haette damit
  // etwas anderes geprueft als ihren Namen. Der eine Test, der die leere Kasse WILL,
  // setzt sie sich selbst (unten, `resources.food = 0`).
  for (const key of Object.keys(state.players['p1']!.resources)) {
    state.players['p1']!.resources[key as 'food'] = 99_000_000
  }
})

describe('R-UNIT-02 Rekrutierung beauftragen', () => {
  it('verlangt das passende Gebaeude', () => {
    const noBarracks = structuredClone(state)
    delete noBarracks.provinces['n1']!.buildings.barracks

    const rejected = step(noBarracks, [recruit('infantry')], ctx)
    expect(rejected.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'MISSING_BUILDING',
    })

    const accepted = step(state, [recruit('infantry')], ctx)
    expect(accepted.state.provinces['n1']!.recruitQueue).toHaveLength(1)
  })

  it('verlangt fuer Panzer eine Fabrik, nicht die Kaserne', () => {
    const rejected = step(state, [recruit('tank')], ctx)
    expect(rejected.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'MISSING_BUILDING',
    })

    state.provinces['n1']!.buildings.factory = 1
    const accepted = step(state, [recruit('tank', 2)], ctx)
    expect(accepted.state.provinces['n1']!.recruitQueue).toHaveLength(1)
  })

  it('verlangt fuer schwere Panzer die zweite Fabrikstufe', () => {
    state.provinces['n1']!.buildings.factory = 1
    expect(
      step(state, [recruit('heavy_tank', 1)], ctx).events.find((e) => e.type === 'COMMAND_REJECTED'),
    ).toMatchObject({ code: 'MISSING_BUILDING' })

    state.provinces['n1']!.buildings.factory = 2
    expect(step(state, [recruit('heavy_tank', 1)], ctx).state.provinces['n1']!.recruitQueue).toHaveLength(1)
  })

  it('zieht die Kosten fuer die gesamte Bestellung ab', () => {
    const idle = step(state, [], ctx).state.players['p1']!.resources.food
    const ordering = step(state, [recruit('infantry', 5)], ctx).state.players['p1']!.resources.food
    expect(idle - ordering).toBe(TEST_RULES.units['infantry']!.cost.food! * 5)
  })

  it('weist unbezahlbare Bestellungen ab', () => {
    state.players['p1']!.resources.food = 0
    const result = step(state, [recruit('infantry', 20)], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'INSUFFICIENT_RESOURCES',
    })
  })

  it('weist unsinnige Stueckzahlen ab', () => {
    for (const count of [0, -3, 999]) {
      const result = step(state, [recruit('infantry', count)], ctx)
      expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
        code: 'INVALID_TARGET',
      })
    }
  })

  it('rekrutiert nicht in einer Provinz kurz vor dem Aufstand', () => {
    state.provinces['n1']!.morale = 20_000
    const result = step(state, [recruit('infantry')], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'INVALID_TARGET',
    })
  })
})

describe('R-UNIT-02 Fertige Einheiten', () => {
  it('stellt die Einheiten als Armee in der Provinz auf', () => {
    const ordered = step(state, [recruit('infantry', 5)], ctx).state
    const finished = runUntilQuiet(ordered)

    expect(finished.armyOrder).toHaveLength(1)
    const army = finished.armies[finished.armyOrder[0]!]!
    expect(army.owner).toBe('p1')
    expect(army.locationProvinceId).toBe('n1')
    // Morale delivers a fraction of the ordered strength (see DECISIONS.md); the pool
    // then regenerates towards the next full unit, so this checks the band, not a point.
    expect(army.units[0]!.hpTotal).toBeGreaterThanOrEqual(3500)
    expect(army.units[0]!.hpTotal).toBeLessThanOrEqual(4000)
    expect(unitCount(army.units[0]!, TEST_RULES)).toBe(4)
  })

  it('legt neue Einheiten zu einer bereits anwesenden Armee', () => {
    // Otherwise a busy province litters the map with one-unit armies.
    let current = step(state, [recruit('infantry', 5)], ctx).state
    current = runUntilQuiet(current)
    const firstArmy = current.armyOrder[0]!

    current = step(current, [recruit('infantry', 3)], ctx).state
    current = runUntilQuiet(current)

    expect(current.armyOrder).toEqual([firstArmy])
    // 5 + 3 ordered at morale 70 deliver ~5600 hit points, then regeneration tops the
    // partially filled unit up towards 6000.
    expect(current.armies[firstArmy]!.units[0]!.hpTotal).toBeGreaterThanOrEqual(5600)
    expect(current.armies[firstArmy]!.units[0]!.hpTotal).toBeLessThanOrEqual(6200)
  })

  it('meldet die Fertigstellung an den Auftraggeber', () => {
    let current = step(state, [recruit('infantry', 2)], ctx).state
    let event
    for (let i = 0; i < 40 && !event; i++) {
      const result = step(current, [], ctx)
      current = result.state
      event = result.events.find((e) => e.type === 'UNIT_RECRUITED')
    }
    expect(event).toMatchObject({ unitKey: 'infantry', count: 2, audience: ['p1'] })
  })

  it('liefert nicht an den alten Eigentuemer, wenn die Provinz faellt', () => {
    const ordered = step(state, [recruit('infantry', 5)], ctx).state
    ordered.provinces['n1']!.owner = 'p2'

    const finished = runUntilQuiet(ordered)
    expect(finished.armyOrder).toHaveLength(0)
  })
})

describe('R-PROV-04 Moral wirkt auf Rekrutierung', () => {
  it('folgt der belegten Kurve 20 % bis 100 %', () => {
    expect(recruitSpeedFactor(0)).toBe(200)
    expect(recruitSpeedFactor(100_000)).toBe(1000)
    expect(recruitSpeedFactor(50_000)).toBe(600)
  })

  it('verlaengert die Dauer bei niedriger Moral', () => {
    expect(recruitDuration(12, 100_000)).toBeLessThan(recruitDuration(12, 40_000))
  })

  it('gibt frischen Einheiten Trefferpunkte nach Provinzmoral', () => {
    // Belegt: infantry raised at 75 morale starts at about three quarters strength.
    expect(recruitStartCondition(100_000)).toBe(1000)
    expect(recruitStartCondition(75_000)).toBe(750)
    expect(recruitStartCondition(0)).toBe(250) // floor, so a unit is never born broken
  })

  it('liefert in einer schwachen Provinz schwaechere Einheiten', () => {
    const weak = structuredClone(state)
    weak.provinces['n1']!.morale = 40_000

    const strongArmy = runUntilQuiet(step(state, [recruit('infantry', 5)], ctx).state)
    const weakArmy = runUntilQuiet(step(weak, [recruit('infantry', 5)], ctx).state)

    const strongHp = strongArmy.armies[strongArmy.armyOrder[0]!]!.units[0]!.hpTotal
    const weakHp = weakArmy.armies[weakArmy.armyOrder[0]!]!.units[0]!.hpTotal
    expect(weakHp).toBeLessThan(strongHp)
  })
})
