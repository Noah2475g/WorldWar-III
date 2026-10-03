import { ONE, clampFixed, mulChain, quotFixed, type Fixed } from '@worldwar/shared'
import { spySalary, unitCount, type PublicView, type Rules } from '@worldwar/core'

/**
 * Finanzen der KI aus der Sicht (D32.2, T-M42-03).
 *
 * Warum ein eigenes Modul: `economy.ts` und `espionage.ts` brauchen beide die Zwillinge unten;
 * `espionage.ts` importiert schon `RESERVE_PERMILLE` aus `economy.ts` — laegen die Zwillinge in
 * `espionage.ts`, entstuende ein Kreisimport. Dieses Modul importiert nichts aus `./economy` oder
 * `./espionage`.
 */

/**
 * Zwilling von `phases/production.ts` (nur Geld) — auf der Sicht statt auf dem Zustand, weil der
 * Runner sie ohne Regeln baut. Aendert sich die Steuerformel im Kern, faellt `finance.test.ts`
 * Block "Finanzen aus der Sicht" (F1/F2).
 */
export function dailyMoneyIncome(view: PublicView, rules: Rules): Fixed {
  if (!view.self.alive) return 0
  const c = rules.constants
  const penalty =
    view.self.capitalLostUntil !== null && view.tick < view.self.capitalLostUntil ? c.capitalLossProductionFactor : ONE
  const window = c.occupationPenaltyDays * c.ticksPerDay
  let scaled = 0
  for (const province of view.provinces) {
    if (province.owner !== view.playerId || province.stale) continue
    if (province.population === undefined || province.morale === undefined) continue
    const taxBase = Math.trunc(province.population / 1000) * c.taxPerThousandPopulationPerTick
    if (taxBase <= 0) continue
    const morale =
      c.productionMoraleFloor + mulChain([ONE - c.productionMoraleFloor, clampFixed(quotFixed(province.morale, 100_000), 0, ONE)])
    const population = clampFixed(quotFixed(province.population, 300_000), 500, 1500)
    const elapsed = province.occupiedSince === undefined ? window : view.tick - province.occupiedSince
    const occupation = elapsed >= window ? ONE : 500 + mulChain([500, quotFixed(elapsed, window)])
    scaled += taxBase * mulChain([morale, population, occupation, penalty])
  }
  return Math.round((scaled * c.ticksPerDay) / ONE)
}

/** Zwilling von `state/army.ts` `armyUpkeep`, nur Geld, auf der Sicht. */
export function dailyArmyMoneyUpkeep(view: PublicView, rules: Rules): Fixed {
  let perTick = 0
  for (const army of view.armies) {
    if (army.owner !== view.playerId) continue
    for (const stack of army.units ?? []) {
      const money = rules.units[stack.unitKey]?.upkeep.money ?? 0
      if (money) perTick += money * unitCount(stack, rules)
    }
  }
  return perTick * rules.constants.ticksPerDay
}

/** Tagessold aller eigenen Spione — Zwilling zu `economyOverview` (`view/economy.ts:114-120`). */
export function dailySpySalary(view: PublicView, rules: Rules): Fixed {
  if (!view.self.alive) return 0
  let sum = 0
  for (const spy of view.espionage.spies) sum += spySalary(rules.constants, spy.mission)
  return sum
}

export interface DailyMoneyLedger {
  income: Fixed
  upkeep: Fixed
  salary: Fixed
  margin: Fixed
}

/**
 * Die Tagesbilanz in Geld (R-AI-11/AK2): Ertrag - Armeeunterhalt - Sold, ohne
 * Aushebungs-Warteschlange (die Sicht der KI fuehrt keine; `runner.ts` baut sie ohne Regeln).
 */
export function dailyMoneyLedger(view: PublicView, rules: Rules): DailyMoneyLedger {
  const income = dailyMoneyIncome(view, rules)
  const upkeep = dailyArmyMoneyUpkeep(view, rules)
  const salary = dailySpySalary(view, rules)
  return { income, upkeep, salary, margin: income - upkeep - salary }
}

/**
 * Wie viele Einheiten die Tagesbilanz noch traegt (D32.4): `bilanz(n) = margin - n * perUnitDaily
 * >= 0`. `bilanz(n) = 0` ist zulaessig (>=, nicht >).
 */
export function unitsWithinDailyBalance(margin: Fixed, perUnitDaily: Fixed): number {
  if (perUnitDaily <= 0) return Number.MAX_SAFE_INTEGER
  if (margin < 0) return 0
  return Math.trunc(margin / perUnitDaily)
}
