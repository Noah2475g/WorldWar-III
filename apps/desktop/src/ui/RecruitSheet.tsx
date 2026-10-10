import { useEffect, useState } from 'react'
import { t } from '../i18n/text.ts'
import { Dock, type DockPickerOption, type DockProps, type DockState } from './Dock.tsx'

/**
 * Das Ausheben-Raster (E5, D10): 432×196, 5×2 Felder, rechts ueber der Leiste unten (8 px),
 * Standard offen (Zuklappen schreibt `worldwar.recruit.open`='0'; fehlt der Schluessel -> offen).
 *
 * Basis-Layout + Funktions-Stubs (Scope A, E5a): echte Einheiten/Kosten/laufender Auftrag
 * kommen aus `RecruitUnit[]` (Platzhalter-Typ hier, endgueltige Form folgt mit der
 * App.tsx-Verdrahtung in E5b); Bauvorschau-Marken (`slot--short/--locked/--queue`) und die
 * Kostenzeile (`CostPreview`) werden dort wiederverwendet statt verdoppelt.
 */

const STORAGE_KEY = 'worldwar.recruit.open'

/** Liest den Offen/Zu-Zustand aus localStorage (D10: fehlender Schluessel = offen). */
export function readRecruitOpen(storage: Pick<Storage, 'getItem'> = window.localStorage): boolean {
  try {
    return storage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

export function writeRecruitOpen(open: boolean, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, open ? '1' : '0')
  } catch {
    // Privater Modus o.ae.: Zustand bleibt nur fuer die Sitzung im State, kein Absturz.
  }
}

export interface RecruitUnit {
  id: string
  name: string
  running?: number
  disabled?: boolean
}

export interface RecruitSheetProps {
  units: readonly RecruitUnit[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecruit: (unitId: string) => void
  freeSlots: number
}

/** Das Raster allein (D10): 5×2 Felder, Kopf mit Zaehler und Zuklapp-Knopf. */
export function RecruitSheet({ units, open, onOpenChange, onRecruit, freeSlots }: RecruitSheetProps) {
  const toggle = (): void => onOpenChange(!open)
  return (
    <section
      id="recruit-sheet"
      className={open ? 'recruit-sheet recruit-sheet--open' : 'recruit-sheet recruit-sheet--collapsed'}
      aria-hidden={!open}
    >
      <header className="recruit-sheet__head">
        <span>
          {t('recruitSheet.title')} · {t('recruitSheet.free', { count: freeSlots })}
        </span>
        <button
          type="button"
          className="button recruit-sheet__toggle"
          onClick={toggle}
          title={open ? t('recruitSheet.collapse') : t('recruitSheet.expand')}
        >
          {open ? '▾' : '▸'}
        </button>
      </header>
      {open && (
        <ul className="actions recruit-grid">
          {units.map((unit) => (
            <li key={unit.id} className={unit.disabled ? 'slot slot--locked' : 'slot slot--free slot--unit'}>
              <button
                type="button"
                disabled={unit.disabled}
                aria-label={t('recruitSheet.recruitAria', { unit: unit.name })}
                onClick={() => onRecruit(unit.id)}
              >
                <span className="slot__name">{unit.name}</span>
                {Boolean(unit.running) && <span className="slot__mark">{t('recruitSheet.running', { count: unit.running ?? 0 })}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export interface DockWithRecruitProps extends Omit<DockProps, 'onToggleRecruit' | 'recruitOpen' | 'recruitDisabled'> {
  recruit: RecruitSheetProps
}

/**
 * Panel-Grid: Leiste unten + Raster zusammen (E5a-Scope). Das Raster schwebt rechts
 * ueber der Leiste (CSS: `.recruit-sheet` ist relativ zu `.dock-area` positioniert,
 * siehe app.css), die Leiste traegt die Hauptaktion "Ausheben", die beide verbindet.
 */
export function DockWithRecruit({ recruit, state, pickerOptions, pickerValue, onPickerChange, bodyLabel, children }: DockWithRecruitProps) {
  return (
    <div className="dock-area">
      <Dock
        state={state}
        {...(pickerOptions !== undefined ? { pickerOptions } : {})}
        {...(pickerValue !== undefined ? { pickerValue } : {})}
        {...(onPickerChange !== undefined ? { onPickerChange } : {})}
        {...(bodyLabel !== undefined ? { bodyLabel } : {})}
        onToggleRecruit={() => recruit.onOpenChange(!recruit.open)}
        recruitOpen={recruit.open}
      >
        {children}
      </Dock>
      {state === 'province' && <RecruitSheet {...recruit} />}
    </div>
  )
}

/** Haelt den Offen/Zu-Zustand des Rasters an localStorage gebunden (D10). */
export function useRecruitOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState<boolean>(() => readRecruitOpen())
  useEffect(() => {
    writeRecruitOpen(open)
  }, [open])
  return [open, setOpen]
}

export type { DockPickerOption, DockState }
