import { describe, expect, it } from 'vitest'
import { uiStylesheets } from './stylesheets'

/**
 * N1 (Seitenleiste v3b E1): Gruen ist keine UI-Farbe mehr. `var(--good)` steht nur dort, wo es
 * Machtfarbe ist: der Einheitenmarker der eigenen Armee und das eigene Einheitenbild.
 * Eine Aenderung dieser Liste braucht einen Kommentar, warum.
 */
const ALLOWLIST = ['.unit-marker', '.unit-art--own']

/** Selektoren aller Regeln, in deren Rumpf `var(--good)` vorkommt. */
export function goodUsers(css: string): string[] {
  const out: string[] = []
  for (const regel of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    if (!/var\(--good\)/.test(regel[2]!)) continue
    const wahl = regel[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim()
    out.push(wahl)
  }
  return out
}

describe('N1 kein Gruen in der UI', () => {
  it('erkennt var(--good) in einer Fixture', () => {
    expect(goodUsers('.a { color: var(--good); }\n.b { color: var(--text); }')).toEqual(['.a'])
  })

  it('var(--good) steht nur in der Allowlist', () => {
    const users = uiStylesheets().flatMap((sheet) => goodUsers(sheet.css))

    expect(users.filter((wahl) => !ALLOWLIST.includes(wahl))).toEqual([])
    // Der Waechter prueft ein Etwas: die Allowlist-Eintraege kommen wirklich vor.
    expect(users).toEqual(expect.arrayContaining(ALLOWLIST))
  })
})
