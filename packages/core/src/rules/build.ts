import { ONE, clampFixed, divFixed, mulChain, mulFixed, quotFixed, type Fixed } from '@worldwar/shared'
import type { BuildingRule, ResourceAmounts, RuleConstants, Rules } from './types'
import type { BuildingKey, Province, ResourceKey, Tick } from '../state/types'

/**
 * Shared rules around building and recruiting (T-M3-04, T-M3-05).
 *
 * Kept out of the phases so the interface can ask the same questions the core asks —
 * "can I afford this?", "how long will it take?" — without duplicating a formula.
 */

/**
 * How morale scales construction speed. Belegt from the original:
 * 80 morale is the baseline (100 %), 100 morale gives 110 %, 0 morale gives 20 %.
 */
export function buildSpeedFactor(morale: Fixed): Fixed {
  const baseline = 80_000
  if (morale <= baseline) {
    // 0.2 .. 1.0 across 0..80 morale
    const share = quotFixed(morale, baseline) // 0..1000
    return 200 + mulChain([800, clampFixed(share, 0, ONE)])
  }
  // 1.0 .. 1.1 across 80..100 morale
  const share = quotFixed(morale - baseline, 20_000)
  return ONE + mulChain([100, clampFixed(share, 0, ONE)])
}

/** Ticks a build order actually takes in this province. */
export function buildDuration(baseTicks: number, morale: Fixed): number {
  const factor = buildSpeedFactor(morale)
  // eslint-disable-next-line no-restricted-syntax -- ticks scaled by a permille factor, integer arithmetic with explicit rounding
  return Math.max(1, Math.ceil((baseTicks * ONE) / factor))
}

export function completionTick(tick: Tick, baseTicks: number, morale: Fixed): Tick {
  return tick + buildDuration(baseTicks, morale)
}

/**
 * Der Aufschlag je Gebaeudestufe (T-M34-04, FORTSCHRITT.md D34.3).
 *
 * Der Befund: bis zum 2026-09-12 zog `commands/build.ts` `rule.cost` unveraendert ab und
 * setzte `completionTick` aus `rule.buildTicks` — **die Stufe war reine Buchfuehrung.**
 * Eine Fabrik der dritten Stufe kostete so viel wie die erste und stand genauso schnell.
 * Damit war die zweite Fortschrittsachse des Spiels so kurz wie die erste: wer die Fabrik
 * einmal bezahlen kann, kann sie dreimal bezahlen.
 *
 * Zwei Konstanten, beide als Permille auf jede Stufe **ueber** der ersten. Die erste
 * Stufe bleibt unangetastet — sonst waere aus einer neuen Achse eine allgemeine
 * Verteuerung geworden, und die haette der Parameterlauf nicht auseinanderhalten koennen.
 */
export function buildingCostForLevel(
  rule: Pick<BuildingRule, 'cost'>,
  level: number,
  constants: Pick<RuleConstants, 'buildLevelCostPermille'>,
): ResourceAmounts {
  const steps = Math.max(0, level - 1)
  if (steps === 0) return rule.cost

  const scaled: ResourceAmounts = {}
  for (const [key, amount] of Object.entries(rule.cost)) {
    if (amount === undefined) continue
    let value = amount
    // Je Stufe einmal multipliziert und einmal gerundet, nicht einmal mit dem Produkt:
    // Festkomma-Multiplikation ist nicht assoziativ (mulChain sagt dasselbe), und zwei
    // Wege zu derselben Zahl waeren zwei Zahlen.
    for (let i = 0; i < steps; i++) value = mulFixed(value, constants.buildLevelCostPermille)
    scaled[key as ResourceKey] = value
  }
  return scaled
}

/** Dasselbe fuer die Bauzeit — ganze Ticks, deshalb eigene Rundung. */
export function buildTicksForLevel(
  rule: Pick<BuildingRule, 'buildTicks'>,
  level: number,
  constants: Pick<RuleConstants, 'buildLevelTimePermille'>,
): number {
  let ticks = rule.buildTicks
  for (let i = 0; i < Math.max(0, level - 1); i++) {
    // eslint-disable-next-line no-restricted-syntax -- ganze Ticks mal Permille, Rundung ausdruecklich
    ticks = Math.max(1, Math.round((ticks * constants.buildLevelTimePermille) / ONE))
  }
  return ticks
}

/**
 * Die Stufe, die ein neuer Auftrag hier bauen wuerde — gebaute plus wartende plus eins.
 *
 * Die Warteschlange zaehlt mit, und das ist der Punkt: zwei Auftraege derselben Art
 * nacheinander sind Stufe 2 und Stufe 3 und kosten Verschiedenes. Ohne die Zeile waere
 * der zweite so billig wie der erste, und die Achse liesse sich mit einem Doppelklick
 * umgehen.
 */
export function nextBuildLevel(province: Province, building: BuildingKey): number {
  const current = province.buildings[building] ?? 0
  const queued = province.buildQueue.filter((order) => order.building === building).length
  return current + queued + 1
}

/** Build slots a province offers — cities take more work in parallel than farmland. */
export function buildSlots(province: Province, rules: Rules): number {
  return province.kind === 'city' ? rules.constants.maxBuildSlotsCity : rules.constants.maxBuildSlotsRural
}

export function canAfford(
  stock: Record<ResourceKey, Fixed>,
  cost: Partial<Record<ResourceKey, Fixed>>,
): boolean {
  for (const [key, amount] of Object.entries(cost)) {
    if (!amount) continue
    if (stock[key as ResourceKey] < amount) return false
  }
  return true
}

export function payCost(
  stock: Record<ResourceKey, Fixed>,
  cost: Partial<Record<ResourceKey, Fixed>>,
): void {
  for (const [key, amount] of Object.entries(cost)) {
    if (!amount) continue
    stock[key as ResourceKey] -= amount
  }
}

/** Partial refund when a player cancels their own order. Geschätzt: half back. */
export const CANCEL_REFUND_PERMILLE = 500

export function refundCost(
  stock: Record<ResourceKey, Fixed>,
  cost: Partial<Record<ResourceKey, Fixed>>,
  permille = CANCEL_REFUND_PERMILLE,
): void {
  for (const [key, amount] of Object.entries(cost)) {
    if (!amount) continue
    // eslint-disable-next-line no-restricted-syntax -- amount x permille before the single rounding division
    stock[key as ResourceKey] += divFixed(amount * permille, ONE)
  }
}
