import type { PublicView } from '@worldwar/core'
import { accusativePronoun } from '../i18n/grammar.ts'
import { t } from '../i18n/text.ts'
import { BUILDING_ICONS, Icon, RESOURCE_ICONS, UNIT_ICONS, type IconName } from './icons.tsx'

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
 */

export type AlertKind =
  | 'battle'
  | 'overrun'
  | 'shortage'
  | 'unrest'
  | 'capital'
  | 'completion'
  | 'unlock'

export interface Alert {
  /** Stable across ticks: the same cause is the same alert. */
  id: string
  kind: AlertKind
  icon: IconName
  text: string
  provinceId?: string
}

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
  // Nur in den ersten Stunden des Tages — genauso lange wie eine Fertigstellung steht.
  if (view.tick % perDay >= COMPLETION_ALERT_TICKS) return []

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

/** Genau so viel von den Regeln, wie die Freischaltungsmeldung braucht. */
export interface UnlockRules {
  constants: { ticksPerDay: number }
  buildings: Record<string, { availableFromDay: number }>
  units: Record<string, { availableFromDay: number }>
}

export function alertsFor(view: PublicView | null, rules?: UnlockRules): Alert[] {
  if (!view) return []
  const alerts: Alert[] = rules ? unlockAlerts(view, rules) : []
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

  return alerts
}

export function Alerts({ alerts, onJump }: { alerts: readonly Alert[]; onJump: (provinceId: string) => void }) {
  if (alerts.length === 0) return null

  return (
    <section className="alerts" aria-label={t('alerts.title')}>
      <ul>
        {alerts.map((alert) => (
          <li key={alert.id} className={`alert alert--${alert.kind}`}>
            <Icon name={alert.icon} size={14} />
            {alert.provinceId ? (
              <button type="button" className="alert__jump" onClick={() => onJump(alert.provinceId!)}>
                {alert.text}
              </button>
            ) : (
              <span>{alert.text}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
