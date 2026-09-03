import { describe, expect, it } from 'vitest'
import { PULSE_PERIOD_MS, motionAllowed, pulse, ringRadius } from './motion.ts'
import { CUE_SPEED_LIMIT } from './sound.ts'

/**
 * Movement, and its limits (T-M13-16, R-UI-04).
 *
 * A pure function of time, so the rhythm is a test and not something a person has to
 * sit and watch. The three things worth holding on to: it repeats in a steady period,
 * it stops when the system asks for less movement, and it stops when the game is being
 * skimmed rather than watched.
 */

describe('R-UI-04 Der Puls des Kampfrings', () => {
  const options = { reduced: false, speed: 1 }

  it('ist eine reine Funktion der Zeit', () => {
    expect(pulse(400, options)).toBe(pulse(400, options))
  })

  it('wiederholt sich in festem Takt', () => {
    expect(pulse(0, options)).toBeCloseTo(pulse(PULSE_PERIOD_MS, options), 9)
    expect(pulse(300, options)).toBeCloseTo(pulse(300 + 2 * PULSE_PERIOD_MS, options), 9)
  })

  it('atmet zwischen null und eins, ohne zu springen', () => {
    expect(pulse(0, options)).toBeCloseTo(0, 6)
    expect(pulse(PULSE_PERIOD_MS / 2, options)).toBeCloseTo(1, 6)
    for (const time of [0, 200, 700, 1200, 1599]) {
      const value = pulse(time, options)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('steht still, wenn das System weniger Bewegung verlangt', () => {
    expect(pulse(0, { reduced: true })).toBe(1)
    expect(pulse(800, { reduced: true })).toBe(1)
  })

  it('steht still, sobald die Partie schneller laeuft als ein Mensch zusehen kann', () => {
    // Bei hundert Spielstunden je Sekunde waere der Ring ein Stroboskop.
    expect(pulse(400, { reduced: false, speed: CUE_SPEED_LIMIT + 1 })).toBe(1)
    expect(motionAllowed(CUE_SPEED_LIMIT + 1, false)).toBe(false)
    expect(motionAllowed(1, false)).toBe(true)
    expect(motionAllowed(1, true)).toBe(false)
  })

  it('laesst den Ring atmen, nicht wachsen', () => {
    const small = ringRadius(0, 14, options)
    const large = ringRadius(PULSE_PERIOD_MS / 2, 14, options)

    expect(small).toBeCloseTo(14, 6)
    expect(large).toBeCloseTo(17, 6)
  })
})
