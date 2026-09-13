import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import {
  armyRange,
  createInitialState,
  parseRules,
  type Command,
  type GameConfig,
  type GameEvent,
  type GameState,
  type MapData,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_NEW_GAME, toConfig } from '../../desktop/src/game/newGame'

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
 *
 * **Zweiter Lauf seit T-M41-08:** T-M14-11 und T-M14-12 sagten einen Lauf über 90 Spieltage
 * mit der **ausgelieferten Voreinstellung** zu, und den gab es nie (`PROBLEME.md`,
 * 2026-09-13). Er steht jetzt hier, neben dem 200-Tage-Lauf und mit denselben Zählungen.
 * Beide Läufe gehen **tageweise** durch `advanceTicks` — dieselbe Partie wie ein einziger
 * Aufruf (`loop.test.ts` belegt den Gleichstand), aber mit einer Stichprobe je Spieltag für
 * die Hauptstadt und die Armeeobjekte je Provinz.
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
/** Die zugesagte Länge aus T-M14-11 und T-M14-12. */
const PRESET_DAYS = 90

/** Gibt die Ereignisschleife frei — ein langer synchroner Lauf tötet sonst den Worker (WORKFLOW §4). */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function integrationConfig(): GameConfig {
  return {
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
  }
}

interface Messung {
  tage: number
  events: GameEvent[]
  final: GameState
  /** Die KI-Mächte der Partie, auch die, die unterwegs ausscheiden. */
  ki: Set<string>
  /** Jeder angewandte Befehl einer KI-Macht (`advanceTicks(...).applied`) — der Nenner der Quote. */
  kiBefehle: Command[]
  /** Spieltage, an deren Ende eine KI-Macht eine Stadt hielt und keine Hauptstadt hatte. */
  hauptstadtTage: Record<string, number>
  hauptstadtStrecke: Record<string, number>
  /** Armeeobjekte einer Macht in derselben Provinz, am Ende jedes Spieltags. */
  armeeobjekte: { hoechstens: number; tageUeberDrei: number; stehendHoechstens: number; stehendTageUeberDrei: number }
}

async function spiele(config: GameConfig, tage: number): Promise<Messung> {
  let current = createInitialState(config, { map, rules })
  const ki = new Set(current.playerOrder.filter((id) => current.players[id]!.kind === 'ai'))
  const nation = (id: string): string => current.players[id]!.nation

  const events: GameEvent[] = []
  const kiBefehle: Command[] = []
  const hauptstadtTage: Record<string, number> = {}
  const hauptstadtStrecke: Record<string, number> = {}
  const laufend: Record<string, number> = {}
  for (const id of ki) {
    hauptstadtTage[nation(id)] = 0
    hauptstadtStrecke[nation(id)] = 0
  }
  const armeeobjekte = { hoechstens: 0, tageUeberDrei: 0, stehendHoechstens: 0, stehendTageUeberDrei: 0 }
  let gelaufen = 0

  for (let tag = 0; tag < tage; tag++) {
    const chunk = advanceTicks(current, rules.constants.ticksPerDay, { map, rules })
    current = chunk.state
    events.push(...chunk.events)
    for (const { command } of chunk.applied) if (ki.has(command.playerId)) kiBefehle.push(command)
    gelaufen = tag + 1

    const state = current
    for (const id of ki) {
      const player = state.players[id]!
      const haeltStadt = state.provinceOrder.some(
        (provinceId) => state.provinces[provinceId]!.owner === id && state.provinces[provinceId]!.kind === 'city',
      )
      const name = nation(id)
      if (haeltStadt && player.capitalProvinceId === null) {
        hauptstadtTage[name] = hauptstadtTage[name]! + 1
        laufend[name] = (laufend[name] ?? 0) + 1
        hauptstadtStrecke[name] = Math.max(hauptstadtStrecke[name]!, laufend[name]!)
      } else {
        laufend[name] = 0
      }
    }

    const alle = new Map<string, number>()
    const stehend = new Map<string, number>()
    for (const armyId of state.armyOrder) {
      const army = state.armies[armyId]!
      if (!ki.has(army.owner)) continue
      const key = `${army.owner}|${army.locationProvinceId}`
      alle.set(key, (alle.get(key) ?? 0) + 1)
      if (army.path.length === 0) stehend.set(key, (stehend.get(key) ?? 0) + 1)
    }
    const heuteAlle = Math.max(0, ...alle.values())
    const heuteStehend = Math.max(0, ...stehend.values())
    armeeobjekte.hoechstens = Math.max(armeeobjekte.hoechstens, heuteAlle)
    armeeobjekte.stehendHoechstens = Math.max(armeeobjekte.stehendHoechstens, heuteStehend)
    if (heuteAlle > 3) armeeobjekte.tageUeberDrei += 1
    if (heuteStehend > 3) armeeobjekte.stehendTageUeberDrei += 1

    if (current.victory.winner !== null) break
    await breathe()
  }

  return { tage: gelaufen, events, final: current, ki, kiBefehle, hauptstadtTage, hauptstadtStrecke, armeeobjekte }
}

type Rejected = Extract<GameEvent, { type: 'COMMAND_REJECTED' }>

const zaehle = <T>(items: readonly T[], key: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((acc, item) => {
    const k = key(item)
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

const prozent = (teil: number, ganz: number): number => (ganz === 0 ? 0 : Math.round((10_000 * teil) / ganz) / 100)

/** Alle Zahlen eines Laufs — dieselben für beide Aufstellungen. */
function kennzahlen(m: Messung) {
  const { events, final, ki } = m
  const nation = (id: string): string => final.players[id]!.nation
  const typ = (type: GameEvent['type']): GameEvent[] => events.filter((event) => event.type === type)
  const abgelehnt = events.filter((event): event is Rejected => event.type === 'COMMAND_REJECTED' && ki.has(event.playerId))

  const marsch = m.kiBefehle.filter((command) => command.type === 'MOVE_ARMY').length
  const noPath = abgelehnt.filter((event) => event.command === 'MOVE_ARMY' && event.code === 'NO_PATH').length

  // Die Paarung nach dem Wortlaut von T-M14-11: (Armee, Fehlercode).
  const paarungArmee = zaehle(
    abgelehnt.filter((event) => event.detail?.['armyId'] !== undefined),
    (event) => `${event.detail!['armyId']}|${event.code}`,
  )
  // Und nach seiner Absicht — „derselbe unmögliche Befehl bis zum Partieende" —, die auch
  // einen Bauauftrag in dieselbe Provinz trifft: (Macht, Befehl, Fehlercode, Einzelheiten).
  const paarungErweitert = zaehle(
    abgelehnt,
    (event) => `${nation(event.playerId)}|${event.command}|${event.code}|${JSON.stringify(event.detail ?? {})}`,
  )
  const erweitert = Object.entries(paarungErweitert).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'))

  const truce = events.filter(
    (event): event is Extract<GameEvent, { type: 'DIPLOMACY_CHANGED' }> =>
      event.type === 'DIPLOMACY_CHANGED' && event.newState === 'truce',
  )
  const handel = events.filter(
    (event): event is Extract<GameEvent, { type: 'TRADE_EXECUTED' }> => event.type === 'TRADE_EXECUTED',
  )

  const haeltStadt = (id: string): boolean =>
    final.provinceOrder.some(
      (provinceId) => final.provinces[provinceId]!.owner === id && final.provinces[provinceId]!.kind === 'city',
    )

  return {
    spieltage: m.tage,
    maechte: ki.size,
    ereignisse: events.length,
    kriegserklaerungen: typ('WAR_DECLARED').length,
    friedensschluesse: truce.length,
    friedenZwischenKi: truce.filter((event) => ki.has(event.playerId) && ki.has(event.targetPlayerId)).length,
    handel: handel.length,
    handelJeMacht: Object.fromEntries(
      [...ki].map((id) => [nation(id), handel.filter((event) => event.playerId === id).length]),
    ),
    fabriken: events.filter((event) => event.type === 'BUILD_STARTED' && event.building === 'factory').length,
    artillerie: events.filter((event) => event.type === 'UNIT_RECRUITED' && event.unitKey === 'artillery').length,
    beschussSelbsttaetig: events.filter((event) => event.type === 'BOMBARDMENT' && event.automatic).length,
    befehle: m.kiBefehle.length,
    abgelehnt: abgelehnt.length,
    ablehnungsquoteProzent: prozent(abgelehnt.length, m.kiBefehle.length),
    abgelehntZuFrueh: abgelehnt.filter((event) => event.code === 'NOT_YET_AVAILABLE').length,
    marschbefehle: marsch,
    noPath,
    noPathAnteilProzent: prozent(noPath, marsch),
    paarungArmeeFehlercodeHoechstens: Math.max(0, ...Object.values(paarungArmee)),
    paarungErweitertHoechstens: erweitert[0]?.[1] ?? 0,
    paarungenErweitertUeberDrei: erweitert.filter(([, n]) => n > 3).length,
    paarungenErweitertHaeufigste: Object.fromEntries(erweitert.slice(0, 5)),
    friedensannahmen: m.kiBefehle.filter((command) => command.type === 'DIPLOMACY' && command.action === 'acceptPeace')
      .length,
    diplomatieAbgelehnt: abgelehnt.filter((event) => event.command === 'DIPLOMACY').length,
    hauptstadt: {
      ohneHauptstadtMitStadtAmEnde: [...ki]
        .filter((id) => haeltStadt(id) && final.players[id]!.capitalProvinceId === null)
        .map(nation),
      tageOhne: m.hauptstadtTage,
      laengsteStrecke: m.hauptstadtStrecke,
    },
    armeeobjekteJeProvinz: m.armeeobjekte,
    armeenMitReichweiteJeMacht: Object.fromEntries(
      [...ki].map((id) => [
        nation(id),
        final.armyOrder.filter((armyId) => final.armies[armyId]!.owner === id && armyRange(final.armies[armyId]!, rules) > 0)
          .length,
      ]),
    ),
    ausgeschieden: [...ki].filter((id) => !final.players[id]!.alive).map(nation),
    // Je Stufe nach dem **Handelnden** (T-M41-08): T-M15-08 versprach "neun Zahlen je Stufe"
    // im Turnier, wo es auf der Testkarte in 40 Tagen keinen Beschuss gibt. Hier, auf der
    // Weltkarte, stehen die Stufen reihum nebeneinander — eine Zahl, keine Zusicherung.
    jeStufe: Object.fromEntries(
      (['easy', 'normal', 'hard'] as const).map((stufe) => {
        const ids = new Set([...ki].filter((id) => final.players[id]!.difficulty === stufe))
        const von = (event: GameEvent): boolean => 'playerId' in event && ids.has(event.playerId as string)
        return [
          stufe,
          {
            maechte: ids.size,
            kriegserklaerungen: events.filter((event) => event.type === 'WAR_DECLARED' && von(event)).length,
            artillerie: events.filter(
              (event) => event.type === 'UNIT_RECRUITED' && event.unitKey === 'artillery' && von(event),
            ).length,
            beschussSelbsttaetig: events.filter(
              (event) => event.type === 'BOMBARDMENT' && event.automatic && von(event),
            ).length,
            handel: handel.filter((event) => ids.has(event.playerId)).length,
          },
        ]
      }),
    ),
    rekrutiert: events.reduce<Record<string, number>>((acc, event) => {
      if (event.type === 'UNIT_RECRUITED') acc[event.unitKey] = (acc[event.unitKey] ?? 0) + event.count
      return acc
    }, {}),
    ablehnungen: zaehle(abgelehnt, (event) => `${event.command}:${event.code}`),
    /**
     * Die Prüfsumme des Endzustands ohne Protokoll und ohne KI-Gedächtnis. Eine Änderung, die
     * nur Rauschen aus dem Protokoll nimmt, lässt sie stehen — daran ist T-M41-08 gemessen.
     */
    zustandOhneKi: hashValue({ ...final, ai: null }, { omitKeys: ['eventLog'] }),
  }
}

let integration: Messung
let voreinstellung: Messung

beforeAll(async () => {
  integration = await spiele(integrationConfig(), DAYS)
  await breathe()
  voreinstellung = await spiele(toConfig(DEFAULT_NEW_GAME, map), PRESET_DAYS)
}, 1_800_000)

const rejected = (m: Messung, code: string, command?: string): GameEvent[] =>
  m.events.filter(
    (event) => event.type === 'COMMAND_REJECTED' && event.code === code && (!command || event.command === command),
  )

describe('R-AI-08/AK3 Die KI erzeugt keine Befehle, die der Kern verwirft', () => {
  it('hat ueberhaupt etwas gemessen', () => {
    // Die Zusicherung vor allen anderen. Eine Zaehlung ueber einer leeren Menge ist immer
    // null, und daran sind in diesem Projekt schon drei Waechter gescheitert.
    const events = integration.events
    expect(events.length, 'der Lauf hat nichts gemessen').toBeGreaterThan(1000)
    expect(events.some((event) => event.type === 'BUILD_STARTED')).toBe(true)
    expect(events.some((event) => event.type === 'UNIT_RECRUITED')).toBe(true)
  })

  it('erzeugt keinen Befehl vor dem Freischaltungstag', () => {
    expect(rejected(integration, 'NOT_YET_AVAILABLE').length).toBe(0)
  })

  it('wirft keine diplomatischen Befehle ins Blaue', () => {
    // Vorher: rund 99 % von 408 abgewiesen, weil die Sicht die eingehenden Angebote nicht
    // fuehrte (T-M14-12, Befund 41).
    expect(rejected(integration, 'INVALID_TARGET', 'DIPLOMACY').length).toBe(0)
  })

  it('bleibt zahlungsfaehig', () => {
    // Eine KI, die kein Geld mehr hat, trifft keine Entscheidungen mehr — sie erleidet
    // nur noch. Das ist die erste Haelfte von AK3.
    const pleite = integration.events.filter((event) => event.type === 'RESOURCE_SHORTAGE' && event.resource === 'money')
    expect(pleite.length, `Geldmangel bei ${new Set(pleite.map((e) => e.type === 'RESOURCE_SHORTAGE' && e.playerId)).size} Maechten`).toBe(0)
  })

  it('befiehlt keine Armee, die sie im selben Zug zusammengelegt hat (T-M41-08)', () => {
    // Befund der Untersuchung zu T-M41-08: 961 von 1177 Ablehnungen in diesem Lauf waren
    // MOVE_ARMY und SET_STANCE an Armeen, die dieselbe Macht im selben Tick unmittelbar vorher
    // per MERGE_ARMIES aufgeloest hatte — Operativ- und Taktikstufe lasen dieselbe Sicht. Kein
    // verlorener Zug (die Ueberlebende marschierte), aber Rauschen, das jede andere Ablehnung
    // verdeckt.
    expect(rejected(integration, 'ARMY_NOT_FOUND', 'MOVE_ARMY').length).toBe(0)
    expect(rejected(integration, 'ARMY_NOT_FOUND', 'SET_STANCE').length).toBe(0)
  })
})

describe('R-AI-08/AK3 Die in M15 gebauten Mittel leben', () => {
  it('schreibt den Bericht — und laesst die Nullen stehen, wo welche sind', () => {
    const zahlen = {
      gemessenAm: new Date().toISOString().slice(0, 10),
      ...kennzahlen(integration),
      voreinstellung90: { startzahl: DEFAULT_NEW_GAME.seed, ...kennzahlen(voreinstellung) },
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
    const events = integration.events
    const fabriken = events.filter((event) => event.type === 'BUILD_STARTED' && event.building === 'factory')
    const artillerie = events.filter((event) => event.type === 'UNIT_RECRUITED' && event.unitKey === 'artillery')
    const beschuss = events.filter((event) => event.type === 'BOMBARDMENT' && event.automatic)

    expect(fabriken.length, 'keine einzige Fabrik in 200 Spieltagen').toBeGreaterThan(0)
    expect(artillerie.length, 'keine Artillerie — die Feuerautomatik hat nichts zu tun').toBeGreaterThan(0)
    expect(beschuss.length, 'kein selbsttaetiger Beschuss').toBeGreaterThan(0)
  })
})

/**
 * Die Zusagen von T-M14-11 und T-M14-12, eingelöst mit dem Lauf, den sie versprachen
 * (T-M41-08): 90 Spieltage, Weltkarte, die ausgelieferte Voreinstellung.
 *
 * Zwei Zusagen stehen hier bewusst **nicht** als Zusicherung, nur als Zahl im Bericht:
 * `armyRange > 0` je KI-Macht (zurückgenommen, `DECISIONS.md` 2026-09-13 — R-BAT-08/AK3 ist
 * bedingt und in `decide.test.ts` gebucht; die Artillerie im Spiel sichert der Lauf oben)
 * und „höchstens drei Armeeobjekte je Provinz" (neu gefasst in T-M41-10).
 */
describe('T-M14-11 und T-M14-12 · 90 Tage mit der ausgelieferten Voreinstellung (T-M41-08)', () => {
  const zahlen = () => kennzahlen(voreinstellung)

  it('hat ueberhaupt etwas gemessen', () => {
    const z = zahlen()
    expect(z.spieltage, 'die Partie endete vor dem 90. Spieltag').toBe(PRESET_DAYS)
    expect(z.maechte, 'die Voreinstellung hat weniger als vier KI-Gegner').toBeGreaterThanOrEqual(4)
    expect(z.ereignisse).toBeGreaterThan(1000)
    expect(z.befehle, 'die KI hat keinen Befehl gegeben').toBeGreaterThan(1000)
    expect(z.marschbefehle, 'kein einziger Marschbefehl').toBeGreaterThan(0)
  })

  it('befiehlt keine Armee, die sie im selben Zug zusammengelegt hat', () => {
    expect(rejected(voreinstellung, 'ARMY_NOT_FOUND', 'MOVE_ARMY').length).toBe(0)
    expect(rejected(voreinstellung, 'ARMY_NOT_FOUND', 'SET_STANCE').length).toBe(0)
  })

  it('laesst weniger als ein Zehntel ihrer Befehle ablehnen (T-M14-11, vorher 57 %)', () => {
    expect(zahlen().ablehnungsquoteProzent).toBeLessThan(10)
  })

  it('schickt weniger als 2 % ihrer Marschbefehle ins Unerreichbare (T-M14-11, vorher 68 %)', () => {
    expect(zahlen().noPathAnteilProzent).toBeLessThan(2)
  })

  it('wiederholt keine Paarung aus Armee und Fehlercode oefter als dreimal (T-M14-11)', () => {
    expect(zahlen().paarungArmeeFehlercodeHoechstens).toBeLessThanOrEqual(3)
  })

  it('erklaert mindestens einen Krieg (T-M14-11, vorher 0 in 1000 Tagen)', () => {
    expect(zahlen().kriegserklaerungen).toBeGreaterThanOrEqual(1)
  })

  it('laesst keine KI-Macht ohne Hauptstadt enden, solange sie eine Stadt haelt (T-M14-12)', () => {
    expect(zahlen().hauptstadt.ohneHauptstadtMitStadtAmEnde).toEqual([])
  })

  it('handelt mit jeder KI-Macht mindestens einmal (T-M14-12)', () => {
    const jeMacht = zahlen().handelJeMacht
    expect(Object.keys(jeMacht).length).toBe(zahlen().maechte)
    expect(Object.entries(jeMacht).filter(([, n]) => n < 1)).toEqual([])
  })

  it('wirft keine Friedensannahme ins Blaue (T-M14-12, vorher rund 99 %)', () => {
    // Strenger als „unter 5 % der Friedensannahmen": keine einzige diplomatische Ablehnung.
    // Das Ereignis traegt die Art der Diplomatie nicht; eine abgewiesene Annahme waere eine davon.
    expect(zahlen().diplomatieAbgelehnt).toBe(0)
  })

  it('schliesst mindestens einen Frieden zwischen zwei KI-Maechten (T-M14-12)', () => {
    expect(zahlen().friedenZwischenKi).toBeGreaterThanOrEqual(1)
  })
})

/**
 * Die KI baut nicht, was ihr nicht mehr gehört (T-M41-09).
 *
 * Befund der Untersuchung zu T-M41-08: jedes `BUILD:NOT_OWNER` auf der Weltkarte zielte auf eine
 * Provinz, die die Sicht nur noch aus der Erinnerung als eigene führte — eine davon 94× in 200
 * Tagen. Die Absicht von T-M14-11 („derselbe unmögliche Befehl bis zum Partieende") trifft genau das,
 * sein Wortlaut (Armee, Fehlercode) sah es nicht. Zugesichert wird hier der Bauauftrag; der
 * erweiterte Schlüssel über **alle** Befehle wartet auf T-M41-11 — nach der Reparatur zu H1 wiederholt
 * sich `SET_CAPITAL:ON_COOLDOWN` bis zu 29× mit derselben Sperre.
 */
describe('T-M41-09 Die KI baut nicht in Provinzen, die sie nur erinnert', () => {
  /** Wie oft sich derselbe abgelehnte Bauauftrag wiederholt: (Macht, Fehlercode, Einzelheiten). */
  const bauauftragHoechstens = (m: Messung): number => {
    const zaehler = zaehle(
      m.events.filter(
        (event): event is Rejected =>
          event.type === 'COMMAND_REJECTED' && event.command === 'BUILD' && m.ki.has(event.playerId),
      ),
      (event) => `${event.playerId}|${event.code}|${JSON.stringify(event.detail ?? {})}`,
    )
    return Math.max(0, ...Object.values(zaehler))
  }

  it('bekommt auf der Weltkarte kein BUILD:NOT_OWNER', () => {
    expect(rejected(integration, 'NOT_OWNER', 'BUILD').length).toBe(0)
  })

  it('wiederholt keinen abgelehnten Bauauftrag oefter als dreimal, in beiden Laeufen', () => {
    expect(bauauftragHoechstens(integration), 'Weltkarte, 200 Tage').toBeLessThanOrEqual(3)
    expect(bauauftragHoechstens(voreinstellung), 'Voreinstellung, 90 Tage').toBeLessThanOrEqual(3)
  })
})
