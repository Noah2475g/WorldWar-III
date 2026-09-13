import { describe, expect, it } from 'vitest'
import { clockCap, clockStep } from './clock'

/**
 * Die Uhr verliert keine Ticks mehr (T-M41-04, Entwurf D5).
 *
 * Befund: `App.tsx` rechnete `owed = Math.min(2, owed + dt * speed)` und warf beim Kappen
 * den Bruchteil weg. Gerechnet: 60 Bilder je Sekunde bei Tempo 100 ergaben 90 Ticks je
 * Sekunde, 30 Bilder bei Tempo 100 nur 60, 30 Bilder bei Tempo 50 nur 45; bei 50, 120 und
 * 144 Bildern stimmte es. Die Uhr ist deshalb eine reine Funktion, und diese Zahlen werden
 * hier nachgerechnet statt behauptet.
 */

/** So viele Ticks laufen in `frames` Bildern zu je `dtMs` Millisekunden. */
function ticksOver(frames: number, dtMs: number, speed: number): number {
  let owed = 0
  let ticks = 0
  for (let frame = 0; frame < frames; frame++) {
    const step = clockStep(owed, dtMs, speed)
    ticks += step.due
    owed = step.owed
  }
  return ticks
}

describe('T-M41-04 Tempo heisst Spielstunden je Sekunde, bei jeder ueblichen Bildrate', () => {
  it('60 Bilder zu 16,67 ms bei Tempo 100 ergeben 100 Ticks (vorher 90)', () => {
    expect(ticksOver(60, 16.67, 100)).toBe(100)
    expect(ticksOver(60, 1000 / 60, 100)).toBe(100)
  })

  it('30 Bilder zu 33,3 ms bei Tempo 100 ergeben 100 Ticks (vorher 60)', () => {
    expect(ticksOver(30, 1000 / 30, 100)).toBe(100)
  })

  it('30 Bilder bei Tempo 50 ergeben 50 Ticks (vorher 45)', () => {
    expect(ticksOver(30, 1000 / 30, 50)).toBe(50)
  })

  it('bei 50, 120 und 144 Bildern stimmt es weiterhin', () => {
    for (const hz of [50, 120, 144]) {
      expect(ticksOver(hz, 1000 / hz, 100), `${hz} Hz`).toBe(100)
    }
  })

  it('haelt jede Raststufe ueber zehn Sekunden bei 60 Bildern genau', () => {
    for (const speed of [1, 2, 5, 10, 25, 50, 100]) {
      expect(ticksOver(600, 1000 / 60, speed), `Tempo ${speed}`).toBe(speed * 10)
    }
  })

  it('laeuft bei Tempo 0 nicht', () => {
    expect(ticksOver(60, 1000 / 60, 0)).toBe(0)
  })
})

describe('T-M41-04 Kein Rueckstau (D5): ein Stillstand wird nicht nachgeholt', () => {
  it('ein Bild nach fuenf Sekunden Stillstand holt hoechstens die Kappe nach', () => {
    for (const speed of [1, 10, 50, 100]) {
      const step = clockStep(0, 5000, speed)
      expect(step.due, `Tempo ${speed}`).toBeLessThanOrEqual(clockCap(speed))
      expect(step.owed, `Tempo ${speed}: Uebertrag`).toBeLessThan(1)
    }
    // Die Kappe ist ein 33-ms-Bild, bei kleinem Tempo mindestens zwei Ticks.
    expect(clockCap(100)).toBeCloseTo(100 / 30)
    expect(clockCap(1)).toBe(2)
  })

  it('der Uebertrag bleibt unter einem Tick, wie lange die Maschine auch haengt', () => {
    // Das ist D5 als Zahl: waechst der Uebertrag nicht, kann kein Rueckstand das Spiel
    // spaeter einfrieren. Jedes Bild holt hoechstens die Kappe plus den Rest unter 1 nach.
    let owed = 0
    for (let frame = 0; frame < 1000; frame++) {
      const dtMs = frame % 3 === 0 ? 5000 : 1000 / 30
      const step = clockStep(owed, dtMs, 100)
      expect(step.due).toBeLessThan(clockCap(100) + 1)
      expect(step.owed).toBeLessThan(1)
      expect(step.owed).toBeGreaterThanOrEqual(0)
      owed = step.owed
    }
  })

  it('rechnet mit einer rueckwaerts laufenden Zeitquelle keine negativen Ticks', () => {
    const step = clockStep(0.5, -20, 100)
    expect(step.due).toBe(0)
    expect(step.owed).toBe(0.5)
  })
})
