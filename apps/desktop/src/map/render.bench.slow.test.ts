import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { boundsOf } from './picking.ts'
import { prepareFrame, type RenderProvince } from './render.ts'

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
