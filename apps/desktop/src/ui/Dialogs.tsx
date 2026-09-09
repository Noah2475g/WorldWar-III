import { useEffect, useRef, type ReactNode } from 'react'
import { RESOURCE_KEYS } from '@worldwar/core'
import { t } from '../i18n/text.ts'
import { DEFAULT_SETTINGS, FONT_SCALES, type Settings } from '../state/uiState.ts'
import type { Difficulty, NewGameOptions } from '../game/newGame.ts'
// Die Fassung aus package.json — nicht als zweite Wahrheit in der Sprachdatei (T-M22-04).
import { version as APP_VERSION } from '../../../../package.json'

/**
 * Everything that opens over the map (T-M10-07a/b, T-M10-09, T-M10-10, T-M10-11).
 *
 * All of them share one dialogue shell, and the shell does the accessibility work
 * once: focus moves in on opening and back out on closing, Escape closes, and the
 * background cannot be reached by tab. Done per dialogue, that work gets forgotten in
 * the fourth one — and the fourth one is where a player gets stuck.
 */

/** Was in einem Dialog den Fokus annehmen kann — eine Liste, damit sie nicht auseinanderlaeuft. */
// prettier-ignore
const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])' // GUARD-ALLOW prose-in-code: ein CSS-Waehler, kein Satz

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const returnTo = useRef<Element | null>(null)

  useEffect(() => {
    returnTo.current = document.activeElement
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => {
      if (returnTo.current instanceof HTMLElement) returnTo.current.focus()
    }
  }, [])

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose()
            return
          }
          // Der Fokusfang (T-M16-07, R-UI-15/AK1).
          //
          // `aria-modal` sagt einem Vorleseprogramm, dass dahinter nichts ist — die
          // Tabulatortaste hoert nicht darauf. Ohne diese Zeilen tabbt man aus einem
          // modalen Dialog in die Karte dahinter: sichtbar verdeckt, mit der Tastatur
          // erreichbar und bedienbar. Das ist der Fehler, den ein Sehender nie bemerkt.
          if (event.key !== 'Tab') return
          const felder = [...(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
            (element) => !element.hasAttribute('disabled'),
          )
          if (felder.length === 0) return
          const erster = felder[0]!
          const letzter = felder[felder.length - 1]!
          const aktiv = document.activeElement
          if (event.shiftKey && (aktiv === erster || !ref.current?.contains(aktiv))) {
            event.preventDefault()
            letzter.focus()
          } else if (!event.shiftKey && (aktiv === letzter || !ref.current?.contains(aktiv))) {
            event.preventDefault()
            erster.focus()
          }
        }}
      >
        <header className="dialog__head">
          <h2>{title}</h2>
          <button type="button" className="button" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </header>
        <div className="dialog__body">{children}</div>
      </div>
    </div>
  )
}

export function NewGameDialog({
  options,
  nations,
  maps,
  aiBonus,
  onChange,
  onStart,
  onClose,
  onSaves,
  resume,
  onResume,
}: {
  options: NewGameOptions
  nations: readonly string[]
  maps: readonly { id: string; name: string; data: { provinces: readonly unknown[] } }[]
  aiBonus: number
  onChange: (options: NewGameOptions) => void
  onStart: () => void
  onClose: () => void
  /**
   * Der Weg zu den Spielstaenden (T-M12-07). Wer wiederkommt, will laden und nicht neu
   * anfangen — und vor der ersten Partie steht dieser Dialog davor. Ohne den Griff waere
   * der Stand nur zu erreichen, indem man den Dialog erst wegklickt.
   */
  onSaves?: () => void
  /**
   * Der juengste Stand, wenn es einen gibt (T-M22-04, Befund V2-04): dann ist
   * "Weiterspielen (Tag N)" der ERSTE Knopf — wer wiederkommt, will weiterspielen.
   */
  resume?: { day: number } | null
  onResume?: () => void
}) {
  return (
    <Dialog title={t('newGame.title')} onClose={onClose}>
      {/* Start mit Gesicht (T-M22-04, Befund V2-03): Name, Untertitel, Fassung —
          der erste Eindruck sagte vorher "Formular", nicht "Strategiespiel". */}
      <header className="start">
        <h1 className="start__title">{t('app.title')}</h1>
        <p className="start__subtitle">{t('app.subtitle')}</p>
        <p className="start__version">{t('app.version', { version: APP_VERSION })}</p>
      </header>

      {resume && onResume && (
        <button type="button" className="button button--primary" onClick={onResume}>
          {t('newGame.resume', { day: resume.day })}
        </button>
      )}

      <label className="field">
        <span>{t('newGame.map')}</span>
        <select value={options.mapId} onChange={(e) => onChange({ ...options, mapId: e.target.value })}>
          {maps.map((map) => (
            <option key={map.id} value={map.id}>
              {map.name} ({map.data.provinces.length})
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{t('newGame.nation')}</span>
        <select value={options.nation} onChange={(e) => onChange({ ...options, nation: e.target.value })}>
          {nations.map((nation) => (
            <option key={nation} value={nation}>
              {nation}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{t('newGame.opponents')}</span>
        <input
          type="number"
          min={1}
          max={Math.max(1, nations.length - 1)}
          value={options.opponents}
          onChange={(e) => onChange({ ...options, opponents: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>{t('newGame.difficulty')}</span>
        <select
          value={options.difficulty}
          onChange={(e) => onChange({ ...options, difficulty: e.target.value as Difficulty })}
        >
          <option value="easy">{t('newGame.easy')}</option>
          <option value="normal">{t('newGame.normal')}</option>
          <option value="hard">{t('newGame.hard')}</option>
        </select>
      </label>

      <label className="field">
        <span>{t('newGame.seed')}</span>
        <input
          type="number"
          value={options.seed}
          onChange={(e) => onChange({ ...options, seed: Number(e.target.value) })}
        />
        <small>{t('newGame.seedHint')}</small>
      </label>

      <label className="field">
        <span>{t('newGame.victory')}</span>
        <select
          value={options.victory}
          onChange={(e) => onChange({ ...options, victory: e.target.value as 'points' | 'conquest' })}
        >
          <option value="points">{t('newGame.victoryPoints')}</option>
          <option value="conquest">{t('newGame.victoryConquest')}</option>
        </select>
        <small>
          {options.victory === 'points'
            ? t('newGame.victoryPointsHint')
            : t('newGame.victoryConquestHint')}
        </small>
      </label>

      <p className="notice notice--info">
        {aiBonus === 0 ? t('newGame.aiBonusNone') : t('newGame.aiBonus', { percent: aiBonus })}
      </p>

      <p className="dialog__actions">
        <button type="button" className="button button--primary" onClick={onStart}>
          {t('newGame.start')}
        </button>
        {onSaves && (
          <button type="button" className="button" onClick={onSaves}>
            {t('saves.title')}
          </button>
        )}
      </p>
    </Dialog>
  )
}

/**
 * Das Menue mit Wegen (T-M22-04, Befund V2-05): aus der laufenden Partie gab es nur
 * die Einstellungen — keinen Weg zu einer neuen Partie, keinen zu den Spielstaenden.
 */
export function MenuDialog({
  onNewGame,
  onSaves,
  onSettings,
  onClose,
}: {
  onNewGame: () => void
  onSaves: () => void
  onSettings: () => void
  onClose: () => void
}) {
  return (
    <Dialog title={t('menu.title')} onClose={onClose}>
      <div className="menu">
        <button type="button" className="button button--primary" onClick={onNewGame}>
          {t('newGame.title')}
        </button>
        <button type="button" className="button" onClick={onSaves}>
          {t('saves.title')}
        </button>
        <button type="button" className="button" onClick={onSettings}>
          {t('settings.title')}
        </button>
      </div>
    </Dialog>
  )
}

export interface SaveSlot {
  name: string
  label: string
  savedAtDay: number | null
}

export function SavesDialog({
  slots,
  onSave,
  onLoad,
  onClose,
  notice,
}: {
  slots: readonly SaveSlot[]
  /**
   * Fehlt der Griff, wird nur geladen: vor der ersten Partie gibt es keinen Zustand zu
   * sichern, und ein Knopf, der nichts tun kann, waere genau der Fehler aus 26a
   * (T-M12-07).
   */
  onSave?: (name: string) => void
  onLoad: (name: string) => void
  onClose: () => void
  notice: string | null
}) {
  return (
    <Dialog title={t('saves.title')} onClose={onClose}>
      {notice && <p className="notice">{notice}</p>}
      <ul className="slots">
        {slots.map((slot) => (
          <li key={slot.name} className="slot">
            <span className="slot__label">
              {slot.label}
              {slot.savedAtDay !== null ? ` — ${t('header.day')} ${slot.savedAtDay}` : ` — ${t('saves.empty')}`}
            </span>
            <span className="slot__actions">
              {onSave && (
                <button type="button" className="button" onClick={() => onSave(slot.name)}>
                  {t('saves.save')}
                </button>
              )}
              <button
                type="button"
                className="button"
                disabled={slot.savedAtDay === null}
                onClick={() => onLoad(slot.name)}
              >
                {t('saves.load')}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

export function SettingsDialog({
  settings,
  onChange,
  onReset,
  onClose,
}: {
  settings: Settings
  onChange: (settings: Partial<Settings>) => void
  onReset: () => void
  onClose: () => void
}) {
  return (
    <Dialog title={t('settings.title')} onClose={onClose}>
      <label className="field">
        <span>{t('settings.autosaveInterval')}</span>
        <input
          type="number"
          min={1}
          max={60}
          value={settings.autosaveMinutes}
          onChange={(e) => onChange({ autosaveMinutes: Number(e.target.value) })}
        />
      </label>

      <label className="field field--switch">
        <input type="checkbox" checked={settings.sound} onChange={(e) => onChange({ sound: e.target.checked })} />
        <span>{t('settings.sound')}</span>
      </label>

      <label className="field">
        <span>{t('settings.maxSpeed')}</span>
        <input
          type="number"
          min={1}
          max={100}
          value={settings.maxSpeed}
          onChange={(e) => onChange({ maxSpeed: Number(e.target.value) })}
        />
      </label>

      <label className="field">
        <span>{t('settings.fontSize')}</span>
        <select
          value={settings.fontScale}
          onChange={(e) => onChange({ fontScale: e.target.value as Settings['fontScale'] })}
        >
          <option value="small">{t('settings.fontSmall')}</option>
          <option value="normal">{t('settings.fontNormal')}</option>
          <option value="large">{t('settings.fontLarge')}</option>
        </select>
      </label>

      <label className="field field--switch">
        <input type="checkbox" checked={settings.debug} onChange={(e) => onChange({ debug: e.target.checked })} />
        <span>{t('settings.debug')}</span>
      </label>

      <button type="button" className="button" onClick={onReset} disabled={isDefault(settings)}>
        {t('settings.reset')}
      </button>
    </Dialog>
  )
}

function isDefault(settings: Settings): boolean {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).every(
    (key) => settings[key] === DEFAULT_SETTINGS[key],
  )
}

export interface DebugInfo {
  tick: number
  hash: string
  aiGoals: { player: string; goal: string; utility: number; alternatives: string[] }[]
  commands: string[]
}

/**
 * Debug-Prosa spricht Namen (T-M28-04, R-UI-07, Befund V2-12, D26.4).
 *
 * Die KI bleibt englisch und kernnah — ihre Zieltexte nennen `p2` und `money`. Die
 * Übersetzung passiert HIER, beim Rendern, aus denselben Quellen wie die übrige
 * Oberfläche: Spieler-Kennungen ersetzt der Aufrufer über `nameOf` (die Sicht kennt
 * die Machtnamen), Rohstoffschlüssel kommen aus `de.ts`. Weil die Zieltexte freie
 * Prosa sind, ersetzt ein Wortgrenzen-Muster — `p22` (eine Provinzkennung) bleibt
 * unangetastet, nur ein freistehendes `p2` wird zur Macht.
 */
export function localizeDebugText(text: string, nameOf: (id: string) => string): string {
  let result = text.replace(/\bp\d+\b/g, (id) => nameOf(id))
  for (const key of RESOURCE_KEYS) {
    result = result.replace(new RegExp(`\\b${key}\\b`, 'g'), t(`resources.${key}`))
  }
  return result
}

export function DebugPanel({
  info,
  enabled,
  nameOf = (id) => id,
}: {
  info: DebugInfo | null
  enabled: boolean
  /** Der Machtname zu einer Spielerkennung — ohne ihn bleibt die Kennung stehen. */
  nameOf?: (id: string) => string
}) {
  if (!enabled) return null
  if (!info) return <section className="panel">{t('debug.hidden')}</section>

  return (
    <section className="panel panel--debug" aria-label={t('debug.title')}>
      <h2>{t('debug.title')}</h2>
      <dl className="facts">
        <dt>{t('debug.tick')}</dt>
        <dd>{info.tick}</dd>
        <dt>{t('debug.hash')}</dt>
        <dd className="mono">{info.hash.slice(0, 16)}</dd>
      </dl>

      <h3>{t('debug.aiGoal')}</h3>
      {/* Eine Ueberschrift ueber einer leeren Liste ist genau der Befund aus dem
          Playtest (Frage 48): sie sieht kaputt aus, auch wenn nur nichts anliegt. */}
      {info.aiGoals.length === 0 && <p className="muted">{t('debug.noGoals')}</p>}
      <ul className="debug-list">
        {info.aiGoals.map((goal) => (
          <li key={goal.player}>
            <b>{nameOf(goal.player)}</b>: {localizeDebugText(goal.goal, nameOf)}{' '}
            <span className="mono">
              ({t('debug.aiUtility')} {goal.utility})
            </span>
            {goal.alternatives.length > 0 && (
              <div className="debug-alt">
                {t('debug.aiAlternatives')}: {localizeDebugText(goal.alternatives.join(', '), nameOf)}
              </div>
            )}
          </li>
        ))}
      </ul>

      <h3>{t('debug.commandLog')}</h3>
      {info.commands.length === 0 && <p className="muted">{t('debug.noCommands')}</p>}
      <ol className="debug-list mono">
        {info.commands.slice(-12).map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ol>
    </section>
  )
}

export function KeyboardHelp({ onClose }: { onClose: () => void }) {
  const keys = ['pause', 'speedUp', 'speedDown', 'fastForward', 'save', 'load', 'mapMode', 'diplomacy', 'market', 'escape', 'help'] as const

  return (
    <Dialog title={t('keys.title')} onClose={onClose}>
      <ul className="keys">
        {keys.map((key) => (
          <li key={key}>{t(`keys.${key}`)}</li>
        ))}
      </ul>
    </Dialog>
  )
}

/** Fonts scale from one place, so "large" is a real change everywhere at once. */
export function fontScaleStyle(settings: Settings): { fontSize: string } {
  return { fontSize: `${FONT_SCALES[settings.fontScale] * 100}%` }
}
