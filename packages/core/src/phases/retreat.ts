import type { Phase } from './index'

/**
 * Retreats resolve before movement, so leaving a battle costs its penalty.
 *
 * Empty until T-M4-04 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const retreat: Phase = (_draft, _ctx) => {
  // implemented in T-M4-04
}
