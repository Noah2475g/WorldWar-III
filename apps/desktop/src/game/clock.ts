/**
 * The interactive clock as a pure function (T-M41-04, design D5).
 *
 * One call per animation frame: `owed` is the fraction of a tick carried over from the
 * previous frame, `dtMs` the real time since then, `speed` the game hours per second.
 * The result says how many ticks to run now and what to carry into the next frame.
 *
 * Until 2026-09-13 `App.tsx` computed `owed = Math.min(2, owed + dt * speed)`. Capping
 * the TOTAL cut the carried fraction whenever a frame's time plus the carry exceeded the
 * cap: 60 frames per second at speed 100 ran 90 ticks per second, 30 frames only 60.
 * Raising the cap alone does not cure it — `Math.min(Math.max(2, speed / 30), total)`
 * still runs 90 at 30 frames, because every frame after the first is cut by the carry.
 *
 * So the cap sits on the frame's TIME CREDIT, not on the carry: a frame counts at most
 * one 50-ms frame of game time (at least two ticks at low speed, as before), and the
 * carry is always below one tick. That keeps D5 — no backlog that would freeze the game
 * later — and loses nothing at 30 frames or more, even when real frames scatter.
 *
 * Until the rework after the M41 review (finding N1) the cap was one 33-ms frame. That is
 * exactly one frame at 30 Hz, so every frame that came a little late lost its overhang:
 * ten seconds of 30 Hz scattered by ±3 ms ran 976 ticks instead of 998 (`clock.test.ts`).
 */
export interface ClockStep {
  /** Ticks to run in this frame. */
  readonly due: number
  /** The fraction of a tick carried into the next frame, always in [0, 1). */
  readonly owed: number
}

/**
 * Guards the floor against binary rounding. Measured without it: ten seconds at 60 frames
 * ran 19 ticks at speed 2 and 99 at speed 10 — the carry ended a hair below a whole tick.
 */
const EPSILON = 1e-9

/** The most game time, in ticks, a single frame may credit. */
export function clockCap(speed: number): number {
  return Math.max(2, speed / 20)
}

export function clockStep(owed: number, dtMs: number, speed: number): ClockStep {
  // A paused clock or a time source that ran backwards credits nothing.
  if (!(dtMs > 0) || !(speed > 0)) return { due: 0, owed }
  const credit = Math.min((dtMs / 1000) * speed, clockCap(speed))
  const total = owed + credit
  const due = Math.floor(total + EPSILON)
  return { due, owed: Math.max(0, total - due) }
}
