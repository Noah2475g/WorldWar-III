import { toScreen, type Point, type View } from './picking.ts'
import { UNIT_ICONS, type IconName } from '../ui/icons.tsx'

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
  /**
   * The symbol of the army's strongest arm of service (T-M13-09, R-UI-10).
   *
   * Only known for own armies — a foreign stack shows a strength estimate and nothing
   * about its composition (R-DIP-04), so it keeps the plain infantry box.
   */
  icon?: IconName
  /**
   * Der laufende Marsch, wenn die Armee unterwegs ist (T-M20-04, R-UI-04).
   *
   * Alle drei zusammen oder gar nicht: ohne Abmarschzeit gibt es keinen Anteil, ohne
   * Ankunft keinen Nenner, ohne naechste Provinz kein Ziel.
   */
  march?: {
    /** Die naechste Provinz auf dem Weg — dorthin bewegt sich der Marker. */
    toProvinceId: string
    departureTick: number
    arrivalTick: number
    /**
     * Die ganze Restroute ab der naechsten Station, fuer den Marschpfeil (T-M26-01).
     * Fehlt sie, bleibt der Pfeil bei der einen Etappe, die `toProvinceId` kennt.
     */
    route?: readonly string[]
  }
}

export type MarkerKind = 'building' | 'army' | 'battle' | 'capital'

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
  /** Armies: which symbol to draw in the box. */
  icon?: IconName
}

/** Which arm of service a stack is mostly made of — that is the symbol it wears. */
export function dominantIcon(units: readonly { unitKey: string; hp: number }[]): IconName | undefined {
  let best: { icon: IconName; hp: number } | null = null
  for (const stack of units) {
    const icon = UNIT_ICONS[stack.unitKey]
    if (!icon) continue
    if (!best || stack.hp > best.hp) best = { icon, hp: stack.hp }
  }
  return best?.icon
}

/** At most this many building pips per province — beyond it they become a smear. */
export const MAX_BUILDING_PIPS = 4

/** Buildings sit below the army box so the two never overlap. */
export const BUILDING_OFFSET_Y = 12

export interface MarkerExtras {
  /**
   * Die Spieluhr. Ohne sie stehen marschierende Armeen in der Provinzmitte — genau wie
   * bis T-M20-04, und genau das, was bei abgeschalteter Bewegung gewollt ist.
   */
  tick?: number
  /** The player's own capital, drawn as a star. */
  capitalProvinceId?: string | null
  /** Provinces where fighting is going on, from the view — not from the armies. */
  battleProvinces?: readonly string[]
}

/**
 * Wo eine marschierende Armee gerade steht — zwischen zwei Provinzen (T-M20-04).
 *
 * R-UI-04 verspricht **Bewegungs- und** Kampfanimationen, und nur die Kampfhaelfte gab es:
 * der Ring um ein Gefecht atmet seit T-M13-16, eine marschierende Armee dagegen klebte in
 * der Provinzmitte und stand im naechsten Bild ohne Uebergang in der naechsten. Die
 * Bewegung, die das Spiel die ganze Zeit rechnet, war unsichtbar.
 *
 * **Eine reine Funktion, und das ist der eigentliche Entwurf.** `MapCanvas` ist die am
 * schlechtesten abgedeckte Datei der Oberflaeche (168 von 249 Zeilen), weil sie ohne
 * Leinwand nicht laeuft. Was hier steht, laeuft ohne alles: der Anteil des Weges ist
 * Arithmetik, und Arithmetik kann ein Test festnageln.
 *
 * Springt zurueck auf die Provinzmitte, sobald etwas fehlt oder nicht stimmt — eine
 * Armee an einem erfundenen Zwischenort waere schlimmer als eine, die nicht wandert.
 */
export function marchPoint(
  army: ArmyMarker,
  centres: Readonly<Record<string, Point>>,
  tick: number,
): Point | null {
  const from = centres[army.provinceId]
  const march = army.march
  if (!from || !march) return null

  const to = centres[march.toProvinceId]
  const spanne = march.arrivalTick - march.departureTick
  // Ein Marsch ohne Dauer ist ein Sprung, und durch null teilt niemand.
  if (!to || spanne <= 0) return null

  const anteil = (tick - march.departureTick) / spanne
  if (anteil <= 0 || anteil >= 1) return null

  return { x: from.x + (to.x - from.x) * anteil, y: from.y + (to.y - from.y) * anteil }
}

/**
 * Trefferflaeche eines Armee-Markers in Bildpunkten (T-M22-06, R-UI-05, Befund V2-14).
 *
 * Der Kasten wird 20×14 gezeichnet und war damit ein ~12-px-Klickziel; ausgewaehlt
 * wurde praktisch nur ueber das Provinz-Panel. Gepickt wird groesser als gezeichnet:
 * mindestens 24 px, der Finger darf danebenliegen.
 */
export const ARMY_HIT_BOX = 24

/**
 * Die eigene Armee unter einem Bildschirmpunkt — oder null.
 *
 * Dieselbe Ortsrechnung wie das Zeichnen (`markersFor`, samt Marschposition), damit
 * getroffen wird, was man sieht, und nicht die Provinzmitte, die eine marschierende
 * Armee laengst verlassen hat. Nur eigene Armeen: eine fremde traegt keine Befehle,
 * und ihr Kasten soll den Klick auf die Provinz darunter nicht schlucken.
 */
export function pickArmy(
  screen: Point,
  armies: readonly ArmyMarker[],
  centres: Readonly<Record<string, Point>>,
  view: View,
  extras: MarkerExtras = {},
): string | null {
  const reach = ARMY_HIT_BOX / 2
  let bestId: string | null = null
  let bestDistance = Infinity

  for (const marker of markersFor(armies, {}, centres, view, extras)) {
    if (marker.kind !== 'army' || !marker.own || !marker.armyId) continue
    const dx = screen.x - marker.x
    const dy = screen.y - marker.y
    if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      bestDistance = distance
      bestId = marker.armyId
    }
  }
  return bestId
}

export function markersFor(
  armies: readonly ArmyMarker[],
  buildings: Readonly<Record<string, number>>,
  centres: Readonly<Record<string, Point>>,
  view: View,
  extras: MarkerExtras = {},
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

    // Unterwegs steht der Marker zwischen den Provinzen, sonst in der Mitte. `tick`
    // fehlt heisst: keine Bewegung — der Aufrufer will keine, oder es gibt keine Uhr.
    const unterwegs = extras.tick === undefined ? null : marchPoint(army, centres, extras.tick)
    const point = toScreen(unterwegs ?? centre, view)
    markers.push({
      kind: 'army',
      provinceId: army.provinceId,
      x: point.x,
      y: point.y,
      own: army.own,
      armyId: army.id,
      ...(army.icon ? { icon: army.icon } : {}),
    })
  }

  // The capital sits above the units of its own province: it is a place, not a piece,
  // and the player looks for it more often than for anything else on the map.
  if (extras.capitalProvinceId) {
    const centre = centres[extras.capitalProvinceId]
    if (centre) {
      const point = toScreen(centre, view)
      markers.push({ kind: 'capital', provinceId: extras.capitalProvinceId, x: point.x, y: point.y })
    }
  }

  /*
   * Battle rings last, so fighting is visible over every unit taking part in it.
   *
   * Taken from the view's list of battles rather than from a flag on the army: the old
   * `fighting` flag was never set by anything, so the ring never appeared once in the
   * finished game. The view knows which battles the player may see, which is also the
   * right answer to "whose fighting is this".
   */
  const battleProvinces = new Set([
    ...(extras.battleProvinces ?? []),
    ...armies.filter((army) => army.fighting).map((army) => army.provinceId),
  ])
  for (const provinceId of battleProvinces) {
    const centre = centres[provinceId]
    if (!centre) continue

    const point = toScreen(centre, view)
    markers.push({ kind: 'battle', provinceId, x: point.x, y: point.y })
  }

  return markers
}
