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

/**
 * The map carries the core's units: population as fixed-point thousands (the raw figure
 * is the number of people) and deposits as fixed-point production per tick — the same
 * scale the enrichment produces, so nothing is converted here.
 */
const PEOPLE_PER_MILLION = 1_000_000

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
      const millions = province.population / PEOPLE_PER_MILLION
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

describe('R-MAP-03 Oel kommt aus der kuratierten Tabelle', () => {
  const oilCsvText = readFileSync(`${ROOT}/data/mapgen/oil-regions.csv`, 'utf8')
  const oilRows = oilCsvText
    .trim()
    .split('\n')
    .slice(1)
    .map((line: string) => {
      const [id, tier, source] = line.split(',')
      return { id: id!, tier: Number(tier), source: source! }
    })

  it('hat genau 31 Zeilen mit gueltigem tier, Quelle und bekannter id', () => {
    expect(oilRows.length).toBe(31)
    const provinceIds = new Set(world.provinces.map((p) => p.id))
    for (const row of oilRows) {
      expect(provinceIds.has(row.id), `${row.id} unbekannt`).toBe(true)
      expect([1, 2, 3], row.id).toContain(row.tier)
      expect(row.source.length, row.id).toBeGreaterThan(0)
    }
  })

  it('hat in world.json genau und nur die CSV-Provinzen mit Oel > 0', () => {
    const oilIds = new Set(
      world.provinces.filter((p) => (p.deposits.oil ?? 0) > 0).map((p) => p.id),
    )
    expect(oilIds.size).toBe(oilRows.length)
    for (const row of oilRows) expect(oilIds.has(row.id), row.id).toBe(true)
  })

  it('gibt Oel-Foerderern Oel, Importeuren keins', () => {
    const oilSumByNation = new Map<string, number>()
    for (const start of world.startPositions) {
      const sum = start.provinces.reduce((s, id) => {
        const province = world.provinces.find((p) => p.id === id)
        return s + (province?.deposits.oil ?? 0)
      }, 0)
      oilSumByNation.set(start.nation, sum)
    }

    for (const nation of ['Vereinigte Staaten', 'Russland', 'Kanada', 'Iran']) {
      expect(oilSumByNation.get(nation) ?? 0, nation).toBeGreaterThan(0)
    }
    for (const nation of ['Japan', 'Deutschland']) {
      expect(oilSumByNation.get(nation) ?? 0, nation).toBe(0)
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
          population: p.population,
          deposits: { ...p.deposits },
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

describe('R-GAME-01 Jede Nation kann bauen', () => {
  it('gibt jeder Startnation Bauholz und Erz', () => {
    // Italy on the first world map had grain and coal and could never build a barracks
    // from its own production. A start like that is a lost game nobody was told about.
    for (const start of world.startPositions) {
      for (const resource of ['wood', 'iron']) {
        const total = start.provinces.reduce((sum, id) => {
          const province = world.provinces.find((p) => p.id === id)
          return sum + (province?.deposits[resource] ?? 0)
        }, 0)
        expect(total, `${start.nation} ohne ${resource}`).toBeGreaterThan(0)
      }
    }
  })

  it('traegt Vorkommen auf der Skala der Regeln, nicht tausendfach darueber', () => {
    // The rules were balanced on the test map, where a deposit is one to four units an
    // hour. A world province a thousand times richer makes every cost meaningless.
    for (const province of world.provinces) {
      for (const [key, value] of Object.entries(province.deposits)) {
        expect(value, `${province.id}: ${key} = ${value}`).toBeLessThan(40_000)
      }
    }
  })
})
