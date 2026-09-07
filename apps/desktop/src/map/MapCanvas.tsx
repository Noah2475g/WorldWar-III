import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../i18n/text.ts'
import { TOKENS, TYPE } from '../ui/tokens.ts'
import { MAP_COLORS, prepareFrame, type RenderProvince } from './render.ts'
import { boundsOf, clampView, pickProvince, toScreen, zoomAt, type View, type ViewLimits } from './picking.ts'
import { markersFor, pickArmy, type ArmyMarker } from './markers.ts'
import { ICON_PATHS, type IconName } from '../ui/icons.tsx'
import { labelsFor } from './labels.ts'
import { motionAllowed, ringRadius } from '../ui/motion.ts'
import type { MapMode } from './modes.ts'

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

export interface MapCanvasProps {
  provinces: readonly RenderProvince[]
  centres: Readonly<Record<string, { x: number; y: number }>>
  armies: readonly ArmyMarker[]
  /** Gebaeude je Provinz, als Anzahl — die Symbole darunter (R-MAP-05). */
  buildings: Readonly<Record<string, number>>
  mode: MapMode
  width: number
  height: number
  view: View
  ownershipVersion: number
  selectedProvince: string | null
  /** Provinces the marching order would pass through, drawn as a preview. */
  path?: readonly string[]
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
  onSelect: (provinceId: string | null) => void
  /**
   * Ein Klick nahe genug an einem EIGENEN Armee-Marker (T-M22-06, Befund V2-14):
   * die Armee wird gemeldet statt der Provinz darunter. Die Trefferflaeche ist
   * groesser als der gezeichnete Kasten (ARMY_HIT_BOX, mindestens 24 px). Ohne den
   * Griff bleibt jeder Klick eine Provinzwahl — der Aufrufer entscheidet, ob eine
   * Armeewahl gerade Sinn ergibt (in der Zielwahl z. B. nicht).
   */
  onSelectArmy?: (armyId: string) => void
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

  useEffect(() => {
    // Die Schleife laeuft, solange irgendetwas sich bewegt: ein Gefecht atmet, eine
    // Armee marschiert. Ohne Anlass laeuft sie gar nicht — eine Animationsschleife ohne
    // Grund ist ein Ventilator (T-M13-16), und das gilt fuer Maersche wie fuer Ringe.
    const fighting = (props.battleProvinces ?? []).length > 0
    const marching = props.armies.some((army) => army.march !== undefined)
    if ((!fighting && !marching) || !motionAllowed(props.speed ?? 0)) return

    let running = true
    const step = (time: number): void => {
      if (!running) return
      setClock(time)
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    return () => {
      running = false
    }
  }, [props.battleProvinces, props.armies, props.speed])

  // The cheap layer: armies, selection, labels.
  useEffect(() => {
    const canvas = overlayRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    context.clearRect(0, 0, size.width, size.height)

    if (props.path && props.path.length > 1) {
      context.beginPath()
      props.path.forEach((id, index) => {
        const centre = props.centres[id]
        if (!centre) return
        const point = toScreen(centre, props.view)
        if (index === 0) context.moveTo(point.x, point.y)
        else context.lineTo(point.x, point.y)
      })
      context.strokeStyle = MAP_COLORS.selection
      context.setLineDash([6, 5])
      context.lineWidth = 2
      context.stroke()
      context.setLineDash([])
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

    for (const marker of markersFor(props.armies, props.buildings, props.centres, props.view, {
      capitalProvinceId: props.capitalProvinceId ?? null,
      battleProvinces: props.battleProvinces ?? [],
      // Ohne `tick` stehen marschierende Armeen in der Provinzmitte. Genau das ist
      // gewollt, wenn Bewegung abgeschaltet ist (T-M20-04).
      ...(motionAllowed(props.speed ?? 0) && props.tick !== undefined ? { tick: props.tick } : {}),
    })) {
      if (marker.kind === 'building') {
        // Ein Quadrat je Gebaeude, in einer Reihe unter der Provinzmitte.
        const pip = 4
        const gap = 2
        const total = (marker.count ?? 1) * (pip + gap) - gap
        context.fillStyle = TOKENS.inkSoft
        for (let i = 0; i < (marker.count ?? 1); i++) {
          context.fillRect(marker.x - total / 2 + i * (pip + gap), marker.y, pip, pip)
        }
        continue
      }

      if (marker.kind === 'army') {
        // The situation-map box, with the symbol of the strongest arm of service in it
        // — the same symbol the panels use, drawn from the same paths (R-UI-10).
        const w = 20
        const h = 14
        context.fillStyle = marker.own ? TOKENS.ink : TOKENS.accent
        context.fillRect(marker.x - w / 2, marker.y - h / 2, w, h)
        context.strokeStyle = TOKENS.onDark
        context.lineWidth = 1.2
        drawIcon(context, marker.icon ?? 'infantry', marker.x, marker.y, 13)
        continue
      }

      if (marker.kind === 'capital') {
        context.strokeStyle = TOKENS.ink
        context.lineWidth = 1.6
        drawIcon(context, 'capital', marker.x, marker.y - 14, 15)
        continue
      }

      // A battle: the ring says where, the sabres say what — and it breathes, so a
      // fight is findable on a map of 237 provinces (T-M13-16).
      context.strokeStyle = MAP_COLORS.battle
      context.lineWidth = 2
      context.beginPath()
      context.arc(marker.x, marker.y, ringRadius(clock, 14, { speed: props.speed ?? 0 }), 0, Math.PI * 2)
      context.stroke()
      context.lineWidth = 1.6
      drawIcon(context, 'battle', marker.x, marker.y, 14)
    }
  }, [
    props.armies,
    props.buildings,
    props.selectedProvince,
    props.path,
    props.capitalProvinceId,
    props.battleProvinces,
    props.tick,
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
    if (!drag) return
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
      />
    </div>
  )
}
