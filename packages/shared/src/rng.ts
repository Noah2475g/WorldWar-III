import { ONE, type Fixed } from './fixed'

/**
 * The game's only source of randomness (R-ARCH-01).
 *
 * xoshiro128** — four 32-bit words of state, pure integer operations, no 64-bit
 * arithmetic and therefore no BigInt cost. Two properties matter more than speed:
 *
 *  1. The state is plain data, so it lives inside the game state and survives
 *     save/load exactly. Reloading a game continues the same sequence.
 *  2. Every draw is reproducible from the seed, which is what makes the golden-master
 *     tests and a later lockstep multiplayer possible.
 *
 * Functions mutate the state in place: `step()` works on a mutable draft of the game
 * state anyway (design D5), and copying four words per draw would be pure waste.
 */
export interface RngState {
  s0: number
  s1: number
  s2: number
  s3: number
}

/** SplitMix32 — spreads a small seed (1, 2, 42) into well-mixed initial state. */
function splitMix32(seed: number): () => number {
  let x = seed >>> 0
  return () => {
    x = (x + 0x9e3779b9) >>> 0
    let z = x
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0
    return (z ^ (z >>> 15)) >>> 0
  }
}

export function createRng(seed: number): RngState {
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError(`Seed muss eine ganze Zahl sein, war: ${seed}`)
  }
  const mix = splitMix32(seed)
  const state: RngState = { s0: mix(), s1: mix(), s2: mix(), s3: mix() }
  // All-zero state would make xoshiro produce nothing but zeros forever.
  if ((state.s0 | state.s1 | state.s2 | state.s3) === 0) state.s0 = 1
  return state
}

export function cloneRng(rng: RngState): RngState {
  return { s0: rng.s0, s1: rng.s1, s2: rng.s2, s3: rng.s3 }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0
}

/** Next raw draw: an unsigned 32-bit integer. */
export function nextUint32(rng: RngState): number {
  const result = (Math.imul(rotl(Math.imul(rng.s1, 5) >>> 0, 7), 9) >>> 0) >>> 0
  const t = (rng.s1 << 9) >>> 0

  rng.s2 = (rng.s2 ^ rng.s0) >>> 0
  rng.s3 = (rng.s3 ^ rng.s1) >>> 0
  rng.s1 = (rng.s1 ^ rng.s2) >>> 0
  rng.s0 = (rng.s0 ^ rng.s3) >>> 0
  rng.s2 = (rng.s2 ^ t) >>> 0
  rng.s3 = rotl(rng.s3, 11)

  return result
}

/**
 * Uniform integer in [0, bound).
 *
 * Plain modulo would bias the low values, and a bias here would quietly tilt every
 * revolt roll and combat spread in the same direction. Rejection sampling costs an
 * occasional extra draw and stays exactly uniform — and it stays deterministic,
 * because the number of retries depends only on the sequence itself.
 */
export function nextBelow(rng: RngState, bound: number): number {
  if (!Number.isSafeInteger(bound) || bound <= 0) {
    throw new RangeError(`Obergrenze muss eine positive ganze Zahl sein, war: ${bound}`)
  }
  const limit = 0x100000000 % bound // values below this would be over-represented
  let draw = nextUint32(rng)
  while (draw < limit) draw = nextUint32(rng)
  return draw % bound
}

/** A Fixed value in [0, 1000] — i.e. 0.0 to 1.0. */
export function nextFixed(rng: RngState): Fixed {
  return nextBelow(rng, ONE + 1)
}

/** True with the given probability, expressed as a Fixed share (250 = 25 %). */
export function chance(rng: RngState, probability: Fixed): boolean {
  if (probability <= 0) return false
  if (probability >= ONE) return true
  return nextBelow(rng, ONE) < probability
}

/** Uniform integer in [min, max], both inclusive. */
export function nextInRange(rng: RngState, min: number, max: number): number {
  if (max < min) throw new RangeError(`Leerer Bereich: [${min}, ${max}]`)
  return min + nextBelow(rng, max - min + 1)
}
