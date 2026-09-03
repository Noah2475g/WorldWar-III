import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { curate, type Admin0Record, type Admin1Record, type MergeRules } from './curation.ts'

/**
 * The cut of the world map (T-M9-00, R-MAP-01/R-MAP-03).
 *
 * The rules live in data, the accounting lives here. What these tests protect is not
 * a particular border but a property: every administrative unit in the raw data ends
 * up in exactly one province or is refused by name. Anything that quietly falls
 * through is a hole in the map nobody notices until a country is missing.
 */

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const RULES = JSON.parse(readFileSync(`${ROOT}/data/mapgen/merge-rules.json`, 'utf8')) as MergeRules

const country = (over: Partial<Admin0Record>): Admin0Record => ({
  iso: 'XXX',
  name: 'Irgendland',
  nameDe: 'Irgendland',
  population: 5_000_000,
  areaKm2: 200_000,
  continent: 'Europe',
  type: 'Sovereign country',
  ...over,
})

const unit = (over: Partial<Admin1Record>): Admin1Record => ({
  code: 'XXX-1',
  countryIso: 'XXX',
  name: 'Irgendwo',
  nameDe: 'Irgendwo',
  region: '',
  ...over,
})

describe('R-MAP-01 Zuschnitt: jede Einheit ist verbucht', () => {
  it('nimmt einen Staat als eine Provinz auf, wenn er die Schwelle erreicht', () => {
    const result = curate(RULES, [country({ iso: 'PRT', name: 'Portugal', nameDe: 'Portugal' })], [])

    expect(result.provinces).toHaveLength(1)
    expect(result.provinces[0]).toMatchObject({ id: 'PRT', name: 'Portugal', countryIso: 'PRT' })
  })

  it('weist einen Zwerg unter beiden Schwellen ab und sagt warum', () => {
    const result = curate(
      RULES,
      [country({ iso: 'AND', name: 'Andorra', population: 77_000, areaKm2: 468 })],
      [],
    )

    expect(result.provinces).toHaveLength(0)
    expect(result.excluded).toContainEqual(
      expect.objectContaining({ id: 'AND', reason: expect.stringMatching(/Schwelle/) }),
    )
  })

  it('nimmt einen Zwerg trotzdem auf, wenn er auf der Ausnahmeliste steht', () => {
    const result = curate(
      RULES,
      [country({ iso: 'SGP', name: 'Singapore', nameDe: 'Singapur', population: 5_800_000, areaKm2: 719 })],
      [],
    )

    expect(result.provinces).toHaveLength(1)
    // The reason it survives has to be recorded, or the next person deletes it as noise.
    expect(result.provinces[0]?.note).toMatch(/Malakka/)
  })

  it('nennt bei einem ausgeschlossenen Gebiet den Grund aus der Regeldatei', () => {
    const result = curate(RULES, [country({ iso: 'ATA', name: 'Antarctica' })], [])

    expect(result.excluded).toContainEqual(
      expect.objectContaining({ id: 'ATA', reason: expect.stringMatching(/Spielgebiet/) }),
    )
  })

  it('fasst die Einheiten eines untergliederten Landes ueber das Regionsfeld zusammen', () => {
    const units = [
      unit({ code: 'USA-1', countryIso: 'USA', name: 'California', region: 'West' }),
      unit({ code: 'USA-2', countryIso: 'USA', name: 'Oregon', region: 'West' }),
      unit({ code: 'USA-3', countryIso: 'USA', name: 'Maine', region: 'Northeast' }),
    ]

    const result = curate(RULES, [country({ iso: 'USA', name: 'United States' })], units)

    expect(result.provinces.map((p) => p.id).sort()).toEqual(['USA-NE', 'USA-WEST'])
    expect(result.provinces.find((p) => p.id === 'USA-WEST')?.sourceUnits).toEqual([
      'USA-1',
      'USA-2',
    ])
  })

  it('vergibt Kennungen, die nicht von der Reihenfolge der Rohdaten abhaengen', () => {
    // Ids are written down in the rules rather than counted out, precisely so that a
    // Natural Earth release in a different order cannot silently move a province: sea
    // lanes and scenarios point at these strings.
    const units = [
      unit({ code: 'USA-1', countryIso: 'USA', name: 'California', region: 'West' }),
      unit({ code: 'USA-3', countryIso: 'USA', name: 'Maine', region: 'Northeast' }),
    ]
    const countries = [country({ iso: 'USA', name: 'United States' })]

    const forwards = curate(RULES, countries, units)
    const backwards = curate(RULES, countries, [...units].reverse())

    const ids = (r: typeof forwards) => r.provinces.map((p) => p.id).sort()
    expect(ids(forwards)).toEqual(ids(backwards))
    expect(ids(forwards)).toEqual(['USA-NE', 'USA-WEST'])
  })

  it('ordnet eine Einheit ohne Regionsfeld ueber die Ausnahmetabelle zu', () => {
    // Fujian carries no region in the raw data. Without the override it would fall
    // through and China would be missing a province — silently.
    const units = [unit({ code: 'CHN-1178', countryIso: 'CHN', name: 'Fujian', region: '' })]

    const result = curate(RULES, [country({ iso: 'CHN', name: 'China' })], units)

    expect(result.provinces).toHaveLength(1)
    expect(result.provinces[0]?.name).toBe('Ostchina')
  })

  it('fasst nach ausdruecklicher Gruppierung zusammen, wo das Regionsfeld nichts taugt', () => {
    const units = [
      unit({ code: 'IDN-1', countryIso: 'IDN', name: 'Aceh' }),
      unit({ code: 'IDN-2', countryIso: 'IDN', name: 'Bali' }),
    ]

    const result = curate(RULES, [country({ iso: 'IDN', name: 'Indonesia' })], units)

    expect(result.provinces.map((p) => p.name).sort()).toEqual(['Ostindonesien', 'Sumatra'])
  })

  it('meldet eine Einheit, die keine Regel kennt, statt sie zu verlieren', () => {
    const units = [unit({ code: 'USA-9', countryIso: 'USA', name: 'Neuland', region: 'Atlantis' })]

    const result = curate(RULES, [country({ iso: 'USA', name: 'United States' })], units)

    expect(result.unassigned).toContainEqual(expect.objectContaining({ code: 'USA-9' }))
  })

  it('laesst ein untergliedertes Land nicht zusaetzlich als ganzes Land durch', () => {
    // Otherwise the United States appear twice: once as four regions and once whole.
    const result = curate(
      RULES,
      [country({ iso: 'USA', name: 'United States' })],
      [unit({ code: 'USA-1', countryIso: 'USA', name: 'California', region: 'West' })],
    )

    expect(result.provinces.map((p) => p.id)).not.toContain('USA')
  })
})

describe('R-MAP-03 Der Zuschnitt taugt fuer eine Partie', () => {
  const raw = loadRaw()
  const result = curate(RULES, raw.countries, raw.units)

  it('liegt im geforderten Korridor von 150 bis 250 Provinzen', () => {
    expect(result.provinces.length).toBeGreaterThanOrEqual(RULES.targetProvinces.min)
    expect(result.provinces.length).toBeLessThanOrEqual(RULES.targetProvinces.max)
  })

  it('verbucht jede Verwaltungseinheit genau einmal', () => {
    // At 1:10m there are 4596 units, and most belong to countries that enter the map
    // whole. So the guarantee is not "every unit is in a province's source list" but
    // the one that actually matters: for every unit there is exactly one answer to
    // "where did this go?" — its own province, its country's province, or a refusal.
    expect(result.unassigned).toEqual([])

    const inProvince = new Set<string>()
    for (const province of result.provinces) {
      for (const source of province.sourceUnits) {
        expect(inProvince.has(source), `${source} steckt in zwei Provinzen`).toBe(false)
        inProvince.add(source)
      }
    }

    const wholeCountries = new Set(
      result.provinces.filter((p) => p.sourceUnits.length === 0).map((p) => p.countryIso),
    )
    const refusedCountries = new Set(result.excluded.map((e) => e.id))

    for (const unit of raw.units) {
      const accounted =
        inProvince.has(unit.code) ||
        wholeCountries.has(unit.countryIso) ||
        refusedCountries.has(unit.countryIso) ||
        refusedCountries.has(unit.code)
      expect(accounted, `${unit.code} (${unit.name}, ${unit.countryIso}) ist nirgends verbucht`).toBe(
        true,
      )
    }
  })

  it('teilt nur Laender auf, fuer die eine Regel besteht', () => {
    // The counterpart to the assertion above: a unit must not sneak into a province of
    // a country that was never meant to be subdivided.
    const ruled = new Set(Object.keys(RULES.admin1.countries))
    for (const province of result.provinces) {
      if (province.sourceUnits.length === 0) continue
      expect(ruled.has(province.countryIso), `${province.id} ohne Regel`).toBe(true)
    }
  })

  it('vergibt jede Kennung nur einmal', () => {
    const ids = result.provinces.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gibt jeder Startnation mindestens drei Provinzen', () => {
    for (const [, nation] of Object.entries(RULES.startNations.nations)) {
      const owned = result.provinces.filter((p) => nation.countries.includes(p.countryIso))
      expect(owned.length, `${nation.name} haette nur ${owned.length} Provinzen`).toBeGreaterThanOrEqual(3)
    }
  })

  it('nennt fuer jedes ausgeschlossene Gebiet einen Grund', () => {
    for (const entry of result.excluded) {
      expect(entry.reason.length, `${entry.id} ohne Begruendung`).toBeGreaterThan(10)
    }
  })
})

describe('R-MAP-01 Die Regeldatei zeigt auf nichts Totes', () => {
  const raw = loadRaw()
  const countryIsos = new Set(raw.countries.map((c) => c.iso))
  const unitNames = new Map<string, Set<string>>()
  const unitCodes = new Set(raw.units.map((u) => u.code))
  for (const unit of raw.units) {
    const set = unitNames.get(unit.countryIso) ?? new Set<string>()
    set.add(unit.name)
    unitNames.set(unit.countryIso, set)
  }

  /**
   * A rule that matches nothing is worse than a missing rule: it reads as a decision
   * that was made and carried out, while in truth it does nothing at all. These
   * assertions also catch the day a Natural Earth release renames or drops a code.
   */
  it('kennt jede ausgeschlossene und jede ausgenommene Kennung', () => {
    for (const iso of Object.keys(RULES.admin0.exclude)) {
      expect(countryIsos.has(iso), `exclude: ${iso} kommt in den Rohdaten nicht vor`).toBe(true)
    }
    for (const iso of Object.keys(RULES.admin0.alwaysInclude)) {
      expect(countryIsos.has(iso), `alwaysInclude: ${iso} kommt in den Rohdaten nicht vor`).toBe(true)
    }
  })

  it('nennt nur Gebietstypen, die es wirklich gibt', () => {
    const types = new Set(raw.countries.map((c) => c.type))
    for (const type of RULES.admin0.excludeTypes) {
      expect(types.has(type), `excludeTypes: "${type}" kommt in den Rohdaten nicht vor`).toBe(true)
    }
  })

  it('nennt in jeder Gruppe nur Einheiten, die es gibt', () => {
    // The failure this catches is a typo in an accented name — "Rondonia" for
    // "Rondônia" — which would otherwise leave a province quietly one unit short.
    for (const [iso, rule] of Object.entries(RULES.admin1.countries)) {
      const known = unitNames.get(iso) ?? new Set<string>()
      for (const [id, group] of Object.entries(rule.groups ?? {})) {
        for (const member of group.units) {
          expect(known.has(member), `${iso}/${id}: "${member}" gibt es nicht`).toBe(true)
        }
      }
      for (const code of Object.keys(rule.overrides ?? {})) {
        expect(unitCodes.has(code), `${iso}: Ausnahme fuer unbekannten Code ${code}`).toBe(true)
      }
    }
  })

  it('setzt jede Startnation aus Laendern zusammen, die es gibt', () => {
    for (const [key, nation] of Object.entries(RULES.startNations.nations)) {
      for (const iso of nation.countries) {
        expect(countryIsos.has(iso), `Startnation ${key}: unbekanntes Land ${iso}`).toBe(true)
      }
    }
  })
})

/** Reads the raw shapefiles once for the whole-world assertions above. */
function loadRaw(): { countries: Admin0Record[]; units: Admin1Record[] } {
  const path = `${ROOT}/data/maps/raw-units.json`
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    countries: Admin0Record[]
    units: Admin1Record[]
  }
  return raw
}
