import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import { createInitialState, deserialise, parseRules, serialise, type MapData, type Rules } from '@worldwar/core'
import { DEFAULT_NEW_GAME, toConfig } from '../../desktop/src/game/newGame'

/**
 * Die vier Spaetspiel-Staende der V3 (P0-A.1): S100, S300, S575; dazu S500 (G1-8: Messort fuer 10 s bei Tempo 100).
 *
 * Weltkarte, Startzahl 1914 (die ausgelieferte), die ausgelieferte Aufstellung (ein Mensch, der nichts befiehlt, und sieben KI; wie `fullgame.json`), bis Tag 100/300/575
 * mit dem ausgelieferten Weg (`advanceTicks`) gefahren und mit dem Kern-`serialise` versiegelt.
 * Tag 575 liegt 14 Tage vor der Entscheidung dieser Partie. Das Werkzeug ist kein Test im
 * eigentlichen Sinn: es erzeugt `test/fixtures/v3/S<tag>.json` (Stand ueber 1 MB: `.json.gz`)
 * und prueft nur, dass die Datei sich wieder laden laesst. Sonst kein Spielverhalten.
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
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('V3-Staende erzeugen', () => {
  it('schreibt S100, S300, S500 und S575', async () => {
    const config = toConfig({ ...DEFAULT_NEW_GAME, seed: 1914 }, map)
    let state = createInitialState(config, { map, rules })
    const dir = `${ROOT}/test/fixtures/v3`
    mkdirSync(dir, { recursive: true })
    const perDay = rules.constants.ticksPerDay
    const lines: string[] = []
    for (const day of [100, 300, 500, 575]) {
      while (state.tick < day * perDay) {
        const step = Math.min(10 * perDay, day * perDay - state.tick)
        const before = state.tick
        state = advanceTicks(state, step, { map, rules }).state
        if (state.tick === before) throw new Error(`Stand bleibt bei Tick ${before} stehen (Sieger: ${String(state.victory.winner)}) - Tag ${day} nicht erreichbar`)
        await breathe()
      }
      expect(state.victory.winner).toBeNull()
      const text = serialise(state, `V3 S${day}`)
      const gz = text.length > 1_000_000
      const file = `${dir}/S${day}.json${gz ? '.gz' : ''}`
      writeFileSync(file, gz ? gzipSync(Buffer.from(text, 'utf8'), { level: 9 }) : text)
      lines.push(`S${day}: tick ${state.tick}, json ${text.length} B, Datei ${statSync(file).size} B ${gz ? '(gz)' : ''}`)
      expect(deserialise(text).tick).toBe(day * perDay)
    }
    writeFileSync(`${dir}/README.txt`, `${lines.join('\n')}\nErzeugt von apps/headless/test/v3-staende.slow.test.ts (Startzahl 1914, ausgelieferte Aufstellung).\n`)
  })
})
