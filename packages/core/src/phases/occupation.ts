import type { Phase } from './index'

/**
 * Province capture and owner changes.
 *
 * Empty until T-M5-02 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const occupation: Phase = (_draft, _ctx) => {
  // implemented in T-M5-02
}
