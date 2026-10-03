import type { Rules } from '@worldwar/core'

/**
 * Die Rolle einer Armee (T-M42-08, R-AI-10/AK2, D32.9).
 *
 * Eine **Batterie** ist eine Armee, deren Einheiten saemtlich Reichweite haben. Bis T-M42-08 stand
 * diese Bedingung wortgleich in `military.ts` (Fernwaffen bleiben stehen, R-BAT-08/AK3) und als
 * Zwilling in `apps/headless/test/m42-zaehlung.ts`; beide lesen sie jetzt hier.
 *
 * Eine Armee aus zwanzig Infanteristen und einer Haubitze ist keine Batterie, sie hat eine dabei.
 */
export type ArmyRole = 'battery' | 'line'

export function isBattery(units: readonly { unitKey: string }[], rules: Rules): boolean {
  return units.length > 0 && units.every((stack) => (rules.units[stack.unitKey]?.rangeProvinces ?? 0) > 0)
}

export function armyRole(units: readonly { unitKey: string }[], rules: Rules): ArmyRole {
  return isBattery(units, rules) ? 'battery' : 'line'
}
