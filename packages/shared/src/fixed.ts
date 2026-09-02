/**
 * Fixed-point arithmetic for the simulation (design decision D-02).
 *
 * Every game quantity is an integer in thousandths: 1000 means 1.0. This buys three
 * things that floating point cannot give us cheaply: exact equality comparisons,
 * no NaN or Infinity creeping into saved games, and bit-identical results across
 * machines — the precondition for the golden-master tests and for lockstep multiplayer
 * later on (R-ARCH-01, D13).
 *
 * The price is that `a * b` between two Fixed values is wrong by a factor of 1000.
 * An ESLint rule bans `*` and `/` inside packages/core for exactly that reason; use
 * the functions below instead.
 */

/** An integer in thousandths. 1000 = 1.0 */
export type Fixed = number

export const ONE: Fixed = 1000
export const ZERO: Fixed = 0

export class FixedOverflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FixedOverflowError'
  }
}

export class FixedDivisionByZeroError extends Error {
  constructor(message = 'Division durch null') {
    super(message)
    this.name = 'FixedDivisionByZeroError'
  }
}

/**
 * Guards the two ways a Fixed value can silently stop being one: a float sneaking in,
 * or a product leaving the exact integer range. Both are programming errors — never
 * game states — so they throw rather than clamp.
 */
function assertSafeInteger(value: number, context: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new FixedOverflowError(`${context}: ${value} ist keine sichere Ganzzahl`)
  }
}

export function addFixed(a: Fixed, b: Fixed): Fixed {
  assertSafeInteger(a, 'addFixed(a)')
  assertSafeInteger(b, 'addFixed(b)')
  const result = a + b
  assertSafeInteger(result, 'addFixed')
  return result
}

export function subFixed(a: Fixed, b: Fixed): Fixed {
  assertSafeInteger(a, 'subFixed(a)')
  assertSafeInteger(b, 'subFixed(b)')
  const result = a - b
  assertSafeInteger(result, 'subFixed')
  return result
}

/**
 * Integer division, rounding halves away from zero.
 *
 * `divFixed(7, 2) === 4`, `divFixed(-7, 2) === -4`, `divFixed(5, 2) === 3`.
 * Symmetry matters: a rule that rounds 2.5 up but -2.5 towards zero would make
 * production and losses drift in opposite directions over tens of thousands of ticks.
 */
export function divFixed(a: number, b: number): Fixed {
  assertSafeInteger(a, 'divFixed(a)')
  assertSafeInteger(b, 'divFixed(b)')
  if (b === 0) throw new FixedDivisionByZeroError()

  const negative = a < 0 !== b < 0
  const absA = Math.abs(a)
  const absB = Math.abs(b)

  // Compare twice the remainder against the divisor: that is "is the fraction >= 0.5?"
  // without ever leaving integer arithmetic.
  const truncated = Math.trunc(absA / absB)
  const rounded = (absA % absB) * 2 >= absB ? truncated + 1 : truncated

  // Normalise negative zero away. JavaScript treats -0 and 0 as different under
  // Object.is, which would make two identical game states hash differently.
  if (rounded === 0) return 0
  return negative ? -rounded : rounded
}

/** Multiply two Fixed values, normalising back to thousandths. */
export function mulFixed(a: Fixed, b: Fixed): Fixed {
  assertSafeInteger(a, 'mulFixed(a)')
  assertSafeInteger(b, 'mulFixed(b)')
  const raw = a * b
  assertSafeInteger(raw, 'mulFixed (Zwischenwert)')
  return divFixed(raw, ONE)
}

/** Divide two Fixed values, yielding a Fixed quotient. */
export function quotFixed(a: Fixed, b: Fixed): Fixed {
  assertSafeInteger(a, 'quotFixed(a)')
  assertSafeInteger(b, 'quotFixed(b)')
  if (b === 0) throw new FixedDivisionByZeroError()
  const scaled = a * ONE
  assertSafeInteger(scaled, 'quotFixed (Zwischenwert)')
  return divFixed(scaled, b)
}

/**
 * Multiply a chain of factors left to right, normalising after every step.
 *
 * Because rounding happens per step, fixed-point multiplication is not associative.
 * All formulas in design section D6 are therefore evaluated in the order written —
 * this function is how that order is expressed in code.
 */
export function mulChain(factors: readonly Fixed[]): Fixed {
  let acc: Fixed = ONE
  for (const factor of factors) {
    acc = mulFixed(acc, factor)
  }
  return acc
}

/** Whole number to Fixed. */
export function fromInt(value: number): Fixed {
  assertSafeInteger(value, 'fromInt')
  const result = value * ONE
  assertSafeInteger(result, 'fromInt')
  return result
}

/** Fixed to whole number, rounding halves away from zero. */
export function toInt(value: Fixed): number {
  return divFixed(value, ONE)
}

/** Build a Fixed value from a ratio, e.g. fromRatio(2, 3) === 667. */
export function fromRatio(numerator: number, denominator: number): Fixed {
  if (denominator === 0) throw new FixedDivisionByZeroError()
  const scaled = numerator * ONE
  assertSafeInteger(scaled, 'fromRatio (Zwischenwert)')
  return divFixed(scaled, denominator)
}

/** `share` is itself a Fixed factor: percentOf(200000, 500) is 50 % of 200. */
export function percentOf(value: Fixed, share: Fixed): Fixed {
  return mulFixed(value, share)
}

export function clampFixed(value: Fixed, min: Fixed, max: Fixed): Fixed {
  if (value < min) return min
  if (value > max) return max
  return value
}
