import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { canonicalText, hashValue } from '@worldwar/shared'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { HASH_OMIT_KEYS, SCHEMA_VERSION, type GameState } from '../state/types'
import { step } from '../step'
import {
  ADDED_IN_VERSION_2,
  ADDED_IN_VERSION_3,
  ADDED_IN_VERSION_4,
  REMOVED_IN_VERSION_4,
  migrate,
  type SaveEnvelope,
} from './migrate'
import { deserialise, serialise } from './save'

/**
 * Der Schritt 2 → 3 (T-M35-03, R-GAME-08/AK5, D31.5).
 *
 * Gefahren an einem **eingefrorenen echten Stand der Stufe 2**
 * (`packages/core/test/golden/save-v2.json`), erzeugt am 2026-09-13 mit dem damaligen
 * `serialise`, bevor `goals` entstand — und danach nie wieder neu erzeugt. Muster ist
 * `save-v1.json` (D19.5): eine Testtabelle haette nur die Kette geprueft, nicht diesen Schritt.
 */

const load = (name: string): SaveEnvelope =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../test/golden/${name}`, import.meta.url)), 'utf8')) as SaveEnvelope

const V1 = load('save-v1.json')
const V2 = load('save-v2.json')
const copy = (envelope: SaveEnvelope): SaveEnvelope => JSON.parse(JSON.stringify(envelope)) as SaveEnvelope

const EMPTY = { provinces: null, pointShareFirst: null, populationShare: null, pointShareSecond: null }
type WithGoals = GameState & { goals: Record<string, Record<string, number | null>> }

/** Entfernt die genannten Schluessel in jeder Tiefe — was bleibt, darf sich nicht unterscheiden. */
function strip(value: unknown, keys: readonly string[]): unknown {
  if (Array.isArray(value)) return value.map((entry) => strip(entry, keys))
  if (value === null || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (keys.includes(key)) continue
    out[key] = strip(entry, keys)
  }
  return out
}

const hashOf = (state: GameState) => hashValue(state, { omitKeys: HASH_OMIT_KEYS })

describe('R-GAME-08/AK5 Ein Stand der Stufe 2 laeuft mit leeren Zielen weiter', () => {
  it('ist ein echter Stand der Stufe 2, der die Felder dieser Stufe wirklich traegt', () => {
    // Ohne diese Vorbedingung pruefte der Schritt einen Stand, an dem es nichts zu verlieren gibt.
    const state = V2.state
    expect(V2.schemaVersion).toBe(2)
    expect(state.schemaVersion).toBe(2)
    expect('goals' in state, 'der eingefrorene Stand stammt von nach dem Schritt').toBe(false)
    expect(Object.keys(state.diplomacy.grievances).length, 'keine Verstimmung').toBeGreaterThan(0)
    expect(state.armyOrder.some((id) => state.armies[id]!.holdFire), 'keine Feuerleitung').toBe(true)
    expect(state.eventLog.some((event) => event.concerns.length > 0), 'kein Betroffenenfeld').toBe(true)
    expect(state.eventLog.map((event) => event.type)).toEqual(expect.arrayContaining(['PROVINCE_CAPTURED', 'BATTLE_RESOLVED']))
  })

  it('laedt ihn auf die aktuelle Stufe und legt fuer jede Macht vier offene Ziele an', () => {
    const state = deserialise(JSON.stringify(copy(V2))) as WithGoals

    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(Object.keys(state.goals)).toEqual(state.playerOrder)
    for (const id of state.playerOrder) expect(state.goals[id], id).toEqual(EMPTY)
  })

  it('aendert nichts ausser den Feldern des Schritts', () => {
    // `migrate` fuehrt bis zur aktuellen Stufe, seit T-M17-03 also ueber 3 -> 4 hinweg;
    // abgezogen werden die Felder beider Schritte samt der von 3 -> 4 entfernten.
    const after = migrate(copy(V2)).state
    const beide = [...ADDED_IN_VERSION_3, ...ADDED_IN_VERSION_4, ...REMOVED_IN_VERSION_4]

    expect(canonicalText(strip(after, beide))).toBe(canonicalText(strip(V2.state, beide)))
    expect(ADDED_IN_VERSION_3).toEqual(['schemaVersion', 'goals'])
  })

  it('ist nach Speichern und Laden hashgleich', () => {
    const migrated = deserialise(JSON.stringify(copy(V2)))
    const again = deserialise(serialise(migrated))

    expect(hashOf(again)).toBe(hashOf(migrated))
  })

  it('laeuft danach zwei Spieltage weiter und bleibt ladbar', () => {
    const ctx = { map: smallWorld(), rules: TEST_RULES }
    let state = deserialise(JSON.stringify(copy(V2)))
    for (let i = 0; i < 48; i++) state = step(state, [], ctx).state

    expect(state.tick).toBe(V2.savedAtTick + 48)
    expect(Object.keys((state as WithGoals).goals)).toEqual(state.playerOrder)
    expect(hashOf(deserialise(serialise(state)))).toBe(hashOf(state))
  })
})

describe('R-GAME-08/AK5 Ein Stand der Stufe 1 liefert ueber beide Schritte dasselbe', () => {
  it('fuehrt save-v1.json auf die aktuelle Stufe, mit leeren Zielen', () => {
    const state = deserialise(JSON.stringify(copy(V1))) as WithGoals

    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    for (const id of state.playerOrder) expect(state.goals[id], id).toEqual(EMPTY)
  })

  it('liefert in einem Zug dasselbe wie Schritt fuer Schritt', () => {
    const direct = migrate(copy(V1))
    const second = migrate(copy(V1), undefined, 2)
    const stepwise = migrate(migrate(second, undefined, 3), undefined, 4)

    expect(second.schemaVersion).toBe(2)
    expect(canonicalText(stepwise)).toBe(canonicalText(direct))
  })

  it('aendert nichts ausser den Feldern aller Schritte', () => {
    const after = migrate(copy(V1)).state
    const added = [...ADDED_IN_VERSION_2, ...ADDED_IN_VERSION_3, ...ADDED_IN_VERSION_4, ...REMOVED_IN_VERSION_4]

    expect(canonicalText(strip(after, added))).toBe(canonicalText(strip(V1.state, added)))
  })

  it('ist nach Speichern und Laden hashgleich', () => {
    const migrated = deserialise(JSON.stringify(copy(V1)))

    expect(hashOf(deserialise(serialise(migrated)))).toBe(hashOf(migrated))
  })
})
