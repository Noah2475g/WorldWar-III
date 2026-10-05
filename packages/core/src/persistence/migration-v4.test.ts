import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { canonicalText, hashValue } from '@worldwar/shared'
import { describe, expect, it } from 'vitest'
import { parseRules } from '../rules/load'
import type { RawRules } from '../rules/types'
import { HASH_OMIT_KEYS, SCHEMA_VERSION, type GameState, type MapData } from '../state/types'
import { step } from '../step'
import { ADDED_IN_VERSION_5, migrate, type SaveEnvelope } from './migrate'
import { deserialise, serialise } from './save'
import { validateState } from './validate'

/**
 * Der Schritt 4 → 5 (Liefervertrag B1, D6).
 *
 * Gefahren an einem **eingefrorenen echten Stand der Stufe 4**
 * (`packages/core/test/golden/save-v4.json`): 30 Spieltage Weltkarte, gespielt, mit einem offenen
 * Handelsangebot des Menschen. Der Schritt legt nur `diplomacy.contracts` (leer) und
 * `nextIds.contract` (1) an — alles andere, auch das offene Angebot ohne `schedule`, bleibt.
 */

const V4 = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../test/golden/save-v4.json', import.meta.url)), 'utf8'),
) as SaveEnvelope
const copy = (envelope: SaveEnvelope): SaveEnvelope => JSON.parse(JSON.stringify(envelope)) as SaveEnvelope

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const data = (path: string): unknown => JSON.parse(readFileSync(`${ROOT}/data/${path}`, 'utf8'))
const WELT = {
  map: data('maps/world.json') as MapData,
  rules: parseRules(
    {
      constants: data('rules/default/constants.json'),
      resources: data('rules/default/resources.json'),
      buildings: data('rules/default/buildings.json'),
      units: data('rules/default/units.json'),
      ai: data('rules/default/ai.json'),
    } as RawRules,
    'default',
  ),
}

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

describe('Liefervertrag B1 Ein Stand der Stufe 4 laeuft nach der Migration weiter', () => {
  it('ist ein echter Stand der Stufe 4 mit offenem Handelsangebot ohne Vertraege', () => {
    expect(V4.schemaVersion).toBe(4)
    expect(V4.state.schemaVersion).toBe(4)
    const diplomacy = V4.state.diplomacy as unknown as Record<string, unknown>
    expect('contracts' in diplomacy, 'der eingefrorene Stand stammt von nach dem Schritt').toBe(false)
    expect('contract' in (V4.state.nextIds as unknown as Record<string, unknown>)).toBe(false)
    const offers = diplomacy['tradeOffers'] as unknown[]
    expect(offers.length, 'kein offenes Handelsangebot').toBeGreaterThanOrEqual(1)
  })

  it('laedt auf die aktuelle Stufe, mit leeren Vertraegen und Zaehler 1', () => {
    const state = deserialise(JSON.stringify(copy(V4)))

    expect(SCHEMA_VERSION).toBe(5)
    expect(state.schemaVersion).toBe(SCHEMA_VERSION)
    expect(state.diplomacy.contracts).toEqual([])
    expect(state.nextIds.contract).toBe(1)
    // Das offene Angebot kommt unveraendert mit, ohne `schedule`-Schluessel.
    expect(state.diplomacy.tradeOffers.length).toBeGreaterThanOrEqual(1)
    expect(state.diplomacy.tradeOffers.every((offer) => !('schedule' in offer))).toBe(true)
  })

  it('aendert nichts ausser den neuen Schluesseln', () => {
    const after = migrate(copy(V4)).state

    expect(canonicalText(strip(after, ADDED_IN_VERSION_5))).toBe(canonicalText(strip(V4.state, ADDED_IN_VERSION_5)))
    expect(ADDED_IN_VERSION_5).toEqual(['schemaVersion', 'contracts', 'contract'])
  })

  it('besteht validateState', () => {
    const migrated = migrate(copy(V4)).state
    expect(() => validateState(migrated)).not.toThrow()
  })

  it('ist nach Speichern und Laden hashgleich', () => {
    const migrated = deserialise(JSON.stringify(copy(V4)))
    expect(hashOf(deserialise(serialise(migrated)))).toBe(hashOf(migrated))
  })

  it('laeuft danach zwei Spieltage weiter, bleibt ladbar und rechnet nach dem Laden gleich', () => {
    const start = deserialise(JSON.stringify(copy(V4)))
    let durch = start
    for (let i = 0; i < 48; i++) durch = step(durch, [], WELT).state
    expect(durch.tick).toBe(V4.savedAtTick + 48)
    expect(hashOf(deserialise(serialise(durch)))).toBe(hashOf(durch))

    let geteilt = start
    for (let i = 0; i < 20; i++) geteilt = step(geteilt, [], WELT).state
    geteilt = deserialise(serialise(geteilt))
    for (let i = 0; i < 28; i++) geteilt = step(geteilt, [], WELT).state
    expect(hashOf(geteilt)).toBe(hashOf(durch))
  })
})
