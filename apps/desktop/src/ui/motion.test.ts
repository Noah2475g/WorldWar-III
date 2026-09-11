import { describe, expect, it } from 'vitest'
import {
  BATTLE_FLASH_MS,
  OWNERSHIP_FADE_MS,
  PULSE_PERIOD_MS,
  battleFlash,
  fadeProgress,
  motionAllowed,
  pulse,
  ringRadius,
} from './motion.ts'
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

/**
 * Die Farbwelle eines Besitzwechsels (T-M26-02, R-UI-17, D25.4).
 *
 * Ein Besitzwechsel war ein harter Farbsprung zwischen zwei Bildern. Die Blendkurve
 * ist an feste Zeitpunkte gebunden, damit "laeuft in rund 600 ms" eine Testaussage
 * ist und kein Eindruck — und der reduced-motion-Pfad springt sofort ans Ende, denn
 * wer weniger Bewegung verlangt, bekommt den alten harten (ehrlichen) Wechsel.
 */
describe('R-UI-17 Die Blendkurve des Besitzwechsels', () => {
  const options = { reduced: false, speed: 1 }

  it('ist an feste Zeitpunkte gebunden: Anfang, Mitte, Ende', () => {
    expect(fadeProgress(0, options)).toBe(0)
    // Smoothstep ist punktsymmetrisch: die halbe Dauer liegt exakt in der Mitte.
    expect(fadeProgress(OWNERSHIP_FADE_MS / 2, options)).toBeCloseTo(0.5, 9)
    expect(fadeProgress(OWNERSHIP_FADE_MS, options)).toBe(1)
  })

  it('laeuft in rund 600 ms und bleibt danach am Ende stehen', () => {
    expect(OWNERSHIP_FADE_MS).toBe(600)
    expect(fadeProgress(OWNERSHIP_FADE_MS * 3, options)).toBe(1)
    // Vor dem Anfang gibt es nichts zu blenden — auch nicht bei krummen Uhren.
    expect(fadeProgress(-50, options)).toBe(0)
  })

  it('setzt die Farbe bei prefers-reduced-motion sofort um', () => {
    expect(fadeProgress(0, { reduced: true })).toBe(1)
    expect(fadeProgress(300, { reduced: true })).toBe(1)
  })

  it('setzt die Farbe sofort um, wenn die Partie schneller laeuft als ein Mensch zusieht', () => {
    expect(fadeProgress(0, { reduced: false, speed: CUE_SPEED_LIMIT + 1 })).toBe(1)
  })

  it('steigt monoton — eine Welle, die zurueckschwappt, waere ein Flackern', () => {
    let previous = -1
    for (let time = 0; time <= OWNERSHIP_FADE_MS; time += 50) {
      const value = fadeProgress(time, options)
      expect(value).toBeGreaterThanOrEqual(previous)
      previous = value
    }
  })
})

/**
 * T-M28-08 · Das Aufblitzen je Gefechtsrunde.
 *
 * Der Puls atmet in eigenem Takt und sagt nichts über das Spiel; das Blitzen hängt am
 * Tick — eine Gefechtsrunde, ein Blitz. Wie alles Bewegte hört es auf, wenn weniger
 * Bewegung verlangt ist oder das Spiel schneller läuft, als ein Mensch zusieht.
 */
describe('T-M28-08 Das Aufblitzen je Gefechtsrunde', () => {
  it('beginnt hell und ist nach der Blitzdauer vorbei', () => {
    expect(battleFlash(0, { reduced: false })).toBe(1)
    expect(battleFlash(BATTLE_FLASH_MS / 2, { reduced: false })).toBeCloseTo(0.5, 6)
    expect(battleFlash(BATTLE_FLASH_MS, { reduced: false })).toBe(0)
    expect(battleFlash(BATTLE_FLASH_MS * 3, { reduced: false })).toBe(0)
  })

  it('bleibt dunkel, wenn weniger Bewegung verlangt ist oder das Spiel rennt', () => {
    expect(battleFlash(0, { reduced: true })).toBe(0)
    expect(battleFlash(0, { reduced: false, speed: 100 })).toBe(0)
  })
})
