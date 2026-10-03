import { createInitialState, publicView, type Command, type GameConfig, type GameState } from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { consolidateCommands } from './consolidate'
import { emptyMemory } from './decide'

/**
 * Review-Punkte 1 und 3 zu `consolidate.ts` (T-M42-15, T-M42-16). Eigene Datei statt
 * `decide.test.ts`, damit die Faelle von T-M42-08/-09 dort unveraendert bleiben.
 */

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const CONFIG: GameConfig = {
  seed: 505,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Mensch', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'KI', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}
const hp = (unitKey: string) => TEST_RULES.units[unitKey]!.hpPerUnit

let state: GameState
beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
  // Nur die Armeen des Falls: die Startarmeen der KI gehen aus dem Zustand (nur im Test).
  for (const id of state.armyOrder.filter((armyId) => state.armies[armyId]!.owner === 'p2')) {
    delete state.armies[id]
  }
  state.armyOrder = state.armyOrder.filter((armyId) => state.armies[armyId] !== undefined)
})

const contextFor = () => ({
  view: publicView(state, 'p2'),
  memory: emptyMemory(600),
  rules: TEST_RULES,
  map,
  difficulty: TEST_RULES.ai.difficulties.normal,
})

describe('T-M42-16 Keine Armee unter Sperre im Merge-Pass (Review Punkt 3)', () => {
  it('S1: eine Armee mit cannotAttackUntil > tick bleibt aussen vor', () => {
    const frisch = placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5 * hp('infantry') }] })
    const gesperrt = placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5 * hp('infantry') }] })
    const dritte = placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5 * hp('infantry') }] })
    state.armies[gesperrt.id]!.cannotAttackUntil = state.tick + 10

    const merges = consolidateCommands(contextFor(), []).filter((command) => command.type === 'MERGE_ARMIES')
    expect(merges.map((command) => (command as Extract<Command, { type: 'MERGE_ARMIES' }>).armyIds)).toEqual([
      [frisch.id, dritte.id].sort(),
    ])
  })

  it('S2: ist die Sperre abgelaufen, geht sie wieder mit', () => {
    placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5 * hp('infantry') }] })
    const alt = placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 5 * hp('infantry') }] })
    state.armies[alt.id]!.cannotAttackUntil = state.tick
    expect(consolidateCommands(contextFor(), []).filter((command) => command.type === 'MERGE_ARMIES')).toHaveLength(1)
  })
})

describe('T-M42-15 Provinzen nach Codeeinheiten (Review Punkt 1, Determinismus)', () => {
  it('D1: "B..." vor "a..." wie sort() im Kern - localeCompare("en") stellte "a" vor "B"', () => {
    const context = contextFor()
    context.view.armies = ['a-prov', 'B-prov'].flatMap((provinceId) =>
      [1, 2].map((n) => ({
        id: `x${provinceId}${n}`,
        owner: 'p2',
        provinceId,
        units: [{ unitKey: 'infantry', hpTotal: 3 * hp('infantry') }],
        strength: 0,
      })),
    )
    const orte = consolidateCommands(context, []).map(
      (command) => context.view.armies.find((army) => army.id === (command as Extract<Command, { type: 'MERGE_ARMIES' }>).armyIds[0])!.provinceId,
    )
    expect(orte).toEqual(['B-prov', 'a-prov'])
    expect(['a-prov', 'B-prov'].sort((a, b) => a.localeCompare(b, 'en')), 'die Probe saehe den Unterschied nicht').toEqual([
      'a-prov',
      'B-prov',
    ])
  })
})
