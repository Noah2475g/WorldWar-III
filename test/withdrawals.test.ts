import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Zurückgenommene Zusagen (T-M14-03).
 *
 * Sechs Dinge, die die Dokumente versprachen und der Code nie hatte. Noahs Entscheidung
 * vom 2026-09-05: nicht als Aufgabe führen, sondern als Zusage zurücknehmen und begründen
 * — ein Plan, der nur wächst, wird nie fertig.
 *
 * Diese Datei prüft, dass die Rücknahme wirklich stattgefunden hat und nicht nur
 * beschlossen wurde. Der Testblock trägt bewusst `R-ARCH-05` und **nicht** die gekürzten
 * Anforderungs-IDs: sonst zählte das Anforderungstor eine Dokumentprüfung als Beleg für
 * das Verhalten, das hier gerade gestrichen wird.
 */

const url = (name: string) => new URL(`../docs/plan/${name}`, import.meta.url)
const requirements = readFileSync(url('01-REQUIREMENTS.md'), 'utf8')
const design = readFileSync(url('02-DESIGN.md'), 'utf8')
const decisions = readFileSync(url('DECISIONS.md'), 'utf8')

/**
 * Was eine Anforderung heute noch **zusagt** — ohne den Vermerk, der die Rücknahme
 * begründet.
 *
 * Die Unterscheidung ist der Punkt: „Fluss" darf im Text stehen, solange der Satz lautet
 * *„der Malus für Flussübergänge ist zurückgenommen"*. Ein Test, der bloß das Wort
 * verbietet, zwänge dazu, die Rücknahme unbegründet zu lassen — und genau die Begründung
 * ist das, was hier gebaut wird. Der Vermerk beginnt mit `*(`.
 */
function activePromise(id: string): string {
  const start = requirements.indexOf(`- **${id}`)
  expect(start, `${id} steht nicht mehr in 01-REQUIREMENTS.md`).toBeGreaterThan(-1)
  const next = requirements.indexOf('\n- **R-', start + 1)
  const block = requirements.slice(start, next === -1 ? undefined : next)
  const vermerk = block.indexOf('*(')
  return vermerk === -1 ? block : block.slice(0, vermerk)
}

/** Der Entwurf ohne seine Rücknahme-Blockzitate (Zeilen, die mit „>" beginnen). */
const activeDesign = design
  .split('\n')
  .filter((zeile) => !zeile.trimStart().startsWith('>'))
  .join('\n')

describe('R-ARCH-05 Zurückgenommene Zusagen', () => {
  it('R-ECON-03 verspricht keinen Gebäudeunterhalt mehr', () => {
    // Nachgeprüft: BuildingRule kennt kein upkeep-Feld, buildings.json auch nicht, und
    // die Unterhaltsphase sammelt den Bedarf ausschließlich über draft.armyOrder.
    expect(activePromise('R-ECON-03')).not.toMatch(/Gebäude/)
  })

  it('R-UNIT-07 verspricht keine Einheitenmoral mehr', () => {
    // Ein Verband ist { unitKey, hpTotal } — mehr trägt er nicht.
    expect(activePromise('R-UNIT-07')).not.toMatch(/Moral/)
  })

  it('R-GAME-02 bietet den Zeitsieg nicht mehr zur Auswahl an', () => {
    const block = activePromise('R-GAME-02')
    expect(block).not.toMatch(/Zeitlimit|Zeitsieg/)
  })

  it('R-BAT-03 verspricht keinen Übergangsmalus mehr', () => {
    expect(activePromise('R-BAT-03')).not.toMatch(/Fluss|Meerenge/)
  })

  it('der Entwurf kennt weder Garnisonsunterdrückung noch Aufständische', () => {
    expect(activeDesign).not.toMatch(/Garnison unterdrückt|Aufständischen-Armee|Rebellenarmee/)
  })

  it('der Entwurf kennt keine E2E-Stufe mit Playwright', () => {
    expect(activeDesign).not.toMatch(/Playwright/)
    expect(design).not.toMatch(/apps\/desktop\/e2e/)
  })

  it('C-02 nennt den Browserbau und M16', () => {
    const block = requirements.slice(requirements.indexOf('| C-02 |'))
    const zeile = block.slice(0, block.indexOf('\n'))
    expect(zeile).toMatch(/IndexedDB/)
    expect(zeile).toMatch(/M16/)
  })

  it('jede Rücknahme ist in DECISIONS.md begründet', () => {
    // Sieben Entscheidungen, jede mit Datum und der Aufgabe, die sie ausgeführt hat.
    const eintraege = decisions.split('\n').filter((z) => z.startsWith('## 2026-09-05'))
    expect(eintraege.length).toBeGreaterThanOrEqual(7)
    for (const stichwort of [
      'Gebäude verbrauchen nichts',
      'Einheiten haben keine Moral',
      'Garnison',
      'E2E',
      'Zeitsieg',
      'Flüsse und Meerengen',
    ]) {
      expect(decisions, `keine Begründung zu: ${stichwort}`).toContain(stichwort)
    }
  })

  it('crossingFactor ist gelöscht, nicht nur unbenutzt', () => {
    const combat = readFileSync(new URL('../packages/core/src/rules/combat.ts', import.meta.url), 'utf8')
    expect(combat).not.toMatch(/export function crossingFactor/)
  })

  it('jeder offene Befund hat einen Ort — Rücknahme oder Akte', () => {
    // Die acht kleineren Befunde aus dem Audit, für die es keine Aufgabe gibt. Keiner
    // darf zwischen "nicht gebaut" und "nicht entschieden" verschwinden.
    const probleme = readFileSync(url('PROBLEME.md'), 'utf8')
    const beide = `${decisions}\n${probleme}`
    for (const stichwort of [
      'MapCanvas',
      'Kohle',
      'R-AI-04',
      'Hauptstadtverlegung',
      'Vorratsaufbau',
      'Belegstatus',
      'Teleport',
      'Barrierefreiheit',
    ]) {
      expect(beide, `ohne Ort: ${stichwort}`).toContain(stichwort)
    }
  })
})
