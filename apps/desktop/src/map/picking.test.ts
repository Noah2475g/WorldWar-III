import { describe, expect, it } from 'vitest'
import {
  LAYERS,
  boundsOf,
  centreOn,
  clampView,
  layersToRedraw,
  pickProvince,
  pointInPolygon,
  toMap,
  toScreen,
  zoomAt,
  type PickableProvince,
  type ViewLimits,
} from './picking.ts'

/**
 * Clicking the map (T-M10-03a, R-UI-03).
 *
 * All of this is arithmetic on purpose. "The wrong province got selected" is a bug
 * that survives any amount of manual clicking around, and it is unanswerable once the
 * only way to reproduce it is to move a mouse. As geometry it can be pinned down.
 */

const square = (id: string, x: number, y: number, size = 10): PickableProvince => ({
  id,
  polygon: [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ],
})

const limits: ViewLimits = {
  width: 1000,
  height: 600,
  viewportWidth: 800,
  viewportHeight: 400,
  minScale: 0.25,
  maxScale: 4,
}

describe('R-UI-03 Umrechnung Bildschirm und Karte', () => {
  it('ist umkehrbar', () => {
    const view = { x: 120, y: 80, scale: 1.5 }
    const point = { x: 42, y: 17 }

    const back = toScreen(toMap(point, view), view)

    expect(back.x).toBeCloseTo(point.x, 9)
    expect(back.y).toBeCloseTo(point.y, 9)
  })

  it('verschiebt und skaliert in der richtigen Richtung', () => {
    const view = { x: 100, y: 50, scale: 2 }

    expect(toMap({ x: 0, y: 0 }, view)).toEqual({ x: 100, y: 50 })
    expect(toMap({ x: 10, y: 10 }, view)).toEqual({ x: 120, y: 70 })
  })
})

describe('R-UI-03 Trefferpruefung', () => {
  it('trifft die Provinz unter dem Zeiger', () => {
    const provinces = [square('a', 0, 0), square('b', 20, 0)]
    const view = { x: 0, y: 0, scale: 1 }

    expect(pickProvince({ x: 5, y: 5 }, view, provinces)).toBe('a')
    expect(pickProvince({ x: 25, y: 5 }, view, provinces)).toBe('b')
  })

  it('trifft nichts zwischen zwei Provinzen', () => {
    const provinces = [square('a', 0, 0), square('b', 20, 0)]

    expect(pickProvince({ x: 15, y: 5 }, { x: 0, y: 0, scale: 1 }, provinces)).toBeNull()
  })

  it('rechnet Verschiebung und Zoom mit', () => {
    const provinces = [square('a', 100, 100)]

    // Same province, seen from a scrolled and zoomed-out view.
    expect(pickProvince({ x: 5, y: 5 }, { x: 100, y: 100, scale: 1 }, provinces)).toBe('a')
    expect(pickProvince({ x: 2, y: 2 }, { x: 96, y: 96, scale: 2 }, provinces)).toBe('a')
    expect(pickProvince({ x: 0, y: 0 }, { x: 0, y: 0, scale: 1 }, provinces)).toBeNull()
  })

  it('erkennt einen Punkt in einer verwinkelten Flaeche', () => {
    // An L: the notch must not count as inside, or clicks in the bay select the wrong
    // province — which on a coastline is most of them.
    const shape: PickableProvince = {
      id: 'L',
      polygon: [
        [0, 0],
        [10, 0],
        [10, 4],
        [4, 4],
        [4, 10],
        [0, 10],
      ],
    }

    expect(pointInPolygon({ x: 2, y: 8 }, shape.polygon)).toBe(true)
    expect(pointInPolygon({ x: 8, y: 2 }, shape.polygon)).toBe(true)
    expect(pointInPolygon({ x: 8, y: 8 }, shape.polygon)).toBe(false)
  })

  it('nutzt die Umgrenzung als schnellen Ausschluss', () => {
    const bounds = boundsOf(square('a', 5, 7, 3).polygon)

    expect(bounds).toEqual({ minX: 5, minY: 7, maxX: 8, maxY: 10 })
  })

  it('waehlt bei mehreren Treffern immer denselben', () => {
    const overlapping = [square('a', 0, 0), square('b', 0, 0)]

    expect(pickProvince({ x: 5, y: 5 }, { x: 0, y: 0, scale: 1 }, overlapping)).toBe('a')
  })
})

describe('R-UI-03 Der Ausschnitt bleibt auf der Karte', () => {
  it('laesst nicht ueber den Rand hinausscrollen', () => {
    const clamped = clampView({ x: -500, y: -500, scale: 1 }, limits)

    expect(clamped.x).toBeGreaterThanOrEqual(0)
    expect(clamped.y).toBeGreaterThanOrEqual(0)
  })

  it('haelt die Zoomstufe in ihren Grenzen', () => {
    expect(clampView({ x: 0, y: 0, scale: 99 }, limits).scale).toBe(limits.maxScale)
    expect(clampView({ x: 0, y: 0, scale: 0.001 }, limits).scale).toBe(limits.minScale)
  })

  it('zentriert die Karte, wenn sie kleiner ist als das Fenster', () => {
    // Otherwise a fully zoomed-out map sticks to a corner and looks broken.
    const clamped = clampView({ x: 0, y: 0, scale: 4 }, limits)

    expect(clamped.x).toBeLessThan(0)
    expect(clamped.x).toBeCloseTo((limits.width - limits.viewportWidth * 4) / 2, 6)
  })

  it('zoomt auf den Punkt unter dem Zeiger', () => {
    // The map must not slide out from under the cursor: the point stays put.
    const view = { x: 200, y: 100, scale: 1 }
    const screen = { x: 400, y: 200 }
    const before = toMap(screen, view)

    const zoomed = zoomAt(view, screen, 0.5, limits)
    const after = toMap(screen, zoomed)

    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
  })

  it('zentriert auf eine Provinz', () => {
    const view = { x: 0, y: 0, scale: 1 }

    const centred = centreOn({ x: 500, y: 300 }, view, limits)

    expect(centred.x + (limits.viewportWidth * centred.scale) / 2).toBeCloseTo(500, 6)
  })
})

describe('R-UI-03 Ebenen', () => {
  it('zeichnet in der Reihenfolge aus Design D11', () => {
    expect(LAYERS).toEqual([
      'sea',
      'provinces',
      'borders',
      'infrastructure',
      'armies',
      'selection',
      'labels',
    ])
    // Armies above borders, labels above everything: the order is a decision, not an
    // accident of call sequence, so it is written down and checked.
    expect(LAYERS.indexOf('armies')).toBeGreaterThan(LAYERS.indexOf('borders'))
    expect(LAYERS.indexOf('labels')).toBe(LAYERS.length - 1)
  })

  it('zeichnet je Bild nur die beweglichen Ebenen neu', () => {
    // The 237 filled shapes are the expensive layer; redrawing them every frame is
    // what makes a map map stutter at high speed.
    expect(layersToRedraw('frame')).toEqual(['armies', 'selection'])
    expect(layersToRedraw('selection')).toEqual(['selection'])
  })

  it('zeichnet bei Besitzwechsel, Modus und Zoom alles neu', () => {
    for (const change of ['ownership', 'mode', 'zoom'] as const) {
      expect(layersToRedraw(change)).toEqual([...LAYERS])
    }
  })
})
