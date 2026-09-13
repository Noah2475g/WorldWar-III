import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import { createInitialState, parseRules, type GameEvent, type MapData, type Rules } from '@worldwar/core'
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
 *
 * **Andere Startzahlen** (T-M41-02): `WORLDWAR_FULLGAME_SEED=2015 pnpm sim:fullgame` spielt
 * dieselbe Voreinstellung mit anderer Startzahl und schreibt `fullgame-2015.json`. Ein
 * Siegtag aus einer einzigen Startzahl ist eine Zahl, kein Befund — 1914 endet an Tag
 * 471, 2015 an Tag 583, und was dazwischen liegt, ist Rauschen der Startzahl.
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

/** Die ausgelieferte Startzahl, oder die aus der Umgebung (T-M41-02). */
const SEED = Number(process.env['WORLDWAR_FULLGAME_SEED'] ?? DEFAULT_NEW_GAME.seed)
const REPORT = SEED === DEFAULT_NEW_GAME.seed ? 'fullgame.json' : `fullgame-${SEED}.json`

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
    expect(Number.isSafeInteger(SEED), `WORLDWAR_FULLGAME_SEED ist keine Zahl`).toBe(true)
    const config = toConfig({ ...DEFAULT_NEW_GAME, seed: SEED }, map)
    const ki = config.players.filter((player) => player.kind === 'ai').length
    expect(ki, 'AK-1 verlangt mindestens vier KI-Gegner').toBeGreaterThanOrEqual(4)

    let current = createInitialState(config, { map, rules })
    const ticksPerDay = rules.constants.ticksPerDay

    // In Abschnitten, mit einem Atemzug dazwischen — siehe `breathe` oben.
    const events: GameEvent[] = []
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

    // Das KI-Gedaechtnis am Ende (T-M41-05): Eintraege in `assignments` je Macht gegen ihre
    // lebenden Armeen. Das Feld wird nie gelesen und wuchs bis zum 2026-09-13 ohne Grenze;
    // `veraltet` zaehlt Eintraege fuer Armeen, die es nicht mehr gibt. Eine Zusicherung
    // steht hier bewusst nicht: zwischen zwei Denkschritten einer Macht darf eine Armee
    // fallen, und wie viele das sind, haengt an der Partie, nicht an der Kuerzung.
    const final = current
    const kiGedaechtnis = Object.fromEntries(
      final.playerOrder
        .filter((id) => final.players[id]!.kind === 'ai')
        .map((id) => {
          const lebend = new Set(final.armyOrder.filter((armyId) => final.armies[armyId]?.owner === id))
          const eintraege = Object.keys(final.ai[id]?.assignments ?? {})
          return [
            final.players[id]!.nation,
            { eintraege: eintraege.length, armeen: lebend.size, veraltet: eintraege.filter((armyId) => !lebend.has(armyId)).length },
          ]
        }),
    )
    const kb = (value: unknown) => Math.round(Buffer.byteLength(JSON.stringify(value)) / 1024)

    // Die zweite Fortschrittsachse in der ganzen Partie (T-M41-02). Ein gruener Einzeltest
    // belegt, dass die KI den Ausbau befiehlt — nicht, dass sie in einer Partie klettert.
    // Gezaehlt wird zweimal: was am Ende steht (Besitz, auch erobert) und was je begonnen
    // wurde (BUILD_STARTED traegt die Stufe, aus dem Ereignisstrom, nie aus dem Ringpuffer).
    const hoechsteFabrikstufe = Object.fromEntries(
      final.playerOrder.map((id) => [
        final.players[id]!.nation,
        final.provinceOrder.reduce(
          (best, provinceId) =>
            final.provinces[provinceId]!.owner === id
              ? Math.max(best, final.provinces[provinceId]!.buildings.factory ?? 0)
              : best,
          0,
        ),
      ]),
    )
    const fabrikenAmEnde = (stufe: number) =>
      final.provinceOrder.filter((provinceId) => (final.provinces[provinceId]!.buildings.factory ?? 0) >= stufe).length
    const ausbauBegonnen = (stufe: number) =>
      events.filter((event) => event.type === 'BUILD_STARTED' && event.building === 'factory' && event.level === stufe)
        .length

    // Der Bericht wird immer geschrieben, auch wenn die Zusicherungen greifen — eine
    // gescheiterte Abnahme ist die Messung, die man dann am dringendsten braucht.
    mkdirSync(`${ROOT}/docs/reports`, { recursive: true })
    writeFileSync(
      `${ROOT}/docs/reports/${REPORT}`,
      `${JSON.stringify(
        {
          map: map.id,
          seed: SEED,
          players: config.players.length,
          ai: ki,
          nations: config.players.map((player) => player.nation),
          decidedOnDay: result.state.victory.winner ? tag : null,
          winner: result.state.victory.winner,
          condition: result.state.victory.condition,
          warDeclarations: kriege,
          captures: eroberungen,
          battles: kaempfe,
          factory: {
            highestLevelPerNation: hoechsteFabrikstufe,
            provincesAtLevel2OrMore: fabrikenAmEnde(2),
            provincesAtLevel3: fabrikenAmEnde(3),
            upgradesStartedToLevel2: ausbauBegonnen(2),
            upgradesStartedToLevel3: ausbauBegonnen(3),
          },
          aiMemory: kiGedaechtnis,
          aiMemoryKB: kb(final.ai),
          stateKB: kb(final),
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

    // Die KI klettert die Gebaeudeachse (T-M41-02, R-PROV-02). Bis T-M41-01 kam keine Macht
    // ueber Fabrikstufe 1 hinaus; die Stufe 3 bleibt ausdruecklich keine Zusicherung.
    expect(
      Math.max(0, ...Object.values(hoechsteFabrikstufe)),
      `keine Macht besitzt am Ende eine Fabrik der Stufe 2 (${JSON.stringify(hoechsteFabrikstufe)})`,
    ).toBeGreaterThanOrEqual(2)
  }, 1_800_000)
})
