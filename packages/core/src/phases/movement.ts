import type { Phase } from './index'

/**
 * Army movement, arrivals, deployment delay.
 *
 * Empty until T-M4-02 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const movement: Phase = (_draft, _ctx) => {
  // implemented in T-M4-02
}
