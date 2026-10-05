import { ZOOM_MID_MAX_SCALE, toScreen, zoomTier, type Point, type View } from './picking.ts'
import { BUILDING_ICONS, UNIT_ICONS, type IconName } from '../ui/icons.tsx'
import { placeBuildings, type Anchor } from './anchors.ts'
import { dominantUnitKey } from './stellung.ts'

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
  /** Kartenraum, Anker des Gattungsgebaeudes, nur eigene — T-M48-01. */
  home?: Point
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
    /** Kartenraum, Anker des Gattungsgebaeudes in der naechsten Provinz, nur eigene — T-M48-01. */
    toHome?: Point
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

/** Der Abstand zweier aufgefaecherter Stapel in Bildpunkten: Kasten plus zwei Punkte Luft (T-M46-03). */
export const FAN_PITCH = { x: ARMY_BOX.width + 2, y: ARMY_BOX.height + 2 } as const

/**
 * Faechert Stapel auf, die an demselben Punkt liegen (T-M46-03, VM-02).
 *
 * Noah (Playtest V3): „Einheiten sind manchmal uebereinander … man hat Einheiten nicht gesehen.“
 * Mehrere Armeen einer Provinz bekamen alle die Provinzmitte und lagen exakt aufeinander — gezaehlt
 * an S575G: 208 von 237 Markern waren vollstaendig verdeckt, bis zu 27 an einem Ort. Jetzt bilden
 * sie ein Raster um den gemeinsamen Punkt, in Bildpunkten und damit bei jeder Vergroesserung gleich
 * gross: die Abstaende sind die des Kastens plus Luft, nicht die der Karte.
 *
 * Gruppiert wird nach dem **gezeichneten Punkt**, nicht nach der Provinz: eine marschierende Armee
 * steht zwischen zwei Provinzen und bleibt allein, sobald sie sich vom Stapel loest. Die Reihenfolge
 * innerhalb des Rasters ist die der Eingabe — stabil von Bild zu Bild, damit ein Marker nicht
 * springt, solange sich die Zusammensetzung nicht aendert. Eine einzelne Armee bleibt, wo sie war.
 */
export function fanOut<T extends { x: number; y: number }>(markers: readonly T[], growUp?: readonly boolean[]): T[] {
  const groups = new Map<string, number[]>()
  markers.forEach((marker, index) => {
    // Auf ganze Bildpunkte gerundet: zwei Mitten, die sich um Bruchteile unterscheiden, sind derselbe Ort.
    const key = `${Math.round(marker.x)}:${Math.round(marker.y)}`
    const group = groups.get(key)
    if (group) group.push(index)
    else groups.set(key, [index])
  })

  const out = markers.map((marker) => ({ ...marker }))
  for (const indices of groups.values()) {
    const n = indices.length
    if (n < 2) continue
    // Etwa so breit wie hoch, wenn man die Kastenform einrechnet; mindestens zwei nebeneinander.
    const cols = Math.min(n, Math.max(2, Math.ceil(Math.sqrt((n * FAN_PITCH.y) / FAN_PITCH.x) * 1.6)))
    const rows = Math.ceil(n / cols)
    // T-M48-02 (E5): Stellung am Gebaeude — das Raster waechst nach oben, die unterste Reihe sitzt auf dem gehobenen Punkt.
    const up = growUp?.[indices[0]!] === true
    indices.forEach((markerIndex, slot) => {
      const row = Math.floor(slot / cols)
      const inRow = row === rows - 1 ? n - row * cols : cols
      const col = slot % cols
      const target = out[markerIndex]!
      target.x += (col - (inRow - 1) / 2) * FAN_PITCH.x
      target.y += (row - (up ? rows - 1 : (rows - 1) / 2)) * FAN_PITCH.y
    })
  }
  return out
}

/**
 * Die Suchreihenfolge fuer einen freien Platz: Versaetze im Raster eines halben Kastens, nach
 * Entfernung sortiert, bis `DECLUTTER_RADIUS` Bildpunkte. Einmal gebaut, danach nur gelesen.
 */
export const DECLUTTER_RADIUS = 256
// LOESCHVERMERK (Review): bis zur Nachbesserung U stand hier `DECLUTTER_RADIUS = 96`; an S575G blieben damit bei
// Massstab 4 und 8 109 und 145 von 237 Markern teilweise verdeckt (Klickflaeche nur zu 93 % / 80 % sichtbar).
// export const DECLUTTER_RADIUS = 96
const DECLUTTER_STEP = { x: ARMY_BOX.width / 2, y: ARMY_BOX.height / 2 } as const
const SLOT_ORDER: readonly (readonly [number, number])[] = (() => {
  const list: [number, number][] = []
  const nx = Math.floor(DECLUTTER_RADIUS / DECLUTTER_STEP.x)
  const ny = Math.floor(DECLUTTER_RADIUS / DECLUTTER_STEP.y)
  for (let i = -nx; i <= nx; i++) {
    for (let j = -ny; j <= ny; j++) {
      const dx = i * DECLUTTER_STEP.x
      const dy = j * DECLUTTER_STEP.y
      if (Math.hypot(dx, dy) <= DECLUTTER_RADIUS) list.push([dx, dy])
    }
  }
  // Gleiche Entfernung: erst oben/unten, dann links/rechts — das haelt Stapel eher in der Hoehe als in der Breite.
  return list.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[0] - b[0] || a[1] - b[1])
})()

/**
 * Schiebt Stapel auseinander, die sich auch nach `fanOut` noch ueberdecken (T-M46-03).
 *
 * `fanOut` loest den haeufigen Fall — mehrere Armeen an EINEM Ort. Es kennt aber keine
 * Nachbarn: liegen zwei Provinzen weniger als einen Kasten auseinander (bei kleinem Massstab
 * ist das fast immer so), landen ihre Raster ineinander, und ein Stapel lag vollstaendig unter
 * dem naechsten. Hier wird jeder Marker, in der Reihenfolge der Wichtigkeit (eigene zuerst,
 * sonst Eingabereihenfolge), an den naechsten freien Platz in Reichweite gesetzt — sein eigener,
 * wenn der frei ist. Findet sich innerhalb des Radius keiner, bekommt er den Platz mit der
 * geringsten Ueberdeckung: ein Marker, der weit von seinem Ort wandert, luegt ueber den Ort,
 * einer, der zum Teil verdeckt ist, nur ueber einen Zipfel.
 *
 * Rein und stabil: gleiche Eingabe, gleiche Plaetze. Die Reihenfolge der Liste (die
 * Zeichenreihenfolge) bleibt unveraendert; nur x und y aendern sich.
 */
export function declutter<T extends { x: number; y: number; own?: boolean }>(markers: readonly T[]): T[] {
  const out = markers.map((marker) => ({ ...marker }))
  if (out.length < 2) return out

  const gapX = FAN_PITCH.x
  const gapY = FAN_PITCH.y
  // Raster aus Zellen der Groesse eines Kastens samt Luft: Nachbarn stehen in den 3 x 3 Zellen ringsum.
  // Zahlenschluessel statt Zeichenketten (Nachbesserung U): der groessere Suchradius ruft `overlapAt` bis zu dreimal
  // so oft auf (S575G, Massstab 8: 37 871 -> 114 414 Aufrufe), und jeder baute neun Schluessel-Zeichenketten.
  // Die Zellen liegen in +-32768 (Karte 16 000 px breit bei Massstab 0,5 -> rund 500 Zellen).
  const cells = new Map<number, number[]>()
  const cellKey = (cx: number, cy: number): number => (cx + 32768) * 65536 + (cy + 32768)
  const key = (x: number, y: number): number => cellKey(Math.floor(x / gapX), Math.floor(y / gapY))

  const overlapAt = (x: number, y: number): number => {
    const cx = Math.floor(x / gapX)
    const cy = Math.floor(y / gapY)
    let area = 0
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      for (let iy = cy - 1; iy <= cy + 1; iy++) {
        const list = cells.get(cellKey(ix, iy))
        if (!list) continue
        for (const other of list) {
          const dx = Math.abs(out[other]!.x - x)
          const dy = Math.abs(out[other]!.y - y)
          if (dx < gapX && dy < gapY) area += (gapX - dx) * (gapY - dy)
        }
      }
    }
    return area
  }

  const order = out.map((_, index) => index).sort((a, b) => Number(Boolean(out[b]!.own)) - Number(Boolean(out[a]!.own)) || a - b)
  for (const index of order) {
    const marker = out[index]!
    const home = { x: marker.x, y: marker.y }
    let chosen: { x: number; y: number } | null = null
    let best = { x: home.x, y: home.y, area: Infinity }
    for (const [dx, dy] of SLOT_ORDER) {
      const x = home.x + dx
      const y = home.y + dy
      const area = overlapAt(x, y)
      if (area === 0) {
        chosen = { x, y }
        break
      }
      if (area < best.area) best = { x, y, area }
    }
    const spot = chosen ?? best
    marker.x = spot.x
    marker.y = spot.y
    const k = key(spot.x, spot.y)
    const list = cells.get(k)
    if (list) list.push(index)
    else cells.set(k, [index])
  }
  return out
}

/** Which arm of service a stack is mostly made of — that is the symbol it wears. */
export function dominantIcon(units: readonly { unitKey: string; hp: number }[]): IconName | undefined {
  const key = dominantUnitKey(units)
  return key ? UNIT_ICONS[key] : undefined
}

/** Der Gebaeudemarker in Bildpunkten (D27.2): Quadrat mit Glyphe, Stufe rechts oben. */
export const BUILDING_BOX = 14

/** Gebaeude erscheinen ab der mittleren Stufe (D27.4, `zoomTier`); auf "weit" nicht. */
export const BUILDING_MAX_SCALE = ZOOM_MID_MAX_SCALE

/**
 * Wie weit unter der Provinzmitte ein Gebaeude sitzt, wenn es dort sitzen muss.
 *
 * Gerechnet statt geraten (T-M28-12): halbe Hoehe des Armeekastens plus halbe Hoehe des
 * Gebaeudequadrats plus ein Bildpunkt Luft. Die feste 12 davor war schon fuer den alten
 * 20x14-Kasten zu knapp und deckte nach dem Wachstum auf 30x18 das Quadrat vollstaendig.
 * Als Rechnung waechst der Abstand mit, wenn eine der beiden Groessen sich aendert.
 */
export const BUILDING_OFFSET_Y = ARMY_BOX.height / 2 + BUILDING_BOX / 2 + 1

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
  const centre = centres[army.provinceId]
  const march = army.march
  if (!centre || !march) return null

  const toCentre = centres[march.toProvinceId]
  const spanne = march.arrivalTick - march.departureTick
  // Ein Marsch ohne Dauer ist ein Sprung, und durch null teilt niemand.
  if (!toCentre || spanne <= 0) return null
  // T-M48-02 (E6): Start am Gebaeude (home), Ziel am Gebaeude der naechsten Provinz (toHome).
  const from = army.home ?? centre
  const to = march.toHome ?? toCentre

  const anteil = (tick - march.departureTick) / spanne
  if (anteil <= 0 || anteil >= 1) return null

  return { x: from.x + (to.x - from.x) * anteil, y: from.y + (to.y - from.y) * anteil }
}

/** Hub einer Armee mit `home` ueber ihrem Gebaeude (E5): Kastenunterkante 1 px ueber dem Gebaeudequadrat. */
export const ARMY_LIFT_Y = BUILDING_OFFSET_Y

/**
 * Der gezeichnete Bildschirmpunkt einer Armee (T-M48-02, E5/E6): Stellung am Gebaeude, gehoben um
 * `ARMY_LIFT_Y`; der Hub wird mit dem Marschanteil zwischen Start und Ziel ueberblendet — kein Sprung.
 */
export function armyScreenPoint(
  army: ArmyMarker,
  centres: Readonly<Record<string, Point>>,
  view: View,
  tick?: number,
): Point | null {
  const centre = centres[army.provinceId]
  if (!centre) return null
  const u = tick === undefined ? null : marchPoint(army, centres, tick)
  const base = toScreen(u ?? army.home ?? centre, view)
  const march = army.march
  const a = u && march ? (tick! - march.departureTick) / (march.arrivalTick - march.departureTick) : 0
  const lift = ARMY_LIFT_Y * ((army.home ? 1 : 0) * (1 - a) + (u && march?.toHome ? 1 : 0) * a)
  return { x: base.x, y: base.y - lift }
}

/** Die zwei Bildschirmpunkte des ersten Marschabschnitts (Start und Ziel, mit Hub); null ohne Marsch oder Mitte. */
export function marchEnds(
  army: ArmyMarker,
  centres: Readonly<Record<string, Point>>,
  view: View,
): [Point, Point] | null {
  const march = army.march
  const centre = centres[army.provinceId]
  const toCentre = march ? centres[march.toProvinceId] : undefined
  if (!march || !centre || !toCentre) return null
  const a = toScreen(army.home ?? centre, view)
  const b = toScreen(march.toHome ?? toCentre, view)
  return [
    { x: a.x, y: a.y - (army.home ? ARMY_LIFT_Y : 0) },
    { x: b.x, y: b.y - (march.toHome ? ARMY_LIFT_Y : 0) },
  ]
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
 *
 * `hitBox` ist die Kante der Trefferflaeche; ein Finger bekommt mehr als die Maus
 * (Touch-Bedienung, `TOUCH_TARGET_PX` in `gestures.ts`).
 */
export function pickArmy(
  screen: Point,
  armies: readonly ArmyMarker[],
  centres: Readonly<Record<string, Point>>,
  view: View,
  extras: MarkerExtras = {},
  hitBox: number = ARMY_HIT_BOX,
): string | null {
  // Nie kleiner als der gezeichnete Stapel (T-M30-01): quer greift dessen halbe Breite.
  const reachX = Math.max(hitBox, ARMY_BOX.width) / 2
  const reachY = Math.max(hitBox, ARMY_BOX.height) / 2
  let bestId: string | null = null
  let bestDistance = Infinity

  for (const marker of markersFor(armies, {}, centres, view, extras)) {
    if (marker.kind !== 'army' || !marker.own || !marker.armyId) continue
    const dx = screen.x - marker.x
    const dy = screen.y - marker.y
    if (Math.abs(dx) > reachX || Math.abs(dy) > reachY) continue
    const distance = dx * dx + dy * dy
    // `<=` statt `<`: bei gleichem Abstand gewinnt die ZULETZT gezeichnete, und genau die
    // sieht der Spieler (T-M28-13). Zwei eigene Armeen in derselben Provinz bekommen
    // denselben Punkt; mit `<` waehlte der Klick die verdeckte, und die obenauf liegende
    // war per Karte ueberhaupt nicht anwaehlbar.
    if (distance <= bestDistance) {
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

/** Die letzte Anordnung der Armeemarker, solange Eingabe, Massstab und Uhr dieselben bleiben. */
let layoutCache: {
  armies: readonly ArmyMarker[]
  centres: Readonly<Record<string, Point>>
  scale: number
  tick: number | undefined
  result: Marker[]
} | null = null

/**
 * Die Armeemarker samt Aufaecherung, in Bildpunkten fuer den Ausschnitt mit Ursprung (0, 0).
 *
 * Getrennt vom Ausschnitt, damit das Schieben der Karte nichts neu rechnet: nur der Massstab,
 * die Armeen, die Mitten und die Uhr (marschierende Armeen gleiten) veraendern die Anordnung.
 */
function armyLayout(
  armies: readonly ArmyMarker[],
  centres: Readonly<Record<string, Point>>,
  scale: number,
  tick: number | undefined,
): Marker[] {
  const cached = layoutCache
  if (cached && cached.armies === armies && cached.centres === centres && cached.scale === scale && cached.tick === tick) {
    return cached.result
  }

  const origin: View = { x: 0, y: 0, scale }
  const raw: Marker[] = []
  const growUp: boolean[] = []
  for (const army of armies) {
    // Unterwegs steht der Marker zwischen den Provinzen, sonst in der Mitte (oder am Gebaeude). `tick`
    // fehlt heisst: keine Bewegung — der Aufrufer will keine, oder es gibt keine Uhr.
    const point = armyScreenPoint(army, centres, origin, tick)
    if (!point) continue
    growUp.push(army.home !== undefined && (tick === undefined || marchPoint(army, centres, tick) === null))
    raw.push({
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

  const result = declutter(fanOut(raw, growUp))
  layoutCache = { armies, centres, scale, tick, result }
  return result
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
  if (zoomTier(view.scale) !== 'far') {
    for (const [provinceId, byKind] of Object.entries(buildings)) {
      const centre = centres[provinceId]
      if (!centre) continue

      // An den Ankern der Provinz (T-M30-02); ohne Anker in einer Reihe unter der
      // Mitte, das erste genau darunter — wie bisher, nur als Marker statt als Pip.
      const anchors = extras.anchors?.[provinceId] ?? fallbackAnchors(centre, view.scale)
      for (const placed of placeBuildings(byKind, anchors)) {
        const point = toScreen(placed, view)
        // Sitzt der Anker auf der Provinzmitte, sitzt dort auch der Armeekasten — und
        // der deckt mit 30x18 das 14x14-Quadrat restlos (T-M28-12, Befund 2 der
        // Durchsicht vom 2026-09-11). `anchorsFor` faellt bei zu kleinen Provinzen
        // genau darauf zurueck, weil nur die Mitte sicher im Land liegt; der Versatz
        // gehoert deshalb hierher, in Bildpunkte, und nicht an den Anker.
        const aufDerMitte = placed.x === centre.x && placed.y === centre.y
        markers.push({
          kind: 'building',
          provinceId,
          x: point.x,
          y: aufDerMitte ? point.y + BUILDING_OFFSET_Y : point.y,
          icon: BUILDING_ICONS[placed.building] ?? 'warning',
          level: placed.level,
        })
      }
    }
  }

  // Stapel an einem Punkt werden aufgefaechert und ueberlappende Raster auseinandergeschoben
  // (T-M46-03). LOESCHVERMERK (Review): bis dahin lagen alle Armeen einer Provinz exakt
  // aufeinander — hier stand `markers.push({ kind: 'army', … })` je Armee ohne Versatz.
  // Die Anordnung haengt nur vom Massstab ab, nicht vom Ausschnitt: sie wird einmal gerechnet und
  // beim Schieben der Karte nur verschoben.
  const laidOut = armyLayout(armies, centres, view.scale, extras.tick)
  const shiftX = -view.x / view.scale
  const shiftY = -view.y / view.scale
  for (const marker of laidOut) markers.push({ ...marker, x: marker.x + shiftX, y: marker.y + shiftY })

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
