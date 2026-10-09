import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n/text.ts'
import { Icon } from './Icon.tsx'
import type { PictureName } from './Icon.tsx'

/**
 * Das Blatt (T-M44-03b, R-UX-01, Befund B-01): die Seitenleiste des Telefons im Hochformat hat
 * drei Rasten — Streifen, halb, voll. Dieser Griff schaltet sie; die Hoehe jeder Raste steht in
 * `touch.css` (`--map-h` je `data-sheet` an `.app`). Ausserhalb des Hochformats ist er unsichtbar.
 *
 * Er ist ein Knopf und kein Ziehbereich: Klick, Pfeiltasten und Wischen schalten, Escape schliesst
 * das Panel. Ein Wisch (mehr als `SWIPE_PX` senkrecht) geht eine Raste weiter, ein Tippen schaltet
 * reihum — und ein Wisch loest den anschliessenden Klick nicht ein zweites Mal aus.
 */
export type SheetSnap = 'peek' | 'half' | 'full'

export const SHEET_SNAPS: readonly SheetSnap[] = ['peek', 'half', 'full']

/** Ab dieser senkrechten Strecke ist es ein Wisch und kein Tippen. */
const SWIPE_PX = 40

export function nextSnap(current: SheetSnap, direction: 'up' | 'down'): SheetSnap {
  const index = SHEET_SNAPS.indexOf(current)
  const target = direction === 'up' ? Math.min(SHEET_SNAPS.length - 1, index + 1) : Math.max(0, index - 1)
  return SHEET_SNAPS[target]!
}

export function SheetHandle({
  snap,
  onSnap,
  onClose,
}: {
  snap: SheetSnap
  onSnap: (snap: SheetSnap) => void
  onClose: () => void
}) {
  const startY = useRef<number | null>(null)
  const swiped = useRef(false)

  return (
    <button
      type="button"
      className="sheet__handle"
      aria-label={`${t('sheet.handle')}: ${t(`sheet.snap.${snap}`)}`}
      onPointerDown={(event) => {
        startY.current = event.clientY
        swiped.current = false
      }}
      onPointerUp={(event) => {
        if (startY.current === null) return
        const dy = event.clientY - startY.current
        startY.current = null
        if (Math.abs(dy) < SWIPE_PX) return
        swiped.current = true
        onSnap(nextSnap(snap, dy < 0 ? 'up' : 'down'))
      }}
      onClick={() => {
        if (swiped.current) {
          swiped.current = false
          return
        }
        onSnap(SHEET_SNAPS[(SHEET_SNAPS.indexOf(snap) + 1) % SHEET_SNAPS.length]!)
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          onSnap(nextSnap(snap, 'up'))
        } else if (event.key === 'ArrowDown') {
          event.preventDefault()
          onSnap(nextSnap(snap, 'down'))
        } else if (event.key === 'Escape') {
          onClose()
        }
      }}
    >
      <span className="sheet__grip" aria-hidden="true" />
      <span>{t(`sheet.snap.${snap}`)}</span>
    </button>
  )
}

/** Das Hochformat des Telefons, in dem das Blatt gilt (dieselbe Abfrage wie `touch.css` und der Auto-Schwenk in App.tsx). */
const PHONE_PORTRAIT = '(max-width: 599px) and (orientation: portrait)'

/** Ist gerade das Blatt des Telefons im Hochformat zu sehen? Ohne `matchMedia` (Tests, Server) nein. */
export function usePhonePortrait(): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_PORTRAIT).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(PHONE_PORTRAIT)
    const update = (): void => setMatches(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return matches
}

/** Die Panels, die das Blatt direkt anbietet (T-M46-10): dieselben wie die Knoepfe im Fuss. */
export type SheetPanel = 'diplomacy' | 'market' | 'armies' | 'espionage' | 'standings' | 'economy' | 'log'

const SHEET_NAV: readonly { panel: SheetPanel; icon: PictureName; label: string }[] = [
  { panel: 'diplomacy', icon: 'alliance', label: 'header.diplomacy' },
  { panel: 'market', icon: 'money', label: 'header.market' },
  { panel: 'armies', icon: 'infantry', label: 'foot.armies' },
  { panel: 'espionage', icon: 'spyEconomic', label: 'foot.espionage' },
  { panel: 'standings', icon: 'capital', label: 'foot.standingsOpen' },
  // Seit E3 (D7) gibt es keinen Fuss mehr: Wirtschaft und Protokoll sind Bereiche wie die anderen.
  { panel: 'economy', icon: 'economy', label: 'rail.economy' },
  { panel: 'log', icon: 'logbook', label: 'rail.log' },
]

/**
 * Die Panelwahl im Kopf des Blatts (T-M46-10): ist das Blatt halb oder voll offen, deckt es den Fuss (Karte >= 30 %
 * und Blatt 50 % passen sonst nicht auf 667 px), und mit ihm waeren Diplomatie, Markt, Heer, Spionage und Lage nur
 * ueber Schliessen oder die Raste Streifen erreichbar. Hier bleiben sie einen Tipp weit weg - nur als Zeichen, der
 * Name steht im Tooltip und fuers Ohr.
 */
export function SheetNav({ active, onPanel }: { active: string | null; onPanel: (panel: SheetPanel) => void }) {
  return (
    <nav className="sheet__nav" aria-label={t('sheet.nav')}>
      {SHEET_NAV.map((entry) => (
        <button
          key={entry.panel}
          type="button"
          className="sheet__navbutton"
          data-area={entry.panel}
          aria-pressed={active === entry.panel}
          aria-label={t(entry.label)}
          title={t(entry.label)}
          onClick={() => onPanel(entry.panel)}
        >
          <Icon name={entry.icon} size={16} />
        </button>
      ))}
    </nav>
  )
}
