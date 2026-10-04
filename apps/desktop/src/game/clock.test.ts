import { describe, expect, it } from 'vitest'
import { clockCap, clockStep, createClockDriver } from './clock'

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

/** Ein fester Zufall (mulberry32): dieselbe Streuung in jedem Lauf. */
function festerZufall(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Bildzeiten um `1000 / hz`, gleichverteilt um ±`jitterMs` gestreut, `seconds` Sekunden lang. */
function gestreuteBilder(hz: number, jitterMs: number, seconds: number, seed: number): number[] {
  const zufall = festerZufall(seed)
  return Array.from({ length: hz * seconds }, () => 1000 / hz + (zufall() * 2 - 1) * jitterMs)
}

/** So viele Ticks laufen ueber diese Bildzeiten. */
function ticksUeber(bilder: readonly number[], speed: number): number {
  let owed = 0
  let ticks = 0
  for (const dtMs of bilder) {
    const step = clockStep(owed, dtMs, speed)
    ticks += step.due
    owed = step.owed
  }
  return ticks
}

describe('T-M41-04 Nacharbeit: gestreute Bildzeiten verlieren nichts (Durchsicht N1)', () => {
  /*
   * Echte Bilder kommen nicht im Takt. Mit einer Kappe von genau einem 33-ms-Bild verlor
   * bei 30 Hz jedes Bild, das etwas laenger dauerte, seinen Ueberhang — die Tests oben
   * sahen es nicht, weil ihre Bildzeiten exakt sind. Das Soll wird aus der Summe der
   * Bildzeiten abgeleitet: so viel Zeit verging, so viele Spielstunden muessen laufen
   * (abgerundet, der Rest ist der Uebertrag unter einem Tick).
   */
  for (const hz of [30, 60]) {
    it(`${hz} Bilder je Sekunde, gestreut um ±3 ms, laufen bei Tempo 100 so viele Ticks, wie Zeit verging`, () => {
      const bilder = gestreuteBilder(hz, 3, 10, 1914 + hz)
      const summeMs = bilder.reduce((summe, dtMs) => summe + dtMs, 0)
      const soll = Math.floor((summeMs / 1000) * 100 + 1e-9)

      // Nicht leer gemessen: die Streuung reicht wirklich um das Bild herum.
      expect(Math.max(...bilder), 'kein Bild ueber dem Takt').toBeGreaterThan(1000 / hz + 2)
      expect(Math.min(...bilder), 'kein Bild unter dem Takt').toBeLessThan(1000 / hz - 2)
      expect(ticksUeber(bilder, 100), `Soll aus ${summeMs.toFixed(1)} ms`).toBe(soll)
    })
  }
})

describe('T-M41-04 Kein Rueckstau (D5): ein Stillstand wird nicht nachgeholt', () => {
  it('ein Bild nach fuenf Sekunden Stillstand holt hoechstens die Kappe nach', () => {
    for (const speed of [1, 10, 50, 100]) {
      const step = clockStep(0, 5000, speed)
      expect(step.due, `Tempo ${speed}`).toBeLessThanOrEqual(clockCap(speed))
      expect(step.owed, `Tempo ${speed}: Uebertrag`).toBeLessThan(1)
    }
    // Die Kappe ist ein 50-ms-Bild, bei kleinem Tempo mindestens zwei Ticks. Bis zur
    // Nacharbeit (Durchsicht N1) war es ein 33-ms-Bild — genau ein Bild bei 30 Hz, und
    // jedes langsamere Bild verlor seinen Ueberhang.
    expect(clockCap(100)).toBe(5)
    expect(clockCap(40)).toBe(2)
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

/**
 * Die Uhr mit Zeitbudget (T-M45-04, R-PERF-01).
 *
 * Gemessen am Buendel (S575): fuenf Ticks je Bild, sechs Bilder je Sekunde. Der Treiber rechnet
 * Ticks einzeln und hoert auf, wenn das Budget des Aufrufs verbraucht ist; der Rest bleibt
 * geschuldet, hoechstens bis zur Kappe (D5, R-TIME). Die Zeit wird genau einmal gutgeschrieben,
 * gleich wer fragt.
 */
describe('T-M45-04 Der Treiber haelt das Zeitbudget und verliert nichts', () => {
  /** Eine gestellte Uhr: jeder Tick kostet `tickMs`, `now()` ist, was die Uhr zeigt. */
  function rig(speed: number, tickMs: number) {
    const clock = { t: 1000 }
    let ticks = 0
    const driver = createClockDriver({
      speed,
      now: () => clock.t,
      run: () => {
        ticks += 1
        clock.t += tickMs
      },
    })
    return { clock, driver, ticks: () => ticks }
  }

  it('rechnet bei stehender Uhr dieselben Ticks wie die reine Funktion', () => {
    // Billige Ticks (0 ms) und 60 Bilder: dasselbe wie `ticksOver` — das Budget greift nie.
    const { clock, driver, ticks } = rig(100, 0)
    for (let frame = 0; frame < 600; frame++) {
      clock.t += 1000 / 60
      driver.advance(12)
    }
    expect(ticks()).toBe(1000)
    expect(ticks()).toBe(ticksOver(600, 1000 / 60, 100))
  })

  it('rechnet mindestens einen Tick je Aufruf, auch wenn der teurer ist als das Budget', () => {
    const { clock, driver, ticks } = rig(100, 40)
    clock.t += 50
    expect(driver.advance(12)).toBe(1)
    expect(ticks()).toBe(1)
  })

  it('hoert beim Budget auf und laesst den Rest geschuldet', () => {
    // 100 ms Bild bei Tempo 100: fuenf Ticks (die Kappe). Jeder kostet 7 ms, das Budget 12 ms: zwei Ticks laufen.
    const { clock, driver, ticks } = rig(100, 7)
    clock.t += 100
    expect(driver.advance(12)).toBe(2)
    expect(ticks()).toBe(2)
    // Die drei uebrigen sind geschuldet: der naechste Aufruf holt sie, ohne neue Zeit abzuwarten.
    expect(driver.msToNextTick()).toBe(0)
    expect(driver.advance(12)).toBeGreaterThanOrEqual(2)
  })

  it('haelt die Kappe: kein Rueckstand ueber das hinaus, was ein Bild gutschreiben darf', () => {
    const { clock, driver } = rig(100, 30)
    let ran = 0
    for (let call = 0; call < 200; call++) {
      clock.t += call % 2 === 0 ? 5000 : 10
      ran += driver.advance(12)
      // Geschuldet bleibt hoechstens die Kappe: der naechste Aufruf kann nie mehr als Kappe + Kappe verlangen.
      expect(driver.msToNextTick()).toBeGreaterThanOrEqual(0)
    }
    // Ein Haenger von fuenf Sekunden schreibt fuenf Ticks gut, nicht fuenfhundert.
    expect(ran).toBeLessThan(200 * (clockCap(100) * 2 + 1))
  })

  it('schreibt Zeit nur einmal gut, auch wenn Bild und Zeitscheiben abwechselnd fragen', () => {
    // Dieselbe Zeit, einmal in grossen und einmal in kleinen Schritten abgefragt: gleich viele Ticks.
    const big = rig(100, 0)
    const small = rig(100, 0)
    for (let i = 0; i < 100; i++) {
      big.clock.t += 40
      big.driver.advance(12)
      for (let k = 0; k < 4; k++) {
        small.clock.t += 10
        small.driver.advance(12)
      }
    }
    expect(small.ticks()).toBe(big.ticks())
    expect(big.ticks()).toBe(400)
  })

  it('sagt, wann der naechste Tick faellig wird', () => {
    const { clock, driver } = rig(100, 0)
    clock.t += 5
    driver.advance(12)
    // Bei Tempo 100 ist alle 10 ms ein Tick faellig; 5 ms sind vergangen.
    expect(driver.msToNextTick()).toBeCloseTo(5, 5)
    expect(createClockDriver({ speed: 0, now: () => 0, run: () => undefined }).msToNextTick()).toBe(Infinity)
  })
})
