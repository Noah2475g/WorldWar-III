#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { curate } from '../packages/mapgen/src/curation.ts'

/**
 * Writes the curated province list (T-M9-00).
 *
 * The decisions are in data/mapgen/merge-rules.json and the accounting is in
 * packages/mapgen/src/curation.ts; this only puts the result on disk in a form a
 * person can read and diff. The CSV is checked in — it is the map's table of contents,
 * and a change to it should show up in a review as plainly as a change to the code.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'))

const rules = read('data/mapgen/merge-rules.json')
const raw = read('data/maps/raw-units.json')
const result = curate(rules, raw.countries, raw.units)

if (result.unassigned.length > 0) {
  console.error(`\n${result.unassigned.length} Verwaltungseinheiten ohne Zuordnung:`)
  for (const unit of result.unassigned) {
    console.error(`  ${unit.code}  ${unit.countryIso}  ${unit.name}  (region: "${unit.region}")`)
  }
  console.error('\nJede Einheit braucht eine Gruppe oder einen Ausschluss. Abbruch.')
  process.exit(1)
}

const byId = (a, b) => a.id.localeCompare(b.id, 'en')
const csvCell = (value) => {
  const text = String(value ?? '')
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
const csv = (header, rows) =>
  [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n'

const countryOf = new Map(raw.countries.map((c) => [c.iso, c]))

const provinceRows = [...result.provinces].sort(byId).map((province) => {
  const country = countryOf.get(province.countryIso)
  return [
    province.id,
    province.name,
    province.countryIso,
    country?.continent ?? '',
    province.sourceUnits.join(' '),
    province.note ?? '',
  ]
})

writeFileSync(
  join(ROOT, 'data/maps/world-provinces.csv'),
  csv(['id', 'name', 'country', 'countryContinent', 'sourceUnits', 'note'], provinceRows),
)

const excludedRows = [...result.excluded].sort(byId).map((e) => [e.id, e.name, e.reason])
writeFileSync(
  join(ROOT, 'data/maps/world-excluded.csv'),
  csv(['id', 'name', 'reason'], excludedRows),
)

const perContinent = new Map()
for (const row of provinceRows) perContinent.set(row[3], (perContinent.get(row[3]) ?? 0) + 1)

console.log(`${result.provinces.length} Provinzen, ${result.excluded.length} ausgeschlossen, 0 offen.`)
console.log('Je Kontinent:')
for (const [continent, count] of [...perContinent].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(3)}  ${continent}`)
}
console.log('\ndata/maps/world-provinces.csv und world-excluded.csv geschrieben.')
