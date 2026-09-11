import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Command } from '../commands/types'
import { ONE } from '@worldwar/shared'
import { deploymentFactor } from '../rules/combat'
import { armySpeed, canUseSea, railwayFactor, territoryFactor } from '../rules/movement'
import { createInitialState, type GameConfig } from '../state/create'
import type { Army, GameState } from '../state/types'
import { step } from '../step'
import { firstAlertFor } from '../clock'
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
    bombardTarget: null,
    holdFire: false,
})

let state: GameState

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
  state.armies['a1'] = makeArmy('a1', 'p1', 'n1', [{ unitKey: 'infantry', hpTotal: 10_000 }])
  state.armyOrder = ['a1']
})

const move = (armyId: string, target: string, playerId = 'p1', departInTicks?: number): Command =>
  ({ type: 'MOVE_ARMY', playerId, armyId, targetProvinceId: target, ...(departInTicks === undefined ? {} : { departInTicks }) }) as Command

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
    // Belegt: foreign ground 0.70. Hostile ground war belegt 0.35 und ist seit
    // T-M24-03 entschieden 0.50 (DECISIONS 2026-09-07): eine Kriegserklaerung
    // HALBIERTE das Tempo, der schnellste Eroeffnungszug war der Ueberfall.
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
    // With right of way granted: without it, marching through would itself start a war.
    state.diplomacy.relations['p1|p2']!.rightOfWay = true
    state.armies['other'] = makeArmy('other', 'p2', 'm1', [{ unitKey: 'infantry', hpTotal: 10_000 }])
    state.armyOrder = ['a1', 'other']

    const started = step(state, [move('a1', 'm2')], ctx).state
    const { state: arrived } = runUntilArrived(started, 'a1')
    expect(arrived.armies['a1']!.locationProvinceId).toBe('m2')
  })
})

describe('R-UNIT-04 Verzoegerter Abmarsch (T-M32-01)', () => {
  it('verschiebt Abmarsch und Ankunft um genau die verlangten Ticks', () => {
    const sofort = step(state, [move('a1', 'n2')], ctx).state.armies['a1']!
    const spaeter = step(state, [move('a1', 'n2', 'p1', 6)], ctx).state.armies['a1']!

    expect(spaeter.departureTick).toBe(sofort.departureTick! + 6)
    expect(spaeter.arrivalTick).toBe(sofort.arrivalTick! + 6)
    expect(spaeter.path).toEqual(sofort.path)
  })

  it('meldet die verschobene Ankunft auch im Ereignis', () => {
    const sofort = step(state, [move('a1', 'n2')], ctx).events.find((e) => e.type === 'ARMY_DEPARTED')
    const spaeter = step(state, [move('a1', 'n2', 'p1', 6)], ctx).events.find((e) => e.type === 'ARMY_DEPARTED')

    const tickOf = (e: unknown) => (e as { arrivalTick: number }).arrivalTick
    expect(tickOf(spaeter)).toBe(tickOf(sofort) + 6)
  })

  it('steht noch, wenn dieselbe Armee ohne Verzoegerung laengst angekommen waere', () => {
    const sofort = runUntilArrived(step(state, [move('a1', 'n2')], ctx).state, 'a1')
    expect(sofort.state.armies['a1']!.locationProvinceId).toBe('n2')
    const gebraucht = sofort.state.tick - state.tick

    let wartend = step(state, [move('a1', 'n2', 'p1', 20)], ctx).state
    while (wartend.tick - state.tick < gebraucht) wartend = step(wartend, [], ctx).state

    expect(wartend.armies['a1']!.locationProvinceId).toBe('n1')
    expect(wartend.armies['a1']!.path).toEqual(['n2'])
  })

  it('kommt trotz Wartezeit am Ziel an', () => {
    const started = step(state, [move('a1', 'n2', 'p1', 20)], ctx).state
    const { state: arrived } = runUntilArrived(started, 'a1')
    expect(arrived.armies['a1']!.locationProvinceId).toBe('n2')
  })

  it('haelt bis zum Abmarsch die volle Kampfkraft', () => {
    // Half strength is the price of *marching*, not of standing in place and waiting.
    const after = step(state, [move('a1', 'n2', 'p1', 20)], ctx).state
    const army = after.armies['a1']!

    expect(deploymentFactor(army, after.tick, TEST_RULES)).toBe(ONE)
    expect(deploymentFactor(army, army.departureTick!, TEST_RULES)).toBe(TEST_RULES.constants.deployDelayFactor)
  })

  it('verhaelt sich ohne das Feld wie mit dem Wert 0', () => {
    const ohne = step(state, [move('a1', 'n2')], ctx).state.armies['a1']!
    const mitNull = step(state, [move('a1', 'n2', 'p1', 0)], ctx).state.armies['a1']!

    expect(mitNull).toEqual(ohne)
  })
})

/**
 * T-M28-06 · Der Einmarsch schlägt Alarm.
 *
 * Noahs Befund vom 2026-09-08: man kriegt es kaum mit, wenn feindliche Truppen in
 * eigene Gebiete einlaufen. Der Kern trug den Einmarsch bisher gar nicht — `ARMY_ARRIVED`
 * geht an den Marschierenden, nicht an den Bestohlenen.
 */
describe('R-TIME-06 Einmarsch in eigenes Gebiet (T-M28-06)', () => {
  const intrusions = (events: readonly { type: string; tick: number }[]) =>
    events.filter((e) => e.type === 'ARMY_INTRUDED')

  beforeEach(() => {
    state.provinces['m1']!.owner = 'p2'
  })

  it('meldet dem Besitzer, wenn eine kriegfuehrende fremde Armee seine Provinz betritt', () => {
    state.diplomacy.relations['p1|p2']!.state = 'war'
    const started = step(state, [move('a1', 'm1')], ctx).state
    const { events } = runUntilArrived(started, 'a1')

    const alarm = intrusions(events)[0] as unknown as {
      playerId: string
      intruderId: string
      provinceId: string
      severity: string
      audience: string[]
      concerns: string[]
    }
    expect(alarm).toBeTruthy()
    expect(alarm.playerId).toBe('p2')
    expect(alarm.intruderId).toBe('p1')
    expect(alarm.provinceId).toBe('m1')
    // Alarm und `concerns` zusammen sind das, was das Vorspulen anhaelt (firstAlertFor).
    expect(alarm.severity).toBe('alert')
    expect(alarm.audience).toEqual(['p2'])
    expect(alarm.concerns).toEqual(['p2'])
  })

  it('haelt das Vorspulen des Besitzers an, das eines Unbeteiligten nicht', () => {
    state.diplomacy.relations['p1|p2']!.state = 'war'
    const started = step(state, [move('a1', 'm1')], ctx).state
    const { events } = runUntilArrived(started, 'a1')
    const tickOfAlarm = intrusions(events)[0]!.tick
    const desTicks = events.filter((e) => e.tick === tickOfAlarm)

    expect(firstAlertFor(desTicks, 'p2')?.type).toBe('ARMY_INTRUDED')
    // Der Eindringling selbst wird davon nicht angehalten — und ein Dritter erst recht nicht.
    expect(firstAlertFor(desTicks, 'p1')?.type).not.toBe('ARMY_INTRUDED')
  })

  it('schweigt im Frieden — auch mit Durchmarschrecht', () => {
    state.diplomacy.relations['p1|p2']!.rightOfWay = true
    const started = step(state, [move('a1', 'm1')], ctx).state
    const { events } = runUntilArrived(started, 'a1')

    expect(intrusions(events)).toEqual([])
  })

  it('schweigt, wenn die Armee eigenes Gebiet betritt', () => {
    state.provinces['m1']!.owner = 'p1'
    state.diplomacy.relations['p1|p2']!.state = 'war'
    const started = step(state, [move('a1', 'm1')], ctx).state
    const { events } = runUntilArrived(started, 'a1')

    expect(intrusions(events)).toEqual([])
  })
})
