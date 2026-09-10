import { describe, expect, it } from 'vitest'

/**
 * Der erste ESLint-Aufruf eines Arbeiters laedt die Konfiguration samt typbewusstem
 * Parser: allein 1,5 s, unter der ganzen Suite (136 Dateien parallel) am 2026-09-11
 * 5,3 s — und damit ueber der 5-s-Vorgabe von vitest. Das ist eine Ladezeit, kein
 * Budget des Spiels; die Vorgabe hier gilt nur diesen Wächtern.
 */
const COLD_ESLINT_MS = 30_000

import { fixture, lintAs } from './scan'

/**
 * R-UI-02, second half: the contrast test only means something if the colours it
 * checks are the colours the interface actually uses. A component that writes its own
 * hex value is outside that guarantee — and that is exactly how a readable design
 * drifts into an unreadable one, one commit at a time (Lesson `ui-needs-design-gate`).
 */
describe('R-UI-02 Keine Farbliterale in Komponenten', { timeout: COLD_ESLINT_MS }, () => {
  it('schlaegt bei der hinterlegten Verstoss-Fixture an', async () => {
    const messages = await lintAs(fixture('color-literals'), 'apps/desktop/src/map/__guard__.ts')

    expect(messages.join('\n')).toMatch(/tokens\.ts/i)
  })

  it('laesst die Tokendatei selbst in Ruhe', async () => {
    // The one file whose job is to hold the values cannot be forbidden from holding them.
    const messages = await lintAs(fixture('color-literals'), 'apps/desktop/src/ui/tokens.ts')

    expect(messages.filter((m) => /tokens\.ts/i.test(m))).toEqual([])
  })

  it('stoert Zeichenketten, die keine Farben sind, nicht', async () => {
    const code = `export const label = 'Provinz #4'\nexport const id = 'p1'\n`
    const messages = await lintAs(code, 'apps/desktop/src/map/__guard__.ts')

    expect(messages.filter((m) => /tokens\.ts/i.test(m))).toEqual([])
  })
})
