import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { analyse, parseRequirements, parseTests } from '../scripts/requirements-coverage.mjs'
import {
  CRITERIA,
  GAUGES,
  STANCE_SOURCES,
  criteriaOf,
  describeCriterion,
  durationText,
  gaugeMeasurementStatus,
  gaugeStatus,
  measurementLine,
  parseMeasurementLine,
  stanceReportStatus,
  unhomedCriteria,
  v1Failures,
} from '../scripts/acceptance-criteria.mjs'
import { allFreshness, commitsSince, gaugeFreshness, lastCommitOf, measurementStamp, stanceFreshness } from '../scripts/freshness.mjs'

const DOC = `
### 2.1 Beispiel

- **R-DEMO-01 — Erste Anforderung.** Text.
- **R-DEMO-02 — Zweite Anforderung.** Text.
- **R-DEMO-03 — Dritte, auf V2 verschoben.** Text.

### 2.14 Umfang

\`\`\`yaml
scope:
  v2_only: [R-DEMO-03]
  v1_partial:
    R-DEMO-02: "nur der erste Teil"
  test_only: [R-DEMO-01]
\`\`\`
`

/** Dasselbe Dokument mit einer vierten ID, die einem spaeteren Meilenstein gehoert. */
const DOC_LATER = `
### 2.1 Beispiel

- **R-DEMO-01 — Erste Anforderung.** Text.
- **R-DEMO-02 — Zweite Anforderung.** Text.
- **R-DEMO-03 — Dritte, auf V2 verschoben.** Text.
- **R-DEMO-04 — Vierte, gehoert nach M15.** Text.
- **R-DEMO-05 — Fuenfte, in keinem Fach.** Text.

### 2.14 Umfang

\`\`\`yaml
scope:
  v2_only: [R-DEMO-03]
  later:
    R-DEMO-04: "M15 — kommt mit dem Ausbau der KI"
  v1_partial:
    R-DEMO-02: "nur der erste Teil"
  test_only: [R-DEMO-01]
\`\`\`
`

/** Die beiden Formfehler, die ein `later`-Eintrag machen kann. */
const DOC_LATER_OHNE_GRUND = DOC_LATER.replace(
  'R-DEMO-04: "M15 — kommt mit dem Ausbau der KI"',
  'R-DEMO-04: "M15"',
)
const DOC_LATER_UNBEKANNT = DOC_LATER.replace(
  'R-DEMO-04: "M15 — kommt mit dem Ausbau der KI"',
  'R-DEMO-04: "M99 — Meilenstein, den der Aufgabenplan nicht kennt"',
)

const MEILENSTEINE = new Set(['M14', 'M15', 'M16', 'M17', 'M18'])

const GOOD_TEST = {
  path: 'demo/good.test.ts',
  text: `describe('R-DEMO-01 erste', () => { it('works', () => { expect(1).toBe(1) }) })`,
}
const HOLLOW_TEST = {
  path: 'demo/hollow.test.ts',
  text: `describe('R-DEMO-02 zweite', () => { it('todo', () => {}) })`,
}
const SKIPPED_TEST = {
  path: 'demo/skipped.test.ts',
  text: `describe.skip('R-DEMO-02 zweite', () => { it('x', () => { expect(1).toBe(1) }) })`,
}

describe('R-ARCH-05 Anforderungs-Abgleich', () => {
  it('liest alle Anforderungs-IDs und den scope-Block', () => {
    const parsed = parseRequirements(DOC)
    expect(parsed.ids).toEqual(['R-DEMO-01', 'R-DEMO-02', 'R-DEMO-03'])
    expect([...parsed.v2Only]).toEqual(['R-DEMO-03'])
    expect([...parsed.testOnly]).toEqual(['R-DEMO-01'])
    expect(parsed.partial['R-DEMO-02']).toBe('nur der erste Teil')
  })

  it('ueberspringt V2-IDs und meldet offene V1-IDs', () => {
    const result = analyse(DOC, [GOOD_TEST])
    expect(result.required).toEqual(['R-DEMO-01', 'R-DEMO-02'])
    expect(result.missing).toEqual(['R-DEMO-02'])
    expect(result.missing).not.toContain('R-DEMO-03')
  })

  it('schlaegt fehl, wenn eine Test-ID entfernt wird', () => {
    // The point of the gate: removing the test must make the requirement show up as open.
    const withTest = analyse(DOC, [GOOD_TEST])
    const withoutTest = analyse(DOC, [])
    expect(withTest.missing).not.toContain('R-DEMO-01')
    expect(withoutTest.missing).toContain('R-DEMO-01')
  })

  it('zaehlt einen Testblock ohne Zusicherung nicht als Beleg', () => {
    const result = analyse(DOC, [GOOD_TEST, HOLLOW_TEST])
    expect(result.missing).toContain('R-DEMO-02')
    expect(result.hollowOnly).toContain('R-DEMO-02')
  })

  it('zaehlt einen uebersprungenen Testblock nicht als Beleg', () => {
    const result = analyse(DOC, [GOOD_TEST, SKIPPED_TEST])
    expect(result.missing).toContain('R-DEMO-02')
  })

  it('findet im echten Anforderungsdokument alle IDs', () => {
    const text = readFileSync(new URL('../docs/plan/01-REQUIREMENTS.md', import.meta.url), 'utf8')
    const parsed = parseRequirements(text)
    expect(parsed.ids.length).toBeGreaterThanOrEqual(70)
    expect(parsed.ids).toContain('R-TIME-02')
    expect(parsed.ids).toContain('R-FREE-01')
  })

  it('erkennt mehrere Testdateien fuer dieselbe ID', () => {
    const { covered } = parseTests([GOOD_TEST, { ...GOOD_TEST, path: 'demo/second.test.ts' }])
    expect(covered.get('R-DEMO-01')).toHaveLength(2)
  })

  // T-M14-01: Die Meilensteinachse. Der Nachtrag vom 2026-09-04 hat 18 Anforderungen
  // eingefuegt, ohne den scope-Block zu pflegen — und das Tor damit ohne eine Zeile
  // Produktionscode von 82/82 auf 82/100 gekippt. Der Block bekommt ein Fach fuer
  // spaetere Meilensteine; die Richtung des Fehlers bleibt aber die sichere.

  it('zaehlt eine ID aus dem Fach later nicht zur V1-Pflicht', () => {
    const result = analyse(DOC_LATER, [GOOD_TEST], MEILENSTEINE)
    expect(result.required).not.toContain('R-DEMO-04')
    expect(result.missing).not.toContain('R-DEMO-04')
  })

  it('fuehrt eine spaetere ID als Fortschritt ihres Meilensteins', () => {
    const result = analyse(DOC_LATER, [GOOD_TEST], MEILENSTEINE)
    expect(result.progress.get('M15')).toEqual({ total: 1, covered: 0, ids: ['R-DEMO-04'] })
  })

  it('haelt eine ID ohne Fach weiter fuer V1-Pflicht', () => {
    // Die sichere Richtung: wer eine Anforderung aufnimmt und den Block vergisst,
    // bekommt eine V1-Pflicht zu viel und ein rotes Tor — nie eine stillschweigend
    // verschwundene Zusage.
    const result = analyse(DOC_LATER, [GOOD_TEST], MEILENSTEINE)
    expect(result.required).toContain('R-DEMO-05')
    expect(result.missing).toContain('R-DEMO-05')
  })

  it('lehnt einen later-Eintrag ohne Begruendung ab', () => {
    const result = analyse(DOC_LATER_OHNE_GRUND, [GOOD_TEST], MEILENSTEINE)
    expect(result.scopeErrors).toContainEqual(
      expect.stringContaining('R-DEMO-04'),
    )
  })

  it('lehnt einen later-Eintrag mit unbekanntem Meilenstein ab', () => {
    const result = analyse(DOC_LATER_UNBEKANNT, [GOOD_TEST], MEILENSTEINE)
    expect(result.scopeErrors).toContainEqual(expect.stringContaining('M99'))
  })

  it('meldet einen fehlerfreien Block ohne Beanstandung', () => {
    expect(analyse(DOC_LATER, [GOOD_TEST], MEILENSTEINE).scopeErrors).toEqual([])
  })

  it('beanstandet eine ID im scope-Block, die es in Abschnitt 2 nicht gibt', () => {
    const doc = DOC_LATER.replace('R-DEMO-04: "M15 —', 'R-DEMO-99: "M15 —')
    expect(analyse(doc, [GOOD_TEST], MEILENSTEINE).scopeErrors).toContainEqual(
      expect.stringContaining('R-DEMO-99'),
    )
  })

  it('laeuft als Skript und meldet den Stand mit Exit-Code', () => {
    // Regression guard: the script once exported everything correctly and still did
    // nothing at all, because its "am I the entry point?" check compared a hand-built
    // file:// string that never matches on Windows. Unit tests of the pure functions
    // could not see that — only running it as a script can.
    const script = fileURLToPath(new URL('../scripts/requirements-coverage.mjs', import.meta.url))
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' })

    expect(result.stdout).toMatch(/Anforderungen gesamt:\s+\d+/)
    expect(result.stdout).toMatch(/mit belegtem Test:\s+\d+/)

    // T-M14-01: Eine Zeile, die immer da ist — auch bei null. Vorher musste der Leser
    // aus der Abwesenheit einer "Offen (n)"-Zeile auf Erfolg schliessen; genau diese
    // Doppelheuristik hat den Abnahmebericht schon einmal "unbekannt" melden lassen.
    const open = /^V1 offen: (\d+)$/m.exec(result.stdout)
    expect(open, `Zeile "V1 offen: N" fehlt in:\n${result.stdout}`).not.toBeNull()

    // Der Exit-Code muss zu dem passen, was das Skript gerade berichtet: rot, solange
    // eine Anforderung offen ist, gruen, wenn keine mehr offen ist. Auf "immer 1"
    // festgenagelt war der Test bis T-M12-03 richtig — und danach einer, der das
    // Erreichen des Ziels als Fehler gemeldet haette.
    const offen = Number(open![1])
    expect(result.status, result.stdout).toBe(offen > 0 ? 1 : 0)
  })

  // T-M14-02b: Der Zaehler. Bis heute galt eine Anforderung als belegt, sobald irgendwo
  // ein describe mit ihrer ID und einem expect stand — das Akzeptanzkriterium las
  // niemand. "82 von 82" war damit eine Namenszaehlung, keine Verhaltensaussage.

  const DOC_AK = `
### 2.1 Beispiel

- **R-DEMO-01 — Mit drei Kriterien.** Text.
  - AK1: WENN a, DANN b.
  - AK2: WENN c, DANN d.
  - AK3: WENN e, DANN f.
- **R-DEMO-02 — Ohne Kriterien.** Text.

### 2.14 Umfang

\`\`\`yaml
scope:
  v2_only: []
  test_only: []
\`\`\`
`
  const akTest = (namen: string[]) => ({
    path: 'demo/ak.test.ts',
    text: namen
      .map((n) => `describe('${n} etwas', () => { it('x', () => { expect(1).toBe(1) }) })`)
      .join('\n'),
  })

  it('zaehlt die Akzeptanzkriterien einer Anforderung', () => {
    const criteria = parseRequirements(DOC_AK).criteria as Record<string, string[]>
    expect(criteria['R-DEMO-01']).toEqual(['AK1', 'AK2', 'AK3'])
  })

  it('belegt eine Anforderung erst, wenn jedes ihrer Kriterien belegt ist', () => {
    const fehlt = analyse(DOC_AK, [akTest(['R-DEMO-01/AK1', 'R-DEMO-01/AK3'])], MEILENSTEINE, {
      strictFrom: new Set(['R-DEMO-01']),
    })
    expect(fehlt.missingCriteria).toEqual([{ id: 'R-DEMO-01', fehlend: ['AK2'] }])
    expect(fehlt.missing).toContain('R-DEMO-01')
  })

  it('belegt sie, wenn alle Kriterien da sind', () => {
    const alle = analyse(
      DOC_AK,
      [akTest(['R-DEMO-01/AK1', 'R-DEMO-01/AK2', 'R-DEMO-01/AK3'])],
      MEILENSTEINE,
      { strictFrom: new Set(['R-DEMO-01']) },
    )
    expect(alle.missingCriteria).toEqual([])
    expect(alle.missing).not.toContain('R-DEMO-01')
  })

  it('laesst der Uebergangsliste ihre Buchung auf Namensebene', () => {
    // Die 82 heute auf Namensebene gebuchten IDs bleiben belegt — aber als Schuld mit
    // Namen, nicht als Ausnahme ohne Ende.
    const uebergang = analyse(DOC_AK, [akTest(['R-DEMO-01'])], MEILENSTEINE, {
      strictFrom: new Set(),
    })
    expect(uebergang.missing).not.toContain('R-DEMO-01')
  })

  it('behandelt eine Anforderung ohne Kriterien weiter auf Namensebene', () => {
    const result = analyse(DOC_AK, [akTest(['R-DEMO-02'])], MEILENSTEINE, {
      strictFrom: new Set(['R-DEMO-02']),
    })
    expect(result.missing).not.toContain('R-DEMO-02')
  })

  it('die Uebergangsliste darf nur schrumpfen', () => {
    // Eingefroren am 2026-09-06 bei 26 Eintraegen. Eine Schuld mit Namen ist nur so lange
    // eine Schuld, wie sie nicht wachsen darf — sonst ist sie eine Ausnahme ohne Ende.
    // 2026-09-13 (T-M41-07): R-BAT-07 ist je Kriterium gebucht und gestrichen; die Klinke
    // folgt, damit die frei gewordene Stelle nicht still wieder besetzt wird.
    const text = readFileSync(new URL('../docs/plan/01-REQUIREMENTS.md', import.meta.url), 'utf8')
    const { nameLevel, ids } = parseRequirements(text)
    expect(nameLevel).not.toContain('R-BAT-07')
    expect(nameLevel.size).toBeLessThanOrEqual(25)
    const unbekannt = [...nameLevel].filter((id) => !ids.includes(id))
    expect(unbekannt, `nicht existierende IDs in name_level: ${unbekannt.join(', ')}`).toEqual([])
  })

  it('weist spaetere Meilensteine als Fortschritt aus, nicht als Luecke', () => {
    // Ein Meilenstein, der noch nicht gebaut ist, darf das Tor nicht rot faerben —
    // sonst haengt die Abnahme der V1 an der Fertigstellung der V1.2.
    const script = fileURLToPath(new URL('../scripts/requirements-coverage.mjs', import.meta.url))
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' })
    expect(result.stdout).toMatch(/M15: \d+ von \d+ belegt \(Fortschritt, kein Tor\)/)
  })
})

/**
 * Jedes Abnahmekriterium hat einen Ort (T-M16-01).
 *
 * Der Anlass war AK-8: C-02 sagt seit dem 2026-09-05 „eigenes Abnahmekriterium AK-8",
 * und danach suchte kein Skript — Abschnitt 3 kannte AK-1 bis AK-7, `acceptance.mjs`
 * pruefte AK-1 bis AK-5 und AK-7. Geprueft wird deshalb nicht der Einzelfall, sondern
 * die Regel, und sie wird zuerst an erfundenen Dokumenten gezeigt: eine Pruefung, die
 * nur an den echten Dateien laeuft, wird in dem Moment bedeutungslos, in dem die echten
 * Kennungen stimmen — die Lehre aus T-M14-02, wo drei Waechter ueber einer leeren Menge
 * gruen waren.
 */
const DOC_AK = `
## 3. Abnahmekriterien für V1

| ID | Abnahmekriterium |
|---|---|
| **AK-1** | Erstes Kriterium. |
| **AK-2** | Zweites Kriterium. |

### 3.1 Abnahmekriterium für M9 — nicht Teil der V1

| ID | Abnahmekriterium |
|---|---|
| **AK-3** | Drittes Kriterium, gehört einem späteren Meilenstein. |
`

/** Dasselbe Dokument, in dem AK-4 nur im Fließtext einer Rahmenbedingung vorkommt. */
const DOC_AK_NUR_ERWAEHNT = `${DOC_AK}
| C-99 | Auslieferung: später, mit eigenem Abnahmekriterium **AK-4**. |
`

const LISTE = [
  { id: 'AK-1', scope: 'V1' },
  { id: 'AK-2', scope: 'V1' },
  { id: 'AK-3', scope: 'M9' },
]

describe('R-ARCH-05 Jedes Abnahmekriterium hat einen Ort', () => {
  it('findet ein Kriterium, das der Anforderungstext fuehrt und keine Liste kennt', () => {
    const { ohneOrt } = unhomedCriteria(DOC_AK, LISTE.slice(0, 2))
    expect(ohneOrt).toEqual(['AK-3'])
  })

  it('findet die Gegenrichtung: eine Liste, die ein unbekanntes Kriterium fuehrt', () => {
    const { ohneKriterium } = unhomedCriteria(DOC_AK, [...LISTE, { id: 'AK-9', scope: 'V1' }])
    expect(ohneKriterium).toEqual(['AK-9'])
  })

  it('nimmt eine blosse Erwaehnung nicht fuer einen Ort', () => {
    // Genau der Zustand, in dem AK-8 bis zum 2026-09-06 war: in C-02 zugesagt, in
    // keiner Tabelle definiert. Wer die Erwaehnung als Definition zaehlt, findet den
    // Fehler nie — die Zusage stand ja da.
    const { nurErwaehnt, ohneOrt } = unhomedCriteria(DOC_AK_NUR_ERWAEHNT, LISTE)
    expect(nurErwaehnt).toEqual(['AK-4'])
    expect(ohneOrt).toEqual([])
  })

  it('ist an den echten Dateien gruen', () => {
    const text = readFileSync(new URL('../docs/plan/01-REQUIREMENTS.md', import.meta.url), 'utf8')
    const { ohneOrt, ohneKriterium, nurErwaehnt } = unhomedCriteria(text)
    expect(ohneOrt, `ohne Ort: ${ohneOrt.join(', ')}`).toEqual([])
    expect(ohneKriterium, `ohne Anforderung: ${ohneKriterium.join(', ')}`).toEqual([])
    expect(nurErwaehnt, `nur erwaehnt, nirgends definiert: ${nurErwaehnt.join(', ')}`).toEqual([])
  })
})

describe('R-ARCH-05 Ein spaeteres Kriterium faerbt die V1-Abnahme nicht rot', () => {
  // Die Trennung ist der Kern von T-M16-01. Ein AK-8 in der V1-Tabelle kettete die
  // Abnahme an einen Bau, der ausdruecklich hinter ihr liegt — der Fehler des Nachtrags
  // 2.15, der AK-2 unerfuellbar gemacht hat und von T-M14-01 repariert wurde.
  const ergebnisse = [
    { id: 'AK-1', ok: true },
    { id: 'AK-2/3', ok: true },
    { id: 'AK-8', ok: false },
  ]

  it('laesst ein gerissenes M16-Kriterium den Ausgang der V1 unberuehrt', () => {
    expect(v1Failures(ergebnisse)).toEqual([])
  })

  it('faengt dieselbe Zeile, sobald sie zur V1 gehoert', () => {
    const alsV1 = CRITERIA.map((c) => (c.id === 'AK-8' ? { ...c, scope: 'V1' } : c))
    expect(v1Failures(ergebnisse, alsV1).map((r: { id: string }) => r.id)).toEqual(['AK-8'])
  })

  it('loest eine Sammelzeile in ihre Kriterien auf', () => {
    // Der Abnahmelauf fasst Pruefungen zusammen, die denselben Befehl teilen: eine Zeile
    // AK-4/6 steht fuer zwei Kriterien. Wer sie als eine Kennung liest, findet AK-6 nie.
    expect(criteriaOf('AK-4/6')).toEqual(['AK-4', 'AK-6'])
    expect(criteriaOf('AK-1')).toEqual(['AK-1'])
    expect(criteriaOf('Langlauf')).toEqual([])
  })

  it('jedes Kriterium der Liste traegt einen Umfang, und V1 ist nicht leer', () => {
    expect(CRITERIA.every((c) => typeof c.scope === 'string' && c.scope.length > 0)).toBe(true)
    expect(CRITERIA.filter((c) => c.scope === 'V1').map((c) => c.id)).toEqual([
      'AK-1',
      'AK-2',
      'AK-3',
      'AK-4',
      'AK-5',
      'AK-6',
      'AK-7',
    ])
  })
})

/**
 * T-M41-18: Die Beschreibung gehoert zum Kriterium, nicht zur Schleife, die es druckt.
 *
 * `acceptance.mjs` schrieb fuer *jedes* Kriterium ausserhalb der V1 den festen Text
 * "Verpackung als Programm (T-M16-05)". Solange AK-8 allein dastand, fiel das nicht auf;
 * seit AK-9 dazukam, trug die Zweispieler-Abnahme aus M39 die Beschreibung der
 * Tauri-Verpackung. Der Fehler war nur im Bericht sichtbar und in keinem Test.
 */
describe('T-M41-18 Jedes spaetere Kriterium beschreibt sich selbst', () => {
  const spaetere = CRITERIA.filter((c) => c.scope !== 'V1')

  it('kennt mehr als ein Kriterium ausserhalb der V1 — sonst hat die Pruefung nichts zu sehen', () => {
    expect(spaetere.map((c) => c.id)).toEqual(['AK-8', 'AK-9'])
  })

  it('gibt keinem zweiten Kriterium die Beschreibung des ersten', () => {
    const texte = spaetere.map((c) => describeCriterion(c))
    expect(new Set(texte).size, `doppelte Beschreibung: ${texte.join(' | ')}`).toBe(texte.length)
  })

  it('nennt bei AK-9 die Partie zu zweit und nicht die Verpackung', () => {
    const ak9 = CRITERIA.find((c) => c.id === 'AK-9')!
    expect(describeCriterion(ak9)).toMatch(/zu zweit/)
    expect(describeCriterion(ak9)).not.toMatch(/Verpackung|T-M16-05/)
  })

  it('faellt zurueck auf die Kennung, wenn ein Kriterium keine Beschreibung traegt', () => {
    // Ohne Rueckfallwert stuende `undefined` im Bericht — stiller als ein falscher Satz.
    expect(describeCriterion({ id: 'AK-42', scope: 'M99' })).toBe('AK-42')
  })

  it('das Abnahmeskript druckt keinen festen Text mehr fuer spaetere Kriterien', () => {
    // Die Zeile selbst laesst sich nicht importieren: `acceptance.mjs` faehrt beim Laden
    // den ganzen Abnahmelauf. Gebunden wird deshalb der Quelltext — genau die Stelle,
    // an der der feste Satz stand.
    const quelle = readFileSync(new URL('../scripts/acceptance.mjs', import.meta.url), 'utf8')
    expect(quelle).toMatch(/spaetere\.map\(\(c\) => `\| \$\{c\.id\} \| \$\{describeCriterion\(c\)\}/)
    expect(quelle).not.toMatch(/\| Verpackung als Programm \(T-M16-05\) \|/)
  })
})

/**
 * T-M41-18: Die gedruckte Gesamtdauer wird abgerundet, nicht gerundet.
 *
 * `Math.round(totalSeconds / 60)` machte aus 298 Sekunden "5 min 58 s". Die Zahl in
 * `acceptance-timing.json` war immer richtig — abgeschrieben wird aber die Konsolenzeile.
 */
describe('T-M41-18 Die Gesamtdauer der Abnahme', () => {
  it('rundet die Minuten ab', () => {
    // 298 s ist die gemessene Wanduhr des Abnahmelaufs vom 2026-09-13.
    expect(durationText(298)).toBe('4 min 58 s')
    expect(durationText(448)).toBe('7 min 28 s')
  })

  it('haelt auch die Raender', () => {
    expect(durationText(0)).toBe('0 min 0 s')
    expect(durationText(59)).toBe('0 min 59 s')
    expect(durationText(60)).toBe('1 min 0 s')
  })

  it('nennt nie mehr Sekunden, als die Dauer hat', () => {
    for (const sekunden of [1, 29, 30, 31, 89, 90, 91, 298, 448, 3599, 3600]) {
      const [minuten, rest] = [Math.floor(sekunden / 60), sekunden % 60]
      expect(durationText(sekunden)).toBe(`${minuten} min ${rest} s`)
      expect(minuten * 60 + rest).toBe(sekunden)
    }
  })
})

/**
 * Die Abnahme faehrt seit dem 2026-09-08 nicht mehr die ganze langsame Suite
 * (75-130 min), sondern nur, was ihre Kriterien woertlich verlangen. Die Balancing-
 * Messgeraete (Parameterlauf, Turnier) ersetzt ein Frische-Waechter: liegt seit dem
 * Bericht ein Commit an ihren Quellen, ist die Abnahme rot - ein Messgeraet darf nicht
 * still veralten. Entscheid in DECISIONS.md.
 *
 * **Die Geschichte.** Bis T-M40-17 verglich der Waechter Commit-Zeiten. Nach dem Merge eines
 * aelteren Seitencommits war das gruen, obwohl der Bericht die neuen Regeln nie gesehen hatte
 * (Befund M-1 der Durchsicht der zweiten Nacharbeit M40). Seitdem entscheidet die Abstammung:
 * `git rev-list -1 <berichtcommit>..HEAD -- <quellen>`. Die Commit-Kennungen hier sind erfunden.
 */
describe('T-M12-03 Frische-Waechter der Messgeraete', () => {
  const frisch = { sources: ['data/rules'], sourcesDirty: false, reportCommit: 'b'.repeat(40), commitsSinceReport: [] as string[] }

  it('meldet frisch, wenn seit dem Bericht auf HEAD kein Commit an den Quellen liegt', () => {
    expect(gaugeStatus(frisch)).toMatchObject({ fresh: true })
  })

  it('meldet veraltet, wenn seit dem Bericht ein Commit an den Quellen liegt - und nennt Commit und Quelle', () => {
    const status = gaugeStatus({ ...frisch, commitsSinceReport: ['a56df6812aac57741823c120392f1a7ab18aedcb'] })
    expect(status.fresh).toBe(false)
    expect(status.reason).toContain('a56df68')
    expect(status.reason).toContain('data/rules')
  })

  it('meldet veraltet bei uncommitteten Aenderungen an den Quellen - die sichere Richtung', () => {
    expect(gaugeStatus({ ...frisch, sourcesDirty: true }).fresh).toBe(false)
  })

  it('meldet veraltet, wenn der Bericht keinen Stand hat', () => {
    expect(gaugeStatus({ ...frisch, reportCommit: null }).fresh).toBe(false)
  })

  it('meldet veraltet, wenn git die Commits nicht nennen kann - die sichere Richtung', () => {
    expect(gaugeStatus({ ...frisch, commitsSinceReport: null }).fresh).toBe(false)
  })

  it('beobachtet je Messgeraet die Quellen, die es nachweislich liest - und jede davon gibt es', () => {
    // Parameterlauf: `sweep.slow.test.ts` liest data/rules und data/maps/world.json. Turnier: TEST_RULES und
    // smallWorld aus packages/testkit, die data/rules und data/maps/testworld.json importieren (T-M40-17).
    // Das Turnier sieht seit dem Entscheid vom 2026-09-13 auch KI und Kern, der Parameterlauf bewusst nicht.
    const ROOT = fileURLToPath(new URL('..', import.meta.url))
    expect(GAUGES.map((gauge: { name: string; sources: string[] }) => [gauge.name, gauge.sources])).toEqual([
      ['Parameterlauf', ['data/rules', 'data/maps/world.json']],
      ['Turnier', ['data/rules', 'data/maps/testworld.json', 'packages/ai/src', 'packages/core/src']],
    ])
    for (const gauge of GAUGES as { report: string; sources: string[] }[]) {
      for (const path of [gauge.report, ...gauge.sources]) expect(existsSync(join(ROOT, path)), path).toBe(true)
    }
  })
})

/**
 * Der Haltungs-Messlauf veraltet nicht still (T-M40-16, Befund M-B; seit T-M40-17 nach Abstammung).
 *
 * `stance.slow.test.ts` traegt das Ruecknahmekriterium der Automatik (R-UNIT-09/AK5, D30.9), laeuft aber
 * in keiner Pruefkette: zwoelf Partien dauern gut elf Minuten. Die Abnahme faehrt den Lauf deshalb nicht,
 * sondern prueft den eingecheckten Bericht:
 *  - er nennt den Commit, auf dem gemessen wurde (`measuredAtCommit`), und der Arbeitsbaum war an den
 *    Quellen sauber (`measuredDirty`) — sonst misst ein Textkommit am Bericht als Messung (Befund N-3);
 *  - seit diesem Commit liegt auf HEAD kein Commit an einer Quelle des Laufs (`STANCE_SOURCES`, Befund N-1);
 *    bis T-M40-17 verglich der Waechter Commit-Zeiten, und der Merge eines aelteren Seitencommits machte
 *    ihn gruen (Befund M-1);
 *  - der eingecheckte Lauf hat AK5 erfuellt, denn der Test schreibt den Bericht vor seinen Zusicherungen.
 * Commit-Kennungen hier erfunden.
 */
describe('R-UNIT-09/AK5 Frische-Waechter des Haltungs-Messlaufs (T-M40-16, T-M40-17)', () => {
  const MESSCOMMIT = 'c'.repeat(40)
  const bericht = (felder: Record<string, unknown> = {}) => ({
    measuredAtCommit: MESSCOMMIT,
    measuredDirty: [] as string[],
    ak5: { erfuellt: true, kontrolle: { erwartet: { intrusions: 76, provincesLost: 4 }, gemessen: { intrusions: 76, provincesLost: 4 }, ok: true }, fensterOk: true },
    ...felder,
  })
  const frisch = { report: bericht(), sourcesDirty: false, measuredAtIsAncestor: true, commitsSinceMeasurement: [] as string[] }

  it('meldet frisch, wenn seit dem Messcommit kein Commit an den Quellen liegt und AK5 erfuellt ist', () => {
    expect(stanceReportStatus(frisch)).toMatchObject({ fresh: true })
  })

  it('meldet veraltet nach dem Merge eines aelteren Seitencommits - und nennt ihn (Befund M-1)', () => {
    // Nachbau der Durchsicht: der Seitenzweig aendert packages/ai/src zur Zeit 2000, main checkt den Lauf zur
    // Zeit 3000 ein, der Merge zur Zeit 4000 gleicht fuer den Pfad dem Seitenzweig. `git log -1` nennt den
    // Seitencommit (2000 <= 3000, gruen); `git rev-list <messcommit>..HEAD` findet ihn.
    const status = stanceReportStatus({ ...frisch, commitsSinceMeasurement: ['a56df6812aac57741823c120392f1a7ab18aedcb'] })
    expect(status.fresh).toBe(false)
    expect(status.reason).toContain('a56df68')
    expect(status.reason).toContain('stance.json')
  })

  it('meldet rot bei einem Bericht ohne Messcommit - so steht der eingecheckte Lauf bis zur naechsten Messung', () => {
    const alt = { adjutant: 'D30.4', stand: 'gemessen nach dem Merge', measuredAt: '2026-09-13T18:05:53.565Z', ak5: bericht().ak5 }
    const status = stanceReportStatus({ ...frisch, report: alt, measuredAtIsAncestor: null, commitsSinceMeasurement: null })
    expect(status.fresh).toBe(false)
    expect(status.reason).toContain('ohne Messcommit')
    expect(status.reason).toContain('neu messen')
  })

  it('meldet rot bei einem Bericht aus einem an den Quellen schmutzigen Arbeitsbaum (Befund N-3)', () => {
    const schmutzig = stanceReportStatus({ ...frisch, report: bericht({ measuredDirty: ['docs/plan/PROBLEME.md', 'packages/ai/src/adjutant.ts'] }) })
    expect(schmutzig.fresh).toBe(false)
    expect(schmutzig.reason).toContain('packages/ai/src/adjutant.ts')
    expect(schmutzig.reason).not.toContain('PROBLEME')
    // Eine Notiz neben den Quellen aendert nichts, was der Lauf liest.
    expect(stanceReportStatus({ ...frisch, report: bericht({ measuredDirty: ['docs/plan/PROBLEME.md'] }) }).fresh).toBe(true)
    // Ohne Vermerk ist unbekannt, ob sauber gemessen wurde.
    const ohne = bericht()
    delete (ohne as Partial<typeof ohne>).measuredDirty
    expect(stanceReportStatus({ ...frisch, report: ohne }).fresh).toBe(false)
  })

  it('meldet rot, wenn der Messcommit nicht in der Geschichte von HEAD liegt', () => {
    // Ein Bericht, der aus einem anderen Zweig herueberkopiert wurde: rev-list <messcommit>..HEAD saehe die
    // Commits des anderen Zweigs nicht, die HEAD fehlen.
    const status = stanceReportStatus({ ...frisch, measuredAtIsAncestor: false })
    expect(status.fresh).toBe(false)
    expect(status.reason).toContain('Geschichte')
  })

  it('meldet veraltet bei uncommitteten Aenderungen, ohne Bericht und wenn git nicht antwortet', () => {
    expect(stanceReportStatus({ ...frisch, sourcesDirty: true }).fresh).toBe(false)
    expect(stanceReportStatus({ ...frisch, report: null }).fresh).toBe(false)
    expect(stanceReportStatus({ ...frisch, commitsSinceMeasurement: null }).fresh).toBe(false)
    expect(stanceReportStatus({ ...frisch, measuredAtIsAncestor: null }).fresh).toBe(false)
  })

  it('meldet rot, wenn der eingecheckte Lauf AK5 nicht erfuellt hat - auch wenn er frisch ist', () => {
    // Der Test schreibt den Bericht, bevor er zusichert: ein gescheiterter Lauf ist der, den man lesen will.
    const status = stanceReportStatus({ ...frisch, report: bericht({ ak5: { ...bericht().ak5, erfuellt: false } }) })
    expect(status.fresh).toBe(false)
    expect(status.reason).toContain('AK5')
  })

  it('meldet rot, wenn die Kontrolle im eingecheckten Lauf gefallen ist - auch wenn erfuellt true sagt (T-M40-18, Befund N-2)', () => {
    // So in Schritt 0 der zweiten Nacharbeit wirklich geschehen: die Kontrolle war rot, AK5 gruen, und der Bericht
    // trug `erfuellt: true`. Der Waechter liest die Kontrolle deshalb selbst, nicht nur das Sammelfeld.
    const kontrolle = { erwartet: { intrusions: 52, provincesLost: 4 }, gemessen: { intrusions: 76, provincesLost: 4 }, ok: false }
    const status = stanceReportStatus({ ...frisch, report: bericht({ ak5: { ...bericht().ak5, kontrolle } }) })
    expect(status.fresh).toBe(false)
    expect(status.reason).toContain('Kontrolle')
  })

  it('meldet rot, wenn sich das Kartenfenster im eingecheckten Lauf verschoben hat (T-M40-18)', () => {
    const status = stanceReportStatus({ ...frisch, report: bericht({ ak5: { ...bericht().ak5, fensterOk: false } }) })
    expect(status.fresh).toBe(false)
    expect(status.reason).toContain('Kartenfenster')
  })

  it('meldet rot bei einem Bericht, der Kontrolle oder Kartenfenster nicht nennt (T-M40-18)', () => {
    const ohneKontrolle: Partial<ReturnType<typeof bericht>['ak5']> = { ...bericht().ak5 }
    delete ohneKontrolle.kontrolle
    const ohneFenster: Partial<ReturnType<typeof bericht>['ak5']> = { ...bericht().ak5 }
    delete ohneFenster.fensterOk
    expect(stanceReportStatus({ ...frisch, report: bericht({ ak5: ohneKontrolle }) }).fresh).toBe(false)
    expect(stanceReportStatus({ ...frisch, report: bericht({ ak5: ohneFenster }) }).fresh).toBe(false)
  })

  it('beobachtet jede Quelle, von der der Messlauf abhaengt - und jede davon gibt es (Befund N-1)', () => {
    const ROOT = fileURLToPath(new URL('..', import.meta.url))
    expect(STANCE_SOURCES).toEqual([
      'packages/ai/src',
      'packages/core/src',
      'packages/shared',
      'packages/testkit',
      'data/rules',
      'data/maps/world.json',
      'apps/desktop/src/game/newGame.ts',
      'apps/headless/test/stance.slow.test.ts',
    ])
    for (const path of STANCE_SOURCES as string[]) expect(existsSync(join(ROOT, path)), path).toBe(true)
  })
})

/**
 * Der Nachbau aus der Durchsicht (Befund M-1) als echtes Repo — die Seite der Waechter, die git fragt.
 *
 * Basis zur Zeit 1000; main checkt zur Zeit 3000 die Berichte ein, gemessen auf der Basis; ein Seitenzweig
 * aendert zur Zeit 2000 die Automatik und die Regeln; der Merge zur Zeit 4000. Fuer beide Pfade gleicht der
 * Merge dem Seitenzweig, git ueberspringt ihn, und `git log -1` nennt den aelteren Seitencommit.
 */
describe('T-M40-17 Frische nach Abstammung: der Merge eines aelteren Seitencommits (Befund M-1)', () => {
  let repo = ''
  let haupt = ''

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'worldwar-frische-'))
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
    const git = (zeit: number | null, ...args: string[]): string =>
      execFileSync(
        'git',
        ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args],
        { cwd: repo, encoding: 'utf8', env: { ...env, ...(zeit === null ? {} : { GIT_AUTHOR_DATE: `@${zeit} +0000`, GIT_COMMITTER_DATE: `@${zeit} +0000` }) } },
      ).trim()
    const schreibe = (pfad: string, inhalt: string) => {
      mkdirSync(dirname(join(repo, pfad)), { recursive: true })
      writeFileSync(join(repo, pfad), inhalt)
    }
    const laufAuf = (commit: string) =>
      JSON.stringify({
        episoden: {
          nachher: {
            measuredAtCommit: commit,
            measuredDirty: [],
            ak5: { erfuellt: true, kontrolle: { erwartet: {}, gemessen: {}, ok: true }, fensterOk: true },
          },
        },
      })

    git(null, 'init', '-q', '-b', 'main')
    schreibe('packages/ai/src/adjutant.ts', 'v1\n')
    schreibe('packages/core/src/step.ts', 'v1\n')
    schreibe('data/rules/default/constants.json', '{"v":1}\n')
    schreibe('docs/reports/stance.json', '{}\n')
    schreibe('docs/reports/balance-sweep.md', 'alt\n')
    git(null, 'add', '-A')
    git(1000, 'commit', '-q', '-m', 'basis')
    const basis = git(null, 'rev-parse', 'HEAD')
    git(null, 'branch', 'seite')

    schreibe('docs/reports/stance.json', laufAuf(basis))
    schreibe('docs/reports/balance-sweep.md', 'gemessen auf der Basis\n')
    git(null, 'add', '-A')
    git(3000, 'commit', '-q', '-m', 'main: Messlaeufe auf der alten KI')
    haupt = git(null, 'rev-parse', 'HEAD')

    git(null, 'checkout', '-q', 'seite')
    schreibe('packages/ai/src/adjutant.ts', 'v2\n')
    schreibe('data/rules/default/constants.json', '{"v":2}\n')
    git(null, 'add', '-A')
    git(2000, 'commit', '-q', '-m', 'seite: Automatik und Regeln')

    git(null, 'checkout', '-q', 'main')
    git(4000, 'merge', '-q', '--no-ff', '-m', 'merge seite', 'seite')
  }, 60_000)

  afterAll(() => {
    if (repo) rmSync(repo, { recursive: true, force: true, maxRetries: 3 })
  })

  it('meldet den Haltungs-Messlauf vor dem Merge frisch und danach veraltet', () => {
    const vorher = stanceFreshness(repo, haupt)
    expect(vorher.fresh, vorher.reason).toBe(true)
    const nachher = stanceFreshness(repo)
    expect(nachher.fresh, nachher.reason).toBe(false)
    expect(nachher.reason).toContain('seit dem Messcommit')
    // Alle drei Waechter in einem Aufruf, wie am echten Stand; im Wegwerf-Repo fehlt der Turnierbericht.
    expect(allFreshness(repo).map((waechter: { name: string; fresh: boolean }) => [waechter.name, waechter.fresh])).toEqual([
      ['Parameterlauf', false],
      ['Turnier', false],
      ['Haltungs-Messlauf', false],
    ])
  })

  it('meldet den Parameterlauf vor dem Merge frisch und danach veraltet - dieselbe Luecke', () => {
    const gauge = { name: 'Parameterlauf', report: 'docs/reports/balance-sweep.md', sources: ['data/rules'], command: 'pnpm balance:sweep' }
    const vorher = gaugeFreshness(repo, gauge, haupt)
    expect(vorher.fresh, vorher.reason).toBe(true)
    const nachher = gaugeFreshness(repo, gauge)
    expect(nachher.fresh, nachher.reason).toBe(false)
  })
})

/**
 * Der Turnier-Waechter sieht KI und Kern, der Parameterlauf nicht (Entscheid vom 2026-09-13, DECISIONS.md).
 *
 * Beide Laeufe spielen Partien mit `packages/ai` und `packages/core`. Das Turnier laeuft 13 Sekunden und ist
 * der billige Beleg, dass eine Codeaenderung die KI-Staerke nicht verschiebt; es folgt deshalb jedem Commit an
 * KI und Kern. Der Parameterlauf dauert rund eine Stunde und misst die Empfindlichkeit der Regelzahlen; er
 * bleibt bei Regeln und Karte. Gefahren werden die echten Eintraege aus `GAUGES`, nicht nachgebaute.
 *
 * Wegwerf-Repo: die Basis traegt den Parameterlauf, danach wird der Turnierbericht mit der Messzeile auf der Basis
 * eingecheckt (seit der Nacharbeit zu 8c8c8f6 urteilt der Waechter des Turniers nach dem Messcommit), dann ein
 * Commit an `packages/ai/src`, dann einer an `packages/core/src`.
 */
describe('T-M40-17 Frische nach Abstammung: der Turnier-Waechter sieht KI und Kern, der Parameterlauf nicht', () => {
  type Gauge = { name: string; report: string; sources: string[]; command: string }
  const messgeraet = (name: string): Gauge => {
    const gauge = (GAUGES as Gauge[]).find((eintrag) => eintrag.name === name)
    if (!gauge) throw new Error(`kein Messgeraet ${name} in GAUGES`)
    return gauge
  }
  let repo = ''
  let berichtCommit = ''
  let kiCommit = ''

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'worldwar-turnier-'))
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
    const git = (...args: string[]): string =>
      execFileSync(
        'git',
        ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args],
        { cwd: repo, encoding: 'utf8', env },
      ).trim()
    const schreibe = (pfad: string, inhalt: string) => {
      mkdirSync(dirname(join(repo, pfad)), { recursive: true })
      writeFileSync(join(repo, pfad), inhalt)
    }

    git('init', '-q', '-b', 'main')
    schreibe('packages/ai/src/adjutant.ts', 'v1\n')
    schreibe('packages/core/src/step.ts', 'v1\n')
    schreibe('data/rules/default/constants.json', '{"v":1}\n')
    schreibe('data/maps/world.json', '{}\n')
    schreibe('data/maps/testworld.json', '{}\n')
    schreibe('docs/reports/balance-sweep.md', 'gemessen auf der Basis\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'basis mit dem Parameterlauf')
    const basis = git('rev-parse', 'HEAD')

    schreibe('docs/reports/ai-tournament-run.md', `# KI-Turnier\n\n${measurementLine({ measuredAtCommit: basis, measuredDirty: [] })}\n`)
    git('add', '-A')
    git('commit', '-q', '-m', 'Turnier auf der Basis')
    berichtCommit = git('rev-parse', 'HEAD')

    schreibe('packages/ai/src/adjutant.ts', 'v2\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'KI geaendert')
    kiCommit = git('rev-parse', 'HEAD')

    schreibe('packages/core/src/step.ts', 'v2\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'Kern geaendert')
  }, 60_000)

  afterAll(() => {
    if (repo) rmSync(repo, { recursive: true, force: true, maxRetries: 3 })
  })

  it('meldet das Turnier nach einem Commit an packages/ai/src nicht frisch - und nennt Commit und Pfad', () => {
    const turnier = messgeraet('Turnier')
    const vorher = gaugeFreshness(repo, turnier, berichtCommit)
    expect(vorher.fresh, vorher.reason).toBe(true)
    const nachKi = gaugeFreshness(repo, turnier, kiCommit)
    expect(nachKi.fresh, nachKi.reason).toBe(false)
    expect(nachKi.reason).toContain(kiCommit.slice(0, 7))
    expect(nachKi.reason).toContain('packages/ai/src')
    // Auch ein Commit nur am Kern macht das Turnier alt: HEAD nennt den juengsten Commit an den Quellen.
    const nachKern = gaugeFreshness(repo, turnier)
    expect(nachKern.fresh, nachKern.reason).toBe(false)
    expect(nachKern.reason).toContain('packages/core/src')
    // Alle drei Waechter in einem Aufruf, wie am echten Stand; im Wegwerf-Repo fehlt der Haltungsbericht.
    expect(allFreshness(repo).map((waechter: { name: string; fresh: boolean }) => [waechter.name, waechter.fresh])).toEqual([
      ['Parameterlauf', true],
      ['Turnier', false],
      ['Haltungs-Messlauf', false],
    ])
  })

  it('haelt den Parameterlauf frisch, wenn sich nur KI und Kern aendern - der bewusste Unterschied', () => {
    const parameterlauf = messgeraet('Parameterlauf')
    const nachKi = gaugeFreshness(repo, parameterlauf, kiCommit)
    expect(nachKi.fresh, nachKi.reason).toBe(true)
    const nachKern = gaugeFreshness(repo, parameterlauf)
    expect(nachKern.fresh, nachKern.reason).toBe(true)
  })
})

/**
 * Der Turnierbericht traegt seinen Messcommit (Nacharbeit zu 8c8c8f6, Muster T-M40-17).
 *
 * Das Turnier ist deterministisch. Am 2026-09-13 ergab ein Neulauf auf neuem Code einen zeilengleichen Bericht, und
 * eine unveraenderte Datei laesst sich nicht neu committen: Der Waechter ging nach dem letzten Commit der Datei und
 * blieb "nicht frisch", obwohl frisch gemessen war. Jetzt schreibt der Lauf eine Messzeile
 * (`Gemessen auf: <commit> (Quellen sauber)`), und der Waechter urteilt wie beim Haltungs-Messlauf: Der Messcommit
 * liegt in der Geschichte von HEAD, seitdem kein Commit an den Quellen, gemessen auf sauberen Quellen.
 *
 * Der Parameterlauf bleibt bewusst beim Commit seines Berichts: Er dauert fast zwei Stunden, und bei einer
 * Regelaenderung hat sein Bericht einen echten Diff. Commit-Kennungen in den Einheitsfaellen erfunden.
 */
describe('Frische des Turniers nach Messcommit: Messzeile und Urteil', () => {
  type Gauge = { name: string; report: string; sources: string[]; command: string; judgedBy: string }
  const turnier = (GAUGES as Gauge[]).find((eintrag) => eintrag.name === 'Turnier') as Gauge
  const MESSCOMMIT = 'd'.repeat(40)
  const frisch = {
    gauge: turnier,
    report: { measuredAtCommit: MESSCOMMIT, measuredDirty: [] as string[] },
    sourcesDirty: false,
    measuredAtIsAncestor: true,
    commitsSinceMeasurement: [] as string[],
  }

  it('schreibt die Messzeile und liest sie aus dem Bericht zurueck', () => {
    const sauber = measurementLine({ measuredAtCommit: MESSCOMMIT, measuredDirty: [] })
    expect(sauber).toBe(`Gemessen auf: ${MESSCOMMIT} (Quellen sauber)`)
    const schmutzig = measurementLine({ measuredAtCommit: MESSCOMMIT, measuredDirty: ['packages/ai/src/decide.ts', 'data/rules/default/ai.json'] })
    expect(schmutzig).toBe(`Gemessen auf: ${MESSCOMMIT} (Quellen nicht sauber: packages/ai/src/decide.ts, data/rules/default/ai.json)`)

    expect(parseMeasurementLine(`# KI-Turnier\r\n\r\n${sauber}\r\n\r\n| Paarung |\r\n`)).toEqual({ measuredAtCommit: MESSCOMMIT, measuredDirty: [] })
    expect(parseMeasurementLine(`# KI-Turnier\n\n${schmutzig}\n`)).toEqual({
      measuredAtCommit: MESSCOMMIT,
      measuredDirty: ['packages/ai/src/decide.ts', 'data/rules/default/ai.json'],
    })
    // Ohne git kein Messcommit, und ein Bericht ohne Zeile ist dasselbe.
    expect(parseMeasurementLine(measurementLine({ measuredAtCommit: null, measuredDirty: null }))).toEqual({ measuredAtCommit: null, measuredDirty: null })
    expect(parseMeasurementLine('# KI-Turnier\n\n| Paarung |\n')).toEqual({ measuredAtCommit: null, measuredDirty: null })
    // Unbekannter Arbeitsbaum: der Messcommit steht, der Vermerk fehlt.
    expect(parseMeasurementLine(measurementLine({ measuredAtCommit: MESSCOMMIT, measuredDirty: null }))).toEqual({ measuredAtCommit: MESSCOMMIT, measuredDirty: null })
  })

  it('meldet frisch, wenn der Messcommit in der Geschichte liegt und seitdem kein Commit an den Quellen', () => {
    const status = gaugeMeasurementStatus(frisch)
    expect(status.fresh, status.reason).toBe(true)
    expect(status.reason).toContain('ddddddd')
  })

  it('meldet rot, wenn der Messcommit nicht in der Geschichte von HEAD liegt', () => {
    const status = gaugeMeasurementStatus({ ...frisch, measuredAtIsAncestor: false })
    expect(status.fresh).toBe(false)
    expect(status.reason).toContain('Geschichte')
  })

  it('meldet rot, wenn nach dem Messcommit ein Commit an den Quellen liegt - und nennt Commit und Quellen', () => {
    const status = gaugeMeasurementStatus({ ...frisch, commitsSinceMeasurement: ['a56df6812aac57741823c120392f1a7ab18aedcb'] })
    expect(status.fresh).toBe(false)
    expect(status.reason).toContain('a56df68')
    expect(status.reason).toContain('packages/core/src')
  })

  it('meldet rot bei einem Bericht, der auf schmutzigen Quellen gemessen wurde - eine Notiz daneben zaehlt nicht', () => {
    const schmutzig = gaugeMeasurementStatus({ ...frisch, report: { measuredAtCommit: MESSCOMMIT, measuredDirty: ['docs/plan/PROBLEME.md', 'packages/ai/src/decide.ts'] } })
    expect(schmutzig.fresh).toBe(false)
    expect(schmutzig.reason).toContain('packages/ai/src/decide.ts')
    expect(schmutzig.reason).not.toContain('PROBLEME')
    expect(gaugeMeasurementStatus({ ...frisch, report: { measuredAtCommit: MESSCOMMIT, measuredDirty: ['docs/plan/PROBLEME.md'] } }).fresh).toBe(true)
    expect(gaugeMeasurementStatus({ ...frisch, report: { measuredAtCommit: MESSCOMMIT, measuredDirty: null } }).fresh).toBe(false)
  })

  it('meldet rot bei einem Bericht ohne Messcommit - mit der Aufforderung, neu zu messen', () => {
    const status = gaugeMeasurementStatus({ ...frisch, report: { measuredAtCommit: null, measuredDirty: null }, measuredAtIsAncestor: null, commitsSinceMeasurement: null })
    expect(status.fresh).toBe(false)
    expect(status.reason).toContain('Bericht ohne Messcommit')
    expect(status.reason).toContain('neu messen')
  })

  it('meldet rot bei uncommitteten Quellen, ohne Bericht und wenn git nicht antwortet', () => {
    expect(gaugeMeasurementStatus({ ...frisch, sourcesDirty: true }).fresh).toBe(false)
    expect(gaugeMeasurementStatus({ ...frisch, sourcesDirty: null }).fresh).toBe(false)
    expect(gaugeMeasurementStatus({ ...frisch, report: null }).fresh).toBe(false)
    expect(gaugeMeasurementStatus({ ...frisch, measuredAtIsAncestor: null }).fresh).toBe(false)
    expect(gaugeMeasurementStatus({ ...frisch, commitsSinceMeasurement: null }).fresh).toBe(false)
  })

  it('urteilt beim Turnier nach dem Messcommit, beim Parameterlauf nach dem Commit des Berichts (Haltetest)', () => {
    expect((GAUGES as Gauge[]).map((gauge) => [gauge.name, gauge.judgedBy])).toEqual([
      ['Parameterlauf', 'reportCommit'],
      ['Turnier', 'measuredAtCommit'],
    ])
  })
})

/**
 * Dieselben Faelle gegen ein echtes Repo, mit den echten Eintraegen aus `GAUGES` und `gaugeFreshness`.
 *
 * Der Frisch-Fall bildet die Lage von heute nach: Der Commit der Datei ist aelter als der Quellcommit und kein
 * Nachfahre davon, gemessen wurde aber auf dem Quellcommit. Mit einer Messzeile kennt git diese Lage nur, wenn
 * Messung und Einchecken auf verschiedenen Zweigen liegen. Deshalb wird auf `code` gemessen, der Bericht auf
 * `bericht` zur Zeit 2000 eingecheckt und beides zur Zeit 4000 zusammengefuehrt. Jeder Gegenfall zweigt vom Merge ab.
 */
describe('Frische des Turniers nach Messcommit: im Wegwerf-Repo', () => {
  type Gauge = { name: string; report: string; sources: string[]; command: string; judgedBy: string }
  const messgeraet = (name: string): Gauge => {
    const gauge = (GAUGES as Gauge[]).find((eintrag) => eintrag.name === name)
    if (!gauge) throw new Error(`kein Messgeraet ${name} in GAUGES`)
    return gauge
  }
  const REPORT = 'docs/reports/ai-tournament-run.md'
  let repo = ''
  const ref = { basis: '', code: '', bericht: '', merge: '', fremd: '', kopiert: '', kern: '', nachgezogen: '', schmutzig: '', ohne: '', regeln: '', sweep: '' }

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'worldwar-messzeile-'))
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
    const git = (zeit: number | null, ...args: string[]): string =>
      execFileSync(
        'git',
        ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args],
        { cwd: repo, encoding: 'utf8', env: { ...env, ...(zeit === null ? {} : { GIT_AUTHOR_DATE: `@${zeit} +0000`, GIT_COMMITTER_DATE: `@${zeit} +0000` }) } },
      ).trim()
    const schreibe = (pfad: string, inhalt: string) => {
      mkdirSync(dirname(join(repo, pfad)), { recursive: true })
      writeFileSync(join(repo, pfad), inhalt)
    }
    const commit = (zeit: number, name: keyof typeof ref, nachricht: string) => {
      git(null, 'add', '-A')
      git(zeit, 'commit', '-q', '-m', nachricht)
      ref[name] = git(null, 'rev-parse', 'HEAD')
    }
    const bericht = (zeile: string | null, tabelle = '| schwer gegen leicht, im Krieg | 25 | 0 |') =>
      `# KI-Turnier - letzter Lauf\n\n${zeile === null ? '' : `${zeile}\n\n`}${tabelle}\n`
    const gemessenAuf = (commitId: string, measuredDirty: string[] = []) => measurementLine({ measuredAtCommit: commitId, measuredDirty })

    git(null, 'init', '-q', '-b', 'main')
    schreibe('packages/ai/src/adjutant.ts', 'v1\n')
    schreibe('packages/core/src/step.ts', 'v1\n')
    schreibe('data/rules/default/constants.json', '{"v":1}\n')
    schreibe('data/maps/world.json', '{}\n')
    schreibe('data/maps/testworld.json', '{}\n')
    schreibe('docs/reports/balance-sweep.md', 'Parameterlauf auf der Basis\n')
    commit(1000, 'basis', 'basis mit dem Parameterlauf')
    git(null, 'branch', 'bericht')

    schreibe('packages/ai/src/adjutant.ts', 'v2\n')
    commit(3000, 'code', 'code: KI geaendert')

    git(null, 'checkout', '-q', 'bericht')
    schreibe(REPORT, bericht(gemessenAuf(ref.code)))
    commit(2000, 'bericht', 'bericht: Turnier, gemessen auf code')

    git(null, 'checkout', '-q', 'main')
    git(4000, 'merge', '-q', '--no-ff', '-m', 'merge bericht', 'bericht')
    ref.merge = git(null, 'rev-parse', 'HEAD')

    // Gegenfall 1: gemessen auf einem Zweig, den HEAD nicht enthaelt.
    git(null, 'checkout', '-q', '-b', 'fremd', ref.merge)
    schreibe('packages/core/src/step.ts', 'fremd\n')
    commit(5000, 'fremd', 'fremd: Kern geaendert, nie zusammengefuehrt')
    git(null, 'checkout', '-q', '-b', 'kopiert', ref.merge)
    schreibe(REPORT, bericht(gemessenAuf(ref.fremd)))
    commit(5100, 'kopiert', 'kopiert: Bericht aus fremd')

    // Gegenfall 2: nach dem Messcommit ein Commit am Kern, danach nur eine Textkorrektur am Bericht.
    git(null, 'checkout', '-q', '-b', 'nachgezogen', ref.merge)
    schreibe('packages/core/src/step.ts', 'v2\n')
    commit(5000, 'kern', 'nachgezogen: Kern geaendert')
    schreibe(REPORT, bericht(gemessenAuf(ref.code), '| schwer gegen leicht, im Krieg (Tippfehler behoben) | 25 | 0 |'))
    commit(5100, 'nachgezogen', 'nachgezogen: Textkorrektur am Bericht')

    // Gegenfall 3: auf dem Merge gemessen, aber mit uncommitteter Automatik.
    git(null, 'checkout', '-q', '-b', 'schmutzig', ref.merge)
    schreibe(REPORT, bericht(gemessenAuf(ref.merge, ['packages/ai/src/adjutant.ts'])))
    commit(5000, 'schmutzig', 'schmutzig: Bericht mit uncommitteten Quellen')

    // Gegenfall 4: ein Bericht ohne Messzeile, eingecheckt nach allen Quellcommits.
    git(null, 'checkout', '-q', '-b', 'ohne', ref.merge)
    schreibe(REPORT, bericht(null))
    commit(5000, 'ohne', 'ohne: Bericht ohne Messzeile')

    // Haltetest: eine Regelaenderung, danach ein neuer Parameterlauf ohne Messzeile.
    git(null, 'checkout', '-q', '-b', 'regeln', ref.merge)
    schreibe('data/rules/default/constants.json', '{"v":2}\n')
    commit(5000, 'regeln', 'regeln: Regeln geaendert')
    schreibe('docs/reports/balance-sweep.md', 'Parameterlauf auf den neuen Regeln\n')
    commit(5100, 'sweep', 'regeln: Parameterlauf neu')

    git(null, 'checkout', '-q', 'main')
  }, 60_000)

  afterAll(() => {
    if (repo) rmSync(repo, { recursive: true, force: true, maxRetries: 3 })
  })

  it('meldet das Turnier frisch, obwohl der Commit der Datei aelter ist als der Quellcommit', () => {
    const turnier = messgeraet('Turnier')
    // Die Lage, an der der alte Waechter haengen blieb: Der letzte Commit der Datei ist `bericht`, und seitdem liegt `code` an den Quellen.
    expect(lastCommitOf(repo, REPORT, ref.merge)).toBe(ref.bericht)
    expect(commitsSince(repo, ref.bericht, turnier.sources, ref.merge)).toEqual([ref.code])
    const status = gaugeFreshness(repo, turnier, ref.merge)
    expect(status.fresh, status.reason).toBe(true)
    expect(status.reason).toContain(ref.code.slice(0, 7))
  })

  it('meldet das Turnier rot, wenn der Messcommit kein Vorfahr von HEAD ist', () => {
    const status = gaugeFreshness(repo, messgeraet('Turnier'), ref.kopiert)
    expect(status.fresh, status.reason).toBe(false)
    expect(status.reason).toContain('Geschichte')
    expect(status.reason).toContain(ref.fremd.slice(0, 7))
  })

  it('meldet das Turnier rot bei einem Quellcommit nach dem Messcommit - auch wenn der Bericht danach noch einmal committet wurde', () => {
    const status = gaugeFreshness(repo, messgeraet('Turnier'), ref.nachgezogen)
    expect(status.fresh, status.reason).toBe(false)
    expect(status.reason).toContain(ref.kern.slice(0, 7))
  })

  it('meldet das Turnier rot, wenn beim Messen Quellen uncommittet waren', () => {
    const status = gaugeFreshness(repo, messgeraet('Turnier'), ref.schmutzig)
    expect(status.fresh, status.reason).toBe(false)
    expect(status.reason).toContain('packages/ai/src/adjutant.ts')
  })

  it('meldet das Turnier rot bei einem Bericht ohne Messcommit', () => {
    const status = gaugeFreshness(repo, messgeraet('Turnier'), ref.ohne)
    expect(status.fresh, status.reason).toBe(false)
    expect(status.reason).toContain('Bericht ohne Messcommit')
    expect(status.reason).toContain('neu messen')
  })

  it('laesst den Parameterlauf beim Commit seines Berichts - ohne Messzeile frisch, sobald neu eingecheckt ist (Haltetest)', () => {
    const parameterlauf = messgeraet('Parameterlauf')
    expect(gaugeFreshness(repo, parameterlauf, ref.merge).fresh).toBe(true)
    const nachRegeln = gaugeFreshness(repo, parameterlauf, ref.regeln)
    expect(nachRegeln.fresh, nachRegeln.reason).toBe(false)
    expect(nachRegeln.reason).toContain(ref.regeln.slice(0, 7))
    const neu = gaugeFreshness(repo, parameterlauf, ref.sweep)
    expect(neu.fresh, neu.reason).toBe(true)
    // Auf demselben Stand bleibt das Turnier rot: sein Messcommit liegt vor der Regelaenderung.
    expect(gaugeFreshness(repo, messgeraet('Turnier'), ref.sweep).fresh).toBe(false)
  })

  it('nimmt den Messstand wie der Haltungs-Messlauf: HEAD und die uncommitteten Dateien unter den Quellen', () => {
    const turnier = messgeraet('Turnier')
    expect(measurementStamp(repo, turnier.sources)).toEqual({ measuredAtCommit: ref.merge, measuredDirty: [] })
    const neu = join(repo, 'packages/ai/src/neu.ts')
    const notiz = join(repo, 'NOTIZ.md')
    try {
      writeFileSync(neu, 'neu\n')
      writeFileSync(notiz, 'nicht unter den Quellen\n')
      expect(measurementStamp(repo, turnier.sources)).toEqual({ measuredAtCommit: ref.merge, measuredDirty: ['packages/ai/src/neu.ts'] })
    } finally {
      rmSync(neu, { force: true })
      rmSync(notiz, { force: true })
    }
  })
})
