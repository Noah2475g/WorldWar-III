import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import { deserialise, parseRules, type GameState, type MapData, type Rules } from '@worldwar/core'
import { describeEvent, pingsFor } from './events.ts'
import { cueFor } from '../ui/sound.ts'

/**
 * Quote der hoerbaren Ereignisse mit Puls UND Sprung (V3 Nachbesserung U, T-M46-02 „Fertig wenn: Jedes hoerbare
 * Ereignis pulsiert an seinem Ort und ist per Klick anspringbar“; Ziel 100 %).
 *
 * Gefahren wird wie im Spielverhaeufe-Test: je Stand 720 Ticks MIT KI. Gezaehlt wird fuer JEDE Macht als
 * Betrachter (jede kann der Mensch sein): ein Ereignis ist hoerbar, wenn es einen Ton hat (`cueFor`) und die
 * Macht betrifft (`concerns`) - dieselbe Auswahl wie der Ton. Puls = `pingsFor` liefert einen Ort; Sprung =
 * `describeEvent` traegt `provinceId`. Schreibt `docs/reports/v3/ereignisort.json`.
 */
const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
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
const STANDS = ['S100', 'S300', 'S575'] as const

function loadStand(name: string): GameState {
  const gz = `${ROOT}/test/fixtures/v3/${name}.json.gz`
  const text = existsSync(gz) ? gunzipSync(readFileSync(gz)).toString('utf8') : readFileSync(`${ROOT}/test/fixtures/v3/${name}.json`, 'utf8')
  return deserialise(text)
}

describe('V3 Nachbesserung U: hoerbare Ereignisse haben Puls und Sprung', () => {
  it('Quote 100 % ueber S100/S300/S575, 720 Ticks mit KI, jede Macht als Betrachter', () => {
    const perType: Record<string, { audible: number; ping: number; jump: number; both: number }> = {}
    const total = { audible: 0, ping: 0, jump: 0, both: 0 }
    for (const name of STANDS) {
      const start = loadStand(name)
      const out = advanceTicks(start, 720, { map, rules })
      const end = out.state
      const capital = (id: string): string | undefined => end.players[id]?.capitalProvinceId ?? start.players[id]?.capitalProvinceId ?? undefined
      for (const viewer of Object.keys(start.players)) {
        const pings = new Set(pingsFor(out.events, viewer, capital).map((p) => `${p.tick}|${p.provinceId}`))
        out.events.forEach((event, index) => {
          if (!cueFor(event.type) || !(event.concerns ?? []).includes(viewer)) return
          const entry = describeEvent(event, index, map, { viewer, capital })
          const jump = Boolean(entry.provinceId)
          const ping = entry.provinceId ? pings.has(`${event.tick}|${entry.provinceId}`) : false
          const row = (perType[event.type] ??= { audible: 0, ping: 0, jump: 0, both: 0 })
          for (const r of [row, total]) {
            r.audible += 1
            if (ping) r.ping += 1
            if (jump) r.jump += 1
            if (ping && jump) r.both += 1
          }
        })
      }
    }
    mkdirSync(`${ROOT}/docs/reports/v3`, { recursive: true })
    writeFileSync(
      `${ROOT}/docs/reports/v3/ereignisort.json`,
      JSON.stringify({ note: 'Erzeugt von apps/desktop/src/game/ereignisort.slow.test.ts', stands: STANDS, total, perType }, null, 2) + '\n',
    )
    expect(total.audible).toBeGreaterThan(0)
    expect(total.both, JSON.stringify(perType)).toBe(total.audible)
  })
})
