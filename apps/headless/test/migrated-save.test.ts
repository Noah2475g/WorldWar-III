import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import {
  HASH_OMIT_KEYS,
  SCHEMA_VERSION,
  deserialise,
  parseRules,
  serialise,
  type GameState,
  type MapData,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { describe, expect, it } from 'vitest'

/**
 * Der eingefrorene Stand der Stufe 3 spielt **mit KI** weiter (R-GAME-09/AK1, Nacharbeit zu
 * T-M17-03, 2026-09-24).
 *
 * `migration-v3.test.ts` im Kern rechnet den migrierten Stand ohne Befehle — der Kern darf die
 * KI nicht kennen. Ein Spieler laedt seinen Stand aber in eine Partie, in der sieben Maechte
 * von der KI gefuehrt werden, und die KI liest den migrierten Zustand auf ihren eigenen Wegen:
 * ueber die Sicht (`relations`, gerichtet gelesen) und ueber ihr Gedaechtnis in `state.ai`,
 * das die Migration nicht anfasst. Bis zum 2026-09-24 rechnete **kein** Test den Stand
 * `save-v3.json` auch nur einen Tick weiter.
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const load = (path: string): never => JSON.parse(readFileSync(`${ROOT}${path}`, 'utf8')) as never
const map = load('data/maps/world.json') as MapData
const rules = parseRules(
  {
    constants: load('data/rules/default/constants.json'),
    resources: load('data/rules/default/resources.json'),
    buildings: load('data/rules/default/buildings.json'),
    units: load('data/rules/default/units.json'),
    ai: load('data/rules/default/ai.json'),
  },
  'default',
)
const ctx = { map, rules }
const FROZEN = readFileSync(`${ROOT}packages/core/test/golden/save-v3.json`, 'utf8')
const hashOf = (state: GameState) => hashValue(state, { omitKeys: HASH_OMIT_KEYS })

/** Zwei Spieltage — genug, dass jede Tagesphase und jede KI-Entscheidung einmal durchlaeuft. */
const TICKS = 2 * rules.constants.ticksPerDay

describe('R-GAME-09/AK1 Der eingefrorene Stand der Stufe 3 spielt mit KI weiter', () => {
  it('rechnet zwei Spieltage mit sieben KI-Maechten und bleibt hashgleich ladbar', () => {
    expect(JSON.parse(FROZEN).schemaVersion, 'der eingefrorene Stand ist nicht mehr Stufe 3').toBe(3)
    const start = deserialise(FROZEN)
    expect(start.schemaVersion).toBe(SCHEMA_VERSION)
    // Die Migration legt die Spionage leer an — ein Stand der Stufe 3 kannte keine Spione.
    expect(start.espionage).toEqual({ spies: [], reveals: [] })

    const lauf = advanceTicks(start, TICKS, ctx)

    expect(lauf.state.tick).toBe(start.tick + TICKS)
    // Sonst haette die KI nichts gelesen, und der Test belegte nur den Kern ein zweites Mal.
    expect(lauf.applied.length, 'die KI hat in zwei Spieltagen keinen Befehl gegeben').toBeGreaterThan(0)
    // Seit T-M17-12 wirbt die KI Spione an, auch im migrierten Stand (Zusammenfuehrung der
    // Spionagebahn, 2026-09-25: bis dahin stand hier "bleibt leer"). Jeder Spion ist also nach
    // dem Start entstanden und haengt an einer lebenden Macht und einer echten Provinz — dieselbe
    // Pruefung, die `validateState` beim Laden je Element fuehrt (Befund M17-S7).
    const fehler = lauf.state.espionage.spies.flatMap((spy) => [
      ...(spy.recruitedTick >= start.tick ? [] : [`${spy.id}: vor dem Start angeworben`]),
      ...(lauf.state.players[spy.owner]?.alive ? [] : [`${spy.id}: Besitzer ${spy.owner} lebt nicht`]),
      ...(Object.hasOwn(lauf.state.provinces, spy.provinceId) ? [] : [`${spy.id}: Provinz ${spy.provinceId} fehlt`]),
    ])
    expect(fehler).toEqual([])
    expect(hashOf(deserialise(serialise(lauf.state)))).toBe(hashOf(lauf.state))
  })

  it('rechnet nach Speichern und Laden dasselbe wie ohne Unterbrechung', () => {
    const start = deserialise(FROZEN)
    const durch = advanceTicks(start, TICKS, ctx).state

    const halb = advanceTicks(start, TICKS / 2, ctx).state
    const weiter = advanceTicks(deserialise(serialise(halb)), TICKS / 2, ctx).state

    expect(hashOf(weiter)).toBe(hashOf(durch))
  })
})
