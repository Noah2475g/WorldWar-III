#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The acceptance run (T-M12-03).
 *
 * Six of the seven criteria are machine-checkable, so they are checked rather than
 * asserted — each one runs its actual command and reports what came back. The seventh
 * is Noah's playtest, and no script can stand in for a person finding out whether the
 * game is worth playing.
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
run('AK-1/4/6', 'pnpm test:slow (Langläufe, Turnier, Budgets)', 'pnpm test:slow')
const coverage = run('AK-2', 'pnpm coverage:requirements (Anforderungs-Tor)', 'pnpm coverage:requirements')

// AK-3: die gemessene Abdeckung aus dem letzten verify-Lauf.
const summaryPath = join(ROOT, 'coverage/coverage-summary.json')
if (existsSync(summaryPath)) {
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
  const total = summary.total?.lines?.pct ?? 0
  check('AK-3', `Abdeckung gesamt ${total.toFixed(1)} % (Schwelle 80 %)`, total >= 80, `${total} %`)
}

// AK-2: jede V1-Anforderung durch einen Test belegt.
const open = /Offen \((\d+)\)/.exec(coverage)
const openCount = open ? Number(open[1]) : -1
check(
  'AK-2',
  `Anforderungen ohne Test: ${openCount === -1 ? 'unbekannt' : openCount}`,
  openCount === 0,
  `${openCount} offen`,
)

// AK-5: die beiden Guards, auf denen die Produktversprechen ruhen.
run('AK-5', 'Guards für Monetarisierung und Netzwerk', 'pnpm vitest run test/guards')

const passed = results.filter((r) => r.ok).length
const failed = results.filter((r) => !r.ok)

const report = [
  '# Abnahmelauf V1',
  '',
  `Erzeugt von \`scripts/acceptance.mjs\` am ${new Date().toISOString().slice(0, 10)}.`,
  '',
  '| Kriterium | Prüfung | Ergebnis |',
  '|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.description} | ${r.ok ? '✅ bestanden' : '❌ fehlgeschlagen'} |`),
  `| AK-7 | Playtest durch Noah nach \`docs/PLAYTEST.md\` | ⏳ ausstehend |`,
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
console.log('\nOffen bleibt AK-7: der Playtest nach docs/PLAYTEST.md.')

process.exit(failed.length === 0 ? 0 : 1)
