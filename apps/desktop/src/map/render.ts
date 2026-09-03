import { boundsOf, toScreen, type Bounds, type View } from './picking.ts'
import { fillFor, type MapMode, type ShadedProvince } from './modes.ts'
import { TOKENS } from '../ui/tokens.ts'

/**
 * Preparing a frame of the map (T-M10-03b, R-ARCH-06/AK2).
 *
 * The drawing itself is a handful of canvas calls; what decides whether the map holds
 * sixty frames a second is what it *skips*. Two things do the work here, and both are
 * pure functions so the budget can be measured without a browser:
 *
 *  - Anything outside the viewport is dropped before a single path is built. At full
 *    zoom that is most of the world.
 *  - Points are thinned with the zoom. At world scale a province is twenty pixels
 *    wide and its four hundred coastline points land on the same handful of them.
 */

export interface RenderProvince extends ShadedProvince {
  polygon: readonly (readonly [number, number])[]
  bounds?: Bounds
}

export interface Viewport {
  width: number
  height: number
}

export interface PreparedShape {
  id: string
  fill: string
  /** Screen-space points, already thinned for this zoom. */
  points: [number, number][]
}

/** Is any part of this province on screen? */
export function isVisible(bounds: Bounds, view: View, viewport: Viewport): boolean {
  const right = view.x + viewport.width * view.scale
  const bottom = view.y + viewport.height * view.scale
  return !(bounds.maxX < view.x || bounds.minX > right || bounds.maxY < view.y || bounds.minY > bottom)
}

/**
 * Drops points that would land on the same pixel.
 *
 * Not a simplification of the shape — a simplification of the *drawing*. The province
 * data keeps every point; this decides how many of them are worth sending to the
 * canvas at the current zoom, and at world scale that is a fraction.
 */
export function thin(
  polygon: readonly (readonly [number, number])[],
  view: View,
  minPixels = 1.5,
): [number, number][] {
  if (polygon.length <= 4) return polygon.map(([x, y]) => [x, y])

  const step = minPixels * view.scale
  const out: [number, number][] = []
  let lastX = Number.NEGATIVE_INFINITY
  let lastY = Number.NEGATIVE_INFINITY

  for (const [x, y] of polygon) {
    if (Math.abs(x - lastX) < step && Math.abs(y - lastY) < step) continue
    out.push([x, y])
    lastX = x
    lastY = y
  }

  // A shape thinned below a triangle is not a shape; keep the original rather than
  // drawing a line where a province should be.
  return out.length >= 3 ? out : polygon.map(([x, y]) => [x, y])
}

/** Everything the canvas needs for one frame, and nothing it does not. */
export function prepareFrame(
  provinces: readonly RenderProvince[],
  view: View,
  viewport: Viewport,
  mode: MapMode,
): PreparedShape[] {
  const shapes: PreparedShape[] = []

  for (const province of provinces) {
    const bounds = province.bounds ?? boundsOf(province.polygon)
    if (!isVisible(bounds, view, viewport)) continue

    const points = thin(province.polygon, view).map(([x, y]) => {
      const screen = toScreen({ x, y }, view)
      return [screen.x, screen.y] as [number, number]
    })

    shapes.push({ id: province.id, fill: fillFor(province, mode), points })
  }

  return shapes
}

/**
 * The key a cached province layer is valid for.
 *
 * The filled shapes are the expensive layer and they change only when one of these
 * four things does (design D11). Anything else — a moving army, a new selection — is
 * drawn on top of the cached picture.
 */
export function cacheKey(view: View, mode: MapMode, ownershipVersion: number): string {
  // Position is not part of the key: panning moves the cached image rather than
  // rebuilding it. Zoom is, because the thinning depends on it.
  return `${mode}|${ownershipVersion}|${view.scale.toFixed(3)}`
}

/** Border and label colours are the same in every mode — the map stays legible. */
export const MAP_COLORS = {
  sea: TOKENS.water,
  border: TOKENS.line,
  selection: TOKENS.ink,
  label: TOKENS.onPlayer,
  /** Heller Saum unter der Kartenschrift, damit sie auf jeder Fuellung lesbar bleibt. */
  labelHalo: TOKENS.paper,
  battle: TOKENS.accent,
} as const
