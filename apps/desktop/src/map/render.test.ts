import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { boundsOf } from './picking.ts'
import {
  battleIntensity,
  cacheKey,
  isVisible,
  marchArrow,
  marchProgress,
  marchStroke,
  ownershipChanges,
  prepareFrame,
  thin,
  worthDrawing,
  type RenderProvince,
} from './render.ts'
import { STRENGTH_FULL, colorForPlayer } from './modes.ts'
import { TOKENS } from '../ui/tokens.ts'

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

/**
 * Marschpfeile (T-M26-01, R-UI-16, D25.3).
 *
 * Die Sicht liefert je eigener Armee den Abmarschtick der ganzen Route und den
 * Ankunftstick der NAECHSTEN Etappe (publicView.ts, movement.ts setzt arrivalTick je
 * Etappe neu, departureTick nur beim Befehl). Der Fortschritt ist deshalb der Anteil
 * der laufenden Etappe — dieselbe Rechnung, mit der `marchPoint` seit T-M20-04 den
 * Marker setzt, damit Pfeilfuellung und Marker nie auseinanderlaufen.
 */
describe('T-M26-01 Marschpfeile mit Fortschritt', () => {
  const timing = { departureTick: 100, arrivalTick: 200 }

  it('bindet den Fortschritt an bekannte Ticks: 0 beim Abmarsch, halb in der Mitte, voll bei Ankunft', () => {
    expect(marchProgress(timing, 100)).toBe(0)
    expect(marchProgress(timing, 150)).toBe(0.5)
    expect(marchProgress(timing, 200)).toBe(1)
  })

  it('klemmt ausserhalb der Spanne, statt Orte zu erfinden', () => {
    expect(marchProgress(timing, 90)).toBe(0)
    expect(marchProgress(timing, 260)).toBe(1)
    // Ein Marsch ohne Dauer ist angekommen, nicht unterwegs — und niemand teilt durch null.
    expect(marchProgress({ departureTick: 5, arrivalTick: 5 }, 5)).toBe(1)
  })

  it('teilt die Route am Fortschrittspunkt in gefuellt und blass', () => {
    const arrow = marchArrow(
      [
        [0, 0],
        [100, 0],
        [100, 50],
      ],
      0.5,
    )!

    // Gefuellt: von der aktuellen Provinz bis zur Mitte der laufenden Etappe.
    expect(arrow.done).toEqual([
      [0, 0],
      [50, 0],
    ])
    // Blass: vom Fortschrittspunkt ueber alle restlichen Stationen bis zum Ziel.
    expect(arrow.ahead[0]).toEqual([50, 0])
    expect(arrow.ahead).toContainEqual([100, 0])
    expect(arrow.ahead[arrow.ahead.length - 1]).toEqual([100, 50])
  })

  it('setzt die Pfeilspitze ans Ziel, entlang des letzten Abschnitts', () => {
    const arrow = marchArrow(
      [
        [0, 0],
        [100, 0],
      ],
      0,
      8,
    )!

    // Die Spitze steht am Ziel, die beiden Flanken dahinter (gegen die Marschrichtung).
    expect(arrow.head[0]).toEqual([100, 0])
    expect(arrow.head).toHaveLength(3)
    for (const flank of arrow.head.slice(1)) expect(flank[0]).toBeCloseTo(92, 6)
  })

  it('liefert fuer eine Route ohne zweiten Punkt nichts', () => {
    expect(marchArrow([[0, 0]], 0.5)).toBeNull()
    expect(marchArrow([], 0)).toBeNull()
  })

  it('zeichnet eigene Maersche in Phosphorgruen, fremde in Spielerfarbe (D27.1)', () => {
    expect(marchStroke({ own: true, owner: 'p1' })).toBe(TOKENS.good)
    expect(marchStroke({ own: false, owner: 'p4' })).toBe(colorForPlayer('p4'))
  })
})

/**
 * Kampf und Eroberung auf der Karte (T-M26-02, R-UI-17, D25.4).
 *
 * Der Wechsel selbst wird als Differenz zweier Besitzstaende erkannt — eine reine
 * Funktion, damit "welche Provinz blendet gerade" nicht an einer Leinwand haengt.
 * Die Ringintensitaet skaliert mit der Gefechtsgroesse: ein Scharmuetzel atmet leise,
 * eine Feldschlacht ist vom anderen Ende der Karte zu sehen.
 */
describe('T-M26-02 Besitzwechsel und Gefechtsgroesse', () => {
  it('erkennt genau die Provinzen, deren Eigentuemer gewechselt hat', () => {
    const previous = { A: 'p1', B: 'p2', C: null }
    const current = [
      { id: 'A', owner: 'p2' },
      { id: 'B', owner: 'p2' },
      { id: 'C', owner: 'p1' },
    ]

    expect(ownershipChanges(previous, current)).toEqual([
      { id: 'A', from: 'p1', to: 'p2' },
      { id: 'C', from: null, to: 'p1' },
    ])
  })

  it('haelt ein erstes Bild nicht fuer eine Eroberung', () => {
    // Eine Provinz, die vorher gar nicht bekannt war, hat keinen alten Zustand, von
    // dem man blenden koennte — beim Partiestart wuerde sonst die halbe Welt wabern.
    expect(ownershipChanges({}, [{ id: 'A', owner: 'p1' }])).toEqual([])
  })

  it('skaliert die Ringintensitaet nach der Gefechtsgroesse', () => {
    expect(battleIntensity(0)).toBe(0)
    expect(battleIntensity(STRENGTH_FULL)).toBe(1)
    // Wurzel, nicht linear: ein kleines Gefecht bleibt sichtbar, statt im Rauschen
    // zu verschwinden — ein Viertel der vollen Staerke ist der halbe Ring.
    expect(battleIntensity(STRENGTH_FULL / 4)).toBeCloseTo(0.5, 9)
    expect(battleIntensity(STRENGTH_FULL * 3)).toBe(1)
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
