import type { GameEvent, PublicView } from '@worldwar/core'
import { accusativePronoun, indefiniteArticle, noneOf } from '../i18n/grammar.ts'
import { t } from '../i18n/text.ts'
import {
  BUILDING_ICONS,
  Icon,
  RELATION_ICONS,
  RESOURCE_ICONS,
  SPY_MISSION_ICONS,
  UNIT_ICONS,
  type IconName,
} from './icons.tsx'

/**
 * What needs looking at, right now (T-M13-13, R-UI-14).
 *
 * The event log says what happened, in order, for ever. That is the wrong instrument
 * for "there is fighting in my country": by the time the fifth build has finished, the
 * battle has scrolled away. This is the other instrument — a short list of *current*
 * conditions, each with a place to jump to.
 *
 * Derived from the view rather than from the log, and that is what keeps it quiet: a
 * battle produces one entry for as long as it lasts, not one per tick. The identity of
 * an alert is its cause, so the same cause is the same alert.
 *
 * **Eine Ausnahme (T-M17-13, R-SPY-06/AK2, E3):** Spionage-Meldungen sind Zustaende,
 * keine Ereignisse — sagt der Absatz oben, und der Kern kennt tatsaechlich keinen
 * Zustand "erlittene Sabotage". `espionageAlerts`/`collectEspionageNews` lesen deshalb
 * `state.eventLog` und behalten, was sie fanden, bis der Spieler es wegklickt: der Ring
 * haelt nur 500 Ereignisse fuer alle Maechte zusammen, und eine Sabotage, die bei hohem
 * Tempo nach wenigen Spieltagen aus ihm faellt, waere sonst ungesehen verschwunden.
 */

export type AlertKind =
  | 'battle'
  | 'overrun'
  | 'shortage'
  | 'unrest'
  | 'capital'
  | 'completion'
  | 'unlock'
  | 'upcoming'
  /** Erlittene Sabotage — laut (R-SPY-06/AK2, T-M17-13). */
  | 'sabotage'
  /** Enttarnung, Verlust, verfehltes Ziel — leise (T-M17-13). */
  | 'espionage'
  /** Ein eingehendes Angebot — Handel oder Antrag, leise (T-M17-14, R-DIP-07/AK1, E4). */
  | 'offer'

export interface Alert {
  /** Stable across ticks: the same cause is the same alert. */
  id: string
  kind: AlertKind
  icon: IconName
  text: string
  provinceId?: string
  /** Sprung in die Diplomatie statt auf die Karte, mit der Macht des Angebots (T-M17-14, E3). */
  diplomacyWith?: string
}

/**
 * Wohin eine Meldung springt (T-M17-14, E3): auf die Karte oder in die Diplomatie, zu einer
 * bestimmten Macht. `Foot`/`EventLog` kennen weiterhin nur Provinzen (Korrektur am Planungsstand:
 * ihre Eintraege tragen keine Macht, nur `Alerts` bekommt dieses Sprungziel).
 */
export type JumpTarget = { kind: 'province'; provinceId: string } | { kind: 'diplomacy'; playerId: string | null }

/** Below this morale a province is at risk of revolt (D6: Aufstandsrisiko ab 33). */
export const UNREST_MORALE = 33_000

/**
 * Wie lange eine Fertigstellung gemeldet bleibt.
 *
 * Eine Meldung, die nur in dem einen Tick steht, in dem der Bau fertig wird, sieht bei
 * hoher Geschwindigkeit niemand. Ein halber Spieltag ist lang genug, um gelesen zu
 * werden, und kurz genug, dass die Liste nicht zulaeuft.
 */
export const COMPLETION_ALERT_TICKS = 12

/** Wie viele Spieltage vorher sich eine Freischaltung ankuendigt (T-M41-03). */
export const UPCOMING_LEAD_DAYS = 2

function justFinished(completesAtTick: number, tick: number): boolean {
  return completesAtTick <= tick && tick - completesAtTick < COMPLETION_ALERT_TICKS
}

/**
 * Was heute neu dazugekommen ist (T-M21-04, R-TECH-02).
 *
 * Das Rueckgrat hatte das Spiel laengst: `availableFromDay` schaltet siebzehn Sachen ueber
 * sechzehn Spieltage frei — Hafen an Tag 2, Fabrik an Tag 8, Raketenartillerie an Tag 16.
 * Gesagt hat es das nie. Wer nicht von sich aus jeden Tag die Bauliste durchsah, erfuhr
 * von der Werft, wenn er sie zufaellig brauchte.
 *
 * Gemeldet wird aus den **Regeln**, nicht aus einem Ereignis: der Kern kennt keine
 * Freischaltung als Vorgang, sie ist bloss ein Vergleich zweier Zahlen. Die Oberflaeche
 * kann denselben Vergleich anstellen, und das ist billiger als ein Ereignis, das der Kern
 * fuehren, speichern und wiederherstellen muesste.
 */
function unlockAlerts(view: PublicView, rules: UnlockRules): Alert[] {
  const perDay = rules.constants.ticksPerDay
  // Den ganzen Spieltag (T-M41-12). Bis dahin nur in den ersten 12 Stunden, so lange wie eine
  // Fertigstellung: bei Tempo 100 etwa 0,12 s, und ein Vorspulen von 14:00 bis 14:00 am
  // naechsten Tag sprang darueber. Wegklicken kann der Spieler sie selbst (`Alerts`).
  const today = Math.floor(view.tick / perDay) + 1
  const alerts: Alert[] = []

  for (const [key, rule] of Object.entries(rules.buildings)) {
    if (rule.availableFromDay !== today) continue
    alerts.push({
      id: `unlock:building:${key}`,
      kind: 'unlock',
      icon: BUILDING_ICONS[key] ?? 'barracks',
      // Das Pronomen richtet sich nach dem Genus der Sache (T-M23-02, V2-11).
      text: t('alerts.unlockBuilding', {
        building: t(`buildings.${key}`),
        pronoun: accusativePronoun('buildings', key),
      }),
    })
  }
  for (const [key, rule] of Object.entries(rules.units)) {
    if (rule.availableFromDay !== today) continue
    alerts.push({
      id: `unlock:unit:${key}`,
      kind: 'unlock',
      icon: UNIT_ICONS[key] ?? 'infantry',
      text: t('alerts.unlockUnit', {
        unit: t(`units.${key}`),
        pronoun: accusativePronoun('units', key),
      }),
    })
  }
  return alerts
}

/**
 * Was in zwei Tagen kommt — und was dafuer fehlt (T-M41-03, R-TECH-02).
 *
 * Nach M34 hatte die Eroeffnung zwei Pausen von vier Spieltagen ohne jeden Anlass. Die
 * Freischaltungstage bleiben (DECISIONS.md, 2026-09-13: Ankuendigung statt
 * Datenaenderung); stattdessen sagt das Spiel zwei Tage vorher, was kommt. Eine blosse
 * Vorschau waere Kosmetik — deshalb nennt die Ankuendigung die Voraussetzung, die dem
 * Spieler fehlt, und schweigt davon, sobald sie steht. Aus Warten wird eine Handlung.
 *
 * Abgeleitet wie die Freischaltung: aus den Regeln und der eigenen Sicht, den ganzen
 * Spieltag lang (seit T-M41-12; vorher nur zu Tagesbeginn), ohne Ereignis. Leise — kein Alarm, keine Farbe, kein Sprung auf die Karte (M36: laut
 * ist nur, was knapp oder umkaempft ist).
 */
function upcomingAlerts(view: PublicView, rules: UnlockRules): Alert[] {
  const perDay = rules.constants.ticksPerDay
  // Den ganzen Spieltag, wie die Freischaltung (T-M41-12).
  const day = Math.floor(view.tick / perDay) + 1 + UPCOMING_LEAD_DAYS
  const own = view.provinces.filter((province) => province.owner === view.playerId)
  const bestLevel = (building: string): number =>
    own.reduce((best, province) => Math.max(best, province.buildings?.[building as never] ?? 0), 0)
  const hasCoast = own.some((province) => province.coastal)

  const text = (kind: 'buildings' | 'units', key: string, rule: Prerequisites): string => {
    const thing = t(`${kind}.${key}`)
    // "Dafuer braucht es …" statt "Sie braucht … — Sie haben keine" (Nacharbeit T-M41-03,
    // Durchsicht N6): das Pronomen der Sache und die Anrede des Spielers waren dasselbe Wort.
    if (rule.requiresCoastal && !hasCoast) return t('alerts.upcomingNeedsCoast', { thing })

    const required = rule.requiresBuilding
    const level = rule.requiresBuildingLevel ?? 1
    const have = required ? bestLevel(required) : 0
    if (!required || have >= level) return t('alerts.upcoming', { thing })

    const needs = {
      thing,
      article: indefiniteArticle('buildings', required),
      required: t(`buildings.${required}`),
      none: noneOf('buildings', required),
    }
    // Nacharbeit T-M41-03 (Durchsicht M1): steht das Gebaeude schon auf einer niedrigeren
    // Stufe, hat der Spieler eines — "Sie haben keine" waere falsch. Genannt wird dann die
    // beste vorhandene Stufe.
    if (have > 0) return t('alerts.upcomingNeedsHigherLevel', { ...needs, level, have })
    return level > 1 ? t('alerts.upcomingNeedsLevel', { ...needs, level }) : t('alerts.upcomingNeeds', needs)
  }

  const alerts: Alert[] = []
  for (const [key, rule] of Object.entries(rules.buildings)) {
    if (rule.availableFromDay !== day) continue
    alerts.push({
      id: `upcoming:building:${key}`,
      kind: 'upcoming',
      icon: BUILDING_ICONS[key] ?? 'barracks',
      text: text('buildings', key, rule),
    })
  }
  for (const [key, rule] of Object.entries(rules.units)) {
    if (rule.availableFromDay !== day) continue
    alerts.push({
      id: `upcoming:unit:${key}`,
      kind: 'upcoming',
      icon: UNIT_ICONS[key] ?? 'infantry',
      text: text('units', key, rule),
    })
  }
  return alerts
}

/** Was eine Sache voraussetzt — so viel, wie die Ankuendigung nennen kann. */
interface Prerequisites {
  requiresBuilding?: string
  requiresBuildingLevel?: number
  requiresCoastal?: boolean
}

/** Genau so viel von den Regeln, wie Freischaltung und Ankuendigung brauchen. */
export interface UnlockRules {
  constants: { ticksPerDay: number }
  buildings: Record<string, { availableFromDay: number } & Prerequisites>
  units: Record<string, { availableFromDay: number } & Prerequisites>
}

/**
 * Ein eingehendes Angebot meldet sich (T-M17-14, R-DIP-07/AK1, E4): Handel UND die drei
 * diplomatischen Arten (Frieden, Buendnis, Durchmarsch-Antrag). Leise (M36), nicht wegklickbar
 * (sie enden mit Antwort oder Verfall) — kein Filter auf `kind === 'rightOfWay'` (kippbar, E4).
 */
function offerAlerts(view: PublicView): Alert[] {
  const nationOf = (id: string): string => view.others.find((other) => other.id === id)?.nation ?? t('trade.unknownPower')

  const trade: Alert[] = view.tradeOffers.incoming.map((offer) => ({
    id: `offer:trade:${offer.id}`,
    kind: 'offer',
    icon: 'trade',
    text: t('alerts.tradeOffer', { nation: nationOf(offer.from) }),
    diplomacyWith: offer.from,
  }))

  const diplomatic: Alert[] = view.incomingOffers.map((offer) => ({
    id: `offer:${offer.kind}:${offer.from}`,
    kind: 'offer',
    icon: RELATION_ICONS[offer.kind],
    text: t(`alerts.offer.${offer.kind}`, { nation: nationOf(offer.from) }),
    diplomacyWith: offer.from,
  }))

  return [...trade, ...diplomatic]
}

export function alertsFor(view: PublicView | null, rules?: UnlockRules, news: readonly Alert[] = []): Alert[] {
  if (!view) return []
  const alerts: Alert[] = []
  const own = new Set(view.provinces.filter((province) => province.owner === view.playerId).map((p) => p.id))
  const nameOf = (id: string): string => view.provinces.find((province) => province.id === id)?.name ?? id

  // Fighting in the player's own country. Fighting elsewhere is news, not an alarm.
  for (const battle of view.battles ?? []) {
    if (!own.has(battle.provinceId)) continue
    alerts.push({
      id: `battle:${battle.provinceId}`,
      kind: 'battle',
      icon: 'battle',
      text: t('alerts.battle', { province: nameOf(battle.provinceId) }),
      provinceId: battle.provinceId,
    })
  }

  // Ueberrannt (T-M12-09): eine unverteidigte Provinz wechselt ohne einen Schuss den
  // Besitzer — `occupation` genuegt die blosse Anwesenheit. Es entsteht kein Gefecht,
  // also sagte die Kampfmeldung nichts, und genau das hat der Playtest erlebt: die
  // Hauptstadt weg, das Ausscheiden wortlos. Eigene Provinzen sind immer sichtbar, die
  // fremde Armee darauf steht also in der Sicht.
  const contested = new Set((view.battles ?? []).map((battle) => battle.provinceId))
  for (const army of view.armies ?? []) {
    if (army.owner === view.playerId) continue
    if (!own.has(army.provinceId) || contested.has(army.provinceId)) continue
    contested.add(army.provinceId)
    alerts.push({
      id: `overrun:${army.provinceId}`,
      kind: 'overrun',
      icon: 'warning',
      text: t('alerts.overrun', { province: nameOf(army.provinceId) }),
      provinceId: army.provinceId,
    })
  }

  // A capital that has fallen outranks everything else the player could be doing.
  //
  // Gefragt wird nach `capitalLostUntil`, nicht nach der Kennung (T-M12-09): `occupation`
  // setzt `capitalProvinceId` im selben Tick auf null, in dem die Hauptstadt faellt, und
  // die alte Bedingung war damit fuer den Fall, fuer den sie geschrieben wurde, tot.
  const capitalLost = view.self.capitalLostUntil !== null && view.tick < view.self.capitalLostUntil
  // Der zweite Weg bleibt: bei einem Aufstand faellt der Eigentuemer weg und die
  // Kennung bleibt stehen — dort ist die alte Bedingung die richtige.
  const capitalRevolted = view.self.capitalProvinceId !== null && !own.has(view.self.capitalProvinceId)
  if (capitalLost || capitalRevolted) {
    alerts.push({
      id: 'capital:lost',
      kind: 'capital',
      icon: 'capital',
      text: t('alerts.capitalLost'),
      ...(view.self.capitalProvinceId ? { provinceId: view.self.capitalProvinceId } : {}),
    })
  }

  for (const resource of view.self.shortages) {
    alerts.push({
      id: `shortage:${resource}`,
      kind: 'shortage',
      icon: RESOURCE_ICONS[resource] ?? 'warning',
      text: t('alerts.shortage', { resource: t(`resources.${resource}`) }),
    })
  }

  for (const province of view.provinces) {
    if (province.owner !== view.playerId) continue
    if (province.morale === undefined || province.morale >= UNREST_MORALE) continue
    alerts.push({
      id: `unrest:${province.id}`,
      kind: 'unrest',
      icon: 'warning',
      text: t('alerts.unrest', { province: province.name }),
      provinceId: province.id,
    })
  }

  // Fertigstellungen — die vierte Quelle, die R-UI-14 nennt und die ganz fehlte
  // (T-M12-09). Aus der Sicht abgelesen und nicht aus dem Protokoll: dieses Feld haelt
  // sich an die Regel der Datei — Zustaende, keine Ereignisse — und haengt damit nicht
  // an einem Protokoll, das bis heute an der Tagesgrenze leckte.
  for (const province of view.provinces) {
    if (province.owner !== view.playerId) continue
    for (const entry of province.buildQueue ?? []) {
      if (!justFinished(entry.completesAtTick, view.tick)) continue
      alerts.push({
        id: `completion:build:${entry.id}`,
        kind: 'completion',
        icon: BUILDING_ICONS[entry.building] ?? 'barracks',
        text: t('alerts.completionBuilding', {
          building: t(`buildings.${entry.building}`),
          province: province.name,
        }),
        provinceId: province.id,
      })
    }
    for (const entry of province.recruitQueue ?? []) {
      if (!justFinished(entry.completesAtTick, view.tick)) continue
      alerts.push({
        id: `completion:recruit:${province.id}:${entry.unitKey}:${entry.completesAtTick}`,
        kind: 'completion',
        icon: UNIT_ICONS[entry.unitKey] ?? 'infantry',
        text: t('alerts.completionUnit', {
          unit: t(`units.${entry.unitKey}`),
          province: province.name,
        }),
        provinceId: province.id,
      })
    }
  }

  // Freischaltung und Ankuendigung zuletzt (T-M41-12). Seit sie den ganzen Spieltag stehen,
  // muessen sie hinter dem stehen, was gerade Aufmerksamkeit braucht — das war der Grund, aus
  // dem T-M21-04 sie nur am Tagesanfang zeigte (`unlocks-explained.test.ts`).
  // Spionage-Meldungen (M5, T-M17-13): nach den Fertigstellungen, vor Freischaltung und
  // Ankuendigung — die stehen den ganzen Spieltag und muessen hinter dem stehen, was
  // gerade Aufmerksamkeit braucht (T-M41-12).
  alerts.push(...news)

  // Angebote (T-M17-14, E4): nach den Nachrichten, vor Freischaltung und Ankuendigung — aus
  // demselben Grund wie die Spionage-Meldungen daneben.
  alerts.push(...offerAlerts(view))

  if (rules) alerts.push(...unlockAlerts(view, rules), ...upcomingAlerts(view, rules))

  return alerts
}

/**
 * Was der Spieler wegklicken kann (T-M41-12): Ankuendigung und Freischaltung — sie stehen
 * einen ganzen Spieltag und gehen am Tagesende von selbst. Ein Kampf, ein Mangel oder eine
 * gefallene Hauptstadt endet mit ihrer Lage, nicht mit einem Klick.
 */
export function isDismissible(alert: Alert): boolean {
  return alert.kind === 'unlock' || alert.kind === 'upcoming' || alert.kind === 'sabotage' || alert.kind === 'espionage'
}

/**
 * Eine Meldung aus einem Ereignis — mit dem Tick, damit die juengere die aeltere ersetzt
 * (R-SPY-06/AK2, T-M17-13).
 */
export interface NewsAlert extends Alert {
  tick: number
}

export interface NewsNaming {
  province: (id: string) => string
  player: (id: string) => string
}

export interface NewsState {
  viewer: string | null
  upTo: number
  alerts: ReadonlyMap<string, NewsAlert>
}

export const NO_NEWS: NewsState = { viewer: null, upTo: -1, alerts: new Map() }

/**
 * Spionage-Ereignisse als Meldung (E3, E4, T-M17-13).
 *
 * Laut: `SABOTAGE_SUFFERED`, nur fuers Opfer. Leise: `SPY_DETECTED` fuer beide Seiten,
 * `SPY_LOST`, und `SPY_REPORT` nur mit `outcome: 'targetChanged'` — Erfolg und Misserfolg
 * bleiben Protokoll und Uebersicht, sonst meldeten fuenf Spione fuenf Zeilen am Tag.
 * Keine Spionkennung geht hinein (F3), und `SABOTAGE_SUFFERED` nennt keinen Urheber (F2) —
 * das Ereignis selbst hat keinen.
 */
export function espionageAlerts(events: readonly GameEvent[], viewerId: string, naming: NewsNaming): NewsAlert[] {
  const alerts: NewsAlert[] = []
  for (const event of events) {
    if (event.type === 'SABOTAGE_SUFFERED') {
      if (event.playerId !== viewerId) continue
      const province = naming.province(event.provinceId)
      alerts.push({
        id: `sabotage:${event.provinceId}`,
        kind: 'sabotage',
        icon: event.kind === 'economic' ? 'spyEconomic' : 'spyMilitary',
        text: t(event.kind === 'economic' ? 'alerts.sabotageEconomic' : 'alerts.sabotageMilitary', { province }),
        provinceId: event.provinceId,
        tick: event.tick,
      })
    } else if (event.type === 'SPY_DETECTED') {
      const province = naming.province(event.provinceId)
      if (event.targetPlayerId === viewerId) {
        alerts.push({
          id: `spy-caught:${event.provinceId}`,
          kind: 'espionage',
          icon: 'spyCounter',
          text: t('alerts.spyCaught', { province, player: naming.player(event.playerId) }),
          provinceId: event.provinceId,
          tick: event.tick,
        })
      } else if (event.playerId === viewerId) {
        alerts.push({
          id: `spy-exposed:${event.provinceId}:${event.mission}`,
          kind: 'espionage',
          icon: SPY_MISSION_ICONS[event.mission],
          text: t('alerts.spyExposed', { province, mission: t(`espionage.missions.${event.mission}`) }),
          provinceId: event.provinceId,
          tick: event.tick,
        })
      }
    } else if (event.type === 'SPY_LOST') {
      if (event.playerId !== viewerId) continue
      alerts.push({
        id: `spy-unpaid:${event.provinceId}:${event.mission}`,
        kind: 'espionage',
        icon: 'money',
        text: t('alerts.spyUnpaid', { province: naming.province(event.provinceId) }),
        provinceId: event.provinceId,
        tick: event.tick,
      })
    } else if (event.type === 'SPY_REPORT') {
      if (event.playerId !== viewerId || event.outcome !== 'targetChanged') continue
      alerts.push({
        id: `spy-target:${event.provinceId}:${event.mission}`,
        kind: 'espionage',
        icon: SPY_MISSION_ICONS[event.mission],
        text: t('alerts.spyTargetChanged', { province: naming.province(event.provinceId) }),
        provinceId: event.provinceId,
        tick: event.tick,
      })
    }
  }
  return alerts
}

/**
 * Neue Spionage-Meldungen einsammeln, bis der Spieler sie wegklickt (E3, T-M17-13).
 *
 * Zaehlt nach Tick (`upTo`), nicht nach Laenge — der Ring ist auf 500 Ereignisse fuer
 * alle Maechte gedeckelt, `state.eventLog` kann also kuerzer werden, ohne dass eine
 * behaltene Meldung ihr Ereignis "verliert". Liefert dasselbe Objekt zurueck (Identitaet),
 * wenn sich nichts geaendert hat — React zeichnet dann nicht neu.
 */
export function collectEspionageNews(
  old: NewsState,
  events: readonly GameEvent[],
  tick: number,
  viewerId: string,
  naming: NewsNaming,
): NewsState {
  // Neuer Betrachter oder ein Stand vor dem zuletzt gesehenen Tick (Laden, neue Partie):
  // von vorn, wie ein frischer Merker.
  const reset = old.viewer !== viewerId || tick < old.upTo
  const base: NewsState = reset ? { viewer: viewerId, upTo: -1, alerts: new Map() } : old

  const fresh = events.filter((event) => event.tick > base.upTo)
  let upTo = base.upTo
  for (const event of fresh) if (event.tick > upTo) upTo = event.tick
  const neu = espionageAlerts(fresh, viewerId, naming)

  if (neu.length === 0) {
    if (!reset && upTo === old.upTo) return old
    return { viewer: viewerId, upTo, alerts: base.alerts }
  }

  const alerts = new Map(base.alerts)
  for (const alert of neu) {
    const bisherig = alerts.get(alert.id)
    // Dieselbe Provinz kann mehrfach sabotiert werden — die juengere gewinnt, an
    // derselben Stelle (M12: Anzahl bleibt eins).
    if (!bisherig || alert.tick >= bisherig.tick) alerts.set(alert.id, alert)
  }
  return { viewer: viewerId, upTo, alerts }
}

/** Eine Meldung wegklicken — quittiert, bis ein neues Ereignis sie ersetzt. */
export function dismissNews(old: NewsState, id: string): NewsState {
  if (!old.alerts.has(id)) return old
  const alerts = new Map(old.alerts)
  alerts.delete(id)
  return { ...old, alerts }
}

/** Das Sprungziel einer Meldung (T-M17-14, E3): Provinz vor Diplomatie, sonst kein Ziel. */
function targetOf(alert: Alert): JumpTarget | null {
  if (alert.provinceId) return { kind: 'province', provinceId: alert.provinceId }
  if (alert.diplomacyWith) return { kind: 'diplomacy', playerId: alert.diplomacyWith }
  return null
}

export function Alerts({
  alerts,
  onJump,
  onDismiss,
}: {
  alerts: readonly Alert[]
  onJump: (target: JumpTarget) => void
  /** Eine Ankuendigung oder Freischaltung bis zum Ende ihres Spieltags ausblenden. */
  onDismiss?: (id: string) => void
}) {
  if (alerts.length === 0) return null

  return (
    <section className="alerts" aria-label={t('alerts.title')}>
      <ul>
        {alerts.map((alert) => {
          const target = targetOf(alert)
          return (
            <li key={alert.id} className={`alert alert--${alert.kind}`}>
              <Icon name={alert.icon} size={14} />
              {target ? (
                <button type="button" className="alert__jump" onClick={() => onJump(target)}>
                  {alert.text}
                </button>
              ) : (
                <span>{alert.text}</span>
              )}
              {/* Leise wie die Meldung (M36): keine Farbe, kein Sprung, kein Ton. */}
              {onDismiss && isDismissible(alert) && (
                <button
                  type="button"
                  className="alert__dismiss"
                  aria-label={t('alerts.dismiss', { text: alert.text })}
                  title={t('alerts.dismissTitle')}
                  onClick={() => onDismiss(alert.id)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
