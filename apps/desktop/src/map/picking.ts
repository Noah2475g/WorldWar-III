/**
 * Which province was clicked, and where the map is looking (T-M10-03a, R-UI-03).
 *
 * Pure geometry, deliberately: a click test that needs a browser can only be checked
 * by a person moving a mouse, and "the wrong province was selected" is exactly the
 * kind of bug that survives that. Here it is arithmetic, and arithmetic can be pinned
 * down by a test.
 */

export interface Point {
  x: number
  y: number
}

export interface View {
  /** Map coordinate at the top-left of the viewport. */
  x: number
  y: number
  /** Map units per screen pixel; larger means further out. */
  scale: number
}

export interface PickableProvince {
  id: string
  polygon: readonly (readonly [number, number])[]
  /** Axis-aligned bounds, so most provinces are ruled out with four comparisons. */
  bounds?: Bounds
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function boundsOf(polygon: readonly (readonly [number, number])[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of polygon) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/** Screen pixel to map coordinate. */
export function toMap(point: Point, view: View): Point {
  return { x: view.x + point.x * view.scale, y: view.y + point.y * view.scale }
}

/** Map coordinate to screen pixel. */
export function toScreen(point: Point, view: View): Point {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale }
}

/** Ray casting. A point exactly on an edge counts as inside — the player clicked it. */
export function pointInPolygon(
  point: Point,
  polygon: readonly (readonly [number, number])[],
): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!
    const [xj, yj] = polygon[j]!
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * The province under a screen point, or null.
 *
 * Provinces are tested in the order given and the first hit wins. Overlaps do not
 * happen on a merged map, so the order only decides ties along a shared border — and
 * for those any answer is right as long as it is always the same one.
 */
export function pickProvince(
  screen: Point,
  view: View,
  provinces: readonly PickableProvince[],
): string | null {
  const point = toMap(screen, view)

  for (const province of provinces) {
    const bounds = province.bounds ?? boundsOf(province.polygon)
    if (point.x < bounds.minX || point.x > bounds.maxX) continue
    if (point.y < bounds.minY || point.y > bounds.maxY) continue
    if (pointInPolygon(point, province.polygon)) return province.id
  }
  return null
}

export interface ViewLimits {
  width: number
  height: number
  viewportWidth: number
  viewportHeight: number
  minScale: number
  maxScale: number
}

/**
 * Keeps the view on the map.
 *
 * Without this, one flick of the wheel leaves the player looking at empty space with
 * no way back — and every complaint about it arrives as "the map disappeared", which
 * is hard to act on. Clamping is cheaper than a reset button.
 */
export function clampView(view: View, limits: ViewLimits): View {
  const scale = Math.min(limits.maxScale, Math.max(limits.minScale, view.scale))
  const visibleWidth = limits.viewportWidth * scale
  const visibleHeight = limits.viewportHeight * scale

  // When the map is smaller than the viewport it is centred rather than pinned to a
  // corner; anything else looks like a rendering fault.
  const x =
    visibleWidth >= limits.width
      ? (limits.width - visibleWidth) / 2
      : Math.min(limits.width - visibleWidth, Math.max(0, view.x))
  const y =
    visibleHeight >= limits.height
      ? (limits.height - visibleHeight) / 2
      : Math.min(limits.height - visibleHeight, Math.max(0, view.y))

  return { x, y, scale }
}

/** Zoom towards a point on screen, so the map does not slide out from under the cursor. */
export function zoomAt(view: View, screen: Point, factor: number, limits: ViewLimits): View {
  const anchor = toMap(screen, view)
  const scale = Math.min(limits.maxScale, Math.max(limits.minScale, view.scale * factor))
  return clampView({ x: anchor.x - screen.x * scale, y: anchor.y - screen.y * scale, scale }, limits)
}

/** Centres the view on a map point — what "jump to province" does. */
export function centreOn(point: Point, view: View, limits: ViewLimits): View {
  return clampView(
    {
      x: point.x - (limits.viewportWidth * view.scale) / 2,
      y: point.y - (limits.viewportHeight * view.scale) / 2,
      scale: view.scale,
    },
    limits,
  )
}

/**
 * The layers of the map, in drawing order (design D11).
 *
 * Written down as data rather than as the order of statements in a render function,
 * because the order is a decision — armies above borders, selection above armies,
 * labels above everything — and a decision buried in call order cannot be tested.
 */
export const LAYERS = [
  'sea',
  'provinces',
  'borders',
  'infrastructure',
  'armies',
  'selection',
  'labels',
] as const

export type Layer = (typeof LAYERS)[number]

/**
 * Which layers have to be redrawn for a given change.
 *
 * The 237 filled province shapes are the expensive layer and they only change when
 * ownership, the map mode or the zoom changes — so they are cached and everything
 * cheap is drawn on top of them every frame (design D11).
 */
export function layersToRedraw(change: 'frame' | 'selection' | 'ownership' | 'mode' | 'zoom'): Layer[] {
  switch (change) {
    case 'frame':
      return ['armies', 'selection']
    case 'selection':
      return ['selection']
    case 'ownership':
    case 'mode':
    case 'zoom':
      return [...LAYERS]
  }
}
