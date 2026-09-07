import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { boundsOf } from './picking.ts'
import { cacheKey, isVisible, prepareFrame, thin, worthDrawing, type RenderProvince } from './render.ts'

/**
 * The frame budget (T-M10-03b, R-ARCH-06/AK2).
 *
 * Measured on the real world map, not on a fixture: 237 provinces with a hundred
 * thousand points between them is the load the game actually has, and a budget met on
 * twelve squares says nothing about it.
 *
 * The timing itself lives in `render.bench.slow.test.ts`: measured beside thirty other
 * test files it reports the machine's load rather than the code's cost. What is checked
 * here is the behaviour the budget depends on — that off-screen provinces never reach
 * the canvas, that points are thinned with the zoom, and that the cached layer is kept
 * exactly as long as it is valid.
 */

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url))
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as {
  width: number
  height: number
  provinces: {
    id: string
    polygons: [number, number][][]
    population: number
    deposits: Record<string, number>
  }[]
}

const provinces: RenderProvince[] = world.provinces.map((p, index) => ({
  id: p.id,
  owner: index % 5 === 0 ? null : `p${(index % 8) + 1}`,
  morale: 40 + (index % 60),
  deposits: p.deposits,
  threat: (index * 37) % 1000,
  polygons: p.polygons,
  bounds: boundsOf(p.polygons),
}))

const viewport = { width: 1600, height: 900 }
const wholeWorld = { x: 0, y: 0, scale: world.width / viewport.width }

describe('R-ARCH-06 Was das Budget traegt', () => {
  it('verwirft heruntergezoomt fast alles vor dem Zeichnen', () => {
    // Zoomed into Europe, most of the world is off screen and must never reach the
    // canvas — that is where the budget is won.
    const zoomed = { x: world.width * 0.48, y: world.height * 0.2, scale: 0.25 }

    const shapes = prepareFrame(provinces, zoomed, viewport, 'political')

    // Gezaehlt werden Provinzen, nicht Formen: seit T-M19-02 liefert prepareFrame je
    // Umriss eine Form, und eine Provinz bringt im Schnitt neun mit. Was die Aussage
    // traegt, ist unveraendert — wer nicht im Ausschnitt liegt, kommt gar nicht vor.
    const drawn = new Set(shapes.map((shape) => shape.id))

    expect(drawn.size).toBeLessThan(provinces.length / 3)
    expect(drawn.size).toBeGreaterThan(0)
  })

  it('duennt Stuetzpunkte mit der Zoomstufe aus', () => {
    // Der laengste Einzelring der Karte, nicht die Provinz mit den meisten Ringen:
    // ausgeduennt wird je Umriss (T-M19-02).
    const biggest = provinces.flatMap((p) => p.polygons).reduce((a, b) => (a.length >= b.length ? a : b))

    const far = thin(biggest, wholeWorld)
    const near = thin(biggest, { x: 0, y: 0, scale: 0.1 })

    expect(far.length).toBeLessThan(biggest.length)
    expect(near.length).toBeGreaterThan(far.length)
  })

  it('duennt eine Flaeche nie unter ein Dreieck', () => {
    const tiny: [number, number][] = [
      [0, 0],
      [0.1, 0],
      [0.1, 0.1],
      [0, 0.1],
      [0, 0],
    ]

    expect(thin(tiny, { x: 0, y: 0, scale: 1000 }).length).toBeGreaterThanOrEqual(3)
  })

  it('erkennt, was ausserhalb des Ausschnitts liegt', () => {
    const view = { x: 0, y: 0, scale: 1 }

    expect(isVisible({ minX: 10, minY: 10, maxX: 20, maxY: 20 }, view, viewport)).toBe(true)
    expect(isVisible({ minX: -50, minY: 0, maxX: -10, maxY: 20 }, view, viewport)).toBe(false)
    // Touching the edge counts as visible: a province half on screen must be drawn.
    expect(isVisible({ minX: -10, minY: 0, maxX: 5, maxY: 20 }, view, viewport)).toBe(true)
  })
})

describe('R-ARCH-06 Zwischenspeicher der Provinzflaechen', () => {
  it('behaelt den Schluessel beim Verschieben', () => {
    // Panning moves the cached picture; rebuilding it would throw away the one thing
    // worth caching (design D11).
    const a = cacheKey({ x: 0, y: 0, scale: 1 }, 'political', 7)
    const b = cacheKey({ x: 500, y: 300, scale: 1 }, 'political', 7)

    expect(a).toBe(b)
  })

  it('wechselt den Schluessel bei Modus, Zoom und Besitzwechsel', () => {
    const base = cacheKey({ x: 0, y: 0, scale: 1 }, 'political', 7)

    expect(cacheKey({ x: 0, y: 0, scale: 1 }, 'morale', 7)).not.toBe(base)
    expect(cacheKey({ x: 0, y: 0, scale: 2 }, 'political', 7)).not.toBe(base)
    expect(cacheKey({ x: 0, y: 0, scale: 1 }, 'political', 8)).not.toBe(base)
  })
})

describe('T-M19-02 Was ein Umriss kostet, wenn er kleiner als ein Bildpunkt ist', () => {
  const islet: [number, number][] = [
    [100, 100],
    [102, 100],
    [102, 102],
    [100, 102],
  ]
  const mainland: [number, number][] = [
    [0, 0],
    [500, 0],
    [500, 500],
    [0, 500],
  ]

  it('laesst eine Insel weg, die auf dem Schirm unter einen Bildpunkt faellt', () => {
    // Zoomed out to world scale, a two-unit island is barely a tenth of a pixel. The
    // path, the fill and the stroke cost the same as they do for Australia.
    expect(worthDrawing(islet, { x: 0, y: 0, scale: 20 })).toBe(false)
  })

  it('zeichnet dieselbe Insel, sobald man nah genug heran ist', () => {
    expect(worthDrawing(islet, { x: 0, y: 0, scale: 1 })).toBe(true)
  })

  it('laesst niemals eine Flaeche weg, die man sehen koennte', () => {
    // The one thing this filter must never do is drop the piece a province is drawn
    // from. A mainland stays at any zoom the map allows.
    for (const scale of [0.2, 1, 2.78, 4]) {
      expect(worthDrawing(mainland, { x: 0, y: 0, scale })).toBe(true)
    }
  })

  it('haelt einen langen schmalen Umriss, der nur in einer Richtung duenn ist', () => {
    // A fjord or a spit is one pixel wide and two hundred long — dropping it because
    // of its width would tear a hole in the coast.
    const spit: [number, number][] = [
      [0, 0],
      [200, 0],
      [200, 1],
      [0, 1],
    ]

    expect(worthDrawing(spit, { x: 0, y: 0, scale: 2.78 })).toBe(true)
  })

  const worldView = { x: 0, y: 0, scale: 2.78 }
  const screen = { width: 1440, height: 900 }

  it('spart auf der Weltkarte mehr als die Haelfte der Formen', () => {
    // The measurement the filter exists for, as a test: 2070 outlines in the data,
    // 901 worth drawing at world scale.
    const all = provinces.reduce((sum, province) => sum + province.polygons.length, 0)
    const shapes = prepareFrame(provinces, worldView, screen, 'political')

    expect(shapes.length).toBeLessThan(all / 2)
  })

  it('laesst dabei keine einzige Provinz verschwinden', () => {
    // The filter arriving from the other direction. Malta and Singapore are under a
    // pixel across at world scale, so every one of their outlines falls below the
    // threshold — and dropping them all would leave the player with a province they
    // own and cannot see. That is the fault of T-M19-02 all over again.
    const drawn = new Set(prepareFrame(provinces, worldView, screen, 'political').map((s) => s.id))
    const missing = provinces.filter((p) => !drawn.has(p.id)).map((p) => p.id)

    expect(missing, `auf der Weltkarte nicht gezeichnet: ${missing.join(', ')}`).toEqual([])
  })
})
