import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import { createInitialState, parseRules, type GameEvent, type MapData } from '@worldwar/core'
import { describe, expect, it } from 'vitest'

/**
 * Das Integrationstor (T-M15-08, R-AI-08, R-AI-01).
 *
 * Die letzte Aufgabe von M15, und sie baut nichts Neues: sie **misst**, ob die in M15
 * gebauten Mechaniken für die KI überhaupt leben. Jede Einzelprüfung stellt die Lage
 * selbst her, in der eine Mechanik greift — erst ein Lauf sagt, ob sie je vorkommt.
 *
 * Gemessen wird auf der **ausgelieferten Weltkarte**, nicht auf der Testkarte: die
 * Testkarte hat zwölf Provinzen und vier Städte, und was die KI dort nicht schafft, sagt
 * nichts über das Spiel, das jemand spielt.
 *
 * Alle Zahlen kommen aus dem **Ereignisstrom des Laufs**, nie aus `state.eventLog` — der
 * ist ein Ringpuffer von 500 Einträgen und deckte bei über zwölftausend Ereignissen je
 * Partie nur die letzten Spieltage ab (T-M14-05).
 */

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const load = (path: string): never => JSON.parse(readFileSync(`${ROOT}${path}`, 'utf8')) as never
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

const DAYS = 200

function run(): GameEvent[] {
  const state = createInitialState(
    {
      seed: 1815,
      mapId: map.id,
      rulesId: 'default',
      players: map.startPositions.slice(0, 8).map((start, index) => ({
        name: start.nation,
        kind: 'ai' as const,
        nation: start.nation,
        color: ['#2C5F7C', '#7C3F2C', '#4A5D2C', '#5B3A6B', '#9FB2BE', '#C4A99C', '#6B5B3A', '#3A6B5B'][index]!,
        difficulty: (['easy', 'normal', 'hard'] as const)[index % 3]!,
      })),
      victory: { condition: 'points', pointsShareToWin: 900, dayLimit: null },
    },
    { map, rules },
  )

  return advanceTicks(state, DAYS * rules.constants.ticksPerDay, { map, rules }).events
}

const events = run()

const rejected = (code: string, command?: string): GameEvent[] =>
  events.filter(
    (event) => event.type === 'COMMAND_REJECTED' && event.code === code && (!command || event.command === command),
  )

describe('R-AI-08/AK3 Die KI erzeugt keine Befehle, die der Kern verwirft', () => {
  it('hat ueberhaupt etwas gemessen', () => {
    // Die Zusicherung vor allen anderen. Eine Zaehlung ueber einer leeren Menge ist immer
    // null, und daran sind in diesem Projekt schon drei Waechter gescheitert.
    expect(events.length, 'der Lauf hat nichts gemessen').toBeGreaterThan(1000)
    expect(events.some((event) => event.type === 'BUILD_STARTED')).toBe(true)
    expect(events.some((event) => event.type === 'UNIT_RECRUITED')).toBe(true)
  })

  it('erzeugt keinen Befehl vor dem Freischaltungstag', () => {
    expect(rejected('NOT_YET_AVAILABLE').length).toBe(0)
  })

  it('wirft keine diplomatischen Befehle ins Blaue', () => {
    // Vorher: rund 99 % von 408 abgewiesen, weil die Sicht die eingehenden Angebote nicht
    // fuehrte (T-M14-12, Befund 41).
    expect(rejected('INVALID_TARGET', 'DIPLOMACY').length).toBe(0)
  })

  it('bleibt zahlungsfaehig', () => {
    // Eine KI, die kein Geld mehr hat, trifft keine Entscheidungen mehr — sie erleidet
    // nur noch. Das ist die erste Haelfte von AK3.
    const pleite = events.filter((event) => event.type === 'RESOURCE_SHORTAGE' && event.resource === 'money')
    expect(pleite.length, `Geldmangel bei ${new Set(pleite.map((e) => e.type === 'RESOURCE_SHORTAGE' && e.playerId)).size} Maechten`).toBe(0)
  })
})

describe('R-AI-08/AK3 Die in M15 gebauten Mittel leben', () => {
  const zaehle = (type: GameEvent['type']): number => events.filter((event) => event.type === type).length

  it('schreibt den Bericht — und laesst die Nullen stehen, wo welche sind', () => {
    const zahlen = {
      spieltage: DAYS,
      maechte: 8,
      ereignisse: events.length,
      kriegserklaerungen: zaehle('WAR_DECLARED'),
      friedensschluesse: events.filter((event) => event.type === 'DIPLOMACY_CHANGED' && event.newState === 'truce').length,
      handel: zaehle('TRADE_EXECUTED'),
      fabriken: events.filter((event) => event.type === 'BUILD_STARTED' && event.building === 'factory').length,
      artillerie: events.filter((event) => event.type === 'UNIT_RECRUITED' && event.unitKey === 'artillery').length,
      beschussSelbsttaetig: events.filter((event) => event.type === 'BOMBARDMENT' && event.automatic).length,
      abgelehnt: events.filter((event) => event.type === 'COMMAND_REJECTED').length,
      abgelehntZuFrueh: rejected('NOT_YET_AVAILABLE').length,
      rekrutiert: events.reduce<Record<string, number>>((acc, event) => {
        if (event.type === 'UNIT_RECRUITED') acc[event.unitKey] = (acc[event.unitKey] ?? 0) + event.count
        return acc
      }, {}),
      ablehnungen: events.reduce<Record<string, number>>((acc, event) => {
        if (event.type === 'COMMAND_REJECTED') {
          const key = `${event.command}:${event.code}`
          acc[key] = (acc[key] ?? 0) + 1
        }
        return acc
      }, {}),
    }

    const dir = fileURLToPath(new URL('../../../docs/reports/', import.meta.url))
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}ai-integration.json`, JSON.stringify(zahlen, null, 2) + '\n')

    expect(zahlen.ereignisse).toBeGreaterThan(1000)
  })

  it('fuehrt Artillerie und laesst sie feuern', () => {
    // **Die Kette, um die es in dieser Aufgabe geht.** Ohne Fabrik keine Artillerie, ohne
    // Artillerie ist `armyRange` jeder Armee 0, und die Feuerautomatik aus T-M15-07 waere
    // gebaut, gruen getestet und wirkungslos — der Zustand, den PROBLEME.md am 2026-09-06
    // fuer die Testkarte belegt hat.
    const fabriken = events.filter((event) => event.type === 'BUILD_STARTED' && event.building === 'factory')
    const artillerie = events.filter((event) => event.type === 'UNIT_RECRUITED' && event.unitKey === 'artillery')
    const beschuss = events.filter((event) => event.type === 'BOMBARDMENT' && event.automatic)

    expect(fabriken.length, 'keine einzige Fabrik in 200 Spieltagen').toBeGreaterThan(0)
    expect(artillerie.length, 'keine Artillerie — die Feuerautomatik hat nichts zu tun').toBeGreaterThan(0)
    expect(beschuss.length, 'kein selbsttaetiger Beschuss').toBeGreaterThan(0)
  })
})
