import { toScreen, type Bounds, type Point, type View } from './picking.ts'
import { isVisible, type Viewport } from './render.ts'

/**
 * Which province names the map writes, and where (T-M13-08, R-UI-12).
 *
 * A map without names is a picture. This decides which of the 237 names are worth
 * drawing at the current zoom, and the deciding happens here rather than in the canvas
 * call for one concrete reason: jsdom has no canvas and cannot measure a font, so a
 * rule that lives inside the drawing is a rule no test will ever check. The text width
 * comes in as a function; the canvas passes its own `measureText`.
 *
 * Three rules, in order:
 *  - Nothing at world scale. A province is twenty pixels wide there and every name is
 *    longer than the country it names.
 *  - Nothing wider than its own province. Better no name than one written across three
 *    neighbours.
 *  - Nothing on top of a name already placed. The first one wins; the second stays away.
 */

/**
 * Beyond this many world units per pixel the map is an overview, not a map.
 *
 * Two is deliberately generous: the game opens at 1.6, and a threshold of 1.2 meant the
 * first thing a new player saw was a map with no names on it. The width rule below does
 * the real filtering — at this scale only provinces the size of the American Midwest
 * have room for their name, which is exactly the ones worth labelling from that far out.
 */
export const LABEL_MAX_SCALE = 2

/** Half the line height, for the box a label occupies. */
const LABEL_HALF_HEIGHT = 7

export interface LabelCandidate {
  id: string
  name: string
  /** Province centre, in world coordinates. */
  centre: Point
  /** Province extent, in world coordinates. */
  bounds: Bounds
}

export interface PlacedLabel {
  id: string
  text: string
  /** Screen coordinates, centred on the province. */
  x: number
  y: number
}

interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

function overlaps(a: Box, b: Box): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
}

export function labelsFor(
  candidates: readonly LabelCandidate[],
  view: View,
  viewport: Viewport,
  measure: (text: string) => number,
  options: { maxScale?: number } = {},
): PlacedLabel[] {
  if (view.scale > (options.maxScale ?? LABEL_MAX_SCALE)) return []

  const placed: PlacedLabel[] = []
  const boxes: Box[] = []

  for (const candidate of candidates) {
    if (!isVisible(candidate.bounds, view, viewport)) continue

    const width = measure(candidate.name)
    // The province's own width on screen. A name that does not fit belongs to a
    // province too small to be labelled at this zoom.
    const provinceWidth = (candidate.bounds.maxX - candidate.bounds.minX) / view.scale
    if (width > provinceWidth) continue

    const point = toScreen(candidate.centre, view)
    const box: Box = {
      left: point.x - width / 2,
      right: point.x + width / 2,
      top: point.y - LABEL_HALF_HEIGHT,
      bottom: point.y + LABEL_HALF_HEIGHT,
    }
    if (boxes.some((other) => overlaps(box, other))) continue

    boxes.push(box)
    placed.push({ id: candidate.id, text: candidate.name, x: point.x, y: point.y })
  }

  return placed
}
