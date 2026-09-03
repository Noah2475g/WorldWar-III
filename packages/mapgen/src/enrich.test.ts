import { describe, expect, it } from 'vitest'
import {
  densityFactor,
  depositsFor,
  ensureStartingBasics,
  enrich,
  scalePopulation,
  startingValue,
  terrainFor,
  type EnrichedProvince,
  type RawProvince,
} from './enrich.ts'

/**
 * What a province is worth (T-M9-03, R-MAP-03/R-GAME-01).
 *
 * The deposits are invented — Natural Earth knows nothing about coal — but they must
 * be invented the same way every time, or the world map changes under the player
 * between two builds and no balance test means anything.
 */

const province = (over: Partial<RawProvince> = {}): RawProvince => ({
  id: 'X1',
  country: 'XXX',
  areaKm2: 200_000,
  centre: { lon: 0, lat: 45 },
  coastal: false,
  ...over,
})

const roller = (values: number[]): (() => number) => {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('R-MAP-03 Gelaende folgt der Lage', () => {
  it('legt Wuesten in den Wuestenguertel', () => {
    expect(terrainFor(province({ centre: { lon: 10, lat: 25 } }), 0.1)).toBe('desert')
    expect(terrainFor(province({ centre: { lon: 10, lat: -25 } }), 0.1)).toBe('desert')
  })

  it('legt keine Wueste in gemaessigte Breiten', () => {
    expect(terrainFor(province({ centre: { lon: 10, lat: 52 } }), 0.1)).not.toBe('desert')
  })

  it('legt Waelder in den Norden', () => {
    expect(terrainFor(province({ centre: { lon: 10, lat: 60 } }), 0.2)).toBe('forest')
  })

  it('gibt bei gleichem Wurf immer dasselbe Gelaende', () => {
    const p = province()
    expect(terrainFor(p, 0.5)).toBe(terrainFor(p, 0.5))
  })
})

describe('R-MAP-03 Bevoelkerungsdichte', () => {
  it('siedelt den hohen Norden duenn', () => {
    const arctic = densityFactor(province({ centre: { lon: 90, lat: 68 } }), 'plains')
    const temperate = densityFactor(province({ centre: { lon: 10, lat: 45 } }), 'plains')

    expect(arctic).toBeLessThan(temperate * 0.4)
  })

  it('siedelt Wueste und Gebirge duenner als Ebene', () => {
    const at = (terrain: 'plains' | 'desert' | 'mountain') =>
      densityFactor(province({ centre: { lon: 10, lat: 30 } }), terrain)

    expect(at('desert')).toBeLessThan(at('plains'))
    expect(at('mountain')).toBeLessThan(at('plains'))
  })

  it('siedelt an der Kueste dichter', () => {
    const coast = densityFactor(province({ coastal: true }), 'plains')
    const inland = densityFactor(province({ coastal: false }), 'plains')

    expect(coast).toBeGreaterThan(inland)
  })
})

describe('R-MAP-03 Vorkommen', () => {
  it('gibt jeder Provinz etwas zu essen', () => {
    // A province that feeds nobody is a province nobody would ever take.
    for (const terrain of ['plains', 'forest', 'mountain', 'desert', 'urban'] as const) {
      const deposits = depositsFor(province(), terrain, roller([0.5]))
      expect(deposits.food, `${terrain} ohne Nahrung`).toBeGreaterThan(0)
    }
  })

  it('legt Erz ins Gebirge und Oel in die Wueste', () => {
    expect(depositsFor(province(), 'mountain', roller([0.5])).iron).toBeGreaterThan(0)
    expect(depositsFor(province(), 'desert', roller([0.5])).oil).toBeGreaterThan(0)
    expect(depositsFor(province(), 'forest', roller([0.5])).wood).toBeGreaterThan(0)
  })

  it('gibt einer grossen Provinz mehr als einer kleinen', () => {
    const big = depositsFor(province({ areaKm2: 2_000_000 }), 'plains', roller([0.5]))
    const small = depositsFor(province({ areaKm2: 20_000 }), 'plains', roller([0.5]))

    expect(big.food!).toBeGreaterThan(small.food!)
  })

  it('deckelt den Groessenvorteil', () => {
    // Siberia is thirty times the size of Bavaria; without a cap it would carry thirty
    // times the ore and decide the game on its own.
    const huge = depositsFor(province({ areaKm2: 20_000_000 }), 'plains', roller([0.5]))
    const large = depositsFor(province({ areaKm2: 2_000_000 }), 'plains', roller([0.5]))

    expect(huge.food!).toBeLessThan(large.food! * 1.5)
  })
})

describe('R-MAP-03 Anreicherung der ganzen Karte', () => {
  const provinces: RawProvince[] = [
    province({ id: 'A1', country: 'AAA', areaKm2: 300_000, centre: { lon: 10, lat: 50 } }),
    province({ id: 'A2', country: 'AAA', areaKm2: 100_000, centre: { lon: 12, lat: 70 } }),
    province({ id: 'B1', country: 'BBB', areaKm2: 200_000, centre: { lon: 30, lat: 25 } }),
  ]
  const options = {
    populationByCountry: { AAA: 40_000_000, BBB: 20_000_000 },
    resourceWeights: { food: 1000, wood: 900, iron: 1200, coal: 1000, oil: 1400, rare: 1600, money: 800 },
  }

  it('verteilt die Bevoelkerung eines Landes ohne Rest', () => {
    // The totals are on the compressed scale, so they do not add up to the census
    // figure — what must hold is that nobody is dropped: every province of a populated
    // country has people, and they are in proportion.
    const result = enrich(provinces, options)
    const inA = result.filter((p) => p.id.startsWith('A'))

    for (const province of inA) expect(province.population, province.id).toBeGreaterThan(0)
    expect(inA.reduce((s, p) => s + p.population, 0)).toBeGreaterThan(0)
  })

  it('staucht grosse Bevoelkerungen, ohne die Reihenfolge zu drehen', () => {
    // China against Poland is 37 to 1 in reality. Carried straight into the formula
    // that is a decided game before the first move, so the map keeps the ordering and
    // gives up the ratio.
    expect(scalePopulation(1_400_000_000)).toBeGreaterThan(scalePopulation(38_000_000))
    expect(scalePopulation(1_400_000_000) / scalePopulation(38_000_000)).toBeLessThan(8)
    // A province of a million stays a province of a million.
    expect(scalePopulation(1_000_000)).toBe(1_000_000)
    expect(scalePopulation(0)).toBe(0)
  })

  it('siedelt die arktische Provinz duenner als die gemaessigte', () => {
    const result = enrich(provinces, options)
    const a1 = result.find((p) => p.id === 'A1')!
    const a2 = result.find((p) => p.id === 'A2')!

    // A2 is a third of A1's size and far north, so it must come out thinner. The gap is
    // smaller than the raw figures suggest because the scale is compressed — that is
    // the point of the compression, not a fault in the density rule.
    expect(a2.population).toBeLessThan(a1.population * 0.7)
  })

  it('liefert bei jedem Lauf dasselbe Ergebnis', () => {
    // The map is checked in. A build that reshuffles deposits makes every balance
    // measurement meaningless and every diff unreadable.
    expect(JSON.stringify(enrich(provinces, options))).toBe(
      JSON.stringify(enrich([...provinces].reverse(), options)),
    )
  })

  it('macht aus einer sehr bevoelkerten Provinz eine Stadt', () => {
    const dense = enrich([province({ id: 'C1', country: 'CCC', areaKm2: 50_000 })], {
      ...options,
      populationByCountry: { CCC: 200_000_000 },
    })

    expect(dense[0]?.kind).toBe('city')
    expect(dense[0]?.terrain).toBe('urban')
  })

  it('laesst eine duenn besiedelte Provinz laendlich', () => {
    const sparse = enrich([province({ id: 'D1', country: 'DDD', areaKm2: 500_000 })], {
      ...options,
      populationByCountry: { DDD: 900_000 },
    })

    expect(sparse[0]?.kind).toBe('rural')
    expect(sparse[0]?.terrain).not.toBe('urban')
  })
})

describe('R-GAME-01 Startwert einer Nation', () => {
  it('waechst mit Provinzen, Vorkommen und Bevoelkerung', () => {
    const weights = { food: 1000 }
    const one = startingValue([{ id: 'A', terrain: 'plains', kind: 'rural', population: 1_000_000, deposits: { food: 100 } }], weights)
    const two = startingValue(
      [
        { id: 'A', terrain: 'plains', kind: 'rural', population: 1_000_000, deposits: { food: 100 } },
        { id: 'B', terrain: 'plains', kind: 'rural', population: 1_000_000, deposits: { food: 100 } },
      ],
      weights,
    )

    expect(two).toBeGreaterThan(one)
  })

  it('gewichtet seltene Rohstoffe hoeher als Nahrung', () => {
    const weights = { food: 1000, rare: 1600 }
    const bread = startingValue([{ id: 'A', terrain: 'plains', kind: 'rural', population: 0, deposits: { food: 100 } }], weights)
    const ore = startingValue([{ id: 'A', terrain: 'plains', kind: 'rural', population: 0, deposits: { rare: 100 } }], weights)

    expect(ore).toBeGreaterThan(bread)
  })
})

describe('R-GAME-01 Keine Startnation ohne Bauholz und Erz', () => {
  const plains = (id: string): EnrichedProvince => ({
    id,
    terrain: 'plains',
    kind: 'rural',
    population: 1_000_000,
    deposits: { food: 2000, coal: 900 },
  })
  const forest = (id: string): EnrichedProvince => ({
    id,
    terrain: 'forest',
    kind: 'rural',
    population: 800_000,
    deposits: { food: 1200, wood: 2400, iron: 700 },
  })

  it('gibt einer Nation aus lauter Ebenen Holz und Erz in der Hauptstadt', () => {
    // Italy on the first world map: grain and coal, nothing to build with.
    const result = ensureStartingBasics(
      [plains('I1'), plains('I2'), forest('N1'), forest('N2')],
      [{ nation: 'Italien', provinces: ['I1', 'I2'] }],
    )
    const capital = result.find((p) => p.id === 'I1')!
    const other = result.find((p) => p.id === 'I2')!

    expect(capital.deposits.wood).toBeGreaterThan(0)
    expect(capital.deposits.iron).toBeGreaterThan(0)
    expect(other.deposits.wood).toBeUndefined()
  })

  it('laesst eine Nation in Ruhe, die schon alles hat', () => {
    const before = [forest('N1'), plains('N2')]
    const result = ensureStartingBasics(before, [{ nation: 'Nordland', provinces: ['N1', 'N2'] }])

    expect(result.map((p) => p.deposits)).toEqual(before.map((p) => p.deposits))
  })

  it('bemisst das Vorkommen wie ein typisches der Karte, nicht wie das reichste', () => {
    const rich: EnrichedProvince = { ...forest('R1'), deposits: { food: 1000, wood: 9000, iron: 5000 } }
    const result = ensureStartingBasics(
      [plains('I1'), forest('N1'), rich],
      [{ nation: 'Italien', provinces: ['I1'] }],
    )

    expect(result.find((p) => p.id === 'I1')!.deposits.wood).toBe(2400)
  })

  it('laesst neutrales Land, wie das Gelaende es gemacht hat', () => {
    const result = ensureStartingBasics([plains('X1'), forest('N1')], [{ nation: 'Nordland', provinces: ['N1'] }])

    expect(result.find((p) => p.id === 'X1')!.deposits.wood).toBeUndefined()
  })
})
