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

/**
 * R-UX-01 (Konsistenz) · Das Favicon steht in der Huelle, ohne 404 (T-M44-19, Befund B-19).
 *
 * Ohne `<link rel="icon">` fragt der Browser beim Start `/favicon.ico` an, bekommt 404 und
 * schreibt einen Konsolenfehler — die Aufnahme zaehlt jeden (`consoleErrors`). Das Icon ist ein
 * `data:`-URI im Link: die CSP in `tauri.conf.json` erlaubt `img-src 'self' data:`, es gibt keine
 * neue Bilddatei und keinen Eintrag in `docs/ASSETS.md`. Ein PNG und kein SVG, weil ein SVG im
 * `data:`-URI seinen Namensraum (`http://www.w3.org/...`) mitbraucht und der Wächter
 * `no-foreign-assets` jede `http:`-Adresse in der Huelle verwirft.
 */
describe('R-UX-01 index.html fuehrt ein Icon als data:-URI', () => {
  const link = /<link\s+rel="icon"\s+type="([^"]*)"\s+href="(data:[^"]*)"\s*\/?>/.exec(html)

  it('hat genau ein <link rel="icon"> mit data:-Adresse (heute keines)', () => {
    expect(html.match(/rel="icon"/g)).toHaveLength(1)
    expect(link).not.toBeNull()
  })

  it('traegt ein echtes, kleines PNG: Signatur, Groesse, base64', () => {
    const [, type, href] = link!
    expect(type).toBe('image/png')
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(href!)
    expect(match).not.toBeNull()
    const bytes = Buffer.from(match![1]!, 'base64')
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(bytes.length).toBeLessThan(2048)
    // IHDR: Breite und Hoehe stehen an Byte 16..23 — quadratisch, mindestens 16 px.
    const width = bytes.readUInt32BE(16)
    expect(width).toBe(bytes.readUInt32BE(20))
    expect(width).toBeGreaterThanOrEqual(16)
  })

  it('haelt die Huelle frei von Adressen nach aussen und die CSP offen fuer data:-Bilder', () => {
    expect(html).not.toMatch(/https?:/)
    const conf = readFileSync(`${process.cwd()}/apps/desktop/src-tauri/tauri.conf.json`, 'utf8')
    expect(conf).toMatch(/img-src 'self' data:/)
  })
})
