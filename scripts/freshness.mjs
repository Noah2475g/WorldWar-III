import { execFileSync } from 'node:child_process'
import { GAUGES, STANCE_REPORT, STANCE_SOURCES, gaugeStatus, stanceReportStatus } from './acceptance-criteria.mjs'

/**
 * Was git ueber die Frische der Messgeraete sagt (T-M40-17) — die Seite der Waechter, die fragt.
 *
 * Die Urteile stehen als reine Funktionen in `acceptance-criteria.mjs`; hier werden nur ihre Eingaben
 * gesammelt. Getrennt, damit `test/requirements.test.ts` dieselben Aufrufe gegen ein Wegwerf-Repo mit dem
 * Merge aus Befund M-1 fahren kann, und damit man die Waechter am echten Stand direkt aufrufen kann, ohne
 * den ganzen Abnahmelauf:
 *
 *   node --input-type=module -e "const m = await import('./scripts/freshness.mjs'); console.log(m.allFreshness('.'))"
 *
 * Jede Frage, auf die git nicht antwortet, kommt als `null` zurueck, und die Urteile lesen `null` als
 * veraltet — die sichere Richtung.
 */

/** git ohne geerbte GIT_*-Variablen: aus einem Hook heraus zeigten sie sonst auf ein anderes Repo. */
function run(cwd, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
  return execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
}

function git(cwd, args) {
  try {
    return run(cwd, args).trim()
  } catch {
    return null
  }
}

/** Nur eine Commit-Kennung geht als Argument an git — nie ein Text aus einer Datei, der wie eine Option aussieht. */
const isCommitId = (value) => typeof value === 'string' && /^[0-9a-f]{7,40}$/.test(value)

/**
 * Commits auf `head`, die `since` nicht enthaelt und die einen der Pfade aendern (hoechstens einer).
 *
 * `git rev-list -1 <since>..<head> -- <pfade>` mit der normalen Vereinfachung der Geschichte: gleicht ein
 * Merge fuer die Pfade einem Elternteil, folgt git nur diesem — genau dem, dessen Inhalt HEAD traegt.
 */
export function commitsSince(cwd, since, paths, head = 'HEAD') {
  if (!isCommitId(since)) return null
  const out = git(cwd, ['rev-list', '-1', `${since}..${head}`, '--', ...paths])
  return out === null ? null : out.split(/\r?\n/).filter(Boolean)
}

/** Ob `commit` in der Geschichte von `head` liegt; `null`, wenn git es nicht sagen kann. */
export function isAncestor(cwd, commit, head = 'HEAD') {
  if (!isCommitId(commit)) return null
  try {
    run(cwd, ['merge-base', '--is-ancestor', commit, head])
    return true
  } catch (error) {
    return error && typeof error === 'object' && 'status' in error && error.status === 1 ? false : null
  }
}

/** Ob unter den Pfaden etwas uncommittet ist (auch Unversioniertes); `null`, wenn git nicht antwortet. */
export function dirtyUnder(cwd, paths) {
  const out = git(cwd, ['status', '--porcelain', '--untracked-files=all', '--', ...paths])
  return out === null ? null : out.length > 0
}

/** Der letzte Commit auf `head`, der den Pfad aendert — derjenige, dessen Inhalt HEAD traegt. */
export function lastCommitOf(cwd, path, head = 'HEAD') {
  const out = git(cwd, ['log', '-1', '--format=%H', head, '--', path])
  return out ? out : null
}

/** Frische eines Messgeraets aus `GAUGES`: seit dem Commit seines Berichts kein Commit an seinen Quellen. */
export function gaugeFreshness(cwd, gauge, head = 'HEAD') {
  const reportCommit = lastCommitOf(cwd, gauge.report, head)
  return gaugeStatus({
    sources: gauge.sources,
    sourcesDirty: dirtyUnder(cwd, gauge.sources),
    reportCommit,
    commitsSinceReport: reportCommit ? commitsSince(cwd, reportCommit, gauge.sources, head) : null,
  })
}

/** Frische des Haltungs-Messlaufs: gelesen wird der eingecheckte Bericht auf `head`, nicht die Datei im Arbeitsbaum. */
export function stanceFreshness(cwd, head = 'HEAD') {
  let report = null
  try {
    report = JSON.parse(git(cwd, ['show', `${head}:${STANCE_REPORT}`]) ?? '').episoden?.nachher ?? null
  } catch {
    report = null
  }
  const commit = report?.measuredAtCommit
  return stanceReportStatus({
    report,
    sourcesDirty: dirtyUnder(cwd, STANCE_SOURCES),
    measuredAtIsAncestor: isCommitId(commit) ? isAncestor(cwd, commit, head) : null,
    commitsSinceMeasurement: isCommitId(commit) ? commitsSince(cwd, commit, STANCE_SOURCES, head) : null,
  })
}

/** Alle drei Waechter in der Reihenfolge der Abnahme — fuer den Aufruf am echten Stand. */
export function allFreshness(cwd, head = 'HEAD') {
  return [
    ...GAUGES.map((gauge) => ({ name: gauge.name, ...gaugeFreshness(cwd, gauge, head) })),
    { name: 'Haltungs-Messlauf', ...stanceFreshness(cwd, head) },
  ]
}
