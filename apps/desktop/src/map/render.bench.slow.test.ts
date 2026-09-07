import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { boundsOf } from './picking.ts'
import { markersFor } from './markers.ts'
import { prepareFrame, type RenderProvince } from './render.ts'
import { labelsFor } from './labels.ts'

/**
 * The frame budget (T-M10-03b, R-ARCH-06/AK2).
 *
 * Measured on the real world map, not on a fixture: 237 provinces with a hundred
 * thousand points between them is the load the game actually has, and a budget met on
 * twelve squares says nothing about it.
 *
 * The requirement is 16.7 ms at the 95th percentile — one display frame. What is timed
 * here is the preparation, which is the part that scales with the map; the canvas
 * calls that follow are proportional to what survives it.
 *
 * Slow suite, and for a reason the project learned once already: measured next to
 * thirty other test files running in parallel, this reports the machine's load rather
 * than the code's cost — it failed at 18.6 ms under `pnpm verify` and passed at a
 * fraction of the budget on its own.
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
  strength: (index * 37) % 20_000,
  polygons: p.polygons,
  bounds: boundsOf(p.polygons),
}))

const viewport = { width: 1600, height: 900 }
const wholeWorld = { x: 0, y: 0, scale: world.width / viewport.width }

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
}

describe('R-ARCH-06 Bildratenbudget der Kartenansicht', () => {
  it('bereitet ein Bild der ganzen Welt in unter 16,7 ms vor', () => {
    // Warm-up, so the first run's compilation does not land in the measurement.
    for (let i = 0; i < 5; i++) prepareFrame(provinces, wholeWorld, viewport, 'political')

    const durations: number[] = []
    for (let frame = 0; frame < 60; frame++) {
      const started = performance.now()
      prepareFrame(provinces, wholeWorld, viewport, 'political')
      durations.push(performance.now() - started)
    }

    const p95 = percentile(durations, 0.95)
    expect(p95, `95. Perzentil ${p95.toFixed(2)} ms`).toBeLessThan(16.7)
  })

  it('haelt das Budget auch im teuersten Modus', () => {
    for (let i = 0; i < 5; i++) prepareFrame(provinces, wholeWorld, viewport, 'resources')

    const durations: number[] = []
    for (let frame = 0; frame < 60; frame++) {
      const started = performance.now()
      prepareFrame(provinces, wholeWorld, viewport, 'resources')
      durations.push(performance.now() - started)
    }

    const p95 = percentile(durations, 0.95)
    expect(p95, `95. Perzentil ${p95.toFixed(2)} ms`).toBeLessThan(16.7)
  })
})

/**
 * Die Beschriftung im selben Budget (T-M13-08, R-UI-12).
 *
 * Die Namen sitzen auf derselben teuren Ebene wie die Flaechen, also zaehlt ihre Zeit
 * zur selben Bildrate. Gemessen wird bei der Zoomstufe, bei der sie ueberhaupt
 * erscheinen — auf Weltansicht faellt die Funktion sofort heraus und misst nichts.
 */
describe('R-UI-12 Die Beschriftung passt ins Bildbudget', () => {
  const candidates = provinces.map((province) => ({
    id: province.id,
    name: `Provinz ${province.id}`,
    centre: {
      x: (province.bounds!.minX + province.bounds!.maxX) / 2,
      y: (province.bounds!.minY + province.bounds!.maxY) / 2,
    },
    bounds: province.bounds!,
  }))
  // Eine Textbreite, wie eine 11-px-Schrift sie liefert; die echte kommt aus dem Canvas.
  const measure = (text: string): number => text.length * 6
  const closeUp = { x: 0, y: 0, scale: 1 }

  it('stellt die Namen der ganzen Karte in unter 16,7 ms zusammen', () => {
    for (let i = 0; i < 5; i++) labelsFor(candidates, closeUp, viewport, measure)

    const durations: number[] = []
    for (let frame = 0; frame < 60; frame++) {
      const started = performance.now()
      labelsFor(candidates, closeUp, viewport, measure)
      durations.push(performance.now() - started)
    }

    const p95 = percentile(durations, 0.95)
    expect(p95, `95. Perzentil ${p95.toFixed(2)} ms`).toBeLessThan(16.7)
  })

  it('kostet auf Weltansicht gar nichts, weil dort keine Namen stehen', () => {
    expect(labelsFor(candidates, wholeWorld, viewport, measure)).toEqual([])
  })
})

/**
 * Was die Bewegung kostet (T-M20-04, R-ARCH-06/AK2).
 *
 * Seit T-M20-04 steht eine marschierende Armee zwischen den Provinzen statt in der Mitte,
 * und das ist eine Rechnung je Armee und Bild. Sie liegt auf der **billigen** Ebene — die
 * Flächen werden davon nicht neu gezeichnet —, aber „billig" ist eine Behauptung, bis sie
 * gemessen ist.
 *
 * Gemessen wird der Aufschlag **relativ**: derselbe Lauf mit und ohne Uhr, unmittelbar
 * nacheinander. Ein absoluter Wert wäre auf einer Maschine, die nebenher etwas anderes
 * tut, eine Aussage über die Maschine.
 */
describe('R-ARCH-06 Was die Bewegung der Armeen kostet', () => {
  const centres = Object.fromEntries(world.provinces.map((p, i) => [p.id, { x: i * 7, y: i * 3 }]))
  // Sechzig Armeen, die Hälfte unterwegs — mehr, als eine echte Partie in einer Provinz
  // je zusammenbringt.
  const armies = world.provinces.slice(0, 60).map((province, index) => ({
    id: `a${index}`,
    provinceId: province.id,
    owner: 'p1',
    strength: 1000,
    own: true,
    ...(index % 2 === 0
      ? {
          march: {
            toProvinceId: world.provinces[(index + 7) % world.provinces.length]!.id,
            departureTick: 0,
            arrivalTick: 100,
          },
        }
      : {}),
  }))
  const buildings = Object.fromEntries(world.provinces.slice(0, 80).map((p) => [p.id, 2]))
  const view = { x: 0, y: 0, scale: 2.78 }

  const messe = (tick?: number): number => {
    const extras = { battleProvinces: [], ...(tick === undefined ? {} : { tick }) }
    for (let i = 0; i < 20; i++) markersFor(armies, buildings, centres, view, extras)

    const durations: number[] = []
    for (let frame = 0; frame < 300; frame++) {
      const started = performance.now()
      markersFor(armies, buildings, centres, view, extras)
      durations.push(performance.now() - started)
    }
    return percentile(durations, 0.95)
  }

  it('bleibt mit Bewegung im selben Budget wie ohne', () => {
    const ohne = messe()
    const mit = messe(50)

    // Beide weit unter dem Bild — die Markerebene ist nicht die teure.
    expect(mit, `mit Bewegung ${mit.toFixed(3)} ms`).toBeLessThan(16.7)
    // Und der Aufschlag bleibt in derselben Größenordnung: eine Interpolation je Armee
    // ist zwei Multiplikationen, keine neue Ebene.
    expect(mit, `ohne ${ohne.toFixed(3)} ms, mit ${mit.toFixed(3)} ms`).toBeLessThan(Math.max(ohne * 4, 1))
  })

  it('haelt das Bildbudget mit Flaechen und Bewegung zusammen', () => {
    const provincesForFrame = provinces
    for (let i = 0; i < 10; i++) {
      prepareFrame(provincesForFrame, view, viewport, 'political')
      markersFor(armies, buildings, centres, view, { battleProvinces: [], tick: 50 })
    }

    const durations: number[] = []
    for (let frame = 0; frame < 120; frame++) {
      const started = performance.now()
      prepareFrame(provincesForFrame, view, viewport, 'political')
      markersFor(armies, buildings, centres, view, { battleProvinces: [], tick: 50 })
      durations.push(performance.now() - started)
    }

    const p95 = percentile(durations, 0.95)
    expect(p95, `95. Perzentil ${p95.toFixed(2)} ms`).toBeLessThan(16.7)
  })
})
