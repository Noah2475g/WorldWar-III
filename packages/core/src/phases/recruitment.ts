import type { Phase } from './index'

/**
 * Recruitment progress and new units.
 *
 * Empty until T-M3-05 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const recruitment: Phase = (_draft, _ctx) => {
  // implemented in T-M3-05
}
