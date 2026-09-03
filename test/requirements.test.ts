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

  it('laeuft als Skript und meldet den Stand mit Exit-Code', () => {
    // Regression guard: the script once exported everything correctly and still did
    // nothing at all, because its "am I the entry point?" check compared a hand-built
    // file:// string that never matches on Windows. Unit tests of the pure functions
    // could not see that — only running it as a script can.
    const script = fileURLToPath(new URL('../scripts/requirements-coverage.mjs', import.meta.url))
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' })

    expect(result.stdout).toMatch(/Anforderungen gesamt:\s+\d+/)
    expect(result.stdout).toMatch(/mit belegtem Test:\s+\d+/)
    // Der Exit-Code muss zu dem passen, was das Skript gerade berichtet: rot, solange
    // eine Anforderung offen ist, gruen, wenn keine mehr offen ist. Auf "immer 1"
    // festgenagelt war der Test bis T-M12-03 richtig — und danach einer, der das
    // Erreichen des Ziels als Fehler gemeldet haette.
    const open = /Offen ((d+))/.exec(result.stdout)
    expect(result.status, result.stdout).toBe(open ? 1 : 0)
    if (!open) expect(result.stdout).toMatch(/Jede V1-Anforderung ist durch mindestens einen Test belegt/)
  })
})
