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
const DESCRIBE_PATTERN = /describe(?:\.skip)?\s*\(\s*['"`](R-[A-Z]+-\d{2}(?:\/AK\d+)?)/g
/** Acceptance criteria as the document writes them: a list item starting "AK<n>:". */
const CRITERION_PATTERN = /^\s*-\s*(AK\d+)\s*:/gm

/** Parse the requirements document: all IDs plus the machine-readable scope block. */
export function parseRequirements(text) {
  const ids = []
  const positions = []
  for (const match of text.matchAll(ID_PATTERN)) {
    ids.push(match[1])
    positions.push({ id: match[1], at: match.index })
  }

  // Which acceptance criteria does each requirement carry? Everything between this
  // requirement's heading and the next one belongs to it.
  const criteria = {}
  for (const [index, entry] of positions.entries()) {
    const until = positions[index + 1]?.at ?? text.length
    const block = text.slice(entry.at, until)
    const found = [...block.matchAll(CRITERION_PATTERN)].map((m) => m[1])
    if (found.length > 0) criteria[entry.id] = [...new Set(found)]
  }

  const scopeBlock = text.match(/```yaml\n(scope:[\s\S]*?)```/)
  const scope = scopeBlock ? (parseYaml(scopeBlock[1]).scope ?? {}) : {}

  return {
    ids: [...new Set(ids)],
    criteria,
    v2Only: new Set(scope.v2_only ?? []),
    later: scope.later ?? {},
    partial: scope.v1_partial ?? {},
    testOnly: new Set(scope.test_only ?? []),
    nameLevel: new Set(scope.name_level ?? []),
  }
}

/**
 * Every `later` entry costs two statements: a milestone the task plan knows, and a reason.
 *
 * The point is the direction of the failure. A requirement that names no milestone stays
 * V1 and turns the gate red; only a written, checkable entry moves it out of V1. On
 * 2026-09-04 the opposite direction cost the project its gate: eighteen IDs were added to
 * section 2 and the scope block was not touched, so a documentation change alone took the
 * run from 82/82 to 82/100 — and the acceptance criterion that depends on it with it.
 */
export function checkScope(later, knownIds, milestones) {
  const errors = []
  for (const [id, value] of Object.entries(later)) {
    if (!knownIds.has(id)) {
      errors.push(`${id}: steht im scope-Block, aber in Abschnitt 2 gibt es die Anforderung nicht.`)
      continue
    }
    const parts = String(value).split('—')
    const milestone = parts[0]?.trim()
    const reason = parts.slice(1).join('—').trim()
    if (!milestone || parts.length < 2 || !reason) {
      errors.push(
        `${id}: der later-Eintrag braucht "<Meilenstein> — <Begruendung>", steht aber als "${value}".`,
      )
      continue
    }
    if (!milestones.has(milestone)) {
      errors.push(
        `${id}: nennt den Meilenstein ${milestone}, den tasks.yaml nicht deklariert.`,
      )
    }
  }
  return errors
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
      const label = match[1]
      const block = text.slice(match.index, matches[index + 1]?.index ?? text.length)
      const skipped = /describe\.skip|it\.skip|test\.skip/.test(block)
      const asserts = /expect\s*\(/.test(block)
      const target = asserts && !skipped ? covered : hollow

      // `describe('R-DIP-06/AK1 …')` belegt beides: das Kriterium und — auf der alten,
      // groberen Ebene — die Anforderung selbst. Sonst müsste jede Datei ihre ID zweimal
      // nennen, und der Umstieg auf Kriterien wäre ein Bruch statt eines Übergangs.
      const both = label.includes('/') ? [label, label.split('/')[0]] : [label]
      for (const id of both) target.set(id, [...(target.get(id) ?? []), path])
    }
  }
  return { covered, hollow }
}

/** The full comparison. Pure: no file access, so it can be tested directly. */
export function analyse(requirementsText, sources, milestones = new Set(), options = {}) {
  const { ids, criteria, v2Only, later, partial, testOnly, nameLevel } =
    parseRequirements(requirementsText)
  const { covered, hollow } = parseTests(sources)

  const known = new Set(ids)
  const scopeErrors = checkScope(later, known, milestones)

  // V1 duty is what is left over: not shipped to V2, not assigned to a later milestone.
  // An ID in no drawer at all stays V1 — silence never defers anything.
  const required = ids.filter((id) => !v2Only.has(id) && !(id in later))

  // Counting by acceptance criterion (T-M14-02b). `strictFrom` names the IDs held to the
  // new standard; everything else stays on the old name-level booking. That set is a debt
  // with a name — it may only shrink, and a test says so.
  const strictFrom = options.strictFrom ?? new Set(required.filter((id) => !nameLevel.has(id)))
  const missingCriteria = []
  for (const id of required) {
    if (!strictFrom.has(id)) continue
    const wanted = criteria[id]
    if (!wanted?.length) continue
    const fehlend = wanted.filter((ak) => !covered.has(`${id}/${ak}`))
    if (fehlend.length > 0) missingCriteria.push({ id, fehlend })
  }
  const unterKriterien = new Set(missingCriteria.map((m) => m.id))

  const missing = required.filter((id) => !covered.has(id) || unterKriterien.has(id))

  // Later milestones are progress, never a gate: they must not colour the run red.
  const progress = new Map()
  for (const [id, value] of Object.entries(later)) {
    if (!known.has(id)) continue
    const milestone = String(value).split('—')[0]?.trim() ?? '?'
    const entry = progress.get(milestone) ?? { total: 0, covered: 0, ids: [] }
    entry.total += 1
    if (covered.has(id)) entry.covered += 1
    entry.ids.push(id)
    progress.set(milestone, entry)
  }
  // Nur echte Anforderungen: die Testdaten des Pruefskripts selbst enthalten erfundene
  // IDs (R-DEMO-*), und die als Luecke zu melden waere eine Falschmeldung ueber genau
  // das Werkzeug, das die Meldung erzeugt.
  const hollowOnly = [...hollow.keys()].filter((id) => known.has(id) && !covered.has(id))

  return {
    ids,
    criteria,
    required,
    missing,
    missingCriteria,
    hollowOnly,
    v2Only,
    later,
    progress,
    scopeErrors,
    partial,
    testOnly,
    nameLevel,
    covered,
    hollow,
  }
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

/** Which milestones does the task plan declare? A `later` entry may name no other. */
export function declaredMilestones(root) {
  const text = readFileSync(join(root, 'docs', 'plan', 'tasks.yaml'), 'utf8')
  const plan = parseYaml(text)
  return new Set((plan.milestones ?? []).map((m) => m.id))
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const requirementsText = readFileSync(join(root, 'docs', 'plan', '01-REQUIREMENTS.md'), 'utf8')
  const sources = collectTestFiles(root).map((path) => ({
    path: relative(root, path),
    text: readFileSync(path, 'utf8'),
  }))

  const result = analyse(requirementsText, sources, declaredMilestones(root))

  console.log(`Anforderungen gesamt:       ${result.ids.length}`)
  console.log(
    `davon fuer V1 verpflichtend: ${result.required.length}  (V2-only uebersprungen: ${result.v2Only.size}, spaetere Meilensteine: ${Object.keys(result.later).length})`,
  )
  console.log(`mit belegtem Test:           ${result.required.length - result.missing.length}`)

  if (result.hollowOnly.length > 0) {
    console.log(`\nNur benannt, aber ohne Zusicherung oder uebersprungen:`)
    for (const id of result.hollowOnly) console.log(`  ${id}  (${result.hollow.get(id).join(', ')})`)
  }

  console.log(
    `davon je Akzeptanzkriterium geprueft: ${result.required.length - result.nameLevel.size}  (Uebergangsliste: ${result.nameLevel.size} auf Namensebene)`,
  )

  if (result.missing.length > 0) {
    console.log(`\nOffen:`)
    for (const id of result.missing) {
      const fehlend = result.missingCriteria.find((m) => m.id === id)
      const note = fehlend
        ? `  [Kriterien ohne Test: ${fehlend.fehlend.join(', ')}]`
        : result.testOnly.has(id)
          ? '  [nur Test, kein Produktionscode]'
          : result.partial[id]
            ? `  [teilweise V1: ${result.partial[id]}]`
            : ''
      console.log(`  ${id}${note}`)
    }
  }

  // Fortschritt der spaeteren Meilensteine — ausdruecklich kein Tor. Ein Meilenstein,
  // der noch nicht gebaut ist, darf die Abnahme der V1 nicht aufhalten; genau daran
  // haengt seit dem 2026-09-04 T-M12-03.
  if (result.progress.size > 0) {
    console.log('')
    for (const milestone of [...result.progress.keys()].sort()) {
      const { total, covered } = result.progress.get(milestone)
      console.log(`${milestone}: ${covered} von ${total} belegt (Fortschritt, kein Tor)`)
    }
  }

  if (result.scopeErrors.length > 0) {
    console.log(`\nFehler im scope-Block:`)
    for (const error of result.scopeErrors) console.log(`  ${error}`)
  }

  // Die eine Zeile, auf die sich jeder Leser verlassen kann — auch bei null. Vorher
  // musste man aus der Abwesenheit einer "Offen (n)"-Zeile auf Erfolg schliessen, und
  // diese Doppelheuristik hat den Abnahmebericht schon einmal "unbekannt" melden lassen.
  console.log(`\nV1 offen: ${result.missing.length}`)

  if (result.missing.length > 0 || result.scopeErrors.length > 0) {
    console.log(
      result.scopeErrors.length > 0
        ? '[x] Der scope-Block ist fehlerhaft.'
        : '[x] Nicht alle V1-Anforderungen sind durch Tests belegt.',
    )
    process.exit(1)
  }

  console.log(`[ok] Jede V1-Anforderung ist durch mindestens einen Test belegt.`)
}

// pathToFileURL, not string surgery: on Windows a path becomes file:///C:/... with
// three slashes, and a hand-built comparison silently never matches — the script then
// exits 0 without doing anything, which is worse than failing.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
}
