import { readFileSync } from 'node:fs'
import { createInitialState, parseRules, type MapData } from '@worldwar/core'
import { describe, expect, it } from 'vitest'
import { recruitActions } from './actions'
import { DEFAULT_NEW_GAME, toConfig } from './newGame.ts'

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

function setup(occupiedAgo: number) {
  const state = createInitialState(toConfig({ ...DEFAULT_NEW_GAME, nation: 'Deutschland', opponents: 3 }, map), { map, rules })
  state.tick = 95 * rules.constants.ticksPerDay
  for (const k of Object.keys(state.players.p1!.resources)) (state.players.p1!.resources as Record<string, number>)[k] = 99_000_000
  const target = state.provinceOrder.find((id) => {
    const p = state.provinces[id]!
    return p.owner === 'p2' && p.coastal
  })!
  const p = state.provinces[target]!
  p.buildings = { barracks: 3, fortress: 5, factory: 3, harbour: 2, shipyard: 2, airfield: 2, railway: 3 } as never
  p.owner = 'p1'
  p.occupiedSince = state.tick - occupiedAgo
  p.morale = 10_000
  return { target, ctx: { state, map, rules, playerId: 'p1', ticksPerDay: rules.constants.ticksPerDay } }
}

describe('R-UNIT-02/AK1 Aushebe-Knoepfe in eroberter Provinz', () => {
  it('in der Schonfrist ist jeder Aushebe-Knopf frei', () => {
    const { target, ctx } = setup(24)
    const actions = recruitActions(ctx, target)
    expect(actions.length).toBeGreaterThan(0)
    for (const a of actions) expect(a.disabledReason, a.id).toBeNull()
  })

  it('nach der Schonfrist sind alle gesperrt (Moral 10_000)', () => {
    const { target, ctx } = setup(rules.constants.occupationPenaltyDays * rules.constants.ticksPerDay)
    const actions = recruitActions(ctx, target)
    expect(actions.length).toBeGreaterThan(0)
    for (const a of actions) expect(a.disabledReason, a.id).not.toBeNull()
  })
})
