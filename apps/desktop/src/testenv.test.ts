// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

/**
 * Waechter fuer die Testumgebung: Node >= 25 verdeckt jsdoms `localStorage` mit einem eigenen,
 * unbenutzbaren Global (siehe `vitest.config.ts`, `execArgv`). Ohne den Schalter ist es hier
 * `undefined`, und 23 Oberflaechentests fallen mit "reading 'setItem'".
 */
describe('Testumgebung: jsdom-Storage', () => {
  it('localStorage ist ein funktionierendes jsdom-Storage', () => {
    expect(globalThis.localStorage).toBeDefined()
    localStorage.setItem('worldwar.testenv', '1')
    expect(localStorage.getItem('worldwar.testenv')).toBe('1')
    localStorage.removeItem('worldwar.testenv')
    expect(sessionStorage).toBeDefined()
  })
})
