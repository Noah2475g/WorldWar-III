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

export type Ring = readonly (readonly [number, number])[]

export interface PickableProvince {
  id: string
  /** One outline per piece of land — a province may be in several (T-M19-02). */
  polygons: readonly Ring[]
  /** Axis-aligned bounds, so most provinces are ruled out with four comparisons. */
  bounds?: Bounds
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * The box around *all* of a province's outlines.
 *
 * The hull of several pieces is larger than any one of them — for `USA-WEST` it spans
 * from Alaska to Arizona — so it rules out fewer clicks than it used to. That is the
 * price of the province being in two places, and it is only a prefilter: the ray cast
 * below still decides, and it walks each ring separately.
 */
export function boundsOf(polygons: readonly Ring[]): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const ring of polygons) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
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

/** Shoelace area of a ring. Only needed to break a tie between overlapping outlines. */
function ringArea(ring: Ring): number {
  let twice = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!
    const b = ring[j]!
    twice += b[0] * a[1] - a[0] * b[1]
  }
  return Math.abs(twice) / 2
}

/**
 * The province under a screen point, or null.
 *
 * Where two outlines cover the same point, the **smaller** one wins (T-M19-04). That is
 * not a tie-break for its own sake: on this map exactly one point in 196 196 is claimed
 * twice, and it is an enclave — the Australian Capital Territory belongs to `AUS-SE`
 * and lies inside New South Wales, which belongs to `AUS-NE`, because the source
 * outline of the larger province has no hole cut for the smaller one.
 *
 * The order of the list used to decide, and `AUS-NE` comes first, so `AUS-SE` could
 * only be clicked on Macquarie Island — five pixels, 331 of them south of the country
 * it belongs to. A province that cannot be clicked where it is, is not one.
 */
export function pickProvince(
  screen: Point,
  view: View,
  provinces: readonly PickableProvince[],
): string | null {
  const point = toMap(screen, view)

  let bestId: string | null = null
  let bestArea = Infinity

  for (const province of provinces) {
    const bounds = province.bounds ?? boundsOf(province.polygons)
    if (point.x < bounds.minX || point.x > bounds.maxX) continue
    if (point.y < bounds.minY || point.y > bounds.maxY) continue

    for (const ring of province.polygons) {
      // Any piece counts: a click on Alaska and a click on California both select the
      // western United States, because both are the western United States.
      if (!pointInPolygon(point, ring)) continue
      const area = ringArea(ring)
      // Strictly smaller, so equal outlines keep the order they were given in — a tie
      // along a shared border may be decided either way, but always the same way.
      if (area < bestArea) {
        bestArea = area
        bestId = province.id
      }
      break
    }
  }
  return bestId
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
