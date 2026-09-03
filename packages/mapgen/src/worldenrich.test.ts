import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { startingValue, type EnrichedProvince } from './enrich.ts'

/**
 * The enriched world map (T-M9-03, R-MAP-03/R-GAME-01).
 *
 * Corridors rather than exact figures: the deposits are generated, so pinning them to
 * the digit would make every balance change a test failure. What must hold is the
 * shape of the world — that it is not two thirds desert, that most provinces are not
 * cities, and above all that no power starts the game already beaten.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const world = JSON.parse(readFileSync(`${ROOT}/data/maps/world.json`, 'utf8')) as {
  provinces: {
    id: string
    terrain: string
    kind: string
    population: number
    deposits: Record<string, number>
  }[]
  startPositions: { nation: string; provinces: string[] }[]
}
const rules = JSON.parse(readFileSync(`${ROOT}/data/mapgen/merge-rules.json`, 'utf8')) as {
  targets: {
    terrainShare: Record<string, [number, number]>
    cityShare: [number, number]
    populationPerProvinceMio: [number, number]
    startValueDeviation: number
  }
}
const ai = JSON.parse(readFileSync(`${ROOT}/data/rules/default/ai.json`, 'utf8')) as {
  resourceWeights: Record<string, number>
}

/** The core stores every quantity as fixed-point with three decimals. */
const FIXED = 1000

describe('R-MAP-03 Verteilungen liegen im Zielkorridor', () => {
  it('haelt jede Gelaendeart in ihrem Anteil', () => {
    const counts = new Map<string, number>()
    for (const province of world.provinces) {
      counts.set(province.terrain, (counts.get(province.terrain) ?? 0) + 1)
    }

    for (const [terrain, [low, high]] of Object.entries(rules.targets.terrainShare)) {
      const share = (counts.get(terrain) ?? 0) / world.provinces.length
      expect(share, `${terrain}: ${(share * 100).toFixed(0)} %`).toBeGreaterThanOrEqual(low)
      expect(share, `${terrain}: ${(share * 100).toFixed(0)} %`).toBeLessThanOrEqual(high)
    }
  })

  it('haelt den Anteil der Staedte im Korridor', () => {
    const cities = world.provinces.filter((p) => p.kind === 'city').length
    const share = cities / world.provinces.length
    const [low, high] = rules.targets.cityShare

    expect(share, `${(share * 100).toFixed(0)} % Staedte`).toBeGreaterThanOrEqual(low)
    expect(share, `${(share * 100).toFixed(0)} % Staedte`).toBeLessThanOrEqual(high)
  })

  it('haelt jede Provinzbevoelkerung im Korridor', () => {
    const [low, high] = rules.targets.populationPerProvinceMio
    for (const province of world.provinces) {
      const millions = province.population / FIXED / 1_000_000
      expect(millions, `${province.id}: ${millions.toFixed(2)} Mio`).toBeGreaterThanOrEqual(low)
      expect(millions, `${province.id}: ${millions.toFixed(2)} Mio`).toBeLessThanOrEqual(high)
    }
  })

  it('gibt jeder Provinz etwas zu essen', () => {
    for (const province of world.provinces) {
      expect(province.deposits.food, `${province.id} ohne Nahrung`).toBeGreaterThan(0)
    }
  })

  it('legt keine Vorkommen an, die keine Ressource sind', () => {
    const known = new Set(['food', 'wood', 'iron', 'coal', 'oil', 'rare', 'money'])
    for (const province of world.provinces) {
      for (const key of Object.keys(province.deposits)) {
        expect(known.has(key), `${province.id}: unbekannte Ressource ${key}`).toBe(true)
      }
    }
  })
})

describe('R-GAME-01 Keine Nation beginnt geschlagen', () => {
  it('haelt jeden Startwert innerhalb der erlaubten Abweichung vom Median', () => {
    const byId = new Map(
      world.provinces.map((p) => [
        p.id,
        {
          id: p.id,
          terrain: p.terrain,
          kind: p.kind,
          population: p.population / FIXED,
          deposits: Object.fromEntries(
            Object.entries(p.deposits).map(([key, value]) => [key, value / FIXED]),
          ),
        } as EnrichedProvince,
      ]),
    )

    const values = world.startPositions.map((start) => ({
      nation: start.nation,
      value: startingValue(
        start.provinces.map((id) => byId.get(id)).filter((p): p is EnrichedProvince => !!p),
        ai.resourceWeights,
      ),
    }))

    const sorted = [...values].map((v) => v.value).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]!
    const limit = rules.targets.startValueDeviation

    for (const { nation, value } of values) {
      const deviation = Math.abs(value - median) / median
      expect(
        deviation,
        `${nation}: ${(deviation * 100).toFixed(0)} % vom Median (Grenze ${limit * 100} %)`,
      ).toBeLessThanOrEqual(limit)
    }
  })

  it('gibt jeder Nation Vorkommen, die sie ernaehren koennen', () => {
    for (const start of world.startPositions) {
      const food = start.provinces.reduce((sum, id) => {
        const province = world.provinces.find((p) => p.id === id)
        return sum + (province?.deposits.food ?? 0)
      }, 0)
      expect(food, `${start.nation} ohne Nahrungsvorkommen`).toBeGreaterThan(0)
    }
  })
})
