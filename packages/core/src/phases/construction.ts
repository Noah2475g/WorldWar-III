import type { Phase } from './index'

/**
 * Building progress and completions.
 *
 * Empty until T-M3-04 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const construction: Phase = (_draft, _ctx) => {
  // implemented in T-M3-04
}
