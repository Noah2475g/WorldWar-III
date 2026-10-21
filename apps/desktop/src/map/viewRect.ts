/**
 * Sichtbarer Kartenausschnitt in Kartenraum (E7, D8-Folge-Fix zu M49).
 *
 * `ui/viewRect.ts` zentriert Bildschirm-Boxen (Popups) im sichtbaren Rechteck der
 * Ansicht. Hier geht es um etwas anderes: einen Kartenpunkt (z. B. die Sammelmarke)
 * so zentrieren, dass er NICHT unter der Leiste unten/den Werkzeugen landet, sondern
 * in der Mitte des tatsaechlich sichtbaren Kartenbereichs. Reine Geometrie auf `View`
 * (x, y, scale) wie `picking.ts#centreOn` — nur mit Insets statt voller Leinwandmitte.
 */

import { clampView, type Point, type View, type ViewLimits } from './picking.ts'
import { visibleRect, type MapInsets } from '../ui/viewRect.ts'

/**
 * Wie `picking.ts#centreOn`, aber der Punkt landet in der Mitte des sichtbaren
 * Rechtecks (nach Abzug von `insets`), nicht in der Mitte der ganzen Leinwand —
 * sitzt z. B. die Leiste unten drauf, bleibt der Punkt darueber sichtbar (D8).
 */
export function centreOnVisible(point: Point, view: View, limits: ViewLimits, insets: MapInsets = {}): View {
  const rect = visibleRect({ width: limits.viewportWidth, height: limits.viewportHeight }, insets)
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  return clampView(
    {
      x: point.x - cx * view.scale,
      y: point.y - cy * view.scale,
      scale: view.scale,
    },
    limits,
  )
}
