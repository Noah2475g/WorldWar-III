import type { Phase } from './index'

/**
 * War declarations coming into force, truces expiring.
 *
 * Empty until T-M6-01 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const diplomacy: Phase = (_draft, _ctx) => {
  // implemented in T-M6-01
}
