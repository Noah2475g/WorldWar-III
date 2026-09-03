#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Fetches the raw geography for the map pipeline (T-M9-01).
 *
 * This is the one place in the repository that reaches the network, and it lives in
 * scripts/ rather than in packages/ on purpose: the guard in test/guards/no-network
 * watches the packages, because the *game* must never phone home (R-FREE-04). Building
 * the map is a developer's errand, run once, its result checked in (design D-09).
 *
 * Usage:  node scripts/fetch-geodata.mjs [--force]
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TARGET = join(ROOT, 'data', 'geo')

// Mirrors packages/mapgen/src/sources.ts. The test there keeps docs/ASSETS.md honest;
// this list is kept short deliberately — adding a source means adding it in both places
// and saying where it came from.
const SOURCES = [
  ['admin1', 'https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip'],
  ['admin0', 'https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip'],
  ['ocean', 'https://naciscdn.org/naturalearth/10m/physical/ne_10m_ocean.zip'],
]

const force = process.argv.includes('--force')

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  await mkdir(TARGET, { recursive: true })
  const report = []

  for (const [id, url] of SOURCES) {
    const file = join(TARGET, `${id}.zip`)

    if (!force && (await exists(file))) {
      console.log(`  ${id}: liegt bereits vor (--force lädt neu)`)
      continue
    }

    process.stdout.write(`  ${id}: lade ${url} … `)
    const response = await globalThis.fetch(url)
    if (!response.ok) {
      throw new Error(`${url} antwortete mit ${response.status} ${response.statusText}`)
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    await writeFile(file, bytes)

    const sha = createHash('sha256').update(bytes).digest('hex')
    report.push({ id, bytes: bytes.length, sha256: sha })
    console.log(`${(bytes.length / 1024).toFixed(0)} kB`)
  }

  if (report.length > 0) {
    await writeFile(
      join(TARGET, 'checksums.json'),
      JSON.stringify({ fetchedAt: new Date().toISOString(), files: report }, null, 2) + '\n',
    )
    console.log('\nPrüfsummen in data/geo/checksums.json festgehalten.')
  }
  console.log('Lizenz: gemeinfrei (Natural Earth). Siehe docs/ASSETS.md.')
}

main().catch((error) => {
  console.error(`\nGeodaten konnten nicht geladen werden: ${error.message}`)
  process.exit(1)
})
