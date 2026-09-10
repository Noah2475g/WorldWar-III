import { toScreen, type Point, type View } from './picking.ts'
import { BUILDING_ICONS, UNIT_ICONS, type IconName } from '../ui/icons.tsx'
import { placeBuildings, type Anchor } from './anchors.ts'

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
   * Stueckzahl und Zustand des Stapels (T-M30-01, D27.2) — nur fuer eigene Armeen,
   * denn nur deren Zusammensetzung kennt die Sicht (R-DIP-04). `condition` ist der
   * Anteil der Trefferpunkte am Vollstand, 0…1.
   */
  count?: number
  condition?: number
  /** Die Beziehung des Besitzers zum Spieler, fuer die Rahmenfarbe fremder Stapel. */
  relation?: 'peace' | 'war' | 'truce' | 'alliance'
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

/** Wessen Stapel das ist — entscheidet die Rahmenfarbe (D27.2). */
export type MarkerTone = 'own' | 'ally' | 'enemy' | 'other'

export interface Marker {
  kind: MarkerKind
  provinceId: string
  /** Screen position, already projected through the current view. */
  x: number
  y: number
  /** Armies only: drawn in the player's own colour or in the alarm colour. */
  own?: boolean
  /** Armies: the unit count (T-M30-01). */
  count?: number
  /** Buildings: the level, drawn as a digit from 2 upwards (T-M30-02). */
  level?: number
  /** Armies: the share of hit points left, 0…1 — the condition bar (T-M30-01). */
  condition?: number
  /** Armies: whose stack, for the rim colour (T-M30-01, D27.2). */
  tone?: MarkerTone
  /** Armies and battles: which army this belongs to. */
  armyId?: string
  /** Armies: which symbol to draw in the box. */
  icon?: IconName
}

/**
 * Stueckzahl und Zustand eines Stapels (T-M30-01, D27.2).
 *
 * Die Stueckzahl ist nie gespeichert (D2): `ceil(hpTotal / hpPerUnit)` je Gattung, wie
 * `unitCount` im Kern — eine angeschlagene Einheit zaehlt als vorhanden. Der Zustand
 * ist Σ hpTotal / Σ (Stueckzahl · hpPerUnit). Unbekannte Gattungen zaehlen nicht.
 */
export function stackSummary(
  units: readonly { unitKey: string; hpTotal: number }[],
  rules: { units: Readonly<Record<string, { hpPerUnit: number } | undefined>> },
): { count: number; condition: number } {
  let count = 0
  let hp = 0
  let full = 0
  for (const stack of units) {
    const perUnit = rules.units[stack.unitKey]?.hpPerUnit ?? 0
    if (perUnit <= 0 || stack.hpTotal <= 0) continue
    const n = Math.ceil(stack.hpTotal / perUnit)
    count += n
    hp += stack.hpTotal
    full += n * perUnit
  }
  return { count, condition: full > 0 ? hp / full : 0 }
}

/** Der Stapel-Ton aus Besitz und Beziehung. */
export function toneFor(army: Pick<ArmyMarker, 'own' | 'relation'>): MarkerTone {
  if (army.own) return 'own'
  if (army.relation === 'war') return 'enemy'
  if (army.relation === 'alliance') return 'ally'
  return 'other'
}

/** Der gezeichnete Stapel in Bildpunkten (D27.2): Rechteck mit Zahl und Zustandsbalken. */
export const ARMY_BOX = { width: 30, height: 18 } as const

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

/** Der Gebaeudemarker in Bildpunkten (D27.2): Quadrat mit Glyphe, Stufe rechts oben. */
export const BUILDING_BOX = 14

/**
 * Ab hier (Kartenraum je Bildpunkt) sind Gebaeude zu klein, um sie zu zeigen (D27.4,
 * Stufe "weit"). T-M30-03 macht daraus die drei Zoomstufen; bis dahin ist es die Grenze
 * der mittleren Stufe.
 */
export const BUILDING_MAX_SCALE = 1.0

/** Ohne Anker stehen Gebaeude unter der Provinzmitte — nur noch Rueckfall und Test. */
export const BUILDING_OFFSET_Y = 12

/** Gebaeude je Provinz, wie die Sicht sie kennt: Art → Stufe. */
export type BuildingsByProvince = Readonly<Record<string, Readonly<Partial<Record<string, number>>>>>

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
  /** Die Anker je Provinz (T-M30-02, `anchorsFor`), einmal je Karte gerechnet. */
  anchors?: Readonly<Record<string, readonly Anchor[]>>
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
  // Nie kleiner als der gezeichnete Stapel (T-M30-01): quer greift dessen halbe Breite.
  const reachX = Math.max(ARMY_HIT_BOX, ARMY_BOX.width) / 2
  const reachY = Math.max(ARMY_HIT_BOX, ARMY_BOX.height) / 2
  let bestId: string | null = null
  let bestDistance = Infinity

  for (const marker of markersFor(armies, {}, centres, view, extras)) {
    if (marker.kind !== 'army' || !marker.own || !marker.armyId) continue
    const dx = screen.x - marker.x
    const dy = screen.y - marker.y
    if (Math.abs(dx) > reachX || Math.abs(dy) > reachY) continue
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      bestDistance = distance
      bestId = marker.armyId
    }
  }
  return bestId
}

/** Sieben Plaetze in einer Reihe unter der Provinzmitte, abwechselnd rechts und links. */
function fallbackAnchors(centre: Point, scale: number): Anchor[] {
  return Array.from({ length: 7 }, (_, i) => {
    const step = Math.ceil(i / 2) * (i % 2 === 0 ? -1 : 1)
    // Steigender Randabstand nach innen: die Mitte gilt als Landesinneres, die Enden der Reihe als Kueste.
    return { x: centre.x + (step * (BUILDING_BOX + 2)) / scale, y: centre.y + BUILDING_OFFSET_Y / scale, edgeDistance: (7 - i) * 10 }
  })
}

export function markersFor(
  armies: readonly ArmyMarker[],
  buildings: BuildingsByProvince,
  centres: Readonly<Record<string, Point>>,
  view: View,
  extras: MarkerExtras = {},
): Marker[] {
  const markers: Marker[] = []

  // Gebaeude erst ab der mittleren Stufe (D27.4): auf der Weltansicht waeren 1 700
  // Quadrate ein Schleier und kosten das Bildbudget (KRIEGSRAT §6.1).
  if (view.scale <= BUILDING_MAX_SCALE) {
    for (const [provinceId, byKind] of Object.entries(buildings)) {
      const centre = centres[provinceId]
      if (!centre) continue

      // An den Ankern der Provinz (T-M30-02); ohne Anker in einer Reihe unter der
      // Mitte, das erste genau darunter — wie bisher, nur als Marker statt als Pip.
      const anchors = extras.anchors?.[provinceId] ?? fallbackAnchors(centre, view.scale)
      for (const placed of placeBuildings(byKind, anchors)) {
        const point = toScreen(placed, view)
        markers.push({
          kind: 'building',
          provinceId,
          x: point.x,
          y: point.y,
          icon: BUILDING_ICONS[placed.building] ?? 'warning',
          level: placed.level,
        })
      }
    }
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
      tone: toneFor(army),
      armyId: army.id,
      ...(army.icon ? { icon: army.icon } : {}),
      ...(army.count !== undefined ? { count: army.count } : {}),
      ...(army.condition !== undefined ? { condition: army.condition } : {}),
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
