import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import {
  createInitialState,
  edgeBetween,
  edgeTravelTicks,
  parseRules,
  type Army,
  type GameEvent,
  type GameState,
  type MapData,
  type PlayerId,
  type Rules,
  type Stance,
} from '@worldwar/core'
import { placeArmy } from '@worldwar/testkit'
import { DEFAULT_NEW_GAME, toConfig } from '../../desktop/src/game/newGame'

/**
 * Der Haltungs-Messlauf (T-M40-02, D30.6, R-UNIT-09/AK5).
 *
 * Erst messen, dann aendern. Bevor eine Zeile Automatik existiert, haelt dieser Lauf fest,
 * was mit einem Einmarsch in eine Provinz des Menschen geschieht, wenn er nicht klickt:
 * Weltkarte, ausgelieferte Regeln, 200 Spieltage ueber `advanceTicks`; der Mensch spielt
 * Deutschland (Landgrenzen zu mehreren KI-Nachbarn), bekommt beim Aufsetzen eine Armee in
 * jede eigene Provinz und gibt danach keinen einzigen Befehl.
 *
 * Gezaehlt wird aus dem **Ereignisstrom** des Laufs, nie aus `state.eventLog` — der ist ein
 * Ringpuffer und deckt nur die letzten Spieltage ab (T-M14-05). Der Bericht fuehrt die
 * Zahl aus dem Puffer daneben, damit der Unterschied sichtbar bleibt.
 *
 * **Das Fenster.** D30.6 nannte „eine eigene Armee erreicht die Provinz binnen 24 Ticks".
 * Auf der Weltkarte ist das fuer Infanterie nicht erreichbar: die kuerzeste deutsche
 * Binnengrenze misst 146 km, bei 6 km/h sind das mindestens 25 Ticks, und der Befehl kann
 * fruehestens im Tick nach dem Einmarsch fallen (D30.4). Die Zahl mit 24 Ticks wird
 * weiter gezaehlt; zugesichert wird ueber ein Fenster, das **vor** jeder Messung aus der
 * Karte folgt — ein Tick Verzug plus die laengste Marschzeit ueber eine eigene
 * Binnengrenze fuer genau die aufgestellte Armee. Dazu der Aufbruch binnen 24 Ticks: er
 * misst die Reaktion unabhaengig von der Marschzeit.
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

const NATION = 'Deutschland'
const SEED = 1914
const DAYS = 200
const CHUNK_DAYS = 25
const UNIT_KEY = 'infantry'
const UNITS_PER_PROVINCE = 5
/** Das Fenster, das D30.6 nannte — mitgezaehlt, nicht zugesichert (siehe oben). */
const PLAN_WINDOW_TICKS = 24
/** Der KI-Stand, auf dem gemessen wurde (Hinweis des Orchestrators vom 2026-09-13). */
const STAND = 'gemessen vor der M41-Nacharbeit (KI-Bauordnung)'
const REPORT = `${ROOT}/docs/reports/stance.json`

interface StanceCount {
  /** `ARMY_INTRUDED` in eine Provinz des Menschen. */
  intrusions: number
  /** Davon: eine eigene Armee kommt binnen 24 Ticks dort an (das Fenster aus D30.6). */
  answeredWithin24Ticks: number
  /** Davon: eine eigene Armee kommt binnen des Fensters aus der Karte dort an. */
  answeredWithinWindow: number
  /** Davon: eine eigene Armee bricht binnen 24 Ticks dorthin auf. */
  departedWithin24Ticks: number
  /** `PROVINCE_CAPTURED` aus dem Besitz des Menschen. */
  provincesLost: number
  /** `COMMAND_REJECTED` fuer den Menschen — er selbst befiehlt nichts. */
  rejectedCommands: number
}

/** Zaehlt aus einem Ereignisstrom; Antworten zaehlen erst im Tick NACH dem Einmarsch. */
function zaehle(events: readonly GameEvent[], human: PlayerId, windowTicks: number): StanceCount {
  const einmaersche = events.filter(
    (event): event is Extract<GameEvent, { type: 'ARMY_INTRUDED' }> => event.type === 'ARMY_INTRUDED' && event.playerId === human,
  )
  const ankuenfte = events.filter(
    (event): event is Extract<GameEvent, { type: 'ARMY_ARRIVED' }> => event.type === 'ARMY_ARRIVED' && event.playerId === human,
  )
  const aufbrueche = events.filter(
    (event): event is Extract<GameEvent, { type: 'ARMY_DEPARTED' }> => event.type === 'ARMY_DEPARTED' && event.playerId === human,
  )

  const erreicht = (einmarsch: (typeof einmaersche)[number], fenster: number): boolean =>
    ankuenfte.some(
      (ankunft) =>
        ankunft.provinceId === einmarsch.provinceId && ankunft.tick > einmarsch.tick && ankunft.tick <= einmarsch.tick + fenster,
    )
  const aufgebrochen = (einmarsch: (typeof einmaersche)[number]): boolean =>
    aufbrueche.some(
      (aufbruch) =>
        aufbruch.toProvinceId === einmarsch.provinceId &&
        aufbruch.tick > einmarsch.tick &&
        aufbruch.tick <= einmarsch.tick + PLAN_WINDOW_TICKS,
    )

  return {
    intrusions: einmaersche.length,
    answeredWithin24Ticks: einmaersche.filter((einmarsch) => erreicht(einmarsch, PLAN_WINDOW_TICKS)).length,
    answeredWithinWindow: einmaersche.filter((einmarsch) => erreicht(einmarsch, windowTicks)).length,
    departedWithin24Ticks: einmaersche.filter(aufgebrochen).length,
    provincesLost: events.filter((event) => event.type === 'PROVINCE_CAPTURED' && event.previousOwner === human).length,
    rejectedCommands: events.filter((event) => event.type === 'COMMAND_REJECTED' && event.playerId === human).length,
  }
}

const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('D30.6 Die Zaehlung des Haltungs-Messlaufs', () => {
  const ereignis = (fields: Record<string, unknown>): GameEvent =>
    ({ severity: 'info', audience: [], concerns: [], ...fields }) as unknown as GameEvent

  it('zaehlt Einmaersche, Antworten, Verluste und Ablehnungen nur fuer den Menschen', () => {
    const events = [
      ereignis({ type: 'ARMY_INTRUDED', tick: 10, playerId: 'p1', intruderId: 'p2', armyId: 'a9', provinceId: 'P' }),
      // Ein Einmarsch bei einer anderen Macht zaehlt nicht.
      ereignis({ type: 'ARMY_INTRUDED', tick: 10, playerId: 'p3', intruderId: 'p2', armyId: 'a8', provinceId: 'Q' }),
      ereignis({ type: 'ARMY_DEPARTED', tick: 11, playerId: 'p1', armyId: 'a1', fromProvinceId: 'R', toProvinceId: 'P', arrivalTick: 50 }),
      ereignis({ type: 'ARMY_ARRIVED', tick: 50, playerId: 'p1', armyId: 'a1', provinceId: 'P' }),
      ereignis({ type: 'ARMY_INTRUDED', tick: 100, playerId: 'p1', intruderId: 'p2', armyId: 'a7', provinceId: 'S' }),
      // Im selben Tick angekommen ist keine Antwort: die Armee war schon unterwegs.
      ereignis({ type: 'ARMY_ARRIVED', tick: 100, playerId: 'p1', armyId: 'a2', provinceId: 'S' }),
      ereignis({ type: 'ARMY_ARRIVED', tick: 120, playerId: 'p1', armyId: 'a3', provinceId: 'S' }),
      // Eine fremde Armee, die ankommt, antwortet nicht fuer den Menschen.
      ereignis({ type: 'ARMY_ARRIVED', tick: 12, playerId: 'p2', armyId: 'a9', provinceId: 'P' }),
      ereignis({ type: 'PROVINCE_CAPTURED', tick: 130, provinceId: 'S', previousOwner: 'p1', newOwner: 'p2' }),
      ereignis({ type: 'PROVINCE_CAPTURED', tick: 130, provinceId: 'Q', previousOwner: 'p3', newOwner: 'p2' }),
      ereignis({ type: 'COMMAND_REJECTED', tick: 131, playerId: 'p1', command: 'MOVE_ARMY', code: 'NO_PATH' }),
      ereignis({ type: 'COMMAND_REJECTED', tick: 131, playerId: 'p2', command: 'MOVE_ARMY', code: 'NO_PATH' }),
    ]

    expect(zaehle(events, 'p1', 45)).toEqual({
      intrusions: 2,
      // P: Ankunft nach 40 Ticks — ausserhalb von 24, innerhalb von 45. S: nach 20 Ticks.
      answeredWithin24Ticks: 1,
      answeredWithinWindow: 2,
      departedWithin24Ticks: 1,
      provincesLost: 1,
      rejectedCommands: 1,
    })
  })
})

/** Deutschland mit einer Armee in jeder eigenen Provinz. */
function aufstellen(stance: Stance): { state: GameState; human: PlayerId; opponents: string[] } {
  const config = toConfig({ ...DEFAULT_NEW_GAME, nation: NATION, seed: SEED }, map)
  const state = createInitialState(config, { map, rules })
  const human = state.playerOrder.find((id) => state.players[id]!.kind === 'human')!
  expect(state.players[human]!.nation).toBe(NATION)

  const hp = UNITS_PER_PROVINCE * rules.units[UNIT_KEY]!.hpPerUnit
  for (const id of state.provinceOrder) {
    if (state.provinces[id]!.owner !== human) continue
    placeArmy(state, { owner: human, at: id, units: [{ unitKey: UNIT_KEY, hpTotal: hp }], stance })
  }
  const opponents = config.players.filter((player) => player.kind === 'ai').map((player) => player.nation)
  return { state, human, opponents }
}

/** Marschzeit ueber jede eigene Binnengrenze (Landkante), in beide Richtungen. */
function binnenMarschzeiten(state: GameState, human: PlayerId): { from: string; to: string; km: number; ticks: number }[] {
  const probe = state.armies[state.armyOrder.find((id) => state.armies[id]!.owner === human)!]!
  const zeiten: { from: string; to: string; km: number; ticks: number }[] = []
  for (const from of state.provinceOrder) {
    if (state.provinces[from]!.owner !== human) continue
    for (const to of state.provinces[from]!.neighbors) {
      if (state.provinces[to]?.owner !== human) continue
      const edge = edgeBetween(map.edges, map.edgesByProvince[from], from, to)
      if (!edge || edge.kind !== 'land') continue
      const army: Army = { ...probe, locationProvinceId: from }
      zeiten.push({ from, to, km: Math.round(edge.distanceKm / 1000), ticks: edgeTravelTicks(state, army, edge, from, to, rules) })
    }
  }
  return zeiten
}

async function fahre(stance: Stance): Promise<{
  events: GameEvent[]
  human: PlayerId
  humanCommands: number
  final: GameState
  opponents: string[]
}> {
  const aufgestellt = aufstellen(stance)
  let current = aufgestellt.state
  const events: GameEvent[] = []
  let humanCommands = 0
  const ticksPerDay = rules.constants.ticksPerDay

  for (let day = 0; day < DAYS; day += CHUNK_DAYS) {
    const chunk = advanceTicks(current, CHUNK_DAYS * ticksPerDay, { map, rules })
    current = chunk.state
    events.push(...chunk.events)
    humanCommands += chunk.applied.filter((entry) => entry.command.playerId === aufgestellt.human).length
    if (current.victory.winner !== null) break
    await breathe()
  }
  return { events, human: aufgestellt.human, humanCommands, final: current, opponents: aufgestellt.opponents }
}

/** Was ein Lauf ueber die Zaehlung hinaus erklaert: wer kam, wann, was blieb. */
function umstaende(lauf: Awaited<ReturnType<typeof fahre>>) {
  const { events, human, final } = lauf
  const einmaersche = events.filter(
    (event): event is Extract<GameEvent, { type: 'ARMY_INTRUDED' }> => event.type === 'ARMY_INTRUDED' && event.playerId === human,
  )
  const nachNation: Record<string, number> = {}
  for (const event of einmaersche) {
    const nation = final.players[event.intruderId]?.nation ?? event.intruderId
    nachNation[nation] = (nachNation[nation] ?? 0) + 1
  }
  const ticksPerDay = rules.constants.ticksPerDay
  return {
    intrudersByNation: nachNation,
    firstIntrusionDay: einmaersche.length > 0 ? Math.floor(einmaersche[0]!.tick / ticksPerDay) : null,
    warsDeclaredOnHuman: events.filter((event) => event.type === 'WAR_DECLARED' && event.targetPlayerId === human).length,
    ringBufferIntrusions: final.eventLog.filter((event) => event.type === 'ARMY_INTRUDED' && event.playerId === human).length,
    humanCommands: lauf.humanCommands,
    provincesAtEnd: final.provinceOrder.filter((id) => final.provinces[id]!.owner === human).length,
    armiesAtEnd: final.armyOrder.filter((id) => final.armies[id]!.owner === human).length,
    daysRun: Math.floor(final.tick / ticksPerDay),
  }
}

describe('R-UNIT-09/AK5 Der Haltungs-Messlauf', () => {
  it('misst vorher: Einmaersche in eine Provinz des Menschen, der nicht klickt', async () => {
    const vorbereitung = aufstellen('defensive')
    const binnen = binnenMarschzeiten(vorbereitung.state, vorbereitung.human)
    expect(binnen.length, 'keine eigene Binnengrenze — das Fenster waere leer').toBeGreaterThan(0)
    const windowTicks = 1 + Math.max(...binnen.map((kante) => kante.ticks))

    const lauf = await fahre('defensive')
    const vorher = { stance: 'defensive', adjutant: false, stand: STAND, ...zaehle(lauf.events, lauf.human, windowTicks), ...umstaende(lauf) }

    mkdirSync(`${ROOT}/docs/reports`, { recursive: true })
    writeFileSync(
      REPORT,
      `${JSON.stringify(
        {
          tasks: 'T-M40-02 (vorher), T-M40-06 (nachher)',
          stand: STAND,
          map: map.id,
          seed: SEED,
          days: DAYS,
          human: NATION,
          opponents: lauf.opponents,
          setup: { unitKey: UNIT_KEY, unitsPerProvince: UNITS_PER_PROVINCE, armies: vorbereitung.state.armyOrder.length },
          counting: {
            source: 'Ereignisstrom von advanceTicks, nicht state.eventLog',
            planWindowTicks: PLAN_WINDOW_TICKS,
            windowTicks,
            windowRule: '1 Tick Verzug (D30.4) + laengste Marschzeit ueber eine eigene Binnengrenze fuer die aufgestellte Armee',
          },
          innerBorders: binnen,
          vorher: { ...vorher, measuredAt: new Date().toISOString() },
        },
        null,
        2,
      )}\n`,
    )

    // Vorher heisst: ohne Automatik. Der Mensch gibt keinen Befehl, also steht hier null.
    expect(vorher.humanCommands, 'im Lauf vorher hat jemand fuer den Menschen befohlen').toBe(0)
    // Zugesichert wird nur, dass etwas gemessen wurde. Ist es null, ist die Nation falsch
    // gewaehlt — dann wird sie gewechselt und begruendet, nicht diese Zeile gelockert.
    expect(vorher.intrusions, `kein einziger Einmarsch in ${DAYS} Spieltagen gegen ${NATION}`).toBeGreaterThan(0)
  }, 1_800_000)
})
