import { describe, expect, it } from 'vitest'
import { ONE } from './fixed'
import { chance, cloneRng, createRng, nextBelow, nextFixed, nextUint32 } from './rng'

/**
 * The only source of randomness in the game. It lives inside the game state, so a
 * saved game resumes the exact same sequence — and two runs from the same seed are
 * bit-identical (R-ARCH-01).
 */
describe('R-ARCH-01 Geseedeter Zufallsgenerator', () => {
  it('liefert fuer denselben Seed dieselbe Folge', () => {
    const a = createRng(1234)
    const b = createRng(1234)
    const fromA = Array.from({ length: 50 }, () => nextUint32(a))
    const fromB = Array.from({ length: 50 }, () => nextUint32(b))
    expect(fromA).toEqual(fromB)
  })

  it('liefert fuer verschiedene Seeds verschiedene Folgen', () => {
    const a = createRng(1)
    const b = createRng(2)
    const fromA = Array.from({ length: 20 }, () => nextUint32(a))
    const fromB = Array.from({ length: 20 }, () => nextUint32(b))
    expect(fromA).not.toEqual(fromB)
  })

  it('bleibt nach Serialisierung und Rueckgabe an derselben Stelle', () => {
    // This is what makes save/load exact: the generator is data, not a closure.
    const rng = createRng(99)
    for (let i = 0; i < 17; i++) nextUint32(rng)

    const revived = JSON.parse(JSON.stringify(rng))
    const expected = Array.from({ length: 10 }, () => nextUint32(rng))
    const actual = Array.from({ length: 10 }, () => nextUint32(revived))
    expect(actual).toEqual(expected)
  })

  it('ist als reines JSON darstellbar', () => {
    const rng = createRng(7)
    expect(JSON.parse(JSON.stringify(rng))).toEqual(rng)
    expect(Object.values(rng).every((v) => Number.isSafeInteger(v))).toBe(true)
  })

  it('laesst sich unabhaengig kopieren', () => {
    const rng = createRng(5)
    const copy = cloneRng(rng)
    nextUint32(rng)
    expect(copy).not.toEqual(rng)
    expect(nextUint32(copy)).toBe(nextUint32(createRng(5)))
  })
})

describe('R-ARCH-01 Verteilung des Zufallsgenerators', () => {
  it('erzeugt nur 32-Bit-Ganzzahlen ohne Vorzeichen', () => {
    const rng = createRng(2026)
    for (let i = 0; i < 1000; i++) {
      const value = nextUint32(rng)
      expect(Number.isSafeInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('verteilt nextBelow gleichmaessig ueber 100 000 Ziehungen', () => {
    const rng = createRng(4242)
    const buckets = new Array<number>(10).fill(0)
    const draws = 100_000
    for (let i = 0; i < draws; i++) buckets[nextBelow(rng, 10)]! += 1

    const expected = draws / 10
    for (const count of buckets) {
      // 3 % tolerance: wide enough not to be flaky, tight enough to catch a broken modulo.
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.03)
    }
  })

  it('bleibt bei nextBelow im Wertebereich', () => {
    const rng = createRng(11)
    for (const bound of [1, 2, 3, 7, 255, 1000]) {
      for (let i = 0; i < 200; i++) {
        const value = nextBelow(rng, bound)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(bound)
      }
    }
  })

  it('weist ungueltige Grenzen zurueck', () => {
    const rng = createRng(1)
    expect(() => nextBelow(rng, 0)).toThrow()
    expect(() => nextBelow(rng, -5)).toThrow()
  })

  it('liefert nextFixed zwischen 0 und 1', () => {
    const rng = createRng(31)
    let sum = 0
    const draws = 20_000
    for (let i = 0; i < draws; i++) {
      const value = nextFixed(rng)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(ONE)
      sum += value
    }
    const mean = sum / draws
    expect(Math.abs(mean - 500)).toBeLessThan(15) // Mittelwert nahe 0,5
  })

  it('trifft chance() in der erwarteten Haeufigkeit', () => {
    const rng = createRng(777)
    let hits = 0
    const draws = 20_000
    for (let i = 0; i < draws; i++) if (chance(rng, 250)) hits += 1 // 25 %
    expect(Math.abs(hits / draws - 0.25)).toBeLessThan(0.02)
  })

  it('behandelt die Randwerte von chance()', () => {
    const rng = createRng(3)
    for (let i = 0; i < 100; i++) {
      expect(chance(rng, 0)).toBe(false)
      expect(chance(rng, ONE)).toBe(true)
    }
  })
})

describe('R-ARCH-01 Golden-Vektor des Zufallsgenerators', () => {
  it('erzeugt fuer Seed 42 unveraenderte Werte', () => {
    // Frozen on 2026-09-02. If this array ever has to change, the generator changed —
    // and with it every golden-master hash in the project. That must be a decision,
    // never an accident.
    const expected = [
      660444221, 3652823732, 77672526, 910233633, 2297337756, 3786072677, 3123505064,
      1891482476, 2460634111, 3466307039, 1235700567, 2581809382, 3652642737, 2730665958,
      1302851675, 2977163998, 1816716173, 1605389910, 2771360340, 3683673832,
    ]
    const rng = createRng(42)
    const actual = Array.from({ length: 20 }, () => nextUint32(rng))
    expect(actual).toEqual(expected)
  })
})
