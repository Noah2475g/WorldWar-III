import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { boundsOf } from './picking.ts'
import { cacheKey, isVisible, prepareFrame, thin, type RenderProvince } from './render.ts'

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
    polygon: [number, number][]
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
  polygon: p.polygon,
  bounds: boundsOf(p.polygon),
}))

const viewport = { width: 1600, height: 900 }
const wholeWorld = { x: 0, y: 0, scale: world.width / viewport.width }

describe('R-ARCH-06 Was das Budget traegt', () => {
  it('verwirft heruntergezoomt fast alles vor dem Zeichnen', () => {
    // Zoomed into Europe, most of the world is off screen and must never reach the
    // canvas — that is where the budget is won.
    const zoomed = { x: world.width * 0.48, y: world.height * 0.2, scale: 0.25 }

    const shapes = prepareFrame(provinces, zoomed, viewport, 'political')

    expect(shapes.length).toBeLessThan(provinces.length / 3)
    expect(shapes.length).toBeGreaterThan(0)
  })

  it('duennt Stuetzpunkte mit der Zoomstufe aus', () => {
    const biggest = provinces.reduce((a, b) => (a.polygon.length >= b.polygon.length ? a : b))

    const far = thin(biggest.polygon, wholeWorld)
    const near = thin(biggest.polygon, { x: 0, y: 0, scale: 0.1 })

    expect(far.length).toBeLessThan(biggest.polygon.length)
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
