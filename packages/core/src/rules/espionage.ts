import type { Fixed } from '@worldwar/shared'
import type { SpyMission } from '../state/types'
import type { RuleConstants } from './types'

/**
 * Die Regelzahlen der Spionage an einer Stelle (R-SPY-01/02, T-M17-07, D29.7).
 *
 * Jeder Auftrag, den der Kern annimmt. Dieselbe Rolle wie `STANCE_VALUES`: ein Befehl im
 * Gleichschritt (D28) kommt von einer zweiten Maschine, also wird der Wert geprüft, nicht
 * geglaubt. Die Reihenfolge ist die der Referenz 10.2 und die der Oberfläche.
 */
export const SPY_MISSIONS: readonly SpyMission[] = ['intel', 'economicSabotage', 'militarySabotage', 'counter']

/**
 * Der Tagessold eines Auftrags (D29.7).
 *
 * Abgebucht wird er erst im Tageslauf (R-SPY-02, T-M17-08); hier steht nur, wie viel. Die
 * Oberfläche zeigt ihn im Tooltip des Anwerbens und in der Spionageübersicht (R-SPY-06).
 */
export function spySalary(constants: RuleConstants, mission: SpyMission): Fixed {
  switch (mission) {
    case 'intel':
      return constants.spySalaryIntel
    case 'economicSabotage':
      return constants.spySalaryEconomicSabotage
    case 'militarySabotage':
      return constants.spySalaryMilitarySabotage
    case 'counter':
      return constants.spySalaryCounter
  }
}
