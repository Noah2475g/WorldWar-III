import { useEffect, useRef, type ReactNode } from 'react'
import { t } from '../i18n/text.ts'
import { DEFAULT_SETTINGS, FONT_SCALES, type Settings } from '../state/uiState.ts'
import type { Difficulty, NewGameOptions } from '../game/newGame.ts'

/**
 * Everything that opens over the map (T-M10-07a/b, T-M10-09, T-M10-10, T-M10-11).
 *
 * All of them share one dialogue shell, and the shell does the accessibility work
 * once: focus moves in on opening and back out on closing, Escape closes, and the
 * background cannot be reached by tab. Done per dialogue, that work gets forgotten in
 * the fourth one — and the fourth one is where a player gets stuck.
 */

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
    ref.current?.querySelector<HTMLElement>('button, input, select, [tabindex]')?.focus()
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
          if (event.key === 'Escape') onClose()
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
}: {
  options: NewGameOptions
  nations: readonly string[]
  maps: readonly { id: string; name: string; provinces: number }[]
  aiBonus: number
  onChange: (options: NewGameOptions) => void
  onStart: () => void
  onClose: () => void
}) {
  return (
    <Dialog title={t('newGame.title')} onClose={onClose}>
      <label className="field">
        <span>{t('newGame.map')}</span>
        <select value={options.mapId} onChange={(e) => onChange({ ...options, mapId: e.target.value })}>
          {maps.map((map) => (
            <option key={map.id} value={map.id}>
              {map.name} ({map.provinces})
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
      </label>

      <p className="notice notice--info">
        {aiBonus === 0 ? t('newGame.aiBonusNone') : t('newGame.aiBonus', { percent: aiBonus })}
      </p>

      <button type="button" className="button button--primary" onClick={onStart}>
        {t('newGame.start')}
      </button>
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
  onSave: (name: string) => void
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
              <button type="button" className="button" onClick={() => onSave(slot.name)}>
                {t('saves.save')}
              </button>
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

export function DebugPanel({ info, enabled }: { info: DebugInfo | null; enabled: boolean }) {
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
      <ul className="debug-list">
        {info.aiGoals.map((goal) => (
          <li key={goal.player}>
            <b>{goal.player}</b>: {goal.goal}{' '}
            <span className="mono">
              ({t('debug.aiUtility')} {goal.utility})
            </span>
            {goal.alternatives.length > 0 && (
              <div className="debug-alt">
                {t('debug.aiAlternatives')}: {goal.alternatives.join(', ')}
              </div>
            )}
          </li>
        ))}
      </ul>

      <h3>{t('debug.commandLog')}</h3>
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
