#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Fetches the interface font once and checks it in (T-M14-09).
 *
 * Unlike the geodata, the *result* of this errand ships: four `.woff2` cuts plus the
 * licence live under `apps/desktop/src/ui/fonts/` and are loaded by `app.css` with a
 * relative `url()`. That is the point — the game must look the same on a machine that
 * has never heard of IBM Plex, and it must not reach the network to do so (R-FREE-04).
 *
 * So this script is not needed to build or run the game. It exists to make the origin
 * reproducible: source, licence and a checksum per file. Running it a second time must
 * either produce the same bytes or fail loudly.
 *
 * Usage:  node scripts/fetch-fonts.mjs [--force] [--check]
 *           --force  overwrite files that already exist
 *           --check  verify the checked-in files against the checksums, download nothing
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TARGET = join(ROOT, 'apps', 'desktop', 'src', 'ui', 'fonts')

/**
 * IBM Plex, SIL Open Font License 1.1 — https://github.com/IBM/plex
 *
 * Pinned to a tag, never to a branch: `main` would hand back different bytes next month
 * and the checksums below would be noise. The cuts are the three families `TYPE` asks
 * for, in the weights the interface actually sets — Regular and SemiBold for the sans,
 * SemiBold for the condensed map lettering, Regular for the figures.
 */
const TAG = 'v6.4.0'
const BASE = `https://raw.githubusercontent.com/IBM/plex/${TAG}`
const LICENCE = 'SIL Open Font License 1.1'

const FILES = [
  [
    'IBMPlexSans-Regular.woff2',
    `${BASE}/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-Regular.woff2`,
    'ba711a3085ff9f27440b6b9c4550cfc47c97bf36591d5da958b975bb3add8c1a',
  ],
  [
    'IBMPlexSans-SemiBold.woff2',
    `${BASE}/IBM-Plex-Sans/fonts/complete/woff2/IBMPlexSans-SemiBold.woff2`,
    'f78048030eab62e860efa39a0df79e2e5581bf122eb95b9bc42c0b8a4988d205',
  ],
  [
    'IBMPlexSansCondensed-SemiBold.woff2',
    `${BASE}/IBM-Plex-Sans-Condensed/fonts/complete/woff2/IBMPlexSansCondensed-SemiBold.woff2`,
    'ec28b4f7f62878e81f86936dee2c49dd688bf0a654469e088d5cb758ee1fbbff',
  ],
  [
    'IBMPlexMono-Regular.woff2',
    `${BASE}/IBM-Plex-Mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2`,
    '49ce58b41a0e1cb921c0f58d9a5b8b96a2cc21437c7066f3ba4f24873076d131',
  ],
  ['OFL.txt', `${BASE}/LICENSE.txt`, '7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da'],
]

const force = process.argv.includes('--force')
const checkOnly = process.argv.includes('--check')

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  console.log(`IBM Plex ${TAG} — ${LICENCE} — ${BASE}`)
  await mkdir(TARGET, { recursive: true })

  let bytesTotal = 0

  for (const [name, url, expected] of FILES) {
    const file = join(TARGET, name)

    let bytes
    if (checkOnly || (!force && (await exists(file)))) {
      if (!(await exists(file))) {
        throw new Error(`${name} fehlt — ohne --check laedt der Lauf sie nach`)
      }
      bytes = await readFile(file)
    } else {
      process.stdout.write(`  ${name}: lade … `)
      const response = await globalThis.fetch(url)
      if (!response.ok) {
        throw new Error(`${url} antwortete mit ${response.status} ${response.statusText}`)
      }
      bytes = Buffer.from(await response.arrayBuffer())
      await writeFile(file, bytes)
      process.stdout.write('ok\n')
    }

    const actual = sha256(bytes)
    if (actual !== expected) {
      throw new Error(`${name}: Pruefsumme ${actual}, erwartet ${expected}`)
    }
    if (name.endsWith('.woff2')) bytesTotal += bytes.length

    console.log(`  ${name.padEnd(36)} ${(bytes.length / 1024).toFixed(1).padStart(6)} kB  ${actual.slice(0, 12)}…`)
  }

  console.log(`\n  Schriftdateien zusammen: ${(bytesTotal / 1024).toFixed(1)} kB`)
  console.log('  Herkunft und Lizenz stehen in docs/ASSETS.md; die Dateien sind eingecheckt.')
}

main().catch((error) => {
  console.error(`\nFehlgeschlagen: ${error.message}`)
  process.exitCode = 1
})
