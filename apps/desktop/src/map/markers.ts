import { toScreen, type Point, type View } from './picking.ts'

/**
 * What sits on top of the map (R-MAP-05, T-M10-03b).
 *
 * Units, buildings and combat, worked out as a list before anything is drawn. The
 * drawing itself is then five canvas calls per entry and needs no decisions, which is
 * the point: the decisions — what is shown, in which order, and where — are the part
 * worth testing, and a canvas cannot be asked what it drew.
 *
 * Order matters and is fixed here: buildings sit underneath, armies above them, combat
 * rings above everything. A unit hidden behind a factory symbol is a unit the player
 * does not know they have.
 */

export interface ArmyMarker {
  id: string
  provinceId: string
  owner: string
  strength: number
  own: boolean
  fighting?: boolean
}

export type MarkerKind = 'building' | 'army' | 'battle'

export interface Marker {
  kind: MarkerKind
  provinceId: string
  /** Screen position, already projected through the current view. */
  x: number
  y: number
  /** Armies only: drawn in the player's own colour or in the alarm colour. */
  own?: boolean
  /** Buildings only: how many stand there, capped for drawing. */
  count?: number
  /** Armies and battles: which army this belongs to. */
  armyId?: string
}

/** At most this many building pips per province — beyond it they become a smear. */
export const MAX_BUILDING_PIPS = 4

/** Buildings sit below the army box so the two never overlap. */
export const BUILDING_OFFSET_Y = 12

export function markersFor(
  armies: readonly ArmyMarker[],
  buildings: Readonly<Record<string, number>>,
  centres: Readonly<Record<string, Point>>,
  view: View,
): Marker[] {
  const markers: Marker[] = []

  for (const [provinceId, count] of Object.entries(buildings)) {
    if (!count || count <= 0) continue
    const centre = centres[provinceId]
    if (!centre) continue

    const point = toScreen(centre, view)
    markers.push({
      kind: 'building',
      provinceId,
      x: point.x,
      y: point.y + BUILDING_OFFSET_Y,
      count: Math.min(count, MAX_BUILDING_PIPS),
    })
  }

  for (const army of armies) {
    const centre = centres[army.provinceId]
    if (!centre) continue

    const point = toScreen(centre, view)
    markers.push({ kind: 'army', provinceId: army.provinceId, x: point.x, y: point.y, own: army.own, armyId: army.id })
  }

  // Rings last, so a battle is visible over every unit taking part in it.
  for (const army of armies) {
    if (!army.fighting) continue
    const centre = centres[army.provinceId]
    if (!centre) continue

    const point = toScreen(centre, view)
    markers.push({ kind: 'battle', provinceId: army.provinceId, x: point.x, y: point.y, armyId: army.id })
  }

  return markers
}
