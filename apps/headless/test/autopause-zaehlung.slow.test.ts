import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import {
  createInitialState,
  firstAlertFor,
  parseRules,
  type GameEvent,
  type MapData,
  type Rules,
} from '@worldwar/core'
import { isAutoPauseTrigger } from '../../desktop/src/game/events'
import { DEFAULT_NEW_GAME, toConfig } from '../../desktop/src/game/newGame'

/**
 * Zaehlung der Auto-Pause-Ausloeser (VM-06, P2).
 *
 * Pausen = Ticks mit >= 1 Ausloeser (mehrere im selben Tick = 1 Pause), keine Sperrzeit.
 * Zwei Vollpartien (Startzahl 1914, 1915), je Tick `advanceTicks(state, 1, ...)` wie die
 * Desktop-Uhr, fuer JEDE Macht als Betrachter. Die Hauptstadt wird aus dem Stand VOR dem
 * Tick genommen. Gate: je Partie max. Pausen ueber alle Maechte <= 10. Paritaet: jeder
 * Ausloeser ist fuer die Macht auch ein firstAlertFor-Alarm (core clock.ts).
 * Zaehlung endet am Spielende. Schreibt docs/reports/v3/autopause-zaehlung.md.
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
const MAX_DAYS = 1500
const LIMIT = 10

interface Result {
  seed: number
  endDay: number
  winner: string | null
  pausesByPower: Record<string, number>
  typesByPower: Record<string, Record<string, number>>
  triggers: number
  parityChecked: number
  max: number
  maxPower: string
}

const play = async (seed: number): Promise<Result> => {
  const config = toConfig({ ...DEFAULT_NEW_GAME, seed }, map)
  let state = createInitialState(config, { map, rules })
  const powers = [...state.playerOrder]
  const perDay = rules.constants.ticksPerDay
  const pausesByPower: Record<string, number> = Object.fromEntries(powers.map((p) => [p, 0]))
  const typesByPower: Record<string, Record<string, number>> = Object.fromEntries(powers.map((p) => [p, {}]))
  let triggers = 0
  let parityChecked = 0
  const maxTicks = MAX_DAYS * perDay
  for (let i = 0; i < maxTicks && state.victory.winner === null; i += 1) {
    const capitals = Object.fromEntries(powers.map((p) => [p, state.players[p]?.capitalProvinceId ?? null]))
    const step = advanceTicks(state, 1, { map, rules })
    state = step.state
    for (const p of powers) {
      let paused = false
      for (const event of step.events as GameEvent[]) {
        if (!isAutoPauseTrigger(event, p, capitals[p] ?? null)) continue
        paused = true
        triggers += 1
        typesByPower[p]![event.type] = (typesByPower[p]![event.type] ?? 0) + 1
        // Paritaet: jeder Ausloeser ist auch ein Alarm fuer diese Macht (core firstAlertFor).
        parityChecked += 1
        expect(firstAlertFor([event], p), `${event.type} fuer ${p} ist kein Alarm`).not.toBeNull()
      }
      if (paused) pausesByPower[p] = (pausesByPower[p] ?? 0) + 1
    }
    if (i % 2000 === 1999) await breathe()
  }
  let max = 0
  let maxPower = ''
  for (const [p, n] of Object.entries(pausesByPower)) {
    if (n > max) {
      max = n
      maxPower = p
    }
  }
  return {
    seed,
    endDay: Math.floor(state.tick / perDay),
    winner: state.victory.winner,
    pausesByPower,
    typesByPower,
    triggers,
    parityChecked,
    max,
    maxPower,
  }
}

describe('Auto-Pause-Zaehlung (VM-06)', () => {
  it('zaehlt zwei Vollpartien, haelt <= 10 Pausen je Macht und schreibt den Bericht', async () => {
    const results: Result[] = []
    for (const seed of [1914, 1915]) {
      results.push(await play(seed))
      await breathe()
    }
    const commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
    const out: string[] = []
    out.push('# Auto-Pause-Zaehlung (VM-06, B1)')
    out.push('')
    out.push(`Gemessen auf: ${commit} · Ausloeser: WAR_DECLARED an mich, CAPITAL_LOST (ARMY_INTRUDED gestrichen, siehe unten) · Pause = Tick mit >= 1 Ausloeser, keine Sperrzeit · jede Macht als Betrachter · Gate: max. ${LIMIT} je Macht und Partie.`)
    out.push('')
    out.push('Erzeugt von `apps/headless/test/autopause-zaehlung.slow.test.ts`. Simulation (KI spielt alle Maechte), keine Zeitmessung.')
    out.push('')
    out.push('**Streichung (P2):** Erstlauf mit ARMY_INTRUDED in die eigene Hauptstadt als dritten Ausloeser: Maximum 38 Pausen (1914, p7) und 90 (1915, p7) - Gate gerissen. ARMY_INTRUDED wurde laut Plan gestrichen; die Zahlen unten gelten fuer WAR_DECLARED + CAPITAL_LOST.')
    for (const r of results) {
      out.push('')
      out.push(`## Startzahl ${r.seed}`)
      out.push('')
      out.push(`Entscheidung an Tag ${r.endDay}, Sieger ${String(r.winner)}. Ausloeser gesamt: ${r.triggers}, Paritaetspruefung (firstAlertFor): ${r.parityChecked} von ${r.triggers} bestanden. **Maximum: ${r.max} Pausen (${r.maxPower || '-'})** - Gate <= ${LIMIT}: ${r.max <= LIMIT ? 'erfuellt' : 'GERISSEN'}.`)
      out.push('')
      out.push('| Macht | Pausen | Typen |')
      out.push('| --- | ---: | --- |')
      for (const [p, n] of Object.entries(r.pausesByPower)) {
        const types = Object.entries(r.typesByPower[p]!)
          .map(([t, c]) => `${t}: ${c}`)
          .join(', ')
        out.push(`| ${p} | ${n} | ${types || '-'} |`)
      }
    }
    out.push('')
    const dir = `${ROOT}/docs/reports/v3`
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}/autopause-zaehlung.md`, out.join('\n'))

    for (const r of results) {
      expect(r.winner, `Partie ${r.seed} nicht entschieden`).not.toBeNull()
      expect(r.parityChecked).toBe(r.triggers)
    }
    expect(results.reduce((s, r) => s + r.triggers, 0), 'Zaehlung misst nichts').toBeGreaterThan(0)
    for (const r of results) expect(r.max, `Partie ${r.seed}`).toBeLessThanOrEqual(LIMIT)
  }, 1_800_000)
})
