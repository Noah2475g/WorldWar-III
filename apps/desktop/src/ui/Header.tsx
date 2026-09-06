import { RESOURCE_KEYS, type PublicView } from '@worldwar/core'
import { SPEED_STOPS } from '../game/speed.ts'
import { t } from '../i18n/text.ts'
import { SHORT_REACH_DAYS, amount, formatTime, rate, reachInDays, reachText } from './format.ts'
import { Icon, RESOURCE_ICONS } from './icons.tsx'
import { Meter } from './Meter.tsx'
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
  /**
   * Warum das Vorspulen anhielt, und wie weit es kam (T-M12-10, R-TIME-03).
   *
   * Der Kern fuehrt beides seit M15, App hielt beides im Zustand — gelesen hat es
   * niemand. R-TIME-03/AK1 verlangt ausdruecklich "stoppen und melden"; ohne diese
   * Zeile war die Haelfte davon nicht gebaut.
   */
  fastForwardNotice: string | null
  mode: MapMode
  onSpeed: (hoursPerSecond: number) => void
  onFastForward: () => void
  onAbort: () => void
  onMode: (mode: MapMode) => void
  onMenu: () => void
  /** Die Spielstaende brauchen einen Knopf: eine Funktion nur auf der Tastatur ist keine (T-M12-07). */
  onSaves: () => void
  /** Diplomacy, market and standings live in the side panel; the header only opens them. */
  onPanel: (panel: 'diplomacy' | 'market' | 'standings') => void
}

/**
 * The player's share of all points, against the share it takes to win (R-UI-13).
 *
 * Points on their own answer nothing — 4 200 is a good score in a small game and a
 * hopeless one in a large one. The share against the threshold is the figure the
 * question "how far along am I" is actually asking about.
 */
export function victoryProgress(view: PublicView | null): { share: number; goal: number } | null {
  if (!view?.victory.pointsShareToWin) return null
  const total = view.self.score + view.others.reduce((sum, other) => sum + other.score, 0)
  if (total <= 0) return null

  return {
    share: (view.self.score / total) * 100,
    // The threshold is fixed-point per mille of the total: 900 means 90 %.
    goal: view.victory.pointsShareToWin / 10,
  }
}

export function Header(props: HeaderProps) {
  const resources = props.view?.self.resources
  const shortages = new Set(props.view?.self.shortages ?? [])
  const victory = victoryProgress(props.view)

  return (
    <header className="header">
      <ul className="resources" aria-label="Rohstoffe">
        {RESOURCE_KEYS.map((key) => {
          const flow = props.view?.self.economy?.[key]
          // Wie lange der Vorrat noch reicht — nur wenn er schrumpft (T-M13-14).
          const days = flow ? reachInDays(flow.stock, flow.balance) : null
          const running = days !== null && days < SHORT_REACH_DAYS
          return (
            <li
              key={key}
              className={shortages.has(key) || running ? 'resource resource--short' : 'resource'}
              title={t(`resources.${key}`)}
            >
              {/* Das Symbol traegt die Bedeutung fuers Auge, der Name die fuers Ohr —
                  beides zugleich sichtbar waere derselbe Begriff zweimal. */}
              <Icon name={RESOURCE_ICONS[key] ?? 'warning'} size={14} />
              <b>{resources ? amount(resources[key] ?? 0) : '—'}</b>
              <span className="visually-hidden">{t(`resources.${key}`)}</span>
              {flow && (
                // Der sichtbare Wert ist die Bilanz; woraus sie sich ergibt, steht im
                // Tooltip und vollstaendig in der Wirtschaftsuebersicht (R-ECON-06).
                <em
                  title={`${t('economy.production')} ${rate(flow.production)} · ${t('economy.consumption')} ${rate(-flow.consumption)} · ${t('economy.balance')} ${t('economy.perDay')}`}
                >
                  {rate(flow.balance)}
                </em>
              )}
              {days !== null && <i className="resource__reach">{reachText(days)}</i>}
            </li>
          )
        })}
      </ul>

      {/* Wie weit ist der Sieg? Der Punkteanteil als Balken — eine Zahl, die man
          gegen das Ziel vergleichen kann, ohne sie auszurechnen (R-UI-13). */}
      {victory && (
        <Meter
          label={t('meter.victoryGoal')}
          value={victory.share}
          max={victory.goal}
          text={t('meter.victoryShare', { percent: Math.round(victory.share), goal: Math.round(victory.goal) })}
          tone={victory.share >= victory.goal ? 'good' : 'neutral'}
        />
      )}

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

        {!props.fastForwarding && props.fastForwardNotice !== null && (
          <span className="header__notice" role="status">
            {props.fastForwardNotice}
          </span>
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

        <button type="button" className="button" onClick={() => props.onPanel('diplomacy')}>
          {t('header.diplomacy')}
        </button>
        <button type="button" className="button" onClick={() => props.onPanel('market')}>
          {t('header.market')}
        </button>
        <button type="button" className="button" onClick={() => props.onPanel('standings')}>
          {t('standings.open')}
        </button>
        <button type="button" className="button" onClick={props.onSaves}>
          {t('saves.title')}
        </button>
        <button type="button" className="button" onClick={props.onMenu}>
          {t('header.menu')}
        </button>
      </div>
    </header>
  )
}
