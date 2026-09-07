#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The playtest answer sheet (T-M14-15, AK-7).
 *
 * AK-7 was a fixed line reading "⏳ ausstehend" in the acceptance report — a criterion
 * that can never change state is not a criterion. It is the one thing no script can do
 * for Noah, but whether he has *answered* is perfectly checkable, and so is the rule
 * the task states: every question answered, and every "nein" carried into the findings
 * table. A no without a finding is the failure mode of every acceptance sheet ever
 * filled in — the tester notices something, ticks no, and the note never gets written.
 *
 * Usage:  node scripts/playtest-sheet.mjs           report the state
 *         node scripts/playtest-sheet.mjs --init    write/refresh the sheet, keeping answers
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SHEET = `${ROOT}docs/PLAYTEST.md`
const ANSWERS = `${ROOT}docs/reports/playtest-v1.md`

/** A numbered question row of docs/PLAYTEST.md: `| 26a | R-GAME-03 | … | |`. */
const QUESTION = /^\|\s*(\d+[a-z]?)\s*\|\s*(R-[A-Z]+-\d+)\s*\|\s*(.+?)\s*\|\s*\|?\s*$/

export function parseQuestions(text) {
  const out = []
  for (const line of text.split('\n')) {
    const match = QUESTION.exec(line)
    if (match) out.push({ nr: match[1], requirement: match[2], text: match[3] })
  }
  return out
}

/** An answer row of the report: `| 26a | R-GAME-03 | ja | … |`. */
const ANSWER = /^\|\s*(\d+[a-z]?)\s*\|\s*(R-[A-Z]+-\d+)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/

export function parseAnswers(text) {
  const out = new Map()
  for (const line of text.split('\n')) {
    const match = ANSWER.exec(line)
    if (match) out.set(match[1], { answer: match[3].toLowerCase(), note: match[4] })
  }
  return out
}

/** Every finding number named in the findings table, so a "nein" can be traced to one. */
export function parseFindings(text) {
  const table = text.slice(text.indexOf('## Befunde'))
  const out = []
  for (const line of table.split('\n')) {
    const match = /^\|\s*(\d+[a-z]?)\s*\|\s*([^|]*)\|/.exec(line)
    if (match && match[2].trim()) out.push(match[1])
  }
  return out
}

/**
 * The state of AK-7, as data.
 *
 * Deliberately a pure function over three texts: the acceptance script calls it with the
 * real files, the test calls it with invented ones. A check that can only read the real
 * world goes green the moment somebody fixes the world and proves nothing after that.
 */
/**
 * Wer den Bogen gefahren hat.
 *
 * AK-7 verlangt im Wortlaut **Noahs** Abnahme. Bis zum 2026-09-07 hat diese Datei nur
 * gezaehlt, ob jede Frage beantwortet ist — und der Abnahmebericht meldete daraufhin
 * "AK-7 beantwortet (60 Fragen)" mit einem Haken, obwohl der Durchgang am 2026-09-06
 * von einem Agenten stammt und die Antwortdatei das in ihrem eigenen Kopf sagt.
 *
 * Vollstaendigkeit ist pruefbar, Urheberschaft ist es nicht — aber die **Angabe** der
 * Urheberschaft ist es. Deshalb traegt der Bogen eine Zeile, die das Skript liest,
 * statt eines Satzes, ueber den es hinwegliest. Fehlt sie, gilt der Durchgang als
 * nicht von Noah: das ist die sichere Richtung des Fehlers.
 */
const SIGNATUR = /^\s*[*_]{0,2}Durchgang von[*_]{0,2}\s*:?\s*(.+?)\s*$/im

export function playtestAuthor(answerText) {
  const treffer = SIGNATUR.exec(answerText ?? String())
  const name = treffer ? treffer[1].replace(/[*_`]/g, '').trim() : ''
  return { name, isNoah: /^noah\b/i.test(name) }
}

export function playtestStatus(sheetText, answerText) {
  const questions = parseQuestions(sheetText)
  const answers = parseAnswers(answerText ?? '')
  const findings = new Set(parseFindings(answerText ?? ''))

  const unanswered = questions.filter((q) => !/^(ja|nein|n\.z\.)$/.test(answers.get(q.nr)?.answer ?? '')).map((q) => q.nr)

  const noWithoutFinding = questions
    .filter((q) => answers.get(q.nr)?.answer === 'nein' && !findings.has(q.nr))
    .map((q) => q.nr)

  const author = playtestAuthor(answerText)

  return {
    total: questions.length,
    answered: questions.length - unanswered.length,
    unanswered,
    noWithoutFinding,
    author: author.name,
    byNoah: author.isNoah,
    /** Vollstaendig ausgefuellt - sagt noch nicht, von wem. */
    complete: questions.length > 0 && unanswered.length === 0 && noWithoutFinding.length === 0,
    /** AK-7 im Wortlaut: vollstaendig UND von Noah. */
    ok:
      questions.length > 0 &&
      unanswered.length === 0 &&
      noWithoutFinding.length === 0 &&
      author.isNoah,
  }
}

/** The skeleton, with any answer already given carried over. */
export function renderSheet(sheetText, previous) {
  const answers = parseAnswers(previous ?? '')
  const questions = parseQuestions(sheetText)

  const rows = questions.map((q) => {
    const given = answers.get(q.nr)
    return `| ${q.nr} | ${q.requirement} | ${given?.answer ?? ''} | ${given?.note ?? ''} |`
  })

  const findings = (previous ?? '').includes('## Befunde')
    ? (previous ?? '').slice((previous ?? '').indexOf('## Befunde'))
    : ['## Befunde', '', '| Frage | Was | Wie schlimm |', '|---|---|---|', '| | | |', ''].join('\n')

  return [
    '# Playtest V1 — Noahs Antworten',
    '',
    '> Erzeugt von `node scripts/playtest-sheet.mjs --init` aus `docs/PLAYTEST.md`.',
    '> Fragen und Reihenfolge stehen dort; hier stehen nur die Antworten, damit beide',
    '> Dateien nicht auseinanderlaufen können. Läuft der Bogen weiter, den Befehl erneut',
    '> aufrufen — bereits gegebene Antworten bleiben stehen.',
    '',
    '**Durchgang von:** ',
    '',
    '> Die Zeile darueber liest `scripts/playtest-sheet.mjs`. AK-7 verlangt im Wortlaut',
    '> **Noahs** Abnahme - steht dort jemand anders oder niemand, gilt der Bogen als',
    '> ausgefuellt, aber nicht als abgenommen. Das ist die sichere Richtung des Fehlers.',
    '',
    `**Erlaubte Antworten:** \`ja\`, \`nein\`, \`n.z.\` (nicht zutreffend/nicht geprüft).`,
    `**Jedes \`nein\` braucht eine Zeile in der Befundtabelle unten**, mit derselben`,
    'Fragenummer — sonst gilt AK-7 als offen. Das ist die einzige Regel, die dieser Bogen',
    'sich selbst auferlegt, und sie ist die, an der Abnahmebögen sonst scheitern.',
    '',
    `**Fragen im Bogen:** ${questions.length}`,
    '',
    '| Frage | Anforderung | ja/nein | Anmerkung |',
    '|---|---|---|---|',
    ...rows,
    '',
    '---',
    '',
    '## Die drei Fragen, auf die es ankommt',
    '',
    '| | Antwort |',
    '|---|---|',
    '| A. Wollten Sie weiterspielen, als die 45 Minuten um waren? | |',
    '| B. Gab es einen Moment, in dem Sie gewartet haben, ohne es abkürzen zu können? | |',
    '| C. Hatten Sie das Gefühl, dass die KI schummelt? | |',
    '',
    'Erwartet: **ja / nein / nein.**',
    '',
    '---',
    '',
    findings.trimEnd(),
    '',
  ].join('\n')
}

function main() {
  const sheetText = readFileSync(SHEET, 'utf8')
  const previous = existsSync(ANSWERS) ? readFileSync(ANSWERS, 'utf8') : null

  if (process.argv.includes('--init')) {
    writeFileSync(ANSWERS, renderSheet(sheetText, previous))
    console.log(`docs/reports/playtest-v1.md geschrieben (${parseQuestions(sheetText).length} Fragen).`)
  }

  const status = playtestStatus(sheetText, previous ?? readFileSync(ANSWERS, 'utf8'))
  console.log(`AK-7: ${status.answered} von ${status.total} Fragen beantwortet.`)
  if (status.unanswered.length > 0) console.log(`  offen: ${status.unanswered.join(', ')}`)
  if (status.noWithoutFinding.length > 0) console.log(`  "nein" ohne Befund: ${status.noWithoutFinding.join(', ')}`)
  // Wer gefahren ist, gehoert in dieselbe Ausgabe wie die Zahl: sonst liest jemand
  // "60 von 60" und haelt AK-7 fuer erledigt - genau das ist am 2026-09-07 passiert.
  if (!status.byNoah) {
    console.log(
      status.author
        ? `  Durchgang von: ${status.author} - AK-7 verlangt Noahs Abnahme, also OFFEN.`
        : '  Keine Zeile "Durchgang von" im Bogen - AK-7 gilt damit als OFFEN.',
    )
  }
  process.exitCode = status.ok ? 0 : 1
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  main()
}
