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
 * R-ARCH-01: the simulation core is a pure function of state and commands.
 * These tests run the project's real ESLint configuration, so they prove the rules
 * actually fire — not merely that a rule name appears in a config file.
 */
describe('R-ARCH-01 Kern ist rein und deterministisch', { timeout: COLD_ESLINT_MS }, () => {
  it('verbietet Math.random und Date.now in packages/core', async () => {
    const messages = await lintAs(fixture('core-purity'), 'packages/core/src/__guard__.ts')
    expect(messages.join('\n')).toMatch(/deterministic|wall clock/i)
    expect(messages.length).toBeGreaterThanOrEqual(2)
  })

  it('erlaubt dieselben Aufrufe ausserhalb des Kerns', async () => {
    // The rule must be targeted: outside the core, wall clock and randomness are fine.
    const messages = await lintAs(fixture('core-purity'), 'apps/headless/src/__guard__.ts')
    expect(messages.filter((m) => /deterministic|wall clock/i.test(m))).toEqual([])
  })
})

describe('R-TIME-05 keine Realzeit-Kopplung im Kern', { timeout: COLD_ESLINT_MS }, () => {
  it('verbietet setTimeout und performance.now in packages/core', async () => {
    const messages = await lintAs(fixture('realtime'), 'packages/core/src/__guard__.ts')
    expect(messages.join('\n')).toMatch(/real time|wall clock/i)
  })
})

describe('D-02 Festkomma-Arithmetik wird erzwungen', { timeout: COLD_ESLINT_MS }, () => {
  it('verbietet * und / im Kern', async () => {
    // Two Fixed values multiplied directly are wrong by a factor of 1000 and nothing
    // would notice until balancing. The linter is the only reliable safeguard.
    const messages = await lintAs(fixture('fixed-arithmetic'), 'packages/core/src/__guard__.ts')
    expect(messages.join('\n')).toMatch(/mulFixed/)
    expect(messages.join('\n')).toMatch(/divFixed/)
  })
})
