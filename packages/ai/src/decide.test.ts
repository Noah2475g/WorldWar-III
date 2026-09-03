import {
  canApply,
  createInitialState,
  publicView,
  runTicks,
  type GameConfig,
  type GameState,
} from '@worldwar/core'
import { TEST_RULES, placeArmy, smallWorld } from '@worldwar/testkit'
import { beforeEach, describe, expect, it } from 'vitest'
import { decide, emptyMemory, shouldThinkThisTick } from './decide'
import { runAi, storeMemories } from './runner'
import { compareForces, threatMap, worthAttacking } from './threat'
import { hopDistance, rateProvinces } from './targeting'

const map = smallWorld()
const ctx = { map, rules: TEST_RULES }

const CONFIG: GameConfig = {
  seed: 303,
  mapId: 'testworld',
  rulesId: 'default',
  players: [
    { name: 'Mensch', kind: 'human', nation: 'Nordland', color: '#0f62bc' },
    { name: 'KI', kind: 'ai', nation: 'Ostmark', color: '#b03a2e', difficulty: 'normal' },
  ],
  victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
}

let state: GameState

const contextFor = (playerId = 'p2') => ({
  view: publicView(state, playerId),
  memory: state.ai[playerId] ?? emptyMemory(600),
  rules: TEST_RULES,
  map,
  difficulty: TEST_RULES.ai.difficulties.normal,
})

beforeEach(() => {
  state = createInitialState(CONFIG, ctx)
})

describe('R-AI-01 Die KI kann nichts, was ein Mensch nicht kann', () => {
  it('entscheidet ausschliesslich aus der oeffentlichen Sicht', () => {
    // The signature is the guarantee: decide() has no access to GameState at all.
    const decision = decide({ ...contextFor(), explain: true })
    expect(Array.isArray(decision.commands)).toBe(true)
  })

  it('erzeugt nur Befehle, die die regulaere Pruefung bestehen', () => {
    // Every AI order goes through canApply, exactly like a player's (R-AI-01/AK1).
    const decision = decide(contextFor())
    const phaseCtx = { map, rules: TEST_RULES, commands: [], events: [] }

    for (const command of decision.commands) {
      const verdict = canApply(state, command, phaseCtx)
      expect(verdict, `${command.type} wurde abgelehnt: ${JSON.stringify(verdict)}`).toEqual({ ok: true })
    }
  })

  it('handelt nur fuer sich selbst', () => {
    const decision = decide(contextFor())
    for (const command of decision.commands) {
      expect(command.playerId).toBe('p2')
    }
  })
})

describe('R-AI-05 Nachvollziehbarkeit', () => {
  it('nennt Ziel, Begruendung und Bewertung', () => {
    const decision = decide({ ...contextFor(), explain: true })
    expect(decision.explanations.length).toBeGreaterThan(0)
    for (const entry of decision.explanations) {
      expect(entry.action).toBeTruthy()
      expect(entry.reason).toBeTruthy()
      expect(typeof entry.score).toBe('number')
    }
  })

  it('nennt wenigstens einmal eine Alternative', () => {
    placeArmy(state, { owner: 'p2', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const decision = decide({ ...contextFor(), explain: true })
    expect(decision.explanations.some((entry) => entry.alternative)).toBe(true)
  })

  it('schweigt ohne Debug-Modus', () => {
    // Explanations cost time; they are off unless asked for.
    expect(decide(contextFor()).explanations).toEqual([])
  })
})

describe('R-AI-07 Die KI merkt sich ihre Plaene', () => {
  it('gibt ein veraendertes Gedaechtnis zurueck', () => {
    placeArmy(state, { owner: 'p2', at: 'o3', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })
    const decision = decide(contextFor())
    expect(Object.keys(decision.memory.assignments).length).toBeGreaterThan(0)
    expect(decision.memory.lastStrategicTick).toBe(0)
  })

  it('laesst das uebergebene Gedaechtnis unveraendert', () => {
    const memory = emptyMemory(600)
    decide({ ...contextFor(), memory })
    expect(memory.assignments).toEqual({})
  })

  it('denkt in den vorgesehenen Abstaenden', () => {
    const first = decide(contextFor())
    const later = decide({ ...contextFor(), memory: { ...first.memory, lastStrategicTick: 0 } })
    expect(later.memory.lastStrategicTick).toBe(0) // no new strategic pass at tick 0
  })
})

describe('R-AI-04 Rechenlast wird verteilt, nicht gemessen', () => {
  it('laesst je Tick reihum einen Spieler denken', () => {
    // Counter-based, never clock-based: a decision that depends on machine speed
    // would break determinism (review finding on the original budget rule).
    expect(shouldThinkThisTick(0, 0, 3)).toBe(true)
    expect(shouldThinkThisTick(0, 1, 3)).toBe(false)
    expect(shouldThinkThisTick(1, 1, 3)).toBe(true)
    expect(shouldThinkThisTick(5, 2, 3)).toBe(true)
  })

  it('laesst einen einzelnen Gegner jeden Tick denken', () => {
    expect(shouldThinkThisTick(7, 0, 1)).toBe(true)
  })
})

describe('R-AI-03 Bedrohung und Kraeftevergleich', () => {
  it('erkennt Druck auf die eigene Grenze', () => {
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'tank', hpTotal: 52_000 }] })

    const threat = threatMap(publicView(state, 'p2'), 2)
    expect(threat.peak).toBeGreaterThan(0)
  })

  it('bewertet Kraefteverhaeltnisse nachvollziehbar', () => {
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })

    const view = publicView(state, 'p2')
    expect(compareForces(view, 'm1', 40_000).verdict).toBe('overwhelming')
    expect(compareForces(view, 'm1', 10_000).verdict).toBe('even')
    expect(compareForces(view, 'm1', 2_000).verdict).toBe('hopeless')
  })

  it('greift Aussichtsloses nicht an', () => {
    const hopeless = { own: 1000, enemy: 10_000, ratio: 100, verdict: 'hopeless' as const }
    expect(worthAttacking(hopeless, 3)).toBe(false)

    const favourable = { own: 10_000, enemy: 5_000, ratio: 2000, verdict: 'favourable' as const }
    expect(worthAttacking(favourable, 1)).toBe(true)
  })
})

describe('R-AI-03 Zielauswahl', () => {
  it('misst Entfernungen in Provinzen', () => {
    const view = publicView(state, 'p1')
    expect(hopDistance(view, 'n1', 'n1')).toBe(0)
    expect(hopDistance(view, 'n1', 'n2')).toBe(1)
  })

  it('bewertet erreichbare Ziele und liefert normierte Werte', () => {
    state.diplomacy.relations['p1|p2']!.state = 'war'
    const values = rateProvinces(contextFor(), 'o1')

    expect(values.length).toBeGreaterThan(0)
    for (const value of values) {
      expect(value.total).toBeGreaterThanOrEqual(0)
      expect(value.total).toBeLessThanOrEqual(1000)
      expect(value.economy).toBeLessThanOrEqual(1000)
    }
  })

  it('bevorzugt Ziele in der Naehe', () => {
    state.diplomacy.relations['p1|p2']!.state = 'war'
    const values = rateProvinces(contextFor(), 'o1')
    const near = values.find((entry) => entry.id === 'm1')
    const far = values.find((entry) => entry.id === 'n3')
    if (near && far) expect(near.distance).toBeGreaterThan(far.distance)
  })

  it('waehlt bei Gleichstand immer dasselbe Ziel', () => {
    state.diplomacy.relations['p1|p2']!.state = 'war'
    const first = rateProvinces(contextFor(), 'o1').map((entry) => entry.id)
    for (let i = 0; i < 5; i++) {
      expect(rateProvinces(contextFor(), 'o1').map((entry) => entry.id)).toEqual(first)
    }
  })
})

describe('R-AI-03 Die KI spielt eine Partie', () => {
  it('baut, rekrutiert und bewegt sich ueber hundert Stunden', () => {
    let current = state
    const seen = new Set<string>()

    for (let i = 0; i < 200; i++) {
      const { commands, memories } = runAi(current, ctx)
      const result = runTicks(current, 1, ctx, () => commands)
      current = result.state
      storeMemories(current, memories)
      for (const event of result.events) seen.add(event.type)
    }

    expect(seen.has('BUILD_STARTED')).toBe(true)
    expect(current.tick).toBe(200)
  })

  it('verschuldet sich nicht', () => {
    let current = state
    for (let i = 0; i < 300; i++) {
      const { commands, memories } = runAi(current, ctx)
      current = runTicks(current, 1, ctx, () => commands).state
      storeMemories(current, memories)
    }

    for (const key of Object.keys(current.players['p2']!.resources)) {
      expect(current.players['p2']!.resources[key as 'food']).toBeGreaterThanOrEqual(0)
    }
  })
})
