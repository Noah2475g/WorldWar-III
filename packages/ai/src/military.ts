import type { Command, ProvinceId } from '@worldwar/core'
import { compareForces, threatMap, worthAttacking } from './threat'
import { rateProvinces } from './targeting'
import type { AiContext, Explanation } from './types'

/**
 * Military decisions (T-M7-03).
 *
 * Order of business: defend what is under pressure, break off what is hopeless, then
 * attack what is worth taking. An army with an assignment keeps it until the situation
 * changes — that is what the memory is for, and what stops the AI from marching its
 * armies back and forth every hour.
 */

/** How much risk this difficulty accepts: 1 cautious, 3 bold. */
function boldness(context: AiContext): number {
  return Math.min(3, Math.max(1, context.difficulty.maxFronts))
}

/**
 * Steht ein Kriegsgegner in Reichweite dieser Armee?
 *
 * Aus der oeffentlichen Sicht gerechnet, nicht aus dem Zustand: die KI darf nur wissen,
 * was sie sieht (R-AI-01). Deshalb zaehlt hier auch nur, was in `view.provinces` steht.
 */
function hasTargetInRange(context: AiContext, army: { provinceId: string }): boolean {
  const { view } = context
  const here = view.provinces.find((province) => province.id === army.provinceId)
  if (!here) return false

  return here.neighbors.some((id) => {
    const neighbour = view.provinces.find((province) => province.id === id)
    if (!neighbour?.owner || neighbour.owner === view.playerId) return false
    if (view.relations[neighbour.owner]?.state !== 'war') return false
    return view.armies.some((other) => other.provinceId === id && other.owner === neighbour.owner)
  })
}

export function militaryCommands(context: AiContext, explanations: Explanation[]): Command[] {
  const { view, memory } = context
  const commands: Command[] = []
  const threat = threatMap(view, context.rules.ai.threatRange)

  const ownArmies = view.armies.filter((army) => army.owner === view.playerId)
  if (ownArmies.length === 0) return commands

  // The province under the most pressure, if any is under real pressure at all.
  const pressured = Object.entries(threat.byProvince)
    .filter(([, value]) => value > 300)
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : 1))[0]

  for (const army of ownArmies) {
    // An army already on its way keeps going unless its home is burning.
    const busy = (army.path?.length ?? 0) > 0

    const here = compareForces(view, army.provinceId, army.strength)
    if (here.enemy > 0 && !worthAttacking(here, boldness(context))) {
      // Losing this fight: pull out rather than feed it.
      commands.push({ type: 'SET_STANCE', playerId: view.playerId, armyId: army.id, stance: 'retreat' })
      explanations.push({
        action: `Zieht ${army.id} aus ${army.provinceId} zurück`,
        reason: `unterlegen (${here.verdict})`,
        score: 800,
        alternative: { action: 'stehen bleiben', score: 200 },
      })
      memory.assignments[army.id] = 'retreat'
      continue
    }

    if (busy) continue

    if (pressured && threat.byProvince[army.provinceId] === undefined) {
      // Not at the front: move towards the province under pressure.
      const [target] = pressured
      if (target !== army.provinceId) {
        commands.push({
          type: 'MOVE_ARMY',
          playerId: view.playerId,
          armyId: army.id,
          targetProvinceId: target as ProvinceId,
        })
        explanations.push({
          action: `Verlegt ${army.id} nach ${target}`,
          reason: 'Grenze unter Druck',
          score: 750,
        })
        memory.assignments[army.id] = `defend:${target}`
        continue
      }
    }

    // R-BAT-08/AK3: Eine Fernwaffenarmee, die ein Ziel in Reichweite hat, bleibt stehen.
    //
    // Sie schiesst dann von selbst (phases/bombardment.ts) — Schaden ohne Gegenschlag.
    // Marschierte sie stattdessen ins Ziel, gaebe sie genau das auf, wofuer sie da ist:
    // eine Artilleriearmee im Nahkampf ist eine schlechte Infanteriearmee.
    // **Nur eine reine Fernwaffenarmee bleibt stehen** — nicht jede, die eine Kanone
    // dabeihat. Die erste Fassung prüfte `armyRange > 0`, und weil die KI gemischt
    // rekrutiert, blieb damit praktisch **jede** Armee an der Front stehen: die
    // ausgelieferte Standardpartie kam über 1500 Spieltage zu keinem Ausgang, obwohl 2453
    // Provinzen den Besitzer wechselten. Eine Armee aus zwanzig Infanteristen und einer
    // Haubitze ist kein Artillerieverband, sie hat eine Haubitze dabei.
    //
    // Eigene Armeen zeigen ihre Zusammensetzung; fremde nicht — deshalb der Vorbehalt.
    const eigeneEinheiten = army.units ?? []
    const nurFernwaffen =
      eigeneEinheiten.length > 0 &&
      eigeneEinheiten.every((stack) => (context.rules.units[stack.unitKey]?.rangeProvinces ?? 0) > 0)
    if (nurFernwaffen && hasTargetInRange(context, army)) {
      explanations.push({
        action: `${army.id} hält Stellung in ${army.provinceId}`,
        reason: 'Fernwaffen mit Ziel in Reichweite — Feuer ohne Gegenschlag',
        score: 700,
        alternative: { action: 'in den Nahkampf marschieren', score: 300 },
      })
      memory.assignments[army.id] = `bombard:${army.provinceId}`
      continue
    }

    // Nothing to defend: look for something worth taking.
    //
    // Der Filter auf die eigene Provinz ist nicht Kosmetik (T-M15-05, gefunden beim
    // Grundlauf): `rateProvinces` bewertet auch die Provinz, in der die Armee steht, und
    // ohne diese Zeile befahl die KI ihr in **jedem Tick** den Marsch dorthin, wo sie
    // schon war. Gemessen an einer Partie ueber 40 Spieltage: **762 von 807 Ablehnungen**
    // waren MOVE_ARMY "bereits dort" — auf 133 angenommene Befehle. Dieselbe Klasse wie
    // die 3046 NO_PATH aus T-M14-11: die KI sah handlungsfaehig aus und war es nicht.
    const targets = rateProvinces(context, army.provinceId).filter(
      (candidate) => candidate.id !== army.provinceId,
    )
    const choice = targets.find((candidate) => {
      const comparison = compareForces(view, candidate.id, army.strength)
      return worthAttacking(comparison, boldness(context))
    })

    if (!choice) {
      explanations.push({
        action: `${army.id} bleibt in ${army.provinceId}`,
        reason: 'kein lohnendes Ziel in Reichweite',
        score: 100,
      })
      memory.assignments[army.id] = 'reserve'
      continue
    }

    commands.push({
      type: 'MOVE_ARMY',
      playerId: view.playerId,
      armyId: army.id,
      targetProvinceId: choice.id,
    })
    explanations.push({
      action: `Greift ${choice.id} mit ${army.id} an`,
      reason: `Wert ${choice.total}, Verteidigung ${choice.defence}`,
      score: choice.total,
      ...(targets[1] ? { alternative: { action: `stattdessen ${targets[1].id}`, score: targets[1].total } } : {}),
    })
    memory.assignments[army.id] = `attack:${choice.id}`
  }

  return commands
}
