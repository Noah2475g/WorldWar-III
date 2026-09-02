import type { Rules } from '@worldwar/core/rules/types'

/**
 * Balancing values for tests.
 *
 * Real balancing lives in `data/rules/**` (design D-08) — this set exists so core
 * tests do not have to load files, and it uses the documented values from the
 * mechanics reference wherever they are known.
 */
export const TEST_RULES: Rules = {
  id: 'test',
  startResources: {
    food: 20_000_000,
    wood: 20_000_000,
    iron: 10_000_000,
    coal: 10_000_000,
    oil: 5_000_000,
    rare: 2_000_000,
    money: 50_000_000,
  },
  storageLimits: {
    food: 200_000_000,
    wood: 200_000_000,
    iron: 200_000_000,
    coal: 200_000_000,
    oil: 200_000_000,
    rare: 200_000_000,
    // Money is deliberately uncapped (D6.8).
    money: Number.MAX_SAFE_INTEGER,
  },
  constants: {
    ticksPerDay: 24,
    startMorale: 70_000, // belegt: 70
    capturedMorale: 25_000, // belegt: 25
    baseTargetMorale: 102_000, // belegt: 102
    moraleDriftDivisor: 7, // belegt: one seventh of the gap per day
    productionMoraleFloor: 200, // belegt: 0.20 + 0.80 * morale
  },
}
