#!/usr/bin/env node
/**
 * Abgleich Anforderungen <-> Tests (T-M0-04).
 *
 * Liest die Anforderungs-IDs aus docs/plan/01-REQUIREMENTS.md, den Umfang aus dem
 * `scope`-Block in Abschnitt 2.14 und die in Testnamen belegten IDs aus allen Testdateien.
 *
 * Auch aus *.test.tsx: die Oberflaeche wird in TSX getestet, und ein Tor, das genau die
 * Dateien uebersieht, in denen die UI-Anforderungen belegt werden, meldet Luecken, die
 * keine sind.
 *
 * Damit das keine reine Namenspruefung bleibt, zaehlt eine ID nur als abgedeckt, wenn der
 * zugehoerige describe-Block mindestens eine Zusicherung enthaelt und nicht uebersprungen ist.
 *
 * Dieses Tor ist absichtlich rot, solange Anforderungen offen sind. Es gehoert NICHT in
 * `pnpm verify`, sondern ist erst in T-M12-03 verpflichtend gruen.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse as parseYaml } from 'yaml'

const ID_PATTERN = /^- \*\*(R-[A-Z]+-\d{2})/gm
const DESCRIBE_PATTERN = /describe(?:\.skip)?\s*\(\s*['"`](R-[A-Z]+-\d{2})/g

/** Parse the requirements document: all IDs plus the machine-readable scope block. */
export function parseRequirements(text) {
  const ids = []
  for (const match of text.matchAll(ID_PATTERN)) ids.push(match[1])

  const scopeBlock = text.match(/```yaml\n(scope:[\s\S]*?)```/)
  const scope = scopeBlock ? (parseYaml(scopeBlock[1]).scope ?? {}) : {}

  return {
    ids: [...new Set(ids)],
    v2Only: new Set(scope.v2_only ?? []),
    partial: scope.v1_partial ?? {},
    testOnly: new Set(scope.test_only ?? []),
  }
}

/**
 * Which requirement IDs are backed by a describe block that actually asserts something?
 * `sources` is a list of { path, text }.
 */
export function parseTests(sources) {
  const covered = new Map()
  const hollow = new Map()

  for (const { path, text } of sources) {
    const matches = [...text.matchAll(DESCRIBE_PATTERN)]
    for (const [index, match] of matches.entries()) {
      const id = match[1]
      const block = text.slice(match.index, matches[index + 1]?.index ?? text.length)
      const skipped = /describe\.skip|it\.skip|test\.skip/.test(block)
      const asserts = /expect\s*\(/.test(block)
      const target = asserts && !skipped ? covered : hollow
      target.set(id, [...(target.get(id) ?? []), path])
    }
  }
  return { covered, hollow }
}

/** The full comparison. Pure: no file access, so it can be tested directly. */
export function analyse(requirementsText, sources) {
  const { ids, v2Only, partial, testOnly } = parseRequirements(requirementsText)
  const { covered, hollow } = parseTests(sources)

  const required = ids.filter((id) => !v2Only.has(id))
  const missing = required.filter((id) => !covered.has(id))
  // Nur echte Anforderungen: die Testdaten des Pruefskripts selbst enthalten erfundene
  // IDs (R-DEMO-*), und die als Luecke zu melden waere eine Falschmeldung ueber genau
  // das Werkzeug, das die Meldung erzeugt.
  const known = new Set(ids)
  const hollowOnly = [...hollow.keys()].filter((id) => known.has(id) && !covered.has(id))

  return { ids, required, missing, hollowOnly, v2Only, partial, testOnly, covered, hollow }
}

function collectTestFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage'].includes(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) collectTestFiles(full, out)
    else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) out.push(full)
  }
  return out
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const requirementsText = readFileSync(join(root, 'docs', 'plan', '01-REQUIREMENTS.md'), 'utf8')
  const sources = collectTestFiles(root).map((path) => ({
    path: relative(root, path),
    text: readFileSync(path, 'utf8'),
  }))

  const result = analyse(requirementsText, sources)

  console.log(`Anforderungen gesamt:       ${result.ids.length}`)
  console.log(
    `davon fuer V1 verpflichtend: ${result.required.length}  (V2-only uebersprungen: ${result.v2Only.size})`,
  )
  console.log(`mit belegtem Test:           ${result.required.length - result.missing.length}`)

  if (result.hollowOnly.length > 0) {
    console.log(`\nNur benannt, aber ohne Zusicherung oder uebersprungen:`)
    for (const id of result.hollowOnly) console.log(`  ${id}  (${result.hollow.get(id).join(', ')})`)
  }

  if (result.missing.length > 0) {
    console.log(`\nOffen (${result.missing.length}):`)
    for (const id of result.missing) {
      const note = result.testOnly.has(id)
        ? '  [nur Test, kein Produktionscode]'
        : result.partial[id]
          ? `  [teilweise V1: ${result.partial[id]}]`
          : ''
      console.log(`  ${id}${note}`)
    }
    console.log(`\n[x] Nicht alle V1-Anforderungen sind durch Tests belegt.`)
    process.exit(1)
  }

  console.log(`\n[ok] Jede V1-Anforderung ist durch mindestens einen Test belegt.`)
}

// pathToFileURL, not string surgery: on Windows a path becomes file:///C:/... with
// three slashes, and a hand-built comparison silently never matches — the script then
// exits 0 without doing anything, which is worse than failing.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
