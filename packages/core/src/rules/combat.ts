import { ONE, clampFixed, divFixed, mulChain, quotFixed, type Fixed } from '@worldwar/shared'
import type { RngState } from '@worldwar/shared'
import { nextInRange } from '@worldwar/shared'
import { unitCount } from '../state/army'
import type { Rules } from './types'
import type { Army, GameState, Province, UnitClass } from '../state/types'

/**
 * Combat mathematics (R-BAT-01..03, design D6.5).
 *
 * Post-2023 model: deterministic with a ±10 % spread, no misses, damage spread evenly,
 * one stack cap for everyone. Four failure modes are designed out explicitly, because
 * each of them breaks a game rather than a number:
 *
 *  1. Damage never evaporates against classes the enemy does not field.
 *  2. Damage never rounds to zero, so a battle always ends.
 *  3. Defence bonuses add up, they do not multiply into invulnerability.
 *  4. Swapping the sides mirrors the result exactly.
 */

/**
 * Stack cap — the single most important balancing rule of the original (belegt):
 * full contribution up to 20 units, falling linearly to zero at 50.
 */
export function stackContribution(units: number, rules: Rules): Fixed {
  const full = rules.constants.stackFullContribution
  const zero = rules.constants.stackZeroContribution
  if (units <= full) return ONE
  if (units >= zero) return 0
  return quotFixed(zero - units, zero - full)
}

/**
 * There is deliberately no separate "condition" factor.
 *
 * The original scales damage by a unit's remaining hit points (100 % hp -> 100 %
 * damage, 0 % -> 50 %). In the hit-point pool model that scaling already happens:
 * a battered army *is* a smaller pool and therefore deals less damage. Applying the
 * curve on top would punish the same losses twice.
 * Documented in DECISIONS.md, 2026-09-03.
 */

/** Reduced strength while an army is still forming up after a march (R-UNIT-05). */
export function deploymentFactor(army: Army, tick: number, rules: Rules): Fixed {
  return tick < army.deployDelayUntil ? rules.constants.deployDelayFactor : ONE
}

/** Material shortages blunt an attack (design D6.2). */
export function supplyFactor(state: GameState, army: Army): Fixed {
  const player = state.players[army.owner]
  if (!player) return ONE
  const short = player.shortages.includes('wood') || player.shortages.includes('iron')
  return short ? 750 : ONE
}

/** How the enemy's strength is distributed across unit classes, in permille. */
export function classShares(armies: readonly Army[], rules: Rules): Partial<Record<UnitClass, Fixed>> {
  const byClass: Partial<Record<UnitClass, number>> = {}
  let total = 0
  for (const army of armies) {
    for (const stack of army.units) {
      const rule = rules.units[stack.unitKey]
      if (!rule) continue
      byClass[rule.class] = (byClass[rule.class] ?? 0) + stack.hpTotal
      total += stack.hpTotal
    }
  }
  if (total === 0) return {}

  const shares: Partial<Record<UnitClass, Fixed>> = {}
  for (const [key, hp] of Object.entries(byClass)) {
    shares[key as UnitClass] = quotFixed(hp, total)
  }
  return shares
}

/**
 * Attack value of one side against a given enemy composition.
 *
 * Weighted by which classes the enemy actually fields — that is what stops the
 * anti-tank share of a force from vanishing when the enemy brings no tanks.
 */
export function sideAttackValue(
  state: GameState,
  armies: readonly Army[],
  enemyShares: Partial<Record<UnitClass, Fixed>>,
  useDefenceValues: boolean,
  rules: Rules,
): Fixed {
  let total = 0

  for (const army of armies) {
    const units = army.units.reduce((sum, stack) => sum + unitCount(stack, rules), 0)
    const modifiers = mulChain([
      stackContribution(units, rules),
      deploymentFactor(army, state.tick, rules),
      supplyFactor(state, army),
    ])

    for (const stack of army.units) {
      const rule = rules.units[stack.unitKey]
      if (!rule) continue
      const table = useDefenceValues ? rule.defence : rule.attack

      let weighted = 0
      for (const [key, share] of Object.entries(enemyShares)) {
        if (!share) continue
        weighted += mulChain([table[key as UnitClass] ?? 0, share])
      }

      const count = unitCount(stack, rules)
      // eslint-disable-next-line no-restricted-syntax -- weighted value x unit count, plain integers
      total += mulChain([weighted * count, modifiers])
    }
  }

  return total
}

/** Defence multiplier of the defending province: additive bonuses, hard capped. */
export function defenceMultiplier(province: Province, entrenched: boolean, rules: Rules): Fixed {
  let bonus = 0

  const fortress = province.buildings.fortress ?? 0
  if (fortress > 0) {
    const perLevel = rules.buildings.fortress.effects.defenceBonusPermille ?? 0
    // eslint-disable-next-line no-restricted-syntax -- permille bonus x level, plain integers
    bonus += perLevel * fortress
  }
  if (province.terrain === 'mountain') bonus += 300
  if (province.terrain === 'forest') bonus += 150
  if (province.terrain === 'urban') bonus += 200
  if (entrenched) bonus += 250

  return clampFixed(ONE + bonus, ONE, rules.constants.defenceCap)
}

/** Attack penalty for crossing a river or a strait (belegt as a concept, values geschätzt). */
export function crossingFactor(crossing: 'none' | 'river' | 'strait'): Fixed {
  if (crossing === 'river') return 800
  if (crossing === 'strait') return 700
  return ONE
}

/** ±10 % spread from the seeded generator (belegt: no misses, just variance). */
export function applySpread(value: Fixed, rng: RngState, rules: Rules): Fixed {
  const spread = rules.constants.combatSpreadPermille
  const roll = nextInRange(rng, ONE - spread, ONE + spread)
  return mulChain([value, roll])
}

/** Final damage one side deals this tick. Never zero, so a battle always ends. */
export function damageFor(
  attackValue: Fixed,
  defence: Fixed,
  rules: Rules,
): Fixed {
  if (attackValue <= 0) return 0
  const raw = mulChain([attackValue, rules.constants.battleRate])
  const reduced = divFixed(raw * ONE, defence)
  return Math.max(rules.constants.minDamage, reduced)
}
