import { execFileSync } from 'node:child_process'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, isTestFile, productionFiles } from './scan'

/**
 * Was `productionFiles()` liest — und was nicht (T-M38-11, Befund M38-4).
 *
 * Der Kopf der Funktion sagt seit M1 „Product source only — tests are out of scope", der
 * Filter dahinter lautete `!f.endsWith('.test.ts')`. Eine `.test.tsx` endet nicht auf
 * `.test.ts`: am 2026-09-14 waren 21 von 193 gelieferten Dateien Testdateien, am
 * 2026-09-18 waren es 22 von 205. Zwoelf Waechter lasen damit Dateien, die ihr eigener
 * Kopf ausschliesst — strenger als behauptet, und wer einen Treffer sah, suchte ihn
 * zuerst im Produktcode.
 *
 * Die zweite Liste kommt mit Absicht aus einem **anderen Werkzeug** (`git ls-files`) und
 * nicht aus demselben Verzeichnislauf: ein Filter, der gegen sich selbst geprueft wird,
 * ist immer vollstaendig.
 */

const norm = (file: string): string => relative(ROOT, file).replaceAll('\\', '/')

/** Alles Eingecheckte unter `packages/` und `apps/`, so wie git es sieht. */
function tracked(): string[] {
  return execFileSync('git', ['ls-files', '--', 'packages', 'apps'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    // Dieselben Ausnahmen wie der Verzeichnislauf: erzeugter Code und die Rust-Seite.
    .filter((file) => !/(^|\/)(node_modules|dist|dist-mp|coverage|target|src-tauri)\//.test(file))
}

describe('M38-4 productionFiles() liest Produktcode und keine Tests', () => {
  const gelesen = productionFiles().map(norm)

  it('laesst keine Testdatei durch — weder .test.ts noch .test.tsx', () => {
    const tests = gelesen.filter((file) => /\.test\.[cm]?[jt]sx?$/.test(file))
    expect(tests, `als Produktcode gelesen:\n${tests.join('\n')}`).toEqual([])
  })

  it('behaelt jede echte .tsx — der Filter schneidet nicht zu weit', () => {
    const echte = tracked().filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
    // Ohne diese Zeile waere „jede echte .tsx ist drin" auch ueber einer leeren Liste wahr.
    expect(echte.length, 'git nennt keine einzige .tsx — die Gegenliste ist leer').toBeGreaterThan(20)

    const fehlend = echte.filter((file) => !gelesen.includes(file))
    expect(fehlend, `echte .tsx, die der Waechter nicht mehr liest:\n${fehlend.join('\n')}`).toEqual([])
  })

  it('behaelt jede echte .ts', () => {
    const echte = tracked().filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    expect(echte.length).toBeGreaterThan(100)

    const fehlend = echte.filter((file) => !gelesen.includes(file))
    expect(fehlend, `echte .ts, die der Waechter nicht mehr liest:\n${fehlend.join('\n')}`).toEqual([])
  })

  it('schneidet genau die Testdateien heraus und sonst nichts', () => {
    // Die Zaehlung, die der Befund verlangt: was git an Quelldateien kennt, minus die
    // Testdateien, ist genau das, was der Waechter liest. Nicht mehr, nicht weniger.
    const quellen = tracked().filter((file) => /\.(ts|tsx|js|mjs|json)$/.test(file))
    const erwartet = quellen.filter((file) => !isTestFile(file)).sort()
    const herausgeschnitten = quellen.filter((file) => isTestFile(file))

    expect(herausgeschnitten.some((file) => file.endsWith('.test.tsx')), 'es gibt gar keine .test.tsx').toBe(true)
    expect(herausgeschnitten.some((file) => file.endsWith('.test.ts')), 'es gibt gar keine .test.ts').toBe(true)
    // Eingecheckt ist eine Teilmenge dessen, was auf der Platte liegt: eine neue, noch
    // nicht eingecheckte Quelldatei liest der Waechter schon, git kennt sie noch nicht.
    const nichtGelesen = erwartet.filter((file) => !gelesen.includes(file))
    expect(nichtGelesen).toEqual([])
  })

  it('erkennt eine Testdatei an ihrem Namen, in beiden Endungen', () => {
    expect(isTestFile('apps/desktop/src/App.test.tsx')).toBe(true)
    expect(isTestFile('apps/desktop/src/net/useNetplay.test.ts')).toBe(true)
    expect(isTestFile('apps/headless/test/stance.slow.test.ts')).toBe(true)
    // Die Gegenprobe: ein Name, der nur so aehnlich aussieht, ist Produktcode.
    expect(isTestFile('apps/desktop/src/App.tsx')).toBe(false)
    expect(isTestFile('apps/desktop/src/ui/Contest.tsx')).toBe(false)
    expect(isTestFile('packages/testkit/src/latest.ts')).toBe(false)
    expect(isTestFile('packages/core/test/golden/tiny-500.json')).toBe(false)
  })

  it('haelt den alten Filter als Gegenprobe fest — er liess .test.tsx durch', () => {
    // Damit die Pruefung nicht bedeutungslos wird, sobald niemand mehr weiss, was war.
    const alterFilter = (file: string): boolean => !file.endsWith('.test.ts')
    expect(alterFilter('apps/desktop/src/App.test.tsx')).toBe(true)
    expect(isTestFile('apps/desktop/src/App.test.tsx')).toBe(true)
  })
})
