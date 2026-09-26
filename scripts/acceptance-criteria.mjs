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
  { id: 'AK-8', scope: 'M16', description: 'Verpackung als Programm (T-M16-05)', report: 'docs/reports/packaging.md' },
  // AK-9 (M39, aufgenommen 2026-09-12 mit dem Mehrspieler-Plan): eine Partie zu zweit
  // ueber einen Link, gespielt von Noah und einem zweiten Menschen in einem anderen
  // Netz. Der Eintrag entsteht zusammen mit Abschnitt 3.2 der Anforderungen und nicht
  // erst beim Bau — genau das war die Lehre aus AK-8, das ein Jahr lang eine Zusage
  // ohne Ort war. `scope: 'M39'` und nicht 'V1': M39 liegt hinter der abgeschlossenen
  // V1-Abnahme, und ein Kriterium, das gegen sie zaehlte, wuerde sie an einen
  // spaeteren Bau ketten.
  { id: 'AK-9', scope: 'M39', description: 'Eine Partie zu zweit ueber einen Link (T-M39-09)', report: 'docs/reports/mehrspieler.md' },
]

/**
 * Wie ein Kriterium ausserhalb der V1 im Bericht heisst (T-M41-18).
 *
 * Bis zum 2026-09-14 schrieb `acceptance.mjs` fuer *jedes* spaetere Kriterium den festen
 * Text "Verpackung als Programm (T-M16-05)". Solange AK-8 allein dastand, fiel das nicht
 * auf; seit AK-9 dazukam (2026-09-12), trug die Zweispieler-Abnahme aus M39 die
 * Beschreibung der Tauri-Verpackung — ein falscher Satz in `docs/reports/acceptance.md`.
 * Die Beschreibung gehoert deshalb zum Kriterium, nicht zur Schleife, die es druckt.
 */
export function describeCriterion(criterion) {
  return criterion.description ?? criterion.id
}

/**
 * Eine Dauer in Minuten und Sekunden — abgerundet, nie aufgerundet (T-M41-18).
 *
 * `Math.round(totalSeconds / 60)` druckte bei 298 Sekunden "5 min 58 s" statt 4 min 58 s:
 * die Minuten rundeten auf, die Sekunden blieben der Rest. Die Zahl in
 * `acceptance-timing.json` war immer richtig, nur die Konsolenzeile nicht — und genau die
 * wird in Uebergaben abgeschrieben.
 */
export function durationText(totalSeconds) {
  return `${Math.floor(totalSeconds / 60)} min ${totalSeconds % 60} s`
}

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
 * Die Quellen, von denen der Haltungs-Messlauf abhaengt (T-M40-17, Befund N-1). Nachgesehen an den
 * Importen von `apps/headless/test/stance.slow.test.ts`: die Automatik, der Kern, `shared` (Festkomma)
 * und `testkit` (`placeArmy`), die ausgelieferten Regeln (Ruhe und Kampf haengen an `ticksPerDay` und
 * `deployDelayTicks`), die Weltkarte, die Aufstellung der neuen Partie und der Test selbst (Kontrolle,
 * Schwellen, Zaehlung).
 */
export const STANCE_SOURCES = [
  'packages/ai/src',
  'packages/core/src',
  'packages/shared',
  'packages/testkit',
  'data/rules',
  'data/maps/world.json',
  'apps/desktop/src/game/newGame.ts',
  'apps/headless/test/stance.slow.test.ts',
]

/**
 * Die Balancing-Messgeraete und die Quellen, denen ihre Frische folgt (T-M40-17; Entscheid vom 2026-09-13).
 *
 * Bis T-M40-17 sahen beide nur `data/rules`. Der Parameterlauf liest ausserdem `data/maps/world.json`
 * (`sweep.slow.test.ts`), das Turnier `data/maps/testworld.json` (ueber `smallWorld` aus `packages/testkit`).
 * Den Code spielen beide; das Turnier folgt ihm (KI, Kern, Festkomma, Testkit, Turnierlogik), der
 * Parameterlauf bewusst nicht.
 *
 * - **Turnier** folgt ausserdem KI und Kern: ein Neulauf kostet rund 35 Sekunden (drei Maechte, 150 Partien
 *   je Paarung, gemessen 2026-09-25), und das Turnier ist der billige Beleg, dass eine Codeaenderung die
 *   KI-Staerke nicht verschiebt. Seit T-M17-15 dateigenau auch die Turnierlogik selbst
 *   (`apps/headless/src/tournament.ts`, `apps/headless/test/tournament.slow.test.ts`) sowie
 *   `packages/shared` (Festkomma) und `packages/testkit` (`smallWorld`, `TEST_RULES`) - nachgesehen an
 *   den Importen von `tournament.slow.test.ts` (Befund M17-T4, Pruefbefund 9). Dateigenau, damit ein
 *   weiterer Messlauf in `apps/headless/test` das Turnier nicht veralten laesst.
 * - **Parameterlauf** bleibt bewusst bei Regeln und Karte: er dauert rund eine Stunde und misst die
 *   Empfindlichkeit der Regelzahlen. Den Einfluss von Code decken das Turnier und `progress.slow` ab.
 *
 * Kippbar (`DECISIONS.md`, 2026-09-13, "Der Turnier-Waechter sieht KI und Kern"); `test/requirements.test.ts`
 * nennt beide Listen woertlich.
 *
 * `judgedBy` sagt, wonach die Frische geht (Nacharbeit zu 8c8c8f6):
 * - **Turnier: `measuredAtCommit`.** Das Turnier ist deterministisch, und ein Neulauf auf neuem Code ergab am
 *   2026-09-13 einen zeilengleichen Bericht. Eine unveraenderte Datei laesst sich nicht neu committen, der Waechter
 *   blieb deshalb nach dem Commit der Datei "nicht frisch", obwohl frisch gemessen war. Der Bericht traegt jetzt die
 *   Messzeile (`measurementLine`), und das Urteil geht wie beim Haltungs-Messlauf nach dem Messcommit.
 * - **Parameterlauf: `reportCommit`**, bewusst. Er dauert fast zwei Stunden, und bei einer Regelaenderung hat sein
 *   Bericht einen echten Diff. Den Unterschied haelt ein Test in `test/requirements.test.ts` fest.
 */
export const GAUGES = [
  {
    name: 'Parameterlauf',
    report: 'docs/reports/balance-sweep.md',
    sources: ['data/rules', 'data/maps/world.json'],
    command: 'pnpm balance:sweep',
    judgedBy: 'reportCommit',
  },
  {
    name: 'Turnier',
    report: 'docs/reports/ai-tournament-run.md',
    sources: [
      'data/rules',
      'data/maps/testworld.json',
      'packages/ai/src',
      'packages/core/src',
      'packages/shared',
      'packages/testkit',
      'apps/headless/src/tournament.ts',
      'apps/headless/test/tournament.slow.test.ts',
    ],
    command: 'pnpm vitest run --config vitest.slow.config.ts apps/headless/test/tournament.slow.test.ts',
    judgedBy: 'measuredAtCommit',
  },
]

/** Der Bericht des Haltungs-Messlaufs. */
export const STANCE_REPORT = 'docs/reports/stance.json'

/** Die ersten sieben Zeichen einer Commit-Kennung, fuer Meldungen. */
const kurz = (commit) => String(commit).slice(0, 7)

/** Ob eine Datei unter einer der Quellen liegt — ein Ordner zaehlt mit allem darunter. */
const unterQuellen = (file, sources) => sources.some((source) => file === source || file.startsWith(`${source}/`))

/**
 * Die Messzeile eines Markdown-Berichts: `Gemessen auf: <40 Zeichen> (Quellen sauber)`, oder
 * `(Quellen nicht sauber: a, b)`, wenn beim Messen Dateien unter den Quellen uncommittet waren. Dasselbe wie
 * `measuredAtCommit` und `measuredDirty` im Haltungs-Messlauf, nur als Zeile, die ein Mensch liest. Ohne git steht
 * dort `unbekannt`, und der Waechter liest das als Bericht ohne Messcommit.
 */
export function measurementLine({ measuredAtCommit, measuredDirty }) {
  if (typeof measuredAtCommit !== 'string' || !/^[0-9a-f]{40}$/.test(measuredAtCommit)) return 'Gemessen auf: unbekannt (git antwortet nicht)'
  const vermerk = !Array.isArray(measuredDirty)
    ? 'Quellen unbekannt'
    : measuredDirty.length === 0
      ? 'Quellen sauber'
      : `Quellen nicht sauber: ${measuredDirty.join(', ')}`
  return `Gemessen auf: ${measuredAtCommit} (${vermerk})`
}

/** Die Messzeile aus einem Bericht. Fehlt sie, sind beide Felder `null`; fehlt nur der Vermerk, ist `measuredDirty` `null`. */
export function parseMeasurementLine(text) {
  const zeile = /^Gemessen auf: ([0-9a-f]{40}) \((.*)\)\r?$/m.exec(String(text))
  if (!zeile) return { measuredAtCommit: null, measuredDirty: null }
  const [, measuredAtCommit, vermerk] = zeile
  if (vermerk === 'Quellen sauber') return { measuredAtCommit, measuredDirty: [] }
  const schmutzig = /^Quellen nicht sauber: (.+)$/.exec(vermerk)
  return { measuredAtCommit, measuredDirty: schmutzig ? schmutzig[1].split(', ') : null }
}

/**
 * Das Urteil nach Messcommit, gemeinsam fuer den Haltungs-Messlauf (T-M40-17) und das Turnier (Nacharbeit zu
 * 8c8c8f6). `{ fresh: true }` heisst: die Messung selbst gilt. Was ein Bericht darueber hinaus erfuellen muss
 * (beim Haltungs-Messlauf AK5), prueft der Aufrufer danach.
 *
 * `texte` traegt, was sich zwischen den Berichten unterscheidet: `label` (wessen Quellen), `quellen` (wie sie in
 * der Meldung heissen), `commitField` und `dirtyField` (wo der Bericht die Angaben fuehrt), `rerun` und `stale`.
 */
function measuredReportStatus({ file, report, sourcesDirty, measuredAtIsAncestor, commitsSinceMeasurement, sources, texte }) {
  const { label, quellen, commitField, dirtyField, rerun, stale } = texte
  if (sourcesDirty !== false) {
    return { fresh: false, reason: `uncommittete Aenderungen an den Quellen ${label} - erst committen, dann messen` }
  }
  if (!report || typeof report !== 'object') return { fresh: false, reason: `kein eingecheckter Bericht ${file}` }
  const commit = report.measuredAtCommit
  if (typeof commit !== 'string' || !/^[0-9a-f]{7,40}$/.test(commit)) {
    return { fresh: false, reason: `${file}: Bericht ohne Messcommit (${commitField}) - ${rerun}` }
  }
  if (!Array.isArray(report.measuredDirty)) {
    return { fresh: false, reason: `${file}: Bericht ohne Vermerk zum Arbeitsbaum (${dirtyField}) - ${rerun}` }
  }
  const schmutzig = report.measuredDirty.filter((path) => typeof path !== 'string' || unterQuellen(path, sources))
  if (schmutzig.length > 0) {
    return {
      fresh: false,
      reason: `${file} wurde auf ${kurz(commit)} mit uncommitteten Quellen gemessen (${schmutzig.join(', ')}) - erst committen, dann neu messen`,
    }
  }
  if (measuredAtIsAncestor === false) {
    return { fresh: false, reason: `der Messcommit ${kurz(commit)} aus ${file} liegt nicht in der Geschichte von HEAD - ${rerun}` }
  }
  if (measuredAtIsAncestor !== true || !Array.isArray(commitsSinceMeasurement)) {
    return { fresh: false, reason: `Stand der Quellen seit dem Messcommit ${kurz(commit)} unbekannt (git antwortet nicht)` }
  }
  if (commitsSinceMeasurement.length > 0) {
    return {
      fresh: false,
      reason: `seit dem Messcommit ${kurz(commit)} aus ${file} liegt auf HEAD mindestens ein Commit an ${quellen} (${kurz(commitsSinceMeasurement[0])}) - ${stale}`,
    }
  }
  return { fresh: true, reason: `${file} ist auf ${kurz(commit)} sauber gemessen, seitdem kein Commit an ${quellen} auf HEAD` }
}

/**
 * Frische der Balancing-Messgeraete (2026-09-08, DECISIONS.md; seit T-M40-17 nach Abstammung).
 *
 * Die Abnahme faehrt Parameterlauf und Turnier nicht mehr mit - sie sind Messgeraete, keine
 * Kriterien, und kosteten den Loewenanteil der 75-130 Minuten. Damit sie nicht still veralten,
 * prueft die Abnahme stattdessen: liegt auf HEAD seit dem Commit des Berichts ein Commit an den
 * Quellen des Messgeraets, ist die Abnahme rot. Alle Unbekannten zaehlen als veraltet - die sichere
 * Richtung.
 *
 * **Abstammung, nicht Uhrzeit** (T-M40-17, Befund M-1). Bis dahin verglich der Waechter Commit-Zeiten
 * (`git log -1 --format=%ct`). Nach dem Merge eines aelteren Seitencommits war das gruen: gleicht der
 * Merge fuer den Pfad dem Seitenzweig, ueberspringt git ihn und nennt den aelteren Seitencommit. Die
 * Frage ist nicht "was ist juenger", sondern "welche Commits an den Quellen hat der Bericht nicht
 * gesehen" — `git rev-list -1 <berichtcommit>..HEAD -- <quellen>`. Die Commits bekommt diese Funktion
 * als Eingabe (`scripts/freshness.mjs` fragt git).
 */
export function gaugeStatus({ sources = ['data/rules'], sourcesDirty, reportCommit, commitsSinceReport }) {
  const quellen = sources.join(', ')
  if (sourcesDirty !== false) return { fresh: false, reason: `uncommittete Aenderungen unter ${quellen} - erst committen, dann messen` }
  if (!reportCommit) return { fresh: false, reason: 'kein Bericht mit Stand gefunden' }
  if (!Array.isArray(commitsSinceReport)) {
    return { fresh: false, reason: `Stand von ${quellen} seit dem Bericht unbekannt (git antwortet nicht)` }
  }
  if (commitsSinceReport.length > 0) {
    return {
      fresh: false,
      reason: `seit dem Bericht (${kurz(reportCommit)}) liegt auf HEAD mindestens ein Commit an ${quellen} (${kurz(commitsSinceReport[0])}) - die Quellen sind juenger als der Bericht des Messgeraets`,
    }
  }
  return { fresh: true, reason: `seit dem Bericht (${kurz(reportCommit)}) kein Commit an ${quellen} auf HEAD` }
}

/**
 * Frische eines Messgeraets mit `judgedBy: 'measuredAtCommit'` (das Turnier, Nacharbeit zu 8c8c8f6).
 *
 * `report` ist die gelesene Messzeile (`parseMeasurementLine`) des eingecheckten Berichts, `null` ohne Bericht.
 * Gruen nur, wenn die Quellen jetzt sauber sind, der Bericht einen Messcommit nennt, beim Messen die Quellen sauber
 * waren, der Messcommit in der Geschichte von HEAD liegt und seitdem kein Commit an `gauge.sources` liegt. Wann die
 * Datei zuletzt committet wurde, zaehlt nicht: ein zeilengleicher Neulauf hat keinen Commit.
 */
export function gaugeMeasurementStatus({ gauge, report, sourcesDirty, measuredAtIsAncestor, commitsSinceMeasurement }) {
  return measuredReportStatus({
    file: gauge.report,
    report,
    sourcesDirty,
    measuredAtIsAncestor,
    commitsSinceMeasurement,
    sources: gauge.sources,
    texte: {
      label: `des Messgeraets ${gauge.name}`,
      quellen: gauge.sources.join(', '),
      commitField: 'Zeile "Gemessen auf:"',
      dirtyField: 'Vermerk zu den Quellen in der Zeile "Gemessen auf:"',
      rerun: `${gauge.command} auf sauberem Arbeitsbaum neu messen`,
      stale: 'die Quellen sind juenger als die Messung',
    },
  })
}

/**
 * Frische des Haltungs-Messlaufs (T-M40-16, Befund M-B; seit T-M40-17 nach Abstammung und Messcommit).
 *
 * `apps/headless/test/stance.slow.test.ts` traegt das Ruecknahmekriterium der Automatik
 * (R-UNIT-09/AK5, D30.9): zwoelf Partien, gut elf Minuten, und darum in keiner Pruefkette.
 *
 * `report` ist `episoden.nachher` des eingecheckten Berichts. Gruen nur, wenn alles zutrifft:
 *  - an den Quellen ist nichts uncommittet;
 *  - der Bericht nennt den Commit, auf dem gemessen wurde (`measuredAtCommit`, T-M40-17). Bis dahin galt
 *    jeder Commit am Bericht als Messung, auch eine Textkorrektur (Befund N-3);
 *  - beim Messen war der Arbeitsbaum an den Quellen sauber (`measuredDirty`);
 *  - der Messcommit liegt in der Geschichte von HEAD (`measuredAtIsAncestor`) — sonst saehe
 *    `rev-list <messcommit>..HEAD` die Commits eines anderen Zweigs nicht, die HEAD fehlen;
 *  - seit dem Messcommit liegt auf HEAD kein Commit an `sources` (`commitsSinceMeasurement`, Befund M-1
 *    und N-1);
 *  - der eingecheckte Lauf hat AK5 erfuellt — der Test schreibt den Bericht vor seinen Zusicherungen —,
 *    und zwar samt Kontrolle (`ak5.kontrolle.ok`) und Kartenfenster (`ak5.fensterOk`, T-M40-18, Befund N-2).
 */
export function stanceReportStatus({ report, sourcesDirty, measuredAtIsAncestor, commitsSinceMeasurement, sources = STANCE_SOURCES }) {
  // Der Teil, den das Turnier teilt (`measuredReportStatus`); die Meldungen sind dieselben wie vor der Nacharbeit zu 8c8c8f6.
  const messung = measuredReportStatus({
    file: STANCE_REPORT,
    report,
    sourcesDirty,
    measuredAtIsAncestor,
    commitsSinceMeasurement,
    sources,
    texte: {
      label: 'des Haltungs-Messlaufs',
      quellen: 'den Quellen des Messlaufs',
      commitField: 'episoden.nachher.measuredAtCommit',
      dirtyField: 'episoden.nachher.measuredDirty',
      rerun: 'WORLDWAR_WRITE_REPORT=1 auf sauberem Arbeitsbaum neu messen',
      stale: 'die Automatik ist ungemessen',
    },
  })
  if (!messung.fresh) return messung
  const commit = report.measuredAtCommit
  if (report.ak5?.erfuellt !== true) {
    return { fresh: false, reason: `der eingecheckte Lauf in ${STANCE_REPORT} hat AK5 nicht erfuellt (episoden.nachher.ak5.erfuellt, Ruecknahmekriterium D30.9)` }
  }
  // Kontrolle und Kartenfenster liest der Waechter selbst, nicht nur das Sammelfeld (T-M40-18, Befund N-2): in
  // Schritt 0 der zweiten Nacharbeit trug ein Bericht mit gefallener Kontrolle `erfuellt: true`.
  if (report.ak5?.kontrolle?.ok !== true) {
    return {
      fresh: false,
      reason: `der eingecheckte Lauf in ${STANCE_REPORT} trifft die Kontrolle nicht oder nennt sie nicht (episoden.nachher.ak5.kontrolle.ok) - etwas anderes als die Automatik hat sich verschoben`,
    }
  }
  // Befund M17-F1: ohne Kriegsplan war der Lauf blind (0 Einmaersche) und trug trotzdem erfuellt: true.
  if (report.ak5?.angegriffen?.ok !== true) {
    return {
      fresh: false,
      reason: `der eingecheckte Lauf ist blind oder nennt es nicht (episoden.nachher.ak5.angegriffen, Befund M17-F1)`,
    }
  }
  if (report.ak5?.fensterOk !== true) {
    return {
      fresh: false,
      reason: `im eingecheckten Lauf in ${STANCE_REPORT} hat sich das Kartenfenster verschoben, oder der Bericht nennt es nicht (episoden.nachher.ak5.fensterOk)`,
    }
  }
  return {
    fresh: true,
    reason: `${STANCE_REPORT} ist auf ${kurz(commit)} sauber gemessen, seitdem kein Commit an den Quellen des Messlaufs, und AK5 mit Kontrolle und Kartenfenster ist erfuellt`,
  }
}
