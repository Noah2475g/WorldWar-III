import { boundsOf, toScreen, type Bounds, type Ring, type View } from './picking.ts'
import { STRENGTH_FULL, colorForPlayer, fillFor, type MapMode, type ShadedProvince } from './modes.ts'
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
  /** One outline per piece of land — a province may be in several (T-M19-02). */
  polygons: readonly Ring[]
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
export function thin(ring: Ring, view: View, minPixels = 1.5): [number, number][] {
  if (ring.length <= 4) return ring.map(([x, y]) => [x, y])

  const step = minPixels * view.scale
  const out: [number, number][] = []
  let lastX = Number.NEGATIVE_INFINITY
  let lastY = Number.NEGATIVE_INFINITY

  for (const [x, y] of ring) {
    if (Math.abs(x - lastX) < step && Math.abs(y - lastY) < step) continue
    out.push([x, y])
    lastX = x
    lastY = y
  }

  // A shape thinned below a triangle is not a shape; keep the original rather than
  // drawing a line where a province should be.
  return out.length >= 3 ? out : ring.map(([x, y]) => [x, y])
}

/**
 * Is this outline big enough on screen to be worth a path?
 *
 * The counterpart to `thin` for whole pieces rather than for points, and it earns its
 * keep since T-M19-02: a province is no longer one outline but nine on average, and at
 * world scale most of the new ones are islands under a pixel across. Building a path,
 * filling it and stroking it to cover half a pixel costs the same as doing it for
 * Australia — and it was the whole of the frame-budget regression the change caused.
 *
 * The threshold is the one `thin` already uses, so both agree on what "the same pixel"
 * means. It drops nothing a player could see: a shape narrower than a pixel has no
 * inside left to fill. And it looks only at how large *this* piece is, never at how
 * many a province has — so the piece a province depends on is never the one dropped.
 */
export function worthDrawing(ring: Ring, view: View, minPixels = 1.5): boolean {
  return span(ring) >= minPixels * view.scale
}

/** The longer side of a ring's bounding box, in map units. */
function span(ring: Ring): number {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return Math.max(maxX - minX, maxY - minY)
}

/** Ring in map units to thinned points in screen pixels. */
function toScreenPoints(ring: Ring, view: View): [number, number][] {
  return thin(ring, view).map(([x, y]) => {
    const screen = toScreen({ x, y }, view)
    return [screen.x, screen.y] as [number, number]
  })
}

/**
 * Everything the canvas needs for one frame, and nothing it does not.
 *
 * Since T-M19-02 a province contributes **one shape per piece of land**, so `id` is no
 * longer unique in the result — Alaska and California both come back as `USA-WEST`.
 * That is what the drawing loop wants (it fills each shape with the same colour and
 * never looks an id up), and it is why the return type is a list and not a map.
 */
export function prepareFrame(
  provinces: readonly RenderProvince[],
  view: View,
  viewport: Viewport,
  mode: MapMode,
): PreparedShape[] {
  const shapes: PreparedShape[] = []

  for (const province of provinces) {
    const bounds = province.bounds ?? boundsOf(province.polygons)
    if (!isVisible(bounds, view, viewport)) continue

    const fill = fillFor(province, mode)
    const before = shapes.length

    for (const ring of province.polygons) {
      if (!worthDrawing(ring, view)) continue
      shapes.push({ id: province.id, fill, points: toScreenPoints(ring, view) })
    }

    // A province is never allowed to vanish. Malta and Singapore are smaller than one
    // pixel at world scale, and dropping their only outline would leave the map with a
    // province the player owns and cannot see — which is the fault T-M19-02 exists to
    // repair, arriving from the other direction.
    if (shapes.length === before) {
      const largest = province.polygons.reduce((a, b) => (span(a) >= span(b) ? a : b))
      shapes.push({ id: province.id, fill, points: toScreenPoints(largest, view) })
    }
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

/**
 * Marschpfeile (T-M26-01, R-UI-16, D25.3).
 *
 * Eine Bewegung war eine gestrichelte Linie ohne Richtung und ohne Fortschritt. Jetzt
 * traegt jede sichtbare marschierende Armee ihre Route als Pfad mit Pfeilspitze: der
 * zurueckgelegte Anteil voll gefaerbt, der Rest blass, die Spitze am Ziel. Alles hier
 * sind reine Funktionen — die Leinwand bekommt fertige Punkte, und der Fortschritt ist
 * Arithmetik, die ein Test festnageln kann.
 *
 * Zur Wahl der Ticks (Auftrag verlangt eine Dokumentation): die Sicht fuehrt je
 * eigener Armee `departureTick` (Beginn des GANZEN Marsches, movement setzt ihn nur im
 * Befehl) und `arrivalTick` (Ankunft der NAECHSTEN Etappe, je Etappe neu gesetzt).
 * Eine Gesamtankunft gibt es in der Sicht nicht. Der Fortschritt hier ist deshalb der
 * Anteil der laufenden Etappe — exakt die Rechnung, mit der `marchPoint` (markers.ts,
 * T-M20-04) den Marker zwischen die Provinzen stellt. Fuellung und Marker treffen sich
 * damit immer im selben Punkt; ab der zweiten Etappe erbt beides dieselbe Naeherung.
 * Fremde Armeen fuehren in der Sicht weder Route noch Ticks (R-DIP-04) — ihr Pfeil
 * entsteht erst, wenn die Sicht es je erlaubt; die Farbregel steht trotzdem hier.
 */

/** Der Marsch, wie die Sicht ihn kennt: Abmarsch der Route, Ankunft der naechsten Etappe. */
export interface MarchTiming {
  departureTick: number
  arrivalTick: number
}

/** 0 beim Abmarsch, 1 bei Ankunft, dazwischen linear — geklemmt statt erfunden. */
export function marchProgress(march: MarchTiming, tick: number): number {
  const spanne = march.arrivalTick - march.departureTick
  // Ein Marsch ohne Dauer ist angekommen, nicht unterwegs — und niemand teilt durch null.
  if (spanne <= 0) return 1
  return Math.min(1, Math.max(0, (tick - march.departureTick) / spanne))
}

export interface MarchArrow {
  /** Zurueckgelegt: volle Farbe. Bildschirmpunkte. */
  done: [number, number][]
  /** Voraus: blass. Beginnt am Fortschrittspunkt, endet am Ziel. */
  ahead: [number, number][]
  /** Pfeilspitze am Ziel: [Spitze, Flanke, Flanke]. */
  head: [number, number][]
}

/** Wie durchscheinend der noch nicht marschierte Teil der Route gezeichnet wird. */
export const MARCH_AHEAD_ALPHA = 0.35

/** Kantenlaenge der Pfeilspitze in Bildschirmpunkten. */
export const MARCH_HEAD_SIZE = 8

/**
 * Die Route einer Armee als Pfeilgeometrie.
 *
 * `points` sind die Stationen in Bildschirmpunkten, beginnend bei der aktuellen
 * Provinz; `progress` ist der Anteil der ERSTEN Etappe (siehe marchProgress). Weniger
 * als zwei Punkte sind keine Route — dann lieber nichts als ein erfundener Pfeil.
 */
export function marchArrow(
  points: readonly [number, number][],
  progress: number,
  headSize = MARCH_HEAD_SIZE,
): MarchArrow | null {
  if (points.length < 2) return null

  const clamped = Math.min(1, Math.max(0, progress))
  const [fromX, fromY] = points[0]!
  const [nextX, nextY] = points[1]!
  const split: [number, number] = [fromX + (nextX - fromX) * clamped, fromY + (nextY - fromY) * clamped]

  const done: [number, number][] = [[fromX, fromY], split]
  const ahead: [number, number][] = [split, ...points.slice(1).map(([x, y]) => [x, y] as [number, number])]

  // Die Spitze zeigt entlang des letzten Abschnitts auf das Ziel.
  const [tipX, tipY] = points[points.length - 1]!
  const [prevX, prevY] = points[points.length - 2]!
  const length = Math.hypot(tipX - prevX, tipY - prevY)
  // Zwei identische Stationen haben keine Richtung; dann zeigt der Pfeil nach rechts,
  // statt mit NaN die ganze Leinwand zu vergiften.
  const ux = length > 0 ? (tipX - prevX) / length : 1
  const uy = length > 0 ? (tipY - prevY) / length : 0
  const baseX = tipX - ux * headSize
  const baseY = tipY - uy * headSize
  const half = headSize / 2
  const head: [number, number][] = [
    [tipX, tipY],
    [baseX - uy * half, baseY + ux * half],
    [baseX + uy * half, baseY - ux * half],
  ]

  return { done, ahead, head }
}

/** Eigene Maersche in Phosphorgruen (D27.1, eigen = `good`), fremde in der Farbe ihrer Macht (D25.3). */
export function marchStroke(army: { own: boolean; owner: string }): string {
  return army.own ? TOKENS.good : colorForPlayer(army.owner)
}

/**
 * Kampf und Eroberung auf der Karte (T-M26-02, R-UI-17, D25.4).
 *
 * Ein Besitzwechsel war ein harter Farbsprung zwischen zwei Bildern der teuren Ebene.
 * Die Welle selbst zeichnet `MapCanvas` auf dem Ueberzug; was hier steht, ist der
 * testbare Teil — WELCHE Provinzen gerade wechseln, und wie stark ein Gefechtsring
 * auftritt.
 */

export interface OwnershipChange {
  id: string
  from: string | null
  to: string | null
}

/**
 * Die Provinzen, deren Eigentuemer sich gegenueber dem letzten Bild geaendert hat.
 *
 * Nur Provinzen, die vorher schon bekannt waren: eine, die zum ersten Mal auftaucht,
 * hat keinen alten Zustand, von dem man blenden koennte — beim Partiestart und beim
 * Kartenwechsel wuerde sonst die halbe Welt wabern.
 */
export function ownershipChanges(
  previous: Readonly<Record<string, string | null>>,
  current: readonly { id: string; owner: string | null }[],
): OwnershipChange[] {
  const changes: OwnershipChange[] = []
  for (const province of current) {
    const before = previous[province.id]
    if (before === undefined || before === province.owner) continue
    changes.push({ id: province.id, from: before, to: province.owner })
  }
  return changes
}

/**
 * Wie stark der Ring eines Gefechts auftritt, 0…1 nach sichtbarer Gesamtstaerke.
 *
 * Wurzel statt linear: ein Scharmuetzel von ein paar hundert Trefferpunkten bleibt
 * sichtbar, statt im Rauschen zu verschwinden, und der volle Stapel (STRENGTH_FULL,
 * der Deckel aus D6) ist das Ende der Skala — wie im Staerkemodus der Karte.
 */
export function battleIntensity(strength: number): number {
  if (strength <= 0) return 0
  return Math.min(1, Math.sqrt(strength / STRENGTH_FULL))
}

/** Grundradius des Gefechtsrings zu einer Intensitaet — das Atmen kommt oben drauf. */
export function battleRingBase(intensity: number): number {
  return 9 + 7 * intensity
}

/** Strichbreite des Gefechtsrings zu einer Intensitaet. */
export function battleRingWidth(intensity: number): number {
  return 1.4 + 1.6 * intensity
}

/** Border and label colours are the same in every mode — the map stays legible. */
export const MAP_COLORS = {
  sea: TOKENS.water,
  border: TOKENS.line,
  /** Auswahl in Bernstein — die Handlungsfarbe des Kriegsrats (D27.1). */
  selection: TOKENS.warn,
  label: TOKENS.onPlayer,
  /** Dunkler Saum unter der hellen Kartenschrift, damit sie auf jeder Fuellung lesbar bleibt. */
  labelHalo: TOKENS.ground,
  battle: TOKENS.accent,
} as const
