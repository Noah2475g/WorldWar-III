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
 * Stack cap — the single most important balancing rule of the original (belegt).
 *
 * This is the **marginal** contribution: what the *next* unit adds. Full up to 20, falling
 * linearly to nothing at 50. The reference is explicit about it: "the strength added by
 * additional units linearly drops to 0 %".
 */
export function stackContribution(units: number, rules: Rules): Fixed {
  const full = rules.constants.stackFullContribution
  const zero = rules.constants.stackZeroContribution
  if (units <= full) return ONE
  if (units >= zero) return 0
  return quotFixed(zero - units, zero - full)
}

/**
 * What a stack of `units` units is worth in total — the integral of the curve above.
 *
 * The distinction is the whole point, and getting it wrong cost this game its large
 * armies. Until 2026-09-06 `sideAttackValue` multiplied the *whole* army by the marginal
 * factor, so an army of 50 dealt exactly zero damage while taking losses as before. The
 * damage curve peaked at 25 units and fell from there: 20 → 1501, 25 → 1563, 30 → 1502,
 * 40 → 1000, 49 → 121, 50 → 0. Every unit past the twenty-fifth made an army weaker, and
 * the AI — which merges armies — walked straight into it.
 *
 *   units ≤ full          →  units                    (every unit counts fully)
 *   full < units < zero   →  units − (units−full)² / (2·(zero−full))
 *   units ≥ zero          →  full + (zero−full)/2     (the plateau: 35 units' worth)
 *
 * Monotone by construction: more units are never worth less, they are only worth less
 * *each*. That is what a cap is — a limit on growth, not a punishment for size.
 */
export function effectiveUnits(units: number, rules: Rules): Fixed {
  const full = rules.constants.stackFullContribution
  const zero = rules.constants.stackZeroContribution
  // eslint-disable-next-line no-restricted-syntax -- unit count x ONE, plain integers
  if (units <= full) return units * ONE

  // eslint-disable-next-line no-restricted-syntax -- unit counts and the rule's own thresholds, plain integers
  const plateau = (full * 2 + (zero - full)) * (ONE / 2)
  if (units >= zero) return plateau

  // eslint-disable-next-line no-restricted-syntax -- the triangle under the marginal curve, plain integers
  const shortfall = Math.round(((units - full) * (units - full) * ONE) / (2 * (zero - full)))
  // eslint-disable-next-line no-restricted-syntax -- unit count x ONE, plain integers
  return units * ONE - shortfall
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

/**
 * Reduced strength while an army is still forming up after a march (R-UNIT-05).
 *
 * Die Frage „marschiert sie gerade los" wird hier bewusst NICHT gestellt. T-M32-01 hatte
 * dafuer eine Ausnahme auf `departureTick` — und die loeschte jede laufende Strafe mit,
 * auch die doppelte aus dem Rueckzug: ein Befehl mit einem Tick Verzoegerung genuegte,
 * um wieder bei voller Kraft dazustehen (Durchsicht vom 2026-09-11). Der verzoegerte
 * Abmarsch setzt `deployDelayUntil` stattdessen erst beim tatsaechlichen Abmarsch
 * (`phases/movement.ts`), und diese Funktion bleibt, was sie war.
 */
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
      deploymentFactor(army, state.tick, rules),
      supplyFactor(state, army),
    ])

    // Erst der volle Wert der Armee, dann der Deckel — einmal. Wird je Verband skaliert,
    // rundet jeder Verband für sich, und dieselbe Armee ist mit sechzig Einheiten um eine
    // Festkomma-Einheit schwächer als mit fünfzig: eine Unstetigkeit, die keine Regel will.
    let armyValue = 0
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
      armyValue += weighted * count
    }

    // Der Deckel als Anteil dessen, was die Armee ohne ihn wert wäre: effectiveUnits(n)/n.
    // Vorher stand hier stackContribution(n) — der Grenzbeitrag, angewandt auf die *ganze*
    // Armee, was ab 50 Einheiten jeden Schaden auf null setzte (T-M14-06).
    // Eine Division statt zweier Schritte: quotFixed rundet den Anteil auf drei
    // Nachkommastellen, und aus 583,33 wird 583 — womit dieselbe Armee mit sechzig
    // Einheiten um eine Festkomma-Einheit schwaecher waere als mit fuenfzig.
    // eslint-disable-next-line no-restricted-syntax -- Einheitenzahl x ONE, ganze Zahlen
    const capped = units > 0 ? divFixed(armyValue * effectiveUnits(units, rules), units * ONE) : armyValue

    total += mulChain([capped, modifiers])
  }

  return total
}

/** Defence multiplier of the defending province: additive bonuses, hard capped. */
export function defenceMultiplier(
  province: Province,
  entrenched: boolean,
  rules: Rules,
  /**
   * Does this side own the province? The fortress is theirs alone (T-M14-07, Befund 18).
   *
   * It used to protect whoever stood here, the storming attacker included — and because
   * the bonus is capped, handing it to both sides also swallowed the defender's
   * entrenchment inside the cap: a fortress made the defender's advantage *smaller*.
   * Terrain is different and stays shared: a mountain belongs to nobody.
   *
   * Defaults to true so that existing call sites keep the defender's reading.
   */
  ownsProvince = true,
): Fixed {
  let bonus = 0

  const fortress = province.buildings.fortress ?? 0
  if (fortress > 0 && ownsProvince) {
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

/*
 * There was a `crossingFactor` here — an attack penalty for crossing a river or a strait.
 * It was deleted on 2026-09-05 (T-M14-03): the only occurrence in the whole repository was
 * its own definition. No caller, no test, no effect on a single battle, and the map data it
 * would have read (`crossing`) was maintained on the test map all along. Code that is never
 * called is not a feature waiting to be switched on; it is a claim the rules make and the
 * game does not keep.
 *
 * The map field `crossing` stays: it costs nothing and is the data an amphibious landing
 * would need. R-BAT-03 no longer promises the penalty (DECISIONS.md, 2026-09-05).
 */

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
  // eslint-disable-next-line no-restricted-syntax -- scaling to permille before the single division
  const reduced = divFixed(raw * ONE, defence)
  return Math.max(rules.constants.minDamage, reduced)
}
