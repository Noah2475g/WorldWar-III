import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { analyse, parseRequirements, parseTests } from '../scripts/requirements-coverage.mjs'

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
    const text = readFileSync(new URL('../docs/plan/01-REQUIREMENTS.md', import.meta.url), 'utf8')
    const { nameLevel, ids } = parseRequirements(text)
    expect(nameLevel.size).toBeLessThanOrEqual(26)
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
