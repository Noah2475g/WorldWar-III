import { unitCount, type Command } from '@worldwar/core'
import { armyRole } from './army-role'
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
/**
 * **Seit T-M42-08 (R-AI-10/AK2, AK4, D32.9): nach Rolle und unter dem Deckel, in Einheiten.**
 * Die alte Fassung (unten als LOESCHVERMERK) zaehlte Stapel statt Einheiten gegen den Deckel und
 * legte jede Armee mit jeder zusammen - stehende Verbaende bis 132 Einheiten (Stufe 0), und eine
 * Batterie ging in der Infanterie auf und schoss dann nicht mehr von selbst (`military.ts`).
 *
 * - **Rolle:** Batterie mit Batterie, Linie mit Linie (`army-role.ts`).
 * - **Einheiten** ueber `unitCount`, wie der Kern den Deckel rechnet.
 * - **First-Fit** je Provinz und Rolle, Kennungen nach `sort()` wie im Kern (`commands/army.ts`)
 *   und in `absorbedBy`: jede Armee kommt in die erste Gruppe, in der die Summe <=
 *   `stackFullContribution` bleibt, sonst in eine neue. Jede Gruppe mit mindestens zwei Armeen wird
 *   ein `MERGE_ARMIES`.
 * - **Einschiffung:** die Sicht fuehrt `embarked` nicht; die KI schifft nie ein (amphibische KI: M18),
 *   ihre Armeen stehen also alle an Land. Marschierende Armeen (`path`) bleiben aussen vor.
 * - **Alle Provinzen in einem Denkschritt** (seit T-M42-09, D32.10; bis dahin eine je Denkschritt).
 */
export function consolidateCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const { view, rules } = context
  const playerId = view.playerId
  const cap = rules.constants.stackFullContribution

  /** Eigene stehende Armeen je Provinz und Rolle. */
  const byPlace = new Map<string, { id: string; units: number }[]>()
  for (const army of view.armies) {
    if (army.owner !== playerId) continue
    if ((army.path?.length ?? 0) > 0) continue
    const stacks = army.units ?? []
    const units = stacks.reduce((sum, stack) => sum + unitCount(stack, rules), 0)
    if (units === 0) continue
    const key = `${army.provinceId}|${armyRole(stacks, rules)}`
    byPlace.set(key, [...(byPlace.get(key) ?? []), { id: army.id, units }])
  }

  const commands: Command[] = []

  // Provinzen in fester Reihenfolge, damit dieselbe Lage denselben Befehl ergibt.
  const provinces = [...new Set([...byPlace.keys()].map((key) => key.split('|')[0]!))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  )
  for (const provinceId of provinces) {
    for (const role of ['line', 'battery'] as const) {
      const byId = new Map((byPlace.get(`${provinceId}|${role}`) ?? []).map((army) => [army.id, army]))
      const groups: { ids: string[]; units: number }[] = []
      for (const id of [...byId.keys()].sort()) {
        const army = byId.get(id)!
        const group = groups.find((entry) => entry.units + army.units <= cap)
        if (group) {
          group.ids.push(id)
          group.units += army.units
        } else {
          groups.push({ ids: [id], units: army.units })
        }
      }
      for (const group of groups) {
        if (group.ids.length < 2) continue
        commands.push({ type: 'MERGE_ARMIES', playerId, armyIds: group.ids } as Command)
        explanations.push({
          action: `Legt ${group.ids.length} Verbände in ${provinceId} zusammen`,
          reason: `${role === 'battery' ? 'Batterie zu Batterie' : 'Linie zu Linie'}, zusammen ${group.units} Einheiten - der Stapel-Deckel belohnt bis ${cap}`,
          score: 550,
        })
      }
    }

    // LOESCHVERMERK (Review): T-M42-09 (R-AI-10/AK3, D32.10) hebt "eine Provinz je Denkschritt" auf -
    // `absorbedBy` in `decide.ts` sammelt ueber alle MERGE_ARMIES, und eine Provinz je Denkschritt liess
    // auf der Weltkarte Paare ueber zwei Tagesenden stehen (m17-integration Stufe F: 28). Alte Zeilen:
    // // Eine Provinz je Runde: das Zusammenlegen ändert die Lage, und die nächste Entscheidung
    // // soll sie sehen (T-M42-09 hebt das auf).
    // if (commands.length > 0) break
  }

  return commands
}

// LOESCHVERMERK (Review): T-M42-08 ersetzt die alte Fassung (Stapel statt Einheiten, ohne Rolle,
// eine Gruppe je Provinz). Alte Fassung:
// export function consolidateCommands(context: AiContext, explanations: Explanation[]): Command[] {
//   const { view, rules } = context
//   const playerId = view.playerId
//   const cap = rules.constants.stackFullContribution
//
//   /** Eigene Armeen je Provinz, die stillstehen. */
//   const byProvince = new Map<string, { id: string; units: number }[]>()
//   for (const army of view.armies) {
//     if (army.owner !== playerId) continue
//     if ((army.path?.length ?? 0) > 0) continue
//     const units = (army.units ?? []).length
//     if (units === 0) continue
//     byProvince.set(army.provinceId, [
//       ...(byProvince.get(army.provinceId) ?? []),
//       { id: army.id, units },
//     ])
//   }
//
//   const commands: Command[] = []
//
//   // Provinzen in fester Reihenfolge, damit dieselbe Lage denselben Befehl ergibt.
//   for (const provinceId of [...byProvince.keys()].sort((a, b) => a.localeCompare(b, 'en'))) {
//     const armies = [...byProvince.get(provinceId)!].sort((a, b) => a.id.localeCompare(b.id, 'en'))
//     if (armies.length < 2) continue
//
//     // Nur so viele, wie unter dem Deckel bleiben: ein Verband über zwanzig Einheiten
//     // gewinnt weniger, als ein zweiter daneben wert wäre.
//     const chosen: string[] = []
//     let units = 0
//     for (const army of armies) {
//       if (units + army.units > cap && chosen.length >= 2) break
//       chosen.push(army.id)
//       units += army.units
//     }
//     if (chosen.length < 2) continue
//
//     commands.push({ type: 'MERGE_ARMIES', playerId, armyIds: chosen } as Command)
//     explanations.push({
//       action: `Legt ${chosen.length} Verbände in ${provinceId} zusammen`,
//       reason: 'einzeln werden sie einzeln aufgerieben; der Stapel-Deckel belohnt bis zwanzig Einheiten',
//       score: 550,
//     })
//
//     // Einer je Runde: das Zusammenlegen ändert die Lage, und die nächste Entscheidung
//     // soll sie sehen.
//     break
//   }
//
//   return commands
// }
