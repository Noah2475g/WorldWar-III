#!/usr/bin/env node
import { open } from 'shapefile'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Lifts the attributes out of the shapefiles (T-M9-00).
 *
 * Only the attributes, not the geometry: the result is small enough to check in, and
 * that is the point — the curation tests then run for everyone, on every machine,
 * without anyone having to download 2 MB of shapefiles first. The geometry is read
 * later, by the steps that actually need it (T-M9-02a onwards).
 *
 * Natural Earth's DBF files are UTF-8 and pad every text field with NUL bytes. Both
 * have to be handled here, or the mis-decoded names end up printed on the map.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const GEO = join(ROOT, 'data', 'geo')
const OUT = join(ROOT, 'data', 'maps', 'raw-units.json')

const clean = (value) => (typeof value === 'string' ? value.replace(/\0/g, '').trim() : value)

async function readAll(shp, dbf) {
  const source = await open(shp, dbf, { encoding: 'utf8' })
  const rows = []
  for (let result = await source.read(); !result.done; result = await source.read()) {
    rows.push({
      properties: result.value.properties,
      areaKm2: areaOf(result.value.geometry),
      centre: centreOf(result.value.geometry),
    })
  }
  return rows
}

/**
 * Where a shape sits, as one point. Taken from the largest ring rather than from all
 * of them: France's centre must land in France, not in the Atlantic between it and
 * French Guiana.
 */
function centreOf(geometry) {
  if (!geometry) return { lat: 0, lon: 0 }
  const polygons =
    geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'Polygon' ? [geometry.coordinates] : []

  let best = null
  let bestArea = -1
  for (const polygon of polygons) {
    const ring = polygon[0]
    if (!ring) continue
    const area = ringAreaKm2(ring)
    if (area > bestArea) {
      bestArea = area
      best = ring
    }
  }
  if (!best) return { lat: 0, lon: 0 }

  let lon = 0
  let lat = 0
  for (const [x, y] of best) {
    lon += x
    lat += y
  }
  return {
    lon: Math.round((lon / best.length) * 1000) / 1000,
    lat: Math.round((lat / best.length) * 1000) / 1000,
  }
}

const EARTH_RADIUS_KM = 6371.0088
const toRadians = (degrees) => (degrees * Math.PI) / 180

/**
 * Area of a shape on the sphere, in square kilometres.
 *
 * Natural Earth ships no area field for countries, and the flat-earth answer is not
 * usable here: a degree square in Greenland covers a fraction of what one covers in
 * Kenya, so a planar sum would rank the Arctic as the largest place on the map.
 */
function areaOf(geometry) {
  if (!geometry) return 0
  const polygons =
    geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'Polygon' ? [geometry.coordinates] : []

  let total = 0
  for (const polygon of polygons) {
    // First ring is the outline, the rest are holes.
    polygon.forEach((ring, index) => {
      const ringArea = ringAreaKm2(ring)
      total += index === 0 ? ringArea : -ringArea
    })
  }
  return Math.round(total)
}

function ringAreaKm2(ring) {
  if (ring.length < 3) return 0
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i]
    const [lon2, lat2] = ring[(i + 1) % ring.length]
    sum += toRadians(lon2 - lon1) * (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)))
  }
  return Math.abs((sum * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2)
}

async function main() {
  const admin0 = await readAll(
    join(GEO, 'admin0', 'ne_10m_admin_0_countries.shp'),
    join(GEO, 'admin0', 'ne_10m_admin_0_countries.dbf'),
  )
  const admin1 = await readAll(
    join(GEO, 'admin1', 'ne_10m_admin_1_states_provinces.shp'),
    join(GEO, 'admin1', 'ne_10m_admin_1_states_provinces.dbf'),
  )

  const countries = admin0.map(({ properties: p, areaKm2 }) => ({
    iso: clean(p.ADM0_A3),
    name: clean(p.NAME),
    nameDe: clean(p.NAME_DE) || clean(p.NAME),
    population: Number(p.POP_EST) || 0,
    areaKm2,
    continent: clean(p.CONTINENT),
    type: clean(p.TYPE),
  }))

  const units = admin1.map(({ properties: p, areaKm2, centre }) => ({
    code: clean(p.adm1_code),
    countryIso: clean(p.adm0_a3),
    name: clean(p.name),
    nameDe: clean(p.name_de) || clean(p.name),
    region: clean(p.region) || '',
    areaKm2,
    lat: centre.lat,
    lon: centre.lon,
  }))

  await mkdir(join(ROOT, 'data', 'maps'), { recursive: true })
  await writeFile(OUT, JSON.stringify({ countries, units }, null, 1) + '\n')
  console.log(`${countries.length} Staaten und ${units.length} Verwaltungseinheiten nach data/maps/raw-units.json`)
}

main().catch((error) => {
  console.error(`Rohdaten konnten nicht gelesen werden: ${error.message}`)
  console.error('Liegen die Archive entpackt in data/geo/? Siehe scripts/fetch-geodata.mjs.')
  process.exit(1)
})
