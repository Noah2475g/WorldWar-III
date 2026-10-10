/**
 * Sichtbarer Kartenbereich (Seitenleiste v3b E5, Plan D12; Mentor-Korrektur t_e31e9df4):
 * Map-Utility, KEINE Dock-Positionierung. `visibleRect` berechnet die Kartenflaeche
 * abzueglich linker Hinweisspalte, rechter Werkzeuge, unterer Leiste (Dock/Fuss) und
 * eines festen 12px-Abstands oben. `centreOnVisible` zentriert einen Punkt (z. B. eine
 * Provinz-Mitte) innerhalb dieses Rechtecks und klemmt das Ergebnis an optionale
 * aeussere Limits (z. B. die Kartengrenzen selbst).
 *
 * Nutzen (D12): Positionierung von Hint-Jump, Toast-Jump, Popup-Lage (E5b/E6/E7).
 */

export interface ViewportSize {
  width: number
  height: number
}

export interface MapInsets {
  /** Breite der linken Hinweisspalte (px), falls sichtbar. */
  hintColumnWidth?: number
  /** Breite der rechten Werkzeuge (px), falls sichtbar. */
  toolsWidth?: number
  /** Hoehe der unteren Leiste (Dock/Fuss, px). */
  bottomBarHeight?: number
  /** Fester Abstand oben (px), Default 12 (D12). */
  topInset?: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

const DEFAULT_TOP_INSET = 12

/** Sichtbares Kartenrechteck innerhalb der Ansicht, nach Abzug der Insets (D12). */
export function visibleRect(viewport: ViewportSize, insets: MapInsets = {}): Rect {
  const left = Math.max(0, insets.hintColumnWidth ?? 0)
  const right = Math.max(0, insets.toolsWidth ?? 0)
  const bottom = Math.max(0, insets.bottomBarHeight ?? 0)
  const top = Math.max(0, insets.topInset ?? DEFAULT_TOP_INSET)
  const width = Math.max(0, viewport.width - left - right)
  const height = Math.max(0, viewport.height - top - bottom)
  return { x: left, y: top, width, height }
}

/**
 * Zentriert eine Box der Groesse `view` auf `point`, geklemmt in `rect` (und optional
 * zusaetzlich in `limits`, z. B. die tatsaechlichen Kartengrenzen). Passt die Box nicht
 * nicht-negativ ein, wenn `view` groesser als `rect`/`limits` ist (dann bleibt sie am
 * Rand ausgerichtet statt negativ zu ragen).
 */
export function centreOnVisible(point: Point, view: ViewportSize, rect: Rect, limits?: Rect): Point {
  const clampAxis = (value: number, min: number, max: number): number => {
    if (max < min) return min
    return Math.min(Math.max(value, min), max)
  }

  let x = point.x - view.width / 2
  let y = point.y - view.height / 2

  x = clampAxis(x, rect.x, rect.x + Math.max(0, rect.width - view.width))
  y = clampAxis(y, rect.y, rect.y + Math.max(0, rect.height - view.height))

  if (limits) {
    x = clampAxis(x, limits.x, limits.x + Math.max(0, limits.width - view.width))
    y = clampAxis(y, limits.y, limits.y + Math.max(0, limits.height - view.height))
  }

  return { x, y }
}
