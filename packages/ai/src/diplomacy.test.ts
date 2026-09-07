import { RESOURCE_KEYS, type PublicView, type ResourceKey } from '@worldwar/core'
import { TEST_RULES } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { diplomacyCommands } from './diplomacy'
import { relationship } from './relationship'
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
  /** Oeffentliches Ansehen (T-M15-05). Vorgabe: der Ausgangswert 1000. */
  reputation?: number
  /** Verstimmung, die die KI gegen diese Macht hegt (0..1000). */
  grievance?: number
}

/** A view of "me against these powers", with one province of mine touching each of them. */
function viewOf(ownScore: number, powers: Power[]): PublicView {
  return {
    tick: 240,
    playerId: 'ai',
    self: {
      name: 'KI',
      nation: 'Ostmark',
      color: 'rebeccapurple',
      alive: true,
      resources: zeroResources(),
      shortages: [],
      capitalProvinceId: 'home',
      capitalLostUntil: null,
      score: ownScore,
      reputation: 1000,
      grievances: Object.fromEntries(powers.filter((p) => p.grievance).map((p) => [p.id, p.grievance!])),
      aiBonusMultiplier: 1000,
    },
    others: powers.map((power) => ({
      id: power.id,
      name: power.id,
      nation: power.id,
      color: '#000000',
      alive: true,
      score: power.score,
      reputation: power.reputation ?? 1000,
    })),
    publicWars: [],
    relations: Object.fromEntries(
      powers
        .filter((power) => power.relation)
        .map((power) => [power.id, { state: power.relation!, rightOfWay: false, sharedMap: false, sinceTick: 0 }]),
    ),
    provinces: [
      {
        id: 'home',
        name: 'Heimat',
        owner: 'ai',
        kind: 'city',
        terrain: 'plains' as const,
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
        terrain: 'plains' as const,
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

  it('erklaert dem Schwaecheren den Krieg, sobald das Verhaeltnis nachgibt', () => {
    // **Am 2026-09-06 umgeschrieben (T-M15-05).** Diese Zusicherung hielt bis dahin die
    // alte Regel fest: „ein Nachbar ist schwächer, also Krieg" — unabhängig davon, wie
    // man zueinander stand. Genau das ersetzt R-DIP-06, und ein Test, der die abgelöste
    // Regel weiter einfordert, würde die neue verhindern.
    //
    // Neu gilt: **das Verhältnis ist das Tor, die Stärke verschiebt nur seine Schwelle.**
    // Der Schwächere bekommt die Erklärung, wenn beides zusammenkommt — hier ein
    // mittelmäßiges Ansehen und Übermacht; der Ebenbürtige mit gutem Ansehen nicht.
    const explanations: Explanation[] = []
    const context = contextOf(
      viewOf(2000, [
        { id: 'ebenbuertig', score: 1900, relation: 'peace', reputation: 1000 },
        { id: 'schwach', score: 500, relation: 'peace', reputation: 550 },
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
    diplomacyCommands(
      contextOf(viewOf(2000, [{ id: 'schwach', score: 500, relation: 'peace', reputation: 550 }])),
      explanations,
    )

    expect(explanations.length).toBeGreaterThan(0)
    for (const entry of explanations) {
      expect(entry.action).toBeTruthy()
      expect(entry.reason).toMatch(/\d/)
      expect(typeof entry.score).toBe('number')
    }
  })
})

/**
 * Das Verhältnis steuert die Kriegsentscheidung (T-M15-05, R-DIP-06).
 *
 * Der Grundlauf vom 2026-09-06 (`docs/reports/ai-tournament.md`): „schwer gegen normal"
 * endet 25:25, und zwar so, dass in **allen** 50 Partien die erste Nation gewinnt — die
 * Stufe entscheidet nichts. Kein einziger Krieg endet in 150 Partien. Die Ursache steht
 * in zwei Zeilen: die Kriegsentscheidung hing allein am Punkteverhältnis, und
 * `reputation` wurde von keiner Zeile des Projekts gelesen.
 */
const contextFor = (view: PublicView, difficulty: 'easy' | 'normal' | 'hard' = 'hard'): AiContext =>
  ({
    view,
    memory: { targetPriority: {}, assignments: {}, seed: 1 },
    rules: TEST_RULES,
    map: { id: 'x' },
    difficulty: TEST_RULES.ai.difficulties[difficulty],
  }) as unknown as AiContext

const declarations = (commands: ReturnType<typeof diplomacyCommands>): string[] =>
  commands
    .filter((command) => command.type === 'DIPLOMACY' && command.action === 'declareWar')
    .map((command) => (command.type === 'DIPLOMACY' ? command.targetPlayerId : ''))

describe('R-DIP-06/AK1 Das Verhaeltnis entscheidet ueber den Krieg', () => {
  it('erklaert einem gleich starken Nachbarn mit schlechtem Verhaeltnis den Krieg', () => {
    // Vorher unmöglich: die Schwelle lag beim Punkteverhältnis 1200 (schwer) bzw. 1600.
    // Ein gleich starker Nachbar bekam nie eine Kriegserklärung, gleich was er getan hat.
    const view = viewOf(1000, [{ id: 'boese', score: 1000, relation: 'peace', reputation: 200, grievance: 600 }])

    expect(declarations(diplomacyCommands(contextFor(view), []))).toEqual(['boese'])
  })

  it('laesst einen schwaecheren Nachbarn mit gutem Verhaeltnis in Ruhe', () => {
    // Die Gegenrichtung, und die wichtigere: vorher bekam er die Erklärung *immer*,
    // sobald er schwach genug war. Ein Spiel, in dem Wohlverhalten nichts nützt, hat
    // keine Diplomatie, sondern eine Rangliste.
    const view = viewOf(2000, [{ id: 'freund', score: 1000, relation: 'peace', reputation: 1000, grievance: 0 }])

    expect(declarations(diplomacyCommands(contextFor(view), []))).toEqual([])
  })

  it('nennt in der Erklaerung den Verhaeltniswert und den ausschlaggebenden Anteil (AK6)', () => {
    const view = viewOf(1000, [{ id: 'boese', score: 1000, relation: 'peace', reputation: 200, grievance: 600 }])
    const explanations: Explanation[] = []
    diplomacyCommands(contextFor(view), explanations)

    const erklaerung = explanations.find((entry) => entry.action.includes('Krieg'))
    expect(erklaerung?.reason).toMatch(/Verhältnis \d+/)
    expect(erklaerung?.reason).toMatch(/Verstimmung|Ansehen|Bindungen|Verbündeten/)
  })

  it('haelt sich an die Frontenzahl, auch bei schlechtestem Verhaeltnis', () => {
    // `maxFronts` trägt seit T-M15-05 nur noch die Frontenzahl — aber die trägt es weiter.
    const view = viewOf(1000, [
      { id: 'krieg1', score: 1000, relation: 'war' },
      { id: 'boese', score: 1000, relation: 'peace', reputation: 0, grievance: 1000 },
    ])

    expect(declarations(diplomacyCommands(contextFor(view, 'easy'), []))).toEqual([])
  })

  it('schlaegt bei gleicher Lage gleich aus — das Verhaeltnis ist eine reine Funktion', () => {
    const view = viewOf(1000, [{ id: 'boese', score: 1000, relation: 'peace', reputation: 200, grievance: 600 }])
    const einmal = relationship(view, 'boese', view.self.grievances, TEST_RULES)
    const nochmal = relationship(view, 'boese', view.self.grievances, TEST_RULES)

    expect(einmal).toEqual(nochmal)
    expect(einmal.value).toBeGreaterThanOrEqual(0)
    expect(einmal.value).toBeLessThanOrEqual(1000)
  })

  it('senkt das Verhaeltnis bei Verstimmung und hebt es bei einem Buendnis', () => {
    const neutral = viewOf(1000, [{ id: 'x', score: 1000, relation: 'peace', reputation: 1000 }])
    const verstimmt = viewOf(1000, [{ id: 'x', score: 1000, relation: 'peace', reputation: 1000, grievance: 400 }])
    const verbuendet = viewOf(1000, [{ id: 'x', score: 1000, relation: 'alliance', reputation: 1000 }])

    const wert = (view: PublicView) => relationship(view, 'x', view.self.grievances, TEST_RULES).value
    expect(wert(verstimmt)).toBeLessThan(wert(neutral))
    expect(wert(verbuendet)).toBeGreaterThanOrEqual(wert(neutral))
  })
})

describe('R-DIP-06/AK2 Der Buendnisfall', () => {
  it('erklaert dem Angreifer eines Verbuendeten den Krieg', () => {
    // Braucht die öffentlichen Kriege in PublicView: `relations` führt nur meine eigenen
    // Beziehungen, und damit war ein Bündnisfall bis zum 2026-09-06 nicht entscheidbar.
    const view = viewOf(1000, [
      { id: 'freund', score: 1000, relation: 'alliance', reputation: 1000 },
      { id: 'angreifer', score: 1000, relation: 'peace', reputation: 1000 },
    ])
    view.publicWars = [{ a: 'angreifer', b: 'freund' }]

    expect(declarations(diplomacyCommands(contextFor(view), []))).toEqual(['angreifer'])
  })

  it('bleibt aus Kriegen heraus, die niemanden angehen', () => {
    const view = viewOf(1000, [
      { id: 'fremd1', score: 1000, relation: 'peace', reputation: 1000 },
      { id: 'fremd2', score: 1000, relation: 'peace', reputation: 1000 },
    ])
    view.publicWars = [{ a: 'fremd1', b: 'fremd2' }]

    expect(declarations(diplomacyCommands(contextFor(view), []))).toEqual([])
  })
})

describe('R-DIP-06/AK3 Buendnis und Durchmarsch', () => {
  const actions = (view: PublicView, name: string): string[] =>
    diplomacyCommands(contextFor(view), [])
      .filter((command) => command.type === 'DIPLOMACY' && command.action === name)
      .map((command) => (command.type === 'DIPLOMACY' ? command.targetPlayerId : ''))

  it('nimmt ein Buendnis bei gutem Ansehen an', () => {
    const view = viewOf(1000, [{ id: 'ehrlich', score: 1000, relation: 'peace', reputation: 1000 }])
    view.incomingOffers = [{ from: 'ehrlich', kind: 'alliance', tick: 200 }]

    expect(actions(view, 'acceptAlliance')).toEqual(['ehrlich'])
  })

  it('lehnt ein Buendnis unter der Vertrauensschwelle ab', () => {
    // Getrennt vom Verhältnis: das Verhältnis ist meine Sicht auf dich, das Ansehen ist,
    // was alle über dich wissen. Ein Wortbrüchiger kann sympathisch und trotzdem ein
    // schlechter Bündnispartner sein.
    const view = viewOf(1000, [{ id: 'wortbruechig', score: 1000, relation: 'peace', reputation: 300 }])
    view.incomingOffers = [{ from: 'wortbruechig', kind: 'alliance', tick: 200 }]

    expect(actions(view, 'acceptAlliance')).toEqual([])
  })

  it('erwidert gewaehrten Durchmarsch bei gutem Verhaeltnis', () => {
    const view = viewOf(1000, [{ id: 'grosszuegig', score: 1000, relation: 'peace', reputation: 1000 }])
    view.relations.grosszuegig!.rightOfWay = true

    expect(actions(view, 'grantRightOfWay')).toEqual(['grosszuegig'])
  })
})

describe('R-DIP-06/AK4 Ein festgefahrener Krieg endet', () => {
  const offers = (view: PublicView): string[] =>
    diplomacyCommands(contextFor(view), [])
      .filter((command) => command.type === 'DIPLOMACY' && command.action === 'offerPeace')
      .map((command) => (command.type === 'DIPLOMACY' ? command.targetPlayerId : ''))

  it('bietet Frieden an, wenn seit Tagen keine Provinz mehr gewechselt hat', () => {
    // Über 150 Turnierpartien: null Friedensschlüsse. Es gab schlicht keine Bedingung,
    // unter der eine KI einen laufenden Krieg beendet hätte, solange sie nicht unterlegen
    // war (`docs/reports/ai-tournament.md`, Grundlauf).
    const view = viewOf(1000, [{ id: 'patt', score: 1000, relation: 'war', reputation: 1000 }])
    view.tick = 100 * TEST_RULES.constants.ticksPerDay
    view.relations.patt!.sinceTick = 0
    for (const province of view.provinces) province.occupiedSince = 0

    expect(offers(view)).toEqual(['patt'])
  })

  it('bietet keinen Frieden an, solange die Front sich bewegt', () => {
    const view = viewOf(1000, [{ id: 'patt', score: 1000, relation: 'war', reputation: 1000 }])
    view.tick = 100 * TEST_RULES.constants.ticksPerDay
    view.relations.patt!.sinceTick = 0
    for (const province of view.provinces) province.occupiedSince = view.tick - TEST_RULES.constants.ticksPerDay

    expect(offers(view)).toEqual([])
  })
})
