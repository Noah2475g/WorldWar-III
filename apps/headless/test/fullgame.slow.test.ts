import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import { createInitialState, parseRules, type MapData, type Rules } from '@worldwar/core'
import { DEFAULT_NEW_GAME, toConfig } from '../../desktop/src/game/newGame'

/**
 * AK-1: eine vollständige Partie, von Start bis Sieg oder Niederlage (T-M14-14).
 *
 * Das erste und wichtigste Abnahmekriterium der V1 — und bis zum 2026-09-06 prüfte es
 * **kein einziger Test**. Die einzigen `winner`-Zusicherungen im ganzen Bestand waren ein
 * Zweispieler-Einheitstest und ein Determinismusvergleich; keine automatisierte Partie
 * lief je auf der Weltkarte bis zu einer Entscheidung (`docs/reports/audit-2026-09-05.md`,
 * Blocker 2 und Befunde 29, 34).
 *
 * Möglich wurde er erst durch T-M14-11: in der ausgelieferten Voreinstellung gab es
 * vorher **0 Kriegserklärungen in 1000 Spieltagen**, weil die Gegner aus der
 * Kartenreihenfolge kamen und keiner einen Landweg zum Spieler hatte. Ein Abnahmetest auf
 * einer Aufstellung, in der die KI nicht kämpfen kann, hätte nichts gemessen — er wäre
 * grün gewesen oder ewig gelaufen, und beides hätte nichts bedeutet.
 *
 * Gespielt wird die **ausgelieferte** Voreinstellung: dieselbe Partie, die ein Spieler
 * beim ersten Start bekommt. Ein Abnahmetest auf einer eigens gebauten Aufstellung
 * bewiese etwas über die Aufstellung.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const load = (path: string) => JSON.parse(readFileSync(`${ROOT}/${path}`, 'utf8')) as never

const rules: Rules = parseRules(
  {
    constants: load('data/rules/default/constants.json'),
    resources: load('data/rules/default/resources.json'),
    buildings: load('data/rules/default/buildings.json'),
    units: load('data/rules/default/units.json'),
    ai: load('data/rules/default/ai.json'),
  },
  'default',
)
const map = load('data/maps/world.json') as MapData

/** Obergrenze: ohne sie wäre ein hängendes Spiel ein ewig laufender Test. */
const MAX_DAYS = 1500

/**
 * Gibt die Ereignisschleife frei.
 *
 * Keine Nettigkeit: eine Simulation ist ein synchroner Block, und ein Prozess, der
 * Minuten darin verbringt, antwortet währenddessen auf nichts. Der Testläufer hält das
 * für einen hängenden Worker und meldet `Timeout calling "onTaskUpdate"` — bei einem Lauf,
 * dessen Messungen sämtlich richtig sind. Der Parameterlauf hat diese Lehre schon
 * gezogen (`sweep.ts`); hier gilt sie genauso.
 */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('AK-1 Eine vollstaendige Partie gegen mindestens vier KI-Gegner', () => {
  it('kommt zu einem Ausgang, und unterwegs geschieht etwas', async () => {
    const config = toConfig(DEFAULT_NEW_GAME, map)
    const ki = config.players.filter((player) => player.kind === 'ai').length
    expect(ki, 'AK-1 verlangt mindestens vier KI-Gegner').toBeGreaterThanOrEqual(4)

    let current = createInitialState(config, { map, rules })
    const ticksPerDay = rules.constants.ticksPerDay

    // In Abschnitten, mit einem Atemzug dazwischen — siehe `breathe` oben.
    const events: { type: string }[] = []
    const CHUNK_DAYS = 50
    for (let day = 0; day < MAX_DAYS; day += CHUNK_DAYS) {
      const chunk = advanceTicks(current, CHUNK_DAYS * ticksPerDay, { map, rules })
      current = chunk.state
      events.push(...chunk.events)
      if (current.victory.winner !== null) break
      await breathe()
    }

    const result = { state: current }
    const tag = Math.floor(result.state.tick / ticksPerDay)

    const kriege = events.filter((event) => event.type === 'WAR_DECLARED').length
    const eroberungen = events.filter((event) => event.type === 'PROVINCE_CAPTURED').length
    const kaempfe = events.filter((event) => event.type === 'BATTLE_RESOLVED').length

    // Der Bericht wird immer geschrieben, auch wenn die Zusicherungen greifen — eine
    // gescheiterte Abnahme ist die Messung, die man dann am dringendsten braucht.
    mkdirSync(`${ROOT}/docs/reports`, { recursive: true })
    writeFileSync(
      `${ROOT}/docs/reports/fullgame.json`,
      `${JSON.stringify(
        {
          map: map.id,
          players: config.players.length,
          ai: ki,
          nations: config.players.map((player) => player.nation),
          decidedOnDay: result.state.victory.winner ? tag : null,
          winner: result.state.victory.winner,
          condition: result.state.victory.condition,
          warDeclarations: kriege,
          captures: eroberungen,
          battles: kaempfe,
          maxDays: MAX_DAYS,
          measuredAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    )

    // Etwas ist geschehen. Eine Partie ohne Kriegserklärung und ohne Eroberung hat
    // nichts gemessen, wie sauber ihre Zahlen auch aussehen — genau das war der
    // Zustand vor T-M14-11.
    expect(kriege, 'keine einzige Kriegserklaerung in der ganzen Partie').toBeGreaterThan(0)
    expect(eroberungen, 'keine Provinz wechselte je den Besitzer').toBeGreaterThan(0)

    // Und sie ist zu Ende gekommen.
    expect(
      result.state.victory.winner,
      `nach ${tag} Spieltagen unentschieden (${eroberungen} Eroberungen, ${kriege} Kriegserklaerungen)`,
    ).not.toBeNull()
  }, 1_800_000)
})
