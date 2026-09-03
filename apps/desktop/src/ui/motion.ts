import { CUE_SPEED_LIMIT, prefersReducedMotion } from './sound.ts'

/**
 * The little movement this interface allows itself (T-M13-16, R-UI-04).
 *
 * Exactly one thing moves on its own: the ring around a battle. It breathes, so that a
 * fight is findable on a map of 237 provinces without the player hunting for a red
 * circle. Everything else that moves does so once, in response to something the player
 * or the world did — a new alert fading in, a finished building lighting up — and is
 * done with it.
 *
 * A pure function of time, which is what makes "does it pulse in a steady rhythm"
 * something a test can answer rather than something a person has to watch.
 */

/** One breath of the battle ring. Slow enough to read as breathing, not as blinking. */
export const PULSE_PERIOD_MS = 1600

/**
 * The pulse at a moment in time, 0…1 and back, as a smooth curve.
 *
 * Returns a constant when movement is unwanted — the system setting, or a game running
 * faster than a person can watch. At a hundred game hours a second the ring would
 * strobe, which is not atmosphere but a fault light.
 */
export function pulse(timeMs: number, options: { speed?: number; reduced?: boolean; period?: number } = {}): number {
  const reduced = options.reduced ?? prefersReducedMotion()
  if (reduced || (options.speed ?? 0) > CUE_SPEED_LIMIT) return 1

  const period = options.period ?? PULSE_PERIOD_MS
  // Cosine rather than a sawtooth: a ring that jumps back to its smallest size at the
  // end of each cycle twitches instead of breathing.
  return (1 - Math.cos((timeMs / period) * 2 * Math.PI)) / 2
}

/** Whether anything should move at all right now. */
export function motionAllowed(speed: number, reduced = prefersReducedMotion()): boolean {
  return !reduced && speed <= CUE_SPEED_LIMIT
}

/** The battle ring's radius at a moment in time. */
export function ringRadius(timeMs: number, base: number, options: Parameters<typeof pulse>[1] = {}): number {
  return base + pulse(timeMs, options) * 3
}
