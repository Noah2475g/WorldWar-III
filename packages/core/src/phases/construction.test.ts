import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Command } from '../commands/types'
import { tickOfDay } from '../rules/availability'
import { buildDuration, buildSpeedFactor, buildTicksForLevel, buildingCostForLevel } from '../rules/build'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 21,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

let state: GameState
const build = (provinceId: string, building: string, playerId = 'p1'): Command =>
  ({ type: 'BUILD', playerId, provinceId, building }) as Command

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
  // T-M15-02: Seit der Freischaltungsachse (R-TECH-01) traegt jedes Gebaeude einen
  // ersten Spieltag. Diese Datei prueft die *anderen* Voraussetzungen — Kueste, Hafen,
  // Bauplaetze, Geld —, also wird die Uhr auf einen Tag gestellt, an dem alles zu haben
  // ist. Sonst schluege hier die neue Ablehnung zu und die alte bliebe ungeprueft.
  state.tick = tickOfDay(LATEST_BUILDING_DAY, TEST_RULES)
})

/** Der spaeteste erste Spieltag im Regelwerk — ab hier ist jedes Gebaeude zu haben. */
const LATEST_BUILDING_DAY = Math.max(...Object.values(TEST_RULES.buildings).map((rule) => rule.availableFromDay))

/** Runs `ticks` hours, feeding `commands` into the first one. */
function run(from: GameState, ticks: number, commands: Command[] = []) {
  let current = from
  const events = []
  for (let i = 0; i < ticks; i++) {
    const result = step(current, i === 0 ? commands : [], ctx)
    current = result.state
    events.push(...result.events)
  }
  return { state: current, events }
}

describe('R-PROV-01 Bauauftrag erteilen', () => {
  it('zieht die Kosten sofort ab', () => {
    // Compared against an identical tick without the order, because production runs
    // in the same hour and would otherwise be mistaken for a discount.
    const cost = TEST_RULES.buildings.barracks.cost
    const idle = step(state, [], ctx).state.players['p1']!.resources.wood
    const building = step(state, [build('n1', 'barracks')], ctx).state.players['p1']!.resources.wood
    expect(idle - building).toBe(cost.wood!)
  })

  it('reiht den Auftrag mit Fertigstellungszeitpunkt ein', () => {
    const after = step(state, [build('n1', 'barracks')], ctx).state
    const queue = after.provinces['n1']!.buildQueue
    expect(queue).toHaveLength(1)
    expect(queue[0]!.building).toBe('barracks')
    expect(queue[0]!.completesAtTick).toBeGreaterThan(after.tick)
  })

  it('stellt genau zum berechneten Zeitpunkt fertig', () => {
    const started = step(state, [build('n1', 'barracks')], ctx).state
    const finishAt = started.provinces['n1']!.buildQueue[0]!.completesAtTick

    let current = started
    while (current.tick < finishAt) current = step(current, [], ctx).state

    expect(current.provinces['n1']!.buildings.barracks).toBe(1)
    expect(current.provinces['n1']!.buildQueue).toHaveLength(0)
  })

  it('meldet Beginn und Fertigstellung nur dem Bauherrn', () => {
    const { events } = run(state, 30, [build('n1', 'barracks')])
    const started = events.find((event) => event.type === 'BUILD_STARTED')
    const completed = events.find((event) => event.type === 'BUILD_COMPLETED')
    expect(started?.audience).toEqual(['p1'])
    expect(completed?.audience).toEqual(['p1'])
  })

  it('weist fremde Provinzen ab', () => {
    const result = step(state, [build('o1', 'barracks')], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'NOT_OWNER' })
  })

  it('weist unbezahlbare Bauten ab', () => {
    state.players['p1']!.resources.wood = 0
    const result = step(state, [build('n1', 'factory')], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'INSUFFICIENT_RESOURCES',
    })
    expect(result.state.provinces['n1']!.buildQueue).toHaveLength(0)
  })
})

describe('R-PROV-01 Voraussetzungen', () => {
  it('verlangt fuer den Hafen eine Kuestenprovinz', () => {
    const inland = step(state, [build('n2', 'harbour')], ctx) // n2 is landlocked
    expect(inland.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'INVALID_TARGET' })

    const coastal = step(state, [build('n1', 'harbour')], ctx) // n1 is a port
    expect(coastal.state.provinces['n1']!.buildQueue).toHaveLength(1)
  })

  it('verlangt fuer die Werft einen Hafen', () => {
    const without = step(state, [build('n1', 'shipyard')], ctx)
    expect(without.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'MISSING_BUILDING',
    })

    state.provinces['n1']!.buildings.harbour = 1
    state.players['p1']!.resources.wood = 5_000_000
    state.players['p1']!.resources.iron = 5_000_000
    state.players['p1']!.resources.money = 5_000_000
    const withHarbour = step(state, [build('n1', 'shipyard')], ctx)
    expect(withHarbour.state.provinces['n1']!.buildQueue).toHaveLength(1)
  })

  it('haelt die Hoechststufe ein', () => {
    state.provinces['n1']!.buildings.barracks = TEST_RULES.buildings.barracks.maxLevel
    const result = step(state, [build('n1', 'barracks')], ctx)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'BUILDING_MAX_LEVEL',
    })
  })

  it('begrenzt die Zahl gleichzeitiger Bauplaetze', () => {
    // Without a slot limit, parallel construction is capped only by resources —
    // and the promise "extra build slots are free here" would mean nothing (D6.9).
    const slots = TEST_RULES.constants.maxBuildSlotsCity
    // Volle Kasse, damit **der Bauplatz** ablehnt und nicht das Geld. Seit T-M34-06 der
    // Startvorrat auf zwei Drittel steht, reichte er fuer den zweiten Auftrag nicht mehr,
    // und der Test meldete QUEUE_FULL, wo INSUFFICIENT_RESOURCES stand — er haette den
    // Bauplatz-Deckel ab sofort gar nicht mehr geprueft.
    for (const key of Object.keys(state.players['p1']!.resources)) {
      state.players['p1']!.resources[key as 'wood'] = 99_000_000
    }
    const orders = [build('n1', 'barracks'), build('n1', 'fortress'), build('n1', 'railway')]
    const result = step(state, orders, ctx)

    expect(result.state.provinces['n1']!.buildQueue).toHaveLength(slots)
    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({ code: 'QUEUE_FULL' })
  })

  it('gibt Landprovinzen weniger Bauplaetze als Staedten', () => {
    expect(TEST_RULES.constants.maxBuildSlotsRural).toBeLessThan(TEST_RULES.constants.maxBuildSlotsCity)
  })
})

describe('R-PROV-01 Abbruch und Eigentuemerwechsel', () => {
  it('erstattet beim eigenen Abbruch die Haelfte', () => {
    const started = step(state, [build('n1', 'barracks')], ctx).state
    const orderId = started.provinces['n1']!.buildQueue[0]!.id
    const woodAfterOrder = started.players['p1']!.resources.wood

    const cancelled = step(
      started,
      [{ type: 'CANCEL_BUILD', playerId: 'p1', provinceId: 'n1', orderId } as Command],
      ctx,
    ).state

    const refund = cancelled.players['p1']!.resources.wood - woodAfterOrder
    expect(refund).toBeGreaterThan(0)
    expect(refund).toBeLessThan(TEST_RULES.buildings.barracks.cost.wood!)
    expect(cancelled.provinces['n1']!.buildQueue).toHaveLength(0)
  })

  it('verwirft den Auftrag beim Eigentuemerwechsel ohne Erstattung', () => {
    // Capturing a half-built factory must not come with a discount (R-PROV-01/AK2).
    const started = step(state, [build('n1', 'barracks')], ctx).state
    const woodBefore = started.players['p1']!.resources.wood

    started.provinces['n1']!.owner = 'p2'
    const result = step(started, [], ctx)

    expect(result.state.provinces['n1']!.buildQueue).toHaveLength(0)
    expect(result.state.provinces['n1']!.buildings.barracks).toBeUndefined()
    // No refund: p1 only gains what its remaining provinces produced this hour.
    const idle = step(started, [], ctx).state.players['p1']!.resources.wood
    expect(result.state.players['p1']!.resources.wood).toBe(idle)
    expect(result.state.players['p1']!.resources.wood).toBeLessThan(woodBefore + TEST_RULES.buildings.barracks.cost.wood!)
    expect(result.events.find((e) => e.type === 'BUILD_CANCELLED')).toMatchObject({ reason: 'ownerChanged' })
  })
})

describe('R-PROV-04 Moral beeinflusst die Bauzeit', () => {
  it('folgt der belegten Kurve: 80 Moral ist die Grundlage', () => {
    expect(buildSpeedFactor(80_000)).toBe(1000) // baseline
    expect(buildSpeedFactor(100_000)).toBe(1100) // 10 % schneller
    expect(buildSpeedFactor(0)).toBe(200) // 20 % Geschwindigkeit
  })

  it('laesst schlecht gelaunte Provinzen laenger bauen', () => {
    const fast = buildDuration(24, 100_000)
    const normal = buildDuration(24, 80_000)
    const slow = buildDuration(24, 20_000)
    expect(fast).toBeLessThan(normal)
    expect(slow).toBeGreaterThan(normal)
  })

  it('braucht immer mindestens eine Stunde', () => {
    expect(buildDuration(1, 100_000)).toBeGreaterThanOrEqual(1)
  })
})

/**
 * Die zweite Fortschrittsachse (T-M34-04, FORTSCHRITT.md D34.3).
 *
 * Der Befund: `build.ts` zog `rule.cost` unveraendert ab und setzte `completionTick` aus
 * `rule.buildTicks` — **die Stufe war reine Buchfuehrung.** Eine Fabrik der dritten Stufe
 * kostete so viel wie die erste und war genauso schnell fertig. Damit war die zweite
 * Achse des Spiels so kurz wie die erste: wer die Fabrik einmal bezahlen kann, kann sie
 * dreimal bezahlen.
 *
 * Zwei Konstanten, beide als Permille auf die Stufe ueber der ersten:
 * `buildLevelCostPermille` (1800) und `buildLevelTimePermille` (1500). Stufe 3 kostet
 * damit das 3,24-fache und dauert das 2,25-fache.
 */
describe('R-PROV-02 Gebaeudestufen kosten und dauern mehr', () => {
  const factory = TEST_RULES.buildings.factory

  it('laesst die erste Stufe unveraendert — die Streckung faengt bei der zweiten an', () => {
    expect(buildingCostForLevel(factory, 1, TEST_RULES.constants)).toEqual(factory.cost)
    expect(buildTicksForLevel(factory, 1, TEST_RULES.constants)).toBe(factory.buildTicks)
  })

  it('verlangt fuer die dritte Stufe das 3,24-fache und die 2,25-fache Zeit', () => {
    const cost = buildingCostForLevel(factory, 3, TEST_RULES.constants)

    // Alle drei Rohstoffe, nicht nur einer: ein Faktor, der auf Holz wirkt und auf Eisen
    // nicht, waere ein halber Faktor und faellt in keinem Einzelwert auf.
    for (const key of ['wood', 'iron', 'money'] as const) {
      const base = factory.cost[key]!
      expect(cost[key]! / base, `${key}`).toBeCloseTo(3.24, 3)
    }
    expect(buildTicksForLevel(factory, 3, TEST_RULES.constants) / factory.buildTicks).toBeCloseTo(2.25, 3)
  })

  it('lehnt eine dritte Stufe ab, die als erste bezahlbar gewesen waere', () => {
    // Die eigentliche Zusicherung: nicht dass eine Zahl groesser ist, sondern dass der
    // Kern danach handelt. Genau so viel Geld wie die erste Stufe kostet.
    const province = state.provinces['n1']!
    province.buildings.factory = 2
    for (const key of Object.keys(factory.cost) as (keyof typeof factory.cost)[]) {
      state.players['p1']!.resources[key as 'wood'] = factory.cost[key]!
    }

    const result = step(state, [build('n1', 'factory')], ctx)

    expect(result.events.find((e) => e.type === 'COMMAND_REJECTED')).toMatchObject({
      code: 'INSUFFICIENT_RESOURCES',
    })
    expect(result.state.provinces['n1']!.buildQueue).toHaveLength(0)
  })

  it('zieht im laufenden Spiel den Preis der Stufe ab, die gebaut wird', () => {
    const province = state.provinces['n1']!
    province.buildings.factory = 2
    for (const key of ['wood', 'iron', 'money'] as const) state.players['p1']!.resources[key] = 50_000_000

    const idle = step(state, [], ctx).state.players['p1']!.resources.iron
    const after = step(state, [build('n1', 'factory')], ctx)
    const gezahlt = idle - after.state.players['p1']!.resources.iron

    expect(after.state.provinces['n1']!.buildQueue).toHaveLength(1)
    expect(after.state.provinces['n1']!.buildQueue[0]!.level).toBe(3)
    expect(gezahlt).toBe(buildingCostForLevel(factory, 3, TEST_RULES.constants).iron)
    expect(gezahlt).toBeGreaterThan(factory.cost.iron!)
  })

  it('laesst die dritte Stufe laenger dauern als die erste', () => {
    for (const key of ['wood', 'iron', 'money'] as const) state.players['p1']!.resources[key] = 50_000_000

    const ersteStufe = step(state, [build('n1', 'factory')], ctx).state.provinces['n1']!.buildQueue[0]!
    const erste = ersteStufe.completesAtTick - ersteStufe.startedTick

    const dritte = (() => {
      state.provinces['n1']!.buildings.factory = 2
      const order = step(state, [build('n1', 'factory')], ctx).state.provinces['n1']!.buildQueue[0]!
      return order.completesAtTick - order.startedTick
    })()

    expect(dritte / erste).toBeCloseTo(2.25, 1)
  })

  it('erstattet beim Abbruch die Haelfte des tatsaechlich bezahlten Preises', () => {
    // Sonst waere der Abbruch einer teuren Stufe ein Verlustgeschaeft mit Ansage: halb
    // zurueck vom Preis der ERSTEN Stufe, waehrend die dritte bezahlt wurde.
    const province = state.provinces['n1']!
    province.buildings.factory = 2
    for (const key of ['wood', 'iron', 'money'] as const) state.players['p1']!.resources[key] = 50_000_000

    const started = step(state, [build('n1', 'factory')], ctx).state
    const orderId = started.provinces['n1']!.buildQueue[0]!.id
    const vorher = started.players['p1']!.resources.iron

    const cancelled = step(
      started,
      [{ type: 'CANCEL_BUILD', playerId: 'p1', provinceId: 'n1', orderId } as Command],
      ctx,
    ).state

    const idle = step(started, [], ctx).state.players['p1']!.resources.iron
    const erstattet = cancelled.players['p1']!.resources.iron - idle
    const dritteStufe = buildingCostForLevel(factory, 3, TEST_RULES.constants).iron!

    expect(vorher).toBeGreaterThan(0)
    expect(erstattet).toBe(Math.round(dritteStufe / 2))
    expect(erstattet).toBeGreaterThan(Math.round(factory.cost.iron! / 2))
  })
})
