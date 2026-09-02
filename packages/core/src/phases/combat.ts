import type { Phase } from './index'

/**
 * Battle resolution, bombardment, losses.
 *
 * Empty until T-M4-03 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const combat: Phase = (_draft, _ctx) => {
  // implemented in T-M4-03
}
