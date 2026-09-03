#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { open } from 'shapefile'
import { curate } from '../packages/mapgen/src/curation.ts'
import { mergeProvinces } from '../packages/mapgen/src/provinces.ts'
import { buildAdjacency, findEnclaves } from '../packages/mapgen/src/adjacency.ts'
import { planAbsorptions } from '../packages/mapgen/src/absorb.ts'
import { deriveSeaLanes } from '../packages/mapgen/src/sealanes.ts'
import { readCsv } from '../packages/mapgen/src/csv.ts'
import { balanceStartingValues, enrich, ensureStartingBasics, startingValue } from '../packages/mapgen/src/enrich.ts'
import { project } from '../packages/mapgen/src/project.ts'
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

const partsFor = (provinceId, codes) =>
  codes.map((code) => ({ code, provinceId, geometry: unitShapes.get(code) })).filter((p) => p.geometry)

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
    if (!unitShapes.has(code)) missing.push(`${province.id}/${code}`)
  }
  parts.push(...partsFor(province.id, codes))
}

/**
 * A territory refused as too small is still land. Left out, it becomes a white patch
 * between provinces — and its neighbours look coastal, because the border to a hole is
 * a stretch of outline shared with nobody. That is how Switzerland and Austria first
 * came out as countries with a sea front.
 *
 * So every hole with a land neighbour is handed to the one it shares the most border
 * with. Refused islands stay out; the sea around them is not a hole.
 */
const kept = new Set(result.provinces.map((p) => p.id))
const holeParts = []
for (const entry of result.excluded) {
  const codes = unitsByCountry.get(entry.id) ?? []
  if (codes.length === 0) continue
  holeParts.push(...partsFor(`HOLE:${entry.id}`, codes))
}

const probe = buildAdjacency([...parts, ...holeParts])
const holeIds = [...new Set(holeParts.map((p) => p.provinceId))]
const absorptions = planAbsorptions(holeIds, probe.edges, kept)

const absorbedInto = new Map(absorptions.map((a) => [a.id, a.into]))
for (const part of holeParts) {
  const into = absorbedInto.get(part.provinceId)
  if (into) parts.push({ ...part, provinceId: into })
}
console.log(
  `${absorptions.length} zu kleine Gebiete einem Nachbarn zugeschlagen, ` +
    `${holeIds.length - absorptions.length} abgelehnte Inseln bleiben draußen.`,
)

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

/**
 * A province has a coast when part of its outline is shared with nobody. On a world
 * map that unshared stretch can only be sea — which is why the holes had to be closed
 * first: a border facing a missing country has exactly the same shape as a coastline,
 * and it made Switzerland and Austria look seafaring.
 */
const landlocked = new Set(adjacency.ringed)
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
    coastal: !landlocked.has(province.id),
    neighbors: adjacency.neighbours[province.id] ?? [],
    geometry,
  }
})

/** Three decimals is about 100 m — far below anything the map can show. */
function round(value) {
  return Math.round(value * 1000) / 1000
}

// ---------------------------------------------------------------- sea lanes

const linkKey = (a, b) => [a, b].sort((x, y) => x.localeCompare(y, 'en')).join('|')

/**
 * The decisive lanes are curated by hand: what makes Hormuz matter is not its width.
 * Everything else is derived, because a coastal province with no way out to sea is
 * unreachable by ship and half the map would be closed to fleets.
 */
const curated = readCsv(readFileSync(join(ROOT, 'data/maps/world-sealinks.csv'), 'utf8'))
const provinceById = new Map(provinces.map((p) => [p.id, p]))

const curatedProblems = []
for (const lane of curated) {
  for (const end of [lane.from, lane.to]) {
    const province = provinceById.get(end)
    if (!province) curatedProblems.push(`${lane.name}: ${end} gibt es nicht`)
    else if (!province.coastal) curatedProblems.push(`${lane.name}: ${end} hat keine Küste`)
  }
}
if (curatedProblems.length > 0) {
  console.error('\nKuratierte Seewege mit Fehlern:')
  for (const problem of curatedProblems) console.error(`  ${problem}`)
  process.exit(1)
}

const settled = new Set([
  ...adjacency.edges.map((e) => linkKey(e.from, e.to)),
  ...curated.map((l) => linkKey(l.from, l.to)),
])

const coastalProvinces = provinces
  .filter((p) => p.coastal)
  .map((p) => ({ id: p.id, centre: p.centre, shape: p.geometry }))

console.log(`Leite Seewege fuer ${coastalProvinces.length} Kuestenprovinzen ab …`)
const curatedPairs = new Set(curated.map((lane) => linkKey(lane.from, lane.to)))
const derived = deriveSeaLanes(coastalProvinces, settled, { curatedPairs })

const seaLanes = [
  ...curated.map((l) => ({
    from: l.from,
    to: l.to,
    crossing: l.kind === 'strait' ? 'strait' : 'none',
    name: l.name,
    distanceKm: Math.round(
      distanceBetween(provinceById.get(l.from).centre, provinceById.get(l.to).centre),
    ),
  })),
  ...derived.map((l) => ({ from: l.from, to: l.to, crossing: 'none', name: '', distanceKm: l.distanceKm })),
]

function distanceBetween(a, b) {
  const R = 6371.0088
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

const withoutLane = provinces.filter(
  (p) => p.coastal && !seaLanes.some((l) => l.from === p.id || l.to === p.id),
)

const out = {
  note: 'Erzeugt von scripts/build-map.mjs aus Natural Earth 1:10 Mio (gemeinfrei). Nicht von Hand ändern — Regeln stehen in data/mapgen/merge-rules.json.',
  scale: '10m',
  simplifyWeight: WEIGHT,
  provinces,
  edges: adjacency.edges,
  seaLanes,
  enclaves,
  islands: adjacency.islands,
}
writeFileSync(join(ROOT, 'data/maps/world-shapes.json'), JSON.stringify(out) + '\n')

const zero = provinces.filter((p) => p.areaKm2 <= 0)
console.log(`\n${provinces.length} Provinzen, ${before} Stützpunkte auf ${after} vereinfacht (${Math.round((1 - after / before) * 100)} %).`)
console.log(
  `${adjacency.edges.length} Grenzen, ${enclaves.length} Enklaven, ` +
    `${adjacency.islands.length} Inseln ohne Landnachbarn, ` +
    `${provinces.filter((p) => p.coastal).length} Provinzen mit Küste.`,
)
if (zero.length > 0) console.log(`⚠ ohne Fläche: ${zero.map((p) => p.id).join(', ')}`)
console.log(
  `${seaLanes.length} Seewege (${curated.length} kuratiert, ${derived.length} abgeleitet); ` +
    `${withoutLane.length} Kuestenprovinzen ohne Seeweg.`,
)
if (withoutLane.length > 0) {
  console.log(`  ohne: ${withoutLane.map((p) => p.name).join(', ')}`)
}
console.log(`data/maps/world-shapes.json geschrieben (${(JSON.stringify(out).length / 1024 / 1024).toFixed(2)} MB).`)

// ---------------------------------------------------------------- world.json

/**
 * The map in the shape the core expects (data/maps/world.json).
 *
 * Two conversions matter here. Coordinates become screen pixels, because the interface
 * draws in pixels — but distances stay kilometres, measured on the globe, because the
 * game charges movement in kilometres. Keeping those apart is the whole reason
 * project() and distanceKm() are separate functions.
 *
 * Population, terrain and deposits come from the enrichment (T-M9-03) — and they are
 * written **as the core reads them**, not scaled again. The core's units: a deposit is
 * fixed-point production per tick (2000 = 2,0 units an hour), population is fixed-point
 * thousands (300 000 = 300 000 people, a factor of 1,0 in production.ts). The enrichment
 * already produces both on that scale — the same scale as the test map the rules were
 * balanced on. The first build multiplied both by a thousand once more, and a barracks
 * cost four game-minutes of income; see PROBLEME.md, 2026-09-03.
 */
const WIDTH = 4000
const HEIGHT = 2400
const TOP = project({ lon: 0, lat: 78 }).y
const BOTTOM = project({ lon: 0, lat: -58 }).y
const toX = (lon) => Math.round(project({ lon, lat: 0 }).x * WIDTH)
const toY = (lat) => Math.round(((project({ lon: 0, lat }).y - TOP) / (BOTTOM - TOP)) * HEIGHT)

/**
 * The core stores every quantity as fixed-point with three decimals. Used for the
 * distances, which the pipeline measures in plain kilometres. Population and deposits
 * are *not* passed through here — see the note above.
 */
const FIXED = 1000
const toFixed = (value) => Math.round(value * FIXED)

/**
 * Population, ground and deposits (T-M9-03). The first two follow the real world as
 * far as the data allows; the third is invented, because Natural Earth knows nothing
 * about coal — but invented deterministically, so the same map is built every time.
 */
const rulesAi = JSON.parse(readFileSync(join(ROOT, 'data/rules/default/ai.json'), 'utf8'))
const populationByCountry = Object.fromEntries(raw.countries.map((c) => [c.iso, c.population]))

const nationProvinces = Object.entries(rules.startNations.nations).map(([, nation]) => ({
  nation: nation.name,
  provinces: provinces.filter((p) => nation.countries.includes(p.country)).map((p) => p.id),
}))

const enrichedRaw = enrich(
  provinces.map((p) => ({
    id: p.id,
    country: p.country,
    areaKm2: p.areaKm2,
    centre: p.centre,
    coastal: p.coastal,
  })),
  { populationByCountry, resourceWeights: rulesAi.resourceWeights },
)
// Every playable power gets the ground a first game needs before the values are
// levelled — a nation without timber cannot build its first barracks from its own
// production, and no start position is allowed to be that kind of trap.
const withBasics = ensureStartingBasics(enrichedRaw, nationProvinces)
const enriched = new Map(
  balanceStartingValues(withBasics, nationProvinces, rulesAi.resourceWeights).map((e) => [e.id, e]),
)

const gameProvinces = provinces.map((p) => {
  const outer =
    p.geometry.type === 'MultiPolygon'
      ? p.geometry.coordinates.reduce((a, b) => (a[0].length >= b[0].length ? a : b))[0]
      : p.geometry.coordinates[0]

  return {
    id: p.id,
    name: p.name,
    kind: enriched.get(p.id).kind,
    terrain: enriched.get(p.id).terrain,
    coastal: p.coastal,
    center: { x: toX(p.centre.lon), y: toY(p.centre.lat) },
    polygon: outer.map(([lon, lat]) => [toX(lon), toY(lat)]),
    population: Math.round(enriched.get(p.id).population),
    deposits: Object.fromEntries(
      Object.entries(enriched.get(p.id).deposits).map(([key, value]) => [key, Math.round(value)]),
    ),
  }
})

const gameEdges = [
  ...adjacency.edges.map((e) => ({
    a: e.from,
    b: e.to,
    kind: 'land',
    distanceKm: toFixed(e.distanceKm),
    crossing: 'none',
  })),
  ...seaLanes.map((l) => ({
    a: l.from,
    b: l.to,
    kind: 'sea',
    distanceKm: toFixed(l.distanceKm),
    crossing: l.crossing,
  })),
]

const edgesByProvince = {}
gameEdges.forEach((edge, index) => {
  ;(edgesByProvince[edge.a] ??= []).push(index)
  ;(edgesByProvince[edge.b] ??= []).push(index)
})
for (const province of gameProvinces) edgesByProvince[province.id] ??= []

const startPositions = Object.values(rules.startNations.nations).map((nation) => {
  const own = gameProvinces.filter((p) => nation.countries.includes(byId.get(p.id).countryIso))
  return {
    nation: nation.name,
    capital: own[0]?.id ?? '',
    provinces: own.map((p) => p.id),
  }
})

const world = {
  id: 'world',
  name: 'Welt',
  width: WIDTH,
  height: HEIGHT,
  provinces: gameProvinces,
  edges: gameEdges,
  edgesByProvince,
  startPositions,
}
writeFileSync(join(ROOT, 'data/maps/world.json'), JSON.stringify(world) + '\n')
console.log(
  `data/maps/world.json geschrieben: ${gameProvinces.length} Provinzen, ${gameEdges.length} Kanten, ` +
    `${startPositions.length} Startnationen (${(JSON.stringify(world).length / 1024 / 1024).toFixed(2)} MB).`,
)

// ---------------------------------------------------------------- Bericht

/**
 * The balance figure the design asks for: no power may start a third weaker than the
 * median. That is not a difficulty setting — it is a lost game the player has not been
 * told about.
 */
const values = nationProvinces.map((nation) => {
  const own = nation.provinces.map((id) => enriched.get(id)).filter(Boolean)
  return { nation: nation.nation, provinces: own.length, value: startingValue(own, rulesAi.resourceWeights) }
})
values.sort((a, b) => b.value - a.value)
const sorted = [...values].map((v) => v.value).sort((a, b) => a - b)
const median = sorted[Math.floor(sorted.length / 2)]
const deviation = (value) => Math.round(((value - median) / median) * 100)
const worst = Math.max(...values.map((v) => Math.abs(deviation(v.value))))

const terrainCount = {}
for (const p of gameProvinces) terrainCount[p.terrain] = (terrainCount[p.terrain] ?? 0) + 1
// Fixed-point thousands: the raw figure is the number of people.
const totalPopulation = gameProvinces.reduce((sum, p) => sum + p.population, 0)

const report = [
  '# Kartenbericht',
  '',
  `Erzeugt von \`scripts/build-map.mjs\` aus Natural Earth 1:10 Mio. Nicht von Hand ändern.`,
  '',
  '## Umfang',
  '',
  `| Provinzen | ${gameProvinces.length} |`,
  '|---|---|',
  `| Landgrenzen | ${adjacency.edges.length} |`,
  `| Seewege | ${seaLanes.length} (${curated.length} kuratiert, ${derived.length} abgeleitet) |`,
  `| Küstenprovinzen | ${provinces.filter((p) => p.coastal).length} |`,
  `| Enklaven | ${enclaves.length}${enclaves.length ? ' (' + enclaves.join(', ') + ')' : ''} |`,
  `| Inseln ohne Landnachbarn | ${adjacency.islands.length} |`,
  `| Startnationen | ${startPositions.length} |`,
  `| Gesamtfläche | ${(provinces.reduce((s, p) => s + p.areaKm2, 0) / 1e6).toFixed(1)} Mio km² |`,
  `| Gesamtbevölkerung | ${(totalPopulation / 1e9).toFixed(2)} Mrd |`,
  '',
  '## Gelände',
  '',
  '| Art | Provinzen |',
  '|---|---|',
  ...Object.entries(terrainCount)
    .sort((a, b) => b[1] - a[1])
    .map(([terrain, count]) => `| ${terrain} | ${count} |`),
  '',
  '## Startwerte der Nationen',
  '',
  `Formel: 10 × Provinzen + 2 × gewichtete Vorkommen + Bevölkerung/1000. Median ${median}, ` +
    `größte Abweichung ${worst} % (Grenze 15 %).`,
  '',
  '| Nation | Provinzen | Startwert | Abweichung |',
  '|---|---|---|---|',
  ...values.map(
    (v) => `| ${v.nation} | ${v.provinces} | ${v.value.toLocaleString('de-DE')} | ${deviation(v.value) > 0 ? '+' : ''}${deviation(v.value)} % |`,
  ),
  '',
]
writeFileSync(join(ROOT, 'docs/reports/map.md'), report.join('\n'))
console.log(`Startwerte: Median ${median}, groesste Abweichung ${worst} % (Grenze 15 %).`)
console.log('docs/reports/map.md geschrieben.')
