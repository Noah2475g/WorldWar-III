import type { PublicView } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { Icon, RESOURCE_ICONS, type IconName } from './icons.tsx'

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

export type AlertKind = 'battle' | 'shortage' | 'unrest' | 'capital'

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

export function alertsFor(view: PublicView | null): Alert[] {
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

  // A capital that has fallen outranks everything else the player could be doing.
  if (view.self.capitalProvinceId && !own.has(view.self.capitalProvinceId)) {
    alerts.push({
      id: 'capital:lost',
      kind: 'capital',
      icon: 'capital',
      text: t('alerts.capitalLost'),
      provinceId: view.self.capitalProvinceId,
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
