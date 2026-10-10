import type { ReactNode } from 'react'
import { t } from '../i18n/text.ts'

/**
 * Die schwebende Leiste unten (E5, D9): Provinz/Armee ziehen aus der Seitenleiste hierher.
 *
 * `section.dock[data-state=...]` traegt die Zustandsklasse, die in app.css die feste
 * Hoehe je Zustand festlegt (leer 56 · Provinz 110 · fremd 56 · Armee 116, Designer-
 * Korrektur t_8f0a95ce) — K1 verlangt scrollH/clientH = 1,00, also keine Hoehe aus dem
 * Inhalt, sondern aus der Klasse. `.picker` ist der Titel der Leiste (D9): ein
 * `<select>`, gestylt wie ein Provinzname, ohne eigenen Rahmen, mit Platzhalter
 * "Land anklicken" (Schluessel `dock.empty` getrennt von `province.pickNone`, A1).
 *
 * Diese Datei ist Basis-Layout + Funktions-Stubs (Scope A, E5a): Storyboard C
 * (clip-path, kein scaleY), Verdrahtung mit App.tsx/Panels.tsx (ProvincePanel/
 * ArmyPanel wiederverwenden statt doppeln) und ProvincePopup-Anbindung folgen in E5b.
 */

export type DockState = 'empty' | 'province' | 'foreign' | 'army'

export interface DockPickerOption {
  id: string
  label: string
}

export interface DockProps {
  state: DockState
  /** Titel-Picker (D9): leer bei state='empty', sonst die eigenen Provinzen. */
  pickerOptions?: readonly DockPickerOption[]
  pickerValue?: string | null
  onPickerChange?: (id: string | null) => void
  /** Haupt-Inhalt je Zustand (Provinz-/Armee-/Fremd-Panel) — wiederverwendet aus Panels.tsx in E5b. */
  children?: ReactNode
  /** Haupt-Aktion "Ausheben" (D9): genau eine, Taste E, aria-expanded fuers Raster. */
  onToggleRecruit?: () => void
  recruitOpen?: boolean
  recruitDisabled?: boolean
  /**
   * D19c: der Name der Region (`.dock__body`), analog der frueheren Seitenleiste
   * (ProvincePanel trug `aria-label={province.name}`, ArmyPanel `aria-label={t('army.title')}`) —
   * so bleiben bestehende `getByRole('region', {name})`-Zugriffe gueltig, auch wenn der Inhalt
   * jetzt im Dock statt in `aside.side` steht.
   */
  bodyLabel?: string | undefined
}

/** Die CSS-Klasse der Leiste fuer den Zustand (K1: feste Hoehe je Klasse, nicht aus dem Inhalt). */
export function dockStateClass(state: DockState): string {
  return `dock dock--${state}`
}

export function Dock({
  state,
  pickerOptions = [],
  pickerValue = null,
  onPickerChange,
  children,
  onToggleRecruit,
  recruitOpen = false,
  recruitDisabled = false,
  bodyLabel,
}: DockProps) {
  const showPicker = state !== 'empty'
  return (
    <section className={dockStateClass(state)} data-state={state}>
      <div className="dock__head">
        {showPicker ? (
          <div className="picker dock__picker">
            <select
              aria-label={t('dock.pickerAria')}
              value={pickerValue ?? ''}
              onChange={(event) => onPickerChange?.(event.target.value || null)}
              onKeyDown={(event) => {
                // D9/D16: Picker-Tastatursteuerung bleibt am Dock, nicht mehr an aside.side.
                if (event.key === 'Escape') {
                  event.currentTarget.closest('section.dock')?.querySelectorAll('select, button, input').forEach(() => undefined)
                }
              }}
            >
              <option value="">{t('dock.empty')}</option>
              {pickerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span className="dock__placeholder">{t('dock.empty')}</span>
        )}
        {state === 'province' && (
          <button
            type="button"
            className="button dock__recruit-action"
            aria-expanded={recruitOpen}
            aria-controls="recruit-sheet"
            disabled={recruitDisabled}
            onClick={() => onToggleRecruit?.()}
            title={t('dock.recruitActionAria')}
          >
            {t('dock.recruitAction')}
          </button>
        )}
      </div>
      <div className="dock__body" role={bodyLabel ? 'region' : undefined} aria-label={bodyLabel}>
        {children}
      </div>
    </section>
  )
}
