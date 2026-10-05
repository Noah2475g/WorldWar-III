import { ONE, clampFixed, mulChain, quotFixed, type Fixed } from '@worldwar/shared'
import type { Tick } from '../state/types'
import type { Rules } from './types'

/**
 * Recruitment timing and starting condition (T-M3-05).
 *
 * Both curves are belegt from the original: recruiting runs at full speed at 100
 * morale and at a fifth at zero, and freshly raised infantry starts with hit points
 * in proportion to the province's morale — a demoralised province produces weak
 * soldiers, not just slow ones.
 */

/** Unter dieser Moral hebt eine Provinz nichts aus (D6.8). */
export const RECRUIT_MIN_MORALE = 25_000

/**
 * Schonfrist nach der Eroberung (VM-01, Noahs Entscheid G1-10b, R-UNIT-02/AK1).
 * Solange die Besatzungszeit laeuft (`occupationPenaltyDays`), sperrt die Moral das Ausheben nicht — sie sinkt in
 * dieser Zeit gerade wegen des Besatzungsabzugs unter die Grenze. Danach und in nie eroberten Provinzen gilt die
 * Grenze unveraendert (D6.8). Kern (`RECRUIT`) und KI (`economy.ts`) fragen beide hier.
 */
export function recruitMoraleBlocked(
  province: { readonly morale?: Fixed | undefined; readonly occupiedSince?: Tick | null | undefined },
  tick: number,
  rules: Rules,
): boolean {
  if ((province.morale ?? 0) >= RECRUIT_MIN_MORALE) return false
  if (province.occupiedSince === null || province.occupiedSince === undefined) return true
  // eslint-disable-next-line no-restricted-syntax -- days x ticks-per-day, plain integers
  const window = rules.constants.occupationPenaltyDays * rules.constants.ticksPerDay
  return tick - province.occupiedSince >= window
}

/** 0 morale -> 20 % speed, 100 morale -> 100 % speed. */
export function recruitSpeedFactor(morale: Fixed): Fixed {
  const share = quotFixed(morale, 100_000)
  return 200 + mulChain([800, clampFixed(share, 0, ONE)])
}

export function recruitDuration(baseTicks: number, morale: Fixed): number {
  const factor = recruitSpeedFactor(morale)
  // eslint-disable-next-line no-restricted-syntax -- ticks scaled by a permille factor, integer arithmetic with explicit rounding
  return Math.max(1, Math.ceil((baseTicks * ONE) / factor))
}

/**
 * Hit points a newly recruited unit starts with, as a share of full strength.
 * Belegt: 75 morale gives roughly three quarters of full hit points.
 */
export function recruitStartCondition(morale: Fixed): Fixed {
  const share = quotFixed(morale, 100_000)
  // Never below a quarter: a unit that arrives already broken would be a trap.
  return clampFixed(share, 250, ONE)
}
