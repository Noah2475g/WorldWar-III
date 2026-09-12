import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './guards/scan'

/**
 * Every number in the game has a status (T-M12-01, R-ECON-01/R-UNIT-01, design D17).
 *
 * A balancing document is only worth something as long as it is complete, and a
 * document kept complete by discipline is a document that is out of date. So this test
 * demands a line for every constant the rules define: add a number without saying where
 * it came from and the test run fails.
 */

const doc = readFileSync(join(ROOT, 'docs/plan/BALANCING.md'), 'utf8')
const constants = JSON.parse(
  readFileSync(join(ROOT, 'data/rules/default/constants.json'), 'utf8'),
) as Record<string, unknown>

const STATUSES = ['belegt', 'abgeleitet', 'geschätzt']

describe('D17 Jede Zahl ist als belegt oder geschaetzt markiert', () => {
  it('fuehrt jede Konstante der Regeln auf', () => {
    const missing = Object.entries(constants)
      .filter(([key, value]) => typeof value === 'number' && !key.startsWith('_'))
      .map(([key]) => key)
      .filter((key) => !doc.includes(`\`${key}\``))

    expect(missing, `ohne Eintrag in BALANCING.md: ${missing.join(', ')}`).toEqual([])
  })

  it('gibt jeder aufgefuehrten Konstante einen Status', () => {
    const rows = doc.split('\n').filter((line) => /^\| `\w+` \|/.test(line))

    expect(rows.length).toBeGreaterThan(50)
    for (const row of rows) {
      const named = STATUSES.some((status) => row.includes(status))
      expect(named, `ohne Status: ${row.slice(0, 60)}`).toBe(true)
    }
  })

  it('nennt fuer jede belegte Zahl eine Quelle', () => {
    // "belegt" without a source is just a claim with a nicer word for it.
    const proven = doc.split('\n').filter((line) => line.includes('| belegt |'))

    expect(proven.length).toBeGreaterThan(10)
    for (const row of proven) {
      // A markdown row ends on a pipe, so the last cell is the one before the empty tail.
      const source = row.split('|').map((cell) => cell.trim()).filter(Boolean).pop() ?? ''
      // Not a length rule: 'Day Change' is a perfectly good citation. What must not
      // happen is an empty cell or a dash standing in for a source.
      expect(source, `belegt ohne Quelle: ${row.slice(0, 50)}`).not.toBe('—')
      expect(source.length, `belegt ohne Quelle: ${row.slice(0, 50)}`).toBeGreaterThan(4)
    }
  })

  it('haelt fest, was der Parameterlauf ergeben hat', () => {
    // The document has to carry the measurement, not just the intention to measure.
    expect(doc).toContain('Parameterlauf')
    expect(doc).toMatch(/tragend/)
  })
})

/**
 * Die Freischaltungsachse ist genauso zu belegen wie jede andere Zahl (T-M15-02).
 *
 * Bis zum 2026-09-06 las dieser Test ausschliesslich `constants.json` — die 17 neuen
 * Zahlen in `buildings.json` und `units.json` waeren also unbemerkt ohne Herkunft
 * geblieben. Genau so entstehen die Zahlen, die spaeter niemand mehr begruenden kann.
 */
describe('R-TECH-01 Jeder erste Spieltag ist begruendet', () => {
  const rules = (name: string): Record<string, { availableFromDay?: number }> => {
    const raw = JSON.parse(readFileSync(join(ROOT, `data/rules/default/${name}.json`), 'utf8')) as Record<
      string,
      Record<string, { availableFromDay?: number }>
    >
    return raw[name]!
  }

  const buildings = rules('buildings')
  const units = rules('units')

  it('fuehrt jedes Gebaeude und jede Einheit mit Tag und Status auf', () => {
    const entries = [...Object.entries(buildings), ...Object.entries(units)]
    expect(entries.length, 'Regelwerk ohne Gebaeude oder Einheiten').toBe(17)

    const missing: string[] = []
    for (const [key, rule] of entries) {
      const row = doc.split('\n').find((line) => line.startsWith(`| \`${key}\` |`))
      if (!row) {
        missing.push(`${key}: keine Zeile`)
        continue
      }
      const cells = row.split('|').map((cell) => cell.trim())
      if (cells[2] !== String(rule.availableFromDay)) {
        missing.push(`${key}: Tabelle sagt ${cells[2]}, Regelwerk ${rule.availableFromDay}`)
      }
      if (!STATUSES.some((status) => row.includes(status))) missing.push(`${key}: ohne Status`)
      if ((cells[4] ?? '').length < 10) missing.push(`${key}: ohne Begruendung`)
    }

    expect(missing, `Freischaltungstage ohne vollstaendigen Eintrag:\n${missing.join('\n')}`).toEqual([])
  })

  it('fuehrt keinen Freischaltungstag mehr als belegt (T-M34-02)', () => {
    // Bis zum 2026-09-12 stand hier die Gegenrichtung: genau fuenf Tage mussten "belegt"
    // sein (Kaserne, Hafen, Eisenbahn, Fabrik, Flugplatz aus Referenz 1.4). Der Test war
    // richtig gegen den Fehler, den er abwehren sollte — eine Tabelle, die Quellen
    // behauptet, die es nicht gibt. Er war falsch in der Sache: **eine belegte Zahl ist
    // nur in ihrer eigenen Zeitrechnung belegt.** Im Vorbild ist ein Spieltag ein echter
    // Tag, hier sind es 24 Sekunden bei Tempo 1; dieselbe Leiter dauert dort sechzehn
    // Tage und hier 6,4 Minuten. Entscheid in DECISIONS.md (2026-09-12, T-M34-02).
    const stillProven = [...Object.entries(buildings), ...Object.entries(units)]
      .filter(([key]) => doc.split('\n').some((line) => line.startsWith(`| \`${key}\` |`) && line.includes('belegt')))
      .map(([key]) => key)

    expect(stillProven.sort(), 'ein Freischaltungstag steht wieder als belegt').toEqual([])
  })

  it('haelt die Gegenrede fest, statt die Quelle stillschweigend fallen zu lassen', () => {
    // Der Preis des Tests darueber: "keine Zeile sagt belegt" waere auch dann gruen, wenn
    // jemand die Referenz einfach geloescht haette. Beides muss dastehen — die Tage des
    // Vorbilds UND der Grund, warum sie hier nicht gelten.
    const requirements = readFileSync(join(ROOT, 'docs/plan/01-REQUIREMENTS.md'), 'utf8')
    const rTech = requirements.slice(requirements.indexOf('**R-TECH-01'), requirements.indexOf('**R-TECH-02'))

    expect(rTech, 'R-TECH-01 nennt die Tage des Vorbilds nicht mehr').toMatch(/Tag 1, 2, 5, 8 und 10/)
    expect(rTech, 'R-TECH-01 fuehrt keine Zeitrechnung als Grund').toMatch(/6,4 Minuten/)
    expect(doc, 'BALANCING.md nennt den Grund der Umstufung nicht').toMatch(/T-M34-02/)
  })
})

/**
 * Die Stufenzahlen der KI stehen genauso in der Tabelle wie jede andere Zahl (T-M34-07).
 *
 * **Der Befund, der diesen Waechter erzwungen hat:** `BALANCING.md` fuehrte fuer
 * `recruitShare` die Werte 80 / 120 / 500, `ai.json` seit dem 2026-09-06 15:47 die Werte
 * 80 / 200 / 360 — die Tabelle war um einen Commit veraltet, sechs Tage lang, und
 * niemandem fiel es auf. Der Waechter darueber liest ausschliesslich `constants.json`;
 * die Stufenzahlen der KI lagen ausserhalb seines Blickfelds.
 *
 * Dieselbe Fehlerklasse wie am 2026-09-06 („der Waechter las nur constants.json, die 17
 * Freischaltungstage waeren unbemerkt ohne Herkunft geblieben") — und dieselbe Lehre:
 * eine Reparatur gehoert auf die **Fehlerklasse**, nicht auf den einen Fundort.
 */
describe('D17 Die Stufenzahlen der KI stehen in der Tabelle', () => {
  const ai = JSON.parse(readFileSync(join(ROOT, 'data/rules/default/ai.json'), 'utf8')) as {
    difficulties: Record<string, Record<string, number>>
  }
  const NAMEN: Readonly<Record<string, string>> = { easy: 'leicht', normal: 'normal', hard: 'schwer' }
  /** Die Spalten, die die Tabelle fuehrt — mehr verlangt der Waechter nicht. */
  const SPALTEN = ['warThreshold', 'trustThreshold', 'recruitShare'] as const

  const zeileFuer = (stufe: string): string[] => {
    const zeile = doc.split('\n').find((line) => line.startsWith(`| ${NAMEN[stufe]} |`))
    return (zeile ?? '').split('|').map((cell) => cell.trim().replace(/\*/g, ''))
  }

  it('fuehrt jede der drei Stufen mit einer Zeile', () => {
    expect(Object.keys(ai.difficulties).sort()).toEqual(['easy', 'hard', 'normal'])
    for (const stufe of Object.keys(ai.difficulties)) {
      expect(zeileFuer(stufe).length, `keine Zeile fuer ${NAMEN[stufe]}`).toBeGreaterThan(4)
    }
  })

  it('nennt dieselben Zahlen wie das Regelwerk', () => {
    const falsch: string[] = []
    for (const [stufe, werte] of Object.entries(ai.difficulties)) {
      const zellen = zeileFuer(stufe)
      SPALTEN.forEach((spalte, index) => {
        const inTabelle = zellen[index + 2]
        if (inTabelle !== String(werte[spalte])) {
          falsch.push(`${NAMEN[stufe]}.${spalte}: Tabelle ${inTabelle}, Regelwerk ${werte[spalte]}`)
        }
      })
    }

    expect(falsch, `Tabelle und Regelwerk sagen Verschiedenes:\n${falsch.join('\n')}`).toEqual([])
  })
})
