import { useCallback, useEffect, useMemo, useState } from 'react'
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
 * Der Provinz-Tooltip folgt dem Zeiger, sonst der Auswahl — dieselbe Auskunft für Maus und Tastatur.
 * Escape blendet ihn aus, bis sich Auswahl oder Zeiger ändern. Genau diese Regel will
 * T-M44-07 ändern (Auswahl-Tooltip nur bei Tastaturauswahl, nie bei offenem Dialog); wer das tut,
 * tut es **hier**.
 */

export interface MapHover {
  id: string
  x: number
  y: number
}

export interface MapTooltipInput {
  selectedProvince: string | null
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
}

export function useMapTooltip(input: MapTooltipInput): MapTooltip {
  const { selectedProvince, mapView, view, centres, nameOfProvince, nameOf, ticksPerDay } = input
  const [hover, setHover] = useState<MapHover | null>(null)
  const [tooltipHidden, setTooltipHidden] = useState(false)
  const tooltipId = hover?.id ?? selectedProvince
  const tooltip = useMemo(
    () =>
      tooltipHidden
        ? null
        : tooltipFor(tooltipId, view, { nameOf: nameOfProvince, playerName: nameOf, ticksPerDay }),
    [tooltipHidden, tooltipId, view, nameOfProvince, nameOf, ticksPerDay],
  )
  const tooltipAt = useMemo(() => {
    if (hover) return { x: hover.x, y: hover.y }
    const centre = selectedProvince ? centres[selectedProvince] : undefined
    return centre ? toScreen(centre, mapView) : null
  }, [hover, selectedProvince, centres, mapView])
  useEffect(() => {
    setTooltipHidden(false)
  }, [tooltipId])
  const onHover = useCallback((id: string | null, at: { x: number; y: number } | null | undefined) => {
    setHover(id && at ? { id, x: at.x, y: at.y } : null)
  }, [])
  const hide = useCallback(() => setTooltipHidden(true), [])
  return { hover, onHover, hide, tooltip, tooltipAt }
}
