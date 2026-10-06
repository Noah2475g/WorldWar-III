import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TOKENS, contrastRatio } from './tokens'

/**
 * Seitenleiste v3b E1 (D1/D13, K18): Tokens, Aliase, Glas, Reduced-Motion-Block 1:1, kein
 * backdrop-filter, die Toast-Regel gegen fokussierbare Geister (D2 Punkt 2).
 */

const css = readFileSync(`${process.cwd()}/apps/desktop/src/ui/app.css`, 'utf8')

describe('v3b Tokens', () => {
  it('die alten Namen sind Aliase der neuen Werte', () => {
    expect(TOKENS.paper).toBe(TOKENS.surface)
    expect(TOKENS.paperSunk).toBe(TOKENS.raised)
    expect(TOKENS.ink).toBe(TOKENS.text)
    expect(TOKENS.inkSoft).toBe(TOKENS.muted)
    expect(TOKENS.warn).toBe(TOKENS.primary)
    expect(TOKENS.accent).toBe(TOKENS.danger)
    expect(TOKENS.onWarn).toBe(TOKENS.onPrimary)
  })

  it('--line (N2) haelt 3:1 auf surface und raised', () => {
    expect(contrastRatio(TOKENS.line, TOKENS.surface)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(TOKENS.line, TOKENS.raised)).toBeGreaterThanOrEqual(3)
  })

  it('Glas 98 %, Ableitungen als color-mix, Radien, Dauern', () => {
    expect(css).toMatch(/--glass:\s*color-mix\(in srgb, var\(--surface\) 98%, transparent\)/)
    expect(css).toMatch(/--hair:\s*color-mix\(in srgb, var\(--text\) 9%, transparent\)/)
    expect(css).toMatch(/--line-soft:\s*color-mix\(in srgb, var\(--text\) 22%, transparent\)/)
    for (const name of ['--r-s: 8px', '--r-m: 12px', '--r-l: 16px', '--r-xl: 20px', '--r-pill: 999px', '--dur-1: 140ms', '--dur-2: 260ms', '--dur-3: 420ms', '--stagger: 24ms', '--edge: 12px']) {
      expect(css, name).toContain(name)
    }
  })

  it('der Reduced-Motion-Block setzt die Dauern wie design-tokens-v3.css', () => {
    const block = /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{([^}]*)\}/.exec(css)
    expect(block, 'Reduced-Motion-Block fehlt').not.toBeNull()
    const body = block![1]!.replace(/\s+/g, ' ')
    expect(body).toContain('--dur-1: 0ms')
    expect(body).toContain('--dur-2: 120ms')
    expect(body).toContain('--dur-3: 120ms')
    expect(body).toContain('--spring: linear(0, 1)')
    expect(body).toContain('--stagger: 0ms')
  })

  it('kein backdrop-filter in den Stylesheets', () => {
    expect(css).not.toMatch(/backdrop-filter\s*:/)
  })
})

describe('v3b Toast-Regeln und Mikro-Bewegung', () => {
  it('ein ausgeblendeter oder abtretender Toast ist unsichtbar (nicht fokussierbar)', () => {
    expect(css).toMatch(/\[data-sonner-toast\]\[data-visible='false'\],\s*\[data-sonner-toast\]\[data-removed='true'\]\s*\{\s*visibility:\s*hidden;/)
  })

  it('der Toast-Container faengt keine Klicks, die Karte schon', () => {
    expect(css).toMatch(/\[data-sonner-toaster\]\s*\{[^}]*pointer-events:\s*none/)
    expect(css).toMatch(/\[data-sonner-toast\]\s*\{[^}]*pointer-events:\s*auto/)
  })

  it('die neuen Bewegungsregeln bewegen nur transform und opacity (K18)', () => {
    const start = css.indexOf('v3b E1: Toasts, Hinweisspalte, Mikro-Bewegung')
    expect(start).toBeGreaterThan(0)
    const neu = css.slice(start)
    const properties = [...neu.matchAll(/transition:\s*([^;]+);/g)].flatMap((m) =>
      m[1]!.split(',').map((part) => part.trim().split(/\s+/)[0]!),
    )
    // `height` am Toast ist die Transition der Bibliothek (sonner) und wird nur auf die Token-Dauer gesetzt.
    const erlaubt = new Set(['transform', 'opacity', 'height'])
    expect(properties.filter((p) => !erlaubt.has(p))).toEqual([])
    expect(properties).toEqual(expect.arrayContaining(['transform', 'opacity']))
  })
})
