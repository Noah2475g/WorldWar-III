import type { Phase } from './index'

/**
 * Consumption by armies and buildings; shortage handling.
 *
 * Empty until T-M3-03 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const upkeep: Phase = (_draft, _ctx) => {
  // implemented in T-M3-03
}
