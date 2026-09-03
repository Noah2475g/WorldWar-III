import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../i18n/text.ts'
import { TOKENS } from '../ui/tokens.ts'
import { MAP_COLORS, prepareFrame, type RenderProvince } from './render.ts'
import { boundsOf, clampView, pickProvince, toScreen, zoomAt, type View, type ViewLimits } from './picking.ts'
import { markersFor, type ArmyMarker } from './markers.ts'
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
  onSelect: (provinceId: string | null) => void
  onViewChange: (view: View) => void
  labelFor: (provinceId: string) => string
}

export function MapCanvas(props: MapCanvasProps) {
  const shapesRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 960, height: 600 })
  const dragRef = useRef<{ x: number; y: number; view: View } | null>(null)

  const withBounds = useMemo(
    () => props.provinces.map((province) => ({ ...province, bounds: province.bounds ?? boundsOf(province.polygon) })),
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
  }, [withBounds, props.view, props.mode, props.ownershipVersion, size])

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
        const points = province.polygon.map(([x, y]) => toScreen({ x, y }, props.view))
        context.beginPath()
        context.moveTo(points[0]!.x, points[0]!.y)
        for (const point of points.slice(1)) context.lineTo(point.x, point.y)
        context.closePath()
        context.strokeStyle = MAP_COLORS.selection
        context.lineWidth = 2.5
        context.stroke()
      }
    }

    for (const marker of markersFor(props.armies, props.buildings, props.centres, props.view)) {
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
        // The NATO shape: a rectangle with a diagonal cross for infantry.
        const w = 18
        const h = 12
        context.fillStyle = marker.own ? TOKENS.ink : TOKENS.accent
        context.fillRect(marker.x - w / 2, marker.y - h / 2, w, h)
        context.strokeStyle = TOKENS.onDark
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(marker.x - w / 2, marker.y - h / 2)
        context.lineTo(marker.x + w / 2, marker.y + h / 2)
        context.moveTo(marker.x + w / 2, marker.y - h / 2)
        context.lineTo(marker.x - w / 2, marker.y + h / 2)
        context.stroke()
        continue
      }

      context.strokeStyle = MAP_COLORS.battle
      context.lineWidth = 2
      context.beginPath()
      context.arc(marker.x, marker.y, 13, 0, Math.PI * 2)
      context.stroke()
    }
  }, [
    props.armies,
    props.buildings,
    props.selectedProvince,
    props.path,
    props.view,
    props.centres,
    withBounds,
    size,
  ])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
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
