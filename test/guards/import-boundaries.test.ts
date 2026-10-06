import { describe, expect, it } from 'vitest'

/**
 * Der erste ESLint-Aufruf eines Arbeiters laedt die Konfiguration samt typbewusstem
 * Parser: allein 1,5 s, unter verify+Last am 2026-10-05 5,2-5,4 s — und damit ueber
 * der 5-s-Vorgabe von vitest. Das ist eine Ladezeit, kein Budget des Spiels; die
 * Vorgabe hier gilt nur diesen Wächtern.
 */
const COLD_ESLINT_MS = 30_000

import { fixture, lintAs } from './scan'

/**
 * D-01: the dependency direction is shared <- core <- ai <- apps.
 * Without a tool enforcing it, the core and the interface grow into each other —
 * and the headless runner and a later multiplayer server lose their foundation.
 */
describe('R-ARCH-01 Importgrenzen zwischen den Paketen', { timeout: COLD_ESLINT_MS }, () => {
  it('verbietet dem Kern den Griff nach KI und Dateisystem', async () => {
    const messages = await lintAs(fixture('import-boundaries'), 'packages/core/src/__guard__.ts')
    expect(messages.join('\n')).toMatch(/Dependency direction|file system/i)
  })

  it('verbietet shared jeden Import aus dem eigenen Baum', async () => {
    const code = `import { step } from '@worldwar/core'\nexport const x = step\n`
    const messages = await lintAs(code, 'packages/shared/src/__guard__.ts')
    expect(messages.join('\n')).toMatch(/bottom of the dependency chain/i)
  })

  it('laesst die erlaubte Richtung zu', async () => {
    const code = `import { addFixed } from '@worldwar/shared'\nexport const x = addFixed\n`
    const messages = await lintAs(code, 'packages/core/src/__guard__.ts')
    expect(messages.filter((m) => /Dependency direction/i.test(m))).toEqual([])
  })
})
