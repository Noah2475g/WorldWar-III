import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { centreOnVisible, visibleRect, type MapInsets, type Point, type ViewportSize } from './viewRect.ts'

/**
 * Eigenstaendiges Provinz-Popup (Seitenleiste v3b E5b, Plan D11): 288px breit, unabhaengig
 * vom Dock (unterer Leiste). Liegt ueber/neben der Provinz (Mittelpunkt + 16px Versatz nach
 * oben), geklemmt in den sichtbaren Kartenbereich (`visibleRect`/`centreOnVisible`, D12).
 *
 * Wird fuer die schnelle Vorschau einer fremden Provinz genutzt — der eigene Dock-Picker
 * (E5a) bleibt fuer eigene Provinzen und Armeen zustaendig, dieses Popup dafuer, ohne den
 * vollen ProvincePanel-Umfang zu brauchen.
 */

export const PROVINCE_POPUP_WIDTH = 288
const PROVINCE_POPUP_OFFSET_Y = 16

export interface ProvincePopupProps {
  /** Mittelpunkt der Provinz in Bildschirmkoordinaten (px). */
  anchor: Point
  /** Aktuelle Fenster-/Kartenansicht (px). */
  viewport: ViewportSize
  /** Insets fuer den sichtbaren Kartenbereich (Hinweisspalte, Werkzeuge, Leiste unten). */
  insets?: MapInsets
  title: string
  children?: ReactNode
  onClose?: () => void
}

/** Position des Popups (oben links), nach D11/D12 berechnet — fuer Tests ohne DOM nutzbar. */
export function provincePopupRect(
  anchor: Point,
  viewport: ViewportSize,
  insets: MapInsets = {},
  height: number,
): { x: number; y: number } {
  const rect = visibleRect(viewport, insets)
  // D11: ueber der Provinz (Mittelpunkt + 16px Versatz nach oben), danach ins Sichtbare geklemmt.
  const target: Point = { x: anchor.x, y: anchor.y - PROVINCE_POPUP_OFFSET_Y - height / 2 }
  return centreOnVisible(target, { width: PROVINCE_POPUP_WIDTH, height }, rect)
}

export function ProvincePopup({ anchor, viewport, insets, title, children, onClose }: ProvincePopupProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: anchor.x, y: anchor.y })

  useLayoutEffect(() => {
    const height = ref.current?.getBoundingClientRect().height ?? 160
    setPos(provincePopupRect(anchor, viewport, insets, height))
  }, [anchor.x, anchor.y, viewport.width, viewport.height, insets?.hintColumnWidth, insets?.toolsWidth, insets?.bottomBarHeight, insets?.topInset])

  return (
    <div
      ref={ref}
      className="province-popup"
      role="dialog"
      aria-label={title}
      style={{ position: 'fixed', left: pos.x, top: pos.y, width: PROVINCE_POPUP_WIDTH }}
    >
      <div className="province-popup__head">
        <span className="province-popup__title">{title}</span>
        {onClose ? (
          <button type="button" className="province-popup__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        ) : null}
      </div>
      <div className="province-popup__body">{children}</div>
    </div>
  )
}
