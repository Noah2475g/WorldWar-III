import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT } from './scan'

/**
 * Der Einstieg steht fuer die Touch-Bedienung, bevor das erste Bild entsteht (PR #9,
 * Befund C5: die Luecke hatte keinen eigenen Test — `main.tsx` erreichte das zwar
 * schon richtig, aber nichts hielt es fest).
 *
 * Eine reine Textpruefung, wie `test/guards/packaging.test.ts` es fuer denselben
 * `main.tsx` schon tut: `touch.css` muss NACH `app.css` eingebunden sein (die Kaskade
 * entscheidet, wer gewinnt), und `applyInputMode()` muss laufen, BEVOR irgendetwas
 * gezeichnet wird — sonst stuende `data-input` beim ersten Bild noch nicht an `<html>`,
 * und `touch.css` schaltete fuer dieses eine Bild ins Leere.
 */

const main = readFileSync(join(ROOT, 'apps/desktop/src/main.tsx'), 'utf8')

describe('main.tsx: Touch-Einstieg vor dem ersten Bild', () => {
  it('bindet ./ui/touch.css NACH ./ui/app.css ein', () => {
    const appCss = main.indexOf("import './ui/app.css'")
    const touchCss = main.indexOf("import './ui/touch.css'")
    expect(appCss, 'main.tsx bindet ./ui/app.css nicht ein').toBeGreaterThanOrEqual(0)
    expect(touchCss, 'main.tsx bindet ./ui/touch.css nicht ein').toBeGreaterThanOrEqual(0)
    expect(touchCss).toBeGreaterThan(appCss)
  })

  it('ruft applyInputMode() auf, BEVOR das erste Bild gezeichnet wird', () => {
    const call = main.indexOf('applyInputMode()')
    const render = main.indexOf('.render(')
    expect(call, 'main.tsx ruft applyInputMode() nicht auf').toBeGreaterThanOrEqual(0)
    expect(render, 'main.tsx zeichnet nirgends (kein .render())').toBeGreaterThanOrEqual(0)
    expect(call).toBeLessThan(render)
  })
})
