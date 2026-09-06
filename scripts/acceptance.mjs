#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { playtestStatus } from './playtest-sheet.mjs'
import { CRITERIA, v1Failures } from './acceptance-criteria.mjs'

/**
 * Der Stand, gegen den dieser Lauf gelaufen ist (T-M16-01a).
 *
 * Ein Abnahmebericht ohne Commit ist nach der naechsten Reparatur eine Falschaussage,
 * die aussieht wie ein Messwert. Am 2026-09-06 meldete acceptance.md "AK-1
 * fehlgeschlagen, 5 von 7", waehrend fullgame.json daneben Spieltag 876 und einen
 * Sieger auswies: derselbe Tag, verschiedene Staende, und nichts in der Datei sagte es.
 */
function head() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return 'unbekannt'
  }
}

/**
 * The acceptance run (T-M12-03).
 *
 * Six of the seven criteria are machine-checkable, so they are checked rather than
 * asserted — each one runs its actual command and reports what came back. The seventh
 * is Noah's playtest, and no script can stand in for a person finding out whether the
 * game is worth playing.
 *
 * What a script *can* do, and since T-M14-15 does: say whether he has answered. AK-7
 * used to be a fixed line reading "⏳ ausstehend" — a criterion that cannot change state
 * is not a criterion, and this report would have printed it unchanged on the day after
 * the playtest. It now reads docs/reports/playtest-v1.md and counts.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const results = []

function run(id, description, command) {
  process.stdout.write(`${id}  ${description} … `)
  const started = Date.now()
  try {
    const output = execSync(command, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
    const seconds = ((Date.now() - started) / 1000).toFixed(0)
    console.log(`bestanden (${seconds}s)`)
    results.push({ id, description, ok: true, seconds: Number(seconds), output: output.slice(-400) })
    return output
  } catch (error) {
    const seconds = ((Date.now() - started) / 1000).toFixed(0)
    console.log(`FEHLGESCHLAGEN (${seconds}s)`)
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    results.push({ id, description, ok: false, seconds: Number(seconds), output: output.slice(-1200) })
    return output
  }
}

function check(id, description, condition, detail) {
  const ok = Boolean(condition)
  console.log(`${id}  ${description} … ${ok ? 'bestanden' : 'FEHLGESCHLAGEN'}`)
  results.push({ id, description, ok, detail })
  return ok
}

console.log('Abnahmelauf WorldWar V1\n')

run('AK-2/3', 'pnpm verify (Lint, Typen, Tests, Guards, Abdeckung)', 'pnpm verify')
run('AK-4/6', 'pnpm test:slow (Langläufe, Turnier, Budgets)', 'pnpm test:slow')

// AK-1 hat seit T-M14-14 eine eigene Zeile — vorher stand es in der Sammelzeile oben und
// wurde von keinem einzigen Test berührt: die einzigen `winner`-Zusicherungen im Bestand
// waren ein Zweispieler-Einheitstest und ein Determinismusvergleich. Das erste und
// wichtigste Abnahmekriterium galt als bestanden, weil daneben etwas anderes lief.
const fullgamePath = join(ROOT, 'docs/reports/fullgame.json')
if (existsSync(fullgamePath)) {
  const game = JSON.parse(readFileSync(fullgamePath, 'utf8'))
  check(
    'AK-1',
    `Vollständige Partie: ${game.ai} KI-Gegner, entschieden an Tag ${game.decidedOnDay ?? '—'}` +
      ` (${game.captures} Eroberungen, ${game.warDeclarations} Kriegserklärungen)`,
    game.decidedOnDay !== null && game.ai >= 4 && game.captures > 0,
    `Sieger ${game.winner ?? 'keiner'}`,
  )
} else {
  check('AK-1', 'Vollständige Partie: kein Bericht (pnpm sim:fullgame läuft nicht)', false)
}
const coverage = run('AK-2', 'pnpm coverage:requirements (Anforderungs-Tor)', 'pnpm coverage:requirements')

// AK-3: die gemessene Abdeckung aus dem letzten verify-Lauf.
const summaryPath = join(ROOT, 'coverage/coverage-summary.json')
if (existsSync(summaryPath)) {
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  const total = summary.total?.lines?.pct ?? 0
  check('AK-3', `Abdeckung gesamt ${total.toFixed(1)} % (Schwelle 80 %)`, total >= 80, `${total} %`)
}

// AK-2: jede V1-pflichtige Anforderung durch einen Test belegt.
//
// Genau eine Zeile, immer vorhanden (T-M14-01). Vorher waren es zwei Faelle — eine
// "Offen (n)"-Zeile bei Luecken, eine Erfolgsmeldung ohne Zahl bei null — und diese
// Doppelheuristik hat den Abnahmebericht schon einmal "unbekannt" melden lassen. Und
// weil "V1 offen" nur die V1-Pflicht zaehlt, haengt die Abnahme der V1 nicht mehr an
// den Anforderungen spaeterer Meilensteine.
const open = /^V1 offen: (\d+)$/m.exec(coverage)
const openCount = open ? Number(open[1]) : -1
check(
  'AK-2',
  `V1-Anforderungen ohne Test: ${openCount === -1 ? 'unbekannt (Zeile "V1 offen" fehlt)' : openCount}`,
  openCount === 0,
  `${openCount} offen`,
)

// AK-5: die beiden Guards, auf denen die Produktversprechen ruhen.
run('AK-5', 'Guards für Monetarisierung und Netzwerk', 'pnpm vitest run test/guards')

// AK-7: der Playtest. Gespielt wird er von Noah; gezählt wird hier.
const answersPath = join(ROOT, 'docs/reports/playtest-v1.md')
const playtest = playtestStatus(
  readFileSync(join(ROOT, 'docs/PLAYTEST.md'), 'utf8'),
  existsSync(answersPath) ? readFileSync(answersPath, 'utf8') : null,
)
const playtestLine = playtest.ok
  ? `✅ beantwortet (${playtest.total} Fragen)`
  : playtest.answered === 0
    ? `⏳ ausstehend (0 von ${playtest.total} Fragen beantwortet)`
    : `⏳ angefangen (${playtest.answered} von ${playtest.total}` +
      (playtest.noWithoutFinding.length > 0 ? `, „nein" ohne Befund: ${playtest.noWithoutFinding.join(', ')}` : '') +
      ')'

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok)

// T-M16-01: Was die V1-Abnahme rot faerbt, und was nicht.
//
// AK-8 gehoert zu M16, das ausdruecklich hinter der V1 liegt. Zaehlte es hier mit,
// hinge die Abnahme der V1 an einem spaeteren Bau - genau der Fehler des Nachtrags
// 2.15, der AK-2 unerfuellbar gemacht hat, bis T-M14-01 ihn reparierte. Die Zeile steht
// trotzdem im Bericht: eine Zusage ganz ohne Ort ist der andere Fehler derselben Art,
// und AK-8 war bis zum 2026-09-06 in genau dem Zustand.
const spaetere = CRITERIA.filter((c) => c.scope !== 'V1')
const v1Failed = v1Failures(results)

const report = [
  '# Abnahmelauf V1',
  '',
  `Erzeugt von \`scripts/acceptance.mjs\` am ${new Date().toISOString().slice(0, 10)} gegen \`${head()}\`.`,
  '',
  '> Dieser Bericht gilt fuer genau diesen Stand. Zeigt `git log --oneline -1` etwas',
  '> anderes, ist er ueberholt und keine Aussage ueber das Projekt (T-M16-01a).',
  '',
  '| Kriterium | Prüfung | Ergebnis |',
  '|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.description} | ${r.ok ? '✅ bestanden' : '❌ fehlgeschlagen'} |`),
  `| AK-7 | Playtest durch Noah nach \`docs/PLAYTEST.md\`, Antworten in \`docs/reports/playtest-v1.md\` | ${playtestLine} |`,
  ...spaetere.map(
    (c) =>
      `| ${c.id} | Verpackung als Programm, gemessen in T-M16-05 | ⏸ ${c.scope}, zaehlt nicht gegen V1 |`,
  ),
  '',
  `**${passed} von ${results.length} maschinellen Prüfungen bestanden.**`,
  '',
  failed.length > 0
    ? ['## Fehlgeschlagen', '', ...failed.map((r) => `### ${r.id}\n\n\`\`\`\n${r.output}\n\`\`\`\n`)].join('\n')
    : 'Alle maschinell prüfbaren Abnahmekriterien sind erfüllt. Offen bleibt AK-7 — der Playtest, für den kein Skript einspringen kann: ob das Spiel Spaß macht, findet nur ein Mensch heraus.',
  '',
].join('\n')

mkdirSync(join(ROOT, 'docs/reports'), { recursive: true })
writeFileSync(join(ROOT, 'docs/reports/acceptance.md'), report)

console.log(`\n${passed} von ${results.length} Prüfungen bestanden.`)
console.log('docs/reports/acceptance.md geschrieben.')
console.log(`\nAK-7: ${playtestLine} — Bogen docs/PLAYTEST.md, Antworten docs/reports/playtest-v1.md`)

for (const c of spaetere) {
  console.log(`${c.id}: ${c.scope}, zaehlt nicht gegen die V1-Abnahme (T-M16-01)`)
}

process.exit(v1Failed.length === 0 ? 0 : 1)
