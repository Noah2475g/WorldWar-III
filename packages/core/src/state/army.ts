import { ONE, divFixed, mulChain, type Fixed } from '@worldwar/shared'
import type { Rules } from '../rules/types'
import type { Army, ResourceKey, UnitClass, UnitStack } from './types'

/**
 * Helpers around the hit-point pool model (design D2).
 *
 * A stack stores only `hpTotal`. The unit count is derived, never stored — storing
 * both is how the two drift apart. Everything that used to ask "how many units?"
 * asks these functions instead.
 */

/** How many units a pool represents; a partially damaged unit still counts as present. */
export function unitCount(stack: UnitStack, rules: Rules): number {
  const rule = rules.units[stack.unitKey]
  if (!rule || rule.hpPerUnit <= 0) return 0
  // eslint-disable-next-line no-restricted-syntax -- integer division of hit points by per-unit hit points
  return Math.ceil(stack.hpTotal / rule.hpPerUnit)
}

/** Units in an army, across all stacks. Drives the stack cap in combat (belegt: 20/50). */
export function armyUnitCount(army: Army, rules: Rules): number {
  let total = 0
  for (const stack of army.units) total += unitCount(stack, rules)
  return total
}

/** Full hit points an army would have at maximum strength. */
export function armyMaxHp(army: Army, rules: Rules): Fixed {
  let total = 0
  for (const stack of army.units) {
    const rule = rules.units[stack.unitKey]
    if (!rule) continue
    // eslint-disable-next-line no-restricted-syntax -- per-unit hit points x unit count, plain integers
    total += rule.hpPerUnit * unitCount(stack, rules)
  }
  return total
}

export function armyHp(army: Army): Fixed {
  let total = 0
  for (const stack of army.units) total += stack.hpTotal
  return total
}

/** Average condition, 0..1000. Feeds the damage scaling (belegt: 100 % hp -> 100 % damage). */
export function armyCondition(army: Army, rules: Rules): Fixed {
  const max = armyMaxHp(army, rules)
  if (max <= 0) return 0
  // eslint-disable-next-line no-restricted-syntax -- scaling to permille before the division; divFixed does the rounding
  return divFixed(armyHp(army) * ONE, max)
}

/** Upkeep of one army for one tick, per resource. */
export function armyUpkeep(army: Army, rules: Rules): Partial<Record<ResourceKey, Fixed>> {
  const total: Partial<Record<ResourceKey, Fixed>> = {}
  for (const stack of army.units) {
    const rule = rules.units[stack.unitKey]
    if (!rule) continue
    const count = unitCount(stack, rules)
    for (const [key, amount] of Object.entries(rule.upkeep)) {
      if (!amount) continue
      const resource = key as ResourceKey
      // eslint-disable-next-line no-restricted-syntax -- per-unit upkeep x unit count, plain integers
      total[resource] = (total[resource] ?? 0) + amount * count
    }
  }
  return total
}

/** Classes present in an army — combat distributes damage across the ones that are there. */
export function classesIn(army: Army, rules: Rules): Set<UnitClass> {
  const classes = new Set<UnitClass>()
  for (const stack of army.units) {
    const rule = rules.units[stack.unitKey]
    if (rule) classes.add(rule.class)
  }
  return classes
}

/** Removes stacks whose pool has run dry. */
export function pruneEmptyStacks(army: Army): void {
  army.units = army.units.filter((stack) => stack.hpTotal > 0)
}

/** Scales every stack by a factor — used for retreat losses and similar (D6.8). */
export function scaleArmyHp(army: Army, factor: Fixed): Fixed {
  let lost = 0
  for (const stack of army.units) {
    const before = stack.hpTotal
    stack.hpTotal = mulChain([before, factor])
    lost += before - stack.hpTotal
  }
  pruneEmptyStacks(army)
  return lost
}
