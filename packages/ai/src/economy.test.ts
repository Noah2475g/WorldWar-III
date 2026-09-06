import { createInitialState, publicView, type Command, type GameConfig } from '@worldwar/core'
import { TEST_RULES, smallWorld } from '@worldwar/testkit'
import { describe, expect, it } from 'vitest'
import { emptyMemory } from './decide'
import { economyCommands, recruitCommands, tradeCommands } from './economy'

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

/**
 * Eine KI-Macht mit allen Gebaeuden und vollen Kassen, zu einem bestimmten Tick.
 *
 * Absichtlich reich und vollgebaut: geprueft wird die Freischaltung, nicht das Geld.
 * Waere die Kasse leer, waeren beide Zusicherungen unten gruen, ohne etwas zu belegen —
 * die KI baute dann ja ohnehin nichts.
 */
function richContext(tick: number) {
  const state = createInitialState(CONFIG, ctx)
  state.tick = tick
  for (const id of state.provinceOrder) {
    const province = state.provinces[id]!
    if (province.owner !== 'p2') continue
    for (const key of Object.keys(TEST_RULES.buildings)) {
      province.buildings = { ...province.buildings, [key]: 1 }
    }
  }
  const resources = state.players['p2']!.resources as Record<string, number>
  for (const key of Object.keys(resources)) resources[key] = 50_000_000

  return {
    view: publicView(state, 'p2'),
    memory: state.ai['p2'] ?? emptyMemory(600),
    rules: TEST_RULES,
    map,
    difficulty: TEST_RULES.ai.difficulties.normal,
  }
}


/**
 * Die KI wählt nichts, was es noch nicht gibt (T-M15-03, R-TECH-02/AK2).
 *
 * Der zweite Teil der Anforderung ist kein Schönheitsfehler. Ein Befehl, den der Kern
 * jeden Tag ablehnt, ist Rauschen im Protokoll statt Verhalten — und die KI fasste ihn
 * bis zum 2026-09-06 in jedem Tick neu, weil sie ihn nie ausführen konnte. Dasselbe
 * Muster hat schon 3046 von 4464 Marschbefehlen als `NO_PATH` enden lassen (T-M14-11).
 */
describe('R-TECH-02/AK2 Die KI kennt die Freischaltung', () => {
  it('baut an Spieltag 1 nichts, was es erst spaeter gibt', () => {
    const context = richContext(0)
    const commands = economyCommands(context, [])

    const zuFrueh = commands
      .filter((command): command is Extract<Command, { type: 'BUILD' }> => command.type === 'BUILD')
      .filter((command) => context.rules.buildings[command.building]!.availableFromDay > 1)

    expect(zuFrueh.map((command) => command.building), 'Bauauftrag vor dem Freischaltungstag').toEqual([])
  })

  it('hebt an Spieltag 1 nichts aus, was es erst spaeter gibt', () => {
    const context = richContext(0)
    const commands = recruitCommands(context, [])

    const zuFrueh = commands
      .filter((command): command is Extract<Command, { type: 'RECRUIT' }> => command.type === 'RECRUIT')
      .filter((command) => context.rules.units[command.unitKey]!.availableFromDay > 1)

    expect(zuFrueh.map((command) => command.unitKey), 'Aushebung vor dem Freischaltungstag').toEqual([])
  })

  it('greift spaeter sehr wohl zu — sonst baut sie nie wieder etwas', () => {
    // Die Gegenrichtung. Ein Filter, der alles wegwirft, bestuende die beiden
    // Zusicherungen oben makellos und machte die KI handlungsunfaehig.
    const context = richContext(30 * TEST_RULES.constants.ticksPerDay)
    const commands = economyCommands(context, [])

    expect(commands.length, 'die KI baut auch an Tag 31 nichts').toBeGreaterThan(0)
  })
})

describe('R-AI-08/AK3 Die KI handelt, bevor der Mangel da ist', () => {
  it('tauscht fuer das naechste Bauvorhaben, ohne dass etwas knapp ist', () => {
    // Der teuerste Befund des Meilensteins: gehandelt wurde **erst bei eingetretenem
    // Mangel** — und ein Mangel heißt, dass ein Vorrat schon aufgebraucht ist. Wer erst
    // dann tauscht, tauscht immer zu spät und nie für etwas, das er *vorhat*. Auf der
    // Testkarte baute die KI dadurch über 150 Spieltage keine einzige Fabrik.
    const context = richContext(30 * TEST_RULES.constants.ticksPerDay)
    // Reich an allem außer Holz — die Fabrik kostet Holz, ein Mangel liegt nicht vor.
    ;(context.view.self.resources as Record<string, number>).wood = 1000
    expect(context.view.self.shortages.length, 'die Lage soll gerade keinen Mangel zeigen').toBe(0)

    const commands = tradeCommands(context, [])
    const trade = commands.find((command) => command.type === 'TRADE')

    expect(trade, 'kein Tauschbefehl trotz fehlendem Baustoff').toBeDefined()
    if (trade?.type === 'TRADE') expect(trade.want).toBe('wood')
  })

  it('tauscht nicht, wenn nichts fehlt', () => {
    // Die Gegenrichtung: eine KI, die in jedem Tick tauscht, verbrennt am Markt Geld —
    // und die Zusicherung oben wäre auch dann grün.
    const context = richContext(30 * TEST_RULES.constants.ticksPerDay)

    expect(tradeCommands(context, [])).toEqual([])
  })

  it('nimmt die dringlichste Einheit, die auch bezahlbar ist', () => {
    // Vorher wurde genau eine gewählt — die mit dem größten Rückstand — und wenn die
    // unbezahlbar war, ging die Provinz leer aus. Gemessen: 3322 Infanteristen, 15 Panzer,
    // **0 Artillerie**, weil der Panzer den größeren Rückstand hat und am Öl scheitert.
    const context = richContext(30 * TEST_RULES.constants.ticksPerDay)
    ;(context.view.self.resources as Record<string, number>).oil = 0

    const commands = recruitCommands(context, [])
    const recruit = commands.find((command) => command.type === 'RECRUIT')

    expect(recruit, 'kein Aushebungsbefehl trotz vollem Lager').toBeDefined()
    if (recruit?.type === 'RECRUIT') {
      expect(recruit.unitKey, 'ohne Öl darf kein Panzer gewählt werden').not.toBe('tank')
    }
  })
})
