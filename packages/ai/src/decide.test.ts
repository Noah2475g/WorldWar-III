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
import type { Explanation } from './types'
import { runAi, storeMemories } from './runner'
import { compareForces, threatMap, worthAttacking } from './threat'
import { hopDistance, rateProvinces } from './targeting'
import { nextUnitFor } from './economy'
import { capitalCommands } from './capital'
import { consolidateCommands } from './consolidate'
import { militaryCommands } from './military'

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

/** Ein Kontext, in dem jede eigene Provinz die genannten Gebaeude hat und Geld da ist. */
const contextWithBuildings = (buildings: Record<string, number>) => {
  for (const id of state.provinceOrder) {
    const province = state.provinces[id]!
    if (province.owner !== 'p2') continue
    province.buildings = { ...province.buildings, ...buildings }
  }
  const resources = state.players['p2']!.resources as Record<string, number>
  for (const key of Object.keys(resources)) resources[key] = 5_000_000
  return contextFor('p2')
}

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

describe('R-AI-01 Die KI fuehrt mehr als zwei Einheitenarten', () => {
  // Befund 32: economy.ts waehlte 'tank' oder 'infantry' — zwei von zehn Arten.
  // Artillerie, Luftwaffe und Marine waren reiner Spielervorteil, ein Bruch von R-AI-01
  // in die andere Richtung. Fuer die Artillerie kommt hinzu: sie ist Vorbedingung fuer
  // R-BAT-08 (T-M15-07). Eine Feuerautomatik ohne Fernwaffen waere gebaut, gruen
  // getestet und wirkungslos, weil armyRange fuer jede KI-Armee null bliebe.

  /**
   * Ein Kontext, dessen eigene Armee den genannten Bestand hat.
   *
   * Die Uhr steht hinter dem letzten Freischaltungstag (T-M15-02, R-TECH-01): geprueft
   * wird hier die *Truppenmischung*, nicht die Zeitachse. Ohne das lieferte nextUnitFor
   * an Tag 1 immer Infanterie, und die Zusicherungen unten waeren gruen, ohne noch etwas
   * ueber die Mischung zu sagen.
   */
  const mitBestand = (bestand: Record<string, number>) => {
    state.tick = LETZTER_FREISCHALTUNGSTAG * TEST_RULES.constants.ticksPerDay
    const context = contextWithBuildings({ barracks: 1, factory: 1 })
    const units = Object.entries(bestand).flatMap(([unitKey, count]) =>
      Array.from({ length: count }, () => ({ unitKey, hpTotal: 1000 })),
    )
    return {
      ...context,
      view: {
        ...context.view,
        armies: [{ id: 'a1', owner: 'p2', locationProvinceId: 'o1', units }],
      },
    } as unknown as typeof context
  }

  const mitFabrik = { buildings: { barracks: 1, factory: 1 } }

  /** Der spaeteste erste Spieltag im Regelwerk — ab hier ist jede Einheit zu haben. */
  const LETZTER_FREISCHALTUNGSTAG = Math.max(...Object.values(TEST_RULES.units).map((rule) => rule.availableFromDay))

  it('faengt mit Infanterie an', () => {
    expect(nextUnitFor(mitBestand({}), mitFabrik)).toBe('infantry')
  })

  it('geht zu Panzern ueber, wenn genug Infanterie steht', () => {
    expect(nextUnitFor(mitBestand({ infantry: 10 }), mitFabrik)).toBe('tank')
  })

  it('baut Artillerie, sobald Infanterie und Panzer da sind', () => {
    // Ohne diese Zeile kann R-BAT-08 nicht wirken.
    expect(nextUnitFor(mitBestand({ infantry: 10, tank: 6 }), mitFabrik)).toBe('artillery')
  })

  it('baut ohne Fabrik nur, was die Kaserne hergibt', () => {
    const nur = { buildings: { barracks: 1 } }
    expect(nextUnitFor(mitBestand({ infantry: 10, tank: 6 }), nur)).toBe('infantry')
  })

  it('waehlt bei gleicher Lage dasselbe', () => {
    // R-ARCH-01: dieselbe Lage, derselbe Befehl.
    const a = nextUnitFor(mitBestand({ infantry: 4, tank: 2 }), mitFabrik)
    const b = nextUnitFor(mitBestand({ infantry: 4, tank: 2 }), mitFabrik)
    expect(a).toBe(b)
  })
})

describe('R-AI-01 Die KI verlegt ihre Hauptstadt', () => {
  it('sucht sich eine neue, wenn die alte verloren ist', () => {
    // Befund 12: SET_CAPITAL wurde von keiner Zeile in packages/ai erzeugt. Wer seine
    // Hauptstadt verlor, hatte fuer den Rest der Partie keine — und die
    // Entfernungsstrafe auf die Moral rechnet gegen capitalProvinceId, trifft also JEDE
    // Provinz mit vollem Betrag. Die Macht faellt bis zum Aufstand durch und erholt sich
    // nie. Der Mensch kann verlegen, die KI nicht: R-AI-01 in die andere Richtung.
    state.players['p2']!.capitalProvinceId = null
    for (const id of state.provinceOrder) {
      const province = state.provinces[id]!
      if (province.owner === 'p2') province.kind = 'city'
    }

    const commands = capitalCommands(contextFor('p2'), [])
    expect(commands).toHaveLength(1)
    expect(commands[0]!.type).toBe('SET_CAPITAL')
  })

  it('laesst eine heile Hauptstadt in Ruhe', () => {
    expect(capitalCommands(contextFor('p2'), [])).toEqual([])
  })

  it('verlegt nicht, wenn keine Stadt uebrig ist', () => {
    state.players['p2']!.capitalProvinceId = null
    for (const id of state.provinceOrder) {
      const province = state.provinces[id]!
      if (province.owner === 'p2') province.kind = 'rural'
    }
    expect(capitalCommands(contextFor('p2'), [])).toEqual([])
  })

  it('waehlt bei gleicher Lage dieselbe Stadt', () => {
    state.players['p2']!.capitalProvinceId = null
    for (const id of state.provinceOrder) {
      const province = state.provinces[id]!
      if (province.owner === 'p2') province.kind = 'city'
    }
    const a = capitalCommands(contextFor('p2'), [])
    const b = capitalCommands(contextFor('p2'), [])
    expect(a).toEqual(b)
  })
})

describe('R-AI-01 Die KI legt Verbaende zusammen', () => {
  it('fasst zwei Armeen am selben Ort zu einer', () => {
    // Befund 40: Jede Aushebung erzeugt eine eigene Armee, und die KI hat sie nie
    // zusammengelegt — gemessen 127 Armeen bei einer Macht, deren staerkste 2 % ihrer
    // Gesamtkraft hielt. Hundert Einzelarmeen werden einzeln aufgerieben, bevor eine
    // von ihnen etwas ausrichtet. MERGE_ARMIES gab es seit M4; in packages/ai erzeugte
    // es keine Zeile.
    placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })
    placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })

    const commands = consolidateCommands(contextFor('p2'), [])
    expect(commands).toHaveLength(1)
    expect(commands[0]!.type).toBe('MERGE_ARMIES')
  })

  it('laesst eine einzelne Armee in Ruhe', () => {
    placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })
    expect(consolidateCommands(contextFor('p2'), [])).toEqual([])
  })

  it('fasst nichts ueber Provinzgrenzen hinweg zusammen', () => {
    placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })
    placeArmy(state, { owner: 'p2', at: 'o2', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })
    expect(consolidateCommands(contextFor('p2'), [])).toEqual([])
  })

  it('erzeugt nur Befehle, die die regulaere Pruefung besteht', () => {
    // R-AI-01/AK1: dieselbe Pruefung wie beim Menschen.
    placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })
    placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 3000 }] })

    const phaseCtx = { map, rules: TEST_RULES, commands: [], events: [] }
    for (const command of consolidateCommands(contextFor('p2'), [])) {
      expect(canApply(state, command, phaseCtx)).toEqual({ ok: true })
    }
  })
})

describe('R-BAT-08/AK3 Die KI laesst Fernwaffen stehen', () => {
  it('schickt eine Artilleriearmee mit Ziel in Reichweite nicht in den Nahkampf', () => {
    // Sie schießt dann von selbst — Schaden ohne Gegenschlag. Marschierte sie ins Ziel,
    // gäbe sie genau das auf, wofür sie da ist: eine Artilleriearmee im Nahkampf ist eine
    // schlechte Infanteriearmee.
    state.diplomacy.relations['p1|p2']!.state = 'war'
    // m1 gehoert jetzt p2 und grenzt an n2 von p1 — sonst sehen die beiden Maechte auf
    // dieser Karte einander gar nicht: zwischen n* und o* liegt neutrales Land, und die
    // KI darf nur mit dem rechnen, was sie sieht (R-AI-01).
    state.provinces['m1']!.owner = 'p2'
    placeArmy(state, {
      owner: 'p2',
      at: 'm1',
      units: [{ unitKey: 'artillery', hpTotal: 20 * TEST_RULES.units['artillery']!.hpPerUnit }],
      stance: 'defensive',
    })
    placeArmy(state, { owner: 'p1', at: 'n2', units: [{ unitKey: 'infantry', hpTotal: 50_000 }] })

    const artillerie = state.armyOrder.find(
      (id) => state.armies[id]!.owner === 'p2' && state.armies[id]!.units.some((u) => u.unitKey === 'artillery'),
    )!

    const explanations: Explanation[] = []
    const commands = militaryCommands(contextFor('p2'), explanations)

    // Gezielt auf diese Armee: andere Verbaende derselben Macht duerfen sehr wohl
    // marschieren — geprueft wird die Fernwaffe, nicht die ganze Streitmacht.
    expect(
      commands.filter((command) => command.type === 'MOVE_ARMY' && command.armyId === artillerie),
      'die Artillerie wurde in den Nahkampf geschickt',
    ).toEqual([])
    expect(explanations.some((entry) => entry.action.includes(artillerie) && /Stellung/.test(entry.action))).toBe(true)
  })

  it('schickt eine Armee ohne Fernwaffen weiterhin los', () => {
    // Die Gegenrichtung: ein Filter, der jede Armee stehen lässt, bestünde die
    // Zusicherung oben und machte die KI handlungsunfähig.
    state.diplomacy.relations['p1|p2']!.state = 'war'
    placeArmy(state, { owner: 'p2', at: 'o1', units: [{ unitKey: 'infantry', hpTotal: 200_000 }] })
    placeArmy(state, { owner: 'p1', at: 'm1', units: [{ unitKey: 'infantry', hpTotal: 10_000 }] })

    const commands = militaryCommands(contextFor('p2'), [])
    expect(commands.some((command) => command.type === 'MOVE_ARMY')).toBe(true)
  })
})
