import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { applyCommand } from '../commands/registry'
import { createInitialState, type GameConfig } from '../state/create'
import type { Command } from '../commands/types'
import type { PhaseContext } from '../phases/index'
import { tickOfDay } from './availability'
import { RulesError, parseRules } from './load'

/**
 * Die Freischaltungsachse (T-M15-02, R-TECH-01).
 *
 * Der Befund, um den es geht, war kein Fehler in einer Formel, sondern eine fehlende
 * Achse: **Tag 1 unterschied sich von Tag 40 durch nichts als den Kontostand.** Alles war
 * vom ersten Tick an baubar, es gab keine Entwicklung und nichts, worauf man hinarbeitet.
 *
 * Die Antwort ist ein Feld, eine Ablehnung und ein Text — keine neue Mechanik. Jede
 * Sache trägt einen ersten Spieltag; davor lehnt der Kern ab und **nennt den Tag**, ab
 * dem es geht. Für Mensch und KI dieselbe Regel: der Kern kennt den Unterschied nicht.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const raw = (name: string): unknown => JSON.parse(readFileSync(`${ROOT}/data/rules/default/${name}.json`, 'utf8'))

const rawRules = () => ({
  constants: raw('constants'),
  resources: raw('resources'),
  buildings: raw('buildings'),
  units: raw('units'),
  ai: raw('ai'),
})

const CONFIG: GameConfig = {
  seed: 3,
  mapId: 'testworld',
  rulesId: 'test',
  players: [
    { name: 'Mensch', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'Rechner', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 600, dayLimit: null },
}

// `events` gehoert zum Kontext, den die Kommandos beim Anwenden fuellen — ohne ihn
// laeuft nur der Ablehnungspfad, und ein Test, der nur ablehnt, belegt AK2 nicht.
const ctx: PhaseContext = { map: smallWorld(), rules: TEST_RULES, commands: [], events: [] }

/** Eine Provinz mit allen Gebäuden und vollen Kassen — damit nur der Tag ablehnen kann. */
function ready(atDay: number) {
  const state = createInitialState(CONFIG, ctx)
  state.tick = tickOfDay(atDay, TEST_RULES)
  const province = state.provinces['n1']!
  province.owner = 'p1'
  province.morale = 90_000
  for (const key of Object.keys(TEST_RULES.buildings)) {
    province.buildings[key as keyof typeof province.buildings] = 1
  }
  for (const key of Object.keys(state.players['p1']!.resources)) {
    state.players['p1']!.resources[key as 'money'] = 99_000_000
  }
  state.players['p2']!.resources = { ...state.players['p1']!.resources }
  return state
}

const reject = (state: ReturnType<typeof ready>, command: Command) => applyCommand(state, command, ctx)

describe('R-TECH-01/AK1 Vor ihrem Tag gibt es die Sache nicht', () => {
  it('lehnt eine Fabrik an Spieltag 1 ab und nennt den Tag', () => {
    const rejected = reject(ready(1), { type: 'BUILD', playerId: 'p1', provinceId: 'n1', building: 'factory' })

    expect(rejected).toMatchObject({ ok: false, code: 'NOT_YET_AVAILABLE' })
    // Der Tag steht im Detail — die Ablehnung sagt "ab Tag 8", nicht "geht nicht".
    expect(rejected.ok ? undefined : rejected.detail).toMatchObject({ availableFromDay: 8 })
  })

  it('lehnt einen Jaeger vor Tag 10 ab', () => {
    const rejected = reject(ready(9), {
      type: 'RECRUIT',
      playerId: 'p1',
      provinceId: 'n1',
      unitKey: 'fighter',
      count: 1,
    })

    expect(rejected).toMatchObject({ ok: false, code: 'NOT_YET_AVAILABLE' })
  })

  it('kennt bei der KI keinen Unterschied', () => {
    // Derselbe Auftrag mit einer KI-Macht als Absender. Eine Freischaltung, die nur den
    // Menschen bremst, waere ein Bonus fuer die KI — und R-AI-02 verlangt, dass Boni im
    // UI ausgewiesen werden. Der billigste Weg, das nicht zu verletzen: es gibt keinen.
    const state = ready(1)
    state.provinces['n1']!.owner = 'p2'

    const rejected = reject(state, { type: 'BUILD', playerId: 'p2', provinceId: 'n1', building: 'factory' })
    expect(rejected).toMatchObject({ ok: false, code: 'NOT_YET_AVAILABLE' })
  })
})

describe('R-TECH-01/AK2 Ab ihrem Tag gibt es sie', () => {
  it('nimmt dieselbe Fabrik an Tag 8 an', () => {
    const state = ready(8)
    const before = state.provinces['n1']!.buildQueue.length
    const result = applyCommand(state, { type: 'BUILD', playerId: 'p1', provinceId: 'n1', building: 'factory' }, ctx)

    expect(result.ok, JSON.stringify(result)).toBe(true)
    expect(state.provinces['n1']!.buildQueue.length).toBe(before + 1)
  })

  it('nimmt den Jaeger an Tag 10 an', () => {
    const result = applyCommand(
      ready(10),
      { type: 'RECRUIT', playerId: 'p1', provinceId: 'n1', unitKey: 'fighter', count: 1 },
      ctx,
    )

    expect(result.ok, JSON.stringify(result)).toBe(true)
  })
})

describe('R-TECH-01/AK3 Ein fehlender Tag ist ein Fehler, keine Vorgabe', () => {
  it('lehnt ein Gebaeude ohne availableFromDay ab und nennt es beim Namen', () => {
    // Die Lehre aus N1: eine fehlende Angabe darf nicht still zu einer Vorgabe werden.
    // "Fehlt der Tag, gilt Tag 1" waere genau der Zustand, den diese Aufgabe behebt —
    // nur unauffindbar.
    const rules = rawRules()
    delete (rules.buildings as { buildings: Record<string, unknown> }).buildings['factory']!['availableFromDay' as never]

    expect(() => parseRules(rules, 'test')).toThrow(RulesError)
    expect(() => parseRules(rules, 'test')).toThrow(/factory|Fabrik/)
  })

  it('lehnt eine Einheit ab, die es frueher gibt als ihr Gebaeude', () => {
    // Eine Einheit vor ihrem Gebaeude ist nicht frueh verfuegbar, sondern nie: der
    // Bauauftrag scheitert dann an MISSING_BUILDING statt am Tag, und der Spieler liest
    // die falsche Begruendung.
    const rules = rawRules()
    const units = (rules.units as { units: Record<string, Record<string, unknown>> }).units
    units['tank']!['availableFromDay'] = 2 // Fabrik gibt es ab Tag 8

    expect(() => parseRules(rules, 'test')).toThrow(RulesError)
    expect(() => parseRules(rules, 'test')).toThrow(/tank|Panzer/)
  })

  it('nimmt das ausgelieferte Regelwerk unveraendert an', () => {
    // Die Gegenrichtung: die beiden Zusicherungen oben waeren auch dann gruen, wenn der
    // Lader alles ablehnte.
    expect(() => parseRules(rawRules(), 'test')).not.toThrow()
  })
})

describe('R-TECH-01 Die belegten Tage stehen im Regelwerk', () => {
  it('traegt die fuenf belegten Tage woertlich', () => {
    const buildings = (raw('buildings') as { buildings: Record<string, { availableFromDay?: number }> }).buildings

    expect(buildings['barracks']?.availableFromDay).toBe(1)
    expect(buildings['harbour']?.availableFromDay).toBe(2)
    expect(buildings['railway']?.availableFromDay).toBe(5)
    expect(buildings['factory']?.availableFromDay).toBe(8)
    expect(buildings['airfield']?.availableFromDay).toBe(10)
  })

  it('gibt jedem Gebaeude und jeder Einheit einen Tag', () => {
    const buildings = (raw('buildings') as { buildings: Record<string, { availableFromDay?: number }> }).buildings
    const units = (raw('units') as { units: Record<string, { availableFromDay?: number }> }).units

    for (const [key, rule] of Object.entries(buildings)) {
      expect(rule.availableFromDay, `Gebäude "${key}" ohne ersten Spieltag`).toBeGreaterThan(0)
    }
    for (const [key, rule] of Object.entries(units)) {
      expect(rule.availableFromDay, `Einheit "${key}" ohne ersten Spieltag`).toBeGreaterThan(0)
    }
    expect(Object.keys(buildings).length).toBe(7)
    expect(Object.keys(units).length).toBe(10)
  })
})
