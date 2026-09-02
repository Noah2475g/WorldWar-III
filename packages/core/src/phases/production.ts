import type { Phase } from './index'

/**
 * Resource production per province, including remainder carry-over.
 *
 * Empty until T-M3-02 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const production: Phase = (_draft, _ctx) => {
  // implemented in T-M3-02
}
