import type { Phase } from './index'

/**
 * The daily settlement (design D3).
 *
 * Everything defined in units of days belongs here, not in the hourly pipeline:
 * morale drift (the rate is per day — applied hourly it would be 24 times too
 * strong), revolt rolls, scores and the victory check. Scoring in particular is a
 * sum over every province, building and unit of every player: pure waste in the
 * hottest path.
 *
 * Filled in by T-M5-01 (morale), T-M5-02 (revolts) and T-M5-03 (score, victory).
 */
export const dailyTick: Phase = (_draft, _ctx) => {
  // implemented in T-M5-01 .. T-M5-03
}
