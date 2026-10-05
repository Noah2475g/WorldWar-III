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

/**
 * The clock with a time budget (T-M45-04, R-PERF-01).
 *
 * `clockStep` says how many ticks are owed; this says how many of them may run NOW. At the
 * late-game state S575 one tick costs about 11 ms, so five ticks in one animation frame
 * block the thread for 55 ms and the frame loop settles at 6 frames per second — each frame
 * runs the five ticks `clockCap` allows and then waits for the browser to draw. The ticks
 * run on one thread; the rest of the frame (style, paint, raster) happens beside it. Measured
 * at the bundle (2026-10-04): 4.8 ticks per frame, 6 frames per second, 29 ticks per second,
 * while the profile shows the main thread idle for half of the time.
 *
 * So the driver runs ticks one at a time and stops when the budget of this call is spent.
 * What it did not run stays owed, up to `clockCap` — the same bound that keeps the game from
 * freezing after a stall (D5, R-TIME). The caller may call it as often as it likes: from the
 * animation frame (which also draws) and, in between, from short timer slices. Time that
 * passes is credited exactly once, whoever asks.
 */
export interface ClockDriver {
  /** Credits the time since the last call and runs owed ticks until `budgetMs` is spent. Returns the ticks run. */
  advance(budgetMs: number): number
  /** Milliseconds until another whole tick is owed; 0 when one is owed already. */
  msToNextTick(): number
  /** True once `run` signalled a stop (returned true); the driver then runs nothing more. */
  isStopped(): boolean
}

export function createClockDriver(options: {
  readonly speed: number
  /** Milliseconds, any origin (`performance.now`). */
  readonly now: () => number
  /** Runs exactly one tick. Returning true stops the driver for good (auto-pause). */
  readonly run: () => boolean | void
}): ClockDriver {
  const { speed, now, run } = options
  let last = now()
  let owed = 0
  let stopped = false
  return {
    advance(budgetMs) {
      if (stopped) return 0
      const start = now()
      const next = clockStep(owed, start - last, speed)
      last = start
      let left = next.due
      let ran = 0
      while (left > 0) {
        const stop = run()
        ran += 1
        left -= 1
        if (stop === true) {
          stopped = true
          owed = 0
          return ran
        }
        // At least one tick per call; after that the budget decides.
        if (left > 0 && now() - start >= budgetMs) break
      }
      // Unrun ticks stay owed, bounded by the cap: no backlog beyond what a single frame may credit.
      owed = Math.min(next.owed + left, clockCap(speed))
      return ran
    },
    msToNextTick() {
      if (stopped || !(speed > 0)) return Infinity
      return owed >= 1 - EPSILON ? 0 : Math.max(0, ((1 - owed) / speed) * 1000 - (now() - last))
    },
    isStopped() {
      return stopped
    },
  }
}
