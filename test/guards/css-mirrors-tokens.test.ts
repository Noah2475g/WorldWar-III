import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOKENS } from '../../apps/desktop/src/ui/tokens'
import { ROOT, fixture } from './scan'

/**
 * T-M29-01, R-UI-02: die Farben stehen zweimal — `tokens.ts` fuer Canvas und Tests,
 * `app.css :root` fuer die Kaskade — und nichts hielt sie zusammen. Wer eine Stelle
 * aendert und die andere vergisst, bekommt eine Oberflaeche, deren Kontrasttest gruen
 * ist und deren Panels trotzdem die alten Farben tragen. Dieser Waechter macht das
 * zu einem fallenden Test statt zu einem Fund beim Spielen.
 */

const toKebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/** Alle `--name: #hex` innerhalb des `:root { … }`-Blocks. */
export function rootColorVariables(css: string): Record<string, string> {
  const block = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  const out: Record<string, string> = {}
  for (const match of block.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[match[1]!] = match[2]!.toUpperCase()
  }
  return out
}

/** Jede Abweichung zwischen Stylesheet und Tokentabelle, als lesbare Zeile. */
export function mirrorDiff(css: string, tokens: Readonly<Record<string, string>>): string[] {
  const vars = rootColorVariables(css)
  const problems: string[] = []

  for (const [name, value] of Object.entries(tokens)) {
    const key = toKebab(name)
    const inCss = vars[key]
    if (inCss === undefined) problems.push(`--${key} fehlt in app.css :root (tokens.ts: ${value})`)
    else if (inCss !== value.toUpperCase()) problems.push(`--${key} ist ${inCss}, tokens.ts sagt ${value.toUpperCase()}`)
  }

  const known = new Set(Object.keys(tokens).map(toKebab))
  for (const key of Object.keys(vars)) {
    if (!known.has(key)) problems.push(`--${key} steht in app.css :root, aber nicht in tokens.ts`)
  }

  return problems
}

describe('R-UI-02 app.css spiegelt tokens.ts', () => {
  it('schlaegt bei der verstimmten Fixture in beide Richtungen an', () => {
    const problems = mirrorDiff(fixture('css-mirror'), { ground: '#0D1117', paper: '#161C25', ink: '#E6E1D3' })

    expect(problems).toEqual([
      '--paper ist #FFFFFF, tokens.ts sagt #161C25',
      '--ink fehlt in app.css :root (tokens.ts: #E6E1D3)',
      '--orphan steht in app.css :root, aber nicht in tokens.ts',
    ])
  })

  it('liest nur den :root-Block, nicht die Regeln darunter', () => {
    expect(rootColorVariables(fixture('css-mirror'))).toEqual({ ground: '#0D1117', paper: '#FFFFFF', orphan: '#123456' })
  })

  it('haelt die echte app.css deckungsgleich mit tokens.ts', () => {
    const css = readFileSync(join(ROOT, 'apps', 'desktop', 'src', 'ui', 'app.css'), 'utf8')

    expect(mirrorDiff(css, TOKENS)).toEqual([])
  })
})
