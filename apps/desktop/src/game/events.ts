import type { Command, GameEvent, MapData, PublicView, Rules, Terrain } from '@worldwar/core'
import { isPluralNation } from '../i18n/grammar.ts'
import { hasKey, t } from '../i18n/text.ts'
import { amount, unfix } from '../ui/format.ts'
import { isWorldEventType } from '@worldwar/core'
import { cueFor } from '../ui/sound.ts'
import { categoryOf, type DayReportDelta, type EventEntry, type EventImportance } from '../ui/Panels.tsx'
import { BUILDING_ICONS, RELATION_ICONS, RESOURCE_ICONS, SPY_MISSION_ICONS, UNIT_ICONS } from '../ui/icons.tsx'
import type { PictureName } from '../ui/Icon.tsx'

/**
 * Turning an event into a sentence (T-M10-06, R-UI-07).
 *
 * Every event carries ids; the log has to carry names. The translation happens here so
 * that "PROVINCE_CAPTURED p2 DEU-NW" never reaches the player, and so that clicking a
 * line can jump to the place it is about.
 *
 * Names the map does not know — nations for player ids, army names — come from the
 * caller, because only the game state has them. Without them the ids are shown, which
 * is exactly the failure the tests refuse.
 */

/**
 * Fields that name a province, in the order they should be preferred. A march is
 * about where it goes, so the destination wins over the origin — for the sentence and
 * for the jump.
 */
const PROVINCE_FIELDS = ['provinceId', 'targetProvinceId', 'toProvinceId', 'fromProvinceId'] as const

export interface EventNaming {
  /** The nation behind a player id — "p2" is not a name a player knows. */
  player?: (id: string) => string
  /** The name of an army, for lines about marches and losses. */
  army?: (id: string) => string
  /** For turning a tick into a day where a text names one. */
  ticksPerDay?: number
  /**
   * Wer zusieht (T-M15-09, R-DIP-04).
   *
   * Ohne diese Angabe wird jedes Ereignis in der vollen Fassung erzählt — das ist die
   * sichere Richtung für Aufrufer, die keine Sicht haben (Tests, Werkzeuge). Der
   * Unterschied entsteht nur, wenn jemand *benannt* ist und es nicht der Betrachter ist.
   */
  viewer?: string
  /**
   * Die Hauptstadt einer Macht (T-M46-02): der Ort fuer Ereignisse ohne eigene Provinz — der
   * Mangel in der eigenen Wirtschaft, die Kriegserklaerung. Fehlt sie, bleibt die Zeile ohne Ort.
   */
  capital?: (playerId: string) => string | undefined
}

export function provinceOf(event: GameEvent): string | undefined {
  const record = event as unknown as Record<string, unknown>
  for (const field of PROVINCE_FIELDS) {
    const value = record[field]
    if (typeof value === 'string') return value
  }
  return undefined
}

/**
 * Der Ort eines Ereignisses (T-M46-02, VM-03): die Provinz, von der es handelt — und fuer die zwei
 * Arten ohne eigene Provinz die Hauptstadt der Macht, die es betrifft. Der Mangel trifft die eigene
 * Wirtschaft (eigene Hauptstadt); die Kriegserklaerung ist ein Vorgang zwischen zwei Hauptstaedten,
 * und gezeigt wird die der Gegenseite. Ohne Ort bleibt `undefined` (Tagesbericht, Handel).
 */
export function placeOf(event: GameEvent, viewer: string | undefined, capital?: (playerId: string) => string | undefined): string | undefined {
  const own = provinceOf(event)
  if (own) return own
  if (!capital) return undefined
  if (event.type === 'RESOURCE_SHORTAGE') return capital(event.playerId)
  // DIPLOMACY_CHANGED (Frieden, Buendnis, Kuendigung, Kriegsbeginn) hat einen Ton, aber keine Provinz: ohne Ort
  // pulsierte es nicht und liess sich nicht anspringen (Nachbesserung U, Quote hoerbar/Puls+Sprung).
  if (event.type === 'WAR_DECLARED' || event.type === 'DIPLOMACY_CHANGED') {
    const other = viewer === event.playerId ? event.targetPlayerId : event.playerId
    return capital(other) ?? capital(viewer === event.playerId ? event.playerId : event.targetPlayerId)
  }
  return undefined
}

/**
 * Ereignisarten, die nur Buchhaltung des Alltags sind: Ankuenfte und Rueckzuege, Beschuss, volles Lager. Der
 * Abmarsch, der Baubeginn und der Handelsvollzug gehoeren NICHT dazu: sie quittieren, was der Spieler selbst
 * befohlen hat (R-UI-05), und bleiben in der Voreinstellung sichtbar - dort fassen die Sammelzeilen sie zusammen.
 */
const MINOR_TYPES = new Set(['ARMY_ARRIVED', 'ARMY_RETREATED', 'BOMBARDMENT', 'STORAGE_OVERFLOW', 'GAME_STARTED'])

/** Ereignisarten, die auch dann zaehlen, wenn sie den Betrachter nicht selbst betreffen (Weltlage). */
const WORLD_RELEVANT = new Set(['GAME_ENDED', 'PLAYER_ELIMINATED', 'CAPITAL_LOST', 'WAR_DECLARED', 'GOAL_REACHED'])

/**
 * Wie wichtig eine Zeile fuer den Betrachter ist (T-M46-02, VM-03): `major` ist, was seine Aufmerksamkeit
 * jetzt braucht (eigener Alarm, Rueckschlag, Krieg, Ende), `minor` die Alltagsbuchhaltung und alles Fremde,
 * `normal` der Rest (Bau fertig, Gefechtsausgang, Vertraege, Tagesbericht). Rein; gerechnet wird aus Art,
 * Schwere und Betroffenen — die Kernereignisse selbst bleiben unberuehrt.
 */
export function importanceOf(event: GameEvent, viewer: string | undefined): EventImportance {
  const mine = concernsViewer(event, viewer)
  if (!mine) return WORLD_RELEVANT.has(event.type) ? 'normal' : 'minor'
  if (event.type === 'GAME_ENDED') return 'major'
  if (isSelfSetback(event, viewer) || event.type === 'WAR_DECLARED') return 'major'
  if (event.severity === 'alert') return 'major'
  if (MINOR_TYPES.has(event.type)) return 'minor'
  return 'normal'
}

/**
 * The values an event text needs, gathered from the event's own fields.
 *
 * Ids are swapped for names where anyone knows one — a log that says "DEU-NW" or "p2"
 * makes the player look it up, which is exactly the work the log exists to save.
 */
/** Ereignisarten, für die es eine Fassung aus fremder Sicht gibt. */
const FOREIGN_TEXTS = new Set(['DIPLOMACY_CHANGED', 'CAPITAL_LOST', 'BATTLE_RESOLVED', 'WAR_DECLARED'])

function valuesFor(event: GameEvent, map: MapData, naming: EventNaming): Record<string, string | number> {
  const record = event as unknown as Record<string, unknown>
  const provinceName = (id: unknown): string =>
    typeof id === 'string' ? (map.provinces.find((p) => p.id === id)?.name ?? id) : ''
  const playerName = (id: unknown): string =>
    typeof id === 'string' ? (naming.player?.(id) ?? id) : t('events_ui.nobody')

  const values: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'number' || typeof value === 'string') values[key] = value
  }

  const province = provinceOf(event)
  if (province) values.province = provinceName(province)

  const actor = record.newOwner ?? record.playerId
  if (typeof actor === 'string') values.player = playerName(actor)
  // Beim Einmarsch ist der Satzgegenstand der EINDRINGLING, nicht der Besitzer — sonst
  // stuende die Mehrzahlfassung (T-M23-02) an der falschen Macht (T-M28-06).
  if (typeof record.intruderId === 'string') {
    values.intruder = playerName(record.intruderId)
    values.player = values.intruder
    values.owner = playerName(record.playerId)
  }
  if (typeof record.targetPlayerId === 'string') values.target = playerName(record.targetPlayerId)
  if ('victor' in record || 'winner' in record) values.winner = playerName(record.victor ?? record.winner)

  // Die Verluste beider Seiten (T-M14-13, Befund 9). `losses` ist ein Objekt und fiel
  // aus der Schleife oben still heraus, die nur flache Werte übernimmt: der Spieler
  // erfuhr nach einem Gefecht nur, wer das Feld behauptet — nicht, was es gekostet hat.
  // R-BAT-07 verlangt den Bericht seit M4.
  if (record.losses && typeof record.losses === 'object') {
    const parts = Object.entries(record.losses as Record<string, number>)
      .filter(([, value]) => typeof value === 'number' && value > 0)
      .sort(([a], [b]) => a.localeCompare(b, 'de'))
      .map(([id, value]) => `${playerName(id)} ${amount(value)}`)
    values.losses = parts.length > 0 ? parts.join(', ') : t('events_ui.noLosses')
  }

  if (typeof record.resource === 'string') values.resource = t(`resources.${record.resource}`)
  if (typeof record.give === 'string') values.give = t(`resources.${record.give}`)
  if (typeof record.want === 'string') values.want = t(`resources.${record.want}`)
  if (typeof record.giveAmount === 'number') values.giveAmount = amount(record.giveAmount)
  if (typeof record.wantAmount === 'number') values.wantAmount = amount(record.wantAmount)

  if (typeof record.building === 'string') values.building = t(`buildings.${record.building}`)
  if (typeof record.unitKey === 'string') values.unit = t(`units.${record.unitKey}`)
  if (typeof record.armyId === 'string') values.army = naming.army?.(record.armyId) ?? record.armyId
  if (typeof record.newState === 'string') values.state = t(`diplomacy.${record.newState}`)
  if (event.type === 'COMMAND_REJECTED') values.reason = t(`rejections.${String(record.code)}`)
  // Das Zwischenziel mit Namen statt Schluessel (T-M35-04): „pointShareFirst" sagt niemandem etwas.
  if (event.type === 'GOAL_REACHED') values.goal = t(`goals.names.${String(record.goal)}`)

  if (typeof record.effectiveAtTick === 'number') {
    values.day = Math.floor(record.effectiveAtTick / (naming.ticksPerDay ?? 24)) + 1
  }

  // Handelsangebote (T-M17-05): der Grund mit Namen statt Schluessel — „withdrawn" sagt niemandem etwas.
  if (event.type === 'TRADE_OFFER_CLOSED') values.reason = t(`diplomacy.tradeClosed.${String(record.reason)}`)
  if (event.type === 'CONTRACT_CLOSED') values.reason = t(`diplomacy.contractClosed.${String(record.reason)}`)
  // Die Abtretung (T-M17-06): der Vorbesitzer mit Namen — `previousOwner` ist eine Kennung.
  if (event.type === 'PROVINCE_CEDED') values.previous = playerName(record.previousOwner)

  // Spionage (T-M17-08): Auftrag und Ausgang mit Namen statt Schlüssel — „economicSabotage" und
  // „targetChanged" sagen niemandem etwas.
  if (event.type === 'SPY_REPORT' || event.type === 'SPY_LOST') {
    values.mission = t(`espionage.missions.${String(record.mission)}`)
  }
  if (event.type === 'SPY_REPORT') values.outcome = t(`espionage.outcomes.${String(record.outcome)}`)

  // Sabotage und Enttarnung (T-M17-09): der Auftrag mit Namen, die Wirkung als eigener Satzteil. Der
  // Opfersatz bekommt nichts, was das Ereignis nicht trägt — und es trägt keinen Urheber (D29.5).
  if (event.type === 'SPY_DETECTED') values.mission = t(`espionage.missions.${String(record.mission)}`)
  if (event.type === 'SABOTAGE_SUFFERED') values.effect = sabotageEffect(event)

  return values
}

/** Die Wirkung einer erlittenen Sabotage in Worten (T-M17-09) — Mengen formatiert, Rohstoffe mit Namen. */
function sabotageEffect(event: Extract<GameEvent, { type: 'SABOTAGE_SUFFERED' }>): string {
  if (event.kind === 'military') return t('espionage.sabotage.military', { hours: event.delayTicks })
  const parts = Object.entries(event.destroyed)
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .map(([key, value]) => `${amount(value!)} ${t(`resources.${key}`)}`)
  return t('espionage.sabotage.economic', {
    moraleLoss: amount(event.moraleLoss),
    destroyed: parts.length > 0 ? parts.join(', ') : t('espionage.sabotage.nothingDestroyed'),
  })
}

/**
 * Geht dieses Ereignis den Betrachter selbst an (T-M15-09)?
 *
 * Ein Ereignis ohne benannte Betroffene geht alle an — das ist die sichere Richtung: es
 * wird dann in der vollen Fassung erzählt, und die enthält nichts, was nicht ohnehin
 * öffentlich wäre. Umgekehrt wäre gefährlich.
 */
function concernsViewer(event: GameEvent, viewer: string | undefined): boolean {
  if (!viewer) return true
  return event.concerns.length === 0 || event.concerns.includes(viewer)
}

/**
 * Trifft dieses Ereignis den Betrachter **selbst** — als Rückschlag (T-M22-03, V2-07)?
 *
 * Vier Arten, aus dem Entwurf D24.1: eigener Provinzverlust, Aufstand im eigenen Land,
 * die eigene Hauptstadt, das eigene Ausscheiden. Absichtlich eng: der Zinnober-Balken
 * ist nur ein Signal, solange er selten ist. Ein fremder Fall („Vietnam ist gefallen")
 * bleibt gewöhnlich; eine eigene **Eroberung** ist kein Rückschlag und bleibt es auch.
 */
export function isSelfSetback(event: GameEvent, viewer: string | undefined): boolean {
  if (!viewer) return false
  switch (event.type) {
    case 'PROVINCE_CAPTURED':
    case 'PROVINCE_REVOLTED':
      return event.previousOwner === viewer
    // `ARMY_INTRUDED` ist der fuenfte Rueckschlag (T-M28-06): fremde Truppen auf
    // eigenem Boden. `playerId` ist dort der Besitzer der Provinz, nicht der
    // Eindringling — dieselbe Bedeutung wie in den drei Faellen darueber.
    case 'CAPITAL_LOST':
    case 'PLAYER_ELIMINATED':
    case 'ARMY_INTRUDED':
      return event.playerId === viewer
    default:
      return false
  }
}

/**
 * Eine Seite des Kampfberichts, mit Namen statt Kennungen (T-M27-01, R-BAT-05).
 *
 * Die Zahlen bleiben Festkomma — formatiert wird beim Zeichnen, nicht beim Sammeln,
 * damit die Balkenlängen aus denselben Werten entstehen wie die Zahlen daneben.
 */
export interface BattleReportSide {
  playerId: string
  name: string
  /** Stärke in Trefferpunkten vor und nach dem Schlagabtausch (Festkomma). */
  before: number
  after: number
  losses: number
  entrenched: boolean
  attackBlocked: boolean
}

/** Der Anzeigedatensatz eines Gefechts — die Datenquelle der Stärkebalken (D25.6). */
export interface BattleReportData {
  provinceName: string
  terrain: Terrain
  /** Festungsstufe der Provinz; 0 heißt keine. Sie schützt nur den Eigentümer. */
  fortressLevel: number
  /** Wer das Feld behauptet, beim Namen — oder null, wenn niemand. */
  victor: string | null
  sides: BattleReportSide[]
}

/**
 * Das Gefecht sammelt seine Zahlen für die Anzeige (T-M27-01, R-BAT-05, D25.6).
 *
 * Drei Grenzen, jede mit Absicht: ein altes Ereignis ohne die additiven Felder ergibt
 * **keinen** Datensatz — lieber kein Bild als ein erfundenes; ein Unbeteiligter bekommt
 * keine Mengen (R-DIP-04, dieselbe Linie wie die `_FOREIGN`-Textfassung); und der
 * Betrachter steht zuerst, denn es ist sein Bericht.
 */
export function battleReport(
  event: GameEvent,
  map: MapData,
  naming: EventNaming = {},
): BattleReportData | null {
  if (event.type !== 'BATTLE_RESOLVED') return null
  if (!event.strengths || event.terrain === undefined) return null
  if (!concernsViewer(event, naming.viewer)) return null

  const playerName = (id: string): string => naming.player?.(id) ?? id
  const ids = Object.keys(event.strengths).sort((a, b) => a.localeCompare(b, 'de'))
  if (naming.viewer && ids.includes(naming.viewer)) {
    ids.splice(ids.indexOf(naming.viewer), 1)
    ids.unshift(naming.viewer)
  }

  return {
    provinceName: map.provinces.find((p) => p.id === event.provinceId)?.name ?? event.provinceId,
    terrain: event.terrain,
    fortressLevel: event.fortressLevel ?? 0,
    victor: event.victor ? playerName(event.victor) : null,
    sides: ids.map((id) => ({
      playerId: id,
      name: playerName(id),
      before: event.strengths![id]?.before ?? 0,
      after: event.strengths![id]?.after ?? 0,
      losses: event.losses[id] ?? 0,
      entrenched: event.entrenched?.includes(id) ?? false,
      attackBlocked: event.attackBlocked?.includes(id) ?? false,
    })),
  }
}

/**
 * Der Körper des Tagesberichts (T-M24-01, R-TIME-06, R-UI-05, Befund V2-06, D24.4).
 *
 * „Tagesbericht für Tag 8." war eine Überschrift ohne Körper — der wichtigste
 * wiederkehrende Eintrag sagte nichts. Der Körper kommt **nicht** aus einem neuen
 * Kern-Ereignis: die Hülle liest am Tageswechsel den Zustand über die Sicht und formt
 * daraus vier Absätze — Bilanz je Rohstoff (nur die von null verschiedenen), Moral je
 * eigener Provinz mit Richtung, fertige und laufende Aufträge, „morgen neu: X" aus der
 * Freischaltungsachse.
 *
 * Rein und ohne Gedächtnis: Sicht und Regeln hinein, Zeilen heraus. `dayEvents` sind
 * die eigenen Ereignisse des zu Ende gegangenen Tages — nur daraus lässt sich „fertig
 * geworden" ehrlich sagen, denn der Zustand kennt nur, was noch läuft.
 */
/**
 * Die Bilanz je Rohstoff als Daten für die Delta-Balken (T-M25-04, R-UI-05, D25.2).
 *
 * Bis M25 war die Bilanz eine Textzeile im Körper; jetzt zeichnen die Rohstoffzeilen
 * des Berichts **dieselben** Balken wie die Wirtschaftstabelle — dafür braucht das
 * Protokoll die Zahlen, nicht einen Satz. Nur die von null verschiedenen: eine Zeile
 * voller ±0 ist keine Auskunft, sie versteckt die eine Zahl, die eine wäre.
 */
export function dayReportDeltas(view: PublicView): DayReportDelta[] {
  return Object.entries(view.self.economy ?? {})
    .filter(([, flow]) => Math.round(unfix(flow.balance)) !== 0)
    .map(([key, flow]) => ({ label: t(`resources.${key}`), balance: flow.balance }))
}

/**
 * Der Tagesabfluss: wohin die Rohstoffe gehen (T-M28-05, R-UI-05, v1-Befund 15, D26.5).
 *
 * Die Wirtschaftstabelle führte nur den Armeeunterhalt; Bau-, Aushebungs- und
 * Marktkosten erschienen nirgends — seit den Sparklines fiel der Bestand sichtbar,
 * ohne dass eine Spalte sagt warum. Gerechnet wird aus denselben Quellen wie der
 * Tagesbericht (Sicht, Regeln, die eigenen Ereignisse des Tages), je Quelle die
 * ehrlichste, die es gibt:
 *
 * - **Bau** aus den `BUILD_STARTED`-Ereignissen des Tages — sie kennen den Auftrag
 *   auch dann, wenn er am selben Tag fertig wurde (die Warteschlange nicht mehr).
 * - **Aushebung** aus den heute begonnenen Aufträgen der eigenen Warteschlangen —
 *   das Erteilen einer Aushebung hat kein eigenes Ereignis (`UNIT_RECRUITED` kommt
 *   erst bei Fertigstellung, bezahlt wurde beim Erteilen). Eine am selben Tag
 *   erteilte UND fertige Aushebung entgeht dieser Rechnung — benannt, nicht versteckt.
 * - **Markt** aus `TRADE_EXECUTED`: die Abgabe ist Abfluss, der Ertrag keiner.
 *
 * Das Fenster ist der Spieltag bis `view.tick`: `view.tick − ticksPerDay < t ≤ view.tick`
 * — dasselbe Fenster, mit dem die App die Tagesereignisse für den Tagesbericht schneidet.
 */
export function dayExpenses(
  view: PublicView,
  rules: Rules,
  dayEvents: readonly GameEvent[] = [],
): Partial<Record<string, number>> {
  const spent: Record<string, number> = {}
  const add = (cost: Partial<Record<string, number>> | undefined, factor: number): void => {
    for (const [key, value] of Object.entries(cost ?? {})) {
      if (!value) continue
      spent[key] = (spent[key] ?? 0) + value * factor
    }
  }

  for (const event of dayEvents) {
    if (event.type === 'BUILD_STARTED') add(rules.buildings[event.building]?.cost, 1)
    if (event.type === 'TRADE_EXECUTED') {
      spent[event.give] = (spent[event.give] ?? 0) + event.giveAmount
    }
  }

  const ticksPerDay = rules.constants.ticksPerDay
  for (const province of view.provinces) {
    if (province.owner !== view.playerId) continue
    for (const order of province.recruitQueue ?? []) {
      if (order.startedTick <= view.tick - ticksPerDay || order.startedTick > view.tick) continue
      add(rules.units[order.unitKey]?.cost, order.count)
    }
  }

  return spent
}

/**
 * Der offene Einmarsch-Alarm (T-M28-06): der jüngste `ARMY_INTRUDED`, den der Spieler
 * noch nicht quittiert hat — oder `null`.
 *
 * `seenTick` ist ein Tick **dieser** Partie. Liegt er über dem aktuellen, gehört er zu
 * einer anderen: eine neue Partie beginnt wieder bei null, ein geladener Stand springt
 * zurück. Ohne diese Zeile blieb ein Einmarsch an Tag 5 der neuen Partie stumm, weil in
 * der alten schon Tag 30 quittiert war (Durchsicht vom 2026-09-11). Die Oberfläche setzt
 * den Merker beim Partiewechsel zusätzlich zurück; diese Ableitung hält auch dann,
 * wenn jemand das eines Tages vergisst.
 */
export function openIntrusion(
  events: readonly GameEvent[],
  seenTick: number,
  tick: number,
): { provinceId: string; intruderId: string; tick: number } | null {
  const seen = seenTick > tick ? -1 : seenTick
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]!
    if (event.type !== 'ARMY_INTRUDED' || event.tick <= seen) continue
    return { provinceId: event.provinceId, intruderId: event.intruderId, tick: event.tick }
  }
  return null
}

/** Ein Punkt der Preisreihe: der mittlere Kurs eines Spieltags (T-M32-02). */
export interface PricePoint {
  day: number
  /** Geld je Einheit — Festkomma kürzt sich heraus, weil beide Seiten Festkomma sind. */
  price: number
}

/**
 * Der Preisverlauf je Rohstoff aus dem Ereignisstrom (T-M32-02, R-UI-09/13, D27).
 *
 * Einen Kurs hat nur, was gegen **Geld** getauscht wurde: `money → X` ist ein Kauf,
 * `X → money` ein Verkauf, und beide ergeben denselben Wert „Geld je Einheit". Ein
 * Tausch Holz gegen Erz hat zwei Preise oder keinen — er bleibt draußen, statt eine
 * Zahl zu erfinden. Je Spieltag wird gemittelt: der Markt setzt den Kurs je Tick neu,
 * und eine Linie mit einem Punkt je Tick zeigt Rauschen statt Richtung.
 *
 * Kernfrei: `TRADE_EXECUTED` bleibt, wie es ist.
 */
export function priceSeries(
  events: readonly GameEvent[],
  ticksPerDay: number,
): Partial<Record<string, PricePoint[]>> {
  const sums = new Map<string, Map<number, { total: number; count: number }>>()

  for (const event of events) {
    if (event.type !== 'TRADE_EXECUTED') continue
    const kauf = event.give === 'money' && event.want !== 'money'
    const verkauf = event.want === 'money' && event.give !== 'money'
    if (!kauf && !verkauf) continue

    const key = kauf ? event.want : event.give
    const menge = kauf ? event.wantAmount : event.giveAmount
    if (menge <= 0) continue
    const geld = kauf ? event.giveAmount : event.wantAmount

    const day = Math.trunc(event.tick / ticksPerDay)
    const perResource = sums.get(key) ?? new Map<number, { total: number; count: number }>()
    const cell = perResource.get(day) ?? { total: 0, count: 0 }
    cell.total += geld / menge
    cell.count += 1
    perResource.set(day, cell)
    sums.set(key, perResource)
  }

  const out: Partial<Record<string, PricePoint[]>> = {}
  for (const [key, perResource] of sums) {
    out[key] = [...perResource.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, cell]) => ({ day, price: cell.total / cell.count }))
  }
  return out
}

export function dayReportBody(
  view: PublicView,
  rules: Rules,
  dayEvents: readonly GameEvent[] = [],
): string[] {
  const lines: string[] = []
  const ticksPerDay = rules.constants.ticksPerDay

  // Moral je eigener Provinz, mit Richtung: der Stand allein sagt nicht, ob eine
  // Provinz zur Ruhe kommt oder kippt — genau das will der Spieler wissen.
  const own = view.provinces.filter(
    (province) => province.owner === view.playerId && province.morale !== undefined,
  )
  const morale = own.map((province) => {
    const current = province.morale!
    const target = province.moraleTarget ?? current
    const key =
      target - current > 500 ? 'moraleRising' : current - target > 500 ? 'moraleFalling' : 'moraleSteady'
    return t(`dayReport.${key}`, { province: province.name, percent: Math.round(unfix(current)) })
  })
  if (morale.length > 0) lines.push(t('dayReport.morale', { list: morale.join(', ') }))

  const provinceName = (id: unknown): string =>
    view.provinces.find((province) => province.id === id)?.name ?? String(id ?? '')

  // Fertig geworden: aus den Ereignissen des Tages — der Zustand kennt nur, was läuft.
  const done: string[] = []
  for (const event of dayEvents) {
    const record = event as unknown as Record<string, unknown>
    if (event.type === 'BUILD_COMPLETED') {
      done.push(
        t('dayReport.completedEntry', {
          thing: t(`buildings.${String(record.building)}`),
          province: provinceName(record.provinceId),
        }),
      )
    }
    if (event.type === 'UNIT_RECRUITED') {
      done.push(
        t('dayReport.completedEntry', {
          thing: t('army.unitCount', { count: Number(record.count), unit: t(`units.${String(record.unitKey)}`) }),
          province: provinceName(record.provinceId),
        }),
      )
    }
  }
  if (done.length > 0) lines.push(t('dayReport.completed', { list: done.join(', ') }))

  // In Arbeit: die Warteschlangen der eigenen Provinzen, jede mit ihrem Fertigtag.
  const running: string[] = []
  for (const province of own) {
    for (const order of province.buildQueue ?? []) {
      running.push(
        t('dayReport.orderEntry', {
          thing: t(`buildings.${order.building}`),
          province: province.name,
          day: Math.floor(order.completesAtTick / ticksPerDay) + 1,
        }),
      )
    }
    for (const order of province.recruitQueue ?? []) {
      running.push(
        t('dayReport.orderEntry', {
          thing: t('army.unitCount', { count: order.count, unit: t(`units.${order.unitKey}`) }),
          province: province.name,
          day: Math.floor(order.completesAtTick / ticksPerDay) + 1,
        }),
      )
    }
  }
  if (running.length > 0) lines.push(t('dayReport.running', { list: running.join(', ') }))

  // Morgen neu: die Freischaltungsachse einen Tag voraus. Heute ist der Tag, der am
  // Tick der Sicht angebrochen ist — der Bericht entsteht am Tageswechsel.
  const tomorrow = Math.floor(view.tick / ticksPerDay) + 2
  const unlocks = [
    ...Object.entries(rules.buildings)
      .filter(([, rule]) => rule.availableFromDay === tomorrow)
      .map(([key]) => t(`buildings.${key}`)),
    ...Object.entries(rules.units)
      .filter(([, rule]) => rule.availableFromDay === tomorrow)
      .map(([key]) => t(`units.${key}`)),
  ]
  if (unlocks.length > 0) lines.push(t('dayReport.tomorrow', { list: unlocks.join(', ') }))

  // Ein leerer Bericht wäre wieder die Überschrift ohne Körper — dann lieber der eine
  // ehrliche Satz, dass nichts zu berichten ist. „Leer" heißt seit T-M25-04: auch die
  // Bilanzbalken (dayReportDeltas) hätten nichts zu zeigen — solange sie sprechen,
  // bleibt die Textfassung einfach leer statt fälschlich still.
  if (lines.length > 0) return lines
  return dayReportDeltas(view).length > 0 ? [] : [t('dayReport.quiet')]
}

/**
 * Die leisen Zeilen der Automatik im Protokoll (T-M40-13, Befund M3 der Durchsicht von M40).
 *
 * Aus den Befehlen, die `commandsForTick` der Automatik zuschreibt, nicht aus einem Ereignis des Kerns:
 * Rubrik Kampf, Sprung auf das Ziel, keine Alarmfarbe. Nur Märsche ergeben eine Zeile.
 *
 * Die Kennung ist zugleich der React-Schlüssel und hängt am Marsch, nicht am Listenplatz (Nachtrag
 * T-M40-12, N-4): `App.tsx` hält höchstens 40 Märsche, und fiel vorn einer heraus, rückte bis dahin jede
 * Kennung um eins. Die Automatik gibt je Tick höchstens einen Befehl je Armee.
 */
export function adjutantMarchEntries(
  marches: readonly { tick: number; command: Command }[],
  naming: { army: (armyId: string) => string; province: (provinceId: string) => string },
): EventEntry[] {
  return marches.flatMap(({ tick, command }) =>
    command.type === 'MOVE_ARMY'
      ? [
          {
            id: `${tick}-ADJUTANT_MARCH-${command.armyId}-${command.targetProvinceId}`,
            tick,
            text: t('events_ui.adjutantMarch', {
              army: naming.army(command.armyId),
              province: naming.province(command.targetProvinceId),
            }),
            provinceId: command.targetProvinceId,
            symbol: 'march' as const,
            short: naming.province(command.targetProvinceId),
            severity: 'info' as const,
            category: 'combat' as const,
            // Leise Zeile der Automatik (T-M46-02): kein Alarm, aber eine Quittung - sie bleibt in der Voreinstellung.
            type: 'ADJUTANT_MARCH',
            importance: 'normal' as const,
          },
        ]
      : [],
  )
}

/**
 * Gleichlautende Gefechtszeilen werden eine Zeile mit Anzahl (T-M44-10, R-UX-02/AK4, Befund B-20).
 *
 * Aufnahme vom 2026-10-03: „Myanmar: Gefecht entschieden — niemand behauptet das Feld." stand
 * Stunde um Stunde mehrfach untereinander. Zusammengefasst wird eine **Folge** von Zeilen, die Wort
 * für Wort gleich sind, in derselben Provinz, am selben Spieltag und in der Rubrik Kampf (die
 * Messung des Werkzeugs zählt genau solche Nachbarn). Gleiche Stunde ist darin enthalten; eine
 * Zeile dazwischen, die etwas anderes sagt, trennt die Folge — die Reihenfolge der Ereignisse
 * bleibt lesbar. Die Sammelzeile steht, wo die erste (jüngste) stand, behält deren Kennung und
 * Stunde und nennt die Anzahl. Das Protokoll des Kerns bleibt unberührt — gemischt wird nur, was
 * gezeigt wird.
 */
export function mergeBattleLines(entries: readonly EventEntry[], ticksPerDay = 24): EventEntry[] {
  const perDay = Math.max(1, ticksPerDay)
  const merged: EventEntry[] = []
  const counts: number[] = []
  const sameRun = (a: EventEntry, b: EventEntry): boolean =>
    a.category === 'combat' &&
    b.category === 'combat' &&
    a.text === b.text &&
    (a.provinceId ?? '') === (b.provinceId ?? '') &&
    Math.floor(a.tick / perDay) === Math.floor(b.tick / perDay)
  for (const entry of entries) {
    const last = merged[merged.length - 1]
    if (last && sameRun(last, entry)) {
      counts[counts.length - 1] = (counts[counts.length - 1] ?? 1) + 1
    } else {
      merged.push(entry)
      counts.push(1)
    }
  }
  return merged.map((entry, i) =>
    (counts[i] ?? 1) > 1 ? { ...entry, text: t('events_ui.repeated', { text: entry.text, count: counts[i] ?? 1 }), count: counts[i] ?? 1 } : entry,
  )
}

/**
 * Das Zeichen und das Kurzwort einer Protokollzeile (T-M46-17, VM-05): die Zeile soll mit dem Auge gelesen
 * werden, nicht mit dem Satz. Das Zeichen sagt, WAS geschah (Bau, Marsch, Gefecht, Handel, Vertrag ...), das
 * Kurzwort WO oder MIT WEM (Provinz, Macht). Der ganze Satz bleibt `text` - Tooltip und Name fuers Ohr.
 */
export function eventSymbol(
  event: GameEvent,
  values: Record<string, string | number>,
  placeName: string | undefined,
): { symbol: PictureName; short?: string } {
  const record = event as unknown as Record<string, unknown>
  const str = (key: string): string | undefined => (typeof record[key] === 'string' ? (record[key] as string) : undefined)
  const withShort = (symbol: PictureName, short: string | undefined) => (short ? { symbol, short } : { symbol })
  const nation = typeof values.target === 'string' ? values.target : typeof values.player === 'string' ? values.player : undefined
  switch (event.type) {
    case 'BUILD_STARTED':
    case 'BUILD_COMPLETED':
    case 'BUILD_CANCELLED':
      return withShort(BUILDING_ICONS[str('building') ?? ''] ?? 'build', placeName)
    case 'UNIT_RECRUITED':
      return withShort(UNIT_ICONS[str('unitKey') ?? ''] ?? 'infantry', placeName)
    case 'ARMY_DEPARTED':
      return withShort('march', placeName)
    case 'ARMY_ARRIVED':
    case 'ARMY_RETREATED':
      return withShort('place', placeName)
    case 'ARMY_INTRUDED':
    case 'PROVINCE_REVOLTED':
      return withShort('warning', placeName)
    case 'ARMY_DESTROYED':
    case 'BATTLE_STARTED':
    case 'BATTLE_RESOLVED':
      return withShort('battle', placeName)
    case 'BOMBARDMENT':
      return withShort('bombard', placeName)
    case 'PROVINCE_CAPTURED':
    case 'PROVINCE_CEDED':
      return withShort('place', placeName)
    case 'RESOURCE_SHORTAGE':
    case 'STORAGE_OVERFLOW':
      return { symbol: RESOURCE_ICONS[str('resource') ?? ''] ?? 'warning' }
    case 'TRADE_EXECUTED':
    case 'TRADE_OFFER_CLOSED':
    case 'CONTRACT_CLOSED':
    case 'TRADE_AGREED':
      return { symbol: 'trade' }
    case 'WAR_DECLARED':
      return withShort(RELATION_ICONS.war, nation)
    case 'DIPLOMACY_CHANGED':
      return withShort(RELATION_ICONS[(str('newState') ?? 'peace') as keyof typeof RELATION_ICONS] ?? 'peace', nation)
    case 'RIGHT_OF_WAY_CHANGED':
      return withShort(RELATION_ICONS.rightOfWay, nation)
    case 'CAPITAL_LOST':
    case 'CAPITAL_MOVED':
      return withShort('capital', placeName)
    case 'PLAYER_ELIMINATED':
      return withShort('warning', nation)
    case 'GAME_ENDED':
    case 'GOAL_REACHED':
      return { symbol: 'trophy' }
    case 'DAY_REPORT':
      return { symbol: 'dispatch' }
    case 'SABOTAGE_SUFFERED':
      return withShort(record.kind === 'economic' ? 'spyEconomic' : 'spyMilitary', placeName)
    case 'SPY_DETECTED':
    case 'SPY_REPORT':
    case 'SPY_LOST': {
      const mission = str('mission') as keyof typeof SPY_MISSION_ICONS | undefined
      return withShort((mission && SPY_MISSION_ICONS[mission]) || 'espionage', placeName)
    }
    case 'COMMAND_REJECTED':
      return { symbol: 'warning' }
    case 'GAME_STARTED':
      return { symbol: 'capital' }
    default:
      return withShort('info', placeName)
  }
}

export function describeEvent(event: GameEvent, index: number, map: MapData, naming: EventNaming = {}): EventEntry {
  const place = placeOf(event, naming.viewer, naming.capital)

  // Aus fremder Sicht: eine kürzere Fassung ohne Mengen, wo es eine gibt (R-DIP-04).
  // Die Auswahl steht hier und nicht im Filter — sonst läge die Geheimhaltung an zwei
  // Stellen, und eine davon würde eines Tages vergessen.
  const fremd = !concernsViewer(event, naming.viewer)
  let key = fremd && FOREIGN_TEXTS.has(event.type) ? `${event.type}_FOREIGN` : event.type
  // Die Kündigung des Durchmarschs ist dieselbe Ereignisart wie die Gewährung (T-M17-04, D29.5),
  // nur mit `granted: false` — ein eigener Satz am selben Stamm, nach der Konvention der Endungen.
  if (event.type === 'RIGHT_OF_WAY_CHANGED' && !event.granted) key = `${key}_REVOKED`

  const values = valuesFor(event, map, naming)

  // Der Numerus des Satzgegenstands (T-M23-02, V2-11): trägt der Satz eine
  // Mehrzahl-Macht als Subjekt und kennt der Katalog eine Mehrzahlfassung, wird sie
  // gewählt — „Vereinigte Staaten erklären", nicht „erklärt". Die Konvention ist die
  // der `_FOREIGN`-Fassungen: ein Suffix am selben Stamm, keine zweite Zuordnung.
  const subject = event.type === 'GAME_ENDED' ? values.winner : values.player
  if (typeof subject === 'string' && isPluralNation(subject) && hasKey(`events.${key}_PLURAL`)) {
    key = `${key}_PLURAL`
  }

  // Das Gefecht trägt seinen Anzeigedatensatz (T-M27-02, D25.6): die Zeile bleibt die
  // Überschrift, der Körper zeichnet die Stärkebalken daraus. Ohne die additiven
  // Felder (alter Spielstand) oder aus fremder Sicht entsteht keiner — die Zeile
  // bleibt dann, was sie war.
  const battle = battleReport(event, map, naming)

  return {
    id: `${event.tick}-${event.type}-${index}`,
    tick: event.tick,
    category: categoryOf(event.type),
    world: isWorldEventType(event.type),
    // Was mich selbst trifft, sieht anders aus (T-M22-03): die Zeile bekommt im
    // Protokoll den Zinnober-Balken und Fettung.
    self: isSelfSetback(event, naming.viewer),
    text: t(`events.${key}`, values),
    type: event.type,
    importance: importanceOf(event, naming.viewer),
    // Ein hoerbares Ereignis (es hat einen Ton, `cueFor`) betrifft den Betrachter selbst: nur seine Toene spielen.
    ...(cueFor(event.type) && concernsViewer(event, naming.viewer) ? { audible: true } : {}),
    ...(place ? { provinceId: place } : {}),
    ...(battle ? { battle } : {}),
    ...eventSymbol(event, values, place ? map.provinces.find((p) => p.id === place)?.name : undefined),
    severity: event.severity === 'alert' ? 'alert' : 'info',
  }
}

/** Ereignisarten, die nie zu einer Sammelzeile werden: jede steht fuer sich (Bericht, Krieg, Vertrag, Ende). */
const SOLO_TYPES = new Set([
  'DAY_REPORT',
  'GAME_ENDED',
  'WAR_DECLARED',
  'DIPLOMACY_CHANGED',
  'CAPITAL_LOST',
  'PLAYER_ELIMINATED',
  'GOAL_REACHED',
  'COMMAND_REJECTED',
])

const IMPORTANCE_RANK: Record<EventImportance, number> = { minor: 0, normal: 1, major: 2 }

/**
 * Sammelzeilen (T-M46-02, VM-03): mehrere Zeilen derselben Art am selben Spieltag werden **eine** — der Text
 * der juengsten mit „+n weitere", dahinter die Teile, jeder mit seinem Sprung. Gemessen an S575G: 35 Zeilen
 * an einem Spieltag, vor allem Beschuss, Armeewege und Einmaersche in langen Reihen. Die Sammelzeile steht,
 * wo die juengste stand (die Liste ist neueste zuerst), behaelt deren Kennung mit Anhang und nimmt die
 * Wichtigkeit des wichtigsten Teils. Zeilen ohne Art (Tests, Werkzeuge) und die Solo-Arten bleiben, was sie
 * waren. Das Protokoll des Kerns bleibt unberuehrt — gemischt wird nur, was gezeigt wird.
 */
export function groupEntries(entries: readonly EventEntry[], ticksPerDay = 24): EventEntry[] {
  const perDay = Math.max(1, ticksPerDay)
  const keyOf = (entry: EventEntry): string | null =>
    entry.type && !SOLO_TYPES.has(entry.type) ? `${Math.floor(entry.tick / perDay)}|${entry.type}` : null
  const members = new Map<string, EventEntry[]>()
  for (const entry of entries) {
    const key = keyOf(entry)
    if (key) members.set(key, [...(members.get(key) ?? []), entry])
  }
  const emitted = new Set<string>()
  const result: EventEntry[] = []
  for (const entry of entries) {
    const key = keyOf(entry)
    const group = key ? members.get(key) : undefined
    if (!key || !group || group.length < 2) {
      result.push(entry)
      continue
    }
    if (emitted.has(key)) continue
    emitted.add(key)
    const first = group[0]!
    const importance = group.reduce<EventImportance>(
      (best, member) => (IMPORTANCE_RANK[member.importance ?? 'normal'] > IMPORTANCE_RANK[best] ? (member.importance ?? 'normal') : best),
      'minor',
    )
    // Eine Sammelzeile traegt keinen Gefechts-, Tages- oder Bilanzkoerper des juengsten Teils: ihr Koerper sind die Teile.
    const rest: EventEntry = { ...first }
    delete rest.battle
    delete rest.body
    delete rest.deltas
    result.push({
      ...rest,
      id: `${first.id}+${group.length}`,
      text: t('events_ui.group', { text: first.text, more: group.length - 1 }),
      importance,
      count: group.length,
      severity: group.some((member) => member.severity === 'alert') ? 'alert' : first.severity,
      ...(group.some((member) => member.self) ? { self: true } : {}),
      ...(group.some((member) => member.audible) ? { audible: true } : {}),
      parts: group.map((member) => ({
        id: member.id,
        tick: member.tick,
        text: member.text,
        ...(member.provinceId ? { provinceId: member.provinceId } : {}),
      })),
    })
  }
  return result
}

/** Ein Puls auf der Karte (T-M46-02): wo etwas Hoerbares geschah, wann (Tick) und wie dringend. */
export interface MapPing {
  id: string
  provinceId: string
  tick: number
  tone: 'alert' | 'good' | 'info'
}

/**
 * Die Pulse der hoerbaren Ereignisse (T-M46-02, VM-03): jedes Ereignis, das einen Ton hat und den Betrachter
 * betrifft, pulsiert an seinem Ort — dieselbe Auswahl wie der Ton (`cueForOwnEvents`), aber ohne die Regel
 * „hoechstens ein Ton je Tick": der Ton kann nur einen Ort nennen, die Karte nennt alle. Je Ort und Tick
 * hoechstens einer, damit ein Einmarsch in drei Armeen nicht dreifach pulsiert.
 */
export function pingsFor(
  events: readonly GameEvent[],
  viewer: string,
  capital?: (playerId: string) => string | undefined,
): MapPing[] {
  const seen = new Set<string>()
  const pings: MapPing[] = []
  for (const event of events) {
    if (!cueFor(event.type) || !event.concerns.includes(viewer)) continue
    const place = placeOf(event, viewer, capital)
    if (!place) continue
    const key = `${event.tick}|${place}`
    if (seen.has(key)) continue
    seen.add(key)
    pings.push({
      id: `${event.tick}-${event.type}-${place}`,
      provinceId: place,
      tick: event.tick,
      tone: event.severity === 'alert' ? 'alert' : event.type === 'BUILD_COMPLETED' || event.type === 'UNIT_RECRUITED' ? 'good' : 'info',
    })
  }
  return pings
}
