import type { GameEvent, MapData, PublicView, Rules, Terrain } from '@worldwar/core'
import { isPluralNation } from '../i18n/grammar.ts'
import { hasKey, t } from '../i18n/text.ts'
import { amount, unfix } from '../ui/format.ts'
import { isWorldEventType } from '@worldwar/core'
import { categoryOf, type DayReportDelta, type EventEntry } from '../ui/Panels.tsx'

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

  if (typeof record.effectiveAtTick === 'number') {
    values.day = Math.floor(record.effectiveAtTick / (naming.ticksPerDay ?? 24)) + 1
  }

  return values
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
    case 'CAPITAL_LOST':
    case 'PLAYER_ELIMINATED':
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

export function describeEvent(event: GameEvent, index: number, map: MapData, naming: EventNaming = {}): EventEntry {
  const province = provinceOf(event)

  // Aus fremder Sicht: eine kürzere Fassung ohne Mengen, wo es eine gibt (R-DIP-04).
  // Die Auswahl steht hier und nicht im Filter — sonst läge die Geheimhaltung an zwei
  // Stellen, und eine davon würde eines Tages vergessen.
  const fremd = !concernsViewer(event, naming.viewer)
  let key = fremd && FOREIGN_TEXTS.has(event.type) ? `${event.type}_FOREIGN` : event.type

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
    ...(province ? { provinceId: province } : {}),
    ...(battle ? { battle } : {}),
    severity: event.severity === 'alert' ? 'alert' : 'info',
  }
}
