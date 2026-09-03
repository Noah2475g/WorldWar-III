/**
 * Filling the map with what a province is worth (T-M9-03, R-MAP-03/R-GAME-01).
 *
 * Three things are decided here: how many people live in a province, what the ground
 * is like, and what can be dug out of it. The first two follow from the real world as
 * far as the data allows; the third is invented, because Natural Earth knows nothing
 * about coal and a strategy map needs deposits that make provinces worth fighting over.
 *
 * Invented, but not arbitrary — and above all not random at load time. Every value is
 * derived from the province id through a seeded generator, so the world map is the
 * same world every time it is built, and a balance change is visible in the diff.
 */

export type Terrain = 'plains' | 'forest' | 'mountain' | 'desert' | 'urban'
export type ResourceKey = 'food' | 'wood' | 'iron' | 'coal' | 'oil' | 'rare' | 'money'

export interface RawProvince {
  id: string
  country: string
  areaKm2: number
  centre: { lon: number; lat: number }
  coastal: boolean
}

export interface EnrichedProvince {
  id: string
  terrain: Terrain
  kind: 'city' | 'rural'
  /** People, in whole numbers. */
  population: number
  deposits: Partial<Record<ResourceKey, number>>
}

export interface EnrichOptions {
  /** Population per country, split across its provinces. */
  populationByCountry: Readonly<Record<string, number>>
  /** Weight per resource, from the rules — used for the balance figure. */
  resourceWeights: Readonly<Record<string, number>>
}

/**
 * Real population, compressed onto a scale a game can use.
 *
 * China has 37 times the people of Poland. Carried straight into the map that is not a
 * difficulty setting, it is a decided game: the starting-value formula counts
 * population directly, and no amount of ore on Polish soil would close a gap of that
 * size. So province population becomes a game quantity rather than a census — the
 * ordering is kept, the ratios are not.
 *
 * A power curve, anchored so that a province of a million people stays a province of
 * about a million: the numbers on screen still read as populations.
 *
 * The exponent was measured, not guessed. At 0.5 the largest powers still started
 * three hundred per cent above the median, at 0.4 still two hundred and thirty-eight —
 * the population term alone put China past the limit before a single deposit was
 * counted. 0.3 is the mildest compression that brings every power inside the required
 * fifteen per cent, so it keeps as much of the real difference as the balance allows.
 */
const POPULATION_EXPONENT = 0.3
const POPULATION_ANCHOR = 1_000_000

export function scalePopulation(real: number): number {
  if (real <= 0) return 0
  return Math.round(POPULATION_ANCHOR * (real / POPULATION_ANCHOR) ** POPULATION_EXPONENT)
}

/** Population from which a province counts as a city, on the compressed scale. */
export const CITY_THRESHOLD = 2_400_000
/** From here the province is built up enough that the ground under it stops mattering. */
export const URBAN_THRESHOLD = 3_400_000

/**
 * A small deterministic generator. The seed is the province id, so a province always
 * gets the same ground and the same ore however often the map is rebuilt, and two
 * provinces next to each other in the file do not get correlated values.
 */
function seededRandom(seed: string): () => number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  let state = hash >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/**
 * Ground follows latitude, because that is what the raw data actually knows.
 *
 * Not a climate model — a legible rule. The band between 15 and 32 degrees holds the
 * world's deserts, above 55 the forests, and mountains are placed by the generator
 * rather than by elevation data the map does not carry.
 */
export function terrainFor(province: RawProvince, roll: number): Terrain {
  const lat = Math.abs(province.centre.lat)

  if (lat >= 15 && lat <= 32 && roll < 0.55) return 'desert'
  if (lat >= 45 && roll < 0.45) return 'forest'
  if (roll > 0.86) return 'mountain'
  if (roll > 0.72) return 'forest'
  return 'plains'
}

/**
 * How thickly a province is settled, relative to its country's average.
 *
 * Splitting a country's people evenly by area would put a third of Russia's population
 * in Siberia. Cold and desert ground carries fewer people; a coast carries more,
 * because that is where the cities are.
 */
export function densityFactor(province: RawProvince, terrain: Terrain): number {
  const lat = Math.abs(province.centre.lat)

  let factor = 1
  if (lat > 60) factor *= 0.25
  else if (lat > 50) factor *= 0.7
  if (terrain === 'desert') factor *= 0.35
  else if (terrain === 'mountain') factor *= 0.6
  if (province.coastal) factor *= 1.4

  return factor
}

export function enrich(
  provinces: readonly RawProvince[],
  options: EnrichOptions,
): EnrichedProvince[] {
  const byCountry = new Map<string, RawProvince[]>()
  for (const province of provinces) {
    const list = byCountry.get(province.country) ?? []
    list.push(province)
    byCountry.set(province.country, list)
  }

  const terrainOf = new Map<string, Terrain>()
  const rolls = new Map<string, () => number>()
  for (const province of provinces) {
    const random = seededRandom(province.id)
    rolls.set(province.id, random)
    terrainOf.set(province.id, terrainFor(province, random()))
  }

  const populationOf = new Map<string, number>()
  for (const [country, own] of byCountry) {
    const total = options.populationByCountry[country] ?? 0
    const weights = own.map(
      (province) => Math.max(1, province.areaKm2) * densityFactor(province, terrainOf.get(province.id)!),
    )
    const sum = weights.reduce((a, b) => a + b, 0) || 1
    own.forEach((province, index) => {
      populationOf.set(province.id, scalePopulation((total * weights[index]!) / sum))
    })
  }

  return provinces
    .map((province) => {
      const terrain = terrainOf.get(province.id)!
      const population = populationOf.get(province.id) ?? 0
      const random = rolls.get(province.id)!

      return {
        id: province.id,
        // Thresholds are on the compressed scale, where a province of ten million is
        // among the largest in the world rather than merely large.
        terrain: population > URBAN_THRESHOLD ? ('urban' as const) : terrain,
        // A city province is where the people are, not where the land is.
        kind: population > CITY_THRESHOLD ? ('city' as const) : ('rural' as const),
        population,
        deposits: depositsFor(province, terrain, random),
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id, 'en'))
}

/**
 * What can be dug out of a province.
 *
 * Terrain decides what is plausible — grain on plains, timber in forests, ore in
 * mountains, oil in deserts — and the generator decides how much. Every province
 * carries at least food, because a province that cannot feed anybody is a province
 * nobody would ever take.
 */
export function depositsFor(
  province: RawProvince,
  terrain: Terrain,
  random: () => number,
): Partial<Record<ResourceKey, number>> {
  const scale = Math.min(3, Math.max(0.4, Math.sqrt(Math.max(1, province.areaKm2) / 200_000)))
  const amount = (base: number): number => Math.round(base * scale * (0.6 + random() * 0.8))

  const deposits: Partial<Record<ResourceKey, number>> = { food: amount(1200) }

  switch (terrain) {
    case 'plains':
      deposits.food = amount(2200)
      if (random() < 0.5) deposits.coal = amount(900)
      break
    case 'forest':
      deposits.wood = amount(2400)
      if (random() < 0.4) deposits.iron = amount(800)
      break
    case 'mountain':
      deposits.iron = amount(2000)
      deposits.coal = amount(1600)
      if (random() < 0.35) deposits.rare = amount(500)
      break
    case 'desert':
      deposits.oil = amount(1800)
      if (random() < 0.3) deposits.rare = amount(600)
      break
    case 'urban':
      deposits.money = amount(2000)
      deposits.wood = amount(800)
      break
  }

  if (province.coastal && random() < 0.35) deposits.food = (deposits.food ?? 0) + amount(700)

  return deposits
}

/**
 * What a nation is worth at the start (design: 10 × provinces + 2 × weighted deposits
 * + population/1000). The figure exists so that no power begins the game already
 * beaten — a start that is a third weaker than the median is not a difficulty setting,
 * it is a lost game the player has not been told about.
 */
export function startingValue(
  provinces: readonly EnrichedProvince[],
  resourceWeights: Readonly<Record<string, number>>,
): number {
  let weighted = 0
  let population = 0
  for (const province of provinces) {
    population += province.population
    for (const [key, value] of Object.entries(province.deposits)) {
      weighted += (value ?? 0) * ((resourceWeights[key] ?? 1000) / 1000)
    }
  }
  return Math.round(10 * provinces.length + 2 * weighted + population / 1000)
}

/**
 * Levels the starting values of the playable powers (R-GAME-01).
 *
 * The design draws a hard line: no power may begin more than 15 % from the median.
 * With real populations that is unreachable — even compressed, China starts with six
 * times Poland's people, and the formula counts them. So the remaining gap is closed
 * where a map is allowed to be generous: in the ground. A small nation gets richer
 * deposits, which is how strategy games have balanced starting positions for decades.
 *
 * Only the *playable* provinces are touched. Neutral ground keeps whatever the terrain
 * gave it — there is nothing to balance about a province nobody starts with, and
 * scaling it would only flatten the map into sameness.
 */
export function balanceStartingValues(
  provinces: readonly EnrichedProvince[],
  nations: readonly { nation: string; provinces: readonly string[] }[],
  resourceWeights: Readonly<Record<string, number>>,
  maxIterations = 200,
): EnrichedProvince[] {
  const byId = new Map(provinces.map((p) => [p.id, { ...p, deposits: { ...p.deposits } }]))
  const owned = nations.map((nation) => ({
    nation: nation.nation,
    provinces: nation.provinces.map((id) => byId.get(id)).filter((p): p is EnrichedProvince => !!p),
  }))

  for (let round = 0; round < maxIterations; round++) {
    const values = owned.map((n) => startingValue(n.provinces, resourceWeights))
    const sorted = [...values].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 1
    if (median <= 0) break

    const worst = Math.max(...values.map((value) => Math.abs(value - median) / median))
    if (worst <= 0.14) break

    owned.forEach((nation, index) => {
      const value = values[index]!
      // The population part cannot be moved, so the deposits have to carry the whole
      // difference — which is why the correction is computed against them alone.
      const fromDeposits = value - fixedPart(nation.provinces)
      const wanted = median - fixedPart(nation.provinces)
      if (fromDeposits <= 0 || wanted <= 0) return

      // Damped, so a nation cannot overshoot and start the next round on the far side.
      const factor = 1 + (wanted / fromDeposits - 1) * 0.6
      // A wide band: a small nation may hold genuinely rich ground. The cap is there
      // so no province ends up with a deposit nobody could read off a tooltip.
      const clamped = Math.min(12, Math.max(0.1, factor))

      for (const province of nation.provinces) {
        for (const key of Object.keys(province.deposits) as ResourceKey[]) {
          province.deposits[key] = Math.max(1, Math.round((province.deposits[key] ?? 0) * clamped))
        }
      }
    })
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'))
}

/** The part of a starting value the balancing cannot move: provinces and people. */
function fixedPart(provinces: readonly EnrichedProvince[]): number {
  return 10 * provinces.length + provinces.reduce((sum, p) => sum + p.population, 0) / 1000
}
