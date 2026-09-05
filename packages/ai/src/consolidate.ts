import type { Command } from '@worldwar/core'
import type { AiContext, Explanation } from './types'

/**
 * Verbände zusammenlegen, statt sie zu vervielfachen (T-M14-12, Befund 40).
 *
 * Jede Aushebung erzeugt eine eigene Armee, und die KI hat sie nie zusammengelegt:
 * gemessen **127 Armeen bei einer Macht, deren stärkste 2 % ihrer Gesamtkraft hielt**.
 * Das ist nicht nur unordentlich, es ist militärisch sinnlos — der Stapel-Deckel belohnt
 * Verbände bis zwanzig Einheiten (D6.5), und hundert Einzelarmeen werden einzeln
 * aufgerieben, bevor eine von ihnen etwas ausrichtet.
 *
 * `MERGE_ARMIES` gab es seit M4, der Mensch benutzt es über die Oberfläche, und in
 * `packages/ai` erzeugte es keine Zeile.
 *
 * Zusammengelegt wird, was am selben Ort steht und nicht unterwegs ist — die Bedingungen
 * des Kommandos selbst. Die Obergrenze ist der Deckel: über zwanzig Einheiten trägt jede
 * weitere weniger bei, also lohnt sich ein zweiter Verband mehr als ein größerer erster.
 */
export function consolidateCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const { view, rules } = context
  const playerId = view.playerId
  const cap = rules.constants.stackFullContribution

  /** Eigene Armeen je Provinz, die stillstehen. */
  const byProvince = new Map<string, { id: string; units: number }[]>()
  for (const army of view.armies) {
    if (army.owner !== playerId) continue
    if ((army.path?.length ?? 0) > 0) continue
    const units = (army.units ?? []).length
    if (units === 0) continue
    byProvince.set(army.provinceId, [
      ...(byProvince.get(army.provinceId) ?? []),
      { id: army.id, units },
    ])
  }

  const commands: Command[] = []

  // Provinzen in fester Reihenfolge, damit dieselbe Lage denselben Befehl ergibt.
  for (const provinceId of [...byProvince.keys()].sort((a, b) => a.localeCompare(b, 'en'))) {
    const armies = [...byProvince.get(provinceId)!].sort((a, b) => a.id.localeCompare(b.id, 'en'))
    if (armies.length < 2) continue

    // Nur so viele, wie unter dem Deckel bleiben: ein Verband über zwanzig Einheiten
    // gewinnt weniger, als ein zweiter daneben wert wäre.
    const chosen: string[] = []
    let units = 0
    for (const army of armies) {
      if (units + army.units > cap && chosen.length >= 2) break
      chosen.push(army.id)
      units += army.units
    }
    if (chosen.length < 2) continue

    commands.push({ type: 'MERGE_ARMIES', playerId, armyIds: chosen } as Command)
    explanations.push({
      action: `Legt ${chosen.length} Verbände in ${provinceId} zusammen`,
      reason: 'einzeln werden sie einzeln aufgerieben; der Stapel-Deckel belohnt bis zwanzig Einheiten',
      score: 550,
    })

    // Einer je Runde: das Zusammenlegen ändert die Lage, und die nächste Entscheidung
    // soll sie sehen.
    break
  }

  return commands
}
