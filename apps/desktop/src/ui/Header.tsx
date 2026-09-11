import { RESOURCE_KEYS, type PublicView } from '@worldwar/core'
import { SPEED_STOPS } from '../game/speed.ts'
import { t } from '../i18n/text.ts'
import { SHORT_REACH_DAYS, amount, formatTime, rate, reachInDays, reachText } from './format.ts'
import { Icon, RESOURCE_ICONS } from './icons.tsx'
import { Meter } from './Meter.tsx'
import { MAP_MODES, MAP_MODE_NAMES, type MapMode } from '../map/modes.ts'

/**
 * The header (T-M10-04, T-M29-02, R-UI-03/R-TIME-02/R-TIME-04).
 *
 * Two rows since the Kriegsrat (D27.6): the top row carries the clock in amber, the
 * speed as a button group with exactly one pressed detent, the map mode as a button
 * group, the panel buttons and — empty until T-M28-06 fills it — the alarm chip. The
 * second row is the resource bar: glyph, stock and the day's balance with its sign in
 * the text and its direction in the colour, the reach in the tooltip.
 *
 * The speed control shows the detents rather than a bare slider, because "how fast am
 * I actually running" is a question the player asks constantly and a slider position
 * does not answer.
 */

export interface HeaderProps {
  view: PublicView | null
  ticksPerDay: number
  speed: number
  /**
   * Die Uhr behauptet Tempo, das nicht laeuft (T-M22-05, R-TIME-02, Befund V2-09):
   * trotz eingestellter Geschwindigkeit lief laenger als zwei Sekunden kein Tick —
   * verdecktes Fenster, stehendes requestAnimationFrame. Dann sagt die Leiste
   * "Pausiert" statt stillschweigend weiter ihr Tempo zu zeigen.
   */
  stalled?: boolean
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
  /**
   * Der jüngste Einmarsch in eigenes Gebiet (T-M28-06, R-TIME-06, D27.6).
   *
   * Der Chip sitzt seit T-M29-02 an seinem Platz und war bis hierher leer. `null`
   * heißt: kein offener Alarm — dann bleibt der Platz verborgen und die Zeile so
   * breit wie zuvor.
   */
  alarm?: { provinceId: string; provinceName: string; intruder: string } | null
  /** Klick auf den Chip: zur Provinz springen und den Alarm quittieren. */
  onAlarm?: (provinceId: string) => void
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

/** The direction of a balance, as a class suffix — the sign itself comes from `rate()`. */
export function balanceTone(balance: number): 'plus' | 'minus' | 'zero' {
  if (balance > 0) return 'plus'
  if (balance < 0) return 'minus'
  return 'zero'
}

/**
 * Die Raste, die als gedrueckt gilt (T-M28-10): die groesste, die die laufende
 * Geschwindigkeit nicht ueberschreitet. Bei 30 mit den Rasten 25 und 50 ist das die 25 —
 * so meldet die Gruppe immer genau eine Stufe, auch wenn die Hoechstgeschwindigkeit
 * einen Wert zwischen den Rasten erzwingt.
 */
export function activeSpeedStop(speed: number, stops: readonly number[] = SPEED_STOPS): number {
  let best = stops[0] ?? 0
  for (const stop of stops) {
    if (stop <= speed && stop >= best) best = stop
  }
  return best
}

export function Header(props: HeaderProps) {
  const activeStop = activeSpeedStop(props.speed)
  const resources = props.view?.self.resources
  const shortages = new Set(props.view?.self.shortages ?? [])
  const victory = victoryProgress(props.view)

  return (
    <header className="header">
      <div className="header__top">
        <span className="header__title">WorldWar</span>

        <div className="clock">
          <span className="clock__time">
            <Icon name="clock" size={13} />
            {formatTime(props.view?.tick ?? 0, props.ticksPerDay)}
          </span>

          {/* Eine stehende Uhr sagt es (T-M22-05, V2-09) — als role="status", damit
              auch ein Vorleseprogramm erfaehrt, dass die Zeit gerade nicht laeuft. */}
          {props.stalled && (
            <span className="clock__stalled" role="status">
              {t('header.paused')}
            </span>
          )}

          {/*
            Genau ein Knopf ist gedrueckt: die Pause oder die laufende Stufe (D27.6).
            Seit T-M28-10 stimmt das auch dann, wenn die Geschwindigkeit ZWISCHEN zwei
            Rasten liegt — das passiert, sobald die eingestellte Hoechstgeschwindigkeit
            sie kappt. Vorher war dann gar keiner gedrueckt, der Klick sah folgenlos aus,
            und ein Screenreader meldete keine aktive Stufe.
          */}
          <div className="speeds" role="group" aria-label={t('header.speed')}>
            {SPEED_STOPS.map((stop) => (
              <button
                key={stop}
                type="button"
                className={activeStop === stop ? 'speed speed--active' : 'speed'}
                aria-pressed={activeStop === stop}
                aria-label={stop === 0 ? t('header.pause') : undefined}
                title={stop === 0 ? t('header.pause') : t('header.speedStop', { stop })}
                onClick={() => props.onSpeed(stop)}
              >
                {stop === 0 ? <Icon name="pause" size={11} /> : stop}
              </button>
            ))}

            {/*
              Das Vorspulen ist keine Tempostufe, sondern ein Lauf mit Ziel — es traegt
              deshalb kein `aria-pressed` mehr (T-M28-10). Vorher waren waehrend des Laufs
              zwei Knoepfe derselben Gruppe gedrueckt: die Pause und das Abbrechen.
            */}
            {props.fastForwarding ? (
              <button type="button" className="speed speed--fast speed--running" onClick={props.onAbort}>
                <Icon name="fastForward" size={11} />
                {t('header.abort')}
              </button>
            ) : (
              <button type="button" className="speed speed--fast" onClick={props.onFastForward}>
                <Icon name="fastForward" size={11} />
                {t('header.fastForward')}
              </button>
            )}
          </div>

          {!props.fastForwarding && props.fastForwardNotice !== null && (
            <span className="header__notice" role="status">
              {props.fastForwardNotice}
            </span>
          )}
        </div>

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

        <div className="modes" role="group" aria-label={t('mapModes.title')}>
          {MAP_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={props.mode === mode ? 'mode mode--active' : 'mode'}
              aria-pressed={props.mode === mode}
              onClick={() => props.onMode(mode)}
            >
              {MAP_MODE_NAMES[mode]}
            </button>
          ))}
        </div>

        {/* Diplomatie, Markt und Lage wohnen seit T-M31-03 im Fuss (D27.6); hier
            bleiben nur Spielstaende und Menue. `onPanel` bleibt fuer die Tastatur. */}
        <div className="header__panels">
          <button type="button" className="button" onClick={props.onSaves}>
            {t('saves.title')}
          </button>
          <button type="button" className="button" onClick={props.onMenu}>
            {t('header.menu')}
          </button>
        </div>

        {/* Der Einmarsch-Alarm (T-M28-06, D27.6). Der Platz sitzt seit T-M29-02 dort,
            wo er hingehoert, damit die Zeile beim ersten Alarm nicht umbricht. */}
        <div className="header__alarm" hidden={!props.alarm}>
          {props.alarm && (
            <button
              type="button"
              className="alarm-chip"
              aria-label={t('header.alarmAria', {
                province: props.alarm.provinceName,
                intruder: props.alarm.intruder,
              })}
              onClick={() => props.onAlarm?.(props.alarm!.provinceId)}
            >
              <Icon name="battle" size={13} />
              {t('header.alarm', { province: props.alarm.provinceName })}
            </button>
          )}
        </div>
      </div>

      <ul className="resources" aria-label="Rohstoffe">
        {RESOURCE_KEYS.map((key) => {
          const flow = props.view?.self.economy?.[key]
          // Wie lange der Vorrat noch reicht — nur wenn er schrumpft (T-M13-14).
          const days = flow ? reachInDays(flow.stock, flow.balance) : null
          const running = days !== null && days < SHORT_REACH_DAYS
          const short = shortages.has(key) || running
          return (
            <li key={key} className={`resource resource--${key}${short ? ' resource--short' : ''}`} title={t(`resources.${key}`)}>
              {/* Das Symbol traegt die Bedeutung fuers Auge, der Name die fuers Ohr —
                  beides zugleich sichtbar waere derselbe Begriff zweimal. */}
              <Icon name={RESOURCE_ICONS[key] ?? 'warning'} size={14} />
              <b>{resources ? amount(resources[key] ?? 0) : '—'}</b>
              <span className="visually-hidden">{t(`resources.${key}`)}</span>
              {flow && (
                // Der sichtbare Wert ist die Bilanz mit Vorzeichen; woraus sie sich
                // ergibt und wie lange der Vorrat reicht, steht im Tooltip und
                // vollstaendig in der Wirtschaftsuebersicht (R-ECON-06, R-UI-09).
                <em
                  className={`resource__balance resource__balance--${balanceTone(flow.balance)}`}
                  title={[
                    `${t('economy.production')} ${rate(flow.production)} · ${t('economy.consumption')} ${rate(-flow.consumption)} · ${t('economy.balance')} ${t('economy.perDay')}`,
                    days === null ? null : reachText(days),
                  ]
                    .filter((part) => part !== null)
                    .join(' · ')}
                >
                  {rate(flow.balance)}
                </em>
              )}
            </li>
          )
        })}
      </ul>
    </header>
  )
}
