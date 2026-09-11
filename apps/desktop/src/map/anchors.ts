import type { BuildingKey } from '@worldwar/core'
import { BUILDING_ORDER } from '../ui/icons.tsx'
import type { Point, Ring } from './picking.ts'

/**
 * Ankerpunkte fuer Gebaeude in der Provinzflaeche (T-M30-02, D27.3, R-MAP-05/R-UI-12).
 *
 * Noahs Auftrag: Gebaeude sollen "in der Provinz verteilt" stehen — nicht am
 * Mittelpunkt, nicht in Reihen. Die Anker kommen deshalb aus der Geometrie und nur aus
 * ihr: gleiche Karte, gleiche Anker, in jeder Partie und in jedem Spielstand. Der
 * Zustand (welche Gebaeude stehen) entscheidet nur, welche Anker belegt sind — in
 * fester Reihenfolge, damit ein neuer Bau die anderen nicht verschiebt.
 *
 * Alles hier ist reine Arithmetik in Kartenraum-Einheiten (die Weltkarte ist 4000 x 2400;
 * bei Zoomstufe 1 ist eine Einheit ein Bildpunkt). Einmal je Karte gerechnet, dann
 * gehalten — die Leinwand bekommt fertige Punkte.
 */

export interface Anchor extends Point {
  /** Abstand zum naechsten Rand des Rings — Hafen und Werft nehmen den kleinsten. */
  edgeDistance: number
}

/** Mindestschrittweite des Kandidatengitters (Kartenraum). */
export const ANCHOR_STEP_MIN = 16
/** Mindestabstand eines Ankers vom Rand der Provinz. */
export const ANCHOR_EDGE_MARGIN = 12
/** Mindestabstand zweier Anker voneinander — ein 14er-Marker darf den Nachbarn nicht decken. */
export const ANCHOR_SPACING = 14
/** Mehr Anker als Gebaeudearten braucht keine Provinz; ein paar Reserve fuer die Kueste. */
export const ANCHOR_MAX = 12

/** Flaeche eines Rings (Schnuerformel), immer positiv. */
export function ringArea(ring: Ring): number {
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!
    const [x2, y2] = ring[(i + 1) % ring.length]!
    sum += x1 * y2 - x2 * y1
  }
  return Math.abs(sum) / 2
}

/** Der Ring mit der groessten Flaeche — dort stehen die Gebaeude, nicht auf einer Insel. */
export function largestRing(polygons: readonly Ring[]): Ring | null {
  let best: Ring | null = null
  let bestArea = -1
  for (const ring of polygons) {
    if (ring.length < 3) continue
    const area = ringArea(ring)
    if (area > bestArea) {
      bestArea = area
      best = ring
    }
  }
  return best
}

/** Punkt-in-Polygon per Strahl (gerade/ungerade Kreuzungen). */
export function insideRing(point: Point, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    const crosses = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** Abstand eines Punkts zum naechsten Segment des Rings. */
export function edgeDistanceOf(point: Point, ring: Ring): number {
  let best = Infinity
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j]!
    const [bx, by] = ring[i]!
    const dx = bx - ax
    const dy = by - ay
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy) / lengthSq))
    const px = ax + t * dx - point.x
    const py = ay + t * dy - point.y
    const distance = Math.sqrt(px * px + py * py)
    if (distance < best) best = distance
  }
  return best
}

/**
 * Die Anker einer Provinz, nah am Mittelpunkt zuerst.
 *
 * Kandidaten liegen auf einem Gitter ueber dem groessten Ring (Schrittweite aus der
 * Flaeche, mindestens ANCHOR_STEP_MIN), muessen im Ring liegen und ANCHOR_EDGE_MARGIN
 * vom Rand entfernt sein. Sortiert nach Abstand zum `center`, dann gierig mit
 * ANCHOR_SPACING ausgeduennt. Eine Provinz, die dafuer zu klein ist, bekommt ihren
 * Mittelpunkt als einzigen Anker — ein Gebaeude ohne Ort waere schlimmer als eines
 * in der Mitte.
 */
export function anchorsFor(polygons: readonly Ring[], center: Point): Anchor[] {
  const ring = largestRing(polygons)
  if (!ring) return [{ ...center, edgeDistance: 0 }]

  const area = ringArea(ring)
  const step = Math.max(ANCHOR_STEP_MIN, Math.sqrt(area) / 5)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  const candidates: Anchor[] = []
  for (let y = minY + step / 2; y <= maxY; y += step) {
    for (let x = minX + step / 2; x <= maxX; x += step) {
      const point = { x, y }
      if (!insideRing(point, ring)) continue
      const edgeDistance = edgeDistanceOf(point, ring)
      if (edgeDistance < ANCHOR_EDGE_MARGIN) continue
      candidates.push({ x, y, edgeDistance })
    }
  }

  const distanceToCentre = (a: Point): number => (a.x - center.x) ** 2 + (a.y - center.y) ** 2
  candidates.sort((a, b) => distanceToCentre(a) - distanceToCentre(b) || a.y - b.y || a.x - b.x)

  const chosen: Anchor[] = []
  for (const candidate of candidates) {
    if (chosen.length >= ANCHOR_MAX) break
    const tooClose = chosen.some((c) => (c.x - candidate.x) ** 2 + (c.y - candidate.y) ** 2 < ANCHOR_SPACING ** 2)
    if (!tooClose) chosen.push(candidate)
  }

  // Der Rueckfall: kein Gitterpunkt haelt Randabstand, die Provinz ist zu klein. Dann
  // ist der Mittelpunkt der eine Anker — er liegt sicher im Land, und das ist die
  // Zusage, die der Waechter ueber alle 237 Provinzen bindet. Dass dort auch der
  // Armeekasten steht, loest `markersFor` beim Zeichnen mit BUILDING_OFFSET_Y
  // (T-M28-12, Befund 2 der Durchsicht vom 2026-09-11); ein Versatz schon am Anker
  // schoebe ihn in kleinen Provinzen wie Bahrain aus der Flaeche heraus.
  return chosen.length > 0 ? chosen : [{ ...center, edgeDistance: edgeDistanceOf(center, ring) }]
}

/** Gebaeudearten, die ans Wasser gehoeren: sie nehmen den Anker mit dem kleinsten Randabstand. */
export const COASTAL_BUILDINGS: readonly BuildingKey[] = ['harbour', 'shipyard']

export interface PlacedBuilding extends Point {
  building: BuildingKey
  level: number
}

/**
 * Welche Gebaeude an welchen Ankern stehen.
 *
 * Jede Gebaeudeart hat ihren festen Platz, unabhaengig davon, was sonst noch steht —
 * so verschiebt ein neuer Bau die anderen nicht: Hafen und Werft bekommen die beiden
 * randnaechsten Anker (Hafen den naechsten), alle anderen Arten in `BUILDING_ORDER`
 * je einen der uebrigen Anker, nah am Mittelpunkt zuerst. Reichen die Anker nicht
 * (kleine Provinz), teilen sich die Arten die vorhandenen der Reihe nach; was dann
 * ueberzaehlig ist, bleibt ungezeichnet — das Panel zeigt es weiterhin.
 */
export function placeBuildings(
  buildings: Readonly<Partial<Record<string, number>>>,
  anchors: readonly Anchor[],
): PlacedBuilding[] {
  const byEdge = [...anchors].sort((a, b) => a.edgeDistance - b.edgeDistance)
  const coastalSlots = anchors.length > COASTAL_BUILDINGS.length ? byEdge.slice(0, COASTAL_BUILDINGS.length) : []
  const inlandSlots = anchors.filter((a) => !coastalSlots.includes(a))
  const inlandKinds = BUILDING_ORDER.filter((kind) => !COASTAL_BUILDINGS.includes(kind))

  const slotFor = (building: BuildingKey): Anchor | undefined => {
    if (COASTAL_BUILDINGS.includes(building)) {
      const slot = coastalSlots[COASTAL_BUILDINGS.indexOf(building)]
      if (slot) return slot
      // Zu wenige Anker fuer eine Reserve: der Reihe nach wie alle anderen.
      return anchors[BUILDING_ORDER.indexOf(building) % Math.max(1, anchors.length)]
    }
    const slot = inlandSlots[inlandKinds.indexOf(building)]
    return slot ?? anchors[BUILDING_ORDER.indexOf(building) % Math.max(1, anchors.length)]
  }

  const placed: PlacedBuilding[] = []
  const taken = new Set<Anchor>()
  for (const building of BUILDING_ORDER) {
    const level = buildings[building] ?? 0
    if (level <= 0) continue
    const wunsch = slotFor(building)
    // Ist der feste Platz vergeben oder gibt es ihn nicht, nimmt das Gebaeude den
    // ersten freien Anker — NICHT den Modulo-Platz (T-M28-12, Befund 1 der Durchsicht
    // vom 2026-09-11). Der landete auf einem belegten Anker, das Gebaeude fiel weg, und
    // die fuer Hafen und Werft reservierten blieben leer: in einer Binnenprovinz mit
    // fuenf Ankern verschwanden Flugplatz und Eisenbahn von der Karte, obwohl Platz war.
    const anchor = wunsch && !taken.has(wunsch) ? wunsch : anchors.find((a) => !taken.has(a))
    if (!anchor) continue
    taken.add(anchor)
    placed.push({ building, level, x: anchor.x, y: anchor.y })
  }

  return placed
}
