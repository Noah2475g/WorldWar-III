import { splitGeographically, type Grid } from './geosplit.ts'

/**
 * Turning 258 states and 4596 administrative units into a playable map (T-M9-00).
 *
 * The decisions live in `data/mapgen/merge-rules.json`, not here — this is only the
 * accounting that carries them out. What the function guarantees is the property the
 * tests check: every unit it is handed ends up in exactly one province, or in
 * `excluded` with a reason, or in `unassigned` where it is loud enough to fix. Nothing
 * disappears quietly, because a hole in a world map is invisible until a country is
 * missing from the game.
 */

export interface Admin0Record {
  iso: string
  name: string
  nameDe: string
  population: number
  areaKm2: number
  continent: string
  type: string
}

export interface Admin1Record {
  code: string
  countryIso: string
  name: string
  nameDe: string
  /** Natural Earth's own grouping. Empty for a good number of units. */
  region: string
  areaKm2?: number
  /** Centre of the unit, used when a country is split by position. */
  lat?: number
  lon?: number
}

export interface Admin1Rule {
  strategy: 'region' | 'explicit' | 'geographic'
  /**
   * For `geographic`: how many bands south-to-north and west-to-east. The provinces
   * are then named in that order, south-west first, by `cells`.
   */
  grid?: Grid
  /** For `geographic`: id and name per grid cell, south-west first. */
  cells?: { id: string; name: string }[]
  /** Region name per unit code, for units the raw data leaves ungrouped. */
  overrides?: Record<string, string>
  /**
   * Province per region key of the raw data. The id is written down rather than
   * generated: sea lanes and scenarios refer to provinces by name, and an id derived
   * from processing order would silently point somewhere else the day Natural Earth
   * ships a release in a different order.
   */
  regions?: Record<string, { id: string; name: string }>
  /**
   * Units of this country that get no province at all, with the reason. Needed
   * because a subdivided country can carry entries a map has no use for — China's
   * list includes the Paracel Islands, a handful of disputed reefs.
   */
  excludeUnits?: Record<string, string>
  /** Province per id, for countries whose region field is unusable. */
  groups?: Record<string, { name: string; units: string[] }>
  note?: string
}

export interface MergeRules {
  targetProvinces: { min: number; max: number }
  admin0: {
    minPopulation: number
    minAreaKm2: number
    alwaysInclude: Record<string, string>
    exclude: Record<string, string>
    excludeTypes: string[]
    note?: string
  }
  admin1: { note?: string; countries: Record<string, Admin1Rule> }
  startNations: { note?: string; nations: Record<string, { name: string; countries: string[] }> }
}

export interface Province {
  /** The country's ISO code, or the id the rules give a subdivision (`RUS-SIB`). */
  id: string
  name: string
  countryIso: string
  /** Raw units this province is made of. Empty for a whole-country province. */
  sourceUnits: string[]
  /** Why a province below the thresholds was kept anyway. */
  note?: string
}

export interface Excluded {
  id: string
  name: string
  reason: string
}

export interface CurationResult {
  provinces: Province[]
  excluded: Excluded[]
  /** Units no rule covers. Never empty on purpose — this is the failure channel. */
  unassigned: Admin1Record[]
}

export function curate(
  rules: MergeRules,
  countries: readonly Admin0Record[],
  units: readonly Admin1Record[],
): CurationResult {
  const provinces: Province[] = []
  const excluded: Excluded[] = []
  const unassigned: Admin1Record[] = []

  const subdivided = new Set(Object.keys(rules.admin1.countries))

  for (const country of countries) {
    // A subdivided country enters through its units, never twice.
    if (subdivided.has(country.iso)) continue

    const verdict = judge(country, rules)
    if (verdict.keep) {
      provinces.push({
        id: country.iso,
        name: country.nameDe || country.name,
        countryIso: country.iso,
        ...(verdict.note !== undefined ? { note: verdict.note } : {}),
        sourceUnits: [],
      })
    } else {
      excluded.push({ id: country.iso, name: country.nameDe || country.name, reason: verdict.reason })
    }
  }

  for (const [iso, rule] of Object.entries(rules.admin1.countries)) {
    const all = units.filter((unit) => unit.countryIso === iso)
    if (all.length === 0) continue

    const own: Admin1Record[] = []
    for (const unit of all) {
      const reason = rule.excludeUnits?.[unit.code]
      if (reason === undefined) own.push(unit)
      else excluded.push({ id: unit.code, name: unit.nameDe || unit.name, reason })
    }

    const grouped = groupUnits(own, rule)

    unassigned.push(...grouped.unassigned)
    for (const [id, group] of grouped.groups) {
      provinces.push({
        id,
        name: group.name,
        countryIso: iso,
        sourceUnits: group.units.map((unit) => unit.code),
      })
    }
  }

  return { provinces, excluded, unassigned }
}

function groupUnits(units: readonly Admin1Record[], rule: Admin1Rule): Grouping {
  if (rule.strategy === 'region') return groupByRegion(units, rule)
  if (rule.strategy === 'explicit') return groupExplicitly(units, rule)
  return groupByPosition(units, rule)
}

/**
 * Groups by where the units lie. At 1:10m most countries carry no usable grouping of
 * their own — Germany arrives as sixteen states with no regions, Turkey as eighty-one
 * provinces — and writing those lists out by hand for two dozen countries would be a
 * standing liability: a renamed unit in the next Natural Earth release would silently
 * drop out of its province.
 */
function groupByPosition(units: readonly Admin1Record[], rule: Admin1Rule): Grouping {
  const groups = new Map<string, Group>()
  const cells = rule.cells ?? []
  const unassigned: Admin1Record[] = []

  for (const cell of splitGeographically(units, rule.grid ?? { lat: 1, lon: 1 })) {
    const named = cells[cell.index]
    if (!named) {
      // Fewer names than cells: the country would lose provinces without a word.
      unassigned.push(...cell.units)
      continue
    }
    for (const unit of cell.units) add(groups, named.id, named.name, unit)
  }

  return { groups, unassigned }
}

/** Does this country become a province of its own? */
function judge(
  country: Admin0Record,
  rules: MergeRules,
): { keep: true; note?: string } | { keep: false; reason: string } {
  const excludedReason = rules.admin0.exclude[country.iso]
  if (excludedReason !== undefined) return { keep: false, reason: excludedReason }

  if (rules.admin0.excludeTypes.includes(country.type)) {
    return { keep: false, reason: `Gebietstyp "${country.type}" ist kein eigenes Spielgebiet.` }
  }

  const exception = rules.admin0.alwaysInclude[country.iso]
  if (exception !== undefined) return { keep: true, note: exception }

  const bigEnough =
    country.population >= rules.admin0.minPopulation || country.areaKm2 >= rules.admin0.minAreaKm2
  if (!bigEnough) {
    return {
      keep: false,
      reason:
        `Unter beiden Schwellen: ${country.population.toLocaleString('de-DE')} Einwohner ` +
        `und ${country.areaKm2.toLocaleString('de-DE')} km².`,
    }
  }

  return { keep: true }
}

interface Group {
  name: string
  units: Admin1Record[]
}

interface Grouping {
  /** Keyed by the province id from the rules, so the order of the input cannot leak in. */
  groups: Map<string, Group>
  unassigned: Admin1Record[]
}

function add(groups: Map<string, Group>, id: string, name: string, unit: Admin1Record): void {
  const existing = groups.get(id)
  if (existing) existing.units.push(unit)
  else groups.set(id, { name, units: [unit] })
}

/** Groups by Natural Earth's own region field, with a table for the gaps. */
function groupByRegion(units: readonly Admin1Record[], rule: Admin1Rule): Grouping {
  const groups = new Map<string, Group>()
  const unassigned: Admin1Record[] = []

  for (const unit of units) {
    const region = unit.region || rule.overrides?.[unit.code] || ''
    const province = region ? rule.regions?.[region] : undefined
    if (!province) {
      unassigned.push(unit)
      continue
    }
    add(groups, province.id, province.name, unit)
  }

  return { groups, unassigned }
}

/** Groups by an explicit list of unit names, for countries whose regions are unusable. */
function groupExplicitly(units: readonly Admin1Record[], rule: Admin1Rule): Grouping {
  const groups = new Map<string, Group>()
  const unassigned: Admin1Record[] = []

  const home = new Map<string, { id: string; name: string }>()
  for (const [id, group] of Object.entries(rule.groups ?? {})) {
    for (const member of group.units) home.set(member, { id, name: group.name })
  }

  for (const unit of units) {
    const province = home.get(unit.name)
    if (!province) {
      unassigned.push(unit)
      continue
    }
    add(groups, province.id, province.name, unit)
  }

  return { groups, unassigned }
}
