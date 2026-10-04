import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import { hashValue } from '@worldwar/shared'
import { HASH_OMIT_KEYS, deserialise, parseRules, type GameState, type MapData, type Rules } from '@worldwar/core'

/**
 * Verhaltensbeleg der V3 (Regel 3a): Spaetspiel-Hash vorher = nachher.
 *
 * Je Stand (S100/S300/S575 unter `test/fixtures/v3/`) 720 Ticks MIT KI ueber den ausgelieferten
 * Weg (`advanceTicks`), Hash mit `HASH_OMIT_KEYS`. Zwei Laeufe je Stand muessen denselben Hash
 * geben (Determinismus-Gegenprobe). Der Hash steht in `docs/reports/v3/verhalten-hash.json`.
 *
 * Ist die Datei schon da, gilt sie als Ausgangswert: eine Leistungsaenderung, die einen Hash
 * veraendert, ist verhaltensaendernd und scheitert hier. Neu festgelegt wird nur, indem die
 * Datei bewusst geloescht oder per `WORLDWAR_V3_REBASE=1` ersetzt wird (nie, um eine Zahl passend
 * zu machen).
 */
const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const load = (path: string) => JSON.parse(readFileSync(`${ROOT}/${path}`, 'utf8')) as never
const rules: Rules = parseRules(
  {
    constants: load('data/rules/default/constants.json'),
    resources: load('data/rules/default/resources.json'),
    buildings: load('data/rules/default/buildings.json'),
    units: load('data/rules/default/units.json'),
    ai: load('data/rules/default/ai.json'),
  },
  'default',
)
const map = load('data/maps/world.json') as MapData
const TICKS = 720
const STANDS = ['S100', 'S300', 'S575'] as const
const REPORT = `${ROOT}/docs/reports/v3/verhalten-hash.json`

function loadStand(name: string): GameState {
  const gz = `${ROOT}/test/fixtures/v3/${name}.json.gz`
  const text = existsSync(gz) ? gunzipSync(readFileSync(gz)).toString('utf8') : readFileSync(`${ROOT}/test/fixtures/v3/${name}.json`, 'utf8')
  return deserialise(text)
}

const hashAfter = (name: string): { hash: string; tick: number; winner: string | null } => {
  const out = advanceTicks(loadStand(name), TICKS, { map, rules })
  return { hash: hashValue(out.state, { omitKeys: HASH_OMIT_KEYS }), tick: out.state.tick, winner: out.state.victory.winner }
}

describe('V3-Verhalten: Spaetspiel-Hash', () => {
  it.each(STANDS)('%s: 720 Ticks mit KI, zwei Laeufe gleicher Hash, gleich dem Ausgangswert', (name) => {
    const first = hashAfter(name)
    const second = hashAfter(name)
    expect(second.hash).toBe(first.hash)

    const existing = existsSync(REPORT) ? (JSON.parse(readFileSync(REPORT, 'utf8')) as Record<string, unknown>) : {}
    const stands = { ...((existing['stands'] as Record<string, unknown> | undefined) ?? {}) }
    const baseline = stands[name] as { hash: string } | undefined
    if (baseline && process.env['WORLDWAR_V3_REBASE'] !== '1') {
      expect(first.hash).toBe(baseline.hash)
    } else {
      stands[name] = { ticks: TICKS, hash: first.hash, endTick: first.tick, winner: first.winner }
      mkdirSync(`${ROOT}/docs/reports/v3`, { recursive: true })
      writeFileSync(REPORT, JSON.stringify({ note: 'Erzeugt von apps/headless/test/v3-verhalten.slow.test.ts (Regel 3a der V3).', stands }, null, 2) + '\n')
    }
  })
})
