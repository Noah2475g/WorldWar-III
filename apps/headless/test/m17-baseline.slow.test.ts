import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import {
  RESOURCE_KEYS,
  createInitialState,
  economyOverview,
  parseRules,
  type Command,
  type GameConfig,
  type GameEvent,
  type GameState,
  type MapData,
} from '@worldwar/core'
import { hashValue } from '@worldwar/shared'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * Der Ausgangswert von M17 (T-M17-02, D29.7, D29.12).
 *
 * Erst messen, dann aendern: dieser Lauf haelt fest, wie die Partie **vor** Spionage,
 * Handelsangeboten und gerichtetem Durchmarsch aussieht. T-M17-16 faehrt dieselbe Partie
 * danach und legt die Zahlen daneben.
 *
 * **Die Partie** ist dieselbe wie im Integrationstor (`ai-integration.slow.test.ts`):
 * Weltkarte, acht KI-Maechte, Startzahl 1815, Stufen reihum, 200 Spieltage. Das ist Absicht —
 * `zustandOhneKi` ist dieselbe Pruefsumme wie dort, und **auf demselben Commit gemessen**
 * muessen beide gleich sein: eine zweite Messung mit einem zweiten Werkzeug (tageweise dort,
 * Tick fuer Tick hier). Gegengeprueft am 2026-09-18 auf `8bda869`: beide Laeufe melden
 * `10950ec5abffd9b7`, 29987 Ereignisse, 16650 KI-Befehle, 3 Ablehnungen. Der **eingecheckte**
 * `docs/reports/ai-integration.json` nennt `e7b0627bff9f7b39` — er stammt vom 2026-09-13
 * (`fcf43cd`), vor M35 und den Nacharbeiten zu M40, und ist kein Vergleichswert mehr
 * (`PROBLEME.md`, 2026-09-18).
 *
 * **Der Sold-Anker (D29.7).** „Median des taeglichen Geldertrags einer mittleren Macht an
 * Tag 30" heisst hier genau:
 *
 *  - *taeglicher Geldertrag* = `economyOverview(state, id, rules).money.production` — der
 *    Bruttoertrag je Spieltag aus derselben Funktion, mit der die Produktionsphase rechnet
 *    (`provinceYieldScaled`), **vor** Armeeunterhalt, in Festkomma wie alle Bestaende
 *    (1000 = 1 Geld; der Anker 10153 sind also 10,153 Geld je Spieltag). Brutto, weil der
 *    Sold eine Ausgabe neben dem Unterhalt ist und nicht von der Heeresgroesse einer Macht
 *    abhaengen soll; der Nettowert steht zum Vergleich daneben.
 *  - *an Tag 30* = am Ende des 30. Spieltags (Tick 720).
 *  - *einer mittleren Macht* = der Median ueber die an diesem Tag lebenden Maechte der
 *    Partie. Bei gerader Zahl der abgerundete Mittelwert der beiden mittleren Werte.
 *
 * Zwei kurze Nebenlaeufe (30 Tage, andere Startzahlen) zeigen die Streuung des Ankers — sie
 * aendern den Anker nicht, sie sagen nur, wie fest er steht.
 *
 * **Durchmarsch und Kartenfreigabe** erzeugen kein Ereignis (`commands/diplomacy.ts`);
 * gezaehlt werden deshalb die **angewandten Befehle** und der **Zustand** am Ende jedes
 * Spieltags. Der Zustand wird als JSON gelesen und nicht ueber die Feldnamen des Typs: die
 * Felder heissen bis Stufe 3 `rightOfWay`/`sharedMap` und ab Stufe 4 `aGrantsPassage` … —
 * dieser Lauf soll vor und nach T-M17-03 dieselbe Frage beantworten.
 *
 * Der Bericht `docs/reports/m17-baseline.json` wird nur mit `WORLDWAR_WRITE_REPORT=1`
 * geschrieben (Muster `stance.slow.test.ts`).
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
const ANCHOR_DAY = 30
const SEED = 1815
/** Nur fuer die Streuung des Ankers — 30 Spieltage, sonst dieselbe Aufstellung. */
const SPREAD_SEEDS = [1914, 2015]
const SCHREIBEN = process.env['WORLDWAR_WRITE_REPORT'] === '1'

/** Gibt die Ereignisschleife frei — ein langer synchroner Lauf toetet sonst den Worker (WORKFLOW §4). */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function baselineConfig(seed: number): GameConfig {
  return {
    seed,
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

/** Der Median; bei gerader Anzahl der abgerundete Mittelwert der beiden mittleren Werte. */
function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.floor((sorted[mid - 1]! + sorted[mid]!) / 2)
}

interface Anker {
  startzahl: number
  spieltag: number
  tick: number
  lebendeMaechte: number
  /** Bruttoertrag Geld je Spieltag, je Macht. */
  geldertragJeMacht: Record<string, number>
  /** Nettowert (Ertrag minus Armeeunterhalt) — nur zum Vergleich. */
  geldbilanzJeMacht: Record<string, number>
  medianGeldertrag: number
  medianGeldbilanz: number
  /** 5 % des Medians, abgerundet — der Vorschlag fuer `spySalaryIntel` (D29.7). */
  soldAnkerFuenfProzent: number
}

function anker(state: GameState, startzahl: number): Anker {
  const lebend = state.playerOrder.filter((id) => state.players[id]!.alive)
  const ertrag: Record<string, number> = {}
  const bilanz: Record<string, number> = {}
  for (const id of lebend) {
    const money = economyOverview(state, id, rules).money
    ertrag[state.players[id]!.nation] = money.production
    bilanz[state.players[id]!.nation] = money.balance
  }
  const medianGeldertrag = median(Object.values(ertrag))
  return {
    startzahl,
    spieltag: Math.floor(state.tick / rules.constants.ticksPerDay),
    tick: state.tick,
    lebendeMaechte: lebend.length,
    geldertragJeMacht: ertrag,
    geldbilanzJeMacht: bilanz,
    medianGeldertrag,
    medianGeldbilanz: median(Object.values(bilanz)),
    soldAnkerFuenfProzent: Math.floor((medianGeldertrag * 5) / 100),
  }
}

/** Die Freigaben eines Zustands — als JSON gelesen, damit Stufe 3 und Stufe 4 dieselbe Antwort geben. */
function freigaben(state: GameState): { durchmarsch: number; karte: number; buendnisse: number } {
  let durchmarsch = 0
  let karte = 0
  let buendnisse = 0
  for (const relation of Object.values(state.diplomacy.relations) as unknown as Record<string, unknown>[]) {
    if (relation['rightOfWay'] === true) durchmarsch += 2
    if (relation['aGrantsPassage'] === true) durchmarsch += 1
    if (relation['bGrantsPassage'] === true) durchmarsch += 1
    if (relation['sharedMap'] === true) karte += 2
    if (relation['aSharesMap'] === true) karte += 1
    if (relation['bSharesMap'] === true) karte += 1
    if (relation['state'] === 'alliance') buendnisse += 1
  }
  return { durchmarsch, karte, buendnisse }
}

/**
 * Was ein Ueberfall war (Befund B6). Gelesen am Zustand unmittelbar nach dem Tick, in dem er fiel:
 * wohin wollte die Armee, die auf fremdem Boden stand?
 */
interface Ueberfall {
  tick: number
  taeter: string
  opfer: string
  /** Eine Kriegserklaerung gegen das Opfer lief schon, war aber noch nicht wirksam. */
  erklaerungLief: boolean
  /**
   * `ziel`: das Marschziel (oder der Standort) liegt im Land des Opfers — ein Angriff ohne Erklaerung.
   * `durchmarsch`: das Marschziel gehoert jemand anderem — das Opfer lag nur auf dem Weg. Nur diese
   * Faelle kann ein Antrag auf Durchmarsch (R-DIP-08, T-M17-10) verhindern.
   */
  art: 'ziel' | 'durchmarsch'
  /** Bei `durchmarsch`: wem das Marschziel gehoert, und ob der Taeter mit ihm im Krieg war. */
  zielBesitzer: string | null
  zielImKrieg: boolean
}

interface Lauf {
  tage: number
  events: GameEvent[]
  final: GameState
  ki: Set<string>
  befehle: Command[]
  ankerTag30: Anker
  /** Hoechststand der gerichteten Freigaben am Ende eines Spieltags (ein symmetrisches Feld zaehlt zwei). */
  freigabenHoechstens: { durchmarsch: number; karte: number; buendnisse: number }
  ueberfaelle: Ueberfall[]
}

const relationOf = (state: GameState, a: string, b: string) => state.diplomacy.relations[a < b ? `${a}|${b}` : `${b}|${a}`]

function einordnen(before: GameState, after: GameState, taeter: string, opfer: string): Ueberfall {
  const nation = (id: string): string => after.players[id]!.nation
  const armeen = after.armyOrder
    .map((id) => after.armies[id]!)
    .filter((army) => army.owner === taeter && before.provinces[army.locationProvinceId]?.owner === opfer)

  // Mehrere Armeen im selben Tick: ein einziger Marsch mit Ziel im Land des Opfers macht den
  // Ueberfall zum Angriff. `durchmarsch` heisst: keine wollte dorthin.
  let art: Ueberfall['art'] = 'durchmarsch'
  let zielBesitzer: string | null = null
  for (const army of armeen) {
    const ziel = army.path.length > 0 ? army.path[army.path.length - 1]! : army.locationProvinceId
    const besitzer = before.provinces[ziel]?.owner ?? null
    if (besitzer === opfer) art = 'ziel'
    else zielBesitzer ??= besitzer
  }
  if (armeen.length === 0) art = 'ziel'
  if (art === 'ziel') zielBesitzer = null

  return {
    tick: after.tick,
    taeter: nation(taeter),
    opfer: nation(opfer),
    erklaerungLief: relationOf(before, taeter, opfer)?.warEffectiveAtTick != null,
    art,
    zielBesitzer: zielBesitzer === null ? null : zielBesitzer === taeter ? 'eigenes Land' : nation(zielBesitzer),
    zielImKrieg: zielBesitzer !== null && zielBesitzer !== taeter && relationOf(before, taeter, zielBesitzer)?.state === 'war',
  }
}

async function spiele(seed: number, tage: number): Promise<Lauf> {
  let current = createInitialState(baselineConfig(seed), { map, rules })
  const ki = new Set(current.playerOrder.filter((id) => current.players[id]!.kind === 'ai'))
  const events: GameEvent[] = []
  const befehle: Command[] = []
  const ueberfaelle: Ueberfall[] = []
  const hoechstens = { durchmarsch: 0, karte: 0, buendnisse: 0 }
  let ankerTag30: Anker | undefined
  let gelaufen = 0

  for (let tag = 0; tag < tage; tag++) {
    // Tick fuer Tick statt tageweise: dieselbe Partie (`zustandOhneKi` belegt es), aber der Zustand
    // unmittelbar nach einem Ueberfall ist noch da, wenn er eingeordnet wird.
    for (let stunde = 0; stunde < rules.constants.ticksPerDay; stunde++) {
      const before = current
      const chunk = advanceTicks(current, 1, { map, rules })
      current = chunk.state
      events.push(...chunk.events)
      for (const { command } of chunk.applied) if (ki.has(command.playerId)) befehle.push(command)
      for (const event of chunk.events) {
        if (event.type === 'WAR_DECLARED' && event.withoutDeclaration) {
          ueberfaelle.push(einordnen(before, current, event.playerId, event.targetPlayerId))
        }
      }
      if (current.victory.winner !== null) break
    }
    gelaufen = tag + 1

    const heute = freigaben(current)
    hoechstens.durchmarsch = Math.max(hoechstens.durchmarsch, heute.durchmarsch)
    hoechstens.karte = Math.max(hoechstens.karte, heute.karte)
    hoechstens.buendnisse = Math.max(hoechstens.buendnisse, heute.buendnisse)

    if (gelaufen === ANCHOR_DAY) ankerTag30 = anker(current, seed)
    if (current.victory.winner !== null) break
    await breathe()
  }

  if (!ankerTag30) throw new Error(`Die Partie ${seed} endete vor Spieltag ${ANCHOR_DAY}.`)
  return { tage: gelaufen, events, final: current, ki, befehle, ankerTag30, freigabenHoechstens: hoechstens, ueberfaelle }
}

const zaehle = <T>(items: readonly T[], key: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((acc, item) => {
    const k = key(item)
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

type Rejected = Extract<GameEvent, { type: 'COMMAND_REJECTED' }>
type WarDeclared = Extract<GameEvent, { type: 'WAR_DECLARED' }>

function kennzahlen(lauf: Lauf) {
  const { events, final, ki, befehle } = lauf
  const nation = (id: string): string => final.players[id]!.nation

  const kriege = events.filter((event): event is WarDeclared => event.type === 'WAR_DECLARED')
  const ueberfaelle = kriege.filter((event) => event.withoutDeclaration)
  const abgelehnt = events.filter((event): event is Rejected => event.type === 'COMMAND_REJECTED' && ki.has(event.playerId))
  const diplomatie = befehle.filter((command): command is Extract<Command, { type: 'DIPLOMACY' }> => command.type === 'DIPLOMACY')

  const bestand: Record<string, number> = {}
  const bestandLebend: Record<string, number> = {}
  for (const resource of RESOURCE_KEYS) {
    bestand[resource] = 0
    bestandLebend[resource] = 0
    for (const id of final.playerOrder) {
      const player = final.players[id]!
      bestand[resource] += player.resources[resource]
      if (player.alive) bestandLebend[resource] += player.resources[resource]
    }
  }

  return {
    spieltage: lauf.tage,
    maechte: ki.size,
    ereignisse: events.length,
    befehle: befehle.length,
    kriegserklaerungen: kriege.length,
    // Befund B6: ist diese Zahl null, steht sie so im Bericht — und R-AI-09/AK3 („mit Antraegen
    // nicht mehr Ueberfaelle") vergleicht dann null mit null.
    ueberfaelleOhneKriegserklaerung: ueberfaelle.length,
    ueberfaelleJeTaeter: zaehle(ueberfaelle, (event) => nation(event.playerId)),
    ueberfaelleJePaar: zaehle(ueberfaelle, (event) => `${nation(event.playerId)} -> ${nation(event.targetPlayerId)}`),
    // Nur `durchmarsch` kann ein Antrag verhindern (T-M17-10, R-AI-09/AK3); `ziel` ist ein Angriff ohne Erklaerung.
    ueberfaelleJeArt: zaehle(lauf.ueberfaelle, (entry) => entry.art),
    ueberfaelleMitLaufenderErklaerung: lauf.ueberfaelle.filter((entry) => entry.erklaerungLief).length,
    ueberfaelleEinzeln: lauf.ueberfaelle,
    // Freigaben: Befehle (es gibt kein Ereignis dafuer) und der Zustand.
    diplomatieBefehleJeAktion: zaehle(diplomatie, (command) => command.action),
    durchmarschBefehle: diplomatie.filter((command) => command.action === 'grantRightOfWay').length,
    kartenfreigabeBefehle: diplomatie.filter((command) => command.action === 'shareMap').length,
    freigabenAmEnde: freigaben(final),
    freigabenHoechstens: lauf.freigabenHoechstens,
    offeneAngeboteAmEnde: final.diplomacy.offers.length,
    handel: events.filter((event) => event.type === 'TRADE_EXECUTED').length,
    bestandssummenTag200: bestand,
    bestandssummenTag200NurLebende: bestandLebend,
    bestandJeMacht: Object.fromEntries(final.playerOrder.map((id) => [nation(id), { ...final.players[id]!.resources }])),
    ausgeschieden: final.playerOrder.filter((id) => !final.players[id]!.alive).map(nation),
    abgelehnt: abgelehnt.length,
    abgelehntJeCode: zaehle(abgelehnt, (event) => event.code),
    abgelehntJeBefehlUndCode: zaehle(abgelehnt, (event) => `${event.command}:${event.code}`),
    /** Dieselbe Pruefsumme wie `zustandOhneKi` im Integrationstor — muss bei gleichem Stand gleich sein. */
    zustandOhneKi: hashValue({ ...final, ai: null }, { omitKeys: ['eventLog'] }),
  }
}

const git = (args: readonly string[]): string | null => {
  try {
    return execFileSync('git', [...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

let hauptlauf: Lauf
const streuung: Anker[] = []

beforeAll(async () => {
  hauptlauf = await spiele(SEED, DAYS)
  for (const seed of SPREAD_SEEDS) {
    await breathe()
    streuung.push((await spiele(seed, ANCHOR_DAY)).ankerTag30)
  }
}, 1_800_000)

describe('T-M17-02 Der Ausgangswert von M17', () => {
  it('hat ueberhaupt etwas gemessen', () => {
    // Eine Zaehlung ueber einer leeren Menge ist immer null — zuerst also, dass die Partie lief.
    expect(hauptlauf.tage, 'die Partie endete vor dem 200. Spieltag').toBe(DAYS)
    expect(hauptlauf.ki.size).toBe(8)
    expect(hauptlauf.events.length).toBeGreaterThan(1000)
    expect(hauptlauf.befehle.length).toBeGreaterThan(1000)
    expect(hauptlauf.events.some((event) => event.type === 'WAR_DECLARED'), 'kein einziger Krieg').toBe(true)
    // Zwei Zaehlwege, eine Zahl: der Ereignisstrom und die Einordnung je Tick.
    const imStrom = hauptlauf.events.filter((event) => event.type === 'WAR_DECLARED' && event.withoutDeclaration).length
    expect(hauptlauf.ueberfaelle.length).toBe(imStrom)
  })

  it('misst den Sold-Anker an einer Partie, in der an Tag 30 noch alle wirtschaften', () => {
    const a = hauptlauf.ankerTag30
    expect(a.tick).toBe(ANCHOR_DAY * rules.constants.ticksPerDay)
    expect(a.lebendeMaechte).toBe(8)
    expect(Object.values(a.geldertragJeMacht).every((wert) => wert > 0), 'eine Macht ohne Geldertrag').toBe(true)
    expect(a.medianGeldertrag).toBeGreaterThan(0)
    expect(a.soldAnkerFuenfProzent).toBe(Math.floor((a.medianGeldertrag * 5) / 100))
  })

  it('rechnet den Median wie beschrieben', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2)
    expect(median([10, 20])).toBe(15)
    expect(median([])).toBe(0)
  })

  it('schreibt den Bericht — und laesst die Nullen stehen, wo welche sind', () => {
    const zahlen = {
      gemessenAm: new Date().toISOString().slice(0, 10),
      gemessenAufCommit: git(['rev-parse', 'HEAD']),
      aufgabe: 'T-M17-02',
      partie: { karte: map.id, startzahl: SEED, maechte: 8, stufen: 'easy/normal/hard reihum', spieltage: DAYS },
      soldAnker: {
        definition:
          'economyOverview(...).money.production je lebender Macht am Ende von Spieltag 30 (Bruttoertrag je Spieltag, vor Armeeunterhalt; Festkomma wie alle Bestaende, 1000 = 1 Geld); Median ueber die Maechte, bei gerader Zahl der abgerundete Mittelwert der beiden mittleren; der Sold-Anker ist 5 % davon, abgerundet (D29.7)',
        ...hauptlauf.ankerTag30,
        streuung,
      },
      ...kennzahlen(hauptlauf),
    }

    if (SCHREIBEN) {
      const dir = `${ROOT}docs/reports/`
      mkdirSync(dir, { recursive: true })
      writeFileSync(`${dir}m17-baseline.json`, JSON.stringify(zahlen, null, 2) + '\n')
    }

    expect(zahlen.ereignisse).toBeGreaterThan(1000)
    expect(Object.keys(zahlen.bestandssummenTag200).sort()).toEqual([...RESOURCE_KEYS].sort())
  })
})
