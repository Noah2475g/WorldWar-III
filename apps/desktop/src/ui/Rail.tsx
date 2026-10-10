import { t } from '../i18n/text.ts'
import { Icon, type PictureName } from './Icon.tsx'

/**
 * Die schwebende Leiste rechts (Seitenleiste v3b E3, D6).
 *
 * Sieben Bereiche, je ein Knopf `button.rail__item[data-area]` mit Bild, Name darunter und
 * der Taste als Marke; oben `button.rail__toggle` (Taste W). Ein Klick auf einen Bereich
 * oeffnet ihn in der Seitenleiste (`aside.side`), ein zweiter Klick auf denselben schliesst
 * sie — derselbe eine Klick wie frueher der Fussknopf. Der Ungelesen-Zaehler (D28) haengt an
 * der Rangliste. Die Leiste selbst haelt keinen Zustand: offen ist, was `ui.panel` sagt.
 */
export type RailArea = 'diplomacy' | 'market' | 'armies' | 'espionage' | 'standings' | 'economy' | 'log'

export interface RailEntry {
  area: RailArea
  /** Die Taste als Marke, oder null fuer Bereiche ohne eigene Taste. */
  key: string | null
  icon: PictureName
  label: () => string
}

export const RAIL_ENTRIES: readonly RailEntry[] = [
  { area: 'diplomacy', key: 'D', icon: 'alliance', label: () => t('rail.diplomacy') },
  { area: 'market', key: 'H', icon: 'market', label: () => t('rail.market') },
  // E3 R1 (P3): gekreuzte Schwerter (v3b-Bild) — das NATO-Rechteck mit Kreuz (infantry) wirkte
  // bei 20 px wie ein Briefumschlag und war vom Protokoll-Zeichen nicht zu unterscheiden.
  { area: 'armies', key: 'A', icon: 'battle', label: () => t('rail.armies') },
  { area: 'espionage', key: 'S', icon: 'espionage', label: () => t('rail.espionage') },
  { area: 'standings', key: 'L', icon: 'trophy', label: () => t('rail.standings') },
  { area: 'economy', key: null, icon: 'economy', label: () => t('rail.economy') },
  { area: 'log', key: null, icon: 'logbook', label: () => t('rail.log') },
]

export function isRailArea(panel: string | null | undefined): panel is RailArea {
  return RAIL_ENTRIES.some((entry) => entry.area === panel)
}

/** Der zuletzt offene Bereich der Leiste (D6): Taste W oeffnet ihn wieder. */
export const SIDE_LAST_AREA_KEY = 'worldwar.side.lastArea'

/** Letzter Bereich aus localStorage, sonst Diplomatie. Ein frischer Stand ist zu (`ui.panel` null). */
export function readLastSideArea(): RailArea {
  try {
    const stored = window.localStorage?.getItem(SIDE_LAST_AREA_KEY)
    return isRailArea(stored) ? stored : 'diplomacy'
  } catch {
    return 'diplomacy'
  }
}

export interface RailProps {
  /** Das offene Panel (`ui.panel`); markiert den passenden Eintrag. */
  active: string | null
  /** Ist die Seitenleiste offen (gleich welcher Inhalt)? */
  open: boolean
  /** Neue Protokollzeilen seit dem letzten Oeffnen der Rangliste (D28). */
  unread: number
  onArea: (area: RailArea, trigger: HTMLElement) => void
  onToggle: (trigger: HTMLElement) => void
}

export function Rail({ active, open, unread, onArea, onToggle }: RailProps) {
  return (
    <nav className="rail" aria-label={t('rail.label')} data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        className="rail__toggle"
        aria-expanded={open}
        aria-label={open ? t('rail.close') : t('rail.open')}
        title={`${open ? t('rail.close') : t('rail.open')} (W)`}
        onClick={(event) => onToggle(event.currentTarget)}
      >
        <span aria-hidden="true">‹</span>
      </button>
      {RAIL_ENTRIES.map((entry) => {
        const label = entry.label()
        const pressed = active === entry.area
        return (
          <button
            key={entry.area}
            type="button"
            className={pressed ? 'rail__item rail__item--active' : 'rail__item'}
            data-area={entry.area}
            aria-pressed={pressed}
            aria-keyshortcuts={entry.key ?? undefined}
            title={entry.key ? `${label} (${entry.key})` : label}
            onClick={(event) => onArea(entry.area, event.currentTarget)}
          >
            <Icon name={entry.icon} size={20} className="rail__icon" />
            <span className="rail__name">{label}</span>
            {entry.key && (
              <kbd className="rail__key" aria-hidden="true">
                {entry.key}
              </kbd>
            )}
            {entry.area === 'standings' && unread > 0 && (
              <span className="badge rail__badge" aria-label={t('foot.unread', { count: unread })}>
                {unread}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
