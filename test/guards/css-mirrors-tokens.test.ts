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

/**
 * Jede Farbschreibweise auf sechsstelliges Hex gebracht — oder `null`, wenn es keine ist.
 *
 * Seit T-M28-15: der Waechter kannte nur `#rrggbb` und sah `rgb(...)` und die Kurzform
 * gar nicht. Was er nicht sieht, kann er nicht vergleichen, und zwei Farben der
 * abgeloesten hellen Richtung standen dadurch unbemerkt in `app.css`.
 */
export function toHex(value: string): string | null {
  const text = value.trim()
  const kurz = /^#([0-9a-fA-F]{3})$/.exec(text)
  if (kurz) return `#${[...kurz[1]!].map((c) => c + c).join('').toUpperCase()}`
  const lang = /^#([0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/.exec(text)
  if (lang) return `#${lang[1]!.toUpperCase()}`
  const funktion = /^rgba?\(([^)]*)\)$/.exec(text)
  if (funktion) {
    const teile = funktion[1]!.split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number)
    if (teile.length !== 3 || teile.some((n) => !Number.isFinite(n))) return null
    return `#${teile.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('').toUpperCase()}`
  }
  return null
}

/** Alle Farbvariablen aus JEDEM `:root { … }`-Block, in jeder Schreibweise. */
export function rootColorVariables(css: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const block of css.matchAll(/:root[^{]*\{([^}]*)\}/g)) {
    for (const match of block[1]!.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      const hex = toHex(match[2]!)
      if (hex) out[match[1]!] = hex
    }
  }
  return out
}

/** Farbwoerter sind erlaubt: sie sind keine Farbwahl, sondern ein Zustand. */
const ERLAUBT = new Set(['transparent', 'currentcolor', 'inherit', 'none', 'initial', 'unset'])

/**
 * Farben, die AUSSERHALB eines `:root`-Blocks stehen (T-M28-15).
 *
 * Das ist die Luecke, durch die die zwei Altfarben kamen: der Spiegel vergleicht nur,
 * was in `:root` steht, und eine Farbe in einer Regel darunter wird von ihm nie
 * angesehen. Ausserhalb von `:root` gehoert `var(--token)` hin und sonst nichts.
 */
export function strayColors(css: string): string[] {
  const ohneRoot = css.replace(/:root[^{]*\{[^}]*\}/g, '')
  const funde: string[] = []
  for (const regel of ohneRoot.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    const zeilen = regel[1]!.trim().split(/\r?\n/)
    const wahl = zeilen[zeilen.length - 1]!.trim()
    for (const farbe of regel[2]!.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)) {
      if (ERLAUBT.has(farbe[0].toLowerCase())) continue
      funde.push(`${farbe[0]} in ${wahl}`)
    }
  }
  return funde
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

/**
 * T-M28-15 · Der Wächter sieht jede Farbe, nicht nur die, die er kannte.
 *
 * Befund 7 der Durchsicht vom 2026-09-11: `rootColorVariables` las nur sechsstellige
 * Hex-Werte, und nur im **ersten** `:root`-Block. Zwei Farben der abgelösten hellen
 * Richtung standen dadurch unbemerkt in `app.css` — als `rgb(…)`, außerhalb von `:root`,
 * in der Dialog-Abdunklung und im Tutorial-Schatten. Ein grüner Wächter über einer Menge,
 * die er nicht vollständig sieht, ist genau das Muster, gegen das er gebaut wurde.
 */
describe('T-M28-15 Der Spiegel-Waechter sieht jede Farbe', () => {
  it('liest auch rgb() und dreistellige Kurzform', () => {
    const css = ':root { --a: #ABC; --b: rgb(17 34 51); --c: #11223344; }'

    expect(rootColorVariables(css)).toEqual({ a: '#AABBCC', b: '#112233', c: '#112233' })
  })

  it('liest jeden :root-Block, nicht nur den ersten', () => {
    const css = ':root { --a: #111111; }\n@media (prefers-reduced-motion) { p { margin: 0 } }\n:root { --b: #222222; }'

    expect(rootColorVariables(css)).toEqual({ a: '#111111', b: '#222222' })
  })

  it('meldet eine Farbe, die ausserhalb von :root steht', () => {
    const css = ':root { --ground: #0D1117; }\n.backdrop { background: rgb(31 36 32 / 45%); }'

    expect(strayColors(css)).toEqual(['rgb(31 36 32 / 45%) in .backdrop'])
  })

  it('laesst var() und Farbwoerter in Ruhe', () => {
    const css = ':root { --ground: #0D1117; }\n.x { color: var(--ground); outline-color: transparent; }'

    expect(strayColors(css)).toEqual([])
  })

  it('findet in der echten app.css keine Farbe ausserhalb von :root', () => {
    const css = readFileSync(join(ROOT, 'apps', 'desktop', 'src', 'ui', 'app.css'), 'utf8')

    expect(strayColors(css)).toEqual([])
  })
})
