import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PublicView } from '@worldwar/core'
import type { Namer } from '../game/names.ts'
import { toScreen, type View } from '../map/picking.ts'
import { tooltipFor, type TooltipData } from './Tooltip.tsx'

/**
 * Hover- und Tooltip-Zustand der Karte (T-M44-02b, Nahtstelle für R-UX-02/AK3 und T-M44-07).
 *
 * Aus `App.tsx` herausgezogen, **ohne** dass sich etwas ändert: derselbe Zustand, dieselben
 * Ableitungen, dieselbe Reihenfolge der Haken (T-M31-01, D27.6).
 *
 * Der Provinz-Tooltip folgt dem Zeiger — und der Auswahl **nur, wenn die Tastatur gewählt hat**
 * (T-M44-07, R-UX-02/AK3, Befund B-06). Vorher galt `hover?.id ?? selectedProvince`: jede Auswahl
 * hielt den Kasten, auch die mit der Maus, und er blieb über der Depesche stehen, als der Zeiger
 * längst fort war. Absicht war es nur für die Tastatur (T-M31-01): wer ohne Maus spielt, bekommt
 * dieselbe Auskunft am selben Ort. Unter einem offenen Dialog gibt es nie einen Kasten. Escape
 * blendet ihn aus, bis sich Auswahl oder Zeiger ändern.
 *
 * **Woran die Hülle erkennt, wer gewählt hat:** an der letzten Eingabe vor der Auswahl — ein
 * Tastendruck oder ein Druck mit Maus oder Finger (`keydown` gegen `pointerdown` auf dem
 * Dokument, in der Fangphase). Ohne jede Eingabe gilt „Zeiger": ein Kasten, der von selbst
 * aufgeht, ist schlimmer als einer, der fehlt.
 */

export interface MapHover {
  id: string
  x: number
  y: number
}

export interface MapTooltipInput {
  selectedProvince: string | null
  /** Ein Dialog (oder der gesperrte Vorhang) liegt über der Karte: dann zeigt sie nichts (R-UX-02/AK3). */
  dialogOpen: boolean
  /** Ausschnitt der Karte — bestimmt, wo der Auswahl-Tooltip steht. */
  mapView: View
  view: PublicView | null
  centres: Readonly<Record<string, { x: number; y: number }>>
  nameOfProvince: Namer
  nameOf: Namer
  ticksPerDay: number
}

export interface MapTooltip {
  /** Der Zeiger steht über dieser Provinz (oder nirgends). */
  hover: MapHover | null
  /** Für `MapCanvas.onHover`: Provinz und Bildpunkt, oder nichts, wenn der Zeiger die Karte verlässt. */
  onHover: (id: string | null, at: { x: number; y: number } | null | undefined) => void
  /** Escape: ausblenden, bis sich Auswahl oder Zeiger ändern. */
  hide: () => void
  tooltip: TooltipData | null
  tooltipAt: { x: number; y: number } | null
  /** Der Kasten gehört zur schon gewählten Provinz: er nennt dann keine Mausbedienung („Klicken: auswählen"). */
  selected: boolean
}

type InputKind = 'keyboard' | 'pointer'

export function useMapTooltip(input: MapTooltipInput): MapTooltip {
  const { selectedProvince, dialogOpen, mapView, view, centres, nameOfProvince, nameOf, ticksPerDay } = input
  const [hover, setHover] = useState<MapHover | null>(null)
  const [tooltipHidden, setTooltipHidden] = useState(false)

  // Die letzte Eingabeart. Ein Ref und kein Zustand: sie ändert nichts am Bild, erst die Auswahl tut es.
  const lastInput = useRef<InputKind>('pointer')
  useEffect(() => {
    const keyboard = () => {
      lastInput.current = 'keyboard'
    }
    const pointer = () => {
      lastInput.current = 'pointer'
    }
    document.addEventListener('keydown', keyboard, true)
    document.addEventListener('pointerdown', pointer, true)
    // Ältere Browser und Prüfumgebungen ohne Zeigerereignisse melden nur Maus und Berührung.
    document.addEventListener('mousedown', pointer, true)
    document.addEventListener('touchstart', pointer, true)
    return () => {
      document.removeEventListener('keydown', keyboard, true)
      document.removeEventListener('pointerdown', pointer, true)
      document.removeEventListener('mousedown', pointer, true)
      document.removeEventListener('touchstart', pointer, true)
    }
  }, [])

  // Wer hat diese Auswahl getroffen? Beim Wechsel der Auswahl, im selben Bild festgehalten (kein Effekt:
  // der ließe ein Bild lang den Kasten der alten Art über der neuen Provinz stehen).
  const [origin, setOrigin] = useState<{ id: string | null; byKeyboard: boolean }>({
    id: selectedProvince,
    byKeyboard: false,
  })
  let byKeyboard = origin.byKeyboard
  if (origin.id !== selectedProvince) {
    byKeyboard = lastInput.current === 'keyboard'
    setOrigin({ id: selectedProvince, byKeyboard })
  }

  // Der Zeiger zeigt; sonst zeigt die Auswahl — aber nur, wenn die Tastatur gewählt hat.
  const selectionId = byKeyboard ? selectedProvince : null
  const tooltipId = dialogOpen ? null : (hover?.id ?? selectionId)
  const tooltip = useMemo(
    () =>
      tooltipHidden
        ? null
        : tooltipFor(tooltipId, view, { nameOf: nameOfProvince, playerName: nameOf, ticksPerDay }),
    [tooltipHidden, tooltipId, view, nameOfProvince, nameOf, ticksPerDay],
  )
  const tooltipAt = useMemo(() => {
    if (hover) return { x: hover.x, y: hover.y }
    const centre = selectionId ? centres[selectionId] : undefined
    return centre ? toScreen(centre, mapView) : null
  }, [hover, selectionId, centres, mapView])
  useEffect(() => {
    setTooltipHidden(false)
  }, [tooltipId])
  const onHover = useCallback((id: string | null, at: { x: number; y: number } | null | undefined) => {
    setHover(id && at ? { id, x: at.x, y: at.y } : null)
  }, [])
  const hide = useCallback(() => setTooltipHidden(true), [])
  return { hover, onHover, hide, tooltip, tooltipAt, selected: tooltipId !== null && tooltipId === selectedProvince }
}
