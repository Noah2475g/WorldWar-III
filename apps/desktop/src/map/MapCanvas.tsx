import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../i18n/text.ts'
import { TOKENS, TYPE } from '../ui/tokens.ts'
import {
  MAP_COLORS,
  MARCH_AHEAD_WIDTH,
  MARCH_DASH,
  MARCH_DONE_WIDTH,
  MARCH_LABEL_PX,
  MARCH_STANDPOINT_RADIUS,
  battleIntensity,
  battleRingBase,
  battleRingWidth,
  marchArrow,
  marchDays,
  marchLabel,
  marchProgress,
  marchStroke,
  ownershipChanges,
  prepareFrame,
  type RenderProvince,
} from './render.ts'
import {
  boundsOf,
  centreOn,
  clampView,
  pickProvince,
  toMap,
  toScreen,
  zoomAt,
  zoomTier,
  type View,
  type ViewLimits,
} from './picking.ts'
import { ZOOM_STEP } from '../keyboard.ts'
import {
  ARMY_BOX,
  BUILDING_BOX,
  markersFor,
  pickArmy,
  type ArmyMarker,
  type BuildingsByProvince,
  type MarkerTone,
} from './markers.ts'
import type { Anchor } from './anchors.ts'
import { ICON_PATHS, type IconName } from '../ui/icons.tsx'
import { labelsFor } from './labels.ts'
import { OWNERSHIP_FADE_MS, fadeProgress, motionAllowed, ringRadius } from '../ui/motion.ts'
import { fillFor, mixColors, strengthByProvince, type MapMode } from './modes.ts'

/**
 * The map (T-M10-03a/b, R-UI-03).
 *
 * Two canvases stacked: the lower one holds the 237 filled provinces and is only
 * redrawn when the mode, the zoom or an owner changes; the upper one holds armies and
 * the selection and is redrawn every frame. That split is the whole reason the map
 * keeps its frame budget at a hundred game hours a second (design D11).
 */

export type { ArmyMarker } from './markers.ts'

/**
 * Draws one symbol from the icon set onto the canvas (T-M13-09).
 *
 * The paths are the ones the panels render as SVG — the map and the panels agree
 * because they read the same twenty-four-unit drawings, not because someone kept two
 * sets in step. `Path2D` takes the same `d` string a `<path>` does.
 */
function drawIcon(
  context: CanvasRenderingContext2D,
  name: IconName,
  x: number,
  y: number,
  size: number,
): void {
  if (typeof Path2D !== 'function') return
  const scale = size / 24
  context.save()
  context.translate(x - size / 2, y - size / 2)
  context.scale(scale, scale)
  context.stroke(new Path2D(ICON_PATHS[name]))
  context.restore()
}

/** Die Rahmenfarbe eines Stapels je Ton (D27.2). */
const TONE_COLORS: Record<MarkerTone, string> = {
  own: TOKENS.good,
  ally: TOKENS.ally,
  enemy: TOKENS.accent,
  other: TOKENS.inkSoft,
}

/** Rand um den Stempel, damit der Rahmenstrich nicht angeschnitten wird. */
const STAMP_PAD = 2

/** Die Uebersichtskarte in Bildpunkten (D27.4). */
const OVERVIEW = { width: 132, height: 74 } as const

/** Entprellung des Zeigens (T-M31-01, D27.6): ein Tooltip, der jedem Pixel folgt, flackert. */
export const HOVER_DELAY_MS = 120

/**
 * Vorgezeichnete Stapel je (Ton, Glyphe) — gestempelt statt je Bild als Path2D gefuellt
 * (T-M30-01, KRIEGSRAT §6.1). Zahl und Zustandsbalken aendern sich je Armee und werden
 * darueber gezeichnet; Rahmen und Glyphe sind fuer alle gleich und kommen von hier.
 */
function stackStamp(cache: Map<string, HTMLCanvasElement>, tone: MarkerTone, icon: IconName): HTMLCanvasElement | null {
  const key = `${tone}:${icon}`
  const cached = cache.get(key)
  if (cached) return cached
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = ARMY_BOX.width + STAMP_PAD * 2
  canvas.height = ARMY_BOX.height + STAMP_PAD * 2
  const context = canvas.getContext('2d')
  if (!context) return null

  const rim = TONE_COLORS[tone]
  context.fillStyle = TOKENS.ground
  context.fillRect(STAMP_PAD, STAMP_PAD, ARMY_BOX.width, ARMY_BOX.height)
  context.strokeStyle = rim
  context.lineWidth = 1.2
  context.strokeRect(STAMP_PAD + 0.5, STAMP_PAD + 0.5, ARMY_BOX.width - 1, ARMY_BOX.height - 1)
  // Die Glyphe links, damit rechts Platz fuer die Zahl bleibt.
  context.lineWidth = 1.5
  drawIcon(context, icon, STAMP_PAD + 9, STAMP_PAD + ARMY_BOX.height / 2 - 1, 11)

  cache.set(key, canvas)
  return canvas
}

/** Der Gebaeudestempel je Glyphe (T-M30-02, D27.2): Quadrat 14×14, Rahmen `building`. */
function buildingStamp(cache: Map<string, HTMLCanvasElement>, icon: IconName): HTMLCanvasElement | null {
  const key = `building:${icon}`
  const cached = cache.get(key)
  if (cached) return cached
  if (typeof document === 'undefined') return null

  const canvas = document.createElement('canvas')
  canvas.width = BUILDING_BOX + STAMP_PAD * 2
  canvas.height = BUILDING_BOX + STAMP_PAD * 2
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = TOKENS.ground
  context.fillRect(STAMP_PAD, STAMP_PAD, BUILDING_BOX, BUILDING_BOX)
  context.strokeStyle = TOKENS.building
  context.lineWidth = 1
  context.strokeRect(STAMP_PAD + 0.5, STAMP_PAD + 0.5, BUILDING_BOX - 1, BUILDING_BOX - 1)
  context.lineWidth = 1.4
  drawIcon(context, icon, STAMP_PAD + BUILDING_BOX / 2, STAMP_PAD + BUILDING_BOX / 2, 10)

  cache.set(key, canvas)
  return canvas
}

export interface MapCanvasProps {
  provinces: readonly RenderProvince[]
  centres: Readonly<Record<string, { x: number; y: number }>>
  armies: readonly ArmyMarker[]
  /** Gebaeude je Provinz, Art → Stufe — als Marker an den Ankern (R-MAP-05, T-M30-02). */
  buildings: BuildingsByProvince
  /** Die Anker je Provinz, einmal je Karte gerechnet (`anchorsFor`). */
  anchors?: Readonly<Record<string, readonly Anchor[]>>
  mode: MapMode
  width: number
  height: number
  view: View
  ownershipVersion: number
  selectedProvince: string | null
  /** Die eigene Hauptstadt — der Ort, den der Spieler am haeufigsten sucht. */
  capitalProvinceId?: string | null
  /** Provinzen, in denen gerade gekaempft wird (aus der Sicht, nicht aus den Armeen). */
  battleProvinces?: readonly string[]
  /** Spielstunden je Sekunde — darueber hoert jede Bewegung auf (T-M13-16). */
  speed?: number
  /**
   * Die Spieluhr, fuer den Ort einer marschierenden Armee (T-M20-04).
   *
   * Fehlt sie, stehen alle Armeen in der Provinzmitte — was bei abgeschalteter Bewegung
   * genau das Richtige ist und was jeder Test bekommt, der sie nicht mitgibt.
   */
  tick?: number
  /** Ticks je Spieltag, fuer die Tagesangabe am Marschweg (T-M30-04). Ohne: keine Angabe. */
  ticksPerDay?: number
  onSelect: (provinceId: string | null) => void
  /**
   * Ein Klick nahe genug an einem EIGENEN Armee-Marker (T-M22-06, Befund V2-14):
   * die Armee wird gemeldet statt der Provinz darunter. Die Trefferflaeche ist
   * groesser als der gezeichnete Kasten (ARMY_HIT_BOX, mindestens 24 px). Ohne den
   * Griff bleibt jeder Klick eine Provinzwahl — der Aufrufer entscheidet, ob eine
   * Armeewahl gerade Sinn ergibt (in der Zielwahl z. B. nicht).
   */
  onSelectArmy?: (armyId: string) => void
  /**
   * Worauf der Zeiger ruht (T-M31-01): die Provinz und die Stelle auf der Karte, nach
   * HOVER_DELAY_MS Ruhe — oder null, sobald der Zeiger die Karte verlaesst.
   */
  onHover?: (provinceId: string | null, at: { x: number; y: number } | null) => void
  onViewChange: (view: View) => void
  labelFor: (provinceId: string) => string
}

export function MapCanvas(props: MapCanvasProps) {
  const shapesRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 960, height: 600 })
  // Die Bildschirmuhr fuer alles, was sich von selbst bewegt. Sie laeuft nur, solange es
  // einen Anlass gibt — eine Animationsschleife ohne Grund ist ein Ventilator.
  const [clock, setClock] = useState(0)
  const dragRef = useRef<{ x: number; y: number; view: View } | null>(null)
  /** Die gestempelten Stapel je (Ton, Glyphe) — einmal gezeichnet, je Bild kopiert (T-M30-01). */
  const stampsRef = useRef(new Map<string, HTMLCanvasElement>())
  /** Die Uebersichtskarte (T-M30-03): die ganze Welt klein, Ausschnitt in Bernstein. */
  const overviewRef = useRef<HTMLCanvasElement>(null)
  /** Der laufende Entprell-Zeitgeber des Zeigens (T-M31-01). */
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Laufende Farbwellen eines Besitzwechsels (T-M26-02, D25.4).
   *
   * `startedMs` bleibt null, bis das erste Bild der Schleife laeuft: die Uhr der
   * Bildschleife (rAF-Zeitstempel) ist die einzige, gegen die der Fortschritt gerechnet
   * wird — ein Start "jetzt" mit einer anderen Uhr ergaebe eine Welle, die je nach
   * Standzeit der Schleife schon vorbei waere, bevor jemand sie sah.
   */
  const [fades, setFades] = useState<
    { id: string; from: string | null; to: string | null; startedMs: number | null }[]
  >([])
  const previousOwners = useRef<Record<string, string | null> | null>(null)

  const withBounds = useMemo(
    () => props.provinces.map((province) => ({ ...province, bounds: province.bounds ?? boundsOf(province.polygons) })),
    [props.provinces],
  )

  const limits: ViewLimits = useMemo(
    () => ({
      width: props.width,
      height: props.height,
      viewportWidth: size.width,
      viewportHeight: size.height,
      minScale: 0.2,
      maxScale: Math.max(1, props.width / size.width),
    }),
    [props.width, props.height, size.width, size.height],
  )

  // The wrapper decides the size; the canvases follow it.
  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return
    const update = () =>
      setSize({
        width: Math.max(320, element.clientWidth),
        height: Math.max(240, element.clientHeight),
      })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The expensive layer. Its dependencies are exactly the four things that change it.
  useEffect(() => {
    const canvas = shapesRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    context.fillStyle = MAP_COLORS.sea
    context.fillRect(0, 0, size.width, size.height)

    for (const shape of prepareFrame(withBounds, props.view, size, props.mode)) {
      if (shape.points.length < 3) continue
      context.beginPath()
      context.moveTo(shape.points[0]![0], shape.points[0]![1])
      for (let i = 1; i < shape.points.length; i++) context.lineTo(shape.points[i]![0], shape.points[i]![1])
      context.closePath()
      context.fillStyle = shape.fill
      context.fill()
      context.strokeStyle = MAP_COLORS.border
      context.lineWidth = 0.7
      context.stroke()
    }

    // Die Namen gehoeren auf diese Ebene: sie aendern sich mit Zoom und Ausschnitt,
    // also genau dann, wenn die Flaechen ohnehin neu gezeichnet werden (D18.3).
    context.font = `500 11px ${TYPE.map}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const candidates = withBounds.map((province) => ({
      id: province.id,
      name: props.labelFor(province.id),
      centre: props.centres[province.id] ?? { x: 0, y: 0 },
      bounds: province.bounds!,
    }))

    for (const label of labelsFor(candidates, props.view, size, (text) => context.measureText(text).width)) {
      // Heller Saum, damit die Schrift auf jeder Fuellung lesbar bleibt — auf einer
      // dunklen Machtfarbe genauso wie auf dem hellen Leinen des Neutralen.
      context.lineWidth = 3
      context.strokeStyle = MAP_COLORS.labelHalo
      context.strokeText(label.text, label.x, label.y)
      context.fillStyle = MAP_COLORS.label
      context.fillText(label.text, label.x, label.y)
    }
  }, [withBounds, props.view, props.mode, props.ownershipVersion, props.centres, props.labelFor, size])

  // Der Besitzstand des letzten Bildes gegen den jetzigen: was gewechselt hat, blendet
  // als Farbwelle (T-M26-02). Ohne Bewegungserlaubnis wird nichts vorgemerkt — der
  // harte Wechsel der teuren Ebene IST dann der reduced-motion-Pfad.
  useEffect(() => {
    const previous = previousOwners.current
    const next: Record<string, string | null> = {}
    for (const province of props.provinces) next[province.id] = province.owner
    previousOwners.current = next

    if (!previous || !motionAllowed(props.speed ?? 0)) return
    const changes = ownershipChanges(previous, props.provinces)
    if (changes.length === 0) return
    setFades((old) => [
      // Wechselt eine Provinz erneut, ersetzt die neue Welle die alte.
      ...old.filter((fade) => !changes.some((change) => change.id === fade.id)),
      ...changes.map((change) => ({ ...change, startedMs: null })),
    ])
  }, [props.provinces, props.speed])

  const fading = fades.length > 0

  useEffect(() => {
    // Die Schleife laeuft, solange irgendetwas sich bewegt: ein Gefecht atmet, eine
    // Armee marschiert, eine Eroberung blendet. Ohne Anlass laeuft sie gar nicht — eine
    // Animationsschleife ohne Grund ist ein Ventilator (T-M13-16).
    const fighting = (props.battleProvinces ?? []).length > 0
    const marching = props.armies.some((army) => army.march !== undefined)
    if ((!fighting && !marching && !fading) || !motionAllowed(props.speed ?? 0)) return

    let running = true
    const step = (time: number): void => {
      if (!running) return
      setClock(time)
      // Wellen bekommen ihren Start vom ersten Bild und enden nach der Blenddauer;
      // sind alle vorbei, endet mit ihnen der Anlass, und die Schleife steht wieder.
      setFades((old) => {
        if (old.length === 0) return old
        let changed = false
        const next = old.flatMap((fade) => {
          if (fade.startedMs === null) {
            changed = true
            return [{ ...fade, startedMs: time }]
          }
          if (time - fade.startedMs >= OWNERSHIP_FADE_MS) {
            changed = true
            return []
          }
          return [fade]
        })
        return changed ? next : old
      })
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    return () => {
      running = false
    }
  }, [props.battleProvinces, props.armies, props.speed, fading])

  // The cheap layer: armies, selection, labels.
  useEffect(() => {
    const canvas = overlayRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    context.clearRect(0, 0, size.width, size.height)

    // Die Farbwelle eines Besitzwechsels (T-M26-02, D25.4): die teure Ebene traegt
    // laengst die neue Farbe, hier blendet die Flaeche ~600 ms von der alten hinueber —
    // mit derselben Mischformel, aus der auch die Modi ihre Skalen mischen. Zuunterst,
    // damit Pfeile, Marker und Ringe darueber lesbar bleiben.
    for (const fade of fades) {
      const province = withBounds.find((p) => p.id === fade.id)
      if (!province) continue
      // Durch fadeProgress auch bei noch nicht gestarteter Welle: faellt die Bewegungs-
      // erlaubnis zwischen Vormerken und erstem Bild weg, liefert es 1 — die Welle
      // entfaellt, statt die alte Farbe festzunageln.
      const progress = fadeProgress(fade.startedMs === null ? 0 : clock - fade.startedMs, {
        speed: props.speed ?? 0,
      })
      if (progress >= 1) continue
      const from = fillFor({ ...province, owner: fade.from }, props.mode)
      const to = fillFor(province, props.mode)
      if (from === to) continue
      context.fillStyle = mixColors(from, to, progress)
      for (const ring of province.polygons) {
        const points = ring.map(([x, y]) => toScreen({ x, y }, props.view))
        if (points.length < 3) continue
        context.beginPath()
        context.moveTo(points[0]!.x, points[0]!.y)
        for (const point of points.slice(1)) context.lineTo(point.x, point.y)
        context.closePath()
        context.fill()
      }
    }

    // Marschpfeile (T-M26-01, D25.3): jede sichtbare marschierende Armee zeigt ihre
    // Route — der zurueckgelegte Anteil voll, der Rest blass, die Spitze am Ziel. Das
    // ersetzt die gestrichelte Linie, die nur die GEWAEHLTE Armee und ohne Richtung
    // zeigte. Der Fortschritt haengt am Spieltick, nicht an der Bildschirmuhr: er ist
    // Zustand wie ein Fortschrittsbalken und bleibt auch unter prefers-reduced-motion
    // ablesbar — nur der GLEITENDE Marker (markersFor) respektiert die Einstellung.
    for (const army of props.armies) {
      if (!army.march) continue
      const stations = [army.provinceId, ...(army.march.route ?? [army.march.toProvinceId])]
      const points: [number, number][] = []
      for (const id of stations) {
        const centre = props.centres[id]
        if (!centre) break
        const screen = toScreen(centre, props.view)
        points.push([screen.x, screen.y])
      }
      const arrow = marchArrow(points, props.tick === undefined ? 0 : marchProgress(army.march, props.tick))
      if (!arrow) continue

      const stroke = marchStroke(army)
      const drawLine = (line: [number, number][]): void => {
        context.beginPath()
        context.moveTo(line[0]![0], line[0]![1])
        for (const [x, y] of line.slice(1)) context.lineTo(x, y)
        context.stroke()
      }

      // Der Marschweg im Kriegsrat (T-M30-04, D27.5): der Rest gestrichelt und duenn,
      // das Gelaufene voll und rund, dazwischen der Standpunkt als Kreis mit dunklem
      // Rand — und ab der mittleren Stufe die Tagesangabe "n/m T" daneben.
      context.strokeStyle = stroke
      context.save()
      context.setLineDash([...MARCH_DASH])
      context.lineWidth = MARCH_AHEAD_WIDTH
      drawLine(arrow.ahead)
      context.restore()
      context.save()
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.lineWidth = MARCH_DONE_WIDTH
      drawLine(arrow.done)
      context.restore()

      // Die Spitze in voller Farbe: die Richtung ist die halbe Botschaft des Pfeils.
      context.fillStyle = stroke
      context.beginPath()
      context.moveTo(arrow.head[0]![0], arrow.head[0]![1])
      for (const [x, y] of arrow.head.slice(1)) context.lineTo(x, y)
      context.closePath()
      context.fill()

      const [standX, standY] = arrow.standpoint
      context.beginPath()
      context.arc(standX, standY, MARCH_STANDPOINT_RADIUS, 0, Math.PI * 2)
      context.fillStyle = stroke
      context.fill()
      context.strokeStyle = TOKENS.ground
      context.lineWidth = 1.2
      context.stroke()

      if (props.tick !== undefined && props.ticksPerDay !== undefined && zoomTier(props.view.scale) !== 'far') {
        const label = marchLabel(marchDays(army.march, props.tick, props.ticksPerDay))
        context.font = `600 ${MARCH_LABEL_PX}px ${TYPE.num}`
        context.textAlign = 'left'
        context.textBaseline = 'bottom'
        context.lineWidth = 2
        context.strokeStyle = TOKENS.ground
        context.strokeText(label, standX + MARCH_STANDPOINT_RADIUS + 2, standY - 2)
        context.fillStyle = TOKENS.ink
        context.fillText(label, standX + MARCH_STANDPOINT_RADIUS + 2, standY - 2)
        context.textBaseline = 'alphabetic'
      }
    }

    if (props.selectedProvince) {
      const province = withBounds.find((p) => p.id === props.selectedProvince)
      if (province) {
        context.strokeStyle = MAP_COLORS.selection
        context.lineWidth = 2.5
        // Je Teil ein eigener Zug. Ein einziger Pfad ueber alle Umrisse zoege eine
        // Linie von Alaska nach Kalifornien quer durch den Pazifik (T-M19-02).
        for (const ring of province.polygons) {
          const points = ring.map(([x, y]) => toScreen({ x, y }, props.view))
          if (points.length === 0) continue
          context.beginPath()
          context.moveTo(points[0]!.x, points[0]!.y)
          for (const point of points.slice(1)) context.lineTo(point.x, point.y)
          context.closePath()
          context.stroke()
        }
      }
    }

    // Die sichtbare Gesamtstaerke je Provinz, fuer die Intensitaet der Gefechtsringe.
    const strengthOf = strengthByProvince(props.armies)

    for (const marker of markersFor(props.armies, props.buildings, props.centres, props.view, {
      capitalProvinceId: props.capitalProvinceId ?? null,
      battleProvinces: props.battleProvinces ?? [],
      ...(props.anchors ? { anchors: props.anchors } : {}),
      // Ohne `tick` stehen marschierende Armeen in der Provinzmitte. Genau das ist
      // gewollt, wenn Bewegung abgeschaltet ist (T-M20-04).
      ...(motionAllowed(props.speed ?? 0) && props.tick !== undefined ? { tick: props.tick } : {}),
    })) {
      if (marker.kind === 'building') {
        // Ein Quadrat je Gebaeude an seinem Anker (T-M30-02, D27.2): Rahmen in
        // `building`, Glyphe aus demselben Pfad wie im Panel, Stufe ab 2 als Ziffer
        // rechts oben. Gestempelt, nicht je Bild gezeichnet.
        const left = marker.x - BUILDING_BOX / 2
        const top = marker.y - BUILDING_BOX / 2
        const stamp = buildingStamp(stampsRef.current, marker.icon ?? 'warning')
        if (stamp) {
          context.drawImage(stamp, left - STAMP_PAD, top - STAMP_PAD)
        } else {
          context.fillStyle = TOKENS.ground
          context.fillRect(left, top, BUILDING_BOX, BUILDING_BOX)
          context.strokeStyle = TOKENS.building
          context.lineWidth = 1
          context.strokeRect(left + 0.5, top + 0.5, BUILDING_BOX - 1, BUILDING_BOX - 1)
          context.lineWidth = 1.4
          drawIcon(context, marker.icon ?? 'warning', marker.x, marker.y, 10)
        }
        if ((marker.level ?? 1) >= 2) {
          context.fillStyle = TOKENS.building
          context.font = `600 7px ${TYPE.num}`
          context.textAlign = 'right'
          context.textBaseline = 'top'
          context.fillText(String(marker.level), left + BUILDING_BOX + 4, top - 3)
          context.textAlign = 'left'
          context.textBaseline = 'alphabetic'
        }
        continue
      }

      if (marker.kind === 'army') {
        // Der Stapel im NATO-Stil (T-M30-01, D27.2): Rechteck 30×18, Rahmen in der
        // Besitzerfarbe, Glyphe der staerksten Gattung — als Stempel aus dem
        // Zwischenspeicher —, dazu die Stueckzahl in Ziffernschrift und der
        // 3-px-Zustandsbalken am unteren Rand. Beides nur, wo die Sicht es kennt.
        const tone = marker.tone ?? (marker.own ? 'own' : 'other')
        const rim = TONE_COLORS[tone]
        const left = marker.x - ARMY_BOX.width / 2
        const top = marker.y - ARMY_BOX.height / 2
        const stamp = stackStamp(stampsRef.current, tone, marker.icon ?? 'infantry')
        if (stamp) {
          context.drawImage(stamp, left - STAMP_PAD, top - STAMP_PAD)
        } else {
          context.fillStyle = TOKENS.ground
          context.fillRect(left, top, ARMY_BOX.width, ARMY_BOX.height)
          context.strokeStyle = rim
          context.lineWidth = 1.2
          context.strokeRect(left + 0.5, top + 0.5, ARMY_BOX.width - 1, ARMY_BOX.height - 1)
          context.lineWidth = 1.5
          drawIcon(context, marker.icon ?? 'infantry', left + 9, marker.y - 1, 11)
        }

        if (marker.count !== undefined) {
          context.fillStyle = TOKENS.ink
          context.font = `600 9px ${TYPE.num}`
          context.textAlign = 'right'
          context.textBaseline = 'middle'
          context.fillText(String(marker.count), left + ARMY_BOX.width - 3, marker.y - 1)
          context.textAlign = 'left'
          context.textBaseline = 'alphabetic'
        }

        if (marker.condition !== undefined) {
          const trackLeft = left + 2
          const trackWidth = ARMY_BOX.width - 4
          const barY = top + ARMY_BOX.height - 4
          context.fillStyle = TOKENS.line
          context.fillRect(trackLeft, barY, trackWidth, 3)
          context.fillStyle = rim
          context.fillRect(trackLeft, barY, Math.round(trackWidth * Math.max(0, Math.min(1, marker.condition))), 3)
        }
        continue
      }

      if (marker.kind === 'capital') {
        context.strokeStyle = TOKENS.ink
        context.lineWidth = 1.6
        drawIcon(context, 'capital', marker.x, marker.y - 14, 15)
        continue
      }

      // A battle: the ring says where, the sabres say what — and it breathes, so a
      // fight is findable on a map of 237 provinces (T-M13-16). Seit T-M26-02 traegt
      // der Ring die Groesse des Gefechts: Radius und Strich wachsen mit der sichtbaren
      // Gesamtstaerke der Provinz — ein Scharmuetzel fluestert, eine Feldschlacht ruft.
      const intensity = battleIntensity(strengthOf[marker.provinceId] ?? 0)
      context.strokeStyle = MAP_COLORS.battle
      context.lineWidth = battleRingWidth(intensity)
      context.beginPath()
      context.arc(
        marker.x,
        marker.y,
        ringRadius(clock, battleRingBase(intensity), { speed: props.speed ?? 0 }),
        0,
        Math.PI * 2,
      )
      context.stroke()
      context.lineWidth = 1.6
      drawIcon(context, 'battle', marker.x, marker.y, 14)
    }
  }, [
    fades,
    props.armies,
    props.buildings,
    props.anchors,
    props.mode,
    props.selectedProvince,
    props.capitalProvinceId,
    props.battleProvinces,
    props.tick,
    props.ticksPerDay,
    props.speed,
    clock,
    props.view,
    props.centres,
    withBounds,
    size,
  ])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }

      // Erst die Armee, dann die Provinz (T-M22-06, V2-14): mit derselben
      // Ortsrechnung wie das Zeichnen, damit auch eine marschierende getroffen wird.
      if (props.onSelectArmy) {
        const armyId = pickArmy(screen, props.armies, props.centres, props.view, {
          ...(motionAllowed(props.speed ?? 0) && props.tick !== undefined ? { tick: props.tick } : {}),
        })
        if (armyId) {
          props.onSelectArmy(armyId)
          return
        }
      }

      props.onSelect(pickProvince(screen, props.view, withBounds))
    },
    [props, withBounds],
  )

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      props.onViewChange(zoomAt(props.view, screen, event.deltaY > 0 ? 1.2 : 1 / 1.2, limits))
    },
    [props, limits],
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY, view: props.view }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) {
      // Zeigen ohne Ziehen: entprellt melden, worauf der Zeiger ruht (T-M31-01).
      if (props.onHover) {
        const rect = event.currentTarget.getBoundingClientRect()
        const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        if (hoverTimer.current) clearTimeout(hoverTimer.current)
        hoverTimer.current = setTimeout(() => {
          hoverTimer.current = null
          props.onHover?.(pickProvince(screen, props.view, withBounds), screen)
        }, HOVER_DELAY_MS)
      }
      return
    }
    props.onViewChange(
      clampView(
        {
          x: drag.view.x - (event.clientX - drag.x) * drag.view.scale,
          y: drag.view.y - (event.clientY - drag.y) * drag.view.scale,
          scale: drag.view.scale,
        },
        limits,
      ),
    )
  }

  const handlePointerUp = () => {
    dragRef.current = null
  }

  const handlePointerLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    props.onHover?.(null, null)
  }

  // Die Knoepfe zoomen um die Mitte des Ausschnitts — wie die Bildtasten (T-M30-03).
  const zoomBy = useCallback(
    (factor: number) => props.onViewChange(zoomAt(props.view, { x: size.width / 2, y: size.height / 2 }, factor, limits)),
    [props, size, limits],
  )
  const centreCapital = useCallback(() => {
    const centre = props.capitalProvinceId ? props.centres[props.capitalProvinceId] : undefined
    if (centre) props.onViewChange(centreOn(centre, props.view, limits))
  }, [props, limits])

  /*
   * Die Uebersichtskarte (T-M30-03, D27.4): 132 x 74, die Flaechenebene der ganzen Welt
   * verkleinert, darueber der Ausschnitt als Bernstein-Rahmen. Die Flaechen kommen aus
   * demselben prepareFrame wie die grosse Karte, nur mit einem Massstab, bei dem fast
   * jeder Punkt der Ausduennung zum Opfer faellt — darum ist sie billig.
   */
  const overviewScale = Math.max(props.width / OVERVIEW.width, props.height / OVERVIEW.height)
  useEffect(() => {
    const canvas = overviewRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const worldView = { x: 0, y: 0, scale: overviewScale }
    context.fillStyle = MAP_COLORS.sea
    context.fillRect(0, 0, OVERVIEW.width, OVERVIEW.height)
    for (const shape of prepareFrame(withBounds, worldView, OVERVIEW, props.mode)) {
      // Ein Zug je vorbereiteter Form — dieselbe Schleife wie die grosse Ebene.
      if (shape.points.length === 0) continue
      context.fillStyle = shape.fill
      context.beginPath()
      context.moveTo(shape.points[0]![0], shape.points[0]![1])
      for (const [x, y] of shape.points.slice(1)) context.lineTo(x, y)
      context.closePath()
      context.fill()
    }

    const left = props.view.x / overviewScale
    const top = props.view.y / overviewScale
    context.strokeStyle = TOKENS.warn
    context.lineWidth = 1
    context.strokeRect(
      left + 0.5,
      top + 0.5,
      Math.max(2, (size.width * props.view.scale) / overviewScale),
      Math.max(2, (size.height * props.view.scale) / overviewScale),
    )
  }, [withBounds, props.mode, props.ownershipVersion, props.view, size, overviewScale])

  const handleOverviewClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const point = toMap({ x: event.clientX - rect.left, y: event.clientY - rect.top }, { x: 0, y: 0, scale: overviewScale })
      props.onViewChange(centreOn(point, props.view, limits))
    },
    [props, limits, overviewScale],
  )

  return (
    <div ref={wrapperRef} className="map-wrapper">
      <canvas ref={shapesRef} width={size.width} height={size.height} className="map-layer" aria-hidden="true" />
      <canvas
        ref={overlayRef}
        width={size.width}
        height={size.height}
        className="map-layer map-layer--overlay"
        role="application"
        aria-label={t('a11y.map')}
        tabIndex={0}
        onClick={handleClick}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      />

      {/* Zoom und Heimweg als Knoepfe (T-M30-03, R-UI-15): oben rechts, benannt. */}
      <div className="map-controls" role="group" aria-label={t('map.zoomIn')}>
        <button type="button" className="map-control" aria-label={t('map.zoomIn')} title={t('map.zoomIn')} onClick={() => zoomBy(1 / ZOOM_STEP)}>
          +
        </button>
        <button type="button" className="map-control" aria-label={t('map.zoomOut')} title={t('map.zoomOut')} onClick={() => zoomBy(ZOOM_STEP)}>
          −
        </button>
        <button
          type="button"
          className="map-control"
          aria-label={t('map.centreCapital')}
          title={t('map.centreCapital')}
          onClick={centreCapital}
          disabled={!props.capitalProvinceId}
        >
          ◎
        </button>
      </div>

      <canvas
        ref={overviewRef}
        width={OVERVIEW.width}
        height={OVERVIEW.height}
        className="map-overview"
        role="button"
        tabIndex={0}
        aria-label={t('map.overview')}
        title={t('map.overview')}
        onClick={handleOverviewClick}
      />
    </div>
  )
}
