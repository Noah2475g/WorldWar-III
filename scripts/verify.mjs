#!/usr/bin/env node
/**
 * Pflichtprüfung vor jedem Commit: lint + typecheck + test (ohne @slow) + Guards,
 * danach die Abdeckungsschwellen.
 *
 * Zwei bewusste Einschränkungen (siehe docs/plan/03-TASKS.md, T-M0-02):
 *  - Abdeckung wird nur für Pakete geprüft, die bereits Quellcode ausserhalb von
 *    src/index.ts haben. Sonst wäre keine Aufgabe abschliessbar, solange Pakete leer sind.
 *  - `coverage:requirements` gehört NICHT hierher. Dieses Tor ist bis zur letzten Aufgabe
 *    absichtlich rot und würde die gesamte Umsetzung blockieren.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const CORE_LINE_THRESHOLD = 90
const TOTAL_LINE_THRESHOLD = 80

function run(label, args) {
  process.stdout.write(`\n▶ ${label}\n`)
  const result = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit', shell: true })
  return result.status === 0
}

/** Source files that count towards coverage: no barrels, no type-only files, no tests. */
function sourceFiles(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      entry.name !== 'index.ts' &&
      entry.name !== 'types.ts'
    ) {
      out.push(full)
    }
  }
  return out
}

function packagesWithCode() {
  const base = join(root, 'packages')
  if (!existsSync(base)) return []
  return readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, files: sourceFiles(join(base, e.name, 'src')) }))
    .filter((p) => p.files.length > 0)
}

function checkCoverage() {
  const withCode = packagesWithCode()
  if (withCode.length === 0) {
    console.log('\n▶ Abdeckung: übersprungen — noch kein Paket mit Quellcode (T-M0-02).')
    return true
  }

  const summaryPath = join(root, 'coverage', 'coverage-summary.json')
  if (!existsSync(summaryPath)) {
    console.error('\n✖ Abdeckung: coverage/coverage-summary.json fehlt. Lief `pnpm coverage` durch?')
    return false
  }
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))

  const buckets = new Map() // package name -> { covered, total }
  for (const [file, data] of Object.entries(summary)) {
    if (file === 'total') continue
    const rel = relative(root, file)
    const parts = rel.split(sep)
    if (parts[0] !== 'packages' && parts[0] !== 'apps') continue
    const key = `${parts[0]}/${parts[1]}`
    const bucket = buckets.get(key) ?? { covered: 0, total: 0 }
    bucket.covered += data.lines.covered
    bucket.total += data.lines.total
    buckets.set(key, bucket)
  }

  const pct = (b) => (b.total === 0 ? 100 : (b.covered / b.total) * 100)
  let ok = true

  const core = buckets.get('packages/core')
  const coreHasCode = withCode.some((p) => p.name === 'core')
  if (coreHasCode) {
    const value = core ? pct(core) : 0
    const pass = value >= CORE_LINE_THRESHOLD
    console.log(`\n▶ Abdeckung Kern: ${value.toFixed(1)} % (Schwelle ${CORE_LINE_THRESHOLD} %) ${pass ? '✓' : '✖'}`)
    ok &&= pass
  } else {
    console.log('\n▶ Abdeckung Kern: übersprungen — packages/core hat noch keinen Quellcode.')
  }

  let covered = 0
  let total = 0
  for (const bucket of buckets.values()) {
    covered += bucket.covered
    total += bucket.total
  }
  const overall = total === 0 ? 100 : (covered / total) * 100
  const overallPass = overall >= TOTAL_LINE_THRESHOLD
  console.log(`▶ Abdeckung gesamt: ${overall.toFixed(1)} % (Schwelle ${TOTAL_LINE_THRESHOLD} %) ${overallPass ? '✓' : '✖'}`)
  ok &&= overallPass

  return ok
}

const steps = [
  ['Lint', ['lint']],
  ['Typprüfung', ['typecheck']],
  ['Tests + Guards (ohne @slow)', ['coverage']],
]

for (const [label, args] of steps) {
  if (!run(label, args)) {
    console.error(`\n✖ verify fehlgeschlagen bei: ${label}`)
    process.exit(1)
  }
}

if (!checkCoverage()) {
  console.error('\n✖ verify fehlgeschlagen: Abdeckungsschwelle unterschritten')
  process.exit(1)
}

console.log('\n✓ verify vollständig grün\n')
