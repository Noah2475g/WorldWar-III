import type { Phase } from './index'

/**
 * Units recover in friendly territory when not fighting.
 *
 * Empty until T-M4-05 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const regeneration: Phase = (_draft, _ctx) => {
  // implemented in T-M4-05
}
