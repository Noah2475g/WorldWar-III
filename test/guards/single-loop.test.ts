import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, productionFiles } from './scan'

/**
 * Es gibt genau eine Spielschleife (T-M14-04, Ursache C des Audits).
 *
 * Vier Fassungen hatte dieses Projekt, und sie beschrieben verschiedene Spiele. Die
 * schlimmste stand im Parameterlauf: ein `runAi` je Spieltag, dessen Befehlspaket auf alle
 * 24 Ticks angewandt wurde. Das ist nicht bloß eine Doppelung — `shouldThinkThisTick`
 * verteilt die Denkzeit über `tick % aiCount`, und wenn `tick` immer ein Vielfaches von 24
 * ist, denkt bei sechs Mächten nur die erste. Jede Balancezahl beschrieb bis dahin eine
 * Welt, in der fünf von sechs Nationen stillstehen.
 *
 * Der Wächter ist bewusst grob: Wer `runAi` **und** `runTicks` in derselben Datei aufruft,
 * schreibt eine Schleife — und die gibt es schon.
 */

/** Die eine Schleife, die es geben darf. */
const DIE_EINE = 'packages/ai/src/loop.ts'

function dateienMitEigenerSchleife(): string[] {
  return productionFiles()
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => relative(ROOT, file).replaceAll('\\', '/') !== DIE_EINE)
    .filter((file) => {
      const text = readFileSync(file, 'utf8')
      return /\brunAi\s*\(/.test(text) && /\brunTicks\s*\(/.test(text)
    })
    .map((file) => relative(ROOT, file).replaceAll('\\', '/'))
}

describe('R-ARCH-05 Es gibt eine Spielschleife', () => {
  it('niemand baut neben der gemeinsamen Schleife eine zweite', () => {
    const treffer = dateienMitEigenerSchleife()
    expect(
      treffer,
      `Diese Dateien rufen runAi und runTicks selbst auf, statt advanceTicks zu benutzen:\n${treffer.join('\n')}`,
    ).toEqual([])
  })

  it('der Waechter sieht ueberhaupt etwas', () => {
    // Ein Wächter über einer leeren Menge ist immer grün — das war am 2026-09-05 der
    // Befund bei den Schrift-Wächtern (N1). Also: die durchsuchte Menge ist nicht leer,
    // und die eine erlaubte Schleife existiert wirklich.
    const dateien = productionFiles().filter((f) => /\.tsx?$/.test(f))
    expect(dateien.length).toBeGreaterThan(50)
    expect(dateien.some((f) => relative(ROOT, f).replaceAll('\\', '/') === DIE_EINE)).toBe(true)
  })
})
