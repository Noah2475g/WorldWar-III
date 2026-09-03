#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { open } from 'shapefile'
import { curate } from '../packages/mapgen/src/curation.ts'
import { mergeProvinces } from '../packages/mapgen/src/provinces.ts'
import { simplifyRing } from '../packages/mapgen/src/simplify.ts'
import { shapeAreaKm2, shapeCentre } from '../packages/mapgen/src/area.ts'

/**
 * Builds the province geometry of the world map (T-M9-02a).
 *
 * Reads the shapefiles, merges every province's units into one shape through a shared
 * topology, then simplifies — in that order, never the other way round. Simplifying the
 * parts first would move their shared borders apart by a fraction of a degree each and
 * leave slivers between provinces that in truth touch.
 *
 * Usage:  node scripts/build-map.mjs [--tolerance 0.05]
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const GEO = join(ROOT, 'data', 'geo')

const arg = (name, fallback) => {
  const at = process.argv.indexOf(name)
  return at === -1 ? fallback : Number(process.argv[at + 1])
}

/**
 * How far a coastline may move, in degrees. 0.05° is roughly 5 km at the equator —
 * invisible on a world map, and it cuts the file to a fraction of its size.
 */
const TOLERANCE = arg('--tolerance', 0.05)

const clean = (value) => (typeof value === 'string' ? value.replace(/\0/g, '').trim() : value)

async function readShapes(shp, dbf, key) {
  const source = await open(shp, dbf, { encoding: 'utf8' })
  const shapes = new Map()
  for (let r = await source.read(); !r.done; r = await source.read()) {
    if (r.value.geometry) shapes.set(clean(r.value.properties[key]), r.value.geometry)
  }
  return shapes
}

const rules = JSON.parse(readFileSync(join(ROOT, 'data/mapgen/merge-rules.json'), 'utf8'))
const raw = JSON.parse(readFileSync(join(ROOT, 'data/maps/raw-units.json'), 'utf8'))
const result = curate(rules, raw.countries, raw.units)

if (result.unassigned.length > 0) {
  console.error(`${result.unassigned.length} Einheiten ohne Zuordnung — erst scripts/curate-provinces.mjs klären.`)
  process.exit(1)
}

console.log('Lese Geometrien …')
const unitShapes = await readShapes(
  join(GEO, 'admin1', 'ne_10m_admin_1_states_provinces.shp'),
  join(GEO, 'admin1', 'ne_10m_admin_1_states_provinces.dbf'),
  'adm1_code',
)
const countryShapes = await readShapes(
  join(GEO, 'admin0', 'ne_10m_admin_0_countries.shp'),
  join(GEO, 'admin0', 'ne_10m_admin_0_countries.dbf'),
  'ADM0_A3',
)

// Whole-country provinces enter the merge as a single "unit" of their own, so that
// they share the same topology as the subdivided ones — a border between Germany and
// Denmark has to be the same arc on both sides, whichever way each was built.
const parts = []
const missing = []
for (const province of result.provinces) {
  if (province.sourceUnits.length === 0) {
    const shape = countryShapes.get(province.countryIso)
    if (!shape) missing.push(province.id)
    else parts.push({ code: `C:${province.countryIso}`, provinceId: province.id, geometry: shape })
    continue
  }
  for (const code of province.sourceUnits) {
    const shape = unitShapes.get(code)
    if (!shape) missing.push(`${province.id}/${code}`)
    else parts.push({ code, provinceId: province.id, geometry: shape })
  }
}

if (missing.length > 0) {
  console.error(`Ohne Geometrie: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`)
  process.exit(1)
}

console.log(`Verschmelze ${parts.length} Teile zu ${result.provinces.length} Provinzen …`)
const merged = mergeProvinces(parts)

console.log(`Vereinfache bei ${TOLERANCE}° …`)
const byId = new Map(result.provinces.map((p) => [p.id, p]))
const countryOf = new Map(raw.countries.map((c) => [c.iso, c]))

let before = 0
let after = 0
const provinces = merged.map((province) => {
  const meta = byId.get(province.id)
  const polygons =
    province.geometry.type === 'MultiPolygon' ? province.geometry.coordinates : [province.geometry.coordinates]

  const simplified = polygons
    .map((polygon) => {
      before += polygon.reduce((n, ring) => n + ring.length, 0)
      const rings = polygon
        .map((ring) => simplifyRing(ring.map(([lon, lat]) => ({ lon, lat })), TOLERANCE))
        .filter((ring) => ring.length >= 4)
        .map((ring) => ring.map(({ lon, lat }) => [round(lon), round(lat)]))
      after += rings.reduce((n, ring) => n + ring.length, 0)
      return rings
    })
    .filter((polygon) => polygon.length > 0)

  const geometry =
    simplified.length === 1
      ? { type: 'Polygon', coordinates: simplified[0] }
      : { type: 'MultiPolygon', coordinates: simplified }

  const country = countryOf.get(meta.countryIso)
  const centre = shapeCentre(geometry)

  return {
    id: province.id,
    name: meta.name,
    country: meta.countryIso,
    continent: country?.continent ?? '',
    areaKm2: Math.round(shapeAreaKm2(geometry)),
    centre: { lon: round(centre.lon), lat: round(centre.lat) },
    geometry,
  }
})

/** Three decimals is about 100 m — far below anything the map can show. */
function round(value) {
  return Math.round(value * 1000) / 1000
}

const out = {
  note: 'Erzeugt von scripts/build-map.mjs aus Natural Earth 1:10 Mio (gemeinfrei). Nicht von Hand ändern — Regeln stehen in data/mapgen/merge-rules.json.',
  scale: '10m',
  toleranceDegrees: TOLERANCE,
  provinces,
}
writeFileSync(join(ROOT, 'data/maps/world-shapes.json'), JSON.stringify(out) + '\n')

const zero = provinces.filter((p) => p.areaKm2 <= 0)
console.log(`\n${provinces.length} Provinzen, ${before} Stützpunkte auf ${after} vereinfacht (${Math.round((1 - after / before) * 100)} %).`)
if (zero.length > 0) console.log(`⚠ ohne Fläche: ${zero.map((p) => p.id).join(', ')}`)
console.log(`data/maps/world-shapes.json geschrieben (${(JSON.stringify(out).length / 1024 / 1024).toFixed(2)} MB).`)
