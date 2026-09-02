import { parseRules, type Rules } from '@worldwar/core'
import aiRaw from '../../../data/rules/default/ai.json' with { type: 'json' }
import buildingsRaw from '../../../data/rules/default/buildings.json' with { type: 'json' }
import constantsRaw from '../../../data/rules/default/constants.json' with { type: 'json' }
import resourcesRaw from '../../../data/rules/default/resources.json' with { type: 'json' }
import unitsRaw from '../../../data/rules/default/units.json' with { type: 'json' }

/**
 * The real balancing data, parsed through the real loader.
 *
 * Tests deliberately run against the shipped rules rather than a hand-made fixture:
 * if a balancing file breaks, the tests should notice — that is half the point of
 * keeping balance in data (design D-08).
 */
export function defaultRules(): Rules {
  return parseRules(
    {
      constants: constantsRaw,
      resources: resourcesRaw,
      buildings: buildingsRaw,
      units: unitsRaw,
      ai: aiRaw,
    },
    'default',
  )
}

/** Convenience for tests that just need a rule set. */
export const TEST_RULES: Rules = defaultRules()

/** The raw files, for tests that check the loader's own error handling. */
export const RAW_DEFAULT_RULES = {
  constants: constantsRaw,
  resources: resourcesRaw,
  buildings: buildingsRaw,
  units: unitsRaw,
  ai: aiRaw,
}
