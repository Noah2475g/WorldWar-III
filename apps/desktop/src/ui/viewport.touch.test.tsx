import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Die Huelle fuer Telefone (Android-Emulator, 2026-09-24).
 *
 * `viewport-fit=cover` legt die Seite bis unter Kamerausschnitt und Rundungen; die
 * Polster dafuer setzt touch.css mit `env(safe-area-inset-*)`. Was die Huelle NICHT tut:
 * das Vergroessern verbieten. `user-scalable=no` oder `maximum-scale=1` hielte zwar die
 * Karte ruhig, nimmt aber jedem, der schlecht sieht, die Lupe (WCAG 1.4.4). Die Karte
 * haelt sich selbst ruhig — mit `touch-action: none` auf ihrer Leinwand.
 */

const html = readFileSync(`${process.cwd()}/apps/desktop/index.html`, 'utf8')
const viewport = /<meta\s+name="viewport"\s+content="([^"]*)"/.exec(html)?.[1] ?? ''
const entries = new Map(
  viewport
    .split(',')
    .map((entry) => entry.trim().split('=').map((part) => part.trim()))
    .filter((pair): pair is [string, string] => pair.length === 2),
)

describe('index.html: die Huelle fuer Telefone', () => {
  it('hat genau einen viewport-Eintrag und findet ihn', () => {
    expect(html.match(/name="viewport"/g)).toHaveLength(1)
    expect(entries.get('width')).toBe('device-width')
    expect(entries.get('initial-scale')).toBe('1')
  })

  it('reicht bis an den Rand des Geraets', () => {
    expect(entries.get('viewport-fit')).toBe('cover')
  })

  it('laesst das Vergroessern erlaubt', () => {
    expect(entries.get('user-scalable') ?? 'yes').not.toMatch(/^(no|0)$/)
    expect(Number(entries.get('maximum-scale') ?? '5')).toBeGreaterThanOrEqual(2)
  })
})
