import { describe, expect, it } from 'vitest'
import {
  FixedDivisionByZeroError,
  FixedOverflowError,
  ONE,
  addFixed,
  clampFixed,
  divFixed,
  fromInt,
  fromRatio,
  mulChain,
  mulFixed,
  percentOf,
  quotFixed,
  subFixed,
  toInt,
} from './fixed'

/**
 * Fixed-point arithmetic is the foundation of R-ARCH-01: identical results on every
 * machine, exact equality comparisons, no NaN drift. Everything else in the core
 * inherits its correctness from this file, so it is tested to the branch.
 */
describe('R-ARCH-01 Festkomma-Grundlagen', () => {
  it('rechnet in Tausendsteln', () => {
    expect(ONE).toBe(1000)
    expect(fromInt(3)).toBe(3000)
    expect(toInt(3499)).toBe(3)
    expect(toInt(3500)).toBe(4)
    expect(toInt(-3500)).toBe(-4)
  })

  it('addiert und subtrahiert exakt', () => {
    expect(addFixed(1500, 2500)).toBe(4000)
    expect(subFixed(1500, 2500)).toBe(-1000)
  })

  it('erzeugt Festkommawerte aus Brüchen', () => {
    expect(fromRatio(1, 2)).toBe(500)
    expect(fromRatio(2, 3)).toBe(667) // gerundet, nicht abgeschnitten
    expect(fromRatio(-2, 3)).toBe(-667)
  })
})

describe('R-ARCH-01 Rundung: halbe Betraege vom Nullpunkt weg', () => {
  // The design fixes this explicitly. "Round half away from zero" is symmetric,
  // so a value and its negation always round to mirrored results — without that,
  // damage and morale would drift in opposite directions.
  const cases: Array<[number, number, number]> = [
    [7, 2, 4],
    [-7, 2, -4],
    [5, 2, 3],
    [-5, 2, -3],
    [4, 2, 2],
    [-4, 2, -2],
    [1, 3, 0],
    [-1, 3, 0],
    [2, 3, 1],
    [-2, 3, -1],
    [10, 4, 3],
    [-10, 4, -3],
  ]

  it.each(cases)('divFixed(%i, %i) = %i', (a, b, expected) => {
    expect(divFixed(a, b)).toBe(expected)
  })

  it('ist symmetrisch: divFixed(-a, b) hebt divFixed(a, b) auf', () => {
    // Phrased as a sum so the check itself does not trip over negative zero —
    // which the implementation normalises away on purpose.
    for (let a = -50; a <= 50; a++) {
      for (const b of [1, 2, 3, 7, 1000]) {
        expect(divFixed(-a, b) + divFixed(a, b)).toBe(0)
      }
    }
  })

  it('liefert niemals negative Null', () => {
    // -0 and 0 differ under Object.is, so an unnormalised -0 would make two
    // identical game states produce different hashes.
    expect(Object.is(divFixed(-1, 3), 0)).toBe(true)
    expect(Object.is(divFixed(-1, 1000), 0)).toBe(true)
  })

  it('rundet auch bei negativem Divisor symmetrisch', () => {
    expect(divFixed(7, -2)).toBe(-4)
    expect(divFixed(-7, -2)).toBe(4)
  })
})

describe('R-ARCH-01 Multiplikation und Division von Festkommawerten', () => {
  it('multipliziert mit Normalisierung', () => {
    expect(mulFixed(fromInt(2), fromInt(3))).toBe(fromInt(6))
    expect(mulFixed(500, 500)).toBe(250) // 0,5 * 0,5 = 0,25
    expect(mulFixed(1500, 2000)).toBe(3000)
  })

  it('bildet Quotienten von Festkommawerten', () => {
    expect(quotFixed(fromInt(6), fromInt(3))).toBe(fromInt(2))
    expect(quotFixed(1000, 3000)).toBe(333)
    expect(quotFixed(-1000, 3000)).toBe(-333)
  })

  it('berechnet Anteile', () => {
    expect(percentOf(fromInt(200), 500)).toBe(fromInt(100)) // 50 % von 200
    expect(percentOf(fromInt(200), 0)).toBe(0)
  })

  it('begrenzt Werte', () => {
    expect(clampFixed(1500, 0, 1000)).toBe(1000)
    expect(clampFixed(-5, 0, 1000)).toBe(0)
    expect(clampFixed(500, 0, 1000)).toBe(500)
  })
})

describe('R-ARCH-01 Fehlerfaelle sind Programmierfehler, keine Spielzustaende', () => {
  it('wirft bei Division durch null', () => {
    expect(() => divFixed(1000, 0)).toThrow(FixedDivisionByZeroError)
    expect(() => quotFixed(1000, 0)).toThrow(FixedDivisionByZeroError)
  })

  it('wirft bei Ueberlauf statt still ungenau zu werden', () => {
    const huge = 4_000_000_000
    expect(() => mulFixed(huge, huge)).toThrow(FixedOverflowError)
    expect(() => addFixed(Number.MAX_SAFE_INTEGER, 1000)).toThrow(FixedOverflowError)
  })

  it('wirft bei nicht ganzzahligen Eingaben', () => {
    // A float that slipped in would silently break determinism everywhere downstream.
    expect(() => addFixed(1.5, 1000)).toThrow(FixedOverflowError)
    expect(() => mulFixed(Number.NaN, 1000)).toThrow(FixedOverflowError)
  })
})

describe('R-ARCH-01 Auswertungsreihenfolge ist verbindlich', () => {
  it('mulFixed ist NICHT assoziativ', () => {
    // Documented on purpose: because rounding happens after every multiplication,
    // (a*b)*c and a*(b*c) can differ by one unit. Therefore every formula in design
    // section D6 is evaluated strictly left to right, in the order written there.
    // 1,5 · 1,5 · 0,333 — grouping left gives 749, grouping right gives 750,
    // because 1,5 · 0,333 = 0,4995 rounds up to 0,5 before the last step.
    const a = 1500
    const b = 1500
    const c = 333
    const left = mulFixed(mulFixed(a, b), c)
    const right = mulFixed(a, mulFixed(b, c))
    expect(left).toBe(749)
    expect(right).toBe(750)
    expect(left).not.toBe(right)
  })

  it('mulChain rechnet Ketten in genau dieser Reihenfolge', () => {
    const a = 1500
    const b = 1500
    const c = 333
    expect(mulChain([a, b, c])).toBe(mulFixed(mulFixed(a, b), c))
    expect(mulChain([a, b, c])).toBe(749)
    expect(mulChain([])).toBe(ONE)
    expect(mulChain([2000])).toBe(2000)
  })

  it('mulChain bleibt bei langen Ketten im Wertebereich', () => {
    const factors = Array.from({ length: 20 }, () => 1100) // 1,1 zwanzigmal
    expect(() => mulChain(factors)).not.toThrow()
    expect(mulChain(factors)).toBeGreaterThan(6000)
  })
})
