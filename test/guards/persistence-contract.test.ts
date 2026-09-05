import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, productionFiles } from './scan'

/**
 * Der Speichervertrag läuft gegen jede Umsetzung, nicht gegen eine (T-M14-08).
 *
 * Der Plan führte seit M8 eine „Vertragstestreihe gegen alle drei Umsetzungen" als
 * erledigt. Es gab eine Umsetzung — `MemoryStorage`, eine `Map` — und der „Vertrag" war
 * ein einzelnes `it()`, das sie gegen sich selbst prüfte. Währenddessen speicherte die
 * ausgelieferte Anwendung in den Arbeitsspeicher, meldete „gespeichert", und nach dem
 * Schließen des Fensters war alles weg (`docs/reports/audit-2026-09-05.md`, Blocker 1/4/6).
 *
 * Dieser Wächter prüft die Sache, nicht ihre Behauptung: Für **jede** Klasse, die den Port
 * umsetzt, muss `storagePortContract` mit ihr aufgerufen werden. Wer eine weitere
 * Umsetzung schreibt und den Vertrag vergisst, bekommt hier einen roten Test — statt in
 * einem halben Jahr einen Spieler, der seinen Spielstand verliert.
 */

const VERTRAG = 'storagePortContract'

function testFiles(dir: string, out: string[] = []): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (['node_modules', 'dist', 'coverage', 'target'].includes(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) testFiles(full, out)
    else if (/\.test\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

/** Jede Klasse, die `implements StoragePort` sagt. */
function umsetzungen(): { name: string; file: string }[] {
  const gefunden: { name: string; file: string }[] = []
  for (const file of productionFiles()) {
    if (!/\.tsx?$/.test(file)) continue
    for (const match of readFileSync(file, 'utf8').matchAll(
      /export class (\w+)\s+implements\s+StoragePort/g,
    )) {
      gefunden.push({ name: match[1]!, file: relative(ROOT, file).replaceAll('\\', '/') })
    }
  }
  return gefunden
}

describe('R-GAME-03 Der Speichervertrag gilt fuer jede Umsetzung', () => {
  it('findet ueberhaupt Umsetzungen', () => {
    // Ein Wächter über einer leeren Menge ist immer grün — das war am 2026-09-05 der
    // Befund bei den Schrift-Wächtern (N1). Zwei müssen es mindestens sein: der Speicher
    // der Anwendung und der für Tests.
    expect(umsetzungen().length).toBeGreaterThanOrEqual(2)
  })

  it('prueft jede Umsetzung gegen den Vertrag', () => {
    const text = [...testFiles(join(ROOT, 'packages')), ...testFiles(join(ROOT, 'apps'))]
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')

    const ungeprueft = umsetzungen()
      .filter(({ name }) => !new RegExp(`${VERTRAG}\\([^)]*\\b${name}\\b`, 's').test(text))
      .map(({ name, file }) => `${name} (${file})`)

    expect(
      ungeprueft,
      `Diese Umsetzungen des StoragePort laufen gegen keinen Vertrag:\n${ungeprueft.join('\n')}`,
    ).toEqual([])
  })
})
