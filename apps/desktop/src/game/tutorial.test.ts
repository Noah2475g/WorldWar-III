import { describe, expect, it } from 'vitest'
import {
  TUTORIAL_OFF,
  TUTORIAL_START,
  TUTORIAL_STEPS,
  advance,
  currentStep,
  dismiss,
  initialTutorial,
  progressLabel,
} from './tutorial.ts'

/**
 * The guided start (T-M12-02b).
 *
 * The content matters less than the three promises: it never blocks input, it appears
 * only in a first game, and switching it off makes it stay off. A tutorial that breaks
 * any of them is one people resent — and this game's whole premise is not wasting the
 * player's time.
 */

describe('R-UI-05 Einstiegshilfe', () => {
  it('fuehrt durch genau fuenf Schritte', () => {
    expect(TUTORIAL_STEPS).toHaveLength(5)
    for (const step of TUTORIAL_STEPS) {
      expect(step.text.length, step.id).toBeGreaterThan(40)
      expect(step.title.length, step.id).toBeGreaterThan(3)
    }
  })

  it('zeigt sich nur in der ersten Partie', () => {
    expect(initialTutorial(false)).toEqual(TUTORIAL_START)
    expect(initialTutorial(true)).toEqual(TUTORIAL_OFF)
  })

  it('geht weiter, wenn der Spieler tut, worum der Schritt bittet', () => {
    const after = advance(TUTORIAL_START, 'selectProvince')

    expect(after.step).toBe(1)
    expect(currentStep(after)?.id).toBe('build')
  })

  it('geht bei einer anderen Handlung nicht weiter', () => {
    // And above all does not get in the way: the player is free to do something else.
    expect(advance(TUTORIAL_START, 'fastForward')).toEqual(TUTORIAL_START)
  })

  it('ist nach dem letzten Schritt vorbei und kommt nicht wieder', () => {
    let state = TUTORIAL_START
    for (const step of TUTORIAL_STEPS) state = advance(state, step.completesOn)

    expect(state.step).toBeNull()
    expect(state.seen).toBe(true)
    expect(currentStep(state)).toBeNull()
  })

  it('laesst sich mittendrin abschalten und bleibt aus', () => {
    const off = dismiss()

    expect(off.seen).toBe(true)
    expect(currentStep(off)).toBeNull()
    // And a later action does not bring it back.
    expect(advance(off, 'selectProvince')).toEqual(off)
  })

  it('sagt, wie viel noch kommt', () => {
    expect(progressLabel(TUTORIAL_START)).toBe('Schritt 1 von 5')
    expect(progressLabel(advance(TUTORIAL_START, 'selectProvince'))).toBe('Schritt 2 von 5')
    expect(progressLabel(TUTORIAL_OFF)).toBe('')
  })
})
