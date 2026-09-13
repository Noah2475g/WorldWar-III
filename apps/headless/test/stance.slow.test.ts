import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { advanceTicks } from '@worldwar/ai'
import {
  createInitialState,
  edgeBetween,
  edgeTravelTicks,
  parseRules,
  type Army,
  type Command,
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
 * Der Haltungs-Messlauf (T-M40-02, T-M40-06; seit T-M40-07 je umkaempfter Episode;
 * D30.6, R-UNIT-09/AK5).
 *
 * **Die Geschichte.** T-M40-02 und T-M40-06 zaehlten Einmaersche in Provinzen des Menschen
 * und fragten, ob danach eine eigene Armee dort ankam. Die Durchsicht von M40 (Befund H3)
 * zeigte, dass diese Zahl die Abnahme nicht traegt: ohne Adjutant war sie strukturell null,
 * "beantwortet" hiess "irgendwann angekommen" (neun beantwortete Einmaersche aus zwei
 * Ankuenften), und zwei der drei Verluste im Lauf nachher hatte die Deckung selbst verursacht
 * — sie hatte die Provinzen geleert, die danach ohne Gefecht fielen. Ein Entwurf mass fuenf
 * Regeln: Varianten mit 73 bis 80 Prozent "beantwortet" verloren alles. Die Zahl steht weiter
 * im Bericht; zugesichert wird sie nicht mehr.
 *
 * **Was jetzt gemessen wird.** Weltkarte, ausgelieferte Regeln, 200 Spieltage ueber
 * `advanceTicks`, der Mensch spielt Deutschland mit KI-Nachbarn und gibt keinen Befehl. Drei
 * Startzahlen (1914, 2015, 1815) mal zwei Aufstellungen — **A**: eine Armee aus fuenf
 * Infanterie je Provinz, **B**: zwei — mal zwei Haltungen: `garrison` (kaempft wie die
 * Verteidigung, handelt nie von selbst) und `defensive` (mit Adjutant). Zwoelf Laeufe.
 *
 *  - **Provinz-Tage:** zu Beginn jedes Spieltags die Zahl der Provinzen des Menschen, summiert
 *    (dieselbe Zaehlweise wie im Entwurf, auf der die Schwelle steht). Ein Nenner, der nicht mit
 *    dem Widerstand waechst.
 *  - **Episode:** die groesste zusammenhaengende Folge von Ticks mit `BATTLE_RESOLVED` in einer
 *    Provinz, die zu Beginn ihres ersten Ticks dem Menschen gehoerte; sie endet im ersten Tick
 *    ohne Gefecht dort. Je Episode: Deckung befohlen, Deckung vor Gefechtsende angekommen,
 *    gehalten (Besitzer nach der Episode).
 *  - **Verloren ohne Gefecht:** `PROVINCE_CAPTURED` aus dem Besitz des Menschen in einem Tick
 *    ohne `BATTLE_RESOLVED` in dieser Provinz — die entbloesste Provinz.
 *  - **Pendelzug:** eine Armee marschiert von A nach B und binnen fuenf Spieltagen zurueck.
 *
 * Gezaehlt wird aus dem **Ereignisstrom**, Tick fuer Tick, nie aus `state.eventLog`.
 *
 * **Die Zusicherungen (AK5), festgelegt vor der Messung der gebauten Regel:** ueber alle sechs
 * Paare erreichen die Provinz-Tage mit Verteidigung mindestens 98 Prozent der Garnison; je Paar
 * gehen mit Verteidigung nicht mehr Provinzen ohne Gefecht verloren als mit Garnison; kein
 * Befehl wird abgelehnt, keiner loest einen Krieg ohne Erklaerung aus; und die Garnison A 1914
 * bildet den Lauf vorher aus T-M40-02 nach. Die Schwelle 98 Prozent stand erst nach der Messung
 * des Entwurfs fest (D30.9) — sie gilt fuer die Summe, weil die Regel des Entwurfs in einem
 * Einzellauf (1815 B) drei Prozent unter der Garnison lag.
 *
 * **Der Bericht** `docs/reports/stance.json` wird nur mit `WORLDWAR_WRITE_REPORT=1`
 * geschrieben (Befund N3: vorher schrieb jeder Lauf ihn neu, mit neuem Zeitstempel). Ohne die
 * Variable liest und schreibt der Test nichts.
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
const SEEDS = [1914, 2015, 1815] as const
const DAYS = 200
const UNIT_KEY = 'infantry'
const UNITS_PER_ARMY = 5
/** Armeen je Provinz in den zwei Aufstellungen. */
const SETUPS = { A: 1, B: 2 } as const
type Aufbau = keyof typeof SETUPS
const STANCES = ['garrison', 'defensive'] as const
/** Das Fenster, das D30.6 nannte — mitgezaehlt, nicht zugesichert. */
const PLAN_WINDOW_TICKS = 24
/** Das Kartenfenster aus T-M40-02; aendert es sich, hat sich die Karte geaendert. */
const WINDOW_TICKS_T_M40_02 = 114
/** Hin und zurueck binnen dieser Spieltage ist ein Pendelzug. */
const PENDULUM_DAYS = 5
/** AK5: Provinz-Tage mit Verteidigung mindestens so viele Prozent der Garnison (D30.9). */
const PROVINCE_DAYS_PERCENT = 98
/** Der Lauf vorher (T-M40-02, Garnison A 1914), den die Garnison nachbilden muss. */
const VORHER = { intrusions: 52, provincesLost: 4 }
/** Der KI-Stand, auf dem gemessen wurde (Block N2 aendert die Gegner, danach neu messen). */
const STAND = 'gemessen vor Block N2 der M41-Nacharbeit (KI-Verhalten)'
/** Welcher Abschnitt von `episoden` geschrieben wird: T-M40-07 misst den heutigen Adjutanten. */
const ABSCHNITT = 'vorher'
const ADJUTANT = 'M40 wie gebaut: Deckung angegriffener Nachbarprovinzen und Verfolgung (D30.4 bis 2026-09-13)'
const REPORT = `${ROOT}/docs/reports/stance.json`
const SCHREIBEN = process.env['WORLDWAR_WRITE_REPORT'] === '1'

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

/** Was ein Tick fuer die Zaehlung je Episode traegt. */
interface Frame {
  tick: number
  /** Die Provinzen des Menschen zu BEGINN dieses Ticks. */
  owned: readonly string[]
  events: readonly GameEvent[]
  /** Die Befehle, die in diesem Tick fuer den Menschen angewandt wurden — er selbst befiehlt nichts. */
  orders: readonly Command[]
}

interface EpisodenZahl {
  /** Umkaempfte Episoden in Provinzen, die zu Beginn der Episode dem Menschen gehoerten. */
  episodes: number
  /** Davon: waehrend der Episode ein Marschbefehl der Automatik in diese Provinz. */
  coverOrdered: number
  /** Davon: waehrend der Episode kam eine eigene Armee dort an. */
  coverArrivedInTime: number
  /** Davon: die Provinz gehoert dem Menschen nach der Episode noch. */
  held: number
  /** Summe der Provinzen des Menschen zu Beginn jedes Spieltags. */
  provinceDays: number
  provincesLost: number
  /** Davon im Tick der Eroberung ohne Gefecht in dieser Provinz. */
  lostWithoutBattle: number
  /** Befehle fuer den Menschen — alle von der Automatik. */
  adjutantOrders: number
  /** Eine Armee marschiert von A nach B und binnen fuenf Spieltagen zurueck. */
  pendulums: number
  rejectedCommands: number
  /** `WAR_DECLARED` ohne Erklaerung, ausgeloest vom Menschen. */
  undeclaredWarsByHuman: number
}

/** Die Zaehlung je Episode — aus nichts als den Frames und dem Besitz am Ende. */
function werteAus(
  frames: readonly Frame[],
  finalOwned: readonly string[],
  human: PlayerId,
  ticksPerDay: number,
): EpisodenZahl {
  const besitz = [...frames.map((frame) => new Set(frame.owned)), new Set(finalOwned)]
  /** Der Besitz zu Beginn des Frames `index`; hinter dem letzten Frame der Besitz am Ende. */
  const besitzBei = (index: number): ReadonlySet<string> => besitz[Math.min(index, frames.length)]!

  // Je Provinz die Frames mit einer Schlacht dort.
  const schlachten = new Map<string, Set<number>>()
  frames.forEach((frame, index) => {
    for (const event of frame.events) {
      if (event.type !== 'BATTLE_RESOLVED') continue
      const ticks = schlachten.get(event.provinceId) ?? new Set<number>()
      ticks.add(index)
      schlachten.set(event.provinceId, ticks)
    }
  })

  let episodes = 0
  let coverOrdered = 0
  let coverArrivedInTime = 0
  let held = 0
  for (const [provinceId, ticks] of schlachten) {
    const folge = [...ticks].sort((a, b) => a - b)
    let k = 0
    while (k < folge.length) {
      const start = folge[k]!
      let end = start + 1
      k += 1
      while (k < folge.length && folge[k] === end) {
        end += 1
        k += 1
      }
      if (!besitzBei(start).has(provinceId)) continue

      episodes += 1
      const waehrend = frames.slice(start, end)
      if (waehrend.some((frame) => frame.orders.some((order) => order.type === 'MOVE_ARMY' && order.targetProvinceId === provinceId))) {
        coverOrdered += 1
      }
      if (
        waehrend.some((frame) =>
          frame.events.some((event) => event.type === 'ARMY_ARRIVED' && event.playerId === human && event.provinceId === provinceId),
        )
      ) {
        coverArrivedInTime += 1
      }
      if (besitzBei(end).has(provinceId)) held += 1
    }
  }

  // Zu Beginn jedes Spieltags, wie im Entwurf gemessen: der erste Tag zaehlt mit, der Stand nach
  // dem letzten Tick nicht. Die Schwelle aus D30.9 steht auf dieser Zaehlweise.
  let provinceDays = 0
  for (let index = 0; index < frames.length; index += ticksPerDay) provinceDays += besitzBei(index).size

  let provincesLost = 0
  let lostWithoutBattle = 0
  let rejectedCommands = 0
  let undeclaredWarsByHuman = 0
  const aufbrueche: Extract<GameEvent, { type: 'ARMY_DEPARTED' }>[] = []
  frames.forEach((frame, index) => {
    for (const event of frame.events) {
      if (event.type === 'PROVINCE_CAPTURED' && event.previousOwner === human) {
        provincesLost += 1
        if (!schlachten.get(event.provinceId)?.has(index)) lostWithoutBattle += 1
      } else if (event.type === 'COMMAND_REJECTED' && event.playerId === human) {
        rejectedCommands += 1
      } else if (event.type === 'WAR_DECLARED' && event.playerId === human && event.withoutDeclaration) {
        undeclaredWarsByHuman += 1
      } else if (event.type === 'ARMY_DEPARTED' && event.playerId === human) {
        aufbrueche.push(event)
      }
    }
  })

  // Ein Pendelzug: dieselbe Armee bricht als Naechstes genau in die Gegenrichtung auf, binnen fuenf Tagen.
  let pendulums = 0
  const letzter = new Map<string, (typeof aufbrueche)[number]>()
  for (const aufbruch of aufbrueche) {
    const vorher = letzter.get(aufbruch.armyId)
    if (
      vorher &&
      vorher.fromProvinceId === aufbruch.toProvinceId &&
      vorher.toProvinceId === aufbruch.fromProvinceId &&
      aufbruch.tick - vorher.tick <= PENDULUM_DAYS * ticksPerDay
    ) {
      pendulums += 1
    }
    letzter.set(aufbruch.armyId, aufbruch)
  }

  return {
    episodes,
    coverOrdered,
    coverArrivedInTime,
    held,
    provinceDays,
    provincesLost,
    lostWithoutBattle,
    adjutantOrders: frames.reduce((total, frame) => total + frame.orders.length, 0),
    pendulums,
    rejectedCommands,
    undeclaredWarsByHuman,
  }
}

const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** Ein gebautes Ereignis: nur die Felder, die die Zaehlung liest. */
const ereignis = (fields: Record<string, unknown>): GameEvent =>
  ({ severity: 'info', audience: [], concerns: [], ...fields }) as unknown as GameEvent

describe('D30.6 Die Zaehlung des Haltungs-Messlaufs', () => {
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

describe('D30.6 Die Zaehlung je umkaempfter Episode (T-M40-07)', () => {
  /**
   * Zwoelf Ticks zu je vier Ticks am Tag. Der Mensch p1 besitzt P, Q und R; Q faellt im Gefecht
   * (Tick 6), R ohne Gefecht (Tick 8). P hat zwei Episoden: Ticks 2–4 (gedeckt und rechtzeitig)
   * und Tick 9 (ohne Deckung); die Schlacht in S an Tick 3 ist fremd.
   */
  function lage(): { frames: Frame[]; finalOwned: string[] } {
    const zug = (armyId: string, targetProvinceId: string): Command => ({ type: 'MOVE_ARMY', playerId: 'p1', armyId, targetProvinceId })
    const schlacht = (tick: number, provinceId: string) =>
      ereignis({ type: 'BATTLE_RESOLVED', tick, battleId: `b${tick}${provinceId}`, provinceId, losses: {}, victor: null })
    const besitz = (tick: number): string[] => (tick <= 6 ? ['P', 'Q', 'R'] : tick <= 8 ? ['P', 'R'] : ['P'])

    const events: Record<number, GameEvent[]> = {
      0: [ereignis({ type: 'ARMY_DEPARTED', tick: 0, playerId: 'p1', armyId: 'a2', fromProvinceId: 'X', toProvinceId: 'Y', arrivalTick: 1 })],
      1: [ereignis({ type: 'ARMY_DEPARTED', tick: 1, playerId: 'p1', armyId: 'a1', fromProvinceId: 'P', toProvinceId: 'Q', arrivalTick: 3 })],
      2: [
        schlacht(2, 'P'),
        // Weiter statt zurueck: kein Pendelzug.
        ereignis({ type: 'ARMY_DEPARTED', tick: 2, playerId: 'p1', armyId: 'a2', fromProvinceId: 'Y', toProvinceId: 'Z', arrivalTick: 3 }),
      ],
      3: [schlacht(3, 'P'), schlacht(3, 'S')],
      4: [schlacht(4, 'P'), ereignis({ type: 'ARMY_ARRIVED', tick: 4, playerId: 'p1', armyId: 'a3', provinceId: 'P' })],
      // Zurueck binnen fuenf Tagen (20 Ticks): ein Pendelzug.
      5: [ereignis({ type: 'ARMY_DEPARTED', tick: 5, playerId: 'p1', armyId: 'a1', fromProvinceId: 'Q', toProvinceId: 'P', arrivalTick: 7 })],
      6: [schlacht(6, 'Q'), ereignis({ type: 'PROVINCE_CAPTURED', tick: 6, provinceId: 'Q', previousOwner: 'p1', newOwner: 'p2' })],
      7: [
        ereignis({ type: 'COMMAND_REJECTED', tick: 7, playerId: 'p1', command: 'MOVE_ARMY', code: 'NO_PATH' }),
        ereignis({ type: 'COMMAND_REJECTED', tick: 7, playerId: 'p2', command: 'MOVE_ARMY', code: 'NO_PATH' }),
        // Eine Ankunft in P ausserhalb jeder Episode zaehlt nicht als rechtzeitig.
        ereignis({ type: 'ARMY_ARRIVED', tick: 7, playerId: 'p1', armyId: 'a1', provinceId: 'P' }),
      ],
      8: [ereignis({ type: 'PROVINCE_CAPTURED', tick: 8, provinceId: 'R', previousOwner: 'p1', newOwner: 'p2' })],
      9: [schlacht(9, 'P')],
      10: [
        ereignis({ type: 'WAR_DECLARED', tick: 10, playerId: 'p1', targetPlayerId: 'p3', effectiveAtTick: 10, withoutDeclaration: true }),
        // Wer den Menschen ueberfaellt, zaehlt nicht gegen ihn.
        ereignis({ type: 'WAR_DECLARED', tick: 10, playerId: 'p2', targetPlayerId: 'p1', effectiveAtTick: 10, withoutDeclaration: true }),
      ],
    }
    const orders: Record<number, Command[]> = { 1: [zug('a1', 'Q')], 2: [zug('a3', 'P')], 5: [zug('a1', 'P')] }

    const frames = Array.from({ length: 12 }, (_, tick) => ({
      tick,
      owned: besitz(tick),
      events: events[tick] ?? [],
      orders: orders[tick] ?? [],
    }))
    return { frames, finalOwned: ['P'] }
  }

  it('zaehlt Episoden, rechtzeitige Deckung, Halten, Verluste ohne Gefecht und Pendelzuege', () => {
    const { frames, finalOwned } = lage()

    expect(werteAus(frames, finalOwned, 'p1', 4)).toEqual({
      // P Ticks 2–4, Q Tick 6, P Tick 9; S gehoerte nie dem Menschen.
      episodes: 3,
      // Nur die erste Episode in P bekam waehrend ihrer Dauer einen Marschbefehl dorthin.
      coverOrdered: 1,
      // a3 kam an Tick 4 in P an, noch waehrend der Episode.
      coverArrivedInTime: 1,
      // Beide Episoden in P; Q ist nach Tick 6 fremd.
      held: 2,
      // Beginn Tag 1 (Tick 0): P, Q, R; Beginn Tag 2 (Tick 4): P, Q, R; Beginn Tag 3 (Tick 8): P, R.
      // Der Besitz nach dem letzten Tick (nur P) zaehlt nicht mehr.
      provinceDays: 8,
      provincesLost: 2,
      // R fiel an Tick 8 ohne Schlacht in R.
      lostWithoutBattle: 1,
      adjutantOrders: 3,
      pendulums: 1,
      rejectedCommands: 1,
      undeclaredWarsByHuman: 1,
    })
  })

  it('beginnt eine Episode nur in einer Provinz, die zu Beginn ihres ersten Ticks dem Menschen gehoert', () => {
    const { frames } = lage()
    // Dieselbe Schlacht in P, aber P gehoert zu Beginn von Tick 9 nicht mehr dem Menschen.
    const ohneP = frames.map((frame) => (frame.tick >= 9 ? { ...frame, owned: [] } : frame))

    const zahl = werteAus(ohneP, [], 'p1', 4)
    expect(zahl.episodes).toBe(2)
    expect(zahl.held).toBe(1)
  })
})

/** Deutschland mit `SETUPS[aufbau]` Armeen in jeder eigenen Provinz. */
function aufstellen(seed: number, aufbau: Aufbau, stance: Stance): { state: GameState; human: PlayerId } {
  const config = toConfig({ ...DEFAULT_NEW_GAME, nation: NATION, seed }, map)
  const state = createInitialState(config, { map, rules })
  const human = state.playerOrder.find((id) => state.players[id]!.kind === 'human')!
  expect(state.players[human]!.nation).toBe(NATION)

  const hp = UNITS_PER_ARMY * rules.units[UNIT_KEY]!.hpPerUnit
  for (const id of state.provinceOrder) {
    if (state.provinces[id]!.owner !== human) continue
    for (let n = 0; n < SETUPS[aufbau]; n++) {
      placeArmy(state, { owner: human, at: id, units: [{ unitKey: UNIT_KEY, hpTotal: hp }], stance })
    }
  }
  return { state, human }
}

/** Das Kartenfenster: ein Tick Verzug plus die laengste Marschzeit ueber eine eigene Binnengrenze. */
function kartenfenster(): number {
  const { state, human } = aufstellen(SEEDS[0], 'A', 'garrison')
  const probe = state.armies[state.armyOrder.find((id) => state.armies[id]!.owner === human)!]!
  let laengste = 0
  for (const from of state.provinceOrder) {
    if (state.provinces[from]!.owner !== human) continue
    for (const to of state.provinces[from]!.neighbors) {
      if (state.provinces[to]?.owner !== human) continue
      const edge = edgeBetween(map.edges, map.edgesByProvince[from], from, to)
      if (!edge || edge.kind !== 'land') continue
      const army: Army = { ...probe, locationProvinceId: from }
      laengste = Math.max(laengste, edgeTravelTicks(state, army, edge, from, to, rules))
    }
  }
  return 1 + laengste
}

/** Ein Ereignis, das die Zaehlung braucht — alles andere bleibt nicht im Speicher. */
function relevant(event: GameEvent, human: PlayerId, jeBesessen: ReadonlySet<string>): boolean {
  switch (event.type) {
    case 'BATTLE_RESOLVED':
    case 'PROVINCE_CAPTURED':
      return jeBesessen.has(event.provinceId)
    case 'ARMY_ARRIVED':
    case 'ARMY_DEPARTED':
    case 'ARMY_INTRUDED':
    case 'COMMAND_REJECTED':
      return event.playerId === human
    case 'WAR_DECLARED':
      return event.playerId === human || event.targetPlayerId === human
    default:
      return false
  }
}

interface Lauf extends EpisodenZahl, StanceCount {
  seed: number
  setup: Aufbau
  stance: Stance
  provincesAtEnd: number
  armiesAtEnd: number
  daysRun: number
}

/** Ein Lauf, Tick fuer Tick ueber `advanceTicks` — derselbe Weg wie in Haeppchen (R-UNIT-09/AK4). */
async function miss(seed: number, aufbau: Aufbau, stance: Stance, windowTicks: number): Promise<Lauf> {
  const aufgestellt = aufstellen(seed, aufbau, stance)
  const { human } = aufgestellt
  const ticksPerDay = rules.constants.ticksPerDay
  const frames: Frame[] = []
  const jeBesessen = new Set<string>()
  let current = aufgestellt.state

  for (let tick = 0; tick < DAYS * ticksPerDay; tick++) {
    if (current.victory.winner !== null) break
    const owned = current.provinceOrder.filter((id) => current.provinces[id]!.owner === human)
    for (const id of owned) jeBesessen.add(id)

    const schritt = advanceTicks(current, 1, { map, rules })
    frames.push({
      tick: current.tick,
      owned,
      events: schritt.events.filter((event) => relevant(event, human, jeBesessen)),
      orders: schritt.applied.filter((entry) => entry.command.playerId === human).map((entry) => entry.command),
    })
    current = schritt.state
    if ((tick + 1) % ticksPerDay === 0) await breathe()
  }

  const finalOwned = current.provinceOrder.filter((id) => current.provinces[id]!.owner === human)
  return {
    seed,
    setup: aufbau,
    stance,
    ...zaehle(
      frames.flatMap((frame) => frame.events),
      human,
      windowTicks,
    ),
    ...werteAus(frames, finalOwned, human, ticksPerDay),
    provincesAtEnd: finalOwned.length,
    armiesAtEnd: current.armyOrder.filter((id) => current.armies[id]!.owner === human).length,
    daysRun: Math.floor(current.tick / ticksPerDay),
  }
}

const finde = (laeufe: readonly Lauf[], seed: number, setup: Aufbau, stance: Stance): Lauf => {
  const lauf = laeufe.find((kandidat) => kandidat.seed === seed && kandidat.setup === setup && kandidat.stance === stance)
  if (!lauf) throw new Error(`Lauf ${seed} ${setup} ${stance} fehlt`)
  return lauf
}

/** AK5 als Zahlen, ohne zu werfen — fuer den Bericht und fuer die Zusicherung. */
function ak5(laeufe: readonly Lauf[]) {
  const paare = SEEDS.flatMap((seed) =>
    (Object.keys(SETUPS) as Aufbau[]).map((setup) => ({
      seed,
      setup,
      garrison: finde(laeufe, seed, setup, 'garrison'),
      defensive: finde(laeufe, seed, setup, 'defensive'),
    })),
  )
  const summe = (stance: (typeof STANCES)[number], feld: 'provinceDays' | 'lostWithoutBattle') =>
    paare.reduce((total, paar) => total + paar[stance][feld], 0)
  const provinceDays = { garrison: summe('garrison', 'provinceDays'), defensive: summe('defensive', 'provinceDays') }
  const verletzt: string[] = []
  if (provinceDays.defensive * 100 < provinceDays.garrison * PROVINCE_DAYS_PERCENT) {
    verletzt.push(`Provinz-Tage ${provinceDays.defensive} von ${provinceDays.garrison} (unter ${PROVINCE_DAYS_PERCENT} %)`)
  }
  for (const paar of paare) {
    if (paar.defensive.lostWithoutBattle > paar.garrison.lostWithoutBattle) {
      verletzt.push(
        `${paar.seed} ${paar.setup}: ${paar.defensive.lostWithoutBattle} ohne Gefecht verloren gegen ${paar.garrison.lostWithoutBattle} mit Garnison`,
      )
    }
  }
  for (const lauf of laeufe) {
    if (lauf.rejectedCommands > 0) verletzt.push(`${lauf.seed} ${lauf.setup} ${lauf.stance}: ${lauf.rejectedCommands} abgelehnt`)
    if (lauf.undeclaredWarsByHuman > 0) {
      verletzt.push(`${lauf.seed} ${lauf.setup} ${lauf.stance}: ${lauf.undeclaredWarsByHuman} Kriege ohne Erklaerung`)
    }
  }
  return {
    provinceDays: { ...provinceDays, percent: Math.round((1000 * provinceDays.defensive) / provinceDays.garrison) / 10 },
    lostWithoutBattle: { garrison: summe('garrison', 'lostWithoutBattle'), defensive: summe('defensive', 'lostWithoutBattle') },
    erfuellt: verletzt.length === 0,
    verletzt,
  }
}

/** Schreibt `episoden[ABSCHNITT]` in den Bericht und laesst alles andere stehen. */
function schreibeBericht(laeufe: readonly Lauf[], windowTicks: number): void {
  const bericht = JSON.parse(readFileSync(REPORT, 'utf8')) as Record<string, unknown> & { episoden?: Record<string, unknown> }
  const episoden = {
    ...(bericht.episoden ?? {}),
    tasks: 'T-M40-07 (vorher, heutiger Adjutant), T-M40-12 (nachher, neue D30.4)',
    seeds: [...SEEDS],
    days: DAYS,
    setups: { A: 'eine Armee aus 5 Infanterie je Provinz', B: 'zwei Armeen aus je 5 Infanterie je Provinz' },
    counting: {
      source: 'Ereignisstrom von advanceTicks, Tick fuer Tick, nicht state.eventLog',
      provinceDays: 'Provinzen des Menschen zu Beginn jedes Spieltags, summiert (Zaehlweise des Entwurfs)',
      episode:
        'groesste zusammenhaengende Folge von Ticks mit BATTLE_RESOLVED in einer Provinz, die zu Beginn ihres ersten Ticks dem Menschen gehoerte; endet im ersten Tick ohne Gefecht dort',
      lostWithoutBattle: 'PROVINCE_CAPTURED aus dem Besitz des Menschen ohne BATTLE_RESOLVED in dieser Provinz im selben Tick',
      pendulum: `eine Armee marschiert von A nach B und binnen ${PENDULUM_DAYS} Spieltagen zurueck`,
      windowTicks,
      ak5: `Provinz-Tage defensive >= ${PROVINCE_DAYS_PERCENT} % garrison ueber alle sechs Paare; je Paar lostWithoutBattle defensive <= garrison; 0 abgelehnt; 0 Kriege ohne Erklaerung; Garnison A 1914 = vorher (52 Einmaersche, 4 verloren)`,
    },
    [ABSCHNITT]: {
      adjutant: ADJUTANT,
      stand: STAND,
      measuredAt: new Date().toISOString(),
      ak5: ak5(laeufe),
      laeufe,
    },
  }
  writeFileSync(REPORT, `${JSON.stringify({ ...bericht, episoden }, null, 2)}\n`)
}

describe('R-UNIT-09/AK5 Der Haltungs-Messlauf je Episode', () => {
  const windowTicks = kartenfenster()
  const laeufe: Lauf[] = []

  for (const seed of SEEDS) {
    it(`faehrt Startzahl ${seed}: Aufstellung A und B, Garnison und Verteidigung`, async () => {
      for (const setup of Object.keys(SETUPS) as Aufbau[]) {
        for (const stance of STANCES) {
          const started = Date.now()
          const lauf = await miss(seed, setup, stance, windowTicks)
          laeufe.push(lauf)
          console.log(
            `${seed} ${setup} ${stance}: ${Math.round((Date.now() - started) / 1000)} s, PT ${lauf.provinceDays}, verloren ${lauf.provincesLost} (ohne Gefecht ${lauf.lostWithoutBattle}), Befehle ${lauf.adjutantOrders}, Episoden ${lauf.episodes} (befohlen ${lauf.coverOrdered}, rechtzeitig ${lauf.coverArrivedInTime}, gehalten ${lauf.held}), Pendel ${lauf.pendulums}, Ende ${lauf.provincesAtEnd}/${lauf.armiesAtEnd}`,
          )
          await breathe()
        }
      }
      expect(laeufe.filter((lauf) => lauf.seed === seed)).toHaveLength(4)
    }, 1_800_000)
  }

  it('hat alle zwoelf Laeufe, und die Garnison A 1914 bildet den Lauf vorher nach', () => {
    // Der Bericht wird vor den Zusicherungen geschrieben: eine gescheiterte Messung ist die, die
    // man am dringendsten lesen will. Nur auf Wunsch (Befund N3).
    if (SCHREIBEN && laeufe.length === 12) schreibeBericht(laeufe, windowTicks)

    expect(laeufe.length, 'nicht alle zwoelf Laeufe gefahren - der Messlauf misst nur als Ganzes').toBe(12)
    expect(windowTicks, 'das Kartenfenster hat sich seit T-M40-02 verschoben').toBe(WINDOW_TICKS_T_M40_02)
    const garnison = finde(laeufe, 1914, 'A', 'garrison')
    expect(
      { intrusions: garnison.intrusions, provincesLost: garnison.provincesLost },
      'die Garnison bildet den Lauf vorher nicht nach - etwas anderes hat sich verschoben',
    ).toEqual(VORHER)
  })

  // T-M40-07 mass den Adjutanten aus M40: 3301 von 4140 Provinz-Tagen (79,7 %), 10 Verluste ohne
  // Gefecht gegen 0 mit Garnison — das stand hier als it.fails. Seit T-M40-10 gilt die Regel aus D30.4.
  // Faellt diese Zusicherung, wird die Regel zurueckgenommen, nicht nachgeschaerft (D30.9).
  it('R-UNIT-09/AK5: Verteidigung haelt mindestens 98 % der Provinz-Tage und entbloesst keine Provinz', () => {
    const ergebnis = ak5(laeufe)
    expect(ergebnis.verletzt, JSON.stringify(ergebnis)).toEqual([])
  })
})
