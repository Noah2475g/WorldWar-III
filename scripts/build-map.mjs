#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { open } from 'shapefile'
import { curate } from '../packages/mapgen/src/curation.ts'
import { mergeProvinces } from '../packages/mapgen/src/provinces.ts'
import { buildAdjacency, findEnclaves } from '../packages/mapgen/src/adjacency.ts'
import { shapeAreaKm2, shapeCentre } from '../packages/mapgen/src/area.ts'

/**
 * Builds the world map: province shapes and who borders whom (T-M9-02a, T-M9-02b).
 *
 * Reads the shapefiles, merges every province's units into one shape through a shared
 * topology, simplifies *that topology* rather than each province on its own, and reads
 * the neighbours off the same arcs.
 *
 * Simplifying province by province was the first attempt and it was wrong: afterwards
 * Poland and Germany shared no point at all, which on the drawn map is a gap and for
 * the adjacency pass is a missing border. Thinning the topology thins each arc once,
 * so both sides of a border keep the same line.
 *
 * Usage:  node scripts/build-map.mjs [--weight 0.002]
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const GEO = join(ROOT, 'data', 'geo')

const arg = (name, fallback) => {
  const at = process.argv.indexOf(name)
  return at === -1 ? fallback : Number(process.argv[at + 1])
}

/**
 * Visvalingam weight below which a point is dropped, in square degrees. A point whose
 * triangle covers less than this is invisible at world scale; 0.002 deg² is roughly a
 * 5 km triangle at the equator.
 */
const WEIGHT = arg('--weight', 0.002)

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
/**
 * Every province is built from admin-1 units, including the ones that are a whole
 * country: at 1:10m all 142 of them are subdivided in the raw data anyway.
 *
 * Mixing the two files was the first attempt and it cost the enclave detection.
 * Natural Earth's country outlines and its state outlines are drawn separately and do
 * not match to the last digit, so Lesotho — taken from admin-0 — shared only part of
 * its border with the South African states around it, and looked like a province with
 * a coast. From one file, every border is one arc.
 */
const unitsByCountry = new Map()
for (const unit of raw.units) {
  const list = unitsByCountry.get(unit.countryIso) ?? []
  list.push(unit.code)
  unitsByCountry.set(unit.countryIso, list)
}

const parts = []
const missing = []
for (const province of result.provinces) {
  const codes =
    province.sourceUnits.length > 0 ? province.sourceUnits : (unitsByCountry.get(province.countryIso) ?? [])
  if (codes.length === 0) {
    missing.push(`${province.id} (keine Einheiten)`)
    continue
  }
  for (const code of codes) {
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
const detailed = mergeProvinces(parts)
console.log(`Vereinfache die Topologie bei ${WEIGHT} Quadratgrad …`)
const merged = mergeProvinces(parts, { simplifyWeight: WEIGHT })

// Neighbours come from the unsimplified topology on purpose: thinning can drop an arc
// so short that two provinces stop touching, and a border that exists on the ground
// must not disappear because it was too small to draw.
console.log('Bestimme Nachbarschaften …')
const adjacency = buildAdjacency(parts)
const countryOf_ = Object.fromEntries(result.provinces.map((p) => [p.id, p.countryIso]))
const enclaves = findEnclaves(adjacency.neighbours, countryOf_, adjacency.ringed)
const byId = new Map(result.provinces.map((p) => [p.id, p]))
const countryOf = new Map(raw.countries.map((c) => [c.iso, c]))

const countPoints = (shape) => {
  const polygons = shape.type === 'MultiPolygon' ? shape.coordinates : [shape.coordinates]
  return polygons.reduce((n, polygon) => n + polygon.reduce((m, ring) => m + ring.length, 0), 0)
}
const before = detailed.reduce((n, p) => n + countPoints(p.geometry), 0)
let after = 0

const provinces = merged.map((province) => {
  const meta = byId.get(province.id)
  const polygons =
    province.geometry.type === 'MultiPolygon' ? province.geometry.coordinates : [province.geometry.coordinates]

  const rounded = polygons
    .map((polygon) => polygon.filter((ring) => ring.length >= 4).map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)])))
    .filter((polygon) => polygon.length > 0)
  after += rounded.reduce((n, polygon) => n + polygon.reduce((m, ring) => m + ring.length, 0), 0)

  const geometry =
    rounded.length === 1 ? { type: 'Polygon', coordinates: rounded[0] } : { type: 'MultiPolygon', coordinates: rounded }

  const country = countryOf.get(meta.countryIso)
  const centre = shapeCentre(geometry)

  return {
    id: province.id,
    name: meta.name,
    country: meta.countryIso,
    continent: country?.continent ?? '',
    areaKm2: Math.round(shapeAreaKm2(geometry)),
    centre: { lon: round(centre.lon), lat: round(centre.lat) },
    neighbors: adjacency.neighbours[province.id] ?? [],
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
  simplifyWeight: WEIGHT,
  provinces,
  edges: adjacency.edges,
  enclaves,
  islands: adjacency.islands,
}
writeFileSync(join(ROOT, 'data/maps/world-shapes.json'), JSON.stringify(out) + '\n')

const zero = provinces.filter((p) => p.areaKm2 <= 0)
console.log(`\n${provinces.length} Provinzen, ${before} Stützpunkte auf ${after} vereinfacht (${Math.round((1 - after / before) * 100)} %).`)
console.log(`${adjacency.edges.length} Grenzen, ${enclaves.length} Enklaven, ${adjacency.islands.length} Inseln ohne Landnachbarn.`)
if (zero.length > 0) console.log(`⚠ ohne Fläche: ${zero.map((p) => p.id).join(', ')}`)
console.log(`data/maps/world-shapes.json geschrieben (${(JSON.stringify(out).length / 1024 / 1024).toFixed(2)} MB).`)
