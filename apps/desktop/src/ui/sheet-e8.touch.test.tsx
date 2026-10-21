// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Dock } from './Dock.tsx'
import { readPhoneRecruitOpen, readRecruitOpen, writePhoneRecruitOpen } from './RecruitSheet.tsx'

/**
 * Telefon-Hochformat (Blatt) nach Spec §12.15/§10.9.3/§10.9.4 und Touch quer nach
 * §12.14.1/§12.14.3 (E8, D15).
 *
 * Gebunden ist, was ohne echtes Layout prueffbar ist: die Textgestalt der Regeln in
 * `touch.css` (wie in `portrait.touch.test.tsx`) und das Verhalten der betroffenen
 * Bauteile. Gemessen wird weiterhin im echten Fenster (`pnpm ux:check`).
 */

const UI = `${process.cwd()}/apps/desktop/src/ui`
const touchCss = readFileSync(`${UI}/touch.css`, 'utf8')

const PORTRAIT_QUERY = '@media (max-width: 599px) and (orientation: portrait)'
const LANDSCAPE_QUERY = '@media (max-height: 480px)'

/** Der Inhalt EINES `@media`-Blocks mit dieser Auswahlzeile (wie portrait.touch.test.tsx). */
function blockOf(css: string, query: string, occurrence = 0): string {
  let fromIndex = 0
  for (let i = 0; i <= occurrence; i++) {
    const start = css.indexOf(`${query} {`, fromIndex)
    if (start < 0) return ''
    if (i === occurrence) {
      let depth = 0
      for (let j = css.indexOf('{', start); j < css.length; j++) {
        if (css[j] === '{') depth += 1
        if (css[j] === '}') {
          depth -= 1
          if (depth === 0) return css.slice(css.indexOf('{', start) + 1, j)
        }
      }
      return ''
    }
    fromIndex = start + query.length
  }
  return ''
}

function declarationsOf(block: string, selector: string): string {
  const out: string[] = []
  const bare = block.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]!.split(',').map((s) => s.trim())
    if (selectors.includes(selector)) out.push(match[2]!)
  }
  return out.join('\n')
}

describe('E8/D15 Telefon-Hochformat: Toast oben, 44px, Blatt-Standard', () => {
  const portrait = blockOf(touchCss, PORTRAIT_QUERY)

  it('gibt dem Schliessen-Knopf des Toasts 44px', () => {
    expect(declarationsOf(portrait, ':root:root .toaster [data-close-button]')).toMatch(/width:\s*44px/)
    expect(declarationsOf(portrait, ':root:root .toaster [data-close-button]')).toMatch(/height:\s*44px/)
  })

  it('gibt den Hinweis-Zeichen im Blatt (.alerts--sheet) 44px Trefferflaeche, aber keine 44px Zeilenhoehe (K6-Nacharbeit)', () => {
    // Seit der K6-Nacharbeit (Noah-Entscheidung c) steht die Box selbst auf 44x44 (Trefferflaeche,
    // D15 woertlich), aber ein Minusrand zieht sie wie `.explain__toggle` aus dem Fluss: das
    // sichtbare Zeichen (COLUMN_ICON=28, Alerts.tsx) bestimmt die tatsaechliche Zeilenhoehe, nicht
    // die volle 44px-Box. So bleibt die Trefferflaeche 44px, ohne dass die Zeile im Blatt-Kopf
    // (jetzt Teil der sticky `.sheet__bar`, nicht mehr eigener Block) wieder 44px Hoehe kostet.
    for (const selector of [
      ':root:root .alerts--sheet .alert__jump',
      ':root:root .alerts--sheet .alert__plain',
      ':root:root .alerts--sheet .alert__more',
      ':root:root .alerts--sheet .alert__dismiss',
      ':root:root .alerts--sheet summary',
    ]) {
      const decl = declarationsOf(portrait, selector)
      expect(decl, `${selector} fehlt in touch.css`).toMatch(/width:\s*44px/)
      expect(decl).toMatch(/height:\s*44px/)
      expect(decl, `${selector}: Minusrand fehlt (zieht die 44px-Box aus dem Zeilenfluss)`).toMatch(/margin:\s*-8px/)
    }
    // Die Zeile sitzt jetzt in der sticky Leiste, nicht mehr als eigener Block im Blatt-Koerper.
    expect(declarationsOf(portrait, ':root:root .sheet__bar .alerts--sheet')).toMatch(/flex:\s*1 1 100%/)
  })

  it('stellt das Ausheben-Raster im Blatt 4-spaltig dar und ersetzt damit die Bauplaetze', () => {
    expect(declarationsOf(portrait, ':root:root .recruit-grid--phone .actions')).toMatch(
      /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
    )
  })

  it('Telefon-Standard: das Ausheben-Raster ist standardmaessig ZU (Ausnahme zu D10)', () => {
    const storage = new Map<string, string>()
    const fake = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    }
    // Ohne gespeicherten Zustand: Desktop/Dock (D10) bleibt offen, das Blatt (D15) ist zu.
    expect(readRecruitOpen(fake)).toBe(true)
    expect(readPhoneRecruitOpen(fake)).toBe(false)

    writePhoneRecruitOpen(true, fake)
    expect(readPhoneRecruitOpen(fake)).toBe(true)
    // Der Desktop-Schluessel bleibt davon unberuehrt — zwei getrennte Schluessel.
    expect(readRecruitOpen(fake)).toBe(true)
  })
})

describe('E8/D15 Touch quer: Messzeile §12.14.3, keine kbd-Hinweise, Chips zu viert', () => {
  const landscape = blockOf(touchCss, LANDSCAPE_QUERY, 3)

  it('entfernt die Tastenmarken in diesem Modus', () => {
    expect(declarationsOf(landscape, ":root[data-input='touch'] .rail__key")).toMatch(/display:\s*none/)
    expect(declarationsOf(landscape, ":root[data-input='touch'] .side__key")).toMatch(/display:\s*none/)
  })

  it('stellt die Rohstoff-Chips zu viert in die Reihe', () => {
    expect(declarationsOf(landscape, ":root[data-input='touch'] .resources")).toMatch(
      /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
    )
  })
})

describe('E8/D15 Touch quer: "Land antippen" statt Tastatur-Hinweis', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    // Erzwingt den Finger-Betrieb ueber den groben Hauptzeiger (inputMode.ts).
    window.matchMedia = ((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    cleanup()
  })

  it('zeigt "Land antippen" statt "Land anklicken" im leeren Dock', () => {
    const { getByText } = render(<Dock state="empty" />)
    expect(getByText(/Land antippen/)).toBeTruthy()
  })
})
