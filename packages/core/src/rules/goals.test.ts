import { hashValue, quotFixed } from '@worldwar/shared'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { alertsIn, eventsFor } from '../events/emit'
import { ALERT_TYPES, EVENT_TYPES, type DayReportEvent, type GameEvent } from '../events/types'
import { WORLD_EVENT_TYPES, worldEventsIn } from '../events/world'
import { InvalidStateError, validateState } from '../persistence/validate'
import { cloneState } from '../state/clone'
import { createInitialState, type GameConfig } from '../state/create'
import type { GameState } from '../state/types'
import { step } from '../step'
import type { RuleConstants, Rules } from './types'
import { checkVictory } from './victory'

/**
 * Zwischenziele (T-M35-03, R-GAME-08, D31.1/D31.3).
 *
 * Ein Ziel, das jeden Tag neu ausgerechnet wird, kann wieder verschwinden — wer 25 Provinzen
 * hatte und auf 24 faellt, haette sein Ziel nie erreicht. Deshalb steht das Erreichen im
 * Zustand, und diese Tests fahren die echte Tick-Pipeline statt einer Funktion: gefragt ist,
 * ob der Spieltag des Erreichens nach einem Tageswechsel im Spielstand steht und dort bleibt.
 */

/** In der Reihenfolge der Marken (D31.1). Hier als Literal, damit der Test nicht vom Bau lebt. */
const KEYS = ['provinces', 'pointShareFirst', 'populationShare', 'pointShareSecond'] as const
const EMPTY = { provinces: null, pointShareFirst: null, populationShare: null, pointShareSecond: null }

const CONFIG: GameConfig = {
  seed: 7,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'A', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'B', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

/** Marken, die niemand erreicht: ein Anteil über 1000 ‰ und mehr Provinzen, als die Karte hat. */
const UNREACHABLE = {
  goalProvinces: 1000,
  goalPointShareFirstPermille: 1001,
  goalPopulationSharePermille: 1001,
  goalPointShareSecondPermille: 1001,
}

type Marks = Partial<Pick<RuleConstants, keyof typeof UNREACHABLE>>

const rulesWith = (marks: Marks): Rules => ({
  ...TEST_RULES,
  constants: { ...TEST_RULES.constants, ...UNREACHABLE, ...marks },
})

type WithGoals = GameState & { goals: Record<string, Record<string, number | null>> }
const goalsOf = (state: GameState) => (state as WithGoals).goals

/** Faehrt ganze Spieltage und gibt die Tagesberichte mit, gegen die der Tag geprueft wird. */
function advanceDays(start: GameState, days: number, rules: Rules): { state: GameState; reports: DayReportEvent[] } {
  const ctx = { map: smallWorld(), rules }
  let state = start
  const reports: DayReportEvent[] = []
  for (let i = 0; i < days * rules.constants.ticksPerDay; i++) {
    const result = step(state, [], ctx)
    state = result.state
    for (const event of result.events) if (event.type === 'DAY_REPORT') reports.push(event)
  }
  return { state, reports }
}

const fresh = (rules: Rules): GameState => createInitialState(CONFIG, { map: smallWorld(), rules })

describe('R-GAME-08/AK1 Ein erreichtes Ziel bleibt erreicht', () => {
  it('haelt den Spieltag des Erreichens fest, derselbe wie im Tagesbericht', () => {
    // Nordland beginnt mit drei Provinzen; mit Ostmarks o1 sind es vier.
    const rules = rulesWith({ goalProvinces: 4 })
    const start = fresh(rules)
    start.provinces['o1']!.owner = 'p1'

    const { state, reports } = advanceDays(start, 1, rules)

    expect(reports).toHaveLength(1)
    expect(goalsOf(state)['p1']!['provinces']).toBe(reports[0]!.day)
    expect(goalsOf(state)['p2']!['provinces'], 'Ostmark hat nur noch zwei Provinzen').toBeNull()
  })

  it('setzt ihn nicht zurueck, wenn die Zahl wieder unter die Marke faellt', () => {
    const rules = rulesWith({ goalProvinces: 4 })
    const start = fresh(rules)
    start.provinces['o1']!.owner = 'p1'
    const reached = advanceDays(start, 1, rules)
    const day = goalsOf(reached.state)['p1']!['provinces']
    expect(day, 'Vorbedingung: das Ziel ist erreicht').toBeTypeOf('number')

    const lost = cloneState(reached.state)
    lost.provinces['o1']!.owner = 'p2'
    const later = advanceDays(lost, 3, rules)

    expect(later.state.provinces['o1']!.owner).toBe('p2')
    expect(goalsOf(later.state)['p1']!['provinces']).toBe(day)
  })

  it('traegt ein zweites Erreichen nicht mit einem spaeteren Tag nach', () => {
    const rules = rulesWith({ goalProvinces: 4 })
    const start = fresh(rules)
    start.provinces['o1']!.owner = 'p1'
    const first = advanceDays(start, 1, rules)
    const day = goalsOf(first.state)['p1']!['provinces']

    const again = cloneState(first.state)
    again.provinces['o1']!.owner = 'p2'
    const dropped = advanceDays(again, 2, rules)
    dropped.state.provinces['o1']!.owner = 'p1'
    const regained = advanceDays(dropped.state, 2, rules)

    expect(goalsOf(regained.state)['p1']!['provinces']).toBe(day)
  })

  it('prueft nur lebende Maechte', () => {
    const rules = rulesWith({ goalProvinces: 3 })
    const start = fresh(rules)
    start.players['p2']!.alive = false

    const { state } = advanceDays(start, 1, rules)

    expect(goalsOf(state)['p1']!['provinces']).toBeTypeOf('number')
    expect(goalsOf(state)['p2']!['provinces'], 'eine ausgeschiedene Macht erreicht nichts mehr').toBeNull()
  })

  it('rechnet die vier Staende aus Provinzen, Punkten und Bevoelkerung', () => {
    // Nordland haelt drei der zwoelf Provinzen. Jede Marke genau auf den eigenen Stand
    // gelegt, ist sie erreicht; eine Stelle darueber nicht.
    const probe = advanceDays(fresh(rulesWith({})), 1, rulesWith({})).state
    const own = probe.provinceOrder.filter((id) => probe.provinces[id]!.owner === 'p1')
    const totalScore = probe.playerOrder.reduce((sum, id) => sum + probe.players[id]!.score, 0)
    const totalPopulation = probe.provinceOrder.reduce((sum, id) => sum + probe.provinces[id]!.population, 0)
    const ownPopulation = own.reduce((sum, id) => sum + probe.provinces[id]!.population, 0)
    // Dieselbe Rundung wie die Siegpruefung (`quotFixed`, halbe Werte von null weg).
    const scorePermille = quotFixed(probe.players['p1']!.score, totalScore)
    const populationPermille = quotFixed(ownPopulation, totalPopulation)
    expect(own).toHaveLength(3)

    const exact = rulesWith({
      goalProvinces: own.length,
      goalPointShareFirstPermille: scorePermille,
      goalPopulationSharePermille: populationPermille,
      goalPointShareSecondPermille: scorePermille,
    })
    const hit = goalsOf(advanceDays(fresh(exact), 1, exact).state)['p1']!
    for (const key of KEYS) expect(hit[key], `${key} auf der Marke`).toBeTypeOf('number')

    const above = rulesWith({
      goalProvinces: own.length + 1,
      goalPointShareFirstPermille: scorePermille + 1,
      goalPopulationSharePermille: populationPermille + 1,
      goalPointShareSecondPermille: scorePermille + 1,
    })
    expect(goalsOf(advanceDays(fresh(above), 1, above).state)['p1']).toEqual(EMPTY)
  })
})

describe('R-GAME-08/AK4 Ziele aendern weder Siegbedingung noch Siegschwelle', () => {
  it('laesst den Sieg offen, auch wenn jede Macht jedes Ziel erreicht hat', () => {
    const everything = rulesWith({
      goalProvinces: 1,
      goalPointShareFirstPermille: 1,
      goalPopulationSharePermille: 1,
      goalPointShareSecondPermille: 1,
    })
    const { state } = advanceDays(fresh(everything), 2, everything)

    for (const id of state.playerOrder) {
      for (const key of KEYS) expect(goalsOf(state)[id]![key], `${id} ${key}`).toBeTypeOf('number')
    }
    expect(state.victory).toEqual({ condition: 'points', pointsShareToWin: 900, dayLimit: null, winner: null, endedAtTick: null })
    expect(checkVictory(state, everything).winner).toBeNull()
  })

  it('aendert am Spielstand nichts ausser den Zielen — kein Zufall, kein Punkt, kein Sieg', () => {
    // Die schaerfste Form der Zusage „Rückmeldung, keine Regel": dieselbe Partie mit Marken,
    // die alles erreichen, und mit Marken, die nichts erreichen, ist ohne `goals` bitgleich.
    const everything = rulesWith({
      goalProvinces: 1,
      goalPointShareFirstPermille: 1,
      goalPopulationSharePermille: 1,
      goalPointShareSecondPermille: 1,
    })
    const nothing = rulesWith({})
    const a = advanceDays(fresh(everything), 5, everything).state
    const b = advanceDays(fresh(nothing), 5, nothing).state

    expect(goalsOf(a)).not.toEqual(goalsOf(b))
    const omit = { omitKeys: ['eventLog', 'goals'] }
    expect(hashValue(a, omit)).toBe(hashValue(b, omit))
  })
})

describe('R-GAME-08/AK1 Das Feld goals im Zustand', () => {
  it('legt fuer jede Macht alle vier Ziele offen an, in der Reihenfolge der Marken', () => {
    const state = fresh(TEST_RULES)

    expect(Object.keys(goalsOf(state))).toEqual(state.playerOrder)
    for (const id of state.playerOrder) {
      expect(goalsOf(state)[id]).toEqual(EMPTY)
      expect(Object.keys(goalsOf(state)[id]!)).toEqual([...KEYS])
    }
  })

  it('kopiert es beim Klonen, statt es zu teilen', () => {
    // Ein geteiltes inneres Record waere ein Determinismusfehler mit Ansage: der „vorherige"
    // Zustand aenderte sich mit.
    const state = fresh(TEST_RULES)
    const copy = cloneState(state)
    goalsOf(copy)['p1']!['provinces'] = 12

    expect(goalsOf(state)['p1']!['provinces']).toBeNull()
    expect(goalsOf(copy)).not.toBe(goalsOf(state))
  })

  it('verlangt es beim Laden', () => {
    const state = fresh(TEST_RULES)
    delete (state as unknown as Record<string, unknown>)['goals']

    expect(() => validateState(state)).toThrow(InvalidStateError)
    expect(() => validateState(state)).toThrow(/goals/)
  })

  it('verlangt einen Eintrag je Macht, statt mitten im Tagestick abzustuerzen', () => {
    // Ein Stand, dem der Eintrag einer Macht fehlt, laedt sonst fehlerfrei und wirft beim
    // naechsten Tageswechsel einen TypeError — fuer den Spieler ununterscheidbar von einem
    // Absturz des Spiels.
    const state = fresh(TEST_RULES)
    delete goalsOf(state)['p2']

    expect(() => validateState(state)).toThrow(/goals.*p2/)
  })
})

describe('R-GAME-08/AK2 Ein erreichtes Ziel meldet sich genau einmal und nur bei der eigenen Macht', () => {
  type Reached = GameEvent & { playerId: string; goal: string; day: number }

  /** Faehrt ganze Spieltage und sammelt den Ereignisstrom — nie den Ringpuffer. */
  function stream(start: GameState, days: number, rules: Rules): { state: GameState; events: GameEvent[] } {
    const ctx = { map: smallWorld(), rules }
    let state = start
    const events: GameEvent[] = []
    for (let i = 0; i < days * rules.constants.ticksPerDay; i++) {
      const result = step(state, [], ctx)
      state = result.state
      events.push(...result.events)
    }
    return { state, events }
  }

  const reachedIn = (events: readonly GameEvent[]): Reached[] =>
    events.filter((event) => (event.type as string) === 'GOAL_REACHED') as Reached[]

  const everything = rulesWith({
    goalProvinces: 1,
    goalPointShareFirstPermille: 1,
    goalPopulationSharePermille: 1,
    goalPointShareSecondPermille: 1,
  })

  it('meldet ueber einen Lauf je Macht und Ziel genau ein Ereignis, mit dem Tag aus dem Spielstand', () => {
    const { state, events } = stream(fresh(everything), 6, everything)
    const reached = reachedIn(events)

    expect(reached).toHaveLength(state.playerOrder.length * KEYS.length)
    for (const id of state.playerOrder) {
      for (const key of KEYS) {
        const mine = reached.filter((event) => event.playerId === id && event.goal === key)
        expect(mine, `${id} ${key}`).toHaveLength(1)
        expect(mine[0]!.day, `${id} ${key}`).toBe(goalsOf(state)[id]![key])
      }
    }
  })

  it('meldet ein wieder erreichtes Ziel kein zweites Mal', () => {
    const rules = rulesWith({ goalProvinces: 4 })
    const start = fresh(rules)
    start.provinces['o1']!.owner = 'p1'
    const first = stream(start, 1, rules)
    first.state.provinces['o1']!.owner = 'p2'
    const dropped = stream(first.state, 2, rules)
    dropped.state.provinces['o1']!.owner = 'p1'
    const regained = stream(dropped.state, 2, rules)

    const all = [...first.events, ...dropped.events, ...regained.events]
    expect(reachedIn(all).filter((event) => event.playerId === 'p1')).toHaveLength(1)
  })

  it('sieht keine andere Macht', () => {
    const { state, events } = stream(fresh(everything), 2, everything)
    const reached = reachedIn(events)
    expect(reached.length, 'Vorbedingung: es gibt Meldungen').toBeGreaterThan(0)

    for (const event of reached) {
      expect(event.audience).toEqual([event.playerId])
      expect(event.concerns).toEqual([event.playerId])
    }
    for (const viewer of state.playerOrder) {
      const visible = reachedIn(eventsFor(events, viewer))
      expect(visible.length, `${viewer} sieht seine eigenen`).toBe(KEYS.length)
      expect(visible.every((event) => event.playerId === viewer), `${viewer} sieht fremde Ziele`).toBe(true)
    }
  })

  it('haelt das Vorspulen nicht an: Rueckmeldung, kein Alarm, keine Weltnachricht', () => {
    const { events } = stream(fresh(everything), 2, everything)
    const reached = reachedIn(events)

    expect(EVENT_TYPES as readonly string[]).toContain('GOAL_REACHED')
    expect(reached.length).toBeGreaterThan(0)
    expect(reached.every((event) => event.severity === 'info')).toBe(true)
    expect(ALERT_TYPES as readonly string[]).not.toContain('GOAL_REACHED')
    expect(WORLD_EVENT_TYPES as readonly string[]).not.toContain('GOAL_REACHED')
    expect(reachedIn(alertsIn(events))).toEqual([])
    expect(reachedIn(worldEventsIn(events))).toEqual([])
  })
})
