import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hasKey } from '../../apps/desktop/src/i18n/text'
import { productionFiles } from './scan'

/**
 * Jeder Schluessel, den der Code abfragt, existiert auch (R-UI-07, Playtest 2026-09-06).
 *
 * Der Katalogtest in apps/desktop/src/i18n/text.test.ts prueft die Vollstaendigkeit in
 * EINER Richtung: fuer jeden Kommandofehler, jede Ereignisart, jeden Rohstoff, jedes
 * Gebaeude gibt es einen deutschen Satz. Die Gegenrichtung prueft er nicht — und genau
 * dort lag der Fehler, den erst der Playtest fand: `t('province.cancelBuild')` fragte
 * einen Schluessel ab, den niemand angelegt hatte (er heisst `actions.cancelBuild`), und
 * auf dem Bildschirm stand unter "Im Bau" die Zeichenfolge `[province.cancelBuild]`.
 *
 * Bitter daran ist die zweite Haelfte: `t()` macht einen fehlenden Schluessel absichtlich
 * sichtbar statt still leer zu liefern, und dieses Verhalten hat einen eigenen gruenen
 * Test ("macht einen fehlenden Schluessel sichtbar"). Der Mechanismus, der den rohen
 * Schluessel vor den Spieler brachte, war also selbst geprueft — nur niemand prueft, ob
 * er je greifen muss. Eine Notbremse ersetzt die Pruefung nicht.
 */

/** Nur statische Aufrufe: t('a.b') und t("a.b"). Zusammengesetzte kann kein Test aufloesen. */
const STATISCH = /\bt\(\s*(['"])([\w.]+)\1/g
/** Zusammengesetzte: t(`buildings.${x}`) — zaehlbar, aber nicht aufloesbar. */
const DYNAMISCH = /\bt\(\s*`/g

function abgefragteSchluessel() {
  const treffer = new Map<string, string>()
  let dynamisch = 0

  for (const datei of productionFiles()) {
    if (!/\.tsx?$/.test(datei)) continue
    const text = readFileSync(datei, 'utf8')

    dynamisch += [...text.matchAll(DYNAMISCH)].length
    for (const fund of text.matchAll(STATISCH)) {
      const key = fund[2]!
      // Ein Schluessel ohne Punkt ist eine Variable oder ein Aufruf, kein Katalogpfad.
      if (!key.includes('.')) continue
      if (!treffer.has(key)) treffer.set(key, datei)
    }
  }
  return { treffer, dynamisch }
}

describe('R-UI-07 Jeder abgefragte Textschluessel existiert', () => {
  const { treffer, dynamisch } = abgefragteSchluessel()

  it('findet ueberhaupt Aufrufe — sonst prueft der Waechter das Nichts', () => {
    // Die Lehre vom 2026-09-05: "fuer jedes X gilt Y" ist wahr, wenn es kein X gibt.
    expect(treffer.size).toBeGreaterThan(50)
  })

  it('kennt jeden statisch abgefragten Schluessel', () => {
    const fehlend = [...treffer.entries()]
      .filter(([key]) => !hasKey(key))
      .map(([key, datei]) => `${key} (${datei})`)
    expect(fehlend, `abgefragt, aber nicht im Katalog:\n${fehlend.join('\n')}`).toEqual([])
  })

  it('sagt, wie viele Aufrufe es NICHT pruefen kann', () => {
    // Kein stiller Deckel: zusammengesetzte Schluessel wie t(`buildings.${x}`) bleiben
    // ungeprueft, und das gehoert benannt statt verschwiegen. Fuer sie sorgen die
    // Katalogtests in text.test.ts, die von den Regeldaten her pruefen.
    expect(dynamisch).toBeGreaterThan(0)
    expect(dynamisch).toBeLessThan(treffer.size)
  })

  it('faellt gegen einen Schluessel, den es nicht gibt', () => {
    // Damit die Pruefung nicht bedeutungslos wird, sobald die echten Pfade stimmen.
    expect(hasKey('province.cancelBuild')).toBe(false)
    expect(hasKey('actions.cancelBuild')).toBe(true)
  })
})
