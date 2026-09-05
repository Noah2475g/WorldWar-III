import { RESOURCE_KEYS, type PublicView, type ResourceKey } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { diplomacyCommands } from './diplomacy'
import type { AiContext, Explanation } from './types'

/**
 * The diplomatic rules, checked one at a time (R-DIP-03, T-M7-04).
 *
 * The view is built by hand here rather than played out of a real game, because the
 * whole point of these rules is that they are legible: "unterlegen, also Frieden" has
 * to be visible as one number against another. A scenario that first has to be fought
 * into existence would hide exactly the thing under test.
 */

const zeroResources = () =>
  Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0])) as Record<ResourceKey, number>

interface Power {
  id: string
  score: number
  /** Diplomatic state towards the AI. Absent means no relation at all. */
  relation?: 'peace' | 'war' | 'truce' | 'alliance'
}

/** A view of "me against these powers", with one province of mine touching each of them. */
function viewOf(ownScore: number, powers: Power[]): PublicView {
  return {
    tick: 240,
    playerId: 'ai',
    self: {
      name: 'KI',
      nation: 'Ostmark',
      alive: true,
      resources: zeroResources(),
      shortages: [],
      capitalProvinceId: 'home',
      score: ownScore,
      reputation: 1000,
      aiBonusMultiplier: 1000,
    },
    others: powers.map((power) => ({
      id: power.id,
      name: power.id,
      nation: power.id,
      color: '#000000',
      alive: true,
      score: power.score,
    })),
    relations: Object.fromEntries(
      powers
        .filter((power) => power.relation)
        .map((power) => [power.id, { state: power.relation!, rightOfWay: false, sharedMap: false }]),
    ),
    provinces: [
      {
        id: 'home',
        name: 'Heimat',
        owner: 'ai',
        kind: 'city',
        terrain: 'plains',
        coastal: false,
        neighbors: powers.map((power) => `${power.id}-land`),
        seaLinks: [],
        stale: false,
        asOfTick: 240,
      },
      ...powers.map((power) => ({
        id: `${power.id}-land`,
        name: power.id,
        owner: power.id,
        kind: 'rural' as const,
        terrain: 'plains',
        coastal: false,
        neighbors: ['home'],
        seaLinks: [],
        stale: false,
        asOfTick: 240,
      })),
    ],
    armies: [],
    marketPrices: zeroResources(),
    incomingOffers: [],
    victory: { condition: 'points', winner: null },
  }
}

const contextOf = (view: PublicView, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): AiContext => ({
  view,
  memory: { plans: [], lastThinkTick: 0, threat: {}, budget: 600 } as unknown as AiContext['memory'],
  rules: TEST_RULES,
  map: { id: 'x' } as unknown as AiContext['map'],
  difficulty: TEST_RULES.ai.difficulties[difficulty],
})

describe('R-DIP-03 Die KI antwortet auf Angebote nach nachvollziehbaren Regeln', () => {
  it('bietet Frieden an, sobald sie klar unterlegen ist', () => {
    const explanations: Explanation[] = []
    const context = contextOf(viewOf(500, [{ id: 'stark', score: 1000, relation: 'war' }]))

    const commands = diplomacyCommands(context, explanations)

    expect(commands.map((command) => command.type === 'DIPLOMACY' && command.action)).toEqual([
      'offerPeace',
    ])
    expect(explanations.some((entry) => /Frieden/.test(entry.action))).toBe(true)
  })

  it('nimmt an, statt anzubieten, wenn ein Angebot vorliegt', () => {
    // Befund 41: Vorher warf die KI 'acceptPeace' ins Blaue — die Sicht fuehrte die
    // eingehenden Angebote gar nicht, und 99 % dieser Befehle wurden abgelehnt. Zwischen
    // zwei KI-Maechten konnte ein Krieg dadurch strukturell fast nie enden: beide boten
    // an, keine sah das Angebot der anderen. Der alte Test hielt genau dieses blinde
    // Verhalten fest ('acceptPeace' UND 'offerPeace' in jedem Fall).
    const view = viewOf(500, [{ id: 'stark', score: 1000, relation: 'war' }])
    view.incomingOffers = [{ from: 'stark', kind: 'peace', tick: 200 }]

    const commands = diplomacyCommands(contextOf(view), [])

    expect(commands.map((command) => command.type === 'DIPLOMACY' && command.action)).toEqual([
      'acceptPeace',
    ])
  })

  it('kaempft weiter, solange sie nicht unterlegen ist', () => {
    // Gleichstand: 1000 gegen 1000 ist ein Verhaeltnis von 1000, die Schwelle ist 900.
    const context = contextOf(viewOf(1000, [{ id: 'gleich', score: 1000, relation: 'war' }]))

    const commands = diplomacyCommands(context, [])

    expect(commands.filter((command) => command.type === 'DIPLOMACY' && command.action === 'offerPeace')).toEqual([])
  })

  it('eroeffnet keine Front mehr, wenn die Grenze der Stufe erreicht ist', () => {
    const explanations: Explanation[] = []
    // Zwei laufende Kriege, Stufe "normal" erlaubt zwei Fronten — und der schwache
    // Nachbar bleibt trotz aller Ueberlegenheit unbehelligt.
    const context = contextOf(
      viewOf(10_000, [
        { id: 'feind-a', score: 12_000, relation: 'war' },
        { id: 'feind-b', score: 12_000, relation: 'war' },
        { id: 'schwach', score: 100, relation: 'peace' },
      ]),
    )

    const commands = diplomacyCommands(context, explanations)

    expect(commands.some((command) => command.type === 'DIPLOMACY' && command.action === 'declareWar')).toBe(false)
    expect(explanations.some((entry) => /Grenze 2/.test(entry.reason))).toBe(true)
  })

  it('erklaert nur einem deutlich schwaecheren Nachbarn den Krieg', () => {
    const explanations: Explanation[] = []
    const context = contextOf(
      viewOf(2000, [
        { id: 'ebenbuertig', score: 1900, relation: 'peace' },
        { id: 'schwach', score: 500, relation: 'peace' },
      ]),
    )

    const commands = diplomacyCommands(context, explanations)
    const declarations = commands.filter(
      (command) => command.type === 'DIPLOMACY' && command.action === 'declareWar',
    )

    expect(declarations).toHaveLength(1)
    expect(declarations[0]).toMatchObject({ targetPlayerId: 'schwach' })
    expect(explanations.some((entry) => /schwach/.test(entry.action))).toBe(true)
  })

  it('greift keinen an, der nicht an sie grenzt', () => {
    const view = viewOf(2000, [{ id: 'fern', score: 100, relation: 'peace' }])
    // Die gemeinsame Grenze wird gekappt: uebrig bleibt ein schwacher, aber
    // unerreichbarer Nachbar.
    view.provinces[0]!.neighbors = []
    view.provinces[1]!.neighbors = []

    const commands = diplomacyCommands(contextOf(view), [])

    expect(commands).toEqual([])
  })

  it('begruendet jede Entscheidung mit Zahl und Alternative', () => {
    const explanations: Explanation[] = []
    diplomacyCommands(contextOf(viewOf(2000, [{ id: 'schwach', score: 500, relation: 'peace' }])), explanations)

    expect(explanations.length).toBeGreaterThan(0)
    for (const entry of explanations) {
      expect(entry.action).toBeTruthy()
      expect(entry.reason).toMatch(/\d/)
      expect(typeof entry.score).toBe('number')
    }
  })
})
