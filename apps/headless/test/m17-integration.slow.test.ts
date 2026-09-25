import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { advanceTicks } from '@worldwar/ai'
import {
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
import { measurementStamp } from '../../../scripts/freshness.mjs'

/**
 * T-M17-15, R-AI-09/AK1 bis AK4: dasselbe Integrationstor wie `ai-integration.slow.test.ts`
 * (Weltkarte, acht KI, 200 Spieltage), aber fuer M17 — Spionage, Handel und gerichteter
 * Durchmarsch — und in drei Startzahlen (1815/1914/2015), je einmal **mit** und einmal
 * **ohne** Durchmarsch-Antraege der KI (Falle 4 im Plan).
 *
 * **Tickweise, nicht tageweise** (Falle 4): `explain` liefert nur die Begruendungen des
 * letzten Ticks. Ein tageweiser Aufruf wie in `ai-integration.slow.test.ts` waere fuer AK4
 * leer gruen. `advanceTicks` selbst ist ohne Option bitgleich zum tageweisen Aufruf
 * (`loop.test.ts` W1) — dieselbe Partie, ein anderes Fenster.
 *
 * **Der Gegenlauf** haelt KI-`requestRightOfWay`-Antraege mit `withhold` zurueck
 * (T-M17-15, R-AI-09/AK3, `packages/ai/src/loop.ts`). Das Gedaechtnis der KI wird trotzdem
 * gespeichert — sie beantragt am naechsten Tag erneut (Falle 5), darum stehen 24-54
 * zurueckgehaltene Antraege je Lauf und nicht nur einer.
 *
 * Der Ausgangswert von AK3 kommt aus `docs/reports/m17-baseline.json` (Falle 7), nicht als
 * Zahl im Test — sonst veraltet die Schranke still.
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
const STARTZAHLEN = [1815, 1914, 2015] as const
const SCHREIBEN = process.env['WORLDWAR_WRITE_REPORT'] === '1'
/** Quellen des Berichts (T-M17-15, §4.5) — traegt `measuredAtCommit`/`measuredDirty` fuer M18 (Befund M17-2). */
const QUELLEN = [
  'packages/ai/src',
  'packages/core/src',
  'packages/shared',
  'data/rules',
  'data/maps/world.json',
  'apps/headless/test/m17-integration.slow.test.ts',
]

/** Gibt die Ereignisschleife frei — ein langer synchroner Lauf toetet sonst den Worker (WORKFLOW §4). */
const breathe = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function integrationConfig(seed: number): GameConfig {
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

/** Merkmale eines Ueberfalls (T-M17-15, §4.5) — nicht ausschliesslich, jedes fuer sich gezaehlt. */
interface Ueberfall {
  tick: number
  taeter: string
  opfer: string
  /** Woertlich wie `m17-baseline.slow.test.ts` (Befund M17-1, B6). */
  art: 'ziel' | 'durchmarsch'
  /** Beziehung am Tickbeginn 'truce', oder im selben Tick ein DIPLOMACY_CHANGED 'truce' (Befund M17-T6). */
  friedensschluss: boolean
  /** Das Opfer hat dem Taeter frueher im Lauf per RIGHT_OF_WAY_CHANGED granted:false gekuendigt (M17-D10). */
  nachKuendigung: boolean
  /** Ein PROVINCE_CEDED an das Opfer lag hoechstens 72 Ticks zurueck (M17-D5). */
  nachAbtretung: boolean
  erklaerungLief: boolean
}

const relationOf = (state: GameState, a: string, b: string) => state.diplomacy.relations[a < b ? `${a}|${b}` : `${b}|${a}`]

function einordnen(
  before: GameState,
  after: GameState,
  events: readonly GameEvent[],
  taeter: string,
  opfer: string,
  kuendigungen: readonly { playerId: string; targetPlayerId: string }[],
  abtretungen: readonly { tick: number; newOwner: string }[],
): Ueberfall {
  const nation = (id: string): string => after.players[id]!.nation
  const armeen = after.armyOrder
    .map((id) => after.armies[id]!)
    .filter((army) => army.owner === taeter && before.provinces[army.locationProvinceId]?.owner === opfer)

  // Woertlich wie m17-baseline.slow.test.ts: mehrere Armeen im selben Tick, ein einziger
  // Marsch mit Ziel im Land des Opfers macht den Ueberfall zum Angriff.
  let art: Ueberfall['art'] = 'durchmarsch'
  for (const army of armeen) {
    const ziel = army.path.length > 0 ? army.path[army.path.length - 1]! : army.locationProvinceId
    const besitzer = before.provinces[ziel]?.owner ?? null
    if (besitzer === opfer) art = 'ziel'
  }
  if (armeen.length === 0) art = 'ziel'

  const truceJetzt = events.some(
    (event) =>
      event.type === 'DIPLOMACY_CHANGED' &&
      event.newState === 'truce' &&
      ((event.playerId === taeter && event.targetPlayerId === opfer) ||
        (event.playerId === opfer && event.targetPlayerId === taeter)),
  )
  const friedensschluss = relationOf(before, taeter, opfer)?.state === 'truce' || truceJetzt

  const nachKuendigung = kuendigungen.some((entry) => entry.playerId === opfer && entry.targetPlayerId === taeter)
  const nachAbtretung = abtretungen.some((entry) => entry.newOwner === opfer && after.tick - entry.tick <= 72)

  return {
    tick: after.tick,
    taeter: nation(taeter),
    opfer: nation(opfer),
    art,
    friedensschluss,
    nachKuendigung,
    nachAbtretung,
    erklaerungLief: relationOf(before, taeter, opfer)?.warEffectiveAtTick != null,
  }
}

/**
 * Befehle, deren AK4-Erklaerung (Grund und Alternative) gezaehlt wird (§3.5), samt dem
 * Wortanfang, an dem der zugehoerige `action`-Text im Erklaerungsarray erkennbar ist
 * (Nacharbeit T-M17-15, Befund "R-AI-09/AK4 zaehlt Erklaerungen aus falscher Quelle",
 * 2026-09-25): vorher zaehlte `gedeckt` JEDE Erklaerung der Macht in diesem Tick, auch
 * die von military.ts/economy.ts/provinceValue.ts/trade.ts fuer ganz andere Befehle —
 * ein Rueckfall in espionage.ts oder trade.ts waere unbemerkt geblieben. Die Wortanfaenge
 * kommen woertlich aus dem jeweiligen Aufruf von `commands.push` gleich davor
 * (`espionage.ts` "Spionage: wirbt", `trade.ts` "Bietet"/"Nimmt Angebot"/"Lehnt Angebot",
 * `passage.ts` "Beantragt Durchmarsch").
 */
const AK4_PREFIX: Record<string, string> = {
  RECRUIT_SPY: 'Spionage: wirbt',
  OFFER_TRADE: 'Bietet',
  ACCEPT_TRADE: 'Nimmt Angebot',
  DECLINE_TRADE: 'Lehnt Angebot',
  requestRightOfWay: 'Beantragt Durchmarsch',
}
/** Der AK4-Schluessel eines Befehls, oder `null`, wenn er nicht zu AK4 zaehlt. */
const ak4Key = (command: Command): string | null => {
  if (command.type === 'DIPLOMACY') return command.action === 'requestRightOfWay' ? 'requestRightOfWay' : null
  return command.type in AK4_PREFIX ? command.type : null
}

/**
 * AK2-Befehlstypen: alle neuen KI-Kommandos von M17, nicht nur die drei aus der urspruenglichen
 * dod (Nacharbeit T-M17-15, Befund "AK2 enger als der Anforderungstext", 2026-09-25). `DIPLOMACY`
 * deckt dabei jede Aktion ab — `COMMAND_REJECTED` traegt keine Aktion, nur `command.type`
 * (`applyCommands.ts`), eine Ablehnung von `requestRightOfWay`/`acceptRightOfWay`/
 * `grantRightOfWay`/`revokeRightOfWay` ist darueber also nicht einzeln zu unterscheiden.
 */
const AK2_COMMANDS = ['RECRUIT_SPY', 'OFFER_TRADE', 'ACCEPT_TRADE', 'DECLINE_TRADE', 'REASSIGN_SPY', 'DISMISS_SPY', 'DIPLOMACY']

interface Lauf {
  startzahl: number
  mitAntraegen: boolean
  tage: number
  events: GameEvent[]
  final: GameState
  ki: Set<string>
  kiBefehle: Command[]
  withheld: { tick: number; command: Command }[]
  ueberfaelle: Ueberfall[]
  /**
   * Je (Tick|Macht|AK4-Art): wie viele Befehle dieser Art, wie viele davon durch eine
   * Erklaerung MIT PASSENDEM WORTANFANG (nicht irgendeine Erklaerung der Macht) und mit
   * reason+alternative gedeckt.
   */
  ak4Buckets: { tick: number; playerId: string; art: string; befehle: number; gedeckt: number }[]
}

async function spiele(startzahl: number, mitAntraegen: boolean, tage: number): Promise<Lauf> {
  let current = createInitialState(integrationConfig(startzahl), { map, rules })
  const ki = new Set(current.playerOrder.filter((id) => current.players[id]!.kind === 'ai'))

  const events: GameEvent[] = []
  const kiBefehle: Command[] = []
  const withheld: { tick: number; command: Command }[] = []
  const ueberfaelle: Ueberfall[] = []
  const ak4Buckets: Lauf['ak4Buckets'] = []
  const kuendigungen: { playerId: string; targetPlayerId: string }[] = []
  const abtretungen: { tick: number; newOwner: string }[] = []

  const withhold = mitAntraegen
    ? undefined
    : (command: Command): boolean => command.type === 'DIPLOMACY' && command.action === 'requestRightOfWay'

  let gelaufen = 0
  for (let tag = 0; tag < tage; tag++) {
    for (let stunde = 0; stunde < rules.constants.ticksPerDay; stunde++) {
      const before = current
      const chunk = advanceTicks(current, 1, { map, rules }, { explain: true, ...(withhold ? { withhold } : {}) })
      current = chunk.state
      events.push(...chunk.events)
      withheld.push(...chunk.withheld)

      // AK4: nur die KI-Befehle DIESES Ticks (tick.ai vor der Anwendung), nach Macht UND Art
      // gruppiert — eine Erklaerung deckt nur Befehle ihrer eigenen Art (Befund oben).
      const kiDiesesTicks = chunk.applied.filter((entry) => ki.has(entry.command.playerId))
      for (const { command } of kiDiesesTicks) kiBefehle.push(command)
      const jeMachtUndArt = new Map<string, number>()
      for (const { command } of kiDiesesTicks) {
        const art = ak4Key(command)
        if (art === null) continue
        const schluessel = `${command.playerId}|${art}`
        jeMachtUndArt.set(schluessel, (jeMachtUndArt.get(schluessel) ?? 0) + 1)
      }
      if (jeMachtUndArt.size > 0) {
        for (const [schluessel, befehle] of jeMachtUndArt) {
          const [playerId, art] = schluessel.split('|') as [string, string]
          const erklaerungen = chunk.explanations[playerId] ?? []
          const prefix = AK4_PREFIX[art]!
          const gedeckt = Math.min(
            befehle,
            erklaerungen.filter((e) => e.action.startsWith(prefix) && e.reason !== '' && e.alternative !== undefined).length,
          )
          ak4Buckets.push({ tick: before.tick, playerId, art, befehle, gedeckt })
        }
      }

      for (const event of chunk.events) {
        if (event.type === 'WAR_DECLARED' && event.withoutDeclaration) {
          ueberfaelle.push(einordnen(before, current, chunk.events, event.playerId, event.targetPlayerId, kuendigungen, abtretungen))
        }
        if (event.type === 'RIGHT_OF_WAY_CHANGED' && event.granted === false) {
          kuendigungen.push({ playerId: event.playerId, targetPlayerId: event.targetPlayerId })
        }
        if (event.type === 'PROVINCE_CEDED') {
          abtretungen.push({ tick: current.tick, newOwner: event.newOwner })
        }
      }

      if (current.victory.winner !== null) break
    }
    gelaufen = tag + 1
    if (current.victory.winner !== null) break
    await breathe()
  }

  return { startzahl, mitAntraegen, tage: gelaufen, events, final: current, ki, kiBefehle, withheld, ueberfaelle, ak4Buckets }
}

type Rejected = Extract<GameEvent, { type: 'COMMAND_REJECTED' }>
type SpyReport = Extract<GameEvent, { type: 'SPY_REPORT' }>

const zaehle = <T>(items: readonly T[], key: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((acc, item) => {
    const k = key(item)
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

/** Alle Zahlen eines Laufs (T-M17-15, §4.5). */
function kennzahlen(lauf: Lauf) {
  const { events, final, ki, kiBefehle } = lauf
  const nation = (id: string): string => final.players[id]!.nation
  const stufe = (id: string): string => final.players[id]!.difficulty!

  const spyReports = events.filter((event): event is SpyReport => event.type === 'SPY_REPORT' && ki.has(event.playerId))
  const abgelehnt = events.filter((event): event is Rejected => event.type === 'COMMAND_REJECTED' && ki.has(event.playerId))
  const tradeAgreed = events.filter((event) => event.type === 'TRADE_AGREED')
  const tradeClosed = events.filter((event) => event.type === 'TRADE_OFFER_CLOSED')
  const offerTrade = kiBefehle.filter((command): command is Extract<Command, { type: 'OFFER_TRADE' }> => command.type === 'OFFER_TRADE')
  const recruitSpy = kiBefehle.filter((command): command is Extract<Command, { type: 'RECRUIT_SPY' }> => command.type === 'RECRUIT_SPY')
  const diplomatie = kiBefehle.filter((command): command is Extract<Command, { type: 'DIPLOMACY' }> => command.type === 'DIPLOMACY')
  const rightOfWayGranted = events.filter(
    (event) => event.type === 'RIGHT_OF_WAY_CHANGED' && event.granted === true && ki.has(event.playerId) && ki.has(event.targetPlayerId),
  )
  const truce = events.filter(
    (event): event is Extract<GameEvent, { type: 'DIPLOMACY_CHANGED' }> => event.type === 'DIPLOMACY_CHANGED' && event.newState === 'truce',
  )
  const geldmangel = events.filter(
    (event) => event.type === 'RESOURCE_SHORTAGE' && event.resource === 'money' && ki.has(event.playerId),
  )
  const kriege = events.filter((event): event is Extract<GameEvent, { type: 'WAR_DECLARED' }> => event.type === 'WAR_DECLARED')

  const ak4Befehle = lauf.ak4Buckets.reduce((sum, entry) => sum + entry.befehle, 0)
  const ak4Gedeckt = lauf.ak4Buckets.reduce((sum, entry) => sum + entry.gedeckt, 0)
  const ak4Luecken = lauf.ak4Buckets
    .filter((entry) => entry.gedeckt < entry.befehle)
    .map((entry) => `${entry.tick}|${nation(entry.playerId)}|${entry.art}: ${entry.befehle} Befehle, ${entry.gedeckt} gedeckt`)

  return {
    spieltage: lauf.tage,
    maechte: ki.size,
    ereignisse: events.length,
    kiBefehle: kiBefehle.length,
    spyReportJeStufe: zaehle(spyReports, (event) => stufe(event.playerId)),
    spyReportJeStufeUndAusgang: zaehle(spyReports, (event) => `${stufe(event.playerId)}:${event.outcome}`),
    recruitSpyJeStufeUndAuftrag: zaehle(recruitSpy, (command) => `${stufe(command.playerId)}:${command.mission}`),
    spyDetected: events.filter((event) => event.type === 'SPY_DETECTED' && ki.has(event.targetPlayerId)).length,
    sabotage: events.filter((event) => event.type === 'SABOTAGE_SUFFERED' && ki.has(event.playerId)).length,
    spyLost: events.filter((event) => event.type === 'SPY_LOST' && ki.has(event.playerId)).length,
    tradeAgreed: tradeAgreed.length,
    tradeClosedJeGrund: zaehle(tradeClosed, (event) => (event as Extract<GameEvent, { type: 'TRADE_OFFER_CLOSED' }>).reason),
    offerTrade: offerTrade.length,
    offerTradeMitProvinz: offerTrade.filter((command) => command.give.provinces.length > 0 || command.want.provinces.length > 0).length,
    acceptTrade: kiBefehle.filter((command) => command.type === 'ACCEPT_TRADE').length,
    declineTrade: kiBefehle.filter((command) => command.type === 'DECLINE_TRADE').length,
    provinceCeded: events.filter((event) => event.type === 'PROVINCE_CEDED').length,
    durchmarschKiKi: rightOfWayGranted.length,
    kuendigungen: events.filter((event) => event.type === 'RIGHT_OF_WAY_CHANGED' && event.granted === false && ki.has(event.playerId))
      .length,
    diplomatieJeAktion: zaehle(diplomatie, (command) => command.action),
    kriege: kriege.length,
    foermlich: kriege.filter((event) => !event.withoutDeclaration).length,
    ueberfaelle: lauf.ueberfaelle.length,
    ueberfaelleEinzeln: lauf.ueberfaelle,
    ueberfaelleJeArt: zaehle(lauf.ueberfaelle, (entry) => entry.art),
    ueberfaelleMitFriedensschluss: lauf.ueberfaelle.filter((entry) => entry.friedensschluss).length,
    ueberfaelleNachKuendigung: lauf.ueberfaelle.filter((entry) => entry.nachKuendigung).length,
    ueberfaelleNachAbtretung: lauf.ueberfaelle.filter((entry) => entry.nachAbtretung).length,
    frieden: truce.length,
    friedenZwischenKi: truce.filter((event) => ki.has(event.playerId) && ki.has(event.targetPlayerId)).length,
    geldmangelKi: geldmangel.length,
    ablehnungen: zaehle(abgelehnt, (event) => `${event.command}:${event.code}`),
    ablehnungenAk2: abgelehnt.filter(
      (event) => AK2_COMMANDS.includes(event.command) && ['INVALID_TARGET', 'QUEUE_FULL'].includes(event.code),
    ).length,
    ak4: { befehle: ak4Befehle, gedeckt: ak4Gedeckt, luecken: ak4Luecken },
    zurueckgehalten: lauf.withheld.length,
    artillerie: events.filter((event) => event.type === 'UNIT_RECRUITED' && event.unitKey === 'artillery').length,
    beschuss: events.filter((event) => event.type === 'BOMBARDMENT' && event.automatic).length,
    ausgeschieden: final.playerOrder.filter((id) => !final.players[id]!.alive).map(nation),
    zustandOhneKi: hashValue({ ...final, ai: null }, { omitKeys: ['eventLog'] }),
  }
}

const laeufeMit = new Map<number, Lauf>()
const laeufeOhne = new Map<number, Lauf>()

beforeAll(async () => {
  for (const startzahl of STARTZAHLEN) {
    laeufeMit.set(startzahl, await spiele(startzahl, true, DAYS))
    await breathe()
    laeufeOhne.set(startzahl, await spiele(startzahl, false, DAYS))
    await breathe()
  }
}, 1_800_000)

const mit = (startzahl: number): Lauf => laeufeMit.get(startzahl)!
const ohne = (startzahl: number): Lauf => laeufeOhne.get(startzahl)!

const baseline = load('docs/reports/m17-baseline.json') as {
  ueberfaelleOhneKriegserklaerung: number
  ueberfaelleJeArt: { ziel: number; durchmarsch: number }
}

describe('R-AI-09/AK1 Die KI nutzt Spione, Handel und Durchmarsch — 200 Tage, Weltkarte, acht KI', () => {
  it('hat ueberhaupt etwas gemessen', () => {
    for (const startzahl of STARTZAHLEN) {
      for (const lauf of [mit(startzahl), ohne(startzahl)]) {
        expect(lauf.tage, `${startzahl} ${lauf.mitAntraegen ? 'mit' : 'ohne'}: Partie endete zu frueh`).toBe(DAYS)
        expect(lauf.ki.size).toBe(8)
        expect(lauf.events.length).toBeGreaterThan(1000)
        expect(lauf.kiBefehle.length).toBeGreaterThan(1000)
        // Zwei Zaehlwege, eine Zahl (Muster m17-baseline.slow.test.ts).
        const imStrom = lauf.events.filter((event) => event.type === 'WAR_DECLARED' && event.withoutDeclaration).length
        expect(lauf.ueberfaelle.length).toBe(imStrom)
      }

      const laufMit = mit(startzahl)
      expect(laufMit.kiBefehle.some((c) => c.type === 'RECRUIT_SPY'), `${startzahl}: kein RECRUIT_SPY`).toBe(true)
      expect(laufMit.kiBefehle.some((c) => c.type === 'OFFER_TRADE'), `${startzahl}: kein OFFER_TRADE`).toBe(true)
      expect(
        laufMit.kiBefehle.some((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay'),
        `${startzahl}: kein requestRightOfWay`,
      ).toBe(true)
      expect(laufMit.events.some((e) => e.type === 'WAR_DECLARED'), `${startzahl}: kein WAR_DECLARED`).toBe(true)

      // Der Hebel wirkte: der ohne-Lauf hielt Antraege zurueck, und keiner davon kam in applied an.
      const laufOhne = ohne(startzahl)
      const zurueckgehalteneAntraege = laufOhne.withheld.filter(
        (entry) => entry.command.type === 'DIPLOMACY' && entry.command.action === 'requestRightOfWay',
      )
      expect(zurueckgehalteneAntraege.length, `${startzahl}: der Hebel hat nichts zurueckgehalten`).toBeGreaterThan(0)
      expect(laufOhne.kiBefehle.some((c) => c.type === 'DIPLOMACY' && c.action === 'requestRightOfWay')).toBe(false)
    }
  })

  it('bringt je Schwierigkeitsstufe einen Spionagebericht, auch einen gelungenen', () => {
    for (const startzahl of STARTZAHLEN) {
      const lauf = mit(startzahl)
      for (const stufe of ['easy', 'normal', 'hard'] as const) {
        const berichte = lauf.events.filter(
          (event): event is SpyReport => event.type === 'SPY_REPORT' && lauf.final.players[event.playerId]!.difficulty === stufe,
        )
        expect(berichte.length, `${startzahl} ${stufe}: kein SPY_REPORT`).toBeGreaterThanOrEqual(1)
        expect(berichte.some((event) => event.outcome === 'success'), `${startzahl} ${stufe}: nie erfolgreich`).toBe(true)
      }
    }
  })

  it('schliesst mindestens einen Handel zwischen zwei Maechten ab', () => {
    for (const startzahl of STARTZAHLEN) {
      const lauf = mit(startzahl)
      expect(lauf.events.filter((event) => event.type === 'TRADE_AGREED').length, `${startzahl}: kein TRADE_AGREED`).toBeGreaterThanOrEqual(1)
    }
  })

  it('gewaehrt zwischen zwei KI-Maechten mindestens einmal Durchmarsch', () => {
    for (const startzahl of STARTZAHLEN) {
      const lauf = mit(startzahl)
      const gewaehrt = lauf.events.filter(
        (event) =>
          event.type === 'RIGHT_OF_WAY_CHANGED' &&
          event.granted === true &&
          lauf.ki.has(event.playerId) &&
          lauf.ki.has(event.targetPlayerId),
      )
      expect(gewaehrt.length, `${startzahl}: kein Durchmarsch zwischen KI`).toBeGreaterThanOrEqual(1)
    }
  })

  /**
   * Zwei unabhaengige KI-Mechanismen fuehren zum selben `RIGHT_OF_WAY_CHANGED
   * granted:true` (Nacharbeit T-M17-15, Befund "AK1-Zusicherung zum Durchmarsch
   * unterscheidet nicht zwischen zwei unabhaengigen KI-Mechanismen", 2026-09-25): die
   * **Erwiderung** eines bereits erhaltenen Durchmarschs (`diplomacy.ts`, R-DIP-06/AK3,
   * T-M17-04 — "eine Geste, die nie beantwortet wird, ist keine Diplomatie, sondern eine
   * Einbahnstraße") und die **Annahme** eines eingehenden Antrags (`passage.ts`,
   * `requestRightOfWay`/`acceptRightOfWay`). Die Zusicherung oben allein sah einen
   * Rueckfall der Erwiderung nicht: mit `diplomacy.ts`s Erwiderungsschleife abgeschaltet
   * blieb sie ueber alle drei Startzahlen und 200 Spieltage gruen, weil die Annahme allein
   * die Schranke `>= 1` erfuellte (Gegenprobe der Pruefung: 11/12 statt 12/12 — genau diese
   * Aufspaltung wird dabei rot, sonst keine). Beide Wege deshalb einzeln, ueber die
   * tatsaechlich angewandten Befehle (nicht das gemeinsame Ereignis).
   */
  it('erwidert UND nimmt Durchmarsch an — zwei getrennte KI-Mechanismen, nicht nur einer', () => {
    for (const startzahl of STARTZAHLEN) {
      const lauf = mit(startzahl)
      const erwidert = lauf.kiBefehle.filter(
        (c) => c.type === 'DIPLOMACY' && c.action === 'grantRightOfWay' && lauf.ki.has(c.targetPlayerId),
      )
      const angenommen = lauf.kiBefehle.filter(
        (c) => c.type === 'DIPLOMACY' && c.action === 'acceptRightOfWay' && lauf.ki.has(c.targetPlayerId),
      )
      expect(erwidert.length, `${startzahl}: keine KI erwidert einen erhaltenen Durchmarsch (diplomacy.ts)`).toBeGreaterThanOrEqual(1)
      expect(angenommen.length, `${startzahl}: keine KI nimmt einen Durchmarsch-Antrag an (passage.ts)`).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('R-AI-09/AK2 Kein Befehl ins Blaue, kein Geldmangel', () => {
  it('lehnt keinen M17-Befehl der KI (Spionage, Handel, Diplomatie) mit INVALID_TARGET oder QUEUE_FULL ab', () => {
    for (const startzahl of STARTZAHLEN) {
      const lauf = mit(startzahl)
      const treffer = lauf.events.filter(
        (event): event is Rejected =>
          event.type === 'COMMAND_REJECTED' &&
          lauf.ki.has(event.playerId) &&
          AK2_COMMANDS.includes(event.command) &&
          ['INVALID_TARGET', 'QUEUE_FULL'].includes(event.code),
      )
      expect(treffer.length, `${startzahl}: ${JSON.stringify(treffer.slice(0, 3))}`).toBe(0)
    }
  })

  it('laesst keine KI-Macht Geldmangel erleiden', () => {
    for (const startzahl of STARTZAHLEN) {
      const lauf = mit(startzahl)
      const mangel = lauf.events.filter((event) => event.type === 'RESOURCE_SHORTAGE' && event.resource === 'money' && lauf.ki.has(event.playerId))
      expect(mangel.length, `${startzahl}: ${JSON.stringify(mangel.slice(0, 3))}`).toBe(0)
    }
  })
})

describe('R-AI-09/AK3 Antraege machen aus Maerschen keine Ueberfaelle', () => {
  it('bleibt unter dem Ausgangswert von T-M17-02', () => {
    const lauf = mit(1815)
    expect(lauf.ueberfaelle.length, 'Ausgangswert T-M17-02 ueberschritten').toBeLessThanOrEqual(baseline.ueberfaelleOhneKriegserklaerung)
    const durchmarsch = lauf.ueberfaelle.filter((entry) => entry.art === 'durchmarsch').length
    expect(durchmarsch, 'Befund M17-1 ueberschritten').toBeLessThanOrEqual(baseline.ueberfaelleJeArt.durchmarsch)
  })

  it('erzeugt mit Antraegen nicht mehr Ueberfaelle, die ein Antrag bewegen kann, als ohne', () => {
    let summeMit = 0
    let summeOhne = 0
    for (const startzahl of STARTZAHLEN) {
      summeMit += mit(startzahl).ueberfaelle.filter((entry) => entry.art === 'durchmarsch' || entry.nachKuendigung).length
      summeOhne += ohne(startzahl).ueberfaelle.filter((entry) => entry.art === 'durchmarsch' || entry.nachKuendigung).length
    }
    expect(summeMit, `mit ${summeMit} > ohne ${summeOhne}`).toBeLessThanOrEqual(summeOhne)
  })

  /**
   * Die woertliche Fassung von R-AI-09/AK3 ("Ueberfaelle ohne Kriegserklaerung mit Antraegen
   * nicht groesser") gilt nur fuer die oben gepruefte, engere Teilmenge — die Nacharbeit
   * berichtigt die Fassung in 01-REQUIREMENTS.md dafuer (2026-09-25). Diese Zusicherung
   * schliesst die Luecke: jeder Ueberfall AUSSERHALB der bewegbaren Menge (kein Marschziel im
   * fremden Land, keine Kuendigung davor) ist einer, den ein Antrag ohnehin nicht verhindern
   * koennte — und der Test verlangt, dass er dann auf einen Friedensschluss im selben Tick
   * oder Waffenstillstand zurueckgeht (Befund M17-T6), nicht auf einen unbeachteten Antrag.
   */
  it('jeder Ueberfall ausserhalb der bewegbaren Menge geht auf einen Friedensschluss zurueck (M17-T6)', () => {
    for (const startzahl of STARTZAHLEN) {
      for (const lauf of [mit(startzahl), ohne(startzahl)]) {
        const ausserhalb = lauf.ueberfaelle.filter((entry) => entry.art !== 'durchmarsch' && !entry.nachKuendigung)
        for (const entry of ausserhalb) {
          expect(entry.friedensschluss, `${startzahl} ${lauf.mitAntraegen ? 'mit' : 'ohne'} Tick ${entry.tick}: ${JSON.stringify(entry)}`).toBe(
            true,
          )
        }
      }
    }
  })

  it('stellt die Gesamtzahlen mit und ohne Antraege nebeneinander', () => {
    for (const startzahl of STARTZAHLEN) {
      for (const lauf of [mit(startzahl), ohne(startzahl)]) {
        for (const entry of lauf.ueberfaelle) {
          expect(['ziel', 'durchmarsch']).toContain(entry.art)
          expect(typeof entry.friedensschluss).toBe('boolean')
          expect(typeof entry.nachKuendigung).toBe('boolean')
          expect(typeof entry.nachAbtretung).toBe('boolean')
        }
      }
    }
  })
})

describe('R-AI-09/AK4 Jede Handlung zwischen den Kriegen nennt Grund und Alternative', () => {
  it('begruendet jede Anwerbung, jedes Angebot, jede Antwort und jeden Antrag', () => {
    for (const startzahl of STARTZAHLEN) {
      const lauf = mit(startzahl)
      expect(lauf.ak4Buckets.reduce((sum, entry) => sum + entry.befehle, 0), `${startzahl}: keine AK4-Befehle gemessen`).toBeGreaterThan(0)
      for (const eintrag of lauf.ak4Buckets) {
        expect(
          eintrag.gedeckt,
          `${startzahl} Tick ${eintrag.tick} ${lauf.final.players[eintrag.playerId]!.nation} ${eintrag.art}: ${eintrag.befehle} Befehle, nur ${eintrag.gedeckt} gedeckt`,
        ).toBeGreaterThanOrEqual(eintrag.befehle)
      }
    }
  })
})

describe('R-DIP-09 Provinzhandel wird gezaehlt, nicht zugesichert (T-M17-11)', () => {
  it('zaehlt Provinzangebote und Abtretungen — und laesst die Nullen stehen', () => {
    for (const startzahl of STARTZAHLEN) {
      const lauf = mit(startzahl)
      const offerTrade = lauf.kiBefehle.filter((command): command is Extract<Command, { type: 'OFFER_TRADE' }> => command.type === 'OFFER_TRADE')
      expect(offerTrade.length, `${startzahl}: kein einziges Handelsangebot - der Zaehler misst nichts`).toBeGreaterThan(0)
      const mitProvinz = offerTrade.filter((command) => command.give.provinces.length > 0 || command.want.provinces.length > 0)
      const abtretungen = lauf.events.filter((event) => event.type === 'PROVINCE_CEDED')
      expect(mitProvinz.length).toBeGreaterThanOrEqual(0)
      expect(abtretungen.length).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('R-AI-09 Der Bericht', () => {
  it('schreibt m17-integration.json nur auf Verlangen', () => {
    const laeufe: Record<string, { mitAntraegen: ReturnType<typeof kennzahlen>; ohneAntraege: ReturnType<typeof kennzahlen> }> = {}
    let summeBewegbarMit = 0
    let summeBewegbarOhne = 0
    for (const startzahl of STARTZAHLEN) {
      const kMit = kennzahlen(mit(startzahl))
      const kOhne = kennzahlen(ohne(startzahl))
      laeufe[String(startzahl)] = { mitAntraegen: kMit, ohneAntraege: kOhne }
      summeBewegbarMit += mit(startzahl).ueberfaelle.filter((entry) => entry.art === 'durchmarsch' || entry.nachKuendigung).length
      summeBewegbarOhne += ohne(startzahl).ueberfaelle.filter((entry) => entry.art === 'durchmarsch' || entry.nachKuendigung).length
    }

    const zahlen = {
      gemessenAm: new Date().toISOString().slice(0, 10),
      ...measurementStamp(ROOT, QUELLEN),
      aufgabe: 'T-M17-15',
      partie: { karte: map.id, maechte: 8, stufen: 'easy/normal/hard reihum', spieltage: DAYS, startzahlen: STARTZAHLEN },
      ausgangswert: { datei: 'm17-baseline.json', ...baseline },
      laeufe,
      ak3: { summeBewegbarMit, summeBewegbarOhne },
    }

    if (SCHREIBEN) {
      const dir = `${ROOT}docs/reports/`
      mkdirSync(dir, { recursive: true })
      writeFileSync(`${dir}m17-integration.json`, JSON.stringify(zahlen, null, 2) + '\n')
    }

    expect(zahlen.laeufe['1815']!.mitAntraegen.ereignisse).toBeGreaterThan(1000)
    expect(Object.keys(zahlen.laeufe).sort()).toEqual(['1815', '1914', '2015'])
  })
})
