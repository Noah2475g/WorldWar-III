import { useRef } from 'react'
import { t } from '../i18n/text.ts'

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
