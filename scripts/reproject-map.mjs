#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { anchorFor, drawableRings } from '../packages/mapgen/src/project.ts'

/**
 * Redraws the outlines in data/maps/world.json from data/maps/world-shapes.json
 * (T-M19-02).
 *
 * **Why this exists next to build-map.mjs.** The full pipeline starts at the Natural
 * Earth shapefiles under `data/geo/`, and those are not in the tree — `data/.gitignore`
 * holds `geo/`, and fetching them is the one place in this repository that reaches the
 * network. Running it would also re-run the enrichment, and *that* decides population,
 * terrain and deposits: the same numbers the balance was measured against, and the
 * numbers AK-1 depends on. Rebuilding the whole map to fix the drawing would put the
 * game at risk to repair a picture.
 *
 * So this script changes exactly the two fields that are pure drawing data, and copies
 * every other field through byte for byte:
 *
 *   polygon  ->  polygons   every piece of land, no longer only the largest ring
 *   center                  moved only where it did not lie on its own province
 *
 * It is **not** a second table of the truth: the projection and the ring selection come
 * from `packages/mapgen/src/project.ts`, the same functions `build-map.mjs` uses. A full
 * `pnpm map:build` on a machine with the geodata produces the same outlines.
 *
 * Usage:  node scripts/reproject-map.mjs [--check]
 *         --check  reports what would change and writes nothing (exit 1 if it differs)
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const check = process.argv.includes('--check')

const worldPath = join(ROOT, 'data/maps/world.json')
const world = JSON.parse(readFileSync(worldPath, 'utf8'))
const shapes = JSON.parse(readFileSync(join(ROOT, 'data/maps/world-shapes.json'), 'utf8'))

const geometryById = new Map(shapes.provinces.map((p) => [p.id, p.geometry]))

let movedAnchors = 0
let ringsBefore = 0
let ringsAfter = 0
let pointsBefore = 0
let pointsAfter = 0

const provinces = world.provinces.map((province) => {
  const geometry = geometryById.get(province.id)
  if (!geometry) {
    throw new Error(
      `${province.id} steht in world.json, aber nicht in world-shapes.json — die Quelle ist unvollstaendig.`,
    )
  }

  const polygons = drawableRings(geometry)
  if (polygons.length === 0) {
    throw new Error(`${province.id} traegt nach der Projektion keine einzige Flaeche.`)
  }

  const before = province.polygon ?? province.polygons?.flat() ?? []
  ringsBefore += province.polygon ? 1 : (province.polygons?.length ?? 0)
  ringsAfter += polygons.length
  pointsBefore += before.length
  pointsAfter += polygons.reduce((sum, ring) => sum + ring.length, 0)

  const anchor = anchorFor([province.center.x, province.center.y], polygons)
  const center = { x: anchor[0], y: anchor[1] }
  if (center.x !== province.center.x || center.y !== province.center.y) movedAnchors++

  // Every other field is carried over untouched — population, deposits, terrain and
  // kind decide the game, and this script must not have an opinion about them.
  const next = { ...province, center, polygons }
  delete next.polygon
  return next
})

const next = { ...world, provinces }
const text = JSON.stringify(next) + '\n'

console.log(`Umrisse:  ${ringsBefore} -> ${ringsAfter} Ringe`)
console.log(
  `Punkte:   ${pointsBefore} -> ${pointsAfter} ` +
    `(${pointsAfter >= pointsBefore ? '+' : ''}${(((pointsAfter - pointsBefore) / pointsBefore) * 100).toFixed(1)} %)`,
)
console.log(`Anker verschoben: ${movedAnchors} von ${provinces.length}`)

if (check) {
  const same = readFileSync(worldPath, 'utf8') === text
  console.log(same ? 'world.json ist auf dem Stand der Quelle.' : 'world.json weicht von der Quelle ab.')
  process.exit(same ? 0 : 1)
}

writeFileSync(worldPath, text)
console.log(`data/maps/world.json geschrieben (${(text.length / 1024 / 1024).toFixed(2)} MB).`)
