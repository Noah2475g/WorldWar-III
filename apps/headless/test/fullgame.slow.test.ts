import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import {
  GOAL_KEYS,
  createInitialState,
  parseRules,
  type GameConfig,
  type GameEvent,
  type GameState,
  type MapData,
  type Rules,
} from '@worldwar/core'
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
 * Siegtag aus einer einzigen Startzahl ist eine Zahl, kein Befund: nach Block N2 der
 * M41-Nacharbeit endet 1914 an Tag 975, 2015 und 1815 an Tag 583 (vor M41: 471, 583, 774).
 * Die Startzahl variiert **nur den Zufall** — Aufstellung, Gegner und Hauptstädte sind in
 * allen dreien gleich (Startzustand ohne `seed`/`rng` identisch, geprüft 2026-09-13); die
 * Streuung ist also enger, als „drei Startzahlen" klingt.
 *
 * **Die Zieltage** (T-M35-06, R-GAME-08/AK6): ein grüner Einzeltest sagt nichts über das
 * Spiel — die vier Marken der Zwischenziele müssen in einer ganzen Partie in der richtigen
 * Reihenfolge fallen. Der Bericht führt die Tage jeder Macht; zugesichert wird die
 * Reihenfolge nur für die ausgelieferte Startzahl, die beiden anderen stehen als Zahl im
 * Bericht. Gegengeprüft wird gegen `GOAL_REACHED` im Ereignisstrom, nie gegen den Ringpuffer.
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
const SHIPPED_SEED = SEED === DEFAULT_NEW_GAME.seed
const REPORT = SHIPPED_SEED ? 'fullgame.json' : `fullgame-${SEED}.json`

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

type GoalReached = Extract<GameEvent, { type: 'GOAL_REACHED' }>

interface Partie {
  config: GameConfig
  ki: number
  state: GameState
  events: GameEvent[]
  tag: number
  kriege: number
  eroberungen: number
  hoechsteFabrikstufe: Record<string, number>
}

/** Die Zieltage einer Macht aus dem Spielstand, in der Reihenfolge der Marken. */
const zieltageAus = (state: GameState, id: string): (number | null)[] =>
  GOAL_KEYS.map((goal) => state.goals[id]?.[goal] ?? null)

/** Die Tage aller Meldungen je Ziel einer Macht aus dem Ereignisstrom — erwartet: höchstens eine. */
const meldetageAus = (events: readonly GameEvent[], id: string): number[][] => {
  const meldungen = events.filter((event): event is GoalReached => event.type === 'GOAL_REACHED')
  return GOAL_KEYS.map((goal) => meldungen.filter((m) => m.playerId === id && m.goal === goal).map((m) => m.day))
}

let partie: Partie

beforeAll(async () => {
  if (!Number.isSafeInteger(SEED)) throw new Error('WORLDWAR_FULLGAME_SEED ist keine Zahl')
  const config = toConfig({ ...DEFAULT_NEW_GAME, seed: SEED }, map)
  const ki = config.players.filter((player) => player.kind === 'ai').length

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

  const tag = Math.floor(current.tick / ticksPerDay)

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

  // Die Staedte je Macht am Ende, mit Eisenbahn und Festung (Nacharbeit zu T-M41-01, H1 der
  // Durchsicht M41). `nextBuildingFor` lieferte fuer jede Stadt mit einer Fabrik unter
  // `maxLevel` nur noch "factory"; war diese Stufe zu teuer, kam in der Stadt nichts anderes
  // an die Reihe — Eisenbahn und Festung erst nach Fabrikstufe 3. `fabrikOhneEisenbahn`
  // zaehlt genau die Staedte, die so haengen koennen. Eine Zahl, keine Zusicherung: wie viele
  // Staedte eine Macht am Ende haelt, haengt an der Partie, nicht an der Bauordnung.
  const staedte = Object.fromEntries(
    final.playerOrder.map((id) => {
      const eigene = final.provinceOrder
        .map((provinceId) => final.provinces[provinceId]!)
        .filter((province) => province.owner === id && province.kind === 'city')
      const mindestens = (building: 'railway' | 'fortress', stufe: number) =>
        eigene.filter((province) => (province.buildings[building] ?? 0) >= stufe).length
      return [
        final.players[id]!.nation,
        {
          staedte: eigene.length,
          eisenbahn: mindestens('railway', 1),
          festung: mindestens('fortress', 1),
          festung2: mindestens('fortress', 2),
          fabrikOhneEisenbahn: eigene.filter(
            (province) => (province.buildings.factory ?? 0) >= 1 && (province.buildings.railway ?? 0) === 0,
          ).length,
        },
      ]
    }),
  )

  // Die Zieltage jeder Macht (T-M35-06, R-GAME-08/AK6): aus dem Spielstand, und daneben die Zahl
  // der Meldungen aus dem Ereignisstrom. Eine Zahl je Macht, keine Zusicherung — zugesichert wird
  // unten nur die Reihenfolge beim Sieger der ausgelieferten Startzahl.
  const winner = final.victory.winner
  const alsZiele = (tage: readonly (number | null)[]) =>
    Object.fromEntries(GOAL_KEYS.map((goal, index) => [goal, tage[index] ?? null]))
  const ziele = {
    marks: {
      provinces: rules.constants.goalProvinces,
      pointShareFirst: rules.constants.goalPointShareFirstPermille,
      populationShare: rules.constants.goalPopulationSharePermille,
      pointShareSecond: rules.constants.goalPointShareSecondPermille,
    },
    winner: winner ? alsZiele(zieltageAus(final, winner)) : null,
    perNation: Object.fromEntries(final.playerOrder.map((id) => [final.players[id]!.nation, alsZiele(zieltageAus(final, id))])),
    reachedEvents: events.filter((event) => event.type === 'GOAL_REACHED').length,
  }

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
        decidedOnDay: winner ? tag : null,
        winner,
        condition: final.victory.condition,
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
        cities: staedte,
        goals: ziele,
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

  partie = { config, ki, state: final, events, tag, kriege, eroberungen, hoechsteFabrikstufe }
}, 1_800_000)

describe('AK-1 Eine vollstaendige Partie gegen mindestens vier KI-Gegner', () => {
  it('kommt zu einem Ausgang, und unterwegs geschieht etwas', () => {
    const { ki, state, tag, kriege, eroberungen, hoechsteFabrikstufe } = partie
    expect(ki, 'AK-1 verlangt mindestens vier KI-Gegner').toBeGreaterThanOrEqual(4)

    // Etwas ist geschehen. Eine Partie ohne Kriegserklärung und ohne Eroberung hat
    // nichts gemessen, wie sauber ihre Zahlen auch aussehen — genau das war der
    // Zustand vor T-M14-11.
    expect(kriege, 'keine einzige Kriegserklaerung in der ganzen Partie').toBeGreaterThan(0)
    expect(eroberungen, 'keine Provinz wechselte je den Besitzer').toBeGreaterThan(0)

    // Und sie ist zu Ende gekommen.
    expect(
      state.victory.winner,
      `nach ${tag} Spieltagen unentschieden (${eroberungen} Eroberungen, ${kriege} Kriegserklaerungen)`,
    ).not.toBeNull()

    // Die KI klettert die Gebaeudeachse (T-M41-02, R-PROV-02). Bis T-M41-01 kam keine Macht
    // ueber Fabrikstufe 1 hinaus; die Stufe 3 bleibt ausdruecklich keine Zusicherung.
    expect(
      Math.max(0, ...Object.values(hoechsteFabrikstufe)),
      `keine Macht besitzt am Ende eine Fabrik der Stufe 2 (${JSON.stringify(hoechsteFabrikstufe)})`,
    ).toBeGreaterThanOrEqual(2)
  })
})

describe('R-GAME-08/AK6 Die Zieltage des Siegers steigen in der Reihenfolge der Marken', () => {
  it('stimmen je Macht und Ziel mit dem Ereignisstrom ueberein — hoechstens eine Meldung', () => {
    // Fuer jede Startzahl: das ist keine Aussage ueber die Marken, sondern ueber die Mechanik.
    const { state, events } = partie
    for (const id of state.playerOrder) {
      const tage = zieltageAus(state, id)
      const meldungen = meldetageAus(events, id)
      const nation = state.players[id]!.nation
      expect(meldungen, `${nation}: Meldungen ${JSON.stringify(meldungen)} gegen Spielstand ${JSON.stringify(tage)}`).toEqual(
        tage.map((tag) => (tag === null ? [] : [tag])),
      )
    }
  })

  it.runIf(SHIPPED_SEED)(
    'steigen beim Sieger, beginnen nicht vor Spieltag 20 und enden nicht nach dem Siegtag (Startzahl 1914)',
    () => {
      const { state, tag } = partie
      const winner = state.victory.winner
      expect(winner, 'die Partie ist nicht entschieden').not.toBeNull()

      const tage = zieltageAus(state, winner!)
      const offen = GOAL_KEYS.filter((_, index) => tage[index] === null)
      expect(offen, `offene Ziele des Siegers ${state.players[winner!]!.nation}`).toEqual([])

      const reihe = tage as number[]
      expect(reihe[0], `erstes Ziel an Tag ${reihe[0]}`).toBeGreaterThanOrEqual(20)
      for (let index = 1; index < reihe.length; index++) {
        expect(
          reihe[index],
          `${GOAL_KEYS[index]} (Tag ${reihe[index]}) nicht nach ${GOAL_KEYS[index - 1]} (Tag ${reihe[index - 1]})`,
        ).toBeGreaterThan(reihe[index - 1]!)
      }
      expect(reihe[reihe.length - 1], `letztes Ziel an Tag ${reihe[reihe.length - 1]}, Sieg an Tag ${tag}`).toBeLessThanOrEqual(tag)
    },
  )
})
