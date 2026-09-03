import { readFileSync } from 'node:fs'
import { createInitialState, parseRules, type Command, type MapData } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import { advance } from './advance.ts'
import { DEFAULT_NEW_GAME, toConfig } from './newGame.ts'

/**
 * The desktop's clock loop (R-AI-01, R-UI-07).
 *
 * The bug this guards against was visible in the first smoke test: a day of
 * fast-forward produced one "Bau begonnen" and twenty-three "Befehl abgelehnt",
 * because the AI's orders from the first hour were re-applied to every hour after it.
 */

const ROOT = process.cwd()
const load = (path: string) => JSON.parse(readFileSync(`${ROOT}/${path}`, 'utf8')) as never
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

const fresh = () =>
  createInitialState(toConfig({ ...DEFAULT_NEW_GAME, nation: 'Deutschland', opponents: 3 }, map), ctx)

describe('R-AI-01 Die KI kommt jede Stunde zu Wort', () => {
  it('laesst ueber einen Tag keinen Befehl abgelehnt werden', () => {
    const after = advance(fresh(), 24, ctx)

    expect(after.tick).toBe(24)
    const rejected = after.eventLog.filter((event) => event.type === 'COMMAND_REJECTED')
    expect(rejected, rejected.map((e) => JSON.stringify(e)).join('\n')).toHaveLength(0)
  })

  it('laesst die Gegner tatsaechlich handeln', () => {
    const after = advance(fresh(), 24, ctx)

    const foreign = after.eventLog.filter(
      (event) => 'playerId' in event && (event as { playerId: string }).playerId !== 'p1',
    )
    expect(foreign.length).toBeGreaterThan(0)
  })

  it('wendet den Spielerbefehl genau einmal an, im ersten Tick', () => {
    const state = fresh()
    const capital = state.players.p1!.capitalProvinceId!
    const build: Command = { type: 'BUILD', playerId: 'p1', provinceId: capital, building: 'barracks' }

    const after = advance(state, 24, ctx, [build])

    const started = after.eventLog.filter(
      (event) => event.type === 'BUILD_STARTED' && (event as { playerId: string }).playerId === 'p1',
    )
    expect(started).toHaveLength(1)
    expect((started[0] as { tick: number }).tick).toBe(0)
    expect(after.eventLog.some((event) => event.type === 'COMMAND_REJECTED')).toBe(false)
  })

  it('haelt an, sobald die Partie entschieden ist', () => {
    const state = fresh()
    const decided = { ...state, victory: { ...state.victory, winner: 'p1' } }

    expect(advance(decided as never, 5, ctx).tick).toBe(state.tick)
  })
})
