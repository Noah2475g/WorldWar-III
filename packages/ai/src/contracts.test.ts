import { createInitialState, publicView, step, type GameConfig, type GameState } from '@worldwar/core'
import { smallWorld, TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { contractCommands } from './contracts'
import { emptyMemory } from './decide'
import type { AiContext, Explanation } from './types'

/** Liefervertrag B2 (D7/P9): Kuendigung der KI je Grund, mit Erklaerung. */
const map = smallWorld()
const ctx = { map, rules: TEST_RULES }
const WINDOW = 24

const CONFIG: GameConfig = {
  seed: 1010,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Nord', kind: 'ai', nation: 'Nordland', color: '#0f62bc', difficulty: 'hard' },
    { name: 'Ost', kind: 'human', nation: 'Ostmark', color: '#b03a2e' },
    { name: 'Sued', kind: 'ai', nation: 'Sueden', color: '#4a5d2c', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

/** p3 (die KI) liefert Geld an p2 gegen Oel; faellig in 10 Ticks. */
function lage(): GameState {
  const state = createInitialState(CONFIG, ctx)
  state.tick = 40
  state.market.prices.oil = 2000
  state.market.prices.money = 1000
  state.players.p3!.shortages = []
  state.diplomacy.contracts.push({
    id: 'c1',
    from: 'p3',
    to: 'p2',
    give: { money: 100_000 },
    want: { oil: 55_000 },
    intervalTicks: 72,
    remaining: 3,
    nextDueTick: 50,
    createdTick: 0,
  })
  return state
}

const contextFor = (state: GameState): AiContext => ({
  view: publicView(state, 'p3'),
  memory: state.ai.p3 ?? emptyMemory(600),
  rules: TEST_RULES,
  map,
  difficulty: TEST_RULES.ai.difficulties[state.players.p3!.difficulty ?? 'normal'],
})

const run = (state: GameState) => {
  const explanations: Explanation[] = []
  const commands = contractCommands(contextFor(state), explanations, [], WINDOW)
  return { commands, explanations }
}

describe('Liefervertrag: Kuendigung der KI', () => {
  it('ohne Vertraege: leere Rueckgabe, keine Erklaerung', () => {
    const state = lage()
    state.diplomacy.contracts = []
    expect(run(state)).toEqual({ commands: [], explanations: [] })
  })

  it('lohnender Vertrag im Faelligkeitsfenster: keine Kuendigung, keine Erklaerung', () => {
    const { commands, explanations } = run(lage())
    expect(commands).toEqual([])
    expect(explanations).toEqual([])
  })

  it('ausserhalb des Faelligkeitsfensters passiert nichts, auch bei schlechtem Gegenwert', () => {
    const state = lage()
    state.market.prices.money = 5000
    state.diplomacy.contracts[0]!.nextDueTick = 40 + WINDOW + 1
    expect(run(state).commands).toEqual([])
    state.diplomacy.contracts[0]!.nextDueTick = 40
    expect(run(state).commands).toEqual([])
  })

  it('AK4 Kursdrift: Gegenwert unter 1000 Promille kuendigt, mit Erklaerung', () => {
    const state = lage()
    state.market.prices.money = 1200 // gibt 120 000 Wert, bekommt 110 000
    const { commands, explanations } = run(state)
    expect(commands).toEqual([{ type: 'CANCEL_CONTRACT', playerId: 'p3', contractId: 'c1' }])
    expect(explanations[0]).toMatchObject({
      action: 'Kündigt Vertrag c1 mit p2',
      reason: 'Gegenwert 916 ‰ unter 1000 ‰',
      score: 600,
      alternative: { action: 'weiterliefern', score: 200 },
    })
    expect(step(state, commands, ctx).state.diplomacy.contracts).toHaveLength(0)
  })

  it('kuendigt, wenn ein Gabe-Rohstoff selbst knapp ist', () => {
    const state = lage()
    state.players.p3!.shortages = ['money']
    const { commands, explanations } = run(state)
    expect(commands).toHaveLength(1)
    expect(explanations[0]!.reason).toBe('money ist selbst knapp')
  })

  it('kuendigt bei Beziehung unter der Kriegsschwelle', () => {
    const context = contextFor(lage())
    context.difficulty = { ...context.difficulty, warThreshold: 1_000_000 }
    const explanations: Explanation[] = []
    const commands = contractCommands(context, explanations, [], WINDOW)
    expect(commands).toHaveLength(1)
    expect(explanations[0]!.reason).toContain('unter der Kriegsschwelle')
  })

  it('als Empfaenger (to) ist die eigene Gabe der Vertrags-want', () => {
    const state = lage()
    Object.assign(state.diplomacy.contracts[0]!, { from: 'p2', to: 'p3', give: { oil: 55_000 }, want: { money: 100_000 } })
    state.players.p3!.shortages = ['money']
    expect(run(state).explanations[0]!.reason).toBe('money ist selbst knapp')
  })
})
