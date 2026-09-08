/**
 * Which acceptance criteria exist, and which of them the V1 is judged by (T-M16-01).
 *
 * The reason this file exists is a promise that had no home. C-02 has said since
 * 2026-09-05 that the Tauri packaging is milestone M16 "mit eigenem Abnahmekriterium
 * AK-8" — and nothing looked for it: section 3 of the requirements listed AK-1 to AK-7,
 * and `acceptance.mjs` reported AK-1 to AK-5 and AK-7. That is cause A from the audit of
 * 2026-09-05, the promise never bound to the artefact, in the future tense: it only
 * becomes visibly wrong on the day somebody calls M16 finished.
 *
 * So the list lives here as data, both the acceptance run and the guard read it, and
 * `unhomedCriteria` fails in *both* directions — a criterion the requirements name and no
 * list carries, and a criterion in the list that no requirement names. A criterion
 * without a requirement is worth as little as a requirement without a criterion.
 *
 * The second thing this file settles is which criteria count. AK-8 belongs to M16, which
 * deliberately sits behind the V1; letting it count against the V1 acceptance would chain
 * that acceptance to a build that comes later. That is exactly the mistake the Nachtrag
 * 2.15 made, when an added line broke AK-2 and made the acceptance unreachable until
 * T-M14-01 repaired it. So `scope` says what a criterion is judged by, and `v1Failures`
 * looks at nothing else.
 */

/**
 * Every acceptance criterion, and what it is judged by.
 *
 * `scope: 'V1'` — part of the V1 definition of done (section 3 of the requirements).
 * `scope: '<milestone>'` — belongs to that milestone and does **not** count against V1.
 */
export const CRITERIA = [
  { id: 'AK-1', scope: 'V1' },
  { id: 'AK-2', scope: 'V1' },
  { id: 'AK-3', scope: 'V1' },
  { id: 'AK-4', scope: 'V1' },
  { id: 'AK-5', scope: 'V1' },
  { id: 'AK-6', scope: 'V1' },
  { id: 'AK-7', scope: 'V1' },
  { id: 'AK-8', scope: 'M16', report: 'docs/reports/packaging.md' },
]

/**
 * The criteria a requirements document defines — the rows of its acceptance tables,
 * not every mention. A criterion is *defined* where it stands in a table with its text;
 * C-02 mentioning AK-8 in prose is precisely what this check must not accept as a home.
 */
export function criteriaIn(requirementsText) {
  const ids = []
  for (const match of requirementsText.matchAll(/^\|\s*\*\*(AK-\d+)\*\*\s*\|/gm)) {
    if (!ids.includes(match[1])) ids.push(match[1])
  }
  return ids
}

/**
 * The two directions of the same binding.
 *
 * `ohneOrt` — the requirements define it and no acceptance list carries it. That was
 * AK-8 until today, except that AK-8 was not even defined: it was named in a constraint.
 * `ohneKriterium` — a list carries it and the requirements define it nowhere.
 * `nurErwaehnt` — named in the prose (a constraint, a rationale) but defined in no table.
 * That is the state a promise is in while it still has no home, and the state AK-8 was in.
 */
export function unhomedCriteria(requirementsText, criteria = CRITERIA) {
  const defined = criteriaIn(requirementsText)
  const listed = criteria.map((c) => c.id)

  const mentioned = []
  for (const match of requirementsText.matchAll(/\bAK-\d+\b/g)) {
    if (!mentioned.includes(match[0])) mentioned.push(match[0])
  }

  return {
    ohneOrt: defined.filter((id) => !listed.includes(id)),
    ohneKriterium: listed.filter((id) => !defined.includes(id)),
    nurErwaehnt: mentioned.filter((id) => !defined.includes(id)),
  }
}

/**
 * The criteria an id from the acceptance run stands for. The run groups checks that share
 * one command, so an id may read `AK-2/3` or `AK-4/6` — one line, two criteria.
 */
export function criteriaOf(reportId) {
  const match = /^AK-([\d/]+)$/.exec(reportId)
  if (!match) return []
  return match[1].split('/').map((number) => `AK-${number}`)
}

/** True when this result is judged by the V1 acceptance. */
export function countsForV1(reportId, criteria = CRITERIA) {
  const v1 = new Set(criteria.filter((c) => c.scope === 'V1').map((c) => c.id))
  return criteriaOf(reportId).some((id) => v1.has(id))
}

/**
 * The failures the V1 acceptance is judged by — and nothing else. A failing M16 criterion
 * appears in the report and leaves the exit code alone; that is the whole point of the
 * separation, and it is a function so that it can be shown rather than claimed.
 */
export function v1Failures(results, criteria = CRITERIA) {
  return results.filter((result) => !result.ok && countsForV1(result.id, criteria))
}

/**
 * Was die Messung eines Kriteriums sagt - Datum und Commit, aus ihrem eigenen Bericht.
 *
 * Gelesen wird die Kopfzeile des Berichts, nicht ein Vermerk daneben: ein Bericht, der
 * seinen Stand nicht nennt, ist keine Messung, und einer gegen einen anderen Commit ist
 * eine Messung von etwas anderem. Dieselbe Regel wie fuer acceptance.md seit T-M16-01a.
 */
export function measurementOf(criterion, readFile, head) {
  if (!criterion.report) return null
  let text
  try {
    text = readFile(criterion.report)
  } catch {
    return { state: 'fehlt', file: criterion.report }
  }
  const stamp = /Gemessen am [*][*]([0-9]{4}-[0-9]{2}-[0-9]{2})[*][*] gegen `([0-9a-f]+)`/.exec(text)
  if (!stamp) return { state: 'ohne Stempel', file: criterion.report }
  const [, date, commit] = stamp
  const passt = head.startsWith(commit) || commit.startsWith(head)
  return {
    state: passt ? 'gemessen' : 'ueberholt',
    date,
    commit,
    file: criterion.report,
  }
}

/**
 * Ob eine Messung trotz aelterem Stand noch gilt.
 *
 * Der strenge Vergleich auf den Commit ist richtig und trotzdem zu grob: er meldet eine
 * Messung als ueberholt, sobald jemand ein Dokument angefasst hat. Beim Abschlusslauf am
 * 2026-09-07 war genau das der Fall — zwischen der AK-8-Messung und dem Bericht lagen
 * nur Tests, Berichte und Plandateien, keine Zeile, die ins Erzeugnis geht.
 *
 * Statt das wegzuerklaeren, sieht der Bericht nach. Was zaehlt, ist ausgeliefertes
 * Gut: Quellcode, Regeln, Karten, die Huelle. Was nicht zaehlt, kommt im Programm nicht
 * vor — und die Liste ist absichtlich kurz und positiv formuliert, damit eine neue Art
 * von Datei im Zweifel als **relevant** gilt.
 */
export function artefactUnchangedSince(commit, changedFiles) {
  /** Ordner, deren Inhalt ins Erzeugnis geht. */
  // scripts/ steht bewusst NICHT hier: ein Skript geht nicht ins Programm. Was es
  //   erzeugt, liegt unter data/ und ist damit erfasst.
  const LIEFERT = ['apps/', 'packages/', 'data/']
  /** Und was darin trotzdem nur die Werkbank betrifft. */
  const WERKBANK = ['/test/', '.test.', '.bench.', '.slow.']

  const relevant = changedFiles.filter((file) => {
    if (!file) return false
    if (file.startsWith('docs/') || file.startsWith('test/')) return false
    if (WERKBANK.some((teil) => file.includes(teil))) return false
    return LIEFERT.some((ordner) => file.startsWith(ordner))
  })
  return { unchanged: relevant.length === 0, relevant, commit }
}

/**
 * Frische der Balancing-Messgeraete (2026-09-08, DECISIONS.md).
 *
 * Die Abnahme faehrt Parameterlauf und Turnier nicht mehr mit - sie sind
 * Messgeraete, keine Kriterien, und kosteten den Loewenanteil der 75-130 Minuten.
 * Damit sie nicht still veralten, prueft die Abnahme stattdessen: ist der Bericht
 * des Messgeraets aelter als die letzte Aenderung an den Regeldateien, ist die
 * Abnahme rot. Alle Unbekannten zaehlen als veraltet - die sichere Richtung.
 *
 * Zeiten sind Commit-Zeitstempel (git log -1 --format=%ct -- <pfad>), keine
 * Datei-mtimes: ein checkout setzt mtimes neu und wuerde jedes Urteil verwischen.
 */
export function gaugeStatus({ rulesChangedAt, gaugeChangedAt, rulesDirty }) {
  if (rulesDirty) return { fresh: false, reason: 'uncommittete Aenderungen unter data/rules - erst committen, dann messen' }
  if (!gaugeChangedAt) return { fresh: false, reason: 'kein Bericht mit Stand gefunden' }
  if (!rulesChangedAt) return { fresh: false, reason: 'Regelstand unbekannt (git antwortet nicht)' }
  return rulesChangedAt <= gaugeChangedAt
    ? { fresh: true, reason: 'Bericht ist juenger als die letzte Regelaenderung' }
    : { fresh: false, reason: 'Regeln sind juenger als der Bericht des Messgeraets' }
}
