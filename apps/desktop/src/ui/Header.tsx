import { RESOURCE_KEYS, type PublicView } from '@worldwar/core'
import { SPEED_STOPS } from '../sim/SimHost.ts'
import { t } from '../i18n/text.ts'
import { amount, formatTime, rate } from './format.ts'
import { MAP_MODES, MAP_MODE_NAMES, type MapMode } from '../map/modes.ts'

/**
 * The header (T-M10-04, R-UI-03/R-TIME-02).
 *
 * Resources on the left, time and speed on the right. The speed control shows the
 * detents rather than a bare slider, because "how fast am I actually running" is a
 * question the player asks constantly and a slider position does not answer.
 */

export interface HeaderProps {
  view: PublicView | null
  ticksPerDay: number
  speed: number
  fastForwarding: boolean
  mode: MapMode
  /** Net change per day, per resource — the balance the player steers by. */
  balance: Partial<Record<string, number>>
  onSpeed: (hoursPerSecond: number) => void
  onFastForward: () => void
  onAbort: () => void
  onMode: (mode: MapMode) => void
  onMenu: () => void
}

export function Header(props: HeaderProps) {
  const resources = props.view?.self.resources
  const shortages = new Set(props.view?.self.shortages ?? [])

  return (
    <header className="header">
      <ul className="resources" aria-label="Rohstoffe">
        {RESOURCE_KEYS.map((key) => (
          <li key={key} className={shortages.has(key) ? 'resource resource--short' : 'resource'}>
            <b>{resources ? amount(resources[key] ?? 0) : '—'}</b>
            <span>{t(`resources.${key}`)}</span>
            {props.balance[key] !== undefined && (
              <em title={`${t('header.balance')} ${t('header.perDay')}`}>{rate(props.balance[key] ?? 0)}</em>
            )}
          </li>
        ))}
      </ul>

      <div className="clock">
        <span className="clock__time">{formatTime(props.view?.tick ?? 0, props.ticksPerDay)}</span>

        <div className="speeds" role="group" aria-label={t('header.speed')}>
          {SPEED_STOPS.map((stop) => (
            <button
              key={stop}
              type="button"
              className={props.speed === stop ? 'speed speed--active' : 'speed'}
              aria-pressed={props.speed === stop}
              onClick={() => props.onSpeed(stop)}
            >
              {stop === 0 ? '‖' : stop}
            </button>
          ))}
        </div>

        {props.fastForwarding ? (
          <button type="button" className="button button--accent" onClick={props.onAbort}>
            {t('header.abort')}
          </button>
        ) : (
          <button type="button" className="button" onClick={props.onFastForward}>
            {t('header.fastForward')}
          </button>
        )}

        <label className="mode-picker">
          <span className="visually-hidden">{t('mapModes.title')}</span>
          <select value={props.mode} onChange={(event) => props.onMode(event.target.value as MapMode)}>
            {MAP_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {MAP_MODE_NAMES[mode]}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="button" onClick={props.onMenu}>
          {t('header.menu')}
        </button>
      </div>
    </header>
  )
}
