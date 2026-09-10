import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { boundsOf } from './picking.ts'
import { markersFor } from './markers.ts'
import { anchorsFor } from './anchors.ts'
import { marchArrow, marchProgress, prepareFrame, type RenderProvince } from './render.ts'
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
    center: { x: number; y: number }
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
 * Die lebende Karte im selben Budget (T-M26-01, R-UI-16, R-ARCH-06/AK2).
 *
 * Seit T-M26-01 zeichnet jede sichtbare marschierende Armee ihre Route als Pfeil mit
 * Fortschritt — eine Geometrierechnung je Armee und Bild, auf der billigen Ebene. Der
 * Lauf misst Flaechen plus sechzig Pfeile zusammen und **schreibt die Zahl in den
 * Bericht** (`docs/reports/render-bench.json`, Feld `nodeRemeasurements`): die DoD von
 * T-M26-01 verlangt, dass die Zahl dort begruendet steht, nicht nur dass sie stimmt.
 * Die Browser-Messung vom 2026-09-07 bleibt unangetastet — was hier steht, ist der
 * Anteil des Codes, unter Node gemessen, und sagt das auch.
 */
describe('T-M26-01 Marschpfeile im Bildbudget', () => {
  it('haelt das Budget mit Flaechen und sechzig Pfeilen und schreibt die Zahl in den Bericht', () => {
    // Sechzig Maersche mit je vier Stationen — mehr, als eine echte Partie sichtbar macht.
    const arrows = Array.from({ length: 60 }, (_, index) => ({
      points: Array.from({ length: 4 }, (_, station) => [
        (index * 53 + station * 211) % 1600,
        (index * 31 + station * 137) % 900,
      ]) as [number, number][],
      timing: { departureTick: index, arrivalTick: index + 40 },
    }))
    const view = { x: 0, y: 0, scale: 2.78 }

    const einBild = (tick: number): void => {
      prepareFrame(provinces, view, viewport, 'political')
      for (const arrow of arrows) marchArrow(arrow.points, marchProgress(arrow.timing, tick))
    }

    for (let i = 0; i < 10; i++) einBild(i)
    const durations: number[] = []
    for (let frame = 0; frame < 120; frame++) {
      const started = performance.now()
      einBild(frame)
      durations.push(performance.now() - started)
    }

    const p95 = percentile(durations, 0.95)
    expect(p95, `95. Perzentil ${p95.toFixed(2)} ms`).toBeLessThan(16.7)

    // Die Zahl gehoert in den Bericht — zusaetzlich zur Browser-Messung, nicht statt ihr.
    const reportPath = `${ROOT}/docs/reports/render-bench.json`
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as Record<string, unknown>
    report.nodeRemeasurements = {
      task: 'T-M26-01',
      how: 'Unter Node (render.bench.slow.test.ts): prepareFrame der ganzen Welt plus 60 Marschpfeile je Bild, 10 Bilder Einlauf, 120 gemessen. Misst den Anteil des Codes, nicht den des Browsers.',
      // Ortszeit, nicht UTC: kurz nach Mitternacht wandert toISOString sonst auf gestern.
      measuredAt: [
        String(new Date().getFullYear()),
        String(new Date().getMonth() + 1).padStart(2, '0'),
        String(new Date().getDate()).padStart(2, '0'),
      ].join('-'),
      p95Ms: Number(p95.toFixed(2)),
      medianMs: Number(percentile(durations, 0.5).toFixed(2)),
      maxMs: Number(Math.max(...durations).toFixed(2)),
      frameBudgetMs: 16.7,
    }
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  })
})

/**
 * Die Stapel im Bildbudget (T-M30-01, KRIEGSRAT §6.1).
 *
 * Je Bild: die Flaechen der ganzen Welt plus `markersFor` fuer 300 Armeen mit Zahl und
 * Zustand (8 Maechte, mehr als eine Partie je zeigt) und Gebaeude in jeder Provinz.
 * Was hier NICHT gemessen wird, sagt der Bericht auch: das Stempeln auf die Leinwand
 * laeuft nur im Browser — dort ist es je Stapel ein `drawImage` statt eines
 * `Path2D`-Zugs, also billiger als vorher, nicht teurer.
 */
describe('T-M30-01 Stapel mit Zahl und Zustand im Bildbudget', () => {
  it('haelt das Budget mit Flaechen und 300 Stapeln und schreibt die Zahl in den Bericht', () => {
    const ids = world.provinces.map((p) => p.id)
    const centres = Object.fromEntries(
      world.provinces.map((p) => [p.id, { x: p.polygons[0]![0]![0], y: p.polygons[0]![0]![1] }]),
    )
    const armies = Array.from({ length: 300 }, (_, index) => ({
      id: `a${index}`,
      provinceId: ids[(index * 7) % ids.length]!,
      owner: `p${(index % 8) + 1}`,
      strength: 5000 + (index % 9) * 1000,
      own: index % 8 === 0,
      count: 1 + (index % 12),
      condition: 0.3 + (index % 7) / 10,
      relation: (['war', 'peace', 'alliance', 'truce'] as const)[index % 4]!,
    }))
    // Jede Provinz traegt Gebaeude (bis zu sieben) — mehr, als eine Partie je hat —
    // und die Anker kommen einmal je Karte (T-M30-02), nicht je Bild.
    const kinds = ['barracks', 'fortress', 'factory', 'harbour', 'shipyard', 'airfield', 'railway']
    const buildings = Object.fromEntries(
      ids.map((id, index) => [id, Object.fromEntries(kinds.slice(0, 1 + (index % 7)).map((k, i) => [k, 1 + ((index + i) % 3)]))]),
    )
    const anchors = Object.fromEntries(world.provinces.map((p) => [p.id, anchorsFor(p.polygons, p.center)]))
    // Mittlere Stufe (scale 1): erst hier erscheinen die Gebaeude ueberhaupt (D27.4).
    const view = { x: 1200, y: 400, scale: 1 }

    const einBild = (): void => {
      prepareFrame(provinces, view, viewport, 'political')
      markersFor(armies, buildings, centres, view, {
        capitalProvinceId: ids[0]!,
        battleProvinces: ids.slice(0, 10),
        anchors,
      })
    }

    for (let i = 0; i < 10; i++) einBild()
    const durations: number[] = []
    for (let frame = 0; frame < 120; frame++) {
      const started = performance.now()
      einBild()
      durations.push(performance.now() - started)
    }

    const p95 = percentile(durations, 0.95)
    expect(p95, `95. Perzentil ${p95.toFixed(2)} ms`).toBeLessThan(16.7)

    const reportPath = `${ROOT}/docs/reports/render-bench.json`
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as Record<string, unknown>
    report.stacks = {
      task: 'T-M30-01',
      how: 'Unter Node (render.bench.slow.test.ts): prepareFrame bei mittlerer Stufe (scale 1) plus markersFor fuer 300 Stapel mit Zahl und Zustand und bis zu sieben Gebaeude an Ankern in jeder der 237 Provinzen, 10 Bilder Einlauf, 120 gemessen.',
      measuredAt: [
        String(new Date().getFullYear()),
        String(new Date().getMonth() + 1).padStart(2, '0'),
        String(new Date().getDate()).padStart(2, '0'),
      ].join('-'),
      armies: armies.length,
      buildings: Object.values(buildings).reduce((sum, b) => sum + Object.keys(b).length, 0),
      p95Ms: Number(p95.toFixed(2)),
      medianMs: Number(percentile(durations, 0.5).toFixed(2)),
      maxMs: Number(Math.max(...durations).toFixed(2)),
      frameBudgetMs: 16.7,
    }
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
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
  const buildings = Object.fromEntries(world.provinces.slice(0, 80).map((p) => [p.id, { barracks: 1, factory: 1 }]))
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
