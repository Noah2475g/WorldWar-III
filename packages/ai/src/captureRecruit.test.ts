import { canApply, createInitialState, publicView, step, tickOfDay, type GameConfig, type GameState } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { emptyMemory } from './decide'
import { recruitCommands } from './economy'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const CONFIG: GameConfig = {
  seed: 404,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Mensch', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'KI', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}
const TARGET = 'n1'

function conquered(buildings: Record<string, number>, morale?: number): GameState {
  const state = createInitialState(CONFIG, ctx)
  state.tick = tickOfDay(95, TEST_RULES)
  for (const p of ['p1', 'p2']) for (const key of Object.keys(state.players[p]!.resources)) state.players[p]!.resources[key as 'food'] = 50_000_000
  state.diplomacy.relations['p1|p2']!.state = 'war'
  state.armies = {}
  state.armyOrder = []
  for (const id of state.provinceOrder) state.provinces[id]!.buildings = {} as never
  state.provinces[TARGET]!.buildings = { ...buildings } as never
  placeArmy(state, { owner: 'p2', at: TARGET, units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
  let s = state
  for (let i = 0; i < TEST_RULES.constants.ticksPerDay; i++) s = step(s, [], ctx).state
  if (morale !== undefined) s.provinces[TARGET]!.morale = morale
  return s
}

function commandsFor(state: GameState) {
  const context = {
    view: publicView(state, 'p2'),
    memory: state.ai['p2'] ?? emptyMemory(600),
    rules: TEST_RULES,
    map,
    difficulty: TEST_RULES.ai.difficulties.normal,
  }
  return recruitCommands(context, []).filter((c) => c.type === 'RECRUIT' && c.provinceId === TARGET)
}

const ok = (s: GameState, c: Parameters<typeof canApply>[1]) => canApply(s, c, { ...ctx, commands: [], events: [] })
const unitKey = (c: unknown) => (c as { unitKey: string }).unitKey

describe('R-UNIT-02/AK1 KI hebt in eroberter Provinz aus, nicht nur mit Kaserne', () => {
  it('nur Fabrik: Panzer oder Artillerie, Befehl gueltig', () => {
    const s = conquered({ factory: 3 })
    expect(s.provinces[TARGET]!.owner).toBe('p2')
    const cmds = commandsFor(s)
    expect(cmds.length).toBeGreaterThan(0)
    for (const c of cmds) {
      expect(c).toMatchObject({ type: 'RECRUIT', playerId: 'p2', provinceId: TARGET })
      expect(['tank', 'artillery']).toContain(unitKey(c))
      expect(ok(s, c)).toEqual({ ok: true })
    }
  })

  it('nur Kaserne: Infanterie', () => {
    const s = conquered({ barracks: 3 })
    const cmds = commandsFor(s)
    expect(cmds.some((c) => unitKey(c) === 'infantry')).toBe(true)
    for (const c of cmds) expect(ok(s, c)).toEqual({ ok: true })
  })

  it('Fabrik und Schonfrist bei Moral 10_000: hebt weiterhin aus', () => {
    const s = conquered({ factory: 3 }, 10_000)
    const cmds = commandsFor(s)
    expect(cmds.length).toBeGreaterThan(0)
    for (const c of cmds) expect(ok(s, c)).toEqual({ ok: true })
  })
})
