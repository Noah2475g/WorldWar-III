import type { Phase } from './index'

/**
 * Validates and applies this tick's commands, in player order.
 *
 * Empty until T-M1-07 — the pipeline calls it from the start so the phase order is
 * fixed and tested before any rule depends on it.
 */
export const applyCommands: Phase = (_draft, _ctx) => {
  // implemented in T-M1-07
}
